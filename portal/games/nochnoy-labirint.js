// «Ночной лабиринт» — ремейк-донор урока 3 по мотивам механики Pac-Man, оболочка «Лаб3D 1.0» (three.js).
// План.
// Фраза: пастушок собирает светлячков в каменном лабиринте у дольмена, за ним охотятся четыре волка; факел меняет охотника и добычу местами.
// Ядро на 3 секунды: поворот нажимается заранее и срезает угол, как у Pac-Man; светлячки хрустят, серия звенит всё выше.
// Риск — награда: подманить волков к факелу и прогнать всех разом (200 → 400 → 800 → 1600), догнать катящийся сыр, добрать последних светлячков.
// Угрозы: четыре характера волков (спрятанная механика); Вожак злится, когда светлячков мало; со 2-й ночи в коридорах спят волчата —
// проснутся рядом с пастушком и встанут цепочкой за волком (поезд призраков из Pac-Man CE DX), а с факелом цепочку съедают целиком.
// Кривая партии: разбег 6 с → погоня 18 с → разбег → погоня…; каждая ночь быстрее, факел короче, волчат больше.
// Сочность: искры и кольца, стоп-кадр при прогоне волка, замедление «на волосок», лабиринт мигает в конце ночи, пойманный пастушок кружится.
// Палитра: ночная синь и мох, лаймовые светлячки, оранжевый огонь, у каждого волка свой цвет.
// Разбор лучших игр жанра (Pac-Man, Ms. Pac-Man, Pac-Man CE DX) — в docs/01_Журнал_курса.md, раздел урока 3.
// Спрятанная механика донора — у каждого из четырёх волков одно своё правило (гонится, заходит наперерез, срезает по напарнику, пугается вблизи)
// и погоня сменяется разбегом. Из простых механик рождается динамика «меня окружают». Ручка «Спрятанная механика», пресет «Без спрятанной механики».
// Ось Z в three.js смотрит на игрока: строка 0 карты — дальний край поля (−Z), строки растут к игроку (+Z).
const GAME = {
  engine: 'three',
  title: 'Ночной лабиринт',
  subtitle: 'Собери светлячков в каменном лабиринте у дольмена. Схватил факел — и волки бегут от тебя.',
  donor: 'Pac-Man',
  players: 1,
  duo: 'vs', // ручка vs > 0 включает второго игрока: он ведёт Вожака
  controls: [
    { input: 'move4', text: 'бежать по лабиринту (поворот жми заранее)' },
    { input: 'a', text: 'прыжок через волка — в вариации «Прыжок»' },
    { input: 'b', text: 'закрыть проход за спиной — в вариации «Двери»' },
  ],
  camera: { type: 'iso', tilt: 0.62 },
  field: { w: 24.4, h: 26.6 },
  sky: ['#040816', '#17244a'],
  fog: 0.006,
  accent: '#d8ff6a',
  decisions: [
    'Чувство: «меня окружают» — волки заходят с разных сторон, а с факелом охотник и добыча меняются местами',
    'Честность: у каждого волка свой цвет и характер, факел мигает перед концом, дольмен светится цветом волка, который сейчас выйдет',
    'Выбор: собирать светлячков дальше или подманить волков к факелу и прогнать всех разом',
  ],
  config: {
    secret: { value: 1, min: 0, max: 1, step: 1, label: 'Спрятанная механика: у каждого волка свой характер', hint: '0 — все волки просто гонятся за тобой и не отступают; 1 — четыре характера и разбег, как в оригинале' },
    heroSpeed: { value: 5.4, min: 2, max: 10, step: 0.2, label: 'Скорость пастушка, клеток/с' },
    wolfSpeed: { value: 4.8, min: 2, max: 10, step: 0.2, label: 'Скорость волков, клеток/с' },
    frightSpeed: { value: 2.8, min: 1, max: 6, step: 0.2, label: 'Скорость волков, бегущих от факела' },
    powerTime: { value: 7, min: 1, max: 20, step: 0.5, label: 'Факел горит, с' },
    warnTime: { value: 2, min: 0, max: 5, step: 0.5, label: 'Факел мигает перед концом, с' },
    scatterTime: { value: 6, min: 0, max: 15, step: 1, label: 'Разбег: волки уходят в свои углы, с' },
    chaseTime: { value: 18, min: 5, max: 40, step: 1, label: 'Погоня, с' },
    ahead: { value: 4, min: 0, max: 8, step: 1, label: 'Хитрец целится на клеток вперёд тебя' },
    shyRadius: { value: 6, min: 2, max: 12, step: 1, label: 'Трус пугается ближе, клеток' },
    release: { value: 4, min: 0.5, max: 12, step: 0.5, label: 'Волки выходят из дольмена раз в, с' },
    wolves: { value: 4, min: 1, max: 4, step: 1, label: 'Волков', restart: true },
    nightUp: { value: 0.06, min: 0, max: 0.2, step: 0.01, label: 'Волки быстрее с каждой ночью' },
    corner: { value: 0.3, min: 0, max: 0.5, step: 0.05, label: 'Срезка угла: поворот раньше, клетки', hint: 'как у Pac-Man: пастушок срезает углы, а волки нет — на поворотах ты быстрее' },
    eatSlow: { value: 0.1, min: 0, max: 0.4, step: 0.02, label: 'Светлячки замедляют пастушка', hint: 'доля скорости: по пустому коридору бежишь быстрее, чем по полному' },
    tunnelSlow: { value: 0.5, min: 0.2, max: 1, step: 0.05, label: 'Волки в тоннеле, доля скорости', hint: 'тоннель — твоя лазейка: волки в нём вязнут' },
    elroy: { value: 20, min: 0, max: 60, step: 5, label: 'Вожак злится, когда светлячков осталось', hint: '0 — никогда. Злой Вожак быстрее и на разбеге не уходит в угол' },
    pups: { value: 6, min: 0, max: 12, step: 1, label: 'Спящие волчата', hint: 'проснутся рядом с тобой и встанут цепочкой за волком; с факелом цепочку съедают целиком' },
    pupNight: { value: 2, min: 1, max: 5, step: 1, label: 'Волчата появляются с ночи' },
    close: { value: 1, min: 0, max: 1, step: 1, label: 'На волосок: замедление, когда волк в шаге', hint: 'мир замирает на миг — успеешь свернуть' },
    // вариации жанра (меню Tab, урок 3 «Мастерская вариаций»): каждая поворачивает одну деталь механики
    jump: { value: 0, min: 0, max: 1, step: 1, label: 'Прыжок: A — перепрыгнуть волка', hint: 'как в Pac-Mania (1987): в прыжке волк не поймает, перезарядка 2 с' },
    doors: { value: 0, min: 0, max: 1, step: 1, label: 'Двери: B — закрыть проход за спиной', hint: 'как вертушки в Lady Bug (1981): каменная плита держит волков' },
    doorTime: { value: 4, min: 1, max: 10, step: 0.5, label: 'Дверь держится, с' },
    dark: { value: 0, min: 0, max: 1, step: 1, label: 'Тьма: виден только свет фонаря и факелов', hint: 'волков выдают только глаза', restart: true },
    freeze: { value: 0, min: 0, max: 1, step: 1, label: 'Мороз: факел замораживает волков', hint: 'как бонус Freeze в Pac-Man 256: мимо замёрзших можно пройти, но прогнать их нельзя' },
    bump: { value: 0, min: 0, max: 1, step: 1, label: 'Толчок: волк сначала только толкает', hint: 'как в Pac-Man Championship Edition 2: три толчка — и волк злится, злой ловит' },
    timeAttack: { value: 0, min: 0, max: 300, step: 15, label: 'На время: секунд на рекорд (0 — без времени)', hint: 'как в Pac-Man Championship Edition: ночи идут одна за другой, пока не кончится время', restart: true },
    showTargets: { value: 0, min: 0, max: 1, step: 1, label: 'Показать, куда целится каждый волк', hint: 'Крестик цвета волка на клетке, к которой он идёт' },
    vs: { value: 0, min: 0, max: 1, step: 1, label: 'Второй игрок ведёт Вожака', hint: '1 — пастушок на WASD или геймпаде 1, Вожак на стрелках или геймпаде 2', restart: true },
    lives: { value: 3, min: 1, max: 9, step: 1, label: 'Жизни', restart: true },
  },
  presets: {
    'Новичок': { wolfSpeed: 4, powerTime: 10, warnTime: 3, wolves: 3, lives: 5, elroy: 0 },
    'Без спрятанной механики': { secret: 0 },
    'Цели видно': { showTargets: 1 },
    'Стая волчат': { pups: 10, pupNight: 1 },
    'Прыжок': { jump: 1 },
    'Двери': { doors: 1 },
    'Тьма': { dark: 1 },
    'Мороз': { freeze: 1 },
    'Толчок': { bump: 1 },
    'На время': { timeAttack: 120, lives: 9 },
    'Безумие': { wolfSpeed: 6.4, heroSpeed: 6.4, powerTime: 3, release: 1, scatterTime: 2, pups: 12, pupNight: 1 },
    'Вдвоём': { vs: 1 },
  },
  // имя и правило вариации для начала партии: первая, чьи ручки совпали с текущими
  VARIANTS: [
    { name: 'На время', like: 'Pac-Man Championship Edition', how: 'собери как можно больше, пока не кончится время', on: c => c.timeAttack > 0 },
    { name: 'Прыжок', like: 'Pac-Mania', how: 'A — прыжок: в воздухе волк не поймает', on: c => Math.round(c.jump) === 1 },
    { name: 'Двери', like: 'Lady Bug', how: 'B — каменная плита закрывает проход за спиной', on: c => Math.round(c.doors) === 1 },
    { name: 'Тьма', like: 'лабиринты-страшилки', how: 'видно только то, что в свете; волков выдают глаза', on: c => Math.round(c.dark) === 1 },
    { name: 'Мороз', like: 'Pac-Man 256', how: 'факел замораживает волков: проскочи мимо', on: c => Math.round(c.freeze) === 1 },
    { name: 'Толчок', like: 'Pac-Man Championship Edition 2', how: 'волк сначала толкает, на третий раз злится', on: c => Math.round(c.bump) === 1 },
    { name: 'Стая волчат', like: 'Pac-Man Championship Edition DX', how: 'спящие волчата встают цепочкой, с факелом её съедают', on: c => c.pups >= 10 && c.pupNight <= 1 },
  ],
  notes: [
    'Срезка угла только у пастушка: волки поворачивают в центре клетки, поэтому на поворотах пастушок отрывается.',
    'Волчата не сидят ближе 6 клеток к пастушку и к дольмену: просыпаются только там, куда ты сам пришёл.',
  ],

  S: 1.25, // шаг клетки, м
  JUMP: 0.65, // прыжок вариации «Прыжок», с
  // # — стена, . — светлячок, o — факел, P — пастушок, D — дольмен, - — дверь дольмена, x — лес за лабиринтом. Строка 9 — тоннель
  MAP: [
    '###################',
    '#o.......#.......o#',
    '#.##.###.#.###.##.#',
    '#.................#',
    '#.##.#.#####.#.##.#',
    '#....#...#...#....#',
    '####.### # ###.####',
    'xxx#.#       #.#xxx',
    '####.# ##-## #.####',
    '    .  #DDD#  .    ',
    '####.# ##### #.####',
    'xxx#.#       #.#xxx',
    '####.# ##### #.####',
    '#........#........#',
    '#.##.###.#.###.##.#',
    '#o.#.....P.....#.o#',
    '##.#.#.#####.#.#.##',
    '#....#...#...#....#',
    '#.######.#.######.#',
    '#.................#',
    '###################',
  ],
  DIRS: [[0, -1], [-1, 0], [0, 1], [1, 0]], // вверх, влево, вниз, вправо: порядок решает ничьи, как в оригинале
  // волки: цвет = характер. corner — угол разбега (за краем поля), slot — место в дольмене
  WOLVES: [
    { name: 'Вожак', rule: 'гонится', color: '#d8433a', eye: '#ff5a4a', corner: [17, -3], slot: [9, 9] },
    { name: 'Хитрец', rule: 'заходит наперерез', color: '#e58ccd', eye: '#ff8ae6', corner: [1, -3], slot: [9, 9] },
    { name: 'Ловчий', rule: 'срезает по напарнику', color: '#4fc6d8', eye: '#5ff0ff', corner: [18, 22], slot: [8, 9] },
    { name: 'Трус', rule: 'пугается вблизи', color: '#ee9b32', eye: '#ffb84a', corner: [0, 22], slot: [10, 9] },
  ],
  EXIT: [9, 7], // клетка над дверью дольмена
  DEN: [7, 8, 11, 10], // дольмен на карте: x от 7 до 11, строки 8–10 — вместо стен там каменные плиты

  // ---------- новая партия ----------
  start(lab, scene) {
    const st = lab.state;
    st.W = this.MAP[0].length; st.H = this.MAP.length;
    Object.assign(st, {
      night: 1, combo: 0, bestCombo: 0, eaten: 0, chased: 0, pincers: 0, tails: 0, ambush: 0, closeCalls: 0, pupsEaten: 0, cheeses: 0,
      checkT: 0, pinCool: 0, tailT: 0, tailCool: 0, closeCool: 2, freeze: 0, dying: 0, clearT: 0, cheese: null, streak: 0, streakT: 0, eatT: 0, angry: false,
      mult: 1, banner: false, jumpT: 0, jumpCool: 0, jumps: 0, jumpOver: 0, overThis: false, door: null, doorCool: 0, doorsUsed: 0, doorSaves: 0,
      ice: false, icePass: 0, darkMeets: 0, bumps: 0, mads: 0, timeLeft: lab.cfg.timeAttack > 0 ? lab.cfg.timeAttack : null, tickAt: 10, starT: 3,
    });
    st.dark = Math.round(lab.cfg.dark) === 1;
    this.scenery(lab, scene);
    this.buildMaze(lab);
    this.buildHero(lab);
    this.buildWolves(lab);
    this.buildPups(lab);
    this.fillDots(lab);
    this.resetActors(lab);
    lab.hero(st.hero.g);
    lab.hud('night', 'Ночь 1', { color: '#d8ff6a' });
    st.camT = lab.view.target.clone();
    if (!lab.playing) this.poster(lab);
  },

  // ---------- каждый кадр ----------
  update(lab, dt) {
    const st = lab.state, cfg = lab.cfg;
    if (st.poster) this.unposter(lab);
    if (!st.banner) { st.banner = true; this.banner(lab); }
    this.animate(lab, dt);
    this.updateCamera(lab, dt);
    if (st.timeLeft != null && this.clock(lab, dt)) return;
    this.updateDoor(lab, dt);
    if (st.clearT > 0) { this.clearing(lab, dt); return; }
    if (st.dying > 0) { this.dyingStep(lab, dt); return; }
    if (st.freeze > 0) { st.freeze -= dt; return; }
    this.modes(lab, dt);
    this.moveHero(lab, dt);
    this.releaseWolves(lab, dt);
    st.wolves.forEach(w => this.moveWolf(lab, w, dt));
    this.movePups(lab, dt);
    this.collide(lab);
    this.watchDynamics(lab, dt);
    this.updateCheese(lab, dt);
    this.hudLines(lab);
  },
  // HUD в цветах игры: светлячки — лаймом, погоня — красным, разбег — зелёным, факел — синим, мороз — льдом
  hudLines(lab) {
    const st = lab.state, cfg = lab.cfg;
    lab.hud('left', 'Светлячков: ' + st.dotsLeft, { color: '#d8ff6a' });
    const fr = st.fright > 0, sc = Math.round(cfg.secret) && st.mode === 'scatter';
    lab.hud('mode', fr ? (st.ice ? `Волки замёрзли: ${Math.ceil(st.fright)} с` : `Волки бегут от факела: ${Math.ceil(st.fright)} с`) : Math.round(cfg.secret) ? (sc ? 'Волки: разбег по углам' : 'Волки: погоня') : 'Волки: погоня без отдыха',
      { color: fr ? (st.ice ? '#bfefff' : '#9fb4ff') : sc ? '#7cf5a8' : '#ff7a6a' });
    lab.hud('streak', st.mult > 1 ? `Хруст подряд ×${st.mult}` : null, { color: '#ffd23f', size: 16 });
    const extra = [];
    if (Math.round(cfg.jump)) extra.push(st.jumpCool > 0 ? 'Прыжок: заряжается' : 'Прыжок готов · A или пробел');
    if (Math.round(cfg.doors)) extra.push(st.door ? `Дверь держит: ${Math.ceil(st.door.t)} с` : st.doorCool > 0 ? 'Дверь: камень ещё не готов' : 'Дверь готова · B или Shift');
    lab.hud('tool', extra.length ? extra.join(' · ') : null, { color: '#ffb36b', size: 14 });
    lab.hud('time', st.timeLeft != null ? `Время: ${Math.ceil(Math.max(0, st.timeLeft))} с` : null, { color: st.timeLeft != null && st.timeLeft < 10 ? '#ff5a4a' : '#ffffff', size: st.timeLeft != null && st.timeLeft < 10 ? 22 : 16 });
  },
  // какая вариация сейчас: по ручкам, иначе — классика
  variant(lab) {
    const hit = this.VARIANTS.find(v => v.on(lab.cfg));
    return hit || { name: 'Классика', like: 'Pac-Man', how: 'собери всех светлячков, факел меняет охотника и добычу' };
  },
  // начало партии: имя вариации и её правило крупно над лабиринтом
  banner(lab) {
    const v = this.variant(lab);
    lab.popup(lab.v3(0, 3.6, 0), v.name === 'Классика' ? 'Ночь 1' : v.name, '#ffffff', 30);
    lab.after(0.35, () => lab.popup(lab.v3(0, 2.8, 0), v.how, '#ffe680', 17));
  },
  // На время (Pac-Man CE): часы идут всегда; последние 10 с тикают и краснеют
  clock(lab, dt) {
    const st = lab.state;
    st.timeLeft -= dt;
    if (st.timeLeft <= st.tickAt && st.tickAt > 0) { lab.tone(st.tickAt <= 3 ? 1100 : 880, 0.06, 'square', 0.05); st.tickAt--; }
    if (st.timeLeft > 0) return false;
    lab.hud('time', 'Время вышло!', { color: '#ff5a4a', size: 22 });
    lab.win(`Время вышло: ${lab.score} очков за ${Math.round(lab.cfg.timeAttack)} с, ночей пройдено: ${st.night - 1}`);
    return true;
  },

  overNote(lab) {
    const st = lab.state, notes = [];
    const v = this.variant(lab), cfg = lab.cfg;
    if (v.name !== 'Классика') notes.push(`Вариация: ${v.name} (как в ${v.like}) — ${v.how}`);
    notes.push(Math.round(lab.cfg.secret) ? 'Механика: у четырёх волков по одному правилу — гонится, наперерез, по напарнику, пугается вблизи' : 'Спрятанная механика выключена: все волки гнались одинаково. Заметил, что они ходят хвостом?');
    notes.push(`Динамика: тебя окружали с разных сторон ${st.pincers} раз, волки шли за тобой хвостом ${st.tails} раз`);
    notes.push(`Ты подманил волков к факелу ${st.ambush} раз и прогнал ${st.chased} волков, лучшая серия ×${st.bestCombo}`);
    notes.push(`Светлячков: ${st.eaten}, ночь ${st.night}` + (st.pupsEaten ? `, волчат прогнано: ${st.pupsEaten}` : '') + (st.closeCalls ? `, на волосок: ${st.closeCalls}` : ''));
    if (Math.round(cfg.jump)) notes.push(`Прыжков: ${st.jumps}, из них над волком: ${st.jumpOver}`);
    if (Math.round(cfg.doors)) notes.push(`Дверей закрыто: ${st.doorsUsed}, дверь остановила волка: ${st.doorSaves} раз`);
    if (Math.round(cfg.dark)) notes.push(`Волки выскакивали из темноты: ${st.darkMeets} раз`);
    if (Math.round(cfg.freeze)) notes.push(`Ты проскочил мимо замёрзших волков ${st.icePass} раз — прогнать их мороз не даёт`);
    if (Math.round(cfg.bump)) notes.push(`Толчков: ${st.bumps}, волков разозлил: ${st.mads}`);
    return notes;
  },

  // ---------- клетки ----------
  wrap(lab, x) { const W = lab.state.W; return ((x % W) + W) % W; },
  cell(lab, x, y) { return y < 0 || y >= lab.state.H ? '#' : this.MAP[y][this.wrap(lab, x)]; },
  open(lab, x, y) {
    const c = this.cell(lab, x, y), d = lab.state.door;
    if (d && d.y === y && d.x === this.wrap(lab, x)) return false; // каменная дверь вариации «Двери»
    return c !== '#' && c !== 'D' && c !== '-' && c !== 'x';
  },
  wx(x) { return (x - (this.MAP[0].length - 1) / 2) * this.S; },
  wz(y) { return (y - (this.MAP.length - 1) / 2) * this.S; },
  posOf(a) { return [a.tx + a.dx * a.t, a.ty + a.dy * a.t]; },
  inTunnel(lab, a) { return a.ty === 9 && (a.tx <= 3 || a.tx >= lab.state.W - 4); },
  // меш догоняет клетку плавно (срезка угла не дёргается), через тоннель — сразу
  place(lab, a, y, rate) {
    const [x, z] = this.posOf(a), px = this.wx(x), pz = this.wz(z), m = a.mesh.position;
    if (!rate || Math.abs(m.x - px) > 3) m.set(px, y, pz);
    else m.set(lab.damp(m.x, px, rate, lab.dt), y, lab.damp(m.z, pz, rate, lab.dt));
    if (a.dx || a.dy) this.face(lab, a.mesh, Math.atan2(a.dx, a.dy), 14);
  },
  face(lab, obj, want, rate) { let d = want - obj.rotation.y; d = Math.atan2(Math.sin(d), Math.cos(d)); obj.rotation.y += d * Math.min(1, lab.dt * rate); },
  // движение по клеткам: t — путь от центра клетки (tx, ty) к соседней по направлению (dx, dy); в центре клетки решает decide
  move(lab, a, dist, decide) {
    for (let g = 0; g < 6 && dist > 0; g++) {
      if (!a.dx && !a.dy) { decide(a); if (!a.dx && !a.dy) return; }
      const left = 1 - a.t;
      if (dist < left) { a.t += dist; return; }
      dist -= left; a.tx = this.wrap(lab, a.tx + a.dx); a.ty += a.dy; a.t = 0;
      decide(a);
    }
  },
  reverse(lab, a) { if (a.t > 0) { a.tx = this.wrap(lab, a.tx + a.dx); a.ty += a.dy; a.t = 1 - a.t; } a.dx = -a.dx; a.dy = -a.dy; },
  near(lab, a, b) { const [ax, ay] = this.posOf(a), [bx, by] = this.posOf(b); let dx = Math.abs(ax - bx); dx = Math.min(dx, lab.state.W - dx); return Math.hypot(dx, ay - by); },
  stickDir(p) { return Math.abs(p.x) > 0.3 || Math.abs(p.y) > 0.3 ? (Math.abs(p.x) > Math.abs(p.y) ? [Math.sign(p.x), 0] : [0, -Math.sign(p.y)]) : null; },

  // ---------- пастушок: поворот заранее, срезка угла, разворот на месте ----------
  moveHero(lab, dt) {
    const st = lab.state, h = st.hero, cfg = lab.cfg;
    const d = this.stickDir(lab.p1); if (d) st.want = d;
    const w = st.want;
    if (Math.round(cfg.jump) && lab.p1.pressed.a && st.jumpCool <= 0 && st.jumpT <= 0) this.jump(lab);
    if (Math.round(cfg.doors) && lab.p1.pressed.b && st.doorCool <= 0 && (h.dx || h.dy)) this.closeDoor(lab);
    st.jumpT -= dt; st.jumpCool -= dt; st.doorCool -= dt;
    const doorBack = st.door && h.t > 0 && st.door.x === h.tx && st.door.y === h.ty; // назад в свою же дверь не развернуться
    if (w && w[0] === -h.dx && w[1] === -h.dy && (h.dx || h.dy) && !doorBack) this.reverse(lab, h);
    // срезка угла, как у Pac-Man: поворот засчитывается чуть до центра клетки или чуть после — пастушок идёт по диагонали
    else if (w && (h.dx || h.dy) && (w[0] !== h.dx || w[1] !== h.dy) && cfg.corner > 0) {
      if (h.t <= cfg.corner && this.open(lab, h.tx + w[0], h.ty + w[1])) { h.dx = w[0]; h.dy = w[1]; }
      else if (h.t >= 1 - cfg.corner && this.open(lab, h.tx + h.dx, h.ty + h.dy)) {
        const nx = this.wrap(lab, h.tx + h.dx), ny = h.ty + h.dy;
        if (this.open(lab, nx + w[0], ny + w[1])) { h.t = 1 - h.t; h.tx = nx; h.ty = ny; h.dx = w[0]; h.dy = w[1]; this.eat(lab, nx, ny); }
      }
    }
    st.eatT -= dt;
    const mul = (1 + cfg.nightUp * (st.night - 1) * 0.5) * (st.fright > 0 ? 1.1 : 1) * (st.eatT > 0 ? 1 - cfg.eatSlow : 1);
    this.move(lab, h, cfg.heroSpeed * mul * dt, a => {
      if (w && this.open(lab, a.tx + w[0], a.ty + w[1])) { a.dx = w[0]; a.dy = w[1]; }
      else if (!this.open(lab, a.tx + a.dx, a.ty + a.dy)) { a.dx = 0; a.dy = 0; }
      if (a.t === 0) this.eat(lab, a.tx, a.ty);
    });
    this.place(lab, h, 0, 30);
    const run = !!(h.dx || h.dy);
    h.body.position.y = st.jumpT > 0 ? Math.sin(Math.PI * (1 - st.jumpT / this.JUMP)) * 1.5 : run ? Math.abs(Math.sin(lab.t * 15)) * 0.09 : 0;
    const sw = run ? Math.sin(lab.t * 15) * 0.7 : 0;
    h.legA.rotation.x = sw; h.legB.rotation.x = -sw; h.arm.rotation.x = -sw * 0.4;
    if ((st.streakT -= dt) <= 0) { st.streak = 0; st.mult = 1; }
    lab.stat('светлячков собрано', st.eaten);
  },
  eat(lab, x, y) {
    const st = lab.state, key = x + ',' + y, d = st.dots[key];
    if (!d) return;
    delete st.dots[key]; st.dotsLeft--;
    const at = [this.wx(x), 0.55, this.wz(y)];
    if (d.torch) {
      const t = st.torches[d.torch - 1];
      t.flame.visible = false; t.light.visible = false; t.lit = false;
      lab.addScore(50, at, '#ffb347'); lab.sfx.power(); lab.flash('#ff9a3c', 0.3); lab.count('факелы');
      lab.burst([at[0], 1.3, at[2]], { count: 34, colors: ['#ffd23f', '#ff7a2a', '#fff3a0'], speed: 7, up: 5 });
      lab.ring(at, { color: '#ff9a3c', radius: 3.4 }); lab.shake(0.3); lab.pulse(st.hero.body, 1.4, 0.2); lab.vibrate(120, 0.5);
      if (st.wolves.some(wf => wf.state === 'active' && this.near(lab, wf, st.hero) < 4.5)) { st.ambush++; lab.count('засада у факела'); lab.popup([at[0], 2.4, at[2]], 'Засада!', '#ffd23f', 22); }
      st.fright = lab.cfg.powerTime * Math.pow(0.88, st.night - 1); st.combo = 0;
      st.ice = Math.round(lab.cfg.freeze) === 1; // Мороз (Pac-Man 256): волки замирают на месте, а не убегают
      st.wolves.forEach(wf => { if (wf.state === 'active') { wf.fr = true; wf.passed = false; if (!st.ice) this.reverse(lab, wf); } });
      st.pups.forEach(p => { if (p.state === 'train') p.fr = true; });
      if (st.ice) { lab.popup([at[0], 3, at[2]], 'Мороз!', '#bfefff', 26); lab.burst([at[0], 1.3, at[2]], { count: 30, colors: ['#e8fbff', '#9fe6ff'], speed: 6, up: 4 }); lab.tone(1500, 0.5, 'sine', 0.05, 600); }
      if (st.heroTrail) st.heroTrail.dispose();
      st.heroTrail = lab.trail(st.hero.lantern, { color: st.ice ? '#9fe6ff' : '#ff8a3c', width: 0.45, length: 16 });
    } else {
      st.eaten++; st.eatT = 0.12; lab.count('светлячки');
      st.streak++; st.streakT = 0.45; // хруст подряд звенит выше, как серия точек в CE DX
      const mult = 1 + Math.min(2, Math.floor(st.streak / 30)); // 30 подряд — ×2, 60 — ×3
      lab.addScore(10 * mult);
      if (mult > st.mult) { lab.popup([at[0], 2, at[2]], `Хруст подряд ×${mult}!`, '#ffd23f', 20 + mult * 2); lab.ring([at[0], 0, at[2]], { color: '#ffd23f', radius: 2.4 }); lab.tone(990, 0.2, 'triangle', 0.06, 1480); }
      st.mult = mult;
      lab.tone((st.eaten % 2 ? 560 : 440) * lab.pitch(Math.min(12, Math.floor(st.streak / 8))), 0.06, 'triangle', 0.05);
      d.gone = true; this.hideDot(st, d);
      lab.burst(at, { count: 5, colors: ['#e9ff8a', '#b6ff4a'], speed: 2.4, up: 1.8, size: 0.08, life: 0.4 });
      if (st.streak % 30 === 0) lab.ring([at[0], 0, at[2]], { color: '#d8ff6a', radius: 1.6 });
      if ((st.eaten % 150 === 60 || st.eaten % 150 === 120) && !st.cheese) this.spawnCheese(lab);
    }
    if (st.dotsLeft <= Math.round(lab.cfg.elroy) && !st.angry && lab.cfg.elroy > 0 && st.wolves[0]) this.angry(lab);
    if (st.dotsLeft === 0) this.nextNight(lab);
  },
  // Вожак злится (Cruise Elroy в Pac-Man): быстрее и без разбега — последних светлячков собирать страшно
  angry(lab) {
    const st = lab.state, w = st.wolves[0];
    st.angry = true; lab.count('вожак злится');
    lab.popup(lab.v3(w.mesh.position.x, 2.6, w.mesh.position.z), 'Вожак злится!', '#ff5a4a', 22);
    lab.tone(140, 0.6, 'sawtooth', 0.06, 90); lab.shake(0.2);
    w.rage = lab.trail(w.head, { color: '#ff3b2e', width: 0.35, length: 10 });
  },
  nextNight(lab) {
    const st = lab.state;
    st.night++; lab.addScore(500, st.hero.mesh.position, '#7cf5a8');
    lab.sfx.win(); lab.count('ночи');
    st.clearT = 1.6; // лабиринт мигает, как в оригинале, потом новая ночь
    lab.popup(lab.v3(0, 3, 0), 'Ночь ' + st.night, '#d8ff6a', 34);
    lab.hud('night', 'Ночь ' + st.night);
  },
  clearing(lab, dt) {
    const st = lab.state;
    st.clearT -= dt;
    const on = Math.floor(st.clearT * 7) % 2 === 0;
    st.wallMat.emissive.set(on ? '#8fa0ff' : '#000000'); st.wallMat.emissiveIntensity = on ? 0.6 : 0;
    if (st.clearT > 0) return;
    st.wallMat.emissive.set('#000000');
    this.fillDots(lab); this.resetActors(lab);
    st.freeze = 0.6;
  },

  // ---------- режимы: разбег и погоня сменяют друг друга; факел их останавливает ----------
  modes(lab, dt) {
    const st = lab.state, cfg = lab.cfg;
    if (st.fright > 0) {
      st.fright -= dt;
      const warn = st.fright < cfg.warnTime && Math.floor(st.fright * 6) % 2 === 0; // честно: факел гаснет — волки мигают белым
      st.frMat.color.set(warn ? '#f2f4ff' : st.ice ? '#bfefff' : '#3d5bff'); st.frMat.emissive.set(warn ? '#9aa6ff' : st.ice ? '#3a9cc0' : '#1a2a99'); st.frWarn = warn;
      if (st.fright <= 0) {
        st.ice = false;
        st.wolves.forEach(w => { w.fr = false; w.passed = false; });
        st.pups.forEach((p, i) => { p.fr = false; if (p.state === 'train' && p.lead.state !== 'active') this.sleepPup(lab, p, i, false); });
        if (st.heroTrail) { st.heroTrail.dispose(); st.heroTrail = null; }
      }
      return;
    }
    if (!Math.round(cfg.secret)) { st.mode = 'chase'; return; }
    st.modeT -= dt;
    if (st.modeT > 0) return;
    const plan = [cfg.scatterTime, cfg.chaseTime, cfg.scatterTime, cfg.chaseTime, cfg.scatterTime * 0.7, 1e9];
    st.phase = Math.min(st.phase + 1, plan.length - 1);
    st.mode = st.phase % 2 ? 'chase' : 'scatter'; st.modeT = plan[st.phase];
    if (st.mode === 'scatter') lab.count('разбеги');
    st.wolves.forEach(w => { if (w.state === 'active' && !w.human) this.reverse(lab, w); }); // смена режима видна: все волки разворачиваются
    // слышно: на погоню — вой вверх, на разбег — вниз
    lab.tone(st.mode === 'chase' ? 300 : 620, 0.7, 'sine', 0.06, st.mode === 'chase' ? 520 : 330);
    lab.tone(st.mode === 'chase' ? 450 : 930, 0.5, 'triangle', 0.025, st.mode === 'chase' ? 780 : 500, 0.1);
  },

  // ---------- волки ----------
  target(lab, w) {
    const st = lab.state, cfg = lab.cfg, h = st.hero, hd = [h.dx || (st.want || [0, 0])[0], h.dy || (st.want || [0, 0])[1]];
    if (w.state === 'eyes') return this.EXIT;
    if (!Math.round(cfg.secret)) return [h.tx, h.ty];
    if (st.mode === 'scatter' && !(w.i === 0 && st.angry)) return w.def.corner;
    if (w.i === 1) return [h.tx + hd[0] * cfg.ahead, h.ty + hd[1] * cfg.ahead];
    if (w.i === 2) {
      const red = st.wolves[0];
      if (!red || red.state !== 'active') return [h.tx, h.ty];
      const px = h.tx + hd[0] * 2, py = h.ty + hd[1] * 2;
      return [px * 2 - red.tx, py * 2 - red.ty];
    }
    if (w.i === 3 && this.near(lab, w, h) < cfg.shyRadius) return w.def.corner;
    return [h.tx, h.ty];
  },
  choose(lab, w, tgt) {
    const back = [-w.dx, -w.dy];
    let opts = this.DIRS.filter(d => this.open(lab, w.tx + d[0], w.ty + d[1]) && !(d[0] === back[0] && d[1] === back[1]));
    if (!opts.length) opts = [back];
    if (w.fr && w.state === 'active') return lab.pick(opts);
    let best = opts[0], bd = 1e9;
    for (const d of opts) {
      const dist = (w.tx + d[0] - tgt[0]) ** 2 + (w.ty + d[1] - tgt[1]) ** 2;
      if (dist < bd) { bd = dist; best = d; }
    }
    return best;
  },
  moveWolf(lab, w, dt) {
    const st = lab.state, cfg = lab.cfg;
    if (st.dark) this.darkWolf(lab, w);
    if (w.state === 'home') { w.mesh.position.y = Math.abs(Math.sin(lab.t * 4 + w.i)) * 0.25; this.skin(lab, w); this.trot(lab, w, 0.4); return; }
    if (w.state === 'exit' || w.state === 'enter') {
      w.k = Math.min(1, w.k + dt * 1.6);
      const [ax, ay] = w.state === 'exit' ? w.def.slot : this.EXIT, [bx, by] = w.state === 'exit' ? this.EXIT : w.def.slot;
      w.mesh.position.set(this.wx(lab.lerp(ax, bx, w.k)), 0, this.wz(lab.lerp(ay, by, w.k)));
      this.face(lab, w.mesh, Math.atan2(bx - ax, by - ay), 10);
      if (w.k >= 1) {
        if (w.state === 'exit') { w.state = 'active'; w.tx = this.EXIT[0]; w.ty = this.EXIT[1]; w.t = 0; w.dx = -1; w.dy = 0; }
        else { w.state = 'home'; w.homeT = 1.5; w.fr = false; if (w.eyeTrail) { w.eyeTrail.dispose(); w.eyeTrail = null; } }
      }
      this.skin(lab, w); this.trot(lab, w, 1); return;
    }
    const mul = 1 + cfg.nightUp * (st.night - 1);
    w.bumpCool = (w.bumpCool || 0) - dt;
    let speed = w.state === 'eyes' ? cfg.wolfSpeed * 2.2 : w.fr ? (st.ice ? 0 : cfg.frightSpeed) : cfg.wolfSpeed * mul * (w.mad ? 1.1 : 1);
    if (w.state === 'active' && this.inTunnel(lab, w)) speed *= cfg.tunnelSlow;
    if (w.i === 0 && st.angry && w.state === 'active' && !w.fr) speed *= st.dotsLeft <= cfg.elroy / 2 ? 1.2 : 1.1;
    const p2 = lab.p2;
    if (w.human && w.state === 'active') { // второй игрок ведёт Вожака
      const d = this.stickDir(p2); if (d) w.want = d;
      if (w.want && w.want[0] === -w.dx && w.want[1] === -w.dy) this.reverse(lab, w);
    }
    this.move(lab, w, speed * dt, a => {
      if (a.state === 'enter') { a.dx = 0; a.dy = 0; return; }
      if (a.state === 'eyes' && a.tx === this.EXIT[0] && a.ty === this.EXIT[1]) { a.state = 'enter'; a.k = 0; a.dx = 0; a.dy = 0; return; }
      if (a.human && a.state === 'active' && a.want && this.open(lab, a.tx + a.want[0], a.ty + a.want[1])) { a.dx = a.want[0]; a.dy = a.want[1]; return; }
      if (a.human && a.state === 'active' && this.open(lab, a.tx + a.dx, a.ty + a.dy)) return;
      const tgt = this.target(lab, a), d = this.choose(lab, a, tgt);
      // спрятанная механика сработала: характер повёл волка не туда, куда ведёт простая погоня (скрытый счётчик для урока)
      if (Math.round(cfg.secret) && a.state === 'active' && !a.fr && !a.human) {
        const plain = this.choose(lab, a, [st.hero.tx, st.hero.ty]);
        if (plain[0] !== d[0] || plain[1] !== d[1]) lab.count('_secret');
      }
      a.dx = d[0]; a.dy = d[1];
    });
    if (w.state === 'enter') return;
    this.place(lab, w, 0, 0);
    this.skin(lab, w); this.trot(lab, w, w.state === 'eyes' ? 0 : speed / 4.8);
    // след для цепочки волчат: где волк шёл, по метру за точку
    const P = w.mesh.position, c = w.crumbs, last = c[c.length - 1];
    if (!last || Math.abs(last.x - P.x) > 3 || Math.abs(last.z - P.z) > 3) { c.length = 0; c.push({ x: P.x, z: P.z }); }
    else if (Math.hypot(last.x - P.x, last.z - P.z) > 0.12) { c.push({ x: P.x, z: P.z }); if (c.length > 220) c.shift(); }
    const tg = st.marks[w.i];
    if (tg) {
      const on = !!Math.round(cfg.showTargets) && w.state === 'active' && !w.fr;
      tg.visible = on;
      if (on) { const t = this.target(lab, w); tg.position.set(this.wx(t[0]), 0.08, this.wz(t[1])); tg.rotation.y = lab.t * 2; }
    }
  },
  // бег рысью: лапы крест-накрест, хвост виляет
  trot(lab, w, k) {
    const s = Math.sin(lab.t * 14 + w.i) * 0.8 * Math.min(1.4, k);
    w.legA.rotation.x = s; w.legB.rotation.x = -s;
    w.tail.rotation.y = Math.sin(lab.t * (w.fr ? 22 : 9) + w.i) * 0.5;
    w.body.position.y = Math.abs(Math.sin(lab.t * 14 + w.i)) * 0.06 * k;
  },
  // какой вид у волка: свой цвет, синий «бегу от факела» или одни глаза по дороге в дольмен
  skin(lab, w) {
    const eyes = w.state === 'eyes' || w.state === 'enter', look = eyes ? 'eyes' : w.fr ? 'scared' : 'own';
    if (w.look === look) return;
    w.look = look;
    w.body.visible = !eyes; w.ghost.visible = eyes;
    for (const m of w.fur) m.material = w.fr ? lab.state.frMat : w.furMat;
    w.glowEyes.material = w.fr ? lab.state.frEye : w.eyeMat;
  },
  releaseWolves(lab, dt) {
    const st = lab.state;
    st.wolves.forEach(w => {
      if (w.state !== 'home') return;
      w.homeT -= dt;
      if (w.homeT <= 0) { w.state = 'exit'; w.k = 0; lab.tone(330, 0.25, 'sine', 0.05, 220); lab.ring([this.wx(9), 0, this.wz(8)], { color: w.def.eye, radius: 1.4 }); }
    });
    // честно: дверь дольмена светится цветом волка, который выйдет следующим
    const next = st.wolves.filter(w => w.state === 'home').sort((a, b) => a.homeT - b.homeT)[0];
    const glow = next && next.homeT < 1.2 && Math.floor(lab.t * 8) % 2 === 0;
    st.doorMat.emissive.set(glow ? next.def.eye : '#000000'); st.doorMat.emissiveIntensity = glow ? 1.8 : 0;
  },
  collide(lab) {
    const st = lab.state, h = st.hero;
    const air = st.jumpT > 0;
    for (const w of st.wolves) {
      if (w.state !== 'active') continue;
      const d = this.near(lab, w, h);
      if (air && d < 1 && !st.overThis && !w.fr) { st.overThis = true; st.jumpOver++; lab.count('прыжки над волком'); lab.popup(lab.v3(h.mesh.position.x, 3, h.mesh.position.z), 'Перепрыгнул!', '#ffe680', 22); lab.tone(1046, 0.12, 'triangle', 0.05, 1568); }
      if (d > 0.62) continue;
      if (air && !w.fr) continue; // в прыжке волк не поймает
      if (w.fr && st.ice) { if (!w.passed) { w.passed = true; st.icePass++; lab.count('мимо замёрзших'); lab.popup(lab.v3(w.mesh.position.x, 2.4, w.mesh.position.z), 'Мимо!', '#bfefff', 18); } continue; }
      if (!w.fr && Math.round(lab.cfg.bump) && !w.mad) { if (w.bumpCool <= 0) this.bumped(lab, w); continue; }
      if (w.fr) { this.chaseAway(lab, w.mesh.position, w.def.color, false); w.state = 'eyes'; w.fr = false; w.eyeTrail = lab.trail(w.ghost, { color: '#9fb4ff', width: 0.25, length: 8 }); }
      else { this.caught(lab); return; }
    }
    const hp = h.mesh.position;
    for (const p of st.pups) {
      if (p.state !== 'train' || Math.hypot(p.x - hp.x, p.z - hp.z) > 0.72 * this.S || air || (p.fr && st.ice)) continue;
      if (p.fr) { this.chaseAway(lab, [p.x, 0.4, p.z], '#8a8fa8', true); p.state = 'gone'; this.hidePup(lab, st.pups.indexOf(p)); st.pupsEaten++; lab.count('волчата прогнаны'); }
      else { this.caught(lab); return; }
    }
  },
  // прогнал: очки растут 200 → 400 → 800 → 1600 (с цепочкой волчат — дальше), стоп-кадр, звон выше с каждым
  chaseAway(lab, at, color, pup) {
    const st = lab.state;
    st.combo++; st.bestCombo = Math.max(st.bestCombo, st.combo);
    if (!pup) { st.chased++; lab.count('прогнал волков'); }
    const pts = Math.min(3200, 200 * Math.pow(2, st.combo - 1)), p = lab.v3(at.x != null ? at.x : at[0], 1.2, at.z != null ? at.z : at[2]);
    lab.addScore(pts, p, st.combo >= 4 ? '#ffffff' : '#9fd0ff');
    if (st.combo >= 3) lab.popup(lab.v3(p.x, 2.4, p.z), `Серия ×${st.combo}`, '#ffd23f', 18 + Math.min(12, st.combo * 2));
    lab.hitstop(0.07 + Math.min(0.08, st.combo * 0.015)); lab.shake(0.22 + Math.min(0.3, st.combo * 0.05)); lab.vibrate(80, 0.5);
    lab.burst(p, { count: 24, colors: [color, '#ffffff', '#3d5bff'], speed: 7, up: 3 });
    lab.ring([p.x, 0, p.z], { color: '#9fb4ff', radius: 2 });
    lab.tone(300 * lab.pitch(st.combo * 2), 0.25, 'square', 0.05, 1200 * lab.pitch(st.combo * 2)); lab.sfx.whoosh();
  },
  caught(lab) {
    const st = lab.state, h = st.hero;
    if (!lab.hurt(h.mesh.position, 'Волки поймали пастушка')) return;
    lab.count('поймали'); st.combo = 0;
    if (lab.lives <= 0) return;
    st.dying = 1.3; // пастушок кружится и гаснет фонарь, потом новая попытка
    lab.tween(1.2, k => { h.body.rotation.y = k * Math.PI * 4; h.body.scale.setScalar(1 - k * 0.7); h.light.intensity = h.baseLight * (1 - k); }, 'inCubic');
  },
  dyingStep(lab, dt) {
    const st = lab.state, h = st.hero;
    st.dying -= dt;
    if (st.dying > 0) return;
    h.body.rotation.y = 0; h.body.scale.setScalar(1); h.light.intensity = h.baseLight;
    this.resetActors(lab);
    st.freeze = 1; lab.popup(lab.v3(0, 3, 4), 'Ещё попытка!', '#ffd23f', 24);
  },

  // ---------- волчата: спят в коридорах, просыпаются рядом с пастушком и встают цепочкой за ближним волком ----------
  movePups(lab, dt) {
    const st = lab.state, hp = st.hero.mesh.position, S = this.S;
    st.pups.forEach((p, i) => {
      if (p.state === 'gone') return;
      if (p.state === 'sleep') {
        if (Math.hypot(p.x - hp.x, p.z - hp.z) < 2.2 * S) { // проснулся: ищет ближнего волка, который не бежит от факела
          const lead = st.wolves.filter(w => w.state === 'active' && !w.fr).sort((a, b) => lab.flat(a.mesh, [p.x, 0, p.z]) - lab.flat(b.mesh, [p.x, 0, p.z]))[0];
          if (lead) {
            p.state = 'train'; p.lead = lead; p.slot = st.pups.filter(q => q.state === 'train' && q.lead === lead).length; p.fr = false; p.jump = 0;
            lab.popup([p.x, 1.5, p.z], '!', lead.def.eye, 26); lab.tone(880, 0.12, 'square', 0.04, 1300); lab.count('волчата проснулись');
          }
        }
        this.setPup(lab, i, p.x, 0.02 + Math.abs(Math.sin(lab.t * 1.5 + i)) * 0.03, p.z, p.rot, false);
        return;
      }
      // в цепочке: идёт по следу ведущего волка на своё место; ведущего прогнали — испуганный волчонок замер
      if (p.lead.state !== 'active') { this.setPup(lab, i, p.x, 0, p.z, p.rot, true); this.tintPup(lab, i, p); return; }
      const c = p.lead.crumbs;
      let need = (p.slot + 1) * 0.95 * S, k = c.length - 1, tx = c[k] ? c[k].x : p.x, tz = c[k] ? c[k].z : p.z;
      while (k > 0 && need > 0) { const a = c[k], b = c[k - 1], l = Math.hypot(a.x - b.x, a.z - b.z); if (l >= need) { const f = need / l; tx = a.x + (b.x - a.x) * f; tz = a.z + (b.z - a.z) * f; need = 0; } else { need -= l; k--; tx = b.x; tz = b.z; } }
      const ox = p.x, oz = p.z;
      p.jump = Math.min(1, p.jump + dt * 3);
      const r = p.jump < 1 ? 8 : 40; // подбегает к цепочке, потом держит место
      p.x = Math.abs(tx - p.x) > 3 ? tx : lab.damp(p.x, tx, r, dt); p.z = Math.abs(tz - p.z) > 3 ? tz : lab.damp(p.z, tz, r, dt);
      if (Math.hypot(p.x - ox, p.z - oz) > 0.002) p.rot = Math.atan2(p.x - ox, p.z - oz);
      this.setPup(lab, i, p.x, Math.abs(Math.sin(lab.t * 16 + i)) * 0.08 + Math.sin(p.jump * Math.PI) * 1.6, p.z, p.rot, true); // прыжок через стену к цепочке
      this.tintPup(lab, i, p);
    });
  },
  tintPup(lab, i, p) {
    const want = p.state === 'sleep' ? '#7c8299' : p.fr ? (lab.state.frWarn ? '#f2f4ff' : '#3d5bff') : p.lead.def.color;
    if (p.col === want) return;
    p.col = want; lab.state.pupBody.setColorAt(i, lab.color(want)); lab.state.pupBody.instanceColor.needsUpdate = true;
  },
  // факел погас: волчата без ведущего засыпают там, где стоят
  sleepPup(lab, p, i, home) {
    Object.assign(p, { state: 'sleep', lead: null, fr: false });
    if (home) { p.x = p.hx; p.z = p.hz; }
    this.tintPup(lab, i, p);
  },
  setPup(lab, i, x, y, z, rot, awake) {
    const st = lab.state, M = st.pupM;
    st.pupQ.setFromAxisAngle(st.pupUp, rot);
    st.pupS.set(1, awake ? 1 : 0.55, awake ? 1 : 1.25); // спящий — свернулся клубком
    M.compose(st.pupP.set(x, y, z), st.pupQ, st.pupS);
    st.pupBody.setMatrixAt(i, M); st.pupBody.instanceMatrix.needsUpdate = true;
    if (!awake) st.pupS.set(0, 0, 0);
    M.compose(st.pupP, st.pupQ, st.pupS);
    st.pupEyes.setMatrixAt(i, M); st.pupEyes.instanceMatrix.needsUpdate = true;
  },
  hidePup(lab, i) { const st = lab.state; st.pupM.makeScale(0, 0, 0); st.pupBody.setMatrixAt(i, st.pupM); st.pupEyes.setMatrixAt(i, st.pupM); st.pupBody.instanceMatrix.needsUpdate = true; st.pupEyes.instanceMatrix.needsUpdate = true; },
  // волчата ночи: не ближе 6 клеток к пастушку и к дольмену, по одному на клетку
  placePups(lab) {
    const st = lab.state, cfg = lab.cfg, n = st.night >= cfg.pupNight ? Math.min(st.pups.length, Math.round(cfg.pups) + (st.night - cfg.pupNight)) : 0, free = [];
    this.MAP.forEach((row, y) => row.split('').forEach((c, x) => {
      if ((c === '.' || c === ' ') && y !== 9 && Math.hypot(x - st.start[0], y - st.start[1]) > 6 && Math.hypot(x - 9, y - 9) > 6) free.push([x, y]);
    }));
    st.pups.forEach((p, i) => {
      if (i >= n || !free.length) { p.state = 'gone'; this.hidePup(lab, i); return; }
      const [x, y] = free.splice(lab.randInt(0, free.length - 1), 1)[0];
      Object.assign(p, { state: 'sleep', x: this.wx(x), z: this.wz(y), hx: this.wx(x), hz: this.wz(y), rot: lab.rand(0, 6), lead: null, fr: false, col: '#7c8299' });
      st.pupBody.setColorAt(i, lab.color(p.col));
    });
    if (st.pupBody.instanceColor) st.pupBody.instanceColor.needsUpdate = true;
  },

  // ---------- телеметрия динамики: что делают игроки и волки вместе ----------
  // окружение — волки близко с двух противоположных сторон и идут на тебя; хвост — волки сбились в стаю и идут друг за другом
  watchDynamics(lab, dt) {
    const st = lab.state, h = st.hero, cfg = lab.cfg;
    st.pinCool -= dt; st.tailCool -= dt; st.checkT -= dt; st.closeCool -= dt;
    // на волосок (замедление из Pac-Man CE DX): волк в шаге и идёт на тебя — мир замирает на миг
    if (Math.round(cfg.close) && st.closeCool <= 0 && !(st.fright > 0)) {
      const [hx, hy] = this.posOf(h);
      const near = st.wolves.some(w => {
        if (w.state !== 'active' || w.fr) return false;
        const d = this.near(lab, w, h), [x, y] = this.posOf(w);
        return d < 1.35 && d > 0.75 && Math.sign(hx - x) * w.dx + Math.sign(hy - y) * w.dy > 0;
      });
      if (near) {
        st.closeCool = 5; st.closeCalls++; lab.count('на волосок');
        lab.slowmo(0.45, 0.35); lab.tone(70, 0.18, 'sine', 0.22, 50); lab.tone(70, 0.18, 'sine', 0.18, 50, 0.22);
      }
    }
    if (st.checkT > 0) return;
    st.checkT = 0.25;
    const [hx, hy] = this.posOf(h), sides = new Set(), act = st.wolves.filter(w => w.state === 'active' && !w.fr);
    for (const w of act) {
      if (this.near(lab, w, h) > 6) continue;
      const [x, y] = this.posOf(w), dx = x - hx, dy = y - hy;
      if (Math.sign(-dx) * w.dx + Math.sign(-dy) * w.dy <= 0) continue; // идёт не к тебе
      sides.add(Math.abs(dx) > Math.abs(dy) ? (dx > 0 ? 'E' : 'W') : (dy > 0 ? 'S' : 'N'));
    }
    const pincer = (sides.has('E') && sides.has('W')) || (sides.has('N') && sides.has('S')) || sides.size >= 3;
    if (pincer && st.pinCool <= 0) { st.pincers++; st.pinCool = 3; lab.count('окружения'); }
    const pack = act.some((a, i) => act.some((b, j) => j > i && this.near(lab, a, b) < 2.2));
    st.tailT = pack ? st.tailT + 0.25 : 0;
    if (st.tailT >= 1.5 && st.tailCool <= 0) { st.tails++; st.tailCool = 4; st.tailT = 0; lab.count('хвост'); }
  },

  // ---------- сыр-бонус (как фрукт в Ms. Pac-Man): вкатывается из тоннеля и катится по лабиринту ----------
  spawnCheese(lab) {
    const st = lab.state, left = lab.chance(0.5);
    const c = { tx: left ? 0 : st.W - 1, ty: 9, t: 0, dx: left ? 1 : -1, dy: 0, life: 11, mesh: st.cheeseMesh };
    st.cheese = c; c.mesh.visible = true; this.place(lab, c, 0.45, 0);
    lab.tone(660, 0.3, 'sine', 0.05, 990); lab.popup(lab.v3(this.wx(c.tx), 1.6, this.wz(9)), 'Сыр!', '#fff3a0', 20);
  },
  updateCheese(lab, dt) {
    const st = lab.state, c = st.cheese;
    if (!c) return;
    c.life -= dt;
    this.move(lab, c, 2.6 * dt, a => {
      const back = [-a.dx, -a.dy], opts = this.DIRS.filter(d => this.open(lab, a.tx + d[0], a.ty + d[1]) && !(d[0] === back[0] && d[1] === back[1]));
      const d = opts.length ? lab.pick(opts) : back; a.dx = d[0]; a.dy = d[1];
    });
    this.place(lab, c, 0.3 + Math.abs(Math.sin(lab.t * 7)) * 0.35, 0);
    c.mesh.rotation.x += dt * 6;
    c.mesh.visible = c.life > 2.5 || Math.floor(c.life * 6) % 2 === 0;
    if (this.near(lab, c, st.hero) < 0.7) {
      const at = c.mesh.position.clone();
      lab.addScore(300 * st.night, at, '#fff3a0'); lab.sfx.coin(); lab.count('сыр'); st.cheeses++;
      lab.burst(at, { count: 20, colors: ['#fff3c4', '#ffd23f'], speed: 6, up: 3 }); lab.ring([at.x, 0, at.z], { color: '#fff3a0', radius: 2 });
      c.mesh.visible = false; st.cheese = null;
    } else if (c.life <= 0) { c.mesh.visible = false; st.cheese = null; lab.burst(c.mesh.position, { count: 8, color: '#a89a70', speed: 2 }); }
  },

  // ---------- вариации: прыжок, двери, толчок, тьма ----------
  // Прыжок (Pac-Mania): пастушок взлетает над коридором, в воздухе волк не поймает
  jump(lab) {
    const st = lab.state, h = st.hero;
    st.jumpT = this.JUMP; st.jumpCool = 2; st.jumps++; st.overThis = false; lab.count('прыжки');
    lab.sfx.jump(); lab.pulse(h.body, 1.25, 0.15);
    lab.burst([h.mesh.position.x, 0.2, h.mesh.position.z], { count: 10, colors: ['#c9c2a8', '#8f8a78'], speed: 3, up: 1.5, size: 0.1 });
    lab.after(this.JUMP, () => { lab.ring([h.mesh.position.x, 0, h.mesh.position.z], { color: '#ffe680', radius: 1.4 }); lab.tone(180, 0.12, 'sine', 0.06, 90); });
  },
  // Двери (вертушки Lady Bug): плита поднимается в клетке за спиной и держит волков doorTime секунд
  closeDoor(lab) {
    const st = lab.state, h = st.hero, cfg = lab.cfg;
    const x = h.t > 0.4 ? h.tx : this.wrap(lab, h.tx - h.dx), y = h.t > 0.4 ? h.ty : h.ty - h.dy;
    if (!this.open(lab, x, y) || (x === this.EXIT[0] && y === this.EXIT[1])) { lab.tone(160, 0.1, 'square', 0.04); return; }
    st.door = { x, y, t: cfg.doorTime, saved: false }; st.doorCool = cfg.doorTime + 1; st.doorsUsed++; lab.count('двери');
    const m = st.doorSlab; m.visible = true; m.position.set(this.wx(x), -0.5, this.wz(y));
    lab.tween(0.18, k => { m.position.y = -0.5 + k * 0.95; }, 'outBack');
    lab.shake(0.15); lab.tone(120, 0.25, 'sawtooth', 0.06, 70); lab.burst([this.wx(x), 0.3, this.wz(y)], { count: 14, colors: ['#b3a487', '#e8d9b0'], speed: 4, up: 3 });
  },
  updateDoor(lab, dt) {
    const st = lab.state, d = st.door;
    if (!d) return;
    d.t -= dt;
    // дверь остановила волка: охотник у плиты и шёл на неё
    if (!d.saved && st.wolves.some(w => w.state === 'active' && !w.fr && Math.hypot(this.wx(d.x) - w.mesh.position.x, this.wz(d.y) - w.mesh.position.z) < 1.7 * this.S)) {
      d.saved = true; st.doorSaves++; lab.count('двери спасли');
      lab.popup([this.wx(d.x), 2.2, this.wz(d.y)], 'Не пройдёт!', '#ffb36b', 20); lab.tone(90, 0.2, 'square', 0.05);
    }
    const blink = d.t < 1 && Math.floor(d.t * 8) % 2 === 0; // честно: плита мигает перед тем, как уйти в землю
    st.doorSlabMat.emissiveIntensity = blink ? 1.2 : 0.25;
    if (d.t > 0) return;
    st.door = null;
    const m = st.doorSlab;
    lab.tween(0.25, k => { m.position.y = 0.45 - k * 1; if (k >= 1) m.visible = false; });
  },
  // Толчок (Pac-Man CE 2): волк отталкивает, на третий толчок злится и тогда уже ловит
  bumped(lab, w) {
    const st = lab.state, h = st.hero;
    w.bumps = (w.bumps || 0) + 1; w.bumpCool = 0.9; st.bumps++; lab.count('толчки');
    this.reverse(lab, w); if (h.dx || h.dy) this.reverse(lab, h);
    const p = w.mesh.position;
    lab.shake(0.25); lab.vibrate(60, 0.4); lab.tone(220, 0.12, 'square', 0.06, 140);
    lab.burst([p.x, 0.8, p.z], { count: 12, colors: [w.def.color, '#ffffff'], speed: 5, up: 2 });
    if (w.bumps >= 3) {
      w.mad = true; st.mads++; lab.count('злые волки');
      lab.popup(lab.v3(p.x, 2.8, p.z), 'Злой!', '#ff3b2e', 26); lab.tone(110, 0.5, 'sawtooth', 0.07, 80);
      w.madTrail = lab.trail(w.head, { color: '#ff3b2e', width: 0.3, length: 8 });
    } else lab.popup(lab.v3(p.x, 2.6, p.z), `Толчок ${w.bumps} из 3`, w.def.eye, 20);
  },
  // Тьма: волка видно только в свете фонаря и факелов, глаза светятся всегда
  litAt(lab, x, z) {
    const st = lab.state, hp = st.hero.mesh.position, S = this.S;
    let k = 1 - (Math.hypot(x - hp.x, z - hp.z) - 3.6 * S) / (1.4 * S);
    for (const t of st.torches) if (t.lit) k = Math.max(k, 1 - (Math.hypot(x - this.wx(t.x), z - this.wz(t.y)) - 1.8 * S) / S);
    return Math.max(0, Math.min(1, k));
  },
  darkWolf(lab, w) {
    const st = lab.state, P = w.mesh.position, on = this.litAt(lab, P.x, P.z) > 0.3;
    if (!w.darkParts) { w.darkParts = []; w.body.traverse(m => { if (m.isMesh && m !== w.glowEyes) w.darkParts.push(m); }); }
    if (on === w.lit) return;
    w.lit = on;
    w.darkParts.forEach(m => { m.visible = on; });
    // волк выскочил из темноты рядом с пастушком
    if (on && w.state === 'active' && !w.fr && (st.darkCool || 0) < lab.t && this.near(lab, w, st.hero) < 5) {
      st.darkCool = lab.t + 2; st.darkMeets++; lab.count('из темноты'); lab.tone(260, 0.15, 'sawtooth', 0.05, 520);
    }
  },
  // ---------- афиша в меню и живая камера ----------
  // афиша: погоня в разгаре — пастушок бежит к факелу, Вожак и Хитрец заходят с двух сторон, камера ближе
  poster(lab) {
    const st = lab.state, h = st.hero;
    Object.assign(h, { tx: 4, ty: 13, t: 0.3, dx: 0, dy: -1 }); this.place(lab, h, 0, 0); h.mesh.rotation.y = Math.PI;
    h.legA.rotation.x = 0.7; h.legB.rotation.x = -0.7;
    const put = [[0, 8, 13, -1, 0], [1, 4, 16, 0, -1], [2, 1, 9, 1, 0]];
    for (const [i, x, y, dx, dy] of put) {
      const w = st.wolves[i]; if (!w) continue;
      Object.assign(w, { state: 'active', tx: x, ty: y, t: 0.2, dx, dy }); this.place(lab, w, 0, 0); w.mesh.rotation.y = Math.atan2(dx, dy);
      w.legA.rotation.x = 0.6; w.legB.rotation.x = -0.6;
    }
    const v = lab.view;
    st.poster = { d: v.distance, x: v.target.x, z: v.target.z };
    v.distance *= 0.8; v.target.x = this.wx(4) * 0.45; v.target.z = this.wz(13) * 0.45;
  },
  unposter(lab) {
    const st = lab.state, v = lab.view, p = st.poster;
    st.poster = null;
    v.distance = p.d; v.target.x = p.x; v.target.z = p.z;
    this.resetActors(lab);
  },
  // камера чуть дышит и тянется к пастушку: лабиринт живой, но целиком в кадре
  updateCamera(lab, dt) {
    const st = lab.state, v = lab.view, hp = st.hero.mesh.position, b = st.camT;
    v.target.x = lab.damp(v.target.x, b.x + hp.x * 0.06 + Math.sin(lab.t * 0.3) * 0.12, 2, dt);
    v.target.z = lab.damp(v.target.z, b.z + hp.z * 0.05 + Math.sin(lab.t * 0.21) * 0.1, 2, dt);
  },

  // ---------- расстановка: пастушок внизу, Вожак у двери, остальные в дольмене ----------
  resetActors(lab) {
    const st = lab.state, cfg = lab.cfg;
    const h = st.hero;
    Object.assign(h, { tx: st.start[0], ty: st.start[1], t: 0, dx: -1, dy: 0 }); st.want = null;
    h.mesh.rotation.y = -Math.PI / 2; this.place(lab, h, 0, 0);
    st.fright = 0; st.ice = false; st.jumpT = 0; st.mult = 1; st.streak = 0; st.mode = Math.round(cfg.secret) && cfg.scatterTime > 0 ? 'scatter' : 'chase'; st.phase = st.mode === 'scatter' ? 0 : 1;
    st.modeT = st.mode === 'scatter' ? cfg.scatterTime : cfg.chaseTime; st.relT = 0; st.closeCool = 2;
    if (st.heroTrail) { st.heroTrail.dispose(); st.heroTrail = null; }
    st.wolves.forEach((w, i) => {
      Object.assign(w, { fr: false, t: 0, dx: -1, dy: 0, k: 0, want: null, look: null, bumps: 0, mad: false, bumpCool: 0, passed: false });
      if (w.madTrail) { w.madTrail.dispose(); w.madTrail = null; }
      w.crumbs.length = 0;
      if (w.eyeTrail) { w.eyeTrail.dispose(); w.eyeTrail = null; }
      if (i === 0) { w.state = 'active'; w.tx = this.EXIT[0]; w.ty = this.EXIT[1]; this.place(lab, w, 0, 0); }
      else { w.state = 'home'; w.homeT = cfg.release * i; w.mesh.position.set(this.wx(w.def.slot[0]), 0, this.wz(w.def.slot[1])); w.mesh.rotation.y = Math.PI; }
      this.skin(lab, w);
    });
    // после поимки разбуженные волчата снова засыпают на своих местах
    st.pups.forEach((p, i) => { if (p.state === 'train') this.sleepPup(lab, p, i, true); });
  },

  // ---------- лабиринт: каменная кладка с мхом, дольмен, светлячки и факелы ----------
  buildMaze(lab) {
    const T = lab.THREE, st = lab.state, S = this.S, [dx0, dy0, dx1, dy1] = this.DEN;
    const inDen = (x, y) => x >= dx0 && x <= dx1 && y >= dy0 && y <= dy1;
    lab.box(st.W * S, 0.04, st.H * S, '#24304a', { at: [0, 0.02, 0], shadow: false }); // тропа
    // стена — кладка с мхом поверху: соседние «#» в строке — один пролёт, все пролёты — один меш на материал
    st.wallMat = new T.MeshStandardMaterial({ color: st.dark ? '#4a475c' : '#6f6b84', roughness: 0.9, flatShading: true });
    const stone = [], moss = [];
    this.MAP.forEach((row, y) => {
      for (let x = 0; x < row.length;) {
        if (row[x] !== '#' || inDen(x, y)) { x++; continue; }
        let e = x; while (e < row.length && row[e] === '#' && !inDen(e, y)) e++;
        const len = e - x, cx = this.wx(x + (len - 1) / 2), cz = this.wz(y);
        stone.push(lab.box(len * S - 0.1, 0.9, S - 0.1, st.wallMat, { at: [cx, 0.45, cz], parent: null }));
        moss.push(lab.box(len * S - 0.28, 0.16, S - 0.28, '#2f7a45', { at: [cx, 0.97, cz], parent: null }));
        x = e;
      }
    });
    lab.merge(stone); lab.merge(moss);
    // лес за краем лабиринта (клетки x) и кусты у выходов тоннеля: пастушок ныряет в тоннель и пропадает в зарослях
    const bush = lab.instances(new T.IcosahedronGeometry(0.62, 0), lab.mat('#ffffff'), 64), bi = { n: 0 };
    const addBush = (x, z, s, c) => { if (bi.n < 64) lab.place(bush, bi.n++, [x, 0.4 * s, z], { scale: [s, s * 0.8, s], rot: lab.rand(0, 6), color: c }); };
    this.MAP.forEach((row, y) => row.split('').forEach((c, x) => { if (c === 'x') for (let k = 0; k < 2; k++) addBush(this.wx(x) + lab.rand(-0.4, 0.4), this.wz(y) + lab.rand(-0.4, 0.4), lab.rand(0.8, 1.2), lab.pick(['#1d5a36', '#24683d', '#16482c'])); }));
    for (const side of [-1, 1]) for (let k = 0; k < 4; k++) addBush(side * (st.W / 2 + 0.3 + k * 0.5) * S, this.wz(9) + lab.rand(-0.5, 0.5), 1.3 + k * 0.15, lab.pick(['#163f28', '#1d5a36']));
    // на мху поверх стен — кусты, камни и цветы-светляки: копии трёх исходников
    const deco = [lab.instances(new T.IcosahedronGeometry(0.3, 0), lab.mat('#ffffff'), 90), lab.instances(new T.DodecahedronGeometry(0.2, 0), '#8d8a9a', 40), lab.instances(new T.OctahedronGeometry(0.08, 0), lab.mat('#ffc6ef', { glow: 0.9 }), 50)], dn = [0, 0, 0];
    this.MAP.forEach((row, y) => row.split('').forEach((c, x) => {
      if (c !== '#' || inDen(x, y) || !lab.chance(0.42)) return;
      const k = lab.chance(0.6) ? 0 : lab.chance(0.5) ? 1 : 2;
      if (dn[k] >= deco[k].count) return;
      lab.place(deco[k], dn[k]++, [this.wx(x) + lab.rand(-0.3, 0.3), 1.08 + (k === 2 ? 0.1 : 0), this.wz(y) + lab.rand(-0.3, 0.3)], { scale: [1, lab.rand(0.6, 1), 1], rot: lab.rand(0, 3), color: k === 0 ? lab.pick(['#2f9a52', '#46b35e', '#2a7f47']) : undefined });
    }));
    lab.noShadow(deco[2]);
    // дольмен — логово волков: плиты из песчаника вокруг, лаз в передней плите; крыши нет — волков внутри видно
    const L = this.wx(dx0) - S / 2 + 0.15, R = this.wx(dx1) + S / 2 - 0.15, F = this.wz(dy0) - S / 2 + 0.2, B = this.wz(dy1) + S / 2 - 0.2, cx = this.wx(9);
    const P = [], slab = (w, h, d, x, y, z, rot) => P.push(lab.box(w, h, d, '#b3a487', { at: [x, y, z], rot, parent: null }));
    slab(R - L, 1.15, 0.3, (L + R) / 2, 0.58, B); // задняя
    slab(0.3, 1.15, B - F, L, 0.58, (F + B) / 2); slab(0.3, 1.15, B - F, R, 0.58, (F + B) / 2); // боковые
    slab(cx - 0.62 - L, 1.15, 0.3, (L + cx - 0.62) / 2, 0.58, F); slab(R - cx - 0.62, 1.15, 0.3, (R + cx + 0.62) / 2, 0.58, F); // передние по бокам от лаза
    slab(1.3, 0.35, 0.3, cx, 1.0, F); // над лазом
    lab.merge(P);
    st.doorMat = new T.MeshStandardMaterial({ color: '#2a2018', emissive: '#000000', flatShading: true });
    lab.box(1.1, 0.1, 0.34, st.doorMat, { at: [cx, 0.78, F], shadow: false });
    // каменная дверь вариации «Двери»: одна плита, поднимается там, где нужно
    st.doorSlabMat = new T.MeshStandardMaterial({ color: '#c9b78f', emissive: '#ff9a3c', emissiveIntensity: 0.25, flatShading: true });
    st.doorSlab = lab.box(S - 0.12, 0.9, S - 0.12, st.doorSlabMat, { at: [0, -1, 0] }); st.doorSlab.visible = false;
    // светлячки — одна пачка копий; факелы — шест, чаша, огонь и свой свет
    st.dotMesh = lab.instances(new T.IcosahedronGeometry(0.12, 0), lab.mat('#d8ff6a', { unlit: true, glow: 1.6 }), 200, { shadow: false });
    st.dotMesh.frustumCulled = false; st.zeroM = new T.Matrix4().makeScale(0, 0, 0);
    st.torches = [];
    const poles = [];
    this.MAP.forEach((row, y) => row.split('').forEach((c, x) => {
      if (c !== 'o') return;
      const X = this.wx(x), Z = this.wz(y);
      poles.push(lab.cyl(0.06, 0.09, 1.1, '#6b4a2e', { at: [X, 0.55, Z], parent: null, sides: 6 }), lab.cyl(0.24, 0.12, 0.2, '#3a3a44', { at: [X, 1.15, Z], parent: null, sides: 8 }));
      const flame = lab.group({ at: [X, 1.25, Z] });
      lab.cone(0.2, 0.55, '#ff8a2c', { parent: flame, at: [0, 0.27, 0], glow: 1.4, sides: 6, shadow: false });
      lab.cone(0.1, 0.32, '#fff2a0', { parent: flame, at: [0, 0.2, 0], glow: 1.6, sides: 5, shadow: false });
      const light = new T.PointLight('#ff9a4a', 9, 6.5, 1.6); light.position.set(X, 1.7, Z); lab.add(light);
      st.torches.push({ x, y, flame, light, lit: true });
    }));
    lab.merge(poles);
    // сыр — круг адыгейского сыра, катится колесом
    st.cheeseMesh = lab.mesh(new T.CylinderGeometry(0.38, 0.38, 0.26, 12).rotateZ(Math.PI / 2), '#fff1c8', { glow: 0.25 });
    st.cheeseMesh.rotation.order = 'YXZ'; st.cheeseMesh.visible = false; // ось колеса поперёк хода: катится вперёд
    this.MAP.forEach((row, y) => { const x = row.indexOf('P'); if (x >= 0) st.start = [x, y]; });
  },
  fillDots(lab) {
    const st = lab.state;
    st.dots = {}; st.dotsLeft = 0; st.dotList = []; st.angry = false;
    if (st.wolves && st.wolves[0] && st.wolves[0].rage) { st.wolves[0].rage.dispose(); st.wolves[0].rage = null; }
    this.MAP.forEach((row, y) => row.split('').forEach((c, x) => {
      if (c !== '.' && c !== 'o') return;
      const d = { x, y, torch: 0, i: -1, gone: false };
      if (c === 'o') d.torch = st.torches.findIndex(t => t.x === x && t.y === y) + 1;
      else { d.i = st.dotList.length; st.dotList.push(d); }
      st.dots[x + ',' + y] = d; st.dotsLeft++;
    }));
    st.torches.forEach(t => { t.flame.visible = true; t.light.visible = true; t.lit = true; });
    for (let i = st.dotList.length; i < st.dotMesh.count; i++) this.hideDot(st, { i });
    const M = new lab.THREE.Matrix4(); // сразу на местах: афиша в меню видна до первого кадра партии
    for (const d of st.dotList) { M.makeTranslation(this.wx(d.x), 0.5, this.wz(d.y)); st.dotMesh.setMatrixAt(d.i, M); }
    st.dotMesh.instanceMatrix.needsUpdate = true;
    if (st.pups) this.placePups(lab);
  },
  hideDot(st, d) { st.dotMesh.setMatrixAt(d.i, st.zeroM); st.dotMesh.instanceMatrix.needsUpdate = true; },

  // ---------- герои ----------
  buildHero(lab) {
    const T = lab.THREE, st = lab.state;
    const g = lab.group(), body = lab.group({ parent: g, scale: 1.6 }), P = [], part = m => (P.push(m), m), o = { parent: null };
    part(lab.cyl(0.18, 0.3, 0.62, '#a3343c', Object.assign({ at: [0, 0.68, 0], sides: 8 }, o))); // черкеска
    for (const s of [-1, 1]) for (let k = 0; k < 3; k++) part(lab.box(0.05, 0.035, 0.03, '#efe2c0', Object.assign({ at: [s * 0.1, 0.9 - k * 0.06, 0.155 + k * 0.012] }, o))); // газыри
    part(lab.box(0.46, 0.07, 0.42, '#e8c15a', Object.assign({ at: [0, 0.6, 0] }, o))); // пояс
    part(lab.ball(0.17, '#f1c9a0', Object.assign({ at: [0, 1.12, 0], detail: 1 }, o)));
    for (const s of [-1, 1]) part(lab.box(0.035, 0.035, 0.02, '#1a1a22', Object.assign({ at: [s * 0.065, 1.14, 0.16] }, o)));
    part(lab.cyl(0.2, 0.18, 0.17, '#f4efe4', Object.assign({ at: [0, 1.3, 0], sides: 9, glow: 0.12 }, o))); // папаха: белая, видна сверху в любом углу
    part(lab.cyl(0.13, 0.2, 0.05, '#f4efe4', Object.assign({ at: [0, 1.4, 0], sides: 9, glow: 0.12 }, o)));
    part(lab.box(0.12, 0.42, 0.12, '#a3343c', Object.assign({ at: [-0.24, 0.74, 0], rot: [0, 0, -0.12] }, o))); // левая рука
    lab.merge(P, body);
    const leg = (x) => { const piv = lab.group({ parent: body, at: [x, 0.4, 0] }); lab.box(0.13, 0.4, 0.16, '#2b2230', { parent: piv, at: [0, -0.2, 0.02] }); return piv; };
    const legA = leg(-0.11), legB = leg(0.11);
    // правая рука с фонарём качается на бегу
    const arm = lab.group({ parent: body, at: [0.24, 0.92, 0] });
    lab.box(0.11, 0.11, 0.38, '#a3343c', { parent: arm, at: [0, -0.1, 0.16], rot: [0.5, 0, 0] });
    const lantern = lab.group({ parent: arm, at: [0, -0.22, 0.38] });
    lab.box(0.18, 0.24, 0.18, '#ffd96b', { parent: lantern, glow: 1.2, shadow: false });
    lab.box(0.22, 0.05, 0.22, '#3a3030', { parent: lantern, at: [0, 0.14, 0] });
    const dk = st.dark, base = dk ? 24 : 16; // во Тьме фонарь — единственный свет, он ярче и дальше
    const light = new T.PointLight('#ffcf7a', base, dk ? 10 : 8, 1.3); light.position.set(0, 2.4, 0.5); g.add(light); // свет фонаря сверху: освещает коридор, а не слепит
    // тёплое пятно света под ногами: пастушка видно в любом углу лабиринта
    const halo = lab.mesh(new T.CircleGeometry(1.5, 20).rotateX(-Math.PI / 2), lab.mat('#4a3410', { unlit: true, add: true }), { parent: g, at: [0, 0.06, 0], shadow: false });
    g.rotation.y = -Math.PI / 2;
    st.hero = { g, mesh: g, body, legA, legB, arm, lantern, light, halo, baseLight: base, tx: 0, ty: 0, t: 0, dx: 0, dy: 0 };
  },
  // волк: неподвижные детали слиты по материалу, лапы парами и хвост — отдельно для бега рысью
  wolfModel(lab, furMat, eyeMat) {
    const o = x => Object.assign({ parent: null }, x), root = lab.group(), body = lab.group({ parent: root }), P = [];
    P.push(lab.box(0.46, 0.4, 0.82, furMat, o({ at: [0, 0.56, -0.04], round: 0.08 })));
    P.push(lab.box(0.52, 0.48, 0.3, furMat, o({ at: [0, 0.64, 0.26], round: 0.08 }))); // грудь-грива
    P.push(lab.box(0.38, 0.34, 0.36, furMat, o({ at: [0, 0.82, 0.5], round: 0.06 })));
    P.push(lab.box(0.2, 0.15, 0.24, furMat, o({ at: [0, 0.74, 0.74] })));
    for (const s of [-1, 1]) P.push(lab.cone(0.085, 0.22, furMat, o({ at: [s * 0.12, 1.06, 0.45], sides: 4 })));
    P.push(lab.box(0.09, 0.07, 0.06, '#15151c', o({ at: [0, 0.79, 0.87] })));
    P.push(lab.box(0.5, 0.08, 0.14, '#f2efe6', o({ at: [0, 0.68, 0.38] }))); // светлый воротник
    lab.merge(P, body);
    const head = lab.group({ parent: body, at: [0, 0.86, 0.69] });
    const glowEyes = lab.noShadow(lab.merge([-1, 1].map(s => lab.box(0.09, 0.065, 0.04, eyeMat, o({ at: [s * 0.1, 0, 0] }))), head).children[0]);
    const legPair = (k) => { const piv = lab.group({ parent: body, at: [0, 0.4, 0] }), L = []; for (const [x, z] of [[-0.13 * k, 0.26], [0.13 * k, -0.3]]) L.push(lab.box(0.11, 0.38, 0.11, furMat, o({ at: [x, -0.19, z] }))); lab.merge(L, piv); return piv; };
    const legA = legPair(1), legB = legPair(-1);
    const tail = lab.group({ parent: body, at: [0, 0.68, -0.44] });
    lab.cone(0.1, 0.5, furMat, { parent: tail, at: [0, 0.05, -0.2], rot: [-1.9, 0, 0], sides: 5 });
    return { root, body, head, glowEyes, legA, legB, tail };
  },
  buildWolves(lab) {
    const T = lab.THREE, st = lab.state, n = Math.round(lab.cfg.wolves);
    // испуганный волк: общий материал, мигает белым, когда факел гаснет
    st.frMat = new T.MeshStandardMaterial({ color: '#3d5bff', emissive: '#1a2a99', emissiveIntensity: 1, flatShading: true, roughness: 0.7 });
    st.frEye = lab.mat('#ffffff', { glow: 1.2 });
    st.wolves = []; st.marks = [];
    const cross = lab.addons.BufferGeometryUtils.mergeGeometries([new T.BoxGeometry(1, 0.04, 0.18).rotateY(Math.PI / 4), new T.BoxGeometry(1, 0.04, 0.18).rotateY(-Math.PI / 4)]);
    for (let i = 0; i < n; i++) {
      const def = this.WOLVES[i], furMat = lab.mat(def.color), eyeMat = lab.mat(def.eye, { glow: 1.6 });
      const m = this.wolfModel(lab, furMat, eyeMat);
      m.root.scale.setScalar(1.45);
      const fur = []; m.body.traverse(x => { if (x.isMesh && x.material === furMat) fur.push(x); });
      // одни глаза — волк бежит обратно в дольмен
      const ghost = lab.group({ parent: m.root, at: [0, 0.7, 0] });
      for (const s of [-1, 1]) { lab.ball(0.12, '#ffffff', { parent: ghost, at: [s * 0.13, 0, 0], detail: 1, glow: 0.4, shadow: false }); lab.ball(0.06, '#3d5bff', { parent: ghost, at: [s * 0.13, 0, 0.09], detail: 0, glow: 1, shadow: false }); }
      ghost.visible = false;
      st.wolves.push(Object.assign(m, { i, def, mesh: m.root, fur, furMat, eyeMat, ghost, crumbs: [], human: i === 0 && Math.round(lab.cfg.vs) === 1, state: 'home', tx: 0, ty: 0, t: 0, dx: 0, dy: 0 }));
      // крестик цели: куда идёт волк (ручка «Показать, куда целится»)
      const mark = lab.mesh(cross, lab.mat(def.eye, { unlit: true, alpha: 0.85, glow: 0.6 }), { shadow: false });
      mark.visible = false; st.marks.push(mark);
    }
    if (st.wolves[0] && st.wolves[0].human) lab.popup(lab.v3(0, 3, -6), 'Вожак — второй игрок', '#ff5a4a', 20);
  },
  // волчата — две пачки копий на всех: тело (цвет копии — цвет ведущего волка) и светящиеся глаза
  buildPups(lab) {
    const T = lab.THREE, st = lab.state, U = lab.addons.BufferGeometryUtils, N = 16;
    const part = (g, x, y, z) => g.translate(x, y, z);
    const body = U.mergeGeometries([part(new T.BoxGeometry(0.4, 0.3, 0.56), 0, 0.32, 0), part(new T.BoxGeometry(0.3, 0.26, 0.28), 0, 0.46, 0.34), part(new T.BoxGeometry(0.14, 0.1, 0.14), 0, 0.42, 0.52),
      part(new T.ConeGeometry(0.07, 0.16, 4), -0.09, 0.66, 0.32), part(new T.ConeGeometry(0.07, 0.16, 4), 0.09, 0.66, 0.32), part(new T.BoxGeometry(0.08, 0.18, 0.08), -0.12, 0.09, 0.18),
      part(new T.BoxGeometry(0.08, 0.18, 0.08), 0.12, 0.09, 0.18), part(new T.BoxGeometry(0.08, 0.18, 0.08), -0.12, 0.09, -0.18), part(new T.BoxGeometry(0.08, 0.18, 0.08), 0.12, 0.09, -0.18),
      part(new T.ConeGeometry(0.06, 0.3, 4).rotateX(-1.9), 0, 0.42, -0.36)].map(g => g.toNonIndexed()));
    const eyes = U.mergeGeometries([part(new T.BoxGeometry(0.06, 0.05, 0.03), -0.07, 0.5, 0.49), part(new T.BoxGeometry(0.06, 0.05, 0.03), 0.07, 0.5, 0.49)]);
    st.pupBody = lab.instances(body, lab.mat('#ffffff'), N); st.pupBody.frustumCulled = false;
    st.pupEyes = lab.instances(eyes, lab.mat('#ffe680', { glow: 1.6 }), N, { shadow: false }); st.pupEyes.frustumCulled = false;
    st.pupBody.setColorAt(0, lab.color('#7c8299'));
    st.pupM = new T.Matrix4(); st.pupQ = new T.Quaternion(); st.pupS = new T.Vector3(); st.pupP = new T.Vector3(); st.pupUp = new T.Vector3(0, 1, 0);
    st.pups = [];
    for (let i = 0; i < N; i++) { st.pups.push({ state: 'gone', x: 0, z: 0, rot: 0 }); this.hidePup(lab, i); }
  },

  // ---------- ночь вокруг: лес, горы, луна ----------
  scenery(lab, scene) {
    const T = lab.THREE, F = this.field;
    lab.light.hemi.intensity = 0.55; lab.light.hemi.color.set('#8fa6ff'); lab.light.hemi.groundColor.set('#1a2030');
    lab.light.sun.color.set('#b9c8ff'); lab.light.sun.intensity = 0.9; // луна вместо солнца
    if (lab.state.dark) { lab.light.hemi.intensity = 0.07; lab.light.sun.intensity = 0.06; } // Тьма: луна за тучами
    lab.ground({ w: 160, h: 160, color: '#14301f', bumps: 3, flat: 0.3 });
    // горы с ледниками вдали — один меш на цвет
    const hills = [];
    for (let i = 0; i < 8; i++) {
      const x = -64 + i * 18 + lab.rand(-4, 4), z = -46 - lab.rand(0, 16), r = lab.rand(10, 17), h = lab.rand(16, 28);
      hills.push(lab.cone(r, h, '#27304f', { at: [x, h / 2 - 1, z], sides: 6, rot: lab.rand(0, 3), parent: null }));
      hills.push(lab.cone(r * 0.36, h * 0.36, '#c9d6ff', { at: [x, h - 1 - h * 0.18 + 0.05, z], sides: 6, rot: lab.rand(0, 3), parent: null }));
    }
    lab.noShadow(lab.merge(hills));
    // пихты — копии: кроны в два яруса и стволы
    const N = 110, crown = lab.instances(new T.ConeGeometry(1, 2.4, 7), lab.mat('#ffffff'), N * 2), trunk = lab.instances(new T.CylinderGeometry(0.18, 0.24, 1, 6), '#4a3324', N);
    for (let i = 0; i < N; i++) {
      let x, z; do { x = lab.rand(-50, 50); z = lab.rand(-44, 34); } while (Math.abs(x) < F.w / 2 + 1.5 && Math.abs(z) < F.h / 2 + 1.5);
      const s = lab.rand(0.9, 1.8), c = lab.pick(['#12402a', '#175236', '#1d5e3c']);
      lab.place(trunk, i, [x, 0.5 * s, z], { scale: s });
      lab.place(crown, i * 2, [x, 1.9 * s, z], { scale: [s * 1.2, s, s * 1.2], rot: lab.rand(0, 3), color: c });
      lab.place(crown, i * 2 + 1, [x, 2.9 * s, z], { scale: [s * 0.85, s * 0.8, s * 0.85], rot: lab.rand(0, 3), color: c });
    }
    // луна и звёзды
    lab.ball(5, '#fff4d6', { at: [-34, 40, -80], unlit: true, glow: 0.7, detail: 2, shadow: false });
    const pts = [];
    for (let i = 0; i < 320; i++) { const a = lab.rand(0, Math.PI * 2), e = lab.rand(0.12, 1.25); pts.push(Math.cos(a) * Math.cos(e) * 160, Math.sin(e) * 160, Math.sin(a) * Math.cos(e) * 160); }
    const g = new T.BufferGeometry(); g.setAttribute('position', new T.Float32BufferAttribute(pts, 3));
    scene.add(new T.Points(g, new T.PointsMaterial({ color: '#ffffff', size: 0.9, fog: false })));
    this.life(lab, scene);
  },
  // живая ночь: летучие мыши кружат над лабиринтом, в лесу мерцают светлячки, по небу чиркают падающие звёзды
  life(lab, scene) {
    const T = lab.THREE, st = lab.state, F = this.field;
    st.bats = [];
    for (let i = 0; i < 4; i++) {
      const g = lab.group(), wing = s => { const piv = lab.group({ parent: g, at: [s * 0.08, 0, 0] }); lab.box(0.42, 0.03, 0.24, '#20182c', { parent: piv, at: [s * 0.21, 0, 0], shadow: false }); return piv; };
      lab.ball(0.11, '#2b2238', { parent: g, detail: 0, shadow: false });
      for (const s of [-1, 1]) lab.box(0.03, 0.03, 0.02, '#ff5a4a', { parent: g, at: [s * 0.04, 0.03, 0.1], glow: 1.4, shadow: false });
      st.bats.push({ g, wl: wing(-1), wr: wing(1), r: 7 + i * 2.2, h: 5.5 + i * 0.9, sp: (i % 2 ? -1 : 1) * (0.35 + i * 0.07), ph: i * 1.7 });
    }
    const N = 90, pos = new Float32Array(N * 3), seeds = [];
    for (let i = 0; i < N; i++) {
      let x, z; do { x = lab.rand(-34, 34); z = lab.rand(-30, 26); } while (Math.abs(x) < F.w / 2 + 1 && Math.abs(z) < F.h / 2 + 1);
      seeds.push([x, z, lab.rand(0.6, 2.4), lab.rand(0, 6)]);
    }
    const fg = new T.BufferGeometry(); fg.setAttribute('position', new T.BufferAttribute(pos, 3));
    st.flies = new T.Points(fg, new T.PointsMaterial({ color: '#d8ff6a', size: 0.32, transparent: true, opacity: 0.9, depthWrite: false })); st.flySeeds = seeds;
    st.flies.frustumCulled = false; scene.add(st.flies);
    st.star = lab.box(2.6, 0.08, 0.08, lab.mat('#ffffff', { unlit: true, alpha: 0.9, glow: 1 }), { at: [0, -50, -90], shadow: false });
  },
  lifeStep(lab, dt) {
    const st = lab.state, t = lab.t;
    for (const b of st.bats) {
      const a = b.ph + t * b.sp, x = Math.cos(a) * b.r, z = Math.sin(a) * b.r * 0.8 - 1.5;
      b.g.position.set(x, b.h + Math.sin(t * 1.3 + b.ph) * 0.6, z);
      b.g.rotation.y = Math.atan2(-Math.sin(a) * Math.sign(b.sp), Math.cos(a) * Math.sign(b.sp) * 0.8);
      const f = Math.sin(t * 16 + b.ph) * 0.9; b.wl.rotation.z = f; b.wr.rotation.z = -f;
    }
    const P = st.flies.geometry.attributes.position;
    st.flySeeds.forEach(([x, z, h, ph], i) => P.setXYZ(i, x + Math.sin(t * 0.5 + ph) * 0.6, h + Math.sin(t * 1.1 + ph) * 0.4, z + Math.cos(t * 0.4 + ph) * 0.6));
    P.needsUpdate = true;
    st.flies.material.opacity = 0.65 + 0.3 * Math.sin(t * 3);
    // падающая звезда раз в 5–9 секунд
    st.starT -= dt;
    if (st.starT <= 0) {
      st.starT = 6 + 3 * Math.sin(t * 7.3);
      const m = st.star, x0 = 30 * Math.sin(t * 3.1), y0 = 38 + 6 * Math.cos(t * 2.3);
      lab.tween(0.9, k => { m.position.set(x0 - k * 26, y0 - k * 9, -90); m.rotation.z = 0.33; m.scale.x = Math.sin(k * Math.PI) * 1.6 + 0.01; if (k >= 1) m.position.y = -50; });
    }
  },
  animate(lab, dt) {
    const st = lab.state, t = lab.t, M = st.dotM || (st.dotM = new lab.THREE.Matrix4());
    this.lifeStep(lab, dt);
    // светлячки парят и мерцают каждый в свою фазу; во Тьме видны только в свете
    for (const d of st.dotList) {
      if (d.gone) continue;
      const k = (0.75 + 0.35 * Math.sin(t * 5 + d.x * 1.7 + d.y * 2.3)) * (st.dark ? this.litAt(lab, this.wx(d.x), this.wz(d.y)) : 1);
      M.makeScale(k, k, k).setPosition(this.wx(d.x) + Math.sin(t * 1.3 + d.y) * 0.07, 0.5 + Math.sin(t * 2.2 + d.x * 0.9 + d.y) * 0.1, this.wz(d.y) + Math.cos(t * 1.1 + d.x) * 0.07);
      st.dotMesh.setMatrixAt(d.i, M);
    }
    st.dotMesh.instanceMatrix.needsUpdate = true;
    // факелы горят и дрожат; с факелом в руках фонарь пастушка пылает
    st.torches.forEach((tc, i) => {
      if (!tc.lit) return;
      const f = 0.85 + 0.15 * Math.sin(t * 17 + i * 3) + 0.08 * Math.sin(t * 31 + i);
      tc.flame.scale.set(1, f, 1); tc.light.intensity = 8 * f;
    });
    const h = st.hero, fire = st.fright > 0;
    if (st.dying <= 0) h.light.intensity = h.baseLight * (fire ? 1.6 + 0.2 * Math.sin(t * 20) : 1);
    h.light.color.set(fire ? '#ff8a3c' : '#ffcf7a');
    h.g.visible = st.dying > 0 || !lab.blink();
  },
};
