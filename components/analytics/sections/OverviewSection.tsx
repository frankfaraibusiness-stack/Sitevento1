'use client';

// 1 · Performance overview — metric switcher, headline number, trend chart.
import { useState } from 'react';
import type { CSSProperties } from 'react';
import { Delta, Tabs } from './primitives';
import { RefreshIcon } from './icons';
import { CHART, METRICS, METRIC_HEADLINES, OVERVIEW_SUBTITLE, OVERVIEW_TITLE, type MetricId } from './analyticsPlaceholderData';

const pos = (left: number, top?: number) => ({ left: `${left}%`, ...(top !== undefined ? { top: `${top}%` } : {}) }) as CSSProperties;

export function OverviewSection() {
  const [metric, setMetric] = useState<MetricId>('revenue');
  const head = METRIC_HEADLINES[metric];

  return (
    <section className="an-overview" id="overview" aria-labelledby="overview-title">
      <div className="an-panel-head">
        <div>
          <h2 id="overview-title">{OVERVIEW_TITLE}</h2>
          <p>{OVERVIEW_SUBTITLE}</p>
        </div>
        <div className="an-panel-actions">
          <button type="button" className="an-pill-btn">
            <RefreshIcon />
            Refresh
          </button>
        </div>
      </div>

      <Tabs variant="metric" label="Chart metric" items={METRICS.map((m) => ({ id: m.id, label: m.label, color: m.color }))} active={metric} onChange={(id) => setMetric(id as MetricId)} />

      <span className="an-chart-sub">{head.range}</span>
      <div className="an-chart-headline">
        <span className="an-big-num">{head.value}</span>
        <Delta dir={head.dir}>{head.delta}</Delta>
      </div>

      <div className="an-chart-canvas">
        <div className="an-chart-plot">
          <svg viewBox={CHART.viewBox} preserveAspectRatio="none" role="img" aria-label={`${head.range} trend`}>
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
              {CHART.gridY.map((y) => (
                <line key={y} x1="0" y1={y} x2="1000" y2={y} />
              ))}
            </g>
            <path d={`${CHART.line} L1000,280 L0,280 Z`} fill="url(#anAreaFill)" stroke="none" />
            <path className="an-chart-line" d={CHART.line} fill="none" stroke="url(#anLineStroke)" strokeWidth="3" strokeLinecap="round" />
          </svg>
          {/* HTML dot: stays a circle even though the SVG stretches (preserveAspectRatio="none"). */}
          <span className="an-chart-dot" style={pos(CHART.highlight.x / 10, (CHART.highlight.y / 280) * 100)} aria-hidden="true" />
        </div>
        {/* HTML axis labels for the same reason: SVG text would be stretched. */}
        <div className="an-chart-axis" aria-hidden="true">
          {CHART.axis.map((a) => (
            <span key={a.label} data-anchor={a.anchor} style={pos(a.x / 10)}>
              {a.label}
            </span>
          ))}
        </div>
      </div>

      <div className="an-chart-legend">
        {CHART.legend.map((l) => (
          <span key={l.label} className="an-legend-item">
            <span className="an-swatch" style={{ background: l.color }} />
            {l.label}
          </span>
        ))}
      </div>
    </section>
  );
}
