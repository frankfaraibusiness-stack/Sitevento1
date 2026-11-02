// lib/houseAds.ts
//
// A static, hard-coded "house ad pool" — Sitevento-branded placeholder
// ads that /api/ad-serve falls back to whenever the REAL adPool
// (Firestore, real advertiser demand) has no eligible candidates for
// a given site + format. Exists so a site owner who turns Monetization
// on sees something immediately — real inventory depends on real
// advertisers signing up via /dashboard/advertise, which takes time
// to ramp; until then, "monetization on" would otherwise mean "no ads
// ever render," which looks broken even though nothing IS broken (see
// /api/ad-serve's header: `candidatesSnap.empty` -> ok:false is
// correct behavior for an empty collection, just a bad experience).
//
// ── Not a real advertiser ────────────────────────────────────────────
// These ads have $0 real revenue — there is no advertiser, no
// AdvertiserBillingDoc, nothing being debited. A house ad's id is
// always prefixed `house_` specifically so /api/ad-track can
// recognize and short-circuit it BEFORE touching any of the real
// billing/transaction logic in that route (see its header) — a house
// ad must never be looked up in the `adPool` Firestore collection
// (doesn't exist there) and must never attempt to debit/credit money
// that doesn't exist. House-ad impressions/clicks are still tracked
// (for visibility into fill-rate — "monetization is working, here's
// what showed"), just as simple counters, not revenue events.
//
// ── Shape ─────────────────────────────────────────────────────────────
// Deliberately mirrors AdDoc's `id` + `creative` + `budget.formats`
// shape (lib/adPool.ts) — NOT the full AdDoc (no ownerUid, no
// spentUsd, no per-country bid, no real stats ledger) — so the same
// client-side renderAd()/renderAdCard()/renderAdStrip() functions in
// public/sitevento.js can render a house ad with zero special-casing;
// only /api/ad-serve (selecting the fallback) and /api/ad-track
// (short-circuiting billing) need to know a house ad is different from
// a real one.
import type { AdCreative, AdFormatId } from './adPool';

export const HOUSE_AD_ID_PREFIX = 'house_';

export function isHouseAdId(id: unknown): id is string {
  return typeof id === 'string' && id.startsWith(HOUSE_AD_ID_PREFIX);
}

export interface HouseAd {
  id: string; // always HOUSE_AD_ID_PREFIX-prefixed
  creative: AdCreative;
  // Which formats this house ad can fill. Unlike a real AdDoc, a
  // house ad is eligible in EVERY country (no targeting/budget
  // concept at all) — the only axis that varies is format.
  formats: AdFormatId[];
}

// A handful of generic, brand-neutral Sitevento house ads — enough
// variety that a site showing house ads doesn't look like it's stuck
// rendering the exact same creative on every slot/visit, without
// needing any image hosting (every house ad is creative type 'text' or
// 'link' — no imageUrl dependency on an external host that could go
// down and break the fallback itself).
export const HOUSE_ADS: HouseAd[] = [
  {
    id: 'house_grow_with_sitevento',
    creative: {
      type: 'text',
      headline: 'This space is reserved for your ad',
      body: 'Sitevento connects advertisers with sites like this one. Your brand could be here.',
      destinationUrl: 'https://sitevento.com/advertise',
      ctaLabel: 'Advertise here',
    },
    formats: ['banner', 'sticky-footer', 'popup', 'overlay'],
  },
  {
    id: 'house_monetize_your_site',
    creative: {
      type: 'link',
      headline: 'Turn your traffic into revenue',
      body: 'Site owners earn a share of every ad shown through Sitevento Monetization.',
      destinationUrl: 'https://sitevento.com/monetization',
      ctaLabel: 'Learn more',
    },
    formats: ['banner', 'sticky-footer', 'popup', 'overlay'],
  },
  {
    id: 'house_powered_by_sitevento',
    creative: {
      type: 'text',
      headline: 'Powered by Sitevento',
      body: 'Monetization is live on this site. Real advertiser inventory is ramping up.',
      ctaLabel: 'Sitevento',
      destinationUrl: 'https://sitevento.com',
    },
    formats: ['banner', 'sticky-footer', 'popup', 'overlay'],
  },
  // interstitial gets its own dedicated, full-screen-appropriate
  // creative rather than reusing the strip-sized ones above — a true
  // full-viewport placement reads better with slightly more copy and
  // without assuming it'll be squeezed into a 300px-wide card.
  {
    id: 'house_interstitial_grow',
    creative: {
      type: 'text',
      headline: 'Your ad could be the one visitors see next',
      body: 'This full-screen placement is reserved. Sitevento is onboarding advertisers for interstitial inventory right now.',
      destinationUrl: 'https://sitevento.com/advertise',
      ctaLabel: 'Become an advertiser',
    },
    formats: ['interstitial'],
  },
];

// Picks one house ad eligible for the given format (uniform random
// among matches — no weighting/CPM concept for house ads, unlike the
// real pool's weightedPick in /api/ad-serve, since there's no bid to
// weight by). Returns null only if HOUSE_ADS somehow has no entry for
// that format at all (shouldn't happen given the list above covers
// every AdFormatId, but kept defensive since a future edit to this
// list could accidentally drop a format's only entry).
export function pickHouseAd(format: AdFormatId): HouseAd | null {
  const matches = HOUSE_ADS.filter((ad) => ad.formats.includes(format));
  if (matches.length === 0) return null;
  return matches[Math.floor(Math.random() * matches.length)];
}
