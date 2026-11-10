// lib/botShieldEnforce.ts
//
// The Firestore-facing half of SECURITY BOT (lib/botShield.ts holds the
// pure, no-dependency scoring logic; this file is what actually reads
// a visitor's recent activity, calls that scorer, and — when it says
// to — performs the restrict or block via the Admin SDK). Split this
// way so the scoring rules themselves stay trivially unit-testable (no
// Firestore mock needed) while this file owns the one real side
// effect: writing an account-wide auto-restrict/auto-block that a
// human didn't click a button for.
//
// ── Where the state lives ─────────────────────────────────────────────
// users/{uid}/sites/{siteId}/botShield/{subjectId}
//   { events: number[], updatedAt }
// One doc per SUBJECT per site — small, short-lived (pruned on every
// read per pruneWindow's own lookback), and separate from
// visitorProfiles (which is the OWNER-facing roll-up) so a burst of
// rapid-fire writes to this doc during an actual attack never touches
// the doc the Users page renders from.
//
// `subjectId` is deliberately not always a real visitorId. The
// pageview and click paths (app/api/track, app/api/click-track) always
// have one — every beacon already carries/resolves a stable visitorId
// (see app/api/track's own header). The form-submission routes
// (email-capture, contact-us, appointment-booking, feedback-survey) do
// NOT currently thread a visitorId through at all — they only ever see
// siteId + the submitted fields + the caller's IP — so Form Flood
// Guard keys on `ip:<address>` for those instead. Same engine, same
// thresholds, just the best available stable-enough identity for each
// call site; a real visitorId is used wherever the caller already has
// one.
//
// ── Where a restrict/block actually lands ─────────────────────────────
// When the subject IS a real visitorId, this reuses the EXACT SAME
// collection app/api/block-visitor and app/api/user-action's
// doRestrictVisitor already write to, and app/api/track already reads
// from:
//   users/{uid}/sites/{siteId}/blockedVisitors/{visitorId}
// so an automatic restrict/block and a manual owner restrict/block are
// indistinguishable to every existing enforcement point (track's
// isVisitorBlocked/restrictedUntil checks, the dashboard's Users page
// "Live" badge, etc.) — nothing downstream needs to know or care which
// path created it. The two actions write different shapes of the same
// doc:
//   - restrict: { restrictedUntil: <now + RESTRICT_DURATION_MS> } —
//     self-expires; isVisitorBlocked below treats an expired
//     restriction as NOT currently blocking, same as
//     hooks/useActiveSiteData.ts's isRestricted().
//   - block:    { blockedAt, source: 'bot-shield', reason } — no
//     restrictedUntil, so it reads as a permanent block everywhere
//     that already checks "does a blockedVisitors doc exist" without
//     looking at restrictedUntil (app/api/track's older/simpler
//     paths), while the newer restrictedUntil-aware checks correctly
//     treat it as always-blocking (there's no future timestamp to be
//     past).
// An IP-keyed subject (no real visitorId available) is NOT written
// into blockedVisitors — that collection is specifically visitorId-
// keyed and read that way everywhere — so for those callers this
// function's `action` return value IS the enforcement: the calling
// route itself must check it and refuse the write, there's no separate
// collection for it to also land in. See lib/formFloodGuard.ts's
// checkFormFlood, which every lead-capture route calls for this.
//
// ── The activity log (what makes auto-action accountable) ────────────
// An automatic restrict/block with zero human review is only safe to
// ship if the owner can always see exactly what happened and undo it
// in one click. Every decision — restrict, block, or a flagged-but-
// clean moderate click-gap check — that crosses at least 'moderate' is
// appended to:
//   users/{uid}/sites/{siteId}/botShieldLog/{autoId}
//   { visitorId, subjectId, kind, verdict, action, reason, ts }
// 'clean' events are NOT logged (every single pageview would otherwise
// flood this collection) — only moments the engine actually flagged
// something. Reviewed and (un)restrictable/(un)blockable from
// /dashboard/bot-shield — see components/bot-shield/BotShieldPageClient.tsx
// and app/api/bot-shield/route.ts.
import { FieldValue, type Firestore } from 'firebase-admin/firestore';
import { decide, type BotShieldAction, type BotShieldEventKind, type BotShieldState, type BotShieldThresholdOverrides, RESTRICT_DURATION_MS } from './botShield';
import { lookupNetworkIntel, isNetworkSuspect } from './ipIntel';

export interface BotShieldEnforceResult {
  action: BotShieldAction;
  /** Convenience: action !== 'none'. */
  blocked: boolean;
  /** True only when THIS call is what newly triggered the restrict/block (not an already-blocked visitor). */
  newlyBlocked: boolean;
  reason: string | null;
  /** Set only when action === 'restrict' — epoch ms this restriction expires at. */
  restrictedUntil: number | null;
}

/**
 * Call once per tracked event (one pageview beacon, one click beacon,
 * one form submit). Reads the visitor's rolling state, judges this
 * event, and — if the verdict says to — writes the restrict/block + a
 * log entry, all before returning. Never throws for a 'clean'/no-
 * action outcome; callers treat this the same way they already treat
 * the existing isVisitorBlocked check (read the boolean, act on it),
 * so adding SECURITY BOT to an existing route is a small, additive
 * change rather than a new error path to handle.
 *
 * `alreadyBlocked` lets a caller skip the write entirely for a visitor
 * block-visitor or a prior SECURITY BOT call already blocked this
 * request — still useful for callers that want the log/event history
 * to keep accumulating context even post-block, but most callers (see
 * app/api/track) should just skip calling this at all once they know
 * a visitor is already blocked, since there's nothing further to do.
 */
export async function applyBotShield(opts: {
  db: Firestore;
  siteRef: FirebaseFirestore.DocumentReference;
  /** A real visitorId (pageview/click calls) or a synthetic `ip:<address>` key (form-submit calls with no visitorId available) — see header comment. */
  subjectId: string;
  /** True only when subjectId is a real visitorId — controls whether a restrict/block is ALSO written to blockedVisitors (visitorId-keyed; never written for an IP-keyed subject). */
  isRealVisitorId: boolean;
  kind: BotShieldEventKind;
  /** Whether this feature is actually turned on for this site — see lib/botShieldConfig.ts. Caller decides; this function doesn't re-check plan/feature gating itself. */
  enabled: boolean;
  /** Site owner's per-kind threshold overrides (BotShieldConfig.thresholds) — see resolveThreshold in botShield.ts. Omit to use the built-in defaults for every kind. */
  thresholdOverrides?: BotShieldThresholdOverrides;
  /** The caller's IP, if known — used ONLY for the optional network-intel lookup below (lib/ipIntel.ts). Never persisted; the raw IP itself is not written anywhere by this function. */
  callerIp?: string | null;
  nowTs?: number;
}): Promise<BotShieldEnforceResult> {
  if (!opts.enabled) {
    return { action: 'none', blocked: false, newlyBlocked: false, reason: null, restrictedUntil: null };
  }

  const nowTs = opts.nowTs ?? Date.now();
  const stateRef = opts.siteRef.collection('botShield').doc(opts.subjectId);
  const blockRef = opts.isRealVisitorId ? opts.siteRef.collection('blockedVisitors').doc(opts.subjectId) : null;

  // Network signal — best-effort, bounded, never throws (see
  // lib/ipIntel.ts's header for the full contract). Resolved BEFORE
  // the transaction below rather than inside it: a transaction
  // callback can retry, and retrying a network call on every retry
  // would multiply the latency/cost this is explicitly trying to
  // bound. A `null` lookup (no IP, private IP, upstream failure/rate-
  // limit) simply means `networkSuspect` stays undefined and scoring
  // proceeds on timing signals alone, exactly as before this existed.
  let networkSuspect: boolean | undefined;
  if (opts.callerIp) {
    try {
      const intel = await lookupNetworkIntel(opts.callerIp);
      networkSuspect = isNetworkSuspect(intel);
    } catch {
      networkSuspect = undefined;
    }
  }

  // Transaction: the read-decide-write of this visitor's rolling state
  // must be atomic, exactly like assertWidgetTokensAllowed's own
  // reasoning — two near-simultaneous beacons from the same bot (a
  // very real case here, since a scripted burst is BY DEFINITION
  // multiple near-simultaneous requests) must not both read the same
  // "4 events so far" state and both decide independently; each has to
  // see the other's increment. runTransaction's own return value
  // carries the decision back out — a closure-assigned outer `let`
  // would leave TypeScript unable to prove it was ever set (a retried
  // transaction can run its callback more than once, but always at
  // least once before the promise resolves), so returning it directly
  // is both simpler and actually sound rather than cast through
  // `unknown` to silence that check.
  const result = await opts.db.runTransaction(async (tx) => {
    const snap = await tx.get(stateRef);
    const existing = snap.exists ? (snap.data() as BotShieldState) : undefined;

    const decision = decide(opts.kind, existing, nowTs, opts.thresholdOverrides, networkSuspect);

    tx.set(
      stateRef,
      { events: decision.nextState.events, updatedAt: FieldValue.serverTimestamp() },
      { merge: true }
    );

    const restrictedUntil = decision.action === 'restrict' ? nowTs + RESTRICT_DURATION_MS : null;

    if (decision.action === 'restrict' && blockRef) {
      tx.set(blockRef, { restrictedUntil, source: 'bot-shield', reason: decision.reason }, { merge: true });
    } else if (decision.action === 'block' && blockRef) {
      tx.set(blockRef, {
        blockedAt: FieldValue.serverTimestamp(),
        source: 'bot-shield',
        reason: decision.reason,
        // Clear any stale restrictedUntil from an earlier restrict —
        // this is now a permanent block, not a time-boxed one.
        restrictedUntil: FieldValue.delete(),
      });
    }

    return { decision, restrictedUntil };
  });

  // Log writes happen OUTSIDE the transaction (an autoId add() can't
  // run inside one the same way, and this is a fire-and-forget
  // record, not state anything else reads transactionally) — only for
  // verdicts worth an owner ever seeing.
  if (result.decision.result.verdict !== 'clean') {
    opts.siteRef
      .collection('botShieldLog')
      .add({
        visitorId: opts.isRealVisitorId ? opts.subjectId : null,
        subjectId: opts.subjectId,
        kind: opts.kind,
        verdict: result.decision.result.verdict,
        countInWindow: result.decision.result.countInWindow,
        action: result.decision.action,
        reason: result.decision.action !== 'none' ? result.decision.reason : null,
        blocked: result.decision.action !== 'none',
        restrictedUntil: result.restrictedUntil,
        // Extra signals, for owner transparency on /dashboard/bot-shield
        // (not used by any enforcement logic downstream — purely
        // diagnostic context on WHY this particular event tripped).
        timingRegularity: typeof result.decision.result.timingRegularity === 'number' ? result.decision.result.timingRegularity : null,
        networkSuspect: result.decision.result.networkSuspect === true,
        ts: FieldValue.serverTimestamp(),
      })
      .catch((err) => console.error('[botShieldEnforce] log write failed', err));
  }

  return {
    action: result.decision.action,
    blocked: result.decision.action !== 'none',
    newlyBlocked: result.decision.action !== 'none',
    reason: result.decision.action !== 'none' ? result.decision.reason : null,
    restrictedUntil: result.restrictedUntil,
  };
}
