import AdminDashboard from "@/app/components/admin-dashboard";
import { createServiceClient } from "@/utils/supabase/service";

/** Always fetch fresh counts and queues (never bake a stale snapshot at build time). */
export const dynamic = "force-dynamic";

async function fetchDashboardData() {
  const supabase = createServiceClient();

  const departmentsRes = await supabase
    .from("departments")
    .select("id, name")
    .order("name");

  if (departmentsRes.error) {
    throw new Error(departmentsRes.error.message);
  }

  const OPEN_STATUS_FILTER =
    "status.eq.open,status.eq.new,status.eq.pending,status.is.null";

  const openCountBase = await supabase
    .from("tickets")
    .select("id", { count: "exact", head: true })
    .or(OPEN_STATUS_FILTER);

  let totalOpenTickets = openCountBase.count ?? 0;
  if (openCountBase.error) {
    const fallback = await supabase
      .from("tickets")
      .select("id", { count: "exact", head: true });
    totalOpenTickets = fallback.count ?? 0;
  }

  const highPriorityOpen = await supabase
    .from("tickets")
    .select("id", { count: "exact", head: true })
    .eq("ai_priority", "high")
    .or(OPEN_STATUS_FILTER);

  let highPriorityIssues = highPriorityOpen.count ?? 0;
  if (highPriorityOpen.error) {
    const fb = await supabase
      .from("tickets")
      .select("id", { count: "exact", head: true })
      .eq("ai_priority", "high");
    highPriorityIssues = fb.count ?? 0;
  }

  const logsRes = await supabase
    .from("ai_logs")
    .select("confidence_score")
    .not("confidence_score", "is", null);

  let averageAiConfidencePct: number | null = null;
  if (!logsRes.error && logsRes.data?.length) {
    const nums = logsRes.data
      .map((row) =>
        typeof row.confidence_score === "number"
          ? row.confidence_score
          : Number.parseFloat(String(row.confidence_score ?? "")),
      )
      .filter((n) => Number.isFinite(n));
    if (nums.length > 0) {
      const mean = nums.reduce((a, b) => a + b, 0) / nums.length;
      averageAiConfidencePct =
        Math.round(mean * 1000) / 10;
    }
  }

  const ticketSelect = `
      id,
      customer_email,
      subject,
      ai_summary,
      sentiment,
      ai_priority,
      department_id,
      ai_routed
    `;

  let ticketsRes = await supabase
    .from("tickets")
    .select(ticketSelect)
    .order("created_at", { ascending: false });

  if (ticketsRes.error) {
    ticketsRes = await supabase
      .from("tickets")
      .select(ticketSelect)
      .order("id", { ascending: false });
  }

  if (ticketsRes.error) {
    throw new Error(ticketsRes.error.message);
  }

  const deptMap = new Map(
    (departmentsRes.data ?? []).map((d) => [d.id as string, d.name as string]),
  );

  const tickets = (ticketsRes.data ?? []).map((row) => {
    const r = row as Record<string, unknown>;
    const id = String(r.id);
    const deptId = r.department_id != null ? String(r.department_id) : null;
    return {
      id,
      customer_email: String(r.customer_email ?? ""),
      subject: String(r.subject ?? ""),
      ai_summary:
        typeof r.ai_summary === "string" ? r.ai_summary : r.ai_summary == null
          ? null
          : String(r.ai_summary),
      sentiment:
        typeof r.sentiment === "string" ? r.sentiment : r.sentiment == null
          ? null
          : String(r.sentiment),
      ai_priority:
        typeof r.ai_priority === "string" ? r.ai_priority : r.ai_priority ==
            null
          ? null
          : String(r.ai_priority),
      department_id: deptId,
      ai_routed:
        typeof r.ai_routed === "boolean" ? r.ai_routed : null,
      department_name: deptId ? deptMap.get(deptId) ?? null : null,
    };
  });

  return {
    departments: departmentsRes.data ?? [],
    tickets,
    stats: {
      totalOpenTickets,
      highPriorityIssues,
      averageAiConfidencePct,
    },
  };
}

export default async function Home() {
  let payload: Awaited<ReturnType<typeof fetchDashboardData>>;
  try {
    payload = await fetchDashboardData();
  } catch (e) {
    const msg = e instanceof Error ? e.message : "Failed to load dashboard.";
    return (
      <div className="min-h-screen bg-zinc-950 px-6 py-16 text-zinc-100">
        <div className="mx-auto max-w-lg rounded-xl border border-red-500/35 bg-red-950/40 p-6 text-sm text-red-200">
          <p className="font-semibold text-red-100">Dashboard unavailable</p>
          <p className="mt-2 text-red-200/90">{msg}</p>
          <p className="mt-4 text-xs text-red-300/70">
            Ensure SUPABASE_SERVICE_ROLE_KEY is set for server-side reads, and that
            `tickets` includes optional columns: `created_at`, `status`, `ai_routed`.
          </p>
        </div>
      </div>
    );
  }

  return (
    <AdminDashboard
      departments={payload.departments}
      stats={payload.stats}
      tickets={payload.tickets}
    />
  );
}
