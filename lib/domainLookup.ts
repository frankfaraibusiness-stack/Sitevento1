// lib/domainLookup.ts
//
// Shared RDAP (WHOIS successor) lookup logic — extracted out of
// app/api/domain-lookup/route.ts so the exact same best-effort lookup
// can also be called server-side at site-creation time
// (app/api/connect-site/route.ts), persisting a permanent snapshot
// onto the new site doc instead of the info only ever being shown
// transiently in the connect wizard's cosmetic "domain intel" card.
//
// Nothing about the lookup semantics changed from the original route:
// same rdap.org bootstrap proxy, same timeout, same "always resolve,
// never throw" contract — found:false just means we couldn't get
// useful data for that domain/TLD, not an error.
export interface DomainLookupResult {
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

const FETCH_TIMEOUT_MS = 6000;

export function emptyDomainLookupResult(domain: string): DomainLookupResult {
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
export function registrableDomain(hostname: string): string | null {
  const h = hostname.trim().toLowerCase().replace(/\.$/, '');
  if (!h || !/^[a-z0-9.-]+$/.test(h)) return null;
  const parts = h.split('.');
  if (parts.length < 2) return null;
  // Good-enough heuristic for common two-part public suffixes
  // (co.uk, com.au, etc.) without pulling in the full PSL dataset —
  // this is cosmetic/informational data, not something that needs to
  // be exact.
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

// Looks up RDAP registration data for a hostname (bare or full URL —
// same leniency the connect wizard already accepts). Always resolves;
// never throws. `found: false` covers every "couldn't get anything
// useful" case (bad TLD, registry redaction, proxy miss, timeout).
export async function lookupDomain(rawHostnameOrUrl: string): Promise<DomainLookupResult> {
  let hostname = rawHostnameOrUrl.trim();
  try {
    hostname = hostname.includes('://') ? new URL(hostname).hostname : hostname.replace(/\/.*$/, '');
  } catch {
    // leave as-is; registrableDomain() below will reject it if it's junk
  }

  const domain = registrableDomain(hostname);
  if (!domain) {
    return emptyDomainLookupResult(rawHostnameOrUrl);
  }

  const data = await fetchJsonWithTimeout(`https://rdap.org/domain/${encodeURIComponent(domain)}`);
  if (!data || typeof data !== 'object') {
    return emptyDomainLookupResult(domain);
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

  return {
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
}
