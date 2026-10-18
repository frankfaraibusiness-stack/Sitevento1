// app/loading.tsx — Next.js App Router route-level loading UI. Shown
// automatically during navigation/suspense for any route under app/
// that doesn't define its own loading.tsx.
//
// Uses the shared <AppSkeleton> (components/AppSkeleton.tsx) — the
// same brand blob + logo + shimmer loading state used by /settings,
// /dashboard, /dashboard/profile, /dashboard/sites/[siteId], and
// /widgets/[widgetId] — instead of its own one-off shimmer shape, so
// every loading transition in the app looks the same.

import { AppSkeleton } from '@/components/AppSkeleton';

export default function Loading() {
  return <AppSkeleton fullScreen label="Loading page" />;
}
