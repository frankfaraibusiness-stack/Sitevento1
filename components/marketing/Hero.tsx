'use client';

import { CartoonMobileHero, CartoonHeroContent } from './CartoonMobileHero';

// components/marketing/Hero.tsx
//
// Hero is the only thing left on the marketing page now — every other
// marketing section (the connected-site demo, control moments, live
// tracking, capabilities/stats, how-it-works, dashboard preview,
// feature orbit, testimonials, logo marquee, pricing, FAQ) has been
// removed from MarketingPage.tsx, along with their component and CSS
// files.
//
// Hero itself renders the cartoon hero (CartoonMobileHero /
// CartoonHeroContent, shared between mobile and desktop) — same
// title/rotator, same description, same custom pill CTAs, same
// platforms badge on both breakpoints. The old mascot stage
// (an animated glow/rings/orbiting-shapes rig around
// /mascot/hero-bunny.png, previously kept here unused "in case it's
// wanted elsewhere later") has been removed outright — the mascot
// isn't shown anywhere in the hero and never was after the cartoon
// hero shipped. HowItWorksModal (components/marketing/
// HowItWorksModal.tsx) is still rendered by MarketingPage and opened
// by Hero's "How it works" CTA below.
interface HeroProps {
  onConnectClick: () => void;
  onHowItWorksClick: () => void;
}

export function Hero({ onConnectClick, onHowItWorksClick }: HeroProps) {
  return (
    <>
      {/* Mobile (below 1024px): the cartoon hero. Hidden at 1024px+ via
          styles/marketing/cartoon-mobile-hero.css. */}
      <CartoonMobileHero onConnectClick={onConnectClick} onHowItWorksClick={onHowItWorksClick} />

      {/* Desktop (1024px+): same content as the mobile hero — same
          title/rotator, same description, same custom pill CTAs,
          same platforms badge (CartoonHeroContent, shared with
          CartoonMobileHero.tsx) — laid out over the landscape photo
          as a full-bleed background that starts at the true top of
          the viewport behind the header, exactly like mobile does.
          Hidden below 1024px via .hero-section-desktop gating in
          styles/marketing/marketing-hero.css. */}
      <section className="hero-section-desktop cartoon-hero--desktop">
        <CartoonHeroContent onConnectClick={onConnectClick} onHowItWorksClick={onHowItWorksClick} />
      </section>
    </>
  );
}
