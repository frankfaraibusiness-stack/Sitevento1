// components/analytics/sections/analyticsTypes.ts
//
// View-model types and static copy shared by the Analytics sections. Every
// number a section shows is computed from real data in
// components/analytics/analyticsModel.ts — nothing in this file is sample data.

export type Dir = 'up' | 'down' | 'flat';
export type Tone = 'ok' | 'warn' | 'bad';

export interface Stat {
  label: string;
  value: string;
  note?: string;
  tone?: Tone | 'accent';
}

export interface RankedRow {
  label: string;
  title?: string;
  flag?: string;
  value: string;
  share?: string;
  pct?: number; // bar fill, 0–100
  sub?: string;
}

export interface TechRow {
  icon: string;
  label: string;
  hint?: string;
  value: string;
  pct: number;
}

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

export const PEOPLE_TITLE = 'What people do';
export const PEOPLE_SUBTITLE = 'Pages, sources and the devices they use';
export const PEOPLE_TABS = ['Pages', 'Entry pages', 'Referrers', 'Devices', 'Browsers', 'Systems', 'Languages', 'Cities'];

export const DEVICE_TITLE = 'Device experience';
export const DEVICE_SUBTITLE = 'Conversion, load time and exits, side by side';

export const JOURNEYS_TITLE = 'Visitor journeys';
export const JOURNEY_TABS = ['Most common', 'Led to a lead'];

export const REVENUE_TITLE = 'Revenue & profitability';
export const REVENUE_SUBTITLE = 'What you earn, what it costs and what you keep';
export const REVENUE_TABS = ['All revenue', 'SaaS subscriptions', 'Product sales'];

export const GOALS_TITLE = 'Goals & conversions';
export const GOALS_SUBTITLE = 'The outcomes that matter, confirmed by your server';

export const CAMPAIGNS_TITLE = 'Campaigns';
export const CAMPAIGNS_SUBTITLE = 'Where visitors come from and what they do next';
export const CAMPAIGN_TABS = ['Channels', 'Sources', 'Campaigns', 'Mediums'];

export const AUDIENCE_TITLE = 'Audience';
export const AUDIENCE_SUBTITLE = 'New vs returning visitors and how often they come back';

export const EVENTS_TITLE = 'Custom events';
export const EVENTS_NOTE = 'Things people do that you chose to track';
export const SEARCH_TITLE = 'Site search';
export const SEARCH_NOTE = 'What visitors look for';

export const RETENTION_TITLE = 'Retention';
export const RETENTION_SUBTITLE = 'Share of each week’s newcomers who come back';

export const SPEED_TITLE = 'Site speed';
export const SPEED_SUBTITLE = 'Core Web Vitals, field data from real visitors';

export const HEALTH_TITLE = 'Site health & system diagnostics';
export const HEALTH_SUBTITLE = 'Uptime, issues worth fixing and how people reach you';

export const API_TITLE = 'API health';
export const API_SUBTITLE = 'The events your backend sends us';

export const LIVELOG_TITLE = 'Real-time sitewide log';
export const LIVELOG_SUBTITLE = 'Everything happening on your site and backend, newest first';

export type GoalIcon = 'check' | 'send' | 'clock';
export type DiagIcon = 'warning' | 'clock' | 'layers';
