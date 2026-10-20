// «Пружинная тропа» — ремейк-донор урока 14 по мотивам уровня 1-1 Super Mario Bros. и испытательных камер Portal, оболочка «Лаб3D 1.0» (three.js).
// План.
// Фраза: кузнечик Цок скачет по тропе через луга Лаго-Наки к флагу на плато; у тропы одна изюминка — пружины (или доски, или ветер).
// Ядро на 3 секунды: бег — прыжок или пружина — приземление с пылью и сжатием; росинки висят там, куда несёт пружина.
// Уровень из четырёх участков — ввести, развить, перевернуть, завершить: изюминку сначала показывают там, где ошибка ничего не стоит,
// потом над настоящей ямой, потом она работает по-новому, а финал собирает всё вместе. Ни одного слова — уровень учит сам.
// Риск — награда: росинки над ямами и высокий уступ за удержанием прыжка на пружине.
// Угрозы: ямы, жук-рогач (сбоку — больно, сверху — прыжок на него), колючки; у досок — жуки, которые тоже ломают доски; у ветра — порывы.
// Кривая партии: участок 1 — 0–20 с без смертей, 2 — 20–50 с, 3 — 50–80 с новый приём, 4 — финал и флаг; рекорд — за время и росинки.
// Видно = правда: пружина сжимается и звенит, доска дрожит перед падением, порыв ветра видно по струям и слышно заранее.
// Уровни — данные: каждый участок — текстовая карта 32 × 12 (LEGEND ниже); свои уровни и уровни гостей игра берёт через lab.levels.
// Тепловая карта: lab.spot('where'/'death') в клетках участка — портал рисует автору, где игроки падали.
// Спрятанная механика донора — обучение через дизайн уровня: ручка secret 0 — те же участки в другом порядке (сначала новый приём над пропастью),
// без росинок-подсказок и камней-чекпоинтов. Разбор игр жанра — docs/01_Журнал_курса.md, раздел урока 14.
// Лицо игры: летнее утро на плато, тёплое солнце против прохладных гор; приёмы — росинки-дуги по траектории, пружины-грибы с золотой спиралью,
// пыль и «бум» на каждом приземлении. Палитра: трава #6cc24a, земля #8a5a3c, пружина #ff5d6e, росинки #ffd23f, кузнечик #ff9f1c (оранжевый: на лугу его видно сразу).
// Вид сбоку: X — вправо, Y — вверх, тропа на Z = 0; клетка карты = 1 м, нижняя строка карты — y = 0.
const GAME = {
  engine: 'three',
  title: 'Пружинная тропа',
  subtitle: 'Кузнечик Цок скачет к флагу на плато. Никаких подсказок — тропа научит сама!',
  donor: 'уровня 1-1 Super Mario Bros. и камер Portal',
  players: 1,
  controls: [
    { input: 'move', text: 'бежать' },
    { input: 'a', text: 'прыжок; на пружине держи — выше' },
  ],
  camera: { type: 'side', tilt: Math.PI / 2 - 0.1, distance: 19, target: [6, 6, 0] }, // камеру ведёт игра: aim()
  field: { w: 30, h: 13 },
  sky: ['#4aa3e8', '#ffe7c2'],
  fog: 0.012,
  accent: '#ffd23f',
  scoreColor: '#ffd23f',
  lives: 0,
  decisions: [
    'Чувство: «я сам догадался» — новая штука сначала там, где не страшно',
    'Честность: яма видна заранее, пружина звенит, доска дрожит, порыв ветра слышно до того, как он подует',
    'Выбор: обычный прыжок или пружина, низкий путь или высокий уступ с росинками',
  ],
  config: {
    plan: { value: 0, min: 0, max: 4, step: 1, label: 'Как построен уровень', restart: true, names: ['ввести → развить → перевернуть → завершить', 'без вступления', 'без поворота', 'таблички вместо вступления', 'без страховки: ни росинок, ни камней'] },
    twist: { value: 0, min: 0, max: 2, step: 1, label: 'Изюминка тропы', restart: true, names: ['пружины', 'исчезающие доски', 'восходящий ветер'] },
    secret: { value: 1, min: 0, max: 1, step: 1, label: 'Спрятанная механика: уровень учит сам', restart: true, hint: '0 — те же участки, но новый приём сразу над пропастью, без росинок-подсказок и камней' },
    jumpH: { value: 1.9, min: 1, max: 3.5, step: 0.1, label: 'Высота прыжка, клеток' },
    spring: { value: 4.6, min: 2.5, max: 8, step: 0.1, label: 'Пружина подбрасывает, клеток' },
    boost: { value: 6.8, min: 3, max: 10, step: 0.1, label: 'Пружина с удержанием прыжка, клеток' },
    side: { value: 17, min: 8, max: 24, step: 0.5, label: 'Боковая пружина бросает вперёд' },
    run: { value: 6.5, min: 3, max: 12, step: 0.5, label: 'Скорость бега' },
    crumble: { value: 0.45, min: 0.15, max: 1.5, step: 0.05, label: 'Доска падает через, с' },
    wind: { value: 7.5, min: 3, max: 14, step: 0.5, label: 'Сила восходящего ветра' },
    gust: { value: 3, min: 1.5, max: 6, step: 0.25, label: 'Порыв ветра: период, с' },
    bug: { value: 1.6, min: 0, max: 4, step: 0.1, label: 'Скорость жука' },
    limit: { value: 180, min: 60, max: 400, step: 10, label: 'Время на тропу, с' },
  },
  presets: {
    'Новичок': { jumpH: 2.2, spring: 5, run: 6, bug: 1, crumble: 0.8, limit: 300 },
    'Без спрятанной механики': { secret: 0 },
    'Без вступления': { plan: 1 },
    'Без поворота': { plan: 2 },
    'Таблички': { plan: 3 },
    'Без страховки': { plan: 4 },
    'Исчезающие доски': { twist: 1 },
    'Восходящий ветер': { twist: 2 },
  },
  notes: [
    'Камень-чекпоинт в конце каждого участка: упал — начинаешь у последнего камня.',
    'Участок без единого падения — «Чисто!» и +300 очков.',
    'Жука можно победить прыжком сверху, сбоку он ранит.',
  ],
  // легенда карты: символ → что в клетке (её же видит редактор уровней портала)
  LEGEND: {
    '#': 'земля', '=': 'мостик (сквозной снизу)', '%': 'доска с трещиной (падает)', '^': 'пружина', '>': 'пружина на боку (бросает вперёд)', '<': 'пружина на боку (бросает назад)',
    '|': 'восходящий ветер', ':': 'порыв ветра', '*': 'росинка', 'o': 'жук-рогач', 'x': 'колючки', 'C': 'камень-чекпоинт', '@': 'старт', 'F': 'флаг (финиш)', '?': 'табличка', ' ': 'пусто',
  },
  PART_NAMES: ['ввести', 'развить', 'перевернуть', 'завершить'],
  SETS: [
    { id: 'spring', name: 'Пружины', signs: ['Наступи на пружину — она подбросит тебя!', 'Держи прыжок на пружине — взлетишь выше!'] },
    { id: 'boards', name: 'Исчезающие доски', signs: ['Доска с трещиной падает, если на ней стоять!', 'Не останавливайся на досках — беги!'] },
    { id: 'wind', name: 'Восходящий ветер', signs: ['Зайди в поток — ветер поднимет тебя!', 'В потоке держи вправо, чтобы перелететь!'] },
  ],
  MAPS: {
    spring_ki: [
      '                                ',
      '                                ',
      '                                ',
      '                                ',
      '                                ',
      '        * * *     * *           ',
      '       *     *  *     *         ',
      '          ###                   ',
      '          ###                   ',
      ' @    ^   ### ^              C  ',
      '################    ############',
      '################################',
    ],
    spring_sho: [
      '                                ',
      '                                ',
      '                                ',
      '                       ***      ',
      '        *      *      =====     ',
      '      *   *  *                  ',
      '                                ',
      '                                ',
      '                                ',
      '    ^      ^     o  ^        C  ',
      '########   #  #######   ########',
      '########   #  #######   ########',
    ],
    spring_ten: [
      '                                ',
      '                                ',
      '                                ',
      '                                ',
      '                                ',
      '                                ',
      '                                ',
      '       * * *         * *        ',
      '     *       *     *     *      ',
      '   >            >            C  ',
      '##################        ######',
      '##################        ######',
    ],
    spring_ketsu: [
      '                                ',
      '                                ',
      '                                ',
      '                                ',
      '                          *     ',
      '         *                   F  ',
      '       *   *               #####',
      '                   *       #####',
      '                 *   *     #####',
      '     ^       o >         ^ #####',
      '#######    #####       #########',
      '#######    #####       #########',
    ],
    spring_sign: [
      '                                ',
      '                                ',
      '                                ',
      '                                ',
      '                                ',
      '                                ',
      '                                ',
      '          ###                   ',
      '          ###                   ',
      ' @ ?  ^   ###   ? ^          C  ',
      '#######   #########     ########',
      '#######   #########     ########',
    ],
    boards_ki: [
      '                                ',
      '                                ',
      '                                ',
      '                                ',
      '                                ',
      '                                ',
      '        * *      * * *          ',
      ' @                          C   ',
      '#######%%%%#####%%%%%###########',
      '################    ############',
      '################################',
      '################################',
    ],
    boards_sho: [
      '                                ',
      '                                ',
      '                                ',
      '                                ',
      '                                ',
      '                           *    ',
      '                        *     C ',
      '                     *    %% ###',
      '                       %%    ###',
      '      * * * * *  o  %%       ###',
      '#####%%%%%%%%%%%####         ###',
      '#####           ####         ###',
    ],
    boards_ten: [
      '                                ',
      '                                ',
      '                                ',
      '                                ',
      '                                ',
      '                                ',
      '                                ',
      '        *   * * *   *           ',
      '                                ',
      '          o       o          C  ',
      '######%%%%%%%%%%%%%%%%%#########',
      '######                 #########',
    ],
    boards_ketsu: [
      '                                ',
      '                                ',
      '                                ',
      '                                ',
      '                *  *   *        ',
      '             *       o       F  ',
      '          *    %% %%%%%%  ######',
      '       *    %%            ######',
      '         %%               ######',
      '      %%                  ######',
      '#####                     ######',
      '#####                     ######',
    ],
    boards_sign: [
      '                                ',
      '                                ',
      '                                ',
      '                                ',
      '                                ',
      '                                ',
      '                                ',
      '                                ',
      '                                ',
      ' @ ?               ?         C  ',
      '######%%%%%%%%%%%###############',
      '######           ###############',
    ],
    wind_ki: [
      '                                ',
      '       |||||                    ',
      '       |||||                    ',
      '       |||*|                    ',
      '       |||||                    ',
      '       |||*|                    ',
      '       |||||                    ',
      '       |||*| ###                ',
      '       ||||| ###                ',
      ' @     ||||| ###             C  ',
      '################################',
      '################################',
    ],
    wind_sho: [
      '                                ',
      '                                ',
      '                       |||| * * ',
      '                       ||||=====',
      '                       ||||     ',
      '                       ||||     ',
      '       |*||*||*|       ||||     ',
      '       |||||||||       ||||     ',
      '       |||||||||       ||||     ',
      '       |||||||||   o   ||||   C ',
      '#######         #######    #####',
      '#######         #######    #####',
    ],
    wind_ten: [
      '                                ',
      '                                ',
      '                                ',
      '                                ',
      '                                ',
      '                                ',
      '       ::*::*::   :*::*::       ',
      '       ::::::::   :::::::       ',
      '       ::::::::   :::::::       ',
      '       ::::::::   :::::::    C  ',
      '#######        ###       #######',
      '#######        ###       #######',
    ],
    wind_ketsu: [
      '                                ',
      '                                ',
      '                  :::::::::     ',
      '                  ::*:::*::     ',
      '                  :::::::::  F  ',
      '                  :::::::::#####',
      '      |||||       :::::::::#####',
      '      ||*||       :::::::::#####',
      '      |||||       :::::::::#####',
      '      |||||    o  :::::::::#####',
      '######     #######         #####',
      '######     #######         #####',
    ],
    wind_sign: [
      '                                ',
      '                                ',
      '                                ',
      '                                ',
      '                                ',
      '                                ',
      '       ||||||||||               ',
      '       ||||||||||               ',
      '       ||||||||||               ',
      ' @ ?   ||||||||||  ?         C  ',
      '#######          ###############',
      '#######          ###############',
    ],
  },
  HW: 0.34, HH: 0.86, // половина ширины и рост кузнечика в клетках

  // свои участки по ручкам: план уровня, изюминка, спрятанная механика
  ownLevels(lab) {
    const c = lab.cfg, set = this.SETS[Math.round(c.twist)] || this.SETS[0], M = k => this.MAPS[set.id + '_' + k];
    const name = (k, i) => `Участок ${i + 1}: ${set.name.toLowerCase()} — ${k}`;
    let order;
    if (c.secret < 0.5) order = ['ten', 'sho', 'ki', 'ketsu'];
    else order = [['ki', 'sho', 'ten', 'ketsu'], ['sho', 'ten', 'ketsu'], ['ki', 'sho', 'sho', 'ketsu'], ['sign', 'sho', 'ten', 'ketsu'], ['ki', 'sho', 'ten', 'ketsu']][Math.round(c.plan)] || ['ki', 'sho', 'ten', 'ketsu'];
    const bare = c.secret < 0.5 || Math.round(c.plan) === 4; // без росинок-подсказок и камней
    const RU = { ki: 'ввести', sho: 'развить', ten: 'перевернуть', ketsu: 'завершить', sign: 'таблички' };
    return order.map((k, i) => {
      let rows = M(k).slice();
      if (bare) rows = rows.map(r => r.replace(/[*C]/g, ' '));
      if (i > 0) rows = rows.map(r => r.replace(/@/g, ' '));
      return { name: name(RU[k], i), map: rows.join('\n') };
    });
  },

  start(lab, scene) {
    const st = lab.state;
    Object.assign(st, { parts: [], cells: new Map(), springs: [], crumbs: [], coins: [], bugs: [], spikes: [], winds: [], signs: [], checks: [], flag: null,
      part: -1, partDeaths: 0, deaths: 0, got: 0, chain: 0, chainT: -9, dead: 0, done: false, look: 2, camY: 3, dustT: 0, signAt: -1, clean: 0, used: {}, firstTry: {}, gustOn: true });
    const set = this.SETS[Math.round(lab.cfg.twist)] || this.SETS[0];
    st.set = set;
    const list = lab.levels(this.ownLevels(lab), this.LEGEND);
    this.build(lab, scene, list);
    st.hero = this.buildHero(lab);
    lab.hero(st.hero.node);
    this.respawn(lab, true);
    this.aim(lab, 0, true);
  },

  update(lab, dt) {
    const st = lab.state, h = st.hero, c = lab.cfg;
    this.tickWorld(lab, dt);
    if (st.done) { this.animate(lab, h, dt); this.aim(lab, dt); return; }
    if (st.dead > 0) { st.dead -= dt; if (st.dead <= 0) this.respawn(lab); this.aim(lab, dt); return; }
    this.control(lab, h, lab.p1, dt);
    this.bugs(lab, dt);
    this.touch(lab, h, dt);
    this.aim(lab, dt);
    this.animate(lab, h, dt);
    this.track(lab, h);
    if (h.y < -2.5) this.die(lab, 'упал');
    if (lab.t > c.limit && !st.done) lab.gameOver('Время вышло');
    const P = st.parts[Math.max(0, st.part)];
    lab.hud('part', `Участок ${Math.max(1, st.part + 1)} из ${st.parts.length}` + (P && P.guest ? ` · уровень гостя ${P.guest}` : ''), { color: '#bff4ff', size: 16 });
    lab.hud('time', `⏱ ${lab.t.toFixed(1)} с · росинки ${st.got}` + (st.deaths ? ` · падений ${st.deaths}` : ''));
  },

  overNote(lab) {
    const st = lab.state, per = st.parts.map(p => p.deaths);
    lab.stat('смертей', st.deaths);
    lab.stat('участков', Math.max(0, st.part + (st.done ? 1 : 0)));
    return [
      st.done ? `Тропа за ${st.finish.toFixed(1)} с, падений ${st.deaths}` : `Участок ${Math.max(1, st.part + 1)} из ${st.parts.length}, падений ${st.deaths}`,
      `Падения по участкам: ${per.map(n => n || 0).join(' · ')}`,
      `Росинок ${st.got} из ${st.coins.length}`,
      lab.cfg.secret > 0 ? 'Сравни с «Без спрятанной механики»: те же участки, другой порядок' : 'Спрятанная механика выключена: новый приём — сразу над пропастью. Включи «Как задумано» и сравни.',
    ];
  },

  /* ---------- уровень из текстовых карт: участки подряд слева направо, низ карты на y = 0 ---------- */
  build(lab, scene, list) {
    const st = lab.state, T = lab.THREE;
    let ox = 0;
    list.forEach((lv, pi) => {
      const rows = lv.map.split('\n'), Hh = rows.length, Ww = Math.max(...rows.map(r => r.length));
      const part = { name: lv.name, guest: lv.guest || null, x0: ox, w: Ww, h: Hh, deaths: 0, start: null, signs: 0 };
      rows.forEach((row, r) => {
        for (let cc = 0; cc < Ww; cc++) {
          const ch = row[cc] || ' ', X = ox + cc, Y = Hh - 1 - r;
          const below = (rows[r + 1] || '')[cc], windHere = '|:'.includes(below) && '*'.includes(ch) ? below : null; // росинка в потоке не рвёт поток
          if (ch === '#') st.cells.set(X + ',' + Y, '#');
          else if (ch === '=') st.cells.set(X + ',' + Y, '=');
          else if (ch === '%') { const b = { x: X, y: Y, t: -1, gone: 0, part: pi }; st.crumbs.push(b); st.cells.set(X + ',' + Y, b); }
          else if (ch === '^' || ch === '>' || ch === '<') st.springs.push({ x: X, y: Y, dir: ch === '^' ? 0 : ch === '>' ? 1 : -1, sq: 0, part: pi });
          else if (ch === '*') st.coins.push({ x: X + 0.5, y: Y + 0.5, got: false, part: pi });
          else if (ch === 'o') st.bugs.push({ x: X + 0.5, y: Y, dir: -1, alive: true, sq: 0, vy: 0, part: pi });
          else if (ch === 'x') st.spikes.push({ x: X, y: Y });
          else if (ch === 'C') st.checks.push({ x: X + 0.5, y: Y, on: false, part: pi });
          else if (ch === '@' && pi === 0) part.start = [X + 0.5, Y];
          else if (ch === 'F') st.flag = { x: X + 0.5, y: Y };
          else if (ch === '?') st.signs.push({ x: X + 0.5, y: Y, text: st.set.signs[part.signs++ % st.set.signs.length] });
          if (ch === '|' || ch === ':' || windHere) st.winds.push({ x: X, y: Y, gust: (ch === ':' || windHere === ':') });
        }
      });
      st.parts.push(part);
      ox += Ww;
    });
    st.len = ox;
    for (const w of st.winds) st.cells.set('w' + w.x + ',' + w.y, w);
    // флаг: если в последнем участке его нет — в конце, на земле
    if (!st.flag) { const x = ox - 2; st.flag = { x: x + 0.5, y: this.groundTop(st, x, 30) }; }
    this.world(lab, scene);
    this.tiles(lab);
  },
  groundTop(st, X, fromY) { for (let y = fromY; y >= 0; y--) { const c = st.cells.get(X + ',' + (y - 1)); if (c === '#' || c === '=' || (c && c.x != null)) return y; } return 0; },
  solid(st, X, Y) { const c = st.cells.get(X + ',' + Y); return c === '#'; },
  oneway(st, X, Y) { const c = st.cells.get(X + ',' + Y); return c === '=' || (c && c.x != null && !c.gone); },

  /* ---------- управление: бег, прыжок, приземление ---------- */
  control(lab, h, p, dt) {
    const c = lab.cfg, st = lab.state, g = 32;
    const v0 = Math.sqrt(2 * g * c.jumpH);
    const want = p.x * c.run, air = h.ground ? 1 : h.fly > 0 ? 0 : 0.75;
    h.fly = Math.max(0, h.fly - dt);
    // в воздухе разгон от пружины не гасится, пока держишь в ту же сторону (инерция, как у Марио)
    const keep = !h.ground && Math.sign(h.vx) === Math.sign(p.x) && Math.abs(h.vx) > Math.abs(want);
    if (!keep) h.vx += lab.clamp(want - h.vx, -c.run * 10 * air * dt, c.run * 10 * air * dt);
    if (Math.abs(p.x) > 0.1) h.face = Math.sign(p.x);
    h.off = h.ground ? 0 : h.off + dt;
    if (h.pend != null) h.pend += dt;
    if (p.pressed.a) { if (h.ground || (h.off < 0.09 && !h.jumped)) this.jump(lab, h, v0); else h.pend = 0; }
    if (h.cut && !p.a && h.vy > 0) { h.vy *= 0.5; h.cut = false; }
    // ветер: в потоке тянет вверх; порыв дует, пока горят струи
    const w = this.windAt(st, h.x, h.y + 0.4);
    if (w && (!w.gust || st.gustOn)) { h.vy = Math.min(c.wind, h.vy + 70 * dt); if (!h.inWind) { h.inWind = true; lab.noise(0.25, 0.04, 2200); this.first(lab, 'ветер'); } } else h.inWind = false;
    h.vy = Math.max(h.vy - g * dt, -24);
    const was = h.ground;
    this.move(lab, h, h.vx * dt, h.vy * dt);
    if (h.ground && !was) this.land(lab, h, v0);
  },
  jump(lab, h, v0) {
    h.vy = v0; h.ground = null; h.jumped = true; h.cut = true; h.pend = null; h.sq = -0.35;
    lab.count('прыжки'); lab.sfx.jump();
    lab.burst([h.x - h.face * 0.2, h.y + 0.1, 0], { count: 7, colors: ['#e8f5c8', '#b9d98a'], speed: 2.4, up: 1, size: 0.14 });
  },
  land(lab, h, v0) {
    const hard = h.fallV > 14;
    h.jumped = false; h.sq = hard ? 0.42 : 0.22;
    lab.tone(hard ? 110 : 170, 0.07, 'sine', 0.1, 70);
    lab.burst([h.x, h.y + 0.05, 0], { count: hard ? 12 : 5, colors: ['#e8f5c8', '#c9b48c'], speed: hard ? 3.6 : 2.2, up: 0.5, size: 0.14 });
    if (hard) { lab.shake(0.12); lab.ring([h.x, h.y + 0.04, 0], { color: '#f6efd0', radius: 1.2, life: 0.3 }); }
    if (h.pend != null && h.pend <= 0.1) this.jump(lab, h, v0);
    h.pend = null;
  },
  // движение по осям с выталкиванием из клеток земли; мостики и доски держат только сверху
  move(lab, h, dx, dy) {
    const st = lab.state, W = this.HW, H = this.HH;
    h.x += dx;
    for (let Y = Math.floor(h.y + 0.02); Y <= Math.floor(h.y + H - 0.02); Y++) {
      for (let X = Math.floor(h.x - W); X <= Math.floor(h.x + W); X++) if (this.solid(st, X, Y)) { h.x = dx > 0 ? X - W - 0.001 : X + 1 + W + 0.001; h.vx = 0; }
    }
    h.x = Math.max(W, h.x);
    h.fallV = -h.vy; const prev = h.y; h.y += dy; h.ground = null;
    const x0 = Math.floor(h.x - W + 0.02), x1 = Math.floor(h.x + W - 0.02);
    if (dy <= 0) {
      const Y = Math.floor(h.y);
      for (let X = x0; X <= x1; X++) if (this.solid(st, X, Y) || (this.oneway(st, X, Y) && prev >= Y + 1 - 0.06)) { h.y = Y + 1; h.vy = 0; h.ground = st.cells.get(X + ',' + Y); break; }
    } else {
      const Y = Math.floor(h.y + H);
      for (let X = x0; X <= x1; X++) if (this.solid(st, X, Y)) { h.y = Y - H - 0.001; h.vy = 0; lab.tone(90, 0.05, 'square', 0.04); break; }
    }
  },
  windAt(st, x, y) { return st.cells.get('w' + Math.floor(x) + ',' + Math.floor(y)) || null; },

  /* ---------- пружины, росинки, жуки, колючки, камни, табличка, флаг ---------- */
  touch(lab, h) {
    const st = lab.state, c = lab.cfg, g = 32;
    for (const s of st.springs) {
      if (Math.abs(h.x - (s.x + 0.5)) > 0.62) continue;
      if (s.dir === 0) {
        if (h.y > s.y + 0.55 || h.y + this.HH < s.y + 0.1 || h.vy > 1) continue;
        const hi = lab.p1.a ? c.boost : c.spring;
        h.vy = Math.sqrt(2 * g * hi); h.y = s.y + 0.56; h.ground = null; h.jumped = true; h.cut = false; h.sq = -0.5;
        this.boing(lab, s, lab.p1.a);
      } else {
        if (h.y > s.y + 0.9 || h.y + this.HH < s.y + 0.1 || h.fly > 0.25) continue;
        h.vx = s.dir * c.side; h.vy = 9.5; h.fly = 0.45; h.ground = null; h.jumped = true; h.cut = false; h.face = s.dir; h.sq = -0.4;
        this.boing(lab, s, false);
      }
    }
    // росинки: подряд звенят выше
    for (const o of st.coins) {
      if (o.got || Math.abs(o.x - h.x) > 0.6 || Math.abs(o.y - (h.y + 0.45)) > 0.7) continue;
      o.got = true; st.got++; lab.count('росинки');
      st.chain = lab.t - st.chainT < 1.6 ? st.chain + 1 : 0; st.chainT = lab.t;
      lab.addScore(50 + st.chain * 10, [o.x, o.y + 0.4, 0], '#ffd23f');
      lab.tone(990 * lab.pitch(st.chain), 0.09, 'triangle', 0.07);
      lab.burst([o.x, o.y, 0], { count: 9, colors: ['#ffd23f', '#fff6b0'], speed: 3, size: 0.12 });
      lab.place(st.coinMesh, o.i, [0, -99, 0], { scale: 0 });
    }
    for (const s of st.spikes) if (h.x + this.HW > s.x + 0.15 && h.x - this.HW < s.x + 0.85 && h.y < s.y + 0.5 && h.y + this.HH > s.y) { this.die(lab, 'колючки'); return; }
    for (const k of st.checks) if (!k.on && h.x >= k.x - 0.4) {
      k.on = true; st.respawnAt = [k.x, k.y]; lab.sfx.power();
      lab.burst([k.x, k.y + 1, 0], { count: 22, colors: ['#ffe08a', '#ffffff', '#ffb547'], speed: 5, up: 3 });
      if (k.flame) { k.flame.material = lab.mat('#ffcf3f', { glow: 1.6 }); lab.pulse(k.flame, 1.8, 0.3); }
    }
    let near = -1;
    st.signs.forEach((s, i) => { if (Math.abs(s.x - h.x) < 2.2) near = i; });
    if (near !== st.signAt) { st.signAt = near; lab.hud('sign', near >= 0 ? '📜 ' + st.signs[near].text : null, { color: '#ffe08a', size: 20 }); }
    const f = st.flag;
    if (f && Math.abs(h.x - f.x) < 0.7 && h.y < f.y + 3.2 && h.y + this.HH > f.y) this.finish(lab);
  },
  boing(lab, s, high) {
    const st = lab.state;
    s.sq = 1; lab.count('пружины'); this.first(lab, s.dir ? 'боковая пружина' : 'пружина', s);
    lab.tone(high ? 330 : 260, 0.22, 'sine', 0.12, high ? 1200 : 900); lab.tone(520, 0.08, 'triangle', 0.05, 0, 0.02);
    lab.burst([s.x + 0.5, s.y + 0.6, 0], { count: high ? 16 : 10, colors: ['#ffd23f', '#ff8a8a', '#ffffff'], speed: 4, up: 2, dir: s.dir ? [s.dir, 0.4, 0] : [0, 1, 0] });
    lab.ring([s.x + 0.5, s.y + 0.05, 0], { color: '#ffd23f', radius: high ? 1.6 : 1.1, life: 0.3 });
    if (high) lab.popup([s.x + 0.5, s.y + 2, 0], 'Выше!', '#ffd23f', 20);
    st.hero.trailOn = 0.6;
  },
  // спрятанная механика считает момент, когда приём встретился впервые на безопасном месте участка «ввести»
  first(lab, what, s) {
    const st = lab.state;
    if (st.used[what]) return;
    st.used[what] = lab.t;
    const P = st.parts[Math.max(0, st.part)];
    if (P && /ввести/.test(P.name)) lab.count('_secret');
  },
  bugs(lab, dt) {
    const st = lab.state, h = st.hero, sp = lab.cfg.bug;
    for (const b of st.bugs) {
      if (!b.alive) { b.vy -= 32 * dt; b.y += b.vy * dt; if (b.node) { b.node.position.set(b.x, b.y, 0); b.node.rotation.z += dt * 8; if (b.y < -6) b.node.visible = false; } continue; }
      const under = st.cells.get(Math.floor(b.x) + ',' + (b.y - 1));
      if (under && under.x != null) { if (under.gone) { b.alive = false; b.vy = 0; lab.count('жуки упали'); continue; } if (under.t < 0) under.t = 0; } // жук ломает доску под собой
      if (!under) { b.alive = false; b.vy = 0; continue; }
      const nx = b.x + b.dir * sp * dt, ahead = Math.floor(nx + b.dir * 0.4);
      const wall = this.solid(st, ahead, b.y), floor = st.cells.get(ahead + ',' + (b.y - 1));
      if (wall || !floor || (floor.x != null && floor.gone)) b.dir *= -1; else b.x = nx;
      b.node.position.set(b.x, b.y, 0); b.node.rotation.y = b.dir > 0 ? 0 : Math.PI;
      b.legT = (b.legT || 0) + dt * 12; b.legs[0].rotation.x = Math.sin(b.legT) * 0.35; b.node.position.y = b.y + Math.abs(Math.sin(b.legT)) * 0.04;
      // прыжок сверху — победа, сбоку — урон
      if (st.dead > 0 || Math.abs(b.x - h.x) > 0.75 || h.y > b.y + 0.75 || h.y + this.HH < b.y + 0.05) continue;
      if (h.vy < 0 && h.y > b.y + 0.3) {
        b.alive = false; b.vy = 4; h.vy = 9; h.ground = null; h.jumped = true;
        lab.addScore(150, [b.x, b.y + 1, 0], '#bff4ff'); lab.count('жуки'); lab.sfx.hit(); lab.hitstop(0.05); lab.shake(0.15);
        lab.burst([b.x, b.y + 0.4, 0], { count: 14, colors: ['#8a5bd6', '#3a2a5a', '#ffffff'], speed: 4 });
      } else this.die(lab, 'жук');
    }
  },
  tickWorld(lab, dt) {
    const st = lab.state, t = lab.t, c = lab.cfg;
    // пружины разжимаются
    for (const s of st.springs) { s.sq = lab.damp(s.sq, 0, 9, dt); if (s.coil) s.coil.scale.set(1, Math.max(0.4, 1 + s.sq * (0.45 * Math.sin(t * 40) - 0.4)), 1); }
    // доски: стоишь — дрожит, через crumble секунд падает, через 3 с возвращается
    for (const b of st.crumbs) {
      const h = st.hero;
      if (b.t < 0 && !b.gone && h.ground === b) { b.t = 0; lab.tone(220, 0.05, 'square', 0.03); }
      if (b.t >= 0 && !b.gone) {
        b.t += dt; b.node.position.x = b.x + 0.5 + Math.sin(t * 60) * 0.04;
        if (b.t > c.crumble) { b.gone = 3; b.vy = 0; lab.noise(0.15, 0.06, 700); lab.burst([b.x + 0.5, b.y + 0.8, 0], { count: 6, colors: ['#c8935a', '#8a5a3c'], speed: 2, size: 0.14 }); this.first(lab, 'доска'); }
      } else if (b.gone > 0) {
        b.gone -= dt; b.vy -= 30 * dt; b.node.position.y += b.vy * dt; b.node.rotation.z += dt * 1.5;
        if (b.gone <= 0) { b.gone = 0; b.t = -1; b.node.position.set(b.x + 0.5, b.y + 0.82, 0); b.node.rotation.z = 0; b.node.scale.setScalar(0.01); lab.tween(0.25, k => b.node.scale.setScalar(Math.max(0.01, k)), 'outBack'); }
      }
    }
    // порывы: дуют часть периода; перед порывом шипит
    const per = c.gust, ph = (t % per) / per, on = ph < 0.55;
    if (on !== st.gustOn) { st.gustOn = on; if (on && st.winds.some(w => w.gust)) lab.noise(0.35, 0.05, 1800); }
    if (st.gustMat) st.gustMat.opacity = on ? 0.32 : 0.06 + (ph > 0.85 ? 0.12 * Math.sin(t * 30) : 0);
    if ((st.windT = (st.windT || 0) - dt) <= 0 && st.winds.length) {
      st.windT = 0.08;
      const w = lab.pick(st.winds); if (!w.gust || on) lab.burst([w.x + lab.rand(0.1, 0.9), w.y, lab.rand(-0.5, 0.5)], { count: 1, colors: ['#ffffff', '#d6f2ff'], speed: 0.4, up: 5, size: 0.08, life: 0.5, gravity: -3 });
    }
    st.coins.forEach(o => { if (!o.got) lab.place(st.coinMesh, o.i, [o.x, o.y + Math.sin(t * 3 + o.x) * 0.1, 0], { rot: t * 2 + o.x, scale: 0.9 }); });
    st.clouds.forEach(cl => { cl.position.x += dt * 0.5; });
    if (st.flag && st.flag.cloth) st.flag.cloth.rotation.y = Math.sin(t * 4) * 0.3;
    if (st.butter) st.butter.forEach((b, i) => { b.position.set(b.userData.x + Math.sin(t * 0.7 + i) * 2, b.userData.y + Math.sin(t * 2.3 + i) * 0.6, b.userData.z); b.rotation.y = t + i; b.scale.x = 0.6 + Math.abs(Math.sin(t * 14 + i)) * 0.6; });
  },

  /* ---------- участки, смерть, чекпоинты, финиш ---------- */
  track(lab, h) {
    const st = lab.state, i = Math.max(0, st.parts.findIndex(p => h.x >= p.x0 && h.x < p.x0 + p.w)), P = st.parts[i];
    if (i !== st.part && i > st.part) {
      if (st.part >= 0) {
        const prev = st.parts[st.part];
        if (!prev.deaths) { lab.addScore(300, [h.x, h.y + 2.2, 0], '#7cf5a8'); lab.popup([h.x, h.y + 3, 0], 'Чисто!', '#7cf5a8', 24); lab.count('чистые участки'); }
        lab.count('участки');
      }
      st.part = i; lab.level(i);
      lab.popup([h.x + 3, h.y + 3.5, 0], `Участок ${i + 1}`, '#ffffff', 26); lab.tone(523, 0.1, 'triangle', 0.06); lab.tone(784, 0.14, 'triangle', 0.06, 0, 0.08);
    }
    if (P) lab.spot('where', h.x - P.x0, P.h - (h.y + 0.45));
  },
  die(lab, why) {
    const st = lab.state, h = st.hero, P = st.parts[Math.max(0, st.part)];
    if (st.dead > 0 || st.done) return;
    st.deaths++; st.dead = 0.55; lab.count('падения');
    if (P) { P.deaths++; lab.spot('death', h.x - P.x0, Math.min(P.h - 0.5, P.h - (h.y + 0.45))); }
    h.node.visible = false; if (h.trail) h.trail.clear();
    const y = Math.max(h.y, -1.5);
    lab.burst([h.x, y + 0.5, 0], { count: 26, colors: ['#ff9f1c', '#ffe3a3', '#ffffff'], speed: 6, up: 4 });
    lab.ring([h.x, y, 0], { color: '#ff5d6e', radius: 1.6 });
    lab.tone(440, 0.3, 'sine', 0.1, 110); lab.noise(0.2, 0.08, 900);
    lab.invuln = 0; lab.hurt([h.x, y + 0.4, 0]); // урон в телеметрию партии: жизней нет (lives 0), партию кончает только время
    lab.popup([h.x, y + 1.6, 0], why === 'жук' ? 'Ай, жук!' : why === 'колючки' ? 'Колючки!' : 'Упал!', '#ff5d6e', 20);
  },
  respawn(lab, first) {
    const st = lab.state, P0 = st.parts[0];
    let at = st.respawnAt;
    if (!at) {
      if (P0 && P0.start) at = P0.start;
      else { const x = 1; at = [x + 0.5, this.groundTop(st, x, 30)]; }
      st.respawnAt = at;
    }
    st.hero = Object.assign(st.hero, { x: at[0], y: at[1] + 0.02, vx: 0, vy: 0, ground: null, off: 0, pend: null, jumped: false, cut: false, face: 1, sq: 0, fly: 0, inWind: false });
    st.hero.node.visible = true;
    if (!first) {
      lab.pulse(st.hero.pose, 1.35, 0.2);
      lab.burst([at[0], at[1] + 0.8, 0], { count: 12, colors: ['#ffffff', '#c9ff7a'], speed: 3, up: 1, size: 0.12 });
      lab.tone(660, 0.08, 'triangle', 0.07, 990);
    }
  },
  finish(lab) {
    const st = lab.state, h = st.hero, c = lab.cfg;
    if (st.done) return;
    st.done = true; st.finish = lab.t; lab.count('финиш');
    const P = st.parts[st.parts.length - 1];
    if (P && !P.deaths) { lab.addScore(300, [h.x, h.y + 2.4, 0], '#7cf5a8'); lab.count('чистые участки'); }
    lab.addScore(Math.max(0, Math.round((c.limit - lab.t) * 20)), [h.x, h.y + 3, 0], '#7cf5a8');
    lab.clear({ time: lab.t });
    for (let n = 0; n < 6; n++) lab.tone(1046 * lab.pitch(n * 2), 0.16, 'triangle', 0.07, 0, n * 0.07);
    lab.burst([st.flag.x, st.flag.y + 3, 0], { count: 60, colors: ['#ff5d6e', '#ffd23f', '#7cf5a8', '#5fe0ff', '#ffffff'], speed: 9, up: 5 });
    lab.slowmo(0.6, 0.35); lab.shake(0.25);
    if (st.flag.cloth) lab.tween(0.6, k => { st.flag.cloth.position.y = st.flag.y + 1 + k * 2; }, 'outBack');
    Object.assign(h, { vx: 0, vy: 0 });
    lab.after(0.9, () => lab.win(`Флаг! Тропа за ${st.finish.toFixed(1)} с, падений ${st.deaths}`));
  },

  /* ---------- камера: вперёд по бегу, по высоте — за последним приземлением ---------- */
  aim(lab, dt, snap) {
    const st = lab.state, h = st.hero, v = lab.view, aspect = lab.camera ? lab.camera.aspect : 16 / 9;
    v.distance = lab.clamp(12 / (Math.tan(0.4) * aspect), 15, 40); // 24 клетки тропы в ширину на любом экране
    if (h.ground) st.camY = h.y; else if (h.y > st.camY + 3.5) st.camY = h.y - 3.5; else if (h.y < st.camY - 2) st.camY = Math.max(0, h.y + 2);
    st.look = lab.damp(st.look, h.face * 2.5, 2.5, dt || 1);
    const tx = lab.clamp(h.x + st.look, 10, Math.max(10, st.len - 10)), ty = Math.max(5.2, st.camY + 3);
    v.target.x = snap ? tx : lab.damp(v.target.x, tx, Math.abs(tx - v.target.x) > 10 ? 9 : 4.5, dt);
    v.target.y = snap ? ty : lab.damp(v.target.y, ty, 3, dt);
  },

  /* ---------- клетки тропы: земля пачками копий, пружины, доски, ветер, росинки ---------- */
  tiles(lab) {
    const st = lab.state, T = lab.THREE, O = x => Object.assign({ parent: null }, x);
    const earth = [], tops = [], planks = [];
    for (const [k, v] of st.cells) {
      if (k[0] === 'w') continue;
      const [x, y] = k.split(',').map(Number);
      if (v === '#') { earth.push([x, y]); if (!this.solid(st, x, y + 1)) tops.push([x, y]); }
      if (v === '=') planks.push([x, y]);
    }
    const dirt = lab.instances(new T.BoxGeometry(1, 1, 3), lab.mat('#ffffff'), Math.max(1, earth.length));
    earth.forEach(([x, y], i) => lab.place(dirt, i, [x + 0.5, y + 0.5, 0], { color: (x * 7 + y * 13) % 5 === 0 ? '#9a6644' : y % 2 ? '#8a5a3c' : '#7d5136' }));
    // под нижней строкой — земля до самого низа, чтобы тропа не висела в воздухе
    const deep = earth.filter(([, y]) => y === 0);
    if (deep.length) { const d = lab.instances(new T.BoxGeometry(1, 6, 3), '#6a4530', deep.length); deep.forEach(([x], i) => lab.place(d, i, [x + 0.5, -3, 0])); }
    const grass = lab.instances(new T.BoxGeometry(1.02, 0.28, 3.06), lab.mat('#6cc24a'), Math.max(1, tops.length));
    tops.forEach(([x, y], i) => lab.place(grass, i, [x + 0.5, y + 0.88, 0], { color: (x + y) % 3 ? '#6cc24a' : '#7bd156' }));
    const lip = lab.instances(new T.ConeGeometry(0.12, 0.38, 4), '#4f9c3a', Math.max(1, tops.length * 2), { shadow: false });
    tops.forEach(([x, y], i) => { lab.place(lip, i * 2, [x + lab.rand(0.1, 0.9), y + 1.1, 1.3], { rot: lab.rand(0, 3) }); lab.place(lip, i * 2 + 1, [x + lab.rand(0.1, 0.9), y + 1.1, -1.2], { rot: lab.rand(0, 3) }); });
    const fl = lab.instances(new T.IcosahedronGeometry(0.1, 0), lab.mat('#ffffff', { glow: 0.15 }), Math.max(1, tops.length), { shadow: false });
    tops.forEach(([x, y], i) => { if (lab.chance(0.55)) lab.place(fl, i, [x + lab.rand(0.1, 0.9), y + 1.12, lab.chance(0.5) ? 1.25 : -1.25], { color: lab.pick(['#ff6f91', '#ffd23f', '#ffffff', '#b38cff']) }); });
    if (planks.length) { const pl = lab.instances(new T.BoxGeometry(1, 0.22, 2.2), '#c8935a', planks.length); planks.forEach(([x, y], i) => lab.place(pl, i, [x + 0.5, y + 0.89, 0])); }
    // доски с трещиной: каждая — свой меш, они падают по одной
    for (const b of st.crumbs) {
      b.node = lab.group({ at: [b.x + 0.5, b.y + 0.82, 0] });
      lab.merge([lab.box(0.98, 0.26, 2.4, '#d9a066', O({})), lab.box(0.06, 0.28, 2.42, '#5a3a22', O({ at: [lab.rand(-0.2, 0.2), 0, 0], rot: [0, 0, 0.3] }))], b.node);
    }
    // пружины: подставка, золотая спираль, красная шляпка гриба
    for (const s of st.springs) {
      const g = lab.group({ at: [s.x + 0.5, s.y, 0] });
      if (s.dir) g.rotation.z = -s.dir * Math.PI / 2, g.position.set(s.x + 0.5 - s.dir * 0.05, s.y + 0.5, 0);
      lab.merge([lab.cyl(0.42, 0.46, 0.14, '#5a3a22', O({ at: [0, s.dir ? -0.42 : 0.07, 0] }))], g);
      s.coil = lab.group({ parent: g, at: [0, s.dir ? -0.36 : 0.14, 0] });
      lab.noShadow(lab.merge([
        lab.mesh(new T.TorusGeometry(0.22, 0.05, 4, 10), lab.mat('#ffd23f', { glow: 0.3, metal: true }), O({ at: [0, 0.12, 0], rot: [Math.PI / 2, 0, 0] })),
        lab.mesh(new T.TorusGeometry(0.22, 0.05, 4, 10), lab.mat('#ffd23f', { glow: 0.3, metal: true }), O({ at: [0, 0.26, 0], rot: [Math.PI / 2, 0, 0] })),
        lab.mesh(new T.SphereGeometry(0.46, 10, 6, 0, Math.PI * 2, 0, Math.PI / 2), lab.mat('#ff5d6e', { glow: 0.25 }), O({ at: [0, 0.34, 0], scale: [1, 0.6, 1] })),
        lab.ball(0.07, '#ffffff', O({ at: [0.18, 0.52, 0.25], detail: 0 })), lab.ball(0.06, '#ffffff', O({ at: [-0.2, 0.5, 0.2], detail: 0 })),
      ], s.coil));
      s.top = true;
    }
    // ветер: прозрачные столбы потока; порывы — отдельным материалом, он мигает
    if (st.winds.length) {
      const calm = lab.mat('#d6f2ff', { alpha: 0.18, unlit: true }), gust = st.gustMat = lab.mat('#bfe9ff', { alpha: 0.3, unlit: true });
      const a = st.winds.filter(w => !w.gust), b = st.winds.filter(w => w.gust);
      if (a.length) { const m = lab.instances(new T.BoxGeometry(0.96, 0.96, 0.5), calm, a.length, { shadow: false }); a.forEach((w, i) => lab.place(m, i, [w.x + 0.5, w.y + 0.5, -0.6])); lab.noShadow(m); }
      if (b.length) { const m = lab.instances(new T.BoxGeometry(0.96, 0.96, 0.5), gust, b.length, { shadow: false }); b.forEach((w, i) => lab.place(m, i, [w.x + 0.5, w.y + 0.5, -0.6])); lab.noShadow(m); }
    }
    // росинки — одна пачка копий
    st.coinMesh = lab.instances(new T.OctahedronGeometry(0.24), lab.mat('#ffd23f', { glow: 1.2, shiny: true }), Math.max(1, st.coins.length), { shadow: false });
    st.coins.forEach((o, i) => { o.i = i; lab.place(st.coinMesh, i, [o.x, o.y, 0]); });
    if (st.spikes.length) { const sp = lab.instances(new T.ConeGeometry(0.16, 0.5, 4), lab.mat('#ff3b5c', { glow: 0.3 }), st.spikes.length * 3); st.spikes.forEach((s, i) => [0.2, 0.5, 0.8].forEach((dx, k) => lab.place(sp, i * 3 + k, [s.x + dx, s.y + 0.25, 0]))); }
    // жуки-рогачи
    for (const b of st.bugs) {
      b.node = lab.group({ at: [b.x, b.y, 0] });
      lab.merge([
        lab.ball(0.42, '#5a3a8a', O({ at: [0, 0.38, 0], scale: [1.1, 0.75, 0.9] })), lab.box(0.06, 0.36, 0.7, '#3a2560', O({ at: [0, 0.6, 0] })),
        lab.ball(0.22, '#2a1d40', O({ at: [0.42, 0.34, 0] })), lab.cone(0.07, 0.4, '#2a1d40', O({ at: [0.62, 0.6, 0.12], rot: [0, 0, -0.9], sides: 4 })), lab.cone(0.07, 0.4, '#2a1d40', O({ at: [0.62, 0.6, -0.12], rot: [0, 0, -0.9], sides: 4 })),
      ], b.node);
      lab.merge([lab.ball(0.08, '#ffffff', O({ at: [0.55, 0.42, 0.11], detail: 0 })), lab.ball(0.08, '#ffffff', O({ at: [0.55, 0.42, -0.11], detail: 0 }))], b.node);
      const legs = lab.group({ parent: b.node, at: [0, 0.2, 0] });
      lab.merge([-0.2, 0.1, 0.35].map(x => lab.box(0.05, 0.3, 0.9, '#2a1d40', O({ at: [x, -0.1, 0] }))), legs);
      b.legs = [legs];
    }
    // камни-чекпоинты: стоячий камень с огоньком
    for (const k of st.checks) {
      lab.merge([lab.box(0.5, 1.2, 0.5, '#9a9488', O({ at: [k.x, k.y + 0.6, -0.9], round: 0.1 })), lab.box(0.7, 0.18, 0.7, '#7d776c', O({ at: [k.x, k.y + 0.09, -0.9] }))]);
      k.flame = lab.ball(0.16, lab.mat('#ffb547', { glow: 0.6 }), { at: [k.x, k.y + 1.36, -0.9], shadow: false });
    }
    // таблички
    for (const s of st.signs) lab.merge([lab.box(0.08, 1.1, 0.08, '#6b4a30', O({ at: [s.x, s.y + 0.55, -0.9] })), lab.box(0.9, 0.55, 0.08, '#d9b27a', O({ at: [s.x, s.y + 1.1, -0.86] }))]);
    // флаг на шесте
    const f = st.flag;
    lab.cyl(0.06, 0.07, 3.6, '#f4f0e6', { at: [f.x, f.y + 1.8, 0] });
    lab.ball(0.16, lab.mat('#ffd23f', { glow: 1, shiny: true }), { at: [f.x, f.y + 3.66, 0] });
    f.cloth = lab.box(1.1, 0.7, 0.05, lab.mat('#7cf5a8', { glow: 0.4 }), { at: [f.x + 0.58, f.y + 1, 0] });
  },

  /* ---------- мир: луга Лаго-Наки, горы, дольмены, облака, бабочки ---------- */
  world(lab, scene) {
    const T = lab.THREE, st = lab.state, O = x => Object.assign({ parent: null }, x), L = st.len;
    // задний луг полосами и холмы
    lab.box(L + 80, 0.4, 30, '#7ac25a', { at: [L / 2, -0.6, -18], shadow: false });
    const hills = [];
    for (let i = 0; i < Math.ceil(L / 14) + 6; i++) hills.push(lab.ball(lab.rand(5, 9), i % 2 ? '#86c96a' : '#73b85a', O({ at: [-20 + i * 14 + lab.rand(-4, 4), -2.5, -16 - lab.rand(0, 6)], scale: [1.6, 0.7, 1], detail: 1 })));
    lab.noShadow(lab.merge(hills));
    // горы со снегом
    const mts = [];
    for (let i = 0; i < Math.ceil(L / 22) + 5; i++) {
      const x = -30 + i * 22 + lab.rand(-6, 6), r = lab.rand(11, 17), h = lab.rand(17, 27), z = -62 - lab.rand(0, 15);
      mts.push(lab.cone(r, h, '#6f86c4', O({ at: [x, h / 2 - 5, z], sides: 6, rot: lab.rand(0, 3) })));
      mts.push(lab.cone(r * 0.34, h * 0.34, '#f4f6ff', O({ at: [x, h - 5 - h * 0.17, z], sides: 6, rot: lab.rand(0, 3) })));
    }
    lab.noShadow(lab.merge(mts));
    // дольмены и пихты на дальнем лугу
    const P = [];
    for (let i = 0; i < Math.ceil(L / 30) + 2; i++) {
      const x = 6 + i * 30 + lab.rand(-5, 5), z = -9 - lab.rand(0, 4);
      P.push(lab.box(2.2, 1.6, 1.8, '#a49c8c', O({ at: [x, 0.8, z] })), lab.box(2.8, 0.3, 2.3, '#8d8576', O({ at: [x, 1.75, z] })), lab.box(0.6, 0.5, 0.1, '#3a3530', O({ at: [x, 0.7, z + 0.92] })));
    }
    lab.merge(P);
    const N = Math.ceil(L / 3) + 10, crown = lab.instances(new T.ConeGeometry(1, 2.4, 7), '#2e7d4a', N), trunk = lab.instances(new T.CylinderGeometry(0.15, 0.2, 1, 6), '#6b4a30', N);
    for (let i = 0; i < N; i++) { const x = -8 + i * 3 + lab.rand(-1, 1), z = -6.5 - lab.rand(0, 6), s = lab.rand(0.8, 1.5); lab.place(trunk, i, [x, 0.5 * s - 0.4, z], { scale: s }); lab.place(crown, i, [x, 1.6 * s - 0.4, z], { scale: s, rot: lab.rand(0, 3) }); }
    // облака
    st.clouds = [];
    for (let i = 0; i < Math.ceil(L / 25) + 3; i++) {
      const puffs = [[0, 0, 2.2], [1.9, -0.3, 1.6], [-1.8, -0.4, 1.5], [0.5, 0.8, 1.4]].map(([x, y, r]) => lab.ball(r, lab.mat('#ffffff', { glow: 0.1 }), O({ at: [x, y, 0], scale: [1, 0.7, 0.8] })));
      const c = lab.noShadow(lab.merge(puffs)); c.position.set(-10 + i * 25 + lab.rand(-6, 6), lab.rand(15, 21), -30 + lab.rand(-5, 5));
      st.clouds.push(c);
    }
    // бабочки над лугом
    st.butter = [];
    for (let i = 0; i < 6; i++) { const b = lab.box(0.3, 0.02, 0.22, lab.mat(lab.pick(['#ffd23f', '#ff9fd0', '#ffffff', '#9fd8ff']), { glow: 0.2 }), { at: [0, 0, 0], shadow: false }); Object.assign(b.userData, { x: 4 + i * (L / 6), y: 4 + lab.rand(0, 3), z: -2.5 }); st.butter.push(b); }
  },

  /* ---------- кузнечик Цок: тело, голова с глазами-шарами, усики, длинные задние лапы ---------- */
  buildHero(lab) {
    const O = x => Object.assign({ parent: null }, x);
    const node = lab.group(), pose = lab.group({ parent: node, scale: 1.25 }), body = lab.group({ parent: pose, at: [0, 0.32, 0] });
    lab.merge([
      lab.box(0.7, 0.36, 0.38, '#ff9f1c', O({ at: [-0.05, 0, 0], round: 0.12 })),
      lab.box(0.5, 0.18, 0.4, '#ffe3a3', O({ at: [-0.05, -0.14, 0], round: 0.06 })),
      lab.box(0.5, 0.06, 0.46, '#d9480f', O({ at: [-0.1, 0.18, 0], rot: [0, 0, 0.15] })), // крылышки
    ], body);
    const head = lab.group({ parent: body, at: [0.36, 0.14, 0] });
    lab.merge([lab.ball(0.22, '#ff9f1c', O({ detail: 1 })), lab.box(0.12, 0.04, 0.14, '#7a2e0a', O({ at: [0.18, -0.1, 0] }))], head);
    const eyes = [];
    for (const s of [-1, 1]) {
      eyes.push(lab.ball(0.11, '#ffffff', O({ at: [0.12, 0.08, s * 0.13], detail: 1 })), lab.ball(0.055, '#15151c', O({ at: [0.2, 0.09, s * 0.14], detail: 0 })),
        lab.cyl(0.015, 0.02, 0.5, '#7a2e0a', O({ at: [-0.02, 0.32, s * 0.1], rot: [s * 0.3, 0, -0.5] })));
    }
    lab.merge(eyes, head);
    // лапы: задние (прыгучие) и передние — две группы, качаются в такт бегу
    const back = lab.group({ parent: body, at: [-0.2, -0.06, 0] }), front = lab.group({ parent: body, at: [0.2, -0.12, 0] });
    lab.merge([-1, 1].flatMap(s => [lab.box(0.08, 0.5, 0.08, '#d9480f', O({ at: [0, 0.12, s * 0.2], rot: [0, 0, 0.9] })), lab.box(0.06, 0.46, 0.06, '#d9480f', O({ at: [-0.16, -0.12, s * 0.2], rot: [0, 0, -0.4] }))]), back);
    lab.merge([-1, 1].map(s => lab.box(0.05, 0.28, 0.05, '#d9480f', O({ at: [0, -0.1, s * 0.15] }))), front);
    const legs = [back, front];
    const shadow = lab.mesh(new lab.THREE.CircleGeometry(0.4, 12), lab.mat('#000000', { alpha: 0.25, unlit: true }), { rot: [-Math.PI / 2, 0, 0], shadow: false });
    lab.noShadow(shadow);
    const h = { node, pose, body, head, legs, shadow, x: 0, y: 0, vx: 0, vy: 0, face: 1, turn: 0, sq: 0, run: 0, off: 0, fly: 0, trailOn: 0 };
    h.trail = lab.trail(body, { color: '#ffd23f', width: 0.25, length: 10, glow: 1 });
    return h;
  },
  animate(lab, h, dt) {
    const st = lab.state;
    h.node.position.set(h.x, h.y, 0);
    h.turn = lab.damp(h.turn, h.face > 0 ? 0 : Math.PI, 18, dt); h.node.rotation.y = h.turn;
    h.body.rotation.z = lab.damp(h.body.rotation.z, h.ground ? 0 : lab.clamp(h.vy * 0.04, -0.5, 0.45), 14, dt);
    h.sq = lab.damp(h.sq, 0, 10, dt);
    const q = lab.juicy('squash') ? h.sq : 0;
    h.pose.scale.set(1 + q * 0.5, 1 - q, 1 + q * 0.3);
    const sp = Math.abs(h.vx); h.run += dt * sp * 3;
    h.legs.forEach((l, i) => { l.rotation.z = h.ground ? Math.sin(h.run + i * 1.6) * 0.5 * Math.min(1, sp / 3) : (i % 2 ? 0.5 : -0.7); });
    h.head.rotation.z = Math.sin(lab.t * 3) * 0.05;
    const gy = this.groundTop(st, Math.floor(h.x), Math.floor(h.y + 0.5));
    h.shadow.position.set(h.x, gy + 0.03, 0); h.shadow.scale.setScalar(Math.max(0.3, 1 - (h.y - gy) * 0.12));
    h.trailOn = Math.max(0, h.trailOn - dt);
    if (h.trail && !h.trailOn) h.trail.clear();
    if (h.ground && sp > 4.5 && (st.dustT -= dt) <= 0) { st.dustT = 0.12; lab.burst([h.x - Math.sign(h.vx) * 0.35, h.y + 0.05, 0], { count: 2, colors: ['#e8f5c8', '#c9b48c'], speed: 1.2, up: 0.6, size: 0.11, life: 0.35 }); }
  },
};
