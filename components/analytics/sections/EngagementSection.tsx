// 11 · Engagement — custom events + on-site search.
import { RankedList, SectionTitle, SubHead } from './primitives';
import { CUSTOM_EVENTS, EVENTS_NOTE, EVENTS_TITLE, SEARCH_NOTE, SEARCH_NO_RESULTS, SEARCH_TERMS, SEARCH_TITLE } from './analyticsPlaceholderData';

export function EngagementSection() {
  return (
    <section className="an-section" id="engagement" aria-label="Engagement">
      <div className="an-row-2">
        <div>
          <SectionTitle title={EVENTS_TITLE} note={EVENTS_NOTE} />
          <div className="an-log">
            {CUSTOM_EVENTS.map((e) => (
              <div key={e.name} className="an-event-row">
                <span className="an-event-badge">{e.kind}</span>
                <span className="an-event-name">{e.name}</span>
                <span className="an-event-count">{e.count}</span>
              </div>
            ))}
          </div>
        </div>

        <div>
          <SectionTitle title={SEARCH_TITLE} note={SEARCH_NOTE} />
          <div>
            {SEARCH_TERMS.map((t) => (
              <span key={t.term} className="an-search-chip">
                {t.term} <small>{t.count}</small>
              </span>
            ))}
          </div>
          <SubHead>Top searches with no results</SubHead>
          <RankedList rows={SEARCH_NO_RESULTS} bars={false} />
        </div>
      </div>
    </section>
  );
}
