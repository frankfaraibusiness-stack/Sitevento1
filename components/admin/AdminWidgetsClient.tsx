'use client';

// components/admin/AdminWidgetsClient.tsx
//
// The actual UI for /admin/widgets: a "Deploy" button that POSTs to
// /api/seed-widget-catalog (see that route for what it writes and why
// it's safe to be public) and reports exactly what happened — which
// widgets were created vs. already existed and just got refreshed,
// and the bundleUrl each one now points at, or a clear error if the
// write failed (most likely: Firebase Admin env vars not set on this
// deployment yet).
import { useState } from 'react';
import '@/styles/admin-widgets.css';

interface SeedResult {
  id: string;
  status: 'created' | 'updated';
  bundleUrl: string;
}

type RunState =
  | { kind: 'idle' }
  | { kind: 'running' }
  | { kind: 'done'; results: SeedResult[] }
  | { kind: 'error'; message: string };

export default function AdminWidgetsClient() {
  const [state, setState] = useState<RunState>({ kind: 'idle' });

  async function handleDeploy() {
    setState({ kind: 'running' });
    try {
      const res = await fetch('/api/seed-widget-catalog', { method: 'POST' });
      const data = await res.json().catch(() => ({ ok: false, error: 'Malformed server response.' }));
      if (!res.ok || !data.ok) {
        setState({ kind: 'error', message: data.error || `Request failed (${res.status}).` });
        return;
      }
      setState({ kind: 'done', results: data.results || [] });
    } catch (err) {
      setState({
        kind: 'error',
        message: err instanceof Error ? err.message : 'Network error — could not reach the server.',
      });
    }
  }

  const running = state.kind === 'running';

  return (
    <div className="admwdg-wrap">
      <div className="admwdg-card">
        <h1>Widget catalog</h1>
        <p className="admwdg-sub">
          Writes the global <code>widgets/&#123;id&#125;</code> Firestore docs the app needs before a shipped
          widget (Support Chat, Countdown Timer) can actually render on any site. Safe to run any time — existing
          docs are refreshed, not replaced; nothing per-site is touched.
        </p>

        <button type="button" className="admwdg-deploy-btn" onClick={handleDeploy} disabled={running}>
          {running ? 'Deploying\u2026' : 'Deploy'}
        </button>

        {state.kind === 'done' && (
          <div className="admwdg-result admwdg-result-ok" role="status">
            <p className="admwdg-result-head">Done — {state.results.length} widget{state.results.length === 1 ? '' : 's'} seeded.</p>
            <ul className="admwdg-result-list">
              {state.results.map((r: SeedResult) => (
                <li key={r.id}>
                  <span className={`admwdg-pill admwdg-pill-${r.status}`}>{r.status}</span>
                  <code>{r.id}</code>
                  <span className="admwdg-arrow">&rarr;</span>
                  <span className="admwdg-url">{r.bundleUrl}</span>
                </li>
              ))}
            </ul>
          </div>
        )}

        {state.kind === 'error' && (
          <div className="admwdg-result admwdg-result-error" role="alert">
            <p className="admwdg-result-head">Could not seed the catalog.</p>
            <p className="admwdg-error-msg">{state.message}</p>
          </div>
        )}
      </div>
    </div>
  );
}
