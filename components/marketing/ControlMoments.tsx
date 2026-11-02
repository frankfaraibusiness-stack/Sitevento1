'use client';

// components/marketing/ControlMoments.tsx
//
// Marketing section just below the hero demo — fully redesigned. The
// flat --app-bg page color is replaced with its own animated
// "protected purple" backdrop (a deeper purple wash, a drifting field
// of faint shield glyphs + dots, and a soft vignette fade at the
// edges — see .cm-shield-field in control-moments.css) so the section
// reads as its own distinct, branded moment instead of just more page
// background behind three cards.
//
// Three real sitevento actions, shown as still, screenshot-like
// control panels: maintenance mode, a site-wide banner, and (new)
// 24/7 bot-shield security — replacing the old "block a visitor"
// panel, which this one supersedes (blocking bad traffic is part of
// what the security bot does automatically). Each card's title +
// description are centered beneath its panel.
//
// Single orchestrated reveal on scroll (the whole row rises together,
// staggered slightly by index) rather than per-card hover effects —
// one deliberate motion moment, not three competing ones.

import type { CSSProperties } from 'react';
import { useScrollReveal } from '@/hooks/useScrollReveal';

type MomentId = 'maintenance' | 'banner' | 'security';

interface Moment {
  id: MomentId;
  title: string;
  description: string;
  panel: {
    chromeLabel: string;
    headline: string;
    sub: string;
    tone: 'ink' | 'lime' | 'security';
  };
}

const MOMENTS: Moment[] = [
  {
    id: 'maintenance',
    title: 'Maintenance mode',
    description: 'Take the whole site down for visitors in one click, no deploy required.',
    panel: {
      chromeLabel: 'yoursite.com',
      headline: "We'll be right back",
      sub: 'Full-site takeover, live in seconds',
      tone: 'ink',
    },
  },
  {
    id: 'banner',
    title: 'Site-wide banner',
    description: 'Push an announcement to every visitor the moment you need to say something.',
    panel: {
      chromeLabel: 'yoursite.com',
      headline: '20% off today only',
      sub: 'Visible to every visitor right now',
      tone: 'lime',
    },
  },
  {
    id: 'security',
    title: 'Security, on autopilot',
    description: 'A security bot watches your site 24/7 and blocks bad traffic the instant it shows up — no setup, no waiting.',
    panel: {
      chromeLabel: 'bot-shield',
      headline: 'Threat blocked',
      sub: 'Monitoring live — 24/7 protection',
      tone: 'security',
    },
  },
];

function PanelGlyph({ id }: { id: MomentId }) {
  if (id === 'maintenance') {
    return (
      <svg viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="1.6" strokeLinecap="round" strokeLinejoin="round" aria-hidden="true">
        <circle cx="12" cy="12" r="8.5" />
        <path d="M12 7.5v5l3 2" />
      </svg>
    );
  }
  if (id === 'banner') {
    return (
      <svg viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="1.6" strokeLinecap="round" strokeLinejoin="round" aria-hidden="true">
        <path d="M4 10.5V15a1 1 0 0 0 1 1h2.2l1.1 3.2a.9.9 0 0 0 1.7-.3L9.6 16H16l4 3V7.5l-4 3H8L4 10.5Z" />
      </svg>
    );
  }
  return (
    <svg viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="1.7" strokeLinecap="round" strokeLinejoin="round" aria-hidden="true">
      <path d="M12 3.5 5 6.2v5.1c0 4.6 3 7.9 7 9.2 4-1.3 7-4.6 7-9.2V6.2L12 3.5Z" />
      <path d="m9.3 12.1 1.9 1.9 3.6-3.9" />
    </svg>
  );
}

function MomentPanel({ moment, index }: { moment: Moment; index: number }) {
  const reveal = useScrollReveal<HTMLDivElement>();

  return (
    <article className="cm-card" ref={reveal} style={{ '--cm-index': index } as CSSProperties}>
      <div className={`cm-panel cm-panel-${moment.panel.tone}`}>
        <div className="cm-panel-chrome">
          <span className="cm-panel-dot" />
          <span className="cm-panel-dot" />
          <span className="cm-panel-dot" />
          <span className="cm-panel-url">{moment.panel.chromeLabel}</span>
        </div>
        <div className="cm-panel-body">
          <span className="cm-panel-glyph">
            <PanelGlyph id={moment.id} />
          </span>
          <span className="cm-panel-headline">{moment.panel.headline}</span>
          <span className="cm-panel-sub">{moment.panel.sub}</span>
          {moment.id === 'security' && <span className="cm-panel-pulse" aria-hidden="true" />}
        </div>
      </div>

      <h3 className="cm-title">{moment.title}</h3>
      <p className="cm-desc">{moment.description}</p>
    </article>
  );
}

export function ControlMoments() {
  return (
    <section className="cm-section">
      {/* Animated "protected purple" backdrop — deeper purple wash,
          drifting shield glyphs + dot field, vignette fade at the
          edges. Purely decorative, sits behind everything else in
          the section. */}
      <div className="cm-shield-field" aria-hidden="true">
        <span className="cm-shield-dot" />
        <span className="cm-shield-dot" />
        <span className="cm-shield-dot" />
        <span className="cm-shield-dot" />
        <span className="cm-shield-dot" />
        <span className="cm-shield-dot" />
        <span className="cm-shield-dot" />
        <span className="cm-shield-dot" />
        <span className="cm-shield-glyph cm-shield-glyph-a">
          <svg viewBox="0 0 24 24" fill="currentColor" aria-hidden="true">
            <path d="M12 2.5 4 5.8v6.1c0 5.6 3.4 9.6 8 11.1 4.6-1.5 8-5.5 8-11.1V5.8L12 2.5Z" />
          </svg>
        </span>
        <span className="cm-shield-glyph cm-shield-glyph-b">
          <svg viewBox="0 0 24 24" fill="currentColor" aria-hidden="true">
            <path d="M12 2.5 4 5.8v6.1c0 5.6 3.4 9.6 8 11.1 4.6-1.5 8-5.5 8-11.1V5.8L12 2.5Z" />
          </svg>
        </span>
        <span className="cm-shield-glyph cm-shield-glyph-c">
          <svg viewBox="0 0 24 24" fill="currentColor" aria-hidden="true">
            <path d="M12 2.5 4 5.8v6.1c0 5.6 3.4 9.6 8 11.1 4.6-1.5 8-5.5 8-11.1V5.8L12 2.5Z" />
          </svg>
        </span>
      </div>

      <div className="cm-heading">
        <h2 className="cm-heading-title">
          The moment something needs to change, you shouldn&apos;t need a developer
        </h2>
        <p className="cm-heading-sub">
          Three things sitevento users reach for most, live on the site in the time it takes to click a button.
        </p>
      </div>

      <div className="cm-grid">
        {MOMENTS.map((m, i) => (
          <MomentPanel moment={m} index={i} key={m.id} />
        ))}
      </div>
    </section>
  );
}
