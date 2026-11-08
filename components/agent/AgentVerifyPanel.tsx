'use client';

// components/agent/AgentVerifyPanel.tsx
//
// Tells the owner, honestly, how the agent actually runs — see
// lib/agent.ts's "Persistence & execution" header comment. There is
// no second tag to install: public/sitevento.js is already on the
// page (installed once, at connect time) and already calls home on
// every pageview, so turning features on here is the entire
// "install" step. This panel exists so that fact is visible on the
// page itself rather than left implicit, especially for a site that
// hasn't completed verification yet (verify-site/route.ts) — in that
// case the agent is configured but genuinely won't run anything,
// same honesty app/api/site-widget/route.ts already applies to
// widgets via its liveStatus field.
import type { Site } from '@/lib/types';

interface AgentVerifyPanelProps {
  site: Site;
}

export function AgentVerifyPanel({ site }: AgentVerifyPanelProps) {
  const verified = site.status === 'verified';

  return (
    <section className="agt-verify">
      <div className={`agt-verify-badge${verified ? ' is-verified' : ''}`}>
        <svg viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth={2.2}>
          {verified ? <path d="m9 12 2 2 4-4" /> : <circle cx="12" cy="12" r="9" />}
          <circle cx="12" cy="12" r="9" />
        </svg>
      </div>
      <div className="agt-verify-copy">
        <h5>{verified ? 'Already wired up — nothing new to install' : 'Finish verifying your site first'}</h5>
        <p>
          {verified ? (
            <>
              Your agent runs through the same install tag already on <strong>{site.url || site.name}</strong>. No
              second script, no extra copy-paste — every feature you turn on below takes effect the next time your
              site checks in.
            </>
          ) : (
            <>
              Your agent uses the same tracking tag as the rest of sitevento — once <strong>{site.url || site.name}</strong>{' '}
              finishes verification from your dashboard, every feature you enable here starts working automatically.
            </>
          )}
        </p>
      </div>
    </section>
  );
}
