'use client';

// components/marketing/ControlMoments.tsx
//
// Marketing section just below the hero demo: three real sitevento
// actions (maintenance mode, a site-wide banner, blocking a visitor)
// shown as still, screenshot-like control panels rather than a
// gimmicky before/after flip card. Each panel IS the "after" state —
// the copy beside it carries the "no redeploy, no developer" story
// instead of an interactive toggle doing that work. Quieter, reads
// well at a glance on mobile, and nothing here depends on a visitor
// discovering a tap/hover interaction to understand the section.
//
// Single orchestrated reveal on scroll (the whole row rises together,
// staggered slightly by index) rather than per-card hover effects —
// one deliberate motion moment, not three competing ones.

import type { CSSProperties } from 'react';
import { useScrollReveal } from '@/hooks/useScrollReveal';

type MomentId = 'maintenance' | 'banner' | 'block';

interface Moment {
  id: MomentId;
  title: string;
  description: string;
  panel: {
    chromeLabel: string;
    headline: string;
    sub: string;
    tone: 'ink' | 'lime' | 'walnut';
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
    id: 'block',
    title: 'Block a visitor',
    description: 'Cut off abuse or unwanted traffic instantly, down to a single IP address.',
    panel: {
      chromeLabel: '203.0.113.42',
      headline: 'Access blocked',
      sub: 'Can no longer reach your site',
      tone: 'walnut',
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
    <svg viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="1.6" strokeLinecap="round" strokeLinejoin="round" aria-hidden="true">
      <circle cx="12" cy="12" r="8.5" />
      <path d="M6.8 6.8 17.2 17.2" />
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
