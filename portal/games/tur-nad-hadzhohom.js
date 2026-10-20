// «Тур над Хаджохом» — ремейк-донор урока 5 по мотивам прыжка Super Mario Bros. и Celeste, оболочка «Лаб3D 1.0» (three.js).
// План.
// Фраза: горный тур скачет по скалам Хаджохской теснины к сакле пастуха; внизу река Белая, упал — начинаешь с флажка.
// Ядро на 3 секунды: разбег — прыжок (держи — выше, отпусти — ниже) — приземление с пылью и сжатием.
// Три участка, каждый сначала показывает приём без риска, потом проверяет (как уровень 1-1 Super Mario Bros.):
// тропа (щели, ступени, первая низкая скала над твёрдой землёй), река (камни, плоты, камни уходят под воду по очереди),
// стена теснины (нависающие скалы — прыгай коротко, плот-лифт).
// Риск — награда: огоньки висят над щелями и под скалами; огонёк засчитывается, когда встанешь на твёрдую скалу (клубника Celeste).
// Финиш — шест у сакли: чем выше коснулся, тем больше очков (флагшток Марио). Призрак лучшей попытки, спидран без огоньков.
// Видно = правда: тонущий камень дрожит и пускает пузыри, прежде чем уйти под воду; на краю, где ты сорвался, растёт тур из камней.
// Спрятанная механика донора — отзывчивость: время койота, буфер нажатия, падение быстрее подъёма, высота от длительности нажатия, зависание на вершине
// и поправка на угол (Celeste). Все приёмы — ручки «Лаборатории прыжка», общий выключатель — ручка secret (пресет «Без спрятанной механики»).
// Разбор лучших игр жанра — docs/01_Журнал_курса.md, раздел урока 5.
// Вариации жанра из настоящих игр — пресеты меню Tab (урок 5, чекпоинт 2 «Один прыжок — много игр», 20.10.2026): двойной прыжок
// (Hollow Knight, Ori), рывок (Celeste), прыжок от стены (Super Meat Boy, Mega Man X), заряд (Jump King), автобег (Canabalt, Super Mario Run),
// лёд (Super Mario Bros. 3), рушащиеся скалы (Celeste, «пончики» Super Mario), ветер (Celeste), камнепад сзади (прокрутка Super Mario Bros. 3,
// валун Crash Bandicoot), без флажков (Jump King, Getting Over It). Прыжок и помощники везде те же; имя вариации и её правило — строкой HUD.
// Вид сбоку: X — вправо, Y — вверх, трасса на Z = 0, стены теснины — в −Z.
const GAME = {
  engine: 'three',
  title: 'Тур над Хаджохом',
  subtitle: 'Горный тур скачет по скалам Хаджохской теснины. Добеги до сакли пастуха быстрее призрака!',
  donor: 'Super Mario Bros. и Celeste',
  players: 1,
  controls: [
    { input: 'move', text: 'бежать' },
    { input: 'a', text: 'прыжок: держи — выше' },
    { input: 'b', text: 'рывок (в вариации «Рывок»)' },
  ],
  camera: { type: 'side', tilt: Math.PI / 2 - 0.12, distance: 20, target: [0, 4, 0] }, // камеру ведёт сама игра: см. aim()
  field: { w: 30, h: 16 },
  sky: ['#3d92d6', '#ffe4b8'],
  fog: 0.011,
  accent: '#ffd23f',
  scoreColor: '#ffd23f', // счёт золотом, как огоньки
  lives: 0,
  decisions: [
    'Чувство: прыжок слушается с полуслова — сорвался с края и всё равно долетел',
    'Честность: обрыв и река видны заранее, тонущий камень дрожит перед тем, как уйти под воду',
    'Выбор: прыгнуть коротко под скалой или длинно за огоньком — и донести его до твёрдой скалы',
  ],
  // «Лаборатория прыжка»: 12 ручек прыжка и бега и общий выключатель спрятанной механики
  config: {
    jumpH: { value: 3.2, min: 1.5, max: 6, step: 0.1, label: 'Высота прыжка, м' },
    apex: { value: 0.38, min: 0.2, max: 0.8, step: 0.01, label: 'Время до вершины, с' },
    fall: { value: 1.8, min: 1, max: 3, step: 0.1, label: 'Падение быстрее подъёма, ×', hint: '1 — вниз так же медленно, как вверх' },
    cut: { value: 0.45, min: 0, max: 1, step: 0.05, label: 'Отпустил кнопку — прыжок ниже', hint: 'доля скорости вверх после отпускания; 1 — высота не зависит от нажатия' },
    coyote: { value: 0.1, min: 0, max: 0.3, step: 0.01, label: 'Время койота, с', hint: 'сколько ещё можно прыгнуть, сорвавшись с края' },
    buffer: { value: 0.12, min: 0, max: 0.3, step: 0.01, label: 'Буфер нажатия, с', hint: 'нажатие чуть раньше приземления не теряется' },
    hang: { value: 0.5, min: 0.2, max: 1, step: 0.05, label: 'Зависание на вершине: тяжесть ×', hint: '1 — без зависания' },
    corner: { value: 0.25, min: 0, max: 0.5, step: 0.05, label: 'Поправка на угол, м', hint: 'задел скалу краем головы — тур проскользнёт мимо; не долетел до уступа пару сантиметров — заберётся' },
    run: { value: 7.5, min: 3, max: 14, step: 0.5, label: 'Скорость бега' },
    accel: { value: 0.12, min: 0.02, max: 0.6, step: 0.02, label: 'Разгон до полной скорости, с' },
    air: { value: 0.8, min: 0, max: 1, step: 0.05, label: 'Управление в воздухе', hint: 'доля разгона в полёте' },
    maxFall: { value: 22, min: 6, max: 40, step: 1, label: 'Предельная скорость падения' },
    secret: { value: 1, min: 0, max: 1, step: 0.05, label: 'Спрятанная механика: честный прыжок', hint: '0 — сырой прыжок: без койота, буфера, быстрого падения, высоты от нажатия, зависания и поправки на угол' },
    safe: { value: 1, min: 0, max: 1, step: 1, label: 'Огонёк засчитывается', names: ['сразу', 'на твёрдой скале'], hint: 'как клубника в Celeste: схватил над рекой — донеси до скалы, упал — огонёк вернётся на место' },
    ghost: { value: 1, min: 0, max: 1, step: 1, label: 'Призрак лучшей попытки', restart: true },
    race: { value: 0, min: 0, max: 1, step: 1, label: 'Спидран: без огоньков, очки только за время', restart: true },
    limit: { value: 150, min: 60, max: 300, step: 10, label: 'Время на трассу, с' },
    // вариации жанра: 0 — как в классике
    double: { value: 0, min: 0, max: 3, step: 1, label: 'Вариация «Прыжок»: прыжков в воздухе', hint: 'как двойной прыжок Hollow Knight и Ori; 0 — только с земли' },
    charge: { value: 0, min: 0, max: 1, step: 1, label: 'Вариация «Прыжок»: заряд — держи, копишь, отпусти — прыжок', hint: 'как Jump King: пока копишь, стоишь; в воздухе не свернёшь' },
    dash: { value: 0, min: 0, max: 1, step: 1, label: 'Вариация «Движение»: рывок на B (Shift)', hint: 'как в Celeste: один рывок в воздухе, на земле рывок снова готов (огонёк над туром)' },
    wall: { value: 0, min: 0, max: 1, step: 1, label: 'Вариация «Движение»: прыжок от стены', hint: 'как Super Meat Boy и Mega Man X: прижмись к скале — скользишь медленно, прыжок отталкивает' },
    auto: { value: 0, min: 0, max: 1, step: 1, label: 'Вариация «Движение»: автобег', hint: 'как Canabalt и Super Mario Run: тур бежит сам, ← тормозит' },
    ice: { value: 0, min: 0, max: 1.5, step: 0.1, label: 'Вариация «Опора»: лёд — разгон и торможение, с', hint: 'как ледяные уровни Super Mario Bros. 3; 0 — без льда', restart: true },
    crumble: { value: 0, min: 0, max: 2, step: 0.1, label: 'Вариация «Опора»: малые скалы рушатся через … с', hint: 'как рассыпающиеся блоки Celeste: встал — скала дрожит и падает, через 3 с вернётся; 0 — не рушатся', restart: true },
    wind: { value: 0, min: 0, max: 8, step: 0.5, label: 'Вариация «Сила»: порывы ветра, м/с', hint: 'как глава Golden Ridge в Celeste: стрелка ветра видна за секунду до порыва; 0 — тихо' },
    rockfall: { value: 0, min: 0, max: 8, step: 0.5, label: 'Вариация «Давление»: камнепад сзади, м/с', hint: 'как прокрутка Super Mario Bros. 3 и валун Crash Bandicoot: догонит — назад к флажку; 0 — нет' },
    nocp: { value: 0, min: 0, max: 1, step: 1, label: 'Вариация «Наказание»: без флажков', hint: 'как Jump King и Getting Over It: упал — всё сначала' },
  },
  presets: {
    'Новичок': { jumpH: 3.6, run: 6.5, coyote: 0.16, buffer: 0.2, air: 1, corner: 0.35, limit: 240 },
    'Без спрятанной механики': { secret: 0 },
    'Луна': { apex: 0.7, fall: 1.1, hang: 0.9, maxFall: 10 },
    'Безумие': { run: 12, apex: 0.26, accel: 0.04, limit: 90 },
    // вариации из настоящих игр: те же значения — в сценарии урока 5 (VARIATIONS), держать вместе
    'Двойной прыжок': { double: 1 },
    'Заряд': { charge: 1 },
    'Рывок': { dash: 1 },
    'От стены': { wall: 1 },
    'Автобег': { auto: 1 },
    'Лёд': { ice: 0.6 },
    'Рушится': { crumble: 0.8 },
    'Ветер': { wind: 4 },
    'Камнепад': { rockfall: 5 },
    'Без флажков': { nocp: 1 },
  },
  // имя вариации и её правило для строки HUD, баннера в начале и экрана конца партии
  VARIANTS: [
    { key: 'double', name: 'Двойной прыжок', how: c => (c.double > 1 ? `${Math.round(c.double)} прыжка в воздухе` : 'нажми прыжок ещё раз в воздухе') },
    { key: 'charge', name: 'Заряд', how: () => 'держи прыжок — копишь, отпусти — летишь; в воздухе не свернёшь' },
    { key: 'dash', name: 'Рывок', how: () => 'B (Shift) — рывок, в воздухе один раз' },
    { key: 'wall', name: 'От стены', how: () => 'прижмись к скале и прыгай от неё' },
    { key: 'auto', name: 'Автобег', how: () => 'тур бежит сам, ← тормозит; ты только прыгаешь' },
    { key: 'ice', name: 'Лёд', how: () => 'скользко: разгон и торможение долгие' },
    { key: 'crumble', name: 'Рушится', how: c => `малые скалы падают через ${String(c.crumble).replace('.', ',')} с` },
    { key: 'wind', name: 'Ветер', how: () => 'порывы ветра, стрелка предупреждает' },
    { key: 'rockfall', name: 'Камнепад', how: () => 'сзади катится камнепад — не стой' },
    { key: 'nocp', name: 'Без флажков', how: () => 'упал — всё сначала' },
  ],
  notes: [
    'Плоты и тонущие камни — не твёрдая скала: огонёк засчитывается на камне или скале, которые стоят на месте.',
    'Тур из камней на краю — память о падениях этой партии: чем выше, тем чаще здесь срывался.',
  ],

  HW: 0.4, HH: 1.15, // половина ширины и рост тура
  // трасса: [x начала, x конца, верх] — скала; s — камень в реке; m — плот (dx, dy, период); k — тонущий камень (период, сдвиг);
  // c — нависающая скала (низ на y)
  LEVEL: [
    [-8, 14, 0], [17, 26, 0], [29, 34, 1.5], [37.5, 44, 3], [47.5, 57, 1.8], [50.5, 54.5, 4.6, 'c'], [60, 70, 1.8],
    [73.5, 75.5, 0.4, 's'], [79, 81, 1, 's'], [84.5, 86.5, 0.6, 'k', 4.4, 0], [89.5, 92.5, 1.2, 'm', 2.2, 0, 2.6], [97.5, 99.5, 1.4, 's'],
    [103, 105, 0.6, 'k', 4.4, 2.2], [108.5, 110.5, 1.6, 's'], [114, 117, 1.8, 'm', 0, 1.6, 2.2], [120.5, 130, 2.2],
    [133.5, 136.5, 4.4], [136, 142, 9.4, 'c'], [139.5, 142.5, 6.2], [145.5, 148.5, 8.2], [147, 153, 13, 'c'], [151.5, 154.5, 10],
    [157.5, 160.5, 11.8, 'm', 0, 2, 2.4], [163.5, 167, 14.2], [170, 186, 14.2],
  ],
  CHECKS: [0, 62, 122, 178], // флажки участков; последний — шест у сакли, финиш
  ORBS: [[15.5, 2.6], [27.5, 3.4], [45.8, 5.4], [52.5, 3.2], [58.5, 4.2], [77.2, 3.2], [95, 3.6], [101.2, 3.9], [112.2, 4.4], [118.8, 6.6],
    [131.8, 5.4], [143.9, 8.6], [155.9, 12.4], [161.9, 16.6], [168.6, 16.4]],
  SINK: { warn: 0.7, down: 0.35, under: 0.8, up: 0.35, depth: 3.6 }, // тонущий камень: дрожит → уходит → под водой → всплывает

  start(lab, scene) {
    const st = lab.state, c = lab.cfg;
    Object.assign(st, { solids: [], movers: [], orbs: [], carry: [], cp: 0, cpMax: 0, deaths: 0, jumps: 0, shorts: 0, early: 0, edge: 0, lost: 0, saved: 0,
      corners: 0, got: 0, chain: 0, chainT: -9, dead: 0, done: false, path: [], pathT: 0, dustT: 0, look: 3, camY: 0, lastStand: [0, 0], cairns: {}, cairnN: 0,
      secFalls: 0, clean: 0, banner: false, cam: { k: 1, punch: 0 }, gust: { t: 0, dir: 1, v: 0, k: 0, on: false }, fallX: -16, fallWait: 2.5, rockT: 0 });
    this.world(lab, scene);
    this.track(lab);
    st.hero = this.buildTur(lab, false);
    lab.hero(st.hero.node);
    const run = this.bestRun;
    if (run && c.ghost >= 1) { st.ghost = this.buildTur(lab, true); lab.hud('ghost', `Призрак: ${run.t.toFixed(1)} с`, { color: '#bff4ff' }); }
    this.extras(lab);
    lab.stat('помощь', 0);
    this.respawn(lab);
    if (!lab.playing) this.poster(lab);
    this.aim(lab, 0, true);
  },
  // детали вариаций, которые можно включить и посреди партии (ручки без перезапуска)
  extras(lab) {
    const st = lab.state, c = lab.cfg, h = st.hero;
    if (c.dash > 0 && !h.pip) { h.pipOn = lab.mat('#7fd8ff', { glow: 1.4 }); h.pipOff = lab.mat('#59606e'); h.pip = lab.ball(0.15, h.pipOn, { parent: h.node, at: [0, 1.85, 0], shadow: false }); } // рывок готов — огонёк над туром светится
    if (c.charge > 0 && !h.bar) { h.bar = lab.box(1, 0.14, 0.06, lab.mat('#ffd23f', { glow: 1.1 }), { parent: h.node, at: [0, 1.95, 0], shadow: false }); h.bar.visible = false; } // полоса заряда
    if (c.wind > 0 && !st.streaks) this.buildWind(lab);
    if (c.rockfall > 0 && !st.rocks) this.buildRockfall(lab);
  },
  // афиша в меню: тур в прыжке над первой щелью, огонёк над головой, камера ближе. Двигается только картинка — сам тур стоит на старте,
  // и первый кадр партии всё возвращает
  POSTER: { x: 15.3, y: 2.3, vx: 7, face: 1, ground: null },
  poster(lab) {
    const st = lab.state, h = st.hero, o = st.orbs[0], P = this.POSTER;
    h.node.position.set(P.x, P.y, 0); h.pose.scale.set(0.84, 1.32, 0.9); h.body.rotation.z = 0.14;
    h.legs.forEach((l, i) => { l.rotation.z = i < 2 ? 0.8 : -0.8; });
    if (o) o.m.position.set(15.9, 4.5, 0);
    st.posterOn = true;
  },
  unposter(lab) {
    const st = lab.state, o = st.orbs[0];
    st.posterOn = false;
    if (o) o.m.position.set(o.x, o.y, 0);
    this.aim(lab, 0, true);
  },
  // имя вариации: все включённые ручки вариаций
  variant(lab) {
    const c = lab.cfg, on = this.VARIANTS.filter(v => c[v.key] > 0);
    if (!on.length) return { name: 'Классика', how: 'добеги до сакли; держи прыжок — выше' };
    return { name: on.map(v => v.name).join(' + '), how: on.map(v => v.how(c)).join('; ') };
  },

  update(lab, dt) {
    const st = lab.state, h = st.hero, p = lab.p1;
    if (st.posterOn) this.unposter(lab);
    this.extras(lab);
    if (!st.banner) { // имя вариации и её правило крупно в начале партии
      st.banner = true;
      const v = this.variant(lab), at = [h.x + 4.5, h.y + 4.6, 0.5];
      lab.popup(at, v.name, '#ffe680', 32);
      lab.after(0.35, () => lab.popup([at[0], at[1] - 1.4, 0.5], v.how, '#ffffff', 17));
    }
    this.moveMovers(lab, lab.t);
    this.tickWorld(lab, dt);
    this.tickCrumble(lab, dt);
    this.tickWind(lab, dt);
    if (st.ghost) this.ghostAt(lab, st.ghost, lab.t);
    if (st.done) { this.animate(lab, h, dt); this.aim(lab, dt); return; }
    if ((st.pathT -= dt) <= 0) { st.pathT += 0.05; st.path.push([h.x, h.y, h.face]); } // путь для призрака
    this.tickRockfall(lab, dt);
    if (st.dead > 0) { st.dead -= dt; if (st.dead <= 0) this.respawn(lab); this.aim(lab, dt); return; }
    this.control(lab, h, p, dt);
    this.aim(lab, dt);
    this.animate(lab, h, dt);
    this.orbs(lab, dt);
    const next = this.CHECKS[st.cp + 1];
    if (next != null && h.x >= next) this.reach(lab, st.cp + 1);
    if (h.y < -2.6 && !st.done) this.die(lab);
    if (lab.t > lab.cfg.limit && !st.done) lab.gameOver('Время вышло');
    this.huds(lab);
  },
  huds(lab) {
    const st = lab.state, c = lab.cfg, v = this.variant(lab);
    lab.hud('rule', `${v.name}: ${v.how}`, { color: '#ffe680', size: 14 });
    lab.hud('time', `⏱ ${lab.t.toFixed(1)} с · участок ${Math.min(st.cp + 1, 3)} из 3` + (c.race ? ' · спидран' : ` · огоньки ${st.got} из ${this.ORBS.length}`), { color: '#ffffff', size: 16 });
    lab.hud('falls', st.deaths ? `Падений: ${st.deaths}` : null, { color: '#ff9a8a', size: 15 });
    lab.hud('clean', st.clean > 1 ? `Чистых участков подряд ×${st.clean}` : null, { color: '#7cf5a8', size: 16 + st.clean * 2 });
    lab.hud('carry', st.carry.length ? 'Огонёк у тура: встань на твёрдую скалу — и он твой' : null, { color: '#ffd23f', size: 15 });
  },

  overNote(lab) {
    const st = lab.state, v = this.variant(lab);
    return [v.name !== 'Классика' ? `Вариация: ${v.name} — ${v.how}` : null,
      st.cp >= 3 ? `Трасса за ${st.finish.toFixed(1)} с, падений ${st.deaths}` : `Участок ${st.cp + 1} из 3, падений ${st.deaths}`,
      `Прыжков ${st.jumps}, коротких (отпустил кнопку) ${st.shorts}`,
      `Нажал чуть раньше приземления или чуть позже края: ${st.early + st.edge} раз — прыжок случился ${st.saved}, игра «проглотила» ${st.lost}`,
      lab.cfg.secret > 0 ? `Поправка на угол подсадила на уступ или провела мимо скалы: ${st.corners} раз` : 'Спрятанная механика выключена: прыжок сырой. Включи «Как задумано» и сравни.'];
  },

  /* ---------- управление и прыжок ---------- */
  control(lab, h, p, dt) {
    const c = lab.cfg, st = lab.state, s = c.secret;
    const coyote = c.coyote * s, buffer = c.buffer * s, fallK = 1 + (c.fall - 1) * s, cutK = 1 - (1 - c.cut) * s, hangK = 1 - (1 - c.hang) * s;
    const g = 2 * c.jumpH / (c.apex * c.apex), v0 = 2 * c.jumpH / c.apex;
    if (h.dashT > 0) return this.dashing(lab, h, dt);
    // бег: разгон к цели, в воздухе слабее. Автобег бежит сам, заряд стоит на месте, на льду разгон и торможение долгие
    const icy = c.ice > 0 && h.ground && !h.ground.mover;
    const want = h.chg > 0 ? 0 : c.auto > 0 ? c.run * (p.x < -0.3 ? 0.4 : 1) : p.x * c.run;
    let rate = c.run / (c.accel + (icy ? c.ice : 0)) * (h.ground ? 1 : c.charge > 0 ? 0 : c.air);
    if (h.wallLock > 0) { h.wallLock -= dt; rate *= 0.2; } // после прыжка от стены тур не тянет обратно к скале
    if (icy && Math.abs(h.vx) > 2 && Math.sign(want || -h.vx) !== Math.sign(h.vx)) this.skid(lab, h, dt); else h.skidding = false; // занос на льду
    h.vx += lab.clamp(want - h.vx, -rate * dt, rate * dt);
    if (c.auto > 0) h.face = 1; else if (Math.abs(p.x) > 0.1 && (h.ground || !(c.charge > 0))) h.face = Math.sign(p.x);
    // скала сбоку: скольжение и прыжок от стены
    const wall = c.wall > 0 && !h.ground ? this.wallSide(lab, h) : 0;
    if (wall) { h.wallT = 0.1; h.wallDir = wall; } else h.wallT = (h.wallT || 0) - dt;
    // нажатие: прыжок сейчас, по койоту или в буфер до приземления
    h.off = h.ground ? 0 : h.off + dt;
    if (h.pend != null) h.pend += dt;
    if (c.charge > 0) this.charge(lab, h, p, v0, dt);
    else if (p.pressed.a) {
      if (h.ground) this.jump(lab, h, v0);
      else if (h.wallT > 0) this.wallJump(lab, h, v0);
      else if (!h.jumped && h.off <= coyote) { st.edge++; this.jump(lab, h, v0); this.helped(lab); } // чуть позже края — время койота
      else if ((h.airJumps || 0) < Math.round(c.double)) this.airJump(lab, h, v0);
      else if (!h.jumped && h.off <= 0.2) { st.edge++; st.lost++; lab.count('потерянные нажатия'); }
      else h.pend = 0;
    }
    if (c.dash > 0 && p.pressed.b && h.dashes > 0) return this.dash(lab, h, p);
    if (h.cutReady && !p.a && h.vy > 0) { h.vy *= cutK; h.cutReady = false; if (cutK < 0.95) { st.shorts++; if (s > 0) lab.count('_secret'); } }
    // тяжесть: на вершине легче, вниз — быстрее
    let k = h.vy < 0 ? fallK : 1;
    if (Math.abs(h.vy) < 2.5 && p.a && !(c.charge > 0)) k *= hangK;
    h.vy = Math.max(h.vy - g * k * dt, -c.maxFall);
    if (wall && p.x * wall > 0.3 && h.vy < -3) { h.vy = -3; this.wallDust(lab, h, wall, dt); } // прижался к скале — скользит медленно
    const was = h.ground;
    this.move(lab, h, h.vx * dt + this.windDx(lab, h, dt), h.vy * dt, c.corner * s);
    if (h.ground && !was) this.land(lab, h, v0, buffer);
    if (h.ground && !h.ground.mover && !h.ground.crumble) { st.lastStand[0] = h.x; st.lastStand[1] = h.y; }
  },
  jump(lab, h, v0) {
    h.vy = v0; h.ground = null; h.jumped = true; h.cutReady = true; h.pend = null;
    lab.state.jumps++; lab.count('прыжки'); lab.sfx.jump();
    h.sq = -0.35; // растянуть вверх
    lab.burst([h.x - h.face * 0.2, h.y + 0.1, 0], { count: 8, colors: ['#efe0bd', '#cdb48c'], speed: 2.5, up: 1, size: 0.16 });
  },
  land(lab, h, v0, buffer) {
    const st = lab.state, hard = h.fallV > 12;
    h.jumped = false; h.airJumps = 0; h.dashes = 1; h.sq = hard ? 0.42 : 0.24; // сплющить
    lab.tone(hard ? 110 : 160, 0.07, 'sine', 0.12, 60); lab.noise(0.05, 0.05, 900);
    lab.burst([h.x, h.y + 0.05, 0], { count: hard ? 14 : 6, colors: lab.cfg.ice > 0 ? ['#ffffff', '#cfefff'] : ['#efe0bd', '#cdb48c'], speed: hard ? 4 : 2.5, up: 0.5, size: 0.16 });
    if (hard) { lab.shake(0.14); lab.ring([h.x, h.y + 0.04, 0], { color: '#f6e7c6', radius: 1.4, life: 0.3 }); st.cam.punch = 0.035; }
    if (h.pend != null && h.pend <= 0.2) { // нажал чуть раньше приземления
      st.early++;
      if (h.pend <= buffer) { this.jump(lab, h, v0); this.helped(lab); } else { st.lost++; lab.count('потерянные нажатия'); }
    }
    h.pend = null;
  },
  helped(lab) { const st = lab.state; st.saved++; lab.count('_secret'); lab.stat('помощь', st.saved + st.corners); }, // спрятанная механика сработала: игрок этого не видит, но чувствует
  corrected(lab) { const st = lab.state; st.corners++; lab.count('_secret'); lab.stat('помощь', st.saved + st.corners); },

  /* ---------- вариации прыжка и движения ---------- */
  airJump(lab, h, v0) { // двойной прыжок (Hollow Knight, Ori): ещё один в воздухе, чуть ниже, со взмахом
    h.airJumps = (h.airJumps || 0) + 1;
    h.vy = v0 * 0.88; h.jumped = true; h.cutReady = true; h.pend = null; h.sq = -0.42;
    lab.state.jumps++; lab.count('прыжки'); lab.count('двойные прыжки');
    lab.tone(660, 0.1, 'triangle', 0.09, 990); lab.noise(0.08, 0.05, 2400);
    lab.ring([h.x, h.y + 0.1, 0], { color: '#ffffff', radius: 1.2, life: 0.3 });
    lab.burst([h.x, h.y + 0.2, 0], { count: 14, colors: ['#ffffff', '#fff1c9', '#bff4ff'], speed: 3.5, up: -1, size: 0.15 });
  },
  charge(lab, h, p, v0, dt) { // заряд (Jump King): держишь на земле — тур приседает и копит; отпустил — прыжок туда, куда жмёшь стрелку
    if (h.ground && p.a) {
      const was = h.chg || 0;
      h.chg = Math.min(1, was + dt / 0.75);
      h.sq = 0.3 * h.chg;
      if (!was) lab.count('заряды');
      if (Math.floor(h.chg * 6) > Math.floor(was * 6)) lab.tone(220 * lab.pitch(Math.floor(h.chg * 6) * 2), 0.05, 'triangle', 0.05);
    } else if (h.chg > 0) {
      const k = 0.32 + 0.88 * h.chg, dir = Math.abs(p.x) > 0.3 ? Math.sign(p.x) : 0;
      if (h.ground) { this.jump(lab, h, v0 * k); h.vx = dir * lab.cfg.run; h.cutReady = false; if (dir) h.face = dir; }
      h.chg = 0;
    }
  },
  dash(lab, h, p) { // рывок (Celeste): короткий бросок по стрелкам — вбок, вниз или наискось; в воздухе один раз
    const st = lab.state, dx = Math.abs(p.x) > 0.3 ? Math.sign(p.x) : Math.abs(p.y) > 0.5 ? 0 : h.face, dy = p.y > 0.5 ? 1 : p.y < -0.5 ? -1 : 0, n = Math.hypot(dx, dy) || 1;
    h.dashT = 0.16; h.dvx = dx / n * 21; h.dvy = dy / n * 17; h.dashes = 0; h.pend = null; h.cutReady = false; h.chg = 0;
    if (dx) h.face = dx;
    lab.count('рывки');
    lab.sfx.whoosh(); lab.shake(0.08); lab.hitstop(0.03);
    const dot = st.dashDot = lab.group({ at: [h.x, h.y + 0.6, 0] });
    lab.trail(dot, { color: '#7fd8ff', width: 0.9, length: 14, glow: 1.6 });
    lab.burst([h.x, h.y + 0.6, 0], { count: 16, colors: ['#bff4ff', '#7fd8ff', '#ffffff'], speed: 4, size: 0.15 });
  },
  dashing(lab, h, dt) {
    const st = lab.state, was = h.ground;
    h.dashT -= dt; h.vx = h.dvx; h.vy = h.dvy;
    this.move(lab, h, h.vx * dt, h.vy * dt, lab.cfg.corner * lab.cfg.secret);
    if (h.ground && !was) { h.jumped = false; h.airJumps = 0; }
    if (h.ground) h.dashes = 1;
    if (st.dashDot) st.dashDot.position.set(h.x, h.y + 0.6, 0);
    if (h.dashT <= 0) this.endDash(lab, h);
  },
  endDash(lab, h) { // конец рывка: скорость гаснет, хвост догорает
    const st = lab.state, d = st.dashDot;
    h.dashT = 0; h.vx *= 0.55; h.vy = h.vy > 0 ? h.vy * 0.45 : 0;
    if (d) { d.visible = false; st.dashDot = null; lab.after(1, () => d.removeFromParent()); }
  },
  // скала сбоку вплотную (не плот и не упавшая): +1 справа, −1 слева
  wallSide(lab, h) {
    const W = this.HW, H = this.HH;
    for (const s of lab.state.solids) {
      if (s.off || s.mover || h.y + H <= s.y0 + 0.15 || h.y >= s.y1 - 0.15) continue;
      if (Math.abs(h.x + W - s.x0) < 0.06) return 1;
      if (Math.abs(s.x1 - (h.x - W)) < 0.06) return -1;
    }
    return 0;
  },
  wallJump(lab, h, v0) { // от стены (Super Meat Boy, Mega Man X): вверх и прочь от скалы
    const d = h.wallDir;
    h.vy = v0 * 0.95; h.vx = -d * lab.cfg.run * 1.05; h.face = -d; h.wallLock = 0.16; h.wallT = 0;
    h.jumped = true; h.cutReady = true; h.pend = null; h.sq = -0.35;
    lab.state.jumps++; lab.count('прыжки'); lab.count('от стены');
    lab.sfx.jump(); lab.tone(240, 0.06, 'square', 0.06);
    lab.burst([h.x + d * this.HW, h.y + 0.6, 0], { count: 12, colors: ['#d9844f', '#efe0bd'], speed: 3.5, dir: [-d, 0.4, 0], size: 0.14 });
  },
  wallDust(lab, h, d, dt) {
    const st = lab.state;
    if ((st.wallDustT = (st.wallDustT || 0) - dt) > 0) return;
    st.wallDustT = 0.07;
    lab.burst([h.x + d * this.HW, h.y + 0.3, 0.3], { count: 2, colors: ['#efe0bd', '#cdb48c'], speed: 0.8, up: 0.5, size: 0.11, life: 0.35 });
  },
  skid(lab, h, dt) { // занос на льду: лёд звенит, из-под копыт летит ледяная крошка
    const st = lab.state;
    if (!h.skidding) { h.skidding = true; lab.count('заносы'); lab.tone(1800, 0.14, 'sawtooth', 0.02, 1100); }
    if ((st.skidT = (st.skidT || 0) - dt) > 0) return;
    st.skidT = 0.05;
    lab.burst([h.x + Math.sign(h.vx) * 0.45, h.y + 0.05, 0], { count: 3, colors: ['#ffffff', '#cfefff'], speed: 2, up: 0.6, size: 0.12, life: 0.35 });
  },

  /* ---------- вариации мира: ветер, рушащиеся скалы, камнепад ---------- */
  windDx(lab, h, dt) { const v = lab.state.gust.v; return v ? v * dt * (h.ground ? 0.3 : 1) : 0; },
  buildWind(lab) {
    const T = lab.THREE, st = lab.state, n = 44;
    st.streaks = { mesh: lab.instances(new T.BoxGeometry(1.4, 0.05, 0.05), lab.mat('#ffffff', { glow: 0.5, alpha: 0.7 }), n, { shadow: false }), list: [] };
    for (let i = 0; i < n; i++) st.streaks.list.push({ x: lab.rand(-14, 20), y: lab.rand(-4, 7), z: lab.rand(-3, 2.5) });
    st.gust.dir = lab.chance(0.6) ? -1 : 1;
  },
  // ветер (Celeste, Golden Ridge): затишье → стрелка в HUD за секунду до порыва → порыв; направление по зерну, чаще в лицо
  tickWind(lab, dt) {
    const st = lab.state, c = lab.cfg, w = st.gust;
    if (!(c.wind > 0)) return;
    const CALM = 2.2, WARN = 0.9, GUST = 2.6;
    if ((w.t += dt) > CALM + WARN + GUST) { w.t = 0; w.dir = lab.chance(0.6) ? -1 : 1; }
    const warn = w.t > CALM && w.t <= CALM + WARN, gust = w.t > CALM + WARN;
    w.k = lab.damp(w.k, gust ? 1 : 0, gust ? 6 : 4, dt);
    w.v = w.dir * c.wind * w.k;
    if (gust && !w.on) { lab.count('порывы'); lab.noise(1.4, 0.07, 500); }
    w.on = gust;
    if (!st.done) lab.hud('wind', warn ? `🌬 Порыв ${w.dir > 0 ? '→' : '←'} через ${(CALM + WARN - w.t).toFixed(1)} с` : gust ? `🌬 Ветер ${w.dir > 0 ? '→ в спину' : '← в лицо'}` : null, { color: '#bff4ff', size: warn ? 19 : 15 });
    // струи ветра вокруг камеры: при предупреждении редкие, в порыв — густые
    const S = st.streaks, v = lab.view, n = S.list.length, dens = Math.max(w.k, warn ? 0.2 : 0);
    S.list.forEach((s, i) => {
      s.x += w.dir * (8 + c.wind * 3) * dens * dt;
      if (Math.abs(s.x - v.target.x) > 17) s.x = v.target.x - Math.sign(s.x - v.target.x) * 16.5;
      lab.place(S.mesh, i, [s.x, v.target.y + s.y, s.z], { scale: i < n * dens ? [1 + w.k * 1.5, 1, 1] : 0.0001 });
    });
  },
  // рушащиеся скалы (Celeste, «пончики» Super Mario): встал — скала дрожит и сыплет крошкой, потом падает в реку и через 3 с возвращается
  tickCrumble(lab, dt) {
    const st = lab.state, h = st.hero, c = lab.cfg;
    if (!(c.crumble > 0)) return;
    for (const s of st.solids) {
      const cr = s.crumble;
      if (!cr || cr.rising) continue;
      if (!s.off && cr.t < 0 && h.ground === s) { cr.t = c.crumble; lab.tone(150, 0.08, 'square', 0.05, 90); lab.noise(0.1, 0.05, 1600); }
      if (!s.off && cr.t >= 0) {
        cr.t -= dt;
        cr.g.position.x = Math.sin(lab.t * 60) * 0.06;
        if ((cr.dust -= dt) <= 0) { cr.dust = 0.08; lab.burst([lab.rand(s.x0, s.x1), s.y1 - 0.3, 1.3], { count: 2, colors: ['#cdb48c', '#a9583c'], speed: 1, up: -0.5, size: 0.1, life: 0.4 }); }
        if (cr.t > 0) continue;
        s.off = true; cr.back = 3; cr.g.position.x = 0; lab.count('обвалы');
        if (h.ground === s) h.ground = null;
        lab.noise(0.3, 0.1, 700); lab.tone(110, 0.2, 'sine', 0.1, 50);
        lab.burst([(s.x0 + s.x1) / 2, s.y1, 0.5], { count: 18, colors: ['#d9844f', '#b0603f', '#efe0bd'], speed: 4, up: 1, size: 0.18 });
        const g = cr.g; lab.tween(0.7, k => { g.position.y = -7 * k; g.rotation.z = 0.12 * k; }, 'inQuad');
      } else if (s.off && (cr.back -= dt) <= 0 && !(h.x + this.HW > s.x0 && h.x - this.HW < s.x1 && h.y < s.y1 + 0.5 && h.y + this.HH > s.y1 - 3)) {
        const g = cr.g; cr.rising = true;
        lab.tween(0.45, k => { g.position.y = -7 * (1 - k); g.rotation.z = 0.12 * (1 - k); }, 'outBack');
        lab.after(0.45, () => { s.off = false; cr.t = -1; cr.rising = false; });
        lab.tone(520, 0.08, 'triangle', 0.05, 780);
      }
    }
  },
  buildRockfall(lab) {
    const T = lab.THREE, st = lab.state, n = 28;
    st.rocks = { mesh: lab.instances(new T.DodecahedronGeometry(0.7, 0), '#8a6f5c', n), list: [] };
    if (st.hero) { st.fallX = st.hero.x - 12; st.fallWait = 1.5; } // включили посреди партии — камнепад позади тура
    for (let i = 0; i < n; i++) st.rocks.list.push({ y: (i / n) * 22, dx: lab.rand(-1.8, 0.4), z: lab.rand(-1.6, 1.6), s: lab.rand(0.6, 1.4), sp: lab.rand(6, 11), r: lab.rand(0, 6) });
  },
  // камнепад (прокрутка Super Mario Bros. 3, валун Crash Bandicoot): катится за туром; догнал — тур с флажка, камнепад отходит назад
  tickRockfall(lab, dt) {
    const st = lab.state, c = lab.cfg, h = st.hero, R = st.rocks;
    if (!(c.rockfall > 0)) return;
    if (st.dead <= 0) {
      if ((st.fallWait -= dt) <= 0) st.fallX += c.rockfall * dt;
      if (st.fallX > h.x - this.HW - 0.3) { lab.count('камнепад догнал'); this.die(lab, true); }
    }
    R.list.forEach((r, i) => {
      const y = 19 - ((r.y + lab.t * r.sp) % 22);
      lab.place(R.mesh, i, [st.fallX + r.dx, y, r.z], { scale: r.s, rot: [r.r + lab.t * 3, r.r, lab.t * 2 + i] });
    });
    const gap = h.x - st.fallX;
    if ((st.rockT -= dt) <= 0) {
      st.rockT = 0.14;
      lab.burst([st.fallX + 0.4, lab.rand(-2, 12), 0.8], { count: 3, colors: ['#cdb48c', '#8a6f5c', '#efe0bd'], speed: 2.5, up: 0.5, size: 0.3, life: 0.6 });
      if (gap < 18) lab.noise(0.14, 0.03 + 0.06 * (1 - gap / 18), 260);
    }
    lab.hud('rock', st.done ? null : `🪨 Камнепад в ${Math.max(0, gap).toFixed(0)} м`, { color: gap < 7 ? '#ff5d6c' : '#ffb38a', size: gap < 7 ? 19 : 15 });
  },
  // движение по осям с выталкиванием из скал; стоя на плоту, тур едет вместе с ним.
  // Поправка на угол (Celeste): не долетел до уступа на corner — тур забирается наверх; задел скалу краем головы — проскальзывает мимо.
  move(lab, h, dx, dy, corner) {
    const W = this.HW, H = this.HH, S = lab.state.solids, air = !h.ground;
    if (h.ground && h.ground.mover) { dx += h.ground.mover.dx; dy += Math.min(0, h.ground.mover.dy); h.y += Math.max(0, h.ground.mover.dy); }
    h.x += dx;
    for (const s of S) if (!s.off && h.x + W > s.x0 && h.x - W < s.x1 && h.y < s.y1 - 0.01 && h.y + H > s.y0 + 0.01) {
      if (air && corner > 0 && !s.ceil && s.y1 - h.y <= corner) { h.y = s.y1; this.corrected(lab); continue; }
      h.x = dx > 0 ? s.x0 - W : s.x1 + W; h.vx = 0;
    }
    h.fallV = -h.vy; h.y += dy; h.ground = null;
    for (const s of S) if (!s.off && h.x + W > s.x0 && h.x - W < s.x1 && h.y < s.y1 && h.y + H > s.y0) {
      if (dy <= 0 && h.y - dy >= s.y1 - 0.25) { h.y = s.y1; h.vy = 0; h.ground = s; continue; }
      if (dy <= 0) continue;
      const inL = h.x + W - s.x0, inR = s.x1 - (h.x - W); // насколько голова зашла под скалу слева и справа
      if (corner > 0 && Math.min(inL, inR) <= corner) { h.x = inL < inR ? s.x0 - W - 0.001 : s.x1 + W + 0.001; this.corrected(lab); continue; }
      h.y = s.y0 - H; h.vy = 0; // стукнулся о скалу
      lab.tone(90, 0.05, 'square', 0.05);
      lab.burst([h.x, s.y0, 0.2], { count: 5, colors: ['#a9583c', '#7a3f2a'], speed: 2, size: 0.12 });
    }
  },
  die(lab, rock) {
    const st = lab.state, h = st.hero;
    st.deaths++; st.secFalls++; st.dead = 0.45; lab.count('падения');
    h.node.visible = false; h.chg = 0;
    if (h.dashT > 0) this.endDash(lab, h);
    if (rock) { // камнепад догнал: тура засыпало
      lab.burst([h.x, h.y + 0.6, 0.3], { count: 30, colors: ['#8a6f5c', '#cdb48c', '#efe0bd'], speed: 6, up: 3 });
      lab.noise(0.45, 0.18, 500); lab.tone(120, 0.3, 'sine', 0.12, 50);
    } else {
      lab.burst([h.x, -2.7, 0.3], { count: 30, colors: ['#bff4ff', '#4fc3e8', '#ffffff'], speed: 6, up: 5 });
      lab.ring([h.x, -2.82, 0], { color: '#dff8ff', radius: 2.2 });
      lab.noise(0.35, 0.16, 1400); lab.tone(420, 0.25, 'sine', 0.1, 120);
    }
    lab.shake(0.3); lab.hitstop(0.05);
    this.dropCarry(lab);
    this.cairn(lab, st.lastStand[0], st.lastStand[1]);
  },
  respawn(lab) {
    const st = lab.state, c = lab.cfg, x = this.CHECKS[c.nocp > 0 ? 0 : Math.min(st.cp, 2)] + 1.5, top = st.solids.find(s => !s.ceil && !s.mover && !s.crumble && x >= s.x0 && x <= s.x1);
    if (c.nocp > 0) st.cp = 0; // без флажков: всё сначала, взятые флажки второй раз наград не дают
    st.hero = Object.assign(st.hero, { x, y: top ? top.y1 : 2, vx: 0, vy: 0, ground: top, off: 0, pend: null, jumped: false, cutReady: false, face: 1, sq: 0,
      airJumps: 0, dashes: 1, dashT: 0, chg: 0, wallT: 0, wallLock: 0 });
    st.hero.node.visible = true;
    st.lastStand = [x, st.hero.y];
    if (c.rockfall > 0) { st.fallX = x - 10; st.fallWait = st.deaths ? 1.5 : 2.5; }
    if (st.deaths > 0) {
      lab.pulse(st.hero.pose, 1.35, 0.2);
      lab.burst([x, st.hero.y + 0.8, 0], { count: 12, colors: ['#ffffff', '#bff4ff'], speed: 3, up: 1, size: 0.14 });
      lab.tone(660, 0.08, 'triangle', 0.07, 990);
    }
  },
  reach(lab, i) {
    const st = lab.state, f = st.flags[i], h = st.hero, c = lab.cfg;
    if (i < 3 && i <= st.cpMax) { st.cp = i; st.secFalls = 0; return; } // без флажков: тот же флажок второй раз — без награды
    st.cp = i; st.cpMax = i;
    // участок без падений: серия ×1, ×2, ×3 (в спидране очки только за время)
    if (!c.race) {
      if (st.secFalls === 0) {
        const n = ++st.clean;
        lab.addScore(150 * n, [h.x, h.y + 2.2, 0], '#7cf5a8');
        lab.after(0.4, () => lab.popup([h.x - 1, h.y + 4.2, 0], n > 1 ? `Чисто! ×${n}` : 'Чисто!', '#7cf5a8', 22 + n * 2));
      } else st.clean = 0;
    }
    st.secFalls = 0;
    if (i < 3) {
      lab.tween(0.5, k => { f.banner.position.y = f.top + 0.7 + k * 1.75; }, 'outBack');
      f.banner.material = lab.mat('#ffcf3f', { glow: 0.6 });
      lab.burst([f.x, f.top + 2.4, 0], { count: 30, colors: ['#ff4d5e', '#ffd23f', '#ffffff'], speed: 7, up: 3 });
      lab.sfx.power(); lab.popup([f.x, f.top + 3.2, 0], `Участок ${i + 1}!`, '#ffffff', 24);
      return;
    }
    // финиш: шест у сакли — чем выше коснулся, тем больше очков; очки за время; рекорд призрака
    const hgt = lab.clamp((h.y - f.top) / 5, 0, 1), pole = Math.round(hgt * 10) * 50;
    st.finish = lab.t; st.done = true; lab.count('финиш');
    lab.addScore(Math.max(0, Math.round((c.limit - lab.t) * (c.race ? 100 : 40))), [h.x, h.y + 2, 0], '#7cf5a8');
    if (!c.race && pole > 0) { lab.addScore(pole, [f.x, h.y + 1, 0], '#ffd23f'); lab.popup([f.x, h.y + 2.6, 0], hgt >= 1 ? 'До самого верха!' : `Шест: ${Math.round(h.y - f.top + 0.5)} м`, '#ffd23f', 24); }
    for (let n = 0; n < 6; n++) lab.tone(1320 * lab.pitch(n * 2), 0.18, 'triangle', 0.07, 0, n * 0.06); // колокольчик
    lab.burst([f.x, h.y + 1, 0], { count: 50, colors: ['#ff4d5e', '#ffd23f', '#7cf5a8', '#ffffff'], speed: 9, up: 4 });
    lab.slowmo(0.6, 0.35);
    if (h.dashT > 0) this.endDash(lab, h);
    Object.assign(h, { vx: 0, vy: 0, chg: 0 });
    ['wind', 'rock'].forEach(k => lab.hud(k, null));
    if (!this.bestRun || lab.t < this.bestRun.t) { this.bestRun = { t: lab.t, path: st.path.concat([[h.x, h.y, 1]]) }; lab.popup([h.x, h.y + 3.4, 0], 'Новый призрак!', '#bff4ff', 22); }
    lab.after(0.8, () => lab.win(`Сакля! Трасса за ${st.finish.toFixed(1)} с`));
  },

  /* ---------- огоньки: держи над головой, пока не встанешь на твёрдую скалу ---------- */
  orbs(lab, dt) {
    const st = lab.state, h = st.hero;
    st.orbs.forEach((o, i) => {
      if (o.banked) return;
      if (o.carried) {
        o.m.position.x = lab.damp(o.m.position.x, h.x - h.face * (0.5 + o.slot * 0.45), 10, dt);
        o.m.position.y = lab.damp(o.m.position.y, h.y + 1.8 + Math.sin(lab.t * 6 + i) * 0.1, 10, dt);
        o.m.rotation.y += dt * 5;
        return;
      }
      o.m.position.y = o.y + Math.sin(lab.t * 3 + i) * 0.15; o.m.rotation.y += dt * 2;
      if (Math.abs(o.x - h.x) > 0.9 || Math.abs(o.y - (h.y + 0.55)) > 1) return;
      o.carried = true; o.slot = st.carry.length; st.carry.push(o);
      lab.tone(1046 * lab.pitch(o.slot * 2), 0.1, 'triangle', 0.08); lab.pulse(o.m, 1.6, 0.2);
      lab.burst(o.m, { count: 10, colors: ['#ffd23f', '#fff1a8'], speed: 3, size: 0.14 });
      if (!lab.cfg.safe) this.bank(lab);
    });
    if (st.carry.length && h.ground && !h.ground.mover) this.bank(lab);
  },
  bank(lab) {
    const st = lab.state;
    st.carry.forEach((o, k) => {
      o.banked = true; o.carried = false; o.m.visible = false; st.got++; lab.count('огоньки');
      st.chain = lab.t - st.chainT < 4 ? st.chain + 1 : 0; st.chainT = lab.t; // огоньки подряд звенят всё выше
      lab.addScore(100, o.m, '#ffd23f');
      lab.tone(880 * lab.pitch(st.chain * 2), 0.14, 'triangle', 0.1, 0, k * 0.07); lab.tone(1320 * lab.pitch(st.chain * 2), 0.16, 'sine', 0.06, 0, k * 0.07 + 0.05);
      lab.burst(o.m, { count: 18, colors: ['#ffd23f', '#fff1a8', '#ff9f43'], speed: 5 });
    });
    if (st.carry.length) { lab.sfx.coin(); lab.vibrate(40, 0.25); }
    st.carry = [];
  },
  dropCarry(lab) { // упал — огоньки возвращаются на места
    for (const o of lab.state.carry) { o.carried = false; o.m.position.set(o.x, o.y, 0); lab.pulse(o.m, 1.8, 0.3); }
    lab.state.carry = [];
  },
  // тур из камней на краю, где сорвался: каждое падение — ещё камень сверху
  cairn(lab, x, y) {
    const st = lab.state, key = Math.round(x), n = st.cairns[key] = (st.cairns[key] || 0) + 1;
    if (st.cairnN >= 60) return;
    lab.place(st.cairnMesh, st.cairnN++, [key + lab.rand(-0.08, 0.08), y + 0.1 + (n - 1) * 0.17, -1.05], { scale: [1.2 - Math.min(n, 5) * 0.08, 0.8, 1], rot: lab.rand(0, 3), color: n % 2 ? '#9a948c' : '#c4bdb2' });
  },

  /* ---------- плоты и тонущие камни: положение — от времени партии ---------- */
  moverAt(m, t) {
    if (m.kind === 'm') { const k = Math.sin(t * Math.PI * 2 / m.per); return [m.bx + m.mx * k, m.by + m.my * k, 0]; }
    const S = this.SINK, u = (((t + m.ph) % m.per) + m.per) % m.per, calm = m.per - S.warn - S.down - S.under - S.up;
    let d = 0, shake = 0;
    if (u >= calm && u < calm + S.warn) shake = 1;
    else if (u >= calm + S.warn) {
      const v = u - calm - S.warn;
      d = v < S.down ? (v / S.down) ** 2 : v < S.down + S.under ? 1 : 1 - (v - S.down - S.under) / S.up;
    }
    return [m.bx, m.by - d * S.depth, shake];
  },
  moveMovers(lab, t) {
    for (const s of lab.state.movers) {
      const m = s.mover, [x0, top, shake] = this.moverAt(m, t);
      m.dx = x0 - s.x0; m.dy = top - s.y1; m.shake = shake;
      s.x0 = x0; s.x1 = x0 + m.w; s.y1 = top; s.y0 = top - m.th;
      if (m.g) m.g.position.set(x0 + m.w / 2 + (shake ? Math.sin(t * 70) * 0.07 : 0), top, 0);
    }
  },

  /* ---------- камера: смотрит вперёд по бегу, по высоте держится за последний уступ ---------- */
  aim(lab, dt, snap) {
    const st = lab.state, h = st.posterOn ? this.POSTER : st.hero, v = lab.view, aspect = lab.camera ? lab.camera.aspect : 16 / 9;
    // живая камера: чуть дышит, от жёсткого приземления — толчок, на афише и на финише — ближе
    const C = st.cam, want = st.posterOn ? 0.8 : st.done ? 0.86 : 1;
    C.k = snap ? want : lab.damp(C.k, want, 2, dt);
    C.punch = snap ? 0 : lab.damp(C.punch, 0, 7, dt);
    v.distance = lab.clamp(12.5 / (Math.tan(0.4) * aspect), 15, 42) * C.k * (1 - C.punch) * (1 + Math.sin(lab.t * 0.7) * 0.012); // 25 м трассы в ширину на любом экране
    // по вертикали — за высотой последнего приземления (как в Super Mario World), за туром — только если он ушёл далеко вверх или вниз
    if (h.ground) st.camY = h.y; else if (h.y > st.camY + 3.5) st.camY = h.y - 3.5; else if (h.y < st.camY - 2) st.camY = h.y + 2;
    st.look = lab.damp(st.look, h.face * 3, 2.5, dt || 1);
    const tx = h.x + st.look + h.vx * 0.12, ty = Math.max(3.4, st.camY + 2.8), far = Math.abs(tx - v.target.x) > 12;
    v.target.x = snap ? tx : lab.damp(v.target.x, tx, far ? 9 : 4.5, dt);
    v.target.y = snap ? ty : lab.damp(v.target.y, ty, 3, dt);
  },

  /* ---------- мир: река, стены теснины, горы, пихты, облака, орлы, водопад ---------- */
  world(lab, scene) {
    const T = lab.THREE, st = lab.state, O = x => Object.assign({ parent: null }, x);
    // река Белая: вода, пена течёт навстречу, буруны у камней
    lab.box(380, 0.5, 40, lab.mat('#1f8fb3', { shiny: true }), { at: [85, -3.15, -8], shadow: false });
    lab.box(380, 0.06, 2.4, lab.mat('#61c4dc', { shiny: true }), { at: [85, -2.88, 2.6], shadow: false }); // светлая отмель у берега
    const foam = st.foam = lab.instances(new T.BoxGeometry(1, 0.05, 0.14), lab.mat('#ecfbff', { glow: 0.35 }), 150, { shadow: false });
    const tile = []; for (let i = 0; i < 8; i++) tile.push([lab.rand(0, 20), lab.rand(-3, 3), lab.rand(0.8, 2.6)]);
    for (let r = 0; r < 18; r++) tile.forEach(([x, z, w], i) => lab.place(foam, r * 8 + i, [-40 + r * 20 + x, -2.86, z], { scale: [w, 1, 1] }));
    // стены теснины: зубчатые силуэты слоями — ближе тёплый песчаник с зелёной кромкой, дальше дымка (воздушная перспектива)
    const ridge = (z, depth, color, base, amp, step, cap) => {
      const tops = []; let x = -50;
      while (x <= 240) { tops.push([x, base + Math.sin(x * 0.05 + z) * amp * 0.6 + lab.rand(-amp, amp) * 0.4]); x += step * lab.rand(0.6, 1.4); }
      const shape = (pts, bottom) => { const sh = new T.Shape(); sh.moveTo(pts[0][0], bottom(pts[0])); pts.forEach(([x, y]) => sh.lineTo(x, y)); for (let i = pts.length - 1; i >= 0; i--) sh.lineTo(pts[i][0], bottom(pts[i])); return sh; };
      lab.mesh(new T.ExtrudeGeometry(shape(tops, () => -4), { depth, bevelEnabled: false }), color, { at: [0, 0, z - depth], shadow: false });
      if (cap) lab.mesh(new T.ExtrudeGeometry(shape(tops.map(([x, y]) => [x, y + 0.05]), ([, y]) => y - lab.rand(0.5, 1.1)), { depth: depth + 0.1, bevelEnabled: false }), cap, { at: [0, 0, z - depth], shadow: false });
      return tops;
    };
    const near = ridge(-9, 4, '#b08672', 7, 3.5, 2.6, '#6c9a5e');
    const scree = ridge(-6.5, 1.5, '#8f6a5c', 0.2, 1.4, 2.2); // осыпь у подножия: тёмная и без травы, чтобы не казалась уступом трассы
    ridge(-22, 5, '#a08aa2', 12, 6, 4.5);
    ridge(-42, 5, '#97a6cf', 19, 9, 7);
    st.nearTop = x => { const i = near.findIndex(p => p[0] > x); if (i <= 0) return 6; const [x0, y0] = near[i - 1], [x1, y1] = near[i]; return y0 + (y1 - y0) * (x - x0) / (x1 - x0); };
    // горы со снежными шапками вдали
    const hills = [];
    for (let i = 0; i < 11; i++) {
      const x = -50 + i * 28 + lab.rand(-6, 6), r = lab.rand(18, 28), hgt = lab.rand(34, 52), z = -70 - lab.rand(0, 20);
      hills.push(lab.cone(r, hgt, '#7f8fbf', O({ at: [x, hgt / 2 - 4, z], sides: 6, rot: lab.rand(0, 3) })));
      hills.push(lab.cone(r * 0.36, hgt * 0.36, '#f4f6ff', O({ at: [x, hgt - 4 - hgt * 0.18 + 0.05, z], sides: 6, rot: lab.rand(0, 3) })));
    }
    lab.noShadow(lab.merge(hills));
    // пихты на кромке ближней стены и на скалах трассы — копии одного дерева
    const N = 110;
    st.pine = { crown: lab.instances(new T.ConeGeometry(1, 2.2, 7), '#2e7d4a', N * 2), trunk: lab.instances(new T.CylinderGeometry(0.16, 0.22, 1, 6), '#6b4a30', N), n: 0, N };
    near.forEach(([x, y], i) => { if (i % 2 === 0 && lab.chance(0.8)) this.pine(lab, x, y - 0.5, -9.5 - lab.rand(0, 2.5), lab.rand(1, 1.8)); });
    scree.forEach(([x, y], i) => { if (i % 3 === 0 && lab.chance(0.6)) this.pine(lab, x, y - 0.3, -7.2, lab.rand(0.6, 1)); });
    // облака: по одному слитому мешу, плывут медленно
    st.clouds = [];
    for (let i = 0; i < 7; i++) {
      const puffs = [[0, 0, 2.6], [2.2, -0.4, 1.9], [-2.1, -0.5, 1.8], [0.7, 0.9, 1.7], [-0.9, 0.6, 1.4]].map(([x, y, r]) => lab.ball(r, lab.mat('#ffffff', { glow: 0.12 }), O({ at: [x, y, 0], scale: [1, 0.7, 0.8] })));
      const c = lab.noShadow(lab.merge(puffs)); c.position.set(-30 + i * 36 + lab.rand(-8, 8), lab.rand(22, 30), -40 + lab.rand(-6, 6)); c.scale.setScalar(lab.rand(1, 1.6));
      st.clouds.push(c);
    }
    // орлы кружат над теснинами
    st.eagles = [0, 1, 2].map(i => {
      const g = lab.group({ at: [40 + i * 55, 16 + i * 2, -12] });
      lab.box(0.7, 0.18, 0.22, '#3b2c22', { parent: g, shadow: false });
      const wings = [-1, 1].map(s => { const w = lab.group({ parent: g, at: [0, 0, s * 0.1] }); lab.box(0.5, 0.05, 1.4, '#4a382a', { parent: w, at: [0, 0, s * 0.7], shadow: false }); return w; });
      return { g, wings, cx: 40 + i * 55, cy: 16 + i * 2, r: 6 + i * 2, ph: i * 2 };
    });
    // водопад Руфабго в глубине теснины: струи и брызги
    const ft = st.nearTop(98) + 0.3;
    lab.box(3.2, ft + 2.9, 0.4, lab.mat('#dff6ff', { glow: 0.35, alpha: 0.85 }), { at: [98, (ft - 2.9) / 2, -8.7], shadow: false });
    lab.box(7, 0.25, 3, lab.mat('#e6f9ff', { glow: 0.3 }), { at: [98, -2.8, -7.4], shadow: false }); // пена под водопадом
    st.fallFx = { x: 98, t: 0 };
    // туры из камней на краях (падения партии)
    st.cairnMesh = lab.instances(new T.IcosahedronGeometry(0.2, 0), '#9a948c', 60);
    // форель выпрыгивает из реки рядом с туром
    st.fish = [0, 1, 2].map(i => {
      const g = lab.group();
      lab.merge([lab.box(0.62, 0.22, 0.14, '#e7a35c', O({ round: 0.06 })), lab.box(0.4, 0.1, 0.15, '#f4f0e6', O({ at: [0.02, -0.07, 0] })),
        lab.cone(0.14, 0.24, '#d9844f', O({ at: [-0.38, 0, 0], rot: [0, 0, Math.PI / 2], sides: 4, scale: [1, 1, 0.4] })),
        lab.box(0.05, 0.05, 0.16, '#15151c', O({ at: [0.22, 0.04, 0] }))], g);
      g.visible = false;
      return { g, t: 1.5 + i * 1.8, on: false };
    });
    // бабочки над цветами у тропы
    st.flies = { mesh: lab.instances(new T.BoxGeometry(0.22, 0.02, 0.14), lab.mat('#ffffff', { glow: 0.15 }), 14, { shadow: false }), list: [] };
    for (let i = 0; i < 14; i++) {
      const [x0, x1, y] = lab.pick(this.LEVEL.filter(r => !r[3]));
      st.flies.list.push({ x: lab.rand(x0, x1), y: y + lab.rand(0.7, 1.6), z: lab.pick([-1.2, 1.2]) + lab.rand(-0.2, 0.2), a: lab.rand(0.6, 1.4), ph: lab.rand(0, 6), color: lab.pick(['#ffd23f', '#ff6f91', '#ffffff', '#7fd8ff', '#ff9f43']) });
    }
  },
  pine(lab, x, y, z, s) {
    const P = lab.state.pine; if (P.n >= P.N) return;
    const i = P.n++;
    lab.place(P.trunk, i, [x, y + 0.5 * s, z], { scale: s });
    lab.place(P.crown, i * 2, [x, y + 1.7 * s, z], { scale: [s * 1.1, s, s * 1.1], rot: lab.rand(0, 3) });
    lab.place(P.crown, i * 2 + 1, [x, y + 2.6 * s, z], { scale: [s * 0.78, s * 0.8, s * 0.78], rot: lab.rand(0, 3) });
  },

  /* ---------- трасса: скалы, камни, плоты, нависающие скалы, огоньки, флажки, сакля ---------- */
  track(lab) {
    const T = lab.THREE, st = lab.state, c = lab.cfg, O = x => Object.assign({ parent: null }, x), rock = [], dark = [], grass = [], lip = [], stone = [], moss = [], ceil = [];
    const ice = c.ice > 0, GRASS = ice ? '#e4f6ff' : '#6cc24a', LIP = ice ? '#a9dcf2' : '#4f9c3a', MOSS = ice ? '#eef9ff' : '#5fae4c'; // вариация «Лёд»: снег и наледь вместо травы
    const flowers = lab.instances(new T.IcosahedronGeometry(0.09, 0), lab.mat('#ffffff', { glow: 0.1 }), 160, { shadow: false }), tufts = lab.instances(new T.ConeGeometry(0.12, 0.35, 4), ice ? '#cfefff' : '#4f9c3a', 160, { shadow: false });
    let fl = 0;
    const deco = (x0, x1, top) => { // цветы и пучки травы по краям тропы, не на самой тропе
      for (let x = x0 + 0.4; x < x1 - 0.3 && fl < 160; x += lab.rand(0.5, 1.2)) {
        const z = lab.chance(0.5) ? lab.rand(-1.4, -0.7) : lab.rand(0.8, 1.4);
        lab.place(tufts, fl, [x, top + 0.15, z], { rot: lab.rand(0, 3), scale: lab.rand(0.7, 1.3) });
        lab.place(flowers, fl++, [x + 0.15, top + 0.2, z + 0.1], { color: lab.pick(ice ? ['#ffffff', '#dff4ff'] : ['#ff6f91', '#ffd23f', '#ffffff', '#b38cff', '#ff9f43']) });
      }
    };
    for (const [x0, x1, y, kind, a, b, per] of this.LEVEL) {
      const w = x1 - x0, cx = (x0 + x1) / 2;
      if (kind === 'c') { // нависающая скала: потолок, низ ровно там, где стукнешься
        ceil.push(lab.box(w, 12, 2.8, '#b0603f', O({ at: [cx, y + 6, 0] })));
        dark.push(lab.box(w + 0.1, 0.4, 2.9, '#7f3f2b', O({ at: [cx, y + 0.2, 0] })));
        moss.push(lab.box(w * 0.7, 0.12, 0.3, MOSS, O({ at: [cx, y + 0.45, 1.5] })));
        st.solids.push({ x0, x1, y0: y, y1: y + 3, ceil: true });
        continue;
      }
      const s = { x0, x1, y0: kind ? y - 0.8 : -3.5, y1: y };
      // вариация «Рушится»: камни в реке и малые скалы (не с флажком) — отдельной группой, чтобы падать по одной
      const own = c.crumble > 0 && (kind === 's' || (!kind && w <= 4 && !this.CHECKS.some(x => x >= x0 && x <= x1))) ? [] : null;
      if (own) s.crumble = { g: lab.group(), t: -1, back: 0, dust: 0 };
      if (kind === 'm' || kind === 'k') {
        const g = lab.group(), P = [];
        if (kind === 'm') { // плот: брёвна поперёк, верёвки
          const n = Math.round(w / 0.5);
          for (let i = 0; i < n; i++) P.push(lab.cyl(0.24, 0.24, 2.4, i % 2 ? '#a8743f' : '#97683a', O({ at: [-w / 2 + 0.25 + i * (w - 0.5) / (n - 1), -0.25, 0], rot: [Math.PI / 2, 0, 0], sides: 7 })));
          for (const z of [-0.75, 0.75]) P.push(lab.box(w + 0.06, 0.12, 0.14, '#e6d3a0', O({ at: [0, -0.04, z] })));
        } else { // тонущий камень: мокрый, синеватый, с пеной у воды
          P.push(lab.cyl(w * 0.5, w * 0.58, 3.4, '#6f8fae', O({ at: [0, -1.8, 0], sides: 7, scale: [1, 1, 1.25] })));
          P.push(lab.cyl(w * 0.48, w * 0.5, 0.2, '#86d4c8', O({ at: [0, -0.1, 0], sides: 7, scale: [1, 1, 1.25] })));
        }
        lab.merge(P, g);
        const m = { kind, g, w, th: kind === 'm' ? 0.5 : 0.8, bx: x0, by: y, mx: a, my: b, per: kind === 'm' ? per : a, ph: kind === 'k' ? b : 0, dx: 0, dy: 0, shake: 0, bubT: 0 };
        Object.assign(s, { y0: y - m.th, mover: m });
        st.movers.push(s);
      } else if (kind === 's') {
        (own || stone).push(lab.cyl(w * 0.5, w * 0.62, y + 3.6, '#7f90a5', O({ at: [cx, (y - 3.6) / 2 - 0.05, 0], sides: 7, scale: [1, 1, 1.25] })));
        (own || moss).push(lab.cyl(w * 0.47, w * 0.5, 0.22, MOSS, O({ at: [cx, y - 0.1, 0], sides: 7, scale: [1, 1, 1.25] })));
      } else {
        (own || rock).push(lab.box(w, y + 3.5, 3, '#d9844f', O({ at: [cx, (y - 3.5) / 2 - 0.15, 0] })));
        (own || dark).push(lab.box(w + 0.14, 0.4, 3.12, '#b0603f', O({ at: [cx, y - 1.1 - lab.rand(0, 1.2), 0] }))); // слой песчаника
        (own || grass).push(lab.box(w + 0.1, 0.32, 3.15, GRASS, O({ at: [cx, y - 0.16, 0] })));
        (own || lip).push(lab.box(w + 0.1, 0.2, 0.12, LIP, O({ at: [cx, y - 0.4, 1.6] })));
        if (own) own.push(lab.box(w * 0.5, 0.06, 3.16, '#7a3f2a', O({ at: [cx - w * 0.1, y - 0.02, 0], rot: [0, 0, 0.05] }))); // трещина: эта скала рушится
        else {
          deco(x0, x1, y);
          for (let k = 0; k < w / 7; k++) this.pine(lab, lab.rand(x0 + 0.6, x1 - 0.6), y, -1.1, lab.rand(0.5, 0.75));
        }
      }
      if (own) lab.merge(own, s.crumble.g);
      st.solids.push(s);
    }
    lab.merge(rock); lab.merge(dark); lab.merge(grass); lab.merge(lip); lab.merge(stone); lab.merge(moss); lab.merge(ceil);
    this.moveMovers(lab, 0); this.moveMovers(lab, 0);
    // огоньки: золотые искры; огонёк над щелью — риск
    if (!lab.cfg.race) this.ORBS.forEach(([x, y]) => {
      const m = lab.mesh(new T.OctahedronGeometry(0.3), lab.mat('#ffd23f', { glow: 1.3, shiny: true }), { at: [x, y, 0], shadow: false });
      st.orbs.push({ x, y, m });
    });
    // флажки участков: флаг внизу древка, пока не добежал; последний — шест у сакли
    st.flags = this.CHECKS.map((x, i) => {
      const top = st.solids.find(s => !s.ceil && !s.mover && x >= s.x0 && x <= s.x1).y1;
      if (i === 3) return this.finish(lab, x, top);
      lab.cyl(0.06, 0.07, 2.9, '#f4f0e6', { at: [x, top + 1.45, -0.8] });
      const banner = lab.box(1, 0.6, 0.05, i ? '#9aa3ad' : lab.mat('#ffcf3f', { glow: 0.6 }), { at: [x + 0.52, top + (i ? 0.7 : 2.45), -0.8] });
      return { x, top, banner };
    });
  },
  // шест с полосами через метр (видно, сколько очков на какой высоте) и сакля пастуха с дымком
  finish(lab, x, top) {
    const O = o => Object.assign({ parent: null }, o), P = [];
    P.push(lab.cyl(0.09, 0.11, 5.4, '#f4f0e6', O({ at: [x + 0.5, top + 2.7, 0] })));
    for (let k = 0; k < 5; k++) P.push(lab.cyl(0.13, 0.13, 0.3, k % 2 ? '#ffffff' : '#e5484d', O({ at: [x + 0.5, top + 0.6 + k, 0] })));
    lab.merge(P);
    lab.ball(0.28, lab.mat('#ffd23f', { glow: 1, shiny: true }), { at: [x + 0.5, top + 5.6, 0] });
    lab.box(1.3, 0.75, 0.05, lab.mat('#2fa35a', { glow: 0.3 }), { at: [x + 1.2, top + 4.9, 0] });
    const S = [], sx = x + 4.5, sz = -1.8;
    S.push(lab.box(4.4, 2.5, 3, '#f1e4cc', O({ at: [sx, top + 1.25, sz] })));
    S.push(lab.cone(3.3, 1.8, '#d9b25a', O({ at: [sx, top + 3.4, sz], sides: 4, rot: Math.PI / 4, scale: [1.05, 1, 0.75] }))); // соломенная крыша
    S.push(lab.box(0.9, 1.5, 0.1, '#7a4a2a', O({ at: [sx - 0.9, top + 0.75, sz + 1.52] })));
    S.push(lab.box(0.5, 1.2, 0.5, '#9a8a7a', O({ at: [sx + 1.2, top + 3.8, sz] }))); // труба
    for (let i = 0; i < 9; i++) S.push(lab.box(0.08, 0.9, 0.08, '#8a6a40', O({ at: [x + 9 + i * 0.5, top + 0.45, -0.6] }))); // плетень
    S.push(lab.box(4.2, 0.12, 0.06, '#8a6a40', O({ at: [x + 11, top + 0.7, -0.6] })));
    S.push(lab.cone(1.1, 1.8, '#e0c25a', O({ at: [x + 7.8, top + 0.9, -2.2], sides: 7 }))); // стог
    lab.merge(S);
    lab.box(0.8, 0.6, 0.1, lab.mat('#ffd86b', { glow: 0.9 }), { at: [sx + 0.8, top + 1.4, sz + 1.52], shadow: false });
    lab.state.smoke = [sx + 1.2, top + 4.5, sz];
    return { x, top };
  },

  /* ---------- тур: тело, голова с рогами-дугами назад, борода, четыре ноги ---------- */
  buildTur(lab, ghost) {
    const T = lab.THREE, gm = ghost ? lab.mat('#bfe8ff', { alpha: 0.38, glow: 0.3 }) : null, C = c => gm || c, O = x => Object.assign({ parent: null }, x);
    const fur = C('#b9773f'), light = C('#f2d9a8'), dark = C('#5a3a22'), horn = C('#3d3026'), hoof = C('#262022');
    const node = lab.group(), pose = lab.group({ parent: node }), body = lab.group({ parent: pose, at: [0, 0.6, 0] });
    lab.merge([
      lab.box(1.1, 0.52, 0.6, fur, O({ at: [0, 0.06, 0], round: 0.14 })), // туловище
      lab.box(0.86, 0.18, 0.5, light, O({ at: [0, -0.16, 0], round: 0.06 })), // живот
      lab.box(0.42, 0.5, 0.44, fur, O({ at: [0.46, 0.22, 0], rot: [0, 0, -0.55], round: 0.1 })), // холка и шея
      lab.box(0.16, 0.24, 0.12, light, O({ at: [-0.58, 0.2, 0], rot: [0, 0, 0.6] })), // хвостик
    ], body);
    const head = lab.group({ parent: body, at: [0.7, 0.4, 0] }), H = [
      lab.box(0.4, 0.36, 0.36, fur, O({ round: 0.09 })),
      lab.box(0.28, 0.22, 0.28, light, O({ at: [0.22, -0.08, 0], round: 0.05 })), // морда
      lab.box(0.07, 0.06, 0.12, dark, O({ at: [0.37, -0.04, 0] })),
      lab.cone(0.07, 0.28, dark, O({ at: [0.2, -0.3, 0], rot: [0, 0, Math.PI], sides: 4 })), // борода
    ];
    for (const s of [-1, 1]) {
      H.push(lab.mesh(new T.TorusGeometry(0.27, 0.06, 5, 10, Math.PI * 0.95), horn, O({ at: [-0.08, 0.1, s * 0.11], rot: [0, s * 0.3, 0.2] }))); // рог дугой назад
      H.push(lab.box(0.09, 0.09, 0.03, C('#ffffff'), O({ at: [0.12, 0.05, s * 0.18] })));
      H.push(lab.box(0.045, 0.055, 0.02, C('#15151c'), O({ at: [0.14, 0.05, s * 0.196] })));
      H.push(lab.cone(0.05, 0.18, fur, O({ at: [-0.12, 0.1, s * 0.2], rot: [s * 1.2, 0, 0.3], sides: 4 })));
    }
    lab.merge(H, head);
    const legs = [[0.36, 1], [0.36, -1], [-0.36, 1], [-0.36, -1]].map(([x, s]) => {
      const piv = lab.group({ parent: body, at: [x, -0.18, s * 0.17] });
      lab.merge([lab.box(0.14, 0.34, 0.14, dark, O({ at: [0, -0.17, 0] })), lab.box(0.16, 0.1, 0.16, hoof, O({ at: [0, -0.37, 0] }))], piv);
      return piv;
    });
    if (ghost) lab.noShadow(node);
    return { node, pose, body, head, legs, x: 0, y: 0, vx: 0, vy: 0, face: 1, turn: 0, sq: 0, run: 0, off: 0 };
  },
  animate(lab, h, dt) {
    const st = lab.state, b = h.body;
    h.node.position.set(h.x, h.y, 0);
    h.turn = lab.damp(h.turn, h.face > 0 ? 0 : Math.PI, 18, dt); h.node.rotation.y = h.turn;
    b.rotation.z = lab.damp(b.rotation.z, h.ground ? 0 : lab.clamp(h.vy * 0.035, -0.45, 0.4), 14, dt);
    h.sq = lab.damp(h.sq, 0, 10, dt);
    const q = lab.juicy('squash') ? h.sq : 0; // сжатие и растяжение от ног
    h.pose.scale.set(1 + q * 0.5, 1 - q, 1 + q * 0.3);
    if (h.pip) h.pip.material = h.dashes > 0 ? h.pipOn : h.pipOff; // рывок готов или потрачен
    if (h.bar) { h.bar.visible = h.chg > 0; h.bar.scale.x = Math.max(0.05, h.chg || 0); h.bar.position.y = 1.95 + (h.chg >= 1 ? Math.sin(lab.t * 30) * 0.04 : 0); }
    const sp = Math.abs(h.vx);
    h.run += dt * sp * 2.4;
    h.legs.forEach((l, i) => { l.rotation.z = h.ground ? Math.sin(h.run + (i < 2 ? 0 : Math.PI)) * 0.7 * Math.min(1, sp / 3) : (i < 2 ? 0.8 : -0.8); });
    h.head.rotation.z = h.ground ? Math.sin(h.run * 2) * 0.06 * Math.min(1, sp / 3) : 0.15;
    // пыль из-под копыт на бегу и при развороте
    if (h.ground && sp > 4.5 && (st.dustT -= dt) <= 0) {
      const skid = Math.sign(h.vx) !== h.face;
      st.dustT = skid ? 0.04 : 0.1;
      lab.burst([h.x - Math.sign(h.vx) * 0.45, h.y + 0.05, 0], { count: skid ? 4 : 2, colors: ['#efe0bd', '#cdb48c'], speed: 1.3, up: 0.7, size: 0.13, life: 0.4 });
    }
  },
  ghostAt(lab, g, t) {
    const P = this.bestRun.path, p = P[Math.min(P.length - 1, Math.floor(t / 0.05))];
    g.node.position.set(p[0], p[1], -0.8); g.node.rotation.y = p[2] > 0 ? 0 : Math.PI;
    g.legs.forEach((l, j) => { l.rotation.z = Math.sin(t * 14 + (j < 2 ? 0 : Math.PI)) * 0.5; });
  },
  tickWorld(lab, dt) {
    const st = lab.state, t = lab.t;
    st.foam.position.x = -((t * 2.5) % 20); // пена течёт по реке, рисунок повторяется каждые 20 м
    st.clouds.forEach(c => { c.position.x += dt * 0.7; });
    st.eagles.forEach(e => {
      const a = t * 0.35 + e.ph;
      e.g.position.set(e.cx + Math.cos(a) * e.r, e.cy + Math.sin(a * 2) * 0.6, -12 + Math.sin(a) * 2);
      e.g.rotation.y = -a - Math.PI / 2;
      e.wings.forEach((w, s) => { w.rotation.x = (s ? 1 : -1) * Math.sin(t * 5 + e.ph) * 0.25; });
    });
    if ((st.fallFx.t -= dt) <= 0) { st.fallFx.t = 0.5; lab.burst([st.fallFx.x + lab.rand(-1.5, 1.5), -2.5, -7.4], { count: 3, colors: ['#ffffff', '#dff6ff'], speed: 1.5, up: 2, size: 0.3, life: 0.9 }); }
    if (st.smoke && (st.smokeT = (st.smokeT || 0) - dt) <= 0) { st.smokeT = 0.35; lab.burst(st.smoke, { count: 1, colors: ['#d8d4cc', '#bdb7ad'], speed: 0.3, up: 1.4, size: 0.45, life: 1.6, gravity: -0.5 }); }
    // тонущий камень дрожит и пускает пузыри перед тем, как уйти под воду
    for (const s of st.movers) {
      const m = s.mover;
      if (m.kind === 'k' && m.shake && (m.bubT -= dt) <= 0) { m.bubT = 0.12; lab.burst([s.x0 + lab.rand(0, m.w), -2.75, lab.rand(-1, 1.2)], { count: 2, colors: ['#ffffff', '#bff4ff'], speed: 1, up: 2.2, size: 0.12, life: 0.4 }); }
    }
    if (st.flags) st.flags.forEach(f => { if (f.banner) f.banner.rotation.y = Math.sin(t * 4 + f.x) * 0.25; });
    // бабочки порхают восьмёркой, крылья машут
    if (lab.cfg.ice <= 0) st.flies.list.forEach((b, i) => lab.place(st.flies.mesh, i, [b.x + Math.sin(t * b.a + b.ph) * 1.1, b.y + Math.sin(t * b.a * 2 + b.ph) * 0.35, b.z + Math.cos(t * b.a + b.ph) * 0.4],
      { rot: [Math.sin(t * 22 + i) * 0.9, t * b.a + b.ph, 0], color: b.color }));
    // форель: прыжок дугой из воды и обратно с брызгами
    st.fish.forEach(f => {
      if (f.on || (f.t -= dt) > 0) return;
      f.on = true;
      const x0 = lab.view.target.x + lab.rand(-11, 11), z = lab.chance(0.5) ? lab.rand(1.9, 3) : lab.rand(-4.8, -3.2), d = lab.chance(0.5) ? 1 : -1;
      const splash = x => lab.burst([x, -2.85, z], { count: 6, colors: ['#ffffff', '#bff4ff'], speed: 2, up: 2, size: 0.12, life: 0.45 });
      f.g.visible = true; splash(x0);
      lab.tween(0.95, k => { f.g.position.set(x0 + d * 1.8 * k, -3 + Math.sin(Math.PI * k) * 2.3, z); f.g.rotation.set(0, d > 0 ? 0 : Math.PI, (0.5 - k) * 2.4); }, 'linear');
      lab.after(0.95, () => { f.g.visible = false; f.on = false; f.t = lab.rand(2.5, 6); splash(x0 + d * 1.8); });
    });
  },
};
