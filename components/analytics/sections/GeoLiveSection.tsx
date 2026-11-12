'use client';

// 2 · Top countries + Live activity (two columns on desktop).
import { Empty, RankedList, SectionTitle } from './primitives';
import { useAnalyticsData } from '../AnalyticsDataContext';

export function GeoLiveSection() {
  const { model } = useAnalyticsData();
  const { countries, note, live } = model.geo;
  return (
    <div className="an-row-2" id="geo">
      <section className="an-section" aria-labelledby="countries-title">
        <SectionTitle id="countries-title" title="Top countries" note={note} />
        {countries.length ? <RankedList rows={countries} /> : <Empty>Countries appear as soon as visitors arrive.</Empty>}
      </section>

      <section className="an-section" aria-labelledby="live-title">
        <div className="an-live-head">
          <span className="an-live-dot" aria-hidden="true" />
          <span id="live-title">Live activity</span>
        </div>
        {live.length ? (
          <ul className="an-log">
            {live.map((e) => (
              <li key={e.key} className={e.blocked ? 'an-log-row is-blocked' : 'an-log-row'}>
                <span className="an-log-flag">{e.flag}</span>
                <div className="an-log-main">
                  <span className="an-log-path">{e.path}</span>
                  <span className="an-log-meta">{e.meta}</span>
                </div>
                <span className="an-log-time">{e.time}</span>
              </li>
            ))}
          </ul>
        ) : (
          <Empty>No visits in this period yet.</Empty>
        )}
      </section>
    </div>
  );
}
