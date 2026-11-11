// components/analytics/sections/analyticsPlaceholderData.ts
//
// PLACEHOLDER DATA for every section of the Analytics page.
//
// This is the content of the approved "Analytics — Overview Section" mockup,
// transcribed as-is. Nothing here is real yet: when the backend lands, each
// section's constant below is replaced by a fetch for the active site + the
// header's period (and the component keeps the same shape). Keeping all
// sample numbers in one file means sections stay pure markup.
//
// Tone / direction keys ('up' | 'down' | 'ok' | 'warn' | 'bad' ...) are
// semantic hooks for the styling pass — they carry meaning, not colours.

export type Dir = 'up' | 'down' | 'flat';
export type Tone = 'ok' | 'warn' | 'bad';

/* ── 1. Performance overview ───────────────────────────────────── */

export const OVERVIEW_TITLE = 'Performance overview';
export const OVERVIEW_SUBTITLE = 'Revenue, traffic and engagement for the connected site.';

export const METRICS = [
  { id: 'revenue', label: 'Revenue', color: '#6a4fe0' },
  { id: 'views', label: 'Views', color: '#0f9aa6' },
  { id: 'clicks', label: 'Clicks', color: '#14995f' },
  { id: 'ctr', label: 'CTR', color: '#c43e78' },
  { id: 'conv', label: 'Conversion', color: '#b67a16' },
  { id: 'users', label: 'Unique users', color: '#6c7083' },
  { id: 'bounce', label: 'Bounce rate', color: '#9498a8' },
  { id: 'session', label: 'Avg. session', color: '#8a6ff2' },
] as const;
export type MetricId = (typeof METRICS)[number]['id'];

// Only "revenue" comes straight from the mockup; the other headlines are
// derived from numbers elsewhere in it (views = sum of devices, conversion,
// visitors, bounce, median session) or are placeholders (clicks, CTR).
export const METRIC_HEADLINES: Record<MetricId, { range: string; value: string; delta: string; dir: Dir }> = {
  revenue: { range: 'Revenue · Nov 10 — Dec 9', value: '$48,920', delta: '18.4% vs prior period', dir: 'up' },
  views: { range: 'Views · Nov 10 — Dec 9', value: '214,810', delta: '9.7% vs prior period', dir: 'up' },
  clicks: { range: 'Clicks · Nov 10 — Dec 9', value: '9,640', delta: '6.2% vs prior period', dir: 'up' },
  ctr: { range: 'CTR · Nov 10 — Dec 9', value: '4.49%', delta: '0.3 pts vs prior period', dir: 'up' },
  conv: { range: 'Conversion · Nov 10 — Dec 9', value: '4.21%', delta: '0.4 pts vs prior period', dir: 'up' },
  users: { range: 'Unique users · Nov 10 — Dec 9', value: '61,204', delta: '11.3% vs prior period', dir: 'up' },
  bounce: { range: 'Bounce rate · Nov 10 — Dec 9', value: '58.2%', delta: '1.8 pts vs prior period', dir: 'down' },
  session: { range: 'Avg. session · Nov 10 — Dec 9', value: '2m 14s', delta: '6s vs prior period', dir: 'up' },
};

export const CHART = {
  viewBox: '0 0 1000 280',
  gridY: [18, 86, 154, 222],
  line:
    'M0,215 C40,198 60,142 100,150 C140,158 160,112 200,103 C240,94 260,168 300,159 C340,150 360,84 400,89 C440,94 460,131 500,122 C540,113 560,56 600,61 C640,66 660,103 700,94 C740,85 760,38 800,42 C840,46 860,93 900,80 C940,67 970,56 1000,37',
  highlight: { x: 800, y: 42 },
  axis: [
    { x: 0, label: 'Nov 10', anchor: 'start' },
    { x: 230, label: 'Nov 17', anchor: 'start' },
    { x: 460, label: 'Nov 24', anchor: 'start' },
    { x: 690, label: 'Dec 1', anchor: 'start' },
    { x: 950, label: 'Dec 9', anchor: 'end' },
  ] as { x: number; label: string; anchor: 'start' | 'end' }[],
  legend: [
    { label: 'Current period', color: '#6a48ff' },
    { label: 'Previous period', color: 'rgba(18,12,43,.15)' },
    { label: 'Best day: Dec 4 · $3,140', color: '#14995f' },
  ],
};

/* ── 2. Top countries + live activity ──────────────────────────── */

export interface RankedRow {
  label: string;
  title?: string;
  flag?: string;
  value: string;
  share?: string;
  pct?: number; // bar fill, 0–100
  sub?: string;
}

export const COUNTRIES_NOTE = '42 countries';
export const COUNTRIES: RankedRow[] = [
  { flag: '🇺🇸', label: 'United States', value: '58,214', share: '27.1%', pct: 100, sub: '21,840 unique · 2.7 avg visits' },
  { flag: '🇬🇧', label: 'United Kingdom', value: '31,902', share: '14.9%', pct: 55, sub: '12,110 unique · 2.6 avg visits' },
  { flag: '🇩🇪', label: 'Germany', value: '22,406', share: '10.4%', pct: 39, sub: '9,015 unique · 2.5 avg visits' },
  { flag: '🇨🇦', label: 'Canada', value: '17,988', share: '8.4%', pct: 31, sub: '7,220 unique · 2.5 avg visits' },
  { flag: '🇦🇺', label: 'Australia', value: '12,340', share: '5.7%', pct: 21, sub: '5,110 unique · 2.4 avg visits' },
];

export const LIVE_ACTIVITY: { flag: string; path: string; meta: string; time: string; blocked?: boolean }[] = [
  { flag: '🇺🇸', path: '/pricing', meta: 'Desktop · Chrome', time: '4s ago' },
  { flag: '🇩🇪', path: '/checkout/success', meta: 'Mobile · Safari', time: '11s ago' },
  { flag: '🇬🇧', path: '/blog/analytics-guide', meta: 'Desktop · Firefox', time: '29s ago' },
  { flag: '🏴‍☠️', path: '/wp-admin', meta: 'Bot · blocked', time: '41s ago', blocked: true },
  { flag: '🇨🇦', path: '/product/starter-plan', meta: 'Mobile · Chrome', time: '58s ago' },
];

/* ── 3. What people do ─────────────────────────────────────────── */

export const PEOPLE_TITLE = 'What people do';
export const PEOPLE_SUBTITLE = 'Pages, sources and the devices they use';
export const PEOPLE_TABS = ['Pages', 'Entry pages', 'Referrers', 'Devices', 'Browsers', 'Systems', 'Languages', 'Cities'];
// Only the first tab has sample data; the rest show an empty state for now.
export const PEOPLE_ROWS: Record<string, RankedRow[]> = {
  Pages: [
    { label: '/pricing', title: '/pricing', value: '42,110', share: '20%', pct: 100 },
    { label: '/ (home)', title: '/', value: '38,920', share: '18%', pct: 92 },
    { label: '/checkout', title: '/checkout', value: '24,560', share: '11%', pct: 58 },
    { label: '/blog/analytics-guide', title: '/blog/analytics-guide', value: '18,204', share: '8%', pct: 43 },
    { label: '/product/starter-plan', title: '/product/starter-plan', value: '14,990', share: '7%', pct: 35 },
  ],
};

/* ── 4. Device experience ──────────────────────────────────────── */

export const DEVICE_TITLE = 'Device experience';
export const DEVICE_SUBTITLE = 'Conversion, load time and exits, side by side';
export const DEVICE_TABS = [
  { id: 'Desktop', note: '(142,880)' },
  { id: 'Mobile', note: '(58,410)' },
  { id: 'Tablet', note: '(13,520)' },
];
export const DEVICE_DATA: Record<string, { stats: Stat[]; topPagesTitle: string; topPages: RankedRow[] }> = {
  Desktop: {
    stats: [
      { label: 'Conversion rate', value: '4.21%', note: 'of 61,204 visitors' },
      { label: 'Avg. load time', value: '820ms', note: 'from 98,110 page loads' },
      { label: 'Exit rate', value: '31%', note: 'sessions that ended on this device' },
      { label: 'Possible broken clicks', value: '12', note: "rapid repeat clicks — may mean something didn't respond" },
    ],
    topPagesTitle: 'Most successful pages on desktop',
    topPages: [
      { label: '/pricing', title: '/pricing', value: '88% stay' },
      { label: '/checkout', title: '/checkout', value: '81% stay' },
      { label: '/blog/analytics-guide', title: '/blog/analytics-guide', value: '74% stay' },
    ],
  },
};

export interface Stat {
  label: string;
  value: string;
  note?: string;
  tone?: Tone | 'accent';
}

/* ── 5. Visitor journeys ───────────────────────────────────────── */

export const JOURNEYS_TITLE = 'Visitor journeys';
export const JOURNEYS_SUBTITLE = 'From 18,420 multi-page sessions';
export const LANDING_PAGES: RankedRow[] = [
  { label: '/ (home)', title: '/', value: '38,920' },
  { label: '/pricing', title: '/pricing', value: '21,110' },
  { label: '/blog/analytics-guide', title: '/blog/analytics-guide', value: '14,002' },
];
export const EXIT_PAGES: RankedRow[] = [
  { label: '/checkout/success', title: '/checkout/success', value: '24,560' },
  { label: '/pricing', title: '/pricing', value: '9,840' },
  { label: '/contact', title: '/contact', value: '6,215' },
];
export const JOURNEY_TABS = ['Most common', 'Led to a lead'];
export const JOURNEYS: Record<string, { steps: string[]; count: string }[]> = {
  'Most common': [
    { steps: ['/ (home)', '/pricing', '/checkout'], count: '4,210' },
    { steps: ['/blog/analytics-guide', '/pricing'], count: '2,988' },
    { steps: ['/ (home)', '/product/starter-plan', '/checkout'], count: '1,845' },
  ],
};

/* ── 6. Protection ─────────────────────────────────────────────── */

export const PROTECTION = {
  title: 'Protection',
  subtitle: 'Everything your site turned away',
  clean: { value: '99%', label: 'Clean' },
  bots: { value: '1%', label: 'Bots' },
  stats: [
    { label: 'Bots stopped', value: '3,210+' },
    { label: 'Blocked visits', value: '1,884' },
    { label: 'Blocked users', value: '642' },
    { label: 'Restricted now', value: '8' },
  ] as Stat[],
  note: '14 visitors came from hosting or proxy networks.',
};

/* ── 7. Revenue & profitability ────────────────────────────────── */

export const REVENUE_TITLE = 'Revenue & profitability';
export const REVENUE_SUBTITLE = 'Subscriptions and product sales, side by side';
export const REVENUE_TABS = ['Combined', 'SaaS subscriptions', 'Product sales'];
export const REVENUE_TILES: (Stat & { delta: string; dir: Dir; accent?: boolean })[] = [
  { label: 'Total revenue', value: '$48,920', delta: '+18.4%', dir: 'up', accent: true },
  { label: 'Gross profit', value: '$34,760', delta: '71.0% margin', dir: 'up' },
  { label: 'Total expenses', value: '$21,310', delta: '+6.1%', dir: 'down' },
  { label: 'Net profit', value: '$13,450', delta: '27.5% margin', dir: 'up' },
];
export const REVENUE_MIX: { label: string; pct: number; value: string; tone: 'saas' | 'product' }[] = [
  { label: 'SaaS subscriptions', pct: 63, value: '$30,820', tone: 'saas' },
  { label: 'Product sales', pct: 37, value: '$18,100', tone: 'product' },
];
export const PL_SPLIT: { label: string; pct: number; tone: 'gross' | 'cogs' }[] = [
  { label: 'Gross profit · $34,760', pct: 71, tone: 'gross' },
  { label: 'COGS · $14,160', pct: 29, tone: 'cogs' },
];
export const PL_ROWS: { label: string; value: string; kind?: 'sub' | 'total'; sign?: 'neg' | 'pos' }[] = [
  { label: 'Revenue', value: '$48,920' },
  { label: 'Cost of goods sold (hosting, payment fees, fulfillment)', value: '−$14,160', kind: 'sub', sign: 'neg' },
  { label: 'Gross profit', value: '$34,760', kind: 'total' },
  { label: 'Operating expenses (team, tools, marketing)', value: '−$21,310', kind: 'sub', sign: 'neg' },
  { label: 'Net profit', value: '$13,450', kind: 'total', sign: 'pos' },
];
export const SAAS_STATS: Stat[] = [
  { label: 'MRR', value: '$26,140', note: '+9.2% vs last month' },
  { label: 'ARR', value: '$313,680', note: 'run rate' },
  { label: 'Active subscribers', value: '1,842', note: '+64 net new' },
  { label: 'Churn rate', value: '2.4%', note: '44 cancellations', tone: 'warn' },
];
export const SAAS_PLANS = [
  { plan: 'Starter · $19/mo', subscribers: '1,020', mrr: '$19,380', color: '#6a4fe0' },
  { plan: 'Pro · $49/mo', subscribers: '642', mrr: '$6,620', color: '#0f9aa6' },
  { plan: 'Business · $149/mo', subscribers: '180', mrr: '$140', color: '#c43e78' },
];
export const MRR_MOVEMENT: { label: string; value: string; dir: 'pos' | 'neg' }[] = [
  { label: 'New business', value: '+$2,980', dir: 'pos' },
  { label: 'Expansion (upgrades)', value: '+$640', dir: 'pos' },
  { label: 'Contraction (downgrades)', value: '−$210', dir: 'neg' },
  { label: 'Churned', value: '−$890', dir: 'neg' },
];
export const PRODUCT_STATS: Stat[] = [
  { label: 'Orders', value: '412', note: '+14.8% vs prior period' },
  { label: 'Avg. order value', value: '$43.90', note: 'per order' },
  { label: 'Units sold', value: '588', note: '1.43 items / order' },
  { label: 'Refund rate', value: '1.8%', note: '7 refunds issued', tone: 'warn' },
];
export const BEST_SELLERS: RankedRow[] = [
  { label: 'Starter license pack', value: '$7,840', share: '181 units', pct: 100 },
  { label: 'Pro add-on bundle', value: '$5,120', share: '96 units', pct: 65 },
  { label: 'Lifetime deal', value: '$3,990', share: '19 units', pct: 51 },
  { label: 'Template pack', value: '$1,150', share: '292 units', pct: 15 },
];

/* ── 8. Goals & conversions ────────────────────────────────────── */

export const GOALS_TITLE = 'Goals & conversions';
export const GOALS_SUBTITLE = 'Tracked completions for this period';
export const GOALS_SUMMARY: Stat[] = [
  { label: 'Total completions', value: '2,581' },
  { label: 'Overall conversion rate', value: '4.21%' },
  { label: 'Avg. value per conversion', value: '$18.95' },
];
export type GoalIcon = 'check' | 'send' | 'clock' | 'grid';
export const GOALS: { name: string; count: string; share: string; pct: number; rate: string; icon: GoalIcon }[] = [
  { name: 'Checkout completed', count: '1,412', share: '54.7% of goal completions', pct: 100, rate: '5.8%' , icon: 'check' },
  { name: 'Signup form submitted', count: '684', share: '26.5% of goal completions', pct: 48, rate: '3.1%' , icon: 'send' },
  { name: 'Trial started', count: '312', share: '12.1% of goal completions', pct: 22, rate: '1.4%' , icon: 'clock' },
  { name: 'Pricing page CTA clicked', count: '173', share: '6.7% of goal completions', pct: 14, rate: '0.8%' , icon: 'grid' },
];

/* ── 9. Campaigns ──────────────────────────────────────────────── */

export const CAMPAIGNS_TITLE = 'Campaigns';
export const CAMPAIGNS_SUBTITLE = 'Traffic by UTM source & medium';
export const CAMPAIGN_TABS = ['Channels', 'Sources', 'Campaigns', 'Mediums'];
export const CHANNELS = [
  { name: 'Organic search', hint: 'google, bing', visitors: '84,210', conversions: '3,920', rate: '4.7%', delta: '+12.4%', dir: 'up' as Dir, color: '#6a4fe0' },
  { name: 'Direct', hint: 'no referrer', visitors: '52,440', conversions: '1,860', rate: '3.5%', delta: '+3.1%', dir: 'up' as Dir, color: '#0f9aa6' },
  { name: 'Paid social', hint: 'utm_source=facebook, tiktok', visitors: '31,980', conversions: '2,210', rate: '6.9%', delta: '+24.8%', dir: 'up' as Dir, color: '#c43e78' },
  { name: 'Email', hint: 'utm_medium=email', visitors: '18,340', conversions: '1,105', rate: '6.0%', delta: '-4.2%', dir: 'down' as Dir, color: '#14995f' },
  { name: 'Referral', hint: 'other sites linking in', visitors: '12,615', conversions: '312', rate: '2.5%', delta: '+1.6%', dir: 'up' as Dir, color: '#b67a16' },
  { name: 'Paid search', hint: 'utm_medium=cpc', visitors: '9,870', conversions: '644', rate: '6.5%', delta: '-8.9%', dir: 'down' as Dir, color: '#8a6ff2' },
];

/* ── 10. Audience ──────────────────────────────────────────────── */

export const AUDIENCE_TITLE = 'Audience';
export const AUDIENCE_SUBTITLE = 'New vs. returning visitors, by visit frequency';
export const AUDIENCE_SPLIT: { label: string; pct: number; tone: 'violet' | 'cyan' }[] = [
  { label: 'New', pct: 68, tone: 'violet' },
  { label: 'Returning', pct: 32, tone: 'cyan' },
];
export const VISIT_FREQUENCY = [
  { label: '1 visit', pct: 100, value: '68.0%' },
  { label: '2–4 visits', pct: 34, value: '23.1%' },
  { label: '5–10 visits', pct: 10, value: '6.8%' },
  { label: '10+ visits', pct: 3, value: '2.1%' },
];

/* ── 11. Engagement ────────────────────────────────────────────── */

export const EVENTS_TITLE = 'Custom events';
export const EVENTS_NOTE = '26,140 total fires';
export const CUSTOM_EVENTS = [
  { kind: 'Click', name: 'Outbound: github.com/siterifty', count: '8,410' },
  { kind: 'Form', name: 'Newsletter signup submitted', count: '5,220' },
  { kind: 'Click', name: 'Pricing: "Upgrade" button', count: '4,980' },
  { kind: 'File', name: 'Download: product-brochure.pdf', count: '3,105' },
  { kind: 'Video', name: 'Demo video played ≥ 50%', count: '2,640' },
  { kind: 'Click', name: 'Outbound: twitter.com/siterifty', count: '1,785' },
];
export const SEARCH_TITLE = 'Site search';
export const SEARCH_NOTE = '3,214 searches · 71% found a result';
export const SEARCH_TERMS = [
  { term: 'pricing', count: '412' },
  { term: 'api docs', count: '298' },
  { term: 'refund policy', count: '201' },
  { term: 'integrations', count: '184' },
  { term: 'login issue', count: '156' },
  { term: 'export csv', count: '139' },
  { term: 'status page', count: '97' },
  { term: 'cancel subscription', count: '84' },
];
export const SEARCH_NO_RESULTS: RankedRow[] = [
  { label: 'dark mode', value: '62' },
  { label: 'zapier integration', value: '41' },
];

/* ── 12. Retention ─────────────────────────────────────────────── */

export const RETENTION_TITLE = 'Retention';
export const RETENTION_SUBTITLE = "% of each week's new visitors who came back";
export const RETENTION_WEEKS = [100, 62, 41, 30, 24, 21, 19, 17].map((pct, i) => ({ label: `Week ${i}`, pct }));
export const RETENTION_NOTE = 'Week 1 retention is up 4.2 points vs. the previous cohort.';

/* ── 13. Site speed ────────────────────────────────────────────── */

export const SPEED_TITLE = 'Site speed';
export const SPEED_SUBTITLE = 'Core Web Vitals, field data from real visitors';
export const VITALS: { name: string; status: string; tone: 'good' | 'ok'; value: string; desc: string }[] = [
  { name: 'LCP', status: 'Good', tone: 'good', value: '1.9s', desc: 'Largest contentful paint' },
  { name: 'INP', status: 'Good', tone: 'good', value: '142ms', desc: 'Interaction to next paint' },
  { name: 'CLS', status: 'Needs work', tone: 'ok', value: '0.14', desc: 'Cumulative layout shift' },
  { name: 'TTFB', status: 'Good', tone: 'good', value: '310ms', desc: 'Time to first byte' },
];

/* ── 14. Site health & system diagnostics ──────────────────────── */

export const HEALTH_TITLE = 'Site health & system diagnostics';
export const HEALTH_SUBTITLE = 'How the site is actually performing, and what to do about it';
export const HEALTH_STATUS: { label: string; value: string; tone: Tone }[] = [
  { label: 'Uptime (90d)', value: '99.96%', tone: 'ok' },
  { label: 'Avg. response', value: '184ms', tone: 'ok' },
  { label: 'Bounce rate', value: '58.2%', tone: 'warn' },
  { label: 'Error rate', value: '0.84%', tone: 'bad' },
  { label: 'Active now', value: '214', tone: 'ok' },
];
export const UPTIME = {
  days: 90,
  degraded: [23, 61],
  down: [74],
  from: '90 days ago',
  summary: '2 incidents · 11 min total downtime',
  to: 'Today',
};
export type DiagIcon = 'warning' | 'clock' | 'layers' | 'search';
export const DIAGNOSTICS: { severity: 'high' | 'med' | 'low'; icon: DiagIcon; title: string; metric: string; desc: string; fix: string }[] = [
  {
    severity: 'high',
    icon: 'warning',
    title: 'Bounce rate is high on /checkout (71%)',
    metric: '4,890 exits',
    desc: 'Visitors are landing on checkout from paid social and leaving within seconds — far above your site average of 58.2%.',
    fix: "check that paid social traffic lands on a page matching the ad's offer, and confirm the checkout loads correctly on mobile Safari (62% of these exits are iOS).",
  },
  {
    severity: 'med',
    icon: 'clock',
    title: 'CLS is borderline on /blog/analytics-guide',
    metric: 'CLS 0.21',
    desc: 'Layout shift spikes above the "good" threshold on this page, usually from images or ads loading without reserved space.',
    fix: 'add explicit width/height (or aspect-ratio) to images and embeds in the blog template so the browser reserves space before they load.',
  },
  {
    severity: 'med',
    icon: 'layers',
    title: '18% of sessions are on an outdated browser',
    metric: 'Safari ≤14, Chrome ≤100',
    desc: 'Older browser versions are more likely to render your CSS grid layouts incorrectly and may be missing newer JS features you rely on.',
    fix: 'add fallback styles for older Safari/Chrome and consider a lightweight "please update your browser" banner for the oldest 2%.',
  },
  {
    severity: 'low',
    icon: 'search',
    title: '404s are trending up on removed blog tags',
    metric: '312 hits / 30d',
    desc: 'Old tag archive URLs that no longer exist are still being hit, mostly from search and old backlinks.',
    fix: 'add 301 redirects from the old tag URLs to their closest matching category page to recover the traffic and link equity.',
  },
];

// 7 weekdays × 24 hours, 0–100. Weekday afternoon peak, weekend lighter and
// later, dead of night quiet. Deterministic (same formula as the mockup).
export const HEATMAP_DAYS = ['Mon', 'Tue', 'Wed', 'Thu', 'Fri', 'Sat', 'Sun'];
export const HEATMAP_HOURS = ['12a', '1', '2', '3', '4', '5', '6', '7', '8', '9', '10', '11', '12p', '1', '2', '3', '4', '5', '6', '7', '8', '9', '10', '11'];
export const HEATMAP: number[][] = HEATMAP_DAYS.map((_, day) =>
  Array.from({ length: 24 }, (_, hour) => {
    const weekend = day >= 5;
    const base = weekend ? 0.18 : 0.14;
    const peak = weekend ? 14 : 15;
    const spread = weekend ? 5 : 4;
    const dist = Math.abs(hour - peak);
    let val = base + (1 - base) * Math.exp(-(dist * dist) / (2 * spread * spread));
    if (hour < 5) val *= 0.3;
    return Math.round(Math.max(0.06, Math.min(1, val)) * 100);
  })
);
export const HEATMAP_NOTE = { peak: 'Weekdays, 2–4pm (visitor\'s local time)', quiet: 'Sunday mornings before 8am.' };

export const SESSION_LENGTH = {
  buckets: [
    { label: '<10s', pct: 28 },
    { label: '10-30s', pct: 52 },
    { label: '30s-2m', pct: 100 },
    { label: '2-5m', pct: 74 },
    { label: '5-15m', pct: 40 },
    { label: '15-30m', pct: 22 },
    { label: '30m+', pct: 10 },
  ],
  median: '2m 14s',
  pagesPerSession: '3.4',
};
export const APPEARANCE = {
  dark: '57%',
  light: '43%',
  note: 'Dark mode visitors bounce 9% less — your dark theme is doing its job.',
};

export interface TechRow {
  icon: string;
  label: string;
  hint?: string;
  value: string;
  pct: number;
}
export const BROWSERS: TechRow[] = [
  { icon: '🌐', label: 'Chrome', value: '62.4%', pct: 100 },
  { icon: '🧭', label: 'Safari', value: '24.1%', pct: 39 },
  { icon: '🦊', label: 'Firefox', value: '8.0%', pct: 13 },
  { icon: '🌊', label: 'Edge', value: '4.6%', pct: 7 },
  { icon: '🎭', label: 'Other', value: '0.9%', pct: 2 },
];
export const OPERATING_SYSTEMS: TechRow[] = [
  { icon: '🪟', label: 'Windows', value: '41.2%', pct: 100 },
  { icon: '🍎', label: 'macOS', value: '26.8%', pct: 65 },
  { icon: '📱', label: 'iOS', value: '18.5%', pct: 45 },
  { icon: '🤖', label: 'Android', value: '10.4%', pct: 25 },
  { icon: '🐧', label: 'Linux', value: '3.1%', pct: 8 },
];
export const SCREENS: TechRow[] = [
  { icon: '🖥️', label: '1920×1080', value: '28.4%', pct: 100 },
  { icon: '📱', label: '390×844', hint: '(iPhone)', value: '16.2%', pct: 57 },
  { icon: '💻', label: '1440×900', value: '14.7%', pct: 52 },
  { icon: '📱', label: '412×915', hint: '(Android)', value: '12.1%', pct: 43 },
  { icon: '🖥️', label: '2560×1440', value: '9.8%', pct: 35 },
];
export const CONNECTION_STATS: Stat[] = [
  { label: '4G / 5G', value: '64%', note: 'of mobile sessions' },
  { label: 'Wi-Fi', value: '34%', note: 'of mobile sessions' },
  { label: 'Slow connections', value: '2%', note: '2G/slow-3G — may see degraded LCP', tone: 'warn' },
  { label: 'Touch devices', value: '48%', note: 'of all sessions' },
];
export const ERROR_LOG: { code: string; klass: '4xx' | '5xx'; path: string; meta: string; count: string }[] = [
  { code: '500', klass: '5xx', path: '/api/checkout/confirm', meta: 'Internal server error · spiked 2:14am–2:19am', count: '41×' },
  { code: '404', klass: '4xx', path: '/tag/old-feature-name', meta: 'Removed blog tag, still linked externally', count: '312×' },
  { code: '404', klass: '4xx', path: '/favicon-old.ico', meta: 'Stale asset reference from a cached page', count: '88×' },
  { code: '502', klass: '5xx', path: '/api/search', meta: 'Upstream timeout, search index under load', count: '17×' },
  { code: '429', klass: '4xx', path: '/api/newsletter/subscribe', meta: 'Rate-limited — likely a bot retrying rapidly', count: '9×' },
];
export const JS_ERRORS = {
  count: '23',
  window: 'the last 24h',
  message: 'TypeError: cannot read properties of undefined',
  where: '/checkout',
  browser: 'Safari 15',
};

/* ── 15. API health ────────────────────────────────────────────── */

export const API_TITLE = 'API health';
export const API_SUBTITLE = 'The ingestion API that collects and powers everything above';
export const API_STATUS = 'Operational';
export const API_ENDPOINT = 'POST collect.yoursite.io/v1/events';
export const API_FUNNEL: { label: string; value: string; note: string; tone?: Tone }[] = [
  { label: 'Requests sent', value: '412,980', note: 'from visitor browsers, last 24h' },
  { label: 'Reached server', value: '411,560', note: '99.66% got to the API at all', tone: 'ok' },
  { label: 'Processed OK', value: '409,310', note: '99.45% success rate', tone: 'ok' },
  { label: 'Failed / timed out', value: '3,670', note: '0.89% — most never reached the server', tone: 'bad' },
];
export const API_TILES: { label: string; value: string; note: string; tone?: Tone }[] = [
  { label: 'Success rate', value: '99.45%', note: '409,310 of 411,560 requests', tone: 'ok' },
  { label: 'Timed out before server', value: '0.34%', note: '1,420 requests — client gave up, network/ad-blocker', tone: 'warn' },
  { label: 'Server-side errors', value: '0.55%', note: '2,250 requests — 5xx once request arrived', tone: 'bad' },
  { label: 'Avg. ingestion time', value: '62ms', note: 'p95: 184ms · p99: 410ms' },
];
export const API_NOTE = { throughput: '~287 req/min', peak: '1,340 req/min', queue: '0' };

/* ── 16. Real-time sitewide log ────────────────────────────────── */

export const LIVELOG_TITLE = 'Real-time sitewide log';
export const LIVELOG_SUBTITLE = 'Every event hitting the API, most recent first — last 60 minutes';
export const LIVELOG_FOOT = 'Scroll for more · entries older than 60 minutes roll off automatically';

export type LogKind = 'req' | 'conv' | 'err' | 'block';
export interface LogEvent {
  kind: LogKind;
  label: string;
  flag: string;
  lead: string;
  strong: string;
  tail: string;
  meta: string;
  ago: string;
}

// Deterministic stand-in for the mockup's random feed (no Math.random, so
// the markup is identical on every render). 55 events across the last hour.
function seeded(seed: number) {
  let s = seed >>> 0;
  return () => {
    s = (Math.imul(s, 1664525) + 1013904223) >>> 0;
    return s / 4294967296;
  };
}
function buildLiveLog(): LogEvent[] {
  const rnd = seeded(20261110);
  function pick<T>(arr: T[]): T {
    return arr[Math.floor(rnd() * arr.length)];
  }
  const paths = ['/pricing', '/checkout', '/blog/analytics-guide', '/product/starter-plan', '/', '/contact', '/api/checkout/confirm', '/dashboard', '/blog/scaling-tips', '/signup'];
  const flags = ['🇺🇸', '🇬🇧', '🇩🇪', '🇨🇦', '🇦🇺', '🇫🇷', '🇯🇵', '🇧🇷'];
  const browsers = ['Chrome', 'Safari', 'Firefox', 'Edge'];
  const devices = ['Desktop', 'Mobile', 'Tablet'];
  const kinds = [
    { weight: 55, kind: 'req' as LogKind, label: 'Page view' },
    { weight: 10, kind: 'conv' as LogKind, label: 'Goal' },
    { weight: 6, kind: 'err' as LogKind, label: 'Error' },
    { weight: 8, kind: 'block' as LogKind, label: 'Blocked' },
    { weight: 21, kind: 'req' as LogKind, label: 'Event' },
  ];
  const total = kinds.reduce((s, k) => s + k.weight, 0);
  const secs = Array.from({ length: 55 }, () => Math.floor(rnd() * 3600)).sort((a, b) => a - b);
  const rel = (d: number) => (d < 60 ? `${d}s ago` : `${Math.round(d / 60)}m ago`);

  return secs.map((d) => {
    let r = rnd() * total;
    let k = kinds[0];
    for (const c of kinds) {
      r -= c.weight;
      if (r <= 0) {
        k = c;
        break;
      }
    }
    const path = pick(paths);
    let lead = '';
    let strong = '';
    let tail = '';
    if (k.label === 'Page view') {
      lead = 'Page view · ';
      strong = path;
    } else if (k.label === 'Goal') {
      lead = 'Goal completed · ';
      strong = pick(['Checkout completed', 'Signup form submitted', 'Trial started']);
    } else if (k.label === 'Error') {
      lead = 'Server error · ';
      strong = '500';
      tail = ` on ${path}`;
    } else if (k.label === 'Blocked') {
      lead = 'Bot blocked · ';
      strong = path;
    } else {
      lead = 'Custom event · ';
      strong = pick(['Outbound click', 'Download', 'Video played', 'Search']);
    }
    return { kind: k.kind, label: k.label, flag: pick(flags), lead, strong, tail, meta: `${pick(devices)} · ${pick(browsers)}`, ago: rel(d) };
  });
}
export const LIVE_LOG: LogEvent[] = buildLiveLog();
