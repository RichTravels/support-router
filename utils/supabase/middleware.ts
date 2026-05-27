import { createServerClient } from "@supabase/ssr";
import { type NextRequest, NextResponse } from "next/server";

const supabaseUrl = process.env.NEXT_PUBLIC_SUPABASE_URL;
const supabaseKey = process.env.NEXT_PUBLIC_SUPABASE_PUBLISHABLE_KEY;

/**
 * Runs in root `middleware.ts` to refresh Auth cookies and attach cache-control
 * headers when session cookies are rotated. See `@supabase/ssr` docs.
 */
export async function updateSession(request: NextRequest) {
  let supabaseResponse = NextResponse.next({
    request,
  });

  const url = supabaseUrl?.trim();
  const key = supabaseKey?.trim();
  if (!url || !key) {
    console.error(
      "[middleware] Missing NEXT_PUBLIC_SUPABASE_URL or NEXT_PUBLIC_SUPABASE_PUBLISHABLE_KEY; skipping Supabase SSR client.",
    );
    return NextResponse.next({ request });
  }

  let supabase;
  try {
    supabase = createServerClient(url, key, {
    cookies: {
      getAll() {
        return request.cookies.getAll();
      },
      setAll(cookiesToSet, headers) {
        cookiesToSet.forEach(({ name, value }) =>
          request.cookies.set(name, value),
        );
        supabaseResponse = NextResponse.next({
          request,
        });
        cookiesToSet.forEach(({ name, value, options }) =>
          supabaseResponse.cookies.set(name, value, options),
        );
        Object.entries(headers).forEach(([key, value]) =>
          supabaseResponse.headers.set(key, value),
        );
      },
    },
  });
  } catch (e) {
    console.error("[middleware] createServerClient failed:", e);
    return NextResponse.next({ request });
  }

  try {
    await supabase.auth.getUser();
  } catch (e) {
    console.error("[middleware] supabase.auth.getUser failed:", e);
    return NextResponse.next({ request });
  }

  return supabaseResponse;
}
