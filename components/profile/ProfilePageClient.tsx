'use client';

// components/profile/ProfilePageClient.tsx
//
// Client shell for the /profile route (app/profile/page.tsx). Owns the auth
// gate, the app's normal Header + Sidebar (the same pair every dashboard route
// and /settings use), and loads the real data the page sections render:
//
//   user / photo / verified      Firebase Auth (hooks/useAuth)
//   plan                         users/{uid}.plan, live (hooks/useUserProfile)
//   usage, limits, wallet        /api/site-limits (hooks/useAccountLimits)
//   sites                        users/{uid}/sites, live (hooks/useSites)
//   headline stats               hooks/useProfileStats
//   recent activity              hooks/useProfileActivity
//   security / lead totals       hooks/useDashboardData's useAccountTotals
//
// Styling lives in styles/profile/profile-page.css only — imported here so
// it's scoped to this route and shared with nothing else.
import { useCallback, useEffect, useState } from 'react';
import { useNavRouter } from '@/hooks/useNavPending';
import '@/styles/profile/profile-page.css';
import { Header } from '@/components/layout/Header';
import { Sidebar } from '@/components/layout/Sidebar';
import { GlobalLoader } from '@/components/GlobalLoader';
import { AuthOverlay } from '@/components/auth/AuthOverlay';
import { AuthBlob } from '@/components/auth/AuthBlob';
import { ProfileHero } from '@/components/profile/ProfileHero';
import { ProfileStats } from '@/components/profile/ProfileStats';
import { ProfileTools } from '@/components/profile/ProfileTools';
import { ProfileActivity } from '@/components/profile/ProfileActivity';
import { ProfileAside } from '@/components/profile/ProfileAside';
import { signOutEverywhere, useAuth } from '@/hooks/useAuth';
import { useSidebar } from '@/hooks/useSidebar';
import { useSites } from '@/hooks/useSites';
import { useUserProfile } from '@/hooks/useUserProfile';
import { useAccountLimits } from '@/hooks/useAccountLimits';
import { useAccountTotals } from '@/hooks/useDashboardData';
import { useAppliedAppearance } from '@/hooks/useAppliedAppearance';
import { useBgTone } from '@/hooks/useBgTone';
import { useProfileStats } from '@/hooks/useProfileStats';
import { useProfileActivity } from '@/hooks/useProfileActivity';
import type { AuthPane } from '@/hooks/useAuthForms';

export default function ProfilePageClient() {
  const router = useNavRouter();
  const { user, authReady, authError } = useAuth();
  const sidebarNav = useSidebar();
  // Settings > Appearance (theme colour, font size, compact mode) applies
  // app-wide from here too, so a custom theme colour shows on this page.
  useAppliedAppearance(user);
  const tone = useBgTone();

  const uid = user?.uid ?? null;
  const { sites } = useSites(uid, user);
  const { planId, planLoaded } = useUserProfile(user);
  const { limits, loading: limitsLoading, error: limitsError, refresh: refreshLimits } = useAccountLimits(user);
  const ready = authReady && !!user;
  const { stats, loading: statsLoading } = useProfileStats(uid, sites, ready);
  const activity = useProfileActivity(uid, sites, ready);
  const totals = useAccountTotals(uid, sites, 0);

  const [authOpen, setAuthOpen] = useState(false);
  const [authPane, setAuthPane] = useState<AuthPane>('signin');
  const openAuth = useCallback((pane: AuthPane) => {
    setAuthPane(pane);
    setAuthOpen(true);
  }, []);
  const closeAuth = useCallback(() => setAuthOpen(false), []);

  // Signed-out visitors get the sign-in pane instead of an empty page; it
  // closes itself the moment a user appears (same two-way gate as
  // DashboardClient, which explains the post-signup race this guards).
  useEffect(() => {
    if (!authReady) return;
    if (!user) openAuth('signin');
    else closeAuth();
  }, [authReady, user, openAuth, closeAuth]);

  const handleSignOut = useCallback(async () => {
    await signOutEverywhere();
    router.push('/');
  }, [router]);

  if (!authReady) return <GlobalLoader variant="inline" fullScreen label="Loading your profile" />;

  if (authError) {
    return (
      <div className="pf-fatal">
        <div>
          <p>Something went wrong loading your profile.</p>
          <small>{authError}</small>
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
        onProfileClick={() => router.push('/profile')}
        onHamburgerClick={() => sidebarNav.setOpen(true)}
      />

      <Sidebar
        open={sidebarNav.open}
        user={user}
        leadsCount={0}
        onClose={() => sidebarNav.setOpen(false)}
        onSignIn={() => openAuth('signin')}
        onNavigate={() => {
          sidebarNav.setOpen(false);
          router.push('/dashboard');
        }}
      />

      <main className="pf-main">
        {user ? (
          <div className="pf-page" data-tone={tone}>
            <ProfileHero
              user={user}
              planId={planLoaded ? planId : null}
              limits={limits}
              limitsLoading={limitsLoading}
              limitsError={limitsError}
              onRetryLimits={refreshLimits}
              sitesCount={sites.length}
              stats={stats}
              onSignOut={handleSignOut}
            />

            <div className="pf-shell">
              <ProfileStats stats={stats} loading={statsLoading} sitesCount={sites.length} sitesLimit={limits?.sitesLimit ?? null} />

              <div className="pf-grid">
                <div className="pf-col-main">
                  <ProfileTools sites={sites} stats={stats} totals={totals} />
                  <ProfileActivity
                    items={activity.items}
                    loading={activity.loading}
                    refreshing={activity.refreshing}
                    hasSites={sites.length > 0}
                    onRefresh={activity.refresh}
                  />
                </div>
                <ProfileAside sites={sites} limits={limits} />
              </div>
            </div>
          </div>
        ) : (
          <div className="pf-page pf-signed-out" data-tone={tone}>
            <div className="pf-gate">
              <AuthBlob />
              <h1>Sign in to view your profile</h1>
              <p>Your plan, usage, sites and activity live here once you&rsquo;re signed in.</p>
              <button type="button" className="pf-btn pf-btn-accent" onClick={() => openAuth('signin')}>
                Sign in
              </button>
            </div>
          </div>
        )}
      </main>

      <AuthOverlay open={authOpen} initialPane={authPane} onClose={closeAuth} onAuthSucceeded={() => closeAuth()} />
    </>
  );
}
