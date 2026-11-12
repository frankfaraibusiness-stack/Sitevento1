'use client';

// 8 · Goals & conversions — confirmed by the site's server (API) plus lead captures.
import { Fragment } from 'react';
import { ConnectApi, SectionTitle } from './primitives';
import { GoalGlyph } from './icons';
import { GOALS_SUBTITLE, GOALS_TITLE } from './analyticsTypes';
import { useAnalyticsData } from '../AnalyticsDataContext';

export function GoalsSection() {
  const { model, extrasLoading } = useAnalyticsData();
  const g = model.goals;
  return (
    <section className="an-section" id="goals" aria-labelledby="goals-title">
      <SectionTitle id="goals-title" title={GOALS_TITLE} note={GOALS_SUBTITLE} />
      {g ? (
        <>
          <div className="an-goals-summary">
            {g.summary.map((s, i) => (
              <Fragment key={s.label}>
                {i > 0 && <div className="an-goals-summary-sep" aria-hidden="true" />}
                <div>
                  <span className="an-big-num">{s.value}</span>
                  <div className="an-goals-summary-label">{s.label}</div>
                </div>
              </Fragment>
            ))}
          </div>

          <div className="an-rows">
            {g.rows.map((row) => (
              <div key={row.name} className="an-goal-row">
                <div className="an-goal-icon">
                  <GoalGlyph name={row.icon} />
                </div>
                <div className="an-goal-main">
                  <div className="an-goal-top">
                    <b>{row.name}</b>
                    <span>
                      <strong>{row.count.toLocaleString()}</strong> · {row.share}
                    </span>
                  </div>
                  <div className="an-goal-bar" aria-hidden="true">
                    <i style={{ width: `${row.pct}%` }} />
                  </div>
                </div>
                <div className="an-goal-value">{row.rate}</div>
              </div>
            ))}
          </div>
        </>
      ) : extrasLoading ? (
        <div className="an-empty"><b>Loading goals…</b></div>
      ) : (
        <ConnectApi title="No goals completed yet" enable="Sign-ups, Orders or Goals">
          Orders, sign-ups, trials and any goal you name show up here once your backend sends them — and lead captures appear as soon as someone leaves their email.
        </ConnectApi>
      )}
    </section>
  );
}
