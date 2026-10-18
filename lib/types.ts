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

// Snapshot of app/api/domain-lookup's RDAP result, captured once at
// connect time (app/api/connect-site/route.ts) and persisted onto the
// site doc — the same "domain intel" the connect wizard shows live
// while the owner is typing (components/connect/DomainIntelCard.tsx),
// but kept permanently instead of discarded once the wizard closes, so
// the site-manage page (components/dashboard/SiteManagePage.tsx) can
// show it later without re-querying RDAP. Best-effort by nature — a
// registry that returns nothing useful (redacted record, unsupported
// TLD, RDAP proxy miss) just means this stays undefined/found:false;
// it never blocks or affects connecting the site.
export interface SiteDomainInfo {
  found: boolean;
  registrar: string | null;
  createdAt: string | null; // ISO date string (domain registration date, not Sitevento's)
  updatedAt: string | null; // ISO date string
  expiresAt: string | null; // ISO date string
  ageDays: number | null;
  status: string[];
  nameserverCount: number | null;
}

export interface Site {
  id: string;
  name: string;
  url: string;
  status: SiteStatus;
  // Owner-level pause: distinct from `status` (which only tracks tag
  // verification). A paused site stays verified/connected but the
  // owner has asked tracking/widgets/banners to stop temporarily
  // without fully disconnecting it (see hooks/useSites.ts's pauseSite
  // and app/api/track + app/api/site-widgets, which both read this to
  // decide whether to record/serve anything for the site). Missing or
  // false reads as "not paused" so every pre-existing site keeps
  // working unchanged.
  paused?: boolean;
  domainInfo?: SiteDomainInfo;
  overlay?: SiteOverlay;
  overlayStats?: OverlayStats;
  createdAt?: { toDate: () => Date } | null;
  verifiedAt?: { toDate: () => Date } | null;
  // Set by /api/track on every successfully recorded visit — i.e. only
  // when the tracking <script> actually ran on a page and reached the
  // backend. A `verified` site with verifiedAt set but lastSeenAt still
  // null means verification passed but no real visit has ever come in
  // (script removed after verifying, blocked by the visitor's browser,
  // etc.) — see ProfilePage.tsx's status badge, which surfaces this.
  lastSeenAt?: { toDate: () => Date } | null;
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
