'use client';

// components/analytics/AnalyticsPage.tsx
//
// /dashboard/analytics — the redesigned, business-grade analytics view.
// This first pass is the TOP of the page only (greeting, connected startup,
// period picker). Everything under it is added step by step
// once the header design is signed off.
//
// Own stylesheet (styles/analytics/analytics.css, `anx-` prefix) and own
// design tokens — it does not use the global dashboard CSS. The old
// dashboard (components/dashboard/DashboardShell.tsx) is untouched.
import { useEffect, useState } from 'react';
import type { User } from 'firebase/auth';
import type { Site } from '@/lib/types';
import { AnalyticsHeader } from './AnalyticsHeader';
import { AnalyticsSections } from './AnalyticsSections';
import { presetRange, type RangeSel } from './analyticsUtils';

interface Props {
  user: User;
  sites: Site[];
  activeSiteId: string | null;
  setActiveSiteId: (siteId: string) => void;
  activeSite: Site | null;
  onOpenAddSiteModal: () => void;
}

export function AnalyticsPage({ user, sites, activeSiteId, setActiveSiteId, activeSite, onOpenAddSiteModal }: Props) {
  // UI state only — nothing below the header reads these yet.
  const [range, setRange] = useState<RangeSel>(() => presetRange('30d'));
  const [compare, setCompare] = useState(false);

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
        <AnalyticsHeader
          user={user}
          sites={sites}
          activeSite={activeSite}
          activeSiteId={activeSiteId}
          onSiteChange={setActiveSiteId}
          onAddSite={onOpenAddSiteModal}
          range={range}
          compare={compare}
          onRangeChange={(next, nextCompare) => {
            setRange(next);
            setCompare(nextCompare);
          }}
        />

        {/* Raw sections (no styling / backend yet) — see AnalyticsSections.tsx */}
        <AnalyticsSections />
      </div>
    </div>
  );
}
