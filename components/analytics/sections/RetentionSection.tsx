// 12 · Retention cohorts.
import { SectionTitle } from './primitives';
import { RETENTION_NOTE, RETENTION_SUBTITLE, RETENTION_TITLE, RETENTION_WEEKS } from './analyticsPlaceholderData';

export function RetentionSection() {
  return (
    <section className="an-section" id="retention" aria-labelledby="retention-title">
      <SectionTitle id="retention-title" title={RETENTION_TITLE} note={RETENTION_SUBTITLE} />
      <div className="an-cohort" role="img" aria-label={RETENTION_WEEKS.map((w) => `${w.label}: ${w.pct}%`).join(', ')}>
        {RETENTION_WEEKS.map((w) => (
          <i key={w.label} style={{ height: `${w.pct}%` }} title={`${w.label}: ${w.pct}%`} />
        ))}
      </div>
      <div className="an-cohort-labels" aria-hidden="true">
        {RETENTION_WEEKS.map((w) => (
          <span key={w.label}>{w.label}</span>
        ))}
      </div>
      <p className="an-foot-note">{RETENTION_NOTE}</p>
    </section>
  );
}
