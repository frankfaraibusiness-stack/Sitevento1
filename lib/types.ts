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
import type { SiteTheme as SiteThemeShape } from './siteTheme';

export type { OverlayTemplateId, OverlayArt, OverlayDisplay, OverlayTheme, OverlayStats } from './siteAlert';
export type SiteOverlay = SiteOverlayDoc;
// Re-exported from lib/siteTheme.ts (same pattern as SiteOverlay above)
// rather than redeclared here, so the detector's return type and the
// Firestore doc's field type can never silently drift apart.
export type { SiteColorCandidate, SitePlatform } from './siteTheme';
export type SiteTheme = SiteThemeShape;

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
  // SiteTheme is lib/siteTheme.ts's detectSiteTheme() result type,
  // re-exported above. Set once verification succeeds
  // (app/api/verify-site/route.ts writes it in the same update() call
  // that flips status to 'verified'). A live preview of
  // the same detection runs earlier too, in app/api/site-reachability,
  // but that route never writes to the site doc (it's read-only by
  // design — see its own header comment), so re-running the
  // reachability check post-verification does NOT refresh this field;
  // only a successful re-verification would.
  siteTheme?: SiteTheme;
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
  // UTM / campaign attribution — read client-side from location.search
  // on whichever page view was this session's landing page (see
  // public/sitevento.js's readUtmParams), stored as-is with no
  // normalization (case, whitespace, etc. are the campaign-setter's
  // own responsibility, same "trust but clip" treatment as referrer).
  // Undefined/null on the large majority of visits that arrive with no
  // tagged link at all — never defaulted to a placeholder string, so
  // "no UTM data" and "explicitly untagged" aren't conflated with a
  // real (if unlikely) campaign value like "none".
  utmSource?: string | null;
  utmMedium?: string | null;
  utmCampaign?: string | null;
  utmTerm?: string | null;
  utmContent?: string | null;
  country?: string;
  city?: string | null;
  // Extra free server-side signals — see app/api/track/route.ts's
  // "Extra free signals, server-side" comment for exactly where each
  // comes from. All optional/nullable: off-Vercel (local dev, another
  // host) or a non-Chromium browser (no Sec-CH-UA*) legitimately never
  // populates some of these, and a missing value must always read as
  // "unknown", never as suspicious on its own.
  region?: string | null;
  timezone?: string | null;
  acceptLanguage?: string | null;
  platformHint?: string | null;
  // Network Information API (navigator.connection.type /
  // .effectiveType) — Chromium-family only; Safari/Firefox never send
  // it, so this is just as "optional, missing = unknown" as every
  // other extra signal above. 'wifi' | 'cellular' | 'ethernet' |
  // 'bluetooth' | 'none' | 'unknown' | 'other' mirror the API's own
  // connection.type values verbatim rather than a bespoke enum, so a
  // browser adding a new type later doesn't need a server change to
  // show up (an unrecognized string still displays as itself).
  connectionType?: string | null;
  ts: { toDate: () => Date } | number | null;
  visitorId: string;
  sessionId?: string;
  blocked: boolean;
  // ── Engagement summary (lib/visitEnd.ts / app/api/visit-end) ──────
  // All three are populated by exactly ONE follow-up beacon per visit
  // — sent client-side on pagehide/visibilitychange-hidden, with the
  // final numbers accumulated in-memory for the whole page view — NOT
  // by a write per scroll tick or per click. That keeps this at a flat
  // 2 writes per visit (the original visit doc + this one patch) no
  // matter how long someone stays on the page or how much they scroll.
  // All undefined until that beacon lands; a visit where it never
  // arrives (closed the tab before the beacon could fire, successfully
  // in some fraction of cases despite sendBeacon's best effort, or an
  // old visit recorded before this field existed) just has none of
  // these three set — the dashboard must read that as "no engagement
  // data for this visit", never as "zero engagement".
  scrollDepthPct?: number | null; // 0–100, deepest scroll reached this page view
  activeSeconds?: number | null; // time the tab was actually visible/foregrounded, not wall-clock since load
  validClicks?: number | null; // clicks judged human-paced by SECURITY BOT's own per-click gap check (see app/api/visit-end's header) — NOT a raw click count, so a click-bot burst does not inflate this
  // Real Navigation Timing loadEventEnd, in ms — from the browser's
  // own performance API, read once window.load fires (see
  // public/sitevento.js's capturePageLoadMs). Rides the SAME beacon
  // as the fields above rather than its own write. Only ever set on
  // the FIRST tracked visit of an actual page load — an SPA route
  // change's own visit-end never repeats/re-measures this.
  pageLoadMs?: number | null;
  // Count of DISTINCT elements this page view rage-clicked (3+ rapid
  // clicks on the same element — see public/sitevento.js's
  // onRageClickCheck for the exact rule). A signal that something
  // LOOKS broken/frustrating, not a confirmed bug — surfaced that way
  // everywhere this is shown.
  rageClicks?: number | null;
  endedAt?: { toDate: () => Date } | number | null; // server timestamp of the summary beacon, i.e. roughly when this page view ended
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
  // Same "optional, missing means unknown" fields as Visit above —
  // kept as the LATEST snapshot (overwritten on every beacon, not
  // accumulated), same treatment as country/city/device/browser/os on
  // this same profile doc.
  region?: string | null;
  timezone?: string | null;
  // From lib/ipIntel.ts's free network-intel lookup (see app/api/track's
  // call site) — ASN organization name for display, and whether that
  // network is hosting/proxy-flagged. Both purely informational on
  // this doc: this field is NOT what SECURITY BOT's own `networkSuspect`
  // scoring signal reads (that's resolved fresh, per-event, inside
  // applyBotShield) — this is only the latest snapshot for the
  // owner's own review on the Users page.
  networkOrg?: string | null;
  networkSuspect?: boolean;
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
  // A direct, one-to-one message the owner sent THIS visitor from the
  // Users page's "Message" quick action (see lib/visitorMessage.ts's
  // VisitorMessage shape and UsersPage.tsx's message composer).
  // Undefined/null = nothing pending, which is the default for every
  // visitor unless the owner explicitly composes one — matches
  // VisitorMessage's own header comment. Cleared (set back to null) by
  // the visitor dismissing the popup, which app/api/track/route.ts
  // reports back the next time that visitor's browser sends a beacon.
  pendingMessage?: VisitorMessage | null;
  // Set once, server-side, the instant this visitor's email-capture
  // submission is accepted (app/api/email-capture's POST handler) —
  // Date.now() at that moment, never touched again afterwards (not
  // even by a later duplicate-email submission attempt, which that
  // route rejects before it would ever reach this write). This is
  // what makes "never show the popup to this visitor again once
  // they've submitted" a server-side guarantee instead of the
  // easily-lost localStorage flag EmailCaptureWidget.tsx used to rely
  // on alone (see that file's header + app/api/track's response for
  // how this is read back) — surviving a storage clear, private
  // browsing, or a different browser on the same recovered device
  // (lib/visitorIdentity.ts's device-recovery path still resolves to
  // the same visitorId, so this flag follows along with it).
  // Undefined/null = never submitted, the default for every visitor.
  emailCaptureSubmittedAt?: number | null;
}

// A single pending message attached to one VisitorProfile, delivered
// the next time that exact visitor's browser calls /api/track (see
// that route's response body and public/sitevento.js's
// renderMessagePopup). Unlike SiteOverlayDoc (lib/siteAlert.ts), which
// broadcasts one piece of content to every visitor of a site, this is
// addressed to a single visitorId and is cleared once delivered —
// there is at most one pending message per visitor at a time, no
// history kept client-side beyond what EngagementLog/visit docs
// already record.
//
// Deliberately minimal next to SiteOverlayDoc: no template picker, no
// badge/art library, no closable/reshow modes — this is a short,
// one-off note from the owner, not a themeable sitewide campaign. The
// CTA is entirely optional and blank by default (per the owner's own
// spec: "make it nothing by default but owner can make the CTA to
// what they want — contact us, etc").
export interface VisitorMessage {
  title: string;
  body: string;
  ctaLabel: string;
  ctaUrl: string;
  // Set server-side (Date.now()) the moment the owner sends it, in
  // app/api/user-action's doSendVisitorMessage — never trusted from
  // the client. Also what /api/track compares against readAt to decide
  // whether this exact message has already been shown to this visitor
  // (a message popup should only ever appear once per send, the same
  // "reshow: once, forever" default SiteOverlayDoc's templates use).
  sentAt: number;
  // Set by app/api/track the first time the VISITOR's own browser
  // reports having shown (or dismissed) this message — see that
  // route's handling of the `ackMessage` field on the beacon. Keeping
  // this server-authoritative (rather than trusting the browser to
  // just not ask again) is what lets the Users page show a small
  // "seen" indicator on the card instead of just "sent".
  readAt: number | null;
}

export interface Lead {
  id: string;
  email: string;
  // Populated when source === 'appointment-booking' (see
  // app/api/appointment-booking/route.ts): the visitor's own name,
  // phone number (if given instead of or alongside email), which
  // service they asked about, and any free-text message — all
  // optional/undefined for leads captured any other way.
  name?: string;
  phone?: string | null;
  service?: string | null;
  message?: string | null;
  // 'overlay-notify' when captured via a locked banner's "Notify me"
  // control (see app/api/overlay-notify/route.ts); 'appointment-
  // booking' for the Booking Request widget's form; undefined for
  // leads captured any other way.
  source?: string;
  ts: { toDate: () => Date } | number | null;
  // Soft-delete marker for the /dashboard/leads "Bin" (see
  // EmailCapturePage.tsx + app/api/user-action's 'delete-lead' /
  // 'restore-lead' actions). Undefined/null = active lead. A deleted
  // lead is excluded from counts, exports, and the main list but kept
  // around (and restorable) until the user empties the bin.
  deletedAt?: number | null;
  // Conversion attribution — ties a lead back to the visit that
  // produced it. Without this, "conversion rate by device" or "which
  // journeys lead to signups" have no way to join a lead to a visit.
  // Populated from the SAME visitorId the tracking snippet already
  // sends on every beacon (app/api/email-capture, app/api/overlay-notify
  // and app/api/appointment-booking all accept it — see
  // lib/leadAttribution.ts) — no new client-side collection, just an
  // existing value that was previously being silently dropped at the
  // API boundary. All optional/nullable: a lead captured before this
  // field existed, or one whose visitorId didn't pass validation, has
  // none of these, and must read as "attribution unknown", never
  // default to a guess.
  visitorId?: string | null;
  device?: string | null; // snapshotted from visitorProfiles at capture time
  path?: string | null; // the page the capture widget/banner was shown on
}

// users/{uid}/sites/{siteId}/brokenLinks/{docId} — written by
// app/api/broken-link. One doc per DISTINCT href (see that route's
// header), not one per click. See that route's header for this
// feature's honest scope: a same-site link whose destination never
// produced a matching page view in time, NOT a confirmed server-side
// HTTP 404.
export interface BrokenLink {
  id: string;
  href: string;
  fromPath: string | null;
  count: number;
  firstSeenAt: { toDate: () => Date } | number | null;
  lastSeenAt: { toDate: () => Date } | number | null;
}

// users/{uid}/apiEvents/{eventId} — written only by app/api/ingest
// (Admin SDK, authenticated by an sv_live_/sv_test_ key — see
// lib/apiKeys.ts). "Deep data" a site's own BACKEND sends in, which
// public/sitevento.js running in a visitor's browser could never see
// (order totals, a CRM stage, a logged-in customer id...). Unlike
// Visit, this has NO fixed schema beyond the four lifted-out fields
// below — `data` is genuinely freeform, whatever shape the caller's
// own integration sends, round-tripped as-is. See that route's header
// for the full "everything accepted" reasoning.
export interface ApiEvent {
  id: string;
  event: string; // short label, e.g. "purchase", "signup" — defaults to "event" if the caller didn't send one
  visitorId?: string | null; // this app's own visitorId, if the caller has/sends it — lets an event be joined back to a Visit/VisitorProfile
  userId?: string | null; // the SITE'S OWN internal id for whoever this event is about (customer id, account id, email...) — opaque to this app, never validated
  siteId?: string | null; // which connected site this event belongs to, if the caller sent one — informational only, never used for billing/ownership (the API key itself is already account-scoped)
  data: Record<string, unknown>; // everything else the caller sent, untouched
  test: boolean; // true if this event was sent with the sv_test_ key rather than sv_live_
  receivedAt: { toDate: () => Date } | number | null;
}

// users/{uid}/sites/{siteId}/customEvents/{eventId} — written by
// app/api/custom-event, called from THE BROWSER via the public
// window.sitevento('track', name, properties) function
// public/sitevento.js now exposes. This is the client-side twin of
// ApiEvent (lib/apiKeys.ts's server-to-server channel): it exists
// because the embed script's own auto-detection (rage clicks, valid
// click counts, scroll depth...) can tell THAT something was clicked,
// never WHAT — it has no idea a given <button> means "Upgrade to Pro."
// This lets the site owner name that meaning themselves, from their
// own page's inline JS or onclick handlers, same spirit as Plausible/
// Mixpanel-style custom events. Authenticated by the same signed
// visitorToken every other visitor-facing beacon uses (NOT an API
// key — this runs in a stranger's browser, which can never hold a
// secret safely) — see lib/visitorIdentity.ts.
export interface CustomEvent {
  id: string;
  name: string; // the event name the page itself chose, e.g. "signup_button_click"
  properties: Record<string, unknown>; // freeform, whatever the page passed as the second argument — same "no fixed schema" treatment as ApiEvent.data
  path: string; // the page this fired on — client-sent (location.pathname + search), same convention as Visit.path in app/api/track
  visitorId: string;
  sessionId?: string | null;
  ts: { toDate: () => Date } | number | null;
}

// users/{uid}/sites/{siteId}/heatmaps/{pageKey} — written by
// app/api/heatmap-sample, called from THE BROWSER via the same
// pagehide/visibilitychange flush as app/api/visit-end's engagement
// summary. ONE doc per distinct page path (pageKey is a sanitized,
// length-capped encoding of Visit.path — see app/api/heatmap-sample's
// header for the exact derivation), server-aggregated across every
// visitor who ever lands on that page, NOT one doc per click and NOT
// one doc per page view. This is the deliberate departure from
// CustomEvent's per-event-doc shape above: a click position only has
// dashboard value in aggregate ("where do people click on THIS page"),
// never individually, so there is no reason to pay for a growing
// per-click or per-visit doc count the way CustomEvent correctly does
// for named, individually-meaningful events. Bucket keys are
// "gx_gy" (grid cell indices, 0-19 each way on a 20x20 grid — see
// public/sitevento.js's HEATMAP_GRID_SIZE) mapped to a running click
// count via FieldValue.increment, so an arbitrary number of visitors
// clicking the same page costs this ONE doc a small, bounded number of
// field increments per flush, never a new doc.
export interface HeatmapPage {
  id: string; // the pageKey (sanitized path), also the Firestore doc id
  path: string; // original, human-readable path this doc aggregates (first one seen — informational, bucket math never depends on it matching byte-for-byte)
  gridSize: number; // grid dimension this doc's buckets were recorded at (20 = 20x20) — see this file's header; a future resolution change would need a new doc shape, not a silent reinterpretation of old counts
  buckets: Record<string, number>; // "gx_gy" -> click count, sparse (only cells with at least one click exist as keys)
  totalClicks: number; // sum of all bucket counts — denormalized so the dashboard doesn't need to reduce `buckets` just to show "N clicks sampled"
  viewportW?: number | null; // viewport width (CSS px) of the MOST RECENT flush that touched this doc — informational only, since (x%,y%) is already viewport-independent; lets the dashboard caption "sampled at ~Npx wide" rather than implying pixel-perfect precision
  updatedAt: { toDate: () => Date } | number | null;
}
