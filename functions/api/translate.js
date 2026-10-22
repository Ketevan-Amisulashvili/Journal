// POST /api/translate  { id }  Georgian comment -> English, English comment -> Georgian.
// Uses Cloudflare Workers AI (free daily allowance) through a binding named "AI".
// Each translation is made once and saved, so later readers get it instantly and for free.
import { ensureSchema, json, missingSetup, hashIp } from '../../shared/discussion.js';

const MODELS = ['@cf/google/gemma-4-26b-a4b-it', '@cf/openai/gpt-oss-120b'];
const PER_VISITOR_10_MIN = 20; // new translations one reader can request
const PER_DAY = 400;           // new translations per day, keeps well inside the free allowance

// Which language the comment is written in, judged by its letters.
export function detectLang(text) {
  const ka = (text.match(/[Ⴀ-ჿᲐ-Ჿ]/g) || []).length;
  const latin = (text.match(/[A-Za-z]/g) || []).length;
  return ka >= latin ? 'ka' : 'en';
}

const SYSTEM = {
  en: `You are a professional literary translator from Georgian into English.
Translate the reader's comment into natural, grammatically correct English that keeps its meaning, tone and register.
Rules:
- Output only the translation, with no preface, notes, quotation marks or explanations.
- Keep paragraph and line breaks exactly where they are.
- Keep people's names, book titles and quotations recognisable; use the established English titles of well-known works when they exist.
- Keep URLs, numbers and emoji unchanged.
- If part of the text is already in English, leave that part as it is.`,
  ka: `You are a professional literary translator from English into Georgian.
Translate the reader's comment into natural, grammatically correct literary Georgian (სალიტერატურო ქართული), with correct case endings, verb agreement and punctuation, keeping its meaning, tone and register.
Rules:
- Output only the translation, with no preface, notes, quotation marks or explanations.
- Keep paragraph and line breaks exactly where they are.
- Write names in Georgian script where an established Georgian form exists; use the established Georgian titles of well-known works when they exist.
- Keep URLs, numbers and emoji unchanged.
- If part of the text is already in Georgian, leave that part as it is.`,
};

function extractText(out) {
  if (!out) return '';
  if (typeof out === 'string') return out;
  let t = out.choices?.[0]?.message?.content ?? out.response ?? out.output_text ?? '';
  if (!t && Array.isArray(out.output)) {
    for (const item of out.output) {
      for (const c of item?.content || []) if (c?.type === 'output_text' && c.text) t += c.text;
    }
  }
  if (Array.isArray(t)) t = t.map((p) => p?.text || '').join('');
  t = String(t || '');
  // Drop any visible "thinking" a model may include.
  t = t.replace(/<think>[\s\S]*?<\/think>/gi, '').replace(/^[\s\S]*<\/think>/i, '');
  return t.trim().replace(/^["“„]([\s\S]*)["”“]$/, '$1').trim();
}

async function translate(ai, text, to) {
  let lastError = null;
  for (const model of MODELS) {
    try {
      const out = await ai.run(model, {
        messages: [
          { role: 'system', content: SYSTEM[to] },
          { role: 'user', content: text },
        ],
        temperature: 0.2,
        max_completion_tokens: Math.min(4000, 400 + text.length * 3),
      });
      const t = extractText(out);
      if (t) return { text: t, model };
    } catch (e) {
      lastError = e;
    }
  }
  throw lastError || new Error('No translation returned');
}

export async function onRequestPost({ request, env }) {
  const problem = missingSetup(env);
  if (problem) return json({ error: problem }, 503);
  if (!env.AI) return json({ error: 'Translation is not switched on. Add a Workers AI binding named AI in the Cloudflare Pages settings.', code: 'no-ai' }, 503);

  let input;
  try { input = await request.json(); } catch { return json({ error: 'Send JSON.' }, 400); }
  const id = Number.isInteger(input.id) ? input.id : null;
  if (!id) return json({ error: 'Missing comment.' }, 400);

  await ensureSchema(env.DB);
  const c = await env.DB.prepare("SELECT id, body FROM comments WHERE id = ?1 AND status = 'published'").bind(id).first();
  if (!c) return json({ error: 'That comment no longer exists.' }, 404);

  const from = detectLang(c.body);
  const to = from === 'ka' ? 'en' : 'ka';

  const saved = await env.DB.prepare('SELECT text FROM translations WHERE comment_id = ?1 AND lang = ?2').bind(id, to).first();
  if (saved) return json({ id, from, to, text: saved.text });

  const ipHash = await hashIp(request, env);
  const mine = await env.DB
    .prepare(`SELECT COUNT(*) AS n FROM translations WHERE ip_hash = ?1 AND created_at > strftime('%Y-%m-%dT%H:%M:%SZ','now','-10 minutes')`)
    .bind(ipHash).first();
  if (mine && mine.n >= PER_VISITOR_10_MIN) return json({ error: 'Too many translations.' }, 429);
  const today = await env.DB
    .prepare(`SELECT COUNT(*) AS n FROM translations WHERE created_at >= strftime('%Y-%m-%dT00:00:00Z','now')`)
    .first();
  if (today && today.n >= PER_DAY) return json({ error: 'Daily translation limit reached.', code: 'daily' }, 429);

  let result;
  try {
    result = await translate(env.AI, c.body, to);
  } catch (e) {
    return json({ error: 'The translation service did not answer. Try again later.' }, 502);
  }
  await env.DB
    .prepare('INSERT OR REPLACE INTO translations (comment_id, lang, text, model, ip_hash) VALUES (?1, ?2, ?3, ?4, ?5)')
    .bind(id, to, result.text.slice(0, 12000), result.model, ipHash).run();
  return json({ id, from, to, text: result.text });
}
