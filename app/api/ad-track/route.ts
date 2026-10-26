// app/api/ad-track/route.ts
//
// POST { siteId, adId, event: "impression" | "click" }
//
// Public, unauthenticated, CORS-open, fail-open endpoint — the real
// event-tracking + billing pipeline that replaces the mock data in
// lib/monetization-stats.ts once a real embed script calls it (same
// role app/api/overlay-track/route.ts plays for overlay engagement,
// extended here to also move money, not just bump a counter).
//
// ── Contract ─────────────────────────────────────────────────────────
// Always 200, CORS-open, never throws into the caller — identical
// contract to /api/track and /api/overlay-track. A rejected/invalid
// event is NOT an error response; it's `{ ok: true, counted: false,
// reason }`, same shape as overlay-track's stale-version case.
//
// ── What happens on a VALID event ───────────────────────────────────
//   1. lib/adEvents.ts's checkAdEventValidity() runs (self-view,
//      rate-limit/dedup, click-without-impression — see that file).
//   2. The raw event is always logged to adPool/{adId}/events/{autoId}
//      with a `valid` flag and `reason` if invalid — for debugging/
//      appeals, per the original handoff's explicit ask ("should
//      invalid events still be logged... yes, for debugging/appeals").
//   3. ONLY if valid: lib/adRates.ts computes the per-event price
//      (impression -> country-tiered CPM/1000, click -> flat CPC_USD),
//      the advertiser's adPool/{adId}.budget.spentUsd and this
//      account's advertiserAccount/billing.balanceUsd are debited the
//      FULL price, and the publisher (site owner) is credited their
//      50% share (lib/adRates.ts's PLATFORM_REVENUE_SHARE) into
//      users/{uid}/sites/{siteId}/adEarnings/{day}. The other 50% is
//      the platform's take — not written anywhere as a payable amount
//      (it's implicitly "whatever wasn't credited to the publisher"),
//      matching how no other revenue in this codebase has a ledger for
//      Sitevento's own cut either.
//   4. If debiting would take the advertiser's balance to or below
//      zero, the ad's status flips to 'out_of_budget' in the SAME
//      transaction as the debit — so the very next /api/ad-serve call
//      naturally stops selecting it, with no separate cutoff job
//      needed.
//
// ── Why a transaction ────────────────────────────────────────────────
// Debiting balanceUsd and spentUsd, and potentially flipping an ad to
// 'out_of_budget', must be atomic — two concurrent clicks on the same
// nearly-exhausted ad must not both read "still has balance" and both
// proceed, overdrawing the advertiser past zero. Firestore transactions
// are the same tool checkAndIncrementAccountWrites (lib/serverAuth.ts)
// already uses for exactly this kind of race.
import { NextRequest, NextResponse } from 'next/server';
import { getAdminDb } from '@/lib/firebaseAdmin';
import { FieldValue } from 'firebase-admin/firestore';
import { trackWidgetRequest } from '@/lib/serverAuth';
import { checkAdEventValidity, type AdEventType } from '@/lib/adEvents';
import { isValidAdId, isValidAdFormatId, type AdDoc, type AdvertiserBillingDoc, type AdFormatId } from '@/lib/adPool';
import { getEffectiveCpmForImpression, getPublisherPayoutForImpression, getPublisherPayoutForClick, CPC_USD, PLATFORM_REVENUE_SHARE } from '@/lib/adRates';

export const maxDuration = 10;
export const runtime = 'nodejs';
export const dynamic = 'force-dynamic';

const CORS_HEADERS = {
  'Access-Control-Allow-Origin': '*',
  'Access-Control-Allow-Methods': 'POST, OPTIONS',
  'Access-Control-Allow-Headers': 'Content-Type',
  'Cache-Control': 'no-store',
};

const MAX_BODY_BYTES = 2 * 1024;
const EVENT_TYPES: AdEventType[] = ['impression', 'click'];

// Short in-memory marker so a 'click' can check "did this visitor have
// a recent valid impression on this ad" without a Firestore query on
// every click — mirrors lib/rateLimit.ts's own in-process, best-effort
// nature (same honest limitation: per-instance, not a global
// guarantee; see lib/adEvents.ts's "future hardening" note for the
// cross-instance version). Deliberately tiny (visitor+ad -> expiry) —
// not a general cache, just this one dedup signal.
const recentImpressions = new Map<string, number>();
const RECENT_IMPRESSION_WINDOW_MS = 5 * 60_000;

function markImpression(key: string) {
  recentImpressions.set(key, Date.now() + RECENT_IMPRESSION_WINDOW_MS);
  if (Math.random() < 0.02) {
    const now = Date.now();
    for (const [k, exp] of recentImpressions) if (exp <= now) recentImpressions.delete(k);
  }
}
function hasRecentImpression(key: string): boolean {
  const exp = recentImpressions.get(key);
  return typeof exp === 'number' && exp > Date.now();
}

function todayKey(): string {
  return new Date().toISOString().slice(0, 10);
}

export async function OPTIONS() {
  return new NextResponse(null, { status: 204, headers: CORS_HEADERS });
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

    const { siteId, adId, event, visitorId: clientVisitorId, format: requestedFormat } = body || {};
    if (!siteId || typeof siteId !== 'string' || siteId.length > 100) {
      return NextResponse.json({ ok: false, reason: 'missing siteId' }, { status: 200, headers: CORS_HEADERS });
    }
    if (!isValidAdId(adId)) {
      return NextResponse.json({ ok: false, reason: 'missing adId' }, { status: 200, headers: CORS_HEADERS });
    }
    if (typeof event !== 'string' || !EVENT_TYPES.includes(event as AdEventType)) {
      return NextResponse.json({ ok: false, reason: 'bad event' }, { status: 200, headers: CORS_HEADERS });
    }
    // Same validated-shape-or-hash-fallback pattern as /api/track's
    // VISITOR_ID_RE — an ad event needs SOME stable per-visitor id for
    // the fraud checks (self-view aside) to mean anything; a caller
    // sending no visitorId still gets tracked, just coarsely (IP+UA).
    const ip = (req.headers.get('x-forwarded-for') || '').split(',')[0].trim() || 'unknown';
    const ua = req.headers.get('user-agent') || '';
    const visitorId =
      typeof clientVisitorId === 'string' && /^v[a-z0-9]{6,40}$/i.test(clientVisitorId)
        ? clientVisitorId
        : `h${ip}:${ua}`.slice(0, 80);

    let db;
    try {
      db = getAdminDb();
    } catch (err) {
      console.error('[ad-track] Firebase Admin init error', err);
      return NextResponse.json({ ok: false, reason: 'server not configured' }, { status: 200, headers: CORS_HEADERS });
    }

    const [indexSnap, adSnap] = await Promise.all([
      db.collection('siteIndex').doc(siteId).get(),
      db.collection('adPool').doc(adId).get(),
    ]);

    const siteOwnerUid: string | null = indexSnap.exists ? indexSnap.data()?.uid ?? null : null;
    if (!siteOwnerUid) {
      return NextResponse.json({ ok: false, reason: 'unknown site' }, { status: 200, headers: CORS_HEADERS });
    }
    if (!adSnap.exists) {
      return NextResponse.json({ ok: false, reason: 'unknown ad' }, { status: 200, headers: CORS_HEADERS });
    }
    const ad = adSnap.data() as AdDoc;

    // The format /api/ad-serve actually picked for this impression,
    // echoed back by the embed script on the matching track call — see
    // that route's response shape. Only trusted if it's a format this
    // SPECIFIC ad is actually eligible for (a caller could send any
    // string); otherwise falls back to the ad's first configured
    // format so byFormat/adActivity always have a valid bucket to land
    // in, same "never trust the body, always re-validate against the
    // ad's own doc" posture as the rest of this route.
    const resolvedFormat: AdFormatId =
      typeof requestedFormat === 'string' && isValidAdFormatId(requestedFormat) && ad.budget.formats.includes(requestedFormat as AdFormatId)
        ? (requestedFormat as AdFormatId)
        : ad.budget.formats[0];

    const eventType = event as AdEventType;
    const impressionKey = `${visitorId}:${adId}`;

    const validity = checkAdEventValidity({
      adId,
      siteId,
      adOwnerUid: ad.ownerUid,
      siteOwnerUid,
      visitorId,
      eventType,
      hasRecentValidImpression: eventType === 'click' ? hasRecentImpression(impressionKey) : undefined,
    });

    const country = req.headers.get('x-vercel-ip-country') || null;

    // Always log the raw event, valid or not — see header comment on
    // why (debugging/appeals, never silently dropped).
    const eventRef = db.collection('adPool').doc(adId).collection('events').doc();
    const eventLogPromise = eventRef
      .set({
        ts: FieldValue.serverTimestamp(),
        siteId,
        siteOwnerUid,
        type: eventType,
        country,
        visitorId,
        valid: validity.valid,
        reason: validity.reason || null,
      })
      .catch((err) => console.error('[ad-track] event log write failed', err));

    if (!validity.valid) {
      await eventLogPromise;
      return NextResponse.json({ ok: true, counted: false, reason: validity.reason }, { status: 200, headers: CORS_HEADERS });
    }

    if (eventType === 'impression') {
      markImpression(impressionKey);
    }

    // ── Pricing ─────────────────────────────────────────────────────
    const advertiserBid =
      eventType === 'impression'
        ? ad.budget.bidCpmByCountry?.[country || ''] ?? ad.budget.bidCpmUsd ?? null
        : null; // CPC is flat — no country/bid lookup (see lib/adRates.ts)

    const advertiserCostUsd =
      eventType === 'impression'
        ? getEffectiveCpmForImpression({ countryCode: country, advertiserBidCpmUsd: advertiserBid }) / 1000
        : CPC_USD;
    const publisherPayoutUsd =
      eventType === 'impression'
        ? getPublisherPayoutForImpression({ countryCode: country, advertiserBidCpmUsd: advertiserBid })
        : getPublisherPayoutForClick();

    const billingRef = db.collection('users').doc(ad.ownerUid).collection('advertiserAccount').doc('billing');
    const adRef = db.collection('adPool').doc(adId);
    const day = todayKey();
    const earningsRef = db.collection('users').doc(siteOwnerUid).collection('sites').doc(siteId).collection('adEarnings').doc(day);
    const countryKey = country || 'UNKNOWN';
    // Publisher-readable recent-activity log — separate from
    // adPool/{adId}/events above (which only the AD's owner, the
    // advertiser, can read per firestore.rules). The Monetization
    // dashboard needs the SITE owner's own recent earnings, and the
    // existing events log isn't readable by them, so this is a second,
    // differently-scoped write of the same event, not a duplicate of
    // the advertiser-facing log's purpose.
    const activityRef = db.collection('users').doc(siteOwnerUid).collection('sites').doc(siteId).collection('adActivity').doc();

    // ── Atomic debit + possible out_of_budget flip ───────────────────
    // Both the billing balance AND the ad's current status are
    // re-read INSIDE the transaction (not reused from the adSnap read
    // earlier, which happened before validity checks and could be
    // stale by the time this runs) — the out_of_budget flip condition
    // below depends on both being fresh at commit time, not at request
    // start.
    try {
      await db.runTransaction(async (tx) => {
        const [billingSnap, freshAdSnap] = await Promise.all([tx.get(billingRef), tx.get(adRef)]);
        const currentBalance = billingSnap.exists ? (billingSnap.data() as AdvertiserBillingDoc).balanceUsd || 0 : 0;
        const nextBalance = Math.round((currentBalance - advertiserCostUsd) * 1_000_000) / 1_000_000;
        const currentAdStatus = freshAdSnap.exists ? (freshAdSnap.data() as AdDoc).status : ad.status;

        tx.set(billingRef, { balanceUsd: nextBalance, updatedAt: FieldValue.serverTimestamp() }, { merge: true });
        tx.set(
          adRef,
          {
            'budget.spentUsd': FieldValue.increment(advertiserCostUsd),
            [`stats.${eventType === 'impression' ? 'impressions' : 'clicks'}`]: FieldValue.increment(1),
            updatedAt: FieldValue.serverTimestamp(),
            // Flip to out_of_budget the instant the balance runs out,
            // in the SAME transaction as the debit that caused it —
            // the very next /api/ad-serve read sees it immediately.
            // Never flips a 'paused' ad back to 'live' here — only
            // 'live' -> 'out_of_budget' is this transaction's job;
            // resuming is an explicit advertiser action (or the
            // auto-resume in /api/advertise's 'top-up' action).
            ...(nextBalance <= 0 && currentAdStatus === 'live' ? { status: 'out_of_budget' } : {}),
          },
          { merge: true }
        );

        tx.set(
          earningsRef,
          {
            [eventType === 'impression' ? 'impressions' : 'clicks']: FieldValue.increment(1),
            earningsUsd: FieldValue.increment(publisherPayoutUsd),
            [`byCountry.${countryKey}.${eventType === 'impression' ? 'impressions' : 'clicks'}`]: FieldValue.increment(1),
            [`byCountry.${countryKey}.earningsUsd`]: FieldValue.increment(publisherPayoutUsd),
            [`byFormat.${resolvedFormat}.${eventType === 'impression' ? 'impressions' : 'clicks'}`]: FieldValue.increment(1),
          },
          { merge: true }
        );

        tx.set(activityRef, {
          ts: FieldValue.serverTimestamp(),
          event: eventType,
          format: resolvedFormat,
          country: countryKey,
          earningsUsd: publisherPayoutUsd,
        });
      });
    } catch (err) {
      console.error('[ad-track] billing transaction failed', err);
      await eventLogPromise;
      // The event was still logged above — but billing failed, so this
      // event must not be reported as counted (the dashboard/balance
      // would disagree with what was actually persisted otherwise).
      return NextResponse.json({ ok: true, counted: false, reason: 'BILLING_FAILED' }, { status: 200, headers: CORS_HEADERS });
    }

    await eventLogPromise;

    // Soft usage signal against the publisher's account, same
    // fire-and-forget convention as every other widget-facing route.
    trackWidgetRequest(db, siteId).catch(() => {});

    return NextResponse.json(
      {
        ok: true,
        counted: true,
        advertiserCostUsd: Math.round(advertiserCostUsd * 1_000_000) / 1_000_000,
        publisherPayoutUsd: Math.round(publisherPayoutUsd * 1_000_000) / 1_000_000,
        platformShare: PLATFORM_REVENUE_SHARE.platform,
      },
      { status: 200, headers: CORS_HEADERS }
    );
  } catch (err) {
    console.error('[ad-track] handler error', err);
    return NextResponse.json({ ok: false }, { status: 200, headers: CORS_HEADERS });
  }
}
