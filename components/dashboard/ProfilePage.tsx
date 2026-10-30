'use client';

// components/dashboard/ProfilePage.tsx
//
// Full rebuild of the profile/account page (previously three bare
// sections: identity card, plan banner, connected-sites list). Same
// data in — `user` (Firebase Auth) and `sites` (Firestore) are still
// the only inputs, nothing new fetched — but reshaped into a proper
// account hub: a lime-native hero (matching DashboardShell's own
// .dnx-hero), an identity card enriched with real account metadata
// (sign-in provider, verified/unverified email, member-since date —
// all already present on the Firebase `User` object, just never read
// before), an account-wide activity summary aggregated client-side
// across every connected site's own stats (not a new query — `sites`
// already carries `overlayStats`/`status`/`lastSeenAt` per site), a
// fuller plan card that surfaces real plan.limits/.highlights instead
// of just the site-count bar, a restyled connected-sites rail, and a
// quick-links grid out to the other places account-level settings
// actually live (Settings' Security/Danger Zone panels, Plans, Widgets,
// Docs, Support) rather than duplicating them here.
//
// Styling lives entirely in styles/dashboard/profile-page.css under its own
// `pfx-` namespace, built on the same --dnx-glass/--dnx-shadow/--lime
// tokens dashboard-premium.css defines, so this reads as one continuous
// design language with the rest of the dashboard rather than a
// one-off page.
import { useEffect, useMemo, useState } from 'react';
import { useNavRouter } from '@/hooks/useNavPending';
import type { User } from 'firebase/auth';
import type { Site } from '@/lib/types';
import { PLANS, getPlan, type PlanId } from '@/lib/plans';
import { useUserProfile } from '@/hooks/useUserProfile';
import { useAccountLimits } from '@/hooks/useAccountLimits';
import { useWallet } from '@/hooks/useWallet';
import { useWriteLimitAlert } from '@/hooks/useWriteLimitAlert';
import { GoogleIcon } from '@/components/auth/GoogleIcon';
import { DailyLimitCard } from './DailyLimitCard';
import { WriteLimitAlertModal } from './WriteLimitAlertModal';

interface ProfilePageProps {
  user: User;
  sites: Site[];
  onDisconnectSite: (siteId: string) => Promise<void> | Promise<boolean> | void;
  onAddSite: () => void;
}

// PLANS is already ordered free → starter → scale → pro-developer, so
// "the next tier up" is just the next array entry rather than
// something lib/plans.ts needs to expose itself.
function nextPlan(id: PlanId) {
  const i = PLANS.findIndex((p) => p.id === id);
  if (i === -1 || i === PLANS.length - 1) return null;
  return PLANS[i + 1];
}

function formatJoinDate(iso: string | null | undefined) {
  if (!iso) return null;
  const d = new Date(iso);
  if (isNaN(d.getTime())) return null;
  return d.toLocaleDateString('en-US', { month: 'long', year: 'numeric' });
}

function toDateSafe(ts: { toDate: () => Date } | null | undefined): Date | null {
  if (!ts || typeof ts.toDate !== 'function') return null;
  try {
    return ts.toDate();
  } catch {
    return null;
  }
}

export function ProfilePage({ user, sites, onDisconnectSite, onAddSite }: ProfilePageProps) {
  const router = useNavRouter();
  const { planId, updateDisplayName } = useUserProfile(user);
  const { limits: accountLimits } = useAccountLimits(user);
  const { wallet, setAutoRecharge } = useWallet(user);
  const writeLimitAlert = useWriteLimitAlert(user.uid, accountLimits?.writeUsage);
  const plan = getPlan(planId);
  const upgrade = nextPlan(planId);

  const usedCount = sites.length;
  const limit = plan.limits.connectedSites;
  const atLimit = usedCount >= limit;
  const usagePct = Math.min(100, (usedCount / Math.max(limit, 1)) * 100);

  // ── Name editing ────────────────────────────────────────────────
  const [name, setName] = useState(user.displayName || '');
  const [savingName, setSavingName] = useState(false);
  const [nameToast, setNameToast] = useState<'ok' | 'error' | null>(null);
  useEffect(() => setName(user.displayName || ''), [user.displayName]);
  const nameDirty = name.trim() !== (user.displayName || '').trim() && name.trim().length > 0;

  async function handleSaveName() {
    setSavingName(true);
    const ok = await updateDisplayName(name);
    setSavingName(false);
    setNameToast(ok ? 'ok' : 'error');
    setTimeout(() => setNameToast(null), 2800);
  }

  // ── Disconnect confirm ──────────────────────────────────────────
  const [confirmId, setConfirmId] = useState<string | null>(null);
  const [busyId, setBusyId] = useState<string | null>(null);
  async function handleConfirmDisconnect() {
    if (!confirmId) return;
    setBusyId(confirmId);
    try {
      await onDisconnectSite(confirmId);
    } finally {
      setBusyId(null);
      setConfirmId(null);
    }
  }

  const initial = (user.displayName || user.email || '?').trim().charAt(0).toUpperCase();
  const joinDate = formatJoinDate(user.metadata?.creationTime);
  const isGoogleLinked = user.providerData.some((p) => p.providerId === 'google.com');
  const emailVerified = user.emailVerified;

  // ── Account-wide activity, aggregated across every connected site.
  // Nothing new fetched — `sites` already carries each site's own
  // overlayStats/status/lastSeenAt from Firestore (see lib/types.ts),
  // this just rolls them up into one summary row instead of repeating
  // per-site data that's already visible lower on the page.
  const totals = useMemo(() => {
    const verified = sites.filter((s) => s.status === 'verified').length;
    const pending = sites.length - verified;
    const liveSites = sites.filter((s) => s.overlay?.active).length;
    const impressions = sites.reduce((sum, s) => sum + (s.overlayStats?.impressions || 0), 0);
    const ctaClicks = sites.reduce((sum, s) => sum + (s.overlayStats?.ctaClicks || 0), 0);
    const noTraffic = sites.filter((s) => s.status === 'verified' && !s.lastSeenAt).length;
    const mostRecentVerified = sites.reduce<Date | null>((latest, s) => {
      const d = toDateSafe(s.verifiedAt);
      if (!d) return latest;
      return !latest || d > latest ? d : latest;
    }, null);
    return { verified, pending, liveSites, impressions, ctaClicks, noTraffic, mostRecentVerified };
  }, [sites]);

  const quickLinks = [
    {
      key: 'security',
      label: 'Security',
      desc: 'Password, sessions & sign-in',
      href: '/settings/security',
      icon: (
        <svg viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth={1.8}>
          <rect x="4" y="11" width="16" height="9" rx="2" />
          <path d="M8 11V7a4 4 0 0 1 8 0v4" />
        </svg>
      ),
    },
    {
      key: 'widgets',
      label: 'Widgets',
      desc: 'Browse the widget catalog',
      href: '/widgets',
      icon: (
        <svg viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth={1.8}>
          <rect x="3" y="3" width="7" height="7" rx="1.5" />
          <rect x="14" y="3" width="7" height="7" rx="1.5" />
          <rect x="3" y="14" width="7" height="7" rx="1.5" />
          <rect x="14" y="14" width="7" height="7" rx="1.5" />
        </svg>
      ),
    },
    {
      key: 'wallet',
      label: 'Wallet',
      desc: 'Add funds for extra writes',
      href: '/dashboard/wallet',
      icon: (
        <svg viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth={1.8}>
          <rect x="3" y="6" width="18" height="13" rx="2.5" />
          <path d="M3 10h18" />
          <circle cx="16.5" cy="14" r="1.4" fill="currentColor" stroke="none" />
        </svg>
      ),
    },
    {
      key: 'agent',
      label: 'Site Agent',
      desc: 'AI assistant for your sites',
      href: '/dashboard/agent',
      icon: (
        <svg viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth={1.8}>
          <circle cx="12" cy="12" r="3" />
          <path d="M12 3v3M12 18v3M4.2 7.2l2.1 2.1M17.7 14.7l2.1 2.1M3 12h3M18 12h3M4.2 16.8l2.1-2.1M17.7 9.3l2.1-2.1" />
        </svg>
      ),
    },
    {
      key: 'docs',
      label: 'Docs',
      desc: 'Setup guides & reference',
      href: '/docs',
      icon: (
        <svg viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth={1.8}>
          <path d="M6 4h9l3 3v13H6z" />
          <path d="M15 4v3h3M9 12h6M9 16h6" />
        </svg>
      ),
    },
    {
      key: 'support',
      label: 'Support',
      desc: 'Get help from the team',
      href: '/support',
      icon: (
        <svg viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth={1.8}>
          <path d="M4 12a8 8 0 1 1 3.5 6.6L4 20l1.1-3.2A7.96 7.96 0 0 1 4 12z" />
        </svg>
      ),
    },
    {
      key: 'danger',
      label: 'Danger Zone',
      desc: 'Delete account & data',
      href: '/settings/danger',
      icon: (
        <svg viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth={1.8}>
          <path d="M12 9v4M12 17h.01" />
          <path d="M10.3 3.9 2.6 17.2A1.8 1.8 0 0 0 4.2 20h15.6a1.8 1.8 0 0 0 1.6-2.8L13.7 3.9a1.8 1.8 0 0 0-3.4 0z" />
        </svg>
      ),
      tone: 'danger' as const,
    },
  ];

  return (
    <section>
      <div className="dnx-wrap pfx-wrap">
        {/* ── Hero ─────────────────────────────────────────────── */}
        <div className="dnx-hero pfx-hero">
          <div className="pfx-hero-top">
            <div className="pfx-hero-avatar" aria-hidden="true">
              {user.photoURL ? <img src={user.photoURL} alt="" /> : <span>{initial}</span>}
            </div>
            <div>
              <h1 className="dnx-hero-title">{user.displayName || 'Your profile'}</h1>
              <p className="dnx-hero-sub">{user.email}</p>
            </div>
          </div>
          <div className="pfx-hero-meta">
            <div className="pfx-hero-stat">
              <span className="pfx-hero-stat-icon" aria-hidden="true">
                <svg viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth={2}>
                  <path d="M12 3l7 3v5c0 5-3.2 8.3-7 10-3.8-1.7-7-5-7-10V6l7-3z" />
                </svg>
              </span>
              <span className="pfx-hero-stat-text">
                <span className="pfx-hero-stat-label">Plan</span>
                <span className="pfx-hero-stat-value">{plan.name}</span>
              </span>
            </div>

            <div className="pfx-hero-stat">
              <span className="pfx-hero-stat-icon" aria-hidden="true">
                <svg viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth={2}>
                  <rect x="3" y="5" width="18" height="16" rx="2" />
                  <path d="M3 10h18M8 3v4M16 3v4" />
                </svg>
              </span>
              <span className="pfx-hero-stat-text">
                <span className="pfx-hero-stat-label">Member since</span>
                <span className="pfx-hero-stat-value">{joinDate || '\u2014'}</span>
              </span>
            </div>

            <div className="pfx-hero-stat">
              <span className="pfx-hero-stat-icon" aria-hidden="true">
                {isGoogleLinked ? (
                  <GoogleIcon />
                ) : (
                  <svg viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth={2}>
                    <rect x="3" y="5" width="18" height="14" rx="2" />
                    <path d="m3 7 9 6 9-6" />
                  </svg>
                )}
              </span>
              <span className="pfx-hero-stat-text">
                <span className="pfx-hero-stat-label">Sign-in</span>
                <span className="pfx-hero-stat-value">{isGoogleLinked ? 'Google' : 'Email & password'}</span>
              </span>
            </div>
          </div>
        </div>

        <div className="pfx-grid">
          {/* ── Left column: identity + plan ──────────────────── */}
          <div className="pfx-col-main">
            {/* Identity card */}
            <div className="pfx-card">
              <div className="pfx-card-head">
                <h2>Account details</h2>
              </div>
              <div className="pfx-field-grid">
                <label className="pfx-field">
                  <span className="pfx-field-label">Name</span>
                  <div className="pfx-field-row">
                    <input
                      className="pfx-input"
                      value={name}
                      maxLength={80}
                      placeholder="Your name"
                      onChange={(e) => setName(e.target.value)}
                    />
                    <button
                      type="button"
                      className="pfx-save-btn"
                      disabled={!nameDirty || savingName}
                      onClick={handleSaveName}
                    >
                      {savingName ? 'Saving\u2026' : 'Save'}
                    </button>
                  </div>
                  {nameToast === 'ok' && <span className="pfx-field-note is-ok">Name updated.</span>}
                  {nameToast === 'error' && <span className="pfx-field-note is-error">Couldn&apos;t save. Try again.</span>}
                </label>

                <label className="pfx-field">
                  <span className="pfx-field-label">Email</span>
                  <div className="pfx-field-row">
                    <input className="pfx-input" value={user.email || ''} readOnly disabled />
                    <span className={`pfx-verify-pill${emailVerified ? ' is-verified' : ''}`}>
                      {emailVerified ? 'Verified' : 'Unverified'}
                    </span>
                  </div>
                  <span className="pfx-field-note">Contact support to change the email on your account.</span>
                </label>
              </div>
            </div>

            {/* Activity summary */}
            <div className="pfx-card">
              <div className="pfx-card-head">
                <h2>Account activity</h2>
                <span className="pfx-card-head-sub">Across all {sites.length === 1 ? 'your site' : 'your sites'}</span>
              </div>
              <div className="pfx-stat-row">
                <div className="pfx-stat pfx-tone-green">
                  <span className="pfx-stat-num">{totals.verified}</span>
                  <span className="pfx-stat-label">Verified sites</span>
                </div>
                <div className="pfx-stat pfx-tone-orange">
                  <span className="pfx-stat-num">{totals.pending}</span>
                  <span className="pfx-stat-label">Pending verify</span>
                </div>
                <div className="pfx-stat pfx-tone-purple">
                  <span className="pfx-stat-num">{totals.liveSites}</span>
                  <span className="pfx-stat-label">Banners live now</span>
                </div>
                <div className="pfx-stat pfx-tone-blue">
                  <span className="pfx-stat-num">{totals.impressions.toLocaleString()}</span>
                  <span className="pfx-stat-label">Overlay impressions</span>
                </div>
              </div>
              {(totals.noTraffic > 0 || totals.ctaClicks > 0 || totals.mostRecentVerified) && (
                <div className="pfx-activity-notes">
                  {totals.ctaClicks > 0 && (
                    <span className="pfx-activity-note">
                      <strong>{totals.ctaClicks.toLocaleString()}</strong> overlay CTA clicks total
                    </span>
                  )}
                  {totals.mostRecentVerified && (
                    <span className="pfx-activity-note">
                      Last site verified{' '}
                      <strong>
                        {totals.mostRecentVerified.toLocaleString(undefined, { month: 'short', day: 'numeric', year: 'numeric' })}
                      </strong>
                    </span>
                  )}
                  {totals.noTraffic > 0 && (
                    <span className="pfx-activity-note is-warn">
                      <strong>{totals.noTraffic}</strong> verified {totals.noTraffic === 1 ? 'site has' : 'sites have'} no recorded traffic yet
                    </span>
                  )}
                </div>
              )}
            </div>

            {/* Daily limits */}
            <DailyLimitCard
              planId={planId}
              writeUsage={accountLimits?.writeUsage}
              dailyWriteLimits={accountLimits?.dailyWriteLimits}
              walletBalanceUsd={accountLimits?.wallet?.balanceUsd}
              onUpgrade={() => router.push('/dashboard/plans')}
              onOpenWallet={() => router.push('/dashboard/wallet')}
              variant="full"
            />

            {/* Plan card */}
            <div className={`pfx-card pfx-plan-card${atLimit ? ' is-urgent' : ''}`}>
              <div className="pfx-plan-glow" aria-hidden="true" />
              <div className="pfx-card-head">
                <h2>Your plan</h2>
                {atLimit && <span className="pfx-urgent-pill">Limit reached</span>}
              </div>
              <div className="pfx-plan-top">
                <span className="pfx-plan-price">
                  {plan.price === 0 ? 'Free' : `${plan.priceDisplay}/mo`}
                </span>
                <span className="pfx-plan-name">{plan.name} plan</span>
              </div>
              <p className="pfx-plan-tagline">{plan.tagline}</p>

              <div className="pfx-usage-row">
                <span className="pfx-usage-label">
                  {usedCount} of {limit} connected site{limit === 1 ? '' : 's'} used
                </span>
                <div className="pfx-usage-track" aria-hidden="true">
                  <div className="pfx-usage-fill" style={{ width: `${usagePct}%` }} />
                </div>
              </div>

              <ul className="pfx-plan-highlights">
                {plan.highlights.slice(0, 5).map((h) => (
                  <li key={h}>
                    <svg viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth={2.4} aria-hidden="true">
                      <path d="M5 13l4 4L19 7" />
                    </svg>
                    {h}
                  </li>
                ))}
              </ul>

              <div className="pfx-plan-actions">
                {upgrade && (
                  <button type="button" className="pfx-upgrade-btn" onClick={() => router.push('/dashboard/plans')}>
                    <svg viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth={2.2} strokeLinecap="round" strokeLinejoin="round">
                      <path d="M12 19V5M5 12l7-7 7 7" />
                    </svg>
                    {atLimit ? `Upgrade to ${upgrade.name}` : 'Upgrade plan'}
                  </button>
                )}
                <button type="button" className="pfx-ghost-btn" onClick={() => router.push('/dashboard/plans')}>
                  {upgrade ? 'Compare all plans' : 'Manage plan'}
                </button>
              </div>
            </div>
          </div>

          {/* ── Right column: sites + quick links ─────────────── */}
          <div className="pfx-col-side">
            <div className="pfx-card pfx-sites-card">
              <div className="pfx-card-head">
                <div>
                  <h2>Connected sites</h2>
                  <span className="pfx-card-head-sub">{usedCount} of {limit} used</span>
                </div>
                <button type="button" className="pfx-ghost-btn pfx-ghost-btn-sm" onClick={onAddSite} disabled={atLimit}>
                  + Add site
                </button>
              </div>

              {sites.length === 0 ? (
                <p className="pfx-sites-empty">No sites connected yet.</p>
              ) : (
                <ul className="pfx-site-list">
                  {sites.map((site) => (
                    <li className="pfx-site-row" key={site.id}>
                      <span className={`pfx-site-dot pfx-site-dot-${site.status}`} aria-hidden="true" />
                      <span className="pfx-site-info">
                        <span className="pfx-site-name">{site.name}</span>
                        <span className="pfx-site-url">{site.url}</span>
                      </span>
                      <span className="pfx-site-badges">
                        <span className={`pfx-site-status pfx-site-status-${site.status}`}>
                          {site.status === 'verified' ? 'Verified' : 'Pending'}
                        </span>
                        {site.status === 'verified' && !site.lastSeenAt && (
                          <span
                            className="pfx-site-status pfx-site-status-warn"
                            title="No visits recorded yet — double check the tracking script is live on your site."
                          >
                            No traffic yet
                          </span>
                        )}
                      </span>
                      <button
                        type="button"
                        className="pfx-site-disconnect"
                        onClick={() => setConfirmId(site.id)}
                        disabled={busyId === site.id}
                      >
                        Disconnect
                      </button>
                    </li>
                  ))}
                </ul>
              )}

              {atLimit && (
                <p className="pfx-limit-note">
                  You&rsquo;ve reached the {plan.name} plan&rsquo;s site limit.{' '}
                  {upgrade && (
                    <button type="button" className="pfx-inline-link" onClick={() => router.push('/dashboard/plans')}>
                      Upgrade to {upgrade.name}
                    </button>
                  )}{' '}
                  to connect more.
                </p>
              )}
            </div>

            {/* Quick links */}
            <div className="pfx-card pfx-quicklinks-card">
              <div className="pfx-card-head">
                <h2>More for your account</h2>
              </div>
              <div className="pfx-quicklinks-grid">
                {quickLinks.map((q) => (
                  <button
                    key={q.key}
                    type="button"
                    className={`pfx-quicklink${q.tone === 'danger' ? ' is-danger' : ''}`}
                    onClick={() => router.push(q.href)}
                  >
                    <span className="pfx-quicklink-icon">{q.icon}</span>
                    <span className="pfx-quicklink-text">
                      <span className="pfx-quicklink-name">{q.label}</span>
                      <span className="pfx-quicklink-desc">{q.desc}</span>
                    </span>
                    <svg className="pfx-quicklink-arrow" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth={2.2} aria-hidden="true">
                      <path d="M9 18l6-6-6-6" />
                    </svg>
                  </button>
                ))}
              </div>
            </div>
          </div>
        </div>
      </div>

      {/* ── Disconnect confirm ────────────────────────────────────── */}
      {confirmId && (
        <div className="pfx-sheet-backdrop" role="presentation" onClick={() => !busyId && setConfirmId(null)}>
          <div className="pfx-sheet" role="alertdialog" aria-modal="true" onClick={(e) => e.stopPropagation()}>
            <div className="pfx-sheet-title">Disconnect this site?</div>
            <p className="pfx-sheet-msg">
              The tracking tag will stop working and any live banner will disappear. This can&apos;t be undone.
            </p>
            <div className="pfx-sheet-actions">
              <button type="button" className="pfx-ghost-btn" onClick={() => setConfirmId(null)} disabled={!!busyId}>
                Cancel
              </button>
              <button type="button" className="pfx-danger-btn" onClick={handleConfirmDisconnect} disabled={!!busyId}>
                {busyId ? 'Working\u2026' : 'Disconnect'}
              </button>
            </div>
          </div>
        </div>
      )}

      <WriteLimitAlertModal
        severity={writeLimitAlert.severity}
        planId={planId}
        writeUsage={accountLimits?.writeUsage}
        wallet={wallet}
        onDismiss={writeLimitAlert.dismiss}
        onUpgrade={() => {
          writeLimitAlert.dismiss();
          router.push('/dashboard/plans');
        }}
        onOpenWallet={() => {
          writeLimitAlert.dismiss();
          router.push('/dashboard/wallet');
        }}
        onEnablePayAsYouGo={() => {
          setAutoRecharge(true);
          writeLimitAlert.dismiss();
        }}
      />
    </section>
  );
}
