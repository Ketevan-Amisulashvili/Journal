// HTML for every page type. Plain template strings, no framework.
import { UI, LANGS, SECTIONS, COMMENT_UI } from './i18n.mjs';
import { esc } from './text.mjs';

const other = (lang) => (lang === 'ka' ? 'en' : 'ka');

export const workUrl = (lang, slug) => `/${lang}/${slug}/`;

export function fmtDate(iso, lang) {
  if (!iso) return '';
  const d = new Date(`${String(iso).slice(0, 10)}T12:00:00Z`);
  if (Number.isNaN(d.getTime())) return esc(iso);
  return d.toLocaleDateString(UI[lang].dateFmt, { day: 'numeric', month: 'long', year: 'numeric', timeZone: 'UTC' });
}

const FONTS =
  'https://fonts.googleapis.com/css2?family=Newsreader:ital,opsz,wght@0,6..72,300..700;1,6..72,300..700' +
  '&family=Noto+Serif+Georgian:wght@300..700&family=Noto+Sans+Georgian:wght@400..600' +
  '&family=Instrument+Sans:wght@400..600&display=swap';

// Runs before paint so the saved theme and text size never flash.
const PREPAINT = `(function(){try{var d=document.documentElement,t=localStorage.getItem('pl-theme'),s=localStorage.getItem('pl-size');if(t==='light'||t==='dark')d.setAttribute('data-theme',t);if(s)d.setAttribute('data-size',s);}catch(e){}})();`;

const ICONS = {
  theme: '<svg viewBox="0 0 20 20" aria-hidden="true"><circle cx="10" cy="10" r="6.5" fill="none" stroke="currentColor" stroke-width="1.4"/><path d="M10 3.5a6.5 6.5 0 0 1 0 13z" fill="currentColor"/></svg>',
  focus: '<svg viewBox="0 0 20 20" aria-hidden="true"><path d="M3 7V3h4M13 3h4v4M17 13v4h-4M7 17H3v-4" fill="none" stroke="currentColor" stroke-width="1.4"/></svg>',
};

function head({ lang, title, description, path, alternates = {}, site, noindex, type = 'website' }) {
  const base = (site.site_url || '').replace(/\/$/, '');
  const abs = (p) => (base ? base + p : p);
  const alt = Object.entries(alternates)
    .map(([l, p]) => `<link rel="alternate" hreflang="${l}" href="${esc(abs(p))}">`)
    .join('');
  const siteName = site[`title_${lang}`];
  return `<!doctype html>
<html lang="${lang}">
<head>
<meta charset="utf-8">
<meta name="viewport" content="width=device-width, initial-scale=1">
<title>${esc(title)}</title>
<meta name="description" content="${esc(description || site[`tagline_${lang}`])}">
${noindex ? '<meta name="robots" content="noindex">' : ''}
${base ? `<link rel="canonical" href="${esc(abs(path))}">` : ''}
${alt}
<meta property="og:title" content="${esc(title)}">
<meta property="og:description" content="${esc(description || site[`tagline_${lang}`])}">
<meta property="og:type" content="${type}">
<meta property="og:site_name" content="${esc(siteName)}">
<meta property="og:locale" content="${lang === 'ka' ? 'ka_GE' : 'en_GB'}">
<meta name="theme-color" content="#F5EDDC" media="(prefers-color-scheme: light)">
<meta name="theme-color" content="#1D1C1A" media="(prefers-color-scheme: dark)">
<link rel="icon" href="/favicon.svg" type="image/svg+xml">
<link rel="alternate" type="application/rss+xml" title="${esc(siteName)}" href="/${lang}/feed.xml">
<link rel="preconnect" href="https://fonts.googleapis.com">
<link rel="preconnect" href="https://fonts.gstatic.com" crossorigin>
<link rel="stylesheet" href="${FONTS}">
<link rel="stylesheet" href="/assets/site.css?v=${site._v}">
<script>${PREPAINT}</script>
</head>`;
}

function controls(lang) {
  const t = UI[lang];
  return `<div class="controls" role="group" aria-label="${esc(t.textSize)}">
  <button type="button" class="ctl" data-size-step="-1" aria-label="${esc(t.smaller)}" title="${esc(t.smaller)}"><span class="aa small">Aa</span></button>
  <button type="button" class="ctl" data-size-step="1" aria-label="${esc(t.larger)}" title="${esc(t.larger)}"><span class="aa">Aa</span></button>
  <button type="button" class="ctl" data-theme-toggle aria-label="${esc(t.theme)}" title="${esc(t.theme)}"
    data-label-auto="${esc(t.themeAuto)}" data-label-light="${esc(t.themeLight)}" data-label-dark="${esc(t.themeDark)}">${ICONS.theme}<span class="ctl-text" data-theme-label>${esc(t.themeAuto)}</span></button>
</div>`;
}

function siteHeader({ lang, site, counterpart, compact = true, current = '' }) {
  const t = UI[lang];
  const o = other(lang);
  const nav = [
    ...SECTIONS.map((s) => ({ key: s, href: `/${lang}/archive/?section=${s}`, label: t.sections[s] })),
    { key: 'archive', href: `/${lang}/archive/`, label: t.archive },
    { key: 'about', href: `/${lang}/about/`, label: t.about },
  ];
  return `<a class="skip" href="#main">${esc(t.skip)}</a>
<header class="site-head${compact ? ' compact' : ''}">
  <div class="frame head-row">
    <a class="wordmark" href="/${lang}/" ${compact ? '' : 'aria-current="page"'}>${esc(site[`title_${lang}`])}</a>
    <nav class="nav" aria-label="${esc(t.home)}">
      <ul>${nav.map((n) => `<li><a href="${n.href}"${current === n.key ? ' aria-current="page"' : ''}>${esc(n.label)}</a></li>`).join('')}</ul>
    </nav>
    <div class="head-tools">
      <a class="lang-switch" href="${counterpart || `/${o}/`}" hreflang="${o}" lang="${o}" data-lang-link aria-label="${esc(t.switchToLabel)}">${esc(t.switchTo)}</a>
      ${controls(lang)}
    </div>
  </div>
</header>`;
}

function siteFooter({ lang, site }) {
  const t = UI[lang];
  const year = new Date().getFullYear();
  return `<footer class="site-foot">
  <div class="frame foot-row">
    <div class="foot-mark">
      <span class="foot-title">${esc(site[`title_${lang}`])}</span>
      <span class="foot-ghost" lang="${other(lang)}" aria-hidden="true">${esc(site[`title_${other(lang)}`])}</span>
    </div>
    <p class="foot-line">${esc(site[`tagline_${lang}`])}</p>
    <ul class="foot-links">
      <li><a href="/${lang}/archive/">${esc(t.archive)}</a></li>
      <li><a href="/${lang}/about/">${esc(t.about)}</a></li>
      <li><a href="/${lang}/feed.xml">${esc(t.feed)}</a></li>
    </ul>
    <p class="foot-copy">© ${year} ${esc(site[`author_${lang}`])}. ${esc(t.rights)}</p>
  </div>
</footer>
<script src="/assets/site.js?v=${site._v}" defer></script>`;
}

function page(opts, main, extraScripts = '') {
  return `${head(opts)}
<body class="${opts.bodyClass || ''}">
${siteHeader(opts)}
<main id="main">${main}</main>
${siteFooter(opts)}
${extraScripts}
</body>
</html>`;
}

// Small pieces reused on the front page and in the archive.
function availability(w, lang) {
  const t = UI[lang];
  if (lang === 'ka') return w.versions.en ? `<span class="avail">${esc(t.alsoIn)}</span>` : '';
  return w.versions.en ? `<span class="avail">${esc(t.alsoIn)}</span>` : `<span class="avail only">${esc(t.onlyIn)}</span>`;
}

function shown(w, lang) {
  // The version to show for a language: its own if it exists, else the original.
  return w.versions[lang] || w.versions.ka;
}

function shownLang(w, lang) {
  return w.versions[lang] ? lang : 'ka';
}

function row(w, lang) {
  const t = UI[lang];
  const v = shown(w, lang);
  const vl = shownLang(w, lang);
  return `<li class="row" data-section="${w.section}" data-title="${esc((v.title || '').toLowerCase())} ${esc((w.versions.ka.title || '').toLowerCase())}">
  <a class="row-link" href="${workUrl(lang, w.slug)}">
    <time class="row-date" datetime="${esc(w.date)}">${fmtDate(w.date, lang)}</time>
    <span class="row-main">
      <span class="row-title" lang="${vl}">${esc(v.title)}</span>
      ${v.subtitle ? `<span class="row-sub" lang="${vl}">${esc(v.subtitle)}</span>` : ''}
    </span>
    <span class="row-meta">
      <span class="row-section">${esc(t.sections[w.section])}</span>
      <span>${esc(t.minutes(w.minutes[vl]))}</span>
      ${availability(w, lang)}
    </span>
  </a>
</li>`;
}

export function homePage({ lang, site, works }) {
  const t = UI[lang];
  const o = other(lang);
  const featured = works.find((w) => w.featured && w.kind === 'essay') || works.find((w) => w.kind === 'essay') || works[0];
  const rest = works.filter((w) => w !== featured).slice(0, 12);
  const poem = works.find((w) => w.kind === 'poem' && w.versions.en);

  let opening = '';
  if (featured) {
    const v = shown(featured, lang);
    const vl = shownLang(featured, lang);
    opening = `<section class="opening frame" aria-labelledby="opening-title">
  <div class="margin">
    <p class="m-section">${esc(t.sections[featured.section])}</p>
    <p><time datetime="${esc(featured.date)}">${fmtDate(featured.date, lang)}</time></p>
    <p>${esc(t.minutes(featured.minutes[vl]))}</p>
    ${availability(featured, lang) ? `<p>${availability(featured, lang)}</p>` : ''}
  </div>
  <div class="opening-body" lang="${vl}">
    <h2 id="opening-title" class="opening-title"><a href="${workUrl(lang, featured.slug)}">${esc(v.title)}</a></h2>
    ${v.subtitle ? `<p class="standfirst">${esc(v.subtitle)}</p>` : ''}
    <p class="opening-text">${esc(featured.excerpt[vl])}</p>
    <p><a class="read-on" href="${workUrl(lang, featured.slug)}">${esc(t.continueReading)}</a></p>
  </div>
</section>`;
  }

  let poemBlock = '';
  if (poem) {
    const ka = poem.versions.ka;
    const en = poem.versions.en;
    const first = (l) => poem.rendered[l].blocks[0] || '';
    poemBlock = `<section class="twin frame" aria-labelledby="twin-title">
  <div class="margin"><h2 id="twin-title" class="m-head">${esc(t.poemOfIssue)}</h2></div>
  <div class="twin-cols">
    <div class="twin-col" lang="ka"><h3 class="twin-name">${esc(ka.title)}</h3><div class="verse">${first('ka')}</div></div>
    <div class="twin-col" lang="en"><h3 class="twin-name">${esc(en.title)}</h3><div class="verse">${first('en')}</div></div>
    <p class="twin-link"><a href="${workUrl(lang, poem.slug)}#parallel">${esc(t.readParallel)}</a></p>
  </div>
</section>`;
  }

  const heroSrc = String(site.hero_image || '').trim();
  const heroAlt = site[`hero_caption_${lang}`] || site.hero_caption_ka || '';
  const hero = heroSrc
    ? `<figure class="hero-figure"><img src="${esc(heroSrc)}" alt="${esc(heroAlt)}" loading="eager" decoding="async">${heroAlt ? `<figcaption>${esc(heroAlt)}</figcaption>` : ''}</figure>`
    : '';
  const main = `<section class="masthead frame${heroSrc ? ' has-hero' : ''}" aria-label="${esc(site[`title_${lang}`])}">
  ${hero}
  <h1 class="lockup">
    <span class="lockup-ghost" lang="${o}" aria-hidden="true">${esc(site[`title_${o}`])}</span>
    <span class="lockup-title">${esc(site[`title_${lang}`])}</span>
  </h1>
  <p class="tagline">${esc(site[`tagline_${lang}`])}</p>
</section>
${opening}
<section class="recent frame" aria-labelledby="recent-title">
  <div class="margin"><h2 id="recent-title" class="m-head">${esc(t.recent)}</h2></div>
  <ol class="rows">${rest.map((w) => row(w, lang)).join('')}</ol>
  <p class="more"><a href="/${lang}/archive/">${esc(t.archive)}: ${esc(t.pieces(works.length))}</a></p>
</section>
${poemBlock}`;

  return page(
    { lang, site, title: `${site[`title_${lang}`]}: ${site[`tagline_${lang}`]}`, path: `/${lang}/`, alternates: { ka: '/ka/', en: '/en/' }, counterpart: `/${o}/`, compact: false, bodyClass: 'home' },
    main,
  );
}

export function archivePage({ lang, site, works }) {
  const t = UI[lang];
  const o = other(lang);
  const years = new Map();
  for (const w of works) {
    const y = String(w.date).slice(0, 4);
    if (!years.has(y)) years.set(y, []);
    years.get(y).push(w);
  }
  const filters = [{ key: 'all', label: t.all }, ...SECTIONS.map((s) => ({ key: s, label: t.sections[s] }))];
  const main = `<section class="frame archive">
  <div class="margin"><h1 class="m-head page-title">${esc(t.archive)}</h1><p class="count" data-count data-template="${esc(t.pieces(999)).replace('999', '{n}')}" data-one="${esc(t.pieces(1))}">${esc(t.pieces(works.length))}</p></div>
  <div class="archive-body">
    <div class="filters">
      <div class="chips" role="group" aria-label="${esc(t.archive)}">
        ${filters.map((f) => `<button type="button" class="chip" data-filter="${f.key}" aria-pressed="${f.key === 'all'}">${esc(f.label)}</button>`).join('')}
      </div>
      <label class="search"><span class="visually-hidden">${esc(t.search)}</span>
        <input type="search" data-search placeholder="${esc(t.searchPlaceholder)}" autocomplete="off"></label>
    </div>
    ${[...years.entries()]
      .map(([y, ws]) => `<section class="year" data-year><h2 class="year-num">${y}</h2><ol class="rows">${ws.map((w) => row(w, lang)).join('')}</ol></section>`)
      .join('')}
    <p class="empty" data-empty hidden>${esc(t.noResults)}</p>
  </div>
</section>`;
  return page(
    { lang, site, title: `${t.archive}: ${site[`title_${lang}`]}`, path: `/${lang}/archive/`, alternates: { ka: '/ka/archive/', en: '/en/archive/' }, counterpart: `/${o}/archive/`, current: 'archive', bodyClass: 'archive-page' },
    main,
  );
}

export function aboutPage({ lang, site, about }) {
  const t = UI[lang];
  const o = other(lang);
  const v = about[lang] || about.ka;
  const main = `<article class="frame prose-page">
  <div class="margin"></div>
  <div class="prose-col" lang="${about[lang] ? lang : 'ka'}">
    <h1 class="page-heading">${esc(v.title)}</h1>
    <div class="body">${v.html}</div>
  </div>
</article>`;
  return page(
    { lang, site, title: `${v.title}: ${site[`title_${lang}`]}`, path: `/${lang}/about/`, alternates: { ka: '/ka/about/', en: '/en/about/' }, counterpart: `/${o}/about/`, current: 'about' },
    main,
  );
}

function notesList(notes, prefix, lang) {
  if (!notes.length) return '';
  return `<section class="notes" aria-label="${esc(UI[lang].notes)}">
  <h2 class="notes-head">${esc(UI[lang].notes)}</h2>
  <ol>${notes.map((n) => `<li id="${prefix}fn-${n.n}" data-note="${n.n}"><span class="note-body">${n.html}</span> <a class="back" href="#${prefix}ref-${n.n}" aria-label="↩">↩</a></li>`).join('')}</ol>
</section>`;
}

function bodyBlocks(r, kind) {
  const inner = r.blocks.map((b, i) => `<div class="blk" id="b-${i}" data-b="${i}">${b}</div>`).join('');
  return kind === 'poem' ? `<div class="verse">${inner}</div>` : inner;
}

export function workPage({ lang, site, work }) {
  const t = UI[lang];
  const o = other(lang);
  const hasOwn = !!work.versions[lang];
  const vl = hasOwn ? lang : 'ka';
  const v = work.versions[vl];
  const r = work.rendered[vl];
  const otherLang = vl === 'ka' ? 'en' : 'ka';
  const ov = work.versions[otherLang];
  const or = work.twin[otherLang];
  const both = !!(work.versions.ka && work.versions.en);
  const author = site[`author_${lang}`];
  const by = work.kind === 'poem' ? (v.poet || author) : author;

  // The other language's text travels in a template for the side-by-side view.
  const twin = both
    ? `<template id="twin" data-lang="${otherLang}" data-title="${esc(ov.title)}"><div class="twin-text">${bodyBlocks(or, work.kind)}</div>${notesList(or.notes, 'tw-', otherLang)}</template>`
    : '';

  const viewSwitch = `<div class="view-switch" role="group" aria-label="${esc(t.readIn)}">
    <a href="${workUrl('ka', work.slug)}" class="vs" lang="ka" hreflang="ka" data-view="ka" data-lang-link ${vl === 'ka' ? 'aria-current="true"' : ''}>${esc(UI.ka.langName)}</a>
    ${work.versions.en ? `<a href="${workUrl('en', work.slug)}" class="vs" lang="en" hreflang="en" data-view="en" data-lang-link ${vl === 'en' ? 'aria-current="true"' : ''}>${esc(UI.en.langName)}</a>` : ''}
    ${both ? `<button type="button" class="vs" data-parallel aria-pressed="false">${esc(t.viewParallel)}</button>` : ''}
  </div>`;

  const extra = [];
  if (v.commentary) {
    extra.push(`<section class="afterword"><h2 class="after-head">${esc(t.commentary)}</h2><div class="body">${work.commentaryHtml[vl]}</div></section>`);
  }
  if (vl === 'en' && v.translator_note) {
    extra.push(`<section class="afterword tnote"><h2 class="after-head">${esc(t.translatorNote)}</h2><p>${esc(v.translator_note)}</p></section>`);
  }

  const cui = COMMENT_UI[lang];
  const main = `<article class="work frame ${work.kind}" data-slug="${esc(work.slug)}" data-kind="${work.kind}" lang="${vl}">
  <header class="work-head">
    <div class="margin">
      <p class="m-section"><a href="/${lang}/archive/?section=${work.section}">${esc(t.sections[work.section])}</a></p>
      <p><time datetime="${esc(work.date)}">${fmtDate(work.date, lang)}</time></p>
      <p>${esc(t.minutes(r.minutes))}</p>
    </div>
    <div class="title-block">
      <h1 class="work-title">
        ${both ? `<span class="title-ghost" lang="${otherLang}" aria-hidden="true">${esc(ov.title)}</span>` : ''}
        <span class="title-main">${esc(v.title)}</span>
      </h1>
      ${v.subtitle ? `<p class="standfirst">${esc(v.subtitle)}</p>` : ''}
      <p class="byline">${esc(work.kind === 'poem' && v.poet ? t.poet : t.by)} ${esc(by)}</p>
    </div>
  </header>
  <div class="reading-bar" lang="${lang}">
    ${viewSwitch}
    <button type="button" class="ctl focus-toggle" data-focus aria-pressed="false" data-label-on="${esc(t.focusExit)}" data-label-off="${esc(t.focus)}">${ICONS.focus}<span class="ctl-text">${esc(t.focus)}</span></button>
  </div>
  ${!hasOwn ? `<p class="untranslated" lang="${lang}">${esc(t.notTranslated)}</p>` : ''}
  <div class="text-wrap">
    <div class="text" data-text data-lang="${vl}">${bodyBlocks(r, work.kind)}</div>
    <div class="sidenotes" aria-hidden="true"></div>
  </div>
  ${twin}
  <div class="after">
    <div class="appreciate" data-like-piece data-slug="${esc(work.slug)}" hidden>
      <p class="appreciate-q" data-like-prompt data-thanks="${esc(t.likeThanks)}">${esc(t.likePrompt)}</p>
      <button type="button" class="like-btn big" data-like aria-pressed="false" aria-label="${esc(t.like)}">
        <svg viewBox="0 0 24 24" aria-hidden="true"><path d="M12 20.5s-7.5-4.6-9.3-9.2C1.5 8.1 3.6 4.5 7.2 4.5c2 0 3.6 1.1 4.8 2.8 1.2-1.7 2.8-2.8 4.8-2.8 3.6 0 5.7 3.6 4.5 6.8-1.8 4.6-9.3 9.2-9.3 9.2z"/></svg>
        <span class="like-word">${esc(t.like)}</span><span class="like-count" data-like-count></span>
      </button>
    </div>
    ${notesList(r.notes, '', lang)}
    ${extra.join('')}
  </div>
</article>
<section class="discussion frame" id="discussion" aria-labelledby="discussion-title" lang="${lang}">
  <div class="margin"><h2 id="discussion-title" class="m-head">${esc(t.discussion)}</h2><p class="disc-count" data-comment-count></p></div>
  <div class="disc-body" data-comments data-slug="${esc(work.slug)}" data-lang="${lang}">
    <p class="disc-intro">${esc(t.discussionIntro)}</p>
    <noscript><p>${esc(cui.unavailable)}</p></noscript>
  </div>
</section>`;

  const desc = v.subtitle || work.excerpt[vl].slice(0, 160);
  const alternates = { ka: workUrl('ka', work.slug) };
  if (work.versions.en) alternates.en = workUrl('en', work.slug);
  return page(
    {
      lang, site, title: `${v.title}: ${site[`title_${lang}`]}`, description: desc, path: workUrl(lang, work.slug),
      alternates, counterpart: workUrl(o, work.slug), type: 'article', bodyClass: 'work-page',
      noindex: !hasOwn,
    },
    main,
    `<script>window.PL_COMMENTS=${JSON.stringify(cui).replace(/</g, '\\u003c')};</script>
<script src="/assets/comments.js?v=${site._v}" defer></script>
<script src="/assets/likes.js?v=${site._v}" defer></script>`,
  );
}

export function notFoundPage({ site }) {
  const lang = 'ka';
  const main = `<section class="frame prose-page">
  <div class="margin"></div>
  <div class="prose-col">
    <h1 class="page-heading">${esc(UI.ka.notFoundTitle)}</h1>
    <p>${esc(UI.ka.notFoundBody)}</p>
    <p><a href="/ka/">${esc(UI.ka.backHome)}</a></p>
    <h2 class="page-heading second" lang="en">${esc(UI.en.notFoundTitle)}</h2>
    <p lang="en">${esc(UI.en.notFoundBody)}</p>
    <p lang="en"><a href="/en/">${esc(UI.en.backHome)}</a></p>
  </div>
</section>`;
  return page({ lang, site, title: `404: ${site.title_ka}`, path: '/404', counterpart: '/en/', noindex: true }, main);
}

export function rootPage({ site }) {
  return `<!doctype html>
<html lang="ka">
<head>
<meta charset="utf-8">
<meta name="viewport" content="width=device-width, initial-scale=1">
<title>${esc(site.title_ka)} / ${esc(site.title_en)}</title>
<meta name="description" content="${esc(site.tagline_ka)} / ${esc(site.tagline_en)}">
<link rel="alternate" hreflang="ka" href="/ka/">
<link rel="alternate" hreflang="en" href="/en/">
<link rel="alternate" hreflang="x-default" href="/ka/">
<script>(function(){var l='ka';try{var s=localStorage.getItem('pl-lang');if(s==='ka'||s==='en'){l=s;}else{var n=(navigator.languages&&navigator.languages[0])||navigator.language||'';l=/^ka/i.test(n)?'ka':(/^(en|de|fr|es|it|ru|uk|pl|nl|sv|tr)/i.test(n)?'en':'ka');}}catch(e){}location.replace('/'+l+'/');})();</script>
<meta http-equiv="refresh" content="2; url=/ka/">
<style>body{font:18px/1.5 Georgia,serif;background:#F5EDDC;color:#1A1A1A;display:grid;place-items:center;min-height:90vh}a{color:#34418A}</style>
</head>
<body><p><a href="/ka/" hreflang="ka">${esc(site.title_ka)}</a> / <a href="/en/" hreflang="en">${esc(site.title_en)}</a></p></body>
</html>`;
}

export function rss({ lang, site, works }) {
  const base = (site.site_url || '').replace(/\/$/, '');
  const items = works
    .filter((w) => w.versions[lang])
    .slice(0, 30)
    .map((w) => {
      const v = w.versions[lang];
      const link = base + workUrl(lang, w.slug);
      return `<item><title>${esc(v.title)}</title><link>${esc(link)}</link><guid>${esc(link)}</guid><pubDate>${new Date(`${String(w.date).slice(0, 10)}T09:00:00Z`).toUTCString()}</pubDate><description>${esc(v.subtitle || w.excerpt[lang])}</description></item>`;
    })
    .join('');
  return `<?xml version="1.0" encoding="UTF-8"?>
<rss version="2.0"><channel><title>${esc(site[`title_${lang}`])}</title><link>${esc(base + `/${lang}/`)}</link><description>${esc(site[`tagline_${lang}`])}</description><language>${lang}</language>${items}</channel></rss>`;
}

export function sitemap({ site, works }) {
  const base = (site.site_url || '').replace(/\/$/, '');
  if (!base) return null;
  const urls = ['/ka/', '/en/', '/ka/archive/', '/en/archive/', '/ka/about/', '/en/about/'];
  for (const w of works) {
    urls.push(workUrl('ka', w.slug));
    if (w.versions.en) urls.push(workUrl('en', w.slug));
  }
  return `<?xml version="1.0" encoding="UTF-8"?>
<urlset xmlns="http://www.sitemaps.org/schemas/sitemap/0.9">${urls.map((u) => `<url><loc>${esc(base + u)}</loc></url>`).join('')}</urlset>`;
}

export { LANGS };
