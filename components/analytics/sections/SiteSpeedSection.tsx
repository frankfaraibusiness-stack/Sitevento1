'use client';

// 13 · Site speed — Core Web Vitals (75th percentile of real visits).
import { SectionTitle } from './primitives';
import { SPEED_SUBTITLE, SPEED_TITLE } from './analyticsTypes';
import { useAnalyticsData } from '../AnalyticsDataContext';

export function SiteSpeedSection() {
  const { model } = useAnalyticsData();
  return (
    <section className="an-section" id="speed" aria-labelledby="speed-title">
      <SectionTitle id="speed-title" title={SPEED_TITLE} note={SPEED_SUBTITLE} />
      <dl className="an-vitals">
        {model.speed.map((v) => (
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
      <p className="an-foot-note">
        {model.speedSamples > 0
          ? `75th percentile across ${model.speedSamples.toLocaleString()} visits — the way Google scores them.`
          : 'Measured by the tracking script in real browsers. Numbers appear after the next few visits.'}
      </p>
    </section>
  );
}
