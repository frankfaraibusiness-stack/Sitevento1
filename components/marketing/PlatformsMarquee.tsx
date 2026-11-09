// components/marketing/PlatformsMarquee.tsx
//
// New marketing section: "Works with the site you already have."
// A continuous, never-stopping auto-scrolling row of platform/builder
// logos (Shopify, Wix, Webflow, Squarespace, WordPress, Framer,
// Next.js, Shopify Plus, Carrd, Ghost, custom HTML) that sitevento's
// one-line script tag works on regardless of what the site is built
// with. Deliberately NOT paused on hover or click — the ask was for
// an auto-scrolling strip that keeps moving no matter what the
// visitor does with their cursor/tap, unlike LaptopShowcase/
// LiveStatsSection's IntersectionObserver-gated demos. It still
// respects prefers-reduced-motion (freezes in place rather than
// forcing motion on someone who's asked their OS not to).
//
// Built as two back-to-back copies of the same logo row inside a
// wider flex track, animated with a CSS @keyframes translateX loop
// (see platforms-marquee.css) — the classic seamless-marquee trick:
// once the first copy has scrolled fully out of view the translateX
// resets to 0, which is imperceptible because the second copy is
// sitting in exactly the position the first one started in.
//
// Each "logo" here is a wordmark built from text + a simple inline
// glyph rather than pulling in real third-party brand SVGs (keeps
// this self-contained, no external asset fetching, no trademarked
// logo files bundled) — styled as a clean monochrome ink chip so the
// row reads as one coherent set rather than a jumble of brand colors.
'use client';

import Link from 'next/link';

interface PlatformDef {
  name: string;
  glyph: 'bag' | 'spiral' | 'web' | 'wp' | 'layers' | 'bolt' | 'card' | 'ghost' | 'code' | 'grid' | 'globe';
}

const PLATFORMS: PlatformDef[] = [
  { name: 'Shopify', glyph: 'bag' },
  { name: 'Webflow', glyph: 'web' },
  { name: 'Next.js', glyph: 'code' },
  { name: 'WordPress', glyph: 'wp' },
  { name: 'Wix', glyph: 'spiral' },
  { name: 'Squarespace', glyph: 'layers' },
  { name: 'Framer', glyph: 'bolt' },
  { name: 'Carrd', glyph: 'card' },
  { name: 'Ghost', glyph: 'ghost' },
  { name: 'HTML sites', glyph: 'grid' },
  { name: 'Custom sites', glyph: 'globe' },
];

function PlatformGlyph({ glyph }: { glyph: PlatformDef['glyph'] }) {
  switch (glyph) {
    case 'bag':
      return (
        <svg viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth={2} strokeLinecap="round" strokeLinejoin="round">
          <path d="M6 7h12l1 13H5L6 7Z" />
          <path d="M9 7a3 3 0 0 1 6 0" />
        </svg>
      );
    case 'spiral':
      return (
        <svg viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth={2} strokeLinecap="round" strokeLinejoin="round">
          <path d="M12 3a9 9 0 1 0 9 9" />
          <path d="M12 7a5 5 0 1 0 5 5" />
          <circle cx="12" cy="12" r="1.3" fill="currentColor" stroke="none" />
        </svg>
      );
    case 'web':
      return (
        <svg viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth={2} strokeLinecap="round" strokeLinejoin="round">
          <circle cx="12" cy="12" r="9" />
          <path d="M3 12h18M12 3c2.5 2.6 3.8 5.8 3.8 9s-1.3 6.4-3.8 9c-2.5-2.6-3.8-5.8-3.8-9s1.3-6.4 3.8-9Z" />
        </svg>
      );
    case 'wp':
      return (
        <svg viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth={2} strokeLinecap="round" strokeLinejoin="round">
          <circle cx="12" cy="12" r="9" />
          <path d="M4.5 9.5 9 17l1.6-4.3L12.5 17 17 8" />
        </svg>
      );
    case 'layers':
      return (
        <svg viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth={2} strokeLinecap="round" strokeLinejoin="round">
          <path d="m12 3 9 5-9 5-9-5 9-5Z" />
          <path d="m3 13 9 5 9-5" />
        </svg>
      );
    case 'bolt':
      return (
        <svg viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth={2} strokeLinecap="round" strokeLinejoin="round">
          <path d="M13 2 4 14h7l-1 8 9-12h-7l1-8Z" />
        </svg>
      );
    case 'card':
      return (
        <svg viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth={2} strokeLinecap="round" strokeLinejoin="round">
          <rect x="3" y="5" width="18" height="14" rx="2.5" />
          <path d="M3 10h18" />
        </svg>
      );
    case 'ghost':
      return (
        <svg viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth={2} strokeLinecap="round" strokeLinejoin="round">
          <path d="M5 20V11a7 7 0 0 1 14 0v9l-2.5-2-2 2-2.5-2-2 2-2.5-2-2 2Z" />
          <circle cx="9.5" cy="11" r="1" fill="currentColor" stroke="none" />
          <circle cx="14.5" cy="11" r="1" fill="currentColor" stroke="none" />
        </svg>
      );
    case 'code':
      return (
        <svg viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth={2} strokeLinecap="round" strokeLinejoin="round">
          <path d="m8 6-5 6 5 6M16 6l5 6-5 6M13.5 4l-3 16" />
        </svg>
      );
    case 'grid':
      return (
        <svg viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth={2} strokeLinecap="round" strokeLinejoin="round">
          <rect x="3" y="3" width="7.5" height="7.5" rx="1.4" />
          <rect x="13.5" y="3" width="7.5" height="7.5" rx="1.4" />
          <rect x="3" y="13.5" width="7.5" height="7.5" rx="1.4" />
          <rect x="13.5" y="13.5" width="7.5" height="7.5" rx="1.4" />
        </svg>
      );
    case 'globe':
    default:
      return (
        <svg viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth={2} strokeLinecap="round" strokeLinejoin="round">
          <circle cx="12" cy="12" r="9" />
          <path d="M3 9h18M3 15h18M12 3a14 14 0 0 1 0 18 14 14 0 0 1 0-18Z" />
        </svg>
      );
  }
}

function PlatformRow({ ariaHidden }: { ariaHidden?: boolean }) {
  return (
    <div className="pfm-row" aria-hidden={ariaHidden}>
      {PLATFORMS.map((p, i) => (
        <span className="pfm-chip" key={`${p.name}-${i}`}>
          <span className="pfm-glyph">
            <PlatformGlyph glyph={p.glyph} />
          </span>
          {p.name}
        </span>
      ))}
    </div>
  );
}

interface PlatformsMarqueeProps {
  // The "Connect your site" CTA that used to sit in its own block
  // directly under the mobile hero photo (CartoonMobileHero.tsx's
  // .hero__inner, alongside a 5-step list) now lives here instead,
  // left-aligned under this section's intro copy — the 5-step list
  // itself was removed, not moved. Optional so this section still
  // renders standalone (e.g. if reused somewhere without the connect
  // flow wired up) without crashing. "How it works" is always shown
  // as a plain link to the real /how-it-works route (no HowItWorksModal.tsx
  // anymore, so no callback needed for it).
  onConnectClick?: () => void;
}

export function PlatformsMarquee({ onConnectClick }: PlatformsMarqueeProps) {
  return (
    <section className="pfm" aria-label="Platforms sitevento works with">
      <div className="pfm-inner">
        <div className="pfm-intro">
          <span className="pfm-eyebrow">Works everywhere</span>
          <h2 className="pfm-title">Built for the site you already have.</h2>
          <p className="pfm-copy">
            Shopify store, Wix page, hand-rolled HTML — doesn&apos;t matter. One script tag and sitevento runs
            alongside your stack, not instead of it.
          </p>

          <div className="pfm-ctas">
            {onConnectClick && (
              <button type="button" className="btn btn-primary" onClick={onConnectClick}>
                Connect your site <span aria-hidden="true">➔</span>
              </button>
            )}

            <Link href="/how-it-works" className="btn btn-secondary">
              <span className="play-icon" aria-hidden="true">▶</span> How it works
            </Link>
          </div>
        </div>

        <div className="pfm-track-wrap">
          <div className="pfm-fade pfm-fade-left" aria-hidden="true" />
          <div className="pfm-fade pfm-fade-right" aria-hidden="true" />
          <div className="pfm-track">
            <PlatformRow />
            <PlatformRow ariaHidden />
          </div>
        </div>
      </div>
    </section>
  );
}
