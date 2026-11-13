'use client';

// 4 · Device experience — conversion, load time and exits per device.
import { useState } from 'react';
import { Empty, MiniStats, RankedList, SectionTitle, SubHead, Tabs } from './primitives';
import { DEVICE_SUBTITLE, DEVICE_TITLE } from './analyticsTypes';
import { useAnalyticsData } from '../AnalyticsDataContext';

export function DeviceExperienceSection() {
  const { model } = useAnalyticsData();
  const tabs = model.devices.tabs;
  const [picked, setPicked] = useState<string | null>(null);
  const tab = picked && tabs.some((t) => t.id === picked) ? picked : tabs[0]?.id;
  const data = tab ? model.devices.byDevice[tab] : undefined;
  return (
    <section className="an-section" id="devices" aria-labelledby="devices-title">
      <SectionTitle id="devices-title" title={DEVICE_TITLE} note={DEVICE_SUBTITLE} />
      {tabs.length ? <Tabs label="Device" items={tabs} active={tab!} onChange={setPicked} /> : null}
      {data ? (
        <>
          <MiniStats items={data.stats} />
          <SubHead>{data.topPagesTitle}</SubHead>
          <RankedList rows={data.topPages} bars={false} />
        </>
      ) : (
        <Empty>Device numbers appear once visits come in for this period.</Empty>
      )}
    </section>
  );
}
