'use client';

// components/analytics/AnalyticsDataContext.tsx
//
// One place that owns "which site + which period" for the analytics page and
// the real data loaded for it. The header's date picker writes the selection
// (via AnalyticsPage); every section below reads from useAnalyticsData().
//
// Data comes from the SAME hook the main dashboard uses
// (hooks/useDashboardData.ts), so it inherits its read-saving rules: one
// bounded visits query, exact count() totals, a 60s poll only while the
// window includes "now", no polling for past windows. Nothing here adds a
// new Firestore query path.
import { createContext, useCallback, useContext, useMemo, type ReactNode } from 'react';
import type { User } from 'firebase/auth';
import type { Site } from '@/lib/types';
import type { PlanLimits } from '@/lib/plans';
import type { ResolvedRange } from '@/lib/dashboardRange';
import { useDashboardData, type DashboardData, type DashboardStatus } from '@/hooks/useDashboardData';
import { previousWindow, type RangeSel } from './analyticsUtils';
import { useAnalyticsExtras, useRecentActivity, type AnalyticsExtras } from './useAnalyticsExtras';
import { buildModel, type AnalyticsModel } from './model/build';

export interface AnalyticsDataValue {
  site: Site | null;
  /** The (day-rolled) selection the picker shows. */
  sel: RangeSel;
  /** The same selection as the query window (end exclusive, prev window, hourly flag…). */
  range: ResolvedRange;
  compare: boolean;
  /** Window directly before `sel`, when compare is on and it exists. */
  prevWindow: { from: Date; to: Date } | null;
  /** The viewer's plan limits; null while loading or if they couldn't be read. */
  limits: PlanLimits | null;
  data: DashboardData;
  /** Backend events, custom events, errors, uptime… for the period (see useAnalyticsExtras). */
  extras: AnalyticsExtras;
  extrasLoading: boolean;
  /** Every section's real, computed view-model. */
  model: AnalyticsModel;
  status: DashboardStatus;
  /** True while the first load for the current site/period is still running. */
  loading: boolean;
  refreshing: boolean;
  error: string | null;
  updatedAt: number | null;
  refresh: () => void;
}

const Ctx = createContext<AnalyticsDataValue | null>(null);

export function useAnalyticsData(): AnalyticsDataValue {
  const v = useContext(Ctx);
  if (!v) throw new Error('useAnalyticsData must be used inside <AnalyticsDataProvider>');
  return v;
}

interface Props {
  user: User;
  site: Site | null;
  sel: RangeSel;
  range: ResolvedRange;
  compare: boolean;
  limits: PlanLimits | null;
  /** Hold the fetch until the plan's history window is known, so a limited plan never downloads a wider range first. */
  ready: boolean;
  children: ReactNode;
}

export function AnalyticsDataProvider({ user, site, sel, range, compare, limits, ready, children }: Props) {
  const siteId = ready ? (site?.id ?? null) : null;
  const { data, status, refreshing, error, updatedAt, refresh: refreshVisits } = useDashboardData(user.uid, siteId, range);
  const { extras, extrasLoading, extrasError, reloadExtras } = useAnalyticsExtras(user, site?.id ?? null, range, ready);
  const recent = useRecentActivity(user.uid, site?.id ?? null, ready && !range.live);

  const refresh = useCallback(() => {
    refreshVisits();
    void reloadExtras();
  }, [refreshVisits, reloadExtras]);

  const model = useMemo(
    () => buildModel({ range, data, extras, recent, origin: typeof window !== 'undefined' ? window.location.origin : '', now: Date.now() }),
    // updatedAt changes on every poll, keeping "x seconds ago" and the live log fresh.
    // eslint-disable-next-line react-hooks/exhaustive-deps
    [range, data, extras, recent, updatedAt]
  );

  const value = useMemo<AnalyticsDataValue>(
    () => ({
      site,
      sel,
      range,
      compare,
      prevWindow: compare ? previousWindow(sel) : null,
      limits,
      data,
      extras,
      extrasLoading,
      model,
      status,
      loading: status === 'loading',
      refreshing,
      error: error ?? extrasError,
      updatedAt,
      refresh,
    }),
    [site, sel, range, compare, limits, data, extras, extrasLoading, model, status, refreshing, error, extrasError, updatedAt, refresh]
  );

  return <Ctx.Provider value={value}>{children}</Ctx.Provider>;
}
