// lib/requestCache.ts
//
// ── Why this exists ───────────────────────────────────────────────────
// A handful of Firestore docs read on the hot visitor-tracking path
// (app/api/track, app/api/site-widgets, app/api/widget) are OWNER-
// CONFIGURED and change rarely — a dashboard toggle, a widget catalog
// bump — yet were being re-read from Firestore on literally every
// single pageview/widget request. That's real, billed read cost for
// data that is, for all practical purposes, static between dashboard
// saves. This is the same honest trade lib/ipIntel.ts already makes
// for its third-party network-intel lookups: a small in-process TTL
// cache, scoped to one serverless instance's lifetime, not a shared/
// global cache and not a correctness guarantee — just "don't re-read
// the same rarely-changing doc on every request within the same warm
// instance for the next few seconds."
//
// ── What this is NOT ─────────────────────────────────────────────────
// Not a replacement for real-time correctness anywhere a dashboard
// listener needs to see a change instantly (visits, visitor profiles,
// bot-shield state are never routed through this — those still read
// fresh every time). Only ever used for config-shaped docs where a
// few seconds of staleness after a dashboard save is an acceptable,
// explicitly-chosen trade for cutting the read volume that scales with
// every visitor on every site, not with how often an owner clicks Save.
//
// ── Honest limitation (same as rateLimit.ts / ipIntel.ts) ─────────────
// Per-process, not shared across Vercel instances — a cold start or a
// second concurrent instance simply re-reads once and re-populates its
// own cache. That's fine: the goal is cutting the common case (many
// requests hitting the same warm instance in a short window), not
// building a distributed cache.

interface Entry<T> {
  value: T;
  expiresAt: number;
}

const store = new Map<string, Entry<unknown>>();

// Bounds memory on a long-lived instance the same way ipIntel.ts's
// cache does — this app only ever has a few hundred distinct cache
// keys in practice (per-site config docs + the small global widget
// catalog), so this ceiling is generous headroom, not a real limit.
const MAX_ENTRIES = 10_000;

function evictIfNeeded() {
  if (store.size < MAX_ENTRIES) return;
  const now = Date.now();
  for (const [key, entry] of store) {
    if (entry.expiresAt <= now) store.delete(key);
  }
  if (store.size >= MAX_ENTRIES) {
    const excess = store.size - MAX_ENTRIES + 200;
    let i = 0;
    for (const key of store.keys()) {
      if (i++ >= excess) break;
      store.delete(key);
    }
  }
}

/**
 * Returns the cached value for `key` if still fresh, otherwise calls
 * `load()`, caches its result for `ttlMs`, and returns it. `load()`'s
 * own failures propagate to the caller as normal (nothing here
 * swallows an error into a cached null) — callers that want
 * fail-open-to-default behavior (same as getBotShieldConfig already
 * does) keep that logic in their own `load` function, unchanged.
 */
export async function withCache<T>(key: string, ttlMs: number, load: () => Promise<T>): Promise<T> {
  const now = Date.now();
  const cached = store.get(key) as Entry<T> | undefined;
  if (cached && cached.expiresAt > now) return cached.value;

  const value = await load();
  evictIfNeeded();
  store.set(key, { value, expiresAt: now + ttlMs });
  return value;
}

/** Drops one cached key immediately — for the rare write path that wants its own next read to see the fresh value within the same instance. */
export function invalidateCache(key: string): void {
  store.delete(key);
}
