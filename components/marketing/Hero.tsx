'use client';

import { CartoonMobileHero, SitesConnectedStat } from './CartoonMobileHero';

// components/marketing/Hero.tsx
//
// Hero is the only thing left on the marketing page now — every other
// marketing section (the connected-site demo, control moments, live
// tracking, capabilities/stats, how-it-works, dashboard preview,
// feature orbit, testimonials, logo marquee, pricing, FAQ) has been
// removed from MarketingPage.tsx, along with their component and CSS
// files.
//
// Mobile (below 1024px) still renders the cartoon hero
// (CartoonMobileHero, components/marketing/CartoonMobileHero.tsx) —
// untouched.
//
// Desktop (1024px+) NO LONGER reuses CartoonMobileHero's content/
// markup. It used to (CartoonHeroContent, shared between both
// breakpoints, laid out over /mascot/hero-bg-desktop.jpg as a plain
// background-image) — that whole approach is replaced below with its
// own DesktopHeroContent: a new full-viewport hero built specifically
// for the new desktop hero photo (the mascot + "Sitevento.com"
// building shot, dark on the left so white text reads clearly there),
// with its own title/description and two CTAs laid out side by side.
// Only the CTA buttons themselves (.btn/.btn-primary/.btn-secondary)
// are reused from the shared button styles — everything else here is
// new markup/CSS, not a copy of the mobile layout.
//
// The "sites connected" stat also moves out of the hero entirely on
// desktop: it no longer floats over the photo (that was
// .cartoon-hero--desktop .hero__statBlock, position: absolute, bottom-
// right of the image) — it now renders as its own small centered
// block directly beneath the hero section, same stat/same count-up
// logic (SitesConnectedStat, exported from CartoonMobileHero.tsx),
// just placed outside the photo instead of on top of it.
//
// HowItWorksModal (components/marketing/HowItWorksModal.tsx) is still
// rendered by MarketingPage and opened by Hero's "How it works" CTA
// below.
interface HeroProps {
  onConnectClick: () => void;
  onHowItWorksClick: () => void;
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

interface DesktopHeroContentProps {
  onConnectClick: () => void;
  onHowItWorksClick: () => void;
}

// New desktop-only hero content, built against the new hero photo
// (public/mascot/hero-bg-desktop.jpg): the mascot + branded building
// sit on the right two-thirds, the left third is a dark night sky —
// already dark enough for white text with no extra gradient/tint
// needed over it, same reasoning the old photo used for its bright
// open-sky side. Title + description + two side-by-side CTAs sit in
// that dark left region; nothing here is copied from the mobile
// layout except the .btn/.btn-primary/.btn-secondary CTA classes
// themselves (still shared so both breakpoints' buttons stay visually
// consistent and any future button-style change only has one place
// to edit).
function DesktopHeroContent({ onConnectClick, onHowItWorksClick }: DesktopHeroContentProps) {
  return (
    <section className="dhero" aria-labelledby="dhero-title">
      <div className="dhero__scrim" aria-hidden="true" />
      <div className="dhero__content">
        <h1 className="dhero__title" id="dhero-title">
          <span className="dhero__titleLine">YOUR WEBSITE, FULLY</span>
          <span className="dhero__rotator">
            {ROTATOR_WORDS.map((word) => (
              <span className="dhero__rotatorWord" key={word}>
                {word}
              </span>
            ))}
          </span>
        </h1>

        <p className="dhero__sub">
          Connect your site once and <strong>see exactly who&apos;s visiting</strong>, then deploy alerts and
          widgets in seconds — without touching your live code.
        </p>

        <div className="dhero__ctas">
          <button type="button" className="btn btn-primary" onClick={onConnectClick}>
            Connect your site <span aria-hidden="true">➔</span>
          </button>

          <button type="button" className="btn btn-secondary" onClick={onHowItWorksClick}>
            <span className="play-icon" aria-hidden="true">▶</span> Watch Demo
          </button>
        </div>
      </div>
    </section>
  );
}

export function Hero({ onConnectClick, onHowItWorksClick }: HeroProps) {
  return (
    <>
      {/* Mobile (below 1024px): the cartoon hero. Hidden at 1024px+ via
          styles/marketing/cartoon-mobile-hero.css. */}
      <CartoonMobileHero onConnectClick={onConnectClick} onHowItWorksClick={onHowItWorksClick} />

      {/* Desktop (1024px+): new hero built specifically for this
          breakpoint (DesktopHeroContent above) over the new hero
          photo, full-bleed from the true top of the viewport behind
          the header — same positioning trick the old desktop hero
          used, just new content/CSS. Hidden below 1024px via
          .hero-section-desktop gating in
          styles/marketing/marketing-hero.css. */}
      <div className="hero-section-desktop">
        <DesktopHeroContent onConnectClick={onConnectClick} onHowItWorksClick={onHowItWorksClick} />

        {/* Sites-connected stat, centered under the hero — not inside
            the photo. */}
        <div className="dhero__statStrip">
          <SitesConnectedStat />
        </div>
      </div>
    </>
  );
}
