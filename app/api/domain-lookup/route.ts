// app/api/domain-lookup/route.ts
//
// POST { domain }
//
// Best-effort WHOIS/registration lookup for the connect page's step 1
// domain-intel card. Purely cosmetic/informational — never blocks or
// affects the actual connect flow (that runs on normalizeUrl() +
// POST /api/connect-site in components/connect/ConnectFlow.tsx).
//
// The actual lookup logic lives in lib/domainLookup.ts so
// app/api/connect-site/route.ts can run the exact same RDAP lookup at
// site-creation time and persist a permanent snapshot onto the new
// site doc (see that route's comment + lib/types.ts's
// Site['domainInfo']), instead of this data only ever being shown
// transiently while the owner is typing.
//
// No auth required: this only ever reads PUBLIC RDAP registration data
// for a domain the caller already typed (same trust level as pasting
// that domain into a WHOIS lookup site yourself), and returns nothing
// about sitevento's own records.
import { NextRequest, NextResponse } from 'next/server';
import { lookupDomain, emptyDomainLookupResult } from '@/lib/domainLookup';
import { allow } from '@/lib/rateLimit';

export const maxDuration = 10;
export const runtime = 'nodejs';

export async function POST(req: NextRequest) {
  const forwardedFor = req.headers.get('x-forwarded-for') || '';
  const ip = forwardedFor.split(',')[0].trim() || 'unknown';
  if (!allow(`domain-lookup:${ip}`, 30, 60_000)) {
    return NextResponse.json(emptyDomainLookupResult(''), { status: 200 });
  }

  const body = await req.json().catch(() => ({}));
  const domain = typeof body?.domain === 'string' ? body.domain.trim() : '';
  if (!domain || domain.length > 253) {
    return NextResponse.json(emptyDomainLookupResult(domain), { status: 200 });
  }

  try {
    const result = await lookupDomain(domain);
    return NextResponse.json(result, { status: 200, headers: { 'Cache-Control': 'no-store' } });
  } catch (err) {
    console.error('[domain-lookup] error', err);
    return NextResponse.json(emptyDomainLookupResult(domain), { status: 200 });
  }
}
