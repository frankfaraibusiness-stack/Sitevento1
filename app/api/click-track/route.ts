// app/api/click-track/route.ts
//
// POST { siteId, visitorId }
//
// One beacon per CLICK anywhere on a visitor's page, fired by
// public/sitevento.js's document-level click listener. This is the
// "click" half of SECURITY BOT's Refresh & Click Shield (the
// "refresh"/pageview half is app/api/track) — before this route
// existed, nothing ever sent a 'click' event into lib/botShield.ts's
// engine, so the click thresholds in BOT_SHIELD_THRESHOLDS were dead
// code that could never fire. This route is what actually feeds them.
//
// Deliberately NOT folded into /api/track itself: that route does a
// full visit-doc write (device/geo/device-recovery — see its own
// header), which is far more than click judging needs. This route does
// the minimum required to judge click timing — no visit doc, no
// device recovery — but it is NOT a free/soft signal: resolving
// siteId → uid, reading blockedVisitors, and applyBotShield's own
// read-decide-write transaction are all real Firestore reads/writes
// against the SITE OWNER's own account, same as a pageview beacon. So
// this is gated through the exact same hard daily token cap every
// other billed widget action already goes through
// (assertWidgetTokensAllowed/pausedWidgetResponse — see
// lib/serverAuth.ts's header for the whole limit/overage-wallet
// system) rather than the soft, never-blocking trackWidgetTokenUsage
// counter /api/overlay-track uses for its impression/cta beacons.
// Priced at tokenCost('clickTrack') — double a plain visit check,
// since this records the click itself AND looks up/credits the owner
// it belongs to (two writes' worth of real cost). A click burst (the
// exact scenario this route exists to catch) is BY DEFINITION a spike
// in request volume, so leaving click beacons uncapped would let a
// scripted click flood burn through the owner's token budget for free
// while SECURITY BOT was still in the process of noticing and
// restricting it.
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
import { assertWidgetTokensAllowed, pausedWidgetResponse, WidgetTokenBlockedError } from '@/lib/serverAuth';
import { tokenCost } from '@/lib/limits';
import { getBotShieldConfig } from '@/lib/botShieldConfig';
import { applyBotShield } from '@/lib/botShieldEnforce';

export const maxDuration = 10;
export const runtime = 'nodejs';

const CORS_HEADERS = {
  'Access-Control-Allow-Origin': '*',
  'Access-Control-Allow-Methods': 'POST, OPTIONS',
  'Access-Control-Allow-Headers': 'Content-Type',
};

const MAX_BODY_BYTES = 2 * 1024;

// Mirrors app/api/track's own VISITOR_ID_RE — only a visitorId shaped
// like what the loader actually generates is trusted to participate
// in blockedVisitors; anything else is rejected rather than silently
// falling back to an IP-keyed bucket, since (unlike a lead submission)
// a click beacon with no trustworthy visitor identity carries no
// useful signal on its own and isn't worth paying a token for.
const VISITOR_ID_RE = /^v[a-z0-9]{6,40}$/i;

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

    const { siteId, visitorId } = body || {};
    if (!siteId || typeof siteId !== 'string' || siteId.length > 100) {
      return NextResponse.json({ ok: false, reason: 'missing siteId' }, { status: 200, headers: CORS_HEADERS });
    }
    if (!visitorId || typeof visitorId !== 'string' || !VISITOR_ID_RE.test(visitorId)) {
      // No usable visitor identity — nothing to key a burst/gap check
      // on, and nothing worth charging the owner a token for. Same
      // fail-open shape as formFloodGuard's "no ip and no visitorId"
      // branch: silently accept and do nothing.
      return NextResponse.json({ ok: true, counted: false }, { status: 200, headers: CORS_HEADERS });
    }

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

    // Resolves siteId → uid AND atomically checks/debits the owner's
    // daily widget-token cap at tokenCost('clickTrack') (double a plain
    // visit check — see this file's header) in one call. A paused
    // account gets the same always-200 PAUSED body every other
    // hard-gated widget route returns, never a raw error.
    let resolved;
    try {
      resolved = await assertWidgetTokensAllowed(db, siteId, tokenCost('clickTrack'));
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
        if (shieldConfig.refreshShieldEnabled) {
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
