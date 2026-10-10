// GET  /api/comments?slug=…   published comments for one piece
// POST /api/comments          add a comment or a reply
import { ensureSchema, json, missingSetup, siteInfo, hashIp, cleanText, SLUG_RE, isModerator } from '../../shared/discussion.js';

export async function onRequestGet({ request, env }) {
  const problem = missingSetup(env);
  if (problem) return json({ error: problem }, 503);
  const slug = new URL(request.url).searchParams.get('slug') || '';
  if (!SLUG_RE.test(slug)) return json({ error: 'Unknown piece.' }, 400);
  await ensureSchema(env.DB);
  const { results } = await env.DB
    .prepare(`SELECT id, parent_id, name, body, lang, is_author, created_at FROM comments
              WHERE slug = ?1 AND status = 'published' ORDER BY created_at ASC, id ASC LIMIT 500`)
    .bind(slug)
    .all();
  return json({ comments: results || [] });
}

export async function onRequestPost({ request, env }) {
  const problem = missingSetup(env);
  if (problem) return json({ error: problem }, 503);

  let input;
  try { input = await request.json(); } catch { return json({ error: 'Send JSON.' }, 400); }

  // Spam traps: a hidden field people never fill, and a minimum time on the page.
  if (input.website) return json({ ok: true, status: 'pending' });
  if (typeof input.elapsed === 'number' && input.elapsed < 2500) return json({ ok: true, status: 'pending' });

  const slug = String(input.slug || '');
  const name = cleanText(input.name, 60);
  const body = cleanText(input.body, 5000);
  const lang = input.lang === 'en' ? 'en' : 'ka';
  const parentId = Number.isInteger(input.parent_id) ? input.parent_id : null;

  if (!SLUG_RE.test(slug)) return json({ error: 'Unknown piece.', field: 'generic' }, 400);
  if (!name) return json({ error: 'Name is required.', field: 'name' }, 400);
  if (body.length < 2) return json({ error: 'Comment is too short.', field: 'body' }, 400);
  if ((body.match(/https?:\/\//g) || []).length > 3) return json({ error: 'Too many links.', field: 'body' }, 400);

  const site = await siteInfo(env, request);
  if (site.works && !site.works[slug]) return json({ error: 'Unknown piece.', field: 'generic' }, 400);

  await ensureSchema(env.DB);
  const ipHash = await hashIp(request, env);

  const recent = await env.DB
    .prepare(`SELECT COUNT(*) AS n FROM comments WHERE ip_hash = ?1 AND created_at > strftime('%Y-%m-%dT%H:%M:%SZ','now','-10 minutes')`)
    .bind(ipHash)
    .first();
  if (recent && recent.n >= 5) return json({ error: 'Too many comments.' }, 429);

  // Replies attach to a top-level comment, so threads stay one level deep.
  let parent = null;
  if (parentId) {
    const p = await env.DB.prepare('SELECT id, parent_id FROM comments WHERE id = ?1 AND slug = ?2').bind(parentId, slug).first();
    if (!p) return json({ error: 'That comment no longer exists.', field: 'generic' }, 400);
    parent = p.parent_id || p.id;
  }

  const author = isModerator(request, env);
  const status = site.requireReview && !author ? 'pending' : 'published';
  const res = await env.DB
    .prepare('INSERT INTO comments (slug, parent_id, name, body, lang, status, is_author, ip_hash) VALUES (?1, ?2, ?3, ?4, ?5, ?6, ?7, ?8)')
    .bind(slug, parent, name, body, lang, status, author ? 1 : 0, ipHash)
    .run();

  return json({ ok: true, id: res.meta?.last_row_id ?? null, status }, 201);
}
