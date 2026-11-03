'use client';

// components/AppRoot.tsx — the marketing-site shell: mounts Header /
// Sidebar / MarketingPage / AuthOverlay together. The
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
import { Header } from '@/components/layout/Header';
import { Sidebar } from '@/components/layout/Sidebar';
import { MarketingPage } from '@/components/marketing/MarketingPage';
import { AuthOverlay } from '@/components/auth/AuthOverlay';
import { InstallPromptOverlay } from '@/components/InstallPromptOverlay';
import { OnboardingFlow } from '@/components/onboarding/OnboardingFlow';
import { GlobalLoader } from '@/components/GlobalLoader';
import { BootNetworkToast } from '@/components/BootNetworkToast';
import { useAuth } from '@/hooks/useAuth';
import { useAppView } from '@/hooks/useAppView';
import { useSidebar } from '@/hooks/useSidebar';
import { useInstallPrompt } from '@/hooks/useInstallPrompt';
import { useAppliedAppearance } from '@/hooks/useAppliedAppearance';
import { useOnboardingStatus } from '@/hooks/useOnboardingStatus';
import type { AuthPane } from '@/hooks/useAuthForms';

export default function AppRoot() {
  const { user, authReady, authError } = useAuth();
  const sidebar = useSidebar();

  // Boot loader: shown for up to 5s while Firebase auth settles. If
  // authReady flips true within that window, it closes normally. If
  // not, it still closes (never hangs) and shows the "No network —
  // Try again" toast below instead. See components/GlobalLoader.tsx
  // (variant="boot") for the phase/timeout logic — this is also the
  // one and only loading screen in the app now; the old separate
  // cartoon-hero loader that used to show again underneath this one
  // on the mobile marketing page has been removed.
  const [bootDone, setBootDone] = useState(false);
  const [bootTimedOut, setBootTimedOut] = useState(false);
  const [networkToastOpen, setNetworkToastOpen] = useState(false);
  // Settings > Appearance (Font Size / Compact Mode) applied app-wide —
  // see hooks/useAppliedAppearance.ts.
  useAppliedAppearance(user);

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

  // authError is checked first: if the real page is genuinely broken
  // (not just still booting), it replaces the page tree rather than
  // sitting under a splash that will never resolve.
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
      {!bootDone && (
        <GlobalLoader
          variant="boot"
          ready={authReady}
          onDone={() => {
            setBootDone(true);
            if (bootTimedOut) setNetworkToastOpen(true);
          }}
          onTimeout={() => setBootTimedOut(true)}
        />
      )}

      <BootNetworkToast
        open={networkToastOpen}
        onRetry={() => {
          if (typeof window !== 'undefined') window.location.reload();
        }}
        onDismiss={() => setNetworkToastOpen(false)}
      />

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

      <main className="marketing-main">
        <MarketingPage onConnectClick={handleConnectCTA} />
      </main>


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
    </>
  );
}
