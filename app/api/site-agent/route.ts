// app/api/site-agent/route.ts
//
// POST { idToken, siteId, active, model, enabledFeatureIds,
//        blockedCountries, timezone }
//
// Writes users/{uid}/sites/{siteId}/agent/config with the Admin SDK.
// Same ownership-verification shape as app/api/site-widget/route.ts —
// see that route's header comment for the full reasoning on why a
// trusted uid has to be recovered from a verified Firebase ID token
// rather than trusted from the request body, since the Admin SDK
// bypasses Firestore security rules entirely. Nothing below repeats
// that reasoning; it's identical here.
//
// ── Plan enforcement happens HERE, not just in the UI ─────────────────
// AgentFeatureGrid already disables toggles the caller's plan can't
// use, and AgentModelPicker already disables ventol-plus below
// 'starter' — but client-side disabling is a UX nicety, not a
// security boundary; nothing stops a POST built by hand (or a stale
// tab open since before a downgrade) from claiming any feature/model.
// clampConfigToPlan (lib/agent.ts) is re-applied here, server-side,
// against the site's CURRENT plan read fresh from Firestore in this
// same request, before anything is written — so the stored config can
// never exceed what the account is actually paying for, regardless of
// what the client sent.
//
// ── Why this is a separate route from site-widget ─────────────────────
// Different subcollection (agent/config, singleton doc — not one doc
// per widgetId), different validation shape (country codes, timezone,
// a feature-id allowlist instead of free-form widget config), and a
// server-side plan clamp site-widget has no equivalent of. Sharing one
// route would mean branching internally on a `kind` field for no real
// code reuse — splitting is simpler to read and to rate-limit
// separately.
import { NextRequest, NextResponse } from 'next/server';
import { initializeApp, getApps, cert } from 'firebase-admin/app';
import { getAuth } from 'firebase-admin/auth';
import { getFirestore, FieldValue } from 'firebase-admin/firestore';
import { allow } from '@/lib/rateLimit';
import {
  AGENT_FEATURES,
  AGENT_MODELS,
  clampConfigToPlan,
  isValidTimezone,
  type AgentConfig,
  type AgentModelId,
} from '@/lib/agent';
import { isValidCountryCode } from '@/lib/countries';
import type { PlanId } from '@/lib/plans';

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

const MAX_BODY_BYTES = 8 * 1024;
const MAX_COUNTRIES = 195; // generous — there are ~195 sovereign states total
const VALID_FEATURE_IDS = new Set(AGENT_FEATURES.map((f) => f.id));
const VALID_MODEL_IDS = new Set(AGENT_MODELS.map((m) => m.id));

function jsonError(status: number, message: string) {
  return NextResponse.json({ ok: false, error: message }, { status, headers: { 'Cache-Control': 'no-store' } });
}

function isPlanId(v: unknown): v is PlanId {
  return v === 'free' || v === 'starter' || v === 'scale' || v === 'pro-developer';
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

    const { idToken, siteId, active, model, enabledFeatureIds, blockedCountries, timezone } = body || {};

    if (!idToken || typeof idToken !== 'string') {
      return jsonError(401, 'Missing idToken.');
    }
    if (!siteId || typeof siteId !== 'string' || siteId.length > 100) {
      return jsonError(400, 'Missing or invalid siteId.');
    }
    if (typeof active !== 'boolean') {
      return jsonError(400, 'active must be a boolean.');
    }
    if (typeof model !== 'string' || !VALID_MODEL_IDS.has(model as AgentModelId)) {
      return jsonError(400, 'Unknown model.');
    }
    if (!Array.isArray(enabledFeatureIds) || enabledFeatureIds.length > AGENT_FEATURES.length) {
      return jsonError(400, 'enabledFeatureIds must be an array.');
    }
    for (const id of enabledFeatureIds) {
      if (typeof id !== 'string' || !VALID_FEATURE_IDS.has(id)) {
        return jsonError(400, `Unknown feature id: ${String(id)}`);
      }
    }
    if (!Array.isArray(blockedCountries) || blockedCountries.length > MAX_COUNTRIES) {
      return jsonError(400, 'blockedCountries must be an array.');
    }
    for (const code of blockedCountries) {
      if (!isValidCountryCode(code)) {
        return jsonError(400, `Unknown country code: ${String(code)}`);
      }
    }
    if (typeof timezone !== 'string' || !isValidTimezone(timezone)) {
      return jsonError(400, 'Unknown or missing timezone.');
    }

    let app;
    try {
      app = getAdminApp();
    } catch (err) {
      console.error('[site-agent] Firebase Admin init error', err);
      return jsonError(500, 'Server is not configured yet (missing Firebase Admin credentials).');
    }

    let uid: string;
    try {
      const decoded = await getAuth(app).verifyIdToken(idToken);
      uid = decoded.uid;
    } catch {
      return jsonError(401, 'Invalid or expired session. Please sign in again.');
    }

    if (!allow(`site-agent:${uid}:${siteId}`, 20, 60_000)) {
      return jsonError(429, 'Too many requests. Please try again shortly.');
    }

    const db = getFirestore(app);

    const siteRef = db.collection('users').doc(uid).collection('sites').doc(siteId);
    const siteSnap = await siteRef.get();
    if (!siteSnap.exists) {
      return jsonError(404, 'Site not found, or you do not have access to it.');
    }

    // Missing/unknown plan reads as 'free', same defensive fallback
    // the rest of the app uses (see lib/types.ts's Site.plan comment)
    // — never assume a paid tier that was never actually granted.
    const siteData = siteSnap.data() || {};
    const plan: PlanId = isPlanId(siteData.plan) ? siteData.plan : 'free';

    const requested: AgentConfig = {
      active,
      model: model as AgentModelId,
      enabledFeatureIds: [...new Set(enabledFeatureIds as string[])],
      blockedCountries: [...new Set(blockedCountries as string[])],
      timezone,
    };

    // The actual security boundary: whatever the client sent, clamp it
    // to what THIS plan, read fresh just now, is really allowed.
    const clamped = clampConfigToPlan(requested, plan);

    const agentRef = siteRef.collection('agent').doc('config');
    const data = {
      ...clamped,
      // An agent can't meaningfully be "active" with nothing turned on
      // and shouldn't silently claim to be running when it was clamped
      // down to zero features by a downgrade — reflect that honestly
      // rather than storing a misleading active:true with an empty list.
      active: clamped.active && clamped.enabledFeatureIds.length > 0,
      updatedAt: FieldValue.serverTimestamp(),
    };

    await agentRef.set(data, { merge: true });

    const wasClamped =
      clamped.enabledFeatureIds.length !== requested.enabledFeatureIds.length || clamped.model !== requested.model;

    return NextResponse.json(
      {
        ok: true,
        agent: { ...clamped, active: data.active },
        clamped: wasClamped,
      },
      { status: 200, headers: { 'Cache-Control': 'no-store' } }
    );
  } catch (err) {
    console.error('[site-agent] handler error', err);
    return jsonError(500, 'Something went wrong saving your agent.');
  }
}
