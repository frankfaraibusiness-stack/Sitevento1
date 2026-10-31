// lib/botShield.ts
//
// ── "Bot Shield" — in-house behavioral abuse detection ───────────────
//
// A pure, rule-based scorer. Deliberately NOT a call to any LLM/AI
// provider (the ones lib/agent.ts already wires up for the AI Support
// Agent) — this runs on every single pageview and form submission
// across every connected site, so it has to be nearly free and
// nearly instant. A model call per event at that volume would both
// burn through the request-per-minute/cost budget those providers are
// metered on, and add real latency to a tracking beacon that must
// stay fast. Everything here is arithmetic over timestamps already
// being recorded for other reasons — no new data collection, no
// network call, no external dependency.
//
// ── What it catches ───────────────────────────────────────────────────
// The product ask was specifically: "5 refreshes in 10 seconds" and
// "10 clicks in 5 seconds" — both textbook signs of a script replaying
// a page or a submission over and over, not a human. Real visitors
// don't reload a page 5 times in 10 seconds or click 10 times in 5
// seconds; both require literally zero think-time between actions,
// which only a loop produces. This generalizes that one idea — "too
// many events, too close together, for a human to have produced them"
// — into one reusable evaluator, parameterized per EVENT KIND (page
// view vs. click vs. form submit) since each kind has a different
// honest human ceiling:
//   - pageview bursts  → BotShieldWidget #1 (Refresh/Click Shield),
//     wired into app/api/track
//   - form-submit bursts → BotShieldWidget #2 (Form Flood Guard),
//     wired into the lead-capture routes (email-capture, contact-us,
//     appointment-booking, feedback-survey)
//
// ── Design: a rolling window, not a running total ────────────────────
// This does NOT count "how many times has this visitor ever done X" —
// a real returning visitor can legitimately view 50 pages over an
// hour. It counts "how many times in the last N seconds", which is
// what actually distinguishes automated replay from human browsing.
// The caller supplies the recent timestamps (already trimmed to a
// generous lookback window — see pruneWindow below) and this function
// is a pure, synchronous, side-effect-free judgment over them: easy to
// unit-test, easy to reuse from a brand-new route later without
// dragging in Firestore or request/response types.
//
// ── Severity, not just a boolean ──────────────────────────────────────
// A single burst that barely crosses the threshold (6 refreshes in 10s)
// is treated differently from an extreme one (40 refreshes in 10s) —
// see SEVERITY below. Only 'severe' auto-blocks on the FIRST offense;
// 'moderate' requires a second strike within the strike window before
// blocking (see STRIKE_EXPIRY_MS) — real humans occasionally mash
// refresh once or double/triple-click a stuck button, and this engine
// is explicitly chartered to act automatically with no human review,
// so it has to be conservative enough not to lock out real visitors on
// a single borderline burst.

export type BotShieldEventKind = 'pageview' | 'click' | 'form-submit';

export interface BotShieldThreshold {
  /** Rolling window length, in milliseconds, events are counted within. */
  windowMs: number;
  /** Event count within windowMs that counts as 'moderate' (a warning strike). */
  moderateCount: number;
  /** Event count within windowMs that counts as 'severe' (immediate block). */
  severeCount: number;
}

// The two concrete thresholds named in the product ask, plus one for
// form submissions (not explicitly named, but the same reasoning
// applies, and it's the more expensive write to guard — see
// formFloodGuard.ts). Numbers are deliberately a little above the
// examples given ("5 refreshes in 10s", "10 clicks in 5s") so the
// 'moderate' tier catches exactly the examples, and 'severe' requires
// a clearer, more obviously-automated burst before acting on a single
// strike alone.
export const BOT_SHIELD_THRESHOLDS: Record<BotShieldEventKind, BotShieldThreshold> = {
  pageview: { windowMs: 10_000, moderateCount: 5, severeCount: 10 },
  click: { windowMs: 5_000, moderateCount: 10, severeCount: 20 },
  'form-submit': { windowMs: 15_000, moderateCount: 3, severeCount: 6 },
};

export type BotShieldVerdict = 'clean' | 'moderate' | 'severe';

export interface BotShieldResult {
  verdict: BotShieldVerdict;
  /** Events counted inside the window that produced this verdict. */
  countInWindow: number;
  threshold: BotShieldThreshold;
}

/**
 * Pure judgment over a sorted-or-unsorted list of recent event
 * timestamps (ms since epoch) PLUS the event that just happened
 * (nowTs). Does not mutate its input. Safe to call on every request —
 * O(n) over however many timestamps the caller kept (see
 * MAX_TRACKED_EVENTS below for the cap that keeps n small).
 */
export function evaluateBurst(
  kind: BotShieldEventKind,
  recentTimestamps: number[],
  nowTs: number
): BotShieldResult {
  const threshold = BOT_SHIELD_THRESHOLDS[kind];
  const windowStart = nowTs - threshold.windowMs;
  // +1 for the current event itself — a caller passes the events
  // STRICTLY BEFORE now; the one happening right now always counts
  // toward its own burst.
  const countInWindow = recentTimestamps.filter((t) => t > windowStart && t <= nowTs).length + 1;

  let verdict: BotShieldVerdict = 'clean';
  if (countInWindow >= threshold.severeCount) verdict = 'severe';
  else if (countInWindow >= threshold.moderateCount) verdict = 'moderate';

  return { verdict, countInWindow, threshold };
}

/**
 * Trims a timestamp list down to only what evaluateBurst could still
 * possibly need, so the array a caller persists (one per visitor,
 * written back to Firestore on every event) never grows unbounded.
 * Keeps up to MAX_TRACKED_EVENTS most-recent entries newer than
 * `olderThanMs` ago — generous enough to span the longest configured
 * window (form-submit's 15s) many times over, so a slightly bursty-but-
 * legitimate visitor's older, now-irrelevant events fall off on their
 * own rather than needing a separate cleanup job.
 */
const MAX_TRACKED_EVENTS = 40;
const PRUNE_LOOKBACK_MS = 60_000;

export function pruneWindow(existing: number[] | undefined, nowTs: number): number[] {
  if (!existing || !existing.length) return [];
  const cutoff = nowTs - PRUNE_LOOKBACK_MS;
  const kept = existing.filter((t) => t > cutoff);
  // If still too many (a genuinely very active visitor), keep only the
  // most recent MAX_TRACKED_EVENTS rather than growing forever.
  if (kept.length > MAX_TRACKED_EVENTS) {
    kept.sort((a, b) => a - b);
    return kept.slice(kept.length - MAX_TRACKED_EVENTS);
  }
  return kept;
}

// ── Strikes: how a 'moderate' verdict becomes a block ─────────────────
//
// A 'severe' verdict blocks immediately — no ambiguity, no second
// chance needed (see threshold rationale above). A 'moderate' verdict
// is recorded as a strike; a SECOND moderate-or-worse strike within
// STRIKE_EXPIRY_MS of the first is what actually triggers an
// auto-block. This two-strike rule is what keeps the system safe to
// run with zero human review: a one-off mashed refresh or a flaky
// double-submit never costs a real visitor their access, but a
// pattern that repeats within the same couple of minutes — which an
// honest visitor essentially never produces twice — does.
export const STRIKE_EXPIRY_MS = 120_000;
export const STRIKES_BEFORE_BLOCK = 2;

export interface BotShieldState {
  /** Recent event timestamps, already pruned — see pruneWindow. */
  events: number[];
  /** Timestamps of past 'moderate'-or-worse verdicts, not yet expired. */
  strikes: number[];
}

export interface BotShieldDecision {
  result: BotShieldResult;
  /** True exactly when this event should result in an auto-block. */
  shouldBlock: boolean;
  /** The reason string written to the block/activity log — see botShieldEnforce.ts's applyBotShield. */
  reason: string;
  /** The updated state to persist (events + strikes), already pruned. */
  nextState: BotShieldState;
}

export function decide(
  kind: BotShieldEventKind,
  state: BotShieldState | undefined,
  nowTs: number
): BotShieldDecision {
  const prunedEvents = pruneWindow(state?.events, nowTs);
  const result = evaluateBurst(kind, prunedEvents, nowTs);

  const prunedStrikes = (state?.strikes || []).filter((t) => t > nowTs - STRIKE_EXPIRY_MS);

  let shouldBlock = false;
  let reason = '';
  let nextStrikes = prunedStrikes;

  if (result.verdict === 'severe') {
    shouldBlock = true;
    reason = `${result.countInWindow} ${kindLabel(kind)} in ${(result.threshold.windowMs / 1000).toFixed(0)}s — far beyond human pace.`;
  } else if (result.verdict === 'moderate') {
    nextStrikes = [...prunedStrikes, nowTs];
    if (nextStrikes.length >= STRIKES_BEFORE_BLOCK) {
      shouldBlock = true;
      reason = `Repeated bursts of ${result.countInWindow}+ ${kindLabel(kind)} within ${(result.threshold.windowMs / 1000).toFixed(0)}s, ${nextStrikes.length} times in the last ${(STRIKE_EXPIRY_MS / 1000).toFixed(0)}s.`;
    }
  }

  return {
    result,
    shouldBlock,
    reason,
    nextState: {
      events: [...prunedEvents, nowTs],
      // A block clears strikes (the account is already dealt with;
      // no need to keep counting toward a second block).
      strikes: shouldBlock ? [] : nextStrikes,
    },
  };
}

function kindLabel(kind: BotShieldEventKind): string {
  switch (kind) {
    case 'pageview':
      return 'page refreshes';
    case 'click':
      return 'clicks';
    case 'form-submit':
      return 'form submissions';
  }
}
