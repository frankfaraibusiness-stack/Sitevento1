// lib/connectPermissions.ts
//
// Catalog of the permissions a site owner grants sitevento when
// connecting a new site, shown as step 1 of the connect wizard (see
// components/connect/ConnectPermissionsGrid.tsx). Mirrors lib/agent.ts's
// shape on purpose — one typed catalog, plan-gated the same way, so the
// two selector UIs ("AI Agent" permissions, "Connect site" permissions)
// feel like the same product language.
//
// These are presented/consent-style toggles for this pass — nothing
// here is persisted server-side yet (no backend field reads them), so
// gating a toggle behind a plan is purely a product/upsell surface,
// not an access-control boundary. Selected ids are kept in
// useConnectSiteWizard's local state only and reset when the wizard
// closes or resets.
import type { PlanId } from './plans';

export type ConnectPermissionCategory = 'data' | 'display' | 'automation' | 'team' | 'advanced';

export interface ConnectPermissionDef {
  id: string;
  label: string;
  description: string;
  category: ConnectPermissionCategory;
  /** Selected by default on a brand-new connection — the essentials. */
  defaultOn: boolean;
  minPlan: PlanId;
}

const PLAN_ORDER: PlanId[] = ['free', 'starter', 'scale', 'pro-developer'];

export function planMeetsMinimum(plan: PlanId, minPlan: PlanId): boolean {
  return PLAN_ORDER.indexOf(plan) >= PLAN_ORDER.indexOf(minPlan);
}

// Ordered free -> pro-developer within each category so the essentials
// (visit logging, widget display, the core of what sitevento does)
// are always available on every plan, and the deeper/riskier grants
// (full DOM access, auto-blocking, data export) are what's genuinely
// worth gating — not an arbitrary split.
export const CONNECT_PERMISSIONS: ConnectPermissionDef[] = [
  // ── data: what sitevento is allowed to see ──────────────────────────
  { id: 'collect-visits', label: 'Collect visitor analytics', description: 'Record pageviews, referrers, and session counts for this site.', category: 'data', defaultOn: true, minPlan: 'free' },
  { id: 'collect-device-info', label: 'Collect device & browser info', description: 'See visitor device type, browser, and OS for each session.', category: 'data', defaultOn: true, minPlan: 'free' },
  { id: 'collect-geo', label: 'Collect approximate location', description: 'Resolve visitor country/city from IP for your visit logs.', category: 'data', defaultOn: true, minPlan: 'free' },
  { id: 'collect-leads', label: 'Collect lead submissions', description: 'Store form and email-capture submissions from your widgets.', category: 'data', defaultOn: true, minPlan: 'free' },
  { id: 'collect-clickstream', label: 'Collect full clickstream', description: 'Track every click and scroll depth, not just pageviews.', category: 'data', defaultOn: false, minPlan: 'starter' },
  { id: 'collect-session-replay', label: 'Session replay', description: 'Reconstruct and play back individual visitor sessions.', category: 'data', defaultOn: false, minPlan: 'scale' },
  { id: 'export-raw-data', label: 'Raw data export', description: 'Export unaggregated visit and lead data via API or CSV.', category: 'data', defaultOn: false, minPlan: 'pro-developer' },

  // ── display: what sitevento is allowed to show visitors ─────────────
  { id: 'display-widgets', label: 'Display widgets to visitors', description: 'Show chat, email-capture, and other widgets you configure.', category: 'display', defaultOn: true, minPlan: 'free' },
  { id: 'display-overlays', label: 'Push live overlays', description: 'Show full-screen announcement or maintenance overlays on demand.', category: 'display', defaultOn: false, minPlan: 'starter' },
  { id: 'display-personalized', label: 'Personalize widgets per visitor', description: 'Vary which widget shows based on visitor behavior.', category: 'display', defaultOn: false, minPlan: 'scale' },
  { id: 'display-ab-tests', label: 'Run A/B tests on widgets', description: 'Split traffic across widget variants and compare results.', category: 'display', defaultOn: false, minPlan: 'scale' },
  { id: 'display-custom-css', label: 'Inject custom widget styling', description: 'Apply custom CSS overrides to widgets on this site.', category: 'display', defaultOn: false, minPlan: 'starter' },

  // ── automation: what sitevento is allowed to do on its own ──────────
  { id: 'block-visitors', label: 'Block visitors', description: 'Let the dashboard block individual visitors from this site.', category: 'automation', defaultOn: false, minPlan: 'starter' },
  { id: 'auto-block-abuse', label: 'Auto-block suspicious traffic', description: 'Automatically block visitors flagged as bots or abusive.', category: 'automation', defaultOn: false, minPlan: 'scale' },
  { id: 'scheduled-toggles', label: 'Scheduled site toggles', description: 'Automatically open/close the site or widgets on a schedule.', category: 'automation', defaultOn: false, minPlan: 'starter' },
  { id: 'ai-auto-replies', label: 'AI auto-replies to visitors', description: 'Let the AI agent answer support chat messages for you.', category: 'automation', defaultOn: false, minPlan: 'scale' },
  { id: 'full-autopilot', label: 'Full site autopilot', description: 'Let the agent take any available action on its own judgment.', category: 'automation', defaultOn: false, minPlan: 'pro-developer' },

  // ── team: who else gets access ───────────────────────────────────────
  { id: 'team-view', label: 'Team member read access', description: 'Let your team seats view this site\u2019s dashboard.', category: 'team', defaultOn: true, minPlan: 'free' },
  { id: 'team-manage', label: 'Team member management access', description: 'Let your team seats edit widgets and settings for this site.', category: 'team', defaultOn: false, minPlan: 'starter' },
  { id: 'audit-log', label: 'Team activity audit log', description: 'Keep a log of which team member changed what, and when.', category: 'team', defaultOn: false, minPlan: 'scale' },

  // ── advanced: deeper technical grants ────────────────────────────────
  { id: 'dom-read', label: 'Read page DOM content', description: 'Let widgets read on-page content to target themselves contextually.', category: 'advanced', defaultOn: false, minPlan: 'starter' },
  { id: 'cross-domain-identity', label: 'Cross-domain visitor identity', description: 'Recognize the same visitor across your other connected sites.', category: 'advanced', defaultOn: false, minPlan: 'scale' },
  { id: 'webhook-events', label: 'Outbound webhook events', description: 'Send visit, lead, and block events to your own endpoint in real time.', category: 'advanced', defaultOn: false, minPlan: 'pro-developer' },
];

const CATEGORY_LIMIT_BY_PLAN: Record<PlanId, number> = {
  free: 6,
  starter: 13,
  scale: 19,
  'pro-developer': 23,
};

export function connectPermissionLimit(plan: PlanId): number {
  return CATEGORY_LIMIT_BY_PLAN[plan] ?? CATEGORY_LIMIT_BY_PLAN.free;
}

export function isPermissionAllowedForPlan(permissionId: string, plan: PlanId): boolean {
  const def = CONNECT_PERMISSIONS.find((p) => p.id === permissionId);
  if (!def) return false;
  return planMeetsMinimum(plan, def.minPlan);
}

/** Ids selected by default for a brand-new connection, filtered to what the plan actually allows. */
export function defaultPermissionIds(plan: PlanId): string[] {
  return CONNECT_PERMISSIONS.filter((p) => p.defaultOn && planMeetsMinimum(plan, p.minPlan)).map((p) => p.id);
}
