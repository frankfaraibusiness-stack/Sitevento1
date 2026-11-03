// lib/rateLimit.ts
//
// Minimal fixed-window rate limiter, in-memory, for public endpoints
// hit directly by third-party visitor browsers (/api/widget).
//
// ── Honest limitation ───────────────────────────────────────────────
// This state lives in the Node.js process, not a shared store. On
// Vercel, each serverless/edge instance has its own memory, so a
// single caller hammering the endpoint across many cold-started
// instances could exceed the nominal limit before any single instance
// notices. This is intentionally NOT advertised as a hard global cap —
// it is a cheap first line of defense against a single hot instance
// being hammered (e.g. a runaway loop on one visitor's page), and it
// requires no new infrastructure. For a hard, globally-accurate limit,
// swap this for a shared store (Redis/Upstash, Vercel KV, or
// Firestore-backed counters) behind the same `allow()` call signature —
// nothing else in the route needs to change. This is also a
// fixed-window counter, not a sliding one, so a burst straddling a
// window boundary can briefly admit a bit over `limit` — fine for
// "stop obvious abuse", not a precise quota enforcer.
const buckets = new Map<string, { count: number; resetAt: number }>();

// Opportunistic cleanup so `buckets` doesn't grow unbounded across a
// long-lived instance; runs on a tiny fraction of calls rather than on
// a timer, so it costs nothing on platforms that freeze timers between
// invocations (which is exactly the Vercel serverless case this is
// written for).
function maybeCleanup(now: number) {
  if (Math.random() > 0.01) return;
  for (const [key, bucket] of buckets) {
    if (bucket.resetAt <= now) buckets.delete(key);
  }
}

export function allow(key: string, limit: number, windowMs: number): boolean {
  const now = Date.now();
  maybeCleanup(now);

  const bucket = buckets.get(key);
  if (!bucket || bucket.resetAt <= now) {
    buckets.set(key, { count: 1, resetAt: now + windowMs });
    return true;
  }

  if (bucket.count >= limit) return false;
  bucket.count += 1;
  return true;
}
