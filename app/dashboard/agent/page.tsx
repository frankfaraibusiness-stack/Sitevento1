// app/dashboard/agent/page.tsx — route for the AI Support Agent feature.
// Mirrors app/dashboard/plans/page.tsx and app/dashboard/profile/page.tsx:
// a thin Server Component route that mounts the client component holding
// the actual UI, since AgentPageClient needs real NEXT_PUBLIC_FIREBASE_*
// env vars that aren't available during static build-time prerendering.
import AgentPageClient from '@/components/agent/AgentPageClient';

export const dynamic = 'force-dynamic';

export default function Page() {
  return <AgentPageClient />;
}
