'use client';

// components/monetization/MonetizationPageClient.tsx
//
// Client half of /dashboard/monetization (see
// app/dashboard/monetization/page.tsx). Same Header + Sidebar +
// useAuth/useSidebar/useSites wiring as AgentPageClient.tsx and
// WidgetDesigner.tsx.
//
// This pass is deliberately scoped to the gate, not the feature: the
// actual monetization dashboard (earnings, placements, payout
// settings) isn't built yet. What's here is the page shell — Header,
// Sidebar, back-to-dashboard chrome, a bare placeholder for where the
// real dashboard will go — sitting behind a full-screen upsell overlay
// (MonetizationUpsellOverlay) that's shown whenever the feature is OFF
// for the active site. Every visitor to this route sees that overlay
// first unless monetization is already on; once it's on, the overlay
// is gone entirely and the shell (currently just a placeholder) is
// what's visible.
import { useState } from 'react';
import { useNavRouter } from '@/hooks/useNavPending';
import { Header } from '@/components/layout/Header';
import { Sidebar } from '@/components/layout/Sidebar';
import { AuthOverlay } from '@/components/auth/AuthOverlay';
import { useAuth } from '@/hooks/useAuth';
import { useSidebar } from '@/hooks/useSidebar';
import { useSites } from '@/hooks/useSites';
import { useSiteMonetization } from '@/hooks/useSiteMonetization';
import type { AuthPane } from '@/hooks/useAuthForms';
import { MonetizationUpsellOverlay } from './MonetizationUpsellOverlay';
import { MonetizationDashboard } from './MonetizationDashboard';

export default function MonetizationPageClient() {
  const router = useNavRouter();
  const { user, authReady } = useAuth();
  const sidebar = useSidebar();
  const { activeSite } = useSites(user?.uid ?? null, user);

  const [authOpen, setAuthOpen] = useState(false);
  const [authPane, setAuthPane] = useState<AuthPane>('signin');

  const { config, loading, busy, setEnabled } = useSiteMonetization(user?.uid ?? null, activeSite);
  const siteVerified = activeSite?.status === 'verified';

  // SITE_NOT_VERIFIED is the one refusal reason the route can send for
  // this call — the overlay only shows the "Start making money" CTA
  // (which calls this) when siteVerified is already true, so in
  // practice that refusal shouldn't fire from here; if it somehow
  // does (a stale tab, verification revoked mid-session), the toggle
  // just doesn't flip and the overlay keeps showing — config.enabled
  // stays false, so there's nothing else to branch on here.
  async function handleEnable() {
    await setEnabled(true);
  }

  function goVerify() {
    if (activeSite) {
      router.push(`/dashboard/connect?site=${encodeURIComponent(activeSite.id)}&url=${encodeURIComponent(activeSite.url)}`);
    } else {
      router.push('/dashboard/connect');
    }
  }

  return (
    <>
      <Header
        user={user}
        onLogoClick={() => router.push('/')}
        onSignupClick={() => {
          setAuthPane('signup');
          setAuthOpen(true);
        }}
        onProfileClick={() => router.push('/dashboard')}
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
          router.push(section === 'overview' ? '/dashboard' : `/dashboard#${section}`);
        }}
        onOpenProfile={() => {
          sidebar.setOpen(false);
          router.push('/dashboard/profile');
        }}
      />

      {/* Page shell — stays mounted behind the overlay. Once
          monetization is on for the active site, this renders the
          real dashboard (MonetizationDashboard) instead of a
          placeholder note. */}
      <main className="mon-main">
        <div className="mon-wrap">
          <button type="button" className="mon-back" onClick={() => router.push('/dashboard')}>
            <svg viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth={2.3} strokeLinecap="round" strokeLinejoin="round">
              <path d="M19 12H5M11 18l-6-6 6-6" />
            </svg>
            <span>Dashboard</span>
          </button>

          <div className="mon-head">
            <h1>Monetization</h1>
            <p>Turn traffic from {activeSite?.name || 'your site'} into revenue.</p>
          </div>

          {!authReady || loading ? (
            <p className="mon-row-note">Loading…</p>
          ) : !user ? (
            <p className="mon-row-note">Sign in to turn on monetization for your site.</p>
          ) : !activeSite ? (
            <p className="mon-row-note">Connect a site from your dashboard to monetize it.</p>
          ) : config.enabled ? (
            <MonetizationDashboard site={activeSite} />
          ) : (
            <p className="mon-row-note" aria-hidden="true" />
          )}
        </div>
      </main>

      {/* The gate: shown whenever we know enough to know the feature
          is off (auth settled, a site is active, config loaded) — not
          while any of that is still resolving, so the overlay doesn't
          flash on top of a loading state. */}
      {authReady && user && activeSite && !loading && !config.enabled && (
        <MonetizationUpsellOverlay
          siteVerified={!!siteVerified}
          busy={busy}
          onEnable={handleEnable}
          onVerify={goVerify}
          onReturnToDashboard={() => router.push('/dashboard')}
        />
      )}

      <AuthOverlay
        open={authOpen}
        initialPane={authPane}
        onClose={() => setAuthOpen(false)}
        onAuthSucceeded={() => setAuthOpen(false)}
      />
    </>
  );
}
