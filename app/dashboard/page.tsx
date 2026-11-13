// app/dashboard/page.tsx — the old Dashboard overview page has been removed.
// Analytics (/dashboard/analytics) is the app's main stats page now. This
// route only exists so old bookmarks, emails and external links to
// /dashboard keep working: it permanently redirects to the Analytics page.
import { permanentRedirect } from 'next/navigation';

export default function DashboardRedirectPage() {
  permanentRedirect('/dashboard/analytics');
}
