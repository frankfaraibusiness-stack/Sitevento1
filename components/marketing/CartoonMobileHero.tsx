'use client';

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

// Same wordmark asset used by the real app boot splash
// (components/BootSplash.tsx) — the loader below previously showed a
// small boxed "S" standing in for the brand instead of the actual
// logo. Shown at its own aspect ratio, not squeezed into a square
// icon tile.
const LOADER_LOGO_URL =
  'https://cdn.phototourl.com/member/2026-10-16-c4f6fc3d-2a68-40c8-9241-fa770df8a99f.png';

function CartoonLoader() {
  return (
    <div className="loader" role="status" aria-live="polite" aria-label="Loading">
      <div className="loader__card">
        <img className="loader__mark" src={LOADER_LOGO_URL} alt="sitevento" />
        <div className="loader__bar loader__bar--title" aria-hidden="true" />
        <div className="loader__bar loader__bar--title short" aria-hidden="true" />
        <div className="loader__bar loader__bar--line" aria-hidden="true" />
        <div className="loader__bar loader__bar--line short" aria-hidden="true" />
        <div className="loader__progress" aria-hidden="true">
          <div className="loader__progressFill" />
        </div>
        <div className="loader__caption">
          <span>Warming things up</span>
          <span className="loader__dots" aria-hidden="true">
            <span />
            <span />
            <span />
          </span>
        </div>
      </div>
    </div>
  );
}

const ROTATOR_WORDS = [
  'YOURS',
  'IN CONTROL',
  'ON AUTOPILOT',
  'ANALYTICS-READY',
  'REIMAGINED',
  'EFFORTLESS',
  'YOURS TO SHAPE',
];

interface CartoonHeroContentProps {
  onConnectClick: () => void;
  onHowItWorksClick: () => void;
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
            Connect your site once and <strong>see exactly who&apos;s visiting</strong>,
            then deploy alerts and widgets in seconds — without touching your
            live code.
          </p>

          <div className="hero__ctas">
            <button type="button" className="btn btn-primary" onClick={onConnectClick}>
              Connect your site <span aria-hidden="true">➔</span>
            </button>

            <button type="button" className="btn btn-secondary" onClick={onHowItWorksClick}>
              <span className="play-icon" aria-hidden="true">▶</span> Watch Demo
            </button>
          </div>
        </div>

        {/* desktop placeholder for the image */}
        <div className="hero__visual" aria-hidden="true" />
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
      <CartoonLoader />
      <div className="page">
        <CartoonHeroContent onConnectClick={onConnectClick} onHowItWorksClick={onHowItWorksClick} />
      </div>
    </div>
  );
}
