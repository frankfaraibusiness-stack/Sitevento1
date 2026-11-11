'use client';

// components/layout/GlobalNav.tsx
//
// Site-wide navigation bar, rendered once from app/layout.tsx so it's
// present on every route (marketing "/" and the dashboard routes alike)
// instead of being assembled per-page — this is what actually makes the
// product feel like one app rather than a marketing site bolted onto a
// separate dashboard.
//
// Mobile (<860px) renders the cartoon-styled sticky glassy bottom
// nav from the provided HTML file (same markup/visual language as
// CartoonMobileHero's own hero section — see styles/base/global-nav.css
// for the ported CSS, scoped under .gnav-cartoon so its classes don't
// collide with the rest of the app), with its icons wired to real
// routes/active-state instead of being static: Home (/), Profile
// (/profile), the center Upload button (/dashboard/connect, same
// destination the Connect tab uses), Stats (/dashboard — the old
// standalone visit-logs/stats page was removed entirely), and Settings
// (/settings). Desktop (>=860px) renders DESKTOP_TABS below as plain
// text tabs with an underline — Home, Dashboard, Connect, Settings,
// Profile — no icons, no pill/button chrome.
//
// Deliberately standalone: it reads auth itself (useAuth) rather than
// receiving user as a prop, so it can mount from the server-rendered
// root layout without needing AppRoot/DashboardClient's own state tree.
// "Add site"/"Upload" always routes straight to /dashboard/connect, the
// dedicated connect-flow page (see app/dashboard/connect/page.tsx and
// hooks/useAppView.ts's handleConnectCTA, which routes marketing CTAs
// there the same way). That page owns its own signed-out gate — a
// guest landing on it gets the sign-in pane opened for them — so
// GlobalNav doesn't need to check auth state before navigating.
import { usePathname } from 'next/navigation';
import { useAuth } from '@/hooks/useAuth';
import { useNavRouter } from '@/hooks/useNavPending';

type NavItem = {
  id: string;
  label: string;
  href: string;
  isMatch: (path: string) => boolean;
  icon: (active: boolean) => React.ReactNode;
};

function HomeIcon(active: boolean) {
  return (
    <svg viewBox="0 0 24 24" fill={active ? 'currentColor' : 'none'} stroke="currentColor" strokeWidth={2} strokeLinejoin="round" strokeLinecap="round">
      <path d="M4 11.5 12 4l8 7.5" />
      <path d="M6 10v9a1 1 0 0 0 1 1h3v-5h4v5h3a1 1 0 0 0 1-1v-9" />
    </svg>
  );
}

function DashboardIcon(active: boolean) {
  return (
    <svg viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth={active ? 2.2 : 2}>
      <rect x="3" y="4" width="7" height="7" rx="1.5" />
      <rect x="14" y="4" width="7" height="7" rx="1.5" />
      <rect x="8.5" y="14" width="7" height="7" rx="1.5" />
      <path d="M6.5 11v2.5a1.5 1.5 0 0 0 1.5 1.5h2M17.5 11v2.5A1.5 1.5 0 0 1 16 15h-2" />
    </svg>
  );
}

function SettingsIcon(active: boolean) {
  return (
    <svg viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth={active ? 2.2 : 2}>
      <circle cx="12" cy="12" r="3" />
      <path d="M19.4 13.5a1.65 1.65 0 0 0 .33 1.82l.06.06a2 2 0 1 1-2.83 2.83l-.06-.06a1.65 1.65 0 0 0-1.82-.33 1.65 1.65 0 0 0-1 1.51V19.5a2 2 0 1 1-4 0v-.09a1.65 1.65 0 0 0-1.08-1.51 1.65 1.65 0 0 0-1.82.33l-.06.06a2 2 0 1 1-2.83-2.83l.06-.06a1.65 1.65 0 0 0 .33-1.82 1.65 1.65 0 0 0-1.51-1H4.5a2 2 0 1 1 0-4h.09a1.65 1.65 0 0 0 1.51-1.08 1.65 1.65 0 0 0-.33-1.82l-.06-.06a2 2 0 1 1 2.83-2.83l.06.06a1.65 1.65 0 0 0 1.82.33H10a1.65 1.65 0 0 0 1-1.51V4.5a2 2 0 1 1 4 0v.09a1.65 1.65 0 0 0 1 1.51 1.65 1.65 0 0 0 1.82-.33l.06-.06a2 2 0 1 1 2.83 2.83l-.06.06a1.65 1.65 0 0 0-.33 1.82V10a1.65 1.65 0 0 0 1.51 1H19.5a2 2 0 1 1 0 4h-.09a1.65 1.65 0 0 0-1.51 1z" />
    </svg>
  );
}

function ProfileIcon(active: boolean) {
  return (
    <svg viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth={active ? 2.2 : 2}>
      <circle cx="12" cy="8" r="3.6" />
      <path d="M4.8 19.4c1.4-3.2 4-4.8 7.2-4.8s5.8 1.6 7.2 4.8" strokeLinecap="round" />
    </svg>
  );
}

// Desktop nav is now a single flat row of five plain TEXT TABS (Home,
// Dashboard, Connect, Settings, Profile) — no icons, no pill/button
// styling, no separate floating full-width bar. Rendered inside the
// same header row as the logo instead of as its own fixed strip, so
// it no longer overlaps/competes with the header (see DESKTOP_TABS'
// render block below and global-nav.css's rebuilt desktop section).
// Connect replaces the old circular "+Add site" button — same
// destination (/dashboard/connect, handleAddSite below), now just
// another tab instead of a visually separate accent button.
const DESKTOP_TABS: NavItem[] = [
  { id: 'home', label: 'Home', href: '/', isMatch: (p) => p === '/', icon: HomeIcon },
  { id: 'dashboard', label: 'Dashboard', href: '/dashboard', isMatch: (p) => p === '/dashboard', icon: DashboardIcon },
  { id: 'connect', label: 'Connect', href: '/dashboard/connect', isMatch: (p) => p === '/dashboard/connect', icon: DashboardIcon },
  { id: 'settings', label: 'Settings', href: '/settings', isMatch: (p) => p.startsWith('/settings'), icon: SettingsIcon },
  // Shows the user's avatar (see renderItem's item.id === 'profile'
  // branch below) and lands on the account profile page, a top-level
  // route (app/profile/page.tsx), no longer nested under /dashboard.
  { id: 'profile', label: 'Profile', href: '/profile', isMatch: (p) => p === '/profile', icon: ProfileIcon },
];

// ---- Mobile-only cartoon nav — icons ported verbatim from the
// source HTML file's <nav class="navbar"> (same stroke-width/
// linecap/linejoin, same paths), kept separate from the desktop
// icon set above so neither has to compromise for the other.
function CartoonHomeIcon() {
  return (
    <svg viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth={2.5} strokeLinecap="round" strokeLinejoin="round" aria-hidden="true">
      <path d="M3 10.5 12 3l9 7.5V20a1.5 1.5 0 0 1-1.5 1.5H15v-6H9v6H4.5A1.5 1.5 0 0 1 3 20z" />
    </svg>
  );
}

function CartoonSettingsIcon() {
  return (
    <svg viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth={2.5} strokeLinecap="round" strokeLinejoin="round" aria-hidden="true">
      <circle cx="12" cy="12" r="3" />
      <path d="M19.4 13.5a1.65 1.65 0 0 0 .33 1.82l.06.06a2 2 0 1 1-2.83 2.83l-.06-.06a1.65 1.65 0 0 0-1.82-.33 1.65 1.65 0 0 0-1 1.51V19.5a2 2 0 1 1-4 0v-.09a1.65 1.65 0 0 0-1.08-1.51 1.65 1.65 0 0 0-1.82.33l-.06.06a2 2 0 1 1-2.83-2.83l.06-.06a1.65 1.65 0 0 0 .33-1.82 1.65 1.65 0 0 0-1.51-1H4.5a2 2 0 1 1 0-4h.09a1.65 1.65 0 0 0 1.51-1.08 1.65 1.65 0 0 0-.33-1.82l-.06-.06a2 2 0 1 1 2.83-2.83l.06.06a1.65 1.65 0 0 0 1.82.33H10a1.65 1.65 0 0 0 1-1.51V4.5a2 2 0 1 1 4 0v.09a1.65 1.65 0 0 0 1 1.51 1.65 1.65 0 0 0 1.82-.33l.06-.06a2 2 0 1 1 2.83 2.83l-.06.06a1.65 1.65 0 0 0-.33 1.82V10a1.65 1.65 0 0 0 1.51 1H19.5a2 2 0 1 1 0 4h-.09a1.65 1.65 0 0 0-1.51 1z" />
    </svg>
  );
}

function CartoonUploadIcon() {
  return (
    <svg viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth={2.5} strokeLinecap="round" strokeLinejoin="round" aria-hidden="true">
      <path d="M12 16V4M7 9l5-5 5 5" />
      <path d="M5 16v3a1 1 0 0 0 1 1h12a1 1 0 0 0 1-1v-3" />
    </svg>
  );
}

function CartoonStatsIcon() {
  return (
    <svg viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth={2.5} strokeLinecap="round" strokeLinejoin="round" aria-hidden="true">
      <path d="M4 20V10M10 20V4M16 20v-7M22 20v-4" />
    </svg>
  );
}

function CartoonProfileIcon() {
  return (
    <svg viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth={2.5} strokeLinecap="round" strokeLinejoin="round" aria-hidden="true">
      <circle cx="12" cy="8" r="4" />
      <path d="M4 21a8 8 0 0 1 16 0" />
    </svg>
  );
}

type CartoonNavItem = {
  id: string;
  label: string;
  // null href = no destination (inert placeholder, not wired to a route).
  href: string | null;
  isMatch: (path: string) => boolean;
  icon: () => React.ReactNode;
};

// Order: Home, Profile, [Upload — center action, rendered separately],
// Stats, Settings. Profile now routes to the top-level /profile route
// (app/profile/page.tsx). The standalone visit-logs/stats page has
// been removed entirely, so "Stats" now routes to the plain dashboard
// instead.
const CARTOON_LEFT_ITEMS: CartoonNavItem[] = [
  { id: 'cartoon-home', label: 'Home', href: '/', isMatch: (p) => p === '/', icon: CartoonHomeIcon },
  { id: 'cartoon-profile', label: 'Profile', href: '/profile', isMatch: (p) => p === '/profile', icon: CartoonProfileIcon },
];

const CARTOON_RIGHT_ITEMS: CartoonNavItem[] = [
  { id: 'cartoon-stats', label: 'Stats', href: '/dashboard', isMatch: (p) => p === '/dashboard', icon: CartoonStatsIcon },
  { id: 'cartoon-settings', label: 'Settings', href: '/settings', isMatch: (p) => p.startsWith('/settings'), icon: CartoonSettingsIcon },
];

export function GlobalNav() {
  const router = useNavRouter();
  const pathname = usePathname() || '/';
  const { user } = useAuth();

  // ── Widget delivery pages must stay bare ─────────────────────────
  // app/w/[widgetId]/page.tsx is what every widget's bundleUrl points
  // at (see that file's own comment) — it's loaded inside a sandboxed
  // iframe on a THIRD-PARTY CUSTOMER'S SITE, not sitevento's own UI.
  // GlobalNav rendering there means our Home/Dashboard/Settings/
  // account nav bar shows up inside the iframe, stacked under
  // whatever the widget itself renders, on every site that embeds a
  // widget — this is the actual cause of widgets appearing to render
  // "inside sitevento's own body" on a customer's page. app/w/ was
  // already deliberately built without the dashboard's own CSS for
  // exactly this isolation reason (see that route's comment); this is
  // the matching exception for the one piece of UI — GlobalNav — that
  // still reaches every route from the root layout instead of a
  // scoped one. Returning null here, rather than moving GlobalNav out
  // of app/layout.tsx into a route group, keeps this a one-file fix
  // with no routing restructure.
  if (pathname.startsWith('/w/')) return null;

  // ── Connect page: suppress the DESKTOP tabs only ─────────────────
  // app/dashboard/connect/page.tsx (components/connect/ConnectFlow.tsx)
  // renders its own fixed, full-width top header per its design (logo
  // + step-aware Next button). On desktop (>=860px) .gnav-root ALSO
  // renders as a fixed, top: 0, height: 56px strip of its own — see
  // styles/base/global-nav.css's desktop tabs section — normally
  // sharing that band with a real <header> element (ContentHeader.tsx
  // / Header.tsx) rendered by the page underneath it. This route
  // deliberately renders no such <header>, so without this exception
  // .gnav-root's centered, pointer-events:auto tabs would float
  // invisibly in the empty middle of ConnectFlow's own header,
  // silently intercepting clicks meant for nothing. It's also
  // redundant here either way: this page IS where the Connect tab
  // already sends people, and ConnectFlow's own logo is the
  // equivalent "home" affordance a header would normally provide.
  //
  // This used to `return null` for the whole component on this route,
  // which also removed .gnav-cartoon-root, the separate sticky bottom
  // nav bar mobile (<860px) renders below. That bar doesn't share any
  // band with ConnectFlow's header — it's pinned to the bottom of the
  // screen, nothing to collide with — so there was never a real reason
  // to hide it here, and doing so left mobile visitors on this route
  // with no navigation at all. Only the desktop pill is skipped now;
  // the mobile bottom nav renders on every route, this one included.
  const isConnectPage = pathname === '/dashboard/connect';

  function go(href: string) {
    router.push(href);
  }

  function handleAddSite() {
    router.push('/dashboard/connect');
  }

  const name = user ? user.displayName || (user.email ? user.email.split('@')[0] : 'Account') : '';
  const initial = name.trim().charAt(0).toUpperCase() || '?';

  // Desktop tab — plain text label + animated underline on
  // hover/active, no icon, no pill/button background. The avatar
  // still shows for the Profile tab (small, inline before the text)
  // since "who am I signed in as" is useful at a glance, but every
  // other tab is text-only now.
  function renderTab(item: NavItem) {
    const active = item.isMatch(pathname);
    return (
      <button
        key={item.id}
        type="button"
        className={`gnav-tab${active ? ' is-active' : ''}`}
        onClick={() => go(item.href)}
        aria-current={active ? 'page' : undefined}
      >
        {item.id === 'profile' && user && (
          user.photoURL ? (
            <img className="gnav-tab-avatar" src={user.photoURL} alt="" />
          ) : (
            <span className="gnav-tab-avatar gnav-tab-avatar-initial">{initial}</span>
          )
        )}
        <span className="gnav-tab-label">{item.label}</span>
        <span className="gnav-tab-underline" aria-hidden="true" />
      </button>
    );
  }

  function renderCartoonItem(item: CartoonNavItem) {
    const active = item.isMatch(pathname);
    // No destination yet (the old Profile page is gone) — render as a
    // disabled placeholder rather than a dead link.
    if (item.href === null) {
      return (
        <button
          key={item.id}
          type="button"
          className="gnav-cartoon-item is-disabled"
          disabled
          aria-disabled="true"
        >
          {item.icon()}
          <span>{item.label}</span>
        </button>
      );
    }
    return (
      <button
        key={item.id}
        type="button"
        className={`gnav-cartoon-item${active ? ' is-active' : ''}`}
        onClick={() => go(item.href as string)}
        aria-current={active ? 'page' : undefined}
      >
        {item.icon()}
        <span>{item.label}</span>
      </button>
    );
  }

  return (
    <>
      {/* Desktop (>=860px): plain text tabs (Home, Dashboard, Connect,
          Settings, Profile) with an underline on hover/active — no
          icons, no pill/button chrome, no big glassy capsule. Still a
          fixed element layered over the header's empty middle (same
          row, same 56px height), but now genuinely sized to just its
          own text content — see global-nav.css's rebuilt desktop
          section — instead of a wide max-width:760px glass pill with
          its own border/shadow/backdrop-filter stacked on top of the
          header's own glass, which is what made it look oversized and
          like it was "covering everything". It sits centered in the
          gap .pill-nav's logo/nav-right already leave empty, so it
          never overlaps either. Hidden below 860px via .gnav-root's
          own media query, and skipped on /dashboard/connect (see
          isConnectPage above) since ConnectFlow renders its own
          header with no nav row for this to sit inside. */}
      {!isConnectPage && (
        <nav className="gnav-root" aria-label="Main">
          <div className="gnav-tabs">{DESKTOP_TABS.map(renderTab)}</div>
        </nav>
      )}

      {/* Mobile (<860px): cartoon-styled sticky glassy bottom nav,
          ported from the source HTML as-is — markup/CSS unchanged,
          icons now wired to real routes/active-state. Hidden at
          860px+ via .gnav-cartoon-root's own media query in
          global-nav.css. */}
      <nav className="gnav-cartoon-root" aria-label="Primary">
        <div className="gnav-cartoon-group">{CARTOON_LEFT_ITEMS.map(renderCartoonItem)}</div>

        <button
          type="button"
          className="gnav-cartoon-upload"
          onClick={handleAddSite}
          aria-label="Upload"
        >
          <CartoonUploadIcon />
        </button>

        <div className="gnav-cartoon-group">{CARTOON_RIGHT_ITEMS.map(renderCartoonItem)}</div>
      </nav>
    </>
  );
}
