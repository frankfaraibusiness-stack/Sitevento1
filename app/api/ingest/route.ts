// app/api/ingest/route.ts
//
// POST, Authorization: Bearer sv_live_... (or sv_test_...)
//
// The server-side data endpoint: lets a site's own BACKEND send what the
// embedded script can never see — subscriptions and plan prices, orders and
// product prices, refunds, expenses, ad spend, sign-ups, logins, goals,
// server errors and metrics. Unlike every browser beacon in app/api/*, the
// caller here is the owner's own server, so auth is the account-level key
// itself (lib/apiKeys.ts) and a bad key is a real 401.
//
// ── Typed events, per-site permissions ───────────────────────────────
// The catalog in lib/apiPermissions.ts lists every event type a backend may
// send. For each connected site the owner switches permissions on in
// /dashboard/api (stored as `apiPermissions` on the site doc); an event
// whose permission is off is refused with 403 `event_not_permitted`.
// Traffic numbers — visits, page views, clicks, visitors, geography,
// devices, bot blocks — are RESERVED: they come only from the sitevento
// script in a real browser, and any attempt to write one here is refused
// with 403 `reserved_event` whatever the key or permissions, so the numbers
// on the Analytics page cannot be inflated from the outside.
//
// Order of checks: key → rate limit → JSON → site → reserved → known event →
// permission → field validation (lib/apiEvents.ts) → duplicate → billing →
// write. Nothing is billed or stored for a refused event.
//
// ── Billing ───────────────────────────────────────────────────────────
// One ACCEPTED event = one visit of the account's monthly allowance (same
// meter every pageview uses). Duplicates and refused events cost nothing.
// A sv_test_ key is billed the same (so it can't bypass the cap) but every
// write is tagged `test: true` and kept out of real analytics.
//
// Every outcome after the site is known is also tallied per hour in
// users/{uid}/sites/{siteId}/apiStats/{YYYYMMDDHH}, which powers the "API
// health" section on the Analytics page.
import { NextRequest, NextResponse } from 'next/server';
import { FieldValue, Timestamp, type Firestore } from 'firebase-admin/firestore';
import { getAdminDb } from '@/lib/firebaseAdmin';
import { allow } from '@/lib/rateLimit';
import { resolveApiKey } from '@/lib/apiKeys';
import { getCallerPlan, checkAndIncrementAccountVisits, VisitLimitReachedError, visitLimitResponse, jsonError } from '@/lib/serverAuth';
import { permissionForEvent } from '@/lib/apiPermissions';
import { isReservedEvent, validateApiEvent, type Json } from '@/lib/apiEvents';

export const maxDuration = 10;
export const runtime = 'nodejs';

const MAX_BODY_BYTES = 64 * 1024;
const MAX_EVENT_LEN = 200;
const MAX_ID_LEN = 200;

export async function OPTIONS() {
  // No CORS on purpose — a secret key belongs on a server, never in page JS.
  return new NextResponse(null, { status: 204 });
}

function hourKey(d = new Date()): string {
  return d.toISOString().slice(0, 13).replace(/[-T]/g, '');
}

/** Tallies one outcome for the API-health section. Never throws, never blocks the response. */
async function bump(db: Firestore, uid: string, siteId: string, field: string, ms: number) {
  try {
    const ref = db.collection('users').doc(uid).collection('sites').doc(siteId).collection('apiStats').doc(hourKey());
    await ref.set(
      {
        hour: Timestamp.fromDate(new Date(new Date().setMinutes(0, 0, 0))),
        [field]: FieldValue.increment(1),
        total: FieldValue.increment(1),
        totalMs: FieldValue.increment(Math.max(0, Math.round(ms))),
      },
      { merge: true }
    );
  } catch (err) {
    console.error('[ingest] stats write failed', err);
  }
}

export async function POST(req: NextRequest) {
  const started = Date.now();
  try {
    const contentLength = Number(req.headers.get('content-length') || 0);
    if (contentLength > MAX_BODY_BYTES) return jsonError(413, 'Payload too large (64KB max).', { code: 'payload_too_large' });
    const raw = await req.text();
    if (raw.length > MAX_BODY_BYTES) return jsonError(413, 'Payload too large (64KB max).', { code: 'payload_too_large' });

    const authHeader = req.headers.get('authorization') || '';
    const bearerMatch = authHeader.match(/^Bearer\s+(.+)$/i);
    const apiKey = bearerMatch ? bearerMatch[1].trim() : null;
    if (!apiKey) return jsonError(401, 'Missing Authorization: Bearer <api key> header.', { code: 'missing_key' });

    let db: Firestore;
    try {
      db = getAdminDb();
    } catch (err) {
      console.error('[ingest] Firebase Admin init error', err);
      return jsonError(503, 'Server not configured.');
    }

    const resolved = await resolveApiKey(db, apiKey);
    if (!resolved) return jsonError(401, 'Invalid or revoked API key.', { code: 'invalid_key' });
    const { uid, kind } = resolved;

    if (!allow(`ingest:${uid}`, 600, 60_000)) return jsonError(429, 'Rate limit exceeded for this API key.', { code: 'rate_limited' });

    let body: Json = {};
    try {
      body = raw ? JSON.parse(raw) : {};
    } catch {
      return jsonError(400, 'Invalid JSON body.', { code: 'invalid_json' });
    }
    if (!body || typeof body !== 'object' || Array.isArray(body)) return jsonError(400, 'Body must be a JSON object.', { code: 'invalid_body' });

    const event = typeof body.event === 'string' ? body.event.trim().slice(0, MAX_EVENT_LEN) : '';
    if (!event) return jsonError(400, 'Missing "event" — e.g. "order.completed".', { code: 'missing_event' });

    // Fields can sit flat in the body or under `data`.
    const nested = body.data && typeof body.data === 'object' && !Array.isArray(body.data) ? (body.data as Json) : {};
    const fields: Json = { ...body, ...nested };

    // ── Which site? ────────────────────────────────────────────────
    const sitesCol = db.collection('users').doc(uid).collection('sites');
    let siteId = typeof body.siteId === 'string' ? body.siteId.slice(0, MAX_ID_LEN) : '';
    let siteData: FirebaseFirestore.DocumentData | undefined;
    if (siteId) {
      const snap = await sitesCol.doc(siteId).get();
      if (!snap.exists) return jsonError(400, 'Unknown siteId for this account.', { code: 'unknown_site' });
      siteData = snap.data();
    } else {
      const two = await sitesCol.limit(2).get();
      if (two.empty) return jsonError(400, 'Connect a startup first — this account has no sites.', { code: 'unknown_site' });
      if (two.size > 1) return jsonError(400, 'Several startups are connected — add "siteId" to say which one this event is for.', { code: 'site_required' });
      siteId = two.docs[0].id;
      siteData = two.docs[0].data();
    }

    // ── Reserved: traffic can never be written ─────────────────────
    if (isReservedEvent(event)) {
      void bump(db, uid, siteId, 'rej_reserved', Date.now() - started);
      return jsonError(
        403,
        `"${event}" is a traffic metric. Visits, clicks and visitors are measured only by the sitevento script in real browsers and can't be sent through the API.`,
        { code: 'reserved_event' }
      );
    }

    const perm = permissionForEvent(event);
    if (!perm) {
      void bump(db, uid, siteId, 'rej_invalid', Date.now() - started);
      return jsonError(400, `Unknown event "${event}". See /dashboard/api for the events you can send.`, { code: 'unknown_event' });
    }

    // ── Permission for this site ───────────────────────────────────
    const allowed: string[] = Array.isArray(siteData?.apiPermissions) ? siteData!.apiPermissions : [];
    if (!allowed.includes(perm.id)) {
      void bump(db, uid, siteId, 'rej_permission', Date.now() - started);
      return jsonError(403, `"${perm.label}" is switched off for this startup. Turn it on at /dashboard/api to accept ${event}.`, {
        code: 'event_not_permitted',
        permission: perm.id,
      });
    }

    // ── Field validation ───────────────────────────────────────────
    const checked = validateApiEvent(event, fields);
    if (!checked.ok) {
      void bump(db, uid, siteId, 'rej_invalid', Date.now() - started);
      return jsonError(400, checked.error, { code: 'invalid_event', field: checked.field ?? null });
    }
    const ev = checked.value;

    const eventsCol = db.collection('users').doc(uid).collection('apiEvents');
    const eventRef = ev.dedupeId ? eventsCol.doc(ev.dedupeId) : ev.upsertId ? eventsCol.doc(ev.upsertId) : eventsCol.doc();

    // Same id again → ignored: not billed, not double counted.
    if (ev.dedupeId) {
      const existing = await eventRef.get();
      if (existing.exists) {
        void bump(db, uid, siteId, 'duplicate', Date.now() - started);
        return NextResponse.json({ ok: true, duplicate: true, id: eventRef.id, test: kind === 'test' }, { status: 200 });
      }
    }

    // ── Billing: one accepted event = one visit of allowance ───────
    const planId = await getCallerPlan(db, uid);
    let usage;
    try {
      usage = await checkAndIncrementAccountVisits(db, uid, planId, 1);
    } catch (err) {
      if (err instanceof VisitLimitReachedError) return visitLimitResponse(planId, err);
      throw err;
    }

    await eventRef.set({
      event: ev.event,
      type: ev.type,
      siteId,
      userId: ev.userId,
      visitorId: ev.visitorId,
      data: ev.data,
      test: kind === 'test',
      occurredAt: Timestamp.fromDate(ev.occurredAt),
      receivedAt: FieldValue.serverTimestamp(),
    });

    if (ev.catalog) {
      await sitesCol
        .doc(siteId)
        .collection('apiCatalog')
        .doc(`${ev.catalog.kind}_${ev.catalog.id}`)
        .set({ kind: ev.catalog.kind, ...ev.data, test: kind === 'test', updatedAt: FieldValue.serverTimestamp() });
    }

    void bump(db, uid, siteId, kind === 'test' ? 'accepted_test' : 'accepted', Date.now() - started);

    return NextResponse.json(
      { ok: true, id: eventRef.id, event: ev.event, test: kind === 'test', usage: { used: usage.used, limit: usage.limit } },
      { status: 200 }
    );
  } catch (err) {
    console.error('[ingest] handler error', err);
    return jsonError(500, 'Internal error.', { code: 'internal' });
  }
}
