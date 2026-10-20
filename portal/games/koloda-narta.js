// «Колода нарта» — ремейк-донор урока 12 по мотивам механики Slay the Spire, на оболочке «Лаб3D 1.0» (three.js).
// Карточный бой в трёхмерной диораме: нарт Сосруко на каменной площадке у дольмена против иныжей и их свиты.
// Рука из карт, энергия на ход, над каждым врагом — его намерение на следующий ход. Бои подряд, потом босс, после боя — карта в колоду.
// Лучшие игры жанра, из которых взяты моменты (разбор — docs/журнал/модуль-3.md, урок 12):
//   Slay the Spire — намерение врага над головой: знаешь, что он сделает, и решаешь, бить или закрываться; сброс и перетасовка колоды;
//                    после боя одна из трёх карт в колоду (или пропустить); число урона на карте уже учитывает силу;
//   Dicey Dungeons — кубики бросаются ДО решения и кладутся в карты: случай есть, но ход всё равно решаешь ты (вариация «Кубики»);
//   XCOM — шанс попадания: случай ПОСЛЕ решения, «95 % и мимо» (вариация «Шанс попадания»);
//   Hearthstone — мана растёт каждый ход: в начале боя ходы маленькие, к концу — большие (вариация «Растущая мана»);
//   Into the Breach — всё известно заранее, видна и следующая рука (вариация «Всё видно»);
//   «Тетрис» с мешком — все карты колоды выйдут по кругу, прежде чем колода перетасуется (родственник «мешка» из урока 2).
// Ход игрока собран по шести шагам ощущения: карта поднимается → летит → нарт делает выпад → дуга меча → враг белеет и отлетает → число урона.
// Ось Z в three.js смотрит на игрока: площадка с бойцами — дальше (−Z), рука карт — ближе к нам (+Z). Нарт слева (−X), враги справа (+X).
/* ПЛАН
   Фраза игры: ты — нарт Сосруко, ты бьёшься картами на каменной площадке у дольмена против иныжей, но рука приходит случайно,
   а враг каждый ход показывает, что сделает. Цель — пройти бои и босса, не потеряв здоровье.
   Ядро на 3 секунды: ← → выбрал карту → A — карта летит, нарт делает выпад, дуга меча, враг белеет, «−6» всплывает.
   Выбор, оплаченный очками: ударить или закрыться (щит против намерения ⚔ 12); добить врага до его удара или держать щит;
   какую карту из трёх взять после боя — тяжёлый удар, защиту или силу; кого бить первым — осу или иныжа.
   Угрозы: волк (бьёт каждый ход), иныж со щитом (то закрывается, то бьёт), иныж-копилка (копит и бьёт на 16), осы (много мелких ударов),
   босс (своя схема ходов: камнебой копит силу, ледник морозит энергию, царица зовёт ос).
   Кривая партии: бой 1 — один волк (учимся), бой 2 — щит и оса (выбор цели), бой 3 — копилка и волк (щит против удара 16),
   отдых у костра между боями, потом босс; дальше второй круг — иныжи злее. Таймер хода: стоять нельзя.
   События: выбор карты, удар, блок, сила, добор, перетасовка, «Закрыл щитом!», «Добил до удара!», «Идеальный ход!», смерть врага,
   победа в бою, награда, отдых, босс, мороз, рой ос, время вышло, смерть нарта.
   Лицо игры: вечер у дольмена — лиловое небо, оранжевый закат, тёплые жаровни на площадке, холодные синие щиты нарта.
   Палитра: небо #2b1d5c → #ff9a5e, камень площадки #9c8f84, нарт #2d55d6 с золотом #ffd36b, опасность #ff5a3c, щит #5fb8ff, награда #ffd23f.
   Свет: тёплое низкое солнце ключом, лиловое небо заполняющим. Три фирменных приёма: пузырь намерения над каждым врагом (цвет — что сделает),
   карты-плашки веером у края, которые летят в цель; огненная дуга меча и синий шестигранный щит перед нартом.
*/
const GAME = {
  engine: 'three',
  title: 'Колода нарта',
  subtitle: 'Карточный бой у дольмена: враг показывает, что сделает, а ты собираешь лучший ход из руки. Tab — вариации: кубики, шанс попадания, растущая мана и ещё девять.',
  donor: 'Slay the Spire',
  players: 1,
  pace: 'turns', // пошаговая: бот-плейтестер не считает ожидание хода ошибкой
  lives: 0, // здоровье нарта — своя полоска, сердечки оболочки не нужны
  controls: [
    { input: 'move4', text: '← → карта, ↑ ↓ враг-цель' },
    { input: 'a', text: 'сыграть карту' },
    { input: 'b', text: 'закончить ход' },
  ],
  camera: { type: 'iso', tilt: 0.9, target: [0, 0, 0.6], fov: 0.7 },
  field: { w: 15.5, h: 12.5 },
  shadowSize: 12,
  sky: ['#2b1d5c', '#ff9a5e'],
  fog: 0.011,
  accent: '#ffd36b',
  scoreColor: '#ffd23f',
  decisions: [
    'Чувство: «я всё рассчитал» — рука сложилась, атака врага закрыта щитом, а последний удар добил его до его хода',
    'Честность: над врагом видно, что он сделает и на сколько; число на карте уже учитывает силу; таймер хода виден песочными часами',
    'Выбор: бить или закрываться, кого бить первым, какую карту взять в колоду после боя',
  ],
  config: {
    secret: { value: 1, min: 0, max: 1, step: 1, label: 'Спрятанная механика: когда случай', hint: '1 — случай только в раздаче, карта делает ровно то, что написано, намерения видны; 0 — после хода кубик решает силу карты, намерения скрыты', names: ['после решения', 'до решения'] },
    hand: { value: 5, min: 3, max: 7, step: 1, label: 'Карт в руке' },
    energy: { value: 3, min: 1, max: 6, step: 1, label: 'Энергии на ход' },
    hpHero: { value: 60, min: 20, max: 150, step: 5, label: 'Здоровье нарта', restart: true },
    enemyHp: { value: 100, min: 50, max: 200, step: 10, label: 'Здоровье врагов, %', restart: true },
    enemyDmg: { value: 100, min: 50, max: 200, step: 10, label: 'Урон врагов, %' },
    fights: { value: 3, min: 1, max: 5, step: 1, label: 'Боёв до босса', restart: true },
    turnTime: { value: 25, min: 0, max: 60, step: 5, label: 'Время на ход, с', hint: 'песочные часы: по нулю ход кончается сам; 0 — без таймера' },
    heal: { value: 6, min: 0, max: 30, step: 2, label: 'Отдых у костра между боями, здоровья' },
    think: { value: 0.75, min: 0.3, max: 1.5, step: 0.05, label: 'Враг действует, с' },
    deck: { value: 0, min: 0, max: 2, step: 1, label: 'Стартовая колода', restart: true, names: ['колода нарта', 'колода кузнеца', 'колода пасечника'], hint: 'как разные герои Slay the Spire: кузнец — щиты и тяжёлые удары, пасечник — рой мелких ударов' },
    boss: { value: 0, min: 0, max: 2, step: 1, label: 'Босс', restart: true, names: ['Иныж-камнебой', 'Иныж-ледник', 'Царица ос'] },
    dice: { value: 0, min: 0, max: 1, step: 1, label: 'Вариация: кубики на картах', hint: 'как Dicey Dungeons: на каждой карте кубик, виден до хода и множит силу карты', names: ['нет', 'да'] },
    hit: { value: 0, min: 0, max: 100, step: 5, label: 'Вариация: шанс попадания, %', hint: 'как XCOM: удар может промахнуться, узнаешь после хода; 0 — выключено' },
    hidden: { value: 0, min: 0, max: 1, step: 1, label: 'Вариация: скрытые намерения', hint: 'враг не показывает, что сделает', names: ['нет', 'да'] },
    bag: { value: 1, min: 0, max: 1, step: 1, label: 'Перетасовка как мешок', hint: '1 — все карты колоды выйдут по кругу, потом сброс перетасуется; 0 — каждая карта наугад из всей колоды', names: ['наугад', 'мешок'] },
    mana: { value: 0, min: 0, max: 1, step: 1, label: 'Вариация: растущая мана', hint: 'как Hearthstone: энергии на ходу боя 1, 2, 3… до «энергии на ход» + 2', names: ['нет', 'да'] },
    foresee: { value: 0, min: 0, max: 1, step: 1, label: 'Вариация: видна следующая рука', hint: 'как Into the Breach: всё известно заранее', names: ['нет', 'да'] },
  },
  presets: {
    'Новичок': { hpHero: 90, enemyHp: 80, enemyDmg: 75, turnTime: 40, heal: 14 },
    'Без спрятанной механики': { secret: 0 },
    'Кубики': { dice: 1 },
    'Шанс попадания': { hit: 70 },
    'Скрытые намерения': { hidden: 1 },
    'Без перетасовки': { bag: 0 },
    'Растущая мана': { mana: 1 },
    'Всё видно': { foresee: 1 },
    'Колода кузнеца': { deck: 1 },
    'Колода пасечника': { deck: 2 },
    'Босс: Иныж-ледник': { boss: 1 },
    'Босс: Царица ос': { boss: 2 },
  },
  // имя вариации и её правило для строки HUD и экрана конца партии: все включённые ручки вариаций
  VARIANTS: [
    { on: c => Math.round(c.secret) === 0, name: 'Без спрятанной механики', like: 'кубик после решения', how: () => 'после хода кубик решает силу карты, намерения врагов скрыты' },
    { on: c => c.dice >= 1, name: 'Кубики', like: 'Dicey Dungeons', how: () => 'на каждой карте кубик: виден до хода и множит силу' },
    { on: c => c.hit > 0, name: 'Шанс попадания', like: 'XCOM', how: c => `удар попадает с шансом ${Math.round(c.hit)} % — узнаешь после хода` },
    { on: c => c.hidden >= 1, name: 'Скрытые намерения', like: 'старые JRPG', how: () => 'враг не показывает, что сделает' },
    { on: c => c.bag < 1, name: 'Без перетасовки', like: '«Тетрис» без мешка', how: () => 'карта приходит наугад из всей колоды — бывает пять ударов подряд' },
    { on: c => c.mana >= 1, name: 'Растущая мана', like: 'Hearthstone', how: c => `энергии на ходу боя 1, 2, 3… до ${Math.round(c.energy) + 2}` },
    { on: c => c.foresee >= 1, name: 'Всё видно', like: 'Into the Breach', how: () => 'видна и следующая рука' },
    { on: c => Math.round(c.deck) === 1, name: 'Колода кузнеца', like: 'другой герой Slay the Spire', how: () => 'больше щитов и тяжёлых ударов' },
    { on: c => Math.round(c.deck) === 2, name: 'Колода пасечника', like: 'другой герой Slay the Spire', how: () => 'рой мелких ударов: сила бьёт каждым' },
    { on: c => Math.round(c.boss) === 1, name: 'Босс: Иныж-ледник', like: 'другой босс акта', how: () => 'закрывается льдом, бьёт на 20 и морозит энергию' },
    { on: c => Math.round(c.boss) === 2, name: 'Босс: Царица ос', like: 'другой босс акта', how: () => 'зовёт ос: бить их или царицу' },
  ],
  notes: [
    'Число на карте уже с силой и кубиком: что написано, то и случится (кроме вариаций со случаем после решения)',
    'Таймер хода — песочные часы у колоды: по нулю ход кончается сам, иначе бездействие не проигрывало бы',
    'После победы над боссом начинается второй круг: иныжи злее, партия идёт на рекорд',
    'Вариация «Без перетасовки» сделана как «Тетрис» без мешка: карта приходит наугад из всей колоды, а не кончается',
  ],

  TILT: 0.9, // наклон камеры: карты ставятся лицом к ней
  HAND: { y: 1.05, z: 4.35 },
  HERO_AT: [-4.4, 0, -0.5],
  DRAW_AT: [-6.5, 0, 4.2],
  DISC_AT: [6.5, 0, 4.2],
  FACES: [0, 0.5, 1, 1, 1.5, 2], // кубик после решения: в среднем ×1, бывает промах и двойная сила
  CARDS: {
    udar: { name: 'Удар', cost: 1, type: 'atk', dmg: 6, icon: 'sword' },
    zashita: { name: 'Защита', cost: 1, type: 'def', block: 5, icon: 'shield' },
    ogon: { name: 'Огненный меч', cost: 2, type: 'atk', dmg: 7, all: true, icon: 'flame' },
    tlepsh: { name: 'Щит Тлепша', cost: 2, type: 'def', block: 12, icon: 'shield2' },
    dvoinoi: { name: 'Двойной удар', cost: 1, type: 'atk', dmg: 5, hits: 2, icon: 'sword2' },
    yarost: { name: 'Ярость', cost: 1, type: 'pow', str: 2, icon: 'fist' },
    kamen: { name: 'Камень дольмена', cost: 2, type: 'atk', dmg: 8, block: 8, icon: 'stone' },
    dobor: { name: 'Добор', cost: 0, type: 'skl', draw: 2, icon: 'cards' },
    rog: { name: 'Рог нарта', cost: 0, type: 'skl', gain: 1, icon: 'bolt' },
    molot: { name: 'Молот Тлепша', cost: 2, type: 'atk', dmg: 14, icon: 'hammer' },
    nakoval: { name: 'Наковальня', cost: 1, type: 'def', block: 7, icon: 'anvil' },
    zhalo: { name: 'Жало', cost: 1, type: 'atk', dmg: 3, hits: 2, icon: 'bee' },
    roy: { name: 'Рой пчёл', cost: 1, type: 'atk', dmg: 2, hits: 3, icon: 'bees' },
    med: { name: 'Мёд', cost: 1, type: 'skl', heal: 5, block: 3, icon: 'heart' },
  },
  DECKS: [
    ['udar', 'udar', 'udar', 'udar', 'zashita', 'zashita', 'zashita', 'zashita', 'ogon', 'tlepsh'],
    ['udar', 'udar', 'udar', 'zashita', 'zashita', 'zashita', 'nakoval', 'nakoval', 'molot', 'tlepsh'],
    ['zhalo', 'zhalo', 'zhalo', 'zhalo', 'zashita', 'zashita', 'zashita', 'roy', 'roy', 'med'],
  ],
  REWARDS: ['dvoinoi', 'yarost', 'kamen', 'dobor', 'rog', 'molot', 'roy', 'med', 'tlepsh', 'ogon', 'nakoval', 'zhalo'],
  TYPE_COL: { atk: ['#d8443a', '#7a1a26'], def: ['#2f7fe0', '#163a7c'], pow: ['#e3a422', '#7a4a10'], skl: ['#2fae6c', '#145a3a'] },
  // враги: ходы по кругу (волк — наугад), у каждого своё поведение
  FOES: {
    volk: { name: 'Серый волк', hp: 20, model: 'wolf', moves: [{ atk: 6 }, { atk: 3, hits: 2 }, { atk: 7 }], random: true },
    shchit: { name: 'Иныж со щитом', hp: 28, model: 'shield', moves: [{ def: 10 }, { atk: 9 }, { atk: 5, def: 6 }] },
    kop: { name: 'Иныж-копилка', hp: 34, model: 'club', moves: [{ charge: 1 }, { atk: 16 }, { def: 6 }] },
    osa: { name: 'Оса', hp: 10, model: 'wasp', moves: [{ atk: 3, hits: 2 }] },
  },
  BOSSES: [
    { name: 'Иныж-камнебой', hp: 100, model: 'boss0', moves: [{ atk: 12 }, { atk: 6, def: 10 }, { str: 3 }, { atk: 5, hits: 3 }] },
    { name: 'Иныж-ледник', hp: 110, model: 'boss1', moves: [{ def: 16 }, { atk: 20 }, { atk: 6, frost: 1 }] },
    { name: 'Царица ос', hp: 80, model: 'boss2', moves: [{ summon: 2 }, { atk: 4, hits: 3 }, { def: 8 }, { atk: 10 }] },
  ],
  FIGHTS: [['volk'], ['shchit', 'osa'], ['kop', 'volk'], ['osa', 'osa', 'osa'], ['kop', 'shchit']],

  // ---------- новая партия ----------
  start(lab, scene) {
    const st = lab.state, cfg = lab.cfg;
    Object.assign(st, { phase: 'boot', t: 0, fight: 0, round: 1, wins: 0, turns: 0, fightTurns: [], cardsPlayed: 0, perfect: 0, streak: 0, bestStreak: 0,
      incomingTotal: 0, blockedTotal: 0, rolls: 0, misses: 0, luckTurns: 0, shuffles: 0, timeouts: 0, uid: 1, sel: 0, tgt: 0, repeat: 0, hitN: 0,
      hand: [], draw: [], discard: [], enemies: [], str: 0, frost: 0, frostNext: 0, energy: 0, maxE: 0, clock: 0, tick: 0, banner: false,
      deck: this.DECKS[Math.round(cfg.deck)].slice(), cam: null, punch: 0 });
    st.hero = { hp: cfg.hpHero, max: cfg.hpHero, block: 0 };
    this.assets(lab);
    this.scenery(lab);
    this.buildLife(lab);
    this.buildHero(lab);
    this.buildTable(lab);
    const v = lab.view;
    st.cam = { d: v.distance, k: 1, last: v.distance, tx: v.target.x, tz: v.target.z };
    lab.hero(st.heroG);
    if (!lab.playing) this.poster(lab);
  },

  update(lab, dt) {
    const st = lab.state;
    if (st.phase === 'boot') { this.unposter(lab); this.beginFight(lab, 0); }
    if (!st.banner) { // имя вариации и её правило крупно в начале партии
      st.banner = true;
      const v = this.variant(lab);
      lab.popup(lab.v3(0, 3.4, 0), v.name, '#ffe680', 32);
      lab.after(0.4, () => lab.popup(lab.v3(0, 2.6, 0.5), v.how, '#ffffff', 17));
    }
    st.t -= dt;
    if (st.phase === 'intro' && st.t <= 0) this.startTurn(lab);
    else if (st.phase === 'player') this.playerInput(lab, dt);
    else if (st.phase === 'resolve' && st.t <= 0) this.afterCard(lab);
    else if (st.phase === 'enemy' && st.t <= 0) this.enemyStep(lab);
    else if (st.phase === 'won' && st.t <= 0) this.showRewards(lab);
    else if (st.phase === 'reward') this.rewardInput(lab, dt);
    this.layoutHand(lab, dt);
    this.layoutRewards(lab, dt);
    this.animateUnits(lab, dt);
    this.animateWorld(lab, dt);
    this.updateCamera(lab, dt);
    this.hudLines(lab);
  },

  variant(lab) {
    const cfg = lab.cfg, on = this.VARIANTS.filter(v => v.on(cfg));
    if (!on.length) return { name: 'Колода нарта', like: 'Slay the Spire', how: 'враг показывает, что сделает, — собери из руки лучший ход' };
    return { name: on.map(v => v.name).join(' + '), like: on.map(v => v.like).join(', '), how: on.map(v => v.how(cfg)).join('; ') };
  },
  secretOn(lab) { return Math.round(lab.cfg.secret) === 1; },
  intentsSeen(lab) { return this.secretOn(lab) && lab.cfg.hidden < 1; },

  hudLines(lab) {
    const st = lab.state, cfg = lab.cfg, h = st.hero, v = this.variant(lab), fights = Math.round(cfg.fights);
    const boss = st.fight >= fights;
    lab.hud('rule', `${v.name}: ${v.how}`, { color: '#ffe680', size: 13 });
    lab.hud('fight', (st.round > 1 ? `Круг ${st.round} · ` : '') + (boss ? `Босс: ${this.BOSSES[Math.round(cfg.boss)].name}` : `Бой ${st.fight + 1} из ${fights}`) + (st.turnInFight ? ` · ход ${st.turnInFight}` : ''), { color: '#ffffff', size: 15 });
    lab.hud('hp', `❤ ${Math.max(0, h.hp)} / ${h.max}` + (h.block ? ` · 🛡 ${h.block}` : '') + (st.str ? ` · сила +${st.str}` : '') + ` · ⚡ ${st.energy} / ${st.maxE}`, { color: h.hp <= h.max * 0.3 ? '#ff6b5a' : '#9dffb0', size: 18 });
    lab.hud('deck', cfg.bag >= 1 ? `Колода ${st.draw.length} · сброс ${st.discard.length} · всего ${st.deck.length}` : `Колода: ${st.deck.length} карт, каждая наугад`, { color: '#e8d8ff', size: 13 });
    const mine = st.phase === 'player';
    lab.hud('clock', mine && cfg.turnTime > 0 ? `⏳ ${Math.max(0, Math.ceil(st.clock))} с` : null, { color: st.clock <= 5 ? '#ff5a3c' : '#ffd36b', size: st.clock <= 5 ? 22 : 16 });
    const c = mine ? st.hand[st.sel] : null;
    lab.hud('card', c ? this.describe(lab, c) : st.phase === 'enemy' ? 'Ход врагов…' : null, { color: '#ffffff', size: 15 });
    const can = mine && st.hand.some(x => this.cost(lab, x) <= st.energy);
    lab.hud('hint', mine && !can ? (st.hand.length ? 'Карт по силам нет — B, закончить ход' : 'Рука пуста — B, закончить ход') : null, { color: '#ff9f6a', size: 16 });
    lab.hud('streak', st.streak >= 2 ? `Идеальные ходы подряд ×${st.streak}` : null, { color: '#ffd23f', size: 16 });
    if (st.phase === 'reward') lab.hud('card', `Награда: выбери карту в колоду · A — взять, B — пропустить · ${Math.max(0, Math.ceil(st.clock))} с`, { color: '#ffd23f', size: 16 });
  },

  overNote(lab) {
    const st = lab.state, v = this.variant(lab), out = [`Вариация: ${v.name} (как ${v.like}) — ${v.how}`];
    const avg = st.fightTurns.length ? (st.fightTurns.reduce((a, b) => a + b, 0) / st.fightTurns.length).toFixed(1) : '—';
    out.push(`Боёв выиграно: ${st.wins} · ходов на бой: ${avg} · урон заблокирован: ${this.blockedPct(st)} %`);
    out.push(`Идеальных ходов: ${st.perfect}` + (st.bestStreak >= 2 ? ` · лучшая серия ×${st.bestStreak}` : '') + ` · сыграно карт: ${st.cardsPlayed}`);
    if (!this.secretOn(lab) || lab.cfg.hit > 0) out.push(`Случай после решения: бросков ${st.rolls}, промахов ${st.misses} — кубик менял силу карт в ${st.luckTurns} ходах из ${st.turns}`);
    else out.push(`Случай был только в раздаче` + (lab.cfg.bag >= 1 ? ` (перетасовок: ${st.shuffles})` : '') + `: каждая карта делала ровно то, что написано`);
    if (st.timeouts) out.push(`Ход закончился по таймеру: ${st.timeouts} раз`);
    return out;
  },
  blockedPct(st) { return st.incomingTotal ? Math.round(100 * st.blockedTotal / st.incomingTotal) : 0; },
  stats(lab) {
    const st = lab.state;
    lab.stat('победы', st.wins);
    lab.stat('ходов на бой', st.fightTurns.length ? Math.round(10 * st.fightTurns.reduce((a, b) => a + b, 0) / st.fightTurns.length) / 10 : 0);
    lab.stat('урон заблокирован, %', this.blockedPct(st));
    lab.stat('колода', `${st.deck.length} карт`);
  },

  // ---------- карты: цена, сила, описание ----------
  cost(lab, c) { return this.CARDS[c.id].cost; },
  // что карта сделает сейчас: с силой и кубиком «до решения»
  values(lab, c) {
    const d = this.CARDS[c.id], st = lab.state, k = c.die ? c.die / 3.5 : 1;
    const sc = x => (x ? Math.max(0, Math.round(x * k)) : 0);
    return { dmg: d.dmg ? sc(d.dmg + st.str) : 0, hits: d.hits || 1, block: sc(d.block), heal: sc(d.heal), str: d.str || 0, draw: d.draw || 0, gain: d.gain || 0 };
  },
  describe(lab, c) {
    const d = this.CARDS[c.id], x = this.values(lab, c), p = [];
    if (x.dmg) p.push(`${x.dmg}${x.hits > 1 ? ' × ' + x.hits : ''} урона ${d.all ? 'всем врагам' : 'цели'}`);
    if (x.block) p.push(`щит ${x.block}`);
    if (x.heal) p.push(`здоровье +${x.heal}`);
    if (x.str) p.push(`сила +${x.str} до конца боя`);
    if (x.draw) p.push(`возьми ${x.draw} карты`);
    if (x.gain) p.push(`энергия +${x.gain}`);
    let s = `${d.name} (⚡${d.cost}): ${p.join(', ')}`;
    if (c.die) s += ` · кубик ${c.die}`;
    if (lab.cfg.hit > 0 && d.type === 'atk') s += ` · попадёт с шансом ${Math.round(lab.cfg.hit)} %`;
    if (!this.secretOn(lab)) s += ' · силу решит кубик после хода';
    return s;
  },

  // ---------- бой ----------
  beginFight(lab, idx) {
    const st = lab.state, cfg = lab.cfg, fights = Math.round(cfg.fights);
    st.fight = idx;
    const boss = idx >= fights;
    st.enemies.forEach(e => this.removeEnemy(lab, e, true));
    st.enemies = [];
    const list = boss ? [null] : this.FIGHTS[idx % this.FIGHTS.length];
    list.forEach((k, i) => lab.after(0.15 + i * 0.22, () => this.spawnEnemy(lab, k ? this.FOES[k] : this.BOSSES[Math.round(cfg.boss)], boss)));
    st.turnInFight = 0; st.str = 0; st.frost = 0; st.frostNext = 0; st.hero.block = 0; st.energy = 0; st.maxE = 0;
    this.clearHand(lab, true);
    st.discard = []; st.draw = this.shuffle(lab, st.deck.map(id => ({ id, uid: st.uid++ })));
    st.phase = 'intro'; st.t = 0.6 + list.length * 0.22 + (boss ? 0.8 : 0.3);
    lab.count('бои');
    const at = lab.v3(2.6, 3.6, -0.6);
    if (boss) {
      lab.after(0.3, () => { lab.popup(at, `Босс: ${this.BOSSES[Math.round(cfg.boss)].name}`, '#ff6a4a', 30); lab.sfx.warn(); lab.shake(0.35); });
      st.punch = 1;
    } else lab.popup(at, (st.round > 1 ? `Круг ${st.round} · ` : '') + `Бой ${idx + 1}`, '#ffffff', 26);
    lab.tone(196, 0.2, 'triangle', 0.08); lab.tone(294, 0.25, 'triangle', 0.07, 0, 0.12);
  },
  roundMul(lab) { const r = lab.state.round - 1; return { hp: (1 + 0.4 * r) * lab.cfg.enemyHp / 100, dmg: (1 + 0.25 * r) * lab.cfg.enemyDmg / 100 }; },
  spawnEnemy(lab, def, boss, at, quiet) {
    const st = lab.state, M = this.roundMul(lab), hp = Math.max(1, Math.round(def.hp * M.hp));
    const e = { def, hp, max: hp, block: 0, str: 0, mi: 0, boss, uid: st.uid++, lx: 0, kx: 0, bob: lab.rand(0, 6), dead: false };
    this.buildEnemy(lab, e);
    st.enemies.push(e);
    this.slotEnemies(lab);
    e.x = at ? at[0] : e.sx; e.z = at ? at[2] : e.sz;
    e.g.position.set(e.x, quiet ? 0 : 6, e.z);
    this.pickIntent(lab, e, true);
    if (quiet) return e;
    lab.tween(0.45, k => { e.g.position.y = (1 - k) * 6; }, 'outBounce');
    lab.after(0.4, () => { lab.ring([e.x, 0.05, e.z], { color: '#ffb36b', radius: boss ? 2.6 : 1.4 }); lab.burst([e.x, 0.3, e.z], { count: 14, colors: ['#c9b79c', '#8a7e75'], speed: 4, up: 3 }); lab.noise(0.1, 0.06, 500); if (boss) lab.shake(0.4); });
    return e;
  },
  // места врагов: справа от нарта, сдвигаются, когда кто-то пал
  slotEnemies(lab) {
    const E = lab.state.enemies.filter(e => !e.dead), n = E.length;
    const xs = n <= 1 ? [3.2] : n === 2 ? [2.0, 4.7] : n === 3 ? [1.5, 3.4, 5.3] : [1.1, 2.6, 4.1, 5.6];
    E.forEach((e, i) => { e.sx = xs[i] || 5.6; e.sz = e.boss ? -0.3 : n >= 3 ? (i % 2 ? -1.4 : -0.5) : -0.8; });
  },
  pickIntent(lab, e, first) {
    const m = e.def.moves;
    if (e.def.random) e.intent = lab.pick(m);
    else { if (!first) e.mi = (e.mi + 1) % m.length; e.intent = m[e.mi]; }
    e.sig = null;
  },
  // сколько на самом деле ударит враг одним ударом
  hitOf(lab, e) { return e.intent && e.intent.atk ? Math.max(0, Math.round((e.intent.atk + e.str) * this.roundMul(lab).dmg)) : 0; },
  incoming(lab) { return lab.state.enemies.filter(e => !e.dead).reduce((a, e) => a + this.hitOf(lab, e) * (e.intent.hits || 1), 0); },

  startTurn(lab) {
    const st = lab.state, cfg = lab.cfg;
    st.turnInFight++; st.turns++; lab.count('ходы');
    st.hero.block = 0;
    const base = Math.round(cfg.energy);
    st.maxE = Math.max(0, (cfg.mana >= 1 ? Math.min(st.turnInFight, base + 2) : base) - st.frostNext);
    if (st.frostNext) lab.popup(lab.v3(this.HERO_AT[0], 3.2, this.HERO_AT[2]), `Мороз: −${st.frostNext} энергии`, '#9fe6ff', 18);
    st.frostNext = 0; st.energy = st.maxE;
    st.planned = this.incoming(lab); st.tookDmg = 0; st.luck = false; st.hitN = 0;
    this.drawCards(lab, Math.round(cfg.hand));
    st.sel = 0;
    this.fixTarget(lab);
    st.phase = 'player'; st.clock = cfg.turnTime; st.tick = Math.ceil(cfg.turnTime);
    lab.tone(523, 0.08, 'triangle', 0.06); lab.tone(784, 0.12, 'triangle', 0.06, 0, 0.08);
    lab.popup(lab.v3(0, 2.6, 2.4), 'Твой ход', '#9dd8ff', 20);
    lab.pulse(st.energyG, 1.2, 0.2);
  },
  drawCards(lab, n) {
    const st = lab.state, cfg = lab.cfg;
    let got = 0;
    for (let k = 0; k < n && st.hand.length < 10; k++) {
      let c;
      if (cfg.bag >= 1) {
        if (!st.draw.length) {
          if (!st.discard.length) break;
          st.draw = this.shuffle(lab, st.discard); st.discard = [];
          st.shuffles++; lab.count('перетасовки');
          lab.popup(lab.v3(this.DRAW_AT[0] + 1, 1.8, this.DRAW_AT[2] - 1), 'Перетасовка!', '#e8d8ff', 18);
          for (let i = 0; i < 4; i++) lab.noise(0.04, 0.05, 2400, i * 0.05);
          lab.pulse(st.pileDraw, 1.3, 0.2);
        }
        c = st.draw.pop();
      } else c = { id: lab.pick(st.deck), uid: st.uid++ };
      c.die = cfg.dice >= 1 ? lab.randInt(1, 6) : 0;
      this.takeSlot(lab, c, this.DRAW_AT, got * 0.08);
      st.hand.push(c); got++;
      lab.tone(700 + got * 60, 0.03, 'triangle', 0.03, 0, got * 0.08);
    }
    this.foresee(lab);
  },
  shuffle(lab, a) { const b = a.slice(); for (let i = b.length - 1; i > 0; i--) { const j = lab.randInt(0, i); [b[i], b[j]] = [b[j], b[i]]; } return b; },
  fixTarget(lab) {
    const st = lab.state, E = st.enemies.filter(e => !e.dead);
    if (!E.length) { st.tgt = 0; return; }
    st.tgt = lab.clamp(st.tgt, 0, E.length - 1);
  },
  target(lab) { const E = lab.state.enemies.filter(e => !e.dead); return E[lab.clamp(lab.state.tgt, 0, E.length - 1)] || null; },

  playerInput(lab, dt) {
    const st = lab.state, p = lab.p1, cfg = lab.cfg, n = st.hand.length;
    let dx = 0, dy = 0;
    if (p.pressed.left) dx = -1; else if (p.pressed.right) dx = 1;
    if (p.pressed.up) dy = -1; else if (p.pressed.down) dy = 1;
    if (p.left || p.right) { st.repeat += dt; if (st.repeat > 0.36) { st.repeat = 0.24; dx = p.left ? -1 : 1; } } else st.repeat = 0;
    if (dx && n) { st.sel = (st.sel + dx + n) % n; lab.tone(600 + st.sel * 70, 0.035, 'triangle', 0.04); }
    if (dy) {
      const E = st.enemies.filter(e => !e.dead);
      if (E.length > 1) { st.tgt = (st.tgt + dy + E.length) % E.length; lab.tone(420 + st.tgt * 60, 0.04, 'square', 0.03); lab.pulse(st.ring, 1.25, 0.12); }
    }
    if (p.pressed.a && n) this.playCard(lab, st.sel);
    else if (p.pressed.b) this.endTurn(lab);
    else if (cfg.turnTime > 0) {
      st.clock -= dt;
      const c = Math.ceil(st.clock);
      if (c <= 5 && c < st.tick && c >= 0) { st.tick = c; lab.tone(c ? 880 : 440, 0.06, 'square', 0.05); }
      if (st.clock <= 0) {
        st.timeouts++;
        lab.popup(lab.v3(0, 2.8, 2.0), 'Время вышло!', '#ff6a4a', 24);
        this.endTurn(lab);
      }
    }
  },
  playCard(lab, i) {
    const st = lab.state, c = st.hand[i], d = this.CARDS[c.id], cost = this.cost(lab, c);
    if (cost > st.energy) {
      lab.tone(150, 0.12, 'square', 0.05); lab.shake(0.06);
      const s = c.slot; if (s) s.wob = 0.3;
      lab.popup(lab.v3(st.energyG.position.x, 1.2, st.energyG.position.z), 'Мало энергии', '#ff9f6a', 16);
      lab.pulse(st.energyG, 1.3, 0.15);
      return;
    }
    st.energy -= cost; st.cardsPlayed++; lab.count('карты');
    st.hand.splice(i, 1);
    st.sel = Math.min(st.sel, Math.max(0, st.hand.length - 1));
    if (lab.cfg.bag >= 1) st.discard.push(c);
    const tgt = d.type === 'atk' && !d.all ? this.target(lab) : null;
    const to = tgt ? lab.v3(tgt.g.position.x - 0.6, 1.6, tgt.g.position.z + 0.6) : d.type === 'atk' ? lab.v3(3.2, 1.8, 0) : lab.v3(this.HERO_AT[0] + 0.4, 1.6, this.HERO_AT[2] + 0.8);
    this.flySlot(lab, c.slot, to, 0.2, true);
    lab.sfx.whoosh();
    st.phase = 'resolve';
    const x = this.values(lab, c);
    st.t = 0.3 + (x.dmg ? 0.14 * x.hits * (d.all ? 1 : 1) : 0.1);
    lab.after(0.18, () => this.applyCard(lab, c, d, x, tgt));
  },
  // случай после решения: кубик после хода (спрятанная механика выключена) и шанс попадания (вариация XCOM)
  luck(lab, d) {
    const st = lab.state, cfg = lab.cfg, at = lab.v3(this.HERO_AT[0] + 1.2, 3.0, this.HERO_AT[2]);
    let k = 1;
    if (!this.secretOn(lab)) {
      k = lab.pick(this.FACES); st.rolls++;
      if (k !== 1) st.luck = true;
      if (!k) { st.misses++; lab.count('промахи кубика'); }
      lab.popup(at, k === 0 ? 'Кубик: промах!' : `Кубик: ×${k === 0.5 ? '½' : k === 1.5 ? '1½' : k}`, k < 1 ? '#ff8a6a' : k > 1 ? '#9dffb0' : '#ffffff', 20);
      lab.tone(k ? 300 + k * 200 : 160, 0.06, 'square', 0.05); lab.noise(0.05, 0.04, 3000);
    }
    if (cfg.hit > 0 && d.type === 'atk') {
      st.rolls++;
      if (!lab.chance(cfg.hit / 100)) {
        k = 0; st.misses++; st.luck = true; lab.count('промахи кубика');
        lab.after(0.05, () => lab.popup(lab.v3(at.x + 0.5, at.y - 0.6, at.z), `Мимо! (шанс ${Math.round(cfg.hit)} %)`, '#ff8a6a', 20));
      }
    }
    return k;
  },
  applyCard(lab, c, d, x, tgt) {
    const st = lab.state, h = st.hero, k = this.luck(lab, d);
    const dmg = Math.round(x.dmg * k), block = Math.round(x.block * k), heal = Math.round(x.heal * k);
    if (d.type === 'atk') {
      this.heroLunge(lab, d.all ? 3.2 : tgt ? tgt.g.position.x : 3, d.all);
      for (let i = 0; i < x.hits; i++) lab.after(0.1 + i * 0.13, () => {
        let list = d.all ? st.enemies.filter(e => !e.dead) : [tgt && !tgt.dead ? tgt : this.target(lab)];
        list = list.filter(Boolean);
        list.forEach(e => this.hitEnemy(lab, e, dmg, d));
      });
    }
    if (block) {
      h.block += block;
      lab.popup(lab.v3(this.HERO_AT[0], 2.6, this.HERO_AT[2] + 0.4), `+${block} щит`, '#8fd0ff', 22);
      lab.ring([this.HERO_AT[0], 0.05, this.HERO_AT[2]], { color: '#5fb8ff', radius: 1.6 });
      lab.pulse(st.shield, 1.4, 0.18); lab.pulse(st.heroP, 1.08, 0.15);
      lab.tone(660, 0.07, 'triangle', 0.06); lab.tone(990, 0.1, 'triangle', 0.05, 0, 0.05);
    }
    if (heal) {
      const was = h.hp; h.hp = Math.min(h.max, h.hp + heal);
      lab.popup(lab.v3(this.HERO_AT[0] - 0.4, 2.9, this.HERO_AT[2]), `+${h.hp - was} ❤`, '#9dffb0', 22);
      lab.burst([this.HERO_AT[0], 1.2, this.HERO_AT[2]], { count: 16, colors: ['#9dffb0', '#ffe680'], speed: 3, up: 4, gravity: -2 });
      lab.sfx.power();
    }
    if (x.str) {
      st.str += x.str;
      lab.popup(lab.v3(this.HERO_AT[0], 3.0, this.HERO_AT[2]), `+${x.str} сила`, '#ff8a4a', 24);
      lab.burst([this.HERO_AT[0], 1.0, this.HERO_AT[2]], { count: 24, colors: ['#ff5a3c', '#ffb36b', '#ffd23f'], speed: 5, up: 5 });
      lab.ring([this.HERO_AT[0], 0.05, this.HERO_AT[2]], { color: '#ff7a3c', radius: 2 });
      lab.pulse(st.heroP, 1.15, 0.2); lab.sfx.power(); lab.shake(0.1);
    }
    if (x.draw) { this.drawCards(lab, x.draw); lab.sfx.coin(); }
    if (x.gain) {
      st.energy += x.gain;
      lab.popup(lab.v3(st.energyG.position.x, 1.4, st.energyG.position.z), `+${x.gain} энергия`, '#ffd23f', 20);
      lab.pulse(st.energyG, 1.4, 0.2); lab.sfx.power();
    }
    if (st.str && d.type === 'atk') st.strGlow = 0.4;
  },
  hitEnemy(lab, e, dmg, d) {
    const st = lab.state;
    if (!e || e.dead) return;
    const soak = Math.min(e.block, dmg), lost = dmg - soak;
    e.block -= soak; e.hp -= lost;
    st.hitN++;
    const at = lab.v3(e.g.position.x, e.h * 0.55, e.g.position.z);
    this.slash(lab, at, d.icon === 'flame' ? '#ff7a2a' : d.icon === 'bee' || d.icon === 'bees' ? '#ffd23f' : '#ffd9a0');
    if (dmg <= 0) { lab.popup(at, '0', '#cccccc', 22); lab.tone(200, 0.06, 'square', 0.04); return; }
    lab.whiten(e.g, 0.08);
    lab.burst(at, { count: 8 + Math.min(16, dmg), colors: soak && !lost ? ['#8fd0ff', '#ffffff'] : ['#ffd9a0', '#ff7a3c', '#ffffff'], speed: 6 + dmg * 0.2, size: 0.12, dir: [1, 0.3, 0] });
    lab.hitstop(Math.min(0.09, 0.03 + dmg * 0.003));
    lab.shake(Math.min(0.35, 0.08 + dmg * 0.015));
    e.kx = Math.min(0.9, 0.2 + dmg * 0.04);
    lab.tone(330 * lab.pitch(st.hitN), 0.07, 'square', 0.06);
    if (soak) { lab.popup(lab.v3(at.x - 0.4, at.y + 0.6, at.z), `щит −${soak}`, '#8fd0ff', 16); lab.tone(1400, 0.05, 'square', 0.03); }
    if (lost) { lab.popup(at, `−${lost}`, '#ff6b4a', 22 + Math.min(14, lost)); lab.addScore(lost); lab.sfx.hit(); }
    if (e.hp <= 0) this.killEnemy(lab, e);
  },
  killEnemy(lab, e) {
    const st = lab.state;
    e.dead = true; e.hp = 0;
    const at = lab.v3(e.g.position.x, e.h * 0.5, e.g.position.z);
    if (this.intentsSeen(lab) && e.intent && e.intent.atk && (st.phase === 'resolve' || st.phase === 'player')) {
      lab.count('_secret'); // добил врага до его удара: видел намерение — успел
      lab.after(0.25, () => lab.popup(lab.v3(at.x, at.y + 1.3, at.z), 'Добил до удара!', '#ffe680', 20));
    }
    lab.addScore(e.boss ? 500 * st.round : 25, lab.v3(at.x, at.y + 0.8, at.z), '#ffd23f');
    lab.burst(at, { count: e.boss ? 40 : 24, colors: e.cols, speed: e.boss ? 10 : 7, size: e.boss ? 0.3 : 0.18, up: 4 });
    lab.ring([at.x, 0.05, at.z], { color: '#ffb36b', radius: e.boss ? 3.5 : 2 });
    lab.sfx.explode(); lab.shake(e.boss ? 0.7 : 0.35); lab.hitstop(e.boss ? 0.12 : 0.07);
    const last = !st.enemies.some(x => !x.dead);
    if (last) lab.slowmo(e.boss ? 1.0 : 0.5, 0.35);
    this.removeEnemy(lab, e, false);
    this.slotEnemies(lab); this.fixTarget(lab);
  },
  removeEnemy(lab, e, quick) {
    e.dead = true;
    const g = e.g, s0 = g.scale.x;
    e.ui.sp.visible = false;
    lab.tween(quick ? 0.15 : 0.35, k => { g.scale.setScalar(Math.max(0.01, s0 * (1 - k))); g.rotation.z = k * 0.8; }, 'inQuad');
    lab.after(quick ? 0.16 : 0.36, () => { g.removeFromParent(); e.ui.sp.removeFromParent(); lab.state.enemies = lab.state.enemies.filter(x => x !== e); });
  },
  afterCard(lab) {
    const st = lab.state;
    if (!st.enemies.some(e => !e.dead)) return this.fightWon(lab);
    st.phase = 'player';
  },
  endTurn(lab) {
    const st = lab.state;
    if (st.phase !== 'player') return;
    // спрятанная механика: намерение видно, и щит закрыл всю атаку — случай был только в раздаче, решение — твоё
    const inc = this.incoming(lab);
    if (this.intentsSeen(lab) && inc > 0 && st.hero.block >= inc) {
      lab.count('_secret');
      lab.popup(lab.v3(this.HERO_AT[0] + 0.6, 3.2, this.HERO_AT[2]), 'Закрыл щитом!', '#8fd0ff', 22);
      lab.sfx.coin();
    }
    st.hand.forEach((c, i) => { this.flySlot(lab, c.slot, lab.v3(this.DISC_AT[0], 0.4, this.DISC_AT[2]), 0.25 + i * 0.04, false); if (lab.cfg.bag >= 1) st.discard.push(c); });
    st.hand = [];
    st.phase = 'enemy'; st.t = 0.55;
    st.queue = st.enemies.filter(e => !e.dead);
    st.queue.forEach(e => { e.block = 0; });
    lab.tone(110, 0.2, 'sine', 0.12); lab.tone(98, 0.25, 'sine', 0.1, 0, 0.15);
    this.foresee(lab);
  },
  enemyStep(lab) {
    const st = lab.state, cfg = lab.cfg;
    if (st.hero.hp <= 0) return;
    const e = st.queue.shift();
    if (!e) return this.endEnemyPhase(lab);
    if (e.dead) { st.t = 0.05; return; }
    st.t = cfg.think + (e.intent.hits || 1) * 0.12;
    this.enemyAct(lab, e);
  },
  enemyAct(lab, e) {
    const st = lab.state, m = e.intent, at = lab.v3(e.g.position.x, e.h + 0.4, e.g.position.z);
    e.act = 0.3; // замах: пузырь намерения и тело раздуваются
    if (m.def) { e.block += m.def; lab.popup(at, `+${m.def} щит`, '#8fd0ff', 20); lab.ring([e.g.position.x, 0.05, e.g.position.z], { color: '#5fb8ff', radius: 1.5 }); lab.tone(520, 0.08, 'triangle', 0.05); }
    if (m.str) { e.str += m.str; lab.popup(at, `+${m.str} сила`, '#ff6a4a', 22); lab.burst(at, { count: 18, colors: ['#ff5a3c', '#ffb36b'], speed: 4, up: 3 }); lab.sfx.power(); }
    if (m.charge) { lab.popup(at, 'Копит силу…', '#ffd36b', 20); lab.pulse(e.p, 1.2, 0.4); lab.tone(140, 0.4, 'sawtooth', 0.05, 280); }
    if (m.frost) { st.frostNext = m.frost; lab.after(0.3, () => lab.popup(lab.v3(this.HERO_AT[0], 3.0, this.HERO_AT[2]), 'Мороз: −1 энергия на ход', '#9fe6ff', 18)); lab.burst([this.HERO_AT[0], 1.2, this.HERO_AT[2]], { count: 20, colors: ['#9fe6ff', '#ffffff'], speed: 4, up: 2 }); }
    if (m.summon) {
      const room = 4 - st.enemies.filter(x => !x.dead).length;
      for (let i = 0; i < Math.min(room, m.summon); i++) lab.after(0.1 + i * 0.2, () => this.spawnEnemy(lab, this.FOES.osa, false, [e.g.position.x, 0, e.g.position.z]));
      lab.popup(at, room > 0 ? 'Рой, ко мне!' : 'Рой занят', '#ffd23f', 20); lab.tone(900, 0.3, 'sawtooth', 0.03, 1300);
    }
    if (m.atk) {
      const hits = m.hits || 1, dmg = this.hitOf(lab, e);
      lab.after(0.2, () => { e.lx = -1; lab.sfx.whoosh(); });
      for (let i = 0; i < hits; i++) lab.after(0.3 + i * 0.13, () => this.hitHero(lab, e, dmg));
      lab.after(0.42 + hits * 0.13, () => { e.lx = 0; });
    }
    lab.after(0.45, () => { if (!e.dead) this.pickIntent(lab, e); });
  },
  hitHero(lab, e, dmg) {
    const st = lab.state, h = st.hero;
    if (h.hp <= 0) return;
    const soak = Math.min(h.block, dmg), lost = dmg - soak, at = lab.v3(this.HERO_AT[0], 1.4, this.HERO_AT[2]);
    h.block -= soak; h.hp -= lost;
    st.incomingTotal += dmg; st.blockedTotal += soak;
    if (soak) {
      lab.burst([at.x + 0.6, at.y, at.z], { count: 14, colors: ['#8fd0ff', '#ffffff'], speed: 6, dir: [-1, 0.4, 0] });
      lab.tone(1300, 0.06, 'square', 0.05); lab.tone(1900, 0.05, 'square', 0.03, 0, 0.03);
      lab.whiten(st.shield, 0.06, '#bfe6ff');
      if (!lost) lab.popup(at, 'Блок!', '#8fd0ff', 22);
    }
    if (lost) {
      st.tookDmg += lost;
      lab.whiten(st.heroG, 0.1, '#ff6b5a'); lab.flash('#ff3b3b', 0.15);
      lab.shake(Math.min(0.5, 0.15 + lost * 0.02)); lab.hitstop(0.05);
      lab.popup(lab.v3(at.x, at.y + 0.9, at.z), `−${lost}`, '#ff5a3c', 24 + Math.min(12, lost));
      lab.burst(at, { count: 10 + lost, colors: ['#ff5a3c', '#ffb36b'], speed: 5, dir: [-1, 0.3, 0] });
      lab.sfx.hit(); st.heroKx = -0.5;
      if (h.hp <= 0) this.heroDies(lab, e);
    }
  },
  heroDies(lab, e) {
    const st = lab.state;
    st.phase = 'dead'; st.hero.hp = 0; st.hero.block = 0;
    lab.slowmo(1.2, 0.3); lab.shake(0.8); lab.flash('#ff3b3b', 0.35); lab.sfx.lose();
    lab.burst([this.HERO_AT[0], 1.2, this.HERO_AT[2]], { count: 30, colors: ['#2d55d6', '#ffd36b', '#ffffff'], speed: 8, up: 4 });
    lab.tween(0.8, k => { st.heroG.rotation.z = k * 1.45; st.heroG.position.y = -k * 0.2; }, 'outBounce');
    this.stats(lab);
    const fights = Math.round(lab.cfg.fights), where = st.fight >= fights ? `у босса` : `в бою ${st.fight + 1}`;
    lab.after(1.4, () => lab.gameOver(`Нарт пал ${where}: ${e.def.name}`));
  },
  endEnemyPhase(lab) {
    const st = lab.state;
    if (st.planned > 0 && !st.tookDmg && st.hero.hp > 0) { // весь урон закрыт или враги повержены до удара
      st.perfect++; st.streak++; st.bestStreak = Math.max(st.bestStreak, st.streak); lab.count('идеальные ходы');
      const pts = 40 * st.streak;
      lab.addScore(pts, lab.v3(this.HERO_AT[0], 3.4, this.HERO_AT[2]), '#ffd23f');
      lab.popup(lab.v3(0, 3.6, 0), st.streak > 1 ? `Идеальный ход! ×${st.streak}` : 'Идеальный ход!', '#ffd23f', 28);
      lab.burst([this.HERO_AT[0], 2, this.HERO_AT[2]], { count: 24, colors: ['#ffd23f', '#ffffff'], speed: 6, up: 5 });
      lab.tone(784, 0.1, 'triangle', 0.06); lab.tone(1046, 0.15, 'triangle', 0.06, 0, 0.1);
    } else if (st.tookDmg) {
      if (st.streak >= 2) lab.popup(lab.v3(0, 3.2, 0), 'Серия прервана', '#ff9f6a', 18);
      st.streak = 0;
    }
    if (st.luck) st.luckTurns++;
    this.stats(lab);
    this.startTurn(lab);
  },
  fightWon(lab) {
    const st = lab.state, cfg = lab.cfg, boss = st.fight >= Math.round(cfg.fights);
    st.phase = 'won'; st.t = 1.2;
    st.wins++; st.fightTurns.push(st.turnInFight);
    if (st.luck) st.luckTurns++;
    const pts = 100 * (st.fight + 1) * st.round + (st.turnInFight <= 3 ? 60 : 0);
    lab.addScore(pts, lab.v3(2.6, 3.0, -0.6), '#ffd23f');
    lab.popup(lab.v3(0, 3.8, 0), boss ? 'Иныж повержен!' : 'Победа!', '#ffd23f', boss ? 36 : 30);
    if (st.turnInFight <= 3) lab.after(0.3, () => lab.popup(lab.v3(0, 3.1, 0.4), `Быстрый бой: ${st.turnInFight} хода`, '#9dffb0', 18));
    lab.sfx.win();
    lab.burst([this.HERO_AT[0], 2.4, this.HERO_AT[2]], { count: 40, colors: ['#ffd23f', '#ffffff', '#ff9a5e', '#5fb8ff'], speed: 9, up: 6 });
    st.hand.forEach((c, i) => this.flySlot(lab, c.slot, lab.v3(this.DISC_AT[0], 0.4, this.DISC_AT[2]), 0.25 + i * 0.04, false));
    st.hand = [];
    st.hero.block = 0; st.energy = 0;
    this.stats(lab);
  },
  showRewards(lab) {
    const st = lab.state, pool = this.REWARDS.slice(), pick = [];
    for (let i = 0; i < 3; i++) pick.push(pool.splice(lab.randInt(0, pool.length - 1), 1)[0]);
    st.rewards = pick.map(id => ({ id, uid: st.uid++, die: 0 }));
    st.rsel = 1; st.phase = 'reward'; st.clock = 12; st.tick = 12;
    st.rewards.forEach((c, i) => { const s = st.rslots[i]; s.card = c; s.sig = null; s.mesh.visible = true; s.k = 0; lab.tween(0.35, k => { s.k = k; }, 'outBack'); });
    lab.popup(lab.v3(0, 3.6, 1.5), 'Возьми карту в колоду', '#ffd23f', 22);
    lab.tone(659, 0.1, 'triangle', 0.05); lab.tone(880, 0.12, 'triangle', 0.05, 0, 0.1);
  },
  rewardInput(lab, dt) {
    const st = lab.state, p = lab.p1;
    if (p.pressed.left) { st.rsel = (st.rsel + 2) % 3; lab.tone(600 + st.rsel * 80, 0.035, 'triangle', 0.04); }
    if (p.pressed.right) { st.rsel = (st.rsel + 1) % 3; lab.tone(600 + st.rsel * 80, 0.035, 'triangle', 0.04); }
    st.clock -= dt;
    if (p.pressed.a || st.clock <= 0) {
      const c = st.rewards[st.rsel];
      st.deck.push(c.id);
      lab.popup(lab.v3(0, 3.4, 1.5), `${this.CARDS[c.id].name} — в колоду!`, '#ffd23f', 22);
      lab.sfx.coin();
      lab.burst(st.rslots[st.rsel].mesh.position, { count: 20, colors: ['#ffd23f', '#ffffff'], speed: 5 });
      this.leaveRewards(lab, st.rsel);
    } else if (p.pressed.b) {
      lab.popup(lab.v3(0, 3.4, 1.5), 'Колода без изменений', '#e8d8ff', 18);
      this.leaveRewards(lab, -1);
    }
  },
  leaveRewards(lab, took) {
    const st = lab.state, cfg = lab.cfg, h = st.hero;
    st.rslots.forEach((s, i) => { const k0 = s.k; s.go = i === took ? 1 : -1; lab.tween(0.3, k => { s.k = k0 * (1 - k); }, 'inQuad'); lab.after(0.31, () => { s.mesh.visible = false; s.go = 0; }); });
    st.phase = 'rest'; st.t = 99;
    const heal = Math.min(h.max - h.hp, Math.round(cfg.heal));
    lab.after(0.5, () => {
      if (heal > 0) { h.hp += heal; lab.popup(lab.v3(this.HERO_AT[0], 2.8, this.HERO_AT[2]), `Отдых у костра: +${heal} ❤`, '#9dffb0', 20); lab.burst([this.HERO_AT[0], 0.8, this.HERO_AT[2]], { count: 14, colors: ['#ffb36b', '#ffd23f'], speed: 2, up: 4, gravity: -2 }); }
    });
    lab.after(1.1, () => {
      let next = st.fight + 1;
      if (st.fight >= Math.round(cfg.fights)) { st.round++; next = 0; lab.popup(lab.v3(0, 3.8, 0), `Круг ${st.round}: иныжи злее`, '#ff9a5e', 26); }
      this.beginFight(lab, next);
    });
  },

  // ---------- карты на столе: пул плашек с холстами ----------
  slot(lab, w, h) {
    const T = lab.THREE, c = document.createElement('canvas'); c.width = w; c.height = h;
    const tex = new T.CanvasTexture(c); tex.colorSpace = T.SRGBColorSpace; tex.anisotropy = 4;
    const m = new T.MeshBasicMaterial({ map: tex, alphaTest: 0.5, toneMapped: false, side: T.DoubleSide });
    const mesh = lab.mesh(lab.state.cardGeo, m, { shadow: false });
    mesh.visible = false; mesh.renderOrder = 3;
    return { canvas: c, g: c.getContext('2d'), tex, mesh, sig: null, card: null, busy: false, x: 0, y: 0, z: 0, s: 0.4, wob: 0, rz: 0 };
  },
  takeSlot(lab, c, from, delay) {
    const st = lab.state, s = st.slots.find(x => !x.busy);
    if (!s) return;
    s.busy = true; s.card = c; s.sig = null; s.fly = false; s.delay = delay;
    s.x = from[0]; s.y = 0.4; s.z = from[2]; s.s = 0.35; s.rz = 0.6;
    s.mesh.visible = false;
    c.slot = s;
  },
  flySlot(lab, s, to, sec, burn) {
    if (!s) return;
    s.fly = true;
    const x0 = s.x, y0 = s.y, z0 = s.z, s0 = s.s, rz0 = s.rz;
    lab.tween(sec, k => {
      s.x = lab.lerp(x0, to.x, k); s.y = lab.lerp(y0, to.y, k) + Math.sin(k * Math.PI) * (burn ? 0.8 : 0.4); s.z = lab.lerp(z0, to.z, k);
      s.s = lab.lerp(s0, burn ? 0.55 : 0.35, k); s.rz = rz0 + k * (burn ? 0.4 : -0.8);
      this.placeSlot(s);
    }, 'inOutQuad');
    lab.after(sec + 0.01, () => {
      if (burn) lab.burst([s.x, s.y, s.z], { count: 10, colors: ['#ffd36b', '#ffffff'], speed: 4, size: 0.1 });
      s.mesh.visible = false; s.busy = false; s.fly = false; s.card = null;
    });
  },
  placeSlot(s) {
    s.mesh.position.set(s.x, s.y, s.z);
    s.mesh.rotation.set(this.TILT - Math.PI / 2, 0, s.rz + Math.sin(s.wob * 30) * s.wob * 0.4);
    s.mesh.scale.setScalar(Math.max(0.01, s.s));
  },
  layoutHand(lab, dt) {
    const st = lab.state, n = st.hand.length, T = this.TILT, uy = Math.sin(T), uz = -Math.cos(T), ny = Math.cos(T), nz = Math.sin(T);
    const gap = Math.min(1.62, 9.4 / Math.max(1, n)), mine = st.phase === 'player';
    st.halo.visible = false;
    st.hand.forEach((c, i) => {
      const s = c.slot;
      if (!s || s.fly) return;
      if (s.delay > 0) { s.delay -= dt; return; }
      s.mesh.visible = true;
      const off = i - (n - 1) / 2, sel = mine && i === st.sel, lift = (sel ? 0.6 : 0) - off * off * 0.035, out = sel ? 0.35 : i * 0.012;
      const tx = off * gap, ty = this.HAND.y + uy * lift + ny * out, tz = this.HAND.z + uz * lift + nz * out;
      s.x = lab.damp(s.x, tx, 14, dt); s.y = lab.damp(s.y, ty, 14, dt); s.z = lab.damp(s.z, tz, 14, dt);
      s.s = lab.damp(s.s, sel ? 1.16 : 1, 14, dt); s.rz = lab.damp(s.rz, sel ? 0 : -off * 0.045, 12, dt);
      s.wob = Math.max(0, s.wob - dt);
      this.placeSlot(s);
      this.paint(lab, s, this.cost(lab, c) <= st.energy || !mine);
      if (sel) {
        st.halo.visible = true;
        st.halo.position.set(s.x - 0, s.y - ny * 0.02, s.z - nz * 0.02);
        st.halo.rotation.copy(s.mesh.rotation); st.halo.scale.setScalar(s.s * (1 + Math.sin(lab.t * 6) * 0.015));
      }
    });
    // песочные часы: песок наверху тает со временем хода
    const left = mine && lab.cfg.turnTime > 0 ? lab.clamp(st.clock / lab.cfg.turnTime, 0, 1) : st.phase === 'player' ? 1 : 0.5;
    st.sandTop.scale.set(Math.max(0.01, left), Math.max(0.01, left), Math.max(0.01, left));
    st.sandBot.scale.set(Math.max(0.01, 1 - left), Math.max(0.01, 1 - left), Math.max(0.01, 1 - left));
    st.glass.rotation.y += dt * 0.4;
    // стопки колоды и сброса
    const dn = lab.cfg.bag >= 1 ? st.draw.length : st.deck.length, sn = st.discard.length;
    st.pileDraw.scale.y = lab.damp(st.pileDraw.scale.y, Math.max(0.02, dn * 0.045), 10, dt);
    st.pileDisc.scale.y = lab.damp(st.pileDisc.scale.y, Math.max(0.02, sn * 0.045), 10, dt);
    st.pileDisc.visible = lab.cfg.bag >= 1;
    // кристаллы энергии у ног нарта
    for (let i = 0; i < 8; i++) {
      const on = i < st.maxE || i < st.energy;
      if (!on) { lab.place(st.crystals, i, [0, -5, 0], { scale: 0.001 }); continue; }
      const lit = i < st.energy, a = (i - (Math.max(st.maxE, st.energy) - 1) / 2) * 0.5;
      lab.place(st.crystals, i, [a, 0.35 + (lit ? Math.sin(lab.t * 3 + i) * 0.06 : 0), 0], { scale: lit ? 1 : 0.7, rot: lab.t * (lit ? 1.5 : 0.3) + i, color: lit ? '#ffd23f' : '#4a4660' });
    }
    // цель: кольцо под врагом, по которому полетит удар
    const c = mine ? st.hand[st.sel] : null, tg = this.target(lab), atk = c && this.CARDS[c.id].type === 'atk';
    st.ring.visible = !!(tg && mine);
    if (tg) {
      st.ring.position.x = lab.damp(st.ring.position.x, tg.g.position.x, 12, dt); st.ring.position.z = lab.damp(st.ring.position.z, tg.g.position.z, 12, dt);
      st.ring.scale.setScalar((tg.boss ? 1.8 : 1) * (1 + Math.sin(lab.t * 5) * 0.05));
      st.ring.material = atk && !this.CARDS[c.id].all ? st.ringHot : st.ringCold;
    }
  },
  // рисует карту на холсте плашки, только когда что-то поменялось
  paint(lab, s, ok) {
    const c = s.card, x = this.values(lab, c), d = this.CARDS[c.id];
    const sig = [c.id, x.dmg, x.block, x.heal, c.die, ok, lab.cfg.hit, this.secretOn(lab)].join('|');
    if (s.sig === sig) return;
    s.sig = sig;
    this.drawCard(lab, s.g, s.canvas.width, s.canvas.height, c, d, x, ok);
    s.tex.needsUpdate = true;
  },
  drawCard(lab, g, W, H, c, d, x, ok) {
    const k = W / 256, [c1, c2] = this.TYPE_COL[d.type];
    g.clearRect(0, 0, W, H);
    g.save(); g.scale(k, k);
    const gr = g.createLinearGradient(0, 0, 0, 356); gr.addColorStop(0, c1); gr.addColorStop(1, c2);
    this.rr(g, 4, 4, 248, 348, 22); g.fillStyle = gr; g.fill();
    g.lineWidth = 7; g.strokeStyle = '#ffd36b'; g.stroke();
    // окно рисунка
    this.rr(g, 22, 58, 212, 170, 14);
    const rg = g.createRadialGradient(128, 140, 10, 128, 140, 130); rg.addColorStop(0, 'rgba(255,240,200,0.55)'); rg.addColorStop(1, 'rgba(10,8,30,0.55)');
    g.fillStyle = rg; g.fill(); g.lineWidth = 3; g.strokeStyle = 'rgba(255,211,107,0.7)'; g.stroke();
    this.icon(g, d.icon, 128, 142, 128);
    // цена
    g.beginPath(); g.arc(40, 40, 31, 0, Math.PI * 2); g.fillStyle = '#1d1838'; g.fill(); g.lineWidth = 5; g.strokeStyle = '#ffd36b'; g.stroke();
    this.text(g, String(d.cost), 40, 42, 42, ok ? '#ffffff' : '#ff6b5a');
    // кубик до решения или шанс попадания
    if (c.die) this.die(g, 194, 12, 50, c.die);
    else if (lab.cfg.hit > 0 && d.type === 'atk') { this.rr(g, 170, 14, 74, 42, 12); g.fillStyle = '#1d1838'; g.fill(); this.text(g, Math.round(lab.cfg.hit) + '%', 207, 36, 28, '#ffe680'); }
    else if (!this.secretOn(lab)) { this.rr(g, 196, 14, 46, 46, 10); g.fillStyle = '#f4f4f4'; g.fill(); this.text(g, '?', 219, 39, 34, '#1d1838'); }
    // имя
    this.rr(g, 16, 236, 224, 42, 10); g.fillStyle = '#f4e3c1'; g.fill();
    let fs = 28; g.font = `bold ${fs}px "Trebuchet MS", "DejaVu Sans", Arial, sans-serif`;
    while (g.measureText(d.name).width > 210 && fs > 16) { fs -= 2; g.font = `bold ${fs}px "Trebuchet MS", "DejaVu Sans", Arial, sans-serif`; }
    g.fillStyle = '#3a2412'; g.textAlign = 'center'; g.textBaseline = 'middle'; g.fillText(d.name, 128, 258);
    // строка действия: значок и число — что карта сделает
    const base = { dmg: d.dmg, block: d.block, heal: d.heal };
    const col = (v, b) => (v > b ? '#9dffb0' : v < b ? '#ffb0a0' : '#ffffff');
    const parts = [];
    if (x.dmg || d.dmg) parts.push([d.all ? 'flame' : 'sword', (x.hits > 1 ? `${x.dmg}×${x.hits}` : `${x.dmg}`) + (d.all ? ' всем' : ''), col(x.dmg, base.dmg)]);
    if (d.block) parts.push(['shield', `${x.block}`, col(x.block, base.block)]);
    if (d.heal) parts.push(['heart', `+${x.heal}`, col(x.heal, base.heal)]);
    if (x.str) parts.push(['fist', `+${x.str} сила`, '#ffffff']);
    if (x.draw) parts.push(['cards', `+${x.draw} карты`, '#ffffff']);
    if (x.gain) parts.push(['bolt', `+${x.gain}`, '#ffffff']);
    this.row(g, parts, 128, 316, parts.length > 1 || (parts[0] && parts[0][1].length > 5) ? 30 : 40);
    if (!ok) { this.rr(g, 4, 4, 248, 348, 22); g.fillStyle = 'rgba(12,10,26,0.5)'; g.fill(); }
    g.restore();
  },
  // ряд «значок + число» по центру
  row(g, parts, cx, cy, size) {
    g.font = `bold ${size}px "Trebuchet MS", "DejaVu Sans", Arial, sans-serif`;
    const gap = size * 0.25, iw = size * 0.95;
    const ws = parts.map(p => iw + gap * 0.5 + g.measureText(p[1]).width);
    let x = cx - (ws.reduce((a, b) => a + b, 0) + gap * (parts.length - 1)) / 2;
    parts.forEach((p, i) => {
      this.icon(g, p[0], x + iw / 2, cy, iw);
      g.font = `bold ${size}px "Trebuchet MS", "DejaVu Sans", Arial, sans-serif`;
      g.textAlign = 'left'; g.textBaseline = 'middle';
      g.lineWidth = size * 0.18; g.strokeStyle = '#140e26'; g.lineJoin = 'round';
      g.strokeText(p[1], x + iw + gap * 0.5, cy + 2); g.fillStyle = p[2]; g.fillText(p[1], x + iw + gap * 0.5, cy + 2);
      x += ws[i] + gap;
    });
  },
  text(g, s, x, y, size, color) {
    g.font = `bold ${size}px "Trebuchet MS", "DejaVu Sans", Arial, sans-serif`; g.textAlign = 'center'; g.textBaseline = 'middle';
    g.lineWidth = size * 0.16; g.strokeStyle = '#140e26'; g.lineJoin = 'round'; g.strokeText(s, x, y); g.fillStyle = color; g.fillText(s, x, y);
  },
  rr(g, x, y, w, h, r) { g.beginPath(); g.moveTo(x + r, y); g.arcTo(x + w, y, x + w, y + h, r); g.arcTo(x + w, y + h, x, y + h, r); g.arcTo(x, y + h, x, y, r); g.arcTo(x, y, x + w, y, r); g.closePath(); },
  die(g, x, y, s, v) {
    this.rr(g, x, y, s, s, s * 0.2); g.fillStyle = '#fbfbf4'; g.fill(); g.lineWidth = 3; g.strokeStyle = '#1d1838'; g.stroke();
    const P = { 1: [[1, 1]], 2: [[0, 0], [2, 2]], 3: [[0, 0], [1, 1], [2, 2]], 4: [[0, 0], [2, 0], [0, 2], [2, 2]], 5: [[0, 0], [2, 0], [1, 1], [0, 2], [2, 2]], 6: [[0, 0], [2, 0], [0, 1], [2, 1], [0, 2], [2, 2]] }[v] || [];
    g.fillStyle = v >= 5 ? '#1f8a4c' : v <= 2 ? '#c0392b' : '#1d1838';
    P.forEach(([a, b]) => { g.beginPath(); g.arc(x + s * (0.25 + a * 0.25), y + s * (0.25 + b * 0.25), s * 0.085, 0, Math.PI * 2); g.fill(); });
  },
  // значки рисуются контурами: эмодзи в браузерах класса выглядят по-разному
  icon(g, kind, cx, cy, s) {
    g.save(); g.translate(cx, cy); g.lineJoin = 'round'; g.lineWidth = s * 0.05; g.strokeStyle = '#140e26';
    const P = (pts, fill) => { g.beginPath(); pts.forEach(([x, y], i) => (i ? g.lineTo(x * s, y * s) : g.moveTo(x * s, y * s))); g.closePath(); g.fillStyle = fill; g.fill(); g.stroke(); };
    const sword = () => {
      P([[-0.06, 0.18], [-0.06, -0.38], [0, -0.48], [0.06, -0.38], [0.06, 0.18]], '#e8eef7');
      P([[-0.24, 0.16], [0.24, 0.16], [0.24, 0.24], [-0.24, 0.24]], '#ffd36b');
      P([[-0.045, 0.24], [0.045, 0.24], [0.045, 0.42], [-0.045, 0.42]], '#7a4a22');
      g.beginPath(); g.arc(0, 0.46, s * 0.06, 0, Math.PI * 2); g.fillStyle = '#ffd36b'; g.fill(); g.stroke();
    };
    const shield = (inner, emb) => {
      P([[0, -0.44], [0.36, -0.32], [0.33, 0.06], [0, 0.44], [-0.33, 0.06], [-0.36, -0.32]], '#ffd36b');
      P([[0, -0.35], [0.27, -0.25], [0.25, 0.04], [0, 0.33], [-0.25, 0.04], [-0.27, -0.25]], inner);
      if (emb) { g.beginPath(); g.arc(0, -0.02 * s, s * 0.11, 0, Math.PI * 2); g.fillStyle = '#ffe680'; g.fill(); g.stroke(); }
    };
    const bee = (x, y, k) => {
      g.save(); g.translate(x * s, y * s); g.scale(k, k);
      g.beginPath(); g.ellipse(-0.05 * s, -0.16 * s, 0.13 * s, 0.08 * s, -0.5, 0, Math.PI * 2); g.fillStyle = 'rgba(230,248,255,0.9)'; g.fill(); g.stroke();
      g.beginPath(); g.ellipse(0, 0, 0.22 * s, 0.14 * s, 0, 0, Math.PI * 2); g.fillStyle = '#ffc21a'; g.fill(); g.stroke();
      g.fillStyle = '#140e26'; [-0.06, 0.06].forEach(a => g.fillRect((a - 0.025) * s, -0.13 * s, 0.05 * s, 0.26 * s));
      P([[0.2, -0.03], [0.34, 0], [0.2, 0.03]], '#140e26');
      g.restore();
    };
    if (kind === 'sword') { g.rotate(Math.PI / 4); sword(); }
    else if (kind === 'sword2') { g.save(); g.rotate(Math.PI / 4); g.scale(0.85, 0.85); sword(); g.restore(); g.rotate(-Math.PI / 4); g.scale(0.85, 0.85); sword(); }
    else if (kind === 'shield') shield('#4f9df0');
    else if (kind === 'shield2') shield('#2d6fd6', true);
    else if (kind === 'flame') {
      g.beginPath(); g.moveTo(0, -0.48 * s); g.bezierCurveTo(0.3 * s, -0.2 * s, 0.38 * s, 0.1 * s, 0.26 * s, 0.3 * s); g.bezierCurveTo(0.14 * s, 0.48 * s, -0.14 * s, 0.48 * s, -0.26 * s, 0.3 * s); g.bezierCurveTo(-0.38 * s, 0.1 * s, -0.2 * s, -0.1 * s, 0, -0.48 * s);
      g.fillStyle = '#ff6a1a'; g.fill(); g.stroke();
      g.beginPath(); g.moveTo(0, -0.18 * s); g.bezierCurveTo(0.16 * s, 0, 0.2 * s, 0.2 * s, 0.1 * s, 0.32 * s); g.bezierCurveTo(0.04 * s, 0.38 * s, -0.04 * s, 0.38 * s, -0.1 * s, 0.32 * s); g.bezierCurveTo(-0.2 * s, 0.2 * s, -0.16 * s, 0, 0, -0.18 * s);
      g.fillStyle = '#ffe14d'; g.fill();
    } else if (kind === 'fist') {
      P([[0, -0.46], [0.32, -0.08], [0.13, -0.08], [0.13, 0.4], [-0.13, 0.4], [-0.13, -0.08], [-0.32, -0.08]], '#ff5a3c');
    } else if (kind === 'stone') {
      P([[-0.36, 0.3], [-0.4, -0.06], [-0.18, -0.36], [0.2, -0.38], [0.4, -0.04], [0.34, 0.3]], '#a8aab4');
      P([[-0.18, -0.36], [0.2, -0.38], [0.1, -0.1], [-0.1, -0.1]], '#cfd2da');
      g.beginPath(); g.arc(0, 0.04 * s, s * 0.1, 0, Math.PI * 2); g.fillStyle = '#ffd36b'; g.fill(); g.stroke();
    } else if (kind === 'cards') {
      g.rotate(-0.25); P([[-0.32, -0.36], [0.08, -0.36], [0.08, 0.28], [-0.32, 0.28]], '#e8eef7');
      g.rotate(0.5); P([[-0.08, -0.32], [0.32, -0.32], [0.32, 0.32], [-0.08, 0.32]], '#ffd36b');
    } else if (kind === 'bolt') {
      P([[0.08, -0.48], [-0.26, 0.06], [-0.02, 0.06], [-0.1, 0.48], [0.28, -0.08], [0.04, -0.08]], '#ffd23f');
    } else if (kind === 'hammer') {
      g.rotate(-0.6); P([[-0.05, -0.12], [0.05, -0.12], [0.05, 0.48], [-0.05, 0.48]], '#8a5a2b');
      P([[-0.3, -0.38], [0.3, -0.38], [0.3, -0.1], [-0.3, -0.1]], '#9aa3b4');
    } else if (kind === 'anvil') {
      P([[-0.44, -0.2], [0.3, -0.2], [0.44, -0.08], [0.18, -0.02], [0.14, 0.14], [0.3, 0.3], [-0.3, 0.3], [-0.14, 0.14], [-0.18, -0.02], [-0.44, -0.06]], '#7c8494');
    } else if (kind === 'bee') bee(0, 0, 1.3);
    else if (kind === 'bees') { bee(-0.18, -0.16, 0.8); bee(0.2, -0.04, 0.8); bee(-0.06, 0.24, 0.8); }
    else if (kind === 'heart') {
      g.beginPath(); g.moveTo(0, 0.4 * s); g.bezierCurveTo(-0.5 * s, 0.04 * s, -0.32 * s, -0.44 * s, 0, -0.18 * s); g.bezierCurveTo(0.32 * s, -0.44 * s, 0.5 * s, 0.04 * s, 0, 0.4 * s);
      g.fillStyle = '#ff5f7e'; g.fill(); g.stroke();
    } else if (kind === 'snow') {
      g.strokeStyle = '#bff0ff'; g.lineWidth = s * 0.08;
      for (let i = 0; i < 3; i++) { g.rotate(Math.PI / 3); g.beginPath(); g.moveTo(0, -0.4 * s); g.lineTo(0, 0.4 * s); g.stroke(); }
    } else if (kind === 'charge') {
      P([[0, -0.46], [0.12, -0.12], [0.46, 0], [0.12, 0.12], [0, 0.46], [-0.12, 0.12], [-0.46, 0], [-0.12, -0.12]], '#ffd23f');
    } else if (kind === 'q') { this.text(g, '?', 0, 0, s * 0.9, '#ffffff'); }
    g.restore();
  },

  // ---------- над бойцами: намерение, имя, здоровье, щит ----------
  unitSprite(lab) {
    const T = lab.THREE, c = document.createElement('canvas'); c.width = 256; c.height = 200;
    const tex = new T.CanvasTexture(c); tex.colorSpace = T.SRGBColorSpace;
    const sp = new T.Sprite(new T.SpriteMaterial({ map: tex, depthTest: false, depthWrite: false, toneMapped: false, transparent: true }));
    sp.renderOrder = 10; sp.scale.set(2.8, 2.2, 1); sp.userData.noShadow = true;
    lab.add(sp); lab.noShadow(sp);
    return { sp, c, g: c.getContext('2d'), tex, sig: null };
  },
  intentParts(lab, e) {
    const m = e.intent, p = [];
    if (!this.intentsSeen(lab)) return { parts: [['q', '', '#ffffff']], col: '#9a9ab0' };
    if (m.atk) p.push(['sword', (m.hits > 1 ? `${this.hitOf(lab, e)}×${m.hits}` : `${this.hitOf(lab, e)}`), '#ffffff']);
    if (m.def) p.push(['shield', `${m.def}`, '#ffffff']);
    if (m.str) p.push(['fist', `+${m.str}`, '#ffffff']);
    if (m.charge) p.push(['charge', 'копит', '#ffe680']);
    if (m.frost) p.push(['snow', '−1', '#bff0ff']);
    if (m.summon) p.push(['bee', `+${m.summon}`, '#ffffff']);
    return { parts: p, col: m.atk ? '#ff5a3c' : m.def ? '#5fb8ff' : m.charge ? '#ffd23f' : '#c27bff' };
  },
  paintUnit(lab, u, o) {
    const sig = JSON.stringify(o);
    if (u.sig === sig) return;
    u.sig = sig;
    const g = u.g;
    g.clearRect(0, 0, 256, 200);
    if (o.intent) { // пузырь намерения: красный — ударит, синий — щит, золотой — копит
      const { parts, col } = o.intent;
      g.font = 'bold 40px "Trebuchet MS", "DejaVu Sans", Arial, sans-serif';
      const w = Math.min(248, 30 + parts.reduce((a, p) => a + 46 + (p[1] ? g.measureText(p[1]).width + 12 : 0), 0));
      this.rr(g, 128 - w / 2, 8, w, 76, 22); g.fillStyle = 'rgba(22,16,44,0.88)'; g.fill(); g.lineWidth = 6; g.strokeStyle = col; g.stroke();
      g.beginPath(); g.moveTo(116, 84); g.lineTo(128, 100); g.lineTo(140, 84); g.fillStyle = col; g.fill();
      this.row(g, parts, 128, 46, 40);
    }
    g.textAlign = 'center'; g.textBaseline = 'middle';
    g.font = 'bold 22px "Trebuchet MS", "DejaVu Sans", Arial, sans-serif';
    const nm = o.tg ? '▶ ' + o.name + ' ◀' : o.name;
    g.lineWidth = 4; g.strokeStyle = '#140e26'; g.strokeText(nm, 128, 120); g.fillStyle = o.hero ? '#bfe0ff' : o.tg ? '#ffd23f' : '#ffe0c8'; g.fillText(nm, 128, 120);
    // полоска здоровья
    const bx = 36, by = 138, bw = 196, bh = 30, k = lab.clamp(o.hp / o.max, 0, 1);
    this.rr(g, bx, by, bw, bh, 9); g.fillStyle = '#140e26'; g.fill();
    if (k > 0) { this.rr(g, bx + 3, by + 3, Math.max(14, (bw - 6) * k), bh - 6, 7); g.fillStyle = o.hero ? '#4cd17a' : '#e04040'; g.fill(); }
    if (o.block) { this.rr(g, bx, by, bw, bh, 9); g.lineWidth = 4; g.strokeStyle = '#5fb8ff'; g.stroke(); }
    this.text(g, `${Math.max(0, o.hp)} / ${o.max}`, bx + bw / 2 + 10, by + bh / 2 + 1, 22, '#ffffff');
    if (o.block) { // значок щита слева от полоски
      g.save(); g.translate(22, by + bh / 2); this.icon(g, 'shield', 0, 0, 48); g.restore();
      this.text(g, String(o.block), 22, by + bh / 2, 20, '#ffffff');
    }
    let tx = 128;
    const extra = [];
    if (o.str) extra.push([`сила +${o.str}`, '#ff8a5a']);
    if (o.frost) extra.push([`мороз −${o.frost}`, '#9fe6ff']);
    extra.forEach(([s, c], i) => { this.text(g, s, extra.length > 1 ? (i ? 186 : 70) : tx, 186, 20, c); });
    u.tex.needsUpdate = true;
  },

  // ---------- оживление бойцов, мира и камеры ----------
  animateUnits(lab, dt) {
    const st = lab.state, h = st.hero, t = lab.t;
    // нарт: дышит, делает выпад, щит перед ним растёт со значением
    st.heroLx = lab.damp(st.heroLx || 0, st.heroLunge || 0, 18, dt);
    st.heroKx = lab.damp(st.heroKx || 0, 0, 8, dt);
    if (st.phase !== 'dead') st.heroG.position.set(this.HERO_AT[0] + st.heroLx + st.heroKx, 0, this.HERO_AT[2]);
    st.heroB.scale.set(1, 1 + Math.sin(t * 2.2) * 0.03, 1);
    st.sword.rotation.z = lab.damp(st.sword.rotation.z, st.swing ? -1.9 : 0.5 + Math.sin(t * 2.2) * 0.04, 20, dt);
    st.strGlow = Math.max(0, (st.strGlow || 0) - dt);
    st.blade.material = st.str > 0 ? st.bladeHot : st.bladeCold;
    const bk = h.block > 0 ? Math.min(1.35, 0.75 + h.block / 25) : 0.01;
    st.shieldK = lab.damp(st.shieldK || 0.01, bk, 10, dt);
    st.shield.scale.setScalar(Math.max(0.01, st.shieldK));
    st.shield.visible = st.shieldK > 0.03;
    st.shield.position.set(st.heroG.position.x + 1.0, 1.3 + Math.sin(t * 2) * 0.05, this.HERO_AT[2]);
    st.shield.rotation.x = Math.sin(t * 1.3) * 0.1;
    this.paintUnit(lab, st.heroSp, { name: 'Сосруко', hero: 1, hp: h.hp, max: h.max, block: h.block, str: st.str, frost: st.frostNext });
    st.heroSp.sp.position.set(st.heroG.position.x, 3.25, this.HERO_AT[2]);
    // враги: подходят на свои места, замахиваются, бьют, отлетают от удара
    st.enemies.forEach(e => {
      if (e.dead) return;
      e.x = lab.damp(e.x, e.sx, 5, dt); e.z = lab.damp(e.z, e.sz, 5, dt);
      e.kx = lab.damp(e.kx, 0, 7, dt);
      e.lxS = lab.damp(e.lxS || 0, e.lx * 2.2, 16, dt);
      e.act = Math.max(0, (e.act || 0) - dt);
      e.g.position.x = e.x + e.kx + e.lxS;
      e.g.position.z = e.z;
      const fly = e.def.model === 'wasp' || e.def.model === 'boss2';
      e.b.position.y = fly ? 1.2 + Math.sin(t * 3 + e.bob) * 0.18 : 0;
      const K = e.k || 1;
      e.b.scale.set(K * (1 + (e.act > 0 ? 0.08 : 0)), K * (1 + Math.sin(t * 2 + e.bob) * 0.035 + (e.act > 0 ? 0.1 : 0)), K);
      e.b.rotation.z = e.act > 0 ? -0.15 : Math.sin(t * 1.6 + e.bob) * 0.03;
      if (e.wings) e.wings.forEach((w, i) => { w.rotation.x = (i ? 1 : -1) * (0.3 + Math.sin(t * 40 + e.bob) * 0.5); });
      const tg = this.target(lab) === e && st.phase === 'player';
      this.paintUnit(lab, e.ui, { name: e.def.name, hp: e.hp, max: e.max, block: e.block, str: e.str, intent: e.intent ? this.intentParts(lab, e) : null, tg });
      const pop = e.act > 0 ? 1.15 : 1;
      e.ui.sp.position.set(e.g.position.x, Math.min(4.1, e.h + (fly ? 1.5 : 0.9) + e.b.position.y * 0.3), e.z);
      e.ui.sp.scale.set(2.8 * pop, 2.2 * pop, 1);
    });
  },
  heroLunge(lab, tx, all) {
    const st = lab.state;
    st.heroLunge = all ? 1.6 : Math.max(0.8, Math.min(3.2, tx - this.HERO_AT[0] - 2.4));
    st.swing = true;
    lab.after(0.16, () => { st.swing = false; });
    lab.after(0.22, () => { st.heroLunge = 0; });
    lab.pulse(st.heroP, 1.12, 0.14);
    lab.burst([this.HERO_AT[0], 0.1, this.HERO_AT[2]], { count: 8, colors: ['#c9b79c', '#8a7e75'], speed: 2, up: 1, size: 0.1 });
  },
  // огненная дуга меча: живёт 0,15 с, попадает ровно то, что внутри
  slash(lab, at, color) {
    const st = lab.state, s = st.slashes[st.slashI++ % st.slashes.length];
    s.position.set(at.x - 0.2, at.y, at.z + 0.3);
    s.rotation.set(this.TILT - Math.PI / 2, 0, lab.rand(-0.8, 0.4));
    s.material.color.set(color).multiplyScalar(2.2);
    s.visible = true;
    lab.tween(0.16, k => { s.scale.setScalar(0.6 + k * 0.7); s.material.opacity = 1 - k; }, 'outQuad');
    lab.after(0.17, () => { s.visible = false; });
  },
  animateWorld(lab, dt) {
    const st = lab.state, t = lab.t;
    st.fires.forEach((f, i) => lab.place(st.fireInst, i, [f[0], 1.45 + Math.sin(t * 9 + i) * 0.04, f[1]], { scale: [1 + Math.sin(t * 13 + i * 2) * 0.12, 1 + Math.sin(t * 11 + i) * 0.25, 1 + Math.cos(t * 12 + i) * 0.12], rot: t * 2 + i }));
    st.flies.forEach((f, i) => {
      const x = f.x + Math.sin(t * f.s + f.p) * 1.2, y = f.y + Math.sin(t * f.s * 1.7 + f.p) * 0.4, z = f.z + Math.cos(t * f.s * 0.8 + f.p) * 1.0;
      lab.place(st.fly, i, [x, y, z], { scale: 0.6 + 0.4 * Math.max(0, Math.sin(t * 2 + f.p)) });
    });
    st.clouds.position.x = Math.sin(t * 0.03) * 6;
    st.glyph.rotation.z += dt * 0.3;
    st.glyph.material.opacity = 0.65 + Math.sin(t * 1.5) * 0.25;
    st.energyG.rotation.y = Math.sin(t * 0.5) * 0.1;
  },
  updateCamera(lab, dt) {
    const st = lab.state, v = lab.view, C = st.cam;
    if (!v || !C) return;
    if (Math.abs(v.distance - C.last) > 0.01) C.d = v.distance / C.k;
    st.punch = Math.max(0, st.punch - dt * 0.8);
    const boss = st.fight >= Math.round(lab.cfg.fights);
    C.k = lab.damp(C.k, (st.posterK || 1) * (1 - 0.06 * st.punch) * (st.phase === 'reward' ? 0.94 : 1) * (1 + Math.sin(lab.t * 0.4) * 0.006), 2, dt);
    st.posterK = 1;
    v.distance = C.d * C.k; C.last = v.distance;
    const tg = st.phase === 'enemy' ? 0.5 : st.phase === 'player' ? -0.2 : 0;
    v.target.x = lab.damp(v.target.x, C.tx + tg + Math.sin(lab.t * 0.31) * 0.12 + (boss ? 0.3 : 0), 2, dt);
    v.target.z = lab.damp(v.target.z, C.tz + Math.sin(lab.t * 0.23) * 0.08, 2, dt);
  },

  // ---------- афиша в меню: бой в разгаре, нарт в выпаде, рука веером ----------
  poster(lab) {
    const st = lab.state;
    st.enemies = [];
    [this.FOES.kop, this.FOES.volk].forEach(d => { const e = this.spawnEnemy(lab, d, false, null, true); e.x = e.sx; e.z = e.sz; });
    st.enemies[0].intent = this.FOES.kop.moves[1];
    st.enemies[1].hp = 9;
    ['udar', 'zashita', 'ogon', 'dvoinoi', 'tlepsh'].forEach((id, i) => {
      const c = { id, uid: st.uid++, die: 0 };
      this.takeSlot(lab, c, [0, 0, 0], 0); st.hand.push(c);
      const s = c.slot, off = i - 2;
      s.x = off * 1.62; s.y = this.HAND.y; s.z = this.HAND.z; s.s = 1; s.rz = -off * 0.045;
    });
    st.phase = 'player'; st.sel = 3; st.tgt = 1; st.energy = 2; st.maxE = 3; st.hero.block = 5; st.posterOn = true;
    this.layoutHand(lab, 0.5); this.animateUnits(lab, 0.016);
    st.heroLunge = 1.4; st.heroLx = 1.4; st.swing = true;
    this.slash(lab, lab.v3(st.enemies[1].sx, 0.9, st.enemies[1].sz), '#ffd9a0');
    st.slashes.forEach(s => { s.scale.setScalar(1.1); s.material.opacity = 0.9; });
    st.phase = 'boot';
    st.posterK = 0.92; st.cam.k = 0.92; lab.view.distance = st.cam.d * 0.92; st.cam.last = lab.view.distance;
  },
  unposter(lab) {
    const st = lab.state;
    if (!st.posterOn) return;
    st.posterOn = false;
    st.enemies.forEach(e => { e.g.removeFromParent(); e.ui.sp.removeFromParent(); });
    st.enemies = [];
    st.hand.forEach(c => { if (c.slot) { c.slot.busy = false; c.slot.mesh.visible = false; c.slot.card = null; } });
    st.hand = []; st.heroLunge = 0; st.heroLx = 0; st.swing = false; st.hero.block = 0; st.energy = 0; st.maxE = 0;
    st.slashes.forEach(s => { s.visible = false; });
  },
  clearHand(lab, quick) {
    const st = lab.state;
    st.hand.forEach(c => { if (c.slot) { c.slot.busy = false; c.slot.mesh.visible = false; c.slot.card = null; } });
    st.hand = [];
  },
  // вариация «Всё видно»: следующая рука — маленькие карты над рукой
  foresee(lab) {
    const st = lab.state, on = lab.cfg.foresee >= 1 && lab.cfg.bag >= 1, n = Math.round(lab.cfg.hand);
    st.fslots.forEach((s, i) => {
      const c = on && i < n ? st.draw[st.draw.length - 1 - i] : null;
      s.mesh.visible = !!c;
      if (!c) return;
      s.card = { id: c.id, die: 0 }; s.sig = null;
      this.paint(lab, s, true);
      const off = i - (n - 1) / 2;
      s.x = off * 0.82; s.y = 2.35; s.z = 2.55; s.s = 0.42; s.rz = 0;
      this.placeSlot(s);
    });
  },
  layoutRewards(lab, dt) {
    const st = lab.state;
    if (!st.rewards) return;
    st.rslots.forEach((s, i) => {
      if (!s.mesh.visible || !s.card) return;
      const sel = st.phase === 'reward' && i === st.rsel, k = s.k || 0;
      s.x = (i - 1) * 2.4;
      s.y = 1.9 + (sel ? 0.35 : 0) + (1 - k) * -1.2 + (s.go === 1 ? (1 - k) * 1.5 : 0);
      s.z = 1.9; s.rz = sel ? 0 : (i - 1) * -0.06;
      s.s = Math.max(0.01, k * (sel ? 1.3 : 1.12));
      this.placeSlot(s);
      this.paint(lab, s, true);
      if (sel) { st.halo.visible = true; st.halo.position.set(s.x, s.y - Math.cos(this.TILT) * 0.02, s.z - Math.sin(this.TILT) * 0.02); st.halo.rotation.copy(s.mesh.rotation); st.halo.scale.setScalar(s.s); }
    });
  },

  // ---------- сборка: общие формы, нарт, враги, стол, мир ----------
  assets(lab) {
    const T = lab.THREE, st = lab.state;
    st.cardGeo = new T.PlaneGeometry(1.5, 2.08);
    st.slots = Array.from({ length: 12 }, () => this.slot(lab, 256, 356));
    st.rslots = Array.from({ length: 3 }, () => this.slot(lab, 256, 356));
    st.fslots = Array.from({ length: 7 }, () => this.slot(lab, 128, 178));
    const hm = new T.MeshBasicMaterial({ color: new T.Color('#ffd36b').multiplyScalar(1.7), transparent: true, opacity: 0.9, blending: T.AdditiveBlending, depthWrite: false, side: T.DoubleSide });
    st.halo = lab.mesh(new T.PlaneGeometry(1.74, 2.32), hm, { shadow: false }); st.halo.visible = false; st.halo.renderOrder = 2;
    st.slashes = Array.from({ length: 4 }, () => {
      const m = new T.MeshBasicMaterial({ color: '#ffd9a0', transparent: true, blending: T.AdditiveBlending, depthWrite: false, side: T.DoubleSide });
      const s = lab.mesh(new T.RingGeometry(0.75, 1.05, 22, 1, 0.2, Math.PI * 0.85), m, { shadow: false });
      s.visible = false; s.renderOrder = 5;
      return s;
    });
    st.slashI = 0;
  },
  buildHero(lab) {
    const st = lab.state;
    st.heroG = lab.group({ at: this.HERO_AT });
    st.heroP = lab.group({ parent: st.heroG });
    st.heroB = lab.group({ parent: st.heroP });
    st.heroP.rotation.y = -0.45; // три четверти к камере
    const tmp = lab.group();
    const B = '#2d55d6', D = '#1d2c6e', G = '#ffd36b', S = '#e9c29b';
    for (const z of [-0.18, 0.18]) { lab.box(0.2, 0.75, 0.2, '#2a2230', { parent: tmp, at: [0, 0.38, z] }); lab.box(0.3, 0.14, 0.24, '#1a1418', { parent: tmp, at: [0.05, 0.07, z] }); }
    lab.cyl(0.36, 0.5, 1.0, B, { parent: tmp, at: [0, 1.15, 0], sides: 8 }); // черкеска
    lab.cyl(0.52, 0.56, 0.3, B, { parent: tmp, at: [0, 0.72, 0], sides: 8 }); // полы
    lab.cyl(0.42, 0.42, 0.1, G, { parent: tmp, at: [0, 0.98, 0], sides: 8, glow: 0.2 }); // пояс
    for (let i = 0; i < 4; i++) for (const z of [-0.17, 0.17]) lab.box(0.06, 0.06, 0.06, G, { parent: tmp, at: [0.32, 1.25 + i * 0.1, z], glow: 0.3 }); // газыри
    lab.box(0.12, 0.9, 0.84, D, { parent: tmp, at: [-0.34, 1.2, 0] }); // бурка за спиной
    lab.ball(0.27, S, { parent: tmp, at: [0, 1.9, 0], detail: 1 });
    lab.cyl(0.3, 0.27, 0.34, '#f1ede4', { parent: tmp, at: [0, 2.17, 0], sides: 9 }); // папаха
    lab.box(0.06, 0.05, 0.14, '#3a2414', { parent: tmp, at: [0.24, 1.84, 0] }); // усы
    lab.cyl(0.1, 0.12, 0.5, B, { parent: tmp, at: [0.05, 1.3, -0.44], rot: [0.3, 0, 0], sides: 6 }); // левая рука
    lab.merge([tmp], st.heroB);
    for (const z of [-0.1, 0.1]) {
      lab.ball(0.06, '#ffffff', { parent: st.heroB, at: [0.24, 1.95, z], detail: 0, shadow: false });
      lab.ball(0.032, '#111111', { parent: st.heroB, at: [0.29, 1.95, z], detail: 0, shadow: false });
    }
    // меч в правой руке: поворачивается при ударе
    st.sword = lab.group({ parent: st.heroB, at: [0.1, 1.35, 0.42] });
    lab.cyl(0.1, 0.12, 0.45, B, { parent: st.sword, at: [0, -0.1, 0], sides: 6 });
    lab.box(0.08, 0.16, 0.22, G, { parent: st.sword, at: [0, 0.18, 0] });
    st.bladeCold = lab.mat('#dfe8ff', { glow: 0.5 }); st.bladeHot = lab.mat('#ff8a3c', { glow: 1.2 });
    st.blade = lab.box(0.06, 1.1, 0.12, st.bladeCold, { parent: st.sword, at: [0, 0.8, 0] });
    lab.cyl(0.55, 0.55, 0.02, '#000000', { parent: st.heroG, at: [0, 0.02, 0], alpha: 0.3, shadow: false, sides: 16 }); // тень-круг
    // щит Тлепша: синий шестигранник перед нартом, растёт со значением щита
    st.shield = lab.group();
    lab.cyl(0.85, 0.85, 0.08, lab.mat('#5fb8ff', { glow: 0.9, alpha: 0.75 }), { parent: st.shield, rot: [0, 0, Math.PI / 2], sides: 6, shadow: false });
    lab.cyl(0.32, 0.32, 0.1, lab.mat('#ffe680', { glow: 1 }), { parent: st.shield, rot: [0, 0, Math.PI / 2], sides: 6, shadow: false });
    st.shield.visible = false;
    st.heroSp = this.unitSprite(lab);
  },
  // враги собираются из деталей и сливаются в несколько мешей: тело в группе b (дышит, замахивается), g — место на площадке
  buildEnemy(lab, e) {
    const st = lab.state, M = e.def.model, g = lab.group(), p = lab.group({ parent: g }), b = lab.group({ parent: p }), tmp = lab.group();
    e.g = g; e.p = p; e.b = b;
    p.rotation.y = 0.55; // три четверти к камере: видно лицо, а не бок
    let h = 2.2, cols = ['#ff5a3c', '#ffb36b'];
    const eye = (x, y, z, r, c) => lab.ball(r, c, { parent: tmp, at: [x, y, z], glow: 1.3, detail: 0 });
    if (M === 'wolf') {
      const C = '#8a9bc4', D = '#4d5a80';
      lab.box(1.3, 0.55, 0.6, C, { parent: tmp, at: [0.15, 0.78, 0] });
      lab.box(0.55, 0.65, 0.68, D, { parent: tmp, at: [-0.35, 0.95, 0] });
      lab.box(0.5, 0.48, 0.48, C, { parent: tmp, at: [-0.75, 1.12, 0] });
      lab.box(0.36, 0.22, 0.3, D, { parent: tmp, at: [-1.1, 1.0, 0] });
      for (const z of [-0.15, 0.15]) lab.cone(0.11, 0.3, D, { parent: tmp, at: [-0.68, 1.5, z], sides: 4 });
      for (const x of [-0.4, 0.55]) for (const z of [-0.2, 0.2]) lab.box(0.16, 0.55, 0.16, D, { parent: tmp, at: [x, 0.28, z] });
      lab.cone(0.13, 0.75, C, { parent: tmp, at: [0.95, 1.0, 0], rot: [0, 0, -1.1], sides: 5 });
      for (const z of [-0.14, 0.14]) eye(-0.98, 1.2, z, 0.06, '#ff5a3c');
      h = 1.6; cols = ['#5d6b8a', '#3a435c', '#ff5a3c'];
    } else if (M === 'wasp' || M === 'boss2') {
      const k = M === 'boss2' ? 2.3 : 1;
      lab.ball(0.32 * k, '#ffc21a', { parent: tmp, at: [0.15 * k, 0, 0], scale: [1.5, 1, 1], detail: 1 });
      for (const x of [0, 0.3]) lab.box(0.1 * k, 0.62 * k, 0.66 * k, '#1c1420', { parent: tmp, at: [x * k, 0, 0] });
      lab.ball(0.22 * k, '#1c1420', { parent: tmp, at: [-0.42 * k, 0.05 * k, 0], detail: 1 });
      lab.cone(0.08 * k, 0.35 * k, '#1c1420', { parent: tmp, at: [0.72 * k, -0.05 * k, 0], rot: [0, 0, -Math.PI / 2], sides: 5 });
      for (const z of [-0.1, 0.1]) eye(-0.56 * k, 0.12 * k, z * k, 0.06 * k, '#ff3b3b');
      if (k > 1) for (let i = 0; i < 5; i++) lab.cone(0.08 * k, 0.28 * k, '#ffd36b', { parent: tmp, at: [-0.42 * k + Math.cos(i * 1.26) * 0.14 * k, 0.32 * k, Math.sin(i * 1.26) * 0.14 * k], sides: 4, glow: 0.4 });
      e.wings = [-1, 1].map(s => {
        const w = lab.group({ parent: b, at: [0.05 * k, 0.28 * k, 0.1 * s * k] });
        lab.box(0.5 * k, 0.03, 0.7 * k, lab.mat('#e6f8ff', { alpha: 0.6 }), { parent: w, at: [0.1 * k, 0, 0.35 * s * k], shadow: false });
        return w;
      });
      h = M === 'boss2' ? 2.4 : 1.2; cols = ['#ffc21a', '#1c1420', '#ffffff'];
    } else { // иныжи: великаны с одним глазом
      const big = M.startsWith('boss') ? 1.35 : 1;
      const skin = { shield: '#a98bc0', club: '#c47a5e', boss0: '#a9b0c0', boss1: '#9fd6f0' }[M], vest = { shield: '#8a5e3a', club: '#7a5636', boss0: '#8a6a4a', boss1: '#3d6fa0' }[M];
      for (const z of [-0.3, 0.3]) lab.cyl(0.22, 0.27, 1.0, vest, { parent: tmp, at: [0, 0.5, z], sides: 6 });
      lab.cyl(0.58, 0.72, 1.3, vest, { parent: tmp, at: [0, 1.6, 0], sides: 7 });
      lab.cyl(0.6, 0.6, 0.18, '#2a1d14', { parent: tmp, at: [0, 1.1, 0], sides: 7 });
      for (const z of [-0.82, 0.82]) lab.cyl(0.15, 0.21, 1.15, skin, { parent: tmp, at: [-0.05, 1.55, z], rot: [z > 0 ? 0.25 : -0.25, 0, 0.2], sides: 6 });
      lab.ball(0.46, skin, { parent: tmp, at: [-0.02, 2.62, 0], detail: 1 });
      lab.ball(0.16, '#fff2a0', { parent: tmp, at: [-0.4, 2.68, 0], glow: 1.2, detail: 1 });
      lab.ball(0.07, '#2a1208', { parent: tmp, at: [-0.53, 2.68, 0], detail: 0 });
      lab.box(0.12, 0.09, 0.44, '#2a1d14', { parent: tmp, at: [-0.42, 2.88, 0], rot: [0, 0, 0.2] });
      for (const z of [-0.14, 0.14]) lab.cone(0.05, 0.22, '#f4efe0', { parent: tmp, at: [-0.4, 2.36, z], rot: [0, 0, Math.PI], sides: 4 });
      lab.cone(0.2, 0.5, '#2a1d14', { parent: tmp, at: [0.05, 3.15, 0], sides: 5 });
      if (M === 'shield') {
        lab.cyl(0.8, 0.8, 0.14, '#a0582d', { parent: tmp, at: [-0.85, 1.45, 0.25], rot: [0, 0, Math.PI / 2], sides: 10 });
        lab.cyl(0.84, 0.84, 0.08, '#5b5f66', { parent: tmp, at: [-0.8, 1.45, 0.25], rot: [0, 0, Math.PI / 2], sides: 10 });
        lab.ball(0.16, '#c9ccd2', { parent: tmp, at: [-0.95, 1.45, 0.25], detail: 0 });
      } else if (M === 'club' || M === 'boss0') {
        lab.cyl(0.14, 0.3, 1.6, '#6b4423', { parent: tmp, at: [-0.4, 1.9, 0.95], rot: [0.2, 0, 0.7], sides: 6 });
        for (let i = 0; i < 4; i++) lab.cone(0.07, 0.25, '#c9ccd2', { parent: tmp, at: [-0.85 + Math.cos(i * 1.6) * 0.1, 2.45, 0.95 + Math.sin(i * 1.6) * 0.25], rot: [i, 0, 1], sides: 4 });
      }
      if (M === 'boss0') for (const z of [-0.6, 0.6]) lab.mesh(new lab.THREE.DodecahedronGeometry(0.3, 0), '#9aa0aa', { parent: tmp, at: [0.05, 2.25, z] });
      if (M === 'boss1') for (let i = 0; i < 6; i++) lab.cone(0.12, 0.6, lab.mat('#bff4ff', { glow: 0.8 }), { parent: tmp, at: [0, 2.2 + (i % 2) * 0.6, (i - 2.5) * 0.25], rot: [(i - 2.5) * 0.3, 0, 0], sides: 4 });
      if (M === 'club') lab.cyl(0.18, 0.18, 0.1, '#ffd23f', { parent: tmp, at: [-0.4, 1.95, 0], rot: [0, 0, Math.PI / 2], sides: 6, glow: 0.3 }); // амулет-копилка
      e.k = big;
      h = 3.2 * big; cols = [skin, vest, '#fff2a0'];
    }
    lab.merge([tmp], b);
    lab.cyl(e.boss ? 1.3 : 0.75, e.boss ? 1.3 : 0.75, 0.02, '#000000', { parent: g, at: [0, 0.02, 0], alpha: 0.3, shadow: false, sides: 16 });
    e.h = h; e.cols = cols;
    e.ui = this.unitSprite(lab);
  },
  // стол боя: стопки колоды и сброса, песочные часы, кристаллы энергии, кольцо цели
  buildTable(lab) {
    const T = lab.THREE, st = lab.state;
    const back = lab.mat('#6a1f34'), edge = lab.mat('#ffd36b', { glow: 0.2 });
    const pile = at => { const g = lab.group({ at }); lab.box(1.25, 1, 1.7, back, { parent: g, at: [0, 0.5, 0] }); return g; };
    st.pileDraw = pile(this.DRAW_AT); st.pileDisc = pile(this.DISC_AT);
    lab.box(1.4, 0.06, 1.85, edge, { at: [this.DRAW_AT[0], 0.03, this.DRAW_AT[2]], shadow: false });
    lab.box(1.4, 0.06, 1.85, edge, { at: [this.DISC_AT[0], 0.03, this.DISC_AT[2]], shadow: false });
    // песочные часы у колоды: время хода
    st.glass = lab.group({ at: [this.DRAW_AT[0] + 0.1, 0, this.DRAW_AT[2] - 2.2] });
    const wood = lab.mat('#7a4a22');
    lab.cyl(0.42, 0.42, 0.1, wood, { parent: st.glass, at: [0, 0.05, 0], sides: 8 });
    lab.cyl(0.42, 0.42, 0.1, wood, { parent: st.glass, at: [0, 1.35, 0], sides: 8 });
    for (let i = 0; i < 3; i++) lab.cyl(0.04, 0.04, 1.3, wood, { parent: st.glass, at: [Math.cos(i * 2.1) * 0.36, 0.7, Math.sin(i * 2.1) * 0.36], sides: 4 });
    const glassM = lab.mat('#cfeaff', { alpha: 0.28, shiny: true });
    lab.cone(0.32, 0.6, glassM, { parent: st.glass, at: [0, 1.0, 0], rot: [Math.PI, 0, 0], sides: 10, shadow: false });
    lab.cone(0.32, 0.6, glassM, { parent: st.glass, at: [0, 0.4, 0], sides: 10, shadow: false });
    const sand = lab.mat('#ffcf5a', { glow: 0.35 });
    st.sandTop = lab.group({ parent: st.glass, at: [0, 0.72, 0] });
    lab.cone(0.27, 0.45, sand, { parent: st.sandTop, at: [0, 0.22, 0], rot: [Math.PI, 0, 0], sides: 10, shadow: false });
    st.sandBot = lab.group({ parent: st.glass, at: [0, 0.1, 0] });
    lab.cone(0.27, 0.42, sand, { parent: st.sandBot, at: [0, 0.21, 0], sides: 10, shadow: false });
    // кристаллы энергии у ног нарта
    st.energyG = lab.group({ at: [this.HERO_AT[0] + 0.3, 0, this.HERO_AT[2] + 1.6] });
    st.crystals = lab.instances(new T.OctahedronGeometry(0.17), lab.mat('#ffffff', { unlit: true, glow: 0.6 }), 8, { parent: st.energyG, shadow: false });
    for (let i = 0; i < 8; i++) lab.place(st.crystals, i, [0, -5, 0], { scale: 0.001 });
    // кольцо цели
    st.ringHot = lab.mat('#ff5a3c', { unlit: true, glow: 0.9 }); st.ringCold = lab.mat('#ffd36b', { unlit: true, glow: 0.3 });
    st.ring = lab.mesh(new T.TorusGeometry(0.95, 0.06, 6, 30), st.ringHot, { rot: [Math.PI / 2, 0, 0], shadow: false, at: [3, 0.06, -0.8] });
  },
  buildLife(lab) {
    const T = lab.THREE, st = lab.state;
    // светлячки над поляной
    st.flies = Array.from({ length: 36 }, () => ({ x: lab.rand(-13, 13), y: lab.rand(0.6, 3.5), z: lab.rand(-12, 2), s: lab.rand(0.3, 0.8), p: lab.rand(0, 6) }));
    st.fly = lab.instances(new T.OctahedronGeometry(0.06), lab.mat('#fff3a0', { unlit: true, glow: 1.4 }), st.flies.length, { shadow: false });
    const puffs = [];
    [[-34, 18, -60, 6], [-8, 22, -70, 8], [20, 17, -62, 6], [46, 20, -66, 7], [-58, 16, -48, 5]].forEach(([x, y, z, s]) => {
      for (let k = 0; k < 3; k++) puffs.push(lab.ball(s * (0.6 + k * 0.2), '#ffc7a8', { at: [x + k * s * 0.9, y + (k === 1 ? s * 0.3 : 0), z], detail: 0, shadow: false }));
    });
    st.clouds = lab.group();
    lab.merge(puffs, st.clouds);
  },
  // площадка у дольмена: плиты, менгиры, жаровни, пихты, валуны, цветы, горы на закате
  scenery(lab) {
    const T = lab.THREE, st = lab.state;
    lab.ground({ w: 220, h: 220, color: '#3f6b4a', bumps: 3, flat: 0.45 });
    // плиты площадки — три оттенка тёплого камня
    const tile = lab.instances(new T.BoxGeometry(1.36, 0.14, 1.36), '#ffffff', 72, { shadow: false });
    let n = 0;
    for (let ix = -6; ix <= 5; ix++) for (let iz = -4; iz <= 1; iz++) {
      const x = ix * 1.4 + 0.7, z = iz * 1.4 + 0.2;
      lab.place(tile, n++, [x, 0.06 + lab.rand(-0.02, 0.02), z], { rot: lab.rand(-0.04, 0.04), color: lab.pick(['#9c8f84', '#8a7e75', '#a89a8c', '#958a7f']) });
    }
    lab.box(17.6, 0.08, 9.2, '#5f574f', { at: [0, 0.02, -1.5], shadow: false }); // швы между плитами
    // дольмен за площадкой, на его двери — солнечный знак
    const dz = -6.6, dp = [], slab = (w, h, d, x, y, z) => dp.push(lab.box(w, h, d, '#878a92', { at: [x, y, z + dz] }));
    slab(0.5, 2.8, 3.2, -1.9, 1.4, 0); slab(0.5, 2.8, 3.2, 1.9, 1.4, 0); slab(4.3, 2.8, 0.5, 0, 1.4, -1.6);
    slab(4.3, 2.8, 0.5, 0, 1.4, 1.6); slab(5.1, 0.55, 4.4, 0, 3.05, 0);
    dp.push(lab.cyl(0.5, 0.5, 0.1, '#25262c', { at: [0, 1.2, dz + 1.86], rot: [Math.PI / 2, 0, 0], sides: 12 }));
    lab.merge(dp);
    const gm = new T.MeshBasicMaterial({ color: new T.Color('#ffb36b').multiplyScalar(1.8), transparent: true, opacity: 0.8, blending: T.AdditiveBlending, depthWrite: false, side: T.DoubleSide });
    st.glyph = lab.mesh(new T.RingGeometry(0.62, 0.74, 8), gm, { at: [0, 1.2, dz + 1.92], shadow: false });
    // менгиры по кругу площадки
    const men = lab.instances(new T.BoxGeometry(0.6, 2.2, 0.45), '#7d7f88', 12);
    [[-8.4, -4], [-8.8, -1.2], [-8.2, 1.4], [8.4, -4], [8.8, -1.2], [8.2, 1.4], [-6.2, -5.6], [6.2, -5.6], [-3.6, -6.4], [3.6, -6.4], [-9.6, 3.6], [9.6, 3.6]].forEach(([x, z], i) =>
      lab.place(men, i, [x, 1.0, z], { rot: [lab.rand(-0.08, 0.08), lab.rand(0, 3), lab.rand(-0.08, 0.08)], scale: [1, lab.rand(0.7, 1.25), 1] }));
    // жаровни на треногах — тёплый свет площадки
    st.fires = [[-7.2, -2.6], [7.2, -2.6], [-7.4, 2.4], [7.4, 2.4]];
    const legs = [];
    st.fires.forEach(([x, z]) => {
      for (let i = 0; i < 3; i++) legs.push(lab.cyl(0.04, 0.05, 1.3, '#3a2a20', { at: [x + Math.cos(i * 2.1) * 0.22, 0.6, z + Math.sin(i * 2.1) * 0.22], rot: [Math.sin(i * 2.1) * 0.2, 0, -Math.cos(i * 2.1) * 0.2], sides: 4 }));
      legs.push(lab.cyl(0.38, 0.22, 0.25, '#4a3a30', { at: [x, 1.25, z], sides: 8 }));
    });
    lab.merge(legs);
    st.fireInst = lab.instances(new T.ConeGeometry(0.28, 0.6, 6), lab.mat('#ff8a2a', { glow: 1.6 }), 4, { shadow: false });
    // пихты по краю поляны
    const N = 40, trunk = lab.instances(new T.CylinderGeometry(0.15, 0.2, 0.8, 5), '#4a3424', N), crown = lab.instances(new T.ConeGeometry(0.55, 1, 6), '#ffffff', N * 2);
    let k = 0;
    for (let i = 0; i < 500 && k < N; i++) {
      const x = lab.rand(-26, 26), z = lab.rand(-30, 4);
      if (Math.abs(x) < 11 && z > -9) continue;
      const hh = lab.rand(2.4, 5), col = lab.pick(['#1f4a3a', '#24573f', '#2c6446']);
      lab.place(trunk, k, [x, 0.4, z]);
      lab.place(crown, k * 2, [x, 0.8 + hh * 0.42, z], { scale: [hh * 0.75, hh * 0.9, hh * 0.75], rot: lab.rand(0, 3), color: col });
      lab.place(crown, k * 2 + 1, [x, 0.8 + hh * 0.92, z], { scale: [hh * 0.5, hh * 0.6, hh * 0.5], rot: lab.rand(0, 3), color: col });
      k++;
    }
    const boulder = lab.instances(new T.DodecahedronGeometry(0.6, 0), '#8f9098', 18);
    for (let i = 0; i < 18; i++) { const s = lab.rand(0.5, 1.5); lab.place(boulder, i, [lab.pick([-1, 1]) * lab.rand(9.5, 16), s * 0.2, lab.rand(-10, 7)], { scale: [s, s * 0.6, s], rot: lab.rand(0, 3) }); }
    const flower = lab.instances(new T.CylinderGeometry(0.11, 0.11, 0.08, 5), '#ffffff', 40, { shadow: false });
    const tuft = lab.instances(new T.ConeGeometry(0.16, 0.45, 4), '#ffffff', 50, { shadow: false });
    let f = 0, tf = 0;
    for (let i = 0; i < 400 && (f < 40 || tf < 50); i++) {
      const x = lab.rand(-16, 16), z = lab.rand(-12, 8);
      if (Math.abs(x) < 8.9 && z > -6 && z < 3) continue;
      if (f < 40 && i % 2) lab.place(flower, f++, [x, 0.06, z], { color: lab.pick(['#ffffff', '#ff7eb6', '#ffe14d', '#b48cff']) });
      else if (tf < 50) lab.place(tuft, tf++, [x, 0.2, z], { rot: lab.rand(0, 3), scale: lab.rand(0.7, 1.4), color: lab.pick(['#3f7a46', '#4c8a4a', '#36683c']) });
    }
    // горы на закате со снегом
    const hills = [];
    [[-44, -72, 30, 16], [-14, -82, 42, 20], [18, -76, 32, 15], [48, -66, 24, 12], [2, -60, 16, 9], [-64, -52, 20, 11], [66, -50, 18, 10]].forEach(([x, z, hh, r]) => {
      const a = lab.rand(0, 1);
      hills.push(lab.cone(r, hh, '#6b5a8e', { at: [x, hh / 2 - 0.5, z], sides: 6, rot: a }));
      hills.push(lab.cone(r * 0.36, hh * 0.34, '#ffd9c8', { at: [x, hh * 0.83 - 0.5, z], sides: 6, rot: a }));
    });
    lab.merge(hills);
  },
};
