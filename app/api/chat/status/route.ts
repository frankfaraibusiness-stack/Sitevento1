// app/api/chat/status/route.ts
//
// GET — reports whether the chat backend's actual dependencies are
// configured on THIS deployment, without ever returning a secret
// value itself. /api/chat (the real route the widget calls) always
// responds 200 with a usable reply even when something's missing —
// by design, so a visitor never sees a raw error — which also means
// a misconfigured deployment can silently run on canned fallback
// replies forever with nothing in the UI ever saying so. This route
// is the loud version: hit it directly (e.g.
// https://YOUR-DEPLOYMENT/api/chat/status) after setting env vars to
// confirm, in plain language, whether the chat is actually backed by
// Firestore + a real model call or still running on fallback text.
//
// Also does a live Firestore round-trip (not just an env-var presence
// check) so "configured" here means the same thing /api/chat itself
// needs: real, working Admin SDK credentials, not just three
// non-empty strings that might still be wrong/expired/mismatched.
import { NextResponse } from 'next/server';
import { getAdminDb } from '@/lib/firebaseAdmin';

export const runtime = 'nodejs';
export const maxDuration = 10;

export async function GET() {
  const result: {
    ok: boolean;
    firestore: { configured: boolean; reachable: boolean; error: string | null };
    ai: {
      groqConfigured: boolean;
      geminiConfigured: boolean;
      anyConfigured: boolean;
    };
    summary: string;
  } = {
    ok: false,
    firestore: { configured: false, reachable: false, error: null },
    ai: { groqConfigured: false, geminiConfigured: false, anyConfigured: false },
    summary: '',
  };

  // ── Firebase Admin / Firestore ────────────────────────────────────
  result.firestore.configured = !!(
    process.env.FIREBASE_PROJECT_ID &&
    process.env.FIREBASE_CLIENT_EMAIL &&
    process.env.FIREBASE_PRIVATE_KEY
  );

  if (result.firestore.configured) {
    try {
      const db = getAdminDb();
      // Cheapest possible real round-trip: read a single doc that may
      // or may not exist. A permission/credential problem throws here;
      // a missing doc does not (exists: false is a valid, successful
      // response) — so this proves the credentials actually work
      // against this project, not just that the env vars are set.
      await db.collection('siteIndex').limit(1).get();
      result.firestore.reachable = true;
    } catch (err) {
      result.firestore.reachable = false;
      result.firestore.error = err instanceof Error ? err.message : 'Unknown Firestore error';
      console.error('[chat/status] Firestore reachability check failed', err);
    }
  } else {
    result.firestore.error = 'Missing one or more of FIREBASE_PROJECT_ID, FIREBASE_CLIENT_EMAIL, FIREBASE_PRIVATE_KEY.';
  }

  // ── AI providers ───────────────────────────────────────────────────
  // Presence-only (not a live call) — a live call here would itself
  // burn a request against the same free-tier quota /api/chat relies
  // on, for a check that just needs to confirm the key exists.
  result.ai.groqConfigured = !!process.env.GROQ_API_KEY;
  result.ai.geminiConfigured = !!process.env.GEMINI_API_KEY;
  result.ai.anyConfigured = result.ai.groqConfigured || result.ai.geminiConfigured;

  result.ok = result.firestore.reachable && result.ai.anyConfigured;

  if (result.ok) {
    result.summary = 'Chat is fully live: messages persist to Firestore and replies come from a real AI call.';
  } else if (!result.firestore.configured) {
    result.summary =
      'Firebase Admin credentials are missing — chat messages are NOT being saved, and /api/chat is replying with a generic fallback line to every visitor.';
  } else if (!result.firestore.reachable) {
    result.summary =
      'Firebase Admin credentials are set but Firestore could not be reached — check firestore.error below. Chat is currently on fallback replies.';
  } else if (!result.ai.anyConfigured) {
    result.summary =
      'Firestore is working (messages ARE being saved), but no AI provider key is set — every reply is the canned fallback line, not a real AI response.';
  }

  return NextResponse.json(result, { status: 200, headers: { 'Cache-Control': 'no-store' } });
}
