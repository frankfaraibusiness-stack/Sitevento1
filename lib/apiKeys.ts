// lib/apiKeys.ts
//
// Account-level API keys for the DEEP SERVER-SIDE DATA endpoint
// (app/api/ingest). Deliberately a simpler model than the existing
// siteId-based widget auth (lib/visitorIdentity.ts's signed
// visitorToken, lib/serverAuth.ts's assertWidgetTokensAllowed): those
// exist because a <script> tag runs on a stranger's browser and can
// never hold a secret. A server-to-server integration is the opposite
// case — the caller IS the site owner's own backend, which can keep a
// secret just fine — so this is one key per ACCOUNT (not per site),
// stored on users/{uid} right alongside `plan`, with no signing/
// verification step: the key IS the credential, looked up by a direct
// Firestore query. That's what "simple" means here. Scoping a single
// event to a particular connected site is just a `siteId` field in the
// event payload itself (validated loosely, never trusted for billing
// the way the widget routes' siteId is), not a second key per site.
//
// Two keys per account, same live/test split ApiPanel.tsx's mockup
// already showed before this file existed:
//   - sv_live_...  real data, counted against the account's usage
//   - sv_test_...  same endpoint, same shape, but writes are tagged
//     `test: true` (see app/api/ingest/route.ts) so a dashboard view
//     can filter them out of real analytics without a second endpoint
//     or a second collection to keep in sync.
//
// Keys are high-entropy random tokens, not HMAC-derived — there is
// nothing to derive them FROM (unlike visitorId, which is a real
// identity the server already knows and wants to re-derive
// deterministically). Regenerating a key is simply minting a new
// random one and overwriting the stored value; the old key stops
// resolving to a uid the instant that happens, since lookup is a live
// Firestore read, not a signature check.
import { randomBytes } from 'crypto';
import type { Firestore } from 'firebase-admin/firestore';

export type ApiKeyKind = 'live' | 'test';

function randomToken(): string {
  // 24 random bytes -> 32 base64url chars. Collision space is large
  // enough (192 bits) that a uniqueness check on insert isn't needed —
  // same reasoning lib/visitorIdentity.ts's mintVisitorId relies on
  // for its own much-shorter id, just with a wider margin since this
  // is a credential rather than a display-facing id.
  return randomBytes(24).toString('base64url');
}

export function mintApiKey(kind: ApiKeyKind): string {
  return (kind === 'live' ? 'sv_live_' : 'sv_test_') + randomToken();
}

/** Which account field a key of this kind lives in on users/{uid}. */
function fieldFor(kind: ApiKeyKind): 'apiKeyLive' | 'apiKeyTest' {
  return kind === 'live' ? 'apiKeyLive' : 'apiKeyTest';
}

export interface ApiKeyRecord {
  uid: string;
  kind: ApiKeyKind;
}

/**
 * Looks up which account (and which kind: live vs test) a secret key
 * belongs to. A single indexed query against users/{uid}.apiKeyLive OR
 * .apiKeyTest — Firestore doesn't support an OR across two fields in
 * one query, so this runs both and takes whichever (at most one, keys
 * are unique by construction) comes back. Returns null for an unknown/
 * revoked/malformed key — callers must treat that as "reject the
 * request", never fall back to any other auth path.
 */
export async function resolveApiKey(db: Firestore, key: unknown): Promise<ApiKeyRecord | null> {
  if (!key || typeof key !== 'string' || key.length < 16 || key.length > 200) return null;
  if (!key.startsWith('sv_live_') && !key.startsWith('sv_test_')) return null;

  const field = key.startsWith('sv_live_') ? 'apiKeyLive' : 'apiKeyTest';
  const kind: ApiKeyKind = field === 'apiKeyLive' ? 'live' : 'test';

  const snap = await db.collection('users').where(field, '==', key).limit(1).get();
  if (snap.empty) return null;
  return { uid: snap.docs[0].id, kind };
}

/** Reads both keys off a user doc's own data (already fetched by the caller) — never null once an account exists, since doGenerateApiKey backfills both the first time either is requested. */
export function readApiKeys(userData: Record<string, unknown> | undefined): { live: string | null; test: string | null } {
  return {
    live: typeof userData?.apiKeyLive === 'string' ? (userData.apiKeyLive as string) : null,
    test: typeof userData?.apiKeyTest === 'string' ? (userData.apiKeyTest as string) : null,
  };
}

export { fieldFor as apiKeyField };
