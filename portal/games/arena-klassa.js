// «Арена класса» — сетевой забег всего класса по мотивам механики Fall Guys (Mediatonic, 2020), на оболочке «Лаб3D 1.0» (three.js).
// Урок 26, финал «Играем вместе»: все ученики в одной игре через сервер портала. Каждый бежит своим человечком у себя,
// а портал раз в 0,1 с пересылает места всех (lab.net). Препятствия идут по часам сервера, поэтому у всех они в одной фазе.
// Без сети (донор в аркаде, проверки) класс заменяют боты-болванчики. Правила забега задаёт учитель ручками (room.rules).
// Лучшие игры жанра, из которых взяты моменты (разбор — docs/журнал/модуль-7.md, раздел урока 26):
//   Fall Guys — толпа фасолин, вертушки, маятники, тающие плиты, квота «прошли N из M», корона победителя;
//   Takeshi's Castle и «Последний герой» — полоса препятствий как шоу: падать смешно и не обидно;
//   Mario Kart (урок 11) — резиновая нить: отстающему чекпоинты чаще.
/* ПЛАН
   Фраза игры: ты — фасолинка в шапке своего цвета, ты бежишь с классом по полосе над плато Лаго-Наки, но вертушки,
   молоты Тлепша и тающие плиты сбрасывают вниз. Цель — пройти в квоту финиша.
   Ядро на 3 секунды: бежишь → вертушка летит навстречу, тень на настиле показывает её путь → прыжок A → ты над ней, толпа сзади падает.
   Выбор, оплаченный очками: короткий путь по краю (быстрее, но падать) или по центру за толпой; нырок B — рывок вперёд, но потом лежишь.
   Угрозы: вертушки (подсекают по кругу), молоты-маятники (сбивают вбок), тающие плиты (уходят из-под ног), брёвна на подъёме,
   толкотня соседей (если учитель разрешил толкаться).
   Кривая забега: 0–8 с — загон и обратный отсчёт; 8–25 — вертушки (учат прыгать); 25–40 — ямы и качели; 40–60 — молоты;
   60–80 — тающие плиты; 80+ — подъём с брёвнами и финиш. Квота закрывается — остальные выбыли.
   События: старт-гонг, падение и чекпоинт, «пролетел над вертушкой», «сбит молотом», плита треснула, финиш с местом, корона,
   квота закрыта, новое правило учителя.
   Лицо игры: яркий парк препятствий над облаками плато: мятный настил, розовые и жёлтые препятствия, синее небо, облака внизу.
   Свет: дневное солнце, мягкие тени.
   Палитра: небо #6ec3ff, настил #7ce0c3 и #ffe27a, препятствия #ff5fa2 и #ffb238, опасность #ff3d5a, финиш #ffd23f.
   Три фирменных приёма: тень препятствия на настиле показывает, куда оно придёт; облака под полосой — пропасть читается сразу;
   толпа цветных фасолин с подписями — видно весь класс.
*/
const GAME = {
  engine: 'three',
  title: 'Арена класса',
  subtitle: 'Забег всего класса над плато: вертушки, молоты, тающие плиты. Пройди в квоту финиша — места кончаются!',
  donor: 'Fall Guys',
  players: 1,
  lives: 0,
  controls: [
    { input: 'move4', text: 'бежать' },
    { input: 'a', text: 'прыжок' },
    { input: 'b', text: 'нырок вперёд' },
  ],
  camera: { type: 'free', fov: 0.95 },
  field: { w: 16, h: 30 },
  shadowSize: 22,
  sky: ['#3d8fe0', '#bfe6ff'],
  fog: 0.006,
  accent: '#ffd23f',
  scoreColor: '#ffd23f',
  decisions: [
    'Чувство: смешной хаос толпы — падают все, и это не обидно; финишировал в квоту — триумф при всём классе',
    'Честность: тень препятствия на настиле показывает, куда оно придёт; упал — снова на чекпоинте, а не в начале',
    'Выбор: короткий путь по краю или за толпой по центру; нырок — быстрее, но потом лежишь',
  ],
  notes: [
    'В сети препятствия идут по часам сервера: у всего класса вертушки в одной фазе.',
    'Без сети класс заменяют боты-болванчики: их столько, сколько в ручке «Боты».',
    'Толкаться можно, только если учитель включил: тогда соседи отталкивают тебя, а ты — их на их экранах.',
  ],
  config: {
    secret: { value: 1, min: 0, max: 1, step: 1, label: 'Спрятанная механика', hint: '1 — как задумано (квота и толпа видны); 0 — каждый бежит один, без квоты' },
    beg: { value: 7, min: 3, max: 12, step: 0.5, label: 'Скорость бега, м/с' },
    pryzhok: { value: 8.2, min: 5, max: 13, step: 0.2, label: 'Сила прыжка' },
    gravity: { value: 22, min: 6, max: 34, step: 1, label: 'Притяжение', hint: '8 — как на Луне' },
    vertushki: { value: 1, min: 0, max: 2.5, step: 0.1, label: 'Скорость вертушек и молотов' },
    plity: { value: 0.8, min: 0.2, max: 3, step: 0.1, label: 'Плита держит, с' },
    tolkat: { value: 1, min: 0, max: 1, step: 1, label: 'Толкаться можно' },
    kvota: { value: 0.6, min: 0.1, max: 1, step: 0.05, label: 'Квота: какая доля пройдёт' },
    boty: { value: 11, min: 0, max: 24, step: 1, label: 'Ботов без сети', restart: true },
    brevna: { value: 1, min: 0, max: 1, step: 1, label: 'Брёвна на подъёме' },
  },
  presets: {
    'Новичок': { beg: 7.5, vertushki: 0.6, plity: 1.6, tolkat: 0, kvota: 0.9 },
    'Без спрятанной механики': { secret: 0 },
    'Луна': { gravity: 8, pryzhok: 6.5 },
    'Ураган': { vertushki: 2 },
    'Тонкий лёд': { plity: 0.3 },
  },
  BOT_NAMES: ['Алим', 'Зарема', 'Аслан', 'Мадина', 'Тимур', 'Бэла', 'Ислам', 'Фатима', 'Руслан', 'Саида', 'Мурат', 'Лиана', 'Азамат', 'Дана', 'Казбек', 'Сатаней', 'Нальбий', 'Мира', 'Хазрет', 'Ася', 'Заур', 'Эля', 'Батыр', 'Нина'],
  COLORS: ['#ff5fa2', '#ffb238', '#7cf5a8', '#5fd0ff', '#b48aff', '#ff6a4a', '#ffe14a', '#4affd8', '#ff8ad8', '#9ae64a', '#4a8aff', '#ffa0a0'],
  FIN_Z: -112,
  colorOf(name) { let h = 7; for (const c of String(name)) h = (Math.imul(h, 31) + c.charCodeAt(0)) >>> 0; return this.COLORS[h % this.COLORS.length]; },

  // ---------- новая партия ----------
  start(lab, scene) {
    const T = lab.THREE, st = lab.state, cfg = lab.cfg;
    Object.assign(st, {
      wt: 0, me: { x: 0, y: 0.5, z: -3, vx: 0, vz: 0, vy: 0, ry: Math.PI, ground: true, stun: 0, dive: 0, cp: 0, fin: null, falls: 0, hits: 0, jumps: 0, dives: 0, coyote: 0 },
      round: null, phase: 'offline', sent: 0, bots: [], beans: new Map(), tiles: [], placeShown: null, said: {}, qualified: 0, closed: false,
      tmp: { v: new T.Vector3(), c: new T.Color(), m: new T.Matrix4(), q: new T.Quaternion(), e: new T.Euler(), s: new T.Vector3() },
    });
    lab.light.sun.intensity = 2; lab.light.hemi.intensity = 1.1;
    this.world(lab, scene);
    this.beanParts(lab, scene);
    this.heroBuild(lab, scene);
    this.makeBots(lab);
    st.cam = lab.group({ at: [0, 0, 0] });
    lab.hero(st.hero);
    this.placeCam(lab, 1);
    this.draw(lab, 0);
  },

  // ---------- полоса: участки по Z, настил — коробки, препятствия — по часам ----------
  world(lab, scene) {
    const T = lab.THREE, st = lab.state;
    st.plats = []; st.sweep = []; st.hammers = []; st.movers = []; st.logs = []; st.cps = [0, -10, -32, -54, -76, -98];
    const deck = [];
    const plat = (x, z, w, d, y = 0, col = '#7ce0c3', o = {}) => { const p = Object.assign({ x0: x - w / 2, x1: x + w / 2, z0: z - d / 2, z1: z + d / 2, y }, o); st.plats.push(p); if (!o.dyn) deck.push(lab.box(w, 1, d, col, { at: [x, y - 0.5, z] })); return p; };
    // загон и старт
    plat(0, -3, 14, 10, 0, '#ffe27a');
    st.gate = lab.box(14, 2.2, 0.4, lab.mat('#ff5fa2', { glow: 0.3 }), { at: [0, 1.1, -8.3] });
    // 1 — вертушки
    plat(0, -20, 14, 20, 0);
    for (const [z, w, len] of [[-14, 1.3, 6.5], [-21, -1.6, 6.5], [-27, 1.9, 6.5]]) st.sweep.push({ x: 0, z, y: 0.55, len, w, ph: z });
    // 2 — ямы: островки и качающиеся мостки
    plat(-4.5, -33.5, 5, 3); plat(4.5, -33.5, 5, 3);
    plat(-4, -38.5, 3, 3); plat(4, -38.5, 3, 3); plat(0, -41, 3, 3, 0, '#ffe27a');
    st.movers.push(plat(0, -45.5, 4, 3, 0, '#ff9ad0', { dyn: true, ax: 4.5, w: 1.1, cx: 0 }));
    plat(0, -50.5, 14, 3);
    // 3 — молоты Тлепша
    plat(0, -64, 14, 20);
    for (const [z, ph] of [[-57, 0], [-63, 1.6], [-69, 3.1]]) st.hammers.push({ z, ph, x0: 0, top: 0, R: 5.5, A: 1.05, w: 1.6 });
    // 4 — тающие плиты над облаками
    plat(0, -75.5, 14, 3, 0, '#ffe27a');
    for (let r = 0; r < 6; r++) for (let c = 0; c < 5; c++) {
      const x = -5.2 + c * 2.6 + (r % 2 ? 0.6 : -0.6), z = -79 - r * 2.7;
      st.tiles.push(plat(x, z, 2.3, 2.3, 0, '#9ef0ff', { dyn: true, tile: true, t0: null, down: 0, r, c }));
    }
    plat(0, -96.5, 14, 3, 0, '#ffe27a');
    // 5 — подъём с брёвнами и финиш
    st.ramp = { x0: -6, x1: 6, z0: -98, z1: -110, y0: 0, y1: 4 };
    deck.push(lab.mesh(new T.BoxGeometry(12, 1, 12.6).translate(0, -0.5, 0), '#7ce0c3', { at: [0, 2, -104], rot: [Math.atan2(4, 12), 0, 0] }));
    plat(0, -114, 14, 8, 4, '#ffd23f');
    for (let k = 0; k < 3; k++) st.logs.push({ ph: k / 3 });
    lab.merge(deck);
    // стойки, арка финиша и флажки
    const deco = [];
    for (const z of [-10, -32, -54, -76, -98]) {
      for (const s of [-1, 1]) deco.push(lab.cyl(0.18, 0.18, 3.2, '#ffffff', { at: [s * 7.2, 1.6, z] }), lab.cone(0.5, 0.8, '#ff5fa2', { at: [s * 7.2, 3.6, z] }));
      deco.push(lab.box(14.6, 0.5, 0.5, '#ffb238', { at: [0, 3.2, z] }));
    }
    for (const s of [-1, 1]) deco.push(lab.cyl(0.4, 0.4, 7, '#ffd23f', { at: [s * 6.6, 7.5, this.FIN_Z] }));
    deco.push(lab.box(14, 1.2, 0.8, '#ff5fa2', { at: [0, 11.2, this.FIN_Z] }));
    lab.merge(deco);
    st.crown = lab.group({ at: [0, 13.4, this.FIN_Z] });
    for (let k = 0; k < 5; k++) lab.cone(0.35, 0.9, lab.mat('#ffd23f', { glow: 1, shiny: true }), { at: [Math.cos(k / 5 * 6.28) * 0.7, 0.4, Math.sin(k / 5 * 6.28) * 0.7], parent: st.crown, sides: 4 });
    lab.cyl(0.95, 0.95, 0.45, lab.mat('#ffd23f', { glow: 0.6, shiny: true }), { parent: st.crown, sides: 10 });
    // вертушки: столб и перекладина; тень-круг на настиле показывает их путь
    st.sweepG = st.sweep.map(s => {
      const g = lab.group({ at: [s.x, 0, s.z] });
      lab.cyl(0.45, 0.6, 1.4, '#ff5fa2', { at: [0, 0.7, 0], parent: g });
      const arm = lab.group({ at: [0, s.y, 0], parent: g });
      lab.box(s.len * 2, 0.5, 0.5, lab.mat('#ffb238', { glow: 0.2 }), { at: [0, 0, 0], parent: arm, round: 0.2 });
      for (const e of [-1, 1]) lab.ball(0.42, lab.mat('#ff3d5a', { glow: 0.5 }), { at: [e * s.len, 0, 0], parent: arm });
      lab.mesh(new T.RingGeometry(s.len - 0.25, s.len + 0.25, 40).rotateX(-Math.PI / 2), lab.mat('#ff3d5a', { alpha: 0.28, unlit: true }), { at: [0, 0.03, 0], parent: g, shadow: false });
      return arm;
    });
    // молоты: рама, маятник, тень-полоса
    st.hammerG = st.hammers.map(h => {
      const g = lab.group({ at: [0, 0, h.z] });
      for (const s of [-1, 1]) lab.cyl(0.25, 0.3, 7, '#ffffff', { at: [s * 6.8, 3.5, 0], parent: g });
      lab.box(14, 0.4, 0.4, '#ff5fa2', { at: [0, 7, 0], parent: g });
      const pend = lab.group({ at: [0, 7, 0], parent: g });
      lab.cyl(0.12, 0.12, h.R, '#5a5f70', { at: [0, -h.R / 2, 0], parent: pend });
      lab.cyl(1.1, 1.1, 1.8, lab.mat('#ff3d5a', { glow: 0.2 }), { at: [0, -h.R, 0], rot: [0, 0, Math.PI / 2], parent: pend, round: 0.1 });
      lab.box(10.5, 0.02, 0.9, lab.mat('#ff3d5a', { alpha: 0.25, unlit: true }), { at: [0, 0.03, 0], parent: g, shadow: false });
      return pend;
    });
    st.moverG = st.movers.map(m => lab.box(m.x1 - m.x0, 1, m.z1 - m.z0, '#ff9ad0', { at: [0, -0.5, (m.z0 + m.z1) / 2] }));
    st.tileIM = lab.instances(new T.BoxGeometry(2.3, 0.6, 2.3), '#ffffff', st.tiles.length);
    st.logG = st.logs.map(() => lab.cyl(0.7, 0.7, 10, '#b9773f', { rot: [0, 0, Math.PI / 2] }));
    // облака внизу: пропасть видна как пропасть
    const cl = lab.instances(new T.IcosahedronGeometry(1, 0), lab.mat('#ffffff', { unlit: false }), 90, { shadow: false });
    for (let k = 0; k < 90; k++) lab.place(cl, k, [lab.rand(-40, 40), lab.rand(-14, -8), lab.rand(-150, 30)], { scale: [lab.rand(3, 7), lab.rand(1, 2), lab.rand(3, 6)], color: lab.pick(['#ffffff', '#f0f6ff', '#e6f0ff']) });
    // горы плато вдали
    const mt = [];
    for (let k = 0; k < 10; k++) mt.push(lab.cone(lab.rand(14, 24), lab.rand(14, 30), lab.pick(['#6a8fc8', '#7a9ad0', '#5f86c0']), { at: [-90 + k * 20, -12, -190 - lab.rand(0, 20)], sides: 5, shadow: false }));
    for (let k = 0; k < 6; k++) mt.push(lab.cone(lab.rand(3, 6), lab.rand(3, 5), '#ffffff', { at: [-80 + k * 32, lab.rand(8, 14), -195], sides: 5, shadow: false }));
    lab.merge(mt);
    // зрительские флажки по краям
    const fl = lab.instances(new T.ConeGeometry(0.35, 0.8, 3).rotateZ(Math.PI / 2), '#ffffff', 40, { shadow: false });
    for (let k = 0; k < 40; k++) lab.place(fl, k, [(k % 2 ? 7.3 : -7.3), 2.6, -4 - k * 2.6], { color: this.COLORS[k % this.COLORS.length] });
  },

  // ---------- фасолинки: тела одной пачкой, подписи — спрайты ----------
  beanParts(lab, scene) {
    const T = lab.THREE, st = lab.state, CAP = 40;
    st.bodyIM = lab.instances(new T.CapsuleGeometry(0.45, 0.7, 4, 10), '#ffffff', CAP);
    st.visorIM = lab.instances(new T.SphereGeometry(0.32, 10, 6, 0, Math.PI * 2, 0, Math.PI / 2).rotateX(Math.PI / 2).scale(1, 0.7, 0.6), lab.mat('#1a2040', { shiny: true }), CAP, { shadow: false });
    st.bodyIM.frustumCulled = st.visorIM.frustumCulled = false;
    st.labels = [];
    for (let k = 0; k < 24; k++) {
      const cv = document.createElement('canvas'); cv.width = 256; cv.height = 64;
      const tex = new T.CanvasTexture(cv); tex.colorSpace = T.SRGBColorSpace;
      const sp = new T.Sprite(new T.SpriteMaterial({ map: tex, depthTest: false, transparent: true }));
      sp.scale.set(2.4, 0.6, 1); sp.renderOrder = 5; sp.visible = false; scene.add(sp);
      st.labels.push({ sp, cv, tex, text: '' });
    }
    st.beanN = 0;
  },
  label(lab, k, text, col, at) {
    const L = lab.state.labels[k]; if (!L) return;
    if (L.text !== text + col) {
      L.text = text + col; const g = L.cv.getContext('2d'); g.clearRect(0, 0, 256, 64);
      g.font = '800 30px system-ui,sans-serif'; g.textAlign = 'center'; g.textBaseline = 'middle';
      g.lineWidth = 7; g.strokeStyle = 'rgba(10,20,50,.85)'; g.strokeText(text, 128, 32); g.fillStyle = col; g.fillText(text, 128, 32);
      L.tex.needsUpdate = true;
    }
    L.sp.visible = true; L.sp.position.set(at[0], at[1] + 1.9, at[2]);
  },
  bean(lab, i, x, y, z, ry, col, squash = 0, lean = 0) {
    const st = lab.state, t = st.tmp;
    t.e.set(lean, ry, 0); t.q.setFromEuler(t.e); t.s.set(1 + squash * 0.2, 1 - squash * 0.25, 1 + squash * 0.2);
    t.m.compose(t.v.set(x, y + 0.82, z), t.q, t.s); st.bodyIM.setMatrixAt(i, t.m); st.bodyIM.setColorAt(i, t.c.set(col));
    const fx = Math.sin(ry) * 0.3, fz = Math.cos(ry) * 0.3;
    t.m.compose(t.v.set(x + fx, y + 1.12 - squash * 0.15, z + fz), t.q, t.s.set(1, 1, 1)); st.visorIM.setMatrixAt(i, t.m);
  },
  heroBuild(lab, scene) {
    const st = lab.state;
    st.hero = lab.group({ at: [0, 0, -3] }); // невидимая точка героя: за ней камера и бот-плейтестер
    st.myCol = '#ff5fa2';
    st.shadowRing = lab.mesh(new lab.THREE.CircleGeometry(0.55, 16).rotateX(-Math.PI / 2), lab.mat('#000000', { alpha: 0.3, unlit: true }), { shadow: false });
  },

  // ---------- боты без сети ----------
  makeBots(lab) {
    const st = lab.state, n = Math.round(lab.cfg.boty);
    for (let k = 0; k < n; k++) st.bots.push({ n: 'Бот ' + this.BOT_NAMES[k % this.BOT_NAMES.length], c: this.COLORS[(k + 3) % this.COLORS.length], x: lab.rand(-5, 5), y: 0, z: lab.rand(-6, -1), ry: Math.PI, speed: lab.rand(3.4, 5.4), lane: lab.rand(-4.5, 4.5), skill: lab.rand(0.55, 0.95), down: 0, cp: 0, fin: null, hop: 0, seg: -1 });
  },
  botsUpdate(lab, dt, tau, run) {
    const st = lab.state;
    for (const b of st.bots) {
      if (b.fin != null) { b.x = lab.damp(b.x, b.lane * 0.5, 2, dt); b.y = 4; b.z = lab.damp(b.z, this.FIN_Z - 3, 2, dt); continue; }
      if (!run) { b.x += Math.sin(st.wt * 1.3 + b.lane) * dt; b.z = lab.clamp(b.z, -7.5, -0.5); continue; }
      if (b.down > 0) { b.down -= dt; if (b.down <= 0) { b.z = st.cps[b.cp] - 2; b.x = b.lane * 0.5; b.y = 0; } else { b.y -= 12 * dt; continue; } }
      const seg = st.cps.filter(z => b.z <= z).length - 1;
      if (seg !== b.seg) {
        b.seg = seg; b.cp = Math.max(b.cp, seg);
        // каждый участок — шанс оступиться: у ловких меньше
        const risk = [0, 0.35, 0.45, 0.4, 0.5, 0.25][seg] || 0;
        b.fall = lab.chance(risk * (1.15 - b.skill)) ? st.cps[seg] - lab.rand(4, 16) : null;
      }
      b.z -= b.speed * dt * (seg === 5 ? 0.75 : 1);
      b.x = lab.damp(b.x, lab.clamp(b.lane + Math.sin(st.wt * 2 + b.lane) * 1.5, -5.5, 5.5), 2.5, dt);
      b.hop = Math.max(0, b.hop - dt);
      if (lab.chance(dt * 0.7)) b.hop = 0.5;
      b.y = this.groundY(lab, b.x, b.z, 9) + Math.sin(Math.min(1, b.hop / 0.5) * Math.PI) * 1.2;
      if (b.fall != null && b.z < b.fall) { b.fall = null; b.down = 1.4; lab.count('ботов упало', 1); }
      if (b.z <= this.FIN_Z) { b.fin = tau; st.qualified++; }
    }
  },

  // ---------- настил: высота под точкой ----------
  groundY(lab, x, z, yMax) {
    const st = lab.state;
    let best = -99;
    for (const p of st.plats) {
      if (p.tile && p.down > 0.25) continue;
      const ox = p.ox || 0;
      if (x >= p.x0 + ox - 0.25 && x <= p.x1 + ox + 0.25 && z >= p.z0 - 0.25 && z <= p.z1 + 0.25 && p.y <= yMax + 0.4 && p.y > best) best = p.y - (p.tile ? p.down : 0);
    }
    const R = st.ramp;
    if (x >= R.x0 - 0.2 && x <= R.x1 + 0.2 && z <= R.z0 && z >= R.z1) { const y = R.y0 + (R.y1 - R.y0) * (R.z0 - z) / (R.z0 - R.z1); if (y <= yMax + 0.6 && y > best) best = y; }
    return best;
  },
  tileUnder(lab, x, z) { return lab.state.tiles.find(p => p.down <= 0.25 && x >= p.x0 - 0.2 && x <= p.x1 + 0.2 && z >= p.z0 - 0.2 && z <= p.z1 + 0.2); },

  // ---------- часы забега и правила ----------
  clock(lab) {
    const st = lab.state, N = lab.net, room = N.room || {};
    if (N.on && room.start) return { tau: (N.now() - room.start) / 1000, run: room.phase === 'run' && N.now() >= room.start, phase: room.phase };
    return { tau: st.wt - 4, run: st.wt >= 4, phase: 'offline' };
  },
  rules(lab) {
    const cfg = lab.cfg, r = (lab.net.on && lab.net.room && lab.net.room.rules) || {};
    const v = k => (r[k] != null && isFinite(r[k]) ? Number(r[k]) : cfg[k]);
    return { beg: v('beg'), pryzhok: v('pryzhok'), gravity: v('gravity'), vertushki: v('vertushki'), plity: v('plity'), tolkat: v('tolkat'), kvota: v('kvota'), brevna: v('brevna') };
  },

  // ---------- кадр ----------
  update(lab, dt) {
    const st = lab.state, R = this.rules(lab), me = st.me;
    st.wt += dt;
    const { tau, run, phase } = this.clock(lab);
    // новый забег от учителя: всем — на старт
    const room = lab.net.room || {};
    if (lab.net.on && room.round !== st.round) {
      st.round = room.round; Object.assign(me, { x: lab.rand(-5, 5), y: 0, z: lab.rand(-6, -1), vx: 0, vz: 0, vy: 0, cp: 0, fin: null, stun: 0, dive: 0 });
      st.placeShown = null; st.closed = false;
      if (room.phase === 'lobby') lab.popup([me.x, 2.5, me.z], 'Учитель собирает забег — разминайся!', '#ffffff', 20);
      st.tiles.forEach(p => { p.t0 = null; p.down = 0; });
    }
    st.tau = tau; st.run = run; st.R = R;
    st.gate.position.y = run ? lab.damp(st.gate.position.y, -2, 6, dt) : 1.1;
    this.obstacles(lab, dt, tau, R);
    this.control(lab, dt, run, R);
    this.collide(lab, dt, tau, R);
    if (!lab.net.on) this.botsUpdate(lab, dt, tau, run);
    this.finish(lab, tau);
    if (lab.net.on && st.wt - st.sent > 0.1) { st.sent = st.wt; lab.net.send({ x: +me.x.toFixed(2), y: +me.y.toFixed(2), z: +me.z.toFixed(2), ry: +me.ry.toFixed(2), a: me.dive > 0 ? 'd' : me.ground ? (Math.hypot(me.vx, me.vz) > 1 ? 'r' : 'i') : 'j', cp: me.cp, f: me.fin }); }
    this.placeCam(lab, dt);
    this.draw(lab, dt);
  },
  control(lab, dt, run, R) {
    const st = lab.state, me = st.me, p = lab.p1;
    if (me.fin != null) { me.vx = lab.damp(me.vx, 0, 4, dt); me.vz = lab.damp(me.vz, 0, 4, dt); }
    const can = me.stun <= 0 && me.dive <= 0 && me.fin == null;
    if (me.stun > 0) me.stun -= dt;
    if (me.dive > 0) me.dive -= dt;
    let ix = can ? p.x : 0, iz = can ? -p.y : 0;
    const l = Math.hypot(ix, iz); if (l > 1) { ix /= l; iz /= l; }
    const air = me.ground ? 1 : 0.55, sp = R.beg;
    me.vx = lab.damp(me.vx, ix * sp, (me.ground ? 14 : 5) * air, dt);
    me.vz = lab.damp(me.vz, iz * sp, (me.ground ? 14 : 5) * air, dt);
    if (l > 0.2) me.ry = Math.atan2(ix, iz);
    if (me.ground) me.coyote = 0.12; else me.coyote -= dt;
    if (can && p.pressed.a && me.coyote > 0) { me.vy = R.pryzhok; me.ground = false; me.coyote = 0; me.jumps++; lab.sfx.jump(); lab.burst([me.x, me.y + 0.1, me.z], { count: 8, color: '#ffffff', speed: 2, up: 1 }); lab.count('прыжков', 1); }
    if (can && p.pressed.b) { me.dive = 0.8; const f = 9; me.vx = Math.sin(me.ry) * f; me.vz = Math.cos(me.ry) * f; me.vy = Math.max(me.vy, 3); me.dives++; lab.sfx.whoosh(); lab.count('нырков', 1); }
    // загон до старта: калитка держит
    me.vy -= R.gravity * dt;
    me.x += me.vx * dt; me.z += me.vz * dt; me.y += me.vy * dt;
    if (!run && me.z < -7.6) { me.z = -7.6; me.vz = Math.max(0, me.vz); }
    const g = this.groundY(lab, me.x, me.z, me.y);
    if (me.y <= g && me.vy <= 0 && g > -50) {
      if (!me.ground && me.vy < -6) { lab.burst([me.x, g + 0.1, me.z], { count: 6, color: '#ffffff', speed: 2 }); }
      me.y = g; me.vy = 0; me.ground = true;
    } else if (me.y > g + 0.05) me.ground = false;
    // плита под ногами начинает таять
    if (me.ground) { const t = this.tileUnder(lab, me.x, me.z); if (t && t.t0 == null) { t.t0 = st.wt; lab.tone(520, 0.05, 'triangle', 0.15); } }
    // чекпоинты
    for (let k = st.cps.length - 1; k > me.cp; k--) if (me.z < st.cps[k] && me.ground) { me.cp = k; lab.popup([me.x, me.y + 2.6, me.z], `Чекпоинт ${k}`, '#7cf5a8', 16); lab.sfx.coin(); lab.addScore(50, null); break; }
    // упал вниз
    if (me.y < -9) {
      me.falls++; lab.count('падений', 1); lab.hurt(null);
      const z = st.cps[me.cp] - 2.5;
      Object.assign(me, { x: lab.rand(-3, 3), y: this.groundY(lab, 0, z, 9) + 3, z, vx: 0, vz: 0, vy: 0, stun: 0.3, dive: 0 });
      lab.popup([me.x, me.y + 2, me.z], 'Опа! Снова на чекпоинте', '#ffffff', 18); lab.sfx.lose();
    }
    me.x = lab.clamp(me.x, -9, 9);
  },
  obstacles(lab, dt, tau, R) {
    const st = lab.state, sp = R.vertushki;
    st.sweep.forEach((s, k) => { s.a = tau * s.w * sp + s.ph; st.sweepG[k].rotation.y = -s.a; });
    st.hammers.forEach((h, k) => { h.th = h.A * Math.sin(tau * h.w * Math.max(0.2, sp) + h.ph); h.om = h.A * h.w * Math.cos(tau * h.w * Math.max(0.2, sp) + h.ph); st.hammerG[k].rotation.z = h.th; });
    st.movers.forEach((m, k) => { m.ox = m.ax * Math.sin(tau * m.w * Math.max(0.3, sp)); st.moverG[k].position.x = m.ox; });
    // плиты: дрожат, потом падают; через 5 с возвращаются
    for (const p of st.tiles) {
      if (p.t0 != null) { const k = st.wt - p.t0; if (k > R.plity) p.down = Math.min(12, (k - R.plity) * (k - R.plity) * 9); if (k > R.plity + 5) { p.t0 = null; p.down = 0; } }
    }
    // брёвна катятся с подъёма
    const Rp = st.ramp;
    st.logs.forEach((L, k) => {
      const per = 4.5, u = (((tau / per + L.ph) % 1) + 1) % 1;
      L.z = Rp.z1 + (Rp.z0 - Rp.z1 + 4) * u; L.on = R.brevna >= 1 && L.z <= Rp.z0 + 1;
      L.y = (L.z <= Rp.z0 ? Rp.y0 + (Rp.y1 - Rp.y0) * (Rp.z0 - L.z) / (Rp.z0 - Rp.z1) : -20) + 0.7;
      const g = st.logG[k]; g.visible = L.on; g.position.set(0, L.y, L.z); g.rotation.x = -tau * 6;
    });
  },
  // удар препятствия: толчок, оглушение, звук
  knock(lab, vx, vz, up, what) {
    const st = lab.state, me = st.me;
    if (me.stun > 0.25 || me.fin != null) return;
    me.vx = vx; me.vz = vz; me.vy = up; me.ground = false; me.stun = 0.55; me.hits++;
    lab.sfx.hit(); lab.shake(0.25); lab.burst([me.x, me.y + 1, me.z], { count: 12, colors: ['#ffffff', '#ffd23f'], speed: 5 });
    lab.count(what, 1);
    if (!st.said[what]) { st.said[what] = 1; lab.popup([me.x, me.y + 2.4, me.z], what === 'сбит молотом' ? 'Бам! Молот Тлепша' : 'Подсекла вертушка!', '#ffffff', 18); }
  },
  collide(lab, dt, tau, R) {
    const st = lab.state, me = st.me, cy = me.y + 0.8;
    for (const s of st.sweep) {
      if (cy > s.y + 1.25 || cy < s.y - 1.3) continue;
      const dx = me.x - s.x, dz = me.z - s.z, ca = Math.cos(s.a), sa = Math.sin(s.a);
      const along = dx * ca + dz * sa, perp = -dx * sa + dz * ca;
      if (Math.abs(along) <= s.len + 0.4 && Math.abs(perp) < 0.75) {
        const tv = s.w * R.vertushki * along; // скорость точки перекладины
        this.knock(lab, -sa * tv * 1.3, ca * tv * 1.3, 6, 'сбит вертушкой');
      } else if (Math.abs(along) <= s.len && Math.abs(perp) < 1.8 && me.y > s.y + 0.3 && !me.ground && !st.said['над' + s.z]) { st.said['над' + s.z] = 1; lab.addScore(30, [me.x, me.y + 2, me.z], '#7cf5a8'); }
    }
    for (const h of st.hammers) {
      const hx = h.x0 + h.R * Math.sin(h.th), hy = 7 - h.R * Math.cos(h.th);
      if (Math.abs(me.z - h.z) < 1.4 && Math.abs(me.x - hx) < 1.5 && Math.abs(cy - hy) < 1.5) this.knock(lab, Math.sign(h.om || 1) * 12, 2, 6, 'сбит молотом');
    }
    for (const L of st.logs) if (L.on && Math.abs(me.z - L.z) < 1 && Math.abs(cy - L.y) < 1.2) this.knock(lab, 0, 8, 7, 'сбит бревном');
    // толкотня: соседи (боты или класс) отталкивают
    if (R.tolkat >= 1) for (const o of this.crowd(lab)) {
      const dx = me.x - o.x, dz = me.z - o.z, d = Math.hypot(dx, dz);
      if (d > 0.01 && d < 0.95 && Math.abs(me.y - o.y) < 1.2) { const k = (0.95 - d) / d; me.x += dx * k * 0.6; me.z += dz * k * 0.6; if (!st.pushT || st.wt - st.pushT > 1.5) { st.pushT = st.wt; lab.count('толкнули', 1); lab.count('_secret', 1); } }
    }
  },
  crowd(lab) {
    const st = lab.state;
    if (lab.net.on) return (lab.net.others || []).map(o => st.beans.get(o.n) || o);
    return st.bots;
  },
  finish(lab, tau) {
    const st = lab.state, me = st.me, R = st.R;
    const total = (lab.net.on ? (lab.net.others || []).length : st.bots.length) + 1;
    const quota = lab.cfg.secret >= 1 ? Math.max(1, Math.round(total * R.kvota)) : total;
    st.total = total; st.quota = quota;
    if (me.fin == null && me.z <= this.FIN_Z && me.y > 2) {
      me.fin = Math.max(0, tau);
      const before = lab.net.on ? (lab.net.others || []).filter(o => o.f != null && o.f < me.fin).length : st.bots.filter(b => b.fin != null).length;
      const place = before + 1;
      st.place = place;
      lab.addScore(Math.max(100, (total - place + 1) * 100), [me.x, me.y + 2.5, me.z]);
      lab.sfx.win(); lab.burst([me.x, me.y + 1.5, me.z], { count: 30, colors: ['#ffd23f', '#ff5fa2', '#7cf5a8', '#ffffff'], speed: 8, up: 4 });
      lab.popup([me.x, me.y + 3, me.z], place === 1 ? '👑 Первое место!' : `Финиш! ${place} место`, '#ffd23f', 26);
      lab.stat('место', place); lab.count('финишей', 1);
      if (!lab.net.on) lab.after(1.6, () => (place <= quota ? lab.win(`Прошёл: ${place} место из ${total} (квота — ${quota})`) : lab.gameOver(`Финиш ${place}-м, но квота — ${quota}: места кончились`)));
    }
    // квота закрылась без меня (без сети: боты финишировали раньше)
    if (!lab.net.on && me.fin == null && lab.cfg.secret >= 1 && st.qualified >= quota && !st.closed) {
      st.closed = true; lab.popup([me.x, me.y + 3, me.z], 'Квота закрыта!', '#ff6a7a', 26);
      lab.after(1.2, () => lab.gameOver(`Квота закрыта: прошли ${quota} из ${total}. Ты на чекпоинте ${me.cp}`));
    }
    if (!lab.net.on && tau > 150 && me.fin == null && !st.closed) { st.closed = true; lab.gameOver('Время забега вышло'); }
  },
  placeCam(lab, dt) {
    const st = lab.state, me = st.me, c = lab.camera;
    st.hero.position.set(me.x, me.y, me.z);
    const tx = me.x * 0.6, ty = me.y + 5.2, tz = me.z + 9;
    if (!st.camP) st.camP = { x: tx, y: ty, z: tz };
    const k = dt >= 1 ? 1 : 1 - Math.exp(-6 * dt);
    st.camP.x += (tx - st.camP.x) * k; st.camP.y += (ty - st.camP.y) * k; st.camP.z += (tz - st.camP.z) * k;
    c.position.set(st.camP.x, st.camP.y, st.camP.z);
    c.lookAt(me.x * 0.8, me.y + 1, me.z - 6);
  },

  // ---------- рисуем всех ----------
  draw(lab, dt) {
    const st = lab.state, me = st.me, t = st.wt;
    let i = 0, lb = 0;
    const squash = me.dive > 0 ? 0.5 : me.ground ? Math.max(0, Math.sin(t * 16) * 0.12 * Math.min(1, Math.hypot(me.vx, me.vz) / 4)) : -0.15;
    this.bean(lab, i++, me.x, me.y, me.z, me.ry, st.myCol, squash, me.dive > 0 ? 1.2 : me.stun > 0 ? Math.sin(t * 30) * 0.4 : 0);
    st.shadowRing.position.set(me.x, this.groundY(lab, me.x, me.z, me.y) + 0.04, me.z);
    this.label(lab, lb++, 'ты', '#ffffff', [me.x, me.y, me.z]);
    if (lab.net.on) {
      const seen = new Set();
      for (const o of lab.net.others || []) {
        seen.add(o.n);
        let b = st.beans.get(o.n);
        if (!b) { b = { x: o.x, y: o.y, z: o.z, ry: o.ry, c: o.c || this.colorOf(o.n) }; st.beans.set(o.n, b); }
        b.x = lab.damp(b.x, o.x, 12, dt || 0.016); b.y = lab.damp(b.y, o.y, 12, dt || 0.016); b.z = lab.damp(b.z, o.z, 12, dt || 0.016); b.ry = o.ry; b.a = o.a; b.f = o.f;
        if (i < 40) this.bean(lab, i++, b.x, b.y, b.z, b.ry, b.c, b.a === 'd' ? 0.5 : 0, b.a === 'd' ? 1.2 : 0);
        if (lb < st.labels.length) this.label(lab, lb++, o.n, b.c, [b.x, b.y, b.z]);
      }
      for (const n of [...st.beans.keys()]) if (!seen.has(n)) st.beans.delete(n);
    } else for (const b of st.bots) {
      if (i < 40) this.bean(lab, i++, b.x, b.y, b.z, b.ry, b.c, b.hop > 0 ? -0.1 : Math.max(0, Math.sin(t * 15 + b.lane) * 0.1), b.down > 0 ? Math.sin(t * 20) : 0);
      if (lb < st.labels.length && Math.abs(b.z - me.z) < 30) this.label(lab, lb++, b.n, b.c, [b.x, b.y, b.z]);
    }
    for (let k = i; k < 40; k++) { st.tmp.m.makeScale(0, 0, 0); st.bodyIM.setMatrixAt(k, st.tmp.m); st.visorIM.setMatrixAt(k, st.tmp.m); }
    st.bodyIM.instanceMatrix.needsUpdate = st.visorIM.instanceMatrix.needsUpdate = true; if (st.bodyIM.instanceColor) st.bodyIM.instanceColor.needsUpdate = true;
    for (let k = lb; k < st.labels.length; k++) st.labels[k].sp.visible = false;
    // плиты
    st.tiles.forEach((p, k) => {
      const shake = p.t0 != null && p.down <= 0 ? Math.sin(t * 60) * 0.06 : 0;
      lab.place(st.tileIM, k, [(p.x0 + p.x1) / 2 + shake, p.y - 0.3 - p.down, (p.z0 + p.z1) / 2], { scale: p.down > 11 ? 0 : 1, color: p.t0 != null ? (p.down > 0 ? '#ff6a7a' : '#ffb2c0') : '#9ef0ff' });
    });
    st.crown.rotation.y = t * 1.5; st.crown.position.y = 13.4 + Math.sin(t * 2) * 0.3;
    this.hud(lab);
  },
  hud(lab) {
    const st = lab.state, me = st.me, room = lab.net.room || {};
    const left = Math.max(0, Math.round(me.z - this.FIN_Z));
    if (lab.net.on) {
      const ph = room.phase === 'lobby' ? 'Загон: учитель скоро даст старт — разминайся' : room.phase === 'run' ? (st.tau < 0 ? `Старт через ${Math.ceil(-st.tau)}…` : 'Забег!') : room.phase === 'done' ? 'Забег окончен — смотри итоги' : 'Арена закрыта';
      lab.hud('phase', ph, { color: '#ffffff', size: 20 });
      const fin = (lab.net.others || []).filter(o => o.f != null).length + (me.fin != null ? 1 : 0);
      lab.hud('quota', `Финишировали: ${fin} · квота ${st.quota} из ${st.total}`, { color: fin >= st.quota ? '#ff6a7a' : '#ffd23f', size: 16 });
    } else {
      lab.hud('phase', st.tau < 0 ? `Старт через ${Math.ceil(-st.tau)}…` : null, { color: '#ffffff', size: 26 });
      lab.hud('quota', lab.cfg.secret >= 1 ? `Прошли: ${st.qualified} из квоты ${st.quota} (всего ${st.total})` : `Бежишь один: квоты нет`, { color: st.qualified >= (st.quota || 99) - 1 ? '#ff6a7a' : '#ffd23f', size: 16 });
    }
    lab.hud('left', me.fin != null ? `Финиш: ${st.place} место` : `До финиша ${left} м · чекпоинт ${me.cp} · падений ${me.falls}`, { color: '#e8f4ff', size: 14 });
    const R = st.R || {};
    const tags = [R.gravity < 15 ? '🌙 луна' : '', R.vertushki > 1.3 ? '🌀 ураган' : '', R.plity < 0.5 ? '🧊 тонкий лёд' : '', R.tolkat >= 1 ? '🤜 толкаться можно' : '🙅 толкаться нельзя'].filter(Boolean).join(' · ');
    lab.hud('rules', 'Правила: ' + tags, { color: '#bfe6ff', size: 13 });
  },
  overNote(lab) {
    const st = lab.state, me = st.me;
    return [me.fin != null ? `Место ${st.place} из ${st.total}, квота ${st.quota}` : `Дошёл до чекпоинта ${me.cp}`, `Падений: ${me.falls} · сбит: ${me.hits} · прыжков: ${me.jumps} · нырков: ${me.dives}`];
  },
};
