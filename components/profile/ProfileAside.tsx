'use client';

// components/profile/ProfileAside.tsx
//
// The desktop side column (stacked under the main content on phones):
//
//   - Connected sites — the user's real sites (users/{uid}/sites via useSites),
//     with live status (verified / pending / paused), last-seen time from
//     site.lastSeenAt, and a link to each site's own management page. The
//     "connect" button becomes "upgrade" once the plan's site limit is reached.
//   - Wallet — the real wallet balance and overage rate from /api/site-limits.
import type { Site } from '@/lib/types';
import type { AccountLimits } from '@/hooks/useAccountLimits';
import { timeAgo } from '@/lib/dashboardStats';
import { PfLink, ArrowIcon } from '@/components/profile/PfLink';

interface ProfileAsideProps {
  sites: Site[];
  limits: AccountLimits | null;
}

function host(site: Site): string {
  try {
    const raw = site.url.includes('://') ? site.url : `https://${site.url}`;
    return new URL(raw).hostname.replace(/^www\./, '');
  } catch {
    return site.url || site.name;
  }
}

function lastSeenMs(site: Site): number | null {
  const ts = site.lastSeenAt;
  if (!ts || typeof ts.toDate !== 'function') return null;
  try {
    return ts.toDate().getTime();
  } catch {
    return null;
  }
}

function statusOf(site: Site): { label: string; tone: 'good' | 'warn' | 'muted' } {
  if (site.paused) return { label: 'Paused', tone: 'muted' };
  if (site.status === 'verified') return { label: 'Verified', tone: 'good' };
  return { label: 'Pending', tone: 'warn' };
}

export function ProfileAside({ sites, limits }: ProfileAsideProps) {
  const now = Date.now();
  const atLimit = !!limits && limits.sitesUsed >= limits.sitesLimit;
  const wallet = limits?.visitWallet ?? null;

  return (
    <aside className="pf-aside" aria-label="Sites and wallet">
      <section className="pf-section" aria-labelledby="pf-sites-title">
        <div className="pf-section-head">
          <div>
            <h2 id="pf-sites-title">Connected sites</h2>
          </div>
          <PfLink href="/dashboard/sites" className="pf-more">
            Manage <ArrowIcon />
          </PfLink>
        </div>

        {sites.length === 0 ? (
          <div className="pf-empty">
            <b>No sites connected</b>
            <p>Add one meta tag to your site and it shows up here.</p>
          </div>
        ) : (
          <ul className="pf-sites">
            {sites.map((s) => {
              const st = statusOf(s);
              const seen = lastSeenMs(s);
              return (
                <li key={s.id}>
                  <PfLink href={`/dashboard/sites/${encodeURIComponent(s.id)}`} className="pf-site">
                    <span className="pf-site-mark" aria-hidden="true">
                      {host(s).charAt(0).toUpperCase()}
                    </span>
                    <span className="pf-site-text">
                      <b>{host(s)}</b>
                      <small>{seen ? `Last visit ${timeAgo(seen, now)}` : s.status === 'verified' ? 'No visits yet' : 'Waiting for verification'}</small>
                    </span>
                    <span className={`pf-status is-${st.tone}`}>{st.label}</span>
                  </PfLink>
                </li>
              );
            })}
          </ul>
        )}

        <div className="pf-section-foot">
          {atLimit ? (
            <PfLink href="/dashboard/plans" className="pf-btn pf-btn-accent pf-btn-sm">
              Upgrade for more sites
            </PfLink>
          ) : (
            <PfLink href="/dashboard/connect" className="pf-btn pf-btn-ghost pf-btn-sm">
              + Connect a site
            </PfLink>
          )}
        </div>
      </section>

      <section className="pf-section" aria-labelledby="pf-wallet-title">
        <div className="pf-section-head">
          <div>
            <h2 id="pf-wallet-title">Wallet</h2>
          </div>
          <PfLink href="/dashboard/wallet" className="pf-more">
            Open <ArrowIcon />
          </PfLink>
        </div>

        {wallet ? (
          <div className="pf-wallet">
            <span className="pf-wallet-balance">${wallet.balanceUsd.toFixed(2)}</span>
            <p>
              Covers visits past your monthly allowance at ${wallet.overageRateUsdPerThousandVisits.toFixed(2)} per 1,000.
              {wallet.bankedVisits > 0 ? ` ${wallet.bankedVisits.toLocaleString()} prepaid visits banked.` : ''}
            </p>
          </div>
        ) : (
          <div className="pf-wallet is-skeleton" aria-hidden="true">
            <span className="pf-wallet-balance" />
          </div>
        )}
      </section>
    </aside>
  );
}
