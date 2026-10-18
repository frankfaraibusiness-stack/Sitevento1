'use client';

// components/widgets/WidgetsPageClient.tsx
//
// Client half of the standalone /widgets route (see app/widgets/page.tsx
// for why this needs to be a real, indexable route rather than the old
// WidgetsPanel in-dashboard overlay: search engines can't crawl state
// inside a signed-in SPA view, so the picker needed its own URL).
//
// Reuses the same Header + Sidebar + useAuth/useSidebar wiring
// DashboardClient.tsx uses (see that file) so this page carries the
// exact same top bar / hamburger menu as the rest of the app, without
// needing the dashboard's own auth-gated shell. "Dashboard" and
// "Settings" in the sidebar push to /dashboard with the matching
// section instead of scrolling in place, since this page lives outside
// that tree.
//
// Tapping a card now navigates to /widgets/[widgetId] — its own
// indexable route rendering the shared WidgetDesigner (see
// app/widgets/[widgetId]/page.tsx) — instead of swapping in an
// in-place overlay. That designer is the one place that actually
// turns a widget on/off and edits its config, which needs a signed-in
// uid + an active site. Signed-out visitors (exactly the audience
// this page's SEO traffic brings in) see the full catalog and copy,
// and are prompted to sign in only once they tap a card; WidgetDesigner
// itself repeats that same prompt for anyone who lands on a widget's
// URL directly without being signed in, so the gate isn't bypassable
// by just visiting the link.
import { useMemo, useState, type ReactNode } from 'react';
import { useRouter } from 'next/navigation';
import { Header } from '@/components/layout/Header';
import { Sidebar } from '@/components/layout/Sidebar';
import { AuthOverlay } from '@/components/auth/AuthOverlay';
import { WIDGET_CATALOG, type WidgetCatalogEntry } from '@/lib/widgets';
import { useAuth } from '@/hooks/useAuth';
import { useSidebar } from '@/hooks/useSidebar';
import { useSites } from '@/hooks/useSites';
import type { AuthPane } from '@/hooks/useAuthForms';

// One visual tone per card, cycling the same way the reference design
// does — a flat palette distinct from the dashboard's own
// --dash-*-surface tokens (see styles/widgets-page.css) so this page
// doesn't inherit dashboard-only styling and can be restyled on its
// own later without touching /dashboard.
const CARD_TONES = ['green', 'purple', 'blue', 'orange', 'pink', 'teal'] as const;
type CardTone = (typeof CARD_TONES)[number];

const WIDGET_ICONS: Record<string, ReactNode> = {
  'support-chat': (
    <svg viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth={2}>
      <path d="M21 11.5a8.38 8.38 0 0 1-.9 3.8 8.5 8.5 0 0 1-7.6 4.7 8.38 8.38 0 0 1-3.8-.9L3 21l1.9-5.7a8.38 8.38 0 0 1-.9-3.8 8.5 8.5 0 0 1 4.7-7.6 8.38 8.38 0 0 1 3.8-.9h.5a8.48 8.48 0 0 1 8 8v.5z" />
    </svg>
  ),
  'spin-wheel': (
    <svg viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth={2}>
      <circle cx="12" cy="12" r="9" />
      <circle cx="12" cy="12" r="3.2" />
      <path d="M12 3v6M12 15v6M3 12h6M15 12h6" />
    </svg>
  ),
  'exit-intent': (
    <svg viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth={2}>
      <rect x="3" y="5" width="18" height="14" rx="2.5" />
      <path d="M14 9l4 4-4 4M18 13H9" />
    </svg>
  ),
  'countdown-timer': (
    <svg viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth={2}>
      <circle cx="12" cy="13" r="8" />
      <path d="M12 9v4l2.5 2.5M9.5 1.5h5" />
    </svg>
  ),
  'social-proof': (
    <svg viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth={2}>
      <circle cx="9" cy="8.5" r="3.2" />
      <path d="M2.8 19.5c0-3 2.8-5.4 6.2-5.4s6.2 2.4 6.2 5.4" />
      <circle cx="17" cy="8" r="2.4" />
      <path d="M14.6 14.4a4.6 4.6 0 0 1 6.6 4.1" />
    </svg>
  ),
  'reviews-widget': (
    <svg viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth={2}>
      <path d="M12 3.5l2.6 5.3 5.9.9-4.3 4.1 1 5.8L12 16.8l-5.2 2.8 1-5.8-4.3-4.1 5.9-.9L12 3.5z" />
    </svg>
  ),
  'video-popup': (
    <svg viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth={2}>
      <rect x="3" y="5" width="18" height="14" rx="2.5" />
      <path d="M10 9.3v5.4l5-2.7-5-2.7z" fill="currentColor" stroke="none" />
    </svg>
  ),
  'feedback-widget': (
    <svg viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth={2}>
      <path d="M4 5h13a2 2 0 0 1 2 2v7a2 2 0 0 1-2 2H9l-5 4V5z" />
      <path d="M8 9h7M8 12h4" />
    </svg>
  ),
  'referral-widget': (
    <svg viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth={2}>
      <circle cx="7" cy="8" r="2.8" />
      <circle cx="17" cy="8" r="2.8" />
      <path d="M2.3 19.5c0-2.8 2.1-5 4.7-5s4.7 2.2 4.7 5M12.3 19.5c0-2.8 2.1-5 4.7-5s4.7 2.2 4.7 5" />
    </svg>
  ),
  'announcement-bar': (
    <svg viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth={2}>
      <rect x="3" y="4" width="18" height="4.5" rx="1.4" />
      <path d="M3 13h18M3 17h12" />
    </svg>
  ),
};

const ArrowIcon = () => (
  <svg viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth={2.4} strokeLinecap="round" strokeLinejoin="round">
    <path d="M5 12h14M13 6l6 6-6 6" />
  </svg>
);

const GridIcon = () => (
  <svg viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth={2.4}>
    <rect x="3" y="3" width="7" height="7" rx="1.5" />
    <rect x="14" y="3" width="7" height="7" rx="1.5" />
    <rect x="3" y="14" width="7" height="7" rx="1.5" />
    <rect x="14" y="14" width="7" height="7" rx="1.5" />
  </svg>
);

const SearchIcon = () => (
  <svg viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth={2}>
    <circle cx="11" cy="11" r="7" />
    <path d="M21 21l-4.3-4.3" />
  </svg>
);

const BulbIcon = () => (
  <svg viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth={2}>
    <path d="M9 18h6M10 21h4M12 3a6 6 0 0 0-3.5 10.9c.6.45.9 1.15.9 1.9v.2h5.2v-.2c0-.75.3-1.45.9-1.9A6 6 0 0 0 12 3z" />
  </svg>
);

export default function WidgetsPageClient() {
  const router = useRouter();
  const { user } = useAuth();
  const sidebar = useSidebar();
  const { activeSiteId } = useSites(user?.uid ?? null);

  const [authOpen, setAuthOpen] = useState(false);
  const [authPane, setAuthPane] = useState<AuthPane>('signin');
  const [query, setQuery] = useState('');

  const filtered = useMemo(() => {
    const q = query.trim().toLowerCase();
    if (!q) return WIDGET_CATALOG;
    return WIDGET_CATALOG.filter(
      (w) => w.name.toLowerCase().includes(q) || w.description.toLowerCase().includes(q)
    );
  }, [query]);

  function toneFor(index: number): CardTone {
    return CARD_TONES[index % CARD_TONES.length];
  }

  function handleCardClick(widget: WidgetCatalogEntry) {
    if (!user) {
      setAuthPane('signin');
      setAuthOpen(true);
      return;
    }
    router.push(`/widgets/${widget.id}`);
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

      <main className="wgp-main">
        <div className="wgp-wrap">
          <div className="wgp-head">
            <span className="wgp-head-icon" aria-hidden="true">
              <GridIcon />
            </span>
            <div className="wgp-head-text">
              <h1>Widgets</h1>
              <p>Powerful widgets to make your site more interactive and engaging.</p>
            </div>
          </div>

          <label className="wgp-search">
            <span className="wgp-search-icon" aria-hidden="true">
              <SearchIcon />
            </span>
            <input
              type="text"
              value={query}
              onChange={(e) => setQuery(e.target.value)}
              placeholder="Search widgets…"
              aria-label="Search widgets"
            />
          </label>

          {!activeSiteId && user && (
            <p className="wgp-note">Connect a site from your dashboard to turn widgets on.</p>
          )}

          <div className="wgp-grid">
            {filtered.map((w, i) => {
              const tone = toneFor(i);
              return (
                <button
                  key={w.id}
                  type="button"
                  className={`wgp-card wgp-tone-${tone}`}
                  onClick={() => handleCardClick(w)}
                >
                  <span className="wgp-card-top">
                    <span className="wgp-card-icon">{WIDGET_ICONS[w.id]}</span>
                    <span className="wgp-card-arrow" aria-hidden="true">
                      <ArrowIcon />
                    </span>
                  </span>
                  <span className="wgp-card-name">{w.name}</span>
                  <span className="wgp-card-desc">{w.description}</span>
                </button>
              );
            })}
          </div>

          {filtered.length === 0 && (
            <p className="wgp-empty">No widgets match &ldquo;{query}&rdquo;.</p>
          )}

          <div className="wgp-soon">
            <span className="wgp-soon-icon" aria-hidden="true">
              <BulbIcon />
            </span>
            <span className="wgp-soon-text">
              <strong>More Widgets Coming Soon</strong>
              <span>We&rsquo;re always adding new tools to help you grow.</span>
            </span>
            <span className="wgp-soon-arrow" aria-hidden="true">
              <ArrowIcon />
            </span>
          </div>
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
