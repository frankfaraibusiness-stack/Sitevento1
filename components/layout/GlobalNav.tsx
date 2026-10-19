'use client';

// components/layout/GlobalNav.tsx
//
// Site-wide navigation bar, rendered once from app/layout.tsx so it's
// present on every route (marketing "/" and the dashboard routes alike)
// instead of being assembled per-page — this is what actually makes the
// product feel like one app rather than a marketing site bolted onto a
// separate dashboard. Mobile gets a fixed bottom tab bar (native-app
// style); desktop gets a floating pill nav. Both share the same five
// items and the same active-route logic — only the layout differs,
// via CSS.
//
// Deliberately standalone: it reads auth itself (useAuth) rather than
// receiving user as a prop, so it can mount from the server-rendered
// root layout without needing AppRoot/DashboardClient's own state tree.
// "Add site" always routes through /dashboard?connect=1 — the same
// param DashboardClient already watches for (see hooks/useAppView.ts's
// handleConnectCTA) — so no new wiring is needed there; signed-out
// users land on /dashboard, which itself opens the sign-in pane.
import { usePathname, useRouter } from 'next/navigation';
import { useAuth } from '@/hooks/useAuth';

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
  { id: 'settings', label: 'Settings', href: '/dashboard/profile#settings', isMatch: (p) => p.startsWith('/dashboard/profile'), icon: SettingsIcon },
  { id: 'profile', label: 'Profile', href: '/dashboard/profile', isMatch: () => false, icon: ProfileIcon },
];

export function GlobalNav() {
  const router = useRouter();
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
    router.push('/dashboard?connect=1');
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
        <span className="gnav-item-label">{item.id === 'profile' ? (user ? name || 'Profile' : 'Sign in') : item.label}</span>
      </button>
    );
  }

  return (
    <nav className="gnav-root" aria-label="Main">
      <div className="gnav-pill">
        {LEFT_ITEMS.map(renderItem)}

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

        {RIGHT_ITEMS.map(renderItem)}
      </div>
    </nav>
  );
}
