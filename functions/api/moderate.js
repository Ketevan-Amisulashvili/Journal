// Moderation API, used by the /moderate/ page. Requires the ADMIN_PASSWORD.
// GET  /api/moderate            recent comments (all statuses)
// POST /api/moderate            { action: 'delete' | 'approve' | 'hide' | 'reply', ... }
import { ensureSchema, json, missingSetup, isModerator, cleanText, SLUG_RE } from '../../shared/discussion.js';

function guard(request, env) {
  const problem = missingSetup(env);
  if (problem) return json({ error: problem }, 503);
  if (!env.ADMIN_PASSWORD || env.ADMIN_PASSWORD.length < 8) {
    return json({ error: 'Set an ADMIN_PASSWORD of at least 8 characters in the Cloudflare Pages settings, then redeploy.' }, 503);
  }
  if (!isModerator(request, env)) return json({ error: 'Wrong password.' }, 401);
  return null;
}

export async function onRequestGet({ request, env }) {
  const denied = guard(request, env);
  if (denied) return denied;
  await ensureSchema(env.DB);
  const { results } = await env.DB
    .prepare(`SELECT id, slug, parent_id, name, body, lang, status, is_author, created_at FROM comments
              ORDER BY CASE status WHEN 'pending' THEN 0 ELSE 1 END, created_at DESC, id DESC LIMIT 300`)
    .all();
  return json({ comments: results || [] });
}

export async function onRequestPost({ request, env }) {
  const denied = guard(request, env);
  if (denied) return denied;
  await ensureSchema(env.DB);

  let input;
  try { input = await request.json(); } catch { return json({ error: 'Send JSON.' }, 400); }
  const id = Number.isInteger(input.id) ? input.id : null;

  switch (input.action) {
    case 'delete': {
      if (!id) return json({ error: 'Missing id.' }, 400);
      // Removing a comment also removes the replies under it.
      await env.DB.prepare('DELETE FROM comments WHERE id = ?1 OR parent_id = ?1').bind(id).run();
      return json({ ok: true });
    }
    case 'approve':
    case 'hide': {
      if (!id) return json({ error: 'Missing id.' }, 400);
      const status = input.action === 'approve' ? 'published' : 'pending';
      await env.DB.prepare('UPDATE comments SET status = ?1 WHERE id = ?2').bind(status, id).run();
      return json({ ok: true, status });
    }
    case 'reply': {
      const slug = String(input.slug || '');
      const name = cleanText(input.name, 60);
      const body = cleanText(input.body, 5000);
      if (!SLUG_RE.test(slug) || !name || body.length < 2) return json({ error: 'Write a reply first.' }, 400);
      let parent = null;
      if (id) {
        const p = await env.DB.prepare('SELECT id, parent_id FROM comments WHERE id = ?1').bind(id).first();
        if (p) parent = p.parent_id || p.id;
      }
      const lang = input.lang === 'en' ? 'en' : 'ka';
      const res = await env.DB
        .prepare("INSERT INTO comments (slug, parent_id, name, body, lang, status, is_author) VALUES (?1, ?2, ?3, ?4, ?5, 'published', 1)")
        .bind(slug, parent, name, body, lang)
        .run();
      return json({ ok: true, id: res.meta?.last_row_id ?? null });
    }
    default:
      return json({ error: 'Unknown action.' }, 400);
  }
}
