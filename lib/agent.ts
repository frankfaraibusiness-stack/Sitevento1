// lib/agent.ts
//
// Data model for the "AI Agent" quick tool (dashboard tile id
// 'ai-agent', replacing the old dead 'visitor-api' 3rd Quick Tools
// slot — see components/dashboard/FeatureOptionsGrid.tsx). Mirrors
// lib/widgets.ts's shape: one typed catalog, read by both the UI and
// the API route (app/api/site-agent/route.ts), instead of duplicating
// feature lists in multiple places.
//
// ── Persistence & execution (this pass) ─────────────────────────────
// Config now lives at users/{uid}/sites/{siteId}/agent/config, written
// via app/api/site-agent/route.ts (same Admin-SDK + ID-token-ownership
// pattern as app/api/site-widget/route.ts — see that route's header
// for why a trusted uid can't just be taken from the request body).
// hooks/useSiteAgent.ts mirrors hooks/useSiteWidget.ts's draft/saved
// shape.
//
// There is deliberately NO new install snippet for this feature. Every
// connected site already runs public/sitevento.js (installed once, at
// connect time — see hooks/useConnectSiteWizard.ts's copyConnectTag),
// which already calls home on every pageview (/api/track) and already
// polls /api/site-widgets for this site's current configuration. The
// agent's scheduling/moderation checks (daily-site-toggle,
// country-block, maintenance-mode, etc.) are evaluated SERVER-SIDE,
// inside the existing /api/track and /api/widget request handlers,
// against this same users/{uid}/sites/{siteId}/agent/config document
// — so "installing the agent" is just turning features on here, not a
// second tag to paste anywhere. AgentVerifyPanel (component) surfaces
// this honestly instead of inventing a redundant verification step.
//
// ── Model naming ─────────────────────────────────────────────────────
// Two models are offered to the user, under sitevento's own names only
// — the underlying providers are deliberately never surfaced in any
// user-facing string (UI copy, API response, error message). Keep it
// that way in every file that reads AGENT_MODELS; the provider id is
// server-side routing detail only.
export type AgentModelId = 'ventol' | 'ventol-plus';

export interface AgentModelDef {
  id: AgentModelId;
  name: string;
  tagline: string;
  description: string;
  /** Internal routing only — NEVER rendered in any user-facing copy. */
  provider: 'groq' | 'gemini';
  minPlan: import('./plans').PlanId;
}

export const AGENT_MODELS: AgentModelDef[] = [
  {
    id: 'ventol',
    name: 'Ventol',
    tagline: 'Fast, everyday agent',
    description: 'Quick responses for everyday site automation — the default model for every plan.',
    provider: 'groq',
    minPlan: 'free',
  },
  {
    id: 'ventol-plus',
    name: 'Ventol+',
    tagline: 'Our most capable agent',
    description: 'Sharper judgment for nuanced decisions — multi-step rules, tone-sensitive replies, edge cases.',
    provider: 'gemini',
    minPlan: 'starter',
  },
];

export function getAgentModel(id: string): AgentModelDef | undefined {
  return AGENT_MODELS.find((m) => m.id === id);
}

// ── Feature catalog ──────────────────────────────────────────────────
//
// `cost` is what actually justifies the plan gating below — NOT an
// arbitrary split. 'light' features are passive/rule-based (a cron
// check, a static reply, a lookup) and cheap to run at scale; 'heavy'
// features require either a live model call per decision, continuous
// monitoring, or an irreversible/high-trust action (disabling the
// site, auto-blocking visitors) — these are the ones genuinely worth
// gating behind an upgrade, not picked to manufacture scarcity.
export type AgentFeatureCost = 'light' | 'heavy';

export interface AgentFeatureDef {
  id: string;
  label: string;
  description: string;
  cost: AgentFeatureCost;
  /** UI grouping only. */
  category: 'moderation' | 'scheduling' | 'engagement' | 'support' | 'reporting';
}

// Ordered light → heavy within each plan's allowance (see
// featuresForPlan below) so a plan's N-feature cap always keeps the
// cheapest, most broadly-useful features and drops the expensive ones
// first — giving the free/starter tiers a real, usable agent while
// still making the heavy tier something worth paying for.
export const AGENT_FEATURES: AgentFeatureDef[] = [
  // ── light (rule-based / cheap to run) ──────────────────────────────
  { id: 'daily-site-toggle', label: 'Daily open/close schedule', description: 'Automatically disable the site every day at 11pm in the owner\u2019s time zone, and re-enable it in the morning.', cost: 'light', category: 'scheduling' },
  { id: 'country-block', label: 'Country blocking', description: 'Block visitors from countries you choose, automatically.', cost: 'light', category: 'moderation' },
  { id: 'maintenance-mode', label: 'Scheduled maintenance mode', description: 'Switch on a maintenance overlay during a time window you set.', cost: 'light', category: 'scheduling' },
  // NOTE: real, unconditional bot-burst detection/auto-block now lives
  // in Bot Shield (lib/botShield.ts, /dashboard/bot-shield) — it runs
  // for every site regardless of whether the AI agent is even on, and
  // isn't gated behind this toggle. This entry is left for the agent
  // to reference/explain in conversation (e.g. a visitor asking "do
  // you rate-limit bots?"), not a second enforcement path.
  { id: 'rate-limit-visitors', label: 'Rate-limit repeat visitors', description: 'Mentions that Bot Shield (always on by default, free on every plan) already auto-blocks scripted refresh/click/form bursts.', cost: 'light', category: 'moderation' },
  { id: 'banned-word-filter', label: 'Banned word filter', description: 'Auto-block submissions containing words you\u2019ve blocklisted.', cost: 'light', category: 'moderation' },
  { id: 'business-hours-chat', label: 'Business-hours chat toggle', description: 'Automatically show or hide the support chat widget based on your business hours.', cost: 'light', category: 'scheduling' },
  { id: 'widget-rotation', label: 'Scheduled widget rotation', description: 'Automatically turn different widgets on or off on a schedule you set.', cost: 'light', category: 'scheduling' },
  { id: 'spam-signup-block', label: 'Spam signup blocking', description: 'Automatically block obviously fake or bot signups.', cost: 'light', category: 'moderation' },
  { id: 'daily-summary-email', label: 'Daily summary email', description: 'A short daily email of what the agent did and what it noticed.', cost: 'light', category: 'reporting' },
  { id: 'uptime-watch', label: 'Uptime watch', description: 'Alerts you if the site stops responding to the agent\u2019s checks.', cost: 'light', category: 'reporting' },

  // ── heavy (live model calls / continuous monitoring / high-trust) ──
  { id: 'auto-reply-support', label: 'Auto-reply to support messages', description: 'The agent reads and replies to incoming support chat messages in your voice.', cost: 'heavy', category: 'support' },
  { id: 'lead-qualification', label: 'AI lead qualification', description: 'The agent reads new leads and scores/tags them by fit before you see them.', cost: 'heavy', category: 'support' },
  { id: 'dynamic-widget-targeting', label: 'Push different widgets to different visitors', description: 'The agent decides, per visitor, which widget (if any) to show — based on behavior, not just a static rule.', cost: 'heavy', category: 'engagement' },
  { id: 'visitor-risk-scoring', label: 'Live visitor risk scoring', description: 'The agent continuously scores incoming traffic and auto-blocks visitors it judges abusive.', cost: 'heavy', category: 'moderation' },
  { id: 'content-moderation-ai', label: 'AI content moderation', description: 'The agent reads user-submitted content (reviews, feedback, chat) and removes anything that violates your rules — not just a keyword match.', cost: 'heavy', category: 'moderation' },
  { id: 'auto-personalize-offers', label: 'Auto-personalize offers', description: 'The agent picks which discount or message a visitor sees based on their behavior on your site.', cost: 'heavy', category: 'engagement' },
  { id: 'weekly-insights-report', label: 'AI weekly insights report', description: 'A written weekly analysis of traffic and lead trends, not just raw numbers.', cost: 'heavy', category: 'reporting' },
  { id: 'anomaly-detection', label: 'Live anomaly detection', description: 'The agent watches traffic in real time and alerts you the moment something looks unusual.', cost: 'heavy', category: 'reporting' },
  { id: 'auto-respond-reviews', label: 'Auto-respond to reviews', description: 'The agent writes and posts replies to new reviews in your voice.', cost: 'heavy', category: 'support' },
  { id: 'full-site-autopilot', label: 'Full site autopilot', description: 'The agent can take any of the actions above on its own judgment, without a rule you wrote triggering it first.', cost: 'heavy', category: 'engagement' },
];

export function getAgentFeature(id: string): AgentFeatureDef | undefined {
  return AGENT_FEATURES.find((f) => f.id === id);
}

// ── Plan gating ──────────────────────────────────────────────────────
//
// Counts per the product spec: free = 5, starter = 10, scale ("+") =
// 15, pro-developer (max) = all 20. Each tier's allowance is the first
// N features in AGENT_FEATURES (light-first), so every lower tier's
// set is a strict subset of the tier above it — nothing upgraded-to
// is ever a feature a lower plan already had removed from it.
import type { PlanId } from './plans';

const AGENT_FEATURE_COUNT: Record<PlanId, number> = {
  free: 5,
  starter: 10,
  scale: 15,
  'pro-developer': 20,
};

export function agentFeatureLimit(plan: PlanId): number {
  return AGENT_FEATURE_COUNT[plan] ?? AGENT_FEATURE_COUNT.free;
}

/** The feature ids a given plan is allowed to enable, light-cost first. */
export function featuresForPlan(plan: PlanId): AgentFeatureDef[] {
  return AGENT_FEATURES.slice(0, agentFeatureLimit(plan));
}

export function isFeatureAllowedForPlan(featureId: string, plan: PlanId): boolean {
  return featuresForPlan(plan).some((f) => f.id === featureId);
}

export function modelAllowedForPlan(modelId: AgentModelId, plan: PlanId): boolean {
  const model = getAgentModel(modelId);
  if (!model) return false;
  const order: PlanId[] = ['free', 'starter', 'scale', 'pro-developer'];
  return order.indexOf(plan) >= order.indexOf(model.minPlan);
}

// ── Owner time zone (for daily-site-toggle / maintenance-mode) ────────
//
// A short, deliberately non-exhaustive list of IANA zone identifiers
// — one representative per UTC offset band rather than the full tz
// database, since this picker only needs to answer "what's 11pm for
// you", not cover every city. Values are real IANA identifiers so a
// server-side cron (Intl.DateTimeFormat / date-fns-tz) can resolve
// them directly with no separate offset-math table to keep in sync.
export interface TimezoneDef {
  id: string;
  label: string;
}

export const AGENT_TIMEZONES: TimezoneDef[] = [
  { id: 'Pacific/Midway', label: '(UTC-11:00) Midway Island' },
  { id: 'Pacific/Honolulu', label: '(UTC-10:00) Hawaii' },
  { id: 'America/Anchorage', label: '(UTC-09:00) Alaska' },
  { id: 'America/Los_Angeles', label: '(UTC-08:00) Pacific Time' },
  { id: 'America/Denver', label: '(UTC-07:00) Mountain Time' },
  { id: 'America/Chicago', label: '(UTC-06:00) Central Time' },
  { id: 'America/New_York', label: '(UTC-05:00) Eastern Time' },
  { id: 'America/Halifax', label: '(UTC-04:00) Atlantic Time' },
  { id: 'America/Sao_Paulo', label: '(UTC-03:00) Sao Paulo' },
  { id: 'Atlantic/Azores', label: '(UTC-01:00) Azores' },
  { id: 'Europe/London', label: '(UTC+00:00) London' },
  { id: 'Europe/Paris', label: '(UTC+01:00) Paris, Berlin' },
  { id: 'Europe/Athens', label: '(UTC+02:00) Athens, Cairo' },
  { id: 'Europe/Moscow', label: '(UTC+03:00) Moscow, Nairobi' },
  { id: 'Asia/Dubai', label: '(UTC+04:00) Dubai' },
  { id: 'Asia/Karachi', label: '(UTC+05:00) Karachi' },
  { id: 'Asia/Kolkata', label: '(UTC+05:30) Mumbai, New Delhi' },
  { id: 'Asia/Dhaka', label: '(UTC+06:00) Dhaka' },
  { id: 'Asia/Bangkok', label: '(UTC+07:00) Bangkok, Jakarta' },
  { id: 'Asia/Shanghai', label: '(UTC+08:00) Beijing, Singapore' },
  { id: 'Asia/Tokyo', label: '(UTC+09:00) Tokyo, Seoul' },
  { id: 'Australia/Sydney', label: '(UTC+10:00) Sydney' },
  { id: 'Pacific/Auckland', label: '(UTC+12:00) Auckland' },
];

export function isValidTimezone(id: unknown): id is string {
  return typeof id === 'string' && AGENT_TIMEZONES.some((tz) => tz.id === id);
}

// ── Stored config shape ─────────────────────────────────────────────
//
// users/{uid}/sites/{siteId}/agent/config. `enabledFeatureIds` is
// pre-filtered against the owner's plan at write time (see
// app/api/site-agent/route.ts) — NOT trusted as-is by any reader,
// since a plan can be downgraded after features were enabled; readers
// should always re-check isFeatureAllowedForPlan at use time too, the
// same defense-in-depth the UI already applies in AgentFeatureGrid.
export interface AgentConfig {
  /** Whether the agent is actively evaluated at request time at all — the master switch. */
  active: boolean;
  model: AgentModelId;
  enabledFeatureIds: string[];
  /** ISO 3166-1 alpha-2 codes. Only meaningful if 'country-block' is enabled. */
  blockedCountries: string[];
  /** IANA zone id. Only meaningful if 'daily-site-toggle' or 'maintenance-mode' is enabled. */
  timezone: string;
  updatedAt?: unknown;
}

export const DEFAULT_AGENT_CONFIG: AgentConfig = {
  active: false,
  model: 'ventol',
  enabledFeatureIds: [],
  blockedCountries: [],
  timezone: 'America/New_York',
};

/**
 * Clamps an arbitrary config against a plan's real allowances —
 * drops features/models the plan can no longer use rather than
 * rejecting the whole save, so a downgrade degrades gracefully
 * instead of erroring. Pure function so both the API route and any
 * future server-side evaluator can share exactly this logic rather
 * than re-implementing "what's actually allowed" twice.
 */
export function clampConfigToPlan(config: AgentConfig, plan: PlanId): AgentConfig {
  const allowedFeatureIds = new Set(featuresForPlan(plan).map((f) => f.id));
  const enabledFeatureIds = config.enabledFeatureIds.filter((id) => allowedFeatureIds.has(id));
  const model = modelAllowedForPlan(config.model, plan) ? config.model : 'ventol';
  return { ...config, model, enabledFeatureIds };
}
