// «Туманное плато» — ремейк-донор урока 16 по мотивам Journey (thatgamecompany, 2012), оболочка «Лаб3D 1.0» (three.js).
// План.
// Фраза: путница с фонарём идёт сквозь туман плато Лаго-Наки к свету на вершине; по дороге — огоньки-крошки, каменный великан и три спрятанных секрета.
// Ядро на 3 секунды: шаг в туман → впереди вспыхивает огонёк → подобрала, звенит выше → за скалой открылся простор, а над ним столб света.
// Цель без единой стрелки: столб света на вершине виден сквозь любой туман, и игрок сам понимает, куда идти.
// Выбор: прямо к свету или свернуть за скалу — там может быть секрет (+200), но уходит время.
// Угроза мягкая — время партии и туман: заблудился — время уходит. Смертей нет, как в Journey.
// Кривая партии: плато 1 — тропа ведёт, простор после ущелья; 2 — лес, тропа петляет, ведёт ориентир; 3 — каменные гряды, выбор прохода.
// Видно = правда: огоньки-крошки лежат только на тропе, к вершине; секреты мерцают, если позвать (A) рядом.
// Уровни — данные: каждое плато — текстовая карта 36 × 26 (LEGEND ниже), клетка 2 м; свои уровни и уровни гостей игра берёт через lab.levels.
// Тепловая карта следов: lab.spot('where') каждые полсекунды и lab.spot('secret') у находки — портал рисует автору, куда игроки шли на самом деле.
// Спрятанная механика донора — внимание игрока: свет на вершине, огоньки-крошки, ориентир и светлая тропа ведут взгляд
// (ручка secret 0 — тот же мир без света, крошек, великана и тропы). Разбор игр жанра — docs/журнал/модуль-4.md, раздел урока 16.
// Лицо игры: сиреневый утренний туман, тёплый столб света, жёлтый дождевик путницы; приёмы — огоньки с ореолом, зов кольцом, вспышка секрета.
// Палитра: трава #4f8f4a, тропа #d9c27a, скалы #6b7184, пихты #2d6b3f, вода #3a7bd5, огоньки #ffd23f, секреты #b49bff, свет #fff3b0, путница #ffc93c.
// Вид из-за спины: X — вправо, Z — вниз по карте (строки), Y — вверх; строка 0 карты — дальний край плато (−Z).
const GAME = {
  engine: 'three',
  title: 'Туманное плато',
  subtitle: 'Иди сквозь туман к свету на вершине. Никаких стрелок — мир сам покажет дорогу.',
  donor: 'Journey',
  players: 1,
  controls: [
    { input: 'move4', text: 'идти (↑ ↓) и поворачивать (← →)' },
    { input: 'a', text: 'позвать: огоньки вспыхнут, секрет рядом замерцает' },
  ],
  camera: { type: 'behind' },
  field: { w: 30, h: 30 },
  sky: ['#7c8fc9', '#e3d3e6'],
  fog: 0.035,
  accent: '#ffe08a',
  scoreColor: '#ffe08a',
  lives: 0,
  decisions: [
    'Чувство: «меня тянет туда» — свет и огоньки зовут без единого слова',
    'Честность: столб света виден сквозь любой туман, огоньки лежат только на верном пути',
    'Выбор: прямо к свету или свернуть за скалу, где может быть секрет',
  ],
  config: {
    secret: { value: 1, min: 0, max: 1, step: 1, label: 'Спрятанная механика: мир ведёт взгляд', restart: true, hint: '0 — тот же мир без света на вершине, огоньков, великана и светлой тропы' },
    fog: { value: 0.035, min: 0.005, max: 0.1, step: 0.005, label: 'Туман: плотность' },
    beacon: { value: 1.2, min: 0, max: 2.5, step: 0.1, label: 'Яркость света на вершине' },
    crumbs: { value: 3, min: 0, max: 3, step: 1, label: 'Огоньки-крошки', restart: true, names: ['нет', 'редкие', 'через один', 'все'] },
    landmark: { value: 1, min: 0, max: 1, step: 1, label: 'Ориентир: каменный великан', restart: true, names: ['нет', 'есть'] },
    compass: { value: 0, min: 0, max: 1, step: 1, label: 'Компас на экране', names: ['нет', 'есть'] },
    sunset: { value: 0, min: 0, max: 1, step: 1, label: 'Свет меняется по пути: утро → закат', names: ['нет', 'да'] },
    lift: { value: 0, min: 0, max: 1, step: 1, label: 'Туман рассеивается от каждой находки', names: ['нет', 'да'] },
    hunt: { value: 0, min: 0, max: 1, step: 1, label: 'Охота за секретами на время', restart: true, names: ['нет', 'да'], hint: 'Одно плато: кто найдёт три секрета быстрее' },
    kvest: { value: 0, min: 0, max: 1, step: 1, label: 'Урок-квест: три плато — одна большая карта класса', restart: true, names: ['нет', 'да'], hint: 'Секреты общие: что нашёл одноклассник, отмечено и у тебя (урок 16)' },
    speed: { value: 6, min: 2, max: 12, step: 0.5, label: 'Скорость шага, м/с' },
    turn: { value: 2.6, min: 1, max: 5, step: 0.1, label: 'Скорость поворота' },
    limit: { value: 360, min: 60, max: 900, step: 30, label: 'Время на партию, с' },
  },
  presets: {
    'Новичок': { compass: 1, fog: 0.025, limit: 600, speed: 6.5 },
    'Без спрятанной механики': { secret: 0 },
    'Густой туман': { fog: 0.07 },
    'Без огоньков': { crumbs: 0 },
    'Без ориентира': { landmark: 0 },
    'Компас': { compass: 1 },
    'Закат по пути': { sunset: 1 },
    'Туман уходит': { lift: 1, fog: 0.06 },
    'Охота за секретами': { hunt: 1 },
  },
  notes: [
    'Смертей нет: заблудиться — значит потерять время, как в Journey.',
    'Зов (A) раз в секунду: огоньки рядом вспыхивают, секрет в 12 м мерцает фиолетовым.',
    'Дошла до света — плато пройдено: +500 и бонус за время.',
  ],
  // легенда карты: символ → что в клетке (её же видит редактор уровней портала)
  LEGEND: {
    '#': 'скала', 'T': 'пихта', '~': 'озеро', '.': 'трава', ',': 'тропа', 'o': 'огонёк-крошка', 'A': 'свет на вершине (финиш)',
    '@': 'старт', 'S': 'секрет', 'L': 'ориентир: каменный великан', ' ': 'трава',
  },
  CELL: 2,
  // карты плато 36 × 26: дорожка и секреты проверены поиском в ширину — вершина и все секреты достижимы со старта
  MAPS: [
    ['Утро на плато', [
      '####################################',
      '#############...TT..T...############',
      '#############.....A.....############',
      '#############S...To...T.############',
      '#############T....,.#...############',
      '#...#T.....T......,T....T..T.T.....#',
      '#...T.........##..o..##..T.#.......#',
      '#T#...T....#..##..,..##............#',
      '#...........#.##..o..##.......TT...#',
      '#.............##.,...##T......S.T..#',
      '#..T..T....T..##.,...##.T..#.......#',
      '#.......#.....,o,o...##.........T#.#',
      '#....T..T.,,o,.....#T..T...T.##..T.#',
      '#.........,..~~~~~~~~~~T.......T...#',
      '#..TT....#,T.~~~~~~~~~~.T..........#',
      '#T........o..~~~~~~~~~~............#',
      '#T.T......,.#~~~~~~~~~~.#.....TT...#',
      '#.........,T.~~~~~~~~~~T...........#',
      '#.T.......o..#.....#....TT.......T.#',
      '#....#.T..,#T............T.L.......#',
      '#T........,o,,o,,o@..........#T....#',
      '#...S....T....................T....#',
      '#........................#........##',
      '#..T....#...#..........T...........#',
      '#.....#..TTT...........#...........#',
      '####################################',
    ]],
    ['Туманный лес', [
      '####################################',
      '#..T...T......T.T..TT.T..T.T....TT.#',
      '#...TT.T......T.....T.......T......#',
      '#.T..T...TTT..TT.......TTT......A..#',
      '#...T.S....TT.T..........T.T....o..#',
      '#....T...T......T...T...TT....T.,..#',
      '#..T.........TT.................,.T#',
      '#T.T....T.T..TT..TT..T......T.T.oT.#',
      '#.T...T..T..,,o,,o,,o,,o,....T..,..#',
      '#.T..T..T...,..T.....T..o.TT.T.T,TT#',
      '#.....TT..T.,.T.......TT,....T..o..#',
      '#........T.To...........,....TT.,T.#',
      '#TT.........,.....L.....o......T,..#',
      '#T.....T.T.T,.T.S.....T.,T.T...To..#',
      '#.....T..T..o...........,.T.....,..#',
      '#.TTTTT.T...,T..........o.T..TT.,..#',
      '#T.o,,o,,o,,,..T...T....,T...T..oTT#',
      '#T.,..T.T.TT.T.T........,....T..,.T#',
      '#..o......T.T.........TT,,o,,o,,,T.#',
      '#..@.T...T....TT..T............TTTT#',
      '#TT........T...TT.T.T....TTT.......#',
      '#.T.T.TT....TT.T...................#',
      '#TT..........T........T...T...S...T#',
      '#.....T.....T........T.............#',
      '#....T..........T..T....T..T.......#',
      '####################################',
    ]],
    ['Каменные гряды', [
      '####################################',
      '#......#...T......#......#...TT....#',
      '#..T..........................A....#',
      '#..S...TT..........T.......##,.....#',
      '#.....T...T...........T......,.....#',
      '#.##########################o.###..#',
      '#.T........T...............#,......#',
      '#...T..............T......#.o...T.T#',
      '#T....#.#........Lo,,o,,o,,o,...T..#',
      '#.....o,,o,,o,,o,...#..............#',
      '#...#.,.................T..#.......#',
      '#..###o.#########################..#',
      '#.....,.....................T......#',
      '#.T....o,o,,o,,o......#....T.......#',
      '#......T........,,o,,o,,o,......S..#',
      '#..........T.T...T..T....o.....#...#',
      '#...#.T...........#......,.........#',
      '#.T######################,.######..#',
      '#...T.......T...#~~...T..,.........#',
      '#.TT.............~~..T..T,.....T...#',
      '#...........T..T.~~..,,o,o....#....#',
      '#...@.........,o,o,,o.............T#',
      '#...,,.,,o,,o,.T.~~T.T..T....T...S.#',
      '#....,o.T..TT....~~........#.......#',
      '#.........T...T..~~..........T.....#',
      '####################################',
    ]],
  ],

  // урок-квест (урок 16, Г4 аудита): три плато — одна карта 108 × 26. В стенах между плато проходы (строки KVEST_GATES),
  // старт — только на первом плато, свет на вершине — только на последнем; остальные «@» и «A» стали тропой. Все 9 секретов и вершина
  // достижимы со старта (проверено поиском в ширину). Карту берёт и урок: план квеста на шаге kvest и на проекторе.
  KVEST_GATES: [[8, 9, 21], [3, 4, 14, 15]],
  kvestMap() {
    const rows = this.MAPS.map(([, r]) => r.map(x => x.split('')));
    this.KVEST_GATES.forEach((gs, i) => gs.forEach(r => { rows[i][r][35] = '.'; rows[i + 1][r][0] = '.'; }));
    rows.forEach((m, i) => m.forEach(row => row.forEach((ch, k) => { if ((ch === 'A' && i < 2) || (ch === '@' && i > 0)) row[k] = ','; })));
    return rows[0].map((_, r) => rows.map(m => m[r].join('')).join(''));
  },
  ownLevels(lab) {
    const c = lab.cfg;
    if (Math.round(c.kvest)) return [{ name: 'Большое плато класса', map: (c.landmark < 0.5 ? this.kvestMap().map(r => r.replace(/L/g, '.')) : this.kvestMap()).join('\n') }];
    const maps = Math.round(c.hunt) ? [this.MAPS[0]] : this.MAPS;
    return maps.map(([name, rows]) => ({ name, map: (c.landmark < 0.5 ? rows.map(r => r.replace(/L/g, '.')) : rows).join('\n') }));
  },

  start(lab, scene) {
    const st = lab.state, c = lab.cfg;
    Object.assign(st, { li: -1, lv: [], score0: 0, summits: 0, secretsGot: 0, secretsAll: 0, levelT0: 0, times: [], pass: 0, chain: 0, chainT: -9, callT: -9,
      fogK: 1, mood: -1, moodT: 0, guide: c.secret > 0.5, hunt: Math.round(c.hunt) > 0, kvest: Math.round(c.kvest) > 0, classFound: 0, done: false });
    st.list = lab.levels(this.ownLevels(lab), this.LEGEND);
    st.hero = this.buildHero(lab);
    lab.hero(st.hero.node);
    st.rig = new THREE.Object3D(); scene.add(st.rig);
    lab.follow(st.rig, { distance: 6.8, height: 2.7, lag: 0.12, look: 1.4 });
    st.dome = this.buildSky(lab, scene);
    this.enter(lab, 0);
  },

  update(lab, dt) {
    const st = lab.state, c = lab.cfg, h = st.hero, L = st.lv[st.li], p = lab.p1;
    this.mood(lab, dt);
    this.tickLevel(lab, L, dt);
    if (st.pass > 0) {
      st.pass -= dt; h.walk = lab.damp(h.walk, 0, 6, dt); this.animHero(lab, h, dt); this.aim(lab, dt);
      if (st.pass <= 0) { if (st.li + 1 < st.list.length) this.enter(lab, st.li + 1); else this.finish(lab); }
      return;
    }
    // танковое управление: ← → поворот, ↑ ↓ шаг; камера за спиной
    h.yaw -= p.x * c.turn * dt;
    const fwd = lab.clamp(p.y, -1, 1), sp = c.speed * (fwd < 0 ? 0.5 : 1);
    h.v = lab.damp(h.v, fwd * sp, 9, dt);
    const dx = Math.sin(h.yaw) * h.v * dt, dz = Math.cos(h.yaw) * h.v * dt;
    if (!this.blocked(L, h.x + dx, h.z)) h.x += dx; else h.v *= 0.6;
    if (!this.blocked(L, h.x, h.z + dz)) h.z += dz; else h.v *= 0.6;
    h.walk = lab.damp(h.walk, Math.abs(h.v) / c.speed, 10, dt);
    if (p.pressed.a && lab.t - st.callT > 0.9) this.call(lab, L);
    this.touch(lab, L, h);
    if (st.kvest) this.classSecrets(lab, L);
    this.animHero(lab, h, dt);
    this.aim(lab, dt);
    const [cx, cy] = this.toCell(L, h.x, h.z);
    lab.spot('where', cx, cy);
    if (lab.t > c.limit && !st.done) { st.done = true; this.stats(lab); lab.gameOver(st.hunt ? `Время вышло: секретов ${L.got} из ${L.secrets.length}` : 'Туман сгустился: время вышло'); }
    this.hud(lab, L);
  },

  /* ---------- уровень: строим из карты ---------- */
  parse(map) {
    const rows = String(map || '').replace(/\r/g, '').split('\n');
    const W = Math.max(8, ...rows.map(r => r.length)), H = Math.max(6, rows.length);
    const g = []; for (let r = 0; r < H; r++) g.push((rows[r] || '').padEnd(W, '.').split(''));
    return { g, W, H };
  },
  cellAt(L, col, row) { return row < 0 || col < 0 || row >= L.H || col >= L.W ? '#' : L.g[row][col]; },
  toCell(L, x, z) { return [(x - L.ox) / this.CELL + L.W / 2, z / this.CELL + L.H / 2]; },
  toWorld(L, col, row) { return [L.ox + (col + 0.5 - L.W / 2) * this.CELL, (row + 0.5 - L.H / 2) * this.CELL]; },
  blocked(L, x, z) {
    const R = 0.45;
    for (const [ax, az] of [[-R, -R], [R, -R], [-R, R], [R, R]]) {
      const [cx, cy] = this.toCell(L, x + ax, z + az), ch = this.cellAt(L, Math.floor(cx), Math.floor(cy));
      if (ch === '#' || ch === 'T' || ch === '~' || ch === 'L') return true;
    }
    return false;
  },
  // ближайшая к цели проходимая клетка, если в карте гостя нет старта или вершины
  bfs(L, from) {
    const seen = new Map([[from.join(','), 0]]), q = [from], walk = ch => !'#T~L'.includes(ch);
    while (q.length) {
      const [x, y] = q.shift(), d = seen.get(x + ',' + y);
      for (const [a, b] of [[1, 0], [-1, 0], [0, 1], [0, -1]]) { const k = (x + a) + ',' + (y + b); if (!seen.has(k) && walk(this.cellAt(L, x + a, y + b))) { seen.set(k, d + 1); q.push([x + a, y + b]); } }
    }
    return seen;
  },

  enter(lab, i) {
    const st = lab.state, h = st.hero;
    if (st.lv[st.li]) st.lv[st.li].root.visible = false;
    st.li = i;
    if (!st.lv[i]) st.lv[i] = this.buildLevel(lab, i);
    const L = st.lv[i]; L.root.visible = true;
    lab.level(i);
    const [x, z] = this.toWorld(L, L.start[0], L.start[1]);
    Object.assign(h, { x, z, v: 0, yaw: Math.PI, walk: 0 });
    st.rig.position.set(x, 0, z); st.rig.rotation.y = h.yaw;
    lab.view && (lab.view.target = lab.v3(x, 0, z));
    st.levelT0 = lab.t; st.fogK = 1; st.mood = -1;
    this.animHero(lab, h, 0); this.aim(lab, 1); this.mood(lab, 1);
    const tag = L.guest ? ` · уровень гостя ${L.guest}` : '';
    lab.hud('lvl', `Плато ${i + 1} из ${st.list.length}: «${L.name}»${tag}`, { color: '#fff3d0', size: 18 });
    lab.after(3.5, () => { if (lab.state === st && st.li === i) lab.hud('lvl', null); });
  },

  buildLevel(lab, i) {
    const st = lab.state, c = lab.cfg, T = THREE, C = this.CELL, lv = st.list[i];
    const { g, W, H } = this.parse(lv.map);
    const L = { name: lv.name, guest: lv.guest || null, g, W, H, ox: i * 260, crumbs: [], secrets: [], got: 0, start: null, goal: null, mark: null };
    const root = L.root = lab.group({ at: [0, 0, 0] });
    const guide = st.guide, R = (a, b) => lab.rand(a, b);
    const cells = ch => { const out = []; g.forEach((row, r) => row.forEach((x, k) => { if (x === ch) out.push([k, r]); })); return out; };
    L.start = cells('@')[0] || null;
    if (!L.start) { // старт гостя не задан — нижняя проходимая клетка
      for (let r = H - 1; r >= 0 && !L.start; r--) for (let k = 0; k < W; k++) if (!'#T~L'.includes(g[r][k])) { L.start = [k, r]; break; }
      L.start = L.start || [1, 1];
    }
    const dist = this.bfs(L, L.start);
    L.goal = cells('A')[0] || null;
    if (!L.goal) { let best = null, bd = -1; for (const [k, d] of dist) if (d > bd) { bd = d; best = k; } L.goal = best ? best.split(',').map(Number) : L.start; }
    L.goalD = Math.max(1, dist.get(L.goal.join(',')) || 1);
    L.dist = dist;
    // земля и простор за краем карты
    const [gx] = this.toWorld(L, (W - 1) / 2, 0);
    lab.box(W * C + 80, 0.4, H * C + 80, '#4f8f4a', { at: [gx, -0.2, 0], parent: root, shadow: false });
    // тропа: светлая, видно её издалека (без спрятанной механики — цвета травы, то есть её нет)
    const path = cells(',').concat(cells('o'), [L.start], [L.goal]);
    if (guide && path.length) {
      const m = lab.instances(new T.BoxGeometry(C * 0.98, 0.05, C * 0.98), lab.mat('#d9c27a', { rough: 1 }), path.length, { parent: root });
      path.forEach(([k, r], n) => { const [x, z] = this.toWorld(L, k, r); lab.place(m, n, [x, 0.025, z], { color: n % 3 ? '#d9c27a' : '#cfb66c' }); });
      lab.noShadow(m);
    }
    // скалы: валуны-многогранники, по краю карты — кольцо выше
    const rocks = cells('#'), ring = [];
    for (let k = -1; k <= W; k++) { ring.push([k, -1]); ring.push([k, H]); }
    for (let r = 0; r < H; r++) { ring.push([-1, r]); ring.push([W, r]); }
    const allRocks = rocks.concat(ring);
    const rm = lab.instances(new T.DodecahedronGeometry(1.15, 0), lab.mat('#6b7184', { rough: 0.95 }), allRocks.length, { parent: root });
    allRocks.forEach(([k, r], n) => {
      const [x, z] = this.toWorld(L, k, r), edge = k <= 0 || r <= 0 || k >= W - 1 || r >= H - 1;
      const near = (a, b) => this.cellAt(L, a, b) === '#';
      const tall = edge ? R(2.2, 3.4) : (near(k - 1, r) && near(k + 1, r)) || (near(k, r - 1) && near(k, r + 1)) ? R(1.8, 2.8) : R(1.1, 2.1);
      lab.place(rm, n, [x + R(-0.15, 0.15), tall * 0.75, z + R(-0.15, 0.15)], { rot: [R(-0.2, 0.2), R(0, 6.3), R(-0.2, 0.2)], scale: [R(0.95, 1.15), tall, R(0.95, 1.15)], color: lab.pick(['#6b7184', '#737a8f', '#5f6678', '#7a7f92']) });
    });
    // пихты: две пачки — крона в два яруса и ствол
    const trees = cells('T');
    if (trees.length) {
      const U = lab.addons.BufferGeometryUtils, a = new T.ConeGeometry(1.05, 2.2, 7).translate(0, 1.9, 0), b = new T.ConeGeometry(0.78, 1.8, 7).translate(0, 3.1, 0);
      const crown = lab.instances(U.mergeGeometries([a, b]), lab.mat('#2d6b3f', { rough: 0.9 }), trees.length, { parent: root });
      const trunk = lab.instances(new T.CylinderGeometry(0.16, 0.24, 1.1, 6).translate(0, 0.55, 0), lab.mat('#6a4a32'), trees.length, { parent: root });
      trees.forEach(([k, r], n) => { const [x, z] = this.toWorld(L, k, r), s = R(0.85, 1.3), at = [x + R(-0.3, 0.3), 0, z + R(-0.3, 0.3)];
        lab.place(crown, n, at, { rot: R(0, 6.3), scale: [s, s * R(0.9, 1.2), s], color: lab.pick(['#2d6b3f', '#2f7444', '#285f3a', '#367a48']) }); lab.place(trunk, n, at, { scale: s }); });
    }
    // озеро: гладкая вода чуть ниже травы
    const water = cells('~');
    if (water.length) {
      const wm = lab.instances(new T.BoxGeometry(C, 0.06, C), lab.mat('#3a7bd5', { shiny: true, alpha: 0.9 }), water.length, { parent: root });
      water.forEach(([k, r], n) => { const [x, z] = this.toWorld(L, k, r); lab.place(wm, n, [x, 0.02, z]); });
      lab.noShadow(wm);
    }
    // цветы и кочки на траве: жизнь без смысла (чтобы огоньки отличались)
    const grass = cells('.').filter(() => lab.chance(0.18));
    if (grass.length) {
      const fm = lab.instances(new T.ConeGeometry(0.12, 0.35, 5).translate(0, 0.17, 0), lab.mat('#ffffff'), grass.length * 2, { parent: root, shadow: false });
      grass.forEach(([k, r], n) => { for (let j = 0; j < 2; j++) { const [x, z] = this.toWorld(L, k, r); lab.place(fm, n * 2 + j, [x + R(-0.8, 0.8), 0, z + R(-0.8, 0.8)], { scale: R(0.7, 1.4), color: lab.pick(['#7fbf5a', '#8fcf6a', '#d8e6a8', '#c9a6e8', '#6aa84f']) }); } });
      lab.noShadow(fm);
    }
    // огоньки-крошки: только на тропе к вершине; ручка crumbs прореживает
    const every = [0, 3, 2, 1][Math.round(c.crumbs)] || 0, cr = cells('o').filter((_, n) => every && n % every === 0);
    if (guide && cr.length) {
      L.crumbMesh = lab.instances(new T.IcosahedronGeometry(0.2, 1), lab.mat('#ffd23f', { glow: 1.6 }), cr.length, { parent: root, shadow: false });
      cr.forEach(([k, r], n) => { const [x, z] = this.toWorld(L, k, r); L.crumbs.push({ x, z, n, got: false, ph: R(0, 6.3), flare: 0 }); });
      L.stemMesh = lab.instances(new T.CylinderGeometry(0.03, 0.04, 0.55, 4).translate(0, 0.27, 0), lab.mat('#6aa84f'), cr.length, { parent: root, shadow: false });
      L.crumbs.forEach(o => lab.place(L.stemMesh, o.n, [o.x, 0, o.z]));
    }
    // секреты: фиолетовые кристаллы за скалами и деревьями
    for (const [k, r] of cells('S')) {
      const [x, z] = this.toWorld(L, k, r);
      const base = lab.cyl(0.7, 0.85, 0.3, '#8a8fa3', { at: [x, 0.15, z], parent: root, sides: 7 });
      const gem = lab.mesh(new T.OctahedronGeometry(0.42, 0), lab.mat('#b49bff', { glow: 1.1 }), { at: [x, 1.1, z], parent: root });
      L.secrets.push({ x, z, k, r, key: k + ',' + r, got: false, base, gem, hintT: 0 });
    }
    st.secretsAll += L.secrets.length;
    // ориентир: каменный великан, глаза светятся и видны сквозь туман
    const lm = cells('L')[0];
    if (lm && guide) {
      const [x, z] = this.toWorld(L, lm[0], lm[1]), parts = [];
      const add = (w, hh, d, y, ox = 0, oz = 0, col = '#8a8fa3') => parts.push(lab.box(w, hh, d, col, { at: [x + ox, y, z + oz], parent: null, round: 0.15 }));
      add(0.9, 2.6, 0.9, 1.3, -0.7); add(0.9, 2.6, 0.9, 1.3, 0.7); add(2.6, 2.8, 1.6, 4, 0, 0, '#7a7f92'); add(0.8, 2.4, 0.8, 4.2, -1.75, 0, '#8a8fa3'); add(0.8, 2.4, 0.8, 4.2, 1.75, 0, '#8a8fa3'); add(1.7, 1.5, 1.4, 6.2, 0, 0, '#9aa0b3');
      lab.merge(parts, root);
      const eye = new T.MeshBasicMaterial({ color: new T.Color('#ffb547').multiplyScalar(2.2), fog: false });
      L.eyes = [-0.38, 0.38].map(ox => lab.mesh(new T.IcosahedronGeometry(0.16, 0), eye, { at: [x + ox, 6.35, z + 0.72], parent: root, shadow: false }));
      L.mark = { x, z };
    }
    // свет на вершине: пирамидка камней, огонь и столб света сквозь туман (без спрятанной механики — только камни)
    {
      const [x, z] = this.toWorld(L, L.goal[0], L.goal[1]), parts = [];
      for (let j = 0; j < 4; j++) parts.push(lab.box(1.5 - j * 0.3, 0.45, 1.5 - j * 0.3, j % 2 ? '#9aa0b3' : '#7a7f92', { at: [x, 0.22 + j * 0.45, z], rot: j * 0.6, parent: null, round: 0.1 }));
      lab.merge(parts, root);
      L.goalW = { x, z };
      if (guide && c.beacon > 0.01) {
        L.orb = lab.ball(0.4, lab.mat('#fff3b0', { glow: 2 }), { at: [x, 2.3, z], parent: root, shadow: false });
        L.beamMat = new T.MeshBasicMaterial({ color: new T.Color('#fff3b0'), transparent: true, opacity: 0.3, blending: T.AdditiveBlending, depthWrite: false, fog: false, side: T.DoubleSide });
        L.beam = lab.mesh(new T.CylinderGeometry(0.7, 1.3, 120, 14, 1, true), L.beamMat, { at: [x, 62, z], parent: root, shadow: false });
      }
    }
    // горы за плато: конусы со снегом в тумане
    {
      const parts = [];
      for (let n = 0; n < 22; n++) {
        const a = (n / 22) * Math.PI * 2, rx = W * C * 0.5 + R(16, 34), rz = H * C * 0.5 + R(16, 34), hh = R(14, 30), rr = R(9, 16);
        const px = gx + Math.cos(a) * rx, pz = Math.sin(a) * rz;
        parts.push(lab.cone(rr, hh, '#7d86a6', { at: [px, hh / 2 - 0.5, pz], parent: null, sides: 6 }));
        parts.push(lab.cone(rr * 0.32, hh * 0.32, '#f2f4fb', { at: [px, hh * 0.84 - 0.5, pz], parent: null, sides: 6 }));
      }
      lab.noShadow(lab.merge(parts, root));
    }
    return L;
  },

  /* ---------- небо и настроение света ---------- */
  buildSky(lab, scene) {
    const T = THREE, geo = new T.SphereGeometry(400, 24, 12);
    geo.setAttribute('color', new T.BufferAttribute(new Float32Array(geo.attributes.position.count * 3), 3));
    const m = new T.Mesh(geo, new T.MeshBasicMaterial({ vertexColors: true, side: T.BackSide, fog: false, depthWrite: false }));
    m.renderOrder = -10; lab.noShadow(m); scene.add(m);
    return m;
  },
  // утро (сиреневый туман) → закат (золотой); k — доля пути до вершины, если включена ручка sunset
  MOODS: { morning: { top: '#7c8fc9', hor: '#e3d3e6', fog: '#dcd2e6', sun: '#fff2dc', hemi: '#dfe4ff', si: 1.6 }, sunset: { top: '#3d3c82', hor: '#ffb37a', fog: '#f0b48e', sun: '#ffb070', hemi: '#ffd0b0', si: 1.9 } },
  mood(lab, dt) {
    const st = lab.state, c = lab.cfg, L = st.lv[st.li], h = st.hero;
    if (!L) return;
    let k = 0;
    if (c.sunset > 0.5) { const [cx, cy] = this.toCell(L, h.x, h.z), d = L.dist.get(Math.floor(cx) + ',' + Math.floor(cy)); k = d == null ? (st.moodK || 0) : lab.clamp(d / L.goalD, 0, 1); }
    st.moodK = lab.damp(st.moodK == null ? k : st.moodK, k, 1.5, dt);
    const T = THREE, A = this.MOODS.morning, B = this.MOODS.sunset, q = st.moodK;
    const col = key => new T.Color(A[key]).lerp(new T.Color(B[key]), q);
    if (lab.scene.fog) { lab.scene.fog.color.copy(col('fog')); lab.scene.fog.density = c.fog * st.fogK; }
    lab.light.sun.color.copy(col('sun')); lab.light.sun.intensity = lab.lerp(A.si, B.si, q);
    lab.light.hemi.color.copy(col('hemi'));
    if ((st.moodT -= dt) <= 0 || Math.abs(st.mood - q) > 0.02) {
      st.moodT = 0.25; st.mood = q;
      const top = col('top'), hor = col('fog'), pos = st.dome.geometry.attributes.position, cl = st.dome.geometry.attributes.color, tmp = new T.Color();
      for (let n = 0; n < pos.count; n++) { const y = pos.getY(n) / 400; tmp.copy(hor).lerp(top, lab.clamp(y * 1.6, 0, 1)); cl.setXYZ(n, tmp.r, tmp.g, tmp.b); }
      cl.needsUpdate = true;
    }
    st.dome.position.copy(lab.camera.position);
  },

  /* ---------- мир живёт ---------- */
  tickLevel(lab, L, dt) {
    if (!L) return;
    const t = lab.t, c = lab.cfg;
    for (const o of L.crumbs) {
      if (o.got) continue;
      o.flare = Math.max(0, o.flare - dt * 1.4);
      lab.place(L.crumbMesh, o.n, [o.x, 0.72 + Math.sin(t * 2.2 + o.ph) * 0.1, o.z], { scale: 1 + o.flare * 1.2 + Math.sin(t * 5 + o.ph) * 0.06 });
    }
    for (const s of L.secrets) if (!s.got) {
      s.gem.rotation.y += dt * 1.4; s.gem.position.y = 1.1 + Math.sin(t * 1.8 + s.k) * 0.12;
      if (s.hintT > 0) { s.hintT -= dt; if (Math.floor(s.hintT * 30) % 2) lab.burst([s.x, 1.2, s.z], { count: 1, colors: ['#b49bff', '#e4d9ff'], speed: 0.6, up: 2.5, size: 0.12, life: 0.7, gravity: -2 }); }
    }
    if (L.beam) { const b = c.beacon * (1 + 0.12 * Math.sin(t * 2.5)) * (1 + (L.beamKick || 0)); L.beamMat.opacity = lab.clamp(0.22 * b, 0, 0.75); L.beam.scale.set(0.6 + b * 0.4, 1, 0.6 + b * 0.4); L.orb.scale.setScalar(0.8 + b * 0.3); L.beamKick = Math.max(0, (L.beamKick || 0) - dt * 2); }
    if (L.eyes) L.eyes.forEach((e, n) => e.scale.setScalar(Math.sin(t * 0.7 + n) > 0.97 ? 0.2 : 1)); // великан моргает
  },
  call(lab, L) {
    const st = lab.state, h = st.hero;
    st.callT = lab.t; lab.count('зов');
    lab.ring([h.x, 0.1, h.z], { color: '#ffe08a', radius: 9, life: 0.9 });
    lab.tone(523, 0.18, 'sine', 0.08, 0); lab.tone(784, 0.24, 'sine', 0.07, 0, 0.12);
    for (const o of L.crumbs) if (!o.got && lab.flat([o.x, 0, o.z], [h.x, 0, h.z]) < 18) o.flare = 1;
    for (const s of L.secrets) if (!s.got && lab.flat([s.x, 0, s.z], [h.x, 0, h.z]) < 12) { s.hintT = 1.6; lab.tone(1046, 0.3, 'triangle', 0.04, 0, 0.3); }
    L.beamKick = 0.8;
  },
  touch(lab, L, h) {
    const st = lab.state, c = lab.cfg, me = [h.x, 0, h.z];
    for (const o of L.crumbs) if (!o.got && lab.flat([o.x, 0, o.z], me) < 1.4) {
      o.got = true; lab.place(L.crumbMesh, o.n, [o.x, -5, o.z], { scale: 0.001 }); lab.place(L.stemMesh, o.n, [o.x, -5, o.z], { scale: 0.001 });
      st.chain = lab.t - st.chainT < 4 ? st.chain + 1 : 0; st.chainT = lab.t;
      lab.addScore(10 + st.chain * 2, [o.x, 1, o.z], '#ffd23f');
      lab.tone(660 * lab.pitch(st.chain), 0.12, 'sine', 0.07, 0); lab.burst([o.x, 0.8, o.z], { count: 8, colors: ['#ffd23f', '#fff3b0'], speed: 2, up: 2, size: 0.1 });
      lab.count('огоньки'); lab.count('_secret');
    }
    for (const s of L.secrets) if (!s.got && lab.flat([s.x, 0, s.z], me) < 1.6) {
      s.got = true; L.got++; st.secretsGot++; s.gem.visible = false;
      lab.spot('secret', s.k + 0.5, s.r + 0.5);
      if (st.kvest) lab.net.send({ secret: s.key }); // урок-квест: находка уходит классу
      lab.count('секреты'); lab.sfx.power(); lab.flash('#b49bff', 0.25); lab.shake(0.15);
      lab.burst([s.x, 1.2, s.z], { count: 26, colors: ['#b49bff', '#e4d9ff', '#ffffff'], speed: 5, up: 4, size: 0.16 });
      lab.addScore(st.hunt ? 500 : 200, [s.x, 2, s.z], '#d8c8ff');
      lab.popup([s.x, 2.6, s.z], `Секрет ${L.got} из ${L.secrets.length}`, '#d8c8ff', 22);
      if (c.lift > 0.5) { st.fogK *= 0.62; lab.popup([h.x, 3.2, h.z], 'Туман редеет', '#ffffff', 16); }
      if (st.hunt && L.got >= L.secrets.length) {
        const sec = lab.t - st.levelT0; st.times.push(sec); st.done = true;
        lab.addScore(Math.max(0, Math.round(1500 - sec * 10)), [h.x, 3, h.z], '#ffe08a');
        this.stats(lab); lab.win(`Все секреты за ${sec.toFixed(1)} с!`); return;
      }
    }
    if (!st.hunt && L.goalW && lab.flat([L.goalW.x, 0, L.goalW.z], me) < 2.3) {
      const sec = lab.t - st.levelT0; st.times.push(sec); st.summits++;
      lab.clear({ time: sec });
      lab.addScore(500 + Math.max(0, Math.round((90 - sec) * 5)), [L.goalW.x, 3, L.goalW.z], '#fff3b0');
      lab.sfx.win(); lab.flash('#fff3d0', 0.5); lab.ring([L.goalW.x, 0.1, L.goalW.z], { color: '#fff3b0', radius: 14, life: 1.2 });
      lab.burst([L.goalW.x, 2.4, L.goalW.z], { count: 40, colors: ['#fff3b0', '#ffd23f', '#ffffff'], speed: 7, up: 6, size: 0.18 });
      lab.popup([L.goalW.x, 4, L.goalW.z], `Вершина за ${sec.toFixed(0)} с`, '#fff3b0', 24);
      lab.count('вершины');
      st.pass = 2; L.goalW = null;
    }
  },
  // урок-квест: секреты, которые нашёл класс, гаснут до серого камня с ником — их уже открыли; свои находки — как обычно
  classSecrets(lab, L) {
    const st = lab.state, room = (lab.net.on && lab.net.room) || {}, found = room.found || {};
    st.classFound = Object.keys(found).length; st.classTotal = room.total || L.secrets.length;
    for (const s of L.secrets) if (!s.got && !s.taken && found[s.key]) {
      s.taken = found[s.key]; s.gem.scale.setScalar(0.45);
      if (lab.flat([s.x, 0, s.z], [st.hero.x, 0, st.hero.z]) < 30) lab.popup([s.x, 2.4, s.z], `Нашёл(а) ${String(s.taken).slice(0, 16)}`, '#d8c8ff', 16);
    }
  },
  finish(lab) {
    const st = lab.state; st.done = true; this.stats(lab);
    lab.win(`Все вершины! Секретов ${st.secretsGot} из ${st.secretsAll}`);
  },
  stats(lab) {
    const st = lab.state, avg = st.times.length ? st.times.reduce((a, b) => a + b, 0) / st.times.length : lab.t - st.levelT0;
    lab.stat('секунд до вершины', Math.round(avg));
    lab.stat('секретов', st.secretsGot);
    lab.stat('вершин', st.summits);
  },

  /* ---------- путница ---------- */
  buildHero(lab) {
    const node = lab.group({ at: [0, 0, 0] }), coat = '#ffc93c';
    lab.cone(0.46, 1.15, coat, { at: [0, 0.82, 0], parent: node, sides: 9 });
    lab.ball(0.25, '#f2c7a0', { at: [0, 1.48, 0.02], parent: node });
    lab.mesh(new THREE.SphereGeometry(0.29, 10, 6, 0, Math.PI * 2, 0, Math.PI * 0.55), coat, { at: [0, 1.52, -0.02], parent: node });
    lab.box(0.42, 0.5, 0.22, '#3a6fd8', { at: [0, 1.0, -0.3], parent: node, round: 0.06 });
    lab.ball(0.05, '#2b2d42', { at: [-0.09, 1.5, 0.24], parent: node, detail: 0 });
    lab.ball(0.05, '#2b2d42', { at: [0.09, 1.5, 0.24], parent: node, detail: 0 });
    const legL = lab.box(0.13, 0.36, 0.13, '#3b3f5c', { at: [-0.12, 0.18, 0], parent: node });
    const legR = lab.box(0.13, 0.36, 0.13, '#3b3f5c', { at: [0.12, 0.18, 0], parent: node });
    const lamp = lab.ball(0.12, lab.mat('#ffb547', { glow: 1.8 }), { at: [0.42, 0.85, 0.28], parent: node, shadow: false });
    lab.cyl(0.015, 0.015, 0.35, '#5a4a3a', { at: [0.42, 1.05, 0.28], parent: node, sides: 4 });
    return { node, legL, legR, lamp, x: 0, z: 0, v: 0, yaw: Math.PI, walk: 0, ph: 0 };
  },
  animHero(lab, h, dt) {
    h.ph += dt * (4 + h.walk * 7);
    const sw = Math.sin(h.ph) * 0.5 * h.walk;
    h.node.position.set(h.x, Math.abs(Math.sin(h.ph)) * 0.06 * h.walk, h.z);
    h.node.rotation.y = h.yaw;
    h.node.rotation.z = Math.sin(h.ph * 0.5) * 0.03 * h.walk;
    h.legL.rotation.x = sw; h.legR.rotation.x = -sw;
    h.lamp.position.y = 0.85 + Math.sin(h.ph + 1) * 0.05 * h.walk;
  },
  // камера за спиной; скала или пихта между путницей и камерой — камера подъезжает ближе и поднимается
  aim(lab, dt) {
    const st = lab.state, h = st.hero, r = st.rig, L = st.lv[st.li];
    r.position.set(h.x, 0, h.z);
    let d = h.yaw - r.rotation.y; while (d > Math.PI) d -= Math.PI * 2; while (d < -Math.PI) d += Math.PI * 2;
    r.rotation.y += d * Math.min(1, dt * 5);
    const FAR = 6.8, sx = Math.sin(r.rotation.y), sz = Math.cos(r.rotation.y);
    let want = FAR;
    if (L) for (let k = 1; k <= FAR + 0.6; k += 0.4) {
      const [cx, cy] = this.toCell(L, h.x - sx * k, h.z - sz * k), ch = this.cellAt(L, Math.floor(cx), Math.floor(cy));
      if (ch === '#' || ch === 'T' || ch === 'L') { want = Math.max(2.4, k - 1); break; }
    }
    st.camD = dt >= 1 || st.camD == null ? want : lab.damp(st.camD, want, want < st.camD ? 10 : 2.5, dt);
    const k = (FAR - st.camD) / FAR;
    lab.follow(st.rig, { distance: st.camD, height: 2.7 + k * 2.6, lag: 0.12, look: 1.4 - k * 0.3 });
  },
  hud(lab, L) {
    const st = lab.state, c = lab.cfg, h = st.hero, left = Math.max(0, Math.round(c.limit - lab.t));
    lab.hud('info', st.kvest ? `🗺 Класс нашёл ${Math.max(st.classFound, st.secretsGot)} из ${st.classTotal || L.secrets.length} · ✨ твоих ${st.secretsGot} · ⏱ ${left} с`
      : st.hunt ? `✨ Секреты ${L.got} из ${L.secrets.length} · ⏱ ${(lab.t - st.levelT0).toFixed(1)} с` : `Плато ${st.li + 1} из ${st.list.length} · ✨ секретов ${st.secretsGot} · ⏱ ${left} с`, { color: '#ffffff', size: 15 });
    if (c.compass > 0.5 && L.goalW) {
      const dx = L.goalW.x - h.x, dz = L.goalW.z - h.z, ang = Math.atan2(dx, dz) - h.yaw;
      const a = ((ang % (Math.PI * 2)) + Math.PI * 3) % (Math.PI * 2) - Math.PI, arrows = ['⬇', '↙', '⬅', '↖', '⬆', '↗', '➡', '↘'];
      const idx = Math.round(((-a + Math.PI) / (Math.PI * 2)) * 8) % 8;
      lab.hud('compass', `🧭 ${arrows[idx]} ${Math.round(Math.hypot(dx, dz))} м до света`, { color: '#fff3b0', size: 18 });
    } else lab.hud('compass', null);
  },

  overNote(lab) {
    const st = lab.state;
    if (!st.done) this.stats(lab);
    const avg = st.times.length ? Math.round(st.times.reduce((a, b) => a + b, 0) / st.times.length) : null;
    return [
      st.hunt ? `Секретов ${st.secretsGot} из ${st.secretsAll}` : `Вершин ${st.summits} из ${st.list.length} · секретов ${st.secretsGot} из ${st.secretsAll}`,
      avg != null ? `До вершины в среднем ${avg} с: ${st.times.map(t => Math.round(t) + ' с').join(' · ')}` : 'До вершины не дошла: где туман увёл в сторону?',
      lab.cfg.secret > 0 ? 'Свет, огоньки, великан и светлая тропа вели взгляд. Сравни с «Без спрятанной механики».' : 'Спрятанная механика выключена: ни света, ни огоньков, ни ориентира — только туман.',
    ];
  },
};
