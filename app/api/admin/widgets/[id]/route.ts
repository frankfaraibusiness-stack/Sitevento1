// app/api/admin/widgets/[id]/route.ts
//
// DELETE removes one widget's global widgets/{id} Firestore doc — the
// "un-push" action on the admin table.
//
// ── What this does and doesn't do ─────────────────────────────────────
// Only the catalog doc is deleted — never any per-site data
// (users/{uid}/sites/{siteId}/widgets/{widgetId}), so a site that
// already had this widget turned on keeps its own config; it just
// starts getting WIDGET_NOT_FOUND from /api/widget until the catalog
// doc exists again.
//
// For a built-in id (one of lib/widgets.ts's WIDGET_CATALOG), this is
// NOT a permanent removal: app/api/widget's self-heal (see
// expectedCatalogDoc) recreates the same doc the next time any visitor
// requests that widget. That is accurate and expected — "delete" here
// means "take it down right now / force a clean re-push", not "erase
// this widget from the product." The admin UI surfaces this so it
// isn't a surprise.
//
// id is restricted to WIDGET_CATALOG's own ids (never an arbitrary
// caller-supplied doc path) — this route can't be used to delete
// anything outside the `widgets` collection's known, shipped entries.
//
// Public, no auth — same deliberate choice as the sibling admin routes.
import { NextRequest, NextResponse } from 'next/server';
import { getAdminDb } from '@/lib/firebaseAdmin';
import { allow } from '@/lib/rateLimit';
import { getWidgetCatalogEntry } from '@/lib/widgets';

export const maxDuration = 10;
export const runtime = 'nodejs';

function jsonError(status: number, message: string) {
  return NextResponse.json({ ok: false, error: message }, { status, headers: { 'Cache-Control': 'no-store' } });
}

export async function DELETE(req: NextRequest, { params }: { params: { id: string } }) {
  const ip = req.headers.get('x-forwarded-for')?.split(',')[0]?.trim() || 'unknown';
  if (!allow(`admin-widgets-delete:${ip}`, 20, 60_000)) {
    return jsonError(429, 'Too many requests. Please wait a moment and try again.');
  }

  const entry = getWidgetCatalogEntry(params.id);
  if (!entry) {
    // Not a hidden/arbitrary-id probe result — this route only ever
    // recognizes WIDGET_CATALOG ids, so an unknown id is simply invalid
    // input, same as app/api/widget's WIDGET_NOT_FOUND for the same
    // reason.
    return jsonError(404, 'Unknown widget id.');
  }

  let db;
  try {
    db = getAdminDb();
  } catch (err) {
    console.error('[admin/widgets DELETE] Firebase Admin init error', err);
    return jsonError(500, 'Server is not configured yet (missing Firebase Admin credentials).');
  }

  try {
    await db.collection('widgets').doc(entry.id).delete();
    return NextResponse.json({ ok: true, id: entry.id }, { headers: { 'Cache-Control': 'no-store' } });
  } catch (err) {
    console.error('[admin/widgets DELETE] delete error', err);
    return jsonError(500, 'Could not delete from Firestore. Check server logs for details.');
  }
}
