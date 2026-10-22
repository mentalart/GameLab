/* Мост «игра HTML ↔ портал» (игры пишет Qwen в чате, без оболочки Лаб3D).
   Портал вставляет этот скрипт первым в <head> каждой игры-страницы. Игра видит объект portal:
     const cfg = portal.knobs({ speed: { value: 8, min: 2, max: 20, step: 0.5, label: 'Скорость героя' } }, { 'Новичок': { speed: 5 } });
       — ручки геймдизайнера: cfg.speed — текущее значение; панель ручек (Tab или Select на геймпаде) рисует мост;
     portal.paused — открыта панель ручек, игра стоит;
     portal.over(очки) — конец партии (рекорд класса и плейтест), portal.again() — новая партия,
     portal.count('событие') — счётчик партии (_secret — сработала спрятанная механика), portal.onRecord = (рекорд, мой) => {} — рекорд класса,
     portal.score(очки) — текущий счёт (из него полоска партии по секундам), portal.hurt() — герою нанесён урон,
     portal.notes(['что программист решил сам', ...]) — записи программиста для шага «Найди, где ИИ своевольничал» (портал читает их из кода).
     portal.levels([{ name, map }], легенда) — уровни как данные (модуль 4): свои и уровни гостей; portal.level(i[, карта]) — начался уровень,
       portal.death(x, y), portal.where(x, y), portal.secret(x, y) — точки в клетках карты для тепловой карты, portal.clear({ moves, time }) — уровень пройден.
     portal.net — сеть класса (урок 26): on — портал передаёт игроков, others — [{ nick, x, y, z, ... }] соседей, room — правила и фаза забега,
       now() — часы сервера в мс, send({ x, y, ... }) — моё положение (портал отправляет не чаще 10 раз в секунду).
     portal.share('Узор дня 3/6\n🟨⬛🟩⬛⬛\n…') — сетка-результат без спойлеров (модуль 6): уходит порталу с концом партии.
     portal.input — 'pad' или 'keys': чем игрок управляет сейчас. Подписи кнопок игра пишет парой <span class="keys-only">Пробел</span><span class="pad-only">A</span>,
       мост показывает нужную: геймпад подключён или нажата его кнопка — pad-only, нажата клавиша — keys-only.
   Страховка конца партии: Start на геймпаде после portal.over(), если игра сама не начала новую партию, нажимает за неё Enter, потом R.
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
  var tele, held = {}, padHeld = {}, score = 0, t = 0, lastFrame = 0, isOver = false;
  function reset() { tele = { presses: {}, hold: {}, hurts: 0, marks: {}, line: [], spots: [], maps: {}, share: '' }; if (typeof LV === 'object' && LV) { LV.lastWhere = -1; LV.gen = {}; } BTN.forEach(function (k) { tele.presses[k] = 0; tele.hold[k] = 0; }); counts = {}; score = 0; t = 0; }
  reset();
  function teleData() {
    var hold = {}; BTN.forEach(function (k) { hold[k] = Math.round(tele.hold[k] * 10) / 10; });
    return { time: Math.round(t * 10) / 10, presses: JSON.parse(JSON.stringify(tele.presses)), hold: hold, hurts: tele.hurts, custom: JSON.parse(JSON.stringify(counts)), marks: JSON.parse(JSON.stringify(tele.marks)), line: tele.line.slice(0, 600), spots: tele.spots.slice(), maps: JSON.parse(JSON.stringify(tele.maps)), share: tele.share };
  }
  var title = function () { return document.title || 'Игра'; };
  function hello() { if (ready) return; ready = true; send({ type: 'ready', meta: { html: true, title: title(), config: config, presets: presets, controls: [], decisions: [], notes: [] } }); }
  function changed() { var out = {}; for (var k in config) if (values[k] !== config[k].value) out[k] = values[k]; send({ type: 'cfg', cfg: out }); }
  function setValues(cfg) { for (var k in cfg) if (Object.prototype.hasOwnProperty.call(config, k)) values[k] = Number(cfg[k]); else pending[k] = Number(cfg[k]); if (panel) draw(); }
  var portal = {
    paused: false,
    net: { on: false, others: [], room: {}, at: 0, clock: 0, now: function () { return portal.net.clock + (performance.now() - portal.net.at); }, send: function (me) { if (portal.net.on) send({ type: 'net', me: me }); } },
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
      isOver = true;
      var s = Math.round(Number(final != null ? final : score) || 0);
      while (tele.line.length < Math.min(600, Math.floor(t) + 1)) tele.line.push(s);
      send({ type: 'over', score: s, tele: teleData() }); reset();
    },
    again: function () { isOver = false; reset(); send({ type: 'again' }); },
    count: function (name) {
      name = String(name); counts[name] = (counts[name] || 0) + 1; if (name === '_secret') lupaHit();
      if (name.charAt(0) === '_') { var m = tele.marks[name] = tele.marks[name] || []; if (m.length < 200) m.push(Math.round(t * 10) / 10); } // секунда партии — для полоски спрятанной механики
    },
    score: function (n) { score = Math.round(Number(n) || 0); },
    hurt: function () { tele.hurts++; },
    notes: function () { /* записи программиста портал читает из кода игры */ },
    // сетка-результат без спойлеров (модуль 6, урок 23): строки квадратиков 🟩🟨⬛ — уходит порталу с концом партии, класс видит сетки друг друга
    share: function (text) { tele.share = String(text == null ? '' : text).slice(0, 400); },
    // уровни как данные (модуль 4): игра отдаёт свои уровни текстом и легенду символов, получает свои и уровни гостей
    levels: function (list, legend) {
      var own = [], i, g = guest(), out;
      for (i = 0; i < (list && list.length || 0) && own.length < 30; i++) { var n = normLevel(list[i]); if (n) own.push(n); }
      LV.legend = {};
      if (legend && typeof legend === 'object') for (var k in legend) LV.legend[String(k).charAt(0)] = String(legend[k]).slice(0, 30);
      out = own;
      if (g && g.list && g.list.length) {
        var gl = [];
        for (i = 0; i < g.list.length && i < 12; i++) { var x = normLevel(g.list[i]); if (x) { x.guest = String(g.list[i].author || 'гость').slice(0, 24); gl.push(x); } }
        out = g.mode === 'add' ? own.concat(gl) : gl;
      }
      LV.list = out; LV.cur = 0;
      send({ type: 'levels', legend: LV.legend, list: own, playing: out.map(function (x) { return { name: x.name, guest: x.guest || null }; }) });
      return out.map(function (x) { return { name: x.name, map: x.map, guest: x.guest || null }; });
    },
    level: function (i, map) {
      LV.cur = Math.max(0, Math.round(Number(i) || 0));
      var lv = LV.list[LV.cur] || {};
      if (map != null) { var m = normLevel({ name: lv.name, map: map }); if (m) LV.gen[LV.cur] = m.map; }
      noteMap();
      send({ type: 'level', level: LV.cur, name: lv.name || '' });
    },
    death: function (x, y) { spot('d', x, y); },
    where: function (x, y) { if (t - LV.lastWhere < 0.5) return; LV.lastWhere = t; spot('w', x, y); },
    secret: function (x, y) { spot('s', x, y); },
    clear: function (o) {
      o = o || {}; var lv = LV.list[LV.cur] || {};
      send({ type: 'clear', level: LV.cur, name: lv.name || '', guest: lv.guest || null, map: LV.gen[LV.cur] || lv.map || '', moves: o.moves == null ? null : Math.round(Number(o.moves) || 0), time: Math.round((o.time == null ? t : Number(o.time) || 0) * 10) / 10, score: score });
    },
  };
  // уровни партии: свои и гостей (?levels=<base64 JSON> в адресе — редактор и галерея; window.__labGuest — уровни, принятые автором)
  var LV = { list: [], legend: {}, cur: 0, lastWhere: -1, gen: {} };
  function normLevel(x) {
    if (!x || typeof x !== 'object') return null;
    var lines = (Object.prototype.toString.call(x.map) === '[object Array]' ? x.map.join('\n') : String(x.map || '')).replace(/\r/g, '').split('\n');
    while (lines.length && !lines[0].replace(/\s/g, '')) lines.shift();
    while (lines.length && !lines[lines.length - 1].replace(/\s/g, '')) lines.pop();
    lines = lines.slice(0, 60).map(function (l) { return l.slice(0, 120); }); // 120 — большая карта урока-квеста (три плато, 108 клеток)
    return lines.length ? { name: String(x.name || 'Уровень').slice(0, 40), map: lines.join('\n') } : null;
  }
  function guest() {
    var m = /[?&]levels=([^&#]+)/.exec(location.search || '');
    if (m) { try { return JSON.parse(decodeURIComponent(escape(atob(decodeURIComponent(m[1]).replace(/-/g, '+').replace(/_/g, '/'))))); } catch (e) { /* испорченный адрес — свои уровни */ } }
    return window.__labGuest || null;
  }
  function noteMap() {
    var lv = LV.list[LV.cur], map = LV.gen[LV.cur] || (lv && lv.map), n = 0;
    for (var k in tele.maps) n++;
    if (map && !tele.maps[LV.cur] && n < 8) tele.maps[LV.cur] = { name: lv ? lv.name : 'Уровень ' + (LV.cur + 1), map: map };
  }
  function spot(k, x, y) {
    x = Number(x); y = Number(y);
    if (!isFinite(x) || !isFinite(y) || tele.spots.length >= 420) return;
    noteMap();
    tele.spots.push([k, Math.round(x * 10) / 10, Math.round(y * 10) / 10, LV.cur]);
  }
  // подписи кнопок: геймпад или клавиатура — класс на <html>, стиль прячет вторую подпись
  var input = 'keys';
  Object.defineProperty(portal, 'input', { get: function () { return input; } });
  function setInput(kind) {
    if (kind === input && document.documentElement.getAttribute('data-input') === kind) return;
    input = kind; document.documentElement.setAttribute('data-input', kind);
  }
  (function () {
    var st = document.createElement('style');
    st.textContent = 'html:not([data-input=pad]) .pad-only{display:none!important}html[data-input=pad] .keys-only{display:none!important}';
    (document.head || document.documentElement).appendChild(st);
    document.documentElement.setAttribute('data-input', 'keys');
  })();
  addEventListener('gamepadconnected', function () { setInput('pad'); });
  // Enter, R — то, чем по заданию закрывается экран конца партии; keyCode — для игр, которые читают старое поле
  function pressKey(code, key, keyCode) {
    var target = document.activeElement && document.activeElement !== document.body ? document.activeElement : document;
    ['keydown', 'keyup'].forEach(function (type, i) {
      setTimeout(function () {
        var ev = new KeyboardEvent(type, { key: key, code: code, bubbles: true, cancelable: true });
        try { Object.defineProperty(ev, 'keyCode', { get: function () { return keyCode; } }); Object.defineProperty(ev, 'which', { get: function () { return keyCode; } }); } catch (e) { /* поле только для чтения */ }
        target.dispatchEvent(ev);
      }, i * 60);
    });
  }
  function startOnOver() {
    if (!isOver) return;
    setTimeout(function () { if (isOver) pressKey('Enter', 'Enter', 13); }, 200);
    setTimeout(function () { if (isOver) pressKey('KeyR', 'r', 82); }, 450);
  }
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
  addEventListener('keydown', function (e) { if (e.isTrusted) setInput('keys'); var k = KEYS[e.code]; if (k && !held[e.code] && !portal.paused) { tele.presses[k]++; } if (k) held[e.code] = k; }, true);
  addEventListener('keyup', function (e) { delete held[e.code]; }, true);
  addEventListener('blur', function () { held = {}; });
  var selectWas = false, startWas = false;
  (function pad(now) {
    var gp = (navigator.getGamepads ? Array.prototype.slice.call(navigator.getGamepads()) : []).filter(Boolean);
    var sel = gp.some(function (g) { return g.buttons[8] && g.buttons[8].pressed; });
    if (sel && !selectWas && document.body) toggle();
    selectWas = sel;
    var start = gp.some(function (g) { return g.buttons[9] && g.buttons[9].pressed; });
    if (start && !startWas && !portal.paused) startOnOver();
    startWas = start;
    if (gp.some(function (g) { return g.buttons.some(function (b) { return b && b.pressed; }) || g.axes.some(function (a) { return Math.abs(a) > 0.5; }); })) setInput('pad');
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

  // лупа спрятанной механики (урок 1, «Посмотри на спрятанную механику»): портал присылает reveal с названием, каждый portal.count('_secret') зажигает значок
  var lupa = null;
  function lupaHit() {
    if (!lupa) return;
    lupa.n++; lupa.box.lastChild.textContent = ' × ' + lupa.n;
    lupa.box.style.opacity = '1'; lupa.box.style.borderColor = '#ffe08a'; lupa.box.style.color = '#ffe08a';
    clearTimeout(lupa.t); lupa.t = setTimeout(function () { lupa.box.style.opacity = '.45'; lupa.box.style.borderColor = '#ffffff33'; lupa.box.style.color = '#f2efe6'; }, 900);
  }
  function setLupa(title) {
    if (lupa) { lupa.box.remove(); lupa = null; }
    if (!title || !document.body) return;
    var box = document.createElement('div');
    box.style.cssText = 'position:fixed;top:10px;left:50%;transform:translateX(-50%);z-index:2147483646;pointer-events:none;padding:6px 14px;border-radius:999px;background:rgba(0,0,0,.65);border:2px solid #ffffff33;color:#f2efe6;font:700 15px system-ui,sans-serif;opacity:.45;transition:opacity .25s';
    box.textContent = '🔍 Спрятанная механика: ' + String(title).slice(0, 80);
    box.append(document.createElement('b'));
    document.body.append(box); lupa = { box: box, n: 0, t: 0 };
  }
  addEventListener('message', function (e) {
    var m = e.data || {};
    if (m.target !== 'lab-game') return;
    if (m.type === 'reveal') setLupa(m.title);
    if (m.type === 'setCfg') setValues(m.cfg || {});
    if (m.type === 'net') { var N = portal.net; N.on = true; N.others = Array.isArray(m.others) ? m.others.slice(0, 60) : []; N.room = m.room && typeof m.room === 'object' ? m.room : {}; N.at = performance.now(); N.clock = Number(m.now) || Date.now(); }
    if (m.type === 'records') { last = { record: m.record, best: m.best }; if (typeof onRecord === 'function') onRecord(m.record, m.best); }
    if (m.type === 'playtest') send({ type: 'playtest', error: 'игра без оболочки Лаб3D: бот-плейтестер в неё не играет' });
    if (m.type === 'botShow') send({ type: 'showDone', error: 'игра без оболочки Лаб3D: бот в неё не играет' });
  });
  addEventListener('error', function (e) { send({ type: 'error', phase: ready ? 'update' : 'загрузка', message: String(e.message || 'ошибка'), line: e.lineno || null }); });
  addEventListener('unhandledrejection', function (e) { send({ type: 'error', phase: 'update', message: String((e.reason && e.reason.message) || e.reason || 'ошибка'), line: null }); });
  // игра без ручек всё равно «запустилась»: через 3 секунды после загрузки
  addEventListener('load', function () { setTimeout(hello, 3000); });
})();
