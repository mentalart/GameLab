// «Бомбы во дворе» — ремейк-донор урока 26 по мотивам механики Bomberman (Hudson Soft, 1983), на оболочке «Лаб3D 1.0» (three.js).
// Урок 26 «Один экран — два игрока, одна арена — весь класс». Два героя на одном экране: дуэль, кооператив против иныжей
// или асимметрия «бегун и минёр». Друг рядом кричит — и это лучшая часть игры.
// Лучшие игры жанра, из которых взяты моменты (разбор — docs/журнал/модуль-7.md, раздел урока 26):
//   Bomberman (1983) и Super Bomberman (1993) — сетка столбов, ящики, крест огня, бонусы «огонь», «бомба», «скорость»;
//   Super Bomberman 3 (1995) — месть духа: выбывший катается по краю и бросает бомбы во двор, попал — вернулся;
//   Bomberman 64 и Saturn Bomberman — пинок бомбы: бомба скользит до препятствия, её можно отправить сопернику;
//   Super Bomberman — «давление»: в конце раунда двор сжимается по спирали, и игроки встречаются в центре;
//   Overcooked (2016) — общая цель и общие сердца: выбывшего друга можно поднять, если успеть к нему;
//   Keep Talking and Nobody Explodes (2015) и «кошки-мышки» Pac-Man Vs. (2003) — асимметрия: у двоих разные роли и разное знание.
// Ось Z в three.js смотрит на игрока: двор — сетка 13 × 11 клеток по 1,6 м, вид сверху наискосок, весь двор в кадре.
/* ПЛАН
   Фраза игры: вы — Аслан и Мадина, двое ребят в дворе аула. Вы ставите пороховые бомбы-хлопушки, взрываете кадки и стога,
   собираете бонусы — и ловите друг друга крестом огня. Цель — выиграть три раунда.
   Ядро на 3 секунды: A — бомба у ног → фитиль шипит, крест будущего взрыва краснеет на земле → бум: кадки разлетаются, из стога выпал бонус.
   Выбор, оплаченный очками: бежать за бонусом к сопернику (огонь +1 — дальше крест) или взрывать ящики у себя;
   поставить бомбу так, чтобы закрыть сопернику выход (подловил — +200), рискуя запереться самому; пнуть бомбу (B) в его сторону.
   Угрозы: свой огонь, огонь соседа, пинок бомбы, месть духа с плетня, сжатие двора; в кооперативе — иныжи (медленные, охотятся)
   и бесенята (быстрые, бродят); в асимметрии — бомбы минёра с неба.
   Кривая раунда: 0–10 с — двор полон ящиков, урона от соседа нет: он далеко; 10–40 — проходы открываются, бонусы, первые встречи;
   40–70 — двор пустеет, бомбы чаще, огонь длиннее; с 60-й секунды двор сжимается по спирали — встреча в центре неизбежна.
   События: бонус выпал, крест огня цепочкой, «Подловил!», «Чуть не подловил!», месть духа (вернулся!), «Спас друга!»,
   сжатие двора, раунд за игроком, счёт матча, волна иныжей, «Двор чист!», смена ролей бегуна и минёра.
   Лицо игры: тёплый вечерний двор аула — зелёная трава клетками, серые столбы с мхом, жёлтые стога и кадки,
   белые сакли с красными крышами за плетнём, тополя и горы в розовом закате.
   Свет: тёплое низкое солнце, длинные тени; огонь и фитили светятся.
   Палитра: трава #5cc26a и #4bb05c, столбы #8d9bb0, стога #ffd34d, кадки #b9773f, Аслан #ff5d6e, Мадина #4fb8ff,
   огонь #ff8a2a, опасность #ff3d4a, бонусы #ffd23f.
   Три фирменных приёма: крест будущего взрыва краснеет на траве заранее; бомба надувается и белеет перед взрывом;
   выбывший — прозрачный дух на плетне, который не сдаётся.
*/
const GAME = {
  engine: 'three',
  title: 'Бомбы во дворе',
  subtitle: 'Двор аула, двое ребят и пороховые бомбы. Взрывай кадки, собирай бонусы и лови соседа крестом огня. До трёх побед.',
  donor: 'Bomberman',
  players: 1,
  lives: 0, // сердец у героя нет: выбыл — раунд за соседом (в кооперативе — общие сердца в HUD)
  duo: 'vdvoem', // ручка «Вдвоём»: второй — человек (WASD + F/G у первого, стрелки + K/L у второго, или по геймпаду); иначе второй — бот
  controls: [
    { input: 'move4', text: 'бегать' },
    { input: 'a', text: 'бомба · в «Минёре» — бросить с неба, у бегуна — рывок' },
    { input: 'b', text: 'пнуть бомбу перед собой' },
  ],
  camera: { type: 'iso', tilt: 0.6, fov: 0.7 },
  field: { w: 23, h: 19.5 },
  shadowSize: 18,
  sky: ['#4a6fb8', '#ffb38a'],
  fog: 0.008,
  accent: '#ffd23f',
  scoreColor: '#ff8a96',
  decisions: [
    'Чувство: «подловил!» и «ну погоди!» — крик соседа рядом важнее любого взрыва на экране',
    'Честность: крест будущего взрыва краснеет на траве заранее, бомба надувается и белеет перед взрывом; первые секунды соседи далеко',
    'Выбор: взрывать ящики у себя или бежать за бонусом к сопернику; поставить бомбу так, чтобы закрыть ему выход, рискуя запереться самому',
  ],
  notes: [
    'Если второй игрок не нажимает ничего, им играет бот; первое нажатие второго игрока — и бот отдаёт ему героя.',
    'Раунд не бесконечен: с 60-й секунды двор сжимается по спирали, и игроки встречаются в центре.',
    'Месть духа — раз за раунд: выбывший катается по плетню и бросает бомбы, попал — меняется местами с соседом.',
  ],
  config: {
    secret: { value: 1, min: 0, max: 1, step: 1, label: 'Спрятанная механика', hint: '1 — как задумано; 0 — выключена', restart: true },
    vdvoem: { value: 0, min: 0, max: 1, step: 1, label: 'Вдвоём на одной клавиатуре', hint: '1 — второй игрок: стрелки + K/L, первый — WASD + F/G (или по геймпаду); 0 — второй — бот', restart: true, names: ['нет, второй — бот', 'да'] },
    rezhim: { value: 0, min: 0, max: 2, step: 1, label: 'Как играем вместе', restart: true, names: ['дуэль', 'вместе против иныжей', 'бегун и минёр'] },
    pobed: { value: 3, min: 1, max: 5, step: 1, label: 'Побед до конца матча', restart: true },
    fuse: { value: 2.4, min: 1.2, max: 4, step: 0.1, label: 'Фитиль бомбы, с' },
    ogon: { value: 2, min: 1, max: 6, step: 1, label: 'Огонь на старте, клеток', restart: true },
    bomb: { value: 1, min: 1, max: 5, step: 1, label: 'Бомб на старте', restart: true },
    beg: { value: 3.6, min: 2, max: 7, step: 0.2, label: 'Скорость бега, клеток в секунду' },
    yashchiki: { value: 0.72, min: 0.2, max: 0.95, step: 0.01, label: 'Доля клеток с ящиками', restart: true },
    bonus: { value: 0.32, min: 0, max: 0.8, step: 0.02, label: 'Доля ящиков с бонусом' },
    shchit: { value: 8, min: 0, max: 20, step: 1, label: 'Щит в начале раунда, с', hint: 'первые секунды раунда огонь не страшен: успеть понять бомбу' },
    szhat: { value: 60, min: 0, max: 150, step: 5, label: 'Двор сжимается с, с', hint: '0 — не сжимается' },
    podsvetka: { value: 1, min: 0, max: 1, step: 1, label: 'Крест будущего взрыва краснеет', hint: 'видно = правда; 0 — как в классике' },
    bot: { value: 1, min: 0.3, max: 1.6, step: 0.1, label: 'Ловкость бота', hint: 'реакция и смелость второго игрока, когда им играет бот' },
    // вариации жанра из настоящих игр: 0 — как в классике
    mest: { value: 1, min: 0, max: 1, step: 1, label: 'Месть духа', hint: 'как в Super Bomberman 3: выбывший бросает бомбы с плетня; попал — вернулся' },
    obshchie: { value: 0, min: 0, max: 1, step: 1, label: 'Вариация «Общие бонусы»: бонус достаётся обоим' },
    dvor: { value: 0, min: 0, max: 1, step: 1, label: 'Вариация «Тесный двор»: 11 × 9 и сжатие с 30-й секунды', restart: true },
    serdca: { value: 3, min: 1, max: 9, step: 1, label: 'Общих сердец (вместе против иныжей)', restart: true },
  },
  presets: {
    'Новичок': { fuse: 2.8, beg: 4, bot: 0.6, ogon: 2, szhat: 80, podsvetka: 1, serdca: 5 },
    'Без спрятанной механики': { secret: 0 },
    'Вдвоём': { vdvoem: 1 },
    // вариации из настоящих игр: те же значения — в сценарии урока 26 (VARIATIONS), держать вместе
    'Вместе против иныжей': { rezhim: 1 },
    'Бегун и минёр': { rezhim: 2 },
    'Без мести духа': { mest: 0 },
    'Общие бонусы': { obshchie: 1 },
    'Тесный двор': { dvor: 1 },
  },
  C: 1.6, // клетка двора, м
  NAMES: ['Аслан', 'Мадина'],
  COLORS: ['#ff5d6e', '#4fb8ff'],
  PU: {
    ogon: { icon: '🔥', name: 'Огонь +1', color: '#ff8a2a' },
    bomba: { icon: '💣', name: 'Бомба +1', color: '#ffd23f' },
    beg: { icon: '👟', name: 'Быстрее', color: '#7cf5a8' },
  },
  DIRS: [[1, 0], [-1, 0], [0, 1], [0, -1]],

  // ---------- новая партия ----------
  start(lab, scene) {
    const T = lab.THREE, st = lab.state, cfg = lab.cfg;
    const tight = cfg.dvor >= 1;
    Object.assign(st, {
      W: tight ? 11 : 13, H: tight ? 9 : 11, mode: Math.round(cfg.rezhim), solo: cfg.secret < 1,
      wt: 0, round: 0, phase: 'intro', pauseT: 1.4, rt: 0, wins: [0, 0], p2pts: 0, p2human: lab.players >= 2 ? false : null,
      bombs: [], flames: [], pus: [], enemies: [], apples: [], applesGot: 0, hearts: Math.round(cfg.serdca), wave: 0,
      press: null, revenge: null, hawk: null, roles: ['begun', 'miner'], lastMeet: -9, said: {},
      inter: 0, caught: 0, almost: 0, revenges: 0, revives: 0, kicks: 0, crates: 0, pickups: 0, interAt: [],
      tmp: { c: new T.Color() },
    });
    st.N = st.W * st.H;
    st.grid = new Uint8Array(st.N); st.flameT = new Float32Array(st.N); st.danger = new Float32Array(st.N); st.puAt = new Int8Array(st.N).fill(-1);
    lab.light.sun.color.set('#ffd9b0'); lab.light.sun.intensity = 1.9; lab.light.hemi.intensity = 0.95;
    this.scenery(lab, scene);
    this.parts(lab, scene);
    this.heroes(lab, scene);
    this.newRound(lab, true);
    if (!lab.playing) this.poster(lab);
    this.draw(lab, 0);
  },

  // ---------- координаты ----------
  wx(st, i) { return (i - (st.W - 1) / 2) * this.C; },
  wz(st, j) { return (j - (st.H - 1) / 2) * this.C; },
  at(st, x, y, h = 0) { return [this.wx(st, x), h, this.wz(st, y)]; },
  idx(st, i, j) { return j * st.W + i; },
  inside(st, i, j) { return i >= 0 && j >= 0 && i < st.W && j < st.H; },
  mid(st) { return (st.W - 1) / 2; },
  pillar(st, i, j) { return i % 2 === 1 && j % 2 === 1; },
  spawnCell(st, k) { return k === 0 ? [0, st.H - 1] : [st.W - 1, 0]; },

  // ---------- мир: двор, плетень, сакли, тополя, горы ----------
  scenery(lab, scene) {
    const T = lab.THREE, st = lab.state, C = this.C, W = st.W, H = st.H;
    const fw = W * C, fh = H * C;
    lab.ground({ w: 120, h: 120, color: '#6fae5a', bumps: 1.4, flat: 0.32 });
    // трава двора клетками двух оттенков
    const tile = lab.instances(new T.BoxGeometry(C * 0.98, 0.12, C * 0.98), '#ffffff', st.N, { shadow: false });
    for (let j = 0; j < H; j++) for (let i = 0; i < W; i++) lab.place(tile, this.idx(st, i, j), [this.wx(st, i), 0.03, this.wz(st, j)], { color: (i + j) % 2 ? '#5cc26a' : '#4bb05c' });
    tile.receiveShadow = true;
    // утоптанная дорожка вокруг двора
    lab.box(fw + 2.4, 0.08, fh + 2.4, '#c8b07a', { at: [0, 0.01, 0], shadow: false });
    // плетень: столбики и прутья, по краю двора
    const fence = [], R = (fw + 2.2) / 2, Rz = (fh + 2.2) / 2;
    for (let x = -R; x <= R + 0.01; x += 1.1) for (const z of [-Rz, Rz]) fence.push(lab.cyl(0.08, 0.1, 1.3, '#7a5230', { at: [x, 0.65, z], sides: 5 }));
    for (let z = -Rz; z <= Rz + 0.01; z += 1.1) for (const x of [-R, R]) fence.push(lab.cyl(0.08, 0.1, 1.3, '#7a5230', { at: [x, 0.65, z], sides: 5 }));
    for (const h of [0.45, 0.8, 1.1]) {
      fence.push(lab.box(2 * R, 0.1, 0.12, '#a87a46', { at: [0, h, -Rz] }), lab.box(2 * R, 0.1, 0.12, '#a87a46', { at: [0, h, Rz] }));
      fence.push(lab.box(0.12, 0.1, 2 * Rz, '#a87a46', { at: [-R, h, 0] }), lab.box(0.12, 0.1, 2 * Rz, '#a87a46', { at: [R, h, 0] }));
    }
    lab.merge(fence);
    st.fenceR = [R, Rz];
    // сакли за плетнём: белые стены, красные крыши, тёмные окна
    const houses = [];
    const house = (x, z, rot, s) => {
      const g = lab.group({ at: [x, 0, z], rot, scale: s });
      lab.box(3.6, 2.2, 2.8, '#f3ead8', { at: [0, 1.1, 0], parent: g });
      lab.box(4.0, 0.25, 3.2, '#c94a3a', { at: [0, 2.3, 0], parent: g });
      lab.mesh(new T.ConeGeometry(2.7, 1.3, 4).rotateY(Math.PI / 4), '#d8573f', { at: [0, 3.05, 0], scale: [1, 1, 0.8], parent: g });
      lab.box(0.7, 0.8, 0.06, '#3a2a40', { at: [-0.9, 1.3, 1.42], parent: g });
      lab.box(0.7, 1.4, 0.06, '#6a3a24', { at: [0.8, 0.7, 1.42], parent: g });
      lab.box(0.3, 1, 0.3, '#9a8a7a', { at: [1.1, 3.2, -0.4], parent: g });
      houses.push(g);
    };
    house(-9, -Rz - 4.2, 0, 1); house(-2.5, -Rz - 5.4, 0.15, 1.15); house(5, -Rz - 4.4, -0.1, 1); house(11, -Rz - 6, 0.2, 1.2);
    house(-R - 4.6, -3, Math.PI / 2, 0.9); house(R + 4.8, 2, -Math.PI / 2, 0.95);
    lab.merge(houses);
    // тополя и яблони вокруг
    const trunks = lab.instances(new T.CylinderGeometry(0.12, 0.18, 1.4, 5), '#6a4a30', 34);
    const crowns = lab.instances(new T.IcosahedronGeometry(1, 0), '#ffffff', 34);
    for (let k = 0; k < 34; k++) {
      const side = k % 4, u = lab.rand(-1, 1);
      const x = side < 2 ? u * (R + 8) : (side === 2 ? -1 : 1) * lab.rand(R + 2.2, R + 9);
      const z = side < 2 ? (side ? 1 : -1) * lab.rand(Rz + 2.2, Rz + 12) : u * (Rz + 6);
      if (side === 1 && z < Rz + 5 && Math.abs(x) < 6) continue; // перед камерой не загораживаем двор
      const tall = lab.chance(0.55), s = lab.rand(0.8, 1.3);
      lab.place(trunks, k, [x, 0.7 * s, z], { scale: s });
      lab.place(crowns, k, [x, (tall ? 2.6 : 1.9) * s, z], { scale: tall ? [0.75 * s, 2.1 * s, 0.75 * s] : [1.3 * s, 1.1 * s, 1.3 * s], color: lab.pick(['#3f9a4a', '#4aa84f', '#2f8a45', '#5ab45a']) });
    }
    // горы и облака вдали
    const mounts = [];
    for (let k = 0; k < 9; k++) mounts.push(lab.cone(lab.rand(7, 13), lab.rand(8, 16), lab.pick(['#8a86b8', '#9a8fc0', '#7d7aa8']), { at: [-50 + k * 12.5, 0, -48 - lab.rand(0, 10)], sides: 5, shadow: false }));
    for (let k = 0; k < 5; k++) mounts.push(lab.cone(lab.rand(2, 3.5), lab.rand(1.2, 2.4), '#fff3f0', { at: [-50 + k * 25 + lab.rand(-3, 3), lab.rand(9, 13), -50], sides: 5, shadow: false }));
    lab.merge(mounts);
    st.clouds = [];
    for (let k = 0; k < 6; k++) {
      const c = lab.group({ at: [lab.rand(-40, 40), lab.rand(10, 15), lab.rand(-40, -26)] });
      for (let q = 0; q < 4; q++) lab.ball(lab.rand(1, 2), '#fff4ee', { at: [q * 1.6 - 2.4, lab.rand(-0.3, 0.4), 0], parent: c, shadow: false, detail: 0 });
      st.clouds.push(c);
    }
    // куры за плетнём — движение без игрока
    st.hens = [];
    for (let k = 0; k < 5; k++) {
      const g = lab.group({ at: [lab.rand(-R, R), 0, lab.chance(0.5) ? -Rz - lab.rand(1, 2.4) : Rz + lab.rand(1.4, 2.4)] });
      lab.ball(0.28, '#ffffff', { at: [0, 0.3, 0], parent: g, detail: 0 }); lab.ball(0.14, '#ffffff', { at: [0, 0.55, 0.2], parent: g, detail: 0 });
      lab.cone(0.06, 0.12, '#ff3d3d', { at: [0, 0.72, 0.2], parent: g, shadow: false }); lab.cone(0.05, 0.12, '#ffb020', { at: [0, 0.55, 0.36], rot: [Math.PI / 2, 0, 0], parent: g, shadow: false });
      st.hens.push({ g, t: lab.rand(0, 3), vx: lab.rand(-0.6, 0.6) });
    }
  },

  // ---------- детали раунда: столбы, ящики, огонь, бомбы, бонусы ----------
  parts(lab, scene) {
    const T = lab.THREE, st = lab.state, C = this.C;
    // столбы — неподвижные, их место не меняется весь матч
    const pil = [];
    for (let j = 0; j < st.H; j++) for (let i = 0; i < st.W; i++) if (this.pillar(st, i, j)) {
      pil.push(lab.box(C * 0.86, 1.25, C * 0.86, '#7f8ca3', { at: [this.wx(st, i), 0.62, this.wz(st, j)], round: 0.12 }));
      pil.push(lab.box(C * 0.92, 0.16, C * 0.92, '#c3ccda', { at: [this.wx(st, i), 1.3, this.wz(st, j)], round: 0.06 }));
      pil.push(lab.ball(0.26, '#5fae55', { at: [this.wx(st, i) - 0.38, 1.38, this.wz(st, j) - 0.36], scale: [1.3, 0.5, 1], detail: 0 }));
    }
    lab.merge(pil);
    // стена посередине (без спрятанной механики): каждый в своей половине
    if (st.solo && st.mode !== 2) {
      const m = Math.floor(this.mid(st)), wall = [];
      for (let j = 0; j < st.H; j++) {
        wall.push(lab.box(C * 0.5, 1.6, C * 0.98, '#a87a46', { at: [this.wx(st, m), 0.8, this.wz(st, j)] }));
        wall.push(lab.box(C * 0.56, 0.12, C * 0.98, '#7a5230', { at: [this.wx(st, m), 1.62, this.wz(st, j)] }));
      }
      lab.merge(wall);
    }
    // ящики: стога (жёлтые) и кадки (бурые); у каждой клетки своя копия, разбитая — размер 0
    st.hay = lab.instances(new T.BoxGeometry(C * 0.84, 1.0, C * 0.84), '#ffd34d', st.N);
    st.hayTop = lab.instances(new T.CylinderGeometry(C * 0.3, C * 0.42, 0.42, 6), '#ffe27a', st.N);
    st.tub = lab.instances(new T.CylinderGeometry(C * 0.4, C * 0.34, 1.0, 9), '#b9773f', st.N);
    st.tubRim = lab.instances(new T.TorusGeometry(C * 0.38, 0.06, 4, 12).rotateX(Math.PI / 2), '#5a4030', st.N, { shadow: false });
    st.press = null;
    st.pressIM = lab.instances(new T.BoxGeometry(C * 0.96, 1.4, C * 0.96), '#c9a26a', st.N);
    // огонь: светящийся крест, предупреждение: красные плитки
    st.fireIM = lab.instances(new T.BoxGeometry(C * 0.92, 0.7, C * 0.92), lab.mat('#ff8a2a', { glow: 1.6 }), st.N, { shadow: false });
    st.fireCore = lab.instances(new T.BoxGeometry(C * 0.5, 0.9, C * 0.5), lab.mat('#fff2a0', { glow: 2 }), st.N, { shadow: false });
    st.warnIM = lab.instances(new T.PlaneGeometry(C * 0.94, C * 0.94).rotateX(-Math.PI / 2), lab.mat('#ffffff', { alpha: 0.55, unlit: true }), st.N, { shadow: false });
    st.fireIM.frustumCulled = st.fireCore.frustumCulled = st.warnIM.frustumCulled = false;
    // бомбы: пул из 18
    st.bombPool = [];
    for (let k = 0; k < 18; k++) {
      const g = lab.group({ at: [0, -9, 0] });
      const body = lab.ball(0.5, '#232634', { at: [0, 0.52, 0], parent: g, shiny: true, smooth: true });
      lab.cyl(0.12, 0.14, 0.18, '#5a5f70', { at: [0, 1.02, 0], parent: g });
      lab.cyl(0.03, 0.03, 0.28, '#d9c08a', { at: [0.06, 1.2, 0], rot: [0, 0, -0.4], parent: g, shadow: false });
      const spark = lab.ball(0.1, lab.mat('#ffd060', { glow: 2 }), { at: [0.14, 1.36, 0], parent: g, shadow: false, detail: 0 });
      lab.ball(0.12, '#ffffff', { at: [-0.18, 0.75, 0.38], parent: g, shadow: false, detail: 0 });
      g.visible = false;
      st.bombPool.push({ g, body, spark, used: false });
    }
    // бонусы: пул из 14
    st.puPool = [];
    for (let k = 0; k < 14; k++) {
      const g = lab.group({ at: [0, -9, 0] });
      const base = lab.cyl(0.62, 0.62, 0.12, lab.mat('#ffd23f', { glow: 0.5 }), { at: [0, 0.1, 0], parent: g, shadow: false, sides: 10 });
      const ico = { ogon: lab.cone(0.32, 0.7, lab.mat('#ff8a2a', { glow: 1.2 }), { at: [0, 0.75, 0], parent: g, sides: 6 }),
        bomba: lab.ball(0.3, '#232634', { at: [0, 0.72, 0], parent: g }),
        beg: lab.box(0.5, 0.3, 0.7, lab.mat('#7cf5a8', { glow: 0.8 }), { at: [0, 0.7, 0], parent: g, round: 0.08 }) };
      g.visible = false;
      st.puPool.push({ g, base, ico, used: false });
    }
    // кооператив: иныжи и бесенята (пул)
    st.enemyPool = [];
    for (let k = 0; k < 10; k++) {
      const g = lab.group({ at: [0, -9, 0] });
      const body = lab.ball(0.6, '#7a5ab8', { at: [0, 0.75, 0], parent: g, scale: [1, 1.15, 1] });
      lab.ball(0.2, '#ffffff', { at: [-0.22, 0.95, 0.45], parent: g, shadow: false, detail: 0 }); lab.ball(0.2, '#ffffff', { at: [0.22, 0.95, 0.45], parent: g, shadow: false, detail: 0 });
      const eyes = lab.box(0.62, 0.16, 0.1, lab.mat('#ffef6a', { glow: 1.4 }), { at: [0, 1.0, 0.5], parent: g, shadow: false });
      const horn = lab.cone(0.16, 0.42, '#f3ead8', { at: [0, 1.55, 0], parent: g, sides: 5 });
      g.visible = false;
      st.enemyPool.push({ g, body, eyes, horn, used: false });
    }
    // яблоки (бегун и минёр) и прицел минёра
    st.appleIM = lab.instances(new T.IcosahedronGeometry(0.34, 1), lab.mat('#ffd23f', { glow: 0.9, shiny: true }), 4, { shadow: false });
    st.appleIM.frustumCulled = false;
    st.cross = lab.group({ at: [0, -9, 0] });
    lab.mesh(new T.RingGeometry(0.62, 0.8, 24).rotateX(-Math.PI / 2), lab.mat('#ff3d4a', { glow: 1.4, side: 'double' }), { at: [0, 0.12, 0], parent: st.cross, shadow: false });
    lab.box(1.5, 0.04, 0.08, lab.mat('#ff3d4a', { glow: 1.2 }), { at: [0, 0.13, 0], parent: st.cross, shadow: false });
    lab.box(0.08, 0.04, 1.5, lab.mat('#ff3d4a', { glow: 1.2 }), { at: [0, 0.13, 0], parent: st.cross, shadow: false });
    st.cross.visible = false;
    // вышка минёра за плетнём
    st.tower = lab.group({ at: [0, 0, -st.fenceR[1] - 1.8] });
    for (const dx of [-0.8, 0.8]) for (const dz of [-0.6, 0.6]) lab.cyl(0.09, 0.12, 3.2, '#7a5230', { at: [dx, 1.6, dz], parent: st.tower, sides: 5 });
    lab.box(2.2, 0.16, 1.8, '#a87a46', { at: [0, 3.2, 0], parent: st.tower });
    lab.cone(1.6, 0.9, '#c94a3a', { at: [0, 4.6, 0], parent: st.tower, sides: 4 });
    st.tower.visible = false;
  },

  // ---------- герои ----------
  heroes(lab, scene) {
    const st = lab.state;
    st.h = [0, 1].map(k => {
      const col = this.COLORS[k], g = lab.group({ at: [0, 0, 0] });
      const body = lab.group({ parent: g });
      lab.cyl(0.32, 0.42, 0.85, col, { at: [0, 0.62, 0], parent: body, sides: 8 }); // черкеска
      lab.box(0.5, 0.12, 0.3, '#ffe1a0', { at: [0, 0.82, 0.18], parent: body, shadow: false }); // газыри
      lab.cyl(0.08, 0.08, 0.38, '#3a2a30', { at: [-0.14, 0.17, 0], parent: body, sides: 5 });
      lab.cyl(0.08, 0.08, 0.38, '#3a2a30', { at: [0.14, 0.17, 0], parent: body, sides: 5 });
      const head = lab.ball(0.3, '#ffd2b0', { at: [0, 1.3, 0], parent: body });
      if (k === 0) lab.cyl(0.3, 0.32, 0.32, '#3a3040', { at: [0, 1.58, 0], parent: body, sides: 9 }); // папаха
      else { lab.ball(0.33, '#2a3a8a', { at: [0, 1.38, -0.05], parent: body, scale: [1.05, 0.95, 1.05] }); lab.cone(0.2, 0.5, '#2a3a8a', { at: [0, 1.0, -0.22], rot: [0.5, 0, 0], parent: body }); } // платок
      for (const s of [-1, 1]) { lab.ball(0.075, '#ffffff', { at: [0.11 * s, 1.34, 0.26], parent: body, shadow: false, detail: 0 }); lab.ball(0.04, '#101018', { at: [0.11 * s, 1.34, 0.32], parent: body, shadow: false, detail: 0 }); }
      lab.cyl(0.11, 0.1, 0.5, col, { at: [-0.4, 0.72, 0], rot: [0, 0, 0.3], parent: body, sides: 5 });
      lab.cyl(0.11, 0.1, 0.5, col, { at: [0.4, 0.72, 0], rot: [0, 0, -0.3], parent: body, sides: 5 });
      const ring = lab.mesh(new lab.THREE.RingGeometry(0.5, 0.66, 20).rotateX(-Math.PI / 2), lab.mat(col, { glow: 0.9, side: 'double' }), { at: [0, 0.1, 0], parent: g, shadow: false });
      const tag = lab.cone(0.16, 0.3, lab.mat(col, { glow: 1.2 }), { at: [0, 2.1, 0], rot: [Math.PI, 0, 0], parent: g, shadow: false, sides: 4 });
      const bubble = lab.ball(0.95, lab.mat('#9fe8ff', { alpha: 0.22, glow: 0.3 }), { at: [0, 0.9, 0], parent: g, shadow: false });
      return { k, g, body, head, ring, tag, bubble, x: 0, y: 0, dir: [0, 1], alive: true, ghost: null, maxB: 1, range: 2, speed: 3.6, cd: 0, think: 0, path: null, goal: null, passBomb: null, dashT: 0, dashCd: 0, hurtT: 0, usedRev: false, pts: 0, crates: 0, respawnT: 0, mark: null };
    });
    lab.hero(st.h[0].g);
  },
  isBot(lab, h) { const st = lab.state; return h.k === 1 && !st.p2human; },
  pad(lab, h) { return h.k === 0 ? lab.p1 : lab.p2; },

  // ---------- раунд ----------
  newRound(lab, first) {
    const st = lab.state, cfg = lab.cfg;
    st.round++; st.rt = 0; st.phase = first ? 'intro' : 'play'; st.revenge = null; st.press = null; st.pressI = 0; st.pressT = 0;
    st.grid.fill(0); st.flameT.fill(0); st.puAt.fill(-1);
    st.bombs.forEach(b => this.freeBomb(b)); st.bombs = [];
    st.pus.forEach(p => { p.slot.used = false; p.slot.g.visible = false; }); st.pus = [];
    st.enemies.forEach(e => { e.slot.used = false; e.slot.g.visible = false; }); st.enemies = [];
    st.apples = []; st.applesGot = 0;
    for (let i = 0; i < st.N; i++) { lab.place(st.pressIM, i, [0, -9, 0], { scale: 0 }); }
    // клетки: столбы, стена посередине, ящики; старт каждого героя — свободный уголок
    const m = Math.floor(this.mid(st)), free = new Set();
    for (const k of [0, 1]) { const [x, y] = this.spawnCell(st, k); for (const [dx, dy] of [[0, 0], [1, 0], [-1, 0], [0, 1], [0, -1], [2, 0], [-2, 0], [0, 2], [0, -2]]) free.add(this.idx(st, x + dx, y + dy)); }
    for (let j = 0; j < st.H; j++) for (let i = 0; i < st.W; i++) {
      const id = this.idx(st, i, j);
      if (this.pillar(st, i, j)) st.grid[id] = 1;
      else if (st.solo && st.mode !== 2 && i === m) st.grid[id] = 3;
      else if (!free.has(id) && lab.chance(st.mode === 2 ? cfg.yashchiki * 0.45 : cfg.yashchiki)) {
        st.grid[id] = 2;
        if (lab.chance(cfg.bonus)) st.puAt[id] = lab.randInt(0, 2);
      }
    }
    // герои на старт
    st.h.forEach(h => {
      const [x, y] = this.spawnCell(st, h.k);
      Object.assign(h, { shieldSaid: false, x, y, alive: true, ghost: null, passBomb: null, path: null, goal: null, think: 0, cd: 0, dashT: 0, dashCd: 0, usedRev: false, crates: 0, respawnT: 0, mark: null, dir: h.k ? [0, 1] : [0, -1] });
      if (first || st.mode === 2) { h.maxB = Math.round(cfg.bomb); h.range = Math.round(cfg.ogon); h.speed = cfg.beg; }
      h.g.visible = true; h.g.scale.setScalar(1); h.body.rotation.set(0, 0, 0);
      this.setGhostLook(lab, h, false);
    });
    if (st.mode === 2) {
      if (!first) st.roles.reverse();
      this.asymStart(lab);
    }
    if (st.mode === 1) { st.wave = 0; this.nextWave(lab); }
    this.paintCrates(lab);
    this.tellRound(lab, first);
  },
  tellRound(lab, first) {
    const st = lab.state;
    const say = st.mode === 1 ? `Волна ${st.wave}: иныжи во дворе!` : st.mode === 2 ? `Раунд ${st.round}: ${this.NAMES[st.roles.indexOf('begun')]} — бегун, ${this.NAMES[st.roles.indexOf('miner')]} — минёр`
      : st.solo ? `Раунд ${st.round}: каждый в своей половине — кто больше ящиков?` : `Раунд ${st.round}!`;
    if (!first) lab.popup([0, 3, 0], say, '#ffffff', 26);
    st.banner = say; st.bannerT = 2.4;
  },
  paintCrates(lab) {
    const st = lab.state;
    for (let j = 0; j < st.H; j++) for (let i = 0; i < st.W; i++) {
      const id = this.idx(st, i, j), on = st.grid[id] === 2, hay = (i * 7 + j * 3) % 3 !== 0, x = this.wx(st, i), z = this.wz(st, j), r = ((i * 13 + j * 7) % 10) / 10;
      lab.place(st.hay, id, [x, 0.55, z], { scale: on && hay ? 1 : 0, rot: r * 0.3 });
      lab.place(st.hayTop, id, [x, 1.2, z], { scale: on && hay ? 1 : 0, rot: r });
      lab.place(st.tub, id, [x, 0.55, z], { scale: on && !hay ? 1 : 0, rot: r });
      lab.place(st.tubRim, id, [x, 0.95, z], { scale: on && !hay ? 1 : 0 });
    }
  },

  // ---------- афиша в меню: двор в разгаре, два креста огня, бомбы, бонус, дух на плетне ----------
  poster(lab) {
    const st = lab.state;
    const [a, b] = st.h;
    a.x = 2; a.y = st.H - 3; b.x = st.W - 3; b.y = 2;
    const clear = (i, j) => { const id = this.idx(st, i, j); if (st.grid[id] === 2) st.grid[id] = 0; };
    for (let i = 0; i < st.W; i++) { clear(i, st.H - 3); clear(i, 2); }
    for (let j = 0; j < st.H; j++) { clear(2, j); clear(st.W - 3, j); }
    this.paintCrates(lab);
    this.placeBomb(lab, a, 4, st.H - 3, true).t = 0.6;
    this.placeBomb(lab, b, st.W - 3, 4, true).t = 1.4;
    const fl = (i, j) => { st.flameT[this.idx(st, i, j)] = 0.4; };
    for (let j = 3; j <= 7; j++) fl(6, j); for (let i = 4; i <= 8; i++) fl(i, 5);
    this.spawnPu(lab, 4, 1, 0); this.spawnPu(lab, 8, st.H - 2, 1);
    st.posterOn = true;
  },
  unposter(lab) {
    const st = lab.state;
    st.posterOn = false;
    st.flameT.fill(0);
    st.round = 0; this.newRound(lab, true);
  },

  // ---------- ход партии ----------
  update(lab, dt) {
    const st = lab.state, cfg = lab.cfg;
    if (st.posterOn) this.unposter(lab);
    st.wt += dt;
    if (st.bannerT > 0) st.bannerT -= dt;
    // второй игрок взял геймпад или клавиши — бот отдаёт ему героя
    if (st.p2human === false) {
      const p = lab.p2;
      if (p.left || p.right || p.up || p.down || p.a || p.b) { st.p2human = true; lab.popup(this.heroAt(lab, st.h[1], 2.6), 'Игрок 2 здесь! 🎮', this.COLORS[1], 22); lab.sfx.power(); }
    }
    if (st.phase === 'intro') { st.pauseT -= dt; if (st.pauseT <= 0) st.phase = 'play'; }
    if (st.phase === 'between') {
      st.pauseT -= dt;
      if (st.pauseT <= 0) this.newRound(lab, false);
    }
    const live = st.phase === 'play';
    if (live) st.rt += dt;
    // герои
    for (const h of st.h) {
      if (h.alive) { if (live || st.phase === 'intro') this.control(lab, h, dt, live); }
      else if (h.ghost) this.ghostUpdate(lab, h, dt, live);
      if (h.passBomb && !this.onCell(h, h.passBomb.i, h.passBomb.j, 0.85)) h.passBomb = null;
    }
    if (live) {
      this.bombsUpdate(lab, dt);
      this.pickups(lab);
      if (st.mode === 1) this.enemiesUpdate(lab, dt);
      if (st.mode === 2) this.asymUpdate(lab, dt);
      this.pressure(lab, dt);
      this.revengeUpdate(lab, dt);
      this.flameHits(lab);
      this.checkRound(lab);
    }
    for (let i = 0; i < st.N; i++) if (st.flameT[i] > 0) st.flameT[i] = Math.max(0, st.flameT[i] - dt);
    // взаимодействий за минуту — полоса мастерской вариаций
    lab.stat('встреч', st.inter);
    this.draw(lab, dt);
  },

  heroAt(lab, h, y = 0) { return this.at(lab.state, h.x, h.y, y); },
  onCell(h, i, j, r = 0.5) { return Math.abs(h.x - i) < r && Math.abs(h.y - j) < r; },
  cellOf(h) { return [Math.round(h.x), Math.round(h.y)]; },
  bombAt(st, i, j) { return st.bombs.find(b => b.i === i && b.j === j && !b.slide); },
  passable(st, i, j, h) {
    if (!this.inside(st, i, j) || st.grid[this.idx(st, i, j)] !== 0) return false;
    const b = st.bombs.find(q => q.i === i && q.j === j);
    return !b || (h && h.passBomb === b);
  },

  // ---------- управление героем: человек или бот ----------
  control(lab, h, dt, live) {
    const st = lab.state;
    if (h.dashCd > 0) h.dashCd -= dt;
    if (st.mode === 2 && st.roles[h.k] === 'miner') return; // минёр стоит на вышке, его руки — прицел
    let dx = 0, dy = 0, bomb = false, kick = false, dash = false, lim = 99;
    if (this.isBot(lab, h)) ({ dx, dy, bomb, kick, dash, lim = 99 } = this.bot(lab, h, dt));
    else {
      const p = this.pad(lab, h);
      const ax = Math.abs(p.x) > 0.35 ? Math.sign(p.x) : 0, ay = Math.abs(p.y) > 0.35 ? -Math.sign(p.y) : 0;
      if (ax && ay) { if (Math.abs(p.x) >= Math.abs(p.y)) dx = ax; else dy = ay; } else { dx = ax; dy = ay; }
      bomb = p.pressed.a; kick = p.pressed.b; dash = p.pressed.a;
    }
    if (!live) { bomb = kick = dash = false; }
    const begun = st.mode === 2 && st.roles[h.k] === 'begun';
    let sp = h.speed * (h.dashT > 0 ? 2.6 : 1);
    if (h.dashT > 0) h.dashT -= dt;
    if (dx || dy) { h.dir = [dx, dy]; this.walk(lab, h, dx, dy, Math.min(lim, sp * dt)); h.moving = true; } else h.moving = false;
    if (begun) { if (dash && h.dashCd <= 0) { h.dashT = 0.28; h.dashCd = 2.5; lab.sfx.whoosh(); lab.burst(this.heroAt(lab, h, 0.4), { count: 10, color: '#ffffff', speed: 3, up: 1 }); } }
    else if (bomb) this.tryBomb(lab, h);
    if (kick) this.tryKick(lab, h);
  },
  // шаг по сетке: сначала выравнивание на полосу, потом движение до препятствия (как в Bomberman — скользишь в проход)
  walk(lab, h, dx, dy, d) {
    const st = lab.state;
    const along = dx ? 'x' : 'y', side = dx ? 'y' : 'x', s = dx || dy;
    const lane = Math.round(h[side]), off = h[side] - lane;
    if (Math.abs(off) > 0.02) {
      // уголок: если впереди по своей полосе стена, а у соседней полосы проход — скользим к ней
      const step = Math.min(Math.abs(off), d);
      h[side] -= Math.sign(off) * step; d -= step * 0.6;
      if (Math.abs(h[side] - lane) > 0.18) return;
    }
    h[side] = lane;
    const cur = Math.round(h[along]), next = cur + s;
    const ni = dx ? next : lane, nj = dx ? lane : next;
    const target = h[along] + s * d;
    if (this.passable(st, ni, nj, h)) h[along] = target;
    else {
      // упёрлись: не дальше центра своей клетки; рядом сквозной проход — подсказка-скольжение к нему
      h[along] = s > 0 ? Math.min(target, cur) : Math.max(target, cur);
      if (Math.abs(h[along] - cur) < 0.01) {
        for (const o of [-1, 1]) {
          const si = dx ? cur + s : lane + o, sj = dx ? lane + o : cur + s, ci = dx ? cur : lane + o, cj = dx ? lane + o : cur;
          if (this.passable(st, si, sj, h) && this.passable(st, ci, cj, h) && Math.abs(off) > 0.05 && Math.sign(off) === o) { h[side] += o * Math.min(d, 0.5); break; }
        }
      }
    }
  },
  tryBomb(lab, h) {
    const st = lab.state;
    const [i, j] = this.cellOf(h);
    if (st.bombs.filter(b => b.owner === h && !b.sky).length >= h.maxB || st.bombs.some(b => b.i === i && b.j === j) || st.grid[this.idx(st, i, j)] !== 0) return false;
    const b = this.placeBomb(lab, h, i, j);
    h.passBomb = b;
    return true;
  },
  placeBomb(lab, h, i, j, quiet) {
    const st = lab.state, slot = st.bombPool.find(s => !s.used);
    if (!slot) return null;
    slot.used = true; slot.g.visible = true;
    const b = { i, j, x: i, y: j, t: lab.cfg.fuse, fuse: lab.cfg.fuse, r: h ? h.range : 2, owner: h, slot, slide: null, sky: !h };
    st.bombs.push(b);
    slot.g.position.set(...this.at(st, i, j));
    slot.g.scale.setScalar(0.1);
    lab.tween(0.22, k => slot.g.scale.setScalar(0.1 + 0.9 * k), 'outBack');
    if (!quiet) { lab.sfx.beep(); lab.tone(180, 0.08, 'triangle', 0.25, 120); }
    return b;
  },
  freeBomb(b) { b.slot.used = false; b.slot.g.visible = false; },
  tryKick(lab, h) {
    const st = lab.state;
    const [i, j] = this.cellOf(h), [dx, dy] = h.dir;
    const b = st.bombs.find(q => !q.slide && ((q.i === i + dx && q.j === j + dy) || (q.i === i && q.j === j)));
    if (!b || !this.passable(st, b.i + dx, b.j + dy, null) || this.heroOnCell(lab, b.i + dx, b.j + dy)) { if (b) lab.popup(this.heroAt(lab, h, 2), 'не пнуть — упёрлась', '#ffffff', 13); return; }
    b.slide = [dx, dy]; b.kicker = h; if (h.passBomb === b) h.passBomb = null;
    st.kicks++; lab.count('пинков', 1);
    lab.sfx.whoosh(); lab.pulse(h.body, 1.25, 0.12);
    lab.burst(this.at(st, b.i, b.j, 0.4), { count: 8, color: '#ffe0a0', speed: 4, dir: [dx, 0, dy] });
  },
  heroOnCell(lab, i, j) { return lab.state.h.some(h => h.alive && this.onCell(h, i, j, 0.7)); },

  // ---------- бомбы и огонь ----------
  bombsUpdate(lab, dt) {
    const st = lab.state;
    for (const b of st.bombs) {
      if (b.slide) { // пнутая бомба скользит, пока не упрётся
        const sp = 7 * dt;
        b.x += b.slide[0] * sp; b.y += b.slide[1] * sp;
        const ni = Math.round(b.x + b.slide[0] * 0.5), nj = Math.round(b.y + b.slide[1] * 0.5);
        const blocked = !this.passable(st, ni, nj, null) && !(ni === b.i && nj === b.j) || this.heroOnCell(lab, ni, nj) && !(ni === b.i && nj === b.j) || st.bombs.some(q => q !== b && q.i === ni && q.j === nj);
        const ci = Math.round(b.x), cj = Math.round(b.y);
        if (ci !== b.i || cj !== b.j) { b.i = ci; b.j = cj; }
        if (blocked && Math.abs(b.x - b.i) + Math.abs(b.y - b.j) < 0.12) { b.x = b.i; b.y = b.j; b.slide = null; lab.sfx.hit(); lab.shake(0.08); }
        else if (!this.inside(st, ni, nj)) { b.x = b.i; b.y = b.j; b.slide = null; }
      }
      b.t -= dt;
      if (b.drop > 0) b.drop -= dt;
    }
    let boom = st.bombs.find(b => b.t <= 0 && !(b.drop > 0));
    while (boom) { this.explode(lab, boom); boom = st.bombs.find(b => b.t <= 0 && !(b.drop > 0)); }
  },
  blastCells(st, b) {
    const out = [[b.i, b.j]];
    for (const [dx, dy] of this.DIRS) for (let k = 1; k <= b.r; k++) {
      const i = b.i + dx * k, j = b.j + dy * k;
      if (!this.inside(st, i, j)) break;
      const g = st.grid[this.idx(st, i, j)];
      if (g === 1 || g === 3) break;
      out.push([i, j]);
      if (g === 2 || g === 4) break;
    }
    return out;
  },
  explode(lab, b) {
    const st = lab.state;
    st.bombs.splice(st.bombs.indexOf(b), 1); this.freeBomb(b);
    if (b.owner && b.owner.passBomb === b) b.owner.passBomb = null;
    const cells = this.blastCells(st, b);
    b.cells = cells;
    let broke = 0;
    for (const [i, j] of cells) {
      const id = this.idx(st, i, j);
      st.flameT[id] = 0.55; st.flameBy = st.flameBy || new Array(st.N); st.flameBy[id] = b;
      if (st.grid[id] === 2) { st.grid[id] = 0; broke++; this.crateBreak(lab, b, i, j); }
      const other = st.bombs.find(q => q.i === i && q.j === j);
      if (other && other.t > 0.08) other.t = 0.08; // цепочка
      const pu = st.pus.find(p => p.i === i && p.j === j && p.age > 0.4);
      if (pu) this.removePu(lab, pu, true);
    }
    if (broke) this.paintCrates(lab);
    lab.sfx.explode(); lab.shake(0.22); lab.hitstop(0.03);
    lab.burst(this.at(st, b.i, b.j, 0.6), { count: 26, colors: ['#ffb040', '#ff6a2a', '#fff2a0'], speed: 7, up: 2 });
    lab.ring(this.at(st, b.i, b.j, 0.15), { color: '#ff8a2a', radius: 1.2 + b.r * 0.9 });
    // «Чуть не подловил!»: огонь прошёл рядом с соседом — спрятанная механика взаимодействия работает
    if (b.owner && !st.solo) for (const h of st.h) {
      if (h === b.owner || !h.alive) continue;
      const near = cells.some(([i, j]) => Math.abs(h.x - i) + Math.abs(h.y - j) <= 1.2) && !cells.some(([i, j]) => this.onCell(h, i, j, 0.6));
      if (near && st.mode === 0) { st.almost++; lab.count('чуть не подловил', 1); this.interact(lab, h, 'Чуть не подловил!', '#ffe680'); }
    }
  },
  crateBreak(lab, b, i, j) {
    const st = lab.state, id = this.idx(st, i, j), hay = (i * 7 + j * 3) % 3 !== 0;
    lab.burst(this.at(st, i, j, 0.7), { count: 14, colors: hay ? ['#ffd34d', '#ffe9a0', '#d9a83a'] : ['#b9773f', '#7a5230', '#e0b080'], speed: 5, up: 3, gravity: 9 });
    st.crates++; lab.count('ящиков', 1);
    if (b.owner) { b.owner.crates++; this.give(lab, b.owner, 10, this.at(st, i, j, 1.2)); }
    if (st.puAt[id] >= 0) { const t = st.puAt[id], r = st.round; st.puAt[id] = -1; lab.after(0.35, () => { if (st.round === r && st.grid[id] === 0) this.spawnPu(lab, i, j, t); }); }
  },
  give(lab, h, n, at) {
    const st = lab.state;
    if (!h) return;
    if (h.k === 0) lab.addScore(n, at, this.COLORS[0]);
    else { st.p2pts += n; if (at) lab.popup(at, '+' + n, this.COLORS[1], 15); }
  },
  // взаимодействие игроков — то, ради чего игра: подсказка над героем, звук и скрытый счётчик спрятанной механики
  interact(lab, h, text, color) {
    const st = lab.state;
    st.inter++; st.interAt.push(Math.round(st.wt));
    lab.count('_secret', 1);
    if (st.wt - st.lastMeet > 0.8) { lab.popup(this.heroAt(lab, h, 2.6), text, color || '#ffe680', 20); st.lastMeet = st.wt; }
  },
  flameHits(lab) {
    const st = lab.state;
    for (const h of st.h) {
      if (!h.alive || (st.mode === 2 && st.roles[h.k] === 'miner')) continue;
      const [i, j] = this.cellOf(h), id = this.idx(st, i, j);
      if (st.flameT[id] > 0 && this.onCell(h, i, j, 0.62)) {
        if (st.rt < lab.cfg.shchit) { if (!h.shieldSaid) { h.shieldSaid = true; lab.popup(this.heroAt(lab, h, 2.4), '🛡 щит выдержал — дальше огонь опасен', '#9fe8ff', 15); } }
        else this.knockOut(lab, h, st.flameBy && st.flameBy[id]);
      }
      if (st.grid[id] === 4) this.knockOut(lab, h, null, 'сжатие двора');
    }
    if (st.mode === 1) for (const e of st.enemies.slice()) {
      const id = this.idx(st, Math.round(e.x), Math.round(e.y));
      if (st.flameT[id] > 0 && e.hurt <= 0) this.enemyHit(lab, e, st.flameBy && st.flameBy[id]);
    }
  },

  // ---------- выбыл ----------
  knockOut(lab, h, by, why) {
    const st = lab.state;
    if (!h.alive) return;
    h.alive = false;
    const at = this.heroAt(lab, h, 1);
    if (h.k === 0) lab.hurt(at); // урон первого игрока — в телеметрию и бот-плейтестеру
    lab.burst(at, { count: 30, colors: [this.COLORS[h.k], '#ffffff', '#2a2a30'], speed: 8, up: 3 });
    lab.ring(this.heroAt(lab, h, 0.2), { color: this.COLORS[h.k], radius: 2.4 });
    lab.whiten(h.body, 0.12); lab.shake(0.5); lab.hitstop(0.09); lab.sfx.hit();
    h.mark = { i: Math.round(h.x), j: Math.round(h.y), t: 8 };
    const owner = by && by.owner, foe = st.h[1 - h.k];
    // поймал соседа своей бомбой или пнутой бомбой — главное взаимодействие дуэли
    const catcher = by && (by.kicker || owner);
    if (st.mode === 0 && catcher && catcher !== h) {
      st.caught++; lab.count('подловил', 1); this.give(lab, catcher, 200, this.heroAt(lab, catcher, 2.2)); this.interact(lab, catcher, 'Подловил! 💥', this.COLORS[catcher.k]);
      if (by.kicker) lab.count('пинок попал', 1);
    }
    if (st.mode === 0 && catcher === h) lab.popup(this.heroAt(lab, h, 2.4), 'Сам себя!', '#ffffff', 20);
    if (st.mode === 0 && why === 'дух') { st.revenges++; lab.count('месть духа', 1); this.interact(lab, foe, 'Месть духа! 👻', '#c8b8ff'); }
    if (st.mode === 1) return this.coopDown(lab, h);
    if (st.mode === 2) return; // раунд асимметрии решит checkRound
    // дуэль: месть духа или конец раунда
    const canRevenge = lab.cfg.mest >= 1 && !st.solo && !h.usedRev && foe.alive;
    if (canRevenge) {
      h.usedRev = true;
      this.becomeGhost(lab, h);
      st.revenge = { h, t: 6 };
      lab.after(0.35, () => lab.popup([0, 3.4, 0], `${this.NAMES[h.k]} — дух! 6 секунд мести с плетня`, '#c8b8ff', 22));
    } else this.fadeHero(lab, h);
  },
  fadeHero(lab, h) {
    lab.tween(0.5, k => { h.g.scale.setScalar(1 - k * 0.9); h.body.rotation.y = k * 12; }, 'inCubic');
    lab.after(0.5, () => { h.g.visible = false; });
  },
  setGhostLook(lab, h, on) { if (!on) this.unGhost(lab, h); },
  becomeGhost(lab, h) {
    const st = lab.state, [R, Rz] = st.fenceR;
    // дух садится на ближайший край плетня и катается по нему
    const x = this.wx(st, h.x), z = this.wz(st, h.y);
    const per = 2 * (2 * R) + 2 * (2 * Rz);
    const s = Math.abs(z) / Rz > Math.abs(x) / R ? (z < 0 ? x + R : 2 * R + 2 * Rz + (R - x)) : (x > 0 ? 2 * R + (z + Rz) : 4 * R + 2 * Rz + (Rz - z));
    h.ghost = { s: ((s % per) + per) % per, per, cd: 0.6, throws: 0 };
    h.g.visible = true; h.g.scale.setScalar(0.9);
    h.bubble.visible = false;
    h.g.traverse(o => { if (o.isMesh && o.material && o !== h.bubble) { o.material = o.material.clone(); o.material.transparent = true; o.material.opacity = 0.45; } });
    lab.sfx.power();
  },
  unGhost(lab, h) {
    h.ghost = null;
    h.g.traverse(o => { if (o.isMesh && o.material && o !== h.bubble && o.material.transparent && o.material.opacity < 1) { o.material.opacity = 1; o.material.transparent = false; } });
  },
  // точка плетня по длине s: где, куда «внутрь двора» и куда ведёт рост s
  perimeter(lab, s) {
    const [R, Rz] = lab.state.fenceR;
    if (s < 2 * R) return [s - R, -Rz, [0, 1], [1, 0]];
    s -= 2 * R; if (s < 2 * Rz) return [R, s - Rz, [-1, 0], [0, 1]];
    s -= 2 * Rz; if (s < 2 * R) return [R - s, Rz, [0, -1], [-1, 0]];
    s -= 2 * R; return [-R, Rz - s, [1, 0], [0, -1]];
  },
  // ближайшая к цели точка плетня (длина s): с этого края бомба духа долетит
  edgeNear(lab, x, z) {
    const [R, Rz] = lab.state.fenceR, c = (v, a) => Math.max(-a, Math.min(a, v));
    const opts = [[Rz + z, c(x, R) + R], [R - x, 2 * R + c(z, Rz) + Rz], [Rz - z, 2 * R + 2 * Rz + (R - c(x, R))], [R + x, 4 * R + 2 * Rz + (Rz - c(z, Rz))]];
    return opts.sort((a, b) => a[0] - b[0])[0];
  },
  ghostUpdate(lab, h, dt, live) {
    const st = lab.state, G = h.ghost;
    let mv = 0, thr = false;
    const tan = this.perimeter(lab, G.s)[3];
    if (this.isBot(lab, h)) {
      // бот-дух едет к краю плетня, ближайшему к соседу, и бросает, когда сосед в 2–5 клетках от края
      const foe = st.h[1 - h.k], fx = this.wx(st, foe.x), fz = this.wz(st, foe.y);
      const [far, sT] = this.edgeNear(lab, fx, fz);
      let d = sT - G.s; if (d > G.per / 2) d -= G.per; if (d < -G.per / 2) d += G.per;
      mv = Math.abs(d) > 0.5 ? Math.sign(d) : 0;
      thr = G.cd <= 0 && Math.abs(d) < 1.2 && far > this.C * 1.5 && far < this.C * 5.5 && lab.chance(0.1 * lab.cfg.bot);
    } else {
      const p = this.pad(lab, h), ix = Math.abs(p.x) > 0.3 ? Math.sign(p.x) : 0, iz = Math.abs(p.y) > 0.3 ? -Math.sign(p.y) : 0;
      mv = Math.sign(ix * tan[0] + iz * tan[1]);
      thr = p.pressed.a;
    }
    G.s = ((G.s + mv * 7 * dt) % G.per + G.per) % G.per;
    G.cd -= dt;
    const [x, z, inward] = this.perimeter(lab, G.s);
    h.g.position.set(x, 1.2 + Math.sin(st.wt * 4) * 0.15, z);
    if (thr && live && G.cd <= 0) {
      // бомба летит дугой на 3 клетки внутрь двора
      const ci = Math.round((x + inward[0] * 3 * this.C) / this.C + (st.W - 1) / 2), cj = Math.round((z + inward[1] * 3 * this.C) / this.C + (st.H - 1) / 2);
      const cell = this.nearestFree(st, lab.clamp(ci, 0, st.W - 1), lab.clamp(cj, 0, st.H - 1));
      if (cell) {
        G.cd = 1.6; G.throws++;
        const b = this.placeBomb(lab, null, cell[0], cell[1], true);
        if (b) {
          b.r = 2; b.ghost = h; b.drop = 0.45; b.t = 1.7;
          b.owner = null; b.kicker = null;
          lab.warn(this.at(st, cell[0], cell[1], 0.1), 0.8, 0.45, '#c8b8ff');
          const from = [x, 1.4, z], to = this.at(st, cell[0], cell[1], 0);
          lab.tween(0.45, k => b.slot.g.position.set(from[0] + (to[0] - from[0]) * k, from[1] + Math.sin(k * Math.PI) * 3.2 + (to[1] - from[1]) * k, from[2] + (to[2] - from[2]) * k), 'linear');
          lab.sfx.whoosh();
        }
      }
    }
  },
  nearestFree(st, i, j) {
    let best = null, bd = 99;
    for (let y = 0; y < st.H; y++) for (let x = 0; x < st.W; x++) {
      if (st.grid[this.idx(st, x, y)] !== 0 || st.bombs.some(b => b.i === x && b.j === y)) continue;
      const d = Math.abs(x - i) + Math.abs(y - j); if (d < bd) { bd = d; best = [x, y]; }
    }
    return best;
  },
  revengeUpdate(lab, dt) {
    const st = lab.state, R = st.revenge;
    if (!R) return;
    R.t -= dt;
    const foe = st.h[1 - R.h.k];
    // бомба духа поймала соседа: меняются местами — дух вернулся, сосед теперь дух (если его месть ещё не потрачена)
    if (!foe.alive && R.h.ghost && !R.done) {
      R.done = true;
      const h = R.h, cell = this.nearestFree(st, foe.mark ? foe.mark.i : 6, foe.mark ? foe.mark.j : 5);
      this.unGhost(lab, h); h.alive = true; h.x = cell[0]; h.y = cell[1]; h.passBomb = null;
      h.g.scale.setScalar(1); lab.pulse(h.g, 1.4, 0.3);
      lab.burst(this.heroAt(lab, h, 1), { count: 24, colors: ['#c8b8ff', '#ffffff'], speed: 6 });
      lab.sfx.win();
      st.revenges++; lab.count('месть духа', 1); this.interact(lab, h, `${this.NAMES[h.k]} вернулся! 👻→🙂`, '#c8b8ff');
      this.give(lab, h, 150, this.heroAt(lab, h, 2.4));
      st.revenge = null;
      if (!foe.usedRev && lab.cfg.mest >= 1) { foe.usedRev = true; foe.g.visible = true; foe.g.scale.setScalar(1); this.becomeGhost(lab, foe); st.revenge = { h: foe, t: 6 }; }
      else this.fadeHero(lab, foe);
      return;
    }
    if (R.t <= 0 || !R.h.ghost) { this.unGhost(lab, R.h); this.fadeHero(lab, R.h); st.revenge = null; }
  },

  // ---------- бонусы ----------
  spawnPu(lab, i, j, t) {
    const st = lab.state, slot = st.puPool.find(s => !s.used);
    if (!slot) return;
    const type = Object.keys(this.PU)[t];
    slot.used = true; slot.g.visible = true;
    for (const k in slot.ico) slot.ico[k].visible = k === type;
    slot.base.material = lab.mat(this.PU[type].color, { glow: 0.6 });
    slot.g.position.set(...this.at(st, i, j));
    slot.g.scale.setScalar(0.01); lab.tween(0.3, k => slot.g.scale.setScalar(Math.max(0.01, k)), 'outBack');
    st.pus.push({ i, j, type, slot, age: 0 });
    lab.sfx.coin();
  },
  removePu(lab, p, burn) {
    const st = lab.state;
    st.pus.splice(st.pus.indexOf(p), 1); p.slot.used = false; p.slot.g.visible = false;
    if (burn) lab.burst(this.at(st, p.i, p.j, 0.6), { count: 8, color: '#ffffff', speed: 3 });
  },
  pickups(lab) {
    const st = lab.state;
    for (const p of st.pus.slice()) {
      const h = st.h.find(q => q.alive && this.onCell(q, p.i, p.j, 0.55) && !(st.mode === 2 && st.roles[q.k] === 'miner'));
      if (!h) continue;
      const who = lab.cfg.obshchie >= 1 ? st.h : [h];
      for (const q of who) this.applyPu(lab, q, p.type);
      st.pickups++; lab.count('бонусов', 1);
      lab.popup(this.heroAt(lab, h, 2.4), this.PU[p.type].icon + ' ' + this.PU[p.type].name + (who.length > 1 ? ' обоим' : ''), this.PU[p.type].color, 18);
      this.give(lab, h, 25, null);
      lab.sfx.power(); lab.pulse(h.body, 1.3, 0.16);
      lab.burst(this.at(st, p.i, p.j, 0.8), { count: 14, color: this.PU[p.type].color, speed: 4, up: 2 });
      // бонус увели из-под носа у соседа — тоже взаимодействие
      const foe = st.h[1 - h.k];
      if (st.mode === 0 && !st.solo && foe.alive && Math.abs(foe.x - p.i) + Math.abs(foe.y - p.j) <= 2.2) this.interact(lab, h, 'Увёл бонус из-под носа!', this.COLORS[h.k]);
      this.removePu(lab, p);
    }
    for (const p of st.pus) p.age += lab.dt;
  },
  applyPu(lab, h, type) {
    if (type === 'ogon') h.range = Math.min(7, h.range + 1);
    if (type === 'bomba') h.maxB = Math.min(6, h.maxB + 1);
    if (type === 'beg') h.speed = Math.min(lab.cfg.beg + 2.4, h.speed + 0.6);
  },

  // ---------- сжатие двора по спирали (давление Super Bomberman) ----------
  pressure(lab, dt) {
    const st = lab.state, cfg = lab.cfg;
    const from = cfg.dvor >= 1 ? 30 : cfg.szhat;
    if (st.mode !== 0 || st.solo || !from || st.rt < from) return;
    if (!st.press) {
      st.press = this.spiral(st); st.pressI = 0; st.pressT = 0;
      lab.popup([0, 3.2, 0], 'Двор сжимается!', '#ff8a6a', 26); lab.sfx.warn(); lab.shake(0.2);
    }
    st.pressT -= dt;
    if (st.pressT > 0 || st.pressI >= st.press.length - 9) return;
    st.pressT = 0.34;
    const [i, j] = st.press[st.pressI++], id = this.idx(st, i, j);
    if (st.grid[id] === 1) return;
    lab.warn(this.at(st, i, j, 0.1), 0.75, 0.55, '#ff6a3a');
    const r = st.round;
    lab.after(0.55, () => {
      if (st.round !== r || st.phase !== 'play') return;
      st.grid[id] = 4;
      const b = st.bombs.find(q => q.i === i && q.j === j); if (b) { st.bombs.splice(st.bombs.indexOf(b), 1); this.freeBomb(b); }
      const p = st.pus.find(q => q.i === i && q.j === j); if (p) this.removePu(lab, p);
      lab.place(st.pressIM, id, this.at(st, i, j, 0.7), { scale: 1, rot: 0.1 * (i - j) });
      lab.burst(this.at(st, i, j, 0.2), { count: 8, colors: ['#c9a26a', '#ffe0a0'], speed: 3, up: 2 });
      lab.tone(120, 0.08, 'square', 0.2);
    });
  },
  spiral(st) {
    const out = []; let x0 = 0, y0 = 0, x1 = st.W - 1, y1 = st.H - 1;
    while (x0 <= x1 && y0 <= y1) {
      for (let i = x0; i <= x1; i++) out.push([i, y0]);
      for (let j = y0 + 1; j <= y1; j++) out.push([x1, j]);
      if (y1 > y0) for (let i = x1 - 1; i >= x0; i--) out.push([i, y1]);
      if (x1 > x0) for (let j = y1 - 1; j > y0; j--) out.push([x0, j]);
      x0++; y0++; x1--; y1--;
    }
    return out;
  },

  // ---------- конец раунда и матча ----------
  checkRound(lab) {
    const st = lab.state, cfg = lab.cfg, [a, b] = st.h;
    if (st.phase !== 'play') return;
    if (st.mode === 1) return; // кооператив кончается сердцами
    if (st.mode === 2) return this.asymCheck(lab);
    let winner = null, draw = false;
    if (st.solo) {
      // без спрятанной механики: каждый в своей половине, раунд — 45 секунд, побеждает тот, кто взорвал больше ящиков
      if (st.rt >= 45) { if (a.crates === b.crates) draw = true; else winner = a.crates > b.crates ? a : b; }
      if (!a.alive || !b.alive) { if (!a.alive && !b.alive) draw = true; else winner = a.alive ? a : b; }
    } else {
      if (st.revenge) return;
      if (!a.alive && !b.alive) draw = true;
      else if (!a.alive || !b.alive) winner = a.alive ? a : b;
    }
    if (!winner && !draw) return;
    st.phase = 'between'; st.pauseT = 2.6;
    lab.slowmo(0.6, 0.35);
    if (draw) { lab.popup([0, 3.4, 0], 'Ничья! Раунд заново', '#ffffff', 26); return; }
    st.wins[winner.k]++;
    this.give(lab, winner, 500, null);
    lab.popup([0, 3.4, 0], `Раунд за: ${this.NAMES[winner.k]}! ${st.wins[0]} : ${st.wins[1]}`, this.COLORS[winner.k], 28);
    lab.sfx.win(); lab.burst(this.heroAt(lab, winner, 1.5), { count: 30, colors: [this.COLORS[winner.k], '#ffd23f', '#ffffff'], speed: 7, up: 4 });
    lab.count('раундов', 1);
    if (st.wins[winner.k] >= Math.round(cfg.pobed)) lab.after(1.2, () => this.matchOver(lab, winner));
  },
  matchOver(lab, winner) {
    const st = lab.state;
    st.phase = 'over';
    const score = `${st.wins[0]} : ${st.wins[1]}`;
    if (winner.k === 0) return lab.win(`${this.NAMES[0]} выиграл матч ${score}`);
    if (st.p2human) return lab.win(`${this.NAMES[1]} выиграла матч ${score}`);
    return lab.gameOver(`Бот-соседка выиграла матч ${score}`);
  },

  // ---------- кооператив: вместе против иныжей ----------
  nextWave(lab) {
    const st = lab.state;
    st.wave++;
    const n = st.wave, big = Math.min(1 + Math.floor(n / 2), 4), small = Math.min(2 + n, 6);
    const spots = [];
    for (let j = 0; j < st.H; j++) for (let i = 0; i < st.W; i++) {
      if (st.grid[this.idx(st, i, j)] !== 0) continue;
      const far = Math.min(...st.h.map(h => Math.abs(h.x - i) + Math.abs(h.y - j)));
      if (far >= 6) spots.push([i, j]);
    }
    for (let k = 0; k < big + small && spots.length; k++) {
      const [i, j] = spots.splice(lab.randInt(0, spots.length - 1), 1)[0];
      const kind = k < big ? 'inyzh' : 'bes';
      lab.warn(this.at(st, i, j, 0.1), 0.9, 1, '#b48aff');
      lab.after(1, () => this.spawnEnemy(lab, kind, i, j));
    }
    if (st.wave > 1) { lab.popup([0, 3.2, 0], `Волна ${st.wave}!`, '#c8a8ff', 26); lab.sfx.warn(); }
  },
  spawnEnemy(lab, kind, i, j) {
    const st = lab.state, slot = st.enemyPool.find(s => !s.used);
    if (!slot || st.phase === 'over') return;
    slot.used = true; slot.g.visible = true;
    const big = kind === 'inyzh';
    slot.body.material = lab.mat(big ? '#8a5ad8' : '#ff5a3a', { glow: big ? 0.15 : 0.3 });
    slot.horn.visible = big;
    const s = big ? 1.55 : 0.95;
    slot.g.position.set(...this.at(st, i, j)); slot.g.scale.setScalar(0.01);
    lab.tween(0.3, k => slot.g.scale.setScalar(Math.max(0.01, s * k)), 'outBack');
    st.enemies.push({ kind, x: i, y: j, slot, hp: big ? 2 : 1, speed: big ? 1.3 : 2.4, dir: lab.pick(this.DIRS), hurt: 0, s, think: 0 });
  },
  enemiesUpdate(lab, dt) {
    const st = lab.state;
    for (const e of st.enemies) {
      if (e.hurt > 0) e.hurt -= dt;
      const ci = Math.round(e.x), cj = Math.round(e.y);
      const centered = Math.abs(e.x - ci) < 0.06 && Math.abs(e.y - cj) < 0.06;
      if (centered) {
        e.x = ci; e.y = cj;
        const open = this.DIRS.filter(([dx, dy]) => this.passable(st, ci + dx, cj + dy, null));
        if (!open.length) continue;
        const ahead = open.some(d => d[0] === e.dir[0] && d[1] === e.dir[1]);
        if (e.kind === 'inyzh') {
          // иныж охотится за ближайшим героем
          const tgt = st.h.filter(h => h.alive).sort((p, q) => (Math.abs(p.x - ci) + Math.abs(p.y - cj)) - (Math.abs(q.x - ci) + Math.abs(q.y - cj)))[0];
          if (tgt) e.dir = open.slice().sort((p, q) => (Math.abs(tgt.x - ci - p[0]) + Math.abs(tgt.y - cj - p[1])) - (Math.abs(tgt.x - ci - q[0]) + Math.abs(tgt.y - cj - q[1])))[0];
        } else if (!ahead || lab.chance(0.3)) e.dir = lab.pick(open);
      }
      const nx = e.x + e.dir[0] * e.speed * dt, ny = e.y + e.dir[1] * e.speed * dt;
      const ti = Math.round(e.x + e.dir[0] * 0.55), tj = Math.round(e.y + e.dir[1] * 0.55);
      if (this.passable(st, ti, tj, null) || (ti === ci && tj === cj)) { e.x = nx; e.y = ny; }
      else { e.x = ci; e.y = cj; e.dir = [-e.dir[0], -e.dir[1]]; }
      for (const h of st.h) if (h.alive && Math.abs(h.x - e.x) < 0.6 && Math.abs(h.y - e.y) < 0.6) this.knockOut(lab, h, null, 'иныж');
    }
  },
  enemyHit(lab, e, by) {
    const st = lab.state;
    e.hp--; e.hurt = 0.6;
    lab.whiten(e.slot.body, 0.1); lab.sfx.hit();
    lab.burst(this.at(st, e.x, e.y, 1), { count: 14, colors: ['#c8a8ff', '#ffffff'], speed: 5 });
    if (e.hp > 0) { lab.popup(this.at(st, e.x, e.y, 2.4), 'ещё раз!', '#c8a8ff', 15); return; }
    st.enemies.splice(st.enemies.indexOf(e), 1);
    e.slot.g.visible = false; e.slot.used = false;
    lab.count(e.kind === 'inyzh' ? 'иныжей' : 'бесенят', 1);
    const who = by && by.owner;
    this.give(lab, who || st.h[0], e.kind === 'inyzh' ? 150 : 50, this.at(st, e.x, e.y, 2));
    // враг пойман в огонь, пока друг держал его рядом с собой — помогли друг другу
    if (who && !st.solo) { const mate = st.h[1 - who.k]; if (mate.alive && Math.abs(mate.x - e.x) + Math.abs(mate.y - e.y) <= 3) this.interact(lab, mate, 'Вместе! 🤝', '#7cf5a8'); }
    if (!st.enemies.length) {
      lab.popup([0, 3.4, 0], 'Двор чист! 🎉', '#7cf5a8', 28); lab.sfx.win();
      st.h.forEach(h => { if (h.alive) this.give(lab, h, 300, null); });
      lab.after(1.4, () => { this.regrow(lab); this.nextWave(lab); });
    }
  },
  regrow(lab) {
    const st = lab.state;
    for (let j = 0; j < st.H; j++) for (let i = 0; i < st.W; i++) {
      const id = this.idx(st, i, j);
      if (st.grid[id] || st.bombs.some(b => b.i === i && b.j === j) || st.pus.some(p => p.i === i && p.j === j)) continue;
      if (st.h.some(h => Math.abs(h.x - i) + Math.abs(h.y - j) < 3) || !lab.chance(0.3)) continue;
      st.grid[id] = 2; if (lab.chance(lab.cfg.bonus)) st.puAt[id] = lab.randInt(0, 2);
    }
    this.paintCrates(lab);
  },
  coopDown(lab, h) {
    const st = lab.state;
    // со спрятанной механикой друг может поднять выбывшего: встань на его след за 8 секунд
    if (!st.solo) { this.becomeGhost(lab, h); h.ghost.coop = true; h.g.position.set(...this.heroAt(lab, h, 1)); lab.popup(this.heroAt(lab, h, 2.6), 'Подними меня! 8 с', this.COLORS[h.k], 18); }
    else { this.fadeHero(lab, h); h.respawnT = 3; this.loseHeart(lab, h); }
  },
  loseHeart(lab, h) {
    const st = lab.state;
    st.hearts--; lab.count('сердец потеряно', 1);
    lab.popup([0, 3, 0], `💔 Осталось сердец: ${Math.max(0, st.hearts)}`, '#ff6a7a', 22);
    if (st.hearts <= 0) { st.phase = 'over'; lab.after(0.8, () => lab.gameOver(`Иныжи взяли двор на волне ${st.wave}`)); }
  },
  coopTick(lab, dt) {
    const st = lab.state;
    for (const h of st.h) {
      if (h.alive) continue;
      if (h.ghost && h.ghost.coop) {
        h.mark.t -= dt;
        h.g.position.set(this.wx(st, h.mark.i), 1.2 + Math.sin(st.wt * 4) * 0.15, this.wz(st, h.mark.j));
        const mate = st.h[1 - h.k];
        if (mate.alive && this.onCell(mate, h.mark.i, h.mark.j, 0.6)) {
          this.unGhost(lab, h); h.alive = true; h.x = h.mark.i; h.y = h.mark.j; h.g.scale.setScalar(1);
          st.revives++; lab.count('спас друга', 1); this.interact(lab, mate, 'Спас друга! 🤝', '#7cf5a8');
          this.give(lab, mate, 100, this.heroAt(lab, mate, 2.2)); lab.sfx.win(); lab.pulse(h.g, 1.4, 0.3);
          lab.burst(this.heroAt(lab, h, 1), { count: 20, colors: ['#7cf5a8', '#ffffff'], speed: 5 });
        } else if (h.mark.t <= 0) { this.unGhost(lab, h); h.g.visible = false; h.respawnT = 1.5; this.loseHeart(lab, h); }
      } else if (h.respawnT > 0) {
        h.respawnT -= dt;
        if (h.respawnT <= 0 && st.hearts > 0) {
          const [x, y] = this.spawnCell(st, h.k), c = this.nearestFree(st, x, y);
          Object.assign(h, { alive: true, x: c[0], y: c[1], passBomb: null, ghost: null });
          h.g.visible = true; h.g.scale.setScalar(1); lab.pulse(h.g, 1.3, 0.25);
        }
      }
    }
  },

  // ---------- асимметрия: бегун и минёр ----------
  asymStart(lab) {
    const st = lab.state;
    const runner = st.h[st.roles.indexOf('begun')];
    const [x, y] = [Math.floor(this.mid(st)), st.H - 1];
    runner.x = this.nearestFree(st, x, y)[0]; runner.y = this.nearestFree(st, x, y)[1];
    st.hawk = { x: this.mid(st), y: 2, cd: 0.8, auto: 1 };
    st.apples = []; st.applesGot = 0;
    for (let k = 0; k < 2; k++) this.spawnApple(lab);
  },
  spawnApple(lab) {
    const st = lab.state, runner = st.h[st.roles.indexOf('begun')];
    const spots = [];
    for (let j = 0; j < st.H; j++) for (let i = 0; i < st.W; i++) if (st.grid[this.idx(st, i, j)] === 0 && Math.abs(runner.x - i) + Math.abs(runner.y - j) >= 5 && !st.apples.some(a => a.i === i && a.j === j)) spots.push([i, j]);
    if (!spots.length) return;
    const [i, j] = lab.pick(spots);
    st.apples.push({ i, j, age: 0 });
  },
  asymUpdate(lab, dt) {
    const st = lab.state, cfg = lab.cfg, H = st.hawk;
    const mi = st.roles.indexOf('miner'), miner = st.h[mi], runner = st.h[1 - mi];
    H.cd -= dt;
    if (st.solo) {
      // без спрятанной механики минёр не управляет: бомбы падают сами куда попало, а он смотрит
      H.auto -= dt;
      if (H.auto <= 0) { H.auto = 1.1; const c = this.nearestFree(st, lab.randInt(0, st.W - 1), lab.randInt(0, st.H - 1)); if (c) this.skyBomb(lab, c[0], c[1]); }
    } else {
      let dx = 0, dy = 0, drop = false;
      if (this.isBot(lab, miner)) {
        // бот-минёр ведёт прицел туда, где бегун будет через секунду
        const lead = 1.1 * cfg.bot, tx = runner.x + (runner.moving ? runner.dir[0] * lead * 2 : 0), ty = runner.y + (runner.moving ? runner.dir[1] * lead * 2 : 0);
        dx = lab.clamp(tx - H.x, -1, 1); dy = lab.clamp(ty - H.y, -1, 1);
        drop = Math.abs(tx - H.x) + Math.abs(ty - H.y) < 1.2 && lab.chance(0.25 * cfg.bot);
      } else {
        const p = this.pad(lab, miner);
        dx = Math.abs(p.x) > 0.25 ? p.x : 0; dy = Math.abs(p.y) > 0.25 ? -p.y : 0;
        drop = p.pressed.a;
      }
      H.x = lab.clamp(H.x + dx * 8 * dt, 0, st.W - 1); H.y = lab.clamp(H.y + dy * 8 * dt, 0, st.H - 1);
      if (drop && H.cd <= 0 && st.bombs.filter(b => b.sky).length < 3) {
        const c = this.nearestFree(st, Math.round(H.x), Math.round(H.y));
        if (c) { H.cd = 1.0; this.skyBomb(lab, c[0], c[1], miner); }
      }
    }
    // яблоки
    for (const a of st.apples.slice()) {
      a.age += dt;
      if (runner.alive && this.onCell(runner, a.i, a.j, 0.6)) {
        st.apples.splice(st.apples.indexOf(a), 1); st.applesGot++;
        lab.count('яблок', 1); this.give(lab, runner, 50, this.at(st, a.i, a.j, 1.6)); lab.sfx.coin(); lab.pulse(runner.body, 1.3, 0.14);
        lab.burst(this.at(st, a.i, a.j, 0.6), { count: 14, colors: ['#ffd23f', '#ffffff'], speed: 4, up: 2 });
        if (st.applesGot + st.apples.length < 6) this.spawnApple(lab);
      }
    }
  },
  skyBomb(lab, i, j, miner) {
    const st = lab.state, b = this.placeBomb(lab, null, i, j, true);
    if (!b) return;
    b.r = 2; b.t = 1.6; b.drop = 0.5; b.sky = true; b.miner = miner || null;
    lab.warn(this.at(st, i, j, 0.1), 0.8, 0.5, '#ff3d4a');
    const to = this.at(st, i, j, 0);
    lab.tween(0.5, k => b.slot.g.position.set(to[0], (1 - k) * 9, to[2]), 'inQuad');
    lab.sfx.whoosh();
    // бомба минёра упала рядом с бегуном — взаимодействие асимметрии
    lab.after(0.5, () => { const r = st.h[st.roles.indexOf('begun')]; if (miner && !st.solo && r.alive && Math.abs(r.x - i) + Math.abs(r.y - j) <= 2) this.interact(lab, r, 'Прямо под ноги! 😱', '#ff8a8a'); });
  },
  asymCheck(lab) {
    const st = lab.state, cfg = lab.cfg;
    const mi = st.roles.indexOf('miner'), miner = st.h[mi], runner = st.h[1 - mi];
    let winner = null;
    if (!runner.alive) { winner = miner; lab.count('минёр поймал', 1); if (!st.solo) this.interact(lab, miner, 'Минёр поймал!', this.COLORS[miner.k]); }
    else if (st.applesGot >= 6) winner = runner;
    else if (st.rt >= 40) winner = miner;
    if (!winner) return;
    st.phase = 'between'; st.pauseT = 2.8;
    st.wins[winner.k]++;
    this.give(lab, winner, winner === runner ? 500 : 300, null);
    lab.popup([0, 3.4, 0], `${winner === runner ? 'Бегун собрал яблоки' : 'Минёр победил'}: ${this.NAMES[winner.k]}! ${st.wins[0]} : ${st.wins[1]}`, this.COLORS[winner.k], 26);
    lab.sfx.win(); lab.slowmo(0.5, 0.4);
    // матч — по две роли каждому, потом счёт
    const rounds = Math.max(2, Math.round(cfg.pobed) * 2 - 2);
    if (st.round >= rounds && st.wins[0] !== st.wins[1]) lab.after(1.2, () => this.matchOver(lab, st.wins[0] > st.wins[1] ? st.h[0] : st.h[1]));
  },

  // ---------- бот: ищет безопасную клетку, ставит бомбу, когда есть куда убежать ----------
  dangerMap(lab, extra, out) {
    const st = lab.state, D = out || st.danger;
    D.fill(99);
    for (let i = 0; i < st.N; i++) if (st.flameT[i] > 0) D[i] = 0;
    // сжатие двора: следующие клетки спирали скоро завалит
    if (st.press) for (let k = 0; k < 6 && st.pressI + k < st.press.length; k++) { const [i, j] = st.press[st.pressI + k], id = this.idx(st, i, j); D[id] = Math.min(D[id], Math.max(0, st.pressT) + k * 0.34 + 0.55); }
    const list = extra ? st.bombs.concat(extra) : st.bombs;
    for (let pass = 0; pass < 2; pass++) for (const b of list) {
      const t0 = Math.min(b.t, D[this.idx(st, b.i, b.j)]);
      for (const [i, j] of this.blastCells(st, b)) { const id = this.idx(st, i, j); if (t0 < D[id]) D[id] = t0; }
    }
    return D;
  },
  // поиск в ширину по сетке; avoid — карта опасности: в клетки, которые скоро вспыхнут, путь не идёт
  // timed — карта опасности с часами: в клетку нельзя войти, если огонь будет там, когда бот до неё дойдёт
  bfs(lab, h, from, avoid, timed) {
    const st = lab.state, dist = new Int16Array(st.N).fill(-1), prev = new Int16Array(st.N).fill(-1), q = [this.idx(st, from[0], from[1])];
    const sp = h ? h.speed : 3.6;
    dist[q[0]] = 0;
    for (let k = 0; k < q.length; k++) {
      const id = q[k], i = id % st.W, j = (id / st.W) | 0;
      for (const [dx, dy] of this.DIRS) {
        const ni = i + dx, nj = j + dy;
        if (!this.passable(st, ni, nj, h)) continue;
        const nid = this.idx(st, ni, nj);
        if (dist[nid] >= 0 || avoid && avoid[nid] < 99) continue;
        if (timed && timed[nid] < 99) { const at = (dist[id] + 1) / sp; if (at >= timed[nid] - 0.35 && at <= timed[nid] + 0.75) continue; }
        dist[nid] = dist[id] + 1; prev[nid] = id; q.push(nid);
      }
    }
    return { dist, prev };
  },
  // «прокоп» до цели: сколько идти, если ящики по пути взрывать (ящик — 4 шага). Им бот находит дорогу к соседу сквозь стога
  digMap(lab, from) {
    const st = lab.state, d = new Float32Array(st.N).fill(1e9), q = [this.idx(st, from[0], from[1])];
    d[q[0]] = 0;
    while (q.length) {
      let bi = 0; for (let k = 1; k < q.length; k++) if (d[q[k]] < d[q[bi]]) bi = k;
      const id = q.splice(bi, 1)[0], i = id % st.W, j = (id / st.W) | 0;
      for (const [dx, dy] of this.DIRS) {
        const ni = i + dx, nj = j + dy;
        if (!this.inside(st, ni, nj)) continue;
        const nid = this.idx(st, ni, nj), g = st.grid[nid];
        if (g === 1 || g === 3 || g === 4) continue;
        const nd = d[id] + (g === 2 ? 4 : 1);
        if (nd < d[nid]) { if (d[nid] >= 1e9) q.push(nid); d[nid] = nd; }
      }
    }
    return d;
  },
  firstStep(st, prev, target, start) {
    let id = target;
    while (prev[id] >= 0 && prev[id] !== start) id = prev[id];
    return [id % st.W, (id / st.W) | 0];
  },
  bot(lab, h, dt) {
    const st = lab.state, cfg = lab.cfg, out = { dx: 0, dy: 0, bomb: false, kick: false, dash: false };
    const [ci, cj] = this.cellOf(h), here = this.idx(st, ci, cj), cps = h.speed;
    h.think -= dt;
    const D = this.dangerMap(lab);
    const unsafe = D[here] < 99;
    if (h.think <= 0 || unsafe && !h.fleeing) {
      h.think = lab.rand(0.18, 0.35) / cfg.bot;
      // в безопасности ходим только по безопасным клеткам; в опасности — любой дорогой к ближайшей безопасной
      const { dist, prev } = this.bfs(lab, h, [ci, cj], unsafe ? null : D, unsafe ? D : null);
      const ok = id => dist[id] >= 0 && D[id] >= 99 && st.flameT[id] <= 0;
      const reachable = id => dist[id] >= 0 && (D[id] >= 99 || D[id] - dist[id] / cps > 0.45);
      let goal = -1;
      h.fleeing = unsafe;
      if (unsafe) {
        // в опасности — к ближайшей безопасной клетке
        let bd = 999; for (let id = 0; id < st.N; id++) if (ok(id) && dist[id] < bd && this.pathSafe(st, prev, id, here, D, dist, cps)) { bd = dist[id]; goal = id; }
        if (goal < 0) { bd = 999; for (let id = 0; id < st.N; id++) if (ok(id) && dist[id] < bd) { bd = dist[id]; goal = id; } }
        if (h.k === 1 && st.mode === 2 && h.dashCd <= 0 && D[here] < 0.6) out.dash = true;
      } else {
        const foe = st.h[1 - h.k], mode = st.mode;
        const role = mode === 2 ? st.roles[h.k] : null;
        // цели по порядку: яблоко бегуна, поднять друга, бонус, сосед в линии огня, ящик рядом, подойти к соседу или к иныжу
        const want = [];
        if (role === 'begun') st.apples.forEach(a => want.push([this.idx(st, a.i, a.j), 0]));
        if (mode === 1 && !foe.alive && foe.mark && foe.ghost) want.push([this.idx(st, foe.mark.i, foe.mark.j), -5]);
        st.pus.forEach(p => want.push([this.idx(st, p.i, p.j), 1]));
        let best = -1, bs = 1e9;
        for (const [id, w] of want) if (reachable(id) && dist[id] + w * 2 < bs) { bs = dist[id] + w * 2; best = id; }
        goal = best;
        if (role !== 'begun') {
          const canBomb = st.bombs.filter(b => b.owner === h).length < h.maxB && !st.bombs.some(b => b.i === ci && b.j === cj);
          const hits = canBomb && this.bombWorth(lab, h, ci, cj);
          if (hits && this.escapeAfterBomb(lab, h, ci, cj) && lab.chance(Math.min(1, 0.55 * cfg.bot + 0.2))) { out.bomb = true; h.think = 0.05; }
          if (goal < 0) {
            // к клетке рядом с ящиком или к сопернику
            let bd2 = 1e9;
            const dig = mode === 0 && foe.alive ? this.digMap(lab, this.cellOf(foe)) : null;
            for (let id = 0; id < st.N; id++) {
              if (!reachable(id) || D[id] < 99) continue;
              const i = id % st.W, j = (id / st.W) | 0;
              let score = dist[id] * 1.2;
              const nearCrate = this.DIRS.some(([dx, dy]) => this.inside(st, i + dx, j + dy) && st.grid[this.idx(st, i + dx, j + dy)] === 2);
              const enemy = mode === 1 ? st.enemies.length && Math.min(...st.enemies.map(e => Math.abs(e.x - i) + Math.abs(e.y - j))) : (dig ? Math.min(40, dig[id]) : 99);
              const hunt = mode === 0 ? Math.min(1, st.rt / 25) : 0; // к середине раунда бот идёт охотиться: ящики по сторонам ему уже не нужны
              if (nearCrate) score -= 3 * (1 - hunt); if (enemy !== false) score += enemy * (mode === 1 ? 0.4 : 0.6 + hunt * 2.4);
              if (mode === 1 && enemy < 2) score += 6; // от иныжа держимся на расстоянии бомбы
              if (score < bd2) { bd2 = score; goal = id; }
            }
          }
        }
      }
      h.goal = goal;
      h.next = goal >= 0 && goal !== here ? this.firstStep(st, prev, goal, here) : null;
    }
    // шаг к следующей клетке пути; в опасную клетку без нужды не входим
    if (h.next) {
      const [ni, nj] = h.next, nid = this.idx(st, ni, nj);
      if (!unsafe && D[nid] < 99) { h.next = null; h.think = 0; return out; }
      if (st.flameT[nid] > 0) return out;
      const ddx = ni - h.x, ddy = nj - h.y;
      // ось — по большему смещению; до поперечной полосы walk выровняет сам, лишний шаг за центр клетки срезается lim
      if (Math.abs(ddx) > 0.03 || Math.abs(ddy) > 0.03) {
        if (Math.abs(ddx) >= Math.abs(ddy)) { out.dx = Math.sign(ddx); out.lim = Math.abs(ddx) + Math.abs(ddy); }
        else { out.dy = Math.sign(ddy); out.lim = Math.abs(ddy) + Math.abs(ddx); }
      } else { h.x = ni; h.y = nj; h.next = null; }
    }
    return out;
  },
  pathSafe(st, prev, target, start, D, dist, cps) {
    let id = target;
    while (id >= 0 && id !== start) { if (D[id] < 99 && Math.abs(D[id] - dist[id] / cps) < 0.5) return false; id = prev[id]; }
    return true;
  },
  bombWorth(lab, h, i, j) {
    const st = lab.state, fake = { i, j, r: h.range, t: lab.cfg.fuse };
    const cells = this.blastCells(st, fake);
    const foe = st.h[1 - h.k];
    if (st.mode === 0 && foe.alive && cells.some(([x, y]) => Math.abs(foe.x - x) + Math.abs(foe.y - y) < 1.3)) return true;
    if (st.mode === 1 && st.enemies.some(e => cells.some(([x, y]) => Math.abs(e.x - x) + Math.abs(e.y - y) < 1.5))) return true;
    if (st.mode === 1 && foe.alive && cells.some(([x, y]) => this.onCell(foe, x, y, 0.8))) return false; // друга не подрываем
    return cells.some(([x, y]) => st.grid[this.idx(st, x, y)] === 2);
  },
  escapeAfterBomb(lab, h, i, j) {
    const st = lab.state, fake = { i, j, r: h.range, t: lab.cfg.fuse };
    const D = this.dangerMap(lab, [fake], st.danger2 || (st.danger2 = new Float32Array(st.N)));
    const save = h.passBomb; h.passBomb = null;
    const { dist } = this.bfs(lab, h, [i, j], null, D);
    h.passBomb = save;
    for (let id = 0; id < st.N; id++) if (dist[id] > 0 && D[id] >= 99 && dist[id] / h.speed < lab.cfg.fuse - 0.6) return true;
    return false;
  },

  // ---------- кадр: позы, огонь, крест предупреждения, HUD ----------
  draw(lab, dt) {
    const st = lab.state, cfg = lab.cfg, t = st.wt || lab.t;
    if (st.mode === 1) this.coopTick(lab, dt);
    for (const h of st.h) {
      if (h.alive) {
        h.g.position.set(this.wx(st, h.x), 0, this.wz(st, h.y));
        const yaw = Math.atan2(h.dir[0], h.dir[1]);
        h.body.rotation.y = lab.damp(h.body.rotation.y, yaw, 18, dt || 0.016);
        h.body.position.y = h.moving ? Math.abs(Math.sin(t * 14)) * 0.12 : Math.sin(t * 3 + h.k) * 0.02;
        h.body.scale.set(1.25, 1.25 * (1 + Math.sin(t * 3 + h.k) * 0.03), 1.25); // герой крупнее клетки на глаз: читается сверху
        h.tag.position.y = 2.1 + Math.sin(t * 4 + h.k) * 0.08;
        const sh = cfg.shchit - st.rt;
        h.bubble.visible = sh > 0 && !(sh < 2 && Math.floor(t * 10) % 2);
      }
      const miner = st.mode === 2 && st.roles[h.k] === 'miner';
      if (miner && h.alive) { h.g.position.set(st.tower.position.x + (h.k ? 0.4 : -0.4), 3.3, st.tower.position.z); h.body.rotation.y = 0; }
    }
    // бомбы: дышат, белеют к взрыву, искра фитиля
    for (const b of st.bombs) {
      const k = 1 - b.t / b.fuse, beat = Math.sin(t * (8 + k * 22)) * (0.04 + k * 0.08);
      if (!(b.drop > 0)) b.slot.g.position.set(this.wx(st, b.x), 0, this.wz(st, b.y));
      b.slot.body.scale.setScalar(1 + beat + k * 0.18);
      b.slot.body.material = lab.mat(k > 0.75 && Math.floor(t * 16) % 2 ? '#ffe0e0' : b.ghost ? '#4a3a70' : b.sky ? '#5a2030' : '#232634', { shiny: true, smooth: true });
      b.slot.spark.scale.setScalar(0.8 + 0.3 * (1 + Math.sin(t * 41 + b.i * 7)));
    }
    // огонь и красный крест будущего взрыва: копии переставляются, только когда клетка поменялась
    const D = cfg.podsvetka >= 1 ? this.dangerMap(lab) : null, C1 = st.tmp.c1 || (st.tmp.c1 = new lab.THREE.Color('#ff8a3a')), C2 = st.tmp.c2 || (st.tmp.c2 = new lab.THREE.Color('#ff2440'));
    const seen = st.cellLook || (st.cellLook = new Int16Array(st.N).fill(-1));
    for (let id = 0; id < st.N; id++) {
      const i = id % st.W, j = (id / st.W) | 0, f = st.flameT[id];
      const fs = f > 0 ? 1 + Math.round(Math.min(1, f / 0.2) * 8) : 0;
      const wk = D && D[id] < 99 && f <= 0 ? 1 + Math.round(lab.clamp(1 - D[id] / cfg.fuse, 0, 1) * 10) + (D[id] < cfg.fuse * 0.2 && Math.floor(t * 12) % 2 ? 20 : 0) : 0;
      const look = fs * 64 + wk;
      if (seen[id] === look) continue;
      seen[id] = look;
      if (fs) {
        const s = (fs - 1) / 8;
        lab.place(st.fireIM, id, [this.wx(st, i), 0.38, this.wz(st, j)], { scale: [Math.max(0.05, s), 0.6 + s * 0.6, Math.max(0.05, s)] });
        lab.place(st.fireCore, id, [this.wx(st, i), 0.45, this.wz(st, j)], { scale: Math.max(0.05, s) });
      } else { lab.place(st.fireIM, id, [0, -9, 0], { scale: 0 }); lab.place(st.fireCore, id, [0, -9, 0], { scale: 0 }); }
      if (wk) {
        const k = ((wk % 20) - 1) / 10;
        lab.place(st.warnIM, id, [this.wx(st, i), 0.11, this.wz(st, j)], { scale: 0.5 + k * 0.5, color: wk > 20 ? '#ffffff' : st.tmp.c.copy(C1).lerp(C2, k) });
      } else lab.place(st.warnIM, id, [0, -9, 0], { scale: 0 });
    }
    // бонусы крутятся и подпрыгивают
    for (const p of st.pus) { p.slot.g.rotation.y = t * 2; for (const k in p.slot.ico) p.slot.ico[k].position.y = 0.72 + Math.sin(t * 4 + p.i) * 0.1; }
    // иныжи и бесенята
    for (const e of st.enemies) {
      e.slot.g.position.set(this.wx(st, e.x), Math.abs(Math.sin(t * (e.kind === 'bes' ? 12 : 5))) * 0.12, this.wz(st, e.y));
      e.slot.g.rotation.y = Math.atan2(e.dir[0], e.dir[1]);
      e.slot.g.visible = !(e.hurt > 0 && Math.floor(t * 16) % 2);
    }
    // яблоки и прицел минёра
    for (let k = 0; k < 4; k++) {
      const a = st.apples[k];
      lab.place(st.appleIM, k, a ? this.at(st, a.i, a.j, 0.55 + Math.sin(t * 4 + k) * 0.1) : [0, -9, 0], { scale: a ? Math.min(1, (a.age || 0) * 4 + 0.2) : 0, rot: t });
    }
    st.tower.visible = st.mode === 2;
    st.cross.visible = st.mode === 2 && !st.solo && !!st.hawk;
    if (st.cross.visible) { st.cross.position.set(this.wx(st, st.hawk.x), 0, this.wz(st, st.hawk.y)); st.cross.rotation.y = t; st.cross.scale.setScalar(st.hawk.cd > 0 ? 0.7 : 1); }
    for (const c of st.clouds) c.position.x = ((c.position.x + 0.4 * (dt || 0) + 50) % 100) - 50;
    for (const hn of st.hens) { hn.t += dt || 0; hn.g.position.x += hn.vx * (dt || 0); if (Math.abs(hn.g.position.x) > st.fenceR[0] + 3) hn.vx *= -1; hn.g.rotation.y = hn.vx > 0 ? Math.PI / 2 : -Math.PI / 2; hn.g.position.y = Math.abs(Math.sin(hn.t * 6)) * 0.1; }
    this.hud(lab);
  },
  hud(lab) {
    const st = lab.state, [a, b] = st.h, p2 = st.p2human ? 'Игрок 2' : st.p2human === false ? 'Игрок 2 (бот — нажми стрелки)' : 'бот';
    const dots = n => '●'.repeat(n) + '○'.repeat(Math.max(0, Math.round(lab.cfg.pobed) - n));
    if (st.mode === 1) {
      lab.hud('match', `Волна ${st.wave} · ${'❤'.repeat(Math.max(0, st.hearts))} общие сердца · иныжей во дворе: ${st.enemies.length}`, { color: '#c8a8ff', size: 18 });
      lab.hud('p2', `${this.NAMES[1]} (${p2}): ${st.p2pts} очков`, { color: this.COLORS[1], size: 14 });
    } else {
      lab.hud('match', `${this.NAMES[0]} ${dots(st.wins[0])}  :  ${dots(st.wins[1])} ${this.NAMES[1]}`, { color: '#ffffff', size: 20 });
      lab.hud('p2', `${this.NAMES[1]} (${p2}): ${st.p2pts} очков`, { color: this.COLORS[1], size: 14 });
    }
    if (st.mode === 2) {
      const mi = st.roles.indexOf('miner');
      lab.hud('role', st.solo ? `Бегун: ${this.NAMES[1 - mi]} · яблок ${st.applesGot} из 6 · минёр отдыхает: бомбы падают сами` : `Бегун: ${this.NAMES[1 - mi]} · яблок ${st.applesGot} из 6 · минёр: ${this.NAMES[mi]} (прицел — бегать, A — бомба)`, { color: '#ffd23f', size: 15 });
      lab.hud('time', `⏱ ${Math.max(0, Math.ceil(40 - st.rt))} с`, { color: '#ffffff', size: 15 });
    } else lab.hud('role', null);
    if (st.mode === 0) {
      const from = lab.cfg.dvor >= 1 ? 30 : lab.cfg.szhat;
      lab.hud('time', st.solo ? `⏱ ${Math.max(0, Math.ceil(45 - st.rt))} с · ящиков: ${a.crates} : ${b.crates}` : from ? (st.rt < from ? `Двор сожмётся через ${Math.ceil(from - st.rt)} с` : 'Двор сжимается!') : null, { color: st.rt >= from && from ? '#ff8a6a' : '#e8ecff', size: 15 });
    } else if (st.mode === 1) lab.hud('time', null);
    lab.hud('revenge', st.revenge ? `👻 ${this.NAMES[st.revenge.h.k]} — дух на плетне: ${Math.ceil(st.revenge.t)} с (A — бросить бомбу)` : null, { color: '#c8b8ff', size: 16 });
    lab.hud('banner', st.bannerT > 0 ? st.banner : null, { color: '#ffd23f', size: 18 });
    lab.hud('shield', st.phase === 'play' && st.rt < lab.cfg.shchit ? `🛡 Щит: ${Math.ceil(lab.cfg.shchit - st.rt)} с — огонь пока не страшен` : null, { color: '#9fe8ff', size: 14 });
    const me = a.alive ? `💣 ${a.maxB}  🔥 ${a.range}  👟 ${Math.round(a.speed * 10) / 10}` : '';
    lab.hud('stats', me || null, { color: '#ffd9a0', size: 13 });
  },

  overNote(lab) {
    const st = lab.state, min = Math.max(0.5, st.wt / 60);
    const per = Math.round(st.inter / min * 10) / 10;
    const lines = [];
    if (st.mode === 1) lines.push(`Волн: ${st.wave} · спас друга: ${st.revives}`);
    else lines.push(`Счёт матча ${st.wins[0]} : ${st.wins[1]}`);
    if (st.mode === 0) lines.push(`Подловил соседа: ${st.caught} · чуть не подловил: ${st.almost} · месть духа: ${st.revenges}`);
    if (st.mode === 2) lines.push(`Яблок за последний раунд: ${st.applesGot}`);
    lines.push(`Ящиков: ${st.crates} · бонусов: ${st.pickups} · пинков: ${st.kicks}`);
    lines.push(`Встреч игроков за минуту: ${per}` + (st.solo ? ' — каждый играл сам по себе' : per >= 3 ? ' — вы играли друг с другом, а не рядом' : ''));
    return lines;
  },
};
