'use client';

// components/marketing/ControlMoments.tsx
//
// New marketing section: "the moment you flip the switch." Three
// tappable/hoverable cards, each a tiny before/after scene of a real
// sitevento action (maintenance mode, a live banner, blocking a
// visitor) — flipping from "plain site" to "you took control" with no
// code and no redeploy. Tactile rather than looping on a timer (unlike
// ConnectedSiteShowcase below it): the visitor flips each card
// themselves, which sells "instant control" by letting them feel it.
//
// Stacks as single-column cards on mobile (each already tall enough to
// read as its own moment); becomes a 3-up row on desktop with a
// taller, more detailed card face since there's width to spare.

import { useState } from 'react';
import type { CSSProperties } from 'react';
import { useScrollReveal } from '@/hooks/useScrollReveal';

type MomentId = 'maintenance' | 'banner' | 'block';

interface Moment {
  id: MomentId;
  eyebrow: string;
  title: string;
  before: {
    label: string;
    sub: string;
  };
  after: {
    label: string;
    sub: string;
  };
}

const MOMENTS: Moment[] = [
  {
    id: 'maintenance',
    eyebrow: 'One click',
    title: 'Maintenance mode',
    before: { label: 'YourSite.com', sub: 'Live to everyone' },
    after: { label: "We'll be right back", sub: 'Full-site takeover — live in seconds' },
  },
  {
    id: 'banner',
    eyebrow: 'No redeploy',
    title: 'Site-wide banner',
    before: { label: 'YourSite.com', sub: 'No announcement' },
    after: { label: '🎉 20% off today only', sub: 'Pushed live, visible to every visitor now' },
  },
  {
    id: 'block',
    eyebrow: 'Instant',
    title: 'Block a visitor',
    before: { label: '203.0.113.42', sub: 'Browsing freely' },
    after: { label: '203.0.113.42', sub: 'Blocked — can no longer reach your site' },
  },
];

function IconSwap() {
  return (
    <svg viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2" strokeLinecap="round" strokeLinejoin="round" aria-hidden="true">
      <path d="M7 3 3 7l4 4" />
      <path d="M3 7h12a4 4 0 0 1 4 4v1" />
      <path d="m17 21 4-4-4-4" />
      <path d="M21 17H9a4 4 0 0 1-4-4v-1" />
    </svg>
  );
}

function MomentCard({ moment, index }: { moment: Moment; index: number }) {
  const [flipped, setFlipped] = useState(false);
  const reveal = useScrollReveal<HTMLDivElement>();

  return (
    <div
      className="cm-card"
      ref={reveal}
      style={{ '--cm-index': index } as CSSProperties}
    >
      <div className="cm-card-head">
        <span className="cm-eyebrow">{moment.eyebrow}</span>
        <h3 className="cm-title">{moment.title}</h3>
      </div>

      <button
        type="button"
        className={`cm-flip${flipped ? ' is-flipped' : ''}`}
        onClick={() => setFlipped((v) => !v)}
        aria-pressed={flipped}
        aria-label={`Preview ${moment.title.toLowerCase()} — tap to toggle before and after`}
      >
        <span className="cm-flip-inner">
          <span className="cm-face cm-face-before">
            <span className="cm-face-chrome">
              <span className="cm-dot" />
              <span className="cm-dot" />
              <span className="cm-dot" />
            </span>
            <span className="cm-face-body">
              <span className="cm-face-label">{moment.before.label}</span>
              <span className="cm-face-sub">{moment.before.sub}</span>
            </span>
            <span className="cm-face-tag cm-face-tag-before">Before</span>
          </span>

          <span className="cm-face cm-face-after">
            <span className="cm-face-chrome">
              <span className="cm-dot" />
              <span className="cm-dot" />
              <span className="cm-dot" />
            </span>
            <span className="cm-face-body">
              <span className="cm-face-label">{moment.after.label}</span>
              <span className="cm-face-sub">{moment.after.sub}</span>
            </span>
            <span className="cm-face-tag cm-face-tag-after">Live now</span>
          </span>
        </span>
      </button>

      <p className="cm-hint">
        <IconSwap />
        Tap to flip
      </p>
    </div>
  );
}

export function ControlMoments() {
  return (
    <section className="cm-section">
      <div className="cm-heading">
        <p className="cm-heading-eyebrow">Why connect at all?</p>
        <h2 className="cm-heading-title">
          Because the moment something needs to change, <span className="cm-heading-mark">you shouldn&apos;t need a developer.</span>
        </h2>
        <p className="cm-heading-sub">
          Three things sitevento users reach for most — see what flipping the switch actually looks like.
        </p>
      </div>

      <div className="cm-grid">
        {MOMENTS.map((m, i) => (
          <MomentCard moment={m} index={i} key={m.id} />
        ))}
      </div>
    </section>
  );
}
