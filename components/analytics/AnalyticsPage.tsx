'use client';

// components/analytics/AnalyticsPage.tsx
//
// /dashboard/analytics — the redesigned, business-grade analytics view.
// Being connected to real data one piece at a time. Step 1 (done): the period
// picker — its selection is resolved into a real query window, plan-gated,
// and loaded through AnalyticsDataProvider. The sections below still show
// placeholder numbers; each is switched over in its own step.
//
// Own stylesheet (styles/analytics/analytics.css, `anx-` prefix) and own
// design tokens — it does not use the global dashboard CSS. The old
// dashboard (components/dashboard/DashboardShell.tsx) is untouched.
import { useEffect, useMemo, useState } from 'react';
import type { User } from 'firebase/auth';
import type { Site } from '@/lib/types';
import { useAccountLimits } from '@/hooks/useAccountLimits';
import { getPlan, type PlanLimits } from '@/lib/plans';
import { dayKey } from '@/lib/dashboardRange';
import { AnalyticsHeader } from './AnalyticsHeader';
import { AnalyticsSections } from './AnalyticsSections';
import { AnalyticsDataProvider } from './AnalyticsDataContext';
import {
  isCompareAllowed,
  isSelAllowed,
  presetRange,
  resolveSel,
  startOfDay,
  toDateSafe,
  widestAllowedPreset,
  type RangeSel,
} from './analyticsUtils';

interface Props {
  user: User;
  sites: Site[];
  activeSiteId: string | null;
  setActiveSiteId: (siteId: string) => void;
  activeSite: Site | null;
  onOpenAddSiteModal: () => void;
}

export function AnalyticsPage({ user, sites, activeSiteId, setActiveSiteId, activeSite, onOpenAddSiteModal }: Props) {
  const [sel, setSel] = useState<RangeSel>(() => presetRange('30d'));
  const [compare, setCompare] = useState(false);

  // The viewer's plan decides how far back they may look (lib/plans.ts's
  // historyRetentionDays). null = still loading, or the limits call failed —
  // in which case we don't lock anything rather than block the page.
  const { limits: account, loading: limitsLoading } = useAccountLimits(user);
  const planId = account?.planId ?? null;
  const planLimits = useMemo<PlanLimits | null>(() => {
    if (!planId) return null;
    try {
      return getPlan(planId).limits;
    } catch {
      return null;
    }
  }, [planId]);

  // Preset windows are anchored to "today"; re-derive them when the day
  // rolls over so a tab left open overnight doesn't keep yesterday's window.
  // (The data hook's 60s poll re-renders this component, so this is checked
  // at least once a minute.)
  const todayKey = dayKey(startOfDay(new Date()));
  const liveSel = useMemo<RangeSel>(
    () => (sel.preset === 'custom' ? sel : presetRange(sel.preset)),
    // eslint-disable-next-line react-hooks/exhaustive-deps
    [sel, todayKey]
  );

  // If the plan (once loaded) doesn't cover the current pick — default 30D on
  // a 7-day plan, or a downgrade — fall back to the widest window it does.
  useEffect(() => {
    if (!planLimits) return;
    const now = new Date();
    if (!isSelAllowed(planLimits, liveSel, now)) {
      setSel(presetRange(widestAllowedPreset(planLimits)));
      setCompare(false);
    } else if (compare && !isCompareAllowed(planLimits, liveSel, now)) {
      setCompare(false);
    }
  }, [planLimits, liveSel, compare]);

  // "All time" runs from the day the site was connected.
  const lifetimeStartMs = toDateSafe(activeSite?.createdAt)?.getTime() ?? null;
  const siteStart = useMemo(() => (lifetimeStartMs ? new Date(lifetimeStartMs) : null), [lifetimeStartMs]);
  const range = useMemo(() => resolveSel(liveSel, siteStart), [liveSel, siteStart]);

  // Paint the page chrome (overscroll, behind the fixed app header, safe-area
  // insets) in the analytics canvas colour while this page is mounted.
  useEffect(() => {
    const root = document.documentElement;
    root.setAttribute('data-anx', '');
    return () => root.removeAttribute('data-anx');
  }, []);

  return (
    <div className="anx">
      <div className="anx-bg" aria-hidden="true">
        <i className="anx-orb is-a" />
        <i className="anx-orb is-b" />
        <i className="anx-orb is-c" />
        <i className="anx-grid" />
      </div>

      <div className="anx-wrap" id="analyticsMain">
        <AnalyticsDataProvider
          user={user}
          site={activeSite}
          sel={liveSel}
          range={range}
          compare={compare}
          limits={planLimits}
          ready={!limitsLoading}
        >
          <AnalyticsHeader
            user={user}
            sites={sites}
            activeSite={activeSite}
            activeSiteId={activeSiteId}
            onSiteChange={setActiveSiteId}
            onAddSite={onOpenAddSiteModal}
            range={liveSel}
            compare={compare}
            limits={planLimits}
            siteStart={siteStart}
            onRangeChange={(next, nextCompare) => {
              setSel(next);
              setCompare(nextCompare);
            }}
          />

          {/* Sections still on placeholder data — switched over one by one. */}
          <AnalyticsSections />
        </AnalyticsDataProvider>
      </div>
    </div>
  );
}
