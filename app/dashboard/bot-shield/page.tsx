// app/dashboard/bot-shield/page.tsx — route for the Bot Shield feature.
// Same Server-Component-wraps-Client-Component pattern as
// app/dashboard/agent/page.tsx and app/dashboard/features/site-alert/
// page.tsx — BotShieldPageClient needs real NEXT_PUBLIC_FIREBASE_* env
// vars that aren't available at static build-time prerendering.
import BotShieldPageClient from '@/components/bot-shield/BotShieldPageClient';

// Scoped to this route only, same reasoning as styles/agent/agent-page.css's
// header comment — not in app/globals.css's @import list, so it only
// ships in this route's own chunk.
import '@/styles/bot-shield/bot-shield-page.css';

export const dynamic = 'force-dynamic';

export default function Page() {
  return <BotShieldPageClient />;
}
