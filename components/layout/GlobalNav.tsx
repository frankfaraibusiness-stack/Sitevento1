'use client';

// components/layout/GlobalNav.tsx
//
// Site-wide navigation bar, rendered once from app/layout.tsx so it's
// present on every route (marketing "/" and the dashboard routes alike)
// instead of being assembled per-page — this is what actually makes the
// product feel like one app rather than a marketing site bolted onto a
// separate dashboard.
//
// Mobile (<860px) now renders the cartoon-styled sticky glassy bottom
// nav from the provided HTML file (same markup/visual language as
// CartoonMobileHero's own hero section — see styles/base/global-nav.css
// for the ported CSS, scoped under .gnav-cartoon so its classes don't
// collide with the rest of the app), with its 5 icons wired to real
// routes/active-state instead of being static: Home (/), Explore
// (/dashboard — closest existing "home base" page, there's no
// dedicated Explore route), the center Upload button (/dashboard/
// connect, same destination the old "+ Add site" button used), Stats
// (/dashboard/visits), and Profile (/dashboard/profile). Desktop
// (>=860px) is UNCHANGED — same floating pill nav, same LEFT_ITEMS/
// RIGHT_ITEMS, same behavior as before.
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

const LEFT_ITEMS: NavItem[] = [
  { id: 'home', label: 'Home', href: '/', isMatch: (p) => p === '/', icon: HomeIcon },
  { id: 'dashboard', label: 'Dashboard', href: '/dashboard', isMatch: (p) => p === '/dashboard', icon: DashboardIcon },
];

const RIGHT_ITEMS: NavItem[] = [
  { id: 'settings', label: 'Settings', href: '/settings', isMatch: (p) => p.startsWith('/settings'), icon: SettingsIcon },
  { id: 'profile', label: 'Profile', href: '/dashboard/profile', isMatch: (p) => p.startsWith('/dashboard/profile'), icon: ProfileIcon },
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

function CartoonExploreIcon() {
  return (
    <svg viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth={2.5} strokeLinecap="round" strokeLinejoin="round" aria-hidden="true">
      <circle cx="12" cy="12" r="9" />
      <path d="m15.5 8.5-2 5-5 2 2-5z" />
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
  href: string;
  isMatch: (path: string) => boolean;
  icon: () => React.ReactNode;
};

// Order matches the source HTML exactly: Home, Explore, [Upload —
// center action, rendered separately], Stats, Profile.
const CARTOON_LEFT_ITEMS: CartoonNavItem[] = [
  { id: 'cartoon-home', label: 'Home', href: '/', isMatch: (p) => p === '/', icon: CartoonHomeIcon },
  { id: 'cartoon-explore', label: 'Explore', href: '/dashboard', isMatch: (p) => p === '/dashboard', icon: CartoonExploreIcon },
];

const CARTOON_RIGHT_ITEMS: CartoonNavItem[] = [
  { id: 'cartoon-stats', label: 'Stats', href: '/dashboard/visits', isMatch: (p) => p.startsWith('/dashboard/visits'), icon: CartoonStatsIcon },
  { id: 'cartoon-profile', label: 'Profile', href: '/dashboard/profile', isMatch: (p) => p.startsWith('/dashboard/profile'), icon: CartoonProfileIcon },
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

  function go(href: string) {
    router.push(href);
  }

  function handleAddSite() {
    router.push('/dashboard/connect');
  }

  const name = user ? user.displayName || (user.email ? user.email.split('@')[0] : 'Account') : '';
  const initial = name.trim().charAt(0).toUpperCase() || '?';

  function renderItem(item: NavItem) {
    const active = item.isMatch(pathname);
    return (
      <button
        key={item.id}
        type="button"
        className={`gnav-item${active ? ' is-active' : ''}`}
        onClick={() => go(item.href)}
        aria-current={active ? 'page' : undefined}
        aria-label={item.label}
      >
        <span className="gnav-item-icon">
          {item.id === 'profile' && user ? (
            user.photoURL ? (
              <img className="gnav-avatar" src={user.photoURL} alt="" />
            ) : (
              <span className="gnav-avatar gnav-avatar-initial">{initial}</span>
            )
          ) : (
            item.icon(active)
          )}
        </span>
        <span className="gnav-item-label">{item.label}</span>
      </button>
    );
  }

  function renderCartoonItem(item: CartoonNavItem) {
    const active = item.isMatch(pathname);
    return (
      <button
        key={item.id}
        type="button"
        className={`gnav-cartoon-item${active ? ' is-active' : ''}`}
        onClick={() => go(item.href)}
        aria-current={active ? 'page' : undefined}
      >
        {item.icon()}
        <span>{item.label}</span>
      </button>
    );
  }

  return (
    <>
      {/* Desktop (>=860px): unchanged floating pill nav. Hidden below
          860px via .gnav-root's own media query in global-nav.css. */}
      <nav className="gnav-root" aria-label="Main">
        <div className="gnav-pill">
          {/* Grouped so the two side-tab clusters can be spaced
              independently from the center "+" on mobile, where the
              button is pulled out of the flex flow (position: absolute,
              see global-nav.css) to sit in the notch cut into the bar's
              top edge — without a wrapper here, .gnav-pill's own
              justify-content: space-between would have nothing left to
              push the two lone groups apart. Desktop ignores these
              wrapper divs (display: contents) and lays all five items
              out in one row exactly as before. */}
          <div className="gnav-group gnav-group-left">{LEFT_ITEMS.map(renderItem)}</div>

          <button
            type="button"
            className="gnav-add"
            onClick={handleAddSite}
            aria-label="Add site"
          >
            <svg viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth={2.4} strokeLinecap="round">
              <path d="M12 5v14M5 12h14" />
            </svg>
            <span className="gnav-add-label">Add site</span>
          </button>

          <div className="gnav-group gnav-group-right">{RIGHT_ITEMS.map(renderItem)}</div>
        </div>
      </nav>

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
