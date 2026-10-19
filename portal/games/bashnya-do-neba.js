// «Башня до неба» — ремейк-донор урока 8 по мотивам Stack (Ketchapp, 2016) на оболочке «Лаб3D» 1.0 (three.js).
// Одна кнопка ставит каменную плиту на башню над плато Лаго-Наки. Плита ездит туда-сюда, нажатие её останавливает,
// всё, что свисает, отрезается и падает к подножию. Чем выше башня, тем ближе небо: день, закат, звёзды.
// Спрятанная механика донора — окно «идеально»: промах на пару сантиметров засчитывается как точное попадание, плита встаёт ровно,
// а серия точных попаданий возвращает плите ширину. Ручка secret = 0 (пресет «Без спрятанной механики») — честная линейка без прощения.
// Вдвоём (ручка duel) — две башни рядом: у каждого своя кнопка, кто первым дотянется до ленты или выше — победил.
// Из лучших игр жанра (разбор — в журнале курса): волна «идеально» и нота выше (Stack), качание башни после неточной плиты
// (Tower Bloxx), лента финиша вдвоём (Tricky Towers), тик-тик перед точкой (Rhythm Heaven), лента рекорда (Doodle Jump).
const GAME = {
  engine: 'three',
  title: 'Башня до неба',
  subtitle: 'Одна кнопка. Останови плиту ровно над башней — и строй выше облаков!',
  donor: 'Stack',
  players: 1,
  duo: 'duel', // ручка duel = 1 — две башни рядом
  controls: [
    { input: 'a', text: 'поставить плиту' },
  ],
  camera: { type: 'iso', tilt: 1.18, turn: Math.PI / 4, target: [0, 1.5, 0], distance: 22, fov: 0.6 },
  field: { w: 12, h: 12 },
  sky: ['#4aa8ff', '#cdeeff'],
  fog: 0.006,
  accent: '#ffd23f',
  lives: 3,
  decisions: [
    'Чувство: поймал момент — плита встала ровно, по башне прошла волна, и нота стала выше',
    'Честность: красным подсвечено ровно то, что свисает, — ровно это и отрежется',
    'Выбор: ждать идеального момента или жать сразу, пока плита не разогналась и не устала ждать',
  ],
  notes: [
    'Плита, которая проехала туда и обратно и не дождалась нажатия, срывается сама: иначе можно стоять вечно (ручка «Терпение плиты»).',
    'Перед тем как плита встанет точно над башней, звучит тихое «тик-тик»: звук подсказывает момент раньше картинки.',
    'Неточная плита раскачивает башню, точная её успокаивает. Качание только для вида, на попадание оно не влияет.',
  ],
  config: {
    size: { value: 3.4, min: 1.5, max: 6, step: 0.1, label: 'Ширина первой плиты, м', restart: true },
    speed: { value: 3.2, min: 1, max: 8, step: 0.1, label: 'Скорость плиты, м/с' },
    speedup: { value: 0.07, min: 0, max: 0.3, step: 0.01, label: 'Разгон за каждую плиту' },
    maxSpeed: { value: 7, min: 2, max: 14, step: 0.5, label: 'Предельная скорость' },
    range: { value: 4.2, min: 2, max: 8, step: 0.2, label: 'Размах хода плиты, м' },
    thick: { value: 0.5, min: 0.2, max: 1.2, step: 0.05, label: 'Толщина плиты, м', restart: true },
    snap: { value: 0.12, min: 0, max: 0.4, step: 0.01, label: 'Окно «идеально», м', hint: 'промах меньше окна — плита встаёт ровно' },
    grow: { value: 4, min: 1, max: 12, step: 1, label: 'Серия «идеально», которая расширяет плиту' },
    growBy: { value: 0.25, min: 0, max: 1, step: 0.05, label: 'На сколько расширить, м' },
    patience: { value: 2, min: 0, max: 8, step: 1, label: 'Терпение плиты: проездов до срыва', hint: '0 — плита ездит, сколько угодно; на последнем проезде она мигает красным' },
    cue: { value: 1, min: 0, max: 1, step: 1, label: 'Тик-тик перед точкой', names: ['выкл', 'вкл'], hint: 'два тихих щелчка за полсекунды и четверть секунды до того, как плита встанет над башней' },
    sway: { value: 1, min: 0, max: 2, step: 0.1, label: 'Качание башни от неточной плиты' },
    lives: { value: 3, min: 1, max: 5, step: 1, label: 'Плит, которые можно уронить', restart: true },
    secret: { value: 1, min: 0, max: 1, step: 1, label: 'Спрятанная механика: окно «идеально» и рост за серию' },
    duel: { value: 0, min: 0, max: 1, step: 1, label: 'Вдвоём: две башни', restart: true },
    goal: { value: 40, min: 0, max: 120, step: 5, label: 'Вдвоём: лента финиша на высоте, плит', hint: '0 — без ленты: побеждает тот, чья башня выше', restart: true },
  },
  presets: {
    'Новичок': { speed: 2.2, speedup: 0.03, snap: 0.2, size: 4.2, patience: 4 },
    'Без спрятанной механики': { secret: 0 },
    'Вдвоём': { duel: 1 },
    'Ветер': { speed: 4.5, speedup: 0.12, maxSpeed: 10, range: 5.5, sway: 2 },
  },

  NOTES: [262, 294, 330, 392, 440, 523, 587, 659, 784, 880, 1047, 1175], // пентатоника вверх: каждая точная плита подряд — нота выше
  MILESTONES: [[4, 'Выше сакли!'], [9, 'Выше орла!'], [14, 'Выше облаков!'], [22, 'Закат'], [32, 'Звёзды!'], [50, 'Почти космос!'], [75, 'До неба!']],
  bestN: 0, // лучшая башня за этот заход в игру: лента рекорда (у каждой страницы своя)

  start(lab, scene) {
    const st = lab.state, c = lab.cfg, two = lab.players === 2, T3 = lab.THREE;
    // вдвоём башни стоят рядом поперёк взгляда камеры (камера смотрит по диагонали, как в Stack)
    lab.setCamera({ type: 'iso', tilt: 1.18, turn: Math.PI / 4, target: [0, 1.5, 0], distance: two ? 31 : 22, fov: 0.6 });
    Object.assign(st, { towers: [], falls: [], offs: [], best: 0, top: 0, topH: 0, dist: lab.view.distance, punch: 0, mile: 0, ending: null, ended: false, record: false });
    st.geo = new T3.BoxGeometry(1, 1, 1);
    this.world(lab, scene);
    st.rubble = lab.instances(st.geo, '#ffffff', 90); st.rubbleI = 0; // отрезки у подножия — одна пачка копий
    const R = [Math.cos(Math.PI / 4), -Math.sin(Math.PI / 4)]; // «вправо по экрану» на земле
    const players = two ? [[-4, lab.p1, 'Синий', 205], [4, lab.p2, 'Красный', 2]] : [[0, lab.p1, '', 18]];
    players.forEach(([k, pad, name, hue], i) => st.towers.push(this.tower(lab, R[0] * k, R[1] * k, pad, name, hue, i)));
    lab.hero(st.towers[0].mvG);
    if (two) lab.lives = 0; // вдвоём у каждой башни свои плиты — в строке над башнями
    if (two && c.goal > 0) this.ribbon(lab, c.goal * c.thick, '#7cf5a8', 'финиш');
    else if (!two && this.bestN >= 5) st.recordY = this.ribbon(lab, this.bestN * c.thick, '#ffd23f', 'рекорд');
    this.skyAt(lab, 0, true);
  },

  update(lab, dt) {
    const st = lab.state, c = lab.cfg;
    for (const T of st.towers) {
      this.swayStep(lab, T, dt);
      if (T.out || st.ending) continue;
      if (T.wait > 0) { T.wait -= dt; if (T.wait <= 0) this.spawn(lab, T); continue; }
      this.slide(lab, T, dt);
      if (T.pad.pressed.a) this.place(lab, T);
    }
    this.fallStep(lab, dt);
    st.top = Math.max(...st.towers.map(T => T.n));
    st.topH = st.top * c.thick;
    this.milestones(lab);
    this.cameraStep(lab, dt);
    this.skyAt(lab, st.topH);
    this.ambient(lab, dt);

    if (!st.ending && !st.ended && st.towers.every(T => T.out)) this.finish(lab);
    if (st.ending && (st.ending.t -= dt) <= 0 && !st.ended) {
      st.ended = true;
      if (st.ending.win) lab.win(st.ending.text); else lab.gameOver(st.ending.text);
    }
    const two = st.towers.length === 2;
    lab.hud('h', st.towers.map(T => (T.name ? T.name + ': ' : '') + `${(T.n * c.thick).toFixed(1)} м · плит ${T.n}` + (two ? ' ' + '▮'.repeat(Math.max(0, T.lives)) : '')).join('   '));
    const T0 = st.towers[0];
    lab.hud('combo', two ? null : T0.combo > 1 ? `Идеально ×${T0.combo}` : T0.n === 0 && !T0.out ? 'Жми, когда плита над башней' : null);
    lab.hud('warn', st.towers.some(T => T.tired && !T.out) ? 'Плита сейчас сорвётся — жми!' : null);
  },

  overNote(lab) {
    const st = lab.state, offs = st.offs, c = lab.cfg;
    const avg = offs.length ? Math.round(100 * offs.reduce((a, b) => a + b, 0) / offs.length) : 0;
    const T = st.towers[0];
    return [`Плит: ${st.towers.map(t => t.n).join(' и ')} (${st.towers.map(t => (t.n * c.thick).toFixed(1)).join(' и ')} м), идеально: ${st.towers.map(t => t.perfect).join(' и ')}, лучшая серия ${st.best}`,
      offs.length ? `Промах в среднем ${avg} см от края башни` : 'Ни одной плиты — нажми, когда плита над башней',
      c.secret ? `Окно «идеально» поймало ${T.saved} промахов на пару сантиметров` : 'Спрятанная механика выключена: каждый сантиметр промаха отрезается',
      st.record ? 'Новый рекорд этой игры — лента рекорда поднялась' : ''].filter(Boolean);
  },

  /* ---------- башня: подножие, плиты, ход, постановка ---------- */
  tower(lab, x0, z0, pad, name, hue, i) {
    const c = lab.cfg, st = lab.state, T3 = lab.THREE;
    const T = { x0, z0, pad, name, hue, i, n: 0, combo: 0, perfect: 0, saved: 0, lives: c.lives, wait: 0, out: false, dir: 1, mv: null,
      rects: [], swayX: 0, swayZ: 0, vX: 0, vZ: 0, passes: 0, tired: false, tc: Infinity };
    // подножие: широкий камень на плато и два стоячих камня, как у дольмена
    const P = c.size + 0.8;
    lab.box(P, 1.25, P, '#8d7b68', { at: [x0, -0.6, z0], round: 0.08 });
    lab.box(P + 0.5, 0.25, P + 0.5, '#76675a', { at: [x0, -1.1, z0] });
    for (const s of [-1, 1]) lab.box(0.5, 1.8 + s * 0.2, 0.35, '#9a8a77', { at: [x0 + s * (P / 2 + 0.5), -0.3, z0 - s * (P / 2 + 0.5)], rot: Math.PI / 4, round: 0.06 });
    T.base = P / 2;
    T.root = lab.group({ at: [x0, 0, z0] }); // всё, что качается: плиты, едущая плита, волны
    T.inst = lab.instances(st.geo, '#ffffff', 420, { parent: T.root });
    T.freshMat = new T3.MeshStandardMaterial({ color: '#ffffff', roughness: 0.78, flatShading: true });
    T.freshG = lab.group({ parent: T.root }); T.fresh = lab.mesh(st.geo, T.freshMat, { parent: T.freshG }); T.freshG.visible = false;
    T.mvMat = new T3.MeshStandardMaterial({ color: '#ffffff', roughness: 0.78, flatShading: true, emissive: '#ff2d2d', emissiveIntensity: 0 });
    T.mvG = lab.group({ parent: T.root }); T.mvMesh = lab.mesh(st.geo, T.mvMat, { parent: T.mvG });
    T.over = lab.mesh(st.geo, lab.mat('#ff3030', { unlit: true, alpha: 0.5 }), { parent: T.root, shadow: false }); T.over.visible = false;
    T.top = { x: 0, z: 0, w: c.size, d: c.size, y: 0 };
    this.spawn(lab, T);
    return T;
  },
  color(lab, n, T) {
    // плиты меняют оттенок с высотой, как слои горы; вдвоём оттенок держится около цвета игрока
    const two = lab.players === 2;
    const h = two ? T.hue + 22 * Math.sin(n * 0.35) : T.hue + n * 8;
    const q = Math.round((((h % 360) + 360) % 360) / 5) * 5; // 72 оттенка на круг — материалы из кэша
    const l = 0.6 + 0.06 * Math.sin(n * 0.9);
    return '#' + new lab.THREE.Color().setHSL(q / 360, 0.58, l).getHexString();
  },
  w(T, x, y, z) { T.root.updateMatrixWorld(); return T.root.localToWorld(new THREE.Vector3(x, y, z)); }, // точка башни → мир
  spawn(lab, T) {
    const c = lab.cfg, t = T.top, axis = T.n % 2 ? 'z' : 'x';
    const mv = { axis, x: t.x, z: t.z, w: t.w, d: t.d, y: (T.n + 0.5) * c.thick };
    const mid = axis === 'x' ? t.x : t.z, from = mid + (T.n % 4 < 2 ? -1 : 1) * c.range;
    mv[axis] = from; T.dir = from < mid ? 1 : -1;
    T.mv = mv; T.passes = 0; T.tired = false; T.tc = Infinity;
    T.mvMat.color.set(this.color(lab, T.n + 1, T)); T.mvMat.emissiveIntensity = 0;
    T.mvG.visible = true;
    T.mvMesh.scale.set(t.w, c.thick, t.d);
    this.drawMv(lab, T);
  },
  drawMv(lab, T) {
    const v = T.mv, c = lab.cfg;
    T.mvG.position.set(v.x, v.y, v.z);
    // красным — ровно то, что свисает за край башни и отрежется (со спрятанной механикой — только если промах больше окна «идеально»)
    const a = v.axis, sz = a === 'x' ? 'w' : 'd', delta = v[a] - T.top[a], over = Math.min(Math.abs(delta), v[sz]);
    const forgiven = over <= 0.005 || (c.secret && over <= c.snap);
    T.over.visible = !forgiven;
    if (forgiven) return;
    const len = over, cpos = v[a] + Math.sign(delta) * (v[sz] / 2 - len / 2);
    T.over.position.set(a === 'x' ? cpos : v.x, v.y, a === 'x' ? v.z : cpos);
    T.over.scale.set(a === 'x' ? len + 0.02 : v.w + 0.02, c.thick + 0.02, a === 'x' ? v.d + 0.02 : len + 0.02);
  },
  slide(lab, T, dt) {
    const c = lab.cfg, v = T.mv, a = v.axis, mid = a === 'x' ? T.top.x : T.top.z;
    const sp = Math.min(c.maxSpeed, c.speed + c.speedup * T.n);
    v[a] += T.dir * sp * dt;
    let bounced = false;
    if (v[a] > mid + c.range) { v[a] = mid + c.range; T.dir = -1; bounced = true; }
    if (v[a] < mid - c.range) { v[a] = mid - c.range; T.dir = 1; bounced = true; }
    if (bounced) {
      T.passes++; T.tc = Infinity;
      if (c.patience > 0 && T.passes >= c.patience) { this.topple(lab, T, true); return; }
    }
    T.tired = c.patience > 0 && T.passes >= c.patience - 1; // последний проезд: плита мигает красным
    T.mvMat.emissiveIntensity = T.tired ? (Math.floor(lab.t * 8) % 2 ? 0.55 : 0.1) : 0;
    // тик-тик: за полсекунды и четверть секунды до того, как плита встанет ровно над башней
    const tc = (mid - v[a]) / (T.dir * sp);
    if (c.cue && tc > 0) {
      if (T.tc > 0.5 && tc <= 0.5) lab.tone(1250, 0.03, 'sine', 0.035);
      if (T.tc > 0.25 && tc <= 0.25) lab.tone(1660, 0.03, 'sine', 0.045);
    }
    T.tc = tc > 0 ? tc : Infinity;
    this.drawMv(lab, T);
  },
  place(lab, T) {
    if (!T.mv) return;
    const c = lab.cfg, st = lab.state, v = T.mv, a = v.axis, sz = a === 'x' ? 'w' : 'd', t = T.top;
    const delta = v[a] - t[a], over = Math.abs(delta), size = v[sz];
    st.offs.push(over);
    if (over <= 0.005 || (c.secret && over <= c.snap)) { // окно «идеально»: плита встаёт ровно
      v[a] = t[a];
      if (over > 0.005) { T.saved++; lab.count('_secret'); }
      T.combo++; T.perfect++; st.best = Math.max(st.best, T.combo);
      lab.count('идеально');
      if (c.secret && T.combo >= c.grow && c.growBy > 0) this.widen(lab, T);
      this.settle(lab, T, true);
      return;
    }
    T.combo = 0;
    if (over >= size) return this.topple(lab, T, false); // мимо башни — плита падает целиком
    const keep = size - over, cx = t[a] + delta / 2;
    // отрезок: то, что свисало, падает в сторону промаха
    const cpos = cx + Math.sign(delta) * (keep / 2 + over / 2), s = Math.sign(delta);
    this.drop(lab, T, a === 'x' ? cpos : v.x, v.y, a === 'x' ? v.z : cpos, a === 'x' ? over : v.w, a === 'x' ? v.d : over, this.color(lab, T.n + 1, T),
      { vx: a === 'x' ? s * 1.6 : 0, vz: a === 'z' ? s * 1.6 : 0, spinX: a === 'z' ? s * 4 : 0, spinZ: a === 'x' ? -s * 4 : 0 });
    v[sz] = keep; v[a] = cx;
    lab.count('срезано, см', Math.round(over * 100));
    const wp = this.w(T, a === 'x' ? cpos : v.x, v.y, a === 'x' ? v.z : cpos);
    lab.burst(wp, { count: 10, colors: ['#ffffff', '#d9cbb8', this.color(lab, T.n + 1, T)], speed: 3, up: 1 });
    lab.noise(0.12, 0.1, 900); lab.tone(150, 0.1, 'triangle', 0.08, 90);
    lab.shake(Math.min(0.35, over * 0.5));
    // неточная плита раскачивает башню (Tower Bloxx): чем больше промах, тем сильнее
    const kick = Math.min(0.03, over * 0.03) * c.sway;
    if (a === 'x') T.vX -= s * kick * 6; else T.vZ += s * kick * 6;
    this.settle(lab, T, false);
  },
  widen(lab, T) {
    const v = T.mv, a = v.axis === 'x' ? 'w' : 'd', max = lab.cfg.size;
    if (v[a] >= max - 0.01) return;
    v[a] = Math.min(max, v[a] + lab.cfg.growBy);
    lab.popup(this.w(T, v.x, v.y + 0.6, v.z), 'Шире!', '#7cf5a8', 22); lab.flash('#ffffff', 0.2); lab.sfx.power();
    T.grew = true;
  },
  settle(lab, T, perfect) {
    const v = T.mv, c = lab.cfg, st = lab.state;
    T.over.visible = false; T.mvG.visible = false;
    // прежняя свежая плита уходит в пачку копий, новая встаёт свежей: её можно сжать и высветить
    if (T.freshG.visible && T.prev) this.bake(lab, T, T.prev);
    const col = this.color(lab, T.n + 1, T);
    T.prev = { x: v.x, y: v.y, z: v.z, w: v.w, d: v.d, color: col, i: T.n };
    T.freshG.visible = true; T.freshG.position.set(v.x, v.y, v.z);
    T.freshMat.color.set(col);
    const was = { w: T.top.w, d: T.top.d };
    if (T.growTw) { T.growTw.cancel(); T.growTw = null; }
    if (T.grew) { // рост: плита раздаётся на глазах
      T.grew = false;
      T.growTw = lab.tween(0.3, k => T.fresh.scale.set(lab.lerp(was.w, v.w, k), c.thick, lab.lerp(was.d, v.d, k)), 'outBack');
    } else T.fresh.scale.set(v.w, c.thick, v.d);
    T.n++;
    T.rects.push({ x: v.x, z: v.z, w: v.w, d: v.d, y: v.y + c.thick / 2 });
    T.top = { x: v.x, z: v.z, w: v.w, d: v.d, y: v.y };
    lab.count('плиты');
    const at = this.w(T, v.x, v.y + c.thick, v.z);
    lab.addScore(perfect ? 10 + 5 * Math.min(T.combo, 6) : 10, at, perfect ? '#ffd23f' : '#ffffff');
    lab.pulse(T.freshG, perfect ? 1.07 : 1.03, 0.16);
    lab.noise(0.05, 0.07, 2200); // щелчок камня о камень
    if (perfect) {
      const note = this.NOTES[Math.min(T.combo - 1, this.NOTES.length - 1)];
      lab.tone(note, 0.24, 'triangle', 0.13); lab.tone(note * 2, 0.3, 'sine', 0.05, 0, 0.04);
      lab.hitstop(0.035); lab.whiten(T.freshG, 0.09);
      this.ripple(lab, T, v, T.combo);
      lab.burst(at, { count: 12 + 2 * Math.min(T.combo, 8), colors: ['#ffd23f', '#ffffff', '#ff8ad8'], speed: 4, up: 1.5 });
      lab.popup(this.w(T, v.x, v.y + 1, v.z), T.combo > 1 ? `Идеально ×${T.combo}` : 'Идеально!', '#ffd23f', 20 + Math.min(T.combo, 6) * 2);
      st.punch = Math.min(1.6, 0.5 + T.combo * 0.12); // камера коротко подаётся к башне
      T.vX *= 0.4; T.vZ *= 0.4; // точная плита успокаивает башню
      lab.vibrate(40, 0.3);
    } else lab.tone(this.NOTES[0] * 0.5, 0.12, 'square', 0.05);
    if (!st.record && st.towers.length === 1 && this.bestN >= 5 && T.n === this.bestN + 1) { // лента рекорда пройдена
      st.record = true;
      lab.popup(this.w(T, v.x, v.y + 1.6, v.z), 'Новый рекорд!', '#ffd23f', 28);
      lab.flash('#ffd23f', 0.25); [523, 659, 784, 1047].forEach((f, k) => lab.tone(f, 0.18, 'triangle', 0.09, 0, k * 0.07));
    }
    if (st.towers.length === 1) this.bestN = Math.max(this.bestN, T.n);
    if (st.towers.length === 2 && c.goal > 0 && T.n >= c.goal && !st.ending) { // лента финиша (Tricky Towers)
      lab.burst(at, { count: 40, colors: ['#7cf5a8', '#ffffff', '#ffd23f'], speed: 7, up: 3 });
      st.towers.forEach(o => { if (o !== T) o.out = true; });
      T.out = true;
      this.finish(lab, `${T.name} первым дотянулся до ленты: ${T.n} плит`);
      return;
    }
    this.spawn(lab, T);
  },
  bake(lab, T, p) { // плита — в пачку копий башни: 400 плит — один вызов отрисовки
    lab.place(T.inst, p.i % T.inst.count, [p.x, p.y, p.z], { scale: [p.w, lab.cfg.thick, p.d], color: p.color });
  },
  ripple(lab, T, v, combo) { // волна «идеально» (Stack): светлая рамка по краю плиты расходится и гаснет
    const T3 = lab.THREE, c = lab.cfg;
    for (let k = 0; k < Math.min(3, 1 + Math.floor(combo / 4)); k++) {
      const geo = this.frameGeo(lab, v.w + 0.1, v.d + 0.1, 0.09), m = new T3.MeshBasicMaterial({ color: new T3.Color('#ffffff').multiplyScalar(1.7), transparent: true, depthWrite: false, blending: T3.AdditiveBlending });
      const r = lab.mesh(geo, m, { parent: T.root, at: [v.x, v.y + c.thick / 2 - 0.02, v.z], shadow: false });
      lab.after(k * 0.09, () => lab.tween(0.55, q => { r.scale.set(1 + q * 0.45, 1, 1 + q * 0.45); m.opacity = 1 - q; if (q >= 1) { r.removeFromParent(); geo.dispose(); m.dispose(); } }, 'outCubic'));
    }
  },
  frameGeo(lab, w, d, b) { // плоская рамка w × d с толщиной b
    const T3 = lab.THREE, s = new T3.Shape(), h = new T3.Path();
    s.moveTo(-w / 2 - b, -d / 2 - b); s.lineTo(w / 2 + b, -d / 2 - b); s.lineTo(w / 2 + b, d / 2 + b); s.lineTo(-w / 2 - b, d / 2 + b); s.lineTo(-w / 2 - b, -d / 2 - b);
    h.moveTo(-w / 2, -d / 2); h.lineTo(-w / 2, d / 2); h.lineTo(w / 2, d / 2); h.lineTo(w / 2, -d / 2); h.lineTo(-w / 2, -d / 2);
    s.holes.push(h);
    const g = new T3.ShapeGeometry(s); g.rotateX(-Math.PI / 2);
    return g;
  },
  topple(lab, T, tired) {
    const st = lab.state, v = T.mv, c = lab.cfg;
    if (!v) return;
    const a = v.axis, s = Math.sign(v[a] - T.top[a]) || T.dir || 1;
    T.over.visible = false; T.mvG.visible = false;
    this.drop(lab, T, v.x, v.y, v.z, v.w, v.d, this.color(lab, T.n + 1, T),
      { vx: a === 'x' ? s * 2.2 : 0, vz: a === 'z' ? s * 2.2 : 0, spinX: a === 'z' ? s * 2.5 : 1.2, spinZ: a === 'x' ? -s * 2.5 : 0.8 });
    T.lives--; T.mv = null; T.combo = 0; T.tired = false; lab.count('уронено');
    if (tired) lab.count('сорвались сами');
    if (lab.players === 1) lab.lives = T.lives;
    if (T.lives > 0) T.wait = 0.7; else T.out = true;
    lab.tone(196, 0.5, 'sawtooth', 0.12, 60); lab.noise(0.3, 0.12, 900);
    lab.shake(0.5); lab.vibrate(250, 0.8); lab.flash('#ff4d5e', 0.18);
    T.vX += (a === 'x' ? -s : 0) * 0.05 * c.sway; T.vZ += (a === 'z' ? s : 0) * 0.05 * c.sway;
    lab.popup(this.w(T, v.x, v.y + 1, v.z), T.lives > 0 ? (tired ? 'Плита не дождалась!' : 'Мимо башни!') : 'Башня готова', '#ff6b6b', 24);
  },
  finish(lab, winText) { // конец партии: камера отъезжает и показывает всю башню, потом — экран итогов
    const st = lab.state, c = lab.cfg;
    if (st.ending) return;
    const two = st.towers.length === 2, [a, b] = st.towers;
    const text = winText || (two ? (a.n === b.n ? `Ничья: по ${a.n} плит` : `${a.n > b.n ? a.name : b.name} выше: ${Math.max(a.n, b.n)} плит против ${Math.min(a.n, b.n)}`)
      : `Башня в ${a.n} плит, ${(a.n * c.thick).toFixed(1)} м`);
    st.ending = { t: 1.6, text, win: two };
    if (two) lab.sfx.win();
  },
  swayStep(lab, T, dt) { // пружина: башня качается и успокаивается
    const k = 26, damp = 3.2;
    T.vX += (-k * T.swayX - damp * T.vX) * dt; T.vZ += (-k * T.swayZ - damp * T.vZ) * dt;
    T.swayX += T.vX * dt; T.swayZ += T.vZ * dt;
    const lim = 0.05; T.swayX = lab.clamp(T.swayX, -lim, lim); T.swayZ = lab.clamp(T.swayZ, -lim, lim);
    T.root.rotation.set(T.swayZ, 0, T.swayX);
  },

  /* ---------- отрезки: кувыркаются, падают к подножию или на выступ башни и остаются лежать ---------- */
  drop(lab, T, x, y, z, w, d, color, o) {
    const st = lab.state, c = lab.cfg, p = this.w(T, x, y, z);
    // куда упадёт: на верх плиты пониже, если под ним башня шире, иначе на подножие или на землю
    let land = -1.2;
    if (Math.abs(x) < T.base && Math.abs(z) < T.base) land = 0;
    for (let k = T.rects.length - 1; k >= 0; k--) { const r = T.rects[k]; if (Math.abs(x - r.x) < r.w / 2 && Math.abs(z - r.z) < r.d / 2) { land = r.y; break; } }
    const m = lab.box(1, 1, 1, color, { at: p });
    m.scale.set(w, c.thick, d);
    st.falls.push({ m, T, w, d, color, land, t: 0, vx: o.vx, vy: 1.2, vz: o.vz, spinX: o.spinX, spinZ: o.spinZ });
  },
  fallStep(lab, dt) {
    const st = lab.state, c = lab.cfg;
    st.falls = st.falls.filter(f => {
      f.t += dt; f.vy -= 22 * dt;
      const m = f.m;
      m.position.x += f.vx * dt; m.position.y += f.vy * dt; m.position.z += f.vz * dt;
      m.rotation.x += f.spinX * dt; m.rotation.z += f.spinZ * dt;
      if (m.position.y - c.thick / 2 > f.land && f.t < 4) return true;
      // лёг: плашмя в пачку копий, пыль и глухой стук
      const at = [m.position.x, f.land + c.thick / 2, m.position.z];
      lab.place(st.rubble, st.rubbleI, at, { scale: [f.w, c.thick, f.d], rot: lab.rand(-0.25, 0.25), color: f.color });
      st.rubbleI = (st.rubbleI + 1) % st.rubble.count;
      lab.burst([at[0], f.land + 0.1, at[2]], { count: 6, colors: ['#d9cbb8', '#a89880'], speed: 2, up: 0.6, gravity: 4 });
      lab.noise(0.08, Math.min(0.12, 0.03 + f.w * f.d * 0.02), 320);
      m.removeFromParent();
      return false;
    });
  },

  /* ---------- камера, высота, небо ---------- */
  cameraStep(lab, dt) {
    const st = lab.state, v = lab.view, two = st.towers.length === 2;
    // чем выше башня, тем ровнее камера смотрит вдаль: за вершиной — небо, а не плато
    let ty = st.topH + 1.2, want = two ? 31 : 22, tilt = lab.lerp(1.18, 1.32, lab.clamp(st.topH / 25, 0, 1));
    if (st.ending) { ty = Math.max(1.5, st.topH * 0.5); want = Math.max(want, st.topH * 1.75 + 10); tilt = 1.2; } // отъезд: вся башня в кадре
    v.tilt = lab.damp(v.tilt, tilt, 2, dt);
    st.punch = lab.damp(st.punch, 0, 7, dt);
    v.target.y = lab.damp(v.target.y, ty, st.ending ? 3.5 : 3, dt);
    st.dist = lab.damp(st.dist, want, st.ending ? 3.5 : 2, dt);
    v.distance = st.dist - st.punch;
  },
  milestones(lab) {
    const st = lab.state, M = this.MILESTONES;
    while (st.mile < M.length && st.topH >= M[st.mile][0]) {
      const T = st.towers.reduce((a, b) => (b.n > a.n ? b : a));
      lab.popup(this.w(T, T.top.x, T.top.y + 2, T.top.z), M[st.mile][1], '#ffffff', 26);
      [392, 523, 659].forEach((f, k) => lab.tone(f, 0.16, 'triangle', 0.07, 0, k * 0.08));
      lab.count('рубежи');
      st.mile++;
    }
  },
  // небо по высоте башни: день → золотой час → закат → сумерки → ночь → почти космос
  SKY: [[0, '#4aa8ff', '#cdeeff', '#fff2dc', 1.9, 0.9], [8, '#3d86e0', '#ffe3b0', '#ffd59a', 1.75, 0.85], [15, '#5a4fa8', '#ff9a6b', '#ff8a5c', 1.35, 0.7],
    [22, '#2a2766', '#c4587a', '#e08aa6', 1.1, 0.6], [32, '#0d1030', '#3a2c66', '#a9b8ff', 1.0, 0.65], [50, '#03040c', '#141a3f', '#b4c2ff', 0.95, 0.6]],
  skyAt(lab, h, force) {
    const st = lab.state, S = this.SKY, T3 = lab.THREE;
    if (!force && Math.abs(h - (st.skyH == null ? -99 : st.skyH)) < 0.02) return;
    st.skyH = h;
    let i = 0; while (i < S.length - 2 && h > S[i + 1][0]) i++;
    const A = S[i], B = S[i + 1], k = lab.clamp((h - A[0]) / (B[0] - A[0]), 0, 1);
    const mix = (p, q) => new T3.Color(p).lerp(new T3.Color(q), k);
    const top = mix(A[1], B[1]), hor = mix(A[2], B[2]);
    const g = st.skyCtx, gr = g.createLinearGradient(0, 0, 0, 256);
    gr.addColorStop(0, '#' + top.getHexString()); gr.addColorStop(0.6, '#' + hor.getHexString()); gr.addColorStop(1, '#' + hor.getHexString());
    g.fillStyle = gr; g.fillRect(0, 0, 2, 256); st.skyTex.needsUpdate = true;
    if (lab.scene.fog) lab.scene.fog.color.copy(hor);
    const L = lab.light;
    L.sun.color.copy(mix(A[3], B[3])); L.sun.intensity = lab.lerp(A[4], B[4], k);
    L.hemi.intensity = lab.lerp(A[5], B[5], k); L.hemi.color.copy(top).lerp(new T3.Color('#ffffff'), 0.55);
    const low = lab.clamp(h / 24, 0, 1); // солнце опускается, тени длиннее
    L.sun.userData.dir.set(0.55, lab.lerp(1, 0.38, low), 0.42).normalize();
    st.stars.material.opacity = lab.clamp((h - 18) / 14, 0, 1);
    st.stars.visible = st.stars.material.opacity > 0.01;
    st.night = lab.clamp((h - 20) / 12, 0, 1);
  },
  ambient(lab, dt) {
    const st = lab.state, v = lab.view, cy = v.target.y, h = st.topH;
    // солнце садится за горы, луна встаёт — за камерой, в глубине кадра
    const el = lab.lerp(0.42, -0.12, lab.clamp(h / 26, 0, 1)), R = 160;
    st.sun.position.set(v.target.x - 0.35 * R, cy + Math.sin(el) * R, v.target.z - 0.94 * R);
    const mel = lab.lerp(-0.2, 0.5, lab.clamp((h - 16) / 20, 0, 1));
    st.moon.position.set(v.target.x - 0.9 * R, cy + Math.sin(mel) * R - 20, v.target.z - 0.3 * R);
    st.stars.position.y = cy;
    // облака плывут, орёл кружит над плато
    st.cloudT += dt;
    st.clouds.forEach((cl, i) => {
      const x = ((cl.x + st.cloudT * cl.v + 60) % 120) - 60;
      cl.puffs.forEach((p, k) => lab.place(st.cloudI, i * 3 + k, [x + p[0], cl.y + p[1], cl.z + p[2]], { scale: [p[3] * 1.4, p[3] * 0.8, p[3]] }));
    });
    const e = st.eagle, t = lab.t * 0.35;
    e.g.position.set(-6 + Math.cos(t) * 13, 9.5 + Math.sin(lab.t * 0.7) * 0.6, -6 + Math.sin(t) * 13); // кружит за башней, не между ней и камерой
    e.g.rotation.y = -t; e.g.rotation.z = 0.25;
    const flap = Math.sin(lab.t * 5) * 0.5;
    e.wl.rotation.z = flap; e.wr.rotation.z = -flap;
  },

  /* ---------- мир: плато, горы, аул, пихты, облака, звёзды, орёл ---------- */
  ribbon(lab, y, color, kind) { // лента на высоте: рамка вокруг каждой башни и полоса между ними
    const st = lab.state, c = lab.cfg;
    for (const T of st.towers) {
      lab.mesh(this.frameGeo(lab, c.size + 1.2, c.size + 1.2, 0.12), lab.mat(color, { unlit: true, glow: 0.9, side: 'double' }), { at: [T.x0, y, T.z0], shadow: false });
    }
    if (st.towers.length === 2) {
      const [a, b] = st.towers, len = Math.hypot(b.x0 - a.x0, b.z0 - a.z0);
      lab.box(len, 0.08, 0.16, color, { at: [(a.x0 + b.x0) / 2, y, (a.z0 + b.z0) / 2], rot: Math.atan2(-(b.z0 - a.z0), b.x0 - a.x0), unlit: true, glow: 0.9, shadow: false });
    }
    return y;
  },
  world(lab, scene) {
    const st = lab.state, T3 = lab.THREE;
    // своё небо: градиент перерисовывается по высоте башни
    if (this._sky) this._sky.dispose();
    const cv = document.createElement('canvas'); cv.width = 2; cv.height = 256;
    st.skyCtx = cv.getContext('2d'); st.skyTex = this._sky = new T3.CanvasTexture(cv); st.skyTex.colorSpace = T3.SRGBColorSpace;
    scene.background = st.skyTex;

    lab.ground({ w: 340, h: 340, color: '#4f9a4a', y: -1.2, bumps: 3, flat: 0.5 });
    lab.cyl(9, 9.5, 0.12, '#5aa84e', { at: [0, -1.17, 0], sides: 9, shadow: false }); // поляна у башни
    // горы вокруг плато: конусы со снежными шапками, слиты в один меш на цвет
    const peaks = [];
    for (let i = 0; i < 18; i++) {
      const a = (i / 18) * Math.PI * 2 + 0.3, r = 165 + (i % 3) * 20, h = 24 + ((i * 7) % 5) * 5;
      peaks.push(lab.cone(h * 0.7, h, i % 2 ? '#6a7fa8' : '#7d8fb5', { at: [Math.cos(a) * r, h / 2 - 1.2, Math.sin(a) * r], sides: 5, rot: i }));
      peaks.push(lab.cone(h * 0.2, h * 0.28, '#ffffff', { at: [Math.cos(a) * r, h * 0.86 - 1.2, Math.sin(a) * r], sides: 5, rot: i }));
    }
    lab.noShadow(lab.merge(peaks));
    // аул у подножия: сакли с черепичными крышами
    const aul = [];
    [[-15, 10], [-20, -4], [13, 15], [21, 2], [-9, 19], [17, -13], [6, -20]].forEach(([x, z], i) => {
      aul.push(lab.box(2.4, 1.6, 2, '#f1e3c8', { at: [x, -0.4, z], rot: i * 0.7 }));
      aul.push(lab.cyl(1.05, 1.05, 2.8, '#c0573d', { at: [x, 0.75, z], rot: [0, i * 0.7, Math.PI / 2], sides: 3, scale: [1, 1, 0.9] }));
      aul.push(lab.box(0.5, 0.6, 0.06, '#6b4a2b', { at: [x + Math.sin(i * 0.7) * 1.02, -0.9, z + Math.cos(i * 0.7) * 1.02], rot: i * 0.7 }));
    });
    lab.merge(aul);
    // пихты — копии одного дерева
    const N = 90, crown = lab.instances(new T3.ConeGeometry(1, 2.4, 7), '#2f7a4a', N * 2), trunk = lab.instances(new T3.CylinderGeometry(0.16, 0.22, 1, 6), '#6b4a32', N);
    for (let i = 0; i < N; i++) {
      let x, z; do { x = lab.rand(-45, 45); z = lab.rand(-45, 45); } while (Math.hypot(x, z) < 11);
      const s = lab.rand(0.8, 1.6);
      lab.place(trunk, i, [x, -1.2 + 0.5 * s, z], { scale: s });
      lab.place(crown, i * 2, [x, -1.2 + 1.9 * s, z], { scale: [s * 1.2, s, s * 1.2], rot: lab.rand(0, 3) });
      lab.place(crown, i * 2 + 1, [x, -1.2 + 2.9 * s, z], { scale: [s * 0.85, s * 0.8, s * 0.85], rot: lab.rand(0, 3) });
    }
    const rocks = lab.instances(new T3.IcosahedronGeometry(0.5, 0), '#8d8a86', 30);
    for (let i = 0; i < 30; i++) { const a = lab.rand(0, 6.28), r = lab.rand(6, 16); lab.place(rocks, i, [Math.cos(a) * r, -1.1, Math.sin(a) * r], { scale: [lab.rand(0.6, 1.5), lab.rand(0.4, 0.9), lab.rand(0.6, 1.3)], rot: lab.rand(0, 6) }); }
    // облака на высоте 12–17 м: башня пробивает их. Не стоят между камерой и башней
    st.clouds = []; st.cloudT = 0;
    st.cloudI = lab.instances(new T3.IcosahedronGeometry(1, 1), lab.mat('#ffffff', { alpha: 0.9, rough: 1, smooth: true }), 18 * 3, { shadow: false });
    for (let i = 0; i < 18; i++) {
      let a; do { a = lab.rand(0, Math.PI * 2); } while (Math.abs(Math.atan2(Math.sin(a - Math.PI / 4), Math.cos(a - Math.PI / 4))) < 0.75);
      const r = lab.rand(15, 48), sz = lab.rand(1.3, 2.6);
      st.clouds.push({ x: Math.cos(a) * r, z: Math.sin(a) * r, y: lab.rand(12, 17), v: lab.rand(0.3, 0.8), puffs: [[0, 0, 0, sz], [sz * 1.1, -0.2, 0.3, sz * 0.75], [-sz, -0.25, -0.2, sz * 0.7]] });
    }
    // звёзды проступают выше заката
    const pts = [];
    for (let i = 0; i < 400; i++) { const a = lab.rand(0, Math.PI * 2), e = lab.rand(-0.1, 1.3); pts.push(Math.cos(a) * Math.cos(e) * 150, Math.sin(e) * 150, Math.sin(a) * Math.cos(e) * 150); }
    const g = new T3.BufferGeometry(); g.setAttribute('position', new T3.Float32BufferAttribute(pts, 3));
    st.stars = new T3.Points(g, new T3.PointsMaterial({ color: '#ffffff', size: 2.2, fog: false, transparent: true, opacity: 0 }));
    scene.add(st.stars);
    // солнце и луна
    const sunM = lab.mat('#fff1c2', { unlit: true, glow: 1.2 }); sunM.fog = false;
    st.sun = lab.ball(7, sunM, { detail: 2, shadow: false });
    const moonM = lab.mat('#e9efff', { unlit: true, glow: 0.7 }); moonM.fog = false;
    st.moon = lab.ball(4.5, moonM, { detail: 2, shadow: false });
    // орёл: тело и два крыла, машет
    const eg = lab.group();
    lab.box(0.35, 0.25, 0.9, '#5c4030', { parent: eg });
    lab.box(0.22, 0.2, 0.25, '#f2eadc', { parent: eg, at: [0, 0.05, 0.52] });
    const wl = lab.group({ parent: eg, at: [-0.15, 0, 0] }), wr = lab.group({ parent: eg, at: [0.15, 0, 0] });
    lab.box(1.3, 0.06, 0.5, '#4a3426', { parent: wl, at: [-0.65, 0, 0] });
    lab.box(1.3, 0.06, 0.5, '#4a3426', { parent: wr, at: [0.65, 0, 0] });
    st.eagle = { g: eg, wl, wr };
  },
};
