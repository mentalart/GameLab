/* =====================================================================
   Лаборатория игр · оболочка игры («слой Лаб3D») для Babylon.js 9.31.0
   ---------------------------------------------------------------------
   Игра — один объект GAME (его пишет Qwen на обычном Babylon.js).
   Оболочка делает служебное, одинаковое для всех игр курса:
   жизненный цикл партии и экраны, ввод (клавиатура, два геймпада, тач),
   ручки геймдизайнера (Tab) с пресетами, камеры, свет и тени, сочность,
   звук, случайность по зерну, телеметрию, рекорды и связь с порталом.
   Контракт GAME и API объекта lab описаны в portal/engine/README.md.
   ===================================================================== */
(function () {
  'use strict';
  const B = window.BABYLON;
  const $ = s => document.querySelector(s);
  const SHELL_VERSION = '0.3';

  /* ---------------- хранилище и связь с порталом ---------------- */
  const store = {
    get(k) { try { return localStorage.getItem(k); } catch (e) { return null; } },
    set(k, v) { try { localStorage.setItem(k, v); } catch (e) { /* хранилище недоступно */ } },
  };
  const post = m => { try { if (window.parent !== window) window.parent.postMessage(Object.assign({ source: 'lab-game' }, m), '*'); } catch (e) { /* нет портала */ } };
  const params = new URLSearchParams(location.search);

  /* ---------------- звук: Web Audio без файлов ---------------- */
  let AC = null, master = null, noiseBuf = null, muted = store.get('lab3d:muted') === '1';
  function audio() {
    if (AC) { if (AC.state === 'suspended') AC.resume(); return; }
    try {
      AC = new (window.AudioContext || window.webkitAudioContext)();
      master = AC.createGain(); master.gain.value = 0.45; master.connect(AC.destination);
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
      gn.gain.setValueAtTime(vol, t); gn.gain.exponentialRampToValueAtTime(0.0001, t + dur);
      o.connect(gn); gn.connect(master); o.start(t); o.stop(t + dur + 0.02);
    } catch (e) { /* звук не критичен */ }
  }
  function noise(dur = 0.2, vol = 0.15, freq = 1000, delay = 0) {
    if (!AC || muted || !on('sound')) return;
    try {
      const t = AC.currentTime + delay, s = AC.createBufferSource(), f = AC.createBiquadFilter(), gn = AC.createGain();
      s.buffer = noiseBuf; f.type = 'lowpass'; f.frequency.value = freq;
      gn.gain.setValueAtTime(vol, t); gn.gain.exponentialRampToValueAtTime(0.0001, t + dur);
      s.connect(f); f.connect(gn); gn.connect(master); s.start(t); s.stop(t + dur + 0.02);
    } catch (e) { /* звук не критичен */ }
  }
  const sfx = {
    jump: () => tone(380, 0.1, 'square', 0.07, 760),
    shoot: () => { tone(980, 0.07, 'square', 0.05, 420); noise(0.05, 0.05, 4000); },
    coin: () => { tone(880, 0.07, 'triangle', 0.1); tone(1320, 0.12, 'triangle', 0.1, 0, 0.06); },
    hit: () => { tone(320, 0.3, 'sawtooth', 0.14, 70); noise(0.22, 0.2, 1600); },
    explode: () => { noise(0.4, 0.25, 700); tone(110, 0.3, 'sine', 0.25, 40); },
    power: () => [523, 659, 784, 1046].forEach((f, i) => tone(f, 0.1, 'square', 0.06, 0, i * 0.06)),
    beep: () => tone(660, 0.1, 'square', 0.08),
    warn: () => { tone(520, 0.08, 'square', 0.05); tone(520, 0.08, 'square', 0.05, 0, 0.12); },
    whoosh: () => { noise(0.25, 0.1, 3000); tone(200, 0.25, 'sine', 0.08, 900); },
    win: () => [523, 659, 784, 1046, 1318].forEach((f, i) => tone(f, 0.16, 'triangle', 0.1, 0, i * 0.09)),
    lose: () => [784, 622, 523, 392].forEach((f, i) => tone(f, 0.22, 'triangle', 0.12, 0, i * 0.14)),
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
    if (!on('vibrate')) return;
    try {
      for (const gp of navigator.getGamepads()) if (gp && gp.vibrationActuator) gp.vibrationActuator.playEffect('dual-rumble', { duration: ms, strongMagnitude: strength, weakMagnitude: strength * 0.6 });
    } catch (e) { /* без вибрации */ }
  }
  function setPadMode(on) {
    if (on === padMode) return;
    padMode = on; labels();
  }

  /* ---------------- состояние оболочки ---------------- */
  const canvas = $('#cv');
  const engine = new B.Engine(canvas, true, { stencil: true, powerPreference: 'high-performance' }, true);
  let G = null, state = 'loading', paused = false, errored = false, freshPreview = false, havok = null;
  let scene = null, cam = null, camKind = 'iso', camFit = null, sg = null, glow = null;
  let sps = null, parts = [], popups = [], warns = [], pulses = [], whites = [], follow = null;
  let shakeAmp = 0, flashA = 0, hitstopT = 0, camShakeOff = null, matCache = {};
  const cfg = {}, DEFAULTS = {}, META = {};
  const tele = { presses: {}, hold: {}, hurts: 0, custom: {}, stats: {}, marks: {}, line: [] }; // line — счёт на каждой секунде партии (призрак соперника в вызове)
  const session = { rounds: 0, restarts: 0 };
  let classRecord = null;

  const SHELL_KNOBS = {
    shake: { value: 1, min: 0, max: 2, step: 0.1, label: 'Тряска камеры' },
    juice: { value: 1, min: 0, max: 2, step: 0.1, label: 'Сочность частиц' },
    glow: { value: 1, min: 0, max: 2, step: 0.1, label: 'Свечение' },
    quality: { value: 1, min: 0, max: 2, step: 1, label: 'Качество графики', names: ['быстро', 'обычно', 'красиво'], restart: true },
  };
  // 12 переключателей сочности (урок 6): каждый эффект оболочки можно выключить в любой игре, механика остаётся той же.
  // Пресеты игры могут их менять (пресет «Без секрета» в «Ледоломе» выключает все), «Как задумано» включает обратно.
  const JUICE = [['hitstop', 'Стоп-кадр на ударе'], ['shake', 'Тряска камеры'], ['squash', 'Сжатие и растяжение'], ['burst', 'Частицы'],
    ['flash', 'Вспышка экрана'], ['whiten', 'Вспышка попадания'], ['popup', 'Всплывающие очки и надписи'], ['sound', 'Звук'],
    ['pitch', 'Звук выше с каждым ударом подряд'], ['vibrate', 'Вибрация геймпада'], ['glow', 'Свечение'], ['slowmo', 'Замедление в решающий момент']];
  for (const [k, label] of JUICE) SHELL_KNOBS['j_' + k] = { value: 1, min: 0, max: 1, step: 1, label, names: ['выкл', 'вкл'], juice: true };
  function on(name) { return !(('j_' + name) in cfg) || cfg['j_' + name] >= 1; }
  let slowT = 0, slowK = 1;

  /* ---------------- API для игры: объект lab ---------------- */
  const lab = {
    BABYLON: B, engine, scene: null, camera: null, light: null, shadows: null,
    t: 0, dt: 0, state: {}, cfg, seed: 0, round: 0,
    p1: P[0], p2: P[1], players: 1,
    score: 0, lives: 3, invuln: 0, best: 0,
    get playing() { return state === 'play' && !paused; },

    // очки, жизни, конец партии
    addScore(n, at, color) { lab.score += n; if (at) popup(at, (n > 0 ? '+' : '') + n, color || accent()); },
    hurt(at, text) {
      if (lab.invuln > 0 || state !== 'play') return false;
      tele.hurts++;
      lab.invuln = 1.2; if (on('hitstop')) hitstopT = Math.max(hitstopT, 0.08);
      lab.shake(0.9); lab.flash('#ff4d5e', 0.35); sfx.hit(); rumble(250, 0.9);
      if (at) lab.burst(at, { count: 22, colors: ['#ff4d5e', '#ffb35c', '#ffffff'], speed: 7 });
      if (lab.lives > 0) { lab.lives--; if (lab.lives <= 0) lab.gameOver(text); }
      return true;
    },
    blink() { return lab.invuln > 0 && Math.floor(lab.invuln * 12) % 2 === 0; },
    gameOver(text) { end('lose', text || 'Игра окончена'); },
    win(text) { end('win', text || 'Победа!'); },

    // сочность
    shake(power = 0.5) { if (on('shake')) shakeAmp = Math.max(shakeAmp, power * cfg.shake); },
    flash(color = '#ffffff', alpha = 0.3) { if (!on('flash')) return; const f = $('#flash'); f.style.background = color; flashA = Math.max(flashA, alpha * Math.min(1, cfg.juice || 1)); },
    hitstop(sec = 0.06) { if (on('hitstop')) hitstopT = Math.max(hitstopT, sec); },
    burst(at, o = {}) { if (on('burst')) burst(posOf(at), o); },
    popup(at, text, color = '#ffffff', size = 18) { if (on('popup')) popup(at, text, color, size); },
    pulse(mesh, k = 1.3, sec = 0.14) { if (on('squash') && mesh && mesh.scaling && !pulses.some(p => p.mesh === mesh)) pulses.push({ mesh, base: mesh.scaling.clone(), k, t: 0, dur: sec }); },
    whiten(mesh, sec = 0.08, color = '#ffffff') { if (mesh && on('whiten')) whiten(mesh, sec, color); },
    slowmo(sec = 0.6, scale = 0.3) { if (on('slowmo')) { slowT = Math.max(slowT, sec); slowK = lab.clamp(scale, 0.05, 1); } },
    pitch(n = 0) { return on('pitch') ? Math.pow(2, Math.min(Math.max(0, n), 24) / 12) : 1; }, // на полутон выше с каждым ударом подряд
    juicy(name) { return on(name); }, // свой эффект игры подчиняется переключателю: lab.juicy('squash')
    warn(at, radius = 1, sec = 0.6, color = '#ff4d5e') { return warn(posOf(at), radius, sec, color); },
    vibrate: rumble,

    // звук
    sfx, tone, noise,

    // случайность по зерну и математика
    rand(a = 0, b = 1) { return a + (b - a) * rng(); },
    randInt(a, b) { return Math.floor(a + (b - a + 1) * rng()); },
    pick(arr) { return arr[Math.floor(rng() * arr.length)]; },
    chance(p) { return rng() < p; },
    clamp(v, a, b) { return Math.max(a, Math.min(b, v)); },
    lerp(a, b, k) { return a + (b - a) * k; },
    v3(x = 0, y = 0, z = 0) { return new B.Vector3(x, y, z); },
    dist(a, b) { return B.Vector3.Distance(posOf(a), posOf(b)); },
    flat(a, b) { const p = posOf(a), q = posOf(b); return Math.hypot(p.x - q.x, p.z - q.z); },
    near(a, b, r) { return lab.dist(a, b) < r; },

    // мир
    color(hex) { return B.Color3.FromHexString(hex); },
    mat(hex, o = {}) { return mat(hex, o); },
    ground(o = {}) {
      const g = B.MeshBuilder.CreateGround('земля', { width: o.w || 60, height: o.h || 60, subdivisions: o.subdivisions || 1 }, scene);
      g.position.y = o.y || 0; g.material = mat(o.color || '#3f7d4a'); g.receiveShadows = true;
      g.metadata = Object.assign({}, g.metadata, { noShadow: true });
      return g;
    },
    shadow(mesh) { if (sg && mesh) sg.addShadowCaster(mesh, true); return mesh; },
    noShadow(mesh) { if (mesh) { mesh.metadata = Object.assign({}, mesh.metadata, { noShadow: true }); if (sg) sg.removeShadowCaster(mesh, true); } return mesh; },
    follow(mesh, o = {}) { follow = mesh ? { mesh, distance: o.distance || 9, height: o.height || 4, lag: o.lag == null ? 0.15 : o.lag, look: o.look || 1 } : null; },
    setCamera(kind, o) { setupCamera(kind, o); },

    // интерфейс и телеметрия
    hud(key, text) { if (text == null) delete hudLines[key]; else hudLines[key] = String(text); },
    // имя с «_» — скрытый счётчик: уходит порталу, на экран конца партии не попадает; его моменты (секунда партии) копятся в marks для раскрытия секрета
    count(name, n = 1) {
      tele.custom[name] = (tele.custom[name] || 0) + n;
      if (name[0] !== '_') return;
      const m = tele.marks[name] = tele.marks[name] || [], t = Math.round(lab.t * 10) / 10;
      if (m.length < 300 && !(m.length && t - m[m.length - 1] < 0.25)) m.push(t);
    },
    stat(name, value) { tele.stats[name] = value; },
  };
  let hudLines = {};
  const accent = () => (G && G.accent) || '#ffe08a';
  const posOf = a => (a && a.getAbsolutePosition) ? a.getAbsolutePosition() : (a instanceof B.Vector3 ? a : Array.isArray(a) ? new B.Vector3(a[0] || 0, a[1] || 0, a[2] || 0) : new B.Vector3(a.x || 0, a.y || 0, a.z || 0));

  function mat(hex, o = {}) {
    const key = hex + JSON.stringify(o);
    if (matCache[key]) return matCache[key];
    const m = new B.StandardMaterial('цвет ' + hex, scene);
    const c = B.Color3.FromHexString(hex);
    m.diffuseColor = c;
    m.specularColor = o.shiny ? new B.Color3(0.4, 0.4, 0.4) : new B.Color3(0.04, 0.04, 0.04);
    if (o.glow) m.emissiveColor = c.scale(Math.min(1, o.glow));
    if (o.alpha != null) m.alpha = o.alpha;
    if (o.unlit) { m.disableLighting = true; m.emissiveColor = c; }
    matCache[key] = m;
    return m;
  }

  /* ---------------- сцена, свет, камера ---------------- */
  function disposeScene() {
    parts = []; popups.forEach(p => p.el.remove()); popups = []; warns = []; pulses = []; whites = []; follow = null; matCache = {};
    if (scene) { try { scene.dispose(); } catch (e) { /* уже освобождена */ } }
    scene = null; sg = null; glow = null; sps = null; cam = null;
  }
  function buildScene() {
    const q = Math.round(cfg.quality);
    engine.setHardwareScalingLevel(q === 0 ? 1.5 : 1);
    scene = new B.Scene(engine);
    lab.scene = scene;
    const sky = G.sky || '#1b2440';
    scene.clearColor = B.Color4.FromHexString(sky.length === 7 ? sky + 'ff' : sky);
    scene.ambientColor = new B.Color3(0.3, 0.3, 0.34);
    scene.skipPointerMovePicking = true; // игры не выбирают меши мышью при движении — экономим кадр
    if (G.fog) { scene.fogMode = B.Scene.FOGMODE_EXP2; scene.fogDensity = G.fog; scene.fogColor = B.Color3.FromHexString(sky.slice(0, 7)); }
    const hemi = new B.HemisphericLight('небо', new B.Vector3(0.2, 1, -0.3), scene);
    hemi.intensity = 0.7; hemi.groundColor = new B.Color3(0.28, 0.25, 0.32);
    const sun = new B.DirectionalLight('солнце', new B.Vector3(-0.45, -1, 0.4), scene);
    sun.position = new B.Vector3(30, 50, -30); sun.intensity = 0.85;
    lab.light = { hemi, sun };
    if (q > 0) {
      sg = new B.ShadowGenerator(q === 2 ? 2048 : 1024, sun);
      sg.usePercentageCloserFiltering = true;
      sg.filteringQuality = B.ShadowGenerator.QUALITY_LOW;
      sg.bias = 0.0015;
    }
    lab.shadows = sg;
    if (q > 0 && cfg.glow > 0) { glow = new B.GlowLayer('свечение', scene, { blurKernelSize: 32 }); glow.intensity = 0.65 * cfg.glow * (on('glow') ? 1 : 0); }
    // каждый новый меш принимает тени и (кроме земли и служебных) отбрасывает их
    scene.onNewMeshAddedObservable.add(m => {
      m.receiveShadows = true;
      // копии (createInstance) наследуют noShadow от исходного меша; в карту теней их добавляем — так они рисуются пачкой
      if (sg) setTimeout(() => {
        const src = m.sourceMesh, no = x => !!(x && x.metadata && x.metadata.noShadow);
        if (!m.isDisposed() && !no(m) && !no(src) && !m.name.startsWith('лаб:')) sg.addShadowCaster(m, false);
      }, 0);
    });
    setupCamera(G.camera);
    makeParticles();
    if (havok) scene.enablePhysics(new B.Vector3(0, -(G.gravity == null ? 9.81 : G.gravity), 0), new B.HavokPlugin(true, havok));
  }
  function fitRadius(w, h, fov) {
    const aspect = engine.getRenderWidth() / Math.max(1, engine.getRenderHeight());
    const t = Math.tan(fov / 2);
    return Math.max(h / (2 * t), w / (2 * t * aspect)) * 1.08;
  }
  function setupCamera(kindOrObj, extra) {
    const o = Object.assign({}, typeof kindOrObj === 'object' && kindOrObj ? kindOrObj : { type: kindOrObj }, extra || {});
    const kind = o.type || 'iso';
    const f = G.field || { w: 30, h: 20 };
    if (cam) { cam.dispose(); cam = null; }
    camKind = kind;
    if (kind === 'behind') {
      cam = new B.UniversalCamera('камера', new B.Vector3(0, 5, -10), scene);
      cam.fov = o.fov || 0.9; cam.minZ = 0.1; cam.maxZ = 600;
      cam.setTarget(new B.Vector3(0, 1, 0));
      camFit = null;
    } else {
      const presets = {
        top: { alpha: -Math.PI / 2, beta: 0.18, target: new B.Vector3(0, 0, 0) },
        iso: { alpha: -Math.PI / 2, beta: 0.88, target: new B.Vector3(0, 0, 0) },
        diorama: { alpha: -Math.PI / 2 - Math.PI / 4, beta: 0.95, target: new B.Vector3(0, 0, 0) },
        side: { alpha: -Math.PI / 2, beta: Math.PI / 2 - 0.1, target: new B.Vector3(0, (f.h || 20) / 2, 0) },
      };
      const p = presets[kind] || presets.iso;
      cam = new B.ArcRotateCamera('камера', o.alpha ?? p.alpha, o.beta ?? p.beta, 30, o.target ? posOf(o.target) : p.target, scene);
      cam.fov = o.fov || 0.8; cam.minZ = 0.1; cam.maxZ = 800;
      camFit = o.distance ? null : { w: f.w || 30, h: kind === 'side' ? (f.h || 20) : (f.h || 20) * (kind === 'top' ? 1 : 0.8) };
      cam.radius = o.distance || fitRadius(camFit.w, camFit.h, cam.fov);
    }
    lab.camera = cam;
    scene.activeCamera = cam;
  }

  /* ---------------- частицы (одна система на сцену) ---------------- */
  const MAXP = 600;
  function makeParticles() {
    sps = new B.SolidParticleSystem('лаб:частицы', scene, { updatable: true, isPickable: false });
    const box = B.MeshBuilder.CreateBox('лаб:частица', { size: 1 }, scene);
    sps.addShape(box, MAXP); box.dispose();
    const mesh = sps.buildMesh();
    mesh.isPickable = false; mesh.alwaysSelectAsActiveMesh = true;
    mesh.metadata = { noShadow: true };
    const m = new B.StandardMaterial('лаб:частицы', scene);
    m.disableLighting = true; m.emissiveColor = new B.Color3(1, 1, 1);
    mesh.material = m;
    // своё поле busy, а не alive: alive = false у Babylon выключает частицу из setParticles, и все 600 кубиков висели белым квадратом в центре сцены
    for (const p of sps.particles) { p.isVisible = false; p.busy = false; }
    sps.setParticles();
  }
  const toArr = c => Array.isArray(c) ? c : [c || '#ffffff'];
  function burst(pos, o = {}) {
    if (!sps) return;
    const n = Math.round((o.count == null ? 16 : o.count) * cfg.juice), cols = toArr(o.colors || o.color);
    const dir = o.dir ? posOf(o.dir).clone().normalize() : null; // искры летят по направлению удара: сквозь врага
    let made = 0;
    for (const p of sps.particles) {
      if (made >= n) break;
      if (p.busy) continue;
      const a = rngFx() * Math.PI * 2, e = (rngFx() - 0.3) * Math.PI;
      const sp = (o.speed || 6) * (0.3 + rngFx() * 0.9);
      p.busy = true; p.isVisible = true;
      p.position.copyFrom(pos);
      p.vel = new B.Vector3(Math.cos(a) * Math.cos(e) * sp, Math.abs(Math.sin(e)) * sp + (o.up || 0), Math.sin(a) * Math.cos(e) * sp);
      if (dir) p.vel.scaleInPlace(0.4).addInPlace(dir.scale(sp * 1.3));
      p.life = p.max = (o.life || 0.6) * (0.5 + rngFx() * 0.7);
      p.size = (o.size || 0.22) * (0.6 + rngFx() * 0.8);
      p.grav = o.gravity == null ? 9 : o.gravity;
      const c = B.Color3.FromHexString(cols[Math.floor(rngFx() * cols.length)]);
      p.color = new B.Color4(c.r, c.g, c.b, 1);
      p.rotation.set(rngFx() * 3, rngFx() * 3, rngFx() * 3);
      made++;
    }
  }
  const rngFx = Math.random; // эффекты не трогают зерно игры
  function tickParticles(dt) {
    if (!sps) return;
    let any = false;
    for (const p of sps.particles) {
      if (!p.busy) continue;
      any = true;
      p.life -= dt;
      if (p.life <= 0) { p.busy = false; p.isVisible = false; continue; }
      p.vel.y -= p.grav * dt;
      p.vel.scaleInPlace(Math.max(0, 1 - 2.2 * dt));
      p.position.addInPlace(p.vel.scale(dt));
      const s = p.size * (p.life / p.max);
      p.scaling.set(s, s, s);
      p.rotation.x += dt * 4; p.rotation.y += dt * 3;
    }
    if (any || sps._labDirty) { sps.setParticles(); sps._labDirty = any; }
  }

  /* ---------------- всплывающие надписи, предупреждения, пульсы ---------------- */
  function popup(at, text, color = '#ffffff', size = 18) {
    const el = document.createElement('div');
    el.className = 'pop'; el.textContent = String(text); el.style.color = color; el.style.fontSize = size + 'px';
    $('#popups').appendChild(el);
    popups.push({ el, pos: posOf(at).clone(), t: 0, max: 0.9 });
  }
  function projectToScreen(pos) {
    const w = engine.getRenderWidth(), h = engine.getRenderHeight();
    const v = B.Vector3.Project(pos, B.Matrix.IdentityReadOnly, scene.getTransformMatrix(), cam.viewport.toGlobal(w, h));
    const k = canvas.clientWidth / Math.max(1, w);
    return { x: v.x * k, y: v.y * k, z: v.z };
  }
  function tickPopups(dt) {
    popups = popups.filter(p => {
      p.t += dt;
      if (p.t >= p.max || !scene || !cam) { p.el.remove(); return false; }
      const s = projectToScreen(p.pos);
      const k = p.t / p.max;
      p.el.style.left = s.x + 'px'; p.el.style.top = (s.y - 40 * k) + 'px'; p.el.style.opacity = String(1 - k * k);
      return true;
    });
  }
  function warn(pos, radius, sec, color) {
    const vertical = camKind === 'side';
    const ring = B.MeshBuilder.CreateTorus('лаб:предупреждение', { diameter: radius * 2, thickness: Math.max(0.06, radius * 0.08), tessellation: 32 }, scene);
    const fill = B.MeshBuilder.CreateDisc('лаб:предупреждение', { radius, tessellation: 32 }, scene);
    const mr = mat(color, { unlit: true }), mf = mat(color, { unlit: true, alpha: 0.35 });
    ring.material = mr; fill.material = mf;
    [ring, fill].forEach(m => { m.metadata = { noShadow: true }; m.isPickable = false; });
    if (vertical) { ring.rotation.x = Math.PI / 2; ring.position.copyFrom(pos); fill.position.copyFrom(pos); fill.position.z -= 0.02; }
    else { fill.rotation.x = Math.PI / 2; ring.position.set(pos.x, pos.y + 0.04, pos.z); fill.position.set(pos.x, pos.y + 0.05, pos.z); }
    fill.scaling.set(0.01, 0.01, 0.01);
    const h = { left: sec, total: sec, done: false, dispose() { if (!h.done) { h.done = true; ring.dispose(); fill.dispose(); } }, ring, fill };
    warns.push(h);
    return h;
  }
  function tickWarns(dt) {
    warns = warns.filter(h => {
      if (h.done) return false;
      h.left -= dt;
      const k = 1 - Math.max(0, h.left) / Math.max(0.001, h.total);
      h.fill.scaling.set(k, k, k);
      if (h.left <= 0) { h.dispose(); return false; }
      return true;
    });
  }
  // вспышка попадания: меш (или все части узла) на миг становится белым. У копий createInstance не работает — вспыхнули бы все копии
  function whiten(target, sec, color) {
    const ms = [target].concat(target.getChildMeshes ? target.getChildMeshes() : []).filter(m => m instanceof B.Mesh);
    ms.forEach(m => { m.overlayColor = B.Color3.FromHexString(color); m.overlayAlpha = 0.85; m.renderOverlay = true; });
    whites.push({ ms, t: sec });
  }
  function tickWhites(dt) {
    whites = whites.filter(w => {
      w.t -= dt;
      if (w.t > 0) return true;
      w.ms.forEach(m => { if (!m.isDisposed()) m.renderOverlay = false; });
      return false;
    });
  }
  function tickPulses(dt) {
    pulses = pulses.filter(p => {
      if (!p.mesh || p.mesh.isDisposed()) return false;
      p.t += dt;
      const k = p.t >= p.dur ? 0 : Math.sin(Math.PI * p.t / p.dur);
      const s = 1 + (p.k - 1) * k * Math.min(1, cfg.juice);
      p.mesh.scaling.set(p.base.x * s, p.base.y / Math.max(0.5, s * 0.9 + 0.1), p.base.z * s);
      if (p.t >= p.dur) { p.mesh.scaling.copyFrom(p.base); return false; }
      return true;
    });
  }
  function tickCamera(dt) {
    if (!cam) return;
    if (follow && follow.mesh && !follow.mesh.isDisposed()) {
      const m = follow.mesh, mp = m.getAbsolutePosition();
      const k = follow.lag <= 0 ? 1 : 1 - Math.exp(-dt / follow.lag);
      if (cam instanceof B.ArcRotateCamera) {
        cam.target = B.Vector3.Lerp(cam.target, new B.Vector3(mp.x, mp.y + (camKind === 'side' ? 0 : 0), mp.z), k);
      } else {
        const yaw = m.rotationQuaternion ? m.rotationQuaternion.toEulerAngles().y : m.rotation.y;
        const want = new B.Vector3(mp.x - Math.sin(yaw) * follow.distance, mp.y + follow.height, mp.z - Math.cos(yaw) * follow.distance);
        if (camShakeOff) cam.position.subtractInPlace(camShakeOff);
        cam.position = B.Vector3.Lerp(cam.position, want, k);
        cam.setTarget(new B.Vector3(mp.x, mp.y + follow.look, mp.z));
        camShakeOff = null;
      }
    }
    shakeAmp = Math.max(0, shakeAmp - dt * 2.5);
    const a = shakeAmp * shakeAmp;
    if (cam instanceof B.ArcRotateCamera) {
      cam.targetScreenOffset.set((Math.random() - 0.5) * a * 1.2, (Math.random() - 0.5) * a * 1.2);
    } else {
      if (camShakeOff) cam.position.subtractInPlace(camShakeOff);
      camShakeOff = new B.Vector3((Math.random() - 0.5) * a * 0.8, (Math.random() - 0.5) * a * 0.8, 0);
      cam.position.addInPlace(camShakeOff);
    }
  }
  function tickFlash(dt) {
    flashA = Math.max(0, flashA - dt * 1.8);
    $('#flash').style.opacity = String(flashA);
  }

  /* ---------------- телеметрия ---------------- */
  function resetTele() {
    for (const k of BTN) { tele.presses[k] = 0; tele.hold[k] = 0; }
    tele.hurts = 0; tele.custom = {}; tele.stats = {}; tele.marks = {}; tele.line = [];
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
    return { time: Math.round(lab.t * 10) / 10, presses: { ...tele.presses }, hold: Object.fromEntries(BTN.map(k => [k, Math.round(tele.hold[k] * 10) / 10])), hurts: tele.hurts, custom: { ...tele.custom }, stats: { ...tele.stats }, marks: JSON.parse(JSON.stringify(tele.marks)), line: tele.line.slice() };
  }

  /* ---------------- ошибки ---------------- */
  function fail(e, phase) {
    if (errored) return;
    errored = true;
    const msg = (e && (e.message || String(e))) || 'неизвестная ошибка';
    const m = /(?:game|GAME|<anonymous>|\.js)[^\n]*?:(\d+):(\d+)/.exec((e && e.stack) || '');
    const box = $('#errBox');
    box.hidden = false;
    box.innerHTML = '';
    const b = document.createElement('b'); b.textContent = 'Ошибка в коде игры (' + phase + ')';
    box.append(b, document.createTextNode(': ' + msg + (m ? ` · строка ${m[1]}` : '') + '\nИгра остановлена. Опиши ошибку программисту одной просьбой или откати версию.'));
    post({ type: 'error', phase, message: msg, line: m ? Number(m[1]) : null, stack: String((e && e.stack) || '').slice(0, 1500) });
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
    const host = $('#knobs'), sh = $('#shellKnobs');
    host.innerHTML = ''; sh.innerHTML = '';
    for (const [k, c] of Object.entries(G.config || {})) knobRow(k, c, host);
    const jh = $('#juiceKnobs');
    if (jh) jh.innerHTML = '';
    for (const [k, c] of Object.entries(SHELL_KNOBS)) knobRow(k, c, c.juice && jh ? jh : sh);
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
    if (glow) glow.intensity = 0.65 * cfg.glow * (on('glow') ? 1 : 0);
    post({ type: 'cfg', cfg: changedCfg() });
    if (restartNeeded) {
      if (state === 'play' || state === 'over') restart(false);
      else if (state === 'menu') { buildRound(true); }
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
    const ctl = (G.controls || []).map(c => {
      let keys;
      if (padMode) keys = CTRL_KEYS.pad[c.input] || '';
      else if (two) keys = { move: '<kbd>A</kbd><kbd>D</kbd> / <kbd>←</kbd><kbd>→</kbd>', move4: '<kbd>WASD</kbd> / стрелки', a: '<kbd>F</kbd> / <kbd>K</kbd>', b: '<kbd>G</kbd> / <kbd>L</kbd>' }[c.input] || '';
      else keys = CTRL_KEYS.solo[c.input] || '';
      return `<div>${keys} ${esc(c.text || '')}</div>`;
    }).join('');
    $('#controls').innerHTML = ctl;
    $('#padHint').textContent = padMode
      ? (two ? 'Геймпад 1 — игрок 1, геймпад 2 — игрок 2. Клавиатура тоже работает.' : 'Геймпад подключён: удары отдаются вибрацией. Клавиатура тоже работает.')
      : (two ? 'Игрок 1 — левая половина клавиатуры, игрок 2 — стрелки. Есть геймпады? Нажми на них любую кнопку.' : 'Есть геймпад? Нажми на нём любую кнопку.');
    $('#startBtn').textContent = padMode ? 'Играть · A' : 'Играть · пробел';
    $('#againBtn').textContent = padMode ? 'Ещё раз · Start' : 'Ещё раз · пробел';
    $('#resumeBtn').textContent = padMode ? 'Продолжить · Start' : 'Продолжить · P';
    $('#knobsBtn').textContent = padMode ? 'Ручки · Select' : 'Ручки · Tab';
  }
  const esc = s => String(s).replace(/[&<>"']/g, c => ({ '&': '&amp;', '<': '&lt;', '>': '&gt;', '"': '&quot;', "'": '&#39;' }[c]));
  function applyMeta() {
    document.title = G.title || 'Лаборатория игр';
    $('#gTitle').textContent = G.title || 'Игра';
    $('#gSub').textContent = G.subtitle || '';
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
  function hudTick() {
    $('#hudScore').textContent = String(Math.round(lab.score));
    $('#hudLives').textContent = lab.lives > 0 ? (lab.lives <= 8 ? '♥'.repeat(lab.lives) : '♥ × ' + lab.lives) : '';
    $('#hudExtra').innerHTML = Object.values(hudLines).map(esc).join('<br>');
    $('#hudBest').textContent = lab.best ? 'Мой рекорд: ' + lab.best : '';
    const gh = $('#hudGhost'), g = ghostNow();
    gh.hidden = !g;
    if (g) {
      const d = Math.round(lab.score) - g.at;
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
    buildScene();
    lab.seed = fixedSeed != null ? fixedSeed : (Math.random() * 1e9) >>> 0;
    rng = mulberry32(lab.seed);
    lab.state = {}; lab.t = 0; lab.dt = 0; lab.score = 0; lab.invuln = 0; lab.lives = initialLives();
    hudLines = {}; shakeAmp = 0; flashA = 0; hitstopT = 0; slowT = 0; camShakeOff = null;
    resetTele();
    lab.round = ++session.rounds;
    const two = duo() ? 2 : 1; // ручка duo могла переключить игру на двоих
    if (two !== lab.players) { lab.players = two; for (const h of kb.concat(kbTap)) for (const k in h) h[k] = false; labels(); }
    safe(() => G.start(lab, scene), 'start');
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
  function setPause(on) {
    if (state !== 'play' || errored) return;
    paused = on; showScreen(on ? 'pauseScreen' : null);
    if (!on) disarm();
  }
  function end(kind, text) {
    if (state !== 'play') return;
    state = 'over'; overAt = performance.now();
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

  /* ---------------- главный цикл ---------------- */
  engine.runRenderLoop(() => {
    readInput();
    let dt = Math.min(engine.getDeltaTime() / 1000, 0.05);
    const live = state === 'play' && !paused && !errored && scene;
    if (live && slowT > 0) { slowT -= dt; dt *= slowK; } // замедление: игра и частицы идут медленнее, интерфейс — как обычно
    if (live) {
      if (hitstopT > 0) hitstopT -= dt;
      else {
        lab.dt = dt; lab.t += dt;
        if (lab.invuln > 0) lab.invuln = Math.max(0, lab.invuln - dt);
        tickTele(dt);
        safe(() => G.update(lab, dt), 'update');
        while (tele.line.length < Math.min(600, Math.floor(lab.t) + 1)) tele.line.push(Math.round(lab.score));
      }
    }
    if (scene && cam) {
      tickParticles(dt); tickPopups(dt); tickWarns(dt); tickPulses(dt); tickWhites(dt); tickCamera(dt);
      try { scene.render(); } catch (e) { fail(e, 'отрисовка'); }
    }
    tickFlash(dt);
    hudTick();
  });
  addEventListener('resize', () => {
    engine.resize();
    if (cam && camFit && cam instanceof B.ArcRotateCamera) cam.radius = fitRadius(camFit.w, camFit.h, cam.fov);
  });
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
    if (m.type === 'setCfg' && m.cfg) { for (const k in m.cfg) if (k in cfg) cfg[k] = Number(m.cfg[k]); document.querySelectorAll('.knob').forEach(w => w._sync && w._sync()); knobChanged(true); }
    if (m.type === 'pause') setPause(true);
    if (m.type === 'challengeOn') challengeOn = true;
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
  async function loadHavok() {
    await loadScript('vendor/havok/HavokPhysics_umd.js');
    return window.HavokPhysics({ locateFile: f => 'vendor/havok/' + f });
  }
  async function boot() {
    try {
      G = await getGame();
      for (const [k, c] of Object.entries(Object.assign({}, G.config || {}, SHELL_KNOBS))) {
        META[k] = c; DEFAULTS[k] = c.value; cfg[k] = c.value;
      }
      applyMeta(); buildPanel(); buildTouch();
      if (G.physics) havok = await loadHavok();
      buildRound(true);
      state = 'menu';
      $('#startBtn').disabled = false;
      showRecord();
      window.__lab.ready = true;
      post({ type: 'ready', shell: SHELL_VERSION, babylon: B.Engine.Version, meta: { title: G.title, donor: G.donor || '', players: lab.players, controls: G.controls || [], config: G.config || {}, presets: G.presets || {}, decisions: G.decisions || [], notes: G.notes || [] } });
    } catch (e) { fail(e, 'загрузка'); }
  }

  // доступ для автопроверки и отладки учителем
  window.__lab = {
    ready: false, lab, tele, session, get state() { return state; }, get paused() { return paused; }, get errored() { return errored; },
    get scene() { return scene; }, cfg, DEFAULTS,
    confirm, restart: () => restart(true), end: (k, t) => end(k || 'lose', t || 'Проверка'), togglePanel,
  };
  // объект GAME может стоять в странице после lab.js — ждём, пока разберётся весь документ
  if (document.readyState === 'loading') document.addEventListener('DOMContentLoaded', boot); else boot();
})();
