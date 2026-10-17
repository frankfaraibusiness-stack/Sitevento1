'use client';

// components/marketing/Pricing.tsx — replaces .pricing. All three plan
// buttons call handleConnectCTA() in the original, so they all share the
// same onConnectClick prop here too.
interface PricingProps {
  onConnectClick: () => void;
}

const PLANS = [
  {
    name: 'Starter',
    price: '$0',
    desc: 'For one site, getting started.',
    features: ['1 connected site', '7-day visit history', '1 email capture widget'],
    cta: 'Start free',
    featured: false,
  },
  {
    name: 'Growth',
    price: '$29',
    desc: 'For teams running more than one site.',
    features: ['Up to 5 connected sites', 'Unlimited visit history', 'Unlimited widgets & overlays', 'Live overlay push'],
    cta: 'Connect your site',
    featured: true,
  },
  {
    name: 'Scale',
    price: '$99',
    desc: 'For agencies managing client sites.',
    features: ['Unlimited connected sites', 'Team seats & permissions', 'Priority support'],
    cta: 'Connect your site',
    featured: false,
  },
];

export function Pricing({ onConnectClick }: PricingProps) {
  return (
    <>
      <section className="section-heading">
        <h2>Simple pricing</h2>
        <p>Start free. Upgrade when you&apos;ve got more than one site to watch.</p>
      </section>
      <section className="pricing">
        {PLANS.map((plan) => (
          <div className={`price-card${plan.featured ? ' featured' : ''}`} key={plan.name}>
            <p className="plan-name">{plan.name}</p>
            <p className="plan-price">
              {plan.price}
              <span>/mo</span>
            </p>
            <p className="plan-desc">{plan.desc}</p>
            <ul>
              {plan.features.map((f) => (
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
