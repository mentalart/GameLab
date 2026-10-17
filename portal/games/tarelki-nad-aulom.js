// «Тарелки над аулом» — ремейк-донор урока 1 по мотивам механики Space Invaders.
// Образец контракта GAME для Qwen: игра целиком на обычном Babylon.js + объект lab оболочки.
// Секрет донора: волна ускоряется с каждым сбитым — ручка «Секрет: ускорение от числа сбитых».
const GAME = {
  title: 'Тарелки над аулом',
  subtitle: 'Волна летающих тарелок спускается к аулу. Сбей всех, пока они не сели на крыши.',
  donor: 'Space Invaders',
  players: 1,
  controls: [
    { input: 'move', text: 'катить пушку' },
    { input: 'a', text: 'выстрел' },
  ],
  camera: { type: 'iso', beta: 1.1, target: [0, 0, -4] }, // чуть ниже обычного «iso»: видно и горы, и аул
  field: { w: 28, h: 30 },
  sky: '#162038',
  fog: 0.008,
  accent: '#ffe08a',
  decisions: [
    'Чувство: напряжение растёт к концу волны, а последняя тарелка несётся как сумасшедшая',
    'Честность: перед выстрелом под тарелкой загорается луч, а путь бомбы виден на земле',
    'Выбор: прятаться за стогом или выйти и стрелять, пока стог ещё цел',
  ],
  config: {
    baseStep: { value: 0.7, min: 0.15, max: 1.5, step: 0.05, label: 'Шаг волны в начале, с' },
    speedup: { value: 1, min: 0, max: 1, step: 0.05, label: 'Секрет: ускорение от числа сбитых', hint: '0 — волна не ускоряется, 1 — как в оригинале' },
    stepDown: { value: 0.9, min: 0.3, max: 2, step: 0.1, label: 'Шаг вниз у края, м' },
    fireEvery: { value: 1.4, min: 0.3, max: 4, step: 0.1, label: 'Тарелки стреляют раз в, с' },
    telegraph: { value: 0.5, min: 0, max: 1.2, step: 0.05, label: 'Предупреждение перед выстрелом, с' },
    bombSpeed: { value: 7, min: 2, max: 16, step: 0.5, label: 'Скорость бомб' },
    playerSpeed: { value: 11, min: 4, max: 20, step: 0.5, label: 'Скорость пушки' },
    bulletSpeed: { value: 26, min: 10, max: 50, step: 1, label: 'Скорость выстрела' },
    maxShots: { value: 1, min: 1, max: 5, step: 1, label: 'Выстрелов в воздухе' },
    rows: { value: 5, min: 1, max: 6, step: 1, label: 'Рядов тарелок', restart: true },
    cols: { value: 10, min: 3, max: 12, step: 1, label: 'Тарелок в ряду', restart: true },
    shields: { value: 4, min: 0, max: 5, step: 1, label: 'Стогов-укрытий', restart: true },
    lives: { value: 3, min: 1, max: 9, step: 1, label: 'Жизни', restart: true },
  },
  presets: {
    'Новичок': { baseStep: 0.95, fireEvery: 2.2, telegraph: 0.8, bombSpeed: 5.5, rows: 4, lives: 5 },
    'Без секрета': { speedup: 0 },
    'Безумие': { baseStep: 0.35, fireEvery: 0.6, telegraph: 0.3, bombSpeed: 11, maxShots: 3 },
  },

  LINE_Z: -9.2, // линия аула: если тарелка дошла сюда — партия проиграна

  // ---------- новая партия: строим мир, состояние кладём в lab.state ----------
  start(lab, scene) {
    const B = BABYLON, st = lab.state;
    st.edge = 12; st.playerZ = -11; st.lineZ = this.LINE_Z; st.shieldZ = -7.4;
    st.rowColors = ['#5fe0ff', '#7cf5a8', '#ffd23f', '#ff6ad5', '#9a7bff', '#ff8a3d'];
    st.wave = 1; st.waveMul = 1; st.shots = 0; st.hits = 0; st.shieldTime = 0; st.closest = 99;
    st.bullets = []; st.bombs = []; st.charges = []; st.mystery = null; st.mysteryT = lab.rand(14, 24);
    st.fireT = 2; st.note = 0; st.cool = 0; st.lastWarned = false;

    // земля, поле, горы, лес, аул, луна и звёзды
    lab.ground({ w: 140, h: 140, color: '#2a5a35' });
    const field = B.MeshBuilder.CreateGround('поле', { width: 26, height: 28 }, scene);
    field.position.set(0, 0.01, 0); field.material = lab.mat('#336b3e'); lab.noShadow(field);
    this.scenery(lab, scene);

    // пушка
    const cannon = new B.TransformNode('пушка', scene);
    const add = (mesh, color, o) => { mesh.material = lab.mat(color, o); mesh.parent = cannon; return mesh; };
    add(B.MeshBuilder.CreateBox('лафет', { width: 1.5, height: 0.45, depth: 1.1 }, scene), '#c0392b').position.y = 0.45;
    add(B.MeshBuilder.CreateBox('башня', { width: 0.8, height: 0.45, depth: 0.7 }, scene), '#e9e4d8').position.set(0, 0.85, -0.05);
    const barrel = add(B.MeshBuilder.CreateCylinder('ствол', { height: 1.0, diameter: 0.24, tessellation: 8 }, scene), '#2b2f3a');
    barrel.rotation.x = Math.PI / 2; barrel.position.set(0, 0.88, 0.55);
    add(B.MeshBuilder.CreateBox('огонёк', { size: 0.16 }, scene), '#ffe08a', { glow: 1 }).position.set(0, 1.12, -0.05);
    for (const x of [-0.62, 0.62]) for (const z of [-0.32, 0.32]) {
      const w = add(B.MeshBuilder.CreateCylinder('колесо', { height: 0.18, diameter: 0.5, tessellation: 8 }, scene), '#1c1f27');
      w.rotation.z = Math.PI / 2; w.position.set(x, 0.25, z);
    }
    cannon.position.set(0, 0, st.playerZ);
    st.cannon = cannon; st.barrel = barrel;

    this.buildShields(lab, scene);
    this.buildWave(lab, scene);
    lab.hud('wave', 'Волна 1');
  },

  // ---------- каждый кадр ----------
  update(lab, dt) {
    const st = lab.state, cfg = lab.cfg, p = lab.p1;
    // пушка
    const c = st.cannon;
    c.position.x = lab.clamp(c.position.x + p.x * cfg.playerSpeed * dt, -st.edge, st.edge);
    c.rotation.z = lab.lerp(c.rotation.z, -p.x * 0.08, 1 - Math.exp(-dt * 10));
    c.getChildMeshes().forEach(m => { m.isVisible = !lab.blink(); });
    st.cool -= dt;
    if (p.pressed.a && st.bullets.length < cfg.maxShots && st.cool <= 0) this.shoot(lab);
    if (this.underShield(lab, c.position.x)) st.shieldTime += dt;

    this.moveWave(lab, dt);
    this.moveBullets(lab, dt);
    this.enemyFire(lab, dt);
    this.moveBombs(lab, dt);
    this.moveMystery(lab, dt);

    lab.stat('под стогом, %', Math.round(100 * st.shieldTime / Math.max(0.1, lab.t)));
    lab.hud('left', 'Тарелок: ' + st.alive);
  },

  overNote(lab) {
    const st = lab.state, notes = [];
    const acc = st.shots ? Math.round(100 * st.hits / st.shots) : 0;
    notes.push(`Точность: ${acc}% (${st.hits} из ${st.shots}). Волна: ${st.wave}`);
    notes.push(`Под стогами ты провёл ${Math.round(100 * st.shieldTime / Math.max(0.1, lab.t))}% времени`);
    if (st.closest < 99) notes.push(`Ближе всего тарелки подошли к аулу на ${Math.max(0, st.closest).toFixed(1)} м`);
    if (lab.cfg.speedup === 0) notes.push('Секрет выключен: волна не ускорялась. Заметил разницу?');
    return notes;
  },

  // ---------- мир вокруг поля ----------
  // Повторяющиеся предметы (горы, ёлки, дома, колья плетня) — один исходный меш и копии createInstance:
  // копии рисуются одним вызовом, игра летает даже на слабом школьном компьютере.
  scenery(lab, scene) {
    const B = BABYLON;
    const source = (mesh, color, o) => { mesh.material = lab.mat(color, o); mesh.isVisible = false; return mesh; };
    const cone = (name, color) => {
      const m = B.MeshBuilder.CreateCylinder(name, { height: 1, diameterTop: 0, diameterBottom: 1, tessellation: 6 }, scene);
      m.convertToFlatShadedMesh(); return source(m, color);
    };
    // горы на горизонте, как Фишт за аулом: тень не отбрасывают, чтобы не растягивать карту теней
    const rock = lab.noShadow(cone('гора', '#56637f')), snow = lab.noShadow(cone('снег', '#eef3ff'));
    [[-34, 62, 26, 13], [-10, 70, 36, 17], [16, 64, 26, 13], [40, 58, 20, 10], [2, 54, 15, 8]].forEach(([x, z, h, r]) => {
      const a = lab.rand(0, 1);
      const m = rock.createInstance('гора'); m.scaling.set(r * 2, h, r * 2); m.position.set(x, h / 2 - 0.5, z); m.rotation.y = a;
      const c = snow.createInstance('снег'); c.scaling.set(r * 0.62, h * 0.28, r * 0.62); c.position.set(x, h * 0.86 - 0.5, z); c.rotation.y = a;
    });
    // ёлки по краям поля
    const trunk = B.MeshBuilder.CreateCylinder('ствол', { height: 0.7, diameter: 0.3, tessellation: 5 }, scene);
    source(trunk, '#5a3d2b');
    const crowns = ['#1f5a3a', '#25683f', '#2f7a46'].map(c => cone('крона', c));
    for (let i = 0; i < 28; i++) {
      const side = i % 2 ? 1 : -1, x = side * lab.rand(15, 24), z = lab.rand(-17, 20), h = lab.rand(1.8, 3.6);
      trunk.createInstance('ствол').position.set(x, 0.35, z);
      const cr = lab.pick(crowns).createInstance('крона');
      cr.scaling.set(h * 0.7, h, h * 0.7); cr.position.set(x, 0.7 + h / 2, z); cr.rotation.y = lab.rand(0, 3);
    }
    // аул: дом собран из частей в один меш (MergeMeshes), дальше — копии
    const parts = [];
    const walls = B.MeshBuilder.CreateBox('стены', { width: 2.3, height: 1.6, depth: 1.8 }, scene);
    walls.position.y = 0.8; walls.material = lab.mat('#efe2c4'); parts.push(walls);
    const roof = B.MeshBuilder.CreateCylinder('крыша', { height: 1.1, diameterTop: 0, diameterBottom: 3.0, tessellation: 4 }, scene);
    roof.rotation.y = Math.PI / 4; roof.position.y = 2.15; roof.material = lab.mat('#b8402e'); parts.push(roof);
    for (const wx of [-0.55, 0.55]) {
      const win = B.MeshBuilder.CreateBox('окно', { width: 0.45, height: 0.42, depth: 0.05 }, scene);
      win.position.set(wx, 0.95, 0.92); win.material = lab.mat('#ffcf6a', { glow: 0.9 }); parts.push(win);
    }
    const house = B.Mesh.MergeMeshes(parts, true, true, undefined, false, true); // multiMaterial: цвета частей сохраняются
    house.name = 'дом'; house.isVisible = false;
    [-11, -6.5, -2, 2.5, 7, 11.5].forEach(x => {
      const h = house.createInstance('дом');
      h.position.set(x + lab.rand(-0.4, 0.4), 0, -16 + lab.rand(-0.6, 0.6)); h.rotation.y = Math.PI + lab.rand(-0.2, 0.2);
    });
    // плетень — граница аула. «Видно = правда»: тарелка, дошедшая до плетня, садится на аул
    const post = source(B.MeshBuilder.CreateBox('кол', { width: 0.14, height: 0.8, depth: 0.14 }, scene), '#7a5232');
    for (let x = -12.5; x <= 12.5; x += 1.25) post.createInstance('кол').position.set(x, 0.4, this.LINE_Z - 0.4);
    for (const y of [0.3, 0.6]) {
      const rail = B.MeshBuilder.CreateBox('жердь', { width: 25.2, height: 0.08, depth: 0.08 }, scene);
      rail.position.set(0, y, this.LINE_Z - 0.4); rail.material = lab.mat('#8f6440');
    }
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

  // ---------- волна тарелок ----------
  makeSaucer(lab, scene, color, name, scale = 1) {
    const B = BABYLON;
    const parts = [];
    const body = B.MeshBuilder.CreateCylinder(name, { height: 0.3, diameterTop: 1.1, diameterBottom: 1.6, tessellation: 10 }, scene);
    body.material = lab.mat('#c9cfdc', { shiny: true }); parts.push(body);
    const rim = B.MeshBuilder.CreateCylinder(name, { height: 0.12, diameter: 1.8, tessellation: 10 }, scene);
    rim.position.y = -0.1; rim.material = lab.mat('#8a93a8'); parts.push(rim);
    const dome = B.MeshBuilder.CreateSphere(name, { diameter: 0.85, segments: 4, slice: 0.5 }, scene);
    dome.position.y = 0.12; dome.material = lab.mat(color, { glow: 0.35 }); parts.push(dome);
    for (let i = 0; i < 6; i++) {
      const a = i / 6 * Math.PI * 2, l = B.MeshBuilder.CreateBox(name, { size: 0.16 }, scene);
      l.position.set(Math.cos(a) * 0.86, -0.1, Math.sin(a) * 0.86); l.material = lab.mat(color, { glow: 1 }); parts.push(l);
    }
    parts.forEach(m => m.convertToFlatShadedMesh());
    const merged = B.Mesh.MergeMeshes(parts, true, true, undefined, false, true);
    merged.name = name; merged.scaling.setAll(scale);
    return merged;
  },
  buildWave(lab, scene) {
    const st = lab.state, cfg = lab.cfg;
    (st.saucers || []).forEach(s => s.mesh.dispose());
    st.templates = st.templates || {};
    const rows = Math.round(cfg.rows), cols = Math.round(cfg.cols);
    const startZ = 4 - Math.min(st.wave - 1, 4) * 1.0;
    st.saucers = []; st.ox = 0; st.oz = 0; st.dir = 1; st.stepT = 0.6;
    for (let r = 0; r < rows; r++) {
      const color = st.rowColors[r % st.rowColors.length];
      if (!st.templates[color]) { const t = this.makeSaucer(lab, scene, color, 'тарелка'); t.isVisible = false; st.templates[color] = t; }
      for (let c = 0; c < cols; c++) {
        const mesh = st.templates[color].createInstance('тарелка');
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
      lab.lives = 0; lab.gameOver('Тарелки сели на аул');
    }
  },

  // ---------- выстрелы пушки ----------
  shoot(lab) {
    const B = BABYLON, st = lab.state;
    const m = B.MeshBuilder.CreateCapsule('снаряд', { radius: 0.12, height: 0.6, tessellation: 6 }, lab.scene);
    m.rotation.x = Math.PI / 2; m.material = lab.mat('#fff3a0', { glow: 1 }); lab.noShadow(m);
    m.position.set(st.cannon.position.x, 0.9, st.playerZ + 1.1);
    st.bullets.push(m); st.shots++; st.cool = 0.12; lab.count('выстрелы');
    lab.sfx.shoot(); lab.pulse(st.barrel, 1.35, 0.12);
  },
  moveBullets(lab, dt) {
    const st = lab.state, cfg = lab.cfg;
    st.bullets = st.bullets.filter(b => {
      b.position.z += cfg.bulletSpeed * dt;
      if (b.position.z > 15) { b.dispose(); return false; }
      if (this.hitShield(lab, b.position.x, b.position.z)) { b.dispose(); return false; }
      for (const bomb of st.bombs) {
        if (Math.abs(bomb.position.x - b.position.x) < 0.45 && Math.abs(bomb.position.z - b.position.z) < 0.6) {
          bomb.metadata.dead = true; lab.burst(b.position, { count: 10, colors: ['#ffffff', '#ff4d5e'], speed: 5 });
          lab.addScore(5, b.position); b.dispose(); return false;
        }
      }
      for (const s of st.saucers) {
        if (!s.alive) continue;
        if (Math.abs(s.mesh.position.x - b.position.x) < 1.0 && Math.abs(s.mesh.position.z - b.position.z) < 0.75) { // как видно: тарелка 2 м в ширину
          this.killSaucer(lab, s); b.dispose(); return false;
        }
      }
      const my = st.mystery;
      if (my && Math.abs(my.mesh.position.x - b.position.x) < 1.4 && Math.abs(my.mesh.position.z - b.position.z) < 0.9) {
        const pts = lab.pick([50, 100, 150, 300]);
        lab.addScore(pts, my.mesh.position, '#ffd23f');
        lab.burst(my.mesh.position, { count: 40, colors: ['#ffd23f', '#fff3a0', '#ffffff'], speed: 9 });
        lab.sfx.power(); lab.shake(0.5); lab.hitstop(0.08);
        my.mesh.dispose(); st.mystery = null; st.mysteryT = lab.rand(18, 30); st.hits++; lab.count('золотые тарелки');
        b.dispose(); return false;
      }
      return true;
    });
  },
  killSaucer(lab, s) {
    const st = lab.state;
    s.alive = false; st.alive--; st.hits++; lab.count('сбито');
    const pos = s.mesh.position.clone();
    lab.burst(pos, { count: 18, colors: [st.rowColors[s.row % st.rowColors.length], '#ffffff', '#c9cfdc'], speed: 7 });
    lab.addScore(s.points, pos);
    lab.noise(0.18, 0.18, 1800); lab.tone(420, 0.12, 'square', 0.06, 120);
    lab.shake(0.18); lab.hitstop(0.025);
    s.mesh.dispose();
    st.charges = st.charges.filter(ch => { if (ch.s === s) { ch.dispose(); return false; } return true; });
    if (st.alive === 1 && !st.lastWarned) {
      st.lastWarned = true;
      const last = st.saucers.find(x => x.alive);
      lab.popup(last.mesh.position, 'Последняя!', '#ff6ad5', 22); lab.tone(1200, 0.25, 'sawtooth', 0.06, 1800);
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

  // ---------- выстрелы тарелок: сначала честное предупреждение, потом бомба ----------
  enemyFire(lab, dt) {
    const B = BABYLON, st = lab.state, cfg = lab.cfg;
    st.fireT -= dt;
    if (st.fireT <= 0 && st.alive > 0 && st.bombs.length + st.charges.length < 2 + st.wave) {
      st.fireT = cfg.fireEvery * st.waveMul * lab.rand(0.7, 1.3);
      // стреляет передняя тарелка случайного столбца, чаще — над пушкой
      const fronts = {};
      for (const s of st.saucers) if (s.alive && (!fronts[s.col] || s.bz < fronts[s.col].bz)) fronts[s.col] = s;
      let list = Object.values(fronts);
      if (lab.chance(0.45)) list.sort((a, b) => Math.abs(a.mesh.position.x - st.cannon.position.x) - Math.abs(b.mesh.position.x - st.cannon.position.x));
      const s = lab.chance(0.45) ? list[0] : lab.pick(list);
      const lane = B.MeshBuilder.CreateBox('путь бомбы', { width: 0.5, height: 0.02, depth: 1 }, lab.scene);
      lane.material = lab.mat('#ff4d5e', { unlit: true, alpha: 0.28 }); lab.noShadow(lane);
      const beam = B.MeshBuilder.CreateCylinder('луч', { height: 1.3, diameterTop: 0.2, diameterBottom: 1.0, tessellation: 8 }, lab.scene);
      beam.material = lab.mat('#ff4d5e', { unlit: true, alpha: 0.45 }); lab.noShadow(beam);
      const ch = { s, t: cfg.telegraph, lane, beam, dispose() { lane.dispose(); beam.dispose(); } };
      st.charges.push(ch);
      if (cfg.telegraph > 0.05) lab.sfx.warn();
    }
    st.charges = st.charges.filter(ch => {
      if (!ch.s.alive) { ch.dispose(); return false; }
      const p = ch.s.mesh.position;
      this.placeLane(ch.lane, p.x, p.z, st.playerZ - 1);
      ch.beam.position.set(p.x, p.y - 0.7, p.z);
      ch.t -= dt;
      if (ch.t > 0) return true;
      const bomb = BABYLON.MeshBuilder.CreatePolyhedron('бомба', { type: 1, size: 0.28 }, lab.scene);
      bomb.material = lab.mat('#ff4d5e', { glow: 1 });
      bomb.position.set(p.x, 0.9, p.z - 0.6);
      bomb.metadata = { lane: ch.lane, dead: false };
      ch.beam.dispose();
      st.bombs.push(bomb);
      return false;
    });
  },
  placeLane(lane, x, fromZ, toZ) {
    const len = Math.max(0.1, fromZ - toZ);
    lane.scaling.z = len; lane.position.set(x, 0.03, (fromZ + toZ) / 2);
  },
  moveBombs(lab, dt) {
    const st = lab.state, cfg = lab.cfg, c = st.cannon.position;
    st.bombs = st.bombs.filter(b => {
      const done = () => { b.metadata.lane.dispose(); b.dispose(); return false; };
      if (b.metadata.dead) return done();
      b.position.z -= cfg.bombSpeed * dt;
      b.rotation.y += dt * 6; b.rotation.x += dt * 4;
      this.placeLane(b.metadata.lane, b.position.x, b.position.z, st.playerZ - 1);
      if (this.hitShield(lab, b.position.x, b.position.z)) return done();
      if (Math.abs(b.position.x - c.x) < 0.85 && Math.abs(b.position.z - c.z) < 0.6) { lab.count('попадания по пушке'); lab.hurt(b.position, 'Пушку подбили'); return done(); }
      if (b.position.z < st.playerZ - 1.5) { lab.burst(b.position, { count: 6, colors: ['#ff4d5e', '#5a3d2b'], speed: 3 }); return done(); }
      return true;
    });
  },

  // ---------- золотая тарелка-бонус ----------
  moveMystery(lab, dt) {
    const st = lab.state;
    if (!st.mystery) {
      st.mysteryT -= dt;
      if (st.mysteryT <= 0 && st.alive > 3) {
        const dir = lab.chance(0.5) ? 1 : -1;
        const mesh = this.makeSaucer(lab, lab.scene, '#ffd23f', 'золотая тарелка', 1.5);
        mesh.position.set(-dir * 17, 2.6, 13.5);
        st.mystery = { mesh, dir };
        lab.tone(700, 0.4, 'sine', 0.05, 900);
      }
      return;
    }
    const m = st.mystery.mesh;
    m.position.x += st.mystery.dir * 5 * dt; m.rotation.y += dt * 3;
    if (Math.abs(m.position.x) > 18) { m.dispose(); st.mystery = null; st.mysteryT = lab.rand(18, 30); }
  },
};
