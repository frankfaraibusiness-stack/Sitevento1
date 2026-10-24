'use client';

// components/connect/ConnectPermissionsGrid.tsx
//
// Step 1 of the connect wizard: what the owner is granting sitevento
// over this site. Redesigned around the 30-permission catalog in
// lib/connectPermissions.ts — every permission is always visible to
// every plan (nothing hidden), but a below-plan permission now renders
// in one of two locked states instead of a single flat "locked":
//
//   - 'trial'  — lib/limits.ts has a usable daily cap for this plan on
//                this feature. The row shows a distinct trial badge
//                with the actual number ("Try 3/day") and the switch
//                is interactive — turning it on grants the TRIAL
//                allowance, not full access. Real enforcement of the
//                daily cap happens server-side (see lib/limits.ts's
//                header), this is just accurate, honest UI.
//   - 'locked' — no trial makes sense for this feature (see
//                lib/limits.ts's FEATURE_LIMITS comments for why, per
//                permission) — switch stays disabled, upgrade-only.
import { useMemo } from 'react';
import {
  CONNECT_PERMISSIONS,
  isPermissionAllowedForPlan,
  connectPermissionLimit,
  permissionAccessStatus,
  type ConnectPermissionCategory,
} from '@/lib/connectPermissions';
import { featureDailyLimit } from '@/lib/limits';
import type { PlanId } from '@/lib/plans';

const CATEGORY_LABELS: Record<ConnectPermissionCategory, string> = {
  'visitor-intelligence': 'Visitor intelligence',
  'website-experience': 'Website experience',
  'protection-automation': 'Visitor protection & automation',
  'ai-support': 'AI & customer support',
  'integrations-admin': 'Integrations & administration',
};

const CATEGORY_ICONS: Record<ConnectPermissionCategory, string> = {
  'visitor-intelligence': 'M3 12c2.5-5 5.5-7.5 9-7.5s6.5 2.5 9 7.5c-2.5 5-5.5 7.5-9 7.5S5.5 17 3 12Z M12 15a3 3 0 1 0 0-6 3 3 0 0 0 0 6Z',
  'website-experience': 'M4 5h16v12H4z M4 9h16 M8 19h8 M12 15v4',
  'protection-automation': 'M12 3 4 6v6c0 5 3.5 7.9 8 9 4.5-1.1 8-4 8-9V6l-8-3Z',
  'ai-support': 'M12 3v3 M12 18v3 M4.2 4.2l2.1 2.1 M17.7 17.7l2.1 2.1 M3 12h3 M18 12h3 M4.2 19.8l2.1-2.1 M17.7 6.3l2.1-2.1 M12 9a3 3 0 1 0 0 6 3 3 0 0 0 0-6Z',
  'integrations-admin': 'M9 3H5a2 2 0 0 0-2 2v4 M15 3h4a2 2 0 0 1 2 2v4 M9 21H5a2 2 0 0 1-2-2v-4 M15 21h4a2 2 0 0 0 2-2v-4',
};

const CATEGORY_ORDER: ConnectPermissionCategory[] = [
  'visitor-intelligence',
  'website-experience',
  'protection-automation',
  'ai-support',
  'integrations-admin',
];

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

  const grouped = useMemo(
    () =>
      CATEGORY_ORDER.map((cat) => ({
        category: cat,
        permissions: CONNECT_PERMISSIONS.filter((p) => p.category === cat),
      })).filter((g) => g.permissions.length > 0),
    []
  );

  const trialCount = useMemo(
    () => CONNECT_PERMISSIONS.filter((p) => permissionAccessStatus(p.id, plan) === 'trial').length,
    [plan]
  );

  return (
    <section className="cwz-perm-section">
      <div className="cwz-perm-head">
        <span className="cwz-perm-title">What sitevento can do on this site</span>
        <span className="cwz-perm-count">{selectedCount} of {CONNECT_PERMISSIONS.length} granted</span>
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
            <strong>{lockedCount} more permission{lockedCount === 1 ? '' : 's'}</strong> available on a higher plan
            {trialCount > 0 && (
              <> — <strong>{trialCount}</strong> of those you can already try free, right now, with a daily limit.</>
            )}
          </span>
          <span className="cwz-perm-upsell-cta">Upgrade</span>
        </button>
      )}

      {grouped.map((group) => (
        <div key={group.category} className="cwz-perm-group">
          <h5 className="cwz-perm-group-title">
            <svg className="cwz-perm-group-icon" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth={1.75}>
              <path d={CATEGORY_ICONS[group.category]} />
            </svg>
            {CATEGORY_LABELS[group.category]}
          </h5>
          <div className="cwz-perm-rows">
            {group.permissions.map((perm) => {
              const status = permissionAccessStatus(perm.id, plan);
              const allowed = status === 'full';
              const checked = allowed && selectedIds.includes(perm.id);
              const trialLimit = status === 'trial' ? featureDailyLimit(perm.id, plan) : null;

              return (
                <div key={perm.id} className={`cwz-perm-row is-${status}`}>
                  <span className="cwz-perm-row-num">{String(perm.number).padStart(2, '0')}</span>
                  <span className="cwz-perm-row-stack">
                    <span className="cwz-perm-row-label">
                      {perm.label}
                      {status === 'trial' && (
                        <span className="cwz-perm-trial-pill" title="Available now with a daily free-trial limit">
                          <svg viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth={2.2}>
                            <path d="M12 7v5l3 2" />
                            <circle cx="12" cy="12" r="9" />
                          </svg>
                          Try {trialLimit}/day
                        </span>
                      )}
                      {status === 'locked' && (
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
                    {status === 'trial' && (
                      <button type="button" className="cwz-perm-trial-upgrade" onClick={onUpgradeClick}>
                        Upgrade for unlimited use →
                      </button>
                    )}
                  </span>
                  <button
                    type="button"
                    role="switch"
                    aria-checked={checked}
                    aria-label={status === 'trial' ? `Try ${perm.label} (${trialLimit}/day)` : `Grant ${perm.label}`}
                    disabled={status === 'locked'}
                    className={`cwz-perm-switch${checked ? ' is-on' : ''}${status === 'trial' ? ' is-trial' : ''}`}
                    onClick={() => status !== 'locked' && onToggle(perm.id, !checked)}
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
