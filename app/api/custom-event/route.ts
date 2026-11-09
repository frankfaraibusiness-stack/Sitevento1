// app/api/custom-event/route.ts
//
// POST { siteId, visitorToken, name, properties?, path?, sessionId? }
//
// The CLIENT-SIDE twin of app/api/ingest (see that route's header for
// the server-to-server "deep data" channel). This one exists because
// the embed script's own auto-detection — rage clicks, the generic
// human-paced "valid click" count, scroll depth — can tell THAT
// something happened on the page, never WHAT. It has no idea a given
// <button> means "Upgrade to Pro" vs "Dismiss banner." This route lets
// the site owner say so themselves, from their own page, via the
// public window.sitevento('track', name, properties) function
// public/sitevento.js now exposes (see that file's header for the
// function itself).
//
// ── Auth: visitorToken, NOT an API key ───────────────────────────────
// This is called FROM A STRANGER'S BROWSER (same as /api/track,
// /api/click-track, /api/visit-end), so unlike /api/ingest it can
// never hold a secret — anyone can view-source a page and see whatever
// this call sends. Auth here is the same signed, per-site
// visitorToken every other visitor-facing beacon already requires
// (lib/visitorIdentity.ts) — proves "a real tracked page view from
// THIS site already happened," not "this caller is the site owner."
// That is a deliberately weaker guarantee than /api/ingest's secret
// key, and is exactly why dashboard logic that cares about real
// revenue/billing state should live in the SERVER-SIDE channel
// instead — a custom event is "a visitor's browser said X happened,"
// trustworthy for product analytics, not for anything money-adjacent.
//
// ── "Everything accepted" properties, size-capped ───────────────────
// Same spirit as /api/ingest's freeform `data`: `properties` is stored
// as whatever JSON object the page passed, no fixed schema — but
// capped much smaller here (4KB vs ingest's 64KB) since this is a
// high-frequency beacon from an untrusted browser, not a deliberate
// backend integration call.
//
// ── Billing ───────────────────────────────────────────────────────────
// No longer metered through the daily widget-token cap
// (assertWidgetTokensAllowed/tokenCost — the retired token-billing
// model). The app is visit-based now; the account's real enforcement
// (assertWidgetVisitsAllowed) already ran in app/api/track for this
// same page view. This route just resolves siteId -> uid with a plain
// read. See app/api/click-track's header for the full reasoning.
import { NextRequest, NextResponse } from 'next/server';
import { getAdminDb } from '@/lib/firebaseAdmin';
import { FieldValue } from 'firebase-admin/firestore';
import { allow } from '@/lib/rateLimit';
import { verifyVisitorToken } from '@/lib/visitorIdentity';

export const maxDuration = 10;
export const runtime = 'nodejs';

const CORS_HEADERS = {
  'Access-Control-Allow-Origin': '*',
  'Access-Control-Allow-Methods': 'POST, OPTIONS',
  'Access-Control-Allow-Headers': 'Content-Type',
};

const MAX_BODY_BYTES = 6 * 1024;
const MAX_PROPERTIES_BYTES = 4 * 1024;
const MAX_NAME_LEN = 200;
const MAX_PATH_LEN = 500;
const MAX_SESSION_LEN = 100;

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

    const { siteId, visitorToken, sessionId } = body || {};
    if (!siteId || typeof siteId !== 'string' || siteId.length > 100) {
      return NextResponse.json({ ok: false, reason: 'missing siteId' }, { status: 200, headers: CORS_HEADERS });
    }
    if (typeof body.name !== 'string' || !body.name.trim()) {
      return NextResponse.json({ ok: false, reason: 'missing name' }, { status: 200, headers: CORS_HEADERS });
    }
    const name = body.name.trim().slice(0, MAX_NAME_LEN);
    const path = typeof body.path === 'string' ? body.path.slice(0, MAX_PATH_LEN) : '';

    let properties: Record<string, unknown> = {};
    if (body.properties !== undefined) {
      if (typeof body.properties !== 'object' || body.properties === null || Array.isArray(body.properties)) {
        return NextResponse.json({ ok: false, reason: 'properties must be an object' }, { status: 200, headers: CORS_HEADERS });
      }
      const serialized = JSON.stringify(body.properties);
      if (serialized.length > MAX_PROPERTIES_BYTES) {
        return NextResponse.json({ ok: false, reason: 'properties too large' }, { status: 200, headers: CORS_HEADERS });
      }
      properties = body.properties;
    }

    // Same requirement /api/click-track already enforces: a bare,
    // unsigned visitorId is never accepted here — by the time ANY
    // custom-event call can legitimately fire, this page load has
    // already completed at least one /api/track round trip (the
    // public sitevento() function itself waits on onIdentityReady
    // before sending — see public/sitevento.js), so a request with no
    // valid token is either a mis-wired integration or spoofed, and
    // is silently ignored rather than partially trusted.
    const verified = verifyVisitorToken(visitorToken, siteId);
    if (!verified) {
      return NextResponse.json({ ok: true, counted: false }, { status: 200, headers: CORS_HEADERS });
    }
    const visitorId = verified.visitorId;

    const forwardedForHeader = req.headers.get('x-forwarded-for') || '';
    const callerIp = forwardedForHeader.split(',')[0].trim() || 'unknown';
    if (!allow(`custom-event:${siteId}:${callerIp}`, 120, 60_000)) {
      return NextResponse.json({ ok: false, reason: 'rate limited' }, { status: 200, headers: CORS_HEADERS });
    }

    let db;
    try {
      db = getAdminDb();
    } catch (err) {
      console.error('[custom-event] Firebase Admin init error', err);
      return NextResponse.json({ ok: false, reason: 'server not configured' }, { status: 200, headers: CORS_HEADERS });
    }

    // siteId → uid, plain read-only lookup. No daily widget-token cap
    // here anymore (assertWidgetTokensAllowed/tokenCost — the retired
    // token-billing model): the app is visit-based now, and the
    // account's real enforcement (assertWidgetVisitsAllowed) already
    // ran in app/api/track for this same page view. See
    // app/api/click-track's header for the full reasoning; this route
    // is changed the same way.
    const indexSnap = await db.collection('siteIndex').doc(siteId).get();
    const uid: string | null = indexSnap.exists ? indexSnap.data()?.uid ?? null : null;
    if (!uid) {
      return NextResponse.json({ ok: false, reason: 'unknown site' }, { status: 200, headers: CORS_HEADERS });
    }

    const siteRef = db.collection('users').doc(uid).collection('sites').doc(siteId);
    const siteSnap = await siteRef.get();
    if (!siteSnap.exists) {
      return NextResponse.json({ ok: false, reason: 'unknown site' }, { status: 200, headers: CORS_HEADERS });
    }
    const site = siteSnap.data()!;
    if (site.status !== 'verified' || site.paused === true) {
      return NextResponse.json({ ok: false, reason: 'site not active' }, { status: 200, headers: CORS_HEADERS });
    }

    // A visitor already blocked/restricted by SECURITY BOT shouldn't
    // get their custom events recorded any more than their pageviews
    // would be — same early-out /api/track and /api/click-track both
    // use. This still happened AFTER the token-cap debit above: the
    // owner is charged for having received the call at all, same
    // reasoning as click-track's own early-out.
    const blockedSnap = await siteRef.collection('blockedVisitors').doc(visitorId).get().catch(() => null);
    const blockedData = blockedSnap && blockedSnap.exists ? blockedSnap.data() : null;
    const restrictedUntilTs = typeof blockedData?.restrictedUntil === 'number' ? blockedData.restrictedUntil : null;
    const alreadyBlocked = !!blockedData && (restrictedUntilTs === null || restrictedUntilTs > Date.now());
    if (alreadyBlocked) {
      return NextResponse.json({ ok: true, counted: false, blocked: true }, { status: 200, headers: CORS_HEADERS });
    }

    const eventRef = siteRef.collection('customEvents').doc();
    await eventRef.set({
      name,
      properties,
      path,
      visitorId,
      sessionId: typeof sessionId === 'string' ? sessionId.slice(0, MAX_SESSION_LEN) : null,
      ts: FieldValue.serverTimestamp(),
    });

    return NextResponse.json({ ok: true, counted: true, id: eventRef.id }, { status: 200, headers: CORS_HEADERS });
  } catch (err) {
    console.error('[custom-event] handler error', err);
    return NextResponse.json({ ok: false }, { status: 200, headers: CORS_HEADERS });
  }
}
