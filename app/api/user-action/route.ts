// app/api/user-action/route.ts
//
// POST { idToken, action, payload }
//
// The ONE shared route every remaining user-initiated write goes
// through. Before this route, a handful of writes still happened
// straight from the browser with the client Firestore SDK — settings,
// profile/plan, site pause/disconnect, timed visitor restrictions, and
// overlay save/push/stop — bypassable by anyone who opened devtools
// and called the client SDK directly, same problem app/api/connect-site
// and app/api/block-visitor's header comments already describe for
// site creation and permanent blocking. This route closes the rest of
// that gap: EVERY write a signed-in user makes now goes through here
// (account creation is its own route, app/api/create-account, since it
// runs before a session/idToken exists — see that route's header),
// and every successful write here counts once against the account's
// daily write limit (lib/serverAuth.ts's checkAndIncrementAccountWrites),
// so a user cannot bypass that cap by hitting a different action.
//
// ── Why one route instead of one per action ──────────────────────────
// The limiting logic (verify token, look up plan, check + increment
// the daily counter) is identical regardless of WHICH write is being
// made — only the Firestore write itself differs per action. Keeping
// that in one place means the write-limit check physically cannot be
// forgotten on a new action the way it could be if every action got
// its own hand-rolled route file (as block-visitor/connect-site did
// historically, each re-deriving the same pattern slightly
// differently). Adding a new write kind means adding one case to the
// switch below, not a new route with its own copy of the boilerplate.
//
// ── Shape ──────────────────────────────────────────────────────────
// action: 'update-profile' | 'update-settings' | 'update-plan' |
//         'pause-site' | 'disconnect-site' | 'restrict-visitor' |
//         'save-overlay'
// payload: action-specific, validated per-case below. Every action is
// scoped to the caller's own uid (recovered from idToken, never taken
// from payload) and, where relevant, ownership of the target site is
// re-checked here before any write.
import { NextRequest, NextResponse } from 'next/server';
import { FieldValue } from 'firebase-admin/firestore';
import {
  getAdminApp,
  getAdminDb,
  jsonError,
  verifyCaller,
  getCallerPlan,
  rateLimitOk,
  checkAndIncrementAccountWrites,
  writeLimitResponse,
  WriteLimitReachedError,
} from '@/lib/serverAuth';
import { sanitizeSiteOverlay } from '@/lib/siteAlert';

export const maxDuration = 10;
export const runtime = 'nodejs';

const MAX_BODY_BYTES = 16 * 1024;

const VALID_ACTIONS = new Set([
  'update-profile',
  'update-settings',
  'update-plan',
  'pause-site',
  'disconnect-site',
  'restrict-visitor',
  'save-overlay',
]);

// ---- per-action payload validation + the write itself -------------
// Each handler receives the already-ownership-scoped db refs it needs
// and returns the JSON `data` to echo back on success. Throwing inside
// one of these aborts the whole request with a 400 (validation) —
// WriteLimitReachedError is handled separately, before any of these
// ever run.

async function doUpdateProfile(
  db: FirebaseFirestore.Firestore,
  uid: string,
  payload: any
): Promise<Record<string, unknown>> {
  const { displayName } = payload || {};
  if (displayName !== undefined) {
    if (typeof displayName !== 'string' || !displayName.trim() || displayName.length > 200) {
      throw new ValidationError('displayName must be a non-empty string under 200 characters.');
    }
  }
  const update: Record<string, unknown> = {};
  if (typeof displayName === 'string') update.displayName = displayName.trim();
  if (Object.keys(update).length === 0) throw new ValidationError('Nothing to update.');

  await db.collection('users').doc(uid).set(update, { merge: true });

  // Firebase Auth's own displayName field (shown in the UI header,
  // etc.) is updated too, mirroring what the old client-side
  // updateProfile() call used to do — now via the Admin SDK so this
  // route is the single place both the Auth record and the Firestore
  // mirror of it change together.
  if (typeof update.displayName === 'string') {
    const { getAuth } = await import('firebase-admin/auth');
    await getAuth(getAdminApp()).updateUser(uid, { displayName: update.displayName });
  }

  return { displayName: update.displayName };
}

const VALID_FONT_SIZES = new Set(['small', 'medium', 'large']);
const VALID_LANDING_VIEWS = new Set(['overview', 'visits', 'leads', 'sites']);
const SETTINGS_BOOLEAN_KEYS = [
  'twoFactorEnabled',
  'signInAlerts',
  'visitAlerts',
  'leadAlerts',
  'weeklySummary',
  'marketingEmails',
  'compactMode',
] as const;

async function doUpdateSettings(
  db: FirebaseFirestore.Firestore,
  uid: string,
  payload: any
): Promise<Record<string, unknown>> {
  const patch = (payload && typeof payload === 'object' ? payload : {}) as Record<string, unknown>;
  const clean: Record<string, unknown> = {};

  if (patch.timezone !== undefined) {
    if (typeof patch.timezone !== 'string' || patch.timezone.length > 100) {
      throw new ValidationError('Invalid timezone.');
    }
    clean.timezone = patch.timezone;
  }
  for (const key of SETTINGS_BOOLEAN_KEYS) {
    if (patch[key] !== undefined) {
      if (typeof patch[key] !== 'boolean') throw new ValidationError(`${key} must be a boolean.`);
      clean[key] = patch[key];
    }
  }
  if (patch.fontSize !== undefined) {
    if (!VALID_FONT_SIZES.has(patch.fontSize as string)) throw new ValidationError('Invalid fontSize.');
    clean.fontSize = patch.fontSize;
  }
  if (patch.landingView !== undefined) {
    if (!VALID_LANDING_VIEWS.has(patch.landingView as string)) throw new ValidationError('Invalid landingView.');
    clean.landingView = patch.landingView;
  }
  if (Object.keys(clean).length === 0) throw new ValidationError('Nothing to update.');

  const userRef = db.collection('users').doc(uid);
  const snap = await userRef.get();
  const existing = (snap.exists ? snap.data()?.settings : {}) || {};
  const merged = { ...existing, ...clean };

  await userRef.set({ settings: merged }, { merge: true });
  return { settings: merged };
}

async function doUpdatePlan(
  db: FirebaseFirestore.Firestore,
  uid: string,
  payload: any
): Promise<Record<string, unknown>> {
  const { planId } = payload || {};
  const VALID = new Set(['free', 'starter', 'scale', 'pro-developer']);
  if (!VALID.has(planId)) throw new ValidationError('Invalid planId.');

  // Demo/manual plan switch — no billing provider is wired up yet (see
  // lib/plans.ts's own comment); this is the server-side home for the
  // same "write the chosen tier straight onto the user doc" behavior
  // hooks/useUserProfile.ts's setPlan used to do client-side. The
  // single call site to swap for "start checkout" once real billing
  // lands.
  await db.collection('users').doc(uid).set({ plan: planId }, { merge: true });
  return { planId };
}

async function doPauseSite(
  db: FirebaseFirestore.Firestore,
  uid: string,
  payload: any
): Promise<Record<string, unknown>> {
  const { siteId, paused } = payload || {};
  if (!siteId || typeof siteId !== 'string') throw new ValidationError('Missing siteId.');
  if (typeof paused !== 'boolean') throw new ValidationError('paused must be a boolean.');

  const siteRef = db.collection('users').doc(uid).collection('sites').doc(siteId);
  const siteSnap = await siteRef.get();
  if (!siteSnap.exists) throw new NotFoundError('Site not found, or you do not have access to it.');

  await siteRef.set({ paused }, { merge: true });
  return { siteId, paused };
}

async function doDisconnectSite(
  db: FirebaseFirestore.Firestore,
  uid: string,
  payload: any
): Promise<Record<string, unknown>> {
  const { siteId } = payload || {};
  if (!siteId || typeof siteId !== 'string') throw new ValidationError('Missing siteId.');

  const siteRef = db.collection('users').doc(uid).collection('sites').doc(siteId);
  const siteSnap = await siteRef.get();
  if (!siteSnap.exists) throw new NotFoundError('Site not found, or you do not have access to it.');

  // Deletes the owner's site doc AND the flat siteIndex/{siteId}
  // lookup doc that /api/track, /api/widget, and /api/overlay-track
  // use to resolve "which account owns this siteId" — mirrors
  // hooks/useSites.ts's old disconnectSite exactly, just server-side.
  // Does NOT cascade-delete visits/leads/blockedVisitors subcollections
  // (Admin SDK recursive-delete territory, deliberately out of scope
  // for a single request with a 10s budget — see maxDuration above).
  const batch = db.batch();
  batch.delete(db.collection('siteIndex').doc(siteId));
  batch.delete(siteRef);
  await batch.commit();

  return { siteId, disconnected: true };
}

async function doRestrictVisitor(
  db: FirebaseFirestore.Firestore,
  uid: string,
  payload: any
): Promise<Record<string, unknown>> {
  const { siteId, visitorId, durationMs } = payload || {};
  if (!siteId || typeof siteId !== 'string') throw new ValidationError('Missing siteId.');
  if (!visitorId || typeof visitorId !== 'string') throw new ValidationError('Missing visitorId.');
  if (durationMs !== null && (typeof durationMs !== 'number' || !Number.isFinite(durationMs) || durationMs <= 0)) {
    throw new ValidationError('durationMs must be a positive number, or null to clear a restriction.');
  }

  const siteRef = db.collection('users').doc(uid).collection('sites').doc(siteId);
  const siteSnap = await siteRef.get();
  if (!siteSnap.exists) throw new NotFoundError('Site not found, or you do not have access to it.');

  const until = durationMs === null ? null : Date.now() + durationMs;

  // Same fan-out hooks/useActiveSiteData.ts's old restrictVisitor did:
  // every visit row for this visitorId gets the shared restrictedUntil
  // stamp, plus the blockedVisitors/{visitorId} doc the tracking
  // script actually reads. Bounded batch (a visitor with an
  // unreasonable number of visit rows degrades gracefully by simply
  // restricting the first 400 found rather than failing the whole
  // request — matches Firestore's own 500-write batch ceiling with
  // headroom for the two extra writes below).
  const matchingVisits = await siteRef.collection('visits').where('visitorId', '==', visitorId).limit(495).get();

  const batch = db.batch();
  matchingVisits.forEach((d) => batch.update(d.ref, { restrictedUntil: until }));

  const blockRef = siteRef.collection('blockedVisitors').doc(visitorId);
  if (until !== null) {
    batch.set(blockRef, { restrictedUntil: until }, { merge: true });
  } else {
    batch.set(blockRef, { restrictedUntil: FieldValue.delete() }, { merge: true });
  }
  await batch.commit();

  return { siteId, visitorId, restrictedUntil: until, affected: matchingVisits.size };
}

async function doSaveOverlay(
  db: FirebaseFirestore.Firestore,
  uid: string,
  payload: any
): Promise<Record<string, unknown>> {
  const { siteId, overlay } = payload || {};
  if (!siteId || typeof siteId !== 'string') throw new ValidationError('Missing siteId.');

  const siteRef = db.collection('users').doc(uid).collection('sites').doc(siteId);
  const siteSnap = await siteRef.get();
  if (!siteSnap.exists) throw new NotFoundError('Site not found, or you do not have access to it.');

  const existingOverlay = siteSnap.data()?.overlay;
  const prevVersion = typeof existingOverlay?.version === 'number' ? existingOverlay.version : 0;

  // sanitizeSiteOverlay coerces the untrusted payload into a fully
  // valid SiteOverlayDoc (same coercion useOverlayComposer.ts relied
  // on the client SDK's shape-trust for) — see lib/siteAlert.ts. This
  // is the one place malformed/oversized overlay content from the
  // client gets cut down before it's ever written with Admin-SDK
  // privilege.
  const clean = sanitizeSiteOverlay(overlay, prevVersion);
  const payloadOut = { ...clean, updatedAt: Date.now() };

  const batch = db.batch();
  // Owner-only site doc — drives the dashboard's own "live now" state.
  batch.set(siteRef, { overlay: payloadOut }, { merge: true });
  // Public siteOverlay doc — the one the live tracking script reads.
  // Kept separate so a visitor's read access never extends to
  // anything else on the owner-only site doc.
  batch.set(
    db.collection('siteOverlay').doc(siteId),
    { ...payloadOut, updatedAt: FieldValue.serverTimestamp() },
    { merge: true }
  );
  await batch.commit();

  return { siteId, overlay: payloadOut };
}

class ValidationError extends Error {}
class NotFoundError extends Error {}

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

    const { idToken, action, payload } = body || {};

    if (!VALID_ACTIONS.has(action)) {
      return jsonError(400, `Unknown action. Expected one of: ${Array.from(VALID_ACTIONS).join(', ')}.`);
    }

    let app;
    try {
      app = getAdminApp();
    } catch (err) {
      console.error('[user-action] Firebase Admin init error', err);
      return jsonError(500, 'Server is not configured yet (missing Firebase Admin credentials).');
    }

    const uid = await verifyCaller(app, idToken);
    if (!uid) return jsonError(401, 'Invalid or expired session. Please sign in again.');

    // Generous per-uid, per-action rate limit — this is an
    // authenticated owner action, not a public endpoint, but still
    // bounded so a buggy client retry-loop can't hammer Firestore
    // (same reasoning as every existing route's `allow(...)` call).
    if (!rateLimitOk(`user-action:${uid}:${action}`, 30, 60_000)) {
      return jsonError(429, 'Too many requests. Please try again shortly.');
    }

    const db = getAdminDb();
    const planId = await getCallerPlan(db, uid);

    // ---- The ONE gate every action goes through: the daily write cap ----
    // Checked (and incremented) BEFORE the actual write is attempted,
    // so a user who is already at today's limit cannot perform ANY of
    // the actions below, no matter which one they call — this is what
    // makes the cap apply account-wide rather than per-action.
    try {
      await checkAndIncrementAccountWrites(db, uid, planId);
    } catch (err) {
      if (err instanceof WriteLimitReachedError) {
        return writeLimitResponse(planId, err);
      }
      throw err;
    }

    let data: Record<string, unknown>;
    try {
      switch (action) {
        case 'update-profile':
          data = await doUpdateProfile(db, uid, payload);
          break;
        case 'update-settings':
          data = await doUpdateSettings(db, uid, payload);
          break;
        case 'update-plan':
          data = await doUpdatePlan(db, uid, payload);
          break;
        case 'pause-site':
          data = await doPauseSite(db, uid, payload);
          break;
        case 'disconnect-site':
          data = await doDisconnectSite(db, uid, payload);
          break;
        case 'restrict-visitor':
          data = await doRestrictVisitor(db, uid, payload);
          break;
        case 'save-overlay':
          data = await doSaveOverlay(db, uid, payload);
          break;
        default:
          // Unreachable — VALID_ACTIONS already filtered this — kept
          // only so TypeScript sees every case covered.
          return jsonError(400, 'Unknown action.');
      }
    } catch (err) {
      // NOTE: the write-limit increment above is NOT rolled back on a
      // validation failure below. This is deliberate, same trade-off
      // app/api/widget/route.ts's fire-and-forget usage counter makes:
      // rolling back would require wrapping the increment and the
      // action's own write in a single transaction, which the overlay/
      // visitor-restriction actions' multi-doc batches don't cleanly
      // support without a much larger rewrite. A bad request that
      // fails validation still "spends" one write out of the daily
      // budget — an acceptable, minor over-count in exchange for a
      // much simpler implementation, and self-correcting since the
      // client validates before sending in the first place.
      if (err instanceof ValidationError) return jsonError(400, err.message);
      if (err instanceof NotFoundError) return jsonError(404, err.message);
      console.error(`[user-action] ${action} error`, err);
      return jsonError(500, 'Something went wrong making that change.');
    }

    return NextResponse.json({ ok: true, action, ...data }, { status: 200, headers: { 'Cache-Control': 'no-store' } });
  } catch (err) {
    console.error('[user-action] handler error', err);
    return jsonError(500, 'Something went wrong.');
  }
}
