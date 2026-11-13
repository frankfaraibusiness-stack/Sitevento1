'use client';

// components/plans/PlanCards.tsx
//
// The four plan cards. On a phone each card is a compact row (mascot,
// name, price, headline numbers) that drops down to the full list in
// place. On desktop all four sit side by side as compact cards; clicking
// one opens its full details in a fullscreen modal instead of expanding
// inline, so one tall card never stretches the others. Purely
// presentational: it gets the current plan and a choose callback from
// VentolPlans.
import { useEffect, useId, useState } from 'react';
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

// Must match the ".vpl-grid" 4-column breakpoint in ventol-plans.css.
// A laptop/desktop browser window very often sits in the 1024-1199px
// range (unmaximized, split-screen, devtools open) — leaving this at
// 1200px stranded those real desktop sessions in the tablet-style
// inline accordion below, where only one card's panel can be open at
// a time and opening a second shoves the others around. Keeping the
// JS and CSS breakpoints identical is what makes "four columns" and
// "modal instead of accordion" switch on together.
const DESKTOP_QUERY = '(min-width: 1024px)';

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

/** The pitch + fact groups + CTA, shared by the inline mobile panel and the desktop modal. */
function PlanDetails({ planId, current, locked, busy, direction, onChoose }: {
  planId: PlanId;
  current: boolean;
  locked: boolean;
  busy: boolean;
  direction: 'current' | 'up' | 'down';
  onChoose: () => void;
}) {
  const facts = PLAN_FACTS[planId];
  const plan = facts.plan;
  const cta = current
    ? 'Your current plan'
    : busy
      ? 'Switching…'
      : direction === 'down'
        ? `Switch to ${plan.name}`
        : `Get ${plan.name}`;

  return (
    <>
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
    </>
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
  // On desktop, cards never expand inline — a click opens the fullscreen modal instead.
  const expanded = !desktop && open;
  const panelId = `vpl-panel-${planId}`;
  const current = direction === 'current';
  const tag = current ? 'Your plan' : plan.featured ? 'Most popular' : null;

  return (
    <article
      className={`vpl-card${expanded ? ' is-open' : ''}${current ? ' is-current' : ''}`}
      data-plan={planId}
    >
      {tag && <span className="vpl-tag">{tag}</span>}
      <div className="vpl-surface" aria-hidden="true" />

      <button
        type="button"
        className="vpl-head"
        aria-expanded={desktop ? undefined : expanded}
        aria-haspopup={desktop ? 'dialog' : undefined}
        aria-controls={desktop ? undefined : panelId}
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

      {!desktop && (
        <div className="vpl-panel" id={panelId}>
          <div className="vpl-panel-in">
            <div className="vpl-panel-pad">
              <PlanDetails planId={planId} current={current} locked={locked} busy={busy} direction={direction} onChoose={onChoose} />
            </div>
          </div>
        </div>
      )}
    </article>
  );
}

/** Fullscreen desktop view of one plan, opened from its card. */
function PlanModal({ planId, direction, busy, locked, onChoose, onClose }: {
  planId: PlanId;
  direction: 'current' | 'up' | 'down';
  busy: boolean;
  locked: boolean;
  onChoose: () => void;
  onClose: () => void;
}) {
  const facts = PLAN_FACTS[planId];
  const plan = facts.plan;
  const current = direction === 'current';
  const tag = current ? 'Your plan' : plan.featured ? 'Most popular' : null;

  useEffect(() => {
    const onKey = (e: KeyboardEvent) => {
      if (e.key === 'Escape') onClose();
    };
    document.addEventListener('keydown', onKey);
    const prevOverflow = document.body.style.overflow;
    document.body.style.overflow = 'hidden';
    return () => {
      document.removeEventListener('keydown', onKey);
      document.body.style.overflow = prevOverflow;
    };
  }, [onClose]);

  return (
    <div className="vpl-modal-scrim" role="presentation" onClick={onClose}>
      <div
        className="vpl-modal-card"
        data-plan={planId}
        role="dialog"
        aria-modal="true"
        aria-label={plan.name}
        onClick={(e) => e.stopPropagation()}
      >
        <div className="vpl-surface" aria-hidden="true" />
        {tag && <span className="vpl-tag">{tag}</span>}

        <button type="button" className="vpl-modal-close" onClick={onClose} aria-label="Close">
          <svg viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth={3} strokeLinecap="round" strokeLinejoin="round" aria-hidden="true">
            <path d="M6 6l12 12M18 6L6 18" />
          </svg>
        </button>

        <div className="vpl-modal-scroll">
          <div className="vpl-modal-head">
            <Mascot id={planId} className="vpl-mascot" />
            <span className="vpl-name">{plan.name}</span>
            <span className="vpl-price">
              <b>{plan.priceDisplay}</b>
              <i>/mo</i>
            </span>
            <span className="vpl-chips">
              <span>{facts.visitsShort} visits/mo</span>
              <span>
                {facts.sites} site{facts.sites === 1 ? '' : 's'}
              </span>
            </span>
          </div>

          <div className="vpl-modal-body">
            <PlanDetails planId={planId} current={current} locked={locked} busy={busy} direction={direction} onChoose={onChoose} />
          </div>
        </div>
      </div>
    </div>
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
  const [modalId, setModalId] = useState<PlanId | null>(null);
  const currentIndex = currentId ? PLANS.findIndex((p) => p.id === currentId) : -1;

  // Leaving desktop width (e.g. resizing down) with the modal open would strand
  // it open behind the now-inline cards, so close it when the layout switches.
  useEffect(() => {
    if (!desktop) setModalId(null);
  }, [desktop]);

  const directionFor = (i: number) => (currentIndex === -1 ? 'up' : i === currentIndex ? 'current' : i < currentIndex ? 'down' : 'up');

  return (
    <>
      <div className="vpl-grid">
        {PLANS.map((p, i) => (
          <PlanCard
            key={p.id}
            planId={p.id}
            index={i}
            direction={directionFor(i)}
            open={!!openIds[p.id]}
            desktop={desktop}
            busy={busyId === p.id}
            locked={currentId === null || busyId !== null}
            onToggle={() =>
              desktop
                ? setModalId(p.id)
                : setOpenIds((prev) => ({ ...prev, [p.id]: !prev[p.id] }))
            }
            onChoose={() => onChoose(p.id)}
          />
        ))}
      </div>

      {desktop && modalId && (
        <PlanModal
          planId={modalId}
          direction={directionFor(PLANS.findIndex((p) => p.id === modalId))}
          busy={busyId === modalId}
          locked={currentId === null || busyId !== null}
          onChoose={() => {
            onChoose(modalId);
            setModalId(null);
          }}
          onClose={() => setModalId(null)}
        />
      )}
    </>
  );
}
