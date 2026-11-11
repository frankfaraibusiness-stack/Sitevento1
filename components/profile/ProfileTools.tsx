'use client';

// components/profile/ProfileTools.tsx
//
// Quick tools on /profile — the app's real lineup. The list itself comes from
// components/dashboard/quickToolOptions.tsx (the single source of truth the
// dashboard uses), so a tool added or renamed there shows up here with no edit.
// Rows are open (hairline-separated), not a grid of cards.
//
// The small status chip on a row is real, account-level data where one exists:
//   Site Alert  → sites with a live banner right now (site.overlay.active)
//   Users       → unique visitors across all sites (hooks/useProfileStats)
//   Security    → Security Bot actions taken (hooks/useDashboardData totals)
// Tools with no cheap, truthful figure simply show no chip.
import type { Site } from '@/lib/types';
import type { ProfileStats } from '@/hooks/useProfileStats';
import type { AccountTotals } from '@/hooks/useDashboardData';
import { fmtNum } from '@/lib/dashboardStats';
import { QUICK_TOOL_OPTIONS } from '@/components/dashboard/quickToolOptions';
import { PfLink, ArrowIcon } from '@/components/profile/PfLink';

interface ProfileToolsProps {
  sites: Site[];
  stats: ProfileStats | null;
  totals: AccountTotals | null;
}

function chipFor(id: string, { sites, stats, totals }: ProfileToolsProps): { text: string; live: boolean } | null {
  if (id === 'site-alert' && sites.length > 0) {
    const live = sites.filter((s) => s.overlay?.active === true).length;
    return live > 0 ? { text: `${live} live`, live: true } : { text: 'Off', live: false };
  }
  if (id === 'users' && stats && stats.uniqueVisitors !== null) {
    return { text: `${fmtNum(stats.uniqueVisitors)} visitors`, live: false };
  }
  if (id === 'bot-shield' && totals) {
    return { text: `${fmtNum(totals.botsStopped)} stopped`, live: totals.botsStopped > 0 };
  }
  return null;
}

export function ProfileTools(props: ProfileToolsProps) {
  const tools = QUICK_TOOL_OPTIONS.filter((t) => !!t.href);

  return (
    <section className="pf-section" aria-labelledby="pf-tools-title">
      <div className="pf-section-head">
        <div>
          <h2 id="pf-tools-title">Quick tools</h2>
          <p>Everything you can switch on for your sites.</p>
        </div>
        <PfLink href="/dashboard" className="pf-more">
          Open dashboard <ArrowIcon />
        </PfLink>
      </div>

      <ul className="pf-tools">
        {tools.map((t) => {
          const chip = chipFor(t.id, props);
          return (
            <li key={t.id}>
              <PfLink href={t.href as string} className={`pf-tool is-${t.tone}`}>
                <span className="pf-tool-icon" aria-hidden="true">
                  {t.icon}
                </span>
                <span className="pf-tool-text">
                  <b>{t.name}</b>
                  <small>{t.subtitle}</small>
                </span>
                {chip && <span className={`pf-chip-sm${chip.live ? ' is-live' : ''}`}>{chip.text}</span>}
                <svg className="pf-tool-go" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth={2.2} strokeLinecap="round" strokeLinejoin="round" aria-hidden="true">
                  <path d="m9 6 6 6-6 6" />
                </svg>
              </PfLink>
            </li>
          );
        })}
      </ul>
    </section>
  );
}
