// lib/ipIntel.ts
//
// ── Free network signal: is this IP a hosting/datacenter/proxy box? ───
// One more input into SECURITY BOT's scoring (see lib/botShield.ts's
// `networkSuspect` handling in evaluateBurst) — a residential human
// browsing from their phone or home connection almost never resolves
// to a datacenter ASN; a script running on a cloud box almost always
// does. On its own this is a WEAK signal (plenty of honest visitors
// are on a VPN or corporate NAT) — see botShield.ts's own comment on
// why this only nudges an already-'moderate' verdict to 'severe', and
// is never a path from 'clean' to an action by itself.
//
// ── Provider ───────────────────────────────────────────────────────────
// ip-api.com's free endpoint: no signup, no API key, includes exactly
// the fields this needs (hosting/proxy/mobile flags + ASN). Documented
// trade-off, accepted deliberately for this app: the free tier's terms
// restrict it to non-commercial use and it's HTTP-only (no TLS) — both
// real considerations for a commercial product, logged here so they're
// never silently forgotten. If that ever needs to change, swap
// fetchNetworkIntel's internals for a token-based provider (e.g.
// IPinfo Lite, swap the endpoint + add an Authorization header) —
// every caller of lookupNetworkIntel below stays unchanged, since the
// NetworkIntel return shape is provider-agnostic.
//
// ── Cost + latency discipline ──────────────────────────────────────────
// This is called from a hot beacon path (app/api/track, potentially
// app/api/click-track) that must stay fast and must never fail a
// visitor's pageview over a third-party hiccup. Three guards enforce
// that:
//   1. A hard per-request timeout (INTEL_TIMEOUT_MS) via AbortController
//      — a slow/hanging upstream can never hold the beacon open.
//   2. A tiny in-memory TTL cache, same honest-limitation shape as
//      lib/rateLimit.ts's `allow()` (per-instance, not shared across
//      Vercel instances; fine here because the goal is just "don't
//      re-fetch the SAME ip twice in a row within a few minutes", not a
//      precise global count).
//   3. Every failure mode (network error, timeout, non-200, malformed
//      JSON, rate-limited upstream) resolves to `null` — "unknown",
//      never thrown — so a caller's `networkSuspect` input is simply
//      left undefined and scoring proceeds on timing signals alone,
//      exactly as it did before this file existed.
// Always call this fire-and-forget (`.catch(() => null)` / don't
// `await` it on the response's critical path) unless the caller has
// already decided the extra latency is acceptable.

export interface NetworkIntel {
  /** True if this IP is flagged as belonging to a hosting/datacenter provider (cloud box, not a home/mobile connection). */
  hosting: boolean;
  /** True if this IP is flagged as a known proxy/VPN/Tor exit. */
  proxy: boolean;
  /** True if this IP is flagged as a mobile carrier connection — NOT suspicious on its own, kept for dashboard display only. */
  mobile: boolean;
  /** ASN organization name, e.g. "Google LLC" — display-only, never used in scoring. */
  asOrg: string | null;
}

interface CacheEntry {
  value: NetworkIntel | null;
  expiresAt: number;
}

const cache = new Map<string, CacheEntry>();
const CACHE_TTL_MS = 10 * 60_000; // an IP's hosting/proxy classification essentially never changes minute to minute; 10m keeps a bursty attacker from re-triggering a lookup on every single event
const MAX_CACHE_ENTRIES = 5_000; // bounds memory on a long-lived instance; see maybeEvict below
const INTEL_TIMEOUT_MS = 1_200; // generous enough for a healthy upstream, short enough to never meaningfully delay a beacon response

function maybeEvict(now: number) {
  if (cache.size < MAX_CACHE_ENTRIES) return;
  for (const [key, entry] of cache) {
    if (entry.expiresAt <= now) cache.delete(key);
  }
  // Still over budget after clearing expired entries (a genuine spike
  // of distinct IPs, not just a dirty cache) — drop the oldest
  // Map-insertion-order entries rather than growing unbounded. Map
  // iteration order is insertion order, so this is cheap and correct.
  if (cache.size >= MAX_CACHE_ENTRIES) {
    const excess = cache.size - MAX_CACHE_ENTRIES + 500;
    let i = 0;
    for (const key of cache.keys()) {
      if (i++ >= excess) break;
      cache.delete(key);
    }
  }
}

// Private/loopback/link-local ranges never resolve to anything useful
// upstream and would just burn a request + always come back "unknown"
// — short-circuit locally instead. Also guards against ever sending an
// internal/placeholder value (e.g. a load balancer's synthetic
// address) out to a third party.
function isPrivateOrInvalid(ip: string): boolean {
  if (!ip || ip === 'unknown') return true;
  if (/^(10\.|127\.|0\.|169\.254\.)/.test(ip)) return true;
  if (/^192\.168\./.test(ip)) return true;
  if (/^172\.(1[6-9]|2\d|3[01])\./.test(ip)) return true;
  if (ip === '::1' || /^f[cd][0-9a-f]{0,2}:/i.test(ip)) return true;
  return false;
}

/**
 * Looks up hosting/proxy/mobile flags for one IP address. Always
 * resolves (never rejects) — returns null for "couldn't determine" in
 * every failure case, by design (see header). Cached per-process for
 * CACHE_TTL_MS.
 */
export async function lookupNetworkIntel(ip: string): Promise<NetworkIntel | null> {
  if (isPrivateOrInvalid(ip)) return null;

  const now = Date.now();
  const cached = cache.get(ip);
  if (cached && cached.expiresAt > now) return cached.value;

  let result: NetworkIntel | null = null;
  try {
    const controller = new AbortController();
    const timer = setTimeout(() => controller.abort(), INTEL_TIMEOUT_MS);
    try {
      const res = await fetch(
        `http://ip-api.com/json/${encodeURIComponent(ip)}?fields=status,hosting,proxy,mobile,as`,
        { signal: controller.signal }
      );
      if (res.ok) {
        const data = await res.json().catch(() => null);
        if (data && data.status === 'success') {
          result = {
            hosting: data.hosting === true,
            proxy: data.proxy === true,
            mobile: data.mobile === true,
            asOrg: typeof data.as === 'string' ? data.as.slice(0, 120) : null,
          };
        }
      }
    } finally {
      clearTimeout(timer);
    }
  } catch (err) {
    // Timeout, network error, upstream rate-limit (this free tier is
    // 45 req/min — a real cap we WILL hit under real traffic; see this
    // file's header) — all collapse to "unknown", never thrown. A
    // console.error here is deliberately omitted: at volume, a capped
    // free API failing is an expected, routine event, not something
    // worth log-spamming on every single occurrence.
    result = null;
  }

  maybeEvict(now);
  cache.set(ip, { value: result, expiresAt: now + CACHE_TTL_MS });
  return result;
}

/**
 * Convenience boolean for SECURITY BOT's scoring input — collapses a
 * NetworkIntel reading into the single yes/no `networkSuspect` signal
 * lib/botShield.ts's evaluateBurst expects. `mobile` is intentionally
 * excluded: a mobile carrier connection is completely ordinary and
 * must never raise suspicion on its own.
 */
export function isNetworkSuspect(intel: NetworkIntel | null): boolean {
  return !!intel && (intel.hosting || intel.proxy);
}
