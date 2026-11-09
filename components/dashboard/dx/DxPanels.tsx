'use client';

// components/dashboard/dx/DxPanels.tsx
//
// The content panels of the main dashboard. Each is a single, self-contained
// card — related numbers live together inside one panel instead of every
// field getting its own box.
import { useState, type ReactNode } from 'react';
import { useNavRouter } from '@/hooks/useNavPending';
import type { AccountLimits } from '@/hooks/useAccountLimits';
import { useCountdown } from '@/hooks/useAccountLimits';
import type { AccountTotals, DashboardData } from '@/hooks/useDashboardData';
import { VISIT_CAP } from '@/hooks/useDashboardData';
import type { ResolvedRange } from '@/lib/dashboardRange';
import { dayKey } from '@/lib/dashboardRange';
import {
  DOW_LABELS,
  fmtDecimal,
  fmtDuration,
  fmtMs,
  fmtNum,
  fmtPct,
  fmtUsd,
  hourLabel,
  timeAgo,
  type RankedRow,
  type VisitAggregates,
  type DeviceExperience,
  type JourneyIntelligence,
} from '@/lib/dashboardStats';
import { countryCodeToFlag, getCountryName } from '@/lib/countries';
import { getPlan, type PlanId } from '@/lib/plans';
import { planMeetsMinimum } from '@/lib/limits';
import type { MonetizationConfig } from '@/lib/monetization';
import type { BrokenLink, ApiEvent } from '@/lib/types';
import { useApiEvents } from '@/hooks/useApiEvents';
import { QUICK_TOOL_OPTIONS } from '@/components/dashboard/quickToolOptions';
import { HeatMap, Sparkline } from '@/components/dashboard/dx/DxCharts';
import { WorldMap } from '@/components/dashboard/dx/DxWorldMap';

/* ── shared bits ───────────────────────────────────────────────── */
// Same navigation path the rest of the dashboard uses (useNavRouter drives
// the NavPendingOverlay), while keeping a real href so cmd/ctrl-click and
// "open in new tab" still work.
function NavLink({ href, className, children }: { href: string; className?: string; children: ReactNode }) {
  const router = useNavRouter();
  return (
    <a
      href={href}
      className={className}
      onClick={(e) => {
        if (e.defaultPrevented || e.button !== 0 || e.metaKey || e.ctrlKey || e.shiftKey || e.altKey) return;
        e.preventDefault();
        router.push(href);
      }}
    >
      {children}
    </a>
  );
}

export function Panel({
  title,
  hint,
  action,
  className,
  children,
}: {
  title?: string;
  hint?: string;
  action?: ReactNode;
  className?: string;
  children: ReactNode;
}) {
  return (
    <section className={className ? `dx-panel ${className}` : 'dx-panel'}>
      {/* Deliberately a <div>, not a <header> — base.css's bare
          `header { position: fixed; ... }` rule matches ANY <header>
          element on the page, so this was being silently pinned to
          the top of the viewport instead of sitting inline at the
          top of its own card. See DashboardShell.tsx's .dx-top for
          the same fix and fuller explanation. */}
      {(title || action) && (
        <div className="dx-panel-head">
          <div>
            {title && <h2>{title}</h2>}
            {hint && <p>{hint}</p>}
          </div>
          {action}
        </div>
      )}
      {children}
    </section>
  );
}

function Delta({ now, before }: { now: number; before: number | null }) {
  if (before === null) return null;
  if (before === 0) return now > 0 ? <span className="dx-delta is-up">New</span> : null;
  const pct = ((now - before) / before) * 100;
  if (Math.abs(pct) < 0.5) return <span className="dx-delta">0%</span>;
  return (
    <span className={pct > 0 ? 'dx-delta is-up' : 'dx-delta is-down'}>
      {pct > 0 ? '▲' : '▼'} {Math.abs(pct) >= 100 ? Math.round(Math.abs(pct)) : Math.abs(pct).toFixed(1)}%
    </span>
  );
}

/* ── KPI strip (one card, many numbers) ────────────────────────── */
export function KpiStrip({
  data,
  agg,
  range,
}: {
  data: DashboardData;
  agg: VisitAggregates;
  range: ResolvedRange;
}) {
  const perDay = data.total / Math.max(1, range.days);
  const perVisitor = data.uniqueUsers > 0 ? data.total / data.uniqueUsers : null;
  const items: { label: string; value: string; note?: ReactNode; sub?: string }[] = [
    { label: 'Visits', value: fmtNum(data.total), note: <Delta now={data.total} before={data.prevTotal} />, sub: 'page views' },
    {
      label: 'Unique users',
      value: fmtNum(data.uniqueUsers),
      sub: data.newUsers !== null ? `${fmtNum(data.newUsers)} new · ${fmtNum(data.returningUsers)} returning` : undefined,
    },
    { label: 'Avg. per day', value: fmtDecimal(perDay, perDay < 10 ? 1 : 0), sub: perVisitor ? `${fmtDecimal(perVisitor, 1)} visits per user` : undefined },
    {
      label: 'Pages / session',
      value: fmtDecimal(agg.pagesPerSession, 1),
      sub: agg.avgSessionSec !== null ? `~${fmtDuration(agg.avgSessionSec)} per multi-page visit` : undefined,
    },
    { label: 'Bounce rate', value: fmtPct(agg.bounceRate, 0), sub: agg.sessions ? `${fmtNum(agg.sessions)} sessions` : undefined },
    { label: 'Emails captured', value: fmtNum(data.leadsInRange), sub: `${fmtNum(data.leadsTotal)} all time` },
  ];

  return (
    <Panel className="dx-kpis">
      <dl className="dx-kpi-grid">
        {items.map((k) => (
          <div className="dx-kpi" key={k.label}>
            <dt>{k.label}</dt>
            <dd>
              <b>{k.value}</b>
              {k.note}
            </dd>
            {k.sub && <small>{k.sub}</small>}
          </div>
        ))}
      </dl>
    </Panel>
  );
}

/* ── Countries ─────────────────────────────────────────────────── */
export function CountriesPanel({ agg, total }: { agg: VisitAggregates; total: number }) {
  const [all, setAll] = useState(false);
  const rows = all ? agg.countries : agg.countries.slice(0, 7);
  const max = agg.countries[0]?.visits || 1;
  return (
    <Panel
      className="dx-countries"
      title="Top countries"
      hint={agg.countries.length ? `${agg.countries.filter((c) => c.code).length} countries` : undefined}
      action={
        agg.countries.length > 7 ? (
          <button type="button" className="dx-link" onClick={() => setAll((a) => !a)}>
            {all ? 'Show less' : 'Show all'}
          </button>
        ) : null
      }
    >
      <div className="dx-countries-body">
        <WorldMap countries={agg.countries} />

        {rows.length === 0 ? (
          <p className="dx-empty">Visitor locations will appear as people arrive.</p>
        ) : (
          <ol className="dx-rows">
            {rows.map((c) => (
              <li key={c.code || 'unknown'} className="dx-row">
                <span className="dx-flag" aria-hidden="true">
                  {countryCodeToFlag(c.code)}
                </span>
                <span className="dx-row-main">
                  <span className="dx-row-top">
                    <b>{c.code ? getCountryName(c.code) : 'Unknown'}</b>
                    <span>
                      {fmtNum(c.visits)} <small>{fmtDecimal(c.pct, 1)}%</small>
                    </span>
                  </span>
                  <span className="dx-bar">
                    <i style={{ width: `${Math.max(3, (c.visits / max) * 100)}%` }} />
                  </span>
                  <small className="dx-row-sub">{fmtNum(c.visitors)} unique · {fmtDecimal(c.visits / Math.max(1, c.visitors), 1)} avg visits</small>
                </span>
              </li>
            ))}
          </ol>
        )}
      </div>
      {agg.loaded < total && <p className="dx-foot">Based on the latest {fmtNum(agg.loaded)} visits.</p>}
    </Panel>
  );
}

/* ── Breakdown tabs ────────────────────────────────────────────── */
type BreakTab = 'pages' | 'entry' | 'referrers' | 'devices' | 'browsers' | 'systems' | 'languages' | 'cities';
const BREAK_TABS: { id: BreakTab; label: string }[] = [
  { id: 'pages', label: 'Pages' },
  { id: 'entry', label: 'Entry pages' },
  { id: 'referrers', label: 'Referrers' },
  { id: 'devices', label: 'Devices' },
  { id: 'browsers', label: 'Browsers' },
  { id: 'systems', label: 'Systems' },
  { id: 'languages', label: 'Languages' },
  { id: 'cities', label: 'Cities' },
];

export function BreakdownPanel({ agg }: { agg: VisitAggregates }) {
  const [tab, setTab] = useState<BreakTab>('pages');
  const rows: RankedRow[] =
    tab === 'pages'
      ? agg.pages
      : tab === 'entry'
        ? agg.entryPages
        : tab === 'referrers'
          ? agg.referrers
          : tab === 'devices'
            ? agg.devices
            : tab === 'browsers'
              ? agg.browsers
              : tab === 'systems'
                ? agg.systems
                : tab === 'languages'
                  ? agg.languages
                  : agg.cities;
  const max = rows[0]?.count || 1;

  return (
    <Panel className="dx-breakdown" title="What people do" hint="Pages, sources and the devices they use">
      <div className="dx-tabs" role="tablist" aria-label="Breakdown">
        {BREAK_TABS.map((t) => (
          <button
            key={t.id}
            type="button"
            role="tab"
            aria-selected={tab === t.id}
            className={tab === t.id ? 'dx-tab is-on' : 'dx-tab'}
            onClick={() => setTab(t.id)}
          >
            {t.label}
          </button>
        ))}
      </div>
      {rows.length === 0 ? (
        <p className="dx-empty">Nothing to show for this period yet.</p>
      ) : (
        <ol className="dx-rows is-plain">
          {rows.map((r) => (
            <li key={r.key} className="dx-row">
              <span className="dx-row-main">
                <span className="dx-row-top">
                  <b title={r.label}>{r.label}</b>
                  <span>
                    {fmtNum(r.count)} <small>{fmtDecimal(r.pct, 0)}%</small>
                  </span>
                </span>
                <span className="dx-bar is-alt">
                  <i style={{ width: `${Math.max(3, (r.count / max) * 100)}%` }} />
                </span>
              </span>
            </li>
          ))}
        </ol>
      )}
    </Panel>
  );
}

/* ── Device experience intelligence ──────────────────────────────
   Compares mobile/desktop/tablet on conversion, load time, exit rate
   and "broken interaction" (rage-click) signals — see
   lib/dashboardStats.ts's aggregateDeviceExperience for how each
   number is derived and why some read as "—" (not enough data yet)
   rather than a volatile 0%/100%. */
export function DeviceExperiencePanel({
  deviceExp,
  brokenLinks,
}: {
  deviceExp: DeviceExperience;
  brokenLinks: BrokenLink[];
}) {
  const [activeDevice, setActiveDevice] = useState<string | null>(null);
  const rows = deviceExp.rows;
  const selected = rows.find((r) => r.device === (activeDevice ?? rows[0]?.device)) ?? rows[0] ?? null;

  if (rows.length === 0) {
    return (
      <Panel className="dx-device-exp" title="Device experience" hint="Mobile vs. desktop vs. tablet">
        <p className="dx-empty">Nothing to show for this period yet.</p>
      </Panel>
    );
  }

  return (
    <Panel
      className="dx-device-exp"
      title="Device experience"
      hint="Conversion, load time and exits, side by side"
    >
      <div className="dx-tabs" role="tablist" aria-label="Device">
        {rows.map((r) => (
          <button
            key={r.device}
            type="button"
            role="tab"
            aria-selected={selected?.device === r.device}
            className={selected?.device === r.device ? 'dx-tab is-on' : 'dx-tab'}
            onClick={() => setActiveDevice(r.device)}
          >
            {r.device} <small>({fmtNum(r.visits)})</small>
          </button>
        ))}
      </div>

      {selected && (
        <>
          <dl className="dx-mini-stats">
            <div>
              <dt>Conversion rate</dt>
              <dd>{selected.conversionRate !== null ? fmtPct(selected.conversionRate, 1) : '—'}</dd>
              <small>{selected.conversionRate !== null ? `of ${fmtNum(selected.uniqueVisitors)} visitors` : 'not enough visits yet'}</small>
            </div>
            <div>
              <dt>Avg. load time</dt>
              <dd>{selected.avgLoadMs !== null ? fmtMs(selected.avgLoadMs) : '—'}</dd>
              <small>{selected.loadSampleSize > 0 ? `from ${fmtNum(selected.loadSampleSize)} page loads` : 'no load-time data yet'}</small>
            </div>
            <div className={selected.exitRate !== null && selected.exitRate > 0.6 ? 'is-warn' : undefined}>
              <dt>Exit rate</dt>
              <dd>{selected.exitRate !== null ? fmtPct(selected.exitRate, 0) : '—'}</dd>
              <small>sessions that ended on this device</small>
            </div>
            <div className={selected.rageClicksTotal > 0 ? 'is-warn' : undefined}>
              <dt>Possible broken clicks</dt>
              <dd>{fmtNum(selected.rageClicksTotal)}</dd>
              <small>rapid repeat clicks — may mean something didn't respond</small>
            </div>
          </dl>

          {selected.bestPages.length > 0 && (
            <div className="dx-device-sub">
              <h4>Most successful pages on {selected.device.toLowerCase()}</h4>
              <ol className="dx-rows is-plain">
                {selected.bestPages.map((p) => (
                  <li key={p.path} className="dx-row">
                    <span className="dx-row-main">
                      <span className="dx-row-top">
                        <b title={p.path}>{p.path}</b>
                        <span>{fmtPct(1 - p.exitRate, 0)} stay</span>
                      </span>
                    </span>
                  </li>
                ))}
              </ol>
            </div>
          )}
        </>
      )}

      {brokenLinks.length > 0 && (
        <div className="dx-device-sub">
          <h4>Links that may be broken</h4>
          <p className="dx-foot">
            A visitor clicked these but the page never showed up as loading — this isn't a confirmed server
            error, just a click that didn't visibly lead anywhere.
          </p>
          <ol className="dx-rows is-plain">
            {brokenLinks.slice(0, 6).map((l) => (
              <li key={l.id} className="dx-row">
                <span className="dx-row-main">
                  <span className="dx-row-top">
                    <b title={l.href}>{l.href}</b>
                    <span>{fmtNum(l.count)}×</span>
                  </span>
                  {l.fromPath && <small>from {l.fromPath}</small>}
                </span>
              </li>
            ))}
          </ol>
        </div>
      )}
    </Panel>
  );
}

/* ── API logs ──────────────────────────────────────────────────────
   Shows the account's recent server-to-server events (app/api/ingest
   — see lib/apiKeys.ts's header for the full "deep data" model) right
   on the dashboard, not just tucked away in Settings. Gated to Vento
   Plus (planId 'scale') and above: below that the panel still renders
   — same spot, same size — but as a soft-locked preview with an
   upsell, never just vanishing, because a visible-but-locked feature
   is what actually sells the upgrade. uid is optional only so this
   can be mounted before auth resolves; the hook itself handles null. */
function ApiLogsPreviewRow({ offset }: { offset: number }) {
  // Decorative only — the locked state's "ghost" rows behind the
  // blur, so the card reads as "a real feed, just hidden" rather than
  // a blank placeholder box.
  const widths = ['62%', '41%', '74%'];
  return (
    <div className="dx-api-row dx-api-row-ghost" style={{ opacity: 1 - offset * 0.22 }} aria-hidden="true">
      <span className="dx-api-dot" />
      <span className="dx-api-ghost-line" style={{ width: widths[offset % widths.length] }} />
      <span className="dx-api-ghost-pill" />
    </div>
  );
}

function formatApiEventTime(ts: ApiEvent['receivedAt']): string {
  if (!ts) return '';
  const d = typeof ts === 'number' ? new Date(ts) : ts.toDate();
  if (isNaN(d.getTime())) return '';
  return d.toLocaleString(undefined, { month: 'short', day: 'numeric', hour: 'numeric', minute: '2-digit' });
}

export function ApiLogsPanel({ uid, planId }: { uid: string | null; planId: PlanId | null }) {
  const unlocked = planId !== null && planMeetsMinimum(planId, 'scale');
  // Only subscribe once unlocked — a locked account has no business
  // reason to pay for a live Firestore listener it can't see the
  // results of, and the hook's own null-uid guard would otherwise
  // still spin up a subscription the instant a uid exists.
  const { liveEvents, loading } = useApiEvents(unlocked ? uid : null);
  const plusPlan = getPlan('scale');

  if (!unlocked) {
    return (
      <Panel className="dx-panel dx-api-logs is-locked-panel" title="API logs" hint="Live events from your own backend">
        <div className="dx-api-locked">
          <div className="dx-api-locked-visual" aria-hidden="true">
            <div className="dx-api-ghost-stack">
              <ApiLogsPreviewRow offset={0} />
              <ApiLogsPreviewRow offset={1} />
              <ApiLogsPreviewRow offset={2} />
            </div>
            <div className="dx-api-locked-badge">
              <svg viewBox="0 0 16 16" fill="none" aria-hidden="true">
                <rect x="3" y="7" width="10" height="7" rx="2" stroke="currentColor" strokeWidth="1.4" />
                <path d="M5.5 7V5a2.5 2.5 0 0 1 5 0v2" stroke="currentColor" strokeWidth="1.4" strokeLinecap="round" />
              </svg>
            </div>
          </div>

          <h4 className="dx-api-locked-title">See every event your backend sends, live</h4>
          <p className="dx-api-locked-copy">
            Orders, signups, refunds, CRM stage changes — anything your own server knows. Send it to the{' '}
            <code>/api/ingest</code> endpoint and watch it land here in real time, right next to your visit data.
          </p>

          <ul className="dx-api-locked-points">
            <li>Live feed of every event, the moment it's received</li>
            <li>Full payload — not just a name, the real data you sent</li>
            <li>Live + test keys, kept separate automatically</li>
          </ul>

          <NavLink href="/dashboard/plans" className="dx-link dx-api-upsell-link">
            Unlock API logs — upgrade to {plusPlan.name}
          </NavLink>
          <p className="dx-api-locked-foot">Requires {plusPlan.name} or above · not available on Starter</p>
        </div>
      </Panel>
    );
  }

  return (
    <Panel
      className="dx-panel dx-api-logs"
      title="API logs"
      hint="Live events from your own backend"
      action={
        <NavLink href="/settings/api" className="dx-link">
          Manage API keys
        </NavLink>
      }
    >
      {loading ? (
        <p className="dx-empty">Loading…</p>
      ) : liveEvents.length === 0 ? (
        <div className="dx-api-empty">
          <p className="dx-empty">No events yet.</p>
          <p className="dx-api-empty-sub">
            POST to <code>/api/ingest</code> with your live key and it’ll show up here instantly.
          </p>
        </div>
      ) : (
        <ol className="dx-rows is-plain dx-api-list">
          {liveEvents.slice(0, 8).map((ev) => {
            const dataKeys = Object.keys(ev.data || {});
            return (
              <li key={ev.id} className="dx-row dx-api-row">
                <span className="dx-row-main">
                  <span className="dx-row-top">
                    <b>{ev.event}</b>
                    <span>{formatApiEventTime(ev.receivedAt)}</span>
                  </span>
                  {(ev.userId || dataKeys.length > 0) && (
                    <small className="dx-api-row-sub">
                      {ev.userId ? ev.userId : ''}
                      {ev.userId && dataKeys.length > 0 ? ' · ' : ''}
                      {dataKeys.length > 0 ? `${dataKeys.slice(0, 3).join(', ')}${dataKeys.length > 3 ? '…' : ''}` : ''}
                    </small>
                  )}
                </span>
              </li>
            );
          })}
        </ol>
      )}
    </Panel>
  );
}

/* ── Visitor journey intelligence ──────────────────────────────────
   Where visitors land, where they go next, where they leave, and
   which specific sequences most often end in a lead — see
   lib/dashboardStats.ts's aggregateJourneys for the derivation and
   its honest limits (heuristic lead-to-session linking, capped step
   length). */
export function JourneyPanel({ journeys }: { journeys: JourneyIntelligence }) {
  const [tab, setTab] = useState<'common' | 'successful'>('common');
  const list = tab === 'common' ? journeys.topJourneys : journeys.successfulJourneys;

  return (
    <Panel
      className="dx-journeys"
      title="Visitor journeys"
      hint={`From ${fmtNum(journeys.sessionsWithJourney)} multi-page sessions`}
    >
      <div className="dx-mini-cols">
        <div>
          <h4>Where visitors land</h4>
          {journeys.entryPages.length === 0 ? (
            <p className="dx-empty">No data yet.</p>
          ) : (
            <ol className="dx-rows is-plain">
              {journeys.entryPages.slice(0, 5).map((r) => (
                <li key={r.label} className="dx-row">
                  <span className="dx-row-main">
                    <span className="dx-row-top">
                      <b title={r.label}>{r.label}</b>
                      <span>{fmtNum(r.count)}</span>
                    </span>
                  </span>
                </li>
              ))}
            </ol>
          )}
        </div>
        <div>
          <h4>Where visitors leave</h4>
          {journeys.exitPages.length === 0 ? (
            <p className="dx-empty">No data yet.</p>
          ) : (
            <ol className="dx-rows is-plain">
              {journeys.exitPages.slice(0, 5).map((r) => (
                <li key={r.label} className="dx-row">
                  <span className="dx-row-main">
                    <span className="dx-row-top">
                      <b title={r.label}>{r.label}</b>
                      <span>{fmtNum(r.count)}</span>
                    </span>
                  </span>
                </li>
              ))}
            </ol>
          )}
        </div>
      </div>

      <div className="dx-tabs" role="tablist" aria-label="Journey view">
        <button
          type="button"
          role="tab"
          aria-selected={tab === 'common'}
          className={tab === 'common' ? 'dx-tab is-on' : 'dx-tab'}
          onClick={() => setTab('common')}
        >
          Most common
        </button>
        <button
          type="button"
          role="tab"
          aria-selected={tab === 'successful'}
          className={tab === 'successful' ? 'dx-tab is-on' : 'dx-tab'}
          onClick={() => setTab('successful')}
        >
          Led to a lead
        </button>
      </div>

      {list.length === 0 ? (
        <p className="dx-empty">
          {tab === 'successful'
            ? 'No repeated journey has led to a lead yet in this period.'
            : 'Not enough multi-page sessions yet to show a pattern.'}
        </p>
      ) : (
        <ol className="dx-rows is-plain">
          {list.map((j, i) => (
            <li key={i} className="dx-row">
              <span className="dx-row-main">
                <span className="dx-row-top">
                  <b title={j.steps.join(' → ')}>{j.steps.join(' → ')}</b>
                  <span>
                    {fmtNum(j.count)}
                    {tab === 'successful' ? ` · ${fmtNum(j.ledToLeadCount)} led to a lead` : ''}
                  </span>
                </span>
              </span>
            </li>
          ))}
        </ol>
      )}
    </Panel>
  );
}

/* ── Behaviour: heatmap + engagement (clicks / CTR) ────────────── */
export function BehaviorPanel({
  data,
  agg,
  range,
  siteStats,
}: {
  data: DashboardData;
  agg: VisitAggregates;
  range: ResolvedRange;
  siteStats: { impressions: number; ctaClicks: number };
}) {
  const ad = adTotals(data, range);
  const clicksPerVisit = data.total > 0 ? agg.clicksTotal / data.total : null;
  const bannerCtr = siteStats.impressions > 0 ? siteStats.ctaClicks / siteStats.impressions : null;
  const adCtr = ad.impressions > 0 ? ad.clicks / ad.impressions : null;
  const peak = agg.heat.max > 0 ? `${DOW_LABELS[agg.heat.peakDow]} around ${hourLabel(agg.heat.peakHour)}` : null;

  return (
    <Panel
      title="When & how people engage"
      hint={peak ? `Busiest: ${peak}` : 'Your busiest hours show up here'}
      className="dx-behavior"
    >
      <div className="dx-behavior-grid">
        <HeatMap grid={agg.heat} />
        <dl className="dx-mini-stats">
          <div>
            <dt>Page clicks</dt>
            <dd>{fmtNum(agg.clicksTotal)}</dd>
            <small>{clicksPerVisit !== null ? `${fmtDecimal(clicksPerVisit, 2)} per visit` : 'per visit'}</small>
          </div>
          <div>
            <dt>Banner CTR</dt>
            <dd>{fmtPct(bannerCtr, 1)}</dd>
            <small>{fmtNum(siteStats.ctaClicks)} of {fmtNum(siteStats.impressions)} views · all time</small>
          </div>
          <div>
            <dt>Ad CTR</dt>
            <dd>{fmtPct(adCtr, 2)}</dd>
            <small>{fmtNum(ad.clicks)} of {fmtNum(ad.impressions)} ad views</small>
          </div>
          <div>
            <dt>Landing share</dt>
            <dd>{agg.loaded ? fmtPct(agg.landings / agg.loaded, 0) : '—'}</dd>
            <small>visits that started a session</small>
          </div>
          {/* Engagement summary trio — see lib/dashboardStats.ts's
              own comment on why these average only over visits that
              actually sent the app/api/visit-end beacon, not over
              every loaded visit. engagementSampleSize === 0 (no
              visitor on this site has produced the beacon yet — e.g.
              right after this feature ships) is shown as em dashes
              rather than 0%/0s, since 0 would misleadingly read as
              "measured and found to be zero." */}
          <div>
            <dt>Avg. scroll depth</dt>
            <dd>{agg.engagementSampleSize > 0 ? fmtPct((agg.avgScrollDepthPct ?? 0) / 100, 0) : '—'}</dd>
            <small>how far visitors actually scroll</small>
          </div>
          <div>
            <dt>Avg. active time</dt>
            <dd>{agg.engagementSampleSize > 0 ? fmtDuration(agg.avgActiveSec) : '—'}</dd>
            <small>tab actually in view, not just open</small>
          </div>
          <div>
            <dt>Valid clicks</dt>
            <dd>{agg.engagementSampleSize > 0 ? fmtNum(agg.validClicksTotal) : '—'}</dd>
            <small>human-paced clicks, bursts excluded</small>
          </div>
        </dl>
      </div>
    </Panel>
  );
}

/* ── Protection (blocked / restricted / bots) ──────────────────── */
export function ProtectionPanel({ data }: { data: DashboardData }) {
  const clean = data.total > 0 ? Math.max(0, 1 - data.blockedVisits / data.total) : null;
  const items = [
    { label: 'Bots stopped', value: `${fmtNum(data.botsStopped)}${data.botsCapped ? '+' : ''}`, tone: 'bad' },
    { label: 'Blocked visits', value: fmtNum(data.blockedVisits), tone: 'bad' },
    { label: 'Blocked users', value: fmtNum(data.blockedVisitors), tone: 'bad' },
    { label: 'Restricted now', value: fmtNum(data.restrictedVisitors), tone: 'warn' },
  ];
  return (
    <Panel
      className="dx-protect-panel"
      title="Protection"
      hint="Everything your site turned away"
      action={
        <NavLink href="/dashboard/bot-shield" className="dx-link">
          Open Security Bot
        </NavLink>
      }
    >
      <div className="dx-protect">
        <div className="dx-quality" role="img" aria-label={`Clean traffic ${fmtPct(clean, 0)}`}>
          <b>{fmtPct(clean, clean !== null && clean < 0.995 ? 1 : 0)}</b>
          <small>clean traffic</small>
        </div>
        <dl className="dx-mini-stats is-tight">
          {items.map((i) => (
            <div key={i.label} className={`is-${i.tone}`}>
              <dt>{i.label}</dt>
              <dd>{i.value}</dd>
            </div>
          ))}
        </dl>
      </div>
      <p className="dx-foot">
        {data.flaggedNetworks > 0
          ? `${fmtNum(data.flaggedNetworks)} visitor${data.flaggedNetworks === 1 ? '' : 's'} came from hosting or proxy networks.`
          : 'No visitors from hosting or proxy networks.'}
      </p>
    </Panel>
  );
}

/* ── Monetization (always shown; red when off) ─────────────────── */
function adTotals(data: DashboardData, range: ResolvedRange) {
  const startKey = range.start ? dayKey(range.start) : '0000-00-00';
  const endKey = dayKey(range.end);
  let revenue = 0;
  let impressions = 0;
  let clicks = 0;
  let lifetime = 0;
  const byDay: [string, number][] = [];
  for (const [k, v] of Object.entries(data.earnings)) {
    lifetime += v.earningsUsd || 0;
    if (k >= startKey && k < endKey) {
      revenue += v.earningsUsd || 0;
      impressions += v.impressions || 0;
      clicks += v.clicks || 0;
      byDay.push([k, v.earningsUsd || 0]);
    }
  }
  byDay.sort((a, b) => (a[0] < b[0] ? -1 : 1));
  return { revenue, impressions, clicks, lifetime, spark: byDay.map(([, n]) => n) };
}

export function MonetizationCard({
  data,
  range,
  config,
  verified,
}: {
  data: DashboardData;
  range: ResolvedRange;
  config: MonetizationConfig;
  verified: boolean;
}) {
  const ad = adTotals(data, range);
  const on = config.enabled;
  const ecpm = ad.impressions > 0 ? (ad.revenue / ad.impressions) * 1000 : null;
  return (
    <section className={on ? 'dx-panel dx-money is-on' : 'dx-panel dx-money is-off'}>
      {/* Same <header> → <div> fix as Panel's own head above. */}
      <div className="dx-panel-head">
        <div>
          <h2>Monetization</h2>
          <p>{on ? 'Earning from ads on this site' : verified ? 'Turned off — no ad revenue' : 'Verify your site to start earning'}</p>
        </div>
        <span className="dx-status">{on ? 'On' : 'Off'}</span>
      </div>

      <div className="dx-money-main">
        <div>
          <b>{fmtUsd(ad.revenue)}</b>
          <small>{range.label.toLowerCase()}</small>
        </div>
        {ad.spark.length > 1 && <Sparkline values={ad.spark} className="dx-spark" />}
      </div>

      <dl className="dx-money-stats">
        <div>
          <dt>Balance</dt>
          <dd>{fmtUsd(ad.lifetime)}</dd>
        </div>
        <div>
          <dt>Ad views</dt>
          <dd>{fmtNum(ad.impressions)}</dd>
        </div>
        <div>
          <dt>eCPM</dt>
          <dd>{ecpm !== null ? fmtUsd(ecpm) : '—'}</dd>
        </div>
      </dl>

      <NavLink href="/dashboard/monetization" className="dx-btn is-block">
        {on ? 'Open earnings' : verified ? 'Turn on monetization' : 'See how it works'}
      </NavLink>
    </section>
  );
}

/* ── Quick tools ───────────────────────────────────────────────── */
const PROMOTED_TOOL_IDS = [
  'ai-agent',
  'bot-shield',
  'widgets',
  'site-alert',
  'monetization',
  'advertise',
  'users',
];

export function QuickToolsPanel() {
  const tools = PROMOTED_TOOL_IDS.map((id) => QUICK_TOOL_OPTIONS.find((t) => t.id === id)).filter(
    (t): t is NonNullable<typeof t> => !!t && !!t.href
  );
  return (
    <Panel title="Quick tools" hint="Grow, protect and talk to your visitors" className="dx-tools-panel">
      <div className="dx-tools">
        {tools.map((t) => (
          <NavLink key={t.id} href={t.href as string} className={`dx-tool is-${t.tone}`}>
            <span className="dx-tool-icon">{t.icon}</span>
            <span className="dx-tool-text">
              <b>{t.name}</b>
              <small>{t.subtitle}</small>
            </span>
            <svg viewBox="0 0 24 24" className="dx-tool-go" aria-hidden="true">
              <path d="m9 6 6 6-6 6" fill="none" stroke="currentColor" strokeWidth="2.2" strokeLinecap="round" strokeLinejoin="round" />
            </svg>
          </NavLink>
        ))}
      </div>
    </Panel>
  );
}

/* ── Account: totals across every site + plan, limits, upsell ──── */
function UsageBar({ label, used, limit, resets }: { label: string; used: number; limit: number | null; resets?: string | null }) {
  const pct = limit && limit > 0 ? Math.min(100, (used / limit) * 100) : 0;
  const tone = pct >= 90 ? 'bad' : pct >= 70 ? 'warn' : 'ok';
  return (
    <div className="dx-usage">
      <div className="dx-usage-top">
        <span>{label}</span>
        <b>
          {fmtNum(used)} <small>/ {limit === null ? 'unlimited' : fmtNum(limit)}</small>
        </b>
      </div>
      <span className={`dx-bar is-${tone}`}>
        <i style={{ width: limit === null ? '4%' : `${Math.max(2, pct)}%` }} />
      </span>
      {resets && <small className="dx-usage-sub">Resets in {resets}</small>}
    </div>
  );
}

// Upgrade pill: sparkle icon + "Upgrade plan" + a price badge, matching
// the mockup's .upg button exactly (icon, label, separate `from $X/mo`
// pill) instead of the old plain-text "Upgrade to {name}" link that only
// rendered once an account was already pressed up against a limit. Always
// visible next to the section title now, like the mockup — not gated
// behind sitesAtLimit/tokenPct, since "upgrade" is a standing option, not
// a warning. `next` still comes from the same place (limits.nextPlanId);
// on the top plan there's nothing to upgrade to, so the button is omitted.
function UpgradeButton({ next }: { next: ReturnType<typeof getPlan> | null }) {
  if (!next) return null;
  return (
    <NavLink href="/dashboard/plans" className="dx-upg">
      <svg viewBox="0 0 16 16" fill="currentColor" aria-hidden="true">
        <path d="M8 1.5l1.7 4.3 4.3 1.7-4.3 1.7L8 13.5 6.3 9.2 2 7.5l4.3-1.7z" />
        <path d="M13 10.5l.6 1.4 1.4.6-1.4.6-.6 1.4-.6-1.4-1.4-.6 1.4-.6z" opacity={0.8} />
      </svg>
      <span>Upgrade plan</span>
      <span className="dx-upg-p">
        from <b>{next.priceDisplay}</b>/mo
      </span>
    </NavLink>
  );
}

export function AccountPanel({
  limits,
  totals,
  siteCount,
  allSitesVisits,
  verifiedCount,
}: {
  limits: AccountLimits | null;
  totals: AccountTotals | null;
  siteCount: number;
  allSitesVisits: number;
  verifiedCount: number;
}) {
  const resets = useCountdown(limits?.visitUsage.resetsAt);
  const next = limits?.nextPlanId ? getPlan(limits.nextPlanId as PlanId) : null;

  // Tokens and visits are both monthly allowances on the same reset
  // boundary (lib/visits.ts's monthly model) — shown with matching
  // "Resets in …" labels on their own bars below so that's visible at
  // a glance, not just once in the stat row above. tokenUsage still
  // comes from /api/site-limits exactly as today; only the display
  // here is new — no backend change in this pass.
  const tokenResets = resets;

  // One unified "All your sites" card — matches the mockup's single .sec
  // block (title + upgrade pill, a 4-up stat row, then usage bars —
  // Visits/Tokens/Sites/Emails) instead of splitting totals and plan
  // limits across two separate panels. "Visits, all sites" and "Usage
  // resets" fill the two stat slots the mockup shows that the old
  // two-panel version didn't surface together at all.
  return (
    <Panel
      title="All your sites"
      className="dx-account"
      action={<UpgradeButton next={next} />}
    >
      <dl className="dx-mini-stats dx-account-stats">
        <div>
          <dt>Connected</dt>
          <dd>{fmtNum(siteCount)}</dd>
        </div>
        <div>
          <dt>Verified</dt>
          <dd>{fmtNum(verifiedCount)}</dd>
        </div>
        <div>
          <dt>Visits, all sites</dt>
          <dd>{fmtNum(allSitesVisits)}</dd>
        </div>
        <div>
          <dt>Usage resets</dt>
          <dd>{resets ?? '—'}</dd>
        </div>
      </dl>

      {limits ? (
        <div className="dx-account-usage">
          <UsageBar label="Visits" used={limits.visitUsage.used} limit={limits.visitUsage.limit} resets={resets} />
          <UsageBar label="Tokens" used={limits.tokenUsage.used} limit={limits.tokenUsage.limit} resets={tokenResets} />
          <UsageBar label="Sites" used={limits.sitesUsed} limit={limits.sitesLimit} />
          <UsageBar label="Emails" used={totals ? totals.emails : 0} limit={null} />
        </div>
      ) : (
        <p className="dx-empty">Loading your plan…</p>
      )}
    </Panel>
  );
}

/* ── States ────────────────────────────────────────────────────── */
export function StateCard({
  title,
  body,
  actionLabel,
  onAction,
}: {
  title: string;
  body: string;
  actionLabel?: string;
  onAction?: () => void;
}) {
  return (
    <section className="dx-panel dx-state">
      <h2>{title}</h2>
      <p>{body}</p>
      {actionLabel && onAction && (
        <button type="button" className="dx-btn is-accent" onClick={onAction}>
          {actionLabel}
        </button>
      )}
    </section>
  );
}

export function SampleNote({ visible, loaded, total, since }: { visible: boolean; loaded: number; total: number; since: number | null }) {
  if (!visible) return null;
  return (
    <p className="dx-note">
      This period has {fmtNum(total)} visits. Totals above are exact; the chart and breakdowns use the newest{' '}
      {fmtNum(Math.min(loaded, VISIT_CAP))}
      {since ? ` (since ${new Date(since).toLocaleDateString(undefined, { month: 'short', day: 'numeric' })})` : ''}.
    </p>
  );
}

export function LiveFeed({ agg }: { agg: VisitAggregates }) {
  if (agg.recent.length === 0) return null;
  const now = Date.now();
  return (
    <ul className="dx-feed" aria-label="Latest visits">
      {agg.recent.slice(0, 4).map((v) => (
        <li key={v.id} className={v.blocked ? 'is-blocked' : undefined}>
          <span aria-hidden="true">{countryCodeToFlag(v.country)}</span>
          <b>{v.path}</b>
          <small>
            {v.device} · {v.browser} · {timeAgo(v.ts, now)}
            {v.blocked ? ' · blocked' : ''}
          </small>
        </li>
      ))}
    </ul>
  );
}
