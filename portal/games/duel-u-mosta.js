// «Дуэль у моста» — ремейк-донор урока 13 по мотивам механики Clash Royale, оболочка «Лаб3D 1.0» (three.js).
// Модуль 3 «Выбор, вызов, баланс», урок 13: экономика игры и защита баланса.
// Лучшие игры жанра, из которых взяты моменты (разбор — docs/журнал/модуль-3.md, раздел урока 13):
//   Clash Royale — «двойной эликсир» в последние секунды и «обмен в плюс» дешёвой картой против дорогой; взяли эликсир по часам,
//                  руку из 4 карт по кругу из колоды 8, двойной эликсир, режим Double Elixir («Двойной эликсир»), карту Mirror («Зеркало»);
//   Plants vs. Zombies — подсолнух: вложить капли в доход вместо обороны; взяли карту-источник «Родник» (вариация «Родник»);
//   Hearthstone — «ванильная» кривая: чем дороже карта, тем она сильнее; взяли таблицу, где цена уравновешивает силу;
//   StarCraft — ресурс, который копится без дела, — потерянный ресурс; взяли потолок кувшина и счётчик «эликсир впустую»;
//   Kingdom Rush — башня сама бьёт тех, кто вошёл в круг; взяли видимый круг дальности башни;
//   Pokémon и «камень-ножницы-бумага» — у каждого типа свой враг; взяли вариацию «Камень-ножницы-бумага».
// Юниты можно отдать игре таблицей баланса: lab.data.units — до 8 строк { name, cost, hp, dmg, speed, range, count, kind }
// (урок 13, шаг «Таблица баланса»). Пришла таблица — колода и у тебя, и у бота из неё.
// Все юниты одного вида — копии одной детали (InstancedMesh): 60 бойцов рисуются за 16 вызовов отрисовки.
// Вид сверху-сбоку: линия боя идёт по X (твоя башня слева, чужая справа), река Белая течёт поперёк по Z, мост — в середине.
/* ПЛАН
   Фраза игры: ты — нарт-воевода на башне-сакле над рекой Белой, ты выпускаешь бойцов на единственную дорогу через старый мост,
   но капли родника в кувшине приходят по часам, и каждый боец стоит капель. Цель — снести чужую башню или к концу двух минут
   оставить свою целее.
   Ядро на 3 секунды: выбрал карту ← → → поставил метку ↑ ↓ → A: боец падает на дорогу с пылью, капли из кувшина гаснут → идёт к мосту.
   Выбор, оплаченный очками: потратить капли сейчас или копить на великана; защищаться дешёвой картой (обмен в плюс — очки ×серия)
   или пустить врага и ударить в ответ; полный кувшин теряет капли — копить вечно нельзя.
   Угрозы: рой (быстрый, много слабых), мечник и всадник (бьют ближнего), лучницы и катапульта (бьют издалека, катапульта — по площади),
   щитоносец (держит удар), иныж-великан (не отвлекается, идёт только к башне), огненный шар (по площади в любом месте).
   Кривая партии: 0–10 с — капли копятся, первые бойцы, урон башне не раньше 10–15-й секунды (дорога длинная);
   10–40 — первые стычки на мосту; 40–80 — бот собирает натиск с великаном; последние 40 с — «Двойной эликсир!», всё вдвое быстрее;
   последние 10 с — часы тикают.
   События: выпуск карты, приземление бойца, стычка на мосту, обмен в плюс, полный кувшин, башня треснула (75/50/25 %),
   огненный шар с кругом-предупреждением, двойной эликсир (закат), последние секунды, башня пала, ничья.
   Лицо игры: горный полдень над Белой — зелёные берега, бирюзовая вода, белые башни-сакли под шатрами цвета команды;
   в двойной эликсир небо уходит в закат.
   Палитра: синяя команда #3d7bff, красная команда #ff4a3d, капли родника #5ff2ff, золото очков #ffd23f, трава #5c9a3e, дорога #c7a26a,
   вода #2aa6d6, побелка башен #f3ead6. Свет: тёплое солнце, холодное небо в тенях.
   Три фирменных приёма: кувшин с бирюзовой светящейся водой и ряд капель у руки; старый мост, на котором горбятся бойцы и сходятся все стычки;
   цвет команды на поясе, флажке и шатре башни + круг дальности башни на земле.
*/
const GAME = {
  engine: 'three',
  title: 'Дуэль у моста',
  subtitle: 'Две башни над рекой Белой, одна дорога через старый мост. Капли родника стоят бойцов: снеси чужую башню.',
  donor: 'Clash Royale',
  players: 1,
  duo: 'vs', // ручка vs = 1 — игра на двоих за одной клавиатурой
  controls: [
    { input: 'move4', text: '← → карта, ↑ ↓ где выпустить' },
    { input: 'a', text: 'выпустить' },
  ],
  camera: { type: 'iso', tilt: 0.95, fov: 0.55, target: [0, 0, 1.2] },
  field: { w: 31, h: 13 },
  shadowSize: 22,
  sky: ['#58a8ef', '#ffe6b8'],
  fog: 0.006,
  accent: '#ffd23f',
  scoreColor: '#ffd23f',
  lives: 0,
  decisions: [
    'Чувство: напряжение растёт к концу партии — в последние 40 секунд «Двойной эликсир!», небо уходит в закат, всё вдвое быстрее',
    'Честность: капли видно в кувшине, цена — на каждой карте, круг дальности башни и круг огненного шара — на земле заранее',
    'Выбор: потратить капли сейчас или копить на великана; защищаться дешёвой картой или пустить врага и ударить в ответ',
  ],
  notes: [
    'Бойцы падают на дорогу за 1 с (как задержка выпуска в Clash Royale): удар можно увидеть заранее.',
    'Башня бьёт сама всех, кто вошёл в круг дальности; очки дают только твои бойцы, поэтому стоять и ждать — ноль очков.',
    'Великан бьёт только постройки — башню и «Родник»; огненный шар по башне бьёт втрое слабее.',
    'Если цена карты больше потолка кувшина, карта стоит столько, сколько влезает в кувшин: иначе её нельзя сыграть никогда.',
  ],
  config: {
    secret: { value: 1, min: 0, max: 1, step: 1, label: 'Спрятанная механика: экономика', hint: '1 — цена карты уравновешивает её силу, в конце двойной эликсир; 0 — все карты по 4 капли и без двойного эликсира' },
    elixir: { value: 2.8, min: 1, max: 6, step: 0.1, label: 'Капля родника приходит раз в, с' },
    cap: { value: 10, min: 5, max: 20, step: 1, label: 'Потолок кувшина, капель', hint: 'полный кувшин теряет капли — копить вечно нельзя' },
    start: { value: 5, min: 0, max: 10, step: 1, label: 'Капель в начале' },
    double: { value: 40, min: 0, max: 120, step: 5, label: 'Двойной эликсир: последние … с', hint: 'капли текут вдвое быстрее; 0 — без двойного эликсира' },
    time: { value: 120, min: 30, max: 300, step: 10, label: 'Длина партии, с', restart: true },
    towerHp: { value: 2000, min: 500, max: 8000, step: 100, label: 'Прочность башни', restart: true },
    towerDmg: { value: 50, min: 0, max: 300, step: 10, label: 'Урон башни за выстрел' },
    towerRange: { value: 6.5, min: 3, max: 10, step: 0.5, label: 'Дальность башни, м' },
    botSkill: { value: 1, min: 0, max: 2, step: 0.5, label: 'Сила бота', hint: '0 — играет наугад, 1 — защищается и копит на натиск, 2 — быстрее и точнее' },
    vs: { value: 0, min: 0, max: 1, step: 1, label: 'Вдвоём: игрок 2 справа', restart: true },
    // вариации жанра: 0 — как в классике
    doubleAll: { value: 0, min: 0, max: 1, step: 1, label: 'Вариация «Источник»: двойной эликсир всю партию', hint: 'как режим Double Elixir в Clash Royale' },
    noCap: { value: 0, min: 0, max: 1, step: 1, label: 'Вариация «Сток»: без потолка кувшина', hint: 'копи сколько хочешь: капли не пропадают' },
    rps: { value: 0, min: 0, max: 1, step: 1, label: 'Вариация «Кто кого бьёт»: камень-ножницы-бумага', hint: 'мечник бьёт лучниц ×2, лучницы — щитоносца, щитоносец — мечника; рой жалит великана, катапульта — рой' },
    farm: { value: 0, min: 0, max: 1, step: 1, label: 'Вариация «Источник»: карта «Родник»', hint: 'как подсолнух в Plants vs. Zombies: стоит 3, даёт каплю каждые 5 с, пока стоит', restart: true },
    mirror: { value: 0, min: 0, max: 1, step: 1, label: 'Вариация «Зеркало»: бот отвечает той же картой', hint: 'как карта Mirror в Clash Royale: что выпустил ты — то выпускает и он' },
    cheap: { value: 0, min: 0, max: 1, step: 1, label: 'Вариация «Цена»: распродажа — всё вдвое дешевле' },
  },
  presets: {
    'Новичок': { botSkill: 0.5, elixir: 2.4, towerHp: 3200, double: 50 },
    'Без спрятанной механики': { secret: 0 },
    'Вдвоём': { vs: 1 },
    // вариации из настоящих игр: те же значения — в сценарии урока 13 (VARIATIONS), держать вместе
    'Двойной эликсир': { doubleAll: 1 },
    'Без потолка': { noCap: 1 },
    'Камень-ножницы-бумага': { rps: 1 },
    'Родник': { farm: 1 },
    'Зеркало': { mirror: 1 },
    'Распродажа': { cheap: 1 },
  },
  VARIANTS: [
    { key: 'doubleAll', name: 'Двойной эликсир', like: 'Double Elixir в Clash Royale', how: () => 'капли текут вдвое быстрее всю партию' },
    { key: 'noCap', name: 'Без потолка', like: 'ресурсы без предела в стратегиях', how: () => 'кувшин не переполняется — копи сколько хочешь' },
    { key: 'rps', name: 'Камень-ножницы-бумага', like: 'типы в Pokémon', how: () => 'мечник > лучницы > щитоносец > мечник: по своему врагу ×2' },
    { key: 'farm', name: 'Родник', like: 'подсолнух в Plants vs. Zombies', how: () => 'карта «Родник» даёт каплю каждые 5 с, пока стоит' },
    { key: 'mirror', name: 'Зеркало', like: 'карта Mirror в Clash Royale', how: () => 'бот выпускает ту же карту, что и ты' },
    { key: 'cheap', name: 'Распродажа', like: 'акции в магазинах игр', how: () => 'все карты вдвое дешевле' },
  ],

  // таблица по умолчанию: цена уравновешивает силу. Те же строки — UNITS в portal/lessons/urok-13.js (урок отдаёт их в lab.data.units), держать вместе
  UNITS: [
    { name: 'Рой пчёл', cost: 2, hp: 70, dmg: 28, speed: 3, range: 0.5, count: 6, kind: 'рой' },
    { name: 'Нарт-мечник', cost: 3, hp: 620, dmg: 100, speed: 1.5, range: 0.7, count: 1, kind: 'воин' },
    { name: 'Лучницы', cost: 3, hp: 220, dmg: 55, speed: 1.5, range: 5, count: 2, kind: 'стрелок' },
    { name: 'Щитоносец', cost: 4, hp: 1400, dmg: 50, speed: 1.1, range: 0.7, count: 1, kind: 'щит' },
    { name: 'Всадник', cost: 5, hp: 950, dmg: 160, speed: 2.4, range: 0.8, count: 1, kind: 'воин' },
    { name: 'Катапульта', cost: 5, hp: 450, dmg: 170, speed: 0.7, range: 8, count: 1, kind: 'осада' },
    { name: 'Иныж-великан', cost: 7, hp: 2000, dmg: 140, speed: 0.9, range: 0.8, count: 1, kind: 'великан' },
    { name: 'Огненный шар', cost: 4, hp: 1, dmg: 380, speed: 0, range: 2.2, count: 1, kind: 'заклинание' },
  ],
  FARM: { name: 'Родник', cost: 3, hp: 600, dmg: 0, speed: 0, range: 0, count: 1, kind: 'родник' },
  // поведение и облик вида: радиус тела, пауза между ударами, размер, что делает (строка карты)
  KIND: {
    'рой': { r: 0.28, hitT: 0.7, size: 1, what: 'стая: быстрые, слабые поодиночке' },
    'воин': { r: 0.38, hitT: 1.1, size: 1, what: 'бьёт ближнего' },
    'стрелок': { r: 0.35, hitT: 1.0, size: 1, what: 'бьёт издалека' },
    'щит': { r: 0.5, hitT: 1.2, size: 1.08, what: 'много здоровья, держит удар' },
    'великан': { r: 0.8, hitT: 1.5, size: 1.75, what: 'идёт только к постройкам' },
    'осада': { r: 0.6, hitT: 3, size: 1.15, what: 'бьёт по площади издалека' },
    'заклинание': { r: 0, hitT: 0, size: 1, what: 'огонь по площади, куда угодно' },
    'родник': { r: 0.85, hitT: 0, size: 1, what: '+1 капля каждые 5 с, пока стоит' },
  },
  ALIAS: { swarm: 'рой', bees: 'рой', 'пчелы': 'рой', 'пчела': 'рой', warrior: 'воин', 'мечник': 'воин', knight: 'воин', archer: 'стрелок', 'лучник': 'стрелок', 'лучницы': 'стрелок',
    tank: 'щит', 'танк': 'щит', giant: 'великан', siege: 'осада', 'катапульта': 'осада', spell: 'заклинание', magic: 'заклинание', fireball: 'заклинание', 'магия': 'заклинание', 'огонь': 'заклинание', farm: 'родник', 'источник': 'родник' },
  // кто кого бьёт вдвое (вариация «Камень-ножницы-бумага»)
  RPS: { 'воин': 'стрелок', 'стрелок': 'щит', 'щит': 'воин', 'рой': 'великан', 'осада': 'рой' },
  // чем бот отвечает на угрозу
  COUNTER: {
    'рой': ['заклинание', 'осада', 'стрелок', 'рой', 'воин'], 'воин': ['рой', 'щит', 'воин', 'стрелок'], 'стрелок': ['воин', 'заклинание', 'рой', 'щит'],
    'щит': ['рой', 'воин', 'стрелок'], 'великан': ['рой', 'воин', 'стрелок'], 'осада': ['рой', 'воин', 'щит'], 'родник': ['воин', 'стрелок', 'рой'],
  },
  TEAM: [{ c: '#3d7bff', light: '#a9c6ff', dark: '#1d3a8a', name: 'синие' }, { c: '#ff4a3d', light: '#ffb2a8', dark: '#8a1f17', name: 'красные' }],
  ELIX: '#5ff2ff',
  TX: 12.5, // башни на x = ±12,5
  LANE: 1.55, // полуширина дороги и моста
  SLOTS: [-10.6, -8.2, -5.8, -3.2], // где выпустить бойца (для синих; у красных — зеркально)
  SPELLS: [-9, -6, -3, 0, 3, 6, 9], // где ударить огненным шаром
  CARD_X: [-12.55, -9.75, -6.95, -4.15], NEXT_X: -1.95, CARD_Z: 8.1,
  UK: 1.3, // бойцы крупнее жизни: видно краем глаза
  autoP1: null, // для проверки баланса: 'spam' — синие сами играют самой дорогой картой, 'bot' — как бот, 'only:Имя' — одной картой
  autoP2: null, // то же для красных (без него красные — обычный бот)

  /* ---------- новая партия ---------- */
  start(lab, scene) {
    const T = lab.THREE, st = lab.state, cfg = lab.cfg, duo = cfg.vs >= 1;
    st.tmp = { m: new T.Matrix4(), q: new T.Quaternion(), e: new T.Euler(), s: new T.Vector3(), p: new T.Vector3(), c: new T.Color(), w: new T.Color(2.6, 2.6, 2.6), one: new T.Color(1, 1, 1) };
    st.teamCol = this.TEAM.map(t => new T.Color(t.c));
    const rows = this.table(lab);
    st.rows = rows.rows; st.badTable = rows.bad; st.custom = rows.custom;
    Object.assign(st, { units: [], shots: [], over: false, winner: null, banner: false, double: false, tick: 0, drum: 0, snd: {}, sunset: 0, pts: 0, ptsAt: 0 });
    st.sides = [0, 1].map(i => this.makeSide(lab, i, duo || i === 0));
    this.makeSky(lab, scene);
    this.scenery(lab, scene);
    st.sides.forEach(S => this.buildTower(lab, S));
    this.unitParts(lab);
    this.uiParts(lab);
    st.sides.forEach(S => { if (S.human) this.buildHand(lab, S); });
    lab.hero(st.sides[0].tower.hero);
    const v = lab.view; // живая камера: база — расстояние, которое подобрала оболочка
    st.cam = { d: v.distance, k: 1, punch: 0, last: v.distance, tx: v.target.x, tz: v.target.z };
    if (!lab.playing) this.poster(lab);
    this.draw(lab, 0);
  },
  // колода из таблицы ученика (lab.data.units) или из таблицы по умолчанию; кривая таблица зажимается в разумные пределы
  table(lab) {
    const raw = lab.data && lab.data.units;
    let rows = null, bad = false;
    if (Array.isArray(raw)) {
      rows = raw.slice(0, 8).map((r, i) => this.normRow(lab, r, i)).filter(Boolean);
      if (rows.length < 3) { rows = null; bad = true; }
    }
    const same = (a, b) => ['name', 'kind', 'cost', 'hp', 'dmg', 'speed', 'range', 'count'].every(k => a[k] === b[k]);
    const custom = !!rows && !(rows.length === this.UNITS.length && rows.every((r, i) => same(r, this.UNITS[i]))); // таблица урока по умолчанию — это «Классика»
    rows = rows || this.UNITS.map(r => Object.assign({}, r));
    if (lab.cfg.farm >= 1 && !rows.some(r => r.kind === 'родник')) {
      const i = custom ? (rows.length < 8 ? rows.length : rows.length - 1) : rows.findIndex(r => r.name === 'Всадник');
      rows[i < 0 ? rows.length : i] = Object.assign({}, this.FARM);
    }
    if (!rows.some(r => r.kind !== 'заклинание' && r.kind !== 'родник')) rows.push(Object.assign({}, this.UNITS[1])); // без бойцов башню не снести
    return { rows: rows.map((r, i) => Object.assign(r, { id: i })), bad, custom };
  },
  normRow(lab, r, i) {
    if (!r || typeof r !== 'object') return null;
    const k0 = String(r.kind || '').trim().toLowerCase(), k1 = k0.replace(/ё/g, 'е');
    const kind = this.KIND[k0] ? k0 : this.KIND[k1] ? k1 : this.ALIAS[k0] || this.ALIAS[k1] || 'воин';
    const base = this.UNITS.find(u => u.kind === kind) || this.FARM;
    const num = (v, a, b, d) => { const x = Number(v); return Number.isFinite(x) ? lab.clamp(x, a, b) : d; };
    const row = {
      name: String(r.name == null ? '' : r.name).replace(/\s+/g, ' ').trim().slice(0, 16) || `Карта ${i + 1}`, kind,
      cost: Math.round(num(r.cost, 1, 10, base.cost)), hp: Math.round(num(r.hp, 1, 3000, base.hp)), dmg: Math.round(num(r.dmg, 0, 1000, base.dmg)),
      speed: num(r.speed, 0.3, 5, base.speed || 1), range: num(r.range, 0.5, 10, base.range || 0.7), count: Math.round(num(r.count, 1, 8, base.count)),
    };
    if (kind === 'заклинание') { row.count = 1; row.range = lab.clamp(row.range, 1, 4); }
    if (kind === 'родник') { row.count = 1; row.speed = 0; }
    return row;
  },
  makeSide(lab, i, human) {
    const st = lab.state, dir = i ? -1 : 1, deck = st.rows.slice();
    while (deck.length < 5) deck.push(...st.rows.slice(0, 5 - deck.length));
    for (let k = deck.length - 1; k > 0; k--) { const j = lab.randInt(0, k); [deck[k], deck[j]] = [deck[j], deck[k]]; }
    const auto = i === 0 ? this.autoP1 : human ? null : this.autoP2;
    return {
      i, dir, human: human && !auto, p: i ? lab.p2 : lab.p1, hand: deck.slice(0, 4), queue: deck.slice(4), sel: 0, slot: 2, spellSlot: 4,
      elixir: lab.cfg.start, spent: 0, waste: 0, plays: {}, plus: 0, streak: 0, best: 0, towerDmg: 0, kills: 0,
      ai: human && !auto ? null : { t: lab.rand(0.6, 1.4), style: auto, want: lab.rand(4, 8) }, mirrorQ: [], cracks: 0, waste10: 0,
      tower: null, ui: null,
    };
  },

  // афиша в меню: стычка на мосту в разгаре, великан у чужой башни, огненный шар летит. Первый кадр партии всё возвращает
  poster(lab) {
    const st = lab.state, [A, B] = st.sides, find = k => st.rows.find(r => r.kind === k) || st.rows[0];
    const put = (S, card, x, z, hpK) => { const u = this.makeUnit(lab, S, card, { side: S.i, card, cost: 0, alive: 1, gain: 0 }, x, z); u.deployT = 0; u.hp = u.max * (hpK || 1); u.face = S.dir > 0 ? Math.PI / 2 : -Math.PI / 2; return u; };
    put(A, find('великан'), 7.6, 0.2, 0.62).walk = 1.3;
    put(A, find('стрелок'), 3.9, -0.6, 1); put(A, find('стрелок'), 3.6, 0.7, 0.8);
    put(A, find('воин'), 0.5, -0.4, 0.7).lunge = 1;
    put(B, find('воин'), 1.4, 0.3, 0.45);
    for (let k = 0; k < 5; k++) put(B, find('рой'), 2.4 + (k % 3) * 0.45, -0.9 + k * 0.42, 1);
    put(B, find('щит'), 4.9, 1.0, 0.8);
    put(A, find('рой'), -5.5, 0.4, 1); put(B, find('осада'), 9.4, -0.3, 1);
    B.tower.hp = B.tower.max * 0.58; A.tower.hp = A.tower.max * 0.86;
    A.elixir = 7.4; A.sel = 1;
    st.posterShot = { kind: 'fire', side: 0, from: lab.v3(-11, 6.5, 0), to: lab.v3(2.6, 0, -0.2), t: 0.55, dur: 0.9, arc: 4, poster: true };
    st.shots.push(st.posterShot);
    const C = st.cam, v = lab.view;
    C.k = 0.8; v.distance = C.d * C.k; C.last = v.distance; v.target.set(2.2, 0.6, 0.2);
    st.posterOn = true;
  },
  unposter(lab) {
    const st = lab.state;
    if (!st.posterOn) return;
    st.posterOn = false;
    st.units.forEach(u => { u.dead = true; });
    st.units = []; st.shots = [];
    for (const S of st.sides) { S.tower.hp = S.tower.max; S.elixir = lab.cfg.start; S.sel = 0; }
    this.draw(lab, 0);
  },
  variant(lab) {
    const cfg = lab.cfg, on = this.VARIANTS.filter(v => cfg[v.key] > 0);
    const eco = cfg.secret >= 1 ? '' : ' (все карты по 4 капли, без двойного эликсира)';
    if (!on.length) return { name: lab.state.custom ? 'Твоя таблица' : 'Классика', like: 'Clash Royale', how: 'снеси чужую башню или к концу партии оставь свою целее' + eco };
    return { name: on.map(v => v.name).join(' + '), like: on.map(v => v.like).join(', '), how: on.map(v => v.how(cfg)).join('; ') + eco };
  },

  /* ---------- каждый кадр ---------- */
  update(lab, dt) {
    const st = lab.state, cfg = lab.cfg;
    this.unposter(lab);
    if (!st.banner) { // имя вариации и её правило крупно в начале партии
      st.banner = true;
      const v = this.variant(lab);
      lab.popup(lab.v3(0, 4.2, 0), v.name, '#ffe680', 32);
      lab.after(0.4, () => lab.popup(lab.v3(0, 3, 0.4), v.how, '#ffffff', 16));
      if (st.badTable) lab.after(1.2, () => lab.popup(lab.v3(0, 2, 0.8), 'В таблице меньше трёх строк — играем колодой по умолчанию', '#ffb2a8', 15));
    }
    const left = cfg.time - lab.t;
    if (!st.over) {
      this.clock(lab, left);
      for (const S of st.flip ? st.sides : st.sides.slice().reverse()) {
        this.drip(lab, S, dt);
        if (S.human) this.input(lab, S);
        else if (S.ai) this.think(lab, S, dt);
      }
      if (left <= 0) this.timeUp(lab);
    }
    st.flip = !st.flip; // порядок хода чередуется: ни одна сторона не бьёт первой всегда
    const U = st.flip ? st.units.slice().reverse() : st.units;
    for (const u of U) this.stepUnit(lab, u, dt);
    this.separate(lab, dt);
    for (const S of st.flip ? st.sides.slice().reverse() : st.sides) this.stepTower(lab, S, dt);
    this.stepShots(lab, dt);
    st.units = st.units.filter(u => !u.dead);
    if (st.pts >= 1 && lab.t - st.ptsAt > 0.6) { // очки за урон по башне — одной надписью раз в полсекунды
      const n = Math.round(st.pts); st.pts = 0; st.ptsAt = lab.t;
      lab.addScore(n * this.mult(st.sides[0]), st.ptsTower ? lab.v3(this.TX, 6.6, 0) : null, '#ffd23f');
      st.ptsTower = false;
    }
    this.world(lab, dt);
    this.liveCamera(lab, dt);
    this.draw(lab, dt);
    this.hudLines(lab, left);
    const A = st.sides[0];
    lab.stat('эликсир впустую, с', Math.round(A.waste * 10) / 10);
    lab.stat('потрачено, капель', A.spent);
    lab.stat('урон по башне', Math.round(A.towerDmg));
    lab.stat('обмены в плюс', A.plus);
  },
  // часы партии, двойной эликсир, последние секунды, барабан
  clock(lab, left) {
    const st = lab.state, cfg = lab.cfg;
    const dbl = cfg.doubleAll >= 1 || (cfg.secret >= 1 && cfg.double > 0 && left <= cfg.double);
    if (dbl && !st.double) {
      st.double = true;
      lab.count('двойной эликсир');
      if (cfg.secret >= 1) lab.count('_secret');
      if (lab.t > 1) {
        lab.popup(lab.v3(0, 4.6, 0), 'Двойной эликсир!', '#7ff8ff', 34);
        lab.after(0.35, () => lab.popup(lab.v3(0, 3.4, 0.4), 'капли текут вдвое быстрее', '#ffffff', 16));
        lab.flash('#7a4dff', 0.18); lab.sfx.power(); lab.shake(0.25);
        st.sides.forEach(S => { if (S.ui) { lab.ring(S.ui.jar, { color: this.ELIX, radius: 3 }); lab.pulse(S.ui.jar, 1.35, 0.3); } });
        st.cam.punch = 1;
      }
    }
    st.drum -= lab.dt;
    if (st.drum <= 0 && lab.t > 0.5) { // боевой барабан: в двойной эликсир вдвое чаще
      st.drum = st.double ? 0.5 : 1;
      lab.tone(st.double ? 92 : 78, 0.09, 'sine', 0.06); lab.noise(0.05, 0.02, 900);
    }
    if (left <= 10 && left > 0 && Math.ceil(left) !== st.tick) { st.tick = Math.ceil(left); lab.tone(left <= 3 ? 1046 : 880, 0.06, 'square', 0.05); }
  },
  // капли родника: по часам, вдвое быстрее в двойной эликсир; полный кувшин теряет капли
  drip(lab, S, dt) {
    const st = lab.state, cap = this.cap(lab), was = S.elixir;
    S.elixir += dt / lab.cfg.elixir * (st.double ? 2 : 1);
    if (S.elixir >= cap) {
      S.elixir = cap;
      if (S.human || S.ai && S.ai.style) { S.waste += dt; S.waste10 += dt; }
      if (S.ui && S.waste10 > 0.45) { // кувшин переливается: капли бегут через край
        S.waste10 = 0;
        lab.burst(lab.v3(S.ui.jar.position.x, 1.7, S.ui.jar.position.z), { count: 6, color: this.ELIX, speed: 2.5, up: 2, gravity: 9, size: 0.12, life: 0.5 });
        if (S.i === 0 || !st.sides[0].human) lab.tone(1320, 0.04, 'sine', 0.025);
      }
    } else if (S.ui && Math.floor(S.elixir) > Math.floor(was)) {
      lab.pulse(S.ui.jar, 1.08, 0.12);
      if (S.human) lab.tone(1200 + Math.floor(S.elixir) * 40, 0.04, 'sine', 0.025);
    }
  },
  cap(lab) { return lab.cfg.noCap >= 1 ? 99 : lab.cfg.cap; },
  cost(lab, c) {
    let v = lab.cfg.secret >= 1 ? c.cost : 4;
    if (lab.cfg.cheap >= 1) v = Math.max(1, Math.ceil(v / 2));
    return Math.min(v, this.cap(lab));
  },
  power(c) { // сила карты без цены: для проверки «одна карта доминирует»
    const K = this.KIND[c.kind] || this.KIND['воин'];
    if (c.kind === 'заклинание') return c.dmg * 1.1;
    if (c.kind === 'родник') return 150;
    return Math.sqrt(c.count * c.hp * c.count * c.dmg / (K.hitT || 1)) * (c.kind === 'осада' ? 1.4 : 1);
  },
  mult(S) { return 1 + Math.min(3, S.streak); },

  /* ---------- ввод человека ---------- */
  input(lab, S) {
    const p = S.p, st = lab.state;
    if (p.pressed.left) { S.sel = (S.sel + 3) % 4; this.selected(lab, S); }
    if (p.pressed.right) { S.sel = (S.sel + 1) % 4; this.selected(lab, S); }
    const spell = S.hand[S.sel].kind === 'заклинание';
    if (p.pressed.up || p.pressed.down) {
      const d = p.pressed.up ? 1 : -1;
      if (spell) S.spellSlot = lab.clamp(S.spellSlot + d, 0, this.SPELLS.length - 1);
      else S.slot = lab.clamp(S.slot + d, 0, this.SLOTS.length - 1);
      lab.tone(spell ? 520 + S.spellSlot * 60 : 600 + S.slot * 80, 0.04, 'triangle', 0.04);
      lab.pulse(S.ui.marker, 1.25, 0.12);
    }
    if (p.pressed.a && !st.over) {
      const card = S.hand[S.sel], cost = this.cost(lab, card);
      if (S.elixir + 1e-6 < cost) {
        const need = Math.ceil(cost - S.elixir);
        lab.popup(S.ui.cards[S.sel].mesh, `ещё ${need} 💧`, this.ELIX, 18); lab.tone(220, 0.08, 'square', 0.04);
        S.ui.cards[S.sel].mesh.scale.setScalar(0.88);
      } else this.play(lab, S, S.sel, this.markX(S, card));
    }
  },
  selected(lab, S) {
    const c = S.hand[S.sel];
    lab.tone(700 + S.sel * 90, 0.035, 'triangle', 0.04);
    if (c.kind === 'заклинание') S.spellSlot = this.aim(lab, S, true);
  },
  markX(S, card) { return card.kind === 'заклинание' ? S.dir * this.SPELLS[S.spellSlot] : S.dir * this.SLOTS[S.slot]; },
  // куда бить огненным шаром: туда, где враги гуще (индекс точки или x)
  aim(lab, S, index) {
    let best = -1, bv = 0;
    this.SPELLS.forEach((sx, k) => {
      const x = S.dir * sx, R = 2.2;
      let v = 0;
      for (const u of lab.state.units) if (u.side !== S.i && !u.dead && Math.abs(u.x - x) < R) v += this.cost(lab, u.card) / u.card.count;
      if (v > bv) { bv = v; best = k; }
    });
    if (best < 0) best = 4;
    return index ? best : S.dir * this.SPELLS[best];
  },

  /* ---------- выпуск карты ---------- */
  play(lab, S, i, x) {
    const st = lab.state, card = S.hand[i], cost = this.cost(lab, card);
    if (S.elixir + 1e-6 < cost || st.over) return false;
    S.elixir -= cost; S.spent += cost;
    S.queue.push(card); S.hand[i] = S.queue.shift(); // цикл: сыгранная карта уходит в конец колоды, приходит следующая
    if (card.kind !== 'заклинание') x = S.dir > 0 ? lab.clamp(x, -11, -2.6) : lab.clamp(x, 2.6, 11);
    else x = lab.clamp(x, -11.5, 11.5);
    this.deploy(lab, S, card, x);
    if (lab.cfg.secret >= 1 && cost !== 4 && S.i === 0) lab.count('_secret'); // цена не «как у всех»: дешёвая карта — быстрый ответ, дорогая — долгое накопление
    if (S.human || S.ai && S.ai.style) {
      lab.count('выпущено: ' + card.name);
      S.plays[card.name] = (S.plays[card.name] || 0) + 1;
    }
    if (S.ui) this.cardFly(lab, S, i);
    const F = st.sides[1 - S.i];
    if (lab.cfg.mirror >= 1 && S.human && F.ai) F.mirrorQ.push({ card, x });
    const h = S.tower.hero; // воевода на башне машет рукой
    if (h && h.userData.arm) { const arm = h.userData.arm; lab.tween(0.35, k => { arm.rotation.z = -S.dir * (0.3 + 2.2 * Math.sin(k * Math.PI)); }, 'linear'); }
    return true;
  },
  deploy(lab, S, card, x) {
    const st = lab.state, cost = this.cost(lab, card), dep = { side: S.i, card, cost, alive: 0, gain: 0, plus: false };
    const team = this.TEAM[S.i];
    if (card.kind === 'заклинание') {
      const from = lab.v3(S.tower.x + S.dir * 0.3, 6.2, 0), to = lab.v3(x, 0, 0), R = card.range;
      st.shots.push({ kind: 'fire', side: S.i, from, to, t: 0, dur: 0.95, arc: 4.5, dmg: card.dmg, R, dep, src: { side: S.i, kind: 'заклинание', dep, card },
        warn: lab.warn(to, R, 0.95, '#ff7a2a') });
      lab.sfx.whoosh(); lab.tone(180, 0.4, 'sawtooth', 0.04, 90);
      return dep;
    }
    const n = card.count, form = this.formation(n);
    for (let k = 0; k < n; k++) {
      const [dx, dz] = form[k], u = this.makeUnit(lab, S, card, dep, x + dx * S.dir, lab.clamp(dz, -this.LANE, this.LANE));
      dep.alive++; dep.first = dep.first || u;
      u.deployT = 1 + k * 0.03;
    }
    // приземление: круг, пыль, глухой удар — у великана тяжелее
    lab.ring(lab.v3(x, 0.05, 0), { color: team.c, radius: 1.4 + (card.kind === 'великан' ? 1 : 0), life: 0.5 });
    lab.sfx.whoosh();
    lab.after(0.85, () => {
      if (st.over && !S.human) return;
      const heavy = card.kind === 'великан' || card.kind === 'осада';
      lab.burst(lab.v3(x, 0.2, 0), { count: heavy ? 22 : 12, colors: ['#e2c79a', '#c7a26a', '#ffffff'], speed: heavy ? 5 : 3, up: 2, size: 0.18, life: 0.5 });
      lab.tone(heavy ? 70 : 120, 0.18, 'sine', heavy ? 0.12 : 0.07, heavy ? 40 : 80);
      if (heavy) { lab.shake(0.22); lab.hitstop(0.04); } else lab.shake(0.06);
    });
    return dep;
  },
  formation(n) {
    if (n === 1) return [[0, 0]];
    if (n === 2) return [[0, -0.5], [0, 0.5]];
    const out = [], r = n > 6 ? 0.85 : 0.6;
    for (let k = 0; k < n; k++) { const a = (k / n) * Math.PI * 2; out.push([Math.cos(a) * r, Math.sin(a) * r]); }
    return out;
  },
  makeUnit(lab, S, card, dep, x, z) {
    const K = this.KIND[card.kind] || this.KIND['воин'];
    const look = card.kind === 'воин' && card.speed >= 2.2 ? 'всадник' : card.kind;
    const u = { side: S.i, card, dep, kind: card.kind, look, x, z, hp: card.hp, max: card.hp, dmg: card.dmg, speed: card.speed, range: card.range,
      r: K.r * (look === 'всадник' ? 1.4 : 1), hitT: K.hitT, size: K.size, cd: 0.4, deployT: 0, target: null, retarget: 0,
      face: S.dir > 0 ? Math.PI / 2 : -Math.PI / 2, walk: lab.rand(0, 6), lunge: 0, flash: 0, dead: false, life: card.kind === 'родник' ? 40 : 0, gift: 5 };
    lab.state.units.push(u);
    return u;
  },
  // бот (и автоигрок проверки баланса)
  think(lab, S, dt) {
    const st = lab.state, cfg = lab.cfg, B = S.ai;
    B.t -= dt;
    if (B.t > 0 || st.over) return;
    const style = B.style, sk = style ? 1 : cfg.botSkill, dir = S.dir, myX = S.tower.x, cap = this.cap(lab);
    B.t = style && style !== 'bot' ? 0.25 : lab.rand(0.25, 0.5) + (2 - sk) * 0.3;
    const hand = S.hand.map((c, i) => ({ c, i, cost: this.cost(lab, c), pw: this.power(c) }));
    const afford = hand.filter(h => h.cost <= S.elixir + 1e-6);
    const slot = k => dir * this.SLOTS[k];
    if (style === 'spam') { // самая дорогая карта в руке (при равной цене — самая сильная), как только хватает капель
      const top = hand.slice().sort((a, b) => b.cost - a.cost || b.pw - a.pw)[0];
      if (top.cost <= S.elixir + 1e-6) this.play(lab, S, top.i, top.c.kind === 'заклинание' ? this.aim(lab, S) : slot(1));
      return;
    }
    if (style && style.startsWith('only:')) { // одна карта: играть ею, остальными — только чтобы прокрутить колоду при полном кувшине
      const h = afford.find(x => x.c.name === style.slice(5));
      if (h) this.play(lab, S, h.i, h.c.kind === 'заклинание' ? this.aim(lab, S) : slot(1));
      else if (afford.length && S.elixir >= cap - 0.3) { const c = afford.sort((a, b) => a.cost - b.cost)[0]; this.play(lab, S, c.i, c.c.kind === 'заклинание' ? this.aim(lab, S) : slot(0)); }
      return;
    }
    if (cfg.mirror >= 1 && S.mirrorQ.length) { // «Зеркало»: та же карта, на зеркальное место
      const m = S.mirrorQ[0], cost = this.cost(lab, m.card);
      if (S.elixir + 1e-6 >= cost) { S.mirrorQ.shift(); S.elixir -= cost; S.spent += cost; this.deploy(lab, S, m.card, -m.x); lab.popup(lab.v3(-m.x, 2.6, 0), 'Зеркало!', this.TEAM[S.i].light, 18); }
      return;
    }
    const full = S.elixir >= cap - 0.3;
    if (sk >= 0.5) { // защита: враги ближе 13,5 м к нашей башне
      const threats = st.units.filter(u => u.side !== S.i && !u.dead && Math.abs(u.x - myX) < 13.5);
      if (threats.length) {
        const val = us => us.reduce((a, u) => a + this.cost(lab, u.card) / u.card.count * (u.hp / u.max), 0);
        const ours = st.units.filter(u => u.side === S.i && !u.dead && u.kind !== 'великан' && u.kind !== 'родник' && Math.abs(u.x - myX) < 14);
        const tp = val(threats), close = threats.some(u => Math.abs(u.x - myX) < 8);
        if (val(ours) < tp * 0.9 || (close && sk >= 1.5)) {
          const main = threats.reduce((a, u) => (u.hp * u.card.count > a.hp * a.card.count ? u : a));
          let order = (this.COUNTER[main.kind] || ['воин']).slice();
          if (cfg.rps >= 1) { const beat = Object.keys(this.RPS).find(k => this.RPS[k] === main.kind); if (beat) order.unshift(beat); }
          let pick = null;
          for (const k of order) {
            pick = afford.find(h => h.c.kind === k && (k !== 'заклинание' || tp >= h.cost * 0.8));
            if (pick) break;
          }
          if (!pick && (full || close)) pick = afford.filter(h => h.c.kind !== 'великан' && h.c.kind !== 'заклинание' && h.c.kind !== 'родник').sort((a, b) => a.cost - b.cost)[0];
          if (pick) {
            let x;
            if (pick.c.kind === 'заклинание') x = this.aim(lab, S);
            else if (pick.c.kind === 'стрелок' || pick.c.kind === 'осада') x = slot(0);
            else { // встречаем под своей башней: там помогает её огонь
              const want = myX + dir * lab.clamp(Math.abs(main.x - myX) - 2.5, 3, 7);
              x = dir > 0 ? lab.clamp(want, -11, -2.6) : lab.clamp(want, 2.6, 11);
            }
            if (sk < 1) x += lab.rand(-2, 2);
            this.play(lab, S, pick.i, x);
            B.t += lab.rand(0.2, 0.6);
            return;
          }
        }
      }
    }
    // натиск: копим, потом великан или щитоносец за башней, следом поддержка
    // ответный натиск: крепкий боец пережил защиту и идёт к чужой башне — поддержать его сразу, не копя
    const front = sk >= 1 ? st.units.find(u => u.side === S.i && !u.dead && u.deployT <= 0 && u.hp > 250 && u.kind !== 'родник' && (u.x - myX) * dir > 11) : null;
    const want = front ? 3 : sk >= 2 ? 5.5 : sk >= 1 ? 6 : B.want;
    if (S.elixir + 1e-6 < Math.min(want, cap - 0.3) && !full) return;
    let pick = null, x = slot(3);
    if (sk >= 1) {
      const farm = afford.find(h => h.c.kind === 'родник');
      const tank = st.units.find(u => u.side === S.i && !u.dead && (u.kind === 'великан' || u.kind === 'щит') && (u.x - myX) * dir > 2) || front;
      if (farm && !st.units.some(u => u.side === S.i && u.kind === 'родник')) { pick = farm; x = slot(0); }
      else if (tank) {
        pick = afford.filter(h => ['стрелок', 'осада', 'воин', 'рой'].includes(h.c.kind)).sort((a, b) => b.cost - a.cost)[0];
        x = dir > 0 ? lab.clamp(tank.x - 1.5, -11, -2.6) : lab.clamp(tank.x + 1.5, 2.6, 11);
      } else {
        pick = afford.filter(h => h.c.kind === 'великан' || h.c.kind === 'щит').sort((a, b) => b.cost - a.cost)[0];
        x = slot(0);
        if (!pick && full) { pick = afford.filter(h => h.c.kind !== 'заклинание').sort((a, b) => a.cost - b.cost)[0]; x = slot(3); }
      }
    } else {
      const ok = afford.filter(h => h.c.kind !== 'заклинание' || st.units.some(u => u.side !== S.i));
      pick = ok.length ? lab.pick(ok) : null; x = slot(lab.randInt(0, 3)); B.want = lab.rand(3, 9);
      if (pick && pick.c.kind === 'заклинание') x = this.aim(lab, S);
    }
    if (pick) this.play(lab, S, pick.i, x);
  },

  /* ---------- бойцы ---------- */
  alive(t) { return t && !t.dead && t.hp > 0; },
  findTarget(lab, u) {
    const st = lab.state, foe = st.sides[1 - u.side], giant = u.kind === 'великан';
    const sight = giant ? 99 : Math.max(4.5, u.range + 1.5);
    let best = null, bd = Infinity;
    for (const v of st.units) {
      if (v.side === u.side || v.dead || (giant && v.kind !== 'родник')) continue;
      const d = Math.hypot(v.x - u.x, v.z - u.z) - v.r;
      if (d < sight && d < bd) { bd = d; best = v; }
    }
    const T = foe.tower;
    if (T.hp > 0 && (!best || Math.abs(T.x - u.x) - T.r < bd)) best = T;
    return best;
  },
  stepUnit(lab, u, dt) {
    if (u.dead) return;
    u.flash = Math.max(0, u.flash - dt); u.lunge = Math.max(0, u.lunge - dt * 6);
    if (u.deployT > 0) { u.deployT -= dt; return; }
    if (u.kind === 'родник') return this.stepFarm(lab, u, dt);
    if (lab.state.over && lab.state.winner === u.side && !this.alive(lab.state.sides[1 - u.side].tower)) { u.walk += dt * 6; return; } // победители пляшут
    u.retarget -= dt;
    if (u.retarget <= 0 || !this.alive(u.target)) { u.target = this.findTarget(lab, u); u.retarget = 0.25; }
    const t = u.target;
    if (!t) return;
    const dx = t.x - u.x, dz = t.z - u.z, d = Math.hypot(dx, dz) || 0.001, reach = u.range + u.r + t.r;
    if (d > reach) {
      const vx = dx / d, vz = dz / d;
      u.x += vx * u.speed * dt; u.z += vz * u.speed * dt;
      u.face = Math.atan2(vx, vz); u.walk += dt * u.speed * 3.2;
      u.cd = Math.max(u.cd, lab.rand(0.25, 0.4)); // замах после остановки: удар предупреждён
    } else {
      u.face = Math.atan2(dx, dz);
      u.cd -= dt;
      if (u.cd <= 0) { u.cd = u.hitT * lab.rand(0.9, 1.1); this.attack(lab, u, t); }
    }
    if (u.side === 0 && u.x > 1.8) lab.state.pts += dt * 1.5 / u.card.count; // давление: твои бойцы на чужой половине
    if (!u.crossed && u.x * (u.side ? -1 : 1) > 1.8) { // перешёл мост: натиск на чужой половине
      u.crossed = true;
      if (u.side === 0) { lab.state.pts += 3 * this.cost(lab, u.card) / u.card.count; if (u.card.count === 1 || u === u.dep.first) lab.popup(lab.v3(u.x, 2.2, u.z), 'За мост!', this.TEAM[0].light, 13); }
    }
    const L = u.kind === 'рой' ? this.LANE + 0.3 : this.LANE;
    u.z = lab.clamp(u.z, -L, L);
    u.x = lab.clamp(u.x, -this.TX - 1, this.TX + 1);
  },
  stepFarm(lab, u, dt) { // «Родник»: капля каждые 5 с, сам иссякает за 40 с
    const S = lab.state.sides[u.side];
    u.hp -= u.max / 40 * dt; u.walk += dt * 2;
    if (u.hp <= 0) { this.kill(lab, u, null); return; }
    u.gift -= dt;
    if (u.gift <= 0) {
      u.gift = 5;
      S.elixir = Math.min(this.cap(lab), S.elixir + 1);
      lab.popup(lab.v3(u.x, 1.6, u.z), '+1 💧', this.ELIX, 16);
      lab.burst(lab.v3(u.x, 0.6, u.z), { count: 10, color: this.ELIX, speed: 2.5, up: 3, size: 0.14, life: 0.6 });
      if (S.human) lab.sfx.coin();
    }
  },
  separate(lab, dt) { // бойцы не слипаются: расталкиваем пары
    const U = lab.state.units;
    for (let i = 0; i < U.length; i++) {
      const a = U[i];
      if (a.dead || a.kind === 'родник') continue;
      for (let j = i + 1; j < U.length; j++) {
        const b = U[j];
        if (b.dead) continue;
        const dx = b.x - a.x, dz = b.z - a.z, need = (a.r + b.r) * (a.side === b.side ? 0.9 : 1), d2 = dx * dx + dz * dz;
        if (d2 >= need * need || d2 < 1e-6) continue;
        const d = Math.sqrt(d2), push = (need - d) * 0.5;
        let nx = dx / d, nz = dz / d;
        if (a.side !== b.side && a.target !== b && b.target !== a) { nx = 0; nz = Math.abs(dz) > 0.05 ? Math.sign(dz) : (a.side ? -1 : 1); } // чужие, которые не дерутся друг с другом, расходятся вбок
        const wa = b.kind === 'родник' ? 1 : a.r < b.r * 0.6 ? 0.8 : 0.5, wb = 1 - wa;
        a.x -= nx * push * wa * 2; a.z -= nz * push * wa * 2;
        if (b.kind !== 'родник') { b.x += nx * push * wb * 2; b.z += nz * push * wb * 2; }
      }
    }
  },
  attack(lab, u, t) {
    const st = lab.state;
    if (u.kind === 'стрелок') {
      st.shots.push({ kind: 'arrow', side: u.side, from: lab.v3(u.x, 1, u.z), target: t, to: lab.v3(t.x, 0.8, t.z), t: 0, dur: Math.max(0.2, Math.hypot(t.x - u.x, t.z - u.z) / 14), arc: 0.6, dmg: u.dmg, src: u });
      u.lunge = -0.6;
      this.snd(lab, 'bow', 0.12, () => lab.tone(900, 0.05, 'triangle', 0.025, 500));
    } else if (u.kind === 'осада') {
      const to = lab.v3(t.x, 0, t.z), dur = 0.6 + Math.hypot(t.x - u.x, t.z - u.z) * 0.08;
      st.shots.push({ kind: 'stone', side: u.side, from: lab.v3(u.x, 1.2, u.z), target: t, to, t: 0, dur, arc: 3.5, dmg: u.dmg, R: 1.5, src: u,
        warn: lab.warn(to, 1.5, dur, u.side ? '#ff7a5a' : '#7aa8ff') });
      u.lunge = -1;
      this.snd(lab, 'cat', 0.2, () => lab.tone(140, 0.12, 'square', 0.04, 60));
    } else {
      u.lunge = 1;
      this.damage(lab, t, u.dmg, u);
      lab.burst(lab.v3((u.x + t.x) / 2, 0.8 * (u.kind === 'рой' ? 1 : 1), (u.z + t.z) / 2), { count: u.kind === 'рой' ? 3 : 7, colors: ['#ffffff', '#ffe08a', this.TEAM[u.side].light], speed: 3, size: 0.12, life: 0.25, dir: [Math.sin(u.face), 0.3, Math.cos(u.face)] });
      this.snd(lab, 'hit', 0.09, () => lab.tone(u.kind === 'великан' ? 90 : 260 + lab.rand(-40, 40), 0.06, 'square', 0.035, u.kind === 'великан' ? 50 : 140));
      if (u.kind === 'великан' && t.isTower) lab.shake(0.18);
    }
  },
  snd(lab, key, gap, fn) { const s = lab.state.snd; if ((s[key] || -9) + gap > lab.t) return; s[key] = lab.t; fn(); },
  beats(a, b) { return this.RPS[a] === b; },
  damage(lab, t, dmg, src) {
    const st = lab.state;
    if (!this.alive(t) || st.over && t.isTower) return;
    let d = dmg;
    if (lab.cfg.rps >= 1 && src && !t.isTower && this.beats(src.kind, t.kind)) {
      d *= 2;
      if (lab.chance(0.35)) lab.popup(lab.v3(t.x, 1.8, t.z), '×2', '#ffe680', 15);
    }
    if (t.isTower && src && src.kind === 'заклинание') d *= 0.35;
    t.hp -= d; t.flash = 0.09;
    if (!t.isTower && src && src.side === 0 && t.side === 1) st.pts += Math.min(d, t.hp + d) / 40; // очки за бой твоих бойцов
    if (t.isTower) this.towerHit(lab, t, d, src);
    else if (t.hp <= 0) this.kill(lab, t, src);
  },
  kill(lab, u, src) {
    const st = lab.state;
    if (u.dead) return;
    u.dead = true; u.hp = 0;
    const team = this.TEAM[u.side], at = lab.v3(u.x, 0.6 * u.size, u.z), big = u.kind === 'великан';
    lab.burst(at, { count: big ? 28 : u.kind === 'рой' ? 5 : 12, colors: [team.c, team.light, '#ffffff'], speed: big ? 6 : 4, size: big ? 0.26 : 0.16, life: 0.55 });
    if (big || u.kind === 'осада' || u.kind === 'родник') { lab.ring(at, { color: team.c, radius: 2, life: 0.45 }); lab.shake(0.2); lab.hitstop(0.05); this.snd(lab, 'boom', 0.1, () => lab.sfx.explode()); }
    const dep = u.dep;
    if (dep) dep.alive--;
    if (!src || !src.dep || src.side === u.side) return;
    const S = st.sides[src.side];
    if (S.human || S.ai && S.ai.style) S.kills++;
    if (src.side === 0) lab.addScore(Math.round(10 * this.cost(lab, u.card) / u.card.count * this.mult(S)), u.kind === 'рой' ? null : lab.v3(u.x, 1.4, u.z), '#ffd23f');
    // дешёвый боец снял дорогого — спрятанная механика «цена уравновешивает силу» в деле
    if (lab.cfg.secret >= 1 && this.cost(lab, src.card || src.dep.card) < this.cost(lab, u.card)) lab.count('_secret');
    if (dep && dep.alive <= 0 && src.dep !== dep) {
      src.dep.gain += dep.cost;
      if (!src.dep.plus && src.dep.gain > src.dep.cost) this.plusTrade(lab, S, src.dep, at);
    }
  },
  // обмен в плюс: твоя карта сняла врагов дороже себя
  plusTrade(lab, S, dep, at) {
    dep.plus = true;
    const gain = dep.gain - dep.cost, team = this.TEAM[S.i];
    if (S.human || S.ai && S.ai.style) { lab.count('обмены в плюс'); S.plus++; }
    if (!S.human) { lab.popup(lab.v3(at.x, 2.2, at.z), `Враг выиграл обмен: +${gain} 💧`, team.light, 14); return; }
    S.streak++; S.best = Math.max(S.best, S.streak);
    const m = this.mult(S);
    if (S.i === 0) lab.addScore(50 * gain * m);
    lab.popup(lab.v3(at.x, 2.4, at.z), `Обмен в плюс: +${gain} 💧` + (m > 1 ? ` · ×${m}` : ''), '#7cf5a8', 20);
    lab.burst(at, { count: 16, colors: [this.ELIX, '#7cf5a8', '#ffffff'], speed: 5, size: 0.16 });
    lab.tone(660 * lab.pitch(S.streak), 0.12, 'triangle', 0.06); lab.tone(990 * lab.pitch(S.streak), 0.14, 'triangle', 0.05, null, 0.08);
  },

  /* ---------- башни ---------- */
  stepTower(lab, S, dt) {
    const T = S.tower, st = lab.state;
    T.flash = Math.max(0, T.flash - dt);
    if (T.hp <= 0 || st.over) return;
    T.cd -= dt;
    if (T.cd > 0) return;
    const R = lab.cfg.towerRange;
    let best = null, bd = R;
    for (const u of st.units) {
      if (u.side === S.i || u.dead || u.deployT > 0.4) continue;
      const d = Math.hypot(u.x - T.x, u.z) - u.r;
      if (d < bd) { bd = d; best = u; }
    }
    if (!best) { T.cd = 0.15; return; }
    T.cd = 0.8;
    if (lab.cfg.towerDmg <= 0) return;
    st.shots.push({ kind: 'bolt', side: S.i, from: lab.v3(T.x + S.dir * 0.6, 4.6, 0), target: best, to: lab.v3(best.x, 0.8, best.z), t: 0, dur: 0.22, arc: 0.4, dmg: lab.cfg.towerDmg, src: null });
    this.snd(lab, 'tw' + S.i, 0.3, () => lab.tone(S.i ? 700 : 760, 0.05, 'triangle', 0.03, 420));
  },
  towerHit(lab, T, d, src) {
    const st = lab.state, S = st.sides[T.side], F = st.sides[1 - T.side];
    if (F.human || F.ai && F.ai.style) F.towerDmg += d;
    if (T.side === 1) { st.pts += d / 10; st.ptsTower = true; }
    T.wob = 1;
    const frac = Math.max(0, T.hp) / T.max, crack = Math.floor((1 - frac) * 10 + 1e-9);
    if (crack > S.cracks && T.hp > 0) { // каждые 10 % прочности: урон игроку, серия обменов сгорает
      S.cracks = crack;
      lab.popup(lab.v3(T.x, 6.2, 0), crack % 3 === 0 ? `Башня треснула: ${Math.round(frac * 100)}%` : `Башня: ${Math.round(frac * 100)}%`, T.side ? '#ffe680' : '#ff8a7a', crack % 3 === 0 ? 22 : 17);
      lab.burst(lab.v3(T.x, 3, 0.8), { count: 18, colors: ['#f3ead6', '#d9b27c', '#8c7f73'], speed: 5, up: 2, size: 0.22, gravity: 12 });
      if (S.human) { lab.hurt(lab.v3(T.x, 3, 0.8)); S.streak = 0; } else { lab.shake(0.3); lab.sfx.hit(); }
      st.cam.punch = 0.6;
    }
    if (T.hp <= 0) this.towerFalls(lab, S);
  },
  towerFalls(lab, S) {
    const st = lab.state, T = S.tower, F = st.sides[1 - S.i];
    if (st.over) return;
    T.hp = 0;
    if (F.human || F.ai && F.ai.style) lab.count('башни');
    if (F.i === 0) lab.addScore(1000, lab.v3(T.x, 5, 0), '#ffd23f');
    lab.slowmo(0.9, 0.3); lab.shake(0.85); lab.hitstop(0.12); lab.flash('#ffffff', 0.35);
    lab.burst(lab.v3(T.x, 3, 0), { count: 30, colors: ['#f3ead6', '#d9b27c', this.TEAM[S.i].c, '#ffffff'], speed: 9, up: 3, size: 0.35, gravity: 12, life: 1.1 });
    lab.ring(lab.v3(T.x, 0.1, 0), { color: '#ffd23f', radius: 6, life: 0.8 });
    lab.sfx.explode();
    const g = T.g;
    lab.tween(1.3, k => { g.position.y = -4.2 * k * k; g.rotation.z = S.dir * 0.35 * k; }, 'inQuad');
    lab.popup(lab.v3(T.x, 5.5, 0), 'Башня пала!', '#ffd23f', 32);
    this.finish(lab, F.i, 'tower');
  },
  timeUp(lab) {
    const st = lab.state, [A, B] = st.sides, a = A.tower.hp / A.tower.max, b = B.tower.hp / B.tower.max;
    if (Math.abs(a - b) < 0.005) this.finish(lab, -1, 'time');
    else this.finish(lab, a > b ? 0 : 1, 'time');
  },
  finish(lab, winner, how) {
    const st = lab.state, duo = st.sides[1].human;
    if (st.over) return;
    st.over = true; st.winner = winner;
    const A = st.sides[0], hp = S => Math.round(100 * Math.max(0, S.tower.hp) / S.tower.max);
    const res = winner < 0 ? 'ничья' : winner === 0 ? 'победа' : 'поражение';
    lab.stat('исход', res);
    if (winner === 0 && how === 'time') lab.addScore(500);
    if (winner < 0) lab.addScore(100);
    if (how === 'time') { lab.popup(lab.v3(0, 4.6, 0), winner < 0 ? 'Ничья!' : `Время! Целее башня ${this.TEAM[winner].name}х`, '#ffe680', 28); lab.sfx.beep(); }
    if (winner >= 0) lab.after(0.8, () => lab.burst(lab.v3(st.sides[winner].tower.x, 6, 0), { count: 40, colors: ['#ffd23f', '#ffffff', this.TEAM[winner].c], speed: 8, up: 4, size: 0.25, life: 1.2 }));
    const text = duo ? (winner < 0 ? `Ничья: башни ${hp(A)}% и ${hp(st.sides[1])}%` : `Победил игрок ${winner + 1}` + (how === 'tower' ? ' — башня снесена!' : ` — башня целее: ${hp(st.sides[winner])}%`))
      : winner === 0 ? (how === 'tower' ? 'Победа! Чужая башня снесена' : `Победа по времени: твоя башня ${hp(A)}%, чужая ${hp(st.sides[1])}%`)
      : winner < 0 ? `Ничья: обе башни по ${hp(A)}%`
      : how === 'tower' ? 'Твою башню снесли' : `Время вышло: твоя башня ${hp(A)}%, чужая ${hp(st.sides[1])}%`;
    lab.after(how === 'tower' ? 2 : 1.6, () => { if (winner === 0 || duo && winner > 0) lab.win(text); else lab.gameOver(text); });
  },

  /* ---------- снаряды ---------- */
  stepShots(lab, dt) {
    const st = lab.state;
    for (const p of st.shots) {
      if (p.poster) continue;
      p.t += dt;
      if (p.target && this.alive(p.target) && p.kind !== 'stone') p.to.set(p.target.x, p.target.isTower ? 3 : 0.8, p.target.z);
      if (p.t >= p.dur) { p.done = true; this.impact(lab, p); }
    }
    st.shots = st.shots.filter(p => !p.done);
  },
  impact(lab, p) {
    const st = lab.state, at = p.to;
    if (p.kind === 'arrow' || p.kind === 'bolt') {
      if (this.alive(p.target)) this.damage(lab, p.target, p.dmg, p.src);
      lab.burst(at, { count: 4, colors: ['#ffffff', p.side ? '#ffb2a8' : '#a9c6ff'], speed: 2.5, size: 0.1, life: 0.2 });
      return;
    }
    // площадь: камень катапульты и огненный шар бьют всех врагов в круге
    const R = p.R, src = p.src;
    for (const u of st.units.slice()) if (u.side !== p.side && !u.dead && Math.hypot(u.x - at.x, u.z - at.z) < R + u.r) this.damage(lab, u, p.dmg, src);
    const T = st.sides[1 - p.side].tower;
    if (Math.abs(T.x - at.x) < R + T.r && Math.abs(at.z) < R + T.r) this.damage(lab, T, p.dmg, src);
    const fire = p.kind === 'fire';
    lab.burst(lab.v3(at.x, 0.4, at.z), { count: fire ? 30 : 14, colors: fire ? ['#ffd23f', '#ff7a2a', '#ff4a3d', '#ffffff'] : ['#c7a26a', '#8c7f73', '#ffffff'], speed: fire ? 7 : 4, up: 2, size: fire ? 0.3 : 0.2, life: 0.6 });
    lab.ring(lab.v3(at.x, 0.06, at.z), { color: fire ? '#ff7a2a' : '#e2c79a', radius: R * 1.1, life: 0.45 });
    lab.shake(fire ? 0.32 : 0.14); if (fire) lab.hitstop(0.05);
    this.snd(lab, fire ? 'fire' : 'stone', 0.08, () => (fire ? lab.sfx.explode() : lab.tone(90, 0.15, 'sine', 0.08, 50)));
    if (fire) this.scorch(lab, at.x, at.z, R);
  },

  /* ---------- мир: небо, долина Белой, мост, сакли, горы ---------- */
  makeSky(lab, scene) {
    const T = lab.THREE;
    if (this.skyTex) this.skyTex.dispose();
    const c = document.createElement('canvas'); c.width = 2; c.height = 256;
    this.skyCanvas = c; this.skyTex = new T.CanvasTexture(c); this.skyTex.colorSpace = T.SRGBColorSpace;
    scene.background = this.skyTex;
    const st = lab.state;
    st.skyA = { top: new T.Color('#58a8ef'), bot: new T.Color('#ffe6b8'), sun: new T.Color('#fff2dc') };
    st.skyB = { top: new T.Color('#3a3a8c'), bot: new T.Color('#ff9a5a'), sun: new T.Color('#ffb070') };
    st.skyNow = { top: new T.Color(), bot: new T.Color(), sun: new T.Color() };
    this.paintSky(lab, 0);
  },
  paintSky(lab, k) {
    const st = lab.state, A = st.skyA, B = st.skyB, N = st.skyNow;
    N.top.copy(A.top).lerp(B.top, k); N.bot.copy(A.bot).lerp(B.bot, k); N.sun.copy(A.sun).lerp(B.sun, k);
    const g = this.skyCanvas.getContext('2d'), gr = g.createLinearGradient(0, 0, 0, 256);
    gr.addColorStop(0, '#' + N.top.getHexString()); gr.addColorStop(0.62, '#' + N.bot.getHexString()); gr.addColorStop(1, '#' + N.bot.getHexString());
    g.fillStyle = gr; g.fillRect(0, 0, 2, 256);
    this.skyTex.needsUpdate = true;
    if (lab.scene && lab.scene.fog) lab.scene.fog.color.copy(N.bot);
    if (lab.light && lab.light.sun) { lab.light.sun.color.copy(N.sun); lab.light.sun.intensity = 2 - 0.55 * k; }
  },
  scenery(lab, scene) {
    const T = lab.THREE, st = lab.state, TX = this.TX, L = this.LANE;
    lab.ground({ w: 170, h: 170, color: '#4f8a36', bumps: 4, flat: 0.32 });
    for (const sx of [-1, 1]) lab.box(17, 0.05, 20, '#5c9a3e', { at: [sx * 10.1, 0.02, 0.4], shadow: false }); // луг, где идёт бой, по обе стороны реки
    // дорога от башни к мосту: плитки двух оттенков
    const tile = lab.instances(new T.BoxGeometry(1.05, 0.05, 1.05), '#ffffff', 96, { shadow: false });
    let n = 0;
    for (let x = -TX - 1.5; x <= TX + 1.5; x += 1.1) {
      if (Math.abs(x) < 1.8) continue;
      for (const z of [-1.1, 0, 1.1]) lab.place(tile, n++, [x + lab.rand(-0.05, 0.05), 0.05, z + lab.rand(-0.06, 0.06)], { rot: lab.rand(-0.08, 0.08), color: lab.pick(['#c7a26a', '#bf9960', '#d2ae76', '#b88f58']) });
    }
    tile.count = n;
    // обочины: кочки травы, цветы
    const tuft = lab.instances(new T.ConeGeometry(0.12, 0.4, 4), '#ffffff', 200, { shadow: false });
    for (let i = 0; i < 200; i++) {
      let x, z; do { x = lab.rand(-17, 17); z = lab.rand(-8, 4.2); } while (Math.abs(z) < L + 0.5 || Math.abs(x) < 2);
      lab.place(tuft, i, [x, 0.18, z], { rot: lab.rand(0, 3), scale: [1, lab.rand(0.6, 1.4), 1], color: lab.pick(['#4a8a35', '#5fa043', '#3f7a2e', '#6aa847']) });
    }
    const flower = lab.instances(new T.IcosahedronGeometry(0.09, 0), '#ffffff', 90, { shadow: false });
    for (let i = 0; i < 90; i++) {
      let x, z; do { x = lab.rand(-17, 17); z = lab.rand(-7.5, 4.3); } while (Math.abs(z) < L + 0.4 || Math.abs(x) < 2);
      lab.place(flower, i, [x, 0.28, z], { color: lab.pick(['#fff6e0', '#ffd23f', '#ff8ac4', '#c79bff', '#ffffff']) });
    }
    // река Белая поперёк: вода, берега из камней, пена плывёт вниз по течению
    lab.box(3.6, 0.06, 170, '#2f5a26', { at: [0, 0.01, 0], shadow: false });
    const water = lab.box(2.9, 0.06, 170, '#2aa6d6', { at: [0, 0.03, 0], shadow: false, shiny: true });
    water.material.roughness = 0.25;
    const rock = lab.instances(new T.DodecahedronGeometry(0.35, 0), '#ffffff', 70);
    for (let i = 0; i < 70; i++) {
      const s = i % 2 ? 1 : -1, z = lab.rand(-40, 30);
      if (Math.abs(z) < L + 0.4) continue;
      lab.place(rock, i, [s * lab.rand(1.45, 2.1), 0.05, z], { rot: [lab.rand(0, 3), lab.rand(0, 3), 0], scale: lab.rand(0.6, 1.5), color: lab.pick(['#a99a88', '#bfb19e', '#8f8273']) });
    }
    st.foam = [...Array(36)].map(() => ({ x: lab.rand(-1.1, 1.1), z: lab.rand(-40, 30), s: lab.rand(0.5, 1.2), v: lab.rand(2.5, 4) }));
    st.foamI = lab.instances(new T.BoxGeometry(0.5, 0.03, 0.18), lab.mat('#e8fbff', { alpha: 0.75 }), st.foam.length, { shadow: false });
    // старый каменный мост: настил, перила, арка — единственная дорога
    const br = [];
    br.push(lab.box(3.8, 0.22, 3.6, '#b8a58a', { at: [0, 0.12, 0] }));
    for (const z of [-1.85, 1.85]) {
      br.push(lab.box(4.2, 0.55, 0.28, '#cbb89a', { at: [0, 0.45, z] }));
      for (const x of [-2, 2]) br.push(lab.box(0.42, 0.95, 0.42, '#a8957a', { at: [x, 0.47, z] }));
    }
    br.push(lab.cyl(1.25, 1.25, 3.4, '#8f7f68', { at: [0, -0.55, 0], rot: [Math.PI / 2, 0, 0], sides: 10 }));
    lab.merge(br);
    const plank = lab.instances(new T.BoxGeometry(0.34, 0.04, 3.2), '#ffffff', 10, { shadow: false });
    for (let i = 0; i < 10; i++) lab.place(plank, i, [-1.62 + i * 0.36, 0.25, 0], { color: lab.pick(['#9a6a3e', '#8a5a35', '#a8784a']) });
    // круг дальности башни на земле: «видно = правда»
    st.rangeRings = [0, 1].map(i => {
      const m = lab.mesh(new T.RingGeometry(1, 1.04, 72).rotateX(-Math.PI / 2), lab.mat(this.TEAM[i].c, { unlit: true, alpha: 0.5 }).clone(), { at: [i ? TX : -TX, 0.09, 0], shadow: false });
      return m;
    });
    // сакли и плетни на берегах за дорогой
    const huts = [];
    const hut = (x, z, r) => {
      const g = lab.group({ at: [x, 0, z], rot: r, parent: null });
      huts.push(lab.box(3, 1.7, 2.2, '#f3ead6', { parent: g, at: [0, 0.85, 0] }));
      huts.push(lab.box(3.4, 0.25, 2.6, '#9a5a3a', { parent: g, at: [0, 1.82, 0] }));
      huts.push(lab.cone(2.25, 1.1, '#b8693f', { parent: g, at: [0, 2.45, 0], sides: 4, rot: Math.PI / 4, scale: [1.05, 1, 0.78] }));
      huts.push(lab.box(0.55, 0.95, 0.06, '#6a4a32', { parent: g, at: [0.6, 0.48, 1.12] }));
      huts.push(lab.box(0.5, 0.42, 0.06, '#ffcf6a', { parent: g, at: [-0.7, 1.05, 1.12], glow: 0.4 }));
      return g;
    };
    const hutGroups = [hut(-7.6, -8.6, 0.1), hut(-3.9, -10.2, -0.15), hut(4.6, -9, 0.12), hut(8.4, -10.4, -0.1), hut(-19, -6.5, 0.6), hut(19.5, -7, -0.5)];
    lab.merge(hutGroups);
    // плетни вдоль дороги
    const post = lab.instances(new T.CylinderGeometry(0.05, 0.07, 0.8, 5), '#6a4a32', 60);
    let pn = 0;
    for (let x = -15; x <= 15; x += 1.25) {
      if (Math.abs(x) < 2.6 || Math.abs(Math.abs(x) - TX) < 2.4) continue;
      lab.place(post, pn++, [x, 0.4, -(L + 0.75)], { rot: lab.rand(-0.1, 0.1) });
    }
    post.count = pn;
    const rails = [];
    for (const s of [-1, 1]) for (const y of [0.3, 0.6]) {
      rails.push(lab.box(7.4, 0.08, 0.06, '#86603e', { at: [s * 6.25, y, -(L + 0.75)] }));
    }
    lab.merge(rails);
    // пихты и буки по краям, тополя у реки
    const N = 46, crown = lab.instances(new T.ConeGeometry(1, 1, 7), '#ffffff', N), trunk = lab.instances(new T.CylinderGeometry(0.1, 0.15, 1, 5), '#5a3d2b', N);
    for (let i = 0; i < N; i++) {
      let x, z;
      if (i < 18) { x = (i % 2 ? 1 : -1) * lab.rand(17, 30); z = lab.rand(-14, 9); } else if (i < 34) { x = lab.rand(-16, 16); z = lab.rand(-16, -8.5); } else { x = (i % 2 ? 1 : -1) * lab.rand(2.4, 4); z = lab.rand(-14, -8.2); }
      const h = lab.rand(2.6, 5);
      lab.place(trunk, i, [x, 0.5, z], { scale: [1, 1.1, 1] });
      lab.place(crown, i, [x, 1 + h / 2, z], { scale: [h * 0.24, h, h * 0.24], rot: lab.rand(0, 3), color: lab.pick(['#2f6e3a', '#3a7d42', '#28603a', '#447f3c']) });
    }
    const bush = lab.instances(new T.IcosahedronGeometry(0.6, 0), '#ffffff', 26);
    for (let i = 0; i < 26; i++) {
      let x, z; do { x = lab.rand(-18, 18); z = lab.rand(-8, -2.8); } while (Math.abs(x) < 2.2 || Math.abs(Math.abs(x) - TX) < 2.6);
      lab.place(bush, i, [x, 0.35, z], { scale: [lab.rand(0.7, 1.3), lab.rand(0.6, 0.9), lab.rand(0.7, 1.2)], color: lab.pick(['#4f9a3c', '#5fa846', '#3f8a36']) });
    }
    // горы Кавказа задником: синие конусы со снежными шапками
    const peaks = [];
    for (let i = 0; i < 16; i++) {
      const x = -80 + i * 10.5 + lab.rand(-3, 3), h = lab.rand(12, 24), z = -48 - lab.rand(0, 14);
      peaks.push(lab.cone(h * 0.65, h, i % 2 ? '#6f86b8' : '#7d93c2', { at: [x, h / 2 - 1, z], sides: 5, rot: lab.rand(0, 3) }));
      peaks.push(lab.cone(h * 0.2, h * 0.3, '#ffffff', { at: [x, h * 0.85 - 1, z], sides: 5, rot: lab.rand(0, 3) }));
    }
    for (let i = 0; i < 10; i++) { const x = -60 + i * 13, h = lab.rand(5, 9); peaks.push(lab.cone(h * 1.1, h, '#4f7a4a', { at: [x, h / 2 - 1, -30 - lab.rand(0, 5)], sides: 6, rot: lab.rand(0, 3) })); }
    lab.noShadow(lab.merge(peaks));
    // облака и птицы: движение без игрока
    st.clouds = [...Array(7)].map(() => ({ x: lab.rand(-60, 60), y: lab.rand(14, 20), z: lab.rand(-46, -30), s: lab.rand(2, 3.5), v: lab.rand(0.6, 1.4) }));
    st.cloudI = lab.instances(new T.IcosahedronGeometry(1, 1), lab.mat('#ffffff', { rough: 1 }), st.clouds.length * 3, { shadow: false });
    st.birds = [...Array(6)].map((_, i) => ({ a: i, r: lab.rand(8, 16), y: lab.rand(8, 12), cx: lab.rand(-8, 8), cz: lab.rand(-14, -8), v: lab.rand(0.2, 0.35) }));
    const wing = lab.addons.BufferGeometryUtils.mergeGeometries([new T.BoxGeometry(0.5, 0.04, 0.12).rotateZ(0.35).translate(-0.22, 0, 0), new T.BoxGeometry(0.5, 0.04, 0.12).rotateZ(-0.35).translate(0.22, 0, 0)]);
    st.birdI = lab.instances(wing, '#2a2a3a', st.birds.length, { shadow: false });
    st.scorchI = lab.instances(new T.CircleGeometry(1, 14).rotateX(-Math.PI / 2), lab.mat('#2a2018', { alpha: 0.4 }), 10, { shadow: false });
    st.scorchN = 0;
  },
  scorch(lab, x, z, R) { const st = lab.state; lab.place(st.scorchI, st.scorchN++ % 10, [x, 0.08, z], { scale: R * 0.7, rot: lab.rand(0, 3) }); },

  // башня-сакля: побелка, шатёр цвета команды, флаг, тёплые окна, воевода на верху
  buildTower(lab, S) {
    const team = this.TEAM[S.i], x = -S.dir * this.TX, g = lab.group({ at: [x, 0, 0], scale: 1.2 }), parts = [];
    parts.push(lab.cyl(2.1, 2.3, 0.6, '#d9b27c', { parent: g, at: [0, 0.3, 0], sides: 9 }));
    parts.push(lab.cyl(1.5, 1.7, 3.1, '#f3ead6', { parent: g, at: [0, 2.15, 0], sides: 8 }));
    parts.push(lab.cyl(1.58, 1.58, 0.24, '#b88a5a', { parent: g, at: [0, 2.7, 0], sides: 8 }));
    parts.push(lab.cyl(1.85, 1.6, 0.5, '#e8dcc4', { parent: g, at: [0, 3.9, 0], sides: 8 }));
    for (let k = 0; k < 8; k++) { const a = k / 8 * Math.PI * 2; parts.push(lab.box(0.4, 0.42, 0.4, '#e8dcc4', { parent: g, at: [Math.cos(a) * 1.65, 4.35, Math.sin(a) * 1.65], rot: -a })); }
    for (const a of [-0.6, 0.6]) parts.push(lab.box(0.08, 1.5, 0.08, '#6a4a32', { parent: g, at: [Math.cos(a) * 0.9 * -S.dir, 4.9, Math.sin(a) * 0.9] }));
    parts.push(lab.box(0.75, 1.05, 0.1, '#6a4a32', { parent: g, at: [S.dir * 1.62, 0.9, 0], rot: Math.PI / 2 }));
    lab.merge(parts, g);
    const win = [];
    for (const [y, dx] of [[1.9, -0.55], [1.9, 0.55], [3.2, 0]]) win.push(lab.box(0.32, 0.5, 0.06, '#ffcf6a', { parent: g, at: [dx, y, 1.66], glow: 0.5 }));
    lab.merge(win, g);
    const roof = lab.cone(1.35, 1.1, team.c, { parent: g, at: [0, 6.15, 0], sides: 8 });
    lab.box(1.2, 0.12, 1.2, team.dark, { parent: g, at: [0, 5.6, 0] });
    const pole = lab.group({ parent: g, at: [0, 6.7, 0] });
    lab.cyl(0.04, 0.05, 1.4, '#5a3d2b', { parent: pole, at: [0, 0.7, 0] });
    const flag = lab.box(1, 0.55, 0.04, team.c, { parent: pole, at: [S.dir * 0.52, 1.1, 0] });
    const hero = this.buildChief(lab, S, g);
    const bar = this.bar(lab, g, 3, 0.3, team.c, 6.9);
    S.tower = { isTower: true, side: S.i, x, z: 0, r: 1.7, hp: lab.cfg.towerHp, max: lab.cfg.towerHp, cd: 1, flash: 0, wob: 0, g, roof, flag, hero, bar };
    lab.state.rangeRings[S.i].scale.setScalar(lab.cfg.towerRange);
  },
  // воевода на башне — герой: черкеска цвета команды, папаха, глаза; машет рукой, когда выпускает карту
  buildChief(lab, S, parent) {
    const team = this.TEAM[S.i], g = lab.group({ parent, at: [0, 4.15, 0], rot: S.dir > 0 ? 0.5 : -0.5 }), body = lab.group({ parent: g });
    lab.box(0.16, 0.5, 0.18, '#22202a', { parent: body, at: [-0.12, 0.25, 0] });
    lab.box(0.16, 0.5, 0.18, '#22202a', { parent: body, at: [0.12, 0.25, 0] });
    lab.box(0.56, 0.7, 0.36, team.dark, { parent: body, at: [0, 0.82, 0], round: 0.05 });
    lab.box(0.58, 0.08, 0.38, '#ffd23f', { parent: body, at: [0, 0.56, 0], metal: 0.5, shiny: true });
    for (const s of [-1, 1]) lab.box(0.12, 0.2, 0.03, '#ffe9b0', { parent: body, at: [s * 0.15, 0.95, 0.19] }); // газыри
    lab.ball(0.22, '#f0c8a0', { parent: body, at: [0, 1.38, 0] });
    lab.cyl(0.24, 0.22, 0.3, S.i ? '#1e1a1a' : '#f4f0e6', { parent: body, at: [0, 1.62, 0], sides: 9 });
    for (const s of [-1, 1]) {
      lab.ball(0.06, '#ffffff', { parent: body, at: [s * 0.08, 1.42, 0.18], detail: 0 });
      lab.ball(0.032, '#111111', { parent: body, at: [s * 0.08, 1.42, 0.23], detail: 0, shiny: true });
    }
    lab.box(0.26, 0.12, 0.06, '#3a2a1e', { parent: body, at: [0, 1.24, 0.19] });
    lab.box(0.12, 0.5, 0.14, team.dark, { parent: body, at: [-0.36, 0.85, 0], rot: [0, 0, 0.15] });
    const arm = lab.group({ parent: body, at: [0.34, 1.08, 0] });
    lab.box(0.12, 0.5, 0.14, team.dark, { parent: arm, at: [0, -0.22, 0] });
    lab.box(0.04, 0.7, 0.04, '#dfe6f0', { parent: arm, at: [0, -0.62, 0.12], metal: 0.6, shiny: true });
    g.userData.arm = arm; g.userData.body = body;
    // тёплое пятно под воеводой: его видно на башне
    lab.mesh(new lab.THREE.CircleGeometry(0.8, 18).rotateX(-Math.PI / 2), lab.mat('#ffe6a0', { unlit: true, alpha: 0.35 }), { parent: g, at: [0, 0.02, 0], shadow: false });
    return g;
  },
  // полоска прочности, повёрнутая к камере (фон и заливка от левого края)
  bar(lab, parent, w, h, color, y) {
    const T = lab.THREE, g = lab.group({ parent, at: [0, y, 0] });
    const bg = lab.mesh(new T.PlaneGeometry(w + 0.12, h + 0.12), lab.mat('#1a1420', { unlit: true }), { parent: g, shadow: false });
    const fill = lab.mesh(new T.PlaneGeometry(w, h).translate(w / 2, 0, 0), lab.mat(color, { unlit: true }).clone(), { parent: g, at: [-w / 2, 0, 0.01], shadow: false });
    g.rotation.x = this.camera.tilt - Math.PI / 2;
    return { g, bg, fill, w };
  },

  /* ---------- бойцы: детали по видам, у каждого вида две пачки копий (цвет команды и остальное) ---------- */
  ART: {
    'воин': [
      ['box', [0.14, 0.38, 0.16], [-0.1, 0.19, 0], '#2a2230'], ['box', [0.14, 0.38, 0.16], [0.1, 0.19, 0], '#2a2230'],
      ['box', [0.42, 0.46, 0.28], [0, 0.6, 0], 'team'], ['box', [0.46, 0.18, 0.3], [0, 0.42, 0], 'team'], ['box', [0.44, 0.06, 0.31], [0, 0.4, 0], '#d9a441'],
      ['box', [0.3, 0.06, 0.02], [0, 0.72, 0.15], '#f0e6c8'], ['ball', [0.17], [0, 0.98, 0], '#f0c8a0'], ['cyl', [0.17, 0.15, 0.2], [0, 1.15, 0], '#1e1a1a'],
      ['ball', [0.035], [-0.06, 1.0, 0.15], '#111111'], ['ball', [0.035], [0.06, 1.0, 0.15], '#111111'],
      ['box', [0.1, 0.36, 0.1], [0.27, 0.62, 0.04], 'team'], ['box', [0.05, 0.04, 0.72], [0.3, 0.52, 0.42], '#e6edf6'], ['box', [0.16, 0.05, 0.05], [0.3, 0.52, 0.08], '#d9a441'],
      ['box', [0.08, 0.3, 0.3], [-0.27, 0.6, 0.1], '#8a5a35'],
    ],
    'всадник': [
      ['box', [0.34, 0.34, 0.95], [0, 0.72, 0], '#7a4a2a'], ['box', [0.08, 0.5, 0.08], [-0.11, 0.28, 0.33], '#5a3420'], ['box', [0.08, 0.5, 0.08], [0.11, 0.28, 0.33], '#5a3420'],
      ['box', [0.08, 0.5, 0.08], [-0.11, 0.28, -0.33], '#5a3420'], ['box', [0.08, 0.5, 0.08], [0.11, 0.28, -0.33], '#5a3420'],
      ['box', [0.17, 0.38, 0.2], [0, 1.0, 0.45], '#7a4a2a', [0.5, 0, 0]], ['box', [0.17, 0.2, 0.36], [0, 1.18, 0.64], '#7a4a2a'], ['box', [0.05, 0.32, 0.12], [0, 1.1, 0.4], '#1e1612', [0.5, 0, 0]],
      ['box', [0.07, 0.4, 0.07], [0, 0.72, -0.52], '#1e1612', [0.5, 0, 0]], ['box', [0.44, 0.07, 0.52], [0, 0.92, 0], 'team'],
      ['box', [0.3, 0.42, 0.24], [0, 1.24, -0.02], 'team'], ['ball', [0.14], [0, 1.56, 0], '#f0c8a0'], ['cyl', [0.14, 0.13, 0.15], [0, 1.7, 0], '#1e1a1a'],
      ['ball', [0.03], [-0.05, 1.58, 0.12], '#111111'], ['ball', [0.03], [0.05, 1.58, 0.12], '#111111'], ['box', [0.04, 0.04, 0.62], [0.22, 1.24, 0.34], '#e6edf6'],
      ['ball', [0.03], [-0.07, 1.2, 0.83], '#111111'], ['ball', [0.03], [0.07, 1.2, 0.83], '#111111'],
    ],
    'стрелок': [
      ['cone', [0.3, 0.62], [0, 0.4, 0], 'team'], ['box', [0.28, 0.3, 0.2], [0, 0.8, 0], 'team'], ['ball', [0.15], [0, 1.04, 0], '#f0c8a0'],
      ['ball', [0.16], [0, 1.08, -0.05], '#3a2418'], ['box', [0.06, 0.42, 0.06], [0, 0.82, -0.17], '#3a2418'], ['cone', [0.15, 0.22], [0, 1.24, 0], '#e0b040'],
      ['ball', [0.028], [-0.05, 1.05, 0.13], '#111111'], ['ball', [0.028], [0.05, 1.05, 0.13], '#111111'],
      ['box', [0.035, 0.85, 0.05], [-0.25, 0.8, 0.2], '#7a4a26'], ['box', [0.012, 0.8, 0.012], [-0.22, 0.8, 0.13], '#ffffff'],
      ['cyl', [0.06, 0.06, 0.36], [0.13, 0.86, -0.17], '#8a5a35', [0.3, 0, 0]], ['box', [0.32, 0.05, 0.22], [0, 0.66, 0], '#d9a441'],
    ],
    'щит': [
      ['box', [0.18, 0.42, 0.2], [-0.13, 0.21, 0], '#2a2230'], ['box', [0.18, 0.42, 0.2], [0.13, 0.21, 0], '#2a2230'],
      ['box', [0.56, 0.56, 0.38], [0, 0.7, 0], 'team'], ['ball', [0.19], [0, 1.12, 0], '#f0c8a0'], ['cone', [0.23, 0.3], [0, 1.32, 0], '#c9ced8'],
      ['ball', [0.035], [-0.07, 1.14, 0.17], '#111111'], ['ball', [0.035], [0.07, 1.14, 0.17], '#111111'],
      ['cyl', [0.46, 0.46, 0.06], [0, 0.72, 0.3], '#d9a441', [Math.PI / 2, 0, 0]], ['cyl', [0.4, 0.4, 0.08], [0, 0.72, 0.33], 'team', [Math.PI / 2, 0, 0]],
      ['ball', [0.09], [0, 0.72, 0.38], '#e8e8f0'], ['box', [0.045, 1.5, 0.045], [0.34, 0.8, 0.08], '#8a5a35'], ['cone', [0.07, 0.2], [0.34, 1.62, 0.08], '#e6edf6'],
    ],
    'великан': [
      ['box', [0.22, 0.38, 0.24], [-0.15, 0.19, 0], '#8f7a64'], ['box', [0.22, 0.38, 0.24], [0.15, 0.19, 0], '#8f7a64'],
      ['ball', [0.38], [0, 0.66, 0], '#a08a74', null, [1, 0.95, 0.85]], ['box', [0.56, 0.18, 0.46], [0, 0.42, 0], 'team'], ['box', [0.1, 0.62, 0.42], [0, 0.74, 0], 'team', [0, 0, 0.65]],
      ['ball', [0.23], [0, 1.1, 0.03], '#a08a74'], ['ball', [0.09], [0, 1.14, 0.21], '#ffffff'], ['ball', [0.045], [0, 1.14, 0.29], '#111111'],
      ['box', [0.24, 0.05, 0.06], [0, 1.25, 0.2], '#4a3a2a'], ['cone', [0.11, 0.2], [0, 1.36, 0], '#4a3a2a'], ['box', [0.12, 0.05, 0.05], [0, 1.0, 0.22], '#5a3426'],
      ['box', [0.15, 0.5, 0.15], [-0.45, 0.68, 0], '#a08a74'], ['box', [0.15, 0.5, 0.15], [0.45, 0.68, 0.05], '#a08a74'],
      ['cyl', [0.12, 0.06, 0.8], [0.48, 0.55, 0.32], '#7a4a26', [1.2, 0, 0]],
    ],
    'рой': [
      ['ball', [0.13], [0, 0, 0], '#ffcc22', null, [0.9, 0.85, 1.35]], ['box', [0.24, 0.24, 0.045], [0, 0, -0.08], '#1a1410'], ['box', [0.25, 0.25, 0.05], [0, 0, 0.03], 'team'],
      ['ball', [0.085], [0, 0.02, 0.18], '#1a1410'], ['ball', [0.03], [-0.04, 0.05, 0.25], '#ffffff'], ['ball', [0.03], [0.04, 0.05, 0.25], '#ffffff'],
      ['cone', [0.04, 0.12], [0, 0, -0.22], 'team', [-Math.PI / 2, 0, 0]],
      ['box', [0.24, 0.02, 0.13], [-0.14, 0.13, 0], '#e8f6ff', [0, 0, 0.45]], ['box', [0.24, 0.02, 0.13], [0.14, 0.13, 0], '#e8f6ff', [0, 0, -0.45]],
    ],
    'осада': [
      ['box', [0.72, 0.12, 1.0], [0, 0.32, 0], '#8a5a35'], ['cyl', [0.22, 0.22, 0.08], [-0.4, 0.22, 0.32], '#5a3d2b', [0, 0, Math.PI / 2]], ['cyl', [0.22, 0.22, 0.08], [0.4, 0.22, 0.32], '#5a3d2b', [0, 0, Math.PI / 2]],
      ['cyl', [0.22, 0.22, 0.08], [-0.4, 0.22, -0.32], '#5a3d2b', [0, 0, Math.PI / 2]], ['cyl', [0.22, 0.22, 0.08], [0.4, 0.22, -0.32], '#5a3d2b', [0, 0, Math.PI / 2]],
      ['box', [0.08, 0.52, 0.08], [-0.22, 0.62, 0.1], '#7a4a26'], ['box', [0.08, 0.52, 0.08], [0.22, 0.62, 0.1], '#7a4a26'], ['box', [0.52, 0.07, 0.07], [0, 0.85, 0.1], '#5a3d2b'],
      ['box', [0.08, 0.08, 0.95], [0, 0.82, -0.18], '#9a6a3e', [-0.5, 0, 0]], ['box', [0.24, 0.12, 0.24], [0, 1.05, -0.55], '#5a3d2b'], ['ball', [0.11], [0, 1.16, -0.55], '#8c7f73'],
      ['box', [0.03, 0.62, 0.03], [0.32, 0.92, 0.42], '#5a3d2b'], ['box', [0.02, 0.3, 0.26], [0.32, 1.06, 0.29], 'team'],
    ],
    'родник': [
      ['cyl', [0.72, 0.82, 0.32], [0, 0.16, 0], '#b9a68a', null, null, 9], ['cyl', [0.6, 0.6, 0.06], [0, 0.31, 0], '#5ff2ff', null, null, 9],
      ['ball', [0.16], [0.6, 0.38, 0.4], '#a99a88'], ['ball', [0.13], [-0.55, 0.38, 0.45], '#bfb19e'], ['ball', [0.14], [0.1, 0.38, -0.7], '#a99a88'],
      ['box', [0.04, 1.2, 0.04], [0.62, 0.6, -0.1], '#5a3d2b'], ['box', [0.02, 0.32, 0.46], [0.62, 1.04, 0.14], 'team'],
    ],
  },
  // запечь детали вида в две геометрии: белая (покрасится в цвет команды) и цветная по вершинам
  bake(lab, parts) {
    const T = lab.THREE, BGU = lab.addons.BufferGeometryUtils, team = [], det = [], C = new T.Color();
    for (const [kind, s, at, color, rot, scale, sides] of parts) {
      let g = kind === 'box' ? new T.BoxGeometry(s[0], s[1], s[2]) : kind === 'ball' ? new T.IcosahedronGeometry(s[0], 0)
        : kind === 'cyl' ? new T.CylinderGeometry(s[0], s[1], s[2], sides || 8) : new T.ConeGeometry(s[0], s[1], sides || 6);
      if (g.index) g = g.toNonIndexed();
      if (scale) g.scale(scale[0], scale[1], scale[2]);
      if (rot) { g.rotateX(rot[0]); g.rotateY(rot[1]); g.rotateZ(rot[2]); }
      g.translate(at[0], at[1], at[2]);
      for (const k of Object.keys(g.attributes)) if (k !== 'position' && k !== 'normal') g.deleteAttribute(k);
      if (color === 'team') { team.push(g); continue; }
      C.set(color);
      const n = g.attributes.position.count, a = new Float32Array(n * 3);
      for (let i = 0; i < n; i++) { a[i * 3] = C.r; a[i * 3 + 1] = C.g; a[i * 3 + 2] = C.b; }
      g.setAttribute('color', new T.BufferAttribute(a, 3));
      det.push(g);
    }
    return { team: BGU.mergeGeometries(team), det: BGU.mergeGeometries(det) };
  },
  unitParts(lab) {
    const T = lab.THREE, st = lab.state;
    const teamMat = new T.MeshStandardMaterial({ color: '#ffffff', flatShading: true, roughness: 0.65 });
    const detMat = new T.MeshStandardMaterial({ vertexColors: true, flatShading: true, roughness: 0.75 });
    st.pools = {};
    const caps = { 'рой': 48, 'воин': 18, 'всадник': 12, 'стрелок': 20, 'щит': 12, 'великан': 8, 'осада': 8, 'родник': 6 };
    for (const look in this.ART) {
      const { team, det } = this.bake(lab, this.ART[look]), cap = caps[look];
      const mk = (geo, m) => { const im = lab.instances(geo, m, cap); im.frustumCulled = false; im.setColorAt(0, st.tmp.one); im.count = 0; return im; };
      st.pools[look] = { team: mk(team, teamMat), det: mk(det, detMat), cap, n: 0 };
    }
    // тени-круги под бойцами, полоски прочности
    st.shadowI = lab.instances(new T.CircleGeometry(1, 14).rotateX(-Math.PI / 2), lab.mat('#1c2a14', { alpha: 0.35 }), 140, { shadow: false });
    st.shadowI.frustumCulled = false;
    const tilt = this.camera.tilt - Math.PI / 2;
    st.barBg = lab.instances(new T.PlaneGeometry(1, 0.15).rotateX(tilt), lab.mat('#1a1420', { unlit: true }), 140, { shadow: false });
    st.barFill = lab.instances(new T.PlaneGeometry(1, 0.11).translate(0.5, 0, 0.01).rotateX(tilt), lab.mat('#ffffff', { unlit: true }), 140, { shadow: false });
    for (const m of [st.barBg, st.barFill]) { m.frustumCulled = false; m.count = 0; m.renderOrder = 5; }
    st.barFill.setColorAt(0, st.tmp.one);
    // снаряды: стрелы, болты башен, камни катапульт, огненные шары (настоящие меши со следом)
    st.arrowI = lab.instances(new T.BoxGeometry(0.05, 0.05, 0.6), '#ffffff', 60, { shadow: false });
    st.arrowI.setColorAt(0, st.tmp.one);
    st.boltI = lab.instances(new T.IcosahedronGeometry(0.17, 0), lab.mat('#ffffff', { glow: 1.2 }), 30, { shadow: false });
    st.boltI.setColorAt(0, st.tmp.one);
    st.stoneI = lab.instances(new T.DodecahedronGeometry(0.22, 0), '#8c7f73', 16);
    for (const m of [st.arrowI, st.boltI, st.stoneI]) { m.frustumCulled = false; m.count = 0; }
    st.fires = [0, 1, 2, 3].map(() => {
      const m = lab.ball(0.42, '#ffb030', { glow: 1.6, shadow: false });
      m.visible = false;
      return { m, tr: lab.trail(m, { color: '#ff7a2a', width: 0.5, length: 16, glow: 1.4 }) };
    });
  },

  /* ---------- рука, кувшин, метка ---------- */
  uiParts(lab) {
    const T = lab.THREE, st = lab.state;
    st.dropFull = lab.instances(new T.IcosahedronGeometry(0.26, 0).scale(1, 1.25, 1), lab.mat(this.ELIX, { glow: 0.9 }), 24, { shadow: false });
    st.dropEmpty = lab.instances(new T.IcosahedronGeometry(0.22, 0).scale(1, 1.25, 1), lab.mat('#2a5866'), 24, { shadow: false });
    for (const m of [st.dropFull, st.dropEmpty]) { m.frustumCulled = false; m.count = 0; }
  },
  buildHand(lab, S) {
    const T = lab.THREE, st = lab.state, team = this.TEAM[S.i], m = S.dir, tilt = this.camera.tilt - Math.PI / 2;
    const cards = [0, 1, 2, 3, 4].map(k => {
      const cv = document.createElement('canvas'); cv.width = 256; cv.height = 320;
      const tex = new T.CanvasTexture(cv); tex.colorSpace = T.SRGBColorSpace; tex.anisotropy = 4;
      const small = k === 4, w = small ? 1.55 : 2.6, x = small ? m * this.NEXT_X : m > 0 ? this.CARD_X[k] : -this.CARD_X[3 - k];
      const mesh = lab.mesh(new T.PlaneGeometry(w, w * 1.25), new T.MeshBasicMaterial({ map: tex, transparent: true, fog: false, toneMapped: false }), { at: [x, small ? 1.0 : 1.45, this.CARD_Z + (small ? 0.3 : 0)], shadow: false });
      mesh.rotation.x = tilt; mesh.renderOrder = 8;
      return { mesh, cv, tex, key: '', x, y: mesh.position.y, lift: 0 };
    });
    // кувшин родника: стекло, бирюзовая вода по уровню капель, глиняное горло
    const jx = m * -2.75, jar = lab.group({ at: [jx, 0, this.CARD_Z + 2] });
    lab.cyl(0.62, 0.7, 0.12, '#8a5a35', { parent: jar, at: [0, 0.06, 0], sides: 12 });
    const water = lab.cyl(0.52, 0.58, 1, lab.mat(this.ELIX, { glow: 0.9 }).clone(), { parent: jar, at: [0, 0.62, 0], sides: 12, shadow: false });
    lab.cyl(0.6, 0.66, 1.5, lab.mat('#dff6ff', { alpha: 0.28, smooth: true, shiny: true }), { parent: jar, at: [0, 0.87, 0], sides: 12, shadow: false });
    lab.cyl(0.36, 0.6, 0.3, '#c8743a', { parent: jar, at: [0, 1.75, 0], sides: 12 });
    lab.cyl(0.4, 0.36, 0.14, '#a85a2a', { parent: jar, at: [0, 1.95, 0], sides: 12 });
    lab.mesh(new T.TorusGeometry(0.32, 0.07, 6, 12, Math.PI), lab.mat('#c8743a'), { parent: jar, at: [m * -0.62, 1.2, 0], rot: [0, 0, m * Math.PI / 2] });
    // метка «где выпустить»: кольцо цвета команды и стрелка вниз
    const marker = lab.group({ at: [m * this.SLOTS[2], 0, 0] });
    const ring = lab.mesh(new T.RingGeometry(0.85, 1.05, 32).rotateX(-Math.PI / 2), lab.mat(team.c, { unlit: true, alpha: 0.9 }).clone(), { parent: marker, at: [0, 0.1, 0], shadow: false });
    const disc = lab.mesh(new T.CircleGeometry(0.85, 32).rotateX(-Math.PI / 2), lab.mat(team.c, { unlit: true, alpha: 0.18 }).clone(), { parent: marker, at: [0, 0.09, 0], shadow: false });
    const arrow = lab.cone(0.28, 0.55, team.light, { parent: marker, at: [0, 2.2, 0], rot: [Math.PI, 0, 0], glow: 0.5, shadow: false });
    S.ui = { cards, jar, water, marker, ring, disc, arrow, fly: [] };
  },
  // сыгранная карта улетает вверх, новая выезжает снизу с перескоком
  cardFly(lab, S, i) {
    const c = S.ui.cards[i], n = S.ui.cards[4];
    c.key = ''; n.key = '';
    c.mesh.position.y = c.y - 1.4; c.mesh.scale.setScalar(0.5); // новая карта выезжает снизу, растёт до места
    n.mesh.scale.setScalar(0.7);
  },
  // рисунок карты: цена каплей, значок вида, имя, здоровье и урон
  paintCard(lab, S, c, card, sel, small) {
    const g = c.cv.getContext('2d'), W = 256, H = 320, team = this.TEAM[S.i], cost = this.cost(lab, card), ok = S.elixir + 1e-6 >= cost;
    g.clearRect(0, 0, W, H);
    g.fillStyle = sel ? '#ffd23f' : team.dark; g.beginPath(); g.roundRect(4, 4, W - 8, H - 8, 26); g.fill();
    const gr = g.createLinearGradient(0, 0, 0, H); gr.addColorStop(0, '#fbf3e0'); gr.addColorStop(1, '#e9d8b4');
    g.fillStyle = gr; g.beginPath(); g.roundRect(14, 14, W - 28, H - 28, 18); g.fill();
    g.fillStyle = team.c; g.globalAlpha = 0.18; g.beginPath(); g.roundRect(14, 14, W - 28, 190, 18); g.fill(); g.globalAlpha = 1;
    this.icon(g, card, team, 128, 112);
    // цена — капля в углу
    g.fillStyle = '#1e7f96'; g.beginPath(); g.moveTo(44, 16); g.quadraticCurveTo(80, 58, 74, 76); g.arc(44, 70, 31, 0.2, Math.PI - 0.2); g.quadraticCurveTo(8, 58, 44, 16); g.fill();
    g.fillStyle = '#5ff2ff'; g.beginPath(); g.moveTo(44, 24); g.quadraticCurveTo(72, 58, 67, 74); g.arc(44, 70, 24, 0.2, Math.PI - 0.2); g.quadraticCurveTo(16, 58, 44, 24); g.fill();
    g.fillStyle = '#0d2a33'; g.font = 'bold 38px sans-serif'; g.textAlign = 'center'; g.textBaseline = 'middle'; g.fillText(String(cost), 44, 72);
    g.fillStyle = '#2a1e14'; g.font = `bold ${card.name.length > 11 ? 24 : 28}px sans-serif`; g.fillText(card.name, 128, 228);
    g.font = 'bold 22px sans-serif'; g.fillStyle = '#6a4a32';
    const stats = card.kind === 'заклинание' ? `урон ${card.dmg} · круг ${card.range.toFixed(1)}` : card.kind === 'родник' ? '+1 капля / 5 с' : `♥${card.hp} ⚔${card.dmg}` + (card.count > 1 ? ` ×${card.count}` : '');
    g.fillText(stats, 128, 262);
    if (lab.cfg.rps >= 1 && this.RPS[card.kind]) { g.font = 'bold 18px sans-serif'; g.fillStyle = '#a0461e'; g.fillText(`×2 против: ${this.RPS[card.kind]}`, 128, 290); }
    else { g.font = '17px sans-serif'; g.fillStyle = '#7a5a3a'; g.fillText((this.KIND[card.kind] || this.KIND['воин']).what, 128, 290); }
    if (!ok) {
      g.fillStyle = 'rgba(20,16,30,0.55)'; g.beginPath(); g.roundRect(4, 4, W - 8, H - 8, 26); g.fill();
      g.fillStyle = '#5ff2ff'; g.font = 'bold 34px sans-serif'; g.fillText(`ещё ${Math.ceil(cost - S.elixir)} 💧`, 128, 150);
    }
    if (small) { g.fillStyle = 'rgba(20,16,30,0.6)'; g.fillRect(14, 150, W - 28, 44); g.fillStyle = '#ffffff'; g.font = 'bold 30px sans-serif'; g.fillText('следующая', 128, 173); }
    c.tex.needsUpdate = true;
  },
  icon(g, card, team, x, y) {
    const look = card.kind === 'воин' && card.speed >= 2.2 ? 'всадник' : card.kind;
    g.save(); g.translate(x, y); g.lineCap = 'round'; g.lineJoin = 'round';
    const circle = (cx, cy, r, f) => { g.fillStyle = f; g.beginPath(); g.arc(cx, cy, r, 0, Math.PI * 2); g.fill(); };
    if (look === 'рой') {
      for (const [bx, by, s] of [[-34, -18, 1], [28, -26, 0.85], [0, 26, 1.1]]) {
        g.save(); g.translate(bx, by); g.scale(s, s);
        g.fillStyle = 'rgba(232,246,255,0.9)'; g.beginPath(); g.ellipse(-10, -16, 12, 8, -0.5, 0, 7); g.ellipse(10, -16, 12, 8, 0.5, 0, 7); g.fill();
        g.fillStyle = '#ffcc22'; g.beginPath(); g.ellipse(0, 0, 24, 16, 0, 0, 7); g.fill();
        g.fillStyle = '#1a1410'; g.fillRect(-8, -15, 6, 30); g.fillStyle = team.c; g.fillRect(4, -15, 6, 30);
        circle(-22, 0, 7, '#1a1410'); g.restore();
      }
    } else if (look === 'воин' || look === 'всадник') {
      if (look === 'всадник') { g.fillStyle = '#7a4a2a'; g.beginPath(); g.moveTo(-50, 50); g.lineTo(-20, -30); g.lineTo(20, -56); g.lineTo(40, -40); g.lineTo(10, -10); g.lineTo(20, 50); g.fill(); circle(26, -44, 4, '#111'); g.fillStyle = '#1e1612'; g.fillRect(-18, -40, 10, 40); }
      g.strokeStyle = '#c9d2de'; g.lineWidth = 12; g.beginPath(); g.moveTo(-40, 50); g.lineTo(40, -50); g.stroke();
      g.strokeStyle = '#ffffff'; g.lineWidth = 3; g.beginPath(); g.moveTo(-36, 44); g.lineTo(38, -48); g.stroke();
      g.strokeStyle = '#d9a441'; g.lineWidth = 12; g.beginPath(); g.moveTo(-58, 28); g.lineTo(-22, 62); g.stroke();
      circle(-48, 56, 9, team.c);
    } else if (look === 'стрелок') {
      g.strokeStyle = '#7a4a26'; g.lineWidth = 10; g.beginPath(); g.arc(-30, 0, 62, -1.1, 1.1); g.stroke();
      g.strokeStyle = '#ffffff'; g.lineWidth = 2; g.beginPath(); g.moveTo(-30 + 62 * Math.cos(-1.1), 62 * Math.sin(-1.1)); g.lineTo(-30 + 62 * Math.cos(1.1), 62 * Math.sin(1.1)); g.stroke();
      g.strokeStyle = '#5a3d2b'; g.lineWidth = 5; g.beginPath(); g.moveTo(-6, 0); g.lineTo(60, 0); g.stroke();
      g.fillStyle = '#c9d2de'; g.beginPath(); g.moveTo(72, 0); g.lineTo(56, -9); g.lineTo(56, 9); g.fill();
      g.fillStyle = team.c; g.fillRect(-10, -7, 14, 14);
    } else if (look === 'щит') {
      circle(0, 0, 62, '#d9a441'); circle(0, 0, 52, team.c); circle(0, 0, 16, '#e8e8f0');
      g.strokeStyle = 'rgba(255,255,255,0.35)'; g.lineWidth = 6; g.beginPath(); g.arc(0, 0, 40, -2.4, -1.2); g.stroke();
    } else if (look === 'великан') {
      circle(0, 6, 58, '#a08a74'); circle(0, -6, 22, '#ffffff'); circle(0, -2, 10, '#111');
      g.fillStyle = '#4a3a2a'; g.fillRect(-30, -40, 60, 9); g.beginPath(); g.moveTo(-14, -52); g.lineTo(0, -82); g.lineTo(14, -52); g.fill();
      g.fillStyle = '#5a3426'; g.fillRect(-20, 30, 40, 8); g.fillStyle = team.c; g.fillRect(-58, 48, 116, 14);
    } else if (look === 'осада') {
      g.fillStyle = '#8a5a35'; g.fillRect(-56, 30, 112, 16); circle(-40, 52, 14, '#5a3d2b'); circle(40, 52, 14, '#5a3d2b');
      g.strokeStyle = '#9a6a3e'; g.lineWidth = 10; g.beginPath(); g.moveTo(-20, 32); g.lineTo(34, -46); g.stroke();
      circle(40, -54, 15, '#8c7f73'); g.fillStyle = team.c; g.fillRect(-58, -20, 20, 30);
    } else if (look === 'заклинание') {
      const gr = g.createRadialGradient(10, -6, 4, 0, 0, 62); gr.addColorStop(0, '#fff6c0'); gr.addColorStop(0.45, '#ffb030'); gr.addColorStop(1, '#ff4a3d');
      g.fillStyle = gr; g.beginPath(); g.arc(8, 8, 44, 0, 7); g.fill();
      g.fillStyle = 'rgba(255,122,42,0.8)'; g.beginPath(); g.moveTo(-26, 30); g.quadraticCurveTo(-70, -10, -50, -60); g.quadraticCurveTo(-30, -20, -6, -34); g.quadraticCurveTo(-10, -70, 30, -72); g.quadraticCurveTo(10, -30, 44, -20); g.fill();
    } else if (look === 'родник') {
      g.fillStyle = '#b9a68a'; g.beginPath(); g.ellipse(0, 40, 62, 22, 0, 0, 7); g.fill();
      g.fillStyle = '#5ff2ff'; g.beginPath(); g.ellipse(0, 36, 48, 14, 0, 0, 7); g.fill();
      g.beginPath(); g.moveTo(0, -60); g.quadraticCurveTo(34, -10, 26, 6); g.arc(0, 2, 26, 0.2, Math.PI - 0.2); g.quadraticCurveTo(-34, -10, 0, -60); g.fill();
      g.fillStyle = team.c; g.fillRect(48, -40, 6, 70); g.fillRect(54, -40, 26, 18);
    }
    g.restore();
  },

  /* ---------- рисование кадра ---------- */
  draw(lab, dt) {
    const st = lab.state, M = st.tmp;
    for (const k in st.pools) st.pools[k].n = 0;
    let sn = 0, bn = 0;
    const setI = (im, i, x, y, z, ry, s, sy, rx) => { M.e.set(rx || 0, ry, 0); M.q.setFromEuler(M.e); M.s.set(s, sy == null ? s : sy, s); M.p.set(x, y, z); M.m.compose(M.p, M.q, M.s); im.setMatrixAt(i, M.m); };
    for (const u of st.units) {
      const P = st.pools[u.look];
      if (!P || P.n >= P.cap) continue;
      const i = P.n++, fly = u.kind === 'рой', grow = u.deployT > 0 ? lab.clamp(1 - u.deployT, 0, 1) : 1;
      const drop = u.deployT > 0 ? Math.max(0, u.deployT - 0.15) * 3 : 0, k = grow < 1 ? lab.ease.outBack(grow) : 1;
      const lunge = u.lunge > 0 ? u.lunge * 0.3 : u.lunge * 0.15, fx = Math.sin(u.face), fz = Math.cos(u.face);
      const bridge = Math.abs(u.x) < 2 ? 0.25 * Math.cos(u.x / 2 * Math.PI / 2) : 0, bob = u.speed > 0 ? Math.abs(Math.sin(u.walk)) * 0.07 : 0;
      const y = drop + bridge + (fly ? 1.1 + Math.sin(u.walk * 1.7) * 0.12 : bob), s = u.size * k * this.UK;
      const breath = 1 + Math.sin(lab.t * 3 + u.walk) * 0.03;
      setI(P.team, i, u.x + fx * lunge, y, u.z + fz * lunge, u.face, s, s * breath, u.look === 'всадник' ? Math.sin(u.walk) * 0.05 : Math.min(0.15, u.lunge * 0.2));
      P.det.setMatrixAt(i, M.m);
      P.team.setColorAt(i, u.flash > 0 && lab.juicy('whiten') ? M.w : st.teamCol[u.side]);
      P.det.setColorAt(i, u.flash > 0 && lab.juicy('whiten') ? M.w : M.one);
      if (sn < 140) setI(st.shadowI, sn++, u.x, 0.08 + bridge, u.z, 0, (u.r + 0.15) * k * this.UK);
      if (u.hp < u.max && u.kind !== 'родник' || u.kind === 'родник') {
        if (bn < 140) {
          const w = u.kind === 'великан' ? 1.8 : u.kind === 'рой' ? 0.6 : 1.1, hy = y + (fly ? 0.6 : u.size * this.UK * (u.look === 'всадник' ? 1.95 : 1.5));
          setI(st.barBg, bn, u.x, hy, u.z, 0, 1, 1); M.s.set(w + 0.08, 1, 1); M.m.compose(M.p, M.q, M.s); st.barBg.setMatrixAt(bn, M.m);
          M.p.set(u.x - w / 2, hy, u.z + 0.01); M.s.set(Math.max(0.001, w * u.hp / u.max), 1, 1); M.m.compose(M.p, M.q.identity(), M.s); st.barFill.setMatrixAt(bn, M.m);
          st.barFill.setColorAt(bn, st.teamCol[u.side]);
          bn++;
        }
      }
    }
    for (const k in st.pools) {
      const P = st.pools[k];
      for (const m of [P.team, P.det]) { m.count = P.n; m.instanceMatrix.needsUpdate = true; if (m.instanceColor) m.instanceColor.needsUpdate = true; }
    }
    st.shadowI.count = sn; st.shadowI.instanceMatrix.needsUpdate = true;
    st.barBg.count = bn; st.barFill.count = bn; st.barBg.instanceMatrix.needsUpdate = true; st.barFill.instanceMatrix.needsUpdate = true;
    if (st.barFill.instanceColor) st.barFill.instanceColor.needsUpdate = true;
    // снаряды
    let an = 0, on = 0, ston = 0, fn = 0;
    for (const p of st.shots) {
      const k = lab.clamp(p.t / p.dur, 0, 1), x = lab.lerp(p.from.x, p.to.x, k), z = lab.lerp(p.from.z, p.to.z, k), y = lab.lerp(p.from.y, p.to.y, k) + p.arc * 4 * k * (1 - k);
      if (p.kind === 'arrow' && an < 60) {
        const ry = Math.atan2(p.to.x - p.from.x, p.to.z - p.from.z);
        setI(st.arrowI, an, x, y, z, ry, 1, 1, -(p.arc * 4 * (1 - 2 * k)) / Math.max(1, Math.hypot(p.to.x - p.from.x, p.to.z - p.from.z)) * p.dur);
        st.arrowI.setColorAt(an++, st.teamCol[p.side]);
      } else if (p.kind === 'bolt' && on < 30) { setI(st.boltI, on, x, y, z, 0, 1); st.boltI.setColorAt(on++, p.side ? M.c.set('#ffb070') : M.c.set('#9fd0ff')); }
      else if (p.kind === 'stone' && ston < 16) setI(st.stoneI, ston++, x, y, z, k * 9, 1, 1, k * 7);
      else if (p.kind === 'fire' && fn < 4) { const f = st.fires[fn++]; f.m.visible = true; f.m.position.set(x, y, z); f.m.scale.setScalar(1 + Math.sin(lab.t * 30) * 0.08); }
    }
    for (let i = fn; i < 4; i++) { const f = st.fires[i]; if (f.m.visible) { f.m.visible = false; f.tr.clear(); } }
    st.arrowI.count = an; st.boltI.count = on; st.stoneI.count = ston;
    for (const m of [st.arrowI, st.boltI, st.stoneI]) { m.instanceMatrix.needsUpdate = true; if (m.instanceColor) m.instanceColor.needsUpdate = true; }
    this.drawUi(lab, dt);
    for (const S of st.sides) {
      const T = S.tower, frac = Math.max(0, T.hp) / T.max;
      T.bar.fill.scale.x = Math.max(0.001, frac);
      T.bar.fill.material.color.set(T.flash > 0 ? '#ffffff' : frac < 0.3 ? (Math.sin(lab.t * 12) > 0 ? '#ff6a5a' : this.TEAM[S.i].c) : this.TEAM[S.i].c);
    }
  },
  // рука и кувшин людей, капли
  drawUi(lab, dt) {
    const st = lab.state, M = st.tmp;
    let fN = 0, eN = 0;
    for (const S of st.sides) {
      if (!S.ui) continue;
      const U = S.ui, cap = this.cap(lab), shown = Math.min(cap, 10);
      U.cards.forEach((c, k) => {
        const card = k < 4 ? S.hand[k] : S.queue[0], sel = k === S.sel, cost = this.cost(lab, card);
        const key = `${card.id}|${sel}|${S.elixir + 1e-6 >= cost ? 1 : Math.ceil(cost - S.elixir)}|${cost}|${lab.cfg.rps}`;
        if (key !== c.key) { c.key = key; this.paintCard(lab, S, c, card, sel && k < 4, k === 4); }
        c.lift = lab.damp(c.lift, sel && k < 4 ? 1 : 0, 14, dt || 1);
        c.mesh.position.y = lab.damp(c.mesh.position.y, c.y + c.lift * 0.45 + (sel && k < 4 ? Math.sin(lab.t * 4) * 0.04 : 0), 12, dt || 1);
        const s = 1 + c.lift * 0.08;
        c.mesh.scale.set(lab.damp(c.mesh.scale.x, s, 12, dt || 1), lab.damp(c.mesh.scale.y, s, 12, dt || 1), 1);
      });
      // капли: полные светятся, текущая растёт, пустые темнеют
      const e = Math.min(S.elixir, shown);
      for (let i = 0; i < shown; i++) {
        const x = S.dir > 0 ? -12.9 + i * 0.95 : 12.9 - i * 0.95, z = this.CARD_Z + 2.15, y = 0.3;
        if (i < Math.floor(e + 1e-6)) { M.e.set(0, lab.t * 1.5 + i, 0); M.q.setFromEuler(M.e); M.p.set(x, y + Math.sin(lab.t * 3 + i) * 0.05, z); M.s.setScalar(st.double ? 1.12 : 1); M.m.compose(M.p, M.q, M.s); st.dropFull.setMatrixAt(fN++, M.m); }
        else {
          M.q.identity(); M.p.set(x, y, z); M.s.setScalar(1); M.m.compose(M.p, M.q, M.s); st.dropEmpty.setMatrixAt(eN++, M.m);
          if (i === Math.floor(e + 1e-6)) { const part = e - i; M.s.setScalar(Math.max(0.01, part * 0.9)); M.m.compose(M.p, M.q, M.s); st.dropFull.setMatrixAt(fN++, M.m); }
        }
      }
      // вода в кувшине по уровню, светится сильнее в двойной эликсир и когда полон
      const f = lab.clamp(S.elixir / Math.min(cap, 10), 0, 1.25), full = S.elixir >= cap - 1e-6;
      U.water.scale.y = Math.max(0.02, Math.min(1.3, f * 1.3)); U.water.position.y = 0.14 + 0.65 * U.water.scale.y;
      U.water.material.emissiveIntensity = (st.double ? 2.4 : 1.4) + (full ? Math.abs(Math.sin(lab.t * 8)) * 1.6 : 0);
      // метка: где выпустить; огненный шар — шире и оранжевая
      const card = S.hand[S.sel], spell = card.kind === 'заклинание', x = this.markX(S, card), ok = S.elixir + 1e-6 >= this.cost(lab, card);
      U.marker.position.x = lab.damp(U.marker.position.x, x, 16, dt || 1);
      const R = spell ? card.range : 1, col = spell ? '#ff7a2a' : this.TEAM[S.i].c;
      U.ring.scale.setScalar(R); U.disc.scale.setScalar(R);
      U.ring.material.color.set(col); U.disc.material.color.set(col);
      U.ring.material.opacity = ok ? 0.95 : 0.35; U.disc.material.opacity = ok ? 0.2 : 0.06;
      U.arrow.position.y = 2.1 + Math.sin(lab.t * 5) * 0.15;
      U.marker.visible = !st.over;
    }
    st.dropFull.count = fN; st.dropEmpty.count = eN;
    st.dropFull.instanceMatrix.needsUpdate = true; st.dropEmpty.instanceMatrix.needsUpdate = true;
  },
  // живой мир: вода, облака, птицы, флаги, воеводы, закат в двойной эликсир
  world(lab, dt) {
    const st = lab.state, M = st.tmp;
    st.foam.forEach((f, i) => {
      f.z += f.v * dt; if (f.z > 30) f.z = -40;
      M.e.set(0, 0, 0); M.q.setFromEuler(M.e); M.p.set(f.x + Math.sin(lab.t * 2 + i) * 0.1, 0.08, f.z); M.s.set(f.s, 1, 1); M.m.compose(M.p, M.q, M.s); st.foamI.setMatrixAt(i, M.m);
    });
    st.foamI.instanceMatrix.needsUpdate = true;
    st.clouds.forEach((c, i) => {
      c.x += c.v * dt; if (c.x > 70) c.x = -70;
      for (let k = 0; k < 3; k++) { M.q.identity(); M.p.set(c.x + (k - 1) * c.s * 0.9, c.y + (k === 1 ? c.s * 0.3 : 0), c.z); M.s.set(c.s * (k === 1 ? 1.2 : 0.85), c.s * 0.6, c.s * 0.7); M.m.compose(M.p, M.q, M.s); st.cloudI.setMatrixAt(i * 3 + k, M.m); }
    });
    st.cloudI.instanceMatrix.needsUpdate = true;
    st.birds.forEach((b, i) => {
      b.a += b.v * dt; const x = b.cx + Math.cos(b.a) * b.r, z = b.cz + Math.sin(b.a) * b.r * 0.4;
      M.e.set(0, -b.a, Math.sin(lab.t * 9 + i) * 0.4); M.q.setFromEuler(M.e); M.p.set(x, b.y, z); M.s.setScalar(1); M.m.compose(M.p, M.q, M.s); st.birdI.setMatrixAt(i, M.m);
    });
    st.birdI.instanceMatrix.needsUpdate = true;
    for (const S of st.sides) {
      const T = S.tower;
      T.flag.rotation.y = Math.sin(lab.t * 3 + S.i) * 0.25; T.flag.scale.x = 1 + Math.sin(lab.t * 5 + S.i) * 0.05;
      T.wob = Math.max(0, (T.wob || 0) - dt * 4);
      if (T.hp > 0) T.g.position.x = T.x + Math.sin(lab.t * 60) * 0.04 * T.wob;
      const b = T.hero.userData.body; if (b) b.scale.y = 1 + Math.sin(lab.t * 2.4 + S.i) * 0.03;
      if (T.hp > 0 && T.hp / T.max < 0.5 && lab.chance(dt * 3)) lab.burst(lab.v3(T.x + lab.rand(-1, 1), 4.6, lab.rand(-1, 1)), { count: 2, colors: ['#5a5560', '#8a8590'], speed: 0.6, up: 2.5, gravity: -1, size: 0.3, life: 1.2 });
    }
    st.rangeRings.forEach((r, i) => { r.material.opacity = 0.32 + Math.sin(lab.t * 2 + i) * 0.1; });
    const want = st.double && !lab.cfg.doubleAll ? 1 : 0;
    if (Math.abs(st.sunset - want) > 0.002) { st.sunset = lab.damp(st.sunset, want, 0.9, dt); this.paintSky(lab, st.sunset); }
  },
  // живая камера: еле дышит, в двойной эликсир чуть наезжает, от трещины и падения башни — толчок
  liveCamera(lab, dt) {
    const st = lab.state, v = lab.view, C = st.cam;
    if (!v || !C) return;
    if (Math.abs(v.distance - C.last) > 0.01) C.d = v.distance / C.k;
    C.punch = Math.max(0, C.punch - dt * 1.5);
    const fight = st.units.filter(u => Math.abs(u.x) < 4).length > 3;
    C.k = lab.damp(C.k, (st.double ? 0.96 : 1) * (fight ? 0.985 : 1) * (1 - 0.05 * C.punch) * (1 + Math.sin(lab.t * 0.4) * 0.006), 2, dt);
    v.distance = C.d * C.k; C.last = v.distance;
    v.target.set(lab.damp(v.target.x, C.tx + Math.sin(lab.t * 0.23) * 0.25, 2, dt), lab.damp(v.target.y, 0, 2, dt), lab.damp(v.target.z, C.tz + Math.sin(lab.t * 0.31) * 0.15, 2, dt));
  },
  hudLines(lab, left) {
    const st = lab.state, cfg = lab.cfg, [A, B] = st.sides, duo = B.human, v = this.variant(lab);
    lab.hud('rule', `${v.name}: ${v.how}`, { color: '#ffe680', size: 13 });
    const sec = Math.max(0, Math.ceil(left)), clock = `${Math.floor(sec / 60)}:${String(sec % 60).padStart(2, '0')}`;
    lab.hud('clock', `⏱ ${clock}` + (st.double ? ' · Двойной эликсир ×2' : ''), { color: st.double ? '#7ff8ff' : left <= 10 ? '#ff6a5a' : '#ffffff', size: 20 });
    const hp = S => Math.max(0, Math.round(S.tower.hp));
    lab.hud('towers', duo ? `🏰 Игрок 1: ${hp(A)} · Игрок 2: ${hp(B)}` : `🏰 Твоя башня ${hp(A)} · чужая ${hp(B)}`, { color: '#dfe9ff', size: 15 });
    const cap = this.cap(lab);
    for (const S of duo ? [A, B] : [A]) {
      const full = S.elixir >= cap - 1e-6;
      const who = duo ? `Игрок ${S.i + 1}: ` : '';
      lab.hud('elixir' + S.i, `${who}💧 ${Math.floor(S.elixir + 1e-6)}${cfg.noCap >= 1 ? '' : ' из ' + cap}` + (full ? ' — кувшин полон, капли уходят!' : ''), { color: full ? '#ff9a8a' : this.ELIX, size: 16 });
    }
    lab.hud('combo', A.streak > 0 ? `Обмены в плюс подряд: ${A.streak} · очки ×${this.mult(A)}` : null, { color: '#7cf5a8', size: 15 });
    const danger = st.units.find(u => u.side === 1 && !u.dead && (u.kind === 'великан' ? Math.abs(u.x - A.tower.x) < 10 : Math.abs(u.x - A.tower.x) < cfg.towerRange));
    lab.hud('alarm', !st.over && danger ? (danger.kind === 'великан' ? '⚠ Великан идёт к башне!' : duo ? '⚠ Враг у башни игрока 1!' : '⚠ Враг у твоей башни!') : null, { color: '#ff6a5a', size: 16 });
  },

  overNote(lab) {
    const st = lab.state, [A, B] = st.sides, v = this.variant(lab), out = [];
    const top = S => { const e = Object.entries(S.plays).sort((a, b) => b[1] - a[1])[0]; return e ? `${e[0]} (${e[1]} раз)` : 'ничего'; };
    const hp = S => Math.round(100 * Math.max(0, S.tower.hp) / S.tower.max);
    out.push(`Вариация: ${v.name} (как ${v.like}) — ${v.how}`);
    out.push(`Башни: ${B.human ? 'игрок 1' : 'твоя'} ${hp(A)}%, ${B.human ? 'игрок 2' : 'чужая'} ${hp(B)}%`);
    out.push(`Капель потрачено: ${A.spent}, впустую с полным кувшином: ${A.waste.toFixed(1)} с, обменов в плюс: ${A.plus} (лучшая серия ${A.best})`);
    out.push(`Чаще всего выпускал: ${top(A)}` + (B.human ? ` · игрок 2: ${top(B)}` : ''));
    if (lab.cfg.secret < 1) out.push('Спрятанная механика выключена: все карты стоили 4 капли, двойного эликсира не было. Какая карта стала лучшей всегда?');
    return out;
  },
};
