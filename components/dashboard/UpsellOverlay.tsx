'use client';

// components/dashboard/UpsellOverlay.tsx
//
// Full-screen "you've hit your plan's site limit" overlay. Shown
// instead of ConnectSiteWizard whenever /api/site-limits (checked
// before opening the wizard) or /api/connect-site (checked again at
// actual creation time, as a race-condition safety net) reports
// atLimit/SITE_LIMIT_REACHED.
//
// Visually this reuses AuthOverlay's exact showcase-panel language
// (dark --ink background, floating lime/walnut radial-gradient blobs,
// pulsing lime dot, logo) so it feels like the same product rather
// than a bolted-on paywall — see styles/overlays/upsell-overlay.css, which
// mirrors styles/auth/auth-overlay.css's .showcase rules closely on
// purpose.
import { useEffect } from 'react';
import { getPlan, PLANS, type PlanId } from '@/lib/plans';

interface UpsellOverlayProps {
  open: boolean;
  planId: PlanId;
  limit: number;
  used: number;
  onClose: () => void;
  onUpgrade: () => void;
}

export function UpsellOverlay({ open, planId, limit, used, onClose, onUpgrade }: UpsellOverlayProps) {
  useEffect(() => {
    if (open) {
      document.body.style.overflow = 'hidden';
    } else {
      document.body.style.overflow = '';
    }
    return () => {
      document.body.style.overflow = '';
    };
  }, [open]);

  useEffect(() => {
    function handleEscape(e: KeyboardEvent) {
      if (e.key === 'Escape' && open) onClose();
    }
    document.addEventListener('keydown', handleEscape);
    return () => document.removeEventListener('keydown', handleEscape);
  }, [open, onClose]);

  if (!open) return null;

  const currentPlan = getPlan(planId);
  // The next tier up that actually raises the connected-sites cap —
  // normally the very next plan, but this walks forward in case a
  // future catalog ever has two tiers with the same site cap in a row.
  const nextPlan = PLANS.find((p) => p.limits.connectedSites > currentPlan.limits.connectedSites);

  return (
    <div className="upsell-overlay open" aria-hidden={!open} role="dialog" aria-modal="true" aria-label="Upgrade your plan">
      <button className="upsell-exit" aria-label="Close" onClick={onClose}>
        <svg viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth={2}>
          <path d="M18 6L6 18M6 6l12 12" />
        </svg>
      </button>

      <div className="upsell-stage">
        <div className="upsell-showcase">
          <div className="upsell-showcase-brand">
            <img
              className="upsell-brand-logo"
              src="https://cdn.phototourl.com/member/2026-10-16-c4f6fc3d-2a68-40c8-9241-fa770df8a99f.png"
              alt="sitevento"
            />
          </div>

          <div className="upsell-showcase-copy">
            <h1>You&apos;ve connected every site your plan allows.</h1>
            <p>
              Upgrade to keep growing your portfolio — more connected sites, more widgets, and more control, all on the
              same one-script-tag setup.
            </p>
          </div>

          <div className="upsell-showcase-card">
            <span className="upsell-live-dot" />
            <span className="upsell-ctext">
              {used} of {limit} sites used on {currentPlan.name}
            </span>
          </div>

          {nextPlan && (
            <div className="upsell-showcase-stats">
              <div>
                <span className="upsell-s-num">{nextPlan.limits.connectedSites}</span>
                <span className="upsell-s-label">Sites on {nextPlan.name}</span>
              </div>
              <div>
                <span className="upsell-s-num">{nextPlan.limits.widgetsPerSite}</span>
                <span className="upsell-s-label">Widgets per site</span>
              </div>
              <div>
                <span className="upsell-s-num">{nextPlan.limits.teamSeats}</span>
                <span className="upsell-s-label">Team seats</span>
              </div>
            </div>
          )}
        </div>

        <div className="upsell-form-wrap">
          <div className="upsell-form-panel">
            <div className="upsell-mobile-brand">
              <img
                className="upsell-brand-logo"
                src="https://cdn.phototourl.com/member/2026-10-16-c4f6fc3d-2a68-40c8-9241-fa770df8a99f.png"
                alt="sitevento"
              />
            </div>

            <div className="upsell-limit-pill">Site limit reached</div>

            <div className="upsell-form-header">
              <h2>
                {used}/{limit} sites connected
              </h2>
              <p>
                Your {currentPlan.name} plan tops out at {limit} connected site{limit === 1 ? '' : 's'}. Disconnect one, or
                upgrade to connect more.
              </p>
            </div>

            {nextPlan ? (
              <div className="upsell-plan-card">
                <div className="upsell-plan-card-row">
                  <div>
                    <span className="upsell-plan-name">{nextPlan.name}</span>
                    <span className="upsell-plan-tagline">{nextPlan.tagline}</span>
                  </div>
                  <div className="upsell-plan-price">
                    <span className="upsell-price-num">{nextPlan.priceDisplay}</span>
                    <span className="upsell-price-period">/mo</span>
                  </div>
                </div>
                <ul className="upsell-plan-highlights">
                  {nextPlan.cardHighlights.map((h) => (
                    <li key={h}>
                      <svg viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth={2.5}>
                        <path d="M20 6L9 17l-5-5" />
                      </svg>
                      {h}
                    </li>
                  ))}
                </ul>
              </div>
            ) : (
              <div className="upsell-plan-card">
                <div className="upsell-plan-card-row">
                  <div>
                    <span className="upsell-plan-name">{currentPlan.name}</span>
                    <span className="upsell-plan-tagline">You&apos;re on our top tier.</span>
                  </div>
                </div>
                <p style={{ margin: 0, fontSize: 14, color: '#6b665e' }}>
                  Disconnect a site to free up a slot, or get in touch about a custom plan.
                </p>
              </div>
            )}

            <button className="upsell-submit-btn" onClick={onUpgrade}>
              {nextPlan ? `Upgrade to ${nextPlan.name}` : 'View plans'}
            </button>
            <button className="upsell-secondary-btn" onClick={onClose}>
              Not now
            </button>

            <p className="upsell-terms-note">
              Changed your mind? You can disconnect a site from your{' '}
              <a href="/dashboard/profile">account page</a> to free up a slot instead.
            </p>
          </div>
        </div>
      </div>
    </div>
  );
}
