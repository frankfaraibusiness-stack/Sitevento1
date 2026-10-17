// app/api/domain-lookup/route.ts
//
// Best-effort WHOIS/registration lookup for the connect-site wizard's
// step 1. Purely cosmetic/informational — it never blocks or affects
// the actual connect flow (that still runs on normalizeUrl() +
// addDoc()/setDoc() in hooks/useConnectSiteWizard.ts). This route just
// gives the UI something to show off while the user is looking at the
// domain they typed: age, registrar, status, nameserver count.
//
// Uses RDAP (the modern, structured, JSON successor to port-43 WHOIS)
// via rdap.org's free bootstrap proxy, which resolves to the right
// registry RDAP server for virtually any TLD without us needing a
// per-TLD server list or an API key. No new dependency — same
// server-side fetch() + AbortController timeout pattern already used
// in app/api/verify-site/route.ts.
//
// Because registries differ a lot in what they expose (some redact
// everything post-GDPR, some .io/.ai-style registries return thin
// records, some TLDs have no RDAP server at all yet), every field is
// optional and the route always resolves with found:false rather than
// a 4xx/5xx when it can't get useful data — "skip and just show domain
// detected" per the product ask.

import { NextRequest, NextResponse } from 'next/server';

export const maxDuration = 10;
export const runtime = 'nodejs';

const FETCH_TIMEOUT_MS = 6000;

interface DomainLookupResult {
  found: boolean;
  domain: string;
  registrar: string | null;
  createdAt: string | null; // ISO date
  updatedAt: string | null; // ISO date
  expiresAt: string | null; // ISO date
  ageDays: number | null;
  status: string[];
  nameserverCount: number | null;
}

function emptyResult(domain: string): DomainLookupResult {
  return {
    found: false,
    domain,
    registrar: null,
    createdAt: null,
    updatedAt: null,
    expiresAt: null,
    ageDays: null,
    status: [],
    nameserverCount: null,
  };
}

// Registrable "domain.tld" from any hostname, dropping subdomains —
// RDAP registration records live at the registrable-domain level, so a
// lookup on app.example.com needs to query example.com.
function registrableDomain(hostname: string): string | null {
  const h = hostname.trim().toLowerCase().replace(/\.$/, '');
  if (!h || !/^[a-z0-9.-]+$/.test(h)) return null;
  const parts = h.split('.');
  if (parts.length < 2) return null;
  // Good-enough heuristic for common two-part public suffixes
  // (co.uk, com.au, etc.) without pulling in the full PSL dataset —
  // this is cosmetic data, not something that needs to be exact.
  const twoPartSuffixes = new Set([
    'co.uk', 'org.uk', 'me.uk', 'ac.uk', 'gov.uk',
    'com.au', 'net.au', 'org.au',
    'co.nz', 'co.jp', 'co.in', 'co.za',
    'com.br', 'com.mx',
  ]);
  if (parts.length > 2) {
    const lastTwo = parts.slice(-2).join('.');
    if (twoPartSuffixes.has(lastTwo)) return parts.slice(-3).join('.');
  }
  return parts.slice(-2).join('.');
}

async function fetchJsonWithTimeout(url: string): Promise<any | null> {
  const controller = new AbortController();
  const timer = setTimeout(() => controller.abort(), FETCH_TIMEOUT_MS);
  try {
    const res = await fetch(url, {
      signal: controller.signal,
      headers: {
        Accept: 'application/rdap+json, application/json',
        'User-Agent': 'sitevento-domain-lookup/1.0',
      },
    });
    if (!res.ok) return null;
    return await res.json().catch(() => null);
  } catch {
    return null;
  } finally {
    clearTimeout(timer);
  }
}

function pickEvent(events: any[], action: string): string | null {
  if (!Array.isArray(events)) return null;
  const hit = events.find((e) => e && e.eventAction === action && e.eventDate);
  return hit ? hit.eventDate : null;
}

function pickRegistrar(entities: any[]): string | null {
  if (!Array.isArray(entities)) return null;
  const registrar = entities.find((e) => Array.isArray(e?.roles) && e.roles.includes('registrar'));
  if (!registrar) return null;
  // vcardArray is RDAP's jCard format: ["vcard", [["version",...], ["fn", {}, "text", "Name Inc"], ...]]
  const vcard = registrar.vcardArray;
  if (Array.isArray(vcard) && Array.isArray(vcard[1])) {
    const fn = vcard[1].find((row: any) => Array.isArray(row) && row[0] === 'fn');
    if (fn && typeof fn[3] === 'string') return fn[3];
  }
  return typeof registrar.handle === 'string' ? registrar.handle : null;
}

export async function POST(req: NextRequest) {
  const body = await req.json().catch(() => ({}));
  const rawDomain = typeof body?.domain === 'string' ? body.domain : '';

  let hostname = rawDomain.trim();
  try {
    // Accept either a bare hostname or a full URL — same leniency as
    // the wizard's own normalizeUrl().
    hostname = hostname.includes('://') ? new URL(hostname).hostname : hostname.replace(/\/.*$/, '');
  } catch {
    // leave as-is; registrableDomain() below will reject it if it's junk
  }

  const domain = registrableDomain(hostname);
  if (!domain) {
    return NextResponse.json(emptyResult(rawDomain), { status: 200 });
  }

  const data = await fetchJsonWithTimeout(`https://rdap.org/domain/${encodeURIComponent(domain)}`);
  if (!data || typeof data !== 'object') {
    return NextResponse.json(emptyResult(domain), { status: 200 });
  }

  const createdAt = pickEvent(data.events, 'registration');
  const updatedAt = pickEvent(data.events, 'last changed');
  const expiresAt = pickEvent(data.events, 'expiration');
  const registrar = pickRegistrar(data.entities);
  const status: string[] = Array.isArray(data.status) ? data.status.filter((s: unknown) => typeof s === 'string') : [];
  const nameserverCount = Array.isArray(data.nameservers) ? data.nameservers.length : null;

  let ageDays: number | null = null;
  if (createdAt) {
    const created = new Date(createdAt).getTime();
    if (!isNaN(created)) ageDays = Math.max(0, Math.floor((Date.now() - created) / 86_400_000));
  }

  const found = Boolean(createdAt || registrar || status.length || nameserverCount);

  const result: DomainLookupResult = {
    found,
    domain,
    registrar,
    createdAt,
    updatedAt,
    expiresAt,
    ageDays,
    status,
    nameserverCount,
  };

  return NextResponse.json(result, { status: 200 });
}
