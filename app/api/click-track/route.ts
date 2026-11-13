// app/api/click-track/route.ts
//
// POST { siteId, visitorToken }
//
// NOT called per click anymore. public/sitevento.js now keeps a
// per-page, in-memory rolling window of click timestamps (zero network
// calls — same "accumulate locally, only talk to the server when it
// matters" shape as its heatmap sampling and engagement-tracking
// blocks) and only POSTs here the first time that LOCAL judgment
// crosses 'moderate' or 'severe' for the current click run — see that
// file's own "1c. CLICK TRACKING" header for the full reasoning this
// change was made for: the old call-every-click version cost a real
// Firestore read+write on every single click, which for a page with
// dozens of honest clicks (a configurator, a multi-step form, a game)
// meant dozens of wasted reads/writes for traffic that was obviously
// human. Beaconing only on a suspected escalation cuts that to
// approximately zero for normal visitors while leaving detection
// itself untouched.
//
// Critically, the client's local judgment is NEVER trusted as the
// actual verdict — it only decides WHEN to call this route, not
// WHETHER to restrict/block. This route still runs the real,
// authoritative check (via applyBotShield, against this visitor's own
// server-held rolling state, using the owner's actual configured
// thresholds — see lib/botShield.ts's BOT_SHIELD_THRESHOLDS.click,
// default 50 clicks/60s → restrict, 100 clicks/60s → block, both
// owner-configurable) every single time it IS called. A forged or
// stale client-side guess can at most trigger one extra (harmless)
// server round trip or arrive one click later than a tighter owner
// override would have liked — it can never cause a missed detection,
// since the server re-derives its own verdict from its own data on
// every call it receives, same as before this change.
//
// This is the "click" half of SECURITY BOT's Refresh & Click Shield
// (the "refresh"/pageview half is app/api/track) — before this route
// existed, nothing ever sent a 'click' event into lib/botShield.ts's
// engine, so the click thresholds in BOT_SHIELD_THRESHOLDS were dead
// code that could never fire. This route is what actually feeds them.
//
// Deliberately NOT folded into /api/track itself: that route does a
// full visit-doc write (device/geo/device-recovery — see its own
// header), which is far more than click judging needs. This route does
// the minimum required to judge click timing — no visit doc, no
// device recovery.
//
// ── No daily token cap here anymore ──────────────────────────────────
// This used to also be gated through the account's daily widget-token
// cap (assertWidgetTokensAllowed/tokenCost('clickTrack') —
// lib/serverAuth.ts's token-billing model). That model is retired: the
// app is visit-based now, not token-based, so this route no longer
// calls it — just a plain siteIndex → uid read, same as before but
// without the usage-check transaction on top. The functions themselves
// are untouched in lib/serverAuth.ts/lib/limits.ts, kept but unused,
// in case a future billing model wants them back. The account's real,
// current enforcement is assertWidgetVisitsAllowed in app/api/track,
// which already ran for this same page view before this click could
// even happen — that's what still gates/pauses an over-limit account;
// this route's own rate limit (allow(), right below) is what guards
// against raw request-volume abuse on this specific endpoint now.
//
// ── What gets judged ───────────────────────────────────────────────
// lib/botShield.ts's 'click' kind does two independent checks on every
// call:
//   1. Burst count — 5 clicks within 60s restricts for 1 hour, 10
//      within 60s blocks instantly (same numbers/shape as pageview).
//   2. Per-click human-timing gap — MIN_HUMAN_CLICK_GAP_MS (120ms).
//      Any click that lands less than that after the visitor's
//      previous recorded click is, on its own, already bot-shaped
//      evidence (no real pointer/tap can move and re-press that fast)
//      and escalates straight to at least a restrict — see
//      evaluateBurst's header comment in lib/botShield.ts.
// Both checks run through the exact same applyBotShield/blockedVisitors
// enforcement path /api/track already uses for pageviews, so a click-
// triggered restrict/block is enforced the SAME WAY everywhere else
// already reads it (the next pageview beacon from this visitor comes
// back blocked too, not just future clicks) — AND, once blocked/
// restricted, this route's own early-out below means that visitor's
// FURTHER clicks stop costing the owner anything at all (see
// alreadyBlocked below — no token-cap charge, no SECURITY BOT
// transaction, just an immediate "still blocked" reply).
//
// Always 200, CORS wide open, same "never surface infra trouble to a
// real visitor's page" contract as every other beacon endpoint here —
// a paused account answers `{ ok:false, code:'PAUSED' }` in the body,
// never an HTTP error status.
import { NextRequest, NextResponse } from 'next/server';
import { getAdminDb } from '@/lib/firebaseAdmin';
import { allow } from '@/lib/rateLimit';
import { getBotShieldConfig } from '@/lib/botShieldConfig';
import { applyBotShield } from '@/lib/botShieldEnforce';
import { verifyVisitorToken } from '@/lib/visitorIdentity';

export const maxDuration = 10;
export const runtime = 'nodejs';

const CORS_HEADERS = {
  'Access-Control-Allow-Origin': '*',
  'Access-Control-Allow-Methods': 'POST, OPTIONS',
  'Access-Control-Allow-Headers': 'Content-Type',
};

const MAX_BODY_BYTES = 2 * 1024;

// A click beacon now requires a visitorToken THIS SERVER previously
// signed (see lib/visitorIdentity.ts) — a bare visitorId is no longer
// accepted here at all. Unlike /api/track, this route has no
// legacy-loader migration path: the click listener only ever beacons
// once identityReady has already resolved (see
// public/sitevento.js's click handler, gated on `if (!visitorId)
// return`), so by the time ANY click beacon is sent, that same page
// load has already completed at least one /api/track round trip and
// therefore already holds a real token — there's no legitimate
// "first-ever beacon with only a bare legacy id" case to support here
// the way there is for /api/track itself. Rejecting a bare/forged id
// outright (rather than silently falling back to an IP-keyed bucket)
// matters specifically because this result feeds blockedVisitors: a
// spoofed visitorId here could otherwise be used to get a DIFFERENT,
// real visitor wrongly restricted or blocked.

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

    const { siteId, visitorToken } = body || {};
    if (!siteId || typeof siteId !== 'string' || siteId.length > 100) {
      return NextResponse.json({ ok: false, reason: 'missing siteId' }, { status: 200, headers: CORS_HEADERS });
    }
    const verified = verifyVisitorToken(visitorToken, siteId);
    if (!verified) {
      // No verified visitor identity — nothing to key a burst/gap
      // check on, and nothing worth charging the owner a token for.
      // Same fail-open shape as formFloodGuard's "no ip and no
      // visitorId" branch: silently accept and do nothing. A present
      // but invalid/forged token is treated exactly the same as no
      // token at all — never partially trusted.
      return NextResponse.json({ ok: true, counted: false }, { status: 200, headers: CORS_HEADERS });
    }
    const visitorId = verified.visitorId;

    // Abuse protection on the endpoint itself (distinct from the
    // SECURITY BOT judgment below, which is about THIS VISITOR's click
    // pattern) — caps raw request volume per IP+site BEFORE it ever
    // touches Firestore or the token cap, same shape and limit as
    // /api/track's own guard.
    const forwardedForHeader = req.headers.get('x-forwarded-for') || '';
    const callerIp = forwardedForHeader.split(',')[0].trim() || 'unknown';
    if (!allow(`click-track:${siteId}:${callerIp}`, 120, 60_000)) {
      return NextResponse.json({ ok: false, reason: 'rate limited' }, { status: 200, headers: CORS_HEADERS });
    }

    let db;
    try {
      db = getAdminDb();
    } catch (err) {
      console.error('[click-track] Firebase Admin init error', err);
      return NextResponse.json({ ok: false, reason: 'server not configured' }, { status: 200, headers: CORS_HEADERS });
    }

    // siteId → uid, plain read-only lookup. The daily widget-token cap
    // (assertWidgetTokensAllowed/tokenCost — the token-based billing
    // model) is retired from this route: this app is visit-based now,
    // not token-based, and that check cost a real Firestore
    // read+transaction on every call for a cap that's no longer part
    // of the pricing model. The functions themselves are untouched in
    // lib/serverAuth.ts/lib/limits.ts (kept, in case a future billing
    // model wants them back) — this route just no longer calls them.
    // Visit-based enforcement (assertWidgetVisitsAllowed, the thing
    // that actually still gates the account) already ran in
    // app/api/track for this same page view, before this click could
    // even have happened.
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

    // Skip the SECURITY BOT judgment entirely if this visitor is
    // already blocked/restricted — same early-out /api/track uses, and
    // same restrictedUntil-aware read (an expired restriction is NOT
    // currently blocking). Note this check itself still ran AFTER the
    // token-cap debit above: the owner is charged for having received
    // the click at all (that part of the cost is real and unavoidable
    // — the request hit their account either way), but an already-
    // blocked visitor's click costs nothing FURTHER beyond that one
    // beacon, since nothing below this point runs for them.
    const blockedSnap = await siteRef.collection('blockedVisitors').doc(visitorId).get().catch(() => null);
    const blockedData = blockedSnap && blockedSnap.exists ? blockedSnap.data() : null;
    const restrictedUntilTs = typeof blockedData?.restrictedUntil === 'number' ? blockedData.restrictedUntil : null;
    const alreadyBlocked = !!blockedData && (restrictedUntilTs === null || restrictedUntilTs > Date.now());

    let action: 'none' | 'restrict' | 'block' = 'none';
    if (!alreadyBlocked) {
      try {
        const shieldConfig = await getBotShieldConfig(db, siteRef);
        // Click-burst enforcement gates on clickShieldEnabled specifically
        // (not refreshShieldEnabled) — these used to share one flag, which
        // meant toggling the Rapid Refresh card also silently enabled/
        // disabled Rapid Click protection and vice versa.
        if (shieldConfig.clickShieldEnabled) {
          const shieldResult = await applyBotShield({
            db,
            siteRef,
            subjectId: visitorId,
            isRealVisitorId: true,
            kind: 'click',
            enabled: true,
            thresholdOverrides: shieldConfig.thresholds,
            callerIp,
          });
          action = shieldResult.action;
        }
      } catch (err) {
        // Same "never let infra trouble fail a visitor's beacon"
        // principle as /api/track — a SECURITY BOT hiccup degrades to
        // "not acted on this click", never an error surfaced to the
        // visitor's page.
        console.error('[click-track] bot shield evaluation failed', err);
      }
    }

    return NextResponse.json(
      { ok: true, counted: true, blocked: alreadyBlocked || action !== 'none', action: alreadyBlocked ? 'already-blocked' : action },
      { status: 200, headers: CORS_HEADERS }
    );
  } catch (err) {
    console.error('[click-track] handler error', err);
    return NextResponse.json({ ok: false }, { status: 200, headers: CORS_HEADERS });
  }
}
