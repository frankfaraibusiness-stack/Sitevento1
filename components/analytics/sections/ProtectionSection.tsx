// 6 · Protection — bot shield summary.
import { SectionTitle } from './primitives';
import { PROTECTION } from './analyticsPlaceholderData';

export function ProtectionSection() {
  return (
    <section className="an-section" id="protection" aria-labelledby="protection-title">
      <SectionTitle id="protection-title" title={PROTECTION.title} note={PROTECTION.subtitle} />
      <div className="an-protect">
        <div className="an-protect-score">
          <b>{PROTECTION.clean.value}</b>
          <small>{PROTECTION.clean.label}</small>
        </div>
        <dl className="an-protect-stats">
          {PROTECTION.stats.map((s) => (
            <div key={s.label} className="an-protect-stat">
              <dt>{s.label}</dt>
              <dd>{s.value}</dd>
            </div>
          ))}
        </dl>
        <div className="an-protect-score is-dirty">
          <b>{PROTECTION.bots.value}</b>
          <small>{PROTECTION.bots.label}</small>
        </div>
      </div>
      <p className="an-foot-note">{PROTECTION.note}</p>
    </section>
  );
}
