// components/marketing/MarketingPage.tsx
//
// Temporarily stripped down to just the new hero per the current
// redesign — every other marketing section (logo marquee, capabilities,
// stats, feature orbit, testimonials, FAQ, how-it-works, pricing) is
// removed for now and will be reintroduced deliberately later, except
// for ControlMoments (new "why connect" section), added deliberately
// below the connected-site demo. Footer is unaffected — it's mounted
// separately in AppRoot, outside this component.
import { Hero, ConnectedSiteShowcase } from './Hero';
import { ControlMoments } from './ControlMoments';

interface MarketingPageProps {
  onConnectClick: () => void;
}

export function MarketingPage({ onConnectClick }: MarketingPageProps) {
  return (
    <div id="marketingView">
      <Hero onConnectClick={onConnectClick} />
      <ConnectedSiteShowcase />
      <ControlMoments />
    </div>
  );
}
