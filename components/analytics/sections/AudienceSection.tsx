'use client';

// 10 · Audience — new vs returning, visit frequency.
import { Bar, Empty, SectionTitle } from './primitives';
import { AUDIENCE_SUBTITLE, AUDIENCE_TITLE } from './analyticsTypes';
import { useAnalyticsData } from '../AnalyticsDataContext';

export function AudienceSection() {
  const { model, loading } = useAnalyticsData();
  const a = model.audience;
  return (
    <section className="an-section" id="audience" aria-labelledby="audience-title">
      <SectionTitle id="audience-title" title={AUDIENCE_TITLE} note={AUDIENCE_SUBTITLE} />
      {a ? (
        <div className="an-audience">
          <div>
            <div className="an-split-bar" role="img" aria-label={a.split.map((s) => `${s.label} ${s.pct}%`).join(', ')}>
              {a.split.map((s) => (
                <span key={s.label} className={`is-${s.tone}`} style={{ width: `${s.pct}%` }} />
              ))}
            </div>
            <div className="an-split-legend">
              {a.split.map((s) => (
                <span key={s.label} className="an-legend-item">
                  <span className={`an-swatch is-${s.tone}`} />
                  {s.label}
                  <b>{s.pct}%</b>
                </span>
              ))}
            </div>
          </div>
          <div className="an-freq-rows">
            {a.frequency.map((f) => (
              <div key={f.label} className="an-freq-row">
                <span>{f.label}</span>
                <Bar pct={f.pct} />
                <b>{f.value}</b>
              </div>
            ))}
          </div>
        </div>
      ) : (
        <Empty title={loading ? 'Loading audience…' : 'No audience data yet'}>New vs returning visitors appear once people have visited in this period.</Empty>
      )}
    </section>
  );
}
