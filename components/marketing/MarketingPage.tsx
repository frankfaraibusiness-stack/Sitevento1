// components/marketing/MarketingPage.tsx
//
// Marketing page. Testimonials, logo marquee, pricing, and FAQ are
// still removed (previously stripped along with their dedicated
// component/CSS files) — this stays intro-focused rather than a full
// features/pricing pitch.
//
// Current stack, in order:
//   1. Hero (components/marketing/Hero.tsx) — cartoon hero on both
//      mobile and desktop.
//   2. LaptopShowcase — the connect-flow demo (paste the script tag
//      → verifying → connected → control panel → security).
//   3. LiveStatsSection — "One script. No rebuild." intro copy plus
//      a cartoon-styled live stats demo (radar + ticking cards),
//      illustrating what the real dashboard looks like once
//      connected.
//   4. WidgetShowcaseSection — "Deploy in one click": mini dark-panel
//      previews of three real widgets (Support Chat, Site Alert,
//      Email Capture) with a one-click deploy pitch for each.
//   5. PlatformsMarquee — "Built for the site you already have": a
//      continuous, never-stopping auto-scrolling row of platform
//      chips (Shopify, Wix, Webflow, WordPress, Squarespace, Framer,
//      Carrd, Ghost, Next.js, custom HTML, any website).
//   6. TestimonialsSection — a grid of mockup customer quotes
//      (3-up desktop, 2-up tablet, 1-up mobile), illustrating the
//      kind of feedback the product aims to earn.
//   7. FeatureHighlightsSection — a 6-tile "everything included"
//      recap of the real product surface (visit tracking, bot
//      shield, AI agent, email capture, site alerts, monetization).
//   8. ComparisonSection — "one tag beats five tools": sitevento vs.
//      piecing together several separate tools yourself, as a real
//      table on desktop and stacked cards on mobile.
//   9. FinalCTASection — closing lime conversion band ("Paste one
//      script. See everything.") reusing the same onConnectClick
//      handler as every other CTA on this page.
//   10. Footer (components/layout/Footer.tsx) — global footer with
//      newsletter signup + link columns for every real page. Also
//      mounted in ContentPageShell.tsx and LegalPage.tsx so it
//      appears on every content/legal/product route, not just here.
//
// Still owns the open/closed state for HowItWorksModal, the
// full-screen explainer opened by Hero's "How it works" CTA.
'use client';

import { useState } from 'react';
import { Hero } from './Hero';
import { LaptopShowcase } from './LaptopShowcase';
import { LiveStatsSection } from './LiveStatsSection';
import { WidgetShowcaseSection } from './WidgetShowcaseSection';
import { PlatformsMarquee } from './PlatformsMarquee';
import { TestimonialsSection } from './TestimonialsSection';
import { FeatureHighlightsSection } from './FeatureHighlightsSection';
import { ComparisonSection } from './ComparisonSection';
import { FinalCTASection } from './FinalCTASection';
import { Footer } from '@/components/layout/Footer';
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
      <LiveStatsSection />
      <WidgetShowcaseSection />
      <PlatformsMarquee />
      <TestimonialsSection />
      <FeatureHighlightsSection />
      <ComparisonSection />
      <FinalCTASection onConnectClick={onConnectClick} />
      <Footer />

      <HowItWorksModal
        open={howItWorksOpen}
        onClose={() => setHowItWorksOpen(false)}
        onConnectClick={onConnectClick}
      />
    </div>
  );
}
