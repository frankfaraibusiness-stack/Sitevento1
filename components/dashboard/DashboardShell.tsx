'use client';

// components/dashboard/DashboardShell.tsx
//
// Premium redesign of the dashboard body: a lime-native hero header with
// the site switcher, animated stat tiles, an ambient plan-usage/upsell
// strip, the sites management rail, Quick Tools, and the existing
// visit/lead/blocked panels — all wrapped in new `dnx-*` classnames
// (styles/dashboard-premium.css) that sit directly on the page's lime
// background rather than inside their own boxed-off sections. Lives at
// /dashboard (see app/dashboard/page.tsx).
import { useEffect, useMemo, useRef, useState } from 'react';
import { useNavRouter } from '@/hooks/useNavPending';
import type { User } from 'firebase/auth';
import { useSites } from '@/hooks/useSites';
import { useActiveSiteData } from '@/hooks/useActiveSiteData';
import { useUserProfile } from '@/hooks/useUserProfile';
import { DashEmptyState } from './DashEmptyState';
import { SiteSwitcher } from './SiteSwitcher';
import { ConnectedSitesSection } from './ConnectedSitesSection';
import { OverviewStats } from './OverviewStats';
import { PlanUsageStrip } from './PlanUsageStrip';
import { BannerComposer } from './BannerComposer';
import { FeatureOptionsGrid } from './FeatureOptionsGrid';
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
  const router = useNavRouter();
  const { sites, activeSiteId, setActiveSiteId, activeSite, dashState, errorMessage, disconnectSite } = useSites(
    user.uid
  );
  const { visits, leads, stats, toggleBlockVisit } = useActiveSiteData(user.uid, activeSiteId);
  const { planId } = useUserProfile(user);

  const [siteAlertOpen, setSiteAlertOpen] = useState(false);

  useEffect(() => {
    if (!siteAlertOpen) return;
    function handleEscape(e: KeyboardEvent) {
      if (e.key === 'Escape') {
        setSiteAlertOpen(false);
      }
    }
    document.addEventListener('keydown', handleEscape);
    // Full-screen takeover, so lock background scroll the same way
    // ConnectSiteWizard does for its own modal — otherwise the
    // dashboard underneath can still scroll (and its scroll position
    // shifts) while this covers the whole viewport.
    document.body.style.overflow = 'hidden';
    return () => {
      document.removeEventListener('keydown', handleEscape);
      document.body.style.overflow = '';
    };
  }, [siteAlertOpen]);

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

  // Previously rendered its own in-place <AppSkeleton> here, which
  // showed up as a second ("inline") spinner stacked right after the
  // app-wide full-screen <AppSkeleton> (DashboardClient's auth gate /
  // NavPendingOverlay) finished — two loaders back to back for one
  // navigation. The full-screen one has already covered this same
  // "still loading" window from the moment the route changed, so this
  // render just stays empty until real data is ready instead of
  // showing a second, redundant loading state.
  if (showLoadingSkeleton) {
    return <section aria-busy="true" aria-label="Loading your dashboard" />;
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
      <div className="dnx-wrap" id="dashMain">
        <div className="dnx-hero">
          <SiteSwitcher
            sites={sites}
            activeSiteId={activeSiteId}
            onSelect={setActiveSiteId}
            onAddSite={onOpenAddSiteModal}
          />
          <h1 className="dnx-hero-title">Welcome back{user.displayName ? `, ${user.displayName.split(' ')[0]}` : ''}</h1>
          <p className="dnx-hero-sub">Here&apos;s what&apos;s happening across your {sites.length === 1 ? 'site' : 'sites'} right now.</p>
        </div>

        {activeSite?.status === 'pending' && (
          <div className="dnx-verify-banner">
            <span className="dnx-verify-icon" aria-hidden="true">
              <svg viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth={2}>
                <path d="M12 3l7 3v5c0 5-3.2 8.3-7 10-3.8-1.7-7-5-7-10V6l7-3z" />
                <path d="M9 12.2l2 2 4-4.4" />
              </svg>
            </span>
            <div className="dnx-verify-text">
              <strong>Not verified yet.</strong>
              <span>This site won&apos;t log visits or accept banners until the tag is confirmed.</span>
            </div>
            <button
              type="button"
              className="dnx-verify-cta"
              onClick={() => activeSite && onResumeVerification({ id: activeSite.id, url: activeSite.url })}
            >
              Finish verifying
              <svg viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth={2.2}>
                <path d="M9 18l6-6-6-6" />
              </svg>
            </button>
          </div>
        )}

        <div className="dnx-section-head">
          <h2>Overview</h2>
        </div>
        <OverviewStats
          totalVisits={stats.total}
          uniqueVisitors={stats.unique}
          leadsCount={stats.leadsCount}
          blockedCount={stats.blockedCount}
        />

        <PlanUsageStrip
          planId={planId}
          used={sites.length}
          onUpgrade={() => router.push('/dashboard/plans')}
        />

        {sites.length > 1 && (
          <ConnectedSitesSection
            sites={sites}
            activeSiteId={activeSiteId}
            onSelect={setActiveSiteId}
            onAddSite={onOpenAddSiteModal}
            onDisconnect={disconnectSite}
            onManageSite={(siteId) => router.push(`/dashboard/sites/${siteId}`)}
          />
        )}

        <div id="panelOverlay">
          <FeatureOptionsGrid onOpenSiteAlert={() => setSiteAlertOpen(true)} />
        </div>

        <div id="panelVisits">
          <VisitLogPanel
            visits={visits}
            onToggleBlock={(visitId, blockedValue, visitorId) => toggleBlockVisit(visitId, blockedValue, visitorId)}
          />
        </div>

        <div id="panelLeads">
          <LeadsPanel leads={leads} />
        </div>

        <BlockedVisitorsPanel
          blocked={stats.blocked}
          onUnblock={(visitId, visitorId) => toggleBlockVisit(visitId, false, visitorId)}
        />
      </div>

      {siteAlertOpen && (
        <div className="feat-panel-screen" role="dialog" aria-modal="true" aria-label="Site Alert">
          <div className="feat-panel-head">
            <div className="feat-panel-head-text">
              <h2>Live banner</h2>
              <span>Push a full-screen or popup banner to this site, right now.</span>
            </div>
            <button type="button" className="feat-panel-close" aria-label="Close" onClick={() => setSiteAlertOpen(false)}>
              <svg viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth={2.2} strokeLinecap="round">
                <path d="M5 5l14 14M19 5L5 19" />
              </svg>
            </button>
          </div>
          <div className="feat-panel-body">
            <BannerComposer uid={user.uid} activeSite={activeSite} />
          </div>
        </div>
      )}
    </section>
  );
}
