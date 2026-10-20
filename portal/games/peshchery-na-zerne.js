// «Пещеры на зерне» — ремейк-донор урока 17 по мотивам Spelunky (Дерек Ю, 2008) и Minecraft (2011), оболочка «Лаб3D 1.0» (three.js).
// План.
// Фраза: спелеолог с фонарём спускается в пещеры Азиш-Тау; каждый раз пещера новая, а у друга с тем же зерном — та же самая.
// Ядро на 3 секунды: шаг в темноту → фонарь выхватывает кристалл → звон → летучая мышь срывается с потолка → вспышка фонаря (A) её глушит.
// Мир строит генератор по правилам: случайное блуждание, комнаты и коридоры, клеточный автомат, лабиринт, комнаты-шаблоны Spelunky.
// Зерно — число, из которого генератор берёт все случайности: одинаковое зерно — одинаковый мир. Зерно видно на экране крупно.
// Выбор: собирать кристаллы в боковых ходах или бежать к выходу; держать B — новый мир (−100), если этот не нравится.
// Угрозы: летучие мыши (видят в 7 м, вспышка их глушит), лава и шипы. Три жизни.
// Кривая партии: глубина 1 — простор и мало мышей, 2 — мышей больше, лава; 3 — тесно, шипы у кристаллов. Выход — светящийся спуск.
// Видно = правда: мышь перед броском пищит и краснеет глазами; лава светится и шипит; выход виден зелёным столбом.
// Уровни — данные: каждая глубина — карта символами (LEGEND ниже), генератор пишет её по зерну и отдаёт порталу через lab.level(i, карта);
// уровни гостей (lab.levels) играются вместо сгенерированных. Тепловая карта: lab.spot('death') — где кусали мыши и жгла лава.
// Спрятанная механика донора — генератор с гарантиями: все пещеры соединены ходами, выход в самой дальней клетке от старта,
// мыши не у старта, лава и шипы не на пути к выходу (ручка secret 0 — те же правила без гарантий: выход бывает замурован).
// Разбор игр жанра — docs/журнал/модуль-4.md, раздел урока 17.
// Лицо игры: тёмная пещера, тёплый круг фонаря, бирюзовые кристаллы, оранжевая лава; приёмы — кристаллы с ореолом, искры из-под ног,
// вспышка фонаря кольцом. Палитра: скала #4a3b52, пол #8a7a6a, кристаллы #5fe0ff, выход #7cf5a8, мыши #b49bff, лава #ff8a4c, спелеолог #ff9f1c.
// Вид сверху под углом: клетка — 2 м, X — вправо, Z — вниз по карте (строки), Y — вверх.
const GAME = {
  engine: 'three',
  title: 'Пещеры на зерне',
  subtitle: 'Спустись на три глубины пещер Азиш-Тау. Каждый раз новый мир — а с тем же зерном тот же.',
  donor: 'Spelunky и Minecraft',
  players: 1,
  controls: [
    { input: 'move4', text: 'идти' },
    { input: 'a', text: 'вспышка фонаря: глушит мышей рядом' },
    { input: 'b', text: 'держи — новый мир (−100)' },
  ],
  camera: { type: 'iso', tilt: 0.42, distance: 20 },
  field: { w: 24, h: 18 },
  sky: ['#07060c', '#1a1428'],
  fog: 0.014,
  accent: '#7cf5a8',
  scoreColor: '#5fe0ff',
  decisions: [
    'Чувство: «ещё разок!» — каждый спуск новый, и интересно, что за поворотом',
    'Честность: выход всегда достижим, мыши не у старта, лава не на пути к выходу',
    'Выбор: кристаллы в боковом ходе или прямо к выходу',
  ],
  config: {
    gen: { value: 2, min: 0, max: 4, step: 1, label: 'Правило генератора', restart: true, names: ['случайное блуждание', 'комнаты и коридоры', 'клеточный автомат', 'лабиринт', 'комнаты-шаблоны Spelunky'] },
    zerno: { value: 0, min: 0, max: 9999, step: 1, label: 'Зерно мира', restart: true, hint: '0 — новое зерно каждую партию; число — один и тот же мир у всех' },
    secret: { value: 1, min: 0, max: 1, step: 1, label: 'Спрятанная механика: генератор с гарантиями', restart: true, hint: '0 — без гарантий: пещеры не соединены, выход где попало, мыши у старта' },
    rooms: { value: 7, min: 3, max: 12, step: 1, label: 'Число комнат (комнаты и коридоры)', restart: true },
    twisty: { value: 0.5, min: 0, max: 1, step: 0.05, label: 'Извилистость ходов', restart: true },
    enemies: { value: 1, min: 0, max: 3, step: 0.25, label: 'Плотность мышей', restart: true },
    crystals: { value: 1, min: 0, max: 3, step: 0.25, label: 'Плотность кристаллов', restart: true },
    depths: { value: 3, min: 1, max: 5, step: 1, label: 'Глубин до победы', restart: true },
    race: { value: 0, min: 0, max: 1, step: 1, label: 'Гонка «Зерно дня»', restart: true, names: ['нет', 'да'], hint: 'Одна глубина: кто быстрее до выхода' },
    speed: { value: 6.5, min: 3, max: 12, step: 0.5, label: 'Скорость шага' },
    bat: { value: 3.4, min: 1, max: 7, step: 0.2, label: 'Скорость мыши' },
    lamp: { value: 13, min: 6, max: 24, step: 1, label: 'Свет фонаря, м' },
    lives: { value: 3, min: 1, max: 9, step: 1, label: 'Жизни' },
    limit: { value: 300, min: 60, max: 900, step: 30, label: 'Время на партию, с' },
  },
  presets: {
    'Новичок': { enemies: 0.5, lives: 5, lamp: 17, limit: 480 },
    'Без спрятанной механики': { secret: 0 },
    'Случайное блуждание': { gen: 0 },
    'Комнаты и коридоры': { gen: 1 },
    'Лабиринт': { gen: 3 },
    'Шаблоны Spelunky': { gen: 4 },
    'Много мышей': { enemies: 2.5 },
    'Зерно дня': { zerno: 2026, race: 1 },
  },
  notes: [
    'Зерно на экране: назови его другу — у него будет та же пещера.',
    'Держи B секунду — новый мир с новым зерном (−100 очков).',
    'Вспышка (A) раз в 2 секунды: мыши в 4 м падают и спят 3 секунды.',
  ],
  // легенда карты: символ → что в клетке (её же видит редактор уровней портала)
  LEGEND: { '#': 'скала', '.': 'пол', ' ': 'пол', '@': 'старт', 'E': 'выход вниз', '*': 'кристалл', 'b': 'летучая мышь', '!': 'шипы', '~': 'лава' },
  CELL: 2, W: 36, H: 24,
  GEN_NAMES: ['Случайное блуждание', 'Комнаты и коридоры', 'Клеточный автомат', 'Лабиринт', 'Комнаты-шаблоны'],

  /* ---------- генератор: те же правила, что в квизе портала «Найди правило генератора» ---------- */
  rng(seed) { let a = seed >>> 0; return () => { a = (a + 0x6D2B79F5) >>> 0; let t = a; t = Math.imul(t ^ (t >>> 15), t | 1); t ^= t + Math.imul(t ^ (t >>> 7), t | 61); return ((t ^ (t >>> 14)) >>> 0) / 4294967296; }; },
  generate(rule, seed, w, h, c) {
    const R = this.rng(seed), m = Array.from({ length: h }, () => Array(w).fill('#')), cl = (v, a, b) => Math.max(a, Math.min(b, v));
    const dig = (x, y) => { if (x > 0 && y > 0 && x < w - 1 && y < h - 1) m[y][x] = '.'; };
    if (rule === 0) { // копатель идёт куда попало; извилистость — как часто он меняет направление
      let x = w >> 1, y = h >> 1, dug = 0, d = [1, 0]; const need = Math.floor((w - 2) * (h - 2) * 0.42);
      for (let n = 0; n < 60000 && dug < need; n++) {
        if (m[y][x] === '#') { m[y][x] = '.'; dug++; }
        if (R() < 0.25 + c.twisty * 0.75) d = [[1, 0], [-1, 0], [0, 1], [0, -1]][Math.floor(R() * 4)];
        x = cl(x + d[0], 1, w - 2); y = cl(y + d[1], 1, h - 2);
      }
    } else if (rule === 1) { // комнаты и коридоры (Rogue, 1980)
      const rooms = [];
      for (let tries = 0; tries < 200 && rooms.length < c.rooms; tries++) {
        const rw = 3 + Math.floor(R() * 5), rh = 3 + Math.floor(R() * 3), rx = 1 + Math.floor(R() * (w - rw - 2)), ry = 1 + Math.floor(R() * (h - rh - 2));
        if (rooms.some(o => rx < o.x + o.w + 1 && rx + rw + 1 > o.x && ry < o.y + o.h + 1 && ry + rh + 1 > o.y)) continue;
        const prev = rooms[rooms.length - 1]; rooms.push({ x: rx, y: ry, w: rw, h: rh });
        for (let j = ry; j < ry + rh; j++) for (let i = rx; i < rx + rw; i++) dig(i, j);
        if (prev) { // коридор: прямо или с изгибами
          let ax = prev.x + (prev.w >> 1), ay = prev.y + (prev.h >> 1); const bx = rx + (rw >> 1), by = ry + (rh >> 1);
          let horiz = R() < 0.5;
          while (ax !== bx || ay !== by) {
            if (R() < c.twisty * 0.35) horiz = !horiz;
            if ((horiz && ax !== bx) || ay === by) ax += Math.sign(bx - ax); else ay += Math.sign(by - ay);
            dig(ax, ay);
          }
        }
      }
    } else if (rule === 2) { // клеточный автомат: шум и 4 сглаживания «стена, если вокруг 5+ стен» — круглые пещеры
      let g = Array.from({ length: h }, (_, j) => Array.from({ length: w }, (_, i) => (i === 0 || j === 0 || i === w - 1 || j === h - 1 || R() < 0.42 + c.twisty * 0.06 ? '#' : '.')));
      for (let k = 0; k < 4; k++) g = g.map((row, j) => row.map((ch, i) => { if (i === 0 || j === 0 || i === w - 1 || j === h - 1) return '#'; let n = 0; for (let dj = -1; dj <= 1; dj++) for (let di = -1; di <= 1; di++) if (g[j + dj][i + di] === '#') n++; return n >= 5 ? '#' : '.'; }));
      g.forEach((row, j) => row.forEach((ch, i) => { m[j][i] = ch; }));
    } else if (rule === 3) { // лабиринт: ход назад по сетке через клетку; извилистость — сколько стен снести для петель
      const st = [[1, 1]]; m[1][1] = '.';
      while (st.length) {
        const [x, y] = st[st.length - 1];
        const ns = [[2, 0], [-2, 0], [0, 2], [0, -2]].map(d => [x + d[0], y + d[1], d]).filter(([a, b]) => a > 0 && b > 0 && a < w - 1 && b < h - 1 && m[b][a] === '#');
        if (!ns.length) { st.pop(); continue; }
        const [a, b, d] = ns[Math.floor(R() * ns.length)];
        m[y + d[1] / 2][x + d[0] / 2] = '.'; m[b][a] = '.'; st.push([a, b]);
      }
      const loops = Math.floor((1 - c.twisty) * 40);
      for (let n = 0; n < loops; n++) { const x = 1 + Math.floor(R() * (w - 2)), y = 1 + Math.floor(R() * (h - 2)); if (m[y][x] === '#' && ((m[y][x - 1] === '.' && m[y][x + 1] === '.') || (m[y - 1][x] === '.' && m[y + 1][x] === '.'))) m[y][x] = '.'; }
    } else { // комнаты-шаблоны (Spelunky, 2008): сетка 4 × 3 комнат, путь сверху вниз, комнаты из готовых заготовок
      const CW = 9, CH = 8, T = [
        ['.........', '..##.##..', '.........', '...###...', '.........', '..#...#..', '.........', '.........'],
        ['.........', '.........', '.#.....#.', '.#.....#.', '.#.....#.', '.........', '...###...', '.........'],
        ['###...###', '#.......#', '#.#.#.#.#', '#.......#', '#.#.#.#.#', '#.......#', '###...###', '#########'],
        ['#########', '#.......#', '#.#####.#', '#.......#', '#.#####.#', '#.......#', '#.......#', '####.####'],
      ];
      let cx = Math.floor(R() * 4); const path = new Set();
      for (let cy = 0; cy < 3; cy++) { path.add(cx + ',' + cy); let steps = Math.floor(R() * 3); while (steps--) { cx = cl(cx + (R() < 0.5 ? -1 : 1), 0, 3); path.add(cx + ',' + cy); } }
      for (let cy = 0; cy < 3; cy++) for (let cx2 = 0; cx2 < 4; cx2++) {
        const t = path.has(cx2 + ',' + cy) ? T[Math.floor(R() * 2)] : T[2 + Math.floor(R() * 2)];
        for (let j = 0; j < CH; j++) for (let i = 0; i < CW; i++) { const X = cx2 * CW + i, Y = cy * CH + j; if (X > 0 && Y > 0 && X < w - 1 && Y < h - 1 && t[j][i] === '.') m[Y][X] = '.'; }
      }
    }
    return { m, R };
  },
  regions(m) {
    const h = m.length, w = m[0].length, id = m.map(r => r.map(() => -1)), out = [];
    for (let y = 0; y < h; y++) for (let x = 0; x < w; x++) if (m[y][x] !== '#' && id[y][x] < 0) {
      const cells = [[x, y]]; id[y][x] = out.length;
      for (let k = 0; k < cells.length; k++) { const [a, b] = cells[k]; for (const [dx, dy] of [[1, 0], [-1, 0], [0, 1], [0, -1]]) { const p = a + dx, q = b + dy; if (m[q] && m[q][p] && m[q][p] !== '#' && id[q][p] < 0) { id[q][p] = out.length; cells.push([p, q]); } } }
      out.push(cells);
    }
    return out;
  },
  bfs(m, from) {
    const h = m.length, w = m[0].length, d = m.map(r => r.map(() => -1)), q = [from]; d[from[1]][from[0]] = 0;
    for (let k = 0; k < q.length; k++) { const [a, b] = q[k]; for (const [dx, dy] of [[1, 0], [-1, 0], [0, 1], [0, -1]]) { const p = a + dx, r = b + dy; if (p >= 0 && r >= 0 && p < w && r < h && m[r][p] !== '#' && m[r][p] !== '~' && d[r][p] < 0) { d[r][p] = d[b][a] + 1; q.push([p, r]); } } }
    return d;
  },
  // мир глубины: правило + зерно → карта символами. Гарантии (secret): всё соединено, выход дальше всех, мыши не у старта, путь чистый
  world(seed, depth, c) {
    const W = this.W, H = this.H, rule = Math.round(c.gen), sure = c.secret > 0.5;
    const { m, R } = this.generate(rule, seed * 31 + depth * 7919, W, H, c);
    const tunnels = [];
    let regs = this.regions(m).sort((a, b) => b.length - a.length);
    if (!regs.length) { for (let y = 2; y < H - 2; y++) for (let x = 2; x < W - 2; x++) m[y][x] = '.'; regs = this.regions(m); }
    if (sure) { // соединяем каждую пещеру с главной коротким ходом
      const main = new Set(regs[0].map(p => p.join(',')));
      for (const reg of regs.slice(1)) {
        let best = null, bd = 1e9;
        for (const a of reg) for (let n = 0; n < regs[0].length; n += 3) { const b = regs[0][n], d = Math.abs(a[0] - b[0]) + Math.abs(a[1] - b[1]); if (d < bd) { bd = d; best = [a, b]; } }
        if (!best) continue;
        let [x, y] = best[0]; const [tx, ty] = best[1], cells = [];
        while (x !== tx || y !== ty) { if (x !== tx) x += Math.sign(tx - x); else y += Math.sign(ty - y); if (m[y][x] === '#') { m[y][x] = '.'; cells.push([x, y]); } }
        if (cells.length) tunnels.push(cells);
        reg.forEach(p => main.add(p.join(',')));
      }
    }
    const floor = []; m.forEach((r, y) => r.forEach((ch, x) => { if (ch !== '#') floor.push([x, y]); }));
    const pick = arr => arr[Math.floor(R() * arr.length)];
    // старт: у края карты, где больше всего пола вокруг (в первой большой пещере)
    const startPool = sure ? regs[0] : floor;
    const start = startPool.slice().sort((a, b) => (a[0] + a[1] * 0.2) - (b[0] + b[1] * 0.2))[Math.floor(R() * Math.min(6, startPool.length))];
    const dist = this.bfs(m, start);
    let exit;
    if (sure) { let bd = -1; for (const [x, y] of floor) if (dist[y][x] > bd) { bd = dist[y][x]; exit = [x, y]; } }
    else exit = pick(floor.filter(p => p !== start));
    // путь старт → выход: на нём не ставим лаву и шипы
    const onPath = new Set();
    if (sure) { let [x, y] = exit; while (dist[y][x] > 0) { onPath.add(x + ',' + y); for (const [dx, dy] of [[1, 0], [-1, 0], [0, 1], [0, -1]]) { const p = x + dx, q = y + dy; if (m[q] && dist[q] && dist[q][p] === dist[y][x] - 1) { x = p; y = q; break; } } } }
    const free = floor.filter(([x, y]) => !(x === start[0] && y === start[1]) && !(x === exit[0] && y === exit[1]));
    const shuffled = free.map(p => [R(), p]).sort((a, b) => a[0] - b[0]).map(x => x[1]);
    const take = (n, ok) => { const out = []; for (const p of shuffled) { if (out.length >= n) break; if (m[p[1]][p[0]] === '.' && ok(p)) { out.push(p); } } return out; };
    const far = ([x, y]) => !sure || dist[y][x] > 7;
    const offPath = ([x, y]) => !sure || !onPath.has(x + ',' + y);
    const nCr = Math.round((6 + depth * 2) * c.crystals), nBat = Math.round((2 + depth * 2) * c.enemies), nLava = depth >= 2 ? Math.round(3 + depth * 2) : 0, nSpike = depth >= 3 ? 6 : depth === 2 ? 2 : 0;
    take(nCr, () => true).forEach(([x, y]) => { m[y][x] = '*'; });
    take(nBat, far).forEach(([x, y]) => { m[y][x] = 'b'; });
    take(nLava, p => offPath(p) && far(p)).forEach(([x, y]) => { m[y][x] = '~'; });
    take(nSpike, p => offPath(p) && far(p)).forEach(([x, y]) => { m[y][x] = '!'; });
    m[start[1]][start[0]] = '@'; m[exit[1]][exit[0]] = 'E';
    return { map: m.map(r => r.join('')).join('\n'), tunnels, reach: dist[exit[1]][exit[0]] >= 0, rule };
  },

  start(lab, scene) {
    const st = lab.state, c = lab.cfg;
    st.seed = Math.round(c.zerno) > 0 ? Math.round(c.zerno) : (lab.seed % 9000) + 1000;
    st.race = Math.round(c.race) > 0;
    const n = st.race ? 1 : Math.round(c.depths);
    Object.assign(st, { li: -1, depth: 0, rolls: 0, holdB: 0, flashT: -9, chain: 0, chainT: -9, done: false, bites: 0, got: 0, times: [], levelT0: 0, pass: 0, safe: null, tunnelsUsed: 0 });
    st.gen = [];
    const own = [];
    for (let i = 0; i < n; i++) { const w = this.world(st.seed, i + 1, c); st.gen.push(w); own.push({ name: `Глубина ${i + 1} · зерно ${st.seed}`, map: w.map }); }
    st.list = lab.levels(own, this.LEGEND);
    lab.light.hemi.intensity = 0.6; lab.light.sun.intensity = 0.75;
    st.hero = this.buildHero(lab);
    lab.hero(st.hero.node); lab.follow(st.hero.node, { lag: 0.12 });
    st.lamp = new THREE.PointLight('#ffd9a0', 140, c.lamp, 1.2); st.lamp.position.set(0, 4.6, 0.6); st.hero.node.add(st.lamp);
    this.enter(lab, 0);
  },

  update(lab, dt) {
    const st = lab.state, c = lab.cfg, h = st.hero, p = lab.p1, L = st.L;
    st.lamp.distance = c.lamp;
    this.tick(lab, L, dt);
    if (st.pass > 0) { st.pass -= dt; h.walk = lab.damp(h.walk, 0, 6, dt); this.animHero(lab, h, dt); if (st.pass <= 0) { if (st.li + 1 < st.list.length) this.enter(lab, st.li + 1); else this.finish(lab); } return; }
    // ходьба по клеткам с соскальзыванием по стенам
    const ax = p.x, az = -p.y, len = Math.hypot(ax, az) || 1, k = Math.min(1, Math.hypot(ax, az));
    h.vx = lab.damp(h.vx, ax / len * k * c.speed, 12, dt); h.vz = lab.damp(h.vz, az / len * k * c.speed, 12, dt);
    if (!this.solidAt(L, h.x + h.vx * dt, h.z)) h.x += h.vx * dt; else h.vx = 0;
    if (!this.solidAt(L, h.x, h.z + h.vz * dt)) h.z += h.vz * dt; else h.vz = 0;
    if (Math.hypot(h.vx, h.vz) > 0.5) h.yaw = Math.atan2(h.vx, h.vz);
    h.walk = lab.damp(h.walk, Math.hypot(h.vx, h.vz) / c.speed, 10, dt);
    if (p.pressed.a && lab.t - st.flashT > 2) this.flash(lab, L);
    st.holdB = p.b ? st.holdB + dt : 0;
    if (st.holdB > 0.9) { st.holdB = -99; this.reroll(lab); return; }
    this.touch(lab, L, h);
    this.bats(lab, L, dt);
    this.animHero(lab, h, dt);
    const [cx, cy] = this.toCell(L, h.x, h.z); lab.spot('where', cx, cy);
    if (lab.t > c.limit && !st.done) { st.done = true; this.stats(lab); lab.gameOver(st.race ? 'Время вышло: выход не найден' : `Время вышло на глубине ${st.li + 1}`); }
    this.hud(lab, L);
  },

  /* ---------- глубина: строим из карты ---------- */
  parse(map) {
    const rows = String(map || '').replace(/\r/g, '').split('\n'), W = Math.max(6, ...rows.map(r => r.length)), H = Math.max(5, rows.length);
    return { g: Array.from({ length: H }, (_, r) => (rows[r] || '').padEnd(W, '#').split('')), W, H };
  },
  cellAt(L, x, y) { return y < 0 || x < 0 || y >= L.H || x >= L.W ? '#' : L.g[y][x]; },
  toCell(L, x, z) { return [x / this.CELL + L.W / 2, z / this.CELL + L.H / 2]; },
  toWorld(L, x, y) { return [(x + 0.5 - L.W / 2) * this.CELL, (y + 0.5 - L.H / 2) * this.CELL]; },
  solidAt(L, x, z) {
    const R = 0.42;
    for (const [ax, az] of [[-R, -R], [R, -R], [-R, R], [R, R]]) { const [cx, cy] = this.toCell(L, x + ax, z + az); if (this.cellAt(L, Math.floor(cx), Math.floor(cy)) === '#') return true; }
    return false;
  },
  enter(lab, i) {
    const st = lab.state, h = st.hero;
    if (st.L) { st.L.root.traverse(o => { if (o.geometry) o.geometry.dispose(); }); st.L.root.parent.remove(st.L.root); }
    st.li = i;
    const lv = st.list[i], gen = !lv.guest && st.gen[i] ? st.gen[i] : null;
    st.L = this.build(lab, lv.map, lv.guest || null, gen);
    lab.level(i, lv.map);
    const [x, z] = this.toWorld(st.L, st.L.start[0], st.L.start[1]);
    Object.assign(h, { x, z, vx: 0, vz: 0, walk: 0 }); st.safe = [x, z];
    this.animHero(lab, h, 0);
    st.levelT0 = lab.t;
    lab.hud('lvl', `Глубина ${i + 1} из ${st.list.length}` + (lv.guest ? ` · уровень гостя ${lv.guest}` : ` · ${this.GEN_NAMES[Math.round(lab.cfg.gen)] || ''}`), { color: '#7cf5a8', size: 18 });
    lab.after(3, () => { if (lab.state === st && st.li === i) lab.hud('lvl', null); });
  },
  build(lab, map, guest, gen) {
    const T = THREE, C = this.CELL, { g, W, H } = this.parse(map);
    const L = { g, W, H, guest, bats: [], crystals: [], lava: [], spikes: [], start: null, exit: null, tunnel: new Map(), used: new Set() };
    const root = L.root = lab.group({ at: [0, 0, 0] }), R = (a, b) => lab.rand(a, b);
    const all = ch => { const out = []; g.forEach((row, y) => row.forEach((x, k) => { if (x === ch) out.push([k, y]); })); return out; };
    L.start = all('@')[0] || all('.')[0] || [1, 1]; L.exit = all('E')[0] || null;
    if (gen) gen.tunnels.forEach((cells, n) => cells.forEach(([x, y]) => L.tunnel.set(x + ',' + y, n)));
    lab.box(W * C + 30, 0.4, H * C + 30, '#2a2230', { at: [0, -0.2, 0], parent: root });
    // пол: плитки чуть разного тона; ходы, прорытые гарантией, — того же цвета (честная гарантия незаметна)
    const floor = []; g.forEach((row, y) => row.forEach((ch, x) => { if (ch !== '#') floor.push([x, y]); }));
    const fm = lab.instances(new T.BoxGeometry(C, 0.1, C), lab.mat('#8a7a6a', { rough: 1 }), floor.length, { parent: root });
    floor.forEach(([x, y], n) => { const [X, Z] = this.toWorld(L, x, y); lab.place(fm, n, [X, 0.05, Z], { color: lab.pick(['#a8937c', '#9c8872', '#b09c84', '#968470']) }); });
    lab.noShadow(fm);
    // скала: все клетки # внутри карты одной пачкой, ниже у пола и выше в глубине
    const rock = []; g.forEach((row, y) => row.forEach((ch, x) => { if (ch === '#') rock.push([x, y]); }));
    const rm = lab.instances(new T.BoxGeometry(C, 1, C), lab.mat('#5a4a63', { rough: 0.95 }), rock.length, { parent: root });
    rock.forEach(([x, y], n) => {
      let open = 0; for (let dy = -1; dy <= 1; dy++) for (let dx = -1; dx <= 1; dx++) if (this.cellAt(L, x + dx, y + dy) !== '#') open++;
      const hh = open ? R(1.3, 1.9) : R(2.0, 2.4), [X, Z] = this.toWorld(L, x, y);
      lab.place(rm, n, [X, hh / 2, Z], { scale: [1, hh, 1], color: lab.pick(['#5a4a63', '#62526b', '#53455c', '#6a5a72']) });
    });
    // сталагмиты у стен — жизнь без смысла
    const deco = floor.filter(([x, y]) => [[1, 0], [-1, 0], [0, 1], [0, -1]].some(([a, b]) => this.cellAt(L, x + a, y + b) === '#') && lab.chance(0.12) && g[y][x] === '.');
    if (deco.length) { const dm = lab.instances(new T.ConeGeometry(0.22, 1, 5).translate(0, 0.5, 0), lab.mat('#6a5a72'), deco.length, { parent: root }); deco.forEach(([x, y], n) => { const [X, Z] = this.toWorld(L, x, y); lab.place(dm, n, [X + R(-0.6, 0.6), 0, Z + R(-0.6, 0.6)], { scale: [1, R(0.6, 1.6), 1] }); }); }
    // кристаллы
    const cr = all('*');
    if (cr.length) {
      L.crMesh = lab.instances(new T.OctahedronGeometry(0.32, 0), lab.mat('#5fe0ff', { glow: 1.4 }), cr.length, { parent: root, shadow: false });
      cr.forEach(([x, y], n) => { const [X, Z] = this.toWorld(L, x, y); L.crystals.push({ x: X, z: Z, n, got: false, ph: R(0, 6.3) }); });
    }
    // лава и шипы
    const lv = all('~');
    if (lv.length) { const m = lab.instances(new T.BoxGeometry(C * 0.96, 0.12, C * 0.96), lab.mat('#ff8a4c', { glow: 1.1 }), lv.length, { parent: root, shadow: false }); lv.forEach(([x, y], n) => { const [X, Z] = this.toWorld(L, x, y); lab.place(m, n, [X, 0.08, Z]); L.lava.push({ x: X, z: Z }); }); }
    const sp = all('!');
    if (sp.length) { const m = lab.instances(new T.ConeGeometry(0.16, 0.6, 4).translate(0, 0.3, 0), lab.mat('#c9c2d6', { shiny: true }), sp.length * 4, { parent: root }); sp.forEach(([x, y], n) => { const [X, Z] = this.toWorld(L, x, y); for (let k = 0; k < 4; k++) lab.place(m, n * 4 + k, [X + (k % 2 ? 0.45 : -0.45), 0, Z + (k > 1 ? 0.45 : -0.45)]); L.spikes.push({ x: X, z: Z }); }); }
    // выход: светящийся спуск и зелёный столб
    if (L.exit) {
      const [X, Z] = this.toWorld(L, L.exit[0], L.exit[1]);
      lab.cyl(0.85, 0.85, 0.12, lab.mat('#0b2a1c'), { at: [X, 0.12, Z], parent: root, sides: 10 });
      L.exitRing = lab.mesh(new T.TorusGeometry(0.85, 0.08, 6, 20), lab.mat('#7cf5a8', { glow: 1.6 }), { at: [X, 0.2, Z], rot: [Math.PI / 2, 0, 0], parent: root, shadow: false });
      L.beam = lab.cyl(0.5, 0.75, 10, lab.mat('#7cf5a8', { alpha: 0.18, unlit: true, add: true }), { at: [X, 5, Z], parent: root, shadow: false, sides: 10 });
      L.exitW = { x: X, z: Z };
    }
    // летучие мыши: тело, крылья — пачками
    const bt = all('b');
    if (bt.length) {
      L.batBody = lab.instances(new T.IcosahedronGeometry(0.28, 0), lab.mat('#b49bff'), bt.length, { parent: root });
      L.batWing = lab.instances(new T.BoxGeometry(0.62, 0.05, 0.3), lab.mat('#7a5fc0'), bt.length * 2, { parent: root });
      L.batEye = lab.instances(new T.IcosahedronGeometry(0.07, 0), lab.mat('#ff5d6e', { glow: 1.5 }), bt.length, { parent: root, shadow: false });
      bt.forEach(([x, y], n) => { const [X, Z] = this.toWorld(L, x, y); L.bats.push({ n, x: X, z: Z, hx: X, hz: Z, y: 2.2, ph: R(0, 6.3), stun: 0, alert: 0 }); });
    }
    return L;
  },

  /* ---------- мир живёт ---------- */
  tick(lab, L, dt) {
    const t = lab.t;
    for (const o of L.crystals) if (!o.got) lab.place(L.crMesh, o.n, [o.x, 0.7 + Math.sin(t * 2 + o.ph) * 0.12, o.z], { rot: t + o.ph });
    if (L.exitRing) { L.exitRing.rotation.z = t; L.beam.scale.set(1 + Math.sin(t * 3) * 0.08, 1, 1 + Math.sin(t * 3) * 0.08); }
  },
  bats(lab, L, dt) {
    const st = lab.state, c = lab.cfg, h = st.hero, t = lab.t;
    for (const b of L.bats) {
      const d = Math.hypot(h.x - b.x, h.z - b.z);
      if (b.stun > 0) { b.stun -= dt; b.y = lab.damp(b.y, 0.3, 8, dt); }
      else {
        b.y = lab.damp(b.y, 1.6 + Math.sin(t * 6 + b.ph) * 0.25, 4, dt);
        if (d < 7) {
          if (b.alert <= 0) { b.alert = 0.5; lab.tone(1800, 0.08, 'square', 0.03, 2400); }
          b.alert -= dt;
          if (b.alert < 0.25) { const sp = c.bat * (1 + st.li * 0.12); b.x += (h.x - b.x) / Math.max(0.1, d) * sp * dt; b.z += (h.z - b.z) / Math.max(0.1, d) * sp * dt; }
        } else { b.alert = 0; b.x = lab.damp(b.x, b.hx + Math.sin(t * 0.9 + b.ph) * 1.6, 2, dt); b.z = lab.damp(b.z, b.hz + Math.cos(t * 0.7 + b.ph) * 1.6, 2, dt); }
        if (d < 0.8 && lab.hurt(h.node, 'Летучая мышь укусила!')) { this.bite(lab, L, h); b.stun = 1.2; }
      }
      const flap = b.stun > 0 ? 0 : Math.sin(t * 22 + b.ph) * 0.7, yaw = Math.atan2(h.x - b.x, h.z - b.z);
      lab.place(L.batBody, b.n, [b.x, b.y, b.z]);
      lab.place(L.batWing, b.n * 2, [b.x - 0.4 * Math.cos(yaw), b.y, b.z + 0.4 * Math.sin(yaw)], { rot: [0, yaw, flap] });
      lab.place(L.batWing, b.n * 2 + 1, [b.x + 0.4 * Math.cos(yaw), b.y, b.z - 0.4 * Math.sin(yaw)], { rot: [0, yaw, -flap] });
      lab.place(L.batEye, b.n, [b.x + Math.sin(yaw) * 0.25, b.y + 0.08, b.z + Math.cos(yaw) * 0.25], { scale: b.alert > 0 && b.stun <= 0 ? 1.6 : 1 });
    }
  },
  bite(lab, L, h) {
    const st = lab.state, [cx, cy] = this.toCell(L, h.x, h.z);
    lab.spot('death', cx, cy); st.bites++; lab.count('укусы');
  },
  flash(lab, L) {
    const st = lab.state, h = st.hero;
    st.flashT = lab.t; lab.count('вспышки');
    lab.ring([h.x, 0.2, h.z], { color: '#ffe08a', radius: 4.5, life: 0.5 }); lab.flash('#fff3d0', 0.15); lab.noise(0.2, 0.06, 3000);
    for (const b of L.bats) if (b.stun <= 0 && Math.hypot(h.x - b.x, h.z - b.z) < 4.5) { b.stun = 3; lab.burst([b.x, b.y, b.z], { count: 8, colors: ['#b49bff', '#ffffff'], speed: 2, size: 0.1 }); lab.addScore(20, [b.x, b.y + 0.6, b.z], '#d8c8ff'); lab.count('мыши оглушены'); }
  },
  touch(lab, L, h) {
    const st = lab.state, c = lab.cfg, [cx, cy] = this.toCell(L, h.x, h.z), key = Math.floor(cx) + ',' + Math.floor(cy), ch = this.cellAt(L, Math.floor(cx), Math.floor(cy));
    // ход, прорытый гарантией генератора: здесь бы пещера не соединилась
    if (L.tunnel.has(key) && !L.used.has(L.tunnel.get(key))) { L.used.add(L.tunnel.get(key)); st.tunnelsUsed++; lab.count('_secret'); }
    for (const o of L.crystals) if (!o.got && Math.hypot(o.x - h.x, o.z - h.z) < 1.2) {
      o.got = true; lab.place(L.crMesh, o.n, [o.x, -5, o.z], { scale: 0.001 }); st.got++;
      st.chain = lab.t - st.chainT < 3 ? st.chain + 1 : 0; st.chainT = lab.t;
      lab.addScore(50 + st.chain * 10, [o.x, 1.2, o.z], '#5fe0ff'); lab.tone(880 * lab.pitch(st.chain), 0.12, 'triangle', 0.07);
      lab.burst([o.x, 0.8, o.z], { count: 10, colors: ['#5fe0ff', '#e0fbff'], speed: 3, up: 2, size: 0.1 }); lab.count('кристаллы');
      if (c.secret > 0.5) lab.count('_secret');
    }
    const hot = (ch === '~' && 'Лава!') || (ch === '!' && 'Шипы!');
    if (hot) {
      if (lab.hurt(h.node, hot)) { this.bite(lab, L, h); lab.burst([h.x, 0.4, h.z], { count: 14, colors: ch === '~' ? ['#ff8a4c', '#ffd23f'] : ['#ffffff', '#c9c2d6'], speed: 3, up: 3, size: 0.12 }); }
      if (st.safe) { h.x = st.safe[0]; h.z = st.safe[1]; h.vx = h.vz = 0; }
    } else if (lab.t % 0.3 < lab.dt) st.safe = [h.x, h.z];
    if (L.exitW && Math.hypot(L.exitW.x - h.x, L.exitW.z - h.z) < 1.1) {
      const sec = lab.t - st.levelT0; st.times.push(sec); lab.clear({ time: sec });
      lab.addScore(st.race ? Math.max(100, Math.round(3000 - sec * 20)) : 300 + Math.max(0, Math.round((60 - sec) * 5)), [L.exitW.x, 2, L.exitW.z], '#7cf5a8');
      lab.sfx.win(); lab.flash('#7cf5a8', 0.3); lab.ring([L.exitW.x, 0.2, L.exitW.z], { color: '#7cf5a8', radius: 6, life: 0.8 });
      lab.popup([L.exitW.x, 3, L.exitW.z], st.race ? `Выход за ${sec.toFixed(1)} с` : `Глубина ${st.li + 1} пройдена`, '#7cf5a8', 22);
      lab.count('глубины'); L.exitW = null; st.pass = 1.2;
    }
  },
  reroll(lab) {
    const st = lab.state, c = lab.cfg;
    if (st.L.guest) return;
    st.rolls++; lab.count('перебросы'); lab.addScore(-100, [st.hero.x, 2, st.hero.z], '#ff8a8a');
    const seed = (st.seed * 13 + st.rolls * 101) % 9000 + 1000, w = this.world(seed, st.li + 1, c);
    st.gen[st.li] = w; st.list[st.li] = Object.assign({}, st.list[st.li], { name: `Глубина ${st.li + 1} · зерно ${seed}`, map: w.map });
    st.seedNow = seed; lab.sfx.whoosh(); lab.flash('#120e1c', 0.6);
    this.enter(lab, st.li);
  },
  finish(lab) {
    const st = lab.state; st.done = true; this.stats(lab);
    lab.win(st.race ? `Выход за ${st.times[0].toFixed(1)} с · зерно ${st.seed}` : `Все глубины! Кристаллов ${st.got} · зерно ${st.seed}`);
  },
  stats(lab) {
    const st = lab.state;
    lab.stat('секунд на глубину', st.times.length ? Math.round(st.times.reduce((a, b) => a + b, 0) / st.times.length) : Math.round(lab.t - st.levelT0));
    lab.stat('глубин', st.times.length); lab.stat('кристаллов', st.got); lab.stat('зерно', st.seed);
  },

  /* ---------- спелеолог ---------- */
  buildHero(lab) {
    const node = lab.group({ at: [0, 0, 0] });
    lab.box(0.6, 0.7, 0.4, '#ff9f1c', { at: [0, 0.75, 0], parent: node, round: 0.1 });
    lab.ball(0.26, '#f2c7a0', { at: [0, 1.35, 0], parent: node });
    lab.mesh(new THREE.SphereGeometry(0.3, 10, 6, 0, Math.PI * 2, 0, Math.PI * 0.5), '#ffd23f', { at: [0, 1.42, 0], parent: node });
    lab.ball(0.07, lab.mat('#fff3b0', { glow: 0.7 }), { at: [0, 1.55, 0.27], parent: node, shadow: false });
    const legL = lab.box(0.18, 0.42, 0.18, '#3b3f5c', { at: [-0.15, 0.21, 0], parent: node });
    const legR = lab.box(0.18, 0.42, 0.18, '#3b3f5c', { at: [0.15, 0.21, 0], parent: node });
    lab.box(0.4, 0.45, 0.2, '#6a4a32', { at: [0, 0.85, -0.3], parent: node, round: 0.05 });
    return { node, legL, legR, x: 0, z: 0, vx: 0, vz: 0, yaw: 0, walk: 0, ph: 0 };
  },
  animHero(lab, h, dt) {
    h.ph += dt * (3 + h.walk * 9);
    const sw = Math.sin(h.ph) * 0.6 * h.walk;
    h.node.position.set(h.x, Math.abs(Math.sin(h.ph)) * 0.08 * h.walk, h.z);
    h.node.rotation.y = h.yaw; h.node.scale.setScalar(1.45); h.legL.rotation.x = sw; h.legR.rotation.x = -sw;
    h.node.visible = !lab.blink();
  },
  hud(lab, L) {
    const st = lab.state, c = lab.cfg;
    lab.hud('seed', `🌱 Зерно ${st.seedNow || st.seed}`, { color: '#7cf5a8', size: 22 });
    lab.hud('info', st.race ? `Гонка «Зерно дня» · ⏱ ${(lab.t - st.levelT0).toFixed(1)} с` : `Глубина ${st.li + 1} из ${st.list.length} · 💎 ${st.got} · ⏱ ${Math.max(0, Math.round(c.limit - lab.t))} с`, { color: '#ffffff', size: 15 });
    lab.hud('keys', st.holdB > 0.05 ? `Новый мир через ${Math.max(0, 0.9 - st.holdB).toFixed(1)} с…` : 'A — вспышка · держи B — новый мир (−100)', { color: '#bfe9ff', size: 13 });
  },

  overNote(lab) {
    const st = lab.state;
    if (!st.done) this.stats(lab);
    return [
      `Зерно ${st.seed}: назови его другу — у него будет та же пещера`,
      st.race ? (st.times.length ? `Выход за ${st.times[0].toFixed(1)} с` : 'До выхода не дошёл') : `Глубин ${st.times.length} из ${st.list.length} · кристаллов ${st.got} · новых миров ${st.rolls}`,
      lab.cfg.secret > 0 ? `Гарантия генератора: ходов, прорытых между пещерами, прошёл ${st.tunnelsUsed}. Сравни с «Без спрятанной механики».` : 'Без гарантий: выход бывает замурован, мыши у самого старта. Держи B — новый мир.',
    ];
  },
};
