'use client';

// components/dashboard/UsersPage.tsx
//
// Standalone "Users" page, mounted at /dashboard/users (see that
// route's page.tsx and DashboardClient.tsx's view="users"). Lists
// UNIQUE visitors — one card per real person, not per page view — for
// the active site, sourced from hooks/useVisitorProfiles.ts's
// visitorProfiles subscription (see that hook and VisitorProfile in
// lib/types.ts).
//
// Since sitevento has no access to a visitor's real identity (no login
// data from the owner's own site — that's a future "connect your
// database" API, not this), there's no real name or photo to show.
// Instead: the visitor's geo-derived country flag stands in for a
// profile picture (lib/countries.ts's countryCodeToFlag), and a
// stable, sequential "User #N" stands in for a name — assigned once,
// the first time that visitor was ever seen on this site (see
// upsertVisitorProfile in app/api/track/route.ts), using the SAME
// durable visitorId that now survives a localStorage clear (see that
// route's device-recovery header comment) — so "User #1" reliably
// stays the first real visitor this site ever had, not just the first
// row with a fresh-looking id.
//
// Same page shell/bin/search conventions as EmailCapturePage.tsx
// (this file's closest sibling) and the same lime "premium card"
// visual language as MonetizationDashboard.tsx/AgentPageClient.tsx —
// see styles/dashboard/users-page.css's header comment.
//
// Quick actions per card: Restrict (timed), Block (permanent, reuses
// app/api/block-visitor via the hook), Message (UI only — no backend
// yet, see handleMessage below), and Delete (soft-delete to the Bin,
// same restore-later pattern as EmailCapturePage's email bin).
import { useMemo, useState } from 'react';
import { useNavRouter } from '@/hooks/useNavPending';
import type { User } from 'firebase/auth';
import { useSites } from '@/hooks/useSites';
import { useVisitorProfiles } from '@/hooks/useVisitorProfiles';
import { isRestricted } from '@/hooks/useActiveSiteData';
import { formatTs } from '@/lib/format';
import { countryCodeToFlag, getCountryName } from '@/lib/countries';
import { AppSkeleton } from '@/components/AppSkeleton';
import { ConfirmPopup } from '@/components/widgets/WidgetStatusPopup';
import type { VisitorProfile } from '@/lib/types';
import '@/styles/dashboard/users-page.css';

interface UsersPageProps {
  user: User;
}

function BackIcon() {
  return (
    <svg viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth={2.2} aria-hidden="true">
      <path d="M15 18l-6-6 6-6" />
    </svg>
  );
}
function UsersIcon() {
  return (
    <svg viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth={1.8} aria-hidden="true">
      <circle cx="9" cy="8" r="3.4" />
      <path d="M2.5 19c0-3.6 2.9-6.2 6.5-6.2s6.5 2.6 6.5 6.2" />
      <path d="M16.3 13.2c2.9.5 4.7 2.8 4.7 5.8" />
      <circle cx="16" cy="7.2" r="2.4" />
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
function BinIcon() {
  return (
    <svg viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth={1.8} aria-hidden="true">
      <path d="M4 7h16M9 7V5a2 2 0 0 1 2-2h2a2 2 0 0 1 2 2v2m-9 0l1 13a2 2 0 0 0 2 2h6a2 2 0 0 0 2-2l1-13" />
      <path d="M10 11v6M14 11v6" />
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
function RestoreIcon() {
  return (
    <svg viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth={2} aria-hidden="true">
      <path d="M3 12a9 9 0 1 0 3-6.7" />
      <path d="M3 4v5h5" />
    </svg>
  );
}
function ClockIcon() {
  return (
    <svg viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth={1.8} aria-hidden="true">
      <circle cx="12" cy="12" r="9" />
      <path d="M12 7v5l3.5 2" />
    </svg>
  );
}
function BlockIcon() {
  return (
    <svg viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth={1.8} aria-hidden="true">
      <circle cx="12" cy="12" r="9" />
      <path d="M5.6 5.6l12.8 12.8" />
    </svg>
  );
}
function MessageIcon() {
  return (
    <svg viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth={1.8} aria-hidden="true">
      <path d="M4 5h16v11H7l-3 3V5Z" />
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
function DeviceIcon({ device }: { device?: string }) {
  if (device === 'Mobile') {
    return (
      <svg viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth={1.8} aria-hidden="true">
        <rect x="7" y="2" width="10" height="20" rx="2" />
        <path d="M11 18h2" />
      </svg>
    );
  }
  if (device === 'Tablet') {
    return (
      <svg viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth={1.8} aria-hidden="true">
        <rect x="4" y="3" width="16" height="18" rx="2" />
        <path d="M11 18h2" />
      </svg>
    );
  }
  return (
    <svg viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth={1.8} aria-hidden="true">
      <rect x="3" y="4" width="18" height="12" rx="1.5" />
      <path d="M8 20h8M12 16v4" />
    </svg>
  );
}

const RESTRICT_OPTIONS: { label: string; ms: number }[] = [
  { label: '1 hour', ms: 60 * 60 * 1000 },
  { label: '24 hours', ms: 24 * 60 * 60 * 1000 },
  { label: '7 days', ms: 7 * 24 * 60 * 60 * 1000 },
];

export function UsersPage({ user }: UsersPageProps) {
  const router = useNavRouter();
  const { sites, activeSiteId, setActiveSiteId, dashState } = useSites(user.uid);
  const { profiles, bin, loading, blockVisitor, restrictVisitor, deleteVisitor, restoreVisitor } = useVisitorProfiles(
    user.uid,
    activeSiteId,
    user
  );

  const [search, setSearch] = useState('');
  const [binOpen, setBinOpen] = useState(false);
  const [busyId, setBusyId] = useState<string | null>(null);
  const [restrictMenuFor, setRestrictMenuFor] = useState<string | null>(null);
  const [confirmDeleteFor, setConfirmDeleteFor] = useState<VisitorProfile | null>(null);
  const [messagedId, setMessagedId] = useState<string | null>(null);

  const activeSite = sites.find((s) => s.id === activeSiteId) || null;

  const filtered = useMemo(() => {
    const q = search.trim().toLowerCase();
    if (!q) return profiles;
    return profiles.filter((p) => {
      const label = `user #${p.number}`;
      const country = getCountryName(p.country || '').toLowerCase();
      return label.includes(q) || country.includes(q) || (p.visitorId || '').toLowerCase().includes(q);
    });
  }, [profiles, search]);

  const restrictedCount = useMemo(() => profiles.filter((p) => isRestricted(p)).length, [profiles]);
  const blockedCount = useMemo(() => profiles.filter((p) => p.blocked).length, [profiles]);

  async function handleBlockToggle(profile: VisitorProfile) {
    setBusyId(profile.visitorId);
    setRestrictMenuFor(null);
    const result = await blockVisitor(profile.visitorId, !profile.blocked);
    if (!result.ok) {
      if (result.code === 'FEATURE_LIMIT_REACHED') {
        window.alert(result.error || `Daily blocking limit reached (${result.limit}/day). Upgrade for a higher limit.`);
      } else {
        window.alert(result.error || 'Could not update that user right now.');
      }
    }
    setBusyId(null);
  }

  async function handleRestrict(profile: VisitorProfile, ms: number | null) {
    setBusyId(profile.visitorId);
    setRestrictMenuFor(null);
    const result = await restrictVisitor(profile.visitorId, ms);
    if (!result.ok) {
      window.alert(result.error || 'Could not update that user right now.');
    }
    setBusyId(null);
  }

  // No backend for this yet — see this component's header comment.
  // Purely a UI affordance for now: shows a brief "sent" confirmation
  // state on the button so the control doesn't feel dead, with
  // nothing actually dispatched anywhere.
  function handleMessage(profile: VisitorProfile) {
    setMessagedId(profile.visitorId);
    setTimeout(() => setMessagedId((cur) => (cur === profile.visitorId ? null : cur)), 1800);
  }

  async function handleDeleteConfirmed() {
    if (!confirmDeleteFor) return;
    setBusyId(confirmDeleteFor.visitorId);
    const result = await deleteVisitor(confirmDeleteFor.visitorId);
    if (!result.ok) {
      window.alert(result.error || 'Could not delete that user right now.');
    }
    setBusyId(null);
    setConfirmDeleteFor(null);
  }

  async function handleRestore(profile: VisitorProfile) {
    setBusyId(profile.visitorId);
    await restoreVisitor(profile.visitorId);
    setBusyId(null);
  }

  if (dashState === 'loading' || loading) {
    return (
      <div className="usr-main">
        <div className="usr-wrap">
          <AppSkeleton label="Loading users" />
        </div>
      </div>
    );
  }

  if (dashState === 'empty' || !activeSite) {
    return (
      <div className="usr-main">
        <div className="usr-wrap">
          <button type="button" className="usr-back" onClick={() => router.push('/dashboard')}>
            <BackIcon />
            Back to dashboard
          </button>
          <div className="usr-empty">
            <div className="usr-empty-icon">
              <UsersIcon />
            </div>
            <h2>No sites connected yet</h2>
            <p>Connect a site to start recognizing your visitors here.</p>
            <button type="button" className="btn-primary" onClick={() => router.push('/dashboard?connect=1')}>
              Connect your site
            </button>
          </div>
        </div>
      </div>
    );
  }

  return (
    <div className="usr-main">
      <div className="usr-wrap">
        <button type="button" className="usr-back" onClick={() => router.push('/dashboard')}>
          <BackIcon />
          Back to dashboard
        </button>

        {/* Page head — same dark lime-glow "hero" card treatment as
            agt-head (styles/agent/agent-page.css), so Users reads as
            part of the same premium feature family as the AI Agent
            and Monetization pages. */}
        <div className="usr-head">
          <div className="usr-head-top">
            <h1>
              <span className="usr-head-icon">
                <UsersIcon />
              </span>
              Users
            </h1>
            {sites.length > 1 && (
              <select
                className="usr-site-select"
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
          <p>
            Every unique visitor to {activeSite.name || activeSite.url} — recognized by device, even if they clear
            their browser data, so the same person stays the same user.
          </p>
        </div>

        <div className="usr-stat-grid">
          <div className="usr-stat-tile usr-tone-green">
            <span className="usr-stat-num">{profiles.length}</span>
            <span className="usr-stat-label">Unique users</span>
          </div>
          <div className="usr-stat-tile usr-tone-blue">
            <span className="usr-stat-num">{filtered.length}</span>
            <span className="usr-stat-label">Matching search</span>
          </div>
          <div className="usr-stat-tile usr-tone-orange">
            <span className="usr-stat-num">{restrictedCount}</span>
            <span className="usr-stat-label">Restricted</span>
          </div>
          <div className="usr-stat-tile usr-tone-purple">
            <span className="usr-stat-num">{blockedCount}</span>
            <span className="usr-stat-label">Blocked</span>
          </div>
        </div>

        <div className="usr-toolbar">
          <div className="usr-search">
            <SearchIcon />
            <input
              type="text"
              placeholder="Search by user number or country…"
              value={search}
              onChange={(e) => setSearch(e.target.value)}
            />
          </div>
          <button type="button" className="usr-action-btn is-bin" onClick={() => setBinOpen(true)}>
            <BinIcon />
            Bin
            {bin.length > 0 && <span className="usr-bin-count">{bin.length}</span>}
          </button>
        </div>

        {filtered.length === 0 ? (
          profiles.length === 0 ? (
            <div className="usr-empty">
              <div className="usr-empty-icon">
                <UsersIcon />
              </div>
              <h2>No visitors yet</h2>
              <p>Once real visitors land on your site, they&apos;ll show up here as recognized users.</p>
            </div>
          ) : (
            <div className="usr-empty-match">No users match your search.</div>
          )
        ) : (
          <div className="usr-grid">
            {filtered.map((profile) => {
              const restricted = isRestricted(profile);
              const busy = busyId === profile.visitorId;
              return (
                <div className={`usr-card${profile.blocked ? ' is-blocked' : ''}${restricted ? ' is-restricted' : ''}`} key={profile.id}>
                  <div className="usr-card-top">
                    <div className="usr-flag-avatar" title={getCountryName(profile.country || '')}>
                      {countryCodeToFlag(profile.country)}
                    </div>
                    <div className="usr-card-id">
                      <span className="usr-card-name">User #{profile.number}</span>
                      <span className="usr-card-country">{getCountryName(profile.country || '') || 'Unknown location'}</span>
                    </div>
                    {profile.blocked && <span className="usr-badge is-blocked">Blocked</span>}
                    {!profile.blocked && restricted && <span className="usr-badge is-restricted">Restricted</span>}
                  </div>

                  <div className="usr-card-meta">
                    <div className="usr-meta-row">
                      <DeviceIcon device={profile.device} />
                      <span>
                        {profile.device || 'Unknown device'}
                        {profile.browser ? ` · ${profile.browser}` : ''}
                      </span>
                    </div>
                    <div className="usr-meta-row">
                      <ClockIcon />
                      <span>Registered {formatTs(profile.firstSeenAt)}</span>
                    </div>
                    <div className="usr-meta-row">
                      <ClockIcon />
                      <span>Last seen {formatTs(profile.lastSeenAt)}</span>
                    </div>
                  </div>

                  <div className="usr-card-visits">
                    <span className="usr-visits-num">{profile.visitCount}</span>
                    <span className="usr-visits-label">{profile.visitCount === 1 ? 'visit' : 'visits'}</span>
                  </div>

                  <div className="usr-card-actions">
                    <div className="usr-action-group">
                      <button
                        type="button"
                        className={`usr-qa-btn${restricted ? ' is-active' : ''}`}
                        disabled={busy}
                        onClick={() => setRestrictMenuFor((cur) => (cur === profile.visitorId ? null : profile.visitorId))}
                      >
                        <ClockIcon />
                        Restrict
                      </button>
                      {restrictMenuFor === profile.visitorId && (
                        <div className="usr-restrict-menu" role="menu">
                          {RESTRICT_OPTIONS.map((opt) => (
                            <button key={opt.label} type="button" onClick={() => handleRestrict(profile, opt.ms)}>
                              {opt.label}
                            </button>
                          ))}
                          {restricted && (
                            <button type="button" className="is-clear" onClick={() => handleRestrict(profile, null)}>
                              Lift restriction
                            </button>
                          )}
                        </div>
                      )}
                    </div>

                    <button
                      type="button"
                      className={`usr-qa-btn${profile.blocked ? ' is-active is-danger' : ''}`}
                      disabled={busy}
                      onClick={() => handleBlockToggle(profile)}
                    >
                      <BlockIcon />
                      {profile.blocked ? 'Unblock' : 'Block'}
                    </button>

                    <button
                      type="button"
                      className={`usr-qa-btn${messagedId === profile.visitorId ? ' is-active' : ''}`}
                      onClick={() => handleMessage(profile)}
                    >
                      <MessageIcon />
                      {messagedId === profile.visitorId ? 'Sent' : 'Message'}
                    </button>

                    <button
                      type="button"
                      className="usr-qa-btn is-danger"
                      disabled={busy}
                      onClick={() => setConfirmDeleteFor(profile)}
                    >
                      <DeleteIcon />
                      Delete
                    </button>
                  </div>
                </div>
              );
            })}
          </div>
        )}
      </div>

      {binOpen && (
        <div className="usr-bin-overlay" onClick={() => setBinOpen(false)}>
          <div className="usr-bin-panel" onClick={(e) => e.stopPropagation()}>
            <div className="usr-bin-head">
              <h2>
                <BinIcon />
                Bin
              </h2>
              <button type="button" className="usr-bin-close" aria-label="Close" onClick={() => setBinOpen(false)}>
                <CloseIcon />
              </button>
            </div>
            <p className="usr-bin-note">Deleted users land here. Restore one if it was a mistake.</p>

            {bin.length === 0 ? (
              <div className="usr-bin-empty">The bin is empty.</div>
            ) : (
              bin.map((profile) => (
                <div className="usr-bin-row" key={profile.id}>
                  <div className="usr-flag-avatar is-small">{countryCodeToFlag(profile.country)}</div>
                  <div className="usr-row-main">
                    <span className="usr-row-name">User #{profile.number}</span>
                    <span className="usr-row-time">Registered {formatTs(profile.firstSeenAt)}</span>
                  </div>
                  <button
                    type="button"
                    className="usr-icon-btn is-restore"
                    title="Restore"
                    aria-label="Restore"
                    disabled={busyId === profile.visitorId}
                    onClick={() => handleRestore(profile)}
                  >
                    <RestoreIcon />
                  </button>
                </div>
              ))
            )}
          </div>
        </div>
      )}

      <ConfirmPopup
        open={!!confirmDeleteFor}
        title="Delete this user?"
        message={
          confirmDeleteFor
            ? `User #${confirmDeleteFor.number} will move to the bin. You can restore them later — their visit history isn't affected.`
            : ''
        }
        confirmLabel="Delete"
        danger
        busy={!!busyId && busyId === confirmDeleteFor?.visitorId}
        onConfirm={handleDeleteConfirmed}
        onClose={() => setConfirmDeleteFor(null)}
      />
    </div>
  );
}
