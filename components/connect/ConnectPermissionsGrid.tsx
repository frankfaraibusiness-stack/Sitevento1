'use client';

// components/connect/ConnectPermissionsGrid.tsx
//
// Step 1 of the connect wizard: what the owner is granting sitevento
// over this site. Mirrors components/agent/AgentFeatureGrid.tsx's
// toggle-row + plan-lock-pill pattern on purpose (see lib/
// connectPermissions.ts's header) so the two selector surfaces in the
// product read as one consistent language.
import { CONNECT_PERMISSIONS, isPermissionAllowedForPlan, connectPermissionLimit, type ConnectPermissionCategory } from '@/lib/connectPermissions';
import type { PlanId } from '@/lib/plans';

const CATEGORY_LABELS: Record<ConnectPermissionCategory, string> = {
  data: 'Data collection',
  display: 'Visitor display',
  automation: 'Automation',
  team: 'Team access',
  advanced: 'Advanced',
};

const CATEGORY_ORDER: ConnectPermissionCategory[] = ['data', 'display', 'automation', 'team', 'advanced'];

interface ConnectPermissionsGridProps {
  plan: PlanId;
  selectedIds: string[];
  onToggle: (permissionId: string, next: boolean) => void;
  onUpgradeClick: () => void;
}

export function ConnectPermissionsGrid({ plan, selectedIds, onToggle, onUpgradeClick }: ConnectPermissionsGridProps) {
  const limit = connectPermissionLimit(plan);
  const lockedCount = CONNECT_PERMISSIONS.length - limit;
  const selectedCount = selectedIds.length;

  const grouped = CATEGORY_ORDER.map((cat) => ({
    category: cat,
    permissions: CONNECT_PERMISSIONS.filter((p) => p.category === cat),
  })).filter((g) => g.permissions.length > 0);

  return (
    <section className="cwz-perm-section">
      <div className="cwz-perm-head">
        <span className="cwz-perm-title">What sitevento can do on this site</span>
        <span className="cwz-perm-count">{selectedCount} selected</span>
      </div>
      <p className="cwz-perm-intro">
        Choose what to grant sitevento for this site. You can change any of these later from site settings.
      </p>

      {lockedCount > 0 && (
        <button type="button" className="cwz-perm-upsell" onClick={onUpgradeClick}>
          <span className="cwz-perm-upsell-icon">
            <svg viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth={2}>
              <path d="M13 2 3 14h7l-1 8 10-12h-7l1-8Z" />
            </svg>
          </span>
          <span className="cwz-perm-upsell-copy">
            <strong>{lockedCount} more permission{lockedCount === 1 ? '' : 's'}</strong> — session replay, auto-blocking,
            webhooks, and more — unlock on a higher plan.
          </span>
          <span className="cwz-perm-upsell-cta">Upgrade</span>
        </button>
      )}

      {grouped.map((group) => (
        <div key={group.category} className="cwz-perm-group">
          <h5 className="cwz-perm-group-title">{CATEGORY_LABELS[group.category]}</h5>
          <div className="cwz-perm-rows">
            {group.permissions.map((perm) => {
              const allowed = isPermissionAllowedForPlan(perm.id, plan);
              const checked = allowed && selectedIds.includes(perm.id);
              return (
                <div key={perm.id} className={`cwz-perm-row${allowed ? '' : ' is-locked'}`}>
                  <span className="cwz-perm-row-stack">
                    <span className="cwz-perm-row-label">
                      {perm.label}
                      {!allowed && (
                        <button type="button" className="cwz-perm-lock-pill" onClick={onUpgradeClick}>
                          <svg viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth={2}>
                            <rect x="5" y="11" width="14" height="9" rx="2" />
                            <path d="M8 11V7a4 4 0 0 1 8 0v4" />
                          </svg>
                          Upgrade
                        </button>
                      )}
                    </span>
                    <span className="cwz-perm-row-note">{perm.description}</span>
                  </span>
                  <button
                    type="button"
                    role="switch"
                    aria-checked={checked}
                    aria-label={`Grant ${perm.label}`}
                    disabled={!allowed}
                    className={`cwz-perm-switch${checked ? ' is-on' : ''}`}
                    onClick={() => allowed && onToggle(perm.id, !checked)}
                  >
                    <span className="cwz-perm-switch-knob" />
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
