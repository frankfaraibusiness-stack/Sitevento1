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
// The CTAs are wired to the same callbacks the old hero used
// (onConnectClick / onHowItWorksClick), threaded through from
// MarketingPage — "Connect your site" opens the connect flow, "Watch
// Demo" opens the existing HowItWorksModal, matching their closest
// equivalents from the previous hero.

interface CartoonMobileHeroProps {
  onConnectClick: () => void;
  onHowItWorksClick: () => void;
}

// NOTE: this hero used to render its own full-screen boot-style
// loader here (logo + shimmering bars + progress bar, on a hardcoded
// 5s timer) on top of whatever AppRoot's real boot loader was already
// showing — so a mobile visitor saw two back-to-back boot screens,
// the second one with no actual connection to whether the app was
// ready. That's gone: components/GlobalLoader.tsx (variant="boot") is
// now the one and only boot screen, mounted once by AppRoot, using
// this same loader design wired to real auth state instead.

const ROTATOR_WORDS = [
  'YOURS',
  'IN CONTROL',
  'ON AUTOPILOT',
  'ANALYTICS-READY',
  'REIMAGINED',
  'EFFORTLESS',
  'YOURS TO SHAPE',
];

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
  onHowItWorksClick: () => void;
}

// Sites-connected stat, sitting opposite the description paragraph
// on the open patch of photo above the mascot. Counts up from 0 to
// SITES_CONNECTED_TARGET over 3 seconds once two things are both
// true: the boot loader has finished (components/GlobalLoader.tsx,
// variant="boot") AND this block has actually scrolled into view.
// Previously this started counting on mount regardless of the boot
// loader, so on a normal boot (loader up for several seconds) the
// whole animation played out hidden behind it and nobody ever saw
// the count-up — only the final number, once the loader finally
// cleared. Gating on onBootLoaderDone fixes that: the count now only
// starts once there's actually something visible to look at.
const SITES_CONNECTED_TARGET = 1000;
const COUNT_UP_MS = 3000;

function SitesConnectedStat() {
  const [count, setCount] = useState(0);
  const ref = useRef<HTMLDivElement>(null);
  const hasAnimated = useRef(false);
  const bootDoneRef = useRef(false);

  useEffect(() => {
    const node = ref.current;
    if (!node) return;

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

    // Only actually start counting once both conditions are met;
    // either one can arrive first (the hero can scroll into view
    // before boot finishes, or already be in view the moment boot
    // finishes), so each handler below just checks the other.
    let inView = false;
    const tryStart = () => {
      if (inView && bootDoneRef.current) runCountUp();
    };

    const unsubscribeBootDone = onBootLoaderDone(() => {
      bootDoneRef.current = true;
      tryStart();
    });

    const observer = new IntersectionObserver(
      (entries) => {
        entries.forEach((entry) => {
          if (entry.isIntersecting) {
            inView = true;
            tryStart();
          }
        });
      },
      { threshold: 0.4 },
    );

    observer.observe(node);
    return () => {
      observer.disconnect();
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

// Exported so the desktop hero (components/marketing/Hero.tsx) can
// render this exact same markup — same title/rotator, same
// description, same custom pill CTAs, same platforms badge — instead
// of a separate, re-typed desktop copy block. Only the CSS differs
// per breakpoint (see .hero-section-desktop .cartoon-hero in
// marketing-hero.css), the content and classes are identical.
export function CartoonHeroContent({ onConnectClick, onHowItWorksClick }: CartoonHeroContentProps) {
  return (
    <section className="hero" aria-labelledby="hero-title">
      <div className="hero__layout">
        <div className="hero__inner">
          <h1 className="hero__title" id="hero-title">
            <span className="hero__titleLine">YOUR WEBSITE, FULLY</span>
            <span className="rotator">
              {ROTATOR_WORDS.map((word) => (
                <span className="rotator__word" key={word}>
                  {word}
                </span>
              ))}
            </span>
          </h1>

          <p className="hero__sub">
            <span className="hero__subLine">Connect your site once and</span>
            <span className="hero__subLine">
              <strong>see exactly who&apos;s visiting</strong>,
            </span>
            <span className="hero__subLine">then deploy alerts and widgets</span>
            <span className="hero__subLine">in seconds — without touching</span>
            <span className="hero__subLine">your live code.</span>
          </p>

          <div className="hero__ctas">
            <button type="button" className="btn btn-primary" onClick={onConnectClick}>
              Connect your site <span aria-hidden="true">➔</span>
            </button>

            <button type="button" className="btn btn-secondary" onClick={onHowItWorksClick}>
              <span className="play-icon" aria-hidden="true">▶</span> Watch Demo
            </button>
          </div>

          <ol className="hero__steps" aria-label="How it works">
            {HOW_IT_WORKS_STEPS.map((step, index) => (
              <li className="hero__step" key={step}>
                <span className="hero__stepNum" aria-hidden="true">{index + 1}</span>
                <span className="hero__stepText">{step}</span>
              </li>
            ))}
          </ol>
        </div>

        {/* desktop placeholder for the image */}
        <div className="hero__visual" aria-hidden="true" />

        {/* Mobile-only: sits in the open part of the photo beside the
            mascot, to the right of the left-aligned copy column.
            Hidden on desktop alongside .hero__inner (see
            .cartoon-hero--desktop .hero__statBlock in
            marketing-hero.css). */}
        <SitesConnectedStat />
      </div>
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
export function CartoonMobileHero({ onConnectClick, onHowItWorksClick }: CartoonMobileHeroProps) {
  return (
    <div className="cartoon-hero">
      <div className="page">
        <CartoonHeroContent onConnectClick={onConnectClick} onHowItWorksClick={onHowItWorksClick} />
      </div>
    </div>
  );
}
