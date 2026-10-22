/**
 * Operator authorization is an allowlist of email addresses from the
 * server-only OPERATOR_EMAILS variable.
 *
 * Compare it to the `email` claim on a verified Supabase access token.
 * Do not authorize from `user_metadata`: that object is editable by the user.
 * Callers pass the allowlist in. This module does not read the environment,
 * so it is safe to unit test and cannot leak OPERATOR_EMAILS into client code.
 */

const EMAIL = /^[^\s@]+@[^\s@]+\.[^\s@]+$/;

export function operatorEmailsFromEnv(raw: string | undefined): Set<string> {
  const emails = new Set<string>();
  for (const part of (raw ?? "").split(/[,;\n\r]+/)) {
    const email = part.trim().toLowerCase();
    if (!EMAIL.test(email)) continue;
    emails.add(email);
  }
  return emails;
}

export function isOperatorEmail(
  email: string | null | undefined,
  allowlistRaw: string | undefined,
): boolean {
  if (!email) return false;
  const normalized = email.trim().toLowerCase();
  if (!EMAIL.test(normalized)) return false;
  return operatorEmailsFromEnv(allowlistRaw).has(normalized);
}
