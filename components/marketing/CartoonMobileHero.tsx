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
// MarketingPage — "Connect Site" opens the connect flow, "Watch Demo"
// opens the existing HowItWorksModal, matching their closest
// equivalents from the previous hero.

interface CartoonMobileHeroProps {
  onConnectClick: () => void;
  onHowItWorksClick: () => void;
}

function CartoonLoader() {
  return (
    <div className="loader" role="status" aria-live="polite" aria-label="Loading">
      <div className="loader__card">
        <div className="loader__mark" aria-hidden="true">S</div>
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

const BRAND_ITEMS = [
  { key: 'shopify', modifier: 'brand--shopify', logo: 'S', label: 'Shopify' },
  { key: 'wordpress', modifier: 'brand--wordpress', logo: 'W', label: 'WordPress' },
  { key: 'webflow', modifier: 'brand--webflow', logo: 'W', label: 'Webflow' },
  { key: 'custom', modifier: 'brand--custom', logo: 'C', label: 'Custom' },
] as const;

interface CartoonHeroContentProps {
  onConnectClick: () => void;
  onHowItWorksClick: () => void;
}

function CartoonHeroContent({ onConnectClick, onHowItWorksClick }: CartoonHeroContentProps) {
  return (
    <section className="hero" aria-labelledby="hero-title">
      <div className="hero__pattern" aria-hidden="true" />
      <div className="hero__blob hero__blob--a" aria-hidden="true" />
      <div className="hero__blob hero__blob--b" aria-hidden="true" />

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
            <button type="button" className="btn btn--primary" onClick={onConnectClick}>
              Connect Site
              <svg
                width="18"
                height="18"
                viewBox="0 0 24 24"
                fill="none"
                stroke="currentColor"
                strokeWidth="2.5"
                strokeLinecap="round"
                strokeLinejoin="round"
                aria-hidden="true"
              >
                <path d="M5 12h14M13 6l6 6-6 6" />
              </svg>
            </button>

            <button type="button" className="btn btn--ghost" onClick={onHowItWorksClick}>
              <span className="btn__icon">
                <svg className="icon-play" viewBox="0 0 24 24" fill="currentColor" aria-hidden="true">
                  <path d="M7 4.5v15l13-7.5z" />
                </svg>
                <svg className="icon-pause" viewBox="0 0 24 24" fill="currentColor" aria-hidden="true">
                  <rect x="6.5" y="4.5" width="4" height="15" rx="1" />
                  <rect x="13.5" y="4.5" width="4" height="15" rx="1" />
                </svg>
              </span>
              Watch Demo
            </button>
          </div>

          <div className="brands">
            <p className="brands__label">Works with your stack</p>
            <div className="marquee">
              <div className="marquee__track">
                {BRAND_ITEMS.map((brand) => (
                  <div className={`brand ${brand.modifier}`} key={brand.key}>
                    <span className="brand__logo" aria-hidden="true">{brand.logo}</span>
                    <span>{brand.label}</span>
                  </div>
                ))}
                {/* Duplicate set for the -50% seamless marquee loop */}
                {BRAND_ITEMS.map((brand) => (
                  <div className={`brand ${brand.modifier}`} key={`${brand.key}-dup`} aria-hidden="true">
                    <span className="brand__logo">{brand.logo}</span>
                    <span>{brand.label}</span>
                  </div>
                ))}
              </div>
            </div>
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
