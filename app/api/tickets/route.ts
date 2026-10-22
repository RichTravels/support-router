/**
 * POST /api/tickets — classify a ticket with OpenAI and persist rows.
 *
 * Environment variables this route expects:
 *
 * OPENAI_API_KEY
 *   — Server-side only. Bearer token for https://api.openai.com .
 *
 * OPENAI_MODEL (optional)
 *   — Defaults to "gpt-4o-mini".
 *
 * NEXT_PUBLIC_SUPABASE_URL
 *   — Existing Supabase project URL.
 *
 * SUPABASE_SERVICE_ROLE_KEY (required)
 *   — Server-only secret key. Never prefix it with NEXT_PUBLIC_.
 *   — Bypasses RLS so this public intake route can read `departments` and
 *     insert one `tickets` row plus an `ai_logs` row without a user session.
 *   — Available in Dashboard → Settings → API → service_role / secret key.
 *
 * This POST stays public so customers can submit a ticket. It must not read
 * or return any other ticket. Callers are rate limited per IP.
 * TICKET_INTAKE_RATE_LIMIT (optional, default 10)
 * TICKET_INTAKE_RATE_WINDOW_SECONDS (optional, default 60)
 *
 * Expected Supabase shapes (rename columns here if yours differ):
 * - departments(id, name) — routed by comparing normalized `name`.
 * - tickets(customer_email, subject, message, department_id,
 *           sentiment, ai_priority, ai_summary)
 * - ai_logs columns (exact names): ticket_id (nullable uuid), raw_prompt, raw_response,
 *   confidence_score (numeric; use null when routing failed before a model classification).
 */

import type { SupabaseClient } from "@supabase/supabase-js";
import { NextResponse } from "next/server";

import { clientIp, createRateLimiter, positiveInt } from "@/utils/rate-limit";
import { createServiceClient } from "@/utils/supabase/service";

const intakeLimiter = createRateLimiter({
  limit: positiveInt(process.env.TICKET_INTAKE_RATE_LIMIT, 10, 1_000),
  windowMs:
    positiveInt(process.env.TICKET_INTAKE_RATE_WINDOW_SECONDS, 60, 86_400) *
    1000,
});

const MAX_BODY_CHARS = 32_000;

function noStoreJson(body: unknown, init: { status: number }) {
  const response = NextResponse.json(body, init);
  response.headers.set("Cache-Control", "no-store");
  return response;
}

/** Stop reading once the cap is exceeded so a public caller cannot buffer a huge body. */
async function readBodyLimited(
  request: Request,
  maxChars: number,
): Promise<{ ok: true; text: string } | { ok: false }> {
  const advertised = Number(request.headers.get("content-length"));
  if (Number.isFinite(advertised) && advertised > maxChars) {
    return { ok: false };
  }

  if (!request.body) return { ok: true, text: "" };

  const reader = request.body.getReader();
  const chunks: Uint8Array[] = [];
  let total = 0;
  try {
    while (true) {
      const { done, value } = await reader.read();
      if (done) break;
      total += value.byteLength;
      if (total > maxChars) {
        await reader.cancel();
        return { ok: false };
      }
      chunks.push(value);
    }
  } finally {
    try {
      reader.releaseLock();
    } catch {
      // cancel() can release the reader before this runs.
    }
  }

  return { ok: true, text: new TextDecoder().decode(Buffer.concat(chunks)) };
}

type DepartmentRow = { id: string; name: string };

type AiTicketAnalysis = {
  sentiment: string;
  ai_priority: "low" | "medium" | "high";
  ai_summary: string;
  department_name: string;
};

const OPENAI_API_URL = "https://api.openai.com/v1/chat/completions";

function getSupabaseServer() {
  return createServiceClient();
}

function normalizeName(s: string) {
  return s.trim().toLowerCase().replace(/\s+/g, " ");
}

async function classifyTicketWithOpenAI(params: {
  subject: string;
  message: string;
  departmentNames: string[];
}): Promise<{
  analysis: AiTicketAnalysis;
  confidence_score: number;
  outboundRequestPayload: Record<string, unknown>;
  completionJson: Record<string, unknown>;
}> {
  const apiKey = process.env.OPENAI_API_KEY?.trim();
  if (!apiKey) {
    throw new Error("OPENAI_API_KEY is missing.");
  }

  const model = process.env.OPENAI_MODEL?.trim() ?? "gpt-4o-mini";
  const deptList = params.departmentNames.map((n) => `- ${n}`).join("\n");

  const system = `You are a support routing assistant.
Analyze the customer's message and reply with ONLY valid JSON (no markdown, no backticks).

The JSON object must contain:
- "sentiment" (string): short label such as frustrated, neutral, angry, appreciative, urgent, confused, etc.
- "ai_priority" (string): exactly one of: low, medium, high
- "ai_summary" (string): 1-3 concise sentences usable by human agents (no markdown)
- "department_name" (string): must match EXACTLY one of the allowed department names from the provided list (character-for-character spelling and spacing as listed).
- "confidence" (number): from 0 to 1 expressing how certain you are about department_name and priority.

Allowed department names:
${deptList}

If unsure, choose the closest department_name from the list and set ai_priority accordingly.`;

  const user = `Ticket subject:\n${params.subject}\n\nTicket message:\n${params.message}`;

  const outboundRequestPayload: Record<string, unknown> = {
    model,
    messages: [
      { role: "system", content: system },
      { role: "user", content: user },
    ],
    response_format: { type: "json_object" },
    temperature: 0.2,
  };

  const res = await fetch(OPENAI_API_URL, {
    method: "POST",
    headers: {
      "Content-Type": "application/json",
      Authorization: `Bearer ${apiKey}`,
    },
    body: JSON.stringify(outboundRequestPayload),
  });

  const raw = await res.text();
  if (!res.ok) {
    throw new Error(`OpenAI error ${res.status}: ${raw.slice(0, 500)}`);
  }

  let completion: Record<string, unknown>;
  try {
    completion = JSON.parse(raw) as Record<string, unknown>;
  } catch {
    throw new Error("OpenAI response was not JSON.");
  }

  const content =
    (completion as { choices?: Array<{ message?: { content?: string } }> })
      .choices?.[0]?.message?.content ?? "";

  let parsed: unknown;
  try {
    parsed = JSON.parse(content.trim());
  } catch {
    throw new Error(`OpenAI content was not valid JSON: ${content.slice(0, 240)}`);
  }

  const p = parsed as Partial<AiTicketAnalysis> & {
    confidence?: unknown;
  };
  const priority = String(p.ai_priority ?? "").toLowerCase();
  if (
    p.sentiment == null ||
    p.ai_summary == null ||
    p.department_name == null ||
    (priority !== "low" && priority !== "medium" && priority !== "high")
  ) {
    throw new Error("OpenAI JSON missing required fields or invalid ai_priority.");
  }

  let confidence_score: number | null = null;
  if (p.confidence != null) {
    const c =
      typeof p.confidence === "number"
        ? p.confidence
        : Number.parseFloat(String(p.confidence));
    if (Number.isFinite(c) && c >= 0 && c <= 1) {
      confidence_score = c;
    }
  }
  if (confidence_score === null) {
    throw new Error("OpenAI JSON must include numeric confidence between 0 and 1.");
  }

  const analysis: AiTicketAnalysis = {
    sentiment: String(p.sentiment).trim(),
    ai_priority: priority as AiTicketAnalysis["ai_priority"],
    ai_summary: String(p.ai_summary).trim(),
    department_name: String(p.department_name).trim(),
  };

  return {
    analysis,
    confidence_score,
    outboundRequestPayload,
    completionJson: completion,
  };
}

function stringifyForAiLog(payload: Record<string, unknown>): string {
  return JSON.stringify(payload);
}

async function insertAiLog(
  supabase: SupabaseClient,
  row: {
    ticket_id?: string | null;
    raw_prompt: Record<string, unknown>;
    raw_response: Record<string, unknown>;
    confidence_score: number | null;
  },
) {
  /** TEXT-safe: compact JSON strings. If columns are Postgres json/jsonb instead, Postgres still accepts properly formatted JSON text. */
  const insertRow = {
    ticket_id: row.ticket_id ?? null,
    raw_prompt: stringifyForAiLog(row.raw_prompt),
    raw_response: stringifyForAiLog(row.raw_response),
    confidence_score: row.confidence_score,
  };

  const { error } = await supabase.from("ai_logs").insert(insertRow);
  if (error) {
    console.error("[ai_logs] INSERT failed:", {
      message: error.message,
      code: error.code,
      details: error.details,
      hint: error.hint,
      ticket_id: row.ticket_id ?? null,
    });
    console.error(
      `[ai_logs] INSERT rejected: ${error.message} (code=${error.code ?? "n/a"}, ticket_id=${row.ticket_id ?? "null"}) details=${error.details ?? "n/a"} hint=${error.hint ?? "n/a"}`,
    );
  }
}

export async function POST(request: Request) {
  const limit = intakeLimiter.check(`intake:${clientIp(request.headers)}`);
  if (!limit.ok) {
    const response = noStoreJson(
      { error: "Too many ticket submissions. Try again shortly." },
      { status: 429 },
    );
    response.headers.set("Retry-After", String(limit.retryAfterSeconds));
    return response;
  }

  let supabase;
  try {
    supabase = getSupabaseServer();
  } catch (e) {
    const msg = e instanceof Error ? e.message : "Configuration error.";
    console.error("[tickets] configuration error:", msg);
    return noStoreJson({ error: "Ticket intake is not configured." }, { status: 500 });
  }

  let bodyJson: Record<string, unknown>;
  try {
    const rawBody = await readBodyLimited(request, MAX_BODY_CHARS);
    if (!rawBody.ok) {
      return noStoreJson({ error: "Request body is too large." }, { status: 413 });
    }
    const parsed: unknown = JSON.parse(rawBody.text);
    if (!parsed || typeof parsed !== "object" || Array.isArray(parsed)) {
      return noStoreJson({ error: "Invalid JSON body." }, { status: 400 });
    }
    bodyJson = parsed as Record<string, unknown>;
  } catch {
    return noStoreJson({ error: "Invalid JSON body." }, { status: 400 });
  }

  const customer_email =
    typeof bodyJson.customer_email === "string"
      ? bodyJson.customer_email.trim()
      : "";
  const subject =
    typeof bodyJson.subject === "string" ? bodyJson.subject.trim() : "";
  const message =
    typeof bodyJson.message === "string" ? bodyJson.message.trim() : "";

  if (!customer_email || !subject || !message) {
    return noStoreJson(
      {
        error:
          "Required fields: customer_email (non-empty string), subject, message.",
      },
      { status: 400 },
    );
  }

  if (
    customer_email.length > 320 ||
    subject.length > 300 ||
    message.length > 8_000
  ) {
    return noStoreJson(
      { error: "One or more fields are too long." },
      { status: 400 },
    );
  }

  const { data: departments, error: deptError } = await supabase
    .from("departments")
    .select("id, name");

  if (deptError) {
    console.error("departments lookup failed:", deptError);
    return noStoreJson(
      { error: "Could not load departments." },
      { status: 500 },
    );
  }

  const deptRows = (departments ?? []) as DepartmentRow[];
  if (!deptRows.length) {
    return noStoreJson(
      {
        error: "No departments found; populate `departments` before accepting tickets.",
      },
      { status: 422 },
    );
  }

  const nameToDept = new Map<string, DepartmentRow>(
    deptRows.map((r) => [normalizeName(r.name), r]),
  );

  const baseLogRequest = {
    customer_email,
    subject,
    message_length: message.length,
    departments: deptRows.map((d) => ({ id: d.id, name: d.name })),
  };

  let classifyResult!: Awaited<ReturnType<typeof classifyTicketWithOpenAI>>;

  try {
    classifyResult = await classifyTicketWithOpenAI({
      subject,
      message,
      departmentNames: deptRows.map((d) => d.name),
    });
  } catch (e) {
    const msg =
      e instanceof Error ? e.message : "Classifier request failed unexpectedly.";
    await insertAiLog(supabase, {
      ticket_id: null,
      raw_prompt: { ticket_context: baseLogRequest, phase: "openai" },
      raw_response: {
        error: msg,
      },
      confidence_score: null,
    });
    return noStoreJson({ error: msg }, { status: 502 });
  }

  const {
    analysis,
    confidence_score,
    outboundRequestPayload,
    completionJson,
  } = classifyResult;

  const resolved = nameToDept.get(normalizeName(analysis.department_name));
  const suggested = analysis.department_name;

  if (!resolved) {
    await insertAiLog(supabase, {
      ticket_id: null,
      raw_prompt: {
        openai_chat_request: outboundRequestPayload,
        ticket_context: baseLogRequest,
      },
      raw_response: {
        openai_completion: completionJson,
        routed_analysis: analysis,
        resolution: "department_name_not_matched",
        suggested_department_name: suggested,
      },
      confidence_score,
    });
    return noStoreJson(
      {
        error: "AI suggested a department_name that does not match any department row.",
        suggested_department_name: suggested,
        valid_names: deptRows.map((d) => d.name),
      },
      { status: 422 },
    );
  }

  const ticketInsert = {
    customer_email,
    subject,
    message,
    department_id: resolved.id,
    sentiment: analysis.sentiment,
    ai_priority: analysis.ai_priority,
    ai_summary: analysis.ai_summary,
    ai_routed: true,
  };

  const { data: inserted, error: ticketError } = await supabase
    .from("tickets")
    .insert(ticketInsert)
    .select("id")
    .single();

  if (ticketError) {
    await insertAiLog(supabase, {
      ticket_id: null,
      raw_prompt: {
        openai_chat_request: outboundRequestPayload,
        ticket_context: baseLogRequest,
      },
      raw_response: {
        openai_completion: completionJson,
        routed_analysis: analysis,
        department_id: resolved.id,
        ticket_insert_attempt: ticketInsert,
        postgres_error: {
          message: ticketError.message,
          details: ticketError.details,
        },
      },
      confidence_score,
    });
    return noStoreJson({ error: "Could not save the ticket." }, { status: 500 });
  }

  const ticketId = inserted!.id as string;

  await insertAiLog(supabase, {
    ticket_id: ticketId,
    raw_prompt: {
      openai_chat_request: outboundRequestPayload,
      ticket_context: baseLogRequest,
    },
    raw_response: {
      openai_completion: completionJson,
      routed_analysis: analysis,
      department_id: resolved.id,
      department_name: resolved.name,
    },
    confidence_score,
  });

  return noStoreJson(
    {
      ticket_id: ticketId,
      sentiment: analysis.sentiment,
      ai_priority: analysis.ai_priority,
      ai_summary: analysis.ai_summary,
      department_id: resolved.id,
      department_name: resolved.name,
    },
    { status: 201 },
  );
}
