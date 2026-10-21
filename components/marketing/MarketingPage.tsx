// components/marketing/MarketingPage.tsx
//
// Temporarily stripped down to just the new hero per the current
// redesign — every other marketing section (logo marquee, capabilities,
// stats, feature orbit, testimonials, FAQ, how-it-works, pricing) is
// removed for now and will be reintroduced deliberately later. Footer
// is unaffected — it's mounted separately in AppRoot, outside this
// component.
import { Hero } from './Hero';

interface MarketingPageProps {
  onConnectClick: () => void;
}

export function MarketingPage({ onConnectClick }: MarketingPageProps) {
  return (
    <div id="marketingView">
      <Hero onConnectClick={onConnectClick} />
    </div>
  );
}
