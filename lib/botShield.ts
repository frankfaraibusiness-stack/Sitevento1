// lib/botShield.ts
//
// ── "SECURITY BOT" — in-house behavioral abuse detection ──────────────
// (File/internal naming still says "Bot Shield" throughout this module
// and its siblings — botShieldConfig.ts, botShieldEnforce.ts,
// app/api/bot-shield — only the user-facing product name changed, to
// avoid a larger rename across routes/collections/Firestore paths.)
//
// A pure, rule-based scorer. Deliberately NOT a call to any LLM/AI
// provider (the ones lib/agent.ts already wires up for the AI Support
// Agent) — this runs on every single pageview, click, and form
// submission across every connected site, so it has to be nearly free
// and nearly instant. A model call per event at that volume would both
// burn through the request-per-minute/cost budget those providers are
// metered on, and add real latency to a tracking beacon that must
// stay fast. Everything here is arithmetic over timestamps already
// being recorded for other reasons — no new data collection, no
// network call, no external dependency.
//
// ── What it catches ───────────────────────────────────────────────────
// Current product spec, per event kind:
//   - pageview (refresh): 5 refreshes within 60s → RESTRICT for 1 hour.
//                          10 refreshes within 60s → instant BLOCK.
//   - click:               each click must be at least MIN_HUMAN_CLICK_GAP_MS
//                          apart (see below) — a script firing clicks
//                          back-to-back with no think-time between them
//                          never happens from a real pointer device, so
//                          that alone is itself bot-shaped evidence,
//                          independent of the rolling-window burst count.
//                          Burst counts beyond the click thresholds also
//                          restrict/block the same way as pageview.
//   - form-submit:         unchanged two-tier burst detection (see
//                          BOT_SHIELD_THRESHOLDS below) — not named in
//                          the current product ask, kept at its
//                          existing, more conservative numbers.
// This generalizes "too many events, too close together, for a human to
// have produced them" into one reusable evaluator, parameterized per
// EVENT KIND since each kind has a different honest human ceiling:
//   - pageview bursts    → Refresh & Click Shield, wired into app/api/track
//   - click bursts       → Refresh & Click Shield, wired into app/api/click-track
//   - form-submit bursts → Form Flood Guard, wired into the lead-capture
//     routes (email-capture, contact-us, appointment-booking, feedback-survey)
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
// ── Two outcomes, not one: RESTRICT vs BLOCK ──────────────────────────
// 'moderate' no longer waits for a second strike before acting — it
// restricts the visitor immediately, for RESTRICT_DURATION_MS (see
// below), using the exact same restrictedUntil mechanism the dashboard
// owner's own manual "Restrict" action already writes (see
// app/api/user-action's doRestrictVisitor and lib/types.ts's Visit.
// restrictedUntil) — so a restriction set by this engine expires and
// un-restricts itself automatically, no owner action required. 'severe'
// still blocks immediately and permanently (same as before — owner
// review/Unblock required). This is a deliberate escalation from the
// old two-strike-then-block model: the product ask is specifically
// "5 in 60s = restricted for 1 hour, 10 in 60s = instantly blocked",
// i.e. the FIRST moderate burst already acts (as a time-boxed
// restriction, not a permanent block), rather than waiting for a
// repeat.

export type BotShieldEventKind = 'pageview' | 'click' | 'form-submit';

export interface BotShieldThreshold {
  /** Rolling window length, in milliseconds, events are counted within. */
  windowMs: number;
  /** Event count within windowMs that triggers a RESTRICT (time-boxed). */
  moderateCount: number;
  /** Event count within windowMs that triggers an instant, permanent BLOCK. */
  severeCount: number;
}

// pageview: 5 refreshes / 60s → restrict, 10 refreshes / 60s → block —
// exact numbers from the product spec. click shares the same burst
// counts (same "5 = restrict, 10 = block" shape), but ALSO gets its own
// per-click human-timing check below (MIN_HUMAN_CLICK_GAP_MS), since a
// burst window alone can't catch a script that spaces its clicks out
// to just barely stay under the count — the real tell for a click
// specifically is "faster than human reaction/movement time between
// clicks", not just "how many within a minute". form-submit keeps its
// existing, independently-tuned numbers (not part of the current
// product ask; it's the more expensive write to guard, see
// formFloodGuard.ts).
export const BOT_SHIELD_THRESHOLDS: Record<BotShieldEventKind, BotShieldThreshold> = {
  pageview: { windowMs: 60_000, moderateCount: 5, severeCount: 10 },
  click: { windowMs: 60_000, moderateCount: 5, severeCount: 10 },
  'form-submit': { windowMs: 15_000, moderateCount: 3, severeCount: 6 },
};

// ── Click-specific: minimum human gap between clicks ──────────────────
// No rolling-window count can catch a bot that clicks just slowly
// enough to dodge the burst thresholds above — the actual human
// signature of a click is the TIME BETWEEN each one. A real person
// needs at least some perceptible interval to see something, move a
// pointer or finger, and press again; a script firing synthetic click
// events has no such floor and can clock in at a handful of
// milliseconds apart, every time, forever. 120ms is comfortably below
// even a fast double-click's inter-click gap (so legitimate rapid
// double-clicking on a button is never penalized) while still being
// far tighter than a human can sustain click after click after click —
// one fast click is normal, a whole run of clicks that close together
// is not. Checked inline inside evaluateBurst below (the 'click'
// branch), fed by the same recentTimestamps app/api/click-track
// already passes in for the burst count.
export const MIN_HUMAN_CLICK_GAP_MS = 120;

export type BotShieldVerdict = 'clean' | 'moderate' | 'severe';

export interface BotShieldResult {
  verdict: BotShieldVerdict;
  /** Events counted inside the window that produced this verdict. */
  countInWindow: number;
  threshold: BotShieldThreshold;
  /** Set only for 'click' when this event came in faster than MIN_HUMAN_CLICK_GAP_MS after the previous one — see evaluateBurst's 'click' branch. */
  subHumanGapMs?: number;
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

  const result: BotShieldResult = { verdict, countInWindow, threshold };

  if (kind === 'click' && recentTimestamps.length > 0) {
    const lastClick = Math.max(...recentTimestamps);
    const gap = nowTs - lastClick;
    if (gap < MIN_HUMAN_CLICK_GAP_MS) {
      result.subHumanGapMs = gap;
      // A single sub-human gap is, on its own, already stronger
      // evidence than the burst count alone (see MIN_HUMAN_CLICK_GAP_MS
      // header comment) — escalate to at least 'moderate' so one
      // too-fast click pair restricts rather than waiting for the
      // count threshold to separately catch up. Never downgrades an
      // already-'severe' verdict from the count check.
      if (verdict === 'clean') result.verdict = 'moderate';
    }
  }

  return result;
}

/**
 * Trims a timestamp list down to only what evaluateBurst could still
 * possibly need, so the array a caller persists (one per visitor,
 * written back to Firestore on every event) never grows unbounded.
 * Keeps up to MAX_TRACKED_EVENTS most-recent entries newer than
 * `olderThanMs` ago — generous enough to span the longest configured
 * window (pageview/click's 60s) twice over, so a slightly bursty-but-
 * legitimate visitor's older, now-irrelevant events fall off on their
 * own rather than needing a separate cleanup job.
 */
const MAX_TRACKED_EVENTS = 60;
const PRUNE_LOOKBACK_MS = 120_000;

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

// How long a 'moderate' verdict restricts a visitor for — exactly the
// product spec's "restricted for 1 hour". Written through the SAME
// restrictedUntil field the owner's own manual Restrict action uses
// (app/api/user-action's doRestrictVisitor), so it self-expires with
// no extra cleanup job and the dashboard's existing isRestricted()
// check (hooks/useActiveSiteData.ts) already understands it.
export const RESTRICT_DURATION_MS = 60 * 60 * 1000;

export interface BotShieldState {
  /** Recent event timestamps, already pruned — see pruneWindow. */
  events: number[];
}

export type BotShieldAction = 'none' | 'restrict' | 'block';

export interface BotShieldDecision {
  result: BotShieldResult;
  /** 'restrict' = time-boxed (RESTRICT_DURATION_MS); 'block' = immediate and permanent; 'none' = clean. */
  action: BotShieldAction;
  /** The reason string written to the restrict/block/activity log — see botShieldEnforce.ts's applyBotShield. */
  reason: string;
  /** The updated state to persist (events), already pruned. */
  nextState: BotShieldState;
}

export function decide(
  kind: BotShieldEventKind,
  state: BotShieldState | undefined,
  nowTs: number
): BotShieldDecision {
  const prunedEvents = pruneWindow(state?.events, nowTs);
  const result = evaluateBurst(kind, prunedEvents, nowTs);

  let action: BotShieldAction = 'none';
  let reason = '';

  if (result.verdict === 'severe') {
    action = 'block';
    reason = `${result.countInWindow} ${kindLabel(kind)} in ${(result.threshold.windowMs / 1000).toFixed(0)}s — far beyond human pace.`;
  } else if (result.verdict === 'moderate') {
    action = 'restrict';
    if (typeof result.subHumanGapMs === 'number') {
      reason = `Clicked ${result.subHumanGapMs}ms after the previous click — faster than a human pointer/tap can move, let alone decide.`;
    } else {
      reason = `${result.countInWindow} ${kindLabel(kind)} in ${(result.threshold.windowMs / 1000).toFixed(0)}s — restricted for ${(RESTRICT_DURATION_MS / 3_600_000).toFixed(0)}h.`;
    }
  }

  return {
    result,
    action,
    reason,
    nextState: {
      events: [...prunedEvents, nowTs],
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
