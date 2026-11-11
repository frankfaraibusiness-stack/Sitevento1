'use client';

// components/analytics/AnalyticsPage.tsx
//
// /dashboard/analytics — the redesigned, business-grade analytics view.
// This first pass is the TOP of the page only (greeting, connected startup,
// data switch, period picker). Everything under it is added step by step
// once the header design is signed off.
//
// Own stylesheet (styles/analytics/analytics.css, `anx-` prefix) and own
// design tokens — it does not use the global dashboard CSS. The old
// dashboard (components/dashboard/DashboardShell.tsx) is untouched.
import { useEffect, useState } from 'react';
import type { User } from 'firebase/auth';
import type { Site } from '@/lib/types';
import type { DashState } from '@/hooks/useSites';
import { AnalyticsHeader } from './AnalyticsHeader';
import type { DataMode } from './AnalyticsDataSwitch';
import { presetRange, type RangeSel } from './analyticsUtils';

interface Props {
  user: User;
  sites: Site[];
  activeSiteId: string | null;
  setActiveSiteId: (siteId: string) => void;
  activeSite: Site | null;
  dashState: DashState;
  onOpenAddSiteModal: () => void;
}

export function AnalyticsPage({ user, sites, activeSiteId, setActiveSiteId, activeSite, dashState, onOpenAddSiteModal }: Props) {
  // UI state only — nothing below the header reads these yet.
  const [requestedMode, setRequestedMode] = useState<DataMode>('live');
  const [range, setRange] = useState<RangeSel>(() => presetRange('30d'));
  const [compare, setCompare] = useState(false);

  // Real data needs a connected, verified site. Otherwise sample data it is.
  const liveAvailable = dashState !== 'empty' && !!activeSite && activeSite.status === 'verified';
  const mode: DataMode = liveAvailable ? requestedMode : 'sample';

  // Paint the page chrome (overscroll, behind the fixed app header, safe-area
  // insets) in the analytics canvas colour while this page is mounted.
  useEffect(() => {
    const root = document.documentElement;
    root.setAttribute('data-anx', '');
    return () => root.removeAttribute('data-anx');
  }, []);

  return (
    <div className="anx" data-mode={mode}>
      <div className="anx-bg" aria-hidden="true">
        <i className="anx-orb is-a" />
        <i className="anx-orb is-b" />
        <i className="anx-orb is-c" />
        <i className="anx-grid" />
      </div>

      <div className="anx-wrap" id="analyticsMain">
        <AnalyticsHeader
          user={user}
          sites={sites}
          activeSite={activeSite}
          activeSiteId={activeSiteId}
          onSiteChange={setActiveSiteId}
          onAddSite={onOpenAddSiteModal}
          mode={mode}
          onModeChange={setRequestedMode}
          liveAvailable={liveAvailable}
          range={range}
          compare={compare}
          onRangeChange={(next, nextCompare) => {
            setRange(next);
            setCompare(nextCompare);
          }}
        />
      </div>
    </div>
  );
}
