// app/api/feedback-survey/route.ts
//
// POST { siteId, type: 'nps'|'csat'|'exit', score?, rating?, chip?,
//        reason?, pageUrl?, visitorId? }
//
// Backs the Feedback & Satisfaction Survey widget
// (app/w/[widgetId]/widgets/FeedbackSurveyWidget.tsx) — NPS score +
// reason, CSAT star rating, or a short exit-intent chip pick,
// depending on `type`. Intentionally a SEPARATE route and collection
// from /api/feedback (which backs the simpler, unrelated
// FeedbackWidget's plain free-text message) rather than overloading
// that one — the two widgets have different shapes and different
// catalog ids, and conflating them would make either dashboard view
// of the data misleading.
//
// Writes into users/{uid}/sites/{siteId}/feedbackResponses (NOT the
// `leads` collection — a survey response isn't a sales lead), gated
// by assertWidgetWriteAllowed like the other real submission routes
// here. Same CORS-open/always-200/siteIndex-resolved contract as the
// rest of this app's widget-facing routes.

import { NextRequest, NextResponse } from 'next/server';
import { getAdminDb } from '@/lib/firebaseAdmin';
import { FieldValue } from 'firebase-admin/firestore';
import { allow } from '@/lib/rateLimit';
import { assertWidgetWriteAllowed, pausedWidgetResponse, WidgetWriteBlockedError } from '@/lib/serverAuth';

export const maxDuration = 10;
export const runtime = 'nodejs';

const CORS_HEADERS = {
  'Access-Control-Allow-Origin': '*',
  'Access-Control-Allow-Methods': 'POST, OPTIONS',
  'Access-Control-Allow-Headers': 'Content-Type',
};

const VALID_TYPES = ['nps', 'csat', 'exit'];
const MAX_REASON_LEN = 1000;

function fail(reason: string) {
  return NextResponse.json({ ok: false, reason }, { status: 200, headers: CORS_HEADERS });
}

export async function OPTIONS() {
  return new NextResponse(null, { status: 204, headers: CORS_HEADERS });
}

export async function POST(req: NextRequest) {
  try {
    const body = await req.json().catch(() => ({}));
    const { siteId, type, score, rating, chip, reason, pageUrl, visitorId } = body || {};

    if (!siteId || typeof siteId !== 'string') return fail('missing siteId');
    if (!VALID_TYPES.includes(type)) return fail('invalid type');

    if (type === 'nps' && (typeof score !== 'number' || score < 0 || score > 10)) return fail('invalid score');
    if (type === 'csat' && (typeof rating !== 'number' || rating < 1 || rating > 5)) return fail('invalid rating');
    if (type === 'exit' && typeof chip !== 'string') return fail('invalid chip');

    const forwardedFor = req.headers.get('x-forwarded-for') || '';
    const ip = forwardedFor.split(',')[0].trim() || 'unknown';
    if (!allow(`feedback-survey:${siteId}:${ip}`, 10, 60_000)) return fail('rate limited');

    let db;
    try {
      db = getAdminDb();
    } catch (err) {
      console.error('[feedback-survey] Firebase Admin init error', err);
      return fail('server error');
    }

    let resolved;
    try {
      resolved = await assertWidgetWriteAllowed(db, siteId);
    } catch (err) {
      if (err instanceof WidgetWriteBlockedError) return pausedWidgetResponse(CORS_HEADERS);
      throw err;
    }
    if (!resolved) return fail('unknown site');
    const { uid } = resolved;

    const siteRef = db.collection('users').doc(uid).collection('sites').doc(siteId);
    const siteSnap = await siteRef.get();
    if (!siteSnap.exists) return fail('unknown site');

    await siteRef.collection('feedbackResponses').add({
      type,
      score: type === 'nps' ? score : null,
      rating: type === 'csat' ? rating : null,
      chip: type === 'exit' ? String(chip).slice(0, 100) : null,
      reason: typeof reason === 'string' ? reason.trim().slice(0, MAX_REASON_LEN) : '',
      pageUrl: typeof pageUrl === 'string' ? pageUrl.slice(0, 2000) : '',
      visitorId: typeof visitorId === 'string' ? visitorId.slice(0, 200) : '',
      ts: FieldValue.serverTimestamp(),
    });

    return NextResponse.json({ ok: true }, { status: 200, headers: CORS_HEADERS });
  } catch (err) {
    console.error('[feedback-survey] handler error', err);
    return fail('server error');
  }
}
