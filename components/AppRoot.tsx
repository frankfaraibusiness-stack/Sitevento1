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
import { useAuth } from '@/hooks/useAuth';
import { useAppView } from '@/hooks/useAppView';
import { useSidebar } from '@/hooks/useSidebar';
import { useInstallPrompt } from '@/hooks/useInstallPrompt';
import { useAppliedAppearance } from '@/hooks/useAppliedAppearance';
import type { AuthPane } from '@/hooks/useAuthForms';

export default function AppRoot() {
  const { user, authReady, authError } = useAuth();
  const sidebar = useSidebar();
  // Settings > Appearance (Font Size / Compact Mode) applied app-wide —
  // see hooks/useAppliedAppearance.ts.
  useAppliedAppearance(user);

  // The boot splash now runs its own full randomized lifecycle (form
  // for ~3s, splash, hold for a random 3-5s) rather than just
  // disappearing the instant authReady flips true — on a fast
  // connection authReady can resolve in well under a second, which
  // would otherwise cut the splash off mid-animation almost every time.
  // splashDone only flips once BootSplash's onDone fires; until then we
  // keep rendering it even if auth already finished underneath it.
  const [splashDone, setSplashDone] = useState(false);

  const [authOpen, setAuthOpen] = useState(false);
  const [authPane, setAuthPane] = useState<AuthPane>('signin');
  const openAuth = useCallback((pane: AuthPane) => {
    setAuthPane(pane);
    setAuthOpen(true);
  }, []);
  const closeAuth = useCallback(() => setAuthOpen(false), []);

  const { view, goToDashboard, goToProfile, showMarketing, handleConnectCTA } = useAppView(user, openAuth);

  const [leadsCount, setLeadsCount] = useState(0);

  // Install-the-app upsell — only worth showing once someone is signed
  // in and looking at their dashboard (not over the marketing site or
  // mid-auth/boot), and only if the platform actually told us it's
  // installable (canInstall) and it isn't already installed.
  const { canInstall, installed } = useInstallPrompt();
  const [installDismissed, setInstallDismissed] = useState(false);
  const installOpen = view === 'dashboard' && !!user && canInstall && !installed && !installDismissed;

  if (!authReady || !splashDone) {
    return <BootSplash onDone={() => setSplashDone(true)} />;
  }

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
          goToDashboard('overview');
        }}
      />

      <InstallPromptOverlay open={installOpen} onClose={() => setInstallDismissed(true)} />
    </>
  );
}
