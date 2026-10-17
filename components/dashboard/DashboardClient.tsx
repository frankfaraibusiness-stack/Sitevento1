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
import { useRouter, useSearchParams } from 'next/navigation';
import { BootSplash } from '@/components/BootSplash';
import { Header } from '@/components/layout/Header';
import { Sidebar } from '@/components/layout/Sidebar';
import { DashFooter } from '@/components/layout/DashFooter';
import { DashboardShell } from '@/components/dashboard/DashboardShell';
import { DashBottomNav, type DashNavTarget } from '@/components/dashboard/DashBottomNav';
import { AuthOverlay } from '@/components/auth/AuthOverlay';
import { ConnectSiteWizard, type ConnectSiteResumeTarget } from '@/components/connect/ConnectSiteWizard';
import { useAuth } from '@/hooks/useAuth';
import { useSidebar } from '@/hooks/useSidebar';
import type { AuthPane } from '@/hooks/useAuthForms';
import type { DashSection } from '@/hooks/useAppView';

const SECTION_ELEMENT_IDS: Record<DashSection, string> = {
  overview: 'dashMain',
  logs: 'panelVisits',
  leads: 'panelLeads',
  overlay: 'panelOverlay',
};

export default function DashboardClient() {
  const router = useRouter();
  const searchParams = useSearchParams();
  const { user, authReady, authError } = useAuth();
  const sidebar = useSidebar();

  const [authOpen, setAuthOpen] = useState(false);
  const [authPane, setAuthPane] = useState<AuthPane>('signin');
  const openAuth = useCallback((pane: AuthPane) => {
    setAuthPane(pane);
    setAuthOpen(true);
  }, []);
  const closeAuth = useCallback(() => setAuthOpen(false), []);

  const [connectOpen, setConnectOpen] = useState(false);
  const [connectResumeTarget, setConnectResumeTarget] = useState<ConnectSiteResumeTarget | null>(null);
  const openAddSiteModal = useCallback(() => {
    setConnectResumeTarget(null);
    setConnectOpen(true);
  }, []);
  const closeConnectModal = useCallback(() => setConnectOpen(false), []);

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

  // Bottom nav targets map onto the same anchor ids DashboardShell's
  // panels already expose — "home" to the top of the dashboard,
  // "analytics" to the visit log, "settings" to Quick Tools/Site Alert
  // (closest existing equivalent). "help" scrolls to DashFooter's own
  // help link instead of duplicating it with a second help surface.
  function handleBottomNav(target: DashNavTarget) {
    if (target === 'help') {
      const footer = document.querySelector('.dash-footer');
      if (footer) footer.scrollIntoView({ behavior: 'smooth', block: 'start' });
      return;
    }
    const section: DashSection = target === 'analytics' ? 'logs' : target === 'settings' ? 'overlay' : 'overview';
    scrollToSection(section);
  }

  if (!authReady) return <BootSplash />;

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
        onProfileClick={() => scrollToSection('overview')}
        onHamburgerClick={() => sidebar.setOpen(true)}
      />

      <Sidebar
        open={sidebar.open}
        user={user}
        leadsCount={leadsCount}
        onClose={() => sidebar.setOpen(false)}
        onSignIn={() => openAuth('signin')}
        onNavigate={(section) => {
          sidebar.setOpen(false);
          scrollToSection(section);
        }}
      />

      <main>
        {user ? (
          <DashboardShell
            user={user}
            onOpenAddSiteModal={openAddSiteModal}
            onResumeVerification={handleResumeVerification}
            onLeadsCountChange={setLeadsCount}
          />
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

      {user && <DashBottomNav onNavigate={handleBottomNav} />}

      <DashFooter onBackToMarketing={() => router.push('/')} />

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
        onAuthSucceeded={() => closeAuth()}
      />
    </>
  );
}
