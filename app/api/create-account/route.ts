// app/api/create-account/route.ts
//
// POST { name, email, password }
//
// Creates the Firebase Auth user AND the users/{uid} profile doc
// entirely server-side via the Admin SDK, replacing
// hooks/useAuthForms.ts's old signUp(), which called the client SDK's
// createUserWithEmailAndPassword() directly from the browser.
//
// ── Why this moved server-side ────────────────────────────────────────
// Account creation is itself a write — the first one an account ever
// makes — and the point of this whole change is that no write should
// be reachable outside the server's own accounting. A client-side
// createUserWithEmailAndPassword() call succeeds or fails entirely
// inside Firebase's own client SDK, with no hook for this app's server
// to see it happen, log it, rate-limit it per IP, or (looking ahead)
// fold it into the same daily-write accounting every other action in
// app/api/user-action/route.ts goes through. Moving creation here
// means EVERY account-affecting write in the app, from the very first
// one, passes through code this app controls.
//
// ── No idToken to verify (there's no session yet) ────────────────────
// Every other Admin-SDK route in this app verifies an idToken to
// recover an unforgeable uid before writing anything. That is not
// possible here — creating the account IS how a uid comes to exist.
// So this route's trust boundary is different in kind: it is a public,
// unauthenticated endpoint (like /api/contact or /api/feedback), and
// its only defenses against abuse are strict input validation and a
// strict rate limit keyed on IP. It does not need the account-wide
// daily write-limit check from lib/serverAuth.ts either — that limit
// is scoped to users/{uid}/usage/{day}, which cannot exist before a
// uid does; Firebase Auth's own account-creation safeguards (and the
// IP rate limit below) are what stand in for it on this one route.
//
// ── Handing the client a session afterward ────────────────────────────
// A server-created Auth user has no client-side session by itself —
// the client never called a client-SDK sign-in method. The standard
// fix: this route mints a short-lived Admin-SDK custom token
// (createCustomToken(uid)), and the client calls the client SDK's
// signInWithCustomToken(auth, customToken) once with it (see
// hooks/useAuthForms.ts's updated signUp()). That one client call is
// not a write — it only exchanges the token for a session — so it does
// not reintroduce a client-side write path.
//
// ── Google sign-in is unaffected ─────────────────────────────────────
// signInWithPopup (Google OAuth) stays entirely client-side — a popup
// flow run against Google's own servers is not something a server
// route can perform on a user's behalf, and it was never a Firestore
// write in the first place (the users/{uid} doc for a Google signup
// is created lazily the first time any user-action write runs, same
// as any other first-time write).
import { NextRequest, NextResponse } from 'next/server';
import { getAuth } from 'firebase-admin/auth';
import { getAdminApp, getAdminDb, jsonError, rateLimitOk } from '@/lib/serverAuth';

export const maxDuration = 10;
export const runtime = 'nodejs';

const MAX_BODY_BYTES = 4 * 1024;
const MAX_NAME_LEN = 200;
const MAX_EMAIL_LEN = 320;
const MIN_PASSWORD_LEN = 6; // mirrors Firebase Auth's own minimum
const MAX_PASSWORD_LEN = 4096; // generous upper bound, just to reject absurd payloads before they reach Firebase

function isValidEmail(email: string): boolean {
  // Deliberately simple — real validation is Firebase Auth's job
  // (createUser rejects a malformed email with auth/invalid-email,
  // mapped below); this is just a cheap pre-filter.
  return /^[^\s@]+@[^\s@]+\.[^\s@]+$/.test(email) && email.length <= MAX_EMAIL_LEN;
}

// Admin SDK error codes differ from the client SDK's (lib/authErrors.ts
// covers the client ones) — e.g. 'auth/email-already-exists' here vs.
// 'auth/email-already-in-use' there. Kept as a small local map rather
// than extending the client file, since that file is 'use client' and
// imports firebase/app's FirebaseError type, which has no place in a
// server bundle.
const ADMIN_ERROR_MESSAGES: Record<string, string> = {
  'auth/email-already-exists': 'An account with this email already exists.',
  'auth/invalid-email': "That email address doesn't look right.",
  'auth/invalid-password': 'Password should be at least 6 characters.',
  'auth/weak-password': 'Password should be at least 6 characters.',
};

function friendlyAdminError(err: unknown): string {
  const code = (err as { code?: string })?.code || '';
  return ADMIN_ERROR_MESSAGES[code] || 'Could not create your account. Please try again.';
}

export async function POST(req: NextRequest) {
  try {
    const contentLength = Number(req.headers.get('content-length') || 0);
    if (contentLength > MAX_BODY_BYTES) return jsonError(400, 'Request body too large.');
    const raw = await req.text();
    if (raw.length > MAX_BODY_BYTES) return jsonError(400, 'Request body too large.');

    let body: any;
    try {
      body = JSON.parse(raw);
    } catch {
      return jsonError(400, 'Malformed JSON body.');
    }

    const { name, email, password } = body || {};

    if (typeof name !== 'string' || !name.trim() || name.length > MAX_NAME_LEN) {
      return jsonError(400, 'Please enter your name.');
    }
    if (typeof email !== 'string' || !isValidEmail(email)) {
      return jsonError(400, "That email address doesn't look right.");
    }
    if (typeof password !== 'string' || password.length < MIN_PASSWORD_LEN || password.length > MAX_PASSWORD_LEN) {
      return jsonError(400, 'Password should be at least 6 characters.');
    }

    // IP-keyed rate limit — this endpoint is unauthenticated by
    // necessity (see header comment), so it's the one write-ish route
    // in the app that can't key a limit on uid. Deliberately strict:
    // signup is not a high-frequency legitimate action for any single
    // visitor.
    const forwardedFor = req.headers.get('x-forwarded-for') || '';
    const ip = forwardedFor.split(',')[0].trim() || 'unknown';
    if (!rateLimitOk(`create-account:${ip}`, 5, 60_000)) {
      return jsonError(429, 'Too many attempts. Please wait and try again.');
    }

    let app;
    try {
      app = getAdminApp();
    } catch (err) {
      console.error('[create-account] Firebase Admin init error', err);
      return jsonError(500, 'Server is not configured yet (missing Firebase Admin credentials).');
    }

    const auth = getAuth(app);
    const trimmedName = name.trim();

    let uid: string;
    try {
      const userRecord = await auth.createUser({
        email,
        password,
        displayName: trimmedName,
      });
      uid = userRecord.uid;
    } catch (err) {
      console.error('[create-account] createUser error', err);
      return jsonError(400, friendlyAdminError(err));
    }

    // Seed the users/{uid} profile doc so every downstream read (plan,
    // settings) finds a doc immediately rather than relying on the
    // "missing doc degrades to defaults" fallback every hook already
    // has — belt-and-suspenders, not load-bearing.
    try {
      const db = getAdminDb();
      await db.collection('users').doc(uid).set(
        { displayName: trimmedName, plan: 'free', createdAt: Date.now() },
        { merge: true }
      );
    } catch (err) {
      // Non-fatal: the Auth user already exists and is usable even if
      // this mirror write failed; every hook already degrades
      // gracefully for a missing/partial users/{uid} doc.
      console.error('[create-account] profile seed error', err);
    }

    // Mint a one-time-use custom token so the client can establish a
    // real client-SDK session for the user this route just created —
    // see header comment.
    let customToken: string;
    try {
      customToken = await auth.createCustomToken(uid);
    } catch (err) {
      console.error('[create-account] createCustomToken error', err);
      return jsonError(500, 'Account created, but could not start your session. Please sign in.');
    }

    return NextResponse.json(
      { ok: true, uid, customToken },
      { status: 200, headers: { 'Cache-Control': 'no-store' } }
    );
  } catch (err) {
    console.error('[create-account] handler error', err);
    return jsonError(500, 'Could not create your account. Please try again.');
  }
}
