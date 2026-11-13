'use client';

// components/api/ApiQuickstart.tsx
//
// Step 3: send a first event. A copy-paste example in four languages built
// from the live key + the selected site + the first permission switched on,
// and a live strip that flips from "waiting" to "received" the moment an
// event arrives (real — useApiEvents listens to users/{uid}/apiEvents).
import { useMemo, useState } from 'react';
import type { User } from 'firebase/auth';
import { API_PERMISSIONS, permissionForEvent } from '@/lib/apiPermissions';
import { timeAgo, toMs } from '@/lib/dashboardStats';
import { useApiEvents } from '@/hooks/useApiEvents';
import { CodeBlock } from './CodeBlock';
import { ApiIcon } from './apiIcons';
import { LANGS, buildSnippet, type Lang } from './snippets';
import { maskKey, type KeyKind } from './ApiKeysCard';

interface Props {
  user: User;
  siteId: string | null;
  env: KeyKind;
  keyValue: string | null;
  selected: Set<string>;
  keyShown: boolean;
}

const STATUS_CODES: { code: string; meaning: string; tone: 'ok' | 'warn' | 'bad' }[] = [
  { code: '200', meaning: 'Received and recorded.', tone: 'ok' },
  { code: '400', meaning: 'The body isn’t valid JSON or is missing a required field.', tone: 'warn' },
  { code: '401', meaning: 'Missing, wrong or regenerated key.', tone: 'bad' },
  { code: '403', meaning: 'That event type is switched off for this startup, or it’s a reserved traffic event.', tone: 'bad' },
  { code: '413', meaning: 'Body larger than 64 KB.', tone: 'warn' },
  { code: '429', meaning: 'Too many requests for this key — slow down and retry.', tone: 'warn' },
];

export function ApiQuickstart({ user, siteId, env, keyValue, selected, keyShown }: Props) {
  const [lang, setLang] = useState<Lang>('curl');
  const { events, loading } = useApiEvents(user.uid);

  const url = typeof window !== 'undefined' ? `${window.location.origin}/api/ingest` : '/api/ingest';

  // Example = first allowed permission in catalog order, else subscriptions.
  const payload = useMemo(() => {
    const def = API_PERMISSIONS.find((p) => selected.has(p.id)) ?? API_PERMISSIONS[0];
    return { ...def.example, ...(siteId ? { siteId } : {}) } as Record<string, unknown>;
  }, [selected, siteId]);

  const placeholder = env === 'live' ? 'sv_live_YOUR_KEY' : 'sv_test_YOUR_KEY';
  const shownKey = keyValue ? (keyShown ? keyValue : maskKey(keyValue)) : placeholder;
  const code = buildSnippet(lang, url, shownKey, payload);
  const realCode = buildSnippet(lang, url, keyValue ?? placeholder, payload);

  // Events for this environment and startup (events with no siteId count for any).
  const mine = useMemo(
    () =>
      events
        .filter((e) => (env === 'test' ? e.test : !e.test))
        .filter((e) => !siteId || !e.siteId || e.siteId === siteId),
    [events, env, siteId]
  );
  const last = mine[0];
  const lastMs = last ? toMs(last.receivedAt) : null;

  return (
    <div className="apx-quick">
      <div className="apx-card apx-code-card">
        <div className="apx-tabs-row">
          <div className="apx-tabs" role="tablist" aria-label="Language">
            {LANGS.map((l) => (
              <button key={l.id} type="button" role="tab" aria-selected={lang === l.id} className={lang === l.id ? 'apx-tab is-on' : 'apx-tab'} onClick={() => setLang(l.id)}>
                {l.label}
              </button>
            ))}
          </div>
          <span className={`apx-env ${env === 'live' ? 'is-live' : 'is-test'}`}>{env === 'live' ? 'Live key' : 'Test key'}</span>
        </div>
        <CodeBlock id={`qs-${lang}`} label="POST /api/ingest" code={code} copyText={realCode} />
        {!keyValue && <p className="apx-note">
          <ApiIcon name="key" />
          <span>Generate your keys above and this example fills itself in.</span>
        </p>}
        <p className="apx-note">
          <ApiIcon name="link" />
          <span>Add <code>visitorId</code> when you have it and the sale or sign-up is credited to the channel that brought the visitor.</span>
        </p>
      </div>

      <div className="apx-card apx-live">
        <div className="apx-live-head">
          <span className={last ? 'apx-pulse is-ok' : 'apx-pulse'} aria-hidden="true" />
          <div>
            <h3>{loading ? 'Checking for events…' : last ? 'Events are arriving' : 'Waiting for your first event'}</h3>
            <p>
              {last && lastMs
                ? `Last one ${timeAgo(lastMs)} — ${last.event}`
                : env === 'test'
                  ? 'Send the example with your test key and it appears here within a second.'
                  : 'Send the example from your server and it appears here within a second.'}
            </p>
          </div>
        </div>

        {mine.length > 0 && (
          <ul className="apx-feed" aria-label="Recent events">
            {mine.slice(0, 5).map((e) => {
              const perm = permissionForEvent(e.event);
              const ms = toMs(e.receivedAt);
              return (
                <li key={e.id}>
                  <span className="apx-ico is-sm" aria-hidden="true">
                    <ApiIcon name={perm?.icon ?? 'spark'} />
                  </span>
                  <code>{e.event}</code>
                  {e.userId && <span className="apx-feed-user">{e.userId}</span>}
                  <time>{ms ? timeAgo(ms) : ''}</time>
                </li>
              );
            })}
          </ul>
        )}
      </div>

      <div className="apx-card apx-codes">
        <h3>What comes back</h3>
        <ul>
          {STATUS_CODES.map((c) => (
            <li key={c.code}>
              <b className={`is-${c.tone}`}>{c.code}</b>
              <span>{c.meaning}</span>
            </li>
          ))}
        </ul>
        <p className="apx-note">
          <ApiIcon name="info" />
          <span>Every accepted event counts as one visit toward your monthly allowance. Up to 600 requests a minute per key.</span>
        </p>
      </div>
    </div>
  );
}
