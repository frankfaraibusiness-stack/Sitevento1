// 16 · Real-time sitewide log (scrollable feed of every event hitting the API).
import { SectionTitle } from './primitives';
import { LIVELOG_FOOT, LIVELOG_SUBTITLE, LIVELOG_TITLE, LIVE_LOG } from './analyticsPlaceholderData';

export function LiveLogSection() {
  return (
    <section className="an-section" id="live-log" aria-labelledby="live-log-title">
      <SectionTitle id="live-log-title" title={LIVELOG_TITLE} note={LIVELOG_SUBTITLE} />

      <div className="an-livelog-card">
        <div className="an-livelog-head">
          <div className="an-livelog-head-left">
            <span className="an-live-dot" aria-hidden="true" />
            <span>Live</span>
          </div>
          <span className="an-livelog-count">{LIVE_LOG.length} events in the last hour</span>
        </div>

        <div className="an-livelog-scroll" tabIndex={0} role="region" aria-label="Event log, newest first">
          {LIVE_LOG.map((e, i) => (
            <div key={i} className="an-livelog-row">
              <span className={`an-livelog-kind ${e.kind}`}>{e.label}</span>
              <span className="an-livelog-flag">{e.flag}</span>
              <span className="an-livelog-main">
                <span className="an-livelog-text">
                  {e.lead}
                  <b>{e.strong}</b>
                  {e.tail}
                </span>
                <span className="an-livelog-meta">{e.meta}</span>
              </span>
              <span className="an-livelog-time">{e.ago}</span>
            </div>
          ))}
        </div>

        <div className="an-livelog-foot">{LIVELOG_FOOT}</div>
      </div>
    </section>
  );
}
