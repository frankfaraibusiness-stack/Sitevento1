// app/api/site-reachability/route.ts
//
// POST { idToken, siteId }
//
// Step 2 of the connect flow (components/connect/VerifyFlow.tsx) needs
// to answer a question step 1's RDAP lookup can't: a domain can be
// fully registered (lib/domainLookup.ts says so) with NO live site
// behind it at all — parked, DNS not pointed anywhere yet, server
// down, etc. This route is the "is anything actually answering at
// this URL" check, run server-side (same CORS-avoidance reason
// app/api/verify-site/route.ts's own header comment gives) against
// the site's OWN url field on its Firestore doc — never an arbitrary
// client-supplied URL, so this can't be used as an open fetch-any-URL
// proxy. If the site responds, this also extracts the same ordinary
// <head> metadata (title, description, Open Graph tags, favicon,
// etc.) the connect page's design shows, so the owner gets a real
// preview of what's actually live there.
//
// Deliberately separate from app/api/verify-site/route.ts, which has
// a different job (confirm the install tag is present, then flip
// status: 'verified') and a different trust model (it writes to
// Firestore on success). This route only ever reads — it never
// touches the site doc — so a reachability check can run as many
// times as the owner likes while they're fixing DNS/hosting, with no
// side effects, before they're ready to install the tag and run the
// real verification check.
import { NextRequest, NextResponse } from 'next/server';
import { getAdminApp, getAdminDb, jsonError, verifyCaller, rateLimitOk } from '@/lib/serverAuth';
import { type SiteMetadataResult, emptySiteMetadataResult } from '@/lib/siteMetadata';
import { detectSiteTheme } from '@/lib/siteTheme';

export const maxDuration = 15;
export const runtime = 'nodejs';

const FETCH_TIMEOUT_MS = 10000;
const MAX_BODY_BYTES = 2 * 1024 * 1024; // 2MB — the <head> is always near the top

async function fetchHtmlWithTimeout(url: string) {
  const controller = new AbortController();
  const timer = setTimeout(() => controller.abort(), FETCH_TIMEOUT_MS);
  try {
    const res = await fetch(url, {
      method: 'GET',
      signal: controller.signal,
      redirect: 'follow',
      headers: {
        'User-Agent': 'sitevento-verify-bot/1.0',
        Accept: 'text/html,application/xhtml+xml',
      },
    });

    if (!res.ok) {
      return { ok: false as const, status: res.status, finalUrl: res.url };
    }

    const reader = res.body?.getReader ? res.body.getReader() : null;
    if (!reader) {
      const text = await res.text();
      return { ok: true as const, html: text.slice(0, MAX_BODY_BYTES), finalUrl: res.url, headers: res.headers };
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
      /* ignore */
    }

    const buffer = Buffer.concat(chunks.map((c) => Buffer.from(c)));
    return { ok: true as const, html: buffer.toString('utf-8', 0, MAX_BODY_BYTES), finalUrl: res.url, headers: res.headers };
  } finally {
    clearTimeout(timer);
  }
}

// Minimal, dependency-free <head> metadata scan — regex-based like
// verify-site's own tag checks, rather than pulling in a DOM parser
// for a Node serverless function. Each getter is independently
// best-effort: a malformed or missing tag just yields null for that
// one field instead of failing the whole extraction.
function extractMeta(html: string, baseUrl: string): Omit<SiteMetadataResult, 'reachable' | 'httpStatus' | 'finalUrl' | 'errorMessage' | 'siteTheme'> {
  const head = html.slice(0, 200_000); // metadata always lives in <head>, near the top

  function metaContent(attr: 'name' | 'property', value: string): string | null {
    const escaped = value.replace(/[.*+?^${}()|[\]\\]/g, '\\$&');
    const re1 = new RegExp(`<meta[^>]*${attr}=["']${escaped}["'][^>]*content=["']([^"']*)["'][^>]*>`, 'i');
    const re2 = new RegExp(`<meta[^>]*content=["']([^"']*)["'][^>]*${attr}=["']${escaped}["'][^>]*>`, 'i');
    const m = head.match(re1) || head.match(re2);
    return m ? decodeHtmlEntities(m[1].trim()) || null : null;
  }

  function linkHref(relPattern: RegExp): string | null {
    const m = head.match(relPattern);
    return m ? m[1] : null;
  }

  function decodeHtmlEntities(s: string): string {
    return s
      .replace(/&amp;/g, '&')
      .replace(/&lt;/g, '<')
      .replace(/&gt;/g, '>')
      .replace(/&quot;/g, '"')
      .replace(/&#0?39;/g, "'");
  }

  function resolve(u: string | null): string | null {
    if (!u) return null;
    try {
      return new URL(u, baseUrl).href;
    } catch {
      return u;
    }
  }

  const titleMatch = head.match(/<title[^>]*>([\s\S]*?)<\/title>/i);
  const title = titleMatch ? decodeHtmlEntities(titleMatch[1].trim()) || null : null;

  const description = metaContent('name', 'description') || metaContent('property', 'og:description') || metaContent('name', 'twitter:description');
  const ogTitle = metaContent('property', 'og:title') || metaContent('name', 'twitter:title');
  const ogDescription = metaContent('property', 'og:description') || metaContent('name', 'twitter:description');
  const ogImage = resolve(metaContent('property', 'og:image') || metaContent('name', 'twitter:image'));
  const ogSiteName = metaContent('property', 'og:site_name');
  const ogType = metaContent('property', 'og:type');
  const twitterCard = metaContent('name', 'twitter:card');
  const themeColor = metaContent('name', 'theme-color');
  const author = metaContent('name', 'author');
  const keywordsRaw = metaContent('name', 'keywords');
  const keywords = keywordsRaw ? keywordsRaw.split(',').map((s) => s.trim()).filter(Boolean) : [];
  const canonical = resolve(linkHref(/<link[^>]*rel=["']canonical["'][^>]*href=["']([^"']*)["']/i) || linkHref(/<link[^>]*href=["']([^"']*)["'][^>]*rel=["']canonical["']/i));
  const favicon = resolve(linkHref(/<link[^>]*rel=["'][^"']*icon[^"']*["'][^>]*href=["']([^"']*)["']/i) || linkHref(/<link[^>]*href=["']([^"']*)["'][^>]*rel=["'][^"']*icon[^"']*["']/i));

  return {
    title,
    description,
    ogTitle,
    ogDescription,
    ogImage,
    ogSiteName,
    ogType,
    twitterCard,
    themeColor,
    author,
    keywords,
    canonical,
    favicon,
  };
}

export async function POST(req: NextRequest) {
  const body = await req.json().catch(() => ({}));
  const { idToken, siteId } = body || {};

  if (!siteId || typeof siteId !== 'string') {
    return jsonError(400, 'Missing siteId.');
  }

  let app;
  try {
    app = getAdminApp();
  } catch (err) {
    console.error('[site-reachability] Firebase Admin init error', err);
    return jsonError(500, 'Server is not configured yet (missing Firebase Admin credentials).');
  }

  const uid = await verifyCaller(app, idToken);
  if (!uid) {
    return jsonError(401, 'Invalid or expired session. Please sign in again.');
  }

  if (!rateLimitOk(`site-reachability:${uid}`, 20, 60_000)) {
    return jsonError(429, 'Too many requests. Please try again shortly.');
  }

  const db = getAdminDb();
  const siteRef = db.collection('users').doc(uid).collection('sites').doc(siteId);
  let siteSnap;
  try {
    siteSnap = await siteRef.get();
  } catch (err) {
    console.error('[site-reachability] Firestore read error', err);
    return jsonError(500, 'Could not read site record.');
  }

  if (!siteSnap.exists) {
    return jsonError(404, 'Site not found.');
  }

  const siteData = siteSnap.data() || {};
  const url = typeof siteData.url === 'string' ? siteData.url : null;
  if (!url) {
    return jsonError(400, 'This site has no URL on record.');
  }

  let targetUrl: URL;
  try {
    targetUrl = new URL(url);
    if (targetUrl.protocol !== 'http:' && targetUrl.protocol !== 'https:') throw new Error('bad protocol');
  } catch {
    return jsonError(400, 'This site has an invalid URL on record.');
  }

  try {
    const fetchResult = await fetchHtmlWithTimeout(targetUrl.toString());

    if (!fetchResult.ok) {
      return NextResponse.json(
        emptySiteMetadataResult({
          httpStatus: fetchResult.status,
          finalUrl: fetchResult.finalUrl,
          errorMessage: `The site responded with an error (HTTP ${fetchResult.status}).`,
        }),
        { status: 200, headers: { 'Cache-Control': 'no-store' } }
      );
    }

    const meta = extractMeta(fetchResult.html, fetchResult.finalUrl);
    // Reuses the same HTML buffer already fetched above for the tag/
    // metadata scan — no second fetch. This route never writes to the
    // site doc (see header comment); the result is a live preview only,
    // persisted for real by app/api/verify-site/route.ts once
    // verification actually succeeds.
    const siteTheme = detectSiteTheme(fetchResult.html, fetchResult.headers ?? null);
    return NextResponse.json(
      { ...emptySiteMetadataResult(), reachable: true, httpStatus: 200, finalUrl: fetchResult.finalUrl, ...meta, siteTheme },
      { status: 200, headers: { 'Cache-Control': 'no-store' } }
    );
  } catch (err) {
    const timedOut = err instanceof Error && err.name === 'AbortError';
    return NextResponse.json(
      emptySiteMetadataResult({
        errorMessage: timedOut
          ? 'The site took too long to respond.'
          : "Couldn't reach that site. It may be offline, or the domain may not be pointed at a live server yet.",
      }),
      { status: 200, headers: { 'Cache-Control': 'no-store' } }
    );
  }
}
