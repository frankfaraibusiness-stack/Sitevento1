'use client';

// components/settings/panels/ApiPanel.tsx
//
// Real API Keys panel. Previously every value here was hardcoded
// placeholder text (sv_live_••••••••••••••••) with inert buttons —
// see git history. Now backed by real account-level keys
// (lib/apiKeys.ts) read live off users/{uid} and regenerated through
// app/api/user-action's 'generate-api-key' action, plus a live feed of
// the most recent events received through those keys at the new
// server-to-server ingestion endpoint, app/api/ingest — see that
// route's header for the full "deep data" model (why this is account-
// level and not site-scoped, why the payload has no fixed schema,
// etc.).
//
// "Allowed Domains" / "API Access" (read&write/read-only/disabled)
// from the old mockup are dropped rather than wired up to fake
// functionality: this endpoint is called from a BACKEND, never a
// browser (see app/api/ingest's header — there's deliberately no CORS
// story), so an "allowed domains" allowlist has no caller to apply to.
// A real scoping control (e.g. a true read-only key) is a reasonable
// future addition but isn't built here — showing it unwired would be
// worse than not showing it at all.
import { useEffect, useState } from 'react';
import { doc, onSnapshot } from 'firebase/firestore';
import type { User } from 'firebase/auth';
import { getFirebaseDb } from '@/lib/firebase';
import { callUserAction } from '@/lib/userActionClient';
import { useApiEvents } from '@/hooks/useApiEvents';
import { ConfirmPopup } from '@/components/widgets/WidgetStatusPopup';
import '@/styles/settings/api-panel.css';

interface ApiPanelProps {
  user: User | null;
}

type KeyKind = 'live' | 'test';

function maskKey(key: string | null): string {
  if (!key) return '— not generated yet —';
  const prefix = key.slice(0, 12); // "sv_live_" / "sv_test_" + first 4 chars
  return `${prefix}${'•'.repeat(20)}`;
}

function formatReceivedAt(ts: { toDate: () => Date } | number | null | undefined): string {
  if (!ts) return '';
  const d = typeof ts === 'number' ? new Date(ts) : ts.toDate();
  if (isNaN(d.getTime())) return '';
  return d.toLocaleString(undefined, { month: 'short', day: 'numeric', hour: 'numeric', minute: '2-digit' });
}

/**
 * Live subscription to the two key fields on users/{uid}. Kept local
 * to this file (not promoted to hooks/) since nothing else in the app
 * reads apiKeyLive/apiKeyTest directly — every other write-capable
 * panel that needs live-reflected server state does the same inline
 * onSnapshot (see AccountPanel.tsx's own pattern for settings).
 */
function useAccountApiKeys(uid: string | null) {
  const [keys, setKeys] = useState<{ live: string | null; test: string | null }>({ live: null, test: null });
  const [loaded, setLoaded] = useState(false);

  useEffect(() => {
    if (!uid) {
      setKeys({ live: null, test: null });
      setLoaded(false);
      return;
    }
    setLoaded(false);
    const db = getFirebaseDb();
    const unsub = onSnapshot(
      doc(db, 'users', uid),
      (snap) => {
        const data = snap.exists() ? snap.data() : {};
        setKeys({
          live: typeof data?.apiKeyLive === 'string' ? data.apiKeyLive : null,
          test: typeof data?.apiKeyTest === 'string' ? data.apiKeyTest : null,
        });
        setLoaded(true);
      },
      (err) => {
        console.error('api keys snapshot error', err);
        setLoaded(true);
      }
    );
    return () => unsub();
  }, [uid]);

  return { keys, loaded };
}

export default function ApiPanel({ user }: ApiPanelProps) {
  const uid = user?.uid ?? null;
  const { keys, loaded: keysLoaded } = useAccountApiKeys(uid);
  const { liveEvents, loading: eventsLoading } = useApiEvents(uid);

  const [copiedKind, setCopiedKind] = useState<KeyKind | null>(null);
  const [regenerating, setRegenerating] = useState<KeyKind | null>(null);
  const [confirmKind, setConfirmKind] = useState<KeyKind | null>(null);
  const [error, setError] = useState<string | null>(null);

  async function copyKey(kind: KeyKind) {
    const value = kind === 'live' ? keys.live : keys.test;
    if (!value) return;
    try {
      await navigator.clipboard.writeText(value);
      setCopiedKind(kind);
      setTimeout(() => setCopiedKind((c) => (c === kind ? null : c)), 1500);
    } catch {
      // Clipboard permission can be denied — fail silently, the key
      // text is still visible on the row for a manual copy.
    }
  }

  async function doRegenerate(kind: KeyKind) {
    if (!user) return;
    setRegenerating(kind);
    setError(null);
    const result = await callUserAction(user, 'generate-api-key', { kind });
    setRegenerating(null);
    setConfirmKind(null);
    if (!result.ok) {
      setError(result.error || 'Could not generate a new key.');
    }
    // No local state update needed on success — useAccountApiKeys'
    // onSnapshot picks up the new value the moment the Admin-SDK write
    // lands, same "server write, client listener reflects it" pattern
    // every other real settings panel here already uses.
  }

  const ingestUrl = typeof window !== 'undefined' ? `${window.location.origin}/api/ingest` : '/api/ingest';

  return (
    <>
      <div className="settings-panel-header">
        <svg viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2">
          <polyline points="16 18 22 12 16 6" />
          <polyline points="8 6 2 12 8 18" />
        </svg>
        <h3>API Keys</h3>
      </div>
      <p className="settings-panel-desc">
        Keys used to talk to the sitevento widget and tracking APIs — and to send deep, server-side data in from your own backend.
      </p>
      <hr className="settings-divider" />

      <div className="settings-input-group">
        <label>Live API Key</label>
        <div className="settings-kv-row">
          <span className="kv-value">{keysLoaded ? maskKey(keys.live) : 'Loading…'}</span>
          <button type="button" className="settings-icon-btn" aria-label="Copy" disabled={!keys.live} onClick={() => copyKey('live')}>
            {copiedKind === 'live' ? (
              <svg viewBox="0 0 24 24" strokeWidth="2">
                <polyline points="20 6 9 17 4 12" />
              </svg>
            ) : (
              <svg viewBox="0 0 24 24" strokeWidth="2">
                <rect x="9" y="9" width="13" height="13" rx="2" />
                <path d="M5 15H4a2 2 0 01-2-2V4a2 2 0 012-2h9a2 2 0 012 2v1" />
              </svg>
            )}
          </button>
          <button
            type="button"
            className="settings-icon-btn"
            aria-label="Regenerate"
            disabled={regenerating === 'live'}
            onClick={() => setConfirmKind('live')}
          >
            <svg viewBox="0 0 24 24" strokeWidth="2">
              <polyline points="23 4 23 10 17 10" />
              <path d="M20.49 15a9 9 0 11-2.12-9.36L23 10" />
            </svg>
          </button>
        </div>
        <span className="settings-hint">Use this in your backend for real, billed data.</span>
      </div>

      <div className="settings-input-group">
        <label>Test API Key</label>
        <div className="settings-kv-row">
          <span className="kv-value">{keysLoaded ? maskKey(keys.test) : 'Loading…'}</span>
          <button type="button" className="settings-icon-btn" aria-label="Copy" disabled={!keys.test} onClick={() => copyKey('test')}>
            {copiedKind === 'test' ? (
              <svg viewBox="0 0 24 24" strokeWidth="2">
                <polyline points="20 6 9 17 4 12" />
              </svg>
            ) : (
              <svg viewBox="0 0 24 24" strokeWidth="2">
                <rect x="9" y="9" width="13" height="13" rx="2" />
                <path d="M5 15H4a2 2 0 01-2-2V4a2 2 0 012-2h9a2 2 0 012 2v1" />
              </svg>
            )}
          </button>
          <button
            type="button"
            className="settings-icon-btn"
            aria-label="Regenerate"
            disabled={regenerating === 'test'}
            onClick={() => setConfirmKind('test')}
          >
            <svg viewBox="0 0 24 24" strokeWidth="2">
              <polyline points="23 4 23 10 17 10" />
              <path d="M20.49 15a9 9 0 11-2.12-9.36L23 10" />
            </svg>
          </button>
        </div>
        <span className="settings-hint">Same endpoint, tagged separately so test traffic never mixes into real analytics.</span>
      </div>

      {error && <p className="settings-hint-error">{error}</p>}

      <hr className="settings-divider" />

      <div className="settings-input-group">
        <label>Send deep data from your server</label>
        <p className="settings-field-desc">
          Your backend can send subscriptions, orders, expenses, sign-ups, logins and more — each type switched on per startup, so you decide
          exactly what it may send. Visits, clicks and visitors can never be written through the API.
        </p>
        <pre className="api-panel-snippet">
{`curl -X POST ${ingestUrl} \\
  -H "Authorization: Bearer ${keys.live ? keys.live : 'sv_live_YOUR_KEY'}" \\
  -H "Content-Type: application/json" \\
  -d '{
    "event": "order.completed",
    "orderId": "ord_10482",
    "total": 54.90,
    "currency": "USD",
    "items": [{ "name": "Starter pack", "price": 54.90, "quantity": 1 }]
  }'`}
        </pre>
        <span className="settings-hint">
          Choose what it may send, see every event and field, and copy ready examples on the{' '}
          <a href="/dashboard/api">API page</a>. One accepted event counts as one visit against your monthly usage.
        </span>
      </div>

      <hr className="settings-divider" />

      <div className="settings-input-group">
        <label>Recent events received</label>
        {eventsLoading ? (
          <span className="settings-hint">Loading…</span>
        ) : liveEvents.length === 0 ? (
          <span className="settings-hint">No events yet — send your first POST above and it&rsquo;ll show up here.</span>
        ) : (
          <div className="api-panel-event-list">
            {liveEvents.slice(0, 10).map((ev) => (
              <div key={ev.id} className="api-panel-event-row">
                <span className="api-panel-event-name">{ev.event}</span>
                {ev.userId && <span className="api-panel-event-sub">{ev.userId}</span>}
                <span className="api-panel-event-time">{formatReceivedAt(ev.receivedAt)}</span>
              </div>
            ))}
          </div>
        )}
      </div>

      <ConfirmPopup
        open={confirmKind !== null}
        title={`Regenerate ${confirmKind === 'live' ? 'Live' : 'Test'} API Key?`}
        message="The current key will stop working immediately. Any integration still using it will start getting 401 errors until you update it with the new key."
        confirmLabel="Regenerate Key"
        danger
        busy={regenerating !== null}
        busyLabel="Regenerating…"
        onConfirm={() => confirmKind && doRegenerate(confirmKind)}
        onClose={() => setConfirmKind(null)}
      />
    </>
  );
}
