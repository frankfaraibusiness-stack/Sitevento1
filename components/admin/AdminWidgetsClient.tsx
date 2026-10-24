'use client';

// components/admin/AdminWidgetsClient.tsx
//
// The UI for /admin/widgets:
//   - A status table, one row per lib/widgets.ts WIDGET_CATALOG entry,
//     showing whether its global widgets/{id} Firestore doc is
//     currently pushed, and its live enabled/version/bundleUrl if so
//     (GET /api/admin/widgets).
//   - A per-row Push button that (re)seeds just that one widget's doc
//     (POST /api/seed-widget-catalog with { ids: [id] }) — for pushing
//     only what's missing, or force-refreshing one that's already
//     pushed but looks wrong, without touching any other widget.
//   - A per-row Delete button that removes just that doc
//     (DELETE /api/admin/widgets/[id]) — see that route's comment for
//     why this isn't permanent for a built-in widget (it self-heals on
//     next request) and why that's intentional, not a bug.
//   - A "Push all" button for the common case of seeding everything at
//     once (same endpoint, no `ids` filter).
import { useCallback, useEffect, useState } from 'react';
import '@/styles/admin-widgets.css';
import type { AdminWidgetStatus } from '@/lib/widgets';

type ListState =
  | { kind: 'loading' }
  | { kind: 'loaded'; rows: AdminWidgetStatus[] }
  | { kind: 'error'; message: string };

type PushAllState =
  | { kind: 'idle' }
  | { kind: 'running' }
  | { kind: 'done'; count: number }
  | { kind: 'error'; message: string };

export default function AdminWidgetsClient() {
  const [list, setList] = useState<ListState>({ kind: 'loading' });
  const [pushAll, setPushAll] = useState<PushAllState>({ kind: 'idle' });
  const [pushingId, setPushingId] = useState<string | null>(null);
  const [deletingId, setDeletingId] = useState<string | null>(null);
  const [rowError, setRowError] = useState<{ id: string; message: string } | null>(null);

  const loadList = useCallback(async () => {
    setList({ kind: 'loading' });
    try {
      const res = await fetch('/api/admin/widgets', { cache: 'no-store' });
      const data = await res.json().catch(() => ({ ok: false, error: 'Malformed server response.' }));
      if (!res.ok || !data.ok) {
        setList({ kind: 'error', message: data.error || `Request failed (${res.status}).` });
        return;
      }
      setList({ kind: 'loaded', rows: data.results || [] });
    } catch (err) {
      setList({
        kind: 'error',
        message: err instanceof Error ? err.message : 'Network error — could not reach the server.',
      });
    }
  }, []);

  useEffect(() => {
    loadList();
  }, [loadList]);

  async function handlePushAll() {
    setPushAll({ kind: 'running' });
    setRowError(null);
    try {
      const res = await fetch('/api/seed-widget-catalog', { method: 'POST' });
      const data = await res.json().catch(() => ({ ok: false, error: 'Malformed server response.' }));
      if (!res.ok || !data.ok) {
        setPushAll({ kind: 'error', message: data.error || `Request failed (${res.status}).` });
        return;
      }
      setPushAll({ kind: 'done', count: (data.results || []).length });
      loadList();
    } catch (err) {
      setPushAll({
        kind: 'error',
        message: err instanceof Error ? err.message : 'Network error — could not reach the server.',
      });
    }
  }

  // Pushes exactly one widget, leaving every other row untouched — see
  // the `ids` filter added to /api/seed-widget-catalog for this.
  async function handlePushOne(id: string) {
    setPushingId(id);
    setRowError(null);
    try {
      const res = await fetch('/api/seed-widget-catalog', {
        method: 'POST',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify({ ids: [id] }),
      });
      const data = await res.json().catch(() => ({ ok: false, error: 'Malformed server response.' }));
      if (!res.ok || !data.ok) {
        setRowError({ id, message: data.error || `Could not push ${id}.` });
        return;
      }
      await loadList();
    } catch (err) {
      setRowError({
        id,
        message: err instanceof Error ? err.message : 'Network error — could not reach the server.',
      });
    } finally {
      setPushingId(null);
    }
  }

  async function handleDelete(id: string) {
    setDeletingId(id);
    setRowError(null);
    try {
      const res = await fetch(`/api/admin/widgets/${encodeURIComponent(id)}`, { method: 'DELETE' });
      const data = await res.json().catch(() => ({ ok: false, error: 'Malformed server response.' }));
      if (!res.ok || !data.ok) {
        setRowError({ id, message: data.error || `Could not delete ${id}.` });
        return;
      }
      await loadList();
    } catch (err) {
      setRowError({
        id,
        message: err instanceof Error ? err.message : 'Network error — could not reach the server.',
      });
    } finally {
      setDeletingId(null);
    }
  }

  const pushingAll = pushAll.kind === 'running';

  return (
    <div className="admwdg-wrap">
      <div className="admwdg-card">
        <h1>Widget catalog</h1>
        <p className="admwdg-sub">
          Status of each shipped widget's global <code>widgets/&#123;id&#125;</code> Firestore doc — the doc
          that must exist before a widget can render on any site. Push a single row to seed or re-seed just
          that widget without touching the others, or Delete to take it down immediately. For a built-in
          widget, Delete isn't permanent — it comes back automatically the next time any visitor requests it
          (self-heal), so it's really "force a clean re-push."
        </p>

        <div className="admwdg-actions">
          <button type="button" className="admwdg-deploy-btn" onClick={handlePushAll} disabled={pushingAll}>
            {pushingAll ? 'Pushing\u2026' : 'Push all'}
          </button>
          <button type="button" className="admwdg-refresh-btn" onClick={loadList} disabled={list.kind === 'loading'}>
            Refresh
          </button>
        </div>

        {pushAll.kind === 'done' && (
          <p className="admwdg-inline-note admwdg-inline-ok">Pushed {pushAll.count} widget{pushAll.count === 1 ? '' : 's'}.</p>
        )}
        {pushAll.kind === 'error' && (
          <p className="admwdg-inline-note admwdg-inline-error">{pushAll.message}</p>
        )}

        {list.kind === 'loading' && <p className="admwdg-sub">Loading…</p>}

        {list.kind === 'error' && (
          <div className="admwdg-result admwdg-result-error" role="alert">
            <p className="admwdg-result-head">Could not load widget status.</p>
            <p className="admwdg-error-msg">{list.message}</p>
          </div>
        )}

        {list.kind === 'loaded' && (
          <table className="admwdg-table">
            <thead>
              <tr>
                <th>Widget</th>
                <th>Status</th>
                <th>Enabled</th>
                <th>Version</th>
                <th>Bundle URL</th>
                <th aria-label="Actions" />
              </tr>
            </thead>
            <tbody>
              {list.rows.map((row) => {
                const isPushingThis = pushingId === row.id;
                const isDeletingThis = deletingId === row.id;
                const rowBusy = isPushingThis || isDeletingThis;
                return (
                  <tr key={row.id}>
                    <td>
                      <div className="admwdg-name">{row.name}</div>
                      <code className="admwdg-id">{row.id}</code>
                    </td>
                    <td>
                      <span className={`admwdg-pill ${row.pushed ? 'admwdg-pill-updated' : 'admwdg-pill-missing'}`}>
                        {row.pushed ? 'pushed' : 'not pushed'}
                      </span>
                    </td>
                    <td>{row.enabled === null ? '—' : row.enabled ? 'yes' : 'no'}</td>
                    <td>{row.version === null ? '—' : row.version}</td>
                    <td className="admwdg-url-cell">{row.bundleUrl || '—'}</td>
                    <td>
                      <div className="admwdg-row-actions">
                        <button
                          type="button"
                          className="admwdg-push-btn"
                          onClick={() => handlePushOne(row.id)}
                          disabled={rowBusy}
                        >
                          {isPushingThis ? 'Pushing\u2026' : row.pushed ? 'Re-push' : 'Push'}
                        </button>
                        <button
                          type="button"
                          className="admwdg-delete-btn"
                          onClick={() => handleDelete(row.id)}
                          disabled={!row.pushed || rowBusy}
                        >
                          {isDeletingThis ? 'Deleting\u2026' : 'Delete'}
                        </button>
                      </div>
                      {rowError?.id === row.id && (
                        <p className="admwdg-row-error">{rowError.message}</p>
                      )}
                    </td>
                  </tr>
                );
              })}
            </tbody>
          </table>
        )}
      </div>
    </div>
  );
}
