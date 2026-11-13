// app/api/js-error/route.ts
//
// POST { siteId, visitorToken, message, source?, path }
//
// Called from THE BROWSER by public/sitevento.js when the page throws an
// uncaught error or an unhandled promise rejection (max 5 per page load).
// Identical errors are GROUPED into one doc with a running count —
// users/{uid}/sites/{siteId}/jsErrors/{hash} — so a bug hit by 10,000
// visitors costs one doc, not 10,000. Authenticated like every other
// visitor beacon: a signed visitorToken, never a bare id. Always answers
// 200 (a broken error reporter must never affect the page).
import { NextRequest, NextResponse } from 'next/server';
import { createHash } from 'crypto';
import { FieldValue } from 'firebase-admin/firestore';
import { getAdminDb } from '@/lib/firebaseAdmin';
import { allow } from '@/lib/rateLimit';
import { verifyVisitorToken } from '@/lib/visitorIdentity';

export const maxDuration = 10;
export const runtime = 'nodejs';

const CORS = {
  'Access-Control-Allow-Origin': '*',
  'Access-Control-Allow-Methods': 'POST, OPTIONS',
  'Access-Control-Allow-Headers': 'Content-Type',
};
const MAX_BODY = 4 * 1024;

export async function OPTIONS() {
  return new NextResponse(null, { status: 204, headers: CORS });
}

const ok = (extra: Record<string, unknown> = {}) => NextResponse.json({ ok: true, ...extra }, { status: 200, headers: CORS });

export async function POST(req: NextRequest) {
  try {
    const raw = await req.text();
    if (raw.length > MAX_BODY) return ok({ counted: false });
    let body: any = {};
    try {
      body = JSON.parse(raw);
    } catch {
      return ok({ counted: false });
    }
    const { siteId, visitorToken } = body || {};
    if (!siteId || typeof siteId !== 'string' || siteId.length > 100) return ok({ counted: false });
    const message = typeof body.message === 'string' ? body.message.trim().slice(0, 300) : '';
    if (!message) return ok({ counted: false });
    if (!verifyVisitorToken(visitorToken, siteId)) return ok({ counted: false });

    const ip = (req.headers.get('x-forwarded-for') || '').split(',')[0].trim() || 'unknown';
    if (!allow(`js-error:${siteId}:${ip}`, 30, 60_000)) return ok({ counted: false });

    const path = typeof body.path === 'string' ? body.path.split('?')[0].slice(0, 200) : '/';
    const source = typeof body.source === 'string' ? body.source.slice(0, 300) : '';
    const ua = req.headers.get('user-agent') || '';
    const browser = /edg\//i.test(ua) ? 'Edge' : /firefox\//i.test(ua) ? 'Firefox' : /chrome\//i.test(ua) ? 'Chrome' : /safari\//i.test(ua) ? 'Safari' : 'Other';

    const db = getAdminDb();
    const index = await db.collection('siteIndex').doc(siteId).get();
    const uid: string | null = index.exists ? index.data()?.uid ?? null : null;
    if (!uid) return ok({ counted: false });
    const siteRef = db.collection('users').doc(uid).collection('sites').doc(siteId);
    const site = await siteRef.get();
    if (!site.exists || site.data()?.status !== 'verified') return ok({ counted: false });

    const hash = createHash('sha1').update(`${message}|${path}`).digest('hex').slice(0, 20);
    const day = new Date().toISOString().slice(0, 10);
    await siteRef
      .collection('jsErrors')
      .doc(hash)
      .set(
        {
          message,
          path,
          source,
          browser,
          count: FieldValue.increment(1),
          [`days.${day}`]: FieldValue.increment(1),
          lastSeen: FieldValue.serverTimestamp(),
        },
        { merge: true }
      );
    return ok({ counted: true });
  } catch (err) {
    console.error('[js-error] handler error', err);
    return ok({ counted: false });
  }
}
