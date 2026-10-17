'use client';

// components/AppRoot.tsx — mounted from app/page.tsx (the marketing
// homepage only). Previously this also switched to an in-page dashboard
// view; the dashboard is now its own route at /dashboard (see
// app/dashboard/page.tsx + components/dashboard/DashboardClient.tsx),
// so this component's job shrinks to: render the marketing page, the
// header/sidebar chrome, and the auth overlay, and route to /dashboard
// (via useAppView's goToDashboard/handleConnectCTA) once someone's
// signed in.
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
import { MarketingFooter } from '@/components/layout/MarketingFooter';
import { MarketingPage } from '@/components/marketing/MarketingPage';
import { AuthOverlay } from '@/components/auth/AuthOverlay';
import { useAuth } from '@/hooks/useAuth';
import { useAppView } from '@/hooks/useAppView';
import { useSidebar } from '@/hooks/useSidebar';
import type { AuthPane } from '@/hooks/useAuthForms';

export default function AppRoot() {
  const { user, authReady, authError } = useAuth();
  const sidebar = useSidebar();

  const [authOpen, setAuthOpen] = useState(false);
  const [authPane, setAuthPane] = useState<AuthPane>('signin');
  const openAuth = useCallback((pane: AuthPane) => {
    setAuthPane(pane);
    setAuthOpen(true);
  }, []);
  const closeAuth = useCallback(() => setAuthOpen(false), []);

  const { goToDashboard, showMarketing, handleConnectCTA } = useAppView(user, openAuth);

  if (!authReady) return <BootSplash />;

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
        onProfileClick={() => goToDashboard('overview')}
        onHamburgerClick={() => sidebar.setOpen(true)}
      />

      <Sidebar
        open={sidebar.open}
        user={user}
        leadsCount={0}
        onClose={() => sidebar.setOpen(false)}
        onSignIn={() => openAuth('signin')}
        onNavigate={(section) => goToDashboard(section)}
      />

      <main>
        <MarketingPage onConnectClick={handleConnectCTA} />
      </main>

      <MarketingFooter />

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
