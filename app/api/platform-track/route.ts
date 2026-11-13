// app/api/platform-track/route.ts
//
// POST { kind: 'visit' | 'signup', visitorId?, path? }
//
// Platform-wide (not per-site) beacon — distinct from app/api/track,
// which records a visit to one of OUR CUSTOMERS' connected sites. This
// route records traffic to sitevento's OWN marketing site, so the new
// Console dashboard (app/console) can show total platform visits and
// a landing → signup conversion rate. Nothing existed to produce this
// data before; this route plus the platformVisitors collection it
// writes is the whole of it.
//
// ── Shape ────────────────────────────────────────────────────────────
// platformDaily/{YYYY-MM-DD}            one doc per UTC day:
//   { visits: number, uniqueVisitors: number, signups: number }
// platformVisitors/{visitorId}          one doc per unique marketing-
//   site visitor (first-party id, set by lib/platformTrackClient.ts in
//   localStorage — NOT the same id space as a customer site's visitor
//   tracking):
//   { firstSeenAt, lastSeenAt, visitCount, signedUp: boolean }
//
// A 'signup' beacon is fired once, right after a real account is
// created (see hooks/useAuthForms.ts), carrying the same visitorId the
// 'visit' beacons used — so a visitor doc already marked signedUp:true
// is never double-counted into platformDaily.signups, and the
// dashboard's conversion rate (signups / unique visitors) stays a
// real, deduped ratio rather than a raw event count.
//
// Same "never fail the caller's page" contract as /api/track: always
// 200, CORS wide open, every Firestore error swallowed.
import { NextRequest, NextResponse } from 'next/server';
import { getAdminDb } from '@/lib/firebaseAdmin';
import { FieldValue } from 'firebase-admin/firestore';
import { allow } from '@/lib/rateLimit';

export const maxDuration = 10;
export const runtime = 'nodejs';
export const dynamic = 'force-dynamic';

const CORS_HEADERS = {
  'Access-Control-Allow-Origin': '*',
  'Access-Control-Allow-Methods': 'POST, OPTIONS',
  'Access-Control-Allow-Headers': 'Content-Type',
  'Cache-Control': 'no-store',
};

const MAX_BODY_BYTES = 2 * 1024;
const VISITOR_ID_RE = /^pv[a-z0-9]{6,40}$/i;

function clip(v: unknown, max: number): string {
  return typeof v === 'string' && v ? v.slice(0, max) : '';
}

function todayKey(): string {
  return new Date().toISOString().slice(0, 10);
}

export async function OPTIONS() {
  return new NextResponse(null, { status: 204, headers: CORS_HEADERS });
}

export async function POST(req: NextRequest) {
  try {
    const raw = await req.text();
    if (raw.length > MAX_BODY_BYTES) {
      return NextResponse.json({ ok: false }, { status: 200, headers: CORS_HEADERS });
    }
    let body: any = {};
    try {
      body = JSON.parse(raw);
    } catch {
      return NextResponse.json({ ok: false }, { status: 200, headers: CORS_HEADERS });
    }

    const kind = body?.kind === 'signup' ? 'signup' : 'visit';
    const path = clip(body?.path, 300) || '/';
    const clientVisitorId = body?.visitorId;
    const hasValidId = typeof clientVisitorId === 'string' && VISITOR_ID_RE.test(clientVisitorId);

    const forwardedForHeader = req.headers.get('x-forwarded-for') || '';
    const callerIp = forwardedForHeader.split(',')[0].trim() || 'unknown';
    if (!allow(`platform-track:${callerIp}`, 60, 60_000)) {
      return NextResponse.json({ ok: false }, { status: 200, headers: CORS_HEADERS });
    }

    let db;
    try {
      db = getAdminDb();
    } catch (err) {
      console.error('[platform-track] Firebase Admin init error', err);
      return NextResponse.json({ ok: false }, { status: 200, headers: CORS_HEADERS });
    }

    // No usable id (first beacon before localStorage write lands,
    // storage blocked, etc.) — still bump the aggregate day counter
    // below, just skip the per-visitor dedupe doc this one time. The
    // client mints and persists a real id on the very next beacon.
    const dayRef = db.collection('platformDaily').doc(todayKey());

    if (!hasValidId) {
      if (kind === 'visit') {
        dayRef
          .set({ visits: FieldValue.increment(1) }, { merge: true })
          .catch((err) => console.error('[platform-track] day increment (no id) failed', err));
      }
      return NextResponse.json({ ok: true }, { status: 200, headers: CORS_HEADERS });
    }

    const visitorRef = db.collection('platformVisitors').doc(clientVisitorId);

    if (kind === 'signup') {
      // Idempotent: only the FIRST signup beacon for a given visitorId
      // increments platformDaily.signups and flips signedUp — a
      // duplicate beacon (retry, double-mount) must not inflate the
      // conversion rate.
      db.runTransaction(async (tx) => {
        const snap = await tx.get(visitorRef);
        const already = snap.exists && snap.data()?.signedUp === true;
        tx.set(
          visitorRef,
          {
            lastSeenAt: FieldValue.serverTimestamp(),
            signedUp: true,
            signedUpAt: snap.exists && already ? undefined : FieldValue.serverTimestamp(),
          },
          { merge: true }
        );
        if (!already) {
          tx.set(dayRef, { signups: FieldValue.increment(1) }, { merge: true });
        }
      }).catch((err) => console.error('[platform-track] signup transaction failed', err));

      return NextResponse.json({ ok: true }, { status: 200, headers: CORS_HEADERS });
    }

    // kind === 'visit'
    db.runTransaction(async (tx) => {
      const snap = await tx.get(visitorRef);
      const isNewVisitor = !snap.exists;
      tx.set(
        visitorRef,
        {
          firstSeenAt: isNewVisitor ? FieldValue.serverTimestamp() : snap.data()?.firstSeenAt,
          lastSeenAt: FieldValue.serverTimestamp(),
          visitCount: FieldValue.increment(1),
          lastPath: path,
          signedUp: snap.exists ? snap.data()?.signedUp === true : false,
        },
        { merge: true }
      );
      tx.set(
        dayRef,
        {
          visits: FieldValue.increment(1),
          ...(isNewVisitor ? { uniqueVisitors: FieldValue.increment(1) } : {}),
        },
        { merge: true }
      );
    }).catch((err) => console.error('[platform-track] visit transaction failed', err));

    return NextResponse.json({ ok: true }, { status: 200, headers: CORS_HEADERS });
  } catch (err) {
    console.error('[platform-track] UNCAUGHT handler error', err);
    return NextResponse.json({ ok: false }, { status: 200, headers: CORS_HEADERS });
  }
}
