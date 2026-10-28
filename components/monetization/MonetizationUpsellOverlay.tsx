'use client';

// components/monetization/MonetizationUpsellOverlay.tsx
//
// Full-screen gate shown over the Monetization page shell
// (MonetizationPageClient.tsx) whenever the feature is OFF for the
// active site. Every user sees this first unless they've already
// monetized — there's no in-between "preview the dashboard first"
// state, and critically it is NOT closeable: no backdrop dismiss, no
// Escape key, no X button. The only way out is the single "Return to
// dashboard" link (which leaves the feature off and takes the person
// back to /dashboard) or actually turning monetization on. Once
// enabled, MonetizationPageClient stops rendering this at all — it
// only exists for the "off" state, full stop.
//
// Visually: own full-bleed layout, not a reuse of
// styles/overlays/upsell-overlay.css (that file's panel is a
// plan-limit upsell with a dismiss X and a billing form — a different
// job). This borrows the same "dark showcase, floating accent blobs"
// language because it reads as the same product, but every class name
// here is new (mon-upsell-*, see monetization-page.css) and the
// layout is full-bleed on both mobile and desktop rather than a
// split-panel modal.
import { useEffect } from 'react';
import { TIER1_AVG_CPM_USD } from '@/lib/monetization';

function MoneySvg({ className }: { className?: string }) {
  return (
    <svg className={className} viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth={1.6} aria-hidden="true">
      <circle cx="12" cy="12" r="9.2" />
      <path d="M12 6.5v11M15.3 9.2c0-1.6-1.5-2.9-3.3-2.9s-3.3 1.2-3.3 2.7c0 3.4 6.6 1.6 6.6 5 0 1.5-1.5 2.7-3.3 2.7s-3.3-1.3-3.3-2.9" />
    </svg>
  );
}

function CheckSvg() {
  return (
    <svg viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth={2.4} strokeLinecap="round" strokeLinejoin="round" aria-hidden="true">
      <path d="M5 13l4 4L19 7" />
    </svg>
  );
}

const BENEFITS = [
  'Turn traffic you already have into recurring revenue — no extra work, no new content to make.',
  'Instantly approved the moment your site is verified — no application, no waiting on a review team.',
  'Placements are tuned automatically to stay out of the way of your design and your visitors\u2019 experience.',
  'Turn it off anytime — it\u2019s your site and your call, every time.',
];

interface MonetizationUpsellOverlayProps {
  siteVerified: boolean;
  busy: boolean;
  onEnable: () => void;
  onVerify: () => void;
  onReturnToDashboard: () => void;
}

export function MonetizationUpsellOverlay({
  siteVerified,
  busy,
  onEnable,
  onVerify,
  onReturnToDashboard,
}: MonetizationUpsellOverlayProps) {
  // Not closeable: deliberately no Escape handler, no backdrop click
  // handler, no close button anywhere in this component. The only
  // thing this effect does is lock page scroll behind the overlay,
  // same courtesy every other full-screen overlay in the app gives —
  // it is not a dismiss mechanism.
  useEffect(() => {
    const prevOverflow = document.body.style.overflow;
    document.body.style.overflow = 'hidden';
    return () => {
      document.body.style.overflow = prevOverflow;
    };
  }, []);

  return (
    <div className="mon-upsell" role="dialog" aria-modal="true" aria-label="Turn on monetization">
      <div className="mon-upsell-blob mon-upsell-blob-a" aria-hidden="true" />
      <div className="mon-upsell-blob mon-upsell-blob-b" aria-hidden="true" />

      <div className="mon-upsell-inner">
        <div className="mon-upsell-icon-wrap">
          <span className="mon-upsell-icon-ring" aria-hidden="true" />
          <MoneySvg className="mon-upsell-icon" />
        </div>

        <p className="mon-upsell-eyebrow">Monetization · off</p>
        <h1 className="mon-upsell-title">Start making money with your site</h1>
        <p className="mon-upsell-sub">
          Turn on monetization and your site starts earning from the traffic it already gets — automatically,
          with no extra work on your end.
        </p>

        <div className="mon-upsell-cpm-card">
          <span className="mon-upsell-cpm-num">${TIER1_AVG_CPM_USD}</span>
          <span className="mon-upsell-cpm-label">
            average CPM
            <span className="mon-upsell-cpm-sub">for tier-1 countries</span>
          </span>
        </div>

        <ul className="mon-upsell-benefits">
          {BENEFITS.map((b) => (
            <li key={b}>
              <span className="mon-upsell-check" aria-hidden="true">
                <CheckSvg />
              </span>
              <span>{b}</span>
            </li>
          ))}
        </ul>

        {siteVerified ? (
          <>
            <button type="button" className="mon-upsell-cta" onClick={onEnable} disabled={busy}>
              {busy ? 'Turning on…' : 'Start making money'}
              <span className="mon-upsell-cta-arrow" aria-hidden="true">→</span>
            </button>
            <p className="mon-upsell-fineprint">
              Instantly approved — your site is verified, so monetization goes live the moment you turn it on.
            </p>
          </>
        ) : (
          <>
            <button type="button" className="mon-upsell-cta" onClick={onVerify}>
              Verify your site to get started
              <span className="mon-upsell-cta-arrow" aria-hidden="true">→</span>
            </button>
            <p className="mon-upsell-fineprint">
              Monetization is instantly approved once your site is verified — that&rsquo;s the only step left.
            </p>
          </>
        )}

        <button type="button" className="mon-upsell-return" onClick={onReturnToDashboard}>
          Return to dashboard
        </button>
      </div>
    </div>
  );
}
