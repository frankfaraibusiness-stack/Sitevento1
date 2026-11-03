// components/marketing/ToolsShowcaseSection.tsx
//
// New marketing section promoting the real tools available once a
// site is connected — sits after WidgetShowcaseSection. Six tiles,
// each backed by an actual feature rather than invented copy:
//
//   1. Visit analytics   — VisitsChartCard.tsx (real daily Visit[]
//      aggregation, not mock data — see that file's own header
//      comment on clicks being mock but visits being real).
//   2. Session detail     — VisitsPage.tsx's per-visit table: visitor
//      id, time, device, browser/OS, landing page (lib/types.ts's
//      Visit shape).
//   3. Visitor history     — VisitorProfile (lib/types.ts): firstSeenAt
//      / lastSeenAt / visitCount per visitor — framed honestly as
//      "every visitor's full history," not as a % retention metric,
//      since no retention-rate feature exists in the codebase.
//   4. Traffic sources     — Visit.referrer, shown in VisitsPage.tsx
//      ("· via {referrer}" / "· Direct").
//   5. Auto-restrict       — lib/botShield.ts's moderate verdict:
//      self-expiring 1-hour restriction, zero human review.
//   6. Auto-block          — lib/botShield.ts's severe verdict:
//      permanent block, same zero-review engine (BotShieldPageClient
//      calls this "SECURITY BOT" — Refresh & Click Shield + Form
//      Flood Guard).
//
// No "retention %" or "spam-click score" numbers are invented here —
// only the real fields/actions that exist in lib/types.ts and
// lib/botShield.ts.
//
// Visual language matches WidgetShowcaseSection's dark-panel glass
// cards (not a white tile on the lilac --app-bg), but as a denser
// 6-tile icon grid rather than big device mockups, since this
// section is about breadth of tools rather than 3 deep single-widget
// demos. Desktop: fixed 3x2 grid. Mobile: 2-column grid (not a tall
// single-column stack) so it stays compact — per the "I don't want
// to stack it" feedback from the previous section, extended here to
// mean "don't go single-column deep" rather than literally reusing
// horizontal scroll, since 6 short tiles read better as a compact
// grid than a long swipe row.
'use client';

import type { ReactNode } from 'react';

type ToolTone = 'lime' | 'purple' | 'blue' | 'orange' | 'danger' | 'warning';

interface Tool {
  id: string;
  title: string;
  desc: string;
  tone: ToolTone;
  icon: ReactNode;
}

const TOOLS: Tool[] = [
  {
    id: 'visit-analytics',
    title: 'Visit analytics',
    desc: 'Real daily traffic, charted automatically — no setup.',
    tone: 'lime',
    icon: (
      <svg viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth={2} strokeLinecap="round" strokeLinejoin="round">
        <path d="M3 3v18h18" />
        <path d="M7 15l4-5 3 3 5-7" />
      </svg>
    ),
  },
  {
    id: 'session-detail',
    title: 'Session data',
    desc: 'Every visit, broken down by device, browser, and landing page.',
    tone: 'blue',
    icon: (
      <svg viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth={2} strokeLinecap="round" strokeLinejoin="round">
        <rect x="3" y="4" width="18" height="14" rx="2" />
        <path d="M8 21h8M12 18v3" />
      </svg>
    ),
  },
  {
    id: 'visitor-history',
    title: 'Visitor history',
    desc: 'First seen, last seen, and visit count for every visitor.',
    tone: 'purple',
    icon: (
      <svg viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth={2} strokeLinecap="round" strokeLinejoin="round">
        <circle cx="12" cy="12" r="9" />
        <path d="M12 7v5l3.5 2" />
      </svg>
    ),
  },
  {
    id: 'traffic-sources',
    title: 'Traffic sources',
    desc: 'See exactly where every visitor came from — or if it was direct.',
    tone: 'orange',
    icon: (
      <svg viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth={2} strokeLinecap="round" strokeLinejoin="round">
        <circle cx="12" cy="12" r="3" />
        <path d="M12 2v4M12 18v4M4.9 4.9l2.8 2.8M16.3 16.3l2.8 2.8M2 12h4M18 12h4M4.9 19.1l2.8-2.8M16.3 7.7l2.8-2.8" />
      </svg>
    ),
  },
  {
    id: 'auto-restrict',
    title: 'Auto-restrict',
    desc: 'Bad bursts of traffic get a timed restriction — no human review needed.',
    tone: 'warning',
    icon: (
      <svg viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth={2} strokeLinecap="round" strokeLinejoin="round">
        <circle cx="12" cy="12" r="9" />
        <path d="M12 7v5l4 2" />
      </svg>
    ),
  },
  {
    id: 'auto-block',
    title: 'Auto-block',
    desc: 'Severe spam and bot traffic is blocked permanently, automatically.',
    tone: 'danger',
    icon: (
      <svg viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth={2} strokeLinecap="round" strokeLinejoin="round">
        <circle cx="12" cy="12" r="9" />
        <path d="M5.5 5.5l13 13" />
      </svg>
    ),
  },
];

export function ToolsShowcaseSection() {
  return (
    <section className="txs" aria-label="Tools available once your site is connected">
      <div className="txs-inner">
        <div className="txs-intro">
          <span className="txs-eyebrow">Built in</span>
          <h2 className="txs-title">Everything you need to understand your traffic</h2>
          <p className="txs-copy">
            Analytics, session history, and automatic traffic protection — all live the moment
            you connect, no extra setup.
          </p>
        </div>

        <div className="txs-grid">
          {TOOLS.map((t) => (
            <div className="txs-tile" key={t.id} data-tone={t.tone}>
              <span className="txs-tile-icon">{t.icon}</span>
              <h3 className="txs-tile-title">{t.title}</h3>
              <p className="txs-tile-desc">{t.desc}</p>
            </div>
          ))}
        </div>
      </div>
    </section>
  );
}
