import { signIn } from "@/app/login/actions";
import { getOperator } from "@/utils/auth";
import { redirect } from "next/navigation";

export const dynamic = "force-dynamic";

const ERRORS: Record<string, string> = {
  invalid: "Email or password is incorrect.",
  unauthorized: "This account is not authorized to use Support Router.",
  rate: "Too many sign-in attempts. Wait a few minutes and try again.",
  config: "Sign-in is not configured on this server.",
};

export default async function LoginPage({
  searchParams,
}: {
  searchParams: Promise<{ error?: string | string[] }>;
}) {
  const operator = await getOperator();
  if (operator) {
    redirect("/");
  }

  const params = await searchParams;
  const errorKey = Array.isArray(params.error) ? params.error[0] : params.error;
  const errorMessage = errorKey ? ERRORS[errorKey] : null;

  const configured = Boolean(
    process.env.NEXT_PUBLIC_SUPABASE_URL?.trim() &&
      process.env.NEXT_PUBLIC_SUPABASE_PUBLISHABLE_KEY?.trim() &&
      process.env.OPERATOR_EMAILS?.trim(),
  );

  return (
    <div className="relative min-h-screen bg-zinc-950 text-zinc-100">
      <div className="pointer-events-none fixed inset-0 overflow-hidden opacity-40">
        <div className="absolute -top-48 left-1/4 h-96 w-96 rounded-full bg-violet-600/20 blur-3xl" />
        <div className="absolute top-1/3 right-0 h-80 w-80 rounded-full bg-cyan-500/15 blur-3xl" />
      </div>

      <main className="relative mx-auto flex min-h-screen w-full max-w-md flex-col justify-center px-4 py-16">
        <p className="text-xs font-semibold uppercase tracking-[0.2em] text-violet-400/90">
          Support Router
        </p>
        <h1 className="mt-2 text-3xl font-semibold tracking-tight text-white">
          Operator sign in
        </h1>
        <p className="mt-2 text-sm leading-relaxed text-zinc-400">
          Ticket review and department changes are limited to signed-in
          operators. Customer ticket submission does not use this page.
        </p>

        {!configured ? (
          <p className="mt-6 rounded-lg border border-amber-500/30 bg-amber-950/40 px-3 py-2 text-sm text-amber-200">
            Operator sign-in is not configured on this server yet.
          </p>
        ) : null}

        <form action={signIn} className="mt-8 space-y-4">
          <div>
            <label
              className="mb-1.5 block text-xs font-medium uppercase tracking-wide text-zinc-400"
              htmlFor="email"
            >
              Email
            </label>
            <input
              autoComplete="username"
              className="w-full rounded-lg border border-zinc-700 bg-zinc-950 px-3 py-2.5 text-sm text-zinc-100 placeholder:text-zinc-600 focus:border-violet-500 focus:outline-none focus:ring-2 focus:ring-violet-500/30"
              id="email"
              name="email"
              required
              type="email"
            />
          </div>
          <div>
            <label
              className="mb-1.5 block text-xs font-medium uppercase tracking-wide text-zinc-400"
              htmlFor="password"
            >
              Password
            </label>
            <input
              autoComplete="current-password"
              className="w-full rounded-lg border border-zinc-700 bg-zinc-950 px-3 py-2.5 text-sm text-zinc-100 placeholder:text-zinc-600 focus:border-violet-500 focus:outline-none focus:ring-2 focus:ring-violet-500/30"
              id="password"
              name="password"
              required
              type="password"
            />
          </div>

          {errorMessage ? (
            <p
              className="rounded-lg border border-red-500/30 bg-red-950/40 px-3 py-2 text-sm text-red-300"
              role="alert"
            >
              {errorMessage}
            </p>
          ) : null}

          <button
            className="w-full rounded-lg bg-violet-600 px-5 py-2.5 text-sm font-medium text-white shadow-lg shadow-violet-950/30 transition hover:bg-violet-500 focus-visible:outline-none focus-visible:ring-2 focus-visible:ring-violet-400"
            type="submit"
          >
            Sign in
          </button>
        </form>
      </main>
    </div>
  );
}
