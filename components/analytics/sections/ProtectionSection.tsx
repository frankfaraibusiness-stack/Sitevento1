'use client';

// 6 · Protection — bot shield summary.
import { SectionTitle } from './primitives';
import { useAnalyticsData } from '../AnalyticsDataContext';

export function ProtectionSection() {
  const { model } = useAnalyticsData();
  const p = model.protection;
  return (
    <section className="an-section" id="protection" aria-labelledby="protection-title">
      <SectionTitle id="protection-title" title="Protection" note="Everything your site turned away" />
      <div className="an-protect">
        <div className="an-protect-score">
          <b>{p.cleanPct}</b>
          <small>Clean</small>
        </div>
        <dl className="an-protect-stats">
          {p.stats.map((s) => (
            <div key={s.label} className="an-protect-stat">
              <dt>{s.label}</dt>
              <dd>{s.value}</dd>
            </div>
          ))}
        </dl>
        <div className="an-protect-score is-dirty">
          <b>{p.botsPct}</b>
          <small>Bots</small>
        </div>
      </div>
      <p className="an-foot-note">{p.note}</p>
    </section>
  );
}
