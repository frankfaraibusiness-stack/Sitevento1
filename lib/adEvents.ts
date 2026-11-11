// lib/adEvents.ts
//
// Fraud/validity filtering for ad impression and click events, shared
// by app/api/ad-track/route.ts. Scope deliberately matches what was
// asked for: rate-limit + dedup, reject click-without-recent-
// impression, reject self-view (site owner serving/clicking their own
// ad). Explicitly NOT in scope for this pass (flagged, not built):
// dwell-time minimums, device/IP fingerprint dedup beyond the basic
// rate limiter, and bot/crawler user-agent filtering — all noted as
// future hardening in the comments below, same as the original
// handoff flagged them as open questions.
//
// ── Why reject vs. silently drop ──────────────────────────────────
// An invalid event is still written to adPool/{adId}/events (see the
// route) with `valid: false` and a `reason` — logged for debugging/
// appeals rather than discarded — but NEVER counted toward stats,
// NEVER billed to the advertiser, and NEVER paid out to the publisher.
// This mirrors overlay-track's existing "stale push -> don't count it,
// but still answer ok:true" pattern: a rejected event is not an error
// to the visitor's page (always 200, CORS-open, fail-open — same
// contract as every other visitor-facing route in this codebase), it
// just doesn't move any money.
import { allow } from './rateLimit';

export type AdEventType = 'impression' | 'click';

export interface AdEventValidityInput {
  adId: string;
  siteId: string;
  // The ad's owner (advertiser) and the hosting site's owner
  // (publisher) — both already resolved by the caller before this is
  // called, so this module does no Firestore reads of its own and
  // stays a pure/synchronous set of checks plus the shared in-memory
  // rate limiter.
  adOwnerUid: string;
  siteOwnerUid: string;
  visitorId: string;
  eventType: AdEventType;
  // For a 'click', whether this exact visitor+ad+site combination has
  // a recently recorded valid impression to click on. The route looks
  // this up (a cheap recent-events query or a short-lived in-memory/
  // Firestore marker — route's call) and passes the boolean in, so
  // this module doesn't own the lookup strategy, just the policy.
  hasRecentValidImpression?: boolean;
}

export interface AdEventValidityResult {
  valid: boolean;
  reason?:
    | 'RATE_LIMITED'
    | 'SELF_VIEW'
    | 'CLICK_WITHOUT_IMPRESSION'
    | 'DUPLICATE';
}

// ── Rate limits ─────────────────────────────────────────────────────
// Generous enough for genuine fast browsing/multiple ad slots on one
// page, tight enough to stop a trivial refresh-loop from inflating
// earnings. Separate, tighter window per exact (visitor, ad) pair on
// top of the general per-visitor-per-site limit, so a visitor hammering
// ONE specific ad is caught even if they're under the page's overall
// cap (e.g. one ad slot refreshing in a loop).
const IMPRESSION_PER_VISITOR_SITE_LIMIT = 40; // per minute, across all ads on one site
const IMPRESSION_PER_VISITOR_SITE_WINDOW_MS = 60_000;
const IMPRESSION_PER_VISITOR_AD_LIMIT = 5; // per minute, for one specific ad
const IMPRESSION_PER_VISITOR_AD_WINDOW_MS = 60_000;

const CLICK_PER_VISITOR_AD_LIMIT = 3; // per 10 minutes — clicks are rarer and higher-value than impressions
const CLICK_PER_VISITOR_AD_WINDOW_MS = 10 * 60_000;

/**
 * Applies the fraud/validity policy described above to one ad event.
 * Pure/synchronous aside from the shared in-process rate-limit
 * buckets (lib/rateLimit.ts — same honest "per-instance, not a global
 * guarantee" limitation documented there applies here too; this is a
 * first line of defense, not the only one).
 */
export function checkAdEventValidity(input: AdEventValidityInput): AdEventValidityResult {
  const { adId, siteId, adOwnerUid, siteOwnerUid, visitorId, eventType, hasRecentValidImpression } = input;

  // Self-view: the advertiser's own ad shown on their own site (they
  // control both sides, so any resulting impression/click is not a
  // genuine third-party view). A site owner can still legitimately
  // run ads FOR other people's sites and see ads FROM other
  // advertisers on their own site — this only blocks the exact
  // same-uid-on-both-sides case.
  if (adOwnerUid === siteOwnerUid) {
    return { valid: false, reason: 'SELF_VIEW' };
  }

  if (eventType === 'impression') {
    if (!allow(`adimp:site:${siteId}:${visitorId}`, IMPRESSION_PER_VISITOR_SITE_LIMIT, IMPRESSION_PER_VISITOR_SITE_WINDOW_MS)) {
      return { valid: false, reason: 'RATE_LIMITED' };
    }
    if (!allow(`adimp:ad:${adId}:${visitorId}`, IMPRESSION_PER_VISITOR_AD_LIMIT, IMPRESSION_PER_VISITOR_AD_WINDOW_MS)) {
      return { valid: false, reason: 'RATE_LIMITED' };
    }
    return { valid: true };
  }

  // 'click'
  if (!allow(`adclick:ad:${adId}:${visitorId}`, CLICK_PER_VISITOR_AD_LIMIT, CLICK_PER_VISITOR_AD_WINDOW_MS)) {
    return { valid: false, reason: 'RATE_LIMITED' };
  }
  if (hasRecentValidImpression === false) {
    return { valid: false, reason: 'CLICK_WITHOUT_IMPRESSION' };
  }

  return { valid: true };
}

// ── Future hardening (not built in this pass) ───────────────────────
// - Minimum dwell time before an impression counts (needs a
//   client-side "ad was visible for Nms" signal from the embed script,
//   which doesn't exist yet — public/sitevento.js has no ad-rendering
//   code at all yet, see app/api/ad-serve/route.ts's header).
// - IP/device fingerprint dedup beyond the per-visitorId rate limiter
//   above (a visitor clearing localStorage gets a fresh visitorId and
//   a fresh rate-limit bucket).
// - Bot/crawler User-Agent filtering (no allow/deny list exists yet
//   anywhere in this codebase to extend).
// - A shared (cross-instance) rate-limit store — see lib/rateLimit.ts's
//   own header for why the in-memory limiter isn't a hard global cap.
