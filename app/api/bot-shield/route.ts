// app/api/bot-shield/route.ts
//
// GET  ?idToken=&siteId=                 → current config + recent log entries
// POST { idToken, siteId, action, ... }  → update config, or unblock a
//                                           visitor Bot Shield blocked
//
// Backs the two Bot Shield widgets (see lib/botShield.ts's header for
// the shared detection engine, lib/botShieldEnforce.ts for the actual
// enforcement, lib/botShieldConfig.ts for the stored on/off doc):
//   1. Refresh & Click Shield — wired into app/api/track
//   2. Form Flood Guard       — wired into the lead-capture routes
//      (email-capture, contact-us, appointment-booking, feedback-survey)
//
// Same ownership-verification shape as every other site-scoped route
// here (site-agent, site-widget, block-visitor): a trusted uid is
// recovered from a verified Firebase ID token, then siteId ownership
// under THAT uid is checked before any read or write — never trusted
// from the request body, since the Admin SDK bypasses Firestore
// security rules entirely.
//
// Reading the config/log is NOT gated behind the daily write-cap
// machinery (checkAndIncrementAccountWrites) — it's a read, same as
// every other dashboard GET in this app. Only the POST actions below
// (which write) go through that gate, exactly like every action in
// app/api/user-action.
import { NextRequest, NextResponse } from 'next/server';
import { getAdminApp, getAdminDb, jsonError, verifyCaller, getCallerPlan, rateLimitOk, checkAndIncrementAccountWrites, writeLimitResponse, WriteLimitReachedError } from '@/lib/serverAuth';
import { DEFAULT_BOT_SHIELD_CONFIG, type BotShieldConfig } from '@/lib/botShieldConfig';
import { FieldValue } from 'firebase-admin/firestore';

export const maxDuration = 10;
export const runtime = 'nodejs';

const MAX_BODY_BYTES = 4 * 1024;
const LOG_PAGE_SIZE = 50;

async function resolveOwnedSite(db: FirebaseFirestore.Firestore, uid: string, siteId: unknown) {
  if (!siteId || typeof siteId !== 'string') return null;
  const siteRef = db.collection('users').doc(uid).collection('sites').doc(siteId);
  const snap = await siteRef.get();
  if (!snap.exists) return null;
  return siteRef;
}

export async function GET(req: NextRequest) {
  try {
    const idToken = req.nextUrl.searchParams.get('idToken');
    const siteId = req.nextUrl.searchParams.get('siteId');

    let app;
    try {
      app = getAdminApp();
    } catch (err) {
      console.error('[bot-shield] Firebase Admin init error', err);
      return jsonError(500, 'Server is not configured yet.');
    }

    const uid = await verifyCaller(app, idToken);
    if (!uid) return jsonError(401, 'Invalid or expired session. Please sign in again.');

    if (!rateLimitOk(`bot-shield-read:${uid}`, 60, 60_000)) {
      return jsonError(429, 'Too many requests. Please try again shortly.');
    }

    const db = getAdminDb();
    const siteRef = await resolveOwnedSite(db, uid, siteId);
    if (!siteRef) return jsonError(404, 'Site not found, or you do not have access to it.');

    const [configSnap, logSnap] = await Promise.all([
      siteRef.collection('botShield').doc('_config').get(),
      siteRef.collection('botShieldLog').orderBy('ts', 'desc').limit(LOG_PAGE_SIZE).get(),
    ]);

    const configData = configSnap.exists ? configSnap.data() || {} : {};
    const config: BotShieldConfig = {
      refreshShieldEnabled:
        typeof configData.refreshShieldEnabled === 'boolean'
          ? configData.refreshShieldEnabled
          : DEFAULT_BOT_SHIELD_CONFIG.refreshShieldEnabled,
      formFloodGuardEnabled:
        typeof configData.formFloodGuardEnabled === 'boolean'
          ? configData.formFloodGuardEnabled
          : DEFAULT_BOT_SHIELD_CONFIG.formFloodGuardEnabled,
    };

    const log = logSnap.docs.map((d) => {
      const data = d.data();
      const ts = data.ts && typeof data.ts.toDate === 'function' ? data.ts.toDate().getTime() : null;
      return {
        id: d.id,
        visitorId: data.visitorId ?? null,
        kind: data.kind ?? null,
        verdict: data.verdict ?? null,
        countInWindow: data.countInWindow ?? null,
        reason: data.reason ?? null,
        blocked: !!data.blocked,
        ts,
      };
    });

    return NextResponse.json({ ok: true, config, log }, { status: 200, headers: { 'Cache-Control': 'no-store' } });
  } catch (err) {
    console.error('[bot-shield] GET handler error', err);
    return jsonError(500, 'Could not load Bot Shield right now.');
  }
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

    const { idToken, siteId, action } = body || {};

    let app;
    try {
      app = getAdminApp();
    } catch (err) {
      console.error('[bot-shield] Firebase Admin init error', err);
      return jsonError(500, 'Server is not configured yet.');
    }

    const uid = await verifyCaller(app, idToken);
    if (!uid) return jsonError(401, 'Invalid or expired session. Please sign in again.');

    if (!rateLimitOk(`bot-shield-write:${uid}`, 30, 60_000)) {
      return jsonError(429, 'Too many requests. Please try again shortly.');
    }

    const db = getAdminDb();
    const siteRef = await resolveOwnedSite(db, uid, siteId);
    if (!siteRef) return jsonError(404, 'Site not found, or you do not have access to it.');

    const planId = await getCallerPlan(db, uid);
    try {
      await checkAndIncrementAccountWrites(db, uid, planId);
    } catch (err) {
      if (err instanceof WriteLimitReachedError) return writeLimitResponse(planId, err);
      throw err;
    }

    if (action === 'update-config') {
      const { refreshShieldEnabled, formFloodGuardEnabled } = body || {};
      const update: Record<string, unknown> = { updatedAt: FieldValue.serverTimestamp() };
      if (typeof refreshShieldEnabled === 'boolean') update.refreshShieldEnabled = refreshShieldEnabled;
      if (typeof formFloodGuardEnabled === 'boolean') update.formFloodGuardEnabled = formFloodGuardEnabled;
      if (Object.keys(update).length === 1) return jsonError(400, 'Nothing to update.');

      await siteRef.collection('botShield').doc('_config').set(update, { merge: true });
      return NextResponse.json({ ok: true, action }, { status: 200, headers: { 'Cache-Control': 'no-store' } });
    }

    if (action === 'unblock-visitor') {
      const { visitorId } = body || {};
      if (!visitorId || typeof visitorId !== 'string') return jsonError(400, 'Missing visitorId.');

      // Clears both the enforcement record (blockedVisitors — what
      // actually gates app/api/track and the form routes) and this
      // visitor's rolling Bot Shield state (botShield/{visitorId}) —
      // an owner un-blocking someone shouldn't leave them one stray
      // event away from an immediate re-block off stale strike
      // history from before the override.
      await Promise.all([
        siteRef.collection('blockedVisitors').doc(visitorId).delete(),
        siteRef.collection('botShield').doc(visitorId).delete(),
        siteRef.collection('visitorProfiles').doc(visitorId).set({ blocked: false }, { merge: true }).catch(() => {}),
      ]);
      return NextResponse.json({ ok: true, action, visitorId }, { status: 200, headers: { 'Cache-Control': 'no-store' } });
    }

    return jsonError(400, "Unknown action. Expected 'update-config' or 'unblock-visitor'.");
  } catch (err) {
    console.error('[bot-shield] POST handler error', err);
    return jsonError(500, 'Something went wrong.');
  }
}
