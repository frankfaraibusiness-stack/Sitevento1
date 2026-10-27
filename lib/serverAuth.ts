// lib/serverAuth.ts
//
// Shared server-only helpers for every Admin-SDK route in app/api/*.
// Extracted from the near-identical boilerplate that used to be
// copy-pasted at the top of connect-site, block-visitor, site-widget,
// etc. (getAdminApp / jsonError / isValidPlanId / todayKey). Routes
// should import from here instead of redefining these locally — keep
// one copy so a fix (e.g. a credential-loading change) lands
// everywhere at once.
//
// This module also ENFORCES the ACCOUNT-WIDE DAILY WRITE LIMIT: the
// "every write a user makes, and every request a widget sends back to
// the app, counts +1 against a per-day cap" mechanism. The per-plan
// numbers themselves live in lib/limits.ts's DEFAULT_DAILY_WRITE_LIMITS
// (client-safe, so UI like PlansPage can render them without pulling
// in firebase-admin) — this module just imports and enforces them. It
// reuses the existing users/{uid}/usage/{day} doc (lib/usageTracking.ts already
// writes `reads`/`writes`/`features.*` there for the Firestore-quota
// and feature-trial primitives) and adds one more field on that same
// doc: `accountWrites`. A fresh field (not the existing `writes`
// field) because `writes` is reserved for the Firestore-read/write
// infra-cost quota (lib/usageTracking.ts's checkAndIncrementFirestoreUsage,
// defined but not yet wired into any route) — a conceptually different
// limit with its own numbers. Reusing the SAME per-day doc means no
// new collection and no separate reset job: both counters reset
// together, for free, the instant the UTC date rolls over, because
// the doc id itself is the date.
//
// ── Reset model: fixed UTC day, not a rolling 24h window ─────────────
// Chosen over a rolling window for three reasons:
//   1. It's what the rest of this codebase already does everywhere —
//      lib/usageTracking.ts's todayKey(), app/api/block-visitor's own
//      todayKey(), and app/api/widget's usageDay are all the same
//      YYYY-MM-DD UTC bucket. A rolling window here would be the only
//      inconsistent limit in the app.
//   2. It needs no extra storage. A rolling window requires either a
//      sorted list of every write's timestamp (so old ones can be
//      evicted from the count) or an approximation (e.g. two
//      half-window buckets) — real storage and real complexity. A
//      fixed day is just FieldValue.increment(1) on one field of one
//      doc that already exists.
//   3. It's atomic and race-safe for free via a plain Firestore
//      transaction (read used, compare to limit, write used+1) — a
//      rolling window needs that same transaction PLUS a count-over-a-
//      moving-timestamp-range query, which Firestore can't do
//      transactionally against a growing event log without either a
//      second index or a race between the count read and a concurrent
//      write landing just inside/outside the window.
// Trade-off, stated plainly: a fixed UTC reset means a user who
// exhausts their cap at 23:59 UTC gets a full new allowance one minute
// later at 00:00 UTC, which can look like "two days' worth of writes
// in two minutes" in absolute wall-clock time. That's an accepted,
// understood trade for the atomicity + zero-new-infra properties
// above — the same trade this codebase already made for every other
// limit it enforces.
import { getApps, initializeApp, cert, type App } from 'firebase-admin/app';
import { getAuth } from 'firebase-admin/auth';
import { getFirestore, FieldValue, type Firestore } from 'firebase-admin/firestore';
import { NextResponse } from 'next/server';
import { allow } from './rateLimit';
import { getPlan, type PlanId } from './plans';
import { DEFAULT_DAILY_WRITE_LIMITS } from './limits';

// Re-exported so existing imports of DEFAULT_DAILY_WRITE_LIMITS from
// '@/lib/serverAuth' keep working. The real data now lives in
// lib/limits.ts (client-safe, and already the single source of truth
// for every other plan-gated number) — this module just re-uses it so
// server routes enforce the exact same numbers the client renders.
export { DEFAULT_DAILY_WRITE_LIMITS };

export function getAdminApp(): App {
  return getApps().length
    ? getApps()[0]
    : initializeApp({
        credential: cert({
          projectId: process.env.FIREBASE_PROJECT_ID,
          clientEmail: process.env.FIREBASE_CLIENT_EMAIL,
          privateKey: (process.env.FIREBASE_PRIVATE_KEY || '').replace(/\\n/g, '\n'),
        }),
      });
}

export function getAdminDb(): Firestore {
  return getFirestore(getAdminApp());
}

export function jsonError(status: number, message: string, extra?: Record<string, unknown>) {
  return NextResponse.json({ ok: false, error: message, ...extra }, { status, headers: { 'Cache-Control': 'no-store' } });
}

export function isValidPlanId(value: unknown): value is PlanId {
  return value === 'free' || value === 'starter' || value === 'scale' || value === 'pro-developer';
}

/** UTC calendar day, e.g. "2026-10-24" — the shared reset boundary for every daily counter in the app. */
export function todayKey(): string {
  return new Date().toISOString().slice(0, 10);
}

export function usageDocRef(db: Firestore, uid: string) {
  return db.collection('users').doc(uid).collection('usage').doc(todayKey());
}

/**
 * Verifies a Firebase Auth ID token with the Admin SDK and returns the
 * real, unforgeable uid — or null if the token is missing/invalid.
 * This is the step that makes it safe for a route to hold Admin-SDK
 * (rules-bypassing) privilege: nothing in the request body can be
 * trusted as "who the caller is" except this.
 */
export async function verifyCaller(app: App, idToken: unknown): Promise<string | null> {
  if (!idToken || typeof idToken !== 'string') return null;
  try {
    const decoded = await getAuth(app).verifyIdToken(idToken);
    return decoded.uid;
  } catch {
    return null;
  }
}

/** Reads the caller's plan off users/{uid}.plan, defaulting to 'free' exactly like every other route already does. */
export async function getCallerPlan(db: Firestore, uid: string): Promise<PlanId> {
  const snap = await db.collection('users').doc(uid).get();
  const data = snap.exists ? snap.data() || {} : {};
  return isValidPlanId(data.plan) ? data.plan : 'free';
}

export class WriteLimitReachedError extends Error {
  limit: number;
  used: number;
  constructor(limit: number, used: number) {
    super('WRITE_LIMIT_REACHED');
    this.limit = limit;
    this.used = used;
  }
}

/**
 * Atomically checks the caller's account-wide daily write counter
 * against their plan's limit and, if allowed, increments it by
 * `count` (default 1) — in one transaction, so two concurrent
 * requests can't both read "199 of 200" and both proceed. Throws
 * WriteLimitReachedError if the cap is already hit; otherwise
 * resolves with the new used count. Pass an existing transaction
 * (`tx`) to fold this into a route's own transaction (e.g.
 * connect-site's site-count check) instead of opening a second one.
 */
export async function checkAndIncrementAccountWrites(
  db: Firestore,
  uid: string,
  planId: PlanId,
  count = 1,
  tx?: FirebaseFirestore.Transaction
): Promise<{ used: number; limit: number | null }> {
  const limit = DEFAULT_DAILY_WRITE_LIMITS[planId] ?? DEFAULT_DAILY_WRITE_LIMITS.free;
  const ref = usageDocRef(db, uid);

  if (limit === null) {
    // Unlimited plan: still record the write for visibility/analytics,
    // but never block on it and never need a transaction to do so.
    if (tx) {
      tx.set(ref, { accountWrites: FieldValue.increment(count) }, { merge: true });
    } else {
      await ref.set({ accountWrites: FieldValue.increment(count) }, { merge: true });
    }
    return { used: -1, limit: null };
  }

  const run = async (t: FirebaseFirestore.Transaction) => {
    const snap = await t.get(ref);
    const data = snap.exists ? snap.data() || {} : {};
    const used = (data.accountWrites as number) || 0;

    if (used + count > limit) {
      throw new WriteLimitReachedError(limit, used);
    }

    t.set(ref, { accountWrites: used + count }, { merge: true });
    return { used: used + count, limit };
  };

  if (tx) return run(tx);
  return db.runTransaction(run);
}

/**
 * Read-only peek at today's account-write usage, without incrementing.
 * Used by /api/site-limits (and, through it, every dashboard "daily
 * limit" display: DashboardShell's usage bar, ProfilePage, etc).
 *
 * ── Why this reads BOTH counters ─────────────────────────────────────
 * The users/{uid}/usage/{day} doc actually carries two separate
 * fields that both count against the SAME per-plan daily cap
 * (DEFAULT_DAILY_WRITE_LIMITS) and reset on the SAME UTC-midnight
 * clock, but are incremented by different code paths:
 *   - accountWrites   — authenticated, owner-initiated dashboard
 *                        actions (checkAndIncrementAccountWrites,
 *                        called from app/api/user-action and
 *                        app/api/generate-faq).
 *   - widgetRequests   — every PUBLIC visitor-facing callback a site's
 *                        embed makes (assertWidgetWriteAllowed /
 *                        incrementWidgetRequestUsage, called from
 *                        app/api/track for every page view, plus
 *                        app/api/widget, overlay-track, overlay-notify,
 *                        email-capture, chat, ad-serve, ad-track).
 * Enforcement (assertWidgetWriteAllowed's hard pause) already checks
 * widgetRequests correctly for EVERY real-write widget-facing route —
 * not just page views (app/api/track), but every captured email
 * (app/api/email-capture), every chat message (app/api/chat), every
 * booking (app/api/appointment-booking), every contact form submission
 * (app/api/contact-us), every feedback survey response
 * (app/api/feedback-survey), every overlay "notify me" signup
 * (app/api/overlay-notify), and every spin-to-win redemption
 * (app/api/spin-reward) — each of those routes calls
 * assertWidgetWriteAllowed BEFORE its real write, so any one of them
 * pushing the count over the limit DOES get paused. The bug was
 * display-only: this function used to report accountWrites alone, so
 * a dashboard owner watching "used / limit" never saw ANY of that
 * traffic (views, emails, chat messages, bookings, etc) move the
 * number at all, even though every one of them was being counted and
 * enforced the whole time under the other field. Reporting
 * accountWrites + widgetRequests together is what makes "every
 * tracked view, captured email, or widget submission is -1 from
 * today's limit" actually visible, matching what was already true
 * server-side for all of them, not just views.
 */
export async function getAccountWriteUsage(
  db: Firestore,
  uid: string,
  planId: PlanId
): Promise<{ used: number; limit: number | null; remaining: number | null; resetsAt: string }> {
  const limit = DEFAULT_DAILY_WRITE_LIMITS[planId] ?? DEFAULT_DAILY_WRITE_LIMITS.free;
  const resetsAt = nextUtcMidnightIso();
  if (limit === null) return { used: 0, limit: null, remaining: null, resetsAt };

  const ref = usageDocRef(db, uid);
  const snap = await ref.get();
  const data = snap.exists ? snap.data() || {} : {};
  const accountWrites = (data.accountWrites as number) || 0;
  const widgetRequests = (data.widgetRequests as number) || 0;
  const used = accountWrites + widgetRequests;
  return { used, limit, remaining: Math.max(0, limit - used), resetsAt };
}

/** ISO timestamp of the next UTC-day rollover — when the caller's daily counters reset. Purely informational, for UI display. */
export function nextUtcMidnightIso(): string {
  const now = new Date();
  const next = new Date(Date.UTC(now.getUTCFullYear(), now.getUTCMonth(), now.getUTCDate() + 1, 0, 0, 0, 0));
  return next.toISOString();
}

export function nextPlanAfter(planId: PlanId): PlanId | null {
  const order: PlanId[] = ['free', 'starter', 'scale', 'pro-developer'];
  const idx = order.indexOf(planId);
  if (idx === -1 || idx === order.length - 1) return null;
  return order[idx + 1];
}

/** Standard 429 body for a write-limit rejection, shared by user-action and widget-request so the client handles both the same way. */
export function writeLimitResponse(planId: PlanId, err: WriteLimitReachedError) {
  const plan = getPlan(planId);
  return jsonError(
    429,
    `Daily write limit reached (${err.limit}/day on your ${plan.name} plan). Upgrade for a higher limit, or try again after it resets at UTC midnight.`,
    {
      code: 'WRITE_LIMIT_REACHED',
      planId,
      limit: err.limit,
      used: err.used,
      nextPlanId: nextPlanAfter(planId),
      resetsAt: nextUtcMidnightIso(),
    }
  );
}

/** Thin wrapper around lib/rateLimit's allow(), kept here so routes only import from one place. */
export function rateLimitOk(key: string, limit: number, windowMs: number): boolean {
  return allow(key, limit, windowMs);
}

// ────────────────────────────────────────────────────────────────────
// WIDGET-REQUEST COUNTER — every request a widget sends back to the
// app (loading its config, logging an overlay impression, submitting
// a chat message, capturing an email, etc.) counts +1 against the
// SITE OWNER's daily write limit — the same DEFAULT_DAILY_WRITE_LIMITS
// table and the same users/{uid}/usage/{day} doc as
// checkAndIncrementAccountWrites above, just incrementing a different
// field (`widgetRequests` instead of `accountWrites`) so the two are
// visible/reportable separately while still resetting together on the
// same UTC-day boundary and sharing one plan-tier limit table.
//
// These routes are PUBLIC and UNAUTHENTICATED by nature (a visitor's
// browser calls them, not the site owner's) — there is no idToken to
// verify here. The uid being charged is resolved from siteId via
// siteIndex/{siteId}, exactly the way every widget-facing route
// already resolves "which account owns this site" for its own logic
// (see app/api/widget/route.ts's own siteIndex lookup). This function
// does not throw when the limit is hit — unlike
// checkAndIncrementAccountWrites, a widget callback failing a quota
// must not break the visitor-facing feature it backs (a chat widget
// going dark because of an invisible server-side counter is a much
// worse failure mode than one extra Firestore write past a soft
// internal budget) — it returns `allowed: false` and the caller
// decides whether that's worth acting on.
export interface WidgetRequestUsage {
  allowed: boolean;
  used: number;
  limit: number | null;
}

/**
 * Increments the SITE OWNER's daily widget-request counter by one.
 * Call this from every public, visitor-facing widget route
 * (app/api/widget, app/api/track, app/api/overlay-track,
 * app/api/overlay-notify, app/api/email-capture, app/api/chat) right
 * after resolving `uid` from the request's siteId. Fire-and-forget by
 * design at most call sites — awaiting it is only useful if the route
 * wants to react to `allowed: false` (none currently do; the limit
 * here is a soft visibility/cost signal, not a hard feature gate the
 * way the daily FEATURE_LIMITS caps are).
 */
export async function incrementWidgetRequestUsage(
  db: Firestore,
  uid: string,
  planId: PlanId
): Promise<WidgetRequestUsage> {
  const limit = DEFAULT_DAILY_WRITE_LIMITS[planId] ?? DEFAULT_DAILY_WRITE_LIMITS.free;
  const ref = usageDocRef(db, uid);

  if (limit === null) {
    await ref.set({ widgetRequests: FieldValue.increment(1) }, { merge: true }).catch(() => {});
    return { allowed: true, used: -1, limit: null };
  }

  try {
    return await db.runTransaction(async (tx) => {
      const snap = await tx.get(ref);
      const data = snap.exists ? snap.data() || {} : {};
      const used = (data.widgetRequests as number) || 0;

      if (used >= limit) {
        return { allowed: false, used, limit };
      }

      tx.set(ref, { widgetRequests: used + 1 }, { merge: true });
      return { allowed: true, used: used + 1, limit };
    });
  } catch (err) {
    // Never let a counter failure break the widget request it's
    // attached to — degrade to "allowed" and move on.
    console.error('[incrementWidgetRequestUsage] transaction error', err);
    return { allowed: true, used: -1, limit };
  }
}

/**
 * Convenience wrapper for the common case: resolve uid from siteId via
 * siteIndex, look up its plan, and increment — all in one call, never
 * throwing. Returns null if the site/uid can't be resolved (caller's
 * own siteId validation should normally have already caught that).
 */
export async function trackWidgetRequest(
  db: Firestore,
  siteId: string
): Promise<WidgetRequestUsage | null> {
  try {
    const indexSnap = await db.collection('siteIndex').doc(siteId).get();
    const uid: string | null = indexSnap.exists ? indexSnap.data()?.uid ?? null : null;
    if (!uid) return null;
    const planId = await getCallerPlan(db, uid);
    return await incrementWidgetRequestUsage(db, uid, planId);
  } catch (err) {
    console.error('[trackWidgetRequest] error', err);
    return null;
  }
}

// ────────────────────────────────────────────────────────────────────
// HARD PAUSE — widget-facing WRITE routes (the 6 new ones: contact-us,
// appointment-booking, feedback, spin-reward, chat, email-capture)
// that actually create a Lead/booking/redemption, as opposed to a
// cheap/soft signal like a page-view or an impression beacon, must
// stop writing once the account hits its daily cap — not just keep
// counting. This is deliberately a SEPARATE function from
// incrementWidgetRequestUsage above (which stays soft/non-blocking for
// its existing low-stakes callers, e.g. /api/track, /api/overlay-track
// — unchanged) so this hard-pause behavior only applies where it was
// actually asked for.
//
// Reuses the exact same users/{uid}/usage/{day} doc and
// DEFAULT_DAILY_WRITE_LIMITS table as checkAndIncrementAccountWrites —
// same reset boundary (UTC midnight), same per-plan numbers — but
// increments `widgetRequests` (the field every other widget-facing
// route already writes) rather than `accountWrites` (reserved for
// authenticated owner actions in /api/user-action), so a site's
// visitor traffic and its owner's own dashboard actions are still
// visible as separate counters while sharing one limit and one reset
// clock, exactly like incrementWidgetRequestUsage already does.
export class WidgetWriteBlockedError extends Error {
  limit: number;
  used: number;
  planId: PlanId;
  constructor(limit: number, used: number, planId: PlanId) {
    super('WIDGET_WRITE_BLOCKED');
    this.limit = limit;
    this.used = used;
    this.planId = planId;
  }
}

/**
 * Resolves siteId -> uid/plan (siteIndex lookup, same as every other
 * widget route) and ATOMICALLY checks-and-increments that owner's
 * daily widgetRequests counter, THROWING WidgetWriteBlockedError if
 * the cap is already reached instead of returning allowed:false — so
 * a route can `await` this before its real Firestore write and simply
 * let the throw short-circuit the handler (see pausedWidgetResponse
 * below for the matching 200-with-paused-flag body). Returns the
 * resolved { uid, planId } on success so the caller doesn't need a
 * second siteIndex read.
 *
 * Returns null (not a throw) if the site/uid can't be resolved at
 * all — that's "unknown site," a different failure than "known site,
 * over its cap," and callers already have their own "unknown site"
 * response for that case.
 */
export async function assertWidgetWriteAllowed(
  db: Firestore,
  siteId: string
): Promise<{ uid: string; planId: PlanId } | null> {
  const indexSnap = await db.collection('siteIndex').doc(siteId).get();
  const uid: string | null = indexSnap.exists ? indexSnap.data()?.uid ?? null : null;
  if (!uid) return null;

  const planId = await getCallerPlan(db, uid);
  const limit = DEFAULT_DAILY_WRITE_LIMITS[planId] ?? DEFAULT_DAILY_WRITE_LIMITS.free;
  const ref = usageDocRef(db, uid);

  if (limit === null) {
    // Unlimited plan: record for visibility, never blocks.
    await ref.set({ widgetRequests: FieldValue.increment(1) }, { merge: true }).catch(() => {});
    return { uid, planId };
  }

  await db.runTransaction(async (tx) => {
    const snap = await tx.get(ref);
    const data = snap.exists ? snap.data() || {} : {};
    const used = (data.widgetRequests as number) || 0;

    if (used >= limit) {
      throw new WidgetWriteBlockedError(limit, used, planId);
    }
    tx.set(ref, { widgetRequests: used + 1 }, { merge: true });
  });

  return { uid, planId };
}

/**
 * Standard always-200 "paused" body for a widget write that was
 * blocked by assertWidgetWriteAllowed. Always-200 (not 429) on
 * purpose, matching every other visitor-facing route's CORS-open,
 * never-throw-into-the-host-page contract (see email-capture's own
 * comment) — the WIDGET must read `ok:false, code:'PAUSED'` and show
 * its own "try again later" state rather than a raw network error,
 * since this response crosses into a third-party page via iframe/XHR.
 * Deliberately returns no internal numbers (limit/used/plan) to the
 * public widget caller — that's account-internal detail for the site
 * owner's own dashboard (getAccountWriteUsage), not for anyone who
 * can read a site's embedded widget.
 */
export function pausedWidgetResponse(corsHeaders: Record<string, string>) {
  return NextResponse.json(
    {
      ok: false,
      code: 'PAUSED',
      reason: 'Daily limit reached for this site\u2019s account. The owner can upgrade or wait until it resets at UTC midnight.',
    },
    { status: 200, headers: corsHeaders }
  );
}
