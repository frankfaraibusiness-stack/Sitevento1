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
  reason: string | null;
  blocked: boolean;
  ts: number | null;
}

export interface BotShieldConfigState {
  refreshShieldEnabled: boolean;
  formFloodGuardEnabled: boolean;
}

export function useBotShield(user: User | null, siteId: string | null) {
  const [config, setConfig] = useState<BotShieldConfigState | null>(null);
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

  return { config, log, loading, error, refresh, updateConfig, unblockVisitor };
}
