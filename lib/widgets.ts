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

import type { PlanId } from './plans';
import { planAtLeast } from './limits';

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
  | 'TOKEN_LIMIT_REACHED'
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
  // Always 200, not 429 — this is a loader-facing "stop rendering"
  // signal (like every other widgetErrorBody shape), and the plain
  // `success: false` contract the loader already reads is enough.
  // Matching pausedWidgetResponse's "don't throw a hard HTTP error
  // across the iframe/XHR boundary into a third-party page" contract.
  TOKEN_LIMIT_REACHED: 200,
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
  TOKEN_LIMIT_REACHED: "This site's daily limit has been reached. The owner can upgrade or wait until it resets at UTC midnight.",
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
  // 'number' fields only — inclusive bounds enforced both in the
  // designer input (min/max attrs) and server-side wherever the
  // config is consumed, so a value can't be saved or read as
  // something the UI itself would never have allowed.
  min?: number;
  max?: number;
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
  { label: 'Ventol Free shipping', code: 'SHIPFREE', weight: 33 },
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

// Previous 11 widgets were retired to be rebuilt from scratch as
// premium widgets, one at a time. Every consumer (WidgetsPageClient,
// WidgetDesigner, the admin tools, the seed/catalog API routes) reads
// this array generically, so adding an entry here is all it takes for
// it to show up everywhere (the /widgets picker page, the designer,
// the admin status table) with zero other changes.
//
// support-chat is the first one rebuilt. It's an AI support chat that
// opens as a floating bottom-right card (never a full-screen
// takeover) — fully self-positioned by its own component
// (SupportChatWidget.tsx), same "always full-viewport, transparent
// frame" approach as EmailCaptureWidget. Unlike the old version,
// every site's chat is grounded in what THAT site is
// actually about via `siteContext` below — a free-text field the
// owner fills in once ("We sell handmade candles", "Personal blog
// about hiking", "B2B SaaS for dentists") — so the same widget code
// gives accurate, on-topic answers whether the site is a shop, a
// blog, or anything else, instead of one generic prompt for every
// site. See lib/aiReply.ts (buildSystemPrompt) and
// app/api/chat/route.ts for how this is read and folded into the
// model's system prompt alongside any FAQ widget content.
// ── Booking widget: services + opening hours ────────────────────────
//
// Same storage shape idea as Prize/FaqItem above: plain JSON stored in
// config.services / config.openHours, typed in by hand in the
// designer (or, later, generated the same way faqs can be), read via
// servicesFromConfig()/openHoursFromConfig() with a safe fallback to
// the defaults below if the stored value is missing or malformed.
export interface BookingService {
  name: string;
  // Price in the site's smallest *display* unit as a plain number
  // (e.g. 45 means "$45", not cents) — this widget only ever shows a
  // human price, never handles real payment/currency precision. 0
  // means "no price set" and the widget shows no per-service price
  // and a $0 total rather than inventing one.
  price: number;
  // Optional unit label shown after the price, e.g. "/hr", "/session".
  // Blank means a flat one-time price with no suffix.
  priceUnit?: string;
}

export const DEFAULT_BOOKING_SERVICES: BookingService[] = [
  { name: 'General consultation', price: 0, priceUnit: '' },
];

export function isBookingServiceList(v: unknown): v is BookingService[] {
  return (
    Array.isArray(v) &&
    v.length > 0 &&
    v.every(
      (s) =>
        s &&
        typeof s === 'object' &&
        typeof (s as BookingService).name === 'string' &&
        typeof (s as BookingService).price === 'number' &&
        Number.isFinite((s as BookingService).price)
    )
  );
}

// Accepts either a real array (already-parsed config) or a JSON
// string (how it's stored in configFields' default / a raw Firestore
// value written by an older save path) — same tolerant-parse shape as
// every other list-shaped widget config field here.
export function servicesFromConfig(config: Record<string, unknown>): BookingService[] {
  const raw = config.services;
  const parsed = typeof raw === 'string' ? safeJsonParse(raw) : raw;
  return isBookingServiceList(parsed) && parsed.length > 0 ? parsed : DEFAULT_BOOKING_SERVICES;
}

export type DayOfWeek = 'mon' | 'tue' | 'wed' | 'thu' | 'fri' | 'sat' | 'sun';

export const DAYS_OF_WEEK: DayOfWeek[] = ['mon', 'tue', 'wed', 'thu', 'fri', 'sat', 'sun'];

export interface DayHours {
  // When closed is true, open/close are ignored entirely — the widget
  // never shows a stray time range for a day marked closed, and never
  // lets a malformed open>=close pair on an "open" day render as if it
  // were meaningful (see openHoursFromConfig's own validation).
  closed: boolean;
  // 24h "HH:MM" strings, e.g. "09:00" / "17:30".
  open: string;
  close: string;
}

const DEFAULT_DAY_HOURS: DayHours = { closed: false, open: '09:00', close: '17:00' };
const DEFAULT_WEEKEND_HOURS: DayHours = { closed: true, open: '09:00', close: '17:00' };

export const DEFAULT_OPEN_HOURS: Record<DayOfWeek, DayHours> = {
  mon: { ...DEFAULT_DAY_HOURS },
  tue: { ...DEFAULT_DAY_HOURS },
  wed: { ...DEFAULT_DAY_HOURS },
  thu: { ...DEFAULT_DAY_HOURS },
  fri: { ...DEFAULT_DAY_HOURS },
  sat: { ...DEFAULT_WEEKEND_HOURS },
  sun: { ...DEFAULT_WEEKEND_HOURS },
};

const TIME_RE = /^([01]\d|2[0-3]):([0-5]\d)$/;

function isValidDayHours(v: unknown): v is DayHours {
  if (!v || typeof v !== 'object') return false;
  const d = v as DayHours;
  if (typeof d.closed !== 'boolean') return false;
  if (d.closed) return true; // open/close irrelevant when closed
  return typeof d.open === 'string' && typeof d.close === 'string' && TIME_RE.test(d.open) && TIME_RE.test(d.close) && d.open < d.close;
}

function safeJsonParse(s: string): unknown {
  try {
    return JSON.parse(s);
  } catch {
    return null;
  }
}

// Validates every day independently — a malformed/missing single day
// (e.g. hand-edited JSON with a typo in one key) falls back to that
// ONE day's own default rather than discarding the whole week, so one
// bad field can't silently blank out hours the owner correctly set for
// every other day.
export function openHoursFromConfig(config: Record<string, unknown>): Record<DayOfWeek, DayHours> {
  const raw = config.openHours;
  const parsed = (typeof raw === 'string' ? safeJsonParse(raw) : raw) as Partial<Record<DayOfWeek, DayHours>> | null;
  const out = {} as Record<DayOfWeek, DayHours>;
  for (const day of DAYS_OF_WEEK) {
    const candidate = parsed && typeof parsed === 'object' ? parsed[day] : null;
    out[day] = isValidDayHours(candidate) ? (candidate as DayHours) : DEFAULT_OPEN_HOURS[day];
  }
  return out;
}

export const WIDGET_CATALOG: WidgetCatalogEntry[] = [
  {
    id: 'support-chat',
    name: 'Support Chat',
    description: 'A floating AI chat assistant that answers visitor questions using what you tell it about your site.',
    // Floating launcher bottom-right, opening into a floating card
    // anchored to that same corner — never a full-screen takeover.
    // 'corner-bottom-right' drives this widget's immediate mount (same
    // as any other corner widget); its own component then renders
    // entirely self-positioned (launcher bubble, then card) rather
    // than relying on sitevento.js to size a collapsed vs. open state
    // — see ALWAYS_FULLSCREEN_WIDGET_IDS in sitevento.js.
    position: 'corner-bottom-right',
    configFields: [
      {
        key: 'greeting',
        label: 'Welcome message',
        type: 'text',
        default: 'How can we help?',
        maxLength: 80,
        help: 'Shown at the top of the chat before a visitor sends their first message.',
      },
      {
        key: 'siteContext',
        label: 'What is your site about?',
        type: 'textarea',
        default: '',
        maxLength: 1000,
        placeholder: 'e.g. We sell handmade candles and ship worldwide. Orders take 2-3 days to process...',
        help: 'Tell the AI what your business or site is so it can answer visitor questions accurately — whether you run a shop, a blog, a service, or anything else. The more specific, the better the answers.',
      },
      {
        key: 'accentColor',
        label: 'Accent colour',
        type: 'color',
        default: '#a3e635',
        help: "Matches your site's colors: the launcher bubble, header, your own chat bubbles, and the send button. Defaults to Sitevento's signature lime.",
      },
    ],
  },
  {
    // Visit-based triggering (config.triggerType === 'visits') is a
    // paid-plan feature — Ventol Free stays on the time-based trigger only.
    // Checked both client-side (WidgetDesigner.tsx hides the option
    // and EmailCaptureWidget.tsx falls back to time-based if a stale
    // config somehow still has 'visits' saved on a now-downgraded
    // account) and server-side: the DESIGNER save path re-validates
    // this so a raw API call can't persist 'visits' onto a Ventol Free site's
    // config. The visit count the trigger actually compares against
    // visitThreshold does now come from the server when available
    // (app/api/track's own emailCapture.visitCount, read back via
    // EmailCaptureWidget.tsx's emailCapture prop — see that
    // component's header) rather than only a client-side localStorage
    // counter, but that's an accuracy improvement to an already-
    // allowed trigger, not a plan gate — plan enforcement for WHETHER
    // 'visits' mode is allowed at all still lives solely in the two
    // places above.
    id: 'email-capture',
    name: 'Email Capture',
    description: 'A time-driven popup that asks visitors for their email, with no manual trigger needed.',
    // Opens itself on a timer and is dismissed for good (per visitor)
    // once closed or submitted — see EmailCaptureWidget.tsx's header
    // comment. 'scroll-end' is the closest existing position (a
    // full-takeover-style popup rather than an always-present bar or
    // corner element), even though the actual trigger here is time,
    // not scroll position — there's no dedicated WidgetPosition for
    // "appears once on a timer" yet, and this is visually/structurally
    // the same kind of moment (centered overlay, not a persistent
    // page element) as the other scroll-end widget.
    position: 'scroll-end',
    configFields: [
      {
        key: 'heading',
        label: 'Heading',
        type: 'text',
        default: "Don't miss what's next",
        maxLength: 60,
        help: 'The bold line at the top of the popup.',
      },
      {
        key: 'subtext',
        label: 'Subtext',
        type: 'textarea',
        default: "Drop your email and we'll send new posts straight to your inbox — no spam, unsubscribe any time.",
        maxLength: 200,
        help: 'One or two short sentences under the heading explaining what signing up gets them.',
      },
      {
        key: 'buttonLabel',
        label: 'Button text',
        type: 'text',
        default: 'Notify me',
        maxLength: 30,
      },
      {
        // Which signal opens the popup. 'time' (the original and only
        // behavior) is on every plan; 'visits' is paid-plan-only — see
        // EMAIL_CAPTURE_MIN_PAID_PLAN below and WidgetDesigner.tsx's
        // handling of this field, which filters the 'visits' option
        // out of the dropdown entirely for Ventol Free (same pattern as
        // UNIVERSAL_CONFIG_FIELDS' brandMode/'logo' gating) rather than
        // letting it be picked and then silently not working.
        key: 'triggerType',
        label: 'Show popup based on',
        type: 'select',
        default: 'time',
        options: [
          { value: 'time', label: 'Time on page' },
          { value: 'visits', label: 'Return visits (premium)' },
        ],
        help: 'Choose whether the popup opens after a delay, or once a visitor has been to the site a number of times.',
      },
      {
        key: 'delaySeconds',
        label: 'Delay before showing (seconds)',
        type: 'number',
        default: 4,
        min: 1,
        max: 3600,
        help: 'How long a visitor is on the page before the popup appears (1 second to 1 hour). Only used when "Show popup based on" is set to Time on page. It only ever shows once per visitor — see "Never shows twice" below.',
      },
      {
        key: 'visitThreshold',
        label: 'Show on visit number',
        type: 'number',
        default: 3,
        min: 2,
        max: 100,
        help: 'The popup opens the moment a visitor reaches this many visits to the site (their first visit counts as 1). Only used when "Show popup based on" is set to Return visits. Premium plans only.',
      },
      {
        key: 'accentColor',
        label: 'Accent colour',
        type: 'color',
        default: '#a3e635',
        help: "Matches your site's colors: the badge, button, and input focus ring. Defaults to Sitevento's signature lime.",
      },
    ],
  },
  {
    // A slim bar pinned to the very top of the page — heading/message
    // on the left, a CTA button on the right, closeable (and then
    // permanently dismissed for that visitor, same per-site-keyed
    // localStorage pattern as every other widget's dismissal — see
    // AnnouncementBarWidget.tsx). 'fixed-top' is the one WidgetPosition
    // that's actually built for this (sticky bar at the top of the
    // viewport), unlike email-capture's 'scroll-end' borrow — so this
    // is the first widget to use it since sitevento.js's
    // AUTO_MOUNT_CONTAINER_IDS/mountAutoStyles added the container for
    // it. See AnnouncementBarWidget.tsx's header comment for the
    // self-sizing iframe approach (ANNOUNCEMENT_BAR_WIDGET_ID in
    // sitevento.js) — a slim bar needs a real but small fixed height,
    // not the 480px fallback every other non-fullscreen widget gets,
    // and not a full-viewport frame either (that's for overlay/corner
    // widgets that need to cover the whole screen while collapsed).
    id: 'announcement-bar',
    name: 'Announcement Bar',
    description: 'A bar across the top of your site with a message and a call-to-action button — great for sales, launches, or updates.',
    position: 'fixed-top',
    configFields: [
      {
        key: 'heading',
        label: 'Message',
        type: 'text',
        default: 'Ventol Free shipping on orders over $50 — this week only.',
        maxLength: 140,
        help: 'The text shown on the left side of the bar.',
      },
      {
        key: 'ctaLabel',
        label: 'Button text',
        type: 'text',
        default: 'Shop now',
        maxLength: 30,
        help: 'Leave blank to show the bar as a plain message with no button.',
      },
      {
        key: 'ctaUrl',
        label: 'Button link',
        type: 'url',
        default: '',
        help: 'Where the button sends visitors. Opens in the same tab.',
      },
      {
        key: 'backgroundColor',
        label: 'Background colour',
        type: 'color',
        default: '#1a2e05',
        help: "The bar's background. Defaults to a near-black so light text reads well on it.",
      },
      {
        key: 'textColor',
        label: 'Text colour',
        type: 'color',
        default: '#f4ffe8',
        help: 'The message, button text, and close icon all use this colour.',
      },
      {
        key: 'buttonColor',
        label: 'Button colour',
        type: 'color',
        default: '#a3e635',
        help: "The CTA button's own background — kept separate from the bar's background/text so it can stand out against either.",
      },
    ],
  },
  {
    // Button-based booking/inquiry widget: a floating launcher (like
    // support-chat) that expands into a full-screen modal form on
    // open — see EXPANDABLE_WIDGET_IDS in public/sitevento.js, which
    // already had this widget's id reserved for exactly this
    // open/close postMessage contract. Deliberately NOT a calendar/
    // time-slot picker — no date or time-of-day is ever collected
    // from the visitor. 'openHours' is purely DISPLAY data (so
    // visitors can see when the business is actually open before
    // requesting) and never gates whether the form can be submitted;
    // the widget always ends with the same "Submitted — we'll be in
    // touch soon" confirmation regardless of current time.
    //
    // 'corner-bottom-right' is the default auto-mount position, same
    // as support-chat/email-capture; the owner's saved `side` field
    // (handled generically by sitevento.js's autoMountWidgets, same
    // as every other corner widget) lets them flip it to the opposite
    // corner, and 'manual-only' placement (a hand-placed
    // `<div data-sitevento-widget="appointment-booking">`) lets them
    // put the trigger anywhere else in their own markup instead of a
    // floating corner button — see BookingWidget.tsx's own header
    // comment for how a custom trigger element is picked up.
    id: 'appointment-booking',
    name: 'Booking Request',
    description:
      'A floating "Book now" button that opens a full-screen request form — services, pricing, and your real opening hours, no calendar required.',
    position: 'corner-bottom-right',
    configFields: [
      {
        key: 'heading',
        label: 'Form heading',
        type: 'text',
        default: 'Book an appointment',
        maxLength: 60,
      },
      {
        key: 'subtext',
        label: 'Form subtext',
        type: 'textarea',
        default: 'Tell us a bit about what you need and we’ll get back to you to confirm a time.',
        maxLength: 240,
        help: 'Shown under the heading, above the form fields.',
      },
      {
        key: 'launcherLabel',
        label: 'Launcher button text',
        type: 'text',
        default: 'Book now',
        maxLength: 30,
      },
      {
        key: 'side',
        label: 'Launcher side',
        type: 'select',
        default: 'right',
        options: [
          { value: 'right', label: 'Bottom right' },
          { value: 'left', label: 'Bottom left' },
        ],
        help: 'Which corner the floating button appears in. Ignored if you place the widget manually with your own button or div.',
      },
      {
        // Stored as JSON text rather than a dedicated field type (no
        // 'serviceList' WidgetFieldType exists yet, same reasoning as
        // Prize/FaqItem originally would have had before those got
        // their own types) — BookingWidget.tsx owns parsing/validating
        // this via servicesFromConfig() below, with the same
        // malformed-falls-back-to-default contract as
        // prizesFromConfig/faqsFromConfig.
        key: 'services',
        label: 'Services offered',
        type: 'textarea',
        default: JSON.stringify(DEFAULT_BOOKING_SERVICES),
        help: 'What a visitor can request, and what each one costs (leave price at 0 to show no price). Edited as a list in the designer, stored as structured data.',
      },
      {
        key: 'openHours',
        label: 'Opening hours',
        type: 'textarea',
        default: JSON.stringify(DEFAULT_OPEN_HOURS),
        help: 'Your real hours, shown on the form so visitors know when you’re actually open. Display only — it never blocks a submission.',
      },
      {
        key: 'contactMode',
        label: 'Visitor contact method',
        type: 'select',
        default: 'both',
        options: [
          { value: 'email', label: 'Email only' },
          { value: 'phone', label: 'Phone only' },
          { value: 'both', label: 'Let visitor choose email, phone, or both' },
        ],
        help: 'Which contact fields the form asks for. "Let visitor choose" still requires at least one of the two to be filled in and valid.',
      },
      {
        key: 'currency',
        label: 'Currency symbol',
        type: 'text',
        default: '$',
        maxLength: 3,
        help: 'Shown before every price and the total (e.g. $, €, £).',
      },
      {
        key: 'accentColor',
        label: 'Accent colour',
        type: 'color',
        default: '#a3e635',
        help: 'The launcher button, selected-service highlight, and submit button. Defaults to Sitevento’s signature lime.',
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

// NOTE: getCachedWidgetDoc (Firestore-backed) moved to lib/widgets-admin.ts.
// This file must stay free of any 'firebase-admin' import — it's imported
// by client components (e.g. WidgetsPageClient.tsx) for WIDGET_CATALOG and
// friends, and pulling firebase-admin (and therefore Node core modules
// like 'fs'/'net') into that bundle breaks the client/browser webpack
// build. Anything that needs the Admin SDK belongs in widgets-admin.ts
// instead, which only server code (API routes) should import.

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
//                      can tell them apart at a glance. Ventol Free on every
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

// ── Email Capture: visit-based trigger plan gate ─────────────────────
//
// Single source of truth for which plans may use triggerType:'visits'
// on the email-capture widget — mirrors Plan.limits.customLogoBranding's
// role for brandMode:'logo' (lib/plans.ts), except this isn't a
// per-plan boolean on PlanLimits because it's specific to one widget's
// one config field rather than an account-wide capability, so it lives
// here next to the widget definition instead.
export const EMAIL_CAPTURE_VISIT_TRIGGER_MIN_PLAN: PlanId = 'starter';

export function canUseVisitBasedTrigger(planId: PlanId): boolean {
  return planAtLeast(planId, EMAIL_CAPTURE_VISIT_TRIGGER_MIN_PLAN);
}

// Clamp a config's delaySeconds/visitThreshold to the catalog's
// declared min/max, and silently fall a Ventol Free account's triggerType
// back to 'time' if it's somehow 'visits' (downgrade, direct API
// write, stale data) — called wherever a saved email-capture config is
// actually consumed (the designer's save path, and the live widget
// route) rather than trusted as-is from Firestore.
export function sanitizeEmailCaptureConfig(
  config: Record<string, unknown>,
  planId: PlanId
): Record<string, unknown> {
  const entry = getWidgetCatalogEntry('email-capture');
  if (!entry) return config;
  const out = { ...config };

  const delayField = entry.configFields.find((f) => f.key === 'delaySeconds');
  if (delayField) {
    const raw = typeof out.delaySeconds === 'number' ? out.delaySeconds : Number(delayField.default);
    out.delaySeconds = Math.min(Math.max(raw, delayField.min ?? raw), delayField.max ?? raw);
  }

  const visitField = entry.configFields.find((f) => f.key === 'visitThreshold');
  if (visitField) {
    const raw = typeof out.visitThreshold === 'number' ? out.visitThreshold : Number(visitField.default);
    out.visitThreshold = Math.min(Math.max(raw, visitField.min ?? raw), visitField.max ?? raw);
  }

  if (out.triggerType === 'visits' && !canUseVisitBasedTrigger(planId)) {
    out.triggerType = 'time';
  }

  return out;
}

// Widget config keys that represent "the" brand accent for that
// widget, as opposed to a field that happens to also be type:'color'
// but is one of several deliberately-contrasted colors on the same
// widget (e.g. announcement-bar's backgroundColor/textColor/
// buttonColor trio — see that widget's own comments on why those stay
// independent). Only keys in this set are eligible to be overridden by
// a detected site theme; every other color field keeps its catalog
// default regardless of what's on `siteTheme`.
const SITE_THEME_OVERRIDABLE_KEYS = new Set(['accentColor']);

/**
 * @param siteTheme Optional — lib/siteTheme.ts's detectSiteTheme()
 *   result, read off the site's own Firestore doc (Site.siteTheme,
 *   set at verify time by app/api/verify-site/route.ts). When present
 *   and it found a usable primaryColor, that color becomes the
 *   starting default for this widget's brand-accent field(s) — see
 *   SITE_THEME_OVERRIDABLE_KEYS — instead of Sitevento's own lime.
 *   This only changes what a BRAND NEW (never-configured) widget
 *   starts with; once an owner has set their own accentColor (or
 *   accepted/edited the suggested one and saved), that saved value
 *   always wins here, since this function is only ever used to fill in
 *   what's missing from an existing config (see every call site: it's
 *   always the base of a `{ ...defaultConfigFor(...), ...existing }`
 *   spread, never applied on top of real data).
 */
export function defaultConfigFor(id: string, siteTheme?: { primaryColor: string | null } | null): Record<string, unknown> {
  const entry = getWidgetCatalogEntry(id);
  if (!entry) return {};
  const out: Record<string, unknown> = {};
  const suggestedAccent = siteTheme?.primaryColor || null;
  for (const f of entry.configFields) {
    out[f.key] = f.type === 'color' && suggestedAccent && SITE_THEME_OVERRIDABLE_KEYS.has(f.key) ? suggestedAccent : f.default;
  }
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
