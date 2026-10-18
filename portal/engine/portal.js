/* Мост «игра HTML ↔ портал» (урок 1, версия 2: игры пишет Qwen в чате, без Babylon.js и оболочки Лаб3D).
   Портал вставляет этот скрипт первым в <head> каждой игры-страницы. Игра видит объект portal:
     const cfg = portal.knobs({ speed: { value: 8, min: 2, max: 20, step: 0.5, label: 'Скорость героя' } }, { 'Новичок': { speed: 5 } });
       — ручки геймдизайнера: cfg.speed — текущее значение; панель ручек (Tab или Select на геймпаде) рисует мост;
     portal.paused — открыта панель ручек, игра стоит;
     portal.over(очки) — конец партии (рекорд класса и плейтест), portal.again() — новая партия,
     portal.count('событие') — счётчик партии (_secret — сработал секрет), portal.onRecord = (рекорд, мой) => {} — рекорд класса.
   Мост сообщает порталу «запустилась» и ошибки со строкой — по ним портал выдаёт сообщение для того же чата. */
(function () {
  'use strict';
  var send = function (m) { m.source = 'lab-game'; try { if (window.parent !== window) window.parent.postMessage(m, '*'); } catch (e) { /* без портала */ } };
  var config = {}, presets = {}, values = {}, pending = {}, counts = {}, ready = false, onRecord = null, last = null, panel = null;
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
    over: function (score) { send({ type: 'over', score: Math.round(Number(score) || 0), tele: { custom: counts } }); counts = {}; },
    again: function () { counts = {}; send({ type: 'again' }); },
    count: function (name) { name = String(name); counts[name] = (counts[name] || 0) + 1; },
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
  var selectWas = false;
  (function pad() {
    var gp = (navigator.getGamepads ? Array.prototype.slice.call(navigator.getGamepads()) : []).filter(Boolean);
    var sel = gp.some(function (g) { return g.buttons[8] && g.buttons[8].pressed; });
    if (sel && !selectWas && document.body) toggle();
    selectWas = sel; requestAnimationFrame(pad);
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
