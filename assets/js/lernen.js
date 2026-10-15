/* Mathematik-Tutorium – Lern-Engine für Analysis III und Lineare Algebra I
   Bausteine: Formelsatz (KaTeX, lokal), Wissens-Checks, Klausurmodus,
   interaktive Skizzen, Lernpfad-Fortschritt (nur im Browser gespeichert). */
(function () {
  'use strict';

  var reduce = window.matchMedia('(prefers-reduced-motion: reduce)').matches;
  var PAGE = (location.pathname.split('/').pop() || 'seite').replace('.html', '');

  /* ---------- Hilfen ---------- */
  function el(tag, cls, html) {
    var e = document.createElement(tag);
    if (cls) e.className = cls;
    if (html !== undefined) e.innerHTML = html;
    return e;
  }
  function shuffle(arr) {
    var a = arr.slice();
    for (var i = a.length - 1; i > 0; i--) { var j = Math.floor(Math.random() * (i + 1)); var t = a[i]; a[i] = a[j]; a[j] = t; }
    return a;
  }
  function store(key, val) { try { localStorage.setItem(key, JSON.stringify(val)); } catch (e) {} }
  function load(key) { try { var v = localStorage.getItem(key); return v ? JSON.parse(v) : null; } catch (e) { return null; } }
  function math(root) {
    if (window.renderMathInElement) {
      try {
        renderMathInElement(root, { delimiters: [{ left: '\\(', right: '\\)', display: false }, { left: '\\[', right: '\\]', display: true }], throwOnError: false });
      } catch (e) {}
    }
  }
  function fmt(x) { return (Math.round(x * 100) / 100).toString().replace('.', ','); }
  function mmss(sec) { var m = Math.floor(sec / 60), s = sec % 60; return m + ':' + (s < 10 ? '0' : '') + s; }
  function readPool(box) {
    var dataEl = box.querySelector('script[type="application/json"]');
    if (!dataEl) return [];
    try { return JSON.parse(dataEl.textContent); } catch (e) { return []; }
  }

  /* ---------- Lernpfad-Fortschritt ---------- */
  function progressKey(id) { return 'lernpfad:' + PAGE + ':' + id; }
  function updateLernpfad() {
    var bar = document.querySelector('.lernpfad');
    if (!bar) return;
    var chips = bar.querySelectorAll('.lp-chip[data-quiz]');
    var done = 0;
    chips.forEach(function (c) {
      var best = load(progressKey(c.getAttribute('data-quiz')));
      var ok = best && best.ratio >= 0.8;
      c.classList.toggle('is-done', !!ok);
      c.classList.toggle('is-started', !!best && !ok);
      if (ok) done++;
    });
    var fill = bar.querySelector('.lp-fill');
    var txt = bar.querySelector('.lp-text');
    if (fill) fill.style.width = (chips.length ? (done / chips.length) * 100 : 0) + '%';
    if (txt) txt.textContent = done + ' von ' + chips.length + ' Wissens-Checks bestanden';
    updateKlausurBest();
  }
  document.querySelectorAll('.lp-reset').forEach(function (b) {
    b.addEventListener('click', function () {
      document.querySelectorAll('.lp-chip[data-quiz]').forEach(function (c) { try { localStorage.removeItem(progressKey(c.getAttribute('data-quiz'))); } catch (e) {} });
      try { localStorage.removeItem(progressKey('klausur')); } catch (e) {}
      updateLernpfad();
    });
  });
  document.querySelectorAll('.lp-chip[data-quiz]').forEach(function (c) {
    c.addEventListener('click', function () {
      var target = document.getElementById('check-' + c.getAttribute('data-quiz'));
      if (target) target.scrollIntoView({ behavior: reduce ? 'auto' : 'smooth', block: 'start' });
    });
  });

  /* ---------- Fragen-Engine (Wissens-Check und Klausurmodus) ----------
     opts.exam: kein Feedback zwischendurch, Uhr läuft, Auswertung am Ende. */
  function buildQuiz(host, questions, opts) {
    opts = opts || {};
    var id = opts.id || 'check';
    var order, idx, correct, answered, given, startTime, timerEl, timerHandle;
    var ui = el('div', 'qz');
    host.appendChild(ui);

    function start() {
      order = shuffle(questions.map(function (_, i) { return i; }));
      idx = 0; correct = 0; answered = []; given = [];
      startTime = Date.now();
      if (opts.exam) {
        if (timerHandle) clearInterval(timerHandle);
        timerHandle = setInterval(function () { if (timerEl) timerEl.textContent = mmss(Math.round((Date.now() - startTime) / 1000)); }, 1000);
      }
      renderQuestion();
    }

    function renderQuestion() {
      var q = questions[order[idx]];
      ui.innerHTML = '';
      var head = el('div', 'qz-head');
      head.appendChild(el('span', 'qz-count', 'Frage ' + (idx + 1) + ' von ' + questions.length));
      if (opts.exam) {
        timerEl = el('span', 'qz-timer', mmss(Math.round((Date.now() - startTime) / 1000)));
        timerEl.setAttribute('aria-label', 'Verstrichene Zeit');
        head.appendChild(timerEl);
      } else {
        var dots = el('span', 'qz-dots');
        order.forEach(function (_, i) {
          dots.appendChild(el('i', 'qz-dot' + (i < idx ? (answered[i] ? ' ok' : ' no') : (i === idx ? ' now' : ''))));
        });
        head.appendChild(dots);
      }
      ui.appendChild(head);

      var typeLabel = { mc: 'Eine Antwort ist richtig', multi: 'Mehrere Antworten können richtig sein', tf: 'Wahr oder falsch?', num: 'Zahl eingeben' }[q.type];
      ui.appendChild(el('p', 'qz-type', typeLabel));
      ui.appendChild(el('div', 'qz-q', q.q));

      var form = el('form', 'qz-form');
      form.setAttribute('novalidate', '');
      if (q.type === 'mc' || q.type === 'multi') {
        shuffle(q.options.map(function (o, i) { return { text: o, i: i }; })).forEach(function (it, k) {
          var lab = el('label', 'qz-opt');
          var inp = el('input');
          inp.type = q.type === 'mc' ? 'radio' : 'checkbox';
          inp.name = 'q'; inp.value = it.i; inp.id = id + '-' + idx + '-' + k;
          lab.appendChild(inp); lab.appendChild(el('span', 'qz-mark')); lab.appendChild(el('span', 'qz-opt-text', it.text));
          form.appendChild(lab);
        });
      } else if (q.type === 'tf') {
        [['true', 'Wahr'], ['false', 'Falsch']].forEach(function (pair, k) {
          var lab = el('label', 'qz-opt qz-opt-tf');
          var inp = el('input'); inp.type = 'radio'; inp.name = 'q'; inp.value = pair[0]; inp.id = id + '-' + idx + '-' + k;
          lab.appendChild(inp); lab.appendChild(el('span', 'qz-mark')); lab.appendChild(el('span', 'qz-opt-text', pair[1]));
          form.appendChild(lab);
        });
      } else if (q.type === 'num') {
        var wrap = el('div', 'qz-num');
        var inp = el('input'); inp.type = 'text'; inp.inputMode = 'decimal'; inp.name = 'q'; inp.autocomplete = 'off';
        inp.setAttribute('aria-label', 'Antwort'); inp.placeholder = q.placeholder || 'Zahl';
        wrap.appendChild(inp);
        if (q.unit) wrap.appendChild(el('span', 'qz-unit', q.unit));
        form.appendChild(wrap);
        setTimeout(function () { inp.focus(); }, 50);
      }
      var actions = el('div', 'qz-actions');
      var check = el('button', 'btn btn-primary qz-check', opts.exam ? (idx + 1 < questions.length ? 'Weiter <span class="arr" aria-hidden="true">→</span>' : 'Abgeben <span class="arr" aria-hidden="true">→</span>') : 'Prüfen');
      check.type = 'submit';
      actions.appendChild(check);
      form.appendChild(actions);
      ui.appendChild(form);
      var fb = el('div', 'qz-fb');
      ui.appendChild(fb);
      math(ui);

      form.addEventListener('submit', function (e) {
        e.preventDefault();
        var ok = evaluate(q, form);
        if (ok === null) { fb.className = 'qz-fb is-hint'; fb.innerHTML = 'Bitte wähle eine Antwort.'; return; }
        answered[idx] = ok;
        if (ok) correct++;
        if (opts.exam) {
          idx++;
          if (idx < questions.length) renderQuestion(); else renderSummary();
          return;
        }
        form.querySelectorAll('input').forEach(function (i) { i.disabled = true; });
        markOptions(q, form);
        check.disabled = true;
        fb.className = 'qz-fb ' + (ok ? 'is-ok' : 'is-no');
        fb.innerHTML = '<strong>' + (ok ? 'Richtig.' : 'Nicht ganz.') + '</strong> ' + (q.why || '') + (ok ? '' : ' <span class="qz-sol">' + solutionText(q) + '</span>');
        var next = el('button', 'btn btn-ghost qz-next', idx + 1 < questions.length ? 'Weiter <span class="arr" aria-hidden="true">→</span>' : 'Auswertung <span class="arr" aria-hidden="true">→</span>');
        next.type = 'button';
        next.addEventListener('click', function () { idx++; if (idx < questions.length) renderQuestion(); else renderSummary(); });
        fb.appendChild(next);
        math(fb);
        next.focus();
      });
    }

    function evaluate(q, form) {
      if (q.type === 'mc') {
        var c = form.querySelector('input:checked'); if (!c) return null;
        return parseInt(c.value, 10) === q.answer;
      }
      if (q.type === 'multi') {
        var chosen = Array.prototype.map.call(form.querySelectorAll('input:checked'), function (i) { return parseInt(i.value, 10); }).sort();
        if (!chosen.length) return null;
        var want = q.answer.slice().sort();
        return chosen.length === want.length && chosen.every(function (v, i) { return v === want[i]; });
      }
      if (q.type === 'tf') {
        var t = form.querySelector('input:checked'); if (!t) return null;
        return (t.value === 'true') === !!q.answer;
      }
      if (q.type === 'num') {
        var raw = form.querySelector('input').value.trim().replace(',', '.');
        if (!raw) return null;
        var v = parseFloat(raw); if (isNaN(v)) return false;
        return Math.abs(v - q.answer) <= (q.tol !== undefined ? q.tol : 1e-6);
      }
      return null;
    }

    function markOptions(q, form) {
      form.querySelectorAll('.qz-opt').forEach(function (lab) {
        var inp = lab.querySelector('input');
        var isRight;
        if (q.type === 'mc') isRight = parseInt(inp.value, 10) === q.answer;
        else if (q.type === 'multi') isRight = q.answer.indexOf(parseInt(inp.value, 10)) >= 0;
        else if (q.type === 'tf') isRight = (inp.value === 'true') === !!q.answer;
        if (isRight) lab.classList.add('is-right');
        if (inp.checked && !isRight) lab.classList.add('is-wrong');
      });
    }

    function solutionText(q) {
      if (q.type === 'num') return 'Richtige Antwort: ' + String(q.answer).replace('.', ',') + (q.unit ? ' ' + q.unit : '') + '.';
      if (q.type === 'tf') return 'Richtig wäre: ' + (q.answer ? 'wahr' : 'falsch') + '.';
      if (q.type === 'mc') return 'Richtig wäre: ' + q.options[q.answer];
      if (q.type === 'multi') return 'Richtig wären: ' + q.answer.map(function (i) { return q.options[i]; }).join(' · ');
      return '';
    }

    function renderSummary() {
      var ratio = correct / questions.length;
      var secs = Math.round((Date.now() - startTime) / 1000);
      if (timerHandle) clearInterval(timerHandle);
      var key = progressKey(opts.exam ? 'klausur' : id);
      var prev = load(key);
      if (!prev || ratio > prev.ratio || (ratio === prev.ratio && opts.exam && secs < (prev.secs || 1e9))) store(key, { ratio: ratio, secs: secs, n: questions.length, date: new Date().toISOString().slice(0, 10) });
      updateLernpfad();
      ui.innerHTML = '';
      var s = el('div', 'qz-sum');
      s.appendChild(el('div', 'qz-score', '<span>' + correct + '</span><small>/ ' + questions.length + '</small>'));
      if (opts.exam) s.appendChild(el('p', 'qz-time', 'Zeit: ' + mmss(secs) + ' · ' + Math.round(ratio * 100) + ' %'));
      var msg = ratio >= 0.8 ? 'Sehr gut – das sitzt.' : ratio >= 0.5 ? 'Solide Basis. Schau dir die offenen Punkte unten noch einmal an.' : 'Noch Luft nach oben – die Verständnisboxen helfen beim zweiten Anlauf.';
      s.appendChild(el('p', 'qz-msg', msg));
      var list = el('ol', 'qz-review');
      order.forEach(function (qi, i) {
        var q = questions[qi];
        var li = el('li', answered[i] ? 'ok' : 'no', '<span class="qz-rv-q">' + q.q + '</span>');
        if (opts.exam && !answered[i]) li.appendChild(el('span', 'qz-rv-why', solutionText(q) + ' ' + (q.why || '')));
        list.appendChild(li);
      });
      s.appendChild(list);
      var again = el('button', 'btn btn-primary', (opts.exam ? 'Neue Klausur' : 'Nochmal mischen') + ' <span class="arr" aria-hidden="true">↻</span>');
      again.type = 'button';
      again.addEventListener('click', function () { if (opts.onRestart) opts.onRestart(); else start(); });
      s.appendChild(again);
      ui.appendChild(s);
      math(ui);
      if (opts.onDone) opts.onDone({ correct: correct, total: questions.length, secs: secs });
    }

    start();
    return { restart: start };
  }

  document.querySelectorAll('.quiz').forEach(function (box) {
    var pool = readPool(box);
    if (pool.length) buildQuiz(box, pool, { id: box.getAttribute('data-quiz-id') || 'check' });
  });

  /* ---------- Klausurmodus: zufällige Fragen aus allen Checks der Seite ---------- */
  function updateKlausurBest() {
    var k = document.querySelector('.klausur');
    if (!k) return;
    var best = load(progressKey('klausur'));
    var elBest = k.querySelector('[data-k="best"]');
    if (elBest) elBest.textContent = best ? 'Bestes Ergebnis: ' + Math.round(best.ratio * best.n) + ' von ' + best.n + ' in ' + mmss(best.secs || 0) : 'Noch kein Versuch.';
  }
  document.querySelectorAll('.klausur').forEach(function (k) {
    var pool = [];
    document.querySelectorAll('.quiz').forEach(function (box) { pool = pool.concat(readPool(box)); });
    var n = Math.min(10, pool.length);
    var elPool = k.querySelector('[data-k="pool"]');
    if (elPool) elPool.textContent = pool.length ? n + ' Fragen pro Durchgang · Fragenpool: ' + pool.length : 'Noch keine Fragen freigeschaltet.';
    var startBtn = k.querySelector('.klausur-start');
    var stage = k.querySelector('.klausur-stage');
    if (!pool.length && startBtn) startBtn.disabled = true;
    var run = function () {
      stage.hidden = false;
      stage.innerHTML = '';
      startBtn.hidden = true;
      buildQuiz(stage, shuffle(pool).slice(0, n), { id: 'klausur', exam: true, onRestart: run });
      stage.scrollIntoView({ behavior: reduce ? 'auto' : 'smooth', block: 'start' });
    };
    if (startBtn) startBtn.addEventListener('click', run);
  });

  /* ---------- Interaktive Skizze: Matrix als Abbildung der Ebene ---------- */
  function matrixExplorable(host) {
    var W = 440, H = 320, cx = 220, cy = 160, u = 36, R = 5;
    host.innerHTML =
      '<div class="ex-grid">' +
      '<svg class="ex-svg" viewBox="0 0 ' + W + ' ' + H + '" role="img" aria-label="Die Ebene mit Gitter, das durch die Matrix A verzerrt wird"></svg>' +
      '<div class="ex-panel">' +
      '<div class="ex-matrix"><span class="ex-brk">[</span><div class="ex-cells">' +
      ['a', 'b', 'c', 'd'].map(function (k) { return '<label>' + k + '<input type="range" min="-2" max="2" step="0.1" data-k="' + k + '"><output data-o="' + k + '"></output></label>'; }).join('') +
      '</div><span class="ex-brk">]</span></div>' +
      '<div class="ex-presets">' + [['id', 'Identität'], ['rot', 'Drehung 45°'], ['shear', 'Scherung'], ['mirror', 'Spiegelung'], ['proj', 'Projektion'], ['scale', 'Streckung']].map(function (p) { return '<button type="button" data-preset="' + p[0] + '">' + p[1] + '</button>'; }).join('') + '</div>' +
      '<dl class="ex-read"><dt>det A</dt><dd data-r="det"></dd><dt>Fläche des Bildes von [0,1]²</dt><dd data-r="area"></dd><dt>Eigenwerte</dt><dd data-r="eig"></dd></dl>' +
      '<p class="ex-hint" data-r="hint"></p>' +
      '</div></div>';
    var svg = host.querySelector('svg');
    var ins = {}; host.querySelectorAll('input[type=range]').forEach(function (i) { ins[i.getAttribute('data-k')] = i; });
    var outs = {}; host.querySelectorAll('output').forEach(function (o) { outs[o.getAttribute('data-o')] = o; });
    var reads = {}; host.querySelectorAll('[data-r]').forEach(function (r) { reads[r.getAttribute('data-r')] = r; });
    var presets = { id: [1, 0, 0, 1], rot: [0.71, -0.71, 0.71, 0.71], shear: [1, 1, 0, 1], mirror: [1, 0, 0, -1], proj: [1, 0.5, 0, 0], scale: [1.5, 0, 0, 0.6] };
    function P(x, y) { return [cx + x * u, cy - y * u]; }
    function line(p, q, cls) { return '<line class="' + cls + '" x1="' + p[0].toFixed(1) + '" y1="' + p[1].toFixed(1) + '" x2="' + q[0].toFixed(1) + '" y2="' + q[1].toFixed(1) + '"/>'; }
    function arrow(p, q, cls) {
      var dx = q[0] - p[0], dy = q[1] - p[1], n = Math.hypot(dx, dy);
      if (n < 1) return '';
      var ux = dx / n, uy = dy / n, hx = q[0] - ux * 9, hy = q[1] - uy * 9;
      return line(p, q, cls) + '<polygon class="' + cls + '-head" points="' + q[0].toFixed(1) + ',' + q[1].toFixed(1) + ' ' + (hx - uy * 4).toFixed(1) + ',' + (hy + ux * 4).toFixed(1) + ' ' + (hx + uy * 4).toFixed(1) + ',' + (hy - ux * 4).toFixed(1) + '"/>';
    }
    function draw() {
      var a = +ins.a.value, b = +ins.b.value, c = +ins.c.value, d = +ins.d.value;
      ['a', 'b', 'c', 'd'].forEach(function (k) { outs[k].value = fmt(+ins[k].value); });
      var T = function (x, y) { return [a * x + b * y, c * x + d * y]; };
      var s = '';
      for (var i = -R; i <= R; i++) {
        var p1 = T(i, -R), p2 = T(i, R), q1 = T(-R, i), q2 = T(R, i);
        var cls = i === 0 ? 'ex-axis' : 'ex-line';
        s += line(P(p1[0], p1[1]), P(p2[0], p2[1]), cls) + line(P(q1[0], q1[1]), P(q2[0], q2[1]), cls);
      }
      var sq = [T(0, 0), T(1, 0), T(1, 1), T(0, 1)].map(function (p) { return P(p[0], p[1]); });
      s += '<polygon class="ex-square" points="' + sq.map(function (p) { return p[0].toFixed(1) + ',' + p[1].toFixed(1); }).join(' ') + '"/>';
      var det = a * d - b * c, tr = a + d, disc = tr * tr - 4 * det, eigTxt;
      if (disc >= -1e-9) {
        var sq2 = Math.sqrt(Math.max(disc, 0)), l1 = (tr + sq2) / 2, l2 = (tr - sq2) / 2;
        eigTxt = 'λ₁ = ' + fmt(l1) + ', λ₂ = ' + fmt(l2);
        [l1, l2].forEach(function (l) {
          var v = Math.abs(b) > 1e-9 ? [b, l - a] : (Math.abs(c) > 1e-9 ? [l - d, c] : (Math.abs(a - l) < 1e-9 ? [1, 0] : [0, 1]));
          var nn = Math.hypot(v[0], v[1]) || 1; v = [v[0] / nn * R * 1.4, v[1] / nn * R * 1.4];
          s += line(P(-v[0], -v[1]), P(v[0], v[1]), 'ex-eig');
        });
      } else {
        eigTxt = 'keine reellen Eigenwerte (Drehanteil)';
      }
      var e1 = T(1, 0), e2 = T(0, 1);
      s += arrow(P(0, 0), P(e1[0], e1[1]), 'ex-e1') + arrow(P(0, 0), P(e2[0], e2[1]), 'ex-e2');
      s += '<text class="ex-lbl" x="' + (P(e1[0], e1[1])[0] + 6) + '" y="' + (P(e1[0], e1[1])[1] - 6) + '">A·e₁</text>';
      s += '<text class="ex-lbl" x="' + (P(e2[0], e2[1])[0] + 6) + '" y="' + (P(e2[0], e2[1])[1] - 6) + '">A·e₂</text>';
      svg.innerHTML = s;
      reads.det.textContent = fmt(det);
      reads.area.textContent = fmt(Math.abs(det));
      reads.eig.textContent = eigTxt;
      reads.hint.textContent = Math.abs(det) < 1e-9 ? 'det A = 0: Die Ebene wird auf eine Gerade (oder einen Punkt) gedrückt – A ist nicht invertierbar.' : det < 0 ? 'det A < 0: Die Orientierung kippt – das Bild des Quadrats ist gespiegelt.' : 'det A > 0: Orientierung bleibt erhalten, |det A| ist der Flächenfaktor.';
    }
    function set(vals) { ['a', 'b', 'c', 'd'].forEach(function (k, i) { ins[k].value = vals[i]; }); draw(); }
    host.querySelectorAll('input[type=range]').forEach(function (i) { i.addEventListener('input', draw); });
    host.querySelectorAll('[data-preset]').forEach(function (btn) { btn.addEventListener('click', function () { set(presets[btn.getAttribute('data-preset')]); }); });
    set(presets.shear);
  }

  /* ---------- Interaktive Skizze: Richtungsfeld einer Differentialgleichung ---------- */
  function odeExplorable(host) {
    var W = 440, H = 300, xmin = -3, xmax = 3, ymin = -3, ymax = 3;
    var sx = W / (xmax - xmin), sy = H / (ymax - ymin);
    var odes = {
      growth: { label: "y' = y", f: function (x, y) { return y; } },
      logistic: { label: "y' = y (1 − y)", f: function (x, y) { return y * (1 - y); } },
      linear: { label: "y' = x − y", f: function (x, y) { return x - y; } },
      forced: { label: "y' = −y + sin x", f: function (x, y) { return -y + Math.sin(x); } },
      square: { label: "y' = y²", f: function (x, y) { return y * y; } }
    };
    host.innerHTML =
      '<div class="ex-grid">' +
      '<svg class="ex-svg" viewBox="0 0 ' + W + ' ' + H + '" role="img" aria-label="Richtungsfeld einer Differentialgleichung mit einer Lösungskurve"></svg>' +
      '<div class="ex-panel">' +
      '<div class="ex-presets">' + Object.keys(odes).map(function (k) { return '<button type="button" data-ode="' + k + '">' + odes[k].label + '</button>'; }).join('') + '</div>' +
      '<label class="ex-slider">Anfangswert y(0)<input type="range" min="-3" max="3" step="0.1" value="0.5" data-k="y0"><output></output></label>' +
      '<dl class="ex-read"><dt>Gleichung</dt><dd data-r="eq"></dd><dt>Lösung durch (0, y₀)</dt><dd data-r="sol"></dd></dl>' +
      '<p class="ex-hint" data-r="hint"></p>' +
      '</div></div>';
    var svg = host.querySelector('svg'), slider = host.querySelector('input[type=range]'), out = host.querySelector('output');
    var reads = {}; host.querySelectorAll('[data-r]').forEach(function (r) { reads[r.getAttribute('data-r')] = r; });
    var cur = 'logistic';
    function P(x, y) { return [(x - xmin) * sx, (ymax - y) * sy]; }
    function draw() {
      var f = odes[cur].f, y0 = +slider.value; out.value = fmt(y0);
      var s = '';
      var ax = P(0, 0);
      s += '<line class="ex-axis" x1="0" y1="' + ax[1] + '" x2="' + W + '" y2="' + ax[1] + '"/><line class="ex-axis" x1="' + ax[0] + '" y1="0" x2="' + ax[0] + '" y2="' + H + '"/>';
      for (var i = 0; i <= 14; i++) for (var j = 0; j <= 14; j++) {
        var x = xmin + (xmax - xmin) * i / 14, y = ymin + (ymax - ymin) * j / 14;
        var m = f(x, y), ang = Math.atan2(-m * sy, sx), L = 7;
        var p = P(x, y);
        s += '<line class="ex-field" x1="' + (p[0] - Math.cos(ang) * L).toFixed(1) + '" y1="' + (p[1] - Math.sin(ang) * L).toFixed(1) + '" x2="' + (p[0] + Math.cos(ang) * L).toFixed(1) + '" y2="' + (p[1] + Math.sin(ang) * L).toFixed(1) + '"/>';
      }
      function integrate(dir) {
        var pts = [], x = 0, y = y0, h = 0.02 * dir, blew = false;
        for (var n = 0; n < 400; n++) {
          pts.push(P(x, y));
          var k1 = f(x, y), k2 = f(x + h / 2, y + h / 2 * k1), k3 = f(x + h / 2, y + h / 2 * k2), k4 = f(x + h, y + h * k3);
          y += h / 6 * (k1 + 2 * k2 + 2 * k3 + k4); x += h;
          if (x < xmin || x > xmax) break;
          if (Math.abs(y) > 3.6) { blew = true; pts.push(P(x, Math.max(-3.6, Math.min(3.6, y)))); break; }
        }
        return { pts: pts, blew: blew };
      }
      var fwd = integrate(1), bwd = integrate(-1);
      var all = bwd.pts.reverse().concat(fwd.pts);
      s += '<polyline class="ex-sol" points="' + all.map(function (p) { return p[0].toFixed(1) + ',' + p[1].toFixed(1); }).join(' ') + '"/>';
      var p0 = P(0, y0);
      s += '<circle class="ex-start" cx="' + p0[0] + '" cy="' + p0[1] + '" r="4.5"/>';
      svg.innerHTML = s;
      reads.eq.textContent = odes[cur].label;
      reads.sol.textContent = 'y(0) = ' + fmt(y0);
      var hints = {
        growth: 'Exponentielles Wachstum: y = y₀·eˣ. Jede Lösung ist ein Vielfaches derselben Kurve.',
        logistic: 'Logistisches Wachstum: y = 0 und y = 1 sind konstante Lösungen. Alles dazwischen läuft gegen 1.',
        linear: 'Lineare DGL: alle Lösungen nähern sich der Geraden y = x − 1 an.',
        forced: 'Gedämpft und angeregt: langfristig bleibt nur die periodische Antwort auf sin x übrig.',
        square: 'Achtung: y = 1/(1/y₀ − x) explodiert in endlicher Zeit – die Lösung existiert nicht auf ganz ℝ.'
      };
      reads.hint.textContent = hints[cur] + (fwd.blew || bwd.blew ? ' (Die Kurve verlässt hier den Bildausschnitt.)' : '');
      host.querySelectorAll('[data-ode]').forEach(function (b) { b.classList.toggle('is-on', b.getAttribute('data-ode') === cur); });
    }
    slider.addEventListener('input', draw);
    host.querySelectorAll('[data-ode]').forEach(function (b) { b.addEventListener('click', function () { cur = b.getAttribute('data-ode'); draw(); }); });
    draw();
  }

  /* ---------- Interaktive Skizze: Fixpunktiteration (Spinnwebdiagramm) ---------- */
  function cobwebExplorable(host) {
    var W = 440, H = 320, pad = 34, lo = 0, hi = 2;
    var s = (H - 2 * pad) / (hi - lo);
    function P(x, y) { return [pad + (x - lo) * s + 40, H - pad - (y - lo) * s]; }
    var maps = {
      cos: { label: 'g(x) = cos x', g: function (x) { return Math.cos(x); }, d: function (x) { return -Math.sin(x); }, I: [0, 1],
        hint: 'cos bildet [0, 1] in sich ab, |g′| ≤ sin 1 ≈ 0,84 < 1: Kontraktion. Der Fixpunkt x* ≈ 0,739 ist die Lösung von cos x = x.' },
      lin: { label: 'g(x) = x/2 + 1/2', g: function (x) { return x / 2 + 0.5; }, d: function () { return 0.5; }, I: [0, 2],
        hint: 'Lineare Kontraktion mit q = 1/2: Der Abstand zum Fixpunkt 1 halbiert sich in jedem Schritt.' },
      heron: { label: 'g(x) = x/2 + 1/x', g: function (x) { return x / 2 + 1 / x; }, d: function (x) { return 0.5 - 1 / (x * x); }, I: [1, 2],
        hint: 'Heron-Verfahren für √2: Kontraktion auf [1, 2]. Nahe x* ist g′(x*) = 0 – deshalb konvergiert es rasend schnell.' },
      steep: { label: 'g(x) = 2,2 − 1,4 x', g: function (x) { return 2.2 - 1.4 * x; }, d: function () { return -1.4; }, I: [0, 2],
        hint: 'Keine Kontraktion: |g′| = 1,4 > 1. Der Fixpunkt existiert (x* ≈ 0,917), aber die Iteration läuft spiralförmig davon.' }
    };
    host.innerHTML =
      '<div class="ex-grid">' +
      '<svg class="ex-svg" viewBox="0 0 ' + W + ' ' + H + '" role="img" aria-label="Spinnwebdiagramm der Fixpunktiteration"></svg>' +
      '<div class="ex-panel">' +
      '<div class="ex-presets">' + Object.keys(maps).map(function (k) { return '<button type="button" data-map="' + k + '">' + maps[k].label + '</button>'; }).join('') + '</div>' +
      '<label class="ex-slider">Startwert x₀<input type="range" min="0.05" max="1.95" step="0.01" value="0.2"><output></output></label>' +
      '<dl class="ex-read"><dt>g(I) ⊂ I</dt><dd data-r="self"></dd><dt>q = max |g′| auf I</dt><dd data-r="q"></dd><dt>x₁ … x₆</dt><dd data-r="iter"></dd><dt>Schritte für Fehler &lt; 10⁻⁶</dt><dd data-r="steps"></dd></dl>' +
      '<p class="ex-hint" data-r="hint"></p>' +
      '</div></div>';
    var svg = host.querySelector('svg'), slider = host.querySelector('input[type=range]'), out = host.querySelector('output');
    var reads = {}; host.querySelectorAll('[data-r]').forEach(function (r) { reads[r.getAttribute('data-r')] = r; });
    var cur = 'cos';
    function clampPt(x, y) { return P(Math.max(lo - 0.1, Math.min(hi + 0.1, x)), Math.max(lo - 0.1, Math.min(hi + 0.1, y))); }
    function draw() {
      var m = maps[cur], x0 = +slider.value;
      out.value = fmt(x0);
      var a = P(lo, lo), b = P(hi, hi), s1 = P(m.I[0], lo), s2 = P(m.I[1], hi);
      var str = '<rect class="ex-band" x="' + s1[0].toFixed(1) + '" y="' + s2[1].toFixed(1) + '" width="' + (s2[0] - s1[0]).toFixed(1) + '" height="' + (s1[1] - s2[1]).toFixed(1) + '"/>';
      str += '<line class="ex-axis" x1="' + a[0] + '" y1="' + a[1] + '" x2="' + (b[0] + 8) + '" y2="' + a[1] + '"/><line class="ex-axis" x1="' + a[0] + '" y1="' + a[1] + '" x2="' + a[0] + '" y2="' + (b[1] - 8) + '"/>';
      str += '<line class="ex-diag" x1="' + a[0] + '" y1="' + a[1] + '" x2="' + b[0] + '" y2="' + b[1] + '"/>';
      var pts = [];
      for (var i = 0; i <= 120; i++) {
        var x = lo + 0.02 + (hi - lo - 0.02) * i / 120, y = m.g(x);
        if (y > hi + 0.3 || y < lo - 0.3) continue;
        pts.push(P(x, y));
      }
      str += '<polyline class="ex-cob" points="' + pts.map(function (p) { return p[0].toFixed(1) + ',' + p[1].toFixed(1); }).join(' ') + '"/>';
      // Iteration
      var xs = [x0], web = [clampPt(x0, lo)];
      for (var n = 0; n < 40; n++) {
        var nx = m.g(xs[n]); xs.push(nx);
        if (n < 14) { web.push(clampPt(xs[n], nx)); web.push(clampPt(nx, nx)); }
        if (!isFinite(nx) || Math.abs(nx) > 50) break;
      }
      str += '<polyline class="ex-web" points="' + web.map(function (p) { return p[0].toFixed(1) + ',' + p[1].toFixed(1); }).join(' ') + '"/>';
      var p0 = P(x0, lo);
      str += '<circle class="ex-iter" cx="' + p0[0].toFixed(1) + '" cy="' + p0[1].toFixed(1) + '" r="4"/>';
      // Fixpunkt (Bisektion auf g(x) − x)
      var fl = lo + 0.02, fh = hi, fx = null;
      if ((m.g(fl) - fl) * (m.g(fh) - fh) <= 0) {
        for (var k = 0; k < 60; k++) { var mid = (fl + fh) / 2; if ((m.g(fl) - fl) * (m.g(mid) - mid) <= 0) fh = mid; else fl = mid; }
        fx = (fl + fh) / 2;
        var pf = P(fx, fx);
        str += '<circle class="ex-fix" cx="' + pf[0].toFixed(1) + '" cy="' + pf[1].toFixed(1) + '" r="5"/>';
        str += '<text class="ex-lbl" x="' + (pf[0] + 8).toFixed(1) + '" y="' + (pf[1] + 16).toFixed(1) + '">x*</text>';
      }
      str += '<text class="ex-lbl" x="' + (b[0] - 30) + '" y="' + (b[1] + 2) + '">y = x</text>';
      svg.innerHTML = str;
      // Kennzahlen auf I
      var q = 0, selfmap = true;
      for (var j = 0; j <= 200; j++) {
        var t = m.I[0] + (m.I[1] - m.I[0]) * j / 200, gv = m.g(t);
        q = Math.max(q, Math.abs(m.d(t)));
        if (gv < m.I[0] - 1e-9 || gv > m.I[1] + 1e-9) selfmap = false;
      }
      reads.self.textContent = selfmap ? 'ja' : 'nein';
      reads.q.textContent = fmt(q) + (q < 1 ? ' < 1' : ' ≥ 1');
      reads.iter.textContent = xs.slice(1, 7).map(function (v) { return isFinite(v) && Math.abs(v) < 50 ? fmt(v) : '∞'; }).join(' · ');
      var d01 = Math.abs(xs[1] - xs[0]);
      if (q < 1 && selfmap && x0 >= m.I[0] && x0 <= m.I[1]) {
        reads.steps.textContent = d01 < 1e-12 ? '0' : String(Math.max(0, Math.ceil(Math.log(1e-6 * (1 - q) / d01) / Math.log(q)))) + ' (A-priori-Schranke)';
      } else {
        reads.steps.textContent = q >= 1 ? 'keine Garantie – q ≥ 1' : 'x₀ liegt außerhalb von I';
      }
      reads.hint.textContent = m.hint;
      reads.hint.classList.toggle('is-bad', q >= 1);
      host.querySelectorAll('[data-map]').forEach(function (bt) { bt.classList.toggle('is-on', bt.getAttribute('data-map') === cur); });
    }
    slider.addEventListener('input', draw);
    host.querySelectorAll('[data-map]').forEach(function (bt) {
      bt.addEventListener('click', function () {
        cur = bt.getAttribute('data-map');
        var I = maps[cur].I; slider.value = Math.min(I[1], Math.max(I[0], +slider.value)).toFixed(2);
        draw();
      });
    });
    draw();
  }

  /* ---------- Interaktive Skizze: implizit definierte Funktionen ---------- */
  function implicitExplorable(host) {
    var W = 440, H = 300, u = 76, cx = W / 2, cy = H / 2;
    function P(x, y) { return [cx + x * u, cy - y * u]; }
    var curves = {
      circle: { label: 'Kreis x² + y² = 1', t: [0, 2 * Math.PI], t0: 0.9,
        p: function (t) { return [Math.cos(t), Math.sin(t)]; },
        grad: function (x, y) { return [2 * x, 2 * y]; } },
      cubic: { label: 'y³ + y − x = 0', t: [-1.15, 1.15], t0: 0.5,
        p: function (t) { return [t * t * t + t, t]; },
        grad: function () { return [-1, 0]; }, gradY: function (x, y) { return 3 * y * y + 1; } },
      lemni: { label: 'Lemniskate (x² + y²)² = 2(x² − y²)', t: [0, 2 * Math.PI], t0: 0.6,
        p: function (t) { var d = 1 + Math.sin(t) * Math.sin(t); return [Math.SQRT2 * Math.cos(t) / d, Math.SQRT2 * Math.sin(t) * Math.cos(t) / d]; },
        grad: function (x, y) { var r = x * x + y * y; return [4 * x * r - 4 * x, 4 * y * r + 4 * y]; } }
    };
    host.innerHTML =
      '<div class="ex-grid">' +
      '<svg class="ex-svg" viewBox="0 0 ' + W + ' ' + H + '" role="img" aria-label="Kurve F(x,y) = 0 mit Punkt, Tangente und lokalem Funktionsgraphen"></svg>' +
      '<div class="ex-panel">' +
      '<div class="ex-presets">' + Object.keys(curves).map(function (k) { return '<button type="button" data-curve="' + k + '">' + curves[k].label + '</button>'; }).join('') + '</div>' +
      '<label class="ex-slider">Punkt P auf der Kurve<input type="range" min="0" max="1000" step="1" value="200"><output></output></label>' +
      '<dl class="ex-read"><dt>P = (x, y)</dt><dd data-r="p"></dd><dt>∂F/∂x, ∂F/∂y</dt><dd data-r="grad"></dd><dt>g′(x) = −F_x / F_y</dt><dd data-r="slope"></dd></dl>' +
      '<p class="ex-hint" data-r="hint"></p>' +
      '</div></div>';
    var svg = host.querySelector('svg'), slider = host.querySelector('input[type=range]'), out = host.querySelector('output');
    var reads = {}; host.querySelectorAll('[data-r]').forEach(function (r) { reads[r.getAttribute('data-r')] = r; });
    var cur = 'circle';
    function tOf(v) { var c = curves[cur]; return c.t[0] + (c.t[1] - c.t[0]) * v / 1000; }
    function gradAt(c, x, y) { var g = c.grad(x, y); if (c.gradY) g = [g[0], c.gradY(x, y)]; return g; }
    function draw() {
      var c = curves[cur], t = tOf(+slider.value), pt = c.p(t), x = pt[0], y = pt[1];
      var g = gradAt(c, x, y), gn = Math.hypot(g[0], g[1]);
      out.value = Math.round(+slider.value / 10) + ' %';
      var str = '<line class="ex-axis" x1="0" y1="' + cy + '" x2="' + W + '" y2="' + cy + '"/><line class="ex-axis" x1="' + cx + '" y1="0" x2="' + cx + '" y2="' + H + '"/>';
      var pts = [];
      for (var i = 0; i <= 400; i++) { var q = c.p(c.t[0] + (c.t[1] - c.t[0]) * i / 400); pts.push(P(q[0], q[1])); }
      str += '<polyline class="ex-curve" points="' + pts.map(function (p) { return p[0].toFixed(1) + ',' + p[1].toFixed(1); }).join(' ') + '"/>';
      var singular = gn < 0.15, vertical = !singular && Math.abs(g[1]) < 0.08 * gn;
      if (!singular && !vertical) {
        // Lokales Stück, solange x(t) streng monoton bleibt
        var piece = [], dt = (c.t[1] - c.t[0]) / 600, sgn = Math.sign(c.p(t + dt)[0] - c.p(t - dt)[0]);
        [-1, 1].forEach(function (dir) {
          var part = [], tt = t, prev = c.p(t)[0];
          for (var k = 0; k < 140; k++) {
            tt += dir * dt;
            if (tt < c.t[0] || tt > c.t[1]) break;
            var q2 = c.p(tt);
            if (Math.sign(q2[0] - prev) !== dir * sgn) break;
            var gg = gradAt(c, q2[0], q2[1]);
            if (Math.abs(gg[1]) < 0.08 * Math.hypot(gg[0], gg[1])) break;
            prev = q2[0]; part.push(P(q2[0], q2[1]));
          }
          if (dir < 0) piece = part.reverse().concat([P(x, y)]); else piece = piece.concat(part);
        });
        str += '<polyline class="ex-piece" points="' + piece.map(function (p) { return p[0].toFixed(1) + ',' + p[1].toFixed(1); }).join(' ') + '"/>';
      }
      if (!singular) {
        var tx = -g[1] / gn, ty = g[0] / gn, L = 1.1;
        var a = P(x - tx * L, y - ty * L), b = P(x + tx * L, y + ty * L);
        str += '<line class="ex-tangent" x1="' + a[0].toFixed(1) + '" y1="' + a[1].toFixed(1) + '" x2="' + b[0].toFixed(1) + '" y2="' + b[1].toFixed(1) + '"/>';
      }
      var pp = P(x, y);
      str += '<circle class="ex-point' + (singular || vertical ? ' is-bad' : '') + '" cx="' + pp[0].toFixed(1) + '" cy="' + pp[1].toFixed(1) + '" r="5.5"/>';
      str += '<text class="ex-lbl" x="' + (pp[0] + 9).toFixed(1) + '" y="' + (pp[1] - 9).toFixed(1) + '">P</text>';
      svg.innerHTML = str;
      reads.p.textContent = '(' + fmt(x) + '; ' + fmt(y) + ')';
      reads.grad.textContent = fmt(g[0]) + ' ; ' + fmt(g[1]);
      reads.slope.textContent = singular || vertical ? '— nicht definiert' : fmt(-g[0] / g[1]);
      var hint;
      if (singular) hint = 'Singulärer Punkt: ∇F = 0. Hier kreuzen sich zwei Kurvenäste – weder nach y noch nach x lokal auflösbar.';
      else if (vertical) hint = '∂F/∂y = 0: Die Kurve steht senkrecht. Lokal gehören zu einem x zwei y-Werte – keine Funktion y = g(x). Nach x = h(y) wäre sie aber auflösbar, weil ∂F/∂x ≠ 0.';
      else if (cur === 'cubic') hint = '∂F/∂y = 3y² + 1 > 0 überall: Die Gleichung ist an jeder Stelle nach y auflösbar – hier sogar global, obwohl man g nicht explizit hinschreiben möchte.';
      else hint = '∂F/∂y ≠ 0: Nahe P ist die Kurve der Graph einer Funktion y = g(x) (gold). Die Tangente hat die Steigung g′(x) = −F_x/F_y.';
      reads.hint.textContent = hint;
      reads.hint.classList.toggle('is-bad', singular || vertical);
      host.querySelectorAll('[data-curve]').forEach(function (bt) { bt.classList.toggle('is-on', bt.getAttribute('data-curve') === cur); });
    }
    slider.addEventListener('input', draw);
    host.querySelectorAll('[data-curve]').forEach(function (bt) {
      bt.addEventListener('click', function () {
        cur = bt.getAttribute('data-curve');
        var c = curves[cur]; slider.value = Math.round((c.t0 - c.t[0]) / (c.t[1] - c.t[0]) * 1000);
        draw();
      });
    });
    slider.value = Math.round((curves[cur].t0 - curves[cur].t[0]) / (curves[cur].t[1] - curves[cur].t[0]) * 1000);
    draw();
  }

  document.querySelectorAll('[data-explorable]').forEach(function (host) {
    var kind = host.getAttribute('data-explorable');
    if (kind === 'matrix') matrixExplorable(host);
    if (kind === 'ode') odeExplorable(host);
    if (kind === 'cobweb') cobwebExplorable(host);
    if (kind === 'implicit') implicitExplorable(host);
  });

  document.querySelectorAll('.lernbereich').forEach(math);
  updateLernpfad();
})();
