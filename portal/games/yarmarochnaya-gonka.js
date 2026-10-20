// «Ярмарочная гонка» — ремейк-донор урока 11 по мотивам механики Mario Kart, оболочка «Лаб3D 1.0» (three.js).
// Подпись урока: петли обратной связи — что делает гонку интересной до самого финиша.
// Лучшие игры жанра, из которых взяты моменты (разбор — docs/журнал/модуль-3.md, раздел урока 11):
//   Super Mario Kart (1992) и Mario Kart 64 — коробки-гостинцы, предмет по месту, резинка ботов, синий панцирь к лидеру;
//   Mario Kart 8 — монеты: до 10 штук, каждая чуть прибавляет скорость, удар — теряешь монеты (снежный ком);
//   Mario Kart DS и Crash Team Racing — занос с мини-турбо: держи занос в повороте, отпусти — рывок;
//   Micro Machines и Super Off Road — вид сверху, вся трасса в одном кадре, гонка на одном экране вдвоём;
//   F-Zero и Diddy Kong Racing — срезка: быстрее, если попал, и медленнее всех, если промахнулся;
//   Mario Kart Wii и 8 — зеркальный режим: та же трасса задом наперёд.
// Автопрогон (ручка sim): 20 заездов ботов без игрока в быстром времени и столбики разрыва на финише — как дизайнеры проверяют
// петли тысячами симуляций. Сравни «Снежный ком» и «Помощь отстающему».
// Ось Z смотрит на игрока: нижняя прямая со стартом — ближе к нам (+Z), трасса ведёт против часовой стрелки на экране.
/* ПЛАН
   Фраза игры: ты — юный возчик с тележкой адыгейского сыра, ты мчишься по кругу осенней ярмарки в ауле между лотками,
   каруселью и прудом, но пять соседей хотят приехать первыми, а на трассе — коробки-гостинцы. Цель — три круга и первое место.
   Ядро на 3 секунды: стрелка → тележка поворачивает туда → вписался в поворот, взял коробку, обогнал соседа — очки и место выше.
   Выбор, оплаченный очками: ехать по внутренней (короче) или к коробке и монетам у края; сразу бросить тыкву или держать
   гостинец до прямой; держать корку за спиной от догоняющего; срезка через ручей — быстрее, но промах в грязь.
   Угрозы: арбузная корка на дороге (лежит, видно), тыква-ядро от соседа сзади (летит по трассе, видно хвост),
   пчелиный рой к лидеру (летит по воздуху, путь точками и красный круг под целью), борта из тюков сена (тормозят).
   Кривая партии: 0–2,4 с — огни старта; 2,4–9 с — разгон, коробки только после первого поворота, гостинцы не бьют до 9-й секунды;
   9–20 с — первые корки и тыквы; второй круг — монеты и обгоны; последний круг — фанфары, наезд камеры, рой к лидеру.
   События: огни старта, «Марш!», коробка с рулеткой, обгон (+очки, серия), удар гостинцем, рой летит к лидеру,
   новый лидер, монета, мини-турбо, «Последний круг!», финиш с конфетти, «Финиш закроется через …».
   Лицо игры: осенняя ярмарка в ауле как игрушечная диорама — охристая дорога, красно-белые бордюры, золотые тюки сена,
   рыжие деревья, полосатые лотки и карусель; яркие тележки и номера мест над каждой.
   Палитра: дорога #d29a5c, трава #5a963c, бордюр #e2433b/#fff4e6, сено #e3b04b, листва #e8892b, герой #ff2e88, второй #2ee6ff,
   награда #ffd23f, опасность #ff6a1f, рой #ffe14d.
   Свет: тёплое низкое солнце, холодное голубое небо в заполняющем, тени длинные.
   Три фирменных приёма: номер места над каждой тележкой (видно, кто лидер, с одного взгляда);
   пчелиный рой летит над ярмаркой к лидеру по пунктиру; красно-белые бордюры и тюки сена — гоночная трасса из ярмарки.
*/
const GAME = {
  engine: 'three',
  title: 'Ярмарочная гонка',
  subtitle: 'Тележки с адыгейским сыром мчатся по кругу осенней ярмарки. Три круга, коробки-гостинцы — приедь первым.',
  donor: 'Mario Kart',
  players: 1,
  duo: 'vs', // ручка vs = 1 — гонка на двоих на одной трассе с ботами
  controls: [
    { input: 'move4', text: 'куда ехать (газ сам)' },
    { input: 'a', text: 'гостинец' },
    { input: 'b', text: 'тормоз и занос' },
  ],
  camera: { type: 'iso', tilt: 0.72, target: [0, 0, 0.5] },
  field: { w: 58, h: 38 },
  shadowSize: 36,
  sky: ['#4f9be0', '#ffe0ae'],
  fog: 0.006,
  accent: '#ffd23f',
  scoreColor: '#ffd23f',
  lives: 0,
  decisions: [
    'Чувство: гонка решается до последнего поворота — отстающий получает сильный гостинец и может догнать',
    'Честность: на коробке знак «?», корка лежит на виду, у тыквы огненный хвост, путь роя к лидеру — пунктиром и красным кругом',
    'Выбор: по короткой внутренней или к коробкам и монетам у края; бросить гостинец сразу или ждать прямую',
  ],
  notes: [
    'Газ сам, стрелки показывают, куда ехать по экрану: так проще тем, кто ещё не водил машинку в игре.',
    'Финиш закрывается через 10 с после победителя, как в Mario Kart: оставшиеся места решает, кто сколько проехал.',
    'Гостинцы не бьют никого до 9-й секунды: первые секунды — честный разгон.',
  ],
  config: {
    secret: { value: 1, min: 0, max: 1, step: 1, label: 'Спрятанная механика: гостинец зависит от места', hint: '1 — лидеру слабые, последним сильные; 0 — всем одинаково случайные' },
    snowball: { value: 1, min: 0, max: 2, step: 0.5, label: 'Снежный ком: монеты дают скорость', hint: 'положительная петля: до 10 монет, каждая прибавляет скорость, удар — теряешь монеты; 0 — монет нет' },
    rubber: { value: 1, min: 0, max: 2, step: 0.5, label: 'Помощь отстающему: резинка ботов', hint: 'отрицательная петля: отстающие боты быстрее, лидер чуть медленнее, гостинцы по месту сильнее; 0 — без резинки' },
    laps: { value: 3, min: 1, max: 5, step: 1, label: 'Кругов', restart: true },
    bots: { value: 5, min: 1, max: 7, step: 1, label: 'Соседей-ботов', restart: true },
    botSkill: { value: 1, min: 0, max: 2, step: 0.1, label: 'Мастерство ботов' },
    speed: { value: 9, min: 5, max: 16, step: 0.5, label: 'Скорость тележки, м/с' },
    assist: { value: 0.7, min: 0, max: 1, step: 0.1, label: 'Умный руль', hint: 'как Smart Steering в Mario Kart 8 Deluxe: стрелка «примерно вперёд» ведёт вдоль трассы и от бортов; 0 — руль как есть' },
    turn: { value: 3.4, min: 1.5, max: 6, step: 0.1, label: 'Руль: поворот, рад/с' },
    items: { value: 1, min: 0, max: 1, step: 1, label: 'Коробки-гостинцы', restart: true },
    finishWait: { value: 10, min: 3, max: 30, step: 1, label: 'Финиш закрывается через … с после победителя' },
    vs: { value: 0, min: 0, max: 1, step: 1, label: 'Вдвоём: две тележки и боты', restart: true },
    sim: { value: 0, min: 0, max: 1, step: 1, label: 'Автопрогон: заезды ботов без игрока', hint: 'как проверяют петли дизайнеры: 20 быстрых заездов и столбики разрыва на финише', restart: true },
    simRaces: { value: 20, min: 5, max: 40, step: 5, label: 'Автопрогон: заездов', restart: true },
    // вариации жанра: 0 — как в классике
    bees: { value: 0, min: 0, max: 1, step: 1, label: 'Вариация «Рой к лидеру»: улей шлёт рой в лидера', hint: 'как синий панцирь Mario Kart: каждые 15 с рой вылетает из улья и летит в того, кто первый' },
    drift: { value: 0, min: 0, max: 1, step: 1, label: 'Вариация «Турбо за занос»', hint: 'как мини-турбо Mario Kart DS и Crash Team Racing: держи B в повороте, искры синие → оранжевые, отпусти — рывок' },
    shortcut: { value: 0, min: 0, max: 1, step: 1, label: 'Вариация «Срезка» через ручей', hint: 'как в F-Zero и Diddy Kong Racing: мостик короче петли у пруда, но мимо мостика — грязь', restart: true },
    mirror: { value: 0, min: 0, max: 1, step: 1, label: 'Вариация «Зеркало»: трасса задом наперёд', hint: 'как Mirror mode в Mario Kart', restart: true },
  },
  presets: {
    'Новичок': { speed: 8, turn: 4.2, botSkill: 0.4, laps: 2, assist: 1 },
    'Без спрятанной механики': { secret: 0 },
    // петли и вариации: те же значения — в сценарии урока 11, держать вместе
    'Вдвоём': { vs: 1 },
    'Снежный ком': { snowball: 2, rubber: 0 },
    'Помощь отстающему': { rubber: 2, snowball: 0 },
    'Без петель': { secret: 0, snowball: 0, rubber: 0 },
    'Автопрогон': { sim: 1 },
    'Без предметов': { items: 0 },
    'Рой к лидеру': { bees: 1 },
    'Турбо за занос': { drift: 1 },
    'Срезка': { shortcut: 1 },
    'Зеркало': { mirror: 1 },
  },
  // имя вариации и её правило: строка HUD и экран конца партии
  VARIANTS: [
    { on: c => c.sim >= 1, name: 'Автопрогон', like: 'симуляции дизайнеров', how: c => `${Math.round(c.simRaces)} заездов ботов без игрока — смотри разрыв на финише` },
    { on: c => c.vs >= 1 && c.sim < 1, name: 'Вдвоём', like: 'гонка на одном экране Micro Machines', how: () => 'две тележки и боты на одной трассе' },
    { on: c => c.snowball >= 2 && c.rubber <= 0, name: 'Снежный ком', like: 'монеты Mario Kart 8', how: () => 'монеты разгоняют, а резинки нет: кто впереди, тот богатеет' },
    { on: c => c.rubber >= 2 && c.snowball <= 0, name: 'Помощь отстающему', like: 'резинка ботов Mario Kart 64', how: () => 'отстающие быстрее, гостинцы по месту сильнее' },
    { on: c => c.secret <= 0 && c.snowball <= 0 && c.rubber <= 0, name: 'Без петель', like: 'гонка на время', how: () => 'ни монет, ни резинки, гостинцы всем одинаковые' },
    { on: c => c.items <= 0, name: 'Без предметов', like: 'Time Trial и Gran Turismo', how: () => 'только руль и трасса' },
    { on: c => c.bees >= 1, name: 'Рой к лидеру', like: 'синий панцирь Mario Kart', how: () => 'каждые 15 с улей шлёт рой в того, кто первый' },
    { on: c => c.drift >= 1, name: 'Турбо за занос', like: 'мини-турбо Mario Kart DS', how: () => 'держи B в повороте, отпусти — рывок' },
    { on: c => c.shortcut >= 1, name: 'Срезка', like: 'F-Zero и Diddy Kong Racing', how: () => 'мостик через ручей короче, мимо мостика — грязь' },
    { on: c => c.mirror >= 1, name: 'Зеркало', like: 'Mirror mode Mario Kart', how: () => 'трасса задом наперёд' },
  ],

  TRACK: [[-18, 13.5], [0, 14], [16, 13], [22.5, 7], [23, -3], [19, -11], [12, -14.5], [7, -12], [4.5, -4.5], [0, -2.5],
    [-4.5, -4.5], [-7, -12], [-12, -14.5], [-19, -11.5], [-23.5, -3], [-23, 7]],
  FINISH: [-4, 13.8],
  CUT: [[8.5, -13.6], [-8.5, -13.6]], // концы срезки через ручей у пруда
  HIVE: [26, -17],
  W: 6.6, // ширина дороги
  RACERS: [
    { name: 'Аслан', color: '#3d6bff', hat: '#1b1b24' }, { name: 'Мадина', color: '#27b35a', hat: '#f4efe4' },
    { name: 'Тимур', color: '#8d4dff', hat: '#2a1d16' }, { name: 'Зарема', color: '#ff8a1f', hat: '#f4efe4' },
    { name: 'Азамат', color: '#00b3a4', hat: '#1b1b24' }, { name: 'Саида', color: '#f1f1f1', hat: '#c4472f' },
    { name: 'Руслан', color: '#9a6a3a', hat: '#2a1d16' }, { name: 'Бэла', color: '#ffd23f', hat: '#2a1d16' },
  ],
  HUMANS: [{ name: 'Ты', color: '#ff2e88', hat: '#1b1b24' }, { name: 'Игрок 2', color: '#2ee6ff', hat: '#1b1b24' }],
  ITEMS: {
    peel: { name: 'Арбузная корка', icon: '🍉', tier: 0, tip: 'бросить назад' },
    pumpkin: { name: 'Тыква-ядро', icon: '🎃', tier: 0.25, tip: 'летит вперёд по трассе' },
    nuts: { name: 'Мешок орехов', icon: '🌰', tier: 0.45, tip: 'три ореха защищают' },
    honey: { name: 'Турбо-мёд', icon: '🍯', tier: 0.65, tip: 'рывок', strong: true },
    bees: { name: 'Пчелиный рой', icon: '🐝', tier: 0.85, tip: 'летит в лидера', strong: true },
    star: { name: 'Звёздочка', icon: '⭐', tier: 1, tip: 'неуязвим и быстрее', strong: true },
  },
  KEYS: ['peel', 'pumpkin', 'nuts', 'honey', 'bees', 'star'],
  PLACE_PTS: [1000, 700, 500, 350, 200, 120, 60, 30],
  PLACE_COL: ['#ffd23f', '#dfe8f2', '#e8a066', '#ffffff'],

  /* ---------- новая партия ---------- */
  start(lab, scene) {
    const T = lab.THREE, st = lab.state, cfg = lab.cfg;
    st.sim = cfg.sim >= 1;
    st.duo = !st.sim && lab.players >= 2;
    lab.light.sun.color.set('#ffe2b8'); lab.light.sun.intensity = 1.55; lab.light.hemi.intensity = 0.95;
    this.tmp = { M: new T.Matrix4(), K: new T.Matrix4(), R: new T.Matrix4(), P: new T.Vector3(), Q: new T.Quaternion(), E: new T.Euler(0, 0, 0, 'YXZ'), S: new T.Vector3(), C: new T.Color(), zero: new T.Matrix4().makeScale(0, 0, 0) };
    Object.assign(st, { ended: false, banner: false, posterOn: false, overtakes: 0, streak: 0, bestStreak: 0, coinsTaken: 0, itemsUsed: 0, hitsLeader: 0, drifts: 0, hitsGiven: 0, hitsTaken: 0, lastLap: 0, cam: null, crowdJump: 0 });
    this.buildTrack(lab);
    this.scenery(lab, scene);
    this.buildKarts(lab);
    this.buildItemLooks(lab);
    this.buildBars(lab);
    this.newRace(lab, st.sim);
    if (st.sim) {
      const L = this.tr.L, est = cfg.laps * L / (cfg.speed * 0.9) + 4; // примерная длина заезда ботов
      st.S = { n: Math.round(cfg.simRaces), results: [], acc: 0, h: 1 / 20, k: Math.max(20, est * Math.round(cfg.simRaces) / 12), done: false, doneT: 0, bars: [] };
      st.anchor = lab.group({ at: [0, 0, 0] });
      lab.hero(st.anchor);
    }
    const v = lab.view; // живая камера: база — расстояние, которое подобрала оболочка
    st.cam = { d: v.distance, k: 1, punch: 0, last: v.distance, tx: v.target.x, tz: v.target.z, tilt: v.tilt };
    if (!lab.playing) this.poster(lab);
    this.render(lab, 0);
  },
  // афиша в меню: тележки кучей в ближнем повороте, рой летит к лидеру, тыква в полёте, камера ближе. Первый кадр партии всё возвращает
  poster(lab) {
    const st = lab.state, L = this.tr.L, R = st.racers, v = lab.view, C = st.cam;
    st.posterOn = true;
    const base = L * 0.06;
    R.forEach((r, i) => {
      const s = base - i * 2.3, d = [-1.6, 1.3, -0.2, 2.2, -2.2, 0.6, 1.8, -1][i % 8];
      r.prog = s; r.s = this.mod(s); r.d = d;
      const p = this.pos(r.s, d); r.x = p.x; r.z = p.z; r.h = this.headAt(r.s); r.v = 8; r.place = i + 1;
      r.lean = i % 2 ? 0.12 : -0.1;
    });
    const lead = R[0], last = R[R.length - 1];
    st.projs.push({ kind: 'bees', x: last.x + 1.5, y: 2.4, z: last.z - 3.5, target: lead, owner: last, life: 99, poster: true });
    st.projs.push({ kind: 'pumpkin', s: this.mod(R[2].s + 2.6), d: R[2].d, life: 99, owner: R[2], poster: true });
    this.rank(lab);
    C.k = 0.72; v.distance = C.d * C.k; C.last = v.distance;
    const p = this.pos(this.mod(base - 5), 0); v.target.set(p.x * 0.7, 0, p.z * 0.8); v.tilt = C.tilt + 0.06;
  },
  unposter(lab) {
    const st = lab.state;
    if (!st.posterOn) return;
    st.posterOn = false;
    this.newRace(lab, st.sim);
  },
  variant(lab) {
    const c = lab.cfg, on = this.VARIANTS.filter(v => v.on(c));
    if (!on.length) return { name: 'Классика', like: 'Mario Kart', how: `${Math.round(c.laps)} круга, коробки-гостинцы, приедь первым` };
    return { name: on.map(v => v.name).join(' + '), like: on.map(v => v.like).join(', '), how: on.map(v => v.how(c)).join('; ') };
  },

  /* ---------- трасса: замкнутая кривая, 720 точек, у каждой касательная, нормаль, кривизна и гоночная линия ---------- */
  buildTrack(lab) {
    const T = lab.THREE, cfg = lab.cfg;
    let P = this.TRACK.map(([x, z]) => new T.Vector3(x, 0, z));
    if (cfg.mirror >= 1) P = P.reverse();
    const curve = new T.CatmullRomCurve3(P, true, 'centripetal'), M = 720, L = curve.getLength(), raw = curve.getSpacedPoints(M);
    let f0 = 0, best = 1e9; // нулевая точка — линия финиша
    for (let i = 0; i < M; i++) { const dd = (raw[i].x - this.FINISH[0]) ** 2 + (raw[i].z - this.FINISH[1]) ** 2; if (dd < best) { best = dd; f0 = i; } }
    const tr = this.tr = { M, L, ds: L / M, W: this.W, px: new Float32Array(M), pz: new Float32Array(M), tx: new Float32Array(M), tz: new Float32Array(M),
      nx: new Float32Array(M), nz: new Float32Array(M), curv: new Float32Array(M), line: new Float32Array(M) };
    for (let i = 0; i < M; i++) { const p = raw[(i + f0) % M]; tr.px[i] = p.x; tr.pz[i] = p.z; }
    for (let i = 0; i < M; i++) {
      const a = (i + M - 1) % M, b = (i + 1) % M, dx = tr.px[b] - tr.px[a], dz = tr.pz[b] - tr.pz[a], l = Math.hypot(dx, dz) || 1;
      tr.tx[i] = dx / l; tr.tz[i] = dz / l; tr.nx[i] = -tr.tz[i]; tr.nz[i] = tr.tx[i]; // нормаль — вправо по ходу
    }
    for (let i = 0; i < M; i++) { const j = (i + 4) % M; tr.curv[i] = (tr.tx[i] * tr.tz[j] - tr.tz[i] * tr.tx[j]) / (4 * tr.ds); }
    // гоночная линия: к внутренней стороне ближайшего поворота, сглаженная
    const raw2 = new Float32Array(M);
    for (let i = 0; i < M; i++) { let c = 0; for (let k = 0; k < 40; k++) c += tr.curv[(i + k) % M]; raw2[i] = lab.clamp(-c / 40 * 6, -1, 1) * tr.W * 0.28; }
    for (let i = 0; i < M; i++) { let c = 0; for (let k = -12; k <= 12; k++) c += raw2[(i + k + M) % M]; tr.line[i] = c / 25; }
    // срезка: начало A и конец B по ходу гонки
    const sOf = ([x, z]) => this.proj(x, z, 0, true).s;
    let sA = sOf(this.CUT[0]), sB = sOf(this.CUT[1]), A = this.CUT[0], B = this.CUT[1];
    if (this.mod(sB - sA) > L / 2) { [sA, sB] = [sB, sA]; [A, B] = [B, A]; }
    Object.assign(tr, { sA, sB, cutLen: this.mod(sB - sA), A: this.pos(sA, 0), B: this.pos(sB, 0) });
    tr.chord = Math.hypot(tr.B.x - tr.A.x, tr.B.z - tr.A.z);
    // коробки и монеты: места на трассе (доли круга), коробки — после первого поворота
    tr.boxRows = [0.27, 0.7].map(k => k * L);
    tr.coinRows = [0.05, 0.17, 0.4, 0.58, 0.84, 0.93].map(k => k * L);
  },
  mod(s) { const L = this.tr.L; return ((s % L) + L) % L; },
  wrap(ds) { const L = this.tr.L; ds = this.mod(ds); return ds > L / 2 ? ds - L : ds; },
  idx(s) { const t = this.tr, f = this.mod(s) / t.ds, i = Math.floor(f) % t.M; return { i, j: (i + 1) % t.M, f: f - Math.floor(f) }; },
  pos(s, d) { const t = this.tr, { i, j, f } = this.idx(s); return { x: t.px[i] + (t.px[j] - t.px[i]) * f + t.nx[i] * d, z: t.pz[i] + (t.pz[j] - t.pz[i]) * f + t.nz[i] * d }; },
  headAt(s) { const t = this.tr, { i } = this.idx(s); return Math.atan2(t.tx[i], t.tz[i]); },
  lineAt(s) { return this.tr.line[this.idx(s).i]; },
  curvAt(s) { return this.tr.curv[this.idx(s).i]; },
  // ближайшая точка трассы: s вдоль круга, d — сдвиг вправо от оси
  proj(x, z, hint, wide) {
    const t = this.tr, M = t.M, R = wide ? M / 2 : 48;
    let best = 1e9, bi = 0;
    for (let k = -R; k < R; k++) { const i = ((hint + k) % M + M) % M, dd = (x - t.px[i]) ** 2 + (z - t.pz[i]) ** 2; if (dd < best) { best = dd; bi = i; } }
    if (!wide && best > (t.W / 2 + 2.5) ** 2) return this.proj(x, z, bi, true);
    const dx = x - t.px[bi], dz = z - t.pz[bi], along = lab_clamp(dx * t.tx[bi] + dz * t.tz[bi], -t.ds, t.ds);
    return { i: bi, s: this.mod(bi * t.ds + along), d: dx * t.nx[bi] + dz * t.nz[bi], dist: Math.sqrt(best) };
  },
  chordOf(x, z) {
    const t = this.tr, ax = t.B.x - t.A.x, az = t.B.z - t.A.z, l2 = ax * ax + az * az;
    const k = ((x - t.A.x) * ax + (z - t.A.z) * az) / l2, cx = t.A.x + ax * k, cz = t.A.z + az * k;
    return { k, dist: Math.hypot(x - cx, z - cz), cx, cz };
  },

  /* ---------- гонка: тележки на старте, коробки, монеты ---------- */
  newRace(lab, fast) {
    const st = lab.state, cfg = lab.cfg, t = this.tr, nb = st.sim ? Math.round(cfg.bots) + 1 : Math.round(cfg.bots);
    const humans = st.sim ? 0 : st.duo ? 2 : 1, R = [];
    for (const p of (st.projs || []).concat(st.dead || [])) { if (p.tr) p.tr.dispose(); if (p.anchor) p.anchor.removeFromParent(); }
    for (const r of st.racers || []) if (r.trail) { r.trail.dispose(); r.trail = null; }
    st.dead = [];
    for (let i = 0; i < nb; i++) R.push(this.makeRacer(lab, this.RACERS[i % this.RACERS.length], null, R.length));
    for (let h = 0; h < humans; h++) R.push(this.makeRacer(lab, this.HUMANS[h], h, R.length));
    R.forEach((r, j) => {
      const s = -2.5 - Math.floor(j / 2) * 2.6, d = j % 2 ? 1.5 : -1.5, p = this.pos(s, d);
      Object.assign(r, { prog: s, s: this.mod(s), d, x: p.x, z: p.z, h: this.headAt(s), idx: this.idx(s).i });
    });
    Object.assign(st, { racers: R, humans: R.filter(r => r.human), projs: [], peels: [], rt: 0, go: fast ? 0 : 2.4, goStep: -1, raceOver: false, overT: 0,
      leader: null, changes: 0, decided: 1, firstFinish: null, finishers: 0, hiveT: 18, fast: !!fast, finalLap: false, resultSaved: false });
    st.boxes = []; st.coins = [];
    if (cfg.items >= 1) for (const s of t.boxRows) for (const d of [-2.1, -0.7, 0.7, 2.1]) st.boxes.push({ s, d, on: true, t: 0, spin: lab.rand(0, 6) });
    if (cfg.snowball > 0) for (const s of t.coinRows) for (let k = 0; k < 4; k++) st.coins.push({ s: s + k * 1.4, d: [-1.8, -0.6, 0.6, 1.8][(k + Math.floor(s)) % 4] * 0.9, on: true, t: 0 });
    this.rank(lab);
  },
  makeRacer(lab, look, human, n) {
    const cfg = lab.cfg;
    return { name: look.name, color: look.color, hat: look.hat, human: human != null, pi: human, n, v: 0, lean: 0, spinA: 0, stun: 0, inv: 0, boost: 0, turbo: 0,
      star: 0, nuts: 0, coins: 0, item: null, roll: 0, itemT: 0, oops: 0, oopsT: lab.rand(5, 12), k: 0.86 + 0.05 * cfg.botSkill + lab.rand(-0.025, 0.025),
      skill: lab.clamp(0.5 + 0.25 * cfg.botSkill + lab.rand(-0.15, 0.15), 0.05, 1), finished: false, finishT: 0, place: n + 1, cut: null, cutDone: -1,
      mud: false, wall: false, drift: 0, driftOn: false, wrongT: 0, rel: {}, lap: 0, dodge: null, bob: lab.rand(0, 6) };
  },
  rank(lab) {
    const st = lab.state;
    st.order = st.racers.slice().sort((a, b) => (a.finished && b.finished) ? a.finishT - b.finishT : a.finished ? -1 : b.finished ? 1 : b.prog - a.prog);
    st.order.forEach((r, i) => { r.place = i + 1; });
  },

  /* ---------- каждый кадр ---------- */
  update(lab, dt) {
    const st = lab.state;
    this.unposter(lab);
    if (!st.banner) { // имя вариации и её правило крупно в начале партии
      st.banner = true;
      const v = this.variant(lab), at = lab.v3(this.FINISH[0], 5, this.FINISH[1] - 2);
      lab.popup(at, v.name, '#ffe680', 32);
      lab.after(0.35, () => lab.popup(lab.v3(at.x, at.y - 1.4, at.z), v.how, '#ffffff', 17));
    }
    if (st.sim) this.simTick(lab, dt);
    else { this.step(lab, dt); this.raceEnd(lab, dt); }
    this.life(lab, dt);
    this.render(lab, dt);
    this.liveCamera(lab, dt);
    this.hudLines(lab);
  },

  step(lab, dt) {
    const st = lab.state, cfg = lab.cfg, R = st.racers;
    if (st.go > 0) { // огни старта: три красных, потом зелёный
      st.go -= dt;
      const k = Math.min(3, Math.floor((2.4 - st.go) / 0.8));
      if (k !== st.goStep && !st.fast) {
        st.goStep = k;
        if (k < 3) lab.tone(440, 0.16, 'square', 0.06); else { lab.tone(880, 0.4, 'square', 0.07); lab.popup(lab.v3(this.FINISH[0], 4, this.FINISH[1]), 'Марш!', '#7cf5a8', 34); lab.shake(0.15); }
      }
      if (st.go <= 0) st.goStep = 3;
      return;
    }
    st.rt += dt;
    for (const r of R) {
      for (const k of ['stun', 'inv', 'boost', 'turbo', 'star', 'oops']) if (r[k] > 0) r[k] = Math.max(0, r[k] - dt);
      if (r.stun > 0) r.spinA += dt * 13 * Math.min(1, r.stun * 2); else r.spinA = lab.damp(r.spinA, Math.round(r.spinA / (2 * Math.PI)) * 2 * Math.PI, 8, dt);
      if (r.roll > 0 && (r.roll -= dt) <= 0) { r.roll = 0; if (r.human && !st.fast) lab.tone(1046, 0.12, 'triangle', 0.06); }
      if (r.human) this.drivePlayer(lab, r, r.pi ? lab.p2 : lab.p1, dt); else this.driveBot(lab, r, dt);
    }
    this.bumps(lab);
    this.itemsTick(lab, dt);
    this.rank(lab);
    this.leaderTick(lab);
    this.finishTick(lab);
  },

  // скорость гонщика: монеты (снежный ком), резинка ботов (помощь отстающему), рывки и удары
  vmax(lab, r) {
    const st = lab.state, cfg = lab.cfg, L = st.leader;
    let v = r.human ? cfg.speed : cfg.speed * r.k;
    if (cfg.snowball > 0) v *= 1 + 0.024 * cfg.snowball * r.coins;
    if (!r.human && cfg.rubber > 0 && L && !L.finished) {
      if (L === r) v *= 1 - 0.03 * cfg.rubber;
      else v *= 1 + cfg.rubber * 0.075 * lab.clamp((L.prog - r.prog) / 18, 0, 1.4);
    }
    if (r.boost > 0) v *= 1.45;
    if (r.turbo > 0) v *= 1.3;
    if (r.star > 0) v *= 1.25;
    if (r.stun > 0) v *= 0.15;
    if (r.oops > 0) v *= 0.55;
    if (r.mud) v *= 0.4;
    if (r.finished) v *= 0.55;
    return v;
  },

  drivePlayer(lab, r, p, dt) {
    const st = lab.state, cfg = lab.cfg, t = this.tr;
    const ix = p.x, iz = -p.y, mag = Math.hypot(ix, iz), brake = p.b && !r.finished;
    r.steer = 0;
    if (r.stun <= 0 && mag > 0.3) {
      let ht = Math.atan2(ix, iz);
      if (cfg.assist > 0) { // умный руль: стрелка «примерно вперёд» тянется вдоль трассы и от бортов
        const i = r.idx || 0, fh = Math.atan2(t.tx[i], t.tz[i]) + lab.clamp(r.d / (t.W / 2), -1, 1) * 0.35, off = Math.atan2(Math.sin(ht - fh), Math.cos(ht - fh));
        if (Math.abs(off) < 2.1) ht = fh + off * (1 - 0.7 * cfg.assist);
      }
      const dh = Math.atan2(Math.sin(ht - r.h), Math.cos(ht - r.h)), step = cfg.turn * (brake ? 1.45 : 1) * dt;
      r.h += lab.clamp(dh, -step, step); r.steer = lab.clamp(dh * 2, -1, 1);
    }
    let vt = this.vmax(lab, r);
    const turning = Math.abs(r.steer) > 0.25 && r.v > 4;
    if (brake) {
      if (cfg.drift >= 1 && turning) { // занос: копим искры, отпустил — мини-турбо
        if (!r.driftOn) { r.driftOn = true; r.drift = 0; }
        r.drift += dt; vt *= 0.92;
        if (!st.fast && Math.floor(r.drift * 12) !== Math.floor((r.drift - dt) * 12)) {
          const col = r.drift > 1.1 ? '#ff8a2e' : r.drift > 0.5 ? '#5fe0ff' : '#ffffff', b = this.backOf(r);
          lab.burst(b, { count: 2, color: col, speed: 2.5, size: 0.14, life: 0.25, up: 1 });
        }
      } else vt *= 0.5;
      if (turning && !r.skid) { r.skid = true; st.drifts++; lab.count('заносы'); this.addScore(lab, r, 5); if (!st.fast) lab.noise(0.25, 0.05, 900); }
    } else {
      if (r.driftOn && r.drift > 0.5) {
        r.turbo = r.drift > 1.1 ? 1.1 : 0.6;
        if (!st.fast) { lab.burst(this.backOf(r), { count: 14, colors: r.drift > 1.1 ? ['#ff8a2e', '#ffd23f'] : ['#5fe0ff', '#ffffff'], speed: 6, size: 0.2 }); lab.sfx.whoosh(); lab.popup(lab.v3(r.x, 2.2, r.z), r.drift > 1.1 ? 'Супер-турбо!' : 'Турбо!', '#ff9a3d', 16); this.addScore(lab, r, r.drift > 1.1 ? 40 : 20); }
      }
      r.driftOn = false; r.drift = 0; r.skid = false;
    }
    r.v = lab.damp(r.v, vt, vt > r.v ? 1.5 : 3.5, dt);
    r.x += Math.sin(r.h) * r.v * dt; r.z += Math.cos(r.h) * r.v * dt;
    // где тележка на трассе; борта из тюков сена тормозят
    const W2 = t.W / 2 - 0.55, q = this.proj(r.x, r.z, r.idx);
    let s = q.s, d = q.d;
    r.mud = false;
    if (Math.abs(d) > W2) {
      const c = cfg.shortcut >= 1 ? this.chordOf(r.x, r.z) : null;
      if (c && c.k > 0.02 && c.k < 0.98 && c.dist < 2.7) { // на срезке: мостик или грязь
        s = this.mod(t.sA + c.k * t.cutLen); d = 0; r.mud = c.dist > 1.1;
        if (r.mud && !st.fast && lab.chance(dt * 10)) lab.burst(lab.v3(r.x, 0.3, r.z), { count: 2, colors: ['#6b4a2e', '#8a6a3a'], speed: 2, size: 0.2, life: 0.4, up: 1.5 });
      } else if (c && c.k > 0.02 && c.k < 0.98 && c.dist < 4.2 && r.lastCut) { // не выпускаем со срезки в сторону
        const over = c.dist - 2.7, nx = (r.x - c.cx) / c.dist, nz = (r.z - c.cz) / c.dist;
        r.x -= nx * over; r.z -= nz * over; s = this.mod(t.sA + c.k * t.cutLen); d = 0; r.mud = true; this.wallHit(lab, r);
      } else {
        const over = Math.abs(d) - W2, sg = Math.sign(d);
        r.x -= t.nx[q.i] * over * sg; r.z -= t.nz[q.i] * over * sg; d = sg * W2;
        this.wallHit(lab, r);
        if (mag > 0.3) { // руль у борта: тележка скользит вдоль тюков туда, куда ближе по ходу носа
          const th = Math.atan2(t.tx[q.i], t.tz[q.i]), dh = Math.atan2(Math.sin(th - r.h), Math.cos(th - r.h)), to = Math.abs(dh) < Math.PI / 2 ? dh : dh - Math.sign(dh) * Math.PI;
          r.h += lab.clamp(to, -2.2 * dt, 2.2 * dt);
        }
      }
    } else r.wall = false;
    r.lastCut = r.mud || (Math.abs(q.d) > W2 && cfg.shortcut >= 1 && d === 0);
    r.idx = q.i;
    const ds = this.wrap(s - r.s);
    r.prog += ds; r.s = s; r.d = d;
    const mark = Math.floor(r.prog / (t.L / 12)); // вешки: 12 на круг, очки за каждую новую — видно, что едешь вперёд
    if (mark > (r.mark == null ? 0 : r.mark)) { if (r.mark != null && st.rt > 0) this.addScore(lab, r, 10); r.mark = mark; }
    r.wrongT = ds < -0.002 && r.v > 2 ? r.wrongT + dt : Math.max(0, r.wrongT - dt * 2);
    r.lean = lab.damp(r.lean, -r.steer * 0.12 * Math.min(1, r.v / 8), 8, dt);
    if (r.item && !r.roll && p.pressed.a && r.stun <= 0) this.useItem(lab, r);
  },
  wallHit(lab, r) {
    const st = lab.state;
    if (!r.wall && r.v > 3.5 && !st.fast) {
      lab.burst(lab.v3(r.x, 0.5, r.z), { count: 10, colors: ['#e3b04b', '#fff1b8', '#c98a2e'], speed: 4, size: 0.16 });
      lab.tone(120, 0.12, 'square', 0.06, 70); lab.shake(0.12); lab.vibrate(60, 0.4);
      if (r.human && r.v > 6) { if (st.streak >= 2) lab.popup(lab.v3(r.x, 2, r.z), 'Серия сброшена', '#ffb3b3', 13); st.streak = 0; }
    }
    r.wall = true; r.v = Math.min(r.v, 2.6);
  },
  backOf(r) { return lab_v(r.x - Math.sin(r.h) * 0.9, 0.25, r.z - Math.cos(r.h) * 0.9); },

  driveBot(lab, r, dt) {
    const st = lab.state, cfg = lab.cfg, t = this.tr, W2 = t.W / 2 - 0.6;
    if (r.cut != null) { // срезка через ручей: прямо по мостику (или в грязь мимо)
      r.cut += r.v * dt / t.chord;
      const vt = this.vmax(lab, r);
      r.v = lab.damp(r.v, vt, vt > r.v ? 1.5 : 4, dt);
      const k = Math.min(1, r.cut), off = r.cutMud ? 1.8 : 0, ax = t.B.x - t.A.x, az = t.B.z - t.A.z, l = t.chord;
      r.x = t.A.x + ax * k - az / l * off; r.z = t.A.z + az * k + ax / l * off; r.h = Math.atan2(ax, az);
      r.prog = r.cutProg + k * t.cutLen; r.s = this.mod(r.prog); r.mud = r.cutMud;
      if (r.cut >= 1) { r.cut = null; r.mud = false; r.d = 0; }
      return;
    }
    // куда держать: гоночная линия, коробка, монета, мимо соседа и корки
    let td = this.lineAt(r.s + 5) * (0.5 + 0.5 * r.skill), block = null;
    if (cfg.items >= 1 && !r.item && !r.roll) {
      let bd = null, bds = 15;
      for (const b of st.boxes) { const ds = this.wrap(b.s - r.s); if (b.on && ds > 2 && ds < bds) { bds = ds; bd = bd == null || Math.abs(b.d - r.d) < Math.abs(bd - r.d) ? b.d : bd; } }
      if (bd != null) td = bd;
    } else if (cfg.snowball > 0 && r.coins < 10) {
      for (const c of st.coins) { const ds = this.wrap(c.s - r.s); if (c.on && ds > 1.5 && ds < 9 && Math.abs(c.d - r.d) < 2.5) { td = c.d; break; } }
    }
    for (const p of st.peels) {
      const ds = this.wrap(p.s - r.s);
      if (ds > 1 && ds < 8 && Math.abs(p.d - td) < 1.1) { if (p.seen !== r) { p.seen = r; p.dodge = lab.chance(0.25 + 0.65 * r.skill); } if (p.dodge) td = p.d + (p.d > 0 ? -1.6 : 1.6); }
    }
    for (const o of st.racers) {
      if (o === r || o.cut != null) continue;
      const ds = this.wrap(o.s - r.s);
      if (ds > 0 && ds < 2.6 && Math.abs(o.d - r.d) < 1.3) { block = o; td = r.d + (r.d >= o.d ? 1.7 : -1.7); if (Math.abs(td) > W2) td = r.d + (r.d >= o.d ? -1.7 : 1.7) * 0; }
    }
    td = lab.clamp(td, -W2, W2);
    const dd = lab.clamp(td - r.d, -3.4 * dt, 3.4 * dt);
    r.d += dd;
    let vt = this.vmax(lab, r) * (1 - 0.1 * lab.clamp(Math.abs(this.curvAt(r.s)) * 5, 0, 1));
    if (block && Math.abs(block.d - r.d) < 1 && block.v < vt) vt = Math.max(block.v * 0.98, vt * 0.7);
    if (st.rt < 0.05) r.v = 0;
    r.v = lab.damp(r.v, vt, vt > r.v ? 1.6 : 4, dt);
    r.prog += r.v * dt; r.s = this.mod(r.prog);
    const p = this.pos(r.s, r.d); r.x = p.x; r.z = p.z; r.h = this.headAt(r.s) + Math.atan2(dd / Math.max(dt, 1e-4), Math.max(2, r.v)) * 0.6;
    r.lean = lab.damp(r.lean, -lab.clamp(this.curvAt(r.s) * 3, -0.12, 0.12), 6, dt);
    // срезка
    const lapNo = Math.floor(r.prog / t.L);
    if (cfg.shortcut >= 1 && r.cutDone !== lapNo && Math.abs(this.wrap(r.s - t.sA)) < 0.6 && !r.finished) {
      r.cutDone = lapNo;
      if (lab.chance(0.35 + 0.35 * r.skill)) { r.cut = 0; r.cutProg = r.prog - this.wrap(r.s - t.sA); r.cutMud = lab.chance(0.4 * (1 - r.skill)); }
    }
    // промахи ботов: занесло — тележку крутит, все сзади видят шанс обогнать
    if ((r.oopsT -= dt) <= 0) { r.oopsT = lab.rand(7, 15); if (lab.chance(0.5 - 0.18 * cfg.botSkill)) r.oops = 0.9; }
    // гостинцы ботов
    if (r.item && !r.roll && st.rt > 8 && (r.itemT -= dt) <= 0) this.botItem(lab, r);
  },
  botItem(lab, r) {
    const st = lab.state, k = r.item;
    const near = (lo, hi) => st.racers.find(o => o !== r && !o.finished && o.cut == null && (() => { const ds = this.wrap(o.s - r.s); return ds > lo && ds < hi && Math.abs(o.d - r.d) < 1.6; })());
    r.itemHold = (r.itemHold || 0) + 0.25;
    if (k === 'pumpkin' && !near(3, 24) && r.itemHold < 6) { r.itemT = 0.25; return; }
    if (k === 'peel' && !near(-10, -1) && r.itemHold < 5) { r.itemT = 0.25; return; }
    if (k === 'honey' && Math.abs(this.curvAt(r.s)) > 0.05 && r.itemHold < 3) { r.itemT = 0.25; return; }
    this.useItem(lab, r);
  },
  // толчки тележек: игрок толкается в мире, боты — по трассе; звёздочка и орехи сбивают соседа
  bumps(lab) {
    const st = lab.state, R = st.racers;
    for (const h of st.humans) {
      for (const o of R) {
        if (o === h || o.cut != null) continue;
        const dx = h.x - o.x, dz = h.z - o.z, d = Math.hypot(dx, dz);
        if (d > 1.35 || d < 1e-3) continue;
        const push = (1.35 - d) / 2, nx = dx / d, nz = dz / d;
        h.x += nx * push; h.z += nz * push;
        if (o.human) { o.x -= nx * push; o.z -= nz * push; } else { const oi = this.idx(o.s).i; o.d = lab.clamp(o.d - (nx * this.tr.nx[oi] + nz * this.tr.nz[oi]) * push, -this.tr.W / 2 + 0.6, this.tr.W / 2 - 0.6); }
        h.v *= 0.94; o.v *= 0.96;
        if (h.star > 0 || h.nuts > 0) { if (this.hit(lab, o, 'bump', h) && h.nuts > 0 && h.star <= 0) h.nuts--; }
        else if (o.star > 0 || o.nuts > 0) { if (this.hit(lab, h, 'bump', o) && o.nuts > 0 && o.star <= 0) o.nuts--; }
        else if (!st.fast && (h.bumpT || 0) < lab.t) { h.bumpT = lab.t + 0.4; lab.tone(160, 0.08, 'square', 0.05, 110); lab.burst(lab.v3(h.x - nx * 0.6, 0.6, h.z - nz * 0.6), { count: 5, color: '#ffffff', speed: 3, size: 0.12 }); }
      }
    }
    for (const a of R) { // боты со звёздочкой или орехами сбивают ботов
      if (a.human || a.cut != null || (a.star <= 0 && a.nuts <= 0)) continue;
      for (const o of R) {
        if (o === a || o.human || o.cut != null) continue;
        const ds = this.wrap(o.s - a.s);
        if (Math.abs(ds) < 1.2 && Math.abs(o.d - a.d) < 1.1 && this.hit(lab, o, 'bump', a) && a.nuts > 0 && a.star <= 0) a.nuts--;
      }
    }
  },

  /* ---------- гостинцы ---------- */
  rollItem(lab, r) {
    const cfg = lab.cfg, N = lab.state.racers.length, t = N > 1 ? (r.place - 1) / (N - 1) : 0;
    const bias = cfg.secret >= 1 ? Math.min(1, 0.35 + 0.65 * cfg.rubber) : 0; // по месту: лидеру слабые, последним сильные
    const w = this.KEYS.map(k => (1 - bias) * 0.5 + bias * Math.exp(-((this.ITEMS[k].tier - t) ** 2) / 0.05));
    let x = lab.rand(0, w.reduce((a, b) => a + b, 0));
    for (let i = 0; i < w.length; i++) { x -= w[i]; if (x <= 0) return this.KEYS[i]; }
    return 'peel';
  },
  giveItem(lab, r) {
    const st = lab.state, k = this.rollItem(lab, r);
    r.item = k; r.roll = r.human ? 0.8 : 0; r.itemT = lab.rand(0.6, 2.5); r.itemHold = 0;
    if (this.ITEMS[k].strong && lab.cfg.secret >= 1 && r.place > Math.ceil(st.racers.length / 2)) lab.count('_secret');
    this.addScore(lab, r, 10);
    if (r.human && !st.fast) { lab.sfx.coin(); lab.burst(lab.v3(r.x, 1, r.z), { count: 12, colors: ['#ff6ad5', '#5fe0ff', '#ffd23f', '#7cf5a8'], speed: 5, size: 0.18 }); }
  },
  useItem(lab, r) {
    const st = lab.state, k = r.item;
    r.item = null;
    if (r.human) { st.itemsUsed++; lab.count('предметы'); }
    const fx = !st.fast, at = lab.v3(r.x, 1, r.z);
    if (k === 'peel') { if (r.cut == null) st.peels.push({ s: this.mod(r.s - 1.7), d: r.d, life: 30, owner: r, safe: 0.8 }); if (fx) lab.tone(300, 0.1, 'triangle', 0.05, 200); }
    if (k === 'pumpkin') { const p = { kind: 'pumpkin', s: this.mod(r.s + 1.3), d: r.d, life: 3, owner: r }; st.projs.push(p); if (fx) { lab.sfx.shoot(); lab.burst(at, { count: 8, color: '#ff9a3d', speed: 4, size: 0.16 }); } }
    if (k === 'nuts') { r.nuts = 3; if (fx) lab.tone(520, 0.12, 'triangle', 0.05, 700); }
    if (k === 'honey') { r.boost = 1.6; if (fx) { lab.sfx.whoosh(); lab.burst(this.backOf(r), { count: 14, colors: ['#ffb12e', '#ffd23f'], speed: 5, size: 0.2 }); if (r.human) lab.shake(0.12); } }
    if (k === 'star') { r.star = 4; if (fx) { lab.sfx.power(); lab.ring(at, { color: '#ffd23f', radius: 2.5 }); } }
    if (k === 'bees') this.launchBees(lab, r.x, 1.4, r.z, r);
  },
  launchBees(lab, x, y, z, owner) {
    const st = lab.state, target = st.order.find(o => o !== owner && !o.finished);
    if (!target) return;
    st.projs.push({ kind: 'bees', x, y, z, target, owner, life: 9 });
    if (!st.fast) {
      lab.tone(180, 0.6, 'sawtooth', 0.04, 220);
      lab.popup(lab.v3(target.x, 2.6, target.z), target.human ? 'Рой летит к тебе!' : 'Рой летит к лидеру!', '#ffe14d', 16);
    }
  },
  // удар гостинцем: тележку крутит, монеты рассыпаются; первые 9 секунд и звёздочка защищают
  hit(lab, r, kind, owner) {
    const st = lab.state;
    if (r.finished || r.star > 0 || r.inv > 0 || r.cut != null) return false;
    if (st.rt < 9 && !st.fast) return false;
    if (r.nuts > 0 && kind !== 'bees' && kind !== 'bump') { r.nuts--; if (!st.fast) lab.burst(lab.v3(r.x, 0.8, r.z), { count: 8, color: '#a0703c', speed: 4, size: 0.15 }); return false; }
    const wasLeader = r.place === 1;
    r.stun = kind === 'bees' ? 1.6 : 1.1; r.inv = r.stun + 0.8; r.v *= 0.35; r.boost = 0; r.turbo = 0;
    const lost = Math.min(r.coins, 3); r.coins -= lost;
    if (!st.fast) {
      const at = lab.v3(r.x, 0.8, r.z);
      if (lost) lab.burst(at, { count: 6 * lost, color: '#ffd23f', speed: 5, size: 0.18, up: 4 });
      lab.burst(at, { count: 14, colors: kind === 'bees' ? ['#ffe14d', '#3a2a10'] : kind === 'peel' ? ['#ff4d6a', '#2f9e44'] : ['#ff6a1f', '#ffd23f'], speed: 5, size: 0.18 });
      if (r.human) {
        if (r.pi === 0) lab.hurt(at); else { lab.shake(0.5); lab.flash('#ff4d5e', 0.2); lab.sfx.hit(); }
        st.hitsTaken++; if (st.streak >= 2) lab.popup(lab.v3(r.x, 2.2, r.z), 'Серия сброшена', '#ffb3b3', 13); st.streak = 0;
      } else { lab.tone(240, 0.15, 'square', 0.05, 120); lab.popup(lab.v3(r.x, 2.2, r.z), '💫', '#ffffff', 16); }
      if (kind === 'bees') { lab.shake(0.3); lab.hitstop(0.06); st.cam.punch = 1; }
    }
    if (owner && owner.human && owner !== r) {
      st.hitsGiven++; this.addScore(lab, owner, 100, lab.v3(r.x, 1.6, r.z));
      if (wasLeader) { st.hitsLeader++; lab.count('по лидеру'); if (!st.fast) lab.popup(lab.v3(r.x, 2.8, r.z), 'По лидеру!', '#ffd23f', 18); }
    }
    return true;
  },
  itemsTick(lab, dt) {
    const st = lab.state, cfg = lab.cfg, R = st.racers, live = R.filter(r => r.cut == null && !r.finished);
    // коробки и монеты на трассе
    for (const b of st.boxes) {
      b.spin += dt * 1.6;
      if (!b.on) { if ((b.t -= dt) <= 0) { b.on = true; b.pop = 1; } continue; }
      for (const r of live) if (!r.item && !r.roll && Math.abs(this.wrap(r.s - b.s)) < 0.9 && Math.abs(r.d - b.d) < 0.85) {
        b.on = false; b.t = 1.8; this.giveItem(lab, r);
        if (!st.fast) { const p = this.pos(b.s, b.d); lab.burst(lab.v3(p.x, 0.8, p.z), { count: 10, colors: ['#ff6ad5', '#5fe0ff', '#ffd23f'], speed: 4, size: 0.16 }); }
        break;
      }
    }
    for (const c of st.coins) {
      if (!c.on) { if ((c.t -= dt) <= 0) c.on = true; continue; }
      for (const r of live) if (Math.abs(this.wrap(r.s - c.s)) < 0.8 && Math.abs(r.d - c.d) < 0.85) {
        c.on = false; c.t = 6; r.coins = Math.min(10, r.coins + 1);
        if (r.human) {
          st.coinsTaken++; lab.count('монеты'); this.addScore(lab, r, 10);
          if (!st.fast) { lab.tone(988 * Math.pow(2, r.coins / 24), 0.08, 'square', 0.04, 1318 * Math.pow(2, r.coins / 24)); const p = this.pos(c.s, c.d); lab.burst(lab.v3(p.x, 0.8, p.z), { count: 6, color: '#ffd23f', speed: 3, size: 0.14 }); }
        }
        break;
      }
    }
    // корки на дороге
    for (const p of st.peels) {
      p.life -= dt; p.safe -= dt;
      for (const r of live) if (!(p.owner === r && p.safe > 0) && Math.abs(this.wrap(r.s - p.s)) < 0.8 && Math.abs(r.d - p.d) < 0.85) { this.hit(lab, r, 'peel', p.owner); p.life = 0; break; }
    }
    st.peels = st.peels.filter(p => p.life > 0);
    // тыквы летят по трассе, рой — по воздуху к цели
    for (const p of st.projs) {
      if (p.poster) continue;
      p.life -= dt;
      if (p.kind === 'pumpkin') {
        p.s = this.mod(p.s + 20 * dt);
        for (const r of live) { if (r === p.owner) continue; const ds = this.wrap(r.s - p.s); if (ds > -0.7 && ds < 1 && Math.abs(r.d - p.d) < 1) { this.hit(lab, r, 'pumpkin', p.owner); p.life = 0; if (!st.fast) lab.sfx.explode(); break; } }
      } else {
        const T = p.target;
        if (!T || T.finished) { p.life = 0; continue; }
        const dx = T.x - p.x, dz = T.z - p.z, d = Math.hypot(dx, dz), sp = 17 * dt;
        if (d < 1.1) { this.hit(lab, T, 'bees', p.owner); p.life = 0; continue; }
        p.x += dx / d * Math.min(sp, d); p.z += dz / d * Math.min(sp, d); p.y = lab.damp(p.y, d < 6 ? 1 : 2.4, 3, dt);
      }
    }
    st.dead = (st.dead || []).concat(st.projs.filter(p => p.life <= 0));
    st.projs = st.projs.filter(p => p.life > 0);
    // вариация «Рой к лидеру»: улей у трассы
    if (cfg.bees >= 1 && (st.hiveT -= dt) <= 0) {
      st.hiveT = 15;
      const L = st.order.find(o => !o.finished);
      if (L) { st.projs.push({ kind: 'bees', x: this.HIVE[0], y: 3, z: this.HIVE[1], target: L, owner: null, life: 12 }); if (!st.fast) { lab.tone(150, 0.8, 'sawtooth', 0.04, 210); lab.popup(lab.v3(this.HIVE[0], 4, this.HIVE[1]), 'Рой летит к лидеру!', '#ffe14d', 18); } }
    }
  },

  /* ---------- лидер, обгоны, финиш ---------- */
  leaderTick(lab) {
    const st = lab.state, cfg = lab.cfg, top = st.order[0], L = this.tr.L, laps = Math.round(cfg.laps);
    if (!st.leader) st.leader = top;
    else if (top !== st.leader && !st.leader.finished && (top.finished || top.prog > st.leader.prog + 0.8)) {
      st.leader = top;
      if (st.rt > 3) {
        st.changes++; st.decided = lab.clamp(Math.floor(top.prog / L) + 1, 1, laps); lab.count('смены лидера');
        if (!st.fast) { lab.popup(lab.v3(top.x, 3, top.z), top.human ? 'Ты лидер!' : `Лидер: ${top.name}`, top.human ? '#ffd23f' : '#ffffff', top.human ? 20 : 14); if (top.human) lab.tone(784, 0.2, 'triangle', 0.06, 988); }
      }
    }
    // обгоны игрока: пара «впереди / сзади» с запасом 0,6 м, чтобы бок о бок не считалось много раз
    for (const h of st.humans) {
      for (const o of st.racers) {
        if (o === h) continue;
        const rel = h.rel[o.n] || (o.prog > h.prog ? 'ahead' : 'behind');
        if (rel === 'ahead' && h.prog > o.prog + 0.6 && !o.finished) {
          h.rel[o.n] = 'behind';
          if (st.rt > 2.5) {
            st.overtakes++; st.streak++; st.bestStreak = Math.max(st.bestStreak, st.streak); lab.count('обгоны');
            const mult = Math.min(3, 1 + Math.floor(st.streak / 3));
            this.addScore(lab, h, 50 * mult, lab.v3(h.x, 2, h.z));
            lab.tone(660 * lab.pitch(st.streak), 0.1, 'triangle', 0.05, 880 * lab.pitch(st.streak));
            if (mult > 1) lab.popup(lab.v3(h.x, 2.8, h.z), `Серия обгонов ×${mult}`, '#7cf5a8', 15);
            st.crowdJump = 0.6;
          }
        } else if (rel === 'behind' && o.prog > h.prog + 0.6) h.rel[o.n] = 'ahead';
        else if (!h.rel[o.n]) h.rel[o.n] = rel;
      }
      const lap = Math.floor(h.prog / L) + 1;
      if (lap === laps && !st.finalLap && laps > 1) {
        st.finalLap = true;
        lab.popup(lab.v3(h.x, 3, h.z), 'Последний круг!', '#ffe680', 26);
        [523, 659, 784, 1046].forEach((f, i) => lab.tone(f, 0.16, 'square', 0.05, f, i * 0.12));
      }
    }
  },
  finishTick(lab) {
    const st = lab.state, L = this.tr.L, laps = Math.round(lab.cfg.laps);
    for (const r of st.racers) {
      if (r.finished || r.prog < laps * L) continue;
      r.finished = true; r.finishT = st.rt; st.finishers++;
      if (!st.firstFinish) st.firstFinish = st.rt;
      this.rank(lab);
      if (st.fast) continue;
      const at = lab.v3(r.x, 2.4, r.z);
      if (r.human) {
        const pl = r.place, col = this.PLACE_COL[Math.min(3, pl - 1)];
        lab.popup(at, `${pl} место!`, col, 34); lab.slowmo(0.7, 0.35);
        lab.burst(at, { count: 60, colors: ['#ffd23f', '#ff6ad5', '#5fe0ff', '#7cf5a8', '#ffffff'], speed: 10, size: 0.3 });
        if (pl <= 3) lab.sfx.win(); else lab.sfx.beep();
        this.addScore(lab, r, this.PLACE_PTS[pl - 1] || 0, lab.v3(r.x, 1.4, r.z));
        st.crowdJump = 1.5;
      } else { lab.popup(at, `${r.name}: ${r.place}`, '#ffffff', 13); lab.burst(at, { count: 12, colors: ['#ffffff', r.color], speed: 4, size: 0.16 }); }
    }
  },
  raceEnd(lab, dt) {
    const st = lab.state;
    if (st.raceOver) { if ((st.overT -= dt) <= 0 && !st.ended) this.endText(lab); return; }
    const humansDone = st.humans.length && st.humans.every(h => h.finished);
    const closed = st.firstFinish != null && st.rt - st.firstFinish >= lab.cfg.finishWait;
    if (humansDone || closed || st.racers.every(r => r.finished)) { this.saveResult(lab); st.raceOver = true; st.overT = humansDone ? 1.6 : 0.4; }
  },
  // итог заезда: место, разрыв первого и последнего (недоехавшим — по скорости), смены лидера, круг, на котором всё решилось
  saveResult(lab) {
    const st = lab.state, cfg = lab.cfg, L = this.tr.L, laps = Math.round(cfg.laps);
    if (st.resultSaved) return st.result;
    st.resultSaved = true;
    const times = st.racers.map(r => r.finished ? r.finishT : st.rt + (laps * L - r.prog) / Math.max(4, cfg.speed * (r.human ? 0.9 : r.k)));
    const gap = Math.max(...times) - Math.min(...times);
    this.rank(lab);
    st.result = { gap, changes: st.changes, decided: st.decided, winner: st.order[0] };
    if (!st.sim) {
      const h = st.humans[0];
      lab.stat('место', h.place); lab.stat('разрыв на финише, с', Math.round(gap * 10) / 10);
      lab.stat('смены лидера', st.changes); lab.stat('решилось на круге', st.decided);
    }
    return st.result;
  },
  endText(lab) {
    const st = lab.state, h = st.humans[0], N = st.racers.length;
    st.ended = true;
    if (st.duo) { const a = st.humans[0], b = st.humans[1]; return lab.win(a.place < b.place ? `Игрок 1 быстрее: ${a.place} и ${b.place} место` : `Игрок 2 быстрее: ${b.place} и ${a.place} место`); }
    if (h.place <= 3 && h.finished) lab.win(`${h.place} место из ${N}!`); else lab.gameOver(h.finished ? `${h.place} место из ${N}` : `Финиш закрылся: ${h.place} место из ${N}`);
  },
  addScore(lab, r, n, at) { // вдвоём у второго игрока свой счёт
    const st = lab.state;
    if (!r.human || st.fast) return;
    if (r.pi) { st.p2score = (st.p2score || 0) + n; if (at) lab.popup(at, '+' + n, '#5fe0ff'); } else lab.addScore(n, at);
  },

  /* ---------- автопрогон: заезды ботов в быстром времени ---------- */
  simTick(lab, dt) {
    const st = lab.state, S = st.S;
    if (S.done) { if ((S.doneT += dt) > 3.5 && !st.ended) { st.ended = true; lab.win(`Автопрогон: ${S.results.length} заездов`); } return; }
    S.acc += dt * S.k;
    let n = 0;
    while (S.acc >= S.h && n < 600) {
      this.step(lab, S.h); S.acc -= S.h; n++;
      if (st.racers.every(r => r.finished) || st.rt > 400) {
        const res = Object.assign({}, this.saveResult(lab));
        S.results.push(res);
        S.bars.push({ h: 0, to: res.gap, changes: res.changes, col: res.gap < 6 ? '#7cf5a8' : res.gap < 14 ? '#ffd23f' : '#ff5d4a' });
        lab.tone(440 + Math.min(600, res.gap * 30), 0.06, 'triangle', 0.04);
        if (S.results.length >= S.n) { this.simDone(lab); break; }
        this.newRace(lab, true);
      }
    }
    const lead = st.order[0];
    st.anchor.position.set(lead.x, 0, lead.z);
  },
  simAvg(lab) {
    const R = lab.state.S.results, n = Math.max(1, R.length), avg = f => R.reduce((a, r) => a + f(r), 0) / n;
    return { n: R.length, gap: avg(r => r.gap), changes: avg(r => r.changes), decided: avg(r => r.decided), maxGap: Math.max(0, ...R.map(r => r.gap)), early: R.filter(r => r.decided <= 1).length };
  },
  simDone(lab) {
    const st = lab.state, S = st.S, a = this.simAvg(lab);
    S.done = true;
    lab.stat('заездов', a.n); lab.stat('разрыв на финише, с', Math.round(a.gap * 10) / 10);
    lab.stat('смены лидера', Math.round(a.changes * 10) / 10); lab.stat('решилось на круге', Math.round(a.decided * 10) / 10);
    const wins = {}; S.results.forEach(r => { wins[r.winner.name] = (wins[r.winner.name] || 0) + 1; });
    S.wins = Object.entries(wins).sort((x, y) => y[1] - x[1]);
    lab.popup(lab.v3(0, 6, 5), 'Автопрогон готов!', '#ffe680', 30);
    lab.burst(lab.v3(0, 3, 5.5), { count: 50, colors: ['#ffd23f', '#7cf5a8', '#ffffff'], speed: 9, size: 0.26 });
    lab.sfx.win();
  },

  /* ---------- мир: осенняя ярмарка ---------- */
  scenery(lab, scene) {
    const T = lab.THREE, st = lab.state, t = this.tr, M = t.M, W = t.W, cfg = lab.cfg;
    lab.ground({ w: 170, h: 140, color: '#4f8a36', bumps: 6, flat: 0.42 });
    const patch = lab.instances(new T.CircleGeometry(1, 9).rotateX(-Math.PI / 2), '#ffffff', 70, { shadow: false });
    for (let i = 0; i < 70; i++) lab.place(patch, i, [lab.rand(-34, 34), 0.012, lab.rand(-24, 22)], { scale: [lab.rand(1.5, 4), 1, lab.rand(1.2, 3)], rot: lab.rand(0, 3), color: lab.pick(['#5a963c', '#66a446', '#4a8233', '#7aa84a']) });
    // дорога лентой: обочина, кромка, середина темнее — по ней видно гоночную линию
    const cols = [-W / 2 - 0.7, -W / 2, -0.9, 0.9, W / 2, W / 2 + 0.7], cc = ['#8fae58', '#e6b57c', '#cf9558', '#cf9558', '#e6b57c', '#8fae58'].map(c => new T.Color(c));
    const pos = [], col = [], ind = [], nC = cols.length;
    for (let i = 0; i <= M; i++) {
      const k = i % M, shade = 1 + (Math.floor(i / 16) % 2 ? 0.035 : -0.02);
      cols.forEach((d, c) => { pos.push(t.px[k] + t.nx[k] * d, 0.03, t.pz[k] + t.nz[k] * d); const x = cc[c]; col.push(x.r * shade, x.g * shade, x.b * shade); });
      if (i < M) for (let c = 0; c < nC - 1; c++) { const a = i * nC + c, b = a + nC; ind.push(a, a + 1, b, b, a + 1, b + 1); }
    }
    const g = new T.BufferGeometry(); g.setAttribute('position', new T.Float32BufferAttribute(pos, 3)); g.setAttribute('color', new T.Float32BufferAttribute(col, 3)); g.setIndex(ind); g.computeVertexNormals();
    const road = lab.mesh(g, new T.MeshStandardMaterial({ vertexColors: true, roughness: 1, flatShading: true, side: T.DoubleSide }), { shadow: false });
    road.receiveShadow = true;
    // красно-белые бордюры в поворотах
    const kerb = lab.instances(new T.BoxGeometry(0.42, 0.08, 1), '#ffffff', 460, { shadow: false });
    let nk = 0;
    for (let i = 0; i < M && nk < 458; i += 4) {
      if (Math.abs(t.curv[i]) < 0.045) continue;
      const h = Math.atan2(t.tx[i], t.tz[i]);
      for (const sg of [-1, 1]) lab.place(kerb, nk++, [t.px[i] + t.nx[i] * sg * (W / 2 + 0.05), 0.05, t.pz[i] + t.nz[i] * sg * (W / 2 + 0.05)], { rot: h, color: (i / 4) % 2 ? '#e2433b' : '#fff4e6' });
    }
    kerb.count = nk;
    // тюки сена вдоль бортов (с разрывом у срезки)
    const bale = lab.instances(new T.BoxGeometry(1.5, 0.75, 0.8), '#ffffff', 170), strap = lab.instances(new T.BoxGeometry(0.08, 0.77, 0.82), '#8a5a22', 340, { shadow: false });
    let nb = 0;
    const cutOn = cfg.shortcut >= 1;
    for (let i = 0; i < M && nb < 170; i += 10) {
      const h = Math.atan2(t.tx[i], t.tz[i]);
      for (const sg of [-1, 1]) {
        const x = t.px[i] + t.nx[i] * sg * (W / 2 + 0.85), z = t.pz[i] + t.nz[i] * sg * (W / 2 + 0.85);
        if (Math.abs(x - this.FINISH[0]) < 1.2 && Math.abs(z - this.FINISH[1]) < 5) continue; // столбы арки финиша
        if (cutOn) { const c = this.chordOf(x, z); if (c.k > -0.08 && c.k < 1.08 && c.dist < 3.4) continue; }
        if (nb >= 170) break;
        lab.place(bale, nb, [x, 0.38, z], { rot: h + lab.rand(-0.08, 0.08), color: lab.pick(['#e3b04b', '#d9a23e', '#ecbf5e']) });
        for (const o of [-0.4, 0.4]) lab.place(strap, nb * 2 + (o > 0 ? 1 : 0), [x + Math.sin(h) * o, 0.38, z + Math.cos(h) * o], { rot: h });
        nb++;
      }
    }
    bale.count = nb; strap.count = nb * 2;
    // финиш: шахматная полоса и арка с огнями старта
    const chk = lab.instances(new T.BoxGeometry(0.55, 0.04, 0.55), '#ffffff', 24, { shadow: false }), h0 = this.headAt(0);
    for (let a = 0; a < 12; a++) for (let b = 0; b < 2; b++) {
      const d = -W / 2 + 0.275 + a * 0.55, s = (b - 0.5) * 0.55, p = this.pos(s, d);
      lab.place(chk, a * 2 + b, [p.x, 0.05, p.z], { rot: h0, color: (a + b) % 2 ? '#1b1b24' : '#ffffff' });
    }
    const arch = [], pl = this.pos(0, -W / 2 - 0.6), pr = this.pos(0, W / 2 + 0.6), mid = this.pos(0, 0);
    for (const p of [pl, pr]) arch.push(lab.cyl(0.18, 0.22, 4.4, '#7a4a2a', { at: [p.x, 2.2, p.z], sides: 6 }));
    arch.push(lab.box(W + 1.6, 0.9, 0.25, '#c4472f', { at: [mid.x, 4.2, mid.z], rot: h0 + Math.PI / 2 }));
    lab.merge(arch);
    const tex = this.textTex(lab, 'ФИНИШ', '#fff4e6', '#c4472f', 256, 64);
    lab.mesh(new T.PlaneGeometry(4, 1), new T.MeshBasicMaterial({ map: tex, transparent: true }), { at: [mid.x, 4.2, mid.z + 0.14], rot: 0, shadow: false });
    st.lamps = [0, 1, 2].map(i => lab.mesh(new T.IcosahedronGeometry(0.22, 1), new T.MeshStandardMaterial({ color: '#331111', emissive: '#000000' }), { at: [mid.x - 1 + i, 3.45, mid.z + 0.2], shadow: false }));
    // мостик над ручьём на левой прямой и сам ручей
    const water = lab.mat('#3fa9e0', { shiny: true, smooth: true });
    st.water = water;
    const crossS = this.proj(-23.4, 1, 0, true).s, cp = this.pos(crossS, 0), ch = this.headAt(crossS);
    lab.mesh(new T.PlaneGeometry(30, 1.8).rotateX(-Math.PI / 2), water, { at: [cp.x - 8, 0.02, cp.z], shadow: false }).receiveShadow = true;
    const plank = lab.instances(new T.BoxGeometry(W + 1.2, 0.1, 0.32), '#a0703c', 8);
    for (let k = 0; k < 8; k++) { const p = this.pos(crossS - 1.4 + k * 0.4, 0); lab.place(plank, k, [p.x, 0.06, p.z], { rot: ch + Math.PI / 2, color: k % 2 ? '#a0703c' : '#8a5e30' }); }
    // пруд в петле у дальней прямой, ручей к горам, срезка — мостик через ручей
    lab.mesh(new T.CircleGeometry(1, 20).rotateX(-Math.PI / 2), water, { at: [0, 0.025, -8.6], scale: [2.3, 1, 3.4], shadow: false });
    lab.mesh(new T.PlaneGeometry(1.8, 40).rotateX(-Math.PI / 2), water, { at: [0, 0.02, -30], shadow: false });
    const reed = lab.instances(new T.ConeGeometry(0.06, 0.9, 4), '#6b8a3a', 40, { shadow: false });
    for (let i = 0; i < 40; i++) { const a = lab.rand(0, 6.28); lab.place(reed, i, [Math.cos(a) * 2.5 + lab.rand(-0.2, 0.2), 0.4, -8.6 + Math.sin(a) * 3.6], { scale: [1, lab.rand(0.7, 1.4), 1] }); }
    if (cutOn) {
      const ax = t.B.x - t.A.x, az = t.B.z - t.A.z, ang = Math.atan2(ax, az), mx = (t.A.x + t.B.x) / 2, mz = (t.A.z + t.B.z) / 2;
      lab.box(t.chord + 1, 0.06, 5.4, '#6b4a2e', { at: [mx, 0.035, mz], rot: ang + Math.PI / 2, shadow: false }); // грязь вокруг мостика
      lab.box(t.chord + 1, 0.12, 2.2, '#c08850', { at: [mx, 0.07, mz], rot: ang + Math.PI / 2 }); // мостик
      const rail = lab.instances(new T.CylinderGeometry(0.06, 0.06, 0.6, 4), '#7a4a2a', 20);
      for (let k = 0; k < 10; k++) for (const sg of [-1, 1]) { const kk = k / 9; lab.place(rail, k * 2 + (sg > 0 ? 1 : 0), [t.A.x + ax * kk - az / t.chord * 1.15 * sg, 0.35, t.A.z + az * kk + ax / t.chord * 1.15 * sg]); }
    }
    // осенние деревья вокруг, лотки, толпа, флажки, карусель, колесо обозрения, улей
    const far = (x, z, m) => this.proj(x, z, 0, true).dist > W / 2 + m;
    const NT = 46, trunk = lab.instances(new T.CylinderGeometry(0.15, 0.22, 1.4, 5), '#6b4a2e', NT), crown = lab.instances(new T.IcosahedronGeometry(1, 0), '#ffffff', NT);
    for (let i = 0, n = 0; n < NT && i < 400; i++) {
      const x = lab.rand(-36, 36), z = lab.rand(-26, 16);
      if (!far(x, z, 3) || (Math.abs(x) < 3 && z < -10) || (z > 15.5 && Math.abs(x) < 26) || (Math.hypot(x + 11.5, z - 1) < 4.5) || (Math.abs(x - 14.5) < 4 && Math.abs(z + 3) < 3.5) || (z > 3 && z < 8 && Math.abs(x) < 11)) continue;
      const s = lab.rand(0.8, 1.4);
      lab.place(trunk, n, [x, 0.7 * s, z], { scale: s });
      lab.place(crown, n, [x, 1.9 * s, z], { scale: [1.2 * s, 1.35 * s, 1.2 * s], rot: lab.rand(0, 3), color: lab.pick(['#e8892b', '#f2c14e', '#c4472f', '#e0a030', '#9bbf4a']) });
      n++;
    }
    this.stalls(lab);
    this.carousel(lab, -11.5, 1);
    this.wheel(lab, -31, -18);
    // зрители у нижней прямой
    const NC = 64; st.crowd = [];
    st.crowdBody = lab.instances(new T.CylinderGeometry(0.22, 0.3, 0.8, 6), '#ffffff', NC);
    st.crowdHead = lab.instances(new T.IcosahedronGeometry(0.2, 1), '#f0c8a0', NC);
    st.crowdBody.frustumCulled = st.crowdHead.frustumCulled = false;
    for (let i = 0; i < NC; i++) {
      const row = i % 2, x = -20 + (i >> 1) * 1.15 + lab.rand(-0.2, 0.2), z = 18 + row * 1.1 + lab.rand(-0.15, 0.15);
      st.crowd.push({ x, z, ph: lab.rand(0, 6), y0: row * 0.25 });
      st.crowdBody.setColorAt(i, this.tmp.C.set(lab.pick(['#c4472f', '#3d6bff', '#27b35a', '#ffd23f', '#8d4dff', '#f4efe4', '#ff8a1f'])));
    }
    lab.merge([lab.box(42, 0.25, 1.2, '#8a5e30', { at: [-2, 0.12, 18] }), lab.box(42, 0.5, 1.2, '#7a5230', { at: [-2, 0.25, 19.1] })]); // помост для зрителей
    // гирлянда флажков над нижней прямой снаружи
    st.flags = [];
    const NF = 80, poles = [];
    st.flagInst = lab.instances(new T.ConeGeometry(0.22, 0.42, 3), '#ffffff', NF, { shadow: false });
    st.flagInst.frustumCulled = false;
    for (let k = 0; k <= 8; k++) poles.push(lab.cyl(0.06, 0.08, 3.2, '#6b4a2e', { at: [-20 + k * 4.6, 1.6, 16.9], sides: 5 }));
    lab.merge(poles);
    for (let i = 0; i < NF; i++) {
      const u = i / (NF - 1) * 8, k = Math.floor(u), f = u - k, x = -20 + u * 4.6, y = 3.05 - Math.sin(f * Math.PI) * 0.55;
      st.flags.push({ x, y, z: 16.9, ph: i * 0.7 });
      st.flagInst.setColorAt(i, this.tmp.C.set(['#e2433b', '#ffd23f', '#3d6bff', '#27b35a', '#ff6ad5', '#fff4e6'][i % 6]));
    }
    // воздушные шары улетают в небо
    st.balloons = [...Array(10)].map(() => ({ x: lab.rand(-24, 24), y: lab.rand(-2, 14), z: lab.rand(14, 20), v: lab.rand(0.6, 1.1), ph: lab.rand(0, 6) }));
    st.balloonInst = lab.instances(new T.IcosahedronGeometry(0.35, 1), '#ffffff', 10, { shadow: false });
    st.balloonInst.frustumCulled = false;
    st.balloons.forEach((b, i) => st.balloonInst.setColorAt(i, this.tmp.C.set(['#ff4d6a', '#ffd23f', '#5fe0ff', '#7cf5a8', '#ff8a1f'][i % 5])));
    // улей вариации «Рой к лидеру»
    if (cfg.bees >= 1) {
      const [hx, hz] = this.HIVE;
      lab.merge([lab.cyl(0.12, 0.14, 1.6, '#6b4a2e', { at: [hx, 0.8, hz], sides: 5 }), lab.cyl(0.9, 0.7, 1.2, '#e3b04b', { at: [hx, 2.1, hz], sides: 9 }), lab.cone(1, 0.8, '#c98a2e', { at: [hx, 3.1, hz], sides: 9 })]);
    }
    // горы Кавказа на горизонте со снежными шапками
    const hills = [];
    for (let i = 0; i < 16; i++) {
      const x = -70 + i * 9.5 + lab.rand(-3, 3), r = lab.rand(7, 12), h = lab.rand(8, 15), z = -58 + lab.rand(-6, 4);
      hills.push(lab.cone(r, h, i % 2 ? '#6b86b8' : '#7b93c2', { at: [x, h / 2 - 1, z], sides: 6, rot: lab.rand(0, 3) }));
      hills.push(lab.cone(r * 0.32, h * 0.3, '#f4f6ff', { at: [x, h - 1 - h * 0.15 + 0.05, z], sides: 6, rot: lab.rand(0, 3) }));
    }
    lab.noShadow(lab.merge(hills));
    // облака плывут
    const puffs = [];
    for (let i = 0; i < 7; i++) { const cx = -66 + i * 22, cy = lab.rand(14, 20), cz = lab.rand(-48, -36); for (let k = 0; k < 4; k++) puffs.push(lab.ball(lab.rand(1.6, 2.8), '#ffffff', { at: [cx + k * 2 - 3, cy + lab.rand(-0.4, 0.6), cz + lab.rand(-0.5, 0.5)], detail: 0 })); }
    st.clouds = lab.noShadow(lab.merge(puffs));
  },
  // полосатые лотки с сыром, тыквами и яблоками
  stalls(lab) {
    const parts = [], spots = [[14.5, -4.5, 0.2], [15.5, -0.8, -0.1], [-17, 17.2, 0], [9, 17.6, 0], [28, 2, 1.57], [-30, -2, -1.57], [12, -20, 3.1]];
    spots.forEach(([x, z, r], n) => {
      const g = lab.group({ at: [x, 0, z], rot: r }), A = ['#e2433b', '#3d6bff', '#27b35a', '#8d4dff', '#ff8a1f'][n % 5];
      lab.box(2.6, 0.8, 1.1, '#a0703c', { parent: g, at: [0, 0.4, 0] });
      for (const [px, pz] of [[-1.2, -0.5], [1.2, -0.5], [-1.2, 0.5], [1.2, 0.5]]) lab.box(0.1, 2.2, 0.1, '#6b4a2e', { parent: g, at: [px, 1.1, pz] });
      for (let k = 0; k < 5; k++) lab.box(0.56, 0.1, 1.5, k % 2 ? '#fff4e6' : A, { parent: g, at: [-1.12 + k * 0.56, 2.25, 0], rot: [0.18, 0, 0] });
      for (let k = 0; k < 4; k++) lab.cyl(0.26, 0.26, 0.2, '#f6e7a8', { parent: g, at: [-0.9 + k * 0.6, 0.9, 0.1], sides: 10 });
      for (let k = 0; k < 3; k++) lab.ball(0.22, n % 2 ? '#ff8a1f' : '#d8263a', { parent: g, at: [lab.rand(-1, 1), 0.92, -0.35], detail: 0 });
      parts.push(g);
    });
    lab.merge(parts);
    // тыквы горкой и скирда в середине поля
    lab.merge([lab.cone(2, 2.2, '#d9a23e', { at: [2.5, 1.1, 2.6], sides: 8 }), lab.cone(1.2, 1, '#c98a2e', { at: [2.5, 2.4, 2.6], sides: 8 })]);
    const pumpkin = lab.instances(new lab.THREE.IcosahedronGeometry(0.4, 1), '#ff8a1f', 14);
    for (let i = 0; i < 14; i++) lab.place(pumpkin, i, [-3 + (i % 5) * 0.8 + lab.rand(-0.1, 0.1), 0.32 + (i >= 10 ? 0.55 : i >= 5 ? 0.25 : 0), 2.5 + Math.floor(i / 5) * 0.3], { scale: [1.2, 0.85, 1.2], color: i % 4 ? '#ff8a1f' : '#ffb12e' });
  },
  carousel(lab, x, z) {
    const T = lab.THREE, st = lab.state;
    lab.merge([lab.cyl(2.9, 3, 0.35, '#c4472f', { at: [x, 0.17, z], sides: 14 }), lab.cyl(0.18, 0.18, 3.4, '#ffd23f', { at: [x, 1.9, z], sides: 8, metal: 0.4 })]);
    const top = lab.group({ at: [0, 0, 0] }); // строим у начала координат, сливаем и ставим на место: крутится вокруг своей оси
    lab.cone(3.3, 1.4, '#fff4e6', { parent: top, at: [0, 4.2, 0], sides: 12 });
    for (let k = 0; k < 6; k++) lab.box(0.6, 0.2, 3.2, '#e2433b', { parent: top, at: [Math.sin(k * 1.047) * 1.55, 4.0, Math.cos(k * 1.047) * 1.55], rot: [0.42, k * 1.047, 0] });
    lab.ball(0.3, '#ffd23f', { parent: top, at: [0, 5.05, 0], glow: 0.6 });
    const roof = lab.merge(top); roof.position.set(x, 0, z);
    st.caro = { top: roof, x, z, horses: lab.instances(new T.BoxGeometry(0.35, 0.5, 1), '#ffffff', 8), rods: lab.instances(new T.CylinderGeometry(0.04, 0.04, 3.4, 4), '#ffd23f', 8, { shadow: false }) };
    st.caro.horses.frustumCulled = st.caro.rods.frustumCulled = false;
    for (let k = 0; k < 8; k++) st.caro.horses.setColorAt(k, this.tmp.C.set(['#fff4e6', '#5fe0ff', '#ff6ad5', '#ffd23f'][k % 4]));
  },
  wheel(lab, x, z) {
    const T = lab.THREE, st = lab.state, R = 6;
    lab.merge([lab.box(0.3, 7.5, 0.3, '#7a5a8a', { at: [x - 1.6, 3.6, z], rot: [0, 0, 0.22] }), lab.box(0.3, 7.5, 0.3, '#7a5a8a', { at: [x + 1.6, 3.6, z], rot: [0, 0, -0.22] })]);
    const g = lab.group({ at: [0, 0, 0] });
    lab.mesh(new T.TorusGeometry(R, 0.12, 5, 28), '#fff4e6', { parent: g });
    for (let k = 0; k < 8; k++) lab.box(0.08, R * 2, 0.08, '#fff4e6', { parent: g, rot: [0, 0, k * Math.PI / 8] });
    const ring = lab.merge(g); ring.position.set(x, 7.2, z + 0.4);
    st.ferris = { g: ring, x, z, R, cab: lab.instances(new T.BoxGeometry(0.9, 0.8, 0.9), '#ffffff', 8) };
    st.ferris.cab.frustumCulled = false;
    for (let k = 0; k < 8; k++) st.ferris.cab.setColorAt(k, this.tmp.C.set(['#e2433b', '#ffd23f', '#3d6bff', '#27b35a'][k % 4]));
  },
  textTex(lab, text, fg, bg, w, h) {
    const c = document.createElement('canvas'); c.width = w; c.height = h;
    const x = c.getContext('2d');
    if (bg) { x.fillStyle = bg; x.fillRect(0, 0, w, h); }
    x.fillStyle = fg; x.font = `900 ${Math.round(h * 0.7)}px sans-serif`; x.textAlign = 'center'; x.textBaseline = 'middle'; x.fillText(text, w / 2, h / 2 + 2);
    const t = new lab.THREE.CanvasTexture(c); t.colorSpace = lab.THREE.SRGBColorSpace;
    return t;
  },
  // мир живёт: карусель крутится, колесо обозрения, флажки на ветру, зрители подпрыгивают, шары летят, вода блестит
  life(lab, dt) {
    const st = lab.state, m = this.tmp.M, P = this.tmp.P, Q = this.tmp.Q, E = this.tmp.E, S = this.tmp.S, t = lab.t;
    const c = st.caro;
    c.top.rotation.y = t * 0.6;
    for (let k = 0; k < 8; k++) {
      const a = t * 0.6 + k * Math.PI / 4, y = 1.3 + Math.sin(t * 2.4 + k) * 0.3, x = c.x + Math.sin(a) * 2.2, z = c.z + Math.cos(a) * 2.2;
      E.set(0, a + Math.PI / 2, 0); m.compose(P.set(x, y, z), Q.setFromEuler(E), S.set(1, 1, 1)); c.horses.setMatrixAt(k, m);
      m.compose(P.set(x, 2.2, z), Q.identity(), S.set(1, 1, 1)); c.rods.setMatrixAt(k, m);
    }
    c.horses.instanceMatrix.needsUpdate = c.rods.instanceMatrix.needsUpdate = true;
    const F = st.ferris;
    F.g.rotation.z = t * 0.15;
    for (let k = 0; k < 8; k++) { const a = t * 0.15 + k * Math.PI / 4; m.compose(P.set(F.x + Math.cos(a) * F.R, 7.2 + Math.sin(a) * F.R - 0.5, F.z + 0.6), Q.identity(), S.set(1, 1, 1)); F.cab.setMatrixAt(k, m); }
    F.cab.instanceMatrix.needsUpdate = true;
    st.flags.forEach((f, i) => { E.set(Math.PI + Math.sin(t * 3 + f.ph) * 0.35, 0, 0); m.compose(P.set(f.x, f.y, f.z), Q.setFromEuler(E), S.set(1, 1, 0.25)); st.flagInst.setMatrixAt(i, m); });
    st.flagInst.instanceMatrix.needsUpdate = true;
    st.crowdJump = Math.max(0, st.crowdJump - dt);
    st.crowd.forEach((p, i) => {
      const y = p.y0 + (st.crowdJump > 0 ? Math.abs(Math.sin(t * 9 + p.ph)) * 0.35 : Math.abs(Math.sin(t * 1.5 + p.ph)) * 0.04);
      m.compose(P.set(p.x, 0.65 + y, p.z), Q.identity(), S.set(1, 1, 1)); st.crowdBody.setMatrixAt(i, m);
      m.compose(P.set(p.x, 1.25 + y, p.z), Q.identity(), S.set(1, 1, 1)); st.crowdHead.setMatrixAt(i, m);
    });
    st.crowdBody.instanceMatrix.needsUpdate = st.crowdHead.instanceMatrix.needsUpdate = true;
    st.balloons.forEach((b, i) => {
      b.y += b.v * dt; if (b.y > 22) { b.y = -1; b.x = lab.rand(-24, 24); }
      m.compose(P.set(b.x + Math.sin(t * 0.7 + b.ph) * 0.6, b.y, b.z), Q.identity(), S.set(1, 1.2, 1)); st.balloonInst.setMatrixAt(i, m);
    });
    st.balloonInst.instanceMatrix.needsUpdate = true;
    st.water.color.setHSL(0.55, 0.7, 0.55 + Math.sin(t * 1.4) * 0.04);
    st.clouds.position.x = Math.sin(t * 0.03) * 12;
    // огни старта
    const k = st.goStep;
    st.lamps.forEach((l, i) => {
      const on = !st.sim && st.go > 0 && k > i - 1 && k >= 0 && i <= k, green = !st.sim && st.go <= 0 && st.rt < 1.6;
      l.material.color.set(green ? '#7cf5a8' : on ? '#ff4d4d' : '#331111'); l.material.emissive.set(green ? '#3aff7a' : on ? '#ff2020' : '#000000');
    });
  },

  /* ---------- тележки: боты копиями (одна пачка на деталь), игроки — настоящими мешами ---------- */
  KART: [ // деталь, где, размер, цвет
    ['body', [0, 0.45, 0], [1.05, 0.42, 1.55], 'main'], ['trim', [0, 0.68, 0.02], [1.12, 0.08, 1.62], 'dark'],
    ['wheel', [-0.58, 0.27, 0.52]], ['wheel', [0.58, 0.27, 0.52]], ['wheel', [-0.58, 0.27, -0.52]], ['wheel', [0.58, 0.27, -0.52]],
    ['cheese', [0, 0.88, -0.38]], ['shirt', [0, 0.95, 0.24]], ['head', [0, 1.33, 0.24]], ['hat', [0, 1.5, 0.24]],
    ['pole', [-0.42, 1.18, -0.62]], ['flag', [-0.42, 1.6, -0.86]],
  ],
  buildKarts(lab) {
    const T = lab.THREE, st = lab.state, RB = lab.addons.RoundedBoxGeometry;
    const G = this.kartGeo = {
      body: new RB(1, 1, 1, 2, 0.12), trim: new T.BoxGeometry(1, 1, 1), wheel: new T.CylinderGeometry(0.27, 0.27, 0.2, 10).rotateZ(Math.PI / 2),
      cheese: new T.CylinderGeometry(0.33, 0.33, 0.28, 12), shirt: new T.CylinderGeometry(0.17, 0.24, 0.44, 7), head: new T.IcosahedronGeometry(0.19, 1),
      hat: new T.CylinderGeometry(0.2, 0.18, 0.17, 8), pole: new T.CylinderGeometry(0.03, 0.03, 1.1, 4), flag: new T.BoxGeometry(0.03, 0.32, 0.46),
    };
    const fixed = { wheel: '#3a2a1e', cheese: '#f6e7a8', head: '#f0c8a0', pole: '#6b4a2e' };
    this.partL = this.KART.map(([k, at, sc]) => new T.Matrix4().compose(new T.Vector3(...at), new T.Quaternion(), new T.Vector3(...(sc || [1, 1, 1]))));
    const N = 8, inst = {};
    for (const k in G) {
      const n = N * this.KART.filter(p => p[0] === k).length;
      inst[k] = lab.instances(G[k], fixed[k] || '#ffffff', n); inst[k].frustumCulled = false;
      inst[k].setColorAt(0, this.tmp.C.set('#ffffff')); inst[k].count = 0;
    }
    st.kInst = inst;
    // номера мест над тележками: круг цвета места и цифра
    st.numTex = [...Array(9)].map((_, i) => {
      const c = document.createElement('canvas'); c.width = c.height = 64; const x = c.getContext('2d');
      x.fillStyle = i ? this.PLACE_COL[Math.min(3, i - 1)] : '#ffffff'; x.beginPath(); x.arc(32, 32, 28, 0, 7); x.fill();
      x.lineWidth = 5; x.strokeStyle = '#1b1b24'; x.stroke(); x.fillStyle = '#1b1b24'; x.font = '900 40px sans-serif'; x.textAlign = 'center'; x.textBaseline = 'middle'; x.fillText(String(i), 32, 35);
      const t = new T.CanvasTexture(c); t.colorSpace = T.SRGBColorSpace; return t;
    });
    st.signs = [...Array(10)].map(() => { const s = new T.Sprite(new T.SpriteMaterial({ map: st.numTex[1], depthTest: false, transparent: true })); s.renderOrder = 5; s.scale.setScalar(0.95); s.userData.noShadow = true; s.visible = false; lab.add(s); return s; });
    // кольца под тележками: звёздочка, рывок, цель роя
    st.ringInst = lab.instances(new T.RingGeometry(0.85, 1.05, 24).rotateX(-Math.PI / 2), lab.mat('#ffffff', { unlit: true, add: true }), 10, { shadow: false });
    st.ringInst.setColorAt(0, this.tmp.C.set('#ffffff')); st.ringInst.frustumCulled = false;
    st.nutInst = lab.instances(new T.IcosahedronGeometry(0.16, 0), '#a0703c', 30, { shadow: false }); st.nutInst.frustumCulled = false;
  },
  // тележка игрока: те же детали, но меши — чтобы вспыхивала и сжималась; глаза, светящийся флажок, круг героя
  humanKart(lab, r) {
    const T = lab.THREE, g = lab.group({ at: [r.x, 0, r.z] }), body = lab.group({ parent: g }), dark = new T.Color(r.color).multiplyScalar(0.55).getStyle();
    const look = { main: r.color, dark, wheel: '#3a2a1e', cheese: '#f6e7a8', shirt: '#fff4e6', head: '#f0c8a0', hat: r.hat, pole: '#6b4a2e', flag: r.color };
    r.wheels = [];
    this.KART.forEach(([k, at, sc], i) => {
      const col = k === 'body' ? look.main : k === 'trim' ? look.dark : look[k];
      const m = lab.mesh(this.kartGeo[k], lab.mat(col, k === 'flag' ? { glow: 0.7 } : {}), { parent: body });
      m.matrixAutoUpdate = false; m.matrix.copy(this.partL[i]);
      if (k === 'wheel') r.wheels.push(m);
    });
    for (const sx of [-0.08, 0.08]) { lab.ball(0.055, '#ffffff', { parent: body, at: [sx, 1.37, 0.41], detail: 0, shadow: false }); lab.ball(0.03, '#111111', { parent: body, at: [sx, 1.37, 0.46], detail: 0, shadow: false }); }
    lab.mesh(new T.RingGeometry(0.95, 1.2, 28).rotateX(-Math.PI / 2), lab.mat(r.color, { unlit: true, glow: 0.8 }), { parent: g, at: [0, 0.05, 0], shadow: false });
    g.userData.kart = { g, body, wheels: r.wheels };
    return g;
  },
  buildItemLooks(lab) {
    const T = lab.THREE, st = lab.state;
    const q = this.textTex(lab, '?', '#1b1b24', '#ffffff', 64, 64);
    st.boxInst = lab.instances(new T.BoxGeometry(1.15, 1.15, 1.15), new T.MeshStandardMaterial({ map: q, emissive: '#ffffff', emissiveIntensity: 0.35, emissiveMap: q, roughness: 0.35 }), 8);
    st.boxInst.setColorAt(0, this.tmp.C.set('#ffffff')); st.boxInst.frustumCulled = false;
    st.coinInst = lab.instances(new T.CylinderGeometry(0.4, 0.4, 0.1, 14).rotateX(Math.PI / 2), lab.mat('#ffd23f', { glow: 0.8, metal: 0.5, shiny: true }), 24, { shadow: false }); st.coinInst.frustumCulled = false;
    st.peelInst = lab.instances(new T.CylinderGeometry(0.46, 0.46, 0.1, 10, 1, false, 0, Math.PI), '#ff4d6a', 24, { shadow: false });
    st.rindInst = lab.instances(new T.CylinderGeometry(0.54, 0.54, 0.07, 10, 1, false, 0, Math.PI), '#2f9e44', 24, { shadow: false });
    st.pumpInst = lab.instances(new T.IcosahedronGeometry(0.4, 1), lab.mat('#ff6a1f', { glow: 0.7 }), 16, { shadow: false });
    st.beeInst = lab.instances(new T.IcosahedronGeometry(0.11, 0), lab.mat('#ffe14d', { glow: 1.2 }), 60, { shadow: false });
    st.dotInst = lab.instances(new T.CircleGeometry(0.22, 10).rotateX(-Math.PI / 2), lab.mat('#ff3b30', { unlit: true, glow: 0.8 }), 40, { shadow: false });
    for (const m of [st.coinInst, st.peelInst, st.rindInst, st.pumpInst, st.beeInst, st.dotInst]) m.frustumCulled = false;
  },
  // столбики автопрогона: высота — разрыв на финише, шарики сверху — смены лидера
  buildBars(lab) {
    const T = lab.THREE, st = lab.state;
    if (!st.sim) return;
    lab.box(22, 0.2, 1.6, '#7a5230', { at: [1, 0.1, 5.7] });
    const ticks = [lab.box(22, 6.2, 0.15, '#2d3550', { at: [1, 3.1, 4.8] })];
    for (let k = 1; k <= 4; k++) ticks.push(lab.box(21.6, 0.05, 0.05, '#8a94b8', { at: [1, 0.2 + k * 5 * 0.28, 4.9] })); // черта каждые 5 с разрыва
    lab.merge(ticks);
    st.barInst = lab.instances(new T.BoxGeometry(0.7, 1, 0.7), '#ffffff', 40); st.barInst.frustumCulled = false; st.barInst.setColorAt(0, this.tmp.C.set('#ffffff'));
    st.leadInst = lab.instances(new T.IcosahedronGeometry(0.16, 0), lab.mat('#ffd23f', { glow: 0.6 }), 400, { shadow: false }); st.leadInst.frustumCulled = false;
  },

  /* ---------- отрисовка: всё из состояния гонки ---------- */
  render(lab, dt) {
    const st = lab.state, m = this.tmp.M, K = this.tmp.K, P = this.tmp.P, Q = this.tmp.Q, E = this.tmp.E, S = this.tmp.S, C = this.tmp.C, I = st.kInst, t = lab.t;
    for (const k in I) I[k].count = 0;
    let rings = 0, nuts = 0;
    const ring = (x, z, col, sc) => { if (rings >= 10) return; m.compose(P.set(x, 0.06, z), Q.identity(), S.set(sc, 1, sc)); st.ringInst.setMatrixAt(rings, m); st.ringInst.setColorAt(rings, C.set(col)); rings++; };
    const beeTargets = new Set(st.projs.filter(p => p.kind === 'bees' && p.target).map(p => p.target));
    st.racers.forEach((r, ri) => {
      const bob = Math.sin(t * 14 + r.bob) * 0.03 * Math.min(1, r.v / 4), y = bob + (r.stun > 0 ? Math.abs(Math.sin(r.stun * 6)) * 0.25 : 0);
      if (r.human) {
        if (!r.g) { st.hg = st.hg || []; if (!st.hg[r.pi]) { st.hg[r.pi] = this.humanKart(lab, r); if (r.pi === 0) lab.hero(st.hg[r.pi]); } Object.assign(r, st.hg[r.pi].userData.kart); }
        r.g.position.set(r.x, y, r.z); r.g.rotation.set(0, r.h + r.spinA, 0); r.body.rotation.z = r.lean;
        r.g.visible = !(r.pi === 0 && lab.blink());
        r.wheels.forEach(w => { w.rotation.x = 0; });
        if ((r.boost > 0 || r.turbo > 0 || r.star > 0) && !r.trail) r.trail = lab.trail(r.g, { color: r.star > 0 ? '#ffd23f' : '#ff9a3d', width: 0.5, length: 14, glow: 1 });
        if (r.trail && r.boost <= 0 && r.turbo <= 0 && r.star <= 0) { r.trail.dispose(); r.trail = null; }
      } else {
        E.set(0, r.h + r.spinA, r.lean); K.compose(P.set(r.x, y, r.z), Q.setFromEuler(E), S.set(1, 1, 1));
        this.KART.forEach(([k], i) => {
          const inst = I[k], n = inst.count++;
          m.multiplyMatrices(K, this.partL[i]);
          if (k === 'flag') m.multiply(this.tmp.R.makeRotationY(Math.sin(t * 8 + ri) * 0.25));
          inst.setMatrixAt(n, m);
          if (k === 'body' || k === 'flag') inst.setColorAt(n, C.set(r.color));
          else if (k === 'trim') inst.setColorAt(n, C.set(r.color).multiplyScalar(0.55));
          else if (k === 'shirt') inst.setColorAt(n, C.set('#fff4e6'));
          else if (k === 'hat') inst.setColorAt(n, C.set(r.hat));
          else inst.setColorAt(n, C.set('#ffffff'));
        });
      }
      if (r.star > 0) ring(r.x, r.z, ['#ffd23f', '#ff6ad5', '#5fe0ff', '#7cf5a8'][Math.floor(t * 12) % 4], 1.25);
      else if (r.boost > 0 || r.turbo > 0) ring(r.x, r.z, '#ff9a3d', 1.05);
      if (beeTargets.has(r)) ring(r.x, r.z, Math.floor(t * 8) % 2 ? '#ff3b30' : '#ffe14d', 1.4 + Math.sin(t * 10) * 0.1);
      for (let k = 0; k < r.nuts && nuts < 30; k++) { const a = t * 5 + k * 2.09; m.compose(P.set(r.x + Math.sin(a) * 1.1, 0.6, r.z + Math.cos(a) * 1.1), Q.identity(), S.set(1, 1, 1)); st.nutInst.setMatrixAt(nuts++, m); }
      const sg = st.signs[ri];
      if (sg) { sg.visible = true; sg.position.set(r.x, 2.35 + (r.human ? 0.2 : 0), r.z); sg.material.map = st.numTex[Math.min(8, r.place)]; sg.scale.setScalar(r.human ? 1.25 : 0.9); }
      if (!st.fast && r.v > 6 && lab.chance(dt * 6) && r.cut == null) lab.burst(this.backOf(r), { count: 1, colors: ['#e6c08a', '#d2a46a'], speed: 0.8, size: 0.32, life: 0.6, up: 0.6, gravity: -0.4 });
    });
    for (let i = st.racers.length; i < st.signs.length; i++) st.signs[i].visible = false;
    for (const k in I) { I[k].instanceMatrix.needsUpdate = true; if (I[k].instanceColor) I[k].instanceColor.needsUpdate = true; }
    st.ringInst.count = rings; st.ringInst.instanceMatrix.needsUpdate = true; if (st.ringInst.instanceColor) st.ringInst.instanceColor.needsUpdate = true;
    st.nutInst.count = nuts; st.nutInst.instanceMatrix.needsUpdate = true;
    // коробки, монеты, корки, тыквы, рой и его путь
    let n = 0;
    for (const b of st.boxes) {
      if (!b.on) continue;
      const p = this.pos(b.s, b.d); b.pop = Math.max(0, (b.pop || 0) - dt * 4);
      E.set(0.5, b.spin, 0.3); m.compose(P.set(p.x, 0.85 + Math.sin(t * 2 + b.spin) * 0.12, p.z), Q.setFromEuler(E), S.setScalar(1 - b.pop * 0.6 + Math.sin(b.pop * 9) * 0.2 * b.pop));
      st.boxInst.setMatrixAt(n, m); st.boxInst.setColorAt(n, C.setHSL((t * 0.15 + n * 0.13) % 1, 1, 0.55)); n++;
    }
    st.boxInst.count = n; st.boxInst.instanceMatrix.needsUpdate = true; if (st.boxInst.instanceColor) st.boxInst.instanceColor.needsUpdate = true;
    n = 0;
    for (const c of st.coins) { if (!c.on) continue; const p = this.pos(c.s, c.d); E.set(0, t * 3 + c.s, 0); m.compose(P.set(p.x, 0.55, p.z), Q.setFromEuler(E), S.set(1, 1, 1)); st.coinInst.setMatrixAt(n++, m); }
    st.coinInst.count = n; st.coinInst.instanceMatrix.needsUpdate = true;
    n = 0;
    for (const p of st.peels) { if (n >= 24) break; const q = this.pos(p.s, p.d); E.set(0, this.headAt(p.s) + Math.PI / 2, 0); Q.setFromEuler(E); m.compose(P.set(q.x, 0.08, q.z), Q, S.set(1, 1, 1)); st.peelInst.setMatrixAt(n, m); m.compose(P.set(q.x, 0.05, q.z), Q, S.set(1, 1, 1)); st.rindInst.setMatrixAt(n, m); n++; }
    st.peelInst.count = st.rindInst.count = n; st.peelInst.instanceMatrix.needsUpdate = st.rindInst.instanceMatrix.needsUpdate = true;
    let np = 0, nbee = 0, nd = 0;
    for (const p of st.projs) {
      if (p.kind === 'pumpkin' && np < 16) {
        const q = this.pos(p.s, p.d); E.set(t * 9, 0, 0); m.compose(P.set(q.x, 0.55, q.z), Q.setFromEuler(E), S.set(1, 0.85, 1)); st.pumpInst.setMatrixAt(np++, m);
        if (!st.fast) { if (!p.anchor) { p.anchor = lab.group({ at: [q.x, 0.55, q.z] }); p.tr = lab.trail(p.anchor, { color: '#ff6a1f', width: 0.35, length: 10, glow: 1 }); } p.anchor.position.set(q.x, 0.55, q.z); }
      }
      if (p.kind === 'bees') {
        for (let k = 0; k < 10 && nbee < 60; k++) { const a = t * 9 + k * 0.63; m.compose(P.set(p.x + Math.sin(a * 1.3) * 0.5, p.y + Math.sin(a * 2.1) * 0.3, p.z + Math.cos(a) * 0.5), Q.identity(), S.set(1, 1, 1)); st.beeInst.setMatrixAt(nbee++, m); }
        if (p.target) for (let k = 1; k <= 8 && nd < 40; k++) { const f = k / 9 + (t * 0.8 % 1) / 9; m.compose(P.set(lab.lerp(p.x, p.target.x, f), 0.07, lab.lerp(p.z, p.target.z, f)), Q.identity(), S.set(1, 1, 1)); st.dotInst.setMatrixAt(nd++, m); }
        if (!st.fast && lab.chance(dt * 6)) lab.tone(200 + lab.rand(0, 60), 0.08, 'sawtooth', 0.015);
      }
    }
    for (const p of st.dead || []) { if (p.tr) p.tr.dispose(); if (p.anchor) p.anchor.removeFromParent(); }
    st.dead = [];
    st.pumpInst.count = np; st.beeInst.count = nbee; st.dotInst.count = nd;
    st.pumpInst.instanceMatrix.needsUpdate = st.beeInst.instanceMatrix.needsUpdate = st.dotInst.instanceMatrix.needsUpdate = true;
    // столбики автопрогона
    if (st.barInst) {
      const B = st.S.bars, w = 20 / Math.max(20, st.S.n);
      let nl = 0;
      B.forEach((b, i) => {
        b.h = lab.damp(b.h, b.to, 6, dt || 0.016);
        const x = -9 + (i + 0.5) * (20 / st.S.n) * 1.0, h = Math.max(0.05, Math.min(5.8, b.h * 0.28));
        m.compose(P.set(x + 0.5, 0.2 + h / 2, 5.6), Q.identity(), S.set(w * 1.2, h, 1)); st.barInst.setMatrixAt(i, m); st.barInst.setColorAt(i, C.set(b.col));
        for (let k = 0; k < Math.min(10, b.changes) && nl < 400; k++) { m.compose(P.set(x + 0.5, 0.4 + k * 0.3, 6.4), Q.identity(), S.set(1, 1, 1)); st.leadInst.setMatrixAt(nl++, m); }
      });
      st.barInst.count = B.length; st.leadInst.count = nl;
      st.barInst.instanceMatrix.needsUpdate = st.leadInst.instanceMatrix.needsUpdate = true; if (st.barInst.instanceColor) st.barInst.instanceColor.needsUpdate = true;
    }
  },

  // живая камера: еле дышит, на последнем круге чуть наезжает на героя, от роя по лидеру — короткий толчок
  liveCamera(lab, dt) {
    const st = lab.state, v = lab.view, C = st.cam;
    if (!v || !C || st.posterOn) return;
    if (Math.abs(v.distance - C.last) > 0.01) C.d = v.distance / C.k;
    const h = st.humans && st.humans[0], close = st.finalLap && h && !h.finished && !st.duo;
    C.punch = Math.max(0, C.punch - dt * 1.6);
    C.k = lab.damp(C.k, (close ? 0.9 : 1) * (1 - 0.05 * C.punch) * (1 + Math.sin(lab.t * 0.4) * 0.006), 1.5, dt);
    v.distance = C.d * C.k; C.last = v.distance;
    const tx = C.tx + (close ? (h.x - C.tx) * 0.18 : 0) + Math.sin(lab.t * 0.3) * 0.25, tz = C.tz + (close ? (h.z - C.tz) * 0.15 : 0);
    v.target.set(lab.damp(v.target.x, tx, 1.5, dt), 0, lab.damp(v.target.z, tz, 1.5, dt));
    v.tilt = lab.damp(v.tilt, C.tilt, 2, dt);
  },

  hudLines(lab) {
    const st = lab.state, cfg = lab.cfg, v = this.variant(lab), laps = Math.round(cfg.laps), L = this.tr.L;
    lab.hud('rule', `${v.name}: ${v.how}`, { color: '#ffe680', size: 14 });
    if (st.sim) {
      const S = st.S, a = this.simAvg(lab);
      lab.hud('sim', S.done ? `Готово: ${a.n} заездов` : `Заезд ${S.results.length + 1} из ${S.n} · лидер: ${st.order[0].name}`, { color: '#ffffff', size: 18 });
      lab.hud('gap', a.n ? `Разрыв на финише: в среднем ${a.gap.toFixed(1)} с (наибольший ${a.maxGap.toFixed(1)} с)` : 'Столбик — разрыв первого и последнего на финише', { color: '#ffd23f', size: 15 });
      lab.hud('lead', a.n ? `Смен лидера за заезд: ${a.changes.toFixed(1)} · решилось на ${a.decided.toFixed(1)}-м круге из ${laps}` : 'Шарики — сколько раз менялся лидер', { color: '#7cf5a8', size: 15 });
      lab.hud('wins', S.done && S.wins ? 'Победы: ' + S.wins.slice(0, 4).map(([n, k]) => `${n} ${k}`).join(' · ') : null, { color: '#c8ecff', size: 14 });
      return;
    }
    const h = st.humans[0], N = st.racers.length, col = this.PLACE_COL[Math.min(3, h.place - 1)];
    lab.hud('place', st.duo ? `Игрок 1: ${st.humans[0].place} место · Игрок 2: ${st.humans[1].place} место, очки ${st.p2score || 0}` : `${h.place} место из ${N}`, { color: st.duo ? '#ffffff' : col, size: st.duo ? 18 : 26 });
    const lap = Math.min(laps, Math.max(1, Math.floor(h.prog / L) + 1)), tm = st.rt, mm = Math.floor(tm / 60), ss = (tm % 60).toFixed(1).padStart(4, '0');
    lab.hud('lap', st.go > 0 ? 'Приготовься…' : `Круг ${lap}/${laps} · ${mm}:${ss}`, { color: '#ffffff', size: 16 });
    for (const r of st.humans) {
      const key = 'item' + r.pi, who = st.duo ? (r.pi ? 'Игрок 2 · ' : 'Игрок 1 · ') : '';
      let text = null;
      if (r.roll > 0) text = `${who}🎁 ${this.ITEMS[this.KEYS[Math.floor(lab.t * 14) % 6]].icon} …`;
      else if (r.item) { const I = this.ITEMS[r.item]; text = `${who}${I.icon} ${I.name} — жми A: ${I.tip}`; }
      lab.hud(key, text, { color: r.pi ? '#5fe0ff' : '#ff9ad0', size: 16 });
    }
    lab.hud('coins', cfg.snowball > 0 ? `🪙 ${h.coins}/10 · скорость +${Math.round(2.4 * cfg.snowball * h.coins)}%` : null, { color: '#ffd23f', size: 14 });
    const bees = st.projs.find(p => p.kind === 'bees' && p.target && p.target.human && !p.poster);
    const pump = st.projs.find(p => p.kind === 'pumpkin' && st.humans.some(r => { const ds = this.wrap(r.s - p.s); return ds > 0 && ds < 14 && Math.abs(r.d - p.d) < 1.5; }));
    lab.hud('warn', bees ? '🐝 Рой летит к тебе!' : pump ? '🎃 Тыква сзади!' : h.wrongT > 1.2 ? '↺ Не туда! Разворачивайся' : null, { color: '#ff5d4a', size: 18 });
    const mult = Math.min(3, 1 + Math.floor(st.streak / 3));
    lab.hud('streak', st.streak >= 2 ? `Обгонов подряд: ${st.streak}` + (mult > 1 ? ` · очки ×${mult}` : '') : null, { color: '#7cf5a8', size: 14 });
    lab.hud('top', st.order.slice(0, 3).map(r => `${r.place}. ${r.name}`).join('   '), { color: '#c8ecff', size: 13 });
    const close = st.firstFinish != null && !st.raceOver ? Math.max(0, Math.ceil(cfg.finishWait - (st.rt - st.firstFinish))) : null;
    lab.hud('close', close != null && !h.finished ? `🏁 Финиш закроется через ${close} с` : null, { color: '#ffb35c', size: 16 });
  },

  overNote(lab) {
    const st = lab.state, v = this.variant(lab), out = [`Вариация: ${v.name} (как ${v.like}) — ${v.how}`];
    if (st.sim) {
      const a = this.simAvg(lab);
      out.push(`Автопрогон: ${a.n} заездов. Разрыв первого и последнего на финише — в среднем ${a.gap.toFixed(1)} с, наибольший ${a.maxGap.toFixed(1)} с`);
      out.push(`Лидер менялся в среднем ${a.changes.toFixed(1)} раза за заезд; всё решилось уже на первом круге в ${a.early} заездах из ${a.n}`);
      if (st.S.wins) out.push('Победы: ' + st.S.wins.map(([n, k]) => `${n} — ${k}`).join(', '));
      out.push(`Петли: снежный ком ${lab.cfg.snowball}, помощь отстающему ${lab.cfg.rubber}, гостинцы по месту — ${lab.cfg.secret >= 1 ? 'да' : 'нет'}`);
      return out;
    }
    const h = st.humans[0], r = st.result || { gap: 0, changes: st.changes, decided: st.decided };
    out.push(`Место: ${h.place} из ${st.racers.length}${h.finished ? '' : ' (финиш закрылся раньше)'} · обгонов ${st.overtakes}, лучшая серия ${st.bestStreak}`);
    out.push(`Разрыв первого и последнего на финише: ${r.gap.toFixed(1)} с · лидер менялся ${r.changes} раз · решилось на ${r.decided}-м круге`);
    out.push(`Гостинцев применено: ${st.itemsUsed}, попаданий по соседям ${st.hitsGiven} (по лидеру ${st.hitsLeader}), по тебе ${st.hitsTaken}` + (lab.cfg.snowball > 0 ? ` · монет ${st.coinsTaken}` : ''));
    if (lab.cfg.secret <= 0) out.push('Спрятанная механика выключена: гостинцы всем одинаковые. Отстающие догоняли реже?');
    return out;
  },
};
function lab_clamp(v, a, b) { return Math.max(a, Math.min(b, v)); }
function lab_v(x, y, z) { return { x, y, z }; }
