// app/docs/api.md/route.ts — the full API reference as plain Markdown.
// Public, cacheable, CORS-open, so an AI assistant (or any tool) can fetch
// it with one request. Same data as /docs/api (lib/apiDocsSpec.ts).
import { buildApiMarkdown } from '@/lib/apiDocsMarkdown';

export const dynamic = 'force-static';

export async function GET() {
  return new Response(buildApiMarkdown(), {
    status: 200,
    headers: {
      'Content-Type': 'text/markdown; charset=utf-8',
      'Cache-Control': 'public, max-age=3600, s-maxage=3600',
      'Access-Control-Allow-Origin': '*',
      'X-Robots-Tag': 'all',
    },
  });
}
