'use client';

// components/connect/ConnectFlowClient.tsx
//
// Client shell for the standalone /dashboard/connect route (see
// app/dashboard/connect/page.tsx). Same auth-gate/header/sidebar
// pattern as components/dashboard/DashboardClient.tsx, scoped to just
// this one flow instead of the whole dashboard shell.
//
// Reads two optional query params to resume an already-pending site's
// verify step instead of starting fresh — set by
// components/dashboard/DashboardShell.tsx's "verify now" action,
// which now navigates here instead of opening a modal:
//   /dashboard/connect?site=<id>&url=<url>
import { useCallback, useEffect, useState } from 'react';
import { useSearchParams } from 'next/navigation';
import { useNavRouter } from '@/hooks/useNavPending';
import { AppSkeleton } from '@/components/AppSkeleton';
import { Header } from '@/components/layout/Header';
import { Sidebar } from '@/components/layout/Sidebar';
import { SiteFooter } from '@/components/layout/SiteFooter';
import { AuthOverlay } from '@/components/auth/AuthOverlay';
import { UpsellOverlay } from '@/components/dashboard/UpsellOverlay';
import { ConnectFlow } from '@/components/connect/ConnectFlow';
import { useAuth } from '@/hooks/useAuth';
import { useSidebar } from '@/hooks/useSidebar';
import { useUserProfile } from '@/hooks/useUserProfile';
import type { AuthPane } from '@/hooks/useAuthForms';
import type { DashSection } from '@/hooks/useAppView';
import type { LimitStatus } from '@/hooks/useConnectSiteWizard';
import type { PlanId } from '@/lib/plans';

export default function ConnectFlowClient() {
  const router = useNavRouter();
  const searchParams = useSearchParams();
  const { user, authReady, authError } = useAuth();
  const { planId } = useUserProfile(user);
  const sidebar = useSidebar();

  const [authOpen, setAuthOpen] = useState(false);
  const [authPane, setAuthPane] = useState<AuthPane>('signin');
  const openAuth = useCallback((pane: AuthPane) => {
    setAuthPane(pane);
    setAuthOpen(true);
  }, []);
  const closeAuth = useCallback(() => setAuthOpen(false), []);

  const [upsellOpen, setUpsellOpen] = useState(false);
  const [upsellInfo, setUpsellInfo] = useState<{ planId: PlanId; limit: number; used: number } | null>(null);
  const closeUpsell = useCallback(() => setUpsellOpen(false), []);

  function handleLimitReached(status: LimitStatus) {
    setUpsellInfo({ planId: (status.planId as PlanId) || 'free', limit: status.limit || 0, used: status.used || 0 });
    setUpsellOpen(true);
  }

  // A signed-out visitor landing straight on /dashboard/connect
  // (bookmark, shared CTA link, etc.) gets the sign-in pane instead of
  // a blank/broken page.
  useEffect(() => {
    if (authReady && !user) openAuth('signin');
  }, [authReady, user, openAuth]);

  const resumeSiteId = searchParams.get('site');
  const resumeSiteUrl = searchParams.get('url');

  function goToSection(section: DashSection) {
    sidebar.setOpen(false);
    if (section === 'logs') {
      router.push('/dashboard/visits');
      return;
    }
    router.push(`/dashboard${section === 'overview' ? '' : `#${section}`}`);
  }

  if (!authReady) return <AppSkeleton fullScreen label="Loading" />;

  if (authError) {
    return (
      <div style={{ minHeight: '100vh', display: 'flex', alignItems: 'center', justifyContent: 'center', padding: 24, textAlign: 'center' }}>
        <div style={{ maxWidth: 480 }}>
          <p style={{ fontWeight: 600, marginBottom: 8 }}>Something went wrong.</p>
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
        onProfileClick={() => router.push('/dashboard')}
        onHamburgerClick={() => sidebar.setOpen(true)}
      />

      <Sidebar
        open={sidebar.open}
        user={user}
        leadsCount={0}
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
          <ConnectFlow
            uid={user.uid}
            plan={planId}
            resumeTarget={resumeSiteId && resumeSiteUrl ? { id: resumeSiteId, url: resumeSiteUrl } : null}
            onLimitReached={handleLimitReached}
            onUpgradeClick={() => router.push('/dashboard/plans')}
          />
        ) : (
          <section>
            <div className="dashboard-empty">
              <div className="dash-empty-inner">
                <h2>Sign in to connect a site</h2>
                <p>You&apos;ll need an account before linking a site to sitevento.</p>
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

      <AuthOverlay open={authOpen} initialPane={authPane} onClose={closeAuth} onAuthSucceeded={() => closeAuth()} />
    </>
  );
}
