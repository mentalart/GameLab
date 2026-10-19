// «НЛО в станице» — ремейк-донор урока 1 по мотивам механики Space Invaders, на оболочке «Лаб3D 1.0» (three.js).
// Спрятанная механика донора: волна ускоряется с каждым сбитым — ручка «Спрятанная механика: ускорение от числа сбитых». Последнее НЛО несётся
// как сумасшедшее, марш-сердцебиение из четырёх нот частит вместе с волной (Space Invaders, 1978).
// Лучшие игры жанра, из которых взяты моменты (разбор — docs/01_Журнал_курса.md, «Урок 1: донор переосмыслен»):
//   Galaga — НЛО срывается из строя в пике на пушку; сбитое в пике — очки ×2; луч-похититель; бонусный налёт без выстрелов;
//            «босс» строя держит два попадания — здесь бронированные НЛО заднего ряда;
//   Galaxian — флагман пикирует со звеном: собьёшь всё звено в пике — большая награда;
//   Defender — похититель уносит жителя, сбей похитителя, пока луч тянет: здесь бурёнку с выгона;
//   Missile Command — станица, которую защищаешь, видна и подсчитывается в конце каждой волны;
//   Space Invaders Extreme — цепочка одного цвета: четыре НЛО одного ряда подряд — подарок-подкова;
//   Raiden, 1942, Gradius, Space Invaders Infinity Gene — ствол растёт по ступеням: ядро → двустволка → веер → очередь → разрывные.
//            Ступень дают подкова с ярмарочного шара (как POW в 1942), подкова за цепочку и каждые levelScore очков (Infinity Gene);
//            попадание по пушке отнимает ступень (как в Raiden), так что сильный ствол надо беречь;
//   Space Invaders — стога-укрытия рассыпаются по блоку, золотое НЛО (тарелка-загадка) — здесь мини-босс с веером.
// Выстрел собран по правилам стреляющего героя: заряд, ядро со следом, отдача, искры сквозь врага, вспышка, звук, последствия, очки.
// Все НЛО — копии одной детали (InstancedMesh): 96 тарелок рисуются за 6 вызовов отрисовки, бурёнки — за один.
// Ось Z в three.js смотрит на игрока: строй НЛО — вдали (−Z), пушка и станица — ближе к нам (+Z).
/* ПЛАН
   Фраза игры: ты — казак-наводчик латунной пушки, ты катишь её по улице станицы и бьёшь по волне НЛО, но волна спускается к хатам,
   а похитители тянут бурёнок с выгона. Цель — продержаться как можно больше волн и не дать НЛО сесть на крыши.
   Ядро на 3 секунды: катишь пушку под НЛО → жмёшь A → огненное ядро, тарелка вспыхивает, горит и падает, очки всплывают.
   Выбор, оплаченный очками: прятаться за стогом или выйти под пике и луч похитителя (спасённая бурёнка +300, звено +300);
   сбивать по цвету ради подарка или самое опасное первым; бить броню заднего ряда или передних, что ближе к станице.
   Угрозы: строй (идёт и стреляет, предупреждает лучом), пике (дуга на пушку, круг на земле), звено (три пике сразу),
   похититель (не стреляет, крадёт бурёнку), броненосец (два попадания), золотое НЛО (веер, ярость).
   Кривая партии: 0–9 с — строй влетает и шагает, первый выстрел НЛО на 4-й секунде, урон не раньше 9-й;
   9 с — первое пике; 12 с — золотое НЛО; 20 с — первый похититель; волна 2 — клин и звенья; после волны 2 — ночной налёт
   (передышка: НЛО не стреляют); волна 3 — броня заднего ряда; дальше формы строя чередуются, рядов больше, всё чаще.
   Ствол растёт по ступеням (подкова с ярмарочного шара, за цепочку, за очки) и слабеет от попаданий: ядро, двустволка, веер, очередь, разрывные.
   События: пике, звено, похититель, спасение бурёнки, цепочка и подкова, ярмарочный шар, новая ступень ствола, золотое НЛО и его ярость, броня слетает,
   набат «Станица в опасности», чистая волна, подсчёт бурёнок, ночной налёт и «Идеально!».
   Лицо игры: кубанская ночь при луне, белёные хаты с тёплыми окнами, холодные неоновые НЛО на фоне большой луны.
   Арт (разбор 19.10.2026): «тёплая станица против холодного неона» — три слоя яркости: станица и поле приглушены, неон строя и луна
   ярче всего, пушка — в своём пятне света. Длиннофокусная камера, задник с луной и тополями-силуэтами, три силуэта тарелок по рядам.
   Палитра: ночь #0b1233, хаты #f4efe4, солома #c9a24a, окна #ffc65a, лучи НЛО #5fe0ff #ff6ad5, луч похитителя #b6ff5c, опасность #ff4d5e.
   Три фирменных приёма: луч под каждым НЛО его цвета (краснеет перед выстрелом); тёплые окна хат, которые мигают набатом;
   бурёнка, которая плывёт вверх в зелёном луче.
*/
const GAME = {
  engine: 'three',
  title: 'НЛО в станице',
  subtitle: 'Волна НЛО спускается к станице. Сбей всех, пока они не сели на крыши хат, и не отдай бурёнок.',
  donor: 'Space Invaders',
  players: 1,
  controls: [
    { input: 'move', text: 'катить пушку' },
    { input: 'a', text: 'выстрел' },
  ],
  camera: { type: 'iso', tilt: 1.08, target: [0, 0, 0.5], fov: 0.55 }, // длиннофокусная: перспектива сжата, строй крупнее, хаты ниже и уже
  field: { w: 25, h: 27 }, // камера держит в кадре поле до улицы: хаты за пушкой видны крышами, бой — крупно
  shadowSize: 26,
  sky: ['#0b1233', '#5b3f72'],
  fog: 0.008,
  accent: '#ffe08a',
  scoreColor: '#ffd23f', // счёт золотом
  decisions: [
    'Чувство: напряжение растёт к концу волны, последнее НЛО несётся как сумасшедшее, а за спиной — хаты, которые надо уберечь',
    'Честность: перед выстрелом луч под НЛО краснеет, путь снаряда виден на земле, перед пике и похищением — круг на земле',
    'Выбор: прятаться за стогом или выйти под пике и спасти бурёнку; сбивать НЛО одного цвета ради подарка или самое опасное первым',
  ],
  config: {
    baseStep: { value: 0.7, min: 0.15, max: 1.5, step: 0.05, label: 'Шаг волны в начале, с' },
    speedup: { value: 1, min: 0, max: 1, step: 0.05, label: 'Спрятанная механика: ускорение от числа сбитых', hint: '0 — волна не ускоряется, 1 — как в оригинале' },
    stepDown: { value: 0.9, min: 0.3, max: 2, step: 0.1, label: 'Шаг вниз у края, м' },
    fireEvery: { value: 1.4, min: 0.3, max: 4, step: 0.1, label: 'НЛО стреляют раз в, с' },
    telegraph: { value: 0.55, min: 0, max: 1.2, step: 0.05, label: 'Предупреждение перед выстрелом, с' },
    bombSpeed: { value: 7, min: 2, max: 16, step: 0.5, label: 'Скорость снарядов НЛО' },
    playerSpeed: { value: 11, min: 4, max: 20, step: 0.5, label: 'Скорость пушки' },
    fireRate: { value: 2.5, min: 0.5, max: 6, step: 0.1, label: 'Скорострельность, выстрелов в секунду' },
    maxShots: { value: 2, min: 0, max: 6, step: 1, label: 'Ядер в полёте не больше', hint: 'как в Galaga: промах летит до края поля, попадание освобождает ствол раньше; 0 — без предела' },
    bulletSpeed: { value: 28, min: 10, max: 50, step: 1, label: 'Скорость выстрела' },
    combo: { value: 5, min: 0, max: 20, step: 1, label: 'Попаданий подряд до множителя очков', hint: '0 — без серии; промах обнуляет серию' },
    diveEvery: { value: 9, min: 0, max: 20, step: 0.5, label: 'НЛО срывается в пике раз в, с', hint: 'как в Galaga; 0 — без пике' },
    diveTime: { value: 1.5, min: 0.6, max: 3, step: 0.1, label: 'Пике длится, с' },
    escortFrom: { value: 2, min: 0, max: 10, step: 1, label: 'Пике звеном с волны', hint: 'как в Galaxian: флагман и двое ведомых; 0 — без звеньев' },
    abductEvery: { value: 16, min: 0, max: 40, step: 1, label: 'Похититель прилетает за бурёнкой раз в, с', hint: 'как в Defender; 0 — без похитителей' },
    abductTime: { value: 3.5, min: 1.5, max: 8, step: 0.5, label: 'Луч похитителя поднимает бурёнку за, с' },
    cows: { value: 4, min: 0, max: 6, step: 1, label: 'Бурёнок на выгоне', restart: true },
    armorFrom: { value: 3, min: 0, max: 10, step: 1, label: 'Броня у заднего ряда с волны', hint: 'два попадания, как у босса Galaga; 0 — без брони' },
    bonusEvery: { value: 2, min: 0, max: 5, step: 1, label: 'Ночной налёт после каждой N-й волны', hint: 'как бонусный этап Galaga: НЛО не стреляют; 0 — без налётов' },
    chain: { value: 4, min: 0, max: 8, step: 1, label: 'Цепочка: НЛО одного цвета подряд до подарка', hint: 'как в Space Invaders Extreme: подарок — подкова, ствол на ступень сильнее; 0 — без подарков' },
    weaponStart: { value: 1, min: 1, max: 5, step: 1, label: 'Ступень ствола в начале', hint: '1 — ядро, 2 — двустволка, 3 — веер, 4 — очередь, 5 — разрывные', restart: true },
    balloonEvery: { value: 22, min: 0, max: 60, step: 1, label: 'Ярмарочный шар с подковой пролетает раз в, с', hint: 'как POW в 1942: сбей шар и поймай подкову; 0 — без шара' },
    levelScore: { value: 3000, min: 0, max: 20000, step: 500, label: 'Ступень ствола за каждые N очков', hint: 'как эволюция в Space Invaders Infinity Gene; 0 — без ступеней за очки' },
    loseLevel: { value: 1, min: 0, max: 4, step: 1, label: 'Попадание по пушке отнимает ступеней', hint: 'как в Raiden; 0 — ствол не слабеет' },
    rows: { value: 3, min: 1, max: 6, step: 1, label: 'Рядов НЛО в первой волне', hint: 'каждая следующая волна на ряд больше', restart: true },
    cols: { value: 8, min: 3, max: 10, step: 1, label: 'НЛО в ряду', restart: true },
    shields: { value: 4, min: 0, max: 5, step: 1, label: 'Стогов-укрытий', restart: true },
    lives: { value: 3, min: 1, max: 9, step: 1, label: 'Жизни', restart: true },
    bossAt: { value: 12, min: 3, max: 60, step: 1, label: 'Золотое НЛО прилетает через, с' },
    bossHP: { value: 10, min: 1, max: 30, step: 1, label: 'Золотое НЛО: попаданий до победы' },
    bossFan: { value: 3, min: 1, max: 7, step: 1, label: 'Золотое НЛО: снарядов в веере', hint: 'в ярости — на два больше' },
  },
  presets: {
    'Новичок': { baseStep: 0.95, fireEvery: 2.2, telegraph: 0.8, bombSpeed: 5.5, rows: 2, lives: 5, bossHP: 6, diveEvery: 10, diveTime: 2.2, abductTime: 5, escortFrom: 3, armorFrom: 4, balloonEvery: 16, loseLevel: 0 },
    'Без спрятанной механики': { speedup: 0 },
    'Классика 1978': { diveEvery: 0, chain: 0, bossAt: 25, bossHP: 1, bossFan: 1, escortFrom: 0, abductEvery: 0, armorFrom: 0, bonusEvery: 0, balloonEvery: 0, levelScore: 0, weaponStart: 1 },
    'Безумие': { baseStep: 0.35, fireEvery: 0.6, telegraph: 0.3, bombSpeed: 11, fireRate: 5, bossFan: 7, bossAt: 5, diveEvery: 2.5, diveTime: 1, escortFrom: 1, abductEvery: 6, armorFrom: 1, bonusEvery: 1, weaponStart: 3, balloonEvery: 8 },
  },

  PLAYER_Z: 11, // ряд пушки: улица станицы
  LINE_Z: 9.2, // плетень станицы: если НЛО дошло сюда — партия проиграна
  SHIELD_Z: 7.4,
  HUT_Z: 15.4, // ряд хат за пушкой
  SKY_Z: -19.5, // задник с небом и луной: за ним — «за горизонтом»
  MOON: { x: 3.5, y: 3.1, r: 2.7 },
  EDGE: 12, // край, до которого катится пушка и шагает строй
  ROWS: [ // цвет ряда, его имя для цепочки и очки (дальние ряды дороже, как в оригинале)
    { color: '#5fe0ff', name: 'голубых', points: 10 }, { color: '#7cf5a8', name: 'зелёных', points: 10 },
    { color: '#ffd23f', name: 'жёлтых', points: 20 }, { color: '#ff6ad5', name: 'розовых', points: 20 },
    { color: '#a98bff', name: 'фиолетовых', points: 30 }, { color: '#ff8a3d', name: 'оранжевых', points: 30 },
  ],
  SHAPES: ['ряды', 'клин', 'две стаи', 'шахматы'], // форма строя по волнам, по кругу
  WEAPONS: [ // ступени ствола: имя, что даёт, цвет следа и огонька на стволе, цвет ядра
    { name: 'Ядро', tip: 'одно ядро', color: '#ff9a3d', core: '#fff3a0' },
    { name: 'Двустволка', tip: 'два ядра рядом', color: '#ffd23f', core: '#fff6c8' },
    { name: 'Веер', tip: 'три ядра веером', color: '#7cf5a8', core: '#d9ffe6' },
    { name: 'Очередь', tip: 'веер, и стреляет чаще', color: '#5fe0ff', core: '#e6fbff' },
    { name: 'Разрывные', tip: 'среднее ядро рвётся кругом', color: '#ff5a3d', core: '#ffe0d0' },
  ],
  BEAM: '#b6ff5c', // луч похитителя — цвет, которого нет у строя
  POOL: 96, // мест в пачке копий НЛО: волна до 60 тарелок и сбитые прошлой волны, которые ещё падают

  // ---------- новая партия: строим мир, состояние кладём в lab.state ----------
  start(lab, scene) {
    const T = lab.THREE, st = lab.state;
    Object.assign(st, {
      wave: 1, waveMul: 1, shots: 0, hits: 0, shieldTime: 0, closest: 99, hurtInWave: false,
      bullets: [], bombs: [], charges: [], caps: [], saucers: [], slots: new Array(this.POOL).fill(null),
      boss: null, bossT: lab.cfg.bossAt, bossKills: 0, combo: 0, bestCombo: 0, fireT: 5.5, note: 0, reload: 0, want: 0,
      lastWarned: false, diveT: 9, dives: 0, diveKills: 0, flights: 0, flightsDone: 0, chainRow: -1, chainN: 0, chains: 0, gifts: 0,
      gunLv: Math.round(lab.cfg.weaponStart), bestLv: Math.round(lab.cfg.weaponStart), ups: 0, downs: 0, nextLv: lab.cfg.levelScore, balloon: null, balloonT: 15, balloons: 0,
      abductT: 20, abducts: 0, saved: 0, lost: 0, armorBroken: 0, bonus: null, bonusBest: -1, bonusPerfect: 0, danger: false, bellT: 0, smokeT: 0,
      scorchN: 0, geo: { core: new T.IcosahedronGeometry(1, 1), oct: new T.OctahedronGeometry(1), lane: new T.BoxGeometry(1, 0.02, 1), shoe: new T.TorusGeometry(0.42, 0.11, 6, 14, Math.PI * 1.35).rotateZ(-1.175 * Math.PI) }, tmp: { m: new T.Matrix4(), q: new T.Quaternion(), e: new T.Euler(), s: new T.Vector3(), p: new T.Vector3(), c: new T.Color(), zero: new T.Matrix4().makeScale(0, 0, 0) },
    });
    // ночь над станицей: лунный свет вместо солнца, тёплые окна хат — контраст с холодными лучами НЛО
    lab.light.sun.color.set('#aebcff'); lab.light.sun.intensity = 1.25;
    lab.light.hemi.intensity = 0.85;
    this.scenery(lab, scene);
    this.stanica(lab);
    this.cannon(lab);
    this.setWeapon(lab);
    this.saucerParts(lab);
    this.herd(lab);
    this.buildShields(lab);
    this.buildWave(lab);
    lab.hud('wave', 'Волна 1', { color: '#c4b2ff', size: 15 });
    const v = lab.view; // живая камера: база — расстояние, которое подобрала оболочка
    st.cam = { d: v.distance, k: 1, punch: 0, tx: v.target.x, tz: v.target.z, tilt: v.tilt, last: v.distance };
    if (!lab.playing) this.poster(lab);
  },
  // афиша в меню: строй на местах на фоне луны, похититель тянет бурёнку, камера ближе. Первый кадр партии всё возвращает:
  // меню рисует то, что поставлено здесь, а партия начинается с влёта волны, и камера плавно отъезжает на место
  poster(lab) {
    const st = lab.state, v = lab.view, C = st.cam, keep = st.saucers.map(s => [s.x, s.y, s.z]);
    st.saucers.forEach(s => { s.x = s.bx; s.y = 1.45; s.z = s.bz; });
    const w = st.cows[1] || st.cows[0], front = st.saucers.filter(s => s.row === 0);
    const thief = w && front.length ? front.reduce((a, b) => (Math.abs(b.bx - w.x) < Math.abs(a.bx - w.x) ? b : a)) : null;
    if (thief) { thief.x = w.x; thief.z = w.z; thief.y = 2.4; thief.abduct = { phase: 'beam', cow: w }; w.state = 'lift'; w.y = 0.7; }
    this.drawSaucers(lab, 0); this.moveCows(lab, 0);
    st.saucers.forEach((s, i) => { [s.x, s.y, s.z] = keep[i]; });
    if (thief) { thief.abduct = null; w.state = 'graze'; w.y = 0; }
    C.k = 0.86; v.distance = C.d * C.k; C.last = v.distance; v.tilt = C.tilt + 0.04; v.target.set(2, 1.5, -5.5);
  },
  // живая камера: еле заметно дышит, к последнему НЛО волны наезжает и ведёт его, от сбитого золотого НЛО — короткий толчок
  liveCamera(lab, dt) {
    const st = lab.state, v = lab.view, C = st.cam;
    if (!v || !C) return;
    if (Math.abs(v.distance - C.last) > 0.01) C.d = v.distance / C.k; // окно поменяло размер — оболочка подобрала новое расстояние
    const last = !st.bonus && st.alive === 1 ? st.saucers.find(s => s.alive && !s.hidden) : null;
    C.punch = Math.max(0, C.punch - dt * 1.5);
    C.k = lab.damp(C.k, (last ? 0.93 : 1) * (1 - 0.07 * C.punch), 2.2, dt);
    const tx = C.tx + Math.sin(lab.t * 0.31) * 0.3 + (last ? (last.x - C.tx) * 0.22 : 0), tz = C.tz + Math.sin(lab.t * 0.23) * 0.2 + (last ? (last.z - C.tz) * 0.15 : 0);
    v.target.set(lab.damp(v.target.x, tx, 2.2, dt), lab.damp(v.target.y, 0, 2.2, dt), lab.damp(v.target.z, tz, 2.2, dt));
    v.tilt = lab.damp(v.tilt, C.tilt, 2.2, dt);
    v.distance = C.d * C.k; C.last = v.distance;
  },

  // ---------- каждый кадр ----------
  update(lab, dt) {
    const st = lab.state, cfg = lab.cfg, p = lab.p1, c = st.gun;
    // пушка: разгон по стику, отдача гаснет, на поворотах кренится
    c.vx = lab.damp(c.vx, p.x * cfg.playerSpeed, 18, dt);
    c.g.position.x = lab.clamp(c.g.position.x + c.vx * dt, -this.EDGE, this.EDGE);
    c.g.position.z = lab.damp(c.g.position.z, this.PLAYER_Z, 14, dt);
    c.g.rotation.z = lab.damp(c.g.rotation.z, -c.vx * 0.01, 10, dt);
    c.wheels.forEach(w => { w.rotation.x -= c.vx * dt * 2.2; });
    c.g.visible = !lab.blink();
    // нажатие во время перезарядки не теряется: выстрел уйдёт, как только пушка готова
    st.reload -= dt; st.want = p.pressed.a ? 0.25 : st.want - dt;
    const flying = st.bullets.filter(b => b.main).length; // в полёте не больше maxShots залпов: точный выстрел перезаряжает раньше, чем промах
    if (st.want > 0 && st.reload <= 0 && (cfg.maxShots <= 0 || flying < cfg.maxShots + (st.gunLv >= 4 ? 1 : 0))) this.shoot(lab);
    const ready = 1 - lab.clamp(st.reload * this.rate(lab), 0, 1);
    c.charge.scale.setScalar(0.3 + 0.9 * ready); // огонёк на стволе разгорается к концу перезарядки
    if (this.underShield(lab, c.g.position.x)) st.shieldTime += dt;
    if (cfg.levelScore > 0 && lab.score >= st.nextLv) { st.nextLv = (Math.floor(lab.score / cfg.levelScore) + 1) * cfg.levelScore; this.levelUp(lab, 'очки'); } // эволюция за очки
    c.gunner.position.y = Math.abs(Math.sin(lab.t * 9)) * Math.min(0.12, Math.abs(c.vx) * 0.012);

    if (st.bonus) this.moveBonus(lab, dt);
    else { this.moveWave(lab, dt); this.dive(lab, dt); this.abduct(lab, dt); this.enemyFire(lab, dt); }
    this.moveBullets(lab, dt);
    this.moveBombs(lab, dt);
    this.moveBoss(lab, dt);
    this.moveWrecks(lab, dt);
    this.moveCaps(lab, dt);
    this.moveBalloon(lab, dt);
    this.moveCows(lab, dt);
    this.drawSaucers(lab, dt);
    this.lifeOfStanica(lab, dt);
    this.liveCamera(lab, dt);

    lab.stat('под стогом, %', Math.round(100 * st.shieldTime / Math.max(0.1, lab.t)));
    // HUD в цветах игры: волна сиреневым, стадо зелёным лучом, цепочка — цветом своего ряда, ствол — цветом ступени, тревога — красным
    lab.hud('left', st.bonus ? `Сбито ${st.bonus.killed} из ${st.bonus.total}` : 'НЛО: ' + st.alive, { color: '#c9d4ff' });
    const herd = st.cows.filter(w => w.state !== 'gone').length;
    lab.hud('herd', st.cows.length ? `🐄 × ${herd}` : null, { color: herd ? this.BEAM : '#ff8a7a' });
    const mult = this.mult(lab);
    lab.hud('combo', st.combo >= 2 ? `Серия ${st.combo}` + (mult > 1 ? ` · очки ×${mult}` : '') : null, { color: '#7cf5a8', size: mult > 1 ? 15 : 13 });
    const R = this.ROWS[st.chainRow];
    lab.hud('chain', cfg.chain > 0 && R && st.chainN > 0 ? `Цепочка ${R.name}: ${'●'.repeat(st.chainN)}${'○'.repeat(Math.max(0, cfg.chain - st.chainN))}` : null, { color: R ? R.color : null });
    const ups = cfg.balloonEvery > 0 || cfg.levelScore > 0 || cfg.chain > 0 || st.gunLv > 1;
    lab.hud('power', ups ? `Ствол: ${this.WEAPONS[st.gunLv - 1].name} (${st.gunLv}/${this.WEAPONS.length})` : null, { color: this.WEAPONS[st.gunLv - 1].color, size: 14 });
    const thief = st.saucers.some(s => s.alive && s.abduct && s.abduct.phase === 'beam');
    lab.hud('alarm', thief ? '🐄 Бурёнку уносят! Сбей похитителя' : st.danger ? '🔔 Станица в опасности!' : null, { color: thief ? this.BEAM : '#ff6a5a', size: 16 });
  },

  overNote(lab) {
    const st = lab.state, notes = [];
    const acc = st.shots ? Math.round(100 * st.hits / st.shots) : 0;
    notes.push(`Точность: ${acc}% (${st.hits} из ${st.shots}), лучшая серия — ${st.bestCombo}. Волна: ${st.wave}`);
    notes.push(`Под стогами ты провёл ${Math.round(100 * st.shieldTime / Math.max(0.1, lab.t))}% времени`);
    if (st.abducts) notes.push(`Похитители прилетали ${st.abducts} раз: бурёнок спасено ${st.saved}, украдено ${st.lost}`);
    if (st.dives) notes.push(`НЛО срывались в пике ${st.dives} раз, сбито в пике: ${st.diveKills}, звеньев целиком: ${st.flightsDone}. Цепочек одного цвета: ${st.chains}`);
    if (st.ups || st.bestLv > 1) notes.push(`Ствол: лучшая ступень — ${this.WEAPONS[st.bestLv - 1].name} (${st.bestLv} из ${this.WEAPONS.length}), новых ступеней ${st.ups}, потеряно от попаданий ${st.downs}${st.balloons ? ', ярмарочных шаров сбито ' + st.balloons : ''}`);
    if (st.bonusBest >= 0) notes.push(`Ночной налёт: лучший — ${st.bonusBest} из 24${st.bonusPerfect ? ', идеально — ' + st.bonusPerfect + ' раз' : ''}`);
    if (st.bossKills) notes.push(`Золотых НЛО сбито: ${st.bossKills}`);
    else if (st.boss) notes.push(`Золотое НЛО выдержало ${st.boss.max - st.boss.hp} попаданий из ${st.boss.max}`);
    else if (st.closest < 99) notes.push(`Ближе всего НЛО подошли к станице на ${Math.max(0, st.closest).toFixed(1)} м`);
    if (lab.cfg.speedup === 0) notes.push('Спрятанная механика выключена: волна не ускорялась. Заметил разницу?');
    return notes;
  },

  // ---------- мир: задник с луной, тополя, живой выгон, плетень с подсолнухами ----------
  // Три слоя яркости: станица и поле приглушены, холодный неон строя — самое яркое, луна за строем даёт тарелкам силуэт.
  scenery(lab, scene) {
    const T = lab.THREE, st = lab.state, Z = this.LINE_Z;
    lab.ground({ w: 160, h: 160, color: '#22413a', bumps: 4, flat: 0.3 });
    lab.box(27, 0.05, 25, '#2f5a40', { at: [0, 0.025, -3.5], shadow: false }); // выгон, где идёт бой
    lab.box(30, 0.04, 5.6, '#8a7a62', { at: [0, 0.03, 12.6], shadow: false }); // светлая пыльная улица: пушку на ней видно
    // борозды поперёк поля: по ним видно, сколько осталось НЛО до станицы
    const fur = lab.instances(new T.BoxGeometry(26, 0.06, 0.45), '#3a6a48', 12, { shadow: false });
    for (let i = 0; i < 12; i++) lab.place(fur, i, [0, 0.06, -16 + i * 2]);
    const rut = lab.instances(new T.BoxGeometry(30, 0.05, 0.22), '#6e5e46', 2, { shadow: false }); // колеи на улице
    lab.place(rut, 0, [0, 0.06, this.PLAYER_Z - 0.55]); lab.place(rut, 1, [0, 0.06, this.PLAYER_Z + 0.65]);
    // живое поле: кочки травы и редкие цветы, всё низкое и тёмное — фон для строя
    const tuft = lab.instances(new T.ConeGeometry(0.13, 0.42, 4), '#ffffff', 240, { shadow: false });
    for (let i = 0; i < 240; i++) lab.place(tuft, i, [lab.rand(-13, 13), 0.2, lab.rand(-16.5, 8.5)], { rot: lab.rand(0, 3), scale: [1, lab.rand(0.6, 1.3), 1], color: lab.pick(['#3f7a4e', '#4a8a55', '#356a46', '#2f5e40']) });
    const flower = lab.instances(new T.IcosahedronGeometry(0.08, 0), '#ffffff', 70, { shadow: false });
    for (let i = 0; i < 70; i++) lab.place(flower, i, [lab.rand(-13, 13), 0.3, lab.rand(-16, 8.5)], { color: lab.pick(['#e8e4ff', '#ffe27a', '#ff9ec7', '#9fc4ff']) });
    // задник: небо от горизонта до верха кадра — строй летит на его фоне, налёты и похитители уходят «за горизонт»
    const sky = new T.PlaneGeometry(130, 30, 1, 6), col = [], top = new T.Color('#0b1233'), hor = new T.Color('#5a3f78');
    for (let i = 0; i < sky.attributes.position.count; i++) { const k = (sky.attributes.position.getY(i) + 15) / 30, c = hor.clone().lerp(top, Math.min(1, k * 1.6)); col.push(c.r, c.g, c.b); }
    sky.setAttribute('color', new T.Float32BufferAttribute(col, 3));
    const back = new T.Mesh(sky, new T.MeshBasicMaterial({ vertexColors: true, fog: false }));
    back.position.set(0, 13, this.SKY_Z); back.userData.noShadow = true; scene.add(back);
    // большая луна за строем: с ореолом и пятнами, тарелки читаются на ней силуэтом
    const M = this.MOON;
    const halo = lab.mesh(new T.CircleGeometry(M.r * 1.9, 40), lab.mat('#3a2f2a', { unlit: true, add: true }), { at: [M.x, M.y, this.SKY_Z + 0.1], shadow: false });
    const moon = lab.mesh(new T.CircleGeometry(M.r, 40), lab.mat('#fff1c2', { unlit: true, glow: 0.3 }), { at: [M.x, M.y, this.SKY_Z + 0.2], shadow: false });
    const spots = lab.addons.BufferGeometryUtils.mergeGeometries([[-0.95, 0.7, 0.55], [0.85, -0.3, 0.75], [-0.25, -1.2, 0.4], [1.25, 1.1, 0.32]].map(([dx, dy, r]) => new T.CircleGeometry(r, 16).translate(dx, dy, 0)));
    lab.mesh(spots, lab.mat('#ead9a6', { unlit: true }), { at: [M.x, M.y, this.SKY_Z + 0.25], shadow: false }).material.fog = false; // пятна на луне — одна деталь
    halo.material.fog = false; moon.material.fog = false;
    // звёзды на заднике
    const pts = [];
    for (let i = 0; i < 140; i++) { const x = lab.rand(-60, 60), y = lab.rand(3, 27); if (Math.hypot(x - M.x, y - M.y) > M.r * 2) pts.push(x, y, this.SKY_Z + 0.3); }
    const g = new T.BufferGeometry(); g.setAttribute('position', new T.Float32BufferAttribute(pts, 3));
    scene.add(new T.Points(g, new T.PointsMaterial({ color: '#dfe6ff', size: 0.16, fog: false })));
    // горы Кавказа по краям задника, луна — в просвете между ними
    const hills = [];
    for (let i = 0; i < 12; i++) {
      const side = i % 2 ? 1 : -1, x = side * lab.rand(11 + (i >> 1) * 0.6, 46), r = lab.rand(2.5, 4.5), h = lab.rand(2.2, 4.2);
      hills.push(lab.cone(r, h, '#1c2346', { at: [x, h / 2 - 0.5, this.SKY_Z + 1.2], sides: 6, rot: lab.rand(0, 3) }));
      hills.push(lab.cone(r * 0.34, h * 0.34, '#8f9cc4', { at: [x, h - 0.5 - h * 0.17 + 0.05, this.SKY_Z + 1.2], sides: 6, rot: lab.rand(0, 3) }));
    }
    lab.noShadow(lab.merge(hills));
    // туман над дальним краем поля: тянется полосами
    const mg = new T.PlaneGeometry(36, 1.4, 12, 2), mc = [], mist = new T.Color('#1a2036'); // края гаснут в чёрный: при сложении цвета полоса без краёв
    for (let i = 0; i < mg.attributes.position.count; i++) { const k = (1 - Math.abs(mg.attributes.position.getX(i)) / 18) * (1 - Math.abs(mg.attributes.position.getY(i)) / 0.7); mc.push(mist.r * k, mist.g * k, mist.b * k); }
    mg.setAttribute('color', new T.Float32BufferAttribute(mc, 3));
    const mm = new T.MeshBasicMaterial({ vertexColors: true, transparent: true, blending: T.AdditiveBlending, depthWrite: false });
    st.mist = [0, 1].map(i => { const m = new T.Mesh(mg, mm); m.position.set(lab.rand(-4, 4), 0.5 + i * 0.3, -13.5 - i * 1.8); m.userData.noShadow = true; scene.add(m); return m; });
    // пирамидальные тополя — тонкие, синие в лунном свете; дальний ряд стоит силуэтами на фоне луны
    const N = 44, crown = lab.instances(new T.ConeGeometry(1, 1, 7), '#1f3550', N), trunk = lab.instances(new T.CylinderGeometry(0.12, 0.18, 1, 5), '#3a2c2a', N);
    for (let i = 0; i < N; i++) {
      let x, z;
      const far = i >= 22 && i < 34;
      if (i < 22) { x = (i % 2 ? 1 : -1) * lab.rand(18, 32); z = lab.rand(-17, 8); } else if (far) { x = lab.rand(-26, 26); z = this.SKY_Z + lab.rand(1.6, 3); } else { x = (i % 2 ? 1 : -1) * lab.rand(16, 22); z = lab.rand(13, 22); }
      const h = far ? lab.rand(2.2, 3.8) : lab.rand(3.5, 6);
      lab.place(trunk, i, [x, 0.6, z], { scale: [1, 1.2, 1] });
      lab.place(crown, i, [x, 1.1 + h / 2, z], { scale: [h * 0.15, h * 1.1, h * 0.15], rot: lab.rand(0, 3), color: lab.pick(['#ffffff', '#d6e2f0', '#c4d4e6']) });
    }
    // плетень — граница станицы. «Видно = правда»: НЛО, дошедшее до плетня, садится на станицу
    const posts = lab.instances(new T.CylinderGeometry(0.06, 0.08, 0.95, 5), '#6a4a32', 24);
    for (let i = 0; i < 24; i++) lab.place(posts, i, [-12.6 + i * 1.1, 0.47, Z + 0.4], { rot: lab.rand(-0.1, 0.1) });
    const rails = [];
    for (const y of [0.25, 0.48, 0.71]) rails.push(lab.box(25.6, 0.14, 0.09, '#86603e', { at: [0, y, Z + 0.4], rot: [lab.rand(-0.01, 0.01), 0, 0] }));
    lab.merge(rails);
    // подсолнухи у плетня и во дворах хат
    const F = 24, stem = lab.instances(new T.CylinderGeometry(0.04, 0.05, 1.3, 4), '#2f6e3a', F);
    const petals = lab.instances(new T.CylinderGeometry(0.3, 0.3, 0.06, 9), '#e0b020', F), heart = lab.instances(new T.CylinderGeometry(0.15, 0.15, 0.08, 8), '#4a3220', F);
    for (let i = 0; i < F; i++) {
      const yard = i >= 16, x = yard ? [-9, -4.5, 4.5, 9][(i - 16) % 4] + ((i - 16) < 4 ? -0.35 : 0.35) : -12.2 + i * 1.62 + lab.rand(-0.2, 0.2);
      const z = yard ? this.HUT_Z - 0.9 + lab.rand(-0.2, 0.2) : Z + 0.95, h = lab.rand(0.9, 1.25);
      lab.place(stem, i, [x, 0.65 * h, z], { scale: [1, h, 1] });
      lab.place(petals, i, [x, 1.3 * h, z + 0.05], { rot: [1.15, 0, 0] });
      lab.place(heart, i, [x, 1.31 * h, z + 0.09], { rot: [1.15, 0, 0] });
    }
    // светлячки над плетнём и во дворах
    st.flies = [...Array(26)].map(() => ({ x: lab.rand(-13, 13), y: lab.rand(0.4, 1.8), z: lab.rand(8.6, 15), ph: lab.rand(0, 6) }));
    const fg = new T.BufferGeometry(); fg.setAttribute('position', new T.Float32BufferAttribute(new Float32Array(st.flies.length * 3), 3));
    st.fliesPts = new T.Points(fg, new T.PointsMaterial({ color: '#fff27a', size: 0.22, transparent: true, blending: T.AdditiveBlending, depthWrite: false }));
    st.flies.forEach((f, i) => fg.attributes.position.setXYZ(i, f.x, f.y, f.z));
    st.fliesPts.frustumCulled = false; scene.add(st.fliesPts);
  },

  // ---------- станица за пушкой: ряд белёных хат под соломой, как в первой версии игры ----------
  // Всё неподвижное слито в один меш на материал. Окна — общий материал: при набате они мигают все разом.
  stanica(lab) {
    const T = lab.THREE, st = lab.state, Z = this.HUT_Z, parts = [];
    st.huts = [];
    [[-11.2, 0.12], [-6.8, -0.08], [-2.3, 0.05], [2.3, -0.05], [6.8, 0.1], [11.2, -0.12]].forEach(([x0, r], n) => {
      const x = x0 + lab.rand(-0.25, 0.25), z = Z + lab.rand(-0.3, 0.3), h = lab.group({ at: [x, 0, z], rot: Math.PI + r });
      lab.box(2.6, 1.6, 2, n % 2 ? '#aeb6cc' : '#bdbcc0', { parent: h, at: [0, 0.8, 0] }); // стены: белёные, в лунном свете холодные и тише неона
      lab.box(2.8, 0.18, 2.2, '#6a5442', { parent: h, at: [0, 0.09, 0] }); // призба
      lab.cone(2.25, 1.5, n % 3 ? '#76684a' : '#827250', { parent: h, at: [0, 2.35, 0], sides: 4, rot: Math.PI / 4, scale: [1.05, 1, 0.85] }); // солома при луне — тёмная
      lab.box(0.35, 0.8, 0.35, '#8a8090', { parent: h, at: [0.6, 2.7, 0.2] }); // труба
      lab.box(0.5, 1.0, 0.06, '#7a4a2a', { parent: h, at: [0.9, 0.62, -1.02] }); // дверь
      for (const wx of [-0.75, 0.15]) {
        lab.box(0.46, 0.46, 0.06, '#ffc65a', { parent: h, at: [wx, 0.98, -1.02], unlit: true, glow: 0.9 });
        lab.box(0.74, 0.54, 0.04, '#2c4f96', { parent: h, at: [wx, 0.98, -1.01] }); // ставни
      }
      parts.push(h);
      st.huts.push({ x, z, r, chimney: [x - 0.6 * Math.cos(r), 3.15, z - 0.2] });
    });
    // колодец посреди станицы: низкий сруб с двускатной крышей, пушку не закрывает
    const w = lab.group({ at: [0, 0, Z + 0.4] });
    lab.cyl(0.55, 0.6, 0.7, '#8a6a4a', { parent: w, at: [0, 0.35, 0], sides: 8 });
    lab.cyl(0.42, 0.42, 0.05, '#1c2a44', { parent: w, at: [0, 0.71, 0], sides: 8 });
    for (const sx of [-0.5, 0.5]) lab.box(0.1, 0.9, 0.1, '#5a3d2b', { parent: w, at: [sx, 1.1, 0] });
    lab.cone(0.75, 0.45, '#c9a24a', { parent: w, at: [0, 1.75, 0], sides: 4, rot: Math.PI / 4, scale: [1, 1, 0.7] });
    lab.box(0.22, 0.24, 0.22, '#6f7892', { parent: w, at: [0.2, 0.95, 0] }); // ведро
    parts.push(w);
    // вишни во дворах: пушистые кроны
    for (const [x, dz] of [[-9, 0.6], [-4.5, 0.9], [4.5, 0.7], [9, 0.5], [13.6, 0.3], [-13.6, 0.4]]) {
      const tr = lab.group({ at: [x + lab.rand(-0.3, 0.3), 0, Z + dz] });
      lab.cyl(0.1, 0.14, 1.1, '#5a3d2b', { parent: tr, at: [0, 0.55, 0], sides: 5 });
      lab.ball(0.85, '#2f6b3a', { parent: tr, at: [0, 1.6, 0], detail: 0 });
      lab.ball(0.55, '#3a7d45', { parent: tr, at: [0.45, 1.35, 0.25], detail: 0 });
      for (let k = 0; k < 4; k++) lab.ball(0.09, '#d8263a', { parent: tr, at: [lab.rand(-0.6, 0.6), lab.rand(1.2, 2), lab.rand(-0.4, 0.6)], detail: 0 });
      parts.push(tr);
    }
    // плетни дворов между хатами
    for (const x of [-9, -4.5, 0, 4.5, 9]) {
      const f = lab.group({ at: [x, 0, Z - 1.4] });
      for (let k = -1; k <= 1; k++) lab.box(0.08, 0.7, 0.08, '#7a5232', { parent: f, at: [k * 0.5, 0.35, 0] });
      lab.box(1.2, 0.08, 0.06, '#9a6b42', { parent: f, at: [0, 0.5, 0] });
      lab.box(1.2, 0.08, 0.06, '#9a6b42', { parent: f, at: [0, 0.25, 0] });
      if (x) parts.push(f); else f.removeFromParent();
    }
    lab.merge(parts);
    // тыквы и капуста у хат: низкое, ничего не закрывает
    const veg = lab.instances(new T.IcosahedronGeometry(0.3, 1), '#ffffff', 18);
    for (let i = 0; i < 18; i++) {
      const pumpkin = i % 3 === 0, x = lab.pick([-13.4, -9, -4.5, 4.5, 9, 13.4]) + lab.rand(-0.6, 0.6);
      lab.place(veg, i, [x, 0.2, Z - 1 + lab.rand(-0.3, 0.6)], { scale: pumpkin ? [1.3, 0.9, 1.3] : [1, 0.85, 1], rot: lab.rand(0, 6), color: pumpkin ? '#ff9a2e' : lab.pick(['#7fcf6a', '#9ad97c', '#6cbf5e']) });
    }
    // тёплые пятна света от окон на улице и фонарь у колодца: станицу видно уютной, и под набатом пятна краснеют вместе с окнами
    st.poolMat = new T.MeshBasicMaterial({ color: '#4a2e10', transparent: true, blending: T.AdditiveBlending, depthWrite: false });
    st.poolWarm = st.poolMat.color.clone(); st.poolRed = new T.Color('#5a1410');
    const pools = lab.instances(new T.CircleGeometry(1, 18).rotateX(-Math.PI / 2), st.poolMat, 14, { shadow: false });
    let k = 0;
    for (const h of st.huts) for (const wx of [-0.75, 0.15]) lab.place(pools, k++, [h.x - wx * Math.cos(h.r), 0.08, h.z - 1.9], { scale: [0.9, 1, 1.3] });
    const lx = 1.5, lz = Z - 1.1; // фонарь на столбе у колодца
    lab.place(pools, k++, [lx, 0.08, lz], { scale: 2.2 });
    lab.place(pools, k++, [0, 0.08, this.PLAYER_Z], { scale: 0 }); // запас
    lab.merge([lab.cyl(0.06, 0.08, 2.2, '#3a2c22', { at: [lx, 1.1, lz], sides: 6 }), lab.box(0.5, 0.06, 0.06, '#3a2c22', { at: [lx - 0.2, 2.15, lz] })]);
    lab.box(0.24, 0.3, 0.24, '#ffc65a', { at: [lx - 0.42, 1.95, lz], unlit: true, glow: 1.2, shadow: false });
    st.windows = lab.mat('#ffc65a', { unlit: true, glow: 0.9 });
    st.winWarm = st.windows.color.clone(); // тёплый свет окна вместе со свечением; набат мигает красным той же яркости
    st.winRed = new T.Color('#ff5a3d').multiplyScalar(st.winWarm.r / new T.Color('#ffc65a').r);
  },
  // станица живёт: дым из труб, набат и мигающие окна, когда строй у плетня
  lifeOfStanica(lab, dt) {
    const st = lab.state;
    if ((st.smokeT -= dt) <= 0) {
      st.smokeT = 0.3;
      const h = lab.pick(st.huts);
      lab.burst(h.chimney, { count: 1, colors: ['#3e3c4a', '#4c4958'], speed: 0.35, size: 0.42, life: 2.2, gravity: -0.9, up: 0.6 });
    }
    const w = st.windows;
    if (st.danger) {
      if ((st.bellT -= dt) <= 0) { st.bellT = 0.75; lab.tone(880, 0.35, 'sine', 0.07, 860); lab.tone(1320, 0.25, 'sine', 0.035, 1300); }
      const red = Math.sin(lab.t * 14) > 0;
      w.color.copy(red ? st.winRed : st.winWarm); st.poolMat.color.copy(red ? st.poolRed : st.poolWarm);
    } else { w.color.copy(st.winWarm); st.poolMat.color.copy(st.poolWarm); }
    // туман тянется над дальним краем поля, светлячки кружат над плетнём
    st.mist.forEach((m, i) => { m.position.x = Math.sin(lab.t * (0.05 + i * 0.02) + i * 2) * 5; });
    const a = st.fliesPts.geometry.attributes.position;
    st.flies.forEach((f, i) => a.setXYZ(i, f.x + Math.sin(lab.t * 0.7 + f.ph) * 0.8, f.y + Math.sin(lab.t * 1.3 + f.ph * 2) * 0.3, f.z + Math.cos(lab.t * 0.5 + f.ph) * 0.6));
    a.needsUpdate = true;
    st.fliesPts.material.opacity = 0.55 + 0.45 * Math.sin(lab.t * 3);
  },

  // ---------- пушка и казак-наводчик ----------
  cannon(lab) {
    const T = lab.THREE, g = lab.group({ at: [0, 0, this.PLAYER_Z], scale: 1.25 }); // пушка-герой крупнее жизни: видно краем глаза
    // тёплое пятно света под пушкой — её видно на любой части улицы
    lab.mesh(new T.CircleGeometry(1.5, 20).rotateX(-Math.PI / 2), new T.MeshBasicMaterial({ color: '#4a3414', transparent: true, blending: T.AdditiveBlending, depthWrite: false }), { parent: g, at: [0, 0.07, 0], shadow: false });
    lab.box(1.5, 0.42, 1.2, '#c0392b', { parent: g, at: [0, 0.55, 0], round: 0.08 });
    lab.box(1.62, 0.08, 1.3, '#7a1f17', { parent: g, at: [0, 0.78, 0] });
    const wheels = [];
    for (const x of [-0.86, 0.86]) {
      const w = lab.group({ parent: g, at: [x, 0.48, 0.05] });
      lab.cyl(0.48, 0.48, 0.14, '#5a3d2b', { parent: w, rot: [0, 0, Math.PI / 2], sides: 10 });
      lab.box(0.16, 0.86, 0.1, '#3a281c', { parent: w });
      lab.box(0.16, 0.1, 0.86, '#3a281c', { parent: w });
      lab.cyl(0.12, 0.12, 0.2, '#d9a441', { parent: w, rot: [0, 0, Math.PI / 2], metal: 0.6, shiny: true });
      wheels.push(w);
    }
    // стволы — латунные, смотрят вдаль (−Z) и чуть вверх. Сколько их видно — столько ядер в залпе: ступень ствола видна на самой пушке
    const barrel = lab.group({ parent: g, at: [0, 0.95, -0.1], rot: [0.12, 0, 0] }), tubes = [], muzzles = [];
    for (const x of [-0.34, 0, 0.34]) {
      const tube = lab.group({ parent: barrel, at: [x, 0, 0] }), r = x ? 0.8 : 1;
      lab.cyl(0.17 * r, 0.22 * r, 1.4, '#d9a441', { parent: tube, at: [0, 0, -0.55], rot: [-Math.PI / 2, 0, 0], sides: 10, metal: 0.7, shiny: true });
      muzzles.push(lab.cyl(0.24 * r, 0.24 * r, 0.16, '#a87a2c', { parent: tube, at: [0, 0, -1.2], rot: [-Math.PI / 2, 0, 0], sides: 10, metal: 0.7, shiny: true }));
      tubes.push(tube);
    }
    const drum = lab.box(0.9, 0.22, 0.5, '#7a1f17', { parent: barrel, at: [0, 0.2, -0.2], round: 0.05 }); // короб с ядрами — у «Очереди»
    lab.box(0.92, 0.06, 0.52, '#d9a441', { parent: drum, at: [0, 0.1, 0], metal: 0.6, shiny: true });
    const charge = lab.ball(0.2, '#ffb347', { parent: barrel, at: [0, 0, -1.36], glow: 1.4, shadow: false });
    // казак-наводчик в черкеске и папахе, повернулся к нам
    const gun = lab.group({ parent: g, at: [1.25, 0, 0.35] }), body = lab.group({ parent: gun, rot: 0.55 });
    lab.box(0.5, 0.75, 0.34, '#22324f', { parent: body, at: [0, 0.75, 0], round: 0.05 });
    for (const s of [-1, 1]) for (let k = 0; k < 3; k++) lab.box(0.05, 0.05, 0.02, '#e8e2d0', { parent: body, at: [s * 0.14, 0.92 - k * 0.09, 0.18] }); // газыри
    lab.box(0.12, 0.42, 0.14, '#1a1a22', { parent: body, at: [-0.12, 0.2, 0] });
    lab.box(0.12, 0.42, 0.14, '#1a1a22', { parent: body, at: [0.12, 0.2, 0] });
    lab.ball(0.22, '#f0c8a0', { parent: body, at: [0, 1.32, 0] });
    lab.cyl(0.24, 0.22, 0.28, '#151515', { parent: body, at: [0, 1.56, 0], sides: 9 }); // папаха
    for (const s of [-1, 1]) lab.ball(0.04, '#111111', { parent: body, at: [s * 0.08, 1.36, 0.2], detail: 0, shiny: true });
    lab.box(0.22, 0.05, 0.04, '#3a2414', { parent: body, at: [0, 1.25, 0.21] }); // усы
    lab.hero(g);
    lab.state.gun = { g, barrel, tubes, muzzles, drum, charge, wheels, gunner: gun, body, vx: 0 };
  },

  // ---------- НЛО: три силуэта по рядам, у каждого силуэта — пачка копий на все НЛО сразу ----------
  // Ближние ряды — плоская «сковородка» на ножках, средние — тарелка с куполом, дальние — высокий «колокол» с антенной.
  // Корпус — матовый тёмный металл, светится только узкий неоновый обод цвета ряда и лампы: строй читается рисунком, а не облаком свечения.
  SHAPE_OF: [0, 0, 1, 1, 2, 2], // силуэт по номеру ряда
  saucerParts(lab) {
    const T = lab.THREE, st = lab.state, n = this.POOL, BGU = lab.addons.BufferGeometryUtils;
    const tint = (g, hex) => { g = g.toNonIndexed(); g.deleteAttribute('uv'); const c = new T.Color(hex), a = new Float32Array(g.attributes.position.count * 3); for (let i = 0; i < a.length; i += 3) { a[i] = c.r; a[i + 1] = c.g; a[i + 2] = c.b; } g.setAttribute('color', new T.BufferAttribute(a, 3)); return g; };
    const plain = g => { g = g.toNonIndexed(); g.deleteAttribute('uv'); return g; };
    const ring = (k, r, y, size) => [...Array(k)].map((_, i) => { const a = i / k * Math.PI * 2; return plain(new T.BoxGeometry(size, size * 0.8, size).translate(Math.cos(a) * r, y, Math.sin(a) * r)); });
    const half = (r, y, sy) => new T.SphereGeometry(r, 12, 6, 0, Math.PI * 2, 0, Math.PI / 2).scale(1, sy, 1).translate(0, y, 0);
    const legs = [0, 1, 2].map(i => { const a = i / 3 * Math.PI * 2 + 0.5; return tint(new T.BoxGeometry(0.07, 0.36, 0.07).translate(Math.cos(a) * 0.5, -0.3, Math.sin(a) * 0.5), '#232637'); });
    const shapes = [
      { // «сковородка»: широкая и плоская, на трёх ножках
        hull: [tint(new T.CylinderGeometry(0.62, 0.86, 0.16, 14), '#3d4258'), tint(new T.ConeGeometry(0.62, 0.2, 14).rotateX(Math.PI).translate(0, -0.18, 0), '#2a2e40'), ...legs],
        neon: [plain(new T.CylinderGeometry(0.9, 0.9, 0.07, 18).translate(0, -0.04, 0))],
        dome: half(0.32, 0.07, 0.6),
      },
      { // классическая тарелка с куполом и лампами по нижнему кольцу
        hull: [tint(new T.CylinderGeometry(0.55, 0.82, 0.3, 14), '#4a5068'), tint(new T.CylinderGeometry(0.5, 0.3, 0.16, 12).translate(0, -0.23, 0), '#2e3246')],
        neon: [plain(new T.CylinderGeometry(0.88, 0.88, 0.07, 18).translate(0, -0.1, 0)), ...ring(6, 0.42, -0.31, 0.11)],
        dome: half(0.42, 0.12, 1),
      },
      { // высокий «колокол» с антенной
        hull: [tint(new T.CylinderGeometry(0.3, 0.7, 0.66, 12).translate(0, 0.14, 0), '#4a4460'), tint(new T.CylinderGeometry(0.78, 0.7, 0.12, 14).translate(0, -0.2, 0), '#2e2a40'), tint(new T.CylinderGeometry(0.025, 0.025, 0.5, 4).translate(0, 0.72, 0), '#8a8aa0')],
        neon: [plain(new T.CylinderGeometry(0.84, 0.84, 0.06, 18).translate(0, -0.14, 0)), plain(new T.CylinderGeometry(0.52, 0.58, 0.06, 14).translate(0, 0.12, 0)), plain(new T.IcosahedronGeometry(0.09, 0).translate(0, 0.98, 0))],
        dome: half(0.27, 0.46, 0.9),
      },
    ];
    const mk = (geo, m, shadow) => { const im = lab.instances(geo, m, n); im.frustumCulled = false; if (!shadow) lab.noShadow(im); im.setColorAt(0, st.tmp.c.set('#ffffff')); for (let i = 1; i < n; i++) im.setColorAt(i, st.tmp.c); for (let i = 0; i < n; i++) im.setMatrixAt(i, st.tmp.zero); return im; };
    const hullMat = new T.MeshStandardMaterial({ vertexColors: true, flatShading: true, roughness: 0.55, metalness: 0.45 });
    st.shapes = shapes.map(sh => ({
      hull: mk(BGU.mergeGeometries(sh.hull), hullMat, true),
      neon: mk(BGU.mergeGeometries(sh.neon), lab.mat('#ffffff', { unlit: true, glow: 0.7 }), false),
      dome: mk(sh.dome, lab.mat('#ffffff', { shiny: true }), true),
    }));
    const armor = BGU.mergeGeometries([new T.CylinderGeometry(0.3, 0.52, 0.34, 8).translate(0, 0.32, 0), ...[0, 1, 2, 3].map(i => new T.ConeGeometry(0.08, 0.3, 4).translate(Math.cos(i * Math.PI / 2) * 0.32, 0.5, Math.sin(i * Math.PI / 2) * 0.32))].map(g => g.toNonIndexed()));
    st.parts = {
      beam: mk(new T.ConeGeometry(0.8, 1.35, 14, 1, true).translate(0, -0.78, 0), lab.mat('#ffffff', { unlit: true, add: true, side: 'double' }), false),
      armor: mk(armor, lab.mat('#dfe4f2', { metal: 0.6, shiny: true }), false), // броня броненосца: шлем с шипами
      pool: mk(new T.CircleGeometry(1, 16).rotateX(-Math.PI / 2), new T.MeshBasicMaterial({ color: '#ffffff', transparent: true, blending: T.AdditiveBlending, depthWrite: false }), false), // пятно света на траве
    };
    st.geo.armor = armor;
  },
  // каждый кадр: место, поворот, сжатие и цвета всех копий
  drawSaucers(lab, dt) {
    const st = lab.state, P = st.parts, t = st.tmp, S = st.shapes;
    for (let i = 0; i < this.POOL; i++) {
      const s = st.slots[i];
      const shape = s ? this.SHAPE_OF[s.row % this.SHAPE_OF.length] : -1;
      for (let k = 0; k < S.length; k++) if (k !== shape || !s || s.hidden) { S[k].hull.setMatrixAt(i, t.zero); S[k].neon.setMatrixAt(i, t.zero); S[k].dome.setMatrixAt(i, t.zero); }
      if (!s || s.hidden) { for (const k in P) P[k].setMatrixAt(i, t.zero); continue; }
      const H = S[shape];
      s.flash = Math.max(0, s.flash - dt); s.squash = lab.damp(s.squash, 1, 12, dt);
      const sc = s.scale;
      t.p.set(s.x, s.y, s.z); t.q.setFromEuler(t.e.set(s.rx, s.ry, s.rz)); t.s.set(sc * (2 - s.squash), sc * s.squash, sc * (2 - s.squash));
      t.m.compose(t.p, t.q, t.s);
      H.hull.setMatrixAt(i, t.m); H.neon.setMatrixAt(i, t.m); H.dome.setMatrixAt(i, t.m);
      P.armor.setMatrixAt(i, s.armor && !s.wreck ? t.m : t.zero);
      // луч под тарелкой: тусклый, пока НЛО спокойно; краснеет и разгорается перед выстрелом; у похитителя — длинный зелёный до земли
      const ab = s.abduct, pull = ab && (ab.phase === 'beam') ? 1 : 0;
      const beam = s.wreck ? 0 : pull ? 1.5 : s.charging ? 1.3 : s.diveWarn || ab ? 1.1 : 0.55;
      t.q.identity(); t.s.set(sc * beam, sc * (s.wreck ? 0 : pull ? s.y / 1.5 : 1), sc * beam);
      t.m.compose(t.p, t.q, t.s); P.beam.setMatrixAt(i, t.m);
      // пятно света на траве под тарелкой: растёт, когда НЛО снижается — пике видно по земле
      const low = lab.clamp(1 - (s.y - 0.9) / 4, 0, 1), pr = s.wreck || s.y > 5 ? 0 : sc * (0.55 + 0.9 * low) * (pull ? 1.3 : 1);
      t.p.set(s.x, 0.09, s.z); t.s.set(pr, 1, pr); t.m.compose(t.p, t.q, t.s); P.pool.setMatrixAt(i, t.m);
      const R = this.ROWS[s.row % this.ROWS.length].color, f = s.flash > 0 ? 3 : 1;
      H.hull.setColorAt(i, t.c.set(s.wreck ? '#7a5a48' : '#ffffff').multiplyScalar(f));
      H.dome.setColorAt(i, t.c.set(s.wreck ? '#3a3036' : ab ? this.BEAM : R).multiplyScalar(0.8 * f));
      P.armor.setColorAt(i, t.c.set('#ffffff').multiplyScalar(f));
      const warnBlink = s.charging || s.diveWarn || (ab && ab.phase === 'warn');
      const blink = warnBlink ? (Math.sin(lab.t * 40) > 0 ? 1.6 : 0.4) : 1;
      H.neon.setColorAt(i, t.c.set(s.wreck ? '#ff6a2a' : ab ? this.BEAM : s.charging || s.diveWarn ? '#ff4d5e' : R).multiplyScalar(blink * (s.wreck ? 0.6 : 1)));
      P.beam.setColorAt(i, pull ? t.c.set(this.BEAM).multiplyScalar(0.35 + 0.15 * Math.sin(lab.t * 18)) : s.charging ? t.c.set('#ff2f45').multiplyScalar(0.5 + 0.3 * Math.sin(lab.t * 30)) : s.diveWarn ? t.c.set('#ff8a3d').multiplyScalar(0.45) : ab ? t.c.set(this.BEAM).multiplyScalar(0.2) : t.c.set(R).multiplyScalar(0.09));
      P.pool.setColorAt(i, t.c.set(pull ? this.BEAM : s.charging ? '#ff2f45' : s.dive ? '#ff8a3d' : R).multiplyScalar(pull ? 0.35 : s.dive || s.charging ? 0.3 : 0.06));
    }
    for (const k in P) { P[k].instanceMatrix.needsUpdate = true; P[k].instanceColor.needsUpdate = true; }
    for (const H of S) for (const k in H) { H[k].instanceMatrix.needsUpdate = true; H[k].instanceColor.needsUpdate = true; }
  },

  // ---------- стога-укрытия из блоков сена: одна пачка копий ----------
  buildShields(lab) {
    const T = lab.THREE, st = lab.state, n = Math.round(lab.cfg.shields);
    if (!st.hay) { st.hay = lab.instances(new T.BoxGeometry(0.58, 0.58, 0.58), '#d9b44a', 5 * 26); st.hay.frustumCulled = false; }
    for (let i = 0; i < st.hay.count; i++) st.hay.setMatrixAt(i, st.tmp.zero);
    st.hay.instanceMatrix.needsUpdate = true;
    st.cells = []; let k = 0;
    for (let s = 0; s < n; s++) {
      const cx = n === 1 ? 0 : -9 + 18 * s / (n - 1);
      for (let i = -2; i <= 2; i++) for (const dz of [-0.3, 0.3]) {
        const cell = { x: cx + i * 0.6, z: this.SHIELD_Z + dz, blocks: [] };
        for (let h = 0; h < (Math.abs(i) === 2 ? 2 : 3); h++) {
          lab.place(st.hay, k, [cell.x, 0.3 + h * 0.58, cell.z], { rot: lab.rand(-0.1, 0.1), color: lab.pick(['#ffffff', '#f0e2b8', '#e2cf96', '#fff4cf']) });
          cell.blocks.push({ i: k++, y: 0.3 + h * 0.58 });
        }
        st.cells.push(cell);
      }
    }
  },
  underShield(lab, x) { return lab.state.cells.some(c => c.blocks.length && Math.abs(c.x - x) < 0.45); },
  hitShield(lab, x, z, r = 0.35) {
    const st = lab.state;
    for (const cell of st.cells) {
      if (cell.blocks.length && Math.abs(cell.x - x) < r && Math.abs(cell.z - z) < 0.35) {
        const b = cell.blocks.pop();
        lab.burst([cell.x, b.y, cell.z], { count: 9, colors: ['#d9b44a', '#f1d27a', '#a87d2c'], speed: 4, size: 0.18 });
        st.hay.setMatrixAt(b.i, st.tmp.zero); st.hay.instanceMatrix.needsUpdate = true;
        lab.noise(0.08, 0.06, 2200);
        return true;
      }
    }
    return false;
  },

  // ---------- волна НЛО: форма строя меняется от волны к волне ----------
  buildWave(lab) {
    const st = lab.state, cfg = lab.cfg;
    st.saucers.forEach(s => { if (!s.wreck) st.slots[s.slot] = null; }); // сбитые ещё падают: их место освободит moveWrecks
    const rows = Math.min(6, Math.round(cfg.rows) + st.wave - 1), cols = Math.round(cfg.cols);
    const front = -4 + Math.min(st.wave - 1, 4) * 0.9, shape = this.SHAPES[(st.wave - 1) % this.SHAPES.length];
    const armored = cfg.armorFrom > 0 && st.wave >= cfg.armorFrom ? (st.wave >= cfg.armorFrom + 2 ? 2 : 1) : 0; // сколько задних рядов в броне
    st.saucers = []; st.ox = 0; st.oz = 0; st.dir = 1; st.stepT = 0.6;
    for (let r = 0; r < rows; r++) for (let c = 0; c < cols; c++) {
      const slot = st.slots.indexOf(null);
      if (slot < 0) break;
      const mid = (cols - 1) / 2;
      let bx = (c - mid) * 2.3, bz = front - r * 2.1;
      if (shape === 'клин') bz -= Math.abs(c - mid) * 1.0; // остриём к станице
      if (shape === 'две стаи') bx += Math.sign(c - mid) * 1.3; // проход посередине
      if (shape === 'шахматы' && r % 2) bx += 1.15;
      const armor = r >= rows - armored;
      // новая волна влетает сверху: каждая тарелка опускается на своё место по очереди
      const s = { slot, bx, bz, row: r, col: c, alive: true, x: bx, y: 9 + r * 0.6, z: bz - 6, rx: 0, ry: lab.rand(0, 6), rz: 0, scale: armor ? 1.4 : 1.3, squash: 1, flash: 0, phase: lab.rand(0, 6.28), points: this.ROWS[r].points * (armor ? 2 : 1), armor, arrive: 0.5 + (r * cols + c) * 0.025 };
      st.slots[slot] = s; st.saucers.push(s);
    }
    st.total = st.saucers.length; st.alive = st.total; st.lastWarned = false; st.hurtInWave = false;
    if (st.wave > 1) lab.after(1.2, () => { if (!st.bonus) lab.popup(lab.v3(0, 3.5, -6), shape === 'ряды' ? 'Строй рядами' : shape === 'клин' ? 'Строй клином!' : shape === 'две стаи' ? 'Две стаи!' : 'Строй шахматами', '#a98bff', 22); });
    if (armored && st.wave === cfg.armorFrom) lab.after(2, () => lab.popup(lab.v3(0, 4, -10), 'Броненосцы: бей дважды!', '#c9cfdc', 22));
  },
  formation(s, st) { return [s.bx + st.ox, s.bz + st.oz]; },
  moveWave(lab, dt) {
    const st = lab.state, cfg = lab.cfg;
    // СПРЯТАННАЯ МЕХАНИКА: чем меньше НЛО в волне, тем чаще шаг. При speedup = 1 последнее НЛО шагает в total раз чаще всей волны
    const frac = Math.max(st.alive, 1) / st.total;
    const interval = Math.max(0.045, cfg.baseStep * st.waveMul * ((1 - cfg.speedup) + cfg.speedup * frac));
    st.stepT -= dt;
    while (st.stepT <= 0) {
      st.stepT += interval;
      let minX = 1e9, maxX = -1e9;
      for (const s of st.saucers) if (s.alive) { minX = Math.min(minX, s.bx + st.ox); maxX = Math.max(maxX, s.bx + st.ox); }
      const step = 0.5;
      if ((st.dir > 0 && maxX + step > this.EDGE) || (st.dir < 0 && minX - step < -this.EDGE)) { st.oz += cfg.stepDown; st.dir = -st.dir; }
      else st.ox += st.dir * step;
      lab.tone([98, 87, 82, 73][st.note++ % 4], 0.11, 'triangle', 0.24); // марш-сердцебиение из четырёх нот, как в 1978-м
      for (const s of st.saucers) if (s.alive) s.squash = 0.82; // строй «приседает» на каждом шаге
    }
    let maxZ = -1e9;
    for (const s of st.saucers) {
      if (!s.alive || s.dive || s.abduct) continue;
      const [fx, fz] = this.formation(s, st);
      if (s.arrive > 0) s.arrive -= dt;
      const k = s.arrive > 0 ? 1 - Math.exp(-dt * 2) : 1 - Math.exp(-dt * 22);
      s.x = lab.lerp(s.x, fx, k); s.z = lab.lerp(s.z, fz, k);
      s.y = lab.lerp(s.y, 1.45 + Math.sin(lab.t * 3 + s.phase) * 0.12, s.arrive > 0 ? 1 - Math.exp(-dt * 3) : 1 - Math.exp(-dt * 10));
      s.ry += dt * (1.6 + 6 * (1 - frac) * cfg.speedup); // чем меньше НЛО, тем бешенее крутятся
      s.rx = Math.sin(lab.t * 2 + s.phase) * 0.06; s.rz = st.dir * -0.08;
      maxZ = Math.max(maxZ, fz);
      if (Math.abs(s.z - this.SHIELD_Z) < 0.8) this.hitShield(lab, s.x, s.z, 1.0); // НЛО сносит стог, через который летит
    }
    st.closest = Math.min(st.closest, this.LINE_Z - maxZ);
    // набат: строй в трёх шагах от плетня — окна хат мигают, звонит колокол. «Видно = правда»: вот-вот проигрыш
    const wasDanger = st.danger;
    st.danger = this.LINE_Z - maxZ < 3.2;
    if (st.danger && !wasDanger) { lab.popup(lab.v3(0, 3, this.LINE_Z - 1), 'Станица в опасности!', '#ff5a3d', 24); lab.count('набат'); }
    if (maxZ >= this.LINE_Z) {
      lab.shake(1); lab.flash('#ff4d5e', 0.5); lab.sfx.explode();
      lab.lives = 0; lab.gameOver('НЛО сели на станицу');
    }
  },
  // свободные для пике и похищения: в строю, долетели, не заряжают выстрел
  free(st) { return st.saucers.filter(s => s.alive && !s.dive && !s.abduct && s.arrive <= 0 && !st.charges.some(ch => ch.s === s)); },

  // ---------- пике по мотивам Galaga: НЛО срывается из строя и летит дугой на пушку ----------
  // «Видно = правда»: перед пике тарелка трясётся и мигает, а на земле горит круг — туда, где пушка была в этот миг.
  // С волны escortFrom флагман летит со звеном (Galaxian): двое ведомых по бокам, собьёшь всех троих в пике — +300.
  dive(lab, dt) {
    const st = lab.state, cfg = lab.cfg, c = st.gun.g.position;
    if (cfg.diveEvery > 0 && (st.diveT -= dt) <= 0) {
      st.diveT = cfg.diveEvery * st.waveMul * lab.rand(0.8, 1.2);
      const free = this.free(st);
      if (free.length > 2) {
        const s = lab.chance(0.4) ? free.reduce((a, b) => (Math.abs(b.x - c.x) < Math.abs(a.x - c.x) ? b : a)) : lab.pick(free);
        const tx = lab.clamp(c.x, -this.EDGE, this.EDGE), group = [s];
        if (cfg.escortFrom > 0 && st.wave >= cfg.escortFrom && lab.chance(0.6)) {
          const near = free.filter(o => o !== s && Math.abs(o.bz - s.bz) < 2.5 && Math.abs(o.bx - s.bx) < 5).sort((a, b) => Math.abs(a.bx - s.bx) - Math.abs(b.bx - s.bx));
          group.push(...near.slice(0, 2));
        }
        const flight = group.length > 1 ? { n: group.length, killed: 0 } : null;
        group.forEach((d, i) => {
          const off = i === 0 ? 0 : (i === 1 ? -1 : 1) * 2.1, warnT = 0.7, gx = lab.clamp(tx + off, -this.EDGE, this.EDGE);
          d.dive = { phase: 'warn', t: warnT, tx: gx, side: s.x > tx ? 1 : -1, flight, warn: lab.warn([gx, 0, this.PLAYER_Z], 1.25, warnT + cfg.diveTime, '#ff8a3d') };
          d.diveWarn = true;
        });
        st.dives++; lab.count('пике');
        if (flight) { st.flights++; lab.count('звенья'); lab.popup([s.x, s.y + 1.4, s.z], 'Звено!', '#ff8a3d', 22); }
        lab.tone(700, 0.5, 'sawtooth', 0.05, 1400);
      }
    }
    for (const s of st.saucers) {
      const d = s.dive;
      if (!d || !s.alive) continue;
      if (d.phase === 'warn') { // трясётся в строю
        const [fx, fz] = this.formation(s, st);
        s.x = fx + Math.sin(lab.t * 60) * 0.12; s.z = fz; s.ry += dt * 12;
        if ((d.t -= dt) <= 0) { d.phase = 'dive'; d.t = 0; d.p0 = [s.x, s.y, s.z]; s.diveWarn = false; lab.sfx.whoosh(); }
        continue;
      }
      if (d.phase === 'dive') { // дуга в сторону и с разгоном — ровно в центр круга на ряду пушки, и дальше за станицу
        d.t += dt / cfg.diveTime;
        const q = d.t, p0 = d.p0, PZ = this.PLAYER_Z, qq = Math.min(1, q);
        const nx = lab.lerp(p0[0], d.tx, qq) + d.side * 3.5 * Math.sin(Math.PI * qq);
        const nz = q <= 1 ? p0[2] + (PZ - p0[2]) * (0.4 * q + 0.6 * q * q) : PZ + (PZ - p0[2]) * 1.6 * (q - 1);
        s.rz = lab.clamp((nx - s.x) * -1.5, -0.8, 0.8); s.rx = 0.5; s.ry += dt * 9;
        s.x = nx; s.y = q <= 1 ? lab.lerp(p0[1], 0.95, Math.min(1, q * 1.2)) : 0.95 + (q - 1) * 14; s.z = nz; // за пушкой взмывает над крышами
        lab.burst([s.x, s.y + 0.1, s.z], { count: 1, colors: ['#ff8a3d', '#ffd23f'], speed: 1, size: 0.18, life: 0.3, gravity: 0 });
        if (Math.abs(s.x - c.x) < 1.2 && Math.abs(s.z - c.z) < 0.9 && s.y < 1.8) { // таран: пушку подбили, тарелка разбилась сама
          lab.count('попадания по пушке'); st.combo = 0;
          if (lab.hurt([c.x, 0.8, c.z], 'НЛО протаранило пушку')) { st.hurtInWave = true; this.loseLevel(lab); }
          this.killSaucer(lab, s, { noScore: true });
          continue;
        }
        if (q >= 1.3) { d.phase = 'back'; d.t = 0; d.from = [s.x, 7, -24]; s.x = d.from[0]; s.y = d.from[1]; s.z = d.from[2]; }
        continue;
      }
      // ушла за станицу — возвращается в строй сверху, как в Galaga
      d.t += dt / 1.4;
      const [fx, fz] = this.formation(s, st), k = lab.ease.inOutCubic(Math.min(1, d.t));
      s.x = lab.lerp(d.from[0], fx, k); s.y = lab.lerp(d.from[1], 1.45, k); s.z = lab.lerp(d.from[2], fz, k); s.rx = 0; s.rz = 0;
      if (d.t >= 1) s.dive = null;
    }
  },

  // ---------- бурёнки на выгоне: одна пачка копий, корова собрана из цветных коробок в одну деталь ----------
  herd(lab) {
    const T = lab.THREE, st = lab.state, n = Math.round(lab.cfg.cows), BGU = lab.addons.BufferGeometryUtils, parts = [];
    const add = (w, h, d, x, y, z, hex) => {
      const g = new T.BoxGeometry(w, h, d).toNonIndexed().translate(x, y, z); g.deleteAttribute('uv');
      const col = new T.Color(hex), a = new Float32Array(g.attributes.position.count * 3);
      for (let i = 0; i < a.length; i += 3) { a[i] = col.r; a[i + 1] = col.g; a[i + 2] = col.b; }
      g.setAttribute('color', new T.BufferAttribute(a, 3)); parts.push(g);
    };
    add(0.62, 0.5, 1.05, 0, 0.66, 0, '#f6f2ea'); // туловище
    add(0.64, 0.34, 0.36, 0, 0.72, 0.18, '#1d1b22'); add(0.64, 0.3, 0.28, 0, 0.62, -0.3, '#1d1b22'); // пятна
    add(0.4, 0.38, 0.42, 0, 0.88, 0.66, '#f6f2ea'); // голова
    add(0.32, 0.2, 0.14, 0, 0.78, 0.9, '#f2a6b4'); // нос
    add(0.08, 0.16, 0.08, -0.15, 1.12, 0.62, '#efe2b8'); add(0.08, 0.16, 0.08, 0.15, 1.12, 0.62, '#efe2b8'); // рожки
    add(0.14, 0.06, 0.1, -0.26, 0.98, 0.6, '#1d1b22'); add(0.14, 0.06, 0.1, 0.26, 0.98, 0.6, '#1d1b22'); // уши
    add(0.06, 0.06, 0.03, -0.11, 0.96, 0.87, '#111111'); add(0.06, 0.06, 0.03, 0.11, 0.96, 0.87, '#111111'); // глаза
    for (const [x, z] of [[-0.2, 0.36], [0.2, 0.36], [-0.2, -0.36], [0.2, -0.36]]) add(0.14, 0.44, 0.14, x, 0.22, z, '#3a3036'); // ноги
    add(0.22, 0.12, 0.2, 0, 0.38, -0.14, '#f2a6b4'); // вымя
    add(0.05, 0.42, 0.05, 0, 0.6, -0.55, '#1d1b22'); // хвост
    add(0.14, 0.14, 0.1, 0, 0.6, 0.86, '#ffd23f'); // колокольчик
    st.cowMesh = lab.instances(BGU.mergeGeometries(parts), new T.MeshStandardMaterial({ vertexColors: true, flatShading: true, roughness: 0.85 }), Math.max(1, n));
    st.cowMesh.frustumCulled = false;
    st.cows = [];
    for (let i = 0; i < n; i++) {
      const hx = -9 + 18 * (i + 0.5) / n + lab.rand(-1, 1), hz = lab.rand(3.6, 5.4);
      st.cows.push({ i, x: hx, z: hz, y: 0, hx, hz, tx: hx, tz: hz, ry: lab.rand(0, 6), rx: 0, rz: 0, state: 'graze', wait: lab.rand(0, 2), vy: 0, moo: 0 });
    }
  },
  moveCows(lab, dt) {
    const st = lab.state, t = st.tmp;
    let front = -1e9; // самое близкое к станице НЛО строя: бурёнки от него пятятся к плетню
    if (!st.bonus) for (const s of st.saucers) if (s.alive && !s.dive && !s.abduct) front = Math.max(front, s.bz + st.oz);
    for (const w of st.cows) {
      if (w.state === 'gone') { st.cowMesh.setMatrixAt(w.i, t.zero); continue; }
      if (w.state === 'graze') { // бродит по выгону, жуёт, иногда переходит на новое место
        const safeZ = Math.max(w.hz, Math.min(8.5, front + 2.2));
        if ((w.wait -= dt) <= 0) { w.wait = lab.rand(1.5, 4); w.tx = lab.clamp(w.hx + lab.rand(-2, 2), -11, 11); w.tz = lab.clamp(w.hz + lab.rand(-0.8, 0.8), 3, 8.5); }
        const tz = Math.max(w.tz, safeZ), dx = w.tx - w.x, dz = tz - w.z, d = Math.hypot(dx, dz);
        if (d > 0.1) {
          const v = Math.min(d, (tz > w.tz + 0.5 ? 2.2 : 0.8) * dt);
          w.x += dx / d * v; w.z += dz / d * v;
          w.ry = lab.damp(w.ry, Math.atan2(dx, dz), 6, dt); w.y = Math.abs(Math.sin(lab.t * 9 + w.i)) * 0.05; w.rx = 0;
        } else { w.y = 0; w.rx = lab.damp(w.rx, 0.22, 3, dt); } // наклонилась к траве
        w.rz = 0;
      } else if (w.state === 'lift') { // в луче: висит, болтает ногами, медленно кружится
        w.ry += dt * 1.5; w.rz = Math.sin(lab.t * 10) * 0.25; w.rx = Math.sin(lab.t * 7) * 0.15;
      } else if (w.state === 'fall') { // спасена: падает, плюхается, мычит и идёт пастись
        w.vy -= 16 * dt; w.y += w.vy * dt; w.rz = lab.damp(w.rz, 0, 8, dt); w.rx = lab.damp(w.rx, 0, 8, dt);
        if (w.y <= 0) {
          w.y = 0; w.state = 'graze'; w.wait = 0.8;
          lab.burst([w.x, 0.2, w.z], { count: 12, colors: ['#d9b44a', '#7cf5a8', '#ffffff'], speed: 3, up: 2 });
          lab.ring([w.x, 0.05, w.z], { color: '#ffffff', radius: 1.4 }); lab.shake(0.08);
          this.moo(lab, 1);
        }
      }
      t.p.set(w.x, w.y, w.z); t.q.setFromEuler(t.e.set(w.rx, w.ry, w.rz)); t.s.set(1.3, 1.3, 1.3); // бурёнка крупнее жизни: видно издалека
      st.cowMesh.setMatrixAt(w.i, t.m.compose(t.p, t.q, t.s));
    }
    st.cowMesh.instanceMatrix.needsUpdate = true;
  },
  moo(lab, k = 1) { lab.tone(150 * k, 0.45, 'sawtooth', 0.05, 105 * k); lab.tone(152 * k, 0.45, 'square', 0.02, 108 * k, 0.02); },

  // ---------- похититель по мотивам Defender и луча Galaga: НЛО тянет бурёнку с выгона ----------
  // «Видно = правда»: похититель позеленел и трясётся, на земле под бурёнкой горит зелёный круг; в луче бурёнка плывёт вверх.
  // Сбил похитителя, пока луч тянет, — бурёнка падает обратно, +300. Не успел — НЛО уносит её в небо навсегда.
  abduct(lab, dt) {
    const st = lab.state, cfg = lab.cfg;
    if (cfg.abductEvery > 0 && (st.abductT -= dt) <= 0) {
      st.abductT = cfg.abductEvery * Math.max(0.6, st.waveMul) * lab.rand(0.85, 1.15);
      const cows = st.cows.filter(w => w.state === 'graze'), free = this.free(st);
      if (cows.length && free.length > 3) {
        const w = lab.pick(cows), s = free.reduce((a, b) => (Math.abs(b.x - w.x) + Math.abs(b.z - w.z) < Math.abs(a.x - w.x) + Math.abs(a.z - w.z) ? b : a));
        w.state = 'wait';
        s.abduct = { phase: 'warn', t: 0.7, cow: w, warn: lab.warn([w.x, 0, w.z], 1.1, 0.7 + 1.1, this.BEAM) };
        st.abducts++; lab.count('похищения');
        lab.popup([s.x, s.y + 1.3, s.z], 'Похититель!', this.BEAM, 22);
        lab.tone(400, 0.6, 'sine', 0.06, 900); lab.tone(600, 0.6, 'sine', 0.04, 1300, 0.1);
      }
    }
    for (const s of st.saucers) {
      const a = s.abduct;
      if (!a || !s.alive) continue;
      const w = a.cow;
      if (a.phase === 'warn') {
        const [fx, fz] = this.formation(s, st);
        s.x = fx + Math.sin(lab.t * 55) * 0.1; s.z = fz; s.ry += dt * 10;
        if ((a.t -= dt) <= 0) { a.phase = 'fly'; a.t = 0; a.p0 = [s.x, s.y, s.z]; lab.sfx.whoosh(); }
      } else if (a.phase === 'fly') { // дугой к бурёнке, зависает низко над ней
        a.t += dt / 1.1;
        const k = lab.ease.inOutCubic(Math.min(1, a.t));
        s.x = lab.lerp(a.p0[0], w.x, k); s.z = lab.lerp(a.p0[2], w.z, k); s.y = lab.lerp(a.p0[1], 2.4, k) + Math.sin(Math.PI * k) * 1.4;
        s.rx = 0.25 * Math.sin(Math.PI * k); s.ry += dt * 6;
        if (a.t >= 1) { a.phase = 'beam'; a.t = 0; w.state = 'lift'; this.moo(lab, 1.2); lab.tone(220, cfg.abductTime, 'sine', 0.035, 520); }
      } else if (a.phase === 'beam') { // луч тянет: бурёнка поднимается к тарелке
        a.t += dt;
        const k = Math.min(1, a.t / cfg.abductTime);
        s.x = w.x + Math.sin(lab.t * 2) * 0.15; s.z = w.z; s.y = 2.4 + Math.sin(lab.t * 4) * 0.08; s.rx = 0; s.rz = Math.sin(lab.t * 3) * 0.08; s.ry += dt * 4;
        w.y = lab.ease.inQuad(k) * 0.8;
        if (lab.chance(dt * 10)) lab.burst([w.x + lab.rand(-0.6, 0.6), w.y + lab.rand(0, 1.2), w.z + lab.rand(-0.6, 0.6)], { count: 1, colors: [this.BEAM, '#ffffff'], speed: 0.6, size: 0.15, life: 0.5, gravity: -2 });
        if ((a.ring = (a.ring || 0) - dt) <= 0) { a.ring = 0.45; lab.ring([w.x, 0.05, w.z], { color: this.BEAM, radius: 1.3, life: 0.4 }); }
        if (k >= 1) { a.phase = 'away'; a.t = 0; a.p0 = [s.x, s.y, s.z]; lab.sfx.whoosh(); }
      } else { // унёс: свечкой в небо вместе с бурёнкой
        a.t += dt / 1.2;
        const k = lab.ease.inCubic(Math.min(1, a.t));
        s.y = a.p0[1] + k * 16; s.z = a.p0[2] - k * 14; s.ry += dt * 14;
        w.x = s.x; w.z = s.z; w.y = s.y - 1.65;
        if (a.t >= 1) {
          s.alive = false; s.abduct = null; st.slots[s.slot] = null; st.alive--;
          w.state = 'gone'; st.lost++; lab.count('бурёнки украдены');
          lab.popup(st.gun.g, 'Бурёнку украли!', '#ff5a3d', 24); lab.tone(300, 0.5, 'triangle', 0.07, 120);
          if (st.alive === 0) this.nextWave(lab);
        }
      }
    }
  },

  // ---------- выстрел пушки: заряд → ядро с огненным хвостом → искры сквозь врага ----------
  // ступень ствола: 1 — ядро, 2 — двустволка, 3 — веер, 4 — очередь (веер чаще), 5 — разрывные (среднее ядро рвётся)
  rate(lab) { return lab.cfg.fireRate * (lab.state.gunLv >= 4 ? 1.6 : 1); },
  shoot(lab) {
    const st = lab.state, c = st.gun.g.position, lv = st.gunLv, w = this.WEAPONS[lv - 1];
    const volley = lv === 1 ? [[0, 0]] : lv === 2 ? [[-0.34, 0], [0.34, 0]] : [[-0.2, -0.2], [0, 0], [0.2, 0.2]]; // [сдвиг ствола, наклон]
    volley.forEach(([ox, dx], i) => {
      const boom = lv >= 5 && i === 1, r = boom ? 0.3 : 0.22;
      const m = lab.mesh(st.geo.core, boom ? '#ffe0d0' : w.core, { at: [c.x + ox * 1.25, 1.2, c.z - 1.8], glow: 1.6, shadow: false });
      m.scale.setScalar(r * 0.5);
      st.bullets.push({ m, r, dx, age: 0, main: i === Math.floor((volley.length - 1) / 2), boom, hit: false, trail: lab.trail(m, { color: w.color, width: boom ? 0.5 : 0.36, length: 12 }) });
    });
    st.shots++; st.reload = 1 / this.rate(lab); st.want = 0; lab.count('выстрелы');
    lab.burst([c.x, 1.2, c.z - 1.8], { count: 8 + 3 * volley.length, colors: [w.core, w.color], speed: 5, size: 0.16, life: 0.18, gravity: 0, dir: [0, 0.3, -1] }); // дульная вспышка
    st.gun.g.position.z += 0.32; // отдача
    lab.pulse(st.gun.barrel, 1.4, 0.12);
    lab.sfx.shoot(); lab.tone(150, 0.07, 'sine', 0.1, 60);
  },
  moveBullets(lab, dt) {
    const st = lab.state, cfg = lab.cfg;
    st.bullets = st.bullets.filter(bl => {
      const b = bl.m, p = b.position;
      const gone = miss => { if (miss && bl.main && !bl.hit) st.combo = 0; b.removeFromParent(); return false; };
      p.z -= cfg.bulletSpeed * dt; p.x += bl.dx * cfg.bulletSpeed * dt; bl.age += dt;
      b.scale.setScalar(bl.r * Math.min(1.2, 0.5 + bl.age * 5)); // ядро разгорается в полёте
      if (p.z < -24 || Math.abs(p.x) > 16) return gone(true);
      if (this.hitShield(lab, p.x, p.z)) return gone(true);
      const ba = st.balloon;
      if (ba && !ba.popped && Math.abs(ba.x - p.x) < 1.1 && Math.abs(ba.z - p.z) < 0.9) { bl.hit = true; this.popBalloon(lab); return gone(false); }
      for (const s of st.saucers) {
        if (!s.alive || s.hidden || s.arrive > 0.3 || s.y > 2.8) continue;
        if (Math.abs(s.x - p.x) < 1.15 && Math.abs(s.z - p.z) < 0.8) { // как видно: тарелка 2,3 м в ширину
          bl.hit = true;
          if (bl.boom) { this.explode(lab, lab.v3(s.x, s.y, s.z)); return gone(false); }
          if (s.armor) this.breakArmor(lab, s); else this.killSaucer(lab, s);
          return gone(false);
        }
      }
      const bo = st.boss;
      if (bo && !bo.away && bo.y < 5 && Math.abs(bo.g.position.x - p.x) < 2.0 && Math.abs(bo.g.position.z - p.z) < 1.3) {
        bl.hit = true;
        if (bl.boom) this.explode(lab, p.clone());
        this.hitBoss(lab, p.clone()); return gone(false);
      }
      return true;
    });
  },
  // разрывное ядро (ступень 5): рвётся кругом, круг виден, всё внутри сбито, броня — тоже
  explode(lab, at) {
    const st = lab.state, R = 2.1;
    lab.ring([at.x, 0.05, at.z], { color: '#ff7a5a', radius: R, life: 0.4 });
    lab.burst(at, { count: 30, colors: ['#ff7a5a', '#ffd23f', '#ffffff'], speed: 10, size: 0.3, life: 0.5 });
    lab.flash('#ff7a5a', 0.12); lab.shake(0.3); lab.sfx.explode();
    const hitList = st.saucers.filter(s => s.alive && !s.hidden && s.y <= 2.8 && Math.hypot(s.x - at.x, s.z - at.z) < R);
    for (const s of hitList) if (s.alive && st.saucers.includes(s)) { s.armor = false; this.killSaucer(lab, s); }
  },
  // броненосец: первое попадание сбивает шлем, второе — сбивает НЛО
  breakArmor(lab, s) {
    const st = lab.state, at = lab.v3(s.x, s.y + 0.4, s.z);
    s.armor = false; s.flash = 0.1; s.squash = 0.6; st.armorBroken++; lab.count('броня');
    lab.burst(at, { count: 14, colors: ['#e6ecff', '#8a93ab', '#ffffff'], speed: 7, size: 0.16, life: 0.3, gravity: 6, dir: [0, 0.5, -1] });
    lab.tone(1400, 0.08, 'square', 0.05, 500); lab.noise(0.08, 0.1, 5000); lab.hitstop(0.025);
    this.hit(lab); this.points(lab, 10, at, '#c9cfdc');
    if (st.armorBroken <= 2) lab.popup([s.x, s.y + 1.3, s.z], 'Броня!', '#c9cfdc', 18);
    // шлем отлетает кувырком и падает
    const m = lab.mesh(st.geo.armor, lab.mat('#8a93ab', { metal: 0.75, shiny: true }), { at: [s.x, s.y, s.z], scale: s.scale, shadow: false });
    const v = { x: lab.rand(-2, 2), y: 5, z: -3, spin: lab.rand(-9, 9) };
    lab.tween(1.0, (k, raw) => {
      v.y -= 16 * lab.dt; m.position.x += v.x * lab.dt; m.position.y = Math.max(0.1, m.position.y + v.y * lab.dt); m.position.z += v.z * lab.dt;
      m.rotation.x += v.spin * lab.dt; m.rotation.z += v.spin * 0.6 * lab.dt;
      if (raw >= 1) { lab.burst(m, { count: 6, colors: ['#8a93ab', '#5a3d2b'], speed: 2 }); m.removeFromParent(); }
    }, 'linear');
  },
  // взрыв попадания: вспышка, искры летят дальше по направлению выстрела (сквозь врага), волна, глухой «бум»
  // три слоя: белая вспышка, искры сквозь врага, осколки корпуса цвета ряда падают в траву
  impact(lab, at, colors) {
    lab.burst(at, { count: 5, colors: ['#ffffff'], speed: 3, size: 0.55, life: 0.12, gravity: 0 });
    lab.burst(at, { count: 14, colors, speed: 9, size: 0.2, life: 0.4, gravity: 4, dir: [0, 0.3, -1] });
    lab.burst(at, { count: 9, colors: [colors[0], '#3d4258', '#2a2e40'], speed: 5, size: 0.3, life: 0.9, gravity: 14, up: 3 });
    lab.ring([at.x, 0.05, at.z], { color: colors[0], radius: 1.6, life: 0.3 });
    lab.noise(0.16, 0.18, 1400); lab.tone(170, 0.14, 'sine', 0.14, 50);
  },
  // серия попаданий без промаха: каждые cfg.combo попаданий множитель очков растёт, цифры становятся крупнее
  mult(lab) { return lab.cfg.combo > 0 ? Math.min(5, 1 + Math.floor(lab.state.combo / lab.cfg.combo)) : 1; },
  hit(lab) {
    const st = lab.state;
    st.hits++; st.combo++; st.bestCombo = Math.max(st.bestCombo, st.combo);
    lab.tone(480 * lab.pitch(Math.min(st.combo, 20) - 1), 0.05, 'square', 0.035); // каждое попадание подряд звенит выше
    if (lab.cfg.combo > 0 && st.combo % lab.cfg.combo === 0 && st.combo <= 4 * lab.cfg.combo) {
      lab.popup(st.gun.g, 'Серия ×' + this.mult(lab) + '!', '#7cf5a8', 24); lab.sfx.coin();
    }
  },
  points(lab, n, at, color, k2 = 1) {
    const k = this.mult(lab) * k2;
    lab.addScore(n * k);
    lab.popup(at, '+' + n * k + (k > 1 ? ' ×' + k : ''), color || '#ffe08a', 16 + 4 * Math.min(k, 6));
  },
  killSaucer(lab, s, o = {}) {
    const st = lab.state, cfg = lab.cfg, at = lab.v3(s.x, s.y, s.z), R = this.ROWS[s.row % this.ROWS.length];
    s.alive = false; st.alive--; lab.count('сбито');
    if (st.bonus) st.bonus.killed++;
    else if (cfg.speedup > 0 && st.alive > 0) lab.count('_secret'); // спрятанная механика сработала: волна стала быстрее (скрытый счётчик для урока)
    if (s.dive && s.dive.warn) s.dive.warn.dispose();
    const diving = !!(s.dive && s.dive.phase === 'dive'), flight = s.dive && s.dive.flight;
    const ab = s.abduct;
    if (ab && ab.warn) ab.warn.dispose();
    s.dive = null; s.diveWarn = false; s.charging = false; s.abduct = null;
    st.charges = st.charges.filter(ch => { if (ch.s === s) { ch.dispose(); return false; } return true; });
    this.impact(lab, at, [R.color, '#ffffff', '#ffd23f']);
    lab.shake(diving ? 0.35 : 0.2); lab.hitstop(diving ? 0.07 : 0.035);
    this.wreck(lab, s);
    if (ab) this.freeCow(lab, s, ab, o);
    if (!o.noScore) {
      this.hit(lab);
      this.points(lab, s.points, at, diving ? '#ff8a3d' : null, diving ? 2 : 1);
      if (diving) { st.diveKills++; lab.count('сбито в пике'); lab.popup([at.x, at.y + 1.2, at.z], 'В пике! ×2', '#ff8a3d', 22); }
      if (diving && flight && ++flight.killed === flight.n) { // всё звено сбито в пике
        st.flightsDone++; lab.count('звено целиком');
        lab.after(0.15, () => { this.points(lab, 300, lab.v3(at.x, at.y + 2, at.z), '#ff8a3d'); lab.popup(st.gun.g, 'Всё звено!', '#ff8a3d', 28); lab.sfx.power(); lab.flash('#ff8a3d', 0.15); });
      }
      this.chain(lab, s, at);
    }
    if (!st.bonus && st.alive === 1 && !st.lastWarned) {
      st.lastWarned = true;
      const last = st.saucers.find(x => x.alive);
      lab.popup([last.x, last.y + 1, last.z], 'Последнее!', '#ff6ad5', 24); lab.tone(1200, 0.25, 'sawtooth', 0.06, 1800);
    }
    if (st.alive === 0) st.bonus ? this.endBonus(lab) : this.nextWave(lab);
  },
  // сбитый похититель отпускает бурёнку: в луче — спасена (+300), если только летел к ней — она просто пасётся дальше
  freeCow(lab, s, ab, o) {
    const st = lab.state, w = ab.cow;
    if (w.state === 'wait') { w.state = 'graze'; w.wait = 0; if (!o.noScore) lab.popup([s.x, s.y + 1.6, s.z], 'Похититель сбит!', this.BEAM, 20); return; }
    if (w.state !== 'lift' && !(ab.phase === 'away')) return;
    w.state = 'fall'; w.vy = 1.5;
    if (o.noScore) return;
    st.saved++; lab.count('бурёнки спасены');
    this.points(lab, 300, lab.v3(w.x, w.y + 2, w.z), this.BEAM);
    lab.popup(st.gun.g, 'Бурёнка спасена!', this.BEAM, 28); lab.sfx.coin(); lab.flash(this.BEAM, 0.12);
  },
  // цепочка по мотивам Space Invaders Extreme: НЛО одного цвета подряд → подарок падает к пушке, его надо поймать
  chain(lab, s, at) {
    const st = lab.state, cfg = lab.cfg;
    if (cfg.chain <= 0) return;
    if (s.row === st.chainRow) st.chainN++; else { st.chainRow = s.row; st.chainN = 1; }
    if (st.chainN < cfg.chain) { if (st.chainN > 1) lab.tone(660 * lab.pitch(st.chainN * 2), 0.08, 'triangle', 0.06); return; }
    st.chainN = 0; st.chains++; lab.count('цепочки');
    const R = this.ROWS[s.row % this.ROWS.length];
    lab.popup([at.x, at.y + 1.6, at.z], 'Цепочка! Лови подкову', R.color, 24);
    lab.ring([at.x, 0.05, at.z], { color: R.color, radius: 3.5, life: 0.5 }); lab.sfx.power();
    this.dropShoe(lab, at);
  },
  // подкова на счастье: катится к пушке по светлой дорожке; поймал — ствол на ступень сильнее
  dropShoe(lab, at) {
    const st = lab.state, color = '#ffd23f';
    const m = lab.mesh(st.geo.shoe, color, { at: [at.x, at.y, at.z], glow: 1.2, shiny: true, metal: 0.6, scale: 1.15, shadow: false });
    const lane = lab.mesh(st.geo.lane, lab.mat(color, { unlit: true, alpha: 0.25 }), { scale: [0.9, 1, 1], shadow: false });
    st.caps.push({ m, lane, color, x: lab.clamp(at.x, -this.EDGE, this.EDGE), y: at.y, z: at.z });
  },
  moveCaps(lab, dt) {
    const st = lab.state, c = st.gun.g.position;
    st.caps = st.caps.filter(cp => {
      cp.z += 6 * dt; cp.y = lab.damp(cp.y, 1, 3, dt);
      cp.m.position.set(cp.x, cp.y + Math.sin(lab.t * 6) * 0.2, cp.z); cp.m.rotation.y += dt * 4;
      const len = Math.max(0.1, this.PLAYER_Z - cp.z); // дорожка показывает, куда подарок прилетит
      cp.lane.scale.z = len; cp.lane.position.set(cp.x, 0.07, cp.z + len / 2);
      const done = () => { cp.m.removeFromParent(); cp.lane.removeFromParent(); return false; };
      if (Math.abs(cp.x - c.x) < 1.3 && Math.abs(cp.z - c.z) < 0.9) {
        st.gifts++; lab.count('подарки');
        lab.burst(cp.m, { count: 26, colors: [cp.color, '#ffffff'], speed: 7, up: 2 }); lab.ring([c.x, 0.05, c.z], { color: cp.color, radius: 3 });
        this.levelUp(lab, 'подкова');
        return done();
      }
      if (cp.z > this.PLAYER_Z + 2.5) { lab.burst(cp.m, { count: 8, color: '#667788', speed: 2 }); return done(); }
      return true;
    });
  },
  // ---------- ступени ствола по мотивам Raiden и 1942: подкова — ступень вверх, попадание по пушке — ступень вниз ----------
  // Видно = правда: сколько стволов на пушке, столько ядер в залпе; у «Очереди» короб с ядрами, у «Разрывных» дула раскалены.
  setWeapon(lab) {
    const st = lab.state, g = st.gun, lv = st.gunLv;
    st.bestLv = Math.max(st.bestLv, lv);
    g.tubes[0].visible = g.tubes[2].visible = lv >= 2; g.tubes[1].visible = lv !== 2;
    g.drum.visible = lv >= 4;
    const muzzle = lv >= 5 ? lab.mat('#ff5a3d', { glow: 0.8, metal: 0.5 }) : lab.mat('#a87a2c', { metal: 0.7, shiny: true });
    g.muzzles.forEach(m => { m.material = muzzle; });
    g.charge.material = lab.mat(this.WEAPONS[lv - 1].color, { glow: 1.4 }); // огонёк на стволе — цвета ступени
  },
  levelUp(lab) {
    const st = lab.state, W = this.WEAPONS, c = st.gun.g.position;
    if (st.gunLv >= W.length) { this.points(lab, 500, lab.v3(c.x, 2.4, c.z - 0.5), '#ffd23f'); lab.popup(st.gun.g, 'Ствол на пределе!', '#ffd23f', 24); lab.sfx.coin(); return; }
    st.gunLv++; st.ups++; lab.count('ступени ствола');
    this.setWeapon(lab);
    const w = W[st.gunLv - 1];
    lab.popup(st.gun.g, w.name + '!', w.color, 34);
    lab.after(0.45, () => lab.popup(lab.v3(c.x, 2.6, c.z - 1.5), `Ствол ${st.gunLv}/${W.length}: ${w.tip}`, '#ffe08a', 18));
    lab.burst([c.x, 1.2, c.z], { count: 30, colors: [w.color, w.core, '#ffffff'], speed: 8, up: 4 });
    lab.ring([c.x, 0.05, c.z], { color: w.color, radius: 3.4, life: 0.5 });
    lab.pulse(st.gun.g, 1.35, 0.25); lab.flash(w.color, 0.2); lab.hitstop(0.05);
    [0, 4, 7, 12].forEach((n, i) => lab.tone(392 * Math.pow(2, (n + 2 * st.gunLv) / 12), 0.14, 'triangle', 0.07, 0, i * 0.07)); // восходящий аккорд: каждая ступень звенит выше
  },
  loseLevel(lab) {
    const st = lab.state, n = Math.round(lab.cfg.loseLevel), c = st.gun.g.position;
    if (n <= 0 || st.gunLv <= 1) return;
    st.gunLv = Math.max(1, st.gunLv - n); st.downs++; lab.count('ступени потеряны');
    this.setWeapon(lab);
    lab.burst([c.x, 1.2, c.z - 0.6], { count: 12, colors: ['#a87a2c', '#d9a441', '#5a3d2b'], speed: 5, up: 3 }); // отлетели стволы
    lab.after(0.4, () => lab.popup(st.gun.g, 'Ствол слабее: ' + this.WEAPONS[st.gunLv - 1].name, '#ff8a7a', 22));
    lab.tone(520, 0.35, 'triangle', 0.06, 180, 0.1);
  },

  // ---------- ярмарочный шар по мотивам POW из 1942: плывёт над выгоном, под корзиной висит подкова ----------
  // Сбил шар — подкова катится к пушке по дорожке, поймал — ствол на ступень сильнее. Шар закрывает строй: выстрел по нему — выбор.
  moveBalloon(lab, dt) {
    const st = lab.state, cfg = lab.cfg, b = st.balloon;
    if (!b) {
      if (cfg.balloonEvery > 0 && !st.bonus && (st.balloonT -= dt) <= 0) { st.balloonT = cfg.balloonEvery * lab.rand(0.85, 1.15); this.spawnBalloon(lab); }
      return;
    }
    b.t += dt; b.x += b.dir * b.speed * dt;
    b.g.position.set(b.x, b.y + Math.sin(b.t * 1.7) * 0.18, b.z);
    b.g.rotation.z = Math.sin(b.t * 1.3) * 0.08; b.g.rotation.y += dt * 0.4;
    if (Math.abs(b.x) > 18) { b.g.removeFromParent(); st.balloon = null; } // улетел
  },
  spawnBalloon(lab) {
    const st = lab.state, dir = lab.chance(0.5) ? 1 : -1;
    let front = -6; // шар летит перед строем, но не над стогами
    for (const s of st.saucers) if (s.alive && !s.dive && !s.abduct) front = Math.max(front, s.bz + st.oz);
    const z = lab.clamp(front + 2.8, -1, 5.6), x = -dir * 17, g = lab.group({ at: [x, 2, z] });
    lab.ball(0.95, '#ff4d5e', { parent: g, at: [0, 1.05, 0], scale: [1, 1.15, 1] });
    lab.cyl(0.99, 0.99, 0.26, '#ffd23f', { parent: g, at: [0, 1.05, 0], sides: 10 }); // жёлтый пояс
    lab.cyl(0.62, 0.62, 0.2, '#ffffff', { parent: g, at: [0, 1.75, 0], sides: 10 });
    lab.cyl(0.3, 0.42, 0.25, '#ff4d5e', { parent: g, at: [0, 0.05, 0], sides: 8 }); // горловина
    for (const [rx, rz] of [[-0.2, -0.2], [0.2, -0.2], [-0.2, 0.2], [0.2, 0.2]]) lab.box(0.03, 0.55, 0.03, '#5a3d2b', { parent: g, at: [rx, -0.3, rz] });
    lab.box(0.5, 0.36, 0.5, '#9a6b42', { parent: g, at: [0, -0.7, 0], round: 0.04 }); // корзина
    lab.mesh(st.geo.shoe, '#ffd23f', { parent: g, at: [0, -1.2, 0], glow: 1.2, shiny: true, metal: 0.6, scale: 0.7, shadow: false });
    st.balloon = { g, x, y: 2, z, dir, speed: 3.6, t: 0 };
    lab.count('шары');
    lab.popup([0, 4, z], 'Ярмарочный шар! Сбей и лови подкову', '#ffd23f', 22);
    [660, 880, 1100].forEach((f, i) => lab.tone(f, 0.18, 'triangle', 0.05, 0, i * 0.12)); // ярмарочная дудка
  },
  popBalloon(lab) {
    const st = lab.state, b = st.balloon, at = lab.v3(b.x, b.y + 1, b.z);
    st.balloon = null; st.balloons++; lab.count('шары сбиты');
    b.g.removeFromParent();
    lab.burst(at, { count: 40, colors: ['#ff4d5e', '#ffd23f', '#ffffff', '#5fe0ff', '#7cf5a8'], speed: 9, size: 0.22, life: 0.8, gravity: 5 }); // конфетти
    lab.burst([b.x, b.y - 0.7, b.z], { count: 10, colors: ['#9a6b42', '#5a3d2b'], speed: 3, gravity: 10 }); // щепки корзины
    lab.ring([b.x, 0.05, b.z], { color: '#ffd23f', radius: 2.5, life: 0.4 });
    lab.noise(0.12, 0.2, 3000); lab.tone(900, 0.12, 'square', 0.05, 300); lab.hitstop(0.04); lab.shake(0.15);
    this.hit(lab); this.points(lab, 50, at, '#ffd23f');
    this.dropShoe(lab, lab.v3(b.x, b.y - 1.2, b.z));
  },

  // волна сбита: чистая волна, подсчёт бурёнок (как города в Missile Command), дальше — налёт или новая волна
  nextWave(lab) {
    const st = lab.state, cfg = lab.cfg, done = st.wave;
    if (!st.hurtInWave) { lab.addScore(100 * done, [0, 3, -2], '#7cf5a8'); lab.popup([0, 4, -2], 'Чистая волна!', '#7cf5a8', 26); }
    const herd = st.cows.filter(w => w.state !== 'gone');
    if (herd.length) lab.after(0.6, () => {
      lab.popup(st.gun.g, `Бурёнки целы: ${herd.length} × ${30 * done}`, this.BEAM, 22);
      herd.forEach((w, i) => lab.after(0.12 * i, () => { lab.addScore(30 * done, [w.x, 1.6, w.z], this.BEAM); this.moo(lab, 1 + i * 0.12); }));
    });
    st.wave++; st.waveMul *= 0.88; st.danger = false;
    lab.count('волны');
    lab.sfx.win(); lab.flash('#7cf5a8', 0.25); lab.slowmo(0.6, 0.3); st.cam.punch = 0.6; // последний сбитый — в замедлении и с толчком камеры
    lab.tween(0.5, k => { st.gun.body.position.y = Math.sin(k * Math.PI) * 0.5; }, 'linear'); // наводчик подпрыгивает от радости
    st.bombs.forEach(b => this.dropBomb(b)); st.bombs = [];
    st.charges.forEach(ch => ch.dispose()); st.charges = [];
    if (cfg.bonusEvery > 0 && done % Math.round(cfg.bonusEvery) === 0) return this.startBonus(lab);
    this.startWave(lab);
  },
  startWave(lab) {
    const st = lab.state;
    lab.popup(lab.v3(0, 3.5, -4), 'Волна ' + st.wave, '#c4b2ff', 40); // название волны крупно посередине
    this.buildShields(lab);
    this.buildWave(lab);
    lab.hud('wave', 'Волна ' + st.wave, { color: '#c4b2ff', size: 15 });
  },

  // ---------- ночной налёт по мотивам бонусного этапа Galaga: три стаи пролетают петлями и не стреляют ----------
  // Передышка перед следующим пиком: бояться нечего, зато каждое НЛО — 100, а все 24 — «Идеально!» и +2000.
  startBonus(lab) {
    const T = lab.THREE, st = lab.state;
    st.saucers.forEach(s => { if (!s.wreck) st.slots[s.slot] = null; });
    st.saucers = [];
    const V = (x, z) => new T.Vector3(x, 0, z);
    const left = [V(-22, -14), V(-10, -9), V(-4, -1), V(3, 2), V(8, -2), V(4, -7), V(-2, -5), V(2, -12), V(22, -16)];
    const paths = [left, left.map(v => V(-v.x, v.z)), [V(-3, -28), V(-2, -10), V(6, -2), V(10, -7), V(0, -10), V(-10, -7), V(-6, -2), V(2, -10), V(3, -28)]];
    const curves = paths.map(p => new T.CatmullRomCurve3(p));
    for (let g = 0; g < 3; g++) for (let i = 0; i < 8; i++) {
      const slot = st.slots.indexOf(null);
      if (slot < 0) break;
      const s = { slot, row: [0, 3, 2][g], bx: 0, bz: 0, alive: true, hidden: true, x: 0, y: 1.45, z: -30, rx: 0, ry: 0, rz: 0, scale: 1.25, squash: 1, flash: 0, phase: lab.rand(0, 6), points: 100, arrive: 0, path: { curve: curves[g], t0: 1.6 + g * 4 + i * 0.24, dur: 5.6 } };
      st.slots[slot] = s; st.saucers.push(s);
    }
    st.total = st.saucers.length; st.alive = st.total;
    st.bonus = { t: 0, total: st.total, killed: 0, note: 0, noteT: 0 };
    lab.popup(lab.v3(0, 4, -6), 'Ночной налёт!', '#ffd23f', 32);
    lab.after(0.8, () => lab.popup(lab.v3(0, 3, -4), 'НЛО не стреляют — сбей всех', '#ffe08a', 22));
    lab.hud('wave', 'Ночной налёт', { color: '#ffd23f', size: 15 }); lab.count('налёт'); lab.sfx.power();
  },
  moveBonus(lab, dt) {
    const st = lab.state, b = st.bonus, t = st.tmp;
    b.t += dt;
    if ((b.noteT -= dt) <= 0) { b.noteT = 0.22; lab.tone([392, 494, 587, 494, 440, 554, 659, 554][b.note++ % 8], 0.12, 'triangle', 0.05); } // плясовая вместо марша
    st.danger = false;
    for (const s of st.saucers) {
      if (!s.alive || !s.path) continue;
      const u = (b.t - s.path.t0) / s.path.dur;
      if (u < 0) continue;
      if (u > 1) { s.alive = false; st.alive--; st.slots[s.slot] = null; continue; } // улетело — не сбито
      s.hidden = false;
      const c = s.path.curve, pos = c.getPointAt(u), tan = c.getTangentAt(u, t.p);
      const turn = Math.atan2(tan.x, tan.z);
      s.rz = lab.clamp(((s.yaw == null ? turn : s.yaw) - turn) * 8, -0.7, 0.7); s.yaw = turn;
      s.x = pos.x; s.z = pos.z; s.y = 1.45 + Math.sin(lab.t * 4 + s.phase) * 0.15; s.ry += dt * 5;
    }
    if (st.alive <= 0) this.endBonus(lab);
  },
  endBonus(lab) {
    const st = lab.state, b = st.bonus;
    if (!b || b.ended) return;
    b.ended = true; st.bonusBest = Math.max(st.bonusBest, b.killed);
    lab.popup(lab.v3(0, 4, -6), `Налёт: сбито ${b.killed} из ${b.total}`, '#ffd23f', 26);
    if (b.killed === b.total) {
      st.bonusPerfect++; lab.count('налёт идеально');
      lab.after(0.5, () => { lab.addScore(2000, [0, 4, -4], '#ffd23f'); lab.popup(st.gun.g, 'Идеально!', '#ffd23f', 34); lab.sfx.win(); lab.flash('#ffd23f', 0.3); lab.burst(st.gun.g, { count: 40, colors: ['#ffd23f', '#ff6ad5', '#5fe0ff', '#7cf5a8'], speed: 10, up: 6 }); });
    }
    lab.after(1.6, () => { st.bonus = null; this.startWave(lab); });
  },

  // ---------- последствия: сбитое НЛО горит, кувыркается, падает и оставляет выжженное пятно ----------
  wreck(lab, s) { Object.assign(s, { wreck: true, hidden: false, vy: 2.5, spin: lab.rand(-7, 7), smoke: 0, flash: 0.07 }); },
  moveWrecks(lab, dt) {
    const st = lab.state;
    for (let i = 0; i < this.POOL; i++) {
      const s = st.slots[i];
      if (!s || !s.wreck) continue;
      s.vy -= 14 * dt; s.y += s.vy * dt; s.z -= 2 * dt;
      s.rz += s.spin * dt; s.rx += 3 * dt;
      if ((s.smoke -= dt) <= 0) { s.smoke = 0.04; lab.burst([s.x, s.y, s.z], { count: 2 * s.scale, colors: ['#ff7a2f', '#ffd23f', '#3a3a48'], speed: 1.2, size: 0.3 * s.scale, life: 0.4, gravity: -2 }); }
      if (s.y > 0.3) continue;
      lab.burst([s.x, 0.3, s.z], { count: 14 * s.scale, colors: ['#ff7a2f', '#ffd23f', '#5a4a3a'], speed: 6, up: 3 });
      lab.ring([s.x, 0.05, s.z], { color: '#ff7a2f', radius: 1.8 * s.scale });
      lab.noise(0.25, 0.1 * s.scale, 600); lab.shake(0.12 * s.scale);
      this.hitShield(lab, s.x, s.z, 0.9); // упало на стог — стог горит
      this.scorch(lab, s.x, s.z, 0.9 * s.scale);
      st.slots[i] = null;
    }
  },
  scorch(lab, x, z, size) {
    const st = lab.state;
    if (!st.scorches) { st.scorches = lab.instances(new lab.THREE.CircleGeometry(1, 10).rotateX(-Math.PI / 2), lab.mat('#16120e', { unlit: true, alpha: 0.72 }), 16, { shadow: false }); st.scorches.frustumCulled = false; }
    lab.place(st.scorches, st.scorchN++ % 16, [x, 0.07, z], { scale: size, rot: lab.rand(0, 6) });
  },

  // ---------- выстрелы НЛО: сначала честное предупреждение (луч краснеет, путь на земле), потом снаряд ----------
  enemyFire(lab, dt) {
    const st = lab.state, cfg = lab.cfg, c = st.gun.g.position;
    st.fireT -= dt;
    if (st.fireT <= 0 && st.alive > 0 && st.bombs.length + st.charges.length < 2 + st.wave) {
      st.fireT = cfg.fireEvery * st.waveMul * lab.rand(0.7, 1.3);
      // стреляет переднее НЛО случайного столбца, чаще — над пушкой: стоять на месте опасно
      const fronts = {};
      for (const s of st.saucers) if (s.alive && !s.dive && !s.abduct && s.arrive <= 0 && (!fronts[s.col] || s.bz > fronts[s.col].bz)) fronts[s.col] = s;
      const list = Object.values(fronts);
      if (list.length) {
        if (lab.chance(0.6)) list.sort((a, b) => Math.abs(a.x - c.x) - Math.abs(b.x - c.x));
        const s = lab.chance(0.6) ? list[0] : lab.pick(list);
        s.charging = true;
        const lane = this.makeLane(lab, '#ff4d5e');
        st.charges.push({ s, t: cfg.telegraph, lane, dispose() { s.charging = false; lane.removeFromParent(); } });
        if (cfg.telegraph > 0.05) lab.sfx.warn();
      }
    }
    st.charges = st.charges.filter(ch => {
      const s = ch.s;
      if (!s.alive || s.dive || s.abduct) { ch.dispose(); return false; }
      this.placeLane(ch.lane, s.x, s.z, 0, 1, this.PLAYER_Z + 1);
      if ((ch.t -= dt) > 0) return true;
      s.charging = false;
      this.addBomb(lab, s.x, s.z + 0.6, 0, 1, ch.lane, '#ff5a4a', 0.34);
      return false;
    });
  },
  makeLane(lab, color) { return lab.mesh(lab.state.geo.lane, lab.mat(color, { unlit: true, alpha: 0.28 }), { scale: [0.5, 1, 1], shadow: false }); },
  // путь снаряда на земле от (x, z) по направлению (dx, dz) до линии toZ
  placeLane(lane, x, z, dx, dz, toZ) {
    const t = Math.max(0.1, (toZ - z) / Math.max(0.2, dz)), ex = x + dx * t, ez = z + dz * t;
    lane.scale.z = Math.hypot(ex - x, ez - z); lane.rotation.y = Math.atan2(ex - x, ez - z);
    lane.position.set((x + ex) / 2, 0.06, (z + ez) / 2);
  },
  addBomb(lab, x, z, dx, dz, lane, color, size, k = 1) {
    const st = lab.state, m = lab.mesh(st.geo.oct, color, { at: [x, 1.0, z], glow: 1.3, scale: size, shadow: false });
    if (!st.geo.shadow) { st.geo.shadow = new lab.THREE.CircleGeometry(1, 12).rotateX(-Math.PI / 2); st.shadowMat = lab.mat('#000000', { unlit: true, alpha: 0.5 }); }
    const shadow = lab.mesh(st.geo.shadow, st.shadowMat, { at: [x, 0.08, z], scale: size * 1.8, shadow: false }); // тень на земле: видно, где пройдёт снаряд
    st.bombs.push({ m, shadow, size, lane, dx, dz, k, dead: false, trail: lab.trail(m, { color, width: size * 1.3, length: 9 }) });
    lab.burst([x, 1, z], { count: 6, colors: [color, '#ffffff'], speed: 3, size: 0.15, life: 0.2, gravity: 0 });
    lab.tone(320, 0.12, 'square', 0.04, 160);
  },
  dropBomb(b) { b.lane.removeFromParent(); b.m.removeFromParent(); b.shadow.removeFromParent(); },
  moveBombs(lab, dt) {
    const st = lab.state, cfg = lab.cfg, c = st.gun.g.position;
    st.bombs = st.bombs.filter(b => {
      const done = () => { this.dropBomb(b); return false; };
      if (b.dead) return done();
      const v = cfg.bombSpeed * b.k, p = b.m.position;
      p.x += b.dx * v * dt; p.z += b.dz * v * dt;
      b.m.rotation.y += dt * 6; b.m.rotation.x += dt * 4; b.m.scale.setScalar(b.size * (1 + 0.18 * Math.sin(lab.t * 22))); // снаряд пульсирует
      b.shadow.position.set(p.x, 0.08, p.z);
      this.placeLane(b.lane, p.x, p.z, b.dx, b.dz, this.PLAYER_Z + 1);
      if (this.hitShield(lab, p.x, p.z)) return done();
      if (Math.abs(p.x - c.x) < 0.95 && Math.abs(p.z - c.z) < 0.75) { // пушка в 1,25 раза крупнее: попадание по ней — как видно
        lab.count('попадания по пушке'); st.combo = 0;
        if (lab.hurt(p.clone(), 'Пушку подбили')) { st.hurtInWave = true; this.loseLevel(lab); lab.tween(0.35, k => { st.gun.body.rotation.x = Math.sin(k * Math.PI) * -0.6; }, 'linear'); }
        return done();
      }
      if (p.z > this.PLAYER_Z + 1.5 || Math.abs(p.x) > 16) { lab.burst([p.x, 0.3, p.z], { count: 6, colors: ['#ff4d5e', '#5a3d2b'], speed: 3 }); this.scorch(lab, p.x, p.z, 0.4); return done(); }
      return true;
    });
  },

  // ---------- золотое НЛО: сильный враг со своей атакой ----------
  // Летает восьмёркой над волной, держит cfg.bossHP попаданий, заряжается и бьёт веером в сторону пушки.
  // Путь каждого снаряда веера виден на земле, пока НЛО заряжается. На половине прочности — ярость: веер шире и чаще.
  // На ночной налёт золотое НЛО поднимается за облака и возвращается потом с той же прочностью.
  spawnBoss(lab) {
    const st = lab.state, cfg = lab.cfg;
    const g = lab.group({ at: [0, 3, -20], scale: 2.2 });
    lab.cyl(0.55, 0.82, 0.3, '#ffd23f', { parent: g, sides: 12, shiny: true, metal: 0.6 });
    lab.cyl(0.95, 0.95, 0.1, '#b8860b', { parent: g, at: [0, -0.1, 0], sides: 12, metal: 0.5 });
    lab.mesh(new lab.THREE.SphereGeometry(0.42, 12, 6, 0, Math.PI * 2, 0, Math.PI / 2), '#fff3a0', { parent: g, at: [0, 0.12, 0], glow: 0.5, shiny: true });
    const lamps = lab.addons.BufferGeometryUtils.mergeGeometries([...Array(10)].map((_, i) => { const a = i / 10 * Math.PI * 2; return new lab.THREE.BoxGeometry(0.15, 0.12, 0.15).translate(Math.cos(a) * 0.9, -0.08, Math.sin(a) * 0.9); }));
    lab.mesh(lamps, '#ffd23f', { parent: g, unlit: true, glow: 1.4, shadow: false }); // десять ламп по ободу — одна деталь
    const back = lab.box(3, 0.2, 0.06, '#2b2f3a', { shadow: false }), bar = lab.box(3, 0.22, 0.1, '#ffd23f', { glow: 1, shadow: false });
    st.boss = { g, back, bar, hp: cfg.bossHP, max: cfg.bossHP, t: 0, x: 0, z: -20, y: 3, kick: 0, burn: 0, fireT: 2.5, charge: null, rage: false, away: false };
    lab.popup(lab.v3(0, 4, -10), 'Золотое НЛО!', '#ffd23f', 30); lab.flash('#ffd23f', 0.2);
    lab.tone(300, 0.6, 'sawtooth', 0.06, 900); lab.count('золотое НЛО прилетело');
  },
  moveBoss(lab, dt) {
    const st = lab.state, cfg = lab.cfg, bo = st.boss, c = st.gun.g.position;
    if (!bo) { if (!st.bonus) st.bossT -= dt; if (st.bossT <= 0 && st.alive > 0 && !st.bonus) this.spawnBoss(lab); return; }
    const m = bo.g, k = 1 - Math.exp(-dt * 3);
    bo.away = !!st.bonus;
    if (bo.away && bo.charge) { bo.charge.orb.removeFromParent(); bo.charge.lanes.forEach(l => l.removeFromParent()); bo.charge = null; }
    if (!bo.charge) bo.t += dt * (bo.rage ? 1.6 : 1); // заряжаясь, НЛО замирает: видно, откуда полетит веер
    bo.x = lab.lerp(bo.x, Math.sin(bo.t * 0.55) * 10, k);
    bo.z = lab.lerp(bo.z, -10.5 - Math.sin(bo.t * 1.1) * 0.8, k);
    bo.y = lab.lerp(bo.y, bo.away ? 16 : 3, 1 - Math.exp(-dt * 2));
    bo.kick *= Math.exp(-dt * 10); // реакция на попадание: отлетает назад и запрокидывается
    m.position.set(bo.x, bo.y + Math.sin(lab.t * 2.5) * 0.25, bo.z - bo.kick);
    m.rotation.x = bo.kick * 0.5; m.rotation.y += dt * (bo.rage ? 7 : 3);
    const hp = bo.hp / bo.max;
    bo.back.position.set(bo.x, m.position.y + 1.8, bo.z);
    bo.bar.scale.x = Math.max(0.01, hp); bo.bar.position.set(bo.x - 1.5 * (1 - hp), m.position.y + 1.8, bo.z + 0.05);
    bo.burn -= dt; // подбитое НЛО горит ещё полсекунды, раненое в ярости — дымит всё время
    if (bo.burn > 0 || (bo.rage && lab.chance(dt * 12))) lab.burst(m, { count: 2, colors: ['#ff7a2f', '#ffd23f', '#3a3a48'], speed: 1.5, size: 0.35, life: 0.45, gravity: -2 });
    if (bo.away || bo.y > 4) return;
    // атака: заряд с честным предупреждением → веер
    bo.fireT -= dt;
    if (!bo.charge && bo.fireT <= 0) {
      const n = Math.round(cfg.bossFan) + (bo.rage ? 2 : 0), aim = Math.atan2(c.x - bo.x, c.z - bo.z);
      const dirs = [];
      for (let i = 0; i < n; i++) { const a = aim + (i - (n - 1) / 2) * 0.22; if (Math.cos(a) > 0.35) dirs.push([Math.sin(a), Math.cos(a)]); }
      const orb = lab.mesh(st.geo.core, '#fff3a0', { glow: 1.6, shadow: false });
      bo.charge = { t: cfg.telegraph + 0.4, total: cfg.telegraph + 0.4, dirs, lanes: dirs.map(() => this.makeLane(lab, '#ffd23f')), orb };
      lab.sfx.warn(); lab.tone(200, cfg.telegraph + 0.4, 'sawtooth', 0.04, 700);
    }
    const ch = bo.charge;
    if (!ch) return;
    const p = m.position;
    ch.dirs.forEach(([dx, dz], i) => this.placeLane(ch.lanes[i], p.x, p.z, dx, dz, this.PLAYER_Z + 1));
    ch.orb.position.set(p.x, p.y - 0.7, p.z + 0.6); ch.orb.scale.setScalar(0.2 + 0.7 * (1 - ch.t / ch.total));
    lab.burst(ch.orb, { count: 1, colors: ['#ffd23f', '#ffffff'], speed: 2, size: 0.15, life: 0.3, gravity: 0 });
    if ((ch.t -= dt) > 0) return;
    ch.dirs.forEach(([dx, dz], i) => this.addBomb(lab, p.x, p.z + 0.6, dx, dz, ch.lanes[i], '#ffd23f', 0.38, 0.85));
    ch.orb.removeFromParent(); bo.charge = null; bo.fireT = cfg.fireEvery * (bo.rage ? 1.2 : 1.8);
    lab.sfx.shoot(); lab.noise(0.2, 0.12, 2500); lab.pulse(m, 1.25, 0.18);
  },
  hitBoss(lab, at) {
    const st = lab.state, bo = st.boss;
    if (!bo) return;
    bo.hp--; bo.kick = 0.7; bo.burn = 0.5;
    lab.whiten(bo.g, 0.07); // вспышка: враг на миг белеет
    this.impact(lab, at, ['#ffd23f', '#fff3a0', '#ffffff']);
    this.hit(lab); this.points(lab, 10, at, '#ffd23f');
    lab.hitstop(0.03); lab.shake(0.15);
    if (bo.hp <= 0) return this.killBoss(lab);
    if (!bo.rage && bo.hp <= bo.max / 2) { bo.rage = true; lab.popup(bo.g, 'В ярости!', '#ff6a3d', 26); lab.sfx.warn(); }
  },
  killBoss(lab) {
    const st = lab.state, bo = st.boss, pos = bo.g.position.clone();
    lab.hitstop(0.14); lab.flash('#ffd23f', 0.5); lab.shake(0.8); lab.sfx.explode(); lab.sfx.power(); lab.slowmo(0.5, 0.35);
    lab.burst(pos, { count: 50, colors: ['#ffd23f', '#fff3a0', '#ffffff', '#ff7a2f'], speed: 12, size: 0.3, life: 0.8 });
    lab.burst(pos, { count: 20, colors: ['#ffd23f'], speed: 14, dir: [0, 0.3, -1] });
    lab.burst(pos, { count: 26, colors: ['#ffd23f', '#ffe9a0', '#c98a16'], speed: 7, size: 0.26, life: 1.2, gravity: 13, up: 7 }); // золотые монетки
    lab.ring([pos.x, 0.05, pos.z], { color: '#ffd23f', radius: 6, life: 0.6 });
    this.points(lab, 300, lab.v3(pos.x, pos.y + 1, pos.z), '#ffd23f');
    if (lab.lives < 9) { lab.lives++; lab.popup(st.gun.g, '+1 жизнь', '#7cf5a8', 26); }
    if (bo.charge) { bo.charge.orb.removeFromParent(); bo.charge.lanes.forEach(l => l.removeFromParent()); }
    bo.back.removeFromParent(); bo.bar.removeFromParent();
    // золотое НЛО падает кувырком и оставляет большое пятно
    const fall = { vy: 2, spin: lab.rand(-5, 5) };
    lab.tween(1.2, (k, raw) => {
      fall.vy -= 14 * lab.dt; bo.g.position.y = Math.max(0.3, bo.g.position.y + fall.vy * lab.dt); bo.g.rotation.z += fall.spin * lab.dt;
      if (raw >= 1) { lab.burst(bo.g, { count: 30, colors: ['#ff7a2f', '#ffd23f', '#5a4a3a'], speed: 8, up: 3 }); this.scorch(lab, bo.g.position.x, bo.g.position.z, 2); bo.g.removeFromParent(); lab.shake(0.4); lab.sfx.explode(); }
    }, 'linear');
    st.cam.punch = 1;
    st.boss = null; st.bossT = lab.cfg.bossAt * 2; st.bossKills++; lab.count('золотые НЛО');
  },
};
