// lib/monetization.ts
//
// Shared shape + constants for the Monetization feature
// (/dashboard/monetization — components/monetization/MonetizationDashboard.tsx,
// the .mon2-prefixed rebuild). Mirrors lib/agent.ts's "single source
// of truth for the Firestore shape" role.
//
// ── Approval model ──────────────────────────────────────────────────
// No manual review step: a site is eligible to monetize the instant
// it's verified (Site.status === 'verified', same gate the widgets
// and agent features already use — see app/api/site-widget/route.ts's
// checkLiveStatus). Turning the feature on for a verified site is
// therefore "instantly approved" by construction, not a separate
// approval flag that could lag behind verification.
// AdFormatId import below is deliberately typed rather than this
// file growing its own separate format-id list — lib/adPool.ts's
// AD_FORMAT_IDS is the single source of truth for which ids are
// valid (what /api/ad-serve and /api/ad-track actually key off), and
// AD_TYPES' `id` fields below are expected to line up with it 1:1.
import type { AdFormatId } from './adPool';

export interface MonetizationConfig {
  enabled: boolean;
  // Per-format on/off, persisted — see
  // components/monetization/MonetizationAdTypeSettings.tsx and
  // app/api/site-monetization/route.ts. Partial + optional because a
  // format with no entry yet (every existing site, until the grid is
  // first saved) falls back to that format's AdTypeDef.defaultEnabled
  // below, not to `false` — an absent key is "never configured," not
  // "explicitly turned off."
  adFormats?: Partial<Record<AdFormatId, boolean>>;
  // Max number of full-screen (interstitial/overlay) or popup ads a
  // single visitor is shown per day — the "Max full-screen and popup
  // ads per visitor each day" control on the Monetization dashboard
  // (MonetizationAdTypeSettings.tsx). Additive field, same optional/
  // merge-write handling as adFormats above; a site with no value yet
  // falls back to DEFAULT_FREQ_CAP, not 0.
  freqCap?: number;
}

export const DEFAULT_MONETIZATION_CONFIG: MonetizationConfig = {
  enabled: false,
};

export const DEFAULT_FREQ_CAP = 3;
export const FREQ_CAP_OPTIONS = [1, 2, 3, 5] as const;

// Flat headline number used in marketing/benefits copy elsewhere in
// the app — not a contractual rate. Centralized here so the figure
// can't drift between callers.
export const TIER1_AVG_CPM_USD = 3;

// ── Ad pool types ───────────────────────────────────────────────────
// The catalog of ad FORMATS a site owner can opt into
// (components/monetization/MonetizationAdTypeSettings.tsx), each
// backed by real serving/billing in app/api/ad-serve and
// app/api/ad-track. MonetizationConfig.adFormats (above) is where a
// site's actual selection persists, one key per `id` below.
export interface AdTypeDef {
  id: string;
  label: string;
  description: string;
  defaultEnabled: boolean;
}

export const AD_TYPES: AdTypeDef[] = [
  {
    id: 'banner',
    label: 'Banner',
    description: 'Slim ad strip docked to the top or bottom of the page. Lowest friction, steady fill rate.',
    defaultEnabled: true,
  },
  {
    id: 'sticky-footer',
    label: 'Sticky footer',
    description: 'Stays pinned to the bottom of the viewport while visitors scroll. Good visibility without covering content.',
    defaultEnabled: true,
  },
  {
    id: 'interstitial',
    label: 'Interstitial',
    description: 'Shown between page transitions or on a timer. Higher CPM, moderate frequency cap recommended.',
    defaultEnabled: true,
  },
  {
    id: 'popup',
    label: 'Popup',
    description: 'A dismissible window layered over the page content, triggered by a scroll depth or exit intent.',
    defaultEnabled: false,
  },
  {
    id: 'overlay',
    label: 'Full-screen overlay',
    description: 'Covers the entire viewport before letting the visitor continue. Highest CPM, use sparingly.',
    defaultEnabled: false,
  },
];
