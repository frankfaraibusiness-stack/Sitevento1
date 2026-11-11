// app/docs/api/page.tsx — Public API reference route, sibling to
// app/docs/page.tsx (the script-tag quick start). That page covers
// the client-side <script> tag; this page documents the SEPARATE
// server-to-server endpoint, app/api/ingest, whose contract
// previously only existed inside the signed-in
// components/settings/panels/ApiPanel.tsx. That panel still shows the
// user's own live/test key and a live event feed — this page is the
// key-free, publicly crawlable version of the same contract (request
// shape, auth header, field semantics, status codes) so it's
// readable by a logged-out visitor, a search crawler, or an AI agent
// helping someone integrate, none of which can reach a settings
// panel behind auth. See /llms.txt for the machine-readable summary
// that points here.
//
// No secret key is ever rendered on this route — every snippet below
// uses a placeholder (sv_live_YOUR_KEY), unlike ApiPanel.tsx's
// snippet which interpolates the signed-in user's real key.
import type { Metadata } from 'next';
import { ContentPageShell } from '@/components/content/ContentPageShell';
import { formatLiveDate } from '@/lib/format';
import '@/styles/content/content-pages.css';

const SITE_URL = process.env.NEXT_PUBLIC_SITE_URL || 'https://sitevento12.vercel.app';
const INGEST_URL = `${SITE_URL}/api/ingest`;

export const metadata: Metadata = {
  title: 'API Reference — Server-Side Ingestion Endpoint',
  description:
    'Public reference for the sitevento ingest API: endpoint, authentication, request and response shapes, field semantics, rate limits, and error codes for sending server-side events.',
  alternates: { canonical: '/docs/api' },
  openGraph: {
    type: 'article',
    url: `${SITE_URL}/docs/api`,
    title: 'API Reference — sitevento',
    description: 'How to send server-side events to sitevento: endpoint, auth, payload shape, and error codes.',
  },
};

export default function ApiDocsPage() {
  return (
    <ContentPageShell
      eyebrow="resources"
      title="API Reference"
      subtitle="A single endpoint for sending events from your own backend — order totals, customer ids, CRM stage, or anything a page script never sees. This is the server-to-server API; for the client-side tag, see Documentation."
      updatedOn={formatLiveDate()}
      heroStats={[
        { value: '1', label: 'endpoint' },
        { value: '64KB', label: 'max payload' },
        { value: '600/min', label: 'rate limit per key' },
      ]}
    >
      <section className="cp-card">
        <span className="cp-card-eyebrow">Endpoint</span>
        <h2>POST /api/ingest</h2>
        <p>
          Called from your own server — never from a browser. There is no CORS configuration on this route on
          purpose: a secret API key must never be embedded in anything that ships to a browser, so a preflight
          request here is itself a signal of misuse.
        </p>
        <pre className="cp-pre">{`POST ${INGEST_URL}`}</pre>
      </section>

      <section className="cp-card">
        <span className="cp-card-eyebrow">Authentication</span>
        <h2>Bearer key in the Authorization header</h2>
        <p>
          Every request needs an <code>Authorization: Bearer &lt;key&gt;</code> header carrying an account-level API
          key. Find your Live and Test keys under <strong>Settings → API Keys</strong> once signed in — keys aren&apos;t
          shown here since this page is public.
        </p>
        <div className="cp-grid cp-grid-2">
          <div className="cp-tile">
            <div className="cp-pill lime" style={{ alignSelf: 'flex-start' }}>sv_live_...</div>
            <p style={{ margin: 0 }}>Real data. Counts against your account&apos;s monthly usage, same as a page view.</p>
          </div>
          <div className="cp-tile">
            <div className="cp-pill purple" style={{ alignSelf: 'flex-start' }}>sv_test_...</div>
            <p style={{ margin: 0 }}>
              Same endpoint, same shape. Writes are tagged <code>test: true</code> so they never mix into real
              analytics — still counts against usage, so load-testing can&apos;t be used to bypass the cap.
            </p>
          </div>
        </div>
        <p>
          A missing header returns <code>401</code> with <code>Missing Authorization: Bearer &lt;api key&gt; header.</code>
          {' '}An invalid or revoked key returns <code>401</code> with <code>Invalid or revoked API key.</code>
        </p>
      </section>

      <section className="cp-card">
        <span className="cp-card-eyebrow">Request</span>
        <h2>Example</h2>
        <p>There is no fixed schema. Send any JSON object — fields beyond the four below ride along as-is.</p>
        <pre className="cp-pre">
{`curl -X POST ${INGEST_URL} \\
  -H "Authorization: Bearer sv_live_YOUR_KEY" \\
  -H "Content-Type: application/json" \\
  -d '{
    "event": "purchase",
    "userId": "cust_482",
    "visitorId": "optional sitevento visitorId to link it to a visit",
    "siteId": "optional site id to scope this event to one connected site",
    "orderTotal": 128.50,
    "plan": "pro"
  }'`}
        </pre>
        <p>
          You can also nest extra fields under a <code>data</code> object instead of sending them flat — both{' '}
          <code>{'{ "event": "x", "foo": "bar" }'}</code> and <code>{'{ "event": "x", "data": { "foo": "bar" } }'}</code>{' '}
          land the same way.
        </p>
      </section>

      <section className="cp-card">
        <span className="cp-card-eyebrow">Field reference</span>
        <h2>What gets special handling</h2>
        <p>
          Four fields are lifted out into their own indexed columns so the dashboard can filter and group on them.
          Everything else is stored untouched under <code>data</code>.
        </p>
        <div className="cp-grid cp-grid-2">
          <div className="cp-tile">
            <h3><code>event</code></h3>
            <p style={{ margin: 0 }}>String, up to 200 characters. A short label for what happened. Defaults to <code>&quot;event&quot;</code> if omitted.</p>
          </div>
          <div className="cp-tile">
            <h3><code>userId</code></h3>
            <p style={{ margin: 0 }}>String, up to 200 characters. Your own internal customer/user id. Optional.</p>
          </div>
          <div className="cp-tile">
            <h3><code>visitorId</code></h3>
            <p style={{ margin: 0 }}>String, up to 200 characters. sitevento&apos;s own visitorId, if you have it, to link this event to a browsing visit. Optional.</p>
          </div>
          <div className="cp-tile">
            <h3><code>siteId</code></h3>
            <p style={{ margin: 0 }}>String, up to 200 characters. Scopes the event to one connected site. Optional — not used for billing.</p>
          </div>
        </div>
      </section>

      <section className="cp-card">
        <span className="cp-card-eyebrow">Response</span>
        <h2>Status codes</h2>
        <div className="cp-grid cp-grid-2">
          <div className="cp-tile">
            <div className="cp-pill lime" style={{ alignSelf: 'flex-start' }}>200</div>
            <p style={{ margin: 0 }}>
              Success. Body: <code>{'{ ok: true, id, test, usage: { used, limit } }'}</code>
            </p>
          </div>
          <div className="cp-tile">
            <div className="cp-pill purple" style={{ alignSelf: 'flex-start' }}>400</div>
            <p style={{ margin: 0 }}>Invalid JSON, or the body isn&apos;t a JSON object.</p>
          </div>
          <div className="cp-tile">
            <div className="cp-pill purple" style={{ alignSelf: 'flex-start' }}>401</div>
            <p style={{ margin: 0 }}>Missing, invalid, or revoked API key.</p>
          </div>
          <div className="cp-tile">
            <div className="cp-pill purple" style={{ alignSelf: 'flex-start' }}>413</div>
            <p style={{ margin: 0 }}>Payload over 64KB.</p>
          </div>
          <div className="cp-tile">
            <div className="cp-pill purple" style={{ alignSelf: 'flex-start' }}>429</div>
            <p style={{ margin: 0 }}>Rate limit exceeded — 600 requests per minute per key.</p>
          </div>
          <div className="cp-tile">
            <div className="cp-pill purple" style={{ alignSelf: 'flex-start' }}>5xx</div>
            <p style={{ margin: 0 }}>Internal or configuration error. Safe to retry.</p>
          </div>
        </div>
      </section>

      <section className="cp-card">
        <span className="cp-card-eyebrow">Billing</span>
        <h2>Usage</h2>
        <p>
          One ingest call counts as one visit against your monthly allowance, same price as a page view, regardless
          of how many fields the payload carries. The response&apos;s <code>usage</code> object reports where you
          stand after each call.
        </p>
      </section>

      <a className="cp-banner" href="/docs">
        <div className="cp-banner-copy">
          <h4>Looking for the client-side tag?</h4>
          <p>The script tag for page views, widgets, and overlays is a separate, simpler setup — no API key involved.</p>
        </div>
        <span className="cp-banner-cta">
          See Documentation
          <svg viewBox="0 0 24 24" width="14" height="14" fill="none" stroke="currentColor" strokeWidth={2.5} strokeLinecap="round" strokeLinejoin="round">
            <path d="M5 12h14M13 6l6 6-6 6" />
          </svg>
        </span>
      </a>
    </ContentPageShell>
  );
}
