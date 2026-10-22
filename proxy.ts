import { createServerClient } from "@supabase/ssr";
import { NextResponse, type NextRequest } from "next/server";

import { accessDecision } from "@/utils/access";
import { isOperatorEmail } from "@/utils/auth-allowlist";

export async function proxy(request: NextRequest) {
  let supabaseResponse = NextResponse.next({ request });

  const url = process.env.NEXT_PUBLIC_SUPABASE_URL?.trim();
  const key = process.env.NEXT_PUBLIC_SUPABASE_PUBLISHABLE_KEY?.trim();
  let isOperator = false;

  if (url && key) {
    const supabase = createServerClient(url, key, {
      cookies: {
        getAll() {
          return request.cookies.getAll();
        },
        setAll(cookiesToSet, headers) {
          cookiesToSet.forEach(({ name, value }) => {
            request.cookies.set(name, value);
          });
          supabaseResponse = NextResponse.next({ request });
          cookiesToSet.forEach(({ name, value, options }) => {
            supabaseResponse.cookies.set(name, value, options);
          });
          Object.entries(headers).forEach(([header, value]) => {
            supabaseResponse.headers.set(header, value);
          });
        },
      },
    });

    try {
      const { data } = await supabase.auth.getClaims();
      isOperator = isOperatorEmail(
        data?.claims?.email,
        process.env.OPERATOR_EMAILS,
      );
    } catch {
      isOperator = false;
    }
  }

  const decision = accessDecision({
    pathname: request.nextUrl.pathname,
    method: request.method,
    isOperator,
  });

  if (decision === "allow") {
    if (!supabaseResponse.headers.has("cache-control")) {
      supabaseResponse.headers.set("Cache-Control", "private, no-store");
    }
    return supabaseResponse;
  }

  if (decision === "redirect-login") {
    const redirectUrl = request.nextUrl.clone();
    redirectUrl.pathname = "/login";
    redirectUrl.search = "";
    return withSession(
      NextResponse.redirect(redirectUrl),
      supabaseResponse,
    );
  }

  return withSession(
    NextResponse.json({ error: "Unauthorized" }, { status: 401 }),
    supabaseResponse,
  );
}

function withSession(response: NextResponse, session: NextResponse) {
  session.cookies.getAll().forEach((cookie) => {
    response.cookies.set(cookie);
  });
  for (const header of ["cache-control", "expires", "pragma"]) {
    const value = session.headers.get(header);
    if (value) response.headers.set(header, value);
  }
  if (!response.headers.has("cache-control")) {
    response.headers.set("Cache-Control", "private, no-store");
  }
  return response;
}

export const config = {
  matcher: [
    "/((?!_next/static|_next/image|favicon.ico|.*\\.(?:svg|png|jpg|jpeg|gif|webp)$).*)",
  ],
};
