// Optional: preview the built site on your own computer, discussions included.
//   node build.mjs && node dev.mjs     then open http://localhost:8788
// Uses Node's built-in SQLite in place of Cloudflare's database. Not needed for publishing.
import http from 'node:http';
import fs from 'node:fs';
import path from 'node:path';
import { fileURLToPath, pathToFileURL } from 'node:url';
import { DatabaseSync } from 'node:sqlite';

const ROOT = path.dirname(fileURLToPath(import.meta.url));
const DIST = path.join(ROOT, 'dist');
const PORT = Number(process.env.PORT || 8788);
const sqlite = new DatabaseSync(process.env.DEV_DB || path.join(ROOT, '.dev-comments.sqlite'));

// The few D1 methods the functions use.
const toNamed = (sql) => sql.replace(/\?(\d+)/g, '?');
const order = (sql, args) => {
  const idx = [...sql.matchAll(/\?(\d+)/g)].map((m) => Number(m[1]) - 1);
  return idx.length ? idx.map((i) => args[i]) : args;
};
const DB = {
  prepare(sql) {
    let args = [];
    const stmt = () => sqlite.prepare(toNamed(sql));
    const api = {
      bind(...a) { args = a; return api; },
      async all() { return { results: stmt().all(...order(sql, args)) }; },
      async first() { return stmt().get(...order(sql, args)) ?? null; },
      async run() {
        const r = stmt().run(...order(sql, args));
        return { meta: { last_row_id: Number(r.lastInsertRowid), changes: r.changes } };
      },
    };
    return api;
  },
};

const TYPES = { '.html': 'text/html; charset=utf-8', '.css': 'text/css', '.js': 'text/javascript', '.json': 'application/json', '.svg': 'image/svg+xml', '.xml': 'application/xml', '.yml': 'text/yaml', '.txt': 'text/plain', '.png': 'image/png', '.jpg': 'image/jpeg', '.webp': 'image/webp' };

function staticFile(urlPath) {
  let p = path.join(DIST, decodeURIComponent(urlPath));
  if (!p.startsWith(DIST)) return null;
  if (fs.existsSync(p) && fs.statSync(p).isDirectory()) p = path.join(p, 'index.html');
  return fs.existsSync(p) ? p : null;
}

const ASSETS = {
  async fetch(url) {
    const file = staticFile(new URL(url).pathname);
    if (!file) return new Response('Not found', { status: 404 });
    return new Response(fs.readFileSync(file), { headers: { 'Content-Type': TYPES[path.extname(file)] || 'application/octet-stream' } });
  },
};

const FAKE_AI = {
  // Stand-in for Workers AI in local previews: marks the text instead of translating it.
  async run(model, { messages }) {
    const text = messages[messages.length - 1].content;
    const to = /into Georgian/.test(messages[0].content) ? 'KA' : 'EN';
    return { choices: [{ message: { content: `[${to} preview] ${text}` } }] };
  },
};
const env = { DB, ASSETS, ADMIN_PASSWORD: process.env.ADMIN_PASSWORD || 'local-password', AI: process.env.NO_AI ? undefined : FAKE_AI };

async function handleApi(req, res, url) {
  const name = url.pathname.replace(/^\/api\//, '').replace(/\/$/, '');
  const file = path.join(ROOT, 'functions', 'api', `${name}.js`);
  if (!/^[a-z-]+$/.test(name) || !fs.existsSync(file)) { res.writeHead(404); return res.end('Not found'); }
  const mod = await import(pathToFileURL(file).href);
  const handler = mod[`onRequest${req.method[0]}${req.method.slice(1).toLowerCase()}`] || mod.onRequest;
  if (!handler) { res.writeHead(405); return res.end('Method not allowed'); }
  const chunks = [];
  for await (const c of req) chunks.push(c);
  const headers = new Headers();
  for (const [k, v] of Object.entries(req.headers)) if (typeof v === 'string') headers.set(k, v);
  headers.set('CF-Connecting-IP', req.socket.remoteAddress || '127.0.0.1');
  const request = new Request(url, { method: req.method, headers, body: chunks.length ? Buffer.concat(chunks) : undefined });
  const response = await handler({ request, env });
  res.writeHead(response.status, Object.fromEntries(response.headers));
  res.end(Buffer.from(await response.arrayBuffer()));
}

http.createServer(async (req, res) => {
  const url = new URL(req.url, `http://localhost:${PORT}`);
  try {
    if (url.pathname.startsWith('/api/')) return await handleApi(req, res, url);
    const file = staticFile(url.pathname);
    if (!file) {
      res.writeHead(404, { 'Content-Type': TYPES['.html'] });
      return res.end(fs.readFileSync(path.join(DIST, '404.html')));
    }
    if (!url.pathname.endsWith('/') && fs.statSync(path.join(DIST, url.pathname)).isDirectory?.()) {
      res.writeHead(301, { Location: `${url.pathname}/${url.search}` });
      return res.end();
    }
    res.writeHead(200, { 'Content-Type': TYPES[path.extname(file)] || 'application/octet-stream' });
    res.end(fs.readFileSync(file));
  } catch (e) {
    console.error(e);
    res.writeHead(500);
    res.end(String(e));
  }
}).listen(PORT, () => console.log(`Preview: http://localhost:${PORT}  (moderator password: ${env.ADMIN_PASSWORD})`));
