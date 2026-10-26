// app/api/block-visitor/route.ts
//
// POST { idToken, siteId, visitId, visitorId, blockedValue }
//
// Blocks or unblocks a visitor, server-side, with the daily quota from
// lib/limits.ts's FEATURE_LIMITS['visitor-access-control'] enforced
// (Free 3/day, Starter 1,000/day, Scale 5,000/day, Pro Developer
// unlimited). Replaces hooks/useActiveSiteData.ts's toggleBlockVisit,
// which used to write straight to Firestore with the client SDK —
// exactly the same problem app/api/connect-site/route.ts's header
// comment describes for site creation: a client-only quota check can
// always be bypassed by calling the Firestore client SDK directly, so
// the actual write has to move behind the Admin SDK, with
// firestore.rules blocking the equivalent client-side write (see that
// file's updated rule for users/{uid}/sites/{siteId}/blockedVisitors
// and the visits `blocked` field).
//
// Quota check + the block/unblock write happen in ONE transaction so
// two near-simultaneous requests can't both read "2 of 3 used today"
// and both proceed, landing the account over its daily cap — same
// reasoning as connect-site's site-count transaction.
//
// UNBLOCKING is never quota-limited — only turning blocking ON counts
// against the daily allowance. Undoing a block you already made
// shouldn't cost part of today's trial.
import { NextRequest, NextResponse } from 'next/server';
import { getAuth } from 'firebase-admin/auth';
import { getApps, initializeApp, cert } from 'firebase-admin/app';
import { getFirestore, FieldValue } from 'firebase-admin/firestore';
import { allow } from '@/lib/rateLimit';
import { getPlan, type PlanId } from '@/lib/plans';
import { featureDailyLimit } from '@/lib/limits';

export const maxDuration = 10;
export const runtime = 'nodejs';

const DEFAULT_PLAN_ID: PlanId = 'free';
const FEATURE_ID = 'visitor-access-control';

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

function jsonError(status: number, message: string, extra?: Record<string, unknown>) {
  return NextResponse.json({ ok: false, error: message, ...extra }, { status, headers: { 'Cache-Control': 'no-store' } });
}

function isValidPlanId(value: unknown): value is PlanId {
  return value === 'free' || value === 'starter' || value === 'scale' || value === 'pro-developer';
}

function todayKey(): string {
  return new Date().toISOString().slice(0, 10);
}

class QuotaReachedError extends Error {
  limit: number;
  used: number;
  constructor(limit: number, used: number) {
    super('FEATURE_LIMIT_REACHED');
    this.limit = limit;
    this.used = used;
  }
}

export async function POST(req: NextRequest) {
  try {
    const raw = await req.text();
    if (raw.length > 4 * 1024) {
      return jsonError(400, 'Request body too large.');
    }

    let body: any;
    try {
      body = JSON.parse(raw);
    } catch {
      return jsonError(400, 'Malformed JSON body.');
    }

    const { idToken, siteId, visitId, visitorId, blockedValue } = body || {};

    if (!idToken || typeof idToken !== 'string') {
      return jsonError(401, 'Missing idToken.');
    }
    if (!siteId || typeof siteId !== 'string') {
      return jsonError(400, 'Missing siteId.');
    }
    if (typeof blockedValue !== 'boolean') {
      return jsonError(400, 'Missing or invalid blockedValue.');
    }
    if (!visitId && !visitorId) {
      return jsonError(400, 'Missing visitId or visitorId.');
    }

    let app;
    try {
      app = getAdminApp();
    } catch (err) {
      console.error('[block-visitor] Firebase Admin init error', err);
      return jsonError(500, 'Server is not configured yet (missing Firebase Admin credentials).');
    }

    let uid: string;
    try {
      const decoded = await getAuth(app).verifyIdToken(idToken);
      uid = decoded.uid;
    } catch (err) {
      return jsonError(401, 'Invalid or expired session. Please sign in again.');
    }

    if (!allow(`block-visitor:${uid}`, 60, 60_000)) {
      return jsonError(429, 'Too many requests. Please try again shortly.');
    }

    const db = getFirestore(app);
    const siteRef = db.collection('users').doc(uid).collection('sites').doc(siteId);

    // Verify the caller actually owns this site before touching it —
    // the ID token proves who they are, not that this siteId is theirs.
    const siteSnap = await siteRef.get();
    if (!siteSnap.exists) {
      return jsonError(404, 'Site not found.');
    }

    const userRef = db.collection('users').doc(uid);
    const userSnap = await userRef.get();
    const userData = userSnap.exists ? userSnap.data() || {} : {};
    const planId: PlanId = isValidPlanId(userData.plan) ? userData.plan : DEFAULT_PLAN_ID;
    const plan = getPlan(planId);

    // Find every visit row for this visitorId so all of that visitor's
    // rows flip consistently — mirrors the old client logic exactly,
    // just resolved server-side instead of from locally-cached `visits`.
    const idsToUpdate = new Set<string>();
    if (visitId) idsToUpdate.add(visitId);
    if (visitorId) {
      const matchingVisits = await siteRef.collection('visits').where('visitorId', '==', visitorId).get();
      matchingVisits.forEach((d) => idsToUpdate.add(d.id));
    }

    const usageRef = userRef.collection('usage').doc(todayKey());
    const blockRef = visitorId ? siteRef.collection('blockedVisitors').doc(visitorId) : null;

    try {
      await db.runTransaction(async (tx) => {
        // Only turning blocking ON is quota-limited (see header comment).
        if (blockedValue) {
          const limit = featureDailyLimit(FEATURE_ID, planId);
          if (limit !== null) {
            const usageSnap = await tx.get(usageRef);
            const usageData = usageSnap.exists ? usageSnap.data() || {} : {};
            const features = (usageData.features || {}) as Record<string, number>;
            const used = features[FEATURE_ID] || 0;

            if (used >= limit) {
              throw new QuotaReachedError(limit, used);
            }

            tx.set(usageRef, { features: { ...features, [FEATURE_ID]: used + 1 } }, { merge: true });
          }
        }

        for (const id of idsToUpdate) {
          tx.update(siteRef.collection('visits').doc(id), { blocked: blockedValue });
        }

        if (blockRef) {
          if (blockedValue) {
            tx.set(blockRef, { blockedAt: FieldValue.serverTimestamp() });
          } else {
            tx.delete(blockRef);
          }
        }
      });
    } catch (err) {
      if (err instanceof QuotaReachedError) {
        return jsonError(
          429,
          `Daily visitor-blocking limit reached (${err.limit}/day on your ${plan.name} plan). Upgrade for a higher daily limit.`,
          { code: 'FEATURE_LIMIT_REACHED', planId, limit: err.limit, used: err.used, nextPlanId: nextPlanAfter(planId) }
        );
      }
      console.error('[block-visitor] transaction error', err);
      return jsonError(500, 'Could not update that visitor right now.');
    }

    return NextResponse.json({ ok: true, blocked: blockedValue }, { status: 200, headers: { 'Cache-Control': 'no-store' } });
  } catch (err) {
    console.error('[block-visitor] handler error', err);
    return jsonError(500, 'Could not update that visitor right now.');
  }
}

function nextPlanAfter(planId: PlanId): PlanId | null {
  const order: PlanId[] = ['free', 'starter', 'scale', 'pro-developer'];
  const idx = order.indexOf(planId);
  if (idx === -1 || idx === order.length - 1) return null;
  return order[idx + 1];
}
