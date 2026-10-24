// app/api/connect-site/route.ts
//
// POST { idToken, url }
//
// Creates a new users/{uid}/sites/{siteId} doc (+ its siteIndex/{siteId}
// lookup doc), replacing hooks/useConnectSiteWizard.ts's old direct
// client-side addDoc()/setDoc() calls. Mirrors app/api/site-widget/
// route.ts's Admin-SDK + verified-ID-token pattern.
//
// ── Why this has to move server-side ──────────────────────────────────
// /api/site-limits (read-only) can tell the UI "you're at your limit"
// so the wizard never even opens — but that's advisory. A user could
// still open devtools and call the Firestore client SDK's addDoc()
// directly, skipping the UI gate entirely, as long as firestore.rules
// allowed it. Firestore rules can't cleanly enforce "count of sibling
// docs < a value read from a different document" as an atomic,
// race-safe check. So the real fix is what this route does: move site
// *creation* itself server-side behind the Admin SDK (which bypasses
// rules), re-check the plan limit here with a transaction immediately
// before writing, and have firestore.rules block client-side `create`
// on these paths (update/delete for existing sites stay client-side,
// unaffected — see firestore.rules's comment on that split).
//
// A transaction (not a plain read-then-write) is used for the count +
// create so two near-simultaneous requests (two tabs, a double-click)
// can't both read "4 of 5" and both create, landing the account at 6.
import { NextRequest, NextResponse } from 'next/server';
import { getAuth } from 'firebase-admin/auth';
import { getApps, initializeApp, cert } from 'firebase-admin/app';
import { getFirestore, FieldValue } from 'firebase-admin/firestore';
import { allow } from '@/lib/rateLimit';
import { getPlan, type PlanId } from '@/lib/plans';
import { overlayFromTemplate } from '@/lib/siteAlert';
import { lookupDomain } from '@/lib/domainLookup';
import type { SiteDomainInfo } from '@/lib/types';

export const maxDuration = 10;
export const runtime = 'nodejs';

const DEFAULT_PLAN_ID: PlanId = 'free';

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

// Same normalization logic the client hook used to do in
// useConnectSiteWizard.ts's normalizeUrl — duplicated here rather than
// imported, since that file is 'use client' and this route must not
// pull client-only code into the server bundle. Keep these in sync if
// the accepted-URL shape ever changes.
function normalizeUrl(raw: string): string | null {
  let v = (raw || '').trim();
  if (!/^https?:\/\//i.test(v)) v = 'https://' + v;
  try {
    const u = new URL(v);
    if (!/^[a-z0-9-]+(\.[a-z0-9-]+)+$/i.test(u.hostname)) return null;
    return u.origin + (u.pathname !== '/' ? u.pathname : '');
  } catch {
    return null;
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

    const { idToken, url } = body || {};

    if (!idToken || typeof idToken !== 'string') {
      return jsonError(401, 'Missing idToken.');
    }
    if (!url || typeof url !== 'string' || url.length > 500) {
      return jsonError(400, 'Missing or invalid url.');
    }

    const normalized = normalizeUrl(url);
    if (!normalized) {
      return jsonError(400, "That doesn't look like a valid URL.");
    }

    let app;
    try {
      app = getAdminApp();
    } catch (err) {
      console.error('[connect-site] Firebase Admin init error', err);
      return jsonError(500, 'Server is not configured yet (missing Firebase Admin credentials).');
    }

    let uid: string;
    try {
      const decoded = await getAuth(app).verifyIdToken(idToken);
      uid = decoded.uid;
    } catch (err) {
      return jsonError(401, 'Invalid or expired session. Please sign in again.');
    }

    if (!allow(`connect-site:${uid}`, 10, 60_000)) {
      return jsonError(429, 'Too many requests. Please try again shortly.');
    }

    const db = getFirestore(app);

    let hostname = normalized;
    try {
      hostname = new URL(normalized).hostname;
    } catch {
      /* leave hostname as-is */
    }

    // Same best-effort RDAP lookup the connect wizard's step-1 "domain
    // intel" card shows live (app/api/domain-lookup/route.ts via
    // lib/domainLookup.ts) — run once here and persisted onto the site
    // doc below, so the info survives past the wizard closing instead
    // of only ever being shown transiently. Deliberately run BEFORE
    // the transaction (it's a slow outbound network call to rdap.org,
    // which has no place inside a Firestore transaction's
    // read-then-write retry loop) and never allowed to block or fail
    // site creation — lookupDomain() always resolves, never throws, so
    // a slow/absent RDAP response just means domainInfo.found stays
    // false rather than the connect flow erroring out.
    const domainInfo: SiteDomainInfo = await lookupDomain(hostname);

    const userRef = db.collection('users').doc(uid);
    const sitesRef = userRef.collection('sites');

    // ---- Atomic limit check + create ----
    // Everything that decides "are we allowed to create" and the
    // create itself happen inside one transaction, so two concurrent
    // requests can't both pass the check against the same stale count.
    let newSiteId: string;
    try {
      newSiteId = await db.runTransaction(async (tx) => {
        const userSnap = await tx.get(userRef);
        const userData = userSnap.exists ? userSnap.data() || {} : {};
        const planId: PlanId = isValidPlanId(userData.plan) ? userData.plan : DEFAULT_PLAN_ID;
        const plan = getPlan(planId);

        // Firestore transactions require all reads before writes, and
        // count() aggregation reads are allowed inside a transaction —
        // this still gets the atomicity we need (no two transactions
        // can commit a create off the same pre-write count).
        const countSnap = await tx.get(sitesRef.count());
        const used = countSnap.data().count;

        if (used >= plan.limits.connectedSites) {
          // Thrown value is caught below and turned into the 403
          // limit-reached response, outside the transaction retry path.
          throw new LimitReachedError(planId, plan.limits.connectedSites, used);
        }

        const siteRef = sitesRef.doc();
        tx.set(siteRef, {
          name: hostname,
          url: normalized,
          status: 'pending',
          paused: false,
          overlay: overlayFromTemplate('announcement'),
          domainInfo,
          createdAt: FieldValue.serverTimestamp(),
        });

        const siteIndexRef = db.collection('siteIndex').doc(siteRef.id);
        tx.set(siteIndexRef, {
          uid,
          createdAt: FieldValue.serverTimestamp(),
        });

        return siteRef.id;
      });
    } catch (err) {
      if (err instanceof LimitReachedError) {
        return jsonError(403, `You've reached your plan's limit of ${err.limit} connected site${err.limit === 1 ? '' : 's'}.`, {
          code: 'SITE_LIMIT_REACHED',
          planId: err.planId,
          limit: err.limit,
          used: err.used,
        });
      }
      console.error('[connect-site] transaction error', err);
      return jsonError(500, 'Could not save that site. Please try again.');
    }

    return NextResponse.json(
      { ok: true, siteId: newSiteId, url: normalized, hostname },
      { status: 200, headers: { 'Cache-Control': 'no-store' } }
    );
  } catch (err) {
    console.error('[connect-site] handler error', err);
    return jsonError(500, 'Something went wrong saving that site.');
  }
}

class LimitReachedError extends Error {
  planId: PlanId;
  limit: number;
  used: number;
  constructor(planId: PlanId, limit: number, used: number) {
    super('SITE_LIMIT_REACHED');
    this.planId = planId;
    this.limit = limit;
    this.used = used;
  }
}
