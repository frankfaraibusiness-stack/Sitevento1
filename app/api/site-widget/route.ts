// app/api/site-widget/route.ts
//
// POST { idToken, siteId, widgetId, enabled, config, version }
//
// Writes users/{uid}/sites/{siteId}/widgets/{widgetId} with the Admin
// SDK instead of the browser's client Firestore SDK. This is what
// WidgetConfigPanel's enable/disable/save-settings controls now call
// (via hooks/useSiteWidget.ts), replacing the direct client-side
// setDoc() the first version of this feature used.
//
// ── Why a token instead of a trusted uid in the body ─────────────────
// A naive version of this route would take `{ uid, siteId, widgetId }`
// straight from the request body and write wherever it's told — but
// the body is just JSON any caller can type by hand; nothing stops a
// signed-in user (or anyone with devtools) from sending a DIFFERENT
// uid than their own and silently taking over another customer's
// widget config. The Admin SDK bypasses Firestore security rules
// entirely, so unlike the old client-side write (which Firestore
// itself refused unless request.auth.uid == uid), this route is the
// only thing standing between "any caller" and "any site's data" —
// so it has to do that ownership check itself, in code, rather than
// leaning on rules.
//
// Concretely: the client sends its Firebase Auth ID token (short-lived,
// cryptographically signed by Firebase, obtained via
// `await user.getIdToken()`), and this route verifies that token with
// the Admin SDK (verifyIdToken, which checks the signature + expiry
// against Firebase's own servers) to recover the REAL uid — the one
// nobody can forge — then uses that uid for the write, ignoring
// whatever uid-shaped string might otherwise appear in the body.
//
// ── Deploy notes ──────────────────────────────────────────────────────
//   Needs the same FIREBASE_PROJECT_ID / FIREBASE_CLIENT_EMAIL /
//   FIREBASE_PRIVATE_KEY env vars as /api/widget and /api/verify-site.
//   Firestore rules do NOT need a client-write exception for this path
//   any more — the Admin SDK bypasses them. Consider tightening
//   users/{uid}/{document=**}'s rule once every caller of this data
//   goes through routes like this one instead of direct client writes
//   (defense-in-depth either way; doesn't hurt to leave the rule as-is).
//
// ── "Saved" vs. "actually live" ───────────────────────────────────────
// A successful write here only means the owner's enable/disable intent
// was recorded — it does NOT mean a real visitor's browser will
// successfully render the widget. app/api/widget/route.ts enforces
// several more gates at request time: the global catalog entry must
// exist/be enabled/have a bundleUrl, and the site must be status
// 'verified'. (Domain match is the one gate this route genuinely can't
// evaluate, since there's no requesting page here — that's reported
// separately as a caveat rather than a pass/fail.) Rather than let the
// dashboard claim "Widget is live on your site" from the write alone,
// this route re-checks those same catalog/verification gates right
// after writing and returns the honest result as `liveStatus`, so the
// UI can show what will actually happen instead of just "it saved".
type LiveStatus =
  | { state: 'live'; message: string }
  | { state: 'saved_but_blocked'; reason: string; message: string }
  | { state: 'saved_off'; message: string };

async function checkLiveStatus(
  db: FirebaseFirestore.Firestore,
  siteSnap: FirebaseFirestore.DocumentSnapshot,
  widgetId: string,
  enabled: boolean,
  origin: string
): Promise<LiveStatus> {
  if (!enabled) {
    return { state: 'saved_off', message: 'Turned off. Visitors will no longer see this widget.' };
  }

  const site = siteSnap.data() || {};

  if (site.status !== 'verified') {
    return {
      state: 'saved_but_blocked',
      reason: 'SITE_NOT_VERIFIED',
      message: "Saved, but this site hasn't completed verification yet — visitors won't see the widget until it's verified.",
    };
  }

  const subscriptionStatus: string = typeof site.subscriptionStatus === 'string' ? site.subscriptionStatus : 'active';
  if (subscriptionStatus !== 'active') {
    return {
      state: 'saved_but_blocked',
      reason: 'SUBSCRIPTION_INACTIVE',
      message: "Saved, but this site's subscription is not active — visitors won't see the widget right now.",
    };
  }

  const widgetDocRef = db.collection('widgets').doc(widgetId);
  let widgetSnap = await widgetDocRef.get();
  if (!widgetSnap.exists) {
    // Self-heal: same fix as /api/widget and /api/site-widgets — a
    // shipped catalog id (lib/widgets.ts's WIDGET_CATALOG) with no
    // global doc yet is created right here, the moment the owner turns
    // it on, instead of reporting a false "blocked" the first time and
    // only fixing itself whenever a real visitor happens to hit it.
    const expected = expectedCatalogDoc(widgetId, origin);
    if (!expected) {
      return {
        state: 'saved_but_blocked',
        reason: 'WIDGET_NOT_FOUND',
        message: 'Saved, but this widget is not yet in the global catalog — it will not render for visitors until an admin adds it.',
      };
    }
    console.warn('[site-widget] auto-seeding missing global catalog doc for', widgetId);
    await widgetDocRef.set(
      { ...expected, updatedAt: FieldValue.serverTimestamp() },
      { merge: true }
    );
    widgetSnap = await widgetDocRef.get();
  }
  const widgetData = widgetSnap.data() || {};
  if (!widgetData.enabled) {
    return {
      state: 'saved_but_blocked',
      reason: 'WIDGET_DISABLED',
      message: 'Saved, but this widget is currently disabled globally — it will not render for any site until re-enabled.',
    };
  }
  if (!widgetData.bundleUrl || typeof widgetData.bundleUrl !== 'string') {
    return {
      state: 'saved_but_blocked',
      reason: 'WIDGET_MISCONFIGURED',
      message: 'Saved, but this widget is missing its content URL in the catalog — it will not render for visitors.',
    };
  }

  // Everything this route CAN verify checks out. Domain match is the
  // one remaining gate /api/widget enforces that depends on the
  // actual requesting page, so it can't be confirmed from here — the
  // UI surfaces this as a caveat rather than a false "fully confirmed".
  return {
    state: 'live',
    message: 'Live — will render on your site next page load (as long as the widget tag is on a page on your registered domain).',
  };
}

import { NextRequest, NextResponse } from 'next/server';
import { initializeApp, getApps, cert } from 'firebase-admin/app';
import { getAuth } from 'firebase-admin/auth';
import { getFirestore, FieldValue } from 'firebase-admin/firestore';
import { allow } from '@/lib/rateLimit';
import { isValidWidgetId, defaultConfigFor, getWidgetCatalogEntry, expectedCatalogDoc } from '@/lib/widgets';

export const maxDuration = 10;
export const runtime = 'nodejs';

function getAdminApp() {
  return getApps().length
    ? getApps()[0]
    : initializeApp({
        credential: cert({
          projectId: process.env.FIREBASE_PROJECT_ID,
          clientEmail: process.env.FIREBASE_CLIENT_EMAIL,
          privateKey: (process.env.FIREBASE_PRIVATE_KEY || '').replace(/\\n/g, '\n'),
        }),
      });
}

const MAX_BODY_BYTES = 16 * 1024; // generous for a widget's config object
const MAX_CONFIG_KEYS = 40;
const MAX_STRING_LEN = 2000;
const MAX_PRIZES = 8;

// Validates one entry of a 'prizes' array (lib/widgets.ts's Prize
// shape: label/code/weight) — the one place a config value is allowed
// to be an array/object rather than a bare string/number/boolean, so
// it gets its own narrow, fully-typed check instead of opening up
// arbitrary nested JSON.
function sanitizePrize(v: unknown): { label: string; code: string; weight: number } | null {
  if (!v || typeof v !== 'object' || Array.isArray(v)) return null;
  const { label, code, weight } = v as Record<string, unknown>;
  if (typeof label !== 'string' || label.length > 60) return null;
  if (typeof code !== 'string' || code.length > 40) return null;
  if (typeof weight !== 'number' || !Number.isFinite(weight) || weight <= 0) return null;
  return { label, code, weight };
}

function jsonError(status: number, message: string) {
  return NextResponse.json({ ok: false, error: message }, { status, headers: { 'Cache-Control': 'no-store' } });
}

// Shallow validation: every value must be a string, number, boolean,
// or — for the single known `prizes` key (spin-reward's prize-list
// config field) — an array of valid Prize objects. Matches what
// lib/widgets.ts's WidgetFieldDef types can ever produce
// (text/textarea/color/url -> string, number -> number,
// prizeList -> Prize[]). Keeps an attacker from stuffing arbitrary
// nested objects/huge arrays into a doc this route writes with
// elevated (Admin SDK) privilege — `prizes` is allow-listed by name
// and shape rather than arrays being accepted generally.
function sanitizeConfig(input: unknown): Record<string, unknown> | null {
  if (input === undefined || input === null) return {};
  if (typeof input !== 'object' || Array.isArray(input)) return null;
  const entries = Object.entries(input as Record<string, unknown>);
  if (entries.length > MAX_CONFIG_KEYS) return null;
  const out: Record<string, unknown> = {};
  for (const [key, value] of entries) {
    if (typeof key !== 'string' || key.length > 100) return null;
    if (key === 'prizes') {
      if (!Array.isArray(value) || value.length === 0 || value.length > MAX_PRIZES) return null;
      const prizes = value.map(sanitizePrize);
      if (prizes.some((p) => p === null)) return null;
      out[key] = prizes;
    } else if (typeof value === 'string') {
      if (value.length > MAX_STRING_LEN) return null;
      out[key] = value;
    } else if (typeof value === 'number') {
      if (!Number.isFinite(value)) return null;
      out[key] = value;
    } else if (typeof value === 'boolean') {
      out[key] = value;
    } else {
      return null;
    }
  }
  return out;
}

export async function POST(req: NextRequest) {
  try {
    const contentLength = Number(req.headers.get('content-length') || 0);
    if (contentLength > MAX_BODY_BYTES) {
      return jsonError(400, 'Request body too large.');
    }
    const raw = await req.text();
    if (raw.length > MAX_BODY_BYTES) {
      return jsonError(400, 'Request body too large.');
    }

    let body: any;
    try {
      body = JSON.parse(raw);
    } catch {
      return jsonError(400, 'Malformed JSON body.');
    }

    const { idToken, siteId, widgetId, enabled, config } = body || {};

    if (!idToken || typeof idToken !== 'string') {
      return jsonError(401, 'Missing idToken.');
    }
    if (!siteId || typeof siteId !== 'string' || siteId.length > 100) {
      return jsonError(400, 'Missing or invalid siteId.');
    }
    if (!isValidWidgetId(widgetId)) {
      return jsonError(400, 'Missing or invalid widgetId.');
    }
    if (typeof enabled !== 'boolean') {
      return jsonError(400, 'enabled must be a boolean.');
    }
    const cleanConfig = sanitizeConfig(config);
    if (cleanConfig === null) {
      return jsonError(400, 'config contains an unsupported value.');
    }
    if (!getWidgetCatalogEntry(widgetId)) {
      return jsonError(404, 'Unknown widgetId.');
    }

    let app;
    try {
      app = getAdminApp();
    } catch (err) {
      console.error('[site-widget] Firebase Admin init error', err);
      return jsonError(500, 'Server is not configured yet (missing Firebase Admin credentials).');
    }

    // ---- Verify the caller's identity server-side ----
    // This is the step that makes it safe for this route to hold
    // Admin-SDK (rules-bypassing) privilege: verifyIdToken checks the
    // token's signature and expiry against Firebase's own servers, so
    // the resulting uid cannot be forged by the caller no matter what
    // else is in the request body.
    let uid: string;
    try {
      const decoded = await getAuth(app).verifyIdToken(idToken);
      uid = decoded.uid;
    } catch (err) {
      return jsonError(401, 'Invalid or expired session. Please sign in again.');
    }

    // Rate-limited per uid+site+widget so a buggy client retry-loop
    // can't hammer Firestore — this is an authenticated owner action,
    // not a public endpoint, so the limit is generous.
    if (!allow(`site-widget:${uid}:${siteId}:${widgetId}`, 30, 60_000)) {
      return jsonError(429, 'Too many requests. Please try again shortly.');
    }

    const db = getFirestore(app);

    // ---- Ownership check ----
    // Confirms this uid actually owns this siteId before writing
    // anything under it — the one check that used to be Firestore's
    // job (request.auth.uid == uid in the rules) and is now this
    // route's job instead, since the Admin SDK write below ignores
    // rules entirely.
    const siteRef = db.collection('users').doc(uid).collection('sites').doc(siteId);
    const siteSnap = await siteRef.get();
    if (!siteSnap.exists) {
      return jsonError(404, 'Site not found, or you do not have access to it.');
    }

    const widgetRef = siteRef.collection('widgets').doc(widgetId);
    const existingSnap = await widgetRef.get();
    const existing = existingSnap.exists ? existingSnap.data() : null;

    const mergedConfig = {
      ...defaultConfigFor(widgetId),
      ...((existing?.config as Record<string, unknown>) || {}),
      ...cleanConfig,
    };

    // Mirror useSiteWidget.ts's old enable() behavior: bump version on
    // every write so app/api/widget/route.ts's ETag reflects the
    // change immediately for the public-facing widget loader.
    const nextVersion = (typeof existing?.version === 'number' ? existing.version : 0) + 1;

    const data = {
      enabled,
      config: mergedConfig,
      version: nextVersion,
      updatedAt: FieldValue.serverTimestamp(),
    };

    await widgetRef.set(data, { merge: true });

    // Re-check the real-world servability gates AFTER the write so the
    // response reflects what just happened, not a stale pre-write
    // state. A failure here must never make the whole request fail —
    // the save itself already succeeded — so this is wrapped and
    // degrades to an honest "couldn't verify" rather than hiding the
    // save's success.
    let liveStatus: LiveStatus;
    try {
      liveStatus = await checkLiveStatus(db, siteSnap, widgetId, enabled, req.nextUrl.origin);
    } catch (err) {
      console.error('[site-widget] liveStatus check failed', err);
      liveStatus = enabled
        ? {
            state: 'saved_but_blocked',
            reason: 'STATUS_CHECK_FAILED',
            message: 'Saved, but we could not confirm whether it will actually show on your site. Check back or reload this panel.',
          }
        : { state: 'saved_off', message: 'Turned off.' };
    }

    return NextResponse.json(
      {
        ok: true,
        widget: { enabled: data.enabled, config: data.config, version: data.version },
        liveStatus,
      },
      { status: 200, headers: { 'Cache-Control': 'no-store' } }
    );
  } catch (err) {
    console.error('[site-widget] handler error', err);
    return jsonError(500, 'Something went wrong saving that widget.');
  }
}
