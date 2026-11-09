// components/marketing/HowItWorksPage.tsx
//
// Replaces the old HowItWorksModal.tsx (deleted) — a client-only,
// full-screen popup that only ever existed inside the marketing
// page's own DOM, mounted/unmounted on an open/closed state with no
// real URL of its own. That meant it was invisible to search engines
// and AI crawlers (nothing to index, nothing to link to, no page for
// an answer engine to cite) and did nothing for SEO.
//
// This is a real route instead: app/how-it-works/page.tsx renders
// this component as a plain Server Component (no 'use client' here),
// so the whole page — headline copy, every step's explanation, the
// full plan/pricing breakdown — is server-rendered HTML a crawler can
// read directly, with real <h1>/<h2> structure, a canonical URL, and
// FAQPage structured data (see the page.tsx file for the JSON-LD).
// The only client-side piece is HowItWorksRail.tsx, the sticky
// desktop step index — everything else here stays static.
//
// Header: this page does NOT use ContentHeader (components/layout/
// ContentHeader.tsx) as-is, because ContentHeader's right-side slot
// is always a signup pill or an account avatar plus a hamburger menu
// — correct for every other content route, but not for this one. Per
// request this page's header keeps the same real <header>/.pill-nav/
// .nav-logo markup/CSS everything else uses (so it's visually
// identical at a glance) but swaps that entire right-side cluster for
// a single "Return home" pill (label + arrow), since the one thing a
// visitor reading this page might want from the header is a fast way
// back to the homepage — not to sign up again or open a menu they
// didn't come here for.
//
// Content: every claim below maps to a real, shipped feature (same
// standard the old modal held itself to — see its own former header
// comment) — the one <meta name="sitevento"> tag (lib/agent.ts), live
// visit/unique-visitor tracking, per-visitor block vs. timed restrict
// (app/api/user-action/route.ts's 'restrict-visitor' action), widgets
// pushed from the dashboard with no redeploy (lib/widgets.ts's
// WIDGET_CATALOG), system alerts (SiteAlertsPanel), visitor/team
// management (UsersPage) — plus, new on this page vs. the old modal,
// the full plan/pricing breakdown (lib/plans.ts, lib/visits.ts,
// lib/limits.ts) so a reader (human or AI) can see exactly what each
// plan costs and includes without a second page load.
import Link from 'next/link';
import { ContentBlob } from '@/components/content/ContentBlob';
import { Footer } from '@/components/layout/Footer';
import { HowItWorksRail } from './HowItWorksRail';
import { PLANS } from '@/lib/plans';
import { WIDGET_LIVE_LIMITS } from '@/lib/limits';
import { MONTHLY_VISIT_LIMITS, OVERAGE_VISIT_BLOCK_SIZE, overageMicrocentsPerVisitBlock } from '@/lib/visits';
import { formatLiveDate } from '@/lib/format';

function ReturnHomeHeader() {
  return (
    <header>
      <div className="pill-nav">
        <Link href="/" aria-label="sitevento home">
          <img
            className="nav-logo"
            src="https://cdn.phototourl.com/member/2026-10-16-c4f6fc3d-2a68-40c8-9241-fa770df8a99f.png"
            alt="sitevento"
          />
        </Link>
        <Link href="/" className="hiw2-return-home">
          Return home
          <span className="hiw2-return-home-arrow" aria-hidden="true">
            <svg viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeLinecap="round" strokeLinejoin="round">
              <path d="M5 12h14M13 6l6 6-6 6" />
            </svg>
          </span>
        </Link>
      </div>
    </header>
  );
}

const STEPS = [
  { id: 'the-tag', label: 'The one tag' },
  { id: 'tracking', label: 'Visits & visitors' },
  { id: 'control', label: 'Block & restrict' },
  { id: 'widgets', label: 'Widgets' },
  { id: 'alerts', label: 'System alerts' },
  { id: 'users', label: 'Users & team' },
  { id: 'pricing', label: 'Plans & pricing' },
];

function overageDollarsPerBlock(): string {
  // overageMicrocentsPerVisitBlock() is flat across every plan (see
  // lib/visits.ts) — 10,000 microcents = $0.10 per 1,000-visit block.
  const microcents = overageMicrocentsPerVisitBlock();
  return (microcents / 100_000).toFixed(2);
}

const FAQS: { id: string; q: string; a: string }[] = [
  {
    id: 'what-is-sitevento',
    q: 'What is sitevento?',
    a:
      'sitevento is a single meta tag you paste into any website\u2019s <head>. That one tag handles visit and unique-visitor tracking, lets you push widgets (countdown bars, contact forms, email capture, spin-to-win) live with no redeploy, publishes live overlays, sends you system alerts, and lets you block or temporarily restrict individual visitors \u2014 all from one dashboard.',
  },
  {
    id: 'how-does-it-work',
    q: 'How does sitevento work?',
    a:
      'You create a site in the dashboard, paste the generated tag into your page\u2019s <head>, and sitevento verifies the tag is live on your domain. From that moment, visit logging starts immediately, and anything you turn on afterward \u2014 a widget, an overlay, a visitor restriction \u2014 goes live through that same tag with no second deploy.',
  },
  {
    id: 'how-much-does-it-cost',
    q: 'How much does sitevento cost?',
    a:
      'sitevento has four plans: Free ($0/mo, 1,000 visits/month), Starter ($19/mo, 50,000 visits/month), Scale ($49/mo, 400,000 visits/month), and Pro Developer ($99/mo, 1,000,000 visits/month). Every plan can go over its monthly visit allowance \u2014 logging never hard-stops \u2014 and extra visits are billed at a flat $0.10 per 1,000 visits on every plan.',
  },
  {
    id: 'what-happens-over-limit',
    q: 'What happens if a site goes over its plan\u2019s monthly visit limit?',
    a:
      'Visit logging keeps running past the limit \u2014 it never stops collecting data or breaks your site. Visits beyond your plan\u2019s monthly allowance are simply billed as overage at $0.10 per 1,000 visits, the same flat rate on every plan, sold in whole 1,000-visit blocks.',
  },
  {
    id: 'block-vs-restrict',
    q: 'What is the difference between blocking and restricting a visitor?',
    a:
      'A block is permanent until you personally undo it. A restriction has a clock on it \u2014 you set a duration (an hour, a day, a week) and it lifts itself automatically with no follow-up reminder needed. Restricting is available from the Starter plan up; Free includes a limited trial of visitor blocking.',
  },
  {
    id: 'is-there-a-build-step',
    q: 'Does sitevento require a build step or SDK?',
    a:
      'No. It is one meta tag with no SDK, no npm package, and no build step \u2014 it works on a static HTML page, a Shopify store, WordPress, Webflow, Wix, Squarespace, Framer, Carrd, Ghost, a Next.js app, or hand-rolled HTML.',
  },
];

const FAQ_JSON_LD = {
  '@context': 'https://schema.org',
  '@type': 'FAQPage',
  mainEntity: FAQS.map((f) => ({
    '@type': 'Question',
    name: f.q,
    acceptedAnswer: { '@type': 'Answer', text: f.a },
  })),
};

export function HowItWorksPage() {
  return (
    <div className="hiw2-page">
      {/* eslint-disable-next-line @next/next/no-sync-scripts */}
      <script type="application/ld+json" dangerouslySetInnerHTML={{ __html: JSON.stringify(FAQ_JSON_LD) }} />

      <ReturnHomeHeader />

      <div className="hiw2-hero">
        <ContentBlob className="hiw2-hero-blob" />
        <div className="hiw2-hero-inner">
          <span className="hiw2-eyebrow">
            <span className="dot" />
            how sitevento works
          </span>
          <h1>One tag. Full control of your site — and what it costs to run.</h1>
          <p className="hiw2-hero-sub">
            Every feature sitevento ships — tracking, widgets, visitor control, alerts, team access — runs
            through a single meta tag you paste once. Below: exactly how that tag works, step by step, plus every
            plan&apos;s price and monthly visit allowance in full.
          </p>
          <p className="hiw2-hero-sub" style={{ fontSize: 12, opacity: 0.6, marginTop: -6 }}>
            Last updated {formatLiveDate()}
          </p>

          <div className="hiw2-hero-ctas">
            <Link href="/dashboard/connect" className="btn btn-primary">
              Connect your site <span aria-hidden="true">➔</span>
            </Link>
            <Link href="/pricing" className="btn btn-secondary">
              See full pricing
            </Link>
          </div>

          <div className="hiw2-hero-stats">
            <div className="hiw2-hero-stat">
              <span className="hiw2-hero-stat-value">1</span>
              <span className="hiw2-hero-stat-label">tag to install, ever</span>
            </div>
            <div className="hiw2-hero-stat">
              <span className="hiw2-hero-stat-value">$0</span>
              <span className="hiw2-hero-stat-label">to start on Free</span>
            </div>
            <div className="hiw2-hero-stat">
              <span className="hiw2-hero-stat-value">4</span>
              <span className="hiw2-hero-stat-label">plans, 1k–1M visits/mo</span>
            </div>
          </div>
        </div>
      </div>

      <div className="hiw2-body">
        <div className="hiw2-body-inner">
          <HowItWorksRail steps={STEPS} />

          <div className="hiw2-content">
            {/* ── Step 1: the tag ───────────────────────────────── */}
            <section className="cp-card hiw2-section hiw2-step-card" id="the-tag">
              <div>
                <span className="hiw2-step-kicker">
                  <span className="hiw2-step-num">1</span>
                  Step one, and the only install step
                </span>
                <h2>One tag. Pasted once. Nothing else to deploy, ever.</h2>
                <p>
                  Most site tools make you install a widget for chat, a different snippet for analytics, and a third
                  for A/B tests. sitevento is one meta tag in your <code>&lt;head&gt;</code>. Every other feature —
                  tracking, widgets, alerts, visitor controls — runs through that same tag, so turning something new
                  on is a toggle in your dashboard, never a second deploy.
                </p>
                <p>
                  Widgets never execute directly in your page&apos;s own JavaScript context — each one loads inside a
                  sandboxed iframe, so enabling a widget doesn&apos;t hand a third party full access to your
                  page&apos;s DOM or cookies.
                </p>
              </div>
              <div className="hiw2-visual">
                <div className="hiw2-code-card">
                  <div className="hiw2-code-dots"><span /><span /><span /></div>
                  <code className="hiw2-code-line">&lt;meta name=&quot;sitevento&quot; content=&quot;…&quot;&gt;</code>
                </div>
                <span className="hiw2-verify-pill">
                  <span className="hiw2-verify-dot" />
                  Tag verified — tracking live
                </span>
              </div>
            </section>

            {/* ── Step 2: tracking ──────────────────────────────── */}
            <section className="cp-card hiw2-section hiw2-step-card" id="tracking">
              <div>
                <span className="hiw2-step-kicker">
                  <span className="hiw2-step-num">2</span>
                  Live from the moment the tag verifies
                </span>
                <h2>Every visit, every unique visitor, in real time.</h2>
                <p>
                  The instant your tag goes live, sitevento starts logging page views and recognizing unique
                  visitors by device — even across sessions, even if they clear cookies. You get a running log, not
                  a once-a-day report.
                </p>
              </div>
              <div className="hiw2-visual">
                <div className="hiw2-stat-row">
                  <div className="hiw2-stat-tile">
                    <span className="hiw2-stat-label">Visits today</span>
                    <span className="hiw2-stat-num">1,284</span>
                  </div>
                  <div className="hiw2-stat-tile">
                    <span className="hiw2-stat-label">Unique visitors</span>
                    <span className="hiw2-stat-num">412</span>
                  </div>
                </div>
                <span className="hiw2-live-row">
                  <span className="hiw2-live-dot" />
                  Streaming live — no refresh needed
                </span>
              </div>
            </section>

            {/* ── Step 3: control ───────────────────────────────── */}
            <section className="cp-card hiw2-section hiw2-step-card" id="control">
              <div>
                <span className="hiw2-step-kicker">
                  <span className="hiw2-step-num">3</span>
                  What makes sitevento different
                </span>
                <h2>Block for good, or restrict for exactly as long as you choose.</h2>
                <p>
                  This is the thing most site tools can&apos;t do at all: a block is permanent, but a restriction has
                  a clock on it. Mute a visitor for an hour while you sort out an abuse report, or a week while a
                  dispute gets resolved — it lifts itself automatically, no follow-up reminder to go undo it.
                </p>
                <ul className="hiw2-compare">
                  <li><strong>Block</strong> — permanent, until you personally undo it.</li>
                  <li><strong>Restrict</strong> — set a duration, it lifts itself. No reminders, no forgetting about it.</li>
                </ul>
              </div>
              <div className="hiw2-visual">
                <div className="hiw2-user-row" style={{ border: 'none', padding: '0 0 6px' }}>
                  <span style={{ fontSize: 13, fontWeight: 700, color: 'var(--ink)' }}>Visitor #4821</span>
                  <span
                    style={{
                      marginLeft: 'auto',
                      fontSize: 11,
                      fontWeight: 700,
                      padding: '3px 9px',
                      borderRadius: 999,
                      background: 'var(--dash-orange-surface)',
                      color: 'var(--dash-orange-ink)',
                    }}
                  >
                    Restricted 24h
                  </span>
                </div>
                <p style={{ margin: 0, fontSize: 12.5, color: '#6b655c' }}>Lifts automatically in 9h 12m — no action needed.</p>
              </div>
            </section>

            {/* ── Step 4: widgets ───────────────────────────────── */}
            <section className="cp-card hiw2-section hiw2-step-card" id="widgets">
              <div>
                <span className="hiw2-step-kicker">
                  <span className="hiw2-step-num">4</span>
                  Dropped live, no redeploy
                </span>
                <h2>Turn a widget on and it&apos;s just there — on every page, instantly.</h2>
                <p>
                  Countdown bars, contact forms, spin-to-win rewards, campaign banners — pick one from the catalog,
                  style it to match your site, and switch it on. It appears on your live site through the same tag
                  you already installed. Switch it off just as fast.
                </p>
                <p>
                  How many widgets can be live on one site at once scales by plan — {WIDGET_LIVE_LIMITS.free} on
                  Free, {WIDGET_LIVE_LIMITS.starter} on Starter, {WIDGET_LIVE_LIMITS.scale} on Scale, up to{' '}
                  {WIDGET_LIVE_LIMITS['pro-developer']} on Pro Developer.
                </p>
              </div>
              <div className="hiw2-visual">
                <div className="hiw2-widget-grid">
                  <div className="hiw2-widget-chip">
                    Countdown bar
                    <span className="hiw2-widget-status is-live">Live</span>
                  </div>
                  <div className="hiw2-widget-chip">
                    Spin to win
                    <span className="hiw2-widget-status is-live">Live</span>
                  </div>
                  <div className="hiw2-widget-chip">
                    Contact form
                    <span className="hiw2-widget-status">Off</span>
                  </div>
                  <div className="hiw2-widget-chip">
                    Email capture
                    <span className="hiw2-widget-status">Off</span>
                  </div>
                </div>
              </div>
            </section>

            {/* ── Step 5: alerts ────────────────────────────────── */}
            <section className="cp-card hiw2-section hiw2-step-card" id="alerts">
              <div>
                <span className="hiw2-step-kicker">
                  <span className="hiw2-step-num">5</span>
                  So you hear about trouble first
                </span>
                <h2>Alerts that reach you before a visitor has to.</h2>
                <p>
                  Site down, traffic spike, suspicious activity — sitevento watches your connected sites and pushes
                  an alert the moment something needs your attention, with a threshold you control: everything,
                  spikes only, or errors only.
                </p>
              </div>
              <div className="hiw2-visual">
                <ul className="hiw2-compare" style={{ gap: 6 }}>
                  <li>⚠️ Traffic spike on checkout page</li>
                  <li>🟠 New restricted visitor returned</li>
                  <li>🔴 Site responded slowly for 30s</li>
                </ul>
              </div>
            </section>

            {/* ── Step 6: users & team ──────────────────────────── */}
            <section className="cp-card hiw2-section hiw2-step-card" id="users">
              <div>
                <span className="hiw2-step-kicker">
                  <span className="hiw2-step-num">6</span>
                  Every visitor, and every teammate
                </span>
                <h2>One list of every visitor you&apos;ve ever had, and who on your team can touch it.</h2>
                <p>
                  Country, first seen, last seen, and one-tap restrict, block, message, or delete — right from the
                  visitor list. Add teammates with their own sign-in so you&apos;re not the only one who can run the
                  dashboard.
                </p>
              </div>
              <div className="hiw2-visual">
                <div className="hiw2-user-list">
                  <div className="hiw2-user-row">
                    <span className="hiw2-user-flag" aria-hidden="true">🇺🇸</span>
                    <span className="hiw2-user-seen">Active 2m ago</span>
                    <span className="hiw2-user-action">Restrict</span>
                  </div>
                  <div className="hiw2-user-row">
                    <span className="hiw2-user-flag" aria-hidden="true">🇬🇧</span>
                    <span className="hiw2-user-seen">Active 1h ago</span>
                    <span className="hiw2-user-action">Message</span>
                  </div>
                  <div className="hiw2-user-row">
                    <span className="hiw2-user-flag" aria-hidden="true">🇿🇦</span>
                    <span className="hiw2-user-seen">Active 4h ago</span>
                    <span className="hiw2-user-action">Block</span>
                  </div>
                </div>
              </div>
            </section>

            {/* ── Pricing ────────────────────────────────────────── */}
            <section className="hiw2-section" id="pricing" aria-labelledby="hiw2-pricing-heading">
              <div style={{ marginBottom: 18 }}>
                <span className="cp-card-eyebrow">plans &amp; pricing</span>
                <h2 id="hiw2-pricing-heading" style={{ margin: '0 0 8px', fontFamily: 'Georgia, serif', fontSize: 'clamp(21px, 3.6vw, 28px)', color: 'var(--ink)' }}>
                  Four plans. One flat overage rate. No surprise hard-stops.
                </h2>
                <p style={{ margin: 0, fontSize: 15, lineHeight: 1.7, color: '#403d38', maxWidth: '68ch' }}>
                  Every plan includes a monthly visit allowance — tracked page views logged through your tag. Go over
                  it and logging keeps running; extra visits are simply billed at ${overageDollarsPerBlock()} per{' '}
                  {OVERAGE_VISIT_BLOCK_SIZE.toLocaleString()} visits, the same flat rate on every plan.
                </p>
              </div>

              <div className="hiw2-plans-grid">
                {PLANS.map((p) => (
                  <div key={p.id} className={`hiw2-plan-card${p.featured ? ' is-featured' : ''}`}>
                    {p.featured && <span className="hiw2-plan-badge">Most popular</span>}
                    <p className="hiw2-plan-name">{p.name}</p>
                    <p className="hiw2-plan-tagline">{p.tagline}</p>
                    <div className="hiw2-plan-price">
                      <span className="hiw2-plan-price-num">{p.priceDisplay}</span>
                      <span className="hiw2-plan-price-suffix">/mo</span>
                    </div>

                    <div className="hiw2-plan-visits">
                      <span className="hiw2-plan-visits-num">
                        {MONTHLY_VISIT_LIMITS[p.id].toLocaleString()} visits/mo
                      </span>
                      <span className="hiw2-plan-visits-label">included every month</span>
                    </div>

                    <ul className="hiw2-plan-features">
                      <li>{p.limits.connectedSites} connected site{p.limits.connectedSites === 1 ? '' : 's'}</li>
                      <li>{p.limits.liveWidgetsPerSite} live widgets per site</li>
                      <li>
                        {p.limits.historyRetentionDays === null
                          ? 'Unlimited visit history'
                          : `${p.limits.historyRetentionDays}-day visit history`}
                      </li>
                      {p.cardHighlights.slice(0, 2).map((h) => (
                        <li key={h}>{h}</li>
                      ))}
                    </ul>

                    <p className="hiw2-plan-overage">
                      Over the included {MONTHLY_VISIT_LIMITS[p.id].toLocaleString()}: <strong>${overageDollarsPerBlock()} / {OVERAGE_VISIT_BLOCK_SIZE.toLocaleString()} visits</strong>
                    </p>

                    <Link href={p.id === 'free' ? '/' : '/pricing'} className={`hiw2-plan-cta${p.featured ? ' is-featured' : ''}`}>
                      {p.cta}
                    </Link>
                  </div>
                ))}
              </div>

              <div className="hiw2-overage-note" style={{ marginTop: 16 }}>
                <span aria-hidden="true" style={{ fontSize: 18 }}>💡</span>
                <span>
                  <strong>Overage never hard-stops your site.</strong> Visit logging keeps running past your plan&apos;s
                  monthly allowance on every plan — extra visits are simply billed at ${overageDollarsPerBlock()} per{' '}
                  {OVERAGE_VISIT_BLOCK_SIZE.toLocaleString()}-visit block, rounded up to the nearest whole block.
                  See the full <Link href="/pricing" style={{ color: 'var(--walnut-dark)' }}>pricing page</Link> for every limit by plan.
                </span>
              </div>
            </section>

            {/* ── FAQ ────────────────────────────────────────────── */}
            <section className="cp-card" aria-labelledby="hiw2-faq-heading">
              <span className="cp-card-eyebrow">frequently asked</span>
              <h2 id="hiw2-faq-heading">Questions about how sitevento works</h2>
              {FAQS.map((f) => (
                <div key={f.id} id={f.id} style={{ paddingTop: 16, marginTop: 16, borderTop: '1px solid var(--line)' }}>
                  <h3 style={{ margin: '0 0 8px', fontSize: 15.5, fontWeight: 700, color: 'var(--ink)', fontFamily: '-apple-system, sans-serif' }}>
                    {f.q}
                  </h3>
                  <p style={{ margin: 0 }}>{f.a}</p>
                </div>
              ))}
            </section>

            {/* ── Final CTA ──────────────────────────────────────── */}
            <div className="hiw2-final-cta">
              <div>
                <h2>Paste one tag. See everything.</h2>
                <p>Free to start, live in under two minutes, no credit card required for the Free plan.</p>
              </div>
              <div className="hiw2-final-cta-actions">
                <Link href="/dashboard/connect" className="hiw2-final-btn is-primary">
                  Connect your site <span aria-hidden="true">➔</span>
                </Link>
                <Link href="/pricing" className="hiw2-final-btn is-secondary">
                  Compare plans
                </Link>
              </div>
            </div>
          </div>
        </div>
      </div>

      <Footer />
    </div>
  );
}
