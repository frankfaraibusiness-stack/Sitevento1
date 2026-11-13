'use client';

// 7 · Revenue & profitability — SaaS subscriptions + product sales.
// Everything here is confirmed by the customer's own backend (API events).
import { useState } from 'react';
import { Bar, ConnectApi, Delta, MiniStats, RankedList, SectionTitle, SubHead, SubLabel, Tabs } from './primitives';
import { REVENUE_SUBTITLE, REVENUE_TABS, REVENUE_TITLE, type Stat, type RankedRow } from './analyticsTypes';
import { useAnalyticsData } from '../AnalyticsDataContext';
import { fmtMoney } from '../model/revenue';
import { fmtNum, fmtPct } from '@/lib/dashboardStats';

const PLAN_COLORS = ['#6a4fe0', '#0f9aa6', '#14995f', '#c43e78', '#b67a16', '#8a6ff2'];

export function RevenueSection() {
  const { model, extrasLoading } = useAnalyticsData();
  const r = model.revenue;
  const [tab, setTab] = useState(REVENUE_TABS[0]);
  const showSaas = tab !== 'Product sales';
  const showProduct = tab !== 'SaaS subscriptions';

  if (!r) {
    return (
      <section className="an-section" id="revenue" aria-labelledby="revenue-title">
        <SectionTitle id="revenue-title" title={REVENUE_TITLE} note={REVENUE_SUBTITLE} />
        {extrasLoading ? (
          <div className="an-empty"><b>Loading revenue…</b></div>
        ) : (
          <ConnectApi title="No revenue data yet" enable="Subscriptions or Orders">
            Revenue, costs and profit can only come from your own backend. Choose what it may send on the API page — plans and prices, products, orders, expenses — and this section fills itself in.
          </ConnectApi>
        )}
      </section>
    );
  }

  const m = (n: number) => fmtMoney(n, r.currency || 'USD');
  const s = r.saas;
  const p = r.products;
  const saasStats: Stat[] = [
    { label: 'MRR', value: m(s.mrr), note: s.prevMrr !== null && s.prevMrr > 0 ? `${s.mrr >= s.prevMrr ? '+' : '−'}${Math.abs(((s.mrr - s.prevMrr) / s.prevMrr) * 100).toFixed(1)}% vs start of period` : undefined },
    { label: 'ARR', value: m(s.arr) },
    { label: 'Active subscribers', value: fmtNum(s.subscribers), note: `${fmtNum(s.newSubs)} new · ${fmtNum(s.canceled)} cancelled` },
    { label: 'Churn rate', value: fmtPct(s.churnRate, 1), note: s.churnRate === null ? 'needs subscribers at period start' : undefined, tone: s.churnRate !== null && s.churnRate > 0.05 ? 'warn' : undefined },
    { label: 'ARPU', value: s.arpu === null ? '—' : m(s.arpu), note: 'per subscriber / month' },
    { label: 'Trial → paid', value: s.trialsEnded ? fmtPct(s.trialsConverted / s.trialsEnded, 0) : '—', note: s.trialsStarted ? `${fmtNum(s.trialsStarted)} trials started` : undefined },
  ];
  const productStats: Stat[] = [
    { label: 'Orders', value: fmtNum(p.orders) },
    { label: 'Avg. order value', value: p.aov === null ? '—' : m(p.aov) },
    { label: 'Units sold', value: fmtNum(p.units), note: p.itemsPerOrder === null ? undefined : `${p.itemsPerOrder.toFixed(1)} per order` },
    { label: 'Refund rate', value: fmtPct(p.refundRate, 1), note: p.refunded > 0 ? `${m(p.refunded)} refunded` : undefined, tone: p.refundRate !== null && p.refundRate > 0.05 ? 'warn' : undefined },
  ];
  const maxRev = Math.max(1, ...p.best.map((b) => b.revenue));
  const best: RankedRow[] = p.best.map((b) => ({ label: b.name, title: b.name, value: m(b.revenue), share: b.units ? `${fmtNum(b.units)} sold` : 'no sales yet', pct: (b.revenue / maxRev) * 100 }));

  return (
    <section className="an-section" id="revenue" aria-labelledby="revenue-title">
      <SectionTitle id="revenue-title" title={REVENUE_TITLE} note={REVENUE_SUBTITLE} />
      <Tabs variant="fin" label="Revenue view" items={REVENUE_TABS.map((t) => ({ id: t }))} active={tab} onChange={setTab} />

      <dl className="an-fin-grid">
        {r.tiles.map((t) => (
          <div key={t.label} className={t.accent ? 'an-fin-tile is-accent' : 'an-fin-tile'}>
            <dt>{t.label}</dt>
            <dd>{t.value}</dd>
            <Delta dir={t.dir} icon={false}>
              {t.delta}
            </Delta>
          </div>
        ))}
      </dl>
      {(r.excluded > 0 || r.truncated) && (
        <p className="an-foot-note">
          {r.excluded > 0 && <>{fmtNum(r.excluded)} event{r.excluded === 1 ? '' : 's'} in a currency other than {r.currency} {r.excluded === 1 ? 'is' : 'are'} left out. </>}
          {r.truncated && <>Showing the newest 4,000 events in this window.</>}
        </p>
      )}

      <SubLabel>Revenue mix</SubLabel>
      {r.mix.map((x) => (
        <div key={x.label} className="an-mix-row">
          <span>{x.label}</span>
          <Bar pct={x.pct} tone={x.tone} />
          <b>{x.value}</b>
        </div>
      ))}

      <SubLabel>Profit &amp; loss</SubLabel>
      {r.plSplit.length ? (
        <div className="an-pl-bar" role="img" aria-label={r.plSplit.map((x) => x.label).join(', ')}>
          {r.plSplit.map((x) => (
            <span key={x.label} className={`is-${x.tone}`} style={{ width: `${x.pct}%` }}>
              {x.label}
            </span>
          ))}
        </div>
      ) : null}
      <div className="an-pl-rows">
        {r.plRows.map((row) => (
          <div key={row.label} className={row.kind ? `an-pl-row is-${row.kind}` : 'an-pl-row'}>
            <span>{row.label}</span>
            <span className={row.sign ? `an-pl-${row.sign}` : undefined}>{row.value}</span>
          </div>
        ))}
      </div>
      {r.totals.cogs === 0 && r.totals.opex === 0 && (
        <p className="an-foot-note">
          No costs recorded for this period, so profit equals revenue. Switch on <b>Expenses</b> on the API page to include hosting, fees, team and tools.
        </p>
      )}

      <div className={showSaas && showProduct ? 'an-row-2 an-mt-lg' : 'an-row-2 is-single an-mt-lg'}>
        {showSaas && (
          <div id="saas">
            <SubLabel>SaaS subscriptions</SubLabel>
            {s.hasData ? (
              <>
                <MiniStats items={saasStats} cols2 />
                <SubHead>Plan breakdown</SubHead>
                {s.plans.length ? (
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
                        {s.plans.map((pl, i) => (
                          <tr key={pl.plan}>
                            <td>
                              <span className="an-chan-dot" style={{ background: PLAN_COLORS[i % PLAN_COLORS.length] }} />
                              {pl.plan}
                              <small>{pl.price}</small>
                            </td>
                            <td>{fmtNum(pl.subscribers)}</td>
                            <td>{m(pl.mrr)}</td>
                          </tr>
                        ))}
                      </tbody>
                    </table>
                  </div>
                ) : null}
                <SubHead>MRR movement this period</SubHead>
                <div className="an-log">
                  {s.movement.map((mv) => (
                    <div key={mv.label} className="an-mrr-move">
                      <span className={`an-mrr-move-dot is-${mv.dir}`} />
                      <span className="an-mrr-move-label">{mv.label}</span>
                      <span className={mv.dir === 'flat' ? 'an-mrr-move-val' : `an-mrr-move-val ${mv.dir === 'pos' ? 'pos' : 'neg'}`}>
                        {mv.value > 0 ? '+' : mv.value < 0 ? '−' : ''}
                        {m(Math.abs(mv.value))}
                      </span>
                    </div>
                  ))}
                </div>
                {s.failedPayments > 0 && <p className="an-foot-note">{fmtNum(s.failedPayments)} failed renewal payment{s.failedPayments === 1 ? '' : 's'} this period.</p>}
              </>
            ) : (
              <ConnectApi title="No subscriptions yet" enable="Subscriptions">
                Send subscription events and your recurring revenue, churn and plans appear here.
              </ConnectApi>
            )}
          </div>
        )}

        {showProduct && (
          <div id="product-sales">
            <SubLabel>Product sales</SubLabel>
            {p.hasData ? (
              <>
                <MiniStats items={productStats} cols2 />
                <SubHead>Best-selling products</SubHead>
                {best.length ? <RankedList rows={best} /> : <div className="an-empty">No sales in this period yet.</div>}
              </>
            ) : (
              <ConnectApi title="No product sales yet" enable="Orders">
                Send completed orders and you’ll see revenue, average order value and best sellers.
              </ConnectApi>
            )}
          </div>
        )}
      </div>
    </section>
  );
}
