// components/analytics/sections/chart.ts — turns a numeric series into the SVG path + labels the overview chart draws.
export interface ChartShape {
  viewBox: string;
  gridY: number[];
  line: string;
  area: string;
  highlight: { x: number; y: number } | null;
  axis: { x: number; label: string; anchor: 'start' | 'end' }[];
  bestIndex: number;
  hasData: boolean;
}

const TOP = 26;
const BOTTOM = 246;

export function buildChart(values: number[], labels: string[]): ChartShape {
  const n = values.length;
  const max = Math.max(0, ...values);
  const min = Math.min(0, ...values);
  const span = max - min || 1;
  const hasData = n > 0 && max !== min;
  const xs = values.map((_, i) => (n <= 1 ? 500 : (i / (n - 1)) * 1000));
  const ys = values.map((v) => (hasData ? BOTTOM - ((v - min) / span) * (BOTTOM - TOP) : BOTTOM));
  let line = '';
  if (n === 0) line = `M0,${BOTTOM} L1000,${BOTTOM}`;
  else if (n === 1) line = `M0,${ys[0]} L1000,${ys[0]}`;
  else {
    line = `M${xs[0].toFixed(1)},${ys[0].toFixed(1)}`;
    for (let i = 1; i < n; i++) {
      const mx = ((xs[i - 1] + xs[i]) / 2).toFixed(1);
      line += ` C${mx},${ys[i - 1].toFixed(1)} ${mx},${ys[i].toFixed(1)} ${xs[i].toFixed(1)},${ys[i].toFixed(1)}`;
    }
  }
  let best = 0;
  values.forEach((v, i) => {
    if (v > values[best]) best = i;
  });
  const picks = n <= 1 ? [0] : Array.from(new Set([0, 0.25, 0.5, 0.75, 1].map((f) => Math.round(f * (n - 1)))));
  return {
    viewBox: '0 0 1000 280',
    gridY: [18, 86, 154, 222],
    line,
    area: `${line} L1000,280 L0,280 Z`,
    highlight: hasData && n > 0 ? { x: xs[best], y: ys[best] } : null,
    axis: picks.map((i, k) => ({ x: n <= 1 ? 0 : xs[i], label: labels[i] ?? '', anchor: k === picks.length - 1 && picks.length > 1 ? ('end' as const) : ('start' as const) })),
    bestIndex: best,
    hasData,
  };
}
