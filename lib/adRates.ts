// lib/adRates.ts
//
// The real, production rate card for the ad pool: per-country CPM
// pricing (not a single fixed number), a fixed-rate CPC, and the
// platform/publisher revenue split. This is the schema piece the ad
// pool, ad-serving pipeline and event-tracking/billing routes all
// build on top of — see lib/monetization.ts's AD_TYPES (ad *formats*,
// separate from country *pricing*) and lib/countries.ts (the
// ISO 3166-1 alpha-2 codes this file keys off, same codes already
// written to Visit.country by /api/track's geo lookup).
//
// ── Why per-country, not one flat number ─────────────────────────────
// A single global CPM was never realistic: a USA impression and a
// Burundi impression are not worth the same to an advertiser. Real ad
// networks price by buyer demand per geography, which roughly tracks
// that country's online ad market maturity. This file hard-codes a
// defensible tier table (sourced from how real ad networks bucket
// country demand — North America/UK/Scandinavia highest, Western
// Europe/Oceania high, Eastern Europe/Latin America/Gulf mid, South/
// Southeast Asia and Sub-Saharan Africa lower) rather than inventing
// one number per country, since nobody has real buyer-demand data for
// an ad pool that hasn't served a single impression yet. It's a
// starting point meant to be replaced by observed fill rates once
// real advertiser spend exists (see "Future: demand-driven pricing"
// below) — but it's priced like a real network's rate card, not a
// placeholder.
//
// ── CPM vs CPC ─────────────────────────────────────────────────────
// CPM (cost per 1000 impressions) is country-tiered and variable —
// see CPM_TIERS / COUNTRY_CPM_TIER below.
// CPC (cost per click) is flat and NOT country-tiered: CPC_USD.
// Real ad networks do vary CPC by geo too, but the user's instruction
// here was explicit and unambiguous ("for clicks we pay $0.005 per
// click its fixed") — unlike the CPM instruction, which explicitly
// asked for the opposite of fixed. Flagging the asymmetry rather than
// quietly "fixing" it to match CPM's pattern.
//
// ── What counts toward these rates ────────────────────────────────
// CPM only pays for VALID views (see validity/fraud-filtering, to be
// implemented in the event-tracking route per the still-open questions
// in the original handoff — rate-limiting, dwell time, bot filtering,
// self-view detection, etc.). An invalid/filtered impression earns
// nothing and isn't counted in blended-rate math. CPC is likewise only
// for valid, attributed clicks.
//
// ── Revenue split ──────────────────────────────────────────────────
// Flat 50/50 everywhere — same percentage for every country and every
// ad format (banner, popup, overlay, etc). Publisher payout per valid
// impression = (advertiser's effective CPM for that impression's
// country / 1000) * PLATFORM_REVENUE_SHARE.publisher. Same formula for
// clicks, using CPC_USD instead of a CPM. See PLATFORM_REVENUE_SHARE
// below — it's a named constant specifically so the split is a single
// place to tune later, not scattered through billing code as a
// literal `0.5`.
//
// ── "The final rate is an average when all countries are combined" ──
// This is per-ad, computed from real traffic, not a stored number:
// an ad's blended/effective CPM = (sum of each valid impression's
// own country rate) / (count of valid impressions) * 1000. Each
// impression is valued at ITS OWN country's rate — a US view pays the
// US rate, a Kenya view pays the Kenya rate — and a publisher's total
// payout is the sum of their own impressions' own-country payouts.
// This is NOT one blended average rate applied uniformly to every
// impression regardless of where it came from (that would misprice
// every individual view and make per-publisher, per-country reporting
// impossible). getBlendedCpm() below computes this average from an
// impression country-count breakdown, for display purposes only
// (e.g. "this ad's effective CPM so far: $1.84") — it is never used
// as an input to any individual payout calculation.
//
// ── Fallback ──────────────────────────────────────────────────────
// If a view's country can't be resolved/validated (geo lookup failure,
// missing header, code not in lib/countries.ts's COUNTRIES list), it
// still counts as a valid impression (assuming it passes fraud
// filtering) but is priced at FALLBACK_CPM_USD rather than dropped —
// advertisers still get the delivery, publishers still get paid, just
// at the conservative floor rate rather than a guessed-at tier.

import { isValidCountryCode } from './countries';

// ── Revenue split ─────────────────────────────────────────────────
// Single source of truth for the platform/publisher cut. Flat across
// every country and every ad format — do not branch this by format or
// geography without updating this file's header comment, since every
// payout calculation in the ad pipeline is meant to read this constant
// rather than hard-code a percentage inline.
export const PLATFORM_REVENUE_SHARE = {
  platform: 0.5,
  publisher: 0.5,
} as const;

// ── CPC (cost per click) ───────────────────────────────────────────
// Fixed, not country-tiered, per explicit instruction. Entire amount
// still runs through PLATFORM_REVENUE_SHARE same as CPM.
export const CPC_USD = 0.005;

// ── CPM fallback ────────────────────────────────────────────────────
// Advertiser-facing floor used when a view's country can't be resolved
// or validated. Deliberately the lowest tier floor (see AF tier below)
// rather than a mid-tier guess — an unresolved country shouldn't be
// priced as if it were premium traffic.
export const FALLBACK_CPM_USD = 0.5;

// ── Country CPM tiers ───────────────────────────────────────────────
// Each tier is an advertiser-facing CPM *range* (floor/ceiling), not a
// single number — real campaigns vary within a country by targeting,
// seasonality and advertiser demand, so the ad-serving/billing layer
// picks a rate inside the tier's range rather than treating the tier
// as one fixed price. getCpmRange() below resolves a country to its
// range; getEffectiveCpm() resolves it to one representative number
// (the tier's midpoint) for cases that need a single figure, such as a
// pre-campaign cost estimate shown to an advertiser before they set
// their own bid. An advertiser who explicitly sets their own CPM bid
// (see app/dashboard/advertise, not yet built) for a campaign is
// always charged THEIR bid, not this table — this table is what the ad
// pool/estimator falls back to when the advertiser hasn't (or can't)
// set a per-country bid of their own, and is the basis for the
// publisher-facing payout math describe above.
export type CpmTier = 'premium' | 'high' | 'mid' | 'emerging' | 'frontier';

export interface CpmRange {
  tier: CpmTier;
  minUsd: number;
  maxUsd: number;
}

export const CPM_TIERS: Record<CpmTier, CpmRange> = {
  // Top-tier English-speaking + Nordic markets. Highest advertiser
  // demand, most mature programmatic ad buying.
  premium: { tier: 'premium', minUsd: 0.9, maxUsd: 1.5 },
  // Rest of Western/Northern Europe, Gulf high-income, East Asia
  // developed markets.
  high: { tier: 'high', minUsd: 0.6, maxUsd: 0.95 },
  // Eastern Europe, Latin America, parts of the Middle East.
  mid: { tier: 'mid', minUsd: 0.4, maxUsd: 0.7 },
  // South/Southeast Asia, North Africa, most of Sub-Saharan Africa —
  // the range the user specified explicitly for African countries.
  emerging: { tier: 'emerging', minUsd: 0.3, maxUsd: 0.6 },
  // Lowest-demand markets; still priced above the no-data fallback
  // since a resolved low-tier country is still worth more to an
  // advertiser than an unresolved one.
  frontier: { tier: 'frontier', minUsd: 0.2, maxUsd: 0.45 },
};

// Country -> tier. Not every code in lib/countries.ts needs an entry —
// COUNTRY_TIER_FALLBACK below covers anything missing, so this map
// only needs to list where a country's real tier differs from that
// default. Every code actually listed here must exist in
// lib/countries.ts's COUNTRIES (enforced by the self-check at the
// bottom of this file, run once at module load in dev).
const COUNTRY_CPM_TIER: Record<string, CpmTier> = {
  // ── premium ── North America, UK, Scandinavia, Oceania
  US: 'premium', CA: 'premium', GB: 'premium', AU: 'premium', NZ: 'premium',
  NO: 'premium', SE: 'premium', DK: 'premium', CH: 'premium', LU: 'premium',

  // ── high ── Western/Northern Europe, developed East Asia, high-income Gulf
  DE: 'high', FR: 'high', NL: 'high', BE: 'high', AT: 'high', IE: 'high',
  FI: 'high', IS: 'high', IT: 'high', ES: 'high', JP: 'high', KR: 'high',
  SG: 'high', HK: 'high', AE: 'high', QA: 'high', IL: 'high', MT: 'high',

  // ── mid ── Eastern Europe, Latin America, broader Middle East
  PL: 'mid', CZ: 'mid', PT: 'mid', GR: 'mid', HU: 'mid', RO: 'mid',
  BG: 'mid', HR: 'mid', SK: 'mid', SI: 'mid', EE: 'mid', LV: 'mid', LT: 'mid',
  BR: 'mid', MX: 'mid', CL: 'mid', AR: 'mid', UY: 'mid', CR: 'mid', PA: 'mid',
  TR: 'mid', SA: 'mid', KW: 'mid', BH: 'mid', OM: 'mid',
  CN: 'mid', TW: 'mid', MY: 'mid', RU: 'mid',

  // ── emerging ── South/Southeast Asia, Sub-Saharan Africa, North Africa
  IN: 'emerging', PH: 'emerging', ID: 'emerging', TH: 'emerging', VN: 'emerging',
  BD: 'emerging', PK: 'emerging', LK: 'emerging',
  ZA: 'emerging', NG: 'emerging', KE: 'emerging', GH: 'emerging', EG: 'emerging',
  MA: 'emerging', TN: 'emerging', CI: 'emerging', SN: 'emerging', RW: 'emerging',
  BW: 'emerging', NA: 'emerging', TZ: 'emerging',
  CO: 'emerging', PE: 'emerging', EC: 'emerging', DO: 'emerging', GT: 'emerging',

  // ── frontier ── lowest-demand resolved markets
  ET: 'frontier', UG: 'frontier', ZM: 'frontier', ZW: 'frontier', MZ: 'frontier',
  MW: 'frontier', MG: 'frontier', BJ: 'frontier', BF: 'frontier', ML: 'frontier',
  NE: 'frontier', TD: 'frontier', SD: 'frontier', SS: 'frontier', SO: 'frontier',
  CD: 'frontier', CG: 'frontier', CM: 'frontier', GN: 'frontier', SL: 'frontier',
  LR: 'frontier', TG: 'frontier', GM: 'frontier', MR: 'frontier', AO: 'frontier',
  BI: 'frontier', ER: 'frontier', DJ: 'frontier', KM: 'frontier', LS: 'frontier',
  SZ: 'frontier', GW: 'frontier', CF: 'frontier', GA: 'frontier', CV: 'frontier',
  AF: 'frontier', NP: 'frontier', KH: 'frontier', LA: 'frontier', MM: 'frontier',
  YE: 'frontier', SY: 'frontier', HT: 'frontier', NI: 'frontier', HN: 'frontier',
  BO: 'frontier', PY: 'frontier',
};

// Any resolved, valid country code NOT listed above (long tail of
// small/unlisted markets) lands here rather than silently defaulting
// to FALLBACK_CPM_USD — a resolved country is still worth more
// confidence than "unresolved," so it gets priced, just at the lowest
// paid tier.
const COUNTRY_TIER_DEFAULT: CpmTier = 'frontier';

export function getCountryTier(countryCode: string | null | undefined): CpmTier | null {
  if (!countryCode || !isValidCountryCode(countryCode)) return null;
  return COUNTRY_CPM_TIER[countryCode] ?? COUNTRY_TIER_DEFAULT;
}

export function getCpmRange(countryCode: string | null | undefined): CpmRange {
  const tier = getCountryTier(countryCode);
  if (!tier) {
    // Unresolved/invalid country code -> flat fallback, not a tier
    // range (there's nothing to range over with no geo signal).
    return { tier: 'frontier', minUsd: FALLBACK_CPM_USD, maxUsd: FALLBACK_CPM_USD };
  }
  return CPM_TIERS[tier];
}

// Single representative number for a country: the tier's midpoint.
// Used for upfront cost estimates and anywhere a single figure (not a
// range) is needed, e.g. "average cost in this country: $X CPM" shown
// to an advertiser before they set a bid. Never used to price an
// individual impression/payout — see getEffectiveCpmForImpression.
export function getEffectiveCpm(countryCode: string | null | undefined): number {
  const range = getCpmRange(countryCode);
  if (range.minUsd === range.maxUsd) return range.minUsd; // fallback case
  return Math.round(((range.minUsd + range.maxUsd) / 2) * 100) / 100;
}

// ── Per-impression pricing ─────────────────────────────────────────
// What a single valid impression is actually worth, for billing. If
// the campaign/ad carries an advertiser-set CPM bid, that bid is
// authoritative (advertisers are charged what they agreed to pay,
// full stop) — this table only fills in when there is no bid to use,
// i.e. for the free-tier/estimate ad-pool rate. `advertiserBidCpmUsd`
// is optional specifically so callers without a real ad/bid object yet
// (early pipeline stages, tests, the estimator) can omit it.
export function getEffectiveCpmForImpression(params: {
  countryCode: string | null | undefined;
  advertiserBidCpmUsd?: number | null;
}): number {
  const { countryCode, advertiserBidCpmUsd } = params;
  if (typeof advertiserBidCpmUsd === 'number' && advertiserBidCpmUsd > 0) {
    return advertiserBidCpmUsd;
  }
  return getEffectiveCpm(countryCode);
}

// Publisher payout for one valid impression, in USD. Always the full
// per-impression CPM / 1000, scaled by the publisher's revenue share —
// never a blended/average rate (see header comment).
export function getPublisherPayoutForImpression(params: {
  countryCode: string | null | undefined;
  advertiserBidCpmUsd?: number | null;
}): number {
  const cpm = getEffectiveCpmForImpression(params);
  return (cpm / 1000) * PLATFORM_REVENUE_SHARE.publisher;
}

// Publisher payout for one valid click, in USD. CPC is flat, so this
// is just CPC_USD * publisher share — no country lookup involved.
export function getPublisherPayoutForClick(): number {
  return CPC_USD * PLATFORM_REVENUE_SHARE.publisher;
}

// ── Blended/effective rate (reporting only) ────────────────────────
// Computes an ad's or a site's overall effective CPM from an observed
// breakdown of valid-impression counts by country. This is a DISPLAY
// figure ("your average CPM this month: $0.84") derived AFTER the
// fact from real per-impression pricing — it is never fed back in as
// an input to price any individual impression or payout. See header
// comment for why.
export function getBlendedCpm(
  countryImpressionCounts: Record<string, number>,
  advertiserBidCpmUsd?: number | null
): number {
  const entries = Object.entries(countryImpressionCounts).filter(([, n]) => n > 0);
  const totalImpressions = entries.reduce((sum, [, n]) => sum + n, 0);
  if (totalImpressions === 0) return 0;

  const totalRevenueUsd = entries.reduce((sum, [countryCode, n]) => {
    const cpm = getEffectiveCpmForImpression({ countryCode, advertiserBidCpmUsd });
    return sum + (cpm / 1000) * n;
  }, 0);

  return Math.round((totalRevenueUsd / totalImpressions) * 1000 * 100) / 100;
}

// ── Future: demand-driven pricing ──────────────────────────────────
// Once the ad pool has real advertiser spend and fill-rate data, these
// hard-coded tiers should be replaced (or overridden) by observed
// per-country clearing prices — e.g. a scheduled job that recomputes
// COUNTRY_CPM_TIER (or a parallel observed-rate table) from actual
// winning bids over a trailing window. Not built here: there's no
// billing/bidding system yet for it to observe (see original handoff's
// open billing questions) — this file is the static starting rate
// card that system would eventually learn to replace.

// ── Dev-time self-check ─────────────────────────────────────────────
// Every code hard-coded into COUNTRY_CPM_TIER must be a real,
// recognized code from lib/countries.ts — catches typos immediately
// instead of silently mispricing a country at the default tier.
if (process.env.NODE_ENV !== 'production') {
  const unknown = Object.keys(COUNTRY_CPM_TIER).filter((code) => !isValidCountryCode(code));
  if (unknown.length > 0) {
    throw new Error(
      `lib/adRates.ts: COUNTRY_CPM_TIER has code(s) not present in lib/countries.ts: ${unknown.join(', ')}`
    );
  }
}
