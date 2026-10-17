// lib/types.ts
//
// Shared shapes for Firestore documents, mirroring the fields the
// original index.html read/wrote with no schema enforcement. Keeping
// these as the single source of truth is one of the real upgrades over
// the old plain-JS version, where a typo in a field name would fail
// silently at runtime.
//
// SiteOverlay is now a re-export of the richer SiteOverlayDoc shape
// (lib/siteAlert.ts) — kept here too so existing imports of
// `type { SiteOverlay } from '@/lib/types'` keep working unchanged.
import type { SiteOverlayDoc, OverlayStats } from './siteAlert';

export type { OverlayTemplateId, OverlayArt, OverlayDisplay, OverlayTheme, OverlayStats } from './siteAlert';
export type SiteOverlay = SiteOverlayDoc;

// Kept only so any old code/comments referencing the pre-redesign
// `OverlayType` union still compile; the new overlay shape uses
// `template` (see lib/siteAlert.ts's OverlayTemplateId) instead.
export type OverlayType = 'announcement' | 'maintenance' | 'message';

export type SiteStatus = 'pending' | 'verified';

export interface Site {
  id: string;
  name: string;
  url: string;
  status: SiteStatus;
  overlay?: SiteOverlay;
  overlayStats?: OverlayStats;
  createdAt?: { toDate: () => Date } | null;
  verifiedAt?: { toDate: () => Date } | null;
  // Optional — no billing system exists yet, so these are read
  // defensively (missing = active/default plan) by
  // app/api/widget/route.ts rather than required here. Present so a
  // future billing feature can set them without a type change.
  plan?: string;
  subscriptionStatus?: 'active' | 'suspended' | 'canceled';
}

// Device/browser/OS are parsed server-side from the User-Agent at
// /api/track so the tracking script never ships a UA-parsing library to
// every visitor's page. `screen` and `lang` come straight from the
// visitor's browser (non-identifying — just viewport size + locale, no
// fingerprinting-grade signal). `landing` marks the first visit of a
// session (keyed off a short-lived sessionStorage flag in
// sitevento.js) so the dashboard can tell entry pages apart from
// mid-session navigation.
export interface Visit {
  id: string;
  path: string;
  referrer: string;
  device: string;
  browser?: string;
  os?: string;
  screen?: string | null;
  lang?: string | null;
  landing?: boolean;
  country?: string;
  city?: string | null;
  ts: { toDate: () => Date } | number | null;
  visitorId: string;
  sessionId?: string;
  blocked: boolean;
}

export interface Lead {
  id: string;
  email: string;
  // 'overlay-notify' when captured via a locked banner's "Notify me"
  // control (see app/api/overlay-notify/route.ts); undefined for leads
  // captured any other way.
  source?: string;
  ts: { toDate: () => Date } | number | null;
}
