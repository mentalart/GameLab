// «Росток» — ремейк-донор урока 22 «Игра о чувстве» по мотивам Florence (Mountains, 2018) на оболочке «Лаб3D» 1.0 (three.js).
// Во Florence разговор героев собирается как пазл, и когда они сближаются, пазл становится проще: та же механика к концу
// ощущается иначе. Здесь подросток из посёлка Тульский живёт свои дни: уроки, друзья зовут, мусор, магазин, убраться, заправить кровать.
// А на подоконнике — росток в горшке, его надо поливать, пока ты занят всем остальным. Проиграть нельзя (кроме вариации «Тамагочи»):
// в конце камера наезжает на росток — каким он вырос, — и игра называет чувство партии.
// Спрятанная механика донора — процедурная риторика: механика меняется вместе с чувством (ручка secret). Росток откликается —
// поворачивается к герою, машет листом, когда хочет пить, расправляется после полива; между ними растёт связь. Дни 1–2 — знакомство
// (дел мало, росток пьёт часто), дни 3–4 — суета (дел больше и они громче, но чем крепче связь, тем дольше росток ждёт; если о нём
// забывали — мир блекнет), последний день — цветение: дел нет, только ты и росток. secret = 0 (пресет «Без спрятанной механики») —
// росток просто шкала, все дни одинаковые, мир не меняет цвет, дня-цветения нет.
// Вариации урока (пресеты с теми же именами — в Tab): Спешка (дел вдвое больше), Вина (как Papers, Please), Тамагочи,
// Надежда (как Gris), Одиночество (как Passage Джейсона Рорера), Без шкал (как Florence), Прощание (как Spiritfarer).
/* ПЛАН
   Фраза игры: ты — подросток из посёлка Тульский, ты делаешь свои дела в маленькой комнате, но на окне — росток, и он хочет пить
   именно тогда, когда дел больше всего. Цель — прожить пять дней и вырастить росток (а очки дают только дела).
   Ядро на 3 секунды: подошёл к делу → держишь A → золотое кольцо заполняется → искры, очки, нота выше за серию.
   Или: подошёл к окну → держишь A → лейка, голубая струя, росток расправляется, мягкая нота.
   Выбор, оплаченный очками: очки и множитель серии — только за дела; полив очков не даёт, но без воды росток не растёт и никнет.
   Бросишь дело ради ростка — сгорит серия. Бросишь росток ради серии — он засохнет. Чувство партии зависит от того, что ты выбирал.
   Угрозы (давление, а не урон): дела сгорают по таймеру-кольцу (минус серия); вода уходит; ночь отнимает время у дел.
   Дела разные по месту и времени: уроки у стола, друзья/мусор/магазин у двери (дольше), полка, кровать.
   Кривая партии: 0–3 с — комната, росток на окне, подсказка; 3 с — первое дело; 7–9 с — росток впервые хочет пить;
   каждый день ≈ 30 с: утро → день → вечер → короткая ночь (дел нет, росток спит и пьёт меньше); с 3-го дня дел больше и они громче;
   последний день — тихий: только ты и росток. Конец — наезд камеры на росток и чувство партии.
   События: дело появилось (звон, кольцо), дело сделано (искры, очки, нота выше), дело сгорело (дым, серия сгорела), полив (струя,
   нота), росток вырос до новой стадии (вспышка листьев, аккорд), росток хочет пить (взмах листа, колокольчик), новый день (утро,
   надпись), ночь (лампа зажигается), мир блекнет или возвращает цвет, финал (наезд камеры, тёплый свет или серые сумерки).
   Лицо игры: тёплая комната подростка в посёлке под Фиштом — открытая сверху диорама, как кукольный домик; за окном двор,
   подсолнухи и горы, свет комнаты живёт временем суток.
   Палитра: стены #f6e3c4 и #d99a6c, пол #c98a52, ковёр #3fa7b8, герой (только у него) #ff6a3d, росток #6ee06a,
   вода #4fc3ff, дела и награда #ffd23f, цветок #ff7ad9; ночь #0b1030.
   Свет: ключевой — солнце из-за окна (окно рисует тенью светлое пятно на полу, оно ползёт за день), заполняющий — небо;
   ночью — тёплая настольная лампа против синего окна.
   Три фирменных приёма: 1) пятно солнца из окна ползёт по полу, часы на стене идут вместе с днём;
   2) росток — единственное живое в комнате: смотрит на героя, машет листом, а в сером мире цвет остаётся только у него и у героя;
   3) золотые кольца-таймеры над делами и голубая струя лейки — два цвета двух забот.
*/
const GAME = {
  engine: 'three',
  title: 'Росток',
  subtitle: 'У тебя много дел. А на окне — росток',
  donor: 'Florence',
  players: 1,
  controls: [
    { input: 'move4', text: 'ходить' },
    { input: 'a', text: 'делать дело / поливать (держи)' },
  ],
  camera: { type: 'diorama', tilt: 0.95, turn: Math.PI / 4, target: [0.2, 0.7, -0.4], fov: 0.7 },
  field: { w: 11.5, h: 8.5 },
  shadowSize: 15,
  sky: ['#7fb8ff', '#ffd6a8'],
  fog: 0.022,
  accent: '#ffd23f',
  scoreColor: '#ffd23f', // счёт золотом, как кольца дел
  lives: 0, // проиграть нельзя: сердечек нет
  decisions: [
    'Чувство: забота — росток на окне тянется к тебе, а дела тянут в другую сторону; в конце видно, что ты выбирал',
    'Честность: у каждого дела видно кольцо-таймер, у ростка — вода и сам росток: никнет и желтеет заранее',
    'Выбор: очки и серия — только за дела. Бросить дело ради ростка или росток ради серии — решаешь ты',
  ],
  notes: [
    'Ночь короткая, но в ней нет дел, а росток пьёт меньше: это передышка перед следующим днём.',
    'Делать дело и поливать можно на ходу: герой замедляется, но прогресс кольца не теряется, если отойти.',
    'Очки — только за дела. Полив очков не даёт: в этом и вопрос игры, что для тебя важнее.',
  ],
  config: {
    secret: { value: 1, min: 0, max: 1, step: 1, label: 'Спрятанная механика: росток откликается, правила меняются по дням', hint: '0 — росток просто шкала: не зовёт, все дни одинаковые, мир не меняет цвет' },
    days: { value: 5, min: 1, max: 7, step: 1, label: 'Дней в партии', restart: true },
    dayLen: { value: 30, min: 10, max: 90, step: 5, label: 'Длина дня, с', hint: 'утро → день → вечер → короткая ночь' },
    thirst: { value: 0.03, min: 0.005, max: 0.12, step: 0.005, label: 'Жажда: воды уходит за секунду', hint: '0,03 — полный горшок пустеет до 40 % примерно за 20 с' },
    tasks: { value: 1, min: 0, max: 3, step: 0.25, label: 'Дела: множитель частоты', hint: '0 — дел нет, 2 — вдвое чаще' },
    pour: { value: 0.32, min: 0.05, max: 1, step: 0.01, label: 'Полив: воды за секунду' },
    work: { value: 1.3, min: 0.3, max: 4, step: 0.1, label: 'Дело: сколько держать A, с', hint: 'у двери дела дольше' },
    wait: { value: 1, min: 0.4, max: 2.5, step: 0.1, label: 'Дело ждёт: множитель времени до сгорания' },
    grow: { value: 0.6, min: 0.2, max: 1.2, step: 0.05, label: 'Рост: доля партии с водой, чтобы вырасти в деревце', hint: 'росток растёт, только пока воды больше 40 %' },
    speed: { value: 4, min: 1.5, max: 8, step: 0.5, label: 'Скорость героя, м/с' },
    // вариации урока
    greed: { value: 0, min: 0, max: 1, step: 1, label: 'Вариация «Вина»: дела втрое дороже, но пока делаешь дело, росток сохнет вдвое быстрее', hint: 'как Papers, Please' },
    wilt: { value: 0, min: 0, max: 1, step: 1, label: 'Вариация «Тамагочи»: росток может засохнуть насовсем', hint: 'вода на нуле дольше 6 с — конец партии' },
    gray: { value: 0, min: 0, max: 1, step: 1, label: 'Вариация «Надежда»: мир серый, полив возвращает ему цвет', hint: 'как Gris', restart: true },
    far: { value: 0, min: 0, max: 1, step: 1, label: 'Вариация «Одиночество»: росток далеко, комната пустеет', hint: 'как Passage: длинная комната, герой медленнее, каждый день исчезают вещи', restart: true },
    noui: { value: 0, min: 0, max: 1, step: 1, label: 'Вариация «Без шкал»: никаких полосок и цифр воды', hint: 'как Florence: о жажде говорит только сам росток' },
    farewell: { value: 0, min: 0, max: 1, step: 1, label: 'Вариация «Прощание»: в последний день отнеси деревце во двор', hint: 'как Spiritfarer: держи A у окна — взял горшок, у двери — посадил' },
  },
  presets: {
    'Новичок': { thirst: 0.02 },
    'Без спрятанной механики': { secret: 0 },
    'Спешка': { tasks: 2 },
    'Вина': { greed: 1 },
    'Тамагочи': { wilt: 1 },
    'Надежда': { gray: 1 },
    'Одиночество': { far: 1 },
    'Без шкал': { noui: 1 },
    'Прощание': { farewell: 1 },
  },
  // имя вариации и её правило: баннер в начале, строка над полем и экран конца
  VARIANTS: [
    { key: 'tasks', on: c => c.tasks >= 2, name: 'Спешка', how: () => 'дел вдвое больше — успей и полить' },
    { key: 'greed', name: 'Вина', how: () => 'дела втрое дороже, но пока делаешь дело — росток сохнет вдвое быстрее' },
    { key: 'wilt', name: 'Тамагочи', how: () => 'росток может засохнуть насовсем: без воды 6 с — конец' },
    { key: 'gray', name: 'Надежда', how: () => 'мир серый, каждый полив возвращает ему немного цвета' },
    { key: 'far', name: 'Одиночество', how: () => 'росток далеко, ты медленный, и с каждым днём в комнате пустеет' },
    { key: 'noui', name: 'Без шкал', how: () => 'никаких шкал: о жажде скажет только сам росток' },
    { key: 'farewell', name: 'Прощание', how: () => 'в последний день отнеси деревце к двери и посади во дворе' },
  ],
  STAGES: ['семя', 'росток', 'листья', 'бутон', 'цветок', 'деревце'],
  STAGE_POP: ['', 'Росток!', 'Листья!', 'Бутон!', 'Цветок!', 'Деревце!'],
  PHASES: { meet: 'знакомство', bustle: 'суета', bloom: 'цветение', farewell: 'прощание', same: '' },
  KINDS: [
    { id: 'uroki', place: 'desk', name: 'Уроки', color: '#ffd23f', k: 1 },
    { id: 'druzya', place: 'door', name: 'Друзья зовут', color: '#7cf5a8', k: 0.8 },
    { id: 'musor', place: 'door', name: 'Вынести мусор', color: '#b6e36a', k: 1.2 },
    { id: 'magazin', place: 'door', name: 'В магазин', color: '#ffb35c', k: 1.4 },
    { id: 'ubrat', place: 'shelf', name: 'Убраться', color: '#c9a7ff', k: 1.1 },
    { id: 'zapravit', place: 'bed', name: 'Заправить кровать', color: '#8fd3ff', k: 1 },
  ],
  NOTES: [523, 587, 659, 784, 880, 1047, 1175, 1319, 1568], // пентатоника: каждое дело серии звучит выше
  // небо по времени суток: [доля дня, верх, горизонт, солнце, сила солнца, сила неба, направление солнца]
  SKY: [
    [0, '#7fb8ff', '#ffd6a8', '#ffe2b8', 1.6, 1.0, [0.75, 0.55, 0.35]],
    [0.3, '#3d9bff', '#cdeeff', '#fff6e6', 1.9, 1.1, [0.3, 0.92, 0.3]],
    [0.62, '#5a5fb8', '#ffa860', '#ffb070', 1.6, 0.9, [-0.7, 0.5, 0.4]],
    [0.8, '#2a2f6e', '#d0708a', '#ff9a8a', 0.95, 0.7, [-0.8, 0.35, 0.35]],
    [0.9, '#0b1030', '#28306a', '#9ab0ff', 0.5, 0.55, [-0.3, 0.85, 0.3]],
    [1, '#0b1030', '#3a3f80', '#b0c0ff', 0.6, 0.6, [0.6, 0.7, 0.3]],
  ],

  /* ---------- новая партия ---------- */
  start(lab, scene) {
    const c = lab.cfg, st = lab.state, far = c.far > 0;
    const L = this.layout(far);
    this.field = { w: L.W - 0.5, h: L.D - 0.5 };
    Object.assign(st, {
      L, day: 1, dayT: 0, f: 0, phase: this.phaseOf(lab, 1), tasks: [], streak: 0, bestStreak: 0, done: 0, missed: 0,
      plant: { water: 0.6, stage: 0, bond: 0, g: 0, vis: 0.2, dry: 0, droop: 0, blossom: 0 },
      careT: 0, dryT: 0, playT: 0, pourSec: 0, pourAcc: 0, pourT: 0, pouring: false, pourWas: 0, working: null, zeroT: 0,
      spawnT: 3, callT: 2, turnAt: -9, nearPlant: false, perkAt: -9, responses: 0, neg: 0, fade: 1, color: c.gray > 0 ? 0.06 : 1,
      satShown: -1, banner: false, ending: null, dead: false, carrying: false, planted: false, plantProg: 0, pickProg: 0,
      walkPh: 0, vx: 0, vz: 0, streamT: 0, noteT: 0, hissT: 0, workTickT: 0, bloomT: 0, statT: 0, knockT: 0, hintT: 0,
      greedSaid: false, fullSaid: false, gone: 0,
    });
    this.room(lab, scene, L);
    this.outside(lab, scene, L);
    this.buildPlant(lab, L);
    this.buildHero(lab, L);
    this.buildIcons(lab);
    this.collectTint(lab);
    // камера: в обычной комнате всё в кадре, в длинной — камера ведёт героя
    if (far) {
      lab.setCamera({ type: 'diorama', tilt: 0.92, turn: 0.42, target: [st.hero.position.x, 0.7, 0], distance: 15.5, fov: 0.7 });
      lab.follow(st.hero, { lag: 0.6 });
    } else lab.setCamera(this.camera);
    lab.hero(st.hero);
    this.skyAt(lab, 0, true);
    this.applySat(lab);
    this.plantVisual(lab, 0);
    lab.stat('забота', 0); lab.stat('отклик', 0);
    if (!lab.playing) this.poster(lab);
  },
  layout(far) {
    if (!far) return { W: 12, D: 9, H: 2.5, win: 3, door: 1.6, desk: -2.4, shelf: -2.6, bed: [3.4, 2.5], start: [0.2, 0.8], far };
    return { W: 20, D: 6.5, H: 2.5, win: 7.6, door: 0.9, desk: -5.6, shelf: -1.6, bed: [-1.6, 1.85], start: [-4.6, 0.4], far };
  },
  phaseOf(lab, day) {
    const c = lab.cfg, D = Math.round(c.days);
    if (c.farewell > 0 && day === D) return 'farewell';
    if (!(c.secret > 0)) return 'same';
    if (D >= 2 && day === D) return 'bloom';
    return day <= (D >= 4 ? 2 : 1) ? 'meet' : 'bustle';
  },
  variant(lab) {
    const c = lab.cfg, on = this.VARIANTS.filter(v => (v.on ? v.on(c) : c[v.key] > 0));
    if (!on.length) return { name: 'Классика', how: 'делай дела и не забывай про росток' };
    return { name: on.map(v => v.name).join(' + '), how: on.map(v => v.how(c)).join('; ') };
  },
  // афиша в меню: вечер, герой поливает цветущий росток, над столом и кроватью ждут дела. Первый кадр партии всё возвращает
  poster(lab) {
    const st = lab.state, L = st.L, h = st.hero;
    st.posterOn = true;
    st.plant.vis = 4.7;
    this.plantVisual(lab, 0);
    const w = this.spot(lab, 'window');
    h.position.set(w[0] - 0.35, 0, w[1] + 0.15);
    h.rotation.y = Math.atan2(st.pl.pos.x - h.position.x, st.pl.pos.z - h.position.z);
    st.can.visible = true; st.armR.rotation.x = -1.25; st.can.rotation.x = 0.7;
    st.pl.plantG.rotation.y = h.rotation.y + Math.PI;
    this.skyAt(lab, 0.64, true);
    for (const id of ['uroki', 'zapravit']) {
      const K = this.KINDS.find(k => k.id === id);
      const T = { kind: K, place: K.place, t: id === 'uroki' ? 7 : 3, life: 12, prog: id === 'uroki' ? 0.45 : 0, icon: st.icons[id], poster: true };
      st.tasks.push(T); this.showTask(lab, T, true);
    }
    this.iconsStep(lab, 0);
  },
  unposter(lab) {
    const st = lab.state, L = st.L;
    st.posterOn = false;
    for (const T of st.tasks) this.hideTask(lab, T, true);
    st.tasks = [];
    st.hero.position.set(L.start[0], 0, L.start[1]); st.hero.rotation.y = 0;
    st.can.visible = false; st.armR.rotation.x = 0; st.can.rotation.x = 0;
    st.plant.vis = 0.2; st.pl.plantG.rotation.y = 0;
    this.plantVisual(lab, 0);
    this.skyAt(lab, 0, true);
  },

  /* ---------- кадр ---------- */
  update(lab, dt) {
    const st = lab.state, c = lab.cfg;
    if (st.posterOn) this.unposter(lab);
    if (!st.banner) { // имя вариации и её правило — крупно в начале партии
      st.banner = true;
      const v = this.variant(lab), at = [st.L.start[0], 2.8, st.L.start[1] - 1];
      lab.popup(at, v.name, '#ffe680', 32);
      lab.after(0.4, () => lab.popup([at[0], 2.2, at[2]], v.how, '#ffffff', 17));
      lab.after(1.2, () => this.dayBanner(lab));
    }
    const v = this.variant(lab);
    lab.hud('rule', `${v.name}: ${v.how}`, { color: '#ffe680', size: 14 });
    if (st.ending) { this.endingStep(lab, dt); this.ambient(lab, dt); this.plantStep(lab, dt, true); this.heroAnim(lab, dt, 0, null); this.iconsStep(lab, dt); return; }
    this.clock(lab, dt);
    if (st.ending) return;
    const target = this.heroStep(lab, dt);
    this.act(lab, dt, target);
    this.plantStep(lab, dt, false);
    this.tasksStep(lab, dt);
    this.iconsStep(lab, dt);
    this.satStep(lab, dt);
    this.ambient(lab, dt);
    this.hudStep(lab, dt);
  },

  /* ---------- день и ночь ---------- */
  clock(lab, dt) {
    const st = lab.state, c = lab.cfg, Ld = c.dayLen;
    st.playT += dt;
    if (st.phase === 'farewell' && !st.planted) st.dayT = Math.min(st.dayT + dt, Ld * 0.78); // прощание ждёт тебя: вечер не кончается
    else st.dayT += dt;
    if (st.dayT >= Ld) {
      st.dayT -= Ld; st.day++;
      if (st.day > Math.round(c.days)) { st.day = Math.round(c.days); st.dayT = Ld * 0.999; return this.startEnding(lab, 'end'); }
      st.prevPhase = st.phase; st.phase = this.phaseOf(lab, st.day);
      this.newDay(lab);
    }
    const was = st.f;
    st.f = st.dayT / Ld;
    if (was < 0.85 && st.f >= 0.85) { // ночь: лампа, тихая нота
      lab.tone(196, 0.6, 'sine', 0.05); lab.tone(247, 0.7, 'sine', 0.04, 0, 0.15);
      lab.popup([st.L.start[0], 2.6, st.L.start[1] - 1], 'Ночь', '#a9b8ff', 22);
    }
    this.skyAt(lab, st.f);
  },
  newDay(lab) {
    const st = lab.state, c = lab.cfg;
    [523, 659, 784].forEach((f, k) => lab.tone(f, 0.22, 'triangle', 0.06, 0, k * 0.09));
    this.dayBanner(lab);
    st.spawnT = Math.min(st.spawnT, 2);
    if (st.phase === 'bloom' || st.phase === 'farewell') { // последний день: дела гаснут, остаёшься ты и росток
      for (const T of st.tasks) this.hideTask(lab, T, false);
      st.tasks = [];
    }
    if (c.far > 0 && st.day >= 2) this.emptyRoom(lab);
  },
  dayBanner(lab) {
    const st = lab.state, ph = this.PHASES[st.phase], at = [st.pl.pos.x - (st.L.far ? 1.5 : 2.5), 2.9, st.L.start[1] - 1];
    if (st.L.far) at[0] = st.hero.position.x;
    lab.popup(at, `День ${st.day}` + (ph ? ` · ${ph}` : ''), '#ffffff', 28);
    if (st.phase === 'bloom') lab.after(0.5, () => lab.popup([at[0], 2.3, at[2]], 'Дел нет. Только ты и росток', '#ffd8f0', 18));
    if (st.phase === 'bustle' && st.prevPhase === 'meet') lab.after(0.5, () => lab.popup([at[0], 2.3, at[2]], 'Дел всё больше', '#ffd23f', 18));
    if (st.phase === 'farewell') lab.after(0.5, () => lab.popup([at[0], 2.3, at[2]], 'Пора отпустить росток во двор', '#ffd8f0', 18));
  },
  // небо, солнце, лампа — по доле дня; насыщенность мира — отдельно (applySat)
  skyAt(lab, f, force) {
    const st = lab.state, T3 = lab.THREE, S = this.SKY;
    if (!force && Math.abs(f - (st.skyF == null ? -9 : st.skyF)) < 0.004 && Math.abs((st.skySat || 0) - st.satShown) < 0.01) return;
    st.skyF = f; st.skySat = st.satShown;
    let i = 0; while (i < S.length - 2 && f > S[i + 1][0]) i++;
    const A = S[i], B = S[i + 1], k = lab.clamp((f - A[0]) / (B[0] - A[0]), 0, 1);
    const mix = (p, q) => new T3.Color(p).lerp(new T3.Color(q), k);
    const sat = Math.max(0, st.satShown < 0 ? 1 : st.satShown), gray = col => { const l = col.r * 0.3 + col.g * 0.59 + col.b * 0.11; return col.lerp(new T3.Color(l * 0.97, l * 0.99, l * 1.04), 1 - sat); };
    let top = gray(mix(A[1], B[1])), hor = gray(mix(A[2], B[2]));
    if (st.ending && st.ending.warm != null) { // финал: тёплый свет или серые сумерки
      const e = lab.clamp(st.ending.t / 2, 0, 1);
      top.lerp(new T3.Color(st.ending.warm ? '#ff9a6b' : '#59606e'), e * 0.7); hor.lerp(new T3.Color(st.ending.warm ? '#ffd27a' : '#8c8f99'), e * 0.8);
    }
    const g = st.skyCtx, gr = g.createLinearGradient(0, 0, 0, 256);
    gr.addColorStop(0, '#' + top.getHexString()); gr.addColorStop(0.65, '#' + hor.getHexString()); gr.addColorStop(1, '#' + hor.getHexString());
    g.fillStyle = gr; g.fillRect(0, 0, 2, 256); st.skyTex.needsUpdate = true;
    if (lab.scene.fog) lab.scene.fog.color.copy(hor);
    const Lt = lab.light, sc = gray(mix(A[3], B[3]));
    Lt.sun.color.copy(sc); Lt.sun.intensity = lab.lerp(A[4], B[4], k);
    Lt.hemi.intensity = lab.lerp(A[5], B[5], k); Lt.hemi.color.copy(top).lerp(new T3.Color('#ffffff'), 0.55);
    Lt.sun.userData.dir.set(lab.lerp(A[6][0], B[6][0], k), lab.lerp(A[6][1], B[6][1], k), lab.lerp(A[6][2], B[6][2], k)).normalize();
    const night = lab.clamp((f - 0.72) / 0.12, 0, 1) * (f < 0.99 ? 1 : 0);
    st.night = night;
    if (st.lampLight) st.lampLight.intensity = night * 7;
    if (st.bulbMat) st.bulbMat.emissiveIntensity = 0.2 + night * 2.2;
    if (st.stars) { st.stars.material.opacity = night; st.stars.visible = night > 0.02; }
    if (st.glassMat) st.glassMat.color.copy(hor).lerp(new T3.Color('#ffffff'), 0.25);
    if (st.patch) { // пятно из окна: утром справа и длинное, в полдень короткое, вечером слева и оранжевое, ночью — лунное
      const L = st.L, len = 1.3 + Math.abs(0.42 - Math.min(f, 0.85)) * 2.6, P = st.patch;
      P.position.set(L.win + (0.42 - Math.min(f, 0.85)) * 2.6, 0.05, -L.D / 2 + 0.35 + len / 2);
      P.scale.set(1.9, 1, len); P.rotation.y = (Math.min(f, 0.85) - 0.42) * 0.9;
      const pcol = gray(f < 0.3 ? new T3.Color('#ffe2a0') : f < 0.62 ? new T3.Color('#fff2d0') : f < 0.85 ? new T3.Color('#ff9a50') : new T3.Color('#7f9cff'));
      st.patchMat.color.copy(pcol); st.patchMat.opacity = f < 0.85 ? 0.55 * (1 - night * 0.6) : 0.22;
    }
  },

  /* ---------- герой ---------- */
  heroStep(lab, dt) {
    const st = lab.state, c = lab.cfg, h = st.hero, p = lab.p1, L = st.L, t = lab.view.turn;
    let ix = p.x || (p.right ? 1 : 0) - (p.left ? 1 : 0), iy = p.y || (p.up ? 1 : 0) - (p.down ? 1 : 0);
    const m = Math.hypot(ix, iy); if (m > 1) { ix /= m; iy /= m; }
    // «вверх по экрану» в диораме — по диагонали: ввод поворачиваем вслед за камерой
    const wx = ix * Math.cos(t) - iy * Math.sin(t), wz = -ix * Math.sin(t) - iy * Math.cos(t);
    const target = this.targetNear(lab);
    let sp = c.speed * (c.far > 0 ? 0.62 : 1) * (st.carrying ? 0.75 : 1);
    if (p.a && target) sp *= 0.35; // делаешь дело — шагаешь медленно
    st.vx = lab.damp(st.vx, wx * sp, 16, dt); st.vz = lab.damp(st.vz, wz * sp, 16, dt);
    h.position.x += st.vx * dt; h.position.z += st.vz * dt;
    this.collide(lab, h.position);
    const v = Math.hypot(st.vx, st.vz);
    let face = null;
    if (p.a && target) face = target.look;
    else if (v > 0.3) face = [h.position.x + st.vx, h.position.z + st.vz];
    if (face) {
      const want = Math.atan2(face[0] - h.position.x, face[1] - h.position.z);
      let d = want - h.rotation.y; d = Math.atan2(Math.sin(d), Math.cos(d));
      h.rotation.y += d * Math.min(1, dt * 14);
    }
    this.heroAnim(lab, dt, v, p.a ? target : null);
    return target;
  },
  collide(lab, P) {
    const st = lab.state, L = st.L, r = 0.32;
    P.x = lab.clamp(P.x, -L.W / 2 + r + 0.05, L.W / 2 - r);
    P.z = lab.clamp(P.z, -L.D / 2 + r + 0.05, L.D / 2 - r);
    for (const b of st.blocks) { // вытолкнуть из мебели: круг против прямоугольника
      const cx = lab.clamp(P.x, b[0], b[1]), cz = lab.clamp(P.z, b[2], b[3]), dx = P.x - cx, dz = P.z - cz, d = Math.hypot(dx, dz);
      if (d < r) {
        if (d > 1e-4) { P.x = cx + dx / d * r; P.z = cz + dz / d * r; }
        else { const mx = Math.min(P.x - b[0], b[1] - P.x), mz = Math.min(P.z - b[2], b[3] - P.z); if (mx < mz) P.x = P.x - b[0] < b[1] - P.x ? b[0] - r : b[1] + r; else P.z = P.z - b[2] < b[3] - P.z ? b[2] - r : b[3] + r; }
      }
    }
  },
  heroAnim(lab, dt, v, target) {
    const st = lab.state, H = st.H;
    const walk = lab.clamp(v / 3, 0, 1);
    st.walkPh += dt * (4 + v * 2.6);
    const s = Math.sin(st.walkPh) * walk;
    H.legL.rotation.x = s * 0.7; H.legR.rotation.x = -s * 0.7;
    H.body.position.y = Math.abs(Math.cos(st.walkPh)) * 0.05 * walk + Math.sin(lab.t * 2.2) * 0.012;
    H.body.scale.y = 1 + Math.sin(lab.t * 2.2) * 0.02; // дышит
    const pour = target && (target.kind === 'window' || target.kind === 'plant');
    st.can.visible = !!pour && !st.carrying;
    if (st.carrying) { H.armL.rotation.x = H.armR.rotation.x = -1.1; }
    else if (pour) { H.armR.rotation.x = -1.25; H.armL.rotation.x = -s * 0.5; st.can.rotation.x = 0.55 + Math.sin(lab.t * 9) * 0.05; }
    else if (target) { const w = Math.sin(lab.t * 13) * 0.35; H.armL.rotation.x = -0.9 + w; H.armR.rotation.x = -0.9 - w; } // работает руками
    else { H.armL.rotation.x = -s * 0.6; H.armR.rotation.x = s * 0.6; }
    H.head.rotation.z = target ? Math.sin(lab.t * 6) * 0.06 : 0;
  },
  // что рядом с героем: окно (полив), росток (цветение, прощание), дело — ближайшее в радиусе
  targetNear(lab) {
    const st = lab.state, h = st.hero.position, c = lab.cfg;
    let best = null, bd = 1e9;
    const pp = [st.pl.pos.x, st.pl.pos.z];
    const consider = (kind, at, r, task, look) => { const d = Math.hypot(h.x - at[0], h.z - at[1]); if (d < r && d < bd) { bd = d; best = { kind, at, task, look: look || at }; } };
    if (st.phase === 'farewell') {
      if (!st.carrying && !st.planted) consider('pick', pp, 1.9);
      if (st.carrying) consider('door', this.spot(lab, 'door'), 1.6, null, [-st.L.W / 2, st.L.door]);
      return best;
    }
    if (st.phase === 'bloom') consider('plant', pp, 2.5);
    else consider('window', this.spot(lab, 'window'), 1.7, null, pp);
    for (const T of st.tasks) if (!T.gone) { const ip = this.iconPos(lab, T.place); consider('task', this.spot(lab, T.place), 1.7, T, [ip[0], ip[2]]); }
    return best;
  },
  spot(lab, place) {
    const L = lab.state.L;
    if (place === 'window') return [L.win, -L.D / 2 + 1.0];
    if (place === 'desk') return [L.desk, -L.D / 2 + 1.25];
    if (place === 'door') return [-L.W / 2 + 1.0, L.door];
    if (place === 'shelf') return [-L.W / 2 + 1.0, L.shelf];
    return [L.bed[0] - 1.55, L.bed[1]]; // кровать
  },

  /* ---------- действие: держи A ---------- */
  act(lab, dt, target) {
    const st = lab.state, c = lab.cfg, p = lab.p1;
    const pouring = p.a && target && (target.kind === 'window' || target.kind === 'plant');
    if (pouring) this.pour(lab, dt, target.kind === 'plant');
    else if (st.pouring) this.endPour(lab);
    st.working = p.a && target && target.kind === 'task' ? target.task : null;
    if (st.working) this.workOn(lab, st.working, dt);
    if (p.a && target && target.kind === 'pick') {
      st.pickProg += dt / 0.8;
      if (st.pickProg >= 1) this.pickUp(lab);
    } else st.pickProg = Math.max(0, st.pickProg - dt);
    if (p.a && target && target.kind === 'door') {
      st.plantProg += dt / 1.2;
      if (st.plantProg >= 1) this.plantOut(lab);
    } else st.plantProg = Math.max(0, st.plantProg - dt * 0.5);
  },
  // полив: тот же вызов у окна (держи A) и у автотеста GAME.water(lab, сек)
  pour(lab, dt, bloom) {
    const st = lab.state, c = lab.cfg, P = st.plant, pl = st.pl;
    if (!st.pouring) { // начало полива
      st.pouring = true; st.pourT = 0; st.pourWas = P.water; st.fullSaid = false;
      lab.pulse(pl.plantG, 1.1, 0.2); lab.tone(392, 0.25, 'sine', 0.05);
    }
    st.pourT += dt; st.pourSec += dt; st.pourAcc += dt;
    while (st.pourAcc >= 1) { st.pourAcc -= 1; lab.count('полив'); }
    P.water = Math.min(1, P.water + c.pour * dt * (bloom ? 0.6 : 1));
    if (c.secret > 0) P.bond = Math.min(1, P.bond + dt * (bloom ? 0.06 : 0.035));
    if (c.gray > 0) st.color = Math.min(1, st.color + dt * 0.065);
    if (P.water >= 1 && !st.fullSaid && !bloom) { st.fullSaid = true; lab.popup(this.plantTop(lab, 0.5), 'Хватит!', '#7fd6ff', 16); }
    // струя из лейки: голубые капли летят в горшок
    st.streamT -= dt;
    if (st.streamT <= 0 && P.water < 1) {
      st.streamT = 0.07;
      const sp = st.spout.getWorldPosition(new lab.THREE.Vector3()), to = pl.pos;
      lab.burst(sp, { count: 3, colors: ['#4fc3ff', '#bfeaff', '#7fd6ff'], speed: 1.4, size: 0.07, life: 0.45, gravity: 6, dir: [to.x - sp.x, to.y + 0.25 - sp.y, to.z - sp.z] });
    }
    st.hissT -= dt; if (st.hissT <= 0 && P.water < 1) { st.hissT = 0.16; lab.noise(0.16, 0.025, 2600); }
    st.noteT -= dt;
    if (st.noteT <= 0) { st.noteT = 0.45; const n = [392, 440, 523, 587, 659][Math.floor(lab.t * 2.2) % 5]; lab.tone(n, 0.4, 'sine', 0.035); }
    if (bloom) this.bloomStep(lab, dt);
  },
  endPour(lab) {
    const st = lab.state, c = lab.cfg, P = st.plant;
    st.pouring = false;
    // росток расправился после полива — отклик
    if (st.pourT >= 0.5 && P.water - st.pourWas > 0.1) {
      lab.pulse(st.pl.plantG, 1.16, 0.3);
      if (c.gray > 0) { lab.ring(st.pl.pos, { color: '#7cf5a8', radius: 3, life: 0.6 }); lab.popup(this.plantTop(lab, 0.6), 'Цвет возвращается', '#9cf57a', 15); }
      if (c.secret > 0 && lab.t - st.perkAt > 1.5) { st.perkAt = lab.t; this.respond(lab, 'perk'); }
    }
  },
  // цветение (последний день со спрятанной механикой): держи A рядом — росток расцветает, лепестки — очки
  bloomStep(lab, dt) {
    const st = lab.state, P = st.plant;
    P.blossom = Math.min(1, P.blossom + dt * 0.06);
    P.g += dt * 0.12;
    st.bloomT -= dt;
    if (st.bloomT <= 0) {
      st.bloomT = 0.5;
      const at = this.plantTop(lab, 0.15);
      lab.burst(at, { count: 6, colors: ['#ff7ad9', '#ffd8f0', '#fff3a0'], speed: 1.6, up: 1.2, gravity: 1.5, size: 0.1, life: 1 });
      lab.addScore(5, this.plantTop(lab, 0.5), '#ff9ade');
      lab.count('лепестки');
      const n = this.NOTES[Math.floor(lab.t * 2) % 5];
      lab.tone(n, 0.5, 'triangle', 0.04); lab.tone(n * 1.5, 0.6, 'sine', 0.025, 0, 0.08);
    }
  },
  pickUp(lab) {
    const st = lab.state;
    st.carrying = true; st.pickProg = 0;
    st.gauge.visible = false;
    lab.pulse(st.pl.potG, 1.2, 0.25); lab.sfx.power();
    lab.popup(this.plantTop(lab, 0.6), 'Взял горшок. Теперь — к двери', '#ffd8f0', 18);
    lab.count('прощание');
  },
  plantOut(lab) {
    const st = lab.state, L = st.L, pot = st.pl.potG;
    st.planted = true; st.carrying = false; st.plantProg = 0;
    const from = pot.position.clone(), to = st.yard;
    lab.tween(1.6, k => { pot.position.set(lab.lerp(from.x, to.x, k), lab.lerp(from.y, to.y, k) + Math.sin(k * Math.PI) * 1.2, lab.lerp(from.z, to.z, k)); }, 'inOutQuad');
    lab.after(1.6, () => {
      lab.burst([to.x, 0.3, to.z], { count: 24, colors: ['#7a5232', '#6ee06a', '#ffd8f0'], speed: 3, up: 2 });
      lab.ring([to.x, 0.05, to.z], { color: '#7cf5a8', radius: 3 });
      lab.tween(2.2, k => pot.scale.setScalar(1 + k * 1.6), 'outBack');
      st.plant.stage = 5; st.plant.blossom = 1;
    });
    lab.popup([to.x, 2.4, to.z], 'Расти во дворе', '#ffd8f0', 24);
    this.startEnding(lab, 'farewell');
  },

  /* ---------- дела ---------- */
  tasksStep(lab, dt) {
    const st = lab.state, c = lab.cfg;
    // новые дела: не ночью и не в последний тихий день
    const quiet = st.phase === 'bloom' || st.phase === 'farewell' || st.f >= 0.85 || c.tasks <= 0;
    if (!quiet) {
      st.spawnT -= dt;
      if (st.spawnT <= 0) {
        const base = st.phase === 'meet' ? 8.5 : st.phase === 'bustle' ? 4.6 : 6.2;
        st.spawnT = base / Math.max(0.1, c.tasks) * lab.rand(0.8, 1.2);
        this.spawnTask(lab);
      }
    }
    for (const T of st.tasks) {
      if (T.gone) continue;
      T.t -= dt;
      if (st.phase === 'bustle' && T.t < 4 && Math.floor(T.t * 2) !== Math.floor((T.t + dt) * 2)) lab.tone(1046, 0.05, 'square', 0.03); // громкая суета: тиканье
      if (T.place === 'door' && T.kind.id === 'druzya') { // друзья стучат в дверь
        st.knockT -= dt;
        if (st.knockT <= 0) { st.knockT = 2.2; lab.noise(0.06, 0.08, 500); lab.noise(0.06, 0.08, 500, 0.16); lab.tween(0.3, k => { st.doorLeaf.rotation.y = Math.sin(k * Math.PI * 4) * 0.05 * (1 - k); }); }
      }
      if (T.t <= 0) this.burnTask(lab, T);
    }
    st.tasks = st.tasks.filter(T => !T.gone);
  },
  spawnTask(lab) {
    const st = lab.state, c = lab.cfg, h = st.hero.position;
    const busy = new Set(st.tasks.map(T => T.place));
    const free = ['desk', 'door', 'shelf', 'bed'].filter(p => !busy.has(p));
    if (!free.length) return;
    // дело чаще появляется там, где тебя нет
    const w = free.map(p => { const s = this.spot(lab, p); return 0.5 + Math.hypot(h.x - s[0], h.z - s[1]); });
    let r = lab.rand(0, w.reduce((a, b) => a + b, 0)), i = 0;
    while (i < free.length - 1 && r > w[i]) { r -= w[i]; i++; }
    const place = free[i], kinds = this.KINDS.filter(k => k.place === place), kind = lab.pick(kinds);
    const life = (st.phase === 'meet' ? 15 : st.phase === 'bustle' ? 11 : 13) * c.wait;
    const T = { kind, place, t: life, life, prog: 0, icon: st.icons[kind.id] };
    st.tasks.push(T);
    this.showTask(lab, T, false);
    const loud = st.phase === 'bustle', at = this.iconPos(lab, place);
    lab.popup([at[0], at[1] + 0.7, at[2]], kind.name, kind.color, loud ? 22 : 16);
    if (loud) { lab.sfx.beep(); lab.tone(880, 0.08, 'square', 0.05); lab.tone(1175, 0.1, 'square', 0.05, 0, 0.1); lab.ring([at[0], 0.05, at[2]], { color: '#ffd23f', radius: 1.6 }); }
    else lab.tone(1319, 0.12, 'sine', 0.05);
    lab.count('дел появилось');
  },
  workOn(lab, T, dt) {
    const st = lab.state, c = lab.cfg;
    T.prog += dt / (c.work * T.kind.k);
    st.workTickT -= dt;
    if (st.workTickT <= 0) { st.workTickT = 0.14; lab.tone(500 + T.prog * 500, 0.04, 'triangle', 0.035); }
    if (c.greed > 0 && !st.greedSaid) { st.greedSaid = true; lab.popup(this.plantTop(lab, 0.6), 'Пока ты занят — росток сохнет вдвое быстрее', '#ffb35c', 15); }
    if (T.prog >= 1) this.completeTask(lab, T);
  },
  completeTask(lab, T) {
    const st = lab.state, c = lab.cfg;
    if (T.gone) return false;
    st.streak++; st.bestStreak = Math.max(st.bestStreak, st.streak); st.done++;
    const mult = Math.min(5, 1 + Math.floor((st.streak - 1) / 3)), pts = 10 * mult * (c.greed > 0 ? 3 : 1);
    const at = this.iconPos(lab, T.place);
    lab.addScore(pts, at, '#ffd23f');
    lab.count('дела');
    lab.burst(at, { count: 14 + Math.min(10, st.streak), colors: ['#ffd23f', '#ffffff', T.kind.color], speed: 4, up: 1.5 });
    lab.ring([at[0], 0.05, at[2]], { color: '#ffd23f', radius: 1.4 });
    const n = this.NOTES[Math.min(st.streak - 1, this.NOTES.length - 1)];
    lab.tone(n, 0.18, 'triangle', 0.1); lab.tone(n * 2, 0.24, 'sine', 0.04, 0, 0.05);
    lab.hitstop(0.04); lab.shake(0.12); lab.vibrate(40, 0.3);
    lab.pulse(st.hero, 1.12, 0.18);
    if (mult > 1 && (st.streak - 1) % 3 === 0) lab.popup([at[0], at[1] + 0.9, at[2]], `Серия ×${mult}`, '#ffd23f', 22);
    if (st.working === T) st.working = null;
    this.hideTask(lab, T, false);
    return true;
  },
  burnTask(lab, T) {
    const st = lab.state, at = this.iconPos(lab, T.place);
    st.missed++;
    lab.count('пропущено');
    lab.burst(at, { count: 12, colors: ['#5d5d66', '#8a8a95', '#ff8a5c'], speed: 2, up: 1, gravity: -1, life: 1 });
    lab.tone(220, 0.35, 'sawtooth', 0.06, 110); lab.noise(0.25, 0.06, 700);
    if (st.streak >= 2) lab.popup([at[0], at[1] + 0.8, at[2]], 'Серия сгорела', '#ff8a5c', 18);
    else lab.popup([at[0], at[1] + 0.8, at[2]], 'Не успел', '#c9c9d4', 15);
    st.streak = 0;
    this.hideTask(lab, T, false, true);
  },
  showTask(lab, T, still) {
    const I = T.icon, st = lab.state, at = this.iconPos(lab, T.place);
    I.g.visible = true; I.g.position.set(at[0], at[1], at[2]);
    I.burnK = 0;
    if (still) I.g.scale.setScalar(1);
    else lab.tween(0.3, k => I.g.scale.setScalar(Math.max(0.01, k)), 'outBack');
    this.mess(lab, T, true);
  },
  hideTask(lab, T, silent, burned) {
    const I = T.icon;
    T.gone = true;
    this.mess(lab, T, false);
    if (silent) { I.g.visible = false; return; }
    lab.tween(burned ? 0.6 : 0.25, k => {
      I.g.scale.setScalar(Math.max(0.01, 1 - k)); if (burned) I.g.position.y -= 0.02;
      if (k >= 1) I.g.visible = false;
    }, burned ? 'inQuad' : 'inCubic');
  },
  iconPos(lab, place) {
    const s = this.spot(lab, place), L = lab.state.L;
    if (place === 'desk') return [L.desk, 2.2, -L.D / 2 + 0.5];
    if (place === 'door') return [-L.W / 2 + 0.55, 2.55, L.door];
    if (place === 'shelf') return [-L.W / 2 + 0.6, 2.45, L.shelf];
    return [L.bed[0], 1.7, L.bed[1]];
  },
  // беспорядок на месте дела: смятое одеяло, раскиданные тетради, книги вкривь, пакет у двери
  mess(lab, T, on) {
    const st = lab.state, M = st.messy;
    if (T.place === 'bed') { const b = M.blanket, p0 = b.userData.p0 || (b.userData.p0 = b.position.clone()); b.rotation.y = on ? 0.35 : 0; b.position.x = p0.x + (on ? 0.25 : 0); b.position.z = p0.z + (on ? 0.12 : 0); b.scale.y = on ? 2.2 : 1; M.pillow.rotation.z = on ? 0.5 : 0; }
    if (T.place === 'desk') { M.neat.visible = !on; M.notes.visible = on; }
    if (T.place === 'shelf') this.books(lab, on);
    if (T.place === 'door') { M.bag.visible = on && T.kind.id === 'musor'; M.list.visible = on && T.kind.id === 'magazin'; M.ball.visible = on && T.kind.id === 'druzya'; }
  },
  // иконки дел: крутятся, кольцо-таймер тает (золото → красный), кольцо прогресса растёт
  iconsStep(lab, dt) {
    const st = lab.state, T3 = lab.THREE, q = lab.camera.quaternion;
    for (const T of st.tasks) {
      if (T.gone) continue;
      const I = T.icon, left = lab.clamp(T.t / T.life, 0, 1), loud = st.phase === 'bustle';
      I.obj.rotation.y += dt * 1.5;
      I.obj.position.y = Math.sin(lab.t * 3 + I.ph) * 0.08;
      const k = Math.max(1, Math.ceil(left * 24));
      I.ring.geometry = st.ringGeos[k]; I.ring.quaternion.copy(q);
      I.ringMat.color.set(left > 0.35 ? '#ffd23f' : left > 0.15 ? '#ff9a3d' : '#ff4d5e').multiplyScalar(1.5);
      const pk = Math.round(lab.clamp(T.prog, 0, 1) * 24);
      I.prog.visible = pk > 0; if (pk > 0) { I.prog.geometry = st.progGeos[pk]; I.prog.quaternion.copy(q); }
      const beat = loud ? 1 + Math.max(0, Math.sin(lab.t * 8)) * 0.12 : 1; // в суете дела громче: пульсируют
      if (!st.ending) I.g.scale.setScalar(Math.max(I.g.scale.x > 0.99 ? beat * (loud ? 1.2 : 1) : I.g.scale.x, 0.01));
    }
  },

  /* ---------- росток ---------- */
  drainK(lab) {
    const st = lab.state, c = lab.cfg, P = st.plant;
    let k = 1;
    if (st.phase === 'meet') k = 1.3; // знакомство: росток пьёт часто
    else if (st.phase === 'bustle') k = Math.max(0.5, 1.25 - 0.7 * P.bond); // суета: чем крепче связь, тем дольше росток ждёт
    else if (st.phase === 'bloom') k = 0.35;
    else if (st.phase === 'farewell') k = st.carrying ? 0 : 0.6;
    if (st.f >= 0.85) k *= 0.6; // ночью росток спит
    if (c.greed > 0 && st.working) k *= 2;
    return k;
  },
  plantStep(lab, dt, ending) {
    const st = lab.state, c = lab.cfg, P = st.plant, pl = st.pl, secret = c.secret > 0;
    if (!ending && !st.dead) {
      if (!st.pouring) P.water = Math.max(0, P.water - c.thirst * this.drainK(lab) * dt);
      if (P.water > 0.4) { st.careT += dt; P.g += dt / Math.max(1, Math.round(c.days) * c.dayLen * c.grow / 5); }
      if (P.water <= 0.001) { st.dryT += dt; st.zeroT += dt; } else st.zeroT = 0;
      if (P.g >= 1) {
        if (P.stage < 5) { P.stage++; P.g = 0; this.grew(lab); } else P.g = 1;
      }
      if (secret) { // связь: растёт от заботы, слабеет, когда о ростке забыли
        const near = Math.hypot(st.hero.position.x - pl.pos.x, st.hero.position.z - pl.pos.z) < 2.5;
        if (near) P.bond = Math.min(1, P.bond + dt * 0.008);
        if (P.water < 0.12) P.bond = Math.max(0, P.bond - dt * 0.01);
        this.respondStep(lab, dt, near);
      }
      if (c.wilt > 0 && st.zeroT > 6) return this.die(lab);
      st.statT -= dt;
      if (st.statT <= 0) { st.statT = 0.5; lab.stat('забота', Math.round(100 * st.careT / Math.max(1, st.playT))); lab.stat('стадия', P.stage); }
    }
    // как выглядит: стадия плавно, поникший и жёлтый от жажды, поворот к герою
    P.vis = lab.damp(P.vis, P.stage + Math.min(0.95, P.g) * 0.6 + 0.2, 3, dt);
    P.dry = lab.clamp((0.4 - P.water) / 0.4, 0, 1);
    P.droop = lab.damp(P.droop, st.dead ? 1.4 : P.dry, 3, dt);
    this.plantVisual(lab, dt);
    if (!st.carrying && !st.planted) {
      const want = secret && st.nearPlant && !st.dead ? Math.atan2(st.hero.position.x - pl.pos.x, st.hero.position.z - pl.pos.z) : 0;
      let d = want - pl.plantG.rotation.y; d = Math.atan2(Math.sin(d), Math.cos(d));
      pl.plantG.rotation.y += d * Math.min(1, dt * 4);
    }
    // шкала воды у горшка (в «Без шкал» её нет)
    const show = !(c.noui > 0) && !st.carrying && !st.planted;
    st.gauge.visible = show;
    if (show) { st.gaugeFill.scale.y = Math.max(0.01, P.water); st.gaugeMat.color.set(P.water < 0.25 ? '#ff6b5e' : P.water < 0.4 ? '#ffb35c' : '#4fc3ff'); }
    if (st.carrying) { // горшок в руках у героя
      const h = st.hero, f = h.rotation.y;
      pl.potG.position.set(h.position.x + Math.sin(f) * 0.42, 0.95, h.position.z + Math.cos(f) * 0.42);
    }
  },
  respondStep(lab, dt, near) {
    const st = lab.state, P = st.plant;
    // поворот к герою, когда он подошёл (не чаще раза в 3 с)
    if (near && !st.nearPlant && lab.t - st.turnAt >= 3 && !st.carrying) { st.turnAt = lab.t; this.respond(lab, 'turn'); }
    st.nearPlant = near;
    // «хочу пить»: машет листом и звенит
    if (P.water < 0.4 && !st.pouring && !st.carrying && st.phase !== 'farewell') {
      st.callT -= dt;
      if (st.callT <= 0) { st.callT = P.water < 0.15 ? 3 : 4.5; this.respond(lab, 'call'); }
    } else st.callT = Math.min(st.callT, 1.2);
  },
  respond(lab, kind) {
    const st = lab.state, pl = st.pl, P = st.plant;
    st.responses++;
    lab.count('_secret'); lab.count('отклик'); lab.stat('отклик', st.responses);
    if (kind === 'turn') {
      lab.pulse(pl.plantG, 1.08, 0.25);
      lab.tone(1047, 0.12, 'sine', 0.035); lab.tone(1319, 0.16, 'sine', 0.03, 0, 0.09);
      lab.burst(this.plantTop(lab, 0.1), { count: 5, colors: ['#9cf57a', '#ffffff'], speed: 1, up: 0.8, size: 0.06, gravity: 1 });
      P.bond = Math.min(1, P.bond + 0.02);
    } else if (kind === 'call') {
      const leaf = pl.leaves.find(l => l.g.scale.x > 0.2) || null;
      if (leaf) { const r0 = leaf.base; lab.tween(0.9, k => { leaf.wave = Math.sin(k * Math.PI * 6) * 0.7 * (1 - k); }); }
      else lab.pulse(pl.plantG, 1.2, 0.3);
      lab.tone(1568, 0.14, 'sine', 0.045); lab.tone(2093, 0.2, 'sine', 0.035, 0, 0.12);
      lab.popup(this.plantTop(lab, 0.4), P.water < 0.15 ? 'пить!' : 'пить…', '#7fd6ff', P.water < 0.15 ? 18 : 15);
    } else { // perk: расправился и чуть зацвёл
      lab.burst(this.plantTop(lab, 0.1), { count: 12, colors: ['#9cf57a', '#ff7ad9', '#ffffff'], speed: 2, up: 1.4, size: 0.08, gravity: 2 });
      [659, 784, 988].forEach((f, k) => lab.tone(f, 0.3, 'sine', 0.04, 0, k * 0.06));
      P.bond = Math.min(1, P.bond + 0.04);
    }
  },
  grew(lab) {
    const st = lab.state, P = st.plant, at = this.plantTop(lab, 0.3);
    lab.popup([at.x, at.y + 0.4, at.z], this.STAGE_POP[P.stage], '#9cf57a', 24);
    lab.burst(at, { count: 20, colors: ['#6ee06a', '#ffffff', '#ff7ad9', '#fff3a0'], speed: 3, up: 2 });
    lab.ring([st.pl.pos.x, st.pl.pos.y + 0.02, st.pl.pos.z], { color: '#9cf57a', radius: 1.2 });
    [523, 659, 784, 1047].forEach((f, k) => lab.tone(f, 0.3, 'triangle', 0.06, 0, k * 0.07));
    lab.pulse(st.pl.plantG, 1.25, 0.35);
    lab.count('рост');
  },
  die(lab) { // «Тамагочи»: росток засох насовсем
    const st = lab.state;
    if (st.dead) return;
    st.dead = true;
    lab.slowmo(0.8, 0.4); lab.shake(0.3);
    lab.tone(330, 0.6, 'triangle', 0.08, 220); lab.tone(262, 0.9, 'triangle', 0.07, 165, 0.4);
    lab.burst(this.plantTop(lab, 0), { count: 16, colors: ['#9a7a3a', '#6b5536', '#c9b07a'], speed: 1.5, up: 0.5, gravity: 3 });
    lab.popup(this.plantTop(lab, 0.6), 'Росток засох', '#c9b07a', 26);
    this.startEnding(lab, 'dead');
  },
  plantTop(lab, up) {
    const st = lab.state, p = st.pl.top.getWorldPosition(new lab.THREE.Vector3());
    p.y += up || 0; return p;
  },
  // стадии: семя → росток → листья → бутон → цветок → деревце; P.vis — плавная стадия
  plantVisual(lab, dt) {
    const st = lab.state, P = st.plant, pl = st.pl, v = P.vis, s = (a, b) => lab.clamp((v - a) / (b - a), 0, 1);
    const tree = s(4.9, 5.7);
    pl.seed.visible = v < 1.4; pl.seed.scale.setScalar(Math.max(0.01, 1 - s(0.9, 1.4)));
    const hgt = 0.03 + 0.2 * s(0.6, 1.5) + 0.22 * s(1.5, 3) + 0.12 * s(3, 4) + 0.55 * tree;
    pl.stem.scale.set(1 + 2.2 * tree, hgt, 1 + 2.2 * tree); pl.stem.position.y = hgt / 2;
    pl.stem.visible = v > 0.55;
    pl.stemG.rotation.x = P.droop * 0.55;
    const lean = Math.sin(lab.t * 1.3) * 0.04; // дышит, качается
    pl.stemG.rotation.z = lean;
    pl.leaves.forEach((L, i) => {
      const a = [0.8, 0.8, 1.6, 1.6, 2.4, 2.4][i], sz = s(a, a + 0.8) * (1 + 0.5 * tree);
      L.g.visible = sz > 0.01; L.g.scale.setScalar(Math.max(0.01, sz));
      L.g.position.y = hgt * [0.55, 0.5, 0.72, 0.68, 0.88, 0.84][i];
      L.g.rotation.z = L.side * (0.35 + P.droop * 0.9) + (L.wave || 0) * L.side;
    });
    pl.top.position.y = hgt;
    const bud = s(2.8, 3.5) * (1 - s(3.9, 4.4));
    pl.bud.visible = bud > 0.01; pl.bud.scale.setScalar(Math.max(0.01, bud));
    const fl = s(3.8, 4.6) * (1 - P.droop * 0.35);
    pl.flower.visible = fl > 0.01; pl.flower.scale.setScalar(Math.max(0.01, fl * (1 + 0.4 * P.blossom)));
    pl.flower.rotation.y += dt * 0.4;
    pl.crown.visible = tree > 0.01; pl.crown.scale.setScalar(Math.max(0.01, tree * 1.7));
    pl.bloss.visible = tree > 0.01; pl.bloss.scale.setScalar(Math.max(0.01, tree * 1.7 * (0.25 + 0.75 * P.blossom)));
    // жажда: листья желтеют, засохший — бурый
    const T3 = lab.THREE, d = st.dead ? 1 : P.dry;
    pl.leafMat.color.set('#6ee06a').lerp(new T3.Color(d < 0.6 ? '#d8c24a' : '#a5823c'), d < 0.6 ? d / 0.6 * 0.8 : 0.8 + (d - 0.6) / 0.4 * 0.2);
    pl.leafMat.emissiveIntensity = 0.1 + 0.25 * P.bond * (1 - d);
  },

  /* ---------- мир блекнет или возвращает цвет ---------- */
  satStep(lab, dt) {
    const st = lab.state, c = lab.cfg, P = st.plant;
    let target = 1;
    if (c.secret > 0 && (st.phase === 'bustle' || st.phase === 'bloom')) { // о ростке забывали — мир блекнет
      st.neg = lab.damp(st.neg, P.water < 0.25 ? 1 : 0, 0.35, dt);
      target = 1 - 0.65 * st.neg;
    }
    st.fade = lab.damp(st.fade, target, 0.8, dt);
    this.applySat(lab);
  },
  applySat(lab, force) {
    const st = lab.state, c = lab.cfg;
    let s = Math.min(st.fade, c.gray > 0 ? st.color : 1);
    if (st.ending && st.ending.warm === false) s = Math.min(s, lab.lerp(1, 0.25, lab.clamp(st.ending.t / 2, 0, 1)));
    if (st.ending && st.ending.warm) s = Math.max(s, lab.lerp(s, 1, lab.clamp(st.ending.t / 2, 0, 1)));
    if (!force && Math.abs(s - st.satShown) < 0.012) return;
    st.satShown = s;
    const T = st.tint;
    for (const { m, c0 } of T.mats) { const l = c0.r * 0.3 + c0.g * 0.59 + c0.b * 0.11; m.color.setRGB(l * 0.96 + (c0.r - l * 0.96) * s, l * 0.98 + (c0.g - l * 0.98) * s, l * 1.03 + (c0.b - l * 1.03) * s); }
    for (const { m, a0 } of T.inst) {
      const a = m.instanceColor.array;
      for (let i = 0; i < a.length; i += 3) { const l = a0[i] * 0.3 + a0[i + 1] * 0.59 + a0[i + 2] * 0.11; a[i] = l + (a0[i] - l) * s; a[i + 1] = l + (a0[i + 1] - l) * s; a[i + 2] = l + (a0[i + 2] - l) * s; }
      m.instanceColor.needsUpdate = true;
    }
    this.skyAt(lab, st.f, true);
  },
  collectTint(lab) {
    const st = lab.state, mats = new Map(), inst = [];
    const walk = o => {
      if (o.userData.keep || o.userData.lab) return;
      if (o.isMesh) {
        if (o.isInstancedMesh && o.instanceColor) inst.push({ m: o, a0: o.instanceColor.array.slice() });
        for (const m of [].concat(o.material)) if (m && m.color && !m.userData.glow && !mats.has(m)) mats.set(m, { m, c0: m.color.clone() });
      }
      o.children.forEach(walk);
    };
    walk(lab.scene);
    st.tint = { mats: [...mats.values()], inst };
  },
  // «Одиночество»: с каждым днём в комнате пустеет
  emptyRoom(lab) {
    const st = lab.state, left = st.props.filter(p => p.visible), D = Math.round(lab.cfg.days);
    const n = Math.ceil(st.props.length / Math.max(1, D - 1));
    for (let i = 0; i < n && left.length; i++) {
      const p = left.splice(lab.randInt(0, left.length - 1), 1)[0], at = p.userData.at || [0, 0.5, 0];
      lab.after(0.6 + i * 0.5, () => {
        lab.burst(at, { count: 10, colors: ['#d9cbb8', '#bfb3a5'], speed: 1.2, up: 0.6, gravity: 1, life: 1 });
        lab.noise(0.4, 0.03, 600);
        const s0 = p.scale.x;
        lab.tween(0.5, k => { p.scale.setScalar(Math.max(0.01, s0 * (1 - k))); if (k >= 1) p.visible = false; }, 'inCubic');
      });
      st.gone++;
    }
    if (n) { lab.count('вещей исчезло', n); lab.tone(165, 1.2, 'sine', 0.05); }
  },

  /* ---------- финал: наезд камеры на росток ---------- */
  startEnding(lab, kind) {
    const st = lab.state, c = lab.cfg;
    if (st.ending) return;
    if (st.pouring) this.endPour(lab);
    for (const T of st.tasks) this.hideTask(lab, T, false);
    st.tasks = [];
    st.feel = this.feel(lab);
    const care = st.careT / Math.max(1, st.playT);
    const warm = kind === 'farewell' || (kind === 'end' && (care >= 0.55 || st.feel.name === 'надежда'));
    st.ending = { t: 0, kind, warm: kind === 'dead' ? false : warm, done: false };
    lab.follow(null);
    const v = lab.view;
    st.ending.from = { tx: v.target.x, ty: v.target.y, tz: v.target.z, d: v.distance, tilt: v.tilt };
    st.can.visible = false;
    if (warm) [392, 523, 659, 784, 1047].forEach((f, k) => lab.tone(f, 0.6, 'triangle', 0.05, 0, k * 0.18));
    else [330, 294, 262, 220].forEach((f, k) => lab.tone(f, 0.7, 'sine', 0.05, 0, k * 0.25));
    lab.after(1.2, () => lab.popup(this.plantTop(lab, 1.1), `Чувство: ${st.feel.name}`, warm ? '#ffe6a8' : '#c9ccd6', 26));
  },
  endingStep(lab, dt) {
    const st = lab.state, e = st.ending, v = lab.view, f = e.from;
    e.t += dt;
    const k = lab.ease.inOutCubic(lab.clamp(e.t / 2.6, 0, 1));
    const P = e.kind === 'farewell' ? st.yard : st.pl.pos;
    const ty = e.kind === 'farewell' ? 0.9 : P.y + 0.5;
    v.target.set(lab.lerp(f.tx, P.x, k), lab.lerp(f.ty, ty, k), lab.lerp(f.tz, P.z, k));
    v.distance = lab.lerp(f.d, e.kind === 'farewell' ? 9 : 4.6, k);
    v.tilt = lab.lerp(f.tilt, e.kind === 'farewell' ? 0.8 : 1.12, k);
    this.applySat(lab, true);
    if (e.warm && Math.floor(e.t / 0.6) !== Math.floor((e.t - dt) / 0.6) && e.t > 1) {
      const at = e.kind === 'farewell' ? [P.x, 2, P.z] : this.plantTop(lab, 0.2);
      lab.burst(at, { count: 8, colors: ['#ff7ad9', '#ffd8f0', '#fff3a0', '#9cf57a'], speed: 1.5, up: 1.4, gravity: 1, size: 0.1, life: 1.2 });
    }
    if (e.t > (e.kind === 'farewell' ? 5 : 4) && !e.done) {
      e.done = true;
      const s = this.STAGES[st.plant.stage];
      if (e.kind === 'dead') lab.gameOver('Росток засох насовсем. Дела его не заменили');
      else if (e.kind === 'farewell') lab.win(`Прощание: ${s === 'деревце' ? 'деревце' : 'росток'} растёт во дворе, а ты его отпустил`);
      else lab.win(`Чувство партии — ${st.feel.name}: ${st.feel.why}`);
    }
  },
  feel(lab) {
    const st = lab.state, c = lab.cfg, T = Math.max(1, st.playT), care = st.careT / T, dry = st.dryT / T;
    if (st.dead) return { name: 'утрата', why: 'росток засох насовсем — дела его не заменили' };
    if (c.farewell > 0 && st.planted) return { name: 'прощание', why: 'ты вырастил росток и отпустил его во двор' };
    if (c.far > 0) return { name: 'одиночество', why: care >= 0.55 ? 'росток был далеко, но ты ходил к нему через пустеющую комнату' : 'росток был далеко, и комната пустела' };
    if (care >= 0.7) return { name: 'забота', why: 'росток почти всё время был с водой' };
    if (c.gray > 0 && st.color >= 0.6) return { name: 'надежда', why: 'каждый полив возвращал миру цвет' };
    if (st.done >= 4 && dry >= 0.25) return { name: 'вина', why: 'дела сделаны, а росток засыхал' };
    if (st.done >= 4) return { name: 'спешка', why: 'много дел и редкий полив' };
    if (care >= 0.45) return { name: 'забота', why: 'ты больше смотрел на росток, чем на дела' };
    return { name: 'растерянность', why: 'ни дел, ни полива — дни прошли мимо' };
  },
  overNote(lab) {
    const st = lab.state, c = lab.cfg, v = this.variant(lab), P = st.plant, T = Math.max(1, st.playT);
    const f = st.feel || this.feel(lab);
    return [
      v.name !== 'Классика' ? `Вариация: ${v.name} — ${v.how}` : '',
      `Чувство партии: ${f.name} — ${f.why}`,
      `Росток вырос до стадии «${this.STAGES[P.stage]}»`,
      `Дел сделано ${st.done}, пропущено ${st.missed}, лучшая серия ${st.bestStreak}`,
      `Росток был с водой ${Math.round(100 * st.careT / T)}% времени, полив — ${Math.round(st.pourSec)} с`,
      c.secret > 0 ? `Росток откликнулся ${st.responses} раз, связь ${Math.round(P.bond * 100)}%` : 'Спрятанная механика выключена: росток — просто шкала, все дни одинаковые',
      c.far > 0 && st.gone ? `Из комнаты исчезло вещей: ${st.gone}` : '',
    ].filter(Boolean);
  },

  /* ---------- HUD ---------- */
  hudStep(lab, dt) {
    const st = lab.state, c = lab.cfg, P = st.plant, D = Math.round(c.days);
    const tod = st.f < 0.3 ? 'утро' : st.f < 0.62 ? 'день' : st.f < 0.85 ? 'вечер' : 'ночь', ph = this.PHASES[st.phase];
    lab.hud('day', `День ${st.day} из ${D} · ${tod}` + (ph ? ` · ${ph}` : ''), { color: '#ffe6a8', size: 16 });
    if (c.noui > 0) lab.hud('water', null);
    else {
      const n = Math.round(P.water * 10);
      lab.hud('water', `Вода ${'▮'.repeat(n)}${'▯'.repeat(10 - n)} ${Math.round(P.water * 100)}%`, { color: P.water < 0.25 ? '#ff7a6b' : P.water < 0.4 ? '#ffb35c' : '#7fd6ff', size: 15 });
    }
    const mult = Math.min(5, 1 + Math.floor(Math.max(0, st.streak - 1) / 3));
    lab.hud('combo', st.streak > 0 ? `Серия ${st.streak} · очки ×${mult * (c.greed > 0 ? 3 : 1)}` : null, { color: '#ffd23f', size: 15 });
    let hint = null;
    if (st.phase === 'farewell') hint = st.planted ? null : st.carrying ? 'Неси горшок к двери и держи A' : 'Держи A у окна — возьми горшок';
    else if (st.phase === 'bloom') hint = 'Подойди к ростку и держи A';
    else if (lab.t < 9) hint = 'Подойди к делу и держи A. Росток на окне — держи A у окна';
    lab.hud('hint', hint, { color: '#ffffff', size: 14 });
    lab.hud('warn', c.wilt > 0 && !(c.noui > 0) && st.zeroT > 0.5 ? `Росток засыхает! ${Math.max(0, Math.ceil(6 - st.zeroT))}` : null, { color: '#ff7a6b', size: 18 });
  },

  /* ---------- для автотеста ---------- */
  water(lab, sec) { // полить росток sec секунд — как держать A у окна
    const n = Math.max(1, Math.round(sec * 30));
    for (let i = 0; i < n; i++) this.pour(lab, 1 / 30, lab.state.phase === 'bloom');
    this.endPour(lab);
    return lab.state.plant.water;
  },
  doTask(lab) { // сделать ближайшее активное дело сразу
    const st = lab.state, h = st.hero.position;
    let best = null, bd = 1e9;
    for (const T of st.tasks) { if (T.gone) continue; const s = this.spot(lab, T.place), d = Math.hypot(h.x - s[0], h.z - s[1]); if (d < bd) { bd = d; best = T; } }
    if (!best) return false;
    const ok = this.completeTask(lab, best);
    st.tasks = st.tasks.filter(T => !T.gone);
    return ok;
  },

  /* ---------- живой мир: облака, пылинки в луче, часы, шторы ---------- */
  ambient(lab, dt) {
    const st = lab.state, L = st.L;
    st.cloudT = (st.cloudT || 0) + dt;
    st.clouds.forEach((cl, i) => {
      const x = ((cl.x + st.cloudT * cl.v + 70) % 140) - 70;
      cl.puffs.forEach((p, k) => lab.place(st.cloudI, i * 3 + k, [x + p[0], cl.y + p[1], cl.z + p[2]], { scale: [p[3] * 1.5, p[3] * 0.7, p[3]] }));
    });
    // пылинки в солнечном луче у окна
    const day = 1 - st.night;
    st.dust.forEach((d, i) => {
      d.y += dt * d.v; if (d.y > 2.2) d.y = 0.3;
      const x = L.win + Math.sin(lab.t * 0.4 + d.ph) * 0.9 + d.x, z = -L.D / 2 + 0.8 + Math.cos(lab.t * 0.3 + d.ph) * 0.5 + d.z;
      lab.place(st.dustI, i, [x, d.y, z], { scale: 0.025 * day });
    });
    // часы на стене идут вместе с днём: с 6 утра до полуночи
    const hours = 6 + st.f * 18;
    st.clockH.rotation.z = -hours / 12 * Math.PI * 2; st.clockM.rotation.z = -hours * Math.PI * 2;
    st.curtL.rotation.z = Math.sin(lab.t * 0.9) * 0.03; st.curtR.rotation.z = -Math.sin(lab.t * 0.9 + 1) * 0.03;
  },

  /* ---------- комната: открытая сверху диорама ---------- */
  room(lab, scene, L) {
    const st = lab.state, T3 = lab.THREE, W = L.W, D = L.D, H = L.H, wx = L.win;
    if (this._sky) this._sky.dispose();
    const cv = document.createElement('canvas'); cv.width = 2; cv.height = 256;
    st.skyCtx = cv.getContext('2d'); st.skyTex = this._sky = new T3.CanvasTexture(cv); st.skyTex.colorSpace = T3.SRGBColorSpace;
    scene.background = st.skyTex;
    const walls = [], furn = [];
    const UP = '#ffe4b5', LOW = '#e8875a', CAP = '#8a5a3c', WOOD = '#a8724a', DARK = '#7a4a2e';
    // пол: доски трёх оттенков — одна пачка копий; под полом — срез фундамента, как у кукольного домика
    walls.push(lab.box(W + 0.5, 0.4, D + 0.5, DARK, { at: [-0.25, -0.2, -0.25] }));
    const rows = Math.round(D / 0.5), planks = lab.instances(new T3.BoxGeometry(1, 0.04, 0.48), '#ffffff', rows * 2);
    const PL = ['#c98a52', '#b97a44', '#d39a60', '#c48650'];
    for (let r = 0; r < rows; r++) {
      const z = -D / 2 + 0.25 + r * 0.5, cut = lab.rand(-W / 2 + 2, W / 2 - 2);
      lab.place(planks, r * 2, [(-W / 2 + cut) / 2, 0.02, z], { scale: [cut + W / 2 - 0.02, 1, 1], color: PL[r % 4] });
      lab.place(planks, r * 2 + 1, [(cut + W / 2) / 2, 0.02, z], { scale: [W / 2 - cut - 0.02, 1, 1], color: PL[(r + 2) % 4] });
    }
    // задняя стена с окном (z = −D/2) и левая стена с дверью (x = −W/2): низ — тёплая панель, верх — светлые обои
    const ww = 2.1, sill = 0.95, wtop = 2.15, bz = -D / 2 - 0.12, lx = -W / 2 - 0.12;
    const wallSeg = (x0, x1, y0, y1, z, alongX) => {
      if (x1 - x0 < 0.01 || y1 - y0 < 0.01) return;
      const lowTop = Math.min(y1, 0.9);
      if (y0 < 0.9) walls.push(lab.box(alongX ? x1 - x0 : 0.24, lowTop - y0, alongX ? 0.24 : x1 - x0, LOW, { at: alongX ? [(x0 + x1) / 2, (y0 + lowTop) / 2, z] : [z, (y0 + lowTop) / 2, (x0 + x1) / 2] }));
      const y2 = Math.max(y0, 0.9);
      if (y1 > y2) walls.push(lab.box(alongX ? x1 - x0 : 0.24, y1 - y2, alongX ? 0.24 : x1 - x0, UP, { at: alongX ? [(x0 + x1) / 2, (y1 + y2) / 2, z] : [z, (y1 + y2) / 2, (x0 + x1) / 2] }));
    };
    wallSeg(-W / 2 - 0.24, wx - ww / 2, 0, H, bz, true);
    wallSeg(wx + ww / 2, W / 2, 0, H, bz, true);
    wallSeg(wx - ww / 2, wx + ww / 2, 0, sill, bz, true);
    wallSeg(wx - ww / 2, wx + ww / 2, wtop, H, bz, true);
    const dw = 1.1, dtop = 2.08;
    wallSeg(-D / 2 - 0.24, L.door - dw / 2, 0, H, lx, false);
    wallSeg(L.door + dw / 2, D / 2, 0, H, lx, false);
    wallSeg(L.door - dw / 2, L.door + dw / 2, dtop, H, lx, false);
    // срез стены сверху — тёмная кромка; плинтус
    walls.push(lab.box(W + 0.24, 0.06, 0.28, CAP, { at: [0.12 - 0.24, H + 0.03, bz] }));
    walls.push(lab.box(0.28, 0.06, D + 0.24, CAP, { at: [lx, H + 0.03, 0.12 - 0.24] }));
    walls.push(lab.box(W, 0.1, 0.04, DARK, { at: [0, 0.05, -D / 2 + 0.02] }));
    walls.push(lab.box(0.04, 0.1, D, DARK, { at: [-W / 2 + 0.02, 0.05, 0] }));
    // обои в полоску: копии тонких полос
    const stripes = lab.instances(new T3.BoxGeometry(0.08, 1, 0.02), '#ffffff', 80, { shadow: false });
    let si = 0;
    for (let x = -W / 2 + 0.4; x < W / 2 - 0.2 && si < 80; x += 0.6) if (Math.abs(x - wx) > ww / 2 + 0.1) lab.place(stripes, si++, [x, 1.65, -D / 2 + 0.01], { scale: [1, 1.5, 1], color: '#f7cf94' });
    for (let z = -D / 2 + 0.4; z < D / 2 - 0.2 && si < 80; z += 0.6) if (Math.abs(z - L.door) > dw / 2 + 0.1) lab.place(stripes, si++, [-W / 2 + 0.01, 1.65, z], { scale: [1, 1.5, 1], rot: Math.PI / 2, color: '#f7cf94' });
    // окно: рама, подоконник, стекло цвета неба, шторы
    const fr = '#ffffff';
    furn.push(lab.box(ww + 0.3, 0.08, 0.66, '#fbf6ee', { at: [wx, sill + 0.04, -D / 2 + 0.2] })); // подоконник
    furn.push(lab.box(ww, 0.08, 0.1, fr, { at: [wx, wtop - 0.04, bz] }), lab.box(0.08, wtop - sill, 0.1, fr, { at: [wx - ww / 2 + 0.04, (wtop + sill) / 2, bz] }),
      lab.box(0.08, wtop - sill, 0.1, fr, { at: [wx + ww / 2 - 0.04, (wtop + sill) / 2, bz] }), lab.box(0.06, wtop - sill, 0.08, fr, { at: [wx, (wtop + sill) / 2, bz] }),
      lab.box(ww, 0.05, 0.08, fr, { at: [wx, sill + 0.55, bz] }));
    st.glassMat = new T3.MeshBasicMaterial({ color: '#cdeeff', transparent: true, opacity: 0.28, depthWrite: false });
    lab.box(ww - 0.1, wtop - sill - 0.05, 0.02, st.glassMat, { at: [wx, (wtop + sill) / 2, bz], shadow: false }).userData.keep = true;
    // пятно солнца из окна: четыре мягких стекла на полу, ползёт за день (фирменный приём)
    const pc = document.createElement('canvas'); pc.width = pc.height = 128; const px = pc.getContext('2d');
    px.filter = 'blur(5px)'; px.fillStyle = '#ffffff';
    for (const [a, b] of [[14, 14], [68, 14], [14, 68], [68, 68]]) px.fillRect(a, b, 46, 46);
    const ptex = new T3.CanvasTexture(pc); ptex.colorSpace = T3.SRGBColorSpace;
    st.patchMat = new T3.MeshBasicMaterial({ map: ptex, color: '#fff0c0', transparent: true, opacity: 0.5, blending: T3.AdditiveBlending, depthWrite: false });
    st.patch = lab.mesh(new T3.PlaneGeometry(1, 1).rotateX(-Math.PI / 2), st.patchMat, { at: [wx, 0.05, -D / 2 + 1.2], shadow: false });
    st.patch.userData.keep = true;
    st.curtL = lab.group({ at: [wx - ww / 2 - 0.15, H - 0.15, -D / 2 + 0.1] }); st.curtR = lab.group({ at: [wx + ww / 2 + 0.15, H - 0.15, -D / 2 + 0.1] });
    lab.box(0.34, 1.75, 0.08, '#e86a8a', { parent: st.curtL, at: [0, -0.85, 0], round: 0.03 }); lab.box(0.34, 1.75, 0.08, '#e86a8a', { parent: st.curtR, at: [0, -0.85, 0], round: 0.03 });
    furn.push(lab.cyl(0.03, 0.03, ww + 1, '#c9a24a', { at: [wx, H - 0.12, -D / 2 + 0.1], rot: [0, 0, Math.PI / 2] }));
    // дверь: коробка, полотно с ручкой (качается от стука), коврик
    furn.push(lab.box(0.3, 0.1, dw + 0.2, '#ffffff', { at: [lx, dtop + 0.05, L.door] }), lab.box(0.3, dtop, 0.1, '#ffffff', { at: [lx, dtop / 2, L.door - dw / 2 - 0.05] }), lab.box(0.3, dtop, 0.1, '#ffffff', { at: [lx, dtop / 2, L.door + dw / 2 + 0.05] }));
    st.doorLeaf = lab.group({ at: [lx + 0.02, 0, L.door - dw / 2] });
    lab.box(0.06, dtop - 0.04, dw, '#9a6a45', { parent: st.doorLeaf, at: [0, dtop / 2, dw / 2] });
    lab.box(0.07, 0.6, dw * 0.7, '#8a5a38', { parent: st.doorLeaf, at: [0.01, 1.45, dw / 2] });
    lab.ball(0.05, '#ffd23f', { parent: st.doorLeaf, at: [0.08, 1.0, dw - 0.15], shiny: true });
    furn.push(lab.box(0.7, 0.02, 1, '#c0573d', { at: [-W / 2 + 0.45, 0.02, L.door] }));
    // стол с тетрадями и лампой, стул
    const dz = -D / 2 + 0.42, dx = L.desk;
    furn.push(lab.box(1.7, 0.07, 0.78, '#8b5a3c', { at: [dx, 0.76, dz] }));
    for (const [sx, sz] of [[-0.78, -0.32], [0.78, -0.32], [-0.78, 0.32], [0.78, 0.32]]) furn.push(lab.box(0.07, 0.74, 0.07, '#6b4430', { at: [dx + sx, 0.37, dz + sz] }));
    furn.push(lab.box(0.5, 0.35, 0.7, '#9c6a48', { at: [dx + 0.55, 0.52, dz] }));
    st.blocks = [[dx - 0.9, dx + 0.9, -D / 2, dz + 0.42]];
    const neat = lab.group({ at: [dx - 0.35, 0.8, dz] });
    ['#ff8a5c', '#4fa3ff', '#ffd23f', '#7cf5a8'].forEach((col, i) => lab.box(0.36, 0.035, 0.26, col, { parent: neat, at: [0, i * 0.036, 0] }));
    const notes = lab.group({ at: [dx, 0.8, dz] }); notes.visible = false;
    [['#ff8a5c', -0.55, 0.1, 0.5], ['#4fa3ff', -0.15, -0.15, -0.4], ['#ffd23f', 0.25, 0.12, 0.9], ['#7cf5a8', -0.4, -0.2, 1.4]].forEach(([col, x, z, r]) => {
      lab.box(0.36, 0.03, 0.26, col, { parent: notes, at: [x, 0, z], rot: r }); lab.box(0.33, 0.032, 0.23, '#fbf6ee', { parent: notes, at: [x, 0.004, z], rot: r });
    });
    const lamp = lab.group({ at: [dx + 0.65, 0.8, dz - 0.15] });
    lab.cyl(0.12, 0.14, 0.04, '#3a3f58', { parent: lamp }); lab.cyl(0.02, 0.02, 0.5, '#3a3f58', { parent: lamp, at: [0, 0.25, 0] });
    lab.cone(0.17, 0.2, '#ffcf6b', { parent: lamp, at: [0, 0.55, 0.05], rot: [0.5, 0, 0] });
    st.bulbMat = new T3.MeshStandardMaterial({ color: '#fff3c0', emissive: '#ffc96b', emissiveIntensity: 0.2 });
    lab.ball(0.06, st.bulbMat, { parent: lamp, at: [0, 0.47, 0.08], shadow: false });
    st.lampLight = new T3.PointLight('#ffc070', 0, 7, 1.6); st.lampLight.position.set(dx + 0.65, 1.3, dz + 0.1); scene.add(st.lampLight);
    // полка на левой стене: книги — копии, при «Убраться» валятся вкривь
    const shz = L.shelf, shx = -W / 2 + 0.2;
    for (const y of [0.9, 1.35, 1.8]) furn.push(lab.box(0.36, 0.05, 1.3, WOOD, { at: [shx, y, shz] }));
    furn.push(lab.box(0.36, 1.0, 0.05, WOOD, { at: [shx, 1.35, shz - 0.66] }), lab.box(0.36, 1.0, 0.05, WOOD, { at: [shx, 1.35, shz + 0.66] }));
    furn.push(lab.box(0.42, 0.85, 1.3, '#b98258', { at: [-W / 2 + 0.22, 0.43, shz] })); // комод под полкой
    st.blocks.push([-W / 2, -W / 2 + 0.45, shz - 0.68, shz + 0.68]);
    st.bookI = lab.instances(new T3.BoxGeometry(0.24, 0.32, 0.07), '#ffffff', 18);
    st.bookList = []; const BC = ['#e85d75', '#4fa3ff', '#ffd23f', '#7cf5a8', '#c9a7ff', '#ff9a3d'];
    for (let i = 0; i < 18; i++) { const row = Math.floor(i / 9), k = i % 9; st.bookList.push({ x: shx, y: [1.09, 1.54][row], z: shz - 0.5 + k * 0.12, col: BC[(i * 5) % 6], h: lab.rand(0.8, 1.05) }); }
    this.books(lab, false, true);
    // кровать: каркас, матрас, одеяло (смято, пока «Заправить» не сделано), подушка
    const [bx, bzz] = L.bed;
    furn.push(lab.box(2.2, 0.35, 1.25, '#8b5a3c', { at: [bx, 0.22, bzz], round: 0.04 }), lab.box(0.12, 0.85, 1.3, '#7a4a2e', { at: [bx + 1.1, 0.43, bzz] }));
    furn.push(lab.box(2.05, 0.18, 1.12, '#fbf6ee', { at: [bx, 0.48, bzz], round: 0.05 }));
    st.blocks.push([bx - 1.12, bx + 1.18, bzz - 0.65, bzz + 0.65]);
    const blanket = lab.box(1.45, 0.08, 1.16, '#5b6cd6', { at: [bx - 0.28, 0.6, bzz], round: 0.03 });
    const pillow = lab.box(0.45, 0.14, 0.8, '#fff4e0', { at: [bx + 0.75, 0.64, bzz], round: 0.06 });
    // у двери: пакет мусора, список покупок, мяч друзей — видно, какое дело ждёт
    const bag = lab.group({ at: [-W / 2 + 0.55, 0, L.door + 0.85] }); bag.visible = false;
    lab.ball(0.22, '#2f6b3a', { parent: bag, at: [0, 0.22, 0], scale: [1, 1.2, 1] }); lab.cone(0.07, 0.12, '#2f6b3a', { parent: bag, at: [0, 0.5, 0] });
    const list = lab.box(0.02, 0.3, 0.2, '#ffffff', { at: [-W / 2 + 0.03, 1.3, L.door + 0.8] }); list.visible = false;
    const ball = lab.ball(0.16, '#ffffff', { at: [-W / 2 + 0.7, 0.16, L.door - 0.85], detail: 1 }); ball.visible = false;
    st.messy = { blanket, pillow, neat, notes, bag, list, ball };
    [neat, notes, bag, list, ball, lamp, st.curtL, st.curtR].forEach(o => lab.noShadow(o));
    // часы на стене: идут вместе с днём
    const ck = lab.group({ at: [L.far ? 2.6 : (dx + wx) / 2 - 0.3, 1.95, -D / 2 + 0.03] });
    lab.cyl(0.26, 0.26, 0.05, '#ffffff', { parent: ck, rot: [Math.PI / 2, 0, 0] }); lab.cyl(0.28, 0.28, 0.04, '#3a3f58', { parent: ck, rot: [Math.PI / 2, 0, 0], at: [0, 0, -0.01] });
    st.clockH = lab.group({ parent: ck, at: [0, 0, 0.04] }); lab.box(0.03, 0.14, 0.01, '#222222', { parent: st.clockH, at: [0, 0.06, 0] });
    st.clockM = lab.group({ parent: ck, at: [0, 0, 0.045] }); lab.box(0.02, 0.2, 0.01, '#e85d75', { parent: st.clockM, at: [0, 0.09, 0] });
    // вещи комнаты — их забирает «Одиночество»: ковёр, стул, гитара, мяч, рюкзак, постер, коробка, табурет, торшер, игрушка
    st.props = [];
    const prop = (at, build) => { const g = lab.group(); build(g); const m = lab.merge([g]); m.position.set(at[0], 0, at[2]); m.userData.at = [at[0], 0.6, at[2]]; st.props.push(m); return m; };
    prop(L.far ? [-3.6, 0, -0.6] : [0, 0, 0.3], g => { lab.cyl(1.6, 1.6, 0.03, '#3fa7b8', { parent: g, at: [0, 0.03, 0], sides: 24 }); lab.cyl(1.15, 1.15, 0.035, '#f5d36b', { parent: g, at: [0, 0.035, 0], sides: 24 }); lab.cyl(0.7, 0.7, 0.04, '#3fa7b8', { parent: g, at: [0, 0.04, 0], sides: 24 }); });
    prop([dx - 0.7, 0, dz + 0.65], g => { lab.box(0.5, 0.06, 0.5, '#5a8f6a', { parent: g, at: [0, 0.48, 0] }); lab.box(0.5, 0.5, 0.06, '#5a8f6a', { parent: g, at: [0, 0.76, 0.25] }); for (const [a, b] of [[-0.21, -0.21], [0.21, -0.21], [-0.21, 0.21], [0.21, 0.21]]) lab.box(0.05, 0.46, 0.05, '#3f6a4c', { parent: g, at: [a, 0.23, b] }); });
    prop([L.far ? 1.6 : W / 2 - 0.7, 0, L.far ? -D / 2 + 0.4 : -0.6], g => { lab.ball(0.3, '#c9762f', { parent: g, at: [0, 0.35, 0], scale: [1, 1.1, 0.45] }); lab.ball(0.22, '#c9762f', { parent: g, at: [0, 0.75, 0], scale: [1, 1, 0.45] }); lab.box(0.07, 0.75, 0.05, '#4a2e1c', { parent: g, at: [0, 1.15, 0.03] }); lab.cyl(0.08, 0.08, 0.02, '#2a1a10', { parent: g, at: [0, 0.4, 0.14], rot: [Math.PI / 2, 0, 0] }); });
    prop([L.far ? 1.0 : 1.4, 0, L.far ? 2.2 : 3.6], g => { lab.ball(0.2, '#ff8a5c', { parent: g, at: [0, 0.2, 0] }); });
    prop([L.far ? -7.6 : -W / 2 + 1.4, 0, L.far ? 2.6 : 3.7], g => { lab.box(0.4, 0.5, 0.25, '#4fa3ff', { parent: g, at: [0, 0.25, 0], round: 0.06 }); lab.box(0.3, 0.2, 0.06, '#3a7fd0', { parent: g, at: [0, 0.2, 0.15] }); });
    prop([L.far ? 4.4 : 1.0, 0, -D / 2 + 0.05], g => { // постер с горами
      const cv2 = document.createElement('canvas'); cv2.width = 128; cv2.height = 160; const x = cv2.getContext('2d');
      const gr = x.createLinearGradient(0, 0, 0, 160); gr.addColorStop(0, '#ff9a6b'); gr.addColorStop(1, '#ffd6a8'); x.fillStyle = gr; x.fillRect(0, 0, 128, 160);
      x.fillStyle = '#6a7fb5'; x.beginPath(); x.moveTo(0, 120); x.lineTo(40, 50); x.lineTo(70, 95); x.lineTo(95, 40); x.lineTo(128, 110); x.lineTo(128, 160); x.lineTo(0, 160); x.fill();
      x.fillStyle = '#ffffff'; x.beginPath(); x.moveTo(40, 50); x.lineTo(30, 68); x.lineTo(50, 66); x.fill(); x.beginPath(); x.moveTo(95, 40); x.lineTo(85, 58); x.lineTo(105, 58); x.fill();
      x.fillStyle = '#2f7a4a'; x.fillRect(0, 128, 128, 32); x.fillStyle = '#ffffff'; x.font = 'bold 18px sans-serif'; x.textAlign = 'center'; x.fillText('ФИШТ', 64, 150);
      const tex = new T3.CanvasTexture(cv2); tex.colorSpace = T3.SRGBColorSpace;
      lab.mesh(new T3.PlaneGeometry(0.8, 1), new T3.MeshStandardMaterial({ map: tex, roughness: 0.9 }), { parent: g, at: [0, 1.55, 0.02], shadow: false });
    });
    prop([L.far ? -3.6 : -W / 2 + 1.0, 0, L.far ? -D / 2 + 0.5 : -D / 2 + 0.5], g => { lab.box(0.6, 0.45, 0.45, '#e8b04a', { parent: g, at: [0, 0.23, 0] }); lab.ball(0.12, '#e85d75', { parent: g, at: [0.1, 0.52, 0] }); lab.box(0.15, 0.15, 0.15, '#7cf5a8', { parent: g, at: [-0.15, 0.52, 0.05], rot: 0.5 }); });
    prop([L.far ? 2.8 : W / 2 - 1.2, 0, L.far ? 2.2 : 4], g => { lab.cyl(0.22, 0.2, 0.06, '#e85d75', { parent: g, at: [0, 0.45, 0] }); for (let k = 0; k < 3; k++) lab.cyl(0.025, 0.025, 0.45, '#6b4430', { parent: g, at: [Math.cos(k * 2.1) * 0.15, 0.22, Math.sin(k * 2.1) * 0.15] }); });
    prop([L.far ? 5.4 : -W / 2 + 0.5, 0, L.far ? -D / 2 + 0.4 : D / 2 - 0.6], g => { lab.cyl(0.15, 0.18, 0.05, '#3a3f58', { parent: g, at: [0, 0.03, 0] }); lab.cyl(0.02, 0.02, 1.5, '#3a3f58', { parent: g, at: [0, 0.78, 0] }); lab.cone(0.25, 0.3, '#fff0c8', { parent: g, at: [0, 1.6, 0] }); });
    prop([L.far ? -6.8 : W / 2 - 0.5, 0, L.far ? 1.2 : 1.4], g => { lab.box(0.5, 0.3, 0.3, '#ff6b9a', { parent: g, at: [0, 0.15, 0], round: 0.05 }); lab.ball(0.12, '#ffffff', { parent: g, at: [0.12, 0.38, 0] }); lab.ball(0.12, '#ffffff', { parent: g, at: [-0.12, 0.38, 0] }); });
    lab.noShadow(ck); lab.noShadow(st.props[0]); lab.noShadow(st.props[5]);
    lab.merge(walls); lab.merge(furn);
  },
  books(lab, messy, force) {
    const st = lab.state;
    st.bookList.forEach((b, i) => {
      const fallen = messy && i % 4 === 1, tilt = messy ? (i % 3 - 1) * 0.5 : 0;
      if (fallen) lab.place(st.bookI, i, [b.x + 0.6, 0.04, b.z + 0.1 * (i % 5)], { rot: [Math.PI / 2, i, 0], scale: [1, b.h, 1], color: force ? b.col : undefined });
      else lab.place(st.bookI, i, [b.x, b.y + (b.h - 1) * 0.16, b.z], { rot: [tilt, 0, 0], scale: [1, b.h, 1], color: force ? b.col : undefined });
    });
  },
  /* ---------- за окном: двор, подсолнухи, забор, ореховые деревья, дома посёлка, горы, облака, звёзды ---------- */
  outside(lab, scene, L) {
    const st = lab.state, T3 = lab.THREE, W = L.W, D = L.D;
    lab.ground({ w: 220, h: 220, color: '#7cbf55', y: -0.4, bumps: 3, flat: 0.45 });
    const patch = lab.instances(new T3.CylinderGeometry(1, 1, 0.04, 7), '#ffffff', 30, { shadow: false });
    for (let i = 0; i < 30; i++) { let x, z; do { x = lab.rand(-30, 30); z = lab.rand(-30, 20); } while (Math.abs(x) < W / 2 + 1 && Math.abs(z) < D / 2 + 1); lab.place(patch, i, [x, -0.37, z], { scale: [lab.rand(0.6, 1.6), 1, lab.rand(0.6, 1.4)], rot: lab.rand(0, 3), color: lab.pick(['#72b44e', '#86c95c', '#6aaa47']) }); }
    // двор за домом: дорожка, грядка с подсолнухами, забор
    const yx = -W / 2 - 3.2, yz = L.door;
    st.yard = new T3.Vector3(yx, -0.35, yz);
    const ystuff = [];
    for (let i = 0; i < 6; i++) ystuff.push(lab.cyl(0.35, 0.35, 0.05, '#d9cbb8', { at: [-W / 2 - 0.6 - i * 0.5, -0.36, yz + Math.sin(i) * 0.15], sides: 7 }));
    ystuff.push(lab.cyl(0.8, 0.9, 0.12, '#7a5232', { at: [yx, -0.34, yz], sides: 9 })); // лунка для деревца
    lab.merge(ystuff);
    st.sunflowers = lab.group({ shadow: false });
    const N = 14, stem = lab.instances(new T3.CylinderGeometry(0.04, 0.05, 1, 5), '#4f9a3a', N, { parent: st.sunflowers }), head = lab.instances(new T3.CylinderGeometry(0.22, 0.22, 0.08, 10), '#ffcc2a', N, { parent: st.sunflowers }), mid = lab.instances(new T3.CylinderGeometry(0.11, 0.11, 0.1, 8), '#6b3f1f', N, { parent: st.sunflowers });
    for (let i = 0; i < N; i++) {
      const x = -W / 2 + 0.6 + i * 0.55, z = -D / 2 - 1.4 - (i % 2) * 0.4, h = lab.rand(1.4, 2.1);
      lab.place(stem, i, [x, -0.4 + h / 2, z], { scale: [1, h, 1] });
      lab.place(head, i, [x, -0.4 + h, z + 0.08], { rot: [1.2, 0, 0] }); lab.place(mid, i, [x, -0.4 + h, z + 0.1], { rot: [1.2, 0, 0] });
    }
    const posts = lab.instances(new T3.BoxGeometry(0.12, 1.1, 0.12), '#a8724a', 80, { shadow: false }), rails = lab.instances(new T3.BoxGeometry(1, 0.08, 0.05), '#c08a5a', 80, { shadow: false });
    let pi = 0, ri = 0;
    const fx0 = -W / 2 - 7, fx1 = W / 2 + 4, fz0 = -D / 2 - 4, fz1 = D / 2 + 5;
    const side = (ax, az, bx, bz) => { const len = Math.hypot(bx - ax, bz - az), n = Math.floor(len / 1.2); for (let k = 0; k <= n && pi < 80; k++) { const t = k / n; lab.place(posts, pi++, [lab.lerp(ax, bx, t), 0.15, lab.lerp(az, bz, t)]); } for (const y of [0.15, 0.5]) if (ri < 80) lab.place(rails, ri++, [(ax + bx) / 2, y, (az + bz) / 2], { scale: [len, 1, 1], rot: -Math.atan2(bz - az, bx - ax) }); };
    side(fx0, fz0, fx1, fz0); side(fx0, fz0, fx0, fz1);
    // ореховые и яблони: копии одного дерева
    const NT = 16, trunk = lab.instances(new T3.CylinderGeometry(0.18, 0.26, 1, 6), '#6b4a32', NT, { shadow: false }), crown = lab.instances(new T3.IcosahedronGeometry(1, 0), '#ffffff', NT * 2, { shadow: false });
    for (let i = 0; i < NT; i++) {
      let x, z; do { x = lab.rand(-34, 14); z = lab.rand(-30, 8); } while (x > fx0 - 1.5 && z > fz0 - 1.5 || Math.hypot(x, z) < 9);
      const s = lab.rand(1, 1.8), col = lab.pick(['#3f8f45', '#4a9c3e', '#2f7a4a']);
      lab.place(trunk, i, [x, -0.4 + s, z], { scale: [s, s * 2, s] });
      lab.place(crown, i * 2, [x, -0.4 + s * 2.6, z], { scale: s * 1.4, rot: lab.rand(0, 3), color: col });
      lab.place(crown, i * 2 + 1, [x + 0.5 * s, -0.4 + s * 3.2, z - 0.3], { scale: s * 0.9, rot: lab.rand(0, 3), color: col });
    }
    // дома посёлка: белёные стены, черепица
    const vil = [];
    [[-20, -14, 0.3], [-12, -22, -0.2], [6, -20, 0.5], [-28, -2, 1.2], [16, -14, -0.4]].forEach(([x, z, r]) => {
      vil.push(lab.box(4, 2.6, 3.2, '#f4efe4', { at: [x, 0.9, z], rot: r }));
      vil.push(lab.cyl(2.1, 2.1, 4.4, '#c0573d', { at: [x, 2.9, z], rot: [0, r, Math.PI / 2], sides: 3, scale: [1, 1, 0.85] }));
      vil.push(lab.box(0.8, 0.8, 0.1, '#7fb8ff', { at: [x + Math.sin(r) * 1.62, 1.2, z + Math.cos(r) * 1.62], rot: r }));
    });
    lab.noShadow(lab.merge(vil));
    // горы: Фишт и Оштен на горизонте, снежные шапки
    const peaks = [];
    for (let i = 0; i < 14; i++) {
      const a = Math.PI * 1.05 + (i / 13) * Math.PI * 0.95, r = 95 + (i % 3) * 18, h = 26 + ((i * 7) % 5) * 7;
      peaks.push(lab.cone(h * 0.75, h, i % 2 ? '#6a7fb5' : '#7d8fc0', { at: [Math.cos(a) * r, h / 2 - 1, Math.sin(a) * r], sides: 5, rot: i }));
      peaks.push(lab.cone(h * 0.22, h * 0.3, '#ffffff', { at: [Math.cos(a) * r, h * 0.85 - 1, Math.sin(a) * r], sides: 5, rot: i }));
    }
    lab.noShadow(lab.merge(peaks));
    // облака плывут
    st.clouds = [];
    st.cloudI = lab.instances(new T3.IcosahedronGeometry(1, 1), lab.mat('#ffffff', { alpha: 0.92, rough: 1, smooth: true }), 12 * 3, { shadow: false });
    for (let i = 0; i < 12; i++) {
      const sz = lab.rand(1.5, 3);
      st.clouds.push({ x: lab.rand(-70, 70), z: lab.rand(-60, -18), y: lab.rand(12, 20), v: lab.rand(0.4, 1), puffs: [[0, 0, 0, sz], [sz * 1.1, -0.2, 0.3, sz * 0.75], [-sz, -0.25, -0.2, sz * 0.7]] });
    }
    // пылинки в солнечном луче
    st.dustI = lab.instances(new T3.BoxGeometry(1, 1, 1), lab.mat('#fff3c0', { unlit: true, glow: 0.6 }), 18, { shadow: false });
    st.dustI.userData.keep = true;
    st.dust = Array.from({ length: 18 }, () => ({ x: lab.rand(-0.5, 0.5), z: lab.rand(-0.3, 0.6), y: lab.rand(0.3, 2.2), v: lab.rand(0.04, 0.12), ph: lab.rand(0, 6) }));
    // звёзды ночью
    const pts = [];
    for (let i = 0; i < 300; i++) { const a = lab.rand(0, Math.PI * 2), e = lab.rand(0.05, 1.3); pts.push(Math.cos(a) * Math.cos(e) * 150, Math.sin(e) * 150, Math.sin(a) * Math.cos(e) * 150); }
    const g = new T3.BufferGeometry(); g.setAttribute('position', new T3.Float32BufferAttribute(pts, 3));
    st.stars = new T3.Points(g, new T3.PointsMaterial({ color: '#ffffff', size: 2, fog: false, transparent: true, opacity: 0 }));
    st.stars.userData.keep = true; scene.add(st.stars);
  },

  /* ---------- росток в горшке на подоконнике ---------- */
  buildPlant(lab, L) {
    const st = lab.state, T3 = lab.THREE;
    const pos = new T3.Vector3(L.win - 0.3, 1.03, -L.D / 2 + 0.22);
    const potG = lab.group({ at: [pos.x, pos.y, pos.z], scale: 1.5 }); potG.userData.keep = true;
    lab.cyl(0.2, 0.15, 0.3, '#d9734a', { parent: potG, at: [0, 0.15, 0], sides: 10 });
    lab.cyl(0.22, 0.22, 0.06, '#e5865c', { parent: potG, at: [0, 0.29, 0], sides: 10 });
    lab.cyl(0.18, 0.18, 0.02, '#5a3a24', { parent: potG, at: [0, 0.31, 0], sides: 10 });
    const plantG = lab.group({ parent: potG, at: [0, 0.31, 0] });
    const stemG = lab.group({ parent: plantG });
    const leafMat = new T3.MeshStandardMaterial({ color: '#6ee06a', roughness: 0.6, flatShading: true, emissive: '#3a8a2a', emissiveIntensity: 0.1 });
    const stemMat = new T3.MeshStandardMaterial({ color: '#4fae45', roughness: 0.7, flatShading: true });
    const stem = lab.mesh(new T3.CylinderGeometry(0.018, 0.026, 1, 6), stemMat, { parent: stemG });
    const seed = lab.ball(0.05, '#8a5a32', { parent: plantG, at: [0, 0.02, 0], scale: [1, 0.75, 1] });
    const leaves = [];
    for (let i = 0; i < 6; i++) {
      const side = i % 2 ? -1 : 1, g = lab.group({ parent: stemG, rot: [0, i * 1.1, 0] });
      lab.mesh(new T3.IcosahedronGeometry(1, 1), leafMat, { parent: g, at: [side * 0.11, 0.02, 0], scale: [0.11, 0.025, 0.06] });
      leaves.push({ g, side, wave: 0 });
    }
    const top = lab.group({ parent: stemG });
    const bud = lab.ball(0.06, new T3.MeshStandardMaterial({ color: '#9cd96a', emissive: '#ff7ad9', emissiveIntensity: 0.25, flatShading: true }), { parent: top, at: [0, 0.04, 0], scale: [1, 1.4, 1] });
    const flower = lab.group({ parent: top, at: [0, 0.04, 0] });
    const petalMat = new T3.MeshStandardMaterial({ color: '#ff7ad9', emissive: '#ff7ad9', emissiveIntensity: 0.35, roughness: 0.5, flatShading: true });
    const petals = new T3.InstancedMesh(new T3.IcosahedronGeometry(1, 1), petalMat, 6);
    const M = new T3.Matrix4(), Q = new T3.Quaternion(), E = new T3.Euler();
    for (let i = 0; i < 6; i++) { const a = i / 6 * Math.PI * 2; M.compose(new T3.Vector3(Math.cos(a) * 0.09, 0, Math.sin(a) * 0.09), Q.setFromEuler(E.set(0, -a, 0.35)), new T3.Vector3(0.08, 0.02, 0.045)); petals.setMatrixAt(i, M); }
    flower.add(petals);
    lab.ball(0.045, new T3.MeshStandardMaterial({ color: '#ffd23f', emissive: '#ffb020', emissiveIntensity: 0.4, flatShading: true }), { parent: flower, at: [0, 0.02, 0] });
    // деревце: крона из шаров и цветки-копии на ней
    const crown = lab.group({ parent: top, at: [0, 0.1, 0] });
    const cg = [[0, 0.12, 0, 0.26], [0.18, 0.02, 0.05, 0.19], [-0.17, 0.04, -0.04, 0.2], [0.02, 0.0, 0.17, 0.17]].map(([x, y, z, r]) => new T3.IcosahedronGeometry(r, 1).translate(x, y, z));
    lab.mesh(lab.addons.BufferGeometryUtils.mergeGeometries(cg), leafMat, { parent: crown }); cg.forEach(g => g.dispose());
    const bloss = new T3.InstancedMesh(new T3.IcosahedronGeometry(0.035, 0), petalMat, 14);
    for (let i = 0; i < 14; i++) { const a = i * 2.4, e = 0.3 + (i % 4) * 0.3; M.compose(new T3.Vector3(Math.cos(a) * Math.cos(e) * 0.28, 0.12 + Math.sin(e) * 0.26, Math.sin(a) * Math.cos(e) * 0.28), Q.identity(), new T3.Vector3(1, 1, 1)); bloss.setMatrixAt(i, M); }
    const blossG = lab.group({ parent: top, at: [0, 0.1, 0] }); blossG.add(bloss);
    st.pl = { pos, potG, plantG, stemG, stem, seed, leaves, top, bud, flower, crown, bloss: blossG, leafMat };
    lab.noShadow(plantG); // мелочь на подоконнике: тень не нужна, вызовы отрисовки — нужны
    // шкала воды — стеклянная трубка у горшка
    st.gauge = lab.group({ at: [pos.x + 0.6, pos.y, pos.z + 0.05], scale: 1.5 }); st.gauge.userData.keep = true;
    lab.cyl(0.045, 0.045, 0.27, lab.mat('#dff4ff', { alpha: 0.35 }), { parent: st.gauge, at: [0, 0.135, 0], shadow: false });
    st.gaugeMat = new T3.MeshStandardMaterial({ color: '#4fc3ff', emissive: '#4fc3ff', emissiveIntensity: 0.5 });
    st.gaugeFill = lab.mesh(new T3.CylinderGeometry(0.035, 0.035, 0.25, 8), st.gaugeMat, { parent: st.gauge, shadow: false });
    st.gaugeFill.geometry.translate(0, 0.125, 0); st.gaugeFill.position.y = 0;
    lab.cyl(0.06, 0.06, 0.03, '#ffffff', { parent: st.gauge, at: [0, 0.015, 0] });
  },
  /* ---------- герой: подросток в оранжевой толстовке ---------- */
  buildHero(lab, L) {
    const st = lab.state, T3 = lab.THREE;
    const g = lab.group({ at: [L.start[0], 0, L.start[1]] }); g.userData.keep = true;
    Object.defineProperty(g, 'x', { get() { return this.position.x; } });
    Object.defineProperty(g, 'z', { get() { return this.position.z; } });
    lab.cyl(0.36, 0.36, 0.01, lab.mat('#1a1022', { alpha: 0.28 }), { parent: g, at: [0, 0.012, 0], shadow: false, sides: 16 });
    const body = lab.group({ parent: g });
    const HOOD = '#ff6a3d', JEANS = '#2d4fa0', SKIN = '#f2c29b';
    const legL = lab.group({ parent: body, at: [-0.11, 0.72, 0] }), legR = lab.group({ parent: body, at: [0.11, 0.72, 0] });
    for (const lg of [legL, legR]) { lab.box(0.16, 0.66, 0.18, JEANS, { parent: lg, at: [0, -0.35, 0] }); lab.box(0.17, 0.09, 0.26, '#f4f4f6', { parent: lg, at: [0, -0.68, 0.04] }); }
    lab.box(0.48, 0.56, 0.3, HOOD, { parent: body, at: [0, 1.0, 0], round: 0.06 });
    lab.box(0.34, 0.16, 0.06, '#ff8a5c', { parent: body, at: [0, 0.86, 0.16] }); // карман-кенгуру
    lab.box(0.36, 0.2, 0.14, HOOD, { parent: body, at: [0, 1.27, -0.14], round: 0.05 }); // капюшон
    const armL = lab.group({ parent: body, at: [-0.3, 1.22, 0] }), armR = lab.group({ parent: body, at: [0.3, 1.22, 0] });
    for (const a of [armL, armR]) { lab.box(0.13, 0.48, 0.14, HOOD, { parent: a, at: [0, -0.24, 0], round: 0.04 }); lab.ball(0.07, SKIN, { parent: a, at: [0, -0.5, 0] }); }
    const head = lab.group({ parent: body, at: [0, 1.52, 0] });
    lab.ball(0.23, SKIN, { parent: head, detail: 2, smooth: true });
    lab.ball(0.24, '#3a2418', { parent: head, at: [0, 0.07, -0.04], scale: [1.02, 0.75, 1], detail: 1 }); // волосы
    lab.box(0.3, 0.07, 0.12, '#3a2418', { parent: head, at: [0.03, 0.17, 0.16], rot: [0.3, 0, 0.1] }); // чёлка
    for (const s of [-1, 1]) { lab.ball(0.05, '#ffffff', { parent: head, at: [s * 0.085, 0.01, 0.2], detail: 1, shadow: false }); lab.ball(0.027, '#1a1022', { parent: head, at: [s * 0.085, 0.01, 0.245], detail: 1, shadow: false }); }
    // лейка в правой руке — видна, когда поливаешь
    const can = lab.group({ parent: armR, at: [0, -0.52, 0.12] }); can.visible = false;
    lab.cyl(0.11, 0.12, 0.2, '#2f9be0', { parent: can, at: [0, 0, 0.08], rot: [Math.PI / 2, 0, 0], shiny: true });
    lab.cyl(0.02, 0.03, 0.3, '#2f9be0', { parent: can, at: [0, -0.04, 0.3], rot: [Math.PI / 2 + 0.5, 0, 0] });
    st.spout = lab.group({ parent: can, at: [0, -0.12, 0.45] });
    st.hero = g; st.H = { body, legL, legR, armL, armR, head }; st.can = can; st.armR = armR;
  },
  /* ---------- иконки дел: 3D-предмет, кольцо-таймер, кольцо прогресса, подпись ---------- */
  buildIcons(lab) {
    const st = lab.state, T3 = lab.THREE;
    st.ringGeos = []; st.progGeos = [];
    for (let k = 0; k <= 24; k++) {
      st.ringGeos.push(new T3.RingGeometry(0.38, 0.47, 32, 1, Math.PI / 2, Math.max(0.01, k / 24 * Math.PI * 2)));
      st.progGeos.push(new T3.RingGeometry(0.27, 0.35, 32, 1, Math.PI / 2, Math.max(0.01, k / 24 * Math.PI * 2)));
    }
    st.icons = {};
    for (const K of this.KINDS) {
      const g = lab.group({ shadow: false }); g.visible = false; g.userData.keep = true;
      const obj = lab.group({ parent: g, scale: 1.4 });
      this.iconObj(lab, K.id, obj);
      lab.noShadow(obj);
      const ringMat = new T3.MeshBasicMaterial({ color: '#ffd23f', transparent: true, depthTest: false, side: T3.DoubleSide });
      const ring = new T3.Mesh(st.ringGeos[24], ringMat); ring.renderOrder = 5; g.add(ring);
      const prog = new T3.Mesh(st.progGeos[1], new T3.MeshBasicMaterial({ color: new T3.Color('#ffffff').multiplyScalar(1.6), transparent: true, depthTest: false, side: T3.DoubleSide })); prog.renderOrder = 6; g.add(prog);
      const cv = document.createElement('canvas'); cv.width = 256; cv.height = 64;
      const x = cv.getContext('2d');
      x.fillStyle = 'rgba(20,16,40,0.78)'; x.beginPath(); x.roundRect ? x.roundRect(4, 6, 248, 52, 26) : x.rect(4, 6, 248, 52); x.fill();
      let fs = 32; x.font = `bold ${fs}px sans-serif`; while (x.measureText(K.name).width > 230 && fs > 16) { fs -= 2; x.font = `bold ${fs}px sans-serif`; } // длинная подпись — шрифт мельче
      x.fillStyle = K.color; x.textAlign = 'center'; x.textBaseline = 'middle'; x.fillText(K.name, 128, 33);
      const tex = new T3.CanvasTexture(cv); tex.colorSpace = T3.SRGBColorSpace;
      const label = new T3.Sprite(new T3.SpriteMaterial({ map: tex, depthTest: false, transparent: true }));
      label.scale.set(2.2, 0.55, 1); label.position.y = -0.72; label.renderOrder = 7; g.add(label);
      [ring, prog, label].forEach(m => { m.userData.noShadow = true; });
      st.icons[K.id] = { g, obj, ring, ringMat, prog, label, ph: lab.rand(0, 6) };
    }
  },
  iconObj(lab, id, g) {
    if (id === 'uroki') { // раскрытая тетрадь
      lab.box(0.24, 0.03, 0.32, '#ffd23f', { parent: g, at: [-0.12, 0, 0], rot: [0, 0, 0.35] }); lab.box(0.24, 0.03, 0.32, '#ffd23f', { parent: g, at: [0.12, 0, 0], rot: [0, 0, -0.35] });
      lab.box(0.22, 0.02, 0.29, '#ffffff', { parent: g, at: [-0.11, 0.025, 0], rot: [0, 0, 0.35] }); lab.box(0.22, 0.02, 0.29, '#ffffff', { parent: g, at: [0.11, 0.025, 0], rot: [0, 0, -0.35] });
    } else if (id === 'druzya') { // мяч
      lab.ball(0.17, '#ffffff', { parent: g, detail: 1 }); lab.cyl(0.175, 0.175, 0.05, '#1a1a1a', { parent: g }); lab.cyl(0.175, 0.175, 0.05, '#1a1a1a', { parent: g, rot: [Math.PI / 2, 0, 0] });
    } else if (id === 'musor') { // пакет
      lab.ball(0.18, '#3f8f4a', { parent: g, scale: [1, 1.15, 1] }); lab.cone(0.06, 0.12, '#3f8f4a', { parent: g, at: [0, 0.24, 0] });
    } else if (id === 'magazin') { // корзинка
      lab.cyl(0.2, 0.15, 0.18, '#c98a4a', { parent: g }); lab.mesh(new lab.THREE.TorusGeometry(0.16, 0.02, 5, 12, Math.PI), '#a8724a', { parent: g, at: [0, 0.08, 0] });
      lab.ball(0.07, '#ff6b5e', { parent: g, at: [0.06, 0.1, 0] }); lab.box(0.08, 0.16, 0.06, '#ffffff', { parent: g, at: [-0.06, 0.12, 0] });
    } else if (id === 'ubrat') { // веник
      lab.cyl(0.02, 0.02, 0.45, '#a8724a', { parent: g, at: [0, 0.1, 0], rot: [0, 0, 0.3] }); lab.cone(0.12, 0.22, '#e8c35a', { parent: g, at: [0.08, -0.16, 0], rot: [Math.PI, 0, 0.3] });
    } else { // подушка
      lab.box(0.42, 0.14, 0.3, '#8fd3ff', { parent: g, round: 0.06 }); lab.box(0.2, 0.15, 0.31, '#ffffff', { parent: g, round: 0.05 });
    }
  },
};
