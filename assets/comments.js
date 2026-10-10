// Reader discussion under each piece. Talks to /api/comments.
(function () {
  'use strict';
  var root = document.querySelector('[data-comments]');
  if (!root) return;
  var T = window.PL_COMMENTS || {};
  var slug = root.getAttribute('data-slug');
  var lang = root.getAttribute('data-lang');
  var countEl = document.querySelector('[data-comment-count]');
  var NAME_KEY = 'pl-comment-name';

  function el(tag, cls, text) {
    var e = document.createElement(tag);
    if (cls) e.className = cls;
    if (text !== undefined) e.textContent = text;
    return e;
  }
  function savedName() { try { return localStorage.getItem(NAME_KEY) || ''; } catch (e) { return ''; } }
  function saveName(v) { try { localStorage.setItem(NAME_KEY, v); } catch (e) { /* not remembered */ } }

  function fmt(iso) {
    try {
      return new Date(iso.replace(' ', 'T') + (iso.indexOf('Z') === -1 ? 'Z' : '')).toLocaleDateString(T.locale, { day: 'numeric', month: 'long', year: 'numeric' });
    } catch (e) { return iso; }
  }

  // Plain text only: paragraphs from blank lines, line breaks kept, links made clickable.
  function bodyNode(text) {
    var wrap = el('div', 'c-body');
    text.split(/\n{2,}/).forEach(function (para) {
      var p = el('p');
      para.split('\n').forEach(function (line, i) {
        if (i) p.appendChild(document.createElement('br'));
        var parts = line.split(/(https?:\/\/[^\s<]+[^\s<.,;:!?)\]'"])/g);
        parts.forEach(function (part, j) {
          if (j % 2) {
            var a = el('a', null, part);
            a.href = part; a.rel = 'nofollow ugc noopener'; a.target = '_blank';
            p.appendChild(a);
          } else if (part) p.appendChild(document.createTextNode(part));
        });
      });
      wrap.appendChild(p);
    });
    return wrap;
  }

  var list = el('ol', 'c-list');
  var status = el('p', 'c-status', T.loading);
  root.appendChild(status);

  function item(c, depth) {
    var li = el('li', 'c-item');
    li.id = 'c-' + c.id;
    var head = el('div', 'c-head');
    head.appendChild(el('span', 'c-name', c.name));
    if (c.is_author) head.appendChild(el('span', 'c-badge', T.author));
    var time = el('time', 'c-date', fmt(c.created_at));
    time.setAttribute('datetime', c.created_at);
    head.appendChild(time);
    li.appendChild(head);
    li.appendChild(bodyNode(c.body));
    var btn = el('button', 'c-reply-btn', T.reply);
    btn.type = 'button';
    btn.addEventListener('click', function () { openReply(li, depth === 0 ? c.id : c.parent_id, c.name); });
    li.appendChild(btn);
    if (c.children && c.children.length) {
      var ul = el('ol', 'c-children');
      c.children.forEach(function (ch) { ul.appendChild(item(ch, 1)); });
      li.appendChild(ul);
    }
    return li;
  }

  function render(comments) {
    var byId = {}, top = [];
    comments.forEach(function (c) { c.children = []; byId[c.id] = c; });
    comments.forEach(function (c) {
      if (c.parent_id && byId[c.parent_id]) byId[c.parent_id].children.push(c);
      else top.push(c);
    });
    list.innerHTML = '';
    top.forEach(function (c) { list.appendChild(item(c, 0)); });
    var n = comments.length;
    if (countEl) countEl.textContent = n ? (n === 1 ? T.countOne : T.count.replace('{n}', n)) : '';
    if (!n) { status.className = 'c-status'; status.textContent = T.empty; status.hidden = false; }
    else status.hidden = true;
  }

  function form(parentId, inline) {
    var f = el('form', 'c-form' + (inline ? ' inline' : ''));
    f.noValidate = true;
    var started = Date.now();
    var uid = Math.random().toString(36).slice(2, 8);

    var nameLabel = el('label');
    nameLabel.appendChild(document.createTextNode(T.name));
    var name = el('input');
    name.name = 'name'; name.maxLength = 60; name.required = true; name.autocomplete = 'name';
    name.placeholder = T.namePh; name.value = savedName(); name.id = 'cn-' + uid;
    nameLabel.appendChild(name);

    var bodyLabel = el('label');
    bodyLabel.appendChild(document.createTextNode(T.comment));
    var body = el('textarea');
    body.name = 'body'; body.maxLength = 5000; body.required = true; body.placeholder = T.bodyPh; body.id = 'cb-' + uid;
    bodyLabel.appendChild(body);

    // Hidden from people; bots tend to fill it in.
    var hp = el('label', 'hp');
    hp.setAttribute('aria-hidden', 'true');
    hp.appendChild(document.createTextNode('Website'));
    var hpInput = el('input');
    hpInput.name = 'website'; hpInput.tabIndex = -1; hpInput.autocomplete = 'off';
    hp.appendChild(hpInput);

    var actions = el('div', 'c-actions');
    var submit = el('button', 'btn', T.post);
    submit.type = 'submit';
    actions.appendChild(submit);
    var msg = el('p', 'c-status');
    msg.setAttribute('role', 'status');

    f.appendChild(nameLabel); f.appendChild(bodyLabel); f.appendChild(hp); f.appendChild(actions); f.appendChild(msg);

    f.addEventListener('submit', function (e) {
      e.preventDefault();
      var n = name.value.trim(), b = body.value.trim();
      msg.className = 'c-status error';
      if (!n || n.length > 60) { msg.textContent = T.errors.name; name.focus(); return; }
      if (b.length < 2 || b.length > 5000) { msg.textContent = T.errors.body; body.focus(); return; }
      submit.disabled = true; submit.textContent = T.posting; msg.textContent = '';
      fetch('/api/comments', {
        method: 'POST',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify({ slug: slug, name: n, body: b, parent_id: parentId || null, lang: lang, website: hpInput.value, elapsed: Date.now() - started }),
      }).then(function (r) {
        return r.json().catch(function () { return {}; }).then(function (data) { return { ok: r.ok, status: r.status, data: data }; });
      }).then(function (res) {
        submit.disabled = false; submit.textContent = T.post;
        if (!res.ok) {
          msg.className = 'c-status error';
          msg.textContent = res.status === 429 ? T.errors.rate : (T.errors[res.data.field] || T.errors.generic);
          return;
        }
        saveName(n);
        body.value = '';
        msg.className = 'c-status';
        if (res.data.status === 'pending') { msg.textContent = T.pending; return; }
        msg.textContent = T.posted;
        load(res.data.id);
        if (inline) f.remove();
      }).catch(function () {
        submit.disabled = false; submit.textContent = T.post;
        msg.className = 'c-status error'; msg.textContent = T.errors.generic;
      });
    });
    return { form: f, focus: function () { (name.value ? body : name).focus(); }, actions: actions };
  }

  var openForm = null;
  function openReply(li, parentId, toName) {
    if (openForm) openForm.remove();
    var r = form(parentId, true);
    var note = el('p', 'c-replying', T.replyingTo + ' ' + toName);
    r.form.insertBefore(note, r.form.firstChild);
    var cancel = el('button', 'btn quiet', T.cancel);
    cancel.type = 'button';
    cancel.addEventListener('click', function () { r.form.remove(); openForm = null; });
    r.actions.appendChild(cancel);
    var btn = li.querySelector(':scope > .c-reply-btn');
    li.insertBefore(r.form, btn.nextSibling);
    openForm = r.form;
    r.focus();
  }

  function load(scrollTo) {
    fetch('/api/comments?slug=' + encodeURIComponent(slug), { headers: { Accept: 'application/json' } })
      .then(function (r) { if (!r.ok) throw new Error(r.status); return r.json(); })
      .then(function (data) {
        render(data.comments || []);
        if (scrollTo) {
          var target = document.getElementById('c-' + scrollTo);
          if (target) target.scrollIntoView({ block: 'center' });
        }
      })
      .catch(function () {
        status.className = 'c-status error';
        status.textContent = T.unavailable;
        status.hidden = false;
      });
  }

  root.appendChild(list);
  root.appendChild(form(null, false).form);

  // Load comments only when the reader gets near them.
  if ('IntersectionObserver' in window) {
    var io = new IntersectionObserver(function (entries) {
      if (entries[0].isIntersecting) { io.disconnect(); load(); }
    }, { rootMargin: '600px' });
    io.observe(root);
  } else load();
})();
