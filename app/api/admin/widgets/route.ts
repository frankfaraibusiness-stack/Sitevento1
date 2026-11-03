// app/api/admin/widgets/route.ts
//
// Backs the admin widget table at /admin/widgets: GET returns, for
// every id in lib/widgets.ts's WIDGET_CATALOG, whether its global
// widgets/{id} Firestore doc currently exists ("pushed") plus its
// live enabled/version/bundleUrl if so. This is a pure status read —
// it never writes anything (seeding stays POST /api/seed-widget-catalog,
// deleting is DELETE /api/admin/widgets/[id]).
//
// Public, no auth — same deliberate choice as the other /admin/widgets
// routes (see seed-widget-catalog/route.ts's comment for the reasoning
// this mirrors): it only ever reads the fixed WIDGET_CATALOG ids, never
// anything caller-supplied, so there's nothing here for an unauthenticated
// caller to manipulate.
import { NextRequest, NextResponse } from 'next/server';
import { getAdminDb } from '@/lib/firebaseAdmin';
import { allow } from '@/lib/rateLimit';
import { WIDGET_CATALOG, type WidgetDoc, type AdminWidgetStatus } from '@/lib/widgets';

export const maxDuration = 10;
export const runtime = 'nodejs';

function jsonError(status: number, message: string) {
  return NextResponse.json({ ok: false, error: message }, { status, headers: { 'Cache-Control': 'no-store' } });
}

export async function GET(req: NextRequest) {
  const ip = req.headers.get('x-forwarded-for')?.split(',')[0]?.trim() || 'unknown';
  if (!allow(`admin-widgets-list:${ip}`, 30, 60_000)) {
    return jsonError(429, 'Too many requests. Please wait a moment and try again.');
  }

  let db;
  try {
    db = getAdminDb();
  } catch (err) {
    console.error('[admin/widgets GET] Firebase Admin init error', err);
    return jsonError(500, 'Server is not configured yet (missing Firebase Admin credentials).');
  }

  try {
    // One read per catalog entry rather than a collection scan: every
    // id this page needs to show is already known statically from
    // WIDGET_CATALOG, and reading exactly those docs (vs. listing the
    // whole `widgets` collection) means a doc that was deleted simply
    // comes back as "not pushed" instead of silently disappearing from
    // the table.
    const snaps = await Promise.all(
      WIDGET_CATALOG.map((entry) => db.collection('widgets').doc(entry.id).get())
    );

    const results: AdminWidgetStatus[] = WIDGET_CATALOG.map((entry, i) => {
      const snap = snaps[i];
      if (!snap.exists) {
        return {
          id: entry.id,
          name: entry.name,
          source: 'built-in',
          pushed: false,
          enabled: null,
          version: null,
          bundleUrl: null,
        };
      }
      const data = snap.data() as WidgetDoc;
      return {
        id: entry.id,
        name: entry.name,
        source: 'built-in',
        pushed: true,
        enabled: typeof data.enabled === 'boolean' ? data.enabled : null,
        version: typeof data.version === 'number' ? data.version : null,
        bundleUrl: typeof data.bundleUrl === 'string' ? data.bundleUrl : null,
      };
    });

    return NextResponse.json({ ok: true, results }, { headers: { 'Cache-Control': 'no-store' } });
  } catch (err) {
    console.error('[admin/widgets GET] read error', err);
    return jsonError(500, 'Could not read from Firestore. Check server logs for details.');
  }
}
