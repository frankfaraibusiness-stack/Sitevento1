// lib/widgets.ts
//
// Shared types + pure helpers for the widget delivery system
// (app/api/widget/route.ts). Kept separate from lib/types.ts because
// this is its own subsystem with its own Firestore collections —
// global widget catalog plus per-site enablement — distinct from the
// per-user site/visit/lead data lib/types.ts describes.
//
// ── Firestore shape ──────────────────────────────────────────────────
//
//   widgets/{widgetId}
//     { name, type, enabled, version, bundleUrl, updatedAt }
//     The global catalog: what a widget IS. Site-independent. Adding a
//     widget here (via the Admin SDK / a future admin UI — never from
//     the browser) makes it available to request immediately, with no
//     redeploy, because the delivery route reads this at request time
//     rather than having widgets hardcoded into the client bundle.
//
//   users/{uid}/sites/{siteId}/widgets/{widgetId}
//     { enabled, config, version }
//     Per-site permission + config for a widget. A widget existing in
//     the global catalog does NOT mean every site can use it — this
//     doc is the gate. Nested under the existing users/{uid}/sites/{id}
//     path (not a separate top-level `sites` collection) so it reuses
//     the project's actual ownership structure instead of introducing a
//     second, disconnected site concept.
//
// Small metadata only lives in Firestore; a widget's actual executable
// content (bundleUrl) is expected to point at Firebase Storage, a CDN,
// or any HTTPS URL — never inline code, and the loader only ever mounts
// it inside a sandboxed iframe (see public/sitevento.js), never eval()s
// or otherwise executes it in the host page's own context.

export type WidgetType = 'iframe';

export interface WidgetDoc {
  name: string;
  type: WidgetType;
  enabled: boolean;
  version: number;
  bundleUrl: string;
  updatedAt?: unknown;
}

export interface SiteWidgetDoc {
  enabled: boolean;
  config: Record<string, unknown>;
  version: number;
}

export interface WidgetResponsePayload {
  id: string;
  name: string;
  type: WidgetType;
  version: number;
  config: Record<string, unknown>;
  bundleUrl: string;
}

export type WidgetErrorCode =
  | 'INVALID_REQUEST'
  | 'SITE_NOT_FOUND'
  | 'DOMAIN_NOT_AUTHORIZED'
  | 'SUBSCRIPTION_INACTIVE'
  | 'WIDGET_NOT_FOUND'
  | 'WIDGET_DISABLED'
  | 'WIDGET_NOT_PERMITTED'
  | 'RATE_LIMITED'
  | 'SERVER_ERROR';

const ERROR_STATUS: Record<WidgetErrorCode, number> = {
  INVALID_REQUEST: 400,
  SITE_NOT_FOUND: 404,
  DOMAIN_NOT_AUTHORIZED: 403,
  SUBSCRIPTION_INACTIVE: 402,
  WIDGET_NOT_FOUND: 404,
  WIDGET_DISABLED: 404,
  WIDGET_NOT_PERMITTED: 403,
  RATE_LIMITED: 429,
  SERVER_ERROR: 500,
};

const ERROR_MESSAGE: Record<WidgetErrorCode, string> = {
  INVALID_REQUEST: 'The request was missing required fields or was malformed.',
  SITE_NOT_FOUND: 'This site is not registered with Sitevento.',
  DOMAIN_NOT_AUTHORIZED: 'This page is not on a domain authorized for this site.',
  SUBSCRIPTION_INACTIVE: "This site's subscription does not permit widget delivery right now.",
  WIDGET_NOT_FOUND: 'The requested widget is unavailable.',
  WIDGET_DISABLED: 'The requested widget is unavailable.',
  WIDGET_NOT_PERMITTED: "This site's plan does not include this widget.",
  RATE_LIMITED: 'Too many requests. Please try again shortly.',
  SERVER_ERROR: 'Something went wrong delivering this widget.',
};

export function widgetErrorStatus(code: WidgetErrorCode): number {
  return ERROR_STATUS[code];
}

export function widgetErrorBody(code: WidgetErrorCode, message?: string) {
  return {
    success: false as const,
    error: { code, message: message || ERROR_MESSAGE[code] },
  };
}

// Registrable host comparison for domain authorization: "example.com"
// authorizes both "example.com" and "www.example.com" page requests,
// but not "evil-example.com" or "example.com.attacker.net". Comparison
// is done on the registered domain string the site owner's `url`/`name`
// already stores (see hooks/useConnectSiteWizard.ts) — no new `domains`
// field is introduced, reusing the schema that already exists.
export function hostAuthorized(requestHost: string, registeredHost: string): boolean {
  const req = requestHost.trim().toLowerCase().replace(/^www\./, '');
  const reg = registeredHost.trim().toLowerCase().replace(/^www\./, '');
  if (!req || !reg) return false;
  return req === reg;
}

export function isValidWidgetId(v: unknown): v is string {
  return typeof v === 'string' && /^[a-z0-9][a-z0-9-_]{0,63}$/i.test(v);
}

export function isValidSiteId(v: unknown): v is string {
  return typeof v === 'string' && v.length > 0 && v.length <= 100;
}

export function isValidPageUrl(v: unknown): v is string {
  if (typeof v !== 'string' || v.length > 2000) return false;
  try {
    const u = new URL(v);
    return u.protocol === 'http:' || u.protocol === 'https:';
  } catch {
    return false;
  }
}
