// app/settings/[panel]/page.tsx — deep-linkable settings panels, e.g.
// /settings/api, /settings/billing. Same shell as app/settings/page.tsx,
// just forwarding the [panel] param as the initial panel. An unknown
// panel value falls back to "account" rather than crashing.
import type { Metadata } from 'next';
import { Suspense } from 'react';
import SettingsPageClient from '@/components/settings/SettingsPageClient';
import type { SettingsPanelId } from '@/components/settings/SettingsSidebar';
import { AppSkeleton } from '@/components/AppSkeleton';

export const dynamic = 'force-dynamic';

const VALID_PANELS: SettingsPanelId[] = [
  'account',
  'security',
  'notifications',
  'appearance',
  'billing',
  'api',
  'webhooks',
  'widgets-defaults',
  'privacy',
  'site-alerts',
  'danger',
];

const PANEL_TITLES: Record<SettingsPanelId, string> = {
  account: 'Account',
  security: 'Security',
  notifications: 'Notifications',
  appearance: 'Appearance',
  billing: 'Billing & Plans',
  api: 'API Keys',
  webhooks: 'Webhooks',
  'widgets-defaults': 'Widget Defaults',
  privacy: 'Privacy & Data',
  'site-alerts': 'Site Alerts',
  danger: 'Danger Zone',
};

export async function generateMetadata({ params }: { params: Promise<{ panel: string }> }): Promise<Metadata> {
  const { panel } = await params;
  const id = (VALID_PANELS as string[]).includes(panel) ? (panel as SettingsPanelId) : 'account';
  return {
    title: `${PANEL_TITLES[id]} — Settings`,
    robots: { index: false, follow: false, nocache: true },
    alternates: { canonical: `/settings/${id === 'account' ? '' : id}` },
  };
}

export default async function SettingsPanelRoutePage({ params }: { params: Promise<{ panel: string }> }) {
  const { panel } = await params;
  const id = (VALID_PANELS as string[]).includes(panel) ? (panel as SettingsPanelId) : 'account';
  return (
    <Suspense fallback={<AppSkeleton fullScreen label="Loading settings" />}>
      <SettingsPageClient initialPanel={id} />
    </Suspense>
  );
}
