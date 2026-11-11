// components/plans/planFacts.ts
//
// Turns the app's limit tables into the rows each plan card lists.
// Nothing here is typed in by hand: every number and every
// included / trial / locked state is read from the same tables the
// server enforces, so a card can never promise something the plan
// doesn't actually give.
import { PLANS, type Plan, type PlanId } from '@/lib/plans';
import { dailyTokenLimit, featureDailyLimit, liveWidgetLimit } from '@/lib/limits';
import {
  monthlyVisitLimit,
  microcentsToUsd,
  OVERAGE_MICROCENTS_PER_VISIT_BLOCK,
  OVERAGE_VISIT_BLOCK_SIZE,
} from '@/lib/visits';
import { OVERAGE_TOKEN_BUNDLE_SIZE, overageMicrocentsPerBundle } from '@/lib/wallet';
import { permissionAccessStatus } from '@/lib/connectPermissions';
import { AGENT_MODELS, agentFeatureLimit, modelAllowedForPlan } from '@/lib/agent';

export type FactState = 'yes' | 'trial' | 'no';

export interface Fact {
  label: string;
  value: string;
  state: FactState;
}

export interface FactGroup {
  title: string;
  facts: Fact[];
}

export interface PlanFacts {
  plan: Plan;
  sites: number;
  visitsFull: string;
  visitsShort: string;
  groups: FactGroup[];
}

/** Overage for visits is quoted per this many visits (the billing block is smaller). */
const VISIT_QUOTE = 10_000;

/** Permissions whose per-plan number is a documented per-day cap. */
const DAILY_METERED = new Set([
  'visitor-access-control',
  'campaign-overlays',
  'session-replay',
  'data-export',
  'event-delivery',
  'external-alerts',
  'ai-response-service',
]);

const num = (n: number) => n.toLocaleString('en-US');
const money = (n: number) => `$${(Math.round(n * 100) / 100).toFixed(2)}`;

function short(n: number): string {
  if (n >= 1_000_000) return `${n / 1_000_000}M`;
  if (n >= 1_000) return `${n / 1_000}K`;
  return `${n}`;
}

function access(id: string, label: string, plan: PlanId): Fact {
  const status = permissionAccessStatus(id, plan);
  if (status === 'locked') return { label, value: 'Not included', state: 'no' };
  const cap = featureDailyLimit(id, plan);
  if (status === 'trial') {
    return { label, value: cap ? `Trial · ${num(cap)}/day` : 'Trial', state: 'trial' };
  }
  if (!DAILY_METERED.has(id)) return { label, value: 'Included', state: 'yes' };
  return { label, value: cap === null ? 'Unlimited' : `${num(cap)}/day`, state: 'yes' };
}

const SUPPORT_LABEL: Record<Plan['limits']['support'], string> = {
  community: 'Community',
  email: 'Email',
  priority: 'Priority',
  dedicated: 'Dedicated contact',
};

function historyLabel(plan: Plan): string {
  const days = plan.limits.historyRetentionDays;
  return days === null ? 'Unlimited' : `${days} days`;
}

function buildFacts(plan: Plan): PlanFacts {
  const id = plan.id;
  const L = plan.limits;
  const visits = monthlyVisitLimit(id);
  const tokens = dailyTokenLimit(id);

  const visitOverage = money(
    microcentsToUsd(OVERAGE_MICROCENTS_PER_VISIT_BLOCK) * (VISIT_QUOTE / OVERAGE_VISIT_BLOCK_SIZE),
  );
  const tokenOverage = money(microcentsToUsd(overageMicrocentsPerBundle(id)));

  const usage: Fact[] = [
    { label: 'Visits per month', value: num(visits), state: 'yes' },
    { label: 'Extra visits', value: `${visitOverage} per ${num(VISIT_QUOTE)}`, state: 'yes' },
    { label: 'Tokens per day', value: tokens === null ? 'Unlimited' : num(tokens), state: 'yes' },
  ];
  if (tokens !== null) {
    usage.push({
      label: 'Extra tokens',
      value: `${tokenOverage} per ${num(OVERAGE_TOKEN_BUNDLE_SIZE)}`,
      state: 'yes',
    });
  }

  const capacity: Fact[] = [
    { label: 'Connected sites', value: num(L.connectedSites), state: 'yes' },
    { label: 'Widgets per site', value: num(L.widgetsPerSite), state: 'yes' },
    { label: 'Live widgets per site', value: num(liveWidgetLimit(id)), state: 'yes' },
    { label: 'Visit history', value: historyLabel(plan), state: 'yes' },
    L.customDateRangeHistory
      ? { label: 'Date-range search', value: 'Included', state: 'yes' }
      : { label: 'Date-range search', value: 'Not included', state: 'no' },
    L.teamSeats > 1
      ? { label: 'Team seats', value: `${L.teamSeats} seats`, state: 'yes' }
      : { label: 'Team seats', value: 'None · just you', state: 'no' },
    L.automation
      ? { label: 'Automation rules', value: `${L.automationRulesPerSite} per site`, state: 'yes' }
      : { label: 'Automation rules', value: 'Not included', state: 'no' },
  ];

  const ai: Fact[] = [
    ...AGENT_MODELS.map(
      (m): Fact =>
        modelAllowedForPlan(m.id, id)
          ? { label: `${m.name} AI model`, value: 'Included', state: 'yes' }
          : { label: `${m.name} AI model`, value: 'Not included', state: 'no' },
    ),
    { label: 'AI agent features', value: num(agentFeatureLimit(id)), state: 'yes' },
    access('ai-response-service', 'AI chat replies', id),
    access('ai-action-autonomy', 'AI action autonomy', id),
  ];

  // The ingest API (/api/ingest) isn't plan-gated: every plan can use it,
  // and every call counts against the monthly visit allowance above.
  const developer: Fact[] = [
    { label: 'REST API access', value: 'Included', state: 'yes' },
    access('event-delivery', 'Webhooks', id),
    access('integration-connections', 'Zapier, Make & CRM', id),
    access('external-alerts', 'Slack alerts', id),
    access('data-export', 'Data export', id),
  ];

  const protection: Fact[] = [
    access('visitor-access-control', 'Visitor blocking', id),
    access('campaign-overlays', 'Live overlays', id),
    access('session-replay', 'Session replay', id),
    access('threat-response', 'Threat response', id),
    access('geographic-restrictions', 'Country restrictions', id),
    access('conversion-experiments', 'A/B experiments', id),
    access('advanced-style-overrides', 'Custom CSS', id),
    L.customLogoBranding
      ? { label: 'Logo branding', value: 'Included', state: 'yes' }
      : { label: 'Logo branding', value: 'Not included', state: 'no' },
    access('administrative-audit-trail', 'Audit trail', id),
  ];

  const support: Fact[] = [{ label: 'Support', value: SUPPORT_LABEL[L.support], state: 'yes' }];

  return {
    plan,
    sites: L.connectedSites,
    visitsFull: num(visits),
    visitsShort: short(visits),
    groups: [
      { title: 'Usage', facts: usage },
      { title: 'Capacity', facts: capacity },
      { title: 'AI', facts: ai },
      { title: 'API & webhooks', facts: developer },
      { title: 'Protection & growth', facts: protection },
      { title: 'Help', facts: support },
    ],
  };
}

export const PLAN_FACTS = Object.fromEntries(PLANS.map((p) => [p.id, buildFacts(p)])) as Record<
  PlanId,
  PlanFacts
>;
