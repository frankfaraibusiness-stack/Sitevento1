// lib/sessionClient.ts
//
// Thin client around app/api/session/route.ts. Call establishSession()
// right after any successful client-SDK sign-in (email/password,
// Google popup, or the custom-token exchange after server-side
// signup) so the server-side HttpOnly cookie gets created alongside
// the client SDK's own session — see useAuth.ts for why the cookie,
// not IndexedDB, is what pages trust on first load.
'use client';

export async function establishSession(idToken: string): Promise<boolean> {
  try {
    const res = await fetch('/api/session', {
      method: 'POST',
      headers: { 'Content-Type': 'application/json' },
      body: JSON.stringify({ idToken }),
    });
    const data = await res.json().catch(() => ({}));
    return res.ok && !!data.ok;
  } catch (err) {
    console.error('[sessionClient] establishSession error', err);
    return false;
  }
}

export async function clearSession(): Promise<void> {
  try {
    await fetch('/api/session', { method: 'DELETE' });
  } catch (err) {
    console.error('[sessionClient] clearSession error', err);
  }
}

export interface ServerSession {
  uid: string;
  email: string | null;
}

/** Reads the current server-side session cookie, if any. Never throws. */
export async function readSession(): Promise<ServerSession | null> {
  try {
    const res = await fetch('/api/session', { method: 'GET', cache: 'no-store' });
    const data = await res.json().catch(() => ({}));
    if (res.ok && data.ok) {
      return { uid: data.uid, email: data.email ?? null };
    }
    return null;
  } catch (err) {
    console.error('[sessionClient] readSession error', err);
    return null;
  }
}
