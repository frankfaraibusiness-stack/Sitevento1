'use client';

// components/dashboard/DashboardShell.tsx
//
// The dashboard's main shell, rebuilt from the stats-glassy-dashboard
// HTML mock (the old pre-redesign implementation has been removed —
// this is now the only dashboard shell). Same props as before, so
// DashboardClient.tsx needed no changes to pick this up. Fully wired
// to real data: real visits/leads/stats (useActiveSiteData), real
// plan/token/wallet limits (useUserProfile/useAccountLimits/useWallet),
// real token-limit alert modal (useTokenLimitAlert), real leads-count
// reporting back to DashboardClient, and the real
// pending-verification banner. Styled by styles/dashboard/dashboard-v2.css
// (dashv2-* classes).
import { useEffect } from 'react';
import type { User } from 'firebase/auth';
import type { Site } from '@/lib/types';
import type { DashState } from '@/hooks/useSites';
import { useActiveSiteData } from '@/hooks/useActiveSiteData';
import { useUserProfile } from '@/hooks/useUserProfile';
import { useAccountLimits } from '@/hooks/useAccountLimits';
import { useWallet } from '@/hooks/useWallet';
import { useTokenLimitAlert } from '@/hooks/useTokenLimitAlert';
import { useNavRouter } from '@/hooks/useNavPending';
import { DashboardHeader } from './DashboardHeader';
import { SiteDomainCard } from './SiteDomainCard';
import { OverviewKpiGrid } from './OverviewKpiGrid';
import { VisitsChartCard } from './VisitsChartCard';
import { DashLogsPanel } from './DashLogsPanel';
import { RecentLeadsPanel } from './RecentLeadsPanel';
import { PlanLimitsSection } from './PlanLimitsSection';
import { TokenLimitAlertModal } from './TokenLimitAlertModal';
import { DashEmptyState } from './DashEmptyState';

interface DashboardShellProps {
  user: User;
  sites: Site[];
  activeSiteId: string | null;
  setActiveSiteId: (siteId: string) => void;
  activeSite: Site | null;
  dashState: DashState;
  errorMessage: string | null;
  disconnectSite: (siteId: string) => void;
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
  onOpenAddSiteModal,
  onResumeVerification,
  onLeadsCountChange,
}: DashboardShellProps) {
  const router = useNavRouter();
  const { visits, leads, stats, toggleBlockVisit } = useActiveSiteData(user.uid, activeSiteId, user);
  const { planId } = useUserProfile(user);
  const { limits: accountLimits } = useAccountLimits(user);
  const { wallet, setAutoRecharge } = useWallet(user);
  const tokenLimitAlert = useTokenLimitAlert(user.uid, accountLimits?.tokenUsage);

  // Same real-data reporting as the current DashboardShell — Sidebar's
  // leads badge reads this via DashboardClient's leadsCount state.
  useEffect(() => {
    onLeadsCountChange(stats.leadsCount);
  }, [stats.leadsCount, onLeadsCountChange]);

  // dashState is owned by DashboardClient, whose single fullscreen
  // gate already keeps the loader up until dashState leaves
  // 'loading' — mirrors DashboardShell's own guard against a second
  // spinner flash.
  if (dashState === 'loading') {
    return null;
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

  // 'empty' (no sites connected yet) reuses the existing premium empty
  // state (components/dashboard/DashEmptyState.tsx — same content
  // DashboardShell.tsx inlines locally) rather than duplicating its
  // hero/benefits/steps copy here.
  if (dashState === 'empty') {
    return (
      <section>
        <DashEmptyState onConnectSite={onOpenAddSiteModal} />
      </section>
    );
  }

  return (
    <div className="dashv2-dashboard-root">
      <DashboardHeader />

      <SiteDomainCard
        sites={sites}
        activeSiteId={activeSiteId}
        onSelect={setActiveSiteId}
        onAddSite={onOpenAddSiteModal}
      />

      {activeSite?.status === 'pending' && (
        <div className="dashv2-verify-banner">
          <span className="dashv2-verify-icon" aria-hidden="true">
            <svg viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth={2}>
              <path d="M12 3l7 3v5c0 5-3.2 8.3-7 10-3.8-1.7-7-5-7-10V6l7-3z" />
              <path d="M9 12.2l2 2 4-4.4" />
            </svg>
          </span>
          <div className="dashv2-verify-text">
            <strong>Not verified yet.</strong>
            <span>This site won&apos;t log visits or accept banners until the tag is confirmed.</span>
          </div>
          <button
            type="button"
            className="dashv2-verify-cta"
            onClick={() => activeSite && onResumeVerification({ id: activeSite.id, url: activeSite.url })}
          >
            Finish verifying
          </button>
        </div>
      )}

      <main className="dashv2-app-main">
        <OverviewKpiGrid
          totalVisits={stats.total}
          uniqueVisitors={stats.unique}
          leadsCount={stats.leadsCount}
          blockedCount={stats.blockedCount}
        />

        <VisitsChartCard visits={visits} />

        <PlanLimitsSection
          planId={planId}
          connectedSitesUsed={sites.length}
          tokenUsage={accountLimits?.tokenUsage}
          dailyTokenLimits={accountLimits?.dailyTokenLimits}
          walletBalanceUsd={accountLimits?.wallet?.balanceUsd}
          wallet={wallet}
          onUpgrade={() => router.push('/dashboard/plans')}
          onOpenWallet={() => router.push('/dashboard/wallet')}
        />

        <DashLogsPanel
          visits={visits}
          onToggleBlock={(visitId, blockedValue, visitorId) => toggleBlockVisit(visitId, blockedValue, visitorId)}
        />

        <RecentLeadsPanel leads={leads} />
      </main>

      <TokenLimitAlertModal
        severity={tokenLimitAlert.severity}
        planId={planId}
        tokenUsage={accountLimits?.tokenUsage}
        wallet={wallet}
        onDismiss={tokenLimitAlert.dismiss}
        onUpgrade={() => {
          tokenLimitAlert.dismiss();
          router.push('/dashboard/plans');
        }}
        onOpenWallet={() => {
          tokenLimitAlert.dismiss();
          router.push('/dashboard/wallet');
        }}
        onEnablePayAsYouGo={() => {
          setAutoRecharge(true);
          tokenLimitAlert.dismiss();
        }}
      />
    </div>
  );
}
