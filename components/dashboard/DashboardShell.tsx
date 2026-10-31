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
import { useWallet } from '@/hooks/useWallet';
import { useWriteLimitAlert } from '@/hooks/useWriteLimitAlert';
import { SiteSwitcher } from './SiteSwitcher';
import { ConnectedSitesSection } from './ConnectedSitesSection';
import { OverviewStats } from './OverviewStats';
import { PlanUsageStrip } from './PlanUsageStrip';
import { DailyLimitCard } from './DailyLimitCard';
import { WriteLimitAlertModal } from './WriteLimitAlertModal';
import { FeatureOptionsGrid } from './FeatureOptionsGrid';
import { VisitLogPanel } from './VisitLogPanel';
import { LeadsPanel } from './LeadsPanel';
import { BlockedVisitorsPanel } from './BlockedVisitorsPanel';

// Inlined from the former components/dashboard/DashEmptyState.tsx —
// pulled into this file directly (instead of a separate module import)
// so there's no second file for a build/deploy step to lose track of.
// Premium "before you connect a site" state for a brand-new account:
//   1. Hero — headline + sub copy + primary CTA, with a live-look
//      "preview panel" mockup showing what the connected dashboard
//      actually looks like (not just an icon — real numbers/labels).
//   2. Benefit cards — each answers "why does this matter to me",
//      not just "what feature is this".
//   3. "How it works" numbered strip — removes the
//      is-this-complicated hesitation up front.
//   4. Closing CTA band — second, lower-friction chance to convert
//      after the reasoning has landed.
function DashEmptyState({ onConnectSite }: { onConnectSite: () => void }) {
  return (
    <div className="dnx-empty-root">
      {/* ---------- 1. Hero ---------- */}
      <div className="dnx-empty-hero-band">
        <div className="dnx-empty-hero-copy">
          <span className="dnx-empty-eyebrow">Welcome to your dashboard</span>
          <h2>
            Right now, your site is a <em>black box</em>.
          </h2>
          <p>
            People are visiting it today — you just can&apos;t see them. Connect your site and this page
            turns into a live control room: who&apos;s on your site right now, where they came from, and the
            power to act on it instantly.
          </p>

          <button className="dnx-empty-cta-btn" onClick={onConnectSite}>
            <svg viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth={2.3}>
              <path d="M12 5v14M5 12h14" />
            </svg>
            Connect your site
          </button>
          <div className="dnx-empty-cta-note">
            <svg viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth={2.2}>
              <path d="m5 12 5 5L20 7" />
            </svg>
            Takes about 2 minutes — one snippet, no engineering required
          </div>
        </div>

        {/* Live-look preview mockup: not a feature icon, an actual
            sample of the dashboard this unlocks, so the value is
            visible before the click. */}
        <div className="dnx-empty-preview-panel" aria-hidden="true">
          <div className="dnx-empty-preview-panel-glow" />
          <div className="dnx-empty-preview-chrome">
            <span className="dnx-empty-preview-dot" />
            <span className="dnx-empty-preview-dot" />
            <span className="dnx-empty-preview-dot" />
            <span className="dnx-empty-preview-chrome-label">yoursite.com — live</span>
          </div>

          <div className="dnx-empty-preview-stats">
            <div className="dnx-empty-preview-stat">
              <span className="dnx-empty-preview-stat-label">
                <span className="dnx-empty-live-dot" />
                Live visitors
              </span>
              <span className="dnx-empty-preview-stat-value">247</span>
            </div>
            <div className="dnx-empty-preview-stat">
              <span className="dnx-empty-preview-stat-label">New leads today</span>
              <span className="dnx-empty-preview-stat-value">12</span>
            </div>
          </div>

          <div className="dnx-empty-preview-rows">
            <div className="dnx-empty-preview-row">
              <span className="dnx-empty-preview-row-dot" />
              <span>Visitor from Lagos, NG opened /pricing</span>
              <span className="dnx-empty-preview-row-time">now</span>
            </div>
            <div className="dnx-empty-preview-row">
              <span className="dnx-empty-preview-row-dot" />
              <span>New lead captured via signup form</span>
              <span className="dnx-empty-preview-row-time">2m</span>
            </div>
            <div className="dnx-empty-preview-row is-dim">
              <span className="dnx-empty-preview-row-dot" />
              <span>Returning visitor from last week</span>
              <span className="dnx-empty-preview-row-time">6m</span>
            </div>
          </div>

          <span className="dnx-empty-preview-badge">This is what connecting unlocks</span>
        </div>
      </div>

      {/* ---------- 2. Benefits: why, not just what ---------- */}
      <div className="dnx-empty-section-head">
        <h3>What changes the moment you connect</h3>
        <p>Four things you can&apos;t do today — and can do the second your site is live here.</p>
      </div>

      <div className="dnx-empty-preview-grid">
        <div className="dnx-empty-preview-card">
          <div className="dnx-empty-preview-icon">
            <svg viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth={1.8}>
              <path d="M3 12h4l2 5 4-14 2 9 2-5h4" />
            </svg>
          </div>
          <h4>Stop guessing who's visiting</h4>
          <p>
            Every visitor, page, referrer, and device — searchable the moment they land. No more wondering
            where your traffic is actually coming from.
          </p>
        </div>

        <div className="dnx-empty-preview-card">
          <div className="dnx-empty-preview-icon">
            <svg viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth={1.8}>
              <circle cx="12" cy="12" r="9" />
              <path d="m15 9-6 6M9 9l6 6" />
            </svg>
          </div>
          <h4>Shut out the visitors you don't want</h4>
          <p>
            See exactly who&apos;s on your site — bots, scrapers, bad actors — and block any of them
            instantly. No code changes, no waiting on a deploy.
          </p>
        </div>

        <div className="dnx-empty-preview-card">
          <div className="dnx-empty-preview-icon">
            <svg viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth={1.8}>
              <path d="M4 12h16M4 6h16M4 18h10" />
            </svg>
          </div>
          <h4>Push a message without a redeploy</h4>
          <p>
            Maintenance mode, a launch banner, an urgent notice — publish a full-screen overlay to every
            visitor in seconds, straight from this dashboard.
          </p>
        </div>

        <div className="dnx-empty-preview-card">
          <div className="dnx-empty-preview-icon">
            <svg viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth={1.8}>
              <rect x="3" y="5" width="18" height="14" rx="2" />
              <path d="M3 9h18M7 13h4" />
            </svg>
          </div>
          <h4>Turn visits into an actual list</h4>
          <p>
            Drop in the built-in email capture widget and every address lands here automatically — a
            growing list instead of traffic that just disappears.
          </p>
        </div>
      </div>

      {/* ---------- 3. How it works ---------- */}
      <div className="dnx-empty-steps">
        <div className="dnx-empty-step">
          <span className="dnx-empty-step-num">1</span>
          <div>
            <h5>Add your site</h5>
            <p>Paste your site&apos;s URL — we generate a single tracking snippet for it.</p>
          </div>
        </div>
        <div className="dnx-empty-step-connector" aria-hidden="true" />
        <div className="dnx-empty-step">
          <span className="dnx-empty-step-num">2</span>
          <div>
            <h5>Paste one snippet</h5>
            <p>Drop it before <code>&lt;/head&gt;</code> — no package installs, no backend changes.</p>
          </div>
        </div>
        <div className="dnx-empty-step-connector" aria-hidden="true" />
        <div className="dnx-empty-step">
          <span className="dnx-empty-step-num">3</span>
          <div>
            <h5>Watch it go live</h5>
            <p>This page fills in with real visitors within seconds of your next page load.</p>
          </div>
        </div>
      </div>

      {/* ---------- 4. Closing CTA ---------- */}
      <div className="dnx-empty-closing">
        <div>
          <h4>Your dashboard is ready. Your site just isn&apos;t connected yet.</h4>
          <p>Two minutes, one snippet — then every number on this page is real.</p>
        </div>
        <button className="dnx-empty-cta-btn dnx-empty-cta-btn--ghost" onClick={onConnectSite}>
          Connect your site
          <svg viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth={2.3}>
            <path d="M5 12h14M13 6l6 6-6 6" />
          </svg>
        </button>
      </div>
    </div>
  );
}

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
  const { wallet, setAutoRecharge } = useWallet(user);
  const writeLimitAlert = useWriteLimitAlert(user.uid, accountLimits?.writeUsage);

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
          <div className="dnx-hero-topline">
            <div className="dnx-hero-context">
              <span className="dnx-eyebrow"><span className="dnx-eyebrow-dot" /> WORKSPACE OVERVIEW</span>
              <SiteSwitcher
                sites={sites}
                activeSiteId={activeSiteId}
                onSelect={setActiveSiteId}
                onAddSite={onOpenAddSiteModal}
              />
            </div>
            <button type="button" className="dnx-connect-cta" onClick={onOpenAddSiteModal}>
              <svg viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth={2.2} aria-hidden="true">
                <path d="M12 5v14M5 12h14" strokeLinecap="round" />
              </svg>
              Connect site
            </button>
          </div>
          <div className="dnx-hero-copy">
            <h1 className="dnx-hero-title">Welcome back{user.displayName ? `, ${user.displayName.split(' ')[0]}` : ''}</h1>
            <p className="dnx-hero-sub">Your website activity and tools, all in one place.</p>
          </div>
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
          walletBalanceUsd={accountLimits?.wallet?.balanceUsd}
          onUpgrade={() => router.push('/dashboard/plans')}
          onOpenWallet={() => router.push('/dashboard/wallet')}
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

      <WriteLimitAlertModal
        severity={writeLimitAlert.severity}
        planId={planId}
        writeUsage={accountLimits?.writeUsage}
        wallet={wallet}
        onDismiss={writeLimitAlert.dismiss}
        onUpgrade={() => {
          writeLimitAlert.dismiss();
          router.push('/dashboard/plans');
        }}
        onOpenWallet={() => {
          writeLimitAlert.dismiss();
          router.push('/dashboard/wallet');
        }}
        onEnablePayAsYouGo={() => {
          setAutoRecharge(true);
          writeLimitAlert.dismiss();
        }}
      />
    </section>
  );
}
