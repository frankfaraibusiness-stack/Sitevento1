// components/analytics/sections/primitives.tsx
//
// Shared building blocks. They emit the mockup's `.an-*` class structure, so
// styles/analytics/analytics-sections.css applies directly.
import type { CSSProperties, ReactNode } from 'react';
import type { Dir, RankedRow, Stat } from './analyticsPlaceholderData';
import { ArrowDown, ArrowUp } from './icons';

const style = (vars: Record<string, string | number>) => vars as CSSProperties;

/** Section heading + one-line description. */
export function SectionTitle({ title, note, id }: { title: string; note?: string; id?: string }) {
  return (
    <div className="an-section-title">
      <h2 id={id}>{title}</h2>
      {note && <span>{note}</span>}
    </div>
  );
}

/** Sub-block heading (bold line) and the ruled "label" variant. */
export function SubHead({ children, first }: { children: ReactNode; first?: boolean }) {
  return <h4 className={first ? 'an-subhead is-first' : 'an-subhead'}>{children}</h4>;
}
export function SubLabel({ children }: { children: ReactNode }) {
  return <h4 className="an-subsection-label">{children}</h4>;
}

/** Horizontal bar track. `pct` 0–100. Decorative: the value is always in text. */
export function Bar({ pct, tone, label }: { pct: number; tone?: string; label?: string }) {
  return (
    <span className="an-row-bar" aria-hidden="true" title={label}>
      <i className={tone ? `g-${tone}` : undefined} style={style({ width: `${pct}%` })} />
    </span>
  );
}

/** Up/down/flat change pill. */
export function Delta({ dir, children, icon = true }: { dir: Dir; children: ReactNode; icon?: boolean }) {
  return (
    <span className={`an-delta ${dir}`}>
      {icon && dir === 'up' && <ArrowUp />}
      {icon && dir === 'down' && <ArrowDown />}
      {children}
    </span>
  );
}

export type TabVariant = 'metric' | 'breakdown' | 'fin';
export interface TabItem {
  id: string;
  label?: string;
  note?: string;
  color?: string; // metric chips show a coloured dot
}
const TAB_CLASS: Record<TabVariant, { wrap: string; item: string }> = {
  metric: { wrap: 'an-metric-scroll', item: 'an-metric-chip' },
  breakdown: { wrap: 'an-breakdown-tabs', item: 'an-breakdown-tab' },
  fin: { wrap: 'an-fin-tabs', item: 'an-fin-tab' },
};

export function Tabs({ label, items, active, onChange, variant = 'breakdown' }: { label: string; items: TabItem[]; active: string; onChange: (id: string) => void; variant?: TabVariant }) {
  const c = TAB_CLASS[variant];
  return (
    <div className={c.wrap} role="tablist" aria-label={label}>
      {items.map((t) => {
        const on = t.id === active;
        return (
          <button key={t.id} type="button" role="tab" aria-selected={on} className={on ? `${c.item} is-active` : c.item} onClick={() => onChange(t.id)}>
            {t.color && <span className="an-chip-dot" style={style({ background: t.color })} />}
            {t.label ?? t.id}
            {t.note && <small>{t.note}</small>}
          </button>
        );
      })}
    </div>
  );
}

/** dt/dd/small stat blocks (the .an-mini-stat grid). */
export function MiniStats({ items, cols2 }: { items: Stat[]; cols2?: boolean }) {
  return (
    <dl className={cols2 ? 'an-mini-stats is-2col' : 'an-mini-stats'}>
      {items.map((s) => (
        <div key={s.label} className={s.tone === 'warn' ? 'an-mini-stat is-warn' : 'an-mini-stat'}>
          <dt>{s.label}</dt>
          <dd>{s.value}</dd>
          {s.note && <small>{s.note}</small>}
        </div>
      ))}
    </dl>
  );
}

/** Ranked list: [flag] label ... value share, bar, sub-line. */
export function RankedList({ rows, bars = true }: { rows: RankedRow[]; bars?: boolean }) {
  return (
    <ol className="an-rows">
      {rows.map((r) => (
        <li key={r.label} className="an-row">
          {r.flag && <span className="an-row-flag">{r.flag}</span>}
          <span className="an-row-main">
            <span className="an-row-top">
              <b title={r.title}>{r.label}</b>
              <span>
                {r.value}
                {r.share && (
                  <>
                    {' '}
                    <small>{r.share}</small>
                  </>
                )}
              </span>
            </span>
            {bars && r.pct !== undefined && <Bar pct={r.pct} />}
            {r.sub && <span className="an-row-sub">{r.sub}</span>}
          </span>
        </li>
      ))}
    </ol>
  );
}

/** Tab / section has no data yet. */
export function Empty({ title = 'No data yet', children = 'Nothing to show for this view in the selected period.' }: { title?: string; children?: ReactNode }) {
  return (
    <div className="an-empty">
      <b>{title}</b>
      {children}
    </div>
  );
}
