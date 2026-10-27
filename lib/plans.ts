// lib/plans.ts
//
// Single source of truth for sitevento's plan catalog. Pricing copy
// (components/marketing/Pricing.tsx), the pricing/product SEO pages
// under app/(marketing pages), and — once billing exists — the actual
// enforcement in app/api/widget/route.ts and the dashboard should all
// read from here rather than hardcoding numbers in three places that
// quietly drift out of sync.
//
// Live-widget limit: a "live" widget is one currently enabled and
// rendering on a given connected site (e.g. a contact-chat widget and
// an email-capture widget both switched on at once = 2 live). This
// cap now SCALES BY PLAN (it used to be a flat 3 across every tier —
// see lib/limits.ts's WIDGET_LIVE_LIMITS, the single source of truth
// for these numbers; the values below are kept in sync with it):
// Free 3, Starter 5, Scale 10, Pro Developer 15. To enable one more
// than the cap, the site owner disables an existing live widget first.
//
// Total widget *catalog* limit (how many distinct widgets a site can
// have configured at all, live or paused) scales by plan and is PER
// CONNECTED SITE, not pooled across a user's whole account — a Pro
// Developer account with 30 sites gets up to 20 configured widgets on
// EACH of those 30 sites, not 20 total.
//
// Daily write limit: lives ONLY in lib/limits.ts's
// DEFAULT_DAILY_WRITE_LIMITS (also client-safe, no firebase-admin
// import) — lib/serverAuth.ts enforces it, and client components
// (PlansPage, /pricing) call dailyWriteLimit(planId) from there
// directly instead of this file keeping its own copy. This file used
// to duplicate those numbers in `limits.dailyWrites`, which drifted
// out of sync with the real table (200/2k/10k/null here vs the
// enforced 1k/10k/100k/1M) — removed for good so there's exactly one
// place these numbers can live.

export type PlanId = 'free' | 'starter' | 'scale' | 'pro-developer';

export interface PlanLimits {
  /** Max sites this account can connect at once. */
  connectedSites: number;
  /** Max widgets configured (live + paused) per individual connected site. */
  widgetsPerSite: number;
  /** Max widgets allowed live/enabled at once per individual connected site. Scales by plan — see lib/limits.ts's WIDGET_LIVE_LIMITS. */
  liveWidgetsPerSite: number;
  /** Whether this plan can block individual visitors from the dashboard. */
  canBlockVisitors: boolean;
  /** Visit-history retention window, in days. null = unlimited. */
  historyRetentionDays: number | null;
  /** Can push live full-screen overlays (announcement/maintenance banners). */
  liveOverlays: boolean;
  /** Max team seats with dashboard access. */
  teamSeats: number;
  /** Can automation rules (e.g. auto-block, scheduled overlays) be used. */
  automation: boolean;
  /** Max automation rules configured per connected site. */
  automationRulesPerSite: number;
  /** Support tier. */
  support: 'community' | 'email' | 'priority' | 'dedicated';
  /** Whether this plan can upload a custom logo image to replace the
   *  text branding shown on a widget (lib/widgets.ts's brandMode
   *  'logo' option). Text branding is available on every plan. */
  customLogoBranding: boolean;
}

export interface Plan {
  id: PlanId;
  name: string;
  price: number; // USD/mo, 0 for free
  priceDisplay: string;
  tagline: string;
  description: string;
  cta: string;
  featured: boolean;
  limits: PlanLimits;
  /** Full list, used on the dedicated /pricing page. */
  highlights: string[];
  /** Short 4-item list, used on the homepage pricing cards. */
  cardHighlights: string[];
}

export const PLANS: Plan[] = [
  {
    id: 'free',
    name: 'Free',
    price: 0,
    priceDisplay: '$0',
    tagline: 'Get one site live and see real data in minutes.',
    description:
      'For trying sitevento on a single site before rolling it out further. Full visit logging and one widget, no credit card.',
    cta: 'Start free',
    featured: false,
    limits: {
      connectedSites: 1,
      widgetsPerSite: 3,
      liveWidgetsPerSite: 3,
      canBlockVisitors: false, // Free gets a 3/day visitor-block trial instead — see lib/limits.ts FEATURE_LIMITS['visitor-access-control'].
      historyRetentionDays: 7,
      liveOverlays: false,
      teamSeats: 1,
      automation: false,
      automationRulesPerSite: 0,
      customLogoBranding: false,
      support: 'community',
    },
    highlights: [
      '1 connected site',
      '7-day visit history',
      'Up to 3 widgets configured per site',
      '3 live widgets at a time per site',
      'Try visitor blocking (3/day trial)',
      'No live overlays — upgrade to Starter to unlock',
      '1,000 writes/day account-wide',
    ],
    cardHighlights: [
      '1 connected site',
      '7-day visit history',
      '3 live widgets per site',
      'Community support',
    ],
  },
  {
    id: 'starter',
    name: 'Starter',
    price: 19,
    priceDisplay: '$19',
    tagline: 'For a growing site that needs real control.',
    description:
      'Unlocks visitor blocking, overlays, and unlimited visit history on up to 5 connected sites.',
    cta: 'Upgrade to Starter',
    featured: false,
    limits: {
      connectedSites: 5,
      widgetsPerSite: 10,
      liveWidgetsPerSite: 5,
      canBlockVisitors: true,
      historyRetentionDays: null,
      liveOverlays: true,
      teamSeats: 2,
      automation: true,
      automationRulesPerSite: 3,
      customLogoBranding: false,
      support: 'email',
    },
    highlights: [
      'Up to 5 connected sites (vs 1 on Free)',
      'Unlimited visit history (vs 7 days on Free)',
      'Up to 10 widgets configured per site',
      '5 live widgets at a time per site',
      'Full visitor blocking, no daily cap',
      'Live overlays & announcements — unlocked',
      '3 automation rules per site',
      '2 team seats',
      '10,000 writes/day account-wide',
      'No automation or custom branding yet — see Scale',
    ],
    cardHighlights: [
      'Up to 5 connected sites',
      'Unlimited visit history',
      'Visitor blocking & overlays',
      '2 team seats',
    ],
  },
  {
    id: 'scale',
    name: 'Scale',
    price: 49,
    priceDisplay: '$49',
    tagline: 'For teams running a real portfolio of sites.',
    description:
      'Built for teams and agencies juggling up to 15 sites with more automation headroom and faster support.',
    cta: 'Upgrade to Scale',
    featured: true,
    limits: {
      connectedSites: 15,
      widgetsPerSite: 20,
      liveWidgetsPerSite: 10,
      canBlockVisitors: true,
      historyRetentionDays: null,
      liveOverlays: true,
      teamSeats: 5,
      automation: true,
      automationRulesPerSite: 10,
      customLogoBranding: true,
      support: 'priority',
    },
    highlights: [
      'Up to 15 connected sites (3x Starter)',
      'Unlimited visit history',
      'Up to 20 widgets configured per site',
      '10 live widgets at a time per site',
      'Full visitor blocking, no daily cap',
      'Live overlays & announcements',
      '10 automation rules per site — unlocked',
      'Custom logo branding — unlocked',
      '5 team seats (vs 2 on Starter)',
      'Priority support',
      '100,000 writes/day account-wide',
    ],
    cardHighlights: [
      'Up to 15 connected sites',
      '10 automation rules per site',
      '5 team seats',
      'Priority support',
    ],
  },
  {
    id: 'pro-developer',
    name: 'Pro Developer',
    price: 99,
    priceDisplay: '$99',
    tagline: 'For agencies and developers managing sites at scale.',
    description:
      'The top tier: up to 30 connected sites, the deepest widget and automation headroom, and dedicated support for teams that live in the dashboard.',
    cta: 'Go Pro Developer',
    featured: false,
    limits: {
      connectedSites: 30,
      widgetsPerSite: 30,
      liveWidgetsPerSite: 15,
      canBlockVisitors: true,
      historyRetentionDays: null,
      liveOverlays: true,
      teamSeats: 10,
      automation: true,
      automationRulesPerSite: 25,
      customLogoBranding: true,
      support: 'dedicated',
    },
    highlights: [
      'Up to 30 connected sites (2x Scale)',
      'Unlimited visit history',
      'Up to 30 widgets configured per site',
      '15 live widgets at a time per site',
      'Unlimited visitor blocking',
      'Live overlays & announcements',
      '25 automation rules per site',
      '10 team seats',
      'Dedicated support',
      '1,000,000 writes/day account-wide',
    ],
    cardHighlights: [
      'Up to 30 connected sites',
      '25 automation rules per site',
      '10 team seats',
      'Dedicated support',
    ],
  },
];

export function getPlan(id: PlanId): Plan {
  const plan = PLANS.find((p) => p.id === id);
  if (!plan) throw new Error(`Unknown plan id: ${id}`);
  return plan;
}

// DEPRECATED: the live-widget cap used to be a flat 3 across every
// tier. It now scales by plan — see lib/limits.ts's WIDGET_LIVE_LIMITS
// (the real source of truth) and each plan's `limits.liveWidgetsPerSite`
// above. This constant is kept only so nothing importing the old flat
// number at build time breaks; it equals the FREE plan's cap. Prefer
// `getPlan(planId).limits.liveWidgetsPerSite` or
// `liveWidgetLimit(planId)` from lib/limits.ts in new code.
export const MAX_LIVE_WIDGETS_PER_SITE = 3;
