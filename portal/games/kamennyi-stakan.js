// «Каменный стакан» — ремейк-донор урока 4 по мотивам механики «Тетриса».
// Спрятанная механика донора — честный проигрыш: «мешок» из семи камней и предпросмотр (ручки bag и preview, пресет «Без спрятанной механики»).
const GAME = {
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
  camera: 'side', // в start: свой наклон и цель по размеру стакана
  sky: '#86c9ee',
  fog: 0.006,
  accent: '#ffd23f',
  lives: 0,
  decisions: [
    'Чувство: «ещё один камень», четыре линии разом взрываются золотом',
    'Честность: тень, три следующих камня, мешок не даёт ждать палку вечно',
    'Выбор: закрыть дыру сейчас или оставить колодец для палки',
  ],
  config: {
    fall: { value: 0.8, min: 0.1, max: 2, step: 0.05, label: 'Падение в начале: секунд на клетку' },
    speedup: { value: 0.82, min: 0.5, max: 1, step: 0.01, label: 'Ускорение: падение × за уровень' },
    perLevel: { value: 8, min: 2, max: 30, step: 1, label: 'Линий до следующего уровня' },
    bag: { value: 1, min: 0, max: 1, step: 1, label: 'Спрятанная механика: мешок из семи камней', hint: '1 — в каждых семи камнях все семь; 0 — чистый случай' },
    preview: { value: 3, min: 0, max: 5, step: 1, label: 'Спрятанная механика: сколько следующих камней видно' },
    ghost: { value: 1, min: 0, max: 1, step: 1, label: 'Тень: где камень ляжет' },
    lock: { value: 0.5, min: 0, max: 1.5, step: 0.05, label: 'Задержка перед фиксацией, с' },
    soft: { value: 22, min: 5, max: 60, step: 1, label: 'Быстрее вниз: клеток в секунду' },
    das: { value: 0.16, min: 0.05, max: 0.4, step: 0.01, label: 'Автоповтор сдвига: задержка, с' },
    arr: { value: 0.05, min: 0.01, max: 0.2, step: 0.01, label: 'Автоповтор сдвига: шаг, с' },
    cols: { value: 10, min: 6, max: 14, step: 1, label: 'Ширина стакана', restart: true },
    rows: { value: 20, min: 12, max: 24, step: 1, label: 'Высота стакана', restart: true },
    vs: { value: 0, min: 0, max: 1, step: 1, label: 'Вдвоём: два стакана', restart: true },
    garbage: { value: 1, min: 0, max: 2, step: 0.5, label: 'Вдвоём: мусор соседу за линии' },
  },
  presets: {
    'Новичок': { fall: 1.1, speedup: 0.9, perLevel: 12, preview: 5, lock: 0.9 },
    'Без спрятанной механики': { bag: 0, preview: 0 },
    'Безумие': { fall: 0.25, speedup: 0.75, perLevel: 5, lock: 0.25 },
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
  BASE: 0.8, // высота дна стакана
  LINE_PTS: [0, 100, 300, 500, 800],
  GARBAGE: [0, 0, 1, 2, 4],
  KICKS: [[0, 0], [-1, 0], [1, 0], [0, 1], [-2, 0], [2, 0]],
  SKY: ['#86c9ee', '#9fcbe4', '#f3b47c', '#e8826e', '#7a5a9e', '#2a2f66'], // небо по уровням

  start(lab, scene) {
    const st = lab.state, duo = lab.cfg.vs >= 1;
    st.W = Math.round(lab.cfg.cols); st.H = Math.round(lab.cfg.rows);
    this.field = { w: duo ? 2 * st.W + 18 : st.W + 9, h: st.H + 7 };
    lab.setCamera({ type: 'side', beta: 1.38, target: [duo ? 0 : 1.7, this.BASE + st.H / 2 + 1.6, 0] });
    Object.assign(st, { seq: [], bag: [], pieces: 0, rots: 0, tetris: 0, fx: [], beat: 0, sky: lab.color(this.SKY[0]) });
    this.sources(lab, scene);
    this.scenery(lab, scene);
    st.wells = (duo ? [-1, 1] : [0]).map((side, i) => this.buildWell(lab, scene, side, i));
    this.buildMarmot(lab, scene, duo ? 0 : st.W / 2 + 2.7, duo);
  },

  update(lab, dt) {
    const W = lab.state.wells, cyc = this.cycle(W[0]);
    W.forEach((w, i) => this.tickWell(lab, w, i ? lab.p2 : lab.p1, dt));
    this.tickWorld(lab, dt);
    if (W.length > 1) lab.hud('duo', `Линий: игрок 1 — ${W[0].lines}, игрок 2 — ${W[1].lines}`);
    else lab.hud('lvl', `Уровень ${W[0].level} · линий ${W[0].lines}`);
    lab.hud('cycle', cyc ? `Цикл: камень за ${cyc.toFixed(1)} с` : null);
    lab.hud('danger', W.some(w => w.danger) ? '⚠ Стакан почти полон!' : null);
  },

  overNote(lab) {
    const st = lab.state, W = st.wells, n = Math.max(1, st.pieces), dry = Math.max(...W.map(w => w.maxDry));
    return [`Цикл: камень за ${(lab.t * W.length / n).toFixed(1)} с, «повернуть и поставить» ${st.pieces} раз, поворотов на камень ${(st.rots / n).toFixed(1)}`,
      W.length > 1 ? `Линий: ${W[0].lines} и ${W[1].lines}, мусора: ${W[0].sent} и ${W[1].sent}` : `Линий: ${W[0].lines} · уровень ${W[0].level} · четыре разом: ${st.tetris}`,
      `Палка не приходила ${dry} камней подряд` + (lab.cfg.bag >= 1 ? ' (мешок: не больше 12)' : ' (без мешка — сколько угодно)')];
  },

  // части в один меш, одноцветные — сперва вместе: меньше вызовов отрисовки
  merge(parts, name) {
    const B = BABYLON, groups = new Map();
    parts.forEach(p => groups.set(p.material, (groups.get(p.material) || []).concat(p)));
    const pieces = [...groups.values()].map(g => (g.length > 1 ? B.Mesh.MergeMeshes(g, true, true) : g[0]));
    const m = pieces.length > 1 ? B.Mesh.MergeMeshes(pieces, true, true, undefined, false, true) : pieces[0];
    m.name = name; m.isVisible = false; return m;
  },
  part(lab, mesh, color, x = 0, y = 0, z = 0, o) { mesh.material = lab.mat(color, o || {}); mesh.position.set(x, y, z); return mesh; },

  sources(lab, scene) {
    const B = BABYLON, MB = B.MeshBuilder, src = lab.state.src = { stone: {} };
    const stone = (name, color) => {
      const rune = this.part(lab, MB.CreateCylinder(name, { height: 0.06, diameter: 0.34, tessellation: 4 }, scene), '#fff4d6', 0, 0, -0.53, { glow: 0.9 });
      rune.rotation.x = Math.PI / 2;
      return this.merge([this.part(lab, MB.CreateBox(name, { size: 0.94 }, scene), color),
        this.part(lab, MB.CreateBox(name, { width: 0.7, height: 0.7, depth: 0.08 }, scene), B.Color3.Lerp(lab.color(color), B.Color3.White(), 0.38).toHexString(), 0, 0, -0.48, { glow: 0.25 }), rune], name);
    };
    for (const k of this.ORDER) src.stone[k] = stone('камень ' + k, this.KINDS[k].color);
    src.stone.X = stone('мусор', '#6d6f8c');
    const hidden = (mesh, color, o) => { mesh.material = lab.mat(color, o || {}); mesh.isVisible = false; return mesh; };
    src.ghost = lab.noShadow(hidden(MB.CreateBox('тень', { size: 0.9 }, scene), '#ffffff', { unlit: true, alpha: 0.22 }));
    src.wall = ['#d2ad7f', '#c39a6c'].map(c => hidden(MB.CreateBox('кладка', { width: 0.96, height: 0.98, depth: 1.4 }, scene), c));
    src.orn = hidden(MB.CreateCylinder('узор', { height: 0.08, diameter: 0.5, tessellation: 4 }, scene), '#ffcf4a', { glow: 0.8 });
    src.orn.rotation.x = Math.PI / 2; src.orn.bakeCurrentTransformIntoVertices(); // копии не наследуют поворот исходника
    src.groove = lab.noShadow(hidden(MB.CreateBox('борозда', { width: 0.05, height: 1, depth: 0.05 }, scene), '#4a6196'));
  },

  // плато Лаго-Наки
  scenery(lab, scene) {
    const MB = BABYLON.MeshBuilder, st = lab.state, P = (m, c, x, y, z, o) => this.part(lab, m, c, x, y, z, o);
    const cone = (h, d, c, y) => { const m = P(MB.CreateCylinder('конус', { height: h, diameterTop: 0, diameterBottom: d, tessellation: 6 }, scene), c, 0, y, 0); m.convertToFlatShadedMesh(); return m; };
    const box = (w, h, d, c, x, y, z) => P(MB.CreateBox('плита', { width: w, height: h, depth: d }, scene), c, x, y, z);
    lab.ground({ w: 240, h: 200, color: '#6cb85a' });
    const patch = ['#7fcb68', '#5aa84c', '#8fd06d'].map(c => lab.noShadow(this.merge([P(MB.CreateCylinder('луг', { height: 0.02, diameter: 1, tessellation: 7 }, scene), c)], 'луг')));
    for (let i = 0; i < 26; i++) {
      const p = lab.pick(patch).createInstance('луг'), s = lab.rand(3, 10);
      p.scaling.set(s, 1, s * 0.6); p.position.set(lab.rand(-45, 45), 0.02, lab.rand(-6, 45));
    }
    const mount = lab.noShadow(this.merge([cone(1, 1, '#6f7fa6', 0), cone(0.32, 0.33, '#f2f6ff', 0.34)], 'гора'));
    [[-62, 96, 40, 34], [-22, 112, 58, 44], [26, 102, 46, 36], [72, 94, 34, 30]].forEach(([x, z, h, r]) => {
      const m = mount.createInstance('гора'); m.scaling.set(r * 2, h, r * 2); m.position.set(x, h / 2 - 0.5, z); m.rotation.y = lab.rand(0, 3);
    });
    const sand = '#b8a07e', hole = P(MB.CreateCylinder('лаз', { height: 0.05, diameter: 0.75, tessellation: 10 }, scene), '#2e2420', 0, 1.05, -1.55);
    hole.rotation.x = Math.PI / 2;
    const dol = this.merge([box(3.4, 0.3, 3.6, sand, 0, 0.15, 0), box(3, 2, 3, sand, 0, 1.3, 0), box(3.9, 0.4, 4, sand, 0, 2.5, 0), box(3.2, 0.12, 3.2, '#78a952', 0, 2.75, 0), hole], 'дольмен');
    [[-16, 13, 0.3], [17, 17, -0.4], [-33, 30, 0.6], [35, 34, 0.2]].forEach(([x, z, a]) => {
      const d = dol.createInstance('дольмен'); d.position.set(x, 0, z); d.rotation.y = a; d.scaling.setAll(1.25);
    });
    const firs = ['#2f7a46', '#3d8c4f'].map(c => this.merge([P(MB.CreateCylinder('ствол', { height: 0.8, diameter: 0.28, tessellation: 5 }, scene), '#6b4a30', 0, 0.4, 0), cone(1.7, 1.5, c, 1.45), cone(1.2, 1.05, c, 2.3)], 'пихта'));
    for (let i = 0; i < 24; i++) {
      const t = lab.pick(firs).createInstance('пихта');
      t.position.set((i % 2 ? 1 : -1) * lab.rand(13, 46), 0, lab.rand(5, 42)); t.scaling.setAll(lab.rand(1.3, 2.8));
    }
    const puff = (x, y, s) => P(MB.CreateSphere('облако', { diameter: s, segments: 5 }, scene), '#ffffff', x, y, 0, { glow: 0.35 });
    const cloud = lab.noShadow(this.merge([puff(0, 0, 3), puff(1.6, -0.3, 2.2), puff(-1.7, -0.4, 2), puff(0.5, 0.8, 2)], 'облако'));
    st.clouds = [];
    for (let i = 0; i < 7; i++) {
      const c = cloud.createInstance('облако'); c.position.set(lab.rand(-60, 60), lab.rand(30, 42), lab.rand(40, 70)); c.scaling.set(lab.rand(1.5, 3), 1.2, 1.5);
      st.clouds.push({ c, v: lab.rand(0.6, 1.6) });
    }
  },

  buildWell(lab, scene, side, i) {
    const st = lab.state, src = st.src, W = st.W, H = st.H, b0 = this.BASE, ox = side * (W / 2 + 4.5), pv = side || 1;
    const w = { i, ox, pvx: ox + pv * (W / 2 + 2.7), grid: [], meshes: [], prev: [], orn: [], cyc: [], pending: 0, sent: 0, score: 0, lines: 0, level: 1, sinceI: 0, maxDry: 0, qi: 0 };
    for (let y = 0; y < H + 6; y++) w.grid.push(new Array(W).fill(null));
    const box = (o, c, x, y, z, glow) => this.part(lab, BABYLON.MeshBuilder.CreateBox('стакан', o, scene), c, x, y, z, glow ? { glow } : null);
    box({ width: W + 9, height: b0, depth: 3.6 }, '#a8865f', ox + pv * 2, b0 / 2, 0.2);
    box({ width: W + 10, height: 0.35, depth: 1.2 }, '#c4a27a', ox + pv * 2, 0.17, -2);
    box({ width: W, height: H, depth: 0.3 }, '#24345a', ox, b0 + H / 2, 0.68);
    box({ width: 3.9, height: 14.2, depth: 0.3 }, '#2b3d66', w.pvx, b0 + H - 7.1, 0.75);
    for (let x = 1; x < W; x++) { const g = src.groove.createInstance('борозда'); g.position.set(ox - W / 2 + x, b0 + H / 2, 0.5); g.scaling.y = H; }
    for (const s of [-1, 1]) for (let y = 0; y <= H; y++) {
      src.wall[(y + (s > 0)) % 2].createInstance('кладка').position.set(ox + s * (W / 2 + 0.5), b0 + y + 0.5, 0.05);
      if (y % 3 === 1) { const o = src.orn.createInstance('узор'); o.position.set(ox + s * (W / 2 + 0.5), b0 + y + 0.5, -0.68); w.orn.push(o); }
    }
    for (let x = -1; x <= W; x++) src.wall[x & 1].createInstance('кладка').position.set(ox - W / 2 + x + 0.5, b0 - 0.45, 0.05);
    // видно = правда: черта тревоги
    w.line = lab.noShadow(box({ width: W, height: 0.14, depth: 0.1 }, '#ff3b4e', ox, b0 + H - 4, -0.62, 1));
    w.line.visibility = 0.25;
    // вдвоём: столбик входящего мусора
    if (side) { w.meter = lab.noShadow(box({ width: 0.32, height: 1, depth: 0.3 }, '#ff4d5e', ox - side * (W / 2 + 1.25), b0, -0.3, 1)); w.meter.setEnabled(false); }
    w.ghosts = [0, 1, 2, 3].map(() => { const g = src.ghost.createInstance('тень'); g.setEnabled(false); return g; });
    return w;
  },

  // сурок-болельщик: прыгает от линий, дрожит от тревоги
  buildMarmot(lab, scene, x, duo) {
    const fur = '#b07a45', dark = '#7d5230', parts = [], h = 1.55;
    const ball = (d, c, px, py, pz) => { const m = this.part(lab, BABYLON.MeshBuilder.CreateSphere('сурок', { diameter: d, segments: 6 }, scene), c, px, py, pz); parts.push(m); return m; };
    ball(1.2, fur, 0, 0.7, 0).scaling.set(1, 1.25, 0.9);
    ball(0.86, fur, 0, h, 0); ball(0.13, '#4a2c1a', 0, h - 0.08, -0.42);
    for (const s of [-1, 1]) {
      ball(0.3, dark, s * 0.32, 0.95, -0.42); ball(0.26, dark, s * 0.32, h + 0.32, 0.05);
      ball(0.22, '#ffffff', s * 0.17, h + 0.08, -0.33); ball(0.11, '#1a1a22', s * 0.17, h + 0.08, -0.43); // глаза
    }
    const node = this.merge(parts, 'сурок'), y0 = duo ? 0 : this.BASE;
    node.isVisible = true; node.position.set(x, y0, -0.9); node.scaling.setAll(1.25);
    lab.state.mm = { node, y0, y: y0, vy: 0 };
  },

  tickWell(lab, w, p, dt) {
    const cfg = lab.cfg;
    this.settle(lab, w, dt);
    if (w.dead) return;
    if (w.clearT > 0) { w.clearT -= dt; if (w.clearT <= 0) this.collapse(lab, w); return; }
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
      if (w.lockT >= cfg.lock || w.resets > 14) return this.lockPiece(lab, w);
    }
    this.drawPiece(lab, w, dt);
  },
  interval(lab, w) { return Math.max(0.03, lab.cfg.fall * Math.pow(lab.cfg.speedup, w.level - 1)); },
  fits(w, cells, px, py) {
    return cells.every(([cx, cy]) => { const x = px + cx, y = py + cy; return x >= 0 && x < w.grid[0].length && y >= 0 && y < w.grid.length && !w.grid[y][x]; });
  },
  moved(w) { if (!this.fits(w, w.piece.cells, w.px, w.py - 1)) { w.lockT = 0; w.resets++; } }, // на дне — отложить фиксацию
  shift(lab, w, dir) {
    if (!this.fits(w, w.piece.cells, w.px + dir, w.py)) return false;
    w.px += dir; this.moved(w); lab.tone(330, 0.03, 'square', 0.025);
    return true;
  },
  // поворот: (x, y) → (y, n − 1 − x); не влез — отскок от стенки или вверх
  rotate(lab, w) {
    const p = w.piece, cells = p.cells.map(([x, y]) => [y, p.n - 1 - x]);
    const kick = this.KICKS.find(([kx, ky]) => this.fits(w, cells, w.px + kx, w.py + ky));
    if (!kick) return lab.tone(140, 0.05, 'square', 0.03); // упёрся
    p.cells = cells; w.px += kick[0]; w.py += kick[1]; this.moved(w);
    lab.state.rots++; lab.count('повороты');
    lab.tone(520, 0.05, 'triangle', 0.05, 760); w.meshes.forEach(m => lab.pulse(m, 1.12, 0.08));
  },
  hardDrop(lab, w) {
    let d = 0;
    while (this.fits(w, w.piece.cells, w.px, w.py - 1)) { w.py--; d++; }
    this.points(lab, w, 2 * d);
    lab.burst(w.meshes[0].position, { count: 6 + d, colors: ['#ffffff'], speed: 2, gravity: -6 });
    lab.sfx.whoosh(); lab.shake(0.15);
    this.drawPiece(lab, w, 1); this.lockPiece(lab, w);
  },

  // камень из общей очереди: у соперников одинаковые
  spawn(lab, w) {
    const st = lab.state, k = this.deal(lab, w), K = this.KINDS[k], cells = K.c.map(c => c.slice());
    w.piece = { k, n: K.n, cells };
    w.px = Math.floor((st.W - K.n) / 2); w.py = st.H - Math.max(...cells.map(c => c[1]));
    w.fallT = w.lockT = w.resets = w.pt = 0;
    if (!this.fits(w, cells, w.px, w.py)) { w.piece = null; return this.topOut(lab, w); }
    w.meshes = cells.map(() => st.src.stone[k].createInstance('камень'));
    this.drawPiece(lab, w, 1);
    w.meshes.forEach(m => lab.pulse(m, 1.3, 0.12));
    this.drawPreview(lab, w);
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
  drawPreview(lab, w) {
    const st = lab.state, n = Math.round(lab.cfg.preview), top = this.BASE + st.H - 1.8;
    w.prev.forEach(m => m.dispose()); w.prev = [];
    while (st.seq.length < w.qi + n) st.seq.push(this.gen(lab));
    for (let i = 0; i < n; i++) {
      const k = st.seq[w.qi + i], c = this.KINDS[k].c, s = i ? 0.5 : 0.72, y = i ? top - 0.4 - i * 2.2 : top;
      const mx = c.reduce((a, q) => a + q[0], 0) / 4, my = c.reduce((a, q) => a + q[1], 0) / 4;
      for (const [cx, cy] of c) {
        const m = st.src.stone[k].createInstance('дальше'); m.scaling.setAll(s);
        m.position.set(w.pvx + (cx - mx) * s, y + (cy - my) * s, 0.2); w.prev.push(m);
      }
    }
  },
  wx(w, x) { return w.ox - w.grid[0].length / 2 + x + 0.5; },
  wy(y) { return this.BASE + y + 0.5; },
  drawPiece(lab, w, dt) {
    const p = w.piece, k = dt >= 1 ? 1 : 1 - Math.exp(-dt * 30);
    p.cells.forEach(([cx, cy], i) => {
      const m = w.meshes[i];
      m.position.x = lab.lerp(m.position.x, this.wx(w, w.px + cx), k); m.position.y = lab.lerp(m.position.y, this.wy(w.py + cy), k);
    });
    // тень: где камень ляжет
    let d = 0;
    while (this.fits(w, p.cells, w.px, w.py - d - 1)) d++;
    const on = lab.cfg.ghost >= 1 && d > 0;
    w.ghosts.forEach((g, i) => { g.setEnabled(on); g.position.set(this.wx(w, w.px + p.cells[i][0]), this.wy(w.py - d + p.cells[i][1]), 0); });
  },

  lockPiece(lab, w) {
    const st = lab.state, p = w.piece;
    let low = 99, over = false;
    p.cells.forEach(([cx, cy], i) => {
      const x = w.px + cx, y = w.py + cy;
      w.grid[y][x] = { m: w.meshes[i], k: p.k }; w.meshes[i].position.set(this.wx(w, x), this.wy(y), 0);
      over = over || y >= st.H; low = Math.min(low, y);
    });
    w.meshes = []; w.piece = null; w.ghosts.forEach(g => g.setEnabled(false));
    st.pieces++; lab.count('камни');
    w.cyc.push(w.pt); if (w.cyc.length > 8) w.cyc.shift();
    lab.burst([this.wx(w, w.px + 1), this.wy(low) - 0.5, -0.4], { count: 8, colors: ['#f1e2c4', '#c9a77c'], speed: 2.5, up: 1.5 });
    lab.tone(120, 0.08, 'sine', 0.12, 60); lab.noise(0.05, 0.05, 900);
    if (over) return this.topOut(lab, w);
    w.rows = [];
    for (let y = 0; y < st.H; y++) if (w.grid[y].every(Boolean)) w.rows.push(y);
    if (!w.rows.length) { this.raiseGarbage(lab, w); return this.checkDanger(lab, w); }
    w.clearT = 0.3;
    w.rows.forEach((y, i) => {
      const bar = lab.noShadow(this.part(lab, BABYLON.MeshBuilder.CreateBox('вспышка', { width: st.W, height: 0.95, depth: 0.1 }, lab.scene), '#fffbe8', w.ox, this.wy(y), -0.66, { unlit: true }));
      st.fx.push({ m: bar, t: 0, dur: 0.32 });
      w.grid[y].forEach(c => lab.pulse(c.m, 1.18, 0.28));
      lab.tone([523, 659, 784, 1046][i], 0.12, 'square', 0.06, 0, i * 0.06);
    });
    lab.hitstop(0.04);
  },
  collapse(lab, w) {
    const st = lab.state, cfg = lab.cfg, n = w.rows.length, at = lab.v3(w.ox, this.wy(w.rows[0] + n / 2), -1);
    for (const y of w.rows) w.grid[y].forEach((c, x) => {
      lab.burst(c.m.position, { count: 5, colors: [c.k === 'X' ? '#9a9cb8' : this.KINDS[c.k].color, '#ffffff'], speed: 6, size: 0.24, life: 0.55, gravity: 10, dir: [(x - st.W / 2) * 0.12, 0.7, -0.7] });
      c.m.dispose();
    });
    w.grid = w.grid.filter((row, y) => !w.rows.includes(y));
    while (w.grid.length < st.H + 6) w.grid.push(new Array(st.W).fill(null));
    const pts = this.LINE_PTS[n] * w.level;
    this.points(lab, w, pts); w.lines += n; lab.count('линии', n);
    lab.popup(at, (['', '', 'Две линии! ', 'Три линии! ', 'Четыре разом! '][n]) + '+' + pts, n === 4 ? '#ffd23f' : '#ffffff', 18 + 6 * n);
    lab.shake(0.12 * n); if (st.mm.y <= st.mm.y0) st.mm.vy = 3 + 0.6 * n; // сурок прыгает от радости
    if (n === 4) {
      st.tetris++; lab.count('четыре разом');
      lab.flash('#ffd23f', 0.35); lab.hitstop(0.1); lab.sfx.power();
      lab.burst(at, { count: 60, colors: ['#ffd23f', '#ffffff', '#ff8a3d'], speed: 13, size: 0.3 });
      w.orn.forEach(o => lab.pulse(o, 1.9, 0.5));
    }
    // линии гасят свой мусор, остаток — соседу
    const other = st.wells.find(x => x !== w);
    let g = Math.round(this.GARBAGE[n] * cfg.garbage);
    const cancel = Math.min(g, w.pending); w.pending -= cancel; g -= cancel;
    if (other && g > 0) { other.pending += g; w.sent += g; lab.sfx.warn(); lab.popup(lab.v3(other.ox, this.wy(st.H / 2), -1), `+${g} мусора`, '#ff6a6a', 22); }
    const lvl = 1 + Math.floor(w.lines / Math.round(cfg.perLevel));
    if (lvl > w.level) { w.level = lvl; lab.sfx.coin(); lab.popup(lab.v3(w.ox, this.wy(st.H - 3), -1), `Уровень ${lvl} — быстрее!`, '#7cf5a8', 26); }
    w.rows = [];
    this.checkDanger(lab, w);
  },
  // мусор поднимается снизу, когда ляжет камень; в каждом ряду одна дыра
  raiseGarbage(lab, w) {
    const st = lab.state, n = Math.min(w.pending, 8), gap = lab.randInt(0, st.W - 1);
    if (n <= 0) return;
    w.pending -= n;
    for (let r = 0; r < n; r++) {
      w.grid.unshift(w.grid[0].map((_, x) => {
        if (x === gap) return null;
        const m = st.src.stone.X.createInstance('мусор'); m.position.set(this.wx(w, x), this.wy(-1 - r), 0);
        return { m, k: 'X' };
      }));
      w.grid.pop().forEach(c => c && c.m.dispose());
    }
    lab.sfx.warn(); lab.shake(0.3);
    if (w.grid.slice(st.H).some(r => r.some(Boolean))) this.topOut(lab, w);
  },
  checkDanger(lab, w) { w.danger = w.grid.slice(lab.state.H - 6).some(r => r.some(Boolean)); },
  topOut(lab, w) {
    w.dead = true; lab.shake(0.8); lab.flash('#ff4d5e', 0.4); lab.sfx.explode();
    if (lab.state.wells.length > 1) lab.win(`Победил игрок ${w.i ? 1 : 2}`);
    else lab.gameOver('Стакан переполнен');
  },
  points(lab, w, n) { w.score += n; lab.score += n; },
  cycle(w) { return w.cyc.length >= 2 ? w.cyc.reduce((a, b) => a + b, 0) / w.cyc.length : 0; },
  settle(lab, w, dt) {
    const k = 1 - Math.exp(-dt * 16);
    w.grid.forEach((row, y) => {
      const ty = this.wy(y);
      row.forEach(c => { if (c && c.m.position.y !== ty) c.m.position.y = Math.abs(c.m.position.y - ty) < 0.01 ? ty : lab.lerp(c.m.position.y, ty, k); });
    });
    if (w.meter) { w.meter.setEnabled(w.pending > 0); w.meter.scaling.y = Math.max(0.01, w.pending); w.meter.position.y = this.BASE + w.pending / 2; }
  },

  tickWorld(lab, dt) {
    const st = lab.state, t = lab.t, m = st.mm, danger = st.wells.some(w => w.danger);
    st.clouds.forEach(o => { o.c.position.x += o.v * dt; if (o.c.position.x > 70) o.c.position.x = -70; });
    const lvl = Math.max(...st.wells.map(w => w.level));
    st.sky = BABYLON.Color3.Lerp(st.sky, lab.color(this.SKY[Math.min(lvl, 6) - 1]), dt);
    lab.scene.clearColor = st.sky.toColor4(); lab.scene.fogColor = st.sky;
    st.fx = st.fx.filter(f => {
      f.t += dt; const q = f.t / f.dur;
      f.m.scaling.x = Math.min(1.05, 0.1 + q * 2.5); f.m.visibility = 1 - q * q;
      if (q < 1) return true;
      f.m.dispose(); return false;
    });
    st.wells.forEach(w => { w.line.visibility = w.danger ? 0.55 + 0.45 * Math.sin(t * 9) : 0.25; });
    if (danger && (st.beat -= dt) <= 0) { st.beat = 0.7; lab.tone(70, 0.12, 'sine', 0.16); }
    m.vy -= 16 * dt; m.y += m.vy * dt;
    if (m.y < m.y0) { if (m.vy < -2) lab.pulse(m.node, 1.12, 0.12); m.y = m.y0; m.vy = 0; }
    m.node.position.y = m.y; m.node.rotation.z = danger ? Math.sin(t * 38) * 0.06 : 0;
  },
};
