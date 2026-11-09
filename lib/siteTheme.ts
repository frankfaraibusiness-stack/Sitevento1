// lib/siteTheme.ts
//
// Dependency-free "what does this site look like, and what is it built
// with" detection, run against raw HTML already fetched by
// app/api/site-reachability/route.ts (step 2) and app/api/verify-site/
// route.ts (step 3) — no third fetch, no headless browser. Same
// honesty constraint as lib/siteMetadata.ts: every field is either a
// real signal found in the markup/headers, or null/'unknown'. Nothing
// here is guessed or synthesized.
//
// Why no real computed-CSS color resolution: getting a page's actual
// rendered background/text color requires parsing stylesheets, the
// cascade, specificity and media queries — effectively a mini browser
// engine. This environment has no sharp/canvas/puppeteer/playwright
// (see package.json) and this is a Vercel serverless function
// (maxDuration/runtime: 'nodejs' conventions throughout this codebase),
// where a headless-browser dependency is a heavy, often-unreliable
// choice (large cold-start bundles, binary compatibility issues). So
// colors here are *candidates* extracted from what raw HTML/CSS text
// can honestly support — explicit theme-color tags, CSS custom
// properties, and frequency of color declarations in <style> blocks —
// each tagged with the signal that produced it, ranked by confidence.
// backgroundColor/textColor are deliberately left null rather than
// faked from a guess at which element is "the" body background.
//
// Platform detection is the same kind of best-effort, multi-signal
// match: each platform has a small set of near-unique fingerprints
// (a CDN hostname, a global JS variable, a generator meta tag, a
// response header) that are each independently cheap to regex-check
// against the same HTML buffer already in memory.

export type SiteColorSource = 'theme-color' | 'theme-color-dark' | 'css-variable' | 'css-frequency';

export interface SiteColorCandidate {
  value: string; // normalized lowercase hex, e.g. "#1a2e05"
  source: SiteColorSource;
  // For css-variable: the variable name (e.g. "--brand"). For
  // css-frequency: how many times this exact color value appeared in
  // background/color declarations. Omitted for theme-color sources.
  detail?: string;
  count?: number;
}

export type SitePlatform =
  | 'shopify'
  | 'wordpress'
  | 'wix'
  | 'squarespace'
  | 'webflow'
  | 'nextjs'
  | 'other'
  | 'unknown';

export interface SiteTheme {
  // Best single accent-color guess — the highest-confidence candidate
  // in `colors`, or null if nothing was found. Widget designers can
  // use this directly without caring about the ranking logic.
  primaryColor: string | null;
  // Every candidate found, highest confidence first, capped — see
  // MAX_COLOR_CANDIDATES. Lets a UI show "we found these colors on
  // your site" rather than just one guess.
  colors: SiteColorCandidate[];
  // Deliberately not resolved — see module comment above.
  backgroundColor: string | null;
  textColor: string | null;
  // Font-family values found in <style> blocks / inline styles on
  // html/body, cleaned of generic fallback stacks (sans-serif, Arial,
  // etc. are kept only if nothing more specific was found), most
  // frequent first. Empty array, not null, when nothing is found —
  // matches SiteDomainInfo.status's empty-array convention.
  fonts: string[];
  platform: SitePlatform;
  // Human-readable label for the platform when it's known from a
  // <meta name="generator"> tag that names a specific product
  // generic detection doesn't cover (e.g. "Ghost 5.42", "Squarespace
  // 7.1") — null otherwise, including when platform is a value from
  // the enum above whose name is already self-explanatory.
  platformDetail: string | null;
  detectedAt: string; // ISO timestamp of this detection, for display/staleness
}

export function emptySiteTheme(overrides: Partial<SiteTheme> = {}): SiteTheme {
  return {
    primaryColor: null,
    colors: [],
    backgroundColor: null,
    textColor: null,
    fonts: [],
    platform: 'unknown',
    platformDetail: null,
    detectedAt: new Date().toISOString(),
    ...overrides,
  };
}

const MAX_COLOR_CANDIDATES = 8;
const MAX_FONTS = 5;

// ── Color helpers ────────────────────────────────────────────────────

const HEX_RE = /#(?:[0-9a-f]{3}|[0-9a-f]{4}|[0-9a-f]{6}|[0-9a-f]{8})\b/gi;

function normalizeHex(raw: string): string | null {
  let h = raw.trim().toLowerCase();
  if (!/^#[0-9a-f]{3,8}$/.test(h)) return null;
  // Expand 3-digit shorthand (#abc -> #aabbcc); leave 4/6/8 as-is
  // (4/8 carry an alpha channel we don't strip, since "the color
  // including its declared alpha" is still an honest candidate).
  if (h.length === 4) {
    h = '#' + [...h.slice(1)].map((c) => c + c).join('');
  }
  return h;
}

// Treat near-white/near-black/pure-gray as low-signal: almost every
// site has #fff/#000/#333 somewhere for text or borders, and surfacing
// those as "your site's theme color" would be actively misleading
// rather than just imprecise.
function isLowSignalColor(hex: string): boolean {
  const h = hex.replace('#', '');
  if (h.length < 6) return true; // skip 3/4-digit shorthands from this check entirely — expanded above
  const r = parseInt(h.slice(0, 2), 16);
  const g = parseInt(h.slice(2, 4), 16);
  const b = parseInt(h.slice(4, 6), 16);
  const max = Math.max(r, g, b);
  const min = Math.min(r, g, b);
  const isGrayscale = max - min < 12; // low saturation: white, black, or a gray
  const isNearWhite = r > 240 && g > 240 && b > 240;
  const isNearBlack = r < 15 && g < 15 && b < 15;
  return isGrayscale || isNearWhite || isNearBlack;
}

function extractThemeColorCandidates(html: string): SiteColorCandidate[] {
  const out: SiteColorCandidate[] = [];
  // Standard tag, plus the light/dark media-query variant some sites
  // ship in pairs: <meta name="theme-color" media="(prefers-color-scheme: dark)" content="...">
  const metaRe = /<meta[^>]+name=["']theme-color["'][^>]*>/gi;
  let m: RegExpExecArray | null;
  while ((m = metaRe.exec(html))) {
    const tag = m[0];
    const contentMatch = tag.match(/content=["']([^"']*)["']/i);
    const mediaMatch = tag.match(/media=["']([^"']*)["']/i);
    if (!contentMatch) continue;
    const hex = normalizeHex(contentMatch[1]);
    if (!hex) continue;
    const isDark = mediaMatch ? /dark/i.test(mediaMatch[1]) : false;
    out.push({ value: hex, source: isDark ? 'theme-color-dark' : 'theme-color' });
  }
  return out;
}

const BRAND_VAR_NAME_RE = /--(?:[\w-]*?)(primary|brand|accent|theme)[\w-]*/i;

function extractCssVariableCandidates(styleBlocks: string[]): SiteColorCandidate[] {
  const out: SiteColorCandidate[] = [];
  const seen = new Set<string>();
  for (const block of styleBlocks) {
    // --name: value; — capture any custom property whose name looks
    // brand-related, then pull the first hex color out of its value
    // (a var's value might be "rgb(...)" or a gradient; we only take
    // the honest win of a direct hex literal, not an rgb()-to-hex
    // conversion that could misread alpha/format).
    const declRe = /(--[\w-]+)\s*:\s*([^;}{]+)[;}]/g;
    let d: RegExpExecArray | null;
    while ((d = declRe.exec(block))) {
      const varName = d[1];
      if (!BRAND_VAR_NAME_RE.test(varName)) continue;
      const valueHexMatch = d[2].match(HEX_RE);
      if (!valueHexMatch) continue;
      const hex = normalizeHex(valueHexMatch[0]);
      if (!hex || isLowSignalColor(hex)) continue;
      const key = `${varName}:${hex}`;
      if (seen.has(key)) continue;
      seen.add(key);
      out.push({ value: hex, source: 'css-variable', detail: varName });
    }
  }
  return out;
}

// background/background-color/color declarations only — not every hex
// on the page (border colors, shadows, etc. would just add noise to
// "what color is this site"), frequency-ranked so the color used most
// often across the page's own stylesheet wins.
function extractFrequencyCandidates(styleBlocks: string[]): SiteColorCandidate[] {
  const counts = new Map<string, number>();
  const declRe = /\b(?:background(?:-color)?|color)\s*:\s*([^;}{]+)[;}]/gi;
  for (const block of styleBlocks) {
    let d: RegExpExecArray | null;
    while ((d = declRe.exec(block))) {
      const hexMatch = d[1].match(HEX_RE);
      if (!hexMatch) continue;
      const hex = normalizeHex(hexMatch[0]);
      if (!hex || isLowSignalColor(hex)) continue;
      counts.set(hex, (counts.get(hex) || 0) + 1);
    }
  }
  return [...counts.entries()]
    .sort((a, b) => b[1] - a[1])
    .map(([value, count]) => ({ value, source: 'css-frequency' as const, count }));
}

function rankColorCandidates(candidates: SiteColorCandidate[]): SiteColorCandidate[] {
  // Confidence order: explicit theme-color (light) > theme-color
  // (dark, since it's still explicit site intent but a secondary one)
  // > a named brand CSS variable > frequency-based guess. Within a
  // source, keep the order already produced (theme-color: document
  // order; css-variable: document order; css-frequency: already
  // sorted by count). De-dupe by hex value, keeping the
  // highest-confidence occurrence.
  const order: Record<SiteColorSource, number> = {
    'theme-color': 0,
    'theme-color-dark': 1,
    'css-variable': 2,
    'css-frequency': 3,
  };
  const byValue = new Map<string, SiteColorCandidate>();
  for (const c of candidates) {
    const existing = byValue.get(c.value);
    if (!existing || order[c.source] < order[existing.source]) {
      byValue.set(c.value, c);
    }
  }
  return [...byValue.values()]
    .sort((a, b) => order[a.source] - order[b.source])
    .slice(0, MAX_COLOR_CANDIDATES);
}

// ── Font helpers ─────────────────────────────────────────────────────

const GENERIC_FONT_FALLBACKS = new Set([
  'sans-serif',
  'serif',
  'monospace',
  'cursive',
  'fantasy',
  'system-ui',
  'ui-sans-serif',
  'ui-serif',
  'ui-monospace',
  '-apple-system',
  'blinkmacsystemfont',
  'segoe ui',
  'helvetica',
  'helvetica neue',
  'arial',
]);

function extractFontCandidates(styleBlocks: string[]): string[] {
  const counts = new Map<string, number>();
  const declRe = /font-family\s*:\s*([^;}{]+)[;}]/gi;
  for (const block of styleBlocks) {
    let d: RegExpExecArray | null;
    while ((d = declRe.exec(block))) {
      // Split a stack like "'Inter', -apple-system, sans-serif" and
      // take only the first, most-specific entry — the fallback chain
      // isn't "the site's font", just what it degrades to.
      const first = d[1].split(',')[0].trim().replace(/^['"]|['"]$/g, '');
      if (!first) continue;
      const lower = first.toLowerCase();
      if (GENERIC_FONT_FALLBACKS.has(lower)) continue;
      counts.set(first, (counts.get(first) || 0) + 1);
    }
  }
  return [...counts.entries()]
    .sort((a, b) => b[1] - a[1])
    .map(([name]) => name)
    .slice(0, MAX_FONTS);
}

// ── Platform detection ───────────────────────────────────────────────
//
// Each check below is independently cheap and only needs the raw HTML
// (plus, where available, response headers) — no platform's detection
// depends on another's running first. A page can in principle trip
// more than one (e.g. a Shopify theme built with some Webflow-exported
// component pasted in); detectPlatform returns the first match in the
// priority order below, chosen so a platform-specific fingerprint
// always wins over the generic Next.js one (many Shopify/WordPress
// sites also happen to use a Next.js storefront front-end, but
// "Shopify" is the more useful answer for a site owner than "Next.js").

interface PlatformCheck {
  platform: SitePlatform;
  test: (html: string, headers: Headers | null) => boolean;
}

const PLATFORM_CHECKS: PlatformCheck[] = [
  {
    platform: 'shopify',
    test: (html, headers) =>
      /cdn\.shopify\.com/i.test(html) ||
      /Shopify\.shop\s*=/i.test(html) ||
      /window\.Shopify\s*=/i.test(html) ||
      !!headers?.get('x-shopify-stage') ||
      !!headers?.get('x-shardid'),
  },
  {
    platform: 'wix',
    test: (html) => /static\.wixstatic\.com/i.test(html) || /wix-code-public-path/i.test(html) || /_wixCssg/i.test(html),
  },
  {
    platform: 'squarespace',
    test: (html) => /squarespace\.com/i.test(html) || /Static\.SQUARESPACE_CONTEXT/i.test(html) || /squarespace-cdn\.com/i.test(html),
  },
  {
    platform: 'webflow',
    test: (html) => /data-wf-site=/i.test(html) || /data-wf-page=/i.test(html) || /webflow\.com\/west/i.test(html) || /assets-global\.website-files\.com/i.test(html),
  },
  {
    platform: 'wordpress',
    test: (html) => /wp-content\//i.test(html) || /wp-includes\//i.test(html) || /\/wp-json\//i.test(html),
  },
  {
    platform: 'nextjs',
    test: (html) => /__NEXT_DATA__/i.test(html) || /\/_next\/static\//i.test(html),
  },
];

function extractGeneratorMeta(html: string): string | null {
  const m = html.match(/<meta[^>]+name=["']generator["'][^>]*content=["']([^"']*)["']/i);
  if (!m) return null;
  return m[1].trim().slice(0, 100) || null;
}

function detectPlatform(html: string, headers: Headers | null): { platform: SitePlatform; platformDetail: string | null } {
  for (const check of PLATFORM_CHECKS) {
    if (check.test(html, headers)) {
      return { platform: check.platform, platformDetail: null };
    }
  }
  // No fingerprint matched, but a generator tag might still name
  // something specific (Ghost, Hugo, Jekyll, Drupal, Wix Editor X's
  // own generator string pre-fingerprint, etc.) — still useful even
  // though it doesn't map to one of our first-class platform values.
  const generator = extractGeneratorMeta(html);
  if (generator) {
    return { platform: 'other', platformDetail: generator };
  }
  return { platform: 'unknown', platformDetail: null };
}

// ── Main entry point ─────────────────────────────────────────────────

function extractStyleBlocks(html: string): string[] {
  const blocks: string[] = [];
  const styleRe = /<style[^>]*>([\s\S]*?)<\/style>/gi;
  let m: RegExpExecArray | null;
  while ((m = styleRe.exec(html))) {
    blocks.push(m[1]);
  }
  // Inline style="" attributes carry real signal too (a hero section's
  // background set directly on the element, which is common on
  // page-builder exports like Wix/Squarespace) — fold them in as their
  // own pseudo-block so the same frequency/variable extraction logic
  // covers them without a separate code path.
  const inlineStyles: string[] = [];
  const inlineRe = /style=["']([^"']*)["']/gi;
  let im: RegExpExecArray | null;
  while ((im = inlineRe.exec(html))) {
    inlineStyles.push(im[1]);
  }
  if (inlineStyles.length > 0) blocks.push(inlineStyles.join(';'));
  return blocks;
}

/**
 * Detect a site's theme (colors, fonts) and underlying platform from
 * already-fetched HTML. Pure, synchronous, and side-effect free — does
 * no network I/O itself, so callers decide when/how often to re-run it
 * against freshly fetched HTML (see app/api/site-reachability and
 * app/api/verify-site, which each already have an HTML buffer in hand
 * for their own purposes and pass it here too rather than fetching a
 * third time).
 *
 * @param html The page's HTML (a prefix is fine — head/early-body is
 *   where theme-color, CSS variables, and <style> blocks normally
 *   live; callers already cap how much they read for their own
 *   metadata-scan reasons).
 * @param headers Optional response headers from the same fetch, used
 *   only for a couple of platform fingerprints (e.g. Shopify's
 *   x-shopify-stage) that are more reliable from headers than markup.
 *   Pass null if unavailable — platform detection still runs on HTML
 *   alone, just without that one extra signal.
 */
export function detectSiteTheme(html: string, headers: Headers | null = null): SiteTheme {
  const styleBlocks = extractStyleBlocks(html);

  const themeColorCandidates = extractThemeColorCandidates(html);
  const cssVarCandidates = extractCssVariableCandidates(styleBlocks);
  const frequencyCandidates = extractFrequencyCandidates(styleBlocks);
  const colors = rankColorCandidates([...themeColorCandidates, ...cssVarCandidates, ...frequencyCandidates]);

  const fonts = extractFontCandidates(styleBlocks);
  const { platform, platformDetail } = detectPlatform(html, headers);

  return {
    primaryColor: colors[0]?.value ?? null,
    colors,
    backgroundColor: null,
    textColor: null,
    fonts,
    platform,
    platformDetail,
    detectedAt: new Date().toISOString(),
  };
}
