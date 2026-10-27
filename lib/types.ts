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
  // Permission ids granted to sitevento for this site (see
  // lib/connectPermissions.ts's CONNECT_PERMISSIONS) — chosen at
  // connect time (components/connect/ConnectPermissionsGrid.tsx) and
  // editable afterwards from the per-site manage page
  // (components/dashboard/SiteManagePage.tsx's Permissions panel, via
  // app/api/user-action's 'update-site-permissions' action). Undefined
  // on any site connected before this field existed — treated the same
  // as an empty array everywhere this is read (nothing granted), never
  // as "unknown"/"all granted".
  permissions?: string[];
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
  // Epoch-ms expiry of a temporary restriction (see
  // hooks/useActiveSiteData.ts's restrictVisitor/isRestricted) —
  // independent of `blocked`, which is the permanent block. Undefined
  // or in the past both read as "not currently restricted".
  restrictedUntil?: number | null;
}

// users/{uid}/sites/{siteId}/deviceIndex/{deviceSignature} — written and
// read only by app/api/track (Admin SDK). Maps a coarse, server-computed
// device signature (IP /24 or ASN + stable UA components + Accept-Language
// + timezone offset — see hashDeviceSignature in app/api/track/route.ts)
// to the FIRST visitorId ever seen for that signature, so a visitor whose
// localStorage gets cleared (and who therefore shows up with no client
// visitorId) is re-linked to their original visitorId instead of being
// recorded as a brand-new visitor or merged into an unrelated one. Never
// exposed to the client directly; /api/track only ever returns the
// resolved visitorId itself (see TrackResponse's resolvedVisitorId).
export interface DeviceIndexEntry {
  visitorId: string;
  firstSeenAt: { toDate: () => Date } | number | null;
  lastSeenAt: { toDate: () => Date } | number | null;
  // How many times this signature has been used to recover a visitor
  // whose client-side id was missing — purely diagnostic (helps tell
  // "working as intended" apart from "this signature is suspiciously
  // over-used", e.g. a shared office NAT), never read by any blocking
  // logic.
  recoveryCount?: number;
}

// users/{uid}/sites/{siteId}/visitorProfiles/{visitorId} — one doc per
// UNIQUE visitor (not per visit), maintained incrementally by
// app/api/track on every beacon (see upsertVisitorProfile there). This
// is what powers /dashboard/users (components/dashboard/UsersPage.tsx):
// that page reads this collection directly instead of deriving
// "unique visitors" by grouping the visits collection client-side,
// which doesn't scale past the 50-row cap useActiveSiteData already
// applies and would recompute `number` differently every render.
//
// `number` is assigned ONCE, the first time a given visitorId is ever
// seen for this site (see the site doc's nextVisitorNumber counter),
// and never changes afterwards — it's what lets the dashboard show
// "User #1", "User #2", ... as a stable, human-friendly stand-in for
// an opaque visitorId, in the order each person first arrived. It is
// NOT a count of total visitors at any given time (deleting/restoring
// a profile never renumbers anything else).
export interface VisitorProfile {
  id: string; // same value as visitorId — kept as its own field too so callers don't have to special-case the doc id
  visitorId: string;
  number: number;
  country?: string;
  city?: string | null;
  device?: string;
  browser?: string;
  os?: string;
  firstSeenAt: { toDate: () => Date } | number | null;
  lastSeenAt: { toDate: () => Date } | number | null;
  visitCount: number;
  blocked: boolean;
  restrictedUntil?: number | null;
  // Soft-delete marker for the /dashboard/users "Bin" — same pattern as
  // Lead.deletedAt below. The visitor's underlying visit history is
  // left untouched; only this profile doc (and therefore its row on
  // the Users page) is hidden until restored.
  deletedAt?: number | null;
}

export interface Lead {
  id: string;
  email: string;
  // 'overlay-notify' when captured via a locked banner's "Notify me"
  // control (see app/api/overlay-notify/route.ts); undefined for leads
  // captured any other way.
  source?: string;
  ts: { toDate: () => Date } | number | null;
  // Soft-delete marker for the /dashboard/leads "Bin" (see
  // EmailCapturePage.tsx + app/api/user-action's 'delete-lead' /
  // 'restore-lead' actions). Undefined/null = active lead. A deleted
  // lead is excluded from counts, exports, and the main list but kept
  // around (and restorable) until the user empties the bin.
  deletedAt?: number | null;
}
