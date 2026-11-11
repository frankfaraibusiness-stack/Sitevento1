'use client';

// 7 · Revenue & profitability — SaaS subscriptions + product sales.
import { useState } from 'react';
import { Bar, Delta, MiniStats, RankedList, SectionTitle, SubHead, SubLabel, Tabs } from './primitives';
import {
  BEST_SELLERS,
  MRR_MOVEMENT,
  PL_ROWS,
  PL_SPLIT,
  PRODUCT_STATS,
  REVENUE_MIX,
  REVENUE_SUBTITLE,
  REVENUE_TABS,
  REVENUE_TILES,
  REVENUE_TITLE,
  SAAS_PLANS,
  SAAS_STATS,
} from './analyticsPlaceholderData';

export function RevenueSection() {
  const [tab, setTab] = useState(REVENUE_TABS[0]);
  const showSaas = tab !== 'Product sales';
  const showProduct = tab !== 'SaaS subscriptions';

  return (
    <section className="an-section" id="revenue" aria-labelledby="revenue-title">
      <SectionTitle id="revenue-title" title={REVENUE_TITLE} note={REVENUE_SUBTITLE} />
      <Tabs variant="fin" label="Revenue view" items={REVENUE_TABS.map((t) => ({ id: t }))} active={tab} onChange={setTab} />

      <dl className="an-fin-grid">
        {REVENUE_TILES.map((t) => (
          <div key={t.label} className={t.accent ? 'an-fin-tile is-accent' : 'an-fin-tile'}>
            <dt>{t.label}</dt>
            <dd>{t.value}</dd>
            <Delta dir={t.dir} icon={false}>
              {t.delta}
            </Delta>
          </div>
        ))}
      </dl>

      <SubLabel>Revenue mix</SubLabel>
      {REVENUE_MIX.map((m) => (
        <div key={m.label} className="an-mix-row">
          <span>{m.label}</span>
          <Bar pct={m.pct} tone={m.tone} />
          <b>{m.value}</b>
        </div>
      ))}

      <SubLabel>Profit &amp; loss</SubLabel>
      <div className="an-pl-bar" role="img" aria-label={PL_SPLIT.map((s) => s.label).join(', ')}>
        {PL_SPLIT.map((s) => (
          <span key={s.label} className={`is-${s.tone}`} style={{ width: `${s.pct}%` }}>
            {s.label}
          </span>
        ))}
      </div>
      <div className="an-pl-rows">
        {PL_ROWS.map((r) => (
          <div key={r.label} className={r.kind ? `an-pl-row is-${r.kind}` : 'an-pl-row'}>
            <span>{r.label}</span>
            <span className={r.sign ? `an-pl-${r.sign}` : undefined}>{r.value}</span>
          </div>
        ))}
      </div>

      <div className={showSaas && showProduct ? 'an-row-2 an-mt-lg' : 'an-row-2 is-single an-mt-lg'}>
        {showSaas && (
          <div id="saas">
            <SubLabel>SaaS subscriptions</SubLabel>
            <MiniStats items={SAAS_STATS} cols2 />

            <SubHead>Plan breakdown</SubHead>
            <div className="an-table-wrap">
              <table className="an-table">
                <thead>
                  <tr>
                    <th>Plan</th>
                    <th>Subscribers</th>
                    <th>MRR</th>
                  </tr>
                </thead>
                <tbody>
                  {SAAS_PLANS.map((p) => (
                    <tr key={p.plan}>
                      <td>
                        <span className="an-chan-dot" style={{ background: p.color }} />
                        {p.plan}
                      </td>
                      <td>{p.subscribers}</td>
                      <td>{p.mrr}</td>
                    </tr>
                  ))}
                </tbody>
              </table>
            </div>

            <SubHead>MRR movement this month</SubHead>
            <div className="an-log">
              {MRR_MOVEMENT.map((m) => (
                <div key={m.label} className="an-mrr-move">
                  <span className={`an-mrr-move-dot is-${m.dir}`} />
                  <span className="an-mrr-move-label">{m.label}</span>
                  <span className={`an-mrr-move-val ${m.dir === 'pos' ? 'pos' : 'neg'}`}>{m.value}</span>
                </div>
              ))}
            </div>
          </div>
        )}

        {showProduct && (
          <div id="product-sales">
            <SubLabel>Product sales</SubLabel>
            <MiniStats items={PRODUCT_STATS} cols2 />

            <SubHead>Best-selling products</SubHead>
            <RankedList rows={BEST_SELLERS} />
          </div>
        )}
      </div>
    </section>
  );
}
