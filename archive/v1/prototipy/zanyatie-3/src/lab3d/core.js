/* ===== Лаборатория игр · 3D. Ядро: карты, ручки, ввод, звук, сцена, экраны ===== */
const $ = s => document.querySelector(s);
const LOOKS = ['Лис', 'Дракончик', 'Робот', 'Призрак', 'Пчела', 'Маг', 'Кот', 'Ракета', 'Нарт-всадник', 'Черепаха', 'Снеговик', 'Медведь', 'Сова', 'Лягушка', 'Горный пастух'];
const PALN = ['Лаго-Наки', 'Неон', 'Закат', 'Ночь', 'Конфетный', 'Пустыня', 'Ледник', 'Подводный', 'Вулкан', 'Осенний лес', 'Луна'];
const MUSN = ['Тишина и звуки мира', 'Мягкие ноты', 'Быстрый бит', 'Адыгские барабаны', 'Космический эмбиент', 'Чиптюн 8-бит', 'Эпический оркестр', 'Джаз с лапками'];
const CAMN = ['Сверху под углом', 'Из-за спины', 'Сбоку', 'Изометрия'];
const GOALN = ['Собирать', 'Охотиться', 'Найти выход', 'Выжить', 'Доставить', 'Защитить', 'Гонка', 'Построить'];
const VERBN = ['Рывок', 'Прыжок', 'Щит', 'Выстрел', 'Магнит', 'Замедление', 'Телепорт', 'Ловушка', 'Толчок'];
const THRN = ['Охотники', 'Метеоры', 'Патрули', 'Сжатие', 'Поднимается лава', 'Буря', 'Босс', 'Никого'];
const TWN = ['Без поворота', 'Жадность', 'Тьма', 'Эхо', 'Зеркало', 'День и ночь', 'Гравитация', 'Всё растёт', 'Одна жизнь'];
const PLEAS = ['Ощущения', 'Фантазия', 'Повествование', 'Вызов', 'Общение', 'Открытие', 'Самовыражение', 'Отдых'];
const PLEAS_HINT = { 'Ощущения': 'приятно двигаться, смотреть и слушать', 'Фантазия': 'я кто-то другой в другом мире', 'Повествование': 'со мной происходит история', 'Вызов': 'трудно, но я справляюсь', 'Общение': 'играю вместе с другими или против них', 'Открытие': 'хочу узнать, что будет дальше', 'Самовыражение': 'играю по-своему, в своём стиле', 'Отдых': 'спокойно, можно не напрягаться' };
const ix = (list, name) => Math.max(0, list.indexOf(String(name || '').replace(/^\S+\s(?=[А-ЯЁA-Z])/u, '').trim()));

const CONFIG = {
  look: { value: ix(LOOKS, DESIGN.look), max: LOOKS.length - 1, names: LOOKS, label: 'Облик героя', card: 1 },
  pal: { value: ix(PALN, DESIGN.pal), max: PALN.length - 1, names: PALN, label: 'Палитра мира', card: 1 },
  music: { value: ix(MUSN, DESIGN.music), max: 7, names: MUSN, label: 'Музыка', card: 1 },
  camera: { value: ix(CAMN, DESIGN.camera), max: 3, names: CAMN, label: 'Камера', card: 1 },
  goal: { value: ix(GOALN, DESIGN.goal), max: 7, names: GOALN, label: 'Цель', card: 1 },
  verb: { value: ix(VERBN, DESIGN.verb), max: 8, names: VERBN, label: 'Глагол на A', card: 1 },
  threat: { value: ix(THRN, DESIGN.threat), max: 7, names: THRN, label: 'Угроза', card: 1 },
  twist: { value: ix(TWN, DESIGN.twist), max: 8, names: TWN, label: 'Поворот', card: 1 },
  heroSpeed: { value: 10, min: 4, max: 18, step: 0.5, label: 'Скорость героя' },
  foeSpeed: { value: 5.5, min: 1.5, max: 12, step: 0.5, label: 'Скорость угроз' },
  spawnEvery: { value: 4, min: 1, max: 10, step: 0.5, label: 'Новая угроза раз в, с' },
  verbCd: { value: 1.2, min: 0.2, max: 6, step: 0.1, label: 'Перезарядка глагола, с' },
  roundTime: { value: 60, min: 20, max: 120, step: 5, label: 'Длина раунда, с' },
  lives: { value: 3, min: 1, max: 9, step: 1, label: 'Жизни' },
  shake: { value: 1, min: 0, max: 2, step: 0.1, label: 'Тряска камеры' },
  juice: { value: 1, min: 0, max: 2, step: 0.1, label: 'Сочность частиц' },
};
const DEFAULTS = {}, cfg = {};
for (const k in CONFIG) { const c = CONFIG[k]; c.min = c.min ?? 0; c.step = c.step ?? 1; DEFAULTS[k] = c.value; cfg[k] = c.value; }
const ci = k => Math.round(cfg[k]);

/* ---------- ввод ---------- */
const held = { left: 0, right: 0, up: 0, down: 0, a: 0, b: 0 }, kb = { ...held }, tch = { ...held }, pd = { ...held };
let prevHeld = { ...held }; const pressed = { ...held };
let padMode = false, padPrev = [], padAxes = [0, 0];
const KEYS = { ArrowLeft: 'left', KeyA: 'left', ArrowRight: 'right', KeyD: 'right', ArrowUp: 'up', KeyW: 'up', ArrowDown: 'down', KeyS: 'down', Space: 'a', KeyJ: 'a', KeyZ: 'a', ShiftLeft: 'b', ShiftRight: 'b', KeyX: 'b', KeyK: 'b' };
let state = 'menu', paused = false, errored = false;
function readInput() {
  pollPad();
  for (const k in held) { held[k] = kb[k] || tch[k] || pd[k] ? 1 : 0; pressed[k] = held[k] && !prevHeld[k]; }
  prevHeld = { ...held };
}
function setPad(on) {
  if (on === padMode) return; padMode = on; labels();
}
function pollPad() {
  for (const k in pd) pd[k] = 0; padAxes = [0, 0];
  let gp = null; try { gp = [...(navigator.getGamepads ? navigator.getGamepads() : [])].find(Boolean); } catch (e) {}
  if (!gp) return;
  const b = gp.buttons.map(x => !!(x && x.pressed)), ax = gp.axes[0] || 0, ay = gp.axes[1] || 0;
  if (Math.hypot(ax, ay) > 0.25) padAxes = [ax, ay];
  pd.left = ax < -0.4 || b[14]; pd.right = ax > 0.4 || b[15]; pd.up = ay < -0.4 || b[12]; pd.down = ay > 0.4 || b[13];
  pd.a = b[0] || b[7]; pd.b = b[1] || b[2] || b[6];
  if (b.some(Boolean) || Math.hypot(ax, ay) > 0.4) setPad(true);
  const dn = i => b[i] && !padPrev[i];
  if (state === 'over') {
    if (dn(14)) overFocus(-1); if (dn(15)) overFocus(1); if (dn(0)) toggleFelt(ofc); if (dn(1)) changeCard(); if (dn(9)) startGame(); if (dn(8)) togglePanel();
  } else {
    if (dn(0) && state === 'menu') startGame();
    if (dn(9)) { if (state === 'play') setPause(!paused); else if (state === 'menu') startGame(); }
    if (dn(8)) togglePanel();
  }
  padPrev = b;
}
addEventListener('keydown', e => {
  audio(); setPad(false);
  if (e.code === 'Tab') { e.preventDefault(); togglePanel(); return; }
  if (e.target && (e.target.tagName === 'TEXTAREA' || (e.target.type === 'range' && e.code.startsWith('Arrow')))) return;
  const k = KEYS[e.code]; if (k) { e.preventDefault(); kb[k] = 1; }
  if (state === 'over') {
    const n = +e.key; if (n >= 1 && n <= 8) { toggleFelt(n - 1); return; }
    if (e.code === 'KeyC') { changeCard(); return; }
  }
  if ((e.code === 'Space' || e.code === 'Enter') && !e.repeat && e.target.tagName !== 'BUTTON') { if (state === 'menu' || state === 'over') startGame(); else if (paused) setPause(false); }
  if (e.code === 'KeyP' || e.code === 'Escape') setPause(!paused);
  if (e.code === 'KeyM') toggleMute();
  if (e.code === 'KeyR' && state === 'play') startGame();
});
addEventListener('keyup', e => { const k = KEYS[e.code]; if (k) kb[k] = 0; });
addEventListener('blur', () => { for (const k in kb) kb[k] = 0; });
addEventListener('pointerdown', () => audio(), { capture: true });
document.querySelectorAll('.tbtn').forEach(b => {
  const k = b.dataset.k;
  b.addEventListener('pointerdown', e => { e.preventDefault(); audio(); b.classList.add('on'); if (state !== 'play') { if (state === 'menu' || state === 'over') startGame(); return; } tch[k] = 1; });
  const up = () => { b.classList.remove('on'); tch[k] = 0; };
  b.addEventListener('pointerup', up); b.addEventListener('pointercancel', up); b.addEventListener('pointerleave', up);
});
function rumble(ms = 150, s = 0.6) { try { const gp = [...navigator.getGamepads()].find(Boolean); if (gp && gp.vibrationActuator) gp.vibrationActuator.playEffect('dual-rumble', { duration: ms, strongMagnitude: s, weakMagnitude: s * 0.6 }); } catch (e) {} }

/* ---------- звук ---------- */
let AC = null, master = null, noiseBuf = null, muted = false;
function audio() {
  if (AC) { if (AC.state === 'suspended') AC.resume(); return; }
  try {
    AC = new (window.AudioContext || window.webkitAudioContext)(); master = AC.createGain(); master.gain.value = 0.45; master.connect(AC.destination);
    noiseBuf = AC.createBuffer(1, AC.sampleRate, AC.sampleRate); const d = noiseBuf.getChannelData(0); for (let i = 0; i < d.length; i++) d[i] = Math.random() * 2 - 1;
  } catch (e) { AC = null; }
}
function tone(f, dur = 0.12, type = 'square', vol = 0.1, slide = 0, delay = 0) {
  if (!AC || muted) return;
  try { const t = AC.currentTime + delay, o = AC.createOscillator(), g = AC.createGain(); o.type = type; o.frequency.setValueAtTime(Math.max(20, f), t); if (slide) o.frequency.exponentialRampToValueAtTime(Math.max(20, slide), t + dur); g.gain.setValueAtTime(vol, t); g.gain.exponentialRampToValueAtTime(0.0001, t + dur); o.connect(g); g.connect(master); o.start(t); o.stop(t + dur + 0.02); } catch (e) {}
}
function noise(dur = 0.2, vol = 0.15, freq = 1000, delay = 0) {
  if (!AC || muted) return;
  try { const t = AC.currentTime + delay, s = AC.createBufferSource(), f = AC.createBiquadFilter(), g = AC.createGain(); s.buffer = noiseBuf; f.type = 'lowpass'; f.frequency.value = freq; g.gain.setValueAtTime(vol, t); g.gain.exponentialRampToValueAtTime(0.0001, t + dur); s.connect(f); f.connect(g); g.connect(master); s.start(t); s.stop(t + dur + 0.02); } catch (e) {}
}
const sfx = {
  jump: () => tone(380, 0.12, 'square', 0.07, 760), coin: () => { tone(880, 0.07, 'triangle', 0.1); tone(1320, 0.12, 'triangle', 0.1, 0, 0.06); },
  hit: () => { tone(320, 0.3, 'sawtooth', 0.14, 70); noise(0.22, 0.2, 1600); }, boom: () => { noise(0.4, 0.25, 700); tone(110, 0.3, 'sine', 0.25, 40); },
  power: () => [523, 659, 784, 1046].forEach((f, i) => tone(f, 0.1, 'square', 0.06, 0, i * 0.06)), whoosh: () => { noise(0.25, 0.1, 3000); tone(200, 0.25, 'sine', 0.08, 900); },
  win: () => [523, 659, 784, 1046, 1318].forEach((f, i) => tone(f, 0.16, 'triangle', 0.1, 0, i * 0.09)), lose: () => [784, 622, 523, 392].forEach((f, i) => tone(f, 0.22, 'triangle', 0.12, 0, i * 0.14)),
  zap: () => tone(900, 0.07, 'square', 0.06, 400), warn: () => { tone(660, 0.1, 'square', 0.06); tone(660, 0.1, 'square', 0.06, 0, 0.18); },
};
function toggleMute() { muted = !muted; $('#muteBtn').setAttribute('aria-pressed', String(muted)); labels(); }
$('#muteBtn').onclick = e => { toggleMute(); e.currentTarget.blur(); };

/* ---------- сцена ---------- */
const AX = 20, AZ = 11.25;
const cv = $('#cv');
const R = new THREE.WebGLRenderer({ canvas: cv, antialias: true });
R.setPixelRatio(Math.min(2, devicePixelRatio || 1)); R.shadowMap.enabled = true; R.shadowMap.type = THREE.PCFSoftShadowMap;
R.toneMapping = THREE.NoToneMapping;
const scene = new THREE.Scene();
const camP = new THREE.PerspectiveCamera(50, 16 / 9, 0.1, 400);
const camO = new THREE.OrthographicCamera(-20, 20, 12, -12, 0.1, 400);
let cam = camP;
const hemi = new THREE.HemisphereLight(0xffffff, 0x444444, 0.75); scene.add(hemi);
const sun = new THREE.DirectionalLight(0xffffff, 1.1); sun.position.set(-18, 34, 16); sun.castShadow = true;
sun.shadow.mapSize.set(2048, 2048); Object.assign(sun.shadow.camera, { left: -32, right: 32, top: 24, bottom: -24, near: 1, far: 100 }); sun.shadow.bias = -0.0008; sun.shadow.normalBias = 0.03;
scene.add(sun); scene.add(sun.target);
function resize() { const w = innerWidth, h = innerHeight; R.setSize(w, h, false); camP.aspect = w / h; camP.updateProjectionMatrix(); const k = 13.5, a = w / h; camO.left = -k * a; camO.right = k * a; camO.top = k; camO.bottom = -k; camO.updateProjectionMatrix(); }
addEventListener('resize', resize); resize();

/* ---------- частицы ---------- */
const PGEO = new THREE.TetrahedronGeometry(0.16, 0);
const parts = [];
const pmats = {};
const pmat = c => pmats[c] || (pmats[c] = new THREE.MeshBasicMaterial({ color: c, transparent: true }));
function burst(p, o = {}) {
  const n = Math.round((o.count ?? 16) * cfg.juice), cols = [].concat(o.colors || o.color || '#ffffff');
  for (let i = 0; i < n && parts.length < 700; i++) {
    const m = new THREE.Mesh(PGEO, pmat(cols[i % cols.length])); const a = Math.random() * 6.283, el = (o.up ?? 0.6) * Math.random(), sp = (o.speed ?? 8) * (0.3 + Math.random() * 0.9);
    m.position.set(p.x, (p.y ?? 0.6), p.z); const s = (o.size ?? 1) * (0.6 + Math.random() * 0.8); m.scale.setScalar(s);
    m.userData = { v: new THREE.Vector3(Math.cos(a) * sp, el * sp + (o.lift ?? 2), Math.sin(a) * sp), life: (o.life ?? 0.7) * (0.6 + Math.random() * 0.7), g: o.gravity ?? 14, s, spin: Math.random() * 10 };
    m.userData.max = m.userData.life; scene.add(m); parts.push(m);
  }
}
function stepParts(dt) {
  for (let i = parts.length - 1; i >= 0; i--) {
    const m = parts[i], u = m.userData; u.life -= dt;
    if (u.life <= 0) { scene.remove(m); parts.splice(i, 1); continue; }
    u.v.y -= u.g * dt; u.v.multiplyScalar(1 - 1.6 * dt); m.position.addScaledVector(u.v, dt); if (m.position.y < 0.05) { m.position.y = 0.05; u.v.y *= -0.4; }
    m.rotation.x += u.spin * dt; m.rotation.y += u.spin * dt; m.scale.setScalar(u.s * Math.max(0.05, u.life / u.max));
  }
}
let shakeAmp = 0, flashA = 0;
function shake(a = 0.4) { shakeAmp = Math.max(shakeAmp, a); }
const popups = [];
function popup(p, text, color = '#ffffff') {
  const el = document.createElement('div'); el.textContent = text;
  el.style.cssText = `position:absolute;font:800 18px var(--display);color:${color};text-shadow:0 2px 0 #000;pointer-events:none;z-index:3;transform:translate(-50%,-50%)`;
  $('#stage').appendChild(el); popups.push({ el, p: new THREE.Vector3(p.x, (p.y ?? 1) + 1.2, p.z), t: 0.9 });
}
function stepPopups(dt) {
  for (let i = popups.length - 1; i >= 0; i--) {
    const q = popups[i]; q.t -= dt; q.p.y += 1.6 * dt;
    if (q.t <= 0) { q.el.remove(); popups.splice(i, 1); continue; }
    const v = q.p.clone().project(cam); q.el.style.left = ((v.x + 1) / 2 * innerWidth) + 'px'; q.el.style.top = ((1 - v.y) / 2 * innerHeight) + 'px'; q.el.style.opacity = Math.min(1, q.t * 2);
  }
}

/* ---------- ручки ---------- */
const fmtK = (k, v) => CONFIG[k].names ? CONFIG[k].names[Math.round(v)] : (CONFIG[k].step >= 1 ? String(Math.round(v)) : Number(v).toFixed(CONFIG[k].step >= 0.1 ? 1 : 2));
function buildKnobs() {
  const box = $('#knobs'); box.innerHTML = '';
  for (const k in CONFIG) {
    const c = CONFIG[k], w = document.createElement('div'); w.className = 'knob' + (c.card ? ' cardk' : '');
    w.innerHTML = `<label for="k-${k}">${c.label}</label><output></output><input type="range" id="k-${k}" min="${c.min}" max="${c.max}" step="${c.step}">`;
    const inp = w.querySelector('input'), out = w.querySelector('output');
    w._sync = () => { inp.value = cfg[k]; out.textContent = fmtK(k, cfg[k]); w.classList.toggle('changed', Math.abs(cfg[k] - DEFAULTS[k]) > 1e-9); };
    inp.oninput = () => { cfg[k] = +inp.value; w._sync(); onKnob(k); $('#copyBox').hidden = true; };
    inp.onchange = () => inp.blur();
    box.appendChild(w); w._sync();
  }
}
function syncKnobs() { document.querySelectorAll('.knob').forEach(w => w._sync()); }
function togglePanel(force) { const p = $('#panel'), open = force != null ? force : p.hidden; p.hidden = !open; $('#knobsBtn').setAttribute('aria-pressed', String(open)); }
$('#knobsBtn').onclick = e => { togglePanel(); e.currentTarget.blur(); };
$('#resetBtn').onclick = () => { Object.assign(cfg, DEFAULTS); syncKnobs(); onKnob('*'); };
$('#copyBtn').onclick = e => {
  const txt = 'const CONFIG = {\n' + Object.keys(CONFIG).map(k => `  ${k}: ${CONFIG[k].names ? Math.round(cfg[k]) : cfg[k]}, // ${CONFIG[k].label}${CONFIG[k].names ? ': ' + fmtK(k, cfg[k]) : ''}`).join('\n') + '\n};';
  copyText(txt, e.currentTarget, $('#copyBox'), 'Скопировать CONFIG');
};
function copyText(txt, btn, box, label) {
  const show = () => { box.value = txt; box.hidden = false; box.select(); btn.textContent = 'Выдели и скопируй'; };
  try { navigator.clipboard.writeText(txt).then(() => { btn.textContent = 'Скопировано'; setTimeout(() => btn.textContent = label, 1500); }, show); } catch (e) { show(); }
}

/* ---------- экраны ---------- */
function labels() {
  const p = padMode;
  $('#startBtn').textContent = p ? 'Играть · A' : 'Играть · пробел';
  $('#againBtn').textContent = p ? 'Ещё раз · Start' : 'Ещё раз · пробел';
  $('#changeBtn').textContent = p ? 'Поменять одну карту · B' : 'Поменять одну карту · C';
  $('#resumeBtn').textContent = p ? 'Продолжить · Start' : 'Продолжить · P';
  $('#knobsBtn').textContent = p ? 'Ручки · Select' : 'Ручки · Tab';
  $('#muteBtn').textContent = (muted ? 'Без звука' : 'Звук') + (p ? '' : ' · M');
  $('#padHint').textContent = p ? 'Геймпад подключён: удары отдаются вибрацией. Клавиатура тоже работает.' : 'Есть геймпад? Нажми на нём любую кнопку, и подсказки переключатся на его кнопки.';
  const verb = VERBN[ci('verb')], hold = [4, 5].includes(ci('verb'));
  const rows = p
    ? [`<kbd>Стик / крестовина</kbd> двигаться`, `<kbd>A</kbd> ${verb.toLowerCase()}${hold ? ' (держать)' : ''}`, `<kbd>Select</kbd> ручки · <kbd>Start</kbd> пауза`]
    : [`<kbd>WASD</kbd> или <kbd>стрелки</kbd> двигаться`, `<kbd>Пробел</kbd> ${verb.toLowerCase()}${hold ? ' (держать)' : ''}`, `<kbd>Tab</kbd> ручки · <kbd>P</kbd> пауза · <kbd>R</kbd> заново`];
  $('#controls').innerHTML = rows.map(r => `<div>${r}</div>`).join('');
  if (state === 'over') overChips();
}
function setPause(v) { if (state !== 'play') return; paused = v; $('#pauseScreen').hidden = !v; if (v) for (const k in kb) kb[k] = 0; }
$('#startBtn').onclick = () => { audio(); startGame(); };
$('#againBtn').onclick = () => startGame();
$('#resumeBtn').onclick = () => setPause(false);
$('#changeBtn').onclick = () => changeCard();
document.addEventListener('visibilitychange', () => { if (document.hidden && state === 'play') setPause(true); });
const store = { get(k) { try { return localStorage.getItem(k); } catch (e) { return null; } }, set(k, v) { try { localStorage.setItem(k, v); } catch (e) {} } };
function fail(where, e) {
  errored = true; const box = $('#errBox'); box.hidden = false;
  box.innerHTML = `<b>Ошибка в коде игры ${where}:</b> ${String((e && e.message) || e).replace(/[<>&]/g, '')}`;
}
addEventListener('error', e => { if (!errored) fail('при загрузке', e.error || e.message); });
