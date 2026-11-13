// app/api/console-auth/route.ts
//
// Auth for the internal /console admin dashboard — DELIBERATELY NOT
// the app's real Firebase Auth/session system (lib/firebase.ts,
// app/api/session). Console is an internal-only tool, not a customer-
// facing account surface, so it gets its own small, separate gate
// instead of reusing the global auth model.
//
// ── Testing-phase contract (see this route's own TODO below) ────────
// For now this accepts a single shared passcode so the dashboard can
// be built/tested end-to-end before real per-admin accounts exist.
// THIS IS NOT PRODUCTION ACCESS CONTROL — anyone who knows the
// passcode gets in. Before shipping this publicly, swap this route
// for a real allowlisted-admin check (e.g. verify a Firebase session
// AND check users/{uid}.isAdmin === true) and delete the passcode
// path entirely.
//
// POST { passcode } → sets an HttpOnly 'console_session' cookie,
//   separate from the app's own '__session' cookie, so signing out of
//   Console never touches a real user's session and vice versa.
// GET  (no body)     → { ok: true } if the cookie is present/valid,
//   else { ok: false }.
// DELETE (no body)   → clears the cookie.
import { NextRequest, NextResponse } from 'next/server';
import { allow } from '@/lib/rateLimit';

export const runtime = 'nodejs';
export const maxDuration = 10;
export const dynamic = 'force-dynamic';

const COOKIE_NAME = 'console_session';
const MAX_AGE_SECONDS = 14 * 24 * 60 * 60; // 14 days, same lifetime as the real session cookie

// TODO(testing-phase): shared passcode, see header comment. Gate this
// behind a real admin allowlist before Console is ever linked
// publicly.
const CONSOLE_PASSCODE = '2026';

// The cookie VALUE is not just "1" — it's a fixed opaque token so a
// visitor can't forge a valid-looking cookie by guessing the scheme.
// Still not real auth (see header), just avoids the most trivial
// bypass (manually setting console_session=true in devtools).
const COOKIE_VALUE = 'granted-2026-console';

function cookieOptions() {
  return {
    httpOnly: true,
    secure: process.env.NODE_ENV === 'production',
    sameSite: 'lax' as const,
    path: '/',
    maxAge: MAX_AGE_SECONDS,
  };
}

export async function POST(req: NextRequest) {
  try {
    const forwardedForHeader = req.headers.get('x-forwarded-for') || '';
    const callerIp = forwardedForHeader.split(',')[0].trim() || 'unknown';
    // Strict rate limit — this is a passcode guess surface.
    if (!allow(`console-auth:${callerIp}`, 10, 60_000)) {
      return NextResponse.json({ ok: false, error: 'Too many attempts. Try again in a minute.' }, { status: 429 });
    }

    const raw = await req.text();
    let body: any = {};
    try {
      body = raw ? JSON.parse(raw) : {};
    } catch {
      return NextResponse.json({ ok: false, error: 'Malformed request.' }, { status: 400 });
    }

    const passcode = typeof body?.passcode === 'string' ? body.passcode.trim() : '';
    if (passcode !== CONSOLE_PASSCODE) {
      return NextResponse.json({ ok: false, error: 'Incorrect passcode.' }, { status: 401 });
    }

    const res = NextResponse.json({ ok: true }, { status: 200, headers: { 'Cache-Control': 'no-store' } });
    res.cookies.set(COOKIE_NAME, COOKIE_VALUE, cookieOptions());
    return res;
  } catch (err) {
    console.error('[console-auth][POST] error', err);
    return NextResponse.json({ ok: false, error: 'Something went wrong. Please try again.' }, { status: 500 });
  }
}

export async function GET(req: NextRequest) {
  const cookie = req.cookies.get(COOKIE_NAME)?.value;
  const ok = cookie === COOKIE_VALUE;
  return NextResponse.json({ ok }, { status: 200, headers: { 'Cache-Control': 'no-store' } });
}

export async function DELETE() {
  const res = NextResponse.json({ ok: true }, { status: 200, headers: { 'Cache-Control': 'no-store' } });
  res.cookies.delete(COOKIE_NAME);
  return res;
}
