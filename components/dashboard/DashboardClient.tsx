'use client';

// components/dashboard/DashboardClient.tsx
//
// Client-side shell for the standalone /dashboard route (see
// app/dashboard/page.tsx). Previously the dashboard was just one branch
// of AppRoot's marketing/dashboard view switch, living at `/`; this is
// its own mount now, with its own auth gate and header/sidebar — not
// reused from AppRoot, since AppRoot's `view` state no longer needs a
// 'dashboard' branch at all (see its own updated comment).
//
// The "connect a site" flow is its own route now
// (app/dashboard/connect/page.tsx, components/connect/ConnectFlow.tsx)
// rather than a modal mounted here — openAddSiteModal below still does
// the same pre-flight /api/site-limits check it always did, but
// navigates to that route instead of opening an overlay.
import { useCallback, useEffect, useState } from 'react';
import { useNavRouter } from '@/hooks/useNavPending';
import { GlobalLoader } from '@/components/GlobalLoader';
import { Header } from '@/components/layout/Header';
import { Sidebar } from '@/components/layout/Sidebar';
import { AnalyticsPage } from '@/components/analytics/AnalyticsPage';
import { ApiPage } from '@/components/api/ApiPage';
import { VentolPlans } from '@/components/plans/VentolPlans';
import { WalletPage } from '@/components/dashboard/WalletPage';
import { SiteManagePage } from '@/components/dashboard/SiteManagePage';
import { ConnectedSitesPage } from '@/components/dashboard/ConnectedSitesPage';
import { EmailCapturePage } from '@/components/dashboard/EmailCapturePage';
import { UsersPage } from '@/components/dashboard/UsersPage';
import { AuthOverlay } from '@/components/auth/AuthOverlay';
import { AuthBlob } from '@/components/auth/AuthBlob';
import { UpsellOverlay } from '@/components/dashboard/UpsellOverlay';
import { OnboardingFlow } from '@/components/onboarding/OnboardingFlow';
import { useAuth } from '@/hooks/useAuth';
import { useSidebar } from '@/hooks/useSidebar';
import { useSites } from '@/hooks/useSites';
import { useAppliedAppearance } from '@/hooks/useAppliedAppearance';
import { useOnboardingStatus } from '@/hooks/useOnboardingStatus';
import type { AuthPane } from '@/hooks/useAuthForms';
import type { DashSection } from '@/hooks/useAppView';
import type { PlanId } from '@/lib/plans';

interface DashboardClientProps {
  // Defaults to the Analytics page — the app's main stats page now that the
  // old Dashboard overview has been removed (see
  // app/dashboard/analytics/page.tsx and
  // components/analytics/AnalyticsPage.tsx). "api" renders the
  // developer API page (see app/dashboard/api/page.tsx and
  // components/api/ApiPage.tsx). "plans" renders the
  // plan-switch/compare page (see app/dashboard/plans/page.tsx),
  // "site-manage" renders the standalone per-site management page (see
  // app/dashboard/sites/[siteId]/page.tsx and SiteManagePage.tsx),
  // "leads" renders the standalone email-capture page (see
  // app/dashboard/leads/page.tsx and EmailCapturePage.tsx), "sites"
  // renders the standalone connected sites list page (see
  // app/dashboard/sites/page.tsx and ConnectedSitesPage.tsx), "users"
  // renders the standalone unique-visitors page (see
  // app/dashboard/users/page.tsx and UsersPage.tsx) — all five while
  // still sharing this component's single auth gate, header and
  // sidebar. The old "visits" view (standalone visit-logs/stats page)
  // has been removed entirely. The profile page/component/route have
  // also been removed (a replacement is planned); onProfileClick and
  // nav links still point at /profile intentionally.
  view?: 'analytics' | 'api' | 'plans' | 'wallet' | 'site-manage' | 'leads' | 'sites' | 'users';
  // Required when view="site-manage" — the [siteId] route param,
  // passed straight through to SiteManagePage so it can look the site
  // up out of useSites() itself rather than this component owning a
  // second sites subscription just to find one site by id.
  siteId?: string;
}

// Sidebar sections that still have an anchor on the Analytics page.
// 'overview' = top of the page, 'logs' = the live log section. Sections with
// no anchor here (leads, overlay) just land on the page.
const SECTION_ELEMENT_IDS: Partial<Record<DashSection, string>> = {
  overview: 'analyticsMain',
  logs: 'live-log',
};

export default function DashboardClient({ view = 'analytics', siteId }: DashboardClientProps) {
  const router = useNavRouter();
  const { user, authReady, authError } = useAuth();
  const sidebar = useSidebar();
  // Settings > Appearance, applied app-wide (Font Size / Compact Mode —
  // see hooks/useAppliedAppearance.ts). The hook applies it as a side
  // effect, so it must stay mounted here.
  useAppliedAppearance(user);
  // useSites is now always called here (not conditionally), even
  // though only "dashboard"/"plans" actually render its
  // data — the pages below don't own their own call (that would
  // duplicate this subscription) because the single fullscreen
  // loading gate below needs to know dashState for the main
  // dashboard view too: previously that gate only waited on
  // authReady, so it closed and handed off to the page's own
  // *inline* GlobalLoader while useSites was still resolving — a
  // visible "loader closes, then a second, smaller loading state" flash.
  // Folding dashState into the one gate removes that handoff.
  // SiteManagePage still owns its own independent useSites call for
  // "site-manage" (a single-site lookup, not worth lifting here).
  const { sites, activeSiteId, setActiveSiteId, activeSite, dashState, disconnectSite } = useSites(
    user?.uid ?? null,
    user
  );

  const [authOpen, setAuthOpen] = useState(false);
  const [authPane, setAuthPane] = useState<AuthPane>('signin');
  const openAuth = useCallback((pane: AuthPane) => {
    setAuthPane(pane);
    setAuthOpen(true);
  }, []);
  const closeAuth = useCallback(() => setAuthOpen(false), []);

  // Onboarding gate — re-shows the full-screen onboarding flow on
  // EVERY visit for any signed-in account that hasn't accepted the
  // Terms & Data-Use step yet (users/{uid}.termsAcceptedAt missing).
  // This is the one place every signed-in path through the app
  // eventually lands (overview/plans/site-manage/etc. all
  // render through this component), so gating here covers all of
  // them without duplicating the check per-view. See
  // hooks/useOnboardingStatus.ts + components/onboarding/OnboardingFlow.tsx.
  const { onboardingRequired, onboardingStatusLoaded, accepting, acceptTerms } = useOnboardingStatus(user);

  // Upsell state: shown whenever the account is at its plan's
  // connected-site limit, found out via the /api/site-limits
  // pre-flight check in openAddSiteModal below (the connect route's
  // own /api/connect-site call re-checks atomically at creation time
  // regardless, so this is purely about surfacing the upsell before
  // the user even lands on that route).
  const [upsellOpen, setUpsellOpen] = useState(false);
  const [upsellInfo, setUpsellInfo] = useState<{ planId: PlanId; limit: number; used: number } | null>(null);

  const openAddSiteModal = useCallback(async () => {
    if (!user) return;
    try {
      const idToken = await user.getIdToken();
      const res = await fetch('/api/site-limits', {
        method: 'POST',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify({ idToken }),
      });
      const result = await res.json().catch(() => ({}));

      if (res.ok && result.ok && result.atLimit) {
        setUpsellInfo({ planId: result.planId, limit: result.limit, used: result.used });
        setUpsellOpen(true);
        return;
      }
    } catch (err) {
      // If the limit check itself fails (network blip, etc.), don't
      // block the user from trying to connect a site — the connect
      // route's own /api/connect-site call re-checks the limit anyway
      // and will surface the upsell then if they're genuinely over.
      // Fail open on the advisory check only.
      console.error('site-limits check failed', err);
    }
    router.push('/dashboard/connect');
  }, [user, router]);

  const closeUpsell = useCallback(() => setUpsellOpen(false), []);


  // A signed-out visitor landing straight on /dashboard (bookmark, typed
  // URL, etc.) gets the sign-in pane instead of a blank/broken page.
  //
  // The closeAuth() branch below fixes a real bug: right after signup,
  // this component can mount with authReady already true but user still
  // null for one tick — Firebase's onAuthStateChanged listener (useAuth)
  // hasn't caught up with the just-created session yet. That used to
  // open the sign-in overlay (authOpen -> true) with nothing to ever
  // close it again once `user` did populate a moment later, since every
  // other place that closes this overlay only runs from a direct user
  // action (closeAuth / onAuthSucceeded). Net effect: a brand-new user
  // would finish onboarding and land on a stale "please sign in" overlay
  // sitting on top of a dashboard they were already authenticated into —
  // closing it (closeAuth) was the only way out, and even then nothing
  // re-opened it, so it read as "signed out" rather than a rendering
  // glitch. Explicitly closing it here the moment `user` becomes truthy
  // keeps this effect a live two-way gate instead of a one-shot latch.
  useEffect(() => {
    if (!authReady) return;
    if (!user) {
      openAuth('signin');
    } else {
      closeAuth();
    }
  }, [authReady, user, openAuth, closeAuth]);

  function handleResumeVerification(site: { id: string; url: string }) {
    router.push(`/dashboard/connect?site=${encodeURIComponent(site.id)}&url=${encodeURIComponent(site.url)}`);
  }

  function scrollToSection(section: DashSection) {
    const id = SECTION_ELEMENT_IDS[section];
    const el = id ? document.getElementById(id) : null;
    if (el) el.scrollIntoView({ behavior: 'smooth', block: 'start' });
    else window.scrollTo({ top: 0, behavior: 'smooth' });
  }

  // Sidebar's "Visit logs" etc. links: from the Analytics page scroll to
  // the matching section; from any other view (plans, site-manage, ...)
  // navigate to /dashboard/analytics first.
  function goToSection(section: DashSection) {
    sidebar.setOpen(false);
    if (view !== 'analytics') {
      router.push('/dashboard/analytics');
      return;
    }
    scrollToSection(section);
  }

  // Data-based loading gate, PLUS a fixed 3s minimum hold. Waits on
  // auth AND, for the main dashboard view specifically, on useSites()
  // actually resolving (dashState flips off 'loading' once the
  // users/{uid}/sites snapshot has returned, whether that lands on
  // 'empty', 'main', or 'error'). Other views (plans,
  // site-manage, etc.) only need auth here — their own data loads
  // independently inside their own components, same as before.
  //
  // The 3s floor exists because auth + the initial sites snapshot can
  // both resolve in well under a second on a fast connection/warm
  // cache, which made this skeleton flash and vanish almost instantly
  // — visually jarring, and inconsistent with the global boot loader's
  // own deliberate minimum-hold timing on first load (see
  // components/GlobalLoader.tsx).
  // minHoldDone only flips true once the timer fires; the gate below
  // stays closed until BOTH the real data condition AND the timer are
  // satisfied, so this never masks genuinely slow loads, it only adds
  // a floor under fast ones.
  const dashboardDataLoading = (view === 'analytics' || view === 'api') && !!user && dashState === 'loading';
  const dataReady = authReady && !dashboardDataLoading;

  const [minHoldDone, setMinHoldDone] = useState(false);
  useEffect(() => {
    const t = setTimeout(() => setMinHoldDone(true), 3000);
    return () => clearTimeout(t);
  }, []);

  if (!dataReady || !minHoldDone) {
    return <GlobalLoader variant="inline" fullScreen label="Loading your dashboard" />;
  }

  if (authError) {
    return (
      <div style={{ minHeight: '100vh', display: 'flex', alignItems: 'center', justifyContent: 'center', padding: 24, textAlign: 'center' }}>
        <div style={{ maxWidth: 480 }}>
          <p style={{ fontWeight: 600, marginBottom: 8 }}>Something went wrong loading your dashboard.</p>
          <p style={{ color: 'var(--muted-mid)', fontSize: 14 }}>{authError}</p>
        </div>
      </div>
    );
  }

  return (
    <>
      <Header
        user={user}
        onLogoClick={() => router.push('/')}
        onSignupClick={() => openAuth('signup')}
        onProfileClick={() => router.push('/profile')}
        onHamburgerClick={() => sidebar.setOpen(true)}
      />

      <Sidebar
        open={sidebar.open}
        user={user}
        leadsCount={0}
        onClose={() => sidebar.setOpen(false)}
        onSignIn={() => openAuth('signin')}
        onNavigate={goToSection}
      />

      <main>
        {user ? (
          view === 'plans' ? (
            <VentolPlans user={user} />
          ) : view === 'api' ? (
            <ApiPage
              user={user}
              sites={sites}
              activeSiteId={activeSiteId}
              setActiveSiteId={setActiveSiteId}
              activeSite={activeSite}
              onOpenAddSiteModal={openAddSiteModal}
            />
          ) : view === 'wallet' ? (
            <WalletPage user={user} />
          ) : view === 'site-manage' && siteId ? (
            <SiteManagePage user={user} siteId={siteId} />
          ) : view === 'leads' ? (
            <EmailCapturePage user={user} />
          ) : view === 'users' ? (
            <UsersPage user={user} />
          ) : view === 'sites' ? (
            <ConnectedSitesPage
              sites={sites}
              onDisconnectSite={disconnectSite}
              onAddSite={openAddSiteModal}
              onResumeVerification={handleResumeVerification}
            />
          ) : (
            <AnalyticsPage
              user={user}
              sites={sites}
              activeSiteId={activeSiteId}
              setActiveSiteId={setActiveSiteId}
              activeSite={activeSite}
              onOpenAddSiteModal={openAddSiteModal}
              noSite={dashState === 'empty'}
            />
          )
        ) : (
          <section>
            <div className="dashboard-empty">
              <div className="dash-empty-inner">
                <AuthBlob />
                <h2>Sign in to view your analytics</h2>
                <p>Connect your sites, see live visits, and push banners once you&apos;re signed in.</p>
                <button className="btn-primary" onClick={() => openAuth('signin')}>
                  Sign in
                </button>
              </div>
            </div>
          </section>
        )}
      </main>


      {upsellInfo && (
        <UpsellOverlay
          open={upsellOpen}
          planId={upsellInfo.planId}
          limit={upsellInfo.limit}
          used={upsellInfo.used}
          onClose={closeUpsell}
          onUpgrade={() => {
            closeUpsell();
            router.push('/dashboard/plans');
          }}
        />
      )}

      <AuthOverlay
        open={authOpen}
        initialPane={authPane}
        onClose={closeAuth}
        onAuthSucceeded={() => closeAuth()}
      />

      {/* Mounted above everything once we positively know the account
          hasn't accepted terms yet (onboardingStatusLoaded guards
          against flashing this for an already-onboarded user while
          the first Firestore snapshot is still in flight). Cannot be
          dismissed except by completing it — see OnboardingFlow.tsx. */}
      <OnboardingFlow
        open={!!user && onboardingStatusLoaded && onboardingRequired}
        accepting={accepting}
        onComplete={acceptTerms}
      />
    </>
  );
}
