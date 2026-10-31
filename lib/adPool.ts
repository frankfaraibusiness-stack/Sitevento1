// lib/adPool.ts
//
// Shared shape + validation for the ad pool: ads an advertiser creates
// on /dashboard/advertise (not yet built — this is its backend) that
// get served on OTHER users' sites through /api/ad-serve, tracked by
// /api/ad-track, and priced with lib/adRates.ts. This is the schema
// everything downstream (the advertise route, the serving route, the
// tracking/billing route) imports from — mirrors lib/widgets.ts's role
// as "single source of truth for a Firestore shape + its validators"
// for the existing (first-party) widget system, scaled to a
// cross-account (one user's ad, many other users' sites) model instead.
//
// ── Where ads live ───────────────────────────────────────────────────
// Top-level `adPool` collection (NOT nested under users/{uid}/sites/
// {siteId} the way widgets/overlays are) — an ad has exactly one owner
// (the advertiser) but is served across potentially many OTHER
// people's sites, so nesting it under any one site would be wrong by
// construction. Mirrors the existing `siteIndex` top-level-collection
// pattern (flat lookup, not nested) for the same reason: the thing
// being looked up doesn't belong to a single site.
//   adPool/{adId}                         — AdDoc (this file)
//   adPool/{adId}/events/{autoId}         — raw impression/click log,
//                                            written by /api/ad-track,
//                                            used for fraud review/
//                                            appeals (see lib/adEvents.ts)
//   users/{uid}/advertiserAccount/billing — AdvertiserBillingDoc:
//                                            this file, the advertiser's
//                                            prepaid balance ledger
//   users/{uid}/sites/{siteId}/adEarnings/{day}
//                                          — PublisherDayEarnings:
//                                            this file, a publisher's
//                                            per-day earnings from
//                                            hosting ads on this site
//
// ── Approval model ───────────────────────────────────────────────────
// Auto-live, no manual review (matches lib/monetization.ts's existing
// "instantly eligible once verified" model, not a new pattern). An ad
// goes to 'live' the moment it's created, PROVIDED the owner's site
// that's advertising... wait, no — an ad has no "site" of its own, it
// just needs: (1) the advertiser's account has SOME positive prepaid
// balance (an ad with $0 balance is created but immediately
// 'out_of_budget', not 'live' — it just never serves, same honesty
// pattern as site-widget's liveStatus check), and (2) the creative
// passes the format-specific required-field validation in this file.
// No human reviews anything before an ad can start serving.
import { isValidCountryCode } from './countries';

export const AD_FORMAT_IDS = ['banner', 'sticky-footer', 'interstitial', 'popup', 'overlay'] as const;
export type AdFormatId = (typeof AD_FORMAT_IDS)[number];

export function isValidAdFormatId(value: unknown): value is AdFormatId {
  return typeof value === 'string' && (AD_FORMAT_IDS as readonly string[]).includes(value);
}

// 'banner' = image creative + link. 'link' = headline/body text + link,
// no image (lowest-friction to create, no upload needed). 'text' =
// same as link but with no outbound destination required — e.g. a
// brand-awareness message with no click-through. Distinct from
// AdFormatId above: AdFormatId is the on-site PLACEMENT/format a
// publisher opts into (banner strip vs popup vs overlay, etc — purely
// presentational, lib/monetization.ts's AD_TYPES); AdCreativeType is
// what KIND of creative the advertiser supplied. Any creative type can
// be rendered into any placement format — a text-only creative can
// still fill a 'banner' placement slot, it just renders as styled text
// instead of an <img>.
export const AD_CREATIVE_TYPES = ['banner', 'link', 'text'] as const;
export type AdCreativeType = (typeof AD_CREATIVE_TYPES)[number];

export function isValidAdCreativeType(value: unknown): value is AdCreativeType {
  return typeof value === 'string' && (AD_CREATIVE_TYPES as readonly string[]).includes(value);
}

// 'live': serving normally. 'paused': advertiser-initiated stop, same
// semantics as Site.paused — creative + budget intact, just not
// currently eligible to be picked by /api/ad-serve. 'out_of_budget':
// system-set when balanceUsd hits 0 (see debitAdvertiserBalance in
// the ad-track route) — distinct from 'paused' so the dashboard can
// show "add funds to resume" rather than a generic paused state, and
// so topping up the balance can auto-resume it without the advertiser
// re-toggling anything. 'draft': creative saved but never activated
// (not currently reachable from the auto-live creation flow below,
// reserved for a future "save without publishing" action).
export const AD_STATUSES = ['draft', 'live', 'paused', 'out_of_budget'] as const;
export type AdStatus = (typeof AD_STATUSES)[number];

export function isValidAdStatus(value: unknown): value is AdStatus {
  return typeof value === 'string' && (AD_STATUSES as readonly string[]).includes(value);
}

export interface AdCreative {
  type: AdCreativeType;
  // Required for type 'banner'. A Firebase Storage download URL — see
  // app/api/advertise/route.ts's header for why upload is out of scope
  // for this pass (no upload pipeline exists anywhere in this repo
  // yet); for now the advertiser pastes an already-hosted image URL.
  imageUrl?: string;
  // Required for 'banner' and 'link'; omitted/ignored for 'text' (a
  // text-only creative has no click-through destination).
  destinationUrl?: string;
  // Required for 'link' and 'text'; optional (alt/fallback text) for
  // 'banner'.
  headline?: string;
  body?: string;
  // Required for 'link' and 'text' (the clickable call-to-action
  // label); optional for 'banner' (shown as an overlay label on the
  // image if present).
  ctaLabel?: string;
}

// Per-country bid overrides are optional — an advertiser can set a
// single bidCpmUsd that applies everywhere, or override specific
// countries. getEffectiveCpmForImpression (lib/adRates.ts) is always
// the thing that actually resolves a price per impression; this is
// just where the advertiser's own numbers are stored.
export interface AdBudget {
  // Advertiser's own CPM bid in USD, applied to every country unless
  // overridden in bidCpmByCountry. Optional — omitted means "use
  // lib/adRates.ts's country-tier table as the estimate," same as
  // passing no advertiserBidCpmUsd to getEffectiveCpmForImpression.
  bidCpmUsd?: number;
  bidCpmByCountry?: Record<string, number>;
  // Prepaid budget cap for this ad specifically, in USD. Optional —
  // when unset, the ad can spend from the advertiser's whole account
  // balance (see AdvertiserBillingDoc) with no ad-level ceiling.
  dailyCapUsd?: number;
  totalCapUsd?: number;
  // Running total spent by this ad so far, server-maintained only
  // (FieldValue.increment from /api/ad-track) — never client-writable.
  spentUsd: number;
  // Which formats this ad is eligible to be shown as. Must be a
  // non-empty subset of AD_FORMAT_IDS. An ad can be submitted once and
  // rendered into any/all of these when a given site/slot calls for
  // it.
  formats: AdFormatId[];
  // Optional allow-list of countries to target; omitted/empty means
  // "eligible everywhere" — /api/ad-serve filters on this before
  // selection.
  countries?: string[];
}

export interface AdDoc {
  id: string;
  ownerUid: string;
  status: AdStatus;
  creative: AdCreative;
  budget: AdBudget;
  createdAt: unknown; // FieldValue.serverTimestamp() on write, Timestamp on read
  updatedAt: unknown;
  // Lifetime counters, server-maintained only. Separate from
  // budget.spentUsd (money) so impression/click VOLUME is visible even
  // once an ad is paused/out of budget and no longer accruing spend.
  stats: {
    impressions: number;
    clicks: number;
  };
}

export interface AdvertiserBillingDoc {
  // Prepaid ledger balance, in USD. No real payment provider wired up
  // yet (confirmed: nothing in this codebase integrates Stripe or any
  // other processor) — top-up today just adjusts this number via
  // app/api/advertise's 'top-up' action. Swapping in a real payment
  // provider later only needs to change what CALLS that action
  // (a webhook instead of a direct request), not this schema.
  balanceUsd: number;
  updatedAt: unknown;
}

export interface PublisherDayEarnings {
  // One doc per UTC day per site, same bucketing convention as
  // lib/serverAuth.ts's usage doc (todayKey()). Server-maintained only.
  impressions: number;
  clicks: number;
  earningsUsd: number;
  // Per-country breakdown so the Monetization dashboard's existing
  // MonetizationCountryChart (currently mock data — see
  // lib/monetization-stats.ts) has something real to eventually read.
  byCountry: Record<string, { impressions: number; clicks: number; earningsUsd: number }>;
  // Per-format breakdown (keyed by AdFormatId), same role as
  // byCountry above but for MonetizationAdTypeChart. Written by
  // app/api/ad-track/route.ts alongside byCountry, keyed off the
  // `resolvedFormat` it derives from the served ad's own
  // budget.formats (never trusted blind from the client).
  byFormat?: Record<string, { impressions: number; clicks: number }>;
}

// One entry in a publisher-readable recent-activity feed — written by
// app/api/ad-track/route.ts to
// users/{uid}/sites/{siteId}/adActivity/{autoId} alongside the
// adEarnings/{day} aggregate above. Exists because adPool/{adId}/
// events (the raw fraud/appeals log) is readable only by the AD's
// owner (the advertiser) per firestore.rules — the SITE owner
// (publisher) needs their own readable feed of their own recent
// earnings for the Monetization dashboard's activity log, which this
// is. Capped to the most recent docs by query (see
// hooks/useMonetizationStats.ts), not by any server-side pruning.
export interface AdActivityEntry {
  ts: unknown; // FieldValue.serverTimestamp() on write, Timestamp on read
  event: 'impression' | 'click';
  format: AdFormatId;
  country: string; // ISO 3166-1 alpha-2, or 'UNKNOWN' — see ad-track's countryKey
  earningsUsd: number;
}

// ── Validation ───────────────────────────────────────────────────────
// Mirrors lib/widgets.ts's style: narrow, explicit, allow-list shaped
// checks rather than a generic schema validator — this route holds
// Admin SDK (rules-bypassing) privilege, so it is the only thing
// standing between "any caller" and a malformed/oversized doc in
// Firestore.

const MAX_URL_LEN = 2000;
const MAX_HEADLINE_LEN = 120;
const MAX_BODY_LEN = 300;
const MAX_CTA_LEN = 40;
const MIN_CPM_BID_USD = 0.05;
const MAX_CPM_BID_USD = 100;

function isHttpUrl(value: unknown): value is string {
  if (typeof value !== 'string' || value.length === 0 || value.length > MAX_URL_LEN) return false;
  try {
    const u = new URL(value);
    return u.protocol === 'http:' || u.protocol === 'https:';
  } catch {
    return false;
  }
}

export interface AdCreativeValidationResult {
  ok: boolean;
  error?: string;
  creative?: AdCreative;
}

/**
 * Validates + narrows a raw creative payload against the format-
 * specific required-field rules documented on AdCreative above.
 * Deliberately strict about WHICH fields are allowed for a given type
 * (e.g. a 'text' creative with an imageUrl is rejected, not silently
 * accepted-and-ignored) so a stored AdDoc's shape is always
 * predictable for the serving route to render without per-type
 * guessing.
 */
export function validateAdCreative(input: unknown): AdCreativeValidationResult {
  if (!input || typeof input !== 'object' || Array.isArray(input)) {
    return { ok: false, error: 'creative must be an object.' };
  }
  const { type, imageUrl, destinationUrl, headline, body, ctaLabel } = input as Record<string, unknown>;

  if (!isValidAdCreativeType(type)) {
    return { ok: false, error: 'creative.type must be one of: ' + AD_CREATIVE_TYPES.join(', ') };
  }

  const out: AdCreative = { type };

  if (type === 'banner') {
    if (!isHttpUrl(imageUrl)) return { ok: false, error: 'creative.imageUrl is required for a banner ad and must be a valid http(s) URL.' };
    if (!isHttpUrl(destinationUrl)) return { ok: false, error: 'creative.destinationUrl is required for a banner ad and must be a valid http(s) URL.' };
    out.imageUrl = imageUrl as string;
    out.destinationUrl = destinationUrl as string;
    if (headline !== undefined) {
      if (typeof headline !== 'string' || headline.length > MAX_HEADLINE_LEN) return { ok: false, error: 'creative.headline is too long.' };
      out.headline = headline;
    }
    if (ctaLabel !== undefined) {
      if (typeof ctaLabel !== 'string' || ctaLabel.length > MAX_CTA_LEN) return { ok: false, error: 'creative.ctaLabel is too long.' };
      out.ctaLabel = ctaLabel;
    }
  } else if (type === 'link') {
    if (!isHttpUrl(destinationUrl)) return { ok: false, error: 'creative.destinationUrl is required for a link ad and must be a valid http(s) URL.' };
    if (typeof headline !== 'string' || headline.length === 0 || headline.length > MAX_HEADLINE_LEN) {
      return { ok: false, error: 'creative.headline is required for a link ad.' };
    }
    if (typeof ctaLabel !== 'string' || ctaLabel.length === 0 || ctaLabel.length > MAX_CTA_LEN) {
      return { ok: false, error: 'creative.ctaLabel is required for a link ad.' };
    }
    out.destinationUrl = destinationUrl as string;
    out.headline = headline;
    out.ctaLabel = ctaLabel;
    if (body !== undefined) {
      if (typeof body !== 'string' || body.length > MAX_BODY_LEN) return { ok: false, error: 'creative.body is too long.' };
      out.body = body;
    }
  } else {
    // 'text'
    if (typeof headline !== 'string' || headline.length === 0 || headline.length > MAX_HEADLINE_LEN) {
      return { ok: false, error: 'creative.headline is required for a text ad.' };
    }
    out.headline = headline;
    if (body !== undefined) {
      if (typeof body !== 'string' || body.length > MAX_BODY_LEN) return { ok: false, error: 'creative.body is too long.' };
      out.body = body;
    }
    if (destinationUrl !== undefined) {
      if (!isHttpUrl(destinationUrl)) return { ok: false, error: 'creative.destinationUrl must be a valid http(s) URL if provided.' };
      out.destinationUrl = destinationUrl as string;
    }
    if (ctaLabel !== undefined) {
      if (typeof ctaLabel !== 'string' || ctaLabel.length > MAX_CTA_LEN) return { ok: false, error: 'creative.ctaLabel is too long.' };
      out.ctaLabel = ctaLabel;
    }
  }

  return { ok: true, creative: out };
}

export interface AdBudgetValidationResult {
  ok: boolean;
  error?: string;
  budget?: Pick<AdBudget, 'bidCpmUsd' | 'bidCpmByCountry' | 'dailyCapUsd' | 'totalCapUsd' | 'formats' | 'countries'>;
}

/**
 * Validates the advertiser-supplied half of AdBudget (everything
 * except the server-maintained `spentUsd`, which is never accepted
 * from a client payload — see app/api/advertise/route.ts).
 */
export function validateAdBudgetInput(input: unknown): AdBudgetValidationResult {
  if (!input || typeof input !== 'object' || Array.isArray(input)) {
    return { ok: false, error: 'budget must be an object.' };
  }
  const { bidCpmUsd, bidCpmByCountry, dailyCapUsd, totalCapUsd, formats, countries } = input as Record<string, unknown>;

  if (!Array.isArray(formats) || formats.length === 0 || formats.length > AD_FORMAT_IDS.length) {
    return { ok: false, error: 'budget.formats must be a non-empty array of ad format ids.' };
  }
  if (!formats.every(isValidAdFormatId)) {
    return { ok: false, error: 'budget.formats contains an unknown format id.' };
  }
  const dedupedFormats = Array.from(new Set(formats)) as AdFormatId[];

  const out: AdBudgetValidationResult['budget'] = { formats: dedupedFormats };

  if (bidCpmUsd !== undefined) {
    if (typeof bidCpmUsd !== 'number' || !Number.isFinite(bidCpmUsd) || bidCpmUsd < MIN_CPM_BID_USD || bidCpmUsd > MAX_CPM_BID_USD) {
      return { ok: false, error: `budget.bidCpmUsd must be a number between ${MIN_CPM_BID_USD} and ${MAX_CPM_BID_USD}.` };
    }
    out.bidCpmUsd = Math.round(bidCpmUsd * 100) / 100;
  }

  if (bidCpmByCountry !== undefined) {
    if (typeof bidCpmByCountry !== 'object' || bidCpmByCountry === null || Array.isArray(bidCpmByCountry)) {
      return { ok: false, error: 'budget.bidCpmByCountry must be an object keyed by country code.' };
    }
    const entries = Object.entries(bidCpmByCountry as Record<string, unknown>);
    if (entries.length > 250) return { ok: false, error: 'budget.bidCpmByCountry has too many entries.' };
    const cleaned: Record<string, number> = {};
    for (const [code, v] of entries) {
      if (!isValidCountryCode(code)) return { ok: false, error: `budget.bidCpmByCountry has an invalid country code: ${code}` };
      if (typeof v !== 'number' || !Number.isFinite(v) || v < MIN_CPM_BID_USD || v > MAX_CPM_BID_USD) {
        return { ok: false, error: `budget.bidCpmByCountry.${code} must be a number between ${MIN_CPM_BID_USD} and ${MAX_CPM_BID_USD}.` };
      }
      cleaned[code] = Math.round(v * 100) / 100;
    }
    out.bidCpmByCountry = cleaned;
  }

  if (dailyCapUsd !== undefined) {
    if (typeof dailyCapUsd !== 'number' || !Number.isFinite(dailyCapUsd) || dailyCapUsd <= 0) {
      return { ok: false, error: 'budget.dailyCapUsd must be a positive number.' };
    }
    out.dailyCapUsd = Math.round(dailyCapUsd * 100) / 100;
  }

  if (totalCapUsd !== undefined) {
    if (typeof totalCapUsd !== 'number' || !Number.isFinite(totalCapUsd) || totalCapUsd <= 0) {
      return { ok: false, error: 'budget.totalCapUsd must be a positive number.' };
    }
    out.totalCapUsd = Math.round(totalCapUsd * 100) / 100;
  }

  if (countries !== undefined) {
    if (!Array.isArray(countries) || countries.length > 250) {
      return { ok: false, error: 'budget.countries must be an array of country codes.' };
    }
    if (!countries.every(isValidCountryCode)) {
      return { ok: false, error: 'budget.countries contains an invalid country code.' };
    }
    out.countries = Array.from(new Set(countries)) as string[];
  }

  return { ok: true, budget: out };
}

export function isValidAdId(value: unknown): value is string {
  return typeof value === 'string' && /^[a-zA-Z0-9_-]{1,80}$/.test(value);
}
