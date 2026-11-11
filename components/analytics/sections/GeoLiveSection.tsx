// 2 · Top countries + Live activity (two columns on desktop).
import { RankedList, SectionTitle } from './primitives';
import { COUNTRIES, COUNTRIES_NOTE, LIVE_ACTIVITY } from './analyticsPlaceholderData';

export function GeoLiveSection() {
  return (
    <div className="an-row-2" id="geo">
      <section className="an-section" aria-labelledby="countries-title">
        <SectionTitle id="countries-title" title="Top countries" note={COUNTRIES_NOTE} />
        <RankedList rows={COUNTRIES} />
      </section>

      <section className="an-section" aria-labelledby="live-title">
        <div className="an-live-head">
          <span className="an-live-dot" aria-hidden="true" />
          <span id="live-title">Live activity</span>
        </div>
        <ul className="an-log">
          {LIVE_ACTIVITY.map((e) => (
            <li key={e.path + e.time} className={e.blocked ? 'an-log-row is-blocked' : 'an-log-row'}>
              <span className="an-log-flag">{e.flag}</span>
              <div className="an-log-main">
                <span className="an-log-path">{e.path}</span>
                <span className="an-log-meta">{e.meta}</span>
              </div>
              <span className="an-log-time">{e.time}</span>
            </li>
          ))}
        </ul>
      </section>
    </div>
  );
}
