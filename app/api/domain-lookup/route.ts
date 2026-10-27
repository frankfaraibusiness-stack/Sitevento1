// app/api/domain-lookup/route.ts
//
// Best-effort WHOIS/registration lookup for the connect-site wizard's
// step 1. Purely cosmetic/informational on its own — it never blocks
// or affects the actual connect flow (that still runs on
// normalizeUrl() + /api/connect-site in hooks/useConnectSiteWizard.ts).
// This route just gives the UI something to show off while the user
// is looking at the domain they typed: age, registrar, status,
// nameserver count.
//
// The actual lookup logic now lives in lib/domainLookup.ts so
// app/api/connect-site/route.ts can run the exact same RDAP lookup at
// site-creation time and persist a permanent snapshot onto the new
// site doc (see that route's comment + lib/types.ts's
// Site['domainInfo']), instead of this data only ever being shown
// transiently here and then discarded.
import { NextRequest, NextResponse } from 'next/server';
import { lookupDomain, emptyDomainLookupResult } from '@/lib/domainLookup';

export const maxDuration = 10;
export const runtime = 'nodejs';

export async function POST(req: NextRequest) {
  const body = await req.json().catch(() => ({}));
  const rawDomain = typeof body?.domain === 'string' ? body.domain : '';

  if (!rawDomain.trim()) {
    return NextResponse.json(emptyDomainLookupResult(rawDomain), { status: 200 });
  }

  const result = await lookupDomain(rawDomain);
  return NextResponse.json(result, { status: 200 });
}
