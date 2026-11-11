'use client';

// 9 · Campaigns — traffic by UTM source & medium.
import { useState } from 'react';
import { Empty, SectionTitle, Tabs } from './primitives';
import { CAMPAIGNS_SUBTITLE, CAMPAIGNS_TITLE, CAMPAIGN_TABS, CHANNELS } from './analyticsPlaceholderData';

export function CampaignsSection() {
  const [tab, setTab] = useState(CAMPAIGN_TABS[0]);
  return (
    <section className="an-section" id="campaigns" aria-labelledby="campaigns-title">
      <SectionTitle id="campaigns-title" title={CAMPAIGNS_TITLE} note={CAMPAIGNS_SUBTITLE} />
      <Tabs label="Acquisition view" items={CAMPAIGN_TABS.map((t) => ({ id: t }))} active={tab} onChange={setTab} />
      {tab === 'Channels' ? (
        <div className="an-table-wrap">
          <table className="an-table">
            <thead>
              <tr>
                <th>Channel</th>
                <th>Visitors</th>
                <th>Conversions</th>
                <th>Conv. rate</th>
                <th>vs prior</th>
              </tr>
            </thead>
            <tbody>
              {CHANNELS.map((c) => (
                <tr key={c.name}>
                  <td>
                    <span className="an-chan-dot" style={{ background: c.color }} />
                    {c.name}
                    <small>{c.hint}</small>
                  </td>
                  <td>{c.visitors}</td>
                  <td>{c.conversions}</td>
                  <td>{c.rate}</td>
                  <td className={`an-delta-cell ${c.dir}`}>{c.delta}</td>
                </tr>
              ))}
            </tbody>
          </table>
        </div>
      ) : (
        <Empty />
      )}
    </section>
  );
}
