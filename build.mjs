// Builds the whole journal into /dist. Run with:  node build.mjs
// No packages to install: everything it needs is in this folder.
import fs from 'node:fs';
import path from 'node:path';
import { fileURLToPath } from 'node:url';
import { renderProse, renderVerse, renderMarkdown, excerpt } from './src/text.mjs';
import * as T from './src/templates.mjs';

const ROOT = path.dirname(fileURLToPath(import.meta.url));
const CONTENT = path.join(ROOT, 'content');
const OUT = path.join(ROOT, 'dist');
const RESERVED = new Set(['archive', 'about', 'assets', 'admin', 'moderate', 'api', 'images', 'feed.xml']);
const WPM = { ka: 170, en: 230 };

const warnings = [];
const warn = (m) => warnings.push(m);

// Reads an entry saved by the editor: JSON front matter, then Markdown.
// Plain YAML-style "key: value" front matter is accepted too.
function parseEntry(text, file) {
  text = text.replace(/^﻿/, '').replace(/\r\n?/g, '\n');
  if (text.startsWith('{')) {
    const m = text.match(/^\{\n([\s\S]*?)\n\}(?:\n|$)/);
    if (m) {
      try {
        return { data: JSON.parse(`{${m[1]}}`), body: text.slice(m[0].length).replace(/^\n+/, '') };
      } catch (e) {
        throw new Error(`Could not read the details at the top of ${file}: ${e.message}`);
      }
    }
  }
  if (text.startsWith('---\n')) {
    const end = text.indexOf('\n---', 4);
    const data = {};
    for (const line of text.slice(4, end).split('\n')) {
      const mm = line.match(/^([A-Za-z_][\w-]*):\s*(.*)$/);
      if (!mm) continue;
      let v = mm[2].trim();
      if (/^(true|false)$/.test(v)) v = v === 'true';
      else if (/^".*"$|^'.*'$/.test(v)) v = v.slice(1, -1);
      data[mm[1]] = v;
    }
    return { data, body: text.slice(end + 4).replace(/^\n+/, '') };
  }
  return { data: {}, body: text };
}

function readCollection(dir) {
  const full = path.join(CONTENT, dir);
  if (!fs.existsSync(full)) return new Map();
  const map = new Map();
  for (const f of fs.readdirSync(full)) {
    const m = f.match(/^(.+)\.(ka|en)\.md$/);
    if (!m) continue;
    const [, slug, lang] = m;
    const { data, body } = parseEntry(fs.readFileSync(path.join(full, f), 'utf8'), `${dir}/${f}`);
    if (!map.has(slug)) map.set(slug, {});
    map.get(slug)[lang] = { ...data, body };
  }
  return map;
}

const hasText = (v) => v && (String(v.title || '').trim() || String(v.body || '').trim());

function loadWorks() {
  const works = [];
  for (const [kind, dir] of [['essay', 'essays'], ['poem', 'poems']]) {
    for (const [slug, versions] of readCollection(dir)) {
      if (!/^[a-z0-9][a-z0-9-]*$/.test(slug)) {
        warn(`Skipped "${dir}/${slug}": web addresses may only use a–z, 0–9 and hyphens.`);
        continue;
      }
      if (RESERVED.has(slug)) {
        warn(`Skipped "${dir}/${slug}": that web address is reserved. Choose another.`);
        continue;
      }
      if (!hasText(versions.ka)) {
        warn(`Skipped "${dir}/${slug}": it has no Georgian text yet.`);
        continue;
      }
      const ka = versions.ka;
      if (ka.draft === true || ka.draft === 'true') continue;
      const v = { ka };
      if (hasText(versions.en)) v.en = versions.en;
      works.push({
        slug,
        kind,
        section: kind === 'poem' ? 'poetry' : (['philosophy', 'prose'].includes(ka.section) ? ka.section : 'prose'),
        date: String(ka.date || '').slice(0, 10) || '1970-01-01',
        featured: ka.featured === true || ka.featured === 'true',
        versions: v,
      });
    }
  }
  // An essay and a poem can't share a web address: give the later one its own.
  const used = new Set();
  for (const w of works) {
    if (used.has(w.slug)) {
      let n = 2;
      while (used.has(`${w.slug}-${w.kind}${n > 2 ? `-${n}` : ''}`)) n++;
      const fresh = `${w.slug}-${w.kind}${n > 2 ? `-${n}` : ''}`;
      warn(`"${w.slug}" is used by more than one piece; the ${w.kind} "${w.versions.ka.title}" is published at /${fresh}/ instead. Rename one of them to avoid confusion.`);
      w.slug = fresh;
    }
    used.add(w.slug);
  }
  works.sort((a, b) => (a.date < b.date ? 1 : a.date > b.date ? -1 : a.slug.localeCompare(b.slug)));

  for (const w of works) {
    w.rendered = {};
    w.twin = {};
    w.excerpt = {};
    w.minutes = {};
    w.commentaryHtml = {};
    for (const lang of Object.keys(w.versions)) {
      const v = w.versions[lang];
      const render = w.kind === 'poem' ? renderVerse : renderProse;
      const r = render(v.body || '', '');
      const extraWords = v.commentary ? String(v.commentary).split(/\s+/).length : 0;
      r.minutes = Math.max(1, Math.round((r.words + extraWords) / WPM[lang]));
      w.rendered[lang] = r;
      w.twin[lang] = render(v.body || '', 'tw-');
      w.minutes[lang] = r.minutes;
      w.excerpt[lang] = excerpt(v.body || '', w.kind === 'poem' ? 30 : 55);
      if (v.commentary) w.commentaryHtml[lang] = renderMarkdown(v.commentary);
    }
    if (w.versions.en && w.rendered.ka.blocks.length !== w.rendered.en.blocks.length) {
      const unit = w.kind === 'poem' ? 'stanzas' : 'paragraphs';
      warn(`"${w.slug}": the Georgian has ${w.rendered.ka.blocks.length} ${unit} and the English ${w.rendered.en.blocks.length}. Side-by-side view lines them up in order, so the extra ones will sit at the end.`);
    }
  }
  return works;
}

function loadAbout() {
  const pages = readCollection('pages').get('about') || {};
  const about = {};
  for (const lang of ['ka', 'en']) {
    if (hasText(pages[lang])) about[lang] = { title: pages[lang].title || '', html: renderMarkdown(pages[lang].body || '') };
  }
  if (!about.ka) about.ka = { title: 'შესახებ', html: '' };
  return about;
}

function loadSettings() {
  const defaults = {
    title_ka: 'ჟურნალი', title_en: 'Journal', tagline_ka: '', tagline_en: '',
    author_ka: '', author_en: '', site_url: '', require_comment_review: false,
  };
  const file = path.join(CONTENT, 'settings.json');
  const s = fs.existsSync(file) ? JSON.parse(fs.readFileSync(file, 'utf8')) : {};
  const out = { ...defaults, ...s };
  if (!out.author_en) out.author_en = out.author_ka;
  if (!out.author_ka) out.author_ka = out.author_en;
  out._v = Date.now().toString(36);
  return out;
}

function write(rel, content) {
  const file = path.join(OUT, rel);
  fs.mkdirSync(path.dirname(file), { recursive: true });
  fs.writeFileSync(file, content);
}

function copyDir(from, to) {
  if (!fs.existsSync(from)) return;
  fs.cpSync(from, to, { recursive: true });
}

function build() {
  const started = Date.now();
  fs.rmSync(OUT, { recursive: true, force: true });
  fs.mkdirSync(OUT, { recursive: true });

  const site = loadSettings();
  const works = loadWorks();
  site._soon = ['philosophy', 'prose', 'poetry'].filter((s) => !works.some((w) => w.section === s));
  const about = loadAbout();

  copyDir(path.join(ROOT, 'public'), OUT);
  copyDir(path.join(ROOT, 'assets'), path.join(OUT, 'assets'));

  write('index.html', T.rootPage({ site }));
  write('404.html', T.notFoundPage({ site }));

  for (const lang of ['ka', 'en']) {
    write(`${lang}/index.html`, T.homePage({ lang, site, works }));
    write(`${lang}/archive/index.html`, T.archivePage({ lang, site, works }));
    write(`${lang}/about/index.html`, T.aboutPage({ lang, site, about }));
    write(`${lang}/feed.xml`, T.rss({ lang, site, works }));
    for (const work of works) write(`${lang}/${work.slug}/index.html`, T.workPage({ lang, site, work }));
  }

  const sm = T.sitemap({ site, works });
  if (sm) write('sitemap.xml', sm);
  write('robots.txt', `User-agent: *\nDisallow: /admin/\nDisallow: /moderate/\n${site.site_url ? `Sitemap: ${site.site_url.replace(/\/$/, '')}/sitemap.xml\n` : ''}`);

  // Read by the discussion system: which pieces exist and whether to hold comments for review.
  write('data/site.json', JSON.stringify({
    requireReview: site.require_comment_review === true || site.require_comment_review === 'true',
    author: { ka: site.author_ka, en: site.author_en },
    works: Object.fromEntries(works.map((w) => [w.slug, { ka: w.versions.ka.title, en: w.versions.en?.title || null }])),
  }));

  for (const w of warnings) console.warn(`Note: ${w}`);
  console.log(`Built ${works.length} pieces in both languages in ${Date.now() - started} ms.`);
}

build();
