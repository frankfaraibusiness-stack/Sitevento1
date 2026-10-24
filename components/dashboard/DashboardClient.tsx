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
import { AppSkeleton } from '@/components/AppSkeleton';
import { Header } from '@/components/layout/Header';
import { Sidebar } from '@/components/layout/Sidebar';
import { SiteFooter } from '@/components/layout/SiteFooter';
import { DashboardShell } from '@/components/dashboard/DashboardShell';
import { ProfilePage } from '@/components/dashboard/ProfilePage';
import { PlansPage } from '@/components/dashboard/PlansPage';
import { SiteManagePage } from '@/components/dashboard/SiteManagePage';
import { VisitsPage } from '@/components/dashboard/VisitsPage';
import { AuthOverlay } from '@/components/auth/AuthOverlay';
import { AuthBlob } from '@/components/auth/AuthBlob';
import { UpsellOverlay } from '@/components/dashboard/UpsellOverlay';
import { useAuth } from '@/hooks/useAuth';
import { useSidebar } from '@/hooks/useSidebar';
import { useSites } from '@/hooks/useSites';
import { useAppliedAppearance } from '@/hooks/useAppliedAppearance';
import type { AuthPane } from '@/hooks/useAuthForms';
import type { DashSection } from '@/hooks/useAppView';
import type { PlanId } from '@/lib/plans';

interface DashboardClientProps {
  // Defaults to the main dashboard. "profile" renders the account page
  // instead (see app/dashboard/profile/page.tsx), "plans" renders the
  // plan-switch/compare page (see app/dashboard/plans/page.tsx),
  // "site-manage" renders the standalone per-site management page (see
  // app/dashboard/sites/[siteId]/page.tsx and SiteManagePage.tsx),
  // "visits" renders the standalone visit-logs page (see
  // app/dashboard/visits/page.tsx and VisitsPage.tsx) — all four while
  // still sharing this component's single auth gate, header and
  // sidebar.
  view?: 'dashboard' | 'profile' | 'plans' | 'site-manage' | 'visits';
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
  const { user, authReady, authError } = useAuth();
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

  const [leadsCount, setLeadsCount] = useState(0);

  // A signed-out visitor landing straight on /dashboard (bookmark, typed
  // URL, etc.) gets the sign-in pane instead of a blank/broken page.
  useEffect(() => {
    if (authReady && !user) openAuth('signin');
  }, [authReady, user, openAuth]);

  function handleResumeVerification(site: { id: string; url: string }) {
    router.push(`/dashboard/connect?site=${encodeURIComponent(site.id)}&url=${encodeURIComponent(site.url)}`);
  }

  function scrollToSection(section: DashSection) {
    const el = document.getElementById(SECTION_ELEMENT_IDS[section] || 'dashMain');
    if (el) el.scrollIntoView({ behavior: 'smooth', block: 'start' });
  }

  // On landing on the main dashboard view (not profile/plans/site-manage),
  // jump straight to the section the user picked in Appearance >
  // Dashboard Landing View, once per mount. DashboardShell's child
  // panels (and the Firestore-backed landingView value itself) can
  // both still be loading on the first paint, so this polls briefly
  // for the target element instead of assuming one
  // requestAnimationFrame is enough.
  const [landedOnSection, setLandedOnSection] = useState(false);
  useEffect(() => {
    if (landedOnSection) return;
    if (view !== 'dashboard' || !user) return;
    if (!userSettingsLoaded) return; // wait for the real saved value — don't act on the 'overview' default
    const target = LANDING_VIEW_SECTION[userSettings.landingView] || 'overview';
    if (target === 'overview') {
      setLandedOnSection(true);
      return;
    }
    // "Visits" now has its own dedicated page (see VisitsPage.tsx)
    // rather than an in-page anchor — redirect there instead of
    // scrolling to a section id that no longer exists on this view.
    if (target === 'logs') {
      setLandedOnSection(true);
      router.replace('/dashboard/visits');
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
  }, [landedOnSection, view, user, userSettingsLoaded, userSettings.landingView]);

  // Sidebar's "Dashboard"/"Email capture"/etc. links only make sense as
  // in-page scrolls when the main dashboard view is already mounted
  // (those section ids only exist there). From any other view
  // (profile, plans, site-manage, visits) navigate to /dashboard first
  // — the section can't be scrolled to until that view mounts, so land
  // on the plain dashboard rather than silently doing nothing.
  //
  // "Visit logs" is the one exception: it now has its own dedicated
  // page (see VisitsPage.tsx) rather than an in-page anchor, so it
  // always navigates there regardless of the current view.
  function goToSection(section: DashSection) {
    sidebar.setOpen(false);
    if (section === 'logs') {
      router.push('/dashboard/visits');
      return;
    }
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
          ) : view === 'visits' ? (
            <VisitsPage user={user} />
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
                <AuthBlob />
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
