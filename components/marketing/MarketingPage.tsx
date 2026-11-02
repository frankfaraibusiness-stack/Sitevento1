// components/marketing/MarketingPage.tsx
//
// Marketing page, trimmed down to just the hero. Every section that
// used to follow it — the connected-site demo, control moments, live
// tracking, capabilities/stats, how-it-works, dashboard preview,
// feature orbit, testimonials, logo marquee, pricing, and FAQ — has
// been removed, along with their dedicated component and CSS files.
//
// Hero (components/marketing/Hero.tsx's <Hero />) is rendered first
// and is now the only thing on the page: the cartoon hero on both
// mobile and desktop (components/marketing/CartoonMobileHero.tsx).
//
// Still owns the open/closed state for HowItWorksModal, the
// full-screen explainer opened by Hero's "How it works" CTA.
'use client';

import { useState } from 'react';
import { Hero } from './Hero';
import { LaptopShowcase } from './LaptopShowcase';
import { HowItWorksModal } from './HowItWorksModal';

interface MarketingPageProps {
  onConnectClick: () => void;
}

export function MarketingPage({ onConnectClick }: MarketingPageProps) {
  const [howItWorksOpen, setHowItWorksOpen] = useState(false);

  return (
    <div id="marketingView">
      <Hero onConnectClick={onConnectClick} onHowItWorksClick={() => setHowItWorksOpen(true)} />
      <LaptopShowcase />

      <HowItWorksModal
        open={howItWorksOpen}
        onClose={() => setHowItWorksOpen(false)}
        onConnectClick={onConnectClick}
      />
    </div>
  );
}
