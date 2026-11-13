// app/docs/api/page.tsx — the public API reference.
//
// A standalone documentation page (own layout, own stylesheet
// styles/docs/api-docs.css, `apd-` prefix, own fonts) — deliberately NOT the
// shared ContentPageShell look. It documents POST /api/ingest: every event a
// customer's backend can send, which permission it needs, and exactly which
// fields are required.
//
// Built for people AND machines:
//   • 100% server-rendered HTML, no login, no JS needed to read anything
//     (only the copy buttons are client components), so crawlers and AI
//     assistants get the full reference in one fetch.
//   • Same content as plain Markdown at /docs/api.md and as OpenAPI 3.1 at
//     /docs/openapi.json; /llms.txt points at all three.
//   • Generated from lib/apiDocsSpec.ts (+ the catalog in
//     lib/apiPermissions.ts), which is checked against the real validator in
//     lib/apiEvents.ts, so the docs can't quietly drift from the API.
// No secret is ever rendered here: every snippet uses a placeholder key.
import type { Metadata } from 'next';
import { Inter, JetBrains_Mono } from 'next/font/google';
import { buildSnippet, LANGS, type Lang } from '@/components/api/snippets';
import { Code, FieldTable } from '@/components/apidocs/DocsParts';
import { CopyButton } from '@/components/apidocs/CopyButton';
import { TocSpy } from '@/components/apidocs/TocSpy';
import {
  COMMON_FIELDS,
  DOCS_MD_URL,
  DOCS_OPENAPI_URL,
  DOCS_SITE_URL,
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
} from '@/lib/apiDocsSpec';
import '@/styles/docs/api-docs.css';

const sans = Inter({ subsets: ['latin'], variable: '--apd-font-sans', display: 'swap' });
const mono = JetBrains_Mono({ subsets: ['latin'], variable: '--apd-font-mono', display: 'swap' });

const TITLE = 'API Reference — send subscriptions, orders & more to sitevento';
const DESCRIPTION =
  'Public, copy-able reference for the sitevento API: one endpoint, every event type (subscriptions, orders, refunds, expenses, sign-ups, logins, goals, server health) and exactly which fields each one requires. Also available as Markdown and OpenAPI for AI assistants.';

export const metadata: Metadata = {
  title: TITLE,
  description: DESCRIPTION,
  alternates: {
    canonical: '/docs/api',
    types: { 'text/markdown': '/docs/api.md', 'application/json': '/docs/openapi.json' },
  },
  robots: { index: true, follow: true },
  openGraph: { type: 'article', url: DOCS_URL, title: 'sitevento API reference', description: DESCRIPTION },
  twitter: { card: 'summary_large_image', title: 'sitevento API reference', description: DESCRIPTION },
};

const KEY = 'sv_live_YOUR_KEY';
const ORDER = DOC_EVENTS.find((e) => e.event === 'order.completed')!;

const json = (v: unknown) => JSON.stringify(v, null, 2);

const AI_PROMPT = `You are helping me connect my backend to the sitevento API.
Read the full reference first: ${DOCS_MD_URL}
(OpenAPI version: ${DOCS_OPENAPI_URL})

Rules: send ONE JSON event per request to POST ${INGEST_URL} with the header "Authorization: Bearer <my API key>", from my server only. Use only the event names and required fields from the reference, send money in major units with a currency code, and include siteId if I have more than one startup.

Now add sitevento events to my code for: <describe what your app does — e.g. "subscriptions on Stripe webhooks and new user sign-ups">.`;

const GROUP_ICON: Record<string, string> = { saas: '↻', products: '▣', profit: '$', customers: '☺', behaviour: '⚑', health: '♥' };

export default function ApiDocsPage() {
  const groups = docGroups();
  const jsonLd = {
    '@context': 'https://schema.org',
    '@type': 'TechArticle',
    headline: 'sitevento API reference',
    description: DESCRIPTION,
    url: DOCS_URL,
    inLanguage: 'en',
    isPartOf: { '@type': 'WebSite', name: 'sitevento', url: DOCS_SITE_URL },
    about: 'Server-side event ingestion API',
    encoding: [
      { '@type': 'MediaObject', encodingFormat: 'text/markdown', contentUrl: DOCS_MD_URL },
      { '@type': 'MediaObject', encodingFormat: 'application/json', contentUrl: DOCS_OPENAPI_URL },
    ],
  };

  return (
    <div className={`apd ${sans.variable} ${mono.variable}`}>
      <script type="application/ld+json" dangerouslySetInnerHTML={{ __html: JSON.stringify(jsonLd) }} />
      <a className="apd-skip" href="#main">Skip to content</a>

      {/* ── Top bar ───────────────────────────────────────────── */}
      <div className="apd-top" role="banner">
        <div className="apd-top-in">
          <a className="apd-brand" href="/" aria-label="sitevento home">
            <span className="apd-brand-mark" aria-hidden="true">s</span>
            <span className="apd-brand-name">sitevento</span>
            <span className="apd-brand-sep" aria-hidden="true">/</span>
            <span className="apd-brand-sub">API</span>
          </a>
          <nav className="apd-top-nav" aria-label="Documentation">
            <a href="#quickstart">Quickstart</a>
            <a href="#events">Events</a>
            <a href="#responses">Errors</a>
            <a href="/docs">Script tag docs</a>
          </nav>
          <div className="apd-top-actions">
            <a className="apd-btn is-ghost" href="/docs/api.md">Markdown</a>
            <a className="apd-btn is-ghost" href="/docs/openapi.json">OpenAPI</a>
            <a className="apd-btn is-solid" href="/dashboard/api">Get API key</a>
          </div>
        </div>
      </div>

      <div className="apd-layout">
        {/* ── Sidebar (desktop) ─────────────────────────────── */}
        <aside className="apd-side" aria-label="On this page">
          <nav>
            <p className="apd-side-h">Start</p>
            <a href="#overview">Overview</a>
            <a href="#for-ai">For AI assistants</a>
            <a href="#quickstart">Quickstart</a>
            <a href="#basics">Request basics</a>
            <p className="apd-side-h">Events</p>
            <a href="#events">All events at a glance</a>
            {groups.map((g) => (
              <div key={g.id} className="apd-side-group">
                <a className="apd-side-gl" href={`#group-${g.id}`}>{g.title}</a>
                {g.permissions.flatMap((p) => p.events).map((e) => (
                  <a key={e.event} className="apd-side-ev" href={`#event-${eventSlug(e.event)}`}>
                    <code>{e.event}</code>
                  </a>
                ))}
              </div>
            ))}
            <p className="apd-side-h">Reference</p>
            <a href="#responses">Responses &amp; errors</a>
            <a href="#limits">Limits &amp; billing</a>
            <a href="#reserved">What can’t be written</a>
            <a href="#script">Browser script pairing</a>
            <a href="#checklists">Integration checklists</a>
            <a href="#mistakes">Common mistakes</a>
          </nav>
        </aside>

        <div className="apd-main" id="main" role="main">
          {/* ── Hero ───────────────────────────────────────── */}
          <section className="apd-hero" id="overview" aria-labelledby="apd-title">
            <p className="apd-eyebrow"><span aria-hidden="true" /> Developer API · v1</p>
            <h1 id="apd-title">Send what only your backend knows</h1>
            <p className="apd-lead">
              The sitevento script measures everything a browser can see. Subscriptions, orders, refunds, costs,
              sign-ups and server health only your server knows — send them to one endpoint and they show up on your
              Analytics page, next to your traffic.
            </p>
            <div className="apd-endpoint" role="group" aria-label="Endpoint">
              <span className="apd-method">POST</span>
              <code>{INGEST_URL}</code>
              <CopyButton text={INGEST_URL} label="Copy URL" />
            </div>
            <ul className="apd-chips" aria-label="At a glance">
              <li>JSON</li>
              <li>Bearer key</li>
              <li>1 event per request</li>
              <li>22 event types</li>
              <li>Safe retries</li>
              <li>Public docs · no login</li>
            </ul>
          </section>

          {/* ── For AI ─────────────────────────────────────── */}
          <section className="apd-ai" id="for-ai" aria-labelledby="apd-ai-h">
            <div className="apd-ai-head">
              <div>
                <h2 id="apd-ai-h">Coding with an AI assistant?</h2>
                <p>
                  This whole reference is public and machine-readable. Paste the prompt below into ChatGPT, Claude,
                  Cursor or Copilot, or give them one of the links.
                </p>
              </div>
              <CopyButton fetchUrl="/docs/api.md" label="Copy full reference (Markdown)" doneLabel="Reference copied" className="is-big" />
            </div>
            <Code lang="prompt — paste into your AI" code={AI_PROMPT} copyLabel="Copy prompt" />
            <ul className="apd-links">
              <li><a href="/docs/api.md"><strong>/docs/api.md</strong><span>Entire reference as one Markdown file</span></a></li>
              <li><a href="/docs/openapi.json"><strong>/docs/openapi.json</strong><span>OpenAPI 3.1 — every event as a schema</span></a></li>
              <li><a href="/llms.txt"><strong>/llms.txt</strong><span>Short index for AI agents</span></a></li>
            </ul>
          </section>

          {/* ── Quickstart ─────────────────────────────────── */}
          <section className="apd-sec" id="quickstart" aria-labelledby="apd-qs-h">
            <h2 id="apd-qs-h">Quickstart</h2>
            <ol className="apd-steps">
              <li>
                <span className="apd-step-n" aria-hidden="true">1</span>
                <div>
                  <h3>Get your key</h3>
                  <p>
                    Sign in and open <a href="/dashboard/api">/dashboard/api</a>. You get a <code>sv_live_…</code> key
                    (real data) and a <code>sv_test_…</code> key (same endpoint, kept out of real analytics). Keep it on
                    your server.
                  </p>
                </div>
              </li>
              <li>
                <span className="apd-step-n" aria-hidden="true">2</span>
                <div>
                  <h3>Switch on what you’ll send</h3>
                  <p>
                    On the same page, per startup, turn on the event types you need (Subscriptions, Orders, …). An
                    event whose switch is off is refused with <code>403 event_not_permitted</code>. The page also shows
                    your <code>siteId</code>.
                  </p>
                </div>
              </li>
              <li>
                <span className="apd-step-n" aria-hidden="true">3</span>
                <div>
                  <h3>Send an event</h3>
                  <p>One JSON object per request, from your backend:</p>
                </div>
              </li>
            </ol>

            <div className="apd-tabs">
              {LANGS.map((l, i) => (
                <input key={l.id} type="radio" name="apd-lang" id={`apd-t-${l.id}`} defaultChecked={i === 0} className="apd-tab-radio" />
              ))}
              <div className="apd-tab-list" role="tablist" aria-label="Language">
                {LANGS.map((l) => (
                  <label key={l.id} htmlFor={`apd-t-${l.id}`} className={`apd-tab apd-tab-${l.id}`}>{l.label}</label>
                ))}
              </div>
              <div className="apd-panes">
                {LANGS.map((l) => (
                  <div key={l.id} className={`apd-pane apd-pane-${l.id}`}>
                    <Code lang={l.label} code={buildSnippet(l.id as Lang, INGEST_URL, KEY, withSite(ORDER.example))} />
                  </div>
                ))}
              </div>
            </div>

            <p className="apd-note">
              A successful call returns <code>200</code> with <code>{'{ "ok": true, "id": "…", "usage": { … } }'}</code>.
              Use the <code>sv_test_</code> key while building: it is billed the same but never touches your real
              analytics.
            </p>
          </section>

          {/* ── Basics ─────────────────────────────────────── */}
          <section className="apd-sec" id="basics" aria-labelledby="apd-basics-h">
            <h2 id="apd-basics-h">Request basics</h2>
            <div className="apd-cards">
              <article className="apd-card">
                <h3>Authentication</h3>
                <p>Header <code>Authorization: Bearer &lt;key&gt;</code> on every request. A missing key is <code>401 missing_key</code>; a wrong, revoked or regenerated one is <code>401 invalid_key</code>.</p>
              </article>
              <article className="apd-card">
                <h3>Server-side only</h3>
                <p>There is no CORS on purpose. The key is a secret — never put it in browser code, an app bundle or a public repo.</p>
              </article>
              <article className="apd-card">
                <h3>One event per request</h3>
                <p>The body is a single JSON object. Arrays and batches are rejected (<code>400 invalid_body</code>). Fields can sit flat, or inside a <code>data</code> object — both work.</p>
              </article>
              <article className="apd-card">
                <h3>Which startup?</h3>
                <p>Add <code>siteId</code> to say which connected startup the event is for. With exactly one startup you may leave it out; with several it is required (<code>400 site_required</code>).</p>
              </article>
              <article className="apd-card apd-card-key">
                <h3>One stable <code>userId</code> everywhere</h3>
                <p>
                  sitevento doesn’t know your customers — <code>userId</code> is how it tells them apart. Use your own
                  database id for the person, and send the <strong>same value</strong> on their sign-up, trial,
                  subscription, order and login events. Not a session id, not a changing token. A different id means a different person.
                </p>
              </article>
              <article className="apd-card">
                <h3>Money</h3>
                <p>A plain number in <strong>major units</strong> (<code>49.99</code>, not <code>4999</code>), never negative, plus an ISO 4217 <code>currency</code> like <code>"USD"</code>.</p>
              </article>
              <article className="apd-card">
                <h3>Time</h3>
                <p>Events default to “now”. Send <code>occurredAt</code> (ISO 8601) for backfills and delayed webhooks — up to about 2 years back, never in the future.</p>
              </article>
              <article className="apd-card">
                <h3>Retries are safe</h3>
                <p>Orders, sign-ups, subscription start/cancel and refunds with a <code>refundId</code> are de-duplicated by id: a repeat returns <code>duplicate: true</code> and costs nothing.</p>
              </article>
              <article className="apd-card">
                <h3>Credit the channel</h3>
                <p>Add the browser’s <code>visitorId</code> to sign-ups, trials, goals and orders so they’re credited to the campaign that brought the person in. See <a href="#script">browser pairing</a>.</p>
              </article>
            </div>

            <h3 className="apd-h3">Fields every event accepts</h3>
            <FieldTable fields={COMMON_FIELDS} caption="Fields every event accepts" />
          </section>

          {/* ── Events ─────────────────────────────────────── */}
          <section className="apd-sec" id="events" aria-labelledby="apd-ev-h">
            <h2 id="apd-ev-h">Events</h2>
            <p className="apd-sub">
              Every event you can send, what must be switched on, and what is required. Tap an event name for its
              full field list and a copy-ready example.
            </p>

            <div className="apd-tablewrap">
              <table className="apd-table apd-glance">
                <caption className="apd-sr">All events at a glance</caption>
                <thead>
                  <tr>
                    <th scope="col">Event</th>
                    <th scope="col">Switch on</th>
                    <th scope="col">Required fields</th>
                  </tr>
                </thead>
                <tbody>
                  {DOC_EVENTS.map((e) => {
                    const req = requiredNames(e);
                    return (
                      <tr key={e.event}>
                        <td data-label="Event"><a href={`#event-${eventSlug(e.event)}`}><code>{e.event}</code></a></td>
                        <td data-label="Switch on"><span className="apd-perm">{e.permission}</span></td>
                        <td data-label="Required">
                          {req.map((r) => (<code key={r} className="apd-rq">{r}</code>))}
                          {e.event === 'goal.completed' && <span className="apd-aside">+ currency if value</span>}
                        </td>
                      </tr>
                    );
                  })}
                </tbody>
              </table>
            </div>

            {groups.map((g) => (
              <div key={g.id} className="apd-group" id={`group-${g.id}`}>
                <div className="apd-group-h">
                  <span className="apd-group-ic" aria-hidden="true">{GROUP_ICON[g.id]}</span>
                  <div>
                    <h3>{g.title}</h3>
                    <p>{g.note}</p>
                  </div>
                </div>

                {g.permissions.map(({ def, events }) => (
                  <div key={def.id} className="apd-perm-block" id={`perm-${def.id}`}>
                    <div className="apd-perm-intro">
                      <h4>{def.label} <span className="apd-perm">permission: {def.id}</span></h4>
                      <p>{def.what}</p>
                      <p className="apd-feeds"><strong>Feeds:</strong> {def.powers.join(' · ')}</p>
                      <details className="apd-how">
                        <summary>How the numbers are worked out</summary>
                        <ul>{def.how.map((h) => (<li key={h}>{h}</li>))}</ul>
                      </details>
                      {def.caution && <p className="apd-caution"><strong>Heads up:</strong> {def.caution}</p>}
                    </div>

                    {events.map((ev) => {
                      const payload = withSite(ev.example);
                      const id = `event-${eventSlug(ev.event)}`;
                      return (
                        <article key={ev.event} className="apd-event" id={id} aria-labelledby={`${id}-h`}>
                          <div className="apd-event-h">
                            <h5 id={`${id}-h`}>
                              <a href={`#${id}`} className="apd-anchor" aria-label={`Link to ${ev.event}`}>#</a>
                              <code>{ev.event}</code>
                            </h5>
                            <CopyButton text={ev.event.startsWith('custom.<') ? 'custom.your_event' : ev.event} label="Copy name" />
                          </div>
                          <p className="apd-when">{ev.when}</p>
                          <p className="apd-needs">Needs the <span className="apd-perm">{ev.permission}</span> switch on for the startup.</p>

                          <FieldTable fields={ev.fields} caption={`Fields of ${ev.event}`} />
                          <p className="apd-repeat"><strong>If you send it again:</strong> {ev.repeat}</p>

                          <Code lang="Example payload (JSON)" json code={json(payload)} copyLabel="Copy JSON" />
                          <Code lang="cURL" code={buildSnippet('curl', INGEST_URL, KEY, payload)} copyLabel="Copy cURL" />
                          <details className="apd-more">
                            <summary>Node.js · Python · PHP</summary>
                            {(['node', 'python', 'php'] as Lang[]).map((l) => (
                              <Code key={l} lang={LANGS.find((x) => x.id === l)!.label} code={buildSnippet(l, INGEST_URL, KEY, payload)} />
                            ))}
                          </details>
                        </article>
                      );
                    })}
                  </div>
                ))}
              </div>
            ))}
          </section>

          {/* ── Responses ──────────────────────────────────── */}
          <section className="apd-sec" id="responses" aria-labelledby="apd-resp-h">
            <h2 id="apd-resp-h">Responses &amp; errors</h2>
            <div className="apd-two">
              <div>
                <h3 className="apd-h3">Accepted — 200</h3>
                <Code lang="JSON" json code={json({ ok: true, id: 'ev_abc123', event: 'order.completed', test: false, usage: { used: 1234, limit: 50000 } })} />
              </div>
              <div>
                <h3 className="apd-h3">Duplicate — 200 (not stored, not billed)</h3>
                <Code lang="JSON" json code={json({ ok: true, duplicate: true, id: 'order_ord_10482', test: false })} />
              </div>
              <div>
                <h3 className="apd-h3">Error — any other status</h3>
                <Code lang="JSON" json code={json({ ok: false, error: '"total" is required.', code: 'invalid_event', field: 'total' })} />
              </div>
              <div>
                <h3 className="apd-h3">Not permitted — 403</h3>
                <Code lang="JSON" json code={json({ ok: false, error: '"Orders" is switched off for this startup. Turn it on at /dashboard/api to accept order.completed.', code: 'event_not_permitted', permission: 'orders' })} />
              </div>
            </div>

            <div className="apd-tablewrap">
              <table className="apd-table apd-status">
                <caption className="apd-sr">Error codes</caption>
                <thead>
                  <tr>
                    <th scope="col">HTTP</th>
                    <th scope="col"><code>code</code></th>
                    <th scope="col">Meaning</th>
                    <th scope="col">What to do</th>
                    <th scope="col">Retry?</th>
                  </tr>
                </thead>
                <tbody>
                  {DOC_STATUSES.map((s) => (
                    <tr key={s.status + s.code}>
                      <td data-label="HTTP"><span className={`apd-http s${Math.floor(s.status / 100)}`}>{s.status}</span></td>
                      <td data-label="code">{s.code ? <code>{s.code}</code> : '—'}</td>
                      <td data-label="Meaning">{s.meaning}{s.extra && <span className="apd-aside"> Also returns {s.extra}.</span>}</td>
                      <td data-label="What to do">{s.fix}</td>
                      <td data-label="Retry?">{s.retry === 'no' ? 'No — fix the request' : s.retry === 'yes' ? 'Yes, with backoff' : 'Later'}</td>
                    </tr>
                  ))}
                </tbody>
              </table>
            </div>
          </section>

          {/* ── Limits ─────────────────────────────────────── */}
          <section className="apd-sec" id="limits" aria-labelledby="apd-lim-h">
            <h2 id="apd-lim-h">Limits &amp; billing</h2>
            <dl className="apd-limits">
              {DOC_LIMITS.map((l) => (
                <div key={l.label} className="apd-limit">
                  <dt>{l.label}</dt>
                  <dd><strong>{l.value}</strong><span>{l.note}</span></dd>
                </div>
              ))}
            </dl>
          </section>

          {/* ── Reserved ───────────────────────────────────── */}
          <section className="apd-sec" id="reserved" aria-labelledby="apd-res-h">
            <h2 id="apd-res-h">What the API can never write</h2>
            <p className="apd-sub">
              Traffic numbers are measured only by the sitevento script in a real browser. Sending any of these —
              whatever the key or permissions — returns <code>403 reserved_event</code>, so your Analytics can’t be inflated from outside.
            </p>
            <ul className="apd-reserved">
              {RESERVED_METRICS.map((r) => (
                <li key={r.id}>
                  <strong>{r.label}</strong>
                  <span>{r.note}</span>
                  <span className="apd-blocks">{r.blocks.map((b) => (<code key={b}>{b}</code>))}</span>
                </li>
              ))}
            </ul>
          </section>

          {/* ── Script pairing ─────────────────────────────── */}
          <section className="apd-sec" id="script" aria-labelledby="apd-script-h">
            <h2 id="apd-script-h">Pairing with the browser script</h2>
            <p className="apd-sub">If the sitevento tag is on your site, these commands connect browser visits to the events your server sends.</p>
            <Code
              lang="JavaScript (in the browser)"
              code={`// 1) Get the visitor id, send it to your backend with the sign-up / checkout request
sitevento('visitor', function (id) {
  fetch('/api/signup', { method: 'POST', body: JSON.stringify({ email, visitorId: id }) });
});

// 2) Your backend then includes it as "visitorId" when it sends the event
//    -> the sign-up is credited to the channel and campaign that brought them.

// Optional: report a site search straight from the browser
sitevento('search', 'dark mode', 0);   // term, number of results

// Optional: a custom event from the browser
sitevento('track', 'upgrade_click', { plan: 'pro' });`}
            />
            <p className="apd-note">Install the tag from <a href="/docs">the script tag docs</a>.</p>
          </section>

          {/* ── Checklists ─────────────────────────────────── */}
          <section className="apd-sec" id="checklists" aria-labelledby="apd-chk-h">
            <h2 id="apd-chk-h">Integration checklists</h2>
            <div className="apd-two">
              <article className="apd-card">
                <h3>SaaS / subscriptions</h3>
                <p className="apd-chk-sw">Switch on: <code>subscriptions</code> <code>plan-catalog</code> <code>signups</code> <code>logins</code> <code>trials</code> <code>expenses</code></p>
                <ol className="apd-chk">
                  <li><code>plan.upsert</code> once per plan (and when prices change).</li>
                  <li><code>user.signed_up</code> when an account is confirmed.</li>
                  <li><code>trial.started</code> / <code>trial.ended</code> if you offer trials.</li>
                  <li><code>subscription.started</code> when billing begins.</li>
                  <li><code>subscription.renewed</code> on <em>every</em> successful payment.</li>
                  <li><code>subscription.changed</code> / <code>subscription.canceled</code> / <code>subscription.payment_failed</code>.</li>
                  <li><code>user.logged_in</code> once per session.</li>
                </ol>
              </article>
              <article className="apd-card">
                <h3>Online store</h3>
                <p className="apd-chk-sw">Switch on: <code>orders</code> <code>refunds</code> <code>product-catalog</code> <code>expenses</code> <code>ad-spend</code></p>
                <ol className="apd-chk">
                  <li><code>product.upsert</code> per product (with <code>cost</code> for margins).</li>
                  <li><code>order.completed</code> when payment succeeds — with <code>items</code> and <code>fee</code>.</li>
                  <li><code>order.refunded</code> / <code>order.chargeback</code> when money goes back.</li>
                  <li><code>adspend.recorded</code> once per day per campaign.</li>
                  <li><code>expense.recorded</code> for hosting, fulfilment, team, tools.</li>
                  <li><code>user.signed_up</code> for customer accounts.</li>
                </ol>
              </article>
            </div>
          </section>

          {/* ── Mistakes ───────────────────────────────────── */}
          <section className="apd-sec" id="mistakes" aria-labelledby="apd-mis-h">
            <h2 id="apd-mis-h">Common mistakes</h2>
            <ul className="apd-mistakes">
              <li><strong>A different userId on each event.</strong> Use one stable id per customer (your database id) from sign-up onward, or their sign-up, payments and logins look like separate people.</li>
              <li><strong>Cents instead of major units.</strong> Send <code>49.99</code>, not <code>4999</code>.</li>
              <li><strong>Permission still off.</strong> <code>403 event_not_permitted</code> — switch it on for that startup at <a href="/dashboard/api">/dashboard/api</a>.</li>
              <li><strong>No siteId with several startups.</strong> <code>400 site_required</code>.</li>
              <li><strong>Several events in one body.</strong> One event per request; loop and send them separately.</li>
              <li><strong>Calling from the browser.</strong> Use your backend; there is no CORS and the key is secret.</li>
              <li><strong>Expecting test data in Analytics.</strong> <code>sv_test_</code> events are kept out of real numbers.</li>
              <li><strong>A value with no currency</strong> on <code>goal.completed</code>.</li>
              <li><strong>Double-counting spend.</strong> Don’t send the same marketing spend as both <code>adspend.recorded</code> and <code>expense.recorded</code> (type <code>marketing</code>).</li>
              <li><strong>Sending traffic.</strong> Page views, clicks and visitors are script-only (<code>403 reserved_event</code>).</li>
            </ul>
          </section>

          <div className="apd-foot" role="contentinfo">
            <p>
              Need a hand? <a href="/support">Support</a> · <a href="/status">Status</a> · <a href="/docs">Script tag docs</a> ·{' '}
              <a href="/docs/api.md">Markdown</a> · <a href="/docs/openapi.json">OpenAPI</a>
            </p>
            <p className="apd-foot-s">sitevento API v1 · this page is generated from the same definitions the API validates against.</p>
          </div>
        </div>
      </div>
      <TocSpy />
    </div>
  );
}
