'use client';

// components/advertise/AdvertiseStatsPanel.tsx
//
// "Ad statistics" tab panel — new component, no old-real precedent.
// Markup ported from the advertise-preview mockup's stats panel,
// chart math ported from that mockup's timeseries/spend SVG chart
// functions — the math is unchanged, only the imperative innerHTML
// DOM writes became JSX.
//
// Real data: driven by useAdvertiser()'s `stats`/`statsLoading`/
// `statsError`/`fetchStats(adId, days)`. Per-ad totals in the "Your
// ads" breakdown list are each ad's own lifetime `stats.impressions/
// clicks` + `budget.spentUsd` (already on the AdDoc from list-ads —
// no extra round trip needed to show those), NOT a second get-stats
// call per ad.
import { useEffect, useState } from 'react';
import type { AdDoc, AdStatus } from '@/lib/adPool';
import type { AdvertiserStats } from '@/hooks/useAdvertiser';

const STATUS_COLOR: Record<AdStatus, string> = {
  live: 'var(--dash-green)',
  paused: 'rgba(20,18,28,0.35)',
  draft: 'var(--dash-blue)',
  out_of_budget: 'var(--dash-orange)',
};
const STATUS_LABEL: Record<AdStatus, string> = {
  live: 'Live',
  paused: 'Paused',
  draft: 'Draft',
  out_of_budget: 'Out of budget',
};

interface Props {
  ads: AdDoc[];
  stats: AdvertiserStats;
  statsLoading: boolean;
  statsError: string | null;
  fetchStats: (adId: string, days?: number) => Promise<{ ok: boolean; error?: string }>;
}

function sum(arr: number[]) {
  return arr.reduce((a, b) => a + b, 0);
}

function adName(ad: AdDoc) {
  return ad.creative.headline || ad.creative.destinationUrl || `${ad.creative.type} ad`;
}

function TimeseriesChart({ days, impressions, clicks }: { days: string[]; impressions: number[]; clicks: number[] }) {
  const W = 640,
    H = 220,
    padL = 36,
    padR = 36,
    padT = 14,
    padB = 28;
  const plotW = W - padL - padR,
    plotH = H - padT - padB;
  const n = Math.max(days.length, 1);

  const maxImp = Math.max(...impressions, 1);
  const maxClk = Math.max(...clicks, 1);

  const x = (i: number) => padL + (n > 1 ? i / (n - 1) : 0) * plotW;
  const yImp = (v: number) => padT + plotH - (v / maxImp) * plotH;
  const yClk = (v: number) => padT + plotH - (v / maxClk) * plotH;

  const pathFor = (data: number[], yFn: (v: number) => number) =>
    data.map((v, i) => `${i === 0 ? 'M' : 'L'}${x(i).toFixed(1)},${yFn(v).toFixed(1)}`).join(' ');
  const areaFor = (data: number[], yFn: (v: number) => number) => {
    const line = pathFor(data, yFn);
    return `${line} L${x(data.length - 1).toFixed(1)},${padT + plotH} L${x(0).toFixed(1)},${padT + plotH} Z`;
  };

  const gridLines = [0, 1, 2, 3].map((g) => {
    const gy = padT + (plotH / 3) * g;
    return <line key={g} x1={padL} y1={gy.toFixed(1)} x2={W - padR} y2={gy.toFixed(1)} stroke="rgba(20,18,28,0.08)" strokeWidth={1} />;
  });

  const labelIdx = n > 1 ? [0, Math.floor((n - 1) / 2), n - 1] : [0];
  const dayLabels = labelIdx.map((i) => {
    const daysAgo = n - 1 - i;
    const label = daysAgo === 0 ? 'Today' : `${daysAgo}d ago`;
    return (
      <text key={i} x={x(i).toFixed(1)} y={H - 8} fontSize={10} fill="var(--ink)" fillOpacity={0.5} textAnchor="middle" fontFamily="-apple-system,sans-serif">
        {label}
      </text>
    );
  });

  return (
    <svg viewBox={`0 0 ${W} ${H}`} preserveAspectRatio="none">
      <defs>
        <linearGradient id="gradImp" x1="0" y1="0" x2="0" y2="1">
          <stop offset="0%" stopColor="var(--dash-blue)" stopOpacity={0.25} />
          <stop offset="100%" stopColor="var(--dash-blue)" stopOpacity={0} />
        </linearGradient>
      </defs>
      {gridLines}
      <path d={areaFor(impressions, yImp)} fill="url(#gradImp)" stroke="none" />
      <path d={pathFor(impressions, yImp)} fill="none" stroke="var(--dash-blue)" strokeWidth={2.5} strokeLinejoin="round" strokeLinecap="round" />
      <path d={pathFor(clicks, yClk)} fill="none" stroke="var(--dash-orange)" strokeWidth={2.5} strokeLinejoin="round" strokeLinecap="round" />
      {impressions.map((v, i) => (
        <circle key={`i${i}`} cx={x(i).toFixed(1)} cy={yImp(v).toFixed(1)} r={3} fill="var(--dash-blue)">
          <title>{v.toLocaleString()} impressions</title>
        </circle>
      ))}
      {clicks.map((v, i) => (
        <circle key={`c${i}`} cx={x(i).toFixed(1)} cy={yClk(v).toFixed(1)} r={3} fill="var(--dash-orange)">
          <title>{v.toLocaleString()} clicks</title>
        </circle>
      ))}
      {dayLabels}
    </svg>
  );
}

function SpendChart({ spend }: { spend: number[] }) {
  const W = 640,
    H = 160,
    padL = 44,
    padR = 16,
    padT = 10,
    padB = 26;
  const plotW = W - padL - padR,
    plotH = H - padT - padB;
  const n = Math.max(spend.length, 1);
  const maxSpend = Math.max(...spend, 1);
  const barGap = 6;
  const barW = plotW / n - barGap;

  const bars = spend.map((v, i) => {
    const bx = padL + i * (plotW / n) + barGap / 2;
    const bh = maxSpend > 0 ? (v / maxSpend) * plotH : 0;
    const by = padT + plotH - bh;
    return (
      <rect
        key={i}
        x={bx.toFixed(1)}
        y={by.toFixed(1)}
        width={barW.toFixed(1)}
        height={Math.max(bh, 1.5).toFixed(1)}
        rx={3}
        fill="var(--dash-purple)"
        fillOpacity={0.75}
      >
        <title>${v.toFixed(2)}</title>
      </rect>
    );
  });

  const labelIdx = new Set([0, n - 1, Math.floor((n - 1) / 2)]);
  const dayLabels = spend.map((_, i) => {
    if (!labelIdx.has(i)) return null;
    const bx = padL + i * (plotW / n) + barGap / 2;
    const daysAgo = n - 1 - i;
    const label = daysAgo === 0 ? 'Today' : `${daysAgo}d ago`;
    return (
      <text key={i} x={(bx + barW / 2).toFixed(1)} y={H - 8} fontSize={10} fill="var(--ink)" fillOpacity={0.5} textAnchor="middle" fontFamily="-apple-system,sans-serif">
        {label}
      </text>
    );
  });

  const gridLines = [0, 1, 2].map((g) => {
    const gy = padT + (plotH / 2) * g;
    const gv = maxSpend - (maxSpend / 2) * g;
    return (
      <g key={g}>
        <line x1={padL} y1={gy.toFixed(1)} x2={W - padR} y2={gy.toFixed(1)} stroke="rgba(20,18,28,0.08)" strokeWidth={1} />
        <text x={padL - 8} y={(gy + 3).toFixed(1)} fontSize={9.5} fill="var(--ink)" fillOpacity={0.5} textAnchor="end" fontFamily="-apple-system,sans-serif">
          ${gv.toFixed(0)}
        </text>
      </g>
    );
  });

  return (
    <svg viewBox={`0 0 ${W} ${H}`} preserveAspectRatio="none">
      {gridLines}
      {bars}
      {dayLabels}
    </svg>
  );
}

export function AdvertiseStatsPanel({ ads, stats, statsLoading, statsError, fetchStats }: Props) {
  const [selected, setSelected] = useState<string>('all');
  const [menuOpen, setMenuOpen] = useState(false);

  useEffect(() => {
    fetchStats(selected);
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, [selected]);

  const selectedAd = selected === 'all' ? null : ads.find((a) => a.id === selected) || null;
  const triggerDot = selectedAd ? STATUS_COLOR[selectedAd.status] : 'var(--dash-blue)';
  const triggerName = selectedAd ? adName(selectedAd) : 'All ads';
  const triggerDesc = selectedAd ? `${selectedAd.creative.type} · ${STATUS_LABEL[selectedAd.status]}` : 'Combined performance across every ad';

  const totalImpressions = sum(stats.impressions);
  const totalClicks = sum(stats.clicks);
  const totalSpend = sum(stats.spendUsd);
  const ctr = totalImpressions > 0 ? (totalClicks / totalImpressions) * 100 : 0;

  return (
    <div className="adv-stats">
      <div className="adv-stats-selector" id="adv-stats-selector">
        <button type="button" className="adv-stats-select-trigger" onClick={() => setMenuOpen((v) => !v)} aria-haspopup="listbox" aria-expanded={menuOpen}>
          <span className="adv-stats-select-dot is-all" style={{ background: triggerDot }} />
          <span className="adv-stats-select-text">
            <span className="adv-stats-select-name">{triggerName}</span>
            <span className="adv-stats-select-desc">{triggerDesc}</span>
          </span>
          <svg className="adv-stats-select-chevron" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth={2.3} strokeLinecap="round" strokeLinejoin="round">
            <path d="m6 9 6 6 6-6" />
          </svg>
        </button>
        {menuOpen && (
          <div className="adv-stats-select-menu" role="listbox" aria-label="Choose ad to view stats for">
            <button
              type="button"
              className="adv-stats-select-option"
              role="option"
              aria-selected={selected === 'all'}
              onClick={() => {
                setSelected('all');
                setMenuOpen(false);
              }}
            >
              <span className="adv-stats-select-dot is-all" />
              <span className="adv-stats-select-option-text">
                <span className="adv-stats-select-option-name">All ads</span>
                <span className="adv-stats-select-option-desc">Combined performance across every ad</span>
              </span>
            </button>
            {ads.map((ad) => (
              <button
                type="button"
                key={ad.id}
                className="adv-stats-select-option"
                role="option"
                aria-selected={selected === ad.id}
                onClick={() => {
                  setSelected(ad.id);
                  setMenuOpen(false);
                }}
              >
                <span className="adv-stats-select-dot" style={{ background: STATUS_COLOR[ad.status] }} />
                <span className="adv-stats-select-option-text">
                  <span className="adv-stats-select-option-name">{adName(ad)}</span>
                  <span className="adv-stats-select-option-desc">
                    {ad.creative.type} · {STATUS_LABEL[ad.status]}
                  </span>
                </span>
              </button>
            ))}
          </div>
        )}
      </div>

      {statsError && <p className="adv-row-note">{statsError}</p>}

      <div className="adv-stat-grid">
        <div className="adv-stat-card">
          <div className="adv-stat-card-top">
            <span className="adv-stat-icon tone-spend">
              <svg viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth={2} strokeLinecap="round" strokeLinejoin="round">
                <path d="M12 1v22" />
                <path d="M17 5H9.5a3.5 3.5 0 0 0 0 7h5a3.5 3.5 0 0 1 0 7H6" />
              </svg>
            </span>
          </div>
          <span className="adv-stat-value">${totalSpend.toFixed(2)}</span>
          <span className="adv-stat-label">Total spent</span>
        </div>

        <div className="adv-stat-card">
          <div className="adv-stat-card-top">
            <span className="adv-stat-icon tone-impressions">
              <svg viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth={2} strokeLinecap="round" strokeLinejoin="round">
                <path d="M1 12s4-7 11-7 11 7 11 7-4 7-11 7-11-7-11-7Z" />
                <circle cx={12} cy={12} r={3} />
              </svg>
            </span>
          </div>
          <span className="adv-stat-value">{totalImpressions.toLocaleString()}</span>
          <span className="adv-stat-label">Impressions</span>
        </div>

        <div className="adv-stat-card">
          <div className="adv-stat-card-top">
            <span className="adv-stat-icon tone-clicks">
              <svg viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth={2} strokeLinecap="round" strokeLinejoin="round">
                <path d="m3 3 7.07 16.97 2.51-7.39 7.39-2.51L3 3Z" />
              </svg>
            </span>
          </div>
          <span className="adv-stat-value">{totalClicks.toLocaleString()}</span>
          <span className="adv-stat-label">Clicks</span>
        </div>

        <div className="adv-stat-card">
          <div className="adv-stat-card-top">
            <span className="adv-stat-icon tone-ctr">
              <svg viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth={2} strokeLinecap="round" strokeLinejoin="round">
                <path d="M3 3v18h18" />
                <path d="m19 9-5 5-4-4-3 3" />
              </svg>
            </span>
          </div>
          <span className="adv-stat-value">{ctr.toFixed(2)}%</span>
          <span className="adv-stat-label">Click-through rate</span>
        </div>
      </div>

      <div className="adv-chart-card">
        <div className="adv-chart-head">
          <h3 className="adv-chart-title">Performance over the last {stats.days.length || 14} days</h3>
          <div className="adv-chart-legend">
            <span className="adv-legend-item">
              <span className="adv-legend-dot" style={{ background: 'var(--dash-blue)' }} />
              Impressions
            </span>
            <span className="adv-legend-item">
              <span className="adv-legend-dot" style={{ background: 'var(--dash-orange)' }} />
              Clicks
            </span>
          </div>
        </div>
        <div className="adv-chart-svg-wrap">
          {statsLoading ? (
            <p className="adv-row-note">Loading…</p>
          ) : (
            <TimeseriesChart days={stats.days} impressions={stats.impressions} clicks={stats.clicks} />
          )}
        </div>
      </div>

      <div className="adv-chart-card">
        <div className="adv-chart-head">
          <h3 className="adv-chart-title">Daily spend</h3>
        </div>
        <div className="adv-chart-svg-wrap">{!statsLoading && <SpendChart spend={stats.spendUsd} />}</div>
      </div>

      {selected === 'all' && (
        <div id="adv-stats-list-wrap">
          <h3 className="adv-chart-title" style={{ marginBottom: 12 }}>
            Your ads
          </h3>
          <div className="adv-stats-list">
            {ads.length === 0 && <p className="adv-row-note">You haven&apos;t created any ads yet.</p>}
            {ads.map((ad) => (
              <div
                className="adv-stats-row"
                key={ad.id}
                onClick={() => setSelected(ad.id)}
                role="button"
                tabIndex={0}
                onKeyDown={(e) => {
                  if (e.key === 'Enter') setSelected(ad.id);
                }}
              >
                <span className="adv-stats-row-dot" style={{ background: STATUS_COLOR[ad.status] }} />
                <span className="adv-stats-row-main">
                  <span className="adv-stats-row-top">
                    <span className="adv-stats-row-name">{adName(ad)}</span>
                  </span>
                  <span className="adv-stats-row-sub">
                    {ad.creative.type} · {STATUS_LABEL[ad.status]}
                  </span>
                </span>
                <span className="adv-stats-row-metrics">
                  <span className="adv-stats-row-metric">
                    <span className="adv-stats-row-metric-value">${ad.budget.spentUsd.toFixed(2)}</span>
                    <span className="adv-stats-row-metric-label">Spent</span>
                  </span>
                  <span className="adv-stats-row-metric">
                    <span className="adv-stats-row-metric-value">{ad.stats.impressions.toLocaleString()}</span>
                    <span className="adv-stats-row-metric-label">Impr.</span>
                  </span>
                  <span className="adv-stats-row-metric">
                    <span className="adv-stats-row-metric-value">{ad.stats.clicks.toLocaleString()}</span>
                    <span className="adv-stats-row-metric-label">Clicks</span>
                  </span>
                </span>
              </div>
            ))}
          </div>
        </div>
      )}
    </div>
  );
}
