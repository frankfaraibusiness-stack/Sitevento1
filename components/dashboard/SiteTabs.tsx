// components/dashboard/SiteTabs.tsx — replaces renderSiteTabs().
import type { Site } from '@/lib/types';

interface SiteTabsProps {
  sites: Site[];
  activeSiteId: string | null;
  onSelect: (siteId: string) => void;
}

export function SiteTabs({ sites, activeSiteId, onSelect }: SiteTabsProps) {
  return (
    <div className="site-tabs">
      {sites.map((s) => {
        const classes = ['site-tab'];
        if (s.id === activeSiteId) classes.push('active');
        if (s.status === 'pending') classes.push('verifying');
        return (
          <button key={s.id} type="button" className={classes.join(' ')} onClick={() => onSelect(s.id)}>
            <span className="tdot" />
            {s.name || s.url || 'Untitled site'}
            {s.status === 'pending' && <span className="tab-pending-label"> · unverified</span>}
          </button>
        );
      })}
    </div>
  );
}
