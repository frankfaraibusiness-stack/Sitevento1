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
import { useNavRouter } from '@/hooks/useNavPending';
import { Header } from '@/components/layout/Header';
import { Sidebar } from '@/components/layout/Sidebar';
import { AuthOverlay } from '@/components/auth/AuthOverlay';
import { WIDGET_CATALOG, type WidgetCatalogEntry } from '@/lib/widgets';
import { useAuth } from '@/hooks/useAuth';
import { useSidebar } from '@/hooks/useSidebar';
import { useSites } from '@/hooks/useSites';
import { useSiteWidgetsList } from '@/hooks/useSiteWidgetsList';
import type { AuthPane } from '@/hooks/useAuthForms';

// Previous widget catalog (and its per-id icon map) was retired —
// see lib/widgets.ts's WIDGET_CATALOG (now empty). Add an id -> icon
// entry here as each new premium widget ships.
const WIDGET_ICONS: Record<string, ReactNode> = {};

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

export default function WidgetsPageClient() {
  const router = useNavRouter();
  const { user, authReady } = useAuth();
  const sidebar = useSidebar();
  const { activeSiteId } = useSites(user?.uid ?? null);
  // Per-widget live/off status for the connected site, so each card can
  // show a real status badge instead of leaving it a mystery whether a
  // widget is actually live until you click into it.
  const { widgets: siteWidgets } = useSiteWidgetsList(user?.uid ?? null, activeSiteId);
  const liveById = useMemo(() => {
    const map = new Map<string, boolean>();
    for (const w of siteWidgets) map.set(w.id, w.enabled);
    return map;
  }, [siteWidgets]);

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

  function handleCardClick(widget: WidgetCatalogEntry) {
    // While authReady is still false, Firebase hasn't finished
    // restoring a persisted session from storage yet — user reads as
    // null for that brief window even for someone already signed in.
    // Navigating through anyway is safe: WidgetDesigner (the
    // destination) re-checks authReady itself and only prompts sign-in
    // once it's actually sure, so this just avoids a false "please
    // sign in" popping up here first on a fast click right after load.
    if (authReady && !user) {
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

          {WIDGET_CATALOG.length === 0 ? (
            <p className="wgp-empty">New widgets are on the way — nothing to show here yet.</p>
          ) : (
            <>
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
                {filtered.map((w) => {
                  const isLive = liveById.get(w.id);
                  return (
                    <button
                      key={w.id}
                      type="button"
                      className={`wgp-card${isLive ? ' wgp-card-live' : ''}`}
                      onClick={() => handleCardClick(w)}
                    >
                      <span className="wgp-card-top">
                        <span className="wgp-card-icon">{WIDGET_ICONS[w.id]}</span>
                        {activeSiteId && (
                          <span className={`wgp-status${isLive ? ' wgp-status-live' : ' wgp-status-off'}`}>
                            <span className="wgp-status-dot" aria-hidden="true" />
                            {isLive ? 'Live' : 'Off'}
                          </span>
                        )}
                      </span>
                      <span className="wgp-card-name">{w.name}</span>
                      <span className="wgp-card-desc">{w.description}</span>
                      <span className="wgp-card-cta">
                        {isLive ? 'Manage' : 'Set up'}
                        <ArrowIcon />
                      </span>
                    </button>
                  );
                })}
              </div>

              {filtered.length === 0 && (
                <p className="wgp-empty">No widgets match &ldquo;{query}&rdquo;.</p>
              )}
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
