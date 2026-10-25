'use client';

// components/monetization/MonetizationAdTypeGrid.tsx
//
// Lets the site owner choose which ad FORMATS are eligible to serve
// on their site — Banner, Sticky footer, Interstitial, Popup,
// Full-screen overlay (lib/monetization.ts's AD_TYPES). Interaction
// pattern is lifted directly from AgentFeatureGrid.tsx: a row per
// item (label + one-line description) with a pill switch on the
// right, same `.agt-switch`-shaped markup/semantics just renamed to
// `mon-switch` so this route's CSS stays self-contained.
//
// There's no ad pool or persistence layer yet, so state here is local
// only (useState, seeded from AdTypeDef.defaultEnabled) — no
// Firestore write, no hook. Kept to the exact same `Record<string,
// boolean>` shape useSiteMonetization will eventually want so lifting
// this into real persistence later is a rename, not a rewrite.
import { useState } from 'react';
import { AD_TYPES } from '@/lib/monetization';

export function MonetizationAdTypeGrid() {
  const [enabled, setEnabled] = useState<Record<string, boolean>>(() =>
    Object.fromEntries(AD_TYPES.map((t) => [t.id, t.defaultEnabled]))
  );

  function toggle(id: string) {
    setEnabled((prev) => ({ ...prev, [id]: !prev[id] }));
  }

  const onCount = Object.values(enabled).filter(Boolean).length;

  return (
    <section className="mon-section">
      <div className="mon-section-head">
        <h2 className="mon-section-title">Ad formats</h2>
        <span className="mon-section-count">
          {onCount}/{AD_TYPES.length} enabled
        </span>
      </div>
      <p className="mon-section-note">
        Choose which ad formats can show on your site. These control the ad pool once it goes live — nothing is served yet.
      </p>
      <div className="mon-toggle-group">
        {AD_TYPES.map((type) => {
          const isOn = !!enabled[type.id];
          return (
            <div key={type.id} className="mon-toggle-row">
              <span className="mon-toggle-stack">
                <span className="mon-toggle-label">{type.label}</span>
                <span className="mon-toggle-desc">{type.description}</span>
              </span>
              <button
                type="button"
                role="switch"
                aria-checked={isOn}
                aria-label={`Enable ${type.label}`}
                className={`mon-switch${isOn ? ' is-on' : ''}`}
                onClick={() => toggle(type.id)}
              >
                <span className="mon-switch-knob" />
              </button>
            </div>
          );
        })}
      </div>
    </section>
  );
}
