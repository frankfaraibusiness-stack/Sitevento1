'use client';

// components/advertise/AdvertisePageClient.tsx
//
// Client half of /dashboard/advertise. Rebuilt to match the
// advertise-preview mockup's markup exactly, per explicit instruction
// to keep the HTML as-is — this means the mockup's own standalone
// `pill-nav` header (logo + ad balance pill) is used here instead of
// the app's shared Header/Sidebar components, and the page is a
// 2-tab layout (Create ad / Ad statistics) rather than the old
// page's 3-stacked-section layout. The "Your ads" list now lives
// inside the stats tab (see AdvertiseStatsPanel.tsx) — the mockup's
// markup has no separate ad-list tab or section of its own.
//
// Still real: auth is required to create/view ads (same as the old
// page), so a signed-out visitor sees a sign-in prompt in place of
// the tabs rather than the tabs rendering against no data. This
// gating isn't part of the mockup's static markup (which assumed an
// always-signed-in demo) but is required for the page to work
// correctly against the real backend.
import { useState } from 'react';
import { useNavRouter } from '@/hooks/useNavPending';
import { AuthOverlay } from '@/components/auth/AuthOverlay';
import { GlobalLoader } from '@/components/GlobalLoader';
import { useAuth } from '@/hooks/useAuth';
import { useAdvertiser } from '@/hooks/useAdvertiser';
import type { AuthPane } from '@/hooks/useAuthForms';
import { AdvertiseCreateForm } from './AdvertiseCreateForm';
import { AdvertiseStatsPanel } from './AdvertiseStatsPanel';

type Tab = 'create' | 'stats';

export default function AdvertisePageClient() {
  const router = useNavRouter();
  const { user, authReady } = useAuth();

  const [authOpen, setAuthOpen] = useState(false);
  const [authPane, setAuthPane] = useState<AuthPane>('signin');
  const [tab, setTab] = useState<Tab>('create');

  const { billing, ads, loading, busy, createAd, stats, statsLoading, statsError, fetchStats } = useAdvertiser(user?.uid ?? null);

  return (
    <>
      <header>
        <div className="pill-nav">
          <img
            className="nav-logo"
            src="https://cdn.phototourl.com/member/2026-10-16-c4f6fc3d-2a68-40c8-9241-fa770df8a99f.png"
            alt="sitevento"
            onClick={() => router.push('/')}
            style={{ cursor: 'pointer' }}
          />
          <div className="nav-right">
            {user ? (
              <div className="nav-balance" aria-label="Ad spend balance">
                <span className="nav-balance-icon">
                  <svg viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth={2} strokeLinecap="round" strokeLinejoin="round">
                    <path d="M12 1v22" />
                    <path d="M17 5H9.5a3.5 3.5 0 0 0 0 7h5a3.5 3.5 0 0 1 0 7H6" />
                  </svg>
                </span>
                <span className="nav-balance-text">
                  <span className="nav-balance-label">Ad balance</span>
                  <span className="nav-balance-amount">${billing.balanceUsd.toFixed(3)}</span>
                </span>
              </div>
            ) : (
              <button
                type="button"
                className="adv-btn adv-btn-primary"
                onClick={() => {
                  setAuthPane('signin');
                  setAuthOpen(true);
                }}
              >
                Sign in
              </button>
            )}
          </div>
        </div>
      </header>

      <main className="adv-main">
        <div className="adv-wrap">
          <div className="adv-head">
            <h1>Advertise</h1>
            <p>Run your own banner, link, or text ads across the Sitevento network — set your creative, pick your formats, go live.</p>
          </div>

          {!authReady || loading ? (
            <GlobalLoader variant="inline" label="Loading your account" />
          ) : !user ? (
            <p className="adv-row-note">Sign in to create and run ads.</p>
          ) : (
            <>
              <div className="adv-tabs" role="tablist" aria-label="Advertise sections">
                <button
                  type="button"
                  className={`adv-tab${tab === 'create' ? ' is-active' : ''}`}
                  role="tab"
                  aria-selected={tab === 'create'}
                  onClick={() => setTab('create')}
                >
                  Create ad
                </button>
                <button
                  type="button"
                  className={`adv-tab${tab === 'stats' ? ' is-active' : ''}`}
                  role="tab"
                  aria-selected={tab === 'stats'}
                  onClick={() => setTab('stats')}
                >
                  Ad statistics
                  <span className="adv-tab-count">{ads.length}</span>
                </button>
              </div>

              <section className={`adv-panel${tab === 'create' ? ' is-active' : ''}`} role="tabpanel" hidden={tab !== 'create'}>
                <AdvertiseCreateForm busy={busy} onSubmit={createAd} />
              </section>

              <section className={`adv-panel${tab === 'stats' ? ' is-active' : ''}`} role="tabpanel" hidden={tab !== 'stats'}>
                {tab === 'stats' && (
                  <AdvertiseStatsPanel ads={ads} stats={stats} statsLoading={statsLoading} statsError={statsError} fetchStats={fetchStats} />
                )}
              </section>
            </>
          )}
        </div>
      </main>

      <AuthOverlay open={authOpen} initialPane={authPane} onClose={() => setAuthOpen(false)} onAuthSucceeded={() => setAuthOpen(false)} />
    </>
  );
}
