// app/api/session/route.ts
//
// Server-side session, backed by a Firebase Admin SDK "session cookie"
// instead of the client SDK's own IndexedDB-based persistence.
//
// ── Why this exists ─────────────────────────────────────────────────
// Every page in this app previously decided "is this visitor signed
// in?" purely on the client: hooks/useAuth.ts subscribed to Firebase's
// client SDK (onAuthStateChanged) and read the session back out of
// IndexedDB (browserLocalPersistence) on every page load. That restore
// is asynchronous and, on some browsers/profiles (Safari ITP, private
// tabs, some in-app/mobile webviews, or just a slow first paint),
// unreliable — so a page like /widgets could render, decide the
// restore "finished" with no user yet found, and show the sign-in
// overlay even though the visitor really was signed in. Navigating
// away and back repeats the race, which is what read as "logs me out
// on every visit".
//
// A cookie doesn't have this race: it's sent by the browser on the
// very first request, before any client JS runs, so the server can
// decide "signed in or not" synchronously and the client can hydrate
// from that instead of waiting on IndexedDB.
//
// ── Why a session cookie and not just the ID token ─────────────────
// A Firebase ID token is short-lived (~1h) and isn't meant to be
// stored long-term. The Admin SDK's createSessionCookie() exchanges a
// fresh ID token for a longer-lived, revocable cookie value designed
// exactly for this (see Firebase's "Manage Session Cookies" docs). The
// client still authenticates with the normal client SDK (email link,
// Google popup, custom token) — this route only runs *after* that,
// to mint the server-side artifact from the resulting ID token.
//
// ── Endpoints ────────────────────────────────────────────────────────
// POST   { idToken }  → verifies it, mints a session cookie, sets it
//                        HttpOnly/Secure/SameSite=Lax, returns { ok, uid }.
// GET    (no body)     → verifies the cookie already on the request,
//                        returns { ok, uid, email } or { ok: false }.
// DELETE (no body)     → revokes the session server-side and clears
//                        the cookie.
import { NextRequest, NextResponse } from 'next/server';
import { getAuth } from 'firebase-admin/auth';
import { getAdminApp, jsonError } from '@/lib/serverAuth';

export const runtime = 'nodejs';
export const maxDuration = 10;

const SESSION_COOKIE_NAME = '__session';
// Firebase caps session cookies at 14 days; mirrored here as the
// cookie's own Max-Age so the browser never hangs on to it longer
// than the Admin SDK will still consider it valid.
const SESSION_MAX_AGE_MS = 14 * 24 * 60 * 60 * 1000;

function cookieOptions(maxAgeMs: number) {
  return {
    name: SESSION_COOKIE_NAME,
    httpOnly: true,
    secure: process.env.NODE_ENV === 'production',
    sameSite: 'lax' as const,
    path: '/',
    maxAge: Math.floor(maxAgeMs / 1000),
  };
}

export async function POST(req: NextRequest) {
  try {
    const raw = await req.text();
    let body: any;
    try {
      body = raw ? JSON.parse(raw) : {};
    } catch {
      return jsonError(400, 'Malformed JSON body.');
    }

    const idToken = body?.idToken;
    if (!idToken || typeof idToken !== 'string') {
      return jsonError(400, 'Missing idToken.');
    }

    let app;
    try {
      app = getAdminApp();
    } catch (err) {
      console.error('[session][POST] Firebase Admin init error', err);
      return jsonError(500, 'Server is not configured yet (missing Firebase Admin credentials).');
    }

    const auth = getAuth(app);

    // Reject stale tokens up front — createSessionCookie will also
    // fail for these, but this gives a clearer error path.
    let decoded;
    try {
      decoded = await auth.verifyIdToken(idToken);
    } catch (err) {
      console.error('[session][POST] verifyIdToken error', err);
      return jsonError(401, 'Your sign-in could not be verified. Please sign in again.');
    }

    let sessionCookie: string;
    try {
      sessionCookie = await auth.createSessionCookie(idToken, { expiresIn: SESSION_MAX_AGE_MS });
    } catch (err) {
      console.error('[session][POST] createSessionCookie error', err);
      return jsonError(500, 'Could not start your session. Please try again.');
    }

    const res = NextResponse.json(
      { ok: true, uid: decoded.uid },
      { status: 200, headers: { 'Cache-Control': 'no-store' } }
    );
    res.cookies.set(cookieOptions(SESSION_MAX_AGE_MS).name, sessionCookie, cookieOptions(SESSION_MAX_AGE_MS));
    return res;
  } catch (err) {
    console.error('[session][POST] handler error', err);
    return jsonError(500, 'Could not start your session. Please try again.');
  }
}

export async function GET(req: NextRequest) {
  try {
    const cookie = req.cookies.get(SESSION_COOKIE_NAME)?.value;
    if (!cookie) {
      return NextResponse.json({ ok: false }, { status: 200, headers: { 'Cache-Control': 'no-store' } });
    }

    let app;
    try {
      app = getAdminApp();
    } catch (err) {
      console.error('[session][GET] Firebase Admin init error', err);
      return NextResponse.json({ ok: false }, { status: 200, headers: { 'Cache-Control': 'no-store' } });
    }

    const auth = getAuth(app);
    try {
      // checkRevoked: true so a password change / explicit sign-out-
      // everywhere / revokeRefreshTokens call takes effect immediately
      // instead of waiting out the cookie's full lifetime.
      const decoded = await auth.verifySessionCookie(cookie, true);
      return NextResponse.json(
        { ok: true, uid: decoded.uid, email: decoded.email ?? null },
        { status: 200, headers: { 'Cache-Control': 'no-store' } }
      );
    } catch (err) {
      // Expired/invalid/revoked — not a server error, just "not
      // signed in". Clear the dead cookie so the browser stops
      // sending it.
      const res = NextResponse.json({ ok: false }, { status: 200, headers: { 'Cache-Control': 'no-store' } });
      res.cookies.delete(SESSION_COOKIE_NAME);
      return res;
    }
  } catch (err) {
    console.error('[session][GET] handler error', err);
    return NextResponse.json({ ok: false }, { status: 200, headers: { 'Cache-Control': 'no-store' } });
  }
}

export async function DELETE(req: NextRequest) {
  try {
    const cookie = req.cookies.get(SESSION_COOKIE_NAME)?.value;
    if (cookie) {
      try {
        const app = getAdminApp();
        const auth = getAuth(app);
        const decoded = await auth.verifySessionCookie(cookie).catch(() => null);
        if (decoded) {
          // Revoke so the cookie can't be replayed even if a copy of
          // it leaked somewhere before the browser drops it.
          await auth.revokeRefreshTokens(decoded.uid).catch(() => {});
        }
      } catch (err) {
        console.error('[session][DELETE] revoke error', err);
        // Non-fatal — still clear the cookie below.
      }
    }

    const res = NextResponse.json({ ok: true }, { status: 200, headers: { 'Cache-Control': 'no-store' } });
    res.cookies.delete(SESSION_COOKIE_NAME);
    return res;
  } catch (err) {
    console.error('[session][DELETE] handler error', err);
    const res = NextResponse.json({ ok: true }, { status: 200, headers: { 'Cache-Control': 'no-store' } });
    res.cookies.delete(SESSION_COOKIE_NAME);
    return res;
  }
}
