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

// ── Widget catalog ───────────────────────────────────────────────────
//
// The 10 on-site widgets offered on the /widgets picker page. This
// is the single place that enumerates them, their default config, and
// the bundleUrl path each one is served from (see app/w/[widgetId]/
// page.tsx, which renders the actual iframe content for every id below
// at /w/{id} on this same deployment — so `bundleUrl` never needs a
// second hosting target, just this app's own origin).
//
// `configFields` describes the per-site config a dashboard config panel
// collects (WidgetConfigPanel.tsx reads this to render the right inputs
// generically instead of hand-coding 10 separate forms). Every field has
// a default so a widget works immediately with zero configuration.

export type WidgetFieldType = 'text' | 'textarea' | 'color' | 'number' | 'url' | 'datetime' | 'select';

export interface WidgetFieldOption {
  value: string;
  label: string;
}

export interface WidgetFieldDef {
  key: string;
  label: string;
  type: WidgetFieldType;
  default: string | number;
  placeholder?: string;
  help?: string;
  options?: WidgetFieldOption[];
  maxLength?: number;
}

// Where the loader (public/sitevento.js) auto-places a widget's mount
// element on the host page when the site owner has not hand-placed one
// themselves via `<div data-sitevento-widget="...">`. This is what lets
// a widget "just turn on" from the dashboard, the same way the Site
// Alert banner already does — see sitevento.js's auto-mount step.
//
//   'fixed-top'           sticky bar pinned to the top of the viewport
//   'fixed-bottom'        sticky bar pinned to the bottom of the viewport
//   'corner-bottom-right' small floating element, bottom-right corner
//   'corner-bottom-left'  small floating element, bottom-left corner
//   'manual-only'         never auto-mounted; only shows where the site
//                          owner explicitly places the data- div (for
//                          widgets that only make sense embedded inline
//                          in a page's own content, e.g. Reviews)
export type WidgetPosition =
  | 'fixed-top'
  | 'fixed-bottom'
  | 'corner-bottom-right'
  | 'corner-bottom-left'
  | 'manual-only';

export interface WidgetCatalogEntry {
  id: string;
  name: string;
  description: string;
  position: WidgetPosition;
  configFields: WidgetFieldDef[];
}

export const WIDGET_CATALOG: WidgetCatalogEntry[] = [
  {
    id: 'support-chat',
    name: 'Support Chat',
    description: 'A live chat bubble in the corner of your site so visitors can message you directly.',
    position: 'corner-bottom-right',
    configFields: [
      { key: 'greeting', label: 'Greeting message', type: 'textarea', default: "Hi! How can we help?", maxLength: 200 },
      { key: 'accent', label: 'Accent color', type: 'color', default: '#8a5a3c' },
      { key: 'height', label: 'Frame height', type: 'text', default: '480px' },
    ],
  },
  {
    id: 'spin-wheel',
    name: 'Spin-the-Wheel',
    description: 'A playful discount wheel visitors spin once to unlock a coupon or offer in exchange for their email.',
    position: 'corner-bottom-right',
    configFields: [
      { key: 'prizes', label: 'Prizes (comma-separated)', type: 'text', default: '10% OFF,Free Shipping,15% OFF,Try Again,20% OFF,5% OFF', maxLength: 300 },
      { key: 'accent', label: 'Accent color', type: 'color', default: '#8a5a3c' },
      { key: 'height', label: 'Frame height', type: 'text', default: '420px' },
    ],
  },
  {
    id: 'exit-intent',
    name: 'Exit-Intent Popup',
    description: 'Catches a visitor the moment their cursor heads for the tab bar, with one last offer or message.',
    position: 'corner-bottom-right',
    configFields: [
      { key: 'headline', label: 'Headline', type: 'text', default: 'Wait — before you go!', maxLength: 80 },
      { key: 'message', label: 'Message', type: 'textarea', default: 'Here\u2019s 10% off if you stay.', maxLength: 200 },
      { key: 'ctaLabel', label: 'Button label', type: 'text', default: 'Claim offer', maxLength: 40 },
      { key: 'ctaUrl', label: 'Button link', type: 'url', default: '' },
      { key: 'accent', label: 'Accent color', type: 'color', default: '#8a5a3c' },
    ],
  },
  {
    id: 'countdown-timer',
    name: 'Countdown Timer',
    description: 'A sticky bar or badge counting down to a sale, launch, or deadline to create urgency on-page.',
    position: 'fixed-top',
    configFields: [
      { key: 'label', label: 'Label', type: 'text', default: 'Sale ends in', maxLength: 60 },
      { key: 'endsAt', label: 'Ends at', type: 'datetime', default: '' },
      { key: 'accent', label: 'Accent color', type: 'color', default: '#8a5a3c' },
      { key: 'height', label: 'Frame height', type: 'text', default: '64px' },
    ],
  },
  {
    id: 'social-proof',
    name: 'Social Proof Popups',
    description: 'Small "Someone just signed up" toasts that build trust from real-time activity.',
    position: 'corner-bottom-left',
    configFields: [
      { key: 'messages', label: 'Messages (one per line)', type: 'textarea', default: 'Someone in Cape Town just signed up\nSomeone in London just bought a plan\nSomeone in Austin just joined', maxLength: 500 },
      { key: 'accent', label: 'Accent color', type: 'color', default: '#8a5a3c' },
    ],
  },
  {
    id: 'reviews-widget',
    name: 'Reviews & Ratings',
    description: 'Show off your star rating and recent reviews right on the page.',
    // Inline content, not chrome — only makes sense where the owner
    // places it in their own page content, so it isn't auto-mounted.
    position: 'manual-only',
    configFields: [
      { key: 'rating', label: 'Overall rating (1-5)', type: 'number', default: 4.8 },
      { key: 'reviewCount', label: 'Review count', type: 'number', default: 128 },
      { key: 'accent', label: 'Accent color', type: 'color', default: '#8a5a3c' },
      { key: 'height', label: 'Frame height', type: 'text', default: '140px' },
    ],
  },
  {
    id: 'video-popup',
    name: 'Video Popup',
    description: 'An auto-play or click-to-play video overlay for product demos, welcome messages, or promos.',
    // Inline content, not chrome — only makes sense where the owner
    // places it in their own page content, so it isn't auto-mounted.
    position: 'manual-only',
    configFields: [
      { key: 'videoUrl', label: 'Video URL (mp4 or YouTube embed)', type: 'url', default: '' },
      { key: 'autoplay', label: 'Autoplay (1 or 0)', type: 'number', default: 0 },
      { key: 'height', label: 'Frame height', type: 'text', default: '360px' },
    ],
  },
  {
    id: 'feedback-widget',
    name: 'Feedback Tab',
    description: 'A small side tab visitors can click to leave quick feedback or report a bug.',
    position: 'corner-bottom-left',
    configFields: [
      { key: 'prompt', label: 'Prompt', type: 'text', default: 'Got feedback?', maxLength: 80 },
      { key: 'accent', label: 'Accent color', type: 'color', default: '#8a5a3c' },
      { key: 'height', label: 'Frame height', type: 'text', default: '420px' },
    ],
  },
  {
    id: 'referral-widget',
    name: 'Referral Program',
    description: 'A built-in "Invite a friend, get a reward" panel.',
    position: 'corner-bottom-right',
    configFields: [
      { key: 'reward', label: 'Reward text', type: 'text', default: 'Give 10%, Get 10%', maxLength: 80 },
      { key: 'accent', label: 'Accent color', type: 'color', default: '#8a5a3c' },
      { key: 'height', label: 'Frame height', type: 'text', default: '260px' },
    ],
  },
  {
    id: 'announcement-bar',
    name: 'Announcement Bar',
    description: 'A slim bar pinned to the top of the page for ongoing promos or news.',
    position: 'fixed-top',
    configFields: [
      { key: 'message', label: 'Message', type: 'text', default: 'Free shipping on all orders this week!', maxLength: 140 },
      { key: 'ctaLabel', label: 'Button label (optional)', type: 'text', default: '', maxLength: 40 },
      { key: 'ctaUrl', label: 'Button link (optional)', type: 'url', default: '' },
      { key: 'accent', label: 'Bar color', type: 'color', default: '#8a5a3c' },
      { key: 'height', label: 'Frame height', type: 'text', default: '44px' },
    ],
  },
];

export function getWidgetCatalogEntry(id: string): WidgetCatalogEntry | undefined {
  return WIDGET_CATALOG.find((w) => w.id === id);
}

export function defaultConfigFor(id: string): Record<string, unknown> {
  const entry = getWidgetCatalogEntry(id);
  if (!entry) return {};
  const out: Record<string, unknown> = {};
  for (const f of entry.configFields) out[f.key] = f.default;
  return out;
}
