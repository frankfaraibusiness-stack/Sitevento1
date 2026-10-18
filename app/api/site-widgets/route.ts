// app/api/site-widgets/route.ts
//
// GET /api/site-widgets?siteId=...&pageUrl=...
//
// Called once per page load by public/sitevento.js to find out which
// widgets are enabled for a site, so it can AUTO-MOUNT them — the same
// way it already auto-renders the Site Alert banner from a live
// Firestore read, instead of requiring the site owner to hand-paste a
// `<div data-sitevento-widget="...">` for every widget they turn on in
// the dashboard. That manual-paste step was the actual reason enabling
// a widget in the dashboard never resulted in anything visitors could
// see: WidgetConfigPanel always told the owner enabling it meant
// "Visitors see this widget now," but it only ever wrote a Firestore
// flag — nothing on the customer's own page ever asked for it.
//
// This route is the list form of POST /api/widget (which resolves ONE
// widget's content for a known mount point); this one answers "what's
// turned on for this site at all" so the loader can create the mount
// points itself. It deliberately mirrors /api/widget's trust boundary
// and gating (see that route's comments) since this is just as public
// and just as able to reveal/misuse site config if under-checked:
//
//   1. Validate siteId/pageUrl
//   2. Resolve siteId -> owning site doc (siteIndex)
//   3. Validate the requesting page's domain against the site's
//      registered domain, and require the site to be verified
//   4. Require an active subscription (same default-to-active stance
//      as /api/widget, for sites predating billing)
//   5. Read users/{uid}/sites/{siteId}/widgets/*, keep only the
//      enabled ones, resolve each against the global catalog for its
//      position + bundleUrl + current version
//   6. Return only the public-safe fields a loader needs to mount and
//      render each widget — never raw Firestore docs, never anything
//      about the site owner's account
//
// GET (not POST) because this is cacheable, idempotent, and has
// nothing sensitive in the request itself worth keeping out of access
// logs (siteId is already public — see /api/widget's comments on why
// it isn't a credential; pageUrl is the visited page, already visible
// in Referer to any normal HTTP server).

import { NextRequest, NextResponse } from 'next/server';
import { getAdminDb } from '@/lib/firebaseAdmin';
import { FieldValue } from 'firebase-admin/firestore';
import { allow } from '@/lib/rateLimit';
import {
  isValidSiteId,
  isValidPageUrl,
  hostAuthorized,
  getWidgetCatalogEntry,
  type SiteWidgetDoc,
  type WidgetPosition,
  type WidgetType,
} from '@/lib/widgets';

export const maxDuration = 10;
export const runtime = 'nodejs';

const CORS_HEADERS = {
  'Access-Control-Allow-Origin': '*',
  'Access-Control-Allow-Methods': 'GET, OPTIONS',
  'Access-Control-Allow-Headers': 'Content-Type',
};

// Same freshness window as /api/widget's response — see that route's
// comment on what actually enforces it today (short-lived serverless
// instances + the rate limiter below, not this header alone).
const CACHE_CONTROL = 'public, max-age=30, stale-while-revalidate=120';
const NO_STORE = 'no-store';

export interface AutoMountWidget {
  id: string;
  name: string;
  type: WidgetType;
  position: WidgetPosition;
  version: number;
  config: Record<string, unknown>;
  bundleUrl: string;
}

function jsonError(status: number, code: string, message: string) {
  return NextResponse.json(
    { success: false as const, error: { code, message } },
    { status, headers: { ...CORS_HEADERS, 'Cache-Control': NO_STORE } }
  );
}

export async function OPTIONS() {
  return new NextResponse(null, { status: 204, headers: CORS_HEADERS });
}

export async function POST() {
  return jsonError(400, 'INVALID_REQUEST', 'Use GET.');
}

export async function GET(req: NextRequest) {
  try {
    const { searchParams } = new URL(req.url);
    const siteId = searchParams.get('siteId') || '';
    const pageUrl = searchParams.get('pageUrl') || '';

    if (!isValidSiteId(siteId)) {
      return jsonError(400, 'INVALID_REQUEST', 'Missing or invalid siteId.');
    }
    if (!isValidPageUrl(pageUrl)) {
      return jsonError(400, 'INVALID_REQUEST', 'Missing or invalid pageUrl.');
    }

    // Rate limit keyed the same way /api/widget's is: per site, per
    // requester IP. This endpoint is cheaper per-call (one extra
    // collection read) but is hit once per page load rather than once
    // per widget, so the same budget is appropriate.
    const forwardedFor = req.headers.get('x-forwarded-for') || '';
    const ip = forwardedFor.split(',')[0].trim() || 'unknown';
    if (!allow(`site-widgets:${siteId}:${ip}`, 60, 60_000)) {
      return jsonError(429, 'RATE_LIMITED', 'Too many requests. Please try again shortly.');
    }

    let db;
    try {
      db = getAdminDb();
    } catch (err) {
      console.error('[site-widgets] Firebase Admin init error', err);
      return jsonError(500, 'SERVER_ERROR', 'Something went wrong.');
    }

    // ---- Resolve siteId -> owning site doc ----
    const indexSnap = await db.collection('siteIndex').doc(siteId).get();
    const uid: string | null = indexSnap.exists ? indexSnap.data()?.uid ?? null : null;
    if (!uid) {
      return jsonError(404, 'SITE_NOT_FOUND', 'This site is not registered with Sitevento.');
    }

    const siteRef = db.collection('users').doc(uid).collection('sites').doc(siteId);
    const siteSnap = await siteRef.get();
    if (!siteSnap.exists) {
      return jsonError(404, 'SITE_NOT_FOUND', 'This site is not registered with Sitevento.');
    }
    const site = siteSnap.data()!;

    // ---- Domain + verification check (same bar as /api/widget) ----
    let requestHost: string;
    try {
      requestHost = new URL(pageUrl).hostname;
    } catch {
      return jsonError(400, 'INVALID_REQUEST', 'pageUrl is not a valid URL.');
    }
    const registeredHost: string = typeof site.name === 'string' ? site.name : '';
    if (!registeredHost || !hostAuthorized(requestHost, registeredHost)) {
      return jsonError(403, 'DOMAIN_NOT_AUTHORIZED', 'This page is not on a domain authorized for this site.');
    }
    if (site.status !== 'verified' || site.paused === true) {
      // Quietly return an empty list rather than an error — an
      // unverified site's page still loads sitevento.js for tracking
      // purposes, and this is a routine, expected state (mid-setup),
      // not something worth a loud console.warn on every page view.
      // Same empty-list treatment for a paused site (owner-level pause,
      // see lib/types.ts's Site['paused']) — widgets stop mounting
      // without the owner having to disable each one individually.
      return NextResponse.json(
        { success: true, widgets: [] },
        { status: 200, headers: { ...CORS_HEADERS, 'Cache-Control': CACHE_CONTROL } }
      );
    }

    // ---- Subscription check (same default-to-active stance as /api/widget) ----
    const subscriptionStatus: string = typeof site.subscriptionStatus === 'string' ? site.subscriptionStatus : 'active';
    if (subscriptionStatus !== 'active') {
      return NextResponse.json(
        { success: true, widgets: [] },
        { status: 200, headers: { ...CORS_HEADERS, 'Cache-Control': CACHE_CONTROL } }
      );
    }

    // ---- Enabled per-site widgets, resolved against the catalog ----
    const siteWidgetsSnap = await siteRef.collection('widgets').where('enabled', '==', true).get();

    const widgets: AutoMountWidget[] = [];
    for (const doc of siteWidgetsSnap.docs) {
      const widgetId = doc.id;
      const entry = getWidgetCatalogEntry(widgetId);
      // Catalog entries only ever auto-mount the positioned ones —
      // 'manual-only' widgets (e.g. Reviews, Video Popup) are left for
      // the site owner to place inline themselves, same as before.
      if (!entry || entry.position === 'manual-only') continue;

      // Pull the global catalog doc for bundleUrl/version, same source
      // /api/widget uses — keeps this endpoint's idea of "live" in
      // sync with the one that actually serves widget content.
      const widgetSnap = await db.collection('widgets').doc(widgetId).get();
      if (!widgetSnap.exists) continue;
      const widgetDoc = widgetSnap.data()!;
      if (!widgetDoc.enabled || !widgetDoc.bundleUrl) continue;

      const siteWidget = doc.data() as SiteWidgetDoc;
      widgets.push({
        id: widgetId,
        name: entry.name,
        type: (widgetDoc.type as WidgetType) || 'iframe',
        position: entry.position,
        version: typeof widgetDoc.version === 'number' ? widgetDoc.version : 1,
        config: siteWidget.config || {},
        bundleUrl: widgetDoc.bundleUrl,
      });

      // Same aggregate daily counter /api/widget increments, so a
      // widget's usage stats don't go quiet just because it's now
      // delivered via auto-mount instead of a hand-placed div.
      // Fire-and-forget, never awaited.
      const usageDay = new Date().toISOString().slice(0, 10);
      siteRef
        .collection('widgets')
        .doc(widgetId)
        .collection('usage')
        .doc(usageDay)
        .set({ requests: FieldValue.increment(1) }, { merge: true })
        .catch(() => {});
    }

    return NextResponse.json(
      { success: true, widgets },
      { status: 200, headers: { ...CORS_HEADERS, 'Cache-Control': CACHE_CONTROL } }
    );
  } catch (err) {
    console.error('[site-widgets] handler error', err);
    return jsonError(500, 'SERVER_ERROR', 'Something went wrong.');
  }
}
