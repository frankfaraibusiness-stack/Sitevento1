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
// This route carries no usage gate at all, old or new system — every
// action here (including 'update-config') is an owner/dashboard action,
// not visitor traffic, so it's exempt from both the old daily token
// cap and the new monthly visit allowance.
import { NextRequest, NextResponse } from 'next/server';
import { getAdminApp, getAdminDb, jsonError, verifyCaller, rateLimitOk } from '@/lib/serverAuth';
import { DEFAULT_BOT_SHIELD_CONFIG, invalidateBotShieldConfigCache, BLOCKABLE_DEVICE_OS, type BotShieldConfig, type BlockableDeviceOs } from '@/lib/botShieldConfig';
import { BOT_SHIELD_THRESHOLDS, resolveThreshold, type BotShieldThresholdOverrides } from '@/lib/botShield';
import { FieldValue } from 'firebase-admin/firestore';

export const maxDuration = 10;
export const runtime = 'nodejs';

const MAX_BODY_BYTES = 4 * 1024;
const LOG_PAGE_SIZE = 50;

// Same ISO 3166-1 alpha-2 shape check as lib/botShieldConfig.ts's own
// sanitizer — duplicated here (not imported) only because this route
// reads the raw doc directly for the GET response rather than going
// through getBotShieldConfig, which already does its own sanitizing
// for the enforcement path in app/api/track.
const COUNTRY_CODE_RE = /^[A-Za-z]{2}$/;

function sanitizeCountryListForResponse(raw: unknown): string[] {
  if (!Array.isArray(raw)) return [];
  const out: string[] = [];
  const seen = new Set<string>();
  for (const entry of raw) {
    if (typeof entry !== 'string') continue;
    const code = entry.trim().toUpperCase();
    if (!COUNTRY_CODE_RE.test(code) || seen.has(code)) continue;
    seen.add(code);
    out.push(code);
  }
  return out;
}

function sanitizeDeviceListForResponse(raw: unknown): BlockableDeviceOs[] {
  if (!Array.isArray(raw)) return [];
  const out: BlockableDeviceOs[] = [];
  const seen = new Set<string>();
  for (const entry of raw) {
    if (typeof entry !== 'string') continue;
    if (!(BLOCKABLE_DEVICE_OS as readonly string[]).includes(entry) || seen.has(entry)) continue;
    seen.add(entry);
    out.push(entry as BlockableDeviceOs);
  }
  return out;
}

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
    const rawThresholds: BotShieldThresholdOverrides | undefined =
      configData.thresholds && typeof configData.thresholds === 'object' ? configData.thresholds : undefined;
    const config: BotShieldConfig = {
      refreshShieldEnabled:
        typeof configData.refreshShieldEnabled === 'boolean'
          ? configData.refreshShieldEnabled
          : DEFAULT_BOT_SHIELD_CONFIG.refreshShieldEnabled,
      formFloodGuardEnabled:
        typeof configData.formFloodGuardEnabled === 'boolean'
          ? configData.formFloodGuardEnabled
          : DEFAULT_BOT_SHIELD_CONFIG.formFloodGuardEnabled,
      countryBlockEnabled:
        typeof configData.countryBlockEnabled === 'boolean'
          ? configData.countryBlockEnabled
          : DEFAULT_BOT_SHIELD_CONFIG.countryBlockEnabled,
      blockedCountries: sanitizeCountryListForResponse(configData.blockedCountries),
      deviceBlockEnabled:
        typeof configData.deviceBlockEnabled === 'boolean'
          ? configData.deviceBlockEnabled
          : DEFAULT_BOT_SHIELD_CONFIG.deviceBlockEnabled,
      blockedDevices: sanitizeDeviceListForResponse(configData.blockedDevices),
      ...(rawThresholds ? { thresholds: rawThresholds } : {}),
    };

    // The EFFECTIVE threshold per kind — the owner's override (if any
    // field of it is set) already merged with the built-in default and
    // clamped to the floors resolveThreshold enforces. This is what the
    // dashboard should actually show/pre-fill in each input: an owner
    // who has never touched this should see today's real numbers (5/10
    // per 60s, etc.), not blank fields, and an owner who typed
    // something below the floor should see what ACTUALLY took effect,
    // not their raw unclamped input.
    const effectiveThresholds = {
      pageview: resolveThreshold('pageview', rawThresholds),
      click: resolveThreshold('click', rawThresholds),
      'form-submit': resolveThreshold('form-submit', rawThresholds),
    };

    const log = logSnap.docs.map((d) => {
      const data = d.data();
      const ts = data.ts && typeof data.ts.toDate === 'function' ? data.ts.toDate().getTime() : null;
      // action may be absent on a log entry written before this field
      // existed — fall back to the old boolean `blocked` so older
      // entries still render as a (permanent) block rather than
      // silently vanishing from the list.
      const action: 'none' | 'restrict' | 'block' = data.action ?? (data.blocked ? 'block' : 'none');
      return {
        id: d.id,
        visitorId: data.visitorId ?? null,
        kind: data.kind ?? null,
        verdict: data.verdict ?? null,
        countInWindow: data.countInWindow ?? null,
        action,
        reason: data.reason ?? null,
        blocked: action !== 'none',
        restrictedUntil: typeof data.restrictedUntil === 'number' ? data.restrictedUntil : null,
        timingRegularity: typeof data.timingRegularity === 'number' ? data.timingRegularity : null,
        networkSuspect: data.networkSuspect === true,
        ts,
      };
    });

    return NextResponse.json(
      { ok: true, config, effectiveThresholds, defaultThresholds: BOT_SHIELD_THRESHOLDS, blockableDeviceOs: BLOCKABLE_DEVICE_OS, log },
      { status: 200, headers: { 'Cache-Control': 'no-store' } }
    );
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

    // Bot-shield config updates are an owner/dashboard action, not
    // visitor traffic or content generation — they carry no usage gate
    // of any kind (neither the old token cap nor the new visit model).
    if (action === 'update-config') {
      const { refreshShieldEnabled, formFloodGuardEnabled, thresholds, countryBlockEnabled, blockedCountries, deviceBlockEnabled, blockedDevices } = body || {};
      const update: Record<string, unknown> = { updatedAt: FieldValue.serverTimestamp() };
      if (typeof refreshShieldEnabled === 'boolean') update.refreshShieldEnabled = refreshShieldEnabled;
      if (typeof formFloodGuardEnabled === 'boolean') update.formFloodGuardEnabled = formFloodGuardEnabled;
      if (typeof countryBlockEnabled === 'boolean') update.countryBlockEnabled = countryBlockEnabled;
      if (typeof deviceBlockEnabled === 'boolean') update.deviceBlockEnabled = deviceBlockEnabled;

      // Same "only plain, well-shaped values survive" posture as the
      // thresholds filter right below — a malformed or oversized list
      // is dropped rather than rejecting the whole request, since
      // resolveThreshold-style clamping has no equivalent for these
      // (an unenforceable value simply never matches a real visitor),
      // so the write-time filter here IS the only thing standing
      // between a bad input and a corrupt list, unlike thresholds.
      if (Array.isArray(blockedCountries)) {
        const clean = sanitizeCountryListForResponse(blockedCountries);
        if (clean.length > 250) return jsonError(400, 'Too many countries.');
        update.blockedCountries = clean;
      }
      if (Array.isArray(blockedDevices)) {
        update.blockedDevices = sanitizeDeviceListForResponse(blockedDevices);
      }

      // Thresholds: only plain finite numbers for the three known
      // fields on each of the three known kinds survive — everything
      // else (wrong type, extra keys, nested junk) is silently
      // dropped rather than rejecting the whole request, since the
      // dashboard form only ever sends a subset of kinds/fields at a
      // time (whichever input the owner actually changed).
      // lib/botShield.ts's resolveThreshold clamps these to sane
      // floors at READ time no matter what lands here, so this write-
      // time filter is a courtesy (keep the stored doc clean), not the
      // only thing standing between a bad input and a broken site.
      if (thresholds && typeof thresholds === 'object') {
        const sanitizedThresholds: Record<string, Record<string, number>> = {};
        for (const kind of ['pageview', 'click', 'form-submit'] as const) {
          const raw = (thresholds as Record<string, unknown>)[kind];
          if (!raw || typeof raw !== 'object') continue;
          const o = raw as Record<string, unknown>;
          const clean: Record<string, number> = {};
          if (typeof o.windowMs === 'number' && Number.isFinite(o.windowMs) && o.windowMs > 0) clean.windowMs = o.windowMs;
          if (typeof o.moderateCount === 'number' && Number.isFinite(o.moderateCount) && o.moderateCount > 0) clean.moderateCount = o.moderateCount;
          if (typeof o.severeCount === 'number' && Number.isFinite(o.severeCount) && o.severeCount > 0) clean.severeCount = o.severeCount;
          if (Object.keys(clean).length) sanitizedThresholds[kind] = clean;
        }
        if (Object.keys(sanitizedThresholds).length) update.thresholds = sanitizedThresholds;
      }

      if (Object.keys(update).length === 1) return jsonError(400, 'Nothing to update.');

      await siteRef.collection('botShield').doc('_config').set(update, { merge: true });
      // So the very next beacon this site receives — possibly on the
      // same warm instance that just served this dashboard request —
      // sees the change immediately instead of waiting out the read
      // cache's TTL (see lib/botShieldConfig.ts / lib/requestCache.ts).
      invalidateBotShieldConfigCache(siteRef.path);
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
