// app/api/ingest/route.ts
//
// POST, Authorization: Bearer sv_live_... (or sv_test_...)
//
// The DEEP SERVER-SIDE DATA endpoint: lets a site's own BACKEND push
// analytics the embedded public/sitevento.js script tag can never see
// in the first place — order totals, a logged-in customer id/email,
// CRM/lifecycle stage, refunds, server-computed LTV, internal funnel
// steps, literally anything the owner's server knows. Deliberately
// the opposite shape from every other route in app/api/*:
//
//   - Every existing beacon route (track, click-track, visit-end,
//     overlay-track, ad-track...) is called FROM A STRANGER'S BROWSER,
//     so it must be forgiving of malformed/missing fields, answer 200
//     always, and authenticate the VISITOR (via a signed, per-site
//     visitorToken — see lib/visitorIdentity.ts) rather than the site
//     owner.
//   - This route is called from the SITE OWNER'S OWN SERVER (their
//     Node/Python/whatever backend, never a browser — there is no CORS
//     story here on purpose; a secret key must never be embedded in
//     anything that ships to a browser). Auth is the account-level key
//     itself (lib/apiKeys.ts) — simple on purpose, see that file's
//     header for why this is NOT the same per-site signed-token model
//     everything else uses. A bad/missing key is a real 401, not a
//     soft always-200 — there is no visitor-facing page whose loading
//     this could ever block, so there's no reason to hide the error.
//
// ── \"Everything accepted\" ────────────────────────────────────────────
// The payload shape is intentionally NOT a fixed schema. Any JSON
// object under `data` is stored as-is (size-capped below) — the whole
// point is that this app cannot anticipate every field a given site's
// backend might want to send (order id, plan tier, warehouse region,
// whatever). `event` (a short label) and `visitorId`/`userId`
// (freeform — this app's own visitorId if the caller has it, OR the
// site's own internal customer id, OR both) are the only fields this
// route gives any special meaning to; everything else under `data`
// round-trips untouched to Firestore and back out through
// /api/platform-stats-style reads (hooks/useApiEvents.ts) for the
// dashboard to render however it can.
//
// ── Billing ───────────────────────────────────────────────────────────
// Reuses the EXACT SAME monthly-visit allowance + overage-wallet
// system every pageview already draws against
// (checkAndIncrementAccountVisits — see lib/visits.ts /
// lib/serverAuth.ts's header) rather than inventing a third usage
// model. One API ingest call = one visit, same price. That is a
// deliberate simplification (a rich 50-field payload costs the same
// one \"visit\" as a 2-field one) in exchange for not needing a second
// quota, a second wallet, and a second pricing page row — exactly in
// the spirit of \"make server side simple.\" A sv_test_ key still runs
// through the same billing (so load-testing a test key can't be used
// to bypass the cap) but every write is tagged `test: true` so
// real-data views can filter it out.
import { NextRequest, NextResponse } from 'next/server';
import { FieldValue } from 'firebase-admin/firestore';
import { getAdminDb } from '@/lib/firebaseAdmin';
import { allow } from '@/lib/rateLimit';
import { resolveApiKey } from '@/lib/apiKeys';
import { getCallerPlan, checkAndIncrementAccountVisits, VisitLimitReachedError, visitLimitResponse, jsonError } from '@/lib/serverAuth';

export const maxDuration = 10;
export const runtime = 'nodejs';

// 64KB is generous for "anything accepted" freeform JSON while still
// ruling out someone using this as a free blob-storage endpoint —
// matches the ceiling app/api/user-action already uses for its own
// (also fairly open-ended) payload field.
const MAX_BODY_BYTES = 64 * 1024;
const MAX_EVENT_LEN = 200;
const MAX_ID_LEN = 200;

export async function OPTIONS() {
  // No CORS here on purpose — see this file's header. A browser
  // preflight hitting this route is itself a signal of misuse (a
  // secret key belongs in a backend, never in page JS), so there's
  // nothing to advertise permission for.
  return new NextResponse(null, { status: 204 });
}

export async function POST(req: NextRequest) {
  try {
    const contentLength = Number(req.headers.get('content-length') || 0);
    if (contentLength > MAX_BODY_BYTES) {
      return jsonError(413, 'Payload too large (64KB max).');
    }
    const raw = await req.text();
    if (raw.length > MAX_BODY_BYTES) {
      return jsonError(413, 'Payload too large (64KB max).');
    }

    const authHeader = req.headers.get('authorization') || '';
    const bearerMatch = authHeader.match(/^Bearer\s+(.+)$/i);
    const apiKey = bearerMatch ? bearerMatch[1].trim() : null;
    if (!apiKey) {
      return jsonError(401, 'Missing Authorization: Bearer <api key> header.');
    }

    let db;
    try {
      db = getAdminDb();
    } catch (err) {
      console.error('[ingest] Firebase Admin init error', err);
      return jsonError(503, 'Server not configured.');
    }

    const resolved = await resolveApiKey(db, apiKey);
    if (!resolved) {
      return jsonError(401, 'Invalid or revoked API key.');
    }
    const { uid, kind } = resolved;

    // Abuse protection on the key itself, independent of the per-site
    // IP-keyed limits every browser-facing beacon uses — this is a
    // server-to-server caller so there's no useful IP to key on (could
    // be the owner's whole fleet behind one NAT/load balancer), key on
    // the credential instead. Generous ceiling (600/min) since a real
    // backend integration may batch-send on its own schedule.
    if (!allow(`ingest:${uid}`, 600, 60_000)) {
      return jsonError(429, 'Rate limit exceeded for this API key.');
    }

    let body: any = {};
    try {
      body = raw ? JSON.parse(raw) : {};
    } catch {
      return jsonError(400, 'Invalid JSON body.');
    }
    if (!body || typeof body !== 'object' || Array.isArray(body)) {
      return jsonError(400, 'Body must be a JSON object.');
    }

    const event = typeof body.event === 'string' && body.event.trim() ? body.event.trim().slice(0, MAX_EVENT_LEN) : 'event';
    const visitorId = typeof body.visitorId === 'string' ? body.visitorId.slice(0, MAX_ID_LEN) : null;
    const userId = typeof body.userId === 'string' ? body.userId.slice(0, MAX_ID_LEN) : null;
    const siteId = typeof body.siteId === 'string' ? body.siteId.slice(0, MAX_ID_LEN) : null;
    // "Everything accepted": whatever's left is stored untouched under
    // `data`, EXCEPT the four fields above (lifted out so they get
    // their own indexed top-level columns the dashboard can filter/
    // group on) and anything the caller might try to pass as `data`
    // itself (ignored in favor of the rest of the body, so a caller
    // can send either `{event, data: {...}}` or a flat
    // `{event, foo, bar}` and get the same result).
    const { event: _e, visitorId: _v, userId: _u, siteId: _s, data: _d, ...rest } = body;
    const data = body.data && typeof body.data === 'object' && !Array.isArray(body.data) ? { ...rest, ...body.data } : rest;

    const planId = await getCallerPlan(db, uid);

    let usage;
    try {
      usage = await checkAndIncrementAccountVisits(db, uid, planId, 1);
    } catch (err) {
      if (err instanceof VisitLimitReachedError) {
        return visitLimitResponse(planId, err);
      }
      throw err;
    }

    const eventRef = db.collection('users').doc(uid).collection('apiEvents').doc();
    await eventRef.set({
      event,
      visitorId,
      userId,
      siteId,
      data,
      test: kind === 'test',
      receivedAt: FieldValue.serverTimestamp(),
    });

    return NextResponse.json(
      { ok: true, id: eventRef.id, test: kind === 'test', usage: { used: usage.used, limit: usage.limit } },
      { status: 200 }
    );
  } catch (err) {
    console.error('[ingest] handler error', err);
    return jsonError(500, 'Internal error.');
  }
}
