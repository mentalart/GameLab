// «Рой» — ремейк-донор урока 10 по мотивам механики Vampire Survivors, на оболочке «Лаб3D 1.0» (three.js).
// Урок 10 «Интересные решения: риск и награда». Оружие бьёт само, игрок только бегает и выбирает: куда бежать и какое из трёх улучшений взять.
// Лучшие игры жанра, из которых взяты моменты (разбор — docs/01_Журнал_курса.md, раздел урока 10):
//   Vampire Survivors — оружие стреляет само, кристаллы опыта там, где враг умер, выбор одного из трёх улучшений, эволюция двух вещей,
//            Переброс карточек, Проклятие (врагов больше — и наград больше), кольцо роя, которое окружает героя;
//   Brotato — у каждого улучшения есть минус, магазин между волнами за собранные материалы;
//   Risk of Rain 2 — святилища: рискни сейчас ради награды потом (здесь алтарь риска);
//   Magic Survival и 20 Minutes Till Dawn — ветки улучшений и большой босс, который роняет сундук;
//   Halls of Torment — элита с полоской прочности и замахом, который видно заранее.
// Ось Z в three.js смотрит на игрока: вид сверху наискосок, герой в середине кадра, поле бесконечное — мир вокруг героя повторяется.
/* ПЛАН
   Фраза игры: ты — юный нарт с огненным посохом, ты держишься у костра на ночном плато Лаго-Наки, но из темноты
   летит рой: мошкара, шершни, летучие мыши и жуки-каменщики. Цель — продержаться как можно дольше и собрать сборку, которая косит всех.
   Ядро на 3 секунды: бежишь → посох сам бьёт огнём в ближайшего → враг лопается, на земле вспыхивает кристалл → подобрал — опыт растёт.
   Выбор, оплаченный очками: бежать за крупным золотым кристаллом в гущу роя (очки ×2, опыт ×3) или собирать мелкие по краю;
   на каждом уровне — одно из трёх улучшений: урон, защита, подбор или скорость; рывок — уйти из окружения, но он перезаряжается.
   Угрозы: мошкара (стаей, много, слабая), шершень (быстрый, зигзагом), летучая мышь (замирает, глаза вспыхивают — и налёт по прямой),
   жук-каменщик (медленный, бронированный, толкает), иныж (элита: полоска прочности, замах с кругом на земле, роняет сундук).
   Кривая партии: 0–8 с — редкая мошкара, урона нет; 12 с — шершни; 26 с — летучие мыши; 40 с — жуки; 45 с — кольцо роя окружает;
   60 с — первый иныж; дальше каждые 35 с кольцо, каждые 60 с иныж; рой растёт всю партию, после 150 с — звереет.
   События: новый уровень (мир замер, три карточки), сундук иныжа, кольцо роя, иныж идёт, серия кристаллов ×2…×5, сгоревшая серия,
   щит бурки, молот Тлепша по толпе, молния Шибле цепью, связка двух улучшений, алтарь риска, «Ты продержался 3 минуты!».
   Лицо игры: тёмно-синяя ночь плато, рододендроны и камни в лунном свете, тёплый круг огня вокруг героя — и красные глаза роя из темноты.
   Свет: холодная луна ключом, тёплый свет посоха под героем.
   Палитра: ночь #0a1030, трава #1d3a3a, огонь героя #ff9a3d, плащ героя #2fe6c8, кристаллы #4fd2ff и #ffd23f, глаза роя #ff3d5a.
   Три фирменных приёма: тёплое пятно света вокруг героя в синей ночи; красные глаза роя, которые светятся из темноты;
   кристаллы-звёздочки на траве, которые летят к герою дугой и звенят выше с каждой подряд.
*/
const GAME = {
  engine: 'three',
  title: 'Рой',
  subtitle: 'Ночь на Лаго-Наки, из темноты летит рой. Посох бьёт сам — ты бегаешь, собираешь кристаллы и выбираешь улучшения.',
  donor: 'Vampire Survivors',
  players: 1,
  controls: [
    { input: 'move4', text: 'бежать · ← → выбрать карточку' },
    { input: 'a', text: 'рывок · взять карточку' },
    { input: 'b', text: 'рывок · в «Перебросе» — новые карточки' },
  ],
  camera: { type: 'iso', tilt: 0.72, fov: 0.7 },
  field: { w: 21, h: 15 },
  shadowSize: 20,
  sky: ['#070b22', '#1a2a50'],
  fog: 0.014,
  accent: '#ffd23f',
  scoreColor: '#ffd23f',
  decisions: [
    'Чувство: рой всё гуще, а твоя сборка косит его всё шире — на пятой минуте экран полон врагов, и ты всё ещё жив',
    'Честность: враг виден заранее и светит красными глазами, мышь замирает перед налётом, иныж замахивается с кругом на земле; первые 8 с урона нет',
    'Выбор: какое из трёх улучшений взять — у каждого своя выгода; бежать ли за золотым кристаллом в гущу роя',
  ],
  notes: [
    'Пока выбираешь карточку, мир замер, но не дольше ручки «Время на выбор»: потом карточка в середине берётся сама — бездействие не вешает игру.',
    'Первые 8 секунд враги не ранят: время понять, что оружие бьёт само.',
    'Мир вокруг героя повторяется плитками по 44 м: камни, кусты и трава переставляются, когда герой уходит далеко.',
  ],
  config: {
    secret: { value: 1, min: 0, max: 1, step: 1, label: 'Спрятанная механика', hint: '1 — как задумано; 0 — выключена' },
    spawn: { value: 0.8, min: 0.2, max: 4, step: 0.1, label: 'Врагов в секунду на старте' },
    grow: { value: 0.8, min: 0, max: 3, step: 0.1, label: 'Рост роя: + столько раз начального за минуту' },
    lives: { value: 4, min: 1, max: 9, step: 1, label: 'Жизни (сердца)', restart: true },
    damage: { value: 1, min: 0.3, max: 3, step: 0.1, label: 'Урон оружия, множитель' },
    speed: { value: 5.5, min: 2, max: 10, step: 0.5, label: 'Скорость бега, м/с' },
    magnet: { value: 2.2, min: 0.3, max: 6, step: 0.1, label: 'Радиус подбора кристаллов, м' },
    xpNeed: { value: 4, min: 2, max: 20, step: 1, label: 'Опыта до второго уровня', hint: 'каждый следующий уровень дороже наполовину от этого числа' },
    pickTime: { value: 8, min: 3, max: 20, step: 1, label: 'Время на выбор карточки, с', hint: 'потом карточка в середине берётся сама' },
    elite: { value: 60, min: 0, max: 180, step: 5, label: 'Иныж приходит раз в, с', hint: '0 — без иныжей' },
    dashCd: { value: 2.2, min: 0.5, max: 6, step: 0.1, label: 'Перезарядка рывка, с' },
    ringEvery: { value: 35, min: 0, max: 90, step: 5, label: 'Кольцо роя окружает раз в, с', hint: 'как в Vampire Survivors; 0 — без колец' },
    goal: { value: 0, min: 0, max: 600, step: 30, label: 'Цель: продержись, с', hint: '0 — без цели; на цели — праздник, и игра идёт дальше на рекорд' },
    // вариации жанра из настоящих игр: 0 — как в классике
    minus: { value: 0, min: 0, max: 1, step: 1, label: 'Вариация «Минусы»: у улучшений есть минус', hint: 'как в Brotato: плюс сильнее на 30 %, но что-то становится хуже' },
    evolve: { value: 0, min: 0, max: 1, step: 1, label: 'Вариация «Связки»: два улучшения на 3-й ступени дают третье', hint: 'как эволюции Vampire Survivors' },
    reroll: { value: 0, min: 0, max: 5, step: 1, label: 'Вариация «Переброс»: новых карточек за партию (B)', hint: 'как Reroll в Vampire Survivors; 0 — без перебросов', restart: true },
    altar: { value: 0, min: 0, max: 1, step: 1, label: 'Вариация «Алтарь риска»: раз в 40 с', hint: 'как Проклятие в Vampire Survivors и святилища Risk of Rain: встал на алтарь — врагов ×2 на 20 с, опыт ×2' },
    vacuum: { value: 0, min: 0, max: 1, step: 1, label: 'Вариация «Пылесос»: кристаллы летят к герою сами' },
    shop: { value: 0, min: 0, max: 1, step: 1, label: 'Вариация «Магазин»: без уровней, магазин между волнами по 30 с', hint: 'как в Brotato: кристаллы — деньги', restart: true },
  },
  presets: {
    'Новичок': { spawn: 0.6, grow: 0.6, lives: 6, speed: 6, magnet: 2.8, xpNeed: 3, pickTime: 12, elite: 75, ringEvery: 45 },
    'Без спрятанной механики': { secret: 0 },
    // вариации из настоящих игр: те же значения — в сценарии урока 10 (VARIATIONS), держать вместе
    'Минусы': { minus: 1 },
    'Связки': { evolve: 1 },
    'Переброс': { reroll: 3 },
    'Алтарь риска': { altar: 1 },
    'Пылесос': { vacuum: 1 },
    'Магазин': { shop: 1 },
    'Три минуты': { goal: 180 },
  },
  VARIANTS: [
    { key: 'minus', name: 'Минусы', like: 'Brotato', how: () => 'у каждого улучшения плюс сильнее, но есть минус' },
    { key: 'evolve', name: 'Связки', like: 'эволюции Vampire Survivors', how: () => 'две вещи на 3-й ступени вместе дают третью 🔗' },
    { key: 'reroll', name: 'Переброс', like: 'Reroll в Vampire Survivors', how: c => `B — новые карточки, ${Math.round(c.reroll)} раза за партию` },
    { key: 'altar', name: 'Алтарь риска', like: 'Проклятие в Vampire Survivors и святилища Risk of Rain 2', how: () => 'встань на алтарь: врагов ×2 на 20 с, опыт ×2' },
    { key: 'vacuum', name: 'Пылесос', like: 'подбор-пылесос из Vampire Survivors', how: () => 'все кристаллы летят к тебе сами' },
    { key: 'shop', name: 'Магазин', like: 'Brotato', how: () => 'уровней нет: после каждой волны магазин за кристаллы' },
    { key: 'goal', name: 'Продержись', like: 'цель Vampire Survivors — 30 минут', how: c => `продержись ${GAME.clock(c.goal)}` },
  ],
  // улучшения: имя, направление, ступени, цвет; tips — что даёт следующая ступень; minus — минус в вариации «Минусы»; pair — связка
  UPG: {
    posoh: { name: 'Огненный посох', cat: 'урон', max: 5, color: '#ff9a3d', tips: ['стреляет в ближайшего', 'урон ×1,5', '+1 огненный шар', 'стреляет чаще', '+1 шар, прожигает насквозь'], minus: ['speed', 0.07], pair: 'sapogi', evo: 'solnce' },
    kolco: { name: 'Кольцо искр', cat: 'урон', max: 5, color: '#fff0a0', tips: ['2 искры кружат вокруг', '+1 искра', 'урон ×1,5', '+1 искра, круг шире', '+2 искры'], minus: ['magnet', 0.3], pair: 'magnit', evo: 'venec' },
    dymar: { name: 'Дымарь', cat: 'урон', max: 5, color: '#b9a8ff', tips: ['дым жжёт всех рядом', 'дым шире', 'урон ×1,5', 'дым ещё шире', 'в дыму враги вдвое медленнее'], minus: ['speed', 0.07], pair: 'burka', evo: 'tucha' },
    molot: { name: 'Молот Тлепша', cat: 'урон', max: 5, color: '#ffb04a', tips: ['бьёт по толпе раз в 3 с', 'урон ×1,5', 'раз в 2,4 с', 'удар шире', 'два молота разом'], minus: ['dmg', 0.08], pair: 'molniya', evo: 'grom' },
    molniya: { name: 'Молния Шибле', cat: 'урон', max: 5, color: '#d8c8ff', tips: ['цепь по 3 врагам раз в 2 с', '+2 врага в цепи', 'раз в 1,5 с', 'урон ×1,5', '+3 врага в цепи'], minus: ['magnet', 0.3], pair: 'molot', evo: 'grom' },
    burka: { name: 'Бурка', cat: 'защита', max: 5, color: '#5fe0c8', tips: ['щит от удара раз в 20 с', 'щит раз в 16 с', 'щит раз в 13 с', 'щит раз в 10 с', 'щит раз в 8 с'], minus: ['dmg', 0.08], pair: 'dymar', evo: 'tucha' },
    serdce: { name: 'Сердце', cat: 'защита', max: 99, color: '#ff6a8a', tips: ['+1 жизнь'], minus: ['speed', 0.05] },
    sapogi: { name: 'Сапоги', cat: 'скорость', max: 5, color: '#7cf5a8', tips: ['бег +12 %, рывок чаще'], minus: ['dmg', 0.08], pair: 'posoh', evo: 'solnce' },
    magnit: { name: 'Магнит', cat: 'подбор', max: 5, color: '#4fd2ff', tips: ['подбор кристаллов +0,8 м'], minus: ['speed', 0.05], pair: 'kolco', evo: 'venec' },
  },
  // спрятанная механика выключена: одна карточка всегда явно лучше двух других
  JUNK: {
    sila: { name: 'Сила нарта', cat: 'урон', color: '#ff5a3d', tip: '+40 % урона всему', worth: 3 },
    shnurok: { name: 'Шнурок', cat: 'скорость', color: '#8a9a8a', tip: 'бег +2 %', worth: 0.2 },
    pugovica: { name: 'Пуговица', cat: 'подбор', color: '#8a8a9a', tip: 'подбор +0,1 м', worth: 0.2 },
  },
  // связки (вариация «Связки»): две вещи на 3-й ступени — карточка 🔗
  EVO: {
    solnce: { name: 'Солнечный посох', from: ['posoh', 'sapogi'], color: '#ffe27a', tip: 'шаров вдвое больше, все насквозь' },
    venec: { name: 'Звёздный венец', from: ['kolco', 'magnit'], color: '#fff6c8', tip: 'искр вдвое больше, круг шире' },
    tucha: { name: 'Туча Тлепша', from: ['dymar', 'burka'], color: '#d0c0ff', tip: 'дым втрое шире и жжёт сильнее' },
    grom: { name: 'Гром Шибле', from: ['molot', 'molniya'], color: '#ffe0ff', tip: 'каждый молот бьёт ещё и молнией' },
  },
  FOES: {
    moshka: { name: 'Мошкара', hp: 1, speed: 2.6, r: 0.32, y: 0.75, xp: 1, pts: 1, cap: 280, color: '#7a4aa8' },
    shershen: { name: 'Шершень', hp: 3, speed: 3.8, r: 0.36, y: 0.95, xp: 2, pts: 2, cap: 90, color: '#ff7a2a' },
    mysh: { name: 'Летучая мышь', hp: 2, speed: 3.2, r: 0.42, y: 1.15, xp: 1, pts: 2, cap: 70, color: '#6a3a8a' },
    zhuk: { name: 'Жук-каменщик', hp: 10, speed: 1.6, r: 0.7, y: 0, xp: 3, pts: 5, cap: 50, color: '#3f5a40' },
  },
  TILE: 44, // плитка мира: декор повторяется вокруг героя
  CAPS: { small: 420, big: 140, balls: 90, sparks: 14, puffs: 12, bolts: 70, splats: 70 },
  clock(s) { s = Math.max(0, Math.floor(s)); return `${Math.floor(s / 60)}:${String(s % 60).padStart(2, '0')}`; },

  // ---------- новая партия ----------
  start(lab, scene) {
    const T = lab.THREE, st = lab.state, cfg = lab.cfg;
    Object.assign(st, {
      wt: 0, foes: [], gems: [], balls: [], segs: [], splats: [], lv: { posoh: 1 }, evo: {}, sila: 0, junk: { shnurok: 0, pugovica: 0 },
      minus: { speed: 0, dmg: 0, magnet: 0 }, boost: {}, xp: 0, level: 1, money: 0, spawnAcc: 0, kills: 0, picks: 0, dangerPicks: 0,
      offers: 0, fair: 0, chain: 0, bestChain: 0, shotT: 1.2, ringA: 0, smokeT: 0, hammerT: 2.5, boltT: 1.5, shieldT: 0, shield: false,
      eliteT: cfg.elite, elites: 0, eliteKills: 0, chests: 0, altarT: 30, altars: 0, curse: 0, ringT: 45, rings: 0, said: {},
      rerolls: Math.round(cfg.reroll), choice: null, goalDone: false, alarm: null, alarmT: 0, waveT: 30, wave: 1, near: 0, wrapAt: null,
      taken: [], wild: false,
      tmp: { m: new T.Matrix4(), q: new T.Quaternion(), e: new T.Euler(), s: new T.Vector3(), p: new T.Vector3(), c: new T.Color(), zero: new T.Matrix4().makeScale(0, 0, 0) },
    });
    st.need = this.need(lab, 1);
    lab.light.sun.color.set('#b4c4ff'); lab.light.sun.intensity = 1.5;
    lab.light.hemi.intensity = 1.05;
    this.scenery(lab, scene);
    this.heroBuild(lab, scene);
    this.foeParts(lab);
    this.weaponParts(lab, scene);
    this.eliteBuild(lab);
    this.extrasBuild(lab);
    this.cardsBuild(lab, scene);
    this.derive(lab);
    lab.follow(st.hero.g, { lag: 0.16 });
    const v = lab.view;
    st.cam = { d: v.distance, k: 1, punch: 0, last: v.distance, tilt: v.tilt };
    if (!lab.playing) this.poster(lab);
    this.wrapWorld(lab, true);
    this.draw(lab, 0);
  },
  need(lab, L) { return Math.round(lab.cfg.xpNeed * (1 + 0.5 * (L - 1))); },

  // афиша в меню: нарт в гуще роя, вокруг кружат искры, стелется дым, на траве россыпь кристаллов, сзади идёт иныж.
  // Первый кадр партии всё убирает: партия начинается с пустой ночи и одного посоха
  poster(lab) {
    const st = lab.state;
    st.posterOn = true;
    Object.assign(st.lv, { posoh: 3, kolco: 3, dymar: 2 });
    this.derive(lab);
    const types = ['moshka', 'moshka', 'moshka', 'shershen', 'mysh', 'zhuk'];
    for (let i = 0; i < 64; i++) {
      const a = lab.rand(0, Math.PI * 2), r = lab.rand(2.6, 10.5), t = lab.pick(types);
      const e = this.spawnFoe(lab, t, Math.cos(a) * r, Math.sin(a) * r * 0.8 - 1);
      e.age = lab.rand(1, 5);
    }
    for (let i = 0; i < 34; i++) { const a = lab.rand(0, Math.PI * 2), r = lab.rand(1.6, 8); this.dropGem(lab, Math.cos(a) * r, Math.sin(a) * r, lab.chance(0.25)); }
    for (let i = 0; i < 4; i++) { const a = -1.2 + i * 0.8; st.balls.push({ x: Math.cos(a) * (1.5 + i), z: Math.sin(a) * (1.5 + i) - 1, vx: Math.cos(a) * 14, vz: Math.sin(a) * 14, life: 1, pierce: 0, dmg: 0 }); }
    this.eliteSpawn(lab, 3.2, -5.6);
    const el = st.elite; el.g.scale.setScalar(1.35); el.g.rotation.y = Math.atan2(-3.2, 5.6); el.bar.position.set(el.x, 4.3, el.z); el.bar.quaternion.copy(lab.camera.quaternion); el.fill.scale.x = 0.7;
    st.ringA = 0.8;
    const C = st.cam; C.k = 0.78; lab.view.distance = C.d * C.k; C.last = lab.view.distance;
  },
  unposter(lab) {
    const st = lab.state;
    st.posterOn = false;
    st.foes.length = 0; st.gems.length = 0; st.balls.length = 0;
    st.lv = { posoh: 1 }; this.derive(lab);
    if (st.elite) { st.elite.g.visible = false; st.elite.bar.visible = false; st.elite = null; }
    st.elites = 0;
  },
  variant(lab) {
    const cfg = lab.cfg, on = this.VARIANTS.filter(v => cfg[v.key] > 0);
    if (!on.length) return { name: 'Классика', like: 'Vampire Survivors', how: 'держись против роя и выбирай улучшения' };
    return { name: on.map(v => v.name).join(' + '), like: on.map(v => v.like).join(', '), how: on.map(v => v.how(cfg)).join('; ') };
  },

  // ---------- каждый кадр ----------
  update(lab, dt) {
    const st = lab.state;
    if (st.posterOn) this.unposter(lab);
    if (!st.banner) { // имя вариации и её правило крупно в начале партии
      st.banner = true;
      const v = this.variant(lab), h = st.hero;
      lab.popup(lab.v3(h.x, 3.4, h.z), v.name, '#ffe680', 32);
      lab.after(0.4, () => lab.popup(lab.v3(st.hero.x, 2.4, st.hero.z), v.how, '#ffffff', 17));
    }
    if (st.choice) { this.tickChoice(lab, dt); this.liveCamera(lab, dt); this.hudLines(lab); return; }
    st.wt += dt;
    this.moveHero(lab, dt);
    this.spawner(lab, dt);
    this.grid(lab);
    this.moveFoes(lab, dt);
    this.weapons(lab, dt);
    this.moveBalls(lab, dt);
    this.moveGems(lab, dt);
    this.moveElite(lab, dt);
    this.extras(lab, dt);
    this.wrapWorld(lab, false);
    this.life(lab, dt);
    this.draw(lab, dt);
    this.liveCamera(lab, dt);
    this.hudLines(lab);
    lab.stat('продержался, с', Math.round(st.wt));
    lab.stat('уровень', st.level);
    lab.stat('риск, %', st.picks ? Math.round(100 * st.dangerPicks / st.picks) : 0);
    lab.stat('сборка', this.buildText(lab));
  },

  hudLines(lab) {
    const st = lab.state, cfg = lab.cfg, v = this.variant(lab);
    if (cfg.shop >= 1) lab.hud('lvl', `Волна ${st.wave} · до магазина ${Math.max(0, Math.ceil(st.waveT))} с · 💎 ${st.money}`, { color: '#4fd2ff', size: 15 });
    else {
      const k = lab.clamp(st.xp / st.need, 0, 1), n = Math.round(k * 10);
      lab.hud('lvl', `Уровень ${st.level}  ${'█'.repeat(n)}${'░'.repeat(10 - n)}`, { color: '#4fd2ff', size: 15 });
    }
    lab.hud('time', `⏱ ${this.clock(st.wt)}` + (cfg.goal > 0 ? ` из ${this.clock(cfg.goal)}` + (st.goalDone ? ' ✓' : '') : ''), { color: '#e8ecff', size: 15 });
    const m = this.mult(lab);
    lab.hud('mult', st.chain >= 5 ? `Кристаллов подряд без урона: ${st.chain}` + (m > 1 ? ` · очки ×${m}` : '') : null, { color: '#7cf5a8', size: m > 1 ? 15 : 13 });
    lab.hud('build', 'Сборка: ' + this.buildText(lab), { color: '#ffd9a0', size: 13 });
    lab.hud('rule', `${v.name}: ${v.how}`, { color: '#ffe680', size: 13 });
    const bu = st.lv.burka || 0;
    lab.hud('shield', bu ? (st.shield ? '🛡 Бурка готова' : `🛡 Бурка через ${Math.ceil(st.shieldT)} с`) : null, { color: '#5fe0c8', size: 13 });
    lab.hud('curse', st.curse > 0 ? `🔥 Проклятие алтаря: ${Math.ceil(st.curse)} с · врагов ×2 · опыт ×2` : null, { color: '#ff6a5a', size: 15 });
    lab.hud('reroll', cfg.reroll > 0 ? `🎲 Перебросов: ${st.rerolls}` : null, { color: '#ffe680', size: 13 });
    lab.hud('alarm', st.alarmT > 0 ? st.alarm : null, { color: '#ff5a6a', size: 18 });
    const c = st.choice;
    lab.hud('choice', c ? (c.kind === 'shop' ? `Магазин · 💎 ${st.money} · ← → выбрать, A — купить, B — в бой · ${Math.ceil(c.time - c.t)} с`
      : `${c.kind === 'chest' ? 'Сундук иныжа' : 'Новый уровень ' + st.level}! ← → выбрать, A — взять${cfg.reroll > 0 ? ', B — переброс' : ''} · само через ${Math.ceil(c.time - c.t)} с`) : null, { color: '#ffffff', size: 16 });
  },
  buildText(lab) {
    const st = lab.state, out = [];
    for (const id in st.lv) if (st.lv[id] > 0 && id !== 'serdce') out.push(`${this.short(id)} ${st.lv[id]}`);
    for (const id in st.evo) out.push(this.EVO[id].name);
    if (st.sila) out.push(`Сила ${st.sila}`);
    return out.join(' · ');
  },
  short(id) { return { posoh: 'Посох', kolco: 'Кольцо', dymar: 'Дымарь', molot: 'Молот', molniya: 'Молния', burka: 'Бурка', sapogi: 'Сапоги', magnit: 'Магнит' }[id] || id; },
  mult(lab) { return Math.min(5, 1 + Math.floor(lab.state.chain / 20)); },

  overNote(lab) {
    const st = lab.state, v = this.variant(lab), risk = st.picks ? Math.round(100 * st.dangerPicks / st.picks) : 0;
    const out = [`Вариация: ${v.name} (как ${v.like}) — ${v.how}`,
      `Продержался ${this.clock(st.wt)}, уровень ${st.level}, сбито ${st.kills}` + (st.eliteKills ? `, иныжей ${st.eliteKills}` : ''),
      `Сборка: ${this.buildText(lab) || 'только посох'}`,
      `Риск: ${risk}% кристаллов взято в гуще роя (${st.dangerPicks} из ${st.picks}), лучшая серия — ${st.bestChain}`,
      `Выборов было ${st.offers}, из них без очевидно лучшей карточки — ${st.fair}`];
    if (lab.cfg.secret < 1) out.push('Спрятанная механика выключена: одна карточка всегда лучше, кристаллы летят сами. Было что решать?');
    return out;
  },

  // ---------- мир: ночное плато, костёр, рододендроны; всё повторяется вокруг героя ----------
  scenery(lab, scene) {
    const T = lab.THREE, st = lab.state, S = this.TILE;
    st.ground = lab.mesh(new T.PlaneGeometry(200, 200).rotateX(-Math.PI / 2), lab.mat('#23453f', { rough: 1 }), { shadow: false });
    st.ground.receiveShadow = true;
    const dec = st.decor = [];
    const add = (im, n, fn) => { im.frustumCulled = false; const items = []; for (let i = 0; i < n; i++) items.push(fn(i)); dec.push({ im, items }); items.forEach((it, i) => { if (it.color) im.setColorAt(i, st.tmp.c.set(it.color)); }); if (im.instanceColor) im.instanceColor.needsUpdate = true; };
    const R = () => lab.rand(-S / 2, S / 2);
    // пятна травы двух оттенков: земля не одной плоскостью
    add(lab.instances(new T.CircleGeometry(1, 7).rotateX(-Math.PI / 2), '#ffffff', 70, { shadow: false }), 70, () => ({ x: R(), z: R(), y: 0.02, rot: lab.rand(0, 6), s: [lab.rand(1.5, 4), 1, lab.rand(1.2, 3)], color: lab.pick(['#2a5244', '#1d3a3c', '#30583f', '#26404c', '#2c4a3a']) }));
    // кочки травы
    add(lab.instances(new T.ConeGeometry(0.12, 0.45, 4), '#ffffff', 300, { shadow: false }), 300, () => ({ x: R(), z: R(), y: 0.2, rot: lab.rand(0, 3), s: [1, lab.rand(0.6, 1.4), 1], color: lab.pick(['#2f5a4a', '#386650', '#2a4e48', '#3d6a52']) }));
    // рододендроны Лаго-Наки: тёмные кусты с розовыми цветами
    const bushes = [];
    add(lab.instances(new T.IcosahedronGeometry(0.6, 0), '#ffffff', 46), 46, () => { const b = { x: R(), z: R(), y: 0.35, rot: lab.rand(0, 6), s: [lab.rand(0.8, 1.4), lab.rand(0.6, 0.9), lab.rand(0.8, 1.3)], color: lab.pick(['#1f4a3a', '#24523e', '#1c4236']) }; bushes.push(b); return b; });
    add(lab.instances(new T.IcosahedronGeometry(0.11, 0), lab.mat('#ffffff', { unlit: true }), 140, { shadow: false }), 140, i => { const b = bushes[i % bushes.length], a = lab.rand(0, 6); return { x: b.x + Math.cos(a) * 0.55 * b.s[0], z: b.z + Math.sin(a) * 0.5 * b.s[2], y: 0.45 + lab.rand(0, 0.25), s: 1, color: lab.pick(['#d86aa8', '#e88ac0', '#c05a98', '#f0a0d0']) }; });
    // камни плато: светлые в лунном свете
    add(lab.instances(new T.DodecahedronGeometry(0.5, 0), '#ffffff', 40), 40, () => ({ x: R(), z: R(), y: 0.15, rot: lab.rand(0, 6), s: [lab.rand(0.5, 1.6), lab.rand(0.4, 0.9), lab.rand(0.5, 1.4)], color: lab.pick(['#6a7690', '#5a6680', '#7a86a0']) }));
    // низкие пихточки — ориентиры, которые не закрывают рой
    const firs = [];
    add(lab.instances(new T.ConeGeometry(0.7, 1.9, 6), '#ffffff', 16), 16, () => { const f = { x: R(), z: R(), y: 1.25, rot: lab.rand(0, 6), s: lab.rand(0.8, 1.3), color: lab.pick(['#183a34', '#1c4038', '#143430']) }; firs.push(f); return f; });
    add(lab.instances(new T.CylinderGeometry(0.1, 0.14, 0.5, 5), '#3a2c2a', 16), 16, i => ({ x: firs[i].x, z: firs[i].z, y: 0.25, s: firs[i].s }));
    // светлячки — свои, летают вокруг героя
    st.flies = [...Array(40)].map(() => ({ x: lab.rand(-14, 14), z: lab.rand(-11, 11), y: lab.rand(0.4, 2.2), ph: lab.rand(0, 6) }));
    const fg = new T.BufferGeometry(); fg.setAttribute('position', new T.Float32BufferAttribute(new Float32Array(st.flies.length * 3), 3));
    st.fliesPts = new T.Points(fg, new T.PointsMaterial({ color: '#d8ff7a', size: 0.2, transparent: true, blending: T.AdditiveBlending, depthWrite: false, fog: false }));
    st.fliesPts.frustumCulled = false; st.fliesPts.userData.noShadow = true; scene.add(st.fliesPts);
    // костёр у кошары посреди плато: ориентир старта, тёплый свет и искры
    const parts = [], fire = lab.group({ at: [0, 0, -2.5] });
    for (let i = 0; i < 9; i++) { const a = i / 9 * Math.PI * 2; parts.push(lab.ball(0.22, '#5a6278', { parent: fire, at: [Math.cos(a) * 0.75, 0.1, Math.sin(a) * 0.75], detail: 0 })); }
    for (let i = 0; i < 4; i++) parts.push(lab.cyl(0.09, 0.11, 1.1, '#4a3022', { parent: fire, at: [0, 0.16, 0], rot: [Math.PI / 2 - 0.25, i * Math.PI / 4, 0], sides: 5 }));
    for (const [x, z, r] of [[-1.9, 0.8, 0.4], [1.8, 1, -0.5], [0.4, -2, 0.1]]) parts.push(lab.cyl(0.22, 0.24, 1.4, '#5a3a28', { parent: fire, at: [x, 0.22, z], rot: [0, r, Math.PI / 2], sides: 7 }));
    // кошара — пастуший шалаш, и дольмен вдали
    const kosh = lab.group({ parent: fire, at: [4.2, 0, -2.6], rot: 0.4 });
    parts.push(lab.cone(1.8, 2.6, '#6a5a3a', { parent: kosh, at: [0, 1.3, 0], sides: 6 }), lab.box(0.7, 1.1, 0.1, '#1a1208', { parent: kosh, at: [0, 0.55, 1.45], rot: [-0.55, 0, 0] }));
    const dol = lab.group({ parent: fire, at: [-8.5, 0, -9], rot: 0.3 });
    parts.push(lab.box(0.25, 1.4, 1.6, '#7a7a8a', { parent: dol, at: [-0.8, 0.7, 0] }), lab.box(0.25, 1.4, 1.6, '#7a7a8a', { parent: dol, at: [0.8, 0.7, 0] }), lab.box(1.6, 1.4, 0.22, '#7a7a8a', { parent: dol, at: [0, 0.7, -0.75] }), lab.box(2.2, 0.25, 2.1, '#868698', { parent: dol, at: [0, 1.5, 0] }));
    lab.merge(parts, fire);
    st.flames = [0, 1, 2].map(i => lab.cone(0.38 - i * 0.09, 0.9 - i * 0.18, ['#ff6a1a', '#ffa030', '#ffe27a'][i], { parent: fire, at: [0, 0.45, 0], unlit: true, glow: 1.2, shadow: false, sides: 6 }));
    st.firePool = lab.mesh(new T.CircleGeometry(3.4, 24).rotateX(-Math.PI / 2), new T.MeshBasicMaterial({ color: '#4a2a10', transparent: true, blending: T.AdditiveBlending, depthWrite: false, fog: false }), { parent: fire, at: [0, 0.04, 0], shadow: false });
    st.fire = fire; st.emberT = 0;
  },
  // декор переставляется плитками вокруг героя: мир бесконечный
  wrapWorld(lab, force) {
    const st = lab.state, h = st.hero, S = this.TILE, t = st.tmp;
    if (!force && st.wrapAt && Math.hypot(h.x - st.wrapAt[0], h.z - st.wrapAt[1]) < 3) return;
    st.wrapAt = [h.x, h.z];
    for (const d of st.decor) {
      d.items.forEach((it, i) => {
        const x = it.x + S * Math.round((h.x - it.x) / S), z = it.z + S * Math.round((h.z - it.z) / S), s = it.s;
        t.p.set(x, it.y, z); t.q.setFromEuler(t.e.set(0, it.rot || 0, 0));
        if (Array.isArray(s)) t.s.set(s[0], s[1], s[2]); else t.s.set(s, s, s);
        d.im.setMatrixAt(i, t.m.compose(t.p, t.q, t.s));
      });
      d.im.instanceMatrix.needsUpdate = true;
    }
    st.ground.position.set(Math.round(h.x / 4) * 4, 0, Math.round(h.z / 4) * 4);
  },
  // мир живёт: огонь костра, искры, светлячки
  life(lab, dt) {
    const st = lab.state, h = st.hero;
    st.flames.forEach((f, i) => { const k = 1 + Math.sin(lab.t * (9 + i * 3) + i) * 0.12; f.scale.set(1 / Math.sqrt(k), k, 1 / Math.sqrt(k)); f.rotation.y += dt * (1 + i); });
    if ((st.emberT -= dt) <= 0 && Math.hypot(h.x, h.z + 2.5) < 30) { st.emberT = 0.25; lab.burst([0, 0.8, -2.5], { count: 2, colors: ['#ffb347', '#ff7a2a'], speed: 0.6, size: 0.12, life: 1.6, gravity: -1.2, up: 1.2 }); }
    const a = st.fliesPts.geometry.attributes.position;
    st.flies.forEach((f, i) => a.setXYZ(i, h.x + f.x + Math.sin(lab.t * 0.5 + f.ph) * 1.5, f.y + Math.sin(lab.t * 1.2 + f.ph * 2) * 0.3, h.z + f.z + Math.cos(lab.t * 0.4 + f.ph) * 1.2));
    a.needsUpdate = true;
    st.fliesPts.material.opacity = 0.5 + 0.4 * Math.sin(lab.t * 2.3);
  },

  // ---------- герой: юный нарт с огненным посохом ----------
  heroBuild(lab, scene) {
    const T = lab.THREE, st = lab.state, g = lab.group({ at: [0, 0, 0], scale: 1.3 });
    lab.mesh(new T.CircleGeometry(0.55, 20).rotateX(-Math.PI / 2), lab.mat('#05060c', { alpha: 0.5 }), { parent: g, at: [0, 0.03, 0], shadow: false });
    // тёплое пятно огня вокруг героя: его видно в гуще роя
    lab.mesh(new T.CircleGeometry(2.6, 24).rotateX(-Math.PI / 2), new T.MeshBasicMaterial({ color: '#3a2008', transparent: true, blending: T.AdditiveBlending, depthWrite: false, fog: false }), { parent: g, at: [0, 0.05, 0], shadow: false });
    const body = lab.group({ parent: g });
    const legs = [-0.13, 0.13].map(x => { const p = lab.group({ parent: body, at: [x, 0.55, 0] }); lab.box(0.15, 0.5, 0.17, '#2a2230', { parent: p, at: [0, -0.26, 0] }); lab.box(0.17, 0.1, 0.26, '#1a1216', { parent: p, at: [0, -0.48, 0.04] }); return p; });
    const torso = lab.group({ parent: body, at: [0, 0.55, 0] });
    lab.box(0.5, 0.62, 0.32, '#eef2ff', { parent: torso, at: [0, 0.32, 0], round: 0.06 }); // белая черкеска
    lab.cone(0.38, 0.38, '#eef2ff', { parent: torso, at: [0, 0.05, 0], sides: 8 }); // полы черкески
    lab.box(0.52, 0.07, 0.34, '#ffd23f', { parent: torso, at: [0, 0.12, 0], metal: 0.5, shiny: true }); // пояс
    for (const s of [-1, 1]) for (let k = 0; k < 3; k++) lab.box(0.05, 0.06, 0.03, '#c9a24a', { parent: torso, at: [s * 0.13, 0.5 - k * 0.08, 0.17] }); // газыри
    const cloak = lab.box(0.58, 0.78, 0.06, '#2fe6c8', { parent: torso, at: [0, 0.3, -0.2], rot: [0.12, 0, 0] }); // бирюзовый башлык — цвет только героя
    lab.ball(0.2, '#f0c8a0', { parent: torso, at: [0, 0.82, 0] });
    lab.cyl(0.22, 0.2, 0.26, '#2a2230', { parent: torso, at: [0, 1.04, 0], sides: 9 }); // папаха
    for (const s of [-1, 1]) { lab.ball(0.05, '#ffffff', { parent: torso, at: [s * 0.08, 0.85, 0.17], detail: 0 }); lab.ball(0.028, '#111111', { parent: torso, at: [s * 0.08, 0.85, 0.21], detail: 0 }); }
    const staff = lab.group({ parent: torso, at: [0.36, 0.2, 0.08] });
    lab.cyl(0.035, 0.045, 1.5, '#6a4426', { parent: staff, at: [0, 0.35, 0], sides: 5 });
    const orb = lab.ball(0.13, '#ff9a3d', { parent: staff, at: [0, 1.15, 0], unlit: true, glow: 1.6, shadow: false });
    const shield = lab.ball(0.95, '#5fe0c8', { parent: g, at: [0, 0.75, 0], alpha: 0.18, shadow: false, detail: 1 });
    shield.visible = false;
    const anchor = lab.group({ parent: g, at: [0, 0.9, 0] });
    const light = new T.PointLight('#ffa050', 9, 9, 1.6); light.position.set(0, 2, 0); g.add(light);
    st.hero = { g, body, legs, torso, cloak, staff, orb, shield, anchor, light, x: 0, z: 0, vx: 0, vz: 0, face: 0, yaw: 0, dash: 0, dashCd: 0, dx: 0, dz: 1, push: [0, 0] };
    lab.hero(g);
  },
  derive(lab) { // из ступеней и минусов — итоговые числа героя
    const st = lab.state, cfg = lab.cfg, L = st.lv;
    st.k = {
      dmg: (1 + 0.4 * st.sila) * cfg.damage * Math.max(0.3, 1 - st.minus.dmg),
      speed: cfg.speed * (1 + 0.12 * (L.sapogi || 0) + 0.02 * st.junk.shnurok) * Math.max(0.4, 1 - st.minus.speed),
      magnet: Math.max(0.4, cfg.magnet + 0.8 * (L.magnit || 0) + 0.1 * st.junk.pugovica - st.minus.magnet),
      dashCd: cfg.dashCd * (1 - 0.08 * (L.sapogi || 0)),
    };
  },
  moveHero(lab, dt) {
    const st = lab.state, h = st.hero, p = lab.p1, k = st.k;
    let ix = p.x, iz = -p.y;
    const m = Math.hypot(ix, iz);
    if (m > 1) { ix /= m; iz /= m; }
    if (m > 0.2) { const n = Math.hypot(ix, iz); h.dx = ix / n; h.dz = iz / n; h.face = Math.atan2(h.dx, h.dz); }
    h.dashCd -= dt;
    if ((p.pressed.a || p.pressed.b) && h.dashCd <= 0) { // рывок: короткий бросок сквозь рой со следом
      h.dash = 0.2; h.dashCd = k.dashCd;
      lab.sfx.whoosh(); lab.pulse(h.body, 1.25, 0.16);
      const tr = lab.trail(h.anchor, { color: '#2fe6c8', width: 0.7, length: 14 });
      lab.after(0.5, () => tr.dispose());
      lab.burst(lab.v3(h.x, 0.2, h.z), { count: 10, colors: ['#9fb2c8', '#5fe0c8'], speed: 3, size: 0.18, life: 0.4, dir: [-h.dx, 0, -h.dz] });
    }
    if (h.dash > 0) { h.dash -= dt; h.vx = h.dx * k.speed * 3.3; h.vz = h.dz * k.speed * 3.3; }
    else { h.vx = lab.damp(h.vx, ix * k.speed, 16, dt); h.vz = lab.damp(h.vz, iz * k.speed, 16, dt); }
    h.push[0] = lab.damp(h.push[0], 0, 6, dt); h.push[1] = lab.damp(h.push[1], 0, 6, dt);
    h.x += (h.vx + h.push[0]) * dt; h.z += (h.vz + h.push[1]) * dt;
    h.g.position.set(h.x, 0, h.z);
    let d = h.face - h.yaw; while (d > Math.PI) d -= Math.PI * 2; while (d < -Math.PI) d += Math.PI * 2;
    h.yaw += d * Math.min(1, dt * 14);
    h.body.rotation.y = h.yaw;
    const sp = Math.hypot(h.vx, h.vz), run = Math.min(1, sp / 5);
    h.legs[0].rotation.x = Math.sin(lab.t * 14) * 0.7 * run; h.legs[1].rotation.x = -Math.sin(lab.t * 14) * 0.7 * run;
    h.torso.rotation.x = 0.15 * run; h.torso.position.y = 0.55 + Math.abs(Math.sin(lab.t * 14)) * 0.05 * run;
    h.body.scale.y = 1 + Math.sin(lab.t * 3) * 0.03; // дышит
    h.cloak.rotation.x = 0.12 + run * 0.5 + Math.sin(lab.t * 9) * 0.06 * run;
    h.body.visible = !lab.blink();
    h.light.intensity = 9 + Math.sin(lab.t * 11) * 0.8 + Math.sin(lab.t * 7.3) * 0.6;
  },

  // ---------- рой ----------
  foeParts(lab) {
    const T = lab.THREE, st = lab.state, BGU = lab.addons.BufferGeometryUtils;
    const ni = g => (g.index ? g.toNonIndexed() : g);
    const tint = (g, hex) => { g = ni(g); if (g.attributes.uv) g.deleteAttribute('uv'); const c = new T.Color(hex), a = new Float32Array(g.attributes.position.count * 3); for (let i = 0; i < a.length; i += 3) { a[i] = c.r; a[i + 1] = c.g; a[i + 2] = c.b; } g.setAttribute('color', new T.BufferAttribute(a, 3)); return g; };
    const plain = g => { g = ni(g); if (g.attributes.uv) g.deleteAttribute('uv'); return g; };
    const M = l => BGU.mergeGeometries(l);
    const eyes = (x, y, z, r) => M([plain(new T.IcosahedronGeometry(r, 0).translate(-x, y, z)), plain(new T.IcosahedronGeometry(r, 0).translate(x, y, z))]);
    const G = {
      moshka: { // мошкара: брюшко, крылышки, два красных глаза
        body: M([tint(new T.IcosahedronGeometry(0.22, 0), '#5a3478'), tint(new T.IcosahedronGeometry(0.17, 0).translate(0, -0.04, -0.26), '#3a2250'),
          tint(new T.BoxGeometry(0.44, 0.02, 0.18).rotateZ(0.5).translate(-0.22, 0.17, -0.05), '#c8c0ea'), tint(new T.BoxGeometry(0.44, 0.02, 0.18).rotateZ(-0.5).translate(0.22, 0.17, -0.05), '#c8c0ea')]),
        eye: eyes(0.08, 0.05, 0.18, 0.065),
      },
      shershen: { // шершень: рыжая грудь, полосатое брюшко, прозрачные крылья, жало
        body: M([tint(new T.IcosahedronGeometry(0.2, 0).scale(1, 0.9, 1.1), '#ff7a2a'), tint(new T.CylinderGeometry(0.17, 0.19, 0.14, 8).rotateX(Math.PI / 2).translate(0, 0, -0.26), '#1a1018'),
          tint(new T.CylinderGeometry(0.19, 0.15, 0.14, 8).rotateX(Math.PI / 2).translate(0, 0, -0.4), '#ffb030'), tint(new T.ConeGeometry(0.15, 0.3, 8).rotateX(-Math.PI / 2).translate(0, 0, -0.62), '#1a1018'),
          tint(new T.BoxGeometry(0.5, 0.02, 0.2).rotateZ(0.35).translate(-0.26, 0.2, -0.12), '#dfe8ff'), tint(new T.BoxGeometry(0.5, 0.02, 0.2).rotateZ(-0.35).translate(0.26, 0.2, -0.12), '#dfe8ff')]),
        eye: M([eyes(0.09, 0.06, 0.15, 0.07), plain(new T.ConeGeometry(0.04, 0.16, 5).rotateX(-Math.PI / 2).translate(0, 0, -0.82))]),
      },
      mysh: { // летучая мышь: тельце, уши, широкие крылья
        body: M([tint(new T.IcosahedronGeometry(0.24, 0), '#4a2a5e'), tint(new T.ConeGeometry(0.07, 0.2, 4).translate(-0.1, 0.27, 0.05), '#3a2048'), tint(new T.ConeGeometry(0.07, 0.2, 4).translate(0.1, 0.27, 0.05), '#3a2048'),
          tint(new T.BoxGeometry(0.62, 0.03, 0.4).rotateZ(0.25).translate(-0.48, 0.08, -0.05), '#5a3474'), tint(new T.BoxGeometry(0.62, 0.03, 0.4).rotateZ(-0.25).translate(0.48, 0.08, -0.05), '#5a3474'),
          tint(new T.ConeGeometry(0.2, 0.42, 3).rotateZ(Math.PI / 2).translate(-0.95, 0.2, -0.05), '#4a2a5e'), tint(new T.ConeGeometry(0.2, 0.42, 3).rotateZ(-Math.PI / 2).translate(0.95, 0.2, -0.05), '#4a2a5e')]),
        eye: eyes(0.09, 0.06, 0.21, 0.07),
      },
      zhuk: { // жук-каменщик: тяжёлый панцирь с огненными трещинами, ножки
        body: M([tint(new T.SphereGeometry(0.62, 10, 5, 0, Math.PI * 2, 0, Math.PI / 2).scale(1, 0.7, 1.25).translate(0, 0.16, 0), '#3f5a40'), tint(new T.BoxGeometry(0.5, 0.28, 0.32).translate(0, 0.24, 0.78), '#22302a'),
          ...[-1, 1].flatMap(s => [-0.4, 0, 0.4].map(z => tint(new T.BoxGeometry(0.42, 0.08, 0.08).rotateZ(s * 0.5).translate(s * 0.62, 0.12, z), '#1a201c'))),
          tint(new T.BoxGeometry(0.05, 0.3, 0.12).translate(-0.16, 0.3, 0.98), '#1a201c'), tint(new T.BoxGeometry(0.05, 0.3, 0.12).translate(0.16, 0.3, 0.98), '#1a201c')]),
        eye: M([eyes(0.13, 0.3, 0.95, 0.07), ...[[0, 0.6, 0.15, 0.09], [-0.28, 0.52, -0.3, 0.07], [0.3, 0.5, -0.1, 0.07], [0.1, 0.5, -0.6, 0.06]].map(([x, y, z, r]) => plain(new T.IcosahedronGeometry(r, 0).translate(x, y, z)))]), // угли в трещинах панциря
      },
    };
    const bodyMat = new T.MeshStandardMaterial({ vertexColors: true, flatShading: true, roughness: 0.6, metalness: 0.1 });
    const eyeMat = lab.mat('#ffffff', { unlit: true, glow: 1 });
    st.foeIM = {};
    for (const id in G) {
      const cap = this.FOES[id].cap;
      const body = lab.instances(G[id].body, bodyMat, cap), eye = lab.instances(G[id].eye, eyeMat, cap, { shadow: false });
      for (const im of [body, eye]) { im.frustumCulled = false; for (let i = 0; i < cap; i++) im.setColorAt(i, st.tmp.c.set('#ffffff')); im.count = 0; }
      st.foeIM[id] = { body, eye };
    }
    // следы на траве от лопнувших
    st.splatIM = lab.instances(new T.CircleGeometry(0.5, 8).rotateX(-Math.PI / 2), lab.mat('#ffffff', { unlit: true }), this.CAPS.splats, { shadow: false });
    st.splatIM.frustumCulled = false; st.splatIM.setColorAt(0, st.tmp.c.set('#ffffff')); st.splatIM.count = 0;
  },
  spawnFoe(lab, type, x, z, o = {}) {
    const st = lab.state, F = this.FOES[type];
    if (st.foes.filter(e => e.type === type).length >= F.cap) return null;
    const hpK = 1 + Math.max(0, st.wt - 30) / 80 + Math.max(0, st.wt - 150) / 40; // первые полминуты мошка гибнет с одного шара
    const e = { type, x, z, vx: 0, vz: 0, hp: F.hp * hpK, r: F.r, age: 0, flash: 0, ph: lab.rand(0, 6), ringCd: 0, mode: 'fly', mt: 0, tx: 0, tz: 0, yaw: 0, kx: 0, kz: 0 };
    Object.assign(e, o);
    st.foes.push(e);
    return e;
  },
  // откуда и сколько: рой растёт всю партию, виды открываются по времени, после 150 с — звереет
  spawner(lab, dt) {
    const st = lab.state, cfg = lab.cfg, h = st.hero, t = st.wt, C = st.cam;
    let rate = cfg.spawn * (1 + cfg.grow * t / 60) * (t > 150 ? 1 + (t - 150) / 30 : 1) * (st.curse > 0 ? 2 : 1) * (t < 10 ? 0.5 : 1);
    if (cfg.shop >= 1 && st.waveT < 2) rate = 0; // перед магазином рой стихает
    st.spawnAcc += rate * dt;
    const R = 13.5 * (C ? C.k : 1);
    while (st.spawnAcc >= 1) {
      st.spawnAcc -= 1;
      const w = [['moshka', 1], ['shershen', t > 12 ? 0.35 : 0], ['mysh', t > 26 ? 0.25 : 0], ['zhuk', t > 40 ? 0.14 : 0]];
      let r = lab.rand(0, w.reduce((a, b) => a + b[1], 0)), type = 'moshka';
      for (const [k, v] of w) { if (r < v) { type = k; break; } r -= v; }
      // половина роя заходит спереди по ходу героя: бегство по прямой не спасает
      const ahead = Math.hypot(h.vx, h.vz) > 1 && lab.chance(0.5), a = ahead ? Math.atan2(h.vz, h.vx) + lab.rand(-0.8, 0.8) : lab.rand(0, Math.PI * 2);
      const x = h.x + Math.cos(a) * R, z = h.z + Math.sin(a) * R * 0.85;
      // мошкара — стайкой: стайка забирает столько мест в счёте роя, сколько в ней мошек
      const n = type === 'moshka' ? lab.randInt(3, 5) : 1; // долг стайки гасится паузой до следующей
      for (let i = 0; i < n; i++) this.spawnFoe(lab, type, x + (n > 1 ? lab.rand(-0.8, 0.8) : 0), z + (n > 1 ? lab.rand(-0.8, 0.8) : 0));
      st.spawnAcc -= n - 1;
    }
    // события партии: новый вид врага объявляется надписью
    const say = (key, at, text) => { if (!st.said[key] && t >= at) { st.said[key] = true; this.alarm(lab, text); } };
    say('sh', 12, '🐝 Шершни! Летят зигзагом');
    say('my', 26, '🦇 Летучие мыши! Замерла — жди налёта');
    say('zh', 40, '🪲 Жуки-каменщики! Толкаются');
    if (!st.wild && t >= 150) { st.wild = true; this.alarm(lab, '🌑 Рой звереет!'); lab.flash('#ff3d5a', 0.15); }
    // кольцо роя окружает героя (как в Vampire Survivors): в кольце два просвета
    if (cfg.ringEvery > 0 && t >= st.ringT) {
      st.ringT = t + cfg.ringEvery; st.rings++;
      const n = Math.min(44, 24 + st.rings * 4), gap = lab.rand(0, Math.PI * 2), RR = 10.5;
      for (let i = 0; i < n; i++) {
        const a = i / n * Math.PI * 2, d1 = Math.abs(Math.atan2(Math.sin(a - gap), Math.cos(a - gap))), d2 = Math.abs(Math.atan2(Math.sin(a - gap - Math.PI), Math.cos(a - gap - Math.PI)));
        if (d1 < 0.35 || d2 < 0.25) continue;
        this.spawnFoe(lab, 'moshka', h.x + Math.cos(a) * RR, h.z + Math.sin(a) * RR, { ring: true });
      }
      this.alarm(lab, '⭕ Рой окружает! Ищи просвет');
      lab.sfx.warn();
    }
    if (cfg.elite > 0 && t >= st.eliteT && !st.elite) {
      st.eliteT = t + cfg.elite;
      const a = lab.rand(0, Math.PI * 2);
      this.eliteSpawn(lab, h.x + Math.cos(a) * 12, h.z + Math.sin(a) * 10);
      this.alarm(lab, '👹 Иныж идёт! Сбей — получишь сундук');
      lab.sfx.warn(); lab.tone(70, 0.6, 'sawtooth', 0.12, 50);
    }
  },
  alarm(lab, text) { const st = lab.state; st.alarm = text; st.alarmT = 2.8; },
  grid(lab) { // сетка 1,5 м: соседи для расталкивания и «гущи роя»
    const st = lab.state, G = st.cells = new Map();
    for (const e of st.foes) { const k = Math.floor(e.x / 1.5) * 4096 + Math.floor(e.z / 1.5); let c = G.get(k); if (!c) G.set(k, c = []); c.push(e); }
  },
  around(lab, x, z, r, fn) {
    const G = lab.state.cells, n = Math.ceil(r / 1.5), cx = Math.floor(x / 1.5), cz = Math.floor(z / 1.5);
    for (let i = -n; i <= n; i++) for (let j = -n; j <= n; j++) { const c = G.get((cx + i) * 4096 + cz + j); if (c) for (const e of c) if (Math.hypot(e.x - x, e.z - z) < r) fn(e); }
  },
  crowd(lab, x, z, r) { let n = 0; this.around(lab, x, z, r, e => { if (e.hp > 0) n++; }); return n; },
  moveFoes(lab, dt) {
    const st = lab.state, h = st.hero, F = this.FOES, slowR = this.smokeR(lab), slowK = (st.lv.dymar || 0) >= 5 || st.evo.tucha ? 0.5 : 0.78;
    st.near = 0;
    for (const e of st.foes) {
      if (e.hp <= 0) { e.gone = true; continue; }
      e.age += dt; e.flash = Math.max(0, e.flash - dt); e.ringCd -= dt;
      const dx = h.x - e.x, dz = h.z - e.z, d = Math.hypot(dx, dz) || 0.001, ux = dx / d, uz = dz / d;
      let sp = F[e.type].speed * (d < slowR ? slowK : 1), mx = ux, mz = uz;
      if (e.type === 'moshka') { mx += Math.sin(e.age * 3 + e.ph) * 0.25 * -uz; mz += Math.sin(e.age * 3 + e.ph) * 0.25 * ux; }
      else if (e.type === 'shershen') { const z = Math.sin(e.age * 5 + e.ph) * 0.9; mx += -uz * z; mz += ux * z; }
      else if (e.type === 'mysh') { // замерла, глаза вспыхнули — налёт по прямой сквозь то место, где стоял герой
        e.mt -= dt;
        if (e.mode === 'fly' && d < 6.5 && e.age > 1) { e.mode = 'aim'; e.mt = 0.6; }
        else if (e.mode === 'aim') { sp = 0.3; if (e.mt <= 0) { e.mode = 'dash'; e.tx = h.x + ux * 4; e.tz = h.z + uz * 4; e.mt = 1.4; lab.tone(1400, 0.12, 'sine', 0.025, 700); } }
        else if (e.mode === 'dash') { const tx = e.tx - e.x, tz = e.tz - e.z, td = Math.hypot(tx, tz) || 0.001; mx = tx / td; mz = tz / td; sp = 9.5; if (td < 0.5 || e.mt <= 0) { e.mode = 'rest'; e.mt = 1; } }
        else if (e.mode === 'rest') { sp *= 0.5; if (e.mt <= 0) e.mode = 'fly'; }
      }
      const ml = Math.hypot(mx, mz) || 1;
      let vx = mx / ml * sp, vz = mz / ml * sp;
      // расталкивание: рой не сливается в одну точку, жук толкает мелких
      this.around(lab, e.x, e.z, e.r + 0.7, o => {
        if (o === e) return;
        const ox = e.x - o.x, oz = e.z - o.z, od = Math.hypot(ox, oz) || 0.01, need = e.r + o.r;
        if (od < need) { const k = (need - od) / need * (o.type === 'zhuk' && e.type !== 'zhuk' ? 9 : 4); vx += ox / od * k; vz += oz / od * k; }
      });
      e.kx = lab.damp(e.kx, 0, 8, dt); e.kz = lab.damp(e.kz, 0, 8, dt);
      e.x += (vx + e.kx) * dt; e.z += (vz + e.kz) * dt;
      e.yaw = Math.atan2(e.mode === 'dash' ? mx : ux, e.mode === 'dash' ? mz : uz);
      if (d < 2.5) st.near++;
      // касание: урон, если не рывок и не первые 8 секунд
      if (d < e.r + 0.42 && st.wt >= 8 && h.dash <= 0 && e.age > 0.3) this.touch(lab, e, ux, uz);
      if (d > 32) e.gone = true; // отставший далеко — растворяется, рой всё равно новый
    }
    if (st.foes.some(e => e.gone)) st.foes = st.foes.filter(e => !e.gone);
  },
  touch(lab, e, ux, uz) {
    const st = lab.state, h = st.hero;
    if (lab.invuln > 0) return;
    if (st.shield) { // щит бурки принимает удар
      st.shield = false; st.shieldT = this.shieldEvery(lab);
      lab.invuln = 0.8; lab.sfx.power(); lab.whiten(h.shield, 0.15, '#ffffff');
      lab.ring(lab.v3(h.x, 0.1, h.z), { color: '#5fe0c8', radius: 3 }); lab.popup(lab.v3(h.x, 2.4, h.z), 'Бурка!', '#5fe0c8', 20);
      e.kx -= ux * 8; e.kz -= uz * 8;
      return;
    }
    if (lab.hurt(lab.v3(h.x, 0.8, h.z), 'Рой одолел нарта')) {
      const k = e.type === 'zhuk' ? 11 : 5; h.push[0] -= ux * k; h.push[1] -= uz * k; // жук отбрасывает сильнее
      if (st.chain >= 10) lab.popup(lab.v3(h.x, 2.6, h.z), `Серия ${st.chain} сгорела`, '#ff8a7a', 18);
      st.chain = 0;
      this.around(lab, h.x, h.z, 3.2, o => { const ox = o.x - h.x, oz = o.z - h.z, od = Math.hypot(ox, oz) || 1; o.kx += ox / od * 12; o.kz += oz / od * 12; }); // рой отшатывается: после удара есть миг выбраться
    }
  },
  hit(lab, e, dmg, from, color) {
    if (e === lab.state.elite) return this.hitElite(lab, dmg);
    if (e.hp <= 0) return;
    e.hp -= dmg; e.flash = 0.1;
    if (from) { const dx = e.x - from[0], dz = e.z - from[1], d = Math.hypot(dx, dz) || 1, k = e.type === 'zhuk' ? 1.5 : 4; e.kx += dx / d * k; e.kz += dz / d * k; }
    if (e.hp <= 0) this.kill(lab, e, color);
  },
  kill(lab, e, color) {
    const st = lab.state, F = this.FOES[e.type], cfg = lab.cfg;
    st.kills++; lab.count('сбито'); e.gone = true;
    const crowd = this.crowd(lab, e.x, e.z, 2.5);
    lab.score += Math.round(F.pts * this.mult(lab));
    lab.burst(lab.v3(e.x, F.y + 0.3, e.z), { count: e.type === 'zhuk' ? 16 : 7, colors: [F.color, '#ff3d5a', color || '#ffb347'], speed: e.type === 'zhuk' ? 6 : 4, size: 0.16, life: 0.45 });
    if (e.type === 'zhuk') { lab.sfx.explode(); lab.shake(0.12); lab.popup(lab.v3(e.x, 1.6, e.z), '+' + Math.round(F.pts * this.mult(lab)), '#ffd9a0', 15); }
    else lab.tone(300 + lab.rand(0, 80), 0.05, 'square', 0.02, 120);
    if (st.splats.length >= this.CAPS.splats) st.splats.shift();
    st.splats.push({ x: e.x, z: e.z, t: 0, s: e.type === 'zhuk' ? 1.4 : 0.6, c: F.color });
    // кристалл там, где враг умер. Спрятанная механика: в гуще роя (≥ 3 рядом) — крупный золотой
    const big = cfg.secret >= 1 && crowd >= 2; // сам враг и ещё двое рядом
    if (!e.ring || lab.chance(0.5)) { this.dropGem(lab, e.x, e.z, big, F.xp); if (big) lab.count('_secret'); }
  },
  dropGem(lab, x, z, big, xp = 1) {
    const st = lab.state;
    const small = st.gems.filter(g => !g.big).length, bigs = st.gems.length - small;
    if ((big ? bigs >= this.CAPS.big : small >= this.CAPS.small)) { const old = st.gems.findIndex(g => g.big === big && !g.fly); if (old >= 0) st.gems.splice(old, 1); else return; }
    st.gems.push({ x, z, big, v: big ? xp * 3 : xp, t: 0, fly: false, sp: 0, ph: lab.rand(0, 6) });
  },
  moveGems(lab, dt) {
    const st = lab.state, h = st.hero, cfg = lab.cfg, vac = cfg.vacuum >= 1 || cfg.secret < 1, R = st.k.magnet;
    for (const g of st.gems) {
      g.t += dt;
      const dx = h.x - g.x, dz = h.z - g.z, d = Math.hypot(dx, dz);
      if (!g.fly && g.t > 0.25 && (d < R || (vac && g.t > 0.6))) g.fly = true;
      if (g.fly) { g.sp = Math.min(vac && d > R ? 16 : 22, g.sp + dt * 40); const s = Math.min(d, g.sp * dt); g.x += dx / (d || 1) * s; g.z += dz / (d || 1) * s; }
      if (d < 0.55) this.pick(lab, g);
    }
    if (st.gems.some(g => g.got)) st.gems = st.gems.filter(g => !g.got);
  },
  pick(lab, g) {
    const st = lab.state, h = st.hero, cfg = lab.cfg;
    g.got = true; st.picks++; lab.count('кристаллы');
    const danger = st.near >= 3; // в опасности: рядом с героем ≥ 3 врага ближе 2,5 м
    if (danger) { st.dangerPicks++; lab.count('кристаллы в опасности'); if (cfg.secret >= 1) lab.count('_secret'); }
    st.chain++; st.bestChain = Math.max(st.bestChain, st.chain);
    const m = this.mult(lab), pts = Math.round(10 * g.v * m * (danger ? 2 : 1));
    lab.score += pts;
    if (g.big || danger) lab.popup(lab.v3(h.x, 1.9, h.z), danger ? `Риск! +${pts}` : '+' + pts, danger ? '#ffd23f' : '#9fe8ff', danger ? 17 : 14);
    if (st.chain % 20 === 0 && m > 1) { lab.popup(lab.v3(h.x, 2.8, h.z), `Очки ×${m}`, '#7cf5a8', 24); lab.sfx.power(); }
    lab.tone(880 * lab.pitch(st.chain % 12), g.big ? 0.12 : 0.06, 'sine', g.big ? 0.06 : 0.035);
    lab.burst(lab.v3(h.x, 0.9, h.z), { count: g.big ? 8 : 3, colors: [g.big ? '#ffd23f' : '#4fd2ff', '#ffffff'], speed: 2.5, size: 0.1, life: 0.3 });
    const gain = g.v * (st.curse > 0 ? 2 : 1);
    if (cfg.shop >= 1) { st.money += gain; return; }
    st.xp += gain;
    if (st.xp >= st.need) { st.xp -= st.need; st.level++; lab.count('уровни'); st.need = this.need(lab, st.level); this.openChoice(lab, 'level'); }
  },

  // ---------- оружие: всё бьёт само ----------
  weaponParts(lab, scene) {
    const T = lab.THREE, st = lab.state, BGU = lab.addons.BufferGeometryUtils, C = this.CAPS;
    const mk = (geo, m, n) => { const im = lab.instances(geo, m, n, { shadow: false }); im.frustumCulled = false; im.setColorAt(0, st.tmp.c.set('#ffffff')); im.count = 0; return im; };
    st.gemIM = { small: mk(new T.OctahedronGeometry(0.16, 0).scale(1, 1.5, 1), lab.mat('#4fd2ff', { unlit: true, glow: 0.9 }), C.small), big: mk(new T.OctahedronGeometry(0.27, 0).scale(1, 1.4, 1), lab.mat('#ffd23f', { unlit: true, glow: 1.1 }), C.big) };
    st.gemShadow = mk(new T.CircleGeometry(0.2, 8).rotateX(-Math.PI / 2), lab.mat('#0a1018', { alpha: 0.5 }), C.small + C.big);
    st.ballIM = mk(BGU.mergeGeometries([new T.IcosahedronGeometry(0.22, 1), new T.ConeGeometry(0.17, 0.95, 8).rotateX(-Math.PI / 2).translate(0, 0, -0.5)].map(g => (g.index ? g.toNonIndexed() : g)).map(g => { if (g.attributes.uv) g.deleteAttribute('uv'); return g; })), lab.mat('#ff9a3d', { unlit: true, glow: 1.4 }), C.balls);
    st.sparkIM = mk(new T.IcosahedronGeometry(0.2, 1), lab.mat('#fff0a0', { unlit: true, glow: 1.6 }), C.sparks);
    st.puffIM = mk(new T.IcosahedronGeometry(0.7, 1), lab.mat('#9a88c8', { alpha: 0.28 }), C.puffs);
    st.smokeDisc = lab.mesh(new T.RingGeometry(0.2, 1, 28).rotateX(-Math.PI / 2), new T.MeshBasicMaterial({ color: '#2a1e44', transparent: true, blending: T.AdditiveBlending, depthWrite: false, fog: false }), { shadow: false });
    st.smokeDisc.visible = false;
    st.boltIM = mk(new T.BoxGeometry(0.09, 0.09, 1), lab.mat('#e0d4ff', { unlit: true, glow: 2 }), C.bolts);
    st.hammers = [0, 1].map(() => {
      const g = lab.group({});
      lab.cyl(0.08, 0.08, 1.6, '#6a4426', { parent: g, at: [0, 0.8, 0], sides: 6 });
      lab.box(1.1, 0.55, 0.6, '#c87a2a', { parent: g, at: [0, 1.65, 0], metal: 0.6, shiny: true });
      lab.box(1.14, 0.12, 0.64, '#ffd23f', { parent: g, at: [0, 1.65, 0], unlit: true, glow: 1.2, shadow: false });
      g.visible = false; return { g, busy: false };
    });
  },
  smokeR(lab) { const st = lab.state, L = st.lv.dymar || 0; return L ? [0, 1.8, 2.2, 2.2, 2.7, 2.7][L] * (st.evo.tucha ? 1.7 : 1) : 0; },
  shieldEvery(lab) { return [0, 20, 16, 13, 10, 8][lab.state.lv.burka || 0] || 20; },
  nearest(lab, x, z, r, skip) {
    let best = null, bd = r;
    for (const e of lab.state.foes) { if (e.hp <= 0 || (skip && skip.has(e))) continue; const d = Math.hypot(e.x - x, e.z - z); if (d < bd) { bd = d; best = e; } }
    const el = lab.state.elite; // иныж большой: в него целятся, как только он ближе остальных (считая от его края)
    if (el && !(skip && skip.has(el)) && Math.hypot(el.x - x, el.z - z) - 1 < bd) best = el;
    return best;
  },
  weapons(lab, dt) {
    const st = lab.state, h = st.hero, L = st.lv, K = st.k, B = id => (st.boost[id] || 1);
    // огненный посох: шар в ближайшего; огонёк на посохе разгорается к выстрелу
    if (L.posoh) {
      const every = L.posoh >= 4 ? 0.6 : 0.85;
      st.shotT -= dt;
      h.orb.scale.setScalar(0.7 + 0.6 * (1 - lab.clamp(st.shotT / every, 0, 1)));
      if (st.shotT <= 0) {
        const n = (1 + (L.posoh >= 3 ? 1 : 0) + (L.posoh >= 5 ? 1 : 0)) * (st.evo.solnce ? 2 : 1), used = new Set(), aims = [];
        h.orb.updateWorldMatrix(true, false);
        const o = h.orb.getWorldPosition(st.tmp.p);
        for (let i = 0; i < n; i++) { const e = this.nearest(lab, h.x, h.z, 10, used); if (!e) break; used.add(e); aims.push(e); }
        let shot = 0;
        for (let i = 0; i < n && aims.length; i++) {
          const e = aims[i] || aims[0], extra = i >= aims.length ? (i - aims.length + 1) * (i % 2 ? 0.22 : -0.22) : 0; // лишние шары — веером
          const a = Math.atan2(e.z - o.z, e.x - o.x) + extra;
          st.balls.push({ x: o.x, z: o.z, vx: Math.cos(a) * 15, vz: Math.sin(a) * 15, life: 0.9, pierce: st.evo.solnce ? 99 : L.posoh >= 5 ? 3 : 0, dmg: (L.posoh >= 2 ? 1.5 : 1) * K.dmg * B('posoh'), hits: new Set() });
          shot++;
        }
        if (shot) { st.shotT = every; lab.tone(520, 0.07, 'triangle', 0.03, 260); lab.burst(o, { count: 3, colors: ['#ffe27a', '#ff9a3d'], speed: 2, size: 0.12, life: 0.2 }); }
        else st.shotT = 0.1;
      }
    }
    // кольцо искр
    const nSp = this.sparkCount(lab);
    st.ringA += dt * 3.2;
    if (nSp) {
      const R = (L.kolco >= 4 ? 2.6 : 2.1) + (st.evo.venec ? 0.8 : 0), dmg = 1.5 * (L.kolco >= 3 ? 1.5 : 1) * K.dmg * B('kolco');
      for (let i = 0; i < nSp; i++) {
        const a = st.ringA + i / nSp * Math.PI * 2, sx = h.x + Math.cos(a) * R, sz = h.z + Math.sin(a) * R;
        this.around(lab, sx, sz, 1.2, e => { if (e.ringCd <= 0 && Math.hypot(e.x - sx, e.z - sz) < 0.35 + e.r) { e.ringCd = 0.45; this.hit(lab, e, dmg, [h.x, h.z], '#fff0a0'); } });
      }
    }
    // дымарь: облако жжёт всех рядом
    const sR = this.smokeR(lab);
    st.smokeTick = false;
    if (sR && (st.smokeT -= dt) <= 0) {
      st.smokeT = 0.5; st.smokeTick = true;
      const dmg = 0.8 * (L.dymar >= 3 ? 1.5 : 1) * (st.evo.tucha ? 1.6 : 1) * K.dmg * B('dymar');
      this.around(lab, h.x, h.z, sR + 0.4, e => this.hit(lab, e, dmg, null, '#b9a8ff'));
    }
    // молот Тлепша: круг в цвет героя — и удар по гуще роя
    if (L.molot && (st.hammerT -= dt) <= 0) {
      st.hammerT = L.molot >= 3 ? 2.4 : 3;
      const n = L.molot >= 5 ? 2 : 1, R = L.molot >= 4 ? 3 : 2.4, dmg = 6 * (L.molot >= 2 ? 1.5 : 1) * K.dmg * B('molot');
      const cand = st.foes.filter(e => e.hp > 0 && Math.hypot(e.x - h.x, e.z - h.z) < 7);
      cand.sort((a, b) => this.crowd(lab, b.x, b.z, R) - this.crowd(lab, a.x, a.z, R));
      if (st.elite && Math.hypot(st.elite.x - h.x, st.elite.z - h.z) < 7) cand.unshift(st.elite);
      for (let i = 0; i < n && i < cand.length; i++) { const e = cand[i * 3] || cand[i]; this.hammer(lab, e.x, e.z, R, dmg, i * 0.2); }
    }
    // молния Шибле: цепь с неба
    if (L.molniya && (st.boltT -= dt) <= 0) {
      st.boltT = L.molniya >= 3 ? 1.5 : 2;
      const chain = 3 + (L.molniya >= 2 ? 2 : 0) + (L.molniya >= 5 ? 3 : 0), dmg = 3 * (L.molniya >= 4 ? 1.5 : 1) * K.dmg * B('molniya');
      const first = this.nearest(lab, h.x, h.z, 9);
      if (first) this.bolt(lab, first, chain, dmg);
    }
    // бурка: щит перезаряжается
    if (L.burka && !st.shield && (st.shieldT -= dt) <= 0) { st.shield = true; lab.sfx.beep(); lab.popup(lab.v3(h.x, 2.2, h.z), '🛡', '#5fe0c8', 18); }
    h.shield.visible = !!st.shield;
    if (st.shield) h.shield.scale.setScalar(1 + Math.sin(lab.t * 4) * 0.04);
  },
  sparkCount(lab) { const st = lab.state, L = st.lv.kolco || 0; return L ? [0, 2, 3, 3, 4, 6][L] * (st.evo.venec ? 2 : 1) : 0; },
  hammer(lab, x, z, R, dmg, delay) {
    const st = lab.state, hm = st.hammers.find(m => !m.busy);
    lab.warn(lab.v3(x, 0.05, z), R, 0.35 + delay, '#ffb04a');
    lab.after(0.35 + delay, () => {
      if (hm) {
        hm.busy = true; hm.g.visible = true; hm.g.position.set(x, 4, z); hm.g.rotation.set(0, lab.rand(0, 6), 0.3);
        lab.tween(0.12, k => { hm.g.position.y = 4 * (1 - k); hm.g.rotation.z = 0.3 * (1 - k) - 0.2 * k; }, 'inQuad');
        lab.after(0.42, () => { hm.g.visible = false; hm.busy = false; });
      }
      lab.after(0.12, () => {
        lab.ring(lab.v3(x, 0.1, z), { color: '#ffb04a', radius: R + 0.4 }); lab.burst(lab.v3(x, 0.4, z), { count: 18, colors: ['#ffb04a', '#ffd23f', '#ffffff'], speed: 7, size: 0.2, life: 0.5 });
        lab.shake(0.22); lab.hitstop(0.03); lab.sfx.explode();
        this.around(lab, x, z, R + 0.3, e => this.hit(lab, e, dmg, [x, z], '#ffb04a'));
        if (st.elite && Math.hypot(st.elite.x - x, st.elite.z - z) < R + 1) this.hitElite(lab, dmg);
        if (st.evo.grom) { const e = this.nearest(lab, x, z, 6); if (e) this.bolt(lab, e, 4, dmg * 0.5); }
      });
    });
  },
  bolt(lab, first, chain, dmg) {
    const st = lab.state, used = new Set([first]), pts = [[first.x, 7, first.z]];
    let e = first;
    for (let i = 0; i < chain && e; i++) {
      pts.push([e.x, e === st.elite ? 2.5 : this.FOES[e.type].y + 0.2, e.z]);
      this.hit(lab, e, dmg, null, '#d8c8ff');
      lab.burst(lab.v3(e.x, 0.8, e.z), { count: 5, colors: ['#ffffff', '#d8c8ff'], speed: 3, size: 0.12, life: 0.25 });
      e = this.nearest(lab, e.x, e.z, 4, used);
      if (e) used.add(e);
    }
    for (let i = 1; i < pts.length; i++) { // ломаная: каждый отрезок — два звена с изломом
      const a = pts[i - 1], b = pts[i], mid = [(a[0] + b[0]) / 2 + lab.rand(-0.5, 0.5), (a[1] + b[1]) / 2 + lab.rand(-0.3, 0.3), (a[2] + b[2]) / 2 + lab.rand(-0.5, 0.5)];
      st.segs.push({ a, b: mid, t: 0.18 }, { a: mid, b, t: 0.18 });
    }
    while (st.segs.length > this.CAPS.bolts) st.segs.shift();
    lab.tone(1800, 0.1, 'sawtooth', 0.03, 300); lab.noise(0.12, 0.05, 3000);
  },
  moveBalls(lab, dt) {
    const st = lab.state;
    for (const b of st.balls) {
      b.life -= dt; b.x += b.vx * dt; b.z += b.vz * dt;
      if (!b.dmg) continue;
      this.around(lab, b.x, b.z, 1.2, e => {
        if (b.life <= 0 || b.hits.has(e) || e.hp <= 0 || Math.hypot(e.x - b.x, e.z - b.z) > e.r + 0.25) return;
        b.hits.add(e); this.hit(lab, e, b.dmg, [b.x - b.vx, b.z - b.vz], '#ff9a3d');
        lab.burst(lab.v3(b.x, 0.9, b.z), { count: 4, colors: ['#ffe27a', '#ff9a3d'], speed: 3, size: 0.12, life: 0.25, dir: [b.vx, 0, b.vz] });
        if (b.pierce-- <= 0) b.life = 0;
      });
      const el = st.elite;
      if (el && b.life > 0 && !b.hits.has(el) && Math.hypot(el.x - b.x, el.z - b.z) < 1.3) { b.hits.add(el); this.hitElite(lab, b.dmg); if (b.pierce-- <= 0) b.life = 0; }
    }
    if (st.balls.some(b => b.life <= 0)) st.balls = st.balls.filter(b => b.life > 0);
  },

  // ---------- иныж: элита с полоской прочности и замахом ----------
  eliteBuild(lab) {
    const T = lab.THREE, st = lab.state, g = lab.group({ scale: 1.35 });
    const skin = '#6c5a80', dark = '#3a2e48';
    const legs = [-0.4, 0.4].map(x => { const p = lab.group({ parent: g, at: [x, 0.9, 0] }); lab.box(0.42, 0.95, 0.46, dark, { parent: p, at: [0, -0.45, 0] }); return p; });
    const torso = lab.group({ parent: g, at: [0, 0.9, 0] });
    lab.box(1.5, 1.35, 0.95, skin, { parent: torso, at: [0, 0.7, 0], round: 0.15 });
    lab.box(1.56, 0.45, 1.0, '#7a4a2a', { parent: torso, at: [0, 0.15, 0] }); // шкура на поясе
    lab.ball(0.55, '#7a6890', { parent: torso, at: [0, 1.7, 0.05], detail: 1 });
    lab.cone(0.5, 0.5, '#2a2030', { parent: torso, at: [0, 2.1, -0.05], sides: 7 }); // космы
    lab.ball(0.22, '#f4f0e0', { parent: torso, at: [0, 1.78, 0.45], detail: 1 });
    const eye = lab.ball(0.12, '#ff3d5a', { parent: torso, at: [0, 1.78, 0.6], unlit: true, glow: 1.6, shadow: false, detail: 0 }); // один глаз иныжа
    const arm = lab.group({ parent: torso, at: [0.95, 1.1, 0] });
    lab.box(0.36, 1.0, 0.4, skin, { parent: arm, at: [0, -0.45, 0] });
    lab.cyl(0.32, 0.16, 1.6, '#4a3020', { parent: arm, at: [0, -0.9, 0.7], rot: [Math.PI / 2, 0, 0], sides: 7 }); // дубина
    lab.box(0.36, 1.0, 0.4, skin, { parent: torso, at: [-0.95, 0.6, 0] });
    g.visible = false;
    const bar = lab.group({});
    lab.mesh(new T.PlaneGeometry(2.2, 0.22), new T.MeshBasicMaterial({ color: '#1a0a14', depthTest: false, transparent: true, opacity: 0.85 }), { parent: bar, shadow: false });
    const fill = lab.mesh(new T.PlaneGeometry(2.1, 0.14).translate(1.05, 0, 0), new T.MeshBasicMaterial({ color: '#ff3d5a', depthTest: false, transparent: true }), { parent: bar, at: [-1.05, 0, 0.01], shadow: false });
    bar.children.forEach(m => { m.renderOrder = 10; });
    bar.visible = false;
    st.eliteParts = { g, legs, torso, arm, eye, bar, fill };
  },
  eliteSpawn(lab, x, z) {
    const st = lab.state, P = st.eliteParts;
    st.elites++;
    const hp = 40 * (1 + st.wt / 90) * (1 + (st.elites - 1) * 0.5);
    st.elite = Object.assign({ x, z, hp, max: hp, mode: 'walk', mt: 0, flash: 0, age: 0, warn: null }, P);
    P.g.visible = true; P.bar.visible = true; P.g.position.set(x, 0, z); P.g.scale.setScalar(0.01);
    lab.tween(0.5, k => P.g.scale.setScalar(1.35 * k), 'outBack');
    lab.ring(lab.v3(x, 0.1, z), { color: '#ff3d5a', radius: 3 });
  },
  moveElite(lab, dt) {
    const st = lab.state, el = st.elite, h = st.hero;
    if (!el) return;
    el.age += dt; el.mt -= dt; el.flash = Math.max(0, el.flash - dt);
    const dx = h.x - el.x, dz = h.z - el.z, d = Math.hypot(dx, dz) || 1;
    if (el.mode === 'walk') {
      el.x += dx / d * 2.5 * dt; el.z += dz / d * 2.5 * dt;
      el.g.rotation.y = Math.atan2(dx, dz);
      el.legs[0].rotation.x = Math.sin(el.age * 5) * 0.4; el.legs[1].rotation.x = -Math.sin(el.age * 5) * 0.4;
      el.arm.rotation.x = 0;
      if (d < 3.6 && el.age > 1) { // замах: дубина вверх, круг на земле, где придётся удар
        el.mode = 'wind'; el.mt = 0.8;
        el.sx = el.x + dx / d * 1.8; el.sz = el.z + dz / d * 1.8;
        el.warn = lab.warn(lab.v3(el.sx, 0.05, el.sz), 2.4, 0.8, '#ff3d5a');
      }
    } else if (el.mode === 'wind') {
      el.arm.rotation.x = -2.4 * (1 - el.mt / 0.8);
      if (el.mt <= 0) {
        el.mode = 'rest'; el.mt = 1.1; el.arm.rotation.x = 0.6;
        lab.shake(0.4); lab.sfx.explode(); lab.ring(lab.v3(el.sx, 0.1, el.sz), { color: '#ff3d5a', radius: 2.8 });
        lab.burst(lab.v3(el.sx, 0.3, el.sz), { count: 20, colors: ['#7a86a0', '#ff3d5a', '#3a2e48'], speed: 6, size: 0.25 });
        if (Math.hypot(h.x - el.sx, h.z - el.sz) < 2.4 && h.dash <= 0 && st.wt >= 8) this.touch(lab, { type: 'zhuk' }, (el.sx - el.x) / 1.8, (el.sz - el.z) / 1.8);
      }
    } else if (el.mode === 'rest' && el.mt <= 0) { el.mode = 'walk'; el.arm.rotation.x = 0; }
    // рой не лезет внутрь иныжа; касание иныжа ранит
    if (d < 1.2 && st.wt >= 8 && h.dash <= 0) this.touch(lab, { type: 'zhuk' }, dx / d, dz / d);
    el.g.position.set(el.x, 0, el.z);
    el.torso.scale.y = 1 + Math.sin(el.age * 2) * 0.03;
    el.eye.scale.setScalar(el.mode === 'wind' ? 1.6 + Math.sin(el.age * 40) * 0.3 : 1);
    el.bar.position.set(el.x, 4.3, el.z); el.bar.quaternion.copy(lab.camera.quaternion);
    el.fill.scale.x = Math.max(0.001, el.hp / el.max);
    // кольцо искр, дым и молот бьют и по иныжу
    const L = st.lv;
    if (this.sparkCount(lab) && (el.ringCd = (el.ringCd || 0) - dt) <= 0 && Math.abs(d - ((L.kolco >= 4 ? 2.6 : 2.1) + (st.evo.venec ? 0.8 : 0))) < 1.1) { el.ringCd = 0.45; this.hitElite(lab, 1.5 * st.k.dmg); }
    if (this.smokeR(lab) && d < this.smokeR(lab) + 1 && st.smokeTick) this.hitElite(lab, 0.8 * st.k.dmg);
  },
  hitElite(lab, dmg) {
    const st = lab.state, el = st.elite;
    if (!el) return;
    el.hp -= dmg;
    if (el.flash <= 0) { lab.whiten(el.g, 0.06); el.flash = 0.12; }
    if (el.hp > 0) return;
    st.eliteKills++; st.elite = null; el.g.visible = false; el.bar.visible = false;
    if (el.warn) el.warn.dispose();
    lab.count('иныжи');
    const pts = 300 * this.mult(lab); lab.score += pts;
    lab.popup(lab.v3(el.x, 3.5, el.z), `Иныж повержен! +${pts}`, '#ffd23f', 26);
    lab.slowmo(0.5, 0.3); lab.hitstop(0.1); lab.shake(0.5); lab.flash('#ffd23f', 0.15); lab.sfx.explode();
    lab.burst(lab.v3(el.x, 1.5, el.z), { count: 30, colors: ['#6c5a80', '#ff3d5a', '#ffd23f'], speed: 9, size: 0.3, life: 0.8 });
    for (let i = 0; i < 6; i++) { const a = i / 6 * Math.PI * 2; this.dropGem(lab, el.x + Math.cos(a) * 1.4, el.z + Math.sin(a) * 1.4, true, 2); }
    const c = st.chest; c.on = true; c.x = el.x; c.z = el.z; c.t = 0; c.g.visible = true; c.g.position.set(el.x, 0, el.z);
    st.cam.punch = 1;
  },

  // ---------- сундук, алтарь, цель, магазин ----------
  extrasBuild(lab) {
    const T = lab.THREE, st = lab.state;
    const cg = lab.group({});
    lab.box(1, 0.6, 0.7, '#7a4a2a', { parent: cg, at: [0, 0.3, 0], round: 0.05 });
    const lid = lab.box(1.04, 0.24, 0.74, '#8a5a32', { parent: cg, at: [0, 0.72, 0], round: 0.06 });
    for (const x of [-0.35, 0.35]) lab.box(0.1, 0.98, 0.76, '#ffd23f', { parent: cg, at: [x, 0.45, 0], metal: 0.6, shiny: true });
    lab.box(0.9, 0.05, 0.62, '#ffd23f', { parent: cg, at: [0, 0.62, 0], unlit: true, glow: 1.5, shadow: false });
    cg.visible = false;
    st.chest = { g: cg, lid, on: false, x: 0, z: 0, t: 0 };
    const ag = lab.group({});
    lab.box(1.6, 0.3, 1.2, '#5a6278', { parent: ag, at: [0, 0.15, 0] });
    for (const x of [-0.9, 0.9]) lab.box(0.35, 1.5, 0.35, '#6a7288', { parent: ag, at: [x, 0.75, -0.3], rot: x * 0.08 });
    lab.cyl(0.35, 0.25, 0.3, '#3a3040', { parent: ag, at: [0, 0.45, 0], sides: 8 });
    const flame = lab.cone(0.28, 0.7, '#ff3d5a', { parent: ag, at: [0, 0.9, 0], unlit: true, glow: 1.6, shadow: false, sides: 6 });
    const zone = lab.mesh(new T.RingGeometry(1.25, 1.45, 32).rotateX(-Math.PI / 2), lab.mat('#ff3d5a', { unlit: true, glow: 1 }), { parent: ag, at: [0, 0.05, 0], shadow: false });
    const fill = lab.mesh(new T.CircleGeometry(1.25, 32).rotateX(-Math.PI / 2), new T.MeshBasicMaterial({ color: '#5a1018', transparent: true, blending: T.AdditiveBlending, depthWrite: false, fog: false }), { parent: ag, at: [0, 0.06, 0], shadow: false });
    ag.visible = false;
    st.altar = { g: ag, flame, zone, fill, on: false, x: 0, z: 0, t: 0, stand: 0 };
  },
  extras(lab, dt) {
    const st = lab.state, cfg = lab.cfg, h = st.hero;
    st.alarmT -= dt;
    if (st.curse > 0) st.curse -= dt;
    st.splats.forEach(s => { s.t += dt; });
    if (st.splats.length && st.splats[0].t > 6) st.splats.shift();
    // сундук иныжа: подойди — выбери улучшение
    const c = st.chest;
    if (c.on) {
      c.t += dt; c.g.position.y = Math.abs(Math.sin(c.t * 3)) * 0.15; c.g.rotation.y += dt;
      if (Math.hypot(h.x - c.x, h.z - c.z) < 1.1) {
        c.on = false; c.g.visible = false; st.chests++; lab.count('сундуки');
        lab.burst(lab.v3(c.x, 0.8, c.z), { count: 24, colors: ['#ffd23f', '#ffffff', '#ff9a3d'], speed: 6, size: 0.2 });
        lab.sfx.coin();
        if (cfg.shop >= 1) { st.money += 10; lab.popup(lab.v3(h.x, 2.4, h.z), '💎 +10', '#4fd2ff', 22); }
        else this.openChoice(lab, 'chest');
      }
    }
    // алтарь риска (вариация): встань на него на секунду — врагов ×2 на 20 с, опыт ×2
    const A = st.altar;
    if (cfg.altar >= 1) {
      if (!A.on && st.wt >= st.altarT && st.curse <= 0) {
        st.altarT = st.wt + 40;
        const a = lab.rand(0, Math.PI * 2);
        Object.assign(A, { on: true, x: h.x + Math.cos(a) * 7, z: h.z + Math.sin(a) * 6, t: 0, stand: 0 });
        A.g.visible = true; A.g.position.set(A.x, 0, A.z); A.g.scale.setScalar(0.01);
        lab.tween(0.4, k => A.g.scale.setScalar(k), 'outBack');
        this.alarm(lab, '🔥 Алтарь риска! Встань — врагов ×2, опыт ×2');
      }
      if (A.on) {
        A.t += dt;
        A.flame.scale.y = 1 + Math.sin(lab.t * 12) * 0.15;
        A.zone.rotation.y += dt;
        const on = Math.hypot(h.x - A.x, h.z - A.z) < 1.35;
        A.stand = on ? A.stand + dt : Math.max(0, A.stand - dt * 2);
        A.fill.scale.setScalar(0.05 + A.stand);
        if (A.stand >= 1) {
          A.on = false; A.g.visible = false; st.curse = 20; st.altars++; lab.count('алтарь');
          lab.flash('#ff3d5a', 0.25); lab.shake(0.3); lab.sfx.power(); lab.tone(110, 0.8, 'sawtooth', 0.1, 60);
          lab.ring(lab.v3(A.x, 0.1, A.z), { color: '#ff3d5a', radius: 5 });
          lab.popup(lab.v3(h.x, 3, h.z), 'Проклятие! Врагов ×2, опыт ×2', '#ff6a5a', 22);
        } else if (A.t > 15) { A.on = false; lab.tween(0.3, k => A.g.scale.setScalar(1 - k)); lab.after(0.3, () => { A.g.visible = false; }); }
      }
    }
    // цель «продержись»: праздник и игра дальше на рекорд
    if (cfg.goal > 0 && !st.goalDone && st.wt >= cfg.goal) {
      st.goalDone = true; lab.count('цель');
      lab.sfx.win(); lab.flash('#ffd23f', 0.2); lab.slowmo(0.8, 0.35);
      lab.addScore(1000, lab.v3(h.x, 2.2, h.z), '#ffd23f');
      lab.popup(lab.v3(h.x, 3.6, h.z), `Ты продержался ${this.clock(cfg.goal)}!`, '#ffe680', 30);
      for (let i = 0; i < 5; i++) lab.after(i * 0.15, () => lab.burst(lab.v3(st.hero.x + lab.rand(-3, 3), 3, st.hero.z + lab.rand(-2, 2)), { count: 24, colors: ['#ffd23f', '#ff6ad5', '#5fe0ff', '#7cf5a8'], speed: 7, size: 0.2, gravity: 4 }));
    }
    // магазин (вариация): волна по 30 с, потом рой отступает и открывается лавка
    if (cfg.shop >= 1) {
      st.waveT -= dt;
      if (st.waveT <= 0) {
        st.waveT = 30; st.wave++;
        for (const e of st.foes) lab.burst(lab.v3(e.x, 0.6, e.z), { count: 2, colors: ['#3a2e48', '#6a5a80'], speed: 2, size: 0.2, life: 0.5 });
        st.foes.length = 0;
        for (const g of st.gems) { st.money += g.v; st.picks++; } st.gems.length = 0; // всё, что лежит, собирается само
        this.openChoice(lab, 'shop');
      }
    }
  },

  // ---------- выбор одного из трёх ----------
  cardsBuild(lab, scene) {
    const T = lab.THREE, st = lab.state, g = new T.Group();
    g.visible = false; scene.add(g);
    const cards = [0, 1, 2].map(() => {
      const cv = document.createElement('canvas'); cv.width = 300; cv.height = 420;
      const tex = new T.CanvasTexture(cv); tex.colorSpace = T.SRGBColorSpace;
      const m = new T.Mesh(new T.PlaneGeometry(1, 1.4), new T.MeshBasicMaterial({ map: tex, transparent: true, depthTest: false, depthWrite: false, fog: false, toneMapped: false }));
      m.renderOrder = 20; m.userData.noShadow = true; g.add(m);
      return { cv, tex, m };
    });
    const frame = new T.Mesh(new T.PlaneGeometry(1.07, 1.47), new T.MeshBasicMaterial({ color: '#ffd23f', transparent: true, opacity: 0.9, depthTest: false, depthWrite: false, fog: false }));
    frame.renderOrder = 19; g.add(frame);
    const bar = new T.Mesh(new T.PlaneGeometry(1, 0.03).translate(0.5, 0, 0), new T.MeshBasicMaterial({ color: '#ffffff', transparent: true, depthTest: false, depthWrite: false, fog: false, toneMapped: false }));
    bar.renderOrder = 21; g.add(bar);
    st.cardUI = { g, cards, frame, bar };
  },
  // тройка карточек. Спрятанная механика: карточки разных направлений и сопоставимой силы — очевидно лучшей нет.
  // Выключена: одна карточка (Сила нарта) всегда явно сильнее двух других
  offer(lab) {
    const st = lab.state, cfg = lab.cfg, L = st.lv, U = this.UPG;
    if (cfg.secret < 1) return this.shuffle(lab, ['sila', 'shnurok', 'pugovica'].map(id => this.cardOf(lab, id)));
    const can = id => (L[id] || 0) < U[id].max && !(id === 'serdce' && lab.lives >= lab.cfg.lives + 3);
    const dmg = Object.keys(U).filter(id => U[id].cat === 'урон' && can(id));
    const own = dmg.filter(id => L[id]), fresh = dmg.filter(id => !L[id]);
    const util = Object.keys(U).filter(id => U[id].cat !== 'урон' && can(id));
    const out = [], take = list => { const l = list.filter(id => !out.includes(id)); if (l.length) out.push(lab.pick(l)); };
    take(own.length ? own : fresh); take(fresh.length ? fresh : own); take(util);
    while (out.length < 3) { const rest = Object.keys(U).filter(id => can(id) && !out.includes(id)); if (!rest.length) break; out.push(lab.pick(rest)); }
    while (out.length < 3) out.push('serdce');
    const cards = out.map(id => this.cardOf(lab, id));
    // связки: если обе вещи на 3-й ступени — одна карточка становится связкой 🔗
    if (cfg.evolve >= 1) for (const id in this.EVO) { const E = this.EVO[id]; if (!st.evo[id] && E.from.every(f => (L[f] || 0) >= 3)) { cards[2] = this.cardOf(lab, id); break; } }
    return this.shuffle(lab, cards);
  },
  shuffle(lab, a) { for (let i = a.length - 1; i > 0; i--) { const j = lab.randInt(0, i); [a[i], a[j]] = [a[j], a[i]]; } return a; },
  cardOf(lab, id) {
    const st = lab.state, U = this.UPG[id], J = this.JUNK[id], E = this.EVO[id], cfg = lab.cfg;
    if (E) return { id, kind: 'evo', name: E.name, cat: 'связка', color: E.color, tip: E.tip, lvl: 'связка!', worth: 1.3, price: 25 };
    if (J) return { id, kind: 'junk', name: J.name, cat: J.cat, color: J.color, tip: J.tip, lvl: id === 'sila' ? `ступень ${st.sila + 1}` : '', worth: J.worth, price: id === 'sila' ? 12 : 4 };
    const L = st.lv[id] || 0, tip = U.tips[Math.min(L, U.tips.length - 1)];
    const c = { id, kind: 'upg', name: U.name, cat: U.cat, color: U.color, tip, lvl: id === 'serdce' ? '' : L ? `ступень ${L} → ${L + 1}` : 'новое!', worth: 1, price: 6 + 4 * L };
    if (cfg.minus >= 1 && U.minus && id !== 'serdce') c.minus = { speed: `−${Math.round(U.minus[1] * 100)} % к бегу`, magnet: `−${String(U.minus[1]).replace('.', ',')} м подбора`, dmg: `−${Math.round(U.minus[1] * 100)} % урона всему` }[U.minus[0]];
    if (cfg.evolve >= 1 && U.pair && !st.evo[U.evo]) c.pair = `с «${this.UPG[U.pair].name}» на 3-й → ${this.EVO[U.evo].name}`;
    return c;
  },
  openChoice(lab, kind) {
    const st = lab.state, cfg = lab.cfg, h = st.hero;
    const cards = this.offer(lab);
    st.choice = { kind, cards, sel: 1, t: 0, lock: 0.35, time: kind === 'shop' ? cfg.pickTime + 4 : cfg.pickTime, k: 0 };
    st.offers++;
    const w = cards.map(c => c.worth), fair = Math.max(...w) / Math.max(0.01, Math.min(...w)) <= 1.6;
    if (fair) st.fair++;
    if (cfg.secret >= 1 && kind !== 'shop') lab.count('_secret');
    this.drawCards(lab);
    lab.sfx.power();
    lab.ring(lab.v3(h.x, 0.1, h.z), { color: kind === 'chest' ? '#ffd23f' : '#4fd2ff', radius: 3.5 });
    lab.burst(lab.v3(h.x, 1, h.z), { count: 16, colors: ['#4fd2ff', '#ffffff', '#ffd23f'], speed: 5, size: 0.15, up: 2 });
  },
  tickChoice(lab, dt) {
    const st = lab.state, c = st.choice, p = lab.p1, cfg = lab.cfg;
    c.t += dt; c.lock -= dt; c.k = Math.min(1, c.k + dt / 0.25);
    if (p.pressed.left) { c.sel = (c.sel + 2) % 3; lab.sfx.beep(); }
    if (p.pressed.right) { c.sel = (c.sel + 1) % 3; lab.sfx.beep(); }
    if (c.lock <= 0 && p.pressed.a) {
      if (c.kind === 'shop') this.buy(lab);
      else return this.take(lab, c.cards[c.sel], false);
    }
    if (c.lock <= 0 && p.pressed.b) {
      if (c.kind === 'shop') return this.closeChoice(lab);
      if (st.rerolls > 0) { st.rerolls--; lab.count('перебросы'); c.cards = this.offer(lab); c.t = 0; this.drawCards(lab); lab.sfx.whoosh(); lab.popup(lab.v3(st.hero.x, 2.4, st.hero.z), '🎲 Новые карточки', '#ffe680', 18); }
    }
    if (c.t >= c.time) { if (c.kind === 'shop') return this.closeChoice(lab); return this.take(lab, c.cards[c.sel], true); }
    this.placeCards(lab);
  },
  buy(lab) {
    const st = lab.state, c = st.choice, card = c.cards[c.sel];
    if (!card || card.bought) return lab.sfx.beep();
    if (st.money < card.price) { lab.tone(150, 0.15, 'square', 0.05); lab.popup(lab.v3(st.hero.x, 2.4, st.hero.z), `Не хватает 💎 ${card.price - st.money}`, '#ff8a7a', 16); return; }
    st.money -= card.price; card.bought = true;
    this.apply(lab, card);
    lab.sfx.coin();
    this.drawCards(lab);
  },
  take(lab, card, auto) {
    const st = lab.state, h = st.hero;
    this.apply(lab, card);
    lab.popup(lab.v3(h.x, 2.8, h.z), (auto ? 'Само: ' : '') + card.name, card.color, 22);
    this.closeChoice(lab);
  },
  apply(lab, card) {
    const st = lab.state, cfg = lab.cfg, h = st.hero, id = card.id;
    lab.count('взял: ' + card.name);
    st.taken.push(card.name);
    if (card.kind === 'evo') { st.evo[id] = true; lab.count('связки'); lab.flash('#ffe27a', 0.2); lab.sfx.win(); }
    else if (card.kind === 'junk') { if (id === 'sila') st.sila++; else st.junk[id]++; }
    else if (id === 'serdce') lab.lives++;
    else {
      st.lv[id] = (st.lv[id] || 0) + 1;
      if (cfg.minus >= 1) { const U = this.UPG[id]; st.minus[U.minus[0]] += U.minus[1]; st.boost[id] = (st.boost[id] || 1) * 1.3; }
      if (id === 'burka' && st.lv.burka === 1) { st.shield = true; }
    }
    this.derive(lab);
    lab.pulse(h.body, 1.3, 0.2); lab.sfx.coin();
    lab.burst(lab.v3(h.x, 1.2, h.z), { count: 18, colors: [card.color, '#ffffff'], speed: 5, size: 0.16, up: 2 });
  },
  closeChoice(lab) {
    const st = lab.state;
    st.choice = null; st.cardUI.g.visible = false;
    lab.invuln = Math.max(lab.invuln, 0.7); // после выбора — миг на то, чтобы оглядеться
  },
  placeCards(lab) {
    const st = lab.state, U = st.cardUI, c = st.choice, cam = lab.camera;
    if (!c || !cam) return;
    U.g.visible = true;
    U.g.position.copy(cam.position); U.g.quaternion.copy(cam.quaternion);
    const D = 5, vh = 2 * D * Math.tan(cam.fov * Math.PI / 360), vw = vh * cam.aspect;
    const ch = Math.min(vh * 0.48, vw * 0.9 / 3.3 / 0.714), cw = ch * 0.714, gap = cw * 1.1, k = lab.ease.outBack(c.k);
    U.cards.forEach((cd, i) => {
      const sel = i === c.sel, s = ch / 1.4 * k * (sel ? 1.08 : 0.94);
      cd.m.position.set((i - 1) * gap, -vh * 0.03 + (sel ? ch * 0.05 : 0), -D);
      cd.m.scale.set(s, s, 1);
      cd.m.material.opacity = sel ? 1 : 0.93;
      if (sel) { U.frame.position.set(cd.m.position.x, cd.m.position.y, -D - 0.01); U.frame.scale.set(s, s, 1); U.frame.material.color.set(c.cards[i].color); }
    });
    const left = 1 - c.t / c.time;
    U.bar.position.set(-1.6 * gap, -vh * 0.03 - ch * 0.6, -D); U.bar.scale.set(3.2 * gap * left * k, ch / 1.4, 1);
    U.bar.material.color.set(c.time - c.t < 3 ? '#c83040' : '#8a96c8');
  },
  // карточка рисуется на холсте: значок, имя, ступень, что даёт, минус, связка, цена
  drawCards(lab) {
    const st = lab.state, c = st.choice, U = st.cardUI;
    c.cards.forEach((card, i) => {
      const cd = U.cards[i], x = cd.cv.getContext('2d'), W = 300, H = 420;
      x.clearRect(0, 0, W, H);
      x.fillStyle = '#16122a'; this.rrect(x, 6, 6, W - 12, H - 12, 22); x.fill();
      x.lineWidth = 6; x.strokeStyle = card.color; this.rrect(x, 6, 6, W - 12, H - 12, 22); x.stroke();
      x.fillStyle = card.color; x.globalAlpha = 0.18; this.rrect(x, 12, 12, W - 24, 200, 18); x.fill(); x.globalAlpha = 1;
      x.font = 'bold 18px sans-serif'; x.textAlign = 'center'; x.fillStyle = card.color; x.fillText(card.cat.toUpperCase(), W / 2, 40);
      this.icon(x, card.id, W / 2, 125, 62, card.color);
      x.fillStyle = '#ffffff'; x.font = 'bold 27px sans-serif';
      let y = 238;
      for (const line of this.wrap(x, card.name, W - 30)) { x.fillText(line, W / 2, y); y += 30; }
      if (card.lvl) { x.fillStyle = '#ffd23f'; x.font = 'bold 19px sans-serif'; x.fillText(card.lvl, W / 2, y); y += 28; }
      x.fillStyle = '#e8ecff'; x.font = '20px sans-serif';
      for (const line of this.wrap(x, card.tip, W - 34).slice(0, 2)) { x.fillText(line, W / 2, y); y += 24; }
      if (card.minus) { x.fillStyle = '#7cf5a8'; x.font = 'bold 17px sans-serif'; x.fillText('плюс сильнее на 30 %', W / 2, y); y += 21; x.fillStyle = '#ff7a8a'; x.fillText(card.minus, W / 2, y); y += 22; }
      if (card.pair) { x.fillStyle = '#ffe27a'; x.font = '15px sans-serif'; this.chain(x, 34, y - 6); for (const line of this.wrap(x, card.pair, W - 70).slice(0, 2)) { x.fillText(line, W / 2 + 14, y); y += 18; } }
      if (c.kind === 'shop') {
        const ok = st.money >= card.price && !card.bought;
        x.fillStyle = card.bought ? '#7cf5a8' : ok ? '#4fd2ff' : '#ff7a8a'; x.font = 'bold 26px sans-serif';
        x.fillText(card.bought ? 'Куплено' : `${card.price}`, W / 2 + (card.bought ? 0 : 14), H - 26);
        if (!card.bought) this.diamond(x, W / 2 - 30, H - 35, 11, '#4fd2ff');
      }
      cd.tex.needsUpdate = true;
    });
  },
  rrect(x, a, b, w, h, r) { x.beginPath(); x.moveTo(a + r, b); x.arcTo(a + w, b, a + w, b + h, r); x.arcTo(a + w, b + h, a, b + h, r); x.arcTo(a, b + h, a, b, r); x.arcTo(a, b, a + w, b, r); x.closePath(); },
  wrap(x, text, w) { const out = []; let line = ''; for (const word of String(text).split(' ')) { const t = line ? line + ' ' + word : word; if (x.measureText(t).width > w && line) { out.push(line); line = word; } else line = t; } if (line) out.push(line); return out; },
  diamond(x, cx, cy, r, col) { x.fillStyle = col; x.beginPath(); x.moveTo(cx, cy - r * 1.3); x.lineTo(cx + r, cy); x.lineTo(cx, cy + r * 1.3); x.lineTo(cx - r, cy); x.closePath(); x.fill(); },
  chain(x, cx, cy) { x.strokeStyle = '#ffe27a'; x.lineWidth = 3; x.beginPath(); x.ellipse(cx - 5, cy, 7, 4.5, 0, 0, Math.PI * 2); x.stroke(); x.beginPath(); x.ellipse(cx + 5, cy, 7, 4.5, 0, 0, Math.PI * 2); x.stroke(); },
  // значки улучшений: простые фигуры, чтобы читались и без текста
  icon(x, id, cx, cy, r, col) {
    x.save();
    x.fillStyle = '#0c0a18'; x.beginPath(); x.arc(cx, cy, r, 0, Math.PI * 2); x.fill();
    x.strokeStyle = col; x.fillStyle = col; x.lineWidth = 7; x.lineCap = 'round'; x.lineJoin = 'round';
    const L = (pts) => { x.beginPath(); pts.forEach(([a, b], i) => (i ? x.lineTo(cx + a * r, cy + b * r) : x.moveTo(cx + a * r, cy + b * r))); x.stroke(); };
    const dot = (a, b, s) => { x.beginPath(); x.arc(cx + a * r, cy + b * r, s * r, 0, Math.PI * 2); x.fill(); };
    if (id === 'posoh' || id === 'solnce') { L([[-0.35, 0.6], [0.2, -0.2]]); dot(0.28, -0.32, 0.22); x.fillStyle = '#ffe27a'; dot(0.28, -0.32, 0.11); if (id === 'solnce') for (let i = 0; i < 8; i++) { const a = i / 8 * Math.PI * 2; L([[0.28 + Math.cos(a) * 0.3, -0.32 + Math.sin(a) * 0.3], [0.28 + Math.cos(a) * 0.42, -0.32 + Math.sin(a) * 0.42]]); } }
    else if (id === 'kolco' || id === 'venec') { x.lineWidth = 3; x.beginPath(); x.arc(cx, cy, r * 0.5, 0, Math.PI * 2); x.stroke(); const n = id === 'venec' ? 8 : 4; for (let i = 0; i < n; i++) { const a = i / n * Math.PI * 2; dot(Math.cos(a) * 0.5, Math.sin(a) * 0.5, 0.12); } dot(0, 0, 0.12); }
    else if (id === 'dymar' || id === 'tucha') { x.globalAlpha = 0.85; dot(-0.25, 0.1, 0.3); dot(0.2, -0.05, 0.36); dot(0.05, 0.3, 0.26); if (id === 'tucha') { x.fillStyle = '#ffe27a'; L([[0, 0.2], [-0.12, 0.5], [0.08, 0.45], [-0.05, 0.75]]); } }
    else if (id === 'molot') { x.fillRect(cx - r * 0.5, cy - r * 0.55, r * 1.0, r * 0.45); L([[0, -0.1], [0, 0.62]]); }
    else if (id === 'molniya' || id === 'grom') { L([[0.15, -0.65], [-0.2, 0.0], [0.15, 0.0], [-0.15, 0.65]]); if (id === 'grom') x.fillRect(cx + r * 0.2, cy - r * 0.5, r * 0.4, r * 0.25); }
    else if (id === 'burka') { x.beginPath(); x.moveTo(cx - r * 0.55, cy + r * 0.55); x.lineTo(cx - r * 0.3, cy - r * 0.45); x.lineTo(cx + r * 0.3, cy - r * 0.45); x.lineTo(cx + r * 0.55, cy + r * 0.55); x.closePath(); x.fill(); }
    else if (id === 'serdce') { x.beginPath(); x.moveTo(cx, cy + r * 0.55); x.bezierCurveTo(cx - r * 0.9, cy - r * 0.1, cx - r * 0.4, cy - r * 0.75, cx, cy - r * 0.3); x.bezierCurveTo(cx + r * 0.4, cy - r * 0.75, cx + r * 0.9, cy - r * 0.1, cx, cy + r * 0.55); x.fill(); }
    else if (id === 'sapogi' || id === 'shnurok') { L([[-0.15, -0.55], [-0.15, 0.4], [0.45, 0.4]]); if (id === 'sapogi') L([[-0.55, -0.1], [-0.35, -0.1]]); }
    else if (id === 'magnit' || id === 'pugovica') { x.lineWidth = 12; x.beginPath(); x.arc(cx, cy, r * 0.38, Math.PI, 0); x.stroke(); L([[-0.38, 0], [-0.38, 0.45]]); L([[0.38, 0], [0.38, 0.45]]); }
    else if (id === 'sila') { x.font = `bold ${Math.round(r * 0.9)}px sans-serif`; x.textAlign = 'center'; x.fillText('+40%', cx, cy + r * 0.3); }
    x.restore();
  },

  // ---------- живая камера ----------
  liveCamera(lab, dt) {
    const st = lab.state, v = lab.view, C = st.cam;
    if (!v || !C) return;
    if (Math.abs(v.distance - C.last) > 0.01) C.d = v.distance / C.k;
    C.punch = Math.max(0, C.punch - dt * 1.5);
    const grow = 1 + 0.22 * Math.min(1, st.wt / 200); // рой растёт — камера отъезжает, видно больше
    const want = (st.choice ? 0.9 : grow) * (1 - 0.06 * C.punch) * (1 + Math.sin(lab.t * 0.4) * 0.008);
    C.k = lab.damp(C.k, want, 1.6, dt); v.distance = C.d * C.k; C.last = v.distance;
    v.tilt = lab.damp(v.tilt, C.tilt + (st.near >= 6 ? 0.04 : 0), 1.5, dt);
  },

  // ---------- рисуем всё, что двигается: копии одной пачкой ----------
  draw(lab, dt) {
    const st = lab.state, t = st.tmp, F = this.FOES, h = st.hero;
    const n = { moshka: 0, shershen: 0, mysh: 0, zhuk: 0 };
    for (const e of st.foes) {
      if (e.gone) continue;
      const P = st.foeIM[e.type], i = n[e.type]++, f = F[e.type];
      if (i >= f.cap) continue;
      const grow = e.age < 0.25 ? lab.ease.outBack(e.age / 0.25) : 1;
      let y = f.y + (e.type === 'zhuk' ? 0 : Math.sin(lab.t * 6 + e.ph) * 0.12), sx = 1, roll = 0;
      if (e.type === 'mysh') { sx = 0.75 + Math.abs(Math.sin(lab.t * 10 + e.ph)) * 0.4; if (e.mode === 'dash') { sx = 0.6; y -= 0.3; } }
      if (e.type === 'moshka') roll = Math.sin(lab.t * 20 + e.ph) * 0.2;
      if (e.type === 'zhuk') y = Math.abs(Math.sin(e.age * 8)) * 0.04;
      t.p.set(e.x, y, e.z); t.q.setFromEuler(t.e.set(0, e.yaw, roll)); t.s.set(grow * sx, grow, grow);
      t.m.compose(t.p, t.q, t.s);
      P.body.setMatrixAt(i, t.m); P.eye.setMatrixAt(i, t.m);
      const fl = e.flash > 0 ? 3 : 1;
      P.body.setColorAt(i, t.c.setRGB(fl, fl, fl));
      const aim = e.mode === 'aim' ? (Math.sin(lab.t * 40) > 0 ? 2.2 : 0.6) : 1;
      P.eye.setColorAt(i, t.c.set('#ff3d5a').multiplyScalar(aim * (e.flash > 0 ? 1.8 : 1)));
    }
    for (const id in st.foeIM) { const P = st.foeIM[id]; P.body.count = P.eye.count = Math.min(n[id], F[id].cap); for (const im of [P.body, P.eye]) { im.instanceMatrix.needsUpdate = true; if (im.instanceColor) im.instanceColor.needsUpdate = true; } }
    // кристаллы: висят над травой, крутятся; тень-кружок под каждым
    const gs = { small: 0, big: 0 };
    let sh = 0;
    for (const g of st.gems) {
      const k = g.big ? 'big' : 'small', i = gs[k]++, grow = Math.min(1, g.t / 0.2);
      t.p.set(g.x, 0.35 + Math.sin(lab.t * 3 + g.ph) * 0.08 + (g.fly ? 0.4 : 0), g.z); t.q.setFromEuler(t.e.set(0, lab.t * 2 + g.ph, 0)); t.s.setScalar(grow);
      st.gemIM[k].setMatrixAt(i, t.m.compose(t.p, t.q, t.s));
      t.p.set(g.x, 0.03, g.z); t.q.identity(); t.s.setScalar(g.big ? 1.4 : 1);
      st.gemShadow.setMatrixAt(sh++, t.m.compose(t.p, t.q, t.s));
    }
    for (const k of ['small', 'big']) { st.gemIM[k].count = gs[k]; st.gemIM[k].instanceMatrix.needsUpdate = true; }
    st.gemShadow.count = sh; st.gemShadow.instanceMatrix.needsUpdate = true;
    // огненные шары
    st.balls.forEach((b, i) => {
      if (i >= this.CAPS.balls) return;
      t.p.set(b.x, 0.95, b.z); t.q.setFromEuler(t.e.set(0, Math.atan2(b.vx, b.vz), 0)); t.s.setScalar(1);
      st.ballIM.setMatrixAt(i, t.m.compose(t.p, t.q, t.s));
    });
    st.ballIM.count = Math.min(st.balls.length, this.CAPS.balls); st.ballIM.instanceMatrix.needsUpdate = true;
    // искры кольца
    const nSp = this.sparkCount(lab), R = ((st.lv.kolco || 0) >= 4 ? 2.6 : 2.1) + (st.evo.venec ? 0.8 : 0);
    for (let i = 0; i < nSp && i < this.CAPS.sparks; i++) {
      const a = st.ringA + i / nSp * Math.PI * 2;
      t.p.set(h.x + Math.cos(a) * R, 0.9 + Math.sin(lab.t * 5 + i) * 0.1, h.z + Math.sin(a) * R); t.q.identity(); t.s.setScalar(1 + Math.sin(lab.t * 12 + i) * 0.15);
      st.sparkIM.setMatrixAt(i, t.m.compose(t.p, t.q, t.s));
    }
    st.sparkIM.count = Math.min(nSp, this.CAPS.sparks); st.sparkIM.instanceMatrix.needsUpdate = true;
    // дым дымаря: клубы кружат вокруг героя
    const sR = this.smokeR(lab), np = sR ? Math.min(this.CAPS.puffs, 6 + Math.round(sR * 2)) : 0;
    for (let i = 0; i < np; i++) {
      const a = lab.t * 0.6 + i / np * Math.PI * 2, rr = sR * (0.55 + 0.3 * Math.sin(lab.t * 0.9 + i * 2));
      t.p.set(h.x + Math.cos(a) * rr, 0.45 + Math.sin(lab.t * 1.3 + i) * 0.15, h.z + Math.sin(a) * rr); t.q.identity(); t.s.setScalar(0.6 + sR * 0.15 + Math.sin(lab.t * 2 + i) * 0.1);
      st.puffIM.setMatrixAt(i, t.m.compose(t.p, t.q, t.s));
    }
    st.puffIM.count = np; st.puffIM.instanceMatrix.needsUpdate = true;
    st.smokeDisc.visible = !!sR; if (sR) { st.smokeDisc.position.set(h.x, 0.05, h.z); st.smokeDisc.scale.setScalar(sR); st.smokeDisc.rotation.y += dt * 0.5; }
    // молнии: звенья гаснут за 0,18 с
    st.segs.forEach(s => { s.t -= dt; });
    st.segs = st.segs.filter(s => s.t > 0);
    st.segs.forEach((s, i) => {
      t.p.set((s.a[0] + s.b[0]) / 2, (s.a[1] + s.b[1]) / 2, (s.a[2] + s.b[2]) / 2);
      const dx = s.b[0] - s.a[0], dy = s.b[1] - s.a[1], dz = s.b[2] - s.a[2], len = Math.hypot(dx, dy, dz) || 0.01;
      t.q.setFromUnitVectors(lab.v3(0, 0, 1), lab.v3(dx / len, dy / len, dz / len)); t.s.set(1 + s.t * 4, 1 + s.t * 4, len);
      st.boltIM.setMatrixAt(i, t.m.compose(t.p, t.q, t.s));
    });
    st.boltIM.count = Math.min(st.segs.length, this.CAPS.bolts); st.boltIM.instanceMatrix.needsUpdate = true;
    // следы на траве
    st.splats.forEach((s, i) => {
      const k = 1 - s.t / 6;
      t.p.set(s.x, 0.025, s.z); t.q.identity(); t.s.set(s.s * k, 1, s.s * k);
      st.splatIM.setMatrixAt(i, t.m.compose(t.p, t.q, t.s)); st.splatIM.setColorAt(i, t.c.set(s.c).multiplyScalar(0.35));
    });
    st.splatIM.count = st.splats.length; st.splatIM.instanceMatrix.needsUpdate = true; if (st.splatIM.instanceColor) st.splatIM.instanceColor.needsUpdate = true;
  },
};
