'use client';

// hooks/useSettingsState.ts
//
// Local UI state for the /settings pickers (font size, compact mode,
// toggle switches, select values). This intentionally does NOT read or
// write Firestore yet — the panels in this pass are pickers only, not
// wired up to real backing data/content. Swap this for a Firestore-
// backed version (same shape as useUserProfile.ts) once each picker's
// actual persistence is ready.
import { useState } from 'react';

export interface SettingsState {
  fontSize: 'small' | 'medium' | 'large';
  compactMode: boolean;
  emailNotifications: boolean;
  visitAlerts: boolean;
  leadAlerts: boolean;
  weeklySummary: boolean;
  marketingEmails: boolean;
}

const DEFAULT_STATE: SettingsState = {
  fontSize: 'medium',
  compactMode: false,
  emailNotifications: true,
  visitAlerts: true,
  leadAlerts: true,
  weeklySummary: false,
  marketingEmails: false,
};

export function useSettingsState() {
  const [state, setState] = useState<SettingsState>(DEFAULT_STATE);
  return { state, setState, loading: false };
}
