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
    // Erst nach einer Aktion im Quiz den Fokus setzen – sonst springt die Seite beim Laden zum Wissens-Check
    var acted = !!opts.exam;
    function focusQuiet(node) { try { node.focus({ preventScroll: true }); } catch (e) { node.focus(); } }
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
        if (acted) setTimeout(function () { focusQuiet(inp); }, 50);
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
        acted = true;
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
        focusQuiet(next);
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
        // auch einfache Brüche wie 7/10 oder -3/4 zulassen
        var frac = raw.match(/^(-?\d+(?:\.\d+)?)\s*\/\s*(\d+(?:\.\d+)?)$/);
        var v = frac ? parseFloat(frac[1]) / parseFloat(frac[2]) : (/^-?\d+(\.\d+)?$/.test(raw) ? parseFloat(raw) : NaN);
        if (isNaN(v) || !isFinite(v)) return false;
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
    // Überschrift an die tatsächliche Fragenzahl anpassen, solange der Pool kleiner als zehn ist
    var WORDS = ['', 'Eine Frage', 'Zwei Fragen', 'Drei Fragen', 'Vier Fragen', 'Fünf Fragen', 'Sechs Fragen', 'Sieben Fragen', 'Acht Fragen', 'Neun Fragen'];
    var h3 = k.querySelector('.klausur-head h3');
    if (h3 && n > 0 && n < 10) h3.textContent = WORDS[n] + ', die Uhr läuft';
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
        hint: 'Lineare Kontraktion mit λ = 1/2: Der Abstand zum Fixpunkt 1 halbiert sich in jedem Schritt.' },
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
      '<dl class="ex-read"><dt>g(I) ⊂ I</dt><dd data-r="self"></dd><dt>λ = max |g′| auf I</dt><dd data-r="q"></dd><dt>x₁ … x₆</dt><dd data-r="iter"></dd><dt>Schritte für Fehler &lt; 10⁻⁶</dt><dd data-r="steps"></dd></dl>' +
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

  /* ---------- Interaktive Skizze: Wahrheitstafel-Labor ---------- */
  function truthExplorable(host) {
    var PREC = { iff: 1, imp: 2, or: 3, and: 4, not: 5, v: 6 };
    var SYM = { iff: '⇔', imp: '⇒', or: '∨', and: '∧' };
    var presets = [
      ['Implikation', 'ϕ ⇒ ψ'],
      ['Modus ponens', 'ϕ ∧ (ϕ ⇒ ψ) ⇒ ψ'],
      ['Kontraposition', '(ϕ ⇒ ψ) ⇔ (¬ψ ⇒ ¬ϕ)'],
      ['Umkehrung?', '(ϕ ⇒ ψ) ⇔ (ψ ⇒ ϕ)'],
      ['Bauernregel', 'ϕ ⇒ ψ ∨ ¬ψ'],
      ['Widerspruch', '(¬ϕ ⇒ χ ∧ ¬χ) ⇒ ϕ']
    ];
    host.innerHTML =
      '<div class="ex-stack">' +
      '<div class="tt-input"><input type="text" spellcheck="false" autocomplete="off" aria-label="Formel eingeben" /></div>' +
      '<div class="tt-keys">' + ['ϕ', 'ψ', 'χ'].map(function (k) { return '<button type="button" data-ins="' + k + '">' + k + '</button>'; }).join('') +
      '<span class="tt-sep"></span>' + ['¬', '∧', '∨', '⇒', '⇔', '(', ')'].map(function (k) { return '<button type="button" data-ins="' + k + '" aria-label="' + k + ' einfügen">' + k + '</button>'; }).join('') +
      '<span class="tt-sep"></span><button type="button" data-ins="back" aria-label="Zeichen löschen">⌫</button><button type="button" data-ins="clear" aria-label="Formel leeren">C</button></div>' +
      '<div class="ex-presets">' + presets.map(function (p, i) { return '<button type="button" data-p="' + i + '">' + p[0] + '</button>'; }).join('') + '</div>' +
      '<p class="tt-parsed" data-r="parsed"></p>' +
      '<div class="tt-wrap" data-r="table"></div>' +
      '<div class="tt-bar"><label><input type="checkbox" data-r="self" checked /> Übungsmodus: Ergebnisspalte selbst ausfüllen</label><button class="tt-check" type="button" data-r="check" hidden>Prüfen</button></div>' +
      '<p class="ex-hint" data-r="hint"></p>' +
      '<p class="tt-parsed">Tastatur: Variablen sind einzelne Buchstaben; <code>!</code> oder <code>~</code> für ¬, <code>&amp;</code> für ∧, <code>|</code> für ∨, <code>-&gt;</code> oder <code>=&gt;</code> für ⇒, <code>&lt;-&gt;</code> oder <code>&lt;=&gt;</code> für ⇔.</p>' +
      '</div>';
    var input = host.querySelector('input[type=text]');
    var reads = {}; host.querySelectorAll('[data-r]').forEach(function (r) { reads[r.getAttribute('data-r')] = r; });
    var guesses = {};

    function tokenize(str) {
      var t = [], i = 0;
      var map = [['<->', 'iff'], ['<=>', 'iff'], ['->', 'imp'], ['=>', 'imp'], ['&&', 'and'], ['||', 'or'],
        ['⇔', 'iff'], ['↔', 'iff'], ['⇒', 'imp'], ['→', 'imp'], ['∧', 'and'], ['&', 'and'], ['∨', 'or'], ['|', 'or'],
        ['¬', 'not'], ['!', 'not'], ['~', 'not'], ['(', '('], [')', ')']];
      outer: while (i < str.length) {
        var ch = str[i];
        if (/\s/.test(ch)) { i++; continue; }
        for (var k = 0; k < map.length; k++) {
          if (str.substr(i, map[k][0].length) === map[k][0]) { t.push({ t: map[k][1] }); i += map[k][0].length; continue outer; }
        }
        if (/[A-Za-zα-ωϕϑϱ]/.test(ch)) { t.push({ t: 'v', n: ch }); i++; continue; }
        throw new Error('Unbekanntes Zeichen „' + ch + '“');
      }
      return t;
    }
    function parse(tokens) {
      var pos = 0;
      function peek() { return tokens[pos] && tokens[pos].t; }
      function iff() { var l = imp(); while (peek() === 'iff') { pos++; l = { op: 'iff', a: l, b: imp() }; } return l; }
      function imp() { var l = or(); if (peek() === 'imp') { pos++; return { op: 'imp', a: l, b: imp() }; } return l; }
      function or() { var l = and(); while (peek() === 'or') { pos++; l = { op: 'or', a: l, b: and() }; } return l; }
      function and() { var l = not(); while (peek() === 'and') { pos++; l = { op: 'and', a: l, b: not() }; } return l; }
      function not() { if (peek() === 'not') { pos++; return { op: 'not', a: not() }; } return atom(); }
      function atom() {
        var tk = tokens[pos];
        if (!tk) throw new Error('Die Formel endet zu früh');
        if (tk.t === 'v') { pos++; return { op: 'v', n: tk.n }; }
        if (tk.t === '(') { pos++; var e = iff(); if (peek() !== ')') throw new Error('Es fehlt eine schließende Klammer'); pos++; return e; }
        throw new Error('An Stelle ' + (pos + 1) + ' wird eine Variable oder „(“ erwartet');
      }
      if (!tokens.length) throw new Error('empty');
      var e = iff();
      if (pos < tokens.length) throw new Error(tokens[pos].t === ')' ? 'Eine Klammer „)“ zu viel' : 'Zwischen zwei Teilformeln fehlt eine Verknüpfung');
      return e;
    }
    function show(e) {
      if (e.op === 'v') return e.n;
      if (e.op === 'not') { var s = show(e.a); return '¬' + (PREC[e.a.op] < PREC.not ? '(' + s + ')' : s); }
      var p = PREC[e.op], l = show(e.a), r = show(e.b);
      // ⇒ und ⇔ untereinander immer klammern – formal unnötig, aber besser lesbar
      if (PREC[e.a.op] < p || (e.op === 'imp' && PREC[e.a.op] === p) || (p <= 2 && PREC[e.a.op] <= 2)) l = '(' + l + ')';
      if (PREC[e.b.op] < p || (e.op !== 'imp' && PREC[e.b.op] === p) || (p <= 2 && PREC[e.b.op] <= 2)) r = '(' + r + ')';
      return l + ' ' + SYM[e.op] + ' ' + r;
    }
    function full(e, top) {
      if (e.op === 'v') return e.n;
      if (e.op === 'not') return '¬' + full(e.a, false);
      var s = full(e.a, false) + ' ' + SYM[e.op] + ' ' + full(e.b, false);
      return top ? s : '(' + s + ')';
    }
    function ev(e, env) {
      switch (e.op) {
        case 'v': return env[e.n];
        case 'not': return !ev(e.a, env);
        case 'and': return ev(e.a, env) && ev(e.b, env);
        case 'or': return ev(e.a, env) || ev(e.b, env);
        case 'imp': return !ev(e.a, env) || ev(e.b, env);
        case 'iff': return ev(e.a, env) === ev(e.b, env);
      }
    }
    function wf(b) { return b ? 'w' : 'f'; }

    var state = null;
    function build() {
      var str = input.value;
      guesses = {};
      reads.check.hidden = !reads.self.checked;
      try {
        var tree = parse(tokenize(str));
      } catch (err) {
        state = null;
        reads.table.innerHTML = '';
        reads.parsed.innerHTML = err.message === 'empty' ? 'Gib eine Formel ein – zum Beispiel ϕ ⇒ ψ.' : '<span class="tt-error">' + err.message + '</span>';
        reads.hint.textContent = '';
        reads.hint.classList.remove('is-bad');
        return;
      }
      var vars = [], cols = [], seen = {};
      (function walk(e) {
        if (e.op === 'v') { if (vars.indexOf(e.n) < 0) vars.push(e.n); return; }
        walk(e.a); if (e.b) walk(e.b);
        var k = show(e); if (!seen[k]) { seen[k] = 1; cols.push(e); }
      })(tree);
      if (vars.length > 4) {
        state = null; reads.table.innerHTML = '';
        reads.parsed.innerHTML = '<span class="tt-error">Höchstens vier verschiedene Variablen – sonst wird die Tafel unübersichtlich.</span>';
        reads.hint.textContent = ''; return;
      }
      if (!cols.length) cols.push(tree);
      var rows = [], n = vars.length;
      for (var r = 0; r < (1 << n); r++) {
        var env = {};
        vars.forEach(function (v, i) { env[v] = !((r >> (n - 1 - i)) & 1); });
        rows.push(env);
      }
      state = { tree: tree, vars: vars, cols: cols, rows: rows };
      reads.parsed.innerHTML = 'Gelesen als: <span>' + full(tree, true) + '</span>';
      render(false);
    }
    function render(checked) {
      var st = state, self = reads.self.checked;
      var h = '<table class="tt"><thead><tr>' + st.vars.map(function (v, i) { return '<th' + (i === st.vars.length - 1 ? ' class="tt-var"' : '') + '>' + v + '</th>'; }).join('') +
        st.cols.map(function (c, i) { return '<th' + (i === st.cols.length - 1 ? ' class="tt-final"' : '') + '>' + show(c) + '</th>'; }).join('') + '</tr></thead><tbody>';
      var ok = 0;
      st.rows.forEach(function (env, r) {
        h += '<tr>' + st.vars.map(function (v, i) { var b = env[v]; return '<td class="' + (b ? '' : 'is-f') + (i === st.vars.length - 1 ? ' tt-var' : '') + '">' + wf(b) + '</td>'; }).join('');
        st.cols.forEach(function (c, i) {
          var b = ev(c, env), last = i === st.cols.length - 1;
          if (last && self) {
            var g = guesses[r], cls = 'tt-cell';
            if (checked && g !== undefined) { cls += (g === b ? ' is-ok' : ' is-wrong'); if (g === b) ok++; }
            h += '<td class="tt-final"><button type="button" class="' + cls + '" data-row="' + r + '" aria-label="Zeile ' + (r + 1) + ' ausfüllen">' + (g === undefined ? '?' : wf(g)) + '</button></td>';
          } else {
            h += '<td class="' + (b ? '' : 'is-f') + (last ? ' tt-final' : '') + '">' + wf(b) + '</td>';
          }
        });
        h += '</tr>';
      });
      reads.table.innerHTML = h + '</tbody></table>';
      reads.table.querySelectorAll('.tt-cell').forEach(function (b) {
        b.addEventListener('click', function () {
          var r = +b.getAttribute('data-row');
          guesses[r] = guesses[r] === undefined ? true : !guesses[r];
          render(false);
        });
      });
      var total = st.rows.length, trues = st.rows.filter(function (env) { return ev(st.tree, env); }).length;
      var hint, bad = false;
      if (self && !checked) {
        hint = 'Du bist dran: Tippe in der goldenen Spalte auf jedes ?, um w oder f einzutragen, und drücke dann „Prüfen“. Die Spalten links helfen dir. Die fertige Lösung siehst du, wenn du den Übungsmodus ausschaltest.';
      } else if (self && checked) {
        bad = ok < total;
        hint = ok + ' von ' + total + ' Zeilen richtig.' + (bad ? ' Die rot markierten Zeilen noch einmal ansehen – Tipp: die Spalten links helfen.' : ' Perfekt – ' + verdict(trues, total));
      } else {
        hint = verdict(trues, total);
      }
      reads.hint.textContent = hint;
      reads.hint.classList.toggle('is-bad', bad);
    }
    function verdict(trues, total) {
      if (trues === total) return 'Tautologie: In jeder der ' + total + ' Zeilen steht w. Damit taugt die Formel als logischer Schluss.';
      if (trues === 0) return 'Kontradiktion: Die Formel ist in jeder Zeile falsch.';
      return 'Keine Tautologie: wahr in ' + trues + ' von ' + total + ' Zeilen. Schon eine Zeile mit f genügt als Gegenbeispiel.';
    }
    host.querySelectorAll('[data-ins]').forEach(function (b) {
      b.addEventListener('click', function () {
        var k = b.getAttribute('data-ins'), v = input.value, s = input.selectionStart == null ? v.length : input.selectionStart, e = input.selectionEnd == null ? v.length : input.selectionEnd;
        if (k === 'clear') { input.value = ''; s = 0; }
        else if (k === 'back') { if (s === e && s > 0) s--; input.value = v.slice(0, s) + v.slice(e); }
        else {
          var ins = /[¬()]/.test(k) ? k : (/[ϕψχ]/.test(k) ? k : ' ' + k + ' ');
          input.value = v.slice(0, s) + ins + v.slice(e); s += ins.length;
        }
        input.focus(); try { input.setSelectionRange(s, s); } catch (err) {}
        build();
      });
    });
    host.querySelectorAll('[data-p]').forEach(function (b) {
      b.addEventListener('click', function () {
        input.value = presets[+b.getAttribute('data-p')][1];
        host.querySelectorAll('[data-p]').forEach(function (x) { x.classList.toggle('is-on', x === b); });
        build();
      });
    });
    input.addEventListener('input', function () { host.querySelectorAll('[data-p]').forEach(function (x) { x.classList.remove('is-on'); }); build(); });
    reads.self.addEventListener('change', function () { guesses = {}; reads.check.hidden = !reads.self.checked; if (state) render(false); });
    reads.check.addEventListener('click', function () { if (state) render(true); });
    input.value = presets[0][1];
    host.querySelector('[data-p="0"]').classList.add('is-on');
    build();
  }

  /* ---------- Interaktive Skizze: Venn-Diagramm mit definierenden Bedingungen ---------- */
  function vennExplorable(host) {
    var W = 420, H = 300, CA = [150, 150], CB = [270, 150], R = 95;
    var conds = {
      even: { label: 'n ist gerade', f: function (n) { return n % 2 === 0; } },
      odd: { label: 'n ist ungerade', f: function (n) { return n % 2 === 1; } },
      three: { label: 'n ist durch 3 teilbar', f: function (n) { return n % 3 === 0; } },
      prime: { label: 'n ist eine Primzahl', f: function (n) { return [2, 3, 5, 7, 11].indexOf(n) >= 0; } },
      small: { label: 'n < 7', f: function (n) { return n < 7; } },
      square: { label: 'n ist eine Quadratzahl', f: function (n) { return [1, 4, 9].indexOf(n) >= 0; } }
    };
    var ops = {
      cap: { label: 'A ∩ B', logic: 'x ∈ A ∧ x ∈ B', f: function (a, b) { return a && b; } },
      cup: { label: 'A ∪ B', logic: 'x ∈ A ∨ x ∈ B', f: function (a, b) { return a || b; } },
      amb: { label: 'A \\ B', logic: 'x ∈ A ∧ x ∉ B', f: function (a, b) { return a && !b; } },
      bma: { label: 'B \\ A', logic: 'x ∈ B ∧ x ∉ A', f: function (a, b) { return b && !a; } }
    };
    var slots = {
      ab: [[198, 118], [222, 118], [192, 150], [228, 150], [198, 182], [222, 182]],
      a: [[92, 125], [92, 175], [126, 95], [126, 150], [126, 205], [160, 118], [160, 182]],
      b: [[328, 125], [328, 175], [294, 95], [294, 150], [294, 205], [260, 118], [260, 182]],
      o: [[40, 34], [110, 30], [210, 36], [310, 30], [380, 34], [110, 272], [210, 266], [310, 272], [380, 270], [30, 110], [30, 190], [390, 110], [390, 190]]
    };
    function opts(sel) { return Object.keys(conds).map(function (k) { return '<option value="' + k + '"' + (k === sel ? ' selected' : '') + '>' + conds[k].label + '</option>'; }).join(''); }
    host.innerHTML =
      '<div class="ex-grid">' +
      '<svg class="ex-svg" viewBox="0 0 ' + W + ' ' + H + '" role="img" aria-label="Venn-Diagramm der Mengen A und B in M = {1, …, 12}"></svg>' +
      '<div class="ex-panel">' +
      '<label class="ex-field-l">A = { n ∈ M | Bedingung }<select data-s="A">' + opts('even') + '</select></label>' +
      '<label class="ex-field-l">B = { n ∈ M | Bedingung }<select data-s="B">' + opts('three') + '</select></label>' +
      '<div class="ex-presets">' + Object.keys(ops).map(function (k) { return '<button type="button" data-op="' + k + '">' + ops[k].label + '</button>'; }).join('') + '</div>' +
      '<dl class="ex-read"><dt>A</dt><dd data-r="A"></dd><dt>B</dt><dd data-r="B"></dd><dt data-r="opl"></dt><dd data-r="res"></dd><dt>A ⊆ B?</dt><dd data-r="sub"></dd></dl>' +
      '<p class="ex-hint" data-r="hint"></p>' +
      '</div></div>';
    var svg = host.querySelector('svg'), selA = host.querySelector('[data-s=A]'), selB = host.querySelector('[data-s=B]');
    var reads = {}; host.querySelectorAll('[data-r]').forEach(function (r) { reads[r.getAttribute('data-r')] = r; });
    var cur = 'cap';
    var uid = 'v' + Math.random().toString(36).slice(2, 7);
    function setStr(arr) { return arr.length ? '{' + arr.join(', ') + '}' : '∅'; }
    function draw() {
      var fa = conds[selA.value].f, fb = conds[selB.value].f, op = ops[cur];
      var circA = '<circle cx="' + CA[0] + '" cy="' + CA[1] + '" r="' + R + '"/>', circB = '<circle cx="' + CB[0] + '" cy="' + CB[1] + '" r="' + R + '"/>';
      var s = '<defs><clipPath id="' + uid + 'ca">' + circA + '</clipPath><clipPath id="' + uid + 'cb">' + circB + '</clipPath>' +
        '<mask id="' + uid + 'ma"><rect width="' + W + '" height="' + H + '" fill="#fff"/><circle cx="' + CA[0] + '" cy="' + CA[1] + '" r="' + R + '" fill="#000"/></mask>' +
        '<mask id="' + uid + 'mb"><rect width="' + W + '" height="' + H + '" fill="#fff"/><circle cx="' + CB[0] + '" cy="' + CB[1] + '" r="' + R + '" fill="#000"/></mask></defs>';
      s += '<rect class="ex-uni" x="14" y="14" width="' + (W - 28) + '" height="' + (H - 28) + '" rx="10"/>';
      var reg = function (c, attr) { return '<circle class="ex-region" cx="' + c[0] + '" cy="' + c[1] + '" r="' + R + '" ' + attr + '/>'; };
      if (cur === 'cap') s += reg(CA, 'clip-path="url(#' + uid + 'cb)"');
      if (cur === 'cup') s += '<g style="opacity:1">' + reg(CA, 'mask="url(#' + uid + 'mb)"') + reg(CB, '') + '</g>';
      if (cur === 'amb') s += reg(CA, 'mask="url(#' + uid + 'mb)"');
      if (cur === 'bma') s += reg(CB, 'mask="url(#' + uid + 'ma)"');
      s += '<circle class="ex-set" cx="' + CA[0] + '" cy="' + CA[1] + '" r="' + R + '"/><circle class="ex-set" cx="' + CB[0] + '" cy="' + CB[1] + '" r="' + R + '"/>';
      s += '<text class="ex-lbl" x="62" y="70">A</text><text class="ex-lbl" x="350" y="70">B</text><text class="ex-lbl" x="24" y="282">M</text>';
      var used = { ab: 0, a: 0, b: 0, o: 0 }, A = [], B = [], res = [];
      for (var n = 1; n <= 12; n++) {
        var ia = fa(n), ib = fb(n), key = ia && ib ? 'ab' : ia ? 'a' : ib ? 'b' : 'o';
        var p = slots[key][used[key]++], inn = op.f(ia, ib);
        if (ia) A.push(n); if (ib) B.push(n); if (inn) res.push(n);
        s += '<text class="ex-num' + (inn ? ' is-in' : '') + '" x="' + p[0] + '" y="' + p[1] + '">' + n + '</text>';
      }
      svg.innerHTML = s;
      reads.A.textContent = setStr(A);
      reads.B.textContent = setStr(B);
      reads.opl.textContent = op.label;
      reads.res.textContent = setStr(res);
      var bad = A.filter(function (x) { return B.indexOf(x) < 0; });
      reads.sub.textContent = bad.length ? 'nein – ' + bad[0] + ' ∈ A, aber ' + bad[0] + ' ∉ B' : 'ja – jedes Element von A liegt in B';
      reads.hint.textContent = op.label + ' = { x ∈ M | ' + op.logic + ' }' + (res.length ? '' : ' – hier ist das die leere Menge.') + (selA.value === selB.value ? ' Gleiche Bedingungen: A = B.' : '');
      host.querySelectorAll('[data-op]').forEach(function (bt) { bt.classList.toggle('is-on', bt.getAttribute('data-op') === cur); });
    }
    selA.addEventListener('change', draw); selB.addEventListener('change', draw);
    host.querySelectorAll('[data-op]').forEach(function (bt) { bt.addEventListener('click', function () { cur = bt.getAttribute('data-op'); draw(); }); });
    draw();
  }

  /* ---------- Interaktive Skizze: Quantoren auf einem Gitter ---------- */
  function quantorExplorable(host) {
    var N = 6, W = 380, H = 330, ox = 62, oy = 286, st = 48;
    function P(x, y) { return [ox + (x - 1) * st, oy - (y - 1) * st]; }
    var rels = {
      sum7: { label: 'x + y = 7', f: function (x, y) { return x + y === 7; } },
      le: { label: 'x ≤ y', f: function (x, y) { return x <= y; } },
      lt: { label: 'x < y', f: function (x, y) { return x < y; }, note: { ae: ' Auf ℝ wäre diese Aussage wahr (nimm y = x + 1) – in der endlichen Menge M fehlt zu x = 6 ein größeres y.' } },
      div: { label: 'x teilt y', f: function (x, y) { return y % x === 0; } },
      eq: { label: 'x = y', f: function (x, y) { return x === y; } }
    };
    var stm = [
      { k: 'aa', txt: '∀x ∈ M : ∀y ∈ M : ϕ(x, y)', neg: '∃x ∈ M : ∃y ∈ M : ¬ϕ(x, y)' },
      { k: 'ae', txt: '∀x ∈ M : ∃y ∈ M : ϕ(x, y)', neg: '∃x ∈ M : ∀y ∈ M : ¬ϕ(x, y)' },
      { k: 'ea', txt: '∃y ∈ M : ∀x ∈ M : ϕ(x, y)', neg: '∀y ∈ M : ∃x ∈ M : ¬ϕ(x, y)' },
      { k: 'ee', txt: '∃x ∈ M : ∃y ∈ M : ϕ(x, y)', neg: '∀x ∈ M : ∀y ∈ M : ¬ϕ(x, y)' }
    ];
    host.innerHTML =
      '<div class="ex-grid">' +
      '<svg class="ex-svg" viewBox="0 0 ' + W + ' ' + H + '" role="img" aria-label="Gitter aller Paare (x, y) mit x, y aus {1, …, 6}"></svg>' +
      '<div class="ex-panel">' +
      '<div class="ex-presets">' + Object.keys(rels).map(function (k) { return '<button type="button" data-rel="' + k + '">ϕ(x, y): ' + rels[k].label + '</button>'; }).join('') + '</div>' +
      '<div class="q-list">' + stm.map(function (s, i) { return '<button type="button" data-q="' + i + '"><span>' + s.txt + '</span><span class="q-badge"></span></button>'; }).join('') + '</div>' +
      '<p class="ex-hint" data-r="hint"></p>' +
      '</div></div>';
    var svg = host.querySelector('svg'), hint = host.querySelector('[data-r=hint]');
    var cur = 'sum7', sel = 1;
    function range() { var a = []; for (var i = 1; i <= N; i++) a.push(i); return a; }
    function evalAll(f) {
      var M = range();
      var colHas = M.map(function (x) { return M.filter(function (y) { return f(x, y); }); });
      var rowAll = M.filter(function (y) { return M.every(function (x) { return f(x, y); }); });
      var firstFalse = null, firstTrue = null;
      M.forEach(function (x) { M.forEach(function (y) { if (f(x, y)) { if (!firstTrue) firstTrue = [x, y]; } else if (!firstFalse) firstFalse = [x, y]; }); });
      return {
        aa: !firstFalse, ae: colHas.every(function (c) { return c.length; }), ea: rowAll.length > 0, ee: !!firstTrue,
        colHas: colHas, rowAll: rowAll, firstFalse: firstFalse, firstTrue: firstTrue
      };
    }
    function mark(x, y, bad) { var p = P(x, y); return '<circle class="ex-qmark' + (bad ? ' is-bad' : '') + '" cx="' + p[0] + '" cy="' + p[1] + '" r="13"/>'; }
    function colBand(x, bad) { var p = P(x, N); return '<rect class="ex-qband' + (bad ? ' is-bad' : '') + '" x="' + (p[0] - 20) + '" y="' + (p[1] - 20) + '" width="40" height="' + ((N - 1) * st + 40) + '" rx="10"/>'; }
    function rowBand(y, bad) { var p = P(1, y); return '<rect class="ex-qband' + (bad ? ' is-bad' : '') + '" x="' + (p[0] - 20) + '" y="' + (p[1] - 20) + '" width="' + ((N - 1) * st + 40) + '" height="40" rx="10"/>'; }
    function draw() {
      var f = rels[cur].f, r = evalAll(f), M = range(), s = '', h = '', bad = false;
      var k = stm[sel].k;
      // Hervorhebungen (unter den Punkten)
      if (k === 'ae') {
        if (r.ae) { M.forEach(function (x) { s += mark(x, r.colHas[x - 1][0], false); }); h = 'Wahr: In jeder Spalte x gibt es mindestens einen goldenen Punkt – markiert ist je ein passendes y. Das y darf von x abhängen.'; }
        else { var x0 = M.filter(function (x) { return !r.colHas[x - 1].length; })[0]; s += colBand(x0, true); bad = true; h = 'Falsch: In der Spalte x = ' + x0 + ' ist kein Punkt golden – für x = ' + x0 + ' gibt es kein passendes y. Das ist der Zeuge für die Negation.'; }
      } else if (k === 'ea') {
        if (r.ea) { s += rowBand(r.rowAll[0], false); h = 'Wahr: Die ganze Zeile y = ' + r.rowAll[0] + ' ist golden – dieses eine y passt für alle x gleichzeitig.'; }
        else { M.forEach(function (y) { var x = M.filter(function (x) { return !f(x, y); })[0]; s += mark(x, y, true); }); bad = true; h = 'Falsch: Keine Zeile ist komplett golden. In jeder Zeile y ist ein Gegenbeispiel x markiert – kein einzelnes y passt für alle x.'; }
      } else if (k === 'aa') {
        if (r.aa) h = 'Wahr: Alle 36 Punkte sind golden.';
        else { s += mark(r.firstFalse[0], r.firstFalse[1], true); bad = true; h = 'Falsch: Ein einziges Gegenbeispiel genügt – ϕ(' + r.firstFalse[0] + ', ' + r.firstFalse[1] + ') ist falsch.'; }
      } else {
        if (r.ee) { s += mark(r.firstTrue[0], r.firstTrue[1], false); h = 'Wahr: Ein Zeuge genügt – ϕ(' + r.firstTrue[0] + ', ' + r.firstTrue[1] + ') ist wahr.'; }
        else { bad = true; h = 'Falsch: Kein einziger Punkt ist golden.'; }
      }
      // Achsen und Punkte
      M.forEach(function (i) {
        var px = P(i, 1), py = P(1, i);
        s += '<text class="ex-num" x="' + px[0] + '" y="' + (oy + 26) + '">' + i + '</text>';
        s += '<text class="ex-num" x="' + (ox - 30) + '" y="' + py[1] + '">' + i + '</text>';
      });
      s += '<text class="ex-lbl" x="' + (ox + (N - 1) * st + 22) + '" y="' + (oy + 30) + '">x</text><text class="ex-lbl" x="' + (ox - 36) + '" y="' + (oy - (N - 1) * st - 26) + '">y</text>';
      M.forEach(function (x) { M.forEach(function (y) { var p = P(x, y); s += '<circle class="ex-qdot' + (f(x, y) ? ' is-true' : '') + '" cx="' + p[0] + '" cy="' + p[1] + '" r="7"/>'; }); });
      svg.innerHTML = s;
      host.querySelectorAll('[data-q]').forEach(function (b, i) {
        var v = r[stm[i].k], badge = b.querySelector('.q-badge');
        badge.textContent = v ? 'wahr' : 'falsch';
        badge.className = 'q-badge ' + (v ? 'is-w' : 'is-f');
        b.classList.toggle('is-on', i === sel);
      });
      if (rels[cur].note && rels[cur].note[k]) h += rels[cur].note[k];
      hint.textContent = h + ' Negation: ¬(' + stm[sel].txt + ') ⇔ ' + stm[sel].neg + '.';
      hint.classList.toggle('is-bad', bad);
      host.querySelectorAll('[data-rel]').forEach(function (b) { b.classList.toggle('is-on', b.getAttribute('data-rel') === cur); });
    }
    host.querySelectorAll('[data-rel]').forEach(function (b) { b.addEventListener('click', function () { cur = b.getAttribute('data-rel'); draw(); }); });
    host.querySelectorAll('[data-q]').forEach(function (b) { b.addEventListener('click', function () { sel = +b.getAttribute('data-q'); draw(); }); });
    draw();
  }

  /* ---------- Interaktive Skizze: Relationen-Labor ---------- */
  function relationExplorable(host) {
    var N = 6, X = [1, 2, 3, 4, 5, 6];
    var presets = {
      teiler: { label: 'Teilerrelation x | y', f: function (x, y) { return y % x === 0; } },
      le: { label: 'x ≤ y', f: function (x, y) { return x <= y; } },
      lt: { label: 'x < y', f: function (x, y) { return x < y; } },
      mod2: { label: 'x ≡ y mod 2', f: function (x, y) { return (x - y) % 2 === 0; } },
      mod3: { label: 'x ≡ y mod 3', f: function (x, y) { return (x - y) % 3 === 0; } },
      eq: { label: 'x = y', f: function (x, y) { return x === y; } },
      leer: { label: 'leer', f: function () { return false; } }
    };
    host.innerHTML =
      '<div class="ex-grid">' +
      '<div class="rel-wrap"><div class="rel-grid" role="grid" aria-label="Relationstabelle: Zeile x, Spalte y"></div><p class="rel-axis">Zeile \\(x\\), Spalte \\(y\\): golden heißt \\(xRy\\)</p></div>' +
      '<div class="ex-panel">' +
      '<div class="ex-presets">' + Object.keys(presets).map(function (k) { return '<button type="button" data-rel="' + k + '">' + presets[k].label + '</button>'; }).join('') + '</div>' +
      '<dl class="ex-read"><dt>reflexiv</dt><dd data-r="refl"></dd><dt>symmetrisch</dt><dd data-r="sym"></dd><dt>anti-symmetrisch</dt><dd data-r="anti"></dd><dt>transitiv</dt><dd data-r="trans"></dd></dl>' +
      '<p class="ex-hint" data-r="hint"></p>' +
      '</div></div>';
    var grid = host.querySelector('.rel-grid');
    var reads = {}; host.querySelectorAll('[data-r]').forEach(function (r) { reads[r.getAttribute('data-r')] = r; });
    var R = [];
    function setPreset(k) { var f = presets[k].f; R = X.map(function (x) { return X.map(function (y) { return f(x, y); }); }); draw(k); }
    function has(x, y) { return R[x - 1][y - 1]; }
    function check() {
      var res = { refl: null, sym: null, anti: null, trans: null, incomparable: null };
      X.forEach(function (x) { if (!res.refl && !has(x, x)) res.refl = x; });
      X.forEach(function (x) { X.forEach(function (y) {
        if (!res.sym && has(x, y) && !has(y, x)) res.sym = [x, y];
        if (!res.anti && x !== y && has(x, y) && has(y, x)) res.anti = [x, y];
        if (!res.incomparable && x < y && !has(x, y) && !has(y, x)) res.incomparable = [x, y];
        X.forEach(function (z) { if (!res.trans && has(x, y) && has(y, z) && !has(x, z)) res.trans = [x, y, z]; });
      }); });
      return res;
    }
    function ok(b, txt) { return '<span class="rel-' + (b ? 'ok' : 'no') + '">' + (b ? '✓ ja' : '✗ nein') + '</span>' + (txt ? ' <span class="rel-why">' + txt + '</span>' : ''); }
    function draw(active) {
      var h = '<span class="rel-h"></span>' + X.map(function (y) { return '<span class="rel-h">' + y + '</span>'; }).join('');
      X.forEach(function (x) {
        h += '<span class="rel-h">' + x + '</span>';
        X.forEach(function (y) {
          h += '<button type="button" class="rel-cell' + (has(x, y) ? ' is-on' : '') + (x === y ? ' is-diag' : '') + '" data-x="' + x + '" data-y="' + y + '" aria-pressed="' + has(x, y) + '" aria-label="(' + x + ', ' + y + ')"></button>';
        });
      });
      grid.innerHTML = h;
      grid.querySelectorAll('.rel-cell').forEach(function (c) {
        c.addEventListener('click', function () {
          var x = +c.getAttribute('data-x'), y = +c.getAttribute('data-y');
          R[x - 1][y - 1] = !R[x - 1][y - 1]; draw(null);
        });
      });
      var r = check();
      reads.refl.innerHTML = ok(!r.refl, r.refl ? '(' + r.refl + ', ' + r.refl + ') fehlt' : '');
      reads.sym.innerHTML = ok(!r.sym, r.sym ? r.sym[0] + 'R' + r.sym[1] + ', aber nicht ' + r.sym[1] + 'R' + r.sym[0] : '');
      reads.anti.innerHTML = ok(!r.anti, r.anti ? r.anti[0] + 'R' + r.anti[1] + ' und ' + r.anti[1] + 'R' + r.anti[0] : '');
      reads.trans.innerHTML = ok(!r.trans, r.trans ? r.trans[0] + 'R' + r.trans[1] + ', ' + r.trans[1] + 'R' + r.trans[2] + ', aber nicht ' + r.trans[0] + 'R' + r.trans[2] : '');
      var hint;
      if (!r.refl && !r.sym && !r.trans) {
        var seen = {}, classes = [];
        X.forEach(function (x) { if (seen[x]) return; var c = X.filter(function (y) { return has(x, y); }); c.forEach(function (y) { seen[y] = 1; }); classes.push('{' + c.join(', ') + '}'); });
        hint = 'Äquivalenzrelation: reflexiv, symmetrisch und transitiv. Die ' + classes.length + ' Klassen ' + classes.join(', ') + ' zerlegen X.' + (!r.anti ? ' (Zugleich eine Halbordnung – das geht nur bei der Gleichheit.)' : '');
      } else if (!r.refl && !r.anti && !r.trans) {
        hint = r.incomparable ? 'Halbordnung, aber keine Totalordnung: ' + r.incomparable[0] + ' und ' + r.incomparable[1] + ' sind nicht vergleichbar.' : 'Totalordnung: eine Halbordnung, in der je zwei Elemente vergleichbar sind.';
      } else if (r.refl && !r.anti && !r.trans && X.every(function (x) { return !has(x, x); })) {
        hint = 'Keine Halbordnung, weil nicht reflexiv – eine sogenannte strikte Ordnung wie „<“.';
      } else {
        hint = 'Weder Halbordnung noch Äquivalenzrelation. Schalte Felder an oder aus, bis alle nötigen Eigenschaften erfüllt sind.';
      }
      reads.hint.textContent = hint;
      host.querySelectorAll('[data-rel]').forEach(function (b) { b.classList.toggle('is-on', b.getAttribute('data-rel') === active); });
    }
    host.querySelectorAll('[data-rel]').forEach(function (b) { b.addEventListener('click', function () { setPreset(b.getAttribute('data-rel')); }); });
    setPreset('teiler');
  }

  /* ---------- Interaktive Skizze: Abbildungs-Labor ---------- */
  function mappingExplorable(host) {
    var W = 360, H = 300, X = [1, 2, 3, 4], NAMES = ['a', 'b', 'c', 'd', 'e'];
    var presets = {
      bij: { label: 'bijektiv', n: 4, f: [1, 3, 0, 2] },
      inj: { label: 'injektiv, nicht surjektiv', n: 5, f: [0, 2, 3, 4] },
      sur: { label: 'surjektiv, nicht injektiv', n: 3, f: [0, 1, 2, 1] },
      none: { label: 'weder noch', n: 4, f: [0, 0, 2, 2] }
    };
    host.innerHTML =
      '<div class="ex-grid">' +
      '<svg class="ex-svg" viewBox="0 0 ' + W + ' ' + H + '" role="img" aria-label="Abbildung f von X nach Y als Pfeildiagramm"></svg>' +
      '<div class="ex-panel">' +
      '<div class="ex-presets">' + Object.keys(presets).map(function (k) { return '<button type="button" data-map="' + k + '">' + presets[k].label + '</button>'; }).join('') + '</div>' +
      '<label class="ex-slider">|Y|<input type="range" min="2" max="5" step="1" value="4"><output></output></label>' +
      '<dl class="ex-read"><dt>f(X)</dt><dd data-r="img"></dd><dt>injektiv</dt><dd data-r="inj"></dd><dt>surjektiv</dt><dd data-r="sur"></dd><dt>f⁻¹</dt><dd data-r="inv"></dd></dl>' +
      '<p class="ex-hint" data-r="hint"></p>' +
      '</div></div>';
    var svg = host.querySelector('svg'), slider = host.querySelector('input[type=range]'), out = host.querySelector('output');
    var reads = {}; host.querySelectorAll('[data-r]').forEach(function (r) { reads[r.getAttribute('data-r')] = r; });
    var n = 4, f = [1, 3, 0, 2], sel = null, active = 'bij';
    function py(i, cnt) { var step = cnt > 1 ? Math.min(62, 210 / (cnt - 1)) : 0; return Math.round(160 + (i - (cnt - 1) / 2) * step); }
    function draw() {
      out.value = n;
      var s = '<ellipse class="ex-set" cx="90" cy="160" rx="44" ry="122"/><ellipse class="ex-set" cx="270" cy="160" rx="44" ry="122"/>';
      s += '<text class="ex-lbl" x="80" y="26">X</text><text class="ex-lbl" x="262" y="26">Y</text><text class="ex-lbl" x="174" y="26">f</text>';
      X.forEach(function (x, i) {
        var y1 = py(i, 4), y2 = py(f[i], n), dx = 270 - 90, len = Math.hypot(dx - 28, y2 - y1), ux = (dx - 28) / len, uy = (y2 - y1) / len;
        var ex = 256, ey = y2, hx = ex - ux * 9, hy = ey - uy * 9;
        s += '<line class="ex-arrow" x1="104" y1="' + y1 + '" x2="' + ex + '" y2="' + ey + '"/>';
        s += '<polygon class="ex-arrow-head" points="' + ex + ',' + ey + ' ' + (hx - uy * 4).toFixed(1) + ',' + (hy + ux * 4).toFixed(1) + ' ' + (hx + uy * 4).toFixed(1) + ',' + (hy - ux * 4).toFixed(1) + '"/>';
      });
      var hits = NAMES.slice(0, n).map(function (_, j) { return f.filter(function (v) { return v === j; }).length; });
      X.forEach(function (x, i) {
        s += '<g class="map-node' + (sel === i ? ' is-sel' : '') + '" data-x="' + i + '" tabindex="0" role="button" aria-label="Element ' + x + ' auswählen"><circle cx="90" cy="' + py(i, 4) + '" r="13"/><text x="90" y="' + (py(i, 4) + 5) + '">' + x + '</text></g>';
      });
      NAMES.slice(0, n).forEach(function (nm, j) {
        s += '<g class="map-node map-y' + (hits[j] === 0 ? ' is-miss' : hits[j] > 1 ? ' is-multi' : '') + (sel !== null ? ' is-target' : '') + '" data-y="' + j + '" tabindex="0" role="button" aria-label="Bild ' + nm + ' wählen"><circle cx="270" cy="' + py(j, n) + '" r="13"/><text x="270" y="' + (py(j, n) + 5) + '">' + nm + '</text></g>';
      });
      svg.innerHTML = s;
      svg.querySelectorAll('[data-x]').forEach(function (g) { var a = function () { sel = +g.getAttribute('data-x'); active = null; draw(); }; g.addEventListener('click', a); g.addEventListener('keydown', function (e) { if (e.key === 'Enter' || e.key === ' ') { e.preventDefault(); a(); } }); });
      svg.querySelectorAll('[data-y]').forEach(function (g) { var a = function () { if (sel === null) return; f[sel] = +g.getAttribute('data-y'); sel = null; active = null; draw(); }; g.addEventListener('click', a); g.addEventListener('keydown', function (e) { if (e.key === 'Enter' || e.key === ' ') { e.preventDefault(); a(); } }); });
      var img = NAMES.slice(0, n).filter(function (_, j) { return hits[j] > 0; });
      var dup = hits.indexOf(Math.max.apply(null, hits)), miss = hits.indexOf(0);
      var inj = Math.max.apply(null, hits) <= 1, sur = miss < 0;
      reads.img.textContent = '{' + img.join(', ') + '}';
      reads.inj.innerHTML = inj ? '<span class="rel-ok">✓ ja</span>' : '<span class="rel-no">✗ nein</span> <span class="rel-why">' + X.filter(function (_, i) { return f[i] === dup; }).map(function (x) { return 'f(' + x + ')'; }).join(' = ') + ' = ' + NAMES[dup] + '</span>';
      reads.sur.innerHTML = sur ? '<span class="rel-ok">✓ ja</span>' : '<span class="rel-no">✗ nein</span> <span class="rel-why">' + NAMES[miss] + ' wird nicht getroffen</span>';
      reads.inv.textContent = inj && sur ? NAMES.slice(0, n).map(function (nm, j) { return nm + ' ↦ ' + X[f.indexOf(j)]; }).join(', ') : 'existiert nicht';
      var hint = sel !== null ? 'Wähle rechts das Bild von ' + X[sel] + '.' :
        n < 4 ? '|Y| < |X|: Zwei Elemente müssen dasselbe Bild haben – injektiv ist hier unmöglich.' :
        n > 4 ? '|Y| > |X|: Mindestens ein Element von Y bleibt übrig – surjektiv ist hier unmöglich.' :
        '|X| = |Y|: Hier sind injektiv, surjektiv und bijektiv gleichwertig – probiere es aus.';
      reads.hint.textContent = hint;
      host.querySelectorAll('[data-map]').forEach(function (b) { b.classList.toggle('is-on', b.getAttribute('data-map') === active); });
    }
    slider.addEventListener('input', function () { n = +slider.value; f = f.map(function (v, i) { return Math.min(v, n - 1); }); sel = null; active = null; draw(); });
    host.querySelectorAll('[data-map]').forEach(function (b) { b.addEventListener('click', function () { var p = presets[b.getAttribute('data-map')]; n = p.n; slider.value = n; f = p.f.slice(); sel = null; active = b.getAttribute('data-map'); draw(); }); });
    draw();
  }

  document.querySelectorAll('[data-explorable]').forEach(function (host) {
    var kind = host.getAttribute('data-explorable');
    if (kind === 'matrix') matrixExplorable(host);
    if (kind === 'ode') odeExplorable(host);
    if (kind === 'cobweb') cobwebExplorable(host);
    if (kind === 'implicit') implicitExplorable(host);
    if (kind === 'truth') truthExplorable(host);
    if (kind === 'venn') vennExplorable(host);
    if (kind === 'quantor') quantorExplorable(host);
    if (kind === 'relation') relationExplorable(host);
    if (kind === 'mapping') mappingExplorable(host);
  });

  document.querySelectorAll('.lernbereich').forEach(math);
  updateLernpfad();
})();
