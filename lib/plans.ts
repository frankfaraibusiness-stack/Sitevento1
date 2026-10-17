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
// cap is GLOBAL PER SITE, not per plan tier distinctly — every plan
// that allows widgets at all caps concurrent live widgets at 3 per
// connected site. To enable a 4th, the site owner disables one of the
// existing 3 first. This mirrors how the dashboard's widget toggle
// list is expected to behave (see components/dashboard's widget
// panel) — "3 max live at a given time" per the product requirement.
//
// Total widget *catalog* limit (how many distinct widgets a site can
// have configured at all, live or paused) scales by plan and is PER
// CONNECTED SITE, not pooled across a user's whole account — a Pro
// Developer account with 30 sites gets up to 20 configured widgets on
// EACH of those 30 sites, not 20 total.

export type PlanId = 'free' | 'starter' | 'scale' | 'pro-developer';

export interface PlanLimits {
  /** Max sites this account can connect at once. */
  connectedSites: number;
  /** Max widgets configured (live + paused) per individual connected site. */
  widgetsPerSite: number;
  /** Max widgets allowed live/enabled at once per individual connected site. Flat across every paid tier. */
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
      canBlockVisitors: false,
      historyRetentionDays: 7,
      liveOverlays: false,
      teamSeats: 1,
      automation: false,
      automationRulesPerSite: 0,
      support: 'community',
    },
    highlights: [
      '1 connected site',
      '7-day visit history',
      'Up to 3 widgets configured per site',
      '3 live widgets at a time per site',
      'No visitor blocking',
      'No live overlays',
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
    price: 20,
    priceDisplay: '$20',
    tagline: 'For a growing site that needs real control.',
    description:
      'Unlocks visitor blocking, overlays, and unlimited visit history on up to 5 connected sites.',
    cta: 'Upgrade to Starter',
    featured: false,
    limits: {
      connectedSites: 5,
      widgetsPerSite: 10,
      liveWidgetsPerSite: 3,
      canBlockVisitors: true,
      historyRetentionDays: null,
      liveOverlays: true,
      teamSeats: 2,
      automation: true,
      automationRulesPerSite: 3,
      support: 'email',
    },
    highlights: [
      'Up to 5 connected sites',
      'Unlimited visit history',
      'Up to 10 widgets configured per site',
      '3 live widgets at a time per site',
      'Block visitors from the dashboard',
      'Live overlays & announcements',
      '2 team seats',
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
    price: 49.99,
    priceDisplay: '$49.99',
    tagline: 'For teams running a real portfolio of sites.',
    description:
      'Built for teams and agencies juggling up to 15 sites with more automation headroom and faster support.',
    cta: 'Upgrade to Scale',
    featured: true,
    limits: {
      connectedSites: 15,
      widgetsPerSite: 20,
      liveWidgetsPerSite: 3,
      canBlockVisitors: true,
      historyRetentionDays: null,
      liveOverlays: true,
      teamSeats: 5,
      automation: true,
      automationRulesPerSite: 10,
      support: 'priority',
    },
    highlights: [
      'Up to 15 connected sites',
      'Unlimited visit history',
      'Up to 20 widgets configured per site',
      '3 live widgets at a time per site',
      'Block visitors from the dashboard',
      'Live overlays & announcements',
      '10 automation rules per site',
      '5 team seats',
      'Priority support',
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
      liveWidgetsPerSite: 3,
      canBlockVisitors: true,
      historyRetentionDays: null,
      liveOverlays: true,
      teamSeats: 10,
      automation: true,
      automationRulesPerSite: 25,
      support: 'dedicated',
    },
    highlights: [
      'Up to 30 connected sites',
      'Unlimited visit history',
      'Up to 30 widgets configured per site',
      '3 live widgets at a time per site',
      'Block visitors from the dashboard',
      'Live overlays & announcements',
      '25 automation rules per site',
      '10 team seats',
      'Dedicated support',
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

// The live-widget cap is intentionally the same across every tier
// (free included) — it's a product constraint, not a monetization
// lever: 3 widgets rendering on one page at once is already a lot for
// an end visitor to see. What scales with plan is how many widgets
// can be *configured and parked* on a site (so switching which 3 are
// live is instant) and how many *sites* can each have their own 3.
export const MAX_LIVE_WIDGETS_PER_SITE = 3;
