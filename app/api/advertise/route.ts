// app/api/advertise/route.ts
//
// POST { idToken, action, ...fields } — the backend for
// /dashboard/advertise (the page itself still needs to be built on
// the frontend; this route is everything it will call). One route,
// several actions, same shape as app/api/user-action/route.ts's
// dispatch pattern (a single authenticated endpoint for a set of
// related owner actions, rather than one route file per verb) — but
// kept as its own file rather than folded into user-action, since
// this is a genuinely new domain (the ad pool) with its own
// validation module (lib/adPool.ts), not an addition to that route's
// existing per-site action set.
//
// Actions:
//   'create-ad'  { creative, budget }                  -> creates an AdDoc, auto-live if funded
//   'update-ad'  { adId, creative?, budget? }           -> patches an existing ad's own creative/budget
//   'pause-ad'   { adId }                                -> sets status 'paused'
//   'resume-ad'  { adId }                                -> sets status back to 'live' (if funded) or 'out_of_budget'
//   'delete-ad'  { adId }                                -> permanently deletes an AdDoc the caller owns
//   'list-ads'   {}                                      -> this advertiser's own ads
//   'top-up'     { amountUsd }                           -> adds to the advertiser's prepaid balanceUsd ledger
//   'get-billing' {}                                     -> this advertiser's current balance
//   'get-stats'  { adId: 'all' | adId, days? }           -> last `days` (default 14, max 90) of
//                                                            per-day impressions/clicks/spend for
//                                                            one ad, or summed across every ad this
//                                                            advertiser owns when adId is 'all' —
//                                                            reads adPool/{adId}/stats/{day} (see
//                                                            lib/adPool.ts's AdStatsDayDoc)
//
// ── Why idToken, not a trusted uid in the body ────────────────────────
// Identical reasoning and pattern to app/api/site-widget/route.ts and
// app/api/site-monetization/route.ts — see their headers. The Admin
// SDK bypasses Firestore rules, so ownership (an ad can only be
// updated/paused by the uid that created it) is enforced here in code,
// by recovering the real uid from a verified Firebase ID token, never
// from anything the request body claims.
//
// ── No payment provider wired up ──────────────────────────────────
// Confirmed: nothing in this codebase integrates Stripe or any other
// processor. 'top-up' is a prepaid-ledger adjustment ONLY — it moves
// no real money, it just increments balanceUsd (see
// lib/adPool.ts's AdvertiserBillingDoc). Swapping in a real payment
// provider later means putting a payment-provider webhook in front of
// this same balance-increment logic (e.g. only call it after a
// successful charge webhook fires) rather than trusting a client POST
// directly, as flagged in the original handoff's billing section —
// this endpoint as written is NOT safe to expose to the public
// Internet as "pay $0 and get free ad credit," since it's just
// incrementing a number. It's deliberately built so a future gate (a
// payment-provider check) slots in as one more condition before the
// same Firestore write, not a rewrite.
//
// ── No creative-image upload pipeline ────────────────────────────────
// A 'banner' creative's imageUrl must already be a hosted http(s) URL
// — there's no file upload handling anywhere in this codebase yet
// (confirmed), so this route does not accept raw image bytes. Adding
// Firebase Storage upload is a separate, additive piece of work (a new
// route or extending this one) that this schema is ready for whenever
// it's built — see lib/adPool.ts's AdCreative.imageUrl field comment.
//
// ── No manual review ─────────────────────────────────────────────────
// Matches lib/monetization.ts's existing "no review step" model for
// Monetization itself. An ad goes live immediately provided its
// creative validates and the advertiser's balance is positive — never
// blocked on a human approval step. See lib/adPool.ts's header for the
// full reasoning.
// ── get-stats: per-day docs, not a range query ───────────────────────
// adPool/{adId}/stats/{day} is one doc per UTC day (doc id = the day
// itself, e.g. '2026-11-07' — see lib/serverAuth-style todayKey()
// convention used throughout this codebase), so "last N days" is read
// as N individual doc gets by id (today back through N-1 days ago),
// not a Firestore range/orderBy query — cheaper, needs no composite
// index, and a missing day (no events that day) just reads as zeros
// rather than needing to be backfilled. For adId:'all', this fetches
// every one of the advertiser's own ads first (ownership check, same
// as list-ads), then reads each ad's stats docs and sums them in
// memory — there is no cross-ad aggregate doc, by design, since the
// set of "this advertiser's ads" can change ad-to-ad and a pre-summed
// doc would need its own invalidation logic for no real savings at
// the advertiser-dashboard scale this is read at.
import { NextRequest, NextResponse } from 'next/server';
import { getAuth } from 'firebase-admin/auth';
import { FieldValue } from 'firebase-admin/firestore';
import { getAdminApp, getAdminDb, jsonError, rateLimitOk } from '@/lib/serverAuth';
import {
  validateAdCreative,
  validateAdBudgetInput,
  isValidAdId,
  type AdDoc,
  type AdvertiserBillingDoc,
  type AdStatsDayDoc,
  type AdStatus,
} from '@/lib/adPool';

export const maxDuration = 10;
export const runtime = 'nodejs';

const MAX_BODY_BYTES = 8 * 1024;
const MAX_TOPUP_USD = 10_000;
const MIN_TOPUP_USD = 1;
const DEFAULT_STATS_DAYS = 14;
const MAX_STATS_DAYS = 90;

// 'YYYY-MM-DD' for N consecutive UTC days ending today, oldest first —
// matches the doc-id convention adPool/{adId}/stats/{day} and
// adEarnings/{day} both already use (see app/api/ad-track/route.ts's
// todayKey()).
function lastNDayKeys(n: number): string[] {
  const out: string[] = [];
  const now = new Date();
  for (let i = n - 1; i >= 0; i--) {
    const d = new Date(Date.UTC(now.getUTCFullYear(), now.getUTCMonth(), now.getUTCDate() - i));
    out.push(d.toISOString().slice(0, 10));
  }
  return out;
}

function clip(v: unknown, max: number): string {
  return typeof v === 'string' && v ? v.slice(0, max) : '';
}

export async function POST(req: NextRequest) {
  try {
    const contentLength = Number(req.headers.get('content-length') || 0);
    if (contentLength > MAX_BODY_BYTES) return jsonError(400, 'Request body too large.');
    const raw = await req.text();
    if (raw.length > MAX_BODY_BYTES) return jsonError(400, 'Request body too large.');

    let body: any;
    try {
      body = JSON.parse(raw);
    } catch {
      return jsonError(400, 'Malformed JSON body.');
    }

    const { idToken, action } = body || {};
    if (!idToken || typeof idToken !== 'string') return jsonError(401, 'Missing idToken.');
    if (typeof action !== 'string') return jsonError(400, 'Missing action.');

    let app;
    try {
      app = getAdminApp();
    } catch (err) {
      console.error('[advertise] Firebase Admin init error', err);
      return jsonError(500, 'Server is not configured yet (missing Firebase Admin credentials).');
    }

    let uid: string;
    try {
      const decoded = await getAuth(app).verifyIdToken(idToken);
      uid = decoded.uid;
    } catch {
      return jsonError(401, 'Invalid or expired session. Please sign in again.');
    }

    if (!rateLimitOk(`advertise:${uid}:${action}`, 30, 60_000)) {
      return jsonError(429, 'Too many requests. Please try again shortly.');
    }

    const db = getAdminDb();
    const adPoolRef = db.collection('adPool');
    const billingRef = db.collection('users').doc(uid).collection('advertiserAccount').doc('billing');

    switch (action) {
      case 'get-billing': {
        const snap = await billingRef.get();
        const data = (snap.exists ? snap.data() : null) as AdvertiserBillingDoc | null;
        return NextResponse.json(
          { ok: true, billing: { balanceUsd: data?.balanceUsd ?? 0 } },
          { status: 200, headers: { 'Cache-Control': 'no-store' } }
        );
      }

      case 'get-stats': {
        const { adId, days } = body || {};
        const numDays =
          typeof days === 'number' && Number.isFinite(days) && days >= 1 && days <= MAX_STATS_DAYS
            ? Math.floor(days)
            : DEFAULT_STATS_DAYS;
        const dayKeys = lastNDayKeys(numDays);

        // Resolve which ad ids to read stats for — either exactly one
        // (ownership-checked) or every ad this advertiser owns.
        let adIds: string[];
        if (adId === 'all') {
          const snap = await adPoolRef.where('ownerUid', '==', uid).limit(100).get();
          adIds = snap.docs.map((d) => d.id);
        } else {
          if (!isValidAdId(adId)) return jsonError(400, 'Missing or invalid adId.');
          const adSnap = await adPoolRef.doc(adId).get();
          if (!adSnap.exists) return jsonError(404, 'Ad not found.');
          if ((adSnap.data() as AdDoc).ownerUid !== uid) return jsonError(403, 'You do not own this ad.');
          adIds = [adId];
        }

        // impressions[i]/clicks[i]/spendUsd[i] line up with dayKeys[i]
        // — summed across every ad in adIds when there's more than
        // one. A day with no doc for a given ad (no events that day)
        // reads as exists:false and contributes zero, not an error.
        const impressions = new Array(numDays).fill(0);
        const clicks = new Array(numDays).fill(0);
        const spendUsd = new Array(numDays).fill(0);

        if (adIds.length > 0) {
          const reads = adIds.flatMap((id) => dayKeys.map((day) => adPoolRef.doc(id).collection('stats').doc(day).get()));
          const snaps = await Promise.all(reads);
          snaps.forEach((snap, idx) => {
            if (!snap.exists) return;
            const dayIdx = idx % numDays;
            const data = snap.data() as AdStatsDayDoc;
            impressions[dayIdx] += data.impressions || 0;
            clicks[dayIdx] += data.clicks || 0;
            spendUsd[dayIdx] += data.spendUsd || 0;
          });
        }

        return NextResponse.json(
          { ok: true, stats: { days: dayKeys, impressions, clicks, spendUsd } },
          { status: 200, headers: { 'Cache-Control': 'no-store' } }
        );
      }

      case 'top-up': {
        const { amountUsd } = body || {};
        if (typeof amountUsd !== 'number' || !Number.isFinite(amountUsd) || amountUsd < MIN_TOPUP_USD || amountUsd > MAX_TOPUP_USD) {
          return jsonError(400, `amountUsd must be a number between ${MIN_TOPUP_USD} and ${MAX_TOPUP_USD}.`);
        }
        const rounded = Math.round(amountUsd * 100) / 100;

        const result = await db.runTransaction(async (tx) => {
          const snap = await tx.get(billingRef);
          const current = snap.exists ? (snap.data() as AdvertiserBillingDoc).balanceUsd || 0 : 0;
          const next = Math.round((current + rounded) * 100) / 100;
          tx.set(billingRef, { balanceUsd: next, updatedAt: FieldValue.serverTimestamp() }, { merge: true });
          return next;
        });

        // Any of this advertiser's own ads that were sitting
        // 'out_of_budget' can resume now that there's balance again —
        // same self-healing spirit as site-widget's auto-seed: don't
        // make the advertiser manually flip each ad back on after
        // topping up.
        const resumable = await adPoolRef.where('ownerUid', '==', uid).where('status', '==', 'out_of_budget').get();
        if (!resumable.empty) {
          const batch = db.batch();
          resumable.forEach((doc) => {
            batch.update(doc.ref, { status: 'live' as AdStatus, updatedAt: FieldValue.serverTimestamp() });
          });
          await batch.commit().catch((err) => console.error('[advertise] top-up auto-resume batch failed', err));
        }

        return NextResponse.json(
          { ok: true, billing: { balanceUsd: result }, resumedAdCount: resumable.size },
          { status: 200, headers: { 'Cache-Control': 'no-store' } }
        );
      }

      case 'create-ad': {
        const creativeResult = validateAdCreative(body?.creative);
        if (!creativeResult.ok || !creativeResult.creative) {
          return jsonError(400, creativeResult.error || 'Invalid creative.');
        }
        const budgetResult = validateAdBudgetInput(body?.budget);
        if (!budgetResult.ok || !budgetResult.budget) {
          return jsonError(400, budgetResult.error || 'Invalid budget.');
        }

        const billingSnap = await billingRef.get();
        const balanceUsd = billingSnap.exists ? (billingSnap.data() as AdvertiserBillingDoc).balanceUsd || 0 : 0;
        const initialStatus: AdStatus = balanceUsd > 0 ? 'live' : 'out_of_budget';

        const adRef = adPoolRef.doc();
        const adDoc: Omit<AdDoc, 'id'> = {
          ownerUid: uid,
          status: initialStatus,
          creative: creativeResult.creative,
          budget: { ...budgetResult.budget, spentUsd: 0 },
          createdAt: FieldValue.serverTimestamp(),
          updatedAt: FieldValue.serverTimestamp(),
          stats: { impressions: 0, clicks: 0 },
        };
        await adRef.set(adDoc);

        return NextResponse.json(
          { ok: true, ad: { id: adRef.id, ...adDoc } },
          { status: 200, headers: { 'Cache-Control': 'no-store' } }
        );
      }

      case 'update-ad': {
        const { adId } = body || {};
        if (!isValidAdId(adId)) return jsonError(400, 'Missing or invalid adId.');

        const adRef = adPoolRef.doc(adId);
        const adSnap = await adRef.get();
        if (!adSnap.exists) return jsonError(404, 'Ad not found.');
        const existing = adSnap.data() as AdDoc;
        if (existing.ownerUid !== uid) return jsonError(403, 'You do not own this ad.');

        const update: Record<string, unknown> = { updatedAt: FieldValue.serverTimestamp() };

        if (body?.creative !== undefined) {
          const creativeResult = validateAdCreative(body.creative);
          if (!creativeResult.ok || !creativeResult.creative) {
            return jsonError(400, creativeResult.error || 'Invalid creative.');
          }
          update.creative = creativeResult.creative;
        }
        if (body?.budget !== undefined) {
          const budgetResult = validateAdBudgetInput(body.budget);
          if (!budgetResult.ok || !budgetResult.budget) {
            return jsonError(400, budgetResult.error || 'Invalid budget.');
          }
          // spentUsd is server-maintained only — a budget patch merges
          // into the advertiser-controlled fields and never touches it.
          update.budget = { ...existing.budget, ...budgetResult.budget };
        }

        await adRef.set(update, { merge: true });
        const freshSnap = await adRef.get();
        return NextResponse.json(
          { ok: true, ad: { id: adRef.id, ...freshSnap.data() } },
          { status: 200, headers: { 'Cache-Control': 'no-store' } }
        );
      }

      case 'pause-ad':
      case 'resume-ad': {
        const { adId } = body || {};
        if (!isValidAdId(adId)) return jsonError(400, 'Missing or invalid adId.');

        const adRef = adPoolRef.doc(adId);
        const adSnap = await adRef.get();
        if (!adSnap.exists) return jsonError(404, 'Ad not found.');
        const existing = adSnap.data() as AdDoc;
        if (existing.ownerUid !== uid) return jsonError(403, 'You do not own this ad.');

        let nextStatus: AdStatus;
        if (action === 'pause-ad') {
          nextStatus = 'paused';
        } else {
          // Resuming only succeeds into 'live' if there's still
          // balance — otherwise it's honest about why the ad still
          // won't serve, same pattern as site-widget's liveStatus.
          const billingSnap = await billingRef.get();
          const balanceUsd = billingSnap.exists ? (billingSnap.data() as AdvertiserBillingDoc).balanceUsd || 0 : 0;
          nextStatus = balanceUsd > 0 ? 'live' : 'out_of_budget';
        }

        await adRef.set({ status: nextStatus, updatedAt: FieldValue.serverTimestamp() }, { merge: true });
        return NextResponse.json(
          { ok: true, ad: { id: adRef.id, status: nextStatus } },
          { status: 200, headers: { 'Cache-Control': 'no-store' } }
        );
      }

      case 'delete-ad': {
        const { adId } = body || {};
        if (!isValidAdId(adId)) return jsonError(400, 'Missing or invalid adId.');

        const adRef = adPoolRef.doc(adId);
        const adSnap = await adRef.get();
        if (!adSnap.exists) {
          // Already gone — same "treat a missing target as success"
          // idempotency as a repeated delete anywhere else in this
          // codebase; the advertiser's end state (this ad no longer
          // exists) is what they asked for either way.
          return NextResponse.json({ ok: true, adId }, { status: 200, headers: { 'Cache-Control': 'no-store' } });
        }
        const existing = adSnap.data() as AdDoc;
        if (existing.ownerUid !== uid) return jsonError(403, 'You do not own this ad.');

        // Deletes the AdDoc itself. Deliberately does NOT delete
        // adPool/{adId}/events/* (the raw impression/click log) —
        // those are historical fraud/appeals records tied to money
        // that already moved (see lib/adPool.ts's header and
        // app/api/ad-track/route.ts), and deleting an ad should not
        // be a way to erase that trail. A deleted ad's id simply
        // stops resolving (adPoolRef.doc(adId).get() -> !exists), so
        // /api/ad-serve can never select it again (it only ever reads
        // from live 'status' query results, never a stale id) and any
        // in-flight /api/ad-track call for it correctly 404s via its
        // existing 'unknown ad' path.
        await adRef.delete();

        return NextResponse.json({ ok: true, adId }, { status: 200, headers: { 'Cache-Control': 'no-store' } });
      }

      case 'list-ads': {
        // This is a composite query (ownerUid == uid, orderBy
        // createdAt) — Firestore requires a matching composite index
        // to exist and have FINISHED BUILDING before this query will
        // succeed; firestore.indexes.json declaring it is not the
        // same as it being deployed/live. If that index is missing or
        // still building, Firestore throws FAILED_PRECONDITION here,
        // which — before this try/catch existed — fell through to the
        // handler's generic catch, returned a 500 with no ad-specific
        // detail, and the frontend (hooks/useAdvertiser.ts) silently
        // treated any non-ok list-ads response as "ads: []" — so an
        // advertiser who had actually created ads saw "you don't have
        // any ads yet" with no indication anything was wrong. This
        // catch instead (a) falls back to an unordered query, which
        // needs no composite index (just the single-field index on
        // ownerUid Firestore maintains automatically) so ads a) still
        // show up immediately even before/without the composite index
        // existing, and (b) logs loudly and returns a distinct error
        // code so this failure mode is never silently confused with
        // "you truly have zero ads."
        try {
          const snap = await adPoolRef.where('ownerUid', '==', uid).orderBy('createdAt', 'desc').limit(100).get();
          const ads = snap.docs.map((d) => ({ id: d.id, ...d.data() }));
          return NextResponse.json({ ok: true, ads }, { status: 200, headers: { 'Cache-Control': 'no-store' } });
        } catch (err: any) {
          const code = err?.code ?? err?.status;
          const isIndexError =
            code === 9 /* FAILED_PRECONDITION (gRPC) */ ||
            code === 'failed-precondition' ||
            /index/i.test(String(err?.message || ''));
          console.error('[advertise] list-ads composite query failed', {
            uid,
            code,
            message: err?.message,
            isIndexError,
          });
          if (!isIndexError) throw err; // something else — let the outer catch handle it normally

          // Fallback: same filter, no orderBy, so it needs no
          // composite index — sort client-side-equivalent here
          // (in-process, after fetch) so the advertiser still sees
          // every one of their ads, just not guaranteed in
          // createdAt order until the real index finishes building.
          const fallbackSnap = await adPoolRef.where('ownerUid', '==', uid).limit(100).get();
          const ads = fallbackSnap.docs
            .map((d) => ({ id: d.id, ...d.data() }))
            .sort((a: any, b: any) => {
              const at = a.createdAt?._seconds ?? a.createdAt?.seconds ?? 0;
              const bt = b.createdAt?._seconds ?? b.createdAt?.seconds ?? 0;
              return bt - at;
            });
          return NextResponse.json(
            {
              ok: true,
              ads,
              warning:
                'ADS_LOADED_WITHOUT_INDEX: the ownerUid+createdAt composite index for adPool is missing or still building in Firestore — ads were fetched unsorted as a fallback. Deploy firestore.indexes.json (firebase deploy --only firestore:indexes) and wait for it to finish building to restore normal sorted listing.',
            },
            { status: 200, headers: { 'Cache-Control': 'no-store' } }
          );
        }
      }

      default:
        return jsonError(400, `Unknown action: ${clip(action, 60)}`);
    }
  } catch (err) {
    console.error('[advertise] handler error', err);
    return jsonError(500, 'Something went wrong processing that request.');
  }
}
