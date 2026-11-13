// 14 · Site health & system diagnostics — status strip, uptime, issues + fixes,
// traffic heatmap, session length, appearance, browsers / OS / screens,
// connection, and the recent error log.
import { Fragment } from 'react';
import { Bar, Empty, MiniStats, SectionTitle, SubLabel } from './primitives';
import { CheckIcon, DiagGlyph } from './icons';
import { HEALTH_SUBTITLE, HEALTH_TITLE, type TechRow } from './analyticsTypes';
import { useAnalyticsData } from '../AnalyticsDataContext';
import { DOW_LABELS, hourLabel } from '@/lib/dashboardStats';

const HEATMAP_HOURS = Array.from({ length: 24 }, (_, h) => (h % 3 === 0 ? hourLabel(h).replace(' ', '').toLowerCase() : ''));

function TechList({ rows }: { rows: TechRow[] }) {
  if (!rows.length) return <Empty>Appears once visits come in.</Empty>;
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
  const { model } = useAnalyticsData();
  const h = model.health;

  return (
    <section className="an-section" id="health" aria-labelledby="health-title">
      <SectionTitle id="health-title" title={HEALTH_TITLE} note={HEALTH_SUBTITLE} />

      {/* status strip */}
      <dl className="an-status-strip">
        {h.status.map((s) => (
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
      <div className="an-uptime-bar" role="img" aria-label={`90-day uptime. ${h.uptime.summary}`}>
        {h.uptime.classes.map((cls, i) => (
          <i key={i} className={cls} />
        ))}
      </div>
      <div className="an-uptime-foot">
        <span>{h.uptime.from}</span>
        <span>{h.uptime.summary}</span>
        <span>{h.uptime.to}</span>
      </div>

      {/* diagnosis */}
      <SubLabel>What needs attention</SubLabel>
      {h.diagnostics.length ? (
        h.diagnostics.map((d) => (
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
        ))
      ) : (
        <Empty title="Nothing needs attention">No slow pages, errors or downtime found in this period.</Empty>
      )}

      {/* heatmap: hour × weekday */}
      <SubLabel>When people actually visit</SubLabel>
      {h.heat.hasData ? (
        <>
          <div className="an-heatmap" role="img" aria-label={`Traffic by weekday and hour. Peak: ${h.heat.peak}`}>
            <span />
            {HEATMAP_HOURS.map((label, i) => (
              <span key={i} className="an-heatmap-hdr">
                {label}
              </span>
            ))}
            {DOW_LABELS.map((day, d) => (
              <Fragment key={day}>
                <span className="an-heatmap-row-label">{day}</span>
                {h.heat.cells[d].map((v, hr) => (
                  <span key={hr} className="an-heatmap-cell" style={{ opacity: Math.max(0.06, v / 100) }} title={`${day} ${hourLabel(hr)}`} />
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
            Peak traffic: <b>{h.heat.peak}</b> · Quietest: {h.heat.quiet}
          </p>
        </>
      ) : (
        <Empty>The heatmap fills in as visits arrive.</Empty>
      )}

      {/* session length + appearance */}
      <div className="an-row-2 an-mt-lg">
        <div>
          <SubLabel>Session length</SubLabel>
          {h.session.hasData ? (
            <>
              <div className="an-histogram" role="img" aria-label={h.session.buckets.map((b) => b.label).join(', ')}>
                {h.session.buckets.map((b) => (
                  <i key={b.label} style={{ height: `${Math.max(3, b.pct)}%` }} title={b.label} />
                ))}
              </div>
              <div className="an-histogram-labels" aria-hidden="true">
                {h.session.buckets.map((b) => (
                  <span key={b.label}>{b.label}</span>
                ))}
              </div>
              <p className="an-foot-note">
                Median session: <b>{h.session.median}</b> · Avg. pages/session: <b>{h.session.pages}</b>
              </p>
            </>
          ) : (
            <Empty />
          )}
        </div>

        <div>
          <SubLabel>Appearance preference</SubLabel>
          <div className="an-theme-split">
            <dl className="an-theme-card is-dark">
              <dt>Dark mode</dt>
              <dd>{h.appearance.dark}</dd>
            </dl>
            <dl className="an-theme-card is-light">
              <dt>Light mode</dt>
              <dd>{h.appearance.light}</dd>
            </dl>
          </div>
          <p className="an-foot-note">{h.appearance.note}</p>
        </div>
      </div>

      {/* browsers + OS */}
      <div className="an-row-2 an-mt-lg">
        <div>
          <SubLabel>Browsers</SubLabel>
          <TechList rows={h.browsers} />
        </div>
        <div>
          <SubLabel>Operating systems</SubLabel>
          <TechList rows={h.systems} />
        </div>
      </div>

      {/* screens + connection */}
      <div className="an-row-2 an-mt-lg">
        <div>
          <SubLabel>Screen resolutions</SubLabel>
          <TechList rows={h.screens} />
        </div>
        <div>
          <SubLabel>Connection &amp; device type</SubLabel>
          <MiniStats items={h.connection} cols2 />
        </div>
      </div>

      {/* error log */}
      <SubLabel>Recent server &amp; client errors</SubLabel>
      {h.errors.length ? (
        <div className="an-log">
          {h.errors.map((e) => (
            <div key={`${e.code}-${e.path}`} className="an-errlog-row">
              <span className={`an-errlog-code ${e.klass === '5xx' ? 'c5' : e.klass === 'js' ? 'cjs' : 'c4'}`}>{e.code}</span>
              <div className="an-errlog-main">
                <span className="an-errlog-path">{e.path}</span>
                <span className="an-errlog-meta">{e.meta}</span>
              </div>
              <span className="an-errlog-count">{e.count}</span>
            </div>
          ))}
        </div>
      ) : (
        <Empty title="No errors recorded">Browser errors are caught automatically; server errors appear when your backend sends them through the API.</Empty>
      )}
      {h.jsNote && (
        <p className="an-foot-note">
          JS runtime errors: <b>{h.jsNote.count.toLocaleString()}</b> in this period, mostly <code>{h.jsNote.message}</code> on <code>{h.jsNote.where}</code> in {h.jsNote.browser}.
        </p>
      )}
    </section>
  );
}
