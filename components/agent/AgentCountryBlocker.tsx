'use client';

// components/agent/AgentCountryBlocker.tsx
//
// Country picker for the 'country-block' feature (lib/agent.ts).
// Only rendered by AgentPageClient when that feature id is enabled —
// this is the feature's configuration surface, not a standalone
// toggle; the on/off switch itself lives in AgentFeatureGrid like
// every other feature. Search-filtered checklist rather than a native
// <select multiple> so it stays usable at ~195 entries on mobile.
import { useMemo, useState } from 'react';
import { COUNTRIES } from '@/lib/countries';

interface AgentCountryBlockerProps {
  selected: string[];
  onToggle: (code: string, next: boolean) => void;
}

export function AgentCountryBlocker({ selected, onToggle }: AgentCountryBlockerProps) {
  const [query, setQuery] = useState('');

  const filtered = useMemo(() => {
    const q = query.trim().toLowerCase();
    if (!q) return COUNTRIES;
    return COUNTRIES.filter((c) => c.name.toLowerCase().includes(q) || c.code.toLowerCase() === q);
  }, [query]);

  const selectedSet = new Set(selected);

  return (
    <div className="agt-country-box">
      <div className="agt-country-head">
        <input
          type="text"
          className="agt-country-search"
          placeholder="Search countries…"
          value={query}
          onChange={(e) => setQuery(e.target.value)}
          aria-label="Search countries to block"
        />
        <span className="agt-country-count">{selected.length} blocked</span>
      </div>

      {selected.length > 0 && (
        <div className="agt-country-chips">
          {selected.map((code) => {
            const c = COUNTRIES.find((x) => x.code === code);
            return (
              <button type="button" key={code} className="agt-country-chip" onClick={() => onToggle(code, false)}>
                {c?.name || code}
                <svg viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth={2.5}>
                  <path d="M18 6 6 18M6 6l12 12" />
                </svg>
              </button>
            );
          })}
        </div>
      )}

      <div className="agt-country-list" role="listbox" aria-multiselectable="true">
        {filtered.length === 0 && <p className="agt-row-note agt-country-empty">No countries match “{query}”.</p>}
        {filtered.map((c) => {
          const isOn = selectedSet.has(c.code);
          return (
            <label key={c.code} className={`agt-country-row${isOn ? ' is-on' : ''}`}>
              <input type="checkbox" checked={isOn} onChange={(e) => onToggle(c.code, e.target.checked)} />
              <span className="agt-country-name">{c.name}</span>
              <span className="agt-country-code">{c.code}</span>
            </label>
          );
        })}
      </div>
    </div>
  );
}
