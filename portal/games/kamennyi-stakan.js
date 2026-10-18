// «Каменный стакан» — ремейк-донор урока 4 по мотивам механики «Тетриса», оболочка «Лаб3D 1.0» (three.js).
// План.
// Фраза: камни дольмена с рунами падают в стакан из песчаника на плато Лаго-Наки; повернул, поставил — полный ряд вспыхивает и исчезает.
// Глагол — «повернуть и поставить», основной цикл 2–4 секунды: камень лёг → ряд вспыхнул → уже падает следующий.
// Риск — награда: держать колодец для палки ради «Четыре разом» (и «Снова четыре» дороже), серия линий подряд, «Чистый стакан».
// Нарастание: каждый уровень быстрее, небо идёт от полудня к ночи, руны светятся всё ярче.
// Честность: тень, где камень ляжет; три следующих камня; камень на дне раскаляется перед фиксацией;
// черта тревоги и красный контур там, где появится следующий камень, когда стакан почти полон; вдвоём мусор летит видимым снарядом.
// Сочность: каждый сдвиг — нота по столбцу, поворот — нота лада уровня, серия звенит выше, полоса вспышки по ряду,
// камни после линии падают с весом и приседают, след при «уронить сразу», сурок следит за камнем и прыгает от линий.
// Палитра: тёплый песчаник, синяя плита стакана, семь цветов камней и у каждого своя руна (различимы и без цвета).
// Разбор лучших игр жанра («Тетрис» 1984 и Game Boy, правила Tetris Guideline, Tetris Effect, Tetris 99 и TETR.IO,
// Tetris: The Grand Master, Puyo Puyo Tetris) — в docs/01_Журнал_курса.md, раздел урока 4.
// Спрятанная механика донора — честный проигрыш: «мешок» из семи камней и предпросмотр (ручки bag и preview, пресет «Без спрятанной механики»).
// Вид сбоку: плоскость XY, X вправо, Y вверх; лицо камней смотрит на камеру (+Z), плита стакана позади (−Z).
const GAME = {
  engine: 'three',
  title: 'Каменный стакан',
  subtitle: 'Камни дольмена падают в стакан на Лаго-Наки. Поверни и поставь: полный ряд исчезает.',
  donor: '«Тетрис»',
  players: 1,
  duo: 'vs', // ручка vs = 1 — игра на двоих
  controls: [
    { input: 'move4', text: 'сдвинуть, ↓ быстрее, ↑ повернуть' },
    { input: 'a', text: 'повернуть' },
    { input: 'b', text: 'уронить сразу' },
  ],
  camera: { type: 'side', tilt: 1.42 },
  field: { w: 23, h: 23.4 }, // в start — по размеру стакана
  shadowSize: 26,
  sky: ['#3f8fd8', '#bfe3f5'],
  fog: 0.005,
  accent: '#ffd23f',
  lives: 0,
  decisions: [
    'Чувство: «ещё один камень» — каждое движение звучит нотой, четыре линии разом взрываются золотом',
    'Честность: тень показывает, где камень ляжет, видно три следующих, мешок не даёт ждать палку вечно, камень на дне раскаляется перед фиксацией',
    'Выбор: закрыть дыру сейчас или оставить колодец для палки и не рвать серию',
  ],
  notes: [
    'Камень на дне ждёт фиксации (ручка «Задержка»), сдвиг и поворот на дне откладывают её, но не больше 15 раз — как в современных «Тетрисах»: крутить вечно нельзя.',
    'У каждого вида камня своя руна: камни различимы и без цвета.',
  ],
  config: {
    fall: { value: 0.8, min: 0.1, max: 2, step: 0.05, label: 'Падение в начале: секунд на клетку' },
    speedup: { value: 0.82, min: 0.5, max: 1, step: 0.01, label: 'Ускорение: падение × за уровень' },
    perLevel: { value: 8, min: 2, max: 30, step: 1, label: 'Линий до следующего уровня' },
    levelTime: { value: 30, min: 0, max: 180, step: 5, label: 'Уровень растёт и сам: раз в … с', hint: 'как в Tetris 99: стоять и ждать нельзя; 0 — уровень растёт только от линий' },
    bag: { value: 1, min: 0, max: 1, step: 1, label: 'Спрятанная механика: мешок из семи камней', hint: '1 — в каждых семи камнях все семь; 0 — чистый случай' },
    preview: { value: 3, min: 0, max: 5, step: 1, label: 'Спрятанная механика: сколько следующих камней видно' },
    ghost: { value: 1, min: 0, max: 1, step: 1, label: 'Тень: где камень ляжет' },
    lock: { value: 0.5, min: 0, max: 1.5, step: 0.05, label: 'Задержка перед фиксацией, с' },
    soft: { value: 22, min: 5, max: 60, step: 1, label: 'Быстрее вниз: клеток в секунду' },
    das: { value: 0.16, min: 0.05, max: 0.4, step: 0.01, label: 'Автоповтор сдвига: задержка, с' },
    arr: { value: 0.05, min: 0.01, max: 0.2, step: 0.01, label: 'Автоповтор сдвига: шаг, с' },
    combo: { value: 50, min: 0, max: 200, step: 10, label: 'Серия: очков за номер серии', hint: 'камни, которые подряд собирают линии, дают серию: вторая линия подряд +50 × уровень, третья +100…; 0 — без серии' },
    b2b: { value: 1.5, min: 1, max: 3, step: 0.1, label: 'Снова четыре: множитель очков', hint: '«Четыре разом» сразу после «Четыре разом» стоит дороже: стоит терпеть ради палки' },
    cols: { value: 10, min: 6, max: 14, step: 1, label: 'Ширина стакана', restart: true },
    rows: { value: 20, min: 12, max: 24, step: 1, label: 'Высота стакана', restart: true },
    vs: { value: 0, min: 0, max: 1, step: 1, label: 'Вдвоём: два стакана', restart: true },
    garbage: { value: 1, min: 0, max: 2, step: 0.5, label: 'Вдвоём: мусор соседу за линии' },
  },
  presets: {
    'Новичок': { fall: 1.1, speedup: 0.9, perLevel: 12, levelTime: 60, preview: 5, lock: 0.9 },
    'Без спрятанной механики': { bag: 0, preview: 0 },
    'Безумие': { fall: 0.25, speedup: 0.75, perLevel: 5, levelTime: 15, lock: 0.25 },
    'Вдвоём': { vs: 1 },
  },

  // n — рамка поворота, c — клетки [x, y], y вверх
  KINDS: {
    I: { n: 4, c: [[0, 2], [1, 2], [2, 2], [3, 2]], color: '#f5b83d' },
    O: { n: 2, c: [[0, 0], [1, 0], [0, 1], [1, 1]], color: '#ff6f59' },
    T: { n: 3, c: [[0, 1], [1, 1], [2, 1], [1, 2]], color: '#2ec4a6' },
    S: { n: 3, c: [[0, 1], [1, 1], [1, 2], [2, 2]], color: '#9bd34c' },
    Z: { n: 3, c: [[1, 1], [2, 1], [0, 2], [1, 2]], color: '#4d7cfe' },
    J: { n: 3, c: [[0, 1], [1, 1], [2, 1], [0, 2]], color: '#b86bff' },
    L: { n: 3, c: [[0, 1], [1, 1], [2, 1], [2, 2]], color: '#ff5fa2' },
  },
  ORDER: 'IOTSZJL',
  GARBAGE_COLOR: '#6d6f8c',
  // руна на лице камня: поворот и размер [rz, sx, sy] — у каждого вида свой знак
  RUNE: { I: [0, 0.45, 1.5], O: [Math.PI / 4, 1.2, 1.2], T: [0, 1.5, 0.45], S: [0.6, 0.5, 1.4], Z: [-0.6, 0.5, 1.4], J: [Math.PI / 4, 0.5, 1.5], L: [-Math.PI / 4, 0.5, 1.5], X: [0, 0.7, 0.7] },
  BASE: 0.8, // высота дна стакана
  LINE_PTS: [0, 100, 300, 500, 800],
  GARBAGE: [0, 0, 1, 2, 4],
  COMBO_G: [0, 1, 1, 2, 2, 3, 3, 4, 4, 4, 5], // мусор за серию, как в Tetris 99
  KICKS: [[0, 0], [-1, 0], [1, 0], [0, 1], [-2, 0], [2, 0]],
  // небо по уровням: полдень → закат → ночь (верх, горизонт, солнце, сила солнца, звёзды)
  SKY: [
    ['#3f8fd8', '#bfe3f5', '#fff2dc', 1.9, 0],
    ['#3d7cc4', '#f1e1b8', '#ffe6c0', 1.8, 0],
    ['#53619f', '#f5b27a', '#ffc890', 1.5, 0],
    ['#3e3f86', '#e98a6c', '#ffa97a', 1.15, 0.25],
    ['#232659', '#8f5487', '#c9a0ff', 0.8, 0.7],
    ['#0b1030', '#2f2c5a', '#a8b8ff', 0.55, 1],
  ],
  SCALE: [0, 2, 4, 7, 9, 12, 14, 16, 19, 21, 24], // пентатоника: ноты сдвига по столбцам и поворота
  ROOT: [0, 2, -3, 5, 0, 7], // тоника по уровням

  start(lab, scene) {
    const T = lab.THREE, st = lab.state, duo = lab.cfg.vs >= 1;
    st.W = Math.round(lab.cfg.cols); st.H = Math.round(lab.cfg.rows);
    const W = st.W, H = st.H;
    this.field = { w: duo ? 2 * W + 19.5 : W + 13.5, h: this.BASE + H + 2.6 };
    lab.setCamera('side', { tilt: 1.42 });
    this.tmp = { M: new T.Matrix4(), P: new T.Vector3(), Q: new T.Quaternion(), E: new T.Euler(), S: new T.Vector3(), C: new T.Color(), C2: new T.Color(), white: new T.Color('#ffffff'), grey: new T.Color('#4d4f63'), hot: new T.Color('#fff1c9') };
    this.col = { X: new T.Color(this.GARBAGE_COLOR) };
    for (const k of this.ORDER) this.col[k] = new T.Color(this.KINDS[k].color);
    this.skyPal = this.SKY.map(([a, b, s, i, n]) => ({ top: new T.Color(a), bot: new T.Color(b), sun: new T.Color(s), power: i, stars: n }));
    Object.assign(st, { seq: [], bag: [], pieces: 0, rots: 0, tetris: 0, pcs: 0, bestCombo: 0, beat: 0, skyK: -1, ended: false, watch: 0 });
    this.makeSky(lab, scene);
    this.scenery(lab, scene);
    this.makeStones(lab, duo ? 2 : 1);
    st.wells = (duo ? [-1, 1] : [0]).map((side, i) => this.buildWell(lab, side, i));
    this.buildMarmot(lab, duo ? 0 : -(W / 2 + 3.4), duo);
    lab.hero(st.wells[0].panel);
    st.wells.forEach(w => this.spawn(lab, w));
    this.tickWorld(lab, 0);
    this.render(lab);
  },

  update(lab, dt) {
    const st = lab.state, W = st.wells, dying = W.some(w => w.dead);
    W.forEach((w, i) => { if (w.dead) this.dying(lab, w, dt); else if (!dying) this.tickWell(lab, w, i ? lab.p2 : lab.p1, dt); });
    W.forEach(w => this.settle(lab, w, dt));
    this.tickWorld(lab, dt);
    this.render(lab);
    const cyc = this.cycle(W[0]), combo = Math.max(...W.map(w => w.combo));
    if (W.length > 1) lab.hud('duo', `Линий: игрок 1 — ${W[0].lines}, игрок 2 — ${W[1].lines}`);
    else lab.hud('lvl', `Уровень ${W[0].level} · линий ${W[0].lines}`);
    lab.hud('cycle', cyc ? `Цикл: камень за ${cyc.toFixed(1)} с` : null);
    lab.hud('combo', combo > 0 ? `Серия ×${combo + 1}` : null);
    lab.hud('danger', W.some(w => w.danger && !w.dead) ? '⚠ Стакан почти полон!' : null);
  },

  overNote(lab) {
    const st = lab.state, W = st.wells, n = Math.max(1, st.pieces), dry = Math.max(...W.map(w => w.maxDry));
    return [`Цикл: камень за ${(lab.t * W.length / n).toFixed(1)} с, «повернуть и поставить» ${st.pieces} раз, поворотов на камень ${(st.rots / n).toFixed(1)}`,
      W.length > 1 ? `Линий: ${W[0].lines} и ${W[1].lines}, мусора: ${W[0].sent} и ${W[1].sent}` : `Линий: ${W[0].lines} · уровень ${W[0].level} · четыре разом: ${st.tetris} · лучшая серия ×${st.bestCombo}` + (st.pcs ? ` · чистый стакан: ${st.pcs}` : ''),
      `Палка не приходила ${dry} камней подряд` + (lab.cfg.bag >= 1 ? ' (мешок: не больше 12)' : ' (без мешка — сколько угодно)')];
  },

  /* ---------- камни: три пачки копий на все стаканы (тело, светлое лицо, руна) ---------- */
  makeStones(lab, wells) {
    const T = lab.THREE, st = lab.state, N = wells * (st.W * (st.H + 3) + 30), RB = lab.addons.RoundedBoxGeometry;
    const runeGeo = new T.BoxGeometry(0.16, 0.16, 0.05);
    const mk = (geo, look, n, shadow) => {
      const m = lab.instances(geo, look, n, shadow ? {} : { shadow: false });
      m.frustumCulled = false; m.setColorAt(0, this.tmp.white); m.count = 0;
      return m;
    };
    st.stone = mk(new RB(0.94, 0.94, 0.94, 1, 0.1), lab.mat('#ffffff', { rough: 0.62 }), N, true);
    st.plate = mk(new RB(0.7, 0.7, 0.08, 1, 0.03), lab.mat('#ffffff', { rough: 0.4 }), N);
    st.rune = mk(runeGeo, lab.mat('#ffe7a8', { unlit: true, glow: 0.7 }), N);
    st.runeHot = mk(runeGeo, lab.mat('#fff6dc', { unlit: true, glow: 1.7 }), wells * 4 + 2);
    st.ghost = mk(new RB(0.9, 0.9, 0.6, 1, 0.08), lab.mat('#ffffff', { unlit: true, alpha: 0.42 }), wells * 4 + 2);
    st.warnMat = lab.mat('#ff3b4e', { unlit: true, alpha: 0.45 });
    st.spawnWarn = mk(new T.BoxGeometry(0.9, 0.9, 0.3), st.warnMat, wells * 4 + 2);
  },
  // одна копия: место, размер (число или [x, y, z]), цвет, поворот вокруг Z (лицом к камере)
  put(inst, i, x, y, z, s, color, rz) {
    const t = this.tmp;
    t.P.set(x, y, z); t.Q.setFromEuler(t.E.set(0, 0, rz || 0));
    if (Array.isArray(s)) t.S.set(s[0], s[1], s[2]); else t.S.set(s, s, s);
    inst.setMatrixAt(i, t.M.compose(t.P, t.Q, t.S));
    if (color) inst.setColorAt(i, color);
  },
  stoneAt(lab, R, x, y, k, s, color, hot) {
    const st = lab.state, t = this.tmp, r = this.RUNE[k];
    this.put(st.stone, R.n, x, y, 0, s, color);
    t.C2.copy(color).lerp(t.white, 0.32);
    this.put(st.plate, R.n, x, y, 0.45 * s, s, t.C2);
    R.n++;
    if (hot) this.put(st.runeHot, R.h++, x, y, 0.51 * s, [r[1] * s, r[2] * s, s], null, r[0]);
    else this.put(st.rune, R.r++, x, y, 0.51 * s, [r[1] * s, r[2] * s, s], null, r[0]);
  },

  render(lab) {
    const st = lab.state, t = this.tmp, R = { n: 0, r: 0, h: 0, g: 0, w: 0 }, time = lab.t, H = st.H;
    for (const w of st.wells) {
      const sink = w.bump * 0.09;
      for (let y = 0; y < w.grid.length; y++) for (let x = 0; x < st.W; x++) {
        const c = w.grid[y][x];
        if (!c) continue;
        const C = t.C.copy(this.col[c.k]);
        if (c.grey) C.lerp(t.grey, 0.85);
        else if (c.clear) C.lerp(t.white, 0.75).multiplyScalar(1.5 + 0.4 * Math.sin(time * 40));
        else if (c.f > 0) C.lerp(t.white, Math.min(1, c.f)).multiplyScalar(1 + c.f * 0.6);
        this.stoneAt(lab, R, this.wx(w, x), this.wy(c.y) - sink, c.k, c.s, C, false);
      }
      const p = w.piece;
      if (p) {
        const floor = !this.fits(w, p.cells, w.px, w.py - 1), heat = floor && lab.cfg.lock > 0 ? Math.min(1, w.lockT / lab.cfg.lock) : 0;
        const s = 1 + 0.22 * w.spawnK + 0.1 * w.rotK;
        // видно = правда: камень на дне раскаляется — скоро ляжет
        const C = t.C.copy(this.col[p.k]).lerp(t.hot, 0.55 * heat).multiplyScalar(1 + 0.35 * heat * (0.6 + 0.4 * Math.sin(time * 30)));
        w.pd.forEach(([x, y]) => this.stoneAt(lab, R, this.wx(w, x), this.wy(y), p.k, s, C, true));
        let d = 0;
        while (this.fits(w, p.cells, w.px, w.py - d - 1)) d++;
        if (lab.cfg.ghost >= 1 && d > 0) p.cells.forEach(([cx, cy]) => this.put(st.ghost, R.g++, this.wx(w, w.px + cx), this.wy(w.py - d + cy), -0.05, 1, this.col[p.k]));
      }
      // тревога: красный контур там, где появится следующий камень
      if (w.danger && !w.dead && st.seq[w.qi]) {
        const k = st.seq[w.qi], K = this.KINDS[k], px = Math.floor((st.W - K.n) / 2), py = H - Math.max(...K.c.map(c => c[1]));
        K.c.forEach(([cx, cy]) => this.put(st.spawnWarn, R.w++, this.wx(w, px + cx), this.wy(py + cy), 0.15, 1));
      }
      // предпросмотр: очередь въезжает снизу, когда первый камень ушёл в стакан
      const n = Math.round(lab.cfg.preview), top = this.BASE + H - 1.6, gap = Math.min(2.2, (H - 4) / 5);
      w.slots.count = n;
      for (let i = 0; i < n; i++) {
        const k = st.seq[w.qi + i];
        if (!k) break;
        const c = this.KINDS[k].c, s = (i ? 0.52 : 0.74) * (1 + 0.15 * w.prevK * (i === 0)), y = (i ? top - 0.6 - i * gap : top) - w.prevK * gap;
        const mx = c.reduce((a, q) => a + q[0], 0) / 4, my = c.reduce((a, q) => a + q[1], 0) / 4;
        for (const [cx, cy] of c) this.stoneAt(lab, R, w.pvx + (cx - mx) * s, y + (cy - my) * s, k, s, this.col[k], false);
      }
    }
    st.stone.count = st.plate.count = R.n; st.rune.count = R.r; st.runeHot.count = R.h; st.ghost.count = R.g; st.spawnWarn.count = R.w;
    for (const m of [st.stone, st.plate, st.rune, st.runeHot, st.ghost, st.spawnWarn]) {
      m.instanceMatrix.needsUpdate = true;
      if (m.instanceColor) m.instanceColor.needsUpdate = true;
    }
  },

  /* ---------- небо: свой градиент, темнеет с уровнем ---------- */
  makeSky(lab, scene) {
    const T = lab.THREE;
    if (this.skyTex) this.skyTex.dispose(); // прошлой партии
    const c = document.createElement('canvas'); c.width = 2; c.height = 256;
    this.skyCanvas = c; this.skyTex = new T.CanvasTexture(c); this.skyTex.colorSpace = T.SRGBColorSpace;
    scene.background = this.skyTex;
  },
  paintSky(top, bot) {
    const g = this.skyCanvas.getContext('2d'), gr = g.createLinearGradient(0, 0, 0, 256);
    gr.addColorStop(0, '#' + top.getHexString()); gr.addColorStop(0.6, '#' + bot.getHexString()); gr.addColorStop(1, '#' + bot.getHexString());
    g.fillStyle = gr; g.fillRect(0, 0, 2, 256);
    this.skyTex.needsUpdate = true;
  },

  /* ---------- плато Лаго-Наки: луга, дольмены, пихты, Фишт, облака ---------- */
  scenery(lab, scene) {
    const T = lab.THREE, st = lab.state, F = this.field, N = { parent: null };
    lab.ground({ w: 300, h: 220, color: '#5aa84c', bumps: 5, flat: 0.3 });
    // пятна луга и цветы — копии с цветом
    const patch = lab.instances(new T.CylinderGeometry(1, 1, 0.03, 7), lab.mat('#ffffff', { rough: 0.95 }), 34, { shadow: false });
    for (let i = 0; i < 34; i++) {
      const s = lab.rand(2.5, 8);
      lab.place(patch, i, [lab.rand(-60, 60), 0.02, lab.rand(-40, 16)], { scale: [s, 1, s * 0.6], rot: lab.rand(0, 3), color: lab.pick(['#6fc25c', '#4f9a44', '#86cf68', '#63b356']) });
    }
    const flower = lab.instances(new T.IcosahedronGeometry(0.13, 0), lab.mat('#ffffff', { rough: 0.5 }), 90, { shadow: false });
    for (let i = 0; i < 90; i++) {
      let x, z; do { x = lab.rand(-F.w / 2 - 6, F.w / 2 + 6); z = lab.rand(1.8, 14); } while (Math.abs(x) < F.w / 2 - 1 && z < 2.6);
      lab.place(flower, i, [x, 0.12, z], { color: lab.pick(['#ffe66b', '#ffffff', '#ff8fc8', '#b98cff', '#ffb35c']) });
    }
    // горы и Фишт со снегом: конусы слиты в один меш на цвет
    const hills = [];
    for (let i = 0; i < 9; i++) {
      const x = -130 + i * 32 + lab.rand(-6, 6), z = -110 - lab.rand(0, 25), r = lab.rand(18, 30), h = lab.rand(26, 44);
      hills.push(lab.cone(r, h, '#5b6a92', { ...N, at: [x, h / 2 - 1, z], sides: 6, rot: lab.rand(0, 3) }));
      hills.push(lab.cone(r * 0.36, h * 0.36, '#f2f6ff', { ...N, at: [x, h - 1 - h * 0.18 + 0.05, z], sides: 6, rot: lab.rand(0, 3) }));
    }
    for (const [x, h, r] of [[-38, 62, 34], [-18, 52, 26]]) { // Фишт: две вершины
      hills.push(lab.cone(r, h, '#66749c', { ...N, at: [x, h / 2 - 1, -96], sides: 7, rot: 0.4 }));
      hills.push(lab.cone(r * 0.46, h * 0.46, '#ffffff', { ...N, at: [x, h - 1 - h * 0.23 + 0.05, -96], sides: 7, rot: 0.4 }));
    }
    lab.merge(hills);
    // дольмены: плита-крыша, стены, круглый лаз, мох на крыше
    const dol = [], sand = '#b8a07e';
    [[-F.w / 2 - 6, -12, 0.3], [F.w / 2 + 7, -16, -0.4], [-F.w / 2 - 18, -30, 0.6], [F.w / 2 + 20, -34, 0.2]].forEach(([x, z, a]) => {
      const g = lab.group({ ...N, at: [x, 0, z], rot: a, scale: 1.3 });
      lab.box(3.4, 0.3, 3.6, sand, { parent: g, at: [0, 0.15, 0] });
      lab.box(3, 2, 3, sand, { parent: g, at: [0, 1.3, 0] });
      lab.box(3.9, 0.4, 4, '#a89070', { parent: g, at: [0, 2.5, 0] });
      lab.box(3.2, 0.12, 3.2, '#78a952', { parent: g, at: [0, 2.76, 0] });
      lab.cyl(0.38, 0.38, 0.06, '#2e2420', { parent: g, at: [0, 1.05, 1.52], rot: [Math.PI / 2, 0, 0], sides: 10 });
      dol.push(g);
    });
    lab.merge(dol);
    // пихты — копии одного дерева
    const NF = 70, crown = lab.instances(new T.ConeGeometry(1, 2.4, 7), lab.mat('#ffffff'), NF * 2), trunk = lab.instances(new T.CylinderGeometry(0.18, 0.24, 1, 6), '#6b4a32', NF);
    for (let i = 0; i < NF; i++) {
      let x, z; do { x = lab.rand(-75, 75); z = lab.rand(-70, -5); } while (Math.abs(x) < F.w / 2 + 1 && z > -9);
      const s = lab.rand(1.2, 2.6), c = lab.pick(['#2f7a46', '#3d8c4f', '#2a6b40']);
      lab.place(trunk, i, [x, 0.5 * s, z], { scale: s });
      lab.place(crown, i * 2, [x, 1.9 * s, z], { scale: [s * 1.2, s, s * 1.2], rot: lab.rand(0, 3), color: c });
      lab.place(crown, i * 2 + 1, [x, 2.9 * s, z], { scale: [s * 0.85, s * 0.8, s * 0.85], rot: lab.rand(0, 3), color: c });
    }
    // облака: одна геометрия из шаров, копии плывут
    const BU = lab.addons.BufferGeometryUtils, puffs = [[0, 0, 1.5], [1.6, -0.3, 1.1], [-1.7, -0.4, 1], [0.5, 0.8, 1]].map(([x, y, r]) => new T.IcosahedronGeometry(r, 1).translate(x, y, 0));
    const cloudGeo = BU.mergeGeometries(puffs);
    puffs.forEach(g => g.dispose());
    st.clouds = { mesh: lab.instances(cloudGeo, lab.mat('#ffffff', { rough: 1 }), 9, { shadow: false }), list: [] };
    for (let i = 0; i < 9; i++) st.clouds.list.push({ x: lab.rand(-90, 90), y: lab.rand(26, 44), z: lab.rand(-80, -45), s: lab.rand(1.8, 3.4), v: lab.rand(0.6, 1.6) });
    // солнце, к ночи — луна; звёзды проступают на поздних уровнях
    st.sunMat = new T.MeshBasicMaterial({ color: '#fff2dc', fog: false });
    st.sun = lab.mesh(new T.IcosahedronGeometry(5, 2), st.sunMat, { at: [-70, 50, -150], shadow: false });
    const pts = [];
    for (let i = 0; i < 300; i++) { const a = lab.rand(-1.2, 1.2), e = lab.rand(0.12, 1.1); pts.push(Math.sin(a) * Math.cos(e) * 180, Math.sin(e) * 180, -Math.cos(a) * Math.cos(e) * 180); }
    const g = new T.BufferGeometry(); g.setAttribute('position', new T.Float32BufferAttribute(pts, 3));
    st.starMat = new T.PointsMaterial({ color: '#ffffff', size: 1, fog: false, transparent: true, opacity: 0 });
    scene.add(new T.Points(g, st.starMat));
  },

  /* ---------- стакан из песчаника: плита с бороздами, кладка с узорами, предпросмотр ---------- */
  buildWell(lab, side, i) {
    const T = lab.THREE, st = lab.state, W = st.W, H = st.H, b0 = this.BASE, ox = side * (W / 2 + 4.5), pv = side || 1, N = { parent: null };
    const w = { i, ox, pvx: ox + pv * (W / 2 + 2.9), meterX: ox - pv * (W / 2 + 1.3), grid: [], cyc: [], pending: 0, sent: 0, score: 0, lines: 0, level: 1, sinceI: 0, maxDry: 0, qi: 0,
      combo: -1, b2b: false, bump: 0, rotK: 0, spawnK: 0, prevK: 0, ornK: 0, meterK: 0, pd: [], dir: 0, das: 0, rows: [], clearT: 0, note: 0 };
    for (let y = 0; y < H + 6; y++) w.grid.push(new Array(W).fill(null));
    // постамент, ступень, панель предпросмотра — неподвижное сливается
    const fixed = [
      lab.box(W + 6, b0, 3.4, '#a8865f', { ...N, at: [ox, b0 / 2, -0.2] }),
      lab.box(W + 7.4, 0.3, 4.4, '#c4a27a', { ...N, at: [ox, 0.15, 0.2] }),
      lab.box(W + 2.6, 0.5, 2, '#c9a77c', { ...N, at: [ox, b0 + H + 1.75, -0.1] }), // плита-перемычка над стаканом
      ...[-1, 1].map(s => lab.box(0.9, 1.1, 1.2, '#c39a6c', { ...N, at: [ox + s * (W / 2 + 0.5), b0 + H + 0.95, 0] })),
      lab.box(4.1, H - 1.2, 0.3, '#33477a', { ...N, at: [w.pvx, b0 + H / 2 + 0.4, -0.6] }),
      lab.box(4.5, 0.4, 1, '#c4a27a', { ...N, at: [w.pvx, b0 + H + 0.05 - 0.2, -0.3] }),
      lab.box(4.6, b0 + 0.6, 1.6, '#a8865f', { ...N, at: [w.pvx, (b0 + 0.6) / 2, -0.4] }),
    ];
    lab.merge(fixed);
    // ниши очереди: столько, сколько камней видно (ручка preview)
    const top = b0 + H - 1.6, gap = Math.min(2.2, (H - 4) / 5);
    w.slots = lab.instances(new T.BoxGeometry(3.4, 1, 0.1), '#465f99', 5, { shadow: false });
    for (let k = 0; k < 5; k++) lab.place(w.slots, k, [w.pvx, k ? top - 0.6 - k * gap : top, -0.42], { scale: [k ? 0.8 : 1, k ? gap * 0.86 : 2.5, 1] });
    w.slots.frustumCulled = false;
    // плита стакана: свой материал — краснеет, когда стакан почти полон
    w.panelMat = new T.MeshStandardMaterial({ color: '#24345a', roughness: 0.9, flatShading: true });
    w.panel = lab.box(W, H, 0.3, w.panelMat, { at: [ox, b0 + H / 2, -0.68] });
    w.panelBase = new T.Color('#24345a'); w.panelRed = new T.Color('#5a2234');
    const grooves = lab.instances(new T.BoxGeometry(0.05, 1, 0.05), '#3a5288', W + H - 2, { shadow: false });
    for (let x = 1; x < W; x++) lab.place(grooves, x - 1, [ox - W / 2 + x, b0 + H / 2, -0.5], { scale: [1, H, 1] });
    for (let y = 1; y < H; y++) lab.place(grooves, W - 2 + y, [ox, b0 + y, -0.5], { rot: [0, 0, Math.PI / 2], scale: [1, W, 1] });
    // кладка: блоки двух оттенков, узоры светятся на лице стен
    const nWall = 2 * (H + 1) + W + 2, wall = lab.instances(new lab.addons.RoundedBoxGeometry(0.96, 0.98, 1.4, 1, 0.08), lab.mat('#ffffff'), nWall);
    let n = 0;
    w.ornPos = [];
    for (const s of [-1, 1]) for (let y = 0; y <= H; y++) {
      lab.place(wall, n++, [ox + s * (W / 2 + 0.5), b0 + y + 0.5, 0], { color: (y + (s > 0)) % 2 ? '#d2ad7f' : '#c39a6c' });
      if (y % 3 === 1) w.ornPos.push([ox + s * (W / 2 + 0.5), b0 + y + 0.5, 0.72]);
    }
    for (let x = -1; x <= W; x++) lab.place(wall, n++, [ox - W / 2 + x + 0.5, b0 - 0.45, 0], { color: x & 1 ? '#d2ad7f' : '#c39a6c' });
    w.orn = lab.instances(new T.CylinderGeometry(0.25, 0.25, 0.08, 4), lab.mat('#ffcf4a', { glow: 0.8 }), w.ornPos.length, { shadow: false });
    this.placeOrn(lab, w, 1);
    // видно = правда: черта тревоги на высоте, с которой стакан «почти полон»
    w.lineMat = new T.MeshBasicMaterial({ color: new T.Color('#ff3b4e').multiplyScalar(1.5), transparent: true, opacity: 0.25, depthWrite: false });
    w.line = lab.box(W, 0.12, 0.06, w.lineMat, { at: [ox, b0 + H - 6, -0.5], shadow: false });
    // вдвоём: столбик входящего мусора у внутренней стены
    if (side) {
      w.meter = lab.box(0.34, 1, 0.34, lab.mat('#ff4d5e', { glow: 1.2 }), { at: [w.meterX, b0, 0.3], shadow: false });
      w.meter.visible = false;
    }
    // полосы вспышки собранных рядов и следы «уронить сразу» — заготовки, светятся сложением
    const fxMat = () => new T.MeshBasicMaterial({ color: '#ffffff', transparent: true, opacity: 0, depthWrite: false, blending: T.AdditiveBlending });
    w.bars = [0, 1, 2, 3].map(() => { const m = lab.box(W + 0.3, 0.98, 0.2, fxMat(), { at: [ox, 0, 0.62], shadow: false }); m.visible = false; return m; });
    w.streaks = [0, 1, 2, 3].map(() => { const m = lab.box(0.86, 1, 0.1, fxMat(), { at: [0, 0, -0.3], shadow: false }); m.visible = false; return m; });
    return w;
  },
  placeOrn(lab, w, s) {
    w.ornPos.forEach((p, i) => lab.place(w.orn, i, p, { rot: [Math.PI / 2, 0, 0], scale: s }));
  },

  // сурок-болельщик: следит за камнем, прыгает от линий, крутится от «Четыре разом», дрожит от тревоги
  buildMarmot(lab, x, duo) {
    const st = lab.state, fur = '#b07a45', dark = '#7d5230', cream = '#e3c294', N = { parent: null }, y0 = duo ? 0 : 0.9;
    if (!duo) lab.cyl(1.1, 1.25, 0.9, '#9a8f84', { at: [x, 0.45, 0.6], sides: 7 });
    const g = lab.group({ at: [x, y0, 0.6], scale: 1.6 }), head = lab.group({ parent: g, at: [0, 1.5, 0] });
    const body = [lab.ball(0.6, fur, { ...N, at: [0, 0.72, 0], scale: [1, 1.25, 0.9] }), lab.ball(0.4, cream, { ...N, at: [0, 0.66, 0.3], scale: [1, 1.3, 0.6] })];
    const face = [lab.ball(0.45, fur, N), lab.ball(0.22, cream, { ...N, at: [0, -0.1, 0.34], scale: [1.25, 0.9, 0.8] }), lab.ball(0.07, '#3a2418', { ...N, at: [0, -0.02, 0.53], detail: 0 }),
      lab.box(0.12, 0.08, 0.04, '#ffffff', { ...N, at: [0, -0.24, 0.45] })];
    for (const s of [-1, 1]) {
      body.push(lab.ball(0.16, dark, { ...N, at: [s * 0.34, 0.98, 0.42] }), lab.ball(0.2, dark, { ...N, at: [s * 0.3, 0.12, 0.22], scale: [1, 0.6, 1.3] }));
      face.push(lab.ball(0.13, dark, { ...N, at: [s * 0.32, 0.34, -0.05] }), lab.ball(0.1, '#ffffff', { ...N, at: [s * 0.17, 0.1, 0.36] }),
        lab.ball(0.055, '#1a1a22', { ...N, at: [s * 0.17, 0.1, 0.44], shiny: true, detail: 0 }));
    }
    lab.merge(body, g); lab.merge(face, head);
    st.mm = { g, head, y0, y: y0, vy: 0, spin: null };
  },

  /* ---------- стакан: сдвиг, поворот, падение, фиксация ---------- */
  tickWell(lab, w, p, dt) {
    const cfg = lab.cfg;
    if (w.clearT > 0) { w.clearT -= dt; if (w.clearT <= 0) this.collapse(lab, w); return; }
    this.levelUp(lab, w);
    if (!w.piece) { this.spawn(lab, w); if (!w.piece) return; }
    w.pt += dt;
    // сдвиг: сразу, а если держишь — автоповтор
    const dir = p.left || p.x < -0.5 ? -1 : p.right || p.x > 0.5 ? 1 : 0;
    if (dir !== w.dir) { w.dir = dir; w.das = cfg.das; if (dir) this.shift(lab, w, dir); }
    else if (dir) { w.das -= dt; while (w.das <= 0) { w.das += cfg.arr; if (!this.shift(lab, w, dir)) break; } }
    if (p.pressed.a || p.pressed.up) this.rotate(lab, w);
    if (p.pressed.b) return this.hardDrop(lab, w);
    const step = this.interval(lab, w), iv = p.down ? Math.min(step, 1 / cfg.soft) : step;
    w.fallT += dt;
    while (w.fallT >= iv) {
      w.fallT -= iv;
      if (this.fits(w, w.piece.cells, w.px, w.py - 1)) { w.py--; w.lockT = 0; if (p.down) this.points(lab, w, 1); }
      else { w.fallT = 0; break; }
    }
    if (!this.fits(w, w.piece.cells, w.px, w.py - 1)) {
      w.lockT += dt;
      if (w.lockT >= cfg.lock || w.resets > 14) this.lockPiece(lab, w);
    }
  },
  interval(lab, w) { return Math.max(0.03, lab.cfg.fall * Math.pow(lab.cfg.speedup, w.level - 1)); },
  fits(w, cells, px, py) {
    return cells.every(([cx, cy]) => { const x = px + cx, y = py + cy; return x >= 0 && x < w.grid[0].length && y >= 0 && y < w.grid.length && !w.grid[y][x]; });
  },
  moved(w) { if (!this.fits(w, w.piece.cells, w.px, w.py - 1)) { w.lockT = 0; w.resets++; } }, // на дне — отложить фиксацию
  // нота лада уровня: столбец сдвига или шаг поворота
  note(w, i) { return 262 * Math.pow(2, (this.ROOT[(w.level - 1) % this.ROOT.length] + this.SCALE[((i % this.SCALE.length) + this.SCALE.length) % this.SCALE.length]) / 12); },
  shift(lab, w, dir) {
    if (!this.fits(w, w.piece.cells, w.px + dir, w.py)) return false;
    w.px += dir; this.moved(w);
    lab.tone(this.note(w, w.px) * 2, 0.04, 'triangle', 0.025);
    return true;
  },
  // поворот: (x, y) → (y, n − 1 − x); не влез — отскок от стенки или вверх
  rotate(lab, w) {
    const p = w.piece, cells = p.cells.map(([x, y]) => [y, p.n - 1 - x]);
    const kick = this.KICKS.find(([kx, ky]) => this.fits(w, cells, w.px + kx, w.py + ky));
    if (!kick) return lab.tone(140, 0.05, 'square', 0.03); // упёрся
    p.cells = cells; w.px += kick[0]; w.py += kick[1]; this.moved(w);
    lab.state.rots++; lab.count('повороты');
    w.note++; lab.tone(this.note(w, w.note + 2), 0.07, 'triangle', 0.05, this.note(w, w.note + 3));
    if (lab.juicy('squash')) w.rotK = 1;
  },
  hardDrop(lab, w) {
    const p = w.piece;
    let d = 0;
    while (this.fits(w, p.cells, w.px, w.py - d - 1)) d++;
    if (d > 0 && lab.juicy('burst')) { // след по каждому столбцу: откуда камень упал
      const tops = new Map();
      p.cells.forEach(([cx, cy]) => { const x = w.px + cx; tops.set(x, Math.max(tops.has(x) ? tops.get(x) : -99, w.py + cy)); });
      let i = 0;
      for (const [x, y] of tops) this.streak(lab, w.streaks[i++], this.wx(w, x), this.wy(y - d) - 0.3, this.wy(y) + 0.5, p.k);
    }
    w.py -= d;
    p.cells.forEach(([cx, cy], i) => { w.pd[i][0] = w.px + cx; w.pd[i][1] = w.py + cy; });
    this.points(lab, w, 2 * d);
    lab.noise(0.1, 0.07, 2600); lab.tone(170, 0.12, 'sine', 0.14, 55);
    lab.shake(0.1 + Math.min(0.15, d * 0.008)); lab.vibrate(30, 0.3);
    if (lab.juicy('squash')) w.bump = 1;
    this.lockPiece(lab, w, true);
  },
  streak(lab, m, x, y0, y1, k) {
    m.visible = true; m.position.set(x, (y0 + y1) / 2, -0.3); m.scale.set(1, Math.max(0.5, y1 - y0), 1);
    m.material.color.copy(this.col[k]).multiplyScalar(1.6);
    lab.tween(0.3, (e, raw) => { m.material.opacity = 0.75 * (1 - e); m.scale.x = 1 - 0.7 * e; if (raw >= 1) m.visible = false; }, 'outQuad');
  },

  // камень из общей очереди: у соперников одинаковые
  spawn(lab, w) {
    const st = lab.state, k = this.deal(lab, w), K = this.KINDS[k], cells = K.c.map(c => c.slice());
    w.piece = { k, n: K.n, cells };
    w.px = Math.floor((st.W - K.n) / 2); w.py = st.H - Math.max(...cells.map(c => c[1]));
    w.fallT = w.lockT = w.resets = w.pt = 0;
    if (!this.fits(w, cells, w.px, w.py)) { w.piece = null; return this.topOut(lab, w); }
    w.pd = cells.map(([cx, cy]) => [w.px + cx, w.py + cy + 1.3]); // въезжает сверху
    if (lab.juicy('squash')) { w.spawnK = 1; w.prevK = 1; }
    while (st.seq.length < w.qi + 6) st.seq.push(this.gen(lab));
  },
  deal(lab, w) {
    const st = lab.state;
    while (st.seq.length < w.qi + 8) st.seq.push(this.gen(lab));
    const k = st.seq[w.qi++];
    w.sinceI = k === 'I' ? 0 : w.sinceI + 1;
    if (w.sinceI === 13) lab.count('засухи'); // мешок такого не допускает
    w.maxDry = Math.max(w.maxDry, w.sinceI);
    return k;
  },
  // спрятанная механика донора: «мешок» — семь камней перемешаны, по одному до конца мешка; без мешка — чистый случай
  gen(lab) {
    const st = lab.state, all = this.ORDER.split('');
    if (lab.cfg.bag < 1) return lab.pick(all);
    if (!st.bag.length) {
      st.bag = all;
      for (let i = 6; i > 0; i--) { const j = lab.randInt(0, i); [all[i], all[j]] = [all[j], all[i]]; }
      lab.count('_secret'); // спрятанная механика сработала: новый мешок
    }
    return st.bag.pop();
  },
  wx(w, x) { return w.ox - w.grid[0].length / 2 + x + 0.5; },
  wy(y) { return this.BASE + y + 0.5; },

  lockPiece(lab, w, hard) {
    const st = lab.state, p = w.piece, flash = lab.juicy('whiten') ? 1 : 0;
    let low = 99, over = false, sx = 0;
    p.cells.forEach(([cx, cy]) => {
      const x = w.px + cx, y = w.py + cy;
      w.grid[y][x] = { k: p.k, y, f: flash, s: 1, v: 0 }; // вспышка фиксации, как в The Grand Master
      over = over || y >= st.H; low = Math.min(low, y); sx += x;
    });
    w.piece = null;
    st.pieces++; lab.count('камни');
    w.cyc.push(w.pt); if (w.cyc.length > 8) w.cyc.shift();
    lab.burst([this.wx(w, sx / 4), this.wy(low) - 0.5, 0.5], { count: hard ? 14 : 7, colors: ['#f1e2c4', '#c9a77c'], speed: hard ? 4 : 2.5, up: 1.5, size: 0.16 });
    lab.tone(this.note(w, 0) / 2, 0.1, 'sine', 0.12, this.note(w, 0) / 4); lab.noise(0.05, 0.05, 900);
    if (over) return this.topOut(lab, w);
    w.rows = [];
    for (let y = 0; y < st.H; y++) if (w.grid[y].every(Boolean)) w.rows.push(y);
    if (!w.rows.length) { w.combo = -1; this.raiseGarbage(lab, w); return this.checkDanger(lab, w); }
    w.combo++;
    w.clearT = 0.3;
    const up = lab.pitch(Math.max(0, w.combo) * 2);
    w.rows.forEach((y, i) => {
      w.grid[y].forEach(c => { c.clear = true; });
      const bar = w.bars[i];
      bar.visible = true; bar.position.y = this.wy(y);
      bar.material.color.set(w.rows.length === 4 ? '#ffd23f' : '#fff6dc').multiplyScalar(1.4);
      lab.tween(0.32, (e, raw) => { bar.scale.x = 0.1 + 0.95 * Math.min(1, e * 1.6); bar.material.opacity = 0.9 * (1 - e * e); if (raw >= 1) bar.visible = false; }, 'outCubic');
      lab.tone(this.note(w, 4 + i * 2) * up, 0.12, 'square', 0.05, 0, i * 0.06);
    });
    lab.hitstop(0.04);
  },
  collapse(lab, w) {
    const st = lab.state, cfg = lab.cfg, n = w.rows.length, at = lab.v3(w.ox, this.wy(w.rows[0] + n / 2), 1.2), lvl = w.level;
    for (const y of w.rows) w.grid[y].forEach((c, x) => {
      lab.burst([this.wx(w, x), this.wy(y), 0.3], { count: n === 4 ? 6 : 4, colors: [c.k === 'X' ? '#9a9cb8' : this.KINDS[c.k].color, '#ffffff'], speed: 6, size: 0.24, life: 0.6, gravity: 10, dir: [(x - st.W / 2 + 0.5) * 0.15, 0.6, 0.8] });
    });
    w.grid = w.grid.filter((row, y) => !w.rows.includes(y)); // камни выше падают сами: settle
    while (w.grid.length < st.H + 6) w.grid.push(new Array(st.W).fill(null));
    const b2b = n === 4 && w.b2b, pc = w.grid.every(r => r.every(c => !c));
    const pts = Math.round(this.LINE_PTS[n] * lvl * (b2b ? cfg.b2b : 1)), comboPts = w.combo > 0 ? Math.round(cfg.combo * w.combo * lvl) : 0, pcPts = pc ? 2000 * lvl : 0;
    this.points(lab, w, pts + comboPts + pcPts);
    w.lines += n; lab.count('линии', n);
    const name = b2b ? 'Снова четыре! ' : ['', '', 'Две линии! ', 'Три линии! ', 'Четыре разом! '][n];
    lab.popup(at, name + '+' + pts, n === 4 ? '#ffd23f' : '#ffffff', 18 + 6 * n + (b2b ? 6 : 0));
    if (comboPts) {
      lab.popup(lab.v3(w.ox, at.y + 1.6, 1.2), `Серия ×${w.combo + 1}  +${comboPts}`, '#7cf5ff', 18 + Math.min(12, w.combo * 2));
      if (w.combo === 1) lab.count('серии');
    }
    st.bestCombo = Math.max(st.bestCombo, w.combo + 1);
    lab.shake(0.12 * n); this.cheer(lab, 3 + 0.7 * n, w);
    lab.tone(this.note(w, 0) * lab.pitch(w.combo * 2), 0.18, 'triangle', 0.07); lab.tone(this.note(w, 2) * lab.pitch(w.combo * 2), 0.2, 'triangle', 0.06, 0, 0.05);
    if (n === 4) {
      st.tetris++; lab.count('четыре разом');
      lab.flash('#ffd23f', 0.35); lab.hitstop(0.1); lab.sfx.power(); lab.slowmo(0.35, 0.45);
      lab.burst(at, { count: 60, colors: ['#ffd23f', '#ffffff', '#ff8a3d'], speed: 13, size: 0.3 });
      lab.ring(at, { color: '#ffd23f', radius: st.W * 0.8, life: 0.5 });
      w.ornK = 1;
      if (st.mm && lab.juicy('squash')) this.spin(lab);
    }
    w.b2b = n === 4;
    if (pc) { // чистый стакан: ни одного камня
      st.pcs++; lab.count('чистый стакан');
      lab.popup(lab.v3(w.ox, this.wy(st.H / 2), 1.2), `Чистый стакан! +${pcPts}`, '#7cf5a8', 34);
      lab.flash('#7cf5a8', 0.3); lab.sfx.win(); w.ornK = 1;
      lab.ring(lab.v3(w.ox, this.wy(2), 1), { color: '#7cf5a8', radius: st.W, life: 0.7 });
    }
    // линии гасят свой мусор, остаток летит соседу
    const other = st.wells.find(x => x !== w);
    let g = Math.round((this.GARBAGE[n] + this.COMBO_G[Math.min(w.combo, this.COMBO_G.length - 1)] + (b2b ? 1 : 0) + (pc ? 4 : 0)) * cfg.garbage);
    const cancel = Math.min(g, w.pending); w.pending -= cancel; g -= cancel;
    if (other && g > 0) this.sendGarbage(lab, w, other, g);
    this.levelUp(lab, w);
    w.rows = [];
    this.checkDanger(lab, w);
  },
  // уровень — от линий, а если ручка levelTime > 0, то и от времени
  levelUp(lab, w) {
    const cfg = lab.cfg, L = Math.max(1 + Math.floor(w.lines / Math.round(cfg.perLevel)), cfg.levelTime > 0 ? 1 + Math.floor(lab.t / cfg.levelTime) : 1);
    if (L <= w.level) return;
    w.level = L; lab.sfx.coin(); w.ornK = Math.max(w.ornK, 0.6);
    lab.popup(lab.v3(w.ox, this.wy(lab.state.H - 3), 1.2), `Уровень ${L} — быстрее!`, '#7cf5a8', 26);
  },
  // мусор летит видимым снарядом в столбик соседа (Tetris 99), там ждёт, пока сосед не положит камень без линии
  sendGarbage(lab, from, to, g) {
    const st = lab.state, a = lab.v3(from.ox, this.wy(st.H * 0.6), 0.9), b = lab.v3(to.meterX, this.BASE + to.pending + 0.5, 0.9);
    const ball = lab.ball(0.3 + 0.07 * Math.min(g, 6), '#ff6a3d', { at: a, unlit: true, glow: 1.6, detail: 0, shadow: false });
    lab.trail(ball, { color: '#ff7a2e', width: 0.7, length: 14 });
    from.sent += g; lab.sfx.warn();
    lab.tween(0.5, e => { ball.position.set(lab.lerp(a.x, b.x, e), lab.lerp(a.y, b.y, e) + Math.sin(e * Math.PI) * 4, 0.9); ball.rotation.z += 0.3; }, 'inOutQuad');
    lab.after(0.5, () => {
      ball.removeFromParent(); ball.geometry.dispose();
      to.pending += g; to.meterK = 1;
      lab.burst(b, { count: 14, colors: ['#ff6a3d', '#ffd34d'], speed: 5 });
      lab.popup(lab.v3(to.ox, this.wy(st.H / 2), 1.2), `+${g} мусора`, '#ff6a6a', 22);
      lab.tone(110, 0.2, 'sawtooth', 0.07, 60); lab.shake(0.15);
    });
  },
  // мусор поднимается снизу, когда ляжет камень; во всех рядах одна дыра
  raiseGarbage(lab, w) {
    const st = lab.state, n = Math.min(w.pending, 8), gap = lab.randInt(0, st.W - 1);
    if (n <= 0) return;
    w.pending -= n;
    const rows = [];
    for (let r = 0; r < n; r++) rows.push(w.grid[0].map((_, x) => (x === gap ? null : { k: 'X', y: r - n, f: 0, s: 1, v: 0 })));
    w.grid.unshift(...rows);
    w.grid.splice(st.H + 6);
    lab.sfx.warn(); lab.shake(0.3);
    if (w.grid.slice(st.H).some(r => r.some(Boolean))) this.topOut(lab, w);
  },
  checkDanger(lab, w) { w.danger = w.grid.slice(lab.state.H - 6).some(r => r.some(Boolean)); },
  // переполнен: камни гаснут снизу вверх, потом конец партии
  topOut(lab, w) {
    if (w.dead) return;
    w.dead = true; w.dieT = 0; w.piece = null; w.danger = false;
    lab.shake(0.8); lab.flash('#ff4d5e', 0.4); lab.sfx.explode();
  },
  dying(lab, w, dt) {
    const st = lab.state;
    w.dieT += dt;
    const upTo = Math.floor(w.dieT / 0.7 * (st.H + 1));
    w.grid.forEach((row, y) => { if (y <= upTo) row.forEach(c => { if (c) c.grey = true; }); });
    if (w.dieT >= 0.9 && !st.ended) {
      st.ended = true;
      if (st.wells.length > 1) lab.win(`Победил игрок ${w.i ? 1 : 2}`);
      else lab.gameOver('Стакан переполнен');
    }
  },
  points(lab, w, n) { w.score += n; lab.score += n; },
  cycle(w) { return w.cyc.length >= 2 ? w.cyc.reduce((a, b) => a + b, 0) / w.cyc.length : 0; },
  // камни падают с весом и приседают, мусор поднимается, падающий камень догоняет свою клетку
  settle(lab, w, dt) {
    const squash = lab.juicy('squash');
    w.grid.forEach((row, y) => row.forEach(c => {
      if (!c) return;
      if (c.y > y) { c.v += 34 * dt; c.y = Math.max(y, c.y - c.v * dt); if (c.y === y) { c.v = 0; if (squash) c.s = 0.84; } }
      else if (c.y < y) c.y = Math.min(y, c.y + dt * 9);
      if (c.f > 0) c.f = Math.max(0, c.f - dt * 6);
      if (c.s !== 1) c.s = Math.abs(c.s - 1) < 0.003 ? 1 : lab.damp(c.s, 1, 16, dt);
    }));
    if (w.piece) {
      const k = 1 - Math.exp(-dt * 30);
      w.piece.cells.forEach(([cx, cy], i) => { const d = w.pd[i]; d[0] = lab.lerp(d[0], w.px + cx, k); d[1] = lab.lerp(d[1], w.py + cy, k); });
    }
    w.bump = Math.max(0, w.bump - dt * 7); w.rotK = Math.max(0, w.rotK - dt * 9); w.spawnK = Math.max(0, w.spawnK - dt * 7); w.prevK = Math.max(0, w.prevK - dt * 6);
  },

  /* ---------- мир: небо по уровню, тревога, сурок, облака ---------- */
  tickWorld(lab, dt) {
    const st = lab.state, t = lab.t, m = st.mm, danger = st.wells.some(w => w.danger && !w.dead), tmp = this.tmp;
    // небо: полдень → закат → ночь
    const lvl = Math.max(...st.wells.map(w => w.level)), goal = Math.min(lvl - 1, this.SKY.length - 1);
    const k = st.skyK < 0 ? goal : lab.damp(st.skyK, goal, 0.8, dt);
    if (Math.abs(k - st.skyK) > 0.002) {
      st.skyK = k;
      const i = Math.min(this.SKY.length - 2, Math.floor(k)), f = k - i, A = this.skyPal[i], B = this.skyPal[i + 1];
      const top = A.top.clone().lerp(B.top, f), bot = A.bot.clone().lerp(B.bot, f), sun = A.sun.clone().lerp(B.sun, f);
      this.paintSky(top, bot);
      if (lab.scene.fog) lab.scene.fog.color.copy(bot);
      lab.light.hemi.color.copy(top).lerp(tmp.white, 0.6); lab.light.hemi.intensity = 0.85 * (0.55 + 0.45 * lab.lerp(A.power, B.power, f) / 1.9);
      lab.light.sun.color.copy(sun); lab.light.sun.intensity = lab.lerp(A.power, B.power, f);
      st.sunMat.color.copy(sun).multiplyScalar(1.6); st.sun.position.y = 46 - k * 6;
      st.starMat.opacity = lab.lerp(A.stars, B.stars, f);
    }
    const c = st.clouds;
    c.list.forEach((o, i) => { o.x += o.v * dt; if (o.x > 100) o.x = -100; this.put(c.mesh, i, o.x, o.y, o.z, [o.s, o.s * 0.55, o.s * 0.8]); });
    c.mesh.instanceMatrix.needsUpdate = true; c.mesh.computeBoundingSphere();
    st.warnMat.opacity = 0.25 + 0.25 * (0.5 + 0.5 * Math.sin(t * 10));
    st.wells.forEach(w => {
      const d = w.danger && !w.dead;
      w.lineMat.opacity = d ? 0.55 + 0.45 * Math.sin(t * 9) : 0.25;
      w.panelMat.color.copy(w.panelBase).lerp(w.panelRed, d ? 0.5 + 0.3 * Math.sin(t * 9) : 0);
      if (w.ornK > 0) { w.ornK = Math.max(0, w.ornK - dt * 2); this.placeOrn(lab, w, 1 + 0.9 * Math.sin(w.ornK * Math.PI)); }
      if (w.meter) {
        w.meterK = Math.max(0, w.meterK - dt * 5);
        w.meter.visible = w.pending > 0; w.meter.scale.set(1 + 0.6 * w.meterK, Math.max(0.01, w.pending), 1 + 0.6 * w.meterK); w.meter.position.y = this.BASE + w.pending / 2;
      }
    });
    if (danger && (st.beat -= dt) <= 0) { st.beat = 0.7; lab.tone(70, 0.12, 'sine', 0.16); lab.tone(62, 0.1, 'sine', 0.12, 0, 0.16); } // сердцебиение
    // сурок: прыжок, приземление, дрожь; голова следит за падающим камнем
    m.vy -= 18 * dt; m.y += m.vy * dt;
    if (m.y < m.y0) { if (m.vy < -2) lab.pulse(m.g, 1.1, 0.12); m.y = m.y0; m.vy = 0; }
    m.g.position.y = m.y; m.g.rotation.z = danger ? Math.sin(t * 38) * 0.06 : 0;
    const w = st.wells[st.watch] || st.wells[0], piece = w.piece && w.pd[0];
    const tx = piece ? this.wx(w, w.pd[0][0]) : w.ox, ty = piece ? this.wy(w.pd[0][1]) : this.BASE + st.H / 2, hx = m.g.position.x, hy = m.y + 1.5 * 1.6;
    m.head.rotation.y = lab.damp(m.head.rotation.y, lab.clamp((tx - hx) * 0.12, -0.75, 0.75), 8, dt);
    m.head.rotation.x = lab.damp(m.head.rotation.x, lab.clamp((hy - ty) * 0.05, -0.35, 0.5), 8, dt);
  },
  cheer(lab, vy, w) {
    const st = lab.state, m = st.mm;
    st.watch = st.wells.indexOf(w);
    if (m && m.y <= m.y0 + 0.01) m.vy = vy;
  },
  spin(lab) {
    const m = lab.state.mm;
    if (m.spin) m.spin.cancel();
    m.spin = lab.tween(0.7, e => { m.g.rotation.y = e * Math.PI * 2; }, 'outCubic');
  },
};
