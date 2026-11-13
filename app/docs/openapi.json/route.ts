// app/docs/openapi.json/route.ts — OpenAPI 3.1 description of POST /api/ingest.
// Public, cacheable, CORS-open (docs only — the ingest endpoint itself has no
// CORS). Generated from lib/apiDocsSpec.ts.
import { buildOpenApi } from '@/lib/apiDocsOpenApi';

export const dynamic = 'force-static';

export async function GET() {
  return new Response(JSON.stringify(buildOpenApi(), null, 2), {
    status: 200,
    headers: {
      'Content-Type': 'application/json; charset=utf-8',
      'Cache-Control': 'public, max-age=3600, s-maxage=3600',
      'Access-Control-Allow-Origin': '*',
    },
  });
}
