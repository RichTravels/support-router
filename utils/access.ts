export type AccessDecision = "allow" | "redirect-login" | "json-unauthorized";

function normalizePath(pathname: string): string {
  if (pathname.length > 1 && pathname.endsWith("/")) {
    return pathname.slice(0, -1);
  }
  return pathname;
}

/**
 * Who may pass the proxy.
 *
 * POST /api/tickets stays public (customer intake). Every other read or
 * change requires an operator session. /login stays reachable so operators
 * can sign in; the login page sends an already-authorized operator home.
 */
export function accessDecision(input: {
  pathname: string;
  method: string;
  isOperator: boolean;
}): AccessDecision {
  const pathname = normalizePath(input.pathname);
  const method = input.method.toUpperCase();

  if (method === "POST" && pathname === "/api/tickets") {
    return "allow";
  }

  if (pathname === "/login") {
    return "allow";
  }

  if (input.isOperator) {
    return "allow";
  }

  if (pathname.startsWith("/api/") || (method !== "GET" && method !== "HEAD")) {
    return "json-unauthorized";
  }

  return "redirect-login";
}
