"use client";

import { useRouter } from "next/navigation";
import { useCallback, useEffect, useId, useRef, useState } from "react";

export function SimulateCustomerTicketTrigger() {
  const router = useRouter();
  const dialogTitleId = useId();
  const panelRef = useRef<HTMLDivElement>(null);

  const [open, setOpen] = useState(false);
  const [email, setEmail] = useState("");
  const [subject, setSubject] = useState("");
  const [message, setMessage] = useState("");
  const [submitting, setSubmitting] = useState(false);
  const [formError, setFormError] = useState<string | null>(null);

  const close = useCallback(() => {
    if (submitting) return;
    setOpen(false);
    setFormError(null);
  }, [submitting]);

  useEffect(() => {
    if (!open) return;
    const onKey = (e: KeyboardEvent) => {
      if (e.key === "Escape") close();
    };
    document.addEventListener("keydown", onKey);
    const prev = document.body.style.overflow;
    document.body.style.overflow = "hidden";
    return () => {
      document.removeEventListener("keydown", onKey);
      document.body.style.overflow = prev;
    };
  }, [open, close]);

  useEffect(() => {
    if (!open) return;
    const t = window.setTimeout(() => {
      panelRef.current?.querySelector<HTMLInputElement>("input[type=email]")?.focus();
    }, 0);
    return () => window.clearTimeout(t);
  }, [open]);

  async function handleSubmit(e: React.FormEvent) {
    e.preventDefault();
    setFormError(null);
    const trimmedEmail = email.trim();
    const trimmedSubject = subject.trim();
    const trimmedMessage = message.trim();
    if (!trimmedEmail || !trimmedSubject || !trimmedMessage) {
      setFormError("All fields are required.");
      return;
    }

    setSubmitting(true);
    try {
      const res = await fetch("/api/tickets", {
        method: "POST",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify({
          customer_email: trimmedEmail,
          subject: trimmedSubject,
          message: trimmedMessage,
        }),
      });

      const data = await res.json().catch(() => ({}));

      if (!res.ok) {
        const msg =
          typeof data?.error === "string"
            ? data.error
            : `Request failed (${res.status})`;
        setFormError(msg);
        return;
      }

      setEmail("");
      setSubject("");
      setMessage("");
      setOpen(false);
      router.refresh();
    } catch {
      setFormError("Network error — try again.");
    } finally {
      setSubmitting(false);
    }
  }

  return (
    <>
      <button
        type="button"
        className="rounded-xl border border-violet-500/50 bg-violet-600 px-4 py-2.5 text-sm font-medium text-white shadow-lg shadow-violet-950/40 transition hover:bg-violet-500 focus-visible:outline-none focus-visible:ring-2 focus-visible:ring-violet-400 focus-visible:ring-offset-2 focus-visible:ring-offset-zinc-950"
        onClick={() => {
          setFormError(null);
          setOpen(true);
        }}
      >
        Simulate Customer Ticket
      </button>

      {open ? (
        <div
          aria-labelledby={dialogTitleId}
          aria-modal="true"
          className="fixed inset-0 z-50 flex items-center justify-center p-4 sm:p-6"
          role="dialog"
        >
          <button
            aria-label="Close dialog"
            className="absolute inset-0 bg-black/70 backdrop-blur-sm transition-opacity"
            type="button"
            onClick={close}
          />

          <div
            ref={panelRef}
            className="relative z-10 w-full max-w-lg rounded-2xl border border-zinc-700 bg-zinc-900 p-6 shadow-2xl ring-1 ring-white/10"
          >
            <div className="mb-6 flex items-start justify-between gap-4">
              <div>
                <h2
                  id={dialogTitleId}
                  className="text-lg font-semibold text-white"
                >
                  Simulate Customer Ticket
                </h2>
                <p className="mt-1 text-sm text-zinc-400">
                  Submits through your AI routing API at{" "}
                  <code className="rounded bg-zinc-800 px-1 py-0.5 text-xs text-violet-300">
                    /api/tickets
                  </code>
                  .
                </p>
              </div>
              <button
                disabled={submitting}
                type="button"
                className="rounded-lg p-1.5 text-zinc-500 transition hover:bg-zinc-800 hover:text-zinc-200 disabled:opacity-40"
                onClick={close}
              >
                <span className="sr-only">Close</span>
                <svg
                  aria-hidden
                  className="h-5 w-5"
                  fill="none"
                  stroke="currentColor"
                  viewBox="0 0 24 24"
                >
                  <path
                    strokeLinecap="round"
                    strokeLinejoin="round"
                    strokeWidth={2}
                    d="M6 18L18 6M6 6l12 12"
                  />
                </svg>
              </button>
            </div>

            <form className="space-y-4" onSubmit={handleSubmit}>
              <div>
                <label
                  className="mb-1.5 block text-xs font-medium uppercase tracking-wide text-zinc-400"
                  htmlFor="simulate-email"
                >
                  Customer email
                </label>
                <input
                  autoComplete="email"
                  className="w-full rounded-lg border border-zinc-700 bg-zinc-950 px-3 py-2.5 text-sm text-zinc-100 placeholder:text-zinc-600 focus:border-violet-500 focus:outline-none focus:ring-2 focus:ring-violet-500/30"
                  disabled={submitting}
                  id="simulate-email"
                  onChange={(e) => setEmail(e.target.value)}
                  placeholder="customer@company.com"
                  type="email"
                  value={email}
                />
              </div>

              <div>
                <label
                  className="mb-1.5 block text-xs font-medium uppercase tracking-wide text-zinc-400"
                  htmlFor="simulate-subject"
                >
                  Subject
                </label>
                <input
                  className="w-full rounded-lg border border-zinc-700 bg-zinc-950 px-3 py-2.5 text-sm text-zinc-100 placeholder:text-zinc-600 focus:border-violet-500 focus:outline-none focus:ring-2 focus:ring-violet-500/30"
                  disabled={submitting}
                  id="simulate-subject"
                  onChange={(e) => setSubject(e.target.value)}
                  placeholder="Brief issue title"
                  type="text"
                  value={subject}
                />
              </div>

              <div>
                <label
                  className="mb-1.5 block text-xs font-medium uppercase tracking-wide text-zinc-400"
                  htmlFor="simulate-message"
                >
                  Message
                </label>
                <textarea
                  className="min-h-[120px] w-full resize-y rounded-lg border border-zinc-700 bg-zinc-950 px-3 py-2.5 text-sm text-zinc-100 placeholder:text-zinc-600 focus:border-violet-500 focus:outline-none focus:ring-2 focus:ring-violet-500/30"
                  disabled={submitting}
                  id="simulate-message"
                  onChange={(e) => setMessage(e.target.value)}
                  placeholder="Describe what the customer needs help with..."
                  rows={5}
                  value={message}
                />
              </div>

              {formError ? (
                <p className="rounded-lg border border-red-500/30 bg-red-950/40 px-3 py-2 text-sm text-red-300">
                  {formError}
                </p>
              ) : null}

              <div className="flex flex-wrap items-center justify-end gap-3 pt-2">
                <button
                  disabled={submitting}
                  type="button"
                  className="rounded-lg px-4 py-2 text-sm font-medium text-zinc-400 transition hover:bg-zinc-800 hover:text-zinc-200 disabled:opacity-40"
                  onClick={close}
                >
                  Cancel
                </button>
                <button
                  disabled={submitting}
                  type="submit"
                  className="inline-flex items-center gap-2 rounded-lg bg-violet-600 px-5 py-2.5 text-sm font-medium text-white shadow-lg shadow-violet-950/30 transition hover:bg-violet-500 disabled:opacity-70"
                >
                  {submitting ? (
                    <>
                      <Spinner />
                      Routing with AI…
                    </>
                  ) : (
                    "Submit ticket"
                  )}
                </button>
              </div>
            </form>
          </div>
        </div>
      ) : null}
    </>
  );
}

function Spinner() {
  return (
    <svg
      aria-hidden
      className="h-4 w-4 animate-spin text-white"
      fill="none"
      viewBox="0 0 24 24"
      xmlns="http://www.w3.org/2000/svg"
    >
      <circle
        className="opacity-25"
        cx="12"
        cy="12"
        r="10"
        stroke="currentColor"
        strokeWidth="4"
      />
      <path
        className="opacity-75"
        d="M4 12a8 8 0 018-8V0C5.373 0 0 5.373 0 12h4zm2 5.291A7.962 7.962 0 014 12H0c0 3.042 1.135 5.824 3 7.938l3-2.647z"
        fill="currentColor"
      />
    </svg>
  );
}
