// lib/apiDocsSpec.ts
//
// The precise, per-EVENT contract of POST /api/ingest, used by the public
// docs page (app/docs/api/page.tsx), its Markdown twin (app/docs/api.md) and
// the OpenAPI file (app/docs/openapi.json). Pure data, no React.
//
// Source of truth: lib/apiEvents.ts (what the server really enforces) and
// lib/apiPermissions.ts (the catalog: groups, permissions, plain-language
// explanations). This file mirrors the validator field by field so the docs
// say exactly what is required — scripts/ checks and the unit check in the
// change notes compare both. If you change a rule in apiEvents.ts, change the
// matching entry here.
import { API_PERMISSIONS, API_PERMISSION_GROUPS, RESERVED_METRICS, type ApiPermissionDef } from './apiPermissions';

export const DOCS_SITE_URL = process.env.NEXT_PUBLIC_SITE_URL || 'https://sitevento12.vercel.app';
export const INGEST_URL = `${DOCS_SITE_URL}/api/ingest`;
export const DOCS_URL = `${DOCS_SITE_URL}/docs/api`;
export const DOCS_MD_URL = `${DOCS_SITE_URL}/docs/api.md`;
export const DOCS_OPENAPI_URL = `${DOCS_SITE_URL}/docs/openapi.json`;

export type DocFieldType = 'text' | 'number' | 'integer' | 'boolean' | 'date' | 'datetime' | 'list' | 'object';

export interface DocField {
  name: string;
  type: DocFieldType;
  required: boolean;
  note: string;
  /** Allowed values for a fixed-choice text field. */
  enum?: string[];
  /** What happens when it is left out. */
  default?: string;
}

export interface DocEvent {
  /** Exact `event` value. */
  event: string;
  /** Permission id from the catalog that must be switched on for the startup. */
  permission: string;
  /** One line: when to send it. */
  when: string;
  /** Fields specific to this event (the common envelope fields are in COMMON_FIELDS). */
  fields: DocField[];
  /** Repeat / duplicate behaviour, in one sentence. */
  repeat: string;
  /** A complete, valid payload (without siteId — the docs add it). */
  example: Record<string, unknown>;
}

const T = (name: string, note: string, extra: Partial<DocField> = {}): DocField => ({ name, type: 'text', required: true, note, ...extra });
const N = (name: string, note: string, extra: Partial<DocField> = {}): DocField => ({ name, type: 'number', required: true, note, ...extra });
const I = (name: string, note: string, extra: Partial<DocField> = {}): DocField => ({ name, type: 'integer', required: true, note, ...extra });
const opt = (f: DocField): DocField => ({ ...f, required: false });

const USER_ID = T('userId', 'Your own STABLE id for the customer (any string, max 200 characters) — the same value on every event for that person, from sign-up onward. Never send names or emails.');
const CURRENCY = T('currency', 'ISO 4217 code, 3 letters, e.g. "USD". Case-insensitive; stored upper-case.');
const INTERVAL = T('interval', 'Billing interval.', { enum: ['week', 'month', 'quarter', 'year'] });

/** Fields every event accepts, whatever its type. */
export const COMMON_FIELDS: DocField[] = [
  T('event', 'The event name, exactly as listed below (e.g. "order.completed"). Max 200 characters.'),
  opt(T('siteId', 'Which connected startup this event belongs to. Optional when the account has exactly one startup; required when it has several (otherwise 400 site_required).')),
  opt(T('userId', 'Your own stable id for the person — the same value on every event, from sign-up onward. Required by most events (see each one); optional on goal.completed and search.performed, which can happen before anyone signs up. Max 200 characters.')),
  opt(T('visitorId', 'The sitevento visitor id of the browser visit that led to this event. Credits sign-ups, trials, goals and sales to the channel that brought the visitor in. Get it in the browser with sitevento("visitor", cb).')),
  opt({ name: 'occurredAt', type: 'datetime', required: false, note: 'When it really happened, ISO 8601 (e.g. 2026-11-10T14:30:00Z). Not more than 5 minutes in the future, not older than about 2 years.', default: 'now' }),
];

export const DOC_EVENTS: DocEvent[] = [
  /* ── Subscriptions & plans ─────────────────────────────────────── */
  {
    event: 'subscription.started',
    permission: 'subscriptions',
    when: 'A customer starts paying (or a paid trial begins billing).',
    fields: [
      USER_ID,
      T('subscriptionId', 'Your id for the subscription. Must stay the same across renewals and changes.'),
      T('plan', 'Plan name as customers know it, e.g. "Pro". Max 100 characters.'),
      N('amount', 'Price per billing interval in major units (49 or 49.99 — not cents). Zero or more.'),
      CURRENCY,
      INTERVAL,
      opt(I('quantity', 'Seats or units. Whole number from 1 to 100000.', { default: '1' })),
      opt(T('planId', 'Your id for the plan, to link it to a plan.upsert entry.')),
    ],
    repeat: 'Sending a second subscription.started with the same subscriptionId is ignored (reported as duplicate, not billed).',
    example: { event: 'subscription.started', userId: 'cus_9132', subscriptionId: 'sub_4471', plan: 'Pro', amount: 49, currency: 'USD', interval: 'month' },
  },
  {
    event: 'subscription.renewed',
    permission: 'subscriptions',
    when: 'A recurring payment succeeds.',
    fields: [
      USER_ID,
      T('subscriptionId', 'The same id you sent on subscription.started.'),
      T('plan', 'Plan name. Max 100 characters.'),
      N('amount', 'What was actually charged for this period, in major units.'),
      CURRENCY,
      INTERVAL,
      opt(I('quantity', 'Seats or units. Whole number from 1 to 100000.', { default: '1' })),
      opt(T('planId', 'Your id for the plan.')),
    ],
    repeat: 'Every call counts as one more payment. Send one per successful charge.',
    example: { event: 'subscription.renewed', userId: 'cus_9132', subscriptionId: 'sub_4471', plan: 'Pro', amount: 49, currency: 'USD', interval: 'month' },
  },
  {
    event: 'subscription.changed',
    permission: 'subscriptions',
    when: 'A customer moves to a different plan, price or quantity.',
    fields: [
      USER_ID,
      T('subscriptionId', 'The same id you sent on subscription.started.'),
      T('plan', 'The NEW plan name. Max 100 characters.'),
      N('amount', 'The NEW price per interval, in major units.'),
      CURRENCY,
      INTERVAL,
      opt(I('quantity', 'Seats or units. Whole number from 1 to 100000.', { default: '1' })),
      opt(T('planId', 'Your id for the new plan.')),
      opt(T('fromPlan', 'The plan they left. Lets an upgrade or downgrade be classified.')),
      opt(N('fromAmount', 'The price they were paying before, per interval.')),
    ],
    repeat: 'Every call is a separate change.',
    example: { event: 'subscription.changed', userId: 'cus_9132', subscriptionId: 'sub_4471', plan: 'Business', amount: 149, currency: 'USD', interval: 'month', fromPlan: 'Pro', fromAmount: 49 },
  },
  {
    event: 'subscription.canceled',
    permission: 'subscriptions',
    when: 'A customer cancels. Send it when the cancellation is decided, not at period end.',
    fields: [USER_ID, T('subscriptionId', 'The same id you sent on subscription.started.'), opt(T('reason', 'Why they left, if you know. Max 200 characters.'))],
    repeat: 'Sending subscription.canceled again for the same subscriptionId is ignored (duplicate).',
    example: { event: 'subscription.canceled', userId: 'cus_9132', subscriptionId: 'sub_4471', reason: 'too expensive' },
  },
  {
    event: 'subscription.payment_failed',
    permission: 'subscriptions',
    when: 'A renewal payment fails. Feeds at-risk revenue.',
    fields: [USER_ID, T('subscriptionId', 'The subscription whose payment failed.'), opt(N('amount', 'The amount that failed, in major units.')), opt(T('currency', 'ISO 4217 code. Send it whenever you send amount.'))],
    repeat: 'Every call is recorded.',
    example: { event: 'subscription.payment_failed', userId: 'cus_9132', subscriptionId: 'sub_4471', amount: 49, currency: 'USD' },
  },
  {
    event: 'plan.upsert',
    permission: 'plan-catalog',
    when: 'A plan is created, or its name or price changes. Safe to resend.',
    fields: [
      T('planId', 'Your stable id for the plan.'),
      T('name', 'Plan name, e.g. "Business". Max 100 characters.'),
      N('amount', 'Price per interval, in major units.'),
      CURRENCY,
      INTERVAL,
      opt({ name: 'active', type: 'boolean', required: false, note: 'false once you stop selling the plan.', default: 'true' }),
    ],
    repeat: 'Upsert: the same planId replaces the earlier entry. It is not a duplicate error.',
    example: { event: 'plan.upsert', planId: 'business', name: 'Business', amount: 149, currency: 'USD', interval: 'month' },
  },

  /* ── Product sales ─────────────────────────────────────────────── */
  {
    event: 'order.completed',
    permission: 'orders',
    when: 'Payment succeeded and the order is yours — not when it is only a cart.',
    fields: [
      T('orderId', 'Unique id for the order. Max 200 characters.'),
      N('total', 'What the customer paid, in major units, including tax and shipping.'),
      CURRENCY,
      {
        name: 'items',
        type: 'list',
        required: true,
        note: 'At least 1 and at most 100 items. Each item is an object: name OR productId (one is required), price (required, number), quantity (whole number, default 1), productId, cost (what one unit costs you, optional).',
      },
      USER_ID,
      opt(N('discount', 'Total discount applied.')),
      opt(N('tax', 'Tax collected (excluded from revenue).')),
      opt(N('shipping', 'Shipping charged.')),
      opt(N('fee', 'Payment-processor fee, e.g. 1.89. Counted as a cost of goods automatically.')),
    ],
    repeat: 'Same orderId again is ignored (duplicate) — safe to retry and safe against webhook re-delivery. For a guest checkout, send a stable id you create for that buyer (for example "guest_" + their order id).',
    example: {
      event: 'order.completed',
      orderId: 'ord_10482',
      userId: 'cus_9132',
      total: 54.9,
      currency: 'USD',
      fee: 1.89,
      items: [
        { productId: 'sku_starter', name: 'Starter license pack', price: 39, quantity: 1, cost: 6 },
        { productId: 'sku_templates', name: 'Template pack', price: 15.9, quantity: 1 },
      ],
    },
  },
  {
    event: 'order.refunded',
    permission: 'refunds',
    when: 'You return money for an order or a subscription payment. Partial refunds are fine.',
    fields: [
      T('orderId', 'The order being refunded.'),
      N('amount', 'Money actually returned, in major units.'),
      CURRENCY,
      opt(T('reason', 'e.g. "duplicate", "not as described". Max 200 characters.')),
      opt(T('subscriptionId', 'If it refunds a subscription payment.')),
      opt(T('refundId', 'Your id for this refund. Send it so retries are not counted twice.')),
    ],
    repeat: 'With refundId, the same refundId again is ignored (duplicate). Without it, every call counts as a new refund.',
    example: { event: 'order.refunded', orderId: 'ord_10482', amount: 15.9, currency: 'USD', reason: 'not as described', refundId: 're_7731' },
  },
  {
    event: 'order.chargeback',
    permission: 'refunds',
    when: 'A payment is disputed and reversed by the bank.',
    fields: [
      T('orderId', 'The order that was disputed.'),
      N('amount', 'Money taken back, in major units.'),
      CURRENCY,
      opt(T('reason', 'Dispute reason. Max 200 characters.')),
      opt(T('subscriptionId', 'If it reverses a subscription payment.')),
      opt(T('refundId', 'Your id for this dispute. Send it so retries are not counted twice.')),
    ],
    repeat: 'With refundId, the same refundId again is ignored (duplicate). Without it, every call counts.',
    example: { event: 'order.chargeback', orderId: 'ord_10482', amount: 54.9, currency: 'USD', reason: 'fraudulent', refundId: 'dp_2210' },
  },
  {
    event: 'product.upsert',
    permission: 'product-catalog',
    when: 'A product is created, or its name, price or cost changes. Safe to resend.',
    fields: [
      T('productId', 'Your stable id or SKU.'),
      T('name', 'What customers see. Max 150 characters.'),
      N('price', 'List price, in major units.'),
      CURRENCY,
      opt(N('cost', 'What one unit costs you to make or fulfil. Gives every product a margin.')),
      opt(T('category', 'For grouping. Max 100 characters.')),
      opt({ name: 'active', type: 'boolean', required: false, note: 'false once discontinued.', default: 'true' }),
    ],
    repeat: 'Upsert: the same productId replaces the earlier entry.',
    example: { event: 'product.upsert', productId: 'sku_starter', name: 'Starter license pack', price: 39, cost: 6, currency: 'USD' },
  },

  /* ── Costs & profit ────────────────────────────────────────────── */
  {
    event: 'expense.recorded',
    permission: 'expenses',
    when: 'You pay or accrue a cost.',
    fields: [
      T('category', '"cogs" = cost of goods (comes off revenue → gross profit). "opex" = operating cost (comes off gross profit → net profit).', { enum: ['cogs', 'opex'] }),
      T('type', 'What kind of cost.', { enum: ['hosting', 'payment_fees', 'fulfillment', 'team', 'tools', 'marketing', 'other'] }),
      N('amount', 'Cost as a positive number, in major units.'),
      CURRENCY,
      opt(T('description', 'e.g. "AWS — October". Max 200 characters.')),
      opt(T('recurring', 'Spread it evenly over time instead of one day.', { enum: ['month', 'year', 'none'] })),
    ],
    repeat: 'Every call is recorded as a separate expense. Do not also send the same spend as adspend.recorded.',
    example: { event: 'expense.recorded', category: 'opex', type: 'tools', amount: 420, currency: 'USD', description: 'Design & dev tools', recurring: 'month' },
  },
  {
    event: 'adspend.recorded',
    permission: 'ad-spend',
    when: 'Once a day per campaign is plenty — send yesterday’s total.',
    fields: [
      T('source', 'Channel, e.g. "facebook", "google". Lower-cased. Match your utm_source.'),
      N('amount', 'Spend for that day, in major units.'),
      CURRENCY,
      { name: 'date', type: 'date', required: true, note: 'The day the spend belongs to, YYYY-MM-DD.' },
      opt(T('medium', 'e.g. "cpc", "paid_social". Lower-cased. Match your utm_medium.')),
      opt(T('campaign', 'Campaign name. Match your utm_campaign. Max 150 characters.')),
      opt(I('impressions', 'Optional reach figure.')),
      opt(I('clicks', 'Optional paid clicks (kept separate from your site visits).')),
    ],
    repeat: 'Upsert: the same source + medium + campaign + date replaces the earlier figure, so you can correct a day by resending it.',
    example: { event: 'adspend.recorded', source: 'facebook', medium: 'paid_social', campaign: 'launch-nov', amount: 312.4, currency: 'USD', date: '2026-11-10' },
  },

  /* ── Customers & growth ────────────────────────────────────────── */
  {
    event: 'user.signed_up',
    permission: 'signups',
    when: 'A new account is created and confirmed.',
    fields: [USER_ID, opt(T('plan', 'Plan they started on, if any. Max 100 characters.')), opt(T('method', 'e.g. "email", "google". Max 60 characters.'))],
    repeat: 'Same userId again is ignored (duplicate): one person is one sign-up.',
    example: { event: 'user.signed_up', userId: 'cus_9132', plan: 'Starter', method: 'google' },
  },
  {
    event: 'user.deleted',
    permission: 'signups',
    when: 'An account is closed or deleted.',
    fields: [USER_ID, opt(T('reason', 'Why they left. Max 200 characters.'))],
    repeat: 'Same userId again is ignored (duplicate).',
    example: { event: 'user.deleted', userId: 'cus_9132', reason: 'switched to a competitor' },
  },
  {
    event: 'user.logged_in',
    permission: 'logins',
    when: 'A successful sign-in. One per session is enough.',
    fields: [USER_ID, opt(T('method', 'e.g. "password", "google", "sso". Max 60 characters.'))],
    repeat: 'Every call is recorded; a user who logs in many times in a day still counts as one active user.',
    example: { event: 'user.logged_in', userId: 'cus_9132', method: 'password' },
  },
  {
    event: 'trial.started',
    permission: 'trials',
    when: 'A customer begins a free trial.',
    fields: [USER_ID, T('plan', 'The plan being trialled. Max 100 characters.'), opt({ name: 'endsAt', type: 'datetime', required: false, note: 'When the trial runs out, ISO 8601 (e.g. 2026-11-24 or 2026-11-24T00:00:00Z).' })],
    repeat: 'Every call is recorded.',
    example: { event: 'trial.started', userId: 'cus_9132', plan: 'Pro', endsAt: '2026-11-24' },
  },
  {
    event: 'trial.ended',
    permission: 'trials',
    when: 'The trial finishes — with the outcome.',
    fields: [USER_ID, T('outcome', 'How the trial ended.', { enum: ['converted', 'expired'] }), opt(T('plan', 'The plan that was trialled. Max 100 characters.'))],
    repeat: 'Every call is recorded.',
    example: { event: 'trial.ended', userId: 'cus_9132', outcome: 'converted', plan: 'Pro' },
  },

  /* ── Goals & behaviour ─────────────────────────────────────────── */
  {
    event: 'goal.completed',
    permission: 'goals',
    when: 'An outcome you care about has really happened on your side (demo booked, invoice paid, lead qualified).',
    fields: [
      T('goal', 'Goal name, e.g. "Demo booked". Keep it consistent. Max 100 characters.'),
      opt(N('value', 'What it is worth, in major units, e.g. 250.')),
      opt(T('currency', 'ISO 4217 code. REQUIRED whenever you send a value.')),
      opt(USER_ID),
    ],
    repeat: 'Every call counts as one completion.',
    example: { event: 'goal.completed', goal: 'Demo booked', value: 250, currency: 'USD', userId: 'lead_204' },
  },
  {
    event: 'custom.<your_name>',
    permission: 'custom-events',
    when: 'Whenever your own product event happens, e.g. custom.report_exported.',
    fields: [
      {
        name: 'event',
        type: 'text',
        required: true,
        note: 'Must start with "custom." followed by 1–60 characters from A–Z a–z 0–9 _ - . (e.g. "custom.report_exported").',
      },
      opt(USER_ID),
      opt({ name: 'properties', type: 'object', required: false, note: 'Any extra detail as a flat-ish JSON object. At most 20 keys and 4 KB.' }),
    ],
    repeat: 'Every call is recorded.',
    example: { event: 'custom.report_exported', userId: 'cus_9132', properties: { format: 'csv', rows: 1840 } },
  },
  {
    event: 'search.performed',
    permission: 'site-search',
    when: 'A search runs on your site or app, whether or not it finds anything.',
    fields: [
      T('term', 'What they typed. Lower-cased for grouping. Max 100 characters.'),
      I('results', 'How many results came back. 0 is meaningful (it feeds the "no results" list). Whole number, 0 to 10,000,000.'),
      opt(USER_ID),
    ],
    repeat: 'Every call counts as one search.',
    example: { event: 'search.performed', term: 'dark mode', results: 0 },
  },

  /* ── Server health ─────────────────────────────────────────────── */
  {
    event: 'server.error',
    permission: 'server-errors',
    when: 'Your server returns a 4xx or 5xx. Pre-aggregate with "count" if it is noisy.',
    fields: [
      I('status', 'HTTP status code, 400 to 599.'),
      T('path', 'Route or URL path, e.g. /api/checkout/confirm. Max 300 characters; anything after "?" is dropped.'),
      opt(T('method', 'GET, POST … Upper-cased. Max 10 characters.')),
      opt(T('message', 'Short reason. Never include secrets. Max 200 characters.')),
      opt(I('count', 'How many times it happened, if you pre-aggregate. Whole number from 1 to 1,000,000.', { default: '1' })),
    ],
    repeat: 'Every call is recorded.',
    example: { event: 'server.error', status: 500, path: '/api/checkout/confirm', method: 'POST', message: 'Upstream timeout', count: 41 },
  },
  {
    event: 'server.metrics',
    permission: 'server-metrics',
    when: 'Every 1–15 minutes, summarising that window. Each heartbeat counts as one event against your monthly allowance.',
    fields: [
      I('requests', 'Requests handled in the window.'),
      I('errors', 'Of those, how many failed (5xx). Must not be more than requests.'),
      opt(N('avgMs', 'Average response time in milliseconds (max 600000).')),
      opt(N('p95Ms', '95th-percentile response time in milliseconds (max 600000).')),
      opt(I('windowSeconds', 'Length of the window in seconds, 10 to 3600.', { default: '60' })),
    ],
    repeat: 'Every call is recorded.',
    example: { event: 'server.metrics', requests: 4210, errors: 9, avgMs: 184, p95Ms: 612, windowSeconds: 300 },
  },
];

/* ── Responses ─────────────────────────────────────────────────────── */

export interface DocStatus {
  status: number;
  code: string;
  meaning: string;
  fix: string;
  /** Safe to retry the same request unchanged? */
  retry: 'no' | 'yes' | 'later';
  /** Extra JSON fields besides ok/error/code. */
  extra?: string;
}

export const DOC_STATUSES: DocStatus[] = [
  { status: 400, code: 'invalid_json', meaning: 'The body is not valid JSON.', fix: 'Send a JSON body with Content-Type: application/json.', retry: 'no' },
  { status: 400, code: 'invalid_body', meaning: 'The JSON is not an object (for example an array).', fix: 'Send ONE event per request as a JSON object.', retry: 'no' },
  { status: 400, code: 'missing_event', meaning: 'No "event" field.', fix: 'Add "event", e.g. "order.completed".', retry: 'no' },
  { status: 400, code: 'unknown_event', meaning: 'The event name is not one of the supported events.', fix: 'Use an exact name from the event reference (custom events must start with "custom.").', retry: 'no' },
  { status: 400, code: 'unknown_site', meaning: 'The siteId is not a startup on this account, or the account has no startups.', fix: 'Use the siteId shown on /dashboard/api, or connect a startup first.', retry: 'no' },
  { status: 400, code: 'site_required', meaning: 'The account has several startups and the event has no siteId.', fix: 'Add "siteId".', retry: 'no' },
  { status: 400, code: 'invalid_event', meaning: 'A field is missing, has the wrong type, or breaks a rule.', fix: 'Read "error" and "field" in the response; fix that field.', retry: 'no', extra: '"field": the name of the offending field (or null)' },
  { status: 401, code: 'missing_key', meaning: 'No Authorization header.', fix: 'Add Authorization: Bearer <key>.', retry: 'no' },
  { status: 401, code: 'invalid_key', meaning: 'The key is wrong, revoked or was regenerated.', fix: 'Copy the current key from /dashboard/api.', retry: 'no' },
  { status: 403, code: 'event_not_permitted', meaning: 'This event type is switched off for this startup.', fix: 'Turn the permission on at /dashboard/api (the "permission" field names it).', retry: 'no', extra: '"permission": the permission id to switch on' },
  { status: 403, code: 'reserved_event', meaning: 'You tried to send a traffic metric (visits, clicks, visitors, geography, devices, bot blocks).', fix: 'These are measured only by the sitevento browser script and can never be sent by API.', retry: 'no' },
  { status: 413, code: 'payload_too_large', meaning: 'The body is larger than 64 KB.', fix: 'Send a smaller event (fewer items / properties).', retry: 'no' },
  { status: 429, code: 'rate_limited', meaning: 'More than 600 requests in a minute for this account.', fix: 'Wait a few seconds, then retry. Back off exponentially.', retry: 'yes' },
  { status: 429, code: 'VISIT_LIMIT_REACHED', meaning: 'The monthly allowance of the plan is used up.', fix: 'Add wallet funds, upgrade the plan, or wait for the reset.', retry: 'later', extra: '"planId", "limit", "used", "nextPlanId", "resetsAt" (ISO date of the monthly reset)' },
  { status: 500, code: 'internal', meaning: 'Something failed on our side.', fix: 'Retry after a short delay.', retry: 'yes' },
  { status: 503, code: '', meaning: 'The service is not configured or temporarily unavailable.', fix: 'Retry after a short delay.', retry: 'yes' },
];

export const DOC_LIMITS = [
  { label: 'Events per request', value: '1', note: 'One JSON object per request. There is no batch endpoint.' },
  { label: 'Max body size', value: '64 KB', note: 'Larger bodies get 413 payload_too_large.' },
  { label: 'Rate limit', value: '600 / minute', note: 'Per account (both keys share it). Exceeding it returns 429 rate_limited.' },
  { label: 'Billing', value: '1 event = 1 visit', note: 'An accepted event uses one visit of the monthly allowance. Duplicates and refused events cost nothing. Test keys are billed the same.' },
  { label: 'String fields', value: '≤ 200 chars', note: 'Ids are clipped to 200 characters; other text fields have their own caps, listed per event.' },
  { label: 'Numbers', value: '2 decimals', note: 'Money is a plain number in major units (49.99, not 4999), rounded to 2 decimals, never negative.' },
];

/* ── Helpers ───────────────────────────────────────────────────────── */

export function eventSlug(event: string): string {
  return event.replace(/[^a-z0-9]+/gi, '-').replace(/^-|-$/g, '').toLowerCase();
}

export function permissionOf(e: DocEvent): ApiPermissionDef {
  const p = API_PERMISSIONS.find((x) => x.id === e.permission);
  if (!p) throw new Error(`apiDocsSpec: unknown permission ${e.permission}`);
  return p;
}

export interface DocGroup {
  id: string;
  title: string;
  note: string;
  permissions: { def: ApiPermissionDef; events: DocEvent[] }[];
}

/** Groups → permissions → events, in catalog order. */
export function docGroups(): DocGroup[] {
  return API_PERMISSION_GROUPS.map((g) => ({
    id: g.id,
    title: g.title,
    note: g.note,
    permissions: API_PERMISSIONS.filter((p) => p.group === g.id).map((def) => ({ def, events: DOC_EVENTS.filter((e) => e.permission === def.id) })),
  }));
}

/** Names of the required event-specific fields, for the at-a-glance table. */
export function requiredNames(e: DocEvent): string[] {
  return e.fields.filter((f) => f.required && f.name !== 'event').map((f) => f.name);
}

/** The example with siteId first, the way the docs show it. */
export function withSite(example: Record<string, unknown>): Record<string, unknown> {
  return { siteId: 'YOUR_SITE_ID', ...example };
}

export { RESERVED_METRICS };

export const SITE_AND_IDS = {
  keyLive: 'sv_live_YOUR_KEY',
  keyTest: 'sv_test_YOUR_KEY',
};
