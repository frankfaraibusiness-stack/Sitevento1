// app/api/chat/route.ts
//
// POST { siteId, sessionId, message, greeting? }
//
// Backs the Support Chat widget (app/w/[widgetId]/widgets/
// SupportChatWidget.tsx). Same siteId -> owner resolution as
// /api/widget and /api/feedback (never trusts the caller's claim
// without checking siteIndex), then:
//   1. best-effort reads the site's FAQ Page widget doc
//      (users/{uid}/sites/{siteId}/widgets/faq-page) for business-
//      specific Q&A content to ground the reply in — see
//      lib/aiReply.ts's header comment. Skipped silently if the
//      widget isn't enabled or was never filled in past the generic
//      DEFAULT_FAQS placeholders.
//   2. appends the visitor's message to
//      users/{uid}/sites/{siteId}/chats/{sessionId}/messages
//   3. asks lib/aiReply.ts for a reply (Groq, falling back to Gemini,
//      falling back to a canned line — see that file), passing the
//      FAQ content along if step 1 found any
//   4. appends the assistant's reply to the same thread
//   5. returns the reply text to the widget
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
import { assertWidgetWriteAllowed, WidgetWriteBlockedError } from '@/lib/serverAuth';
import { faqsFromConfig, DEFAULT_FAQS } from '@/lib/widgets';

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

    // Business grounding: if this site has an enabled FAQ Page widget
    // with real content (not just the generic DEFAULT_FAQS
    // placeholders), hand its Q&A pairs to the model so Support Chat
    // can answer from the same business-specific content the FAQ
    // widget itself shows \u2014 see lib/aiReply.ts's header comment. A
    // best-effort read: any failure here (widget never configured,
    // Firestore hiccup) just means no FAQ context, not a broken chat.
    let faqs: { q: string; a: string }[] | undefined;
    try {
      const faqWidgetSnap = await siteRef.collection('widgets').doc('faq-page').get();
      if (faqWidgetSnap.exists) {
        const data = faqWidgetSnap.data();
        if (data?.enabled) {
          const resolved = faqsFromConfig((data.config as Record<string, unknown>) || {});
          const isJustDefaults =
            resolved.length === DEFAULT_FAQS.length &&
            resolved.every((f, i) => f.q === DEFAULT_FAQS[i].q && f.a === DEFAULT_FAQS[i].a);
          if (!isJustDefaults) faqs = resolved;
        }
      }
    } catch (err) {
      console.error('[chat] faq widget read error', err);
    }

    // Business grounding, part 2: the Support Chat widget's own
    // `siteContext` config field \u2014 free text the owner wrote
    // describing what THIS site/business is (shop, blog, agency,
    // etc), see lib/widgets.ts's 'support-chat' catalog entry. This is
    // what lets the same widget code answer accurately across sites
    // that are nothing alike, rather than one generic prompt for
    // every install. Read straight off this widget's own doc (not the
    // FAQ widget's), independent of whether a FAQ widget exists at
    // all \u2014 a site can have siteContext with no FAQ widget, a FAQ
    // widget with no siteContext yet, both, or neither. Best-effort,
    // same reasoning as the FAQ read above: any failure just means no
    // extra context, never a broken chat.
    let siteContext: string | undefined;
    try {
      const supportChatSnap = await siteRef.collection('widgets').doc('support-chat').get();
      if (supportChatSnap.exists) {
        const data = supportChatSnap.data();
        const raw = (data?.config as Record<string, unknown> | undefined)?.siteContext;
        if (typeof raw === 'string' && raw.trim()) siteContext = raw.trim();
      }
    } catch (err) {
      console.error('[chat] support-chat widget read error', err);
    }

    // Hard-paused like the other real-write routes: an AI chat reply
    // costs a real model call, so once the owning account hits its
    // daily cap, stop here with the same paused messaging the widget
    // shows for any other blocked feature, rather than keep spending
    // on calls the owner can't see in their dashboard until they
    // upgrade or the UTC-midnight reset.
    //
    // count: 2 (not the default 1) — a chat turn that actually reaches
    // this point is about to trigger a real AI model call in
    // getAiReply below, which costs noticeably more than the
    // one-Firestore-write visitor actions every other widget route
    // charges 1 for (a page view, an overlay impression, a captured
    // email). Charging double here up front, atomically, before the
    // model call happens, means: (a) the spend is reserved before we
    // incur it, so a burst of concurrent requests can't all slip under
    // the cap and then each make a real paid model call anyway, and
    // (b) the owner's daily usage number reflects the actual cost
    // shape of their traffic — a chat question is worth two of
    // whatever a page view is worth, because answering it is.
    try {
      await assertWidgetWriteAllowed(db, siteId, 2);
    } catch (err) {
      if (err instanceof WidgetWriteBlockedError) {
        return fallbackReply('This chat has reached its daily limit \u2014 the site owner can upgrade or it resets at UTC midnight.');
      }
      throw err;
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
    const { reply, provider } = await getAiReply(
      [...history, { role: 'user', content: trimmed }],
      greetingText,
      faqs,
      siteContext
    );

    await threadRef.add({ role: 'assistant', text: reply, provider, ts: FieldValue.serverTimestamp() });

    return NextResponse.json({ ok: true, reply, provider }, { status: 200, headers: CORS_HEADERS });
  } catch (err) {
    console.error('[chat] handler error', err);
    return fallbackReply('Thanks for your message \u2014 we\u2019ll get back to you.');
  }
}
