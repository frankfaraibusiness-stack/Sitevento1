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
// Owns the open/closed state for HowItWorksModal, the full-screen
// explainer. Hero no longer has a "See how it works" button (its
// headline/CTAs were removed entirely — Hero now only renders the
// animated mascot), so nothing currently opens this modal; left wired
// up rather than torn out in case a new trigger for it (e.g. on
// <HowItWorks /> below, the short teaser strip further down the page)
// gets added later.
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
      <Hero />
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
