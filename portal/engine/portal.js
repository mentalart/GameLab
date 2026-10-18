/* Мост «игра HTML ↔ портал» (урок 1, версия 2: игры пишет Qwen в чате, без Babylon.js и оболочки Лаб3D).
   Портал вставляет этот скрипт первым в <head> каждой игры-страницы. Игра видит объект portal:
     const cfg = portal.knobs({ speed: { value: 8, min: 2, max: 20, step: 0.5, label: 'Скорость героя' } }, { 'Новичок': { speed: 5 } });
       — ручки геймдизайнера: cfg.speed — текущее значение; панель ручек (Tab или Select на геймпаде) рисует мост;
     portal.paused — открыта панель ручек, игра стоит;
     portal.over(очки) — конец партии (рекорд класса и плейтест), portal.again() — новая партия,
     portal.count('событие') — счётчик партии (_secret — сработал секрет), portal.onRecord = (рекорд, мой) => {} — рекорд класса,
     portal.score(очки) — текущий счёт (из него полоска партии по секундам), portal.hurt() — герою нанесён урон,
     portal.notes(['что программист решил сам', ...]) — записи программиста для шага «Найди, где ИИ своевольничал» (портал читает их из кода).
   Остальную телеметрию партии мост считает сам (урок 1, чекпоинт 5 «Разбор прототипа», 18.10.2026): длину партии без пауз,
   нажатия и удержание клавиш и геймпада, урон, счёт по секундам и секунды, на которых срабатывали скрытые счётчики («_secret»).
   Мост сообщает порталу «запустилась» и ошибки со строкой — по ним портал выдаёт сообщение для того же чата. */
(function () {
  'use strict';
  var send = function (m) { m.source = 'lab-game'; try { if (window.parent !== window) window.parent.postMessage(m, '*'); } catch (e) { /* без портала */ } };
  var config = {}, presets = {}, values = {}, pending = {}, counts = {}, ready = false, onRecord = null, last = null, panel = null;
  // телеметрия партии — те же поля, что у оболочки Лаб3D: time, presses, hold, hurts, custom, marks, line
  var BTN = ['left', 'right', 'up', 'down', 'a', 'b'];
  var KEYS = { ArrowLeft: 'left', KeyA: 'left', ArrowRight: 'right', KeyD: 'right', ArrowUp: 'up', KeyW: 'up', ArrowDown: 'down', KeyS: 'down', Space: 'a', ShiftLeft: 'b', ShiftRight: 'b' };
  var tele, held = {}, padHeld = {}, score = 0, t = 0, lastFrame = 0;
  function reset() { tele = { presses: {}, hold: {}, hurts: 0, marks: {}, line: [] }; BTN.forEach(function (k) { tele.presses[k] = 0; tele.hold[k] = 0; }); counts = {}; score = 0; t = 0; }
  reset();
  function teleData() {
    var hold = {}; BTN.forEach(function (k) { hold[k] = Math.round(tele.hold[k] * 10) / 10; });
    return { time: Math.round(t * 10) / 10, presses: JSON.parse(JSON.stringify(tele.presses)), hold: hold, hurts: tele.hurts, custom: JSON.parse(JSON.stringify(counts)), marks: JSON.parse(JSON.stringify(tele.marks)), line: tele.line.slice(0, 600) };
  }
  var title = function () { return document.title || 'Игра'; };
  function hello() { if (ready) return; ready = true; send({ type: 'ready', meta: { html: true, title: title(), config: config, presets: presets, controls: [], decisions: [], notes: [] } }); }
  function changed() { var out = {}; for (var k in config) if (values[k] !== config[k].value) out[k] = values[k]; send({ type: 'cfg', cfg: out }); }
  function setValues(cfg) { for (var k in cfg) if (Object.prototype.hasOwnProperty.call(config, k)) values[k] = Number(cfg[k]); else pending[k] = Number(cfg[k]); if (panel) draw(); }
  var portal = {
    paused: false,
    knobs: function (cfg, pre) {
      config = {}; presets = pre || {};
      for (var k in cfg || {}) {
        var c = cfg[k], v = Number(c && typeof c === 'object' ? c.value : c);
        config[k] = { value: v, min: Number(c.min != null ? c.min : 0), max: Number(c.max != null ? c.max : v * 2 || 1), step: Number(c.step || 0) || (Number.isInteger(v) ? 1 : 0.1), label: String(c.label || k) };
        values[k] = k in pending ? pending[k] : v;
      }
      hello();
      return values;
    },
    over: function (final) {
      var s = Math.round(Number(final != null ? final : score) || 0);
      while (tele.line.length < Math.min(600, Math.floor(t) + 1)) tele.line.push(s);
      send({ type: 'over', score: s, tele: teleData() }); reset();
    },
    again: function () { reset(); send({ type: 'again' }); },
    count: function (name) {
      name = String(name); counts[name] = (counts[name] || 0) + 1;
      if (name.charAt(0) === '_') { var m = tele.marks[name] = tele.marks[name] || []; if (m.length < 200) m.push(Math.round(t * 10) / 10); } // секунда партии — для полоски секрета
    },
    score: function (n) { score = Math.round(Number(n) || 0); },
    hurt: function () { tele.hurts++; },
    notes: function () { /* записи программиста портал читает из кода игры */ },
  };
  Object.defineProperty(portal, 'onRecord', { get: function () { return onRecord; }, set: function (f) { onRecord = f; if (last && typeof f === 'function') f(last.record, last.best); } });
  window.portal = portal;

  // панель ручек: Tab или Select (кнопка 8) на геймпаде; игра стоит, пока панель открыта
  function draw() {
    panel.innerHTML = '';
    var h = document.createElement('div'); h.textContent = 'Ручки геймдизайнера'; h.style.cssText = 'font-weight:800;color:#7cf5a8;margin-bottom:8px'; panel.append(h);
    var row = document.createElement('div'); row.style.cssText = 'display:flex;flex-wrap:wrap;gap:6px;margin-bottom:10px';
    var all = { 'Как задумано': {} }; for (var p in presets) all[p] = presets[p];
    Object.keys(all).forEach(function (name) {
      var b = document.createElement('button'); b.textContent = name; b.style.cssText = 'font:13px system-ui;background:#1b2440;color:#f2efe6;border:1px solid #2a3560;border-radius:8px;padding:4px 10px;cursor:pointer';
      b.onclick = function () { for (var k in config) values[k] = config[k].value; setValues(all[name]); changed(); };
      row.append(b);
    });
    panel.append(row);
    Object.keys(config).forEach(function (k) {
      var c = config[k], box = document.createElement('label'), out = document.createElement('b'), r = document.createElement('input');
      box.style.cssText = 'display:block;margin:8px 0;font-size:13px'; box.textContent = c.label + ': ';
      out.textContent = values[k]; out.style.color = values[k] !== c.value ? '#ffb547' : '#7cf5a8';
      r.type = 'range'; r.min = c.min; r.max = c.max; r.step = c.step; r.value = values[k]; r.style.cssText = 'width:100%;accent-color:#7cf5a8';
      r.oninput = function () { values[k] = Number(r.value); out.textContent = r.value; out.style.color = values[k] !== c.value ? '#ffb547' : '#7cf5a8'; changed(); };
      box.append(out, r); panel.append(box);
    });
    if (!Object.keys(config).length) panel.append('В игре нет ручек: программист не вызвал portal.knobs.');
  }
  function toggle() {
    if (panel) { panel.remove(); panel = null; portal.paused = false; return; }
    panel = document.createElement('div');
    panel.style.cssText = 'position:fixed;top:10px;right:10px;bottom:10px;width:min(320px,90vw);overflow:auto;z-index:2147483647;background:rgba(10,14,30,.95);color:#f2efe6;border:1px solid #7cf5a8;border-radius:12px;padding:14px;font:14px system-ui,sans-serif';
    document.body.append(panel); portal.paused = true; draw();
  }
  addEventListener('keydown', function (e) { if (e.key === 'Tab') { e.preventDefault(); e.stopImmediatePropagation(); toggle(); } }, true);
  // нажатия клавиатуры для телеметрии: повтор клавиши при удержании — не новое нажатие
  addEventListener('keydown', function (e) { var k = KEYS[e.code]; if (k && !held[e.code] && !portal.paused) { tele.presses[k]++; } if (k) held[e.code] = k; }, true);
  addEventListener('keyup', function (e) { delete held[e.code]; }, true);
  addEventListener('blur', function () { held = {}; });
  var selectWas = false;
  (function pad(now) {
    var gp = (navigator.getGamepads ? Array.prototype.slice.call(navigator.getGamepads()) : []).filter(Boolean);
    var sel = gp.some(function (g) { return g.buttons[8] && g.buttons[8].pressed; });
    if (sel && !selectWas && document.body) toggle();
    selectWas = sel;
    // время партии идёт, пока игра запущена и панель ручек закрыта; счёт по секундам — для полоски партии
    var dt = lastFrame && now ? Math.min(0.1, (now - lastFrame) / 1000) : 0; lastFrame = now || 0;
    if (ready && !portal.paused && dt > 0) {
      t += dt;
      while (tele.line.length < Math.min(600, Math.floor(t) + 1)) tele.line.push(score);
      var on = {};
      for (var c in held) on[held[c]] = true;
      gp.forEach(function (g) {
        var b = function (i) { return !!(g.buttons[i] && g.buttons[i].pressed); }, x = g.axes[0] || 0, y = g.axes[1] || 0;
        var now2 = { left: b(14) || x < -0.5, right: b(15) || x > 0.5, up: b(12) || y < -0.5, down: b(13) || y > 0.5, a: b(0), b: b(1) };
        BTN.forEach(function (k) { if (now2[k]) { on[k] = true; if (!padHeld[g.index + k]) tele.presses[k]++; } padHeld[g.index + k] = now2[k]; });
      });
      BTN.forEach(function (k) { if (on[k]) tele.hold[k] += dt; });
    }
    requestAnimationFrame(pad);
  })();

  addEventListener('message', function (e) {
    var m = e.data || {};
    if (m.target !== 'lab-game') return;
    if (m.type === 'setCfg') setValues(m.cfg || {});
    if (m.type === 'records') { last = { record: m.record, best: m.best }; if (typeof onRecord === 'function') onRecord(m.record, m.best); }
    if (m.type === 'playtest') send({ type: 'playtest', error: 'игра без оболочки Лаб3D: бот-плейтестер в неё не играет' });
  });
  addEventListener('error', function (e) { send({ type: 'error', phase: ready ? 'update' : 'загрузка', message: String(e.message || 'ошибка'), line: e.lineno || null }); });
  addEventListener('unhandledrejection', function (e) { send({ type: 'error', phase: 'update', message: String((e.reason && e.reason.message) || e.reason || 'ошибка'), line: null }); });
  // игра без ручек всё равно «запустилась»: через 3 секунды после загрузки
  addEventListener('load', function () { setTimeout(hello, 3000); });
})();
