// 13 · Site speed — Core Web Vitals.
import { SectionTitle } from './primitives';
import { SPEED_SUBTITLE, SPEED_TITLE, VITALS } from './analyticsPlaceholderData';

export function SiteSpeedSection() {
  return (
    <section className="an-section" id="speed" aria-labelledby="speed-title">
      <SectionTitle id="speed-title" title={SPEED_TITLE} note={SPEED_SUBTITLE} />
      <dl className="an-vitals">
        {VITALS.map((v) => (
          <div key={v.name} className="an-vital">
            <div className="an-vital-top">
              <span>{v.name}</span>
              <span className={`an-vital-chip ${v.tone}`}>{v.status}</span>
            </div>
            <dd>{v.value}</dd>
            <small>{v.desc}</small>
          </div>
        ))}
      </dl>
    </section>
  );
}
