// «Ещё разок» — ремейк-донор урока 25 по мотивам кликеров, ежедневных наград и «сундуков» (Cookie Clicker, мобильные игры), оболочка «Лаб3D 1.0».
// План.
// Фраза: ты — пасечник, ты жмёшь на улей, и пчёлы несут мёд, но игра делает всё, чтобы ты не остановился. Цель — заметить, как она это делает.
// Ядро на 3 секунды: пробел → пчёлы вылетают, капля мёда, +N, бочка наполняется → «ещё разок».
// Выбор, оплаченный очками: купить пчелу-помощницу (мёд сам) или большие соты (больше за нажатие), рискнуть кристаллами на сундук.
// Угрозы здесь — не враги, а приёмы игры против игрока: семь тёмных паттернов, каждый — своя ручка:
//   страх упустить (таймер «только 10 секунд»), серия, которая сгорает, сундук-лутбокс с «почти выиграл», искусственное ожидание за кристаллы,
//   давление через выдуманных друзей, путаница двух валют, нет точки остановки (огромная «Ещё разок» и стыдящая «Хватит»).
// Кривая партии: первые 10 секунд — честный кликер; потом паттерны по очереди каждые 12 секунд, к третьей минуте все сразу.
// События: нажатие (пчёлы, капля, звук выше в серии), покупка (улей растёт), таймер (красная мигалка), сундук (колесо, «почти!»),
// серия (огонёк, «сгорит!»), ожидание (пчёлы спят), друг (уведомление сбоку), «Хватит» (стыдящее окно).
// Охота (ручка hunt): 100 секунд, паттерны идут по одному, B — «📸 Поймал!»; мимо — минус 5 секунд. Счётчики «поймал: …» — для шага портала.
// Спрятанная механика — тёмные паттерны (ручка secret 0 — честная версия: медовый час по расписанию, серия не сгорает, шансы сундука видны,
// отдых короткий и бесплатный, только настоящий рекорд класса, одна валюта, цель «полная бочка» и честное «можно отдохнуть»).
// Разбор игр жанра — docs/журнал/модуль-6.md, раздел урока 25.
// Лицо игры: пасека на закате, тёплый мёд и холодные кристаллы; приёмы — кнопки-ловушки ярче и крупнее честных, красная мигалка таймера,
// колесо сундука встаёт у джекпота. Палитра: мёд #ffb547, улей #e8a33c, кристалл #7fd8ff, тревога #ff3b5c, честно #7cf5a8, трава #6fae4a.
const GAME = {
  engine: 'three',
  title: 'Ещё разок',
  subtitle: 'Жми на улей и собирай мёд. Попробуй остановиться, когда захочешь.',
  donor: 'кликеры, ежедневные награды и «сундуки»',
  players: 1,
  lives: 0,
  controls: [
    { input: 'a', text: 'нажать на улей' },
    { input: 'b', text: 'купить / принять (в охоте — «Поймал!»)' },
    { input: 'move4', text: '← → выбрать улучшение, держи ↓ — хватит' },
  ],
  camera: { type: 'iso', tilt: 0.7, target: [0, 1, 0.6] },
  field: { w: 20, h: 13 },
  sky: ['#3a2a6a', '#ffb06a'],
  fog: 0.01,
  accent: '#ffb547',
  scoreColor: '#ffb547',
  decisions: [
    'Чувство: «ещё разок» — и прошло двадцать минут',
    'Честность: в честной версии каждая цена, шанс и время видны заранее',
    'Выбор: пчела-помощница, большие соты или сундук за кристаллы',
  ],
  config: {
    secret: { value: 1, min: 0, max: 1, step: 1, label: 'Спрятанная механика: тёмные паттерны', restart: true, hint: '0 — честная версия: каждый паттерн заменён честным приёмом' },
    hunt: { value: 0, min: 0, max: 1, step: 1, label: 'Охота за тёмными паттернами (B — «Поймал!»)', restart: true, names: ['нет', 'да'] },
    p_fomo: { value: 1, min: 0, max: 1, step: 1, label: 'Паттерн: страх упустить (таймер)', restart: true },
    p_streak: { value: 1, min: 0, max: 1, step: 1, label: 'Паттерн: серия, которая сгорает', restart: true },
    p_box: { value: 1, min: 0, max: 1, step: 1, label: 'Паттерн: сундук с «почти выиграл»', restart: true },
    p_wait: { value: 1, min: 0, max: 1, step: 1, label: 'Паттерн: ожидание за кристаллы', restart: true },
    p_friends: { value: 1, min: 0, max: 1, step: 1, label: 'Паттерн: выдуманные друзья', restart: true },
    p_gems: { value: 1, min: 0, max: 1, step: 1, label: 'Паттерн: путаница двух валют', restart: true },
    p_noexit: { value: 1, min: 0, max: 1, step: 1, label: 'Паттерн: нет точки остановки', restart: true },
    gap: { value: 12, min: 6, max: 30, step: 1, label: 'Секунд между паттернами' },
    limit: { value: 180, min: 60, max: 900, step: 30, label: 'Длина партии, с (урок не бесконечен)' },
    goal: { value: 2500, min: 500, max: 10000, step: 250, label: 'Полная бочка (цель в честной версии)' },
  },
  presets: {
    'Новичок': { gap: 16 },
    'Без спрятанной механики': { secret: 0 },
    'Честная': { secret: 0 },
    'Злая': { secret: 1 },
    'Охота': { hunt: 1 },
    'Только таймер': { p_streak: 0, p_box: 0, p_wait: 0, p_friends: 0, p_gems: 0, p_noexit: 0 },
    'Только сундук': { p_fomo: 0, p_streak: 0, p_wait: 0, p_friends: 0, p_gems: 0, p_noexit: 0 },
    'Только серия': { p_fomo: 0, p_box: 0, p_wait: 0, p_friends: 0, p_gems: 0, p_noexit: 0 },
    'Только друзья': { p_fomo: 0, p_streak: 0, p_box: 0, p_wait: 0, p_gems: 0, p_noexit: 0 },
  },
  notes: [
    'Друзья в уведомлениях выдуманы: это и есть паттерн. В честной версии — только настоящий рекорд класса.',
    'Игровой «день» — 25 секунд, чтобы серия и ежедневный подарок случились на уроке.',
  ],
  PATTERNS: [
    { id: 'fomo', name: 'Страх упустить', honest: 'Медовый час по расписанию: видно, когда следующий' },
    { id: 'streak', name: 'Серия сгорает', honest: 'Серия ждёт: пропуск не наказывается' },
    { id: 'box', name: 'Сундук «почти!»', honest: 'Шансы видны, награда известна заранее' },
    { id: 'wait', name: 'Ожидание за деньги', honest: 'Короткий отдых, обходить его не за что' },
    { id: 'friends', name: 'Выдуманные друзья', honest: 'Только настоящий рекорд класса' },
    { id: 'gems', name: 'Две валюты', honest: 'Одна валюта, цена понятна' },
    { id: 'noexit', name: 'Нет остановки', honest: 'Цель и честное «можно отдохнуть»' },
  ],
  UPGRADES: [
    { id: 'bee', name: 'Пчела-помощница', cost: 40, k: 1.55, what: '+1 мёд в секунду' },
    { id: 'comb', name: 'Большие соты', cost: 25, k: 1.6, what: '+1 за нажатие' },
    { id: 'meadow', name: 'Цветочная поляна', cost: 300, k: 2.4, what: 'всё ×1,5' },
  ],
  FRIENDS: ['Аслан', 'Мадина', 'Тимур', 'Залина', 'Азамат'],

  start(lab, scene) {
    const st = lab.state, c = lab.cfg, evil = c.secret > 0;
    const on = id => (evil ? c['p_' + id] > 0 : false);
    Object.assign(st, {
      evil, hunt: c.hunt > 0, on, honey: 0, total: 0, gems: evil ? 5 : 0, perTap: 1, perSec: 0, mult: 1, owned: { bee: 0, comb: 0, meadow: 0 }, sel: 0,
      energy: 30, sleep: 0, streak: 0, ev: null, evT: 4, order: [], caught: {}, falseT: 0, taps: 0, pulls: 0, stopAsk: 0, huntLeft: 100, done: false, dayT: 0, day: 1, notes: [],
    });
    const ids = this.PATTERNS.map(p => p.id).filter(id => st.hunt ? on(id) || !evil : on(id));
    st.order = st.hunt ? ids.slice().sort(() => lab.rand(-1, 1)) : ids;
    if (st.hunt && !evil) st.order = [];
    this.world(lab);
    lab.hero(st.hive);
  },

  update(lab, dt) {
    const st = lab.state, c = lab.cfg, p = lab.p1;
    this.animate(lab, dt);
    if (st.done) return;
    // пассивный мёд от пчёл
    if (st.perSec > 0) this.gain(lab, st.perSec * st.mult * dt, false);
    // энергия пчёл: ожидание — паттерн или честный короткий отдых
    if (st.sleep > 0) { st.sleep -= dt; if (st.sleep <= 0) { st.energy = 30; lab.popup(st.hive.position, 'Пчёлы проснулись', '#7cf5a8', 18); } }
    if (p.pressed.a) this.tap(lab);
    if (p.pressed.left) { st.sel = (st.sel + 2) % 3; lab.tone(500, 0.04, 'triangle', 0.03); }
    if (p.pressed.right) { st.sel = (st.sel + 1) % 3; lab.tone(500, 0.04, 'triangle', 0.03); }
    if (p.pressed.b) this.pressB(lab);
    // «Хватит» — держать ↓ секунду: случайное нажатие не заканчивает партию
    st.downT = p.down ? (st.downT || 0) + dt : 0;
    if (st.downT > 1) { st.downT = -99; this.stop(lab); }
    if (!p.down && st.downT < 0) st.downT = 0;
    // день — 25 секунд: ежедневный подарок
    st.dayT += dt;
    if (st.dayT > 25 && !st.hunt) { st.dayT = 0; st.day++; this.daily(lab); }
    // события-паттерны по очереди
    this.events(lab, dt);
    if (st.hunt) { st.huntLeft -= dt; if (st.huntLeft <= 0) this.finish(lab, 'Охота окончена'); }
    else if (lab.t > c.limit) this.finish(lab, `Прошло ${Math.round(c.limit / 60 * 10) / 10} мин. Что у тебя осталось, кроме цифр?`);
    if (!st.evil && st.total >= c.goal && !st.hunt) this.finish(lab, 'Бочка полна! Ты молодец — можно отдохнуть', true);
    this.hudLines(lab);
  },

  overNote(lab) {
    const st = lab.state, mins = Math.round(lab.t / 6) / 10;
    lab.stat('ещё разок', st.pulls);
    lab.stat('секунд в игре', Math.round(lab.t));
    if (st.hunt) {
      const got = Object.keys(st.caught), all = st.order.length;
      return [`Поймано паттернов: ${got.length} из ${all}`, got.length < all ? 'Не пойманы: ' + st.order.filter(id => !st.caught[id]).map(id => this.P(id).name).join(', ') : 'Все до одного!', 'Переверни карты в портале — на обороте честная замена.'];
    }
    return [`В игре: ${String(mins).replace('.', ',')} мин · нажатий: ${st.taps} · клюнул на крючок: ${st.pulls}`,
      st.evil ? 'Игра семью приёмами держала тебя у улья. Сколько из них ты заметил?' : 'Честная версия: цели, шансы и время видны. Остановиться было легко?'];
  },
  P(id) { return this.PATTERNS.find(p => p.id === id); },

  /* ---------- мёд ---------- */
  tap(lab) {
    const st = lab.state, ev = st.ev;
    if (st.sleep > 0) { lab.popup(st.hive.position, st.evil && st.on('wait') ? 'Пчёлы спят… 💎3 — разбудить (B)' : 'Пчёлы отдыхают', '#bfe9ff', 16); lab.tone(160, 0.06, 'square', 0.03); return; }
    st.taps++; lab.count('нажатия');
    const mul = ev && ev.id === 'fomo' && st.evil ? 3 : ev && ev.id === 'fomo-honest' ? 2 : 1;
    if (mul > 1 && !ev.used) { ev.used = true; st.pulls++; lab.count('_secret'); lab.count('ещё разок'); }
    this.gain(lab, st.perTap * st.mult * mul, true);
    lab.pulse(st.hiveBody, 1.12, 0.1);
    lab.tone(330 * lab.pitch(st.taps % 8), 0.05, 'triangle', 0.04);
    lab.burst([lab.rand(-0.6, 0.6), 2.6, lab.rand(-0.4, 0.4)], { count: 6, colors: ['#ffb547', '#ffe08a'], speed: 3, up: 3, size: 0.18 });
    if (st.hunt) return; // в охоте пчёлы не устают: паттерны идут по расписанию
    if (st.evil && st.on('wait')) { st.energy--; if (st.energy <= 0) { st.sleep = 20; this.startEvent(lab, 'wait', 8); } }
    else if (!st.evil) { st.energy--; if (st.energy <= 0) { st.sleep = 4; st.energy = 30; lab.popup(st.hive.position, 'Пчёлы отдыхают 4 секунды — отдохни и ты', '#7cf5a8', 16); } }
  },
  gain(lab, n, show) {
    const st = lab.state;
    st.honey += n; st.total += n;
    lab.score = Math.round(st.total);
    if (show) lab.popup([lab.rand(-1, 1), 3.4, 0], '+' + Math.round(n), '#ffe08a', 16 + Math.min(14, n));
  },
  price(u) { return Math.round(u.cost * Math.pow(u.k, this._st.owned[u.id])); },
  pressB(lab) {
    const st = lab.state, ev = st.ev;
    if (st.hunt) { this.catchIt(lab); return; }
    if (ev && ev.b) { ev.b(); return; }
    if (st.sleep > 0 && st.evil && st.on('wait')) { this.payWake(lab); return; }
    const u = this.UPGRADES[st.sel], cost = this.price(u);
    if (st.honey < cost) { lab.popup([this.standX(st.sel), 2.6, 3.2], `Нужно 🍯${cost}`, '#ff8a8a', 16); lab.tone(150, 0.08, 'square', 0.04); return; }
    st.honey -= cost; st.owned[u.id]++; lab.count('покупки');
    if (u.id === 'bee') st.perSec += 1; else if (u.id === 'comb') st.perTap += 1; else st.mult *= 1.5;
    lab.sfx.coin(); lab.burst([this.standX(st.sel), 1.5, 3.2], { count: 18, colors: ['#ffd23f', '#ffffff'], speed: 4, up: 3 });
    st.hiveBody.scale.multiplyScalar(1.02);
    if (u.id === 'bee') this.addBee(lab);
  },
  payWake(lab) {
    const st = lab.state;
    if (st.gems >= 3) { st.gems -= 3; st.sleep = 0; st.energy = 30; st.pulls++; lab.count('_secret'); lab.count('ещё разок'); lab.count('кристаллы потрачены', 3); lab.popup(st.hive.position, 'Разбудил за 💎3', '#7fd8ff', 18); lab.sfx.power(); }
    else { lab.popup(st.hive.position, 'Не хватает 💎 — купи в лавке!', '#ff8a8a', 18); }
  },
  daily(lab) {
    const st = lab.state;
    if (st.evil && st.on('streak')) { this.startEvent(lab, 'streak', 6); return; }
    st.streak++; st.gems += st.evil ? 2 : 0;
    this.gain(lab, 20 * st.streak, false);
    lab.popup([0, 4, 0], st.evil ? `Ежедневный подарок · серия ${st.streak}` : `Подарок дня: 🍯${20 * st.streak} (серия не сгорает)`, '#ffe08a', 18);
  },
  stop(lab) {
    const st = lab.state;
    if (st.evil && st.on('noexit') && !st.hunt) {
      st.stopAsk++;
      if (st.stopAsk === 1) { this.startEvent(lab, 'noexit', 6); lab.popup([0, 4, 0], '😢 Уже уходишь? Пчёлы будут скучать… (держи ↓ ещё раз)', '#ff8ad0', 18); st.pulls++; lab.count('ещё разок'); lab.count('_secret'); return; }
    }
    this.finish(lab, st.evil ? 'Ты всё-таки остановился' : 'Хватит — честно. Ты молодец, можно отдохнуть', !st.evil);
  },
  finish(lab, text, good) {
    const st = lab.state; if (st.done) return;
    st.done = true;
    if (st.hunt) { const n = Object.keys(st.caught).length; lab.addScore(n * 150 + Math.max(0, Math.round(st.huntLeft)) * 3, [0, 4, 0], '#7cf5a8'); }
    for (let i = 0; i < 4; i++) lab.after(i * 0.12, () => lab.burst([lab.rand(-4, 4), 3, lab.rand(-2, 2)], { count: 14, colors: ['#ffb547', '#7cf5a8', '#ffffff'], speed: 6, up: 4 }));
    if (good) lab.win(text); else lab.gameOver(text);
  },

  /* ---------- паттерны: злая и честная версия ---------- */
  events(lab, dt) {
    const st = lab.state, c = lab.cfg;
    if (st.ev) { st.ev.left -= dt; if (st.ev.left <= 0) this.endEvent(lab); return; }
    st.evT -= dt;
    if (st.evT > 0) return;
    st.evT = st.hunt ? 4 : c.gap;
    if (st.hunt) { const next = st.order.find(id => !st.caught[id] && !(st.shown || {})[id]) || st.order.find(id => !st.caught[id]); if (next) { st.shown = Object.assign(st.shown || {}, { [next]: true }); this.startEvent(lab, next, 8); } return; }
    if (st.evil) { const list = st.order.filter(id => id !== 'streak' && id !== 'wait' && id !== 'noexit'); if (list.length) this.startEvent(lab, list[(st.k = (st.k || 0) + 1) % list.length], 8); }
    else this.startEvent(lab, lab.pick(['fomo-honest', 'box-honest', 'record-honest']), 8);
  },
  startEvent(lab, id, sec) {
    const st = lab.state, ev = { id, left: sec, b: null };
    st.ev = ev;
    const at = [0, 4.2, 0];
    switch (id) {
      case 'fomo': lab.sfx.warn(); lab.shake(0.08); break;
      case 'fomo-honest': lab.popup(at, 'Медовый час: мёд ×2 · следующий — через минуту', '#7cf5a8', 18); break;
      case 'streak':
        ev.b = () => { st.streak++; st.gems += 2; this.gain(lab, 30 * st.streak, true); st.pulls++; lab.count('_secret'); lab.count('ещё разок'); lab.popup(at, `Серия ${st.streak} спасена! 🔥`, '#ffd23f', 22); lab.sfx.power(); this.endEvent(lab); };
        ev.miss = () => { if (st.streak) lab.popup(at, `💔 Серия ${st.streak} сгорела`, '#ff8a8a', 22); st.streak = 0; lab.sfx.lose(); };
        break;
      case 'box':
        ev.b = () => { if (st.gems < 5) { lab.popup(at, 'Нужно 💎5 — обменяй мёд!', '#ff8a8a', 18); return; } st.gems -= 5; st.pulls++; lab.count('_secret'); lab.count('ещё разок'); lab.count('сундуки'); lab.count('кристаллы потрачены', 5); this.spin(lab, true); this.endEvent(lab); };
        break;
      case 'box-honest': ev.b = () => { if (st.honey < 100) { lab.popup(at, 'Нужно 🍯100', '#ffffff', 16); return; } st.honey -= 100; this.spin(lab, false); this.endEvent(lab); }; break;
      case 'wait': ev.b = () => this.payWake(lab); break;
      case 'friends': lab.tone(880, 0.08, 'sine', 0.05); lab.tone(1175, 0.1, 'sine', 0.05, 0, 0.1); ev.who = lab.pick(this.FRIENDS); break;
      case 'gems': ev.b = () => { if (st.honey < 37) { lab.popup(at, 'Нужно 🍯37', '#ffffff', 16); return; } st.honey -= 37; st.gems += 1; st.pulls++; lab.count('_secret'); lab.count('ещё разок'); lab.popup(at, '+💎1 (а сколько это в мёде?)', '#7fd8ff', 18); }; break;
      case 'noexit': break;
      default: break;
    }
    lab.count('паттерны');
  },
  endEvent(lab) { const ev = lab.state.ev; if (ev && ev.miss && ev.left <= 0) ev.miss(); lab.state.ev = null; lab.hud('ev', null); lab.hud('ev2', null); },
  catchIt(lab) {
    const st = lab.state, ev = st.ev;
    if (ev && this.P(ev.id) && !st.caught[ev.id]) {
      st.caught[ev.id] = true; lab.count('поймал: ' + this.P(ev.id).name); lab.count('поймано');
      lab.popup([0, 4.6, 0], `📸 Поймал: ${this.P(ev.id).name}!`, '#7cf5a8', 26); lab.sfx.coin(); lab.flash('#ffffff', 0.25);
      lab.burst([0, 4, 0], { count: 30, colors: ['#7cf5a8', '#ffffff'], speed: 7, up: 3 });
      st.ev = null; lab.hud('ev', null); lab.hud('ev2', null); st.evT = 2.5;
      if (st.order.every(id => st.caught[id])) lab.after(0.8, () => this.finish(lab, 'Все тёмные паттерны пойманы!', true));
    } else { st.huntLeft -= 5; lab.popup([0, 4.6, 0], 'Мимо: это не паттерн · −5 с', '#ff8a8a', 20); lab.tone(140, 0.12, 'square', 0.05); lab.count('мимо'); }
  },
  spin(lab, nearMiss) {
    const st = lab.state, w = st.wheel;
    w.visible = true; w.scale.setScalar(0.01);
    lab.tween(0.3, k => w.scale.setScalar(Math.max(0.01, k)), 'outBack');
    const end = nearMiss ? Math.PI * 2 * 5 + 0.32 : Math.PI * 2 * 4 + lab.rand(0, 6.28);
    lab.tween(2.2, k => { w.rotation.z = end * k; lab.state.spinK = k; }, 'outCubic');
    for (let i = 0; i < 14; i++) lab.after(i * 0.15 * (1 + i * 0.06), () => lab.tone(700, 0.03, 'square', 0.03));
    lab.after(2.3, () => {
      const prize = nearMiss ? lab.pick([5, 10, 15]) : lab.pick([50, 100, 150, 200]);
      this.gain(lab, prize, true);
      lab.popup([0, 5, 0], nearMiss ? 'ЧУТЬ-ЧУТЬ НЕ ДЖЕКПОТ! Ещё разок?' : `Сундук: 🍯${prize} (шансы были видны)`, nearMiss ? '#ff5d6e' : '#7cf5a8', 22);
      if (nearMiss) lab.shake(0.1);
      lab.after(1.4, () => { lab.tween(0.3, k => w.scale.setScalar(Math.max(0.01, 1 - k)), 'inQuad'); lab.after(0.32, () => { w.visible = false; }); });
    });
  },

  /* ---------- экран ---------- */
  hudLines(lab) {
    const st = lab.state, ev = st.ev, U = this.UPGRADES, u = U[st.sel];
    lab.hud('honey', `🍯 ${Math.floor(st.honey)}` + (st.evil && st.on('gems') ? `   💎 ${st.gems}` : st.evil ? `   💎 ${st.gems}` : ''), { color: '#ffd23f', size: 22 });
    lab.hud('up', `← → ${u.name}: ${u.what} · 🍯${this.price(u)} · B — купить` + (st.hunt ? '' : ''), { color: '#ffe8c2', size: 13 });
    if (st.hunt) lab.hud('hunt', `📸 Охота: поймано ${Object.keys(st.caught).length} из ${st.order.length} · ⏱ ${Math.max(0, Math.ceil(st.huntLeft))} с · B — «Поймал!»`, { color: '#7cf5a8', size: 16 });
    else lab.hud('hunt', st.evil && st.on('noexit') ? 'держи ↓ хватит' : `Держи ↓ — хватит · цель: 🍯${lab.cfg.goal} (${Math.min(100, Math.round(st.total / lab.cfg.goal * 100))}%)`, { color: st.evil && st.on('noexit') ? '#6a5a7a' : '#b9f5cf', size: st.evil && st.on('noexit') ? 10 : 14 });
    if (st.sleep > 0) lab.hud('sleep', st.evil && st.on('wait') ? `😴 Пчёлы устали! Ждать ${Math.ceil(st.sleep)} с … или 💎3 — СРАЗУ (B)` : `🌙 Отдых пчёл ${Math.ceil(st.sleep)} с`, { color: st.evil && st.on('wait') ? '#ff8a8a' : '#7cf5a8', size: 15 }); else lab.hud('sleep', null);
    if (!ev) return;
    const blink = Math.sin(lab.t * 14) > 0;
    switch (ev.id) {
      case 'fomo': lab.hud('ev', `🔥 ТОЛЬКО ${Math.ceil(ev.left)} СЕКУНД: МЁД ×3!!! ЖМИ!`, { color: blink ? '#ff3b5c' : '#ffd23f', size: 22 }); lab.hud('ev2', 'Не успеешь — потеряешь навсегда!', { color: '#ffb3b3', size: 13 }); break;
      case 'fomo-honest': lab.hud('ev', `🍯 Медовый час: ×2 ещё ${Math.ceil(ev.left)} с · по расписанию каждую минуту`, { color: '#7cf5a8', size: 16 }); break;
      case 'streak': lab.hud('ev', `📅 День ${st.day}! Серия ${st.streak} 🔥 сгорит через ${Math.ceil(ev.left)} с — жми B!`, { color: blink ? '#ff5d6e' : '#ffd23f', size: 20 }); break;
      case 'box': lab.hud('ev', `🎁 СУНДУК УДАЧИ за 💎5! Джекпот 💎💎💎 рядом! (B)`, { color: blink ? '#ffd23f' : '#ff8ad0', size: 20 }); lab.hud('ev2', 'Шансы? Не скажем 😉', { color: '#c8b0d0', size: 11 }); break;
      case 'box-honest': lab.hud('ev', `🎁 Сундук за 🍯100: 50–200 мёда, шансы равные (B)`, { color: '#7cf5a8', size: 16 }); break;
      case 'wait': lab.hud('ev', `⚡ Разбудить пчёл за 💎3 — без ожидания! (B)`, { color: blink ? '#ff8a4c' : '#ffd23f', size: 18 }); break;
      case 'friends': lab.hud('ev', `😈 ${ev.who} обогнал тебя на 340 мёда! Верни своё!`, { color: '#ff8ad0', size: 18 }); break;
      case 'record-honest': lab.hud('ev', `🏆 Рекорд класса — настоящий, из портала. Играй сколько хочешь`, { color: '#bfe9ff', size: 14 }); break;
      case 'gems': lab.hud('ev', `💎 ВЫГОДНО: 1 кристалл = 37 мёда! Купи (B)`, { color: blink ? '#7fd8ff' : '#ffffff', size: 18 }); lab.hud('ev2', 'А сундук стоит 💎5. Это сколько мёда? Посчитай…', { color: '#9fb8d0', size: 11 }); break;
      case 'noexit': lab.hud('ev', `[ ЕЩЁ РАЗОК! ]   ←  нет, я не люблю мёд`, { color: '#ff3b5c', size: 24 }); break;
      default: break;
    }
  },
  standX(i) { return -8 + i * 3; },
  addBee(lab) {
    const st = lab.state, b = lab.ball(0.22, lab.mat('#ffd23f', { glow: 0.5 }), { shadow: false, detail: 0 });
    st.bees.push({ m: b, r: lab.rand(2, 3.6), s: lab.rand(1, 2.2), h: lab.rand(1.5, 4), ph: lab.rand(0, 6) });
  },
  world(lab) {
    const T = lab.THREE, st = lab.state, O = x => Object.assign({ parent: null }, x);
    this._st = st;
    lab.ground({ w: 110, h: 90, color: '#6fae4a', bumps: 1.4, flat: 0.5 });
    // улей: ярусы, летки, крыша
    st.hive = lab.group({ at: [0, 0, 0] });
    st.hiveBody = lab.group({ parent: st.hive });
    lab.merge([
      lab.cyl(1.6, 1.8, 1, '#e8a33c', O({ at: [0, 0.5, 0], sides: 10 })), lab.cyl(1.5, 1.65, 1, '#f0b44c', O({ at: [0, 1.5, 0], sides: 10 })),
      lab.cyl(1.35, 1.5, 0.9, '#e8a33c', O({ at: [0, 2.45, 0], sides: 10 })), lab.cone(1.6, 1, '#b8742c', O({ at: [0, 3.4, 0], sides: 10 })),
      lab.box(0.6, 0.3, 0.2, '#3a2010', O({ at: [0, 0.7, 1.72] })),
    ], st.hiveBody);
    lab.merge([lab.box(3.6, 0.2, 3.6, '#8a5a2c', O({ at: [0, -0.05, 0] }))], st.hive);
    st.bees = [];
    for (let i = 0; i < 4; i++) this.addBee(lab);
    // бочка мёда справа: наполняется
    st.barrel = lab.group({ at: [6.5, 0, -0.5] });
    lab.mesh(new T.CylinderGeometry(1.15, 1.05, 2.4, 12, 1, true), lab.mat('#8a5a2c', { side: 'double' }), { parent: st.barrel, at: [0, 1.2, 0] });
    lab.merge([lab.cyl(1.2, 1.2, 0.14, '#3a2a1a', O({ at: [0, 0.5, 0], sides: 12 })), lab.cyl(1.22, 1.22, 0.14, '#3a2a1a', O({ at: [0, 1.9, 0], sides: 12 }))], st.barrel);
    st.fill = lab.cyl(1, 1, 1, lab.mat('#ffb547', { glow: 0.35 }), { parent: st.barrel, at: [0, 0.05, 0], sides: 12 });
    st.fill.scale.y = 0.02;
    // лавка улучшений слева: три постамента
    st.stands = this.UPGRADES.map((u, i) => {
      const g = lab.group({ at: [this.standX(i), 0, 3.2] });
      lab.merge([lab.box(2.2, 0.6, 1.6, '#fffbe8', O({ at: [0, 0.3, 0], round: 0.1 }))], g);
      if (u.id === 'bee') lab.merge([lab.ball(0.4, '#ffd23f', O({ at: [0, 1, 0], detail: 1 })), lab.box(0.5, 0.06, 0.3, '#ffffff', O({ at: [0, 1.4, 0] }))], g);
      else if (u.id === 'comb') lab.merge([lab.cyl(0.55, 0.55, 0.3, '#ffb547', O({ at: [0, 0.8, 0], rot: [Math.PI / 2, 0, 0], sides: 6 }))], g);
      else lab.merge([lab.cone(0.5, 0.9, '#4fc35a', O({ at: [0, 1.05, 0], sides: 6 })), lab.ball(0.2, '#ff6f91', O({ at: [0.3, 1.1, 0.2], detail: 0 })), lab.ball(0.2, '#ffffff', O({ at: [-0.3, 1.2, -0.1], detail: 0 }))], g);
      const ring = lab.mesh(new T.RingGeometry(1.3, 1.5, 24), lab.mat('#ffd23f', { glow: 1, unlit: true, side: 'double' }), { parent: g, at: [0, 0.05, 0], rot: [-Math.PI / 2, 0, 0], shadow: false });
      return { g, ring };
    });
    // колесо сундука — появляется над ульем
    st.wheel = lab.group({ at: [0, 5.6, 1] });
    const seg = n => [...Array(n).keys()];
    seg(8).forEach(i => lab.mesh(new T.CircleGeometry(1.8, 6, i * Math.PI / 4, Math.PI / 4), lab.mat(['#ffd23f', '#5a6380', '#b49bff', '#5a6380', '#ffd23f', '#5a6380', '#b49bff', '#5a6380'][i], { unlit: true, side: 'double', glow: i % 4 === 0 ? 0.6 : 0 }), { parent: st.wheel, shadow: false }));
    lab.mesh(new T.ConeGeometry(0.25, 0.6, 4), lab.mat('#ffffff', { unlit: true }), { parent: null, at: [2.1, 5.6, 1], rot: [0, 0, Math.PI / 2], shadow: false });
    st.wheel.visible = false;
    // мир: цветы, ульи соседей, горы
    const fl = lab.instances(new T.IcosahedronGeometry(0.17, 0), lab.mat('#ffffff', { glow: 0.2 }), 160, { shadow: false });
    for (let i = 0; i < 160; i++) { const a = lab.rand(0, 6.28), r = lab.rand(5, 26); lab.place(fl, i, [Math.cos(a) * r * 1.3, 0.14, Math.sin(a) * r * 0.9], { color: lab.pick(['#ff6f91', '#ffd23f', '#ffffff', '#b38cff', '#ff9f43']) }); }
    const small = lab.instances(new T.CylinderGeometry(0.6, 0.7, 1.2, 8), '#e0a040', 10), roofs = lab.instances(new T.ConeGeometry(0.75, 0.5, 8), '#a4652b', 10);
    for (let i = 0; i < 10; i++) { const x = -14 + i * 3.1, z = -9 - (i % 2) * 1.5; lab.place(small, i, [x, 0.6, z]); lab.place(roofs, i, [x, 1.45, z]); }
    const mts = [];
    for (let i = 0; i < 8; i++) { const a = -1.1 + i * 0.3, r = lab.rand(10, 15), h = lab.rand(12, 20), x = Math.sin(a) * 58, z = -44 - Math.cos(a) * 8; mts.push(lab.cone(r, h, '#6a5a9a', O({ at: [x, h / 2 - 2, z], sides: 6 })), lab.cone(r * 0.35, h * 0.35, '#ffe8d0', O({ at: [x, h - 2 - h * 0.17, z], sides: 6 }))); }
    lab.noShadow(lab.merge(mts));
    const NT = 24, crown = lab.instances(new T.ConeGeometry(1.2, 3, 7), '#2e6d4a', NT), trunk = lab.instances(new T.CylinderGeometry(0.2, 0.26, 1.2, 6), '#6b4a30', NT);
    for (let i = 0; i < NT; i++) { const a = lab.rand(Math.PI * 1.05, Math.PI * 1.95), r = lab.rand(20, 30), x = Math.cos(a) * r * 1.2, z = Math.sin(a) * r * 0.7 - 3, s = lab.rand(0.8, 1.3); lab.place(trunk, i, [x, 0.6 * s, z], { scale: s }); lab.place(crown, i, [x, 2.2 * s, z], { scale: s, rot: lab.rand(0, 3) }); }
  },
  animate(lab, dt) {
    const st = lab.state, t = lab.t;
    if (!st.hive) return;
    st.bees.forEach((b, i) => { const a = t * b.s + b.ph, sleep = st.sleep > 0; b.m.position.set(Math.cos(a) * b.r, sleep ? 0.4 + i * 0.02 : b.h + Math.sin(t * 3 + i) * 0.3, Math.sin(a) * b.r * 0.7); });
    st.hiveBody.rotation.y = Math.sin(t * 1.3) * 0.03;
    const k = Math.min(1, (st.total % lab.cfg.goal) / lab.cfg.goal + (st.total >= lab.cfg.goal && !st.evil ? 1 : 0));
    st.fill.scale.y = lab.damp(st.fill.scale.y, Math.max(0.02, k * 2.3), 6, dt); st.fill.position.y = st.fill.scale.y / 2;
    st.stands.forEach((s, i) => { s.ring.visible = i === st.sel; s.g.position.y = i === st.sel ? 0.15 + Math.sin(t * 5) * 0.05 : 0; });
  },
};
