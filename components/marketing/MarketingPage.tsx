// components/marketing/MarketingPage.tsx
//
// Full marketing page: hero, the connected-site demo, and the "why
// connect" flip-card section, followed by the previously-built
// sections (logo marquee, capabilities, stats, feature orbit,
// testimonials, FAQ, how-it-works, pricing) reinstated here, plus one
// new section (DashboardPreview) added alongside them. Footer is
// unaffected — it's mounted separately in AppRoot, outside this
// component.
//
// Owns the open/closed state for HowItWorksModal — the full-screen
// explainer Hero's "See how it works" button opens (replacing the old
// scroll-to-#how-it-works behavior; that strip, rendered by
// <HowItWorks /> below, stays as a short teaser further down the
// page).
'use client';

import { useState } from 'react';
import { Hero, ConnectedSiteShowcase } from './Hero';
import { HowItWorksModal } from './HowItWorksModal';
import { ControlMoments } from './ControlMoments';
import { LiveTracking } from './LiveTracking';
import { TopCapabilities, DetailCapabilities, Stats } from './CapabilitiesAndStats';
import { HowItWorks } from './HowItWorks';
import { DashboardPreview } from './DashboardPreview';
import { FeatureOrbit } from './FeatureOrbit';
import { TestimonialsMarquee } from './Testimonials';
import { LogoMarquee } from './LogoMarquee';
import { Pricing } from './Pricing';
import { Faq } from './Faq';

interface MarketingPageProps {
  onConnectClick: () => void;
}

export function MarketingPage({ onConnectClick }: MarketingPageProps) {
  const [howItWorksOpen, setHowItWorksOpen] = useState(false);

  return (
    <div id="marketingView">
      <Hero onConnectClick={onConnectClick} onHowItWorksClick={() => setHowItWorksOpen(true)} />
      <ConnectedSiteShowcase />
      <ControlMoments />
      <LiveTracking />
      <TopCapabilities />
      <HowItWorks />
      <DashboardPreview />
      <FeatureOrbit />
      <DetailCapabilities />
      <Stats />
      <TestimonialsMarquee />
      <LogoMarquee />
      <Pricing onConnectClick={onConnectClick} />
      <Faq />

      <HowItWorksModal
        open={howItWorksOpen}
        onClose={() => setHowItWorksOpen(false)}
        onConnectClick={onConnectClick}
      />
    </div>
  );
}
