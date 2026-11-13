// lib/apiDocsMarkdown.ts
//
// The whole /docs/api page as one plain Markdown document (served at
// /docs/api.md). Written for AI assistants and for anyone who wants to
// paste the entire reference into a prompt, an editor or a README. Built
// from the same data as the page (lib/apiDocsSpec.ts), so the two never
// disagree.
import { buildSnippet } from '@/components/api/snippets';
import {
  COMMON_FIELDS,
  DOCS_MD_URL,
  DOCS_OPENAPI_URL,
  DOCS_URL,
  DOC_EVENTS,
  DOC_LIMITS,
  DOC_STATUSES,
  INGEST_URL,
  RESERVED_METRICS,
  docGroups,
  eventSlug,
  requiredNames,
  withSite,
  type DocField,
} from './apiDocsSpec';

function fieldRow(f: DocField): string {
  const type = f.enum ? `${f.type} (${f.enum.map((v) => `\`${v}\``).join(' \\| ')})` : f.type;
  const def = f.default ? ` Default: \`${f.default}\`.` : '';
  return `| \`${f.name}\` | ${type} | ${f.required ? '**required**' : 'optional'} | ${f.note.replace(/\|/g, '\\|')}${def} |`;
}

function fieldTable(fields: DocField[]): string {
  return ['| Field | Type | | Description |', '| --- | --- | --- | --- |', ...fields.map(fieldRow)].join('\n');
}

const json = (v: unknown) => JSON.stringify(v, null, 2);

export function buildApiMarkdown(): string {
  const out: string[] = [];
  const p = (s = '') => out.push(s);

  p('# sitevento API reference');
  p();
  p('> Send what only your own backend knows — subscriptions, orders, refunds, costs, sign-ups, logins, goals, server errors — to sitevento over one HTTPS endpoint. It appears on the Analytics page next to the traffic the sitevento browser script measures.');
  p();
  p(`- Human-readable version: ${DOCS_URL}`);
  p(`- This document (Markdown): ${DOCS_MD_URL}`);
  p(`- OpenAPI 3.1 (JSON): ${DOCS_OPENAPI_URL}`);
  p();
  p('## Quick facts');
  p();
  p(`- Endpoint: \`POST ${INGEST_URL}\``);
  p('- Auth: header `Authorization: Bearer <api key>`. Keys: `sv_live_...` (real data) and `sv_test_...` (same endpoint, tagged test, kept out of real analytics). Get them at /dashboard/api after signing up.');
  p('- Body: ONE JSON object per request, `Content-Type: application/json`. Fields can sit flat in the body or inside a `data` object.');
  p('- Call it from your SERVER only. There is no CORS on purpose: the key is a secret.');
  p('- Every event type must be switched on per startup at /dashboard/api first, otherwise: `403 event_not_permitted`.');
  p('- `siteId` says which startup the event is for. Optional if the account has exactly one startup; required if it has several.');
  p('- `userId` = YOUR stable id for the customer (your database id). sitevento does not know your customers; send the SAME `userId` on every event for that person (sign-up, trial, subscription, order, login). It is required on most events.');
  p('- Money: plain number in MAJOR units (`49.99`, not `4999`) plus an ISO 4217 `currency` code (`"USD"`).');
  p('- Idempotent where it matters: orders, sign-ups, subscription start/cancel and refunds with a `refundId` are de-duplicated by id, so retries are safe and free.');
  p('- Traffic metrics (visits, page views, clicks, visitors, geography, devices, bot blocks) can NEVER be written by API (`403 reserved_event`).');
  p();

  p('## Minimal request');
  p();
  const first = DOC_EVENTS.find((e) => e.event === 'order.completed')!;
  p('```bash');
  p(buildSnippet('curl', INGEST_URL, 'sv_live_YOUR_KEY', withSite(first.example)));
  p('```');
  p();
  p('Success: `200` with `{ "ok": true, "id": "...", "event": "order.completed", "test": false, "usage": { "used": 1234, "limit": 50000 } }`.');
  p();

  p('## Fields every event accepts');
  p();
  p(fieldTable(COMMON_FIELDS));
  p();

  p('## All events at a glance');
  p();
  p('| Event | Permission to switch on | Required fields (besides `event`) |');
  p('| --- | --- | --- |');
  for (const e of DOC_EVENTS) {
    const req = requiredNames(e);
    p(`| \`${e.event}\` | \`${e.permission}\` | ${req.length ? req.map((r) => `\`${r}\``).join(', ') : '—'} |`);
  }
  p();
  p('Notes: `goal.completed` also needs `currency` whenever `value` is sent. `order.completed` needs `items` (1–100) where each item has `price` and a `name` or `productId`.');
  p();

  p('## Event reference');
  p();
  for (const g of docGroups()) {
    p(`### ${g.title}`);
    p();
    p(`_${g.note}_`);
    p();
    for (const { def, events } of g.permissions) {
      p(`#### ${def.label} (permission \`${def.id}\`)`);
      p();
      p(def.what);
      p();
      p(`Feeds: ${def.powers.join(', ')}.`);
      p();
      p('How it is worked out:');
      p();
      for (const h of def.how) p(`- ${h}`);
      p();
      if (def.caution) {
        p(`> Caution: ${def.caution}`);
        p();
      }
      for (const ev of events) {
        p(`##### \`${ev.event}\``);
        p();
        p(`When: ${ev.when}`);
        p();
        p(`Requires the \`${ev.permission}\` permission to be switched on for the startup.`);
        p();
        p(fieldTable(ev.fields));
        p();
        p(`Repeats: ${ev.repeat}`);
        p();
        p('```json');
        p(json(withSite(ev.example)));
        p('```');
        p();
      }
    }
  }

  p('## Responses');
  p();
  p('Success (`200`):');
  p();
  p('```json');
  p(json({ ok: true, id: 'ev_abc123', event: 'order.completed', test: false, usage: { used: 1234, limit: 50000 } }));
  p('```');
  p();
  p('Duplicate (`200`, not billed, not double counted):');
  p();
  p('```json');
  p(json({ ok: true, duplicate: true, id: 'order_ord_10482', test: false }));
  p('```');
  p();
  p('Error (any non-2xx):');
  p();
  p('```json');
  p(json({ ok: false, error: '"total" is required.', code: 'invalid_event', field: 'total' }));
  p('```');
  p();
  p('| HTTP | `code` | Meaning | What to do | Retry? |');
  p('| --- | --- | --- | --- | --- |');
  for (const s of DOC_STATUSES) {
    p(`| ${s.status} | ${s.code ? `\`${s.code}\`` : '—'} | ${s.meaning}${s.extra ? ` Extra: ${s.extra}.` : ''} | ${s.fix} | ${s.retry === 'no' ? 'No — fix the request' : s.retry === 'yes' ? 'Yes, with backoff' : 'Later'} |`);
  }
  p();

  p('## Limits and billing');
  p();
  for (const l of DOC_LIMITS) p(`- **${l.label}:** ${l.value} — ${l.note}`);
  p();

  p('## What the API can never write');
  p();
  p('These are measured only by the sitevento browser script in a real browser. Sending them returns `403 reserved_event`.');
  p();
  for (const r of RESERVED_METRICS) p(`- ${r.label} (${r.blocks.map((b) => `\`${b}\``).join(', ')}) — ${r.note}`);
  p();

  p('## Browser script commands that pair with the API');
  p();
  p('- `sitevento("visitor", function (id) { ... })` hands you the visitor id. Send it to your backend and include it as `visitorId` on sign-ups, trials, goals and orders so they are credited to the channel that brought the visitor.');
  p('- `sitevento("search", term, resultCount)` reports a site search from the browser (the server-side equivalent is `search.performed`).');
  p('- `sitevento("track", name, properties)` sends a custom event from the browser.');
  p();

  p('## Checklists');
  p();
  p('**SaaS / subscriptions:** switch on `subscriptions`, `plan-catalog`, `signups`, `logins`, `trials`, `expenses`. Send `plan.upsert` once per plan, then `user.signed_up`, `trial.started`/`trial.ended`, `subscription.started` → `subscription.renewed` on every payment → `subscription.changed` / `subscription.canceled`, and `user.logged_in` per session.');
  p();
  p('**Online store:** switch on `orders`, `refunds`, `product-catalog`, `expenses`, `ad-spend`. Send `product.upsert` per product, `order.completed` when payment succeeds (with `items`, and `fee` if known), `order.refunded` / `order.chargeback` when money goes back, `adspend.recorded` once per day per campaign.');
  p();

  p('## Common mistakes');
  p();
  p('- Using a different `userId` on different events for the same customer (or a session id). Use one stable id from sign-up onward.');
  p('- Sending cents (`4999`) instead of major units (`49.99`).');
  p('- Forgetting to switch the permission on for that startup (403 `event_not_permitted`).');
  p('- Omitting `siteId` when the account has more than one startup (400 `site_required`).');
  p('- Sending several events in one body or an array. One event per request.');
  p('- Calling the endpoint from browser JavaScript. Use your backend; the key is secret.');
  p('- Using a `sv_test_` key and expecting numbers on the Analytics page. Test data is kept out of real analytics.');
  p('- Sending `goal.completed` with `value` but no `currency`.');
  p('- Sending the same ad spend both as `adspend.recorded` and as `expense.recorded` with type `marketing`.');
  p('- Anchors: each event is at `' + DOCS_URL + '#event-<name>`, e.g. `#event-' + eventSlug('order.completed') + '`.');
  p();
  return out.join('\n');
}
