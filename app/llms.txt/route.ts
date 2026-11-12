// app/llms.txt/route.ts — Generates /llms.txt at request time, same
// pattern as app/robots.ts and app/sitemap.ts (a route handler rather
// than a static file under public/, so it can read
// NEXT_PUBLIC_SITE_URL and stay in sync if that ever changes).
//
// llms.txt is the emerging convention (llmstxt.org) for a short,
// plain-text, machine-readable summary of what a site is and where
// its real documentation lives — the file an AI agent or assistant
// checks first instead of trying to scrape rendered HTML. This exists
// specifically so an agent helping a developer integrate sitevento's
// server-to-server API (app/api/ingest, documented for humans at
// app/docs/api/page.tsx) can find the endpoint, auth header, and
// payload shape without a human pasting it in. Kept intentionally
// short: a summary plus links, not a full copy of app/docs/api's
// content, so it stays cheap to fetch and doesn't drift out of sync
// with the real reference page.
const SITE_URL = process.env.NEXT_PUBLIC_SITE_URL || 'https://sitevento12.vercel.app';

export async function GET() {
  const body = `# sitevento

> Visit tracking, widgets, and live overlays for any website — a script tag for client-side
> tracking, plus a separate server-to-server API for sending events a page script can never see
> (order totals, a logged-in customer id, CRM stage, and so on).

sitevento has two integration surfaces. Pick the one that matches what you're building:

1. A <script> tag for client-side page views, widgets, and overlays — no API key, no build step.
2. A REST API for server-side events sent from your own backend — requires an account-level API key.

## Client-side tag

- Setup and how the tag works: ${SITE_URL}/docs
- Generate a site and its tag from the dashboard after signing up: ${SITE_URL}

## Server-side API

- Full reference (endpoint, auth, request/response shapes, status codes): ${SITE_URL}/docs/api
- Endpoint: POST ${SITE_URL}/api/ingest
- Auth: Authorization: Bearer <api key> (sv_live_... or sv_test_...), issued per account under
  Settings → API Keys after signing up at ${SITE_URL}
- Request body: JSON, no fixed schema. { "event": "purchase", "userId": "cust_482", "orderTotal": 128.50 }
  is valid; event, userId, visitorId, and siteId get dedicated columns, everything else is stored
  as-is under "data".
- Max payload: 64KB. Rate limit: 600 requests/minute per key.
- Must be called server-to-server — there is no CORS support on this endpoint by design, since the
  key is a secret that should never reach a browser.

## Other pages

- How sitevento works (the tag, tracking, widgets, visitor control, alerts, plans & pricing in full): ${SITE_URL}/how-it-works
- Pricing and plan limits: ${SITE_URL}/pricing
- Product overview: ${SITE_URL}/product/features
- Status: ${SITE_URL}/status
- Support: ${SITE_URL}/support

## Notes for agents

- /dashboard and /console require a signed-in account and are not publicly readable — don't attempt
  to fetch them.
- The server-side API (/api/ingest) must be called from a backend, not from code running in a user's
  browser or from a browser-automation tool, since it requires a secret key.
`;

  return new Response(body, {
    status: 200,
    headers: {
      'Content-Type': 'text/plain; charset=utf-8',
      'Cache-Control': 'public, max-age=3600',
    },
  });
}
