'use client';

// components/dashboard/DashboardShell.tsx
//
// Full redesign of the dashboard body: orchestrates useSites /
// useActiveSiteData, and renders the new ConnectedSitesSection (replaces
// the old tab strip), OverviewStats, BannerComposer (replaces
// OverlayComposer), VisitLogPanel, LeadsPanel and BlockedVisitorsPanel.
// Lives at /dashboard now (see app/dashboard/page.tsx) instead of being
// one branch of the old single-page AppRoot view switch.
import { useEffect, useMemo, useRef, useState } from 'react';
import type { User } from 'firebase/auth';
import { useSites } from '@/hooks/useSites';
import { useActiveSiteData } from '@/hooks/useActiveSiteData';
import { DashEmptyState } from './DashEmptyState';
import { ConnectedSitesSection } from './ConnectedSitesSection';
import { OverviewStats } from './OverviewStats';
import { BannerComposer } from './BannerComposer';
import { VisitLogPanel } from './VisitLogPanel';
import { LeadsPanel } from './LeadsPanel';
import { BlockedVisitorsPanel } from './BlockedVisitorsPanel';

interface DashboardShellProps {
  user: User;
  onOpenAddSiteModal: () => void;
  onResumeVerification: (site: { id: string; url: string }) => void;
  onLeadsCountChange: (count: number) => void;
}

export function DashboardShell({
  user,
  onOpenAddSiteModal,
  onResumeVerification,
  onLeadsCountChange,
}: DashboardShellProps) {
  const { sites, activeSiteId, setActiveSiteId, activeSite, dashState, errorMessage, disconnectSite } = useSites(
    user.uid
  );
  const { visits, leads, stats, toggleBlockVisit } = useActiveSiteData(user.uid, activeSiteId);

  useEffect(() => {
    onLeadsCountChange(stats.leadsCount);
  }, [stats.leadsCount, onLeadsCountChange]);

  // Minimum-hold for the loading skeleton, same idea as BootSplash's
  // randomized hold (see components/BootSplash.tsx / AppRoot.tsx): on a
  // fast connection useSites can resolve in well under a second, which
  // would otherwise flash the skeleton for a single frame. Instead we
  // hold it for a randomized 3-5s floor every time this component
  // mounts into a loading state, regardless of how fast the real data
  // actually arrives, so it always reads as deliberate rather than a
  // glitchy flicker. Only gates the transition OUT of 'loading' — the
  // 'error' and 'empty' states are informational, not decorative, so
  // they still show the instant they're known.
  const minHoldMs = useMemo(() => 3000 + Math.random() * 2000, []);
  const [minHoldElapsed, setMinHoldElapsed] = useState(false);
  const holdTimerStarted = useRef(false);

  useEffect(() => {
    if (holdTimerStarted.current) return;
    holdTimerStarted.current = true;
    const t = setTimeout(() => setMinHoldElapsed(true), minHoldMs);
    return () => clearTimeout(t);
  }, [minHoldMs]);

  const showLoadingSkeleton = dashState === 'loading' || (!minHoldElapsed && dashState !== 'error');

  if (showLoadingSkeleton) {
    // Same shaped shimmer skeleton as app/loading.tsx (route-skeleton.css's
    // .skel-* classes), reused here so the dashboard's own in-place loading
    // state (sites/stats still fetching after the route has already
    // mounted) matches the route-transition skeleton instead of falling
    // back to plain "Loading…" text.
    return (
      <section>
        <div className="dashboard-empty">
          <div className="dash-empty-inner" role="status" aria-label="Loading your dashboard">
            <div className="skel-head">
              <div className="skel-block skel-title" />
              <div className="skel-block skel-pill" />
            </div>

            <div className="skel-grid">
              <div className="skel-block skel-card" />
              <div className="skel-block skel-card" />
              <div className="skel-block skel-card" />
              <div className="skel-block skel-card" />
            </div>

            <div className="skel-panel">
              <div className="skel-panel-head">
                <div className="skel-block skel-panel-title" />
                <div className="skel-block skel-panel-sub" />
              </div>
              <div className="skel-panel-body">
                <div className="skel-block skel-row" />
                <div className="skel-block skel-row" />
                <div className="skel-block skel-row" />
              </div>
            </div>
          </div>
        </div>
      </section>
    );
  }

  if (dashState === 'error') {
    return (
      <section>
        <div className="dashboard-empty">
          <div className="dash-empty-inner">
            <h2>Couldn&apos;t load your dashboard</h2>
            <p>{errorMessage}</p>
            <button className="btn-primary" onClick={() => window.location.reload()}>
              Retry
            </button>
          </div>
        </div>
      </section>
    );
  }

  if (dashState === 'empty') {
    return (
      <section>
        <DashEmptyState onConnectSite={onOpenAddSiteModal} />
      </section>
    );
  }

  return (
    <section>
      <div className="dash-wrap dash-wrap-v2">
        <div className="dash-head">
          <div>
            <h1>{activeSite?.name || 'Dashboard'}</h1>
            <p>{activeSite?.url || '\u2014'}</p>
          </div>
        </div>

        {activeSite?.status === 'pending' && (
          <div className="pending-verify-banner">
            <div className="pvb-text">
              <span className="pvb-dot" />
              <span>
                <strong>Not verified yet.</strong> This site won&apos;t log visits or accept banners until the tag
                is confirmed.
              </span>
            </div>
            <button
              type="button"
              className="ghost-btn"
              onClick={() => activeSite && onResumeVerification({ id: activeSite.id, url: activeSite.url })}
            >
              Finish verifying
            </button>
          </div>
        )}

        <ConnectedSitesSection
          sites={sites}
          activeSiteId={activeSiteId}
          onSelect={setActiveSiteId}
          onAddSite={onOpenAddSiteModal}
          onDisconnect={disconnectSite}
        />

        <OverviewStats
          totalVisits={stats.total}
          uniqueVisitors={stats.unique}
          leadsCount={stats.leadsCount}
          blockedCount={stats.blockedCount}
        />

        <BannerComposer uid={user.uid} activeSite={activeSite} />

        <VisitLogPanel
          visits={visits}
          onToggleBlock={(visitId, blockedValue, visitorId) => toggleBlockVisit(visitId, blockedValue, visitorId)}
        />

        <LeadsPanel leads={leads} />

        <BlockedVisitorsPanel
          blocked={stats.blocked}
          onUnblock={(visitId, visitorId) => toggleBlockVisit(visitId, false, visitorId)}
        />
      </div>
    </section>
  );
}
