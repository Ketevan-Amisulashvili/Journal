// POST /api/view  { slug, v }  counts a reader opening a piece.
// Each browser counts once per piece per day, so refreshing doesn't inflate the number.
import { ensureSchema, json, missingSetup, siteInfo, hashIp, SLUG_RE, visitorId } from '../../shared/discussion.js';

export async function onRequestPost({ request, env }) {
  const problem = missingSetup(env);
  if (problem) return json({ ok: false }, 503);
  let input;
  try { input = await request.json(); } catch { return json({ ok: false }, 400); }
  const slug = String(input.slug || '');
  if (!SLUG_RE.test(slug)) return json({ ok: false }, 400);
  const site = await siteInfo(env, request);
  if (site.works && !site.works[slug]) return json({ ok: false }, 400);

  await ensureSchema(env.DB);
  const visitor = visitorId(input.v, await hashIp(request, env));
  const day = new Date().toISOString().slice(0, 10);
  const lang = input.lang === 'en' ? 'en' : 'ka';

  const seen = await env.DB
    .prepare('INSERT OR IGNORE INTO view_seen (slug, visitor, day) VALUES (?1, ?2, ?3)')
    .bind(slug, visitor, day).run();
  if (seen.meta?.changes) {
    await env.DB
      .prepare(`INSERT INTO views (slug, day, n, n_en) VALUES (?1, ?2, 1, ?3)
                ON CONFLICT (slug, day) DO UPDATE SET n = n + 1, n_en = n_en + ?3`)
      .bind(slug, day, lang === 'en' ? 1 : 0).run();
  }
  // Now and then, forget who visited on earlier days (only the daily totals are kept).
  if (Math.random() < 0.02) {
    await env.DB.prepare("DELETE FROM view_seen WHERE day < date('now', '-1 day')").run();
  }
  return json({ ok: true });
}
