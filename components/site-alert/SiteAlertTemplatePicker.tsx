'use client';

// components/site-alert/SiteAlertTemplatePicker.tsx
//
// "Pre-built models" — the OVERLAY_TEMPLATES catalog (lib/siteAlert.ts)
// shown as clearly-labeled cards: name, a plain-English "what this is
// for" line, and a tiny mock preview so a user can tell what a
// template looks like before they tap it, not just its color dot.
// Picking one calls back into useOverlayComposer's applyTemplate,
// unchanged.
import { OVERLAY_TEMPLATES, type OverlayTemplateId } from '@/lib/siteAlert';

// A one-line "what this is for" per template — separate from each
// template's own `blurb` (used elsewhere as a short tagline) so this
// card can spell out the use case a little more plainly, the way the
// AI Agent's model cards do with their own tagline/description pair.
const TEMPLATE_USE_CASE: Record<OverlayTemplateId, string> = {
  announcement: 'General news or updates for every visitor.',
  maintenance: "Let visitors know something's being worked on.",
  sale: 'Announce a sale, discount, or limited-time offer.',
  update: "Tell visitors about something you've just shipped.",
  celebrate: 'Share a milestone or good news with everyone.',
  custom: 'Start from a blank banner and style it yourself.',
};

interface SiteAlertTemplatePickerProps {
  selected: OverlayTemplateId;
  onSelect: (id: OverlayTemplateId) => void;
}

export function SiteAlertTemplatePicker({ selected, onSelect }: SiteAlertTemplatePickerProps) {
  return (
    <section className="sap-card">
      <div className="sap-card-head">
        <h2 className="sap-card-title">Start from a model</h2>
        <span className="sap-card-sub">Pick one to load its copy, art, and colors &mdash; you can change everything after</span>
      </div>

      <div className="sap-tpl-grid" role="listbox" aria-label="Banner models">
        {OVERLAY_TEMPLATES.map((t) => {
          const isSelected = selected === t.id;
          return (
            <button
              key={t.id}
              type="button"
              role="option"
              aria-selected={isSelected}
              className={`sap-tpl-card${isSelected ? ' is-selected' : ''}`}
              onClick={() => onSelect(t.id)}
            >
              <span
                className="sap-tpl-swatch"
                style={{ background: `linear-gradient(135deg, ${t.theme.bgFrom}, ${t.theme.bgTo})` }}
              >
                <span className="sap-tpl-swatch-dot" style={{ background: t.theme.accent }} />
                {isSelected && (
                  <span className="sap-tpl-check" aria-hidden="true">
                    <svg viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth={3}>
                      <path d="M20 6 9 17l-5-5" />
                    </svg>
                  </span>
                )}
              </span>
              <span className="sap-tpl-body">
                <span className="sap-tpl-name">{t.label}</span>
                <span className="sap-tpl-use">{TEMPLATE_USE_CASE[t.id]}</span>
              </span>
            </button>
          );
        })}
      </div>
    </section>
  );
}
