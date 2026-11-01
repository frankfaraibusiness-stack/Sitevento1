// hooks/useMonetizationStats.ts
//
// Real data for the Monetization dashboard, replacing
// lib/monetization-stats.ts's mock generators. Reads two live
// Firestore sources (client SDK, same onSnapshot pattern every other
// hooks/useSite*.ts in this codebase already uses — reads are safe
// under the existing per-uid rules, see firestore.rules):
//
//   1. users/{uid}/sites/{siteId}/adEarnings/{day} (the FULL
//      subcollection, every day ever recorded) — one doc per UTC day,
//      written by app/api/ad-track/route.ts's billing transaction.
//   2. users/{uid}/sites/{siteId}/adActivity (most recent 20 docs,
//      ordered by ts desc) — the publisher-readable recent-events
//      feed, written alongside adEarnings by that same route (see
//      lib/adPool.ts's AdActivityEntry comment for why this is a
//      SEPARATE log from adPool/{adId}/events, which only the
//      advertiser can read).
//
// Derives, via useMemo, the exact shapes
// lib/monetization-stats.ts's mock functions already produce
// (MonetizationSummary, DayPoint[], AdTypeBreakdown[], CountryRow[],
// LogRow[]) — so MonetizationStatGrid, MonetizationBalanceCard,
// MonetizationTrendChart, MonetizationAdTypeChart,
// MonetizationCountryChart and MonetizationActivityLog need ZERO prop
// changes; only MonetizationDashboard.tsx's data source changes (see
// that file).
//
// ── Balance is lifetime, not period-scoped ─────────────────────────
// summary.balanceUsd sums earningsUsd across EVERY day doc ever
// recorded, not just the days inside `period` — a publisher's
// "available balance" is real accumulated earnings, confirmed
// explicitly as the intended behavior, not a period-windowed number.
// Everything else derived below (impressions, clicks, CPM, country/
// format breakdowns) IS scoped to `period`'s trailing window.
//
// ── CPM is realized, not an advertiser-facing estimate ─────────────
// summary.cpmUsd = (period earnings / period impressions) * 1000 —
// the actual blended rate this site earned, not a lookup into
// lib/adRates.ts's country-tier table (that table prices what an
// ADVERTISER pays before any impressions exist; this is what the
// PUBLISHER actually realized from real, already-billed traffic).
//
// ── No fabricated deltas ────────────────────────────────────────────
// A real period-over-period delta needs a prior-period comparison
// this pass doesn't build (would mean fetching a second, shifted
// window and diffing) — rather than inventing a number, every
// `*DeltaPct` field here is hardcoded 0. Revisit once a real
// prior-period comparison exists.
'use client';

import { useEffect, useMemo, useState } from 'react';
import { collection, onSnapshot, orderBy, query, limit as fsLimit, Timestamp } from 'firebase/firestore';
import { getFirebaseDb } from '@/lib/firebase';
import { getCountryName } from '@/lib/countries';
import { AD_TYPES } from '@/lib/monetization';
import type { PublisherDayEarnings, AdActivityEntry } from '@/lib/adPool';
import {
  type StatsPeriod,
  type MonetizationSummary,
  type DayPoint,
  type AdTypeBreakdown,
  type CountryRow,
  type LogRow,
} from '@/lib/monetization-stats';

const PERIOD_DAYS: Record<StatsPeriod, number> = { '7d': 7, '30d': 30, '90d': 90 };
const ACTIVITY_LIMIT = 20;

// ISO 3166-1 alpha-2 -> flag emoji via the regional-indicator-symbol
// trick (each letter A-Z maps to U+1F1E6..U+1F1FF in order) — no flag
// data/dependency exists anywhere in this codebase
// (lib/countries.ts's CountryDef is code+name only), and every code
// this ever sees already comes from lib/countries.ts's COUNTRIES list
// or ad-track's 'UNKNOWN' fallback, which the guard below handles.
function flagForCountryCode(code: string): string {
  if (!/^[A-Z]{2}$/.test(code)) return '🏳️';
  const base = 0x1f1e6;
  const chars = [...code].map((c) => String.fromCodePoint(base + (c.charCodeAt(0) - 65)));
  return chars.join('');
}

function formatLog(ad: AdActivityEntry & { id: string }): LogRow {
  const typeDef = AD_TYPES.find((t) => t.id === ad.format);
  const ts = ad.ts instanceof Timestamp ? ad.ts.toDate() : null;
  return {
    id: ad.id,
    timestamp: ts ? relativeTime(ts) : 'Just now',
    adType: typeDef?.label || ad.format,
    event: ad.event,
    country: ad.country === 'UNKNOWN' ? 'Unknown' : getCountryName(ad.country),
    flag: ad.country === 'UNKNOWN' ? '🏳️' : flagForCountryCode(ad.country),
  };
}

function relativeTime(date: Date): string {
  const diffMs = Date.now() - date.getTime();
  const mins = Math.floor(diffMs / 60_000);
  if (mins < 1) return 'Just now';
  if (mins < 60) return `${mins}m ago`;
  const hours = Math.floor(mins / 60);
  if (hours < 24) return `${hours}h ago`;
  const days = Math.floor(hours / 24);
  return `${days}d ago`;
}

// UTC day-key strings (YYYY-MM-DD) for the trailing `count` days
// ending today, oldest first — same bucketing convention ad-track's
// todayKey() writes with, so a straight string compare against each
// adEarnings doc's id tells us whether it falls inside the window.
function trailingDayKeys(count: number): string[] {
  const out: string[] = [];
  const d = new Date();
  for (let i = count - 1; i >= 0; i--) {
    const day = new Date(Date.UTC(d.getUTCFullYear(), d.getUTCMonth(), d.getUTCDate() - i));
    out.push(day.toISOString().slice(0, 10));
  }
  return out;
}

export function useMonetizationStats(uid: string | null, siteId: string | null, period: StatsPeriod) {
  const [earningsByDay, setEarningsByDay] = useState<Record<string, PublisherDayEarnings>>({});
  const [activity, setActivity] = useState<(AdActivityEntry & { id: string })[]>([]);
  const [loading, setLoading] = useState(true);

  useEffect(() => {
    if (!uid || !siteId) {
      setEarningsByDay({});
      setActivity([]);
      setLoading(false);
      return;
    }
    setLoading(true);
    const db = getFirebaseDb();

    const earningsRef = collection(db, 'users', uid, 'sites', siteId, 'adEarnings');
    const unsubEarnings = onSnapshot(
      earningsRef,
      (snap) => {
        const next: Record<string, PublisherDayEarnings> = {};
        snap.forEach((d) => {
          next[d.id] = d.data() as PublisherDayEarnings;
        });
        setEarningsByDay(next);
        setLoading(false);
      },
      (err) => {
        console.error('monetization stats: adEarnings snapshot error', err);
        setLoading(false);
      }
    );

    const activityRef = query(
      collection(db, 'users', uid, 'sites', siteId, 'adActivity'),
      orderBy('ts', 'desc'),
      fsLimit(ACTIVITY_LIMIT)
    );
    const unsubActivity = onSnapshot(
      activityRef,
      (snap) => {
        setActivity(snap.docs.map((d) => ({ id: d.id, ...(d.data() as AdActivityEntry) })));
      },
      (err) => {
        console.error('monetization stats: adActivity snapshot error', err);
      }
    );

    return () => {
      unsubEarnings();
      unsubActivity();
    };
  }, [uid, siteId]);

  const result = useMemo(() => {
    const days = trailingDayKeys(PERIOD_DAYS[period]);
    const periodDocs = days.map((key) => ({ key, data: earningsByDay[key] }));

    // ── Daily series ──────────────────────────────────────────────
    const series: DayPoint[] = periodDocs.map(({ key, data }) => {
      const d = new Date(`${key}T00:00:00Z`);
      return {
        label: d.toLocaleDateString(undefined, { month: 'short', day: 'numeric', timeZone: 'UTC' }),
        impressions: data?.impressions || 0,
        clicks: data?.clicks || 0,
      };
    });

    const periodImpressions = series.reduce((sum, p) => sum + p.impressions, 0);
    const periodClicks = series.reduce((sum, p) => sum + p.clicks, 0);
    const periodEarnings = periodDocs.reduce((sum, { data }) => sum + (data?.earningsUsd || 0), 0);

    // Lifetime balance — every day doc ever recorded, not just the
    // selected period's window (see header comment).
    const balanceUsd = Object.values(earningsByDay).reduce((sum, d) => sum + (d.earningsUsd || 0), 0);

    // ── Country breakdown (period-scoped) ────────────────────────
    const countryTotals: Record<string, { impressions: number; clicks: number; earningsUsd: number }> = {};
    for (const { data } of periodDocs) {
      if (!data?.byCountry) continue;
      for (const [code, v] of Object.entries(data.byCountry)) {
        const prev = countryTotals[code] || { impressions: 0, clicks: 0, earningsUsd: 0 };
        countryTotals[code] = {
          impressions: prev.impressions + (v.impressions || 0),
          clicks: prev.clicks + (v.clicks || 0),
          earningsUsd: prev.earningsUsd + (v.earningsUsd || 0),
        };
      }
    }
    const countryEntries = Object.entries(countryTotals).sort((a, b) => b[1].impressions - a[1].impressions);
    const countryImpressionTotal = countryEntries.reduce((sum, [, v]) => sum + v.impressions, 0) || 1;
    const countryData: CountryRow[] = countryEntries.map(([code, v]) => ({
      code,
      flag: code === 'UNKNOWN' ? '🏳️' : flagForCountryCode(code),
      name: code === 'UNKNOWN' ? 'Unknown' : getCountryName(code),
      impressions: v.impressions,
      share: v.impressions / countryImpressionTotal,
    }));
    const topCountry = countryEntries[0];

    // ── Ad-type/format breakdown (period-scoped) ─────────────────
    const formatTotals: Record<string, { impressions: number; clicks: number }> = {};
    for (const { data } of periodDocs) {
      if (!data?.byFormat) continue;
      for (const [id, v] of Object.entries(data.byFormat)) {
        const prev = formatTotals[id] || { impressions: 0, clicks: 0 };
        formatTotals[id] = { impressions: prev.impressions + (v.impressions || 0), clicks: prev.clicks + (v.clicks || 0) };
      }
    }
    const adTypeData: AdTypeBreakdown[] = Object.entries(formatTotals)
      .map(([id, v]) => {
        const typeDef = AD_TYPES.find((t) => t.id === id);
        return {
          id,
          label: typeDef?.label || id,
          impressions: v.impressions,
          ctr: v.impressions > 0 ? v.clicks / v.impressions : 0,
        };
      })
      .sort((a, b) => b.impressions - a.impressions);

    // ── Summary ───────────────────────────────────────────────────
    const summary: MonetizationSummary = {
      impressions: periodImpressions,
      impressionsDeltaPct: 0,
      cpmUsd: periodImpressions > 0 ? (periodEarnings / periodImpressions) * 1000 : 0,
      cpmDeltaPct: 0,
      clicks: periodClicks,
      clicksDeltaPct: 0,
      topCountry: topCountry ? (topCountry[0] === 'UNKNOWN' ? 'Unknown' : getCountryName(topCountry[0])) : '—',
      topCountryFlag: topCountry ? (topCountry[0] === 'UNKNOWN' ? '🏳️' : flagForCountryCode(topCountry[0])) : '',
      topCountryShare: topCountry ? topCountry[1].impressions / countryImpressionTotal : 0,
      balanceUsd,
      pendingPayoutUsd: 0,
      nextPayoutDate: 'Once your balance reaches $25',
    };

    const logs: LogRow[] = activity.map(formatLog);

    const hasAnyData = Object.keys(earningsByDay).length > 0 || activity.length > 0;

    return { summary, series, adTypeData, countryData, logs, hasAnyData };
  }, [earningsByDay, activity, period]);

  return { ...result, loading };
}
