'use client';

// components/dashboard/ProfilePage.tsx
//
// Account management: edit display name, see plan usage against the
// real connected-site limit (lib/plans.ts's limits.connectedSites),
// upgrade/downgrade between the 4 real tiers, and manage connected
// sites from one place instead of only from the main dashboard scroll.
// Mounted at /dashboard/profile (see app/dashboard/profile/page.tsx)
// and opened from the header avatar + sidebar's "My profile" link.
//
// Plan changes write straight to users/{uid}.plan (see
// hooks/useUserProfile.ts) — there's no billing provider wired up yet,
// so "upgrade" here is the full flow already available: picking a plan
// sets it immediately. Swapping in real checkout later only touches
// useUserProfile.setPlan's call site, not this page. Plan data itself
// (names, prices, limits, highlight copy) all comes from lib/plans.ts
// so this can't drift from the /pricing page or the homepage pricing
// cards.
import { useEffect, useState } from 'react';
import type { User } from 'firebase/auth';
import type { Site } from '@/lib/types';
import { PLANS, getPlan, type PlanId } from '@/lib/plans';
import { useUserProfile } from '@/hooks/useUserProfile';

interface ProfilePageProps {
  user: User;
  sites: Site[];
  onDisconnectSite: (siteId: string) => Promise<void> | void;
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

export function ProfilePage({ user, sites, onDisconnectSite, onAddSite }: ProfilePageProps) {
  const { planId, setPlan, updateDisplayName } = useUserProfile(user);
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

  // ── Plan switch sheet ───────────────────────────────────────────
  const [planSheetOpen, setPlanSheetOpen] = useState(false);
  const [switching, setSwitching] = useState<PlanId | null>(null);

  async function handleChoosePlan(id: PlanId) {
    if (id === planId) {
      setPlanSheetOpen(false);
      return;
    }
    setSwitching(id);
    await setPlan(id);
    setSwitching(null);
    setPlanSheetOpen(false);
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

  return (
    <section>
      <div className="dash-wrap dash-wrap-v2 prof-wrap">
        <div className="dash-head">
          <div>
            <h1>Your profile</h1>
            <p>Account, plan, and connected sites</p>
          </div>
        </div>

        {/* ── Identity card ─────────────────────────────────────── */}
        <div className="prof-card prof-identity">
          <div className="prof-avatar" aria-hidden="true">
            {user.photoURL ? <img src={user.photoURL} alt="" /> : <span>{initial}</span>}
          </div>
          <div className="prof-identity-fields">
            <label className="prof-field">
              <span className="prof-field-label">Name</span>
              <div className="prof-field-row">
                <input
                  className="prof-input"
                  value={name}
                  maxLength={80}
                  placeholder="Your name"
                  onChange={(e) => setName(e.target.value)}
                />
                <button
                  type="button"
                  className="ghost-btn live prof-save-btn"
                  disabled={!nameDirty || savingName}
                  onClick={handleSaveName}
                >
                  {savingName ? 'Saving\u2026' : 'Save'}
                </button>
              </div>
              {nameToast === 'ok' && <span className="prof-field-note is-ok">Name updated.</span>}
              {nameToast === 'error' && <span className="prof-field-note is-error">Couldn&apos;t save. Try again.</span>}
            </label>
            <label className="prof-field">
              <span className="prof-field-label">Email</span>
              <div className="prof-field-row">
                <input className="prof-input" value={user.email || ''} readOnly disabled />
              </div>
              <span className="prof-field-note">Contact support to change the email on your account.</span>
            </label>
          </div>
        </div>

        {/* ── Plan banner ───────────────────────────────────────── */}
        <div className={`prof-plan-banner${atLimit ? ' is-urgent' : ''}`}>
          <div className="prof-plan-banner-glow" aria-hidden="true" />
          <div className="prof-plan-banner-top">
            <span className="prof-plan-pill">{plan.name} plan</span>
            {atLimit && <span className="prof-plan-urgent-pill">Limit reached</span>}
          </div>
          <h2>{plan.price === 0 ? 'You\u2019re on Free' : `${plan.priceDisplay}/mo \u2014 ${plan.name}`}</h2>
          <p>
            {usedCount} of {limit} connected site{limit === 1 ? '' : 's'} used.
          </p>
          <div className="prof-usage-track" aria-hidden="true">
            <div className="prof-usage-fill" style={{ width: `${usagePct}%` }} />
          </div>
          <div className="prof-plan-banner-actions">
            {upgrade && (
              <button type="button" className="prof-upgrade-btn" onClick={() => setPlanSheetOpen(true)}>
                <svg viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth={2.2} strokeLinecap="round" strokeLinejoin="round">
                  <path d="M12 19V5M5 12l7-7 7 7" />
                </svg>
                {atLimit ? `Upgrade to ${upgrade.name}` : 'Upgrade plan'}
              </button>
            )}
            <button type="button" className="ghost-btn" onClick={() => setPlanSheetOpen(true)}>
              {upgrade ? 'Compare all plans' : 'Manage plan'}
            </button>
            <a className="ghost-btn" href="/pricing">
              Full plan details
            </a>
          </div>
        </div>

        {/* ── Connected sites ───────────────────────────────────── */}
        <div className="dash-panel prof-sites-panel">
          <div className="dash-panel-head">
            <div>
              <h3>Connected sites</h3>
              <span className="dp-sub">
                {usedCount} of {limit} used
              </span>
            </div>
            <button type="button" className="ghost-btn" onClick={onAddSite} disabled={atLimit}>
              + Add site
            </button>
          </div>
          <div className="dash-panel-body prof-sites-body">
            {sites.length === 0 ? (
              <p className="prof-sites-empty">No sites connected yet.</p>
            ) : (
              <ul className="prof-site-list">
                {sites.map((site) => (
                  <li className="prof-site-row" key={site.id}>
                    <span className={`prof-site-dot prof-site-dot-${site.status}`} />
                    <span className="prof-site-info">
                      <span className="prof-site-name">{site.name}</span>
                      <span className="prof-site-url">{site.url}</span>
                    </span>
                    <span className={`prof-site-status prof-site-status-${site.status}`}>
                      {site.status === 'verified' ? 'Verified' : 'Pending'}
                    </span>
                    <button
                      type="button"
                      className="ghost-btn danger prof-site-disconnect"
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
              <p className="prof-limit-note">
                You&rsquo;ve reached the {plan.name} plan&rsquo;s site limit.{' '}
                {upgrade && (
                  <button type="button" className="prof-inline-link" onClick={() => setPlanSheetOpen(true)}>
                    Upgrade to {upgrade.name}
                  </button>
                )}{' '}
                to connect more.
              </p>
            )}
          </div>
        </div>
      </div>

      {/* ── Plan comparison sheet ─────────────────────────────────── */}
      {planSheetOpen && (
        <div className="feat-panel-backdrop" role="presentation" onClick={() => !switching && setPlanSheetOpen(false)}>
          <div className="feat-panel-sheet prof-plan-sheet" role="dialog" aria-modal="true" aria-label="Choose a plan" onClick={(e) => e.stopPropagation()}>
            <button type="button" className="feat-panel-close" aria-label="Close" onClick={() => !switching && setPlanSheetOpen(false)}>
              <svg viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth={2.2} strokeLinecap="round">
                <path d="M5 5l14 14M19 5L5 19" />
              </svg>
            </button>
            <div className="prof-plan-sheet-inner">
              <h3>Choose your plan</h3>
              <p className="prof-plan-sheet-sub">Switch anytime. Changes apply immediately.</p>
              <div className="prof-plan-grid">
                {PLANS.map((p) => {
                  const current = p.id === planId;
                  return (
                    <div key={p.id} className={`prof-plan-card${current ? ' is-current' : ''}${p.featured && !current ? ' is-featured' : ''}`}>
                      {p.featured && !current && <span className="prof-plan-card-badge">Most popular</span>}
                      {current && <span className="prof-plan-card-badge is-current">Current plan</span>}
                      <p className="prof-plan-card-name">{p.name}</p>
                      <p className="prof-plan-card-price">
                        {p.priceDisplay}
                        <span>/mo</span>
                      </p>
                      <ul className="prof-plan-card-features">
                        {p.cardHighlights.map((f) => (
                          <li key={f}>{f}</li>
                        ))}
                      </ul>
                      <button
                        type="button"
                        className={`prof-plan-card-btn${current ? ' is-current' : ''}`}
                        disabled={current || switching !== null}
                        onClick={() => handleChoosePlan(p.id)}
                      >
                        {switching === p.id ? 'Switching\u2026' : current ? 'Current plan' : p.price === 0 ? 'Downgrade' : p.cta}
                      </button>
                    </div>
                  );
                })}
              </div>
              <p className="prof-plan-sheet-foot">
                Need the full limits breakdown? <a href="/pricing">See the pricing page →</a>
              </p>
            </div>
          </div>
        </div>
      )}

      {/* ── Disconnect confirm ────────────────────────────────────── */}
      {confirmId && (
        <div className="css-sheet-backdrop" role="presentation" onClick={() => !busyId && setConfirmId(null)}>
          <div className="css-sheet" role="alertdialog" aria-modal="true" onClick={(e) => e.stopPropagation()}>
            <div className="css-sheet-title">Disconnect this site?</div>
            <p className="css-sheet-msg">
              The tracking tag will stop working and any live banner will disappear. This can&apos;t be undone.
            </p>
            <div className="css-sheet-actions">
              <button type="button" className="ghost-btn" onClick={() => setConfirmId(null)} disabled={!!busyId}>
                Cancel
              </button>
              <button type="button" className="ghost-btn danger" onClick={handleConfirmDisconnect} disabled={!!busyId}>
                {busyId ? 'Working\u2026' : 'Disconnect'}
              </button>
            </div>
          </div>
        </div>
      )}
    </section>
  );
}
