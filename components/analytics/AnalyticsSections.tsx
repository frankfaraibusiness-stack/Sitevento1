// components/analytics/AnalyticsSections.tsx
//
// Everything under the Analytics header, in mockup order. Markup uses the
// mockup's `.an-*` classes, styled by styles/analytics/analytics-sections.css
// (wrapper: `.an-page.is-embedded` so the page canvas shows through). Data
// comes from the real model (model/build.ts) via AnalyticsDataContext —
// every section reads live numbers for the active site + period.
import { OverviewSection } from './sections/OverviewSection';
import { GeoLiveSection } from './sections/GeoLiveSection';
import { PeopleSection } from './sections/PeopleSection';
import { DeviceExperienceSection } from './sections/DeviceExperienceSection';
import { JourneysSection } from './sections/JourneysSection';
import { ProtectionSection } from './sections/ProtectionSection';
import { RevenueSection } from './sections/RevenueSection';
import { GoalsSection } from './sections/GoalsSection';
import { CampaignsSection } from './sections/CampaignsSection';
import { AudienceSection } from './sections/AudienceSection';
import { EngagementSection } from './sections/EngagementSection';
import { RetentionSection } from './sections/RetentionSection';
import { SiteSpeedSection } from './sections/SiteSpeedSection';
import { SiteHealthSection } from './sections/SiteHealthSection';
import { ApiHealthSection } from './sections/ApiHealthSection';
import { LiveLogSection } from './sections/LiveLogSection';

export function AnalyticsSections() {
  return (
    <div className="an-page is-embedded" id="analyticsSections">
      <div className="an-shell">
        <OverviewSection />
        <GeoLiveSection />
        <PeopleSection />
        <DeviceExperienceSection />
        <JourneysSection />
        <ProtectionSection />
        <RevenueSection />
        <GoalsSection />
        <CampaignsSection />
        <AudienceSection />
        <EngagementSection />
        <RetentionSection />
        <SiteSpeedSection />
        <SiteHealthSection />
        <ApiHealthSection />
        <LiveLogSection />
      </div>
    </div>
  );
}
