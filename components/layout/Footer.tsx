'use client';

// components/layout/Footer.tsx
//
// Global site footer: newsletter signup + link columns for every real
// public page (product/SEO pages, legal pages, company pages).
// Mounted from the two shared content shells (ContentPageShell.tsx,
// LegalPage.tsx) so it appears on every about/careers/docs/changelog/
// status/support/contact/terms/privacy/product/pricing page, plus
// directly at the end of MarketingPage.tsx for the homepage. NOT
// mounted in app/layout.tsx (unlike GlobalNav) because that root
// layout also wraps the signed-in /dashboard app shell, which already
// has its own chrome and shouldn't get a marketing footer.
//
// Newsletter signup posts to app/api/newsletter/route.ts — a real
// Firestore write (top-level `newsletterSubscribers` collection, same
// shape as app/api/contact/route.ts's `contactSubmissions`), guarded
// by a honeypot field + IP rate limit + duplicate-email check (see
// that route's header for the full reasoning). The client only sends
// what a browser can honestly report about itself — language and
// timezone (navigator.language / Intl.DateTimeFormat) — everything
// else (country, city, device, browser, OS) is derived server-side
// from real request headers, never guessed on the client.
//
// Bottom padding: on mobile (<860px) GlobalNav's cartoon pill nav
// floats fixed at the bottom of the screen (see
// styles/base/global-nav.css's .gnav-cartoon-root, bottom: 14px +
// safe-area, ~56px tall including its shadow) — so this footer adds
// extra bottom padding at that same breakpoint so its content and the
// copyright line never sit underneath the floating nav. Desktop
// (>=860px) uses GlobalNav's pill nav, which is NOT fixed/floating
// over content the same way, so no extra space is reserved there.
import { useState, type FormEvent } from 'react';
import Link from 'next/link';

const LOGO_URL = 'https://cdn.phototourl.com/member/2026-10-16-c4f6fc3d-2a68-40c8-9241-fa770df8a99f.png';

interface FooterLink {
  label: string;
  href: string;
}

const PRODUCT_LINKS: FooterLink[] = [
  { label: 'How it works', href: '/how-it-works' },
  { label: 'Features', href: '/product/features' },
  { label: 'Visit logs', href: '/product/visit-logs' },
  { label: 'Email capture', href: '/product/email-capture' },
  { label: 'Live overlays', href: '/product/live-overlays' },
  { label: 'Dashboard', href: '/product/dashboard' },
  { label: 'Widgets', href: '/widgets' },
  { label: 'Pricing', href: '/pricing' },
];

const COMPANY_LINKS: FooterLink[] = [
  { label: 'About', href: '/about' },
  { label: 'Careers', href: '/careers' },
  { label: 'Changelog', href: '/changelog' },
  { label: 'Status', href: '/status' },
  { label: 'Docs', href: '/docs' },
];

const SUPPORT_LINKS: FooterLink[] = [
  { label: 'Support', href: '/support' },
  { label: 'Contact', href: '/contact' },
];

const LEGAL_LINKS: FooterLink[] = [
  { label: 'Terms of service', href: '/terms' },
  { label: 'Privacy policy', href: '/privacy' },
];

type SignupState = 'idle' | 'loading' | 'success' | 'duplicate' | 'error';

function FooterLinkColumn({ title, links }: { title: string; links: FooterLink[] }) {
  return (
    <div className="ftr-col">
      <h3 className="ftr-col-title">{title}</h3>
      <ul className="ftr-col-list">
        {links.map((l) => (
          <li key={l.href}>
            <Link href={l.href}>{l.label}</Link>
          </li>
        ))}
      </ul>
    </div>
  );
}

export function Footer() {
  const [email, setEmail] = useState('');
  const [hp, setHp] = useState('');
  const [state, setState] = useState<SignupState>('idle');

  async function handleSubmit(e: FormEvent) {
    e.preventDefault();
    if (state === 'loading') return;
    setState('loading');
    try {
      const res = await fetch('/api/newsletter', {
        method: 'POST',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify({
          email,
          hp,
          // Real, honestly-available client signals only — never
          // invented. Everything else is derived server-side from
          // the request itself (see app/api/newsletter/route.ts).
          lang: typeof navigator !== 'undefined' ? navigator.language : undefined,
          tz: typeof Intl !== 'undefined' ? Intl.DateTimeFormat().resolvedOptions().timeZone : undefined,
        }),
      });
      const data = await res.json().catch(() => ({ ok: false }));
      if (data.ok) {
        setState('success');
        setEmail('');
      } else if (data.reason === 'duplicate') {
        setState('duplicate');
      } else {
        setState('error');
      }
    } catch {
      setState('error');
    }
  }

  return (
    <footer className="ftr">
      <div className="ftr-inner">
        <div className="ftr-top">
          <div className="ftr-brand">
            <Link href="/" className="ftr-logo-link" aria-label="sitevento home">
              <img className="ftr-logo" src={LOGO_URL} alt="sitevento" />
            </Link>
            <p className="ftr-tagline">
              Connect your site. Run it from here. One script — analytics, widgets, and
              automatic traffic protection, live instantly.
            </p>
          </div>

          <div className="ftr-newsletter">
            <h3 className="ftr-col-title">Stay in the loop</h3>
            <p className="ftr-newsletter-copy">Product updates, new widgets, and release notes. No spam.</p>
            <form className="ftr-form" onSubmit={handleSubmit}>
              {/* Honeypot: real visitors never see or fill this —
                  hidden off-screen via CSS rather than display:none,
                  since some bot scripts skip display:none fields. */}
              <input
                type="text"
                name="company"
                value={hp}
                onChange={(e) => setHp(e.target.value)}
                className="ftr-hp"
                tabIndex={-1}
                autoComplete="off"
                aria-hidden="true"
              />
              <div className="ftr-form-row">
                <input
                  type="email"
                  required
                  placeholder="you@email.com"
                  value={email}
                  onChange={(e) => setEmail(e.target.value)}
                  className="ftr-input"
                  disabled={state === 'loading' || state === 'success'}
                  aria-label="Email address"
                />
                <button type="submit" className="ftr-submit" disabled={state === 'loading' || state === 'success'}>
                  {state === 'loading' ? 'Joining…' : state === 'success' ? 'Subscribed' : 'Subscribe'}
                </button>
              </div>
              {state === 'success' && <p className="ftr-form-msg is-ok">You&apos;re on the list.</p>}
              {state === 'duplicate' && <p className="ftr-form-msg is-ok">You&apos;re already subscribed.</p>}
              {state === 'error' && <p className="ftr-form-msg is-err">Something went wrong — try again.</p>}
            </form>
          </div>
        </div>

        <div className="ftr-cols">
          <FooterLinkColumn title="Product" links={PRODUCT_LINKS} />
          <FooterLinkColumn title="Company" links={COMPANY_LINKS} />
          <FooterLinkColumn title="Support" links={SUPPORT_LINKS} />
          <FooterLinkColumn title="Legal" links={LEGAL_LINKS} />
        </div>

        <div className="ftr-bottom">
          <span className="ftr-copyright">© {new Date().getFullYear()} sitevento. All rights reserved.</span>
          <div className="ftr-bottom-links">
            <Link href="/terms">Terms</Link>
            <Link href="/privacy">Privacy</Link>
            <Link href="/contact">Contact</Link>
          </div>
        </div>
      </div>
    </footer>
  );
}
