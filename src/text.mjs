// Turns Markdown (as saved by the editor) into journal HTML:
// numbered footnotes, paragraph-level blocks for side-by-side reading,
// and line-by-line verse for poems.
import { marked } from '../vendor/marked.esm.js';

marked.setOptions({ gfm: true, breaks: false });

export const esc = (s = '') =>
  String(s).replace(/&/g, '&amp;').replace(/</g, '&lt;').replace(/>/g, '&gt;').replace(/"/g, '&quot;');

// The rich-text editor may escape brackets; restore footnote syntax.
function normalise(md = '') {
  return md
    .replace(/\r\n?/g, '\n')
    .replace(/\\\[\\?\^([^\]\\]+)\\\]/g, '[^$1]')
    .replace(/\[\\\^([^\]]+)\]/g, '[^$1]');
}

// Pulls out "[^id]: text" definitions and replaces "[^id]" references.
function footnotes(md, prefix) {
  const defs = new Map();
  const defRe = /^\[\^([^\]]+)\]:[ \t]*(.*(?:\n(?:[ \t]{2,}|\t).*)*)/gm;
  md = md.replace(defRe, (_, id, text) => {
    defs.set(id.trim(), text.replace(/\n[ \t]+/g, ' ').trim());
    return '';
  });
  const order = [];
  md = md.replace(/\[\^([^\]]+)\]/g, (m, rawId) => {
    const id = rawId.trim();
    if (!defs.has(id)) return m;
    let n = order.indexOf(id) + 1;
    if (!n) { order.push(id); n = order.length; }
    return `<sup class="fn-ref" id="${prefix}ref-${n}"><a href="#${prefix}fn-${n}" data-fn="${n}" aria-describedby="${prefix}fn-${n}">${n}</a></sup>`;
  });
  const notes = order.map((id, i) => ({ n: i + 1, html: marked.parseInline(defs.get(id)) }));
  return { md, notes };
}

function plainText(md = '') {
  return md
    .replace(/<[^>]+>/g, ' ')
    .replace(/\[\^[^\]]+\]/g, '')
    .replace(/[#>*_`\[\]()!-]/g, ' ')
    .replace(/\s+/g, ' ')
    .trim();
}

export function wordCount(md = '') {
  const t = plainText(md);
  return t ? t.split(' ').length : 0;
}

// Prose: each top-level Markdown block becomes a numbered block.
export function renderProse(md = '', prefix = '') {
  const { md: body, notes } = footnotes(normalise(md), prefix);
  const tokens = marked.lexer(body);
  const blocks = [];
  for (const tok of tokens) {
    if (tok.type === 'space') continue;
    if (tok.type === 'html' && !tok.text.trim()) continue;
    const list = [tok];
    list.links = tokens.links;
    blocks.push(marked.parser(list).trim());
  }
  return { blocks, notes, words: wordCount(body) };
}

// Verse: stanzas separated by blank lines, every line kept as written.
export function renderVerse(text = '', prefix = '') {
  const { md: body, notes } = footnotes(normalise(text), prefix);
  const stanzas = body
    .replace(/<br\s*\/?>/gi, '\n')
    .split(/\n[ \t]*\n/)
    .map((s) => s.replace(/^\n+|\n+$/g, ''))
    .filter((s) => s.trim());
  const blocks = stanzas.map((stanza, si) => {
    const lines = stanza.split('\n').map((raw, li) => {
      const line = raw.replace(/(\\|  +)$/, '');
      const indent = (line.match(/^[  ]*/) || [''])[0].length;
      const content = line.trim() ? marked.parseInline(line.trim()) : '&nbsp;';
      const style = indent ? ` style="--indent:${Math.min(indent, 12) / 2}"` : '';
      return `<span class="line${indent ? ' indented' : ''}" data-line="${si}-${li}"${style}>${content}</span>`;
    });
    return `<p class="stanza">${lines.join('')}</p>`;
  });
  return { blocks, notes, words: wordCount(body) };
}

export function renderMarkdown(md = '') {
  return marked.parse(normalise(md));
}

export function excerpt(md = '', words = 60) {
  const t = normalise(md)
    .replace(/^\[\^[^\]]+\]:.*$/gm, '')
    .replace(/\[\^[^\]]+\]/g, '')
    .replace(/^#+\s.*$/gm, '')
    .replace(/!\[[^\]]*\]\([^)]*\)/g, '')
    .replace(/\[([^\]]*)\]\([^)]*\)/g, '$1')
    .replace(/<[^>]+>/g, '')
    .replace(/[*_`>]/g, '')
    .replace(/\s+/g, ' ')
    .trim();
  const parts = t.split(' ');
  return parts.length > words ? parts.slice(0, words).join(' ').replace(/[\s.,;:!?…–—-]+$/, '') + '…' : t;
}
