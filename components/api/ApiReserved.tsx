'use client';

// components/api/ApiReserved.tsx
//
// Step 4: what the API can NEVER write. Traffic and visitor numbers come
// only from the sitevento script in real browsers, so nobody — including the
// site owner — can inflate them through a key. Shown as locked cards on
// purpose: it's a feature, and the reason the analytics can be trusted.
import { RESERVED_METRICS } from '@/lib/apiPermissions';
import { IconLock } from '@/components/analytics/AnalyticsIcons';
import { ApiIcon } from './apiIcons';

export function ApiReserved() {
  return (
    <div className="apx-card apx-reserved">
      <div className="apx-reserved-head">
        <span className="apx-ico is-lg is-lock" aria-hidden="true">
          <ApiIcon name="shield" />
        </span>
        <div>
          <h3>Traffic can’t be written by the API</h3>
          <p>
            Visits, clicks and visitors are measured by the sitevento script in real browsers — never accepted from a server. That’s what keeps your
            analytics honest: nobody, not even you, can add a visitor or a click with a key.
          </p>
        </div>
      </div>

      <ul className="apx-reserved-grid">
        {RESERVED_METRICS.map((m) => (
          <li key={m.id}>
            <span className="apx-ico" aria-hidden="true">
              <ApiIcon name={m.icon} />
            </span>
            <div>
              <b>{m.label}</b>
              <p>{m.note}</p>
            </div>
            <span className="apx-lockchip" title="Always blocked">
              <IconLock /> Locked
            </span>
          </li>
        ))}
      </ul>

      <p className="apx-note">
          <ApiIcon name="info" />
          <span>Sending one of these names returns <code>403 reserved_event</code> and nothing is recorded — even with the right key.</span>
        </p>
    </div>
  );
}
