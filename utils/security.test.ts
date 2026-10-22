import assert from "node:assert/strict";
import { readFileSync } from "node:fs";
import test from "node:test";

import { accessDecision } from "./access.ts";
import { isOperatorEmail, operatorEmailsFromEnv } from "./auth-allowlist.ts";
import { clientIp, createRateLimiter, positiveInt } from "./rate-limit.ts";

test("operator allowlist matches email case-insensitively and ignores blanks", () => {
  const raw = " Ops@Example.com, not-an-email, ,second@example.com ";
  assert.deepEqual(
    [...operatorEmailsFromEnv(raw)],
    ["ops@example.com", "second@example.com"],
  );
  assert.equal(isOperatorEmail("OPS@example.com", raw), true);
  assert.equal(isOperatorEmail("stranger@example.com", raw), false);
  assert.equal(isOperatorEmail("", raw), false);
  assert.equal(isOperatorEmail("ops@example.com", ""), false);
  assert.equal(isOperatorEmail("ops@example.com", undefined), false);
});

test("access gate keeps ticket intake public and locks everything else", () => {
  assert.equal(
    accessDecision({
      pathname: "/api/tickets",
      method: "POST",
      isOperator: false,
    }),
    "allow",
  );
  assert.equal(
    accessDecision({
      pathname: "/api/tickets/",
      method: "POST",
      isOperator: false,
    }),
    "allow",
  );
  assert.equal(
    accessDecision({
      pathname: "/api/tickets",
      method: "GET",
      isOperator: false,
    }),
    "json-unauthorized",
  );
  assert.equal(
    accessDecision({
      pathname: "/api/tickets/other",
      method: "POST",
      isOperator: false,
    }),
    "json-unauthorized",
  );
  assert.equal(
    accessDecision({
      pathname: "/",
      method: "GET",
      isOperator: false,
    }),
    "redirect-login",
  );
  assert.equal(
    accessDecision({
      pathname: "/",
      method: "POST",
      isOperator: false,
    }),
    "json-unauthorized",
  );
  assert.equal(
    accessDecision({
      pathname: "/api/test-db",
      method: "GET",
      isOperator: false,
    }),
    "json-unauthorized",
  );
  assert.equal(
    accessDecision({
      pathname: "/login",
      method: "POST",
      isOperator: false,
    }),
    "allow",
  );
  assert.equal(
    accessDecision({
      pathname: "/",
      method: "GET",
      isOperator: true,
    }),
    "allow",
  );
  assert.equal(
    accessDecision({
      pathname: "/api/test-db",
      method: "GET",
      isOperator: true,
    }),
    "allow",
  );
});

test("rate limiter blocks the next call inside the window", () => {
  const limiter = createRateLimiter({ limit: 2, windowMs: 1_000 });
  assert.equal(limiter.check("1.2.3.4", 0).ok, true);
  assert.equal(limiter.check("1.2.3.4", 10).ok, true);
  const blocked = limiter.check("1.2.3.4", 20);
  assert.equal(blocked.ok, false);
  if (!blocked.ok) {
    assert.ok(blocked.retryAfterSeconds >= 1);
  }
  assert.equal(limiter.check("5.6.7.8", 20).ok, true);
  assert.equal(limiter.check("1.2.3.4", 1_001).ok, true);
});

test("client ip uses the first forwarded address", () => {
  const headers = new Headers({
    "x-forwarded-for": "203.0.113.5, 10.0.0.1",
  });
  assert.equal(clientIp(headers), "203.0.113.5");
  assert.equal(positiveInt("nope", 10), 10);
  assert.equal(positiveInt("25", 10), 25);
  assert.equal(positiveInt("0", 10), 10);
});

test("privileged database access does not fall back to the publishable key", () => {
  const service = readFileSync(
    new URL("./supabase/service.ts", import.meta.url),
    "utf8",
  );
  const page = readFileSync(new URL("../app/page.tsx", import.meta.url), "utf8");
  const route = readFileSync(
    new URL("../app/api/tickets/route.ts", import.meta.url),
    "utf8",
  );

  assert.match(service, /import "server-only"/);
  assert.match(service, /SUPABASE_SERVICE_ROLE_KEY/);
  assert.doesNotMatch(service, /NEXT_PUBLIC_SUPABASE_PUBLISHABLE_KEY/);
  assert.doesNotMatch(service, /SUPABASE_SERVICE_ROLE_KEY\s*\?\?/);
  assert.doesNotMatch(page, /NEXT_PUBLIC_SUPABASE_PUBLISHABLE_KEY/);
  assert.doesNotMatch(route, /NEXT_PUBLIC_SUPABASE_PUBLISHABLE_KEY/);
  assert.doesNotMatch(route, /export async function GET/);
  assert.match(route, /\.select\("id"\)/);
});
