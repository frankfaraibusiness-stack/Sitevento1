// lib/userActionClient.ts
//
// Thin client-side wrapper every hook uses to call
// app/api/user-action/route.ts — the single shared server-side route
// for every remaining user write (profile, settings, plan, site
// pause/disconnect, visitor restriction, overlay save). Centralizing
// the fetch-with-idToken boilerplate here means every hook calls this
// one function instead of each re-deriving "get the current user,
// fetch the idToken, POST it, parse the JSON, surface errors."
'use client';

import type { User } from 'firebase/auth';

export type UserActionName =
  | 'update-profile'
  | 'update-settings'
  | 'update-plan'
  | 'pause-site'
  | 'disconnect-site'
  | 'update-site-permissions'
  | 'restrict-visitor'
  | 'save-overlay'
  | 'accept-terms'
  | 'pause-all-sites'
  | 'disconnect-all-sites'
  | 'delete-all-widgets'
  | 'delete-account'
  | 'delete-lead'
  | 'restore-lead'
  | 'delete-visitor'
  | 'restore-visitor';

export interface UserActionResult<T = Record<string, unknown>> {
  ok: boolean;
  error?: string;
  code?: string;
  data?: T;
  // Present only on a WRITE_LIMIT_REACHED rejection — see
  // lib/serverAuth.ts's writeLimitResponse.
  limit?: number;
  used?: number;
  planId?: string;
  nextPlanId?: string | null;
  resetsAt?: string;
}

/**
 * Calls app/api/user-action with the given action + payload, using the
 * passed-in Firebase Auth user to obtain a fresh ID token. Never
 * throws — network/parse failures surface as `{ ok: false, error }`
 * the same way a server-side rejection would, so callers can handle
 * both with one code path.
 */
export async function callUserAction<T = Record<string, unknown>>(
  user: User,
  action: UserActionName,
  payload: Record<string, unknown>
): Promise<UserActionResult<T>> {
  try {
    const idToken = await user.getIdToken();
    const res = await fetch('/api/user-action', {
      method: 'POST',
      headers: { 'Content-Type': 'application/json' },
      body: JSON.stringify({ idToken, action, payload }),
    });
    const result = await res.json().catch(() => ({}));

    if (!res.ok || !result.ok) {
      if (result.code === 'WRITE_LIMIT_REACHED') {
        console.warn(`[user-action:${action}] daily write limit reached`, result);
      } else {
        console.error(`[user-action:${action}] failed`, result);
      }
      return {
        ok: false,
        error: result.error || 'Something went wrong making that change.',
        code: result.code,
        limit: result.limit,
        used: result.used,
        planId: result.planId,
        nextPlanId: result.nextPlanId,
        resetsAt: result.resetsAt,
      };
    }

    return { ok: true, data: result as T };
  } catch (err) {
    console.error(`[user-action:${action}] network error`, err);
    return { ok: false, error: 'Could not reach the server. Check your connection and try again.' };
  }
}
