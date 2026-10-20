// components/marketing/MarketingPage.tsx — replaces #marketingView.
// Pure assembly of the sections above, in the exact order they appear
// in the original markup.
import { Hero } from './Hero';
import { LogoMarquee } from './LogoMarquee';
import { StatusStrip, TopCapabilities, DetailCapabilities, Stats } from './CapabilitiesAndStats';
import { FeatureOrbit } from './FeatureOrbit';
import { TestimonialsMarquee, TestimonialsGrid } from './Testimonials';
import { Faq } from './Faq';
import { HowItWorks } from './HowItWorks';
import { Pricing } from './Pricing';

interface MarketingPageProps {
  onConnectClick: () => void;
}

export function MarketingPage({ onConnectClick }: MarketingPageProps) {
  return (
    <div id="marketingView">
      <Hero onConnectClick={onConnectClick} />
      <LogoMarquee />
      <StatusStrip />
      <TopCapabilities />
      <DetailCapabilities />
      <Stats />
      <FeatureOrbit />
      <TestimonialsMarquee />
      <Faq />
      <TestimonialsGrid />
      <HowItWorks />
      <Pricing onConnectClick={onConnectClick} />
    </div>
  );
}
