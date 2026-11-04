// lib/generateFaqs.ts
//
// Generates FAQ question/answer pairs for the FAQ Page widget's
// designer (POST /api/generate-faq -> components/widgets/designer/
// FaqListField.tsx's "Generate with AI" control). Same two-provider
// chain as lib/aiReply.ts (Groq first, Gemini fallback, same free-tier
// model choices, same reasoning for both — see that file's header
// comment) but asking for one-shot structured JSON instead of a
// conversational reply, so this is its own small module rather than
// bent into aiReply.ts's ChatTurn-shaped API.
//
// Server-only: imports here only ever run from app/api/generate-faq/
// route.ts, never in the browser, so neither API key reaches the
// client.
import type { FaqItem } from './widgets';

export interface GenerateFaqsInput {
  businessDescription: string;
  // Optional context pulled from the site's own <head> by
  // app/api/site-metadata, passed through so the model can ground
  // questions in the business's actual name/tagline instead of
  // inventing a generic one.
  siteTitle?: string;
  siteDescription?: string;
  count: number;
}

export interface GenerateFaqsResult {
  faqs: FaqItem[];
  provider: 'groq' | 'gemini' | 'none';
}

function buildPrompt(input: GenerateFaqsInput): string {
  const parts: string[] = [];
  if (input.siteTitle) parts.push(`Site title: ${input.siteTitle}`);
  if (input.siteDescription) parts.push(`Site meta description: ${input.siteDescription}`);
  parts.push(`Business description (from the owner): ${input.businessDescription}`);
  return parts.join('\n');
}

const SYSTEM_PROMPT = (count: number) =>
  'You write FAQ sections for small business websites. Given context about a specific business, generate ' +
  `exactly ${count} realistic, specific frequently-asked-questions a real visitor to THIS business\u2019s website ` +
  'would actually ask \u2014 covering things like what they offer, pricing/cost expectations, how to book or buy, ' +
  'hours or turnaround time, service area, and policies, chosen to fit what the business actually does. Avoid ' +
  'generic filler questions that could apply to any company. Write answers in a warm, concise, confident tone, ' +
  '1-3 sentences each, as the business itself would answer \u2014 it is fine to use plausible placeholder specifics ' +
  '(e.g. typical hours, a typical response time) when the input doesn\u2019t give exact ones, since the owner will ' +
  'review and edit everything before it goes live. ' +
  'Respond with ONLY a raw JSON array, no markdown fences, no commentary, in this exact shape: ' +
  '[{"q":"...","a":"..."},...]';

function parseFaqJson(text: string, count: number): FaqItem[] | null {
  // Models occasionally wrap JSON in ```json fences despite instructions
  // not to; strip those defensively before parsing.
  const cleaned = text.replace(/^```(?:json)?\s*/i, '').replace(/```\s*$/i, '').trim();
  let parsed: unknown;
  try {
    parsed = JSON.parse(cleaned);
  } catch {
    // Try to salvage a JSON array embedded in extra prose.
    const match = cleaned.match(/\[[\s\S]*\]/);
    if (!match) return null;
    try {
      parsed = JSON.parse(match[0]);
    } catch {
      return null;
    }
  }
  if (!Array.isArray(parsed)) return null;
  const items: FaqItem[] = parsed
    .filter((it): it is { q: unknown; a: unknown } => it && typeof it === 'object')
    .map((it) => ({ q: String((it as any).q || '').trim(), a: String((it as any).a || '').trim() }))
    .filter((it) => it.q && it.a)
    .slice(0, count);
  return items.length > 0 ? items : null;
}

async function tryGroqModel(model: string, input: GenerateFaqsInput): Promise<FaqItem[] | null> {
  const key = process.env.GROQ_API_KEY;
  if (!key) return null;
  try {
    const res = await fetch('https://api.groq.com/openai/v1/chat/completions', {
      method: 'POST',
      headers: { 'Content-Type': 'application/json', Authorization: `Bearer ${key}` },
      body: JSON.stringify({
        model,
        messages: [
          { role: 'system', content: SYSTEM_PROMPT(input.count) },
          { role: 'user', content: buildPrompt(input) },
        ],
        max_tokens: 1200,
        temperature: 0.7,
      }),
      signal: AbortSignal.timeout(12000),
    });
    if (!res.ok) {
      console.error(`[generateFaqs] Groq (${model}) non-OK`, res.status, await res.text().catch(() => ''));
      return null;
    }
    const data = await res.json();
    const text = data?.choices?.[0]?.message?.content;
    return typeof text === 'string' ? parseFaqJson(text, input.count) : null;
  } catch (err) {
    console.error(`[generateFaqs] Groq (${model}) error`, err);
    return null;
  }
}

async function tryGemini(input: GenerateFaqsInput): Promise<FaqItem[] | null> {
  const key = process.env.GEMINI_API_KEY;
  if (!key) return null;
  try {
    const res = await fetch(
      `https://generativelanguage.googleapis.com/v1beta/models/gemini-2.5-flash-lite:generateContent?key=${key}`,
      {
        method: 'POST',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify({
          systemInstruction: { parts: [{ text: SYSTEM_PROMPT(input.count) }] },
          contents: [{ role: 'user', parts: [{ text: buildPrompt(input) }] }],
          generationConfig: { maxOutputTokens: 1200, temperature: 0.7 },
        }),
        signal: AbortSignal.timeout(12000),
      }
    );
    if (!res.ok) {
      console.error('[generateFaqs] Gemini non-OK', res.status, await res.text().catch(() => ''));
      return null;
    }
    const data = await res.json();
    const text = data?.candidates?.[0]?.content?.parts?.[0]?.text;
    return typeof text === 'string' ? parseFaqJson(text, input.count) : null;
  } catch (err) {
    console.error('[generateFaqs] Gemini error', err);
    return null;
  }
}

export async function generateFaqs(input: GenerateFaqsInput): Promise<GenerateFaqsResult> {
  const llama = await tryGroqModel('llama-3.1-8b-instant', input);
  if (llama) return { faqs: llama, provider: 'groq' };

  const gemma = await tryGroqModel('gemma2-9b-it', input);
  if (gemma) return { faqs: gemma, provider: 'groq' };

  const gemini = await tryGemini(input);
  if (gemini) return { faqs: gemini, provider: 'gemini' };

  return { faqs: [], provider: 'none' };
}
