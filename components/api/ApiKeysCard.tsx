'use client';

// components/api/ApiKeysCard.tsx
//
// Step 1 of the API page: the account's two keys (lib/apiKeys.ts). Real —
// read live off users/{uid} and regenerated through the existing
// 'generate-api-key' user action. Regenerating asks for confirmation inline
// (no modal) because the old key stops working the instant a new one exists.
import { useState } from 'react';
import type { User } from 'firebase/auth';
import { callUserAction } from '@/lib/userActionClient';
import { IconCheck } from '@/components/analytics/AnalyticsIcons';
import { ApiIcon } from './apiIcons';
import { useCopy } from './useCopy';

export type KeyKind = 'live' | 'test';

export function maskKey(key: string | null): string {
  if (!key) return '';
  return `${key.slice(0, 12)}${'•'.repeat(20)}`;
}

interface Props {
  user: User;
  env: KeyKind;
  onEnv: (k: KeyKind) => void;
  /** Lets the page know the current keys (for snippets). */
  keys: { live: string | null; test: string | null };
  loaded: boolean;
}

const COPY: Record<KeyKind, { title: string; sub: string; tone: string }> = {
  live: { title: 'Live key', sub: 'Real data. Counts toward your analytics and monthly usage.', tone: 'is-live' },
  test: { title: 'Test key', sub: 'Same endpoint, tagged as test — never mixes into real analytics.', tone: 'is-test' },
};

export function ApiKeysCard({ user, env, onEnv, keys, loaded }: Props) {
  const { copied, copy } = useCopy();
  const [reveal, setReveal] = useState<Record<KeyKind, boolean>>({ live: false, test: false });
  const [confirm, setConfirm] = useState<KeyKind | null>(null);
  const [busy, setBusy] = useState<KeyKind | 'create' | null>(null);
  const [error, setError] = useState<string | null>(null);

  const noKeys = loaded && !keys.live && !keys.test;

  async function generate(kind: KeyKind, mode: 'create' | 'regen') {
    setBusy(mode === 'create' ? 'create' : kind);
    setError(null);
    let res = await callUserAction(user, 'generate-api-key', { kind });
    // First time: create the pair (live + test) in one go.
    if (res.ok && mode === 'create') res = await callUserAction(user, 'generate-api-key', { kind: 'test' });
    setBusy(null);
    setConfirm(null);
    if (!res.ok) setError(res.error || 'Could not generate a key. Try again in a moment.');
    // On success the onSnapshot in useAccountApiKeys shows the new key by itself.
  }

  if (noKeys) {
    return (
      <div className="apx-card apx-keys-empty">
        <span className="apx-ico is-lg" aria-hidden="true">
          <ApiIcon name="key" />
        </span>
        <div>
          <h3>Create your API keys</h3>
          <p>You get a live key for real data and a test key to try things out safely. They belong to your account and work for every connected startup.</p>
        </div>
        <button type="button" className="anx-btn is-primary" disabled={busy === 'create'} onClick={() => generate('live', 'create')}>
          {busy === 'create' ? 'Creating…' : 'Generate keys'}
        </button>
        {error && <p className="apx-error" role="alert">{error}</p>}
      </div>
    );
  }

  return (
    <div className="apx-keys">
      {(['live', 'test'] as KeyKind[]).map((kind) => {
        const value = keys[kind];
        const meta = COPY[kind];
        const selected = env === kind;
        const shown = reveal[kind] && value ? value : maskKey(value);
        return (
          <div key={kind} className={`apx-card apx-key ${meta.tone}${selected ? ' is-selected' : ''}`}>
            <div className="apx-key-top">
              <span className={`apx-badge ${meta.tone}`}>
                <i aria-hidden="true" />
                {meta.title}
              </span>
              <button
                type="button"
                className={selected ? 'apx-use is-on' : 'apx-use'}
                aria-pressed={selected}
                onClick={() => onEnv(kind)}
              >
                {selected ? (
                  <>
                    <IconCheck /> Used in examples
                  </>
                ) : (
                  'Use in examples'
                )}
              </button>
            </div>
            <p className="apx-key-sub">{meta.sub}</p>

            <div className="apx-key-row">
              <code className="apx-key-val" aria-label={`${meta.title} value`}>
                {!loaded ? 'Loading…' : value ? shown : '— not generated yet —'}
              </code>
              <div className="apx-key-actions">
                <button
                  type="button"
                  className="apx-iconbtn"
                  aria-label={reveal[kind] ? 'Hide key' : 'Reveal key'}
                  aria-pressed={reveal[kind]}
                  disabled={!value}
                  onClick={() => setReveal((r) => ({ ...r, [kind]: !r[kind] }))}
                >
                  <ApiIcon name={reveal[kind] ? 'eyeOff' : 'eye'} />
                </button>
                <button
                  type="button"
                  className={copied === `key-${kind}` ? 'apx-iconbtn is-done' : 'apx-iconbtn'}
                  aria-label="Copy key"
                  disabled={!value}
                  onClick={() => value && copy(value, `key-${kind}`)}
                >
                  {copied === `key-${kind}` ? <IconCheck /> : <ApiIcon name="copy" />}
                </button>
                <button
                  type="button"
                  className="apx-iconbtn"
                  aria-label="Regenerate key"
                  disabled={busy === kind}
                  onClick={() => setConfirm(confirm === kind ? null : kind)}
                >
                  <ApiIcon name="refresh" />
                </button>
              </div>
            </div>

            {confirm === kind && (
              <div className="apx-confirm" role="alertdialog" aria-label={`Regenerate ${meta.title}`}>
                <p>
                  <b>Regenerate this key?</b> The current one stops working immediately — anything still using it will get 401 errors until you update it.
                </p>
                <div className="apx-confirm-actions">
                  <button type="button" className="anx-btn is-ghost" onClick={() => setConfirm(null)}>
                    Cancel
                  </button>
                  <button type="button" className="anx-btn is-danger" disabled={busy === kind} onClick={() => generate(kind, 'regen')}>
                    {busy === kind ? 'Regenerating…' : 'Regenerate'}
                  </button>
                </div>
              </div>
            )}
          </div>
        );
      })}
      {error && (
        <p className="apx-error" role="alert">
          {error}
        </p>
      )}
      <p className="apx-note">
          <ApiIcon name="shield" />
          <span>Keep keys on your server. Never put one in a web page or mobile app — anyone could copy it.</span>
        </p>
    </div>
  );
}
