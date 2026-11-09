'use client';

// components/profile/ProfileHero.tsx
//
// The top of /profile: the banner, then the signed-in user's identity row.
//
//   - name / email / photo / "email verified" / "member since" all come from
//     the Firebase Auth user — the same record the header avatar reads
//   - the three banner chips are live: this month's visits (visit allowance
//     counter), 30-day growth (hooks/useProfileStats) and sites connected
//   - the banner artwork itself is purely decorative (no figures drawn in it),
//     so nothing on it can disagree with the real numbers
//
// NOTE: deliberately not a <header> element — styles/base/base.css pins every bare
// `header` to the top of the viewport as the app bar.
//
// Colours come from the --pf-* tokens at the top of styles/profile/profile-page.css.
import type { User } from 'firebase/auth';
import type { PlanId } from '@/lib/plans';
import { PLANS } from '@/lib/plans';
import type { AccountLimits } from '@/hooks/useAccountLimits';
import type { ProfileStats } from '@/hooks/useProfileStats';
import { fmtNum } from '@/lib/dashboardStats';
import { PfLink, ArrowIcon } from '@/components/profile/PfLink';
import { ProfilePlanMenu } from '@/components/profile/ProfilePlanMenu';

interface ProfileHeroProps {
  user: User;
  planId: PlanId | null;
  limits: AccountLimits | null;
  limitsLoading: boolean;
  limitsError: string | null;
  onRetryLimits: () => void;
  sitesCount: number;
  stats: ProfileStats | null;
  onSignOut: () => void;
}

function displayName(user: User): string {
  return user.displayName?.trim() || (user.email ? user.email.split('@')[0] : 'Your account');
}

function memberSince(user: User): string | null {
  const raw = user.metadata?.creationTime;
  if (!raw) return null;
  const d = new Date(raw);
  if (isNaN(d.getTime())) return null;
  return d.toLocaleDateString('en-US', { month: 'short', year: 'numeric' });
}

function growthLabel(stats: ProfileStats | null): { text: string; tone: 'up' | 'down' | 'flat' } {
  if (!stats) return { text: '—', tone: 'flat' };
  if (stats.growthPct !== null) {
    const rounded = Math.round(stats.growthPct * 10) / 10;
    const sign = rounded > 0 ? '+' : '';
    return { text: `${sign}${rounded.toLocaleString()}%`, tone: rounded > 0 ? 'up' : rounded < 0 ? 'down' : 'flat' };
  }
  if ((stats.viewsLast30 ?? 0) > 0) return { text: 'New', tone: 'up' };
  return { text: '—', tone: 'flat' };
}

function Chip({ label, value, tone, icon }: { label: string; value: string; tone?: 'up' | 'down' | 'flat'; icon: React.ReactNode }) {
  return (
    <div className="pf-chip">
      <span className="pf-chip-icon" aria-hidden="true">
        {icon}
      </span>
      <span className="pf-chip-label">{label}</span>
      <strong className={tone ? `is-${tone}` : undefined}>{value}</strong>
    </div>
  );
}

export function ProfileHero({
  user,
  planId,
  limits,
  limitsLoading,
  limitsError,
  onRetryLimits,
  sitesCount,
  stats,
  onSignOut,
}: ProfileHeroProps) {
  const name = displayName(user);
  const initial = name.trim().charAt(0).toUpperCase() || '?';
  const since = memberSince(user);
  const growth = growthLabel(stats);
  const next = planId ? PLANS[PLANS.findIndex((p) => p.id === planId) + 1] ?? null : null;
  const sitesLimit = limits?.sitesLimit;

  return (
    <div className="pf-hero">
      <div className="pf-banner" aria-hidden="true">
        <div className="pf-banner-grid" />
        <span className="pf-glow pf-glow-a" />
        <span className="pf-glow pf-glow-b" />
        <span className="pf-glow pf-glow-c" />
        <svg className="pf-banner-art" viewBox="0 0 1200 300" preserveAspectRatio="none">
          <defs>
            <linearGradient id="pfWave" x1="0" y1="0" x2="1" y2="0">
              <stop offset="0%" style={{ stopColor: 'var(--pf-wave-a)', stopOpacity: 0.1 }} />
              <stop offset="45%" style={{ stopColor: 'var(--pf-wave-a)', stopOpacity: 0.9 }} />
              <stop offset="100%" style={{ stopColor: 'var(--pf-wave-b)', stopOpacity: 1 }} />
            </linearGradient>
            <linearGradient id="pfWaveFill" x1="0" y1="0" x2="0" y2="1">
              <stop offset="0%" style={{ stopColor: 'var(--pf-wave-a)', stopOpacity: 0.22 }} />
              <stop offset="100%" style={{ stopColor: 'var(--pf-wave-a)', stopOpacity: 0 }} />
            </linearGradient>
          </defs>
          <path
            d="M0,230 C140,200 230,225 340,175 C450,125 540,190 660,140 C780,90 870,160 980,105 C1070,62 1140,96 1200,70 L1200,300 L0,300 Z"
            fill="url(#pfWaveFill)"
          />
          <path
            className="pf-wave"
            pathLength={1}
            d="M0,230 C140,200 230,225 340,175 C450,125 540,190 660,140 C780,90 870,160 980,105 C1070,62 1140,96 1200,70"
            fill="none"
            stroke="url(#pfWave)"
            strokeWidth={3}
            strokeLinecap="round"
          />
          <path
            className="pf-wave pf-wave-2"
            pathLength={1}
            d="M0,262 C160,246 260,262 380,226 C500,190 590,238 720,200 C850,162 940,208 1060,168 C1130,146 1170,150 1200,138"
            fill="none"
            stroke="url(#pfWave)"
            strokeWidth={1.5}
            strokeLinecap="round"
          />
        </svg>

        <div className="pf-chips">
          <Chip
            label="This month"
            value={limits ? `${fmtNum(limits.visitUsage.used)} visits` : '—'}
            icon={
              <svg viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth={2} strokeLinecap="round" strokeLinejoin="round">
                <path d="M2 12s3.6-7 10-7 10 7 10 7-3.6 7-10 7S2 12 2 12z" />
                <circle cx="12" cy="12" r="3" />
              </svg>
            }
          />
          <Chip
            label="30-day growth"
            value={growth.text}
            tone={growth.tone}
            icon={
              <svg viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth={2} strokeLinecap="round" strokeLinejoin="round">
                <path d="m3 17 6-6 4 4 8-8M15 7h6v6" />
              </svg>
            }
          />
          <Chip
            label="Sites connected"
            value={sitesLimit ? `${sitesCount} / ${sitesLimit}` : String(sitesCount)}
            icon={
              <svg viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth={2} strokeLinecap="round" strokeLinejoin="round">
                <circle cx="12" cy="12" r="9" />
                <path d="M3 12h18M12 3c2.8 2.7 4.2 5.7 4.2 9s-1.4 6.3-4.2 9c-2.8-2.7-4.2-5.7-4.2-9S9.2 5.7 12 3z" />
              </svg>
            }
          />
        </div>
      </div>

      <div className="pf-identity">
        <div className="pf-avatar">
          {user.photoURL ? <img src={user.photoURL} alt={`${name}'s profile photo`} referrerPolicy="no-referrer" /> : <span aria-hidden="true">{initial}</span>}
        </div>

        <div className="pf-id-main">
          <div className="pf-name-row">
            <h1 className="pf-name">{name}</h1>
            {user.emailVerified && (
              <span className="pf-verified" title="Email verified">
                <svg viewBox="0 0 24 24" fill="currentColor" aria-hidden="true">
                  <path d="M12 2l2.4 1.8 3-.2 1 2.8 2.5 1.7-.9 2.9.9 2.9-2.5 1.7-1 2.8-3-.2L12 22l-2.4-1.8-3 .2-1-2.8-2.5-1.7.9-2.9-.9-2.9 2.5-1.7 1-2.8 3 .2z" />
                  <path d="m8.6 12.2 2.3 2.3 4.5-4.7" fill="none" stroke="var(--pf-verified-tick)" strokeWidth={2} strokeLinecap="round" strokeLinejoin="round" />
                </svg>
                <span className="pf-sr">Email verified</span>
              </span>
            )}
          </div>
          <p className="pf-meta">
            {user.email && <span>{user.email}</span>}
            {since && <span>Member since {since}</span>}
          </p>
          <div className="pf-plan-row">
            <ProfilePlanMenu
              planId={planId}
              limits={limits}
              limitsLoading={limitsLoading}
              limitsError={limitsError}
              onRetry={onRetryLimits}
            />
            {planId && next && (
              <PfLink href="/dashboard/plans" className="pf-btn pf-btn-accent" title={`Upgrade to ${next.name} — ${next.priceDisplay}/mo`}>
                <svg viewBox="0 0 24 24" fill="currentColor" aria-hidden="true">
                  <path d="M13 2 4 14h6l-1 8 9-12h-6z" />
                </svg>
                Upgrade
              </PfLink>
            )}
          </div>
        </div>

        <div className="pf-id-actions">
          <PfLink href="/settings" className="pf-btn pf-btn-ghost">
            Edit profile <ArrowIcon />
          </PfLink>
          <button type="button" className="pf-btn pf-btn-quiet" onClick={onSignOut}>
            Sign out
          </button>
        </div>
      </div>
    </div>
  );
}
