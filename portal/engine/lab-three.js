/* =====================================================================
   Лаборатория игр · оболочка игры «Лаб3D 1.0» для three.js 0.170.0
   ---------------------------------------------------------------------
   Игра — один объект GAME (engine: 'three') на обычном three.js.
   Оболочка делает служебное, одинаковое для всех игр курса:
   жизненный цикл партии и экраны, ввод (клавиатура, два геймпада, тач),
   ручки геймдизайнера (Tab) с пресетами, камеры, свет, тени, свечение,
   сочность, звук, случайность по зерну, телеметрию, рекорды, призрака,
   бота-плейтестера и связь с порталом (страница engine/game.html).
   Контракт GAME и API объекта lab описаны в portal/engine/README.md.
   ===================================================================== */
import * as THREE from 'three';
import { EffectComposer } from 'three/addons/postprocessing/EffectComposer.js';
import { RenderPass } from 'three/addons/postprocessing/RenderPass.js';
import { UnrealBloomPass } from 'three/addons/postprocessing/UnrealBloomPass.js';
import { OutputPass } from 'three/addons/postprocessing/OutputPass.js';
import { RoomEnvironment } from 'three/addons/environments/RoomEnvironment.js';
import * as BufferGeometryUtils from 'three/addons/utils/BufferGeometryUtils.js';
import * as SkeletonUtils from 'three/addons/utils/SkeletonUtils.js';
import { RoundedBoxGeometry } from 'three/addons/geometries/RoundedBoxGeometry.js';
import { GLTFLoader } from 'three/addons/loaders/GLTFLoader.js';
import { SimplexNoise } from 'three/addons/math/SimplexNoise.js';

window.THREE = THREE; // игра пользуется глобальным THREE внутри start и update
const $ = s => document.querySelector(s);
const SHELL_VERSION = '1.0';
const V3 = THREE.Vector3;

/* ---------------- хранилище и связь с порталом ---------------- */
const store = {
  get(k) { try { return localStorage.getItem(k); } catch (e) { return null; } },
  set(k, v) { try { localStorage.setItem(k, v); } catch (e) { /* хранилище недоступно (песочница) */ } },
};
const post = m => { if (bot && m.type !== 'playtest' && m.type !== 'playtestStep' && m.type !== 'showStep') return; try { if (window.parent !== window) window.parent.postMessage(Object.assign({ source: 'lab-game' }, m), '*'); } catch (e) { /* нет портала */ } };
const params = new URLSearchParams(location.search);

/* ---------------- звук: Web Audio без файлов ---------------- */
let AC = null, master = null, noiseBuf = null, muted = store.get('lab3d:muted') === '1';
function audio() {
  if (AC) { if (AC.state === 'suspended') AC.resume(); return; }
  try {
    AC = new (window.AudioContext || window.webkitAudioContext)();
    const comp = AC.createDynamicsCompressor(); // много звуков разом не хрипят
    comp.threshold.value = -14; comp.ratio.value = 6; comp.connect(AC.destination);
    master = AC.createGain(); master.gain.value = 0.5; master.connect(comp);
    noiseBuf = AC.createBuffer(1, AC.sampleRate, AC.sampleRate);
    const d = noiseBuf.getChannelData(0); for (let i = 0; i < d.length; i++) d[i] = Math.random() * 2 - 1;
  } catch (e) { AC = null; }
}
function tone(freq, dur = 0.12, type = 'square', vol = 0.1, slideTo = 0, delay = 0) {
  if (!AC || muted || !on('sound')) return;
  try {
    const t = AC.currentTime + delay, o = AC.createOscillator(), gn = AC.createGain();
    o.type = type; o.frequency.setValueAtTime(Math.max(20, freq), t);
    if (slideTo) o.frequency.exponentialRampToValueAtTime(Math.max(20, slideTo), t + dur);
    gn.gain.setValueAtTime(0.0001, t); gn.gain.linearRampToValueAtTime(vol, t + 0.005); // без щелчка в начале
    gn.gain.exponentialRampToValueAtTime(0.0001, t + dur);
    o.connect(gn); gn.connect(master); o.start(t); o.stop(t + dur + 0.02);
  } catch (e) { /* звук не критичен */ }
}
function noise(dur = 0.2, vol = 0.15, freq = 1000, delay = 0) {
  if (!AC || muted || !on('sound')) return;
  try {
    const t = AC.currentTime + delay, s = AC.createBufferSource(), f = AC.createBiquadFilter(), gn = AC.createGain();
    s.buffer = noiseBuf; f.type = 'lowpass'; f.frequency.value = freq;
    gn.gain.setValueAtTime(vol, t); gn.gain.exponentialRampToValueAtTime(0.0001, t + dur);
    s.connect(f); f.connect(gn); gn.connect(master); s.start(t, Math.random() * 0.5); s.stop(t + dur + 0.02);
  } catch (e) { /* звук не критичен */ }
}
const sfx = {
  jump: () => { tone(330, 0.12, 'square', 0.06, 720); tone(660, 0.08, 'triangle', 0.04, 1200, 0.02); },
  shoot: () => { tone(980, 0.07, 'square', 0.05, 420); noise(0.06, 0.06, 4500); },
  coin: () => { tone(988, 0.07, 'triangle', 0.1); tone(1319, 0.14, 'triangle', 0.1, 0, 0.06); },
  hit: () => { tone(320, 0.3, 'sawtooth', 0.13, 60); noise(0.25, 0.22, 1400); tone(90, 0.2, 'sine', 0.2, 40); },
  explode: () => { noise(0.5, 0.28, 650); tone(120, 0.4, 'sine', 0.28, 35); noise(0.12, 0.15, 3000); },
  power: () => [523, 659, 784, 1046].forEach((f, i) => tone(f, 0.1, 'square', 0.06, 0, i * 0.06)),
  beep: () => tone(660, 0.1, 'square', 0.07),
  warn: () => { tone(520, 0.08, 'square', 0.05); tone(520, 0.08, 'square', 0.05, 0, 0.12); },
  whoosh: () => { noise(0.25, 0.1, 3000); tone(200, 0.25, 'sine', 0.07, 900); },
  win: () => [523, 659, 784, 1046, 1318].forEach((f, i) => tone(f, 0.18, 'triangle', 0.1, 0, i * 0.09)),
  lose: () => [784, 622, 523, 392].forEach((f, i) => tone(f, 0.24, 'triangle', 0.12, 0, i * 0.14)),
};

/* ---------------- случайность по зерну ---------------- */
function mulberry32(a) {
  return function () {
    a |= 0; a = a + 0x6D2B79F5 | 0;
    let t = Math.imul(a ^ a >>> 15, 1 | a);
    t = t + Math.imul(t ^ t >>> 7, 61 | t) ^ t;
    return ((t ^ t >>> 14) >>> 0) / 4294967296;
  };
}
let rng = Math.random;
let fixedSeed = params.has('seed') ? (Number(params.get('seed')) >>> 0) : null;
let overAt = 0; // когда показан экран конца партии
let ghost = null, challengeOn = false; // вызов «побей мой мир»: призрак соперника и есть ли кнопка вызова под игрой
let bot = null, heroObj = null; // бот-плейтестер играет сам (тогда партия не уходит порталу); герой — для проверки «не ушёл ли за кадр»
const rngFx = Math.random; // эффекты не трогают зерно игры

/* ---------------- ввод ---------------- */
const BTN = ['left', 'right', 'up', 'down', 'a', 'b'];
function mkPlayer() {
  const p = { x: 0, y: 0, pressed: {}, released: {} };
  BTN.forEach(k => { p[k] = false; p.pressed[k] = false; p.released[k] = false; });
  return p;
}
const P = [mkPlayer(), mkPlayer()];
const kb = [{}, {}], pad = [{}, {}], tch = {};
const kbTap = [{}, {}]; // короткое нажатие между кадрами не теряется даже при 10 кадрах в секунду
const padAx = [[0, 0], [0, 0]];
const prevHeld = [{}, {}];
let armed = true, padMode = false, padPrevMenu = [];
const KEYS_SOLO = {
  ArrowLeft: 'left', KeyA: 'left', ArrowRight: 'right', KeyD: 'right', ArrowUp: 'up', KeyW: 'up', ArrowDown: 'down', KeyS: 'down',
  Space: 'a', KeyJ: 'a', KeyZ: 'a', ShiftLeft: 'b', ShiftRight: 'b', KeyX: 'b', KeyK: 'b',
};
const KEYS_DUO = {
  KeyA: [0, 'left'], KeyD: [0, 'right'], KeyW: [0, 'up'], KeyS: [0, 'down'], KeyF: [0, 'a'], KeyG: [0, 'b'],
  ArrowLeft: [1, 'left'], ArrowRight: [1, 'right'], ArrowUp: [1, 'up'], ArrowDown: [1, 'down'], KeyK: [1, 'a'], KeyL: [1, 'b'],
};
function usesMove4() { return !!(G && (G.controls || []).some(c => c.input === 'move4')); }
// вдвоём: players: 2 всегда или ручка из GAME.duo, когда она ≥ 1 (например, пресет «Вдвоём» в игре на одного)
function duo() { return !!G && (G.players === 2 || (!!G.duo && Number(cfg[G.duo]) >= 1)); }
function keyTarget(code) {
  if (duo()) return KEYS_DUO[code] || null;
  let k = KEYS_SOLO[code];
  if (!k) return null;
  if (!usesMove4() && (code === 'ArrowUp' || code === 'KeyW')) k = 'a'; // в играх «влево-вправо» стрелка вверх — главная кнопка
  return [0, k];
}
function pollPads() {
  for (let i = 0; i < 2; i++) { for (const k of BTN) pad[i][k] = false; padAx[i][0] = 0; padAx[i][1] = 0; }
  if (!navigator.getGamepads) return;
  let list; try { list = [...navigator.getGamepads()].filter(Boolean); } catch (e) { return; }
  let any = false;
  list.forEach((gp, n) => {
    const who = duo() ? Math.min(n, 1) : 0;
    const b = gp.buttons.map(x => !!(x && x.pressed)), ax = gp.axes[0] || 0, ay = gp.axes[1] || 0;
    const h = pad[who];
    h.left = h.left || ax < -0.4 || b[14]; h.right = h.right || ax > 0.4 || b[15];
    h.up = h.up || ay < -0.4 || b[12]; h.down = h.down || ay > 0.4 || b[13];
    h.a = h.a || b[0] || b[7]; h.b = h.b || b[1] || b[2] || b[6];
    if (!usesMove4() && !duo() && b[12]) h.a = true;
    if (Math.hypot(ax, ay) > 0.25) { padAx[who][0] = ax; padAx[who][1] = -ay; }
    if (b.some(Boolean) || Math.hypot(ax, ay) > 0.4) any = true;
    if (n === 0) {
      const down = i => b[i] && !padPrevMenu[i];
      if (down(0) && state === 'menu') confirm(); // конец партии кнопкой A не закрывается: ею только что играли — закрывает Start
      if (down(9)) { if (state === 'play') setPause(!paused); else confirm(); }
      if (down(8)) togglePanel();
      padPrevMenu = b;
    }
  });
  if (any) setPadMode(true);
}
function readInput() {
  pollPads();
  const anyAB = [0, 1].some(i => kb[i].a || kb[i].b || pad[i].a || pad[i].b) || tch.a || tch.b;
  if (!armed && !anyAB) armed = true;
  for (let i = 0; i < 2; i++) {
    const p = P[i];
    for (const k of BTN) {
      let v = !!(kb[i][k] || kbTap[i][k] || pad[i][k] || (i === 0 && tch[k]));
      if (!armed && (k === 'a' || k === 'b')) v = false; // нажатие, которым запущена партия, не засчитывается
      p.pressed[k] = v && !prevHeld[i][k];
      p.released[k] = !v && !!prevHeld[i][k];
      p[k] = v; prevHeld[i][k] = v;
    }
    const dx = (p.right ? 1 : 0) - (p.left ? 1 : 0), dy = (p.up ? 1 : 0) - (p.down ? 1 : 0);
    p.x = padAx[i][0] || dx; p.y = padAx[i][1] || dy;
  }
  for (const h of kbTap) for (const k in h) h[k] = false;
}
function disarm() { armed = false; for (const h of kbTap) for (const k in h) h[k] = false; }
function rumble(ms = 150, strength = 0.6) {
  if (!on('vibrate') || bot) return;
  try {
    for (const gp of navigator.getGamepads()) if (gp && gp.vibrationActuator) gp.vibrationActuator.playEffect('dual-rumble', { duration: ms, strongMagnitude: strength, weakMagnitude: strength * 0.6 });
  } catch (e) { /* без вибрации */ }
}
function setPadMode(v) { if (v === padMode) return; padMode = v; labels(); }

/* ---------------- состояние оболочки ---------------- */
const canvas = $('#cv');
let renderer = null, composer = null, bloom = null, envTex = null;
let G = null, state = 'loading', paused = false, errored = false, freshPreview = false;
let scene = null, cam = null, skyTex = null;
let parts = null, popups = [], warns = [], pulses = [], whites = [], rings = [], trails = [], tweens = [], timers = [], follow = null, sceneGen = 0;
let shakeAmp = 0, flashA = 0, hitstopT = 0, matCache = {}, glowMats = [];
let greyOn = false, greyMat = null; // серый прототип: материал-заменитель на всю сцену
const cfg = {}, DEFAULTS = {}, META = {};
const tele = { presses: {}, hold: {}, hurts: 0, custom: {}, stats: {}, marks: {}, line: [], spots: [], maps: {} }; // line — счёт на каждой секунде партии (призрак соперника в вызове)
const session = { rounds: 0, restarts: 0 };
let classRecord = null;
let frameNo = 0, fps = 0, lastDraws = 0, lastTris = 0; const frameWaiters = [];

const SHELL_KNOBS = {
  shake: { value: 1, min: 0, max: 2, step: 0.1, label: 'Тряска камеры' },
  juice: { value: 1, min: 0, max: 2, step: 0.1, label: 'Сочность частиц' },
  glow: { value: 1, min: 0, max: 2, step: 0.1, label: 'Свечение' },
  quality: { value: 1, min: 0, max: 2, step: 1, label: 'Качество графики', names: ['быстро', 'обычно', 'красиво'], restart: true },
};
// 12 переключателей сочности (урок 6): каждый эффект оболочки можно выключить в любой игре, механика остаётся той же.
// Пресеты игры могут их менять (пресет «Без спрятанной механики» выключает все), «Как задумано» включает обратно.
const JUICE = [['hitstop', 'Стоп-кадр на ударе'], ['shake', 'Тряска камеры'], ['squash', 'Сжатие и растяжение'], ['burst', 'Частицы'],
  ['flash', 'Вспышка экрана'], ['whiten', 'Вспышка попадания'], ['popup', 'Всплывающие очки и надписи'], ['sound', 'Звук'],
  ['pitch', 'Звук выше с каждым ударом подряд'], ['vibrate', 'Вибрация геймпада'], ['glow', 'Свечение'], ['slowmo', 'Замедление в решающий момент']];
for (const [k, label] of JUICE) SHELL_KNOBS['j_' + k] = { value: 1, min: 0, max: 1, step: 1, label, names: ['выкл', 'вкл'], juice: true };
// серый прототип (модуль 8, урок 30): все модели — один серый цвет, фон серый, без сочности и звука; механика та же. Пресет может включить
SHELL_KNOBS.grey = { value: 0, min: 0, max: 1, step: 1, label: 'Серый прототип', names: ['цвет', 'серый'], juice: true };
const grey = () => cfg.grey >= 1;
function on(name) { if (grey() && name !== 'popup') return false; return !(('j_' + name) in cfg) || cfg['j_' + name] >= 1; }
let slowT = 0, slowK = 1;

/* ---------------- плавность: easing ---------------- */
const ease = {
  linear: k => k,
  inQuad: k => k * k, outQuad: k => k * (2 - k), inOutQuad: k => (k < 0.5 ? 2 * k * k : -1 + (4 - 2 * k) * k),
  inCubic: k => k * k * k, outCubic: k => 1 - Math.pow(1 - k, 3), inOutCubic: k => (k < 0.5 ? 4 * k * k * k : 1 - Math.pow(-2 * k + 2, 3) / 2),
  outBack: k => { const c = 1.70158; return 1 + (c + 1) * Math.pow(k - 1, 3) + c * Math.pow(k - 1, 2); },
  outElastic: k => (k === 0 || k === 1 ? k : Math.pow(2, -10 * k) * Math.sin((k * 10 - 0.75) * (2 * Math.PI) / 3) + 1),
  outBounce: k => { const n = 7.5625, d = 2.75; if (k < 1 / d) return n * k * k; if (k < 2 / d) return n * (k -= 1.5 / d) * k + 0.75; if (k < 2.5 / d) return n * (k -= 2.25 / d) * k + 0.9375; return n * (k -= 2.625 / d) * k + 0.984375; },
};

/* ---------------- API для игры: объект lab ---------------- */
const lab = {
  THREE, renderer: null, scene: null, camera: null, light: null, shadows: false,
  addons: { BufferGeometryUtils, SkeletonUtils, RoundedBoxGeometry, GLTFLoader, SimplexNoise },
  view: null, // камера-штатив: { kind, tilt, turn, distance, target } — можно менять каждый кадр
  t: 0, dt: 0, state: {}, cfg, seed: 0, round: 0, data: {}, // data — данные от портала (урок 7: мелодия ученика из секвенсора)
  p1: P[0], p2: P[1], players: 1,
  score: 0, lives: 3, invuln: 0, best: 0,
  // сеть (урок 26, «Арена класса»): портал пересылает игру класса через сервер. on — портал на связи, others — другие игроки
  // ({ n, x, y, z, ry, a, c, f }), room — забег ({ round, phase, start, rules, results }), now() — часы сервера в мс; send(me) — своё место
  net: { on: false, others: [], room: {}, at: 0, clock: 0, now() { return lab.net.clock + (performance.now() - lab.net.at); }, send(me) { if (lab.net.on) post({ type: 'net', me }); } },
  get playing() { return state === 'play' && !paused; },

  // очки, жизни, конец партии
  addScore(n, at, color) { lab.score += n; if (at) lab.popup(at, (n > 0 ? '+' : '') + n, color || accent()); },
  hurt(at, text) {
    if (lab.invuln > 0 || state !== 'play') return false;
    tele.hurts++;
    lab.invuln = 1.2; if (on('hitstop')) hitstopT = Math.max(hitstopT, 0.08);
    lab.shake(0.9); lab.flash('#ff4d5e', 0.35); sfx.hit(); rumble(250, 0.9);
    if (at) { lab.burst(at, { count: 22, colors: ['#ff4d5e', '#ffb35c', '#ffffff'], speed: 7 }); lab.ring(at, { color: '#ff4d5e', radius: 2.5 }); }
    if (bot) bot.hurtsAt.push(Math.round(lab.t * 10) / 10);
    if (lab.lives > 0) { lab.lives--; if (lab.lives <= 0) lab.gameOver(text); }
    return true;
  },
  blink() { return lab.invuln > 0 && Math.floor(lab.invuln * 12) % 2 === 0; },
  gameOver(text) { end('lose', text || 'Игра окончена'); },
  win(text) { end('win', text || 'Победа!'); },

  // сочность
  shake(power = 0.5) { if (on('shake')) shakeAmp = Math.max(shakeAmp, power * cfg.shake); },
  flash(color = '#ffffff', alpha = 0.3) { if (!on('flash')) return; $('#flash').style.background = color; flashA = Math.max(flashA, alpha * Math.min(1, cfg.juice || 1)); },
  hitstop(sec = 0.06) { if (on('hitstop')) hitstopT = Math.max(hitstopT, sec); },
  burst(at, o = {}) { if (on('burst')) burst(posOf(at), o); },
  ring(at, o = {}) { if (on('burst')) ring(posOf(at), o); },
  trail(obj, o = {}) { return trail(obj, o); },
  popup(at, text, color = '#ffffff', size = 18) { if (on('popup')) popup(at, text, color, size); },
  pulse(obj, k = 1.3, sec = 0.14) { if (on('squash') && obj && obj.scale && !pulses.some(p => p.obj === obj)) pulses.push({ obj, base: obj.scale.clone(), k, t: 0, dur: sec }); },
  whiten(obj, sec = 0.08, color = '#ffffff') { if (obj && on('whiten')) whiten(obj, sec, color); },
  slowmo(sec = 0.6, scale = 0.3) { if (on('slowmo')) { slowT = Math.max(slowT, sec); slowK = lab.clamp(scale, 0.05, 1); } },
  pitch(n = 0) { return on('pitch') ? Math.pow(2, Math.min(Math.max(0, n), 24) / 12) : 1; }, // на полутон выше с каждым ударом подряд
  juicy(name) { return on(name); }, // свой эффект игры подчиняется переключателю: lab.juicy('squash')
  warn(at, radius = 1, sec = 0.6, color = '#ff4d5e') { return warn(posOf(at), radius, sec, color); },
  vibrate: rumble,

  // плавность и таймеры игрового времени (останавливаются на паузе, стоп-кадре и при перезапуске)
  ease,
  tween(sec, fn, how = 'outCubic') { const f = typeof how === 'function' ? how : (ease[how] || ease.linear); const h = { t: 0, sec: Math.max(0.001, sec), fn, f, done: false, cancel() { h.done = true; } }; tweens.push(h); safe(() => fn(0), 'tween'); return h; },
  after(sec, fn) { const h = { at: lab.t + sec, fn, done: false, cancel() { h.done = true; } }; timers.push(h); return h; },

  // звук
  sfx, tone, noise,

  // случайность по зерну и математика
  rand(a = 0, b = 1) { return a + (b - a) * rng(); },
  randInt(a, b) { return Math.floor(a + (b - a + 1) * rng()); },
  pick(arr) { return arr[Math.floor(rng() * arr.length)]; },
  chance(p) { return rng() < p; },
  clamp(v, a, b) { return Math.max(a, Math.min(b, v)); },
  lerp(a, b, k) { return a + (b - a) * k; },
  damp(a, b, rate, dt) { return a + (b - a) * (1 - Math.exp(-rate * dt)); }, // плавное приближение, не зависит от частоты кадров
  v3(x = 0, y = 0, z = 0) { return new V3(x, y, z); },
  dist(a, b) { return posOf(a).distanceTo(posOf(b)); },
  flat(a, b) { const p = posOf(a), q = posOf(b); return Math.hypot(p.x - q.x, p.z - q.z); },
  near(a, b, r) { return lab.dist(a, b) < r; },

  // мир
  color(hex) { return new THREE.Color(hex); },
  mat(hex, o = {}) { return mat(hex, o); },
  add(obj, parent) { (parent || scene).add(obj); return obj; },
  mesh(geo, look, o = {}) { return place(new THREE.Mesh(geo, matOf(look, o)), o); },
  box(w = 1, h = 1, d = 1, look = '#cccccc', o = {}) { return lab.mesh(o.round ? new RoundedBoxGeometry(w, h, d, 2, Math.min(o.round, w / 2, h / 2, d / 2)) : new THREE.BoxGeometry(w, h, d), look, o); },
  ball(r = 0.5, look = '#cccccc', o = {}) { return lab.mesh(new THREE.IcosahedronGeometry(r, o.detail == null ? 1 : o.detail), look, o); },
  cyl(rTop = 0.5, rBottom = 0.5, h = 1, look = '#cccccc', o = {}) { return lab.mesh(new THREE.CylinderGeometry(rTop, rBottom, h, o.sides || 8), look, o); },
  cone(r = 0.5, h = 1, look = '#cccccc', o = {}) { return lab.mesh(new THREE.ConeGeometry(r, h, o.sides || 7), look, o); },
  group(o = {}) { return place(new THREE.Group(), o); },
  ground(o = {}) { return ground(o); },
  instances(geo, look, count, o = {}) { const m = new THREE.InstancedMesh(geo, matOf(look, o), count); m.count = count; for (let i = 0; i < count; i++) m.setMatrixAt(i, ZERO); return place(m, o); },
  place(inst, i, at, o = {}) { // одна копия InstancedMesh: место, поворот (число — вокруг Y, или [x, y, z]), размер (число или [x, y, z]), цвет
    const p = posOf(at), r = o.rot == null ? 0 : o.rot, s = o.scale == null ? 1 : o.scale;
    _e.set(Array.isArray(r) ? r[0] : 0, Array.isArray(r) ? r[1] : r, Array.isArray(r) ? r[2] : 0);
    _m.compose(p, _q.setFromEuler(_e), Array.isArray(s) ? _s.set(s[0], s[1], s[2]) : _s.set(s, s, s));
    inst.setMatrixAt(i, _m); inst.instanceMatrix.needsUpdate = true;
    if (o.color) { inst.setColorAt(i, _c.set(o.color)); inst.instanceColor.needsUpdate = true; }
    inst.computeBoundingSphere();
    return inst;
  },
  merge(list, parent) { return merge(list, parent); },
  shadow(obj) { if (obj) obj.traverse(m => { m.userData.noShadow = false; if (m.isMesh) m.castShadow = true; }); return obj; },
  noShadow(obj) { if (obj) obj.traverse(m => { m.userData.noShadow = true; if (m.isMesh) m.castShadow = false; }); return obj; },
  hero(obj) { heroObj = obj || null; }, // главный герой: бот-плейтестер проверяет, что он не уходит за кадр
  follow(obj, o = {}) { if (obj && !heroObj) heroObj = obj; follow = obj ? { obj, distance: o.distance || 9, height: o.height || 4, lag: o.lag == null ? 0.15 : o.lag, look: o.look || 1 } : null; },
  setCamera(kind, o) { setupCamera(kind, o); },
  toScreen(at) { const s = projectToScreen(posOf(at)); return { x: s.x, y: s.y, visible: s.z > -1 && s.z < 1 }; },

  // интерфейс и телеметрия
  // o: { color: '#rrggbb', size: 10..32 } — строка своего цвета и размера (цепочка цвета ряда, ступень ствола, тревога)
  hud(key, text, o) { if (text == null) delete hudLines[key]; else hudLines[key] = { text: String(text), color: o && hexOk(o.color), size: o && o.size ? Math.min(32, Math.max(10, Number(o.size) || 13)) : 0 }; },
  // имя с «_» — скрытый счётчик: уходит порталу, на экран конца партии не попадает; его моменты (секунда партии) копятся в marks для раскрытия спрятанной механики
  count(name, n = 1) {
    tele.custom[name] = (tele.custom[name] || 0) + n;
    if (name === '_secret') lupaHit();
    if (name[0] !== '_') return;
    const m = tele.marks[name] = tele.marks[name] || [], t = Math.round(lab.t * 10) / 10;
    if (m.length < 300 && !(m.length && t - m[m.length - 1] < 0.25)) m.push(t);
  },
  stat(name, value) { tele.stats[name] = value; },

  // уровни как данные (модуль 4): уровень — текстовая карта, символ — клетка. Игра отдаёт свои уровни и легенду,
  // а получает свои и уровни гостей (редактор и галерея портала: ?levels= в адресе или lab.data.levels; принятые автором — window.__labGuest).
  levels(list, legend) {
    const own = (Array.isArray(list) ? list : []).map(normLevel).filter(Boolean);
    LV.legend = legend && typeof legend === 'object' ? Object.fromEntries(Object.entries(legend).slice(0, 24).map(([k, v]) => [String(k).slice(0, 1), String(v).slice(0, 30)])) : {};
    const g = guestLevels();
    let out = own;
    if (g && Array.isArray(g.list) && g.list.length) {
      const gl = g.list.map(x => { const n = normLevel(x); return n && Object.assign(n, { guest: String(x.author || 'гость').slice(0, 24) }); }).filter(Boolean);
      out = g.mode === 'add' ? own.concat(gl) : gl;
    }
    LV.list = out; LV.cur = 0;
    post({ type: 'levels', legend: LV.legend, list: own.slice(0, 30), playing: out.map(x => ({ name: x.name, guest: x.guest || null })) });
    return out.map(x => Object.assign({}, x));
  },
  // начался уровень i; у сгенерированного уровня (урок 17) — его карта вторым аргументом
  level(i, map) {
    LV.cur = Math.max(0, Math.round(Number(i) || 0));
    const lv = LV.list[LV.cur] || {}, m = map != null ? normLevel({ name: lv.name || 'Уровень ' + (LV.cur + 1), map }) : null;
    if (m) LV.gen[LV.cur] = m.map;
    noteMap();
    post({ type: 'level', level: LV.cur, name: lv.name || (m && m.name) || '' });
  },
  // точка на карте уровня в клетках: 'death' — герой погиб здесь, 'where' — где герой сейчас (берётся раз в 0,5 с), 'secret' — найден секрет
  spot(kind, x, y) {
    if (!Number.isFinite(Number(x)) || !Number.isFinite(Number(y))) return;
    const k = { death: 'd', where: 'w', secret: 's' }[kind] || 'w';
    if (k === 'w') { if (lab.t - LV.lastWhere < 0.5) return; LV.lastWhere = lab.t; }
    if (tele.spots.length >= 420 || (k === 'w' && tele.spots.filter(s => s[0] === 'w').length >= 300)) return;
    noteMap();
    tele.spots.push([k, Math.round(x * 10) / 10, Math.round(y * 10) / 10, LV.cur]);
  },
  // уровень пройден: портал засчитывает гостевой уровень строителю (редактор) и пар в галерее
  clear(o = {}) {
    const lv = LV.list[LV.cur] || {};
    post({ type: 'clear', level: LV.cur, name: lv.name || '', guest: lv.guest || null, map: LV.gen[LV.cur] || lv.map || '', moves: o.moves == null ? null : Math.round(Number(o.moves) || 0), time: Math.round((o.time == null ? lab.t : Number(o.time) || 0) * 10) / 10, score: Math.round(lab.score) });
  },
};
// уровни партии: список, легенда, текущий уровень, карты сгенерированных уровней
const LV = { list: [], legend: {}, cur: 0, lastWhere: -1, gen: {} };
function normLevel(x) {
  if (!x || typeof x !== 'object') return null;
  let lines = (Array.isArray(x.map) ? x.map.join('\n') : String(x.map || '')).replace(/\r/g, '').split('\n');
  while (lines.length && !lines[0].trim()) lines.shift();
  while (lines.length && !lines[lines.length - 1].trim()) lines.pop();
  lines = lines.slice(0, 60).map(l => l.slice(0, 80));
  return lines.length ? { name: String(x.name || 'Уровень').slice(0, 40), map: lines.join('\n') } : null;
}
const b64json = s => { try { return JSON.parse(decodeURIComponent(escape(atob(String(s).replace(/-/g, '+').replace(/_/g, '/'))))); } catch (e) { return null; } };
const URL_LEVELS = params.get('levels') ? b64json(params.get('levels')) : null;
function guestLevels() { return (lab.data && lab.data.levels) || URL_LEVELS || window.__labGuest || null; }
// карта уровня — один раз за партию в телеметрию: по ней портал рисует тепловую карту
function noteMap() {
  const lv = LV.list[LV.cur], map = LV.gen[LV.cur] || (lv && lv.map);
  if (map && !tele.maps[LV.cur] && Object.keys(tele.maps).length < 8) tele.maps[LV.cur] = { name: lv ? lv.name : 'Уровень ' + (LV.cur + 1), map };
}
let hudLines = {};
const accent = () => (G && G.accent) || '#ffe08a';
const ZERO = new THREE.Matrix4().makeScale(0, 0, 0);
const _m = new THREE.Matrix4(), _q = new THREE.Quaternion(), _e = new THREE.Euler(), _s = new V3(), _c = new THREE.Color(), _v = new V3(), _w = new V3();
// «где» — объект сцены, Vector3, { x, y, z } или [x, y, z]
const posOf = a => (a && a.isObject3D) ? a.getWorldPosition(new V3()) : (a && a.isVector3) ? a : Array.isArray(a) ? new V3(a[0] || 0, a[1] || 0, a[2] || 0) : new V3((a && a.x) || 0, (a && a.y) || 0, (a && a.z) || 0);

function matOf(look, o) { return look && look.isMaterial ? look : mat(look || '#cccccc', o); }
function place(obj, o = {}) {
  if (o.at) obj.position.copy(posOf(o.at));
  if (o.rot != null) { if (Array.isArray(o.rot)) obj.rotation.set(o.rot[0] || 0, o.rot[1] || 0, o.rot[2] || 0); else obj.rotation.y = o.rot; }
  if (o.scale != null) { if (Array.isArray(o.scale)) obj.scale.set(o.scale[0], o.scale[1], o.scale[2]); else obj.scale.setScalar(o.scale); }
  if (o.shadow === false) lab.noShadow(obj);
  if (o.parent !== null) (o.parent || scene).add(obj);
  return obj;
}
// материал из кэша: лоуполи по умолчанию (плоские грани), glow — светится и даёт ореол, unlit — без света, alpha — прозрачность
function mat(hex, o = {}) {
  const key = hex + JSON.stringify(o, ['glow', 'alpha', 'unlit', 'shiny', 'smooth', 'metal', 'rough', 'side', 'add']);
  if (matCache[key]) return matCache[key];
  const color = new THREE.Color(hex);
  let m;
  if (o.unlit) {
    m = new THREE.MeshBasicMaterial({ color });
    if (o.glow) { m.color.multiplyScalar(1 + o.glow * glowK()); m.userData.glowBase = color.clone(); m.userData.glow = o.glow; glowMats.push(m); }
  } else {
    m = new THREE.MeshStandardMaterial({ color, roughness: o.rough != null ? o.rough : o.shiny ? 0.25 : 0.82, metalness: o.metal || 0, flatShading: !o.smooth });
    if (o.glow) { m.emissive = color.clone(); m.emissiveIntensity = o.glow * 1.6 * glowK(); m.userData.glow = o.glow; glowMats.push(m); }
  }
  if (o.alpha != null && o.alpha < 1) { m.transparent = true; m.opacity = o.alpha; m.depthWrite = o.alpha > 0.6; }
  if (o.add) { m.transparent = true; m.blending = THREE.AdditiveBlending; m.depthWrite = false; }
  if (o.side === 'double') m.side = THREE.DoubleSide;
  matCache[key] = m;
  return m;
}
const glowK = () => (on('glow') ? Math.max(0.15, cfg.glow == null ? 1 : cfg.glow) : 0.35);
function updateGlow() {
  for (const m of glowMats) {
    if (m.isMeshBasicMaterial) m.color.copy(m.userData.glowBase).multiplyScalar(1 + m.userData.glow * glowK());
    else m.emissiveIntensity = m.userData.glow * 1.6 * glowK();
  }
  if (bloom) { bloom.strength = 0.6 * cfg.glow * (on('glow') ? 1 : 0); bloom.enabled = bloom.strength > 0; }
}
function ground(o = {}) {
  const w = o.w || 60, h = o.h || 60, seg = o.bumps ? Math.max(8, Math.round(Math.max(w, h) / 2)) : 1;
  const geo = new THREE.PlaneGeometry(w, h, seg, seg);
  geo.rotateX(-Math.PI / 2);
  if (o.bumps) { // лоуполи-холмики: края поля поднимаются, в середине ровно — играть не мешают
    const r = mulberry32((lab.seed ^ 0x51ed) >>> 0), pos = geo.attributes.position, flat = o.flat == null ? 0.7 : o.flat;
    for (let i = 0; i < pos.count; i++) {
      const x = pos.getX(i), z = pos.getZ(i), edge = Math.max(Math.abs(x) / (w / 2), Math.abs(z) / (h / 2));
      const k = Math.max(0, (edge - flat) / Math.max(0.01, 1 - flat));
      pos.setY(i, k > 0 ? (r() - 0.35) * o.bumps * k * k * 3 : (r() - 0.5) * o.bumps * 0.012);
    }
    geo.computeVertexNormals();
  }
  const g = new THREE.Mesh(geo, mat(o.color || '#3f7d4a', { rough: 0.95 }));
  g.position.y = o.y || 0; g.receiveShadow = true; g.userData.noShadow = true; g.name = 'земля';
  scene.add(g);
  return g;
}
// слить неподвижные меши в один на каждый материал: десятки деревьев — один вызов отрисовки
function merge(list, parent) {
  const by = new Map();
  for (const root of [].concat(list)) {
    if (!root || root.isInstancedMesh) continue; // копии и так рисуются одной пачкой
    root.updateWorldMatrix(true, true);
    root.traverse(m => { if (m.isMesh && !m.isInstancedMesh) { const k = m.material.uuid; if (!by.has(k)) by.set(k, { mat: m.material, geos: [] }); by.get(k).geos.push(m.geometry.clone().applyMatrix4(m.matrixWorld)); } });
    if (root.parent) root.parent.remove(root);
    root.traverse(m => { if (m.geometry) m.geometry.dispose(); });
  }
  const out = new THREE.Group(); out.name = 'слитые';
  for (const { mat: m, geos } of by.values()) {
    const clean = geos.map(g => { const n = g.index ? g.toNonIndexed() : g; for (const a of Object.keys(n.attributes)) if (a !== 'position' && a !== 'normal') n.deleteAttribute(a); return n; });
    const geo = BufferGeometryUtils.mergeGeometries(clean, false);
    clean.forEach(g => g.dispose());
    if (geo) out.add(new THREE.Mesh(geo, m));
  }
  (parent || scene).add(out);
  return out;
}

/* ---------------- отрисовка: рендерер, постобработка, сцена, свет ---------------- */
function makeRenderer() {
  renderer = new THREE.WebGLRenderer({ canvas, antialias: false, powerPreference: 'high-performance' }); // сглаживание — в постобработке (MSAA)
  renderer.outputColorSpace = THREE.SRGBColorSpace;
  renderer.toneMapping = THREE.NeutralToneMapping; renderer.toneMappingExposure = 1; // нейтральная тонировка: цвета лоуполи остаются сочными
  renderer.shadowMap.type = THREE.PCFSoftShadowMap;
  renderer.info.autoReset = false; // вызовы отрисовки считаем за весь кадр (тени, сцена, свечение)
  lab.renderer = renderer;
  try { const pm = new THREE.PMREMGenerator(renderer); envTex = pm.fromScene(new RoomEnvironment(), 0.04).texture; pm.dispose(); } catch (e) { envTex = null; }
}
const quality = () => Math.round(cfg.quality == null ? 1 : cfg.quality);
function pixelRatio() { const d = window.devicePixelRatio || 1, q = quality(); return (q === 0 ? Math.min(d, 1) * 0.7 : q === 1 ? Math.min(d, 1.5) : Math.min(d, 2)) * dynScale * (window.LAB_LOWRES ? 0.5 : 1); } // LAB_LOWRES — для автопроверок без видеокарты
// своё разрешение под компьютер: кадр дольше 34 мс — картинка мельче (до половины), быстрее 18 мс — обратно. Игра и ручки этого не замечают
let dynScale = 1, dynSum = 0, dynN = 0;
function tuneResolution(real) {
  if (bot || document.hidden || real <= 0 || real > 0.2) return;
  dynSum += real; dynN++;
  if (dynSum < 1.5) return;
  const avg = dynSum / dynN; dynSum = 0; dynN = 0;
  const was = dynScale;
  if (avg > 0.034) dynScale = Math.max(0.5, dynScale * 0.85); else if (avg < 0.018) dynScale = Math.min(1, dynScale * 1.1);
  if (Math.abs(was - dynScale) > 0.01) resize();
}
function makeComposer() {
  if (composer) { composer.dispose(); composer = null; bloom = null; }
  if (quality() === 0) return;
  const w = Math.max(1, canvas.clientWidth), h = Math.max(1, canvas.clientHeight);
  const rt = new THREE.WebGLRenderTarget(w, h, { type: THREE.HalfFloatType, samples: quality() === 2 ? 4 : 2 });
  composer = new EffectComposer(renderer, rt);
  composer.setPixelRatio(pixelRatio()); composer.setSize(w, h);
  composer.addPass(new RenderPass(scene, cam));
  bloom = new UnrealBloomPass(new THREE.Vector2(w, h), 0.6, 0.5, 0.92); // светится только то, что ярче белого: glow, частицы, вспышки
  composer.addPass(bloom);
  composer.addPass(new OutputPass());
  updateGlow();
}
function hexOf(c) { return String(c || '').slice(0, 7); }
function skyColors() {
  const s = G.sky;
  if (Array.isArray(s)) return [hexOf(s[0]), hexOf(s[1] || s[0])];
  const top = new THREE.Color(hexOf(s) || '#1b2440'), bottom = top.clone().lerp(new THREE.Color('#ffffff'), 0.28);
  return ['#' + top.getHexString(), '#' + bottom.getHexString()];
}
function skyTexture(top, bottom) {
  const c = document.createElement('canvas'); c.width = 2; c.height = 256;
  const g = c.getContext('2d'), gr = g.createLinearGradient(0, 0, 0, 256);
  gr.addColorStop(0, top); gr.addColorStop(0.55, bottom); gr.addColorStop(1, bottom);
  g.fillStyle = gr; g.fillRect(0, 0, 2, 256);
  const t = new THREE.CanvasTexture(c); t.colorSpace = THREE.SRGBColorSpace;
  return t;
}
function disposeScene() {
  popups.forEach(p => p.el.remove());
  popups = []; warns = []; pulses = []; whites = []; rings = []; trails = []; tweens = []; timers = []; follow = null; parts = null; sceneGen++;
  if (scene) {
    scene.traverse(o => {
      if (o.geometry) o.geometry.dispose();
      const ms = o.material ? [].concat(o.material) : [];
      for (const m of ms) { for (const k in m) if (m[k] && m[k].isTexture) m[k].dispose(); m.dispose(); }
    });
    for (const k in matCache) matCache[k].dispose();
  }
  if (skyTex) { skyTex.dispose(); skyTex = null; }
  matCache = {}; glowMats = []; scene = null; cam = null;
}
function buildScene() {
  const q = quality();
  renderer.setPixelRatio(pixelRatio());
  renderer.shadowMap.enabled = q > 0;
  scene = new THREE.Scene(); lab.scene = scene;
  const [top, bottom] = skyColors();
  skyTex = skyTexture(top, bottom); scene.background = skyTex;
  greyOn = false;
  if (G.fog) scene.fog = new THREE.FogExp2(bottom, G.fog);
  if (envTex && q === 2) { scene.environment = envTex; scene.environmentIntensity = 0.2; } // мягкие блики на гладком
  const hemi = new THREE.HemisphereLight(new THREE.Color(top).lerp(new THREE.Color('#ffffff'), 0.6), '#4a3f35', 0.85);
  const sun = new THREE.DirectionalLight('#fff2dc', 1.9);
  sun.userData.dir = new V3(0.55, 1, 0.42).normalize();
  sun.castShadow = q > 0;
  if (q > 0) {
    const f = G.field || { w: 30, h: 20 }, S = G.shadowSize || Math.max(f.w || 30, f.h || 20) * 0.7 + 4;
    sun.shadow.mapSize.set(q === 2 ? 2048 : 1024, q === 2 ? 2048 : 1024);
    Object.assign(sun.shadow.camera, { left: -S, right: S, top: S, bottom: -S, near: 1, far: 220 });
    sun.shadow.bias = -0.0005; sun.shadow.normalBias = 0.03;
  }
  scene.add(hemi, sun, sun.target);
  lab.light = { hemi, sun }; lab.shadows = q > 0;
  setupCamera(G.camera);
  makeParticles();
  makeComposer();
  resize();
}

/* ---------------- камера-штатив ---------------- */
// Виды: top (сверху), iso (по умолчанию), diorama (по диагонали), side (сбоку, плоскость XY), behind (за героем), free (камерой управляет игра).
// tilt — наклон от вертикали (0 — строго сверху, π/2 — горизонт), turn — поворот вокруг оси Y (0 — со стороны +Z, от игрока).
let view = null;
// расстояние, при котором всё поле целиком в кадре: углы поля проверяются настоящей проекцией (ближний край перспективы крупнее дальнего)
function fitDistance(v) {
  const f = v.fit, side = v.kind === 'side', c = [];
  for (const sx of [-1, 1]) for (const sz of [-1, 1]) c.push(side ? new V3(sx * f.w / 2, sz > 0 ? f.h : 0, 0) : new V3(sx * f.w / 2, 0, sz * f.h / 2));
  cam.aspect = Math.max(1, canvas.clientWidth) / Math.max(1, canvas.clientHeight); cam.updateProjectionMatrix();
  const fits = d => { v.distance = d; placeCamera(0, true); cam.updateMatrixWorld(); return c.every(p => { const q = p.clone().project(cam); return q.z < 1 && Math.abs(q.x) <= 0.94 && Math.abs(q.y) <= 0.94; }); };
  let lo = 1, hi = 600;
  for (let i = 0; i < 28; i++) { const mid = (lo + hi) / 2; if (fits(mid)) hi = mid; else lo = mid; }
  return hi;
}
function setupCamera(kindOrObj, extra) {
  const o = Object.assign({}, typeof kindOrObj === 'object' && kindOrObj ? kindOrObj : { type: kindOrObj }, extra || {});
  const kind = o.type || 'iso', f = G.field || { w: 30, h: 20 };
  const fov = o.fov || 0.8;
  if (!cam) cam = new THREE.PerspectiveCamera(fov * 180 / Math.PI, Math.max(1, canvas.clientWidth) / Math.max(1, canvas.clientHeight), 0.1, 1000);
  cam.fov = fov * 180 / Math.PI; cam.updateProjectionMatrix();
  const P0 = {
    top: { tilt: 0.18, turn: 0, target: [0, 0, 0] },
    iso: { tilt: 0.88, turn: 0, target: [0, 0, 0] },
    diorama: { tilt: 0.95, turn: Math.PI / 4, target: [0, 0, 0] },
    side: { tilt: Math.PI / 2 - 0.1, turn: 0, target: [0, (f.h || 20) / 2, 0] },
  }[kind] || { tilt: 0.88, turn: 0, target: [0, 0, 0] };
  const fit = { w: f.w || 30, h: f.h || 20 };
  view = lab.view = {
    kind, fov, fit: o.distance ? null : fit,
    tilt: o.tilt != null ? o.tilt : o.beta != null ? o.beta : P0.tilt,
    turn: o.turn != null ? o.turn : P0.turn,
    target: o.target ? posOf(o.target).clone() : new V3().fromArray(P0.target),
    distance: o.distance || 30,
  };
  lab.camera = cam;
  if (kind === 'behind') { cam.position.set(0, 5, 10); cam.lookAt(0, 1, 0); }
  else if (view.fit) view.distance = fitDistance(view);
  placeCamera(0, true);
}
function placeCamera(dt, snap) {
  if (!view || !cam) return;
  if (view.kind === 'free') return;
  const fo = follow && follow.obj && follow.obj.parent ? follow : null;
  const k = snap || !fo || fo.lag <= 0 ? 1 : 1 - Math.exp(-dt / fo.lag);
  if (view.kind === 'behind') {
    if (!fo) return;
    const m = fo.obj, mp = m.getWorldPosition(_v), yaw = m.rotation.y;
    _w.set(mp.x - Math.sin(yaw) * fo.distance, mp.y + fo.height, mp.z - Math.cos(yaw) * fo.distance);
    cam.position.lerp(_w, k);
    cam.lookAt(mp.x, mp.y + fo.look, mp.z);
    view.target.copy(mp);
    return;
  }
  if (fo) view.target.lerp(fo.obj.getWorldPosition(_v), k);
  const t = view.target, s = Math.sin(view.tilt);
  cam.position.set(t.x + view.distance * s * Math.sin(view.turn), t.y + view.distance * Math.cos(view.tilt), t.z + view.distance * s * Math.cos(view.turn));
  cam.lookAt(t);
}
function resize() {
  if (!renderer) return;
  const w = Math.max(1, canvas.clientWidth), h = Math.max(1, canvas.clientHeight);
  renderer.setPixelRatio(pixelRatio());
  renderer.setSize(w, h, false);
  if (composer) { composer.setPixelRatio(pixelRatio()); composer.setSize(w, h); }
  if (cam) { cam.aspect = w / h; cam.updateProjectionMatrix(); }
  if (view && view.fit && view.kind !== 'behind' && view.kind !== 'free') { view.distance = fitDistance(view); placeCamera(0, true); }
}

/* ---------------- частицы: одна пачка кубиков на сцену ---------------- */
const MAXP = 700;
function makeParticles() {
  const m = new THREE.InstancedMesh(new THREE.BoxGeometry(1, 1, 1), new THREE.MeshBasicMaterial({ color: '#ffffff' }), MAXP);
  m.name = 'лаб:частицы'; m.frustumCulled = false; m.userData.noShadow = true; m.userData.lab = true;
  for (let i = 0; i < MAXP; i++) { m.setMatrixAt(i, ZERO); m.setColorAt(i, _c.set('#ffffff')); }
  scene.add(m);
  parts = { mesh: m, list: Array.from({ length: MAXP }, () => ({ busy: false, p: new V3(), v: new V3(), r: new V3(), life: 0, max: 1, size: 0.2, grav: 9 })), dirty: true };
}
const toArr = c => Array.isArray(c) ? c : [c || '#ffffff'];
function burst(pos, o = {}) {
  if (!parts) return;
  const n = Math.round((o.count == null ? 16 : o.count) * cfg.juice), cols = toArr(o.colors || o.color);
  const dir = o.dir ? posOf(o.dir).clone().normalize() : null; // искры летят по направлению удара: сквозь врага
  let made = 0;
  parts.list.forEach((q, i) => {
    if (made >= n || q.busy) return;
    const a = rngFx() * Math.PI * 2, e = (rngFx() - 0.3) * Math.PI, sp = (o.speed || 6) * (0.3 + rngFx() * 0.9);
    q.busy = true; q.p.copy(pos);
    q.v.set(Math.cos(a) * Math.cos(e) * sp, Math.abs(Math.sin(e)) * sp + (o.up || 0), Math.sin(a) * Math.cos(e) * sp);
    if (dir) q.v.multiplyScalar(0.4).addScaledVector(dir, sp * 1.3);
    q.life = q.max = (o.life || 0.6) * (0.5 + rngFx() * 0.7);
    q.size = (o.size || 0.22) * (0.6 + rngFx() * 0.8);
    q.grav = o.gravity == null ? 9 : o.gravity;
    q.r.set(rngFx() * 3, rngFx() * 3, rngFx() * 3);
    parts.mesh.setColorAt(i, _c.set(cols[Math.floor(rngFx() * cols.length)]).multiplyScalar(1.6)); // ярче белого — ореол свечения
    made++;
  });
  if (made) { parts.mesh.instanceColor.needsUpdate = true; parts.dirty = true; }
}
function tickParticles(dt) {
  if (!parts || !parts.dirty) return;
  let any = false;
  parts.list.forEach((q, i) => {
    if (!q.busy) return;
    q.life -= dt;
    if (q.life <= 0) { q.busy = false; parts.mesh.setMatrixAt(i, ZERO); return; }
    any = true;
    q.v.y -= q.grav * dt; q.v.multiplyScalar(Math.max(0, 1 - 2.2 * dt)); q.p.addScaledVector(q.v, dt);
    q.r.x += dt * 4; q.r.y += dt * 3;
    const s = q.size * (q.life / q.max);
    _m.compose(q.p, _q.setFromEuler(_e.set(q.r.x, q.r.y, q.r.z)), _s.set(s, s, s));
    parts.mesh.setMatrixAt(i, _m);
  });
  parts.mesh.instanceMatrix.needsUpdate = true;
  parts.dirty = any;
}

/* ---------------- надписи, предупреждения, волны, следы, пульсы, вспышки ---------------- */
function projectToScreen(pos) {
  if (!cam) return { x: -9999, y: -9999, z: 2 };
  const v = _w.copy(pos).project(cam);
  return { x: (v.x + 1) / 2 * canvas.clientWidth, y: (1 - v.y) / 2 * canvas.clientHeight, z: v.z };
}
function popup(at, text, color = '#ffffff', size = 18) {
  const el = document.createElement('div');
  el.className = 'pop'; el.textContent = String(text); el.style.color = color; el.style.fontSize = size + 'px';
  $('#popups').appendChild(el);
  popups.push({ el, pos: posOf(at).clone(), t: 0, max: 0.9 });
}
function tickPopups(dt) {
  popups = popups.filter(p => {
    p.t += dt;
    if (p.t >= p.max || !scene || !cam) { p.el.remove(); return false; }
    const s = projectToScreen(p.pos), k = p.t / p.max, pop = 1 + 0.5 * Math.max(0, 1 - p.t / 0.12); // выпрыгивает крупнее и садится
    p.el.style.left = s.x + 'px'; p.el.style.top = (s.y - 44 * ease.outCubic(k)) + 'px';
    p.el.style.opacity = String(1 - k * k); p.el.style.transform = `translate(-50%,-50%) scale(${pop.toFixed(3)})`;
    return true;
  });
}
function flatOrUp(mesh, pos, lift) { // на земле — плашмя, в виде сбоку — лицом к камере
  if (view && view.kind === 'side') mesh.position.set(pos.x, pos.y, pos.z + lift);
  else { mesh.rotation.x = -Math.PI / 2; mesh.position.set(pos.x, pos.y + lift, pos.z); }
}
function warn(pos, radius, sec, color) {
  const mr = new THREE.MeshBasicMaterial({ color: new THREE.Color(color).multiplyScalar(1.3), transparent: true, depthWrite: false, side: THREE.DoubleSide });
  const mf = new THREE.MeshBasicMaterial({ color, transparent: true, opacity: 0.35, depthWrite: false, side: THREE.DoubleSide });
  const ring = new THREE.Mesh(new THREE.RingGeometry(radius * 0.9, radius, 40), mr), fill = new THREE.Mesh(new THREE.CircleGeometry(radius, 40), mf);
  [ring, fill].forEach(m => { m.userData.noShadow = true; m.renderOrder = 2; });
  flatOrUp(ring, pos, 0.05); flatOrUp(fill, pos, 0.06);
  fill.scale.setScalar(0.15);
  scene.add(ring, fill);
  const h = { left: sec, total: sec, done: false, ring, fill, dispose() { if (!h.done) { h.done = true; [ring, fill].forEach(m => { m.removeFromParent(); m.geometry.dispose(); m.material.dispose(); }); } } };
  warns.push(h);
  return h;
}
function tickWarns(dt) {
  warns = warns.filter(h => {
    if (h.done) return false;
    h.left -= dt;
    const k = 1 - Math.max(0, h.left) / Math.max(0.001, h.total);
    h.fill.scale.setScalar(0.15 + 0.85 * k); // заливка растёт к удару: видно, сколько осталось
    h.ring.material.opacity = 0.65 + 0.35 * Math.sin(lab.t * (10 + k * 20)); // мигает чаще перед ударом
    if (h.left <= 0) { h.dispose(); return false; }
    return true;
  });
}
const RING_GEO = new THREE.RingGeometry(0.82, 1, 40);
function ring(pos, o) {
  const m = new THREE.Mesh(RING_GEO, new THREE.MeshBasicMaterial({ color: new THREE.Color(o.color || '#ffffff').multiplyScalar(1.6), transparent: true, depthWrite: false, side: THREE.DoubleSide, blending: THREE.AdditiveBlending }));
  m.userData.noShadow = true; m.userData.shared = true;
  flatOrUp(m, pos, 0.08);
  scene.add(m);
  rings.push({ m, t: 0, life: o.life || 0.35, r0: o.from || 0.2, r1: (o.radius || 2) * Math.max(0.3, Math.min(1.5, cfg.juice)) });
}
function tickRings(dt) {
  rings = rings.filter(r => {
    r.t += dt;
    const k = Math.min(1, r.t / r.life);
    r.m.scale.setScalar(lab.lerp(r.r0, r.r1, ease.outCubic(k)));
    r.m.material.opacity = 1 - k;
    if (k >= 1) { r.m.removeFromParent(); r.m.material.dispose(); return false; }
    return true;
  });
}
// след за летящим объектом: лента, повёрнутая к камере, яркая у головы и гаснущая к хвосту
function trail(obj, o = {}) {
  const N = Math.max(4, Math.min(64, Math.round(o.length || 16))), W = (o.width || 0.35) / 2;
  const pos = new Float32Array(N * 6), col = new Float32Array(N * 6), idx = [];
  for (let i = 0; i < N - 1; i++) { const a = i * 2; idx.push(a, a + 1, a + 2, a + 1, a + 3, a + 2); }
  const geo = new THREE.BufferGeometry();
  geo.setIndex(idx); geo.setAttribute('position', new THREE.BufferAttribute(pos, 3)); geo.setAttribute('color', new THREE.BufferAttribute(col, 3));
  const m = new THREE.Mesh(geo, new THREE.MeshBasicMaterial({ vertexColors: true, transparent: true, depthWrite: false, side: THREE.DoubleSide, blending: THREE.AdditiveBlending }));
  m.frustumCulled = false; m.userData.noShadow = true; m.renderOrder = 3;
  scene.add(m);
  const h = { obj, mesh: m, N, W, pts: [], color: new THREE.Color(o.color || '#ffb347').multiplyScalar(o.glow == null ? 1.8 : o.glow), done: false,
    clear() { h.pts.length = 0; }, dispose() { if (!h.done) { h.done = true; m.removeFromParent(); geo.dispose(); m.material.dispose(); } } };
  trails.push(h);
  return h;
}
function inScene(o) { while (o) { if (o === scene) return true; o = o.parent; } return false; }
function tickTrails() {
  trails = trails.filter(h => {
    if (h.done) return false;
    const alive = inScene(h.obj) && h.obj.visible !== false;
    if (alive) { h.pts.unshift(posOf(h.obj).clone()); if (h.pts.length > h.N) h.pts.pop(); } else h.pts.pop(); // объект пропал — хвост догорает
    if (!alive && h.pts.length < 2) { h.dispose(); return false; }
    const P2 = h.mesh.geometry.attributes.position, C = h.mesh.geometry.attributes.color, n = h.pts.length;
    for (let i = 0; i < h.N; i++) {
      const j = Math.min(i, n - 1), p = h.pts[j] || _v.set(0, -999, 0), a = h.pts[Math.max(0, j - 1)] || p, b = h.pts[Math.min(n - 1, j + 1)] || p;
      _s.subVectors(a, b); if (_s.lengthSq() < 1e-8) _s.set(1, 0, 0);
      _w.subVectors(cam.position, p).cross(_s).normalize();
      const k = 1 - i / (h.N - 1), w = h.W * (0.25 + 0.75 * k) * (i >= n ? 0 : 1);
      P2.setXYZ(i * 2, p.x + _w.x * w, p.y + _w.y * w, p.z + _w.z * w); P2.setXYZ(i * 2 + 1, p.x - _w.x * w, p.y - _w.y * w, p.z - _w.z * w);
      const c = k * k; C.setXYZ(i * 2, h.color.r * c, h.color.g * c, h.color.b * c); C.setXYZ(i * 2 + 1, h.color.r * c, h.color.g * c, h.color.b * c);
    }
    P2.needsUpdate = true; C.needsUpdate = true;
    return true;
  });
}
// вспышка попадания: меш (или все меши группы) на миг заливается цветом. У копий InstancedMesh не работает — вспыхнули бы все копии
const whiteMats = {};
function whiten(target, sec, color) {
  const wm = whiteMats[color] || (whiteMats[color] = new THREE.MeshBasicMaterial({ color: new THREE.Color(color).multiplyScalar(1.4) }));
  target.traverse(m => {
    if (!m.isMesh || m.isInstancedMesh || m.userData.lab) return;
    if (!m.userData.labMat) m.userData.labMat = m.material;
    m.material = wm;
    const w = whites.find(x => x.m === m);
    if (w) w.t = Math.max(w.t, sec); else whites.push({ m, t: sec });
  });
}
function tickWhites(dt) {
  whites = whites.filter(w => {
    w.t -= dt;
    if (w.t > 0) return true;
    if (w.m.userData.labMat) { w.m.material = w.m.userData.labMat; delete w.m.userData.labMat; }
    return false;
  });
}
function tickPulses(dt) {
  pulses = pulses.filter(p => {
    if (!p.obj || !inScene(p.obj)) return false;
    p.t += dt;
    const k = p.t >= p.dur ? 0 : Math.sin(Math.PI * p.t / p.dur);
    const s = 1 + (p.k - 1) * k * Math.min(1, cfg.juice);
    p.obj.scale.set(p.base.x * s, p.base.y / Math.max(0.5, s * 0.9 + 0.1), p.base.z * s);
    if (p.t >= p.dur) { p.obj.scale.copy(p.base); return false; }
    return true;
  });
}
// твин или таймер, заведённый внутри другого (lab.after в lab.after), не теряется: он попадает в список после прохода
function tickTweens(dt) {
  const gen = sceneGen, tw = tweens; tweens = [];
  const keepT = tw.filter(h => {
    if (h.done) return false;
    h.t += dt;
    const k = Math.min(1, h.t / h.sec);
    safe(() => h.fn(h.f(k), k), 'tween');
    return k < 1;
  });
  if (gen !== sceneGen) return; // партию перестроили прямо из твина: старые твины и таймеры не возвращаем
  tweens = keepT.concat(tweens);
  const tm = timers; timers = [];
  const keep = tm.filter(h => {
    if (h.done) return false;
    if (lab.t < h.at) return true;
    safe(() => h.fn(), 'after');
    return false;
  });
  if (gen === sceneGen) timers = keep.concat(timers);
}
function tickFlash(dt) { flashA = Math.max(0, flashA - dt * 1.8); $('#flash').style.opacity = String(flashA); }
// новые меши сами отбрасывают и принимают тени (кроме помеченных lab.noShadow)
const seen = new WeakSet();
function tickShadows() {
  if (!scene) return;
  scene.traverse(o => {
    if (!o.isMesh || seen.has(o)) return;
    seen.add(o);
    if (o.userData.noShadow || o.userData.lab) { o.castShadow = false; o.receiveShadow = !o.userData.lab && o.receiveShadow; return; }
    o.castShadow = true; o.receiveShadow = true;
  });
}
function tickSun() { // тень там, куда смотрит камера: солнце ходит за целью камеры
  const sun = lab.light && lab.light.sun;
  if (!sun || !view) return;
  sun.target.position.copy(view.target);
  sun.position.copy(view.target).addScaledVector(sun.userData.dir, 70);
}

/* ---------------- телеметрия ---------------- */
function resetTele() {
  for (const k of BTN) { tele.presses[k] = 0; tele.hold[k] = 0; }
  tele.hurts = 0; tele.custom = {}; tele.stats = {}; tele.marks = {}; tele.line = []; tele.spots = []; tele.maps = {};
  LV.lastWhere = -1; LV.gen = {};
}
function tickTele(dt) {
  for (const k of BTN) {
    if (P[0][k] || P[1][k]) tele.hold[k] += dt;
    if (P[0].pressed[k] || P[1].pressed[k]) tele.presses[k]++;
  }
}
const BTN_NAMES = { left: '←', right: '→', up: '↑', down: '↓', a: 'A', b: 'B' };
function teleNotes() {
  const T = Math.max(0.1, lab.t), out = [];
  const holds = BTN.map(k => [k, tele.hold[k] / T]).filter(x => x[1] > 0.05).sort((a, b) => b[1] - a[1]);
  if (holds.length) out.push('Дольше всего держал: ' + holds.slice(0, 2).map(([k, v]) => `${BTN_NAMES[k]} ${Math.round(v * 100)}% времени`).join(', '));
  const pr = BTN.filter(k => (k === 'a' || k === 'b') && tele.presses[k] > 0).map(k => `${BTN_NAMES[k]} — ${tele.presses[k]}`);
  if (pr.length) out.push('Нажатий: ' + pr.join(', '));
  const cu = Object.entries(tele.custom).filter(([k]) => k[0] !== '_').sort((a, b) => b[1] - a[1]).slice(0, 4).map(([k, v]) => `${k}: ${Math.round(v * 10) / 10}`);
  if (cu.length) out.push(cu.join(' · '));
  return out;
}
function teleData() {
  return { time: Math.round(lab.t * 10) / 10, presses: { ...tele.presses }, hold: Object.fromEntries(BTN.map(k => [k, Math.round(tele.hold[k] * 10) / 10])), hurts: tele.hurts, custom: { ...tele.custom }, stats: { ...tele.stats }, marks: JSON.parse(JSON.stringify(tele.marks)), line: tele.line.slice(), spots: tele.spots.slice(), maps: JSON.parse(JSON.stringify(tele.maps)) };
}

/* ---------------- ошибки ---------------- */
// строка ошибки — из кода игры: кадры стека из three.js и оболочки пропускаем
function errLine(e) {
  const stack = String((e && e.stack) || '');
  const frames = stack.split('\n').map(s => /((?:https?|file|blob):[^\s)]*?|<anonymous>):(\d+):(\d+)/.exec(s)).filter(Boolean);
  const own = frames.find(f => !/\/vendor\/|lab-three\.js/.test(f[1]));
  if (own) return Number(own[2]);
  if (e && e.lineno && !/\/vendor\/|lab-three\.js/.test(e.filename || '')) return Number(e.lineno);
  return null;
}
function fail(e, phase) {
  if (errored) return;
  errored = true;
  const msg = (e && (e.message || String(e))) || 'неизвестная ошибка', line = errLine(e);
  const box = $('#errBox');
  box.hidden = false; box.innerHTML = '';
  const b = document.createElement('b'); b.textContent = 'Ошибка в коде игры (' + phase + ')';
  box.append(b, document.createTextNode(': ' + msg + (line ? ` · строка ${line}` : '') + '\nИгра остановлена. Опиши ошибку программисту одной просьбой или откати версию.'));
  post({ type: 'error', phase, message: msg, line, stack: String((e && e.stack) || '').slice(0, 1500) });
  console.error('[lab3d]', phase, e);
}
function safe(fn, phase) { try { fn(); } catch (e) { fail(e, phase); } }
addEventListener('error', e => fail(e.error || e, 'загрузка'));
addEventListener('unhandledrejection', e => fail(e.reason, 'обещание'));

/* ---------------- ручки геймдизайнера ---------------- */
function knobRow(key, c, host) {
  const id = 'k_' + key;
  const wrap = document.createElement('div'); wrap.className = 'knob'; wrap.dataset.key = key;
  const label = document.createElement('label'); label.htmlFor = id; label.textContent = c.label + (c.restart ? ' ↻' : '');
  const out = document.createElement('output'); out.id = id + '_v';
  const inp = document.createElement('input'); inp.type = 'range'; inp.id = id;
  inp.min = c.min; inp.max = c.max; inp.step = c.step || 1; inp.value = cfg[key];
  const show = () => { out.textContent = c.names ? c.names[Math.round(cfg[key])] : fmt(cfg[key], c.step); wrap.classList.toggle('changed', cfg[key] !== DEFAULTS[key]); };
  inp.addEventListener('input', () => { cfg[key] = Number(inp.value); show(); if (!c.restart) knobChanged(false); });
  inp.addEventListener('change', () => { if (c.restart) knobChanged(true); });
  wrap.append(label, out, inp);
  if (c.hint) { const s = document.createElement('small'); s.textContent = c.hint; wrap.append(s); }
  host.append(wrap); show();
  wrap._sync = () => { inp.value = cfg[key]; show(); };
}
const fmt = (v, step) => { const d = String(step || 1).includes('.') ? String(step).split('.')[1].length : 0; return Number(v).toFixed(d); };
function buildPanel() {
  const host = $('#knobs'), sh = $('#shellKnobs'), jh = $('#juiceKnobs');
  host.innerHTML = ''; sh.innerHTML = ''; jh.innerHTML = '';
  for (const [k, c] of Object.entries(G.config || {})) knobRow(k, c, host);
  for (const [k, c] of Object.entries(SHELL_KNOBS)) knobRow(k, c, c.juice ? jh : sh);
  const pr = $('#presets'); pr.innerHTML = '';
  const mk = (name, values) => {
    const b = document.createElement('button'); b.type = 'button'; b.className = 'ghost'; b.textContent = name;
    b.addEventListener('click', () => applyPreset(values));
    pr.append(b);
  };
  mk('Как задумано', {});
  for (const [name, values] of Object.entries(G.presets || {})) mk(name, values);
}
function applyPreset(values) {
  let restartNeeded = false;
  for (const k of Object.keys(META)) {
    if (k in SHELL_KNOBS && !SHELL_KNOBS[k].juice) continue; // тряску, частицы и качество пресет не трогает, сочность — может
    const v = k in values ? values[k] : DEFAULTS[k];
    if (cfg[k] !== v && META[k].restart) restartNeeded = true;
    cfg[k] = v;
  }
  document.querySelectorAll('.knob').forEach(w => w._sync && w._sync());
  knobChanged(restartNeeded);
  sfx.beep();
}
function knobChanged(restartNeeded) {
  updateGlow();
  post({ type: 'cfg', cfg: changedCfg() });
  if (restartNeeded) {
    if (state === 'play' || state === 'over') restart(false);
    else if (state === 'menu') buildRound(true);
  }
}
function changedCfg() { const o = {}; for (const k in cfg) if (cfg[k] !== DEFAULTS[k]) o[k] = cfg[k]; return o; }
function togglePanel(force) {
  const p = $('#panel'), open = force != null ? force : p.hidden;
  p.hidden = !open; $('#knobsBtn').setAttribute('aria-pressed', String(open));
  if (open) { const first = p.querySelector('input'); if (first) first.focus({ preventScroll: true }); } else canvas.focus({ preventScroll: true });
}

/* ---------------- экраны и подписи ---------------- */
const CTRL_KEYS = {
  solo: { move: '<kbd>←</kbd><kbd>→</kbd>', move4: '<kbd>←</kbd><kbd>→</kbd><kbd>↑</kbd><kbd>↓</kbd>', a: '<kbd>пробел</kbd>', b: '<kbd>Shift</kbd>' },
  pad: { move: '<kbd>◀ ▶</kbd>', move4: '<kbd>✚</kbd> или стик', a: '<kbd>A</kbd>', b: '<kbd>B</kbd>' },
};
function labels() {
  if (!G) return;
  const two = duo();
  $('#controls').innerHTML = (G.controls || []).map(c => {
    let keys;
    if (padMode) keys = CTRL_KEYS.pad[c.input] || '';
    else if (two) keys = { move: '<kbd>A</kbd><kbd>D</kbd> / <kbd>←</kbd><kbd>→</kbd>', move4: '<kbd>WASD</kbd> / стрелки', a: '<kbd>F</kbd> / <kbd>K</kbd>', b: '<kbd>G</kbd> / <kbd>L</kbd>' }[c.input] || '';
    else keys = CTRL_KEYS.solo[c.input] || '';
    return `<div>${keys} ${esc(c.text || '')}</div>`;
  }).join('');
  $('#padHint').textContent = padMode
    ? (two ? 'Геймпад 1 — игрок 1, геймпад 2 — игрок 2. Клавиатура тоже работает.' : 'Геймпад подключён: удары отдаются вибрацией. Клавиатура тоже работает.')
    : (two ? 'Игрок 1 — левая половина клавиатуры, игрок 2 — стрелки. Есть геймпады? Нажми на них любую кнопку.' : 'Есть геймпад? Нажми на нём любую кнопку.');
  $('#startBtn').textContent = padMode ? 'Играть · A' : 'Играть · пробел';
  $('#againBtn').textContent = padMode ? 'Ещё раз · Start' : 'Ещё раз · пробел';
  $('#resumeBtn').textContent = padMode ? 'Продолжить · Start' : 'Продолжить · P';
  $('#knobsBtn').textContent = padMode ? 'Ручки · Select' : 'Ручки · Tab';
}
const hexOk = c => typeof c === 'string' && /^#[0-9a-f]{3,8}$/i.test(c) ? c : null; // цвет в стиль строки — только #hex
const esc = s => String(s).replace(/[&<>"']/g, c => ({ '&': '&amp;', '<': '&lt;', '>': '&gt;', '"': '&quot;', "'": '&#39;' }[c]));
function applyMeta() {
  document.title = G.title || 'Лаборатория игр';
  $('#gTitle').textContent = G.title || 'Игра';
  $('#gSub').textContent = G.subtitle || '';
  $('#hudScore').style.color = hexOk(G.scoreColor) || ''; // счёт цветом игры (золотом у «НЛО в станице»)
  $('#eyebrow').textContent = G.donor ? 'Лаборатория игр · по мотивам механики ' + G.donor : 'Лаборатория игр';
  const dec = (G.decisions || []).filter(Boolean);
  $('#decBox').hidden = !dec.length;
  $('#decisions').innerHTML = dec.map(d => `<li>${esc(d)}</li>`).join('');
  lab.players = duo() ? 2 : 1;
  lab.best = Number(store.get(bestKey())) || 0;
  labels(); updateMuteBtn();
}
const bestKey = () => 'lab3d:best:' + (G.id || G.title || 'игра');
function showScreen(id) { ['startScreen', 'pauseScreen', 'overScreen'].forEach(s => { $('#' + s).hidden = s !== id; }); }
function showRecord() {
  const txt = classRecord ? `Рекорд класса: ${classRecord.score}${classRecord.nick ? ' — ' + classRecord.nick : ''}` : '';
  ['#startRecord', '#overRecord'].forEach(s => { $(s).hidden = !txt; $(s).textContent = txt; });
}
// лупа спрятанной механики: портал присылает reveal с названием спрятанной механики (урок 1, шаг «Посмотри на спрятанную механику» и «Спрятанная механика рядом» на проекторе).
// Каждый lab.count('_secret') зажигает значок и тихо щёлкает; у постоянного эффекта значок горит, пока счётчик идёт. Бот-плейтестер лупу не зажигает.
let lupa = null;
function setLupa(title) {
  const box = $('#lupa');
  lupa = title ? { title: String(title).slice(0, 80), n: 0, until: 0 } : null;
  box.hidden = !lupa;
  if (lupa) { box.querySelector('span').textContent = 'Спрятанная механика: ' + lupa.title; box.querySelector('b').textContent = ''; }
}
function lupaHit() {
  if (!lupa || (bot && !bot.show)) return;
  const now = performance.now(), fresh = now > lupa.until;
  lupa.n++; lupa.until = now + 900;
  const box = $('#lupa'); box.classList.add('on'); box.querySelector('b').textContent = '× ' + lupa.n;
  if (fresh) tone(1480, 0.05, 'sine', 0.05);
}
let shownScore = 0;
function hudTick() {
  if (lupa && performance.now() > lupa.until) $('#lupa').classList.remove('on');
  const sc = Math.round(lab.score);
  if (sc !== shownScore) { // счёт подпрыгивает при каждом изменении
    const el = $('#hudScore'); el.textContent = String(sc);
    if (on('squash') && el.animate) el.animate([{ transform: 'scale(1.35)' }, { transform: 'scale(1)' }], { duration: 160, easing: 'ease-out' });
    shownScore = sc;
  }
  $('#hudLives').textContent = lab.lives > 0 ? (lab.lives <= 8 ? '♥'.repeat(lab.lives) : '♥ × ' + lab.lives) : '';
  $('#hudExtra').innerHTML = Object.values(hudLines).map(h => h.color || h.size ? `<span style="${h.color ? 'color:' + h.color + ';' : ''}${h.size ? 'font-size:' + h.size + 'px;font-weight:700;' : ''}">${esc(h.text)}</span>` : esc(h.text)).join('<br>');
  $('#hudBest').textContent = lab.best ? 'Мой рекорд: ' + lab.best : '';
  const gh = $('#hudGhost'), g = ghostNow();
  gh.hidden = !g;
  if (g) {
    const d = sc - g.at;
    gh.textContent = `⚔ ${g.nick}: ${g.at}` + (d > 0 ? ` · ты впереди на ${d}` : d < 0 ? ` · отстаёшь на ${-d}` : ' · поровну');
    gh.className = d > 0 ? 'ahead' : d < 0 ? 'behind' : '';
  }
}
// призрак соперника в вызове: его счёт на той же секунде партии (после конца его записи — итог)
function ghostNow() {
  if (!ghost || state === 'menu') return null;
  const s = Math.floor(lab.t), line = ghost.line;
  const at = s < line.length ? line[s] : ghost.score;
  return { nick: ghost.nick, at: Math.round(Number(at) || 0) };
}
function updateMuteBtn() { $('#muteBtn').setAttribute('aria-pressed', String(muted)); $('#muteBtn').textContent = muted ? 'Звук выкл · M' : 'Звук · M'; }

/* ---------------- жизненный цикл партии ---------------- */
function initialLives() { return G.config && G.config.lives ? Math.round(cfg.lives) : (G.lives == null ? 3 : G.lives); }
function buildRound(preview) {
  disposeScene();
  errored = false; $('#errBox').hidden = true;
  lab.seed = fixedSeed != null ? fixedSeed : (Math.random() * 1e9) >>> 0;
  rng = mulberry32(lab.seed);
  buildScene();
  lab.state = {}; lab.t = 0; lab.dt = 0; lab.score = 0; lab.invuln = 0; lab.lives = initialLives();
  hudLines = {}; shakeAmp = 0; flashA = 0; hitstopT = 0; slowT = 0; heroObj = null;
  resetTele();
  lab.round = ++session.rounds;
  const two = duo() ? 2 : 1; // ручка duo могла переключить игру на двоих
  if (two !== lab.players) { lab.players = two; for (const h of kb.concat(kbTap)) for (const k in h) h[k] = false; labels(); }
  safe(() => G.start(lab, scene), 'start');
  tickShadows(); placeCamera(0, true); tickSun();
  freshPreview = preview;
}
function beginPlay() {
  if (!freshPreview) buildRound(false);
  freshPreview = false;
  state = 'play'; paused = false; disarm();
  showScreen(null); canvas.focus({ preventScroll: true });
  audio();
  post({ type: 'start', round: lab.round, seed: lab.seed });
}
function restart(countAgain = true) {
  if (countAgain) { session.restarts++; post({ type: 'again', restarts: session.restarts }); }
  buildRound(false); freshPreview = false;
  state = 'play'; paused = false; disarm();
  showScreen(null); canvas.focus({ preventScroll: true });
  post({ type: 'start', round: lab.round, seed: lab.seed });
}
// клавиатура и тач: экран конца партии не закрывается в первые 0,8 с — пробел и кнопки на экране только что были игровыми
const overFresh = () => state === 'over' && performance.now() - overAt < 800;
function confirm() {
  audio();
  if (state === 'menu') beginPlay();
  else if (state === 'over') restart(true);
  else if (state === 'play' && paused) setPause(false);
}
function setPause(v) {
  if (state !== 'play' || errored) return;
  paused = v; showScreen(v ? 'pauseScreen' : null);
  if (!v) disarm();
}
function end(kind, text) {
  if (state !== 'play') return;
  state = 'over'; overAt = performance.now();
  if (bot) { bot.end = { kind, text: String(text || '') }; return; } // партия бота: без экрана, рекорда и сообщения порталу
  const score = Math.round(lab.score);
  const isBest = score > lab.best;
  if (isBest) { lab.best = score; store.set(bestKey(), String(score)); }
  (kind === 'win' ? sfx.win : sfx.lose)();
  $('#overEyebrow').textContent = kind === 'win' ? 'Победа' : 'Конец партии';
  $('#overTitle').textContent = text;
  $('#stScore').textContent = String(score);
  $('#stTime').textContent = String(Math.round(lab.t));
  $('#stBest').textContent = String(lab.best) + (isBest && score > 0 ? ' ★' : '');
  const notes = [];
  if (typeof G.overNote === 'function') safe(() => { const n = G.overNote(lab); (Array.isArray(n) ? n : [n]).filter(Boolean).forEach(x => notes.push(String(x))); }, 'overNote');
  notes.push(...teleNotes());
  $('#overNotes').innerHTML = notes.map(n => `<div>${esc(n)}</div>`).join('');
  $('#overSeed').textContent = ghost
    ? (score > ghost.score ? `⚔ Вызов выигран: ${score} против ${ghost.score} — лидер этого мира теперь ты!` : `⚔ Лидер этого мира — ${ghost.nick}: ${ghost.score}. Не хватило ${ghost.score - score}. Ещё раз?`)
    : window.parent === window ? `Зерно партии: ${lab.seed}. Тот же мир для друга: ссылка с ?seed=${lab.seed}`
    : challengeOn ? `Зерно партии: ${lab.seed}. Тот же мир для друга — кнопка «⚔ Вызов: побей мой мир» под игрой.`
    : `Зерно партии: ${lab.seed}.`;
  showRecord();
  showScreen('overScreen');
  disarm();
  post({ type: 'over', kind, text, score, best: lab.best, isBest, seed: lab.seed, round: lab.round, restarts: session.restarts, tele: teleData(), cfg: changedCfg() });
}

/* ---------------- один шаг игры ---------------- */
function gameStep(dt) {
  if (slowT > 0) { slowT -= dt; dt *= slowK; } // замедление: игра и эффекты идут медленнее, интерфейс — как обычно
  if (hitstopT > 0) { hitstopT -= dt; return dt; }
  lab.dt = dt; lab.t += dt;
  if (lab.invuln > 0) lab.invuln = Math.max(0, lab.invuln - dt);
  tickTele(dt);
  safe(() => G.update(lab, dt), 'update');
  tickTweens(dt);
  while (tele.line.length < Math.min(600, Math.floor(lab.t) + 1)) tele.line.push(Math.round(lab.score));
  return dt;
}
function effectsStep(dt, live) {
  tickShadows();
  tickParticles(dt); tickPopups(dt); tickWarns(dt); tickRings(dt); tickPulses(dt); tickWhites(dt);
  if (live) tickTrails();
  placeCamera(dt); tickSun();
}
function render() {
  if (!scene || !cam) return;
  if (grey() !== greyOn) { // серый прототип включили или выключили ручкой
    greyOn = grey();
    if (!greyMat) greyMat = new THREE.MeshLambertMaterial({ color: '#9aa0a8' });
    scene.overrideMaterial = greyOn ? greyMat : null;
    scene.background = greyOn ? new THREE.Color('#5d6168') : skyTex;
    canvas.style.filter = greyOn ? 'grayscale(1)' : ''; // цвета экземпляров и цветной свет тоже серые
    updateGlow();
  }
  shakeAmp = Math.max(0, shakeAmp - renderDt * 2.5);
  const a = shakeAmp * shakeAmp, ox = (Math.random() - 0.5) * a * 0.9, oy = (Math.random() - 0.5) * a * 0.9, roll = (Math.random() - 0.5) * a * 0.03;
  if (a) { cam.translateX(ox); cam.translateY(oy); cam.rotateZ(roll); }
  renderer.info.reset();
  try { if (composer) composer.render(); else renderer.render(scene, cam); } catch (e) { fail(e, 'отрисовка'); }
  lastDraws = renderer.info.render.calls; lastTris = renderer.info.render.triangles;
  if (a) { cam.rotateZ(-roll); cam.translateY(-oy); cam.translateX(-ox); }
  frameNo++;
  if (posterWanted) { posterWanted = false; poster(); }
  for (let i = frameWaiters.length - 1; i >= 0; i--) if (frameNo >= frameWaiters[i].at) { frameWaiters[i].res(); frameWaiters.splice(i, 1); }
}
let posterWanted = false, renderDt = 0;
// обложка для аркады: кадр холста сразу после отрисовки (буфер ещё цел), уменьшенный до 480 px по ширине
function poster() {
  try {
    const w = Math.min(480, canvas.width), c2 = document.createElement('canvas');
    c2.width = w; c2.height = Math.round(canvas.height * w / canvas.width);
    c2.getContext('2d').drawImage(canvas, 0, 0, c2.width, c2.height);
    post({ type: 'poster', data: c2.toDataURL('image/jpeg', 0.78) });
  } catch (e) { /* кадр недоступен — обложка останется цветной */ }
}

/* ---------------- бот-плейтестер ---------------- */
// Бот играет партию одной стратегией в ускоренном времени (шаг 1/30 с, без звука, рекорда и сообщений порталу):
// idle — ничего не жмёт, mash — мнёт A без остановки, random — бегает куда попало и жмёт A и B.
// Сравнение стратегий находит то, что не видит техническая проверка: доминирующую стратегию, героя за кадром, пустое время.
const BOT_DT = 1 / 30;
function botWant(b) {
  const w = { left: false, right: false, up: false, down: false, a: false, b: false, x: 0, y: 0 }, t = lab.t;
  if (b.strategy === 'mash') w.a = (t % 0.2) < 0.1;
  if (b.strategy === 'random') {
    if (t >= b.until) { const k = Math.floor(b.rng() * 9); b.dir = k === 8 ? [0, 0] : [Math.round(Math.cos(k * Math.PI / 4)), Math.round(Math.sin(k * Math.PI / 4))]; b.until = t + 0.3 + b.rng() * 0.9; }
    w.x = b.dir[0]; w.y = b.dir[1]; w.left = w.x < 0; w.right = w.x > 0; w.up = w.y > 0; w.down = w.y < 0;
    if (b.aT > 0) { b.aT -= BOT_DT; w.a = true; } else if (b.rng() < BOT_DT * 2.5) b.aT = 0.1;
    if (b.bT > 0) { b.bT -= BOT_DT; w.b = true; } else if (b.rng() < BOT_DT * 0.7) b.bT = 0.1;
  }
  return w;
}
function botInput(b) {
  const w = botWant(b);
  for (let i = 0; i < 2; i++) {
    const p = P[i];
    for (const k of BTN) { const v = i === 0 && w[k]; p.pressed[k] = v && !prevHeld[i][k]; p.released[k] = !v && !!prevHeld[i][k]; p[k] = v; prevHeld[i][k] = v; }
    p.x = i === 0 ? w.x : 0; p.y = i === 0 ? w.y : 0;
  }
}
function heroOnScreen() { // true / false; null — героя нет или он удалён
  if (!heroObj || !inScene(heroObj) || !cam) return null;
  cam.updateMatrixWorld();
  const v = heroObj.getWorldPosition(new V3()).project(cam);
  return v.z > -1 && v.z < 1 && Math.abs(v.x) <= 1.04 && Math.abs(v.y) <= 1.04;
}
function botStep(b) {
  botInput(b);
  const dt = gameStep(BOT_DT);
  effectsStep(dt, true);
  if (lab.t >= b.nextLook) { b.nextLook = lab.t + 0.25; const v = heroOnScreen(); if (v !== null) { b.looks++; if (!v) b.off++; } }
}
const botWait = () => new Promise(r => setTimeout(r, 0));
// realtime — показ на проекторе («Спрятанная механика рядом»): те же шаги BOT_DT, что в плейтесте, только в темпе настоящего времени
async function botRound(strategy, seconds, seed, onStep, realtime) {
  const b = bot = { strategy, rng: mulberry32((seed ^ (strategy.length * 7919)) >>> 0), until: 0, dir: [0, 0], aT: 0, bT: 0, nextLook: 0, looks: 0, off: 0, hurtsAt: [], end: null, show: !!realtime };
  fixedSeed = seed; buildRound(false); freshPreview = false;
  state = 'play'; paused = false; showScreen(null);
  let steps = 0;
  const going = () => state === 'play' && !errored && lab.t < seconds && bot === b;
  if (realtime) {
    let last = performance.now(), acc = 0;
    while (going()) {
      await new Promise(r => requestAnimationFrame(r));
      const now = performance.now(); acc += Math.min(0.1, (now - last) / 1000); last = now;
      while (acc >= BOT_DT && going()) { botStep(b); acc -= BOT_DT; steps++; }
      if (onStep) onStep(strategy, lab.t);
    }
  } else while (going() && steps < seconds * 90) {
    const t0 = performance.now();
    while (going() && performance.now() - t0 < 30) { botStep(b); steps++; }
    if (onStep) onStep(strategy, lab.t);
    await botWait();
  }
  let flat = 0, run = 0; for (let i = 1; i < tele.line.length; i++) { run = tele.line[i] === tele.line[i - 1] ? run + 1 : 0; flat = Math.max(flat, run); }
  const cu = {}; for (const k in tele.custom) cu[k] = Math.round(tele.custom[k] * 10) / 10;
  return {
    strategy, seconds: Math.round(lab.t * 10) / 10, over: !!b.end, endText: b.end ? b.end.text : '', score: Math.round(lab.score), hurts: tele.hurts, hurtsAt: b.hurtsAt.slice(0, 20),
    presses: { a: tele.presses.a, b: tele.presses.b }, offscreen: b.looks ? Math.round(100 * b.off / b.looks) : null, flat, line: tele.line.slice(0, 200), custom: cu,
    secretAt: (tele.marks._secret || []).slice(0, 300), // секунды срабатываний спрятанной механики: портал проверяет, когда она сработала впервые и как часто
    error: errored ? (($('#errBox') || {}).textContent || 'ошибка').trim().slice(0, 300) : null,
  };
}
const BOT_NAMES = { idle: 'Пассивный (ничего не жмёт)', mash: 'Торопыга (мнёт A)', random: 'Новичок (жмёт что попало)' };
// выводы плейтеста — то, что портал покажет учителю и отдаст программисту на правку
function botFindings(rs, seconds) {
  const by = Object.fromEntries(rs.map(r => [r.strategy, r])), I = by.idle, M = by.mash, R = by.random, out = [];
  for (const r of rs) if (r.error) out.push(`Игра упала у бота «${BOT_NAMES[r.strategy]}»: ${r.error}`);
  const off = rs.filter(r => r.offscreen != null);
  if (!off.length) out.push('Игра не отметила героя (`lab.hero(герой)` в start) — уход героя за кадр не проверен.');
  else { const w = off.reduce((a, r) => (r.offscreen > a.offscreen ? r : a)); if (w.offscreen >= 15) out.push(`Герой уходит за кадр: ${w.offscreen}% времени у бота «${BOT_NAMES[w.strategy]}». Держи героя в поле или вызови lab.follow(герой).`); }
  const turns = G && G.pace === 'turns'; // пошаговая игра ждёт хода: бездействие и тишина без хода — не ошибка
  if (I && R && !I.error && !R.error && !turns) {
    if (!I.over && I.seconds >= seconds * 0.95 && I.hurts === 0) out.push(`Бездействие не наказано: бот, который ничего не жмёт, дожил до ${Math.round(seconds)}-й секунды без урона.`);
    else if (I.seconds > R.seconds * 1.3 && I.seconds > 20) out.push(`Стоять выгоднее, чем играть: бездействие живёт ${Math.round(I.seconds)} с, случайная игра — ${Math.round(R.seconds)} с.`);
    if (I.score > 0 && I.score >= R.score * 0.7) out.push(`Очки идут без игры: бездействие набрало ${I.score}, случайная игра — ${R.score}.`);
  }
  if (M && R && !M.error && !R.error && M.score > Math.max(20, R.score * 1.5) && M.seconds >= R.seconds * 0.9)
    out.push(`Похоже на доминирующую стратегию «мять A»: ${M.score} очков и ${Math.round(M.seconds)} с против ${R.score} очков и ${Math.round(R.seconds)} с у случайной игры. Проверь, есть ли причина не жать A без остановки.`);
  if (R && !R.error) {
    if (R.over && R.seconds < 15) out.push(`Слишком сложно для новичка: случайная игра проиграла за ${Math.round(R.seconds)} с.`);
    if (R.hurtsAt.length && R.hurtsAt[0] < 6) out.push(`Первый урон слишком рано: на ${R.hurtsAt[0]}-й секунде (честно — не раньше 8–10-й).`);
    if (R.flat >= 15 && !turns) out.push(`Пустое время: ${R.flat} с подряд у случайной игры счёт не менялся.`);
    if (!R.over && R.hurts === 0 && !turns) out.push(`Нет угрозы: за ${Math.round(R.seconds)} с случайной игры ни одного урона.`);
  }
  return out;
}
// compare: { knob } — ещё одна партия новичка с ручкой knob = 0 (копия «Без спрятанной механики»): портал сравнивает её с партией новичка со спрятанной механикой
async function playtest(o = {}) {
  if (!G || bot) throw new Error(bot ? 'Плейтест уже идёт' : 'Игра ещё не загружена');
  const strategies = (o.strategies || ['idle', 'mash', 'random']).filter(s => BOT_NAMES[s]), seconds = Math.max(10, Math.min(300, Number(o.seconds) || 90));
  const seed = o.seed == null ? 12345 : Number(o.seed) >>> 0, keep = { muted, fixedSeed };
  const knob = o.compare && o.compare.knob in cfg ? o.compare.knob : null;
  muted = true; const results = [];
  let off = null;
  try {
    for (const st of strategies) results.push(await botRound(st, seconds, seed, (s, t) => post({ type: 'playtestStep', strategy: s, t: Math.round(t), seconds })));
    if (knob) {
      const was = cfg[knob]; cfg[knob] = 0;
      try { off = await botRound('random', seconds, seed, (s, t) => post({ type: 'playtestStep', strategy: s, off: true, t: Math.round(t), seconds })); } finally { cfg[knob] = was; }
    }
  } finally {
    bot = null; muted = keep.muted; fixedSeed = keep.fixedSeed;
    for (const h of kb.concat(kbTap)) for (const k in h) h[k] = false;
    errored = false; buildRound(true); state = 'menu'; paused = false; showScreen('startScreen');
  }
  const report = { title: G.title, seconds, seed, hero: results.some(r => r.offscreen != null), results, findings: botFindings(results, seconds), names: BOT_NAMES };
  if (off) report.off = Object.assign(off, { knob });
  post({ type: 'playtest', report });
  return report;
}
// показ на проекторе: бот играет одну партию в настоящем времени, игру видно; mute — без звука (вторая копия рядом звучит сама)
async function botShow(o = {}) {
  if (!G || bot) throw new Error(bot ? 'Бот уже играет' : 'Игра ещё не загружена');
  const seconds = Math.max(10, Math.min(180, Number(o.seconds) || 60)), seed = o.seed == null ? 12345 : Number(o.seed) >>> 0;
  const strategy = BOT_NAMES[o.strategy] ? o.strategy : 'random', keep = { muted, fixedSeed };
  if (o.mute) muted = true;
  let r = null;
  try { r = await botRound(strategy, seconds, seed, () => post({ type: 'showStep', t: Math.round(lab.t), seconds }), true); } finally {
    bot = null; muted = keep.muted; fixedSeed = keep.fixedSeed;
    for (const h of kb.concat(kbTap)) for (const k in h) h[k] = false;
    errored = false; buildRound(true); state = 'menu'; paused = false; showScreen('startScreen');
  }
  const res = { seconds: r.seconds, score: r.score, hurts: r.hurts, over: r.over, secret: (r.custom || {})._secret || 0 };
  post({ type: 'showDone', result: res });
  return res;
}

/* ---------------- главный цикл ---------------- */
let lastT = performance.now(), idleDrawn = 0;
function loop(now) {
  requestAnimationFrame(loop);
  const real = Math.min(Math.max(0, (now - lastT) / 1000), 0.25); lastT = now;
  if (real > 0) fps = fps ? fps * 0.9 + 0.1 / real : 1 / real;
  tuneResolution(real);
  renderDt = Math.min(real, 0.05);
  if (!renderer) return;
  if (bot) { render(); hudTick(); return; } // бот шагает сам, кадр только рисует
  readInput();
  let dt = Math.min(real, 0.05);
  const live = state === 'play' && !paused && !errored && !!scene;
  if (live) dt = gameStep(dt);
  // автопроверки (LAB_LOWRES) рисуют меню, паузу и конец партии 5 раз в секунду: без видеокарты игры в соседних рамках
  // и окнах, которые просто стоят, съедали процессор целиком, и новая игра в рамке грузилась по 30 секунд
  const idleSkip = window.LAB_LOWRES && !live && now - idleDrawn < 200 && !posterWanted && !frameWaiters.length;
  if (scene && cam && !idleSkip) { effectsStep(live ? dt : renderDt, live); render(); if (!live) idleDrawn = now; }
  tickFlash(renderDt);
  hudTick();
}
addEventListener('resize', resize);
document.addEventListener('visibilitychange', () => { if (document.hidden && state === 'play' && !paused) setPause(true); });

/* ---------------- клавиатура, кнопки, тач ---------------- */
addEventListener('keydown', e => {
  audio(); setPadMode(false);
  const code = e.code, tgt = e.target;
  if (code === 'Tab') { e.preventDefault(); togglePanel(); return; }
  if (tgt && (tgt.tagName === 'TEXTAREA' || (tgt.type === 'range' && /^(Arrow|Home|End|Page)/.test(code)))) return;
  const t = keyTarget(code);
  if (t) { e.preventDefault(); kb[t[0]][t[1]] = true; if (!e.repeat) kbTap[t[0]][t[1]] = true; }
  if ((code === 'Space' || code === 'Enter') && !e.repeat && state !== 'play') { e.preventDefault(); if (!overFresh()) confirm(); }
  else if ((code === 'Space' || code === 'Enter') && !e.repeat && paused) { e.preventDefault(); confirm(); }
  if (code === 'KeyP' || code === 'Escape') { if (state === 'play') setPause(!paused); }
  if (code === 'KeyM') { muted = !muted; store.set('lab3d:muted', muted ? '1' : '0'); updateMuteBtn(); }
  if (code === 'KeyR' && (state === 'play' || state === 'over') && !errored) restart(true);
});
addEventListener('keyup', e => { const t = keyTarget(e.code); if (t) kb[t[0]][t[1]] = false; });
addEventListener('blur', () => { for (const h of kb.concat(kbTap)) for (const k in h) h[k] = false; });
addEventListener('pointerdown', () => audio(), { capture: true });
$('#startBtn').addEventListener('click', confirm);
$('#againBtn').addEventListener('click', () => { if (state === 'over') restart(true); });
$('#resumeBtn').addEventListener('click', () => setPause(false));
$('#knobsBtn').addEventListener('click', () => togglePanel());
$('#overKnobs').addEventListener('click', () => togglePanel(true));
$('#muteBtn').addEventListener('click', () => { muted = !muted; store.set('lab3d:muted', muted ? '1' : '0'); updateMuteBtn(); });
$('#copyBtn').addEventListener('click', () => {
  const box = $('#copyBox'); box.hidden = false;
  box.value = 'Настройки «' + (G ? G.title : '') + '»:\n' + JSON.stringify(changedCfg(), null, 2);
  box.select(); try { navigator.clipboard.writeText(box.value); } catch (e) { /* выделено для копирования */ }
});
function buildTouch() {
  const used = new Set((G.controls || []).map(c => c.input));
  const L = [['left', '◀'], ['right', '▶']]; if (used.has('move4')) { L.unshift(['up', '▲']); L.push(['down', '▼']); }
  const R = []; if (used.has('b')) R.push(['b', 'B']); if (used.has('a') || !used.size) R.push(['a', 'A']);
  const mk = arr => '<div class="grp">' + arr.map(([k, t]) => `<button type="button" class="tbtn" data-k="${k}">${t}</button>`).join('') + '</div>';
  $('#touch').innerHTML = mk(L) + mk(R);
  document.querySelectorAll('.tbtn').forEach(b => {
    const k = b.dataset.k;
    b.addEventListener('pointerdown', e => { e.preventDefault(); audio(); b.classList.add('on'); if (state !== 'play') { if (!overFresh()) confirm(); return; } tch[k] = true; });
    const up = () => { b.classList.remove('on'); tch[k] = false; };
    b.addEventListener('pointerup', up); b.addEventListener('pointercancel', up); b.addEventListener('pointerleave', up);
  });
}

/* ---------------- сообщения от портала ---------------- */
addEventListener('message', e => {
  const m = e.data;
  if (!m || m.target !== 'lab-game') return;
  if (m.type === 'records') { classRecord = m.record || null; if (m.best > lab.best) lab.best = Math.round(m.best); showRecord(); }
  if (m.type === 'seed') { fixedSeed = m.seed == null ? null : (Number(m.seed) >>> 0); if (state === 'menu') buildRound(true); }
  if (m.type === 'data') { lab.data = m.data && typeof m.data === 'object' ? m.data : {}; if (state === 'menu') buildRound(true); }
  if (m.type === 'setCfg' && m.cfg) { for (const k in m.cfg) if (k in cfg) cfg[k] = Number(m.cfg[k]); document.querySelectorAll('.knob').forEach(w => w._sync && w._sync()); knobChanged(true); }
  if (m.type === 'pause') setPause(true);
  if (m.type === 'poster') posterWanted = true;
  if (m.type === 'playtest') playtest(m.options || {}).catch(err => post({ type: 'playtest', error: err.message }));
  if (m.type === 'botShow') botShow(m.options || {}).catch(err => post({ type: 'showDone', error: err.message }));
  if (m.type === 'reveal') setLupa(m.title || null);
  if (m.type === 'challengeOn') challengeOn = true;
  if (m.type === 'net') { const N = lab.net; N.on = true; N.others = Array.isArray(m.others) ? m.others.slice(0, 60) : []; N.room = m.room && typeof m.room === 'object' ? m.room : {}; N.at = performance.now(); N.clock = Number(m.now) || Date.now(); }
  if (m.type === 'ghost') ghost = m.ghost && Array.isArray(m.ghost.line) ? { nick: String(m.ghost.nick || 'соперник').slice(0, 24), score: Number(m.ghost.score) || 0, line: m.ghost.line.slice(0, 600) } : null;
});

/* ---------------- загрузка ---------------- */
function findGame() { try { return GAME; } catch (e) { return null; } } // eslint-disable-line no-undef
function loadScript(src) {
  return new Promise((res, rej) => { const s = document.createElement('script'); s.src = src; s.onload = res; s.onerror = () => rej(new Error('Не удалось загрузить ' + src)); document.body.appendChild(s); });
}
async function getGame() {
  let g = findGame();
  if (!g) {
    const src = params.get('game');
    if (!src) throw new Error('Нет игры: вставьте объект GAME в страницу или откройте её с параметром ?game=путь/к/игре.js');
    if (!/^[\w./-]+\.js$/.test(src) || src.includes('//')) throw new Error('Недопустимый путь к игре: ' + src);
    await loadScript(src);
    g = findGame();
  }
  if (!g) throw new Error('В файле игры не найден объект GAME');
  for (const f of ['start', 'update']) if (typeof g[f] !== 'function') throw new Error(`В объекте GAME нет функции ${f}(lab, …)`);
  return g;
}
async function boot() {
  try {
    const early = (window.__labEarly || [])[0]; window.__labEarly = null;
    if (early) throw early;
    makeRenderer();
    G = await getGame();
    for (const [k, c] of Object.entries(Object.assign({}, G.config || {}, SHELL_KNOBS))) { META[k] = c; DEFAULTS[k] = c.value; cfg[k] = c.value; }
    applyMeta(); buildPanel(); buildTouch();
    buildRound(true);
    state = 'menu';
    $('#startBtn').disabled = false;
    showRecord();
    window.__lab.ready = true;
    post({ type: 'ready', shell: SHELL_VERSION, engine: 'three', three: THREE.REVISION, meta: { title: G.title, donor: G.donor || '', players: lab.players, controls: G.controls || [], config: G.config || {}, presets: G.presets || {}, decisions: G.decisions || [], notes: G.notes || [] } });
  } catch (e) { fail(e, 'загрузка'); }
}

// доступ для автопроверки и отладки учителем
window.__lab = {
  ready: false, engine: 'three', lab, tele, session, get state() { return state; }, get paused() { return paused; }, get errored() { return errored; },
  get scene() { return scene; }, cfg, DEFAULTS,
  confirm, restart: () => restart(true), end: (k, t) => end(k || 'lose', t || 'Проверка'), togglePanel, playtest, botShow, setLupa,
  lowres: on => { window.LAB_LOWRES = !!on; resize(); },
  get lupa() { return lupa ? { title: lupa.title, n: lupa.n, on: performance.now() <= lupa.until } : null; },
  frames: (n = 1) => new Promise(res => frameWaiters.push({ at: frameNo + n, res })),
  info() { let objects = 0, meshes = 0; if (scene) scene.traverse(o => { objects++; if (o.isMesh && o.visible) meshes++; }); return { engine: 'three', version: THREE.REVISION, shell: SHELL_VERSION, draws: lastDraws, triangles: lastTris, objects, meshes, fps: Math.round(fps) }; },
  pixels() { // сколько разных оттенков и светлых точек в кадре: пустой ли экран
    render();
    const c = document.createElement('canvas'); c.width = 160; c.height = 90;
    const x = c.getContext('2d'); x.drawImage(canvas, 0, 0, 160, 90);
    const d = x.getImageData(0, 0, 160, 90).data, set = new Set(); let lit = 0, n = 0;
    for (let i = 0; i < d.length; i += 4 * 7) { n++; set.add((d[i] >> 4) << 8 | (d[i + 1] >> 4) << 4 | (d[i + 2] >> 4)); if (d[i] + d[i + 1] + d[i + 2] > 60) lit++; }
    return { colors: set.size, lit: Math.round(100 * lit / Math.max(1, n)) };
  },
};
requestAnimationFrame(loop);
boot(); // модуль выполняется после разбора страницы: объект GAME, вставленный в страницу, уже объявлен
