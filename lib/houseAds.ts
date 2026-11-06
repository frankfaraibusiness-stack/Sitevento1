// lib/houseAds.ts
//
// Sitevento's own "in-house" ad pool — /api/ad-serve falls back to
// this whenever the REAL adPool (Firestore, real advertiser demand)
// has no eligible candidates for a given site + format. Exists so a
// site owner who turns Monetization on sees something (and earns
// something) immediately — real third-party advertiser inventory
// depends on advertisers signing up via /dashboard/advertise, which
// takes time to ramp; until then, "monetization on" would otherwise
// mean "no ads, no revenue," which looks broken even though nothing
// IS broken (see /api/ad-serve's header: `candidatesSnap.empty` ->
// ok:false is correct behavior for an empty collection, just a bad
// experience).
//
// ── Priced like a real ad, because it IS one ─────────────────────────
// These are Sitevento's own house creatives (image, square, 1:1) —
// not a third-party advertiser, but not a $0 placeholder either.
// IN_HOUSE_CPM_USD below is this pool's flat CPM bid (same role as an
// AdDoc's budget.bidCpmUsd — see lib/adPool.ts), so /api/ad-serve's
// weighted selection and /api/ad-track's per-impression/per-click
// pricing treat a house ad exactly like a real advertiser's bid
// instead of weight-0/$0. Publisher payout still runs through
// lib/adRates.ts's normal PLATFORM_REVENUE_SHARE/CPC math — a site
// owner earns the real 50% publisher share per valid view/click, same
// ledger (users/{uid}/sites/{siteId}/adEarnings/{day}) a real
// advertiser's ad writes to, so it shows up on the Monetization
// dashboard (DxPanels.tsx's MonetizationCard) with no special-casing.
//
// A house ad's id is still always prefixed `house_` so /api/ad-track
// can recognize it before touching the REAL adPool Firestore lookup
// or any advertiser-side billing transaction (there is no
// AdvertiserBillingDoc to debit here — Sitevento is the advertiser
// and doesn't bill itself) — but unlike before, it now DOES write a
// real publisher payout. See /api/ad-track's house-ad branch for the
// mechanics.
//
// ── Shape ─────────────────────────────────────────────────────────────
// Mirrors AdDoc's `id` + `creative` + `budget.formats` shape
// (lib/adPool.ts) plus a flat `bidCpmUsd`, NOT the full AdDoc (no
// ownerUid, no spentUsd, no real advertiserAccount) — so the same
// client-side renderAd()/renderAdCard()/renderAdStrip() functions in
// public/sitevento.js can render a house ad with zero special-casing;
// only /api/ad-serve (selecting + weighting the fallback) and
// /api/ad-track (routing billing to the publisher-only payout path)
// need to know a house ad is different from a real one.
import type { AdCreative, AdFormatId } from './adPool';

export const HOUSE_AD_ID_PREFIX = 'house_';

export function isHouseAdId(id: unknown): id is string {
  return typeof id === 'string' && id.startsWith(HOUSE_AD_ID_PREFIX);
}

// Flat CPM bid for every in-house ad, in USD per 1000 impressions —
// the rate the user set explicitly ($1.20), applied the same way a
// real advertiser's budget.bidCpmUsd would be: NOT country-tiered
// (lib/adRates.ts's getEffectiveCpmForImpression treats any explicit
// bid as authoritative over the country-tier table), so a house-ad
// impression always prices at this rate everywhere, and a publisher's
// payout is (IN_HOUSE_CPM_USD / 1000) * PLATFORM_REVENUE_SHARE.publisher
// per valid view — the exact same formula a real ad uses.
export const IN_HOUSE_CPM_USD = 1.2;

// In-house ads pay for clicks the same way every other ad does —
// lib/adRates.ts's flat, non-country-tiered CPC_USD — so there's
// nothing in-house-specific to override there; CPC is already uniform
// across the whole platform.

export interface HouseAd {
  id: string; // always HOUSE_AD_ID_PREFIX-prefixed
  creative: AdCreative;
  // Which formats this house ad can fill. Unlike a real AdDoc, a
  // house ad is eligible in EVERY country (no per-country targeting) —
  // the only axes that vary are format and (now) its flat CPM bid.
  formats: AdFormatId[];
}

// ── In-house creatives ────────────────────────────────────────────────
// Two square (1:1) image ads, rendered as a centered popup (format
// 'popup' — see public/sitevento.js's AD_CONTAINER_IDS/mountAdStyles
// for the centered-scrim layout) that links out to sitevento.com and
// is tracked (impression + click) like any other ad. More creatives
// can be appended to this array later without touching anything else
// — /api/ad-serve already picks uniformly at random among whichever
// house ads match the requested format.
export const HOUSE_ADS: HouseAd[] = [
  {
    id: 'house_sitevento_promo_1',
    creative: {
      type: 'banner',
      imageUrl: 'https://cdn.phototourl.com/member/2026-11-05-472cc77c-4c82-429b-a609-7fed3f05790e.gif',
      destinationUrl: 'https://sitevento.com',
      ctaLabel: 'Learn more',
    },
    formats: ['popup'],
  },
  {
    id: 'house_sitevento_promo_2',
    creative: {
      type: 'banner',
      imageUrl: 'https://cdn.phototourl.com/member/2026-11-05-b3732e45-e07a-4210-844d-86a143fb602c.jpg',
      destinationUrl: 'https://sitevento.com',
      ctaLabel: 'Learn more',
    },
    formats: ['popup'],
  },
];

// Picks one house ad eligible for the given format (uniform random
// among matches — every in-house ad shares the same flat CPM bid, so
// there's nothing to weight by among house ads themselves; weighting
// AGAINST real-pool ads happens one level up in /api/ad-serve using
// IN_HOUSE_CPM_USD as the weight). Returns null only if HOUSE_ADS has
// no entry for that format at all.
export function pickHouseAd(format: AdFormatId): HouseAd | null {
  const matches = HOUSE_ADS.filter((ad) => ad.formats.includes(format));
  if (matches.length === 0) return null;
  return matches[Math.floor(Math.random() * matches.length)];
}
