// app/loading.tsx — Next.js App Router route-level loading UI. Shown
// automatically during navigation/suspense for any route under app/
// that doesn't define its own loading.tsx.
//
// Uses the shared <GlobalLoader variant="inline" /> (components/GlobalLoader.tsx) —
// the same logo + shimmer loading state used by /settings,
// /dashboard, /dashboard/profile, /dashboard/sites/[siteId], and
// /widgets/[widgetId] — instead of its own one-off shimmer shape, so
// every loading transition in the app looks the same.

import { GlobalLoader } from '@/components/GlobalLoader';

export default function Loading() {
  return <GlobalLoader variant="inline" fullScreen label="Loading page" />;
}
