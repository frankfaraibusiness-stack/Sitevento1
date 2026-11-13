'use client';

// components/monetization/MonetizationPageClient.tsx
//
// Client half of /dashboard/monetization (see
// app/dashboard/monetization/page.tsx). Same Header + Sidebar +
// useAuth/useSidebar/useSites wiring as AgentPageClient.tsx and
// WidgetDesigner.tsx.
//
// There's no full-screen "monetization is off" gate — MonetizationDashboard
// (the .mon2-prefixed rebuild matching the supplied design) always
// renders once we know who the user is and which site is active; its
// own header/period selector/site list own the rest of the page, this
// shell only supplies the back-to-dashboard button and the
// loading/sign-in/no-site fallback states.
import { useState } from 'react';
import { useNavRouter } from '@/hooks/useNavPending';
import { Header } from '@/components/layout/Header';
import { Sidebar } from '@/components/layout/Sidebar';
import { AuthOverlay } from '@/components/auth/AuthOverlay';
import { GlobalLoader } from '@/components/GlobalLoader';
import { useAuth } from '@/hooks/useAuth';
import { useSidebar } from '@/hooks/useSidebar';
import { useSites } from '@/hooks/useSites';
import type { AuthPane } from '@/hooks/useAuthForms';
import { MonetizationDashboard } from './MonetizationDashboard';

export default function MonetizationPageClient() {
  const router = useNavRouter();
  const { user, authReady } = useAuth();
  const sidebar = useSidebar();
  const { sites, activeSite, setActiveSiteId } = useSites(user?.uid ?? null, user);

  const [authOpen, setAuthOpen] = useState(false);
  const [authPane, setAuthPane] = useState<AuthPane>('signin');

  return (
    <>
      <Header
        user={user}
        onLogoClick={() => router.push('/')}
        onSignupClick={() => {
          setAuthPane('signup');
          setAuthOpen(true);
        }}
        onProfileClick={() => router.push('/profile')}
        onHamburgerClick={() => sidebar.setOpen(true)}
      />

      <Sidebar
        open={sidebar.open}
        user={user}
        leadsCount={0}
        onClose={() => sidebar.setOpen(false)}
        onSignIn={() => {
          setAuthPane('signin');
          setAuthOpen(true);
        }}
        onNavigate={(section) => {
          sidebar.setOpen(false);
          router.push('/dashboard/analytics');
        }}
      />

      <main className="mon-main">
        <div className="mon-wrap">
          <button type="button" className="mon-back" onClick={() => router.push('/dashboard/analytics')}>
            <svg viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth={2.3} strokeLinecap="round" strokeLinejoin="round">
              <path d="M19 12H5M11 18l-6-6 6-6" />
            </svg>
            <span>Analytics</span>
          </button>

          {!authReady ? (
            <GlobalLoader variant="inline" label="Loading monetization" />
          ) : !user ? (
            <p className="mon-row-note">Sign in to turn on monetization for your site.</p>
          ) : !activeSite ? (
            <p className="mon-row-note">Connect a site from your dashboard to monetize it.</p>
          ) : (
            <MonetizationDashboard
              uid={user.uid}
              site={activeSite}
              sites={sites}
              onSelectSite={(siteId) => setActiveSiteId(siteId)}
              onGoVerify={() => {
                router.push(
                  `/dashboard/connect?site=${encodeURIComponent(activeSite.id)}&url=${encodeURIComponent(activeSite.url)}`
                );
              }}
            />
          )}
        </div>
      </main>

      <AuthOverlay
        open={authOpen}
        initialPane={authPane}
        onClose={() => setAuthOpen(false)}
        onAuthSucceeded={() => setAuthOpen(false)}
      />
    </>
  );
}
