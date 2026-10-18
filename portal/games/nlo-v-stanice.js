// «НЛО в станице» — ремейк-донор урока 1 по мотивам механики Space Invaders, на оболочке «Лаб3D 1.0» (three.js).
// Спрятанная механика донора: волна ускоряется с каждым сбитым — ручка «Спрятанная механика: ускорение от числа сбитых». Последнее НЛО несётся
// как сумасшедшее, марш-сердцебиение из четырёх нот частит вместе с волной (Space Invaders, 1978).
// Лучшие игры жанра, из которых взяты моменты (разбор — docs/01_Журнал_курса.md, «Урок 1: донор на three.js»):
//   Galaga — НЛО срывается из строя в пике на пушку; сбитое в пике — очки ×2; круг на земле показывает, куда оно летит;
//   Space Invaders Extreme — цепочка одного цвета: четыре НЛО одного ряда подряд — подарок (веер или пробой);
//   Space Invaders — стога-укрытия рассыпаются по блоку, золотое НЛО (тарелка-загадка) — здесь мини-босс с веером.
// Выстрел собран по правилам стреляющего героя: заряд, ядро со следом, отдача, искры сквозь врага, вспышка, звук, последствия, очки.
// Все НЛО — копии одной детали (InstancedMesh): 70 тарелок рисуются за 5 вызовов отрисовки.
// Ось Z в three.js смотрит на игрока: строй НЛО — вдали (−Z), пушка и станица — ближе к нам (+Z).
const GAME = {
  engine: 'three',
  title: 'НЛО в станице',
  subtitle: 'Волна НЛО спускается к станице. Сбей всех, пока они не сели на крыши хат.',
  donor: 'Space Invaders',
  players: 1,
  controls: [
    { input: 'move', text: 'катить пушку' },
    { input: 'a', text: 'выстрел' },
  ],
  camera: { type: 'iso', tilt: 1.13, target: [0, 0, -0.5] }, // ниже обычного «iso»: видно и горы с луной, и станицу
  field: { w: 27, h: 25 },
  shadowSize: 24,
  sky: ['#0b1233', '#5b3f72'],
  fog: 0.009,
  accent: '#ffe08a',
  decisions: [
    'Чувство: напряжение растёт к концу волны, последнее НЛО несётся как сумасшедшее, а золотое НЛО — маленький бой с боссом',
    'Честность: перед выстрелом луч под НЛО краснеет, путь снаряда виден на земле, а перед пике — круг там, куда оно летит',
    'Выбор: прятаться за стогом или выйти под пике; сбивать НЛО одного цвета ради подарка или самое опасное первым',
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
    bulletSpeed: { value: 26, min: 10, max: 50, step: 1, label: 'Скорость выстрела' },
    combo: { value: 5, min: 0, max: 20, step: 1, label: 'Попаданий подряд до множителя очков', hint: '0 — без серии; промах обнуляет серию' },
    diveEvery: { value: 9, min: 0, max: 20, step: 0.5, label: 'НЛО срывается в пике раз в, с', hint: 'как в Galaga; 0 — без пике' },
    diveTime: { value: 1.5, min: 0.6, max: 3, step: 0.1, label: 'Пике длится, с' },
    chain: { value: 4, min: 0, max: 8, step: 1, label: 'Цепочка: НЛО одного цвета подряд до подарка', hint: 'как в Space Invaders Extreme; 0 — без подарков' },
    powerTime: { value: 8, min: 2, max: 20, step: 1, label: 'Подарок действует, с' },
    rows: { value: 3, min: 1, max: 6, step: 1, label: 'Рядов НЛО в первой волне', hint: 'каждая следующая волна на ряд больше', restart: true },
    cols: { value: 8, min: 3, max: 10, step: 1, label: 'НЛО в ряду', restart: true },
    shields: { value: 4, min: 0, max: 5, step: 1, label: 'Стогов-укрытий', restart: true },
    lives: { value: 3, min: 1, max: 9, step: 1, label: 'Жизни', restart: true },
    bossAt: { value: 12, min: 3, max: 60, step: 1, label: 'Золотое НЛО прилетает через, с' },
    bossHP: { value: 10, min: 1, max: 30, step: 1, label: 'Золотое НЛО: попаданий до победы' },
    bossFan: { value: 3, min: 1, max: 7, step: 1, label: 'Золотое НЛО: снарядов в веере', hint: 'в ярости — на два больше' },
  },
  presets: {
    'Новичок': { baseStep: 0.95, fireEvery: 2.2, telegraph: 0.8, bombSpeed: 5.5, rows: 2, lives: 5, bossHP: 6, diveEvery: 10, diveTime: 2.2 },
    'Без спрятанной механики': { speedup: 0 },
    'Классика 1978': { diveEvery: 0, chain: 0, bossAt: 25, bossHP: 1, bossFan: 1 },
    'Безумие': { baseStep: 0.35, fireEvery: 0.6, telegraph: 0.3, bombSpeed: 11, fireRate: 5, bossFan: 7, bossAt: 5, diveEvery: 2.5, diveTime: 1 },
  },

  PLAYER_Z: 11, // ряд пушки
  LINE_Z: 9.2, // плетень станицы: если НЛО дошло сюда — партия проиграна
  SHIELD_Z: 7.4,
  EDGE: 12, // край, до которого катится пушка и шагает строй
  ROWS: [ // цвет ряда, его имя для цепочки и очки (дальние ряды дороже, как в оригинале)
    { color: '#5fe0ff', name: 'голубых', points: 10 }, { color: '#7cf5a8', name: 'зелёных', points: 10 },
    { color: '#ffd23f', name: 'жёлтых', points: 20 }, { color: '#ff6ad5', name: 'розовых', points: 20 },
    { color: '#a98bff', name: 'фиолетовых', points: 30 }, { color: '#ff8a3d', name: 'оранжевых', points: 30 },
  ],
  POOL: 96, // мест в пачке копий НЛО: волна до 72 тарелок и сбитые прошлой волны, которые ещё падают

  // ---------- новая партия: строим мир, состояние кладём в lab.state ----------
  start(lab, scene) {
    const T = lab.THREE, st = lab.state;
    Object.assign(st, {
      wave: 1, waveMul: 1, shots: 0, hits: 0, shieldTime: 0, closest: 99, hurtInWave: false,
      bullets: [], bombs: [], charges: [], caps: [], saucers: [], slots: new Array(this.POOL).fill(null),
      boss: null, bossT: lab.cfg.bossAt, bossKills: 0, combo: 0, bestCombo: 0, fireT: 3.5, note: 0, reload: 0, want: 0,
      lastWarned: false, diveT: 14, dives: 0, diveKills: 0, chainRow: -1, chainN: 0, chains: 0, power: null, powerT: 0, gifts: 0,
      scorchN: 0, geo: { core: new T.IcosahedronGeometry(1, 1), oct: new T.OctahedronGeometry(1), lane: new T.BoxGeometry(1, 0.02, 1) }, tmp: { m: new T.Matrix4(), q: new T.Quaternion(), e: new T.Euler(), s: new T.Vector3(), p: new T.Vector3(), c: new T.Color(), zero: new T.Matrix4().makeScale(0, 0, 0) },
    });
    // ночь над станицей: лунный свет вместо солнца, тёплые окна хат — контраст с холодными лучами НЛО
    lab.light.sun.color.set('#c9d4ff'); lab.light.sun.intensity = 1.5;
    lab.light.hemi.intensity = 1.0;
    this.scenery(lab, scene);
    this.cannon(lab);
    this.saucerParts(lab);
    this.buildShields(lab);
    this.buildWave(lab);
    lab.hud('wave', 'Волна 1');
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
    st.reload -= dt; st.want = p.pressed.a ? 0.18 : st.want - dt;
    if (st.want > 0 && st.reload <= 0) this.shoot(lab);
    const ready = 1 - lab.clamp(st.reload * cfg.fireRate, 0, 1);
    c.charge.scale.setScalar(0.3 + 0.9 * ready); // огонёк на стволе разгорается к концу перезарядки
    if (this.underShield(lab, c.g.position.x)) st.shieldTime += dt;
    if (st.power && (st.powerT -= dt) <= 0) { st.power = null; lab.tone(500, 0.25, 'triangle', 0.06, 200); }
    c.gunner.position.y = Math.abs(Math.sin(lab.t * 9)) * Math.min(0.12, Math.abs(c.vx) * 0.012);

    this.moveWave(lab, dt);
    this.dive(lab, dt);
    this.moveBullets(lab, dt);
    this.enemyFire(lab, dt);
    this.moveBombs(lab, dt);
    this.moveBoss(lab, dt);
    this.moveWrecks(lab, dt);
    this.moveCaps(lab, dt);
    this.drawSaucers(lab, dt);

    lab.stat('под стогом, %', Math.round(100 * st.shieldTime / Math.max(0.1, lab.t)));
    lab.hud('left', 'НЛО: ' + st.alive);
    const mult = this.mult(lab);
    lab.hud('combo', st.combo >= 2 ? `Серия ${st.combo}` + (mult > 1 ? ` · очки ×${mult}` : '') : null);
    const R = this.ROWS[st.chainRow];
    lab.hud('chain', cfg.chain > 0 && R && st.chainN > 0 ? `Цепочка ${R.name}: ${'●'.repeat(st.chainN)}${'○'.repeat(Math.max(0, cfg.chain - st.chainN))}` : null);
    lab.hud('power', st.power ? `${st.power === 'fan' ? 'Веер' : 'Пробой'}: ${Math.ceil(st.powerT)} с` : null);
  },

  overNote(lab) {
    const st = lab.state, notes = [];
    const acc = st.shots ? Math.round(100 * st.hits / st.shots) : 0;
    notes.push(`Точность: ${acc}% (${st.hits} из ${st.shots}), лучшая серия — ${st.bestCombo}. Волна: ${st.wave}`);
    notes.push(`Под стогами ты провёл ${Math.round(100 * st.shieldTime / Math.max(0.1, lab.t))}% времени`);
    if (st.dives) notes.push(`НЛО срывались в пике ${st.dives} раз, сбито в пике: ${st.diveKills}. Цепочек одного цвета: ${st.chains}`);
    if (st.bossKills) notes.push(`Золотых НЛО сбито: ${st.bossKills}`);
    else if (st.boss) notes.push(`Золотое НЛО выдержало ${st.boss.max - st.boss.hp} попаданий из ${st.boss.max}`);
    else if (st.closest < 99) notes.push(`Ближе всего НЛО подошли к станице на ${Math.max(0, st.closest).toFixed(1)} м`);
    if (lab.cfg.speedup === 0) notes.push('Спрятанная механика выключена: волна не ускорялась. Заметил разницу?');
    return notes;
  },

  // ---------- мир: горы, тополя, поле, плетень с подсолнухами, белёные хаты под соломой ----------
  scenery(lab, scene) {
    const T = lab.THREE, Z = this.LINE_Z;
    lab.ground({ w: 160, h: 160, color: '#2f5a35', bumps: 4, flat: 0.3 });
    lab.box(27, 0.05, 30, '#447a3e', { at: [0, 0.025, -3], shadow: false }); // выгон, где идёт бой
    // борозды поперёк поля: по ним видно, сколько осталось НЛО до станицы
    const fur = lab.instances(new T.BoxGeometry(26, 0.06, 0.45), '#52894a', 12, { shadow: false });
    for (let i = 0; i < 12; i++) lab.place(fur, i, [0, 0.06, -16 + i * 2]);
    // горы Кавказа на горизонте со снежными шапками — слиты в один меш на цвет
    const hills = [];
    for (let i = 0; i < 10; i++) {
      const x = -90 + i * 20 + lab.rand(-5, 5), z = -62 - lab.rand(0, 16), r = lab.rand(13, 21), h = lab.rand(20, 36);
      hills.push(lab.cone(r, h, '#33406b', { at: [x, h / 2 - 1, z], sides: 6, rot: lab.rand(0, 3) }));
      hills.push(lab.cone(r * 0.36, h * 0.36, '#eef3ff', { at: [x, h - 1 - h * 0.18 + 0.05, z], sides: 6, rot: lab.rand(0, 3) }));
    }
    lab.noShadow(lab.merge(hills));
    // луна и звёзды
    lab.ball(6, '#fff3c4', { at: [-34, 19, -100], unlit: true, glow: 0.9, detail: 2, shadow: false });
    const pts = [];
    for (let i = 0; i < 360; i++) { const a = lab.rand(0, Math.PI * 2), e = lab.rand(0.12, 1.3); pts.push(Math.cos(a) * Math.cos(e) * 170, Math.sin(e) * 170, Math.sin(a) * Math.cos(e) * 170 - 40); }
    const g = new T.BufferGeometry(); g.setAttribute('position', new T.Float32BufferAttribute(pts, 3));
    scene.add(new T.Points(g, new T.PointsMaterial({ color: '#ffffff', size: 0.9, fog: false })));
    // пирамидальные тополя — копии одного дерева по краям поля и за станицей
    const N = 40, crown = lab.instances(new T.ConeGeometry(1, 1, 7), '#2b5a3a', N), trunk = lab.instances(new T.CylinderGeometry(0.15, 0.22, 1, 5), '#5a3d2b', N);
    for (let i = 0; i < N; i++) {
      let x, z;
      if (i < 24) { x = (i % 2 ? 1 : -1) * lab.rand(17, 36); z = lab.rand(-30, 4); } else { x = lab.rand(-45, 45); z = lab.rand(-50, -36); }
      const h = lab.rand(4, 7);
      lab.place(trunk, i, [x, 0.6, z], { scale: [1, 1.2, 1] });
      lab.place(crown, i, [x, 1.1 + h / 2, z], { scale: [h * 0.24, h, h * 0.24], rot: lab.rand(0, 3), color: lab.pick(['#ffffff', '#d8f0d0', '#c2e0bb']) });
    }
    // плетень — граница станицы. «Видно = правда»: НЛО, дошедшее до плетня, садится на станицу
    const posts = lab.instances(new T.CylinderGeometry(0.06, 0.08, 0.95, 5), '#7a5232', 24);
    for (let i = 0; i < 24; i++) lab.place(posts, i, [-12.6 + i * 1.1, 0.47, Z + 0.4], { rot: lab.rand(-0.1, 0.1) });
    const rails = [];
    for (const y of [0.25, 0.48, 0.71]) rails.push(lab.box(25.6, 0.14, 0.09, '#9a6b42', { at: [0, y, Z + 0.4], rot: [lab.rand(-0.01, 0.01), 0, 0] }));
    lab.merge(rails);
    // подсолнухи у плетня
    const F = 16, stem = lab.instances(new T.CylinderGeometry(0.04, 0.05, 1.3, 4), '#3f8a3a', F);
    const petals = lab.instances(new T.CylinderGeometry(0.3, 0.3, 0.06, 9), '#ffcc22', F), heart = lab.instances(new T.CylinderGeometry(0.15, 0.15, 0.08, 8), '#5a3d2b', F);
    for (let i = 0; i < F; i++) {
      const x = -12.2 + i * 1.62 + lab.rand(-0.2, 0.2), z = Z + 0.95, h = lab.rand(0.9, 1.25);
      lab.place(stem, i, [x, 0.65 * h, z], { scale: [1, h, 1] });
      lab.place(petals, i, [x, 1.3 * h, z + 0.05], { rot: [1.15, 0, 0] });
      lab.place(heart, i, [x, 1.31 * h, z + 0.09], { rot: [1.15, 0, 0] });
    }
    // станица: белёная хата под соломенной крышей, окна светятся тёплым — всё слито в один меш на материал
    const huts = [];
    [[-16.5, 11.5, 1.3], [-19.5, 15, 0.9], [-15, 16, 0.5], [16.5, 11.5, -1.3], [19.5, 15, -0.9], [15, 16, -0.5]].forEach(([x, z, r]) => {
      const h = lab.group({ at: [x, 0, z], rot: Math.PI + r });
      lab.box(2.6, 1.6, 2, '#f4efe4', { parent: h, at: [0, 0.8, 0] });
      lab.box(2.8, 0.18, 2.2, '#8a6a4a', { parent: h, at: [0, 0.09, 0] }); // призба
      lab.cone(2.25, 1.5, '#c9a24a', { parent: h, at: [0, 2.35, 0], sides: 4, rot: Math.PI / 4, scale: [1.05, 1, 0.85] });
      lab.box(0.35, 0.8, 0.35, '#b3a089', { parent: h, at: [0.6, 2.7, 0.2] }); // труба
      for (const wx of [-0.6, 0.6]) {
        lab.box(0.5, 0.48, 0.06, '#ffc65a', { parent: h, at: [wx, 0.95, -1.02], unlit: true, glow: 0.9 });
        lab.box(0.78, 0.56, 0.04, '#3b6fd1', { parent: h, at: [wx, 0.95, -1.01] }); // ставни
      }
      huts.push(h);
    });
    lab.merge(huts);
    // огород между пушкой и нами: только низкое (тыквы и капуста), чтобы ничего не закрывало пушку
    const veg = lab.instances(new T.IcosahedronGeometry(0.32, 1), '#ffffff', 44);
    for (let i = 0; i < 44; i++) {
      const row = i % 4, x = -12 + Math.floor(i / 4) * 2.3 + lab.rand(-0.4, 0.4), pumpkin = (row + Math.floor(i / 4)) % 3 === 0;
      lab.place(veg, i, [x, 0.22, 13 + row * 1.1 + lab.rand(-0.2, 0.2)], { scale: pumpkin ? [1.3, 0.9, 1.3] : [1, 0.85, 1], rot: lab.rand(0, 6), color: pumpkin ? '#ff9a2e' : lab.pick(['#7fcf6a', '#9ad97c', '#6cbf5e']) });
    }
    const beds = [];
    for (let row = 0; row < 4; row++) beds.push(lab.box(25, 0.1, 0.8, '#5a3d2b', { at: [0, 0.05, 13 + row * 1.1], shadow: false }));
    lab.merge(beds);
  },

  // ---------- пушка и казак-наводчик ----------
  cannon(lab) {
    const g = lab.group({ at: [0, 0, this.PLAYER_Z] });
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
    // ствол — латунный, смотрит вдаль (−Z) и чуть вверх
    const barrel = lab.group({ parent: g, at: [0, 0.95, -0.1], rot: [0.12, 0, 0] });
    lab.cyl(0.17, 0.22, 1.4, '#d9a441', { parent: barrel, at: [0, 0, -0.55], rot: [-Math.PI / 2, 0, 0], sides: 10, metal: 0.7, shiny: true });
    lab.cyl(0.24, 0.24, 0.16, '#a87a2c', { parent: barrel, at: [0, 0, -1.2], rot: [-Math.PI / 2, 0, 0], sides: 10, metal: 0.7, shiny: true });
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
    lab.state.gun = { g, barrel, charge, wheels, gunner: gun, body, vx: 0 };
  },

  // ---------- тарелка НЛО: пять деталей, у каждой — пачка копий на все НЛО сразу ----------
  saucerParts(lab) {
    const T = lab.THREE, st = lab.state, n = this.POOL, BGU = lab.addons.BufferGeometryUtils;
    const lights = BGU.mergeGeometries([...Array(8)].map((_, i) => { const a = i / 8 * Math.PI * 2; return new T.BoxGeometry(0.16, 0.12, 0.16).translate(Math.cos(a) * 0.86, -0.08, Math.sin(a) * 0.86); }));
    const beamGeo = new T.ConeGeometry(0.8, 1.35, 14, 1, true).translate(0, -0.78, 0);
    const mk = (geo, m, shadow) => { const im = lab.instances(geo, m, n); im.frustumCulled = false; if (!shadow) lab.noShadow(im); im.setColorAt(0, st.tmp.c.set('#ffffff')); for (let i = 1; i < n; i++) im.setColorAt(i, st.tmp.c); return im; };
    st.parts = {
      body: mk(new T.CylinderGeometry(0.55, 0.82, 0.3, 12), lab.mat('#c9cfdc', { shiny: true, metal: 0.35 }), true),
      rim: mk(new T.CylinderGeometry(0.92, 0.92, 0.1, 12).translate(0, -0.1, 0), lab.mat('#6f7892', { metal: 0.4 }), true),
      dome: mk(new T.SphereGeometry(0.42, 12, 6, 0, Math.PI * 2, 0, Math.PI / 2).translate(0, 0.12, 0), lab.mat('#ffffff', { shiny: true }), true),
      lights: mk(lights, lab.mat('#ffffff', { unlit: true, glow: 1 }), false),
      beam: mk(beamGeo, lab.mat('#ffffff', { unlit: true, add: true, side: 'double' }), false),
    };
  },
  // каждый кадр: место, поворот, сжатие и цвета всех копий
  drawSaucers(lab, dt) {
    const st = lab.state, P = st.parts, t = st.tmp;
    for (let i = 0; i < this.POOL; i++) {
      const s = st.slots[i];
      if (!s) { for (const k in P) P[k].setMatrixAt(i, t.zero); continue; }
      s.flash = Math.max(0, s.flash - dt); s.squash = lab.damp(s.squash, 1, 12, dt);
      const sc = s.scale;
      t.p.set(s.x, s.y, s.z); t.q.setFromEuler(t.e.set(s.rx, s.ry, s.rz)); t.s.set(sc * (2 - s.squash), sc * s.squash, sc * (2 - s.squash));
      t.m.compose(t.p, t.q, t.s);
      for (const k of ['body', 'rim', 'dome', 'lights']) P[k].setMatrixAt(i, t.m);
      // луч под тарелкой: тусклый, пока НЛО спокойно; краснеет и разгорается перед выстрелом; у падающих — гаснет
      const beam = s.wreck ? 0 : s.charging ? 1.3 : s.diveWarn ? 1.1 : 0.55;
      t.q.identity(); t.s.set(sc * beam, sc * (s.wreck ? 0 : 1), sc * beam);
      t.m.compose(t.p, t.q, t.s); P.beam.setMatrixAt(i, t.m);
      const R = this.ROWS[s.row % this.ROWS.length].color, f = s.flash > 0 ? 3 : 1;
      P.body.setColorAt(i, t.c.set(s.wreck ? '#5a5048' : '#ffffff').multiplyScalar(f));
      P.dome.setColorAt(i, t.c.set(s.wreck ? '#3a3036' : R).multiplyScalar(f));
      const blink = s.charging || s.diveWarn ? (Math.sin(lab.t * 40) > 0 ? 1.6 : 0.4) : 1;
      P.lights.setColorAt(i, t.c.set(s.wreck ? '#ff6a2a' : s.charging || s.diveWarn ? '#ff4d5e' : R).multiplyScalar(blink));
      P.beam.setColorAt(i, s.charging ? t.c.set('#ff2f45').multiplyScalar(0.5 + 0.3 * Math.sin(lab.t * 30)) : s.diveWarn ? t.c.set('#ff8a3d').multiplyScalar(0.45) : t.c.set(R).multiplyScalar(0.09));
    }
    for (const k in P) { P[k].instanceMatrix.needsUpdate = true; P[k].instanceColor.needsUpdate = true; }
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

  // ---------- волна НЛО ----------
  buildWave(lab) {
    const st = lab.state, cfg = lab.cfg;
    st.saucers.forEach(s => { if (!s.wreck) st.slots[s.slot] = null; }); // сбитые ещё падают: их место освободит moveWrecks
    const rows = Math.min(6, Math.round(cfg.rows) + st.wave - 1), cols = Math.round(cfg.cols);
    const front = -4 + Math.min(st.wave - 1, 4) * 0.9;
    st.saucers = []; st.ox = 0; st.oz = 0; st.dir = 1; st.stepT = 0.6;
    for (let r = 0; r < rows; r++) for (let c = 0; c < cols; c++) {
      const slot = st.slots.indexOf(null);
      if (slot < 0) break;
      const bx = (c - (cols - 1) / 2) * 2.3, bz = front - r * 2.1;
      // новая волна влетает сверху: каждая тарелка опускается на своё место по очереди
      const s = { slot, bx, bz, row: r, col: c, alive: true, x: bx, y: 9 + r * 0.6, z: bz - 6, rx: 0, ry: lab.rand(0, 6), rz: 0, scale: 1.25, squash: 1, flash: 0, phase: lab.rand(0, 6.28), points: this.ROWS[r].points, arrive: 0.5 + (r * cols + c) * 0.025 };
      st.slots[slot] = s; st.saucers.push(s);
    }
    st.total = st.saucers.length; st.alive = st.total; st.lastWarned = false; st.hurtInWave = false;
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
      if (!s.alive || s.dive) continue;
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
    if (maxZ >= this.LINE_Z) {
      lab.shake(1); lab.flash('#ff4d5e', 0.5); lab.sfx.explode();
      lab.lives = 0; lab.gameOver('НЛО сели на станицу');
    }
  },

  // ---------- пике по мотивам Galaga: НЛО срывается из строя и летит дугой на пушку ----------
  // «Видно = правда»: перед пике тарелка трясётся и мигает, а на земле горит круг — туда, где пушка была в этот миг.
  dive(lab, dt) {
    const st = lab.state, cfg = lab.cfg, c = st.gun.g.position;
    if (cfg.diveEvery > 0 && (st.diveT -= dt) <= 0) {
      st.diveT = cfg.diveEvery * st.waveMul * lab.rand(0.8, 1.2);
      const free = st.saucers.filter(s => s.alive && !s.dive && s.arrive <= 0 && !st.charges.some(ch => ch.s === s));
      if (free.length > 2) {
        const s = lab.chance(0.4) ? free.reduce((a, b) => (Math.abs(b.x - c.x) < Math.abs(a.x - c.x) ? b : a)) : lab.pick(free);
        const tx = lab.clamp(c.x, -this.EDGE, this.EDGE), warnT = 0.7;
        s.dive = { phase: 'warn', t: warnT, tx, side: s.x > tx ? 1 : -1, warn: lab.warn([tx, 0, this.PLAYER_Z], 1.25, warnT + cfg.diveTime, '#ff8a3d') };
        s.diveWarn = true; st.dives++; lab.count('пике');
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
        s.x = nx; s.y = lab.lerp(p0[1], 0.95, Math.min(1, q * 1.2)); s.z = nz;
        lab.burst([s.x, s.y + 0.1, s.z], { count: 1, colors: ['#ff8a3d', '#ffd23f'], speed: 1, size: 0.18, life: 0.3, gravity: 0 });
        if (Math.abs(s.x - c.x) < 1.05 && Math.abs(s.z - c.z) < 0.8 && s.y < 1.8) { // таран: пушку подбили, тарелка разбилась сама
          lab.count('попадания по пушке'); st.combo = 0;
          if (lab.hurt([c.x, 0.8, c.z], 'НЛО протаранило пушку')) st.hurtInWave = true;
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

  // ---------- выстрел пушки: заряд → ядро с огненным хвостом → искры сквозь врага ----------
  shoot(lab) {
    const st = lab.state, cfg = lab.cfg, c = st.gun.g.position;
    const kind = st.power || 'shot', look = { shot: ['#fff3a0', '#ff9a3d'], fan: ['#d9ffe6', '#7cf5a8'], pierce: ['#e6fbff', '#8fe8ff'] }[kind];
    const dirs = kind === 'fan' ? [-0.2, 0, 0.2] : [0];
    dirs.forEach(dx => {
      const m = lab.mesh(st.geo.core, look[0], { at: [c.x, 1.05, c.z - 1.5], glow: 1.6, shadow: false }), r = kind === 'pierce' ? 0.3 : 0.22;
      m.scale.setScalar(r * 0.5);
      st.bullets.push({ m, r, dx, age: 0, main: dx === 0, pierce: kind === 'pierce', hit: false, trail: lab.trail(m, { color: look[1], width: kind === 'pierce' ? 0.5 : 0.36, length: 12 }) });
    });
    st.shots++; st.reload = 1 / cfg.fireRate; st.want = 0; lab.count('выстрелы');
    lab.burst([c.x, 1.05, c.z - 1.5], { count: 10, colors: [look[0], look[1]], speed: 5, size: 0.16, life: 0.18, gravity: 0, dir: [0, 0.3, -1] }); // дульная вспышка
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
      if (!bl.pierce && this.hitShield(lab, p.x, p.z)) return gone(true);
      for (const s of st.saucers) {
        if (!s.alive || s.arrive > 0.3 || s.y > 2.8) continue;
        if (Math.abs(s.x - p.x) < 1.15 && Math.abs(s.z - p.z) < 0.8) { // как видно: тарелка 2,3 м в ширину
          bl.hit = true; this.killSaucer(lab, s);
          if (!bl.pierce) return gone(false);
        }
      }
      const bo = st.boss;
      if (bo && Math.abs(bo.g.position.x - p.x) < 2.0 && Math.abs(bo.g.position.z - p.z) < 1.3) {
        bl.hit = true; this.hitBoss(lab, p.clone()); return gone(false);
      }
      return true;
    });
  },
  // взрыв попадания: вспышка, искры летят дальше по направлению выстрела (сквозь врага), волна, глухой «бум»
  impact(lab, at, colors) {
    lab.burst(at, { count: 16, colors, speed: 9, size: 0.22, life: 0.45, gravity: 4, dir: [0, 0.3, -1] });
    lab.burst(at, { count: 5, colors: ['#ffffff'], speed: 3, size: 0.5, life: 0.12, gravity: 0 });
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
    if (cfg.speedup > 0 && st.alive > 0) lab.count('_secret'); // спрятанная механика сработала: волна стала быстрее (скрытый счётчик для урока)
    if (s.dive && s.dive.warn) s.dive.warn.dispose();
    const diving = !!(s.dive && s.dive.phase === 'dive');
    s.dive = null; s.diveWarn = false; s.charging = false;
    st.charges = st.charges.filter(ch => { if (ch.s === s) { ch.dispose(); return false; } return true; });
    this.impact(lab, at, [R.color, '#ffffff', '#ffd23f']);
    lab.shake(diving ? 0.35 : 0.2); lab.hitstop(diving ? 0.07 : 0.035);
    this.wreck(lab, s);
    if (!o.noScore) {
      this.hit(lab);
      this.points(lab, s.points, at, diving ? '#ff8a3d' : null, diving ? 2 : 1);
      if (diving) { st.diveKills++; lab.count('сбито в пике'); lab.popup([at.x, at.y + 1.2, at.z], 'В пике! ×2', '#ff8a3d', 22); }
      this.chain(lab, s, at);
    }
    if (st.alive === 1 && !st.lastWarned) {
      st.lastWarned = true;
      const last = st.saucers.find(x => x.alive);
      lab.popup([last.x, last.y + 1, last.z], 'Последнее!', '#ff6ad5', 24); lab.tone(1200, 0.25, 'sawtooth', 0.06, 1800);
    }
    if (st.alive === 0) this.nextWave(lab);
  },
  // цепочка по мотивам Space Invaders Extreme: НЛО одного цвета подряд → подарок падает к пушке, его надо поймать
  chain(lab, s, at) {
    const st = lab.state, cfg = lab.cfg;
    if (cfg.chain <= 0) return;
    if (s.row === st.chainRow) st.chainN++; else { st.chainRow = s.row; st.chainN = 1; }
    if (st.chainN < cfg.chain) { if (st.chainN > 1) lab.tone(660 * lab.pitch(st.chainN * 2), 0.08, 'triangle', 0.06); return; }
    st.chainN = 0; st.chains++; lab.count('цепочки');
    const R = this.ROWS[s.row % this.ROWS.length];
    lab.popup([at.x, at.y + 1.6, at.z], 'Цепочка! Лови подарок', R.color, 24);
    lab.ring([at.x, 0.05, at.z], { color: R.color, radius: 3.5, life: 0.5 }); lab.sfx.power();
    const kind = lab.chance(0.5) ? 'fan' : 'pierce', color = kind === 'fan' ? '#7cf5a8' : '#8fe8ff';
    const m = lab.mesh(st.geo.oct, color, { at: [at.x, 1, at.z], glow: 1.5, shiny: true, scale: 0.42, shadow: false });
    const lane = lab.mesh(st.geo.lane, lab.mat(color, { unlit: true, alpha: 0.25 }), { scale: [0.9, 1, 1], shadow: false });
    st.caps.push({ m, lane, kind, color, x: lab.clamp(at.x, -this.EDGE, this.EDGE), z: at.z });
  },
  moveCaps(lab, dt) {
    const st = lab.state, c = st.gun.g.position;
    st.caps = st.caps.filter(cp => {
      cp.z += 6 * dt;
      cp.m.position.set(cp.x, 1 + Math.sin(lab.t * 6) * 0.2, cp.z); cp.m.rotation.y += dt * 4;
      const len = Math.max(0.1, this.PLAYER_Z - cp.z); // дорожка показывает, куда подарок прилетит
      cp.lane.scale.z = len; cp.lane.position.set(cp.x, 0.07, cp.z + len / 2);
      const done = () => { cp.m.removeFromParent(); cp.lane.removeFromParent(); return false; };
      if (Math.abs(cp.x - c.x) < 1.3 && Math.abs(cp.z - c.z) < 0.9) {
        st.power = cp.kind; st.powerT = lab.cfg.powerTime; st.gifts++; lab.count('подарки');
        lab.popup(st.gun.g, cp.kind === 'fan' ? 'Веер!' : 'Пробой!', cp.color, 28);
        lab.burst(cp.m, { count: 26, colors: [cp.color, '#ffffff'], speed: 7, up: 2 }); lab.ring([c.x, 0.05, c.z], { color: cp.color, radius: 3 });
        lab.pulse(st.gun.g, 1.3, 0.2); lab.sfx.power(); lab.flash(cp.color, 0.15);
        return done();
      }
      if (cp.z > this.PLAYER_Z + 2.5) { lab.burst(cp.m, { count: 8, color: '#667788', speed: 2 }); return done(); }
      return true;
    });
  },
  nextWave(lab) {
    const st = lab.state;
    if (!st.hurtInWave) { lab.addScore(100 * st.wave, [0, 3, -2], '#7cf5a8'); lab.popup([0, 4, -2], 'Чистая волна!', '#7cf5a8', 26); }
    st.wave++; st.waveMul *= 0.88;
    lab.count('волны');
    lab.sfx.win(); lab.flash('#7cf5a8', 0.25); lab.slowmo(0.6, 0.3); // последний сбитый — в замедлении
    lab.popup(lab.v3(0, 3, -6), 'Волна ' + st.wave, '#7cf5a8', 30);
    lab.tween(0.5, k => { st.gun.body.position.y = Math.sin(k * Math.PI) * 0.5; }, 'linear'); // наводчик подпрыгивает от радости
    st.bombs.forEach(b => this.dropBomb(b)); st.bombs = [];
    st.charges.forEach(ch => ch.dispose()); st.charges = [];
    this.buildShields(lab);
    this.buildWave(lab);
    lab.hud('wave', 'Волна ' + st.wave);
  },

  // ---------- последствия: сбитое НЛО горит, кувыркается, падает и оставляет выжженное пятно ----------
  wreck(lab, s) { Object.assign(s, { wreck: true, vy: 2.5, spin: lab.rand(-7, 7), smoke: 0, flash: 0.07 }); },
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
      for (const s of st.saucers) if (s.alive && !s.dive && s.arrive <= 0 && (!fronts[s.col] || s.bz > fronts[s.col].bz)) fronts[s.col] = s;
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
      if (!s.alive || s.dive) { ch.dispose(); return false; }
      this.placeLane(ch.lane, s.x, s.z, 0, 1, this.PLAYER_Z + 1);
      if ((ch.t -= dt) > 0) return true;
      s.charging = false;
      this.addBomb(lab, s.x, s.z + 0.6, 0, 1, ch.lane, '#ff4d5e', 0.28);
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
    const m = lab.mesh(lab.state.geo.oct, color, { at: [x, 1.0, z], glow: 1.3, scale: size, shadow: false });
    lab.state.bombs.push({ m, lane, dx, dz, k, dead: false, trail: lab.trail(m, { color, width: size * 1.2, length: 8 }) });
    lab.burst([x, 1, z], { count: 6, colors: [color, '#ffffff'], speed: 3, size: 0.15, life: 0.2, gravity: 0 });
    lab.tone(320, 0.12, 'square', 0.04, 160);
  },
  dropBomb(b) { b.lane.removeFromParent(); b.m.removeFromParent(); },
  moveBombs(lab, dt) {
    const st = lab.state, cfg = lab.cfg, c = st.gun.g.position;
    st.bombs = st.bombs.filter(b => {
      const done = () => { this.dropBomb(b); return false; };
      if (b.dead) return done();
      const v = cfg.bombSpeed * b.k, p = b.m.position;
      p.x += b.dx * v * dt; p.z += b.dz * v * dt;
      b.m.rotation.y += dt * 6; b.m.rotation.x += dt * 4;
      this.placeLane(b.lane, p.x, p.z, b.dx, b.dz, this.PLAYER_Z + 1);
      if (this.hitShield(lab, p.x, p.z)) return done();
      if (Math.abs(p.x - c.x) < 0.85 && Math.abs(p.z - c.z) < 0.7) {
        lab.count('попадания по пушке'); st.combo = 0;
        if (lab.hurt(p.clone(), 'Пушку подбили')) { st.hurtInWave = true; lab.tween(0.35, k => { st.gun.body.rotation.x = Math.sin(k * Math.PI) * -0.6; }, 'linear'); }
        return done();
      }
      if (p.z > this.PLAYER_Z + 1.5 || Math.abs(p.x) > 16) { lab.burst([p.x, 0.3, p.z], { count: 6, colors: ['#ff4d5e', '#5a3d2b'], speed: 3 }); this.scorch(lab, p.x, p.z, 0.4); return done(); }
      return true;
    });
  },

  // ---------- золотое НЛО: сильный враг со своей атакой ----------
  // Летает восьмёркой над волной, держит cfg.bossHP попаданий, заряжается и бьёт веером в сторону пушки.
  // Путь каждого снаряда веера виден на земле, пока НЛО заряжается. На половине прочности — ярость: веер шире и чаще.
  spawnBoss(lab) {
    const st = lab.state, cfg = lab.cfg;
    const g = lab.group({ at: [0, 3, -20], scale: 2.2 });
    lab.cyl(0.55, 0.82, 0.3, '#ffd23f', { parent: g, sides: 12, shiny: true, metal: 0.6 });
    lab.cyl(0.95, 0.95, 0.1, '#b8860b', { parent: g, at: [0, -0.1, 0], sides: 12, metal: 0.5 });
    lab.mesh(new lab.THREE.SphereGeometry(0.42, 12, 6, 0, Math.PI * 2, 0, Math.PI / 2), '#fff3a0', { parent: g, at: [0, 0.12, 0], glow: 0.5, shiny: true });
    for (let i = 0; i < 10; i++) { const a = i / 10 * Math.PI * 2; lab.box(0.15, 0.12, 0.15, '#ffd23f', { parent: g, at: [Math.cos(a) * 0.9, -0.08, Math.sin(a) * 0.9], unlit: true, glow: 1.4, shadow: false }); }
    const back = lab.box(3, 0.2, 0.06, '#2b2f3a', { shadow: false }), bar = lab.box(3, 0.22, 0.1, '#ffd23f', { glow: 1, shadow: false });
    st.boss = { g, back, bar, hp: cfg.bossHP, max: cfg.bossHP, t: 0, x: 0, z: -20, kick: 0, burn: 0, fireT: 2.5, charge: null, rage: false };
    lab.popup(lab.v3(0, 4, -10), 'Золотое НЛО!', '#ffd23f', 30); lab.flash('#ffd23f', 0.2);
    lab.tone(300, 0.6, 'sawtooth', 0.06, 900); lab.count('золотое НЛО прилетело');
  },
  moveBoss(lab, dt) {
    const st = lab.state, cfg = lab.cfg, bo = st.boss, c = st.gun.g.position;
    if (!bo) { st.bossT -= dt; if (st.bossT <= 0 && st.alive > 0) this.spawnBoss(lab); return; }
    const m = bo.g, k = 1 - Math.exp(-dt * 3);
    if (!bo.charge) bo.t += dt * (bo.rage ? 1.6 : 1); // заряжаясь, НЛО замирает: видно, откуда полетит веер
    bo.x = lab.lerp(bo.x, Math.sin(bo.t * 0.55) * 10, k);
    bo.z = lab.lerp(bo.z, -10.5 - Math.sin(bo.t * 1.1) * 0.8, k);
    bo.kick *= Math.exp(-dt * 10); // реакция на попадание: отлетает назад и запрокидывается
    m.position.set(bo.x, 3 + Math.sin(lab.t * 2.5) * 0.25, bo.z - bo.kick);
    m.rotation.x = bo.kick * 0.5; m.rotation.y += dt * (bo.rage ? 7 : 3);
    const hp = bo.hp / bo.max;
    bo.back.position.set(bo.x, m.position.y + 1.8, bo.z);
    bo.bar.scale.x = Math.max(0.01, hp); bo.bar.position.set(bo.x - 1.5 * (1 - hp), m.position.y + 1.8, bo.z + 0.05);
    bo.burn -= dt; // подбитое НЛО горит ещё полсекунды, раненое в ярости — дымит всё время
    if (bo.burn > 0 || (bo.rage && lab.chance(dt * 12))) lab.burst(m, { count: 2, colors: ['#ff7a2f', '#ffd23f', '#3a3a48'], speed: 1.5, size: 0.35, life: 0.45, gravity: -2 });
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
    ch.dirs.forEach(([dx, dz], i) => this.addBomb(lab, p.x, p.z + 0.6, dx, dz, ch.lanes[i], '#ffd23f', 0.34, 0.85));
    ch.orb.removeFromParent(); bo.charge = null; bo.fireT = cfg.fireEvery * (bo.rage ? 1.2 : 1.8);
    lab.sfx.shoot(); lab.noise(0.2, 0.12, 2500); lab.pulse(m, 1.25, 0.18);
  },
  hitBoss(lab, at) {
    const st = lab.state, bo = st.boss;
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
    st.boss = null; st.bossT = lab.cfg.bossAt * 2; st.bossKills++; lab.count('золотые НЛО');
  },
};
