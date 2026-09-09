/* Analysis Tutorium – gemeinsames Verhalten aller Seiten */
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

  /* Direkt nach dem Start einmal prüfen, was bereits im Bild steht */
  setTimeout(sweep, 60);

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
