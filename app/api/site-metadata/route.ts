// app/api/site-metadata/route.ts
//
// POST { url }
//
// Best-effort fetch of a site's own public <head> — title, meta
// description, and theme-color — so the FAQ Page widget's designer
// (components/widgets/designer/FaqListField.tsx) can hand the AI
// generator real context about the business ("Acme Plumbing — 24/7
// emergency plumbing in Austin, TX") instead of making the owner type
// it all out, and can suggest the site's own theme-color as the
// widget's accent. Same spirit as app/api/domain-lookup — purely
// informational, server-side because the designer runs in the
// dashboard's own origin and a fetch() straight from the browser to an
// arbitrary third-party site would be blocked by that site's CORS
// policy (most sites don't send Access-Control-Allow-Origin for
// cross-site reads at all). Never blocks or affects anything else —
// a failed/timed-out lookup just means the AI generator falls back to
// whatever the owner typed into the description box themselves.
//
// No auth required: this only ever reads the PUBLIC head of a URL the
// caller already supplied (same trust level as pasting that URL into
// a browser yourself), and returns nothing about Sitevento's own
// records — same reasoning as domain-lookup needing none either.
import { NextRequest, NextResponse } from 'next/server';
import { isValidPageUrl } from '@/lib/widgets';
import { allow } from '@/lib/rateLimit';

export const maxDuration = 10;
export const runtime = 'nodejs';

const MAX_HTML_BYTES = 300 * 1024; // head is always near the top; no need to read a whole large page
const FETCH_TIMEOUT_MS = 6000;

export interface SiteMetadataResult {
  ok: boolean;
  title: string | null;
  description: string | null;
  themeColor: string | null;
}

function emptyResult(): SiteMetadataResult {
  return { ok: false, title: null, description: null, themeColor: null };
}

function decodeEntities(s: string): string {
  return s
    .replace(/&amp;/g, '&')
    .replace(/&lt;/g, '<')
    .replace(/&gt;/g, '>')
    .replace(/&quot;/g, '"')
    .replace(/&#0?39;/g, "'")
    .replace(/&nbsp;/g, ' ')
    .trim();
}

function extractMeta(html: string, attrNamePattern: string): string | null {
  // Matches both <meta name="description" content="..."> and the
  // reverse attribute order some sites emit, single- or double-quoted.
  const re = new RegExp(
    `<meta[^>]+(?:name|property)=["']${attrNamePattern}["'][^>]*content=["']([^"']*)["']|<meta[^>]+content=["']([^"']*)["'][^>]*(?:name|property)=["']${attrNamePattern}["']`,
    'i'
  );
  const m = html.match(re);
  const raw = m ? m[1] ?? m[2] : null;
  return raw ? decodeEntities(raw).slice(0, 400) : null;
}

function extractTitle(html: string): string | null {
  const m = html.match(/<title[^>]*>([^<]*)<\/title>/i);
  return m ? decodeEntities(m[1]).slice(0, 200) : null;
}

function extractThemeColor(html: string): string | null {
  const direct = extractMeta(html, 'theme-color');
  if (direct && /^#[0-9a-f]{3,8}$/i.test(direct.trim())) return direct.trim();
  return null;
}

export async function POST(req: NextRequest) {
  const forwardedFor = req.headers.get('x-forwarded-for') || '';
  const ip = forwardedFor.split(',')[0].trim() || 'unknown';
  if (!allow(`site-metadata:${ip}`, 20, 60_000)) {
    return NextResponse.json(emptyResult(), { status: 200 });
  }

  const body = await req.json().catch(() => ({}));
  const rawUrl = typeof body?.url === 'string' ? body.url : '';
  if (!isValidPageUrl(rawUrl)) {
    return NextResponse.json(emptyResult(), { status: 200 });
  }

  try {
    const res = await fetch(rawUrl, {
      signal: AbortSignal.timeout(FETCH_TIMEOUT_MS),
      headers: { 'User-Agent': 'Mozilla/5.0 (compatible; SiteventoBot/1.0; +https://sitevento.com)' },
      redirect: 'follow',
    });
    if (!res.ok || !res.body) {
      return NextResponse.json(emptyResult(), { status: 200 });
    }
    const contentType = res.headers.get('content-type') || '';
    if (!contentType.includes('text/html')) {
      return NextResponse.json(emptyResult(), { status: 200 });
    }

    // Read only up to MAX_HTML_BYTES — the head is always near the
    // top of a well-formed document, so there's no need to buffer an
    // entire large page just to read three meta values.
    const reader = res.body.getReader();
    let received = 0;
    const chunks: Uint8Array[] = [];
    while (received < MAX_HTML_BYTES) {
      const { done, value } = await reader.read();
      if (done) break;
      if (value) {
        chunks.push(value);
        received += value.byteLength;
      }
    }
    try {
      await reader.cancel();
    } catch {
      // best-effort; nothing to do if the underlying stream is already closed
    }
    const html = Buffer.concat(chunks.map((c) => Buffer.from(c))).toString('utf-8');

    const result: SiteMetadataResult = {
      ok: true,
      title: extractTitle(html),
      description: extractMeta(html, 'description'),
      themeColor: extractThemeColor(html),
    };
    return NextResponse.json(result, { status: 200 });
  } catch (err) {
    console.error('[site-metadata] fetch error', err);
    return NextResponse.json(emptyResult(), { status: 200 });
  }
}
