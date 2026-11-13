'use client';

// 16 · Real-time sitewide log — last hour of page views, events and backend activity.
import { SectionTitle } from './primitives';
import { LIVELOG_SUBTITLE, LIVELOG_TITLE } from './analyticsTypes';
import { useAnalyticsData } from '../AnalyticsDataContext';

export function LiveLogSection() {
  const { model } = useAnalyticsData();
  const log = model.liveLog;
  return (
    <section className="an-section" id="live-log" aria-labelledby="live-log-title">
      <SectionTitle id="live-log-title" title={LIVELOG_TITLE} note={LIVELOG_SUBTITLE} />

      <div className="an-livelog-card">
        <div className="an-livelog-head">
          <div className="an-livelog-head-left">
            <span className="an-live-dot" aria-hidden="true" />
            <span>Live</span>
          </div>
          <span className="an-livelog-count">
            {log.length} event{log.length === 1 ? '' : 's'} in the last hour
          </span>
        </div>

        <div className="an-livelog-scroll" tabIndex={0} role="region" aria-label="Event log, newest first">
          {log.length ? (
            log.map((e, i) => (
              <div key={`${e.ts}-${i}`} className="an-livelog-row">
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
            ))
          ) : (
            <div className="an-empty">Nothing in the last hour. New visits, events and backend activity appear here as they happen.</div>
          )}
        </div>

        <div className="an-livelog-foot">Page views and on-page events come from the tracking script; sales, sign-ups and server errors from your backend’s API.</div>
      </div>
    </section>
  );
}
