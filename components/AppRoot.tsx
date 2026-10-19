'use client';

// components/AppRoot.tsx — all the interactive logic that used to live
// directly in app/page.tsx: the top-level view switch (marketing vs
// dashboard), and mounting Header / Sidebar / MarketingPage /
// DashboardShell / AuthOverlay / ConnectSiteWizard / footers together,
// the way the original's inline <script> wired global functions to DOM
// nodes.
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
import { useCallback, useEffect, useState } from 'react';
import { BootSplash } from '@/components/BootSplash';
import { Header } from '@/components/layout/Header';
import { Sidebar } from '@/components/layout/Sidebar';
import { SiteFooter } from '@/components/layout/SiteFooter';
import { DashFooter } from '@/components/layout/DashFooter';
import { MarketingPage } from '@/components/marketing/MarketingPage';
import { DashboardShell } from '@/components/dashboard/DashboardShell';
import { AuthOverlay } from '@/components/auth/AuthOverlay';
import { ConnectSiteWizard, type ConnectSiteResumeTarget } from '@/components/connect/ConnectSiteWizard';
import { useAuth } from '@/hooks/useAuth';
import { useAppView } from '@/hooks/useAppView';
import { useSidebar } from '@/hooks/useSidebar';
import type { AuthPane } from '@/hooks/useAuthForms';

export default function AppRoot() {
  const { user, authReady, authError } = useAuth();
  const sidebar = useSidebar();

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

  const [connectOpen, setConnectOpen] = useState(false);
  const [connectResumeTarget, setConnectResumeTarget] = useState<ConnectSiteResumeTarget | null>(null);
  const openAddSiteModal = useCallback(() => {
    setConnectResumeTarget(null);
    setConnectOpen(true);
  }, []);
  const closeConnectModal = useCallback(() => setConnectOpen(false), []);

  const [leadsCount, setLeadsCount] = useState(0);

  // Escape closes whichever modal (connect wizard) is currently open —
  // mirrors the original's global keydown listener targeting
  // #connectOverlay.
  useEffect(() => {
    function handleEscape(e: KeyboardEvent) {
      if (e.key === 'Escape' && connectOpen) closeConnectModal();
    }
    document.addEventListener('keydown', handleEscape);
    return () => document.removeEventListener('keydown', handleEscape);
  }, [connectOpen, closeConnectModal]);

  function handleResumeVerification(site: { id: string; url: string }) {
    setConnectResumeTarget(site);
    setConnectOpen(true);
  }

  function handleConnectFinished() {
    // siteId isn't consumed here — DashboardShell's useSites hook picks
    // a sensible active site on its own once the new site appears,
    // mirroring the original's finishConnectFlow() which just calls
    // goToDashboard() with no explicit site argument.
    setConnectOpen(false);
    setConnectResumeTarget(null);
    goToDashboard('overview');
  }

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
          <p style={{ color: '#6b655c', fontSize: 14 }}>{authError}</p>
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
        {view === 'marketing' && (
          <MarketingPage onConnectClick={handleConnectCTA} />
        )}

        {view === 'dashboard' && user && (
          <DashboardShell
            user={user}
            onOpenAddSiteModal={openAddSiteModal}
            onResumeVerification={handleResumeVerification}
            onLeadsCountChange={setLeadsCount}
          />
        )}
      </main>

      {view === 'marketing' ? (
        <SiteFooter />
      ) : (
        <DashFooter onBackToMarketing={showMarketing} />
      )}

      <ConnectSiteWizard
        open={connectOpen}
        uid={user?.uid ?? null}
        resumeTarget={connectResumeTarget}
        onClose={closeConnectModal}
        onFinished={handleConnectFinished}
      />

      <AuthOverlay
        open={authOpen}
        initialPane={authPane}
        onClose={closeAuth}
        onAuthSucceeded={() => {
          closeAuth();
          goToDashboard('overview');
        }}
      />
    </>
  );
}
