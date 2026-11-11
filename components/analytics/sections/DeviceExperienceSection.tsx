'use client';

// 4 · Device experience — conversion, load time and exits per device.
import { useState } from 'react';
import { Empty, MiniStats, RankedList, SectionTitle, SubHead, Tabs } from './primitives';
import { DEVICE_DATA, DEVICE_SUBTITLE, DEVICE_TABS, DEVICE_TITLE } from './analyticsPlaceholderData';

export function DeviceExperienceSection() {
  const [tab, setTab] = useState(DEVICE_TABS[0].id);
  const data = DEVICE_DATA[tab];
  return (
    <section className="an-section" id="devices" aria-labelledby="devices-title">
      <SectionTitle id="devices-title" title={DEVICE_TITLE} note={DEVICE_SUBTITLE} />
      <Tabs label="Device" items={DEVICE_TABS} active={tab} onChange={setTab} />
      {data ? (
        <>
          <MiniStats items={data.stats} />
          <SubHead>{data.topPagesTitle}</SubHead>
          <RankedList rows={data.topPages} bars={false} />
        </>
      ) : (
        <Empty />
      )}
    </section>
  );
}
