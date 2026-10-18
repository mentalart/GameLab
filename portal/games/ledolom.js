// «Ледолом» — ремейк-донор урока 6 по мотивам Arkanoid и финала Peggle: лопата пекаря отбивает горящий хычин в ледяную стену.
// Секрет донора — сочность (доклад «Juice it or lose it», 2012): стоп-кадр, тряска, сжатие и растяжение, частицы, вспышка,
// звук выше с каждым ударом подряд и замедленный финал на последнем кирпиче. Всё это — 12 переключателей сочности оболочки
// (ручки j_…): пресет «Без секрета» выключает их все, механика остаётся той же.
const GAME = {
  title: 'Ледолом',
  subtitle: 'Лопата пекаря отбивает горящий хычин в ледяную стену пещеры Лаго-Наки. Растопи весь лёд!',
  donor: 'Arkanoid и финала Peggle',
  players: 1,
  duo: 'coop', // ручка coop = 1 — две лопаты, один хычин
  controls: [
    { input: 'move', text: 'двигать лопату' },
    { input: 'a', text: 'запустить хычин' },
  ],
  camera: 'iso', // в start: наклон камеры свой
  field: { w: 20, h: 28 },
  accent: '#ffb347',
  lives: 3,
  decisions: [
    'Чувство: каждый удар отзывается — лёд звенит, хычин сплющивается, экран вздрагивает',
    'Честность: угол отскока зависит от того, куда хычин попал по лопате',
    'Выбор: ловить хычин краем лопаты для острого угла или серединой — надёжно',
  ],
  config: {
    speed: { value: 10, min: 5, max: 18, step: 0.5, label: 'Скорость хычина' },
    speedup: { value: 0.18, min: 0, max: 0.6, step: 0.02, label: 'Разгон за каждый кирпич' },
    maxSpeed: { value: 17, min: 8, max: 26, step: 1, label: 'Предельная скорость' },
    paddle: { value: 3.4, min: 1.5, max: 7, step: 0.1, label: 'Ширина лопаты' },
    move: { value: 18, min: 6, max: 30, step: 1, label: 'Скорость лопаты' },
    angle: { value: 62, min: 20, max: 80, step: 2, label: 'Самый острый угол отскока, °' },
    rows: { value: 6, min: 2, max: 8, step: 1, label: 'Рядов льда', restart: true },
    tough: { value: 1, min: 0, max: 3, step: 1, label: 'Рядов многолетнего льда (два удара)', restart: true },
    finale: { value: 1, min: 0, max: 1, step: 1, label: 'Финал на последнем кирпиче', hint: 'замедление, барабанная дробь, салют' },
    coop: { value: 0, min: 0, max: 1, step: 1, label: 'Вдвоём: две лопаты', restart: true },
  },
  presets: {
    'Новичок': { speed: 8, speedup: 0.08, paddle: 5, maxSpeed: 13 },
    'Без секрета': { j_hitstop: 0, j_shake: 0, j_squash: 0, j_burst: 0, j_flash: 0, j_whiten: 0, j_popup: 0, j_sound: 0, j_pitch: 0, j_vibrate: 0, j_glow: 0, j_slowmo: 0, finale: 0 },
    'Вдвоём': { coop: 1 },
    'Ураган': { speed: 15, speedup: 0.4, maxSpeed: 24 },
  },

  W: 8.2, TOP: 11.2, PZ: -9.6, R: 0.38, // полуширина поля, верхняя стена, линия лопаты, радиус хычина
  ROWS: ['#7fe3ff', '#4fc3f7', '#9aa8ff', '#62e0c8', '#c7b3ff', '#b8f0ff', '#5ad1ff', '#ffffff'],

  start(lab, scene) {
    const st = lab.state, c = lab.cfg;
    lab.setCamera({ type: 'iso', beta: 0.6, target: [0, 0, -0.4] });
    Object.assign(st, { combo: 0, bestCombo: 0, hits: 0, broke: 0, juicy: 0, finale: 0, finT: 0, fw: 0, stuck: true, auto: 1.6 });
    this.cave(lab, scene);
    st.bricks = this.wall(lab, scene);
    st.paddles = (lab.players === 2 ? [[-1, lab.p1], [1, lab.p2]] : [[0, lab.p1]]).map(([side, p], i) => this.buildPaddle(lab, scene, side * 3.2, i ? 1.7 : 0, p, i));
    st.ball = this.buildBall(lab, scene);
    st.bakers = st.paddles.map((p, i) => this.buildBaker(lab, p, i));
    lab.hero(st.paddles[0].node);
    lab.hud('lives', '');
  },

  update(lab, dt) {
    const st = lab.state, c = lab.cfg, b = st.ball;
    st.paddles.forEach(p => this.movePaddle(lab, p, dt));
    if (st.finT > 0) return this.fireworks(lab, dt);
    if (st.stuck) { // хычин лежит на лопате: A — запустить, или сам через пару секунд
      const p = st.paddles[0];
      b.x = p.x; b.z = this.PZ + p.dz + 0.55; st.auto -= dt;
      if (lab.p1.pressed.a || (lab.players === 2 && lab.p2.pressed.a) || st.auto <= 0) this.launch(lab, (lab.rand(-0.3, 0.3)));
    } else {
      const n = Math.ceil(b.speed * dt / 0.18);
      for (let i = 0; i < n && !st.stuck; i++) this.step(lab, dt / n);
    }
    this.finaleCheck(lab);
    this.drawBall(lab, dt);
    lab.hud('lives', `Лёд: ${st.bricks.filter(k => k.hp > 0).length} · серия ${st.combo}`);
  },

  overNote(lab) {
    const st = lab.state, on = Object.keys(lab.cfg).filter(k => k.startsWith('j_') && lab.cfg[k] >= 1).length;
    return [`Растоплено льда: ${st.broke} из ${st.bricks.length}, ударов ${st.hits}, лучшая серия ${st.bestCombo}`,
      `Сочных эффектов на ударах сработало: ${st.juicy} (включено переключателей сочности: ${on} из 12)`,
      on ? 'Выключи сочность пресетом «Без секрета» — механика та же. Хочется вернуться?' : 'Сочность выключена: игра та же, но удары «немые». Включи «Как задумано» и сравни.'];
  },

  /* ---------- хычин ---------- */
  launch(lab, off) {
    const st = lab.state, b = st.ball, a = off * lab.cfg.angle * Math.PI / 180;
    st.stuck = false; b.speed = Math.max(b.speed, lab.cfg.speed);
    b.vx = Math.sin(a) * b.speed; b.vz = Math.cos(a) * b.speed;
    lab.sfx.whoosh();
  },
  step(lab, dt) {
    const st = lab.state, b = st.ball, R = this.R;
    b.x += b.vx * dt; b.z += b.vz * dt;
    // стены пещеры
    if (b.x < -this.W + R) { b.x = -this.W + R; b.vx = Math.abs(b.vx); this.wallHit(lab, b); }
    if (b.x > this.W - R) { b.x = this.W - R; b.vx = -Math.abs(b.vx); this.wallHit(lab, b); }
    if (b.z > this.TOP - R) { b.z = this.TOP - R; b.vz = -Math.abs(b.vz); this.wallHit(lab, b); }
    // лопаты: угол отскока — от места удара
    for (const p of st.paddles) {
      const pz = this.PZ + p.dz, half = lab.cfg.paddle * p.k / 2;
      if (b.vz < 0 && b.z - R <= pz + 0.25 && b.z > pz - 0.4 && Math.abs(b.x - p.x) <= half + R) {
        const off = lab.clamp((b.x - p.x) / half, -1, 1), a = off * lab.cfg.angle * Math.PI / 180;
        b.vx = Math.sin(a) * b.speed; b.vz = Math.cos(a) * b.speed; b.z = pz + 0.25 + R;
        st.combo = 0; b.sq = 0.45;
        st.bakers.forEach(k => { k.squash(0.2); k.mood(null); });
        lab.pulse(p.node, 1.25, 0.14); lab.whiten(p.board, 0.06, '#ffe2a8'); lab.vibrate(60, 0.3);
        lab.tone(220, 0.08, 'triangle', 0.12, 160); lab.noise(0.04, 0.08, 1200);
        lab.burst([b.x, 0.6, pz + 0.3], { count: 6, colors: ['#ffd27a', '#ff8a3d'], speed: 3, up: 1 });
        lab.count('удары'); st.hits++;
      }
    }
    // лёд: круг против коробки, отражение по меньшему перекрытию
    for (const k of st.bricks) {
      if (k.hp <= 0) continue;
      const dx = b.x - k.x, dz = b.z - k.z, ox = k.w / 2 + R - Math.abs(dx), oz = k.d / 2 + R - Math.abs(dz);
      if (ox <= 0 || oz <= 0) continue;
      if (ox < oz) { b.vx = Math.sign(dx) * Math.abs(b.vx); b.x += Math.sign(dx) * ox; } else { b.vz = Math.sign(dz) * Math.abs(b.vz); b.z += Math.sign(dz) * oz; }
      this.hitBrick(lab, k);
      break;
    }
    // хычин упал в пропасть
    if (b.z < this.PZ - 2.5) {
      lab.hurt([b.x, 0.5, this.PZ], 'Хычины кончились');
      st.bakers.forEach(k => { k.hurt(); k.mood('испуган'); });
      st.stuck = true; st.auto = 1.6; st.combo = 0; b.speed = lab.cfg.speed;
      lab.vibrate(300, 0.8);
    }
  },
  wallHit(lab, b) {
    b.sq = 0.3; lab.tone(140, 0.05, 'sine', 0.06); lab.shake(0.05);
  },
  hitBrick(lab, k) {
    const st = lab.state, c = lab.cfg, b = st.ball;
    st.combo++; st.bestCombo = Math.max(st.bestCombo, st.combo); b.sq = 0.5;
    k.hp--;
    // звук выше с каждым ударом подряд: lab.pitch(n) — множитель частоты (переключатель j_pitch)
    lab.tone(520 * lab.pitch(st.combo), 0.16, 'triangle', 0.14); lab.tone(1040 * lab.pitch(st.combo), 0.1, 'sine', 0.06, 0, 0.03);
    lab.hitstop(0.035 + Math.min(st.combo, 8) * 0.006);
    lab.shake(0.18 + Math.min(st.combo, 10) * 0.03);
    lab.burst([k.x, 0.5, k.z], { count: k.hp > 0 ? 8 : 22, colors: [k.color, '#ffffff', '#bff4ff'], speed: 7, dir: [b.vx, 0, b.vz], up: 2 });
    if (st.combo >= 5 && st.combo % 5 === 0) { lab.flash('#bff4ff', 0.25); lab.popup([k.x, 1, k.z], `Серия ×${st.combo}!`, '#bff4ff', 26); }
    lab.vibrate(40, 0.25);
    if (Object.keys(c).some(x => x.startsWith('j_') && c[x] >= 1)) { st.juicy++; lab.count('_secret'); }
    lab.count('удары'); st.hits++;
    if (k.hp > 0) { k.m.dispose(); k.m = this.brickMesh(lab, k, 0); lab.tone(1800, 0.05, 'square', 0.04); return; } // треснул
    k.m.dispose(); st.broke++; lab.count('кирпичи');
    lab.addScore(50 + 10 * Math.min(st.combo, 20), [k.x, 1, k.z], '#ffffff');
    b.speed = Math.min(c.maxSpeed, b.speed + c.speedup);
    const sp = Math.hypot(b.vx, b.vz) || 1; b.vx *= b.speed / sp; b.vz *= b.speed / sp;
    if (st.bricks.every(x => x.hp <= 0)) this.finaleStart(lab, k);
  },
  // последний кирпич: замедление, приближение и барабанная дробь, пока хычин летит к нему
  finaleCheck(lab) {
    const st = lab.state, b = st.ball, left = st.bricks.filter(k => k.hp > 0);
    if (!lab.cfg.finale || left.length !== 1 || st.stuck) { st.finale = 0; return; }
    const k = left[0], d = Math.hypot(k.x - b.x, k.z - b.z), toward = (k.x - b.x) * b.vx + (k.z - b.z) * b.vz > 0;
    if (d < 4.5 && toward && !st.finale) {
      st.finale = 1; lab.slowmo(0.9, 0.25); lab.count('финал');
      for (let i = 0; i < 10; i++) lab.noise(0.05, 0.12, 2400, i * 0.07);
      lab.popup([k.x, 1.5, k.z], 'Последний!', '#ffb347', 30);
    }
  },
  finaleStart(lab, k) {
    const st = lab.state;
    lab.addScore(500 + lab.lives * 300, [k.x, 2, k.z], '#ffb347');
    if (!lab.cfg.finale) return lab.win('Весь лёд растоплен!');
    st.finT = 2.6; st.ball.node.setEnabled(false);
    st.bakers.forEach(x => x.celebrate());
    lab.slowmo(0.5, 0.35); lab.flash('#ffffff', 0.6); lab.shake(1); lab.vibrate(500, 1);
    [523, 659, 784, 1046, 784, 1046, 1318, 1568].forEach((f, i) => lab.tone(f, 0.22, 'triangle', 0.12, 0, i * 0.12)); // своя победная мелодия
    lab.popup([0, 3, 4], 'ЛЕДОЛОМ!', '#ffb347', 48);
  },
  fireworks(lab, dt) {
    const st = lab.state;
    st.finT -= dt; st.fw -= dt;
    if (st.fw <= 0) {
      st.fw = 0.22;
      lab.burst([lab.rand(-6, 6), lab.rand(3, 6), lab.rand(0, 9)], { count: 40, colors: [lab.pick(['#ff4d5e', '#ffd23f', '#7cf5a8', '#bff4ff', '#ff8ad8']), '#ffffff'], speed: 9, gravity: 4, life: 1 });
      lab.tone(lab.rand(300, 700), 0.2, 'sine', 0.05, 90); lab.noise(0.2, 0.08, 900);
    }
    if (st.finT <= 0) lab.win('Весь лёд растоплен!');
  },

  /* ---------- лопаты ---------- */
  movePaddle(lab, p, dt) {
    const half = lab.cfg.paddle * p.k / 2;
    p.x = lab.clamp(p.x + p.input.x * lab.cfg.move * dt, -this.W + half, this.W - half);
    p.node.position.x = p.x;
    const baker = lab.state.bakers && lab.state.bakers[lab.state.paddles.indexOf(p)];
    if (baker) baker.look(lab.state.ball.node);
    p.node.rotation.y = lab.lerp(p.node.rotation.y, -p.input.x * (lab.juicy('squash') ? 0.12 : 0), 1 - Math.exp(-dt * 12)); // наклон в движении
    p.board.scaling.x = lab.cfg.paddle * p.k; p.rim.scaling.x = lab.cfg.paddle * p.k * 0.95;
  },
  drawBall(lab, dt) {
    const b = lab.state.ball, n = b.node;
    n.position.set(b.x, 0.5, b.z);
    b.sq = lab.lerp(b.sq, 0, 1 - Math.exp(-dt * 14));
    const s = lab.juicy('squash') ? b.sq : 0; // сжатие при ударе и растяжение по полёту
    n.scaling.set(1 + s * 0.5, 1 - s * 0.4, 1 - s * 0.4);
    n.rotation.y = Math.atan2(b.vx, b.vz) + Math.PI / 2;
    b.spin += dt * 9; b.top.rotation.y = b.spin;
    if (!lab.state.stuck && (b.trail -= dt) <= 0) { b.trail = 0.04; lab.burst([b.x, 0.55, b.z], { count: 2, colors: ['#ffb347', '#ff6a2b', '#ffe08a'], speed: 0.6, gravity: -2, life: 0.35, size: 0.3 }); }
  },

  /* ---------- картинка ---------- */
  part(lab, mesh, color, x = 0, y = 0, z = 0, o) { mesh.material = lab.mat(color, o || {}); mesh.position.set(x, y, z); return mesh; },
  merge(parts, name) {
    const groups = new Map();
    parts.forEach(p => groups.set(p.material, (groups.get(p.material) || []).concat(p)));
    const pieces = [...groups.values()].map(g => (g.length > 1 ? BABYLON.Mesh.MergeMeshes(g, true, true) : g[0]));
    const m = pieces.length > 1 ? BABYLON.Mesh.MergeMeshes(pieces, true, true, undefined, false, true) : pieces[0];
    m.name = name; return m;
  },
  wall(lab, scene) {
    const st = lab.state, c = lab.cfg, cols = 10, w = 1.5, d = 0.78, rows = c.rows, list = [];
    st.src = this.ROWS.map(col => { const m = BABYLON.MeshBuilder.CreateBox('лёд', { width: w - 0.1, height: 0.8, depth: d - 0.1 }, scene); m.material = lab.mat(col, { glow: 0.12 }); m.isVisible = false; return m; });
    st.srcTough = BABYLON.MeshBuilder.CreateBox('многолетний лёд', { width: w - 0.1, height: 0.9, depth: d - 0.1 }, scene);
    st.srcTough.material = lab.mat('#3f7fd9', { glow: 0.2, shiny: 1 }); st.srcTough.isVisible = false;
    for (let r = 0; r < rows; r++) for (let i = 0; i < cols; i++) {
      const k = { x: (i - (cols - 1) / 2) * (w + 0.08), z: 9.6 - r * (d + 0.14), w, d, row: r, hp: r < c.tough ? 2 : 1, color: this.ROWS[r % this.ROWS.length] };
      k.m = this.brickMesh(lab, k, k.hp > 1 ? 1 : 0);
      list.push(k);
    }
    return list;
  },
  brickMesh(lab, k, tough) {
    const m = (tough ? lab.state.srcTough : lab.state.src[k.row % this.ROWS.length]).createInstance('лёд');
    m.position.set(k.x, 0.45, k.z);
    return m;
  },
  buildPaddle(lab, scene, x, dz, input, i) {
    const MB = BABYLON.MeshBuilder, node = new BABYLON.TransformNode('лопата', scene);
    const wood = i ? '#9fd36a' : '#d9944f';
    const board = this.part(lab, MB.CreateBox('лопата', { width: 1, height: 0.28, depth: 0.7 }, scene), wood, 0, 0.35, 0);
    const handle = this.part(lab, MB.CreateCylinder('черенок', { height: 2.2, diameter: 0.18, tessellation: 6 }, scene), '#8a5a33', 0, 0.35, -1.3);
    handle.rotation.x = Math.PI / 2;
    const rim = this.part(lab, MB.CreateBox('кромка', { width: 0.95, height: 0.12, depth: 0.12 }, scene), '#ffe2a8', 0, 0.52, 0.32, { glow: 0.5 });
    [board, handle, rim].forEach(m => { m.parent = node; });
    node.position.set(x, 0, this.PZ + dz);
    const p = { node, board, rim, x, dz, input, k: lab.players === 2 ? 0.8 : 1 };
    return p;
  },
  // хычин: лепёшка с подрумяненной корочкой и пламенем
  buildBall(lab, scene) {
    const MB = BABYLON.MeshBuilder, node = new BABYLON.TransformNode('хычин', scene);
    const body = this.part(lab, MB.CreateCylinder('хычин', { height: 0.36, diameter: this.R * 2.6, tessellation: 12 }, scene), '#f2b453', 0, 0, 0, { glow: 0.35 });
    const top = this.part(lab, MB.CreateCylinder('корочка', { height: 0.12, diameter: this.R * 1.9, tessellation: 7 }, scene), '#c9742f', 0, 0.18, 0, { glow: 0.2 });
    const fire = this.part(lab, MB.CreateCylinder('пламя', { height: 0.5, diameterTop: 0, diameterBottom: 0.45, tessellation: 5 }, scene), '#ff7a2b', 0, 0.42, 0, { glow: 1 });
    [body, top, fire].forEach(m => { m.parent = node; });
    top.addChild(fire);
    return { node, top, x: 0, z: this.PZ + 0.55, vx: 0, vz: 0, speed: lab.cfg.speed, sq: 0, spin: 0, trail: 0 };
  },
  // ледяная пещера Лаго-Наки на готовых деталях: стиль, лёд пола, торосы, горы; свои — стены пещеры и печь-тандыр пекаря
  cave(lab, scene) {
    const st = lab.state;
    lab.style({ mood: 'зима', shape: 'острый', detail: 'обычно', wind: 0.6, palette: { земля: '#5d8fc4', вода: '#24497a', камень: '#7b93c9', огонь: '#ff7a2b', акцент: '#ffb347' } });
    lab.floor({ type: 'лёд с трещинами', w: this.W * 2, h: 23.5, z: 0.6, colors: { лёд: '#2a5590' } }); // тёмный лёд: светлые кирпичи на нём читаются
    lab.edge({ type: 'обрыв в туман', sides: ['ближняя'] }); // за лопатой — пропасть
    lab.backdrop({ type: 'горы', layers: 2 });
    lab.scatter([['торос', 3], ['сталагмит', 2], ['льдина', 1]], { n: 30, area: 'вокруг' });
    lab.ambient('снег', { n: 60 });
    // свои детали: стена пещеры со снежной шапкой и сосульками и печь-тандыр — ориентир слева
    const wall = lab.build('стена пещеры', [['box', [1, 1, 1], [0, 0.5, 0], 0, 'камень'], ['box', [1.1, 0.2, 1.1], [0, 1, 0], 0, 'снег'],
      ['cone', [0.25, 0.5, 0.25], [0.3, 0.75, 0.55], [Math.PI, 0, 0], 'лёд'], ['cone', [0.2, 0.4, 0.2], [-0.25, 0.8, 0.55], [Math.PI, 0, 0], 'лёд', { d: 1 }]]);
    wall.copy([-this.W - 0.6, 0, 0.6], 0, [1.2, 1.4, 24]); wall.copy([this.W + 0.6, 0, 0.6], 0, [1.2, 1.4, 24]); wall.copy([0, 0, this.TOP + 0.6], 0, [this.W * 2 + 2.4, 1.4, 1.2]);
    lab.build('тандыр', [['cyl', [3.2, 2.6, 3.2], [0, 1.3, 0], 0, '#c98a5a', { top: 0.7 }], ['torus', [2.2, 0.4, 2.2], [0, 2.6, 0], 0, '#a8653a'], ['cyl', [1.6, 0.3, 1.6], [0, 2.62, 0], 0, 'огонь', { glow: 1 }],
      ['box', [1.1, 0.9, 0.3], [0, 0.6, 1.5], 0, 'тёмный'], ['sphere', [0.8, 0.5, 0.3], [0, 0.6, 1.62], 0, 'огонь', { glow: 0.8 }], ['cyl', [0.5, 3.2, 0.5], [0.9, 4, -0.6], 0, 'камень'],
      ['box', [1.6, 0.25, 1.6], [0, 0.12, 0], 0, 'камень'], ['hemi', [1.6, 0.6, 1.6], [0, 0.2, 2.3], 0, 'снег', { d: 1 }]]).copy([-14, 0, -4], 0.4);
    lab.ambient('дым из трубы', { at: [-13.1, 7.8, -4.6] });
    st.cave = true;
  },
  // пекарь у стены пещеры следит за хычином и переживает за каждый
  buildBaker(lab, p, i) {
    return lab.creature({ plan: 'двуногий', size: 2.4, at: [(i ? 1 : -1) * (this.W + 3), 0, this.PZ + 2], role: 'друг', colors: { main: '#f2d0a8', second: '#3a4a7a', belly: '#ffffff', accent: '#ff7a2b' },
      wear: ['колпак повара', 'фартук'], face: { mustache: true, cheeks: true }, eyes: { look: 'хитрые' } });
  },
};
