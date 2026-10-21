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
// Tetris: The Grand Master, Puyo Puyo Tetris) — в docs/журнал/урок-04.md, раздел урока 4.
// Спрятанная механика донора — честный проигрыш: «мешок» из семи камней и предпросмотр (ручки bag и preview, пресет «Без спрятанной механики»).
// Вариации жанра из настоящих игр — пресеты меню Tab (урок 4, чекпоинт 2 «Один глагол — много игр», 20.10.2026): спринт и блиц (TETR.IO,
// Tetris Effect), копатель и подъём мусора (TETR.IO), пентамино (Pentix), бомбы (Tetris Blast), лавина (Cascade в Tetris Worlds),
// цвет к цвету (Puyo Puyo, Columns), туман и 20G (Tetris: The Grand Master). Глагол везде тот же; имя вариации и её правило — строкой HUD.
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
  scoreColor: '#ffd23f', // счёт золотом, как вспышка «Четыре разом»
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
    // вариации жанра: 0 — как в классике
    sprint: { value: 0, min: 0, max: 60, step: 5, label: 'Вариация «Цель»: спринт — собрать … линий на время', hint: 'как 40 линий в TETR.IO и Tetris Effect; 0 — играть, пока стакан не переполнится', restart: true },
    blitz: { value: 0, min: 0, max: 300, step: 15, label: 'Вариация «Давление»: блиц — очки за … секунд', hint: 'как Blitz в Tetris Friends и Ultra в Tetris Effect; 0 — без часов', restart: true },
    rise: { value: 0, min: 0, max: 20, step: 1, label: 'Вариация «Давление»: ряд мусора снизу раз в … с', hint: 'как Survival в TETR.IO; красный ряд под стаканом мигает перед подъёмом; 0 — выключено' },
    dig: { value: 0, min: 0, max: 12, step: 1, label: 'Вариация «Стакан»: рядов мусора в начале', hint: 'как Dig в TETR.IO и Tetris Effect: раскопай мусор до дна — победа', restart: true },
    fog: { value: 0, min: 0, max: 10, step: 1, label: 'Вариация «Стакан»: легший камень прячется в тумане через … с', hint: 'как невидимый финал Tetris: The Grand Master; линия на миг показывает всё; 0 — без тумана' },
    penta: { value: 0, min: 0, max: 1, step: 1, label: 'Вариация «Фигуры»: пентамино из пяти камней', hint: 'как Pentix: к семи фигурам добавляются шесть фигур из пяти камней', restart: true },
    bombs: { value: 0, min: 0, max: 10, step: 1, label: 'Вариация «Фигуры»: бомба в каждом …-м камне', hint: 'как Tetris Blast: линия через бомбу взрывает всё вокруг, камни осыпаются; 0 — без бомб', restart: true },
    g20: { value: 0, min: 0, max: 1, step: 1, label: 'Вариация «Ход»: 20G — камень сразу на дне', hint: 'как 20G в Tetris: The Grand Master: камень не падает, а скользит по дну' },
    cascade: { value: 0, min: 0, max: 1, step: 1, label: 'Вариация «Результат»: лавина — камни осыпаются в дыры', hint: 'как Cascade в Tetris Worlds: после линии каждый камень падает сам, линии собираются цепочкой' },
    colors: { value: 0, min: 0, max: 1, step: 1, label: 'Вариация «Результат»: четыре одного цвета лопаются', hint: 'как Puyo Puyo и Columns: камни двух цветов, лопаются группы от четырёх, потом лавина', restart: true },
  },
  presets: {
    'Новичок': { fall: 1.1, speedup: 0.9, perLevel: 12, levelTime: 60, preview: 5, lock: 0.9 },
    'Без спрятанной механики': { bag: 0, preview: 0 },
    'Безумие': { fall: 0.25, speedup: 0.75, perLevel: 5, levelTime: 15, lock: 0.25 },
    'Вдвоём': { vs: 1 },
    // вариации из настоящих игр: те же значения — в сценарии урока 4 (VARIATIONS), держать вместе
    'Спринт: 20 линий': { sprint: 20 },
    'Блиц: 2 минуты': { blitz: 120, levelTime: 20 },
    'Подъём': { rise: 6, levelTime: 0 },
    'Копатель': { dig: 8, levelTime: 0 },
    'Туман': { fog: 3 },
    'Пентамино': { penta: 1 },
    'Бомбы': { bombs: 4 },
    '20G': { g20: 1, lock: 0.7, levelTime: 0 },
    'Лавина': { cascade: 1 },
    'Цвет к цвету': { colors: 1 },
  },
  // имя вариации и её правило для строки HUD и экрана конца партии
  VARIANTS: [
    { key: 'sprint', name: 'Спринт', like: '40 линий в TETR.IO и Tetris Effect', how: c => `собери ${Math.round(c.sprint)} линий как можно быстрее` },
    { key: 'blitz', name: 'Блиц', like: 'Blitz в Tetris Friends', how: c => `набери очки за ${Math.round(c.blitz)} с` },
    { key: 'rise', name: 'Подъём', like: 'Survival в TETR.IO', how: c => `снизу лезет ряд мусора каждые ${c.rise} с` },
    { key: 'dig', name: 'Копатель', like: 'Dig в TETR.IO и Tetris Effect', how: () => 'раскопай мусор до дна' },
    { key: 'fog', name: 'Туман', like: 'невидимый финал Tetris: The Grand Master', how: c => `легший камень прячется через ${c.fog} с, линия показывает всё` },
    { key: 'penta', name: 'Пентамино', like: 'Pentix', how: () => 'бывают фигуры из пяти камней' },
    { key: 'bombs', name: 'Бомбы', like: 'Tetris Blast', how: () => 'линия через бомбу взрывает всё вокруг' },
    { key: 'g20', name: '20G', like: 'Tetris: The Grand Master', how: () => 'камень сразу на дне — веди его по дну' },
    { key: 'cascade', name: 'Лавина', like: 'Cascade в Tetris Worlds', how: () => 'после линии камни осыпаются в дыры' },
    { key: 'colors', name: 'Цвет к цвету', like: 'Puyo Puyo и Columns', how: () => 'четыре камня одного цвета рядом лопаются' },
  ],

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
  // пентамино (вариация «Пентамино», как в Pentix): строчные буквы, чтобы не путать с тетрамино и мусором X
  PENTA: {
    i: { n: 5, c: [[0, 2], [1, 2], [2, 2], [3, 2], [4, 2]], color: '#ffe08a' },
    p: { n: 3, c: [[0, 0], [1, 0], [0, 1], [1, 1], [0, 2]], color: '#ff9a5c' },
    u: { n: 3, c: [[0, 0], [1, 0], [2, 0], [0, 1], [2, 1]], color: '#5fd8ff' },
    x: { n: 3, c: [[1, 0], [0, 1], [1, 1], [2, 1], [1, 2]], color: '#ff4d6d' },
    v: { n: 3, c: [[0, 0], [1, 0], [2, 0], [0, 1], [0, 2]], color: '#c6f06a' },
    t: { n: 3, c: [[1, 0], [1, 1], [0, 2], [1, 2], [2, 2]], color: '#a58bff' },
  },
  PENTA_ORDER: 'ipuxvt',
  COLOR_KINDS: ['O', 'T', 'Z', 'L'], // «Цвет к цвету»: четыре цвета, у каждого своя руна
  GARBAGE_COLOR: '#6d6f8c',
  FOG_COLOR: '#2c3d66',
  // руна на лице камня: поворот и размер [rz, sx, sy] — у каждого вида свой знак
  RUNE: { I: [0, 0.45, 1.5], O: [Math.PI / 4, 1.2, 1.2], T: [0, 1.5, 0.45], S: [0.6, 0.5, 1.4], Z: [-0.6, 0.5, 1.4], J: [Math.PI / 4, 0.5, 1.5], L: [-Math.PI / 4, 0.5, 1.5], X: [0, 0.7, 0.7],
    i: [Math.PI / 2, 0.4, 1.6], p: [0.3, 1, 0.6], u: [0, 1.4, 0.4], x: [Math.PI / 4, 1.4, 0.35], v: [-0.3, 1, 0.6], t: [Math.PI / 2, 1.3, 0.45] },
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
    this.K = Object.assign({}, this.KINDS, this.PENTA);
    this.col = { X: new T.Color(this.GARBAGE_COLOR) };
    for (const k in this.K) this.col[k] = new T.Color(this.K[k].color);
    this.fogCol = new T.Color(this.FOG_COLOR);
    this.skyPal = this.SKY.map(([a, b, s, i, n]) => ({ top: new T.Color(a), bot: new T.Color(b), sun: new T.Color(s), power: i, stars: n }));
    Object.assign(st, { seq: [], pal: [], bag: [], pieces: 0, rots: 0, tetris: 0, pcs: 0, bestCombo: 0, beat: 0, skyK: -1, ended: false, watch: 0,
      chains: 0, booms: 0, popped: 0, banner: false, tick: 0 });
    this.makeSky(lab, scene);
    this.scenery(lab, scene);
    this.makeStones(lab, duo ? 2 : 1);
    st.wells = (duo ? [-1, 1] : [0]).map((side, i) => this.buildWell(lab, side, i));
    this.buildMarmot(lab, duo ? 0 : -(W / 2 + 3.4), duo);
    lab.hero(st.wells[0].panel);
    st.wells.forEach(w => this.digIn(lab, w));
    st.wells.forEach(w => this.spawn(lab, w));
    const v = lab.view; // живая камера: база — расстояние, которое подобрала оболочка
    st.cam = { d: v.distance, k: 1, punch: 0, last: v.distance, ty: v.target.y };
    if (!lab.playing) this.poster(lab);
    this.tickWorld(lab, 0);
    this.render(lab);
  },
  // афиша в меню: стакан в разгаре партии, колодец справа ждёт палку, камера ближе. Первый кадр партии всё возвращает
  poster(lab) {
    const st = lab.state, w = st.wells[0], W = st.W, ks = this.ORDER.split('');
    st.posterSave = { grid: w.grid, piece: w.piece, pd: w.pd, px: w.px, py: w.py };
    w.grid = w.grid.map(r => r.slice());
    for (let x = 0; x < W - 1; x++) {
      const h = 4 + ((x * 5) % 3) - (x === 4 ? 1 : 0);
      for (let y = 0; y < h; y++) if (!w.grid[y][x]) w.grid[y][x] = { k: ks[Math.floor((x + 3 * y) / 3) % 7], y, f: 0, s: 1, v: 0, seen: 1e9 };
    }
    const I = { k: 'I', n: 4, cells: [[2, 3], [2, 2], [2, 1], [2, 0]] }; // палка стоит над колодцем: сейчас будет «Четыре разом»
    w.piece = I; w.px = W - 3; w.py = 7;
    w.pd = I.cells.map(([cx, cy]) => [w.px + cx, w.py + cy]);
    const C = st.cam;
    C.k = 0.88; lab.view.distance = C.d * C.k; C.last = lab.view.distance; lab.view.target.y = C.ty - 1.5;
  },
  unposter(lab) {
    const st = lab.state, w = st.wells[0], s = st.posterSave;
    if (!s) return;
    Object.assign(w, { grid: s.grid, piece: s.piece, pd: s.pd, px: s.px, py: s.py });
    st.posterSave = null;
  },
  // копатель: ряды мусора с дырой, у соседних рядов дыры в разных местах (как «сыр» в TETR.IO)
  digIn(lab, w) {
    const st = lab.state, n = Math.min(Math.round(lab.cfg.dig), st.H - 7);
    let prev = -1;
    for (let r = 0; r < n; r++) {
      let gap; do gap = lab.randInt(0, st.W - 1); while (gap === prev);
      prev = gap;
      w.grid[r] = w.grid[r].map((_, x) => (x === gap ? null : { k: 'X', y: r, f: 0, s: 1, v: 0, dig: true, seen: 0 }));
    }
    w.digTotal = n * (st.W - 1); w.digLeft = w.digTotal;
  },
  // имя вариации: все включённые ручки вариаций; «Цвет к цвету» и так с лавиной
  variant(lab) {
    const cfg = lab.cfg, on = this.VARIANTS.filter(v => cfg[v.key] > 0 && !(v.key === 'cascade' && cfg.colors >= 1));
    if (!on.length) return { name: 'Классика', like: '«Тетрис»', how: 'собирай линии, пока стакан не переполнится' };
    return { name: on.map(v => v.name).join(' + '), like: on.map(v => v.like).join(', '), how: on.map(v => v.how(cfg)).join('; ') };
  },

  update(lab, dt) {
    const st = lab.state, W = st.wells, dying = W.some(w => w.dead), cfg = lab.cfg;
    this.unposter(lab);
    if (!st.banner) { // имя вариации и её правило крупно в начале партии
      st.banner = true;
      const v = this.variant(lab), at = lab.v3(W.length > 1 ? 0 : W[0].ox, this.wy(st.H * 0.62), 1.4);
      lab.popup(at, v.name, '#ffe680', 34);
      lab.after(0.35, () => lab.popup(lab.v3(at.x, at.y - 1.8, 1.4), v.how, '#ffffff', 18));
    }
    W.forEach((w, i) => { if (w.dead) this.dying(lab, w, dt); else if (!dying && !st.finished) this.tickWell(lab, w, i ? lab.p2 : lab.p1, dt); });
    W.forEach(w => this.settle(lab, w, dt));
    if (W.length === 1 && !st.ended) this.goals(lab, W[0], dt);
    this.tickWorld(lab, dt);
    this.liveCamera(lab, dt);
    this.render(lab);
    const cyc = this.cycle(W[0]), combo = Math.max(...W.map(w => w.combo)), v = this.variant(lab);
    lab.hud('rule', `${v.name}: ${v.how}`, { color: '#ffe680', size: 14 });
    if (W.length > 1) lab.hud('duo', `Линий: игрок 1 — ${W[0].lines}, игрок 2 — ${W[1].lines}`, { color: '#ffffff', size: 15 });
    else lab.hud('lvl', `Уровень ${W[0].level} · линий ${W[0].lines}`, { color: '#7cf5a8', size: 15 });
    const w0 = W[0], sp = Math.round(cfg.sprint);
    lab.hud('goal', W.length > 1 ? null
      : sp > 0 ? `🏁 Линий ${Math.min(sp, w0.lines)} из ${sp} · ${lab.t.toFixed(1)} с`
      : cfg.blitz > 0 ? `⏱ Осталось ${Math.max(0, Math.ceil(cfg.blitz - lab.t))} с`
      : w0.digTotal ? `⛏ Мусора осталось: ${w0.digLeft} камней` : null,
      { color: cfg.blitz > 0 && !sp && cfg.blitz - lab.t <= 10 ? '#ff5d6c' : '#ffd23f', size: 18 });
    lab.hud('rise', cfg.rise > 0 && !w0.dead ? `⬆ Ряд мусора снизу через ${Math.max(0, Math.ceil(cfg.rise - (w0.riseT || 0)))} с` : null, { color: '#ff9a8a', size: 14 });
    lab.hud('cycle', cyc ? `Цикл: камень за ${cyc.toFixed(1)} с` : null, { color: '#c8ecff' });
    lab.hud('combo', combo > 0 ? `Серия ×${combo + 1}` : null, { color: '#7cf5ff', size: 16 + Math.min(8, combo * 2) });
    lab.hud('danger', W.some(w => w.danger && !w.dead) ? '⚠ Стакан почти полон!' : null, { color: '#ff5d6c', size: 20 });
  },
  // цели вариаций в одиночной игре: спринт, блиц, копатель
  goals(lab, w, dt) {
    const st = lab.state, cfg = lab.cfg, sp = Math.round(cfg.sprint);
    w.digLeft = w.digTotal ? w.grid.reduce((a, r) => a + r.filter(c => c && c.dig).length, 0) : 0;
    if (w.dead || st.finished) return;
    if (sp > 0 && w.lines >= sp) return this.finish(lab, w, `Спринт: ${sp} линий за ${lab.t.toFixed(1)} с`, Math.max(0, Math.round((sp * 6 - lab.t) * 50)));
    if (w.digTotal && !w.digLeft) return this.finish(lab, w, `Раскопал до дна за ${lab.t.toFixed(1)} с`, Math.max(0, Math.round((w.digTotal / 9 * 12 - lab.t) * 60)));
    if (cfg.blitz > 0) {
      const left = cfg.blitz - lab.t;
      if (left <= 5 && Math.ceil(left) !== st.tick) { st.tick = Math.ceil(left); lab.tone(880, 0.06, 'square', 0.05); } // последние секунды тикают
      if (left <= 0) this.finish(lab, w, `Блиц: ${lab.score} очков за ${Math.round(cfg.blitz)} с`, 0);
    }
  },
  finish(lab, w, text, bonus) {
    const st = lab.state;
    st.finished = true; w.piece = null;
    if (bonus) { this.points(lab, w, bonus); lab.popup(lab.v3(w.ox, this.wy(st.H / 2), 1.4), `Бонус за время +${bonus}`, '#7cf5a8', 30); }
    lab.flash('#ffd23f', 0.3); lab.sfx.win(); w.ornK = 1; this.spin(lab);
    lab.burst(lab.v3(w.ox, this.wy(st.H / 2), 1), { count: 60, colors: ['#ffd23f', '#ffffff', '#7cf5a8'], speed: 12, size: 0.3 });
    lab.after(1.1, () => { if (!st.ended) { st.ended = true; lab.win(text); } });
  },
  // живая камера: еле заметно дышит, к тревоге чуть наезжает, от «Четыре разом» — короткий толчок
  liveCamera(lab, dt) {
    const st = lab.state, v = lab.view, C = st.cam;
    if (!v || !C) return;
    if (Math.abs(v.distance - C.last) > 0.01) C.d = v.distance; // окно поменяло размер — оболочка подобрала новое расстояние
    const danger = st.wells.some(w => w.danger && !w.dead);
    C.punch = Math.max(0, C.punch - dt * 1.6);
    C.k = lab.damp(C.k, (danger ? 0.95 : 1) * (1 - 0.05 * C.punch) * (1 + Math.sin(lab.t * 0.4) * 0.006), 2, dt);
    v.distance = C.d * C.k; C.last = v.distance;
    v.target.y = lab.damp(v.target.y, C.ty + Math.sin(lab.t * 0.27) * 0.12, 2, dt);
  },

  overNote(lab) {
    const st = lab.state, W = st.wells, n = Math.max(1, st.pieces), dry = Math.max(...W.map(w => w.maxDry)), v = this.variant(lab);
    const out = [`Вариация: ${v.name} (как ${v.like}) — ${v.how}`,
      `Цикл: камень за ${(lab.t * W.length / n).toFixed(1)} с, «повернуть и поставить» ${st.pieces} раз, поворотов на камень ${(st.rots / n).toFixed(1)}`,
      W.length > 1 ? `Линий: ${W[0].lines} и ${W[1].lines}, мусора: ${W[0].sent} и ${W[1].sent}` : `Линий: ${W[0].lines} · уровень ${W[0].level} · четыре разом: ${st.tetris} · лучшая серия ×${st.bestCombo}` + (st.pcs ? ` · чистый стакан: ${st.pcs}` : ''),
      `Палка не приходила ${dry} камней подряд` + (lab.cfg.bag >= 1 ? ` (мешок: не больше ${lab.cfg.penta >= 1 ? 24 : 12})` : ' (без мешка — сколько угодно)')];
    if (st.chains || st.booms || st.popped) out.push([st.chains ? `цепочек: ${st.chains}` : '', st.booms ? `взрывов: ${st.booms}` : '', st.popped ? `камней лопнуло цветом: ${st.popped}` : ''].filter(Boolean).join(' · '));
    return out;
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
    st.spawnWarn = mk(new T.BoxGeometry(0.9, 0.9, 0.3), st.warnMat, wells * (st.W + 6) + 2);
    // бомба (вариация «Бомбы»): тёмное ядро с красным фитилём на лице камня
    st.bomb = mk(new T.IcosahedronGeometry(0.34, 0), lab.mat('#ff3b2e', { unlit: true, glow: 2 }), wells * 20 + 10);
  },
  // одна копия: место, размер (число или [x, y, z]), цвет, поворот вокруг Z (лицом к камере)
  put(inst, i, x, y, z, s, color, rz) {
    const t = this.tmp;
    t.P.set(x, y, z); t.Q.setFromEuler(t.E.set(0, 0, rz || 0));
    if (Array.isArray(s)) t.S.set(s[0], s[1], s[2]); else t.S.set(s, s, s);
    inst.setMatrixAt(i, t.M.compose(t.P, t.Q, t.S));
    if (color) inst.setColorAt(i, color);
  },
  // hot — руна горит ярче (падающий камень), rune = false — руны не видно (камень в тумане)
  stoneAt(lab, R, x, y, k, s, color, hot, rune = true) {
    const st = lab.state, t = this.tmp, r = this.RUNE[k];
    this.put(st.stone, R.n, x, y, 0, s, color);
    t.C2.copy(color).lerp(t.white, 0.32);
    this.put(st.plate, R.n, x, y, 0.45 * s, s, t.C2);
    R.n++;
    if (!rune) return;
    if (hot) this.put(st.runeHot, R.h++, x, y, 0.51 * s, [r[1] * s, r[2] * s, s], null, r[0]);
    else this.put(st.rune, R.r++, x, y, 0.51 * s, [r[1] * s, r[2] * s, s], null, r[0]);
  },
  // бомба на лице камня: пульсирует, к фиксации — чаще
  bombAt(lab, R, x, y, s) {
    const st = lab.state;
    if (R.b >= st.bomb.instanceMatrix.count) return;
    this.put(st.bomb, R.b++, x, y, 0.62 * s, s * (0.85 + 0.25 * Math.sin(lab.t * 12)), null, lab.t * 3);
  },
  // вид камня у фигуры: у «Цвета к цвету» две половины своих цветов, иначе — вид фигуры
  cellK(p, i) { return p.ks ? p.ks[i < p.cells.length / 2 ? 0 : 1] : p.k; },

  render(lab) {
    const st = lab.state, t = this.tmp, R = { n: 0, r: 0, h: 0, g: 0, w: 0, b: 0 }, time = lab.t, H = st.H, fog = lab.cfg.fog;
    for (const w of st.wells) {
      const sink = w.bump * 0.09;
      for (let y = 0; y < w.grid.length; y++) for (let x = 0; x < st.W; x++) {
        const c = w.grid[y][x];
        if (!c) continue;
        const C = t.C.copy(this.col[c.k]);
        // туман: легший камень гаснет в цвет плиты, руна пропадает; линия на миг показывает всё
        const hid = fog > 0 && !c.clear && !c.grey && c.seen != null ? lab.clamp((time - c.seen - fog) / 0.5, 0, 1) : 0;
        if (c.grey) C.lerp(t.grey, 0.85);
        else if (c.clear) C.lerp(t.white, 0.75).multiplyScalar(1.5 + 0.4 * Math.sin(time * 40));
        else if (c.f > 0) C.lerp(t.white, Math.min(1, c.f)).multiplyScalar(1 + c.f * 0.6);
        if (hid) C.lerp(this.fogCol, 0.9 * hid);
        this.stoneAt(lab, R, this.wx(w, x), this.wy(c.y) - sink, c.k, c.s * (1 - 0.08 * hid), C, false, hid < 0.6);
        if (c.b && hid < 0.6) this.bombAt(lab, R, this.wx(w, x), this.wy(c.y) - sink, c.s);
      }
      const p = w.piece;
      if (p) {
        const floor = !this.fits(w, p.cells, w.px, w.py - 1), heat = floor && lab.cfg.lock > 0 ? Math.min(1, w.lockT / lab.cfg.lock) : 0;
        const s = 1 + 0.22 * w.spawnK + 0.1 * w.rotK;
        // видно = правда: камень на дне раскаляется — скоро ляжет
        w.pd.forEach(([x, y], i) => {
          const k = this.cellK(p, i), C = t.C.copy(this.col[k]).lerp(t.hot, 0.55 * heat).multiplyScalar(1 + 0.35 * heat * (0.6 + 0.4 * Math.sin(time * 30)));
          this.stoneAt(lab, R, this.wx(w, x), this.wy(y), k, s, C, true);
          if (i === p.bomb) this.bombAt(lab, R, this.wx(w, x), this.wy(y), s);
        });
        let d = 0;
        while (this.fits(w, p.cells, w.px, w.py - d - 1)) d++;
        if (lab.cfg.ghost >= 1 && d > 0) p.cells.forEach(([cx, cy], i) => this.put(st.ghost, R.g++, this.wx(w, w.px + cx), this.wy(w.py - d + cy), -0.05, 1, this.col[this.cellK(p, i)]));
      }
      // тревога: красный контур там, где появится следующий камень
      if (w.danger && !w.dead && st.seq[w.qi]) {
        const k = st.seq[w.qi], K = this.K[k], px = Math.floor((st.W - K.n) / 2), py = H - Math.max(...K.c.map(c => c[1]));
        K.c.forEach(([cx, cy]) => this.put(st.spawnWarn, R.w++, this.wx(w, px + cx), this.wy(py + cy), 0.15, 1));
      }
      // подъём: за полторы секунды до нового ряда мусора под стаканом мигает красный ряд — видно = правда
      const rise = lab.cfg.rise;
      if (rise > 0 && !w.dead && (w.riseT || 0) > rise - 1.5)
        for (let x = 0; x < st.W; x++) if (x !== w.riseGap) this.put(st.spawnWarn, R.w++, this.wx(w, x), this.BASE - 0.5, 1.75, [0.9, 0.7, 1]);
      // предпросмотр: очередь въезжает снизу, когда первый камень ушёл в стакан
      const n = Math.round(lab.cfg.preview), top = this.BASE + H - 1.6, gap = Math.min(2.2, (H - 4) / 5);
      w.slots.count = n;
      for (let i = 0; i < n; i++) {
        const q = w.qi + i, k = st.seq[q];
        if (!k) break;
        const c = this.K[k].c, big = c.length > 4 ? 0.82 : 1, s = (i ? 0.52 : 0.74) * big * (1 + 0.15 * w.prevK * (i === 0)), y = (i ? top - 0.6 - i * gap : top) - w.prevK * gap;
        const mx = c.reduce((a, v) => a + v[0], 0) / c.length, my = c.reduce((a, v) => a + v[1], 0) / c.length, fake = { k, ks: st.pal[q], cells: c }, bomb = this.bombIdx(lab, q, c.length);
        c.forEach(([cx, cy], j) => {
          const kk = this.cellK(fake, j), X = w.pvx + (cx - mx) * s, Y = y + (cy - my) * s;
          this.stoneAt(lab, R, X, Y, kk, s, this.col[kk], false);
          if (j === bomb) this.bombAt(lab, R, X, Y, s);
        });
      }
    }
    st.stone.count = st.plate.count = R.n; st.rune.count = R.r; st.runeHot.count = R.h; st.ghost.count = R.g; st.spawnWarn.count = R.w; st.bomb.count = R.b;
    for (const m of [st.stone, st.plate, st.rune, st.runeHot, st.ghost, st.spawnWarn, st.bomb]) {
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
    // живое плато: орлы кружат над пихтами, бабочки порхают над цветами перед стаканом
    st.eagles = [0, 1, 2].map(i => {
      const e = lab.group(), body = [lab.ball(0.45, '#4a3426', { ...N, scale: [0.7, 0.55, 1.9] }), lab.ball(0.28, '#f1ead8', { ...N, at: [0, 0.1, 0.85] }),
        lab.box(0.5, 0.06, 0.5, '#4a3426', { ...N, at: [0, 0, -0.95], rot: [0, Math.PI / 4, 0] }), lab.box(0.12, 0.08, 0.2, '#ffc23a', { ...N, at: [0, 0.05, 1.1] })];
      lab.merge(body, e);
      const wings = [-1, 1].map(sd => { const w = lab.group({ parent: e }); lab.box(2.6, 0.06, 0.9, '#5a3e2a', { parent: w, at: [sd * 1.35, 0, 0] }); return w; });
      return { e, wings, a: lab.rand(0, 6.3), r: lab.rand(16, 26), cx: lab.rand(-20, 20), y: lab.rand(24, 32), z: lab.rand(-48, -34), v: lab.rand(0.14, 0.22) * (i % 2 ? 1 : -1), ph: i * 2.1 };
    });
    const BF = 14;
    st.flies = { mesh: lab.instances(new T.BoxGeometry(0.34, 0.02, 0.22), lab.mat('#ffffff', { rough: 0.5, glow: 0.3 }), BF, { shadow: false }), list: [] };
    for (let i = 0; i < BF; i++) {
      const o = { x: lab.rand(-F.w / 2 - 4, F.w / 2 + 4), y: lab.rand(0.4, 1.6), z: lab.rand(2.2, 7), ph: lab.rand(0, 6.3), sp: lab.rand(0.5, 1.1) };
      st.flies.list.push(o);
      lab.place(st.flies.mesh, i, [o.x, o.y, o.z], { color: lab.pick(['#ffe66b', '#ff8fc8', '#7cd4ff', '#ffffff', '#ffb35c']) });
    }
    st.flies.mesh.frustumCulled = false;
  },
  // орлы и бабочки: живое плато, пока камни падают
  life(lab, dt) {
    const st = lab.state, t = lab.t;
    for (const o of st.eagles) {
      o.a += o.v * dt;
      const x = o.cx + Math.cos(o.a) * o.r, z = o.z + Math.sin(o.a) * o.r * 0.35;
      o.e.position.set(x, o.y + Math.sin(t * 0.7 + o.ph) * 0.8, z);
      o.e.rotation.y = Math.atan2(-Math.sin(o.a) * o.v, Math.cos(o.a) * o.v * 0.35);
      o.e.rotation.z = -Math.sign(o.v) * 0.25; // крен в вираже
      const flap = Math.sin(t * 0.9 + o.ph) > 0.4 ? Math.sin(t * 9 + o.ph) * 0.45 : 0.08; // взмахи, потом парит
      o.wings[0].rotation.z = flap; o.wings[1].rotation.z = -flap;
    }
    const f = st.flies;
    f.list.forEach((o, i) => {
      o.ph += dt * o.sp;
      const x = o.x + Math.sin(o.ph) * 1.6, y = o.y + Math.sin(o.ph * 2.3) * 0.35 + 0.2, z = o.z + Math.cos(o.ph * 0.8) * 0.9;
      this.put(f.mesh, i, x, y, z, [0.2 + 0.8 * Math.abs(Math.sin(t * 18 + i)), 1, 1], null, Math.sin(o.ph) * 0.3);
    });
    f.mesh.instanceMatrix.needsUpdate = true;
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
    w.streaks = [0, 1, 2, 3, 4].map(() => { const m = lab.box(0.86, 1, 0.1, fxMat(), { at: [0, 0, -0.3], shadow: false }); m.visible = false; return m; });
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
    if (cfg.rise > 0) { // подъём: ряд мусора лезет снизу по часам, а не по соседу
      if (w.riseGap == null) w.riseGap = lab.randInt(0, lab.state.W - 1);
      w.riseT = (w.riseT || 0) + dt;
      if (w.riseT >= cfg.rise) { w.riseT = 0; this.pushRows(lab, w, 1, w.riseGap); w.riseGap = lab.randInt(0, lab.state.W - 1); if (w.dead) return; }
    }
    if (!w.piece) { this.spawn(lab, w); if (!w.piece) return; }
    w.pt += dt;
    // сдвиг: сразу, а если держишь — автоповтор
    const dir = p.left || p.x < -0.5 ? -1 : p.right || p.x > 0.5 ? 1 : 0;
    if (dir !== w.dir) { w.dir = dir; w.das = cfg.das; if (dir) this.shift(lab, w, dir); }
    else if (dir) { w.das -= dt; while (w.das <= 0) { w.das += cfg.arr; if (!this.shift(lab, w, dir)) break; } }
    if (p.pressed.a || p.pressed.up) this.rotate(lab, w);
    if (p.pressed.b) return this.hardDrop(lab, w);
    if (cfg.g20 >= 1) { // 20G: камень всегда лежит на самом низу, куда его ни сдвинь
      while (this.fits(w, w.piece.cells, w.px, w.py - 1)) w.py--;
      w.fallT = 0;
    }
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
    const st = lab.state, k = this.deal(lab, w), q = w.qi - 1, K = this.K[k], cells = K.c.map(c => c.slice());
    w.piece = { k, n: K.n, cells, ks: st.pal[q], bomb: this.bombIdx(lab, q, cells.length) };
    w.px = Math.floor((st.W - K.n) / 2); w.py = st.H - Math.max(...cells.map(c => c[1]));
    w.fallT = w.lockT = w.resets = w.pt = 0;
    if (!this.fits(w, cells, w.px, w.py)) { w.piece = null; return this.topOut(lab, w); }
    w.pd = cells.map(([cx, cy]) => [w.px + cx, w.py + cy + 1.3]); // въезжает сверху
    if (lab.juicy('squash')) { w.spawnK = 1; w.prevK = 1; }
    while (st.seq.length < w.qi + 6) this.more(lab);
  },
  deal(lab, w) {
    const st = lab.state;
    while (st.seq.length < w.qi + 8) this.more(lab);
    const k = st.seq[w.qi++];
    w.sinceI = k === 'I' ? 0 : w.sinceI + 1;
    if (w.sinceI === (lab.cfg.penta >= 1 ? 25 : 13)) lab.count('засухи'); // мешок такого не допускает
    w.maxDry = Math.max(w.maxDry, w.sinceI);
    return k;
  },
  // очередь общая на оба стакана: вид камня и, в «Цвете к цвету», два цвета его половин
  more(lab) {
    const st = lab.state;
    st.seq.push(this.gen(lab));
    st.pal.push(lab.cfg.colors >= 1 ? [lab.pick(this.COLOR_KINDS), lab.pick(this.COLOR_KINDS)] : null);
  },
  // бомба — в каждом N-м камне очереди (у соперников в тех же), в своей клетке фигуры
  bombIdx(lab, q, n) {
    const b = Math.round(lab.cfg.bombs);
    return b > 0 && q % b === b - 1 ? (q * 3) % n : -1;
  },
  // спрятанная механика донора: «мешок» — семь камней перемешаны, по одному до конца мешка; без мешка — чистый случай.
  // С пентамино в мешке тринадцать фигур: семь тетрамино и шесть пентамино
  gen(lab) {
    const st = lab.state, all = (this.ORDER + (lab.cfg.penta >= 1 ? this.PENTA_ORDER : '')).split('');
    if (lab.cfg.bag < 1) return lab.pick(all);
    if (!st.bag.length) {
      st.bag = all;
      for (let i = all.length - 1; i > 0; i--) { const j = lab.randInt(0, i); [all[i], all[j]] = [all[j], all[i]]; }
      lab.count('_secret'); // спрятанная механика сработала: новый мешок
    }
    return st.bag.pop();
  },
  wx(w, x) { return w.ox - w.grid[0].length / 2 + x + 0.5; },
  wy(y) { return this.BASE + y + 0.5; },

  lockPiece(lab, w, hard) {
    const st = lab.state, p = w.piece, flash = lab.juicy('whiten') ? 1 : 0, n = p.cells.length;
    let low = 99, over = false, sx = 0;
    p.cells.forEach(([cx, cy], i) => {
      const x = w.px + cx, y = w.py + cy;
      w.grid[y][x] = { k: this.cellK(p, i), y, f: flash, s: 1, v: 0, b: i === p.bomb, seen: lab.t }; // вспышка фиксации, как в The Grand Master
      over = over || y >= st.H; low = Math.min(low, y); sx += x;
    });
    w.piece = null;
    st.pieces++; lab.count('камни');
    lab.stat('камень за, с', Math.round(10 * lab.t * st.wells.length / st.pieces) / 10);
    w.cyc.push(w.pt); if (w.cyc.length > 8) w.cyc.shift();
    lab.burst([this.wx(w, sx / n), this.wy(low) - 0.5, 0.5], { count: hard ? 14 : 7, colors: ['#f1e2c4', '#c9a77c'], speed: hard ? 4 : 2.5, up: 1.5, size: 0.16 });
    lab.tone(this.note(w, 0) / 2, 0.1, 'sine', 0.12, this.note(w, 0) / 4); lab.noise(0.05, 0.05, 900);
    if (over) return this.topOut(lab, w);
    const cl = this.findClears(lab, w);
    if (!cl.rows.length && !cl.cells.length) { w.combo = -1; this.raiseGarbage(lab, w); return this.checkDanger(lab, w); }
    w.combo++; w.chain = 1;
    this.markClear(lab, w, cl);
  },
  // что исчезнет: полные ряды, а в «Цвете к цвету» — ещё и группы от четырёх камней одного цвета
  findClears(lab, w) {
    const st = lab.state, rows = [], cells = [];
    for (let y = 0; y < st.H; y++) if (w.grid[y].every(Boolean)) rows.push(y);
    if (lab.cfg.colors >= 1) {
      const seen = new Set(), key = (x, y) => y * st.W + x;
      for (let y = 0; y < st.H; y++) for (let x = 0; x < st.W; x++) {
        const c = w.grid[y][x];
        if (!c || c.k === 'X' || seen.has(key(x, y))) continue;
        const grp = [[x, y]]; seen.add(key(x, y));
        for (let i = 0; i < grp.length; i++) for (const [dx, dy] of [[1, 0], [-1, 0], [0, 1], [0, -1]]) {
          const nx = grp[i][0] + dx, ny = grp[i][1] + dy, o = ny >= 0 && ny < st.H && nx >= 0 && nx < st.W && w.grid[ny][nx];
          if (o && o.k === c.k && !seen.has(key(nx, ny))) { seen.add(key(nx, ny)); grp.push([nx, ny]); }
        }
        if (grp.length >= 4) grp.forEach(g => { if (!rows.includes(g[1])) cells.push(g); });
      }
    }
    return { rows, cells };
  },
  // ряды и клетки вспыхивают, через 0,3 с исчезают (collapse); туман на миг отступает
  markClear(lab, w, cl) {
    w.rows = cl.rows; w.kill = cl.cells; w.clearT = w.chain > 1 ? 0.42 : 0.3;
    const up = lab.pitch(Math.max(0, w.combo + w.chain - 1) * 2);
    w.grid.forEach(r => r.forEach(c => { if (c) c.seen = lab.t; }));
    w.rows.forEach((y, i) => {
      w.grid[y].forEach(c => { c.clear = true; });
      const bar = w.bars[i];
      if (bar) {
        bar.visible = true; bar.position.y = this.wy(y);
        bar.material.color.set(w.rows.length >= 4 ? '#ffd23f' : '#fff6dc').multiplyScalar(1.4);
        lab.tween(0.32, (e, raw) => { bar.scale.x = 0.1 + 0.95 * Math.min(1, e * 1.6); bar.material.opacity = 0.9 * (1 - e * e); if (raw >= 1) bar.visible = false; }, 'outCubic');
      }
      lab.tone(this.note(w, 4 + i * 2) * up, 0.12, 'square', 0.05, 0, i * 0.06);
    });
    w.kill.forEach(([x, y], i) => { w.grid[y][x].clear = true; if (i < 6) lab.tone(this.note(w, 6 + i) * up, 0.08, 'triangle', 0.04, 0, i * 0.04); });
    lab.hitstop(0.04);
  },
  collapse(lab, w) {
    const st = lab.state, cfg = lab.cfg, n = w.rows.length, lvl = w.level, Wd = st.W;
    // что исчезает: ряды, группы цвета и всё, что накрыли взрывы бомб (бомба взрывает и соседнюю бомбу)
    const dead = new Map(), add = (x, y) => { const c = w.grid[y] && w.grid[y][x]; if (c && !dead.has(y * Wd + x)) dead.set(y * Wd + x, [x, y, c]); };
    w.rows.forEach(y => { for (let x = 0; x < Wd; x++) add(x, y); });
    w.kill.forEach(([x, y]) => add(x, y));
    const before = dead.size, bombs = [...dead.values()].filter(d => d[2].b);
    for (let i = 0; i < bombs.length; i++) {
      const [bx, by] = bombs[i], at = lab.v3(this.wx(w, bx), this.wy(by), 0.8);
      for (let dy = -2; dy <= 2; dy++) for (let dx = -2; dx <= 2; dx++) {
        if (Math.abs(dx) + Math.abs(dy) > 2) continue;
        const c = w.grid[by + dy] && w.grid[by + dy][bx + dx];
        if (!c || dead.has((by + dy) * Wd + bx + dx)) continue;
        add(bx + dx, by + dy);
        if (c.b) bombs.push([bx + dx, by + dy, c]);
      }
      st.booms++; lab.count('взрывы');
      lab.after(i * 0.08, () => {
        lab.burst(at, { count: 40, colors: ['#ff6a3d', '#ffd34d', '#ffffff'], speed: 11, size: 0.3 });
        lab.ring(at, { color: '#ff8a3d', radius: 3.2, life: 0.4 });
        lab.sfx.explode(); lab.shake(0.35); lab.popup(at, 'Бум!', '#ff8a3d', 30);
      });
    }
    const blasted = dead.size - before, popped = w.kill.length;
    for (const [x, y, c] of dead.values()) {
      lab.burst([this.wx(w, x), this.wy(y), 0.3], { count: n === 4 ? 6 : 4, colors: [this.K[c.k] ? this.K[c.k].color : '#9a9cb8', '#ffffff'], speed: 6, size: 0.24, life: 0.6, gravity: 10, dir: [(x - Wd / 2 + 0.5) * 0.15, 0.6, 0.8] });
      w.grid[y][x] = null;
    }
    w.grid = w.grid.filter((row, y) => !w.rows.includes(y)); // камни выше падают сами: settle
    while (w.grid.length < st.H + 6) w.grid.push(new Array(Wd).fill(null));
    // лавина: каждый камень падает сам до опоры (в «Цвете к цвету» и после взрыва — тоже)
    if (cfg.cascade >= 1 || cfg.colors >= 1 || blasted) {
      for (let x = 0; x < Wd; x++) {
        let to = 0;
        for (let y = 0; y < w.grid.length; y++) {
          const c = w.grid[y][x];
          if (!c) continue;
          if (y !== to) { w.grid[to][x] = c; w.grid[y][x] = null; }
          to++;
        }
      }
    }
    const at = lab.v3(w.ox, this.wy((w.rows.length ? w.rows[0] : (w.kill[0] || [0, 4])[1]) + Math.max(1, n) / 2), 1.2);
    const b2b = n === 4 && w.b2b, pc = w.grid.every(r => r.every(c => !c)), ch = w.chain;
    const pts = Math.round((this.LINE_PTS[Math.min(4, n)] + 40 * popped + 25 * blasted) * lvl * (b2b ? cfg.b2b : 1) * ch);
    const comboPts = ch === 1 && w.combo > 0 ? Math.round(cfg.combo * w.combo * lvl) : 0, pcPts = pc ? 2000 * lvl : 0;
    this.points(lab, w, pts + comboPts + pcPts);
    w.lines += n; if (n) lab.count('линии', n);
    if (popped) { st.popped += popped; lab.count('лопнуло цветом', popped); }
    const name = (ch > 1 ? `Цепочка ×${ch}! ` : '') + (b2b ? 'Снова четыре! ' : ['', '', 'Две линии! ', 'Три линии! ', 'Четыре разом! '][Math.min(4, n)]);
    lab.popup(at, name + '+' + pts, n >= 4 ? '#ffd23f' : ch > 1 ? '#ff9f1c' : popped ? '#7cf5ff' : '#ffffff', 18 + 6 * Math.min(4, n) + (b2b ? 6 : 0) + 4 * (ch - 1));
    if (comboPts) {
      lab.popup(lab.v3(w.ox, at.y + 1.6, 1.2), `Серия ×${w.combo + 1}  +${comboPts}`, '#7cf5ff', 18 + Math.min(12, w.combo * 2));
      if (w.combo === 1) lab.count('серии');
    }
    if (ch === 2) { st.chains++; lab.count('цепочки'); }
    st.bestCombo = Math.max(st.bestCombo, w.combo + 1);
    lab.shake(0.12 * Math.max(1, n) + 0.1 * (ch - 1)); this.cheer(lab, 3 + 0.7 * Math.max(1, n) + (ch - 1), w);
    lab.tone(this.note(w, 0) * lab.pitch((w.combo + ch - 1) * 2), 0.18, 'triangle', 0.07); lab.tone(this.note(w, 2) * lab.pitch((w.combo + ch - 1) * 2), 0.2, 'triangle', 0.06, 0, 0.05);
    if (n >= 4) {
      st.tetris++; lab.count('четыре разом');
      lab.flash('#ffd23f', 0.35); lab.hitstop(0.1); lab.sfx.power(); lab.slowmo(0.35, 0.45);
      lab.burst(at, { count: 60, colors: ['#ffd23f', '#ffffff', '#ff8a3d'], speed: 13, size: 0.3 });
      lab.ring(at, { color: '#ffd23f', radius: Wd * 0.8, life: 0.5 });
      w.ornK = 1; st.cam.punch = 1;
      if (st.mm && lab.juicy('squash')) this.spin(lab);
    }
    if (n) w.b2b = n >= 4;
    if (pc) { // чистый стакан: ни одного камня
      st.pcs++; lab.count('чистый стакан');
      lab.popup(lab.v3(w.ox, this.wy(st.H / 2), 1.2), `Чистый стакан! +${pcPts}`, '#7cf5a8', 34);
      lab.flash('#7cf5a8', 0.3); lab.sfx.win(); w.ornK = 1;
      lab.ring(lab.v3(w.ox, this.wy(2), 1), { color: '#7cf5a8', radius: Wd, life: 0.7 });
    }
    // линии гасят свой мусор, остаток летит соседу
    const other = st.wells.find(x => x !== w);
    let g = Math.round((this.GARBAGE[Math.min(4, n)] + (ch === 1 ? this.COMBO_G[Math.min(w.combo, this.COMBO_G.length - 1)] : ch - 1) + (b2b ? 1 : 0) + (pc ? 4 : 0) + Math.floor((popped + blasted) / 8)) * cfg.garbage);
    const cancel = Math.min(g, w.pending); w.pending -= cancel; g -= cancel;
    if (other && g > 0) this.sendGarbage(lab, w, other, g);
    // после лавины могли собраться новые ряды или группы — цепочка
    const next = this.findClears(lab, w);
    if (next.rows.length || next.cells.length) { w.chain++; this.markClear(lab, w, next); return; }
    this.levelUp(lab, w);
    w.rows = []; w.kill = [];
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
    const n = Math.min(w.pending, 8);
    if (n <= 0) return;
    w.pending -= n;
    this.pushRows(lab, w, n, lab.randInt(0, lab.state.W - 1));
  },
  // n рядов мусора с дырой gap снизу; падающий камень, если его задело, поднимается вместе со стопкой
  pushRows(lab, w, n, gap) {
    const st = lab.state, rows = [];
    for (let r = 0; r < n; r++) rows.push(w.grid[0].map((_, x) => (x === gap ? null : { k: 'X', y: r - n, f: 0, s: 1, v: 0, seen: lab.t })));
    w.grid.unshift(...rows);
    w.grid.splice(st.H + 6);
    if (w.piece) while (!this.fits(w, w.piece.cells, w.px, w.py) && w.py < st.H + 2) w.py++;
    lab.sfx.warn(); lab.shake(0.3);
    lab.burst(lab.v3(w.ox, this.BASE + 0.3, 1.6), { count: 16, colors: ['#ff6a6a', '#9a9cb8'], speed: 4, up: 3, size: 0.2 });
    if (w.grid.slice(st.H).some(r => r.some(Boolean))) this.topOut(lab, w);
    else this.checkDanger(lab, w);
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
    this.life(lab, dt);
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
