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

export default function AppRoot() {
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
