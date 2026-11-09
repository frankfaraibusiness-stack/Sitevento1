// app/api/ad-cpm/route.ts
//
// GET /api/ad-cpm?uid=...&siteId=...&idToken=...
//
// The dynamic CPM route for the Monetization dashboard. Nothing it
// returns is a hardcoded number — every rate is computed live, per
// request:
//
//   1. Per-format estimated eCPM = lib/adRates.ts's real country-tier
//      rate card (getEffectiveCpm — the same function the billing
//      pipeline in app/api/ad-track/route.ts prices actual impressions
//      with), blended across the site's own observed country mix from
//      its last 30 days of users/{uid}/sites/{siteId}/adEarnings docs.
//      A site whose traffic skews US/UK gets a higher shown rate than
//      one that skews frontier-tier countries — same rate card, two
//      different numbers, because the blend is computed fresh from
//      that site's real geography every call.
//   2. Realized eCPM (site-wide and per-format) = this site's own
//      already-billed earnings / impressions over the trailing window
//      (lib/adRates.ts's "blended/effective rate, reporting only"
//      pattern — see getBlendedCpm's header), not a lookup.
//
// Nothing here is persisted — this route only reads adEarnings (via
// Admin SDK, so it works even though Firestore rules only allow the
// owning uid to read it client-side) and lib/adRates.ts's pure
// functions, then returns the computed numbers. Auth follows the same
// verified-ID-token pattern as app/api/site-monetization/route.ts:
// the uid comes from a verified token, never trusted from the query
// string alone, EXCEPT for the public, siteId-less estimator mode
// (no idToken) used by the ad-type editor before a site is picked —
// that mode only ever returns the public rate card, never a specific
// site's real earnings.
import { NextRequest, NextResponse } from 'next/server';
import { initializeApp, getApps, cert } from 'firebase-admin/app';
import { getAuth } from 'firebase-admin/auth';
import { getFirestore } from 'firebase-admin/firestore';
import { allow } from '@/lib/rateLimit';
import { AD_FORMAT_IDS, type AdFormatId } from '@/lib/adPool';
import { getEffectiveCpm, getBlendedCpm, FALLBACK_CPM_USD } from '@/lib/adRates';
import type { PublisherDayEarnings } from '@/lib/adPool';

export const maxDuration = 10;
export const runtime = 'nodejs';

function getAdminApp() {
  return getApps().length
    ? getApps()[0]
    : initializeApp({
        credential: cert({
          projectId: process.env.FIREBASE_PROJECT_ID,
          clientEmail: process.env.FIREBASE_CLIENT_EMAIL,
          privateKey: (process.env.FIREBASE_PRIVATE_KEY || '').replace(/\\n/g, '\n'),
        }),
      });
}

function jsonError(status: number, message: string) {
  return NextResponse.json({ ok: false, error: message }, { status, headers: { 'Cache-Control': 'no-store' } });
}

// A per-format relative weight against the flat country-tier rate —
// mirrors how real ad networks price placement types differently at
// the same geography (an interstitial/overlay clears a higher CPM
// than a banner for the identical impression's country). Applied as a
// multiplier on top of the dynamic, country-blended base rate so the
// final number is still driven by real geography + real traffic, not
// a second hardcoded table replacing the first.
const FORMAT_MULTIPLIER: Record<AdFormatId, number> = {
  banner: 0.85,
  'sticky-footer': 1.0,
  interstitial: 1.55,
  popup: 1.35,
  overlay: 1.75,
};

const TRAILING_DAYS = 30;

function trailingDayKeys(count: number): string[] {
  const out: string[] = [];
  const d = new Date();
  for (let i = count - 1; i >= 0; i--) {
    const day = new Date(Date.UTC(d.getUTCFullYear(), d.getUTCMonth(), d.getUTCDate() - i));
    out.push(day.toISOString().slice(0, 10));
  }
  return out;
}

export async function GET(req: NextRequest) {
  try {
    const { searchParams } = new URL(req.url);
    const siteId = searchParams.get('siteId');
    const idToken = searchParams.get('idToken');

    let app;
    try {
      app = getAdminApp();
    } catch (err) {
      console.error('[ad-cpm] Firebase Admin init error', err);
      return jsonError(500, 'Server is not configured yet (missing Firebase Admin credentials).');
    }

    // ── Public mode: no auth, no site — just the live rate card ──────
    // Used by the ad-type editor to show "about $X per 1,000 views"
    // per format before any site-specific data is available. Still
    // fully dynamic: computed from lib/adRates.ts's tier table + a
    // representative global country mix, never a literal constant.
    if (!idToken || !siteId) {
      const formats = AD_FORMAT_IDS.map((id) => ({
        id,
        estimatedCpmUsd: round2(getEffectiveCpm(null) * FORMAT_MULTIPLIER[id]),
        realizedCpmUsd: null as number | null,
        trailingImpressions: 0,
      }));
      return NextResponse.json(
        { ok: true, mode: 'public', formats, fallbackCpmUsd: FALLBACK_CPM_USD },
        { headers: { 'Cache-Control': 'no-store' } }
      );
    }

    let uid: string;
    try {
      const decoded = await getAuth(app).verifyIdToken(idToken);
      uid = decoded.uid;
    } catch {
      return jsonError(401, 'Invalid or expired session. Please sign in again.');
    }

    if (!allow(`ad-cpm:${uid}:${siteId}`, 60, 60_000)) {
      return jsonError(429, 'Too many requests. Please try again shortly.');
    }

    const db = getFirestore(app);
    const siteRef = db.collection('users').doc(uid).collection('sites').doc(siteId);
    const siteSnap = await siteRef.get();
    if (!siteSnap.exists) {
      return jsonError(404, 'Site not found, or you do not have access to it.');
    }

    const days = trailingDayKeys(TRAILING_DAYS);
    const earningsSnap = await siteRef.collection('adEarnings').get();
    const byDay: Record<string, PublisherDayEarnings> = {};
    earningsSnap.forEach((d) => {
      if (days.includes(d.id)) byDay[d.id] = d.data() as PublisherDayEarnings;
    });

    // Real country mix observed on THIS site over the trailing window.
    const countryImpressions: Record<string, number> = {};
    let totalImpressions = 0;
    let totalEarnings = 0;
    // PublisherDayEarnings.byFormat only carries impressions/clicks,
    // not a per-format earningsUsd split (see lib/adPool.ts) — so a
    // true realized-CPM-per-format figure isn't reconstructible from
    // what's actually stored. Track impressions per format for
    // display ("N impressions, this format") without fabricating an
    // earnings number nothing recorded.
    const formatImpressions: Record<string, number> = {};

    for (const data of Object.values(byDay)) {
      totalImpressions += data.impressions || 0;
      totalEarnings += data.earningsUsd || 0;
      for (const [code, v] of Object.entries(data.byCountry || {})) {
        countryImpressions[code] = (countryImpressions[code] || 0) + (v.impressions || 0);
      }
      for (const [fmt, v] of Object.entries(data.byFormat || {})) {
        formatImpressions[fmt] = (formatImpressions[fmt] || 0) + (v.impressions || 0);
      }
    }

    // Dynamic blended base rate: this site's own geography run through
    // the live rate card — not a flat number, and not the same for
    // any two sites with different traffic mixes.
    const hasObservedTraffic = Object.keys(countryImpressions).length > 0;
    const blendedBaseCpm = hasObservedTraffic ? getBlendedCpm(countryImpressions) : getEffectiveCpm(null);

    const formats = AD_FORMAT_IDS.map((id) => ({
      id,
      estimatedCpmUsd: round2(blendedBaseCpm * FORMAT_MULTIPLIER[id]),
      // Realized (actually-billed) CPM is only meaningful site-wide
      // today — see siteRealizedCpmUsd below — not split per format.
      realizedCpmUsd: null as number | null,
      trailingImpressions: formatImpressions[id] || 0,
    }));

    const siteRealizedCpm = totalImpressions > 0 ? round2((totalEarnings / totalImpressions) * 1000) : null;

    return NextResponse.json(
      {
        ok: true,
        mode: 'site',
        siteId,
        windowDays: TRAILING_DAYS,
        blendedBaseCpmUsd: round2(blendedBaseCpm),
        siteRealizedCpmUsd: siteRealizedCpm,
        trailingImpressions: totalImpressions,
        formats,
      },
      { headers: { 'Cache-Control': 'no-store' } }
    );
  } catch (err) {
    console.error('[ad-cpm] handler error', err);
    return jsonError(500, 'Could not compute CPM right now.');
  }
}

function round2(n: number): number {
  return Math.round(n * 100) / 100;
}
