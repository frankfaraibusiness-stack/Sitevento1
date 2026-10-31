'use client';

// components/layout/Header.tsx — replaces the <header class="pill-nav">
// block + renderGuestHeader/renderSignedInHeader. The signed-in avatar
// (photo vs initial) is now a derived render instead of innerHTML swap.
import type { User } from 'firebase/auth';

interface HeaderProps {
  user: User | null;
  onLogoClick: () => void;
  onSignupClick: () => void;
  onProfileClick: () => void;
  onHamburgerClick: () => void;
  // When set, the header renders in its stripped-down "auth" mode: no
  // signup button, no profile avatar, no hamburger — just the logo on
  // the left (same as everywhere else) and a bare close (X) in the
  // hamburger's place, calling this instead of onHamburgerClick. Lets
  // AuthOverlay reuse this component instead of keeping its own
  // near-duplicate header markup/CSS in sync by hand.
  onCloseClick?: () => void;
}

export function Header({ user, onLogoClick, onSignupClick, onProfileClick, onHamburgerClick, onCloseClick }: HeaderProps) {
  const name = user ? user.displayName || (user.email ? user.email.split('@')[0] : 'Account') : '';
  const initial = name.trim().charAt(0).toUpperCase() || '?';
  const isAuthMode = !!onCloseClick;

  return (
    <header>
      <div className="pill-nav">
        <img
          className="nav-logo"
          src="https://cdn.phototourl.com/member/2026-10-16-c4f6fc3d-2a68-40c8-9241-fa770df8a99f.png"
          alt="sitevento"
          style={{ cursor: 'pointer' }}
          onClick={() => {
            onLogoClick();
            window.scrollTo({ top: 0, behavior: 'auto' });
          }}
        />
        <div className="nav-right">
          {!isAuthMode && !user && (
            <a
              className="signup"
              href="#"
              style={{ textDecoration: 'none', display: 'inline-flex', alignItems: 'center' }}
              onClick={(e) => {
                e.preventDefault();
                onSignupClick();
              }}
            >
              Sign up
            </a>
          )}
          {!isAuthMode && user && (
            <button className="nav-profile" style={{ display: 'flex' }} onClick={onProfileClick} aria-label="Go to dashboard">
              {user.photoURL ? (
                <img src={user.photoURL} alt={name} />
              ) : (
                <span className="nav-profile-initial">{initial}</span>
              )}
            </button>
          )}
          {isAuthMode ? (
            <button className="nav-close" aria-label="Close" onClick={onCloseClick}>
              <svg viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth={2}>
                <path d="M18 6L6 18M6 6l12 12" />
              </svg>
            </button>
          ) : (
            <button className="hamburger" aria-label="Open menu" onClick={onHamburgerClick}>
              <span></span>
              <span></span>
              <span></span>
            </button>
          )}
        </div>
      </div>
    </header>
  );
}
