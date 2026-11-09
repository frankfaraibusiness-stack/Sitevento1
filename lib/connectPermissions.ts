// lib/connectPermissions.ts
//
// Catalog of the permissions a site owner grants sitevento when
// connecting a new site, shown as step 1 of the connect wizard (see
// components/connect/ConnectPermissionsGrid.tsx).
//
// All 30 permissions are always shown to every plan — nothing is
// hidden. Permissions below the caller's plan render locked, with
// either (a) a usable daily trial (see lib/limits.ts's FEATURE_LIMITS)
// so the owner can actually experience the feature before upgrading,
// or (b) no trial at all for features that don't suit metered sampling
// (blocking categories of traffic, cross-site identity, delegated
// access, etc.) — those show a plain upgrade lock.
//
// Every number that gates a feature (daily trial caps, Firestore
// quotas, widget live caps) lives in lib/limits.ts — this file is
// catalog/copy only (ids, labels, descriptions, grouping, minPlan).
import type { PlanId } from './plans';
import { planMeetsMinimum, hasFeatureLimit, featureDailyLimit } from './limits';

export type ConnectPermissionCategory =
  | 'visitor-intelligence'
  | 'website-experience'
  | 'protection-automation'
  | 'ai-support'
  | 'integrations-admin';

export interface ConnectPermissionDef {
  id: string;
  /** Previous catalog's id, if this permission replaces one 1:1 in meaning — kept so older saved selections still resolve. */
  legacyId?: string;
  number: number;
  label: string;
  description: string;
  category: ConnectPermissionCategory;
  /** Selected by default on a brand-new connection — the essentials. */
  defaultOn: boolean;
  minPlan: PlanId;
}

export { planMeetsMinimum };

// Ordered 1-30 exactly as the approved catalog, grouped into the 5
// sections. Old ids are preserved as `legacyId` wherever the new
// permission is a rename/clarification of the same capability, so a
// previously-saved selectedIds list (from the old 23-permission
// catalog) still maps onto something meaningful instead of silently
// vanishing.
export const CONNECT_PERMISSIONS: ConnectPermissionDef[] = [
  // ── 1. Visitor intelligence ──────────────────────────────────────
  { id: 'traffic-analytics', legacyId: 'collect-visits', number: 1, label: 'Traffic analytics', description: 'Record pageviews, visits, referrers, and session counts.', category: 'visitor-intelligence', defaultOn: true, minPlan: 'free' },
  { id: 'device-intelligence', legacyId: 'collect-device-info', number: 2, label: 'Device intelligence', description: 'Identify browser, operating system, device type, and viewport.', category: 'visitor-intelligence', defaultOn: true, minPlan: 'free' },
  { id: 'geographic-insights', legacyId: 'collect-geo', number: 3, label: 'Geographic insights', description: 'Estimate visitor country and city from IP-based geolocation.', category: 'visitor-intelligence', defaultOn: true, minPlan: 'free' },
  { id: 'interaction-tracking', legacyId: 'collect-clickstream', number: 4, label: 'Interaction tracking', description: 'Track supported clicks, scroll depth, and visitor interactions.', category: 'visitor-intelligence', defaultOn: false, minPlan: 'starter' },
  { id: 'session-replay', legacyId: 'collect-session-replay', number: 5, label: 'Session replay', description: 'Replay privacy-filtered visitor sessions to diagnose usability problems.', category: 'visitor-intelligence', defaultOn: false, minPlan: 'scale' },
  { id: 'data-export', legacyId: 'export-raw-data', number: 6, label: 'Data export', description: 'Download raw visit records and lead data in supported formats.', category: 'visitor-intelligence', defaultOn: false, minPlan: 'pro-developer' },

  // ── 2. Website experience ────────────────────────────────────────
  { id: 'widget-publishing', legacyId: 'display-widgets', number: 7, label: 'Widget publishing', description: 'Display, update, and pause authorized Sitevento widgets.', category: 'website-experience', defaultOn: true, minPlan: 'free' },
  { id: 'campaign-overlays', legacyId: 'display-overlays', number: 8, label: 'Campaign overlays', description: 'Publish announcements, promotions, and maintenance notices.', category: 'website-experience', defaultOn: false, minPlan: 'starter' },
  { id: 'audience-targeting', number: 9, label: 'Audience targeting', description: 'Choose which supported pages or visitor segments see a widget.', category: 'website-experience', defaultOn: false, minPlan: 'starter' },
  { id: 'custom-widget-styling', legacyId: 'display-custom-css', number: 10, label: 'Custom widget styling', description: 'Customize approved colors, typography, spacing, and appearance.', category: 'website-experience', defaultOn: false, minPlan: 'starter' },
  { id: 'conversion-experiments', legacyId: 'display-ab-tests', number: 11, label: 'Conversion experiments', description: 'Run A/B tests on widget variants and compare conversion rates.', category: 'website-experience', defaultOn: false, minPlan: 'scale' },
  { id: 'advanced-style-overrides', number: 12, label: 'Advanced style overrides', description: 'Apply controlled custom CSS to supported Sitevento components.', category: 'website-experience', defaultOn: false, minPlan: 'pro-developer' },

  // ── 3. Visitor protection and automation ─────────────────────────
  { id: 'visitor-access-control', legacyId: 'block-visitors', number: 13, label: 'Visitor access control', description: 'Block and unblock supported visitor identifiers.', category: 'protection-automation', defaultOn: false, minPlan: 'starter' },
  { id: 'threat-response', legacyId: 'auto-block-abuse', number: 14, label: 'Threat response', description: 'Apply automated rules to suspected bots and abusive traffic.', category: 'protection-automation', defaultOn: false, minPlan: 'scale' },
  { id: 'geographic-restrictions', number: 15, label: 'Geographic restrictions', description: 'Restrict selected countries where the connected enforcement layer supports it.', category: 'protection-automation', defaultOn: false, minPlan: 'scale' },
  { id: 'scheduled-publishing', legacyId: 'scheduled-toggles', number: 16, label: 'Scheduled publishing', description: 'Schedule widget and campaign activation or deactivation.', category: 'protection-automation', defaultOn: false, minPlan: 'starter' },
  { id: 'event-driven-workflows', number: 17, label: 'Event-driven workflows', description: 'Trigger configured actions when supported visitor events occur.', category: 'protection-automation', defaultOn: false, minPlan: 'starter' },
  { id: 'advanced-rule-engine', number: 18, label: 'Advanced rule engine', description: 'Combine multiple conditions, exceptions, and workflow actions.', category: 'protection-automation', defaultOn: false, minPlan: 'pro-developer' },

  // ── 4. AI and customer support ───────────────────────────────────
  { id: 'ai-response-service', legacyId: 'ai-auto-replies', number: 19, label: 'AI response service', description: 'Allow the configured AI agent to respond in the support chat.', category: 'ai-support', defaultOn: false, minPlan: 'starter' },
  { id: 'ai-knowledge-configuration', number: 20, label: 'AI knowledge configuration', description: 'Manage support instructions, approved knowledge, and response behavior.', category: 'ai-support', defaultOn: false, minPlan: 'starter' },
  { id: 'support-intelligence', number: 21, label: 'Support intelligence', description: 'Review conversation history and supported customer-service insights.', category: 'ai-support', defaultOn: false, minPlan: 'scale' },
  { id: 'ai-action-autonomy', legacyId: 'full-autopilot', number: 22, label: 'AI action autonomy', description: 'Allow explicitly approved AI workflows to take defined actions within configured limits.', category: 'ai-support', defaultOn: false, minPlan: 'pro-developer' },

  // ── 5. Integrations and administration ───────────────────────────
  { id: 'event-delivery', legacyId: 'webhook-events', number: 23, label: 'Event delivery', description: 'Send approved visit, lead, and access-control events to external endpoints.', category: 'integrations-admin', defaultOn: false, minPlan: 'scale' },
  { id: 'integration-connections', number: 24, label: 'Integration connections', description: 'Connect supported CRM, Zapier, and Make workflows.', category: 'integrations-admin', defaultOn: false, minPlan: 'scale' },
  { id: 'external-alerts', number: 25, label: 'External alerts', description: 'Send configured notifications to Slack and supported monitoring destinations.', category: 'integrations-admin', defaultOn: false, minPlan: 'scale' },
  { id: 'page-context-access', legacyId: 'dom-read', number: 26, label: 'Page-context access', description: 'Read explicitly permitted page content for contextual widget targeting.', category: 'integrations-admin', defaultOn: false, minPlan: 'scale' },
  { id: 'cross-site-identity', legacyId: 'cross-domain-identity', number: 27, label: 'Cross-site identity', description: 'Recognize consented visitors across connected sites where technically supported.', category: 'integrations-admin', defaultOn: false, minPlan: 'pro-developer' },
  { id: 'team-dashboard-access', legacyId: 'team-view', number: 28, label: 'Team dashboard access', description: "Allow authorized team members to view the connected site's dashboard.", category: 'integrations-admin', defaultOn: true, minPlan: 'free' },
  { id: 'delegated-site-management', legacyId: 'team-manage', number: 29, label: 'Delegated site management', description: 'Grant approved team members permission to modify site settings and widgets.', category: 'integrations-admin', defaultOn: false, minPlan: 'scale' },
  { id: 'administrative-audit-trail', legacyId: 'audit-log', number: 30, label: 'Administrative audit trail', description: 'Record sensitive configuration changes and actions by team members.', category: 'integrations-admin', defaultOn: false, minPlan: 'starter' },
];

const CATEGORY_TOTAL_BY_PLAN: Record<PlanId, number> = {
  free: CONNECT_PERMISSIONS.filter((p) => planMeetsMinimum('free', p.minPlan)).length,
  starter: CONNECT_PERMISSIONS.filter((p) => planMeetsMinimum('starter', p.minPlan)).length,
  scale: CONNECT_PERMISSIONS.filter((p) => planMeetsMinimum('scale', p.minPlan)).length,
  'pro-developer': CONNECT_PERMISSIONS.length,
};

export function connectPermissionLimit(plan: PlanId): number {
  return CATEGORY_TOTAL_BY_PLAN[plan] ?? CATEGORY_TOTAL_BY_PLAN.free;
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

/**
 * Resolves a possibly-legacy permission id (from a selection saved
 * under the old 23-permission catalog) to its current id, so old
 * saved selections keep working after this redesign.
 */
export function resolvePermissionId(id: string): string {
  const direct = CONNECT_PERMISSIONS.find((p) => p.id === id);
  if (direct) return direct.id;
  const legacy = CONNECT_PERMISSIONS.find((p) => p.legacyId === id);
  return legacy ? legacy.id : id;
}

/**
 * Trial/usage status of a permission for a given plan, for UI display:
 *  - 'full'    — plan meets minPlan, feature fully usable (subject to
 *                 its own daily FEATURE_LIMITS cap if any, e.g. blocking).
 *  - 'trial'   — below minPlan, but lib/limits.ts has a usable daily
 *                 trial cap > 0 for this plan.
 *  - 'locked'  — below minPlan, no trial available (either no limit
 *                 row at all, or this plan's row is 0).
 */
export type PermissionAccessStatus = 'full' | 'trial' | 'locked';

export function permissionAccessStatus(permissionId: string, plan: PlanId): PermissionAccessStatus {
  const allowed = isPermissionAllowedForPlan(permissionId, plan);
  if (allowed) return 'full';
  if (!hasFeatureLimit(permissionId)) return 'locked';
  const limit = featureDailyLimit(permissionId, plan);
  return limit && limit > 0 ? 'trial' : 'locked';
}
