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

  /* ---------- Einblenden beim Scrollen ---------- */
  var els = document.querySelectorAll('.reveal');
  if (reduce || !('IntersectionObserver' in window)) {
    els.forEach(function (e) { e.classList.add('in'); });
  } else {
    var io = new IntersectionObserver(function (entries) {
      entries.forEach(function (en) {
        if (en.isIntersecting) { en.target.classList.add('in'); io.unobserve(en.target); }
      });
    }, { threshold: 0, rootMargin: '0px 0px -8% 0px' });
    els.forEach(function (e) { io.observe(e); });

    /* Sicherheitsnetz: Elemente, die (z. B. nach Sprung per Anker) bereits im
       Bild stehen, aber noch nicht eingeblendet wurden, nach kurzer Zeit zeigen. */
    var sweep = function () {
      var vh = window.innerHeight || document.documentElement.clientHeight;
      els.forEach(function (e) {
        if (e.classList.contains('in')) return;
        var r = e.getBoundingClientRect();
        if (r.bottom > 0 && r.top < vh) e.classList.add('in');
      });
    };
    window.addEventListener('load', function () { setTimeout(sweep, 400); });
    window.addEventListener('hashchange', function () { setTimeout(sweep, 300); });
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
