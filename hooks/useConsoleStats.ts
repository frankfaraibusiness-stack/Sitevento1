// hooks/useConsoleStats.ts
//
// Polls app/api/platform-stats on an interval so the Console overview
// dashboard reads as "real-time" without needing a Firestore listener
// (the data it shows is aggregated server-side, not a live per-doc
// snapshot, so polling a cheap aggregation route is the right fit —
// see that route's own header for what it aggregates and why).
'use client';

import { useCallback, useEffect, useRef, useState } from 'react';

export interface ConsoleSeriesPoint {
  date: string;
  visits: number;
  uniqueVisitors: number;
  signups: number;
  newUsers: number;
}

export interface ConsoleStats {
  totals: {
    users: number;
    sitesConnected: number;
    verifiedSites: number;
    platformVisitsAllTime: number;
    signupsAllTime: number;
  };
  today: {
    newUsers: number;
    platformVisits: number;
    uniqueVisitors: number;
    signups: number;
  };
  conversion: {
    ratePct: number;
    windowDays: number;
  };
  series: ConsoleSeriesPoint[];
}

const POLL_INTERVAL_MS = 30_000;

export function useConsoleStats() {
  const [stats, setStats] = useState<ConsoleStats | null>(null);
  const [loading, setLoading] = useState(true);
  const [error, setError] = useState<string | null>(null);
  const [lastUpdated, setLastUpdated] = useState<Date | null>(null);
  const timerRef = useRef<ReturnType<typeof setInterval>>();

  const fetchStats = useCallback(async (isBackground: boolean) => {
    if (!isBackground) setLoading(true);
    try {
      const res = await fetch('/api/platform-stats', { cache: 'no-store' });
      const data = await res.json().catch(() => ({}));
      if (!res.ok || !data?.ok) {
        setError(data?.error || 'Could not load platform stats.');
        return;
      }
      setError(null);
      setStats({ totals: data.totals, today: data.today, conversion: data.conversion, series: data.series });
      setLastUpdated(new Date());
    } catch (err) {
      setError('Could not reach the server.');
    } finally {
      setLoading(false);
    }
  }, []);

  useEffect(() => {
    fetchStats(false);
    timerRef.current = setInterval(() => fetchStats(true), POLL_INTERVAL_MS);
    return () => clearInterval(timerRef.current);
  }, [fetchStats]);

  const refresh = useCallback(() => fetchStats(true), [fetchStats]);

  return { stats, loading, error, lastUpdated, refresh };
}
