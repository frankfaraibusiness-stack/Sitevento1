// app/api/uptime-check/route.ts
//
// Real uptime + response time for a connected site, measured from OUR
// servers (so it works with nothing installed on the customer's backend).
//
//   POST { idToken, siteId }   owner opened Analytics → probe that site now
//                              (throttled to one probe / 5 min / site)
//   GET  Authorization: Bearer <CRON_SECRET>   scheduled run → probe every
//                              verified site (see vercel.json)
//
// Each probe is one GET of the site's own URL (the url on its Firestore doc,
// never a caller-supplied one) with an 8s timeout. The result is folded into
// a per-day rollup, users/{uid}/sites/{siteId}/uptimeDays/{YYYY-MM-DD}:
// up / degraded / down counts, summed response time, and a `last` snapshot.
//   up        2xx/3xx, answered in < 3s
//   degraded  2xx/3xx but slow (>= 3s), or a 4xx
//   down      5xx, timeout or no connection
import { NextRequest, NextResponse } from 'next/server';
import { FieldValue, type Firestore } from 'firebase-admin/firestore';
import { getAdminApp, getAdminDb, jsonError, verifyCaller, rateLimitOk } from '@/lib/serverAuth';

export const maxDuration = 60;
export const runtime = 'nodejs';

const TIMEOUT_MS = 8000;
const SLOW_MS = 3000;
const THROTTLE_MS = 5 * 60_000;

async function probe(url: string): Promise<{ state: 'up' | 'degraded' | 'down'; ms: number; status: number | null }> {
  const started = Date.now();
  const controller = new AbortController();
  const timer = setTimeout(() => controller.abort(), TIMEOUT_MS);
  try {
    const res = await fetch(url, { method: 'GET', redirect: 'follow', signal: controller.signal, headers: { 'User-Agent': 'sitevento-uptime/1.0' } });
    const ms = Date.now() - started;
    if (res.status >= 500) return { state: 'down', ms, status: res.status };
    if (res.status >= 400) return { state: 'degraded', ms, status: res.status };
    return { state: ms >= SLOW_MS ? 'degraded' : 'up', ms, status: res.status };
  } catch {
    return { state: 'down', ms: Date.now() - started, status: null };
  } finally {
    clearTimeout(timer);
  }
}

async function checkSite(db: Firestore, uid: string, siteId: string, force: boolean): Promise<{ checked: boolean; state?: string }> {
  const siteRef = db.collection('users').doc(uid).collection('sites').doc(siteId);
  const snap = await siteRef.get();
  const data = snap.data();
  if (!snap.exists || !data || data.status !== 'verified' || data.paused === true || typeof data.url !== 'string' || !data.url) return { checked: false };

  const lastMs = typeof data.lastUptimeCheckAt === 'number' ? data.lastUptimeCheckAt : 0;
  if (!force && Date.now() - lastMs < THROTTLE_MS) return { checked: false };

  const url = /^https?:\/\//i.test(data.url) ? data.url : `https://${data.url}`;
  const r = await probe(url);
  const day = new Date().toISOString().slice(0, 10);
  await siteRef.collection('uptimeDays').doc(day).set(
    {
      day,
      [r.state]: FieldValue.increment(1),
      samples: FieldValue.increment(1),
      totalMs: FieldValue.increment(r.ms),
      last: { state: r.state, ms: r.ms, status: r.status, at: Date.now() },
    },
    { merge: true }
  );
  await siteRef.set({ lastUptimeCheckAt: Date.now() }, { merge: true });
  return { checked: true, state: r.state };
}

export async function POST(req: NextRequest) {
  try {
    const body = await req.json().catch(() => ({}));
    const app = getAdminApp();
    const uid = await verifyCaller(app, body?.idToken);
    if (!uid) return jsonError(401, 'Not signed in.');
    if (!body?.siteId || typeof body.siteId !== 'string') return jsonError(400, 'Missing siteId.');
    if (!rateLimitOk(`uptime:${uid}`, 30, 60_000)) return jsonError(429, 'Slow down.');
    const out = await checkSite(getAdminDb(), uid, body.siteId, false);
    return NextResponse.json({ ok: true, ...out });
  } catch (err) {
    console.error('[uptime-check] POST error', err);
    return jsonError(500, 'Internal error.');
  }
}

export async function GET(req: NextRequest) {
  const secret = process.env.CRON_SECRET;
  if (!secret || req.headers.get('authorization') !== `Bearer ${secret}`) return jsonError(401, 'Unauthorized.');
  try {
    const db = getAdminDb();
    // siteIndex/{siteId} -> { uid } is the platform's own top-level map of every
    // site, so no collection-group query (and no extra index) is needed.
    const index = await db.collection('siteIndex').limit(500).get();
    const pairs = index.docs
      .map((d) => ({ siteId: d.id, uid: d.data()?.uid as string | undefined }))
      .filter((p): p is { siteId: string; uid: string } => typeof p.uid === 'string');
    let checked = 0;
    // Small batches so one slow site can't hold up the rest.
    for (let i = 0; i < pairs.length; i += 10) {
      const results = await Promise.all(pairs.slice(i, i + 10).map((p) => checkSite(db, p.uid, p.siteId, true).catch(() => ({ checked: false }))));
      checked += results.filter((r) => r.checked).length;
    }
    return NextResponse.json({ ok: true, checked });
  } catch (err) {
    console.error('[uptime-check] GET error', err);
    return jsonError(500, 'Internal error.');
  }
}
