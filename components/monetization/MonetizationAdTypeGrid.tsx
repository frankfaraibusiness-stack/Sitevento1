'use client';

// components/monetization/MonetizationAdTypeGrid.tsx
//
// Lets the site owner choose which ad FORMATS are eligible to serve
// on their site (lib/monetization.ts's AD_TYPES). Previously a single
// flat list of rows; now grouped into two clearly labeled tiers —
// "Low friction" (banner, sticky footer: steady, unobtrusive) and
// "Higher impact" (interstitial, popup, full-screen overlay: better
// CPM, more visible to visitors) — as two cards instead of one long
// scroll, so the tradeoff each format makes is legible at a glance
// instead of five identical rows in a row.
//
// Persists through hooks/useSiteMonetization.ts (via
// MonetizationDashboard.tsx) exactly as before — this component still
// owns no local toggle state, still writes the FULL resolved map on
// every change.
import { AD_TYPES, type AdTypeDef } from '@/lib/monetization';
import type { AdFormatId } from '@/lib/adPool';

interface MonetizationAdTypeGridProps {
  adFormats: Partial<Record<AdFormatId, boolean>> | undefined;
  onChange: (next: Partial<Record<AdFormatId, boolean>>) => void;
}

const LOW_FRICTION_IDS = new Set(['banner', 'sticky-footer']);

function AdTypeIcon({ id }: { id: string }) {
  switch (id) {
    case 'banner':
      return (
        <svg viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth={2} strokeLinecap="round" strokeLinejoin="round">
          <rect x="2" y="5" width="20" height="4" rx="1.5" />
          <path d="M4 13h10M4 17h6" />
        </svg>
      );
    case 'sticky-footer':
      return (
        <svg viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth={2} strokeLinecap="round" strokeLinejoin="round">
          <rect x="2" y="15" width="20" height="5" rx="1.5" />
          <path d="M4 5h16M4 9h10" />
        </svg>
      );
    case 'interstitial':
      return (
        <svg viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth={2} strokeLinecap="round" strokeLinejoin="round">
          <rect x="5" y="3" width="14" height="18" rx="2" />
          <path d="M9 9h6M9 13h6" />
        </svg>
      );
    case 'popup':
      return (
        <svg viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth={2} strokeLinecap="round" strokeLinejoin="round">
          <rect x="3" y="4" width="18" height="13" rx="2" />
          <rect x="8" y="12" width="12" height="9" rx="2" fill="var(--lime)" fillOpacity="0.25" />
        </svg>
      );
    case 'overlay':
    default:
      return (
        <svg viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth={2} strokeLinecap="round" strokeLinejoin="round">
          <rect x="3" y="3" width="18" height="18" rx="3" />
          <path d="M8 12h8" />
        </svg>
      );
  }
}

export function MonetizationAdTypeGrid({ adFormats, onChange }: MonetizationAdTypeGridProps) {
  function isOn(id: string): boolean {
    const persisted = adFormats?.[id as AdFormatId];
    if (typeof persisted === 'boolean') return persisted;
    return AD_TYPES.find((t) => t.id === id)?.defaultEnabled ?? false;
  }

  function toggle(id: string) {
    const next: Partial<Record<AdFormatId, boolean>> = Object.fromEntries(
      AD_TYPES.map((t) => [t.id, t.id === id ? !isOn(t.id) : isOn(t.id)])
    );
    onChange(next);
  }

  const onCount = AD_TYPES.filter((t) => isOn(t.id)).length;
  const lowFriction = AD_TYPES.filter((t) => LOW_FRICTION_IDS.has(t.id));
  const highImpact = AD_TYPES.filter((t) => !LOW_FRICTION_IDS.has(t.id));

  return (
    <section className="mon-section">
      <div className="mon-section-head">
        <h2 className="mon-section-title">Ad formats</h2>
        <span className="mon-section-count">
          {onCount}/{AD_TYPES.length} enabled
        </span>
      </div>
      <p className="mon-section-note">Choose which formats are eligible to show on your site.</p>

      <div className="mon-format-groups">
        <FormatGroup
          title="Low friction"
          caption="Steady fill, stays out of the way"
          items={lowFriction}
          isOn={isOn}
          onToggle={toggle}
        />
        <FormatGroup
          title="Higher impact"
          caption="Better CPM, more visible to visitors"
          items={highImpact}
          isOn={isOn}
          onToggle={toggle}
        />
      </div>
    </section>
  );
}

function FormatGroup({
  title,
  caption,
  items,
  isOn,
  onToggle,
}: {
  title: string;
  caption: string;
  items: AdTypeDef[];
  isOn: (id: string) => boolean;
  onToggle: (id: string) => void;
}) {
  return (
    <div className="mon-format-group">
      <div className="mon-format-group-head">
        <span className="mon-format-group-title">{title}</span>
        <span className="mon-format-group-caption">{caption}</span>
      </div>
      <div className="mon-toggle-group">
        {items.map((type) => {
          const on = isOn(type.id);
          return (
            <div key={type.id} className="mon-toggle-row">
              <span className="mon-toggle-icon" aria-hidden="true">
                <AdTypeIcon id={type.id} />
              </span>
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
                onClick={() => onToggle(type.id)}
              >
                <span className="mon-switch-knob" />
              </button>
            </div>
          );
        })}
      </div>
    </div>
  );
}
