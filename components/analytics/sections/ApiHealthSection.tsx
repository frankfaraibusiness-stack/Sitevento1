'use client';

// 15 · API health — the events your backend sends us, and what happened to them.
import { Fragment } from 'react';
import Link from 'next/link';
import { SectionTitle } from './primitives';
import { ArrowRight } from './icons';
import { API_SUBTITLE, API_TITLE } from './analyticsTypes';
import { useAnalyticsData } from '../AnalyticsDataContext';

export function ApiHealthSection() {
  const { model } = useAnalyticsData();
  const a = model.apiHealth;
  const endpoint = `POST ${typeof window !== 'undefined' ? window.location.origin : ''}/api/ingest`;
  return (
    <section className="an-section" id="api-health" aria-labelledby="api-title">
      <SectionTitle id="api-title" title={API_TITLE} note={API_SUBTITLE} />

      <div className="an-api-head">
        <span className={a.status.tone === 'ok' ? 'an-api-pill' : 'an-api-pill is-warn'}>
          <span className="an-live-dot" aria-hidden="true" />
          {a.status.text}
        </span>
        <code className="an-api-endpoint">{endpoint}</code>
      </div>

      {a.hasData ? (
        <>
          <div className="an-api-funnel">
            {a.funnel.map((s, i) => (
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
            {a.tiles.map((t) => (
              <div key={t.label} className={t.tone ? `an-api-tile is-${t.tone}` : 'an-api-tile'}>
                <dt>{t.label}</dt>
                <dd>{t.value}</dd>
                <small>{t.note}</small>
              </div>
            ))}
          </dl>

          {a.note && (
            <p className="an-foot-note">
              Throughput: <b>{a.note.throughput}</b> on average, peaking at <b>{a.note.peak}</b>
              {a.note.test > 0 ? <> · {a.note.test.toLocaleString()} test-key events are kept out of your analytics</> : null}.
            </p>
          )}
        </>
      ) : (
        <div className="an-empty an-connect">
          <b>No API requests in this period</b>
          Once your server sends its first event you’ll see how many were accepted or refused, and why.{' '}
          <Link href="/dashboard/api" className="an-connect-link">
            Set up the API →
          </Link>
        </div>
      )}
    </section>
  );
}
