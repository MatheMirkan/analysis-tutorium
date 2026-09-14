/* Mathematik-Tutorium – gemeinsames Verhalten aller Seiten */
(function () {
  'use strict';

  var reduce = window.matchMedia('(prefers-reduced-motion: reduce)').matches;

  /* ---------- Mobile Navigation ---------- */
  var toggle = document.getElementById('navToggle');
  var links = document.getElementById('navlinks');
  if (toggle && links) {
    var setOpen = function (open) {
      links.classList.toggle('open', open);
      toggle.classList.toggle('open', open);
      toggle.setAttribute('aria-expanded', open ? 'true' : 'false');
      toggle.setAttribute('aria-label', open ? 'Menü schließen' : 'Menü öffnen');
    };
    toggle.addEventListener('click', function () {
      setOpen(!links.classList.contains('open'));
    });
    links.querySelectorAll('a').forEach(function (a) {
      a.addEventListener('click', function () { setOpen(false); });
    });
    document.addEventListener('keydown', function (e) {
      if (e.key === 'Escape' && links.classList.contains('open')) { setOpen(false); toggle.focus(); }
    });
    document.addEventListener('click', function (e) {
      if (links.classList.contains('open') && !links.contains(e.target) && !toggle.contains(e.target)) setOpen(false);
    });
  }

  /* ---------- Jahreszahl im Footer ---------- */
  document.querySelectorAll('[data-year]').forEach(function (el) {
    el.textContent = new Date().getFullYear();
  });

  /* ---------- Sichtbarkeit: einmalig auslösen, sobald ein Element ins Bild kommt ----------
     Nutzt IntersectionObserver und zusätzlich eine einfache Prüfung bei Laden, Scrollen
     und Größenänderung – so wird nichts übersehen, auch nicht nach Ankersprüngen. */
  var pending = [];
  var inView = function (el, margin) {
    var r = el.getBoundingClientRect();
    var vh = window.innerHeight || document.documentElement.clientHeight;
    return r.bottom > 0 && r.top < vh - (margin || 0) && r.width > 0;
  };
  var whenVisible = function (el, cb, margin) {
    var entry = { el: el, cb: cb, margin: margin || 0, done: false };
    pending.push(entry);
    if ('IntersectionObserver' in window) {
      var io = new IntersectionObserver(function (entries) {
        entries.forEach(function (en) {
          if (en.isIntersecting && !entry.done) { entry.done = true; io.disconnect(); cb(); }
        });
      }, { threshold: 0, rootMargin: '0px 0px -' + entry.margin + 'px 0px' });
      io.observe(el);
    }
  };
  var sweep = function () {
    pending.forEach(function (entry) {
      if (!entry.done && inView(entry.el, entry.margin)) { entry.done = true; entry.cb(); }
    });
  };
  var scheduled = false;
  var scheduleSweep = function () {
    if (scheduled) return;
    scheduled = true;
    setTimeout(function () { scheduled = false; sweep(); }, 120);
  };
  window.addEventListener('scroll', scheduleSweep, { passive: true });
  window.addEventListener('resize', scheduleSweep);
  window.addEventListener('hashchange', function () { setTimeout(sweep, 300); });
  window.addEventListener('load', function () { setTimeout(sweep, 400); });

  /* ---------- Einblenden beim Scrollen ---------- */
  var els = document.querySelectorAll('.reveal');
  if (reduce) {
    els.forEach(function (e) { e.classList.add('in'); });
  } else {
    els.forEach(function (e) {
      whenVisible(e, function () { e.classList.add('in'); }, Math.round(window.innerHeight * 0.08));
    });
  }

  /* ---------- Kennzahlen hochzählen ---------- */
  var stats = document.querySelectorAll('.stat-num[data-count-card]');
  if (stats.length) {
    var cards = document.querySelectorAll('.matcard');
    var runCount = function (el, target) {
      if (reduce) { el.textContent = target; return; }
      var start = Date.now(), dur = 1100;
      var step = function () {
        var p = Math.min(1, (Date.now() - start) / dur);
        var eased = 1 - Math.pow(1 - p, 3);
        el.textContent = Math.round(target * eased);
        if (p < 1) setTimeout(step, 32);
      };
      step();
    };
    stats.forEach(function (el) {
      var card = cards[parseInt(el.getAttribute('data-count-card'), 10)];
      var n = card ? card.querySelectorAll('.matlink').length : 0;
      el.setAttribute('data-target', n);
      el.textContent = reduce ? n : '0';
      whenVisible(el, function () { runCount(el, n); }, 40);
    });
  }

  /* ---------- Kapitel-Skizzen: blättern und automatisch weiterlaufen ---------- */
  document.querySelectorAll('.sketch-frame').forEach(function (frame) {
    var sketches = frame.querySelectorAll('.sketch-stage .sketch');
    var dots = frame.querySelectorAll('.sk-dot');
    var capL = frame.querySelector('.sk-cap-l');
    var capR = frame.querySelector('.sk-cap-r b');
    if (sketches.length < 2) return;
    var cur = 0, timer = null, paused = false;
    var show = function (i) {
      i = (i + sketches.length) % sketches.length;
      sketches[cur].classList.remove('is-active');
      dots[cur].classList.remove('is-on');
      cur = i;
      var el = sketches[cur];
      el.classList.add('is-active');
      void el.offsetWidth; /* Animation neu starten */
      dots[cur].classList.add('is-on');
      if (capL) capL.textContent = 'Skizze · Kapitel ' + el.getAttribute('data-num');
      if (capR) capR.textContent = el.getAttribute('data-title');
    };
    var restart = function () {
      if (timer) clearInterval(timer);
      if (reduce || paused) return;
      timer = setInterval(function () { show(cur + 1); }, 7000);
    };
    dots.forEach(function (d, i) { d.addEventListener('click', function () { show(i); restart(); }); });
    var prev = frame.querySelector('.sk-prev'), next = frame.querySelector('.sk-next');
    if (prev) prev.addEventListener('click', function () { show(cur - 1); restart(); });
    if (next) next.addEventListener('click', function () { show(cur + 1); restart(); });
    frame.addEventListener('mouseenter', function () { paused = true; restart(); });
    frame.addEventListener('mouseleave', function () { paused = false; restart(); });
    frame.addEventListener('focusin', function () { paused = true; restart(); });
    frame.addEventListener('focusout', function () { paused = false; restart(); });
    document.addEventListener('visibilitychange', function () { if (document.hidden) { if (timer) clearInterval(timer); } else restart(); });
    /* erst starten, wenn die Skizze im Bild ist */
    whenVisible(frame, function () { restart(); }, 0);
  });

  /* ---------- Materialsuche: Liste beim Tippen filtern ---------- */
  document.querySelectorAll('.matsearch').forEach(function (box) {
    var input = box.querySelector('input');
    var status = box.querySelector('.matsearch-status');
    var items = Array.prototype.slice.call(document.querySelectorAll('.matlist li'));
    var cards = Array.prototype.slice.call(document.querySelectorAll('.matcard'));
    if (!input) return;
    if (!items.length) {
      input.disabled = true;
      input.placeholder = 'Suche wird aktiv, sobald Materialien online sind';
      return;
    }
    var norm = function (s) { return s.toLowerCase().replace(/ä/g, 'ae').replace(/ö/g, 'oe').replace(/ü/g, 'ue').replace(/ß/g, 'ss'); };
    items.forEach(function (li) { li.setAttribute('data-s', norm(li.textContent.replace(/\s+/g, ' '))); });
    var apply = function () {
      var q = norm(input.value.trim());
      var hits = 0;
      items.forEach(function (li) {
        var show = !q || li.getAttribute('data-s').indexOf(q) >= 0;
        li.hidden = !show;
        if (show) hits++;
      });
      cards.forEach(function (card) {
        var list = card.querySelector('.matlist');
        if (!list) return;
        var visible = list.querySelectorAll('li:not([hidden])').length;
        var note = card.querySelector('.matsearch-empty');
        if (!note) { note = document.createElement('p'); note.className = 'matsearch-empty'; note.textContent = 'Keine Treffer in diesem Abschnitt.'; list.parentNode.insertBefore(note, list.nextSibling); }
        note.hidden = !(q && visible === 0);
      });
      box.classList.toggle('is-active', !!q);
      if (status) status.textContent = q ? (hits === 1 ? '1 Treffer' : hits + ' Treffer') + ' für „' + input.value.trim() + '“' : '';
    };
    input.addEventListener('input', apply);
    input.addEventListener('search', apply);
    document.addEventListener('keydown', function (e) {
      if (e.key === '/' && document.activeElement !== input && !/INPUT|TEXTAREA/.test(document.activeElement.tagName)) { e.preventDefault(); input.focus(); }
    });
  });

  /* Direkt nach dem Start einmal prüfen, was bereits im Bild steht */
  setTimeout(sweep, 60);

  /* ---------- Vorschau: Aufbau-Overlay mit #vorschau ausblenden (für Mirkan) ---------- */
  var wartung = document.getElementById('wartung');
  if (wartung) {
    var key = 'vorschau:' + location.pathname;
    var wanted = location.hash === '#vorschau';
    var remembered = false;
    try { remembered = sessionStorage.getItem(key) === '1'; } catch (e) {}
    if (wanted) { try { sessionStorage.setItem(key, '1'); } catch (e) {} }
    if (wanted || remembered) {
      wartung.remove();
      var tag = document.createElement('div');
      tag.className = 'vorschau-tag';
      tag.textContent = 'Vorschau – nicht öffentlich';
      document.body.appendChild(tag);
    }
  }

  /* ---------- Intro-Overlay (nur Startseite) ---------- */
  var intro = document.getElementById('intro');
  if (intro) {
    document.body.classList.add('intro-lock');
    var dismissed = false;
    var dismiss = function () {
      if (dismissed) return;
      dismissed = true;
      document.body.classList.remove('intro-lock');
      if (intro.parentNode) intro.remove();
    };
    if (reduce) {
      setTimeout(dismiss, 1400);
    } else {
      intro.addEventListener('animationend', function (e) {
        if (e.target === intro && e.animationName.indexOf('intro-hide') === 0) dismiss();
      });
      setTimeout(dismiss, 4200);
    }
    intro.addEventListener('click', dismiss);
    window.addEventListener('keydown', dismiss, { once: true });
    window.addEventListener('wheel', dismiss, { once: true, passive: true });
    window.addEventListener('touchstart', dismiss, { once: true, passive: true });
  }
})();
