'use client';

// components/advertise/AdvertisePageClient.tsx
//
// Client half of /dashboard/advertise (see
// app/dashboard/advertise/page.tsx). Same Header + Sidebar +
// useAuth/useSidebar wiring as AgentPageClient.tsx and
// MonetizationPageClient.tsx — this is the advertiser-facing
// counterpart to Monetization's publisher-facing dashboard, backed by
// app/api/advertise/route.ts via hooks/useAdvertiser.ts.
//
// Unlike Monetization/Agent, this page is NOT scoped to the active
// site (useSites) — an ad an advertiser creates here runs across
// OTHER people's sites, not their own (see lib/adPool.ts's header on
// why adPool is a top-level collection) — so the only gate here is
// being signed in, not having a connected/verified site.
//
// Layout: billing panel (balance + top-up) -> the advertiser's own
// ads (list-ads, pause/resume) -> create-ad form, in that order so an
// advertiser sees their money and existing campaigns before being
// asked to make a new one.
import { useState } from 'react';
import { useNavRouter } from '@/hooks/useNavPending';
import { Header } from '@/components/layout/Header';
import { Sidebar } from '@/components/layout/Sidebar';
import { AuthOverlay } from '@/components/auth/AuthOverlay';
import { AppSkeleton } from '@/components/AppSkeleton';
import { useAuth } from '@/hooks/useAuth';
import { useSidebar } from '@/hooks/useSidebar';
import { useAdvertiser } from '@/hooks/useAdvertiser';
import type { AuthPane } from '@/hooks/useAuthForms';
import { AdvertiseBillingPanel } from './AdvertiseBillingPanel';
import { AdvertiseAdList } from './AdvertiseAdList';
import { AdvertiseCreateForm } from './AdvertiseCreateForm';

export default function AdvertisePageClient() {
  const router = useNavRouter();
  const { user, authReady } = useAuth();
  const sidebar = useSidebar();

  const [authOpen, setAuthOpen] = useState(false);
  const [authPane, setAuthPane] = useState<AuthPane>('signin');
  const [formOpen, setFormOpen] = useState(false);
  const [justCreated, setJustCreated] = useState(false);

  const { billing, ads, adsError, loading, busy, topUp, createAd, pauseAd, resumeAd, deleteAd } = useAdvertiser(user?.uid ?? null);

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

      <main className="adv-main">
        <div className="adv-wrap">
          <button type="button" className="adv-back" onClick={() => router.push('/dashboard')}>
            <svg viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth={2.3} strokeLinecap="round" strokeLinejoin="round">
              <path d="M19 12H5M11 18l-6-6 6-6" />
            </svg>
            <span>Dashboard</span>
          </button>

          <div className="adv-head">
            <h1>Advertise</h1>
            <p>Run your own banner, link, or text ads across the Sitevento network — set your creative, pick your formats, go live.</p>
          </div>

          {!authReady || loading ? (
            <AppSkeleton label="Loading your account" />
          ) : !user ? (
            <p className="adv-row-note">Sign in to create and run ads.</p>
          ) : (
            <>
              <AdvertiseBillingPanel balanceUsd={billing.balanceUsd} busy={busy} onTopUp={topUp} />

              <AdvertiseAdList ads={ads} busy={busy} error={adsError} onPause={pauseAd} onResume={resumeAd} onDelete={deleteAd} />

              <section className="adv-section">
                <div className="adv-section-head">
                  <h2 className="adv-section-title">New ad</h2>
                  {!formOpen && (
                    <div className="adv-section-head-right">
                      {justCreated && <span className="adv-saved-note">Ad created</span>}
                      <button type="button" className="ghost-btn live" onClick={() => setFormOpen(true)}>
                        Create ad
                      </button>
                    </div>
                  )}
                </div>
                {formOpen && (
                  <AdvertiseCreateForm
                    busy={busy}
                    onCancel={() => setFormOpen(false)}
                    onSubmit={async (creative, budget) => {
                      const result = await createAd(creative, budget);
                      if (result.ok) {
                        setFormOpen(false);
                        setJustCreated(true);
                        setTimeout(() => setJustCreated(false), 2200);
                      }
                      return result;
                    }}
                  />
                )}
              </section>
            </>
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
