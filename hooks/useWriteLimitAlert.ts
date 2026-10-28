// hooks/useWriteLimitAlert.ts
//
// Drives WriteLimitAlertModal's visibility. The bug this fixes: when an
// account's daily write cap runs low or hits zero, NOTHING in the UI
// says so beyond a small inline chip the user has to notice on their
// own (DailyLimitCard) — a site owner watching "visitors are logging"
// in their head has no idea their actual writes stopped being counted
// (or started drawing from their wallet) until they go looking. This
// hook turns writeUsage (hooks/useAccountLimits.ts) into a one-time,
// can't-miss modal instead.
//
// ── Severity ───────────────────────────────────────────────────────
//   'red'    — limit fully reached (remaining === 0, writes are being
//              blocked outright, or are drawing from the wallet right
//              now if pay-as-you-go is on).
//   'yellow' — less than 20% of today's daily cap remains, but some is
//              still free.
//   null     — anything else (plenty of headroom, or an unlimited
//              plan with limit === null, which never alerts).
//
// ── Show-once-per-day ────────────────────────────────────────────────
// Each severity is shown at most once per UTC day per account, tracked
// in localStorage (not Firestore — this is purely a "don't nag the
// same browser tab twice" UX guard, never enforcement, so it's fine if
// it resets on a different device/browser). Keyed by
// `uid:YYYY-MM-DD:severity` so:
//   - dismissing 'yellow' does NOT suppress 'red' later the same day —
//     a real escalation (e.g. a traffic spike burning through the last
//     20%) still interrupts once, which is the whole point of the red
//     tier existing separately from yellow.
//   - the key naturally resets at UTC midnight, matching the usage
//     doc's own daily reset (lib/serverAuth.ts's todayKey()) — no
//     separate cleanup needed, stale keys from past days just never
//     match again (and are swept on mount, see pruneOldKeys below, so
//     localStorage doesn't grow unbounded over months of daily use).
'use client';

import { useEffect, useMemo, useState } from 'react';
import type { WriteUsage } from './useAccountLimits';

export type WriteLimitSeverity = 'yellow' | 'red';

const STORAGE_PREFIX = 'sv:writeLimitAlert:';
const YELLOW_THRESHOLD_PCT = 20; // show 'yellow' once remaining% drops below this

function todayUtcKey(): string {
  return new Date().toISOString().slice(0, 10);
}

function severityFor(writeUsage: WriteUsage | null | undefined): WriteLimitSeverity | null {
  if (!writeUsage || writeUsage.limit === null || writeUsage.limit === 0) return null; // unlimited plan, or no cap data yet
  const { used, limit } = writeUsage;
  const remaining = Math.max(0, limit - used);
  if (remaining <= 0) return 'red';
  const remainingPct = (remaining / limit) * 100;
  if (remainingPct < YELLOW_THRESHOLD_PCT) return 'yellow';
  return null;
}

function storageKey(uid: string, severity: WriteLimitSeverity): string {
  return `${STORAGE_PREFIX}${uid}:${todayUtcKey()}:${severity}`;
}

function wasShownToday(uid: string, severity: WriteLimitSeverity): boolean {
  try {
    return window.localStorage.getItem(storageKey(uid, severity)) === '1';
  } catch {
    return false; // storage unavailable (private mode, blocked) — fail open, show it
  }
}

function markShownToday(uid: string, severity: WriteLimitSeverity) {
  try {
    window.localStorage.setItem(storageKey(uid, severity), '1');
  } catch {
    // best-effort only — a failed write just means it may show again
  }
}

/** Removes this feature's localStorage keys from days other than today, so a long-lived browser profile doesn't accumulate one key per account per day forever. */
function pruneOldKeys() {
  try {
    const today = todayUtcKey();
    const toRemove: string[] = [];
    for (let i = 0; i < window.localStorage.length; i++) {
      const key = window.localStorage.key(i);
      if (key && key.startsWith(STORAGE_PREFIX) && !key.includes(`:${today}:`)) {
        toRemove.push(key);
      }
    }
    toRemove.forEach((k) => window.localStorage.removeItem(k));
  } catch {
    // best-effort only
  }
}

export interface WriteLimitAlertState {
  /** Non-null exactly when the modal should be visible right now. */
  severity: WriteLimitSeverity | null;
  /** Call when the user dismisses the modal — records today's "seen" flag for the current severity so it won't reopen on its own until tomorrow (or until it escalates from yellow to red). */
  dismiss: () => void;
}

/** `uid` scopes the "seen today" flag per account (shared browser / multiple accounts signed in across tabs over time shouldn't cross-suppress each other). Pass `writeUsage` straight from useAccountLimits(). */
export function useWriteLimitAlert(uid: string | null, writeUsage: WriteUsage | null | undefined): WriteLimitAlertState {
  const computedSeverity = useMemo(() => severityFor(writeUsage), [writeUsage]);
  const [dismissedSeverity, setDismissedSeverity] = useState<WriteLimitSeverity | null>(null);

  useEffect(() => {
    pruneOldKeys();
  }, []);

  // Reset the "dismissed this session" flag whenever the computed
  // severity itself changes — so going yellow -> red (escalation)
  // clears a yellow-dismissal and lets red show, and so does a fresh
  // day's yellow after yesterday's was dismissed (new severityFor
  // value because writeUsage reset, even though the enum value
  // 'yellow' repeats — the localStorage key is what actually
  // disambiguates by day, this just clears the in-memory latch).
  useEffect(() => {
    setDismissedSeverity(null);
  }, [computedSeverity]);

  if (!uid || !computedSeverity) {
    return { severity: null, dismiss: () => {} };
  }

  const alreadyShownToday = wasShownToday(uid, computedSeverity);
  const visible = computedSeverity !== dismissedSeverity && !alreadyShownToday;

  return {
    severity: visible ? computedSeverity : null,
    dismiss: () => {
      markShownToday(uid, computedSeverity);
      setDismissedSeverity(computedSeverity);
    },
  };
}
