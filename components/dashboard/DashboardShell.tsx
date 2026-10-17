'use client';

// components/dashboard/DashboardShell.tsx — replaces #dashboardView's
// four-state switch (loading/empty/error/main) + dash-head + the
// pending-verify banner + site tabs + all panels. Orchestrates the
// useSites / useActiveSiteData hooks and renders the right sub-state.
import { useEffect } from 'react';
import type { User } from 'firebase/auth';
import { useSites } from '@/hooks/useSites';
import { useActiveSiteData } from '@/hooks/useActiveSiteData';
import { DashEmptyState } from './DashEmptyState';
import { SiteTabs } from './SiteTabs';
import { OverviewStats } from './OverviewStats';
import { OverlayComposer } from './OverlayComposer';
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
  const { sites, activeSiteId, setActiveSiteId, activeSite, dashState, errorMessage } = useSites(user.uid);
  const { visits, leads, stats, toggleBlockVisit } = useActiveSiteData(user.uid, activeSiteId);

  // Mirrors the original's renderLeads() sidebar-badge side effect: the
  // parent (DashboardPage) owns the badge count shown in the Sidebar.
  useEffect(() => {
    onLeadsCountChange(stats.leadsCount);
  }, [stats.leadsCount, onLeadsCountChange]);

  if (dashState === 'loading') {
    return (
      <section>
        <div className="dashboard-empty">
          <div className="dash-empty-inner">
            <p style={{ color: '#8a8477', fontFamily: '-apple-system, sans-serif', fontSize: 13.5 }}>
              Loading your dashboard…
            </p>
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
      <div className="dash-wrap">
        <div className="dash-head">
          <div>
            <h1>{activeSite?.name || 'Dashboard'}</h1>
            <p>{activeSite?.url || '—'}</p>
          </div>
          <button className="dash-add-btn" onClick={onOpenAddSiteModal}>
            <svg viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth={2.3}>
              <path d="M12 5v14M5 12h14" />
            </svg>
            Connect a site
          </button>
        </div>

        {activeSite?.status === 'pending' && (
          <div className="pending-verify-banner">
            <div className="pvb-text">
              <span className="pvb-dot" />
              <span>
                <strong>Not verified yet.</strong> This site won&apos;t log visits or accept overlays until the tag
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

        <SiteTabs sites={sites} activeSiteId={activeSiteId} onSelect={setActiveSiteId} />

        <OverviewStats
          totalVisits={stats.total}
          uniqueVisitors={stats.unique}
          leadsCount={stats.leadsCount}
          blockedCount={stats.blockedCount}
        />

        <OverlayComposer uid={user.uid} activeSite={activeSite} />

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
