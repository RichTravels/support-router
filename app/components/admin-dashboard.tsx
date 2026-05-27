"use client";

import { overrideTicketDepartment } from "@/app/actions/tickets";
import { useState, useTransition } from "react";

export type DepartmentOption = {
  id: string;
  name: string;
};

export type TicketRow = {
  id: string;
  customer_email: string;
  subject: string;
  ai_summary: string | null;
  sentiment: string | null;
  ai_priority: string | null;
  department_id: string | null;
  department_name?: string | null;
  ai_routed?: boolean | null;
};

export type DashboardStats = {
  totalOpenTickets: number;
  highPriorityIssues: number;
  averageAiConfidencePct: number | null;
};

type Props = {
  stats: DashboardStats;
  tickets: TicketRow[];
  departments: DepartmentOption[];
};

function priorityBadgeClasses(priority: string | null) {
  const p = (priority ?? "").toLowerCase();
  if (p === "high") {
    return "bg-red-500/15 text-red-400 ring-red-500/40";
  }
  if (p === "medium") {
    return "bg-amber-500/15 text-amber-300 ring-amber-500/40";
  }
  if (p === "low") {
    return "bg-emerald-500/15 text-emerald-400 ring-emerald-500/40";
  }
  return "bg-zinc-500/15 text-zinc-400 ring-zinc-500/35";
}

function truncateSummary(text: string | null, max = 96) {
  if (!text) return "—";
  const t = text.trim();
  if (t.length <= max) return t;
  return `${t.slice(0, max).trim()}…`;
}

export default function AdminDashboard({
  stats,
  tickets,
  departments,
}: Props) {
  const [isPending, startTransition] = useTransition();
  const [feedback, setFeedback] = useState<Record<string, string>>({});

  return (
    <div className="min-h-screen bg-zinc-950 text-zinc-100">
      {/* subtle gradient mesh */}
      <div className="pointer-events-none fixed inset-0 overflow-hidden opacity-40">
        <div className="absolute -top-48 left-1/4 h-96 w-96 rounded-full bg-violet-600/20 blur-3xl" />
        <div className="absolute top-1/3 right-0 h-80 w-80 rounded-full bg-cyan-500/15 blur-3xl" />
        <div className="absolute bottom-0 left-0 h-72 w-72 rounded-full bg-fuchsia-600/10 blur-3xl" />
      </div>

      <div className="relative mx-auto max-w-7xl px-4 pb-16 pt-10 sm:px-6 lg:px-8">
        <header className="mb-10 flex flex-col gap-4 border-b border-zinc-800/80 pb-8 sm:flex-row sm:items-end sm:justify-between">
          <div>
            <p className="text-xs font-semibold uppercase tracking-[0.2em] text-violet-400/90">
              Support Router
            </p>
            <h1 className="mt-1 text-3xl font-semibold tracking-tight text-white sm:text-4xl">
              Operations dashboard
            </h1>
            <p className="mt-2 max-w-xl text-sm leading-relaxed text-zinc-400">
              Monitor ticket volume, triage urgency, AI confidence signals, and
              override routing when specialists need to own a thread manually.
            </p>
          </div>
          <div className="flex items-center gap-2 rounded-xl border border-zinc-700/70 bg-zinc-900/50 px-4 py-2 text-xs text-zinc-400">
            <span className="h-2 w-2 animate-pulse rounded-full bg-emerald-400 shadow-[0_0_12px_rgba(52,211,153,0.7)]" />
            Live workspace
          </div>
        </header>

        {/* Stats */}
        <section className="mb-12 grid gap-4 sm:grid-cols-2 lg:grid-cols-3">
          <MetricCard
            label="Total open tickets"
            value={stats.totalOpenTickets}
            subtitle="Open, new, or unset status rows"
            accent="border-violet-500/35 bg-gradient-to-br from-violet-500/10 to-transparent"
          />
          <MetricCard
            label="High priority issues"
            value={stats.highPriorityIssues}
            subtitle="Open-queue items flagged high by AI routing"
            accent="border-amber-500/35 bg-gradient-to-br from-amber-500/10 to-transparent"
          />
          <MetricCard
            label="Avg. AI confidence"
            value={
              stats.averageAiConfidencePct === null
                ? "—"
                : `${stats.averageAiConfidencePct}%`
            }
            subtitle="Mean from logged ai_logs.confidence_score"
            accent="border-cyan-500/35 bg-gradient-to-br from-cyan-500/10 to-transparent"
            className="sm:col-span-2 lg:col-span-1"
          />
        </section>

        {/* Table */}
        <section className="overflow-hidden rounded-2xl border border-zinc-800/90 bg-zinc-900/40 shadow-2xl shadow-black/40 ring-1 ring-white/5 backdrop-blur">
          <div className="flex items-center justify-between border-b border-zinc-800/80 px-5 py-4 sm:px-6">
            <div>
              <h2 className="text-lg font-medium text-white">Ticket queue</h2>
              <p className="text-xs text-zinc-500">
                {tickets.length} record{tickets.length === 1 ? "" : "s"} loaded
              </p>
            </div>
          </div>

          <div className="overflow-x-auto">
            <table className="min-w-full text-left text-sm">
              <thead>
                <tr className="border-b border-zinc-800 bg-zinc-950/70 text-[11px] font-semibold uppercase tracking-wider text-zinc-500">
                  <th className="px-5 py-3 sm:px-6">Customer</th>
                  <th className="px-5 py-3 sm:px-6">Subject</th>
                  <th className="px-5 py-3 sm:px-6">AI summary</th>
                  <th className="px-5 py-3 sm:px-6">Sentiment</th>
                  <th className="px-5 py-3 sm:px-6">Priority</th>
                  <th className="px-5 py-3 sm:px-6">Department</th>
                  <th className="min-w-[200px] px-5 py-3 sm:px-6">
                    Routing override
                  </th>
                </tr>
              </thead>
              <tbody className="divide-y divide-zinc-800/80">
                {tickets.length === 0 ? (
                  <tr>
                    <td
                      className="px-6 py-12 text-center text-zinc-500"
                      colSpan={7}
                    >
                      No tickets yet. Incoming requests will populate this view
                      automatically.
                    </td>
                  </tr>
                ) : (
                  tickets.map((t) => (
                    <tr
                      key={t.id}
                      className="bg-zinc-900/25 transition-colors hover:bg-zinc-800/30"
                    >
                      <td className="whitespace-nowrap px-5 py-3.5 align-middle font-mono text-xs text-zinc-300 sm:px-6">
                        {t.customer_email}
                      </td>
                      <td className="max-w-[200px] px-5 py-3.5 align-middle text-zinc-200 sm:max-w-xs sm:px-6">
                        <span className="line-clamp-2">{t.subject}</span>
                      </td>
                      <td className="max-w-[220px] px-5 py-3.5 align-middle text-xs leading-relaxed text-zinc-400 sm:max-w-sm sm:px-6">
                        {truncateSummary(t.ai_summary)}
                      </td>
                      <td className="whitespace-nowrap px-5 py-3.5 align-middle text-xs capitalize text-zinc-400 sm:px-6">
                        {t.sentiment ?? "—"}
                      </td>
                      <td className="whitespace-nowrap px-5 py-3.5 align-middle sm:px-6">
                        <span
                          className={`inline-flex items-center rounded-full px-2.5 py-0.5 text-[11px] font-semibold uppercase tracking-wide ring-1 ring-inset ${priorityBadgeClasses(t.ai_priority)}`}
                        >
                          {(t.ai_priority ?? "?").toString()}
                        </span>
                      </td>
                      <td className="max-w-[160px] px-5 py-3.5 align-middle text-xs text-zinc-300 sm:px-6">
                        <span className="line-clamp-2">
                          {t.department_name ??
                            departments.find((d) => d.id === t.department_id)
                              ?.name ??
                            "—"}
                        </span>
                        {typeof t.ai_routed === "boolean" && (
                          <p className="mt-1 text-[10px] uppercase tracking-wide text-zinc-600">
                            {t.ai_routed ? "AI routed" : "Manual override"}
                          </p>
                        )}
                      </td>
                      <td className="whitespace-nowrap px-5 py-3.5 align-middle sm:px-6">
                        <div className="flex flex-col gap-1">
                          <label className="sr-only" htmlFor={`dept-${t.id}`}>
                            Department for ticket {t.id}
                          </label>
                          <select
                            key={`dept-${t.id}-${t.department_id ?? "none"}`}
                            disabled={isPending || departments.length === 0}
                            id={`dept-${t.id}`}
                            className="w-full cursor-pointer rounded-lg border border-zinc-700 bg-zinc-950 px-3 py-2 text-xs text-zinc-100 outline-none ring-violet-500/50 transition focus:border-violet-500 focus:ring-2 disabled:cursor-not-allowed disabled:opacity-50"
                            defaultValue={t.department_id ?? ""}
                            onChange={(e) => {
                              const el = e.currentTarget;
                              const prev = t.department_id ?? "";
                              const next = el.value;
                              if (!next || next === prev) return;

                              setFeedback((f) => {
                                const cleared = { ...f };
                                delete cleared[t.id];
                                return cleared;
                              });

                              startTransition(async () => {
                                const res =
                                  await overrideTicketDepartment(t.id, next);
                                if (!res.ok) {
                                  el.value = prev;
                                  setFeedback((f) => ({
                                    ...f,
                                    [t.id]: res.error,
                                  }));
                                  return;
                                }

                                setFeedback((f) => ({
                                  ...f,
                                  [t.id]: "Saved.",
                                }));

                                window.setTimeout(() => {
                                  setFeedback((f) => {
                                    const cleared = { ...f };
                                    delete cleared[t.id];
                                    return cleared;
                                  });
                                }, 2000);
                              });
                            }}
                          >
                            <option value="" disabled>
                              Select department
                            </option>
                            {departments.map((d) => (
                              <option key={d.id} value={d.id}>
                                {d.name}
                              </option>
                            ))}
                          </select>
                          {feedback[t.id] ? (
                            <span
                              className={
                                feedback[t.id] === "Saved."
                                  ? "text-[11px] text-emerald-400"
                                  : "text-[11px] text-red-400"
                              }
                            >
                              {feedback[t.id]}
                            </span>
                          ) : null}
                        </div>
                      </td>
                    </tr>
                  ))
                )}
              </tbody>
            </table>
          </div>
        </section>
      </div>
    </div>
  );
}

function MetricCard({
  label,
  value,
  subtitle,
  accent,
  className = "",
}: {
  label: string;
  value: string | number;
  subtitle: string;
  accent: string;
  className?: string;
}) {
  return (
    <article
      className={`rounded-2xl border border-zinc-800/90 bg-zinc-900/40 p-5 shadow-lg shadow-black/30 ring-1 ring-white/5 ${accent} ${className}`}
    >
      <p className="text-[11px] font-semibold uppercase tracking-wider text-zinc-500">
        {label}
      </p>
      <p className="mt-3 font-mono text-3xl font-semibold tabular-nums tracking-tight text-white">
        {value}
      </p>
      <p className="mt-2 text-xs leading-snug text-zinc-500">{subtitle}</p>
    </article>
  );
}
