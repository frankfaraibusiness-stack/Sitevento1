// app/api/visit-end/route.ts
//
// POST { siteId, visitorId, visitId, scrollDepthPct, activeSeconds, validClicks }
//
// Exactly ONE beacon per page view, fired by public/sitevento.js on
// pagehide / visibilitychange-hidden (whichever fires first — see the
// client's own comment on why both are wired up). Patches the SAME
// visit doc app/api/track already created for this page view
// (users/{uid}/sites/{siteId}/visits/{visitId}) with three numbers
// that only make sense once the page view is over:
//
//   - scrollDepthPct  — deepest scroll position reached, 0–100
//   - activeSeconds   — time the tab was actually visible/foregrounded
//                        (via the Page Visibility API), not wall-clock
//                        time since load — a visitor who opens the tab
//                        and tabs away for an hour does not show as an
//                        hour of "engagement"
//   - validClicks     — clicks judged human-paced by the same
//                        MIN_HUMAN_CLICK_GAP_MS gate lib/botShield.ts
//                        already uses for SECURITY BOT (see
//                        public/sitevento.js's client-side mirror of
//                        that same 120ms floor) — NOT a raw click
//                        count, so a scripted click burst doesn't
//                        inflate this number for the owner's own
//                        "engaged visitor" read
//
// ── Why one beacon, not one write per scroll tick / click ───────────
// Scroll depth and click count are accumulated client-side, in plain
// JS variables, for the ENTIRE page view — zero network calls while
// that's happening. Only the final numbers are sent, once, when the
// visitor leaves. That keeps this at a flat +1 write per visit (on top
// of the one /api/track already does) no matter how long someone
// stays on the page or how many times they scroll/click — the same
// "never multiply writes with engagement" constraint every other
// metered route in this app (click-track, overlay-track) already
// follows. Gated through the exact same hard daily token cap as every
// other billed widget action (assertWidgetTokensAllowed /
// pausedWidgetResponse), priced at tokenCost('visitEnd') — see
// lib/limits.ts's own comment on why that's priced like a plain visit
// check despite covering a whole page view's worth of data.
//
// ── Delivery is best-effort, by design ───────────────────────────────
// sendBeacon/fetch-keepalive on pagehide is not guaranteed to land —
// some fraction of real visits (closed via force-quit, OS killing a
// backgrounded mobile tab, a flaky network at exactly the wrong
// moment) will never produce this beacon at all. That is an accepted,
// understood gap: a visit doc with no scrollDepthPct/activeSeconds/
// validClicks fields just means "no engagement summary for this
// visit", not "this visitor did nothing" — see lib/types.ts's Visit
// interface for the exact same framing. Nothing downstream may treat
// a missing value here as zero.
//
// Always 200, CORS wide open, same "never surface infra trouble to a
// real visitor's page" contract as every other beacon endpoint.
import { NextRequest, NextResponse } from 'next/server';
import { getAdminDb } from '@/lib/firebaseAdmin';
import { assertWidgetTokensAllowed, pausedWidgetResponse, WidgetTokenBlockedError } from '@/lib/serverAuth';
import { tokenCost } from '@/lib/limits';
import { allow } from '@/lib/rateLimit';
import { FieldValue } from 'firebase-admin/firestore';

export const maxDuration = 10;
export const runtime = 'nodejs';

const CORS_HEADERS = {
  'Access-Control-Allow-Origin': '*',
  'Access-Control-Allow-Methods': 'POST, OPTIONS',
  'Access-Control-Allow-Headers': 'Content-Type',
  'Cache-Control': 'no-store',
};

// Small body — three numbers and two ids, same budget class as
// click-track's beacon.
const MAX_BODY_BYTES = 2 * 1024;

// Mirrors app/api/track's / app/api/click-track's own VISITOR_ID_RE —
// same shape the loader actually generates (see public/sitevento.js).
// This field is informational only here (nothing is looked up or keyed
// on it — the patch goes to visitId, not visitorId), so this check
// exists purely to reject an obviously-malformed value early rather
// than storing it.
const VISITOR_ID_RE = /^v[a-z0-9]{6,40}$/i;
// Firestore auto-ids are 20 alphanumeric characters, but this is kept
// loose (any reasonable-length alphanumeric token) rather than hard-
// coded to 20 in case that ever changes — the real safety property is
// "this must belong to the site we resolve below", which the update()
// call's own path already enforces: a wrong/foreign id just fails to
// match an existing doc and the update is a harmless no-op.
const VISIT_ID_RE = /^[A-Za-z0-9_-]{8,80}$/;

function clampPct(v: unknown): number | null {
  if (typeof v !== 'number' || !isFinite(v)) return null;
  return Math.max(0, Math.min(100, Math.round(v)));
}

function clampNonNegInt(v: unknown, max: number): number | null {
  if (typeof v !== 'number' || !isFinite(v) || v < 0) return null;
  return Math.min(Math.round(v), max);
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

    const { siteId, visitorId, visitId, scrollDepthPct, activeSeconds, validClicks } = body || {};

    if (!siteId || typeof siteId !== 'string' || siteId.length > 100) {
      return NextResponse.json({ ok: false, reason: 'missing siteId' }, { status: 200, headers: CORS_HEADERS });
    }
    if (!visitId || typeof visitId !== 'string' || !VISIT_ID_RE.test(visitId)) {
      // No usable doc to patch — same "accept and do nothing" shape
      // click-track uses for a missing visitorId: nothing worth
      // charging a token for.
      return NextResponse.json({ ok: true, counted: false }, { status: 200, headers: CORS_HEADERS });
    }
    if (visitorId !== undefined && (typeof visitorId !== 'string' || !VISITOR_ID_RE.test(visitorId))) {
      return NextResponse.json({ ok: false, reason: 'invalid visitorId' }, { status: 200, headers: CORS_HEADERS });
    }

    const forwardedForHeader = req.headers.get('x-forwarded-for') || '';
    const callerIp = forwardedForHeader.split(',')[0].trim() || 'unknown';
    if (!allow(`visit-end:${siteId}:${callerIp}`, 120, 60_000)) {
      return NextResponse.json({ ok: false, reason: 'rate limited' }, { status: 200, headers: CORS_HEADERS });
    }

    let db;
    try {
      db = getAdminDb();
    } catch (err) {
      console.error('[visit-end] Firebase Admin init error', err);
      return NextResponse.json({ ok: false, reason: 'server not configured' }, { status: 200, headers: CORS_HEADERS });
    }

    let resolved;
    try {
      resolved = await assertWidgetTokensAllowed(db, siteId, tokenCost('visitEnd'));
    } catch (err) {
      if (err instanceof WidgetTokenBlockedError) {
        return pausedWidgetResponse(CORS_HEADERS);
      }
      throw err;
    }
    if (!resolved) {
      return NextResponse.json({ ok: false, reason: 'unknown site' }, { status: 200, headers: CORS_HEADERS });
    }
    const { uid } = resolved;

    const siteRef = db.collection('users').doc(uid).collection('sites').doc(siteId);
    const visitRef = siteRef.collection('visits').doc(visitId);

    const patch: Record<string, unknown> = { endedAt: FieldValue.serverTimestamp() };
    const scroll = clampPct(scrollDepthPct);
    if (scroll !== null) patch.scrollDepthPct = scroll;
    // 3-hour ceiling: a single page view reporting more than that is
    // almost certainly a tab left open overnight rather than genuine
    // continuous engagement — capped, not dropped, so it still shows
    // up as "a lot of active time" without skewing an average with an
    // outlier of arbitrary size.
    const active = clampNonNegInt(activeSeconds, 3 * 60 * 60);
    if (active !== null) patch.activeSeconds = active;
    // Generous but finite ceiling on a single page view's valid-click
    // count — same spirit as the activeSeconds cap above, guards
    // against one corrupt/replayed beacon distorting an owner's
    // averages without this route itself re-deciding what "valid"
    // means (that judgment already happened client-side, mirroring
    // SECURITY BOT's own human-timing gate — see this file's header).
    const clicks = clampNonNegInt(validClicks, 500);
    if (clicks !== null) patch.validClicks = clicks;

    // update(), not set(/merge) — a visit-end beacon for a visitId
    // that doesn't exist (wrong id, doc write from /api/track somehow
    // never landed, or this beacon arrived for a different site's
    // visit) must NOT create a new, mostly-empty visit doc. update()
    // on a missing doc rejects instead, which the .catch below treats
    // as a harmless no-op — exactly the outcome we want.
    try {
      await visitRef.update(patch);
    } catch (err) {
      // Most common cause: the visit doc doesn't exist (bad/foreign
      // visitId) — not a real error, just nothing to patch. Still
      // logged at a lower level than a genuine infra failure would be,
      // since this is expected to happen some of the time (e.g. a
      // visit beacon that itself got rejected — paused site, blocked
      // visitor — never produced a doc to patch in the first place).
      console.log('[visit-end] update skipped (no matching visit doc) for', visitRef.path, (err as Error)?.message);
    }

    return NextResponse.json({ ok: true, counted: true }, { status: 200, headers: CORS_HEADERS });
  } catch (err) {
    console.error('[visit-end] handler error', err);
    return NextResponse.json({ ok: false }, { status: 200, headers: CORS_HEADERS });
  }
}
