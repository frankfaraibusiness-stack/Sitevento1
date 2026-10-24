
'use client';

// components/dashboard/DashboardClient.tsx

import { useCallback, useEffect, useState } from 'react';
import { useNavRouter } from '@/hooks/useNavPending';
import { AppSkeleton } from '@/components/AppSkeleton';
import { Header } from '@/components/layout/Header';
import { Sidebar } from '@/components/layout/Sidebar';
import { SiteFooter } from '@/components/layout/SiteFooter';
import { DashboardShell } from '@/components/dashboard/DashboardShell';
import { ProfilePage } from '@/components/dashboard/ProfilePage';
import { PlansPage } from '@/components/dashboard/PlansPage';
import { SiteManagePage } from '@/components/dashboard/SiteManagePage';
import { VisitsPage } from '@/components/dashboard/VisitsPage';
import { AuthOverlay } from '@/components/auth/AuthOverlay';
import { AuthBlob } from '@/components/auth/AuthBlob';
import { UpsellOverlay } from '@/components/dashboard/UpsellOverlay';
import { useAuth } from '@/hooks/useAuth';
import { useSidebar } from '@/hooks/useSidebar';
import { useSites } from '@/hooks/useSites';
import { useAppliedAppearance } from '@/hooks/useAppliedAppearance';
import type { AuthPane } from '@/hooks/useAuthForms';
import type { DashSection } from '@/hooks/useAppView';
import type { PlanId } from '@/lib/plans';

interface DashboardClientProps {
  view?: 'dashboard' | 'profile' | 'plans' | 'site-manage' | 'visits';
  siteId?: string;
}

const SECTION_ELEMENT_IDS: Record<DashSection, string> = {
  overview: 'dashMain',
  logs: 'panelVisits',
  leads: 'panelLeads',
  overlay: 'panelOverlay',
};

const LANDING_VIEW_SECTION: Record<string, DashSection> = {
  overview: 'overview',
  visits: 'logs',
  leads: 'leads',
  sites: 'overview',
};

export default function DashboardClient({
  view = 'dashboard',
  siteId,
}: DashboardClientProps) {
  const router = useNavRouter();
  const { user, authReady, authError } = useAuth();
  const sidebar = useSidebar();

  const {
    settings: userSettings,
    loaded: userSettingsLoaded,
  } = useAppliedAppearance(user);

  const {
    sites,
    activeSiteId,
    setActiveSiteId,
    activeSite,
    dashState,
    errorMessage,
    disconnectSite,
  } = useSites(user?.uid ?? null, user);

  const [authOpen, setAuthOpen] = useState(false);
  const [authPane, setAuthPane] = useState<AuthPane>('signin');

  const openAuth = useCallback((pane: AuthPane) => {
    setAuthPane(pane);
    setAuthOpen(true);
  }, []);

  const closeAuth = useCallback(() => {
    setAuthOpen(false);
  }, []);

  const [upsellOpen, setUpsellOpen] = useState(false);

  const [upsellInfo, setUpsellInfo] = useState<{
    planId: PlanId;
    limit: number;
    used: number;
  } | null>(null);

  const openAddSiteModal = useCallback(async () => {
    if (!user) return;

    try {
      const idToken = await user.getIdToken();

      const res = await fetch('/api/site-limits', {
        method: 'POST',
        headers: {
          'Content-Type': 'application/json',
        },
        body: JSON.stringify({ idToken }),
      });

      const result = await res.json().catch(() => ({}));

      if (res.ok && result.ok && result.atLimit) {
        setUpsellInfo({
          planId: result.planId,
          limit: result.limit,
          used: result.used,
        });

        setUpsellOpen(true);
        return;
      }
    } catch (err) {
      // Fail open if the advisory site-limit check fails.
      // The connect route performs its own limit validation.
      console.error('site-limits check failed', err);
    }

    router.push('/dashboard/connect');
  }, [user, router]);

  const closeUpsell = useCallback(() => {
    setUpsellOpen(false);
  }, []);

  const [leadsCount, setLeadsCount] = useState(0);

  // Show the sign-in dialog when a signed-out visitor opens the dashboard.
  useEffect(() => {
    if (authReady && !user) {
      openAuth('signin');
    }
  }, [authReady, user, openAuth]);

  function handleResumeVerification(site: {
    id: string;
    url: string;
  }) {
    router.push(
      `/dashboard/connect?site=${encodeURIComponent(site.id)}&url=${encodeURIComponent(site.url)}`
    );
  }

  function scrollToSection(section: DashSection) {
    const el = document.getElementById(
      SECTION_ELEMENT_IDS[section] || 'dashMain'
    );

    if (el) {
      el.scrollIntoView({
        behavior: 'smooth',
        block: 'start',
      });
    }
  }

  const [landedOnSection, setLandedOnSection] = useState(false);

  // Apply the saved dashboard landing-view preference.
  useEffect(() => {
    if (landedOnSection) return;
    if (view !== 'dashboard' || !user) return;
    if (!userSettingsLoaded) return;

    const target =
      LANDING_VIEW_SECTION[userSettings.landingView] || 'overview';

    if (target === 'overview') {
      setLandedOnSection(true);
      return;
    }

    // Visit logs has its own dedicated page.
    if (target === 'logs') {
      setLandedOnSection(true);
      router.replace('/dashboard/visits');
      return;
    }

    let attempts = 0;
    let raf: number;

    const tryScroll = () => {
      const el = document.getElementById(SECTION_ELEMENT_IDS[target]);

      if (el) {
        el.scrollIntoView({
          behavior: 'auto',
          block: 'start',
        });

        setLandedOnSection(true);
        return;
      }

      attempts += 1;

      if (attempts > 60) {
        setLandedOnSection(true);
        return;
      }

      raf = requestAnimationFrame(tryScroll);
    };

    raf = requestAnimationFrame(tryScroll);

    return () => {
      cancelAnimationFrame(raf);
    };
  }, [
    landedOnSection,
    view,
    user,
    userSettingsLoaded,
    userSettings.landingView,
    router,
  ]);

  function goToSection(section: DashSection) {
    sidebar.setOpen(false);

    if (section === 'logs') {
      router.push('/dashboard/visits');
      return;
    }

    if (view !== 'dashboard') {
      router.push('/dashboard');
      return;
    }

    scrollToSection(section);
  }

  // Keep the dashboard loading gate tied to authentication and site data.
  const dashboardDataLoading =
    view === 'dashboard' &&
    !!user &&
    dashState === 'loading';

  if (!authReady || dashboardDataLoading) {
    return (
      <AppSkeleton
        fullScreen
        label="Loading your dashboard"
      />
    );
  }

  if (authError) {
    return (
      <div
        style={{
          minHeight: '100vh',
          display: 'flex',
          alignItems: 'center',
          justifyContent: 'center',
          padding: 24,
          textAlign: 'center',
        }}
      >
        <div style={{ maxWidth: 480 }}>
          <p
            style={{
              fontWeight: 600,
              marginBottom: 8,
            }}
          >
            Something went wrong loading your dashboard.
          </p>

          <p
            style={{
              color: 'var(--muted-mid)',
              fontSize: 14,
            }}
          >
            {authError}
          </p>
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
        onProfileClick={() => goToSection('overview')}
        onHamburgerClick={() => sidebar.setOpen(true)}
      />

      <Sidebar
        open={sidebar.open}
        user={user}
        leadsCount={leadsCount}
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
          view === 'profile' ? (
            <ProfilePage
              user={user}
              sites={sites}
              onDisconnectSite={async (siteId: string) => {
                await disconnectSite(siteId);
              }}
              onAddSite={openAddSiteModal}
            />
          ) : view === 'plans' ? (
            <PlansPage
              user={user}
              sites={sites}
            />
          ) : view === 'site-manage' && siteId ? (
            <SiteManagePage
              user={user}
              siteId={siteId}
            />
          ) : view === 'visits' ? (
            <VisitsPage user={user} />
          ) : (
            <DashboardShell
              user={user}
              sites={sites}
              activeSiteId={activeSiteId}
              setActiveSiteId={setActiveSiteId}
              activeSite={activeSite}
              dashState={dashState}
              errorMessage={errorMessage}
              disconnectSite={disconnectSite}
              onOpenAddSiteModal={openAddSiteModal}
              onResumeVerification={handleResumeVerification}
              onLeadsCountChange={setLeadsCount}
            />
          )
        ) : (
          <section>
            <div className="dashboard-empty">
              <div className="dash-empty-inner">
                <AuthBlob />

                <h2>Sign in to view your dashboard</h2>

                <p>
                  Connect your sites, see live visits, and push banners once
                  you&apos;re signed in.
                </p>

                <button
                  className="btn-primary"
                  onClick={() => openAuth('signin')}
                >
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

      <AuthOverlay
        open={authOpen}
        initialPane={authPane}
        onClose={closeAuth}
        onAuthSucceeded={closeAuth}
      />
    </>
  );
}
