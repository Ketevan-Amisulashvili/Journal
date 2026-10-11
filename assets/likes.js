// Like button under each piece. One like per browser; click again to take it back.
(function () {
  'use strict';
  window.plVisitor = window.plVisitor || function () {
    var key = 'pl-visitor', v = '';
    try { v = localStorage.getItem(key) || ''; } catch (e) { /* not remembered */ }
    if (!/^[a-z0-9]{16,40}$/.test(v)) {
      var a = new Uint8Array(12);
      (window.crypto || window.msCrypto).getRandomValues(a);
      v = Array.prototype.map.call(a, function (b) { return ('0' + b.toString(16)).slice(-2); }).join('');
      try { localStorage.setItem(key, v); } catch (e) { /* not remembered */ }
    }
    return v;
  };

  var box = document.querySelector('[data-like-piece]');
  if (!box) return;
  var slug = box.getAttribute('data-slug');
  var btn = box.querySelector('[data-like]');
  var countEl = box.querySelector('[data-like-count]');
  var prompt = box.querySelector('[data-like-prompt]');
  var busy = false;

  function paint(d) {
    btn.setAttribute('aria-pressed', String(!!d.liked));
    btn.classList.toggle('on', !!d.liked);
    countEl.textContent = d.count ? String(d.count) : '';
    if (d.liked && prompt) prompt.textContent = prompt.getAttribute('data-thanks');
    box.hidden = false;
  }

  fetch('/api/likes?slug=' + encodeURIComponent(slug) + '&v=' + window.plVisitor())
    .then(function (r) { if (!r.ok) throw new Error(r.status); return r.json(); })
    .then(paint)
    .catch(function () { /* likes unavailable: keep the button hidden */ });

  btn.addEventListener('click', function () {
    if (busy) return;
    busy = true;
    var was = btn.getAttribute('aria-pressed') === 'true';
    var n = parseInt(countEl.textContent || '0', 10) + (was ? -1 : 1);
    paint({ liked: !was, count: Math.max(0, n) });
    if (!was) { btn.classList.remove('pop'); void btn.offsetWidth; btn.classList.add('pop'); }
    fetch('/api/likes', {
      method: 'POST',
      headers: { 'Content-Type': 'application/json' },
      body: JSON.stringify({ slug: slug, target: 'piece', v: window.plVisitor() }),
    }).then(function (r) { return r.ok ? r.json() : null; })
      .then(function (d) { if (d) paint(d); })
      .catch(function () {})
      .then(function () { busy = false; });
  });
})();
