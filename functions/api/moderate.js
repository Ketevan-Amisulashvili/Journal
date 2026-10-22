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
    .prepare(`SELECT c.id, c.slug, c.parent_id, c.name, c.body, c.lang, c.status, c.is_author, c.created_at,
                (SELECT COUNT(*) FROM likes l WHERE l.target = 'c:' || c.id) AS likes
              FROM comments c
              ORDER BY CASE c.status WHEN 'pending' THEN 0 ELSE 1 END, c.created_at DESC, c.id DESC LIMIT 300`)
    .all();
  const pieces = await env.DB
    .prepare("SELECT slug, COUNT(*) AS likes FROM likes WHERE target LIKE 'p:%' GROUP BY slug ORDER BY likes DESC")
    .all();
  const stats = await env.DB
    .prepare(`SELECT slug,
                SUM(n) AS views,
                SUM(n_en) AS views_en,
                SUM(CASE WHEN day >= date('now', '-6 days') THEN n ELSE 0 END) AS week,
                SUM(CASE WHEN day = date('now') THEN n ELSE 0 END) AS today
              FROM views GROUP BY slug`)
    .all();
  const counts = await env.DB
    .prepare("SELECT slug, COUNT(*) AS comments FROM comments WHERE status = 'published' GROUP BY slug")
    .all();
  return json({ comments: results || [], pieceLikes: pieces.results || [], views: stats.results || [], commentCounts: counts.results || [] });
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
      await env.DB.prepare("DELETE FROM likes WHERE target IN (SELECT 'c:' || id FROM comments WHERE id = ?1 OR parent_id = ?1)").bind(id).run();
      await env.DB.prepare('DELETE FROM translations WHERE comment_id IN (SELECT id FROM comments WHERE id = ?1 OR parent_id = ?1)').bind(id).run();
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
