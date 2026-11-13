'use client';

// 12 · Retention — share of each week's newcomers who come back.
import { Empty, SectionTitle } from './primitives';
import { RETENTION_SUBTITLE, RETENTION_TITLE } from './analyticsTypes';
import { useAnalyticsData } from '../AnalyticsDataContext';

export function RetentionSection() {
  const { model } = useAnalyticsData();
  const r = model.retention;
  return (
    <section className="an-section" id="retention" aria-labelledby="retention-title">
      <SectionTitle id="retention-title" title={RETENTION_TITLE} note={RETENTION_SUBTITLE} />
      {r ? (
        <>
          <div className="an-cohort" role="img" aria-label={r.weeks.map((w) => `${w.label}: ${w.pct}%`).join(', ')}>
            {r.weeks.map((w) => (
              <i key={w.label} style={{ height: `${Math.max(3, w.pct)}%` }} title={`${w.label}: ${w.pct}%`} />
            ))}
          </div>
          <div className="an-cohort-labels" aria-hidden="true">
            {r.weeks.map((w) => (
              <span key={w.label}>{w.label}</span>
            ))}
          </div>
          <p className="an-foot-note">
            {r.basis === 'accounts' ? (
              <>Based on <b>{r.cohortSize.toLocaleString()}</b> sign-ups and the logins your backend sent. </>
            ) : (
              <>Based on <b>{r.cohortSize.toLocaleString()}</b> visitors first seen in this period. </>
            )}
            Week 1: <b>{r.weeks[1].pct}%</b> came back
            {r.weeks[2] ? <>, week 2: <b>{r.weeks[2].pct}%</b></> : null}.
          </p>
        </>
      ) : (
        <Empty title="Not enough history yet">Retention needs at least two weeks and 10 visitors in the selected period. Try “Last 90 days” — or send sign-ups and logins from your backend for account-level retention.</Empty>
      )}
    </section>
  );
}
