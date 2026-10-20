// «Камни мудреца» — ремейк-донор урока 2 по мотивам механики «Крестики-нолики» на оболочке «Лаб3D 1.0» (three.js).
// Пошаговая игра на поле N × N с ботом: ход игрока курсором, ход мудреца по перебору (негамакс), матч из нескольких партий.
// Спрятанная механика донора — неопределённость исхода. В классике мудрец не ошибается, и исход известен заранее: при точной игре — ничья.
// Одно правило (ручка «Спрятанная механика: одно правило») делает игру слишком большой для полного расчёта, и исход снова открыт.
// Из лучших игр жанра: весы исхода — шкала оценки, как у шахматного движка; светится «две в ряд» и «вилка», как в «Четыре в ряд»;
// мудрец сначала показывает лунку лучом, как враги в Into the Breach; победная линия — замедление, наезд камеры и звон по нарастающей.
// Вариации (20.10.2026, урок 2, чекпоинт 2): одно ядро «положи камень — собери линию» и одиннадцать пресетов, каждый поворачивает одну деталь:
// поле (5 × 5, гомоку 9 × 9, завалы), камни (три камня, большие и малые как в Gobblet Gobblers, бомбы), ход (падение как в «Четыре в ряд»),
// цель («Наоборот», мизер и Notakto) и случай (ветер, монетка как в random-turn tic-tac-toe).
// Ось Z в three.js смотрит на игрока: дальний ряд доски и мудрец — в −Z, «вверх по экрану». Камни в «Четыре в ряд» падают к игроку (+Z).
/* ПЛАН
 * Фраза игры: ты кладёшь камни-солнца на плиту мудреца на плато Лаго-Наки, мудрец — камни-луны. Три (или K) в ряд — победа. Но мудрец не ошибается.
 * Ядро на 3 секунды: стрелки — лунка, пробел — камень падает с ноты, звон выше с каждым ходом, весы качнулись.
 * Выбор: занять центр или закрыть линию; в вариациях — потратить бомбу сейчас или беречь, положить большой камень или придержать.
 * Угрозы: «две в ряд» мудреца (светится синим), вилка, камень, который исчезнет (красный круг), ветер, бомба мудреца.
 * Кривая матча: партия 1 — знакомство (весы, луч мудреца); партия 2 — первая вилка; дальше серия побед ×2, ×3.
 * События: луч и дуга камня мудреца, «Закрыл!», «Вилка!», исчезновение, ветер, бомба, «Накрыл!», монетка, победная линия, ничья-вздох, серия.
 * Лицо игры: плато на закате — тёплое золото солнц против холодного лунного кристалла. Палитра: #ffc93c солнца, #5fa8ff луны,
 *   #7a2a3a черкеска, #9a9ca4 плита, #5c9646 луг, #ffd09a горизонт. Ключевой свет — тёплое солнце, заполняющий — голубое небо.
 *   Три приёма: луч посоха перед ходом мудреца, весы исхода у края плиты, звон хода всё выше к концу партии.
 */
const GAME = {
  engine: 'three',
  title: 'Камни мудреца',
  subtitle: 'Камни в ряд против мудреца с плато Лаго-Наки. Он не ошибается — пока в игре нет одного правила. Tab — вариации: поле 9 × 9, бомбы, «Четыре в ряд» и ещё восемь.',
  donor: 'Крестики-нолики',
  players: 1,
  pace: 'turns', // пошаговая: бот-плейтестер не ждёт угрозы без хода игрока
  controls: [
    { input: 'move4', text: 'выбрать лунку' },
    { input: 'a', text: 'положить камень' },
    { input: 'b', text: 'сменить, что в руке (бомба, размер камня)' },
  ],
  camera: { type: 'iso', tilt: 0.98, target: [0, 0, -1.6] },
  field: { w: 12.5, h: 13 },
  sky: ['#4f8fd6', '#ffd09a'],
  fog: 0.007,
  accent: '#ffd23f',
  scoreColor: '#ffd23f',
  decisions: [
    'Чувство: азарт «а вдруг выиграю», который пропадает в решённой игре и возвращается с одним правилом',
    'Честность: камень, который исчезнет, дрожит в красном круге, ветер показан стрелкой и призраком, бомба — крестом, весы показывают, что видит мудрец',
    'Выбор: занять центр или закрыть линию; потратить бомбу сейчас или беречь; большой камень сейчас или потом',
  ],
  config: {
    vs: { value: 0, min: 0, max: 1, step: 1, label: 'Соперник', hint: '0 — мудрец, 1 — друг за этим же экраном: ходите по очереди', restart: true },
    rule: { value: 1, min: 0, max: 2, step: 1, label: 'Спрятанная механика: одно правило', hint: '0 — классика: исход известен заранее; 1 — старые камни исчезают; 2 — ветер сдвигает камни', restart: true, names: ['классика', 'исчезающие камни', 'ветер с Фишта'] },
    size: { value: 3, min: 3, max: 9, step: 1, label: 'Вариация: поле N × N', hint: '3 — классика; 5 — «пять на пять»; 9 — гомоку', restart: true },
    need: { value: 3, min: 3, max: 5, step: 1, label: 'Вариация: сколько в ряд для победы', hint: 'Не больше стороны поля', restart: true },
    drop: { value: 0, min: 0, max: 1, step: 1, label: 'Вариация: камни падают вниз', hint: 'Как в «Четыре в ряд»: выбираешь столбец, камень катится к ближнему краю', restart: true, names: ['нет', 'да'] },
    gob: { value: 0, min: 0, max: 1, step: 1, label: 'Вариация: большие и малые камни', hint: 'Как в Gobblet Gobblers: у каждого по два камня трёх размеров, большой накрывает меньший — даже чужой', restart: true, names: ['нет', 'да'] },
    bombs: { value: 0, min: 0, max: 3, step: 1, label: 'Вариация: бомб у каждого', hint: 'Бомба вместо камня сносит крест из пяти лунок. Shift (на геймпаде B) — взять бомбу', restart: true },
    misere: { value: 0, min: 0, max: 1, step: 1, label: 'Вариация: наоборот', hint: 'Собрал линию — проиграл (мизер, Notakto)', restart: true, names: ['нет', 'да'] },
    rocks: { value: 0, min: 0, max: 12, step: 1, label: 'Вариация: завалы на поле', hint: 'Валуны в случайных лунках: линия через них не идёт', restart: true },
    coin: { value: 0, min: 0, max: 1, step: 1, label: 'Вариация: монетка решает, кто ходит', hint: 'Перед каждым ходом подбрасывается монетка (random-turn tic-tac-toe)', restart: true, names: ['нет', 'да'] },
    keep: { value: 3, min: 2, max: 6, step: 1, label: 'Правило 1: камней у каждого', hint: 'Кладёшь лишний — самый старый твой камень исчезает', restart: true },
    wind: { value: 0.6, min: 0, max: 1, step: 0.05, label: 'Правило 2: доля ходов с ветром' },
    depth: { value: 9, min: 1, max: 9, step: 1, label: 'Мудрость: на сколько ходов вперёд считает', hint: 'В классике 9 — до конца игры. С правилом или на большом поле мудрец видит 3–4 хода' },
    mistake: { value: 0, min: 0, max: 0.6, step: 0.05, label: 'Мудрец ошибается: доля случайных ходов' },
    oracle: { value: 1, min: 0, max: 1, step: 1, label: 'Весы исхода: что видит мудрец', hint: 'Шкала у края доски: камень на весах уходит к тому, кто победит при точной игре. Замок — исход известен' },
    threats: { value: 1, min: 0, max: 1, step: 1, label: 'Подсказка «почти линия»', hint: 'Пустая лунка, где кто-то следующим ходом соберёт линию, светится его цветом' },
    first: { value: 2, min: 0, max: 2, step: 1, label: 'Кто ходит первым', hint: '0 — ты, 1 — мудрец, 2 — по очереди' },
    turnTime: { value: 0, min: 0, max: 15, step: 1, label: 'Время на ход, с', hint: '0 — без ограничения' },
    think: { value: 0.7, min: 0.1, max: 2, step: 0.1, label: 'Мудрец думает, с' },
    cap: { value: 30, min: 12, max: 60, step: 2, label: 'Правило 1: ничья после ходов' },
    games: { value: 5, min: 1, max: 9, step: 1, label: 'Партий в матче', restart: true },
    lives: { value: 3, min: 1, max: 9, step: 1, label: 'Жизни (поражение — минус жизнь)', restart: true },
    win: { value: 100, min: 10, max: 300, step: 10, label: 'Очки за победу (серия побед — ×2, ×3)' },
    draw: { value: 25, min: 0, max: 100, step: 5, label: 'Очки за ничью' },
    fork: { value: 20, min: 0, max: 100, step: 5, label: 'Очки за вилку (две угрозы разом)' },
  },
  // вариации: каждый пресет — одна повёрнутая деталь того же ядра. Те же значения — в сценарии урока 2 (шаг variety)
  presets: {
    'Новичок': { depth: 2, mistake: 0.25, first: 0, lives: 5, think: 0.9 },
    'Без спрятанной механики': { rule: 0 },
    'Классика 3 × 3': { rule: 0, size: 3, need: 3 },
    'Три камня': { rule: 1, keep: 3 },
    'Ветер с Фишта': { rule: 2 },
    'Пять на пять': { rule: 0, size: 5, need: 4 },
    'Пять в ряд (гомоку)': { rule: 0, size: 9, need: 5 },
    'Четыре в ряд': { rule: 0, size: 7, need: 4, drop: 1 },
    'Большие и малые': { rule: 0, gob: 1 },
    'Бомбы': { rule: 0, size: 5, need: 4, bombs: 2 },
    'Наоборот': { rule: 0, size: 4, need: 3, misere: 1 },
    'Завалы': { rule: 0, size: 6, need: 4, rocks: 7 },
    'Монетка': { rule: 0, coin: 1 },
    'Безумие': { rule: 1, keep: 2, turnTime: 3, think: 0.2 },
    'Вдвоём': { vs: 1 },
  },
  // имя и строка правила вариации для экрана партии: первая, чьи ручки совпали с текущими
  VARIANTS: [
    { name: 'Четыре в ряд', like: 'Connect Four', how: 'камень падает к ближнему краю, собери 4', cfg: { drop: 1 } },
    { name: 'Большие и малые', like: 'Gobblet Gobblers', how: 'большой камень накрывает меньший, Shift — размер', cfg: { gob: 1 } },
    { name: 'Бомбы', like: 'Tic-Tac-Toe с бомбами', how: 'Shift — взять бомбу: она сносит крест из пяти лунок', cfg: { bombs: [1, 2, 3] } },
    { name: 'Наоборот', like: 'мизер и Notakto', how: 'собрал линию — проиграл', cfg: { misere: 1 } },
    { name: 'Монетка', like: 'random-turn tic-tac-toe', how: 'кто ходит — решает монетка', cfg: { coin: 1 } },
    { name: 'Завалы', like: 'поле с препятствиями', how: 'линия через валун не идёт', cfg: { rocks: [1, 2, 3, 4, 5, 6, 7, 8, 9, 10, 11, 12] } },
    { name: 'Пять на пять', like: 'm,n,k-игры', how: 'поле 5 × 5, собери 4', cfg: { size: 5, need: 4 } },
    { name: 'Пять в ряд', like: 'гомоку', how: 'поле 9 × 9, собери 5', cfg: { size: 9, need: 5 } },
    { name: 'Ветер с Фишта', like: 'одно правило', how: 'ветер сдвигает камень в соседнюю лунку', cfg: { rule: 2 } },
    { name: 'Три камня', like: 'Terni Lapilli, «бесконечные крестики»', how: 'четвёртый камень — старый исчезает', cfg: { rule: 1 } },
  ],
  notes: [
    'Весы исхода считают тем же перебором, что и мудрец: в классике он видит игру до конца, с правилом или на большом поле — на несколько ходов',
    'Камень мудреца летит из посоха по дуге: видно, кто и куда сходил',
    'На большом поле мудрец смотрит только лунки рядом с камнями: так он успевает подумать',
  ],

  TOP: 1.0, // высота плиты-доски
  WINDS: [{ d: [0, -1], name: 'к мудрецу', arrow: '↑' }, { d: [0, 1], name: 'к тебе', arrow: '↓' }, { d: [-1, 0], name: 'влево', arrow: '←' }, { d: [1, 0], name: 'вправо', arrow: '→' }],
  SUN: ['#ffd23f', '#fff3a0', '#ff9f1c'],
  MOON: ['#5fa8ff', '#8fe3ff', '#ffffff'],
  GOB: [0.58, 0.82, 1.08], // размеры камней «Больших и малых»
  SIZE_NAMES: ['малый', 'средний', 'большой'],

  // ---------- новая партия: мир и матч ----------
  start(lab, scene) {
    const st = lab.state;
    Object.assign(st, { game: 0, wins: 0, draws: 0, losses: 0, secretHits: 0, timeouts: 0, forks: 0, blocks: 0, sageBlocks: 0, streak: 0, bombsUsed: 0, covers: 0,
      known: [], lengths: [], stones: [], cursor: 0, repeat: 0, zoomK: 0, zoomWas: false, windT: 0, scaleX: 0, mood: '', hand: 0, moteT: 0 });
    this.rules(lab);
    st.cursor = this.center();
    this.assets(lab);
    this.scenery(lab, scene);
    this.buildTable(lab);
    this.buildSage(lab);
    this.buildMarkers(lab);
    this.buildScales(lab);
    this.buildLife(lab);
    const v = lab.view;
    st.camT = v.target.clone(); st.camBase = v.distance; st.zoomAt = lab.v3(0, 0, 0); st.camLast = v.distance;
    lab.hero(st.cursorMesh);
    this.newGame(lab);
    if (!lab.playing) this.poster(lab);
  },

  // правила партии одним объектом: поле, линии, вариации. Чистые функции ниже берут его первым аргументом
  rules(lab) {
    const cfg = lab.cfg, st = lab.state, N = Math.round(cfg.size), K = Math.min(N, Math.round(cfg.need));
    const gob = Math.round(cfg.gob) === 1, drop = !gob && Math.round(cfg.drop) === 1; // стопки не падают
    let rule = Math.round(cfg.rule);
    if (gob && rule === 1) rule = 0; // у «Больших и малых» камни и так кончаются
    if ((drop || gob) && rule === 2) rule = 0; // ветер не дружит с падением и стопками
    const lines = [], dirs = [[0, 1], [1, 0], [1, 1], [1, -1]];
    for (let r = 0; r < N; r++) for (let c = 0; c < N; c++) for (const [dr, dc] of dirs) {
      const er = r + dr * (K - 1), ec = c + dc * (K - 1);
      if (er < 0 || er >= N || ec < 0 || ec >= N) continue;
      const l = []; for (let k = 0; k < K; k++) l.push((r + dr * k) * N + c + dc * k);
      lines.push(l);
    }
    const through = Array.from({ length: N * N }, () => []);
    lines.forEach((l, i) => l.forEach(c => through[c].push(i)));
    const wc = cfg.wind;
    st.R = { N, K, lines, through, drop, gob, rule, mis: Math.round(cfg.misere) === 1, coin: Math.round(cfg.coin) === 1,
      bombs: gob ? 0 : Math.round(cfg.bombs), gobN: N === 3 ? 2 : Math.ceil(N * N / 6), rocks: Math.min(Math.round(cfg.rocks), N * N - 2 * K), keep: Math.round(cfg.keep), cap: cfg.cap,
      winds: [[null, 1 - wc]].concat(this.WINDS.map(w => [w, wc / 4])) };
    // gobN — камней каждого размера у «Больших и малых»: на 3 × 3 по два, как в Gobblet Gobblers, на большом поле — больше
    st.R.classic = N === 3 && rule === 0 && !gob && !st.R.bombs && !st.R.rocks; // полностью решаемая игра: мудрец видит до конца
    this.N = N; this.CELL = N <= 3 ? 2.3 : 8 / N; this.SC = this.CELL / 2.3; this.HALF = Math.max(4.4, N * this.CELL / 2 + 0.9);
    this.memo = null;
  },
  center() { const N = this.N; return Math.floor(N / 2) * N + Math.floor(N / 2); },

  // ---------- каждый кадр ----------
  update(lab, dt) {
    const st = lab.state, cfg = lab.cfg, duel = Math.round(cfg.vs) === 1;
    if (st.posterStones) { st.posterStones.forEach(g => g.removeFromParent()); st.posterStones = null; this.hideAim(lab); }
    if (st.phase === 'coin') this.coinFlip(lab, dt);
    else if (st.phase === 'turn' && (st.turn === 1 || duel)) this.playerTurn(lab, dt);
    else if (st.phase === 'turn') {
      st.t -= dt;
      if (st.t <= 0) { st.target = this.botMove(lab); st.phase = 'aim'; st.t = 0.45; this.showAim(lab, st.target); }
    } else if (st.phase === 'aim') {
      st.t -= dt;
      this.updateBeam(lab);
      if (st.t <= 0) { this.hideAim(lab); this.place(lab, st.target, 2); }
    } else if (st.phase === 'anim') {
      st.t -= dt;
      if (st.t <= 0) this.afterMove(lab);
    } else if (st.phase === 'end') {
      st.t -= dt;
      if (st.t <= 0) {
        if (st.game >= Math.round(cfg.games)) lab.win(`Матч сыгран: ${st.wins} ${this.plural(st.wins, 'победа', 'победы', 'побед')}, ${st.draws} ${this.plural(st.draws, 'ничья', 'ничьи', 'ничьих')}`);
        else this.newGame(lab);
      }
    }
    this.animateWorld(lab, dt);
    this.updateMarkers(lab, dt);
    this.updateScales(lab, dt);
    this.updateCamera(lab, dt);
    this.hudLines(lab);
  },
  hudLines(lab) {
    const st = lab.state, cfg = lab.cfg, R = st.R, duel = Math.round(cfg.vs) === 1, games = Math.round(cfg.games);
    lab.hud('game', `Партия ${Math.min(st.game, games)} из ${games} · ${st.wins} : ${st.losses} · ничьих ${st.draws}`, { color: '#ffffff', size: 14 });
    const v = this.variant(lab);
    lab.hud('rule', v.name + ': ' + v.how, { color: '#ffe680', size: 14 });
    const clock = cfg.turnTime > 0 ? ` · ${Math.ceil(Math.max(0, st.clock))} с` : '';
    const sideCol = st.turn === 1 ? '#ffd23f' : '#8fd0ff';
    lab.hud('turn', st.phase === 'end' ? st.resultText : st.phase === 'coin' ? 'Монетка летит…' : duel ? (st.turn === 1 ? 'Ходят солнца (игрок 1)' : 'Ходят луны (игрок 2)') + clock : st.turn === 1 ? 'Твой ход' + clock : 'Мудрец думает…',
      { color: st.phase === 'end' ? '#ffffff' : sideCol, size: 20 });
    const opts = this.handOptions(lab, st.turn), my = st.phase === 'turn' && (st.turn === 1 || duel);
    lab.hud('hand', my && opts.length > 1 ? `В руке: ${this.handName(lab, opts[st.hand % opts.length])} · Shift или B — сменить` : null, { color: '#ffb36b', size: 14 });
    lab.hud('wind', R.rule === 2 && st.phase !== 'end' ? (st.wind ? `Ветер ${st.wind.arrow} ${st.wind.name}` : 'Безветрие') : null, { color: '#e8f7ff' });
    lab.hud('oracle', cfg.oracle && st.phase !== 'end' ? this.oracleText(lab) : null, { color: st.sure ? '#ffffff' : '#c8ecff' });
    lab.hud('streak', !duel && st.streak >= 2 ? `Серия побед ×${Math.min(3, st.streak)}` : null, { color: '#ff9f1c', size: 16 });
  },
  // какая вариация сейчас: по ручкам, иначе — описание поля
  variant(lab) {
    const cfg = lab.cfg, R = lab.state.R, st = lab.state;
    if (st.vName && st.vFor === R) return st.vName;
    const hit = this.VARIANTS.find(v => Object.entries(v.cfg).every(([k, x]) => (Array.isArray(x) ? x.includes(Math.round(cfg[k])) : Math.round(cfg[k]) === x)));
    let out;
    if (hit && !(hit.cfg.rule != null && (R.N !== 3 || R.rule !== hit.cfg.rule))) out = { name: hit.name, how: hit.how, like: hit.like };
    else if (R.N === 3 && R.K === 3 && R.rule === 0) out = { name: 'Классика', how: 'три в ряд на поле 3 × 3', like: 'крестики-нолики' };
    else out = { name: `Поле ${R.N} × ${R.N}`, how: `собери ${R.K} в ряд` + (R.rule === 1 ? `, старый камень исчезает` : ''), like: 'm,n,k-игра' };
    st.vName = out; st.vFor = R;
    return out;
  },

  overNote(lab) {
    const st = lab.state, R = st.R, n = st.wins + st.draws + st.losses, notes = [];
    const duel = Math.round(lab.cfg.vs) === 1, v = this.variant(lab);
    notes.push(`Вариация: ${v.name} (как ${v.like}) — ${v.how}`);
    if (duel) notes.push(`Партий: ${n} · солнца ${st.wins} : ${st.losses} луны · ничьих ${st.draws}`);
    else notes.push(`Партий: ${n} · побед ${st.wins} · ничьих ${st.draws} · поражений ${st.losses}`);
    const avg = list => list.length ? Math.round(10 * list.reduce((a, b) => a + b, 0) / list.length) / 10 : 0;
    if (R.classic && !R.mis && !R.coin && !R.drop) notes.push(duel ? 'Классика решена: кто знает, как не проиграть, всегда сведёт партию вничью.' : 'Исход каждой партии был известен с первого хода: при точной игре — ничья. Мудрец просчитал игру до конца.');
    else if (st.known.length) notes.push(`Исход становился известен в среднем на ходу ${avg(st.known)} из ${avg(st.lengths)}: до этого игра была открыта`);
    if (R.rule === 1) notes.push(`Спрятанная механика сработала ${st.secretHits} раз: старые камни исчезали`);
    if (R.rule === 2) notes.push(`Спрятанная механика сработала ${st.secretHits} раз: ветер сдвигал камни`);
    if (R.classic && !R.mis && !R.coin && !R.drop && n && st.draws === n) notes.push('Все партии — ничьи. Решённая игра: что бы ты ни делал, исход известен заранее.');
    if (R.classic && !duel && lab.cfg.mistake > 0) notes.push('Мудрец иногда ошибался — неопределённость принесла его ошибка, а не правило');
    if (st.forks || st.blocks || st.sageBlocks) notes.push(`Вилок: ${st.forks} · ты закрыл линий: ${st.blocks} · ${duel ? 'луны' : 'мудрец'} закрыл${duel ? 'и' : ''}: ${st.sageBlocks}`);
    if (st.bombsUsed) notes.push(`Бомб взорвано: ${st.bombsUsed}`);
    if (st.covers) notes.push(`Камней накрыто: ${st.covers}`);
    if (st.timeouts) notes.push(`Ход по таймеру сделан за тебя ${st.timeouts} раз`);
    return notes;
  },

  // ---------- партия ----------
  newGame(lab) {
    const st = lab.state, cfg = lab.cfg, R = st.R, N = R.N;
    st.stones.forEach((g, i) => lab.after(i * 0.03, () => { // старые камни взлетают и тают
      const y0 = g.position.y;
      lab.tween(0.32, k => { g.position.y = y0 + k * 2.2; g.scale.setScalar(Math.max(0.01, (g.userData.s || 1) * (1 - k))); g.rotation.y += 0.2; }, 'inQuad');
      lab.after(0.33, () => g.removeFromParent());
    }));
    st.stones = [];
    st.meshAt = Array.from({ length: N * N }, () => []);
    const b = new Array(N * N).fill(0);
    // завалы: валуны в случайных лунках, не в центре
    const rocks = [];
    for (let i = 0, tries = 0; i < R.rocks && tries < 400; tries++) { const c = lab.randInt(0, N * N - 1); if (b[c] || c === this.center()) continue; b[c] = 3; rocks.push(c); i++; }
    this.showRocks(lab, rocks);
    st.pos = { b, q: [null, [], []], ply: 0, who: 0, bombs: [0, R.bombs, R.bombs],
      stk: R.gob ? Array.from({ length: N * N }, () => []) : null, hand: R.gob ? [null, [R.gobN, R.gobN, R.gobN], [R.gobN, R.gobN, R.gobN]] : null };
    st.game++;
    st.knownAt = null; st.mood = ''; st.last = -1; st.hand = 0;
    const first = Math.round(cfg.first);
    st.turn = first === 2 ? (st.game % 2 ? 1 : 2) : first === 0 ? 1 : 2;
    if (st.line.visible) { const s = st.line.scale.x; lab.tween(0.25, k => { st.line.scale.x = Math.max(0.01, s * (1 - k)); }); lab.after(0.26, () => { st.line.visible = false; }); }
    const duel = Math.round(cfg.vs) === 1, v = this.variant(lab);
    lab.popup(lab.v3(0, 3.6, 0), st.game === 1 && v.name !== 'Классика' ? v.name : `Партия ${st.game}`, '#ffffff', 28);
    if (st.game === 1 && v.name !== 'Классика') lab.after(0.3, () => lab.popup(lab.v3(0, 3.0, 0), v.how, '#ffe680', 16));
    else if (!R.coin) lab.after(0.35, () => lab.popup(lab.v3(0, 2.6, 0), duel ? (st.turn === 1 ? 'Первыми — солнца' : 'Первыми — луны') : st.turn === 1 ? 'Ты ходишь первым' : 'Мудрец ходит первым', st.turn === 1 ? '#ffe680' : '#a8dcff', 18));
    lab.tone(392, 0.12, 'triangle', 0.06); lab.tone(587, 0.16, 'triangle', 0.06, 0, 0.1);
    this.beginTurn(lab);
  },
  beginTurn(lab) {
    const st = lab.state, cfg = lab.cfg, R = st.R;
    st.wind = null;
    if (R.coin) { // монетка решает, кто ходит: сначала полёт, потом ход
      st.phase = 'coin'; st.t = 0.75; st.coinTo = lab.chance(0.5) ? 1 : 2;
      st.coin.visible = true; st.coin.position.set(0, this.TOP + 0.6, 0); st.coin.scale.setScalar(1);
      lab.tone(1320, 0.05, 'triangle', 0.05); lab.tone(1760, 0.05, 'triangle', 0.04, 0, 0.06);
      return;
    }
    this.turnReady(lab);
  },
  turnReady(lab) {
    const st = lab.state, cfg = lab.cfg, R = st.R;
    st.phase = 'turn';
    if (R.rule === 2 && lab.chance(cfg.wind)) { st.wind = lab.pick(this.WINDS); lab.sfx.whoosh(); lab.pulse(st.windArrow, 1.4, 0.2); }
    st.hand = 0;
    if (st.turn === 1 || Math.round(cfg.vs) === 1) { st.clock = cfg.turnTime; st.tick = Math.ceil(cfg.turnTime); }
    else st.t = cfg.think;
    if (!this.moves(R, st.pos, st.turn, { bombs: false }).length) { this.afterMove(lab, true); return; } // ходить некуда — ничья
    this.evaluate(lab);
  },
  coinFlip(lab, dt) {
    const st = lab.state, c = st.coin;
    st.t -= dt;
    const k = 1 - Math.max(0, st.t) / 0.75;
    c.position.y = this.TOP + 0.6 + Math.sin(k * Math.PI) * 2.6;
    c.rotation.x = k * Math.PI * 7 + (st.coinTo === 2 ? Math.PI : 0);
    if (st.t <= 0) {
      c.rotation.x = st.coinTo === 2 ? Math.PI : 0;
      st.turn = st.coinTo;
      const duel = Math.round(lab.cfg.vs) === 1;
      lab.popup(lab.v3(0, 3.2, 0), st.turn === 1 ? (duel ? 'Солнца!' : 'Твой ход!') : (duel ? 'Луны!' : 'Ход мудреца'), st.turn === 1 ? '#ffd23f' : '#8fe3ff', 22);
      lab.tone(st.turn === 1 ? 784 : 392, 0.16, 'triangle', 0.07); lab.ring([0, this.TOP, 0], { color: st.turn === 1 ? '#ffd23f' : '#8fe3ff', radius: 1.4 });
      lab.after(0.5, () => { if (st.phase !== 'coin') lab.tween(0.2, q => { c.scale.setScalar(Math.max(0.01, 1 - q)); }); });
      lab.after(0.72, () => { if (st.phase !== 'coin') c.visible = false; });
      this.turnReady(lab);
    }
  },
  playerTurn(lab, dt) {
    const st = lab.state, p = lab.p1, R = st.R, N = R.N;
    let dx = 0, dy = 0;
    if (p.pressed.left) dx = -1; else if (p.pressed.right) dx = 1;
    if (p.pressed.up) dy = -1; else if (p.pressed.down) dy = 1;
    // зажатая стрелка или стик повторяют шаг курсора
    if (p.left || p.right || p.up || p.down) {
      st.repeat += dt;
      if (st.repeat > 0.38) { st.repeat = 0.26; dx = p.left ? -1 : p.right ? 1 : 0; dy = p.up ? -1 : p.down ? 1 : 0; }
    } else st.repeat = 0;
    if (R.drop) dy = 0; // в «Четыре в ряд» выбираешь только столбец
    if (dx || dy) {
      const r = lab.clamp(Math.floor(st.cursor / N) + dy, 0, N - 1), c = lab.clamp(st.cursor % N + dx, 0, N - 1);
      if (r * N + c !== st.cursor) { st.cursor = r * N + c; lab.tone(520 + r * 30 + c * 15, 0.04, 'triangle', 0.04); lab.pulse(st.cursorMesh, 1.15, 0.1); }
    }
    const opts = this.handOptions(lab, st.turn);
    if (p.pressed.b && opts.length > 1) { st.hand = (st.hand + 1) % opts.length; lab.tone(660 + 110 * st.hand, 0.06, 'square', 0.04); lab.pulse(st.cursorMesh, 1.25, 0.12); }
    if (p.pressed.a) {
      const mv = this.cursorMove(lab);
      if (!mv) { lab.tone(140, 0.12, 'square', 0.05); lab.pulse(st.cursorMesh, 1.3, 0.15); lab.shake(0.08); lab.count('в занятую лунку'); }
      else { this.place(lab, mv, st.turn); return; }
    }
    if (lab.cfg.turnTime > 0) {
      st.clock -= dt;
      if (st.clock < st.tick - 1 && st.tick <= 4 && st.clock > 0) lab.tone(st.tick <= 2 ? 1040 : 780, 0.05, 'square', 0.04); // последние секунды тикают
      if (st.clock < st.tick - 1) st.tick--;
      if (st.clock <= 0) { // время вышло: камень кладётся в случайную свободную лунку
        st.timeouts++; lab.count('ходы по таймеру'); lab.sfx.warn();
        this.place(lab, lab.pick(this.moves(R, st.pos, st.turn, { bombs: false })), st.turn);
      }
    }
  },
  // что в руке: размеры камней (большие первыми) и бомба
  handOptions(lab, side) {
    const st = lab.state, R = st.R, pos = st.pos, out = [];
    if (!pos) return out;
    if (R.gob) { for (let s = 2; s >= 0; s--) if (pos.hand[side][s] > 0) out.push(s); }
    else out.push('stone');
    if (pos.bombs[side] > 0) out.push('bomb');
    return out;
  },
  handName(lab, h) {
    const st = lab.state;
    if (h === 'bomb') return `бомба (${st.pos.bombs[st.turn]})`;
    if (h === 'stone') return 'камень';
    return `${this.SIZE_NAMES[h]} камень (${st.pos.hand[st.turn][h]})`;
  },
  // ход под курсором или null, если так нельзя
  cursorMove(lab) {
    const st = lab.state, R = st.R, pos = st.pos, c = st.cursor, opts = this.handOptions(lab, st.turn), h = opts[st.hand % opts.length];
    if (h === 'bomb') return this.plus(R, c).some(i => pos.b[i]) ? { c, bomb: true } : null;
    if (R.drop) { const l = this.landing(R, pos.b, c % R.N); return l >= 0 ? { c: l } : null; }
    if (R.gob) return pos.b[c] !== 3 && this.topSize(pos, c) < h ? { c, sz: h } : null;
    return pos.b[c] ? null : { c };
  },

  // ---------- ход: камень, ветер, исчезновение, падение, бомба ----------
  place(lab, mv, side) {
    const st = lab.state, cfg = lab.cfg, T = this.TOP, duel = Math.round(cfg.vs) === 1, R = st.R;
    const res = this.step(R, st.pos, mv, side, st.wind);
    if (mv.bomb) { this.bomb(lab, mv, side, res, duel); return; }
    const oppThreats = this.threats(R, st.pos, 3 - side);
    const g = this.makeStone(lab, side, { sz: R.gob ? mv.sz : null });
    const from = this.cellPos(R.drop ? mv.c % R.N : mv.c), to = this.cellPos(res.at);
    if (R.drop) from.z = -(R.N / 2 + 0.6) * this.CELL; // в «Четыре в ряд» камень входит с дальнего края столбца
    const under = R.gob ? st.meshAt[res.at].length : 0;
    const rest = T + this.restY(side, R.gob ? mv.sz : null) + under * 0.22 * this.SC;
    g.rotation.y = lab.rand(0, 6.28);
    let fly = 0.16;
    if (side === 2 && !duel) { // камень мудреца летит из посоха по дуге
      const tip = st.tip.getWorldPosition(lab.v3());
      fly = 0.34;
      g.position.copy(tip);
      const tr = lab.trail(g, { color: '#8fe3ff', width: 0.45 * this.SC, length: 12 });
      lab.tween(fly, k => { g.position.set(lab.lerp(tip.x, from.x, k), lab.lerp(tip.y, rest, k) + Math.sin(k * Math.PI) * 1.6, lab.lerp(tip.z, from.z, k)); g.rotation.y += 0.3; }, 'inOutQuad');
      lab.after(fly + 0.2, () => tr.dispose());
      lab.tone(880, 0.12, 'sine', 0.05, 1500);
      lab.burst(tip, { count: 10, colors: this.MOON, speed: 4 });
    } else {
      const y0 = T + 0.75;
      g.position.set(from.x, y0, from.z);
      lab.tween(fly, k => { g.position.y = lab.lerp(y0, rest, k); }, 'inQuad');
    }
    let wait = fly + 0.2;
    if (R.drop) { // катится по столбцу к ближнему краю
      const roll = 0.14 + 0.05 * (Math.floor(res.at / R.N) + 1);
      lab.after(fly, () => {
        lab.tween(roll, k => { g.position.z = lab.lerp(from.z, to.z, k); g.rotation.x = k * 6; }, 'outBounce');
        lab.tone(300, roll, 'triangle', 0.04, 520);
      });
      lab.after(fly + roll, () => this.land(lab, g, side, res.at, rest));
      wait = fly + roll + 0.25;
      lab.count('падения');
    } else lab.after(fly, () => this.land(lab, g, side, res.at, rest));
    if (res.at !== mv.c && !R.drop) { // ветер сдвинул камень — спрятанная механика сработала
      lab.after(fly + 0.08, () => {
        lab.sfx.whoosh();
        lab.tween(0.32, k => { g.position.x = lab.lerp(from.x, to.x, k); g.position.z = lab.lerp(from.z, to.z, k); g.rotation.x = Math.sin(k * Math.PI) * 0.5 * (to.z - from.z ? Math.sign(to.z - from.z) : 1); }, 'inOutCubic');
        lab.after(0.32, () => { lab.ring([to.x, T, to.z], { color: '#e8f7ff', radius: 1.3 * this.SC }); lab.burst([to.x, T + 0.3, to.z], { count: 10, color: '#e8f7ff', speed: 3 }); });
        lab.popup([to.x, T + 1.6, to.z], 'Ветер!', '#e8f7ff', 20);
      });
      st.secretHits++; lab.count('_secret');
      wait = fly + 0.5;
    }
    if (res.cover) { // большой камень накрыл меньший
      st.covers++; lab.count(side === 1 || duel ? 'накрыл' : 'мудрец накрыл');
      const below = st.meshAt[res.at][st.meshAt[res.at].length - 1];
      lab.after(fly, () => {
        if (below) lab.tween(0.18, k => { below.scale.y = (below.userData.s || 1) * (1 - 0.35 * k); });
        lab.popup([to.x, T + 1.9, to.z], res.cover === side ? 'Подстраховал!' : 'Накрыл!', side === 1 ? '#ffe680' : '#a8dcff', 22);
        lab.tone(196, 0.16, 'square', 0.06, 98); lab.shake(0.25); lab.hitstop(0.05);
      });
      wait = Math.max(wait, fly + 0.45);
    }
    st.meshAt[res.at].push(g); st.stones.push(g); st.last = res.at;
    if (res.gone >= 0) { // старый камень исчезает — спрятанная механика сработала
      const old = st.meshAt[res.gone].pop();
      if (old) lab.after(fly + 0.1, () => this.vanish(lab, old));
      st.secretHits++; lab.count('_secret');
      wait = Math.max(wait, fly + 0.5);
    }
    if (res.fell.length) { lab.after(wait, () => this.fall(lab, res.fell)); wait += 0.4; }
    // лучшие моменты жанра: закрыть чужую линию и поставить вилку
    const win = this.result(R, res);
    if (!win && !R.mis && oppThreats.includes(res.at) && res.b[res.at] === side) {
      if (side === 1) { st.blocks++; lab.count('закрытые линии'); } else { st.sageBlocks++; lab.count(duel ? 'луны закрыли' : 'мудрец закрыл'); }
      lab.after(wait, () => { lab.popup([to.x, T + 1.8, to.z], side === 1 ? 'Закрыл!' : duel ? 'Закрыли!' : 'Мудрец закрыл', side === 1 ? '#ffe680' : '#a8dcff', 22); lab.tone(side === 1 ? 784 : 330, 0.14, 'square', 0.05); });
    }
    if (!win && !R.mis && this.threats(R, res, side).length >= 2) {
      if (side === 1) { st.forks++; lab.count('вилки'); } else lab.count(duel ? 'вилки лун' : 'вилки мудреца');
      lab.after(wait, () => {
        lab.popup([to.x, T + 2.4, to.z], 'Вилка!', side === 1 ? '#ffd23f' : '#8fe3ff', 30);
        lab.slowmo(0.4, 0.4); lab.flash(side === 1 ? '#ffd23f' : '#5fa8ff', 0.15);
        lab.tone(659, 0.1, 'triangle', 0.08); lab.tone(988, 0.18, 'triangle', 0.08, 0, 0.08);
        if (side === 1 && lab.cfg.fork > 0) lab.addScore(lab.cfg.fork, [to.x, T + 1.2, to.z], '#ffd23f');
      });
      wait += 0.25;
    }
    st.pos = res;
    if (side === 1) lab.count('мои ходы');
    st.phase = 'anim'; st.t = wait;
  },
  // бомба: летит в лунку, фитиль, взрыв креста из пяти лунок; в «Четыре в ряд» камни сверху падают на освободившиеся места
  bomb(lab, mv, side, res, duel) {
    const st = lab.state, T = this.TOP, p = this.cellPos(mv.c), g = this.makeBomb(lab);
    st.bombsUsed++; lab.count(side === 1 || duel ? 'бомбы' : 'бомбы мудреца');
    let fly = 0.3;
    if (side === 2 && !duel) {
      const tip = st.tip.getWorldPosition(lab.v3());
      g.position.copy(tip); fly = 0.45;
      lab.tween(fly, k => { g.position.set(lab.lerp(tip.x, p.x, k), lab.lerp(tip.y, T + 0.45, k) + Math.sin(k * Math.PI) * 2.2, lab.lerp(tip.z, p.z, k)); g.rotation.z += 0.2; }, 'inOutQuad');
    } else {
      g.position.set(p.x, T + 3, p.z);
      lab.tween(fly, k => { g.position.y = lab.lerp(T + 3, T + 0.45, k); }, 'inQuad');
    }
    lab.tone(520, fly, 'sawtooth', 0.03, 260);
    const cells = this.plus(st.R, mv.c), warn = cells.map(c => { const q = this.cellPos(c); return lab.warn([q.x, T + 0.05, q.z], 0.8 * this.CELL / 2, fly + 0.4, '#ff6a2a'); });
    lab.after(fly, () => { lab.pulse(g, 1.3, 0.12); for (let i = 0; i < 4; i++) lab.after(i * 0.09, () => { lab.tone(1500 + i * 200, 0.03, 'square', 0.03); lab.burst(g.userData.fuse, { count: 4, colors: ['#ffd23f', '#ff6a2a'], speed: 3, size: 0.08 }); }); });
    lab.after(fly + 0.4, () => {
      warn.forEach(w => w.dispose()); g.removeFromParent();
      lab.hitstop(0.08); lab.shake(0.55); lab.flash('#ff8a3a', 0.25); lab.vibrate(120, 0.8);
      lab.noise(0.5, 0.16, 500); lab.tone(90, 0.5, 'sine', 0.12, 40);
      lab.burst([p.x, T + 0.5, p.z], { count: 50, colors: ['#ff6a2a', '#ffd23f', '#5a5a60'], speed: 9, up: 4, life: 0.9 });
      lab.ring([p.x, T + 0.02, p.z], { color: '#ff8a3a', radius: 1.6 * this.CELL });
      lab.popup([p.x, T + 2.2, p.z], res.blown.length ? `Бум! −${res.blown.filter(([, s]) => s !== 3).length}` : 'Бум!', '#ff9f1c', 28);
      for (const [c] of res.blown) {
        const list = st.meshAt[c]; st.meshAt[c] = [];
        const isRock = st.rockAt && st.rockAt[c] != null;
        if (isRock) this.blowRock(lab, c);
        list.forEach(m => { // камни разлетаются от центра взрыва
          const q = m.position.clone(), dx = q.x - p.x, dz = q.z - p.z, y0 = q.y;
          lab.tween(0.5, k => { m.position.set(q.x + dx * k * 1.5, y0 + Math.sin(k * Math.PI) * 2.5, q.z + dz * k * 1.5); m.rotation.x += 0.4; m.scale.setScalar(Math.max(0.01, (m.userData.s || 1) * (1 - k))); }, 'outQuad');
          lab.after(0.5, () => { m.removeFromParent(); st.stones = st.stones.filter(x => x !== m); });
        });
      }
      if (res.fell.length) lab.after(0.3, () => this.fall(lab, res.fell));
    });
    st.pos = res; st.last = -1;
    st.phase = 'anim'; st.t = fly + 0.4 + (res.fell.length ? 0.8 : 0.45);
  },
  // камни переезжают по столбцу (после бомбы или исчезновения в «Четыре в ряд»)
  fall(lab, moves) {
    const st = lab.state, T = this.TOP;
    const moved = moves.map(([from, to]) => [st.meshAt[from], to, from]);
    moved.forEach(([list, , from]) => { st.meshAt[from] = []; });
    moved.forEach(([list, to]) => {
      st.meshAt[to] = list;
      const q = this.cellPos(to);
      list.forEach(m => { const z0 = m.position.z; lab.tween(0.3, k => { m.position.z = lab.lerp(z0, q.z, k); m.position.x = q.x; }, 'outBounce'); });
      if (st.rockAt && st.rockAt[from] != null) this.moveRock(lab, from, to);
    });
    if (moves.length) { lab.tone(260, 0.2, 'triangle', 0.05, 180); lab.after(0.3, () => lab.shake(0.15)); }
  },
  restY(side, sz) { const k = sz == null ? this.SC : this.SC * this.GOB[sz]; return (side === 1 ? 0.17 : 0.6) * k; },
  land(lab, g, side, cell, rest) {
    const st = lab.state, p = this.cellPos(cell), ply = st.pos.ply;
    g.position.y = rest;
    lab.burst([p.x, this.TOP + 0.3, p.z], { count: 14, colors: side === 1 ? this.SUN : this.MOON, speed: 5, up: 1 });
    lab.ring([p.x, this.TOP, p.z], { color: side === 1 ? '#ffd23f' : '#8fe3ff', radius: 1.4 * this.SC });
    const f = (side === 1 ? 660 : 392) * lab.pitch(Math.min(12, Math.floor(ply / 2))); // доска заполняется — звон всё выше
    lab.tone(f, 0.1, 'triangle', 0.08, f * 1.5); lab.noise(0.05, 0.08, 2600);
    lab.shake(0.12); lab.vibrate(40, 0.3);
    lab.pulse(g, 1.3, 0.16);
  },
  vanish(lab, old) {
    const st = lab.state, y0 = old.position.y, p = old.position.clone(), s0 = old.userData.s || 1;
    lab.whiten(old, 0.1, '#ff4d5e');
    lab.tone(240, 0.28, 'sine', 0.07, 80); lab.noise(0.18, 0.08, 900);
    lab.tween(0.34, k => { old.scale.setScalar(Math.max(0.01, s0 * (1 - k))); old.position.y = y0 + k * 1.2; old.rotation.y += 0.25; }, 'inQuad');
    lab.after(0.34, () => {
      lab.burst(p, { count: 18, colors: ['#c9ccd4', '#ffffff', '#ff8a8a'], speed: 4, up: 2 });
      lab.ring([p.x, this.TOP, p.z], { color: '#ff6b7a', radius: 1.2 * this.SC });
      old.removeFromParent(); st.stones = st.stones.filter(x => x !== old);
    });
  },
  afterMove(lab, stuck) {
    const st = lab.state, cfg = lab.cfg, R = st.R;
    const w = this.result(R, st.pos);
    const full = stuck || (R.rule === 1 && st.pos.ply >= cfg.cap);
    if (!w && !full) {
      st.turn = 3 - st.turn;
      if (!this.moves(R, st.pos, st.turn, { bombs: false }).length && !R.coin) { this.afterMove(lab, true); return; } // некуда ходить — ничья
      this.beginTurn(lab); return;
    }
    if (st.knownAt == null) st.knownAt = st.pos.ply;
    st.known.push(st.knownAt); st.lengths.push(st.pos.ply);
    lab.stat('ходов в партии', Math.round(10 * st.lengths.reduce((a, b) => a + b, 0) / st.lengths.length) / 10);
    st.phase = 'end'; st.t = 2.2;
    const duel = Math.round(cfg.vs) === 1, at = lab.v3(0, this.TOP + 1, 0);
    if (w) { const line = this.lineOf(R, st.pos.b, R.mis ? 3 - w : w); if (line) this.winLine(lab, line, R.mis ? 3 - w : w); }
    if (w === 1) {
      st.wins++; st.streak++; st.resultText = duel ? 'Солнца выиграли партию' : R.mis ? 'Победа: мудрец собрал линию!' : 'Победа!'; lab.count('победы');
      const mult = duel ? 1 : Math.min(3, st.streak);
      lab.after(0.45, () => { lab.addScore(cfg.win * mult, lab.v3(0, 3.2, 0), '#ffd23f'); lab.sfx.win(); lab.flash('#ffd23f', 0.35); lab.shake(0.45);
        lab.burst(at, { count: 70, colors: this.SUN, speed: 11, up: 5, life: 1 });
        if (mult > 1) lab.after(0.3, () => lab.popup(lab.v3(0, 4, 0), `Серия ×${mult}!`, '#ff9f1c', 26));
        if (!duel) this.say(lab, 'Не может быть!', true); });
    } else if (w === 2 && duel) { // вдвоём луны — второй игрок: его победа без потери жизни
      st.losses++; st.resultText = 'Луны выиграли партию'; lab.count('победы лун');
      lab.after(0.45, () => { lab.sfx.win(); lab.flash('#5fa8ff', 0.35); lab.shake(0.45); lab.burst(at, { count: 70, colors: this.MOON, speed: 11, up: 5, life: 1 }); });
    } else if (w === 2) {
      st.losses++; st.streak = 0; st.resultText = R.mis ? 'Ты собрал линию — мудрец выиграл' : 'Мудрец выиграл партию'; lab.count('поражения');
      lab.after(0.45, () => { lab.burst(st.tip, { count: 30, colors: this.MOON, speed: 7, up: 3 }); this.say(lab, 'Так было предначертано.', true); lab.hurt(at, 'Мудрец забрал все жизни'); });
    } else {
      st.draws++; st.resultText = R.rule === 1 && st.pos.ply >= cfg.cap ? 'Ничья: ходы кончились' : 'Ничья';
      lab.count('ничьи'); lab.addScore(cfg.draw, lab.v3(0, 3, 0), '#bfe9ff');
      lab.tone(392, 0.3, 'triangle', 0.08); lab.tone(494, 0.3, 'triangle', 0.07, 0, 0.16); lab.tone(392, 0.4, 'triangle', 0.08, 0, 0.32);
      st.stones.forEach((g, i) => lab.after(i * 0.04, () => lab.pulse(g, 0.85, 0.2))); // камни разом «вздыхают»
      if (!duel && R.classic) this.say(lab, 'Как я и говорил: ничья.', true);
    }
    if (st.known.length) lab.stat('исход известен с хода', R.classic && !R.coin && !R.mis && !R.drop ? 1 : Math.round(10 * st.known.reduce((a, b) => a + b, 0) / st.known.length) / 10);
  },
  // победная линия: камни звенят по очереди всё выше, линия прочерчивается, стоп-кадр, замедление, камера наезжает
  winLine(lab, line, side) {
    const st = lab.state, a = this.cellPos(line[0]), b = this.cellPos(line[line.length - 1]), T = this.TOP;
    const len = Math.hypot(b.x - a.x, b.z - a.z) + 1.8 * this.SC, cols = side === 1 ? this.SUN : this.MOON;
    lab.hitstop(0.1); lab.slowmo(0.7, 0.45);
    line.forEach((c, k) => lab.after(0.08 + k * 0.12, () => {
      const list = st.meshAt[c], m = list && list[list.length - 1], p = this.cellPos(c);
      if (m) { const y0 = m.position.y; lab.tween(0.3, q => { m.position.y = y0 + Math.sin(q * Math.PI) * 0.9; }); lab.pulse(m, 1.5, 0.22); }
      lab.tone((side === 1 ? 523 : 392) * lab.pitch(k * 4), 0.18, 'triangle', 0.1);
      lab.burst([p.x, T + 0.6, p.z], { count: 16, colors: cols, speed: 6, up: 2 });
    }));
    st.line.material = side === 1 ? st.sunLine : st.moonLine;
    st.line.visible = true; st.line.scale.x = 0.01; st.line.scale.z = Math.max(0.5, this.SC);
    st.line.position.set((a.x + b.x) / 2, T + 0.9 * Math.max(0.6, this.SC), (a.z + b.z) / 2);
    st.line.rotation.y = -Math.atan2(b.z - a.z, b.x - a.x);
    lab.after(0.1, () => lab.tween(0.4, k => { st.line.scale.x = Math.max(0.01, len * k); }, 'outCubic'));
    st.zoomAt.set((a.x + b.x) / 2, 0, (a.z + b.z) / 2);
    lab.tween(0.5, k => { st.zoomK = k; }, 'outCubic');
    lab.after(1.5, () => lab.tween(0.6, k => { st.zoomK = 1 - k; }, 'inOutCubic'));
  },

  // ---------- правила и перебор (чистые функции позиции) ----------
  // позиция: b — лунки (0 пусто, 1 солнца, 2 луны, 3 валун), q — очередь камней каждой стороны (старые первыми), ply — сделано ходов,
  // who — кто сходил последним, bombs — бомбы сторон, stk и hand — стопки и запас «Больших и малых»
  step(R, pos, mv, side, wind) {
    const N = R.N, b = pos.b.slice(), q = [null, pos.q[1].slice(), pos.q[2].slice()];
    const out = { b, q, ply: pos.ply + 1, who: side, bombs: pos.bombs.slice(), stk: pos.stk ? pos.stk.map(x => x.slice()) : null,
      hand: pos.hand ? [null, pos.hand[1].slice(), pos.hand[2].slice()] : null, at: mv.c, gone: -1, blown: [], fell: [], cover: 0 };
    if (mv.bomb) {
      out.bombs[side]--;
      for (const c of this.plus(R, mv.c)) if (b[c]) {
        out.blown.push([c, b[c]]); b[c] = 0;
        if (out.stk) out.stk[c] = [];
        for (const s of [1, 2]) { const k = q[s].indexOf(c); if (k >= 0) q[s].splice(k, 1); }
      }
      if (R.drop) this.compact(R, out);
      return out;
    }
    let at = mv.c;
    if (R.drop) at = this.landing(R, b, mv.c % N);
    else if (wind) {
      const r = Math.floor(at / N) + wind.d[1], c = at % N + wind.d[0];
      if (r >= 0 && r < N && c >= 0 && c < N && !b[r * N + c]) at = r * N + c;
    }
    if (out.stk) {
      const s = out.stk[at];
      if (s.length) out.cover = s[s.length - 1][0];
      s.push([side, mv.sz]); out.hand[side][mv.sz]--;
    }
    b[at] = side; q[side].push(at); out.at = at;
    if (R.rule === 1 && q[side].length > R.keep) {
      const g = q[side].shift(); b[g] = 0; out.gone = g;
      if (R.drop) this.compact(R, out);
    }
    return out;
  },
  // «Четыре в ряд»: всё, что висит над пустой лункой, съезжает к ближнему краю (+Z, большая строка)
  compact(R, out) {
    const N = R.N, b = out.b;
    for (let c = 0; c < N; c++) {
      let free = N - 1;
      for (let r = N - 1; r >= 0; r--) {
        const i = r * N + c;
        if (!b[i]) continue;
        const to = free * N + c;
        if (to !== i) {
          b[to] = b[i]; b[i] = 0; out.fell.push([i, to]);
          for (const s of [1, 2]) { const k = out.q[s].indexOf(i); if (k >= 0) out.q[s][k] = to; }
        }
        free--;
      }
    }
  },
  landing(R, b, col) { for (let r = R.N - 1; r >= 0; r--) if (!b[r * R.N + col]) return r * R.N + col; return -1; },
  plus(R, c) {
    const N = R.N, r = Math.floor(c / N), k = c % N, out = [c];
    if (r > 0) out.push(c - N); if (r < N - 1) out.push(c + N); if (k > 0) out.push(c - 1); if (k < N - 1) out.push(c + 1);
    return out;
  },
  topSize(pos, c) { const s = pos.stk[c]; return s.length ? s[s.length - 1][1] : -1; },
  // у кого собрана линия: { 1: да/нет, 2: да/нет }
  lined(R, b) {
    let w1 = false, w2 = false;
    for (const l of R.lines) {
      const s = b[l[0]];
      if (s !== 1 && s !== 2) continue;
      let ok = true;
      for (let k = 1; k < l.length; k++) if (b[l[k]] !== s) { ok = false; break; }
      if (ok) { if (s === 1) w1 = true; else w2 = true; }
    }
    return [false, w1, w2];
  },
  // победитель позиции: линия у одного — он (в «Наоборот» — его соперник); у обоих — решает сходивший последним
  result(R, pos) {
    const w = this.lined(R, pos.b);
    if (!w[1] && !w[2]) return 0;
    const mover = pos.who || 1;
    const liner = w[1] && w[2] ? mover : w[1] ? 1 : 2;
    return R.mis ? 3 - liner : liner;
  },
  lineOf(R, b, s) { return R.lines.find(l => l.every(i => b[i] === s)); },
  // пустые лунки, где сторона s следующим ходом соберёт линию (в «Четыре в ряд» — только куда камень упадёт)
  threats(R, pos, s) {
    const b = pos.b, out = [];
    for (const l of R.lines) {
      let mine = 0, empty = -1, other = false;
      for (const i of l) { if (b[i] === s) mine++; else if (!b[i] && empty < 0) empty = i; else { other = true; break; } }
      if (other || mine !== l.length - 1 || empty < 0 || out.includes(empty)) continue;
      if (R.drop && this.landing(R, b, empty % R.N) !== empty) continue;
      out.push(empty);
    }
    return out;
  },
  // ходы стороны: лунки (на большом поле — только рядом с камнями), столбцы, размеры, бомбы
  moves(R, pos, side, o = {}) {
    const N = R.N, b = pos.b, out = [];
    if (R.gob) { for (let sz = 2; sz >= 0; sz--) if (pos.hand[side][sz] > 0) for (let c = 0; c < N * N; c++) if (b[c] !== 3 && this.topSize(pos, c) < sz) out.push({ c, sz }); }
    else if (R.drop) { for (let col = 0; col < N; col++) { const l = this.landing(R, b, col); if (l >= 0) out.push({ c: l }); } }
    else {
      const near = N >= 6 && o.near !== false;
      let any = false;
      if (near) for (let i = 0; i < N * N; i++) if (b[i] === 1 || b[i] === 2) { any = true; break; }
      for (let c = 0; c < N * N; c++) {
        if (b[c]) continue;
        if (near && any) {
          const r = Math.floor(c / N), k = c % N; let ok = false;
          for (let dr = -1; dr <= 1 && !ok; dr++) for (let dk = -1; dk <= 1 && !ok; dk++) { const rr = r + dr, kk = k + dk; if (rr >= 0 && rr < N && kk >= 0 && kk < N) { const v = b[rr * N + kk]; if (v === 1 || v === 2) ok = true; } }
          if (!ok) continue;
        }
        out.push({ c });
      }
      if (near && !any && out.length) { const c0 = this.center(); return [out.find(m => m.c === c0) || out[0]]; }
    }
    if (o.bombs !== false && pos.bombs[side] > 0) for (let c = 0; c < N * N; c++) if (this.plus(R, c).some(i => b[i] === 3 - side)) out.push({ c, bomb: true });
    return out;
  },
  W: [0, 1, 4, 16, 64, 256],
  heur(R, b, s) { // открытые линии своих камней минус чужих, свои растут быстрее с каждым камнем
    let v = 0;
    for (const l of R.lines) {
      let mine = 0, theirs = 0, rock = false;
      for (const i of l) { const x = b[i]; if (x === s) mine++; else if (x === 3) { rock = true; break; } else if (x) theirs++; }
      if (rock) continue;
      if (!theirs) v += this.W[mine]; if (!mine) v -= this.W[theirs];
    }
    if (R.mis) v = -v;
    return Math.max(-700, Math.min(700, v));
  },
  // порядок ходов: сначала свои линии и закрытие чужих, потом лунки с большим числом живых линий
  order(R, pos, s, ms) {
    const b = pos.b;
    const val = m => {
      if (m.bomb) return 5 + this.plus(R, m.c).filter(i => b[i] === 3 - s).length * 30;
      let v = (m.sz || 0) * 2;
      for (const li of R.through[m.c]) {
        let mine = 0, theirs = 0;
        for (const i of R.lines[li]) { const x = b[i]; if (x === s) mine++; else if (x === 3) { mine = theirs = -9; break; } else if (x) theirs++; }
        if (mine < 0) continue;
        if (!theirs) v += this.W[mine + 1] * (mine === R.K - 1 ? 50 : 1);
        if (!mine) v += this.W[theirs] * (theirs === R.K - 1 ? 25 : 1);
      }
      return v;
    };
    return ms.map(m => [val(m), m]).sort((a, b2) => b2[0] - a[0]).map(x => x[1]);
  },
  // негамакс с отсечением; ветер следующего хода неизвестен — берём среднее по всем ветрам
  search(pos, s, depth, alpha, beta, ctx) {
    const R = ctx.R;
    ctx.nodes++;
    const w = this.result(R, pos);
    if (w) return w === s ? 1000 - pos.ply : pos.ply - 1000;
    if (R.rule === 1 && pos.ply >= R.cap) return 0;
    let ms = this.moves(R, pos, s, { bombs: false });
    if (!ms.length) return 0;
    if (depth <= 0 || ctx.nodes > ctx.budget) return this.heur(R, pos.b, s);
    ms = this.order(R, pos, s, ms).slice(0, ctx.width);
    let best = -Infinity;
    for (const m of ms) {
      let v = 0;
      if (R.rule === 2) for (const [wd, pr] of R.winds) v += pr ? -pr * this.search(this.step(R, pos, m, s, wd), 3 - s, depth - 1, -Infinity, Infinity, ctx) : 0;
      else v = -this.search(this.step(R, pos, m, s, null), 3 - s, depth - 1, -beta, -alpha, ctx);
      if (v > best) best = v;
      if (best > alpha) alpha = best;
      if (alpha >= beta && R.rule !== 2) break;
    }
    return best;
  },
  // классика решается целиком: позиций меньше 6 тысяч, ответы запоминаются на всю игру
  solve(R, pos, s) {
    const memo = this.memo || (this.memo = {}), key = pos.b.join('') + s;
    if (key in memo) return memo[key];
    const w = this.result(R, pos);
    let best;
    if (w) best = w === s ? 1000 - pos.ply : pos.ply - 1000;
    else {
      const ms = this.moves(R, pos, s, { bombs: false });
      if (!ms.length) best = 0;
      else { best = -Infinity; for (const m of ms) best = Math.max(best, -this.solve(R, this.step(R, pos, m, s, null), 3 - s)); }
    }
    return (memo[key] = best);
  },
  ctx(lab, budget) {
    const R = lab.state.R;
    return { R, nodes: 0, budget, width: R.N <= 4 && !R.gob ? 99 : R.gob ? 14 : 10 };
  },
  // с правилом или на большом поле игра слишком велика для расчёта до конца
  sight(lab) { const R = lab.state.R; return Math.min(Math.round(lab.cfg.depth), R.classic ? 9 : R.rule === 2 ? 3 : R.N <= 4 ? 4 : 3); },
  botMove(lab) {
    const st = lab.state, cfg = lab.cfg, R = st.R;
    const free = this.moves(R, st.pos, 2, { bombs: false });
    if (lab.chance(cfg.mistake)) { lab.count('ошибки мудреца'); return lab.pick(free); }
    const all = this.order(R, st.pos, 2, this.moves(R, st.pos, 2));
    // своя линия — сразу; в «Наоборот» — никогда
    for (const m of all) if (!m.bomb && this.result(R, this.step(R, st.pos, m, 2, st.wind)) === 2) return m;
    // бомба мудреца: против вилки, которую камнем не закрыть, или в кучу из трёх твоих камней
    const bombs = all.filter(m => m.bomb);
    if (bombs.length) {
      const hits = m => this.plus(R, m.c).filter(i => st.pos.b[i] === 1).length - this.plus(R, m.c).filter(i => st.pos.b[i] === 2).length;
      const left = m => this.threats(R, this.step(R, st.pos, m, 2, null), 1).length;
      if (!R.mis && this.threats(R, st.pos, 1).length >= 2) return bombs.reduce((a, b) => (left(b) < left(a) || (left(b) === left(a) && hits(b) > hits(a)) ? b : a));
      const big = bombs.filter(m => hits(m) >= 3);
      if (big.length) return big[0];
    }
    const ctx = this.ctx(lab, R.N >= 7 ? 25000 : 80000), depth = this.sight(lab);
    let best = -Infinity, moves = [];
    for (const m of all.slice(0, Math.max(ctx.width + 4, 16))) { // ход мудреца: ветер этого хода известен, дальше — среднее
      const next = this.step(R, st.pos, m, 2, st.wind);
      const v = R.classic && depth >= 9 ? -this.solve(R, next, 1) : -this.search(next, 1, depth - 1, -Infinity, Infinity, ctx);
      if (v > best + 1e-6) { best = v; moves = [m]; } else if (Math.abs(v - best) < 1e-6) moves.push(m);
    }
    const plain = moves.filter(m => !m.bomb); // бомба — только если она лучше любого камня
    return lab.pick(plain.length ? plain : moves);
  },
  // весы исхода: что видит мудрец тем же перебором. В классике — всё (игра решена); иначе — только вынужденную победу на несколько ходов
  evaluate(lab) {
    const st = lab.state, R = st.R, ctx = this.ctx(lab, R.N >= 7 ? 4000 : 15000), depth = this.sight(lab);
    let v;
    if (R.classic && depth >= 9) { v = this.solve(R, st.pos, st.turn); st.sure = !R.coin; }
    else { v = this.search(st.pos, st.turn, R.rule === 2 ? 2 : Math.min(R.N >= 7 ? 2 : 4, depth), -Infinity, Infinity, ctx); st.sure = Math.abs(v) > 900 && !R.coin; }
    if (st.turn === 2) v = -v; // весы — от лица солнц
    st.evalV = v;
    st.scaleTo = st.sure ? Math.sign(v) : Math.tanh(v / 10) * 0.6;
    if (st.sure && st.knownAt == null) st.knownAt = st.pos.ply + 1;
    // реплика мудреца, когда меняется то, что он видит
    const mood = !st.sure ? 'open' : v > 0 ? 'sun' : v < 0 ? 'moon' : 'draw';
    if (mood !== st.mood) {
      const was = st.mood; st.mood = mood;
      if (Math.round(lab.cfg.vs) !== 1) {
        if (mood === 'draw') this.say(lab, 'Я вижу исход: ничья.');
        else if (mood === 'moon') this.say(lab, lab.pick(['Вижу свою победу.', 'Ты уже проиграл.']));
        else if (mood === 'sun') this.say(lab, 'Хм… я проиграл?');
        else if (was === '' || was === 'draw') this.say(lab, R.coin ? 'Монетке не прикажешь…' : 'Хм… не вижу конца.');
      }
      if (st.sure && was !== '' && lab.cfg.oracle) { lab.tone(196, 0.4, 'sine', 0.08, 147); lab.pulse(st.scaleGem, 1.6, 0.25); lab.ring(st.scaleGem, { color: v > 0 ? '#ffd23f' : v < 0 ? '#5fa8ff' : '#ffffff', radius: 1.2 }); }
    }
  },
  oracleText(lab) {
    const st = lab.state, duel = Math.round(lab.cfg.vs) === 1;
    if (!st.sure) return 'Весы: исход открыт';
    if (st.evalV === 0) return 'Весы: исход известен — ничья';
    return st.evalV > 0 ? 'Весы: солнца побеждают при точной игре' : duel ? 'Весы: луны побеждают при точной игре' : 'Весы: мудрец видит свою победу';
  },
  say(lab, text, force) {
    const st = lab.state;
    if (!force && lab.t - (st.saidAt || -9) < 1.2) return;
    st.saidAt = lab.t;
    lab.popup(st.head.getWorldPosition(lab.v3()).add(lab.v3(0, 1.3, 0)), text, '#e8f7ff', 18);
  },

  // ---------- оживление мира ----------
  animateWorld(lab, dt) {
    const st = lab.state, t = lab.t, duel = Math.round(lab.cfg.vs) === 1;
    const thinking = !duel && (st.phase === 'turn' && st.turn === 2 || st.phase === 'aim');
    // мудрец следит за курсором, качает головой, когда думает; кристалл посоха пульсирует
    const c = this.cellPos(st.cursor), look = st.phase === 'turn' && st.turn === 1 ? Math.atan2(c.x, c.z - st.sage.position.z) * 0.8 : 0;
    st.head.rotation.y = lab.damp(st.head.rotation.y, thinking ? Math.sin(t * 2.2) * 0.35 : look, 6, dt);
    st.head.rotation.x = thinking ? Math.sin(t * 5) * 0.1 : lab.damp(st.head.rotation.x, 0.12, 6, dt);
    st.tip.scale.setScalar(thinking ? 1 + Math.sin(t * 12) * 0.25 : 1);
    st.tip.rotation.y += dt * (thinking ? 6 : 1.5);
    st.body.scale.y = 1 + Math.sin(t * 1.6) * 0.012; // дышит
    // овцы пасутся
    st.sheep.forEach((s, i) => {
      s.a += Math.sin(t * 0.3 + i * 1.7) * dt * 0.3;
      const hop = Math.abs(Math.sin(t * 2 + i)) * 0.05;
      lab.place(st.wool, i, [s.x, hop, s.z], { rot: s.a });
      lab.place(st.dark, i, [s.x, hop, s.z], { rot: s.a });
    });
    // орлы кружат над плато, облака плывут, пыльца летит над лугом
    st.eagles.forEach((e, i) => {
      const a = t * e.sp + e.ph;
      e.g.position.set(e.cx + Math.cos(a) * e.r, e.y + Math.sin(t * 0.7 + i) * 0.6, e.cz + Math.sin(a) * e.r);
      e.g.rotation.y = -a + (e.sp > 0 ? 0 : Math.PI);
      const flap = Math.sin(t * 6 + i) * (Math.sin(t * 0.5 + i) > 0.3 ? 0.5 : 0.05);
      e.l.rotation.z = flap; e.r2.rotation.z = -flap;
    });
    st.clouds.position.x = ((t * 0.6 + 60) % 120) - 60;
    st.motes.forEach((m, i) => {
      m.y += dt * 0.25; m.x += Math.sin(t * 0.8 + i) * dt * 0.3;
      if (m.y > 4) { m.y = 0.2; m.x = lab.rand(-14, 14); m.z = lab.rand(-12, 8); }
      lab.place(st.mote, i, [m.x, m.y, m.z], { scale: 0.7 + 0.3 * Math.sin(t * 3 + i) });
    });
    // ветер: стрелка над доской дует и гонит по доске струи
    const w = st.R.rule === 2 && st.phase !== 'end' ? st.wind : null;
    st.windArrow.visible = !!w;
    if (w) {
      st.windArrow.rotation.y = Math.atan2(w.d[0], w.d[1]);
      const k = 0.4 * Math.sin(t * 4);
      st.windArrow.position.set(w.d[0] * k, this.TOP + 1.7, w.d[1] * k);
      if ((st.windT -= dt) <= 0) {
        st.windT = 0.09;
        const side = lab.rand(-4, 4), x = w.d[0] ? -w.d[0] * 4.5 : side, z = w.d[1] ? -w.d[1] * 4.5 : side;
        lab.burst([x, this.TOP + lab.rand(0.3, 1.2), z], { count: 2, color: '#f2fbff', speed: 2, dir: [w.d[0], 0, w.d[1]], gravity: 0, life: 1, size: 0.12 });
      }
    }
  },

  // ---------- маркеры: курсор, камень в руке, призрак под ветром, исчезающий камень, угрозы, прицел мудреца, крест бомбы ----------
  updateMarkers(lab, dt) {
    const st = lab.state, cfg = lab.cfg, T = this.TOP, t = lab.t, R = st.R, N = R.N;
    const my = st.phase === 'turn' && (st.turn === 1 || Math.round(cfg.vs) === 1);
    const opts = this.handOptions(lab, st.turn), h = opts[st.hand % Math.max(1, opts.length)];
    const mv = my ? this.cursorMove(lab) : null, bombing = h === 'bomb';
    const cell = R.drop && !bombing ? (this.landing(R, st.pos.b, st.cursor % N) >= 0 ? this.landing(R, st.pos.b, st.cursor % N) : st.cursor) : st.cursor;
    const c = this.cellPos(cell), busy = !mv;
    st.cursorMesh.visible = my;
    if (my) {
      st.cursorMesh.position.set(c.x, T + 0.06, c.z);
      st.cursorMesh.material = busy ? st.badMat : bombing ? st.bombMat : st.turn === 1 ? st.okMat : st.okMoonMat;
      st.cursorMesh.rotation.z += dt;
    }
    // столбец «Четыре в ряд»: светлая дорожка, по которой покатится камень
    st.column.visible = my && R.drop && !bombing;
    if (st.column.visible) st.column.position.x = this.cellPos(st.cursor % N).x;
    // камень в руке: висит над лункой курсора, туда и упадёт; размер — какой выбран
    [1, 2].forEach(s => {
      const g = st.hand3[s], on = my && st.turn === s && !busy && !bombing;
      g.visible = on;
      if (on) {
        const k = R.gob ? this.SC * this.GOB[h] : this.SC;
        g.scale.setScalar(k);
        g.position.set(lab.damp(g.position.x, c.x, 22, dt), T + 0.75 + Math.sin(t * 4) * 0.08 + (R.gob ? st.meshAt[cell].length * 0.22 * this.SC : 0), lab.damp(g.position.z, c.z, 22, dt));
        g.rotation.y += dt * 1.2;
      }
    });
    st.handBomb.visible = my && bombing;
    if (st.handBomb.visible) { st.handBomb.position.set(c.x, T + 1.1 + Math.sin(t * 5) * 0.1, c.z); st.handBomb.scale.setScalar(Math.max(0.6, this.SC)); }
    // крест бомбы: какие лунки снесёт
    let nb = 0;
    if (my && bombing) for (const i of this.plus(R, st.cursor)) { const p = this.cellPos(i); lab.place(st.cross, nb++, [p.x, T + 0.04, p.z], { scale: this.SC * (1 + 0.06 * Math.sin(t * 10)) }); }
    for (let i = nb; i < 5; i++) lab.place(st.cross, i, [0, -5, 0], { scale: 0.001 });
    // призрак: куда на самом деле ляжет камень при этом ветре
    let ghostAt = -1;
    if (my && st.wind && !busy && !bombing) { const r = this.step(R, st.pos, { c: st.cursor }, st.turn, st.wind); if (r.at !== st.cursor) ghostAt = r.at; }
    [1, 2].forEach(s => {
      const g = st.ghost[s], on = ghostAt >= 0 && st.turn === s;
      g.visible = on;
      if (on) { const p = this.cellPos(ghostAt); g.position.set(p.x, T + 0.3 + Math.sin(t * 6) * 0.08, p.z); g.rotation.y += dt * 2; }
    });
    // «видно = правда»: камень, который исчезнет при следующем ходе своей стороны, дрожит в красном круге
    const doomed = [];
    [1, 2].forEach(s => {
      const ring = st.doom[s], q = st.pos.q[s];
      const top = q.length && st.meshAt[q[0]] ? st.meshAt[q[0]][st.meshAt[q[0]].length - 1] : null;
      const on = R.rule === 1 && q.length >= R.keep && st.phase !== 'end' && top;
      ring.visible = !!on;
      if (on) { const p = this.cellPos(q[0]); ring.position.set(p.x, T + 0.07, p.z); ring.scale.setScalar(this.SC * (1 + 0.12 * Math.sin(t * 10))); doomed.push(top); }
    });
    st.stones.forEach(m => { m.rotation.z = doomed.includes(m) && st.phase !== 'anim' ? Math.sin(t * 22) * 0.07 : 0; });
    // угрозы «почти линия»: пустая лунка светится цветом того, кто соберёт там линию; в «Наоборот» — красным: туда нельзя
    let n = 0;
    if (cfg.threats && (st.phase === 'turn' || st.phase === 'aim')) {
      for (const s of [1, 2]) for (const i of this.threats(R, st.pos, s)) {
        if (n >= st.threatMax) break;
        const p = this.cellPos(i), k = this.SC * (1 + 0.08 * Math.sin(t * 6 + s));
        lab.place(st.threat, n++, [p.x, T + 0.03, p.z], { scale: k, color: R.mis ? '#ff4d5e' : s === 1 ? '#ffb400' : '#2f8cff' });
      }
    }
    for (let i = n; i < st.threatMax; i++) lab.place(st.threat, i, [0, -5, 0], { scale: 0.001 });
    // последний ход подсвечен, как в шахматах
    st.lastMark.visible = st.last >= 0 && st.phase !== 'end' && (st.pos.b[st.last] === 1 || st.pos.b[st.last] === 2);
    if (st.lastMark.visible) { const p = this.cellPos(st.last); st.lastMark.position.set(p.x, T + 0.025, p.z); st.lastMark.scale.setScalar(this.SC); st.lastMark.material = st.pos.b[st.last] === 1 ? st.lastSun : st.lastMoon; }
  },
  showAim(lab, mv) {
    const st = lab.state, p = this.cellPos(st.R.drop && !mv.bomb ? mv.c : mv.c);
    st.aim.visible = true; st.aim.position.set(p.x, this.TOP + 0.07, p.z);
    st.aim.material = mv.bomb ? st.bombMat : st.aimMat;
    st.beam.visible = true;
    lab.pulse(st.aim, 1.4, 0.2);
    lab.tone(mv.bomb ? 300 : 880, 0.08, 'sine', 0.05, mv.bomb ? 200 : 1320);
    if (mv.bomb) this.say(lab, 'Бомба!', true);
    this.updateBeam(lab);
  },
  updateBeam(lab) {
    const st = lab.state, from = st.tip.getWorldPosition(lab.v3()), to = st.aim.position.clone();
    to.y += 0.2;
    const dir = to.clone().sub(from), len = dir.length();
    st.beam.position.copy(from).addScaledVector(dir, 0.5);
    st.beam.scale.set(1, len, 1);
    st.beam.quaternion.setFromUnitVectors(lab.v3(0, 1, 0), dir.normalize());
    st.aim.rotation.z += 0.05;
  },
  hideAim(lab) { lab.state.aim.visible = false; lab.state.beam.visible = false; },
  updateScales(lab, dt) {
    const st = lab.state, on = !!lab.cfg.oracle;
    st.scales.visible = on;
    if (!on) return;
    st.scaleX = lab.damp(st.scaleX, st.scaleTo || 0, 5, dt);
    const wob = st.sure ? 0 : Math.sin(lab.t * 3.1) * 0.06 + Math.sin(lab.t * 7.3) * 0.03; // открытый исход колеблется
    st.scaleGem.position.x = -(st.scaleX + wob) * 3.0; // солнца слева, луны справа
    st.scaleGem.rotation.y += dt * (st.sure ? 0.6 : 3);
    const col = !st.sure ? st.gemOpen : st.evalV > 0 ? st.gemSun : st.evalV < 0 ? st.gemMoon : st.gemDraw;
    st.scaleGem.children[0].material = col;
    st.lock.visible = !!st.sure;
    st.lock.position.x = st.scaleGem.position.x;
    st.lock.rotation.z += dt;
  },
  // живая камера: еле заметно дышит, чуть тянется к курсору, на победной линии наезжает
  updateCamera(lab, dt) {
    const st = lab.state, v = lab.view, k = st.zoomK;
    if (Math.abs(v.distance - st.camLast) > 0.01) st.camBase = v.distance / (st.camK || 1); // окно поменялось — оболочка подобрала новое расстояние
    st.camK = lab.damp(st.camK || 1, st.posterK || 1, 1.6, dt); st.posterK = 1;
    v.distance = st.camBase * st.camK * (1 - 0.2 * k) * (1 + Math.sin(lab.t * 0.4) * 0.006);
    st.camLast = v.distance;
    const c = this.cellPos(st.cursor), my = st.phase === 'turn';
    const tx = st.camT.x + Math.sin(lab.t * 0.31) * 0.15 + (my ? c.x * 0.06 : 0), tz = st.camT.z + Math.sin(lab.t * 0.23) * 0.1 + (my ? c.z * 0.04 : 0);
    v.target.set(lab.damp(v.target.x, lab.lerp(tx, st.zoomAt.x, 0.55 * k), 3, dt), st.camT.y, lab.damp(v.target.z, lab.lerp(tz, st.zoomAt.z, 0.55 * k), 3, dt));
  },
  // афиша в меню: на плите партия в разгаре, мудрец целится посохом, камера ближе. Первый кадр партии всё убирает
  poster(lab) {
    const st = lab.state, R = st.R, N = R.N, mid = Math.floor(N / 2);
    const put = [[mid, mid, 1], [mid - 1, mid - 1, 2], [mid - 1, mid + 1, 1], [mid + 1, mid - 1, 2], [mid, mid + 1, 2], [mid + 1, mid + 1, 1]];
    st.posterStones = put.filter(([r, c]) => r >= 0 && c >= 0 && r < N && c < N).map(([r, c, s]) => {
      const p = this.cellPos(r * N + c), g = this.makeStone(lab, s, { sz: R.gob ? lab.randInt(0, 2) : null });
      g.position.set(p.x, this.TOP + this.restY(s, null), p.z); g.rotation.y = lab.rand(0, 6);
      return g;
    });
    this.showAim(lab, { c: (mid - 1) * N + mid });
    st.camK = 0.86; st.posterK = 0.86;
    lab.view.distance = st.camBase * 0.86; st.camLast = lab.view.distance;
  },
  cellPos(i) { const N = this.N, h = (N - 1) / 2; return { x: (i % N - h) * this.CELL, z: (Math.floor(i / N) - h) * this.CELL }; },
  plural(n, one, few, many) { const m = n % 10, h = n % 100; return m === 1 && h !== 11 ? one : m >= 2 && m <= 4 && (h < 12 || h > 14) ? few : many; },

  // ---------- камни: солнце (диск с лучами) и луна (кристалл), общие формы на всю партию ----------
  assets(lab) {
    const T3 = lab.THREE, U = lab.addons.BufferGeometryUtils, st = lab.state;
    const rays = [];
    for (let i = 0; i < 8; i++) {
      const a = i / 8 * Math.PI * 2, g = new T3.ConeGeometry(0.16, 0.38, 4);
      g.rotateZ(-Math.PI / 2); g.rotateY(-a); g.translate(Math.cos(a) * 0.78, 0, Math.sin(a) * 0.78);
      rays.push(g);
    }
    const moon = new T3.OctahedronGeometry(0.62); moon.scale(1, 1.25, 1);
    st.geo = { sun: new T3.CylinderGeometry(0.62, 0.62, 0.32, 12), rays: U.mergeGeometries(rays), face: new T3.CylinderGeometry(0.36, 0.36, 0.36, 12), moon };
    rays.forEach(g => g.dispose());
    st.mats = { sun: lab.mat('#ffc93c', { glow: 0.15 }), rays: lab.mat('#ff9f1c', { glow: 0.2 }), face: lab.mat('#fff0a8', { glow: 0.4 }), moon: lab.mat('#5fa8ff', { glow: 0.45, shiny: true }) };
  },
  makeStone(lab, side, o = {}) {
    const st = lab.state, g = lab.group(o.parent === null ? { parent: null } : {});
    if (side === 1) {
      lab.mesh(st.geo.sun, o.ghost || st.mats.sun, { parent: g });
      lab.mesh(st.geo.rays, o.ghost || st.mats.rays, { parent: g });
      if (!o.ghost) lab.mesh(st.geo.face, st.mats.face, { parent: g });
    } else lab.mesh(st.geo.moon, o.ghost || st.mats.moon, { parent: g });
    if (o.ghost) lab.noShadow(g);
    const s = o.sz != null ? this.SC * this.GOB[o.sz] : this.SC;
    g.scale.setScalar(s); g.userData.s = s;
    return g;
  },
  makeBomb(lab) {
    const g = lab.group(), s = Math.max(0.7, this.SC);
    lab.ball(0.45, '#2b2d36', { parent: g, detail: 1, shiny: true });
    lab.cyl(0.12, 0.14, 0.18, '#7a7d88', { parent: g, at: [0, 0.48, 0], sides: 6 });
    g.userData.fuse = lab.mesh(new lab.THREE.OctahedronGeometry(0.1), '#ffd23f', { parent: g, at: [0, 0.64, 0], glow: 1.5, shadow: false });
    g.scale.setScalar(s); g.userData.s = s;
    return g;
  },

  // ---------- стол-плита, лунки, корзины с запасом ----------
  buildTable(lab) {
    const T3 = lab.THREE, st = lab.state, T = this.TOP, N = this.N, H = this.HALF, S = H * 2, CELL = this.CELL, SC = this.SC;
    // ближний край плиты шире: на нём стоят весы исхода, лунки остаются открытыми
    const parts = [lab.box(S, 0.5, S + 1.1, '#9a9ca4', { at: [0, T - 0.25, 0.55] }), lab.box(S + 0.3, 0.12, S + 1.4, '#7f8189', { at: [0, T - 0.52, 0.55] })];
    const leg = H - 1.4;
    for (const x of [-leg, leg]) for (const z of [-leg, leg + 1.1]) parts.push(lab.box(1.3, T - 0.5, 1.3, '#7f8189', { at: [x, (T - 0.5) / 2, z] }));
    lab.merge(parts);
    // лунки: тёмный край и светлое дно
    const hole = lab.instances(new T3.CylinderGeometry(0.98 * SC, 0.98 * SC, 0.04, 18), '#6e717a', N * N, { shadow: false });
    const bed = lab.instances(new T3.CylinderGeometry(0.8 * SC, 0.8 * SC, 0.05, 18), '#858892', N * N, { shadow: false });
    for (let i = 0; i < N * N; i++) { const p = this.cellPos(i); lab.place(hole, i, [p.x, T + 0.01, p.z]); lab.place(bed, i, [p.x, T + 0.015, p.z]); }
    // золотая резьба между лунками и орнамент по краю — копии
    const L = N * CELL + 0.1 * CELL, groove = lab.instances(new T3.BoxGeometry(L, 0.05, 0.12 * Math.max(0.6, SC)), '#d9ad4a', 2 * (N - 1), { glow: 0.25, shadow: false });
    for (let k = 1; k < N; k++) {
      const o = (k - N / 2) * CELL;
      lab.place(groove, (k - 1) * 2, [0, T + 0.02, o]);
      lab.place(groove, (k - 1) * 2 + 1, [o, T + 0.02, 0], { rot: Math.PI / 2 });
    }
    const sides = [], E = H - 0.25;
    for (let k = -E + 0.6; k <= E + 0.5; k += 0.8) sides.push([-E, k, -Math.PI / 2], [E, k, Math.PI / 2]);
    for (let k = -E + 0.6; k <= E - 0.59; k += 0.8) sides.push([k, -E, Math.PI]);
    for (let k = -E + 0.6; k <= E - 0.59; k += 0.8) if (Math.abs(k) > 3.6) sides.push([k, E + 1.1, 0]); // ближний край — под весами исхода
    const tri = lab.instances(new T3.CylinderGeometry(0.2, 0.2, 0.06, 3), '#d9ad4a', sides.length, { glow: 0.3, shadow: false });
    sides.forEach(([x, z, a], i) => lab.place(tri, i, [x, T + 0.02, z], { rot: a }));
    // плетёные корзины с запасом камней у каждой стороны стола
    const basket = lab.instances(new T3.CylinderGeometry(0.75, 0.55, 0.6, 10), '#a8743f', 2);
    const band = lab.instances(new T3.CylinderGeometry(0.77, 0.7, 0.1, 10), '#7a5232', 2);
    const res = { sun: lab.instances(st.geo.sun, st.mats.sun, 3), rays: lab.instances(st.geo.rays, st.mats.rays, 3), face: lab.instances(st.geo.face, st.mats.face, 3), moon: lab.instances(st.geo.moon, st.mats.moon, 3) };
    [[-(H + 1.2), H - 1, 1], [H + 1.2, -(H - 1), 2]].forEach(([x, z, side], b) => {
      lab.place(basket, b, [x, 0.3, z]); lab.place(band, b, [x, 0.45, z]);
      for (let i = 0; i < 3; i++) {
        const at = [x + Math.cos(i * 2.1) * 0.3, 0.72 + i * 0.07, z + Math.sin(i * 2.1) * 0.3], o = { scale: 0.5, rot: [0.3, i, 0.2] };
        if (side === 1) { lab.place(res.sun, i, at, o); lab.place(res.rays, i, at, o); lab.place(res.face, i, at, o); }
        else lab.place(res.moon, i, at, o);
      }
    });
    // валуны завалов: одна пачка копий, стоят в своих лунках
    st.rock = lab.instances(new T3.DodecahedronGeometry(0.75 * SC, 0), '#8d7f6f', Math.max(1, st.R.rocks));
    for (let i = 0; i < Math.max(1, st.R.rocks); i++) lab.place(st.rock, i, [0, -5, 0], { scale: 0.001 });
  },
  showRocks(lab, cells) {
    const st = lab.state, T = this.TOP;
    st.rockAt = {}; st.rockPos = [];
    for (let i = 0; i < Math.max(1, st.R.rocks); i++) lab.place(st.rock, i, [0, -5, 0], { scale: 0.001 });
    cells.forEach((c, i) => {
      st.rockAt[c] = i; const p = this.cellPos(c), rot = [lab.rand(0, 3), lab.rand(0, 3), 0];
      st.rockPos[i] = { c, rot };
      lab.after(0.1 + i * 0.08, () => lab.tween(0.3, k => lab.place(st.rock, i, [p.x, T + 0.4 * this.SC + (1 - k) * 3, p.z], { scale: [1, 0.75, 1], rot }), 'outBounce'));
      lab.after(0.4 + i * 0.08, () => { lab.ring([p.x, T, p.z], { color: '#c9b79c', radius: this.CELL * 0.6 }); lab.noise(0.08, 0.05, 700); });
    });
  },
  moveRock(lab, from, to) {
    const st = lab.state, i = st.rockAt[from], p = this.cellPos(to);
    delete st.rockAt[from]; st.rockAt[to] = i; st.rockPos[i].c = to;
    lab.tween(0.3, () => lab.place(st.rock, i, [p.x, this.TOP + 0.4 * this.SC, p.z], { scale: [1, 0.75, 1], rot: st.rockPos[i].rot }));
  },
  blowRock(lab, c) {
    const st = lab.state, i = st.rockAt[c], p = this.cellPos(c);
    delete st.rockAt[c];
    lab.place(st.rock, i, [0, -5, 0], { scale: 0.001 });
    lab.burst([p.x, this.TOP + 0.4, p.z], { count: 20, colors: ['#8d7f6f', '#c9b79c'], speed: 6, up: 3 });
  },

  // ---------- мудрец в черкеске и папахе: лицом к игроку (+Z) ----------
  buildSage(lab) {
    const T3 = lab.THREE, st = lab.state;
    const sage = lab.group({ at: [0, 0, -(this.HALF + 1.9)], scale: 1.3 });
    // неподвижные части сливаются в один меш на цвет: сначала строим в начале координат, потом ставим на место
    const bake = (build, parent, at) => {
      const tmp = lab.group(); build(tmp);
      const out = lab.merge([tmp]); parent.add(out); if (at) out.position.set(at[0], at[1], at[2]);
      return out;
    };
    lab.box(1.8, 0.7, 1.3, '#8a8c94', { at: [0, 0.35, 0], parent: sage });
    st.body = bake(g => {
      lab.cyl(0.375, 0.675, 1.6, '#7a2a3a', { parent: g, at: [0, 0.8, 0], sides: 8 });
      lab.cyl(0.54, 0.54, 0.14, '#d9ad4a', { parent: g, at: [0, 0.45, 0], sides: 8, glow: 0.2 });
      for (const x of [-0.22, 0.22]) lab.box(0.22, 0.3, 0.1, '#efe2c4', { parent: g, at: [x, 1.15, 0.46] });
      lab.box(0.7, 0.2, 0.2, '#7a2a3a', { parent: g, at: [0.62, 1.1, 0.22], rot: [0, 0, -0.3] });
      lab.cyl(0.05, 0.05, 3.0, '#7a5232', { parent: g, at: [1.0, 0.8, 0.25], sides: 6 });
    }, sage, [0, 0.7, 0]);
    st.head = lab.group({ parent: sage, at: [0, 2.45, 0] });
    bake(g => {
      lab.ball(0.31, '#e9c29b', { parent: g, detail: 1 });
      lab.cyl(0.37, 0.37, 0.46, '#f1ede4', { parent: g, at: [0, 0.38, 0], sides: 9 });
      lab.cyl(0.26, 0.025, 0.7, '#f7f7f7', { parent: g, at: [0, -0.36, 0.2], sides: 6 });
      for (const x of [-0.12, 0.12]) lab.box(0.07, 0.07, 0.07, '#1c1f27', { parent: g, at: [x, 0.05, 0.29] });
      for (const x of [-0.12, 0.12]) lab.box(0.14, 0.04, 0.05, '#f7f7f7', { parent: g, at: [x, 0.14, 0.29] });
    }, st.head);
    st.tip = lab.mesh(new T3.OctahedronGeometry(0.2), '#8fe3ff', { parent: sage, at: [1.0, 3.1, 0.25], glow: 1, shadow: false });
    st.sage = sage;
  },

  buildMarkers(lab) {
    const T3 = lab.THREE, st = lab.state, flat = [Math.PI / 2, 0, 0], N = this.N;
    st.okMat = lab.mat('#fff4c2', { unlit: true, glow: 0.3 }); st.okMoonMat = lab.mat('#c8ecff', { unlit: true, glow: 0.3 });
    st.badMat = lab.mat('#8a909c', { unlit: true }); // занятая лунка: серый курсор, красный — только у камня, который исчезнет
    st.bombMat = lab.mat('#ff6a2a', { unlit: true, glow: 0.8 }); st.aimMat = lab.mat('#8fe3ff', { unlit: true, glow: 0.8 });
    st.cursorMesh = lab.mesh(new T3.TorusGeometry(0.98 * this.SC, 0.07 * Math.max(0.6, this.SC), 6, 28), st.okMat, { rot: flat, shadow: false });
    st.hand3 = [null, this.makeStone(lab, 1), this.makeStone(lab, 2)];
    st.hand3.forEach(h => { if (h) h.visible = false; });
    st.handBomb = this.makeBomb(lab); st.handBomb.visible = false;
    const gs = lab.mat('#ffd23f', { unlit: true, alpha: 0.4 }), gm = lab.mat('#5fa8ff', { unlit: true, alpha: 0.4 });
    st.ghost = [null, this.makeStone(lab, 1, { ghost: gs }), this.makeStone(lab, 2, { ghost: gm })];
    st.ghost.forEach(g => { if (g) g.visible = false; });
    st.doom = [null, 1, 2].map(s => s && lab.mesh(new T3.TorusGeometry(0.82, 0.09, 6, 24), lab.mat('#ff4d5e', { unlit: true, glow: 0.5 }), { rot: flat, shadow: false }));
    st.doom.forEach(r => { if (r) r.visible = false; });
    const ringGeo = new T3.RingGeometry(0.5, 0.9, 24); ringGeo.rotateX(-Math.PI / 2);
    st.threatMax = Math.min(24, N * N);
    st.threat = lab.instances(ringGeo, lab.mat('#ffffff', { unlit: true, add: true }), st.threatMax, { shadow: false });
    const crossGeo = new T3.RingGeometry(0.2, 0.95, 4); crossGeo.rotateX(-Math.PI / 2); crossGeo.rotateY(Math.PI / 4);
    st.cross = lab.instances(crossGeo, lab.mat('#ff6a2a', { unlit: true, alpha: 0.55 }), 5, { shadow: false });
    const lastGeo = new T3.RingGeometry(0.86, 0.96, 28); lastGeo.rotateX(-Math.PI / 2);
    st.lastSun = lab.mat('#ffd23f', { unlit: true, alpha: 0.55 }); st.lastMoon = lab.mat('#5fa8ff', { unlit: true, alpha: 0.55 });
    st.lastMark = lab.mesh(lastGeo, st.lastSun, { shadow: false }); st.lastMark.visible = false;
    st.aim = lab.mesh(new T3.TorusGeometry(0.98 * this.SC, 0.07 * Math.max(0.6, this.SC), 6, 28), st.aimMat, { rot: flat, shadow: false });
    st.beam = lab.mesh(new T3.CylinderGeometry(0.05, 0.05, 1, 6), lab.mat('#8fe3ff', { unlit: true, add: true }), { shadow: false });
    st.aim.visible = st.beam.visible = false;
    st.sunLine = lab.mat('#ffd23f', { glow: 1.2 }); st.moonLine = lab.mat('#5fa8ff', { glow: 1.2 });
    st.line = lab.box(1, 0.18, 0.32, st.sunLine, { shadow: false }); st.line.visible = false;
    // дорожка столбца «Четыре в ряд»
    st.column = lab.box(this.CELL * 0.9, 0.02, N * this.CELL, lab.mat('#fff4c2', { unlit: true, alpha: 0.18 }), { at: [0, this.TOP + 0.03, 0], shadow: false });
    st.column.visible = false;
    // монетка: золотая сторона — солнца, синяя — луны
    st.coin = lab.group();
    lab.cyl(0.7, 0.7, 0.06, '#ffc93c', { parent: st.coin, at: [0, 0.035, 0], sides: 16, glow: 0.4, shadow: false });
    lab.cyl(0.7, 0.7, 0.06, '#5fa8ff', { parent: st.coin, at: [0, -0.035, 0], sides: 16, glow: 0.4, shadow: false });
    st.coin.visible = false;
    // стрелка ветра над доской: смотрит по своей +Z
    st.windArrow = lab.group({ scale: 1.3 });
    const wm = lab.mat('#e8f7ff', { glow: 0.6 });
    lab.cyl(0.11, 0.11, 1.6, wm, { parent: st.windArrow, rot: [Math.PI / 2, 0, 0], sides: 6, shadow: false });
    lab.cone(0.35, 0.7, wm, { parent: st.windArrow, at: [0, 0, 1.1], rot: [Math.PI / 2, 0, 0], sides: 6, shadow: false });
    st.windArrow.visible = false;
  },
  // весы исхода у ближнего края доски: золото — солнца, синева — луны, середина — ничья
  buildScales(lab) {
    const T3 = lab.THREE, st = lab.state, y = this.TOP + 0.05, z = this.HALF + 0.35;
    st.scales = lab.group({ at: [0, y, z] });
    lab.box(6.8, 0.1, 0.3, '#5d6068', { parent: st.scales });
    lab.box(3.2, 0.06, 0.18, '#ffc93c', { parent: st.scales, at: [-1.65, 0.07, 0], glow: 0.35, shadow: false });
    lab.box(3.2, 0.06, 0.18, '#5fa8ff', { parent: st.scales, at: [1.65, 0.07, 0], glow: 0.35, shadow: false });
    lab.box(0.12, 0.16, 0.36, '#ffffff', { parent: st.scales, at: [0, 0.08, 0], glow: 0.3, shadow: false });
    st.gemOpen = lab.mat('#e6f0ff', { glow: 0.5, shiny: true }); st.gemSun = lab.mat('#ffd23f', { glow: 1 }); st.gemMoon = lab.mat('#5fa8ff', { glow: 1 }); st.gemDraw = lab.mat('#ffffff', { glow: 1 });
    st.scaleGem = lab.group({ parent: st.scales, at: [0, 0.38, 0] });
    lab.mesh(new T3.OctahedronGeometry(0.24), st.gemOpen, { parent: st.scaleGem });
    st.lock = lab.mesh(new T3.TorusGeometry(0.36, 0.045, 6, 20), lab.mat('#ffffff', { unlit: true, glow: 0.6 }), { parent: st.scales, at: [0, 0.38, 0], shadow: false });
    st.lock.visible = false;
    st.scaleTo = 0;
  },
  // живое плато: орлы кружат, облака плывут, пыльца поднимается над лугом
  buildLife(lab) {
    const T3 = lab.THREE, st = lab.state;
    st.eagles = [[-4, -17, 8.5, 9, 0.22], [7, -20, 10, 8, -0.16]].map(([cx, cz, y, r, sp], i) => {
      const g = lab.group();
      lab.box(0.3, 0.22, 0.9, '#4a3526', { parent: g });
      lab.box(0.22, 0.2, 0.25, '#f2efe6', { parent: g, at: [0, 0.05, 0.5] });
      const l = lab.group({ parent: g, at: [-0.15, 0.05, 0] }), r2 = lab.group({ parent: g, at: [0.15, 0.05, 0] });
      lab.box(1.3, 0.05, 0.45, '#3a2a20', { parent: l, at: [-0.65, 0, 0] });
      lab.box(1.3, 0.05, 0.45, '#3a2a20', { parent: r2, at: [0.65, 0, 0] });
      lab.noShadow(g);
      return { g, l, r2, cx, cz, y, r, sp, ph: i * 2 };
    });
    const puffs = [];
    [[-30, 16, -50, 5], [-5, 19, -60, 7], [22, 15, -46, 5], [45, 18, -58, 6], [-52, 17, -40, 4]].forEach(([x, y, z, s]) => {
      for (let k = 0; k < 3; k++) puffs.push(lab.ball(s * (0.6 + k * 0.2), '#fff7ee', { at: [x + k * s * 0.9, y + (k === 1 ? s * 0.3 : 0), z], detail: 0, shadow: false }));
    });
    st.clouds = lab.group();
    lab.merge(puffs, st.clouds);
    st.motes = Array.from({ length: 30 }, () => ({ x: lab.rand(-14, 14), y: lab.rand(0.2, 4), z: lab.rand(-12, 8) }));
    st.mote = lab.instances(new T3.OctahedronGeometry(0.05), lab.mat('#fff3b0', { unlit: true, glow: 0.8 }), st.motes.length, { shadow: false });
  },

  // ---------- плато Лаго-Наки: горы, пихты, валуны, цветы, овцы, дольмен ----------
  scenery(lab, scene) {
    const T3 = lab.THREE, st = lab.state, H = this.HALF;
    lab.ground({ w: 240, h: 240, color: '#5c9646', bumps: 2, flat: 0.7 });
    lab.box(H * 2 + 9, 0.04, H * 2 + 9, '#6aa850', { at: [0, 0.02, -1], shadow: false }); // луг вокруг стола
    // горы вдали со снежными шапками — один меш на цвет
    const hills = [];
    [[-40, -70, 30, 15], [-12, -78, 40, 19], [18, -72, 30, 14], [44, -64, 22, 11], [4, -58, 16, 8], [-60, -50, 20, 10], [62, -48, 18, 9]].forEach(([x, z, h, r]) => {
      const a = lab.rand(0, 1);
      hills.push(lab.cone(r, h, '#7d8aa6', { at: [x, h / 2 - 0.5, z], sides: 6, rot: a }));
      hills.push(lab.cone(r * 0.36, h * 0.34, '#f4f8ff', { at: [x, h * 0.83 - 0.5, z], sides: 6, rot: a }));
    });
    lab.merge(hills);
    // пихты — копии: стволы и кроны разных оттенков
    const N = 46, trunk = lab.instances(new T3.CylinderGeometry(0.15, 0.2, 0.7, 5), '#5a3d2b', N), crown = lab.instances(new T3.ConeGeometry(0.5, 1, 6), '#ffffff', N * 2);
    let n = 0;
    for (let i = 0; i < 400 && n < N; i++) {
      const a = lab.rand(0, Math.PI * 2), d = lab.rand(13, 34), x = Math.cos(a) * d, z = -Math.abs(Math.sin(a)) * d * 0.9 + lab.rand(-6, 6);
      if (Math.abs(x) < 15 && z > -24) continue;
      const h = lab.rand(2, 4.2), col = lab.pick(['#1f5a3a', '#25683f', '#2f7a46']);
      lab.place(trunk, n, [x, 0.35, z]);
      lab.place(crown, n * 2, [x, 0.7 + h * 0.45, z], { scale: [h * 0.75, h * 0.9, h * 0.75], rot: lab.rand(0, 3), color: col });
      lab.place(crown, n * 2 + 1, [x, 0.7 + h * 0.95, z], { scale: [h * 0.5, h * 0.6, h * 0.5], rot: lab.rand(0, 3), color: col });
      n++;
    }
    const boulder = lab.instances(new T3.DodecahedronGeometry(0.6, 0), '#a3a6ae', 16);
    for (let i = 0; i < 16; i++) {
      const s = lab.rand(0.5, 1.6);
      lab.place(boulder, i, [lab.pick([-1, 1]) * lab.rand(H + 4, 16), s * 0.2, lab.rand(-12, 8)], { scale: [s, s * 0.6, s], rot: lab.rand(0, 3) });
    }
    // цветы и кочки травы на лугу
    const flower = lab.instances(new T3.CylinderGeometry(0.12, 0.12, 0.1, 5), '#ffffff', 70, { shadow: false });
    const tuft = lab.instances(new T3.ConeGeometry(0.18, 0.45, 4), '#4f8a3c', 60, { shadow: false });
    let f = 0, tf = 0;
    for (let i = 0; i < 300 && (f < 70 || tf < 60); i++) {
      const x = lab.rand(-15, 15), z = lab.rand(-12, 9);
      if (Math.abs(x) < H + 2 && Math.abs(z) < H + 2) continue;
      if (f < 70 && i % 2) lab.place(flower, f++, [x, 0.07, z], { color: lab.pick(['#ffffff', '#ff7eb6', '#ffe14d', '#b48cff']) });
      else if (tf < 60) lab.place(tuft, tf++, [x, 0.2, z], { rot: lab.rand(0, 3), scale: lab.rand(0.7, 1.4), color: lab.pick(['#4f8a3c', '#5e9c45', '#3f7a34']) });
    }
    // овцы: шерсть и тёмные голова с ногами — две пачки копий
    const U = lab.addons.BufferGeometryUtils, wool = new T3.IcosahedronGeometry(0.5, 1);
    wool.scale(1.1, 0.75, 0.8); wool.translate(0, 0.7, 0);
    const bits = [new T3.BoxGeometry(0.32, 0.36, 0.42).rotateY(Math.PI / 2).translate(0.62, 0.82, 0)];
    for (const x of [-0.3, 0.3]) for (const z of [-0.2, 0.2]) bits.push(new T3.BoxGeometry(0.1, 0.42, 0.1).translate(x, 0.21, z));
    const dark = U.mergeGeometries(bits); bits.forEach(b => b.dispose());
    const sx = Math.max(0, H - 4.4);
    st.sheep = [[-9, -3], [-10.5, -4.5], [-8, -6], [9.5, 2], [11, 0], [8.5, -8], [-12, 4]].map(([x, z]) => ({ x: x + Math.sign(x) * sx, z, a: lab.rand(0, 6.28) }));
    st.wool = lab.instances(wool, '#f7f4ec', st.sheep.length);
    st.dark = lab.instances(dark, '#2b2b30', st.sheep.length);
    // дольмен за спиной мудреца
    const dz = -(H + 6.6), dp = [], slab = (w, h, d, x, y, z) => dp.push(lab.box(w, h, d, '#878a92', { at: [x, y, z + dz + 11] }));
    slab(0.45, 2.6, 3.2, -1.8, 1.3, -11); slab(0.45, 2.6, 3.2, 1.8, 1.3, -11); slab(4.0, 2.6, 0.45, 0, 1.3, -12.6);
    slab(4.0, 2.6, 0.45, 0, 1.3, -9.4); slab(4.8, 0.5, 4.2, 0, 2.85, -11);
    dp.push(lab.cyl(0.45, 0.45, 0.1, '#25262c', { at: [0, 1.1, -9.15 + dz + 11], rot: [Math.PI / 2, 0, 0], sides: 12 }));
    lab.merge(dp);
  },
};
