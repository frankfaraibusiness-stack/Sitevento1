// app/api/newsletter/route.ts
//
// POST { email, hp }
//
// Backs the global footer's newsletter signup (components/layout/Footer.tsx).
// This is sitevento's OWN mailing list — not a customer site's lead
// capture — so it's a top-level collection (`newsletterSubscribers`),
// same pattern as app/api/contact/route.ts's top-level
// `contactSubmissions` (no per-site resolution, no Admin SDK site
// lookup, because there is no site to resolve against here).
//
// ── Spam protection ───────────────────────────────────────────────
// This form has no siteId, so lib/formFloodGuard.ts's bot-shield
// engine (which is keyed to a specific site's own blockedVisitors)
// doesn't apply here. Instead, three independent, honest checks:
//   1. Honeypot field (`hp`) — an input real visitors never see or
//      fill (hidden off-screen in the footer's CSS, never via
//      display:none/visibility:hidden, which some bots skip) but a
//      scripted form-filler typically does. Any non-empty value =
//      silently treated as a success response (so the bot's script
//      doesn't learn it was caught) with no write.
//   2. IP rate limiting — lib/rateLimit.ts's `allow()`, same
//      in-memory fixed-window limiter app/api/contact/route.ts
//      already uses.
//   3. Duplicate-email check — one subscription per email, so a
//      script retrying the same address doesn't pile up rows.
//
// ── What's captured, and why only this ──────────────────────────
// Everything stored below is a REAL signal the server can honestly
// derive from the request itself — the same sources
// app/api/track/route.ts already uses for visit analytics:
//   - country/city: Vercel's edge geo headers (x-vercel-ip-country /
//     x-vercel-ip-city) — no third-party geo-IP call.
//   - device/browser/OS: parsed from the User-Agent header, using
//     the exact same classifyDevice/classifyBrowser/classifyOS logic
//     as app/api/track/route.ts (kept in sync with that file instead
//     of duplicating slightly-different regexes).
//   - language + timezone: read from the client body, same as
//     track's `lang`/`tz` fields — these come from the browser
//     (navigator.language / Intl.DateTimeFormat), not invented.
// There is NO phone number field — a server has no honest way to
// derive a visitor's phone number from an HTTP request, and the
// signup form never asks for one, so nothing resembling it is
// stored.
import { NextRequest, NextResponse } from 'next/server';
import { getAdminDb } from '@/lib/firebaseAdmin';
import { FieldValue } from 'firebase-admin/firestore';
import { allow } from '@/lib/rateLimit';

export const maxDuration = 10;
export const runtime = 'nodejs';

const MAX_EMAIL_LEN = 200;
const EMAIL_RE = /^[^\s@]+@[^\s@]+\.[^\s@]+$/;

// ── User-Agent parsing — mirrors app/api/track/route.ts exactly ────
function classifyDevice(ua: string): string {
  if (!ua) return 'Unknown device';
  const s = ua.toLowerCase();
  if (/ipad|tablet(?!.*mobile)/.test(s)) return 'Tablet';
  if (/mobi|iphone|android.*mobile|windows phone/.test(s)) return 'Mobile';
  return 'Desktop';
}

function classifyBrowser(ua: string): string {
  if (!ua) return 'Unknown';
  if (/edg\//i.test(ua)) return 'Edge';
  if (/opr\/|opera/i.test(ua)) return 'Opera';
  if (/crios\//i.test(ua)) return 'Chrome';
  if (/fxios\//i.test(ua)) return 'Firefox';
  if (/firefox\//i.test(ua)) return 'Firefox';
  if (/chrome\//i.test(ua) && !/edg\//i.test(ua)) return 'Chrome';
  if (/safari\//i.test(ua) && /version\//i.test(ua)) return 'Safari';
  if (/msie|trident/i.test(ua)) return 'Internet Explorer';
  return 'Unknown';
}

function classifyOS(ua: string): string {
  if (!ua) return 'Unknown';
  if (/windows nt/i.test(ua)) return 'Windows';
  if (/iphone|ipad|ipod/i.test(ua)) return 'iOS';
  if (/mac os x/i.test(ua)) return 'macOS';
  if (/android/i.test(ua)) return 'Android';
  if (/cros/i.test(ua)) return 'ChromeOS';
  if (/linux/i.test(ua)) return 'Linux';
  return 'Unknown';
}

function clip(v: unknown, max: number): string {
  return typeof v === 'string' ? v.trim().slice(0, max) : '';
}

export async function POST(req: NextRequest) {
  try {
    const body = await req.json().catch(() => ({}));
    const { email, hp, lang, tz } = body || {};

    // Honeypot: any real value here means a bot filled every field,
    // including the one CSS hides from real visitors. Respond exactly
    // like a normal success so the bot's script has no signal it was
    // caught, but never touch Firestore.
    if (typeof hp === 'string' && hp.trim().length > 0) {
      return NextResponse.json({ ok: true }, { status: 200 });
    }

    const trimmedEmail = clip(email, MAX_EMAIL_LEN).toLowerCase();
    if (!trimmedEmail || !EMAIL_RE.test(trimmedEmail)) {
      return NextResponse.json({ ok: false, reason: 'invalid email' }, { status: 200 });
    }

    const forwardedFor = req.headers.get('x-forwarded-for') || '';
    const ip = forwardedFor.split(',')[0].trim() || 'unknown';
    if (!allow(`newsletter:${ip}`, 5, 60_000)) {
      return NextResponse.json({ ok: false, reason: 'rate limited' }, { status: 200 });
    }

    let db;
    try {
      db = getAdminDb();
    } catch (err) {
      console.error('[newsletter] Firebase Admin init error', err);
      return NextResponse.json({ ok: false }, { status: 200 });
    }

    const existing = await db
      .collection('newsletterSubscribers')
      .where('email', '==', trimmedEmail)
      .limit(1)
      .get();
    if (!existing.empty) {
      return NextResponse.json({ ok: false, reason: 'duplicate' }, { status: 200 });
    }

    const country = req.headers.get('x-vercel-ip-country') || 'Unknown';
    const cityHeader = req.headers.get('x-vercel-ip-city');
    const city = cityHeader ? decodeURIComponent(cityHeader) : null;
    const ua = req.headers.get('user-agent') || '';

    await db.collection('newsletterSubscribers').add({
      email: trimmedEmail,
      country,
      city,
      device: classifyDevice(ua),
      browser: classifyBrowser(ua),
      os: classifyOS(ua),
      lang: clip(lang, 20) || null,
      tz: clip(tz, 60) || null,
      userAgent: clip(ua, 300),
      source: 'footer',
      createdAt: FieldValue.serverTimestamp(),
    });

    return NextResponse.json({ ok: true }, { status: 200 });
  } catch (err) {
    console.error('[newsletter] handler error', err);
    return NextResponse.json({ ok: false }, { status: 200 });
  }
}
