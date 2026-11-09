'use client';

import { useEffect, useRef, useState } from 'react';
import { onBootLoaderDone } from '@/components/GlobalLoader';

// components/marketing/CartoonMobileHero.tsx
//
// New mobile hero, replacing the old one entirely. Markup and CSS are
// carried over from the provided HTML file as-is — same structure,
// same classes, same animations (loader, headline word-rotator,
// brand marquee, sticky glassy bottom nav) — just converted to JSX
// and broken into components, and scoped under a `.cartoon-hero`
// wrapper (see styles/marketing/cartoon-mobile-hero.css) so its
// generic class names can't collide with the rest of the app.
//
// Shown only below the 1024px desktop breakpoint (gated in the CSS
// file itself); the existing mascot-stage Hero
// (components/marketing/Hero.tsx) is untouched and keeps rendering at
// 1024px+.
//
// onConnectClick is threaded through from MarketingPage — "Connect
// your site" opens the connect flow. The old onHowItWorksClick
// callback (which used to open HowItWorksModal.tsx, now deleted) has
// been removed — "How it works" is a real route now
// (app/how-it-works/page.tsx), linked directly wherever it's shown.

interface CartoonMobileHeroProps {
  onConnectClick: () => void;
}

// NOTE: this hero used to render its own full-screen boot-style
// loader here (logo + shimmering bars + progress bar, on a hardcoded
// 5s timer) on top of whatever AppRoot's real boot loader was already
// showing — so a mobile visitor saw two back-to-back boot screens,
// the second one with no actual connection to whether the app was
// ready. That's gone: components/GlobalLoader.tsx (variant="boot") is
// now the one and only boot screen, mounted once by AppRoot, using
// this same loader design wired to real auth state instead.

// Quick how-it-works steps, stacked under the CTAs on mobile — fills
// the empty stretch of photo between the CTAs and the bottom nav, and
// doubles as a hook into what the product actually does. Desktop
// doesn't render this list here (.hero__inner, which wraps it, is
// display:none at the 1024px+ breakpoint — see
// .cartoon-hero--desktop .hero__inner in marketing-hero.css) — on
// desktop these same 5 steps appear instead, synced to the laptop
// mockup's own step cycle, in the two-column layout below the hero
// (see components/marketing/LaptopShowcase.tsx, which imports this).
// Exported (not just module-local) for that reason.
export const HOW_IT_WORKS_STEPS = [
  'Connect your site',
  'Verify the meta tag',
  'Connected',
  'Control everything',
  '24/7 Security',
];

interface CartoonHeroContentProps {
  onConnectClick: () => void;
}

// Sites-connected stat. Counts up from 0 to SITES_CONNECTED_TARGET
// over 3 seconds once two things are both true: the boot loader has
// finished (components/GlobalLoader.tsx, variant="boot") AND this
// block has actually scrolled into view. Previously this started
// counting on mount regardless of the boot loader, so on a normal
// boot (loader up for several seconds) the whole animation played
// out hidden behind it and nobody ever saw the count-up — only the
// final number, once the loader finally cleared. Gating on
// onBootLoaderDone fixes that: the count now only starts once
// there's actually something visible to look at.
const SITES_CONNECTED_TARGET = 1000;
const COUNT_UP_MS = 3000;

// Exported so the mobile laptop showcase
// (components/marketing/LaptopShowcase.tsx, centered above the laptop
// stage in .sv-stat-strip, mobile-only — hidden at 1024px+) can render
// this stat block. It no longer renders inside the mobile hero photo
// itself — it used to sit absolutely positioned there
// (.cartoon-hero .hero__statBlock), floating over the mascot art
// opposite the description, but that crowded the hero photo, so it
// now lives under the laptop demo instead. The desktop hero
// (components/marketing/Hero.tsx) used to render this same stat
// directly under its photo too, but that's been removed — the hero
// photo now flows straight into the next section on both breakpoints,
// with no stat strip under it anywhere near the hero. The counting
// logic itself (gated on the boot loader finishing, not on scroll) is
// unchanged.
export function SitesConnectedStat() {
  const [count, setCount] = useState(0);
  const ref = useRef<HTMLDivElement>(null);
  const hasAnimated = useRef(false);
  const bootDoneRef = useRef(false);

  useEffect(() => {
    // Respect reduced-motion users — jump straight to the final
    // number instead of animating it.
    const prefersReducedMotion =
      typeof window !== 'undefined' &&
      window.matchMedia?.('(prefers-reduced-motion: reduce)').matches;

    const runCountUp = () => {
      if (hasAnimated.current) return;
      hasAnimated.current = true;

      if (prefersReducedMotion) {
        setCount(SITES_CONNECTED_TARGET);
        return;
      }

      const start = performance.now();
      const step = (now: number) => {
        const elapsed = now - start;
        const progress = Math.min(elapsed / COUNT_UP_MS, 1);
        // Ease-out so it starts fast and settles gently on the
        // final number instead of ticking up at a flat linear rate.
        const eased = 1 - Math.pow(1 - progress, 3);
        setCount(Math.round(eased * SITES_CONNECTED_TARGET));
        if (progress < 1) {
          requestAnimationFrame(step);
        }
      };
      requestAnimationFrame(step);
    };

    // Previously gated on scroll-into-view as well as boot finishing,
    // so the stat sat at "0+" (looking unloaded/broken) until the
    // visitor actually scrolled to it. This block is inside the hero,
    // visible on load, not something scrolled to later — so it now
    // only waits on the boot loader and counts up as soon as that's
    // done, instead of also waiting on an IntersectionObserver.
    const unsubscribeBootDone = onBootLoaderDone(() => {
      bootDoneRef.current = true;
      runCountUp();
    });

    return () => {
      unsubscribeBootDone();
    };
  }, []);

  return (
    <div className="hero__statBlock" ref={ref} aria-hidden="true">
      <span className="hero__statNumber">{count.toLocaleString()}+</span>
      <span className="hero__statLabel">SITES CONNECTED</span>
    </div>
  );
}

// The section that used to sit here — .hero__inner, with its 2 CTAs
// (Connect your site / Watch Demo) and the 5-item .hero__steps list —
// has been removed per request: that content now lives in
// PlatformsMarquee.tsx instead (the "works everywhere" section), left-
// aligned above its own platform strip, so the CTAs belong to that
// section rather than floating in an empty block under the hero photo.
// This component (CartoonHeroContent) is now just the hero photo band
// itself, with no content underneath it, so nothing creates a gap
// between the photo and whatever section follows (see
// cartoon-mobile-hero.css for the matching spacing cleanup). Desktop's
// hero (components/marketing/Hero.tsx) has its own separate markup
// (DesktopHeroContent) rather than reusing this component — it used
// to also render a sites-connected stat strip directly under the
// photo, but that's been removed too, so both breakpoints now behave
// the same way: hero photo, then straight into the next section.
export function CartoonHeroContent({ onConnectClick }: CartoonHeroContentProps) {
  // onConnectClick is no longer used here (the CTA that used it moved
  // to PlatformsMarquee) but is kept in the prop signature so
  // CartoonMobileHero doesn't need a matching change, and so this
  // still composes cleanly if content is ever restored under the
  // photo.
  void onConnectClick;

  return (
    <section className="hero" aria-label="Sitevento">
      {/* Just the hero photo itself — no title, no description, no
          rotator, no sites-connected stat, no CTAs/steps overlaid on
          or stacked under it. The photo already carries its own
          baked-in headline/description art. Hidden on desktop
          (.cartoon-hero--desktop .hero__banner, marketing-hero.css) —
          desktop renders its own full-height version of the same
          plain photo instead (see components/marketing/Hero.tsx's
          .dhero). */}
      <div className="hero__banner" aria-hidden="true" />
    </section>
  );
}

// NOTE: the source HTML's sticky bottom nav is NOT rendered here
// anymore — it now replaces the app's real nav in
// components/layout/GlobalNav.tsx (mounted once, site-wide, from
// app/layout.tsx), so there's exactly one nav instead of a second,
// non-functional copy stacked under this hero. See GlobalNav.tsx /
// global-nav.css for the live version with real routes and active-
// state highlighting.
export function CartoonMobileHero({ onConnectClick }: CartoonMobileHeroProps) {
  return (
    <div className="cartoon-hero">
      <div className="page">
        <CartoonHeroContent onConnectClick={onConnectClick} />
      </div>
    </div>
  );
}
