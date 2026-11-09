'use client';

// components/console/ConsoleClient.tsx
//
// Top-level client component for /console. Gates on useConsoleAuth()
// (passcode cookie, entirely separate from the app's real auth — see
// app/api/console-auth's header) and, once authorized, renders the
// sticky ConsoleHeader + ConsoleDashboard.
import { GlobalLoader } from '@/components/GlobalLoader';
import { useConsoleAuth } from '@/hooks/useConsoleAuth';
import { ConsolePasscodeGate } from './ConsolePasscodeGate';
import { ConsoleHeader } from './ConsoleHeader';
import { ConsoleDashboard } from './ConsoleDashboard';

export default function ConsoleClient() {
  const { checking, authorized, submitting, error, submitPasscode, signOutConsole } = useConsoleAuth();

  if (checking) {
    return <GlobalLoader variant="inline" fullScreen label="Checking console access" />;
  }

  if (!authorized) {
    return <ConsolePasscodeGate submitting={submitting} error={error} onSubmit={submitPasscode} />;
  }

  return (
    <div className="console-shell">
      <ConsoleHeader onSignOut={signOutConsole} />
      <main className="console-main">
        <ConsoleDashboard />
      </main>
    </div>
  );
}
