// lib/monetization.ts
//
// Shared shape + constants for the Monetization feature (quick tools
// grid -> /dashboard/monetization). Deliberately tiny right now: this
// pass only ships the on/off switch and its full-screen upsell gate
// (see MonetizationUpsellOverlay.tsx) — the actual earnings
// dashboard/placement controls aren't built yet, so there's no config
// here beyond the single `enabled` flag. Mirrors lib/agent.ts's
// "single source of truth for the Firestore shape" role, scaled down
// to match how little exists so far.
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
  // components/monetization/MonetizationAdTypeGrid.tsx and
  // app/api/site-monetization/route.ts. Partial + optional because a
  // format with no entry yet (every existing site, until the grid is
  // first saved) falls back to that format's AdTypeDef.defaultEnabled
  // below, not to `false` — an absent key is "never configured," not
  // "explicitly turned off."
  adFormats?: Partial<Record<AdFormatId, boolean>>;
}

export const DEFAULT_MONETIZATION_CONFIG: MonetizationConfig = {
  enabled: false,
};

// Flat headline number shown on the upsell (benefits copy, not a
// contractual rate — see MonetizationUpsellOverlay.tsx). Centralized
// here so the figure can't drift between the overlay and wherever the
// real earnings dashboard eventually surfaces it.
export const TIER1_AVG_CPM_USD = 3;

// ── Ad pool types ───────────────────────────────────────────────────
// The actual ad pool (which banners/overlays/popups get served, their
// creative, targeting, etc.) doesn't exist yet — this is just the
// catalog of FORMATS a site owner can opt into once it does, shown as
// toggles on the dashboard (MonetizationAdTypeGrid.tsx). Each entry's
// `enabled` default lives only in that component's local state for
// now (see its header comment) — once the real ad pool ships, this
// list is what MonetizationConfig grows an `adTypes: Record<string,
// boolean>`-shaped field to persist, one key per `id` below.
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
