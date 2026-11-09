'use client';

// components/connect/ConnectPermissionsStep.tsx
//
// Step 3 of the connect wizard ("Connect" in STEP_LABELS — see
// ConnectFlow.tsx / VerifyFlow.tsx's own copies of that array, kept in
// sync across all three step files). Lands here immediately after
// VerifyFlow's onVerified fires: shows the "you're verified" success
// state, then lets the owner review/adjust the permission grant their
// new site already has (seeded server-side at creation time by
// app/api/connect-site's defaultPermissionIds(planId) — see that
// route's header comment) before moving on.
//
// Deliberately reuses components/sites/PermissionsGrid.tsx rather than
// building a second permissions UI — same component SiteManagePage's
// own Permissions panel uses, same optimistic-toggle pattern
// (localPermissionIds overlay + pendingPermissionIds busy state,
// reconciled against whatever app/api/user-action's
// 'update-site-permissions' action actually persisted), driven
// through the same useSites().updateSitePermissions. Each toggle here
// is saved immediately, the same as the settings-page panel — there's
// no separate "Save" step, so leaving this page at any point (closing
// the tab, hitting back) can't lose a change.
import { useCallback, useEffect, useState } from 'react';
import { useSites } from '@/hooks/useSites';
import type { User } from 'firebase/auth';
import type { PlanId } from '@/lib/plans';
import { PermissionsGrid } from '@/components/sites/PermissionsGrid';
import { ConnectSideRail } from '@/components/connect/ConnectSideRail';
import type { VerifiedSite } from '@/components/connect/VerifyFlow';

const TOTAL_STEPS = 5;
const STEP_LABELS = ['Website', 'Verify', 'Connect', 'Settings', 'Finish'];
const CURRENT_STEP = 3;

interface ConnectPermissionsStepProps {
  site: VerifiedSite;
  user: User;
  plan: PlanId;
  onFinish: () => void;
  onUpgradeClick: () => void;
}

const STEP3_HOW_IT_WORKS = {
  icon: (
    <svg viewBox="0 0 24 24">
      <circle cx="12" cy="8" r="4" />
      <path d="M20 21v-2a4 4 0 0 0-4-4H8a4 4 0 0 0-4 4v2" />
    </svg>
  ),
  title: 'What permissions control',
  steps: [
    { text: <>Your site already started with a sensible default set of permissions for your plan — nothing extra is needed to go live.</> },
    { text: <>Each switch below grants (or revokes) one specific capability, saved the moment you toggle it — there&apos;s no separate save step.</> },
    { text: <>You can come back and change any of these later from the site&apos;s own settings page.</> },
  ],
};

const STEP3_FAQ = {
  icon: (
    <svg viewBox="0 0 24 24">
      <circle cx="12" cy="12" r="9" />
      <path d="M12 16v-5M12 8h.01" />
    </svg>
  ),
  title: 'Questions about permissions',
  items: [
    {
      q: 'What happens if I leave something off?',
      a: "That capability simply won't run on this site — e.g. leaving Session replay off means no replay data is recorded at all, not just hidden from view.",
    },
    {
      q: "What's the difference between a locked and a trial permission?",
      a: "Locked means it's not available on your current plan. Trial means you can use it right now with a daily cap, no upgrade required, until you decide if you want it permanently.",
    },
    {
      q: 'Do these apply to every site, or just this one?',
      a: 'Just this site. Each connected site has its own independent permission set, so you can grant more on one site and less on another.',
    },
  ],
};

export function ConnectPermissionsStep({ site, user, plan, onFinish, onUpgradeClick }: ConnectPermissionsStepProps) {
  const { sites, updateSitePermissions } = useSites(user.uid, user);
  const liveSite = sites.find((s) => s.id === site.id) || null;

  // Same optimistic-overlay pattern as SiteManagePage's Permissions
  // panel (components/dashboard/SiteManagePage.tsx) — see that file's
  // own comment on why a local overlay + pending-ids list, reconciled
  // against the server's actually-persisted list, is used instead of
  // waiting on the Firestore round-trip for every toggle.
  const [localPermissionIds, setLocalPermissionIds] = useState<string[] | null>(null);
  const [pendingPermissionIds, setPendingPermissionIds] = useState<string[]>([]);

  useEffect(() => {
    setLocalPermissionIds(null);
    setPendingPermissionIds([]);
  }, [site.id]);

  const grantedPermissionIds = localPermissionIds ?? liveSite?.permissions ?? [];

  const handleTogglePermission = useCallback(
    async (permissionId: string, next: boolean) => {
      const current = localPermissionIds ?? liveSite?.permissions ?? [];
      const nextIds = next ? Array.from(new Set([...current, permissionId])) : current.filter((id) => id !== permissionId);

      setLocalPermissionIds(nextIds);
      setPendingPermissionIds((prev) => (prev.includes(permissionId) ? prev : [...prev, permissionId]));

      const result = await updateSitePermissions(site.id, nextIds);

      setPendingPermissionIds((prev) => prev.filter((id) => id !== permissionId));
      if (result.ok && result.data?.permissions) {
        setLocalPermissionIds(result.data.permissions);
      } else {
        setLocalPermissionIds(current);
      }
    },
    [localPermissionIds, liveSite, site.id, updateSitePermissions]
  );

  return (
    <div className="cwz-root">
      <header className="cwz-header">
        <a href="/" className="cwz-logo" aria-label="sitevento home">
          <img src="https://cdn.phototourl.com/member/2026-10-16-c4f6fc3d-2a68-40c8-9241-fa770df8a99f.png" alt="sitevento" />
        </a>
        <div className="cwz-header-right">
          <button type="button" className="cwz-next-btn" onClick={onFinish} aria-label="Finish and go to dashboard">
            <svg className="cwz-next-arrow" viewBox="0 0 24 24">
              <path d="M5 12h14M13 6l6 6-6 6" />
            </svg>
            <span className="cwz-next-word">Finish</span>
          </button>
        </div>
      </header>

      <div className="cwz-content">
        <div className="cwz-content-grid">
        <div className="cwz-content-main">
        <div className="cwz-tracker" role="group" aria-label="Connect progress">
          <div className="cwz-tracker-header">
            <span className="cwz-tracker-label">Connect website</span>
            <span className="cwz-tracker-count" aria-live="polite">
              <span className="cwz-current">{CURRENT_STEP}</span>
              <span className="cwz-divider">/</span>
              <span className="cwz-total">{TOTAL_STEPS}</span>
            </span>
          </div>

          <div className="cwz-progress-track" aria-hidden="true">
            <div className="cwz-progress-fill" style={{ width: `${((CURRENT_STEP - 1) / (TOTAL_STEPS - 1)) * 100}%` }} />
            <div className="cwz-progress-dots">
              {STEP_LABELS.map((_, idx) => {
                const stepNum = idx + 1;
                const cls = stepNum < CURRENT_STEP ? ' cwz-done' : stepNum === CURRENT_STEP ? ' cwz-current' : '';
                return <span key={idx} className={`cwz-progress-dot${cls}`} />;
              })}
            </div>
          </div>

          <div className="cwz-step-labels" aria-hidden="true">
            {STEP_LABELS.map((label, idx) => {
              const stepNum = idx + 1;
              const cls = stepNum < CURRENT_STEP ? ' cwz-done' : stepNum === CURRENT_STEP ? ' cwz-active' : '';
              return (
                <span key={label} className={`cwz-step-label${cls}`}>
                  {label}
                </span>
              );
            })}
          </div>
        </div>

        <div className="cwz-stage">
          {/* verified success hero */}
          <div className="cwz-perm-success">
            <span className="cwz-perm-success-icon">
              <svg viewBox="0 0 24 24">
                <path d="M5 12l5 5L20 7" />
              </svg>
            </span>
            <div className="cwz-perm-success-copy">
              <h1 className="cwz-perm-success-title">You&apos;re verified</h1>
              <p className="cwz-perm-success-sub">
                <strong>{site.hostname}</strong> is connected to sitevento. Now choose what you&apos;d like to grant
                access to — you can change any of this later.
              </p>
            </div>
          </div>

          <div className="cwz-vfy-card cwz-perm-card">
            <PermissionsGrid
              plan={plan}
              selectedIds={grantedPermissionIds}
              pendingIds={pendingPermissionIds}
              onToggle={handleTogglePermission}
              onUpgradeClick={onUpgradeClick}
              introText="Choose what to grant sitevento for this site. You can change any of these later from site settings."
            />
          </div>

          <button type="button" className="cwz-perm-finish-btn" onClick={onFinish}>
            <span>Go to dashboard</span>
            <svg viewBox="0 0 24 24">
              <path d="M5 12h14M13 6l6 6-6 6" />
            </svg>
          </button>
        </div>
        </div>

        <ConnectSideRail
          howItWorks={STEP3_HOW_IT_WORKS}
          faq={STEP3_FAQ}
          footnote="Permission changes here are saved instantly, the same as from site settings — there's nothing left to confirm."
        />
        </div>
      </div>
    </div>
  );
}
