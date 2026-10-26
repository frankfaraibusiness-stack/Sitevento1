// app/api/verify-site/route.ts
//
// Port of the original api/verify-site.js Vercel function to a Next.js
// App Router Route Handler. Fetches the submitted site URL server-side
// (avoiding the browser CORS restriction a client-side fetch would hit
// on most real-world domains) and checks the page's HTML for BOTH
// halves of the install tag (see hooks/useConnectSiteWizard.ts's
// copyConnectTag, which gives the owner both lines together):
//
//   <meta name="sitevento" content="{siteId}">
//   <script src="{origin}/sitevento.js" data-site="{siteId}" ...>
//
// Checking only the meta tag was the actual tracking bug this route
// used to have: the meta tag is inert (sitevento.js only reads it as a
// belt-and-braces identity cross-check against its own data-site
// attribute — see that script's comments), so a page could pass
// verification with the meta tag pasted in and the <script> tag that
// does all the actual tracking/widget/overlay work left out entirely.
// That site would then show status: 'verified' in the dashboard while
// silently sending zero visit beacons forever, with nothing anywhere
// surfacing why. Requiring both tags here means "verified" now
// actually implies "the tracking script is installed and can run."
//
// On success, it uses the Firebase Admin SDK (trusted, server-side
// only) to flip that site's Firestore doc to status: 'verified'. The
// frontend's onSnapshot listener on that doc then picks up the change
// and advances the UI.
//
// Deploy notes:
//   - npm install firebase-admin
//   - Set FIREBASE_PROJECT_ID / FIREBASE_CLIENT_EMAIL / FIREBASE_PRIVATE_KEY
//     in the deployment's environment variables (Firebase Console ->
//     Project settings -> Service accounts -> Generate new private
//     key). FIREBASE_PRIVATE_KEY must keep its literal "\n" sequences;
//     the replace() below turns them back into real newlines at
//     runtime.
//   - Firestore security rules should NOT need a client-write exception
//     for the "verified" status change, since this route writes with
//     the Admin SDK, which bypasses security rules entirely.

import { NextRequest, NextResponse } from 'next/server';
import { initializeApp, getApps, cert } from 'firebase-admin/app';
import { getFirestore } from 'firebase-admin/firestore';

// Keep this modest — we're fetching one remote page and scanning its HTML.
export const maxDuration = 15;
export const runtime = 'nodejs';

function getAdminDb() {
  const app = getApps().length
    ? getApps()[0]
    : initializeApp({
        credential: cert({
          projectId: process.env.FIREBASE_PROJECT_ID,
          clientEmail: process.env.FIREBASE_CLIENT_EMAIL,
          privateKey: (process.env.FIREBASE_PRIVATE_KEY || '').replace(/\\n/g, '\n'),
        }),
      });
  return getFirestore(app);
}

const FETCH_TIMEOUT_MS = 8000;
const MAX_BODY_BYTES = 2 * 1024 * 1024; // 2MB is plenty for a <head> scan

function buildMetaTagRegex(siteId: string) {
  // Matches <meta name="sitevento" content="SITEID"> allowing attribute
  // order to be swapped, single or double quotes, extra whitespace,
  // and attributes wrapped across lines (see buildScriptTagRegex's
  // comment on why [\s\S]*? rather than [^>]*).
  const escapedId = siteId.replace(/[.*+?^${}()|[\]\\]/g, '\\$&');
  return new RegExp(
    `<meta[\\s\\S]*?name=["']sitevento["'][\\s\\S]*?content=["']${escapedId}["'][\\s\\S]*?>` +
      `|<meta[\\s\\S]*?content=["']${escapedId}["'][\\s\\S]*?name=["']sitevento["'][\\s\\S]*?>`,
    'i'
  );
}

// Matches the install snippet's <script> half — the piece that
// actually does the tracking/overlay/widget work (the meta tag above
// is just a belt-and-braces identity check sitevento.js itself reads).
// Only requires src="...sitevento.js" + data-site="SITEID" to both be
// present somewhere in the tag, in either order, with any other
// attributes (defer, type, etc.) around them — not the exact literal
// string the wizard hands out, so this still passes if the owner's own
// build tooling reorders/reformats attributes, or they install it via
// a tag manager that does the same.
function buildScriptTagRegex(siteId: string) {
  const escapedId = siteId.replace(/[.*+?^${}()|[\]\\]/g, '\\$&');
  const srcAttr = `src=["'][^"']*sitevento\\.js[^"']*["']`;
  const siteAttr = `data-site=["']${escapedId}["']`;
  // [\s\S]*? (not [^>]*) between attributes: some formatters/minifiers
  // wrap a long tag's attributes across lines, and [^>]* would refuse
  // to match across that newline since it's still "any char but >".
  // Non-greedy + bounded by the literal <script ... > on each side
  // keeps this from running away across unrelated tags.
  return new RegExp(
    `<script[\\s\\S]*?${srcAttr}[\\s\\S]*?${siteAttr}[\\s\\S]*?>` +
      `|<script[\\s\\S]*?${siteAttr}[\\s\\S]*?${srcAttr}[\\s\\S]*?>`,
    'i'
  );
}

async function fetchHtmlWithTimeout(url: string) {
  const controller = new AbortController();
  const timer = setTimeout(() => controller.abort(), FETCH_TIMEOUT_MS);
  try {
    const res = await fetch(url, {
      signal: controller.signal,
      redirect: 'follow',
      headers: {
        'User-Agent': 'sitevento-verify-bot/1.0',
      },
    });

    if (!res.ok) {
      return { ok: false as const, status: res.status };
    }

    // Read up to MAX_BODY_BYTES instead of the whole response, in case
    // of a very large page — the tag will be in <head>, near the top.
    const reader = res.body?.getReader ? res.body.getReader() : null;
    if (!reader) {
      // Environments without a streaming body reader: fall back to text().
      const text = await res.text();
      return { ok: true as const, html: text.slice(0, MAX_BODY_BYTES) };
    }

    let received = 0;
    const chunks: Uint8Array[] = [];
    while (received < MAX_BODY_BYTES) {
      const { done, value } = await reader.read();
      if (done) break;
      if (value) {
        chunks.push(value);
        received += value.length;
      }
    }
    try {
      await reader.cancel();
    } catch {
      // ignore
    }

    const buffer = Buffer.concat(chunks.map((c) => Buffer.from(c)));
    return { ok: true as const, html: buffer.toString('utf-8', 0, MAX_BODY_BYTES) };
  } finally {
    clearTimeout(timer);
  }
}

export async function POST(req: NextRequest) {
  const body = await req.json().catch(() => ({}));
  const { uid, siteId, url } = body || {};

  if (!uid || typeof uid !== 'string') {
    return NextResponse.json({ verified: false, message: 'Missing uid.' }, { status: 400 });
  }
  if (!siteId || typeof siteId !== 'string') {
    return NextResponse.json({ verified: false, message: 'Missing siteId.' }, { status: 400 });
  }
  if (!url || typeof url !== 'string') {
    return NextResponse.json({ verified: false, message: 'Missing url.' }, { status: 400 });
  }

  let targetUrl: URL;
  try {
    targetUrl = new URL(url);
    if (targetUrl.protocol !== 'http:' && targetUrl.protocol !== 'https:') {
      throw new Error('bad protocol');
    }
  } catch {
    return NextResponse.json({ verified: false, message: 'That URL is not valid.' }, { status: 400 });
  }

  let db;
  try {
    db = getAdminDb();
  } catch (err) {
    console.error('Firebase Admin init error', err);
    return NextResponse.json(
      {
        verified: false,
        message: 'Server is not configured to verify sites yet (missing Firebase Admin credentials).',
      },
      { status: 500 }
    );
  }

  // Confirm the site doc exists and belongs to this uid before doing
  // any network fetch or write — prevents verifying/overwriting a doc
  // the caller doesn't own, and avoids wasted fetches for bogus ids.
  const siteRef = db.collection('users').doc(uid).collection('sites').doc(siteId);
  let siteSnap;
  try {
    siteSnap = await siteRef.get();
  } catch (err) {
    console.error('Firestore read error', err);
    return NextResponse.json({ verified: false, message: 'Could not read site record.' }, { status: 500 });
  }

  if (!siteSnap.exists) {
    return NextResponse.json({ verified: false, message: 'Site not found.' }, { status: 404 });
  }

  // Fetch the live page and look for the tag.
  let fetchResult;
  try {
    fetchResult = await fetchHtmlWithTimeout(targetUrl.toString());
  } catch (err) {
    const timedOut = err instanceof Error && err.name === 'AbortError';
    return NextResponse.json(
      {
        verified: false,
        message: timedOut
          ? 'Your site took too long to respond. Please try again.'
          : "Couldn't reach that site. Check the URL and that it's publicly accessible.",
      },
      { status: 200 }
    );
  }

  if (!fetchResult.ok) {
    return NextResponse.json(
      { verified: false, message: `Your site responded with an error (HTTP ${fetchResult.status}).` },
      { status: 200 }
    );
  }

  // Both halves are required — the meta tag alone used to be enough to
  // pass, which let a site go "verified" with the actual tracking
  // script never installed, so it silently never tracked a single
  // visit. See the module comment above for the full story.
  const hasMetaTag = buildMetaTagRegex(siteId).test(fetchResult.html);
  const hasScriptTag = buildScriptTagRegex(siteId).test(fetchResult.html);

  if (!hasMetaTag || !hasScriptTag) {
    const message = !hasMetaTag && !hasScriptTag
      ? "Couldn't find the tag yet. Make sure it's pasted in the page's <head> and try again."
      : !hasScriptTag
        ? "Found the meta tag, but not the tracking script — make sure the <script src=\"...sitevento.js\"> line is on the page too, not just the <meta> line."
        : "Found the script tag, but not the meta tag — make sure both lines from the install snippet are on the page.";
    return NextResponse.json({ verified: false, message }, { status: 200 });
  }

  // Tag found — mark verified. Admin SDK write bypasses Firestore
  // security rules, which is why this has to happen server-side rather
  // than from the browser.
  try {
    await siteRef.update({
      status: 'verified',
      verifiedAt: new Date(),
    });
  } catch (err) {
    console.error('Firestore write error', err);
    return NextResponse.json(
      { verified: false, message: 'Tag found, but we could not save the result. Please try again.' },
      { status: 500 }
    );
  }

  return NextResponse.json({ verified: true, message: 'Site verified.' }, { status: 200 });
}
