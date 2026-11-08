// app/api/email-capture/route.ts
//
// POST { siteId, email, visitorToken, visitorId, pageUrl }
//
// Backs the Email Capture widget (app/w/[widgetId]/widgets/
// EmailCaptureWidget.tsx) — the time-driven signup popup. Mirrors
// app/api/overlay-notify/route.ts exactly: resolve siteId -> owning
// site via the Admin SDK (never the client SDK, so no Firestore rule
// needs to open up writes to anonymous visitors), then write into the
// site's existing `leads` subcollection so captured addresses show up
// in the dashboard's LeadsPanel alongside every other lead source,
// tagged with source: 'email-capture' to distinguish them. Carries no
// usage charge of its own under the visit model — the visit was
// already counted by the pageview beacon (/api/track) that preceded
// it; this route's cost is absorbed into that one visit.
//
// Duplicate check: before writing, queries this site's `leads` for an
// existing doc with the same (lowercased) email. If found, responds
// { ok: false, reason: 'duplicate' } instead of writing a second lead
// — the widget reads that reason specifically to show "You're already
// subscribed" rather than its generic error copy. Scoped to this one
// site's leads subcollection, not global across all of sitevento, so
// the same address can sign up on two different sites independently.
//
// ── visitorToken: marks THIS VISITOR as "never show the popup again" ──
// On any resolved submission — a fresh lead OR a duplicate email that
// was already captured — also stamps
// visitorProfiles/{visitorId}.emailCaptureSubmittedAt (see
// lib/types.ts's VisitorProfile) — read back on every later
// /api/track response (that route's own emailCapture field) so the
// "never show again once submitted" rule is enforced from server data
// EmailCaptureWidget.tsx trusts, not just a localStorage flag that a
// storage clear or a different browser would silently forget. This
// requires a verified visitorToken (lib/visitorIdentity.ts) rather
// than a bare visitorId — a forged id here could otherwise mark a
// DIFFERENT real visitor's profile as "already submitted", silently
// suppressing a popup they never actually saw. A missing/invalid
// token doesn't block the actual lead write (the owner still gets the
// email either way — that's the part that actually matters to them);
// it just means this visitor's profile isn't stamped, so the popup
// may show again on their next qualifying visit. That is the same
// "degrade gracefully, never fail the visitor-facing action" posture
// every other best-effort step in this codebase already follows.
//
// Same CORS-open, always-200 contract as the other visitor-facing
// routes (/api/track, /api/overlay-track, /api/overlay-notify) — a
// widget embedded on a third-party page must never surface a raw error
// or throw into the host page.
//
// Also writes conversion attribution (visitorId/device/path) onto the
// lead doc via lib/leadAttribution.ts, shared with
// app/api/overlay-notify and app/api/appointment-booking — see that
// file's header. Best-effort and independent of the visitorToken
// stamping above: a missing/invalid rawVisitorId just leaves
// attribution null, it never blocks the lead write.

import { NextRequest, NextResponse } from 'next/server';
import { getAdminDb } from '@/lib/firebaseAdmin';
import { FieldValue } from 'firebase-admin/firestore';
import { allow } from '@/lib/rateLimit';
import { checkFormFlood } from '@/lib/formFloodGuard';
import { verifyVisitorToken } from '@/lib/visitorIdentity';
import { resolveLeadAttribution } from '@/lib/leadAttribution';

export const maxDuration = 10;
export const runtime = 'nodejs';

const CORS_HEADERS = {
  'Access-Control-Allow-Origin': '*',
  'Access-Control-Allow-Methods': 'POST, OPTIONS',
  'Access-Control-Allow-Headers': 'Content-Type',
};

const EMAIL_RE = /^[^\s@]+@[^\s@]+\.[^\s@]+$/;

export async function OPTIONS() {
  return new NextResponse(null, { status: 204, headers: CORS_HEADERS });
}

export async function POST(req: NextRequest) {
  try {
    const body = await req.json().catch(() => ({}));
    const { siteId, email, visitorToken, visitorId: rawVisitorId, pageUrl } = body || {};

    if (!siteId || typeof siteId !== 'string') {
      return NextResponse.json({ ok: false, reason: 'missing siteId' }, { status: 200, headers: CORS_HEADERS });
    }
    // Lowercased for both the uniqueness check and storage — so
    // Visitor@Example.com and visitor@example.com are the same lead,
    // not two. The EMAIL_RE shape check runs on the same lowercased
    // value for simplicity; case never affects whether it's valid.
    const trimmed = typeof email === 'string' ? email.trim().slice(0, 200).toLowerCase() : '';
    if (!EMAIL_RE.test(trimmed)) {
      return NextResponse.json({ ok: false, reason: 'invalid email' }, { status: 200, headers: CORS_HEADERS });
    }

    const forwardedFor = req.headers.get('x-forwarded-for') || '';
    const ip = forwardedFor.split(',')[0].trim() || 'unknown';
    if (!allow(`email-capture:${siteId}:${ip}`, 10, 60_000)) {
      return NextResponse.json({ ok: false, reason: 'rate limited' }, { status: 200, headers: CORS_HEADERS });
    }

    let db;
    try {
      db = getAdminDb();
    } catch (err) {
      console.error('[email-capture] Firebase Admin init error', err);
      return NextResponse.json({ ok: false }, { status: 200, headers: CORS_HEADERS });
    }

    // Under the visit model, the visit was already charged by the
    // pageview beacon (/api/track) that preceded it — this route, like
    // every other visitor-facing action that isn't the pageview
    // itself, carries no usage charge of its own; it just needs uid
    // resolution.
    const indexSnap = await db.collection('siteIndex').doc(siteId).get();
    const uid: string | null = indexSnap.exists ? indexSnap.data()?.uid ?? null : null;
    if (!uid) {
      return NextResponse.json({ ok: false, reason: 'unknown site' }, { status: 200, headers: CORS_HEADERS });
    }

    const siteRef = db.collection('users').doc(uid).collection('sites').doc(siteId);
    const siteSnap = await siteRef.get();
    if (!siteSnap.exists) {
      return NextResponse.json({ ok: false, reason: 'unknown site' }, { status: 200, headers: CORS_HEADERS });
    }

    // Bot Shield, Widget 2: Form Flood Guard — catches a script
    // hammering this endpoint (same IP, many submissions, far faster
    // than a human fills a form) and auto-blocks before the write.
    // See lib/formFloodGuard.ts's header for the full reasoning.
    const floodCheck = await checkFormFlood({ db, siteRef, ip });
    if (floodCheck.blocked) {
      return NextResponse.json({ ok: false, reason: 'blocked' }, { status: 200, headers: CORS_HEADERS });
    }

    // Best-effort, fire-and-forget — same treatment as /api/track's
    // own visitorProfiles upsert: must never slow down or fail the
    // response this visitor is waiting on just because this follow-up
    // stamp didn't land. See this file's header for why a missing/
    // invalid token simply skips this step rather than rejecting the
    // submission. Resolved once, outside the duplicate/success branch
    // below, because BOTH outcomes are "this visitor is done being
    // asked" from their own point of view — EmailCaptureWidget.tsx's
    // own markDismissed() already treats success and duplicate
    // identically for exactly that reason (see its handleSubmit).
    const verified = verifyVisitorToken(visitorToken, siteId);
    function stampSubmitted(): void {
      if (!verified) return;
      siteRef
        .collection('visitorProfiles')
        .doc(verified.visitorId)
        .set({ emailCaptureSubmittedAt: Date.now() }, { merge: true })
        .catch((err) => console.error('[email-capture] emailCaptureSubmittedAt stamp FAILED for', siteRef.path, verified.visitorId, err));
    }

    // Already subscribed on this site? Don't write a second lead —
    // tell the widget so it can show "You're already subscribed"
    // instead of treating this as a fresh signup. Still stamps this
    // visitor's profile: they provided a real, already-captured
    // email, so there's no reason to keep showing them the popup.
    const existing = await siteRef.collection('leads').where('email', '==', trimmed).limit(1).get();
    if (!existing.empty) {
      stampSubmitted();
      return NextResponse.json({ ok: false, reason: 'duplicate' }, { status: 200, headers: CORS_HEADERS });
    }

    // Best-effort device attribution — see lib/leadAttribution.ts's
    // header for why this is a read against the visitor's EXISTING
    // profile doc rather than a second UA parse. Never blocks or
    // delays the write below on failure; a lookup miss just leaves
    // visitorId/device as null on this lead, same as it is today.
    const attribution = await resolveLeadAttribution(db, siteRef, rawVisitorId);

    await siteRef.collection('leads').add({
      email: trimmed,
      source: 'email-capture',
      ts: FieldValue.serverTimestamp(),
      visitorId: attribution.visitorId,
      device: attribution.device,
      path: typeof pageUrl === 'string' ? pageUrl.slice(0, 300) : null,
    });

    stampSubmitted();

    return NextResponse.json({ ok: true }, { status: 200, headers: CORS_HEADERS });
  } catch (err) {
    console.error('[email-capture] handler error', err);
    return NextResponse.json({ ok: false }, { status: 200, headers: CORS_HEADERS });
  }
}
