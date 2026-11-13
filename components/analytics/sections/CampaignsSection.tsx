'use client';

// 9 · Campaigns — where visitors come from and what they do next.
// Conversions and revenue are credited to a visitor's first-touch source
// when the backend event carries their visitorId (see the API page).
import { useState } from 'react';
import { Empty, SectionTitle, Tabs } from './primitives';
import { CAMPAIGNS_SUBTITLE, CAMPAIGNS_TITLE, CAMPAIGN_TABS } from './analyticsTypes';
import { useAnalyticsData } from '../AnalyticsDataContext';

const FIRST_COL: Record<string, string> = { Channels: 'Channel', Sources: 'Source', Campaigns: 'Campaign', Mediums: 'Medium' };

export function CampaignsSection() {
  const { model } = useAnalyticsData();
  const [tab, setTab] = useState(CAMPAIGN_TABS[0]);
  const rows = model.campaigns[tab] ?? [];
  const spend = model.campaignHasSpend;
  const anyRevenue = rows.some((r) => r.revenue !== '—');
  return (
    <section className="an-section" id="campaigns" aria-labelledby="campaigns-title">
      <SectionTitle id="campaigns-title" title={CAMPAIGNS_TITLE} note={CAMPAIGNS_SUBTITLE} />
      <Tabs label="Acquisition view" items={CAMPAIGN_TABS.map((t) => ({ id: t }))} active={tab} onChange={setTab} />
      {rows.length ? (
        <div className="an-table-wrap">
          <table className="an-table">
            <thead>
              <tr>
                <th>{FIRST_COL[tab]}</th>
                <th>Visitors</th>
                <th>Conversions</th>
                <th>Conv. rate</th>
                {anyRevenue && <th>Revenue</th>}
                {spend && <th>Spend</th>}
                {spend && <th>ROAS</th>}
              </tr>
            </thead>
            <tbody>
              {rows.map((c) => (
                <tr key={c.name}>
                  <td>
                    <span className="an-chan-dot" style={{ background: c.color }} />
                    {c.name}
                    {c.hint && <small>{c.hint}</small>}
                  </td>
                  <td>{c.visitors.toLocaleString()}</td>
                  <td>{c.conversions.toLocaleString()}</td>
                  <td>{c.rate}</td>
                  {anyRevenue && <td>{c.revenue}</td>}
                  {spend && <td>{c.spend}</td>}
                  {spend && <td>{c.roas}</td>}
                </tr>
              ))}
            </tbody>
          </table>
        </div>
      ) : (
        <Empty title={tab === 'Campaigns' ? 'No tagged campaigns yet' : tab === 'Mediums' ? 'No tagged mediums yet' : 'No data yet'}>
          {tab === 'Campaigns' || tab === 'Mediums' ? 'Add utm_campaign and utm_medium to your links and they’ll be listed here.' : 'Sources appear as soon as visitors arrive.'}
        </Empty>
      )}
      <p className="an-foot-note">Conversions are credited to the visitor’s first source. Pass <code>visitorId</code> with sales and sign-ups from your backend to include them.</p>
    </section>
  );
}
