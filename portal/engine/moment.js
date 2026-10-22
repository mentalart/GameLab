/* Лучший момент игры (Д4 аудита 21.10.2026): кольцо последних 5 секунд кадров в малом разрешении.
   Работает в обеих рамках: в оболочке «Лаб3D» (game.html, кадр берёт render() сразу после отрисовки — LabMoment.grab(холст))
   и в игре-странице из чата Qwen (мост portal.js подгружает этот файл и включает LabMoment.auto(): кадр берётся после кадра
   requestAnimationFrame, в котором был вызов отрисовки WebGL, — буфер холста ещё цел; 2D-холст — в любом кадре).
   Конец партии (portal.over, end() оболочки) замораживает копию кольца — LabMoment.hold(): ролик кончается на последней секунде партии.
   Портал просит ролик сообщением { target: 'lab-game', type: 'moment', id, from: 'over' | 'now' } и получает
   { source: 'lab-game', type: 'moment', id, w, h, fps, frames: [ArrayBuffer RGBA] }; GIF собирает страница портала (games.js).
   Нагрузка: 10 кадров в секунду не больше 192 × 112 (createImageBitmap с уменьшением, без чтения пикселей),
   при LAB_LOWRES — 5 кадров по 128 × 72. Пиксели читаются только по запросу ролика. */
(function () {
  'use strict';
  if (window.LabMoment) return;
  var SEC = 5;
  var lowres = function () { return !!window.LAB_LOWRES; };
  var fps = function () { return lowres() ? 5 : 10; };
  var ring = [], held = null, heldAt = 0, last = 0, busy = 0, isGl = false, drew = null, off = false;
  var stats = { grabs: 0, ms: 0 };
  function size(c) {
    var w = c.width, h = c.height, mw = lowres() ? 128 : 192, mh = lowres() ? 72 : 112;
    if (!w || !h) return null;
    var k = Math.min(mw / w, mh / h, 1);
    return { w: Math.max(8, Math.round(w * k / 2) * 2), h: Math.max(8, Math.round(h * k / 2) * 2) };
  }
  function drop(b) { if ((!held || held.indexOf(b) < 0) && ring.indexOf(b) < 0 && b.close) b.close(); }
  function keep(b) {
    ring.push(b);
    var max = fps() * SEC;
    while (ring.length > max) drop(ring.shift());
  }
  function grab(c) {
    if (off || !c || !c.width) return;
    var now = performance.now();
    if (now - last < 1000 / fps() - 5 || busy > 2) return;
    var s = size(c);
    if (!s) return;
    last = now;
    var t0 = performance.now();
    try {
      if (window.createImageBitmap) {
        busy++;
        createImageBitmap(c, { resizeWidth: s.w, resizeHeight: s.h, resizeQuality: 'low' })
          .then(function (b) { busy--; keep(b); }, function () { busy--; });
      } else {
        var x = document.createElement('canvas'); x.width = s.w; x.height = s.h;
        x.getContext('2d').drawImage(c, 0, 0, s.w, s.h); keep(x);
      }
    } catch (e) { busy = Math.max(0, busy - 1); }
    stats.grabs++; stats.ms += performance.now() - t0;
  }
  // самый большой видимый холст страницы — для игр на 2D-холсте
  function biggest() {
    var best = null, area = 0, list = document.getElementsByTagName('canvas');
    for (var i = 0; i < list.length; i++) { var a = list[i].clientWidth * list[i].clientHeight; if (a > area) { area = a; best = list[i]; } }
    return best;
  }
  function auto() {
    ['WebGLRenderingContext', 'WebGL2RenderingContext'].forEach(function (n) {
      var P = window[n] && window[n].prototype;
      if (!P) return;
      ['drawArrays', 'drawElements', 'drawArraysInstanced', 'drawElementsInstanced', 'drawRangeElements'].forEach(function (f) {
        var o = P[f];
        if (typeof o !== 'function' || o.__labMoment) return;
        var w = function () { var c = this.canvas; if (c && (!drew || c.width * c.height > drew.width * drew.height)) drew = c; return o.apply(this, arguments); };
        w.__labMoment = true; P[f] = w;
      });
    });
    var raf = window.requestAnimationFrame;
    if (typeof raf !== 'function' || raf.__labMoment) return;
    var wrapped = function (cb) {
      return raf.call(window, function (t) {
        drew = null; // считаются только вызовы отрисовки этого кадра: после него буфер WebGL ещё цел
        try { cb(t); } finally {
          try {
            if (drew) { if (!isGl) { isGl = true; ring.slice().forEach(function (b) { ring.splice(ring.indexOf(b), 1); drop(b); }); } var c = drew; drew = null; if (typeof HTMLCanvasElement === 'undefined' || c instanceof HTMLCanvasElement) grab(c); }
            else if (!isGl && performance.now() - last >= 1000 / fps() - 5) grab(biggest());
          } catch (e) { /* кадр не взят — игра идёт дальше */ }
        }
      });
    };
    wrapped.__labMoment = true;
    window.requestAnimationFrame = wrapped;
  }
  function hold() {
    if (held) { var old = held; held = null; old.forEach(drop); }
    held = ring.slice(); heldAt = performance.now();
  }
  function send(m, transfer) { m.source = 'lab-game'; try { if (window.parent !== window) window.parent.postMessage(m, '*', transfer || []); } catch (e) { /* без портала */ } }
  function clip(id, from) {
    // ролик партии — замороженное кольцо конца партии (свежее минуты), иначе последние 5 секунд прямо сейчас
    var list = from === 'over' && held && held.length && performance.now() - heldAt < 60000 ? held : ring.slice();
    if (!list.length) { send({ type: 'moment', id: id, error: 'нет кадров: сыграй хотя бы пару секунд' }); return; }
    var w = list[list.length - 1].width, h = list[list.length - 1].height;
    var x = document.createElement('canvas'); x.width = w; x.height = h;
    var g = x.getContext('2d', { willReadFrequently: true }), frames = [];
    list.forEach(function (b) { g.clearRect(0, 0, w, h); g.drawImage(b, 0, 0, w, h); frames.push(g.getImageData(0, 0, w, h).data.buffer); });
    send({ type: 'moment', id: id, w: w, h: h, fps: fps(), frames: frames }, frames);
  }
  addEventListener('message', function (e) {
    var m = e.data || {};
    if (m.target !== 'lab-game') return;
    if (m.type === 'moment') { try { clip(m.id, m.from); } catch (err) { send({ type: 'moment', id: m.id, error: String(err && err.message || err) }); } }
    if (m.type === 'momentOff') off = !!m.off; // проверка нагрузки: та же игра без записи
  });
  window.LabMoment = { grab: grab, auto: auto, hold: hold, clip: clip, get frames() { return ring.length; }, get stats() { return { grabs: stats.grabs, ms: Math.round(stats.ms * 10) / 10, frames: ring.length, gl: isGl, off: off }; }, set off(v) { off = !!v; } };
})();
