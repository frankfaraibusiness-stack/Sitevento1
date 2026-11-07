'use client';

// hooks/useBotShield.ts
//
// Fetch/refresh/mutate lifecycle for the Bot Shield dashboard page
// (components/bot-shield/BotShieldPageClient.tsx), wrapping
// app/api/bot-shield (GET for config + log, POST for toggling a
// widget or unblocking a visitor). Same shape as useAccountLimits.ts:
// one hook owns the fetch state so the page component stays about
// rendering, not plumbing.
import { useCallback, useEffect, useRef, useState } from 'react';
import type { User } from 'firebase/auth';

export interface BotShieldLogEntry {
  id: string;
  visitorId: string | null;
  kind: 'pageview' | 'click' | 'form-submit' | null;
  verdict: 'moderate' | 'severe' | null;
  countInWindow: number | null;
  /** 'restrict' = time-boxed (self-expires), 'block' = permanent (needs Unblock), 'none' = flagged but no action taken. */
  action: 'none' | 'restrict' | 'block';
  reason: string | null;
  /** Legacy/derived: true whenever action !== 'none'. Kept so any older rendering that only checks `blocked` still degrades sensibly. */
  blocked: boolean;
  /** Epoch ms the restriction lifts — set only when action === 'restrict'. */
  restrictedUntil: number | null;
  /** Diagnostic only, not used anywhere for enforcement — coefficient of variation of recent event gaps; low = suspiciously machine-regular. */
  timingRegularity: number | null;
  /** Diagnostic only — true when the request's IP was flagged hosting/proxy by the network-intel check (lib/ipIntel.ts). */
  networkSuspect: boolean;
  ts: number | null;
}

export interface BotShieldThresholdState {
  windowMs: number;
  moderateCount: number;
  severeCount: number;
}

export type BotShieldThresholdOverrideState = Partial<BotShieldThresholdState>;

export interface BotShieldConfigState {
  refreshShieldEnabled: boolean;
  formFloodGuardEnabled: boolean;
  /** Only the fields the owner has explicitly customized — may be partial or absent per kind. */
  thresholds?: Partial<Record<'pageview' | 'click' | 'form-submit', BotShieldThresholdOverrideState>>;
}

export function useBotShield(user: User | null, siteId: string | null) {
  const [config, setConfig] = useState<BotShieldConfigState | null>(null);
  // What's ACTUALLY in effect right now for each kind — the owner's
  // override already merged with the built-in default and clamped.
  // This is what the dashboard form should pre-fill, so an owner who
  // never touched a field still sees the real number currently
  // protecting their site rather than a blank input.
  const [effectiveThresholds, setEffectiveThresholds] = useState<Record<'pageview' | 'click' | 'form-submit', BotShieldThresholdState> | null>(null);
  const [log, setLog] = useState<BotShieldLogEntry[]>([]);
  const [loading, setLoading] = useState(true);
  const [error, setError] = useState<string | null>(null);
  const inFlight = useRef(false);

  const refresh = useCallback(async () => {
    if (!user || !siteId || inFlight.current) return;
    inFlight.current = true;
    try {
      const idToken = await user.getIdToken();
      const params = new URLSearchParams({ idToken, siteId });
      const res = await fetch(`/api/bot-shield?${params.toString()}`, { cache: 'no-store' });
      const result = await res.json().catch(() => ({}));
      if (!res.ok || !result.ok) {
        setError(result.error || 'Could not load Bot Shield.');
        return;
      }
      setConfig(result.config);
      setEffectiveThresholds(result.effectiveThresholds || null);
      setLog(result.log || []);
      setError(null);
    } catch (err) {
      console.error('useBotShield refresh error', err);
      setError('Could not reach the server.');
    } finally {
      inFlight.current = false;
      setLoading(false);
    }
  }, [user, siteId]);

  useEffect(() => {
    if (!user || !siteId) {
      setConfig(null);
      setLog([]);
      setLoading(false);
      return;
    }
    setLoading(true);
    refresh();
    // Polled, same 60s cadence as useAccountLimits — this page is
    // meant to double as a live-ish "what's happening right now"
    // view during an active burst, without needing a websocket.
    const interval = setInterval(refresh, 60_000);
    return () => clearInterval(interval);
  }, [user, siteId, refresh]);

  const updateConfig = useCallback(
    async (patch: Partial<BotShieldConfigState>) => {
      if (!user || !siteId) return false;
      // Optimistic update so a toggle feels instant.
      setConfig((prev) => (prev ? { ...prev, ...patch } : prev));
      try {
        const idToken = await user.getIdToken();
        const res = await fetch('/api/bot-shield', {
          method: 'POST',
          headers: { 'Content-Type': 'application/json' },
          body: JSON.stringify({ idToken, siteId, action: 'update-config', ...patch }),
        });
        const result = await res.json().catch(() => ({}));
        if (!res.ok || !result.ok) {
          setError(result.error || 'Could not save that change.');
          refresh(); // revert to server truth
          return false;
        }
        return true;
      } catch (err) {
        console.error('useBotShield updateConfig error', err);
        refresh();
        return false;
      }
    },
    [user, siteId, refresh]
  );

  // Updates ONE kind's threshold fields at once (e.g. just 'click').
  // Only the fields actually passed are sent/merged — leaving a field
  // out keeps whatever was already stored (or the built-in default)
  // for it, same partial-merge contract as botShield's
  // BotShieldThresholdOverride. Optimistically updates both the raw
  // override AND the effective (resolved) view so the input reflects
  // the change immediately, before the round-trip confirms it.
  const updateThreshold = useCallback(
    async (kind: 'pageview' | 'click' | 'form-submit', patch: BotShieldThresholdOverrideState) => {
      if (!user || !siteId) return false;
      setConfig((prev) =>
        prev
          ? {
              ...prev,
              thresholds: { ...prev.thresholds, [kind]: { ...prev.thresholds?.[kind], ...patch } },
            }
          : prev
      );
      setEffectiveThresholds((prev) => (prev ? { ...prev, [kind]: { ...prev[kind], ...patch } } : prev));
      try {
        const idToken = await user.getIdToken();
        const res = await fetch('/api/bot-shield', {
          method: 'POST',
          headers: { 'Content-Type': 'application/json' },
          body: JSON.stringify({ idToken, siteId, action: 'update-config', thresholds: { [kind]: patch } }),
        });
        const result = await res.json().catch(() => ({}));
        if (!res.ok || !result.ok) {
          setError(result.error || 'Could not save that threshold.');
          refresh(); // revert to server truth
          return false;
        }
        refresh(); // pick up the server's clamped/resolved value, not just our optimistic guess
        return true;
      } catch (err) {
        console.error('useBotShield updateThreshold error', err);
        refresh();
        return false;
      }
    },
    [user, siteId, refresh]
  );

  const unblockVisitor = useCallback(
    async (visitorId: string) => {
      if (!user || !siteId) return false;
      try {
        const idToken = await user.getIdToken();
        const res = await fetch('/api/bot-shield', {
          method: 'POST',
          headers: { 'Content-Type': 'application/json' },
          body: JSON.stringify({ idToken, siteId, action: 'unblock-visitor', visitorId }),
        });
        const result = await res.json().catch(() => ({}));
        if (!res.ok || !result.ok) {
          setError(result.error || 'Could not unblock that visitor.');
          return false;
        }
        refresh();
        return true;
      } catch (err) {
        console.error('useBotShield unblockVisitor error', err);
        return false;
      }
    },
    [user, siteId, refresh]
  );

  return { config, effectiveThresholds, log, loading, error, refresh, updateConfig, updateThreshold, unblockVisitor };
}
