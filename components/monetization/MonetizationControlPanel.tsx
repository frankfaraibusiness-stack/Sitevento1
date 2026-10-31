'use client';

// components/monetization/MonetizationControlPanel.tsx
//
// Sits at the top of MonetizationDashboard — the demonetize control.
// Monetization itself is already ON by the time this renders (that's
// what gates MonetizationDashboard vs. MonetizationUpsellOverlay in
// MonetizationPageClient.tsx), so this panel's whole job is letting
// the owner turn it back OFF, with an explicit confirm step first —
// mirrors the "Turn it off anytime — it's your site and your call,
// every time" promise already made on MonetizationUpsellOverlay.
//
// Same `.mon-switch` pill used by MonetizationAdTypeGrid.tsx's format
// toggles, just a single row rather than a list. Unlike those toggles
// (which write immediately on click), THIS switch never writes on its
// own click — clicking it while on only opens an inline confirm panel
// (no write yet); only the confirm panel's own "Turn off" button
// calls setEnabled(false). Re-enabling (switch is off -> click to
// turn on) has no ads-will-stop consequence to warn about, so that
// direction writes immediately, same posture as every other
// immediate-write toggle in this feature.
//
// `enabled`, `busy`, and `setEnabled` are passed in from
// MonetizationDashboard's own useSiteMonetization call rather than
// this component calling the hook a second time — a second instance
// would open a second onSnapshot listener on the same config doc and
// track its own independent `busy`, which could show this switch as
// idle while MonetizationAdTypeGrid (reading the first instance) is
// mid-write, or vice versa. One hook instance, shared down as props.
import { useState } from 'react';

interface MonetizationControlPanelProps {
  enabled: boolean;
  busy: boolean;
  setEnabled: (next: boolean) => Promise<{ ok: boolean; reason?: string }>;
}

export function MonetizationControlPanel({ enabled, busy, setEnabled }: MonetizationControlPanelProps) {
  const [confirming, setConfirming] = useState(false);
  const [error, setError] = useState<string | null>(null);

  function handleSwitchClick() {
    setError(null);
    if (enabled) {
      // Turning off — never fires on the switch click itself, just
      // opens the confirm step below.
      setConfirming(true);
    } else {
      // Turning back on has nothing to confirm — same immediate-write
      // behavior MonetizationPageClient's own onEnable already uses.
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

  return (
    <section className="mon-section">
      <div className="mon-control-row">
        <span className="mon-toggle-stack">
          <span className="mon-toggle-label">Monetization is {enabled ? 'on' : 'off'}</span>
          <span className="mon-toggle-desc">
            {enabled
              ? 'Ads are showing on your site and earning you revenue.'
              : 'Turned off — your site is not showing ads right now.'}
          </span>
        </span>
        <button
          type="button"
          role="switch"
          aria-checked={enabled}
          aria-label="Turn monetization on or off"
          className={`mon-switch${enabled ? ' is-on' : ''}`}
          disabled={busy}
          onClick={handleSwitchClick}
        >
          <span className="mon-switch-knob" />
        </button>
      </div>

      {confirming && (
        <div className="mon-confirm-panel" role="alertdialog" aria-label="Confirm turning off monetization">
          <p className="mon-confirm-text">
            Turning off monetization means ads will no longer show on your site, and you&rsquo;ll stop earning
            from this traffic. You can turn it back on anytime.
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
