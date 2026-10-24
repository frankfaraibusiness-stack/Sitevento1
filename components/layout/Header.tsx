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
}

export function Header({ user, onLogoClick, onSignupClick, onProfileClick, onHamburgerClick }: HeaderProps) {
  const name = user ? user.displayName || (user.email ? user.email.split('@')[0] : 'Account') : '';
  const initial = name.trim().charAt(0).toUpperCase() || '?';

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
          {!user && (
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
          {user && (
            <button className="nav-profile" style={{ display: 'flex' }} onClick={onProfileClick} aria-label="Go to dashboard">
              {user.photoURL ? (
                <img src={user.photoURL} alt={name} />
              ) : (
                <span className="nav-profile-initial">{initial}</span>
              )}
            </button>
          )}
          <button className="hamburger" aria-label="Open menu" onClick={onHamburgerClick}>
            <span></span>
            <span></span>
            <span></span>
          </button>
        </div>
      </div>
    </header>
  );
}
