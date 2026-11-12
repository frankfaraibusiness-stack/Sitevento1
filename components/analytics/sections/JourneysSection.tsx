'use client';

// 5 · Visitor journeys — landing pages, exit pages, common paths.
import { useState } from 'react';
import { Empty, RankedList, SectionTitle, SubHead, Tabs } from './primitives';
import { JOURNEYS_TITLE, JOURNEY_TABS } from './analyticsTypes';
import { useAnalyticsData } from '../AnalyticsDataContext';

export function JourneysSection() {
  const { model } = useAnalyticsData();
  const j = model.journeys;
  const [tab, setTab] = useState(JOURNEY_TABS[0]);
  const paths = j.paths[tab] ?? [];
  return (
    <section className="an-section" id="journeys" aria-labelledby="journeys-title">
      <SectionTitle id="journeys-title" title={JOURNEYS_TITLE} note={j.subtitle} />

      <div className="an-mini-cols">
        <div>
          <SubHead first>Where visitors land</SubHead>
          {j.landing.length ? <RankedList rows={j.landing} bars={false} /> : <Empty />}
        </div>
        <div>
          <SubHead first>Where visitors leave</SubHead>
          {j.exits.length ? <RankedList rows={j.exits} bars={false} /> : <Empty />}
        </div>
      </div>

      <Tabs label="Journey view" items={JOURNEY_TABS.map((t) => ({ id: t }))} active={tab} onChange={setTab} />
      {paths.length ? (
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
        <Empty title="No journeys yet">{tab === 'Led to a lead' ? 'Journeys that end in a captured lead show up here.' : 'Visitors who view two or more pages show up here.'}</Empty>
      )}
    </section>
  );
}
