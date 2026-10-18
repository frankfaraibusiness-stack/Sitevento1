'use client';

import { useRouter } from 'next/navigation';

export default function BillingPanel() {
  const router = useRouter();
  return (
    <>
      <div className="settings-panel-header">
        <svg viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2">
          <rect x="1" y="4" width="22" height="16" rx="2" ry="2" />
          <line x1="1" y1="10" x2="23" y2="10" />
        </svg>
        <h3>Billing &amp; Plans</h3>
      </div>
      <p className="settings-panel-desc">Manage your plan and payment details.</p>
      <hr className="settings-divider" />

      <div className="settings-input-group">
        <label>Current Plan</label>
        <select className="settings-select">
          <option>Free</option>
          <option>Starter</option>
          <option>Scale</option>
          <option>Pro Developer</option>
        </select>
        <span className="settings-hint">Changing plans is handled on the Plans page.</span>
      </div>

      <button className="settings-save-btn" type="button" onClick={() => router.push('/dashboard/plans')}>
        View Plans
      </button>

      <hr className="settings-divider" />

      <div className="settings-input-group">
        <label>Payment Method</label>
        <div className="settings-placeholder-note">No payment method on file yet.</div>
      </div>
    </>
  );
}
