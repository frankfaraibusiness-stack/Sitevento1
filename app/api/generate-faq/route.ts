// app/api/generate-faq/route.ts
//
// POST { idToken, siteId, businessDescription, siteTitle?, siteDescription?, count? }
//
// Called from the FAQ Page widget's designer (components/widgets/
// designer/FaqListField.tsx) when the owner clicks "Generate with AI".
// Takes the business description they typed (plus whatever
// title/meta-description POST /api/site-metadata already pulled from
// their own site, passed through as extra context) and returns a
// list of { q, a } pairs the designer drops straight into the
// faq-page widget's `faqs` config field — the owner can then edit,
// reorder, or delete any of them before saving, same as every other
// config field.
//
// Auth shape mirrors app/api/site-agent/route.ts exactly: a Firebase
// ID token is verified server-side to recover the real uid (never
// trusted from the body), and that uid must own siteId. This is a
// real model call, same cost class as /api/chat's AI replies, so it's
// metered the same way everything else account-cost-bearing is: the
// account's daily write cap (checkAndIncrementAccountWrites) is
// charged 1 on every generation attempt that actually reaches the
// model, not per-request regardless of outcome.
import { NextRequest, NextResponse } from 'next/server';
import {
  getAdminApp,
  getAdminDb,
  jsonError,
  verifyCaller,
  getCallerPlan,
  checkAndIncrementAccountWrites,
  writeLimitResponse,
  rateLimitOk,
  WriteLimitReachedError,
} from '@/lib/serverAuth';
import { generateFaqs } from '@/lib/generateFaqs';

export const maxDuration = 20;
export const runtime = 'nodejs';

const MAX_BODY_BYTES = 8 * 1024;
const MAX_DESCRIPTION_LEN = 600;
const MIN_COUNT = 3;
const MAX_COUNT = 10;
const DEFAULT_COUNT = 6;

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

    const { idToken, siteId, businessDescription, siteTitle, siteDescription, count } = body || {};

    if (!idToken || typeof idToken !== 'string') {
      return jsonError(401, 'Missing idToken.');
    }
    if (!siteId || typeof siteId !== 'string' || siteId.length > 100) {
      return jsonError(400, 'Missing or invalid siteId.');
    }
    const description = typeof businessDescription === 'string' ? businessDescription.trim() : '';
    if (!description) {
      return jsonError(400, 'Describe your business first so the AI has something to work from.');
    }
    if (description.length > MAX_DESCRIPTION_LEN) {
      return jsonError(400, `Description is too long (max ${MAX_DESCRIPTION_LEN} characters).`);
    }
    const resolvedCount =
      typeof count === 'number' && Number.isFinite(count) ? Math.min(MAX_COUNT, Math.max(MIN_COUNT, Math.round(count))) : DEFAULT_COUNT;

    let app;
    try {
      app = getAdminApp();
    } catch (err) {
      console.error('[generate-faq] Firebase Admin init error', err);
      return jsonError(500, 'Server is not configured yet (missing Firebase Admin credentials).');
    }

    const uid = await verifyCaller(app, idToken);
    if (!uid) {
      return jsonError(401, 'Invalid or expired session. Please sign in again.');
    }

    if (!rateLimitOk(`generate-faq:${uid}:${siteId}`, 10, 60_000)) {
      return jsonError(429, 'Too many requests. Please try again shortly.');
    }

    const db = getAdminDb();

    const siteRef = db.collection('users').doc(uid).collection('sites').doc(siteId);
    const siteSnap = await siteRef.get();
    if (!siteSnap.exists) {
      return jsonError(404, 'Site not found, or you do not have access to it.');
    }

    const planId = await getCallerPlan(db, uid);
    try {
      await checkAndIncrementAccountWrites(db, uid, planId);
    } catch (err) {
      if (err instanceof WriteLimitReachedError) {
        return writeLimitResponse(planId, err);
      }
      throw err;
    }

    const { faqs, provider } = await generateFaqs({
      businessDescription: description,
      siteTitle: typeof siteTitle === 'string' ? siteTitle.slice(0, 200) : undefined,
      siteDescription: typeof siteDescription === 'string' ? siteDescription.slice(0, 400) : undefined,
      count: resolvedCount,
    });

    if (faqs.length === 0) {
      return jsonError(502, 'Could not generate questions right now \u2014 please try again in a moment.');
    }

    return NextResponse.json({ ok: true, faqs, provider }, { status: 200, headers: { 'Cache-Control': 'no-store' } });
  } catch (err) {
    console.error('[generate-faq] handler error', err);
    return jsonError(500, 'Something went wrong generating your FAQ.');
  }
}
