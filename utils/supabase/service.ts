import { createClient } from "@supabase/supabase-js";

/**
 * Server-only Supabase client using the service role when set (bypasses RLS).
 * Fallback: publishable key (requires permissive policies for dashboard reads/writes).
 */
export function createServiceClient() {
  const url = process.env.NEXT_PUBLIC_SUPABASE_URL?.trim();
  const key =
    process.env.SUPABASE_SERVICE_ROLE_KEY?.trim() ??
    process.env.NEXT_PUBLIC_SUPABASE_PUBLISHABLE_KEY?.trim();

  if (!url || !key) {
    throw new Error(
      "Missing Supabase URL or key — set NEXT_PUBLIC_SUPABASE_URL and SUPABASE_SERVICE_ROLE_KEY (recommended) or NEXT_PUBLIC_SUPABASE_PUBLISHABLE_KEY.",
    );
  }

  return createClient(url, key, {
    auth: { autoRefreshToken: false, persistSession: false },
  });
}
