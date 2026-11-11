// 10 · Audience — new vs returning, visit frequency.
import { Bar, SectionTitle } from './primitives';
import { AUDIENCE_SPLIT, AUDIENCE_SUBTITLE, AUDIENCE_TITLE, VISIT_FREQUENCY } from './analyticsPlaceholderData';

export function AudienceSection() {
  return (
    <section className="an-section" id="audience" aria-labelledby="audience-title">
      <SectionTitle id="audience-title" title={AUDIENCE_TITLE} note={AUDIENCE_SUBTITLE} />
      <div className="an-audience">
        <div>
          <div className="an-split-bar" role="img" aria-label={AUDIENCE_SPLIT.map((s) => `${s.label} ${s.pct}%`).join(', ')}>
            {AUDIENCE_SPLIT.map((s) => (
              <span key={s.label} className={`is-${s.tone}`} style={{ width: `${s.pct}%` }} />
            ))}
          </div>
          <div className="an-split-legend">
            {AUDIENCE_SPLIT.map((s) => (
              <span key={s.label} className="an-legend-item">
                <span className={`an-swatch is-${s.tone}`} />
                {s.label}
                <b>{s.pct}%</b>
              </span>
            ))}
          </div>
        </div>
        <div className="an-freq-rows">
          {VISIT_FREQUENCY.map((f) => (
            <div key={f.label} className="an-freq-row">
              <span>{f.label}</span>
              <Bar pct={f.pct} />
              <b>{f.value}</b>
            </div>
          ))}
        </div>
      </div>
    </section>
  );
}
