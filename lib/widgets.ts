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

export type WidgetFieldType = 'text' | 'textarea' | 'color' | 'number' | 'url' | 'datetime' | 'select' | 'prizeList' | 'faqList';

export interface WidgetFieldOption {
  value: string;
  label: string;
}

export interface WidgetFieldDef {
  key: string;
  label: string;
  type: WidgetFieldType;
  // 'prizeList'/'faqList' fields store/default to a Prize[]/FaqItem[]
  // instead — see below.
  default: string | number | Prize[] | FaqItem[];
  placeholder?: string;
  help?: string;
  options?: WidgetFieldOption[];
  maxLength?: number;
}

// ── Spin-reward prize table ──────────────────────────────────────────
//
// Previously hardcoded as DEFAULT_PRIZES inside SpinRewardWidget.tsx —
// every site got the same 3 prizes/codes. Moved here as a proper
// config field (type 'prizeList') so a site owner can set their own
// discount codes and odds from the designer, the same way every other
// per-widget setting works. `weight` is a relative odds weight (not a
// percentage — SpinRewardWidget normalizes against the sum of all
// weights), matching the pickPrize() logic that already existed there.
export interface Prize {
  label: string;
  code: string;
  weight: number;
}

export const DEFAULT_PRIZES: Prize[] = [
  { label: '10% off', code: 'SPIN10', weight: 50 },
  { label: 'Free shipping', code: 'SHIPFREE', weight: 33 },
  { label: '20% off', code: 'SPIN20', weight: 17 },
];

export function isPrizeList(v: unknown): v is Prize[] {
  return (
    Array.isArray(v) &&
    v.every(
      (p) =>
        p &&
        typeof p === 'object' &&
        typeof (p as Prize).label === 'string' &&
        typeof (p as Prize).code === 'string' &&
        typeof (p as Prize).weight === 'number'
    )
  );
}

// Config is stored as Record<string, unknown> (Firestore-agnostic JSON),
// so a prize list round-trips as plain array data same as any other
// field — this just gives callers a typed, validated read with a safe
// fallback to DEFAULT_PRIZES if the stored value is missing/malformed.
export function prizesFromConfig(config: Record<string, unknown>): Prize[] {
  const raw = config.prizes;
  return isPrizeList(raw) && raw.length > 0 ? raw : DEFAULT_PRIZES;
}

// ── FAQ page questions ───────────────────────────────────────────────
//
// One Q&A pair in the faq-page widget's accordion. Same storage shape
// idea as Prize above: plain JSON array in config.faqs, either typed
// in by hand in the designer or filled in by POST /api/generate-faq
// (see that route) from a business description + optional site
// metadata. Either path writes the exact same FaqItem[] shape, so the
// live widget never needs to know which one produced it.
export interface FaqItem {
  q: string;
  a: string;
}

export const DEFAULT_FAQS: FaqItem[] = [
  { q: 'What do you offer?', a: 'Tell visitors what your business does here.' },
  { q: 'How can I get in touch?', a: 'Add your contact details or support hours here.' },
];

export function isFaqList(v: unknown): v is FaqItem[] {
  return (
    Array.isArray(v) &&
    v.every((f) => f && typeof f === 'object' && typeof (f as FaqItem).q === 'string' && typeof (f as FaqItem).a === 'string')
  );
}

export function faqsFromConfig(config: Record<string, unknown>): FaqItem[] {
  const raw = config.faqs;
  return isFaqList(raw) && raw.length > 0 ? raw : DEFAULT_FAQS;
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
//   'scroll-end'          full-screen takeover triggered once the
//                          visitor scrolls within a threshold of the
//                          bottom of the page (see sitevento.js's
//                          scroll-end auto-mount handling), rather than
//                          mounted immediately on load like every other
//                          position
//   'manual-only'         never auto-mounted; only shows where the site
//                          owner explicitly places the data- div (for
//                          widgets that only make sense embedded inline
//                          in a page's own content, e.g. Reviews)
export type WidgetPosition =
  | 'fixed-top'
  | 'fixed-bottom'
  | 'corner-bottom-right'
  | 'corner-bottom-left'
  | 'scroll-end'
  | 'manual-only';

export interface WidgetCatalogEntry {
  id: string;
  name: string;
  description: string;
  position: WidgetPosition;
  configFields: WidgetFieldDef[];
}

// ── Preview stage kind ───────────────────────────────────────────────
//
// Maps every WidgetPosition onto one of 4 layouts the live preview
// (components/widgets/designer/WidgetPreview.tsx) knows how to draw a
// mock page around — see styles/widgets/preview/preview-stages.css for
// the actual CSS per kind. Derived from `position` rather than stored
// separately so a widget's preview and its real auto-mount behavior
// can never drift apart: whatever WidgetPosition a widget declares is
// automatically previewed the way it will actually appear.
export type PreviewStageKind = 'bar' | 'corner' | 'takeover' | 'inline';

export function previewStageKindFor(position: WidgetPosition): PreviewStageKind {
  switch (position) {
    case 'fixed-top':
    case 'fixed-bottom':
      return 'bar';
    case 'corner-bottom-left':
    case 'corner-bottom-right':
      return 'corner';
    case 'scroll-end':
      return 'takeover';
    case 'manual-only':
      return 'inline';
  }
}

export const WIDGET_CATALOG: WidgetCatalogEntry[] = [
  {
    id: 'support-chat',
    name: 'Support Chat',
    description: 'A lime AI chat bubble that expands into a full panel with timestamped bubbles, read ticks, and a typing indicator.',
    // Pinned to the bottom-left corner specifically (not the shared
    // bottom-right slot every other corner widget defaults to) so it
    // can't end up stacked behind/under another widget's launcher —
    // see sitevento.js's AUTO_MOUNT_CONTAINER_IDS: each corner is its
    // own independent fixed container, so support-chat gets a slot no
    // other catalog widget defaults into.
    position: 'corner-bottom-left',
    configFields: [
      { key: 'greeting', label: 'Agent name', type: 'text', default: 'Lime AI', maxLength: 40 },
      { key: 'heading', label: 'Heading', type: 'text', default: "We're here to help.", maxLength: 80 },
    ],
  },
  {
    id: 'email-capture',
    name: 'Email Capture',
    description: 'An indigo/purple full-screen email signup with a sticky header and bouncy entrance, shown once a visitor scrolls to the end of your page.',
    position: 'scroll-end',
    configFields: [
      { key: 'heading', label: 'Heading', type: 'text', default: 'Get 10% Off Your First Order', maxLength: 80 },
      { key: 'body', label: 'Body text', type: 'textarea', default: 'Join our newsletter for exclusive drops, early access, and insider-only discounts.', maxLength: 240 },
      { key: 'placeholder', label: 'Input placeholder', type: 'text', default: 'Enter your email address', maxLength: 60 },
      { key: 'buttonLabel', label: 'Button label', type: 'text', default: 'Subscribe', maxLength: 30 },
      { key: 'successText', label: 'Success message', type: 'text', default: 'Success! Check your email \u{1F389}', maxLength: 100 },
    ],
  },
  {
    id: 'countdown-bar',
    name: 'Countdown Timer (Cartoonic Bar)',
    description: 'A bolder two-row sticky countdown bar with a promo line and CTA button — same slot as Countdown Timer.',
    position: 'fixed-top',
    configFields: [
      { key: 'label', label: 'Label', type: 'text', default: 'Flash Sale: 50% Off Pro', maxLength: 60 },
      { key: 'endsAt', label: 'Ends at', type: 'datetime', default: '' },
      { key: 'buttonLabel', label: 'Button label', type: 'text', default: 'Claim Now', maxLength: 30 },
      { key: 'buttonUrl', label: 'Button link', type: 'url', default: '#' },
      { key: 'accent', label: 'Accent color', type: 'color', default: '#a3e635' },
    ],
  },
  {
    id: 'campaign-bar',
    name: 'Campaign & Announcement Bar',
    description: 'A general-purpose announcement bar covering launches, promos, alerts, and maintenance notices as swappable variants.',
    position: 'fixed-top',
    configFields: [
      {
        key: 'variant',
        label: 'Variant',
        type: 'select',
        default: 'launch',
        options: [
          { value: 'launch', label: 'Launch' },
          { value: 'promo', label: 'Promo' },
          { value: 'alert', label: 'Alert' },
          { value: 'maint', label: 'Maintenance' },
        ],
      },
      {
        key: 'position',
        label: 'Bar position',
        type: 'select',
        default: 'top',
        options: [
          { value: 'top', label: 'Top' },
          { value: 'bottom', label: 'Bottom' },
        ],
      },
      { key: 'text', label: 'Message', type: 'textarea', default: '', maxLength: 160, help: 'Leave blank to use the variant\u2019s default message.' },
      { key: 'endsAt', label: 'Countdown ends at (optional)', type: 'datetime', default: '', help: 'Leave blank to show no countdown.' },
      { key: 'buttonLabel', label: 'Button label', type: 'text', default: 'Learn more', maxLength: 30 },
      { key: 'buttonUrl', label: 'Button link', type: 'url', default: '#' },
    ],
  },
  {
    id: 'contact-us',
    name: 'Contact Us',
    description: 'A direct contact form — name, email, message — for visitors who want to reach a human rather than chat with AI.',
    position: 'corner-bottom-right',
    configFields: [
      { key: 'heading', label: 'Heading', type: 'text', default: 'Get in touch', maxLength: 60 },
      { key: 'subheading', label: 'Subheading', type: 'text', default: 'We typically reply within a day.', maxLength: 120 },
      { key: 'accent', label: 'Accent color', type: 'color', default: '#6fae3f' },
    ],
  },
  {
    id: 'visitor-pulse',
    name: 'Live Visitor Pulse',
    description: 'A quiet, dismissible corner badge showing honest, already-tracked view signals for this page.',
    position: 'corner-bottom-left',
    configFields: [
      { key: 'accent', label: 'Accent color', type: 'color', default: '#6fae3f' },
      {
        key: 'side',
        label: 'Which side of the screen',
        type: 'select',
        default: 'left',
        options: [
          { value: 'left', label: 'Bottom left' },
          { value: 'right', label: 'Bottom right' },
        ],
      },
    ],
  },
  {
    id: 'feedback-survey',
    name: 'Feedback & Satisfaction Survey',
    description: 'NPS, CSAT, or a short exit-intent survey from one widget, shown on the triggers you configure.',
    position: 'corner-bottom-right',
    configFields: [
      {
        key: 'surveyType',
        label: 'Survey type',
        type: 'select',
        default: 'nps',
        options: [
          { value: 'nps', label: 'NPS (0\u201310)' },
          { value: 'csat', label: 'CSAT (star rating)' },
          { value: 'exit', label: 'Exit-intent' },
        ],
      },
    ],
  },
  {
    id: 'appointment-booking',
    name: 'Appointment & Demo Booking',
    description: 'A multi-step flow \u2014 choose a service, pick a date/time, enter details \u2014 for booking a demo, consultation, or appointment.',
    position: 'corner-bottom-right',
    configFields: [
      { key: 'heading', label: 'Modal heading', type: 'text', default: 'Book a demo', maxLength: 60 },
      { key: 'launcherLabel', label: 'Launcher button label', type: 'text', default: '\u{1F4C5} Book a demo', maxLength: 40 },
    ],
  },
  {
    id: 'reviews-carousel',
    name: 'Reviews & Testimonials Carousel',
    description: 'An inline, manual-only carousel of reviews with star ratings, verified badges, and an aggregate rating line \u2014 place it directly in your page content.',
    position: 'manual-only',
    configFields: [
      { key: 'title', label: 'Section title', type: 'text', default: 'What customers say', maxLength: 60 },
      { key: 'aggRating', label: 'Aggregate rating', type: 'text', default: '4.8', maxLength: 10 },
      { key: 'aggCount', label: 'Number of reviews', type: 'text', default: '212', maxLength: 10 },
      { key: 'sourceLine', label: 'Source / sync line', type: 'text', default: 'Reviews imported from your connected review source \u00B7 last synced 2h ago', maxLength: 120 },
    ],
  },
  {
    id: 'faq-page',
    name: 'FAQ Page',
    description: 'A full-screen, on-brand FAQ overlay with a sticky header and accordion questions \u2014 write your own questions, or describe your business and let AI draft them from your site\u2019s own details.',
    // Small corner launcher by default, same pattern as Appointment
    // Booking and Contact Us \u2014 opens a full-screen overlay rather
    // than taking up page space until a visitor actually wants it.
    position: 'corner-bottom-right',
    configFields: [
      { key: 'launcherLabel', label: 'Launcher button label', type: 'text', default: '\u2753 FAQ', maxLength: 40 },
      { key: 'heading', label: 'Header title', type: 'text', default: 'FAQ', maxLength: 60, help: 'Shown next to your logo on the left of the sticky header. Defaults to \u201cFAQ\u201d \u2014 edit it to your business name.' },
      { key: 'logoUrl', label: 'Logo (optional)', type: 'url', default: '', help: 'A small square image shown to the left of the header title.' },
      { key: 'accent', label: 'Accent color', type: 'color', default: '#6fae3f' },
      {
        key: 'businessDescription',
        label: 'Describe your business (used only to help AI write your FAQs)',
        type: 'textarea',
        default: '',
        maxLength: 600,
        help: 'Not shown to visitors \u2014 just context for the AI question generator below.',
      },
      { key: 'faqs', label: 'Questions & answers', type: 'faqList', default: DEFAULT_FAQS },
    ],
  },
  {
    id: 'spin-reward',
    name: 'Daily Spin Reward',
    description: 'A closeable "Spin & save" tab that opens a prize wheel \u2014 one real spin per visitor per day, with honest, on-screen odds.',
    position: 'corner-bottom-right',
    configFields: [
      { key: 'prizes', label: 'Prizes', type: 'prizeList', default: DEFAULT_PRIZES },
      {
        key: 'oddsLine',
        label: 'Odds line (optional override)',
        type: 'text',
        default: '',
        maxLength: 140,
        help: 'Leave blank to generate this automatically from your prize odds.',
      },
    ],
  },
];

export function getWidgetCatalogEntry(id: string): WidgetCatalogEntry | undefined {
  return WIDGET_CATALOG.find((w) => w.id === id);
}

// ── Self-healing global catalog ──────────────────────────────────────
//
// widgets/{id} (the GLOBAL "is this widget live at all" doc read by
// app/api/widget/route.ts and app/api/site-widgets/route.ts) used to
// only ever get created by manually running
// `node scripts/manage-widget.mjs seed-catalog`. That script was never
// run against this deployment, so every widget — including
// support-chat — silently never rendered: WidgetConfigPanel told the
// owner "Visitors see this widget now," app/api/site-widget/route.ts's
// checkLiveStatus correctly reported `saved_but_blocked` with "not yet
// in the global catalog," but nothing ever surfaced that as a loud
// failure, so it went unnoticed.
//
// Fix: every WIDGET_CATALOG entry has a known, derivable shape for its
// global doc (bundleUrl is always `${origin}/w/${id}` on THIS
// deployment — see app/w/[widgetId]/ — never a third-party CDN), so
// there's no real reason this ever needs a human to type it in by
// hand. expectedCatalogDoc() is that derivation, shared by both
// /api/widget and /api/site-widgets so each one self-heals (create the
// doc if it's missing, same shape the seed script used to write) the
// first time any shipped widget is actually requested, instead of
// rejecting forever until someone remembers to run a CLI command.
// Still only applies to IDs that exist in WIDGET_CATALOG — this can't
// be used to inject an arbitrary widgetId into the catalog.
export interface ExpectedCatalogDoc {
  name: string;
  type: WidgetType;
  enabled: boolean;
  version: number;
  bundleUrl: string;
}

export function expectedCatalogDoc(id: string, origin: string): ExpectedCatalogDoc | null {
  const entry = getWidgetCatalogEntry(id);
  if (!entry) return null;
  return {
    name: entry.name,
    type: 'iframe',
    enabled: true,
    version: 1,
    bundleUrl: `${origin.replace(/\/$/, '')}/w/${id}`,
  };
}

// ── Universal branding fields ────────────────────────────────────────
//
// Applied to EVERY widget in the catalog (not per-entry), since the
// designer page is shared by 100+ widgets and branding/labeling needs
// to work identically across all of them rather than being hand-added
// per widget. Rendered in the designer's own "Branding" section, ahead
// of a widget's own configFields.
//
//   widgetLabel     — shown at the top of the widget itself on the
//                      live site, so an owner running several widgets
//                      can tell them apart at a glance. Free on every
//                      plan.
//   brandMode       — whether the widget footer/header shows nothing,
//                      the account's own text, or (premium only) an
//                      uploaded logo image in place of that text.
//   brandText       — the custom text shown when brandMode === 'text'.
//                      Available on every plan.
//   brandLogoUrl    — the uploaded logo shown when brandMode ===
//                      'logo'. Gated by Plan.limits.customLogoBranding
//                      (lib/plans.ts) — the designer UI (see
//                      WidgetDesigner.tsx) leaves the 'logo' option out
//                      of the dropdown for plans without it and shows
//                      an upgrade pill in its place, so the option is
//                      still discoverable rather than silently absent.
export const UNIVERSAL_CONFIG_FIELDS: WidgetFieldDef[] = [
  { key: 'widgetLabel', label: 'Widget name', type: 'text', default: '', maxLength: 40 },
  {
    key: 'brandMode',
    label: 'Show on widget',
    type: 'select',
    default: 'none',
    options: [
      { value: 'none', label: 'Nothing' },
      { value: 'text', label: 'Custom text' },
      { value: 'logo', label: 'Custom logo (premium)' },
    ],
  },
  { key: 'brandText', label: 'Custom text', type: 'text', default: '', maxLength: 60 },
  { key: 'brandLogoUrl', label: 'Custom logo', type: 'url', default: '' },
];

export function defaultConfigFor(id: string): Record<string, unknown> {
  const entry = getWidgetCatalogEntry(id);
  if (!entry) return {};
  const out: Record<string, unknown> = {};
  for (const f of entry.configFields) out[f.key] = f.default;
  for (const f of UNIVERSAL_CONFIG_FIELDS) out[f.key] = f.default;
  return out;
}

// ── Admin: catalog status + custom (user-uploaded) widgets ───────────
//
// Every entry here is "built-in": one of WIDGET_CATALOG's ids
// (support-chat, countdown-timer). Its rendering code ships in this
// repo under app/w/[widgetId]/widgets/*.tsx. Deleting its catalog doc
// doesn't remove that code — the self-heal in app/api/widget recreates
// the doc the next time it's requested, same as before this admin UI
// existed; "Delete" in the admin table is a forced re-push, not a
// permanent removal.
//
// (There is deliberately no concept of an uploaded/custom widget here —
// every widget's code lives in this repo, reviewed and deployed the
// normal way, not accepted as runtime input.)
export interface AdminWidgetStatus {
  id: string;
  name: string;
  source: 'built-in';
  pushed: boolean; // does widgets/{id} exist in Firestore right now
  enabled: boolean | null; // null when not pushed (no doc to read)
  version: number | null;
  bundleUrl: string | null;
}
