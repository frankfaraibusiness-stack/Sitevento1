// app/api/heatmap-sample/route.ts
//
// POST { siteId, visitorToken, path, samples: [{ gx, gy }, ...], viewportW? }
//
// The "where on the page" twin of app/api/visit-end's engagement
// summary. Every click sampled this page view (see
// public/sitevento.js's onHeatmapClick) is bucketed CLIENT-SIDE into a
// 20x20 grid of (gx, gy) cell indices and accumulated in memory —
// zero network calls while that's happening, same "no network call
// per click" rule onRageClickCheck already follows a few lines above
// it in sitevento.js. Only the final per-cell counts for this page
// view are sent, ONCE, on the same pagehide/visibilitychange flush
// visit-end already uses.
//
// ── Why this is its own endpoint/subcollection, not folded into
//    visit-end ──────────────────────────────────────────────────────
// visit-end patches ONE existing visit doc with a handful of SCALAR
// fields (scrollDepthPct, activeSeconds...) — flat +1 write no matter
// how long the page view lasts. A heatmap sample is fundamentally
// different: it's PER-PAGE aggregate data that needs to be summed
// ACROSS every visitor who ever lands on that page, not scoped to one
// visit doc that only that one visitor will ever read back. So this
// writes to users/{uid}/sites/{siteId}/heatmaps/{pageKey} — ONE doc
// PER PAGE PATH, shared across all visitors, bucket counts merged in
// via FieldValue.increment — rather than ballooning into one doc per
// visit (which would make "show me this page's heatmap" an
// unbounded-cost read instead of a single doc get). See
// lib/types.ts's HeatmapPage for the full storage-shape reasoning.
//
// ── Auth & billing ───────────────────────────────────────────────────
// Same visitorToken requirement and same metering shape as
// /api/custom-event: resolves siteId -> uid and debits the account's
// daily widget-token cap in the same atomic call
// (assertWidgetTokensAllowed), at tokenCost('heatmapSample') — see
// lib/limits.ts for why that's priced at double a plain visit check
// (one set() call, but with up to GRID_SIZE*GRID_SIZE field
// increments in it, not a handful of scalars). A paused/over-cap
// account gets the same always-200 PAUSED body every other hard-gated
// widget route returns.
//
// Always 200, CORS wide open, same "never surface infra trouble to a
// real visitor's page" contract as every other beacon endpoint here.
import { NextRequest, NextResponse } from 'next/server';
import { getAdminDb } from '@/lib/firebaseAdmin';
import { FieldValue } from 'firebase-admin/firestore';
import { allow } from '@/lib/rateLimit';
import { assertWidgetTokensAllowed, pausedWidgetResponse, WidgetTokenBlockedError } from '@/lib/serverAuth';
import { tokenCost } from '@/lib/limits';
import { verifyVisitorToken } from '@/lib/visitorIdentity';

export const maxDuration = 10;
export const runtime = 'nodejs';

const CORS_HEADERS = {
  'Access-Control-Allow-Origin': '*',
  'Access-Control-Allow-Methods': 'POST, OPTIONS',
  'Access-Control-Allow-Headers': 'Content-Type',
};

// A full page view's worth of bucket samples (up to GRID_SIZE*GRID_SIZE
// distinct cells) plus path/ids — generous compared to visit-end's 2KB
// scalar-only budget, but still small: this is counts, not raw points.
const MAX_BODY_BYTES = 8 * 1024;
const MAX_PATH_LEN = 500;

// Must match public/sitevento.js's HEATMAP_GRID_SIZE exactly — this is
// the authority on what counts as a valid bucket index; the client
// constant exists only so the browser doesn't have to round-trip to
// learn it. A mismatch here would silently accept/clip samples at the
// wrong resolution rather than error, which is why both sides comment
// this is the one value that must move together.
const GRID_SIZE = 20;

// Same derivation the client uses for pageKey (see sitevento.js's
// heatmapPageKey) — re-derived server-side from the trusted `path`
// field rather than trusting a client-sent key directly, so two
// visitors on the same page can never be routed to different docs by
// a client bug, and so this can't be used to target an arbitrary
// Firestore doc id. Firestore doc ids can't contain '/', and we cap
// length well under the 1500-byte limit; collisions between two
// distinct paths that sanitize to the same key are an accepted,
// low-stakes gap (same "coarse signal, not forensic precision" spirit
// as the grid buckets themselves) — a mixed-together heatmap for two
// near-identical paths is still useful, never harmful.
function heatmapPageKey(path: string): string {
  const trimmed = (path || '/').split('?')[0].split('#')[0] || '/';
  const safe = trimmed.replace(/[^a-zA-Z0-9/_-]/g, '_').slice(0, 150);
  return safe === '' ? 'root' : safe;
}

export async function OPTIONS() {
  return new NextResponse(null, { status: 204, headers: CORS_HEADERS });
}

export async function POST(req: NextRequest) {
  try {
    const contentLength = Number(req.headers.get('content-length') || 0);
    if (contentLength > MAX_BODY_BYTES) {
      return NextResponse.json({ ok: false, reason: 'payload too large' }, { status: 200, headers: CORS_HEADERS });
    }
    const raw = await req.text();
    if (raw.length > MAX_BODY_BYTES) {
      return NextResponse.json({ ok: false, reason: 'payload too large' }, { status: 200, headers: CORS_HEADERS });
    }

    let body: any = {};
    try {
      body = JSON.parse(raw);
    } catch {
      return NextResponse.json({ ok: false, reason: 'invalid json' }, { status: 200, headers: CORS_HEADERS });
    }

    const { siteId, visitorToken, path, samples, viewportW } = body || {};
    if (!siteId || typeof siteId !== 'string' || siteId.length > 100) {
      return NextResponse.json({ ok: false, reason: 'missing siteId' }, { status: 200, headers: CORS_HEADERS });
    }
    if (typeof path !== 'string' || !path) {
      return NextResponse.json({ ok: false, reason: 'missing path' }, { status: 200, headers: CORS_HEADERS });
    }
    if (!Array.isArray(samples) || samples.length === 0) {
      // Nothing to record — a page view with zero sampled clicks is
      // common and not an error, just nothing worth a write for.
      return NextResponse.json({ ok: true, counted: false }, { status: 200, headers: CORS_HEADERS });
    }

    // Collapse to a sparse bucket-count map, validating + clamping
    // every (gx, gy) pair server-side rather than trusting the
    // client's grid math — a corrupt/forged sample set can at most
    // pollute this page's own bucket counts a little, never write
    // outside this doc's `buckets` map (keys are always "N_N" with N
    // in range, constructed here, never passed through from the
    // client as a raw string).
    const counts = new Map<string, number>();
    for (const s of samples.slice(0, GRID_SIZE * GRID_SIZE)) {
      const gx = Math.floor(Number(s?.gx));
      const gy = Math.floor(Number(s?.gy));
      if (!Number.isFinite(gx) || !Number.isFinite(gy)) continue;
      if (gx < 0 || gx >= GRID_SIZE || gy < 0 || gy >= GRID_SIZE) continue;
      const key = `${gx}_${gy}`;
      counts.set(key, (counts.get(key) || 0) + 1);
    }
    if (counts.size === 0) {
      return NextResponse.json({ ok: true, counted: false }, { status: 200, headers: CORS_HEADERS });
    }

    // Same requirement /api/custom-event and /api/click-track already
    // enforce: a bare, unsigned visitorId is never accepted here.
    const verified = verifyVisitorToken(visitorToken, siteId);
    if (!verified) {
      return NextResponse.json({ ok: true, counted: false }, { status: 200, headers: CORS_HEADERS });
    }

    const forwardedForHeader = req.headers.get('x-forwarded-for') || '';
    const callerIp = forwardedForHeader.split(',')[0].trim() || 'unknown';
    if (!allow(`heatmap-sample:${siteId}:${callerIp}`, 60, 60_000)) {
      return NextResponse.json({ ok: false, reason: 'rate limited' }, { status: 200, headers: CORS_HEADERS });
    }

    let db;
    try {
      db = getAdminDb();
    } catch (err) {
      console.error('[heatmap-sample] Firebase Admin init error', err);
      return NextResponse.json({ ok: false, reason: 'server not configured' }, { status: 200, headers: CORS_HEADERS });
    }

    let resolved;
    try {
      resolved = await assertWidgetTokensAllowed(db, siteId, tokenCost('heatmapSample'));
    } catch (err) {
      if (err instanceof WidgetTokenBlockedError) {
        return pausedWidgetResponse(CORS_HEADERS);
      }
      throw err;
    }
    if (!resolved) {
      return NextResponse.json({ ok: false, reason: 'unknown site' }, { status: 200, headers: CORS_HEADERS });
    }
    const { uid } = resolved;

    const siteRef = db.collection('users').doc(uid).collection('sites').doc(siteId);
    const siteSnap = await siteRef.get();
    if (!siteSnap.exists) {
      return NextResponse.json({ ok: false, reason: 'unknown site' }, { status: 200, headers: CORS_HEADERS });
    }
    const site = siteSnap.data()!;
    if (site.status !== 'verified' || site.paused === true) {
      return NextResponse.json({ ok: false, reason: 'site not active' }, { status: 200, headers: CORS_HEADERS });
    }

    // A visitor already blocked/restricted shouldn't get their clicks
    // folded into the owner's heatmap any more than their pageviews
    // would be — same early-out /api/track, /api/click-track and
    // /api/custom-event all use. Still charged the token above, same
    // "owner is billed for having received the call" reasoning those
    // routes already document.
    const blockedSnap = await siteRef.collection('blockedVisitors').doc(verified.visitorId).get().catch(() => null);
    const blockedData = blockedSnap && blockedSnap.exists ? blockedSnap.data() : null;
    const restrictedUntilTs = typeof blockedData?.restrictedUntil === 'number' ? blockedData.restrictedUntil : null;
    const alreadyBlocked = !!blockedData && (restrictedUntilTs === null || restrictedUntilTs > Date.now());
    if (alreadyBlocked) {
      return NextResponse.json({ ok: true, counted: false, blocked: true }, { status: 200, headers: CORS_HEADERS });
    }

    const pageKey = heatmapPageKey(path);
    const pageRef = siteRef.collection('heatmaps').doc(pageKey);

    // Sum of VALIDATED counts only (post gx/gy range-check above), not
    // raw samples.length — keeps totalClicks always exactly equal to
    // the sum of `buckets`, even if a malformed payload sent some
    // out-of-range pairs that got silently dropped above.
    let validatedTotal = 0;
    for (const n of counts.values()) validatedTotal += n;

    const patch: Record<string, unknown> = {
      path: path.slice(0, MAX_PATH_LEN),
      gridSize: GRID_SIZE,
      updatedAt: FieldValue.serverTimestamp(),
      totalClicks: FieldValue.increment(validatedTotal),
    };
    for (const [key, n] of counts) {
      patch[`buckets.${key}`] = FieldValue.increment(n);
    }
    const vw = Math.floor(Number(viewportW));
    if (Number.isFinite(vw) && vw > 0 && vw < 20000) patch.viewportW = vw;

    await pageRef.set(patch, { merge: true });

    return NextResponse.json({ ok: true, counted: true, cells: counts.size }, { status: 200, headers: CORS_HEADERS });
  } catch (err) {
    console.error('[heatmap-sample] handler error', err);
    return NextResponse.json({ ok: false }, { status: 200, headers: CORS_HEADERS });
  }
}
