'use client';

// components/dashboard/DashboardShell.tsx
//
// Premium redesign of the dashboard body: a lime-native hero header with
// the site switcher, animated stat tiles, an ambient plan-usage/upsell
// strip, the sites management rail, Quick Tools, and the existing
// visit/lead/blocked panels — all wrapped in new `dnx-*` classnames
// (styles/dashboard/dashboard-premium.css) that sit directly on the page's lime
// background rather than inside their own boxed-off sections. Lives at
// /dashboard (see app/dashboard/page.tsx).
import { useEffect } from 'react';
import { useNavRouter } from '@/hooks/useNavPending';
import type { User } from 'firebase/auth';
import type { Site } from '@/lib/types';
import type { DashState } from '@/hooks/useSites';
import { useActiveSiteData } from '@/hooks/useActiveSiteData';
import { useUserProfile } from '@/hooks/useUserProfile';
import { useAccountLimits } from '@/hooks/useAccountLimits';
import { DashEmptyState } from './DashEmptyState';
import { SiteSwitcher } from './SiteSwitcher';
import { ConnectedSitesSection } from './ConnectedSitesSection';
import { OverviewStats } from './OverviewStats';
import { PlanUsageStrip } from './PlanUsageStrip';
import { DailyLimitCard } from './DailyLimitCard';
import { FeatureOptionsGrid } from './FeatureOptionsGrid';
import { VisitLogPanel } from './VisitLogPanel';
import { LeadsPanel } from './LeadsPanel';
import { BlockedVisitorsPanel } from './BlockedVisitorsPanel';

interface DashboardShellProps {
  user: User;
  // Lifted from useSites() up into DashboardClient so the single
  // fullscreen loading gate there can wait on dashState too, instead
  // of this component owning its own duplicate subscription and
  // flashing its own inline AppSkeleton once that outer gate closes.
  // See DashboardClient's comment on the gate for the full story.
  sites: Site[];
  activeSiteId: string | null;
  setActiveSiteId: (id: string) => void;
  activeSite: Site | null;
  dashState: DashState;
  errorMessage: string;
  // Matches hooks/useSites.ts's disconnectSite exactly (resolves
  // Promise<boolean> — success/failure). Passed straight through to
  // ConnectedSitesSection's onDisconnect prop below, which accepts any
  // void-or-promise-returning function (see that file's comment) so
  // this signature never has to be kept in lockstep with it by hand.
  disconnectSite: (siteId: string) => Promise<boolean>;
  onOpenAddSiteModal: () => void;
  onResumeVerification: (site: { id: string; url: string }) => void;
  onLeadsCountChange: (count: number) => void;
}

export function DashboardShell({
  user,
  sites,
  activeSiteId,
  setActiveSiteId,
  activeSite,
  dashState,
  errorMessage,
  disconnectSite,
  onOpenAddSiteModal,
  onResumeVerification,
  onLeadsCountChange,
}: DashboardShellProps) {
  const router = useNavRouter();
  const { visits, leads, stats, toggleBlockVisit } = useActiveSiteData(user.uid, activeSiteId, user);
  const { planId } = useUserProfile(user);
  const { limits: accountLimits } = useAccountLimits(user);

  useEffect(() => {
    onLeadsCountChange(stats.leadsCount);
  }, [stats.leadsCount, onLeadsCountChange]);

  // dashState is now owned by DashboardClient (see its comment), whose
  // single fullscreen gate already keeps the loader up until dashState
  // leaves 'loading' — so this component should never actually mount
  // while it's still 'loading'. Render nothing rather than a second,
  // inline <AppSkeleton> in that brief in-between render, so there's
  // no second spinner flash under the gate.
  if (dashState === 'loading') {
    return null;
  }

  if (dashState === 'error') {
    return (
      <section>
        <div className="dashboard-empty">
          <div className="dash-empty-inner">
            <div className="dash-empty-error-icon">
              <svg viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth={2}>
                <circle cx="12" cy="12" r="9" />
                <path d="M12 8v5M12 16.5h.01" strokeLinecap="round" />
              </svg>
            </div>
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

        <DailyLimitCard
          planId={planId}
          writeUsage={accountLimits?.writeUsage}
          dailyWriteLimits={accountLimits?.dailyWriteLimits}
          onUpgrade={() => router.push('/dashboard/plans')}
          variant="compact"
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
          <FeatureOptionsGrid />
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
    </section>
  );
}
