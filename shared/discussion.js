// Shared logic for the discussion API (runs on Cloudflare Pages Functions).
// The database is a Cloudflare D1 database bound to the name "DB".

const SCHEMA = [
  `CREATE TABLE IF NOT EXISTS comments (
    id INTEGER PRIMARY KEY AUTOINCREMENT,
    slug TEXT NOT NULL,
    parent_id INTEGER,
    name TEXT NOT NULL,
    body TEXT NOT NULL,
    lang TEXT NOT NULL DEFAULT 'ka',
    status TEXT NOT NULL DEFAULT 'published',
    is_author INTEGER NOT NULL DEFAULT 0,
    ip_hash TEXT,
    created_at TEXT NOT NULL DEFAULT (strftime('%Y-%m-%dT%H:%M:%SZ','now'))
  )`,
  `CREATE INDEX IF NOT EXISTS comments_by_slug ON comments (slug, status, created_at)`,
  `CREATE INDEX IF NOT EXISTS comments_by_ip ON comments (ip_hash, created_at)`,
];

let ready = false;
export async function ensureSchema(db) {
  if (ready) return;
  for (const sql of SCHEMA) await db.prepare(sql).run();
  ready = true;
}

export function json(data, status = 200, extra = {}) {
  return new Response(JSON.stringify(data), {
    status,
    headers: { 'Content-Type': 'application/json; charset=utf-8', 'Cache-Control': 'no-store', ...extra },
  });
}

export function missingSetup(env) {
  if (!env.DB) return 'The discussion database is not connected. Add a D1 binding named DB in the Cloudflare Pages settings.';
  return null;
}

// Reads /data/site.json from the published site: which pieces exist, review setting.
let siteCache = null;
let siteCacheAt = 0;
export async function siteInfo(env, request) {
  if (siteCache && Date.now() - siteCacheAt < 60_000) return siteCache;
  try {
    const url = new URL('/data/site.json', request.url);
    const res = env.ASSETS ? await env.ASSETS.fetch(url) : await fetch(url);
    if (res.ok) {
      siteCache = await res.json();
      siteCacheAt = Date.now();
      return siteCache;
    }
  } catch (e) { /* fall through */ }
  return { works: null, requireReview: false, author: {} };
}

export async function hashIp(request, env) {
  const ip = request.headers.get('CF-Connecting-IP') || request.headers.get('X-Forwarded-For') || 'unknown';
  const data = new TextEncoder().encode(`${env.ADMIN_PASSWORD || 'palimpsest'}:${ip}`);
  const digest = await crypto.subtle.digest('SHA-256', data);
  return [...new Uint8Array(digest)].slice(0, 12).map((b) => b.toString(16).padStart(2, '0')).join('');
}

// Constant-time comparison of the moderator password.
export function isModerator(request, env) {
  const expected = env.ADMIN_PASSWORD || '';
  if (expected.length < 8) return false;
  const header = request.headers.get('Authorization') || '';
  const given = header.startsWith('Bearer ') ? header.slice(7) : '';
  const a = new TextEncoder().encode(given);
  const b = new TextEncoder().encode(expected);
  let diff = a.length ^ b.length;
  for (let i = 0; i < Math.max(a.length, b.length); i++) diff |= (a[i] || 0) ^ (b[i] || 0);
  return diff === 0;
}

export function cleanText(s, max) {
  return String(s || '')
    .replace(/\r\n?/g, '\n')
    .replace(/[\u0000-\u0008\u000B\u000C\u000E-\u001F\u007F]/g, '')
    .replace(/\n{3,}/g, '\n\n')
    .trim()
    .slice(0, max);
}

export const SLUG_RE = /^[a-z0-9][a-z0-9-]{0,119}$/;
