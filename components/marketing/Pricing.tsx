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
    <div className="pricing-wrap">
      <svg className="pricing-blob-peek" viewBox="0 0 120 120" aria-hidden="true">
        <path
          d="M22,6 C45,-4 86,0 104,22 C119,41 116,70 98,90 C80,110 44,118 22,100 C2,84 -2,60 4,40 C8,27 12,14 22,6 Z"
          fill="var(--ink)"
        />
        <circle cx="46" cy="52" r="6" fill="var(--lime)" />
        <circle cx="72" cy="52" r="6" fill="var(--lime)" />
        <path d="M46 68 Q 59 78 72 68" stroke="var(--lime)" strokeWidth="3.5" strokeLinecap="round" fill="none" />
      </svg>
      <section className="section-heading">
        <h2>Simple pricing</h2>
        <p>
          Start free. Upgrade when you&apos;ve got more sites — or more to control — to watch.{' '}
          <a href="/pricing">See full plan details &amp; limits →</a>
        </p>
      </section>
      <section className="pricing">
        {PLANS.map((plan, i) => (
          <div
            className={`price-card${plan.featured ? ' featured' : ''}`}
            key={plan.id}
            style={{ animationDelay: `${i * 70}ms` }}
          >
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
    </div>
  );
}
