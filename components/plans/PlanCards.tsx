'use client';

// components/plans/PlanCards.tsx
//
// The four plan cards. On a phone each card is a compact row (mascot,
// name, price, headline numbers) that drops down to the full list; on
// desktop all four sit side by side, already open. Purely presentational:
// it gets the current plan and a choose callback from VentolPlans.
import { useEffect, useId, useState, type CSSProperties } from 'react';
import { PLANS, type PlanId } from '@/lib/plans';
import { PLAN_FACTS, type FactState, type PlanFacts } from './planFacts';
import { MASCOTS } from './mascots';

// Each mascot pitches its own plan. Numbers come from the facts, never typed in.
const PITCH: Record<PlanId, (f: PlanFacts) => string> = {
  free: (f) =>
    `Hi, I’m ${MASCOTS.free.name}! Get ${f.sites} site live in minutes with ${f.visitsFull} visits a month. No credit card, no catch.`,
  starter: (f) =>
    `I’m ${MASCOTS.starter.name}! I unlock visitor blocking, live overlays and the Ventol+ AI model, on up to ${f.sites} sites.`,
  scale: (f) =>
    `${MASCOTS.scale.name} here! Webhooks, session replay, A/B tests and ${f.visitsShort} visits a month for teams running a portfolio.`,
  'pro-developer': (f) =>
    `${MASCOTS['pro-developer'].name} at your service. ${f.visitsShort} visits, ${f.sites} sites, custom CSS, the advanced rule engine and a dedicated contact.`,
};

const DESKTOP_QUERY = '(min-width: 1200px)';

function useIsDesktop(): boolean {
  const [desktop, setDesktop] = useState(false);
  useEffect(() => {
    const mq = window.matchMedia(DESKTOP_QUERY);
    const sync = () => setDesktop(mq.matches);
    sync();
    mq.addEventListener('change', sync);
    return () => mq.removeEventListener('change', sync);
  }, []);
  return desktop;
}

function Mascot({ id, className }: { id: PlanId; className: string }) {
  const uid = useId().replace(/[^a-zA-Z0-9]/g, '');
  return (
    <span
      className={className}
      aria-hidden="true"
      dangerouslySetInnerHTML={{ __html: MASCOTS[id].render(uid) }}
    />
  );
}

function StateIcon({ state }: { state: FactState }) {
  const common = {
    viewBox: '0 0 24 24',
    fill: 'none',
    stroke: 'currentColor',
    strokeWidth: 3,
    strokeLinecap: 'round' as const,
    strokeLinejoin: 'round' as const,
    'aria-hidden': true,
    className: 'vpl-ico',
  };
  if (state === 'yes') {
    return (
      <svg {...common}>
        <path d="M5 12.5l4.5 4.5L19 7.5" />
      </svg>
    );
  }
  if (state === 'trial') {
    return (
      <svg {...common} strokeWidth={2.6}>
        <circle cx="12" cy="12" r="8.5" />
        <path d="M12 7.5V12l3 2" />
      </svg>
    );
  }
  return (
    <svg {...common}>
      <path d="M7 7l10 10M17 7L7 17" />
    </svg>
  );
}

interface PlanCardProps {
  planId: PlanId;
  index: number;
  direction: 'current' | 'up' | 'down';
  open: boolean;
  desktop: boolean;
  busy: boolean;
  locked: boolean;
  onToggle: () => void;
  onChoose: () => void;
}

function PlanCard({ planId, index, direction, open, desktop, busy, locked, onToggle, onChoose }: PlanCardProps) {
  const facts = PLAN_FACTS[planId];
  const plan = facts.plan;
  const expanded = open || desktop;
  const panelId = `vpl-panel-${planId}`;
  const current = direction === 'current';
  const tag = current ? 'Your plan' : plan.featured ? 'Most popular' : null;

  const cta = current
    ? 'Your current plan'
    : busy
      ? 'Switching…'
      : direction === 'down'
        ? `Switch to ${plan.name}`
        : `Get ${plan.name}`;

  return (
    <article
      className={`vpl-card${expanded ? ' is-open' : ''}${current ? ' is-current' : ''}`}
      data-plan={planId}
      style={{ '--sheen-delay': `${index * 1.4}s` } as CSSProperties}
    >
      {tag && <span className="vpl-tag">{tag}</span>}
      <div className="vpl-surface" aria-hidden="true" />

      <button
        type="button"
        className="vpl-head"
        aria-expanded={expanded}
        aria-controls={panelId}
        tabIndex={desktop ? -1 : 0}
        onClick={onToggle}
      >
        <Mascot id={planId} className="vpl-mascot" />
        <span className="vpl-id">
          <span className="vpl-name">{plan.name}</span>
          <span className="vpl-chips">
            <span>{facts.visitsShort} visits/mo</span>
            <span>
              {facts.sites} site{facts.sites === 1 ? '' : 's'}
            </span>
          </span>
        </span>
        <span className="vpl-price">
          <b>{plan.priceDisplay}</b>
          <i>/mo</i>
        </span>
        <svg className="vpl-chev" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth={3} strokeLinecap="round" strokeLinejoin="round" aria-hidden="true">
          <path d="M6 9l6 6 6-6" />
        </svg>
      </button>

      <div className="vpl-panel" id={panelId}>
        <div className="vpl-panel-in">
          <div className="vpl-panel-pad">
            <div className="vpl-pitch">
              <Mascot id={planId} className="vpl-mascot vpl-mascot-lg" />
              <p className="vpl-bubble">{PITCH[planId](facts)}</p>
            </div>

            {facts.groups.map((group) => (
              <section className="vpl-group" key={group.title}>
                <h4>{group.title}</h4>
                <ul>
                  {group.facts.map((fact) => (
                    <li className="vpl-row" data-state={fact.state} key={fact.label}>
                      <StateIcon state={fact.state} />
                      <span className="vpl-label">{fact.label}</span>
                      <span className="vpl-value">{fact.value}</span>
                    </li>
                  ))}
                </ul>
              </section>
            ))}

            <button type="button" className="vpl-cta" disabled={current || locked} onClick={onChoose}>
              {cta}
            </button>
          </div>
        </div>
      </div>
    </article>
  );
}

interface PlanCardsProps {
  /** The signed-in account's plan, or null until it has loaded. */
  currentId: PlanId | null;
  /** Plan currently being switched to, if any. */
  busyId: PlanId | null;
  onChoose: (id: PlanId) => void;
}

export function PlanCards({ currentId, busyId, onChoose }: PlanCardsProps) {
  const desktop = useIsDesktop();
  const [openIds, setOpenIds] = useState<Partial<Record<PlanId, boolean>>>({});
  const currentIndex = currentId ? PLANS.findIndex((p) => p.id === currentId) : -1;

  return (
    <div className="vpl-grid">
      {PLANS.map((p, i) => (
        <PlanCard
          key={p.id}
          planId={p.id}
          index={i}
          direction={currentIndex === -1 ? 'up' : i === currentIndex ? 'current' : i < currentIndex ? 'down' : 'up'}
          open={!!openIds[p.id]}
          desktop={desktop}
          busy={busyId === p.id}
          locked={currentId === null || busyId !== null}
          onToggle={() => setOpenIds((prev) => ({ ...prev, [p.id]: !prev[p.id] }))}
          onChoose={() => onChoose(p.id)}
        />
      ))}
    </div>
  );
}
