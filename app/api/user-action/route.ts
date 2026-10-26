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
//         'pause-site' | 'disconnect-site' | 'update-site-permissions' |
//         'restrict-visitor' | 'save-overlay'
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
import { CONNECT_PERMISSIONS, isPermissionAllowedForPlan } from '@/lib/connectPermissions';
import type { PlanId } from '@/lib/plans';

export const maxDuration = 10;
export const runtime = 'nodejs';

const MAX_BODY_BYTES = 16 * 1024;

const VALID_ACTIONS = new Set([
  'update-profile',
  'update-settings',
  'update-plan',
  'pause-site',
  'disconnect-site',
  'update-site-permissions',
  'restrict-visitor',
  'save-overlay',
  'accept-terms',
  'pause-all-sites',
  'disconnect-all-sites',
  'delete-all-widgets',
  'delete-account',
  'delete-lead',
  'restore-lead',
]);

// Bumped whenever the onboarding Terms & Data-Use step's copy changes
// in a way that should make every account re-accept (e.g. a new data
// category gets collected). hooks/useOnboardingStatus.ts gates purely
// on termsAcceptedAt existing, not on this matching — re-prompting an
// already-accepted account on a version bump is a deliberate future
// lever, not wired up yet, so this constant is just recorded alongside
// the timestamp for that day.
const TERMS_VERSION = 1;

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

// Edits a site's granted-permissions list after connect time — the
// "you can change any of these later from site settings" promise
// ConnectPermissionsGrid's intro copy makes (see that component's
// header comment). Lives behind this shared route rather than its own
// endpoint, same reasoning as every other per-site write here: one
// place enforces auth + ownership + the daily write cap, and the
// permission catalog's own plan-gating (lib/connectPermissions.ts) is
// re-checked against the CALLER'S REAL PLAN here, never trusted from
// the client — a devtools-edited request asking for a permission the
// account's plan doesn't allow has every one of those ids silently
// dropped rather than the whole request rejected, same tolerance
// app/api/connect-site/route.ts's own re-validation gives at connect
// time (and the same reason: the UI already disables the switch for a
// locked permission, so a mismatched request only happens via
// something bypassing that UI, not an honest client racing a recent
// downgrade).
async function doUpdateSitePermissions(
  db: FirebaseFirestore.Firestore,
  uid: string,
  planId: PlanId,
  payload: any
): Promise<Record<string, unknown>> {
  const { siteId, permissionIds } = payload || {};
  if (!siteId || typeof siteId !== 'string') throw new ValidationError('Missing siteId.');
  if (
    !Array.isArray(permissionIds) ||
    permissionIds.length > CONNECT_PERMISSIONS.length ||
    permissionIds.some((id) => typeof id !== 'string')
  ) {
    throw new ValidationError('permissionIds must be an array of permission id strings.');
  }

  const siteRef = db.collection('users').doc(uid).collection('sites').doc(siteId);
  const siteSnap = await siteRef.get();
  if (!siteSnap.exists) throw new NotFoundError('Site not found, or you do not have access to it.');

  // De-dupe, then drop anything the caller's actual plan doesn't allow
  // and anything that isn't a real catalog id at all (a stale/renamed
  // id some client still has cached, say) — ConnectPermissionsGrid
  // only ever sends live, plan-appropriate ids when driven through its
  // own switches, so this is a server-side backstop, not something a
  // well-behaved client is expected to hit.
  const requested = Array.from(new Set(permissionIds as string[]));
  const permissions = requested.filter(
    (id) => CONNECT_PERMISSIONS.some((p) => p.id === id) && isPermissionAllowedForPlan(id, planId)
  );

  await siteRef.set({ permissions }, { merge: true });
  return { siteId, permissions };
}

// ── Danger Zone: account-wide bulk actions ───────────────────────────
// Below are the three Danger Zone actions that fan out across every
// site/widget the account owns, plus full account deletion. Each one
// still only costs a single daily-write-limit increment (the shared
// check in POST below runs once per request, same as every other
// action here) even though it may touch many Firestore docs — these
// are rare, user-initiated, deliberate actions, not something a
// script would call in a loop.

async function doPauseAllSites(
  db: FirebaseFirestore.Firestore,
  uid: string,
  payload: any
): Promise<Record<string, unknown>> {
  const { paused } = payload || {};
  if (typeof paused !== 'boolean') throw new ValidationError('paused must be a boolean.');

  const sitesSnap = await db.collection('users').doc(uid).collection('sites').get();
  if (sitesSnap.empty) return { paused, affected: 0 };

  // Firestore batches cap at 500 writes; a single account's site list
  // is expected to stay well under that, but chunk defensively so a
  // large account doesn't hard-fail instead of degrading.
  const docs = sitesSnap.docs;
  for (let i = 0; i < docs.length; i += 450) {
    const batch = db.batch();
    for (const d of docs.slice(i, i + 450)) {
      batch.set(d.ref, { paused }, { merge: true });
    }
    await batch.commit();
  }

  return { paused, affected: docs.length };
}

async function doDisconnectAllSites(
  db: FirebaseFirestore.Firestore,
  uid: string,
  _payload: any
): Promise<Record<string, unknown>> {
  const sitesSnap = await db.collection('users').doc(uid).collection('sites').get();
  if (sitesSnap.empty) return { disconnected: true, affected: 0 };

  // Same shape as doDisconnectSite: removes the owner's site doc AND
  // the flat siteIndex/{siteId} lookup doc for each one, so /api/track
  // and /api/widget stop recognizing every one of this account's
  // siteIds immediately. Does not cascade-delete visits/leads
  // subcollections — same deliberate scope limit as the single-site
  // version (see that function's comment).
  const docs = sitesSnap.docs;
  for (let i = 0; i < docs.length; i += 225) {
    const batch = db.batch();
    for (const d of docs.slice(i, i + 225)) {
      batch.delete(db.collection('siteIndex').doc(d.id));
      batch.delete(d.ref);
    }
    await batch.commit();
  }

  return { disconnected: true, affected: docs.length };
}

async function doDeleteAllWidgets(
  db: FirebaseFirestore.Firestore,
  uid: string,
  _payload: any
): Promise<Record<string, unknown>> {
  // Deletes every users/{uid}/sites/{siteId}/widgets/{widgetId} doc
  // across every site this account owns (lib/widgets.ts's
  // SiteWidgetDoc) — the per-site enablement/config docs that make a
  // widget live on that site. The global widgets/{widgetId} catalog
  // itself is untouched (that's shared across all accounts, not
  // per-user data). app/api/widget/route.ts reads this subcollection
  // at request time to decide whether to serve a widget, so once a
  // doc is gone that widget stops being delivered on that site
  // immediately.
  const sitesSnap = await db.collection('users').doc(uid).collection('sites').get();
  if (sitesSnap.empty) return { affected: 0 };

  let affected = 0;
  for (const siteDoc of sitesSnap.docs) {
    const widgetsSnap = await siteDoc.ref.collection('widgets').get();
    if (widgetsSnap.empty) continue;
    const docs = widgetsSnap.docs;
    for (let i = 0; i < docs.length; i += 450) {
      const batch = db.batch();
      for (const w of docs.slice(i, i + 450)) batch.delete(w.ref);
      await batch.commit();
    }
    affected += docs.length;
  }

  return { affected };
}

async function doDeleteAccount(
  db: FirebaseFirestore.Firestore,
  uid: string,
  payload: any
): Promise<Record<string, unknown>> {
  const { confirmEmail } = payload || {};
  if (!confirmEmail || typeof confirmEmail !== 'string') {
    throw new ValidationError('confirmEmail is required.');
  }

  // Looked up fresh from the Admin SDK by uid (never trusted from the
  // request body) so this still works for a Google sign-in account —
  // there's no password to re-check, but the account's real email on
  // file is just as good a confirmation, and a caller can't confirm a
  // different account's email than their own since uid itself came
  // from the verified ID token.
  const { getAuth } = await import('firebase-admin/auth');
  const authUser = await getAuth(getAdminApp()).getUser(uid);
  const callerEmail = authUser.email || null;
  if (!callerEmail || confirmEmail.trim().toLowerCase() !== callerEmail.trim().toLowerCase()) {
    throw new ValidationError('That email does not match your account email.');
  }

  // Delete owned sites + their siteIndex lookup docs, and every site's
  // widgets subcollection, same as the bulk actions above — then the
  // top-level user doc, then the Firebase Auth user itself so the
  // account can no longer sign in at all. Does NOT cascade-delete
  // visits/leads/blockedVisitors subcollections under each site (same
  // scope limit as doDisconnectSite — recursive delete across
  // unbounded subcollections is out of scope for a single request
  // with a 10s budget).
  const sitesSnap = await db.collection('users').doc(uid).collection('sites').get();
  for (const siteDoc of sitesSnap.docs) {
    const widgetsSnap = await siteDoc.ref.collection('widgets').get();
    const docs = widgetsSnap.docs;
    for (let i = 0; i < docs.length; i += 450) {
      const batch = db.batch();
      for (const w of docs.slice(i, i + 450)) batch.delete(w.ref);
      await batch.commit();
    }
  }

  const siteDocs = sitesSnap.docs;
  for (let i = 0; i < siteDocs.length; i += 225) {
    const batch = db.batch();
    for (const d of siteDocs.slice(i, i + 225)) {
      batch.delete(db.collection('siteIndex').doc(d.id));
      batch.delete(d.ref);
    }
    await batch.commit();
  }

  await db.collection('users').doc(uid).delete();
  await getAuth(getAdminApp()).deleteUser(uid);

  return { deleted: true };
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

// Onboarding's final, mandatory step (components/onboarding/OnboardingFlow.tsx)
// — records that this account has accepted the Terms & Data-Use
// disclosure. useOnboardingStatus.ts's Firestore subscription on
// users/{uid} is what actually gates the onboarding overlay on every
// visit: it re-shows the flow (starting from this step) any time
// termsAcceptedAt is missing, so this write is the one thing that
// makes onboarding "complete" stick across sessions/devices.
async function doAcceptTerms(
  db: FirebaseFirestore.Firestore,
  uid: string,
  _payload: any
): Promise<Record<string, unknown>> {
  const termsAcceptedAt = Date.now();
  await db.collection('users').doc(uid).set(
    { termsAcceptedAt, termsVersion: TERMS_VERSION },
    { merge: true }
  );
  return { termsAcceptedAt, termsVersion: TERMS_VERSION };
}

// Soft-deletes/restores a single lead for the /dashboard/leads "Bin"
// (see EmailCapturePage.tsx). A soft delete just stamps deletedAt —
// the doc stays in Firestore so it can be restored, and is excluded
// client-side (and from /api/leads-export) by filtering on that
// field. Mirrors doRestrictVisitor's shape: verify site ownership,
// then a single-doc write scoped under that site.
async function doDeleteLead(
  db: FirebaseFirestore.Firestore,
  uid: string,
  payload: any
): Promise<Record<string, unknown>> {
  const { siteId, leadId } = payload || {};
  if (!siteId || typeof siteId !== 'string') throw new ValidationError('Missing siteId.');
  if (!leadId || typeof leadId !== 'string') throw new ValidationError('Missing leadId.');

  const siteRef = db.collection('users').doc(uid).collection('sites').doc(siteId);
  const siteSnap = await siteRef.get();
  if (!siteSnap.exists) throw new NotFoundError('Site not found, or you do not have access to it.');

  const leadRef = siteRef.collection('leads').doc(leadId);
  const leadSnap = await leadRef.get();
  if (!leadSnap.exists) throw new NotFoundError('That email was not found — it may already be deleted.');

  const deletedAt = Date.now();
  await leadRef.set({ deletedAt }, { merge: true });
  return { siteId, leadId, deletedAt };
}

async function doRestoreLead(
  db: FirebaseFirestore.Firestore,
  uid: string,
  payload: any
): Promise<Record<string, unknown>> {
  const { siteId, leadId } = payload || {};
  if (!siteId || typeof siteId !== 'string') throw new ValidationError('Missing siteId.');
  if (!leadId || typeof leadId !== 'string') throw new ValidationError('Missing leadId.');

  const siteRef = db.collection('users').doc(uid).collection('sites').doc(siteId);
  const siteSnap = await siteRef.get();
  if (!siteSnap.exists) throw new NotFoundError('Site not found, or you do not have access to it.');

  const leadRef = siteRef.collection('leads').doc(leadId);
  const leadSnap = await leadRef.get();
  if (!leadSnap.exists) throw new NotFoundError('That email was not found.');

  await leadRef.set({ deletedAt: FieldValue.delete() }, { merge: true });
  return { siteId, leadId };
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
        case 'update-site-permissions':
          data = await doUpdateSitePermissions(db, uid, planId, payload);
          break;
        case 'restrict-visitor':
          data = await doRestrictVisitor(db, uid, payload);
          break;
        case 'save-overlay':
          data = await doSaveOverlay(db, uid, payload);
          break;
        case 'accept-terms':
          data = await doAcceptTerms(db, uid, payload);
          break;
        case 'pause-all-sites':
          data = await doPauseAllSites(db, uid, payload);
          break;
        case 'disconnect-all-sites':
          data = await doDisconnectAllSites(db, uid, payload);
          break;
        case 'delete-all-widgets':
          data = await doDeleteAllWidgets(db, uid, payload);
          break;
        case 'delete-account':
          data = await doDeleteAccount(db, uid, payload);
          break;
        case 'delete-lead':
          data = await doDeleteLead(db, uid, payload);
          break;
        case 'restore-lead':
          data = await doRestoreLead(db, uid, payload);
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
