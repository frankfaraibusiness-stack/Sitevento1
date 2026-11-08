// components/marketing/FinalCTASection.tsx
//
// New marketing section: the closing conversion band, right before
// the Footer. Reuses the same onConnectClick handler every other CTA
// on this page already wires up (Hero, HowItWorksModal) so "Connect
// your site" behaves identically everywhere. A bold lime panel (not
// another plain light card) gives the page a clear closing beat and
// visually separates "we're done pitching, here's the ask" from the
// feature/testimonial/comparison sections above it — but, like every
// other new section in this batch, all copy stays dark ink on a
// light surface (never light text on a dark panel), matching the
// light --app-bg page background throughout.
'use client';

interface FinalCTASectionProps {
  onConnectClick: () => void;
}

export function FinalCTASection({ onConnectClick }: FinalCTASectionProps) {
  return (
    <section className="fcx" aria-label="Get started with sitevento">
      <div className="fcx-inner">
        <div className="fcx-glow" aria-hidden="true" />
        <span className="fcx-eyebrow">Ready when you are</span>
        <h2 className="fcx-title">Paste one script. See everything.</h2>
        <p className="fcx-copy">
          No redeploy, no migration, no credit card to try it. Connect your site and watch the dashboard fill in
          within minutes.
        </p>
        <div className="fcx-actions">
          <button type="button" className="fcx-btn-primary" onClick={onConnectClick}>
            Connect your site
            <svg viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth={2.4} strokeLinecap="round" strokeLinejoin="round">
              <path d="M5 12h14M13 6l6 6-6 6" />
            </svg>
          </button>
          <span className="fcx-note">Free to start · Works with any site</span>
        </div>

        <div className="fcx-trust-row">
          <span className="fcx-trust-item">
            <svg viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth={2} strokeLinecap="round" strokeLinejoin="round">
              <path d="M12 3 4 6v6c0 4.5 3.2 7.6 8 9 4.8-1.4 8-4.5 8-9V6l-8-3Z" />
              <path d="m9.5 12 2 2 3.5-4" />
            </svg>
            No code changes
          </span>
          <span className="fcx-trust-item">
            <svg viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth={2} strokeLinecap="round" strokeLinejoin="round">
              <circle cx="12" cy="12" r="9" />
              <path d="M12 7v5l3.5 2" />
            </svg>
            Live in minutes
          </span>
          <span className="fcx-trust-item">
            <svg viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth={2} strokeLinecap="round" strokeLinejoin="round">
              <path d="M18 8a6 6 0 1 0-12 0c0 7-3 9-3 9h18s-3-2-3-9Z" />
              <path d="M13.7 21a2 2 0 0 1-3.4 0" />
            </svg>
            Cancel anytime
          </span>
        </div>
      </div>
    </section>
  );
}
