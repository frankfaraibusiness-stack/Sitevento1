// lib/aiReply.ts
//
// Generates the Support Chat widget's AI reply. Tries Groq first (fast,
// generous free tier), falls back to Gemini if Groq fails or its key
// isn't set, and falls back to a canned reply if neither is configured
// or both fail — the widget must never show a raw error to a visitor.
//
// Server-only: imports here never run in the browser (only from
// app/api/chat/route.ts), and neither API key is ever sent to the
// client — the widget iframe only ever talks to this app's own /api/chat.
//
// Models: both picks favor free, high-quota tiers over the providers'
// flagship paid-tier models, per the deployment's own choice of
// GROQ_API_KEY / GEMINI_API_KEY as free-tier credentials:
//   - Groq:   llama-3.1-8b-instant — Groq's fastest/highest-limit free
//             model (vs. e.g. llama-3.1-70b, which has a much lower
//             free-tier rate limit).
//   - Gemini: gemini-1.5-flash — Google's free-tier model with the
//             highest request quota (vs. gemini-1.5-pro's much lower
//             free quota).
// If either provider changes its lineup, swap the model string in that
// provider's function only — nothing else in this file or its caller
// needs to change.

export interface ChatTurn {
  role: 'user' | 'assistant';
  content: string;
}

export interface AiReplyResult {
  reply: string;
  provider: 'groq' | 'gemini' | 'fallback';
}

const SYSTEM_PROMPT =
  'You are a friendly, concise support assistant embedded on a small business\u2019s website. ' +
  'Answer the visitor\u2019s question helpfully in 2-4 sentences. If you don\u2019t know something ' +
  'specific to this business (pricing, order status, policies), say so plainly and suggest ' +
  'they leave their email or wait for a human reply, rather than guessing.';

async function tryGroq(history: ChatTurn[], greeting: string): Promise<string | null> {
  const key = process.env.GROQ_API_KEY;
  if (!key) return null;
  try {
    const res = await fetch('https://api.groq.com/openai/v1/chat/completions', {
      method: 'POST',
      headers: {
        'Content-Type': 'application/json',
        Authorization: `Bearer ${key}`,
      },
      body: JSON.stringify({
        model: 'llama-3.1-8b-instant',
        messages: [
          { role: 'system', content: `${SYSTEM_PROMPT} The site\u2019s configured greeting is: "${greeting}"` },
          ...history.map((t) => ({ role: t.role, content: t.content })),
        ],
        max_tokens: 300,
        temperature: 0.6,
      }),
      signal: AbortSignal.timeout(8000),
    });
    if (!res.ok) {
      console.error('[aiReply] Groq non-OK', res.status, await res.text().catch(() => ''));
      return null;
    }
    const data = await res.json();
    const text = data?.choices?.[0]?.message?.content;
    return typeof text === 'string' && text.trim() ? text.trim() : null;
  } catch (err) {
    console.error('[aiReply] Groq error', err);
    return null;
  }
}

async function tryGemini(history: ChatTurn[], greeting: string): Promise<string | null> {
  const key = process.env.GEMINI_API_KEY;
  if (!key) return null;
  try {
    const res = await fetch(
      `https://generativelanguage.googleapis.com/v1beta/models/gemini-1.5-flash:generateContent?key=${key}`,
      {
        method: 'POST',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify({
          systemInstruction: {
            parts: [{ text: `${SYSTEM_PROMPT} The site\u2019s configured greeting is: "${greeting}"` }],
          },
          contents: history.map((t) => ({
            role: t.role === 'assistant' ? 'model' : 'user',
            parts: [{ text: t.content }],
          })),
          generationConfig: { maxOutputTokens: 300, temperature: 0.6 },
        }),
        signal: AbortSignal.timeout(8000),
      }
    );
    if (!res.ok) {
      console.error('[aiReply] Gemini non-OK', res.status, await res.text().catch(() => ''));
      return null;
    }
    const data = await res.json();
    const text = data?.candidates?.[0]?.content?.parts?.[0]?.text;
    return typeof text === 'string' && text.trim() ? text.trim() : null;
  } catch (err) {
    console.error('[aiReply] Gemini error', err);
    return null;
  }
}

export async function getAiReply(history: ChatTurn[], greeting: string): Promise<AiReplyResult> {
  const groq = await tryGroq(history, greeting);
  if (groq) return { reply: groq, provider: 'groq' };

  const gemini = await tryGemini(history, greeting);
  if (gemini) return { reply: gemini, provider: 'gemini' };

  return {
    reply: "Thanks for your message! We don't have an automated answer for that right now, but we'll follow up as soon as we can.",
    provider: 'fallback',
  };
}
