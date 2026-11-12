'use client';

// 11 · Engagement — custom events + on-site search.
import { Empty, RankedList, SectionTitle, SubHead } from './primitives';
import { EVENTS_NOTE, EVENTS_TITLE, SEARCH_NOTE, SEARCH_TITLE } from './analyticsTypes';
import { useAnalyticsData } from '../AnalyticsDataContext';
import { fmtPct } from '@/lib/dashboardStats';

export function EngagementSection() {
  const { model } = useAnalyticsData();
  const { events, search } = model.engagement;
  return (
    <section className="an-section" id="engagement" aria-label="Engagement">
      <div className="an-row-2">
        <div>
          <SectionTitle title={EVENTS_TITLE} note={EVENTS_NOTE} />
          {events.length ? (
            <div className="an-log">
              {events.map((e) => (
                <div key={e.name} className="an-event-row">
                  <span className="an-event-badge">{e.kind}</span>
                  <span className="an-event-name">{e.name}</span>
                  <span className="an-event-count">{e.count}</span>
                </div>
              ))}
            </div>
          ) : (
            <Empty title="No custom events yet">
              Fire one from your page with <code>sitevento(&apos;track&apos;, &apos;signup_clicked&apos;)</code>, or from your server with <code>custom.your_name</code> through the API.
            </Empty>
          )}
        </div>

        <div>
          <SectionTitle title={SEARCH_TITLE} note={search.foundRate === null ? SEARCH_NOTE : `${fmtPct(search.foundRate, 0)} found a result`} />
          {search.terms.length ? (
            <>
              <div>
                {search.terms.map((t) => (
                  <span key={t.term} className="an-search-chip">
                    {t.term} <small>{t.count}</small>
                  </span>
                ))}
              </div>
              <SubHead>Top searches with no results</SubHead>
              {search.noResults.length ? <RankedList rows={search.noResults} bars={false} /> : <div className="an-empty">Every search with a known result count found something.</div>}
            </>
          ) : (
            <Empty title="No searches yet">
              Report them with <code>sitevento(&apos;search&apos;, term, resultCount)</code> on your page, or send <code>search.performed</code> from your server.
            </Empty>
          )}
        </div>
      </div>
    </section>
  );
}
