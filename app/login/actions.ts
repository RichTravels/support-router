"use server";

import { headers } from "next/headers";
import { redirect } from "next/navigation";

import { isOperatorEmail } from "@/utils/auth-allowlist";
import { clientIp, createRateLimiter } from "@/utils/rate-limit";
import { createClient } from "@/utils/supabase/server";

const signInLimiter = createRateLimiter({
  limit: 8,
  windowMs: 15 * 60 * 1000,
});

export async function signIn(formData: FormData) {
  const headerList = await headers();
  const limit = signInLimiter.check(`login:${clientIp(headerList)}`);
  if (!limit.ok) {
    redirect("/login?error=rate");
  }

  const email = String(formData.get("email") ?? "").trim();
  const password = String(formData.get("password") ?? "");
  if (!email || !password) {
    redirect("/login?error=invalid");
  }

  let supabase;
  try {
    supabase = await createClient();
  } catch (error) {
    console.error(
      "[auth] sign-in client failed:",
      error instanceof Error ? error.message : "unknown error",
    );
    redirect("/login?error=config");
  }

  const { error } = await supabase.auth.signInWithPassword({ email, password });
  if (error) {
    redirect("/login?error=invalid");
  }

  const { data, error: claimsError } = await supabase.auth.getClaims();
  if (
    claimsError ||
    !isOperatorEmail(data?.claims?.email, process.env.OPERATOR_EMAILS)
  ) {
    await supabase.auth.signOut();
    redirect("/login?error=unauthorized");
  }

  redirect("/");
}

export async function signOut() {
  try {
    const supabase = await createClient();
    await supabase.auth.signOut();
  } catch (error) {
    console.error(
      "[auth] sign-out failed:",
      error instanceof Error ? error.message : "unknown error",
    );
  }
  redirect("/login");
}
