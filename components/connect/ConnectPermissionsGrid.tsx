'use client';

// components/connect/ConnectPermissionsGrid.tsx
//
// Step 1 of the connect wizard: what the owner is granting sitevento
// over this site. Built around the 30-permission catalog in
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
//
// Presentation: the 30 permissions are split across 5 category tabs,
// switchable side-by-side (a horizontally scrollable tab strip on
// narrow screens, a plain inline row on wide ones) instead of one long
// stacked list an owner has to scroll past in full. Each tab shows its
// first 5 rows and reveals the rest with a "Show N more" control, so a
// category with 6 permissions (the max any one of them has) costs at
// most one tap to see in full instead of a wall of switches up front.
import { useMemo, useState } from 'react';
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
  'protection-automation': 'Protection & automation',
  'ai-support': 'AI & support',
  'integrations-admin': 'Integrations & admin',
};

const CATEGORY_SHORT_LABELS: Record<ConnectPermissionCategory, string> = {
  'visitor-intelligence': 'Visitors',
  'website-experience': 'Experience',
  'protection-automation': 'Protection',
  'ai-support': 'AI & support',
  'integrations-admin': 'Integrations',
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

const VISIBLE_ROWS = 5;

interface ConnectPermissionsGridProps {
  plan: PlanId;
  selectedIds: string[];
  onToggle: (permissionId: string, next: boolean) => void;
  onUpgradeClick: () => void;
  /**
   * Permission ids currently awaiting a server round-trip — e.g.
   * SiteManagePage's Permissions panel, where each toggle calls
   * app/api/user-action's 'update-site-permissions' action and the row
   * should read as busy until that resolves. Unused (no row is ever
   * pending) at connect time, where the whole selection is only
   * persisted once, at the end of the wizard — so this is optional and
   * defaults to none pending, leaving ConnectFlow's call site
   * unaffected.
   */
  pendingIds?: string[];
  /**
   * Overrides the intro paragraph under the section title. Defaults to
   * the connect wizard's own copy, which points at "site settings" for
   * later edits — SiteManagePage's Permissions panel (the "later" in
   * question) passes its own wording instead of linking back to
   * itself.
   */
  introText?: string;
}

export function ConnectPermissionsGrid({
  plan,
  selectedIds,
  onToggle,
  onUpgradeClick,
  pendingIds,
  introText,
}: ConnectPermissionsGridProps) {
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

  const [activeCategory, setActiveCategory] = useState<ConnectPermissionCategory>(CATEGORY_ORDER[0]);
  const [expanded, setExpanded] = useState<Record<string, boolean>>({});

  const trialCount = useMemo(
    () => CONNECT_PERMISSIONS.filter((p) => permissionAccessStatus(p.id, plan) === 'trial').length,
    [plan]
  );

  const grantedByCategory = useMemo(() => {
    const map: Partial<Record<ConnectPermissionCategory, number>> = {};
    for (const g of grouped) {
      map[g.category] = g.permissions.filter((p) => selectedIds.includes(p.id)).length;
    }
    return map;
  }, [grouped, selectedIds]);

  const activeGroup = grouped.find((g) => g.category === activeCategory) ?? grouped[0];
  const isExpanded = !!expanded[activeGroup.category];
  const visiblePermissions = isExpanded ? activeGroup.permissions : activeGroup.permissions.slice(0, VISIBLE_ROWS);
  const remaining = activeGroup.permissions.length - VISIBLE_ROWS;

  return (
    <section className="cwz-perm-section">
      <div className="cwz-perm-head">
        <span className="cwz-perm-title">What sitevento can do on this site</span>
        <span className="cwz-perm-count">
          <span className="cwz-perm-count-num">{selectedCount}</span>
          <span className="cwz-perm-count-of">/ {CONNECT_PERMISSIONS.length} granted</span>
        </span>
      </div>
      <p className="cwz-perm-intro">
        {introText || 'Choose what to grant sitevento for this site. You can change any of these later from site settings.'}
      </p>

      {lockedCount > 0 && (
        <button type="button" className="cwz-perm-upsell" onClick={onUpgradeClick}>
          <span className="cwz-perm-upsell-top">
            <span className="cwz-perm-upsell-icon">
              <svg viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth={2}>
                <path d="M13 2 3 14h7l-1 8 10-12h-7l1-8Z" />
              </svg>
            </span>
            <span className="cwz-perm-upsell-copy">
              <strong className="cwz-perm-upsell-headline">{lockedCount} more permission{lockedCount === 1 ? '' : 's'} on a higher plan</strong>
              <span className="cwz-perm-upsell-sub">
                {trialCount > 0
                  ? <><strong>{trialCount}</strong> of those you can already try free, right now, with a daily limit.</>
                  : 'Unlock the rest to fully automate this site.'}
              </span>
            </span>
          </span>
          <span className="cwz-perm-upsell-cta">
            Upgrade
            <svg viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth={2.4}>
              <path d="M9 6l6 6-6 6" />
            </svg>
          </span>
        </button>
      )}

      <div className="cwz-perm-tabs" role="tablist" aria-label="Permission categories">
        {grouped.map((group) => {
          const granted = grantedByCategory[group.category] ?? 0;
          const active = group.category === activeCategory;
          return (
            <button
              key={group.category}
              type="button"
              role="tab"
              aria-selected={active}
              className={`cwz-perm-tab${active ? ' is-active' : ''}`}
              onClick={() => setActiveCategory(group.category)}
            >
              <svg className="cwz-perm-tab-icon" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth={1.9}>
                <path d={CATEGORY_ICONS[group.category]} />
              </svg>
              <span className="cwz-perm-tab-label">{CATEGORY_SHORT_LABELS[group.category]}</span>
              {granted > 0 && <span className="cwz-perm-tab-badge">{granted}</span>}
            </button>
          );
        })}
      </div>

      <div key={activeGroup.category} className="cwz-perm-group">
        <h5 className="cwz-perm-group-title">
          <svg className="cwz-perm-group-icon" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth={1.75}>
            <path d={CATEGORY_ICONS[activeGroup.category]} />
          </svg>
          {CATEGORY_LABELS[activeGroup.category]}
          <span className="cwz-perm-group-count">{activeGroup.permissions.length} permission{activeGroup.permissions.length === 1 ? '' : 's'}</span>
        </h5>
        <div className="cwz-perm-rows">
          {visiblePermissions.map((perm) => {
            const status = permissionAccessStatus(perm.id, plan);
            const allowed = status === 'full';
            const checked = allowed && selectedIds.includes(perm.id);
            const trialLimit = status === 'trial' ? featureDailyLimit(perm.id, plan) : null;
            const isPending = !!pendingIds?.includes(perm.id);

            return (
              <div key={perm.id} className={`cwz-perm-row is-${status}${isPending ? ' is-pending' : ''}`}>
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
                  aria-busy={isPending}
                  aria-label={status === 'trial' ? `Try ${perm.label} (${trialLimit}/day)` : `Grant ${perm.label}`}
                  disabled={status === 'locked' || isPending}
                  className={`cwz-perm-switch${checked ? ' is-on' : ''}${status === 'trial' ? ' is-trial' : ''}${isPending ? ' is-pending' : ''}`}
                  onClick={() => status !== 'locked' && !isPending && onToggle(perm.id, !checked)}
                >
                  {isPending ? <span className="cwz-perm-switch-spinner" /> : <span className="cwz-perm-switch-knob" />}
                </button>
              </div>
            );
          })}
        </div>

        {remaining > 0 && (
          <button
            type="button"
            className="cwz-perm-expand"
            onClick={() => setExpanded((prev) => ({ ...prev, [activeGroup.category]: !isExpanded }))}
          >
            <svg
              className={`cwz-perm-expand-chevron${isExpanded ? ' is-up' : ''}`}
              viewBox="0 0 24 24"
              fill="none"
              stroke="currentColor"
              strokeWidth={2.4}
            >
              <path d="M6 9l6 6 6-6" />
            </svg>
            {isExpanded ? 'Show fewer' : `Show ${remaining} more`}
          </button>
        )}
      </div>
    </section>
  );
}
