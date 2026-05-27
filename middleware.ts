import type { NextRequest } from "next/server";
import { NextResponse } from "next/server";
import { updateSession } from "@/utils/supabase/middleware";

export async function middleware(request: NextRequest) {
  // Public homepage loads DB via service role / publishable server fetch only — skip
  // Supabase cookie refresh on "/" to avoid Edge auth/session errors for anonymous visitors.
  if (request.nextUrl.pathname === "/") {
    return NextResponse.next();
  }

  try {
    return await updateSession(request);
  } catch (e) {
    console.error("[middleware] MIDDLEWARE fallback — Supabase session step failed:", e);
    return NextResponse.next({
      request: {
        headers: request.headers,
      },
    });
  }
}

export const config = {
  matcher: [
    "/((?!_next/static|_next/image|favicon.ico|.*\\.(?:svg|png|jpg|jpeg|gif|webp)$).*)",
  ],
};
