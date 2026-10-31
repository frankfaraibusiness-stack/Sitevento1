// lib/aiReply.ts
//
// Generates the Support Chat widget's AI reply. Tries Groq first (fast,
// generous free tier), falls back to Gemini if Groq fails or its key
// isn't set, and falls back to a canned reply if neither is configured
// or both fail — the widget must never show a raw error to a visitor.
//
// Business grounding, two layers:
//
//   1. siteContext — free text the owner types straight into the
//      Support Chat widget's own config ("What is your site about?",
//      see lib/widgets.ts's 'support-chat' catalog entry), describing
//      what the site/business actually IS: a shop, a blog, an agency,
//      a SaaS product, whatever. This is the one field every site
//      using this widget is expected to fill in, since without it the
//      model has no idea whether it's answering for a candle shop or
//      a law firm. app/api/chat/route.ts reads it straight off the
//      support-chat widget doc and passes it in as `siteContext`
//      below.
//   2. faqs — if the site ALSO has an enabled FAQ Page widget,
//      app/api/chat/route.ts reads its Q&A pairs (lib/widgets.ts's
//      faqsFromConfig — the same data the FAQ widget itself renders)
//      and passes them in as `faqs`, for specific pre-written answers
//      to ground against. Optional on top of siteContext, not a
//      replacement for it.
//
// buildSystemPrompt folds both into the system prompt (siteContext
// first, as the general "here's what this business is" framing, then
// the FAQ pairs as specific ground-truth answers) before falling back
// to "I don't know" — so the chat widget actually knows what kind of
// site it's on, and what the FAQ widget knows too, rather than one
// generic prompt for every install. Either, both, or neither being
// present is fine — an owner who hasn't filled in siteContext yet (or
// whose FAQ widget is off / still just DEFAULT_FAQS) falls back to
// the previous, no-business-context behavior exactly as before.
//
// Server-only: imports here never run in the browser (only from
// app/api/chat/route.ts), and neither API key is ever sent to the
// client — the widget iframe only ever talks to this app's own /api/chat.
//
// Models: picks favor free, high-quota tiers over the providers'
// flagship paid-tier models, per the deployment's own choice of
// GROQ_API_KEY / GEMINI_API_KEY as free-tier credentials. Verified
// live and current as of October 2026:
//   - Groq (1st try): llama-3.1-8b-instant — 30 req/min, 14,400 req/day,
//             6,000 tokens/min, 500K tokens/day on the free tier.
//   - Groq (2nd try): gemma2-9b-it — a separate model on the same Groq
//             account, so it has its own independent free-tier quota
//             (30 req/min, 14,400 req/day, 15,000 tokens/min) rather
//             than sharing llama-3.1-8b-instant's — this is a second
//             real attempt, not just a formality, if the first model
//             is rate-limited.
//   - Gemini (3rd try, fallback): gemma-4-26b-a4b-it — Google's hosted
//             Gemma model served through the *Gemini API* itself (same
//             generativelanguage.googleapis.com endpoint, same
//             GEMINI_API_KEY — Gemma and Gemini are different model
//             families, but Google exposes this Gemma checkpoint
//             through the Gemini API rather than a separate product).
//             Swapped in for gemini-2.5-flash-lite on request. Note:
//             Gemma-on-Gemini-API free-tier quotas are lower than
//             Gemini Flash-Lite's — if this fallback is being hit
//             often (i.e. Groq is failing a lot), this swap trades
//             reply quality/availability for whatever the actual
//             reason for the swap was. gemini-1.5-flash (the model
//             this originally called, before flash-lite) was retired
//             by Google in 2026 and returned a model-not-found error
//             on every call, so it was silently never providing a
//             real fallback reply — keep that failure mode in mind if
//             this one starts doing the same.
// If a provider changes its lineup again, swap the model string in
// that provider's function only — nothing else in this file or its
// caller needs to change.

export interface ChatTurn {
  role: 'user' | 'assistant';
  content: string;
}

export interface AiReplyResult {
  reply: string;
  provider: 'groq' | 'gemini' | 'fallback';
}

// Same shape as lib/widgets.ts's FaqItem, duplicated locally (instead
// of imported) so this file keeps zero dependency on widget-catalog
// internals \u2014 the caller (app/api/chat/route.ts) already imports
// FaqItem/faqsFromConfig from lib/widgets.ts and just hands plain
// {q,a} objects across.
export interface FaqContextItem {
  q: string;
  a: string;
}

const BASE_SYSTEM_PROMPT =
  'You are a friendly, concise support assistant embedded on a small business\u2019s website. ' +
  'Answer the visitor\u2019s question helpfully in 2-4 sentences. If you don\u2019t know something ' +
  'specific to this business (pricing, order status, policies), say so plainly and suggest ' +
  'they leave their email or wait for a human reply, rather than guessing.';

// Caps how much FAQ content rides along on every single chat turn \u2014
// the FAQ widget has no hard size limit of its own, and an owner could
// in principle fill in dozens of entries. 20 pairs is generous for a
// small-business FAQ page and keeps this well under the providers'
// token budgets (max_tokens here is just the reply cap, not the input).
const MAX_FAQS_IN_PROMPT = 20;
const MAX_FAQ_CHARS = 2000;

// Same spirit of cap as MAX_FAQ_CHARS above, for the owner's free-text
// siteContext field (lib/widgets.ts caps the form input itself at
// 1000 chars already \u2014 this is just defense in depth against whatever
// ends up actually stored).
const MAX_SITE_CONTEXT_CHARS = 1200;

function buildSystemPrompt(greeting: string, siteContext?: string, faqs?: FaqContextItem[]): string {
  let prompt = `${BASE_SYSTEM_PROMPT} The site\u2019s configured greeting is: "${greeting}"`;
  if (siteContext && siteContext.trim()) {
    prompt +=
      '\n\nHere is what the site owner says this site/business is about \u2014 use this to understand the ' +
      'context you are answering in (e.g. whether this is a shop, a blog, a service business, a SaaS ' +
      'product, etc) and keep every answer relevant and accurate to it:\n\n' +
      siteContext.trim().slice(0, MAX_SITE_CONTEXT_CHARS);
  }
  if (faqs && faqs.length > 0) {
    const block = faqs
      .slice(0, MAX_FAQS_IN_PROMPT)
      .map((f) => `Q: ${f.q}\nA: ${f.a}`)
      .join('\n\n')
      .slice(0, MAX_FAQ_CHARS);
    prompt +=
      '\n\nHere is this business\u2019s own FAQ content \u2014 the same answers it publishes on its FAQ widget. ' +
      'Treat these as ground truth about THIS business and answer from them whenever the visitor\u2019s question ' +
      'matches or is close to one of these, in your own words rather than quoting verbatim. Only fall back to ' +
      'saying you don\u2019t know (per your instructions above) for things not covered here:\n\n' +
      block;
  }
  return prompt;
}

async function tryGroqModel(
  model: string,
  history: ChatTurn[],
  greeting: string,
  siteContext?: string,
  faqs?: FaqContextItem[]
): Promise<string | null> {
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
        model,
        messages: [
          { role: 'system', content: buildSystemPrompt(greeting, siteContext, faqs) },
          ...history.map((t) => ({ role: t.role, content: t.content })),
        ],
        max_tokens: 300,
        temperature: 0.6,
      }),
      signal: AbortSignal.timeout(8000),
    });
    if (!res.ok) {
      console.error(`[aiReply] Groq (${model}) non-OK`, res.status, await res.text().catch(() => ''));
      return null;
    }
    const data = await res.json();
    const text = data?.choices?.[0]?.message?.content;
    return typeof text === 'string' && text.trim() ? text.trim() : null;
  } catch (err) {
    console.error(`[aiReply] Groq (${model}) error`, err);
    return null;
  }
}

function tryGroqLlama(
  history: ChatTurn[],
  greeting: string,
  siteContext?: string,
  faqs?: FaqContextItem[]
): Promise<string | null> {
  return tryGroqModel('llama-3.1-8b-instant', history, greeting, siteContext, faqs);
}

// Second, independent attempt on Groq before falling through to Gemini:
// gemma2-9b-it is a different model on the same account, so it draws
// from its own free-tier quota rather than sharing llama-3.1-8b-instant's
// — if the first model is rate-limited, this one usually isn't.
function tryGroqGemma(
  history: ChatTurn[],
  greeting: string,
  siteContext?: string,
  faqs?: FaqContextItem[]
): Promise<string | null> {
  return tryGroqModel('gemma2-9b-it', history, greeting, siteContext, faqs);
}

async function tryGemini(
  history: ChatTurn[],
  greeting: string,
  siteContext?: string,
  faqs?: FaqContextItem[]
): Promise<string | null> {
  const key = process.env.GEMINI_API_KEY;
  if (!key) return null;
  try {
    const res = await fetch(
      `https://generativelanguage.googleapis.com/v1beta/models/gemma-4-26b-a4b-it:generateContent?key=${key}`,
      {
        method: 'POST',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify({
          systemInstruction: {
            parts: [{ text: buildSystemPrompt(greeting, siteContext, faqs) }],
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
      console.error('[aiReply] Gemma (via Gemini API) non-OK', res.status, await res.text().catch(() => ''));
      return null;
    }
    const data = await res.json();
    const text = data?.candidates?.[0]?.content?.parts?.[0]?.text;
    return typeof text === 'string' && text.trim() ? text.trim() : null;
  } catch (err) {
    console.error('[aiReply] Gemma (via Gemini API) error', err);
    return null;
  }
}

export async function getAiReply(
  history: ChatTurn[],
  greeting: string,
  faqs?: FaqContextItem[],
  siteContext?: string
): Promise<AiReplyResult> {
  const llama = await tryGroqLlama(history, greeting, siteContext, faqs);
  if (llama) return { reply: llama, provider: 'groq' };

  // Separate model, separate quota — worth a real second try on Groq
  // before spending the Gemini fallback.
  const gemma = await tryGroqGemma(history, greeting, siteContext, faqs);
  if (gemma) return { reply: gemma, provider: 'groq' };

  const gemini = await tryGemini(history, greeting, siteContext, faqs);
  if (gemini) return { reply: gemini, provider: 'gemini' };

  return {
    reply: "Thanks for your message! We don't have an automated answer for that right now, but we'll follow up as soon as we can.",
    provider: 'fallback',
  };
}
