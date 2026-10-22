import "server-only";

import { cache } from "react";

import { isOperatorEmail } from "@/utils/auth-allowlist";
import { createClient } from "@/utils/supabase/server";

export type Operator = {
  id: string;
  email: string;
};

/**
 * Verifies the session JWT (getClaims) and checks the email allowlist.
 * Returns null when the caller is signed out or signed in but not an operator.
 */
export const getOperator = cache(async (): Promise<Operator | null> => {
  try {
    const supabase = await createClient();
    const { data, error } = await supabase.auth.getClaims();
    if (error || !data?.claims) return null;

    const email = data.claims.email?.trim().toLowerCase();
    if (!email || !isOperatorEmail(email, process.env.OPERATOR_EMAILS)) {
      return null;
    }

    return {
      id: data.claims.sub,
      email,
    };
  } catch (error) {
    console.error(
      "[auth] operator lookup failed:",
      error instanceof Error ? error.message : "unknown error",
    );
    return null;
  }
});
