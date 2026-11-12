'use client';

// components/api/ApiPermissions.tsx
//
// Step 2 of the API page: choose what the key may send for the selected
// startup. One toggle per permission in lib/apiPermissions.ts, grouped. Every
// row opens an inline explainer — what it is, how the number is worked out,
// which events to send, the fields, a ready example and where it shows up on
// the Analytics page. Switching a permission ON opens its explainer; OFF
// closes it. The explainer is also always available from "How it works".
import { useMemo, useState } from 'react';
import {
  API_PERMISSIONS,
  API_PERMISSION_GROUPS,
  API_PRESETS,
  type ApiPermissionDef,
} from '@/lib/apiPermissions';
import { IconCheck, IconChevronDown } from '@/components/analytics/AnalyticsIcons';
import { ApiIcon } from './apiIcons';
import { CodeBlock } from './CodeBlock';
import { useCopy } from './useCopy';

interface Props {
  siteId: string | null;
  selected: Set<string>;
  onToggle: (id: string) => void;
  onSet: (ids: string[]) => void;
}

/* ── The inline explainer ─────────────────────────────────────────── */
function InfoPanel({ def, siteId, on }: { def: ApiPermissionDef; siteId: string | null; on: boolean }) {
  const { copied, copy } = useCopy();
  const example = JSON.stringify({ ...def.example, ...(siteId ? { siteId } : {}) }, null, 2);

  return (
    <div className="apx-info">
      {!on && (
        <p className="apx-info-off">
          <ApiIcon name="info" /> Switched off — events of this type are rejected until you turn it on.
        </p>
      )}

      <section className="apx-info-block">
        <h5>What it is</h5>
        <p>{def.what}</p>
      </section>

      <section className="apx-info-block">
        <h5>How we calculate it</h5>
        <ul className="apx-checks">
          {def.how.map((line) => (
            <li key={line}>
              <span aria-hidden="true">
                <IconCheck />
              </span>
              {line}
            </li>
          ))}
        </ul>
      </section>

      <section className="apx-info-block">
        <h5>Events you send</h5>
        <ul className="apx-events">
          {def.events.map((ev) => (
            <li key={ev.name}>
              <button
                type="button"
                className={copied === `ev-${ev.name}` ? 'apx-evname is-done' : 'apx-evname'}
                onClick={() => copy(ev.name, `ev-${ev.name}`)}
                aria-label={`Copy event name ${ev.name}`}
                title="Copy event name"
              >
                {ev.name}
                <ApiIcon name={copied === `ev-${ev.name}` ? 'shield' : 'copy'} />
              </button>
              <span>{ev.when}</span>
            </li>
          ))}
        </ul>
      </section>

      <section className="apx-info-block">
        <h5>What to include</h5>
        <ul className="apx-fields">
          {def.fields.map((f) => (
            <li key={f.name}>
              <div className="apx-field-head">
                <code>{f.name}</code>
                <em>{f.type}</em>
                {f.required && <b>required</b>}
              </div>
              <p>{f.note}</p>
            </li>
          ))}
        </ul>
        <p className="apx-fields-foot">
          Add <code>occurredAt</code> (ISO date-time) to record something that happened earlier — it defaults to now.
        </p>
      </section>

      <section className="apx-info-block">
        <h5>Example</h5>
        <CodeBlock id={`ex-${def.id}`} label={def.events[0].name} code={example} json />
      </section>

      {def.caution && (
        <p className="apx-caution" role="note">
          <ApiIcon name="alert" />
          <span>{def.caution}</span>
        </p>
      )}

      <section className="apx-info-block">
        <h5>Where you’ll see it</h5>
        <div className="apx-preview">
          <div className="apx-preview-stats">
            {def.preview.map((s) => (
              <div key={s.label} className="apx-pstat">
                <small>{s.label}</small>
                <strong>{s.value}</strong>
                {s.note && <span>{s.note}</span>}
              </div>
            ))}
          </div>
          <div className="apx-preview-foot">
            <span className="apx-sample">Sample numbers</span>
            <span className="apx-powers">
              {def.powers.map((p) => (
                <i key={p}>{p}</i>
              ))}
            </span>
          </div>
        </div>
      </section>
    </div>
  );
}

/* ── One toggle row ───────────────────────────────────────────────── */
function Row({
  def,
  siteId,
  on,
  open,
  onToggle,
  onOpen,
}: {
  def: ApiPermissionDef;
  siteId: string | null;
  on: boolean;
  open: boolean;
  onToggle: () => void;
  onOpen: () => void;
}) {
  const panelId = `apx-panel-${def.id}`;
  const cls = ['apx-perm', on ? 'is-on' : '', open ? 'is-open' : ''].filter(Boolean).join(' ');
  return (
    <li className={cls}>
      <div className="apx-perm-head">
        <span className="apx-ico" aria-hidden="true">
          <ApiIcon name={def.icon} />
        </span>

        <div className="apx-perm-text">
          <div className="apx-perm-title">
            <h4>{def.label}</h4>
            <span className="apx-evcount">
              {def.events.length} {def.events.length === 1 ? 'event' : 'events'}
            </span>
          </div>
          <p>{def.tagline}</p>
          <button
            type="button"
            className="apx-more"
            aria-expanded={open}
            aria-controls={panelId}
            onClick={onOpen}
          >
            How it works
            <IconChevronDown />
          </button>
        </div>

        <button
          type="button"
          role="switch"
          aria-checked={on}
          aria-label={`Allow ${def.label}`}
          className={on ? 'apx-switch is-on' : 'apx-switch'}
          onClick={onToggle}
        >
          <i aria-hidden="true" />
        </button>
      </div>

      {/* grid-rows 0fr → 1fr animates height without measuring; closed content is visibility:hidden so it's out of the tab order. */}
      <div className="apx-collapse" id={panelId} data-open={open} role="region" aria-label={`${def.label} details`}>
        <div className="apx-collapse-in">
          <InfoPanel def={def} siteId={siteId} on={on} />
        </div>
      </div>
    </li>
  );
}

/* ── The step ─────────────────────────────────────────────────────── */
export function ApiPermissions({ siteId, selected, onToggle, onSet }: Props) {
  const [open, setOpen] = useState<Set<string>>(() => new Set());
  const total = API_PERMISSIONS.length;
  const count = selected.size;

  const activePreset = useMemo(() => {
    const key = Array.from(selected).sort().join('|');
    return API_PRESETS.find((p) => [...p.ids].sort().join('|') === key)?.id ?? null;
  }, [selected]);

  function setOpenFor(id: string, value?: boolean) {
    setOpen((cur) => {
      const next = new Set(cur);
      const want = value ?? !next.has(id);
      if (want) next.add(id);
      else next.delete(id);
      return next;
    });
  }

  function toggle(id: string) {
    const turningOn = !selected.has(id);
    onToggle(id);
    setOpenFor(id, turningOn);
  }

  function applyPreset(ids: string[]) {
    onSet(ids);
    setOpen(new Set());
  }

  const pct = Math.round((count / total) * 100);

  return (
    <div className="apx-perms">
      <div className="apx-card apx-summary-card">
        <div className="apx-ring" style={{ ['--p' as string]: `${pct}%` }} role="img" aria-label={`${count} of ${total} event types allowed`}>
          <strong>{count}</strong>
          <small>of {total}</small>
        </div>
        <div className="apx-summary-text">
          <h3>{count === 0 ? 'Nothing allowed yet' : `${count} event ${count === 1 ? 'type' : 'types'} allowed`}</h3>
          <p>Your key can only send what you switch on. Anything else is refused, so you’re always in control of what reaches your analytics.</p>
        </div>
        <div className="apx-presets" role="group" aria-label="Quick setups">
          {API_PRESETS.map((p) => (
            <button
              key={p.id}
              type="button"
              className={activePreset === p.id ? 'apx-preset is-on' : 'apx-preset'}
              aria-pressed={activePreset === p.id}
              title={p.note}
              onClick={() => applyPreset(p.ids)}
            >
              {p.label}
            </button>
          ))}
        </div>
      </div>

      {API_PERMISSION_GROUPS.map((g) => {
        const defs = API_PERMISSIONS.filter((p) => p.group === g.id);
        const onCount = defs.filter((d) => selected.has(d.id)).length;
        return (
          <section key={g.id} className="apx-group" aria-labelledby={`apx-g-${g.id}`}>
            <div className="apx-group-head">
              <div>
                <h3 id={`apx-g-${g.id}`}>{g.title}</h3>
                <p>{g.note}</p>
              </div>
              <span className={onCount ? 'apx-count is-on' : 'apx-count'}>
                {onCount}/{defs.length} on
              </span>
            </div>
            <ul className="apx-perm-list">
              {defs.map((def) => (
                <Row
                  key={def.id}
                  def={def}
                  siteId={siteId}
                  on={selected.has(def.id)}
                  open={open.has(def.id)}
                  onToggle={() => toggle(def.id)}
                  onOpen={() => setOpenFor(def.id)}
                />
              ))}
            </ul>
          </section>
        );
      })}
    </div>
  );
}
