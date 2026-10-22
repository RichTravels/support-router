type Bucket = {
  stamps: number[];
};

export type RateLimitResult =
  | { ok: true }
  | { ok: false; retryAfterSeconds: number };

export function positiveInt(
  value: string | undefined,
  fallback: number,
  max = 100_000,
): number {
  if (value == null || value.trim() === "") return fallback;
  const parsed = Number(value);
  if (!Number.isInteger(parsed) || parsed <= 0 || parsed > max) return fallback;
  return parsed;
}

export function clientIp(headerSource: {
  get(name: string): string | null;
}): string {
  const forwarded = headerSource.get("x-forwarded-for");
  if (forwarded) {
    const first = forwarded.split(",")[0]?.trim();
    if (first) return first.slice(0, 128);
  }
  const real = headerSource.get("x-real-ip")?.trim();
  if (real) return real.slice(0, 128);
  return "unknown";
}

/**
 * In-memory sliding window. Enough for a single server process. Each
 * serverless instance keeps its own counters, so this is a basic brake,
 * not a global quota.
 */
export function createRateLimiter(options: { limit: number; windowMs: number }) {
  const hits = new Map<string, Bucket>();

  return {
    check(key: string, now = Date.now()): RateLimitResult {
      const windowStart = now - options.windowMs;
      const bucket = hits.get(key);
      const recent = (bucket?.stamps ?? []).filter((stamp) => stamp > windowStart);

      if (recent.length >= options.limit) {
        const retryAfterMs = recent[0] + options.windowMs - now;
        hits.set(key, { stamps: recent });
        return {
          ok: false,
          retryAfterSeconds: Math.max(1, Math.ceil(retryAfterMs / 1000)),
        };
      }

      recent.push(now);
      hits.set(key, { stamps: recent });

      if (hits.size > 5000) {
        for (const [storedKey, stored] of hits) {
          const fresh = stored.stamps.filter((stamp) => stamp > windowStart);
          if (fresh.length === 0) hits.delete(storedKey);
          else hits.set(storedKey, { stamps: fresh });
        }
      }

      return { ok: true };
    },
  };
}
