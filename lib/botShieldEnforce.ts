// lib/botShieldEnforce.ts
//
// The Firestore-facing half of Bot Shield (lib/botShield.ts holds the
// pure, no-dependency scoring logic; this file is what actually reads
// a visitor's recent activity, calls that scorer, and — when it says
// to — performs the block via the Admin SDK). Split this way so the
// scoring rules themselves stay trivially unit-testable (no Firestore
// mock needed) while this file owns the one real side effect: writing
// an account-wide auto-block that a human didn't click a button for.
//
// ── Where the state lives ─────────────────────────────────────────────
// users/{uid}/sites/{siteId}/botShield/{subjectId}
//   { events: number[], strikes: number[], updatedAt }
// One doc per SUBJECT per site — small, short-lived (pruned on every
// read per pruneWindow's own lookback), and separate from
// visitorProfiles (which is the OWNER-facing roll-up) so a burst of
// rapid-fire writes to this doc during an actual attack never touches
// the doc the Users page renders from.
//
// `subjectId` is deliberately not always a real visitorId. The
// pageview path (app/api/track) always has one — every beacon already
// carries/resolves a stable visitorId (see that route's own header).
// The form-submission routes (email-capture, contact-us,
// appointment-booking, feedback-survey) do NOT currently thread a
// visitorId through at all — they only ever see siteId + the
// submitted fields + the caller's IP — so Form Flood Guard keys on
// `ip:<address>` for those instead. Same engine, same thresholds,
// just the best available stable-enough identity for each call site;
// a real visitorId is used wherever the caller already has one.
//
// ── Where a block actually lands ──────────────────────────────────────
// When the subject IS a real visitorId, this reuses the EXACT SAME
// collection app/api/block-visitor already writes to and
// app/api/track already reads from:
//   users/{uid}/sites/{siteId}/blockedVisitors/{visitorId}
// so a Bot Shield auto-block and a manual owner block are
// indistinguishable to every existing enforcement point (track's
// isVisitorBlocked check, the dashboard's Users page "Live" badge,
// etc.) — nothing downstream needs to know or care which path created
// the block. An IP-keyed subject (no real visitorId available) is
// NOT written into blockedVisitors — that collection is specifically
// visitorId-keyed and read that way everywhere — so for those callers
// this function's `blocked` return value IS the enforcement: the
// calling route itself must check it and refuse the write, there's no
// separate collection for it to also land in. See lib/formFloodGuard.ts's
// checkFormFlood, which every lead-capture route calls for this.
//
// ── The activity log (what makes auto-action accountable) ────────────
// An automatic block with zero human review is only safe to ship if
// the owner can always see exactly what happened and undo it in one
// click. Every decision — block or not — that crosses at least
// 'moderate' is appended to:
//   users/{uid}/sites/{siteId}/botShieldLog/{autoId}
//   { visitorId, subjectId, kind, verdict, reason, blocked, ts }
// 'clean' events are NOT logged (every single pageview would otherwise
// flood this collection) — only moments the engine actually flagged
// something, whether or not that flag crossed the block threshold.
// Reviewed and (un)blockable from /dashboard/bot-shield — see
// components/bot-shield/BotShieldPageClient.tsx and
// app/api/bot-shield/route.ts.
import { FieldValue, type Firestore } from 'firebase-admin/firestore';
import { decide, type BotShieldEventKind, type BotShieldState } from './botShield';

export interface BotShieldEnforceResult {
  blocked: boolean;
  /** True only when THIS call is what newly triggered the block (not an already-blocked visitor). */
  newlyBlocked: boolean;
  reason: string | null;
}

/**
 * Call once per tracked event (one pageview beacon, one form submit).
 * Reads the visitor's rolling state, judges this event, and — if the
 * verdict says to — writes the block + a log entry, all before
 * returning. Never throws for a 'clean'/'moderate'-no-block outcome;
 * callers treat this the same way they already treat the existing
 * isVisitorBlocked check (read the boolean, act on it), so adding Bot
 * Shield to an existing route is a small, additive change rather than
 * a new error path to handle.
 *
 * `alreadyBlocked` lets a caller skip the write entirely for a visitor
 * block-visitor or a prior Bot Shield call already blocked this
 * request — still useful for callers that want the log/strike history
 * to keep accumulating context even post-block, but most callers (see
 * app/api/track) should just skip calling this at all once they know
 * a visitor is already blocked, since there's nothing further to do.
 */
export async function applyBotShield(opts: {
  db: Firestore;
  siteRef: FirebaseFirestore.DocumentReference;
  /** A real visitorId (pageview/click calls) or a synthetic `ip:<address>` key (form-submit calls with no visitorId available) — see header comment. */
  subjectId: string;
  /** True only when subjectId is a real visitorId — controls whether a block is ALSO written to blockedVisitors (visitorId-keyed; never written for an IP-keyed subject). */
  isRealVisitorId: boolean;
  kind: BotShieldEventKind;
  /** Whether this feature is actually turned on for this site — see lib/botShieldConfig.ts. Caller decides; this function doesn't re-check plan/feature gating itself. */
  enabled: boolean;
  nowTs?: number;
}): Promise<BotShieldEnforceResult> {
  if (!opts.enabled) {
    return { blocked: false, newlyBlocked: false, reason: null };
  }

  const nowTs = opts.nowTs ?? Date.now();
  const stateRef = opts.siteRef.collection('botShield').doc(opts.subjectId);
  const blockRef = opts.isRealVisitorId ? opts.siteRef.collection('blockedVisitors').doc(opts.subjectId) : null;

  // Transaction: the read-decide-write of this visitor's rolling state
  // must be atomic, exactly like assertWidgetWriteAllowed's own
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

    const decision = decide(opts.kind, existing, nowTs);

    tx.set(
      stateRef,
      { events: decision.nextState.events, strikes: decision.nextState.strikes, updatedAt: FieldValue.serverTimestamp() },
      { merge: true }
    );

    if (decision.shouldBlock && blockRef) {
      tx.set(blockRef, {
        blockedAt: FieldValue.serverTimestamp(),
        source: 'bot-shield',
        reason: decision.reason,
      });
    }

    return decision;
  });

  // Log writes happen OUTSIDE the transaction (an autoId add() can't
  // run inside one the same way, and this is a fire-and-forget
  // record, not state anything else reads transactionally) — only for
  // verdicts worth an owner ever seeing.
  if (result.result.verdict !== 'clean') {
    opts.siteRef
      .collection('botShieldLog')
      .add({
        visitorId: opts.isRealVisitorId ? opts.subjectId : null,
        subjectId: opts.subjectId,
        kind: opts.kind,
        verdict: result.result.verdict,
        countInWindow: result.result.countInWindow,
        reason: result.shouldBlock ? result.reason : null,
        blocked: result.shouldBlock,
        ts: FieldValue.serverTimestamp(),
      })
      .catch((err) => console.error('[botShieldEnforce] log write failed', err));
  }

  return {
    blocked: result.shouldBlock,
    newlyBlocked: result.shouldBlock,
    reason: result.shouldBlock ? result.reason : null,
  };
}
