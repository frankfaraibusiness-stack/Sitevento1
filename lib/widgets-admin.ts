// lib/widgets-admin.ts
//
// Server-only counterpart to lib/widgets.ts. Holds the one piece of the
// widget-catalog logic that actually touches Firestore/firebase-admin
// (getCachedWidgetDoc). Split out so that lib/widgets.ts — which is
// imported by client components for WIDGET_CATALOG, types, and pure
// helpers — never transitively pulls 'firebase-admin' into the browser
// bundle (that was breaking the Next.js client build: firebase-admin
// requires Node core modules like 'fs'/'net' that don't exist in the
// browser).
//
// Only import this file from server code (API routes, server
// components/actions) — never from anything marked 'use client'.
// (Not using the 'server-only' package here since it isn't already a
// project dependency — see package.json — and adding one isn't needed
// to fix the build; the import-boundary comment is enforcement enough
// given this module is only referenced from two API routes below.)

import { FieldValue, type Firestore } from 'firebase-admin/firestore';
import { withCache } from './requestCache';
import { expectedCatalogDoc, type WidgetDoc } from './widgets';

// ── Cached global-catalog read ───────────────────────────────────────
// widgets/{id} is admin-managed (seeded once via scripts/manage-widget.mjs
// or self-healed on first request — see below) and essentially static:
// `enabled`/`version`/`bundleUrl` only ever change on a deliberate admin
// action, never as a side effect of visitor traffic. Yet this doc was
// being read from Firestore on EVERY /api/widget call and EVERY enabled
// widget inside EVERY /api/site-widgets call — i.e. once per widget per
// page load, scaling with visitor volume for data that only changes a
// handful of times total. Cached per-instance for a short window so a
// page with 3 widgets costs at most 3 Firestore reads total across an
// instance's whole warm lifetime for this doc, not 3 reads per visitor.
// Self-heal (auto-creating a missing doc for a known catalog id) still
// happens on an actual cache miss, unchanged — this wraps the read,
// not the write.
const WIDGET_CATALOG_DOC_CACHE_TTL_MS = 30_000;

export async function getCachedWidgetDoc(
  db: Firestore,
  widgetId: string,
  origin: string
): Promise<WidgetDoc | null> {
  return withCache(`widgetCatalogDoc:${widgetId}`, WIDGET_CATALOG_DOC_CACHE_TTL_MS, async () => {
    const ref = db.collection('widgets').doc(widgetId);
    let snap = await ref.get();
    if (!snap.exists) {
      const expected = expectedCatalogDoc(widgetId, origin);
      if (!expected) return null;
      console.warn('[widgets] auto-seeding missing global catalog doc for', widgetId);
      await ref.set({ ...expected, updatedAt: FieldValue.serverTimestamp() }, { merge: true });
      snap = await ref.get();
    }
    return (snap.exists ? (snap.data() as WidgetDoc) : null);
  });
}
