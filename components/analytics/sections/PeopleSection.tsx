'use client';

// 3 · What people do — pages / sources / devices breakdown (tabbed).
import { useState } from 'react';
import { Empty, RankedList, SectionTitle, Tabs } from './primitives';
import { PEOPLE_SUBTITLE, PEOPLE_TABS, PEOPLE_TITLE } from './analyticsTypes';
import { useAnalyticsData } from '../AnalyticsDataContext';

export function PeopleSection() {
  const { model } = useAnalyticsData();
  const [tab, setTab] = useState(PEOPLE_TABS[0]);
  const rows = model.people[tab] ?? [];
  return (
    <section className="an-section" id="people" aria-labelledby="people-title">
      <SectionTitle id="people-title" title={PEOPLE_TITLE} note={PEOPLE_SUBTITLE} />
      <Tabs label="Breakdown" items={PEOPLE_TABS.map((t) => ({ id: t }))} active={tab} onChange={setTab} />
      {rows.length ? <RankedList rows={rows} /> : <Empty />}
    </section>
  );
}
