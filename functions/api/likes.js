// GET  /api/likes?slug=…&v=…   how many readers liked a piece, and whether this reader did
// POST /api/likes              { slug, target: 'piece' | <comment id>, v }  like or unlike
import { ensureSchema, json, missingSetup, siteInfo, hashIp, SLUG_RE, visitorId } from '../../shared/discussion.js';

async function count(db, target, visitor) {
  const row = await db
    .prepare('SELECT COUNT(*) AS n, MAX(CASE WHEN visitor = ?2 THEN 1 ELSE 0 END) AS mine FROM likes WHERE target = ?1')
    .bind(target, visitor)
    .first();
  return { count: row?.n || 0, liked: !!row?.mine };
}

export async function onRequestGet({ request, env }) {
  const problem = missingSetup(env);
  if (problem) return json({ error: problem }, 503);
  const url = new URL(request.url);
  const slug = url.searchParams.get('slug') || '';
  if (!SLUG_RE.test(slug)) return json({ error: 'Unknown piece.' }, 400);
  await ensureSchema(env.DB);
  const visitor = visitorId(url.searchParams.get('v'), await hashIp(request, env));
  return json(await count(env.DB, `p:${slug}`, visitor));
}

export async function onRequestPost({ request, env }) {
  const problem = missingSetup(env);
  if (problem) return json({ error: problem }, 503);
  let input;
  try { input = await request.json(); } catch { return json({ error: 'Send JSON.' }, 400); }

  const slug = String(input.slug || '');
  if (!SLUG_RE.test(slug)) return json({ error: 'Unknown piece.' }, 400);
  const site = await siteInfo(env, request);
  if (site.works && !site.works[slug]) return json({ error: 'Unknown piece.' }, 400);

  await ensureSchema(env.DB);
  let target;
  if (input.target === 'piece') {
    target = `p:${slug}`;
  } else if (Number.isInteger(input.target)) {
    const c = await env.DB.prepare("SELECT id FROM comments WHERE id = ?1 AND slug = ?2 AND status = 'published'").bind(input.target, slug).first();
    if (!c) return json({ error: 'That comment no longer exists.' }, 400);
    target = `c:${c.id}`;
  } else {
    return json({ error: 'Nothing to like.' }, 400);
  }

  const ipHash = await hashIp(request, env);
  const visitor = visitorId(input.v, ipHash);

  // Keep scripts from inflating counts: at most 60 likes per network address per 10 minutes.
  const recent = await env.DB
    .prepare(`SELECT COUNT(*) AS n FROM likes WHERE ip_hash = ?1 AND created_at > strftime('%Y-%m-%dT%H:%M:%SZ','now','-10 minutes')`)
    .bind(ipHash)
    .first();

  const existing = await env.DB.prepare('SELECT 1 AS x FROM likes WHERE target = ?1 AND visitor = ?2').bind(target, visitor).first();
  if (existing) {
    await env.DB.prepare('DELETE FROM likes WHERE target = ?1 AND visitor = ?2').bind(target, visitor).run();
  } else {
    if (recent && recent.n >= 60) return json({ error: 'Too many likes.' }, 429);
    await env.DB.prepare('INSERT OR IGNORE INTO likes (target, slug, visitor, ip_hash) VALUES (?1, ?2, ?3, ?4)').bind(target, slug, visitor, ipHash).run();
  }
  return json(await count(env.DB, target, visitor));
}
