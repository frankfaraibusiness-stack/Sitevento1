// lib/apiPermissions.ts
//
// The catalog of everything a customer's BACKEND is allowed to send to
// sitevento through the server-side API (app/api/ingest), and — just as
// important — what it can never send.
//
// Why this exists: the embedded script measures everything a browser can
// see (visits, clicks, countries, devices, speed…). The numbers only the
// customer's own server knows — what a plan costs, who subscribed, what an
// order was worth, what the hosting bill was — can only arrive by API. Each
// entry below is one "permission": a family of events the owner switches on
// for a connected site. The ingest route will accept an event only if its
// permission is on for that site, and rejects anything in RESERVED_METRICS
// outright, so the traffic numbers can never be inflated from the outside.
//
// This file is pure data (no React, no Firestore) so the same list drives
// the API page UI today and the server-side whitelist in the next step.
//
// Conventions every event follows:
//   • Sent as JSON to POST /api/ingest with `Authorization: Bearer <key>`.
//   • `event` is the event name below; `siteId` says which connected site.
//   • `userId` is the customer's OWN id for the person — opaque to us.
//   • Money is a plain decimal in major units (49.99, not 4999) plus an ISO
//     `currency` code ("USD").
//   • `occurredAt` (ISO-8601) is optional — defaults to "now" — so backfills
//     and delayed webhooks land on the right day.

export type ApiPermissionGroupId = 'saas' | 'products' | 'profit' | 'customers' | 'behaviour' | 'health';

export interface ApiField {
  name: string;
  /** Human type: "text", "number", "date", "list", "yes / no" … */
  type: string;
  required?: boolean;
  note: string;
}

export interface ApiEventDef {
  /** Exact `event` value to send. */
  name: string;
  /** One line: when to send it. */
  when: string;
}

export interface ApiPreviewStat {
  label: string;
  value: string;
  note?: string;
}

export interface ApiPermissionDef {
  id: string;
  group: ApiPermissionGroupId;
  label: string;
  /** One line under the title — what the owner gets. */
  tagline: string;
  /** Icon key, resolved in components/api/apiIcons.tsx. */
  icon: string;
  /** Analytics sections this feeds, as named on the Analytics page. */
  powers: string[];
  /** Plain-language explanation. */
  what: string;
  /** How the number on the dashboard is worked out. */
  how: string[];
  events: ApiEventDef[];
  fields: ApiField[];
  /** A realistic payload for the primary event (without siteId — the UI adds it). */
  example: Record<string, unknown>;
  /** What it looks like on the Analytics page (sample numbers, shown as an example). */
  preview: ApiPreviewStat[];
  /** Extra caution shown in an amber note (privacy, double counting…). */
  caution?: string;
}

export interface ApiPermissionGroup {
  id: ApiPermissionGroupId;
  title: string;
  note: string;
}

export const API_PERMISSION_GROUPS: ApiPermissionGroup[] = [
  { id: 'saas', title: 'Subscriptions & plans', note: 'For SaaS and membership businesses' },
  { id: 'products', title: 'Product sales', note: 'For stores, licences and one-off purchases' },
  { id: 'profit', title: 'Costs & profit', note: 'What it costs to run, so profit is real' },
  { id: 'customers', title: 'Customers & growth', note: 'Who signs up, who comes back' },
  { id: 'behaviour', title: 'Goals & behaviour', note: 'Conversions and things only your server sees' },
  { id: 'health', title: 'Server health', note: 'Errors and speed from inside your backend' },
];

export const API_PERMISSIONS: ApiPermissionDef[] = [
  /* ── Subscriptions & plans ─────────────────────────────────────────── */
  {
    id: 'subscriptions',
    group: 'saas',
    label: 'Subscriptions',
    tagline: 'Recurring revenue per month — MRR, ARR, subscribers and churn.',
    icon: 'repeat',
    powers: ['Revenue & profitability', 'Performance overview'],
    what:
      'Tell us when a customer subscribes, renews, changes plan or cancels. We turn that stream into your recurring revenue — what you can count on earning every month — and break it down plan by plan.',
    how: [
      'MRR adds up every active subscription’s price, normalised to one month — a $588 yearly plan counts as $49.',
      'ARR is MRR × 12. Active subscribers are customers with a live subscription today.',
      'An upgrade is counted as expansion, a downgrade as contraction, a cancellation as churn.',
      'Churn rate = subscriptions cancelled in the period ÷ subscriptions active at its start.',
      'Renewals record the cash you actually collected, so revenue follows real payments.',
    ],
    events: [
      { name: 'subscription.started', when: 'A customer starts paying (or a paid trial begins billing).' },
      { name: 'subscription.renewed', when: 'A recurring payment succeeds.' },
      { name: 'subscription.changed', when: 'They move to a different plan or quantity.' },
      { name: 'subscription.canceled', when: 'They cancel — send it when it’s decided, not at period end.' },
      { name: 'subscription.payment_failed', when: 'A renewal payment fails (feeds at-risk revenue).' },
    ],
    fields: [
      { name: 'userId', type: 'text', required: true, note: 'Your id for the customer.' },
      { name: 'subscriptionId', type: 'text', required: true, note: 'Stays the same across renewals and changes.' },
      { name: 'plan', type: 'text', required: true, note: 'Plan name as customers know it, e.g. "Pro".' },
      { name: 'amount', type: 'number', required: true, note: 'Price per billing interval, e.g. 49.' },
      { name: 'currency', type: 'text', required: true, note: 'ISO code, e.g. "USD".' },
      { name: 'interval', type: 'text', required: true, note: '"week", "month", "quarter" or "year".' },
      { name: 'quantity', type: 'number', note: 'Seats or units. Defaults to 1.' },
      { name: 'fromPlan', type: 'text', note: 'On changed: the plan they left.' },
      { name: 'reason', type: 'text', note: 'On canceled: why, if you know.' },
      { name: 'visitorId', type: 'text', note: 'Credits the signup to the channel that brought them.' },
    ],
    example: {
      event: 'subscription.started',
      userId: 'cus_9132',
      subscriptionId: 'sub_4471',
      plan: 'Pro',
      amount: 49,
      currency: 'USD',
      interval: 'month',
    },
    preview: [
      { label: 'MRR', value: '$26,140', note: '+9.2% vs last month' },
      { label: 'Churn rate', value: '2.4%', note: '44 cancellations' },
    ],
  },
  {
    id: 'plan-catalog',
    group: 'saas',
    label: 'Plans & pricing',
    tagline: 'Your price list, so every plan shows up — even with no subscribers yet.',
    icon: 'tag',
    powers: ['Revenue & profitability'],
    what:
      'Send your plans once (and whenever you change them). We use it to label every subscription with the right name and price, and to show plans that nobody has bought yet.',
    how: [
      'Each plan appears in the plan table with its price, subscribers and share of MRR.',
      'Renaming a plan relabels its history; retiring one keeps past revenue but stops listing it as current.',
      'Prices are compared with what subscribers actually pay, so grandfathered customers are visible.',
    ],
    events: [{ name: 'plan.upsert', when: 'A plan is created or its name or price changes. Safe to resend — it updates in place.' }],
    fields: [
      { name: 'planId', type: 'text', required: true, note: 'Your stable id for the plan.' },
      { name: 'name', type: 'text', required: true, note: 'e.g. "Business".' },
      { name: 'amount', type: 'number', required: true, note: 'Price per interval.' },
      { name: 'currency', type: 'text', required: true, note: 'ISO code.' },
      { name: 'interval', type: 'text', required: true, note: '"week", "month", "quarter" or "year".' },
      { name: 'active', type: 'yes / no', note: 'false once you stop selling it.' },
    ],
    example: { event: 'plan.upsert', planId: 'business', name: 'Business', amount: 149, currency: 'USD', interval: 'month' },
    preview: [
      { label: 'Business · $149/mo', value: '180 subscribers', note: 'listed even if it starts at 0' },
      { label: 'Plans live', value: '3' },
    ],
  },

  /* ── Product sales ─────────────────────────────────────────────────── */
  {
    id: 'orders',
    group: 'products',
    label: 'Orders',
    tagline: 'Every completed purchase — revenue, order value and best sellers.',
    icon: 'bag',
    powers: ['Revenue & profitability', 'Goals & conversions', 'Campaigns', 'Performance overview'],
    what:
      'Send an event each time a purchase is paid for. With the items in it we can show what sells, how much people spend, and — if you add costs — how much you keep.',
    how: [
      'Revenue is the order total you send; average order value = revenue ÷ orders.',
      'Units sold adds up item quantities; best sellers rank products by the revenue they bring in.',
      'A payment-processing fee you include is counted as a cost of goods automatically.',
      'Item costs, if sent, become cost of goods sold, so gross profit is exact rather than estimated.',
      'Each order also counts as a "Checkout completed" goal.',
    ],
    events: [{ name: 'order.completed', when: 'Payment succeeded and the order is yours — not when it’s only a cart.' }],
    fields: [
      { name: 'orderId', type: 'text', required: true, note: 'Unique per order; resending the same id never double-counts.' },
      { name: 'total', type: 'number', required: true, note: 'What the customer paid, including tax and shipping.' },
      { name: 'currency', type: 'text', required: true, note: 'ISO code.' },
      { name: 'items', type: 'list', required: true, note: 'Each: productId, name, price, quantity, and optional cost.' },
      { name: 'userId', type: 'text', note: 'Your id for the customer, if they have an account.' },
      { name: 'discount', type: 'number', note: 'Total discount applied.' },
      { name: 'tax', type: 'number', note: 'Tax collected (excluded from revenue).' },
      { name: 'shipping', type: 'number', note: 'Shipping charged.' },
      { name: 'fee', type: 'number', note: 'Payment-processor fee, e.g. 1.67.' },
      { name: 'visitorId', type: 'text', note: 'Credits the sale to the channel that brought them.' },
    ],
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
    preview: [
      { label: 'Orders', value: '412', note: '+14.8% vs prior period' },
      { label: 'Avg. order value', value: '$43.90' },
    ],
  },
  {
    id: 'refunds',
    group: 'products',
    label: 'Refunds & chargebacks',
    tagline: 'Money handed back — refund rate and honest net revenue.',
    icon: 'undo',
    powers: ['Revenue & profitability'],
    what:
      'When you refund a customer, or a bank takes a payment back, tell us. Revenue shrinks by that amount and you can see how often it happens.',
    how: [
      'Refunded money is subtracted from revenue on the day you send it.',
      'Refund rate = refunded orders ÷ completed orders in the period.',
      'Partial refunds work: send the amount actually returned.',
      'Chargebacks are tracked separately from voluntary refunds.',
    ],
    events: [
      { name: 'order.refunded', when: 'You return money for an order or subscription payment.' },
      { name: 'order.chargeback', when: 'A payment is disputed and reversed by the bank.' },
    ],
    fields: [
      { name: 'orderId', type: 'text', required: true, note: 'The order being refunded.' },
      { name: 'amount', type: 'number', required: true, note: 'Money returned, e.g. 54.90.' },
      { name: 'currency', type: 'text', required: true, note: 'ISO code.' },
      { name: 'reason', type: 'text', note: 'e.g. "duplicate", "not as described".' },
      { name: 'subscriptionId', type: 'text', note: 'If it refunds a subscription payment.' },
    ],
    example: { event: 'order.refunded', orderId: 'ord_10482', amount: 15.9, currency: 'USD', reason: 'not as described' },
    preview: [
      { label: 'Refund rate', value: '1.8%', note: '7 refunds issued' },
      { label: 'Net revenue', value: '$48,920' },
    ],
  },
  {
    id: 'product-catalog',
    group: 'products',
    label: 'Product catalog',
    tagline: 'Product names, prices and unit costs — for best sellers and margins.',
    icon: 'box',
    powers: ['Revenue & profitability'],
    what:
      'Send your products once so we know their real names, prices and what each unit costs you. Orders can then be as short as an id and a quantity.',
    how: [
      'Best sellers show product names instead of raw ids, including products with no sales yet.',
      'A unit cost gives every product a margin, so you can tell a bestseller from a profitable one.',
      'If an order item omits a cost, we use the catalog cost for it.',
    ],
    events: [{ name: 'product.upsert', when: 'A product is created or its name, price or cost changes. Safe to resend.' }],
    fields: [
      { name: 'productId', type: 'text', required: true, note: 'Your stable id or SKU.' },
      { name: 'name', type: 'text', required: true, note: 'What customers see.' },
      { name: 'price', type: 'number', required: true, note: 'List price.' },
      { name: 'currency', type: 'text', required: true, note: 'ISO code.' },
      { name: 'cost', type: 'number', note: 'What one unit costs you to make or fulfil.' },
      { name: 'category', type: 'text', note: 'For grouping.' },
      { name: 'active', type: 'yes / no', note: 'false once it’s discontinued.' },
    ],
    example: { event: 'product.upsert', productId: 'sku_starter', name: 'Starter license pack', price: 39, cost: 6, currency: 'USD' },
    preview: [
      { label: 'Starter license pack', value: '$7,840', note: '181 units · 85% margin' },
      { label: 'Products listed', value: '14' },
    ],
  },

  /* ── Costs & profit ────────────────────────────────────────────────── */
  {
    id: 'expenses',
    group: 'profit',
    label: 'Expenses',
    tagline: 'What the business spends — so gross and net profit are real.',
    icon: 'receipt',
    powers: ['Revenue & profitability', 'Performance overview'],
    what:
      'Send costs as they happen: hosting, payment fees, fulfilment, salaries, tools. Revenue minus the right costs gives you profit — the number revenue alone never tells you.',
    how: [
      'Costs of goods (hosting, payment fees, fulfilment) come off revenue to give gross profit.',
      'Operating costs (team, tools, marketing) come off gross profit to give net profit.',
      'Mark an expense as recurring and we spread it evenly across each month, so one invoice doesn’t make a single day look terrible.',
      'Margins are shown as a share of revenue for the same period.',
    ],
    events: [{ name: 'expense.recorded', when: 'You pay or accrue a cost.' }],
    fields: [
      { name: 'category', type: 'text', required: true, note: '"cogs" (cost of goods) or "opex" (operating).' },
      { name: 'type', type: 'text', required: true, note: 'hosting, payment_fees, fulfillment, team, tools, marketing or other.' },
      { name: 'amount', type: 'number', required: true, note: 'Cost, as a positive number.' },
      { name: 'currency', type: 'text', required: true, note: 'ISO code.' },
      { name: 'description', type: 'text', note: 'e.g. "AWS — October".' },
      { name: 'recurring', type: 'text', note: '"month" or "year" to spread it over time.' },
    ],
    example: { event: 'expense.recorded', category: 'opex', type: 'tools', amount: 420, currency: 'USD', description: 'Design & dev tools', recurring: 'month' },
    preview: [
      { label: 'Gross profit', value: '$34,760', note: '71.0% margin' },
      { label: 'Net profit', value: '$13,450', note: '27.5% margin' },
    ],
    caution: 'Marketing spend sent under "Marketing spend" is added to operating costs automatically — don’t send it here too.',
  },
  {
    id: 'ad-spend',
    group: 'profit',
    label: 'Marketing spend',
    tagline: 'Ad spend by channel — see what each customer really costs.',
    icon: 'megaphone',
    powers: ['Campaigns', 'Revenue & profitability'],
    what:
      'Send what you spend on each channel and campaign. Paired with the sales and sign-ups those channels bring in, you can see which ones pay for themselves.',
    how: [
      'Spend is matched to a channel by source, medium and campaign (the same UTM names your links use).',
      'Cost per signup or sale = spend ÷ conversions credited to that channel.',
      'Return on ad spend = revenue credited to the channel ÷ its spend.',
      'The total also counts as marketing in your operating costs.',
    ],
    events: [{ name: 'adspend.recorded', when: 'Once a day per campaign is plenty — send yesterday’s total.' }],
    fields: [
      { name: 'source', type: 'text', required: true, note: 'e.g. "facebook", "google".' },
      { name: 'amount', type: 'number', required: true, note: 'Spend for the day.' },
      { name: 'currency', type: 'text', required: true, note: 'ISO code.' },
      { name: 'date', type: 'date', required: true, note: 'The day the spend belongs to, YYYY-MM-DD.' },
      { name: 'medium', type: 'text', note: 'e.g. "cpc", "paid_social".' },
      { name: 'campaign', type: 'text', note: 'Campaign name, matching utm_campaign.' },
      { name: 'impressions', type: 'number', note: 'Optional reach figure.' },
      { name: 'clicks', type: 'number', note: 'Optional paid clicks (kept separate from your site visits).' },
    ],
    example: { event: 'adspend.recorded', source: 'facebook', medium: 'paid_social', campaign: 'launch-nov', amount: 312.4, currency: 'USD', date: '2026-11-10' },
    preview: [
      { label: 'Paid social', value: '$4,210 spend', note: '$1.90 per signup' },
      { label: 'Return on ad spend', value: '3.4×' },
    ],
  },

  /* ── Customers & growth ────────────────────────────────────────────── */
  {
    id: 'signups',
    group: 'customers',
    label: 'Sign-ups & closures',
    tagline: 'Every new account — and every one that closes.',
    icon: 'userPlus',
    powers: ['Goals & conversions', 'Campaigns', 'Audience', 'Retention'],
    what:
      'Send an event the moment someone registers on your site or app. It’s the most reliable "signup" there is: confirmed by your server, not guessed from a button click.',
    how: [
      'Each sign-up counts as a "Signup" goal completion and feeds the conversion rate.',
      'With a visitorId, the sign-up is credited to the channel and campaign that brought the person in.',
      'Closures show how many accounts leave, next to how many arrive.',
      'Counts are by userId, so the same person signing up twice is one account.',
    ],
    events: [
      { name: 'user.signed_up', when: 'A new account is created and confirmed.' },
      { name: 'user.deleted', when: 'An account is closed or deleted.' },
    ],
    fields: [
      { name: 'userId', type: 'text', required: true, note: 'Your id for the new user.' },
      { name: 'plan', type: 'text', note: 'Plan they started on, if any.' },
      { name: 'method', type: 'text', note: 'e.g. "email", "google".' },
      { name: 'visitorId', type: 'text', note: 'Credits the sign-up to its channel.' },
      { name: 'reason', type: 'text', note: 'On deleted: why they left.' },
    ],
    example: { event: 'user.signed_up', userId: 'cus_9132', plan: 'Starter', method: 'google' },
    preview: [
      { label: 'Signup completed', value: '684', note: '3.1% of visitors' },
      { label: 'Accounts closed', value: '23' },
    ],
    caution: 'Send an id, not personal details. We never need names or emails to count a sign-up.',
  },
  {
    id: 'logins',
    group: 'customers',
    label: 'Logins',
    tagline: 'Who actually comes back — daily, weekly and monthly active users.',
    icon: 'login',
    powers: ['Audience', 'Retention'],
    what:
      'Send an event each time a registered user signs in. Visits show who looked at your site; logins show who actually uses your product.',
    how: [
      'Daily, weekly and monthly active users are distinct userIds that logged in during that window.',
      'Retention compares each sign-up week’s users with how many logged in again later.',
      'A user who logs in many times in a day is still one active user.',
    ],
    events: [{ name: 'user.logged_in', when: 'A successful sign-in. One per session is enough.' }],
    fields: [
      { name: 'userId', type: 'text', required: true, note: 'Your id for the user.' },
      { name: 'method', type: 'text', note: 'e.g. "password", "google", "sso".' },
      { name: 'visitorId', type: 'text', note: 'Links the login to a browser visit.' },
    ],
    example: { event: 'user.logged_in', userId: 'cus_9132', method: 'password' },
    preview: [
      { label: 'Monthly active users', value: '3,904' },
      { label: 'Week-1 return', value: '62%' },
    ],
  },
  {
    id: 'trials',
    group: 'customers',
    label: 'Trials',
    tagline: 'Free trials started — and how many turn into paying customers.',
    icon: 'hourglass',
    powers: ['Goals & conversions', 'Revenue & profitability'],
    what:
      'Send when a trial starts and when it ends. We work out how many convert, so you can see whether the trial is doing its job.',
    how: [
      'Each start counts as a "Trial started" goal.',
      'Trial-to-paid rate = trials that ended as "converted" ÷ trials that ended.',
      'If you also send subscriptions, a trial that turns into a subscription is marked converted for you.',
    ],
    events: [
      { name: 'trial.started', when: 'A customer begins a free trial.' },
      { name: 'trial.ended', when: 'The trial finishes — with the outcome.' },
    ],
    fields: [
      { name: 'userId', type: 'text', required: true, note: 'Your id for the customer.' },
      { name: 'plan', type: 'text', required: true, note: 'The plan being trialled.' },
      { name: 'endsAt', type: 'date', note: 'On started: when the trial runs out.' },
      { name: 'outcome', type: 'text', note: 'On ended: "converted" or "expired".' },
      { name: 'visitorId', type: 'text', note: 'Credits the trial to its channel.' },
    ],
    example: { event: 'trial.started', userId: 'cus_9132', plan: 'Pro', endsAt: '2026-11-24' },
    preview: [
      { label: 'Trial started', value: '312', note: '1.4% of visitors' },
      { label: 'Trial → paid', value: '38%' },
    ],
  },

  /* ── Goals & behaviour ─────────────────────────────────────────────── */
  {
    id: 'goals',
    group: 'behaviour',
    label: 'Goals',
    tagline: 'Any outcome you care about, with an optional value attached.',
    icon: 'flag',
    powers: ['Goals & conversions', 'Campaigns', 'Performance overview'],
    what:
      'For outcomes that aren’t a sale or a signup: a demo booked, an invoice paid, a lead qualified. Name the goal, add what it’s worth if you like, and it shows up next to your other conversions.',
    how: [
      'Completions are counted per goal name and shown with their share of all conversions.',
      'Average value per conversion = total goal value ÷ completions that carry a value.',
      'Conversion rate = completions ÷ visitors, the same way for every goal.',
    ],
    events: [{ name: 'goal.completed', when: 'The outcome has really happened on your side.' }],
    fields: [
      { name: 'goal', type: 'text', required: true, note: 'Goal name, e.g. "Demo booked". Keep it consistent.' },
      { name: 'value', type: 'number', note: 'What it’s worth, e.g. 250.' },
      { name: 'currency', type: 'text', note: 'Required if you send a value.' },
      { name: 'userId', type: 'text', note: 'Your id for the person.' },
      { name: 'visitorId', type: 'text', note: 'Credits it to the channel that brought them.' },
    ],
    example: { event: 'goal.completed', goal: 'Demo booked', value: 250, currency: 'USD', userId: 'lead_204' },
    preview: [
      { label: 'Demo booked', value: '58', note: '0.6% of visitors' },
      { label: 'Avg. value', value: '$18.95' },
    ],
  },
  {
    id: 'custom-events',
    group: 'behaviour',
    label: 'Custom events',
    tagline: 'Product usage your server sees — exports, uploads, feature use.',
    icon: 'spark',
    powers: ['Engagement', 'Real-time sitewide log'],
    what:
      'Anything specific to your product that isn’t covered elsewhere. Prefix the name with "custom." and send whatever properties help you.',
    how: [
      'Shown in the Custom events table with how often each fired.',
      'Appears in the real-time log as it happens.',
      'Names must start with "custom." — that keeps them clearly apart from the built-in events.',
    ],
    events: [{ name: 'custom.<your_name>', when: 'Whenever it happens, e.g. custom.report_exported.' }],
    fields: [
      { name: 'userId', type: 'text', note: 'Your id for the person.' },
      { name: 'properties', type: 'object', note: 'Any extra detail, up to 20 keys.' },
      { name: 'visitorId', type: 'text', note: 'Links it to a browser visit.' },
    ],
    example: { event: 'custom.report_exported', userId: 'cus_9132', properties: { format: 'csv', rows: 1840 } },
    preview: [
      { label: 'report_exported', value: '1,205 fires' },
      { label: 'Most used', value: 'api_key_created' },
    ],
  },
  {
    id: 'site-search',
    group: 'behaviour',
    label: 'Site search',
    tagline: 'What people look for — and what they can’t find.',
    icon: 'search',
    powers: ['Engagement'],
    what:
      'If your site or app has its own search, send each query with how many results it returned. Your server knows the result count; a browser script can only guess.',
    how: [
      'Top searches rank terms by how often they’re used.',
      '"Found a result" = searches that returned at least one result ÷ all searches.',
      'Searches with no results are listed separately — a ready-made to-do list for content and features.',
    ],
    events: [{ name: 'search.performed', when: 'A search runs, whether or not it finds anything.' }],
    fields: [
      { name: 'term', type: 'text', required: true, note: 'What they typed (lower-cased for grouping).' },
      { name: 'results', type: 'number', required: true, note: 'How many results came back. 0 is meaningful.' },
      { name: 'userId', type: 'text', note: 'Your id for the person, if known.' },
    ],
    example: { event: 'search.performed', term: 'dark mode', results: 0 },
    preview: [
      { label: 'Found a result', value: '71%', note: '3,214 searches' },
      { label: 'No results', value: 'dark mode · 62' },
    ],
  },

  /* ── Server health ─────────────────────────────────────────────────── */
  {
    id: 'server-errors',
    group: 'health',
    label: 'Server errors',
    tagline: 'Failed requests from your backend — which pages, how often.',
    icon: 'alert',
    powers: ['Site health & system diagnostics', 'Real-time sitewide log'],
    what:
      'A browser script can see a page that fails to load, but not why your server failed. Send server errors and we’ll group them by status and path, and flag spikes.',
    how: [
      'Errors are grouped by status code and path, with a count and when they spiked.',
      '4xx are shown as client problems (missing pages, rate limits); 5xx as server problems.',
      'The headline error rate is errors ÷ requests, using Server metrics if you send them.',
    ],
    events: [{ name: 'server.error', when: 'Your server returns a 4xx or 5xx. Batch with "count" if it’s noisy.' }],
    fields: [
      { name: 'status', type: 'number', required: true, note: 'HTTP status, e.g. 500.' },
      { name: 'path', type: 'text', required: true, note: 'Route or URL path, e.g. /api/checkout/confirm.' },
      { name: 'method', type: 'text', note: 'GET, POST…' },
      { name: 'message', type: 'text', note: 'Short reason. Never include secrets.' },
      { name: 'count', type: 'number', note: 'How many times, if you pre-aggregate. Defaults to 1.' },
    ],
    example: { event: 'server.error', status: 500, path: '/api/checkout/confirm', method: 'POST', message: 'Upstream timeout', count: 41 },
    preview: [
      { label: '500 · /api/checkout/confirm', value: '41×', note: 'spiked 2:14–2:19am' },
      { label: 'Error rate', value: '0.84%' },
    ],
  },
  {
    id: 'server-metrics',
    group: 'health',
    label: 'Server metrics',
    tagline: 'Requests, errors and response time — a heartbeat for your backend.',
    icon: 'pulse',
    powers: ['Site health & system diagnostics', 'API health'],
    what:
      'Send a small summary every few minutes: how many requests your server handled, how many failed and how fast it answered. It gives real response times and a proper error rate.',
    how: [
      'Average response and p95 come straight from what you send.',
      'Error rate = errors ÷ requests across the period.',
      'A gap in heartbeats shows as degraded or down on the uptime strip.',
    ],
    events: [{ name: 'server.metrics', when: 'Every 1–15 minutes, summarising that window.' }],
    fields: [
      { name: 'requests', type: 'number', required: true, note: 'Requests handled in the window.' },
      { name: 'errors', type: 'number', required: true, note: 'Of those, how many failed (5xx).' },
      { name: 'avgMs', type: 'number', note: 'Average response time in ms.' },
      { name: 'p95Ms', type: 'number', note: '95th-percentile response time in ms.' },
      { name: 'windowSeconds', type: 'number', note: 'Length of the window. Defaults to 60.' },
    ],
    example: { event: 'server.metrics', requests: 4210, errors: 9, avgMs: 184, p95Ms: 612, windowSeconds: 300 },
    preview: [
      { label: 'Avg. response', value: '184ms' },
      { label: 'Uptime (90d)', value: '99.96%' },
    ],
    caution: 'Each heartbeat counts as one event against your monthly allowance — every 5 minutes is about 8,600 a month.',
  },
];

/** Quick presets for the permission picker. */
export interface ApiPreset {
  id: string;
  label: string;
  note: string;
  ids: string[];
}

const SAAS = ['subscriptions', 'plan-catalog', 'expenses', 'signups', 'logins', 'trials', 'goals'];
const STORE = ['orders', 'refunds', 'product-catalog', 'expenses', 'ad-spend', 'signups', 'goals'];

export const API_PRESETS: ApiPreset[] = [
  { id: 'saas', label: 'SaaS', note: 'Subscriptions, trials, logins and costs', ids: SAAS },
  { id: 'store', label: 'Online store', note: 'Orders, refunds, catalog and ad spend', ids: STORE },
  { id: 'both', label: 'SaaS + store', note: 'Both revenue streams', ids: Array.from(new Set([...SAAS, ...STORE])) },
  { id: 'all', label: 'Everything', note: 'Every event type', ids: API_PERMISSIONS.map((p) => p.id) },
  { id: 'none', label: 'Nothing', note: 'Switch everything off', ids: [] },
];

/**
 * Traffic and visitor numbers. Measured ONLY by the sitevento script from
 * real browsers — never writable through the API, whatever the key. The
 * ingest route rejects these event names (and anything shaped like them)
 * with 403 `reserved_event`, so the numbers on the Analytics page can't be
 * inflated from the outside.
 */
export interface ReservedMetric {
  id: string;
  label: string;
  note: string;
  icon: string;
  /** Event names the API refuses outright. */
  blocks: string[];
}

export const RESERVED_METRICS: ReservedMetric[] = [
  { id: 'visits', label: 'Visits & page views', note: 'Counted when a real browser loads a page.', icon: 'eye', blocks: ['pageview', 'page_view', 'visit'] },
  { id: 'visitors', label: 'Visitors & sessions', note: 'Identified by the script, never by a server.', icon: 'users', blocks: ['visitor', 'session', 'visitor.created'] },
  { id: 'clicks', label: 'Clicks & scrolling', note: 'Seen on the page, so only the page can report them.', icon: 'click', blocks: ['click', 'rage_click', 'scroll'] },
  { id: 'geo', label: 'Countries & cities', note: 'Worked out from the visitor’s own connection.', icon: 'globe', blocks: ['geo', 'country', 'city'] },
  { id: 'devices', label: 'Devices, browsers & speed', note: 'Read from the browser and its real load times.', icon: 'device', blocks: ['device', 'browser', 'web_vitals', 'page_load'] },
  { id: 'protection', label: 'Bot blocks & protection', note: 'Decided by sitevento, not reported to it.', icon: 'shield', blocks: ['bot_blocked', 'visitor.blocked'] },
];

/** Built-in event names the API accepts, across every permission. */
export const API_EVENT_NAMES: string[] = API_PERMISSIONS.flatMap((p) => p.events.map((e) => e.name)).filter((n) => !n.includes('<'));

export function permissionById(id: string): ApiPermissionDef | undefined {
  return API_PERMISSIONS.find((p) => p.id === id);
}

/** Which permission an event name belongs to (custom.* → custom-events). */
export function permissionForEvent(event: string): ApiPermissionDef | undefined {
  if (event.startsWith('custom.') && event.length > 'custom.'.length) return permissionById('custom-events');
  return API_PERMISSIONS.find((p) => p.events.some((e) => e.name === event));
}
