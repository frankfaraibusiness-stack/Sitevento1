'use client';

// 5 · Visitor journeys — landing pages, exit pages, common paths.
import { useState } from 'react';
import { Empty, RankedList, SectionTitle, SubHead, Tabs } from './primitives';
import { EXIT_PAGES, JOURNEYS, JOURNEYS_SUBTITLE, JOURNEYS_TITLE, JOURNEY_TABS, LANDING_PAGES } from './analyticsPlaceholderData';

export function JourneysSection() {
  const [tab, setTab] = useState(JOURNEY_TABS[0]);
  const paths = JOURNEYS[tab];
  return (
    <section className="an-section" id="journeys" aria-labelledby="journeys-title">
      <SectionTitle id="journeys-title" title={JOURNEYS_TITLE} note={JOURNEYS_SUBTITLE} />

      <div className="an-mini-cols">
        <div>
          <SubHead first>Where visitors land</SubHead>
          <RankedList rows={LANDING_PAGES} bars={false} />
        </div>
        <div>
          <SubHead first>Where visitors leave</SubHead>
          <RankedList rows={EXIT_PAGES} bars={false} />
        </div>
      </div>

      <Tabs label="Journey view" items={JOURNEY_TABS.map((t) => ({ id: t }))} active={tab} onChange={setTab} />
      {paths ? (
        <ol className="an-rows">
          {paths.map((p) => (
            <li key={p.steps.join('>')} className="an-row">
              <span className="an-row-main">
                <span className="an-row-top">
                  <span className="an-journey-step">
                    {p.steps.map((step, i) => (
                      <span key={step + i}>
                        {i > 0 && <span className="an-arrow">→</span>}
                        {step}
                      </span>
                    ))}
                  </span>
                  <span>{p.count}</span>
                </span>
              </span>
            </li>
          ))}
        </ol>
      ) : (
        <Empty />
      )}
    </section>
  );
}
