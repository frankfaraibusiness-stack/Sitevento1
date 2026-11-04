'use client';

// components/dashboard/DashboardShell.tsx
//
// The dashboard's main shell. Intentionally EMPTY right now — every
// old section (DashboardHeader, SiteDomainCard, the verify banner,
// OverviewKpiGrid, VisitsChartCard, PlanLimitsSection, DashLogsPanel,
// RecentLeadsPanel, TokenLimitAlertModal, DashEmptyState) has been
// removed on purpose, along with their component files, so a new
// dashboard design can be built from scratch without old markup/CSS
// getting in the way. DashboardClient.tsx still imports and renders
// this component unchanged — only its own contents were cleared out.
import type { User } from 'firebase/auth';
import type { Site } from '@/lib/types';
import type { DashState } from '@/hooks/useSites';

interface DashboardShellProps {
  user: User;
  sites: Site[];
  activeSiteId: string | null;
  setActiveSiteId: (siteId: string) => void;
  activeSite: Site | null;
  dashState: DashState;
  errorMessage: string | null;
  disconnectSite: (siteId: string) => void;
  onOpenAddSiteModal: () => void;
  onResumeVerification: (site: { id: string; url: string }) => void;
  onLeadsCountChange: (count: number) => void;
}

export function DashboardShell(_props: DashboardShellProps) {
  return <div className="dashv2-dashboard-root" />;
}
