'use client';

// 1 · Performance overview — metric switcher, headline number, trend chart.
// Every number and the chart come from the real model (see analyticsModel).
import { useMemo, useState } from 'react';
import type { CSSProperties } from 'react';
import { Delta, Tabs } from './primitives';
import { RefreshIcon } from './icons';
import { METRICS, OVERVIEW_SUBTITLE, OVERVIEW_TITLE, type MetricId } from './analyticsTypes';
import { buildChart } from './chart';
import { useAnalyticsData } from '../AnalyticsDataContext';

const pos = (left: number, top?: number) => ({ left: `${left}%`, ...(top !== undefined ? { top: `${top}%` } : {}) }) as CSSProperties;

export function OverviewSection() {
  const { model, refresh, refreshing, loading } = useAnalyticsData();
  const [metric, setMetric] = useState<MetricId>('views');
  const m = model.overview[metric];
  const chart = useMemo(() => buildChart(m.series, m.labels), [m]);
  const bestLabel = chart.hasData ? `${m.longs[chart.bestIndex]} · ${m.fmt(m.series[chart.bestIndex])}` : null;

  return (
    <section className="an-overview" id="overview" aria-labelledby="overview-title">
      <div className="an-panel-head">
        <div>
          <h2 id="overview-title">{OVERVIEW_TITLE}</h2>
          <p>{OVERVIEW_SUBTITLE}</p>
        </div>
        <div className="an-panel-actions">
          <button type="button" className="an-pill-btn" onClick={refresh} disabled={refreshing || loading}>
            <RefreshIcon />
            {refreshing ? 'Refreshing…' : 'Refresh'}
          </button>
        </div>
      </div>

      <Tabs variant="metric" label="Chart metric" items={METRICS.map((x) => ({ id: x.id, label: x.label, color: x.color }))} active={metric} onChange={(id) => setMetric(id as MetricId)} />

      <span className="an-chart-sub">{m.rangeLabel}</span>
      <div className="an-chart-headline">
        <span className="an-big-num">{loading ? '…' : m.value}</span>
        {m.delta && <Delta dir={m.delta.dir}>{m.delta.text}</Delta>}
      </div>
      {metric === 'revenue' && m.value === '—' && (
        <p className="an-foot-note">Revenue comes from your backend. Switch on Orders or Subscriptions on the API page and it appears here.</p>
      )}

      <div className="an-chart-canvas">
        <div className="an-chart-plot">
          <svg viewBox={chart.viewBox} preserveAspectRatio="none" role="img" aria-label={`${m.rangeLabel} trend`}>
            <defs>
              <linearGradient id="anAreaFill" x1="0" y1="0" x2="0" y2="1">
                <stop offset="0%" stopColor="#6a48ff" stopOpacity="0.26" />
                <stop offset="100%" stopColor="#b04cf0" stopOpacity="0" />
              </linearGradient>
              <linearGradient id="anLineStroke" x1="0" y1="0" x2="1" y2="0">
                <stop offset="0%" stopColor="#0f9aa6" />
                <stop offset="45%" stopColor="#5f3dff" />
                <stop offset="100%" stopColor="#b04cf0" />
              </linearGradient>
            </defs>
            <g className="an-chart-grid">
              {chart.gridY.map((y) => (
                <line key={y} x1="0" y1={y} x2="1000" y2={y} />
              ))}
            </g>
            <path d={chart.area} fill="url(#anAreaFill)" stroke="none" />
            <path className="an-chart-line" d={chart.line} fill="none" stroke="url(#anLineStroke)" strokeWidth="3" strokeLinecap="round" />
          </svg>
          {chart.highlight && <span className="an-chart-dot" style={pos(chart.highlight.x / 10, (chart.highlight.y / 280) * 100)} aria-hidden="true" />}
        </div>
        <div className="an-chart-axis" aria-hidden="true">
          {chart.axis.map((a, i) => (
            <span key={`${a.label}-${i}`} data-anchor={a.anchor} style={pos(a.x / 10)}>
              {a.label}
            </span>
          ))}
        </div>
      </div>

      <div className="an-chart-legend">
        <span className="an-legend-item">
          <span className="an-swatch" style={{ background: '#6a48ff' }} />
          Selected period
        </span>
        {bestLabel && (
          <span className="an-legend-item">
            <span className="an-swatch" style={{ background: '#14995f' }} />
            Best: {bestLabel}
          </span>
        )}
        {!chart.hasData && !loading && <span className="an-legend-item">No activity in this period yet</span>}
      </div>
    </section>
  );
}
