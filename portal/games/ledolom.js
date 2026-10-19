// «Ледолом» — ремейк-донор урока 6 по мотивам Arkanoid и финала Peggle, оболочка «Лаб3D 1.0» (three.js).
// План.
// Фраза: лопата пекаря отбивает горящий хычин в ледяную стену пещеры Лаго-Наки — растопи весь лёд.
// Ядро на 3 секунды: угол отскока от места удара по лопате; каждый растопленный кирпич звенит на полутон выше, пока хычин не вернулся на лопату.
// Риск — награда: гостинец во льду (светится камешек) падает к лопате — бежать за ним, рискуя хычином? Прорыв: пробей дыру,
// и хычин пляшет между дальней стеной и льдом за двойные очки (Breakout). Последний кирпич — праздник, как в Peggle.
// Жар: каждое отбивание нагревает хычин (пламя растёт), растаявший лёд дороже — очки за игру, а не за подачу.
// Угрозы: хычин разгоняется с каждым кирпичом, многолетний лёд бьётся с двух ударов, за лопатой — расщелина.
// Сочность (спрятанная механика урока): стоп-кадр, тряска по серии, осколки льда по направлению удара, лужицы, пар, сжатие и растяжение,
// лёд падает на место с подскоком и вздрагивает от соседнего удара, у хычина глаза щурятся от удара, свет от хычина на льду.
// Каждый эффект — свой переключатель сочности оболочки (j_…), свои эффекты игры проверяют lab.juicy(…).
// Пресет «Без спрятанной механики» выключает все 12 и финал: механика та же.
// Палитра: холодная синь пещеры и льда против горячего оранжевого хычина; гостинцы — яркие цвета.
// Разбор лучших игр жанра (Breakout, Arkanoid, Peggle, Shatter, «Juice it or lose it») — в docs/01_Журнал_курса.md, раздел урока 6.
// Ось Z в three.js смотрит на игрока: лёд вдали (−Z), лопата у нижнего края экрана (+Z).
const GAME = {
  engine: 'three',
  title: 'Ледолом',
  subtitle: 'Лопата пекаря отбивает горящий хычин в ледяную стену пещеры Лаго-Наки. Растопи весь лёд!',
  donor: 'Arkanoid и финала Peggle',
  players: 1,
  duo: 'coop', // ручка coop = 1 — две лопаты, один хычин
  controls: [
    { input: 'move', text: 'двигать лопату' },
    { input: 'a', text: 'запустить хычин' },
  ],
  camera: { type: 'iso', tilt: 0.72, target: [0, 0, -0.4] },
  field: { w: 19.4, h: 25.6 },
  sky: ['#081230', '#4f74b8'],
  fog: 0.007,
  accent: '#ffb347',
  lives: 3,
  decisions: [
    'Чувство: каждый удар отзывается — лёд звенит всё выше, хычин щурится, осколки летят по удару',
    'Честность: угол отскока зависит от того, куда хычин попал по лопате; лёд с гостинцем светится заранее',
    'Выбор: ловить хычин краем лопаты для острого угла или серединой — надёжно; бежать за гостинцем или стеречь хычин',
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
    gifts: { value: 0.14, min: 0, max: 0.5, step: 0.02, label: 'Гостинцы во льду, доля', hint: 'как капсулы Arkanoid: во льду светится камешек — растопи, и гостинец упадёт к лопате', restart: true },
    giftTime: { value: 12, min: 4, max: 30, step: 1, label: 'Гостинец действует, с' },
    through: { value: 2, min: 1, max: 4, step: 1, label: 'Прорыв: множитель очков за льдом', hint: 'как в Breakout: хычин пролетел сквозь дыру к дальней стене — каждый кирпич оттуда дороже; 1 — без бонуса' },
    oven: { value: 1, min: 0, max: 1, step: 1, label: 'Жаровня-спасатель над расщелиной', hint: 'как корзина Free Ball в Peggle: хычин упал в жаровню — не пропал, а вернулся на лопату', restart: true },
    ovenSpeed: { value: 3, min: 0, max: 8, step: 0.5, label: 'Скорость жаровни' },
    finale: { value: 1, min: 0, max: 1, step: 1, label: 'Финал на последнем кирпиче', hint: 'замедление, наезд камеры, барабанная дробь, салют' },
    coop: { value: 0, min: 0, max: 1, step: 1, label: 'Вдвоём: две лопаты', restart: true },
  },
  presets: {
    'Новичок': { speed: 8, speedup: 0.08, paddle: 5, maxSpeed: 13, gifts: 0.22 },
    'Без спрятанной механики': { j_hitstop: 0, j_shake: 0, j_squash: 0, j_burst: 0, j_flash: 0, j_whiten: 0, j_popup: 0, j_sound: 0, j_pitch: 0, j_vibrate: 0, j_glow: 0, j_slowmo: 0, finale: 0 },
    'Вдвоём': { coop: 1 },
    'Ураган': { speed: 15, speedup: 0.4, maxSpeed: 24 },
    'Гостинцы': { gifts: 0.4, rows: 7, giftTime: 18 },
    'Классика': { gifts: 0, through: 1, oven: 0 },
  },
  notes: [
    'Жар: каждое отбивание лопатой нагревает хычин (до 5), растаявший лёд стоит дороже, пламя растёт. Иначе очки шли бы и без игры: хычин сам бьётся о лёд после подачи.',
    'Подача медленнее (65% скорости) до первого отбивания, как в Arkanoid: первый промах не раньше 6–7-й секунды.',
    'Серия считается до возвращения хычина на лопату, как выстрел в Peggle: звон растёт, пока хычин в полёте.',
    'Гостинцы выдаёт только лёд со светящимся камешком: какой кирпич что прячет, видно с начала партии.',
  ],

  W: 8.2, TOP: 12.4, PZ: 10, R: 0.42, BY: 0.45, // полуширина поля, дальняя стена (−Z), линия лопаты (+Z), радиус и высота хычина
  ROWS: ['#5fd4ff', '#7fe8ff', '#8fb4ff', '#6ff0d0', '#b59cff', '#58c2f5', '#a8ecff', '#d8f6ff'],
  GIFTS: {
    wide: { name: 'Шире!', color: '#7cf5a8' },
    sticky: { name: 'Липкая лопата', color: '#ffd23f' },
    multi: { name: 'Три хычина', color: '#ff8ad8' },
    slow: { name: 'Медленнее', color: '#8fd8ff' },
    life: { name: '+1 жизнь', color: '#ff5a4d' },
  },

  start(lab, scene) {
    const st = lab.state, T = lab.THREE;
    Object.assign(st, { combo: 0, bestCombo: 0, hits: 0, broke: 0, juicy: 0, throughs: 0, caught: 0, saved: 0, finale: 0, finT: 0, fw: 0,
      balls: [], gifts: [], power: { wide: 0, sticky: 0 }, zoom: null });
    this.cave(lab, scene);
    this.wall(lab);
    this.debris(lab);
    if (lab.cfg.oven >= 1) this.buildOven(lab);
    st.paddles = (lab.players === 2 ? [-3.2, 3.2] : [0]).map((x, i) => this.buildPaddle(lab, x, i ? lab.p2 : lab.p1, i));
    st.lights = [0, 1, 2].map(() => { const l = new T.PointLight('#ff9a3c', 0, 9, 2); l.position.set(0, -5, 0); scene.add(l); return l; }); // три лампы на всю партию: число огней не меняется — шейдеры не перестраиваются
    this.newBall(lab);
    lab.hero(st.paddles[0].node);
  },

  update(lab, dt) {
    const st = lab.state;
    st.paddles.forEach(p => this.movePaddle(lab, p, dt));
    this.keepApart(lab);
    this.tickPower(lab, dt);
    this.tickBricks(lab, dt);
    this.tickDebris(lab, dt);
    this.tickGifts(lab, dt);
    this.tickOven(lab, dt);
    if (st.finT > 0) this.fireworks(lab, dt);
    else {
      for (const b of st.balls) {
        if (b.stuck >= 0) this.holdBall(lab, b, dt);
        else { const n = Math.ceil(b.speed * dt / 0.18); for (let i = 0; i < n && b.stuck < 0 && !b.dead; i++) this.step(lab, b, dt / n); }
      }
      this.dropLost(lab);
      this.finaleCheck(lab);
    }
    this.drawBalls(lab, dt);
    this.drawCamera(lab, dt);
    this.drawSnow(lab, dt);
    const left = st.bricks.filter(k => k.hp > 0).length, pw = [];
    if (st.power.wide > 0) pw.push(`Шире ${Math.ceil(st.power.wide)} с`);
    if (st.power.sticky > 0) pw.push(`Липкая ${Math.ceil(st.power.sticky)} с`);
    lab.hud('lives', `Лёд: ${left} · жар ${Math.max(0, ...st.balls.map(b => b.heat))} из 5 · серия ×${st.combo}`);
    lab.hud('power', pw.length ? pw.join(' · ') : null);
  },

  overNote(lab) {
    const st = lab.state, on = Object.keys(lab.cfg).filter(k => k.startsWith('j_') && lab.cfg[k] >= 1).length;
    return [`Растоплено льда: ${st.broke} из ${st.bricks.length}, ударов ${st.hits}, лучшая серия ${st.bestCombo}`,
      `Прорывов за лёд: ${st.throughs}, гостинцев поймано: ${st.caught}, жаровня спасла: ${st.saved}`,
      `Сочных эффектов на ударах сработало: ${st.juicy} (включено переключателей сочности: ${on} из 12)`,
      on ? 'Выключи сочность пресетом «Без спрятанной механики» — механика та же. Хочется вернуться?' : 'Сочность выключена: игра та же, но удары «немые». Включи «Как задумано» и сравни.'];
  },

  /* ---------- хычин ---------- */
  newBall(lab, from) {
    const st = lab.state, b = this.buildBall(lab);
    if (from) { // копия от гостинца «Три хычина»
      Object.assign(b, { x: from.x, z: from.z, speed: from.speed, stuck: -1, through: from.through, heat: from.heat, serve: from.serve });
      st.balls.push(b);
      return b;
    }
    const p = st.paddles[0], half = this.half(lab, p);
    Object.assign(b, { stuck: 0, off: lab.rand(-0.3, 0.3) * half, hold: 2.5, serve: true, heat: 0, x: p.x, z: this.PZ - 0.7 });
    st.balls.push(b);
    return b;
  },
  holdBall(lab, b, dt) { // хычин лежит на лопате: A — запустить, или сам через пару секунд
    const st = lab.state, p = st.paddles[b.stuck], half = this.half(lab, p);
    b.off = lab.clamp(b.off, -half, half);
    b.x = p.x + b.off; b.z = this.PZ - 0.32 - this.R;
    b.hold -= dt;
    if (((lab.p1.pressed.a || (lab.players === 2 && lab.p2.pressed.a)) && lab.t >= 1.2) || b.hold <= 0) this.launch(lab, b, p); // первые 1,2 с лёд встаёт на место
  },
  launch(lab, b, p) {
    const half = this.half(lab, p), a = lab.clamp(b.off / half, -1, 1) * lab.cfg.angle * Math.PI / 180;
    b.stuck = -1; b.speed = b.serve ? lab.cfg.speed * 0.65 : Math.max(b.speed, lab.cfg.speed); // подача медленнее, как в Arkanoid
    b.vx = Math.sin(a) * b.speed; b.vz = -Math.cos(a) * b.speed;
    b.sq = 0.4;
    lab.sfx.whoosh();
  },
  step(lab, b, dt) {
    const st = lab.state, R = this.R, W = this.W;
    b.x += b.vx * dt; b.z += b.vz * dt;
    // стены пещеры
    if (b.x < -W + R) { b.x = -W + R; b.vx = Math.abs(b.vx); this.wallHit(lab, b, -W, b.z); }
    if (b.x > W - R) { b.x = W - R; b.vx = -Math.abs(b.vx); this.wallHit(lab, b, W, b.z); }
    if (b.z < -this.TOP + R) {
      b.z = -this.TOP + R; b.vz = Math.abs(b.vz); this.wallHit(lab, b, b.x, -this.TOP);
      if (!b.through && st.bricks.some(k => k.hp > 0)) this.breakthrough(lab, b);
    }
    // лопаты: угол отскока — от места удара
    if (b.vz > 0) for (const p of st.paddles) {
      const half = this.half(lab, p);
      if (b.z + R >= this.PZ - 0.32 && b.z < this.PZ + 0.4 && Math.abs(b.x - p.x) <= half + R * 0.8) { this.paddleHit(lab, b, p, half); break; }
    }
    // лёд: круг против коробки, отражение по меньшему перекрытию
    for (const k of st.bricks) {
      if (k.hp <= 0) continue;
      const dx = b.x - k.x, dz = b.z - k.z, ox = k.w / 2 + R - Math.abs(dx), oz = k.d / 2 + R - Math.abs(dz);
      if (ox <= 0 || oz <= 0) continue;
      const sx = dx >= 0 ? 1 : -1, sz = dz >= 0 ? 1 : -1;
      if (ox < oz) { b.vx = sx * Math.abs(b.vx); b.x += sx * ox; } else { b.vz = sz * Math.abs(b.vz); b.z += sz * oz; }
      this.hitBrick(lab, k, b);
      break;
    }
    const o = st.oven, line = this.PZ + 1.4;
    if (o && b.vz > 0 && b.z > line && b.z - b.vz * dt <= line && Math.abs(b.x - o.x) < o.w / 2 + R * 0.5) return this.ovenSave(lab, b);
    if (b.z > this.PZ + 2.2) b.dead = true; // упал в расщелину
  },
  paddleHit(lab, b, p, half) {
    if (b.serve) { b.serve = false; b.speed = Math.max(b.speed, lab.cfg.speed); }
    b.heat = Math.min(5, b.heat + 1); // жар: каждое отбивание нагревает хычин, лёд тает дороже
    const st = lab.state, off = lab.clamp((b.x - p.x) / half, -1, 1), a = off * lab.cfg.angle * Math.PI / 180;
    b.vx = Math.sin(a) * b.speed; b.vz = -Math.cos(a) * b.speed; b.z = this.PZ - 0.32 - this.R;
    b.through = false; b.sq = 0.45;
    if (b.trail) b.trail.color.set('#ff8a3d').multiplyScalar(1.8);
    st.combo = 0; // серия — пока хычин в полёте, как выстрел в Peggle
    lab.pulse(p.node, 1.22, 0.14); lab.whiten(p.blade, 0.06, '#ffe2a8'); lab.vibrate(60, 0.3);
    lab.tone(200 + b.heat * 30, 0.08, 'triangle', 0.12, 160); lab.noise(0.04, 0.08, 1200);
    lab.burst([b.x, 0.5, this.PZ - 0.4], { count: 7, colors: ['#ffffff', '#f4ead2', '#ffd27a'], speed: 2.5, up: 1.5, gravity: 4, size: 0.18 }); // мука с лопаты
    if (st.power.sticky > 0) { b.stuck = st.paddles.indexOf(p); b.off = b.x - p.x; b.hold = 2.5; b.vx = b.vz = 0; lab.tone(330, 0.1, 'sine', 0.08, 200); }
    p.lean = off;
    lab.count('удары'); st.hits++;
  },
  wallHit(lab, b, x, z) {
    b.sq = 0.3; lab.tone(140, 0.05, 'sine', 0.06); lab.shake(0.05);
    lab.ring([x, 0.3, z], { color: '#bff4ff', radius: 0.9, life: 0.25 });
    this.shards(lab, x, z, -b.vx * 0.2, -b.vz * 0.2, 2, '#dff6ff');
  },
  // прорыв (Breakout): хычин долетел до дальней стены, а лёд ещё есть — он за стеной льда, каждый кирпич дороже
  breakthrough(lab, b) {
    const st = lab.state;
    b.through = true; st.throughs++; lab.count('прорывы');
    if (b.trail) b.trail.color.set('#8fe8ff').multiplyScalar(2);
    if (lab.cfg.through > 1) lab.popup([b.x, 1.4, b.z + 1], `Прорыв! Очки ×${lab.cfg.through}`, '#8fe8ff', 24);
    lab.tone(400, 0.25, 'sawtooth', 0.05, 1200); lab.flash('#8fe8ff', 0.12);
  },
  hitBrick(lab, k, b) {
    const st = lab.state, c = lab.cfg;
    st.combo++; st.bestCombo = Math.max(st.bestCombo, st.combo); b.sq = 0.5; b.squint = 0.25;
    k.hp--;
    // звук выше с каждым ударом подряд: lab.pitch(n) — множитель частоты (переключатель j_pitch)
    lab.tone(520 * lab.pitch(st.combo), 0.16, 'triangle', 0.14); lab.tone(1040 * lab.pitch(st.combo), 0.1, 'sine', 0.06, 0, 0.03);
    if (b.through) lab.tone(1560 * lab.pitch(st.combo), 0.12, 'sine', 0.05, 0, 0.06);
    lab.hitstop(0.035 + Math.min(st.combo, 8) * 0.006);
    lab.shake(0.18 + Math.min(st.combo, 10) * 0.03);
    lab.burst([k.x, 0.5, k.z], { count: k.hp > 0 ? 8 : 18, colors: [k.color, '#ffffff', '#bff4ff'], speed: 7, dir: [b.vx, 0, b.vz], up: 2 });
    this.shards(lab, k.x, k.z, b.vx * 0.35, b.vz * 0.35, k.hp > 0 ? 4 : 10, k.color);
    if (lab.juicy('whiten')) k.white = 0.07;
    if (lab.juicy('squash')) { // лёд вздрагивает, соседи тоже
      k.pop = 1;
      for (const n of st.bricks) if (n !== k && n.hp > 0 && Math.abs(n.x - k.x) < 2.5 && Math.abs(n.z - k.z) < 1.6) n.wob = Math.max(n.wob, 0.6);
    }
    if (st.combo >= 5 && st.combo % 5 === 0) { lab.flash('#bff4ff', 0.25); lab.popup([k.x, 1.2, k.z], `Серия ×${st.combo}!`, '#bff4ff', 26); }
    lab.vibrate(40, 0.25);
    if (Object.keys(c).some(x => x.startsWith('j_') && c[x] >= 1)) { st.juicy++; lab.count('_secret'); }
    lab.count('удары'); st.hits++;
    if (k.hp > 0) { lab.tone(1800, 0.05, 'square', 0.04); return; } // многолетний лёд треснул
    st.broke++; lab.count('кирпичи');
    this.puddle(lab, k.x, k.z);
    lab.burst([k.x, 0.6, k.z], { count: 5, color: '#ffffff', speed: 1.2, gravity: -3, life: 0.8, size: 0.35 }); // пар: горячий хычин топит лёд
    const mult = b.through ? Math.max(1, Math.round(c.through)) : 1;
    lab.addScore((20 + 15 * b.heat + 10 * Math.min(st.combo, 20)) * mult, [k.x, 1, k.z], mult > 1 ? '#8fe8ff' : '#ffffff');
    b.speed = Math.min(c.maxSpeed, b.speed + c.speedup);
    const sp = Math.hypot(b.vx, b.vz) || 1; b.vx *= b.speed / sp; b.vz *= b.speed / sp;
    if (k.gift) this.dropGift(lab, k);
    if (st.bricks.every(x => x.hp <= 0)) this.finaleStart(lab, k);
  },
  dropLost(lab) {
    const st = lab.state;
    st.balls = st.balls.filter(b => {
      if (!b.dead) return true;
      b.node.removeFromParent(); // след догорит сам
      if (b.light) b.light.intensity = 0;
      return false;
    });
    if (st.balls.length) return;
    const x = lab.clamp(st.lastX || 0, -this.W, this.W);
    lab.hurt([x, 0.5, this.PZ + 1.2], 'Хычины кончились');
    st.combo = 0; st.power.wide = 0; st.power.sticky = 0; // как в Arkanoid: гостинцы сгорают вместе с мячом
    lab.vibrate(300, 0.8);
    this.newBall(lab);
  },
  // последний кирпич: замедление, наезд камеры и барабанная дробь, пока хычин летит к нему
  finaleCheck(lab) {
    const st = lab.state, left = st.bricks.filter(k => k.hp > 0);
    const k = left.length === 1 && lab.cfg.finale >= 1 ? left[0] : null;
    const near = k && st.balls.some(b => b.stuck < 0 && Math.hypot(k.x - b.x, k.z - b.z) < 4.5 && (k.x - b.x) * b.vx + (k.z - b.z) * b.vz > 0);
    if (!near) { st.finale = 0; if (st.zoom) st.zoom.out = true; return; }
    if (st.finale) return;
    st.finale = 1; lab.slowmo(0.9, 0.25); lab.count('финал');
    for (let i = 0; i < 10; i++) lab.noise(0.05, 0.12, 2400, i * 0.07);
    lab.popup([k.x, 1.5, k.z], 'Последний!', '#ffb347', 30);
    if (lab.juicy('slowmo')) st.zoom = { x: k.x, z: k.z, out: false };
  },
  finaleStart(lab, k) {
    const st = lab.state;
    lab.addScore(500 + lab.lives * 300, [k.x, 2, k.z], '#ffb347');
    if (lab.cfg.finale < 1) return lab.win('Весь лёд растоплен!');
    st.finT = 2.6;
    st.balls.forEach(b => { b.node.visible = false; });
    if (st.zoom) st.zoom.out = true;
    lab.slowmo(0.5, 0.35); lab.flash('#ffffff', 0.6); lab.shake(1); lab.vibrate(500, 1);
    lab.ring([k.x, 0.2, k.z], { color: '#ffb347', radius: 8, life: 0.8 });
    [523, 659, 784, 1046, 784, 1046, 1318, 1568].forEach((f, i) => lab.tone(f, 0.22, 'triangle', 0.12, 0, i * 0.12)); // своя победная мелодия
    lab.popup([0, 3, -2], 'ЛЕДОЛОМ!', '#ffb347', 48);
  },
  fireworks(lab, dt) {
    const st = lab.state;
    st.finT -= dt; st.fw -= dt;
    if (st.fw <= 0) {
      st.fw = 0.22;
      const at = [lab.rand(-6, 6), lab.rand(3, 6), lab.rand(-10, 2)], col = lab.pick(['#ff4d5e', '#ffd23f', '#7cf5a8', '#bff4ff', '#ff8ad8']);
      lab.burst(at, { count: 40, colors: [col, '#ffffff'], speed: 9, gravity: 4, life: 1 });
      lab.ring([at[0], 0.1, at[2]], { color: col, radius: 3, life: 0.6 });
      lab.tone(lab.rand(300, 700), 0.2, 'sine', 0.05, 90); lab.noise(0.2, 0.08, 900);
    }
    if (st.finT <= 0) lab.win('Весь лёд растоплен!');
  },

  /* ---------- гостинцы (капсулы Arkanoid) ---------- */
  dropGift(lab, k) {
    const st = lab.state, g = this.GIFTS[k.gift], node = lab.group({ at: [k.x, 0.6, k.z] });
    lab.cyl(0.3, 0.3, 0.95, lab.mat(g.color, { unlit: true, glow: 0.9 }), { parent: node, rot: [0, 0, Math.PI / 2], sides: 10 });
    for (const s of [-1, 1]) lab.cyl(0.33, 0.33, 0.12, '#ffffff', { parent: node, at: [s * 0.3, 0, 0], rot: [0, 0, Math.PI / 2], sides: 10 });
    st.gifts.push({ node, kind: k.gift, x: k.x, z: k.z });
    lab.tone(990, 0.08, 'sine', 0.05);
    lab.ring([k.x, 0.2, k.z], { color: g.color, radius: 1.4 });
  },
  tickGifts(lab, dt) {
    const st = lab.state;
    st.gifts = st.gifts.filter(g => {
      g.z += 5 * dt;
      g.node.position.set(g.x, 0.6 + Math.sin(lab.t * 6 + g.x) * 0.12, g.z);
      g.node.rotation.x += dt * 5;
      const p = st.paddles.find(q => Math.abs(g.z - this.PZ) < 0.6 && Math.abs(g.x - q.x) < this.half(lab, q) + 0.5);
      if (p) { this.takeGift(lab, g, p); g.node.removeFromParent(); return false; }
      if (g.z > this.PZ + 2.5) { g.node.removeFromParent(); return false; }
      return true;
    });
  },
  takeGift(lab, g, p) {
    const st = lab.state, c = lab.cfg, G = this.GIFTS[g.kind];
    st.caught++; lab.count('гостинцы');
    lab.popup([p.x, 1.6, this.PZ], G.name, G.color, 24);
    [660, 880, 1320].forEach((f, i) => lab.tone(f, 0.1, 'triangle', 0.08, 0, i * 0.06));
    lab.ring([p.x, 0.2, this.PZ], { color: G.color, radius: 2.2 }); lab.pulse(p.node, 1.3, 0.18); lab.whiten(p.blade, 0.1, G.color);
    if (g.kind === 'wide') st.power.wide = c.giftTime;
    if (g.kind === 'sticky') st.power.sticky = c.giftTime;
    if (g.kind === 'slow') st.balls.forEach(b => { if (b.stuck >= 0) return; const sp = Math.hypot(b.vx, b.vz) || 1; b.speed = c.speed; b.vx *= b.speed / sp; b.vz *= b.speed / sp; });
    if (g.kind === 'life') lab.lives = Math.min(9, lab.lives + 1);
    if (g.kind === 'multi') {
      st.balls.filter(b => b.stuck >= 0).forEach(b => this.launch(lab, b, st.paddles[b.stuck]));
      for (const b of st.balls.slice()) for (const turn of [-0.4, 0.4]) {
        if (st.balls.length >= 6) break;
        const n = this.newBall(lab, b), cs = Math.cos(turn), sn = Math.sin(turn);
        n.vx = b.vx * cs - b.vz * sn; n.vz = b.vx * sn + b.vz * cs;
        if (Math.abs(n.vz) < n.speed * 0.25) n.vz = -n.speed * 0.25; // не дать копии лететь вдоль стены
      }
    }
  },
  tickPower(lab, dt) {
    const pw = lab.state.power;
    pw.wide = Math.max(0, pw.wide - dt); pw.sticky = Math.max(0, pw.sticky - dt);
  },

  /* ---------- жаровня над расщелиной (корзина Free Ball из Peggle) ---------- */
  buildOven(lab) {
    const g = lab.group({ at: [0, 0, this.PZ + 1.9] }), w = 2.4;
    lab.box(w, 0.2, 1, '#4a3328', { parent: g, at: [0, 0.1, 0] });
    lab.box(w - 0.3, 0.08, 0.72, '#ff6a2b', { parent: g, at: [0, 0.22, 0], glow: 0.9 });
    for (const s of [-1, 1]) lab.box(0.22, 0.34, 1.1, '#7a6a5e', { parent: g, at: [s * (w / 2 + 0.05), 0.17, 0] });
    lab.state.oven = { g, x: 0, dir: 1, w, t: 0 };
  },
  tickOven(lab, dt) {
    const o = lab.state.oven;
    if (!o) return;
    const lim = this.W - o.w / 2 - 0.3;
    o.x += o.dir * lab.cfg.ovenSpeed * dt;
    if (Math.abs(o.x) > lim) { o.x = Math.sign(o.x) * lim; o.dir = -o.dir; }
    o.g.position.x = o.x;
    o.t -= dt;
    if (o.t <= 0 && lab.juicy('burst')) { o.t = 0.25; lab.burst([o.x + lab.rand(-0.9, 0.9), 0.35, this.PZ + 1.9], { count: 1, colors: ['#ff8a3d', '#ffd27a'], speed: 0.4, gravity: -2.5, life: 0.6, size: 0.14 }); } // искры от углей
  },
  ovenSave(lab, b) {
    const st = lab.state, o = st.oven, p = st.paddles[0];
    st.saved++; st.combo = 0; lab.count('жаровня');
    Object.assign(b, { stuck: 0, off: lab.rand(-0.3, 0.3) * this.half(lab, p), hold: 2.5, serve: true, through: false, vx: 0, vz: 0, sq: 0.6, heat: Math.max(0, b.heat - 1) });
    lab.popup([o.x, 1.4, this.PZ + 1.6], 'Жаровня спасла!', '#ffb347', 22);
    lab.ring([o.x, 0.3, this.PZ + 1.9], { color: '#ff8a3d', radius: 2 }); lab.burst([o.x, 0.4, this.PZ + 1.9], { count: 14, colors: ['#ff8a3d', '#ffd27a', '#ffffff'], speed: 4, up: 3 });
    lab.pulse(o.g, 1.3, 0.2); lab.shake(0.15);
    [523, 784, 1046].forEach((f, i) => lab.tone(f, 0.12, 'sine', 0.08, 0, i * 0.07));
  },

  /* ---------- лопаты ---------- */
  half(lab, p) { return lab.cfg.paddle * p.k * p.wk / 2; },
  movePaddle(lab, p, dt) {
    const st = lab.state;
    p.wk = lab.damp(p.wk, st.power.wide > 0 ? 1.5 : 1, 10, dt);
    const half = this.half(lab, p), x0 = p.x;
    p.x = lab.clamp(p.x + p.input.x * lab.cfg.move * dt, -this.W + half, this.W - half);
    p.vx = (p.x - x0) / Math.max(dt, 1e-4);
    const juicy = lab.juicy('squash');
    p.lean = lab.damp(p.lean, 0, 8, dt);
    p.node.rotation.y = lab.damp(p.node.rotation.y, juicy ? -p.input.x * 0.12 : 0, 12, dt); // наклон в движении
    p.node.rotation.z = juicy ? -p.lean * 0.12 : 0;
    p.blade.scale.x = half * 2; p.rim.scale.x = half * 2 * 0.96;
    for (const s of [-1, 1]) p.ends[s > 0 ? 1 : 0].position.x = s * (half + 0.05);
  },
  draw(lab, p) { p.node.position.x = p.x; },
  keepApart(lab) { // вдвоём лопаты не заходят друг на друга
    const ps = lab.state.paddles;
    if (ps.length === 2) {
      const [a, b] = ps, ov = (a.x + this.half(lab, a)) - (b.x - this.half(lab, b));
      if (ov > 0) { a.x -= ov / 2; b.x += ov / 2; }
      a.x = lab.clamp(a.x, -this.W + this.half(lab, a), this.W - this.half(lab, a));
      b.x = lab.clamp(b.x, -this.W + this.half(lab, b), this.W - this.half(lab, b));
    }
    ps.forEach(p => this.draw(lab, p));
  },

  /* ---------- лёд ---------- */
  wall(lab) {
    const st = lab.state, c = lab.cfg, T = lab.THREE, cols = 10, w = 1.5, d = 0.78, rows = Math.round(c.rows), list = [];
    const RB = lab.addons.RoundedBoxGeometry;
    for (let r = 0; r < rows; r++) for (let i = 0; i < cols; i++) {
      const tough = r < c.tough, gift = lab.chance(c.gifts) ? lab.pick(['wide', 'wide', 'sticky', 'sticky', 'multi', 'multi', 'slow', 'life']) : null;
      list.push({ i: list.length, x: (i - (cols - 1) / 2) * (w + 0.08), z: -this.TOP + 1.7 + r * (d + 0.14), w, d, row: r, hp: tough ? 2 : 1, tough,
        color: tough ? '#3f7fd9' : this.ROWS[r % this.ROWS.length], gift, pop: 0, wob: 0, white: 0,
        y: lab.juicy('squash') ? 7 : 0, delay: 0.15 + (rows - 1 - r) * 0.08 + Math.abs(i - 4.5) * 0.03 }); // лёд падает на место рядами
    }
    st.bricks = list;
    st.ice = lab.instances(new RB(w - 0.12, 0.9, d - 0.12, 2, 0.14), lab.mat('#ffffff', { shiny: true }), list.length);
    st.cracks = lab.instances(this.crackGeo(lab, w - 0.2), lab.mat('#163a6b', { rough: 0.5 }), list.length);
    st.gems = lab.instances(new T.OctahedronGeometry(0.2), lab.mat('#ffffff', { unlit: true, glow: 1 }), list.length);
    lab.noShadow(st.gems); lab.noShadow(st.cracks);
    for (const k of list) {
      lab.place(st.ice, k.i, [k.x, this.BY + k.y, k.z], { color: k.color });
      lab.place(st.gems, k.i, [0, -50, 0], { scale: 0.001, color: k.gift ? this.GIFTS[k.gift].color : '#ffffff' });
    }
  },
  crackGeo(lab, w) { // трещина многолетнего льда: ломаная из тонких брусков
    const T = lab.THREE, parts = [];
    [[-0.42, 0.05, 0.5], [-0.12, -0.08, -0.6], [0.2, 0.06, 0.7], [0.45, -0.05, -0.4]].forEach(([x, z, r]) => {
      const g = new T.BoxGeometry(w * 0.3, 0.04, 0.06); g.rotateY(r); g.translate(x * w * 0.9, 0, z); parts.push(g);
    });
    return lab.addons.BufferGeometryUtils.mergeGeometries(parts);
  },
  tickBricks(lab, dt) {
    const st = lab.state, juicy = lab.juicy('squash'), C = lab.THREE.Color, col = st.tmpC || (st.tmpC = new C());
    for (const k of st.bricks) {
      if (k.hp <= 0) {
        if (!k.gone) { k.gone = true; lab.place(st.ice, k.i, [0, -50, 0], { scale: 0.001 }); lab.place(st.cracks, k.i, [0, -50, 0], { scale: 0.001 }); lab.place(st.gems, k.i, [0, -50, 0], { scale: 0.001 }); }
        continue;
      }
      if (k.y > 0) {
        if (!juicy) k.y = 0;
        else { k.delay -= dt; if (k.delay <= 0) { k.ft = (k.ft || 0) + dt; const q = Math.min(1, k.ft / 0.45); k.y = q >= 1 ? 0 : 7 * (1 - lab.ease.outBounce(q)); if (q >= 1) k.pop = 0.6; } }
      }
      k.pop = Math.max(0, k.pop - dt * 6); k.wob = Math.max(0, k.wob - dt * 3); k.white = Math.max(0, k.white - dt);
      const s = juicy ? k.pop * 0.22 : 0, rot = juicy ? Math.sin(lab.t * 40 + k.i) * k.wob * 0.12 : 0;
      col.set(k.tough && k.hp === 1 ? '#86b6ff' : k.color);
      if (k.white > 0) col.set('#ffffff').multiplyScalar(1.5);
      lab.place(st.ice, k.i, [k.x, this.BY + k.y, k.z], { rot, scale: [1 + s, 1 - s * 0.8, 1 + s], color: '#' + col.getHexString() });
      if (k.tough && k.hp === 1) lab.place(st.cracks, k.i, [k.x, this.BY + 0.42 + k.y, k.z], { rot });
      if (k.gift) lab.place(st.gems, k.i, [k.x, this.BY + 0.62 + k.y + Math.sin(lab.t * 3 + k.i) * 0.08, k.z], { rot: [0, lab.t * 2 + k.i, 0], scale: 1 + s });
    }
  },

  /* ---------- осколки и лужицы (свои частицы игры: переключатель «Частицы») ---------- */
  debris(lab) {
    const st = lab.state, T = lab.THREE, N = 140;
    st.shardMesh = lab.instances(new T.IcosahedronGeometry(0.22, 0), lab.mat('#ffffff', { shiny: true }), N);
    st.shardList = Array.from({ length: N }, () => ({ on: false, x: 0, y: 0, z: 0, vx: 0, vy: 0, vz: 0, r: 0, s: 1, life: 0, col: '#ffffff' }));
    const pg = new T.CircleGeometry(1, 14); pg.rotateX(-Math.PI / 2);
    const pm = new T.MeshStandardMaterial({ color: '#a9e2ff', roughness: 0.05, metalness: 0.4, transparent: true, opacity: 0.55, depthWrite: false });
    st.puddleMesh = lab.instances(pg, pm, 30); lab.noShadow(st.puddleMesh); st.puddleMesh.receiveShadow = true;
    st.puddles = []; st.pi = 0;
  },
  shards(lab, x, z, vx, vz, n, color) {
    if (!lab.juicy('burst')) return;
    const st = lab.state;
    for (const q of st.shardList) {
      if (n <= 0) break;
      if (q.on) continue;
      Object.assign(q, { on: true, x: x + lab.rand(-0.4, 0.4), y: 0.6, z: z + lab.rand(-0.3, 0.3), vx: vx + lab.rand(-3, 3), vy: lab.rand(2.5, 6), vz: vz + lab.rand(-3, 3),
        r: lab.rand(0, 6), s: lab.rand(0.6, 1.5), life: lab.rand(1.2, 2), col: color });
      n--;
    }
  },
  puddle(lab, x, z) {
    if (!lab.juicy('burst')) return;
    const st = lab.state;
    st.puddles[st.pi] = { x: x + lab.rand(-0.2, 0.2), z: z + lab.rand(-0.2, 0.2), t: 0, s: lab.rand(0.6, 0.95) };
    st.pi = (st.pi + 1) % 30;
  },
  tickDebris(lab, dt) {
    const st = lab.state, m = st.shardMesh;
    st.shardList.forEach((q, i) => {
      if (!q.on) return;
      q.life -= dt;
      if (q.life <= 0) { q.on = false; lab.place(m, i, [0, -50, 0], { scale: 0.001 }); return; }
      q.vy -= 18 * dt; q.x += q.vx * dt; q.y += q.vy * dt; q.z += q.vz * dt; q.r += dt * 6;
      if (q.y < 0.1) { q.y = 0.1; q.vy = -q.vy * 0.3; q.vx *= 0.75; q.vz *= 0.75; } // скачут и скользят по льду пола
      if (Math.abs(q.x) > this.W - 0.1) { q.x = Math.sign(q.x) * (this.W - 0.1); q.vx *= -0.5; }
      lab.place(m, i, [q.x, q.y, q.z], { rot: [q.r, q.r * 0.7, 0], scale: q.s * Math.min(1, q.life / 0.4), color: q.col });
    });
    st.puddles.forEach((p, i) => {
      if (!p) return;
      p.t += dt;
      const k = p.t < 0.3 ? lab.ease.outBack(p.t / 0.3) : Math.max(0, 1 - (p.t - 3) / 3);
      lab.place(st.puddleMesh, i, [p.x, 0.09 + i * 0.0005, p.z], { scale: [p.s * k * 1.2, 1, p.s * k] });
      if (p.t > 6) { st.puddles[i] = null; lab.place(st.puddleMesh, i, [0, -50, 0], { scale: 0.001 }); }
    });
  },

  /* ---------- картинка: хычин с глазами, лопата пекаря, ледяная пещера ---------- */
  buildBall(lab) {
    const st = lab.state, R = this.R, node = lab.group();
    const pie = lab.group({ parent: node });
    lab.cyl(R * 1.2, R * 1.28, 0.32, '#f0b04a', { parent: pie, glow: 0.12, sides: 12 });
    lab.cyl(R * 0.92, R * 1.1, 0.1, '#b9652a', { parent: pie, at: [0, 0.19, 0], sides: 9 });
    const fire = lab.cone(0.2, 0.6, '#ff7a2b', { parent: node, at: [0, 0.1, -0.55], rot: [-Math.PI / 2, 0, 0], glow: 0.9, sides: 5 });
    const eyes = lab.group({ parent: node, at: [0, 0.27, 0.12], scale: 1.25 });
    for (const s of [-1, 1]) {
      lab.ball(0.12, '#ffffff', { parent: eyes, at: [s * 0.14, 0, 0], scale: [1, 0.6, 1], detail: 0 });
      lab.ball(0.06, '#1a1010', { parent: eyes, at: [s * 0.14, 0.05, 0.07], detail: 0 });
    }
    lab.noShadow(eyes); lab.noShadow(fire);
    const light = st.lights.find(l => !st.balls.some(b => b.light === l)) || null;
    return { node, pie, fire, eyes, light, x: 0, z: this.PZ - 0.7, vx: 0, vz: -1, speed: lab.cfg.speed, sq: 0, squint: 0, blink: lab.rand(2, 5), stuck: -1, off: 0, hold: 0, through: false, dead: false, trail: null, heat: 0, serve: false };
  },
  drawBalls(lab, dt) {
    const st = lab.state, squash = lab.juicy('squash'), glow = lab.juicy('glow');
    for (const b of st.balls) {
      const n = b.node;
      n.position.set(b.x, this.BY, b.z);
      st.lastX = b.x;
      b.sq = lab.damp(b.sq, 0, 14, dt); b.squint = Math.max(0, b.squint - dt);
      const s = squash ? b.sq : 0, str = squash && b.stuck < 0 ? Math.min(0.28, b.speed * 0.014) : 0; // сжатие при ударе и растяжение по полёту
      n.scale.set(1 + s * 0.5, 1 - s * 0.35, 1 + str - s * 0.4);
      if (b.stuck < 0) n.rotation.y = Math.atan2(b.vx, b.vz);
      else n.rotation.y = lab.damp(n.rotation.y, Math.PI, 10, dt);
      b.pie.rotation.y += dt * 9;
      b.blink -= dt; if (b.blink < -0.12) b.blink = lab.rand(2, 5);
      b.eyes.scale.y = (b.blink < 0 ? 0.15 : 1) * (squash && b.squint > 0 ? 0.35 : 1); // моргает и щурится от удара
      const fl = glow ? 1 + Math.sin(lab.t * 31 + b.x) * 0.18 : 1;
      const hk = 0.7 + b.heat * 0.14; // пламя растёт с жаром
      b.fire.scale.set(fl * hk, fl * hk * (b.stuck < 0 ? 1 : 0.5), fl * hk);
      if (b.light) { b.light.position.set(b.x, 1.3, b.z); b.light.intensity = n.visible ? (glow ? 18 * fl * (b.through ? 1.4 : 1) : 8) : 0; b.light.color.set(b.through ? '#9fe6ff' : '#ff9a3c'); }
      if (lab.juicy('burst') && !b.trail && b.stuck < 0) b.trail = lab.trail(b.fire, { color: b.through ? '#8fe8ff' : '#ff8a3d', width: 0.45, length: 14, glow: 1.4 });
      if (b.trail && (!lab.juicy('burst') || b.stuck >= 0)) { b.trail.dispose(); b.trail = null; }
    }
  },
  drawCamera(lab, dt) { // наезд камеры на последний кирпич (Peggle) и обратно
    const st = lab.state, v = lab.view, z = st.zoom;
    if (!v) return;
    if (!st.cam) st.cam = { d: v.distance, x: v.target.x, z: v.target.z };
    if (!z) return;
    const k = z.out ? 0 : 1;
    v.target.x = lab.damp(v.target.x, lab.lerp(st.cam.x, z.x, 0.45 * k), 5, dt);
    v.target.z = lab.damp(v.target.z, lab.lerp(st.cam.z, z.z, 0.45 * k), 5, dt);
    v.distance = lab.damp(v.distance, st.cam.d * (1 - 0.32 * k), 5, dt);
    if (z.out && Math.abs(v.distance - st.cam.d) < 0.05) { v.distance = st.cam.d; v.target.x = st.cam.x; v.target.z = st.cam.z; st.zoom = null; }
  },
  buildPaddle(lab, x, input, i) {
    const node = lab.group({ at: [x, 0, this.PZ] }), wood = i ? '#9fd36a' : '#d9944f';
    const blade = lab.box(1, 0.24, 0.64, wood, { parent: node, at: [0, this.BY - 0.05, 0] });
    const rim = lab.box(1, 0.1, 0.1, '#ffe2a8', { parent: node, at: [0, this.BY + 0.1, -0.3], glow: 0.6 });
    const ends = [-1, 1].map(s => lab.cyl(0.17, 0.17, 0.7, i ? '#6fae3f' : '#a8642c', { parent: node, at: [s * 1.7, this.BY - 0.05, 0], rot: [Math.PI / 2, 0, 0], sides: 6 }));
    lab.cyl(0.09, 0.09, 1.5, '#8a5a33', { parent: node, at: [0, this.BY - 0.02, 1.05], rot: [Math.PI / 2, 0, 0], sides: 6 }); // черенок к пекарю
    lab.ball(0.15, '#8a5a33', { parent: node, at: [0, this.BY - 0.02, 1.85], detail: 0 });
    return { node, blade, rim, ends, x, vx: 0, lean: 0, wk: 1, input, k: lab.players === 2 ? 0.8 : 1 };
  },
  // ледяная пещера Лаго-Наки: тёмный блестящий лёд пола, стены из глыб под снегом, кристаллы, расщелина за лопатой, Фишт в проёме
  cave(lab, scene) {
    const T = lab.THREE, st = lab.state, W = this.W, TOP = this.TOP, PZ = this.PZ;
    lab.ground({ w: 160, h: 160, color: '#cfe3f5', bumps: 5, flat: 0.2 });
    const zA = -TOP, zB = PZ + 0.9, len = zB - zA;
    lab.box(W * 2 + 0.2, 0.1, len, lab.mat('#2a5f92', { shiny: true, metal: 0.1 }), { at: [0, 0.03, (zA + zB) / 2] });
    // разметка на льду пола: тонкие светлые прожилки
    const veins = [];
    for (let i = 0; i < 18; i++) veins.push(lab.box(lab.rand(1, 3.5), 0.02, 0.05, '#7fb3e3', { at: [lab.rand(-W + 1, W - 1), 0.09, lab.rand(zA + 1, zB - 1)], rot: lab.rand(0, 3), shadow: false }));
    lab.merge(veins);
    // расщелина за лопатой: сюда падает хычин
    lab.box(W * 2 + 2.6, 0.12, 2.2, lab.mat('#050b18', { unlit: true }), { at: [0, 0.02, zB + 1.1], shadow: false });
    lab.box(W * 2 + 2.6, 0.06, 0.12, '#ff6a3d', { at: [0, 0.1, zB + 0.05], glow: 0.5, shadow: false });
    // стены из ледяных глыб со снежными шапками
    const ice = [], snow = [];
    const block = (x, z, w, d) => {
      const h = lab.rand(0.9, 1.5), c = lab.pick(['#6fb4ea', '#5aa3e0', '#8cc8f2']);
      ice.push(lab.box(w, h, d, lab.mat(c, { shiny: true }), { at: [x, h / 2, z], rot: lab.rand(-0.06, 0.06) }));
      snow.push(lab.box(w * 0.85, 0.14, d * 0.8, '#ffffff', { at: [x, h + 0.04, z], rot: lab.rand(-0.15, 0.15) }));
    };
    for (let z = zA - 0.6; z < zB; z += 1.6) { block(-W - 0.7, z + 0.8, 1.3, 1.55); block(W + 0.7, z + 0.8, 1.3, 1.55); }
    for (let x = -W - 1.4; x < W + 1.4; x += 1.75) block(x + 0.87, zA - 0.65, 1.7, 1.3);
    lab.merge(ice); lab.merge(snow);
    // глыбы и кристаллы вокруг пещеры
    const N = 30, rocks = lab.instances(new T.IcosahedronGeometry(1, 0), lab.mat('#a8d2f2', { shiny: true }), N);
    for (let i = 0; i < N; i++) {
      const side = i % 2 ? 1 : -1, back = i >= 22;
      const x = back ? lab.rand(-20, 20) : side * lab.rand(W + 5, 24), z = back ? lab.rand(-TOP - 9, -TOP - 2.5) : lab.rand(zA - 6, zB + 4);
      lab.place(rocks, i, [x, 0.4, z], { scale: [lab.rand(1, 2.4), lab.rand(1.2, 3.5), lab.rand(1, 2.4)], rot: [lab.rand(0, 1), lab.rand(0, 6), lab.rand(0, 1)] });
    }
    const M = 40, crystals = lab.instances(new T.ConeGeometry(0.35, 1, 5), lab.mat('#ffffff', { unlit: true, glow: 0.8 }), M);
    lab.noShadow(crystals);
    for (let i = 0; i < M; i++) {
      const side = i % 2 ? 1 : -1, back = i >= 30, h = lab.rand(0.8, 2.6);
      const x = back ? lab.rand(-W, W) : side * lab.rand(W + 1.6, W + 4.5), z = back ? lab.rand(-TOP - 3.5, -TOP - 1.6) : lab.rand(zA, zB + 1);
      lab.place(crystals, i, [x, h / 2, z], { scale: [1, h, 1], rot: [lab.rand(-0.3, 0.3), lab.rand(0, 6), lab.rand(-0.3, 0.3)], color: lab.pick(['#6fe3ff', '#9aa8ff', '#7ef0d8', '#c7b3ff']) });
    }
    // Фишт и горы в проёме пещеры
    const hills = [];
    for (let i = 0; i < 8; i++) {
      const x = -56 + i * 16 + lab.rand(-4, 4), z = -55 - lab.rand(0, 15), r = lab.rand(10, 17), h = lab.rand(16, 28);
      hills.push(lab.cone(r, h, '#5d6f9e', { at: [x, h / 2 - 1, z], sides: 6, rot: lab.rand(0, 3) }));
      hills.push(lab.cone(r * 0.4, h * 0.4, '#f4f8ff', { at: [x, h - 1 - h * 0.2 + 0.05, z], sides: 6, rot: lab.rand(0, 3) }));
    }
    lab.noShadow(lab.merge(hills));
    // звёзды и снег
    const pts = [];
    for (let i = 0; i < 260; i++) { const a = lab.rand(0, Math.PI * 2), e = lab.rand(0.2, 1.2); pts.push(Math.cos(a) * Math.cos(e) * 150, Math.sin(e) * 150, Math.sin(a) * Math.cos(e) * 150); }
    const sg = new T.BufferGeometry(); sg.setAttribute('position', new T.Float32BufferAttribute(pts, 3));
    scene.add(new T.Points(sg, new T.PointsMaterial({ color: '#ffffff', size: 0.9, fog: false })));
    const flakes = new Float32Array(300 * 3);
    for (let i = 0; i < 300; i++) { flakes[i * 3] = lab.rand(-16, 16); flakes[i * 3 + 1] = lab.rand(0, 14); flakes[i * 3 + 2] = lab.rand(-20, 16); }
    const fg = new T.BufferGeometry(); fg.setAttribute('position', new T.BufferAttribute(flakes, 3));
    st.snow = new T.Points(fg, new T.PointsMaterial({ color: '#ffffff', size: 0.12, transparent: true, opacity: 0.8, depthWrite: false }));
    st.snow.frustumCulled = false;
    scene.add(st.snow);
  },
  drawSnow(lab, dt) {
    const a = lab.state.snow.geometry.attributes.position;
    for (let i = 0; i < a.count; i++) {
      let y = a.getY(i) - dt * 1.1;
      if (y < 0) y += 14;
      a.setY(i, y); a.setX(i, a.getX(i) + Math.sin(lab.t + i) * dt * 0.3);
    }
    a.needsUpdate = true;
  },
};
