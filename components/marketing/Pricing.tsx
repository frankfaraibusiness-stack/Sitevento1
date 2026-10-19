'use client';

// components/marketing/Pricing.tsx — replaces .pricing. All plan
// buttons call handleConnectCTA() in the original, so they all share
// the same onConnectClick prop here too. Plan data now comes from
// lib/plans.ts so this, the /pricing page, and (eventually) real
// billing enforcement can't drift out of sync with each other.
import { PLANS } from '@/lib/plans';

interface PricingProps {
  onConnectClick: () => void;
}

export function Pricing({ onConnectClick }: PricingProps) {
  return (
    <>
      <section className="section-heading">
        <h2>Simple pricing</h2>
        <p>
          Start free. Upgrade when you&apos;ve got more sites — or more to control — to watch.{' '}
          <a href="/pricing">See full plan details &amp; limits →</a>
        </p>
      </section>
      <section className="pricing">
        {PLANS.map((plan) => (
          <div className={`price-card${plan.featured ? ' featured' : ''}`} key={plan.id}>
            <p className="plan-name">{plan.name}</p>
            <p className="plan-price">
              {plan.priceDisplay}
              <span>/mo</span>
            </p>
            <p className="plan-desc">{plan.tagline}</p>
            <ul>
              {plan.cardHighlights.map((f) => (
                <li key={f}>{f}</li>
              ))}
            </ul>
            <button className="plan-btn" onClick={onConnectClick}>
              {plan.cta}
            </button>
          </div>
        ))}
      </section>
    </>
  );
}
