// app/api/visit-end/route.ts
//
// POST { siteId, visitorToken, siteToken, visitId, scrollDepthPct, activeSeconds, validClicks, pageLoadMs, rageClicks }
//
// siteToken, when present and valid, resolves uid with ZERO Firestore
// reads — see lib/visitorIdentity.ts's "Site token" section. It's the
// same (siteId, uid) pair /api/track already resolved and signed for
// this exact page view, just handed back instead of re-derived via
// another siteIndex lookup. Falls back to the normal siteIndex read
// whenever it's missing/invalid/expired, so nothing about this route's
// correctness depends on it ever being present.
//
// visitorToken is verified the same way /api/click-track verifies it
// (see lib/visitorIdentity.ts) rather than trusting a bare visitorId —
// kept for consistency with the rest of the identity-is-server-side
// change, even though the resulting visitorId is purely informational
// on THIS route (see the "lower-risk" note further down): nothing here
// is looked up or keyed on it, the patch goes to visitId, not
// visitorId. An absent or failed-verification token just means no
// visitorId is logged for this patch — it never blocks the patch
// itself, since the real security boundary is visitId (an opaque
// Firestore doc id scoped to the right site via siteRef below).
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
//   - pageLoadMs      — real Navigation Timing loadEventEnd, only ever
//                        present on the first beacon for an actual
//                        page load (never resent on an SPA route
//                        change's own visit-end)
//   - rageClicks      — count of DISTINCT elements this page view
//                        rage-clicked (3+ rapid clicks on the same
//                        element — see public/sitevento.js's
//                        onRageClickCheck) — a signal something may be
//                        unresponsive, not a confirmed bug
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
// follows. Carries no usage charge of its own under the visit model —
// it patches the SAME visit doc /api/track already charged one visit
// for, so this beacon's cost is absorbed into that one visit rather
// than billed again.
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
import { allow } from '@/lib/rateLimit';
import { FieldValue } from 'firebase-admin/firestore';
import { verifyVisitorToken, verifySiteToken } from '@/lib/visitorIdentity';

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

    const { siteId, visitorToken, siteToken, visitId, scrollDepthPct, activeSeconds, validClicks, pageLoadMs, rageClicks } = body || {};

    if (!siteId || typeof siteId !== 'string' || siteId.length > 100) {
      return NextResponse.json({ ok: false, reason: 'missing siteId' }, { status: 200, headers: CORS_HEADERS });
    }
    if (!visitId || typeof visitId !== 'string' || !VISIT_ID_RE.test(visitId)) {
      // No usable doc to patch — same "accept and do nothing" shape
      // click-track uses for a missing visitorId.
      return NextResponse.json({ ok: true, counted: false }, { status: 200, headers: CORS_HEADERS });
    }
    // Verified, not trusted bare — but a missing/invalid token is NOT
    // fatal here the way it would be for click-track: this route has
    // nothing security-sensitive keyed on visitorId (see header), so
    // we just end up patching the visit doc without one, same as if
    // the field had never been sent at all.
    const verified = verifyVisitorToken(visitorToken, siteId);
    const visitorId: string | null = verified?.visitorId ?? null;

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

    // siteToken first: /api/track (which always fires before this, for
    // the same page view — see this route's header) already resolved
    // and signed this exact (siteId, uid) pair moments earlier. A
    // verified token means zero Firestore reads to get uid. Falls back
    // to the normal siteIndex lookup on anything else (no token sent —
    // an old cached loader build, or /api/track's own call this page
    // view never completed for some reason — expired, or a failed
    // verification) — same "never partially trust it, fall back exactly
    // as if nothing were sent" contract verifyVisitorToken already
    // follows elsewhere in this app. See lib/visitorIdentity.ts's "Site
    // token" section for the full reasoning.
    const verifiedSite = verifySiteToken(siteToken, siteId);
    let uid: string | null = verifiedSite?.uid ?? null;
    if (!uid) {
      const indexSnap = await db.collection('siteIndex').doc(siteId).get();
      uid = indexSnap.exists ? indexSnap.data()?.uid ?? null : null;
    }
    if (!uid) {
      return NextResponse.json({ ok: false, reason: 'unknown site' }, { status: 200, headers: CORS_HEADERS });
    }

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
    // 2-minute ceiling — a real loadEventEnd this large is almost
    // certainly a tab that was backgrounded mid-load (the load event
    // can be delayed indefinitely by browser throttling in that case)
    // rather than genuine load time, same capped-not-dropped treatment
    // as activeSeconds/validClicks above.
    const loadMs = clampNonNegInt(pageLoadMs, 2 * 60 * 1000);
    if (loadMs !== null) patch.pageLoadMs = loadMs;
    // Distinct elements, not raw clicks — naturally small (see
    // public/sitevento.js's onRageClickCheck), so this cap exists only
    // to reject a corrupt/replayed value, same spirit as the others.
    const rage = clampNonNegInt(rageClicks, 200);
    if (rage !== null) patch.rageClicks = rage;

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
      console.log(
        '[visit-end] update skipped (no matching visit doc) for',
        visitRef.path,
        'visitorId=',
        visitorId ?? '(none/unverified)',
        (err as Error)?.message
      );
    }

    return NextResponse.json({ ok: true, counted: true }, { status: 200, headers: CORS_HEADERS });
  } catch (err) {
    console.error('[visit-end] handler error', err);
    return NextResponse.json({ ok: false }, { status: 200, headers: CORS_HEADERS });
  }
}
