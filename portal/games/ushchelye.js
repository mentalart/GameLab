// «Ущелье» — ремейк-донор урока 9 по мотивам механики Subway Surfers и Temple Run, на оболочке «Лаб3D 1.0» (three.js).
// Спрятанная механика донора: поток. Трудность идёт пилой — участок растёт к пику, потом передышка без препятствий, и только
// после неё скорость прибавляется ступенью; база каждого участка выше прошлой. Ручка «Спрятанная механика: кривая с передышками»,
// 0 — ровный подъём с тем же средним (урок 9: поток, скука и тревога, кривая сложности).
// Лучшие игры жанра, из которых взяты моменты (разбор — docs/01_Журнал_курса.md, урок 9):
//   Subway Surfers — три полосы, «прыгни, пригнись, уйди в сторону», монеты линиями ведут под поезд, поезда навстречу,
//            ховерборд прощает один удар — здесь подковы, арбы и бурка;
//   Temple Run — погоня за спиной: споткнулся — демоны ближе, второй раз — догнали; здесь лавина в ущелье;
//   Canabalt — скорость растёт без предела, одна ошибка — конец: вариации «Разгон без предела» и «Одна ошибка»;
//   Jetpack Joyride — опасность предупреждена заранее: здесь круг камнепада горит на полосе задолго до удара;
//   Alto's Adventure — живой мир вокруг трассы и музыка, которая дышит вместе с партией: топот копыт и барабан частят
//            вместе с трудностью и стихают на передышке;
//   Geometry Dash — у каждой преграды свой силуэт: с первого взгляда ясно, прыгать или пригибаться.
// Герой стоит на месте (z = 0, смотрит в −Z), ущелье несётся навстречу: декор живёт в группе world, её z — пройденные метры.
/* ПЛАН
   Фраза игры: ты — юный нарт на белом коне, ты скачешь по дну Хаджохского ущелья вдоль реки Белой, но тропа полна брёвен,
   низких перекладин, арб и камнепадов, а конь всё быстрее. Цель — проскакать как можно дальше и собрать подковы.
   Ядро на 3 секунды: видишь бревно → жмёшь ↑ → конь перелетает, приземляется с пылью, подковы над бревном звенят выше и выше.
   Выбор, оплаченный очками: подковы ведут к преграде — держаться на их полосе до последнего мига (впритык +50) или уйти заранее;
   серия подков без удара умножает очки ×2…×5, удар её срывает.
   Угрозы: бревно (низкое — прыгай), перекладина с кистями (низко над головой — пригнись), арба (высокая — уйди с полосы),
   камнепад (круг горит на полосе, камень падает за секунду до тебя), встречная арба с фонарями (едет на тебя).
   Кривая партии: 0–8 с — учёба: только подковы змейкой, первый удар невозможен; 8 с — первое бревно; 14 с — перекладины;
   22 с — арбы; 42 с — камнепад; 75 с — встречные арбы; дальше быстрее и гуще, пока не ошибёшься.
   События: прыжок и приземление, подкат, подкова (звон выше по серии), впритык, удар (обломки, тряска), серия ×N и её срыв,
   «Быстрее!» (камера отъезжает, ветер), камнепад (тень, круг, грохот), встречная арба (колокольчик), бурка, лавина.
   Лицо игры: летнее утро в узком ущелье — тёплые охристые скалы, бирюзовая река, изумрудный мох, золото подков.
   Палитра: скалы #c98a5e #b0705a, мох #5d9e3f, река #27a9b8, тропа #c9a46e, герой — белый конь #f4eee3 и синяя черкеска #2f5fe0,
   опасность #ff4f3a #ff7a1f, награда #ffd23f.
   Свет: тёплое солнце сверху-сбоку, холодная заливка неба; даль растворяется в тумане цвета горизонта.
   Три фирменных приёма: подковы светящейся дугой над бревном; стены ущелья сжимаются, когда трудно, и расступаются, когда легче;
   красный башлык нарта бьётся на ветру, тем сильнее, чем быстрее конь.
*/
const GAME = {
  engine: 'three',
  title: 'Ущелье',
  subtitle: 'Юный нарт скачет на коне по Хаджохскому ущелью. Прыгай, пригибайся, меняй полосу — и держись как можно дольше.',
  donor: 'Subway Surfers и Temple Run',
  players: 1,
  controls: [
    { input: 'move4', text: '← → полоса, ↑ прыжок, ↓ подкат' },
    { input: 'a', text: 'прыжок' },
    { input: 'b', text: 'подкат' },
  ],
  camera: { type: 'free', fov: 1.05 }, // камеру за спиной ведёт сама игра: см. cameraStep
  field: { w: 16, h: 40 },
  shadowSize: 30,
  sky: ['#3d8bd8', '#ffd7a0'],
  fog: 0.016,
  accent: '#ffd23f',
  scoreColor: '#ffd23f',
  decisions: [
    'Чувство: конь всё быстрее, а ты всё ещё успеваешь — ущелье несётся навстречу, топот копыт и барабан частят',
    'Честность: преграду видно издалека, у каждой свой вид: низкое бревно — прыгай, перекладина с кистями — пригнись, арба — в сторону; место камнепада горит кругом',
    'Выбор: держаться на полосе с подковами до последнего мига или уйти заранее; серия подков без удара умножает очки',
  ],
  notes: [
    'Первые 8 секунд — только подковы: учишь полосы, удариться нельзя.',
    'Препятствия чаще встают на твою полосу: стоять на месте нельзя.',
    'После удара конь спотыкается и на миг теряет скорость, преграда разлетается.',
    'Камень падает за две секунды до тебя; круг на полосе горит с той секунды, как его стало видно.',
  ],
  config: {
    secret: { value: 1, min: 0, max: 1, step: 1, label: 'Спрятанная механика: кривая с передышками', hint: '1 — участок растёт к пику, потом передышка, после неё скорость ступенью; 0 — ровный подъём с тем же средним' },
    speed0: { value: 11, min: 4, max: 30, step: 0.5, label: 'Скорость в начале, м/с' },
    speedMax: { value: 26, min: 6, max: 40, step: 0.5, label: 'Скорость на пике, м/с' },
    wave: { value: 16, min: 6, max: 40, step: 1, label: 'Участок растёт, с' },
    rest: { value: 4, min: 0, max: 12, step: 0.5, label: 'Передышка, с', hint: '0 — без передышек' },
    density0: { value: 0.5, min: 0.1, max: 1.5, step: 0.05, label: 'Препятствий на 10 м в начале' },
    densityMax: { value: 0.85, min: 0.1, max: 1.5, step: 0.05, label: 'Препятствий на 10 м на пике' },
    sight: { value: 70, min: 15, max: 120, step: 5, label: 'Дальность видимости, м' },
    lives: { value: 3, min: 1, max: 9, step: 1, label: 'Жизни', restart: true },
    laneTime: { value: 0.14, min: 0.05, max: 0.5, step: 0.01, label: 'Смена полосы, с' },
    jumpH: { value: 1.7, min: 0.8, max: 3.5, step: 0.1, label: 'Высота прыжка, м' },
    jumpTime: { value: 0.62, min: 0.3, max: 1.2, step: 0.02, label: 'Прыжок длится, с' },
    slideTime: { value: 0.62, min: 0.3, max: 1.2, step: 0.02, label: 'Подкат длится, с' },
    showCurve: { value: 0, min: 0, max: 1, step: 1, label: 'Показать кривую трудности', hint: 'строка HUD: кривая двух минут и где ты сейчас' },
    // вариации жанра: 0 — как в классике
    oncoming: { value: 0, min: 0, max: 1, step: 1, label: 'Вариация «Встречные арбы»', hint: 'как поезда Subway Surfers: арбы с фонарями едут навстречу' },
    chase: { value: 0, min: 0, max: 1, step: 1, label: 'Вариация «Погоня»: сзади лавина', hint: 'как демоны Temple Run: удар — лавина ближе, два удара подряд — догнала', restart: true },
    board: { value: 0, min: 0, max: 1, step: 1, label: 'Вариация «Бурка»: прощает один удар', hint: 'как ховерборд Subway Surfers: потом 20 с сохнет', restart: true },
    climb: { value: 0, min: 0, max: 1, step: 1, label: 'Вариация «Разгон без предела»', hint: 'как Canabalt: скорость растёт всю партию, без потолка' },
    dense: { value: 1, min: 1, max: 2, step: 0.1, label: 'Вариация «Плотный поток»: плотность ×' },
  },
  presets: {
    'Новичок': { speed0: 9, speedMax: 20, density0: 0.4, densityMax: 0.7, sight: 90, lives: 5, laneTime: 0.12 },
    'Без спрятанной механики': { secret: 0 },
    // вариации и крайности для урока 9: те же значения — в сценарии урока (VARIATIONS), держать вместе
    'Слишком легко': { secret: 0, speed0: 7, speedMax: 9, density0: 0.35, densityMax: 0.4, lives: 5 },
    'Слишком трудно': { secret: 0, speed0: 22, speedMax: 30, density0: 0.95, densityMax: 1, rest: 0, lives: 3 },
    'Встречные арбы': { oncoming: 1 },
    'Погоня': { chase: 1 },
    'Туман': { sight: 25 },
    'Одна ошибка': { lives: 1 },
    'Бурка': { board: 1 },
    'Разгон без предела': { climb: 1 },
    'Плотный поток': { dense: 1.7 },
  },
  // имя вариации и её правило: крупно в начале партии, строкой HUD и на экране конца партии
  VARIANTS: [
    { on: (c, st) => !!st.curve, name: 'Твоя кривая', like: 'кривая, нарисованная в уроке', how: () => 'трудность идёт по кривой, которую ты нарисовал' },
    { on: c => c.speedMax <= 10, name: 'Слишком легко', like: 'проверка скуки', how: () => 'медленно и редко — скучно?' },
    { on: c => c.speed0 >= 20, name: 'Слишком трудно', like: 'проверка тревоги', how: () => 'быстро и густо с первых секунд' },
    { on: c => c.oncoming >= 1, name: 'Встречные арбы', like: 'поезда Subway Surfers', how: () => 'арбы с фонарями едут навстречу — уходи с полосы заранее' },
    { on: c => c.chase >= 1, name: 'Погоня', like: 'демоны Temple Run', how: () => 'сзади лавина: два удара подряд — догонит' },
    { on: c => c.sight <= 40, name: 'Туман', like: 'ночные трассы раннеров', how: c => `видно только на ${Math.round(c.sight)} м` },
    { on: c => c.lives <= 1, name: 'Одна ошибка', like: 'Canabalt', how: () => 'один удар — конец' },
    { on: c => c.board >= 1, name: 'Бурка', like: 'ховерборд Subway Surfers', how: () => 'бурка прощает один удар, потом 20 с сохнет' },
    { on: c => c.climb >= 1, name: 'Разгон без предела', like: 'Canabalt', how: () => 'скорость растёт всю партию без потолка' },
    { on: c => c.dense > 1.05, name: 'Плотный поток', like: 'поздние зоны Temple Run 2', how: c => `препятствий в ${c.dense.toFixed(1).replace('.', ',')} раза больше` },
  ],

  LANE: 2.3, // расстояние между полосами, м
  LANES: [-2.3, 0, 2.3],
  SPAN: 260, // длина кольца декора: что ушло за спину, переезжает вперёд
  AHEAD: 150, // на сколько метров вперёд построена тропа
  START_OBS: 8.3, // секунда первой преграды: раньше удариться нельзя
  UNLOCK: { arch: 12, cart: 22, rock: 42, on: 75 }, // с какой секунды открывается вид преграды
  STAND: 2.7, SLIDE: 1.6, // высота героя стоя и в подкате
  STREAK: [[130, 5], [80, 4], [40, 3], [15, 2]], // подков подряд → множитель
  ROCK: ['#c98a5e', '#b0705a', '#d4a273', '#a8765e', '#bf8f6a'],
  ROCK_FAR: ['#9c6a5a', '#8d6656', '#a87a62', '#7f5f55'],
  GREEN: ['#3f8a3a', '#57a443', '#2f7a3a', '#6cb04a'],

  // ---------- новая партия ----------
  start(lab, scene) {
    const T = lab.THREE, st = lab.state, cfg = lab.cfg;
    Object.assign(st, {
      tm: { m: new T.Matrix4(), q: new T.Quaternion(), e: new T.Euler(), p: new T.Vector3(), s: new T.Vector3(), c: new T.Color(), zero: new T.Matrix4().makeScale(0, 0, 0) },
      dist: 0, speed: cfg.speed0, vmax: cfg.speed0, distAcc: 0, nextS: 14, obs: [], shoes: [], tut: 0,
      qLane: null, qJump: 0, qSlide: 0, lc: { t: -9, from: 1 }, stumble: 0,
      streak: 0, bestStreak: 0, shoesTaken: 0, near: 0, clean: 0, jumps: 0, slides: 0, hitsAt: [],
      rests: 0, peaks: 0, inRest: false, segNow: -1, peakSeg: -1, lastWin: -1,
      chaseGap: 0.75, burka: { ready: cfg.board >= 1, t: 0 }, beat: 0, hoof: 0, sprayT: 0, banner: false,
    });
    this.schedule(lab);
    st.info = this.curveAt(lab, 0);
    st.speed = this.speedTarget(lab, st.info, 0);
    if (scene.fog) scene.fog.density = 1.05 / Math.max(10, cfg.sight); // туман по дальности видимости: даль растворяется в цвет горизонта
    lab.light.sun.color.set('#ffe2b4'); lab.light.sun.intensity = 2.1;
    lab.light.hemi.intensity = 1.0;
    this.scenery(lab, scene);
    this.decor(lab);
    this.makeKinds(lab);
    this.makeShoes(lab);
    this.buildHero(lab);
    this.avalanche(lab);
    this.generate(lab);
    st.cam = { x: 0, y: 3.6, fov: 60, punch: 0 };
    if (!lab.playing) this.poster(lab);
    this.drawAll(lab, 0);
    if (!st.posterOn) this.cameraStep(lab, 0, true);
  },

  // ---------- кривая трудности: пила, ровный подъём или кривая ученика ----------
  schedule(lab) {
    const st = lab.state, cfg = lab.cfg, d = lab.data && lab.data.curve;
    st.curve = null;
    if (Array.isArray(d) && d.length >= 2) {
      const c = d.slice(0, 12).map(v => lab.clamp(Number(v) || 0, 0, 1));
      while (c.length < 12) c.push(c[c.length - 1]);
      st.curve = c;
    }
    const W = Math.max(4, cfg.wave), R = Math.max(0, cfg.rest);
    st.segs = [];
    for (let k = 0, t0 = 0; t0 < 1500; k++) {
      const w = k === 0 ? Math.max(4, Math.round(W * 0.8)) : W, base = 0.08 + 0.0065 * t0;
      st.segs.push({ k, t0, w, r: R, base, peak: base + 0.32 });
      t0 += w + R;
    }
    let sum = 0, n = 0; // ровный подъём с тем же средним за две минуты, что у пилы
    for (let t = 0; t < 120; t += 0.5, n++) sum += this.saw(lab, t).D;
    st.slope = 2 * (sum / n) / 120;
    // строка кривой для HUD: 12 окон по 10 с
    st.glyphs = [...Array(12)].map((_, i) => '▁▂▃▄▅▆▇█'[lab.clamp(Math.round(this.curveAt(lab, i * 10 + 5).D * 7), 0, 7)]);
  },
  saw(lab, t) {
    const S = lab.state.segs;
    let k = 0;
    while (k < S.length - 1 && t >= S[k + 1].t0) k++;
    const g = S[k], u = t - g.t0;
    if (u < g.w) return { D: g.base + (g.peak - g.base) * (u / g.w), rest: false, Dsp: g.base, seg: k, u, peakIn: g.w - u, saw: true };
    return { D: 0, rest: true, Dsp: g.base, seg: k, u, peakIn: 0, restLeft: g.w + g.r - u, saw: true };
  },
  curveAt(lab, t) {
    const st = lab.state, c = st.curve;
    if (c) {
      let D;
      if (t <= 5) D = c[0];
      else if (t >= 115) D = c[11] + (t - 115) * 0.006;
      else { const i = Math.floor((t - 5) / 10), f = (t - 5 - i * 10) / 10; D = lab.lerp(c[i], c[i + 1], f); }
      const w = Math.floor(t / 10), rest = w > 0 && w < 12 && c[w] <= c[w - 1] - 0.25 && t - w * 10 < Math.max(3, lab.cfg.rest);
      return { D: rest ? 0 : D, rest, Dsp: D, seg: w, custom: true };
    }
    if (lab.cfg.secret >= 0.5) return this.saw(lab, t);
    const D = st.slope * t;
    return { D, rest: false, Dsp: D, seg: 0 };
  },
  speedTarget(lab, info, t) {
    const cfg = lab.cfg, span = cfg.speedMax - cfg.speed0;
    if (cfg.climb >= 1) return cfg.speed0 + span * Math.max(0, info.Dsp) + 0.12 * t; // как Canabalt: без потолка
    return cfg.speed0 + span * lab.clamp(info.Dsp, 0, 1);
  },
  density(lab, D) {
    const cfg = lab.cfg;
    return Math.max(0.05, (cfg.density0 + (cfg.densityMax - cfg.density0) * Math.max(0, D)) * cfg.dense);
  },

  // ---------- тропа: ряды преград и подковы строятся на AHEAD метров вперёд ----------
  generate(lab) {
    const st = lab.state, h = st.hero;
    while (st.nextS < st.dist + this.AHEAD) {
      const s = st.nextS, tArr = lab.t + (s - st.dist) / Math.max(4, st.speed), info = this.curveAt(lab, tArr);
      if (tArr < this.START_OBS) { this.tutorShoes(lab, s); st.nextS += 13; continue; }
      if (info.rest) { this.restShoes(lab, s); st.nextS += 9; continue; }
      // первые полминуты — учёба: ряды не чаще, чем раз в 1,9 с, дальше запас на решение сжимается до 0,5 с
      const spd = this.speedTarget(lab, info, tArr), learn = lab.clamp(1 - (tArr - this.START_OBS) / 25, 0, 1);
      const gap = Math.max(10 / this.density(lab, info.D), spd * (0.5 + 1.4 * learn) + 3.5);
      this.row(lab, s, info.D, tArr, gap, h ? h.lane : 1);
      st.nextS += gap * lab.rand(0.88, 1.12);
    }
  },
  row(lab, s, D, tArr, gap, me) {
    const cfg = lab.cfg, U = this.UNLOCK, un = { arch: tArr >= U.arch, cart: tArr >= U.cart, rock: tArr >= U.rock };
    const onAt = cfg.oncoming >= 1 ? U.cart : U.on, onP = cfg.oncoming >= 1 ? 0.55 : 0.18;
    const hard = () => { // преграда, которую не перепрыгнуть: только уйти с полосы
      if (un.rock && lab.chance(0.3)) return { kind: 'rock' };
      return { kind: 'cart', moving: tArr >= onAt && lab.chance(onP) };
    };
    const soft = () => (un.arch && lab.chance(0.45) ? { kind: 'arch' } : { kind: 'log' });
    const any = () => (un.cart && lab.chance(0.45) ? hard() : soft());
    const w = [['one', 1.1 - 0.6 * Math.min(1, D)], ['two', un.cart ? 0.15 + 0.85 * D : 0], ['wall', D > 0.25 ? 0.12 + 0.3 * D : 0], ['mix', un.rock && D > 0.5 ? D - 0.4 : 0]];
    if (tArr < 20) w.forEach(x => { if (x[0] !== 'one') x[1] = 0; }); // в учёбе — по одной преграде
    let r = lab.rand(0, w.reduce((a, x) => a + x[1], 0)), type = 'one';
    for (const [k, v] of w) { if ((r -= v) <= 0) { type = k; break; } }
    const put = [];
    if (type === 'one') put.push([lab.chance(0.55) ? me : lab.randInt(0, 2), any()]);
    else if (type === 'two') {
      const open = lab.chance(0.6) ? lab.pick([0, 1, 2].filter(l => l !== me)) : me;
      for (const l of [0, 1, 2]) if (l !== open) put.push([l, lab.chance(0.75) ? hard() : soft()]);
      if (D > 0.5 && lab.chance(0.35)) put.push([open, soft()]); // свободная полоса тоже требует действия
    } else if (type === 'wall') {
      if (un.arch && lab.chance(0.5)) put.push([-1, { kind: 'arch3' }]);
      else for (const l of [0, 1, 2]) put.push([l, { kind: 'log' }]);
    } else {
      const ls = [0, 1, 2].sort(() => lab.rand(-1, 1));
      put.push([ls[0], hard()], [ls[1], { kind: 'log' }], [ls[2], un.arch ? { kind: 'arch' } : { kind: 'log' }]);
    }
    const made = put.map(([lane, o]) => this.addOb(lab, o.kind, lane, s + (o.kind === 'cart' ? 1.2 : 0), o));
    // подковы перед рядом: часто ведут прямо к преграде — держись до последнего мига или уйди заранее
    if (lab.chance(0.7)) {
      const target = made.filter(Boolean).find(o => lab.chance(0.5)), lane = target && target.lane >= 0 ? target.lane : lab.randInt(0, 2);
      const ob = made.find(o => o && (o.lane === lane || o.lane < 0)), from = s - gap * 0.75, n = Math.max(2, Math.min(7, Math.floor(gap * 0.7 / 2.4)));
      const stop = ob && (ob.kind === 'cart' || ob.kind === 'rock') ? s - 5 : s - 1.5;
      for (let i = 0; i < n; i++) { const z = from + i * 2.4; if (z < stop) this.addShoe(lab, lane, z, 1.05); }
      if (ob && ob.kind === 'log') for (let i = -2; i <= 2; i++) this.addShoe(lab, lane, s + i * 1.25, 1.05 + 1.35 * (1 - (i / 2.6) ** 2)); // дуга над бревном
      if (ob && (ob.kind === 'arch' || ob.kind === 'arch3')) for (let i = -1; i <= 1; i++) this.addShoe(lab, lane, s + i * 1.2, 0.6); // низко под перекладиной
    }
  },
  tutorShoes(lab, s) { // учёба: подковы змейкой по полосам
    const st = lab.state, lane = [0, 2, 0, 2, 1, 0][st.tut++ % 6];
    for (let i = 0; i < 4; i++) this.addShoe(lab, lane, s + i * 2.4, 1.05);
  },
  restShoes(lab, s) { // передышка: подковы россыпью, скачи спокойно
    const st = lab.state, lane = (st.tut++ % 3);
    for (let i = 0; i < 3; i++) this.addShoe(lab, lane, s + i * 2.6, 1.05 + Math.sin(i) * 0.3);
  },

  // ---------- виды преград: детали — копии InstancedMesh, у каждой преграды своё место в пачке ----------
  makeKinds(lab) {
    const T = lab.THREE, st = lab.state, K = st.K = {};
    const rz = g => g.rotateZ(Math.PI / 2);
    const glow = (hex, k = 1) => lab.mat(hex, { glow: k });
    const kind = (name, n, len, parts) => {
      K[name] = {
        n, len, free: [...Array(n).keys()].reverse(),
        parts: parts.map(p => {
          const m = lab.instances(p.geo, p.look, n * p.at.length, p.shadow === false ? { shadow: false } : {});
          m.frustumCulled = false;
          return Object.assign({}, p, { m, copies: p.at.length });
        }),
      };
    };
    const tas = (w, k) => [...Array(k)].map((_, i) => [-w / 2 + (w * i) / (k - 1), 1.9, 0.12]);
    kind('log', 24, 0.8, [
      { geo: rz(new T.CylinderGeometry(0.36, 0.38, 2.1, 9)), look: '#8b5a32', at: [[0, 0.36, 0]] },
      { geo: rz(new T.CylinderGeometry(0.4, 0.4, 0.14, 9)), look: glow('#ff7a1f', 0.9), at: [[-0.62, 0.36, 0], [0.62, 0.36, 0]], shadow: false },
      { geo: rz(new T.CylinderGeometry(0.31, 0.31, 0.05, 9)), look: '#ecc28a', at: [[-1.06, 0.36, 0], [1.06, 0.36, 0]] },
      { geo: new T.ConeGeometry(0.1, 0.5, 4).rotateX(-0.6), look: '#6e4526', at: [[0.3, 0.7, -0.1]] },
    ]);
    kind('arch', 14, 0.5, [
      { geo: new T.BoxGeometry(0.24, 2.6, 0.24), look: '#5b3b25', at: [[-1.12, 1.3, 0], [1.12, 1.3, 0]] },
      { geo: new T.BoxGeometry(2.62, 0.34, 0.4), look: '#82502c', at: [[0, 2.17, 0]] },
      { geo: new T.ConeGeometry(0.09, 0.32, 4).rotateX(Math.PI), look: glow('#ff4f3a', 1.1), at: tas(1.9, 5), shadow: false },
    ]);
    kind('arch3', 6, 0.5, [
      { geo: new T.BoxGeometry(0.3, 2.7, 0.3), look: '#5b3b25', at: [[-3.6, 1.35, 0], [3.6, 1.35, 0], [0, 2.5, -0.3]] },
      { geo: new T.BoxGeometry(7.5, 0.36, 0.42), look: '#82502c', at: [[0, 2.17, 0]] },
      { geo: new T.ConeGeometry(0.09, 0.32, 4).rotateX(Math.PI), look: glow('#ff4f3a', 1.1), at: tas(6.6, 13), shadow: false },
      { geo: new T.BoxGeometry(0.5, 0.7, 0.04), look: '#ffd23f', at: [[-3.6, 2.85, 0], [3.6, 2.85, 0]] },
    ]);
    kind('cart', 16, 3.6, [
      { geo: new T.BoxGeometry(2.0, 0.8, 3.4), look: '#d2552b', at: [[0, 1.2, 0]] },
      { geo: lab.addons.RoundedBoxGeometry ? new lab.addons.RoundedBoxGeometry(1.9, 1.05, 3.1, 2, 0.3) : new T.BoxGeometry(1.9, 1.05, 3.1), look: '#f2c14e', at: [[0, 2.1, 0]] },
      { geo: rz(new T.CylinderGeometry(0.74, 0.74, 0.18, 12)), look: '#4a3020', at: [[-1.08, 0.74, -0.6], [1.08, 0.74, -0.6]] },
      { geo: new T.BoxGeometry(0.1, 0.1, 1.9), look: '#6b4a2e', at: [[-0.4, 0.75, 2.55], [0.4, 0.75, 2.55]] },
      { geo: new T.IcosahedronGeometry(0.18, 0), look: glow('#ffb04a', 0.6), at: [[-0.85, 1.75, 1.75], [0.85, 1.75, 1.75]], shadow: false, when: o => !o.moving },
      { geo: new T.IcosahedronGeometry(0.24, 0), look: glow('#fff2a0', 2), at: [[-0.85, 1.75, 1.75], [0.85, 1.75, 1.75]], shadow: false, when: o => o.moving },
      { geo: new T.BoxGeometry(2.1, 0.12, 0.12), look: glow('#ff7a1f', 0.8), at: [[0, 1.62, 1.72]], shadow: false },
    ]);
    kind('rock', 12, 2.0, [
      { geo: new T.DodecahedronGeometry(1.05, 0), look: '#a08a7c', at: [[0, 1.0, 0]], fall: true, spin: true },
      { geo: new T.DodecahedronGeometry(0.35, 0), look: glow('#ff6a3a', 0.7), at: [[0.5, 1.5, 0.6]], fall: true, spin: true, shadow: false },
      { geo: new T.RingGeometry(0.95, 1.25, 24).rotateX(-Math.PI / 2), look: lab.mat('#ff4d3a', { glow: 1.2, side: 'double' }), at: [[0, 0.07, 0]], shadow: false, when: o => !o.landed },
      { geo: new T.CircleGeometry(0.9, 16).rotateX(-Math.PI / 2), look: lab.mat('#ff4d3a', { alpha: 0.28, unlit: true }), at: [[0, 0.06, 0]], shadow: false, when: o => !o.landed },
    ]);
  },
  addOb(lab, kind, lane, s, o = {}) {
    const st = lab.state, K = st.K[kind];
    if (!K || !K.free.length) return null;
    const ob = { kind, lane, x: lane < 0 ? 0 : this.LANES[lane], s, len: K.len, slot: K.free.pop(), vis: false, g: 0, y: kind === 'rock' ? 16 : 0, vy: 0, rot: lab.rand(0, 6), moving: !!o.moving, vel: o.moving ? 7 : 0, landed: kind !== 'rock' };
    st.obs.push(ob);
    return ob;
  },
  dropOb(lab, ob) {
    const K = lab.state.K[ob.kind];
    ob.dead = true;
    for (const p of K.parts) for (let c = 0; c < p.copies; c++) p.m.setMatrixAt(ob.slot * p.copies + c, lab.state.tm.zero), p.m.instanceMatrix.needsUpdate = true;
    K.free.push(ob.slot);
  },
  setM(lab, m, i, x, y, z, rx, ry, sx, sy, sz) {
    const tm = lab.state.tm;
    tm.e.set(rx, ry, 0); tm.q.setFromEuler(tm.e); tm.p.set(x, y, z); tm.s.set(sx, sy, sz);
    tm.m.compose(tm.p, tm.q, tm.s); m.setMatrixAt(i, tm.m); m.instanceMatrix.needsUpdate = true;
  },
  drawOb(lab, ob) {
    const st = lab.state, K = st.K[ob.kind], z = st.dist - ob.s, g = ob.vis ? ob.g : 0;
    for (const p of K.parts) for (let c = 0; c < p.copies; c++) {
      const i = ob.slot * p.copies + c;
      if (g <= 0.001 || (p.when && !p.when(ob))) { p.m.setMatrixAt(i, st.tm.zero); p.m.instanceMatrix.needsUpdate = true; continue; }
      const a = p.at[c], y = p.fall ? ob.y : 0;
      this.setM(lab, p.m, i, ob.x + a[0] * g, y + a[1] * g, z + a[2] * g, p.spin ? ob.rot : 0, p.spin ? ob.rot * 0.6 : 0, g, g, g);
    }
  },

  // ---------- подковы: одна пачка копий, вращаются и светятся золотом ----------
  makeShoes(lab) {
    const T = lab.THREE, st = lab.state, n = 130;
    const geo = new T.TorusGeometry(0.34, 0.09, 6, 14, Math.PI * 1.4).rotateZ(-0.2 * Math.PI);
    st.shoeMesh = lab.instances(geo, lab.mat('#ffd23f', { glow: 0.55, metal: 0.6, rough: 0.35 }), n, { shadow: false });
    st.shoeMesh.frustumCulled = false;
    st.shoeFree = [...Array(n).keys()].reverse();
  },
  addShoe(lab, lane, s, y) {
    const st = lab.state;
    if (!st.shoeFree.length) return null;
    const sh = { lane, x: this.LANES[lane], s, y, slot: st.shoeFree.pop() };
    st.shoes.push(sh);
    return sh;
  },
  dropShoe(lab, sh) {
    const st = lab.state;
    sh.dead = true; st.shoeMesh.setMatrixAt(sh.slot, st.tm.zero); st.shoeMesh.instanceMatrix.needsUpdate = true; st.shoeFree.push(sh.slot);
  },

  // ---------- мир: дно ущелья, тропа, река Белая, стены, мох, буки, дольмены, водопады, мост ----------
  scenery(lab, scene) {
    const T = lab.THREE, st = lab.state;
    lab.ground({ w: 140, h: 420, color: '#5d7f3e' });
    lab.box(7.4, 0.04, 320, '#b8915e', { at: [0, 0.02, -110], shadow: false }); // тропа
    lab.box(2.8, 0.05, 320, '#6c9443', { at: [-5.1, 0.025, -110], shadow: false }); // левая обочина
    lab.box(1.5, 0.05, 320, '#7aa54c', { at: [4.45, 0.025, -110], shadow: false }); // правый берег
    lab.box(5.8, 0.03, 320, '#1f6f7a', { at: [7.95, 0.012, -110], shadow: false }); // дно реки
    st.water = lab.box(5.6, 0.04, 320, lab.mat('#27a9b8', { alpha: 0.82, shiny: true, smooth: true }), { at: [7.95, 0.09, -110], shadow: false });
    // облака над узкой полосой неба и птицы: живое без игрока
    st.clouds = [...Array(9)].map(() => lab.ball(lab.rand(4, 8), lab.mat('#ffffff', { unlit: true, alpha: 0.9 }), { at: [lab.rand(-30, 30), lab.rand(34, 46), lab.rand(-170, -60)], scale: [1.6, 0.45, 1], shadow: false, detail: 1 }));
    st.birds = [...Array(6)].map(() => ({ r: lab.rand(6, 14), y: lab.rand(17, 24), z: lab.rand(-60, -25), ph: lab.rand(0, 6), w: lab.rand(0.25, 0.45) }));
    st.birdMesh = lab.instances(new T.BoxGeometry(0.7, 0.05, 0.22).translate(0.35, 0, 0), '#2a2a38', 12, { shadow: false });
    st.birdMesh.frustumCulled = false;
    // линии скорости: на большой скорости воздух свистит мимо
    st.lines = [...Array(26)].map(() => ({ x: lab.pick([-1, 1]) * lab.rand(2.5, 7), y: lab.rand(0.6, 6), z: lab.rand(-30, 8) }));
    st.lineMesh = lab.instances(new T.BoxGeometry(0.035, 0.035, 2.6), lab.mat('#ffffff', { glow: 0.4, alpha: 0.5, add: true }), 26, { shadow: false });
    st.lineMesh.frustumCulled = false;
  },
  // декор живёт в группе world: её z — пройденные метры, копия на s метрах тропы стоит на z = −s
  decor(lab) {
    const T = lab.THREE, st = lab.state, SP = this.SPAN;
    st.world = lab.group({ at: [0, 0, 0] });
    st.foamG = lab.group({ at: [0, 0, 0] }); // пена реки бежит быстрее тропы: течение
    st.sets = [];
    const spread = s => { // стены по трудности в момент, когда до этого места доскачешь: в передышке ущелье расступается
      const i = this.curveAt(lab, lab.t + (s - st.dist) / Math.max(4, st.speed));
      return i.rest ? 2.6 : -1.1 * lab.clamp(i.D, 0, 1.2);
    };
    st.spread = spread;
    const set = (geo, look, n, gen, o = {}) => {
      const g = o.group || st.world, m = lab.instances(geo, look, n, Object.assign({ parent: g }, o.shadow === false ? { shadow: false } : {}));
      m.frustumCulled = false;
      const items = [...Array(n)].map((_, i) => ({ i, s: ((i + lab.rand(0.1, 0.9)) * SP) / n - 25 }));
      const S = { m, items, gen, g };
      items.forEach(it => { gen(it); this.putDecor(lab, S, it); });
      st.sets.push(S);
      return S;
    };
    const dod = new T.DodecahedronGeometry(1, 0), ico = new T.IcosahedronGeometry(1, 0);
    // стены ущелья: передний ряд охристых скал и дальний ряд выше и темнее
    for (const side of [-1, 1]) {
      const base = side < 0 ? 6.6 : 11.2;
      set(dod, '#ffffff', 80, it => {
        const h = lab.rand(5, 13), sp = st.spread(it.s) * (side < 0 ? 1 : 0.6);
        Object.assign(it, { x: side * (base + sp + lab.rand(0, 1.2)), y: h / 2 - 0.6, sx: lab.rand(2, 3.2), sy: h / 2, sz: lab.rand(2.2, 3.4), ry: lab.rand(0, 3), color: lab.pick(this.ROCK) });
      });
      set(dod, '#ffffff', 46, it => {
        const h = lab.rand(11, 22), sp = st.spread(it.s) * (side < 0 ? 1 : 0.6);
        Object.assign(it, { x: side * (base + 3.4 + sp + lab.rand(0, 2)), y: h / 2 - 1, sx: lab.rand(3, 4.5), sy: h / 2, sz: lab.rand(3, 5), ry: lab.rand(0, 3), color: lab.pick(this.ROCK_FAR) });
      });
      // буки на гребне стены
      set(ico, '#ffffff', 34, it => {
        const sp = st.spread(it.s) * (side < 0 ? 1 : 0.6), r = lab.rand(1.4, 2.4);
        Object.assign(it, { x: side * (base + 3 + sp + lab.rand(0, 3)), y: lab.rand(12, 20), sx: r, sy: r * 1.15, sz: r, ry: lab.rand(0, 3), color: lab.pick(this.GREEN) });
      });
    }
    // мох на скалах — изумрудные пятна у подножия левой стены и над рекой
    set(ico, '#ffffff', 70, it => {
      const side = it.i % 3 ? -1 : 1, base = side < 0 ? 5.0 : 9.9, sp = st.spread(it.s) * (side < 0 ? 1 : 0.6);
      Object.assign(it, { x: side * (base + sp + lab.rand(0, 0.6)), y: lab.rand(0.3, 6), sx: lab.rand(0.5, 1.1), sy: lab.rand(0.3, 0.7), sz: lab.rand(0.5, 1.1), ry: lab.rand(0, 3), color: lab.pick(['#5d9e3f', '#79b84b', '#4c8c36']) });
    }, { shadow: false });
    // папоротники и трава у тропы
    set(new T.ConeGeometry(0.35, 0.75, 5), '#ffffff', 150, it => {
      const left = it.i % 3 !== 0;
      Object.assign(it, { x: left ? lab.rand(-5.8, -3.9) : lab.rand(3.85, 4.9), y: 0.35, sx: lab.rand(0.7, 1.4), sy: lab.rand(0.7, 1.5), sz: lab.rand(0.7, 1.4), ry: lab.rand(0, 3), rx: lab.rand(-0.25, 0.25), color: lab.pick(['#4f8f3a', '#68a845', '#3e7d34', '#86b84e']) });
    }, { shadow: false });
    // галька по краям тропы и валуны на берегу
    set(ico, '#ffffff', 90, it => {
      const r = lab.rand(0.12, 0.3);
      Object.assign(it, { x: lab.pick([-1, 1]) * lab.rand(3.5, 3.9), y: r * 0.5, sx: r * 1.3, sy: r, sz: r, ry: lab.rand(0, 3), color: lab.pick(['#d8c7a8', '#bfae92', '#e6dcc4']) });
    }, { shadow: false });
    set(dod, '#ffffff', 30, it => {
      const r = lab.rand(0.5, 1.2);
      Object.assign(it, { x: lab.pick([lab.rand(5.1, 5.9), lab.rand(9.8, 10.6)]), y: r * 0.35, sx: r * 1.3, sy: r * 0.8, sz: r, ry: lab.rand(0, 3), color: lab.pick(['#cfc3b2', '#b8ab98', '#9e927f']) });
    });
    // тропа: полосы двух оттенков и камешки-разделители полос — по ним видно скорость
    set(new T.BoxGeometry(7.2, 0.05, 2.8), '#ffffff', 46, it => Object.assign(it, { x: 0, y: 0.045, sx: 1, sy: 1, sz: 1, ry: 0, color: it.i % 2 ? '#c9a46e' : '#bd955f' }), { shadow: false });
    set(new T.BoxGeometry(0.22, 0.08, 0.5), '#ffffff', 160, it => Object.assign(it, { x: it.i % 2 ? 1.15 : -1.15, y: 0.07, sx: 1, sy: 1, sz: 1, ry: lab.rand(-0.2, 0.2), color: lab.pick(['#f1e6cc', '#e4d6b6']) }), { shadow: false });
    // пена на реке: бежит по течению быстрее тропы
    set(new T.BoxGeometry(0.18, 0.03, 1.6), lab.mat('#e9fbff', { glow: 0.25 }), 60, it => Object.assign(it, { x: lab.rand(5.6, 10.3), y: 0.12, sx: lab.rand(0.6, 1.6), sy: 1, sz: lab.rand(0.6, 1.8), ry: lab.rand(-0.15, 0.15) }), { group: st.foamG, shadow: false });
    // ориентиры: дольмены у тропы, водопады по левой стене, высокий бревенчатый мост над ущельем
    const BU = lab.addons.BufferGeometryUtils, slab = (w, h, d, x, y, z) => new T.BoxGeometry(w, h, d).translate(x, y, z);
    const dolmen = BU.mergeGeometries([slab(0.25, 1.6, 2.0, -0.9, 0.8, 0), slab(0.25, 1.6, 2.0, 0.9, 0.8, 0), slab(2.05, 1.6, 0.25, 0, 0.8, -0.9), slab(2.6, 0.3, 2.6, 0, 1.75, 0)].map(g => g.toNonIndexed()));
    const dolmenFront = BU.mergeGeometries([slab(0.7, 1.6, 0.25, -0.65, 0.8, 0.95), slab(0.7, 1.6, 0.25, 0.65, 0.8, 0.95), slab(0.6, 0.45, 0.25, 0, 1.38, 0.95), slab(0.6, 0.45, 0.25, 0, 0.22, 0.95)].map(g => g.toNonIndexed()));
    const dg = it => Object.assign(it, { x: -5.4, y: 0, sx: 1, sy: 1, sz: 1, ry: Math.PI / 2 });
    set(dolmen, '#b3ab9a', 3, dg);
    set(dolmenFront, '#a39b8a', 3, dg);
    st.falls = set(new T.BoxGeometry(1.4, 12, 0.3), lab.mat('#eafcff', { glow: 0.45, alpha: 0.85 }), 3, it => Object.assign(it, { x: -5.9 - st.spread(it.s) * 0.4, y: 6, sx: 1, sy: 1, sz: 1, ry: Math.PI / 2 + 0.1 }), { shadow: false });
    set(new T.BoxGeometry(24, 0.5, 1.8), '#7a5236', 2, it => Object.assign(it, { x: 2, y: 15, sx: 1, sy: 1, sz: 1, ry: 0 }));
    set(new T.BoxGeometry(24, 0.12, 0.12), '#5a3a26', 4, it => Object.assign(it, { x: 2, y: 15.8, sx: 1, sy: 1, sz: 1, ry: 0 }));
  },
  putDecor(lab, S, it) {
    const tm = lab.state.tm;
    tm.e.set(it.rx || 0, it.ry || 0, 0); tm.q.setFromEuler(tm.e); tm.p.set(it.x, it.y, -it.s); tm.s.set(it.sx, it.sy, it.sz);
    tm.m.compose(tm.p, tm.q, tm.s); S.m.setMatrixAt(it.i, tm.m); S.m.instanceMatrix.needsUpdate = true;
    if (it.color) { S.m.setColorAt(it.i, tm.c.set(it.color)); S.m.instanceColor.needsUpdate = true; }
  },
  recycle(lab) { // что ушло за спину — переезжает на SPAN метров вперёд
    const st = lab.state;
    for (const S of st.sets) {
      const z0 = S.g.position.z;
      for (const it of S.items) if (z0 - it.s > 24) { it.s += this.SPAN; S.gen(it); this.putDecor(lab, S, it); }
    }
  },

  // ---------- герой: белый конь и нарт в синей черкеске, красный башлык по ветру ----------
  buildHero(lab) {
    const T = lab.THREE, st = lab.state, W = '#f4eee3', WD = '#ddd1bf', MANE = '#5b3b26', BLUE = '#2f5fe0', SKIN = '#f0c49c', DARK = '#2a2420';
    const g = lab.group({ at: [0, 0, 0] }), body = lab.group({ parent: g });
    const P = [
      lab.box(0.62, 0.64, 1.6, W, { at: [0, 1.25, 0], round: 0.22, parent: null }),
      lab.box(0.34, 0.78, 0.42, W, { at: [0, 1.7, 0.78], rot: [-0.55, 0, 0], round: 0.12, parent: null }),
      lab.box(0.3, 0.32, 0.64, W, { at: [0, 2.03, 1.13], rot: [0.28, 0, 0], round: 0.1, parent: null }),
      lab.box(0.27, 0.25, 0.24, WD, { at: [0, 1.93, 1.43], round: 0.06, parent: null }),
      lab.cone(0.06, 0.2, W, { at: [-0.09, 2.27, 1.0], parent: null }), lab.cone(0.06, 0.2, W, { at: [0.09, 2.27, 1.0], parent: null }),
      lab.box(0.09, 0.55, 0.62, MANE, { at: [0, 1.98, 0.6], rot: [-0.55, 0, 0], parent: null }),
      lab.box(0.72, 0.09, 0.78, '#c8283a', { at: [0, 1.57, -0.05], parent: null }),
      lab.box(0.74, 0.04, 0.8, lab.mat('#ffcf4a', { glow: 0.2 }), { at: [0, 1.52, -0.05], parent: null }),
      lab.ball(0.055, '#ffffff', { at: [-0.155, 2.08, 1.2], parent: null }), lab.ball(0.055, '#ffffff', { at: [0.155, 2.08, 1.2], parent: null }),
      lab.ball(0.032, '#111111', { at: [-0.18, 2.08, 1.23], parent: null }), lab.ball(0.032, '#111111', { at: [0.18, 2.08, 1.23], parent: null }),
    ];
    lab.merge(P, body); // детали без родителя: их координаты — уже в осях body, слитый меш ляжет в body один раз
    // хвост и ноги: ноги — две пачки копий (нога и копыто), ось — у плеча
    const tail = lab.mesh(new T.BoxGeometry(0.15, 0.15, 0.8).translate(0, 0, -0.38), MANE, { at: [0, 1.42, -0.8], rot: [0.7, 0, 0], parent: body });
    const legs = lab.instances(new T.CylinderGeometry(0.085, 0.07, 0.92, 6).translate(0, -0.46, 0), W, 4, { parent: body });
    const hooves = lab.instances(new T.CylinderGeometry(0.1, 0.11, 0.13, 6).translate(0, -0.95, 0), '#3a2c24', 4, { parent: body });
    legs.frustumCulled = hooves.frustumCulled = false;
    // нарт: ось вращения — седло, наклон вперёд в подкате
    const rider = lab.group({ at: [0, 1.6, -0.05], parent: body });
    const R = [
      lab.box(0.5, 0.66, 0.34, BLUE, { at: [0, 0.45, 0], round: 0.08, parent: null }),
      lab.box(0.58, 0.34, 0.42, BLUE, { at: [0, 0.08, -0.02], round: 0.06, parent: null }),
      lab.box(0.13, 0.26, 0.04, '#f6f1e2', { at: [-0.13, 0.55, 0.18], parent: null }), lab.box(0.13, 0.26, 0.04, '#f6f1e2', { at: [0.13, 0.55, 0.18], parent: null }),
      lab.box(0.54, 0.07, 0.37, lab.mat('#ffcf4a', { glow: 0.25 }), { at: [0, 0.2, 0], parent: null }),
      lab.box(0.13, 0.48, 0.14, DARK, { at: [-0.37, -0.1, 0.12], rot: [-0.5, 0, 0], parent: null }), lab.box(0.13, 0.48, 0.14, DARK, { at: [0.37, -0.1, 0.12], rot: [-0.5, 0, 0], parent: null }),
      lab.box(0.12, 0.46, 0.12, BLUE, { at: [-0.28, 0.48, 0.22], rot: [-0.9, 0, 0], parent: null }), lab.box(0.12, 0.46, 0.12, BLUE, { at: [0.28, 0.48, 0.22], rot: [-0.9, 0, 0], parent: null }),
      lab.ball(0.07, SKIN, { at: [-0.22, 0.4, 0.44], parent: null }), lab.ball(0.07, SKIN, { at: [0.22, 0.4, 0.44], parent: null }),
      lab.ball(0.18, SKIN, { at: [0, 0.97, 0.02], parent: null }),
      lab.cyl(0.2, 0.18, 0.24, DARK, { at: [0, 1.16, 0], sides: 9, parent: null }),
      lab.ball(0.038, '#ffffff', { at: [-0.065, 1.0, 0.16], parent: null }), lab.ball(0.038, '#ffffff', { at: [0.065, 1.0, 0.16], parent: null }),
      lab.ball(0.022, '#111111', { at: [-0.065, 1.0, 0.19], parent: null }), lab.ball(0.022, '#111111', { at: [0.065, 1.0, 0.19], parent: null }),
    ];
    lab.merge(R, rider);
    const scarf = lab.mesh(new T.BoxGeometry(0.3, 0.05, 0.95).translate(0, 0, -0.47), lab.mat('#e8343a', { glow: 0.15 }), { at: [0, 0.8, -0.16], parent: rider });
    const burka = lab.box(0.66, 0.62, 0.22, '#1f1b2a', { at: [0, 0.52, -0.22], round: 0.06, parent: rider });
    lab.box(0.68, 0.06, 0.24, lab.mat('#ffd23f', { glow: 0.6 }), { at: [0, 0.82, 0], parent: burka });
    burka.visible = lab.cfg.board >= 1;
    const shadow = lab.mesh(new T.CircleGeometry(1, 20), lab.mat('#1c140c', { alpha: 0.38, unlit: true }), { at: [0, 0.06, 0], rot: [-Math.PI / 2, 0, 0], scale: [0.7, 1.15, 1], shadow: false });
    g.rotation.y = Math.PI; // смотрит в −Z, вдаль по ущелью
    st.hero = { g, body, rider, legs, hooves, tail, scarf, burka, shadow, x: 0, vx: 0, y: 0, vy: 0, air: false, slide: 0, slideAfter: false, lane: 1, ph: 0, land: 0 };
    lab.hero(g);
    this.pose(lab, 0);
  },
  pose(lab, dt) { // галоп, прыжок, подкат, крен на смене полосы
    const st = lab.state, h = st.hero, tm = st.tm;
    const rate = lab.clamp(st.speed / 4.2, 1.5, 5.2);
    h.ph += dt * rate * Math.PI * 2;
    h.g.position.set(h.x, h.y, 0);
    h.g.rotation.z = lab.damp(h.g.rotation.z, h.vx * 0.035, 12, dt || 1);
    h.g.rotation.y = Math.PI - lab.clamp(h.vx * 0.02, -0.25, 0.25);
    const run = !h.air && h.slide <= 0, bob = run ? Math.abs(Math.sin(h.ph)) * 0.1 : 0;
    h.body.position.y = lab.damp(h.body.position.y, bob - (h.slide > 0 ? 0.45 : 0) - h.land * 0.12, 22, dt || 1);
    h.body.rotation.x = lab.damp(h.body.rotation.x, h.slide > 0 ? 0.22 : h.air ? -0.12 * Math.sign(h.vy) : Math.sin(h.ph * 2) * 0.04, 14, dt || 1);
    h.rider.rotation.x = lab.damp(h.rider.rotation.x, h.slide > 0 ? 1.3 : h.air ? 0.35 : 0.15 + Math.sin(h.ph * 2 + 1) * 0.05, 16, dt || 1);
    h.rider.scale.setScalar(1 + (lab.playing ? 0 : Math.sin(lab.t * 2.2 + h.ph * 0.02) * 0.02));
    const pv = [[-0.2, 1.0, 0.62, 0], [0.2, 1.0, 0.62, 0.5], [-0.2, 1.0, -0.62, 2.2], [0.2, 1.0, -0.62, 2.7]];
    pv.forEach(([x, y, z, o], i) => {
      const front = i < 2, a = h.air ? (front ? -0.95 : 0.85) : h.slide > 0 ? (front ? -1.1 : 1.0) : Math.sin(h.ph + o) * 0.65;
      tm.e.set(a, 0, 0); tm.q.setFromEuler(tm.e); tm.p.set(x, y, z); tm.s.set(1, 1, 1); tm.m.compose(tm.p, tm.q, tm.s);
      h.legs.setMatrixAt(i, tm.m); h.hooves.setMatrixAt(i, tm.m);
    });
    h.legs.instanceMatrix.needsUpdate = h.hooves.instanceMatrix.needsUpdate = true;
    h.tail.rotation.x = 0.7 + Math.sin(h.ph * 2) * 0.15 + (h.air ? 0.4 : 0);
    const wind = lab.clamp(st.speed / 26, 0.3, 1.3); // башлык бьётся тем сильнее, чем быстрее конь
    h.scarf.rotation.x = -0.15 + Math.sin(lab.t * (9 + wind * 10)) * 0.18 * wind;
    h.scarf.rotation.y = Math.sin(lab.t * 6.3) * 0.2 * wind;
    h.shadow.position.x = h.x;
    const k = 1 / (1 + h.y * 0.35);
    h.shadow.scale.set(0.7 * k, 1.15 * k, 1);
    h.land = Math.max(0, h.land - dt * 5);
    h.g.visible = !lab.blink();
  },

  // ---------- лавина за спиной (вариация «Погоня») ----------
  avalanche(lab) {
    const T = lab.THREE, st = lab.state;
    if (lab.cfg.chase < 1) return;
    const g = st.ava = lab.group({ at: [0, 0, 14] });
    st.avaDust = [...Array(7)].map((_, i) => lab.ball(1, lab.mat('#e3cfae', { alpha: 0.75 }), { at: [-6 + i * 2, 1, 0], scale: [2.2, 1.4, 1.6], parent: g, shadow: false }));
    st.avaRocks = [...Array(6)].map((_, i) => lab.mesh(new T.DodecahedronGeometry(0.6, 0), '#8d7768', { at: [-5 + i * 2, 0.6, -0.8], parent: g }));
  },

  // ---------- афиша в меню: конь в прыжке над бревном, дуга подков, арба и перекладина впереди ----------
  poster(lab) {
    const st = lab.state, h = st.hero, add = (k, l, s) => { const o = this.addOb(lab, k, l, s); if (o) { o.vis = true; o.g = 1; o.poster = true; } return o; };
    add('log', 1, 1.6); add('cart', 0, 13); add('arch', 2, 22); add('log', 2, 36);
    for (let i = -2; i <= 3; i++) { const sh = this.addShoe(lab, 1, 1.6 + i * 1.25, 1.05 + 1.35 * (1 - (i / 2.6) ** 2)); if (sh) sh.poster = true; }
    for (let i = 0; i < 4; i++) { const sh = this.addShoe(lab, 2, 6 + i * 2.4, 1.05); if (sh) sh.poster = true; }
    h.y = 1.25; h.air = true; this.pose(lab, 0.016);
    const cam = lab.camera;
    cam.fov = 58; cam.updateProjectionMatrix();
    cam.position.set(3.4, 2.3, 4.6); cam.lookAt(-0.2, 1.6, -5);
    lab.view.target.set(0, 0, -8);
    st.posterOn = true;
  },
  unposter(lab) {
    const st = lab.state, h = st.hero;
    if (!st.posterOn) return;
    st.posterOn = false;
    st.obs.filter(o => o.poster).forEach(o => this.dropOb(lab, o));
    st.shoes.filter(s => s.poster).forEach(s => this.dropShoe(lab, s));
    st.obs = st.obs.filter(o => !o.dead); st.shoes = st.shoes.filter(s => !s.dead);
    h.y = 0; h.air = false; h.vy = 0;
    this.cameraStep(lab, 0, true);
  },
  variant(lab) {
    const cfg = lab.cfg, on = this.VARIANTS.filter(v => v.on(cfg, lab.state));
    if (!on.length) return { name: 'Классика', like: 'Subway Surfers и Temple Run', how: 'скачи как можно дальше: прыгай, пригибайся, меняй полосу' };
    return { name: on.map(v => v.name).join(' + '), like: on.map(v => v.like).join(', '), how: on.map(v => v.how(cfg)).join('; ') };
  },

  // ---------- каждый кадр ----------
  update(lab, dt) {
    const st = lab.state, cfg = lab.cfg, h = st.hero;
    this.unposter(lab);
    if (!st.banner) { // имя вариации и её правило крупно в начале партии
      st.banner = true;
      const v = this.variant(lab);
      lab.popup(lab.v3(0, 4.2, -6), v.name, '#ffe680', 32);
      lab.after(0.4, () => lab.popup(lab.v3(0, 3.3, -6), v.how, '#ffffff', 17));
    }
    const info = st.info = this.curveAt(lab, lab.t);
    this.events(lab, info);
    st.stumble = Math.max(0, st.stumble - dt);
    const target = this.speedTarget(lab, info, lab.t) * (1 - 0.38 * (st.stumble / 0.9));
    st.speed = lab.damp(st.speed, target, st.stumble > 0 ? 8 : 2.6, dt);
    st.vmax = Math.max(st.vmax, st.speed);
    st.dist += st.speed * dt;
    st.world.position.z = st.dist;
    st.foamG.position.z = st.dist + lab.t * 4.5;
    st.distAcc += st.speed * dt;
    if (st.distAcc >= 2) { const n = Math.floor(st.distAcc / 2); st.distAcc -= n * 2; lab.score += n; } // очко за каждые 2 м, без всплывашек
    this.control(lab, dt);
    this.generate(lab);
    this.moveObs(lab, dt);
    this.moveShoes(lab, dt);
    this.recycle(lab);
    this.chaseStep(lab, dt);
    this.burkaStep(lab, dt);
    this.life(lab, dt);
    this.music(lab, dt, info);
    this.pose(lab, dt);
    this.drawAll(lab, dt);
    this.cameraStep(lab, dt);
    this.hudStep(lab, info);
    lab.stat('продержался, с', Math.round(lab.t));
    lab.stat('дистанция, м', Math.round(st.dist));
    lab.stat('удары, с', st.hitsAt.slice());
    lab.stat('скорость, м/с', Math.round(st.vmax * 10) / 10);
  },

  // передышки, пики, ступени скорости — по часам партии
  events(lab, info) {
    const st = lab.state, h = st.hero, at = lab.v3(h.x, 3.6, -3);
    if (info.rest && !st.inRest) {
      st.inRest = true; st.rests++; lab.count('передышки');
      if (info.saw) lab.count('_secret');
      lab.popup(at, 'Передышка', '#bfffd0', 15);
      for (let i = 0; i < 3; i++) lab.tone(2100 + i * 380, 0.07, 'sine', 0.035, 2600 + i * 300, 0.12 * i); // птицы
    } else if (!info.rest && st.inRest) st.inRest = false;
    if (info.saw) {
      if (info.seg !== st.segNow) {
        if (st.segNow >= 0) { // после передышки — скорость ступенью выше
          lab.count('_secret');
          lab.popup(at, 'Быстрее!', '#ffb35c', 22); lab.sfx.whoosh(); st.cam.punch = 1;
          lab.burst(lab.v3(h.x, 1.5, -4), { count: 14, colors: ['#ffffff', '#ffe6b0'], speed: 9, size: 0.12, dir: [0, 0, 1], gravity: 0 });
        }
        st.segNow = info.seg;
      }
      if (!info.rest && info.peakIn < 0.1 && st.peakSeg !== info.seg) {
        st.peakSeg = info.seg; st.peaks++; lab.count('пики');
        lab.popup(lab.v3(h.x, 4.6, -3), 'Пик!', '#ffd23f', 18); lab.tone(70, 0.3, 'sine', 0.12, 45);
      }
    } else if (info.custom) { // своя кривая: пик — окно выше соседей
      const w = Math.floor(lab.t / 10), c = st.curve;
      if (w !== st.lastWin && w > 0 && w < 11) {
        st.lastWin = w;
        if (c[w] >= c[w - 1] && c[w] > c[w + 1] && c[w] >= 0.3) { st.peaks++; lab.count('пики'); lab.popup(at, 'Пик!', '#ffd23f', 18); }
      }
    }
  },

  // ввод: полоса, прыжок, подкат; нажатие чуть раньше не теряется
  control(lab, dt) {
    const st = lab.state, h = st.hero, p = lab.p1, cfg = lab.cfg;
    if (p.pressed.left) st.qLane = { d: -1, t: 0.2 };
    if (p.pressed.right) st.qLane = { d: 1, t: 0.2 };
    if (p.pressed.up || p.pressed.a) st.qJump = 0.18;
    if (p.pressed.down || p.pressed.b) st.qSlide = 0.18;
    if (st.qLane && (st.qLane.t -= dt) <= 0) st.qLane = null;
    st.qJump -= dt; st.qSlide -= dt;
    if (st.qLane && Math.abs(h.x - this.LANES[h.lane]) < 0.7) {
      const to = h.lane + st.qLane.d;
      if (to >= 0 && to <= 2) { st.lc = { t: lab.t, from: h.lane }; h.lane = to; lab.tone(320, 0.06, 'triangle', 0.04, 520); }
      else { lab.shake(0.12); lab.noise(0.08, 0.06, 500); lab.burst(lab.v3(h.x + st.qLane.d * 1.2, 1, 0), { count: 6, color: '#c9a46e', speed: 3, size: 0.12 }); }
      st.qLane = null;
    }
    const prev = h.x, step = (this.LANE / Math.max(0.04, cfg.laneTime)) * dt, dx = this.LANES[h.lane] - h.x;
    h.x += lab.clamp(dx, -step, step);
    h.vx = dt > 0 ? (h.x - prev) / dt : 0;
    const v0 = (4 * cfg.jumpH) / cfg.jumpTime, g = (8 * cfg.jumpH) / (cfg.jumpTime * cfg.jumpTime);
    if (st.qJump > 0 && !h.air) { // прыжок: сжатие, рывок вверх, пыль из-под копыт
      h.air = true; h.vy = v0; h.slide = 0; st.qJump = 0; st.jumps++; lab.count('прыжки');
      lab.sfx.jump(); lab.pulse(h.body, 1.12, 0.12);
      lab.burst(lab.v3(h.x, 0.2, 0.6), { count: 8, colors: ['#d9b98a', '#bf9a68'], speed: 3, size: 0.16, dir: [0, 0.3, 1] });
    }
    if (st.qSlide > 0) {
      if (h.air) { h.vy = Math.min(h.vy, -v0 * 1.15); h.slideAfter = true; st.qSlide = 0; } // вниз в прыжке — к земле и сразу в подкат
      else if (h.slide <= 0.1) this.startSlide(lab);
    }
    if (h.air) {
      h.vy -= g * dt; h.y += h.vy * dt;
      if (h.y <= 0) {
        h.y = 0; h.air = false; h.vy = 0; h.land = 1;
        lab.pulse(h.body, 0.86, 0.12); lab.noise(0.06, 0.07, 900);
        lab.burst(lab.v3(h.x, 0.15, 0), { count: 10, colors: ['#d9b98a', '#bf9a68', '#e9d4b0'], speed: 4, size: 0.18, dir: [0, 0.2, 1] });
        if (h.slideAfter) { h.slideAfter = false; this.startSlide(lab); }
      }
    }
    h.slide = Math.max(0, h.slide - dt);
  },
  startSlide(lab) {
    const st = lab.state, h = st.hero;
    h.slide = lab.cfg.slideTime; st.qSlide = 0; st.slides++; lab.count('подкаты');
    lab.sfx.whoosh();
    lab.burst(lab.v3(h.x, 0.15, 0.4), { count: 12, colors: ['#d9b98a', '#bf9a68'], speed: 5, size: 0.15, dir: [0, 0.1, 1] });
  },

  // преграды: видно издалека, растут из земли на краю видимости, бьют только того, кто на их полосе
  moveObs(lab, dt) {
    const st = lab.state, h = st.hero, cfg = lab.cfg;
    for (const ob of st.obs) {
      if (ob.dead) continue;
      if (ob.moving) ob.s -= ob.vel * dt;
      const ahead = ob.s - st.dist;
      if (!ob.vis && ahead < cfg.sight * (ob.moving ? 1.5 : 1)) {
        ob.vis = true;
        lab.tween(0.3, k => { ob.g = k; }, 'outBack');
        if (ob.moving) { lab.tone(1250, 0.12, 'sine', 0.05); lab.tone(1250, 0.12, 'sine', 0.05, 0, 0.18); } // колокольчик встречной арбы
      }
      if (ob.kind === 'rock' && !ob.landed) {
        if (!ob.falling && ahead < Math.max(10, st.speed * 2)) { ob.falling = true; lab.noise(0.5, 0.05, 300); }
        if (ob.falling) {
          ob.vy += 34 * dt; ob.y -= ob.vy * dt; ob.rot += dt * 5;
          if (ob.y <= 0) {
            ob.y = 0; ob.landed = true;
            const z = st.dist - ob.s;
            lab.shake(0.22); lab.noise(0.25, 0.12, 200); lab.tone(60, 0.25, 'sine', 0.12, 40);
            lab.burst(lab.v3(ob.x, 0.4, z), { count: 18, colors: ['#d9c3a2', '#a08a7c', '#ffffff'], speed: 6, size: 0.25 });
            lab.ring(lab.v3(ob.x, 0.05, z), { color: '#e3cfae', radius: 2.2 });
          }
        }
      }
      const front = ob.s - ob.len / 2, back = ob.s + ob.len / 2;
      if (ob.hit || ob.passed) { if (back < st.dist - 14) this.dropOb(lab, ob); continue; }
      if (front > st.dist + 0.85) continue;
      if (back < st.dist - 0.85) { ob.passed = true; this.passed(lab, ob); continue; }
      if (ob.lane >= 0 && Math.abs(h.x - ob.x) > 1.4) continue;
      if (this.clears(lab, ob)) { ob.cleared = true; ob.margin = Math.min(ob.margin == null ? 9 : ob.margin, this.margin(lab, ob)); continue; }
      this.crash(lab, ob);
    }
    st.obs = st.obs.filter(o => !o.dead);
  },
  clears(lab, ob) {
    const h = lab.state.hero, top = h.y + (h.slide > 0 ? this.SLIDE : this.STAND);
    if (ob.kind === 'log') return h.y > 0.62;
    if (ob.kind === 'arch' || ob.kind === 'arch3') return top < 1.75;
    if (ob.kind === 'rock') return !ob.landed && ob.y > 2.2;
    return false;
  },
  margin(lab, ob) { // запас: насколько впритык проскочил
    const h = lab.state.hero;
    if (ob.kind === 'log') return h.y - 0.62;
    return 1.75 - (h.y + this.SLIDE);
  },
  passed(lab, ob) { // проскочил: ловко над и под — очки, впритык мимо — очки и искры
    const st = lab.state, h = st.hero, at = lab.v3(h.x, 3.1, -0.8);
    if (ob.cleared) {
      st.clean++;
      if (ob.margin < 0.25) this.nearMiss(lab, ob, 'Впритык!');
      else lab.popup(at, ob.kind === 'log' ? 'Опп!' : 'Ловко!', '#ffe9a8', 14);
      return;
    }
    if (ob.lane >= 0 && st.lc.from === ob.lane && lab.t - st.lc.t < 0.45 + ob.len / Math.max(4, st.speed)) this.nearMiss(lab, ob, 'Впритык!');
  },
  nearMiss(lab, ob, text) {
    const st = lab.state, h = st.hero, mult = this.mult(lab);
    st.near++; lab.count('почти');
    lab.addScore(50 * mult, lab.v3(h.x, 3.2, -0.8), '#7cf5ff');
    lab.popup(lab.v3(h.x, 3.9, -1), text, '#7cf5ff', 18);
    lab.burst(lab.v3((h.x + ob.x) / 2 || h.x, 1.3, 0), { count: 12, colors: ['#7cf5ff', '#ffffff'], speed: 6, size: 0.12, dir: [0, 0, 1] });
    lab.tone(1320, 0.06, 'square', 0.04, 1760);
  },
  crash(lab, ob) {
    const st = lab.state, h = st.hero, cfg = lab.cfg, z = st.dist - ob.s, at = lab.v3(h.x, 1.4, -0.6);
    ob.hit = true;
    const colors = { log: ['#8b5a32', '#ff7a1f', '#ecc28a'], arch: ['#82502c', '#ff4f3a'], arch3: ['#82502c', '#ff4f3a', '#ffd23f'], cart: ['#d2552b', '#f2c14e', '#4a3020'], rock: ['#a08a7c', '#d9c3a2', '#ff6a3a'] }[ob.kind];
    lab.burst(lab.v3(ob.x, 1.2, z), { count: 26, colors, speed: 8, size: 0.3, dir: [0, 0.4, 1] });
    lab.hitstop(0.07);
    this.dropOb(lab, ob);
    if (cfg.board >= 1 && st.burka.ready) { // бурка прощает один удар
      st.burka.ready = false; st.burka.t = 20; lab.invuln = 1.2; lab.count('бурка');
      lab.shake(0.45); lab.popup(lab.v3(h.x, 3.8, -1), 'Бурка спасла!', '#ffd23f', 22); lab.sfx.power();
      const b = h.burka; lab.tween(0.5, k => { b.position.y = 0.52 + k * 1.6; b.position.z = -0.22 - k * 2; b.scale.setScalar(1 - k); }, 'outQuad');
      return;
    }
    const text = { log: 'Конь споткнулся о бревно', arch: 'Нарт ударился о перекладину', arch3: 'Нарт ударился о перекладину', cart: 'Врезался в арбу', rock: 'Камнепад' }[ob.kind];
    if (!lab.hurt(at, text)) return;
    st.hitsAt.push(Math.round(lab.t)); lab.count('удары');
    st.stumble = 0.9;
    if (st.streak >= 10) { lab.popup(lab.v3(h.x, 4.2, -1), 'Серия сорвана', '#ff8a7a', 16); lab.tone(220, 0.25, 'sawtooth', 0.05, 110); }
    st.streak = 0;
    if (cfg.chase >= 1) {
      st.chaseGap -= 0.5;
      if (st.chaseGap <= 0) lab.after(0.25, () => { if (lab.playing) { lab.slowmo(0.6, 0.3); lab.gameOver('Лавина догнала'); } });
    }
  },
  mult(lab) { const s = lab.state.streak; for (const [n, m] of this.STREAK) if (s >= n) return m; return 1; },
  moveShoes(lab, dt) {
    const st = lab.state, h = st.hero;
    for (const sh of st.shoes) {
      if (sh.dead) continue;
      const ahead = sh.s - st.dist;
      if (ahead < -3) { this.dropShoe(lab, sh); continue; }
      if (Math.abs(ahead) < 1.0 && Math.abs(h.x - sh.x) < 1.0 && Math.abs(h.y + (h.slide > 0 ? 0.7 : 1.1) - sh.y) < 0.8) {
        st.streak++; st.bestStreak = Math.max(st.bestStreak, st.streak); st.shoesTaken++; lab.count('подковы');
        const m = this.mult(lab), where = lab.v3(sh.x, sh.y + 0.3, -ahead);
        lab.addScore(10 * m, null);
        lab.tone(880 * lab.pitch(st.streak % 12), 0.07, 'square', 0.035);
        lab.burst(where, { count: 7, colors: ['#ffd23f', '#fff3a0'], speed: 4, size: 0.12, dir: [0, 0.5, 1] });
        if ([15, 40, 80, 130].includes(st.streak)) { lab.popup(lab.v3(h.x, 4, -1.5), `Серия ×${m}!`, '#ffd23f', 24); lab.sfx.power(); lab.pulse(h.body, 1.15, 0.16); }
        this.dropShoe(lab, sh);
      }
    }
    st.shoes = st.shoes.filter(s => !s.dead);
  },
  drawAll(lab, dt) {
    const st = lab.state;
    for (const ob of st.obs) if (!ob.dead) this.drawOb(lab, ob);
    const m = st.shoeMesh, sight = lab.cfg.sight;
    for (const sh of st.shoes) {
      const ahead = sh.s - st.dist, k = lab.clamp((sight - ahead) / 6, 0, 1);
      this.setM(lab, m, sh.slot, sh.x, sh.y + Math.sin(lab.t * 3 + sh.s) * 0.06, -ahead, 0, lab.t * 3 + sh.s * 0.4, k, k, k);
    }
    void dt;
  },

  // лавина: удар — ближе, время — дальше
  chaseStep(lab, dt) {
    const st = lab.state;
    if (!st.ava) return;
    st.chaseGap = Math.min(1, st.chaseGap + dt * 0.035);
    const z = 1.6 + st.chaseGap * 13;
    st.ava.position.z = lab.damp(st.ava.position.z, z, 3, dt);
    st.avaDust.forEach((b, i) => { b.position.y = 1 + Math.sin(lab.t * 3 + i) * 0.3; b.scale.y = 1.4 + Math.sin(lab.t * 2.3 + i * 2) * 0.25; });
    st.avaRocks.forEach((r, i) => { r.rotation.x -= dt * 8; r.position.y = 0.6 + Math.abs(Math.sin(lab.t * 6 + i)) * 0.4; });
    if (st.chaseGap < 0.45 && (st.rumble = (st.rumble || 0) - dt) <= 0) {
      st.rumble = 0.35; lab.noise(0.3, 0.05 * (1 - st.chaseGap), 180); lab.shake(0.08 * (1 - st.chaseGap));
      lab.burst(lab.v3(lab.rand(-4, 4), 0.6, 3.5), { count: 6, colors: ['#e3cfae', '#c9b38f'], speed: 3, size: 0.4, up: 4 });
    }
  },
  burkaStep(lab, dt) {
    const st = lab.state, b = st.burka, h = st.hero;
    if (lab.cfg.board < 1 || b.ready) return;
    b.t -= dt;
    if (b.t <= 0) {
      b.ready = true; h.burka.position.set(0, 0.52, -0.22); h.burka.scale.setScalar(1);
      lab.pulse(h.burka, 1.3, 0.2); lab.popup(lab.v3(h.x, 3.6, -1), 'Бурка высохла', '#ffd23f', 15); lab.tone(660, 0.1, 'triangle', 0.05, 990);
    }
  },
  // живое без игрока: птицы кружат, облака плывут, линии скорости, брызги водопадов, вода блестит
  life(lab, dt) {
    const st = lab.state, tm = st.tm, vk = lab.clamp((st.speed - 12) / 14, 0, 1);
    st.birds.forEach((b, i) => {
      b.ph += dt * b.w;
      const x = Math.cos(b.ph) * b.r, z = b.z + Math.sin(b.ph) * b.r * 0.6, flap = Math.sin(lab.t * 9 + i) * 0.5, yaw = -b.ph;
      for (const s of [1, -1]) {
        tm.e.set(0, yaw + (s < 0 ? Math.PI : 0), s * flap); tm.q.setFromEuler(tm.e); tm.p.set(x, b.y, z); tm.s.set(1, 1, 1);
        tm.m.compose(tm.p, tm.q, tm.s); st.birdMesh.setMatrixAt(i * 2 + (s < 0 ? 1 : 0), tm.m);
      }
    });
    st.birdMesh.instanceMatrix.needsUpdate = true;
    st.clouds.forEach((c, i) => { c.position.x += dt * (0.6 + i * 0.05); if (c.position.x > 40) c.position.x = -40; });
    st.lines.forEach((l, i) => {
      l.z += st.speed * 1.6 * dt;
      if (l.z > 8) { l.z -= 38; l.x = lab.pick([-1, 1]) * lab.rand(2.5, 7); l.y = lab.rand(0.6, 6); }
      this.setM(lab, st.lineMesh, i, l.x, l.y, l.z, 0, 0, vk, vk, vk * (0.6 + vk));
    });
    st.water.material.color.setHSL(0.52, 0.62, 0.43 + Math.sin(lab.t * 1.7) * 0.02);
    if ((st.sprayT -= dt) <= 0) { // брызги у подножия водопадов
      st.sprayT = 0.3;
      for (const it of st.falls.items) { const z = st.dist - it.s; if (z > -60 && z < 4) lab.burst(lab.v3(it.x + 0.5, 0.4, z), { count: 4, color: '#eafcff', speed: 2.5, size: 0.14, up: 3 }); }
    }
    if (!st.hero.air && st.hero.slide <= 0 && (st.dust = (st.dust || 0) - dt) <= 0) { // пыль из-под копыт
      st.dust = 0.16;
      lab.burst(lab.v3(st.hero.x + lab.rand(-0.3, 0.3), 0.1, 0.7), { count: 2, colors: ['#d9b98a', '#c9a46e'], speed: 2 + vk * 3, size: 0.13, dir: [0, 0.2, 1], life: 0.45 });
    }
    // в передышке светлее: солнце заглядывает в расступившееся ущелье
    lab.light.hemi.intensity = lab.damp(lab.light.hemi.intensity, st.inRest ? 1.25 : 1.0, 2, dt);
  },
  // музыка партии: топот копыт и барабан частят со скоростью, барабан громче к пику и молчит на передышке
  music(lab, dt, info) {
    const st = lab.state, rest = info.rest;
    const stride = 4.2 / Math.max(4, st.speed);
    if ((st.hoof -= dt) <= 0) {
      st.hoof = stride / 2;
      if (!st.hero.air) { const v = rest ? 0.018 : 0.035; lab.tone(170 + lab.rand(-15, 15), 0.035, 'triangle', v); lab.noise(0.025, v * 0.7, 1600); }
    }
    if ((st.beat -= dt) <= 0) {
      st.beat = lab.clamp(0.62 * (11 / Math.max(6, st.speed)), 0.22, 0.75);
      if (!rest && lab.t > 2) { const D = lab.clamp(info.D, 0, 1.2); lab.tone(95, 0.12, 'sine', 0.03 + 0.07 * D, 60); if (D > 0.55) lab.noise(0.04, 0.02 + 0.03 * D, 3000, 0.0); }
    }
  },

  // живая камера за спиной: шире угол на скорости, крен на смене полосы, наезд на передышке и толчок на «Быстрее!»
  cameraStep(lab, dt, snap) {
    const st = lab.state, h = st.hero, C = st.cam, cam = lab.camera;
    if (!cam || !C) return;
    const vk = lab.clamp((st.speed - 8) / 22, 0, 1.3), k = snap ? 1 : 0;
    C.punch = Math.max(0, C.punch - (dt || 0) * 1.4);
    const d = (a, b, r) => (k ? b : lab.damp(a, b, r, dt));
    C.fov = d(C.fov, 58 + 15 * vk + C.punch * 6, 3);
    C.x = d(C.x, h.x * 0.62, 7);
    C.y = d(C.y, 3.9 + h.y * 0.45 + (st.inRest ? 0.5 : 0) - C.punch * 0.4, 4);
    const bob = h.air ? 0 : Math.abs(Math.sin(h.ph)) * 0.05 * (0.4 + vk);
    cam.position.set(C.x + Math.sin(lab.t * 0.4) * 0.12, C.y + bob, 7.0 - vk * 0.7 + C.punch * 0.8);
    cam.lookAt(h.x * 0.78, 1.25 + h.y * 0.35, -14);
    cam.rotateZ(-h.vx * 0.006);
    if (Math.abs(cam.fov - C.fov) > 0.01) { cam.fov = C.fov; cam.updateProjectionMatrix(); }
    lab.view.target.set(h.x, 0, -12); // тень солнца там, где скачет конь
  },
  hudStep(lab, info) {
    const st = lab.state, cfg = lab.cfg, v = this.variant(lab), m = this.mult(lab);
    lab.hud('rule', `${v.name}: ${v.how}`, { color: '#ffe680', size: 14 });
    lab.hud('run', `🏇 ${Math.round(st.dist)} м · ${Math.round(st.speed)} м/с`, { color: '#fff1d0', size: 16 });
    lab.hud('series', st.streak >= 3 ? `Подковы подряд: ${st.streak}` + (m > 1 ? ` · очки ×${m}` : '') : null, { color: '#ffd23f', size: m > 1 ? 17 : 14 });
    lab.hud('hint', lab.t < 9 ? '← → полоса · ↑ или A — прыжок · ↓ или B — подкат' : null, { color: '#ffffff', size: 14 });
    if (st.curve || cfg.showCurve >= 1) {
      const w = Math.floor(lab.t / 10), g = st.glyphs.map((c, i) => (i === w ? '●' : c)).join('');
      let tail = '';
      if (info.saw) tail = info.rest ? ` · передышка ${Math.ceil(info.restLeft)} с` : ` · участок ${info.seg + 1} · пик через ${Math.ceil(info.peakIn)} с`;
      lab.hud('curve', `${st.curve ? 'Твоя кривая' : 'Кривая'}: ${g}${lab.t >= 120 ? ' ▶ дальше выше' : ''}${tail}`, { color: '#bfe8ff', size: 14 });
    } else lab.hud('curve', null);
    if (cfg.board >= 1) lab.hud('board', st.burka.ready ? '🧥 Бурка готова' : `🧥 Бурка сохнет: ${Math.ceil(st.burka.t)} с`, { color: st.burka.ready ? '#ffd23f' : '#c8c0d8', size: 14 });
    if (cfg.chase >= 1) { const n = Math.round((1 - st.chaseGap) * 8); lab.hud('chase', `Лавина: ${'█'.repeat(n)}${'░'.repeat(8 - n)}${st.chaseGap < 0.35 ? ' — близко!' : ''}`, { color: st.chaseGap < 0.35 ? '#ff5d5d' : '#e3cfae', size: st.chaseGap < 0.35 ? 17 : 14 }); }
  },

  overNote(lab) {
    const st = lab.state, cfg = lab.cfg, v = this.variant(lab), out = [];
    out.push(`Вариация: ${v.name} (как ${v.like}) — ${v.how}`);
    out.push(`Продержался ${Math.round(lab.t)} с · ${Math.round(st.dist)} м · наибольшая скорость ${Math.round(st.vmax)} м/с`);
    if (st.curve) out.push(`Твоя кривая: ${st.glyphs.join('')} · пиков пройдено: ${st.peaks}, передышек: ${st.rests}`);
    else if (cfg.secret >= 0.5) out.push(`Передышек: ${st.rests} · пиков пройдено: ${st.peaks}`);
    out.push(st.hitsAt.length ? `Удары: на ${st.hitsAt.join(', ')} с` : 'Ни одного удара');
    out.push(`Подков: ${st.shoesTaken}, лучшая серия ${st.bestStreak} · впритык: ${st.near} · прыжков ${st.jumps}, подкатов ${st.slides}`);
    if (cfg.secret < 0.5 && !st.curve) out.push('Спрятанная механика выключена: трудность росла ровно, без передышек. Заметил разницу?');
    return out;
  },
};
