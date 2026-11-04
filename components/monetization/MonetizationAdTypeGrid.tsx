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
// Now persisted: `adFormats` and `onChange` come from
// hooks/useSiteMonetization.ts (via MonetizationDashboard.tsx), which
// writes through POST /api/site-monetization — this component no
// longer owns any local toggle state. A format missing from the
// persisted map (every site until this grid is first saved) defaults
// its displayed state to that format's own AdTypeDef.defaultEnabled,
// not to off — "never configured" and "explicitly turned off" are
// different states, matching the fallback app/api/ad-serve/route.ts
// already applies when reading this same field.
import { AD_TYPES } from '@/lib/monetization';
import type { AdFormatId } from '@/lib/adPool';

interface MonetizationAdTypeGridProps {
  adFormats: Partial<Record<AdFormatId, boolean>> | undefined;
  onChange: (next: Partial<Record<AdFormatId, boolean>>) => void;
}

export function MonetizationAdTypeGrid({ adFormats, onChange }: MonetizationAdTypeGridProps) {
  function isOn(id: string): boolean {
    const persisted = adFormats?.[id as AdFormatId];
    if (typeof persisted === 'boolean') return persisted;
    return AD_TYPES.find((t) => t.id === id)?.defaultEnabled ?? false;
  }

  function toggle(id: string) {
    // Always sends the FULL resolved map (every format's current
    // effective on/off, defaults included), not just the one flipped
    // key — see useSiteMonetization.setAdFormats's header comment on
    // why this is a whole-map write, not a per-key patch.
    const next: Partial<Record<AdFormatId, boolean>> = Object.fromEntries(
      AD_TYPES.map((t) => [t.id, t.id === id ? !isOn(t.id) : isOn(t.id)])
    );
    onChange(next);
  }

  const onCount = AD_TYPES.filter((t) => isOn(t.id)).length;

  return (
    <section className="mon-section">
      <div className="mon-section-head">
        <h2 className="mon-section-title">Ad formats</h2>
        <span className="mon-section-count">
          {onCount}/{AD_TYPES.length} enabled
        </span>
      </div>
      <p className="mon-section-note">
        Choose which ad formats can show on your site. These control which formats /api/ad-serve is eligible to pick for a visit.
      </p>
      <div className="mon-toggle-group">
        {AD_TYPES.map((type) => {
          const on = isOn(type.id);
          return (
            <div key={type.id} className="mon-toggle-row">
              <span className="mon-toggle-stack">
                <span className="mon-toggle-label">{type.label}</span>
                <span className="mon-toggle-desc">{type.description}</span>
              </span>
              <button
                type="button"
                role="switch"
                aria-checked={on}
                aria-label={`Enable ${type.label}`}
                className={`mon-switch${on ? ' is-on' : ''}`}
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
