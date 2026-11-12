'use client';

import Link from 'next/link';
import { CartoonMobileHero } from './CartoonMobileHero';

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
// The "sites connected" stat strip that used to sit directly under
// the desktop hero (.dhero__statStrip, SitesConnectedStat) has been
// removed entirely — mobile never had an equivalent block there (its
// hero photo flows straight into the next section), so desktop now
// matches: the hero photo is immediately followed by whatever section
// comes after it, on both breakpoints, with nothing in between.
//
// "How it works" used to open HowItWorksModal.tsx (deleted) in-page;
// it's now a real route (app/how-it-works/page.tsx), so the CTA below
// is a plain <Link> instead of a callback into a modal-open state.
interface HeroProps {
  onConnectClick: () => void;
}

interface DesktopHeroContentProps {
  onConnectClick: () => void;
}

// Desktop-only hero content, built against the new hero photo
// (public/mascot/hero-bg-desktop.jpg). Per request, the photo now
// carries no overlay at all — no title, no rotator, no description —
// since the photo itself already carries its own baked-in headline/
// description art; .dhero__scrim and .dhero__content (the dark-sky
// tint and the title/description text block that used to sit on top
// of it) have been removed below. Only the two CTAs remain, laid out
// over the photo's own lower-left clear space; .btn/.btn-primary/
// .btn-secondary are still shared with the mobile CTA styles.
function DesktopHeroContent({ onConnectClick }: DesktopHeroContentProps) {
  return (
    <section className="dhero" aria-label="Sitevento">
      <div className="dhero__ctas">
        <button type="button" className="btn btn-primary" onClick={onConnectClick}>
          Connect your site <span aria-hidden="true">➔</span>
        </button>

        <Link href="/how-it-works" className="btn btn-secondary">
          <span className="play-icon" aria-hidden="true">▶</span> How it works
        </Link>
      </div>
    </section>
  );
}

export function Hero({ onConnectClick }: HeroProps) {
  return (
    <>
      {/* Mobile (below 1024px): the cartoon hero. Hidden at 1024px+ via
          styles/marketing/cartoon-mobile-hero.css. */}
      <CartoonMobileHero onConnectClick={onConnectClick} />

      {/* Desktop (1024px+): new hero built specifically for this
          breakpoint (DesktopHeroContent above) over the new hero
          photo. Starts right under the fixed header, not behind it —
          same convention as the mobile hero banner (see
          cartoon-mobile-hero.css's .hero__banner). Hidden below
          1024px via .hero-section-desktop gating in
          styles/marketing/marketing-hero.css. */}
      <div className="hero-section-desktop">
        <DesktopHeroContent onConnectClick={onConnectClick} />
      </div>
    </>
  );
}
