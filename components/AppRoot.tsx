'use client';

// components/AppRoot.tsx — the marketing-site shell: mounts Header /
// Sidebar / MarketingPage / AuthOverlay / footers together. The
// dashboard and the connect-site flow are both their own routes now
// (see app/dashboard/page.tsx and app/dashboard/connect/page.tsx), so
// this component only ever renders the marketing view — see
// useAppView's own header comment.
//
// This is a separate file from app/page.tsx specifically so page.tsx
// itself can stay a plain Server Component. A route segment's `export
// const dynamic = 'force-dynamic'` is only honored by Next.js when it's
// read from a Server Component — exporting it from a 'use client' page
// file is silently ignored, and `next build` still tries to statically
// prerender the route, executing this tree on the server at build time
// before real NEXT_PUBLIC_FIREBASE_* values are available in that
// context (lib/firebase.ts throws auth/invalid-api-key). Moving all of
// this into a child client component, imported by a server page.tsx
// that declares `dynamic`, makes the force-dynamic setting actually
// take effect.
import { useCallback, useState } from 'react';
import { BootSplash } from '@/components/BootSplash';
import { Header } from '@/components/layout/Header';
import { Sidebar } from '@/components/layout/Sidebar';
import { SiteFooter } from '@/components/layout/SiteFooter';
import { MarketingPage } from '@/components/marketing/MarketingPage';
import { AuthOverlay } from '@/components/auth/AuthOverlay';
import { InstallPromptOverlay } from '@/components/InstallPromptOverlay';
import { OnboardingFlow } from '@/components/onboarding/OnboardingFlow';
import { useAuth } from '@/hooks/useAuth';
import { useAppView } from '@/hooks/useAppView';
import { useSidebar } from '@/hooks/useSidebar';
import { useScrollLock } from '@/hooks/useScrollLock';
import { useInstallPrompt } from '@/hooks/useInstallPrompt';
import { useAppliedAppearance } from '@/hooks/useAppliedAppearance';
import { useOnboardingStatus } from '@/hooks/useOnboardingStatus';
import type { AuthPane } from '@/hooks/useAuthForms';

export default function AppRoot() {
  const { user, authReady, authError } = useAuth();
  const sidebar = useSidebar();
  // Settings > Appearance (Font Size / Compact Mode) applied app-wide —
  // see hooks/useAppliedAppearance.ts.
  useAppliedAppearance(user);

  // BootSplash owns its own phase timeline and will not leave its
  // "connecting" phase until the `ready` prop below (authReady) is
  // true, then holds for a further fixed delay on top of that (see
  // MIN_CONFIRMED_HOLD_MS in BootSplash.tsx) before it's allowed to
  // close — so total boot time always scales with real auth latency
  // instead of ever being cut short on a fast connection. splashDone
  // only flips once BootSplash's onDone fires; until then we keep
  // rendering it even if auth already finished underneath it.
  const [splashDone, setSplashDone] = useState(false);

  const [authOpen, setAuthOpen] = useState(false);
  const [authPane, setAuthPane] = useState<AuthPane>('signin');
  const openAuth = useCallback((pane: AuthPane) => {
    setAuthPane(pane);
    setAuthOpen(true);
  }, []);
  const closeAuth = useCallback(() => setAuthOpen(false), []);

  const { view, goToDashboard, goToProfile, showMarketing, handleConnectCTA } = useAppView(user, openAuth);

  // Same onboarding gate DashboardClient.tsx uses (see that file's
  // comment + hooks/useOnboardingStatus.ts). Mounted here too so a
  // brand-new signup sees onboarding immediately on the marketing page
  // itself, instead of a flash of the marketing homepage while
  // goToDashboard('overview') below is still navigating.
  const { onboardingRequired, onboardingStatusLoaded, accepting, acceptTerms } = useOnboardingStatus(user);

  const [leadsCount, setLeadsCount] = useState(0);

  // Install-the-app upsell — only worth showing once someone is signed
  // in and looking at their dashboard (not over the marketing site or
  // mid-auth/boot), and only if the platform actually told us it's
  // installable (canInstall) and it isn't already installed.
  const { canInstall, installed } = useInstallPrompt();
  const [installDismissed, setInstallDismissed] = useState(false);
  const installOpen = view === 'dashboard' && !!user && canInstall && !installed && !installDismissed;

  const booting = !authReady || !splashDone;

  // The real page is now mounted underneath the splash (see booting
  // comment below), so without this, the page could be scrolled while
  // still hidden behind the opaque splash — landing the person
  // partway down the page the instant it reveals. BootSplash's own
  // CSS only sets overflow:hidden on itself, not body, so this lock
  // has to live here. Shared lock (hooks/useScrollLock.ts) — pins body
  // in place instead of just setting overflow:hidden, which never
  // stopped iOS touch-scroll of the page behind a fixed overlay.
  useScrollLock(booting);

  // BootSplash is rendered as a true overlay (it's position:fixed,
  // inset:0, z-index:9999 — see styles/base/boot-splash.css) ALONGSIDE
  // the real page tree below, not instead of it. This used to be a
  // hard `if (booting) return <BootSplash />` that skipped mounting
  // Header/MarketingPage/Sidebar entirely until the splash closed —
  // which meant the moment splashDone flipped true, React had to
  // mount and paint the ENTIRE marketing page (Hero, every section,
  // the footer) for the first time in one instant. On a slower device
  // that first paint is visibly slow, which read as "boot closes,
  // homepage is blank for a few seconds." It also meant
  // ControlMoments/CapabilitiesAndStats' useScrollReveal cards
  // registered their IntersectionObserver for the first time mid-
  // layout, right as the page appeared — if a card's real position
  // hadn't settled yet when the observer took its one-time initial
  // reading, it could read as not-yet-intersecting and never get a
  // second check (register() unobserves after the first hit), leaving
  // it stuck at opacity:0 until manually scrolled past and back.
  //
  // Mounting everything up front means the whole tree is already
  // built, laid out, and painted (just hidden behind the opaque
  // splash) by the time splashDone flips — so closing the splash is a
  // simple fade/reveal of already-rendered content, and every
  // scroll-reveal card gets its real, settled position on first
  // observe().
  //
  // authError is checked for all other cases: if the real page is
  // genuinely broken (not just still booting), it replaces the page
  // tree rather than sitting under a splash that will never resolve.
  if (authError) {
    return (
      <div
        style={{
          minHeight: '100vh',
          display: 'flex',
          alignItems: 'center',
          justifyContent: 'center',
          padding: '24px',
          textAlign: 'center',
        }}
      >
        <div style={{ maxWidth: 480 }}>
          <p style={{ fontWeight: 600, marginBottom: 8 }}>Something went wrong loading the app.</p>
          <p style={{ color: 'var(--muted-mid)', fontSize: 14 }}>{authError}</p>
        </div>
      </div>
    );
  }

  return (
    <>
      <Header
        user={user}
        onLogoClick={showMarketing}
        onSignupClick={() => openAuth('signup')}
        onProfileClick={goToProfile}
        onHamburgerClick={() => sidebar.setOpen(true)}
      />

      <Sidebar
        open={sidebar.open}
        user={user}
        leadsCount={leadsCount}
        onClose={() => sidebar.setOpen(false)}
        onSignIn={() => openAuth('signin')}
        onNavigate={(section) => goToDashboard(section)}
        onOpenProfile={goToProfile}
      />

      <main>
        <MarketingPage onConnectClick={handleConnectCTA} />
      </main>

      <SiteFooter />

      <AuthOverlay
        open={authOpen}
        initialPane={authPane}
        onClose={closeAuth}
        onAuthSucceeded={() => {
          closeAuth();
          // Always head to the dashboard regardless of isNewUser — the
          // onboarding overlay below (and DashboardClient.tsx's own
          // copy of the same gate) is what actually decides whether to
          // show onboarding, driven by Firestore's termsAcceptedAt
          // rather than this one-shot signup flag. That's what makes
          // onboarding re-appear on every later visit too, not just
          // immediately after signup.
          goToDashboard('overview');
        }}
      />

      <InstallPromptOverlay open={installOpen} onClose={() => setInstallDismissed(true)} />

      {/* Same gate as components/dashboard/DashboardClient.tsx — see
          that file's comment. Mounted here too so it appears
          immediately on signup, before the goToDashboard('overview')
          navigation above even finishes. */}
      <OnboardingFlow
        open={!!user && onboardingStatusLoaded && onboardingRequired}
        accepting={accepting}
        onComplete={acceptTerms}
      />

      {booting && <BootSplash ready={authReady} onDone={() => setSplashDone(true)} />}
    </>
  );
}
