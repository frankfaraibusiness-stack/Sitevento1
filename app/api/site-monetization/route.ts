// app/api/site-monetization/route.ts
//
// POST { idToken, siteId, enabled }
//
// Writes users/{uid}/sites/{siteId}/monetization/config with the
// Admin SDK. Same ownership-verification shape as
// app/api/site-widget/route.ts and app/api/site-agent/route.ts — see
// site-widget's header for the full reasoning on recovering a trusted
// uid from a verified Firebase ID token rather than trusting the
// request body; identical here, not repeated.
//
// ── The one real gate: site verification ──────────────────────────────
// There's no manual-review step for monetization (see
// lib/monetization.ts's header) — a verified site is instantly
// eligible. But "instantly eligible" still has to be enforced
// server-side, not just by disabling the toggle in the UI (same
// reasoning as site-widget's SITE_NOT_VERIFIED gate): this route
// re-reads the site's current status fresh from Firestore before
// writing enabled:true, and refuses to turn the feature on for an
// unverified site no matter what the client sent. Turning it OFF is
// always allowed, verified or not — there's never a reason to block
// an owner from switching off their own monetization.
import { NextRequest, NextResponse } from 'next/server';
import { initializeApp, getApps, cert } from 'firebase-admin/app';
import { getAuth } from 'firebase-admin/auth';
import { getFirestore, FieldValue } from 'firebase-admin/firestore';
import { allow } from '@/lib/rateLimit';

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

const MAX_BODY_BYTES = 2 * 1024; // just { idToken, siteId, enabled }

function jsonError(status: number, message: string, extra?: Record<string, unknown>) {
  return NextResponse.json({ ok: false, error: message, ...extra }, { status, headers: { 'Cache-Control': 'no-store' } });
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

    const { idToken, siteId, enabled } = body || {};

    if (!idToken || typeof idToken !== 'string') {
      return jsonError(401, 'Missing idToken.');
    }
    if (!siteId || typeof siteId !== 'string' || siteId.length > 100) {
      return jsonError(400, 'Missing or invalid siteId.');
    }
    if (typeof enabled !== 'boolean') {
      return jsonError(400, 'enabled must be a boolean.');
    }

    let app;
    try {
      app = getAdminApp();
    } catch (err) {
      console.error('[site-monetization] Firebase Admin init error', err);
      return jsonError(500, 'Server is not configured yet (missing Firebase Admin credentials).');
    }

    let uid: string;
    try {
      const decoded = await getAuth(app).verifyIdToken(idToken);
      uid = decoded.uid;
    } catch {
      return jsonError(401, 'Invalid or expired session. Please sign in again.');
    }

    if (!allow(`site-monetization:${uid}:${siteId}`, 20, 60_000)) {
      return jsonError(429, 'Too many requests. Please try again shortly.');
    }

    const db = getFirestore(app);

    const siteRef = db.collection('users').doc(uid).collection('sites').doc(siteId);
    const siteSnap = await siteRef.get();
    if (!siteSnap.exists) {
      return jsonError(404, 'Site not found, or you do not have access to it.');
    }

    const siteData = siteSnap.data() || {};
    const verified = siteData.status === 'verified';

    // The actual security boundary: turning monetization ON is refused
    // here, server-side, for an unverified site — regardless of what
    // the UI already prevented. Turning it off is never blocked.
    if (enabled && !verified) {
      return jsonError(409, "This site isn't verified yet, so monetization can't be turned on.", {
        reason: 'SITE_NOT_VERIFIED',
      });
    }

    const monetizationRef = siteRef.collection('monetization').doc('config');
    const data = {
      enabled,
      updatedAt: FieldValue.serverTimestamp(),
    };

    await monetizationRef.set(data, { merge: true });

    return NextResponse.json(
      { ok: true, monetization: { enabled: data.enabled } },
      { status: 200, headers: { 'Cache-Control': 'no-store' } }
    );
  } catch (err) {
    console.error('[site-monetization] handler error', err);
    return jsonError(500, 'Something went wrong saving that setting.');
  }
}
