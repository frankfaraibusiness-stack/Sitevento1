import type { LegalSection } from '@/components/legal/LegalPage';

const SYSTEMS = [
  { name: 'Tracking tag delivery', note: 'Serves the sitevento.js tag that powers visit logging, widgets, and overlays on every connected site.' },
  { name: 'Dashboard', note: 'The web app you use to view logs, leads, and manage widgets and overlays.' },
  { name: 'Widget delivery API', note: 'Serves enabled widgets to connected sites within their plan and live-widget limits.' },
  { name: 'Visit tracking API', note: 'Receives and records visit events from the tag in real time.' },
  { name: 'Domain verification', note: 'Confirms a newly connected site is serving the tag from its registered domain.' },
];

export const statusIntro = (
  <p>
    Current operating status for the systems that make up sitevento. This page reflects status at a point in time —
    for live, continuously updated incident history, check back here directly rather than relying on a cached copy.
  </p>
);

export const statusSections: LegalSection[] = [
  {
    id: 'systems',
    heading: 'All systems',
    body: (
      <ul className="status-list">
        {SYSTEMS.map((s) => (
          <li key={s.name} className="status-list-item">
            <span className="status-list-dot" aria-hidden="true" />
            <div>
              <div className="status-list-name">
                {s.name} <span className="status-list-ok">Operational</span>
              </div>
              <p className="status-list-note">{s.note}</p>
            </div>
          </li>
        ))}
      </ul>
    ),
  },
  {
    id: 'incident-history',
    heading: 'Incident history',
    body: (
      <p>
        No incidents reported in the current period. Past incidents, when they occur, are logged here with start
        time, resolution time, and a short summary of impact and cause.
      </p>
    ),
  },
  {
    id: 'uptime',
    heading: 'Uptime commitment',
    body: (
      <p>
        The tracking tag is designed to fail safe: if the tag or its delivery API is briefly unreachable, it retries
        quietly in the background rather than blocking your site&apos;s own page load. A dropped tracking request
        never affects your visitors&apos; experience of your site.
      </p>
    ),
  },
];
