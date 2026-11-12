'use client';

// components/connect/ConnectSideRail.tsx
//
// Shared desktop side-rail UI (see styles/connect/connect-side-rail.css
// for why this exists — turning the >=1040px layout from one narrow
// centered column on an empty background into a real two-column page).
// Each step passes its OWN content: a short "How it works" numbered
// list and a small FAQ accordion, genuinely different per step rather
// than one generic blurb repeated three times. This component only
// owns the rendering/accordion-toggle behavior, not the copy.
import { useState } from 'react';

export interface RailFaqItem {
  q: string;
  a: string;
}

export interface RailStepsContent {
  icon: React.ReactNode;
  title: string;
  steps: Array<{ text: React.ReactNode }>;
}

export interface RailFaqContent {
  icon: React.ReactNode;
  title: string;
  items: RailFaqItem[];
}

interface ConnectSideRailProps {
  howItWorks: RailStepsContent;
  faq: RailFaqContent;
  footnote?: React.ReactNode;
}

const InfoIcon = () => (
  <svg viewBox="0 0 24 24">
    <circle cx="12" cy="12" r="9" />
    <path d="M12 16v-5M12 8h.01" />
  </svg>
);

export function ConnectSideRail({ howItWorks, faq, footnote }: ConnectSideRailProps) {
  const [openIdx, setOpenIdx] = useState<number | null>(0);

  return (
    <aside className="cwz-side-rail" aria-label="How this step works">
      <div className="cwz-rail-card">
        <div className="cwz-rail-card-header">
          <span className="cwz-rail-card-icon">{howItWorks.icon}</span>
          <span className="cwz-rail-card-title">{howItWorks.title}</span>
        </div>
        <div className="cwz-rail-steps">
          {howItWorks.steps.map((s, i) => (
            <div className="cwz-rail-step" key={i}>
              <span className="cwz-rail-step-num">{i + 1}</span>
              <span className="cwz-rail-step-text">{s.text}</span>
            </div>
          ))}
        </div>
      </div>

      <div className="cwz-rail-card">
        <div className="cwz-rail-card-header">
          <span className="cwz-rail-card-icon">{faq.icon}</span>
          <span className="cwz-rail-card-title">{faq.title}</span>
        </div>
        <div className="cwz-rail-faq-list">
          {faq.items.map((item, i) => {
            const isOpen = openIdx === i;
            return (
              <div className="cwz-rail-faq-item" key={i}>
                <button
                  type="button"
                  className="cwz-rail-faq-q"
                  aria-expanded={isOpen}
                  onClick={() => setOpenIdx(isOpen ? null : i)}
                >
                  <span>{item.q}</span>
                  <svg className={`cwz-rail-faq-chevron${isOpen ? ' is-open' : ''}`} viewBox="0 0 24 24">
                    <path d="M6 9l6 6 6-6" />
                  </svg>
                </button>
                <div className={`cwz-rail-faq-a${isOpen ? ' is-open' : ''}`}>
                  <p>{item.a}</p>
                </div>
              </div>
            );
          })}
        </div>
      </div>

      {footnote && (
        <p className="cwz-rail-footnote">
          <InfoIcon />
          <span>{footnote}</span>
        </p>
      )}
    </aside>
  );
}
