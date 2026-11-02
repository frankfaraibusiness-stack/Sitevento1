'use client';

// components/marketing/HowItWorksModal.tsx
//
// Full-screen "How it works" explainer, opened from Hero's secondary
// CTA (previously just scrolled to the #how-it-works strip further
// down the page — that strip stays as a teaser, this modal is the
// real explanation). Built as a left-rail "tour" rather than a
// centered dialog: on desktop the content uses the available width
// (rail + content column, not a 760px card floating in a sea of
// backdrop) and on phone/tablet the rail collapses into a horizontal
// scroll-snap tab strip above the content. Same cartoonic ink-outline
// design language as the AI Agent page (styles/agent/agent-page.css)
// and the widget picker (styles/widgets/widgets-page.css): cream
// surfaces, 2px ink borders, flat sticker-shadow offsets, Georgia
// serif headlines over -apple-system body copy.
//
// Content is the real product, not generic marketing copy: the one
// <meta name="sitevento"> tag (see lib/agent.ts's header comment —
// there is deliberately no second snippet for anything else the app
// does), live visit/unique-visitor tracking (VisitLogPanel,
// OverviewStats), per-visitor block + *timed* restrict (see
// app/api/user-action/route.ts's 'restrict-visitor' action and its
// restrictedUntil field — genuinely different from a permanent block),
// widgets pushed from the dashboard with no redeploy, system alerts
// (SiteAlertsPanel), and visitor/user management (UsersPage). Every
// claim here maps to a real feature already in the app.
import { useEffect, useRef, useState } from 'react';

interface HowItWorksModalProps {
  open: boolean;
  onClose: () => void;
  onConnectClick: () => void;
}

type SectionId = 'tag' | 'tracking' | 'control' | 'widgets' | 'alerts' | 'users';

interface Section {
  id: SectionId;
  navLabel: string;
  kicker: string;
  title: string;
  lede: string;
}

const SECTIONS: Section[] = [
  {
    id: 'tag',
    navLabel: 'The one tag',
    kicker: 'Step one, and the only install step',
    title: 'One tag. Pasted once. Nothing else to deploy, ever.',
    lede:
      "Most site tools make you install a widget for chat, a different snippet for analytics, and a third for A/B tests. Sitevento is one meta tag in your <head>. Every other feature — tracking, widgets, alerts, visitor controls — runs through that same tag, so turning something new on is a toggle in your dashboard, never a second deploy.",
  },
  {
    id: 'tracking',
    navLabel: 'Visits & visitors',
    kicker: 'Live from the moment the tag verifies',
    title: 'Every visit, every unique visitor, in real time.',
    lede:
      'The instant your tag goes live, Sitevento starts logging page views and recognizing unique visitors by device — even across sessions, even if they clear cookies. You get a running log, not a once-a-day report.',
  },
  {
    id: 'control',
    navLabel: 'Block & restrict',
    kicker: "What makes Sitevento different",
    title: 'Block for good, or restrict for exactly as long as you choose.',
    lede:
      "This is the thing most site tools can't do at all: a block is permanent, but a restriction has a clock on it. Mute a visitor for an hour while you sort out an abuse report, or a week while a dispute gets resolved — it lifts itself automatically, no follow-up reminder to go undo it.",
  },
  {
    id: 'widgets',
    navLabel: 'Widgets',
    kicker: 'Dropped live, no redeploy',
    title: 'Turn a widget on and it’s just there — on every page, instantly.',
    lede:
      'Countdown bars, contact forms, spin-to-win rewards, campaign banners — pick one from the catalog, style it to match your site, and switch it on. It appears on your live site through the same tag you already installed. Switch it off just as fast.',
  },
  {
    id: 'alerts',
    navLabel: 'System alerts',
    kicker: 'So you hear about trouble first',
    title: 'Alerts that reach you before a visitor has to.',
    lede:
      "Site down, traffic spike, suspicious activity — Sitevento watches your connected sites and pushes an alert the moment something needs your attention, with a threshold you control: everything, spikes only, or errors only.",
  },
  {
    id: 'users',
    navLabel: 'Users & team',
    kicker: 'Every visitor, and every teammate',
    title: 'One list of every visitor you’ve ever had, and who on your team can touch it.',
    lede:
      "Country, first seen, last seen, and one-tap restrict, block, message, or delete — right from the visitor list. Add teammates with their own sign-in so you're not the only one who can run the dashboard.",
  },
];

function TagIcon() {
  return (
    <svg viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth={2} strokeLinecap="round" strokeLinejoin="round">
      <path d="M12 2 2 12l10 10 10-10-10-10z" />
      <circle cx="12" cy="12" r="2.4" fill="currentColor" stroke="none" />
    </svg>
  );
}
function PulseIcon() {
  return (
    <svg viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth={2} strokeLinecap="round" strokeLinejoin="round">
      <path d="M3 12h4l2.5-7 4 14L17 12h4" />
    </svg>
  );
}
function ShieldIcon() {
  return (
    <svg viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth={2} strokeLinecap="round" strokeLinejoin="round">
      <path d="M12 3 4 6v6c0 5 3.5 8 8 9 4.5-1 8-4 8-9V6l-8-3z" />
      <path d="M9.5 12.5l2 2 3.5-4" />
    </svg>
  );
}
function WidgetIcon() {
  return (
    <svg viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth={2} strokeLinecap="round" strokeLinejoin="round">
      <rect x="3" y="3" width="8" height="8" rx="2" />
      <rect x="13" y="3" width="8" height="8" rx="2" />
      <rect x="3" y="13" width="8" height="8" rx="2" />
      <circle cx="17" cy="17" r="4" />
    </svg>
  );
}
function BellIcon() {
  return (
    <svg viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth={2} strokeLinecap="round" strokeLinejoin="round">
      <path d="M18 8A6 6 0 0 0 6 8c0 7-3 9-3 9h18s-3-2-3-9" />
      <circle cx="12" cy="3" r="1.5" />
      <path d="M9.5 20a2.5 2.5 0 0 0 5 0" />
    </svg>
  );
}
function UsersIcon() {
  return (
    <svg viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth={2} strokeLinecap="round" strokeLinejoin="round">
      <circle cx="9" cy="8" r="3.4" />
      <path d="M2.5 20c0-3.6 2.9-6 6.5-6s6.5 2.4 6.5 6" />
      <circle cx="18" cy="8.5" r="2.6" />
      <path d="M15.3 14.3c2.9.4 5.2 2.5 5.2 5.7" />
    </svg>
  );
}

const SECTION_ICON: Record<SectionId, () => JSX.Element> = {
  tag: TagIcon,
  tracking: PulseIcon,
  control: ShieldIcon,
  widgets: WidgetIcon,
  alerts: BellIcon,
  users: UsersIcon,
};

// ---- Section visuals: a small live-feeling diagram per section, built
// from real markup/CSS (no stock illustration), each illustrating the
// actual mechanic rather than decorating the text. ----

function TagVisual() {
  const [typed, setTyped] = useState(0);
  const [verified, setVerified] = useState(false);
  const snippet = '<meta name="sitevento" content="…">';
  useEffect(() => {
    setTyped(0);
    setVerified(false);
    const stepMs = 34;
    const typeTimer = setInterval(() => {
      setTyped((c) => {
        if (c >= snippet.length) {
          clearInterval(typeTimer);
          return c;
        }
        return c + 1;
      });
    }, stepMs);
    const verifyTimer = setTimeout(() => setVerified(true), snippet.length * stepMs + 500);
    return () => {
      clearInterval(typeTimer);
      clearTimeout(verifyTimer);
    };
  }, []);
  return (
    <div className="hiw-visual hiw-visual-tag">
      <div className="hiw-code-card">
        <div className="hiw-code-dots">
          <span />
          <span />
          <span />
        </div>
        <code className="hiw-code-line">
          {snippet.slice(0, typed)}
          <span className="hiw-caret" />
        </code>
      </div>
      <div className={`hiw-verify-pill${verified ? ' is-live' : ''}`}>
        <span className="hiw-verify-dot" />
        {verified ? 'Tag verified — tracking live' : 'Waiting for tag…'}
      </div>
    </div>
  );
}

function TrackingVisual() {
  const [visits, setVisits] = useState(128);
  const [uniques, setUniques] = useState(41);
  const [pulse, setPulse] = useState(false);
  useEffect(() => {
    const interval = setInterval(() => {
      setVisits((v) => v + 1 + Math.floor(Math.random() * 2));
      if (Math.random() > 0.55) setUniques((u) => u + 1);
      setPulse(true);
      setTimeout(() => setPulse(false), 260);
    }, 1100);
    return () => clearInterval(interval);
  }, []);
  return (
    <div className="hiw-visual hiw-visual-tracking">
      <div className={`hiw-stat-tile${pulse ? ' is-pulsing' : ''}`}>
        <span className="hiw-stat-label">Visits today</span>
        <span className="hiw-stat-num">{visits.toLocaleString()}</span>
      </div>
      <div className="hiw-stat-tile">
        <span className="hiw-stat-label">Unique visitors</span>
        <span className="hiw-stat-num">{uniques.toLocaleString()}</span>
      </div>
      <div className="hiw-live-row">
        <span className="hiw-live-dot" />
        Streaming live — no refresh needed
      </div>
    </div>
  );
}

function ControlVisual() {
  const [mode, setMode] = useState<'block' | 'restrict'>('restrict');
  return (
    <div className="hiw-visual hiw-visual-control">
      <div className="hiw-control-toggle" role="tablist" aria-label="Block or restrict">
        <button type="button" className={mode === 'restrict' ? 'is-active' : ''} onClick={() => setMode('restrict')}>
          Restrict
        </button>
        <button type="button" className={mode === 'block' ? 'is-active' : ''} onClick={() => setMode('block')}>
          Block
        </button>
      </div>
      {mode === 'restrict' ? (
        <div className="hiw-restrict-card">
          <div className="hiw-restrict-row">
            <span className="hiw-visitor-dot" />
            Visitor #4821
            <span className="hiw-badge hiw-badge-restricted">Restricted 24h</span>
          </div>
          <div className="hiw-restrict-timer">
            <div className="hiw-restrict-bar">
              <span style={{ width: '62%' }} />
            </div>
            <span className="hiw-restrict-time">Lifts automatically in 9h 12m</span>
          </div>
        </div>
      ) : (
        <div className="hiw-restrict-card">
          <div className="hiw-restrict-row">
            <span className="hiw-visitor-dot hiw-visitor-dot-blocked" />
            Visitor #4821
            <span className="hiw-badge hiw-badge-blocked">Blocked</span>
          </div>
          <p className="hiw-control-note">Blocked for good — until you choose to unblock them yourself.</p>
        </div>
      )}
    </div>
  );
}

function WidgetsVisual() {
  const widgets = [
    { name: 'Countdown bar', live: true },
    { name: 'Spin to win', live: true },
    { name: 'Contact form', live: false },
    { name: 'Campaign banner', live: false },
  ];
  return (
    <div className="hiw-visual hiw-visual-widgets">
      <div className="hiw-widget-grid">
        {widgets.map((w) => (
          <div key={w.name} className={`hiw-widget-chip${w.live ? ' is-live' : ''}`}>
            <span className="hiw-widget-chip-name">{w.name}</span>
            <span className={`hiw-widget-chip-status${w.live ? ' is-live' : ''}`}>{w.live ? 'Live' : 'Off'}</span>
          </div>
        ))}
      </div>
      <p className="hiw-control-note">Flip one on — it appears on your site immediately, through the tag you already have.</p>
    </div>
  );
}

function AlertsVisual() {
  const [items, setItems] = useState([
    { id: 1, label: 'Traffic spike on checkout page', tone: 'spike' },
  ]);
  const nextId = useRef(2);
  useEffect(() => {
    const pool = [
      { label: 'Site responded slowly for 30s', tone: 'warn' },
      { label: 'New restricted visitor returned', tone: 'spike' },
      { label: 'Unusual signup pattern flagged', tone: 'warn' },
    ];
    const interval = setInterval(() => {
      const next = pool[Math.floor(Math.random() * pool.length)];
      const id = nextId.current++;
      setItems((prev) => [{ id, ...next }, ...prev].slice(0, 3));
    }, 2600);
    return () => clearInterval(interval);
  }, []);
  return (
    <div className="hiw-visual hiw-visual-alerts">
      <ul className="hiw-alert-list">
        {items.map((it, i) => (
          <li key={it.id} className={`hiw-alert-item hiw-alert-${it.tone}${i === 0 ? ' is-newest' : ''}`}>
            <span className="hiw-alert-dot" />
            {it.label}
          </li>
        ))}
      </ul>
      <p className="hiw-control-note">Threshold is yours: everything, spikes only, or errors only.</p>
    </div>
  );
}

function UsersVisual() {
  const rows = [
    { country: '🇺🇸', seen: 'Active 2m ago', action: 'Restrict' },
    { country: '🇬🇧', seen: 'Active 1h ago', action: 'Message' },
    { country: '🇿🇦', seen: 'Active 4h ago', action: 'Block' },
  ];
  return (
    <div className="hiw-visual hiw-visual-users">
      <div className="hiw-user-list">
        {rows.map((r, i) => (
          <div className="hiw-user-row" key={i}>
            <span className="hiw-user-flag" aria-hidden="true">
              {r.country}
            </span>
            <span className="hiw-user-seen">{r.seen}</span>
            <span className="hiw-user-action">{r.action}</span>
          </div>
        ))}
      </div>
      <p className="hiw-control-note">One list for every visitor you&apos;ve ever had — plus teammates who can act on it with you.</p>
    </div>
  );
}

const SECTION_VISUAL: Record<SectionId, () => JSX.Element> = {
  tag: TagVisual,
  tracking: TrackingVisual,
  control: ControlVisual,
  widgets: WidgetsVisual,
  alerts: AlertsVisual,
  users: UsersVisual,
};

export function HowItWorksModal({ open, onClose, onConnectClick }: HowItWorksModalProps) {
  const [activeId, setActiveId] = useState<SectionId>('tag');
  const sectionRefs = useRef<Partial<Record<SectionId, HTMLElement | null>>>({});
  const scrollRef = useRef<HTMLDivElement>(null);
  const closeRef = useRef<HTMLButtonElement>(null);

  // Lock body scroll while open, same convention as the app's other
  // overlays (AuthOverlay/Sidebar/UpsellOverlay — see
  // styles/base/app-skeleton.css's comment on .app-skel-full).
  useEffect(() => {
    if (!open) return;
    const prev = document.body.style.overflow;
    document.body.style.overflow = 'hidden';
    setActiveId('tag');
    scrollRef.current?.scrollTo({ top: 0 });
    closeRef.current?.focus();
    return () => {
      document.body.style.overflow = prev;
    };
  }, [open]);

  // Esc to close.
  useEffect(() => {
    if (!open) return;
    function onKey(e: KeyboardEvent) {
      if (e.key === 'Escape') onClose();
    }
    window.addEventListener('keydown', onKey);
    return () => window.removeEventListener('keydown', onKey);
  }, [open, onClose]);

  // Scroll-spy: highlight the rail/tab item for whichever section is
  // most visible in the scrolling content column.
  useEffect(() => {
    if (!open) return;
    const root = scrollRef.current;
    if (!root) return;
    const observer = new IntersectionObserver(
      (entries) => {
        entries.forEach((entry) => {
          if (entry.isIntersecting) {
            const id = entry.target.getAttribute('data-section-id') as SectionId | null;
            if (id) setActiveId(id);
          }
        });
      },
      { root, threshold: 0.35, rootMargin: '-10% 0px -40% 0px' }
    );
    SECTIONS.forEach((s) => {
      const el = sectionRefs.current[s.id];
      if (el) observer.observe(el);
    });
    return () => observer.disconnect();
  }, [open]);

  function goTo(id: SectionId) {
    sectionRefs.current[id]?.scrollIntoView({ behavior: 'smooth', block: 'start' });
  }

  if (!open) return null;

  return (
    <div className="hiw-backdrop" role="presentation" onMouseDown={(e) => e.target === e.currentTarget && onClose()}>
      <div className="hiw-modal" role="dialog" aria-modal="true" aria-labelledby="hiw-title">
        <header className="hiw-topbar">
          <div className="hiw-topbar-brand">
            <span className="hiw-topbar-tag" aria-hidden="true">
              <TagIcon />
            </span>
            <div className="hiw-topbar-text">
              <span className="hiw-topbar-eyebrow">How Sitevento works</span>
              <h2 id="hiw-title">One tag. Full control of your site.</h2>
            </div>
          </div>
          <button ref={closeRef} type="button" className="hiw-close" onClick={onClose} aria-label="Close">
            <svg viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth={2.3} strokeLinecap="round" strokeLinejoin="round">
              <path d="M6 6l12 12M18 6L6 18" />
            </svg>
          </button>
        </header>

        <div className="hiw-body">
          <nav className="hiw-rail" aria-label="Sections">
            {SECTIONS.map((s, i) => {
              const Icon = SECTION_ICON[s.id];
              return (
                <button
                  key={s.id}
                  type="button"
                  className={`hiw-rail-item${activeId === s.id ? ' is-active' : ''}`}
                  onClick={() => goTo(s.id)}
                  aria-current={activeId === s.id}
                >
                  <span className="hiw-rail-num">{String(i + 1).padStart(2, '0')}</span>
                  <span className="hiw-rail-icon">
                    <Icon />
                  </span>
                  <span className="hiw-rail-label">{s.navLabel}</span>
                </button>
              );
            })}

            <div className="hiw-rail-footer">
              <p>Ready to try it on your own site?</p>
              <button
                type="button"
                className="hiw-rail-cta"
                onClick={() => {
                  onClose();
                  onConnectClick();
                }}
              >
                Connect your site
                <span aria-hidden="true">→</span>
              </button>
            </div>
          </nav>

          <div className="hiw-content" ref={scrollRef}>
            {SECTIONS.map((s, i) => {
              const Visual = SECTION_VISUAL[s.id];
              return (
                <section
                  key={s.id}
                  className="hiw-section"
                  data-section-id={s.id}
                  ref={(el) => {
                    sectionRefs.current[s.id] = el;
                  }}
                >
                  <div className="hiw-section-copy">
                    <p className="hiw-section-kicker">{s.kicker}</p>
                    <h3 className="hiw-section-title">{s.title}</h3>
                    <p className="hiw-section-lede">{s.lede}</p>
                    {i === 2 && (
                      <ul className="hiw-compare">
                        <li>
                          <strong>Block</strong> — permanent, until you personally undo it.
                        </li>
                        <li>
                          <strong>Restrict</strong> — set a duration, it lifts itself. No reminders, no forgetting about it.
                        </li>
                      </ul>
                    )}
                  </div>
                  <div className="hiw-section-visual">
                    <Visual />
                  </div>
                </section>
              );
            })}

            <footer className="hiw-end">
              <h4>That&apos;s the whole system.</h4>
              <p>One tag feeds tracking, widgets, alerts, and visitor control — nothing else to install, ever.</p>
              <button
                type="button"
                className="hiw-end-cta"
                onClick={() => {
                  onClose();
                  onConnectClick();
                }}
              >
                Connect your site
                <span aria-hidden="true">→</span>
              </button>
            </footer>
          </div>
        </div>
      </div>
    </div>
  );
}
