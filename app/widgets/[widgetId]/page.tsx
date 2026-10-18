// app/widgets/[widgetId]/page.tsx — one route for every widget's own
// design page (e.g. /widgets/spin-wheel, /widgets/support-chat).
//
// Mirrors app/widgets/page.tsx's own split: this file stays a Server
// Component so `generateMetadata` below (and `generateStaticParams`)
// are honored by Next.js, while the interactive tree — which needs
// real NEXT_PUBLIC_FIREBASE_* env vars not present at static build
// time — lives in components/widgets/designer/WidgetDesigner.tsx.
//
// Metadata is generated once per catalog entry (lib/widgets.ts) rather
// than hand-written per widget, so a new widget added to that catalog
// gets a crawlable, properly-titled /widgets/{id} page with zero extra
// work here — the whole point of sharing this route across every
// current and future widget instead of hand-building a page per
// widget.
import type { Metadata } from 'next';
import { notFound } from 'next/navigation';
import { Suspense } from 'react';
import { WidgetDesigner } from '@/components/widgets/designer/WidgetDesigner';
import { BootSplash } from '@/components/BootSplash';
import { WIDGET_CATALOG, getWidgetCatalogEntry } from '@/lib/widgets';

const SITE_URL = process.env.NEXT_PUBLIC_SITE_URL || 'https://sitevento12.vercel.app';

export const dynamic = 'force-dynamic';

export function generateStaticParams() {
  return WIDGET_CATALOG.map((w) => ({ widgetId: w.id }));
}

export function generateMetadata({ params }: { params: { widgetId: string } }): Metadata {
  const entry = getWidgetCatalogEntry(params.widgetId);
  if (!entry) {
    return { title: 'Widget not found — sitevento' };
  }
  const title = `${entry.name} Widget — Design & Add to Your Site`;
  const description = `${entry.description} Customize colors, text, and timing, preview it live on your own site, then turn it on — no code, no redeploy.`;
  return {
    title,
    description,
    alternates: { canonical: `/widgets/${entry.id}` },
    openGraph: {
      type: 'article',
      url: `${SITE_URL}/widgets/${entry.id}`,
      title: `${entry.name} — sitevento`,
      description,
    },
    twitter: {
      card: 'summary_large_image',
      title: `${entry.name} — sitevento`,
      description,
    },
  };
}

export default function WidgetDesignerPage({ params }: { params: { widgetId: string } }) {
  const entry = getWidgetCatalogEntry(params.widgetId);
  if (!entry) notFound();

  return (
    <Suspense fallback={<BootSplash />}>
      <WidgetDesigner widgetId={params.widgetId} />
    </Suspense>
  );
}
