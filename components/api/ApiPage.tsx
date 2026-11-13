'use client';

// components/api/ApiPage.tsx
//
// /dashboard/api — where an owner connects their BACKEND to sitevento.
//
// The embedded script measures everything a browser can see. What only the
// owner's server knows — subscriptions and plan prices, orders and product
// prices, expenses, sign-ups, logins — arrives by API. This page is the
// control room for that:
//   1  API keys               (real: live/test keys, reveal, copy, regenerate)
//   2  What the key may send  (real: saved per startup, enforced by /api/ingest)
//   3  Send a first event     (real: live status of events as they arrive)
//   4  What can't be written  (traffic stays script-only, always)
//
// Shares the Analytics page's look (anx- tokens, header, startup switcher) and
// adds its own apx- classes (styles/api/api-page.css).
import { useCallback, useEffect, useRef, useState, type CSSProperties, type ReactNode } from 'react';
import type { User } from 'firebase/auth';
import type { Site } from '@/lib/types';
import { callUserAction } from '@/lib/userActionClient';
import { useAccountApiKeys } from '@/hooks/useAccountApiKeys';
import { AnalyticsSiteSwitcher } from '@/components/analytics/AnalyticsSiteSwitcher';
import { firstNameOf, siteHost } from '@/components/analytics/analyticsUtils';
import { ApiKeysCard, type KeyKind } from './ApiKeysCard';
import { ApiPermissions } from './ApiPermissions';
import { ApiQuickstart } from './ApiQuickstart';
import { ApiReserved } from './ApiReserved';
import { ApiIcon } from './apiIcons';
import { useCopy } from './useCopy';

const delay = (ms: number) => ({ '--d': `${ms}ms` }) as CSSProperties;

interface Props {
  user: User;
  sites: Site[];
  activeSiteId: string | null;
  setActiveSiteId: (siteId: string) => void;
  activeSite: Site | null;
  onOpenAddSiteModal: () => void;
}

function Step({ n, title, note, children, aside }: { n: number; title: string; note: string; children: ReactNode; aside?: ReactNode }) {
  return (
    <section className="apx-step" aria-labelledby={`apx-step-${n}`}>
      <header className="apx-step-head">
        <span className="apx-step-n" aria-hidden="true">{n}</span>
        <div>
          <h2 id={`apx-step-${n}`}>{title}</h2>
          <p>{note}</p>
        </div>
        {aside}
      </header>
      {children}
    </section>
  );
}

export function ApiPage({ user, sites, activeSiteId, setActiveSiteId, activeSite, onOpenAddSiteModal }: Props) {
  const { keys, loaded } = useAccountApiKeys(user.uid);
  const { copied, copy } = useCopy();
  const [env, setEnv] = useState<KeyKind>('live');
  // What this startup's key may send. The source of truth is the site doc's
  // `apiPermissions` (live via DashboardClient's site subscription); local
  // state makes toggles feel instant while the save round-trips.
  const remote = activeSite?.apiPermissions;
  const [selected, setSelected] = useState<Set<string>>(() => new Set(remote ?? []));
  const [saveState, setSaveState] = useState<'idle' | 'saving' | 'saved' | 'error'>('idle');
  const timer = useRef<number | null>(null);
  const dirty = useRef(false);

  // Same page chrome as Analytics: canvas colour behind the fixed header.
  useEffect(() => {
    const root = document.documentElement;
    root.setAttribute('data-anx', '');
    return () => root.removeAttribute('data-anx');
  }, []);

  // A different startup (or a change from elsewhere) re-seeds the toggles —
  // unless the user has an unsaved change in flight.
  const remoteKey = (remote ?? []).slice().sort().join('|');
  useEffect(() => {
    if (dirty.current) return;
    setSelected(new Set(remote ?? []));
    setSaveState('idle');
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, [activeSiteId, remoteKey]);

  const persist = useCallback(
    (ids: Set<string>) => {
      if (!activeSiteId) return;
      dirty.current = true;
      setSaveState('saving');
      if (timer.current) window.clearTimeout(timer.current);
      timer.current = window.setTimeout(async () => {
        const res = await callUserAction(user, 'set-api-permissions', { siteId: activeSiteId, permissions: Array.from(ids) });
        dirty.current = false;
        setSaveState(res.ok ? 'saved' : 'error');
        if (res.ok) window.setTimeout(() => setSaveState((c) => (c === 'saved' ? 'idle' : c)), 2200);
      }, 600);
    },
    [user, activeSiteId]
  );

  const toggle = useCallback(
    (id: string) => {
      setSelected((cur) => {
        const next = new Set(cur);
        if (next.has(id)) next.delete(id);
        else next.add(id);
        persist(next);
        return next;
      });
    },
    [persist]
  );
  const setAll = useCallback(
    (ids: string[]) => {
      const next = new Set(ids);
      setSelected(next);
      persist(next);
    },
    [persist]
  );

  const name = firstNameOf(user);
  const host = activeSite ? siteHost(activeSite) : null;
  const keyValue = env === 'live' ? keys.live : keys.test;
  const endpoint = typeof window !== 'undefined' ? `${window.location.origin}/api/ingest` : '/api/ingest';
  const hasSite = sites.length > 0 && !!activeSite;

  return (
    <div className="anx apx">
      <div className="anx-bg" aria-hidden="true">
        <i className="anx-orb is-a" />
        <i className="anx-orb is-b" />
        <i className="anx-orb is-c" />
        <i className="anx-grid" />
      </div>

      <div className="anx-wrap apx-wrap" id="apiMain">
        {/* Deliberately <div>s, not <header> — base.css pins any bare <header> to the viewport top. */}
        <div className="anx-head">
          <div className="anx-eyebrow-row anx-rise" style={delay(0)}>
            <span className="anx-eyebrow">
              <ApiIcon name="plug" width={16} height={16} />
              Developers · Server-side API
            </span>
          </div>
          <h1 className="anx-title anx-rise" style={delay(70)}>
            <span className="anx-title-soft">Connect your backend{name ? ',' : ''}</span>
            {name && <span className="anx-title-name"> {name}</span>}
          </h1>
          <p className="anx-sub anx-rise" style={delay(130)}>
            Your website already tells us who visits. Your server knows the rest — subscriptions, sales, costs, sign-ups. Choose what it may send, and it lights up
            {host ? ` ${host}’s` : ' your'} analytics.
          </p>
          <p className="anx-sub anx-rise" style={delay(160)}>
            Need the full field list for every event, or want your AI assistant to write the code?{' '}
            <a href="/docs/api" target="_blank" rel="noopener">Open the public API docs</a> — copy-able, with Markdown and OpenAPI versions.
          </p>

          <div className="anx-bar apx-bar anx-rise" style={delay(200)}>
            <section className="anx-sec is-site" aria-label="Connected startup">
              <span className="anx-sec-label">Startup</span>
              <AnalyticsSiteSwitcher sites={sites} activeSiteId={activeSiteId} onChange={setActiveSiteId} onAdd={onOpenAddSiteModal} />
            </section>

            <section className="anx-sec" aria-label="Endpoint">
              <span className="anx-sec-label">Endpoint</span>
              <div className="apx-endpoint">
                <span className="apx-method">POST</span>
                <code title={endpoint}>{endpoint.replace(/^https?:\/\//, '')}</code>
                <button
                  type="button"
                  className={copied === 'endpoint' ? 'apx-iconbtn is-done' : 'apx-iconbtn'}
                  aria-label="Copy endpoint"
                  onClick={() => copy(endpoint, 'endpoint')}
                >
                  <ApiIcon name={copied === 'endpoint' ? 'shield' : 'copy'} />
                </button>
              </div>
            </section>
          </div>
        </div>

        <div className="apx-steps">
          <Step n={1} title="Your API keys" note="One pair for your whole account. Your server sends the key; we never ask for your database.">
            <ApiKeysCard user={user} env={env} onEnv={setEnv} keys={keys} loaded={loaded} />
          </Step>

          {hasSite ? (
            <>
              <Step
                n={2}
                title="Choose what it can send"
                note={`Switch on the data ${host} should accept. Tap “How it works” on anything to see exactly what it does.`}
                aside={
                  <span className={`apx-pill is-${saveState}`} role="status" aria-live="polite">
                    {saveState === 'saving' ? 'Saving…' : saveState === 'saved' ? 'Saved' : saveState === 'error' ? 'Couldn’t save — try again' : 'Saved automatically'}
                  </span>
                }
              >
                <ApiPermissions siteId={activeSite.id} selected={selected} onToggle={toggle} onSet={setAll} />
              </Step>

              <Step n={3} title="Send your first event" note="Copy the example, run it from your server, and watch it arrive.">
                <ApiQuickstart user={user} siteId={activeSite.id} env={env} keyValue={keyValue} selected={selected} keyShown={false} />
              </Step>
            </>
          ) : (
            <Step n={2} title="Connect a startup first" note="Events belong to a connected startup, so there’s one to choose before anything can be sent.">
              <div className="apx-card apx-keys-empty">
                <span className="apx-ico is-lg" aria-hidden="true">
                  <ApiIcon name="plug" />
                </span>
                <div>
                  <h3>No startup connected yet</h3>
                  <p>Add the sitevento tag to your site, then come back to switch on the data your backend should send.</p>
                </div>
                <button type="button" className="anx-btn is-primary" onClick={onOpenAddSiteModal}>
                  Connect a startup
                </button>
              </div>
            </Step>
          )}

          <Step n={hasSite ? 4 : 3} title="What the API can never write" note="The reason your traffic numbers can be trusted.">
            <ApiReserved />
          </Step>
        </div>
      </div>
    </div>
  );
}
