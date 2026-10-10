// Reader controls: colour mode, text size, text-only mode, side-by-side
// reading, margin notes and archive filters. Works without any library.
(function () {
  'use strict';
  var doc = document.documentElement;

  function store(key, value) {
    try {
      if (value === undefined) return localStorage.getItem(key);
      if (value === null) localStorage.removeItem(key);
      else localStorage.setItem(key, value);
    } catch (e) { /* private mode: settings simply aren't remembered */ }
    return null;
  }

  // Remember the reader's language for the next visit to the root address.
  var pageLang = doc.getAttribute('lang');
  if (pageLang === 'ka' || pageLang === 'en') store('pl-lang', pageLang);

  /* ---------- Colour mode: automatic → light → dark ---------- */
  var themeBtn = document.querySelector('[data-theme-toggle]');
  function themeNow() { return doc.getAttribute('data-theme') || 'auto'; }
  function paintThemeLabel() {
    if (!themeBtn) return;
    var t = themeNow();
    var label = themeBtn.getAttribute('data-label-' + t) || t;
    var span = themeBtn.querySelector('[data-theme-label]');
    if (span) span.textContent = label;
    themeBtn.setAttribute('title', label);
    themeBtn.setAttribute('aria-label', label);
  }
  if (themeBtn) {
    paintThemeLabel();
    themeBtn.addEventListener('click', function () {
      var next = { auto: 'light', light: 'dark', dark: 'auto' }[themeNow()];
      if (next === 'auto') { doc.removeAttribute('data-theme'); store('pl-theme', null); }
      else { doc.setAttribute('data-theme', next); store('pl-theme', next); }
      paintThemeLabel();
      requestAnimationFrame(placeSidenotes);
    });
  }

  /* ---------- Text size ---------- */
  document.querySelectorAll('[data-size-step]').forEach(function (btn) {
    btn.addEventListener('click', function () {
      var cur = parseInt(doc.getAttribute('data-size') || '0', 10);
      var next = Math.max(-2, Math.min(3, cur + parseInt(btn.getAttribute('data-size-step'), 10)));
      if (next === 0) { doc.removeAttribute('data-size'); store('pl-size', null); }
      else { doc.setAttribute('data-size', String(next)); store('pl-size', String(next)); }
      requestAnimationFrame(placeSidenotes);
    });
  });

  /* ---------- Text-only mode ---------- */
  var focusBtn = document.querySelector('[data-focus]');
  if (focusBtn) {
    var label = focusBtn.querySelector('.ctl-text');
    var setFocus = function (on) {
      document.body.classList.toggle('focus-mode', on);
      focusBtn.setAttribute('aria-pressed', String(on));
      if (label) label.textContent = focusBtn.getAttribute(on ? 'data-label-on' : 'data-label-off');
      requestAnimationFrame(placeSidenotes);
    };
    focusBtn.addEventListener('click', function () { setFocus(!document.body.classList.contains('focus-mode')); });
    document.addEventListener('keydown', function (e) {
      if (e.key === 'Escape' && document.body.classList.contains('focus-mode')) setFocus(false);
    });
  }

  /* ---------- Keep the reader's place when switching language ---------- */
  function currentBlock() {
    var blocks = document.querySelectorAll('[data-text] [data-b]');
    var line = window.innerHeight * 0.25;
    var found = null;
    for (var i = 0; i < blocks.length; i++) {
      if (blocks[i].getBoundingClientRect().top <= line) found = blocks[i];
      else break;
    }
    return found && window.scrollY > 200 ? found.getAttribute('data-b') : null;
  }
  document.querySelectorAll('[data-lang-link]').forEach(function (a) {
    a.addEventListener('click', function () {
      var b = currentBlock();
      if (b !== null && a.getAttribute('aria-current') !== 'true') {
        a.href = a.href.split('#')[0] + '#b-' + b;
      }
    });
  });

  /* ---------- Margin notes (wide screens) and note pop-ups ---------- */
  var article = document.querySelector('.work');
  var textEl = document.querySelector('[data-text]');
  var sideEl = document.querySelector('.sidenotes');
  var notes = document.querySelectorAll('.after .notes li[data-note]');

  if (article && sideEl && notes.length) {
    article.classList.add('has-sidenotes');
    notes.forEach(function (li) {
      var n = li.getAttribute('data-note');
      var div = document.createElement('div');
      div.className = 'sidenote';
      div.setAttribute('data-sn', n);
      var body = li.querySelector('.note-body');
      div.innerHTML = '<span class="sn-num">' + n + '</span>' + (body ? body.innerHTML : '');
      sideEl.appendChild(div);
    });
  }

  function wide() { return window.matchMedia('(min-width: 1180px)').matches; }

  function placeSidenotes() {
    if (!sideEl || !textEl || !wide() || document.body.querySelector('.parallel-on')) return;
    var base = sideEl.getBoundingClientRect().top;
    var floor = 0;
    sideEl.querySelectorAll('.sidenote').forEach(function (sn) {
      var ref = textEl.querySelector('a[data-fn="' + sn.getAttribute('data-sn') + '"]');
      if (!ref) return;
      var top = ref.getBoundingClientRect().top - base - 4;
      top = Math.max(top, floor);
      sn.style.top = top + 'px';
      floor = top + sn.offsetHeight + 14;
    });
    sideEl.style.minHeight = floor + 'px';
  }

  var pop = null;
  function closePop() { if (pop) { pop.remove(); pop = null; } }
  function noteHtml(id) {
    var li = document.getElementById(id);
    var body = li && li.querySelector('.note-body');
    return body ? body.innerHTML : '';
  }
  document.addEventListener('click', function (e) {
    var a = e.target.closest && e.target.closest('.fn-ref a');
    if (!a) {
      if (pop && !pop.contains(e.target)) closePop();
      return;
    }
    var n = a.getAttribute('data-fn');
    var isTwin = a.getAttribute('href').indexOf('#tw-') === 0;
    if (wide() && !isTwin && !document.querySelector('.parallel-on')) {
      e.preventDefault();
      sideEl.querySelectorAll('.sidenote').forEach(function (s) { s.classList.toggle('active', s.getAttribute('data-sn') === n); });
      return;
    }
    var html = noteHtml(a.getAttribute('href').slice(1));
    if (!html) return;
    e.preventDefault();
    closePop();
    pop = document.createElement('div');
    pop.className = 'fn-pop';
    pop.setAttribute('role', 'note');
    pop.innerHTML = '<p>' + html + '</p>';
    document.body.appendChild(pop);
    var r = a.getBoundingClientRect();
    var w = pop.offsetWidth;
    var left = Math.min(window.scrollX + r.left - 12, window.scrollX + document.documentElement.clientWidth - w - 16);
    pop.style.left = Math.max(16, left) + 'px';
    pop.style.top = (window.scrollY + r.bottom + 8) + 'px';
  });
  document.addEventListener('keydown', function (e) { if (e.key === 'Escape') closePop(); });

  // Highlight a margin note while its reference is hovered.
  if (textEl && sideEl) {
    textEl.addEventListener('mouseover', function (e) {
      var a = e.target.closest && e.target.closest('.fn-ref a');
      if (!a) return;
      var n = a.getAttribute('data-fn');
      sideEl.querySelectorAll('.sidenote').forEach(function (s) { s.classList.toggle('active', s.getAttribute('data-sn') === n); });
    });
  }

  /* ---------- Side-by-side reading ---------- */
  var parBtn = document.querySelector('[data-parallel]');
  var tpl = document.getElementById('twin');
  var original = textEl ? textEl.innerHTML : '';

  function buildParallel() {
    var mainLang = textEl.getAttribute('data-lang');
    var twinLang = tpl.getAttribute('data-lang');
    var frag = tpl.content.cloneNode(true);
    var twinText = frag.querySelector('.twin-text');
    var twinNotes = frag.querySelector('.notes');
    var mine = [].slice.call(textEl.querySelectorAll('[data-b]'));
    var theirs = [].slice.call(twinText.querySelectorAll('[data-b]'));
    var isPoem = article.getAttribute('data-kind') === 'poem';
    // Georgian always on the left, as the original.
    var leftIsMine = mainLang === 'ka';
    var names = { ka: 'ქართული', en: 'English' };

    var out = document.createElement('div');
    out.className = 'parallel' + (isPoem ? ' verse' : '');
    var headRow = document.createElement('div');
    headRow.className = 'pair pair-head';
    headRow.innerHTML = '<div class="cell" lang="' + (leftIsMine ? mainLang : twinLang) + '">' + names[leftIsMine ? mainLang : twinLang] +
      '</div><div class="cell" lang="' + (leftIsMine ? twinLang : mainLang) + '">' + names[leftIsMine ? twinLang : mainLang] + '</div>';
    out.appendChild(headRow);

    var count = Math.max(mine.length, theirs.length);
    for (var i = 0; i < count; i++) {
      var row = document.createElement('div');
      row.className = 'pair';
      row.id = 'b-' + i;
      var a = document.createElement('div');
      var b = document.createElement('div');
      a.className = b.className = 'cell';
      a.setAttribute('lang', mainLang);
      b.setAttribute('lang', twinLang);
      if (mine[i]) a.innerHTML = mine[i].innerHTML;
      if (theirs[i]) b.innerHTML = theirs[i].innerHTML;
      if (leftIsMine) { row.appendChild(a); row.appendChild(b); } else { row.appendChild(b); row.appendChild(a); }
      out.appendChild(row);
    }
    textEl.innerHTML = '';
    textEl.appendChild(out);

    // Both sets of notes, each under its own column.
    var after = article.querySelector('.after');
    var ownNotes = after.querySelector('.notes');
    if (ownNotes || twinNotes) {
      var pn = document.createElement('div');
      pn.className = 'parallel-notes';
      var left = document.createElement('div');
      var right = document.createElement('div');
      if (ownNotes) { (leftIsMine ? left : right).appendChild(ownNotes.cloneNode(true)); ownNotes.hidden = true; }
      if (twinNotes) { (leftIsMine ? right : left).appendChild(twinNotes); }
      pn.appendChild(left); pn.appendChild(right);
      after.insertBefore(pn, after.firstChild);
    }
  }

  function setParallel(on, keepScroll) {
    if (!parBtn || !tpl) return;
    var at = keepScroll ? currentBlock() : null;
    article.classList.toggle('parallel-on', on);
    parBtn.setAttribute('aria-pressed', String(on));
    if (on) buildParallel();
    else {
      textEl.innerHTML = original;
      var pn = article.querySelector('.parallel-notes');
      if (pn) pn.remove();
      var own = article.querySelector('.after .notes');
      if (own) own.hidden = false;
    }
    if (history.replaceState) history.replaceState(null, '', on ? '#parallel' : location.pathname + location.search);
    if (at !== null) {
      var el = document.getElementById('b-' + at);
      if (el) el.scrollIntoView();
    }
    requestAnimationFrame(placeSidenotes);
  }

  if (parBtn && tpl) {
    parBtn.addEventListener('click', function () { setParallel(!article.classList.contains('parallel-on'), true); });
    if (location.hash === '#parallel') setParallel(true, false);
  }

  // Line-by-line highlight across languages in poems.
  if (article && article.getAttribute('data-kind') === 'poem') {
    article.addEventListener('mouseover', function (e) {
      var line = e.target.closest && e.target.closest('.parallel .line');
      article.querySelectorAll('.line.hl').forEach(function (l) { l.classList.remove('hl'); });
      if (!line) return;
      article.querySelectorAll('.parallel .line[data-line="' + line.getAttribute('data-line') + '"]').forEach(function (l) { l.classList.add('hl'); });
    });
    article.addEventListener('mouseleave', function () {
      article.querySelectorAll('.line.hl').forEach(function (l) { l.classList.remove('hl'); });
    });
  }

  window.addEventListener('resize', function () { requestAnimationFrame(placeSidenotes); });
  window.addEventListener('load', placeSidenotes);
  if (document.fonts && document.fonts.ready) document.fonts.ready.then(placeSidenotes);
  placeSidenotes();

  /* ---------- Archive filters ---------- */
  var chips = document.querySelectorAll('[data-filter]');
  var search = document.querySelector('[data-search]');
  if (chips.length) {
    var active = 'all';
    var params = new URLSearchParams(location.search);
    if (params.get('section')) active = params.get('section');
    var countEl = document.querySelector('[data-count]');
    var apply = function () {
      var q = (search && search.value || '').trim().toLowerCase();
      var shown = 0;
      document.querySelectorAll('.archive .row').forEach(function (r) {
        var ok = (active === 'all' || r.getAttribute('data-section') === active) &&
          (!q || r.getAttribute('data-title').indexOf(q) !== -1);
        r.hidden = !ok;
        if (ok) shown++;
      });
      document.querySelectorAll('[data-year]').forEach(function (y) {
        y.hidden = !y.querySelector('.row:not([hidden])');
      });
      chips.forEach(function (c) { c.setAttribute('aria-pressed', String(c.getAttribute('data-filter') === active)); });
      var empty = document.querySelector('[data-empty]');
      if (empty) empty.hidden = shown !== 0;
      if (countEl) countEl.textContent = shown === 1 ? countEl.getAttribute('data-one') : countEl.getAttribute('data-template').replace('{n}', shown);
      document.querySelectorAll('.nav a').forEach(function (a) {
        var m = a.getAttribute('href').match(/section=([a-z]+)/);
        if (m) { if (m[1] === active) a.setAttribute('aria-current', 'page'); else a.removeAttribute('aria-current'); }
      });
    };
    chips.forEach(function (c) {
      c.addEventListener('click', function () {
        active = c.getAttribute('data-filter');
        var url = active === 'all' ? location.pathname : location.pathname + '?section=' + active;
        if (history.replaceState) history.replaceState(null, '', url);
        apply();
      });
    });
    if (search) search.addEventListener('input', apply);
    apply();
  }
})();
