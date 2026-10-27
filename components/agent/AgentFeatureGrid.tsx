'use client';

// components/agent/AgentFeatureGrid.tsx
//
// Renders all 20 entries in AGENT_FEATURES (lib/agent.ts), grouped by
// category, as toggle rows. Which ones are actually togglable is
// decided entirely by featuresForPlan() — light-cost features fill the
// lower tiers first, heavy (live-model-call / high-trust) features are
// what's actually locked behind an upgrade, not an arbitrary split.
//
// `enabled`/`onToggle` are controlled from the parent
// (AgentPageClient, via hooks/useSiteAgent.ts) — this component stays
// pure display + plan-gating logic, with no knowledge of persistence.
// Also shows an upsell banner naming how many (and what kind of)
// features are locked when the current plan doesn't unlock all 20 —
// see lib/agent.ts's cost comment for why 'heavy' features are what's
// actually gated, not an arbitrary split.
import { AGENT_FEATURES, agentFeatureLimit, isFeatureAllowedForPlan, type AgentFeatureDef } from '@/lib/agent';
import type { PlanId } from '@/lib/plans';
import { AgentBlob } from './AgentBlob';

const CATEGORY_LABELS: Record<AgentFeatureDef['category'], string> = {
  scheduling: 'Scheduling',
  moderation: 'Moderation & blocking',
  support: 'Support & replies',
  engagement: 'Engagement',
  reporting: 'Reporting',
};

const CATEGORY_ORDER: AgentFeatureDef['category'][] = [
  'scheduling',
  'moderation',
  'support',
  'engagement',
  'reporting',
];

interface AgentFeatureGridProps {
  plan: PlanId;
  enabledIds: string[];
  onToggle: (featureId: string, next: boolean) => void;
  onUpgradeClick: () => void;
}

export function AgentFeatureGrid({ plan, enabledIds, onToggle, onUpgradeClick }: AgentFeatureGridProps) {
  const limit = agentFeatureLimit(plan);
  const enabledCount = enabledIds.length;
  const lockedCount = AGENT_FEATURES.length - limit;

  const grouped = CATEGORY_ORDER.map((cat) => ({
    category: cat,
    features: AGENT_FEATURES.filter((f) => f.category === cat),
  })).filter((g) => g.features.length > 0);

  return (
    <section className="agt-section">
      <div className="agt-section-head">
        <h4 className="agt-section-title">Permissions</h4>
        <span className="agt-feature-count">
          {enabledCount}/{limit} enabled on your plan
        </span>
      </div>

      {lockedCount > 0 && (
        <button type="button" className="agt-upsell-banner" onClick={onUpgradeClick}>
          <AgentBlob variant="wink" className="agt-upsell-blob" />
          <span className="agt-upsell-copy">
            <strong>{lockedCount} more feature{lockedCount === 1 ? '' : 's'}</strong> — live model calls and
            continuous monitoring, like AI content moderation and full site autopilot — unlock on a higher plan.
          </span>
          <span className="agt-upsell-cta">Upgrade</span>
        </button>
      )}

      {grouped.map((group) => (
        <div key={group.category} className="agt-feat-group">
          <h5 className="agt-feat-group-title">{CATEGORY_LABELS[group.category]}</h5>
          <div className="agt-group">
            {group.features.map((feature) => {
              const allowed = isFeatureAllowedForPlan(feature.id, plan);
              const enabled = allowed && enabledIds.includes(feature.id);
              return (
                <div key={feature.id} className={`agt-row agt-row-top${allowed ? '' : ' is-locked'}`}>
                  <span className="agt-row-stack">
                    <span className="agt-row-label">
                      {feature.label}
                      {feature.cost === 'heavy' && <span className="agt-cost-pill">Advanced</span>}
                      {!allowed && (
                        <button type="button" className="agt-lock-pill" onClick={onUpgradeClick}>
                          <svg viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth={2}>
                            <rect x="5" y="11" width="14" height="9" rx="2" />
                            <path d="M8 11V7a4 4 0 0 1 8 0v4" />
                          </svg>
                          Upgrade
                        </button>
                      )}
                    </span>
                    <span className="agt-row-note">{feature.description}</span>
                  </span>
                  <button
                    type="button"
                    role="switch"
                    aria-checked={enabled}
                    aria-label={`Enable ${feature.label}`}
                    disabled={!allowed}
                    className={`agt-switch${enabled ? ' is-on' : ''}`}
                    onClick={() => allowed && onToggle(feature.id, !enabled)}
                  >
                    <span className="agt-switch-knob" />
                  </button>
                </div>
              );
            })}
          </div>
        </div>
      ))}
    </section>
  );
}

