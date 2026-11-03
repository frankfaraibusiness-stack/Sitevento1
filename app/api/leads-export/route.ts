// app/api/leads-export/route.ts
//
// POST { idToken, siteId }
//
// Returns the FULL (uncapped) list of active (non-deleted) captured
// leads for one site, for the /dashboard/leads page's "Download all" /
// "Export all" actions (components/dashboard/EmailCapturePage.tsx).
// The live-subscribed list those actions sit above
// (hooks/useActiveSiteData.ts) is capped to the 50 most recent leads
// client-side, which isn't a real export — this route reads the whole
// subcollection server-side instead.
//
// Gated by lib/limits.ts's FEATURE_LIMITS['data-export'] (Free 2/day,
// Starter 100/day, Scale 1,000/day, Pro Developer unlimited), same
// quota-in-a-transaction pattern as app/api/block-visitor/route.ts:
// read-then-increment happens atomically so two near-simultaneous
// export clicks can't both read "1 of 2 used today" and both proceed.
// This is a read-only export (no Firestore write to the leads
// themselves), so it does NOT count against the account's daily write
// limit (lib/serverAuth.ts) — only against this feature's own quota.
import { NextRequest, NextResponse } from 'next/server';
import { getAuth } from 'firebase-admin/auth';
import { getApps, initializeApp, cert } from 'firebase-admin/app';
import { getFirestore } from 'firebase-admin/firestore';
import { allow } from '@/lib/rateLimit';
import { getPlan, type PlanId } from '@/lib/plans';
import { featureDailyLimit } from '@/lib/limits';

export const maxDuration = 10;
export const runtime = 'nodejs';

const DEFAULT_PLAN_ID: PlanId = 'free';
const FEATURE_ID = 'data-export';

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

function nextPlanAfter(planId: PlanId): PlanId | null {
  const order: PlanId[] = ['free', 'starter', 'scale', 'pro-developer'];
  const idx = order.indexOf(planId);
  if (idx === -1 || idx === order.length - 1) return null;
  return order[idx + 1];
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
    if (raw.length > 2 * 1024) {
      return jsonError(400, 'Request body too large.');
    }

    let body: any;
    try {
      body = JSON.parse(raw);
    } catch {
      return jsonError(400, 'Malformed JSON body.');
    }

    const { idToken, siteId } = body || {};
    if (!idToken || typeof idToken !== 'string') {
      return jsonError(401, 'Missing idToken.');
    }
    if (!siteId || typeof siteId !== 'string') {
      return jsonError(400, 'Missing siteId.');
    }

    let app;
    try {
      app = getAdminApp();
    } catch (err) {
      console.error('[leads-export] Firebase Admin init error', err);
      return jsonError(500, 'Server is not configured yet (missing Firebase Admin credentials).');
    }

    let uid: string;
    try {
      const decoded = await getAuth(app).verifyIdToken(idToken);
      uid = decoded.uid;
    } catch {
      return jsonError(401, 'Invalid or expired session. Please sign in again.');
    }

    if (!allow(`leads-export:${uid}`, 20, 60_000)) {
      return jsonError(429, 'Too many requests. Please try again shortly.');
    }

    const db = getFirestore(app);
    const siteRef = db.collection('users').doc(uid).collection('sites').doc(siteId);

    const siteSnap = await siteRef.get();
    if (!siteSnap.exists) {
      return jsonError(404, 'Site not found.');
    }

    const userRef = db.collection('users').doc(uid);
    const userSnap = await userRef.get();
    const userData = userSnap.exists ? userSnap.data() || {} : {};
    const planId: PlanId = isValidPlanId(userData.plan) ? userData.plan : DEFAULT_PLAN_ID;
    const plan = getPlan(planId);

    const usageRef = userRef.collection('usage').doc(todayKey());

    try {
      await db.runTransaction(async (tx) => {
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
      });
    } catch (err) {
      if (err instanceof QuotaReachedError) {
        return jsonError(
          429,
          `Daily export limit reached (${err.limit}/day on your ${plan.name} plan). Upgrade for a higher daily limit.`,
          { code: 'FEATURE_LIMIT_REACHED', planId, limit: err.limit, used: err.used, nextPlanId: nextPlanAfter(planId) }
        );
      }
      console.error('[leads-export] quota transaction error', err);
      return jsonError(500, 'Could not prepare that export right now.');
    }

    // Quota granted — now read every active (non-deleted) lead for
    // this site. Not paginated: a CSV export is inherently a
    // whole-collection read, and the per-site lead count here is small
    // enough (same order of magnitude as visits) not to need cursoring.
    const leadsSnap = await siteRef.collection('leads').orderBy('ts', 'desc').get();
    const leads = leadsSnap.docs
      .map((d) => {
        const data = d.data() || {};
        return {
          id: d.id,
          email: typeof data.email === 'string' ? data.email : '',
          source: typeof data.source === 'string' ? data.source : null,
          ts: typeof data.ts?.toMillis === 'function' ? data.ts.toMillis() : data.ts ?? null,
          deletedAt: typeof data.deletedAt === 'number' ? data.deletedAt : null,
        };
      })
      .filter((l) => !l.deletedAt && l.email);

    return NextResponse.json(
      { ok: true, siteId, leads, count: leads.length },
      { status: 200, headers: { 'Cache-Control': 'no-store' } }
    );
  } catch (err) {
    console.error('[leads-export] handler error', err);
    return jsonError(500, 'Could not prepare that export right now.');
  }
}
