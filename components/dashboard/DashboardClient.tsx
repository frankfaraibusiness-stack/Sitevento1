'use client';

// components/dashboard/DashboardClient.tsx
//
// Client-side shell for the standalone /dashboard route (see
// app/dashboard/page.tsx). Previously the dashboard was just one branch
// of AppRoot's marketing/dashboard view switch, living at `/`; this is
// its own mount now, with its own auth gate, header/sidebar and connect
// wizard wiring — not reused from AppRoot, since AppRoot's `view` state
// no longer needs a 'dashboard' branch at all (see its own updated
// comment).
import { useCallback, useEffect, useState } from 'react';
import { useSearchParams } from 'next/navigation';
import { useNavRouter } from '@/hooks/useNavPending';
import { AppSkeleton } from '@/components/AppSkeleton';
import { Header } from '@/components/layout/Header';
import { Sidebar } from '@/components/layout/Sidebar';
import { SiteFooter } from '@/components/layout/SiteFooter';
import { DashboardShell } from '@/components/dashboard/DashboardShell';
import { ProfilePage } from '@/components/dashboard/ProfilePage';
import { PlansPage } from '@/components/dashboard/PlansPage';
import { SiteManagePage } from '@/components/dashboard/SiteManagePage';
import { AuthOverlay } from '@/components/auth/AuthOverlay';
import { UpsellOverlay } from '@/components/dashboard/UpsellOverlay';
import { ConnectSiteWizard, type ConnectSiteResumeTarget } from '@/components/connect/ConnectSiteWizard';
import { useAuth } from '@/hooks/useAuth';
import { useSidebar } from '@/hooks/useSidebar';
import { useSites } from '@/hooks/useSites';
import { useUserProfile } from '@/hooks/useUserProfile';
import { useAppliedAppearance } from '@/hooks/useAppliedAppearance';
import type { AuthPane } from '@/hooks/useAuthForms';
import type { DashSection } from '@/hooks/useAppView';
import type { LimitStatus } from '@/hooks/useConnectSiteWizard';
import type { PlanId } from '@/lib/plans';

interface DashboardClientProps {
  // Defaults to the main dashboard. "profile" renders the account page
  // instead (see app/dashboard/profile/page.tsx), "plans" renders the
  // plan-switch/compare page (see app/dashboard/plans/page.tsx),
  // "site-manage" renders the standalone per-site management page (see
  // app/dashboard/sites/[siteId]/page.tsx and SiteManagePage.tsx) —
  // all three while still sharing this component's single auth gate,
  // header and sidebar.
  view?: 'dashboard' | 'profile' | 'plans' | 'site-manage';
  // Required when view="site-manage" — the [siteId] route param,
  // passed straight through to SiteManagePage so it can look the site
  // up out of useSites() itself rather than this component owning a
  // second sites subscription just to find one site by id.
  siteId?: string;
}

const SECTION_ELEMENT_IDS: Record<DashSection, string> = {
  overview: 'dashMain',
  logs: 'panelVisits',
  leads: 'panelLeads',
  overlay: 'panelOverlay',
};

// Appearance panel's landingView values -> DashSection. 'sites' has no
// dedicated in-page section on the main dashboard scroll (Connected
// Sites lives inline under Overview), so it maps to 'overview' too.
const LANDING_VIEW_SECTION: Record<string, DashSection> = {
  overview: 'overview',
  visits: 'logs',
  leads: 'leads',
  sites: 'overview',
};

export default function DashboardClient({ view = 'dashboard', siteId }: DashboardClientProps) {
  const router = useNavRouter();
  const searchParams = useSearchParams();
  const { user, authReady, authError } = useAuth();
  // Account plan, read here so ConnectSiteWizard's step-1 permissions
  // grid (components/connect/ConnectPermissionsGrid.tsx) knows which
  // grants are already unlocked vs. which show an "Upgrade" pill —
  // same hook AgentPageClient uses for its own plan-gated pickers.
  const { planId } = useUserProfile(user);
  const sidebar = useSidebar();
  // Settings > Appearance, applied app-wide (Font Size / Compact Mode —
  // see hooks/useAppliedAppearance.ts) and read here for Dashboard
  // Landing View: which section the main dashboard view auto-scrolls to
  // right after it mounts.
  const { settings: userSettings, loaded: userSettingsLoaded } = useAppliedAppearance(user);
  // Only the profile/plans views need the sites list at this level —
  // DashboardShell already owns its own useSites call for the main
  // dashboard view, and SiteManagePage owns its own for "site-manage".
  // "plans" only needs the list itself (for the usage banner), not
  // disconnectSite.
  const { sites, disconnectSite } = useSites(view === 'profile' || view === 'plans' ? (user?.uid ?? null) : null);

  const [authOpen, setAuthOpen] = useState(false);
  const [authPane, setAuthPane] = useState<AuthPane>('signin');
  const openAuth = useCallback((pane: AuthPane) => {
    setAuthPane(pane);
    setAuthOpen(true);
  }, []);
  const closeAuth = useCallback(() => setAuthOpen(false), []);

  const [connectOpen, setConnectOpen] = useState(false);
  const [connectResumeTarget, setConnectResumeTarget] = useState<ConnectSiteResumeTarget | null>(null);

  // Upsell state: shown instead of the wizard whenever the account is
  // at its plan's connected-site limit. Populated either (a) by the
  // /api/site-limits check below, before the wizard ever opens, or
  // (b) by ConnectSiteWizard's onLimitReached safety net if the
  // account hits the limit in the race window between that check and
  // actually submitting the domain form (see that prop's comment).
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
      // block the user from trying to connect a site — the wizard's
      // own /api/connect-site call re-checks the limit anyway and will
      // surface the upsell then if they're genuinely over, via
      // onLimitReached below. Fail open on the advisory check only.
      console.error('site-limits check failed', err);
    }
    setConnectResumeTarget(null);
    setConnectOpen(true);
  }, [user]);

  const closeConnectModal = useCallback(() => setConnectOpen(false), []);
  const closeUpsell = useCallback(() => setUpsellOpen(false), []);

  function handleWizardLimitReached(status: LimitStatus) {
    setConnectOpen(false);
    setUpsellInfo({ planId: (status.planId as PlanId) || 'free', limit: status.limit || 0, used: status.used || 0 });
    setUpsellOpen(true);
  }

  const [leadsCount, setLeadsCount] = useState(0);

  useEffect(() => {
    function handleEscape(e: KeyboardEvent) {
      if (e.key === 'Escape' && connectOpen) closeConnectModal();
    }
    document.addEventListener('keydown', handleEscape);
    return () => document.removeEventListener('keydown', handleEscape);
  }, [connectOpen, closeConnectModal]);

  // A signed-out visitor landing straight on /dashboard (bookmark, typed
  // URL, etc.) gets the sign-in pane instead of a blank/broken page.
  useEffect(() => {
    if (authReady && !user) openAuth('signin');
  }, [authReady, user, openAuth]);

  // Marketing page's "Connect your site" CTA routes signed-in users to
  // /dashboard?connect=1 (see hooks/useAppView.ts's handleConnectCTA) so
  // the wizard opens immediately instead of landing the user on the
  // dashboard with an extra click still needed.
  useEffect(() => {
    if (authReady && user && searchParams.get('connect') === '1') {
      openAddSiteModal();
      router.replace('/dashboard');
    }
  }, [authReady, user, searchParams, openAddSiteModal, router]);

  function handleResumeVerification(site: { id: string; url: string }) {
    setConnectResumeTarget(site);
    setConnectOpen(true);
  }

  function handleConnectFinished() {
    setConnectOpen(false);
    setConnectResumeTarget(null);
  }

  function scrollToSection(section: DashSection) {
    const el = document.getElementById(SECTION_ELEMENT_IDS[section] || 'dashMain');
    if (el) el.scrollIntoView({ behavior: 'smooth', block: 'start' });
  }

  // On landing on the main dashboard view (not profile/plans/site-manage,
  // and not already mid-connect-flow), jump straight to the section the
  // user picked in Appearance > Dashboard Landing View, once per mount.
  // DashboardShell's child panels (and the Firestore-backed landingView
  // value itself) can both still be loading on the first paint, so this
  // polls briefly for the target element instead of assuming one
  // requestAnimationFrame is enough.
  const [landedOnSection, setLandedOnSection] = useState(false);
  useEffect(() => {
    if (landedOnSection) return;
    if (view !== 'dashboard' || !user) return;
    if (!userSettingsLoaded) return; // wait for the real saved value — don't act on the 'overview' default
    if (searchParams.get('connect') === '1') return; // let the connect-wizard effect above take this mount instead
    const target = LANDING_VIEW_SECTION[userSettings.landingView] || 'overview';
    if (target === 'overview') {
      setLandedOnSection(true);
      return;
    }
    let attempts = 0;
    let raf: number;
    const tryScroll = () => {
      const el = document.getElementById(SECTION_ELEMENT_IDS[target]);
      if (el) {
        el.scrollIntoView({ behavior: 'auto', block: 'start' });
        setLandedOnSection(true);
        return;
      }
      attempts += 1;
      if (attempts > 60) {
        // ~1s at 60fps — panel never showed up (e.g. still loading
        // sites); give up quietly rather than polling forever.
        setLandedOnSection(true);
        return;
      }
      raf = requestAnimationFrame(tryScroll);
    };
    raf = requestAnimationFrame(tryScroll);
    return () => cancelAnimationFrame(raf);
  }, [landedOnSection, view, user, userSettingsLoaded, searchParams, userSettings.landingView]);

  // Sidebar's "Dashboard"/"Visit logs"/"Email capture"/etc. links only
  // make sense as in-page scrolls when the main dashboard view is
  // already mounted (those section ids only exist there). From any
  // other view (profile, plans, site-manage) navigate to /dashboard
  // first — the section can't be scrolled to until that view mounts,
  // so land on the plain dashboard rather than silently doing nothing.
  function goToSection(section: DashSection) {
    sidebar.setOpen(false);
    if (view !== 'dashboard') {
      router.push('/dashboard');
      return;
    }
    scrollToSection(section);
  }

  if (!authReady) return <AppSkeleton fullScreen label="Loading your dashboard" />;

  if (authError) {
    return (
      <div style={{ minHeight: '100vh', display: 'flex', alignItems: 'center', justifyContent: 'center', padding: 24, textAlign: 'center' }}>
        <div style={{ maxWidth: 480 }}>
          <p style={{ fontWeight: 600, marginBottom: 8 }}>Something went wrong loading your dashboard.</p>
          <p style={{ color: '#6b655c', fontSize: 14 }}>{authError}</p>
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
        onProfileClick={() => goToSection('overview')}
        onHamburgerClick={() => sidebar.setOpen(true)}
      />

      <Sidebar
        open={sidebar.open}
        user={user}
        leadsCount={leadsCount}
        onClose={() => sidebar.setOpen(false)}
        onSignIn={() => openAuth('signin')}
        onNavigate={goToSection}
        onOpenProfile={() => {
          sidebar.setOpen(false);
          router.push('/dashboard/profile');
        }}
      />

      <main>
        {user ? (
          view === 'profile' ? (
            <ProfilePage
              user={user}
              sites={sites}
              onDisconnectSite={disconnectSite}
              onAddSite={openAddSiteModal}
            />
          ) : view === 'plans' ? (
            <PlansPage user={user} sites={sites} />
          ) : view === 'site-manage' && siteId ? (
            <SiteManagePage user={user} siteId={siteId} />
          ) : (
            <DashboardShell
              user={user}
              onOpenAddSiteModal={openAddSiteModal}
              onResumeVerification={handleResumeVerification}
              onLeadsCountChange={setLeadsCount}
            />
          )
        ) : (
          <section>
            <div className="dashboard-empty">
              <div className="dash-empty-inner">
                <h2>Sign in to view your dashboard</h2>
                <p>Connect your sites, see live visits, and push banners once you&apos;re signed in.</p>
                <button className="btn-primary" onClick={() => openAuth('signin')}>
                  Sign in
                </button>
              </div>
            </div>
          </section>
        )}
      </main>

      <SiteFooter />

      <ConnectSiteWizard
        open={connectOpen}
        uid={user?.uid ?? null}
        plan={planId}
        resumeTarget={connectResumeTarget}
        onClose={closeConnectModal}
        onFinished={handleConnectFinished}
        onLimitReached={handleWizardLimitReached}
        onUpgradeClick={() => {
          closeConnectModal();
          router.push('/dashboard/plans');
        }}
      />

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
    </>
  );
}
