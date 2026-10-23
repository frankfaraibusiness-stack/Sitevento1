// components/marketing/MarketingPage.tsx
//
// Full marketing page: hero, the connected-site demo, and the "why
// connect" flip-card section, followed by the previously-built
// sections (logo marquee, capabilities, stats, feature orbit,
// testimonials, FAQ, how-it-works, pricing) reinstated here, plus one
// new section (DashboardPreview) added alongside them. Footer is
// unaffected — it's mounted separately in AppRoot, outside this
// component.
import { Hero, ConnectedSiteShowcase } from './Hero';
import { ControlMoments } from './ControlMoments';
import { StatusStrip, TopCapabilities, DetailCapabilities, Stats } from './CapabilitiesAndStats';
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
  return (
    <div id="marketingView">
      <Hero onConnectClick={onConnectClick} />
      <ConnectedSiteShowcase />
      <ControlMoments />
      <StatusStrip />
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
    </div>
  );
}
