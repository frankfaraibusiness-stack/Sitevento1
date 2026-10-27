// lib/usageTracking.ts
//
// Server-only helpers for enforcing the daily caps defined in
// lib/limits.ts (feature trial limits, Firestore read/write quotas)
// against real per-user counters in Firestore.
//
// Storage shape: one doc per user per UTC day, at
//   users/{uid}/usage/{YYYY-MM-DD}
// with fields:
//   { reads: number, writes: number, features: { [permissionId]: number } }
//
// A new doc per day means no cron/reset job is needed — yesterday's
// doc is simply never read again, and Firestore TTL (optional, set up
// separately in the console on this collection group with a `ts`
// field) can clean old docs up for storage hygiene; functionally the
// app doesn't need that cleanup to behave correctly.
//
// This module is intentionally NOT wired into every API route yet —
// doing that for all 15+ routes in one pass is a separate, larger
// change. What's here is the complete, correct enforcement primitive:
// call `checkAndIncrementFeatureUsage` / `checkAndIncrementFirestoreUsage`
// from any route that performs a gated action, and it will both
// evaluate AND atomically record the usage in one transaction (so two
// concurrent requests can't both slip through under the cap).
import { getAdminDb } from './firebaseAdmin';
import type { PlanId } from './plans';
import { featureDailyLimit, firestoreQuota } from './limits';

function todayKey(): string {
  // UTC day boundary — simplest option, consistent regardless of the
  // user's timezone or the server's. Good enough for a daily trial
  // cap; doesn't need to match any particular user's midnight.
  return new Date().toISOString().slice(0, 10); // "YYYY-MM-DD"
}

function usageDocRef(uid: string) {
  const db = getAdminDb();
  return db.collection('users').doc(uid).collection('usage').doc(todayKey());
}

export interface FeatureUsageResult {
  allowed: boolean;
  used: number;
  limit: number | null; // null = unlimited
  remaining: number | null; // null = unlimited
}

/**
 * Atomically checks whether `permissionId` can be used once more today
 * under `plan`'s cap, and if so, records the use. Returns the result
 * either way so the caller can decide what to tell the user.
 *
 * Usage (inside an API route, after verifying the caller's uid and plan):
 *
 *   const usage = await checkAndIncrementFeatureUsage(uid, plan, 'visitor-access-control');
 *   if (!usage.allowed) {
 *     return jsonError(429, `Daily limit reached (${usage.limit}/day on your plan). Upgrade for more.`);
 *   }
 *   // ...perform the actual block...
 */
export async function checkAndIncrementFeatureUsage(
  uid: string,
  plan: PlanId,
  permissionId: string
): Promise<FeatureUsageResult> {
  const limit = featureDailyLimit(permissionId, plan);

  // Unlimited on this plan — nothing to track, always allowed. Still
  // worth a non-transactional increment for visibility/analytics, but
  // that's optional; skipped here to keep the common "paid plan, no
  // cap" path cheap (zero extra reads/writes).
  if (limit === null) {
    return { allowed: true, used: 0, limit: null, remaining: null };
  }

  const db = getAdminDb();
  const ref = usageDocRef(uid);

  return db.runTransaction(async (tx) => {
    const snap = await tx.get(ref);
    const data = snap.exists ? snap.data() || {} : {};
    const features = (data.features || {}) as Record<string, number>;
    const used = features[permissionId] || 0;

    if (used >= limit) {
      return { allowed: false, used, limit, remaining: 0 };
    }

    tx.set(
      ref,
      { features: { ...features, [permissionId]: used + 1 } },
      { merge: true }
    );

    return { allowed: true, used: used + 1, limit, remaining: limit - (used + 1) };
  });
}

/** Read-only peek at today's usage for a feature, without incrementing. */
export async function getFeatureUsage(uid: string, plan: PlanId, permissionId: string): Promise<FeatureUsageResult> {
  const limit = featureDailyLimit(permissionId, plan);
  if (limit === null) return { allowed: true, used: 0, limit: null, remaining: null };

  const db = getAdminDb();
  const snap = await usageDocRef(uid).get();
  const data = snap.exists ? snap.data() || {} : {};
  const features = (data.features || {}) as Record<string, number>;
  const used = features[permissionId] || 0;

  return { allowed: used < limit, used, limit, remaining: Math.max(0, limit - used) };
}

export interface FirestoreUsageResult {
  allowed: boolean;
  used: number;
  limit: number | null;
}

/**
 * Atomically checks + records one Firestore read or write against the
 * caller's daily quota (lib/limits.ts's FIRESTORE_QUOTAS). Intended to
 * wrap the app's OWN Firestore calls on routes that are expensive/high
 * volume (e.g. /api/track on every visitor pageview) — not meant to
 * replace Firestore's own security rules or be called on every single
 * internal read (that would itself multiply your read cost). Use it at
 * the entry point of a route, once per logical operation.
 */
export async function checkAndIncrementFirestoreUsage(
  uid: string,
  plan: PlanId,
  kind: 'read' | 'write',
  count = 1
): Promise<FirestoreUsageResult> {
  const quota = firestoreQuota(plan);
  const limit = kind === 'read' ? quota.readsPerDay : quota.writesPerDay;

  if (limit === null) {
    return { allowed: true, used: 0, limit: null };
  }

  const db = getAdminDb();
  const ref = usageDocRef(uid);
  const field = kind === 'read' ? 'reads' : 'writes';

  return db.runTransaction(async (tx) => {
    const snap = await tx.get(ref);
    const data = snap.exists ? snap.data() || {} : {};
    const used = (data[field] as number) || 0;

    if (used + count > limit) {
      return { allowed: false, used, limit };
    }

    tx.set(ref, { [field]: used + count }, { merge: true });
    return { allowed: true, used: used + count, limit };
  });
}
