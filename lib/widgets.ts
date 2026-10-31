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
  | 'WRITE_LIMIT_REACHED'
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
  WRITE_LIMIT_REACHED: 200,
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
  WRITE_LIMIT_REACHED: "This site's daily limit has been reached. The owner can upgrade or wait until it resets at UTC midnight.",
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

// Previous 11 widgets were retired to be rebuilt from scratch as
// premium widgets, one at a time. Every consumer (WidgetsPageClient,
// WidgetDesigner, the admin tools, the seed/catalog API routes) reads
// this array generically, so adding an entry here is all it takes for
// it to show up everywhere (the /widgets picker page, the designer,
// the admin status table) with zero other changes.
//
// support-chat is the first one rebuilt. It's a full-screen (see
// 'scroll-end'... actually rendered as a manual/fixed full takeover by
// its own component, not auto-mounted inline) AI support chat. Unlike
// the old version, every site's chat is grounded in what THAT site is
// actually about via `siteContext` below — a free-text field the
// owner fills in once ("We sell handmade candles", "Personal blog
// about hiking", "B2B SaaS for dentists") — so the same widget code
// gives accurate, on-topic answers whether the site is a shop, a
// blog, or anything else, instead of one generic prompt for every
// site. See lib/aiReply.ts (buildSystemPrompt) and
// app/api/chat/route.ts for how this is read and folded into the
// model's system prompt alongside any FAQ widget content.
export const WIDGET_CATALOG: WidgetCatalogEntry[] = [
  {
    id: 'support-chat',
    name: 'Support Chat',
    description: 'A full-screen AI chat assistant that answers visitor questions using what you tell it about your site.',
    // Floating launcher bottom-right, opening into a full-screen
    // takeover — not one of the simpler bar/corner positions, since
    // the open state is a full app, not a small embedded element.
    // 'corner-bottom-right' drives the closed-state FAB placement;
    // the widget's own component renders the full-screen overlay
    // itself once opened (same pattern note as WidgetPosition's doc
    // comment for 'scroll-end').
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
    // paid-plan feature — Free stays on the time-based trigger only.
    // Checked both client-side (WidgetDesigner.tsx hides the option
    // and EmailCaptureWidget.tsx falls back to time-based if a stale
    // config somehow still has 'visits' saved on a now-downgraded
    // account) and server-side (app/api/email-capture/route.ts has no
    // enforcement to do here since the trigger never touches the
    // server — it's a pure client-side localStorage visit counter,
    // same as the existing dismissed-flag — but the DESIGNER save
    // path still re-validates this so a raw API call can't persist
    // 'visits' onto a Free site's config either).
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
        // out of the dropdown entirely for Free (same pattern as
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
// declared min/max, and silently fall a Free account's triggerType
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
