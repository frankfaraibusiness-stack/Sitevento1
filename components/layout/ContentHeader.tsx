'use client';

// components/layout/ContentHeader.tsx
//
// The real app top bar (logo, sign-up/avatar, hamburger-style "menu"
// button) for every statically-rendered content/footer page — Terms,
// Privacy, Pricing, About, Careers, Contact, Status, Docs, Changelog,
// Support, and all /product/* pages. Those pages previously rendered
// only a bare "← sitevento" back-link (components/legal/LegalPage.tsx's
// .legal-topbar, components/content/ContentPageShell.tsx's .cp-topbar)
// instead of the real header every other page gets — this component
// replaces both of those call sites so the header is identical
// everywhere, the same reason components/layout/SiteFooter.tsx already
// unified every page's footer.
//
// Why this can't just reuse components/layout/Header.tsx directly: that
// component's clicks are STATE CHANGES inside components/AppRoot.tsx's
// client-side view switch (logo click = swap to the marketing view,
// no real navigation) — it has no meaning on a page outside that SPA
// shell. This is a real-navigation sibling with the identical markup/
// CSS classes (.pill-nav, .nav-logo, .nav-right, .signup, .nav-profile,
// .hamburger) so it's pixel-identical, but every action is a plain
// <Link>: the logo and "menu" button both go home (these pages have no
// sidebar to open), and the right-side control is a real link to the
// homepage (signed out) or straight to the dashboard profile (signed
// in) rather than opening the SPA's in-page auth modal.
//
// 'use client' only because it reads useAuth() for the signed-in
// avatar; every page that renders this (LegalPage, ContentPageShell,
// the pricing page) stays a Server Component around it, same way they
// already mount the client SiteFooter today — Next.js still statically
// generates the rest of the page.
import Link from 'next/link';
import { useAuth } from '@/hooks/useAuth';

const LOGO_URL = 'https://cdn.phototourl.com/member/2026-10-16-c4f6fc3d-2a68-40c8-9241-fa770df8a99f.png';

export function ContentHeader() {
  const { user } = useAuth();
  const name = user ? user.displayName || (user.email ? user.email.split('@')[0] : 'Account') : '';
  const initial = name.trim().charAt(0).toUpperCase() || '?';

  return (
    <header>
      <div className="pill-nav">
        <Link href="/" aria-label="sitevento home">
          <img className="nav-logo" src={LOGO_URL} alt="sitevento" />
        </Link>
        <div className="nav-right">
          {user ? (
            <Link href="/dashboard/profile" className="nav-profile" aria-label="Go to dashboard">
              {user.photoURL ? (
                <img src={user.photoURL} alt={name} />
              ) : (
                <span className="nav-profile-initial">{initial}</span>
              )}
            </Link>
          ) : (
            <Link href="/" className="signup" style={{ textDecoration: 'none', display: 'inline-flex', alignItems: 'center' }}>
              Sign up
            </Link>
          )}
          <Link href="/" className="hamburger" aria-label="sitevento home">
            <span></span>
            <span></span>
            <span></span>
          </Link>
        </div>
      </div>
    </header>
  );
}
