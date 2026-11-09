// lib/leadAttribution.ts
//
// Shared by app/api/email-capture and app/api/overlay-notify: both
// write a Lead doc and both now want to attribute it back to the
// visit that produced it (see Lead.visitorId/device/path in
// lib/types.ts). This is the ONE place that logic lives, so the two
// routes can't silently drift on what "attribution" means.
//
// Deliberately does NOT re-derive device from a User-Agent header —
// that parsing already happened once, in app/api/track, and its
// result is already sitting in users/{uid}/sites/{siteId}/
// visitorProfiles/{visitorId} (see upsertVisitorProfile there). This
// is one extra READ (cheap, unmetered — reads are unlimited on every
// plan, see lib/limits.ts's firestoreQuota) rather than a second
// parser or a second write, and it's best-effort: a lookup miss (the
// visitor's first-ever beacon hasn't landed yet, race between the
// pageview and the form submit, or a malformed/missing visitorId)
// just means the lead is written with no device attribution at all —
// never a guess, never "Desktop" as a default.
import type { Firestore, DocumentReference } from 'firebase-admin/firestore';

// Mirrors app/api/track's / app/api/click-track's own VISITOR_ID_RE —
// the shape the loader actually generates.
const VISITOR_ID_RE = /^v[a-z0-9]{6,40}$/i;

export interface LeadAttribution {
  visitorId: string | null;
  device: string | null;
}

/**
 * Best-effort lookup of the device associated with visitorId, from
 * that visitor's existing profile doc. Returns { visitorId: null,
 * device: null } for anything that isn't a plausible visitor id, or
 * where the profile doesn't exist / the read fails — callers should
 * merge this straight into the lead doc with no further branching
 * (undefined/null fields are the correct "unknown" state, not an
 * error to handle specially).
 */
export async function resolveLeadAttribution(
  db: Firestore,
  siteRef: DocumentReference,
  rawVisitorId: unknown
): Promise<LeadAttribution> {
  if (typeof rawVisitorId !== 'string' || !VISITOR_ID_RE.test(rawVisitorId)) {
    return { visitorId: null, device: null };
  }
  try {
    const snap = await siteRef.collection('visitorProfiles').doc(rawVisitorId).get();
    const device = snap.exists && typeof snap.data()?.device === 'string' ? (snap.data()!.device as string) : null;
    return { visitorId: rawVisitorId, device };
  } catch {
    // Same "a best-effort enrichment hiccup must never fail or slow
    // the actual lead write" principle as every other optional lookup
    // in this app (lib/ipIntel.ts's network intel, etc).
    return { visitorId: rawVisitorId, device: null };
  }
}
