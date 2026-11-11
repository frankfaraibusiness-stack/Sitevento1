// 14 · Site health & system diagnostics — status strip, uptime, issues + fixes,
// traffic heatmap, session length, appearance, browsers / OS / screens,
// connection, and the recent error log.
import { Fragment } from 'react';
import { Bar, MiniStats, SectionTitle, SubLabel } from './primitives';
import { CheckIcon, DiagGlyph } from './icons';
import {
  APPEARANCE,
  BROWSERS,
  CONNECTION_STATS,
  DIAGNOSTICS,
  ERROR_LOG,
  HEALTH_STATUS,
  HEALTH_SUBTITLE,
  HEALTH_TITLE,
  HEATMAP,
  HEATMAP_DAYS,
  HEATMAP_HOURS,
  HEATMAP_NOTE,
  JS_ERRORS,
  OPERATING_SYSTEMS,
  SCREENS,
  SESSION_LENGTH,
  UPTIME,
  type TechRow,
} from './analyticsPlaceholderData';

function TechList({ rows }: { rows: TechRow[] }) {
  return (
    <div className="an-log">
      {rows.map((r) => (
        <div key={r.label} className="an-tech-row">
          <span className="an-tech-icon" aria-hidden="true">
            {r.icon}
          </span>
          <div className="an-tech-main">
            <div className="an-tech-top">
              <b>
                {r.label}
                {r.hint && <small className="an-tech-hint"> {r.hint}</small>}
              </b>
              <span>{r.value}</span>
            </div>
            <Bar pct={r.pct} />
          </div>
        </div>
      ))}
    </div>
  );
}

export function SiteHealthSection() {
  const uptimeDays = Array.from({ length: UPTIME.days }, (_, i) => (UPTIME.down.includes(i) ? 'is-down' : UPTIME.degraded.includes(i) ? 'is-degraded' : undefined));

  return (
    <section className="an-section" id="health" aria-labelledby="health-title">
      <SectionTitle id="health-title" title={HEALTH_TITLE} note={HEALTH_SUBTITLE} />

      {/* status strip */}
      <dl className="an-status-strip">
        {HEALTH_STATUS.map((s) => (
          <div key={s.label} className={`an-status-tile ${s.tone}`}>
            <dt>
              <span className="an-status-dot" aria-hidden="true" />
              {s.label}
            </dt>
            <dd>{s.value}</dd>
          </div>
        ))}
      </dl>

      {/* uptime */}
      <SubLabel>Uptime, last 90 days</SubLabel>
      <div className="an-uptime-bar" role="img" aria-label={`${UPTIME.days}-day uptime. ${UPTIME.summary}`}>
        {uptimeDays.map((cls, i) => (
          <i key={i} className={cls} />
        ))}
      </div>
      <div className="an-uptime-foot">
        <span>{UPTIME.from}</span>
        <span>{UPTIME.summary}</span>
        <span>{UPTIME.to}</span>
      </div>

      {/* diagnosis */}
      <SubLabel>What needs attention</SubLabel>
      {DIAGNOSTICS.map((d) => (
        <div key={d.title} className={`an-diag-card sev-${d.severity}`}>
          <div className="an-diag-icon">
            <DiagGlyph name={d.icon} />
          </div>
          <div className="an-diag-main">
            <div className="an-diag-top">
              <b>{d.title}</b>
              <span className="an-diag-metric">{d.metric}</span>
            </div>
            <p className="an-diag-desc">{d.desc}</p>
            <div className="an-diag-fix">
              <CheckIcon />
              <span>
                <b>Try this:</b> {d.fix}
              </span>
            </div>
          </div>
        </div>
      ))}

      {/* heatmap: hour × weekday */}
      <SubLabel>When people actually visit</SubLabel>
      <div className="an-heatmap" role="img" aria-label={`Traffic by weekday and hour. Peak: ${HEATMAP_NOTE.peak}`}>
        <span />
        {HEATMAP_HOURS.map((h, i) => (
          <span key={i} className="an-heatmap-hdr">
            {h}
          </span>
        ))}
        {HEATMAP_DAYS.map((day, d) => (
          <Fragment key={day}>
            <span className="an-heatmap-row-label">{day}</span>
            {HEATMAP[d].map((v, h) => (
              <span key={h} className="an-heatmap-cell" style={{ opacity: v / 100 }} title={`${day} ${h}:00`} />
            ))}
          </Fragment>
        ))}
      </div>
      <div className="an-heatmap-legend">
        <span>Less</span>
        {[0.12, 0.35, 0.6, 0.85, 1].map((o) => (
          <span key={o} className="an-heatmap-cell" style={{ opacity: o }} />
        ))}
        <span>More</span>
      </div>
      <p className="an-foot-note">
        Peak traffic: <b>{HEATMAP_NOTE.peak}</b> · Quietest: {HEATMAP_NOTE.quiet}
      </p>

      {/* session length + appearance */}
      <div className="an-row-2 an-mt-lg">
        <div>
          <SubLabel>Session length</SubLabel>
          <div className="an-histogram" role="img" aria-label={SESSION_LENGTH.buckets.map((b) => b.label).join(', ')}>
            {SESSION_LENGTH.buckets.map((b) => (
              <i key={b.label} style={{ height: `${b.pct}%` }} title={b.label} />
            ))}
          </div>
          <div className="an-histogram-labels" aria-hidden="true">
            {SESSION_LENGTH.buckets.map((b) => (
              <span key={b.label}>{b.label}</span>
            ))}
          </div>
          <p className="an-foot-note">
            Median session: <b>{SESSION_LENGTH.median}</b> · Avg. pages/session: <b>{SESSION_LENGTH.pagesPerSession}</b>
          </p>
        </div>

        <div>
          <SubLabel>Appearance preference</SubLabel>
          <div className="an-theme-split">
            <dl className="an-theme-card is-dark">
              <dt>Dark mode</dt>
              <dd>{APPEARANCE.dark}</dd>
            </dl>
            <dl className="an-theme-card is-light">
              <dt>Light mode</dt>
              <dd>{APPEARANCE.light}</dd>
            </dl>
          </div>
          <p className="an-foot-note">{APPEARANCE.note}</p>
        </div>
      </div>

      {/* browsers + OS */}
      <div className="an-row-2 an-mt-lg">
        <div>
          <SubLabel>Browsers</SubLabel>
          <TechList rows={BROWSERS} />
        </div>
        <div>
          <SubLabel>Operating systems</SubLabel>
          <TechList rows={OPERATING_SYSTEMS} />
        </div>
      </div>

      {/* screens + connection */}
      <div className="an-row-2 an-mt-lg">
        <div>
          <SubLabel>Screen resolutions</SubLabel>
          <TechList rows={SCREENS} />
        </div>
        <div>
          <SubLabel>Connection &amp; device type</SubLabel>
          <MiniStats items={CONNECTION_STATS} cols2 />
        </div>
      </div>

      {/* error log */}
      <SubLabel>Recent server &amp; client errors</SubLabel>
      <div className="an-log">
        {ERROR_LOG.map((e) => (
          <div key={e.path + e.code} className="an-errlog-row">
            <span className={`an-errlog-code ${e.klass === '5xx' ? 'c5' : 'c4'}`}>{e.code}</span>
            <div className="an-errlog-main">
              <span className="an-errlog-path">{e.path}</span>
              <span className="an-errlog-meta">{e.meta}</span>
            </div>
            <span className="an-errlog-count">{e.count}</span>
          </div>
        ))}
      </div>
      <p className="an-foot-note">
        JS runtime errors: <b>{JS_ERRORS.count}</b> in {JS_ERRORS.window}, mostly <code>{JS_ERRORS.message}</code> on <code>{JS_ERRORS.where}</code> in {JS_ERRORS.browser}.
      </p>
    </section>
  );
}
