'use client';

// components/monetization/MonetizationControlPanel.tsx
//
// The on/off control for monetization — now a single inline card at
// the top of the dashboard instead of a full-screen, non-dismissable
// dark overlay. Three states:
//   1. Site not verified yet — switch is disabled, card explains why
//      and links to verification instead of flipping anything.
//   2. Off — "No ads are running on <site> right now", switch off,
//      one line about what turning it on does.
//   3. On — "Ads are live", switch on, same demonetize confirm step
//      as before (never flips off without an explicit second click).
// Turning ON is still a single, immediate write (nothing to confirm —
// matches the old overlay's "instantly approved" promise); turning
// OFF still opens the inline confirm panel first.
import { useState } from 'react';

interface MonetizationControlPanelProps {
  enabled: boolean;
  busy: boolean;
  siteVerified: boolean;
  setEnabled: (next: boolean) => Promise<{ ok: boolean; reason?: string }>;
  onGoVerify: () => void;
}

export function MonetizationControlPanel({
  enabled,
  busy,
  siteVerified,
  setEnabled,
  onGoVerify,
}: MonetizationControlPanelProps) {
  const [confirming, setConfirming] = useState(false);
  const [error, setError] = useState<string | null>(null);

  function handleSwitchClick() {
    if (!siteVerified) return;
    setError(null);
    if (enabled) {
      setConfirming(true);
    } else {
      setEnabled(true);
    }
  }

  async function confirmDisable() {
    const result = await setEnabled(false);
    if (result.ok) {
      setConfirming(false);
    } else {
      setError('Something went wrong turning off monetization. Please try again.');
    }
  }

  const statusTone = !siteVerified ? 'pending' : enabled ? 'on' : 'off';

  return (
    <section className={`mon-control-card mon-control-${statusTone}`}>
      <div className="mon-control-row">
        <div className="mon-control-status">
          <span className="mon-status-dot" aria-hidden="true" />
          <span className="mon-toggle-stack">
            <span className="mon-toggle-label">
              {!siteVerified ? 'Verify your site to start' : enabled ? 'Ads are live' : 'No ads are running'}
            </span>
            <span className="mon-toggle-desc">
              {!siteVerified
                ? 'Monetization turns on the moment your site is verified — no review, no waiting.'
                : enabled
                ? 'Your site is showing ads and earning from this traffic right now.'
                : 'Flip the switch to start earning from the traffic your site already gets.'}
            </span>
          </span>
        </div>

        {siteVerified ? (
          <button
            type="button"
            role="switch"
            aria-checked={enabled}
            aria-label="Turn monetization on or off"
            className={`mon-switch mon-switch-lg${enabled ? ' is-on' : ''}`}
            disabled={busy}
            onClick={handleSwitchClick}
          >
            <span className="mon-switch-knob" />
          </button>
        ) : (
          <button type="button" className="mon-verify-cta" onClick={onGoVerify}>
            Verify site
            <span aria-hidden="true">→</span>
          </button>
        )}
      </div>

      {confirming && (
        <div className="mon-confirm-panel" role="alertdialog" aria-label="Confirm turning off monetization">
          <p className="mon-confirm-text">
            Turning off monetization stops ads from showing on your site, and you&rsquo;ll stop earning from this
            traffic. You can turn it back on anytime.
          </p>
          {error && <p className="mon-form-error">{error}</p>}
          <div className="mon-confirm-actions">
            <button type="button" className="ghost-btn" disabled={busy} onClick={() => setConfirming(false)}>
              Cancel
            </button>
            <button type="button" className="ghost-btn danger" disabled={busy} onClick={confirmDisable}>
              {busy ? 'Turning off…' : 'Turn off monetization'}
            </button>
          </div>
        </div>
      )}
    </section>
  );
}
