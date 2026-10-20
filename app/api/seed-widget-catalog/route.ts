// app/api/seed-widget-catalog/route.ts
//
// Backs the public admin tool at /admin/widgets (see that route's
// page.tsx) — a "Deploy" button that writes the global
// widgets/{id} catalog docs this app's own Firestore needs before any
// shipped widget (support-chat, countdown-timer) can actually render
// for a visitor. See lib/widgets.ts's "Self-healing global catalog"
// comment for the fuller story: app/api/widget and app/api/site-widget
// already self-heal this the first time a widget is requested/toggled
// on, so in the common case this route is a convenience, not the only
// way the catalog ever gets written — but if the Admin SDK env vars
// were missing or misconfigured at the time someone turned a widget
// on, that self-heal silently can't run, and this gives a direct,
// one-click way to (re)seed the same docs on demand instead of
// guessing why the widget still isn't live.
//
// ── Public, deliberately ─────────────────────────────────────────────
// This route has NO auth check, at the person's explicit request (a
// quick internal tool, not gated behind sign-in or a passphrase). That
// is safe ONLY because of what this route is hard-coded to do and
// nothing more:
//   - It can only ever write the fixed SHIPPED_WIDGET_IDS below (the
//     exact ids in lib/widgets.ts's WIDGET_CATALOG) — there is no
//     widgetId field read from the request body, so a caller cannot
//     use this to inject an arbitrary doc id into the widgets/
//     collection.
//   - Every bundleUrl it writes is derived from THIS request's own
//     origin (req.nextUrl.origin, the same derivation
//     expectedCatalogDoc() uses elsewhere) — never a URL supplied by
//     the caller — so this can't be used to point the catalog at
//     attacker-controlled content.
//   - It only sets name/type/enabled/version/bundleUrl, the same shape
//     app/api/widget's self-heal already writes unsupervised on every
//     visitor request; this route does not touch per-site data
//     (users/{uid}/sites/{siteId}/widgets/{widgetId}), billing, or
//     anything else.
// In short: worst case, anyone who finds this URL can re-run the
// equivalent of `node scripts/manage-widget.mjs seed-catalog` against
// this deployment. They cannot use it to add a new widget id, change
// what the widgets point at, or reach any other collection.
//
// Still rate-limited (see lib/rateLimit.ts) since this is a public
// POST endpoint that does real writes — generous, just enough to stop
// an accidental hot loop.
import { NextRequest, NextResponse } from 'next/server';
import { FieldValue } from 'firebase-admin/firestore';
import { getAdminDb } from '@/lib/firebaseAdmin';
import { allow } from '@/lib/rateLimit';
import { getWidgetCatalogEntry } from '@/lib/widgets';

export const maxDuration = 10;
export const runtime = 'nodejs';

// Mirrors scripts/manage-widget.mjs's SHIPPED_WIDGET_IDS — the only
// ids this route will ever write. Kept as its own literal list (rather
// than reading WIDGET_CATALOG directly) so this stays an explicit,
// reviewable allowlist even if the catalog grows later; update both
// when a new widget ships.
const SHIPPED_WIDGET_IDS = ['support-chat', 'countdown-timer'] as const;

function jsonError(status: number, message: string) {
  return NextResponse.json({ ok: false, error: message }, { status, headers: { 'Cache-Control': 'no-store' } });
}

export async function POST(req: NextRequest) {
  // Best-effort caller key for rate limiting only — not used for any
  // access decision, just to keep one noisy caller from hammering this.
  const ip = req.headers.get('x-forwarded-for')?.split(',')[0]?.trim() || 'unknown';
  if (!allow(`seed-widget-catalog:${ip}`, 5, 60_000)) {
    return jsonError(429, 'Too many requests. Please wait a moment and try again.');
  }

  let db;
  try {
    db = getAdminDb();
  } catch (err) {
    console.error('[seed-widget-catalog] Firebase Admin init error', err);
    return jsonError(500, 'Server is not configured yet (missing Firebase Admin credentials — set FIREBASE_PROJECT_ID / FIREBASE_CLIENT_EMAIL / FIREBASE_PRIVATE_KEY).');
  }

  const origin = req.nextUrl.origin;
  const results: { id: string; status: 'created' | 'updated'; bundleUrl: string }[] = [];

  try {
    for (const id of SHIPPED_WIDGET_IDS) {
      const entry = getWidgetCatalogEntry(id);
      if (!entry) continue; // defensive only — ids above always exist in the catalog

      const ref = db.collection('widgets').doc(id);
      const existing = await ref.get();
      const bundleUrl = `${origin}/w/${id}`;
      const data = {
        name: entry.name,
        type: 'iframe' as const,
        enabled: true,
        version: existing.exists && typeof existing.data()?.version === 'number' ? existing.data()!.version : 1,
        bundleUrl,
        updatedAt: FieldValue.serverTimestamp(),
      };
      await ref.set(data, { merge: true });
      results.push({ id, status: existing.exists ? 'updated' : 'created', bundleUrl });
    }
  } catch (err) {
    console.error('[seed-widget-catalog] write error', err);
    return jsonError(500, 'Could not write to Firestore. Check server logs for details.');
  }

  return NextResponse.json({ ok: true, results }, { headers: { 'Cache-Control': 'no-store' } });
}
