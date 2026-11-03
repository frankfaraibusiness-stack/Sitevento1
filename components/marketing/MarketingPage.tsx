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
//   5. ToolsShowcaseSection — 6-tile grid promoting the real
//      dashboard tools (visit analytics, session data, visitor
//      history, traffic sources, auto-restrict, auto-block).
//   6. SecurityRadarSection — bigger danger-tinted radar dial, ticks
//      up "threats restricted" / "bots & spam blocked" counters,
//      promoting the Security Bot (lib/botShield.ts) engine.
//   7. Footer (components/layout/Footer.tsx) — global footer with
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
import { ToolsShowcaseSection } from './ToolsShowcaseSection';
import { SecurityRadarSection } from './SecurityRadarSection';
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
      <ToolsShowcaseSection />
      <SecurityRadarSection />
      <Footer />

      <HowItWorksModal
        open={howItWorksOpen}
        onClose={() => setHowItWorksOpen(false)}
        onConnectClick={onConnectClick}
      />
    </div>
  );
}
