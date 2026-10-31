'use client';

// components/dashboard/EmailCapturePage.tsx
//
// Standalone "Email capture" page, mounted at /dashboard/leads (see
// that route's page.tsx and DashboardClient.tsx's view="leads"). Fixes
// the sidebar's "Email capture" link, which previously only scrolled
// to the leads panel on the main dashboard (#panelLeads) — this gives
// it its own dedicated page, own SEO metadata, and real functionality
// the inline panel never had: search, per-email actions (copy, email,
// delete), a restorable Bin, and account-wide actions (Download all /
// Export all) gated by plan with an upsell nudge on Free.
//
// Uses hooks/useLeadsData.ts (a separate, uncapped subscription from
// hooks/useActiveSiteData.ts's 50-lead-capped one the main dashboard
// panel uses) plus app/api/leads-export for the actual export/download
// payload, since the live-subscribed list is capped client-side and
// isn't a real "export everything" source.
import { useMemo, useRef, useState } from 'react';
import { useNavRouter } from '@/hooks/useNavPending';
import type { User } from 'firebase/auth';
import { useSites } from '@/hooks/useSites';
import { useLeadsData } from '@/hooks/useLeadsData';
import { formatTs } from '@/lib/format';
import { AppSkeleton } from '@/components/AppSkeleton';
import type { Lead } from '@/lib/types';

interface EmailCapturePageProps {
  user: User;
}

function BackIcon() {
  return (
    <svg viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth={2.2} aria-hidden="true">
      <path d="M15 18l-6-6 6-6" />
    </svg>
  );
}
function MailIcon() {
  return (
    <svg viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth={1.8} aria-hidden="true">
      <rect x="3" y="5" width="18" height="14" rx="2" />
      <path d="M3 7l9 6 9-6" />
    </svg>
  );
}
function SearchIcon() {
  return (
    <svg viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth={2} aria-hidden="true">
      <circle cx="11" cy="11" r="7" />
      <path d="m21 21-4.3-4.3" />
    </svg>
  );
}
function DownloadIcon() {
  return (
    <svg viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth={2} aria-hidden="true">
      <path d="M12 3v12m0 0l-4-4m4 4l4-4M4 21h16" />
    </svg>
  );
}
function ExportIcon() {
  return (
    <svg viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth={2} aria-hidden="true">
      <path d="M14 3h7v7M21 3l-9 9M5 5h5M5 12h3M5 19h14" />
    </svg>
  );
}
function BinIcon() {
  return (
    <svg viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth={1.8} aria-hidden="true">
      <path d="M4 7h16M9 7V5a2 2 0 0 1 2-2h2a2 2 0 0 1 2 2v2m-9 0l1 13a2 2 0 0 0 2 2h6a2 2 0 0 0 2-2l1-13" />
      <path d="M10 11v6M14 11v6" />
    </svg>
  );
}
function CopyIcon() {
  return (
    <svg viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth={1.8} aria-hidden="true">
      <rect x="9" y="9" width="12" height="12" rx="2" />
      <path d="M5 15H4a1 1 0 0 1-1-1V4a1 1 0 0 1 1-1h10a1 1 0 0 1 1 1v1" />
    </svg>
  );
}
function CheckIcon() {
  return (
    <svg viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth={2.4} aria-hidden="true">
      <path d="M5 12l5 5L20 7" />
    </svg>
  );
}
function DeleteIcon() {
  return (
    <svg viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth={1.8} aria-hidden="true">
      <path d="M4 7h16M9 7V5a2 2 0 0 1 2-2h2a2 2 0 0 1 2 2v2m-9 0l1 13a2 2 0 0 0 2 2h6a2 2 0 0 0 2-2l1-13" />
      <path d="M10 11v6M14 11v6" />
    </svg>
  );
}
function RestoreIcon() {
  return (
    <svg viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth={2} aria-hidden="true">
      <path d="M3 12a9 9 0 1 0 3-6.7" />
      <path d="M3 4v5h5" />
    </svg>
  );
}
function LockIcon() {
  return (
    <svg viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth={2} aria-hidden="true">
      <rect x="4" y="10" width="16" height="10" rx="2" />
      <path d="M8 10V7a4 4 0 0 1 8 0v3" />
    </svg>
  );
}
function CloseIcon() {
  return (
    <svg viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth={2} aria-hidden="true">
      <path d="M6 6l12 12M18 6L6 18" />
    </svg>
  );
}

function initialOf(email: string): string {
  return (email || '?').trim().charAt(0).toUpperCase() || '?';
}

function emailsToCsv(leads: { email: string; ts: unknown; source?: string | null }[]): string {
  const rows = [['email', 'captured_at', 'source']];
  for (const l of leads) {
    rows.push([l.email, formatTs(l.ts), l.source || '']);
  }
  return rows
    .map((row) => row.map((cell) => `"${String(cell).replace(/"/g, '""')}"`).join(','))
    .join('\n');
}

function downloadTextFile(filename: string, content: string, mime: string) {
  const blob = new Blob([content], { type: mime });
  const url = URL.createObjectURL(blob);
  const a = document.createElement('a');
  a.href = url;
  a.download = filename;
  document.body.appendChild(a);
  a.click();
  a.remove();
  URL.revokeObjectURL(url);
}

export function EmailCapturePage({ user }: EmailCapturePageProps) {
  const router = useNavRouter();
  const { sites, activeSiteId, setActiveSiteId, dashState } = useSites(user.uid);
  const { leads, bin, loading, deleteLead, restoreLead } = useLeadsData(user.uid, activeSiteId, user);

  const [search, setSearch] = useState('');
  const [copiedId, setCopiedId] = useState<string | null>(null);
  const [binOpen, setBinOpen] = useState(false);
  const [busyAction, setBusyAction] = useState<string | null>(null);
  const [upsellFor, setUpsellFor] = useState<'download' | 'export' | null>(null);

  const activeSite = sites.find((s) => s.id === activeSiteId) || null;

  const filtered = useMemo(() => {
    const q = search.trim().toLowerCase();
    if (!q) return leads;
    return leads.filter((l) => (l.email || '').toLowerCase().includes(q));
  }, [leads, search]);

  function copyEmail(lead: Lead) {
    if (!lead.email) return;
    navigator.clipboard?.writeText(lead.email).then(() => {
      setCopiedId(lead.id);
      setTimeout(() => setCopiedId((cur) => (cur === lead.id ? null : cur)), 1600);
    });
  }

  function contactEmail(lead: Lead) {
    if (!lead.email) return;
    window.location.href = `mailto:${lead.email}`;
  }

  async function handleDelete(lead: Lead) {
    setBusyAction(lead.id);
    await deleteLead(lead.id);
    setBusyAction(null);
  }

  async function handleRestore(lead: Lead) {
    setBusyAction(lead.id);
    await restoreLead(lead.id);
    setBusyAction(null);
  }

  // Both "Download all" and "Export all" go through the same
  // server-verified /api/leads-export (reads the full, uncapped,
  // non-deleted lead list and enforces the data-export daily quota —
  // see that route's header comment). Download writes a CSV straight
  // to disk; Export writes a JSON file — same gated action, two output
  // formats, so there's exactly one place the quota is checked.
  async function runExport(format: 'csv' | 'json') {
    if (!activeSiteId) return;
    const key = format === 'csv' ? 'download' : 'export';
    setBusyAction(key);
    setUpsellFor(null);
    try {
      const idToken = await user.getIdToken();
      const res = await fetch('/api/leads-export', {
        method: 'POST',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify({ idToken, siteId: activeSiteId }),
      });
      const result = await res.json().catch(() => ({}));
      if (!res.ok || !result.ok) {
        if (result.code === 'FEATURE_LIMIT_REACHED') {
          setUpsellFor(format === 'csv' ? 'download' : 'export');
          return;
        }
        window.alert(result.error || 'Could not prepare that export right now.');
        return;
      }
      const siteName = activeSite?.name || activeSite?.url || 'site';
      if (format === 'csv') {
        downloadTextFile(`${siteName}-emails.csv`, emailsToCsv(result.leads || []), 'text/csv;charset=utf-8');
      } else {
        downloadTextFile(`${siteName}-emails.json`, JSON.stringify(result.leads || [], null, 2), 'application/json');
      }
    } catch (err) {
      console.error('leads export error', err);
      window.alert('Could not reach the server. Check your connection and try again.');
    } finally {
      setBusyAction(null);
    }
  }

  if (dashState === 'loading' || loading) {
    return (
      <div className="ecp-main">
        <div className="ecp-wrap">
          <AppSkeleton label="Loading email capture" />
        </div>
      </div>
    );
  }

  if (dashState === 'empty' || !activeSite) {
    return (
      <div className="ecp-main">
        <div className="ecp-wrap">
          <button type="button" className="ecp-back" onClick={() => router.push('/dashboard')}>
            <BackIcon />
            Back to dashboard
          </button>
          <div className="ecp-empty">
            <div className="ecp-empty-mascot">
              <MailIcon />
            </div>
            <h2>No sites connected yet</h2>
            <p>Connect a site to start collecting emails here.</p>
            <button type="button" className="btn-primary" onClick={() => router.push('/dashboard?connect=1')}>
              Connect your site
            </button>
          </div>
        </div>
      </div>
    );
  }

  return (
    <div className="ecp-main">
      <div className="ecp-wrap">
        <button type="button" className="ecp-back" onClick={() => router.push('/dashboard')}>
          <BackIcon />
          Back to dashboard
        </button>

        <div className="ecp-head">
          <div className="ecp-head-text">
            <h1>
              <span className="ecp-head-icon">
                <MailIcon />
              </span>
              Email capture
            </h1>
            <p>Every email your widget has collected — yours to reach out to, download, or tidy up.</p>
          </div>

          {sites.length > 1 && (
            <select
              className="ecp-site-select"
              value={activeSiteId || ''}
              onChange={(e) => setActiveSiteId(e.target.value)}
              aria-label="Select site"
            >
              {sites.map((s) => (
                <option key={s.id} value={s.id}>
                  {s.name || s.url}
                </option>
              ))}
            </select>
          )}
        </div>

        <div className="ecp-stats">
          <div className="ecp-stat is-lime">
            <span className="ecp-stat-value">{leads.length}</span>
            <span className="ecp-stat-label">Emails collected</span>
          </div>
          <div className="ecp-stat">
            <span className="ecp-stat-value">{filtered.length}</span>
            <span className="ecp-stat-label">Matching search</span>
          </div>
          <div className="ecp-stat">
            <span className="ecp-stat-value">{bin.length}</span>
            <span className="ecp-stat-label">In bin</span>
          </div>
          <div className="ecp-stat">
            <span className="ecp-stat-value">{activeSite.name || activeSite.url}</span>
            <span className="ecp-stat-label">Active site</span>
          </div>
        </div>

        <div className="ecp-toolbar">
          <div className="ecp-search">
            <SearchIcon />
            <input
              type="text"
              placeholder="Search collected emails…"
              value={search}
              onChange={(e) => setSearch(e.target.value)}
            />
          </div>

          <div className="ecp-actions">
            <div className="ecp-toolbar-group">
              <button
                type="button"
                className="ecp-action-btn"
                disabled={leads.length === 0 || busyAction === 'download'}
                onClick={() => runExport('csv')}
              >
                <DownloadIcon />
                Download all ({leads.length})
              </button>
              {upsellFor === 'download' && (
                <UpsellPopover onClose={() => setUpsellFor(null)} onUpgrade={() => router.push('/dashboard/plans')} />
              )}
            </div>

            <div className="ecp-toolbar-group">
              <button
                type="button"
                className="ecp-action-btn is-primary"
                disabled={leads.length === 0 || busyAction === 'export'}
                onClick={() => runExport('json')}
              >
                <ExportIcon />
                Export all
              </button>
              {upsellFor === 'export' && (
                <UpsellPopover onClose={() => setUpsellFor(null)} onUpgrade={() => router.push('/dashboard/plans')} />
              )}
            </div>

            <button type="button" className="ecp-action-btn is-bin" onClick={() => setBinOpen(true)}>
              <BinIcon />
              Bin
              {bin.length > 0 && <span className="ecp-bin-count">{bin.length}</span>}
            </button>
          </div>
        </div>

        {filtered.length === 0 ? (
          leads.length === 0 ? (
            <div className="ecp-empty">
              <div className="ecp-empty-mascot">
                <MailIcon />
              </div>
              <h2>No emails yet</h2>
              <p>Once visitors start sharing their email through your widget, they&apos;ll show up here.</p>
            </div>
          ) : (
            <div className="ecp-empty-match">No emails match your search.</div>
          )
        ) : (
          <div className="ecp-list">
            {filtered.map((lead) => (
              <div className="ecp-row" key={lead.id}>
                <div className="ecp-row-avatar">{initialOf(lead.email)}</div>
                <div className="ecp-row-main">
                  <span className="ecp-row-email">{lead.email || '—'}</span>
                  <span className="ecp-row-meta">
                    Captured {formatTs(lead.ts)}
                    {lead.source === 'overlay-notify' && <span className="ecp-source-badge">Notify me</span>}
                  </span>
                </div>
                <span className="ecp-row-time">{formatTs(lead.ts)}</span>
                <div className="ecp-row-actions">
                  <button
                    type="button"
                    className={`ecp-icon-btn is-copy${copiedId === lead.id ? ' is-copied' : ''}`}
                    title="Copy email"
                    aria-label="Copy email"
                    onClick={() => copyEmail(lead)}
                  >
                    {copiedId === lead.id ? <CheckIcon /> : <CopyIcon />}
                  </button>
                  <button
                    type="button"
                    className="ecp-icon-btn is-contact"
                    title="Email this person"
                    aria-label="Email this person"
                    onClick={() => contactEmail(lead)}
                  >
                    <MailIcon />
                  </button>
                  <button
                    type="button"
                    className="ecp-icon-btn is-delete"
                    title="Delete"
                    aria-label="Delete"
                    disabled={busyAction === lead.id}
                    onClick={() => handleDelete(lead)}
                  >
                    <DeleteIcon />
                  </button>
                </div>
              </div>
            ))}
          </div>
        )}
      </div>

      {binOpen && (
        <div className="ecp-bin-overlay" onClick={() => setBinOpen(false)}>
          <div className="ecp-bin-panel" onClick={(e) => e.stopPropagation()}>
            <div className="ecp-bin-head">
              <h2>
                <BinIcon />
                Bin
              </h2>
              <button type="button" className="ecp-bin-close" aria-label="Close" onClick={() => setBinOpen(false)}>
                <CloseIcon />
              </button>
            </div>
            <p className="ecp-bin-note">Deleted emails land here. Restore one if it was a mistake.</p>

            {bin.length === 0 ? (
              <div className="ecp-bin-empty">The bin is empty.</div>
            ) : (
              bin.map((lead) => (
                <div className="ecp-bin-row" key={lead.id}>
                  <div className="ecp-row-main">
                    <span className="ecp-row-email">{lead.email || '—'}</span>
                    <span className="ecp-row-time">Captured {formatTs(lead.ts)}</span>
                  </div>
                  <button
                    type="button"
                    className="ecp-icon-btn is-restore"
                    title="Restore"
                    aria-label="Restore"
                    disabled={busyAction === lead.id}
                    onClick={() => handleRestore(lead)}
                  >
                    <RestoreIcon />
                  </button>
                </div>
              ))
            )}
          </div>
        </div>
      )}
    </div>
  );
}

function UpsellPopover({ onClose, onUpgrade }: { onClose: () => void; onUpgrade: () => void }) {
  const ref = useRef<HTMLDivElement>(null);
  return (
    <div className="ecp-upsell-pop" ref={ref} role="dialog" aria-label="Upgrade required">
      <span className="ecp-lock-badge" style={{ marginBottom: 6, display: 'inline-flex' }}>
        <LockIcon />
      </span>
      <div>
        You&apos;ve hit today&apos;s export limit on your <strong>Free</strong> plan. Upgrade for a much higher
        daily export allowance.
      </div>
      <button type="button" className="ecp-upsell-cta" onClick={onUpgrade}>
        See plans
      </button>
      <button
        type="button"
        onClick={onClose}
        style={{
          display: 'block',
          marginTop: 8,
          background: 'none',
          border: 'none',
          color: 'var(--cream)',
          opacity: 0.7,
          fontSize: 11.5,
          cursor: 'pointer',
          padding: 0,
        }}
      >
        Dismiss
      </button>
    </div>
  );
}
