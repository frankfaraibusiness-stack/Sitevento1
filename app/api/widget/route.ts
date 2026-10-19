// app/api/widget/route.ts
//
// POST { siteId, widgetId, pageUrl, version? }
//
// Called by public/sitevento.js for every [data-sitevento-widget]
// element it finds on a third-party page. Resolves and returns the
// config a widget needs to render, so a widget can be added to the
// `widgets/{widgetId}` Firestore collection and immediately requested
// by any permitted site — no redeploy of this route, the loader, or
// the customer's page needed for a new widget to go live.
//
// ── What this checks, in order (see spec) ────────────────────────────
//   1. Method/content-type/payload/required-field validation
//   2. Resolve siteId -> the registered site (siteIndex -> users/{uid}/sites/{siteId})
//   3. Validate the requesting page's domain against the site's
//      registered domain
//   4. Widget exists and is enabled (global catalog)
//   5. Site's subscription/plan is active and the widget is permitted
//      for this site specifically (per-site widgets subdoc)
//   6. Read the widget's config + delivery info from Firestore
//   7. Return the structured response the loader renders
//
// ── Trust boundary ───────────────────────────────────────────────────
// siteId is NOT a secret (it's pasted into public HTML) and MUST NOT be
// treated as a credential by itself — authorization is enforced here,
// server-side, by cross-checking the request's declared pageUrl host
// against the domain the site owner registered in the dashboard, not by
// trusting whatever the caller claims. Origin/Referer headers are used
// as a best-effort secondary signal only: both headers (and siteId
// itself) can be forged by a non-browser client, so neither is treated
// as authentication on its own — a mismatch does not independently
// block a request whose declared pageUrl host otherwise matches the
// registered domain, since a browser's Referer can legitimately be
// stripped by the visitor's own privacy settings.
//
// This endpoint never imports or exposes the Firebase Admin credentials
// to the response, never returns unrestricted Firestore contents (only
// the single widget's public-safe fields), and never executes anything
// it reads — it hands back JSON for the loader to render inside a
// sandboxed iframe.

import { NextRequest, NextResponse } from 'next/server';
import { getAdminDb } from '@/lib/firebaseAdmin';
import { FieldValue } from 'firebase-admin/firestore';
import { allow } from '@/lib/rateLimit';
import {
  isValidSiteId,
  isValidWidgetId,
  isValidPageUrl,
  hostAuthorized,
  widgetErrorBody,
  widgetErrorStatus,
  expectedCatalogDoc,
  type WidgetDoc,
  type SiteWidgetDoc,
  type WidgetResponsePayload,
} from '@/lib/widgets';

export const maxDuration = 10;
export const runtime = 'nodejs';

const CORS_HEADERS = {
  'Access-Control-Allow-Origin': '*',
  'Access-Control-Allow-Methods': 'POST, OPTIONS',
  'Access-Control-Allow-Headers': 'Content-Type',
};

const MAX_BODY_BYTES = 4 * 1024;

// Cache-Control header for the success response. Note this is a POST
// endpoint, and browsers/most CDNs do not cache POST responses by
// Cache-Control alone — this header mainly documents the intended
// freshness window and takes effect if this route is later fronted by
// an edge cache configured to honor it for POST, or if the loader is
// changed to a cacheable GET (?site=&widget=) in a future revision.
// The real protection against repeat Firestore reads today is the
// serverless instance's own short lifetime plus the rate limiter
// above — not this header. 30s/120s mirrors the freshness window
// documented in the deployment guide for "how soon does a config
// change show up."
const CACHE_CONTROL = 'public, max-age=30, stale-while-revalidate=120';
const NO_STORE = 'no-store';

function jsonError(code: Parameters<typeof widgetErrorBody>[0], message?: string) {
  return NextResponse.json(widgetErrorBody(code, message), {
    status: widgetErrorStatus(code),
    headers: { ...CORS_HEADERS, 'Cache-Control': NO_STORE },
  });
}

export async function OPTIONS() {
  return new NextResponse(null, { status: 204, headers: CORS_HEADERS });
}

// GET is not supported — widget requests carry a pageUrl and are
// per-visitor, so this is POST-only by design (also keeps the payload
// out of server/proxy access logs that commonly capture query strings).
export async function GET() {
  return jsonError('INVALID_REQUEST', 'Use POST.');
}

export async function POST(req: NextRequest) {
  try {
    // ---- 1a. Content-type validation ----
    const contentType = req.headers.get('content-type') || '';
    if (!contentType.toLowerCase().includes('application/json')) {
      return jsonError('INVALID_REQUEST', 'Content-Type must be application/json.');
    }

    // ---- 1b. Size limit ----
    const contentLength = Number(req.headers.get('content-length') || 0);
    if (contentLength > MAX_BODY_BYTES) {
      return jsonError('INVALID_REQUEST', 'Request body too large.');
    }
    const raw = await req.text();
    if (raw.length > MAX_BODY_BYTES) {
      return jsonError('INVALID_REQUEST', 'Request body too large.');
    }

    let body: any;
    try {
      body = JSON.parse(raw);
    } catch {
      return jsonError('INVALID_REQUEST', 'Malformed JSON body.');
    }

    const { siteId, widgetId, pageUrl } = body || {};

    // ---- 1c. Required-field validation ----
    if (!isValidSiteId(siteId)) {
      return jsonError('INVALID_REQUEST', 'Missing or invalid siteId.');
    }
    if (!isValidWidgetId(widgetId)) {
      return jsonError('INVALID_REQUEST', 'Missing or invalid widgetId.');
    }
    if (!isValidPageUrl(pageUrl)) {
      return jsonError('INVALID_REQUEST', 'Missing or invalid pageUrl.');
    }

    // ---- 1d. Rate limiting ----
    // Keyed on siteId+widgetId+requester IP: bounds how hard any one
    // visitor can hammer any one widget on any one site, without
    // penalizing a popular site's other visitors or other widgets.
    const forwardedFor = req.headers.get('x-forwarded-for') || '';
    const ip = forwardedFor.split(',')[0].trim() || 'unknown';
    const rateKey = `widget:${siteId}:${widgetId}:${ip}`;
    if (!allow(rateKey, 60, 60_000)) {
      return jsonError('RATE_LIMITED');
    }

    let db;
    try {
      db = getAdminDb();
    } catch (err) {
      console.error('[widget] Firebase Admin init error', err);
      return jsonError('SERVER_ERROR');
    }

    // ---- 2. Resolve siteId -> owning site doc ----
    const indexSnap = await db.collection('siteIndex').doc(siteId).get();
    const uid: string | null = indexSnap.exists ? indexSnap.data()?.uid ?? null : null;
    if (!uid) {
      return jsonError('SITE_NOT_FOUND');
    }

    const siteRef = db.collection('users').doc(uid).collection('sites').doc(siteId);
    const siteSnap = await siteRef.get();
    if (!siteSnap.exists) {
      return jsonError('SITE_NOT_FOUND');
    }
    const site = siteSnap.data()!;

    // ---- 3. Domain validation ----
    // The site's registered domain comes from its own `name`/`url`
    // (set once at connect time — see hooks/useConnectSiteWizard.ts),
    // not from anything the request claims, so a request can't simply
    // assert it's authorized.
    let requestHost: string;
    try {
      requestHost = new URL(pageUrl).hostname;
    } catch {
      return jsonError('INVALID_REQUEST', 'pageUrl is not a valid URL.');
    }
    const registeredHost: string = typeof site.name === 'string' ? site.name : '';
    if (!registeredHost || !hostAuthorized(requestHost, registeredHost)) {
      return jsonError('DOMAIN_NOT_AUTHORIZED');
    }

    // Also require the site to be verified (same bar /api/track uses) —
    // an unverified site hasn't proven ownership of that domain yet, so
    // it shouldn't be able to pull widget content onto it either.
    if (site.status !== 'verified') {
      return jsonError('DOMAIN_NOT_AUTHORIZED', 'This site has not completed verification.');
    }

    // ---- 5a. Subscription/plan check ----
    // `plan`/`subscriptionStatus` are read if present; a site with
    // neither field (e.g. every site created by the current dashboard,
    // which has no billing yet) is treated as on the default/free plan
    // rather than rejected outright, so this does not break widget
    // delivery before a billing system exists. Once billing is added,
    // setting `subscriptionStatus: 'suspended'` on a site doc is enough
    // to cut off widget delivery immediately.
    const subscriptionStatus: string = typeof site.subscriptionStatus === 'string' ? site.subscriptionStatus : 'active';
    if (subscriptionStatus !== 'active') {
      return jsonError('SUBSCRIPTION_INACTIVE');
    }

    // ---- 4 & 6. Widget exists, enabled, and its config ----
    const widgetDocRef = db.collection('widgets').doc(widgetId);
    let widgetSnap = await widgetDocRef.get();
    let widget: WidgetDoc;

    if (!widgetSnap.exists) {
      // Self-heal: this is one of our own shipped widgets (its id is
      // in lib/widgets.ts's WIDGET_CATALOG) but the global catalog doc
      // was never seeded — the only reason every widget used to go
      // dark site-wide. Create it now from the known, derivable shape
      // (see expectedCatalogDoc) instead of rejecting forever. A
      // request widgetId that ISN'T a real catalog entry still gets a
      // clean WIDGET_NOT_FOUND, same as before — this never invents a
      // doc for an unknown id.
      const expected = expectedCatalogDoc(widgetId, req.nextUrl.origin);
      if (!expected) {
        return jsonError('WIDGET_NOT_FOUND');
      }
      console.warn('[widget] auto-seeding missing global catalog doc for', widgetId);
      await widgetDocRef.set(
        { ...expected, updatedAt: FieldValue.serverTimestamp() },
        { merge: true }
      );
      widgetSnap = await widgetDocRef.get();
    }

    widget = widgetSnap.data() as WidgetDoc;
    if (!widget.enabled) {
      return jsonError('WIDGET_DISABLED');
    }
    if (!widget.bundleUrl || typeof widget.bundleUrl !== 'string') {
      // Misconfigured catalog entry — treat as not-found rather than
      // leaking an incomplete doc shape to the client.
      console.error('[widget] widget doc missing bundleUrl', widgetId);
      return jsonError('WIDGET_NOT_FOUND');
    }

    // ---- 5b. Per-site widget permission ----
    const siteWidgetSnap = await siteRef.collection('widgets').doc(widgetId).get();
    if (!siteWidgetSnap.exists) {
      return jsonError('WIDGET_NOT_PERMITTED');
    }
    const siteWidget = siteWidgetSnap.data() as SiteWidgetDoc;
    if (!siteWidget.enabled) {
      return jsonError('WIDGET_NOT_PERMITTED');
    }

    // ---- 7. Structured success response ----
    const payload: WidgetResponsePayload = {
      id: widgetId,
      name: widget.name,
      type: widget.type,
      version: widget.version,
      config: siteWidget.config || {},
      bundleUrl: widget.bundleUrl,
    };

    // Usage is tracked as ONE aggregate counter per site+widget+day,
    // not a document per request — a thousand requests for the same
    // widget on the same day all collapse into a single
    // FieldValue.increment(1) write target, bounding Firestore cost
    // under high traffic regardless of visitor volume. Fire-and-forget:
    // never awaited, and a failure here must not affect the 200 the
    // widget response already carries.
    const usageDay = new Date().toISOString().slice(0, 10); // UTC Y-M-D
    siteRef
      .collection('widgets')
      .doc(widgetId)
      .collection('usage')
      .doc(usageDay)
      .set({ requests: FieldValue.increment(1) }, { merge: true })
      .catch(() => {});

    return NextResponse.json(
      { success: true, widget: payload },
      { status: 200, headers: { ...CORS_HEADERS, 'Cache-Control': CACHE_CONTROL, ETag: `"${widgetId}-v${widget.version}"` } }
    );
  } catch (err) {
    console.error('[widget] handler error', err);
    return jsonError('SERVER_ERROR');
  }
}
