// app/dashboard/agent/page.tsx — route for the AI Support Agent feature.
// Mirrors app/dashboard/plans/page.tsx and app/dashboard/profile/page.tsx:
// a thin Server Component route that mounts the client component holding
// the actual UI, since AgentPageClient needs real NEXT_PUBLIC_FIREBASE_*
// env vars that aren't available during static build-time prerendering.
import AgentPageClient from '@/components/agent/AgentPageClient';

// Scoped to this route only — deliberately NOT added to app/globals.css's
// @import list (unlike every other styles/*.css file). Importing it here
// means it ships only in this route's chunk instead of the global
// stylesheet every page downloads, while still being ordinary CSS (not a
// CSS Module) so its existing plain `agt-` class names keep working
// unchanged across all of components/agent/*.
import '@/styles/agent/agent-page.css';

export const dynamic = 'force-dynamic';

export default function Page() {
  return <AgentPageClient />;
}
