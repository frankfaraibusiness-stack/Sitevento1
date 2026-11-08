// lib/siteAlert.ts
//
// Shared types, template presets, and sanitising helpers for sitevento's
// live site banner ("overlay"). Used by three consumers, deliberately
// kept in this one file so they can never drift apart:
//
//   1. hooks/useOverlayComposer.ts         (editor state + push/stop)
//   2. components/site-alert/SiteAlertPageClient.tsx + BannerCard.tsx (editor UI + live preview)
//   3. public/sitevento.js                  (what visitors actually see —
//      the plain-JS renderer there is a hand-written mirror of the theme/
//      template shape below, since it ships to arbitrary third-party
//      pages and can't import a TS module)
//
// Storage: unchanged from before — the payload is written to the owner's
// own `users/{uid}/sites/{siteId}` doc (field `overlay`) AND mirrored to
// the public `siteOverlay/{siteId}` doc that the tracking script listens
// on. This file only changes the SHAPE of that payload, not where it
// lives, so existing Firestore documents / security rules keep working.
// A doc saved under the old minimal shape (`{ active, type, display,
// text, bgColor, textColor, updatedAt }`) is coerced by
// sanitizeSiteOverlay() below, same never-throws contract as before.

export type OverlayTemplateId =
  | 'announcement'
  | 'maintenance'
  | 'sale'
  | 'update'
  | 'celebrate'
  | 'custom';

// Small inline-SVG scenes drawn above the title, tinted via currentColor
// (see BANNER_ART in BannerCard.tsx). "none" renders nothing.
export type OverlayArt = 'megaphone' | 'wrench' | 'tag' | 'spark' | 'confetti' | 'bell' | 'none';

export type OverlayDisplay = 'fullscreen' | 'popup';

export interface OverlayTheme {
  bgFrom: string;
  bgTo: string;
  accent: string;
  accentText: string;
  titleColor: string;
  textColor: string;
  card: 'glass' | 'solid';
}

export interface SiteOverlayDoc {
  active: boolean;
  template: OverlayTemplateId;
  art: OverlayArt;
  display: OverlayDisplay;
  badge: string;
  title: string;
  description: string;
  ctaLabel: string;
  ctaUrl: string;
  closable: boolean;
  // Only meaningful when closable: true.
  //   "once"  -> stays closed for that visitor (per browser) until a new
  //              version is pushed.
  //   "every" -> comes back on every page load / refresh.
  reshow: 'once' | 'every';
  // Only meaningful when closable: false. Offers a "Notify me" control
  // that collects the visitor's email (no auth system on visitor sites,
  // so this is a plain email capture into the existing `leads`
  // subcollection) instead of leaving a locked visitor with nothing to
  // do.
  notifyOnClose: boolean;
  theme: OverlayTheme;
  // Bumped on every push. Drives "closed until a new version" logic and
  // keeps engagement stats scoped to the push that's currently live.
  version: number;
  updatedAt: number | { toDate: () => Date } | null;
}

export const OVERLAY_LIMITS = {
  badge: 40,
  title: 90,
  description: 400,
  ctaLabel: 30,
  ctaUrl: 300,
} as const;

export interface OverlayTemplate {
  id: OverlayTemplateId;
  label: string;
  blurb: string;
  art: OverlayArt;
  display: OverlayDisplay;
  badge: string;
  title: string;
  description: string;
  ctaLabel: string;
  closable: boolean;
  reshow: 'once' | 'every';
  theme: OverlayTheme;
}

export const OVERLAY_TEMPLATES: OverlayTemplate[] = [
  {
    id: 'announcement',
    label: 'Announcement',
    blurb: 'General news for every visitor',
    art: 'megaphone',
    display: 'fullscreen',
    badge: "What's new",
    title: 'We have something to share',
    description: 'A quick update for everyone visiting right now.',
    ctaLabel: '',
    closable: true,
    reshow: 'once',
    theme: {
      bgFrom: '#0d1b3d',
      bgTo: '#04070f',
      accent: '#60a5fa',
      accentText: '#04101f',
      titleColor: '#eef5ff',
      textColor: 'rgba(238,245,255,0.76)',
      card: 'glass',
    },
  },
  {
    id: 'maintenance',
    label: 'Maintenance',
    blurb: "Something's being worked on",
    art: 'wrench',
    display: 'fullscreen',
    badge: 'Maintenance',
    title: "We're making some changes",
    description:
      "We're performing scheduled maintenance. Things should be back to normal shortly — thanks for your patience.",
    ctaLabel: '',
    closable: false,
    reshow: 'every',
    theme: {
      bgFrom: '#1a1206',
      bgTo: '#0a0703',
      accent: '#f59e0b',
      accentText: '#1a1206',
      titleColor: '#fff7e6',
      textColor: 'rgba(255,247,230,0.74)',
      card: 'glass',
    },
  },
  {
    id: 'sale',
    label: 'Promotion',
    blurb: 'Announce a sale or discount',
    art: 'tag',
    display: 'fullscreen',
    badge: 'Limited time',
    title: 'Something special, just for now',
    description: "For a limited time, enjoy an offer you won't want to miss.",
    ctaLabel: 'See the offer',
    closable: true,
    reshow: 'once',
    theme: {
      bgFrom: '#052e22',
      bgTo: '#020f0b',
      accent: '#34d399',
      accentText: '#03170f',
      titleColor: '#eafff6',
      textColor: 'rgba(234,255,246,0.76)',
      card: 'glass',
    },
  },
  {
    id: 'update',
    label: 'Product update',
    blurb: 'Ship a feature, tell people',
    art: 'spark',
    display: 'popup',
    badge: "What's new",
    title: 'Something new just landed',
    description: "We've shipped an update. Take a look at what changed.",
    ctaLabel: 'See what changed',
    closable: true,
    reshow: 'once',
    theme: {
      bgFrom: '#120a2e',
      bgTo: '#050310',
      accent: '#a78bfa',
      accentText: '#120a2e',
      titleColor: '#f6f2ff',
      textColor: 'rgba(246,242,255,0.76)',
      card: 'glass',
    },
  },
  {
    id: 'celebrate',
    label: 'Celebration',
    blurb: 'Milestone or good news',
    art: 'confetti',
    display: 'fullscreen',
    badge: 'Big news',
    title: 'We hit a milestone!',
    description: 'Thank you for being part of this. There is more on the way.',
    ctaLabel: 'Nice!',
    closable: true,
    reshow: 'once',
    theme: {
      bgFrom: '#3b0a3f',
      bgTo: '#12061a',
      accent: '#f472b6',
      accentText: '#2a0620',
      titleColor: '#fff0f8',
      textColor: 'rgba(255,240,248,0.78)',
      card: 'glass',
    },
  },
  {
    id: 'custom',
    label: 'Custom',
    blurb: 'Start blank and style it yourself',
    art: 'bell',
    display: 'fullscreen',
    badge: 'Announcement',
    title: '',
    description: '',
    ctaLabel: '',
    closable: true,
    reshow: 'once',
    theme: {
      bgFrom: '#101014',
      bgTo: '#050508',
      accent: '#c6ff3d',
      accentText: '#101400',
      titleColor: '#ffffff',
      textColor: 'rgba(255,255,255,0.74)',
      card: 'glass',
    },
  },
];

export const OVERLAY_ART_OPTIONS: { id: OverlayArt; label: string }[] = [
  { id: 'megaphone', label: 'Megaphone' },
  { id: 'wrench', label: 'Wrench' },
  { id: 'tag', label: 'Price tag' },
  { id: 'spark', label: 'Sparkle' },
  { id: 'confetti', label: 'Confetti' },
  { id: 'bell', label: 'Bell' },
  { id: 'none', label: 'None' },
];

export function getOverlayTemplate(id: OverlayTemplateId): OverlayTemplate {
  return OVERLAY_TEMPLATES.find((t) => t.id === id) || OVERLAY_TEMPLATES[OVERLAY_TEMPLATES.length - 1];
}

// A fresh, INACTIVE doc built from a template, version 0. Used when the
// composer first mounts with no saved overlay, and whenever the admin
// picks a template chip (active/version/ctaUrl/notifyOnClose carried
// over separately by the caller — see useOverlayComposer).
export function overlayFromTemplate(id: OverlayTemplateId): SiteOverlayDoc {
  const t = getOverlayTemplate(id);
  return {
    active: false,
    template: t.id,
    art: t.art,
    display: t.display,
    badge: t.badge,
    title: t.title,
    description: t.description,
    ctaLabel: t.ctaLabel,
    ctaUrl: '',
    closable: t.closable,
    reshow: t.reshow,
    notifyOnClose: false,
    theme: { ...t.theme },
    version: 0,
    updatedAt: null,
  };
}

// ── Sanitising ──────────────────────────────────────────────────────

const HEX = /^#([0-9a-f]{3}|[0-9a-f]{6})$/i;
const RGBA = /^rgba?\(\s*\d{1,3}\s*,\s*\d{1,3}\s*,\s*\d{1,3}\s*(,\s*(0|1|0?\.\d+)\s*)?\)$/i;

export function isSafeColor(v: unknown): v is string {
  return typeof v === 'string' && (HEX.test(v.trim()) || RGBA.test(v.trim()));
}

function color(v: unknown, fallback: string): string {
  return isSafeColor(v) ? (v as string).trim() : fallback;
}

// Only same-site paths or http(s) URLs — rejects javascript:, data:,
// vbscript: etc. This is an allow-list because the value ends up in a
// real href on a third-party site.
export function safeUrl(v: unknown): string {
  if (typeof v !== 'string') return '';
  const s = v.trim();
  if (!s) return '';
  if (s.startsWith('/') && !s.startsWith('//')) return s.slice(0, OVERLAY_LIMITS.ctaUrl);
  if (/^https?:\/\//i.test(s)) return s.slice(0, OVERLAY_LIMITS.ctaUrl);
  return '';
}

function str(v: unknown, max: number): string {
  return typeof v === 'string' ? v.trim().slice(0, max) : '';
}

const TEMPLATE_IDS = OVERLAY_TEMPLATES.map((t) => t.id);
const ART_IDS = OVERLAY_ART_OPTIONS.map((a) => a.id);

// Coerces any input (an untrusted request body, or whatever happens to
// already be sitting in Firestore — including a doc saved under the OLD
// minimal shape before this redesign) into a fully-valid SiteOverlayDoc.
// Never throws.
export function sanitizeSiteOverlay(input: unknown, prevVersion?: number): SiteOverlayDoc {
  const raw = (input && typeof input === 'object' ? input : {}) as Record<string, any>;
  const template: OverlayTemplateId = TEMPLATE_IDS.includes(raw.template) ? raw.template : 'custom';
  const base = getOverlayTemplate(template);
  const t = (raw.theme && typeof raw.theme === 'object' ? raw.theme : {}) as Record<string, any>;

  // Backward-compat: the pre-redesign shape only had a flat `text`
  // field, no `title`/`description` split. If this doc predates the
  // redesign (no `template` key at all) fold `text` into `description`
  // so an old live overlay still renders something sensible instead of
  // going blank.
  const legacyText = typeof raw.text === 'string' ? raw.text : '';
  const hasNewShape = typeof raw.template === 'string' || typeof raw.title === 'string';

  return {
    active: raw.active === true,
    template,
    art: ART_IDS.includes(raw.art) ? raw.art : base.art,
    display: raw.display === 'popup' ? 'popup' : 'fullscreen',
    badge: str(raw.badge, OVERLAY_LIMITS.badge),
    title: hasNewShape ? str(raw.title, OVERLAY_LIMITS.title) : '',
    description: hasNewShape ? str(raw.description, OVERLAY_LIMITS.description) : str(legacyText, OVERLAY_LIMITS.description),
    ctaLabel: str(raw.ctaLabel, OVERLAY_LIMITS.ctaLabel),
    ctaUrl: safeUrl(raw.ctaUrl),
    closable: raw.closable !== false, // legacy overlays were always closable
    reshow: raw.reshow === 'every' ? 'every' : 'once',
    notifyOnClose: raw.notifyOnClose === true,
    theme: {
      bgFrom: color(t.bgFrom, raw.bgColor || base.theme.bgFrom),
      bgTo: color(t.bgTo, base.theme.bgTo),
      accent: color(t.accent, base.theme.accent),
      accentText: color(t.accentText, base.theme.accentText),
      titleColor: color(t.titleColor, base.theme.titleColor),
      textColor: color(t.textColor, raw.textColor || base.theme.textColor),
      card: t.card === 'solid' ? 'solid' : 'glass',
    },
    version: typeof raw.version === 'number' && isFinite(raw.version) ? raw.version : (prevVersion ?? 0),
    updatedAt: raw.updatedAt ?? null,
  };
}

export function hasOverlayContent(a: SiteOverlayDoc): boolean {
  return !!(a.title || a.description);
}

// localStorage key the live tracking script uses to remember a
// dismissal per-site (suffixed with the siteId at write time).
export const OVERLAY_DISMISS_KEY_PREFIX = 'sv_overlay_dismissed_';

// ── Stats ───────────────────────────────────────────────────────────
// Counts for the CURRENTLY LIVE push only — reset every time a new
// version is pushed (see app/api/overlay-track/route.ts). Stored at
// users/{uid}/sites/{siteId} -> overlayStats, incremented server-side
// via FieldValue.increment so a visitor can't spoof these.
export interface OverlayStats {
  impressions: number;
  ctaClicks: number;
  closes: number;
}

export const OVERLAY_STATS_ZERO: OverlayStats = { impressions: 0, ctaClicks: 0, closes: 0 };

function statNum(v: unknown): number {
  return typeof v === 'number' && isFinite(v) && v >= 0 ? v : 0;
}

export function sanitizeOverlayStats(input: unknown): OverlayStats {
  const raw = (input && typeof input === 'object' ? input : {}) as Record<string, any>;
  return {
    impressions: statNum(raw.impressions),
    ctaClicks: statNum(raw.ctaClicks),
    closes: statNum(raw.closes),
  };
}

export type OverlayTrackEvent = 'impression' | 'cta' | 'close';
export const OVERLAY_TRACK_EVENTS: OverlayTrackEvent[] = ['impression', 'cta', 'close'];
