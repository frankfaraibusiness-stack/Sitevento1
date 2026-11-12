# Analytics live data + Developer API — what changed

## Analytics page (/dashboard/analytics)
- Date picker is real: plan-gated (history window), "All time" starts when the site was connected, compare is gated too, summary line shows real visits/visitors.
- All 16 sections read one model (`components/analytics/model/build.ts`) built from real data. The placeholder data file is gone; sections with nothing to show render honest empty states that point to the API page.
- New collectors: Core Web Vitals + colour scheme (script → /api/visit-end), JS errors (/api/js-error), uptime probes (/api/uptime-check, daily cron in vercel.json + one throttled probe per page view), API outcome stats (hourly, written by /api/ingest), `sitevento('search', term, results)` and `sitevento('visitor', cb)` script commands.

## Developer API (/dashboard/api)
- New page: keys (live/test), per-startup permission toggles with inline explainers, quickstart code in 4 languages, live "events arriving" feed, and the locked list of traffic metrics the API can never write.
- `lib/apiPermissions.ts` is the catalog (single source of truth); `lib/apiEvents.ts` validates every event; `app/api/ingest` enforces permissions per site, blocks traffic events (403 `reserved_event`), de-duplicates by id, bills only accepted events.
- New user action `set-api-permissions` saves `apiPermissions` on the site doc.

## Deploy checklist
1. Deploy `firestore.rules` (new read-only collections: jsErrors, uptimeDays, apiStats, apiCatalog).
2. Set `CRON_SECRET` in your host's env (Vercel cron sends it as the Bearer token for /api/uptime-check).
3. vercel.json runs the uptime cron daily (safe on every plan). On Pro you can raise the frequency.
4. Re-publish `public/sitevento.js` (cached copies of the old script won't send vitals/errors).
