// app/api/ad-serve/route.ts
//
// POST { siteId, pageUrl, format? }
//
// Public, unauthenticated, CORS-open, fail-open endpoint — called by
// the on-site embed script (public/sitevento.js does not yet have the
// ad-rendering piece; this route is its backend, following the exact
// contract app/api/widget/route.ts already established for delivering
// content to a third-party page: no idToken, domain-checked against
// the site's registered domain, never blocks the visitor's page).
//
// Picks ONE eligible ad to show for a given site + ad slot and returns
// its creative. "Eligible" means, in order:
//   1. siteId resolves to a real, verified, non-paused site (same
//      gates /api/track and /api/widget already enforce)
//   2. Monetization is turned on for that site (lib/monetization.ts's
//      MonetizationConfig.enabled)
//   3. The requested `format` (or, if omitted, any format) is one the
//      site owner has enabled in their ad-format toggles — see the
//      note below on MonetizationAdTypeGrid not persisting yet
//   4. The ad is status 'live' (funded, not paused)
//   5. The ad's own budget.formats includes the requested format
//   6. The ad's own budget.countries allow-list (if any) includes the
//      visitor's geo-resolved country
//   7. The ad is not the site owner's own ad (self-view is also
//      re-checked at track time, but filtering it out at selection
//      time means a site owner never even sees their own ad on their
//      own site, not just "sees it but it doesn't pay out")
//
// ── Selection: weighted by CPM bid ───────────────────────────────────
// Among eligible ads, one is chosen by weighted random selection,
// weight = that ad's effective CPM for the visitor's country
// (lib/adRates.ts's getEffectiveCpmForImpression — the advertiser's
// own bid if set, else the country-tier estimate). A higher-paying ad
// is proportionally more likely to be picked, not guaranteed — this
// approximates real ad-auction behavior (closer to a real network)
// without building a full auction. Every eligible ad still has SOME
// chance of being shown even at a much lower bid, so a frontier-tier
// advertiser isn't completely starved out by premium-tier competitors.
//
// ── MonetizationAdTypeGrid is not persisted yet ──────────────────────
// components/monetization/MonetizationAdTypeGrid.tsx currently keeps
// its enabled/disabled format toggles in local useState only (see its
// header comment) — nothing is written to Firestore. Rather than block
// this entire route on that piece of frontend work being finished,
// this route reads users/{uid}/sites/{siteId}/monetization/config
// for an OPTIONAL `adFormats: Record<AdFormatId, boolean>` map and, if
// it's missing (every existing site, and any site until that toggle
// grid is wired up to persist), defaults to "all formats enabled" —
// matching each AdTypeDef's defaultEnabled in lib/monetization.ts
// would require importing client-oriented data for a per-id default,
// so this route's fallback is the simpler, honest "nothing configured
// yet means don't block ad delivery" default used elsewhere in this
// codebase (e.g. /api/widget treating a missing subscriptionStatus as
// 'active'). When MonetizationAdTypeGrid is wired up to actually save
// (the same POST /api/site-monetization pattern, extended to accept
// an `adFormats` field — not built here, flagged for whoever wires
// that toggle grid's persistence), this route needs no change: it
// already reads the field if present.
import { NextRequest, NextResponse } from 'next/server';
import { getAdminDb } from '@/lib/firebaseAdmin';
import { allow } from '@/lib/rateLimit';
import { trackWidgetRequest } from '@/lib/serverAuth';
import { AD_FORMAT_IDS, isValidAdFormatId, type AdDoc, type AdFormatId } from '@/lib/adPool';
import { getEffectiveCpmForImpression } from '@/lib/adRates';
import type { MonetizationConfig } from '@/lib/monetization';

export const maxDuration = 10;
export const runtime = 'nodejs';
export const dynamic = 'force-dynamic'; // see /api/track's header on why a POST route needs this for OPTIONS to stay fresh

const CORS_HEADERS = {
  'Access-Control-Allow-Origin': '*',
  'Access-Control-Allow-Methods': 'POST, OPTIONS',
  'Access-Control-Allow-Headers': 'Content-Type',
  'Cache-Control': 'no-store',
};

const MAX_BODY_BYTES = 2 * 1024;

// How many candidate ads to pull before weighting/selecting. Bounded
// so a popular ad pool never makes this route scan/transfer an
// unbounded number of docs per visitor request. Not a "top N by bid"
// cutoff (that would starve low-bid ads completely) — just a sane cap
// on the candidate pool size; Firestore's own doc order within the
// `where` filters below is not meaningful, so this is a representative
// sample, not "the N highest-paying ads."
const MAX_CANDIDATES = 50;

export async function OPTIONS() {
  return new NextResponse(null, { status: 204, headers: CORS_HEADERS });
}

function weightedPick<T>(items: { item: T; weight: number }[]): T | null {
  const total = items.reduce((sum, i) => sum + Math.max(0, i.weight), 0);
  if (total <= 0) {
    // Degenerate case (all weights zero/negative) — fall back to
    // uniform random rather than returning nothing.
    if (items.length === 0) return null;
    return items[Math.floor(Math.random() * items.length)].item;
  }
  let r = Math.random() * total;
  for (const { item, weight } of items) {
    r -= Math.max(0, weight);
    if (r <= 0) return item;
  }
  return items[items.length - 1].item;
}

export async function POST(req: NextRequest) {
  try {
    const contentLength = Number(req.headers.get('content-length') || 0);
    if (contentLength > MAX_BODY_BYTES) {
      return NextResponse.json({ ok: false, reason: 'payload too large' }, { status: 200, headers: CORS_HEADERS });
    }
    const raw = await req.text();
    if (raw.length > MAX_BODY_BYTES) {
      return NextResponse.json({ ok: false, reason: 'payload too large' }, { status: 200, headers: CORS_HEADERS });
    }

    let body: any = {};
    try {
      body = JSON.parse(raw);
    } catch {
      return NextResponse.json({ ok: false, reason: 'invalid json' }, { status: 200, headers: CORS_HEADERS });
    }

    const { siteId, format } = body || {};
    if (!siteId || typeof siteId !== 'string' || siteId.length > 100) {
      return NextResponse.json({ ok: false, reason: 'missing siteId' }, { status: 200, headers: CORS_HEADERS });
    }
    if (format !== undefined && !isValidAdFormatId(format)) {
      return NextResponse.json({ ok: false, reason: 'invalid format' }, { status: 200, headers: CORS_HEADERS });
    }

    const forwardedFor = req.headers.get('x-forwarded-for') || '';
    const ip = forwardedFor.split(',')[0].trim() || 'unknown';
    if (!allow(`ad-serve:${siteId}:${ip}`, 90, 60_000)) {
      return NextResponse.json({ ok: false, reason: 'rate limited' }, { status: 200, headers: CORS_HEADERS });
    }

    let db;
    try {
      db = getAdminDb();
    } catch (err) {
      console.error('[ad-serve] Firebase Admin init error', err);
      return NextResponse.json({ ok: false, reason: 'server not configured' }, { status: 200, headers: CORS_HEADERS });
    }

    const indexSnap = await db.collection('siteIndex').doc(siteId).get();
    const siteOwnerUid: string | null = indexSnap.exists ? indexSnap.data()?.uid ?? null : null;
    if (!siteOwnerUid) {
      return NextResponse.json({ ok: false, reason: 'unknown site' }, { status: 200, headers: CORS_HEADERS });
    }

    const siteRef = db.collection('users').doc(siteOwnerUid).collection('sites').doc(siteId);
    const siteSnap = await siteRef.get();
    if (!siteSnap.exists) {
      return NextResponse.json({ ok: false, reason: 'unknown site' }, { status: 200, headers: CORS_HEADERS });
    }
    const site = siteSnap.data()!;
    if (site.status !== 'verified') {
      return NextResponse.json({ ok: false, reason: 'site not verified' }, { status: 200, headers: CORS_HEADERS });
    }
    if (site.paused === true) {
      return NextResponse.json({ ok: false, reason: 'site paused' }, { status: 200, headers: CORS_HEADERS });
    }

    const monetizationSnap = await siteRef.collection('monetization').doc('config').get();
    const monetization = (monetizationSnap.exists ? monetizationSnap.data() : null) as
      | (MonetizationConfig & { adFormats?: Partial<Record<AdFormatId, boolean>> })
      | null;
    if (!monetization?.enabled) {
      return NextResponse.json({ ok: false, reason: 'monetization not enabled' }, { status: 200, headers: CORS_HEADERS });
    }

    // See header comment: missing adFormats map defaults every format
    // to enabled, since MonetizationAdTypeGrid doesn't persist yet.
    const enabledFormats: AdFormatId[] = monetization.adFormats
      ? AD_FORMAT_IDS.filter((id) => monetization.adFormats?.[id] !== false)
      : [...AD_FORMAT_IDS];

    const requestedFormats: AdFormatId[] = format ? [format as AdFormatId] : enabledFormats;
    const eligibleFormats = requestedFormats.filter((f) => enabledFormats.includes(f));
    if (eligibleFormats.length === 0) {
      return NextResponse.json({ ok: false, reason: 'format not enabled for this site' }, { status: 200, headers: CORS_HEADERS });
    }

    // Country from the same Vercel geo headers /api/track already
    // relies on — never asked of the visitor's browser.
    const country = req.headers.get('x-vercel-ip-country') || null;

    // Candidate pool: live ads whose formats array intersects the
    // site's eligible formats. Firestore can't do an array-intersects-
    // array query directly, so this queries on status + an
    // array-contains-any over the (small, bounded) eligible-formats
    // set, which Firestore DOES support directly (up to 30 values,
    // comfortably within AD_FORMAT_IDS.length).
    const candidatesSnap = await db
      .collection('adPool')
      .where('status', '==', 'live')
      .where('budget.formats', 'array-contains-any', eligibleFormats)
      .limit(MAX_CANDIDATES)
      .get();

    if (candidatesSnap.empty) {
      return NextResponse.json({ ok: false, reason: 'no eligible ads' }, { status: 200, headers: CORS_HEADERS });
    }

    const weighted: { item: { id: string; ad: AdDoc }; weight: number }[] = [];
    for (const doc of candidatesSnap.docs) {
      const ad = doc.data() as AdDoc;
      if (ad.ownerUid === siteOwnerUid) continue; // self-view filtered at selection time, not just at payout time
      if (ad.budget.countries && ad.budget.countries.length > 0 && country && !ad.budget.countries.includes(country)) continue;
      const weight = getEffectiveCpmForImpression({
        countryCode: country,
        advertiserBidCpmUsd: ad.budget.bidCpmByCountry?.[country || ''] ?? ad.budget.bidCpmUsd ?? null,
      });
      weighted.push({ item: { id: doc.id, ad }, weight });
    }

    if (weighted.length === 0) {
      return NextResponse.json({ ok: false, reason: 'no eligible ads' }, { status: 200, headers: CORS_HEADERS });
    }

    const picked = weightedPick(weighted);
    if (!picked) {
      return NextResponse.json({ ok: false, reason: 'no eligible ads' }, { status: 200, headers: CORS_HEADERS });
    }

    // Soft usage signal against the PUBLISHER's (site owner's) account,
    // same fire-and-forget convention as every other widget-facing
    // route — never blocks or delays the response.
    trackWidgetRequest(db, siteId).catch(() => {});

    return NextResponse.json(
      {
        ok: true,
        ad: {
          id: picked.id,
          format: eligibleFormats.find((f) => picked.ad.budget.formats.includes(f)) || picked.ad.budget.formats[0],
          creative: picked.ad.creative,
        },
      },
      { status: 200, headers: CORS_HEADERS }
    );
  } catch (err) {
    console.error('[ad-serve] handler error', err);
    return NextResponse.json({ ok: false }, { status: 200, headers: CORS_HEADERS });
  }
}
