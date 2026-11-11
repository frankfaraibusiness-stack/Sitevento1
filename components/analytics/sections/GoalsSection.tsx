// 8 · Goals & conversions.
import { Fragment } from 'react';
import { SectionTitle } from './primitives';
import { GoalGlyph } from './icons';
import { GOALS, GOALS_SUBTITLE, GOALS_SUMMARY, GOALS_TITLE } from './analyticsPlaceholderData';

export function GoalsSection() {
  return (
    <section className="an-section" id="goals" aria-labelledby="goals-title">
      <SectionTitle id="goals-title" title={GOALS_TITLE} note={GOALS_SUBTITLE} />

      <div className="an-goals-summary">
        {GOALS_SUMMARY.map((s, i) => (
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
        {GOALS.map((g) => (
          <div key={g.name} className="an-goal-row">
            <div className="an-goal-icon">
              <GoalGlyph name={g.icon} />
            </div>
            <div className="an-goal-main">
              <div className="an-goal-top">
                <b>{g.name}</b>
                <span>
                  <strong>{g.count}</strong> · {g.share}
                </span>
              </div>
              <div className="an-goal-bar" aria-hidden="true">
                <i style={{ width: `${g.pct}%` }} />
              </div>
            </div>
            <div className="an-goal-value">{g.rate}</div>
          </div>
        ))}
      </div>
    </section>
  );
}
