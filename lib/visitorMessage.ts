// lib/visitorMessage.ts
//
// Shared types/limits/sanitizing for the per-visitor "Message" quick
// action on /dashboard/users (see VisitorMessage in lib/types.ts).
// Three consumers, kept in this one file so they can never drift
// apart — same convention as lib/siteAlert.ts:
//
//   1. app/api/user-action/route.ts's doSendVisitorMessage — validates
//      and sanitizes the owner's composed message before writing it to
//      VisitorProfile.pendingMessage.
//   2. components/dashboard/UsersPage.tsx's message composer — client-
//      side length limits so the owner sees the same caps the server
//      enforces, instead of discovering them only on submit.
//   3. public/sitevento.js's renderMessagePopup — a hand-written plain-
//      JS mirror of the cartoonic popup this file's theme constant
//      describes, since it ships to arbitrary third-party pages and
//      can't import a TS module. If POPUP_THEME below ever changes,
//      that function's inline styles need updating to match.
//
// Unlike lib/siteAlert.ts's SiteOverlayDoc (broadcasts one themeable
// push to every visitor, owner picks from several templates), this is
// deliberately a single fixed cartoonic look applied to every message
// — there's no theme picker, because the point is a quick, personal
// note, not a styled campaign. The owner only ever supplies the title,
// body, and an optional CTA.

export const VISITOR_MESSAGE_LIMITS = {
  title: 80,
  body: 500,
  ctaLabel: 24,
  ctaUrl: 300,
} as const;

// Same allow-list as lib/siteAlert.ts's safeUrl — only same-site paths
// or http(s) URLs, since this ends up in a real href/mailto on a
// third-party page. mailto:/tel: are explicitly allowed here (unlike
// siteAlert's CTA, which only ever links to the owner's own promo
// content) because "Contact us" is the headline use case the owner
// described, and a contact CTA is just as likely to be an email/phone
// link as a page link.
export function safeMessageUrl(v: unknown): string {
  if (typeof v !== 'string') return '';
  const s = v.trim();
  if (!s) return '';
  if (s.startsWith('/') && !s.startsWith('//')) return s.slice(0, VISITOR_MESSAGE_LIMITS.ctaUrl);
  if (/^https?:\/\//i.test(s)) return s.slice(0, VISITOR_MESSAGE_LIMITS.ctaUrl);
  if (/^mailto:[^\s@]+@[^\s@]+\.[^\s@]+/i.test(s)) return s.slice(0, VISITOR_MESSAGE_LIMITS.ctaUrl);
  if (/^tel:\+?[0-9()\-.\s]{4,}$/i.test(s)) return s.slice(0, VISITOR_MESSAGE_LIMITS.ctaUrl);
  return '';
}

function str(v: unknown, max: number): string {
  return typeof v === 'string' ? v.trim().slice(0, max) : '';
}

export interface VisitorMessageInput {
  title: string;
  body: string;
  ctaLabel: string;
  ctaUrl: string;
  sentAt: number;
  readAt: number | null;
}

// Coerces untrusted input (the owner's composer payload) into a valid
// message, or returns null if there's nothing worth sending (the owner
// left both title and body blank). Never throws. The server is the
// only writer of sentAt (always Date.now() at send time, passed in by
// the caller — never trusted from the request body).
export function sanitizeVisitorMessage(input: unknown, sentAt: number): VisitorMessageInput | null {
  const raw = (input && typeof input === 'object' ? input : {}) as Record<string, any>;
  const title = str(raw.title, VISITOR_MESSAGE_LIMITS.title);
  const body = str(raw.body, VISITOR_MESSAGE_LIMITS.body);
  if (!title && !body) return null;
  return {
    title,
    body,
    ctaLabel: str(raw.ctaLabel, VISITOR_MESSAGE_LIMITS.ctaLabel),
    ctaUrl: safeMessageUrl(raw.ctaUrl),
    sentAt,
    readAt: null,
  };
}

// The one fixed cartoonic theme every message popup uses — bright
// cream card, thick ink outline, chunky offset shadow, same family as
// EmailCapturePage's bin/empty-state treatment (styles/dashboard/
// email-capture-page.css) rather than the dark glass promo-overlay
// look. Kept here (not per-message) since there is no picker; exists
// as named constants so public/sitevento.js's hand-written mirror has
// one place to check it's still in sync.
export const VISITOR_MESSAGE_THEME = {
  bg: '#fff7e0',
  ink: '#1a1812',
  accent: '#c6ff3d',
  accentText: '#1a1400',
} as const;
