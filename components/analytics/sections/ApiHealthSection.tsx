// 15 · API health — the ingestion pipeline behind every number.
import { Fragment } from 'react';
import { SectionTitle } from './primitives';
import { ArrowRight } from './icons';
import { API_ENDPOINT, API_FUNNEL, API_NOTE, API_STATUS, API_SUBTITLE, API_TILES, API_TITLE } from './analyticsPlaceholderData';

export function ApiHealthSection() {
  return (
    <section className="an-section" id="api-health" aria-labelledby="api-title">
      <SectionTitle id="api-title" title={API_TITLE} note={API_SUBTITLE} />

      <div className="an-api-head">
        <span className="an-api-pill">
          <span className="an-live-dot" aria-hidden="true" />
          {API_STATUS}
        </span>
        <code className="an-api-endpoint">{API_ENDPOINT}</code>
      </div>

      <div className="an-api-funnel">
        {API_FUNNEL.map((s, i) => (
          <Fragment key={s.label}>
            {i > 0 && (
              <div className="an-api-funnel-arrow">
                <ArrowRight />
              </div>
            )}
            <div className={s.tone ? `an-api-funnel-step is-${s.tone}` : 'an-api-funnel-step'}>
              <dt>{s.label}</dt>
              <dd>{s.value}</dd>
              <small>{s.note}</small>
            </div>
          </Fragment>
        ))}
      </div>

      <dl className="an-api-grid">
        {API_TILES.map((t) => (
          <div key={t.label} className={t.tone ? `an-api-tile is-${t.tone}` : 'an-api-tile'}>
            <dt>{t.label}</dt>
            <dd>{t.value}</dd>
            <small>{t.note}</small>
          </div>
        ))}
      </dl>

      <p className="an-foot-note">
        Throughput: <b>{API_NOTE.throughput}</b> average, peaking at <b>{API_NOTE.peak}</b> during the 2–4pm traffic window · Queue depth is currently <b>{API_NOTE.queue}</b>, nothing backing up.
      </p>
    </section>
  );
}
