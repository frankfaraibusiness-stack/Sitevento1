// app/api/chat/route.ts
//
// POST { siteId, sessionId, message, greeting? }
//
// Backs the Support Chat widget (app/w/[widgetId]/widgets/
// SupportChatWidget.tsx). Same siteId -> owner resolution as
// /api/widget and /api/feedback (never trusts the caller's claim
// without checking siteIndex), then:
//   1. appends the visitor's message to
//      users/{uid}/sites/{siteId}/chats/{sessionId}/messages
//   2. asks lib/aiReply.ts for a reply (Groq, falling back to Gemini,
//      falling back to a canned line — see that file)
//   3. appends the assistant's reply to the same thread
//   4. returns the reply text to the widget
//
// sessionId is a random id the widget generates and keeps in
// localStorage per visitor (same pattern as sitevento.js's own visitor
// id) — not a secret, just a thread key, the same trust level as
// siteId itself. Rate-limited per site+IP like the other visitor-facing
// routes, and always responds 200 with a usable `reply` even on
// internal failure so the widget never shows a raw error bubble.
import { NextRequest, NextResponse } from 'next/server';
import { getAdminDb } from '@/lib/firebaseAdmin';
import { FieldValue } from 'firebase-admin/firestore';
import { allow } from '@/lib/rateLimit';
import { getAiReply, type ChatTurn } from '@/lib/aiReply';

export const maxDuration = 20;
export const runtime = 'nodejs';

const CORS_HEADERS = {
  'Access-Control-Allow-Origin': '*',
  'Access-Control-Allow-Methods': 'POST, OPTIONS',
  'Access-Control-Allow-Headers': 'Content-Type',
};

const MAX_MESSAGE_LEN = 1000;
const HISTORY_LIMIT = 12; // last N turns sent to the model, for cost/latency

function fallbackReply(text: string) {
  return NextResponse.json({ ok: true, reply: text, provider: 'fallback' }, { status: 200, headers: CORS_HEADERS });
}

export async function OPTIONS() {
  return new NextResponse(null, { status: 204, headers: CORS_HEADERS });
}

export async function POST(req: NextRequest) {
  try {
    const body = await req.json().catch(() => ({}));
    const { siteId, sessionId, message, greeting } = body || {};

    if (!siteId || typeof siteId !== 'string') {
      return fallbackReply('Sorry, this chat isn\u2019t set up correctly on this page.');
    }
    const sid = typeof sessionId === 'string' && sessionId ? sessionId.slice(0, 100) : 'anon';
    const trimmed = typeof message === 'string' ? message.trim().slice(0, MAX_MESSAGE_LEN) : '';
    if (!trimmed) {
      return fallbackReply('Could you type a message?');
    }

    const forwardedFor = req.headers.get('x-forwarded-for') || '';
    const ip = forwardedFor.split(',')[0].trim() || 'unknown';
    if (!allow(`chat:${siteId}:${ip}`, 20, 60_000)) {
      return fallbackReply('You\u2019re sending messages a little fast \u2014 try again in a moment.');
    }

    let db;
    try {
      db = getAdminDb();
    } catch (err) {
      console.error('[chat] Firebase Admin init error', err);
      return fallbackReply('Thanks for your message \u2014 we\u2019ll get back to you.');
    }

    const indexSnap = await db.collection('siteIndex').doc(siteId).get();
    const uid: string | null = indexSnap.exists ? indexSnap.data()?.uid ?? null : null;
    if (!uid) {
      return fallbackReply('This chat isn\u2019t available right now.');
    }
    const siteRef = db.collection('users').doc(uid).collection('sites').doc(siteId);
    const siteSnap = await siteRef.get();
    if (!siteSnap.exists) {
      return fallbackReply('This chat isn\u2019t available right now.');
    }

    const threadRef = siteRef.collection('chats').doc(sid).collection('messages');

    // Pull recent history for context before appending the new user
    // message, so the model sees the conversation that led up to it.
    const historySnap = await threadRef.orderBy('ts', 'desc').limit(HISTORY_LIMIT).get();
    const history: ChatTurn[] = historySnap.docs
      .map((d) => d.data())
      .reverse()
      .map((d: any): ChatTurn => ({ role: d.role === 'assistant' ? 'assistant' : 'user', content: String(d.text || '') }))
      .filter((t) => t.content);

    await threadRef.add({ role: 'user', text: trimmed, ts: FieldValue.serverTimestamp() });
    await siteRef.collection('chats').doc(sid).set(
      { lastMessageAt: FieldValue.serverTimestamp(), lastMessage: trimmed },
      { merge: true }
    );

    const greetingText = typeof greeting === 'string' && greeting ? greeting : 'Hi! How can we help?';
    const { reply, provider } = await getAiReply([...history, { role: 'user', content: trimmed }], greetingText);

    await threadRef.add({ role: 'assistant', text: reply, provider, ts: FieldValue.serverTimestamp() });

    return NextResponse.json({ ok: true, reply, provider }, { status: 200, headers: CORS_HEADERS });
  } catch (err) {
    console.error('[chat] handler error', err);
    return fallbackReply('Thanks for your message \u2014 we\u2019ll get back to you.');
  }
}
