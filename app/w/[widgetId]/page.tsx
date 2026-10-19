// app/w/[widgetId]/page.tsx
//
// This is what every widget's `bundleUrl` actually points at
// (https://YOUR-DEPLOYMENT/w/{widgetId}) — the page public/sitevento.js
// mounts inside a sandboxed iframe on a customer's site (see
// renderWidget() there). One dynamic route handles all 10 ids so adding
// an 11th widget later is "add a case to WidgetRenderer.tsx", not a new
// route file.
//
// This page is deliberately NOT built from the dashboard's own
// components/CSS (dashboard.css etc. are meant for the owner-facing
// /dashboard route, which this is not): everything here is inline-
// styled so it renders correctly and consistently regardless of
// whatever CSS the dashboard's global stylesheet happens to define,
// since this file still sits under the same app/layout.tsx that
// imports globals.css for the rest of the app.
//
// Per-site config arrives via the URL's #cfg hash fragment (set by
// sitevento.js), not a query string or server fetch — a hash fragment
// is never sent in the actual HTTP request line, so this stays a
// static, cacheable page with no server-side per-request work, and the
// iframe has zero knowledge of Firestore/credentials.
import { WidgetRenderer } from './WidgetRenderer';
import { WIDGET_CATALOG } from '@/lib/widgets';

// Pre-renders a static page for every id in the catalog (so none of
// them needs a per-request server render — see the note above on why
// this route has no server-side work to do) while still allowing an id
// added to the catalog later to render on first request rather than
// 404ing, since this isn't combined with `dynamicParams = false`.
export function generateStaticParams() {
  return WIDGET_CATALOG.map((w) => ({ widgetId: w.id }));
}

// app/layout.tsx (shared by every route) imports globals.css, which
// sets `html, body { background: var(--bg); }` (styles/base.css) —
// solid white. WidgetRenderer's own WRAP_STYLE already sets
// `background: 'transparent'` on its content wrapper, as intended for
// a widget meant to blend into whatever page it's embedded on, but
// that transparency has nothing to show through to as long as <body>
// itself — one level up, owned by the shared root layout, outside
// this page's control — is painted solid white underneath it. That
// white fill is what shows as a solid block around/behind a widget
// like the iframe-isolated spin wheel instead of the customer's own
// page background.
//
// Scoped here (not in globals.css) so this touches only `/w/*`
// requests — every other route keeps the white page background it
// already relies on. A plain <style> tag is enough since this route
// is statically pre-rendered (see generateStaticParams above) with no
// per-request logic.
function TransparentBodyStyle() {
  return (
    <style
      // eslint-disable-next-line react/no-danger
      dangerouslySetInnerHTML={{
        __html: 'html, body { background: transparent !important; }',
      }}
    />
  );
}

export default function WidgetPage({ params }: { params: { widgetId: string } }) {
  return (
    <>
      <TransparentBodyStyle />
      <WidgetRenderer widgetId={params.widgetId} />
    </>
  );
}
