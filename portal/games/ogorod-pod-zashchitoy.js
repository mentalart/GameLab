// «Огород под защитой» — ремейк-донор урока 24 по мотивам Plants vs. Zombies (PopCap, 2009), оболочка «Лаб3D 1.0» (three.js).
// План.
// Фраза: ты — хозяйка огорода в ауле, ты сажаешь защитников на грядки, но из леса идут кабанчики, барсуки в касках и вороны.
// Цель — пять дней удержать огород, дальше — ночь на рекорд.
// Ядро на 3 секунды: стрелки — клетка, пробел — посадить → защитник вырастает с прыжком → орех летит по грядке → кабанчик краснеет и отлетает.
// Выбор, оплаченный очками: потратить солнышки на подсолнух сейчас (больше солнышек потом) или на орехомёт (защита сейчас).
// Угрозы: кабанчик (идёт и грызёт), барсук в каске (медленный и крепкий, нужна тыква-стена), вороны (быстрые стаей, нужен улей).
// Кривая партии: день 1 — одна грядка и одна карта, ошибиться не страшно; дни 2–5 — по одному новому защитнику; потом ночь, волны растут.
// События: посадка (рост с прыжком, пыль), выстрел (орех со следом), попадание (вспышка, отлёт), солнышко (летит к счётчику), враг у дома (пёс гонит
// всю грядку — один раз), новый защитник (карта вылетает со свечением), огромная волна (флаг, гул, тряска).
// Спрятанная механика донора — онбординг (обучение делом): одна новая вещь за раз, вовремя и в безопасный момент — карта светится, рука-стрелка
// показывает клетку, враг выходит только после посадки; интерфейс показывает только нужное. Ручка secret 0 — все пять карт и пять грядок сразу,
// правила стеной текста, враги с третьей секунды. Меню доступности (ручки): контраст, значки над врагами, крупный интерфейс, скорость игры.
// Разбор игр жанра — docs/журнал/модуль-6.md, раздел урока 24.
// Лицо игры: солнечный огород у сакли, грядки полосами двух зелёных, плетень, лес справа; приёмы — светящаяся карта и стрелка-рука,
// солнышки летят по дуге к счётчику, у каждого врага свой силуэт. Палитра: трава #7cc35a/#6aae4a, земля #8a5a3c, солнышко #ffd23f,
// опасность #ff5d6e, защитники #4fc35a, дом #f2e6cf. Вид сверху под углом: грядки по Z, столбцы по X, враги идут справа налево.
const GAME = {
  engine: 'three',
  title: 'Огород под защитой',
  subtitle: 'Сажай защитников на грядки и не пусти вредителей к сакле. Каждый день — новый защитник.',
  donor: 'Plants vs. Zombies',
  players: 1,
  lives: 3,
  controls: [
    { input: 'move4', text: 'выбрать клетку' },
    { input: 'a', text: 'посадить' },
    { input: 'b', text: 'следующая карта' },
  ],
  camera: { type: 'iso', tilt: 0.68, target: [0.6, 0, 1.2] },
  field: { w: 26, h: 19 },
  sky: ['#8fd3ff', '#fff0c8'],
  fog: 0.008,
  accent: '#ffd23f',
  scoreColor: '#ffd23f',
  decisions: [
    'Чувство: «я понял сам» — каждый новый защитник приходит, когда он нужен',
    'Честность: враг виден на всей грядке, а первый приходит только после посадки',
    'Выбор: солнышки на подсолнух сейчас или на орехомёт для защиты',
  ],
  config: {
    secret: { value: 1, min: 0, max: 1, step: 1, label: 'Спрятанная механика: обучение делом', restart: true, hint: '0 — все карты и грядки сразу, правила текстом, враги с третьей секунды' },
    allAtOnce: { value: 0, min: 0, max: 1, step: 1, label: 'Всё сразу: пять карт и пять грядок', restart: true, names: ['по дню', 'сразу'] },
    textWall: { value: 0, min: 0, max: 1, step: 1, label: 'Правила стеной текста', restart: true, names: ['нет', 'да'] },
    hand: { value: 1, min: 0, max: 1, step: 1, label: 'Рука-стрелка показывает, что делать', names: ['нет', 'есть'] },
    safe: { value: 1, min: 0, max: 1, step: 1, label: 'Враг приходит после посадки (безопасный момент)', names: ['нет', 'да'] },
    clutter: { value: 0, min: 0, max: 1, step: 1, label: 'Шумный интерфейс', names: ['нет', 'да'] },
    contrast: { value: 0, min: 0, max: 1, step: 1, label: 'Доступность: высокий контраст', names: ['нет', 'да'] },
    icons: { value: 0, min: 0, max: 1, step: 1, label: 'Доступность: значки над врагами (не только цвет)', names: ['нет', 'да'] },
    bigui: { value: 0, min: 0, max: 1, step: 1, label: 'Доступность: крупный интерфейс', names: ['нет', 'да'] },
    speed: { value: 1, min: 0.4, max: 1.5, step: 0.05, label: 'Доступность: скорость игры' },
    sunStart: { value: 150, min: 0, max: 500, step: 25, label: 'Солнышек в начале дня' },
    pestHp: { value: 1, min: 0.5, max: 2, step: 0.1, label: 'Крепость вредителей' },
    waveGap: { value: 9, min: 4, max: 16, step: 0.5, label: 'Секунд между вредителями' },
    lives: { value: 3, min: 1, max: 9, step: 1, label: 'Жизни сакли' },
  },
  presets: {
    'Новичок': { speed: 0.75, sunStart: 250, waveGap: 11 },
    'Без спрятанной механики': { secret: 0 },
    'Всё сразу': { allAtOnce: 1 },
    'Стена текста': { textWall: 1, hand: 0 },
    'Без руки': { hand: 0, safe: 0 },
    'Шумный интерфейс': { clutter: 1 },
    'Доступность': { contrast: 1, icons: 1, bigui: 1, speed: 0.7 },
  },
  notes: [
    'Солнышки сами летят к счётчику: собирать мышью не нужно — меньше лишних действий для новичка.',
    'Пёс у сакли выгоняет всю грядку один раз за партию, потом враг у дома отнимает жизнь.',
  ],
  CARDS: [
    { id: 'shoot', name: 'Орехомёт', cost: 100, cd: 4, hp: 6, col: '#4fc35a', day: 1, tip: 'Стреляет орехами по своей грядке' },
    { id: 'sun', name: 'Подсолнух', cost: 50, cd: 4, hp: 5, col: '#ffd23f', day: 2, tip: 'Даёт солнышки — на них сажают' },
    { id: 'wall', name: 'Тыква', cost: 50, cd: 12, hp: 26, col: '#ff9a3c', day: 3, tip: 'Крепкая стена: держит барсука' },
    { id: 'hive', name: 'Улей', cost: 125, cd: 10, hp: 6, col: '#ffb547', day: 4, tip: 'Пчёлы жалят всех рядом — против стаи' },
    { id: 'pepper', name: 'Перец', cost: 150, cd: 25, hp: 99, col: '#ff3b3b', day: 5, tip: 'Взрыв три на три клетки' },
  ],
  PESTS: {
    boar: { name: 'Кабанчик', hp: 6, speed: 0.7, bite: 1, pts: 10, col: '#8b5a3c' },
    badger: { name: 'Барсук в каске', hp: 18, speed: 0.38, bite: 1, pts: 30, col: '#5a5a6a' },
    crow: { name: 'Ворона', hp: 2, speed: 1.3, bite: 1, pts: 5, col: '#2a2a3a' },
  },
  // дни: какие грядки открыты, какая карта новая, кто идёт и когда новый защитник «нужен»
  DAYS: [
    { lanes: [2], card: 'shoot', sun: 150, list: ['boar', 'boar', 'boar'], need: 0 },
    { lanes: [1, 2, 3], card: 'sun', sun: 50, list: ['boar', 'boar', 'boar', 'boar', 'boar'], need: 0 },
    { lanes: [0, 1, 2, 3, 4], card: 'wall', sun: 150, list: ['boar', 'boar', 'badger', 'boar', 'badger', 'boar', 'boar'], need: 2 },
    { lanes: [0, 1, 2, 3, 4], card: 'hive', sun: 175, list: ['boar', 'boar', 'crow*5', 'boar', 'badger', 'crow*5', 'boar'], need: 2 },
    { lanes: [0, 1, 2, 3, 4], card: 'pepper', sun: 200, list: ['boar', 'badger', 'boar', 'crow*4', 'WAVE', 'boar', 'badger', 'boar', 'crow*4', 'badger'], need: 4 },
  ],
  COLS: 9, CELL: 2.3,

  start(lab, scene) {
    const st = lab.state, c = lab.cfg, sec = c.secret > 0;
    Object.assign(st, {
      onboard: sec && c.allAtOnce < 1, wall: !sec || c.textWall > 0, handOn: sec && c.hand > 0, safe: sec && c.safe > 0, clutter: c.clutter > 0,
      day: 0, sun: 0, defs: [], pests: [], nuts: [], suns: [], cur: [1, 2], card: 0, cool: {}, planted: 0, firstPlant: null, dogs: [1, 1, 1, 1, 1],
      queue: [], spawnT: 0, dayT: 0, phase: 'day', learned: {}, hintT: 0, wallT: 0, night: 0, kills: 0, lost: 0, msgT: 0,
    });
    this._st = st;
    this.world(lab);
    st.cursor = this.buildCursor(lab);
    lab.hero(st.cursor.node);
    st.tray = this.buildTray(lab);
    st.handM = this.buildHand(lab);
    this.startDay(lab, 0);
    if (st.wall) { st.wallT = 6.5; lab.hud('wall', 'ПРАВИЛА: Орехомёт 100 стреляет по грядке. Подсолнух 50 даёт солнышки каждые 9 секунд. Тыква 50 — стена с 26 прочности. Улей 125 жалит всех в радиусе. Перец 150 взрывается 3×3. Кабанчик 6 жизней, барсук 18 и каска, ворона быстрая. Пёс у сакли — один раз. B — смена карты, пробел — посадка…', { color: '#ffffff', size: 15 }); }
  },

  update(lab, dt) {
    const st = lab.state, c = lab.cfg, p = lab.p1;
    dt *= c.speed;
    this.animate(lab, dt);
    if (st.wallT > 0) { st.wallT -= dt; if (st.wallT <= 0) lab.hud('wall', null); }
    // курсор и карты
    if (p.pressed.left) this.moveCur(lab, -1, 0); if (p.pressed.right) this.moveCur(lab, 1, 0);
    if (p.pressed.up) this.moveCur(lab, 0, -1); if (p.pressed.down) this.moveCur(lab, 0, 1);
    if (p.pressed.b) this.nextCard(lab);
    if (p.pressed.a) this.plant(lab);
    for (const k in st.cool) st.cool[k] = Math.max(0, st.cool[k] - dt);
    st.dayT += dt;
    // солнышко с неба — каждые 8 секунд
    st.skySun = (st.skySun || 4) - dt;
    if (st.skySun <= 0) { st.skySun = 8; const L = lab.pick(st.lanes); this.dropSun(lab, this.at(lab.randInt(1, this.COLS - 2), L, 6), 25); }
    this.spawner(lab, dt);
    this.defenders(lab, dt);
    this.pestsStep(lab, dt);
    this.nutsStep(lab, dt);
    this.hint(lab, dt);
    this.hudLines(lab);
  },

  overNote(lab) {
    const st = lab.state;
    lab.stat('до первой посадки', st.firstPlant == null ? 99 : Math.round(st.firstPlant * 10) / 10);
    lab.stat('дней', st.day + (st.phase === 'night' ? 1 : 0));
    return [`Дней продержались: ${Math.min(5, st.day + (st.phase === 'night' ? 1 : 0))} из 5` + (st.night ? `, ночных волн: ${st.night}` : ''),
      `Первая посадка через ${st.firstPlant == null ? '—' : String(Math.round(st.firstPlant * 10) / 10).replace('.', ',')} с · вредителей прогнано: ${st.kills}`,
      st.onboard ? 'Каждый день — одна новая вещь, вовремя и без риска. Сравни с «Без спрятанной механики».' : 'Спрятанная механика выключена: всё сразу и правила текстом. Где ты растерялся?'];
  },

  /* ---------- дни и волны ---------- */
  unlocked(st) { return st.onboard ? this.CARDS.filter(k => k.day <= st.day + 1) : this.CARDS.slice(); },
  startDay(lab, d) {
    const st = lab.state, c = lab.cfg, D = this.DAYS[Math.min(d, 4)];
    st.day = d; st.dayT = 0; st.phase = 'day';
    st.lanes = st.onboard ? D.lanes.slice() : [0, 1, 2, 3, 4];
    st.sun = Math.max(st.sun, st.onboard ? Math.min(c.sunStart, D.sun === 50 ? 50 : c.sunStart) : c.sunStart);
    // очередь вредителей: «crow*5» — стая, WAVE — огромная волна
    const list = st.onboard ? D.list : this.DAYS.slice(0, 3).flatMap(x => x.list).concat(['WAVE', 'boar', 'badger', 'crow*4']);
    st.queue = []; let t = st.onboard ? (st.safe ? 1e9 : 6) : 3; // безопасный момент: первый враг ждёт посадки
    list.forEach((x, i) => { if (x === 'WAVE') { st.queue.push({ t: t + 2, wave: true }); for (let k = 0; k < 6; k++) st.queue.push({ t: t + 4 + k * 0.8, kind: k % 2 ? 'badger' : 'boar' }); t += 10; return; } const m = /^(\w+)\*(\d+)$/.exec(x); if (m) { const lane = lab.pick(st.lanes); for (let k = 0; k < +m[2]; k++) st.queue.push({ t: t + k * 0.5, kind: m[1], lane }); } else st.queue.push({ t, kind: x }); t += i === 0 ? c.waveGap * 0.8 : c.waveGap * (x === 'badger' ? 1.3 : 1); });
    st.waitPlant = st.onboard && st.safe; st.plantedToday = false;
    st.cool = {};
    this.paintLanes(lab); this.paintTray(lab);
    const card = this.CARDS.find(k => k.id === D.card);
    if (st.onboard) {
      st.card = this.unlocked(st).findIndex(k => k.id === D.card);
      lab.popup([0, 4, -3], `День ${d + 1}: новый защитник — ${card.name}`, '#fff1a8', 26);
      st.hintCard = D.need ? null : card.id; st.hintT = 0; st.needAt = D.need;
      lab.tone(523, 0.12, 'triangle', 0.06); lab.tone(784, 0.16, 'triangle', 0.06, 0, 0.1);
      const tc = st.tray.cards.find(k => k.id === card.id); if (tc) { tc.node.scale.setScalar(0.01); lab.tween(0.6, k => tc.node.scale.setScalar(Math.max(0.01, k)), 'outBack'); }
    } else { st.card = 0; st.hintCard = null; }
  },
  spawner(lab, dt) {
    const st = lab.state, c = lab.cfg;
    // безопасный момент: первый враг дня ждёт первой посадки (или 12 секунд — дальше ждать нечестно к остальным)
    if (st.waitPlant && (st.plantedToday || st.dayT > 12)) { st.waitPlant = false; const shift = st.dayT + 2.5; st.queue.forEach(q => { q.t = q.t - 1e9 + shift; }); }
    while (st.queue.length && st.queue[0].t <= st.dayT) {
      const q = st.queue.shift();
      if (q.wave) { lab.popup([0, 5, -2], 'Огромная волна!', '#ff5d6e', 34); lab.shake(0.25); lab.sfx.warn(); lab.noise(1.2, 0.08, 200); if (st.onboard && st.day === 4) { st.hintCard = 'pepper'; st.hintT = 0; } continue; }
      const lane = q.lane != null ? q.lane : lab.pick(st.lanes);
      this.spawnPest(lab, q.kind, lane);
      // новый защитник нужен, когда пришёл его враг: тогда и подсказка
      if (st.onboard && st.needAt && !st.hintCard) { const D = this.DAYS[st.day]; if ((D.card === 'wall' && q.kind === 'badger') || (D.card === 'hive' && q.kind === 'crow')) { st.hintCard = D.card; st.hintT = 0; st.hintLane = lane; } }
    }
    // день окончен: очередь пуста и вредителей нет
    if (st.phase === 'day' && !st.queue.length && !st.pests.length && !st.waitPlant) {
      if (!st.onboard || st.day >= 4) { st.phase = 'night'; st.night = 0; lab.popup([0, 4, -2], st.onboard ? 'Пять дней позади! Ночь — на рекорд' : 'Ночь — на рекорд', '#b49bff', 28); lab.addScore(500, [0, 3, 0], '#ffd23f'); this.nightWave(lab); lab.sfx.win(); }
      else { if (st.plantedToday) lab.addScore(200, [0, 3, 0], '#ffd23f'); lab.count('день'); lab.sfx.coin(); for (let k = 0; k < 5; k++) lab.after(k * 0.15, () => lab.burst([lab.rand(-8, 8), 2, lab.rand(-4, 4)], { count: 16, colors: ['#ffd23f', '#7cf5a8', '#ff7ad9'], speed: 6, up: 4 })); lab.after(1.2, () => this.startDay(lab, st.day + 1)); st.phase = 'pause'; }
    }
    if (st.phase === 'night' && !st.queue.length && !st.pests.length) this.nightWave(lab);
  },
  nightWave(lab) {
    const st = lab.state, n = 4 + st.night * 2;
    st.night++; st.dayT = 0; st.queue = [];
    for (let i = 0; i < n; i++) st.queue.push({ t: 1.5 + i * Math.max(1.2, 4 - st.night * 0.3), kind: lab.pick(st.night > 1 ? ['boar', 'boar', 'badger', 'crow'] : ['boar', 'crow']) });
    lab.popup([0, 4, -2], `Ночная волна ${st.night}`, '#b49bff', 24);
  },
  spawnPest(lab, kind, lane) {
    const st = lab.state, P = this.PESTS[kind], c = lab.cfg;
    const node = this.buildPest(lab, kind);
    const x = this.at(this.COLS, lane)[0] + 1.5 + lab.rand(0, 0.8);
    node.position.set(x, 0, this.at(0, lane)[2]);
    node.scale.setScalar(0.01); lab.tween(0.3, k => node.scale.setScalar(Math.max(0.01, k)), 'outBack');
    st.pests.push({ kind, lane, x, hp: P.hp * c.pestHp, max: P.hp * c.pestHp, node, eat: null, biteT: 0, hitT: 0, ph: lab.rand(0, 6) });
    lab.count('вредители');
  },

  /* ---------- посадка ---------- */
  moveCur(lab, dx, dz) {
    const st = lab.state, lanes = st.lanes;
    st.cur[0] = Math.max(0, Math.min(this.COLS - 1, st.cur[0] + dx));
    if (dz) { const i = lanes.indexOf(st.cur[1]); const ni = Math.max(0, Math.min(lanes.length - 1, (i < 0 ? 0 : i) + dz)); st.cur[1] = lanes[ni]; }
    lab.tone(300 + st.cur[0] * 20, 0.03, 'triangle', 0.02);
  },
  nextCard(lab) { const st = lab.state, U = this.unlocked(st); st.card = (st.card + 1) % U.length; this.paintTray(lab); lab.tone(660, 0.05, 'triangle', 0.04); },
  plant(lab) {
    const st = lab.state, U = this.unlocked(st), card = U[st.card];
    if (!card) return;
    const [col, lane] = st.cur;
    if (!st.lanes.includes(lane)) return;
    if (st.defs.some(d => d.col === col && d.lane === lane)) { lab.popup(this.at(col, lane, 2), 'Клетка занята', '#ffffff', 16); lab.tone(150, 0.08, 'square', 0.04); return; }
    if (st.cool[card.id] > 0) { lab.popup(this.at(col, lane, 2), `${card.name} растёт: ${Math.ceil(st.cool[card.id])} с`, '#bfe9ff', 16); lab.tone(150, 0.08, 'square', 0.04); return; }
    if (st.sun < card.cost) { lab.popup(this.at(col, lane, 2), `Нужно ☀ ${card.cost}`, '#ffd23f', 18); lab.tone(150, 0.08, 'square', 0.04); this.flashSun(lab); return; }
    st.sun -= card.cost; st.cool[card.id] = card.cd;
    const node = this.buildDef(lab, card.id);
    node.position.set(...this.at(col, lane));
    node.scale.setScalar(0.01); lab.tween(0.35, k => node.scale.setScalar(Math.max(0.01, k)), 'outBack');
    lab.burst(this.at(col, lane, 0.3), { count: 12, colors: ['#8a5a3c', '#c8a26a'], speed: 3, up: 2 });
    lab.tone(392, 0.08, 'triangle', 0.06); lab.tone(587, 0.1, 'triangle', 0.05, 0, 0.06);
    const d = { id: card.id, col, lane, hp: card.hp, max: card.hp, node, t: 0, fire: 0.6, made: card.id === 'sun' ? 4 : 0 };
    st.defs.push(d);
    st.planted++; st.plantedToday = true; lab.count('посадки');
    if (st.firstPlant == null) st.firstPlant = lab.t;
    // подсказка сработала: игрок сделал то, что показали, — значит, научился делом
    if (st.hintCard === card.id) { st.hintCard = null; st.learned[card.id] = true; lab.count('_secret'); lab.popup(this.at(col, lane, 3), 'Понял сам!', '#7cf5a8', 20); }
    if (card.id === 'pepper') lab.after(0.8, () => this.boom(lab, d));
    this.paintTray(lab);
  },
  boom(lab, d) {
    const st = lab.state, p = this.at(d.col, d.lane, 0.6);
    st.pests.forEach(e => { if (Math.abs(e.lane - d.lane) <= 1 && Math.abs(e.x - p[0]) < this.CELL * 1.6) this.hurtPest(lab, e, 40, 0); });
    lab.burst(p, { count: 40, colors: ['#ff3b3b', '#ffb547', '#ffd23f'], speed: 9, up: 4 }); lab.ring(p, { color: '#ff8a4c', radius: this.CELL * 1.6, life: 0.5 });
    lab.shake(0.3); lab.hitstop(0.06); lab.sfx.explode();
    this.kill(lab, d);
  },
  kill(lab, d) { const st = lab.state; st.defs = st.defs.filter(x => x !== d); lab.burst(d.node.position, { count: 10, colors: ['#4fc35a', '#8a5a3c'], speed: 3, up: 2 }); d.node.parent && d.node.parent.remove(d.node); },

  /* ---------- защитники, вредители, орехи ---------- */
  defenders(lab, dt) {
    const st = lab.state;
    for (const d of st.defs) {
      d.t += dt;
      if (d.id === 'shoot') {
        d.fire -= dt;
        const ahead = st.pests.some(e => e.lane === d.lane && e.x > this.at(d.col, d.lane)[0] - 0.4 && e.x < this.at(this.COLS, 0)[0] + 2);
        if (ahead && d.fire <= 0) { d.fire = 1.4; this.shoot(lab, d); }
      } else if (d.id === 'sun') {
        d.made -= dt; if (d.made <= 0) { d.made = 9; this.dropSun(lab, this.at(d.col, d.lane, 1.6), 25); lab.pulse(d.node, 1.25, 0.2); }
      } else if (d.id === 'hive') {
        d.fire -= dt;
        const near = st.pests.filter(e => Math.abs(e.lane - d.lane) <= 1 && Math.abs(e.x - this.at(d.col, d.lane)[0]) < this.CELL * 1.6);
        if (near.length && d.fire <= 0) { d.fire = 1.2; near.forEach(e => this.hurtPest(lab, e, 1, 0.2)); lab.burst(this.at(d.col, d.lane, 1.2), { count: 14, color: '#ffd23f', speed: 4, up: 1, size: 0.12 }); lab.tone(880, 0.06, 'sawtooth', 0.02, 1200); }
      }
      d.node.rotation.y = Math.sin(d.t * 2 + d.col) * 0.06;
    }
  },
  shoot(lab, d) {
    const st = lab.state, p = this.at(d.col, d.lane, 1.1);
    let n = st.nuts.find(x => !x.on);
    if (!n) { n = { m: lab.ball(0.22, '#a0703a', { shadow: false, detail: 0 }), on: false }; st.nuts.push(n); }
    n.on = true; n.lane = d.lane; n.m.visible = true; n.m.position.set(p[0] + 0.6, p[1], p[2]);
    lab.pulse(d.node, 0.85, 0.1); lab.tone(520, 0.04, 'square', 0.025, 380); lab.count('выстрелы');
  },
  nutsStep(lab, dt) {
    const st = lab.state, endX = this.at(this.COLS, 0)[0] + 3;
    for (const n of st.nuts) {
      if (!n.on) continue;
      n.m.position.x += 9 * dt; n.m.rotation.z -= dt * 12;
      const e = st.pests.find(q => q.lane === n.lane && Math.abs(q.x - n.m.position.x) < 0.55);
      if (e) { this.hurtPest(lab, e, 1, 0.35); n.on = false; n.m.visible = false; lab.burst(n.m.position, { count: 8, colors: ['#ffffff', '#c8a26a'], speed: 3, dir: [1, 0, 0] }); }
      else if (n.m.position.x > endX) { n.on = false; n.m.visible = false; }
    }
  },
  hurtPest(lab, e, dmg, push) {
    e.hp -= dmg; e.hitT = 0.12; e.x += push; lab.whiten(e.node, 0.08);
    lab.tone(220 * lab.pitch(lab.state.kills % 6), 0.05, 'square', 0.03);
    if (e.hp <= 0 && !e.dead) {
      e.dead = true; const st = lab.state, P = this.PESTS[e.kind];
      if (!e.noPts) { st.kills++; lab.addScore(P.pts, e.node.position, '#ffd23f'); }
      lab.burst(e.node.position, { count: 16, colors: [P.col, '#ffffff', '#ffd23f'], speed: 5, up: 3 });
      lab.tween(0.25, k => { e.node.scale.setScalar(Math.max(0.01, 1 - k)); e.node.position.y = k * 1.2; }, 'inQuad');
      lab.after(0.26, () => { e.node.parent && e.node.parent.remove(e.node); });
      st.pests = st.pests.filter(x => x !== e);
    }
  },
  pestsStep(lab, dt) {
    const st = lab.state, house = this.at(0, 0)[0] - this.CELL * 1.2;
    for (const e of st.pests.slice()) {
      const P = this.PESTS[e.kind];
      e.hitT = Math.max(0, e.hitT - dt);
      // грызёт защитника на своей клетке
      const d = st.defs.find(q => q.lane === e.lane && Math.abs(this.at(q.col, q.lane)[0] - e.x) < 0.9 && q.id !== 'pepper');
      if (d) {
        e.biteT -= dt;
        if (e.biteT <= 0) { e.biteT = 0.5; d.hp -= P.bite; lab.pulse(d.node, 0.9, 0.1); lab.tone(140, 0.04, 'square', 0.02); if (d.hp <= 0) { this.kill(lab, d); lab.count('съедено'); } }
      } else e.x -= P.speed * dt * (e.kind === 'crow' ? 1 : 1);
      e.node.position.x = e.x;
      e.node.position.y = e.kind === 'crow' ? 1.6 + Math.sin(lab.t * 8 + e.ph) * 0.25 : Math.abs(Math.sin(lab.t * 6 + e.ph)) * 0.12;
      if (e.x < house) {
        // пёс у сакли выгоняет всю грядку — один раз
        if (st.dogs[e.lane]) { st.dogs[e.lane] = 0; this.dogRun(lab, e.lane); }
        else { st.pests = st.pests.filter(x => x !== e); e.node.parent && e.node.parent.remove(e.node); st.lost++; lab.count('грядки потеряны'); lab.hurt(this.at(0, e.lane, 1), 'Вредители добрались до сакли'); }
      }
    }
  },
  dogRun(lab, lane) {
    const st = lab.state, dog = st.dogM[lane];
    lab.popup(this.at(1, lane, 2), 'Гав! Пёс выгнал всю грядку', '#ffffff', 18); lab.sfx.power(); lab.shake(0.15);
    const near = this.at(3, 0)[0]; // пёс гонит только тех, кто у самой сакли, и очков за них не даёт
    st.pests.filter(e => e.lane === lane && e.x < near).forEach(e => { e.noPts = true; this.hurtPest(lab, e, 99, 0); });
    if (dog) lab.tween(1.2, k => { dog.position.x = this.at(0, lane)[0] - 2.4 + k * this.CELL * 11; }, 'inQuad');
    lab.after(1.3, () => { if (dog) dog.visible = false; });
  },
  dropSun(lab, from, val) {
    const st = lab.state, s = lab.ball(0.35, lab.mat('#ffd23f', { glow: 1 }), { at: from, shadow: false, detail: 1 });
    const to = this.sunTarget, start = from.slice();
    lab.tween(1.6, k => { const q = k < 0.5 ? k / 0.5 : 1; s.position.set(start[0], Math.max(0.5, start[1] - q * (start[1] - 0.5)), start[2]); }, 'outBounce');
    lab.after(1.7, () => {
      const p0 = s.position.clone();
      lab.tween(0.5, k => { s.position.set(p0.x + (to[0] - p0.x) * k, p0.y + (to[1] - p0.y) * k + Math.sin(k * Math.PI) * 2, p0.z + (to[2] - p0.z) * k); s.scale.setScalar(1 - k * 0.5); }, 'inQuad');
      lab.after(0.5, () => { st.sun += val; s.parent && s.parent.remove(s); lab.tone(880, 0.06, 'triangle', 0.04, 1100); lab.count('солнышки'); this.paintTray(lab); });
    });
  },
  flashSun(lab) { const st = lab.state; st.sunFlash = 0.6; },

  /* ---------- подсказка-рука и «стена текста» ---------- */
  hint(lab, dt) {
    const st = lab.state, h = st.handM, card = st.hintCard;
    h.node.visible = !!(card && st.handOn);
    st.tray.cards.forEach(tc => { tc.glow.visible = !!card && tc.id === card && (lab.cfg.secret > 0); if (tc.glow.visible) tc.glow.scale.setScalar(1 + Math.sin(lab.t * 7) * 0.08); });
    if (!card || !st.handOn) return;
    st.hintT += dt;
    // куда сажать: орехомёт — первая колонка грядки с врагом, подсолнух — первая колонка, тыква — перед барсуком, улей — у стаи, перец — у волны
    const lane = st.hintLane != null ? st.hintLane : st.lanes[Math.floor(st.lanes.length / 2)];
    const col = card === 'sun' ? 0 : card === 'wall' ? 5 : card === 'hive' ? 4 : card === 'pepper' ? 6 : 1;
    const tc = st.tray.cards.find(k => k.id === card), from = tc ? tc.node.position : { x: 0, y: 1, z: -8 }, to = this.at(col, lane, 1.4);
    const k = (st.hintT % 2.2) / 2.2, e = k < 0.7 ? k / 0.7 : 1;
    h.node.position.set(from.x + (to[0] - from.x) * e, 1.6 + Math.sin(e * Math.PI) * 2, from.z + (to[2] - from.z) * e);
    h.ghost.visible = k > 0.7; h.ghost.position.set(to[0], 0.05, to[2]);
    h.dots.forEach((dm, i) => { const q = ((i / h.dots.length) + lab.t * 0.4) % 1; dm.position.set(from.x + (to[0] - from.x) * q, 0.9 + Math.sin(q * Math.PI) * 1.4, from.z + (to[2] - from.z) * q); });
  },
  hudLines(lab) {
    const st = lab.state, c = lab.cfg, big = c.bigui > 0, U = this.unlocked(st), card = U[st.card];
    const sz = (n) => Math.min(32, Math.round(n * (big ? 1.5 : 1)));
    lab.hud('sun', `☀ ${st.sun}`, { color: st.sunFlash > 0 ? '#ff8a8a' : '#ffd23f', size: sz(22) });
    st.sunFlash = Math.max(0, (st.sunFlash || 0) - lab.dt);
    lab.hud('day', st.phase === 'night' ? `Ночь · волна ${st.night}` : `День ${st.day + 1} из 5` + (st.onboard ? '' : ` · вредителей впереди: ${st.queue.length}`), { color: '#ffffff', size: sz(16) });
    lab.hud('card', card ? `Карта: ${card.name} ☀${card.cost}${st.cool[card.id] > 0 ? ` · растёт ${Math.ceil(st.cool[card.id])} с` : ''}${st.onboard && st.hintCard === card.id ? ` — ${card.tip}` : ''}` : null, { color: '#bfe9ff', size: sz(14) });
    lab.hud('keys', st.planted < 2 || big ? 'Стрелки — клетка · пробел — посадить · B — другая карта · P — пауза' : null, { color: '#d8f5c8', size: sz(12) });
    if (st.clutter) {
      lab.hud('c1', `XP ${1200 + st.kills * 37}/5000 · Ур. 17 · ⭐ ${st.kills} · 💎 3 · Сезон 4 · Лига: серебро`, { color: '#ffb547', size: 12 });
      lab.hud('c2', `🎁 Ежедневная награда! · Квест 2/7 · Друзья 3 · FPS 60 · Магазин (−20%) · ⚙`, { color: '#ff8ad0', size: 12 });
    } else { lab.hud('c1', null); lab.hud('c2', null); }
  },

  /* ---------- мир ---------- */
  at(col, lane, h = 0) { return [(col - (this.COLS - 1) / 2) * this.CELL + 0.6, h, (lane - 2) * this.CELL * 0.9]; },
  world(lab) {
    const T = lab.THREE, st = lab.state, c = lab.cfg, hc = c.contrast > 0, O = x => Object.assign({ parent: null }, x);
    this.mats = { hit: lab.mat('#ffffff', { glow: 0.9, unlit: true }) };
    lab.ground({ w: 120, h: 100, color: hc ? '#2a3a22' : '#7cc35a', bumps: 1.4, flat: 0.5 });
    // грядки: клетки двух оттенков, закрытые грядки — под соломой
    st.tiles = lab.instances(new T.BoxGeometry(this.CELL * 0.96, 0.24, this.CELL * 0.86), lab.mat('#ffffff'), this.COLS * 5, { shadow: false });
    st.straw = lab.instances(new T.BoxGeometry(this.CELL * 0.98, 0.34, this.CELL * 0.9), lab.mat(hc ? '#2a2018' : '#d9b86a'), this.COLS * 5, { shadow: false });
    // сакля слева, плетень, лес справа
    const hx = this.at(0, 0)[0] - this.CELL * 3.4;
    lab.merge([
      lab.box(3, 2.4, 10, '#f2e6cf', O({ at: [hx - 1.2, 1.2, -0.5] })), lab.cone(4, 2, '#a4552b', O({ at: [hx - 1.2, 3.4, -0.5], sides: 4, rot: Math.PI / 4, scale: [0.6, 1, 1.9] })),
      lab.box(0.1, 1.6, 1.1, '#6b3d1e', O({ at: [hx + 0.36, 0.8, 1.5] })), lab.box(0.1, 0.8, 0.9, '#5fd3ff', O({ at: [hx + 0.36, 1.6, -2.6], glow: 0.2 })),
    ]);
    const N = 22, posts = lab.instances(new T.CylinderGeometry(0.08, 0.1, 1.2, 5), '#6b4a30', N * 2), wat = lab.instances(new T.BoxGeometry(1.4, 0.6, 0.12), '#a87b4b', N * 2);
    for (let i = 0; i < N; i++) { const x = this.at(0, 0)[0] - 1.6 + i * 1.2; [-1, 1].forEach((s, k) => { const z = s * (this.CELL * 0.9 * 2.5 + 0.5); lab.place(posts, i * 2 + k, [x, 0.6, z]); lab.place(wat, i * 2 + k, [x + 0.6, 0.55, z]); }); }
    const NT = 30, crown = lab.instances(new T.ConeGeometry(1.3, 3.4, 7), hc ? '#1a4a2a' : '#2e7d4a', NT), trunk = lab.instances(new T.CylinderGeometry(0.2, 0.26, 1.2, 6), '#6b4a30', NT);
    for (let i = 0; i < NT; i++) { const x = this.at(this.COLS, 0)[0] + 3 + lab.rand(0, 9), z = lab.rand(-9, 9), s = lab.rand(0.8, 1.4); lab.place(trunk, i, [x, 0.6 * s, z], { scale: s }); lab.place(crown, i, [x, 2.6 * s, z], { scale: s, rot: lab.rand(0, 3) }); }
    const mts = [];
    for (let i = 0; i < 8; i++) { const a = -1.1 + i * 0.3, r = lab.rand(10, 15), h = lab.rand(13, 21), x = Math.sin(a) * 60, z = -46 - Math.cos(a) * 8; mts.push(lab.cone(r, h, '#8a9bd6', O({ at: [x, h / 2 - 2, z], sides: 6 })), lab.cone(r * 0.35, h * 0.35, '#f4f6ff', O({ at: [x, h - 2 - h * 0.17, z], sides: 6 }))); }
    lab.noShadow(lab.merge(mts));
    const fl = lab.instances(new T.IcosahedronGeometry(0.15, 0), lab.mat('#ffffff', { glow: 0.15 }), 90, { shadow: false });
    for (let i = 0; i < 90; i++) { const a = lab.rand(0, 6.28), r = lab.rand(15, 30); lab.place(fl, i, [Math.cos(a) * r * 1.2, 0.12, Math.sin(a) * r * 0.8], { color: lab.pick(['#ff6f91', '#ffd23f', '#ffffff', '#b38cff']) }); }
    // пёс у сакли на каждой грядке
    st.dogM = [0, 1, 2, 3, 4].map(l => { const g = lab.group({ at: [this.at(0, l)[0] - 2.4, 0, this.at(0, l)[2]] }); lab.merge([lab.box(0.9, 0.5, 0.45, '#c8823c', O({ at: [0, 0.45, 0] })), lab.box(0.42, 0.4, 0.4, '#c8823c', O({ at: [0.55, 0.7, 0] })), lab.box(0.12, 0.22, 0.12, '#7a4b25', O({ at: [0.62, 0.95, 0.12] })), lab.box(0.08, 0.35, 0.08, '#c8823c', O({ at: [-0.5, 0.75, 0], rot: [0, 0, 0.6] }))], g); return g; });
    this.sunTarget = [this.at(0, 0)[0] - 1, 5, -9];
    st.clouds = [0, 1, 2, 3].map(i => { const cl = lab.noShadow(lab.merge([[0, 0, 2.4], [2, -0.4, 1.7], [-2, -0.4, 1.6]].map(([x, y, r]) => lab.ball(r, lab.mat('#ffffff', { glow: 0.1 }), O({ at: [x, y, 0], scale: [1, 0.7, 0.8] }))))); cl.position.set(-40 + i * 22, 16 + lab.rand(0, 4), -36 + lab.rand(-6, 6)); return cl; });
  },
  paintLanes(lab) {
    const st = lab.state, hc = lab.cfg.contrast > 0;
    for (let l = 0; l < 5; l++) for (let c = 0; c < this.COLS; c++) {
      const i = l * this.COLS + c, open = st.lanes.includes(l), p = this.at(c, l, open ? 0.02 : -2);
      lab.place(st.tiles, i, [p[0], 0.02, p[2]], { color: hc ? ((c + l) % 2 ? '#3a5a2a' : '#2a4a20') : ((c + l) % 2 ? '#6aae4a' : '#82c75e') });
      lab.place(st.straw, i, open ? [0, -5, 0] : [this.at(c, l)[0], 0.1, this.at(c, l)[2]], { scale: open ? 0 : 1 });
    }
  },
  iconTex(lab, ch, col) {
    this._icons = this._icons || {};
    const key = ch + col; if (this._icons[key]) return this._icons[key];
    const T = lab.THREE, cv = document.createElement('canvas'); cv.width = cv.height = 64; const x = cv.getContext('2d');
    x.fillStyle = col; x.beginPath(); x.arc(32, 32, 28, 0, Math.PI * 2); x.fill(); x.lineWidth = 5; x.strokeStyle = '#ffffff'; x.stroke();
    x.fillStyle = '#ffffff'; x.font = '900 34px system-ui,sans-serif'; x.textAlign = 'center'; x.textBaseline = 'middle'; x.fillText(ch, 32, 34);
    const t = new T.CanvasTexture(cv); t.colorSpace = T.SRGBColorSpace; return (this._icons[key] = t);
  },
  buildPest(lab, kind) {
    const T = lab.THREE, c = lab.cfg, hc = c.contrast > 0, P = this.PESTS[kind], O = x => Object.assign({ parent: null }, x);
    const g = lab.group(), body = lab.group({ parent: g });
    const col = hc ? '#ff3b5c' : P.col, mat = lab.mat(col, hc ? { glow: 0.4 } : {});
    let main;
    if (kind === 'boar') { main = lab.merge([lab.ball(0.6, col, O({ at: [0, 0.65, 0], scale: [1.3, 1, 1], detail: 1 })), lab.box(0.4, 0.34, 0.4, '#b07a5a', O({ at: [-0.85, 0.6, 0] }))], body); lab.merge([lab.box(0.08, 0.22, 0.08, '#fff6e0', O({ at: [-0.95, 0.4, 0.18] })), lab.box(0.08, 0.22, 0.08, '#fff6e0', O({ at: [-0.95, 0.4, -0.18] }))], body); }
    else if (kind === 'badger') { main = lab.merge([lab.ball(0.62, col, O({ at: [0, 0.6, 0], scale: [1.4, 0.9, 1], detail: 1 })), lab.box(0.5, 0.36, 0.42, '#f2efe6', O({ at: [-0.8, 0.62, 0] }))], body); lab.merge([lab.cyl(0.4, 0.46, 0.34, '#c8c8d8', O({ at: [-0.4, 1.12, 0], sides: 8, shiny: true }))], body); }
    else { main = lab.merge([lab.ball(0.38, col, O({ at: [0, 0, 0], scale: [1.3, 0.9, 0.9], detail: 1 })), lab.cone(0.12, 0.4, '#ffb547', O({ at: [-0.55, 0, 0], rot: [0, 0, Math.PI / 2] })), lab.box(0.1, 0.06, 0.9, col, O({ at: [0.1, 0.15, 0] }))], body); }
    lab.merge([lab.ball(0.09, '#ffffff', O({ at: [kind === 'crow' ? -0.35 : -0.75, kind === 'crow' ? 0.12 : 0.82, 0.2], detail: 0 })), lab.ball(0.09, '#ffffff', O({ at: [kind === 'crow' ? -0.35 : -0.75, kind === 'crow' ? 0.12 : 0.82, -0.2], detail: 0 }))], body);
    lab.noShadow(g); body.scale.setScalar(1.35);
    void main; void mat;
    if (hc) { const ring = lab.mesh(new T.RingGeometry(0.75, 0.95, 18), lab.mat('#ffffff', { unlit: true, side: 'double' }), { parent: g, at: [0, 0.05, 0], rot: [-Math.PI / 2, 0, 0], shadow: false }); void ring; }
    if (c.icons > 0) { const sp = new T.Sprite(new T.SpriteMaterial({ map: this.iconTex(lab, kind === 'badger' ? '⛑' : kind === 'crow' ? '↯' : '!', '#ff3b5c'), depthTest: false })); sp.scale.setScalar(0.9); sp.position.set(0, kind === 'crow' ? 0.9 : 1.9, 0); g.add(sp); }
    return g;
  },
  buildDef(lab, id) {
    const c = lab.cfg, hc = c.contrast > 0, O = x => Object.assign({ parent: null }, x), g = lab.group();
    const green = hc ? '#3dff7a' : '#4fc35a';
    if (id === 'shoot') lab.merge([lab.cyl(0.1, 0.14, 0.9, '#3a8a3a', O({ at: [0, 0.45, 0], sides: 5 })), lab.ball(0.5, green, O({ at: [0, 1.15, 0], detail: 1 })), lab.cyl(0.18, 0.22, 0.5, '#2e7a2e', O({ at: [0.45, 1.15, 0], rot: [0, 0, Math.PI / 2], sides: 7 })), lab.ball(0.12, '#ffffff', O({ at: [0.15, 1.38, 0.3], detail: 0 }))], g);
    else if (id === 'sun') lab.merge([lab.cyl(0.08, 0.12, 1.1, '#3a8a3a', O({ at: [0, 0.55, 0], sides: 5 })), lab.cyl(0.62, 0.62, 0.12, '#ffd23f', O({ at: [0, 1.3, 0], rot: [Math.PI / 2 - 0.3, 0, 0], sides: 12, glow: 0.3 })), lab.cyl(0.32, 0.32, 0.16, '#8a5a2c', O({ at: [0, 1.31, 0.04], rot: [Math.PI / 2 - 0.3, 0, 0], sides: 10 }))], g);
    else if (id === 'wall') lab.merge([lab.ball(0.8, '#ff9a3c', O({ at: [0, 0.7, 0], scale: [1, 0.85, 1], detail: 1 })), lab.cyl(0.08, 0.1, 0.3, '#3a8a3a', O({ at: [0, 1.4, 0], sides: 5 }))], g);
    else if (id === 'hive') lab.merge([lab.cyl(0.55, 0.65, 1.1, '#ffb547', O({ at: [0, 0.55, 0], sides: 8 })), lab.cone(0.6, 0.4, '#c8822c', O({ at: [0, 1.3, 0], sides: 8 })), lab.box(0.24, 0.2, 0.1, '#3a2a10', O({ at: [0.45, 0.4, 0] }))], g);
    else lab.merge([lab.cone(0.35, 1.1, '#ff3b3b', O({ at: [0, 0.6, 0], rot: [Math.PI, 0, 0], sides: 7, glow: 0.5 })), lab.cyl(0.08, 0.1, 0.3, '#3a8a3a', O({ at: [0, 1.25, 0], sides: 5 }))], g);
    lab.noShadow(g); g.children.forEach(ch => ch.scale.multiplyScalar(1.3));
    return g;
  },
  buildCursor(lab) {
    const T = lab.THREE, node = lab.group();
    lab.mesh(new T.RingGeometry(1.25, 1.45, 4, 1), lab.mat('#ffffff', { glow: 1, unlit: true, side: 'double' }), { parent: node, at: [0, 0.2, 0], rot: [-Math.PI / 2, 0, Math.PI / 4], shadow: false });
    const preview = lab.mesh(new T.CylinderGeometry(0.4, 0.5, 0.2, 8), lab.mat('#ffffff', { alpha: 0.35, unlit: true }), { parent: node, at: [0, 0.3, 0], shadow: false });
    return { node, preview };
  },
  buildTray(lab) {
    const T = lab.THREE, cards = [];
    this.CARDS.forEach((k, i) => {
      const node = lab.group({ at: [-5.2 + i * 2.6, 0.4, 7.7] });
      const base = lab.mesh(new T.BoxGeometry(2.2, 0.3, 1.6), lab.mat('#fffbe8'), { parent: node, shadow: false });
      const def = this.buildDef(lab, k.id); def.scale.setScalar(0.55); def.position.set(0, 0.15, 0); node.add(def);
      const glow = lab.mesh(new T.RingGeometry(1.5, 1.8, 4, 1), lab.mat('#ffd23f', { glow: 1.6, unlit: true, side: 'double' }), { parent: node, at: [0, 0.2, 0], rot: [-Math.PI / 2, 0, Math.PI / 4], scale: [1.2, 0.8, 1], shadow: false });
      glow.visible = false;
      const cd = lab.mesh(new T.BoxGeometry(2.2, 0.32, 1.6), lab.mat('#1b1430', { alpha: 0.55, unlit: true }), { parent: node, at: [0, 0.01, 0], shadow: false });
      cards.push({ id: k.id, node, base, glow, cd });
    });
    return { cards };
  },
  buildHand(lab) {
    const T = lab.THREE, node = lab.group();
    lab.mesh(new T.ConeGeometry(0.45, 1, 6), lab.mat('#ffd23f', { glow: 1.2, unlit: true }), { parent: node, at: [0, 0, 0], rot: [Math.PI, 0, 0], shadow: false });
    lab.mesh(new T.CylinderGeometry(0.14, 0.14, 0.8, 6), lab.mat('#ffd23f', { glow: 1.2, unlit: true }), { parent: node, at: [0, 0.8, 0], shadow: false });
    const ghost = lab.mesh(new T.CylinderGeometry(0.9, 0.9, 0.1, 16), lab.mat('#7cf5a8', { alpha: 0.45, unlit: true, glow: 0.5 }), { shadow: false });
    const dots = [0, 1, 2, 3, 4, 5].map(() => lab.ball(0.12, lab.mat('#fff3b0', { glow: 1.2, unlit: true }), { shadow: false, detail: 0 }));
    return { node, ghost, dots };
  },
  paintTray(lab) {
    const st = lab.state, U = this.unlocked(st), cur = U[st.card];
    st.tray.cards.forEach(tc => {
      const k = this.CARDS.find(x => x.id === tc.id), open = U.includes(k);
      tc.node.visible = open || !st.onboard; // онбординг: закрытых карт не видно вовсе
      tc.base.material = cur && cur.id === tc.id ? lab.mat('#fff1a8', { glow: 0.2 }) : lab.mat(st.sun >= k.cost ? '#fffbe8' : '#b8b0a0');
      tc.node.position.y = cur && cur.id === tc.id ? 0.8 : 0.4;
    });
  },
  animate(lab, dt) {
    const st = lab.state, t = lab.t;
    if (!st.cursor) return;
    const p = this.at(st.cur[0], st.cur[1]);
    st.cursor.node.position.x = lab.damp(st.cursor.node.position.x, p[0], 22, dt); st.cursor.node.position.z = lab.damp(st.cursor.node.position.z, p[2], 22, dt);
    st.cursor.node.scale.setScalar(1 + Math.sin(t * 6) * 0.04);
    if (st.tray) st.tray.cards.forEach(tc => { const left = st.cool[tc.id] || 0, k = this.CARDS.find(x => x.id === tc.id); tc.cd.visible = left > 0; tc.cd.scale.set(1, 1, Math.max(0.01, left / k.cd)); });
    if (st.handM) { const on = !!(st.hintCard && st.handOn); st.handM.dots.forEach(d => { d.visible = on; }); st.handM.ghost.visible = on && st.handM.ghost.visible; }
    st.defs.forEach(d => { if (d.id === 'sun') d.node.rotation.y = Math.sin(t * 1.5 + d.col) * 0.3; });
    st.clouds.forEach(cl => { cl.position.x += dt * 0.6; if (cl.position.x > 60) cl.position.x = -60; });
  },
};
