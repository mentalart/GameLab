// «НЛО в станице» — ремейк-донор урока 1 по мотивам механики Space Invaders.
// Образец контракта GAME для Qwen: игра целиком на обычном Babylon.js + объект lab оболочки.
// Секрет донора: волна ускоряется с каждым сбитым — ручка «Секрет: ускорение от числа сбитых».
// Выстрел собран по правилам стреляющего героя: заряд, ядро, след, искры сквозь врага, реакция врага, звук, последствия, очки.
// Золотое НЛО — сильный враг со своей атакой: заряжается и бьёт веером, путь каждого снаряда виден заранее.
const GAME = {
  title: 'НЛО в станице',
  subtitle: 'Волна НЛО спускается к станице. Сбей всех, пока они не сели на крыши хат.',
  donor: 'Space Invaders',
  players: 1,
  controls: [
    { input: 'move', text: 'катить пушку' },
    { input: 'a', text: 'выстрел' },
  ],
  camera: { type: 'iso', beta: 1.1, target: [0, 0, -4] }, // чуть ниже обычного «iso»: видно и горы, и станицу
  field: { w: 28, h: 30 },
  accent: '#ffe08a',
  decisions: [
    'Чувство: напряжение растёт к концу волны, последнее НЛО несётся как сумасшедшее, а золотое НЛО — маленький бой с боссом',
    'Честность: перед выстрелом под НЛО загорается луч, а путь снаряда виден на земле',
    'Выбор: прятаться за стогом или выйти и стрелять, пока стог ещё цел',
  ],
  config: {
    baseStep: { value: 0.7, min: 0.15, max: 1.5, step: 0.05, label: 'Шаг волны в начале, с' },
    speedup: { value: 1, min: 0, max: 1, step: 0.05, label: 'Секрет: ускорение от числа сбитых', hint: '0 — волна не ускоряется, 1 — как в оригинале' },
    stepDown: { value: 0.9, min: 0.3, max: 2, step: 0.1, label: 'Шаг вниз у края, м' },
    fireEvery: { value: 1.4, min: 0.3, max: 4, step: 0.1, label: 'НЛО стреляют раз в, с' },
    telegraph: { value: 0.5, min: 0, max: 1.2, step: 0.05, label: 'Предупреждение перед выстрелом, с' },
    bombSpeed: { value: 7, min: 2, max: 16, step: 0.5, label: 'Скорость снарядов НЛО' },
    playerSpeed: { value: 11, min: 4, max: 20, step: 0.5, label: 'Скорость пушки' },
    fireRate: { value: 2.5, min: 0.5, max: 6, step: 0.1, label: 'Скорострельность, выстрелов в секунду' },
    bulletSpeed: { value: 26, min: 10, max: 50, step: 1, label: 'Скорость выстрела' },
    combo: { value: 5, min: 0, max: 20, step: 1, label: 'Попаданий подряд до множителя очков', hint: '0 — без серии; промах обнуляет серию' },
    rows: { value: 3, min: 1, max: 6, step: 1, label: 'Рядов НЛО в первой волне', hint: 'каждая следующая волна на ряд больше', restart: true },
    cols: { value: 8, min: 3, max: 12, step: 1, label: 'НЛО в ряду', restart: true },
    shields: { value: 4, min: 0, max: 5, step: 1, label: 'Стогов-укрытий', restart: true },
    lives: { value: 3, min: 1, max: 9, step: 1, label: 'Жизни', restart: true },
    bossAt: { value: 12, min: 3, max: 60, step: 1, label: 'Золотое НЛО прилетает через, с' },
    bossHP: { value: 10, min: 1, max: 30, step: 1, label: 'Золотое НЛО: попаданий до победы' },
    bossFan: { value: 3, min: 1, max: 7, step: 1, label: 'Золотое НЛО: снарядов в веере', hint: 'в ярости — на два больше' },
  },
  presets: {
    'Новичок': { baseStep: 0.95, fireEvery: 2.2, telegraph: 0.8, bombSpeed: 5.5, rows: 2, lives: 5, bossHP: 6 },
    'Без секрета': { speedup: 0 },
    'Безумие': { baseStep: 0.35, fireEvery: 0.6, telegraph: 0.3, bombSpeed: 11, fireRate: 5, bossFan: 7, bossAt: 5 },
  },

  LINE_Z: -9.2, // линия станицы: если НЛО дошло сюда — партия проиграна

  // ---------- новая партия: строим мир, состояние кладём в lab.state ----------
  start(lab, scene) {
    const B = BABYLON, st = lab.state;
    st.edge = 12; st.playerZ = -11; st.lineZ = this.LINE_Z; st.shieldZ = -7.4;
    st.rowColors = ['#5fe0ff', '#7cf5a8', '#ffd23f', '#ff6ad5', '#9a7bff', '#ff8a3d'];
    st.wave = 1; st.waveMul = 1; st.shots = 0; st.hits = 0; st.shieldTime = 0; st.closest = 99;
    st.bullets = []; st.bombs = []; st.charges = []; st.wrecks = []; st.scorches = [];
    st.boss = null; st.bossT = lab.cfg.bossAt; st.bossKills = 0; st.combo = 0; st.bestCombo = 0;
    st.fireT = 2; st.note = 0; st.reload = 0; st.want = 0; st.lastWarned = false;

    // ночная станица: стиль задаёт свет, небо и гамму, мир — готовые детали и свои
    lab.style({ mood: 'ночь', shape: 'круглый', wear: 'старое', wind: 0.8, palette: { земля: '#2f6a3a', листва: '#25683f', стена: '#f4efe4', крыша: '#c9a24a', ткань: '#3b6fd1', свет: '#ffcf6a', акцент: '#ffd23f' } });
    this.scenery(lab, scene);

    // пушка; огонёк заряда на конце ствола разгорается к концу перезарядки
    const cannon = new B.TransformNode('пушка', scene);
    const add = (mesh, color, o) => { mesh.material = lab.mat(color, o); mesh.parent = cannon; return mesh; };
    lab.build('лафет', [['box', [1.5, 0.45, 1.1], [0, 0.45, 0], 0, '#c0392b'], ['box', [0.8, 0.45, 0.7], [0, 0.85, -0.05], 0, '#e9e4d8'],
      ...[-0.62, 0.62].flatMap(x => [-0.32, 0.32].map(z => ['cyl', [0.5, 0.18, 0.5], [x, 0.25, z], [0, 0, Math.PI / 2], '#1c1f27']))]).copy([0, 0, 0], 0, 1, cannon);
    const barrel = add(B.MeshBuilder.CreateCylinder('ствол', { height: 1.0, diameter: 0.24, tessellation: 8 }, scene), '#2b2f3a');
    barrel.rotation.x = Math.PI / 2; barrel.position.set(0, 0.88, 0.55);
    st.charge = add(B.MeshBuilder.CreateSphere('заряд', { diameter: 0.34, segments: 6 }, scene), '#ffb347', { glow: 1 });
    st.charge.position.set(0, 0.88, 1.1); lab.noShadow(st.charge);
    cannon.position.set(0, 0, st.playerZ);
    st.cannon = cannon; st.barrel = barrel; lab.hero(cannon);

    // исходники для копий: снаряд пушки (горячее ядро + огненный хвост) и выжженное пятно
    const core = B.MeshBuilder.CreateSphere('ядро', { diameter: 0.36, segments: 6 }, scene);
    core.material = lab.mat('#fff3a0', { glow: 1 });
    const tail = B.MeshBuilder.CreateCylinder('хвост', { height: 1.5, diameterTop: 0.3, diameterBottom: 0, tessellation: 6 }, scene);
    tail.rotation.x = Math.PI / 2; tail.position.z = -0.8; tail.material = lab.mat('#ff9a3d', { glow: 1, alpha: 0.6 });
    st.shotSrc = lab.noShadow(B.Mesh.MergeMeshes([core, tail], true, true, undefined, false, true));
    st.shotSrc.isVisible = false;
    st.scorchSrc = lab.noShadow(B.MeshBuilder.CreateDisc('пятно', { radius: 1, tessellation: 10 }, scene));
    st.scorchSrc.rotation.x = Math.PI / 2; st.scorchSrc.material = lab.mat('#1d1a16', { unlit: true, alpha: 0.75 }); st.scorchSrc.isVisible = false;

    this.buildShields(lab, scene);
    this.buildWave(lab, scene);
    lab.hud('wave', 'Волна 1');
  },

  // ---------- каждый кадр ----------
  update(lab, dt) {
    const st = lab.state, cfg = lab.cfg, p = lab.p1;
    st.mill.rotation.z += dt * 0.8;
    // пушка
    const c = st.cannon;
    c.position.x = lab.clamp(c.position.x + p.x * cfg.playerSpeed * dt, -st.edge, st.edge);
    c.position.z = lab.lerp(c.position.z, st.playerZ, 1 - Math.exp(-dt * 14)); // отдача гаснет
    c.rotation.z = lab.lerp(c.rotation.z, -p.x * 0.08, 1 - Math.exp(-dt * 10));
    c.getChildMeshes().forEach(m => { m.isVisible = !lab.blink(); });
    // нажатие во время перезарядки не теряется: выстрел уйдёт, как только пушка готова
    st.reload -= dt; st.want = p.pressed.a ? 0.18 : st.want - dt;
    if (st.want > 0 && st.reload <= 0) this.shoot(lab);
    st.charge.scaling.setAll(0.3 + 0.9 * (1 - lab.clamp(st.reload * cfg.fireRate, 0, 1)));
    if (this.underShield(lab, c.position.x)) st.shieldTime += dt;

    this.moveWave(lab, dt);
    this.moveBullets(lab, dt);
    this.enemyFire(lab, dt);
    this.moveBombs(lab, dt);
    this.moveBoss(lab, dt);
    this.moveWrecks(lab, dt);

    lab.stat('под стогом, %', Math.round(100 * st.shieldTime / Math.max(0.1, lab.t)));
    lab.hud('left', 'НЛО: ' + st.alive);
    const mult = this.mult(lab);
    lab.hud('combo', st.combo >= 2 ? `Серия ${st.combo}` + (mult > 1 ? ` · очки ×${mult}` : '') : null);
  },

  overNote(lab) {
    const st = lab.state, notes = [];
    const acc = st.shots ? Math.round(100 * st.hits / st.shots) : 0;
    notes.push(`Точность: ${acc}% (${st.hits} из ${st.shots}), лучшая серия — ${st.bestCombo}. Волна: ${st.wave}`);
    notes.push(`Под стогами ты провёл ${Math.round(100 * st.shieldTime / Math.max(0.1, lab.t))}% времени`);
    if (st.bossKills) notes.push(`Золотых НЛО сбито: ${st.bossKills}`);
    else if (st.boss) notes.push(`Золотое НЛО выдержало ${st.boss.max - st.boss.hp} попаданий из ${st.boss.max}`);
    else if (st.closest < 99) notes.push(`Ближе всего НЛО подошли к станице на ${Math.max(0, st.closest).toFixed(1)} м`);
    if (lab.cfg.speedup === 0) notes.push('Секрет выключен: волна не ускорялась. Заметил разницу?');
    return notes;
  },

  // ---------- мир вокруг поля ----------
  // Мир на готовых деталях оболочки: стиль ночи, газон, горы, ели, хаты, подсолнухи и плетень из библиотеки.
  // Свои детали — пушка, тарелки НЛО и ветряк-ориентир за станицей.
  scenery(lab, scene) {
    const st = lab.state;
    lab.floor({ type: 'газон с тропой', w: 26, h: 28 });
    lab.backdrop({ type: 'горы', layers: 2 });
    const hata = lab.prop('хата', { v: 1 });
    [-11, -6.5, -2, 2.5, 7, 11.5].forEach(x => hata.copy([x + lab.rand(-0.4, 0.4), 0, -16 + lab.rand(-0.6, 0.6)], Math.PI + lab.rand(-0.2, 0.2)));
    const flower = lab.prop('подсолнух', { h: 1.5 });
    for (let x = -12; x <= 12; x += 1.7) flower.copy([x + lab.rand(-0.3, 0.3), 0, this.LINE_Z - 1.1], Math.PI);
    // плетень — граница станицы. «Видно = правда»: НЛО, дошедшее до плетня, садится на станицу
    const fence = lab.prop('плетень', { v: 0 });
    for (let x = -11.5; x <= 11.5; x += 3) fence.copy([x, 0, this.LINE_Z - 0.4]);
    // ориентир: ветряк за станицей, крылья крутятся в update
    lab.build('ветряк', [['cyl', [2.6, 5, 2.6], [0, 2.5, 0], 0, 'стена', { top: 0.7 }], ['cone', [2.6, 1.6, 2.6], [0, 5.8, 0], 0, 'крыша'],
      ['box', [0.7, 1.1, 0.1], [0, 0.55, 1.15], 0, 'дерево'], ['box', [0.5, 0.5, 0.1], [0, 3.2, 1.0], 0, 'окно']]).copy([16, 0, 9], -0.6);
    st.mill = new BABYLON.TransformNode('крылья ветряка', scene); st.mill.position.set(15.25, 5.2, 9.9); st.mill.rotation.y = -0.6;
    lab.build('крылья', [0, 1, 2, 3].map(i => ['box', [0.5, 3.4, 0.06], [Math.sin(i * Math.PI / 2) * 1.7, Math.cos(i * Math.PI / 2) * 1.7, 0], [0, 0, -i * Math.PI / 2], 'ткань']).concat([['cyl', [0.4, 0.3, 0.4], [0, 0, 0], [Math.PI / 2, 0, 0], 'дерево']])).copy([0, 0, 0], 0, 1, st.mill);
    lab.scatter('ель', { n: 40, area: 'вокруг' }); // после хат и ветряка: россыпь их обходит
    lab.ambient('светлячки', { n: 30 });
  },

  // ---------- стога-укрытия из блоков сена ----------
  buildShields(lab, scene) {
    const B = BABYLON, st = lab.state;
    (st.shieldCells || []).forEach(cell => cell.blocks.forEach(b => b.dispose()));
    st.shieldCells = []; st.shieldXs = [];
    const n = Math.round(lab.cfg.shields);
    if (!n) return;
    if (!st.hay) {
      st.hay = B.MeshBuilder.CreateBox('сено', { size: 0.58 }, scene);
      st.hay.material = lab.mat('#d9b44a'); st.hay.isVisible = false; // исходник для копий
    }
    for (let s = 0; s < n; s++) {
      const cx = n === 1 ? 0 : -9 + 18 * s / (n - 1);
      st.shieldXs.push(cx);
      for (let i = -2; i <= 2; i++) for (const dz of [-0.3, 0.3]) {
        const cell = { x: cx + i * 0.6, z: st.shieldZ + dz, blocks: [] };
        const height = Math.abs(i) === 2 ? 2 : 3;
        for (let h = 0; h < height; h++) {
          const b = st.hay.createInstance('сено');
          b.position.set(cell.x, 0.3 + h * 0.58, cell.z);
          b.rotation.y = lab.rand(-0.08, 0.08);
          cell.blocks.push(b);
        }
        st.shieldCells.push(cell);
      }
    }
  },
  underShield(lab, x) { return lab.state.shieldCells.some(c => c.blocks.length && Math.abs(c.x - x) < 0.45); },
  hitShield(lab, x, z, r = 0.35) {
    const st = lab.state;
    for (const cell of st.shieldCells) {
      if (cell.blocks.length && Math.abs(cell.x - x) < r && Math.abs(cell.z - z) < 0.35) {
        const b = cell.blocks.pop();
        lab.burst(b.position, { count: 8, colors: ['#d9b44a', '#f1d27a', '#a87d2c'], speed: 4, size: 0.18 });
        b.dispose();
        return true;
      }
    }
    return false;
  },

  // ---------- волна НЛО ----------
  makeSaucer(lab, scene, color, name, scale = 1) {
    const lights = [0, 1, 2, 3, 4, 5].map(i => ['box', [0.16, 0.16, 0.16], [Math.cos(i / 6 * Math.PI * 2) * 0.86, -0.1, Math.sin(i / 6 * Math.PI * 2) * 0.86], 0, color, { glow: 1 }]);
    const m = lab.build(name, [['cyl', [1.6, 0.3, 1.6], [0, 0, 0], 0, '#c9cfdc', { top: 0.69, shiny: 1 }], ['cyl', [1.8, 0.12, 1.8], [0, -0.1, 0], 0, '#8a93a8'],
      ['hemi', [0.85, 0.42, 0.85], [0, 0.12, 0], 0, color, { glow: 0.35 }], ...lights]).mesh;
    m.isVisible = true; m.scaling.setAll(scale);
    return m;
  },
  buildWave(lab, scene) {
    const st = lab.state, cfg = lab.cfg;
    (st.saucers || []).forEach(s => { if (s.alive) s.mesh.dispose(); }); // сбитые ещё падают: их удалит moveWrecks
    st.templates = st.templates || {};
    const rows = Math.min(6, Math.round(cfg.rows) + st.wave - 1), cols = Math.round(cfg.cols);
    const startZ = 4 - Math.min(st.wave - 1, 4) * 1.0;
    st.saucers = []; st.ox = 0; st.oz = 0; st.dir = 1; st.stepT = 0.6;
    for (let r = 0; r < rows; r++) {
      const color = st.rowColors[r % st.rowColors.length];
      if (!st.templates[color]) { const t = this.makeSaucer(lab, scene, color, 'НЛО'); t.isVisible = false; st.templates[color] = t; }
      for (let c = 0; c < cols; c++) {
        const mesh = st.templates[color].createInstance('НЛО');
        const bx = (c - (cols - 1) / 2) * 2.1, bz = startZ + r * 2.0;
        mesh.position.set(bx, 1.4, bz); mesh.scaling.setAll(1.1);
        st.saucers.push({ mesh, bx, bz, row: r, col: c, alive: true, phase: lab.rand(0, 6.28), points: [10, 10, 20, 20, 30, 30][r] || 30 });
      }
    }
    st.total = st.saucers.length; st.alive = st.total; st.lastWarned = false;
  },
  moveWave(lab, dt) {
    const st = lab.state, cfg = lab.cfg;
    const frac = Math.max(st.alive, 1) / st.total;
    const interval = Math.max(0.045, cfg.baseStep * st.waveMul * ((1 - cfg.speedup) + cfg.speedup * frac));
    st.stepT -= dt;
    while (st.stepT <= 0) {
      st.stepT += interval;
      let minX = 1e9, maxX = -1e9;
      for (const s of st.saucers) if (s.alive) { minX = Math.min(minX, s.bx + st.ox); maxX = Math.max(maxX, s.bx + st.ox); }
      const step = 0.5;
      if ((st.dir > 0 && maxX + step > st.edge) || (st.dir < 0 && minX - step < -st.edge)) { st.oz -= cfg.stepDown; st.dir = -st.dir; }
      else st.ox += st.dir * step;
      lab.tone([98, 87, 82, 73][st.note++ % 4], 0.09, 'triangle', 0.22);
    }
    const k = 1 - Math.exp(-dt * 25);
    let minZ = 1e9;
    for (const s of st.saucers) {
      if (!s.alive) continue;
      const m = s.mesh;
      m.position.x = lab.lerp(m.position.x, s.bx + st.ox, k);
      m.position.z = lab.lerp(m.position.z, s.bz + st.oz, k);
      m.position.y = 1.4 + Math.sin(lab.t * 3 + s.phase) * 0.12;
      m.rotation.y += dt * 1.6;
      minZ = Math.min(minZ, m.position.z);
      if (Math.abs(m.position.z - st.shieldZ) < 0.8) this.hitShield(lab, m.position.x, m.position.z, 1.0);
    }
    st.closest = Math.min(st.closest, minZ - st.lineZ);
    if (minZ <= st.lineZ) {
      lab.shake(1); lab.flash('#ff4d5e', 0.5); lab.sfx.explode();
      lab.lives = 0; lab.gameOver('НЛО сели на станицу');
    }
  },

  // ---------- выстрел пушки: заряд → ядро с огненным хвостом → искры сквозь врага ----------
  shoot(lab) {
    const st = lab.state, c = st.cannon.position;
    const m = st.shotSrc.createInstance('снаряд');
    m.position.set(c.x, 0.9, c.z + 1.3); m.scaling.setAll(0.5);
    st.bullets.push({ mesh: m, age: 0 }); st.shots++; st.reload = 1 / lab.cfg.fireRate; st.want = 0; lab.count('выстрелы');
    lab.burst(m.position, { count: 8, colors: ['#fff3a0', '#ffb347'], speed: 5, size: 0.16, life: 0.18, gravity: 0, dir: [0, 0.3, 1] });
    st.cannon.position.z -= 0.3; // отдача
    lab.sfx.shoot(); lab.tone(150, 0.07, 'sine', 0.1, 60); lab.pulse(st.barrel, 1.35, 0.12);
  },
  moveBullets(lab, dt) {
    const st = lab.state, cfg = lab.cfg;
    st.bullets = st.bullets.filter(bl => {
      const b = bl.mesh, p = b.position;
      const gone = miss => { if (miss) st.combo = 0; b.dispose(); return false; };
      p.z += cfg.bulletSpeed * dt; bl.age += dt;
      b.scaling.setAll(Math.min(1.15, 0.5 + bl.age * 5)); // ядро разгорается в полёте
      lab.burst(p, { count: 1, colors: ['#ffb347', '#fff3a0'], speed: 1, size: 0.14, life: 0.25, gravity: 0 });
      if (p.z > 15) return gone(true);
      if (this.hitShield(lab, p.x, p.z)) return gone(true);
      for (const bomb of st.bombs) {
        if (Math.abs(bomb.position.x - p.x) < 0.45 && Math.abs(bomb.position.z - p.z) < 0.6) {
          bomb.metadata.dead = true; this.impact(lab, p, ['#ffffff', '#ff4d5e']);
          this.hit(lab); this.points(lab, 5, p); return gone(false);
        }
      }
      for (const s of st.saucers) {
        if (!s.alive) continue;
        if (Math.abs(s.mesh.position.x - p.x) < 1.0 && Math.abs(s.mesh.position.z - p.z) < 0.75) { // как видно: НЛО 2 м в ширину
          this.killSaucer(lab, s); return gone(false);
        }
      }
      const bo = st.boss;
      if (bo && Math.abs(bo.mesh.position.x - p.x) < 2.0 && Math.abs(bo.mesh.position.z - p.z) < 1.3) {
        this.hitBoss(lab, p.clone()); return gone(false);
      }
      return true;
    });
  },
  // взрыв попадания: вспышка, искры летят дальше по направлению выстрела (сквозь врага), глухой «бум»
  impact(lab, at, colors) {
    lab.burst(at, { count: 14, colors, speed: 9, size: 0.2, life: 0.4, gravity: 4, dir: [0, 0.3, 1] });
    lab.burst(at, { count: 5, colors: ['#ffffff'], speed: 3, size: 0.5, life: 0.12, gravity: 0 });
    lab.noise(0.16, 0.18, 1400); lab.tone(170, 0.14, 'sine', 0.14, 50);
  },
  // серия попаданий без промаха: каждые cfg.combo попаданий множитель очков растёт, цифры становятся крупнее
  mult(lab) { return lab.cfg.combo > 0 ? Math.min(5, 1 + Math.floor(lab.state.combo / lab.cfg.combo)) : 1; },
  hit(lab) {
    const st = lab.state;
    st.hits++; st.combo++; st.bestCombo = Math.max(st.bestCombo, st.combo);
    lab.tone(480 + 30 * Math.min(st.combo, 20), 0.05, 'square', 0.035);
    if (lab.cfg.combo > 0 && st.combo % lab.cfg.combo === 0 && st.combo <= 4 * lab.cfg.combo) {
      lab.popup(st.cannon.position, 'Серия ×' + this.mult(lab) + '!', '#7cf5a8', 24); lab.sfx.coin();
    }
  },
  points(lab, n, at, color) {
    const k = this.mult(lab);
    lab.addScore(n * k);
    lab.popup(at, '+' + n * k + (k > 1 ? ' ×' + k : ''), color || '#ffe08a', 16 + 5 * k);
  },
  killSaucer(lab, s) {
    const st = lab.state;
    s.alive = false; st.alive--; lab.count('сбито');
    if (lab.cfg.speedup > 0 && st.alive > 0) lab.count('_secret'); // секрет сработал: волна стала быстрее (скрытый счётчик для урока)
    const pos = s.mesh.position.clone();
    this.impact(lab, pos, [st.rowColors[s.row % st.rowColors.length], '#ffffff', '#ffd23f']);
    this.hit(lab); this.points(lab, s.points, pos);
    lab.shake(0.2); lab.hitstop(0.035);
    this.wreck(lab, s.mesh, 1);
    st.charges = st.charges.filter(ch => { if (ch.s === s) { ch.dispose(); return false; } return true; });
    if (st.alive === 1 && !st.lastWarned) {
      st.lastWarned = true;
      const last = st.saucers.find(x => x.alive);
      lab.popup(last.mesh.position, 'Последнее!', '#ff6ad5', 22); lab.tone(1200, 0.25, 'sawtooth', 0.06, 1800);
    }
    if (st.alive === 0) this.nextWave(lab);
  },
  nextWave(lab) {
    const st = lab.state;
    st.wave++; st.waveMul *= 0.88;
    lab.count('волны');
    lab.sfx.win(); lab.flash('#7cf5a8', 0.25);
    lab.popup(lab.v3(0, 3, 4), 'Волна ' + st.wave, '#7cf5a8', 28);
    st.bombs.forEach(b => { b.metadata.lane.dispose(); b.dispose(); }); st.bombs = [];
    st.charges.forEach(ch => ch.dispose()); st.charges = [];
    this.buildShields(lab, lab.scene);
    this.buildWave(lab, lab.scene);
    lab.hud('wave', 'Волна ' + st.wave);
  },

  // ---------- последствия: сбитое НЛО горит, кувыркается, падает и оставляет выжженное пятно ----------
  wreck(lab, mesh, size) { lab.state.wrecks.push({ mesh, size, vy: 2.5, spin: lab.rand(-7, 7), smoke: 0 }); },
  moveWrecks(lab, dt) {
    const st = lab.state;
    st.wrecks = st.wrecks.filter(w => {
      const m = w.mesh, p = m.position;
      w.vy -= 14 * dt; p.y += w.vy * dt; p.z += 2 * dt;
      m.rotation.z += w.spin * dt; m.rotation.x += 3 * dt;
      w.smoke -= dt;
      if (w.smoke <= 0) { w.smoke = 0.04; lab.burst(p, { count: 2 * w.size, colors: ['#ff7a2f', '#ffd23f', '#3a3a48'], speed: 1.2, size: 0.3 * w.size, life: 0.4, gravity: -2 }); }
      if (p.y > 0.3) return true;
      lab.burst(p, { count: 14 * w.size, colors: ['#ff7a2f', '#ffd23f', '#5a4a3a'], speed: 6, up: 3 });
      lab.noise(0.25, 0.1 * w.size, 600); lab.shake(0.12 * w.size);
      this.hitShield(lab, p.x, p.z, 0.9); // упало на стог — стог горит
      const sc = st.scorchSrc.createInstance('пятно');
      sc.position.set(p.x, 0.03, p.z); sc.scaling.setAll(0.9 * w.size);
      st.scorches.push(sc);
      if (st.scorches.length > 12) st.scorches.shift().dispose();
      m.dispose(); return false;
    });
  },

  // ---------- выстрелы НЛО: сначала честное предупреждение, потом снаряд ----------
  enemyFire(lab, dt) {
    const st = lab.state, cfg = lab.cfg;
    st.fireT -= dt;
    if (st.fireT <= 0 && st.alive > 0 && st.bombs.length + st.charges.length < 2 + st.wave) {
      st.fireT = cfg.fireEvery * st.waveMul * lab.rand(0.7, 1.3);
      // стреляет переднее НЛО случайного столбца, чаще — над пушкой
      const fronts = {};
      for (const s of st.saucers) if (s.alive && (!fronts[s.col] || s.bz < fronts[s.col].bz)) fronts[s.col] = s;
      let list = Object.values(fronts);
      if (lab.chance(0.45)) list.sort((a, b) => Math.abs(a.mesh.position.x - st.cannon.position.x) - Math.abs(b.mesh.position.x - st.cannon.position.x));
      const s = lab.chance(0.45) ? list[0] : lab.pick(list);
      const lane = this.makeLane(lab, '#ff4d5e');
      const beam = BABYLON.MeshBuilder.CreateCylinder('луч', { height: 1.3, diameterTop: 0.2, diameterBottom: 1.0, tessellation: 8 }, lab.scene);
      beam.material = lab.mat('#ff4d5e', { unlit: true, alpha: 0.45 }); lab.noShadow(beam);
      const ch = { s, t: cfg.telegraph, lane, beam, dispose() { lane.dispose(); beam.dispose(); } };
      st.charges.push(ch);
      if (cfg.telegraph > 0.05) lab.sfx.warn();
    }
    st.charges = st.charges.filter(ch => {
      if (!ch.s.alive) { ch.dispose(); return false; }
      const p = ch.s.mesh.position;
      this.placeLane(ch.lane, p.x, p.z, 0, -1, st.playerZ - 1);
      ch.beam.position.set(p.x, p.y - 0.7, p.z);
      ch.t -= dt;
      if (ch.t > 0) return true;
      ch.beam.dispose();
      this.addBomb(lab, p.x, p.z - 0.6, 0, -1, ch.lane, '#ff4d5e', 0.28);
      return false;
    });
  },
  makeLane(lab, color) {
    const lane = BABYLON.MeshBuilder.CreateBox('путь снаряда', { width: 0.5, height: 0.02, depth: 1 }, lab.scene);
    lane.material = lab.mat(color, { unlit: true, alpha: 0.28 }); return lab.noShadow(lane);
  },
  // путь снаряда на земле от (x, z) по направлению (dx, dz) до линии toZ
  placeLane(lane, x, z, dx, dz, toZ) {
    const t = Math.max(0.1, (z - toZ) / Math.max(0.2, -dz)), ex = x + dx * t, ez = z + dz * t;
    lane.scaling.z = Math.hypot(ex - x, ez - z); lane.rotation.y = Math.atan2(ex - x, ez - z);
    lane.position.set((x + ex) / 2, 0.03, (z + ez) / 2);
  },
  addBomb(lab, x, z, dx, dz, lane, color, size, k = 1) {
    const bomb = BABYLON.MeshBuilder.CreatePolyhedron('снаряд НЛО', { type: 1, size }, lab.scene);
    bomb.material = lab.mat(color, { glow: 1 });
    bomb.position.set(x, 0.9, z);
    bomb.metadata = { lane, dx, dz, k, dead: false };
    lab.state.bombs.push(bomb);
  },
  moveBombs(lab, dt) {
    const st = lab.state, cfg = lab.cfg, c = st.cannon.position;
    st.bombs = st.bombs.filter(b => {
      const d = b.metadata, done = () => { d.lane.dispose(); b.dispose(); return false; };
      if (d.dead) return done();
      const v = cfg.bombSpeed * d.k;
      b.position.x += d.dx * v * dt; b.position.z += d.dz * v * dt;
      b.rotation.y += dt * 6; b.rotation.x += dt * 4;
      this.placeLane(d.lane, b.position.x, b.position.z, d.dx, d.dz, st.playerZ - 1);
      if (this.hitShield(lab, b.position.x, b.position.z)) return done();
      if (Math.abs(b.position.x - c.x) < 0.85 && Math.abs(b.position.z - c.z) < 0.6) {
        lab.count('попадания по пушке'); st.combo = 0; lab.hurt(b.position, 'Пушку подбили'); return done();
      }
      if (b.position.z < st.playerZ - 1.5 || Math.abs(b.position.x) > 16) { lab.burst(b.position, { count: 6, colors: ['#ff4d5e', '#5a3d2b'], speed: 3 }); return done(); }
      return true;
    });
  },

  // ---------- золотое НЛО: сильный враг со своей атакой ----------
  // Летает восьмёркой над волной, держит cfg.bossHP попаданий, заряжается и бьёт веером в сторону пушки.
  // Путь каждого снаряда веера виден на земле, пока НЛО заряжается. На половине прочности — ярость: веер шире и чаще.
  spawnBoss(lab) {
    const B = BABYLON, st = lab.state, cfg = lab.cfg;
    const mesh = this.makeSaucer(lab, lab.scene, '#ffd23f', 'золотое НЛО', 2.2);
    mesh.position.set(0, 3, 18);
    const back = B.MeshBuilder.CreateBox('полоса прочности', { width: 3, height: 0.18, depth: 0.05 }, lab.scene);
    back.material = lab.mat('#2b2f3a'); lab.noShadow(back);
    const bar = B.MeshBuilder.CreateBox('прочность', { width: 3, height: 0.2, depth: 0.08 }, lab.scene);
    bar.material = lab.mat('#ffd23f', { glow: 1 }); lab.noShadow(bar);
    st.boss = { mesh, back, bar, hp: cfg.bossHP, max: cfg.bossHP, t: 0, x: 0, z: 18, kick: 0, burn: 0, fireT: 2.5, charge: null, rage: false };
    lab.popup(lab.v3(0, 4, 10), 'Золотое НЛО!', '#ffd23f', 30); lab.flash('#ffd23f', 0.2);
    lab.tone(300, 0.6, 'sawtooth', 0.06, 900); lab.count('золотое НЛО прилетело');
  },
  moveBoss(lab, dt) {
    const st = lab.state, cfg = lab.cfg, bo = st.boss;
    if (!bo) { st.bossT -= dt; if (st.bossT <= 0 && st.alive > 0) this.spawnBoss(lab); return; }
    const m = bo.mesh, k = 1 - Math.exp(-dt * 3);
    if (!bo.charge) bo.t += dt * (bo.rage ? 1.6 : 1); // заряжаясь, НЛО замирает: видно, откуда полетит веер
    bo.x = lab.lerp(bo.x, Math.sin(bo.t * 0.55) * 10, k);
    bo.z = lab.lerp(bo.z, 12 + Math.sin(bo.t * 1.1) * 0.8, k);
    bo.kick *= Math.exp(-dt * 10); // реакция на попадание: отлетает назад и запрокидывается
    m.position.set(bo.x, 3 + Math.sin(lab.t * 2.5) * 0.25, bo.z + bo.kick);
    m.rotation.x = -bo.kick * 0.5; m.rotation.y += dt * (bo.rage ? 7 : 3);
    const hp = bo.hp / bo.max;
    bo.back.position.set(bo.x, m.position.y + 1.8, bo.z);
    bo.bar.scaling.x = Math.max(0.01, hp); bo.bar.position.set(bo.x - 1.5 * (1 - hp), m.position.y + 1.8, bo.z - 0.05);
    bo.burn -= dt; // подбитое НЛО горит ещё полсекунды, раненое в ярости — дымит всё время
    if (bo.burn > 0 || (bo.rage && lab.chance(dt * 12))) lab.burst(m.position, { count: 2, colors: ['#ff7a2f', '#ffd23f', '#3a3a48'], speed: 1.5, size: 0.35, life: 0.45, gravity: -2 });
    // атака: заряд с честным предупреждением → веер
    bo.fireT -= dt;
    if (!bo.charge && bo.fireT <= 0) {
      const n = Math.round(cfg.bossFan) + (bo.rage ? 2 : 0), aim = Math.atan2(st.cannon.position.x - bo.x, st.cannon.position.z - bo.z);
      const dirs = [];
      for (let i = 0; i < n; i++) { const a = aim + (i - (n - 1) / 2) * 0.22; if (Math.cos(a) < -0.35) dirs.push([Math.sin(a), Math.cos(a)]); }
      const orb = BABYLON.MeshBuilder.CreateSphere('заряд НЛО', { diameter: 1, segments: 6 }, lab.scene);
      orb.material = lab.mat('#fff3a0', { glow: 1 }); lab.noShadow(orb);
      bo.charge = { t: cfg.telegraph + 0.4, total: cfg.telegraph + 0.4, dirs, lanes: dirs.map(() => this.makeLane(lab, '#ffd23f')), orb };
      lab.sfx.warn(); lab.tone(200, cfg.telegraph + 0.4, 'sawtooth', 0.04, 700);
    }
    const ch = bo.charge;
    if (!ch) return;
    const p = m.position;
    ch.dirs.forEach(([dx, dz], i) => this.placeLane(ch.lanes[i], p.x, p.z, dx, dz, st.playerZ - 1));
    ch.orb.position.set(p.x, p.y - 0.7, p.z - 0.6); ch.orb.scaling.setAll(0.2 + 0.9 * (1 - ch.t / ch.total));
    lab.burst(ch.orb.position, { count: 1, colors: ['#ffd23f', '#ffffff'], speed: 2, size: 0.15, life: 0.3, gravity: 0 });
    ch.t -= dt;
    if (ch.t > 0) return;
    ch.dirs.forEach(([dx, dz], i) => this.addBomb(lab, p.x, p.z - 0.6, dx, dz, ch.lanes[i], '#ffd23f', 0.34, 0.85));
    ch.orb.dispose(); bo.charge = null; bo.fireT = cfg.fireEvery * (bo.rage ? 1.2 : 1.8);
    lab.sfx.shoot(); lab.noise(0.2, 0.12, 2500); lab.pulse(m, 1.25, 0.18);
  },
  hitBoss(lab, at) {
    const st = lab.state, bo = st.boss;
    bo.hp--; bo.kick = 0.7; bo.burn = 0.5;
    lab.whiten(bo.mesh, 0.07); // вспышка: враг на миг белеет
    this.impact(lab, at, ['#ffd23f', '#fff3a0', '#ffffff']);
    this.hit(lab); this.points(lab, 10, at, '#ffd23f');
    lab.hitstop(0.03); lab.shake(0.15);
    if (bo.hp <= 0) return this.killBoss(lab);
    if (!bo.rage && bo.hp <= bo.max / 2) { bo.rage = true; lab.popup(bo.mesh.position, 'В ярости!', '#ff6a3d', 26); lab.sfx.warn(); }
  },
  killBoss(lab) {
    const st = lab.state, bo = st.boss, pos = bo.mesh.position.clone();
    lab.hitstop(0.14); lab.flash('#ffd23f', 0.5); lab.shake(0.8); lab.sfx.explode(); lab.sfx.power();
    lab.burst(pos, { count: 50, colors: ['#ffd23f', '#fff3a0', '#ffffff', '#ff7a2f'], speed: 12, size: 0.3, life: 0.8 });
    lab.burst(pos, { count: 20, colors: ['#ffd23f'], speed: 14, dir: [0, 0.3, 1] });
    this.points(lab, 300, lab.v3(pos.x, pos.y + 1, pos.z), '#ffd23f');
    if (lab.lives < 9) { lab.lives++; lab.popup(st.cannon.position, '+1 жизнь', '#7cf5a8', 26); }
    if (bo.charge) { bo.charge.orb.dispose(); bo.charge.lanes.forEach(l => l.dispose()); }
    bo.back.dispose(); bo.bar.dispose();
    this.wreck(lab, bo.mesh, 2);
    st.boss = null; st.bossT = lab.cfg.bossAt * 2; st.bossKills++; lab.count('золотые НЛО');
  },
};
