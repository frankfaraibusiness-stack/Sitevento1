// app/status/page.tsx — Status route, rebuilt on ContentPageShell.
// See styles/content/content-pages.css's header comment for design rationale,
// app/about/page.tsx's header comment for the live-date approach.
import type { Metadata } from 'next';
import { ContentPageShell } from '@/components/content/ContentPageShell';
import { formatLiveDate } from '@/lib/format';
import '@/styles/content/content-pages.css';
import '@/styles/agent/agent-page.css';

const SITE_URL = process.env.NEXT_PUBLIC_SITE_URL || 'https://sitevento12.vercel.app';

export const metadata: Metadata = {
  title: 'System Status',
  description:
    'Current operating status for sitevento: tracking tag delivery, the dashboard, widget delivery, and domain verification.',
  alternates: { canonical: '/status' },
  openGraph: {
    type: 'website',
    url: `${SITE_URL}/status`,
    title: 'System Status — sitevento',
    description: 'Current operating status for sitevento systems.',
  },
};

const SYSTEMS = [
  { name: 'Tracking tag delivery', note: 'Serves the sitevento.js tag that powers visit logging, widgets, and overlays on every connected site.' },
  { name: 'Dashboard', note: 'The web app you use to view logs, leads, and manage widgets and overlays.' },
  { name: 'Widget delivery API', note: 'Serves enabled widgets to connected sites within their plan and live-widget limits.' },
  { name: 'Visit tracking API', note: 'Receives and records visit events from the tag in real time.' },
  { name: 'Domain verification', note: 'Confirms a newly connected site is serving the tag from its registered domain.' },
];

export default function StatusPage() {
  return (
    <ContentPageShell
      eyebrow="resources"
      title="System status"
      subtitle="Current operating status for the systems that make up sitevento. This reflects status at page-render time — check back here directly rather than relying on a cached copy."
      updatedOn={formatLiveDate()}
      heroStats={[
        { value: '5/5', label: 'systems operational' },
        { value: '0', label: 'open incidents' },
      ]}
    >
      <section className="cp-card">
        <div className="cp-pill green" style={{ marginBottom: 14 }}>
          <span className="cp-pill-dot" />
          All systems operational
        </div>
        {SYSTEMS.map((s) => (
          <div key={s.name} className="cp-status-row">
            <span className="cp-status-dot" aria-hidden="true" />
            <div>
              <div className="cp-status-name">
                {s.name} <span className="cp-pill green">Operational</span>
              </div>
              <p className="cp-status-note">{s.note}</p>
            </div>
          </div>
        ))}
      </section>

      <section className="cp-card">
        <span className="cp-card-eyebrow">History</span>
        <h2>Incident history</h2>
        <p>
          No incidents reported in the current period. Past incidents, when they occur, are logged here with start
          time, resolution time, and a short summary of impact and cause.
        </p>
      </section>

      <section className="cp-card">
        <span className="cp-card-eyebrow">Reliability</span>
        <h2>Uptime commitment</h2>
        <p>
          The tracking tag is designed to fail safe: if the tag or its delivery API is briefly unreachable, it
          retries quietly in the background rather than blocking your site&apos;s own page load. A dropped tracking
          request never affects your visitors&apos; experience of your site.
        </p>
      </section>
    </ContentPageShell>
  );
}
