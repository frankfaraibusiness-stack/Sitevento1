'use client';

// components/layout/Sidebar.tsx — replaces the <aside class="sidebar">
// block + renderGuestSidebar/renderSignedInSidebar. Nav links call
// goToDashboard(section) via props instead of global functions.
import { useState } from 'react';
import { usePathname } from 'next/navigation';
import type { User } from 'firebase/auth';
import { signOutEverywhere } from '@/hooks/useAuth';
import type { DashSection } from '@/hooks/useAppView';
import { useNavRouter } from '@/hooks/useNavPending';
import { useScrollLock } from '@/hooks/useScrollLock';
import { ConfirmPopup } from '@/components/widgets/WidgetStatusPopup';

interface SidebarProps {
  open: boolean;
  user: User | null;
  leadsCount: number;
  onClose: () => void;
  onSignIn: () => void;
  onNavigate: (section: DashSection) => void;
}

export function Sidebar({ open, user, leadsCount, onClose, onSignIn, onNavigate }: SidebarProps) {
  const router = useNavRouter();
  // Real route-aware active state, same approach GlobalNav.tsx already
  // uses for the desktop/mobile top nav. Previously "active" was
  // hardcoded only on the Dashboard link (className="sidebar-link
  // active" in the JSX below), regardless of which page was actually
  // open — so every other link (Settings, Profile, Connected sites,
  // etc.) never highlighted even while you were on that exact page,
  // and Dashboard stayed highlighted even deep inside e.g.
  // /dashboard/sites. isActive() below replaces that with a real
  // per-link check against the current pathname.
  const pathname = usePathname() || '/';
  function isActive(path: string, opts?: { exact?: boolean }) {
    return opts?.exact ? pathname === path : pathname === path || pathname.startsWith(path + '/');
  }
  const name = user ? user.displayName || (user.email ? user.email.split('@')[0] : 'Account') : '';
  const email = user?.email || '';
  // Confirm before actually signing out — previously this button
  // called signOutEverywhere() straight from onClick with no chance
  // to back out. Shares the same ConfirmPopup used in Settings and
  // the Danger Zone instead of a one-off dialog.
  const [confirmingSignOut, setConfirmingSignOut] = useState(false);
  const [signingOut, setSigningOut] = useState(false);

  async function handleSignOut() {
    setSigningOut(true);
    try {
      await signOutEverywhere();
    } catch {
      // silent — matches SettingsSidebar's existing behavior
    }
    window.location.href = window.location.origin + '/';
  }
  const initial = name.trim().charAt(0).toUpperCase() || '?';

  // Lock the main page's own scroll while the sidebar is open, so
  // scrolling inside the sidebar (or over the dimmed overlay) never
  // moves the page behind it. Shared lock (hooks/useScrollLock.ts) —
  // actually pins body in place instead of just setting
  // overflow: hidden, which never stopped iOS touch-scroll of the
  // page behind a fixed-position overlay.
  useScrollLock(open);

  function navigate(section: DashSection) {
    onClose();
    onNavigate(section);
  }

  function goToSettings() {
    onClose();
    if (!user) {
      onSignIn();
      return;
    }
    router.push('/settings');
  }

  // "Email capture" now has its own dedicated page
  // (components/dashboard/EmailCapturePage.tsx) rather than scrolling
  // to the leads panel on the main dashboard (#panelLeads) — route
  // straight there instead, same treatment "Visit logs" already got.
  function goToLeads() {
    onClose();
    if (!user) {
      onSignIn();
      return;
    }
    router.push('/dashboard/leads');
  }

  // "Connected sites" now has its own dedicated page
  // (components/dashboard/ConnectedSitesPage.tsx, app/dashboard/sites/
  // page.tsx) rather than scrolling to the inline rail on Overview —
  // route straight there, same treatment "Visit logs"/"Email capture"
  // already got.
  function goToSites() {
    onClose();
    if (!user) {
      onSignIn();
      return;
    }
    router.push('/dashboard/sites');
  }

  // The account profile page (components/dashboard/ProfilePage.tsx,
  // app/profile/page.tsx — a top-level route, no longer nested under
  // /dashboard) — same header-avatar-click destination as the top
  // nav's own profile button, reachable here too via the "Profile" nav
  // link and by tapping the signed-in avatar/name block above it.
  function goToProfile() {
    onClose();
    if (!user) {
      onSignIn();
      return;
    }
    router.push('/profile');
  }

  // Tool pages that previously had no nav entry anywhere but Quick
  // Tools (and Quick Tools itself was only showing 4 of 7). Same
  // sign-in gate + router.push pattern as goToSites/goToProfile above.
  function goToPath(path: string) {
    return () => {
      onClose();
      if (!user) {
        onSignIn();
        return;
      }
      router.push(path);
    };
  }

  const goToAnalytics = goToPath('/dashboard/analytics');
  const goToApi = goToPath('/dashboard/api');
  const goToMonetization = goToPath('/dashboard/monetization');
  const goToAdvertise = goToPath('/dashboard/advertise');
  const goToUsers = goToPath('/dashboard/users');
  const goToBotShield = goToPath('/dashboard/bot-shield');
  const goToAgent = goToPath('/dashboard/agent');
  const goToSiteAlert = goToPath('/dashboard/features/site-alert');
  const goToWallet = goToPath('/dashboard/wallet');
  const goToPlans = goToPath('/dashboard/plans');
  const goToConnect = goToPath('/dashboard/connect');

  return (
    <>
      <div className={`sidebar-overlay${open ? ' open' : ''}`} onClick={onClose} />

      <aside className={`sidebar${open ? ' open' : ''}`} aria-hidden={!open}>
      <div className="sidebar-inner">
        <div className="sidebar-head">
          <img
            className="sidebar-logo"
            src="https://cdn.phototourl.com/member/2026-10-16-c4f6fc3d-2a68-40c8-9241-fa770df8a99f.png"
            alt="sitevento"
          />
          <button className="sidebar-close" aria-label="Close menu" onClick={onClose} />
        </div>

        <div
          className={`sidebar-profile${user ? '' : ' guest'}`}
          {...(user
            ? {
                role: 'button',
                tabIndex: 0,
                style: { cursor: 'pointer' },
                onClick: goToProfile,
                onKeyDown: (e: React.KeyboardEvent) => {
                  if (e.key === 'Enter' || e.key === ' ') {
                    e.preventDefault();
                    goToProfile();
                  }
                },
              }
            : {})}
        >
          {user ? (
            <div className="avatar-ring" style={{ display: 'flex' }}>
              {user.photoURL ? (
                <img src={user.photoURL} alt="Profile picture" />
              ) : (
                <div
                  style={{
                    width: '100%',
                    height: '100%',
                    borderRadius: '50%',
                    display: 'flex',
                    alignItems: 'center',
                    justifyContent: 'center',
                    // No hardcoded colors — pulls the same brand gradient
                    // the ring itself uses (styles/base/sidebar.css
                    // .avatar-ring), so the fallback initial sits on-brand
                    // on the new glass panel instead of a fixed hex.
                    background: 'linear-gradient(135deg, var(--dash-purple, #7c5cfc), var(--lime, #b8e843))',
                    color: 'var(--lime-ink, #1a1f0a)',
                    fontWeight: 700,
                    fontSize: 18,
                    border: '2px solid color-mix(in srgb, white 70%, transparent)',
                  }}
                >
                  {initial}
                </div>
              )}
            </div>
          ) : null}

          {user ? (
            <div className="who">
              <span className="pname">{name}</span>
              <span className="pemail">{email}</span>
            </div>
          ) : (
            <>
              <div className="guest-row">
                <div className="avatar-ring guest-avatar">
                  <svg viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth={1.8}>
                    <circle cx="12" cy="8" r="4" />
                    <path d="M4 21c0-4.4 3.6-8 8-8s8 3.6 8 8" />
                  </svg>
                </div>
                <div className="who">
                  <span className="pname guest-name">Guest</span>
                  <span className="pemail">Not signed in</span>
                </div>
              </div>
              <button
                className="sidebar-cta"
                onClick={() => {
                  onClose();
                  onSignIn();
                }}
              >
                <svg width="15" height="15" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth={2}>
                  <path d="M15 3h4a2 2 0 0 1 2 2v14a2 2 0 0 1-2 2h-4M10 17l5-5-5-5M15 12H3" />
                </svg>
                Sign in
              </button>
            </>
          )}
        </div>

        <nav className="sidebar-nav">
          <span className="sidebar-section-label">Dashboard</span>
          <a href="#" className={`sidebar-link${isActive('/dashboard', { exact: true }) ? ' active' : ''}`} onClick={(e) => { e.preventDefault(); navigate('overview'); }}>
            <span className="icon">
              <svg viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth={1.8}>
                <rect x="3" y="3" width="7" height="9" rx="1.5" />
                <rect x="14" y="3" width="7" height="5" rx="1.5" />
                <rect x="14" y="12" width="7" height="9" rx="1.5" />
                <rect x="3" y="16" width="7" height="5" rx="1.5" />
              </svg>
            </span>
            Dashboard
          </a>
          <a href="#" className={`sidebar-link${isActive('/dashboard/analytics') ? ' active' : ''}`} onClick={(e) => { e.preventDefault(); goToAnalytics(); }}>
            <span className="icon">
              <svg viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth={1.8}>
                <path d="M4 20V10M10 20V4M16 20v-7M22 20H2" />
                <path d="m13 8 3-3 3 3" />
              </svg>
            </span>
            Analytics
            <span className="badge">New</span>
          </a>
          <a href="#" className={`sidebar-link${isActive('/dashboard/api') ? ' active' : ''}`} onClick={(e) => { e.preventDefault(); goToApi(); }}>
            <span className="icon">
              <svg viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth={1.8}>
                <path d="m16 18 6-6-6-6M8 6l-6 6 6 6" />
              </svg>
            </span>
            API
            <span className="badge">New</span>
          </a>
          <a href="#" className="sidebar-link" onClick={(e) => { e.preventDefault(); navigate('logs'); }}>
            <span className="icon">
              <svg viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth={1.8}>
                <path d="M3 12h4l2 5 4-14 2 9 2-5h4" />
              </svg>
            </span>
            Visit logs
          </a>
          <a href="#" className={`sidebar-link${isActive('/dashboard/leads') ? ' active' : ''}`} onClick={(e) => { e.preventDefault(); goToLeads(); }}>
            <span className="icon">
              <svg viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth={1.8}>
                <rect x="3" y="5" width="18" height="14" rx="2" />
                <path d="M3 9h18M7 13h4" />
              </svg>
            </span>
            Email capture
            {leadsCount > 0 && <span className="badge">{leadsCount}</span>}
          </a>
          {/* Now links to its own standalone, SEO-indexed marketing
              page (app/product/features/page.tsx) instead of
              scrolling to the signed-in dashboard's #panelOverlay
              anchor, which had no SEO identity of its own. Plain
              link + target="_blank" to match the other marketing/
              content links below (Admin, Help & support) rather than
              the in-app `navigate()` used for real dashboard sections. */}
          <a href="/product/features" className="sidebar-link" target="_blank" rel="noopener noreferrer" onClick={onClose}>
            <span className="icon">
              <svg viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth={1.8}>
                <path d="M4 12h16M4 6h16M4 18h10" />
              </svg>
            </span>
            Features
          </a>
          <a href="#" className={`sidebar-link${isActive('/dashboard/sites') ? ' active' : ''}`} onClick={(e) => { e.preventDefault(); goToSites(); }}>
            <span className="icon">
              <svg viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth={1.8}>
                <rect x="3" y="4" width="18" height="16" rx="2" />
                <path d="M3 9h18" />
              </svg>
            </span>
            Connected sites
          </a>
          <a href="#" className={`sidebar-link${isActive('/dashboard/connect') ? ' active' : ''}`} onClick={(e) => { e.preventDefault(); goToConnect(); }}>
            <span className="icon">
              <svg viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth={1.8}>
                <path d="M9 17a4 4 0 0 1-4-4 4 4 0 0 1 4-4h1M15 7a4 4 0 0 1 4 4 4 4 0 0 1-4 4h-1" />
                <path d="M8 12h8" />
              </svg>
            </span>
            Connect a site
          </a>

          <span className="sidebar-section-label">Tools</span>
          <a href="#" className={`sidebar-link${isActive('/dashboard/features/site-alert') ? ' active' : ''}`} onClick={(e) => { e.preventDefault(); goToSiteAlert(); }}>
            <span className="icon">
              <svg viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth={1.8}>
                <path d="M4 12h16M4 6h16M4 18h10" />
              </svg>
            </span>
            Site Alert
          </a>
          <a href="#" className={`sidebar-link${isActive('/dashboard/monetization') ? ' active' : ''}`} onClick={(e) => { e.preventDefault(); goToMonetization(); }}>
            <span className="icon">
              <svg viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth={1.8}>
                <circle cx="12" cy="12" r="9" />
                <path d="M12 7v10M15 9.5c0-1.4-1.3-2.5-3-2.5s-3 1-3 2.3c0 3 6 1.4 6 4.4 0 1.3-1.3 2.3-3 2.3s-3-1.1-3-2.5" />
              </svg>
            </span>
            Monetization
          </a>
          <a href="#" className={`sidebar-link${isActive('/dashboard/advertise') ? ' active' : ''}`} onClick={(e) => { e.preventDefault(); goToAdvertise(); }}>
            <span className="icon">
              <svg viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth={1.8}>
                <rect x="3" y="5" width="18" height="10" rx="2" />
                <path d="M7 9h6M7 12h4" />
                <path d="M15 19h4M17 17v4" />
              </svg>
            </span>
            Advertise
          </a>
          <a href="#" className={`sidebar-link${isActive('/dashboard/agent') ? ' active' : ''}`} onClick={(e) => { e.preventDefault(); goToAgent(); }}>
            <span className="icon">
              <svg viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth={1.8}>
                <rect x="4" y="7" width="16" height="12" rx="3" />
                <path d="M9 2.5 12 7M12 7l3-4.5" />
                <circle cx="9" cy="13" r="1.1" fill="currentColor" stroke="none" />
                <circle cx="15" cy="13" r="1.1" fill="currentColor" stroke="none" />
                <path d="M9.5 16.5h5" />
              </svg>
            </span>
            AI Support Agent
          </a>
          <a href="#" className={`sidebar-link${isActive('/dashboard/bot-shield') ? ' active' : ''}`} onClick={(e) => { e.preventDefault(); goToBotShield(); }}>
            <span className="icon">
              <svg viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth={1.8}>
                <path d="M12 3l7 3v5.5c0 4.5-3 8-7 9.5-4-1.5-7-5-7-9.5V6l7-3z" />
                <path d="M9 12l2 2 4-4" />
              </svg>
            </span>
            Security Bot
          </a>
          <a href="#" className={`sidebar-link${isActive('/dashboard/users') ? ' active' : ''}`} onClick={(e) => { e.preventDefault(); goToUsers(); }}>
            <span className="icon">
              <svg viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth={1.8}>
                <circle cx="9" cy="8" r="3.4" />
                <path d="M2.5 19c0-3.6 2.9-6.2 6.5-6.2s6.5 2.6 6.5 6.2" />
                <path d="M16.3 13.2c2.9.5 4.7 2.8 4.7 5.8" />
                <circle cx="16" cy="7.2" r="2.4" />
              </svg>
            </span>
            Users
          </a>

          <span className="sidebar-section-label">Account</span>
          <a href="#" className={`sidebar-link${isActive('/profile', { exact: true }) ? ' active' : ''}`} onClick={(e) => { e.preventDefault(); goToProfile(); }}>
            <span className="icon">
              <svg viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth={1.8}>
                <circle cx="12" cy="8" r="4" />
                <path d="M4 21c0-4.4 3.6-8 8-8s8 3.6 8 8" />
              </svg>
            </span>
            Profile
          </a>
          <a href="#" className={`sidebar-link${isActive('/dashboard/wallet') ? ' active' : ''}`} onClick={(e) => { e.preventDefault(); goToWallet(); }}>
            <span className="icon">
              <svg viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth={1.8}>
                <rect x="3" y="6" width="18" height="13" rx="2" />
                <path d="M3 10h18" />
                <circle cx="16.5" cy="14.5" r="1.2" fill="currentColor" stroke="none" />
              </svg>
            </span>
            Wallet
          </a>
          <a href="#" className={`sidebar-link${isActive('/dashboard/plans') ? ' active' : ''}`} onClick={(e) => { e.preventDefault(); goToPlans(); }}>
            <span className="icon">
              <svg viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth={1.8}>
                <path d="M12 2l3 6 6 .9-4.5 4.3 1.1 6-5.6-3-5.6 3 1.1-6L3 8.9 9 8z" />
              </svg>
            </span>
            Plans
          </a>

          <span className="sidebar-section-label">More</span>
          <a href="#" className={`sidebar-link${isActive('/settings') ? ' active' : ''}`} onClick={(e) => { e.preventDefault(); goToSettings(); }}>
            <span className="icon">
              <svg viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth={1.8}>
                <circle cx="12" cy="12" r="3" />
                <path d="M19.4 15a1.7 1.7 0 0 0 .3 1.9l.1.1a2 2 0 1 1-2.8 2.8l-.1-.1a1.7 1.7 0 0 0-1.9-.3 1.7 1.7 0 0 0-1 1.5V21a2 2 0 1 1-4 0v-.1a1.7 1.7 0 0 0-1-1.6 1.7 1.7 0 0 0-1.9.3l-.1.1a2 2 0 1 1-2.8-2.8l.1-.1a1.7 1.7 0 0 0 .3-1.9 1.7 1.7 0 0 0-1.5-1H3a2 2 0 1 1 0-4h.1a1.7 1.7 0 0 0 1.5-1 1.7 1.7 0 0 0-.3-1.9l-.1-.1a2 2 0 1 1 2.8-2.8l.1.1a1.7 1.7 0 0 0 1.9.3H9a1.7 1.7 0 0 0 1-1.5V3a2 2 0 1 1 4 0v.1a1.7 1.7 0 0 0 1 1.5 1.7 1.7 0 0 0 1.9-.3l.1-.1a2 2 0 1 1 2.8 2.8l-.1.1a1.7 1.7 0 0 0-.3 1.9V9a1.7 1.7 0 0 0 1.5 1H21a2 2 0 1 1 0 4h-.1a1.7 1.7 0 0 0-1.5 1z" />
              </svg>
            </span>
            Settings
          </a>
          <a href="/admin/widgets" className="sidebar-link" target="_blank" rel="noopener noreferrer">
            <span className="icon">
              <svg viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth={1.8}>
                <rect x="3" y="4" width="18" height="4" rx="1" />
                <rect x="3" y="10" width="18" height="4" rx="1" />
                <rect x="3" y="16" width="18" height="4" rx="1" />
              </svg>
            </span>
            Admin
          </a>
          <a href="/support" className="sidebar-link" target="_blank" rel="noopener noreferrer">
            <span className="icon">
              <svg viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth={1.8}>
                <circle cx="12" cy="12" r="10" />
                <path d="M9.1 9a3 3 0 0 1 5.8 1c0 2-3 2-3 4" />
                <circle cx="12" cy="17" r="0.5" fill="currentColor" />
              </svg>
            </span>
            Help &amp; support
          </a>
        </nav>

        <div className="sidebar-foot">
          <button className="signout" onClick={() => setConfirmingSignOut(true)}>
            <svg width="18" height="18" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth={1.8}>
              <path d="M9 21H5a2 2 0 0 1-2-2V5a2 2 0 0 1 2-2h4M16 17l5-5-5-5M21 12H9" />
            </svg>
            Sign out
          </button>
        </div>
      </div>
      </aside>

      <ConfirmPopup
        open={confirmingSignOut}
        title="Sign out?"
        message="You'll need to sign back in to access your account."
        confirmLabel="Sign Out"
        busyLabel="Signing out…"
        busy={signingOut}
        onConfirm={handleSignOut}
        onClose={() => !signingOut && setConfirmingSignOut(false)}
      />
    </>
  );
}
