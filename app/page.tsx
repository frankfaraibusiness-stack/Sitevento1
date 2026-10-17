'use client';

// app/page.tsx — replaces everything in <body> that isn't already its
// own component: the top-level view switch (marketing vs dashboard),
// and mounting Header / Sidebar / MarketingPage / DashboardShell /
// AuthOverlay / ConnectSiteWizard / footers together, the way the
// original's inline <script> wired global functions to DOM nodes.
import { useCallback, useEffect, useState } from 'react';
import { Header } from '@/components/layout/Header';
import { Sidebar } from '@/components/layout/Sidebar';
import { MarketingFooter } from '@/components/layout/MarketingFooter';
import { DashFooter } from '@/components/layout/DashFooter';
import { MarketingPage } from '@/components/marketing/MarketingPage';
import { DashboardShell } from '@/components/dashboard/DashboardShell';
import { AuthOverlay } from '@/components/auth/AuthOverlay';
import { ConnectSiteWizard, type ConnectSiteResumeTarget } from '@/components/connect/ConnectSiteWizard';
import { useAuth } from '@/hooks/useAuth';
import { useAppView } from '@/hooks/useAppView';
import { useSidebar } from '@/hooks/useSidebar';
import type { AuthPane } from '@/hooks/useAuthForms';

// Firebase (lib/firebase.ts) initializes at module-evaluation time, and
// useAuth() calls getAuth()/onAuthStateChanged() on mount. Without this,
// `next build` prerenders "/" statically at build time, which runs this
// client component on the server before real NEXT_PUBLIC_FIREBASE_*
// values are necessarily valid in that context — causing the build to
// fail with `auth/invalid-api-key`. Forcing dynamic rendering means this
// page is only ever rendered per-request (server) or in the browser,
// both of which have real env vars, never at build time.
export const dynamic = 'force-dynamic';

export default function Page() {
  const { user, authReady } = useAuth();
  const sidebar = useSidebar();

  const [authOpen, setAuthOpen] = useState(false);
  const [authPane, setAuthPane] = useState<AuthPane>('signin');
  const openAuth = useCallback((pane: AuthPane) => {
    setAuthPane(pane);
    setAuthOpen(true);
  }, []);
  const closeAuth = useCallback(() => setAuthOpen(false), []);

  const { view, goToDashboard, showMarketing, handleConnectCTA } = useAppView(user, openAuth);

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

  if (!authReady) return null;

  return (
    <>
      <Header
        user={user}
        onLogoClick={showMarketing}
        onSignupClick={() => openAuth('signup')}
        onProfileClick={() => goToDashboard('overview')}
        onHamburgerClick={() => sidebar.setOpen(true)}
      />

      <Sidebar
        open={sidebar.open}
        user={user}
        leadsCount={leadsCount}
        onClose={() => sidebar.setOpen(false)}
        onSignIn={() => openAuth('signin')}
        onNavigate={(section) => goToDashboard(section)}
      />

      <main>
        {view === 'marketing' && (
          <MarketingPage onConnectClick={() => handleConnectCTA(openAddSiteModal)} />
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
        <MarketingFooter />
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
