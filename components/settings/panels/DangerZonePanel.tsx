'use client';

// components/settings/panels/DangerZonePanel.tsx
//
// Previously every button here was inert — no confirmation, no
// backend call. This is a real rewrite: every action below calls
// app/api/user-action/route.ts (the 'pause-all-sites' /
// 'disconnect-all-sites' / 'delete-all-widgets' / 'delete-account'
// cases added alongside this panel) and every one of them confirms
// first via the shared ConfirmPopup
// (components/widgets/WidgetStatusPopup.tsx) — the same popup used
// for the widget live/off toggle and for sign-out, so a destructive
// action here looks and behaves like every other "are you sure?"
// moment in the app rather than a one-off dialog.
//
// Email-confirmation for account deletion (instead of a re-typed
// password) is deliberate: a Google-signed-in account has no app
// password to check, so matching the verified account's own email is
// the one confirmation method that works for every sign-in method.
import { useState } from 'react';
import type { User } from 'firebase/auth';
import { callUserAction } from '@/lib/userActionClient';
import { ConfirmPopup } from '@/components/widgets/WidgetStatusPopup';
import '@/styles/settings/danger-zone.css';

interface DangerZonePanelProps {
  user: User | null;
}

type ActionKind = 'pause' | 'disconnect' | 'widgets' | 'delete' | null;

interface ResultBanner {
  kind: 'success' | 'error';
  text: string;
}

export default function DangerZonePanel({ user }: DangerZonePanelProps) {
  const [openAction, setOpenAction] = useState<ActionKind>(null);
  const [busy, setBusy] = useState(false);
  const [banner, setBanner] = useState<ResultBanner | null>(null);

  const email = user?.email || '';
  // Only Google sign-in accounts on this app have no password at
  // all — providerData carries 'google.com' for those. Shown as a
  // small note on the delete card so email-confirmation doesn't read
  // as an arbitrary choice.
  const isGoogleAccount = !!user?.providerData?.some((p) => p.providerId === 'google.com');

  function close() {
    if (busy) return;
    setOpenAction(null);
  }

  async function runAction(
    action: 'pause-all-sites' | 'disconnect-all-sites' | 'delete-all-widgets' | 'delete-account',
    payload: Record<string, unknown>,
    successText: (data: Record<string, unknown> | undefined) => string
  ) {
    if (!user) return;
    setBusy(true);
    setBanner(null);
    const result = await callUserAction(user, action, payload);
    setBusy(false);

    if (!result.ok) {
      setBanner({ kind: 'error', text: result.error || 'Something went wrong. Please try again.' });
      return;
    }

    setOpenAction(null);
    if (action === 'delete-account') {
      // Account is gone server-side — nothing left to show a banner
      // to. Send them home the same way sign-out does.
      window.location.href = window.location.origin + '/';
      return;
    }
    setBanner({ kind: 'success', text: successText(result.data as Record<string, unknown> | undefined) });
  }

  return (
    <>
      <div className="settings-panel-header">
        <svg viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2">
          <circle cx="12" cy="12" r="10" />
          <line x1="12" y1="8" x2="12" y2="12" />
          <line x1="12" y1="16" x2="12.01" y2="16" />
        </svg>
        <h3>Danger Zone</h3>
      </div>
      <p className="settings-panel-desc">
        Irreversible actions on your entire account. Each one asks you to confirm before anything happens.
      </p>
      <hr className="settings-divider" />

      {banner ? (
        <div className={`dz-banner dz-banner-${banner.kind}`} role="status">
          {banner.text}
        </div>
      ) : null}

      <div className="dz-grid">
        <div className="dz-card">
          <div className="dz-card-icon dz-icon-pause" aria-hidden="true">
            <svg viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2">
              <rect x="6" y="4" width="4" height="16" rx="1" />
              <rect x="14" y="4" width="4" height="16" rx="1" />
            </svg>
          </div>
          <div className="dz-card-body">
            <h4>Pause All Sites</h4>
            <p>
              Stops tracking and widgets on every connected site immediately, without disconnecting them. Sites
              stay listed and can be resumed individually at any time.
            </p>
          </div>
          <button type="button" className="dz-btn dz-btn-warn" onClick={() => setOpenAction('pause')} disabled={!user}>
            Pause All Sites
          </button>
        </div>

        <div className="dz-card">
          <div className="dz-card-icon dz-icon-disconnect" aria-hidden="true">
            <svg viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2">
              <path d="M18.36 5.64a9 9 0 1 1-12.73 0" />
              <line x1="12" y1="2" x2="12" y2="12" />
            </svg>
          </div>
          <div className="dz-card-body">
            <h4>Disconnect All Sites</h4>
            <p>
              Removes every connected site from your account. Visit and lead history already recorded is kept, but
              no new data will be collected until you reconnect a site.
            </p>
          </div>
          <button type="button" className="dz-btn dz-btn-danger" onClick={() => setOpenAction('disconnect')} disabled={!user}>
            Disconnect All Sites
          </button>
        </div>

        <div className="dz-card">
          <div className="dz-card-icon dz-icon-widgets" aria-hidden="true">
            <svg viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2">
              <rect x="3" y="4" width="18" height="16" rx="2" />
              <path d="M3 9h18" />
            </svg>
          </div>
          <div className="dz-card-body">
            <h4>Delete All Live Widgets</h4>
            <p>
              Removes every widget currently enabled on every site — banners, popups, and overlays stop showing to
              visitors right away. The widgets themselves stay in the catalog if you want to re-add one later.
            </p>
          </div>
          <button type="button" className="dz-btn dz-btn-warn" onClick={() => setOpenAction('widgets')} disabled={!user}>
            Delete All Live Widgets
          </button>
        </div>

        <div className="dz-card dz-card-critical">
          <div className="dz-card-icon dz-icon-delete" aria-hidden="true">
            <svg viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2">
              <polyline points="3 6 5 6 21 6" />
              <path d="M19 6l-1 14a2 2 0 0 1-2 2H8a2 2 0 0 1-2-2L5 6m5-3h4a1 1 0 0 1 1 1v2H9V4a1 1 0 0 1 1-1z" />
            </svg>
          </div>
          <div className="dz-card-body">
            <h4>Delete My Account</h4>
            <p>
              Permanently deletes your account, every connected site, and every live widget. This cannot be undone.
            </p>
            {isGoogleAccount ? (
              <p className="dz-card-note">
                You signed in with Google, so there&rsquo;s no account password to re-enter — typing your account
                email confirms it&rsquo;s really you.
              </p>
            ) : null}
          </div>
          <button type="button" className="dz-btn dz-btn-critical" onClick={() => setOpenAction('delete')} disabled={!user}>
            Delete My Account
          </button>
        </div>
      </div>

      <ConfirmPopup
        open={openAction === 'pause'}
        title="Pause all sites?"
        message="Tracking and widgets will stop on every connected site right away. You can resume them individually from Site Manage at any time."
        confirmLabel="Pause All Sites"
        busyLabel="Pausing…"
        busy={busy}
        onConfirm={() =>
          runAction('pause-all-sites', { paused: true }, (data) => {
            const n = typeof data?.affected === 'number' ? data.affected : 0;
            return n > 0 ? `Paused ${n} site${n === 1 ? '' : 's'}.` : 'No sites to pause.';
          })
        }
        onClose={close}
      />

      <ConfirmPopup
        open={openAction === 'disconnect'}
        title="Disconnect all sites?"
        danger
        message="Every connected site will be removed from your account. Already-recorded visits and leads are kept, but no new data will be collected until you reconnect a site. This can't be undone."
        confirmLabel="Disconnect All Sites"
        busyLabel="Disconnecting…"
        busy={busy}
        requireText="disconnect"
        requireTextLabel='Type "disconnect" to confirm'
        onConfirm={() =>
          runAction('disconnect-all-sites', {}, (data) => {
            const n = typeof data?.affected === 'number' ? data.affected : 0;
            return n > 0 ? `Disconnected ${n} site${n === 1 ? '' : 's'}.` : 'No sites to disconnect.';
          })
        }
        onClose={close}
      />

      <ConfirmPopup
        open={openAction === 'widgets'}
        title="Delete all live widgets?"
        danger
        message="Every widget currently enabled on any site will stop showing to visitors immediately. This affects every site at once and can't be undone."
        confirmLabel="Delete All Widgets"
        busyLabel="Deleting…"
        busy={busy}
        onConfirm={() =>
          runAction('delete-all-widgets', {}, (data) => {
            const n = typeof data?.affected === 'number' ? data.affected : 0;
            return n > 0 ? `Deleted ${n} widget${n === 1 ? '' : 's'}.` : 'No live widgets to delete.';
          })
        }
        onClose={close}
      />

      <ConfirmPopup
        open={openAction === 'delete'}
        title="Delete your account?"
        danger
        message="This permanently deletes your account, every connected site, and every live widget. There is no way to undo this."
        confirmLabel="Delete My Account"
        busyLabel="Deleting account…"
        busy={busy}
        requireText={email || undefined}
        requireTextLabel={email ? `Type your account email (${email}) to confirm` : 'Type your account email to confirm'}
        onConfirm={() => runAction('delete-account', { confirmEmail: email }, () => 'Account deleted.')}
        onClose={close}
      />
    </>
  );
}
