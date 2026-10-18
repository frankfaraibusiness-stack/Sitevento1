'use client';

// components/agent/AgentModelPicker.tsx
//
// Model selection for the AI Agent builder. Reads AGENT_MODELS
// (lib/agent.ts) — note that file's header comment: provider names
// (groq/gemini) are internal routing detail and must never surface in
// this component's rendered output, only Ventol / Ventol+.
//
// Not a default-on picker — nothing is pre-selected into "live" by
// just viewing this; the caller (AgentPageClient) seeds `selected`
// from the saved config (defaulting to 'ventol' as the catalog's
// minPlan: 'free' model), and the choice only takes effect once the
// page's single Save action persists the whole draft.
import { AGENT_MODELS, modelAllowedForPlan, type AgentModelId } from '@/lib/agent';
import type { PlanId } from '@/lib/plans';

interface AgentModelPickerProps {
  plan: PlanId;
  selected: AgentModelId;
  onSelect: (id: AgentModelId) => void;
  onUpgradeClick: () => void;
}

export function AgentModelPicker({ plan, selected, onSelect, onUpgradeClick }: AgentModelPickerProps) {
  return (
    <section className="agt-section">
      <div className="agt-section-head">
        <h4 className="agt-section-title">Model</h4>
      </div>
      <div className="agt-model-grid">
        {AGENT_MODELS.map((m) => {
          const allowed = modelAllowedForPlan(m.id, plan);
          const isSelected = selected === m.id;
          return (
            <button
              key={m.id}
              type="button"
              className={`agt-model-card${isSelected ? ' is-selected' : ''}${allowed ? '' : ' is-locked'}`}
              onClick={() => (allowed ? onSelect(m.id) : onUpgradeClick())}
              aria-pressed={isSelected}
            >
              <div className="agt-model-top">
                <span className="agt-model-name">{m.name}</span>
                {!allowed && (
                  <span className="agt-lock-pill agt-lock-pill-static">
                    <svg viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth={2}>
                      <rect x="5" y="11" width="14" height="9" rx="2" />
                      <path d="M8 11V7a4 4 0 0 1 8 0v4" />
                    </svg>
                    Upgrade
                  </span>
                )}
                {allowed && isSelected && (
                  <span className="agt-model-check" aria-hidden="true">
                    <svg viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth={2.5}>
                      <path d="M20 6 9 17l-5-5" />
                    </svg>
                  </span>
                )}
              </div>
              <span className="agt-model-tagline">{m.tagline}</span>
              <span className="agt-model-desc">{m.description}</span>
            </button>
          );
        })}
      </div>
    </section>
  );
}
