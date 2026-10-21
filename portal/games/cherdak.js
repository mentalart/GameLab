// «Чердак» — ремейк-донор урока 20 «История, рассказанная пространством» по мотивам Unpacking (Witch Beam, 2021) и Gone Home
// (Fullbright, 2013) на оболочке «Лаб3D» 1.0 (three.js). Рука разбирает коробки на чердаке старого дома в ауле: вещь щёлкает
// на своё место, пыль, нота с каждой вещью подряд выше. Три коробки — три времени одной семьи: молодость, семья, тишина и внук.
// Спрятанная механика донора — повествование окружением (ручка secret): у вещей-историй осмысленное место, а между временами
// комната меняется сама — появилась вторая чашка и исчезла, свадебное фото на стене, рисунок ребёнка, старое письмо в гармони.
// Ручка secret = 0 (пресет «Без спрятанной механики») — в коробках просто книги, банки и свечи, и комната ничего не рассказывает.
// Из лучших игр жанра: щелчок и подсветка места, вещи не на местах краснеют в конце коробки (Unpacking); вещь крупно в руках
// и деталь, которую видно только вблизи (Gone Home, What Remains of Edith Finch); силуэт в хламе (Hidden Folks);
// одна комната в двух временах (Titanfall 2, «Эффект и причина»); фонарик в тёмном доме (Gone Home).
// Вариации урока: inspect, find, limit, memory, past, dark, free, cat — имя и правило в баннере, строке над полем и в итогах.
/* ПЛАН
   Фраза игры: ты — рука, ты разбираешь коробки на чердаке старого дома в ауле, но коробки — это три времени одной семьи.
   Цель — разложить всё по местам и понять, что здесь было, хотя в игре нет ни слова.
   Ядро на 3 секунды: A у коробки → вещь выпрыгивает и крутится в руке → место светится → A → щелчок, пыль, нота выше, очки.
   Выбор, оплаченный очками: класть быстро ради серии (×2…×4) или искать, где вещи место по смыслу (+25 вместо +10), и рассматривать.
   Угрозы мягкие, как в уютной игре: «не туда» — вещь дрожит красным и рвёт серию; кот сбрасывает вещи; часы (вариации).
   Кривая партии: 0–10 с — первая вещь у самой коробки, её место рядом; 10–60 — коробка 1, места дальше по комнате;
   «прошло время» — камера отъезжает, свет в окне из утреннего в дневной; коробка 2 — стены и пол; коробка 3 — вечер, спрятанное
   письмо; финал — камера медленно проезжает по комнате в закатном свете.
   События: взять (выпрыгнула), положить (щелчок, пыль, нота), не туда (дрожь, красный), серия ×N, тёплая вспышка на месте,
   осмотр (наезд камеры), подсказка места (мигание), коробка разобрана (аккорд, уходит в люк), прошло время (свет, пыль), финал.
   Лицо игры: тёплая диорама-шкатулка — чердак в разрезе висит в тёмно-сливовой пустоте, из круглого окна падает косой золотой луч.
   Палитра: пустота #16122a, дерево #9a6a3c, побелка #e6d7bd, ковёр #9e2a2b и золото #d9a441, свет окна #ffd27a, тень #8ea0e0,
   рука #5ef2d6 (этот цвет — только у руки), «не туда» #ff4d5e.
   Свет: ключевой — тёплое солнце из окна, заполняющий — холодное небо; стены и крыша теней не бросают, мебель и вещи бросают.
   Три фирменных приёма: косой луч из круглого окна с пылинками, который меняет цвет со временем; вещь «оживает» тёплой вспышкой
   и волной света на своём месте; опустевшее место остаётся пыльным кругом с одной светящейся пылинкой.
*/
const GAME = {
  engine: 'three',
  title: 'Чердак',
  subtitle: 'Разбери коробки на чердаке старого дома — вещи сами расскажут, что здесь было',
  donor: 'Unpacking и Gone Home',
  players: 1,
  controls: [
    { input: 'move4', text: 'рука' },
    { input: 'a', text: 'взять / положить' },
    { input: 'b', text: 'рассмотреть' },
  ],
  scoreColor: '#ffd27a', // счёт цветом света из окна
  camera: { type: 'diorama', tilt: 0.92, turn: 0.6, target: [-0.1, 0.9, -0.45], fov: 0.6 },
  field: { w: 10.6, h: 7.6 },
  shadowSize: 8,
  sky: ['#16122a', '#3a2a4c'],
  fog: 0,
  accent: '#ffd27a',
  lives: 0, // жизней нет: уютная игра
  decisions: [
    'Чувство: щелчок — вещь встала на место, нота выше с каждой вещью подряд, и комната всё больше похожа на дом',
    'Честность: подходящие места светятся заранее, а после трёх промахов вещь сама показывает своё место',
    'Выбор: класть быстро ради серии или рассматривать вещи и искать, где каждой место по смыслу',
  ],
  notes: [
    'После трёх промахов подряд или 6 секунд с вещью в руке её место мигает, а рука, пока ею двигаешь, мягко клонится к нему — помощь новичку.',
    'Место вещи-истории занято только ею: обычная вещь туда не ляжет, иначе история застрянет. Если у вещи в руке не осталось ни одного подходящего свободного места, она ляжет в любое свободное.',
    'Из нескольких мест рядом с рукой выбирается подходящее: «не туда» бывает, только когда подходящего рядом нет. Полки и стены — дальше по экрану, чем сундук и тахта под ними.',
  ],
  config: {
    secret: { value: 1, min: 0, max: 1, step: 1, label: 'Спрятанная механика: вещи рассказывают историю', names: ['выкл', 'вкл'], restart: true },
    boxes: { value: 3, min: 1, max: 3, step: 1, label: 'Коробок — времён одной семьи', restart: true },
    speed: { value: 4.2, min: 1.5, max: 9, step: 0.1, label: 'Скорость руки, м/с' },
    accel: { value: 12, min: 3, max: 40, step: 1, label: 'Разгон руки', hint: 'чем больше, тем резче рука трогается и тормозит' },
    reach: { value: 1.15, min: 0.5, max: 1.8, step: 0.05, label: 'Рука достаёт до места, м' },
    hintFails: { value: 3, min: 0, max: 8, step: 1, label: 'Место мигает после промахов подряд', hint: '0 — без этой подсказки' },
    hintTime: { value: 6, min: 0, max: 30, step: 1, label: 'Место мигает, если вещь в руке дольше, с', hint: '0 — только после промахов' },
    pull: { value: 3, min: 0, max: 5, step: 0.1, label: 'Подсказка клонит руку к месту, м/с' },
    comboTime: { value: 7, min: 2, max: 20, step: 0.5, label: 'Серия: секунд между вещами' },
    big: { value: 1.5, min: 0.8, max: 2, step: 0.05, label: 'Размер вещей', restart: true },
    inspectTime: { value: 2, min: 0.5, max: 5, step: 0.1, label: 'Осмотр вещи, с' },
    free: { value: 0, min: 0, max: 1, step: 1, label: 'Без подсказок: места не светятся, ошибки краснеют в конце', names: ['выкл', 'вкл'] },
    inspect: { value: 0, min: 0, max: 1, step: 1, label: 'Осмотр: вещи уже на местах — найди истории', names: ['выкл', 'вкл'], restart: true },
    find: { value: 0, min: 0, max: 1, step: 1, label: 'Найди вещь: силуэт над коробкой, вокруг хлам', names: ['выкл', 'вкл'], restart: true },
    findN: { value: 8, min: 3, max: 15, step: 1, label: 'Найди вещь: сколько вещей подряд', restart: true },
    junk: { value: 44, min: 10, max: 80, step: 2, label: 'Найди вещь: хлама вокруг, штук', restart: true },
    limit: { value: 0, min: 0, max: 300, step: 10, label: 'Время на партию, с (0 — без времени)' },
    memory: { value: 0, min: 0, max: 1, step: 1, label: 'По памяти: комната показана, верни всё как было', names: ['выкл', 'вкл'], restart: true },
    memoryShow: { value: 4, min: 1, max: 10, step: 0.5, label: 'По памяти: секунд показа' },
    past: { value: 0, min: 0, max: 1, step: 1, label: 'Два времени: B — вид в прошлое', names: ['выкл', 'вкл'] },
    dark: { value: 0, min: 0, max: 1, step: 1, label: 'Фонарик: на чердаке темно', names: ['выкл', 'вкл'], restart: true },
    cat: { value: 0, min: 0, max: 1, step: 1, label: 'Кот сбрасывает вещи', names: ['выкл', 'вкл'], restart: true },
    catEvery: { value: 12, min: 5, max: 30, step: 1, label: 'Кот: раз в … с (±2 с)' },
  },
  presets: {
    'Новичок': { speed: 5.5, reach: 1.4, hintFails: 2, hintTime: 5 },
    'Без спрятанной механики': { secret: 0 },
    'Осмотр': { inspect: 1 },
    'Найди вещь': { find: 1 },
    'На время': { limit: 60 },
    'По памяти': { memory: 1 },
    'Два времени': { past: 1 },
    'Фонарик': { dark: 1 },
    'Без подсказок': { free: 1 },
    'Кот': { cat: 1 },
  },
  // имя вариации и её правило — для баннера в начале, строки над полем и экрана конца партии
  VARIANTS: [
    { key: 'inspect', name: 'Осмотр', how: () => 'вещи уже стоят по местам: рассматривай их (A или B) и найди все, что хранят историю' },
    { key: 'find', name: 'Найди вещь', how: c => `найди в хламе вещь по силуэту над коробкой — ${Math.round(c.findN)} вещей подряд` },
    { key: 'limit', name: 'На время', how: c => `${Math.round(c.limit)} с на весь чердак` },
    { key: 'memory', name: 'По памяти', how: c => `запомни комнату за ${c.memoryShow} с — вещи разлетятся по коробкам, верни каждую на её место` },
    { key: 'past', name: 'Два времени', how: () => 'B — вид в прошлое: призраки вещей стоят там, где стояли' },
    { key: 'dark', name: 'Фонарик', how: () => 'на чердаке темно, светит только фонарь у руки' },
    { key: 'free', on: c => c.free > 0, name: 'Без подсказок', how: () => 'клади куда хочешь — в конце коробки вещи не на местах покраснеют' },
    { key: 'cat', name: 'Кот', how: () => 'кот сбрасывает вещи на пол — возвращай их' },
  ],
  // места: ключ, тип, где стоит вещь [x, y, z], куда подвести руку [x, z], поворот вещи, поверхность (h — горизонт., b — задняя стена, l — левая стена)
  SLOTS: [
    ['T1', 'стол', [-0.42, 0.42, 0.6], [-0.42, 0.6], 0.3, 'h'], ['T2', 'стол', [0.22, 0.42, 0.6], [0.22, 0.6], 0.3, 'h'],
    ['T3', 'стол', [-0.42, 0.42, 1.2], [-0.42, 1.2], 0.3, 'h'], ['T4', 'стол', [0.22, 0.42, 1.2], [0.22, 1.2], 0.3, 'h'],
    ['D1', 'стол', [-4.45, 0.76, -1.05], [-3.95, -1.05], Math.PI / 2, 'h'], ['D2', 'стол', [-4.45, 0.76, -0.2], [-3.95, -0.2], Math.PI / 2, 'h'],
    ['N1', 'стол', [1.5, 0.6, -3.08], [1.5, -2.6], 0, 'h'],
    ['P1', 'полка', [-0.6, 0.86, -3.3], [-0.6, -2.7], 0, 'h'], ['P2', 'полка', [0.02, 0.86, -3.3], [0.02, -2.7], 0, 'h'], ['P3', 'полка', [0.64, 0.86, -3.3], [0.64, -2.7], 0, 'h'],
    ['P4', 'полка', [-0.6, 1.46, -3.3], [-0.6, -3.2], 0, 'h'], ['P5', 'полка', [0.02, 1.46, -3.3], [0.02, -3.2], 0, 'h'], ['P6', 'полка', [0.64, 1.46, -3.3], [0.64, -3.2], 0, 'h'],
    ['W1', 'стена', [-3.0, 1.18, -3.5], [-3.0, -3.2], 0, 'b'], ['W2', 'стена', [-2.05, 1.18, -3.5], [-2.05, -3.2], 0, 'b'],
    ['W3', 'стена', [2.6, 1.18, -3.5], [2.6, -3.2], 0, 'b'], ['W4', 'стена', [3.65, 1.18, -3.5], [3.65, -3.2], 0, 'b'],
    ['C1', 'сундук', [-3.0, 0.72, -3.0], [-3.0, -2.5], 0, 'h'], ['C2', 'сундук', [-2.1, 0.72, -3.0], [-2.1, -2.5], 0, 'h'],
    ['B1', 'кровать', [2.6, 0.5, -2.85], [2.6, -2.35], 0, 'h'], ['B2', 'кровать', [3.75, 0.5, -2.85], [3.75, -2.35], 0, 'h'],
    ['S1', 'подоконник', [-4.82, 1.9, -0.98], [-4.6, -0.98], Math.PI / 2, 'h'], ['S2', 'подоконник', [-4.82, 1.9, -0.22], [-4.6, -0.22], Math.PI / 2, 'h'],
    ['H1', 'крючок', [-4.86, 1.18, 1.1], [-4.6, 1.1], Math.PI / 2, 'l'], ['H2', 'крючок', [-4.86, 1.18, 1.9], [-4.6, 1.9], Math.PI / 2, 'l'],
    ['H3', 'крючок', [-4.86, 1.18, 2.7], [-4.6, 2.7], Math.PI / 2, 'l'],
    ['F1', 'пол', [-2.4, 0.05, 1.9], [-2.4, 1.9], 0.4, 'h'], ['F2', 'пол', [2.7, 0.05, 0.1], [2.7, 0.1], 0.4, 'h'],
    ['F3', 'пол', [1.75, 0.05, -1.6], [1.75, -1.6], 0.4, 'h'], ['F4', 'пол', [-2.7, 0.05, -1.0], [-2.7, -1.0], 0.4, 'h'],
  ],
  // вещи с историей (secret = 1): story — единственное место по смыслу; у обычных — типы мест и «родное» место (для «По памяти» и «Осмотра»)
  STORY: [
    { k: 'photo1', box: 0, story: 'T4' }, { k: 'letter', box: 0, story: 'T3' },
    { k: 'cup1', box: 0, types: ['стол', 'полка'], home: 'T1' }, { k: 'garmon', box: 0, types: ['сундук', 'полка', 'пол'], home: 'C1' },
    { k: 'papakha', box: 0, types: ['крючок', 'полка'], home: 'H1' }, { k: 'poems', box: 0, types: ['полка', 'стол', 'подоконник'], home: 'P4' },
    { k: 'wedding', box: 1, story: 'W1' }, { k: 'cup2', box: 1, story: 'T2' },
    { k: 'satchel', box: 1, types: ['крючок', 'пол'], home: 'H2' }, { k: 'horse', box: 1, story: 'F3' },
    { k: 'jug', box: 1, types: ['подоконник', 'полка', 'стол'], home: 'S1' }, { k: 'drawing', box: 1, story: 'W4' },
    { k: 'lamp', box: 1, types: ['стол', 'подоконник'], home: 'N1' },
    { k: 'glasses', box: 2, types: ['стол', 'кровать'], home: 'D1' }, { k: 'gphoto', box: 2, story: 'W3' },
    { k: 'clock', box: 2, types: ['полка', 'стол', 'подоконник'], home: 'P5' }, { k: 'gletter', box: 2, story: 'D2' },
    { k: 'radio', box: 2, types: ['сундук', 'полка', 'стол'], home: 'C2' }, { k: 'plaid', box: 2, types: ['кровать', 'сундук', 'пол'], home: 'B1' },
  ],
  // вещи без истории (secret = 0): та же механика, но комната ничего не рассказывает
  PLAIN: [
    { k: 'book', c: '#2c4f86', box: 0, types: ['полка', 'стол', 'подоконник'], home: 'P1' }, { k: 'jar', c: '#c0392b', box: 0, types: ['полка', 'подоконник', 'стол'], home: 'S1' },
    { k: 'candle', box: 0, types: ['стол', 'подоконник', 'полка'], home: 'T1' }, { k: 'basket', box: 0, types: ['пол', 'сундук'], home: 'F1' },
    { k: 'plaid', box: 0, types: ['кровать', 'сундук', 'пол'], home: 'B1' }, { k: 'vase', box: 0, types: ['стол', 'подоконник', 'полка'], home: 'T3' },
    { k: 'books', box: 1, types: ['полка', 'пол', 'стол'], home: 'P2' }, { k: 'jar', c: '#e8a020', box: 1, types: ['полка', 'подоконник', 'стол'], home: 'P3' },
    { k: 'pot', box: 1, types: ['подоконник', 'пол'], home: 'S2' }, { k: 'pillow', box: 1, types: ['кровать', 'пол'], home: 'B2' },
    { k: 'embroidery', box: 1, types: ['стена'], home: 'W1' }, { k: 'jug', box: 1, types: ['подоконник', 'полка', 'стол'], home: 'D1' },
    { k: 'lamp', box: 1, types: ['стол', 'подоконник'], home: 'N1' },
    { k: 'book', c: '#3e7a3a', box: 2, types: ['полка', 'стол', 'подоконник'], home: 'P4' }, { k: 'candle', box: 2, types: ['стол', 'подоконник', 'полка'], home: 'T2' },
    { k: 'casket', box: 2, types: ['сундук', 'полка', 'стол'], home: 'C1' }, { k: 'yarn', box: 2, types: ['кровать', 'сундук', 'полка'], home: 'C2' },
    { k: 'mirror', box: 2, types: ['стена', 'крючок'], home: 'W3' }, { k: 'clock', box: 2, types: ['полка', 'стол', 'подоконник'], home: 'P5' },
    { k: 'radio', box: 2, types: ['сундук', 'полка', 'стол'], home: 'D2' },
  ],
  YEARS: ['1975', '1992', '2024'],
  // свет по времени суток: утро, день, вечер, закат (финал)
  TIMES: [
    { sun: '#ffd9a8', si: 2.1, sky: '#9fb0ff', gnd: '#5a3e2c', hi: 1.25, glass: '#ffe8b0', beam: 0.16 },
    { sun: '#fff2dc', si: 2.5, sky: '#b4c4ff', gnd: '#6a4a34', hi: 1.35, glass: '#fff8e8', beam: 0.19 },
    { sun: '#ff9f5a', si: 2.1, sky: '#b8a8e0', gnd: '#5a3a2e', hi: 1.1, glass: '#ffa060', beam: 0.2 },
    { sun: '#ff7a48', si: 1.7, sky: '#a090d0', gnd: '#4a2e26', hi: 0.95, glass: '#ff7a50', beam: 0.18 },
  ],
  PICK: { x: 0.95, z: 2.05 }, // где стоит открытая коробка
  HATCH: { x: 3.4, z: 2.4 },
  BOUNDS: { x0: -4.7, x1: 4.6, z0: -3.2, z1: 3.2 },

  /* ---------------- партия ---------------- */
  start(lab, scene) {
    const st = lab.state, c = lab.cfg, T = lab.THREE;
    const mode = c.inspect > 0 ? 'inspect' : c.find > 0 ? 'find' : 'boxes';
    Object.assign(st, {
      mode, story: c.secret > 0, phase: 'play', hand: null, slots: [], items: [], box: 0, placed: 0, queue: [], loose: [],
      streak: 0, best: 0, lastPut: -99, fails: 0, holdT: 0, hint: -1, wrongs: 0, stories: 0, looked: 0, found: 0,
      look: null, banner: false, ended: false, pastOn: false, ghosts: null, letterIn: false, letterOut: false, posterOn: null,
      nearSlot: -1, pick: null, flash: {}, fixing: false, boxN: Math.round(c.boxes), tipT: 0, kick: 0, endAt: 0,
      vel: new T.Vector3(), hp: new T.Vector3(0.75, 1.2, 1.7), handY: 1.2,
      tmp: { m: new T.Matrix4(), q: new T.Quaternion(), e: new T.Euler(), v: new T.Vector3(), s: new T.Vector3(), c: new T.Color(), zero: new T.Matrix4().makeScale(0, 0, 0) },
    });
    lab.setCamera('diorama', { tilt: 0.92, turn: 0.6, target: [-0.1, 0.9, -0.45], fov: 0.6 });
    const v = lab.view;
    v.distance *= 0.8; // поле вписано по углам пола — ближе: комната крупнее, края пола чуть за кадром
    st.cam0 = { turn: v.turn, tilt: v.tilt, dist: v.distance, target: v.target.clone() };
    st.cam = { turn: v.turn, tilt: v.tilt, dist: v.distance, target: v.target.clone() };
    lab.light.sun.userData.dir.set(-0.55, 0.75, 0.37).normalize(); // солнце — слева, со стороны круглого окна, и чуть спереди: освещены стороны вещей, обращённые к камере
    this.room(lab, scene);
    this.makeSlots(lab);
    this.makeHand(lab);
    this.makeItems(lab);
    this.makeMarkers(lab);
    if (mode === 'boxes') this.makeBoxes(lab);
    if (mode === 'boxes' && st.story) { // первая чашка уже стоит на столике: одна — пока он один
      const cup = st.items.find(it => it.k === 'cup1'), s = this.slotBy(st, 'T1');
      if (cup) { cup.state = 'placed'; cup.slot = s; s.item = cup; cup.checked = true; cup.node.visible = true; cup.node.position.copy(s.pos); cup.node.rotation.set(0, s.face, 0); }
    }
    if (mode === 'find') this.makeFind(lab);
    if (mode === 'inspect') this.makeInspect(lab);
    if (c.cat > 0) this.makeCat(lab);
    this.makeSpot(lab);
    this.makeSepia(lab);
    this.setTime(lab, 0);
    lab.hero(st.handG);
    lab.stat('истории', 0);
    if (mode === 'boxes') this.openBox(lab, 0, true);
    this.handStep(lab, 0);
    this.markersStep(lab);
    if (!lab.playing) this.poster(lab);
  },
  // афиша в меню: комната наполовину рассказана, рука несёт детский рисунок к его месту над тахтой. Первый кадр партии всё возвращает
  poster(lab) {
    const st = lab.state, T = lab.THREE, P = { hp: st.hp.clone() };
    st.posterOn = P;
    const dr = st.items.find(i => i.k === 'drawing');
    if (st.mode === 'boxes' && st.story && dr) {
      const g = P.g = new T.Group(); lab.scene.add(g);
      for (const it of st.items) {
        if (it.box > 1 || it.k === 'drawing' || it.k === 'oldletter') continue;
        const s = this.slotBy(st, it.home), n = it.node.clone();
        n.visible = true; n.position.copy(s.pos); n.rotation.set(0, s.face, 0); n.scale.setScalar(lab.cfg.big);
        g.add(n);
      }
      const w4 = this.slotBy(st, 'W4');
      st.hp.set(w4.rx - 0.35, 2.05, w4.rz + 0.55);
      const held = dr.node.clone(); held.visible = true; held.scale.setScalar(lab.cfg.big * 1.15);
      held.position.set(st.hp.x, st.hp.y - 0.75, st.hp.z); held.rotation.set(0.1, -0.35, 0.05);
      g.add(held);
      P.mark = w4.i;
      this.setTime(lab, 1.55);
    } else st.hp.set(-1.4, 1.3, 0.4);
    this.handStep(lab, 0);
    this.markersStep(lab);
  },
  unposter(lab) {
    const st = lab.state, P = st.posterOn;
    st.posterOn = null;
    if (P.g) P.g.removeFromParent();
    st.hp.copy(P.hp);
    this.setTime(lab, this.timeOf(lab, st.box));
  },
  // имя вариации: все включённые ручки вариаций
  variant(lab) {
    const c = lab.cfg, on = this.VARIANTS.filter(v => (v.on ? v.on(c) : c[v.key] > 0));
    if (!on.length) return { name: 'Классика', how: 'разложи вещи по местам — и пойми, что здесь было' };
    return { name: on.map(v => v.name).join(' + '), how: on.map(v => v.how(c)).join('; ') };
  },

  update(lab, dt) {
    const st = lab.state, c = lab.cfg, p = lab.p1;
    if (st.posterOn) this.unposter(lab);
    if (!st.banner) { // имя вариации и её правило крупно в начале партии
      st.banner = true;
      const v = this.variant(lab);
      lab.popup([-0.4, 3.0, 0.2], v.name, '#ffe0a0', 32);
      lab.after(0.35, () => lab.popup([-0.4, 2.3, 0.2], v.how, '#ffffff', 16));
    }
    const v = this.variant(lab);
    lab.hud('rule', `${v.name}: ${v.how}`, { color: '#ffe0a0', size: 14 });
    this.clock(lab);
    if (st.ended) return;
    if (c.past > 0 && p.pressed.b && st.phase !== 'final') this.pastToggle(lab);
    else if (!(c.past > 0) && st.pastOn) this.pastToggle(lab);
    if (st.look) this.lookStep(lab, dt);
    else if (st.phase === 'play') {
      this.moveHand(lab, dt);
      this.nearStep(lab);
      if (p.pressed.a) this.pressA(lab);
      else if (p.pressed.b && !(c.past > 0)) this.pressB(lab);
      if (st.hand) { st.holdT += dt; st.emptyT = 0; this.hintStep(lab); } else st.emptyT = (st.emptyT || 0) + dt;
      if (st.mode === 'boxes') this.boxCheck(lab);
    }
    if (st.phase === 'show') this.showStep(lab, dt);
    if (st.cat) this.catStep(lab, dt);
    this.handStep(lab, dt);
    this.ambient(lab, dt);
    this.markersStep(lab);
    this.cameraStep(lab, dt);
    this.pastStep(lab, dt);
    this.hudStep(lab);
  },
  // время на партию
  clock(lab) {
    const st = lab.state, c = lab.cfg;
    if (!(c.limit > 0) || st.ended || st.phase === 'final') { lab.hud('time', null); return; }
    const left = c.limit - lab.t;
    lab.hud('time', `Время: ${Math.max(0, Math.ceil(left))} с`, { color: left < 10 ? '#ff7a6b' : '#ffffff', size: 18 });
    if (left <= 0) {
      st.ended = true; lab.count('время вышло');
      lab.gameOver(st.mode === 'find' ? `Время вышло: найдено ${st.found} вещей` : st.mode === 'inspect' ? `Время вышло: осмотрено ${st.looked} вещей` : `Время вышло: на местах ${this.onPlace(lab)} вещей`);
    }
  },
  hudStep(lab) {
    const st = lab.state, c = lab.cfg, mult = this.mult(lab);
    if (st.mode === 'boxes') lab.hud('box', st.phase === 'final' ? 'Чердак разобран' : `Коробка ${st.box + 1} из ${st.boxN}` + (st.queue.length ? ` · вещей в ней: ${st.queue.length}` : ''), { color: '#f3e3c3', size: 16 });
    else if (st.mode === 'find') lab.hud('box', `Найди вещь: ${Math.min(st.found + 1, st.targets.length)} из ${st.targets.length}`, { color: '#f3e3c3', size: 16 });
    else lab.hud('box', st.story ? `Найдено историй: ${st.found} из ${st.goal}` : `Осмотрено вещей: ${st.found} из ${st.goal}`, { color: '#f3e3c3', size: 16 });
    lab.hud('combo', mult > 1 && lab.t - st.lastPut <= c.comboTime ? `Серия ×${mult}` : null, { color: '#ffd27a', size: 22 });
    let tip = null;
    if (st.phase === 'show') tip = `Запомни, где что стоит: ${Math.max(1, Math.ceil(st.showT))}`;
    else if (st.fixing) tip = 'Красные вещи — не на своих местах: возьми и переложи';
    else if (st.loose.length) tip = 'Вещь на полу — подбери её (A) и верни на место';
    else if (st.mode === 'boxes' && st.placed === 0 && !st.hand && st.phase === 'play') tip = 'Подведи руку к коробке и нажми A';
    else if (st.mode === 'boxes' && st.placed < 2 && st.hand) tip = !(c.free > 0) && !(c.memory > 0) ? 'Светятся места, куда подходит вещь. A — положить, B — рассмотреть' : 'A — положить, B — рассмотреть';
    else if (st.mode === 'inspect' && st.looked === 0) tip = 'Подведи руку к вещи и нажми A или B';
    else if (st.mode === 'find' && st.found === 0 && lab.t < 12) tip = 'Над коробкой — силуэт. Найди эту вещь и нажми на ней A';
    lab.hud('tip', tip, { color: '#cfe9ff', size: 15 });
  },

  /* ---------------- рука ---------------- */
  moveHand(lab, dt) {
    const st = lab.state, c = lab.cfg, p = lab.p1, B = this.BOUNDS, tu = st.cam0.turn;
    let ix = p.x || 0, iy = p.y || 0;
    const m = Math.hypot(ix, iy); if (m > 1) { ix /= m; iy /= m; }
    // ось экрана → пол: «вправо по экрану» и «вверх по экрану» при повороте камеры
    let wx = (Math.cos(tu) * ix - Math.sin(tu) * iy) * c.speed, wz = (-Math.sin(tu) * ix - Math.cos(tu) * iy) * c.speed;
    const H = this.hintTarget(lab);
    if (H && m > 0.2 && c.pull > 0) { // подсказка клонит руку к месту, пока игрок ведёт руку
      const dx = H.x - st.hp.x, dz = H.z - st.hp.z, d = Math.hypot(dx, dz);
      if (d > 0.15) { wx += dx / d * c.pull; wz += dz / d * c.pull; }
    }
    st.vel.x = lab.damp(st.vel.x, wx, c.accel, dt); st.vel.z = lab.damp(st.vel.z, wz, c.accel, dt);
    st.hp.x = lab.clamp(st.hp.x + st.vel.x * dt, B.x0, B.x1);
    st.hp.z = lab.clamp(st.hp.z + st.vel.z * dt, B.z0, B.z1);
  },
  // рука, её кольцо на полу и вещь в руке
  handStep(lab, dt) {
    const st = lab.state, c = lab.cfg, it = st.hand;
    let want = 1.15;
    if (st.phase === 'play' && !st.look) {
      if (it && st.nearSlot >= 0) { const s = st.slots[st.nearSlot]; want = Math.max(1.0, s.pos.y + 0.45 + it.h * c.big); }
      else if (it) want = 1.0 + it.h * c.big * 0.6;
      else if (st.pick) want = Math.max(1.0, (st.pick.y || 0) + 0.85);
    }
    if (st.posterOn && dt === 0) want = st.hp.y;
    st.handY = dt > 0 ? lab.damp(st.handY, want, 7, dt) : want;
    const bob = Math.sin(lab.t * 3.1) * 0.035;
    st.handG.position.set(st.hp.x, st.handY + bob, st.hp.z);
    st.handG.rotation.set(0.28 + st.vel.z * 0.03, st.cam0.turn - st.vel.x * 0.03, -st.vel.x * 0.04);
    st.ringG.position.set(st.hp.x, 0.07, st.hp.z);
    st.ringG.scale.setScalar(1 + Math.sin(lab.t * 5) * 0.05);
    if (it && !it.flying) {
      const lk = st.look && st.look.held ? st.look : null;
      it.node.position.set(st.hp.x, st.handY + bob - 0.42 - it.h * c.big + (lk ? 0.25 : 0), st.hp.z);
      it.node.rotation.y += dt * (lk ? 2.4 : 1.1);
      it.node.rotation.x = lab.damp(it.node.rotation.x, 0, 6, dt); it.node.rotation.z = lab.damp(it.node.rotation.z, 0, 6, dt);
    }
  },
  // что под рукой: место для вещи в руке или то, что можно взять
  nearStep(lab) {
    const st = lab.state, c = lab.cfg, R = c.reach, it = st.hand, hx = st.hp.x, hz = st.hp.z;
    st.nearSlot = -1; st.pick = null;
    if (it) {
      let best = -1, bd = 1e9, fit = -1, fd = 1e9;
      const loose = this.noFit(lab, it);
      st.slots.forEach((s, i) => {
        if (s.item || s.gone) return;
        const d = Math.hypot(hx - s.rx, hz - s.rz); if (d > (i === st.hint ? R * 1.6 : R)) return; // место-подсказка ловит руку дальше
        if (d < bd) { bd = d; best = i; }
        if ((loose || this.fits(lab, it, s)) && d < fd) { fd = d; fit = i; }
      });
      // с подсветкой из ближних мест выбирается подходящее; без подсказок и по памяти — просто ближайшее
      st.nearSlot = !(c.free > 0) && !(c.memory > 0) && fit >= 0 ? fit : best;
      return;
    }
    const cand = [];
    if (st.mode === 'boxes' && st.queue.length && st.boxObj) cand.push({ kind: 'box', x: this.PICK.x, z: this.PICK.z, y: 0.6, bonus: st.emptyT > 2 ? 0.8 : 0.35 });
    for (const l of st.loose) cand.push({ kind: 'loose', it: l, x: l.node.position.x, z: l.node.position.z, y: 0.1 });
    for (const w of st.items) if (w.wrong && w.slot) cand.push({ kind: 'wrong', it: w, x: w.slot.rx, z: w.slot.rz, y: w.slot.pos.y });
    if (st.letterIn && !st.letterOut && st.garmon && st.garmon.state === 'placed') { const s = st.garmon.slot; cand.push({ kind: 'letter', it: st.garmon, x: s.rx, z: s.rz, y: s.pos.y, bonus: 0.3 }); }
    if (st.mode === 'inspect') for (const w of st.items) if (w.state === 'placed') cand.push({ kind: 'look', it: w, x: w.slot.rx, z: w.slot.rz, y: w.slot.pos.y });
    if (st.mode === 'find') {
      for (const w of st.items) if (w.state === 'scatter') cand.push({ kind: 'find', it: w, x: w.node.position.x, z: w.node.position.z, y: w.node.position.y });
      for (const j of st.junk) cand.push({ kind: 'junk', j, x: j.x, z: j.z, y: j.y });
    }
    const r = st.mode === 'find' ? Math.max(0.45, R * 0.7) : R;
    let best = null, bd = 1e9;
    for (const q of cand) { const d = Math.hypot(hx - q.x, hz - q.z); if (d <= r + (q.bonus || 0) && d - (q.bonus || 0) < bd) { bd = d - (q.bonus || 0); best = q; } }
    st.pick = best;
  },
  pressA(lab) {
    const st = lab.state, q = st.pick;
    if (st.hand) {
      if (st.nearSlot >= 0) this.drop(lab, st.nearSlot);
      else { // рядом нет места: тихий щелчок, и это тоже промах для подсказки
        lab.tone(330, 0.05, 'sine', 0.03); lab.count('мимо мест');
        st.fails++; if (lab.cfg.hintFails > 0 && st.fails >= lab.cfg.hintFails) this.hintOn(lab);
      }
      return;
    }
    if (!q) return;
    if (q.kind === 'box') this.take(lab);
    else if (q.kind === 'loose' || q.kind === 'wrong') this.pickUp(lab, q.it);
    else if (q.kind === 'letter') this.letterOut(lab);
    else if (q.kind === 'look') this.look(lab, q.it, false);
    else if (q.kind === 'find') this.findHit(lab, q.it);
    else if (q.kind === 'junk') this.junkHit(lab, q.j);
  },
  pressB(lab) {
    const st = lab.state;
    if (st.hand) this.look(lab, st.hand, true);
    else if (st.pick && (st.pick.kind === 'look' || (st.pick.it && st.pick.it.state === 'placed'))) this.look(lab, st.pick.it, false);
  },

  /* ---------------- вещи: взять, положить, не туда ---------------- */
  // для автотеста: взять следующую вещь из текущей коробки (как A у коробки)
  take(lab) {
    const st = lab.state;
    if (st.mode !== 'boxes' || st.phase !== 'play' || st.hand || !st.queue.length || st.ended) return null;
    const it = st.queue.shift();
    this.toHand(lab, it, true);
    this.peek(lab);
    lab.noise(0.08, 0.06, 1800); lab.tone(520, 0.1, 'triangle', 0.07, 820); // шорох картона и «оп»
    lab.burst([this.PICK.x, 0.75, this.PICK.z], { count: 8, colors: ['#e8cfa0', '#c8955a'], speed: 1.6, up: 1.2, size: 0.07, gravity: 3 });
    if (st.boxObj) lab.pulse(st.boxObj.g, 1.08, 0.16);
    return it;
  },
  toHand(lab, it, jump) {
    const st = lab.state, c = lab.cfg;
    st.hand = it; it.state = 'hand'; it.node.visible = true; st.holdT = 0; st.fails = 0; st.hint = -1;
    it.node.scale.setScalar(c.big); this.move(it); it.flying = false;
    if (jump) { // вещь выпрыгивает к руке и повисает, крутясь
      it.flying = true;
      const a = it.node.position.clone(), id = this.move(it);
      lab.tween(0.3, (k, raw = 0) => {
        if (it.mv !== id) return; // вещь уже кладут или сбили — этот полёт отменён
        const b = this.holdPos(lab, it);
        it.node.position.lerpVectors(a, b, k); it.node.position.y += Math.sin(Math.PI * raw) * 0.6;
        it.node.rotation.y += 0.25;
        if (raw >= 1) it.flying = false;
      }, 'outCubic');
    }
    lab.pulse(st.handG, 1.15, 0.14);
  },
  move(it) { it.mv = (it.mv || 0) + 1; return it.mv; }, // каждое новое движение вещи отменяет прежние твины
  holdPos(lab, it) { const st = lab.state; return new lab.THREE.Vector3(st.hp.x, st.handY - 0.42 - it.h * lab.cfg.big, st.hp.z); },
  pickUp(lab, it) { // подобрать вещь с пола (кот) или красную (без подсказок)
    const st = lab.state;
    if (it.slot) { it.slot.item = null; it.slot = null; }
    st.loose = st.loose.filter(l => l !== it);
    it.wrong = false; it.checked = false;
    if (st.fixing && !st.items.some(w => w.wrong)) st.fixing = false;
    this.toHand(lab, it, true);
    lab.tone(440, 0.08, 'triangle', 0.06, 660);
  },
  // правильно ли вещи стоять на этом месте
  fits(lab, it, s) {
    if (!s || s.gone) return false;
    if (lab.cfg.memory > 0) return s.key === it.home;
    if (it.storyKey) return s.key === it.storyKey;
    if (s.excl) return false; // место вещи-истории
    return it.types.includes(s.type);
  },
  noFit(lab, it) { return !lab.state.slots.some(s => !s.item && this.fits(lab, it, s)); }, // ни одного подходящего свободного места
  // для автотеста и бота: индекс подходящего свободного места для вещи в руке (ближайшего к руке)
  rightSlot(lab) {
    const st = lab.state, it = st.hand;
    if (!it) return -1;
    const near = ok => { let b = -1, bd = 1e9; st.slots.forEach((s, i) => { if (s.item || s.gone || !ok(s)) return; const d = Math.hypot(st.hp.x - s.rx, st.hp.z - s.rz); if (d < bd) { bd = d; b = i; } }); return b; };
    const r = near(s => this.fits(lab, it, s));
    return r >= 0 ? r : near(() => true); // подходящего нет — годится любое свободное: партия не застревает
  },
  // для автотеста: положить вещь из руки в место slots[i]; true — легла
  drop(lab, i) {
    const st = lab.state, c = lab.cfg, it = st.hand, s = st.slots[i];
    if (!it || !s || s.item || s.gone || st.phase !== 'play' || st.ended) return false;
    const ok = c.free > 0 || this.fits(lab, it, s) || this.noFit(lab, it);
    if (!ok) { this.wrong(lab, it, s); return false; }
    this.put(lab, it, s);
    return true;
  },
  put(lab, it, s) {
    const st = lab.state, c = lab.cfg;
    if (st.look) this.lookEnd(lab);
    st.hand = null; it.state = 'placed'; it.slot = s; s.item = it; it.checked = false; it.flying = true;
    st.placed++; lab.count('вещи'); st.fails = 0; st.hint = -1; st.holdT = 0;
    const res = !(c.free > 0) ? this.score(lab, it, s) : null;
    const a = it.node.position.clone(), r0 = it.node.rotation.y % (Math.PI * 2), face = s.face, id = this.move(it);
    lab.tween(0.16, (k, raw = 0) => {
      if (it.mv !== id) return;
      it.node.position.lerpVectors(a, s.pos, k);
      it.node.rotation.set(0, lab.lerp(r0, face + Math.round((r0 - face) / (Math.PI * 2)) * Math.PI * 2, k), 0);
      if (raw >= 1) { it.flying = false; it.node.position.copy(s.pos); it.node.rotation.set(0, face, 0); this.landFx(lab, it, s, res); }
    }, 'inQuad');
  },
  mult(lab) { return Math.min(4, 1 + Math.floor(lab.state.streak / 3)); },
  // очки за вещь на месте; вещь-история на своём месте — +25 и комната «говорит»
  score(lab, it, s) {
    const st = lab.state, c = lab.cfg;
    const tell = st.story && it.storyKey === s.key && !it.told;
    st.streak = lab.t - st.lastPut <= c.comboTime ? st.streak + 1 : 1;
    st.lastPut = lab.t; st.best = Math.max(st.best, st.streak);
    const mult = this.mult(lab), pts = (tell ? 25 : 10) * mult;
    lab.addScore(pts);
    it.checked = true;
    if (tell) { it.told = true; this.storyHit(lab); }
    return { pts, mult, tell };
  },
  storyHit(lab) { // спрятанная механика: вещь-история встала на место или комната изменилась между временами
    const st = lab.state;
    st.stories++;
    lab.count('_secret'); lab.count('истории'); lab.stat('истории', st.stories);
  },
  landFx(lab, it, s, res) {
    const st = lab.state, P = s.pos, top = [P.x, P.y + it.h * lab.cfg.big + 0.25, P.z];
    lab.noise(0.035, 0.12, 2600); // щелчок
    lab.burst([P.x, P.y + 0.05, P.z], { count: 10, colors: ['#e8d8b8', '#cbb48e', '#fff4d8'], speed: 1.6, up: 0.7, gravity: 2.5, size: 0.08, life: 0.9 });
    lab.pulse(it.node, 1.2, 0.18);
    if (!res) { lab.tone(300, 0.08, 'triangle', 0.05); return; } // без подсказок — просто положил, оценка в конце коробки
    const f = 392 * lab.pitch(Math.max(0, st.streak - 1)); // нота выше с каждой вещью подряд
    lab.tone(f, 0.22, 'triangle', 0.1); lab.tone(f * 2, 0.16, 'sine', 0.03, 0, 0.03);
    lab.popup(top, res.mult > 1 ? `+${res.pts} ×${res.mult}` : `+${res.pts}`, res.tell ? '#ffb36b' : '#ffd27a', 18 + Math.min(res.mult, 4) * 2);
    if (res.mult > 1 && st.streak % 3 === 0) { lab.ring([P.x, 0.02, P.z], { color: '#ffd27a', radius: 1.4, life: 0.4 }); lab.sfx.coin(); }
    if (res.tell) this.storyFx(lab, it, f);
  },
  // вещь «оживает»: тёплая вспышка, волна света по полу, аккорд, окно на миг ярче
  storyFx(lab, it, f) {
    const st = lab.state, P = it.node.position;
    lab.hitstop(0.05); lab.flash('#ffcf8a', 0.12); lab.shake(0.12);
    lab.ring([P.x, 0.03, P.z], { color: '#ffb36b', radius: 2.6, life: 0.7 });
    lab.burst([P.x, P.y + 0.3, P.z], { count: 22, colors: ['#ffd27a', '#ffb36b', '#ffffff'], speed: 2.6, up: 1.4, gravity: 1.2, size: 0.09, life: 1.1 });
    [1, 1.25, 1.5, 2].forEach((m, k) => lab.tone((f || 392) * m, 0.5, 'sine', 0.06, 0, 0.06 + k * 0.07));
    this.glowItem(lab, it, '#ffb36b', 1.1, 1.4);
    st.kick = 1;
  },
  glowItem(lab, it, color, k, sec) {
    const m = it.mats[0];
    m.emissive.set(color);
    lab.tween(sec, q => { m.emissiveIntensity = k * (1 - q); }, 'outCubic');
  },
  wrong(lab, it, s) {
    const st = lab.state, c = lab.cfg;
    st.fails++; st.wrongs++; st.streak = 0;
    lab.count('не туда');
    lab.whiten(it.node, 0.2, '#ff4d5e');
    lab.tween(0.35, q => { it.node.rotation.z = Math.sin(q * Math.PI * 6) * 0.3 * (1 - q); }, 'linear');
    lab.tone(190, 0.12, 'square', 0.05, 150); lab.tone(170, 0.14, 'square', 0.05, 120, 0.09);
    lab.shake(0.08); lab.vibrate(60, 0.3);
    st.flash[s.i] = lab.t;
    if (c.hintFails > 0 && st.fails >= c.hintFails) this.hintOn(lab);
  },
  // подсказка: своё место вещи мигает (после промахов подряд или долгого держания)
  hintStep(lab) {
    const st = lab.state, c = lab.cfg;
    if (st.hint >= 0) { const s = st.slots[st.hint]; if (s.item || s.gone) st.hint = -1; }
    if (st.hint < 0 && c.hintTime > 0 && st.holdT >= c.hintTime) this.hintOn(lab);
  },
  hintOn(lab) {
    const st = lab.state;
    if (lab.cfg.free > 0 || st.hint >= 0 || !st.hand) return;
    const i = this.rightSlot(lab);
    if (i < 0) return;
    st.hint = i; lab.count('подсказки');
    [880, 1175].forEach((f, k) => lab.tone(f, 0.12, 'sine', 0.04, 0, k * 0.08));
  },
  hintTarget(lab) {
    const st = lab.state;
    if (st.hint >= 0) { const s = st.slots[st.hint]; return { x: s.rx, z: s.rz }; }
    if (st.findHint && st.mode === 'find') { const p = st.findHint.node.position; return { x: p.x, z: p.z }; }
    if (st.lookHint) { const s = st.lookHint.slot; return s ? { x: s.rx, z: s.rz } : null; }
    return this.callTarget(lab);
  },

  // пустая рука дольше 2 с: её клонит к тому, что ждёт — вещь на полу, красная вещь или коробка (кольцо мигает)
  callTarget(lab) {
    const st = lab.state;
    if (st.hand || st.mode !== 'boxes' || st.phase !== 'play' || !(st.emptyT > 2) || lab.cfg.free > 0) return null;
    const l = st.loose[0]; if (l) return { x: l.node.position.x, z: l.node.position.z };
    const w = st.items.find(it => it.wrong && it.slot); if (w) return { x: w.slot.rx, z: w.slot.rz };
    if (st.queue.length) return { x: this.PICK.x, z: this.PICK.z, box: true };
    return null;
  },

  /* ---------------- осмотр вещи (B): камера наезжает, вещь крупно крутится ---------------- */
  look(lab, it, held) {
    const st = lab.state, c = lab.cfg;
    if (st.look || !it) return;
    st.look = { it, held, t: 0, moveT: 0, pos: it.node.position.clone(), rot: it.node.rotation.y };
    lab.count('осмотрено');
    lab.tween(0.25, q => it.node.scale.setScalar(c.big * (1 + 0.75 * q)), 'outBack');
    if (!held) lab.tween(0.25, q => { it.node.position.y = st.look ? st.look.pos.y + 0.45 * q : it.node.position.y; }, 'outCubic');
    lab.tone(300, 0.25, 'sine', 0.05, 620); lab.noise(0.15, 0.03, 3000);
    if (st.mode === 'inspect' && !it.looked) this.discover(lab, it);
    else if (it.storyKey && st.story && it.told) lab.tone(1046, 0.4, 'sine', 0.03, 0, 0.1); // история узнана — тихий звон
  },
  lookStep(lab, dt) {
    const st = lab.state, c = lab.cfg, L = st.look, p = lab.p1;
    L.t += dt;
    if (!L.held) { L.it.node.rotation.y += dt * 2.2; }
    if (Math.hypot(p.x || 0, p.y || 0) > 0.3) L.moveT += dt; else L.moveT = 0;
    if (L.t > 0.15 && (p.pressed.a || (p.pressed.b && !(c.past > 0)) || L.t >= c.inspectTime || L.moveT > 0.25)) this.lookEnd(lab);
  },
  lookEnd(lab) {
    const st = lab.state, c = lab.cfg, L = st.look;
    if (!L) return;
    st.look = null;
    const n = L.it.node, s0 = n.scale.x;
    lab.tween(0.2, q => n.scale.setScalar(lab.lerp(s0, c.big, q)), 'outCubic');
    if (!L.held && L.it.state === 'placed') { const y0 = n.position.y; lab.tween(0.2, q => { if (L.it.state !== 'placed') return; n.position.y = lab.lerp(y0, L.pos.y, q); if (q >= 1 && L.it.slot && L.it.state === 'placed') n.rotation.set(0, L.it.slot.face, 0); }, 'outCubic'); }
  },
  // «Осмотр»: вещь-история при первом осмотре вспыхивает и даёт очки
  discover(lab, it) {
    const st = lab.state;
    it.looked = true; st.looked++;
    const isGoal = st.story ? !!it.storyKey : true;
    if (!isGoal) { lab.addScore(3, it.node.position, '#ffffff'); lab.tone(520, 0.1, 'triangle', 0.05); return; }
    st.found++; st.lookHint = null; st.lookT = lab.t;
    st.streak = lab.t - st.lastPut <= 12 ? st.streak + 1 : 1; st.lastPut = lab.t; st.best = Math.max(st.best, st.streak);
    const pts = (st.story ? 25 : 10) * this.mult(lab);
    lab.addScore(pts); lab.popup([it.node.position.x, it.node.position.y + 1, it.node.position.z], `+${pts}`, '#ffb36b', 22);
    if (st.story) { it.told = true; this.storyHit(lab); this.storyFx(lab, it, 392 * lab.pitch(st.found)); }
    else { lab.sfx.coin(); this.glowItem(lab, it, '#ffd27a', 0.8, 1); }
    if (st.found >= st.goal) lab.after(1.2, () => this.finale(lab));
  },

  /* ---------------- коробки ---------------- */
  timeOf(lab, b) { const n = lab.state.boxN; return n <= 1 ? 0 : b * 2 / (n - 1); },
  openBox(lab, b, first) {
    const st = lab.state, c = lab.cfg, B = st.boxObjs[b];
    st.box = b; st.boxObj = B;
    st.queue = st.items.filter(it => it.box === b && it.k !== 'oldletter' && it.state === 'box');
    const P = this.PICK;
    if (first) { B.g.position.set(P.x, 0, P.z); B.flaps.forEach((f, i) => { f.rotation.z = (i ? -1 : 1) * 2.1; }); }
    else {
      const a = B.g.position.clone();
      lab.tween(0.5, (k, raw = 0) => { B.g.position.set(lab.lerp(a.x, P.x, k), Math.sin(Math.PI * raw) * 0.5 + lab.lerp(a.y, 0, k), lab.lerp(a.z, P.z, k)); if (raw >= 1) lab.noise(0.1, 0.08, 500); }, 'outCubic');
      lab.after(0.45, () => lab.tween(0.35, k => B.flaps.forEach((f, i) => { f.rotation.z = (i ? -1 : 1) * 2.1 * k; }), 'outBack'));
    }
    if (c.memory > 0) { // «По памяти»: вещи коробки стоят на своих местах, потом разлетаются по коробке
      st.phase = 'show'; st.showT = c.memoryShow; st.showDone = false;
      for (const it of st.queue) { const s = this.slotBy(st, it.home); it.node.visible = true; it.node.position.copy(s.pos); it.node.rotation.set(0, s.face, 0); }
    } else this.peek(lab);
  },
  peek(lab) { // следующая вещь выглядывает из коробки
    const st = lab.state, c = lab.cfg;
    st.queue.forEach((it, i) => { it.node.visible = i === 0; });
    const it = st.queue[0];
    if (!it) return;
    it.node.position.set(this.PICK.x, 0.42 - it.h * c.big * 0.35, this.PICK.z);
    it.node.rotation.set(0, 0.5, 0);
    it.node.scale.setScalar(0.001);
    const id = this.move(it);
    lab.tween(0.25, k => { if (it.mv === id) it.node.scale.setScalar(c.big * 0.85 * Math.max(0.001, k)); }, 'outBack');
  },
  showStep(lab, dt) {
    const st = lab.state, c = lab.cfg;
    st.showT -= dt;
    if (st.showT > 0 || st.showDone) return;
    st.showDone = true;
    lab.sfx.whoosh();
    const P = this.PICK;
    st.queue.forEach((it, i) => lab.after(i * 0.08, () => {
      const a = it.node.position.clone();
      lab.tween(0.45, (k, raw = 0) => { it.node.position.set(lab.lerp(a.x, P.x, k), lab.lerp(a.y, 0.4, k) + Math.sin(Math.PI * raw) * 1.2, lab.lerp(a.z, P.z, k)); it.node.rotation.y += 0.2; it.node.scale.setScalar(c.big * (1 - 0.6 * k)); }, 'inOutQuad');
    }));
    lab.after(st.queue.length * 0.08 + 0.5, () => { if (st.phase === 'show') { st.phase = 'play'; this.peek(lab); } });
  },
  // коробка разобрана? Без подсказок — сначала проверка: вещи не на местах краснеют
  boxCheck(lab) {
    const st = lab.state, c = lab.cfg;
    if (st.hand || st.queue.length || st.loose.length || st.phase !== 'play') return;
    const placed = st.items.filter(it => it.state === 'placed');
    if (c.free > 0) {
      const fresh = placed.filter(it => !it.checked && !it.wrong);
      if (fresh.length) {
        let bad = 0;
        for (const it of fresh) {
          if (this.fits(lab, it, it.slot) || this.noFit(lab, it)) {
            it.checked = true;
            const res = this.score(lab, it, it.slot);
            lab.popup([it.slot.pos.x, it.slot.pos.y + it.h * c.big + 0.3, it.slot.pos.z], `+${res.pts}`, res.tell ? '#ffb36b' : '#ffd27a', 18);
            if (res.tell) this.storyFx(lab, it);
          } else { it.wrong = true; bad++; lab.count('не туда'); st.wrongs++; }
        }
        if (bad) { st.fixing = true; st.streak = 0; lab.sfx.warn(); lab.shake(0.1); } else lab.sfx.coin();
        return;
      }
      if (placed.some(it => it.wrong)) return;
      st.fixing = false;
    }
    this.boxEnd(lab);
  },
  boxEnd(lab) {
    const st = lab.state, B = st.boxObj, H = this.HATCH;
    st.phase = 'trans'; st.hint = -1; lab.count('коробки');
    [523, 659, 784, 1046].forEach((f, k) => lab.tone(f, 0.25, 'triangle', 0.08, 0, k * 0.09));
    lab.burst([this.PICK.x, 0.8, this.PICK.z], { count: 18, colors: ['#ffd27a', '#ffffff', '#c8955a'], speed: 3, up: 2, size: 0.09 });
    // пустая коробка складывается и уходит в люк
    lab.tween(0.3, k => B.flaps.forEach((f, i) => { f.rotation.z = (i ? -1 : 1) * 2.1 * (1 - k); }));
    const a = B.g.position.clone();
    lab.after(0.3, () => lab.tween(0.7, (k, raw = 0) => { B.g.position.set(lab.lerp(a.x, H.x, k), Math.sin(Math.PI * raw) * 0.6 - k * k * 1.5, lab.lerp(a.z, H.z, k)); B.g.scale.setScalar(Math.max(0.001, 1 - k * 0.7)); if (raw >= 1) B.g.visible = false; }, 'inOutQuad'));
    if (st.box + 1 >= st.boxN) { lab.after(1.1, () => this.finale(lab)); return; }
    this.passTime(lab, st.box + 1);
  },
  // «прошло время»: камера отъезжает, свет в окне меняется, комната стареет (со спрятанной механикой — и меняется)
  passTime(lab, nb) {
    const st = lab.state, c = lab.cfg, C = st.cam, C0 = st.cam0;
    C.dist = C0.dist * 1.2; C.tilt = C0.tilt + 0.05;
    lab.after(0.4, () => {
      lab.sfx.whoosh();
      for (let k = 0; k < 6; k++) lab.tone(k % 2 ? 1400 : 1800, 0.03, 'square', 0.025, 0, k * 0.28); // тик-так
      lab.popup([-0.4, 2.8, 0.2], st.story ? this.YEARS[this.yearOf(lab, nb)] : `Коробка ${nb + 1}`, '#ffe0a0', 30);
    });
    const t0 = this.timeOf(lab, st.box), t1 = this.timeOf(lab, nb);
    lab.after(0.5, () => lab.tween(2.0, k => this.setTime(lab, lab.lerp(t0, t1, k)), 'inOutCubic'));
    if (st.story) lab.after(1.1, () => this.ageRoom(lab, nb));
    lab.after(2.5, () => this.openBox(lab, nb, false));
    lab.after(3.1, () => { C.dist = C0.dist; C.tilt = C0.tilt; if (st.phase === 'trans') st.phase = 'play'; if (c.memory > 0 && st.phase === 'play') st.phase = 'show'; });
  },
  yearOf(lab, b) { const n = lab.state.boxN; return n >= 3 ? b : n === 2 ? (b ? 2 : 0) : 0; },
  // комната меняется между временами: выцветает, пылится, вторая чашка исчезает, письмо прячется в гармонь
  ageRoom(lab, nb) {
    const st = lab.state, hits = [];
    const hit = () => { const k = hits.length; hits.push(k); lab.after(k * 0.4, () => this.storyHit(lab)); }; // перемены — по одной, с паузой
    const find = k => st.items.find(it => it.k === k && it.state === 'placed');
    const fade = (it, k) => { if (!it) return; const from = it.age || 0, to = Math.min(0.7, from + k); it.age = to; lab.tween(1.2, q => this.tint(it, lab.lerp(from, to, q))); lab.burst([it.node.position.x, it.node.position.y + 0.3, it.node.position.z], { count: 8, colors: ['#d8ccb4', '#a89a80'], speed: 0.8, up: 0.3, gravity: 0.6, size: 0.06, life: 1.4 }); };
    if (nb === 1) {
      const ph = find('photo1'); if (ph) { fade(ph, 0.35); hit(); }
      const old = ['papakha', 'garmon', 'poems'].map(find).filter(Boolean); if (old.length) { old.forEach(it => fade(it, 0.25)); hit(); }
      lab.tone(330, 0.6, 'sine', 0.05); lab.tone(392, 0.6, 'sine', 0.04, 0, 0.15);
    }
    if (nb === 2) {
      const cup = find('cup2');
      if (cup) { // вторая чашка исчезает — её место пустеет, остаётся пыль и одна пылинка
        const s = cup.slot;
        lab.burst([s.pos.x, s.pos.y + 0.2, s.pos.z], { count: 14, colors: ['#bdb3a0', '#8a8070'], speed: 1, up: 0.6, gravity: 0.4, size: 0.07, life: 1.6 });
        lab.tween(0.9, q => cup.node.scale.setScalar(Math.max(0.001, lab.cfg.big * (1 - q))), 'inCubic');
        lab.after(0.95, () => { cup.node.visible = false; });
        cup.state = 'gone'; s.item = null; s.gone = true; cup.slot = null;
        st.goneSlot = s;
        lab.tone(262, 1.1, 'sine', 0.05); lab.tone(311, 1.1, 'sine', 0.04, 0, 0.2);
        hit();
      }
      const let1 = find('letter'), gar = st.garmon && st.garmon.state === 'placed' ? st.garmon : null;
      if (let1 && gar) { // старое письмо прячется в гармонь
        const s = let1.slot, a = let1.node.position.clone(), b = gar.node.position.clone().add(new lab.THREE.Vector3(0, 0.3, 0));
        s.item = null; let1.slot = null; let1.state = 'gone';
        lab.after(0.5, () => lab.tween(0.8, (k, raw = 0) => { let1.node.position.lerpVectors(a, b, k); let1.node.position.y += Math.sin(Math.PI * raw) * 0.8; let1.node.scale.setScalar(Math.max(0.001, lab.cfg.big * (1 - 0.8 * k))); if (raw >= 1) { let1.node.visible = false; gar.corner.visible = true; lab.pulse(gar.node, 1.15, 0.2); } }, 'inOutQuad'));
        st.letterIn = true;
        hit();
      }
      const fam = ['wedding', 'drawing', 'horse'].map(find).filter(Boolean); if (fam.length) { fam.forEach(it => fade(it, 0.25)); hit(); }
      ['photo1', 'papakha', 'garmon', 'poems'].map(find).forEach(it => fade(it, 0.15));
    }
  },
  tint(it, k) { const st = it.mats; for (const m of st) m.color.setRGB(1 - 0.18 * k, 1 - 0.26 * k, 1 - 0.4 * k); }, // выцветание к сепии
  // спрятанное: в третьем времени в гармони находится старое письмо — его место рядом с фото юноши и девушки
  letterOut(lab) {
    const st = lab.state, it = st.oldletter;
    if (!it || st.letterOut) return;
    st.letterOut = true; st.garmon.corner.visible = false;
    it.node.visible = true; it.node.position.copy(st.garmon.node.position); it.node.position.y += 0.3;
    this.toHand(lab, it, true);
    lab.count('письмо из гармони');
    [523, 659, 784, 988, 1175].forEach((f, k) => lab.tone(f, 0.3, 'sine', 0.05, 0, k * 0.09)); // музыкальная шкатулка
    lab.burst(st.garmon.node.position, { count: 12, colors: ['#ffd27a', '#fff4d8'], speed: 1.5, up: 1.2, size: 0.07 });
    lab.pulse(st.garmon.node, 1.15, 0.2);
  },
  // финал: камера медленно проезжает по комнате в закатном свете, истории вспыхивают по очереди
  finale(lab) {
    const st = lab.state, C = st.cam, C0 = st.cam0;
    if (st.phase === 'final' || st.ended) return;
    st.phase = 'final'; st.hint = -1; st.pick = null; st.nearSlot = -1;
    if (st.look) this.lookEnd(lab);
    const t0 = st.timeNow || 0;
    lab.tween(3, k => this.setTime(lab, lab.lerp(t0, 3, k)), 'inOutCubic');
    lab.tween(5, k => {
      C.turn = C0.turn - 0.55 * Math.sin(k * Math.PI * 0.5);
      C.dist = C0.dist * lab.lerp(1, 0.72, Math.sin(k * Math.PI));
      C.target.set(lab.lerp(-2.4, 1.8, k), C0.target.y, lab.lerp(-0.8, -1.4, k));
    }, 'inOutCubic');
    [392, 494, 587, 784].forEach((f, k) => lab.tone(f, 0.9, 'triangle', 0.06, 0, k * 0.25));
    const told = st.items.filter(it => it.told && it.state === 'placed');
    told.forEach((it, i) => lab.after(0.6 + i * 0.45, () => { this.glowItem(lab, it, '#ffcf8a', 1, 0.9); lab.tone(523 * lab.pitch(i * 2), 0.4, 'sine', 0.04); lab.burst([it.node.position.x, it.node.position.y + 0.3, it.node.position.z], { count: 8, colors: ['#ffd27a', '#ffffff'], speed: 1, up: 1, size: 0.06 }); }));
    lab.after(5.3, () => {
      if (st.ended) return;
      st.ended = true;
      lab.burst([0, 1.5, 0], { count: 40, colors: ['#ffd27a', '#ffb36b', '#ffffff', '#5ef2d6'], speed: 5, up: 3 });
      const txt = st.mode === 'find' ? `Найдено ${st.found} вещей из ${st.targets.length}` : st.mode === 'inspect' ? (st.story ? `Найдено историй: ${st.found}` : `Осмотрено вещей: ${st.looked}`) : `Чердак разобран: ${this.onPlace(lab)} вещей на местах`;
      lab.win(txt);
    });
  },
  onPlace(lab) { return lab.state.items.filter(it => it.state === 'placed').length; },

  overNote(lab) {
    const st = lab.state, c = lab.cfg, v = this.variant(lab);
    return [
      v.name !== 'Классика' ? `Вариация: ${v.name} — ${v.how}` : '',
      st.mode === 'boxes' ? `Вещей на местах: ${this.onPlace(lab)}, «не туда»: ${st.wrongs}, лучшая серия: ${st.best}` : st.mode === 'find' ? `Найдено вещей: ${st.found}, мимо: ${st.wrongs}` : `Осмотрено вещей: ${st.looked}`,
      st.story ? `Комната рассказала: ${st.stories}` : 'Спрятанная механика выключена: в коробках просто вещи, комната ничего не рассказывает',
      st.story && st.letterIn && !st.letterOut ? 'В гармони что-то осталось…' : '',
      c.cat > 0 ? `Кот сбросил вещей: ${st.catN || 0}` : '',
    ].filter(Boolean);
  },

  /* ---------------- вариации: «Найди вещь» ---------------- */
  makeFind(lab) {
    const st = lab.state, c = lab.cfg, T = lab.THREE;
    const blocked = [[-0.95, 0.75, 0.1, 1.75], [0.3, 4.5, 1.4, 3.4], [1.2, 4.5, -3.6, -2.1], [-3.9, -1.3, -3.6, -2.3], [-1.1, 1.9, -3.6, -2.5], [-5, -3.8, -1.9, 0.4]];
    const pts = [];
    for (let x = -4.4; x <= 4.4; x += 0.55) for (let z = -2.1; z <= 3.1; z += 0.55) if (!blocked.some(b => x > b[0] && x < b[1] && z > b[2] && z < b[3])) pts.push([x + lab.rand(-0.12, 0.12), z + lab.rand(-0.12, 0.12)]);
    for (let i = pts.length - 1; i > 0; i--) { const j = lab.randInt(0, i); [pts[i], pts[j]] = [pts[j], pts[i]]; }
    // вещи лежат на полу среди хлама
    const items = st.items.filter(it => it.k !== 'oldletter');
    items.forEach(it => { const p = pts.pop() || [0, 0]; it.state = 'scatter'; it.node.visible = true; it.node.position.set(p[0], 0.05, p[1]); it.node.rotation.set(0, lab.rand(0, 6.28), 0); });
    // хлам — копии пяти деталей (банки, свёртки, коробочки, стопки газет, бутыли)
    const kinds = [
      [new T.CylinderGeometry(0.11, 0.11, 0.24, 8).translate(0, 0.12, 0), ['#6a8a5a', '#8a6a4a', '#5a6a8a']],
      [new T.IcosahedronGeometry(0.17, 0).scale(1.2, 0.7, 1).translate(0, 0.12, 0), ['#b8a080', '#9a8a6a', '#c8b090']],
      [new T.BoxGeometry(0.3, 0.2, 0.26).translate(0, 0.1, 0), ['#a87a4a', '#8a5a3a', '#c09060']],
      [new T.BoxGeometry(0.36, 0.14, 0.28).translate(0, 0.07, 0), ['#d8d0b8', '#c8bea0']],
      [new T.CylinderGeometry(0.06, 0.1, 0.34, 7).translate(0, 0.17, 0), ['#3a6a4a', '#5a3a2a', '#4a5a7a']],
    ];
    const N = Math.round(c.junk), per = Math.ceil(N / kinds.length);
    const extra = [[-3.0, 0.72, -3.0], [-2.3, 0.72, -2.85], [2.4, 0.5, -2.8], [3.4, 0.5, -2.9], [-4.45, 0.76, -0.6], [1.5, 0.6, -3.05], [-0.1, 0.42, 0.9], [0.4, 0.86, -3.3], [-0.4, 1.46, -3.3]];
    st.junk = [];
    kinds.forEach(([geo, cols], kk) => {
      const im = lab.instances(geo, lab.mat('#ffffff', { rough: 0.85 }), per);
      for (let i = 0; i < per && st.junk.length < N; i++) {
        let x, y = 0.05, z;
        if (extra.length && lab.chance(0.2)) [x, y, z] = extra.pop(); else { const p = pts.pop(); if (!p) break; [x, z] = p; }
        const s = lab.rand(0.85, 1.25), r = lab.rand(0, 6.28), col = lab.pick(cols);
        lab.place(im, i, [x, y, z], { rot: r, scale: s, color: col });
        st.junk.push({ im, i, x, y, z, s, r, col });
      }
    });
    // цели: вещи подряд; силуэт нужной вещи крутится над коробкой
    const pool = items.slice();
    for (let i = pool.length - 1; i > 0; i--) { const j = lab.randInt(0, i); [pool[i], pool[j]] = [pool[j], pool[i]]; }
    st.targets = pool.slice(0, Math.min(Math.round(c.findN), pool.length));
    st.silMat = new T.MeshBasicMaterial({ color: '#100a18' });
    const box = this.boxMesh(lab, '?', 0);
    box.g.position.set(this.PICK.x, 0, this.PICK.z);
    box.flaps.forEach((f, i) => { f.rotation.z = (i ? -1 : 1) * 2.1; });
    st.findBox = box;
    st.silRing = lab.mesh(new T.RingGeometry(0.42, 0.5, 32), lab.mat('#ffd27a', { unlit: true, glow: 0.9, side: 'double' }), { at: [this.PICK.x, 1.15, this.PICK.z], rot: [-Math.PI / 2, 0, 0], shadow: false });
    st.findT = 0;
    this.nextTarget(lab);
  },
  nextTarget(lab) {
    const st = lab.state, c = lab.cfg;
    if (st.sil) { st.sil.removeFromParent(); st.sil = null; }
    st.findHint = null; st.findT = lab.t; st.fails = 0;
    const it = st.targets[st.found];
    if (!it) return;
    const n = it.node.clone();
    n.traverse(m => { if (m.isMesh) m.material = st.silMat; });
    n.position.set(this.PICK.x, 1.25, this.PICK.z); n.rotation.set(0, 0, 0); n.scale.setScalar(0.001);
    lab.scene.add(n); st.sil = n;
    lab.tween(0.3, k => n.scale.setScalar(Math.max(0.001, c.big * 1.25 * k)), 'outBack');
    lab.tone(660, 0.12, 'triangle', 0.05); lab.tone(990, 0.12, 'triangle', 0.04, 0, 0.08);
  },
  findHit(lab, it) {
    const st = lab.state, c = lab.cfg, tg = st.targets[st.found];
    if (it !== tg) { // не та вещь
      st.fails++; st.wrongs++; st.streak = 0; lab.count('не туда');
      lab.whiten(it.node, 0.2, '#ff4d5e'); lab.tween(0.35, q => { it.node.rotation.z = Math.sin(q * Math.PI * 6) * 0.3 * (1 - q); }, 'linear');
      lab.tone(190, 0.12, 'square', 0.05, 150); lab.shake(0.08);
      if (c.hintFails > 0 && st.fails >= c.hintFails) st.findHint = tg;
      return;
    }
    st.found++; it.state = 'found';
    st.streak = lab.t - st.lastPut <= 12 ? st.streak + 1 : 1; st.lastPut = lab.t; st.best = Math.max(st.best, st.streak);
    const s = this.slotBy(st, it.storyKey || it.home), tell = st.story && !!it.storyKey;
    const pts = (tell ? 25 : 10) * this.mult(lab);
    lab.addScore(pts); lab.count('вещи'); st.placed++;
    lab.popup([it.node.position.x, 1.2, it.node.position.z], `+${pts}`, tell ? '#ffb36b' : '#ffd27a', 22);
    const f = 392 * lab.pitch(st.streak - 1);
    lab.tone(f, 0.22, 'triangle', 0.1); lab.burst(it.node.position, { count: 14, colors: ['#ffd27a', '#ffffff'], speed: 2.5, up: 1.5, size: 0.08 });
    lab.ring([it.node.position.x, 0.03, it.node.position.z], { color: '#ffd27a', radius: 1.2, life: 0.4 });
    // найденная вещь сама летит на своё место
    if (s && !s.item) {
      s.item = it; it.slot = s;
      const a = it.node.position.clone(), id = this.move(it);
      lab.tween(0.7, (k, raw = 0) => { if (it.mv !== id) return; it.node.position.lerpVectors(a, s.pos, k); it.node.position.y += Math.sin(Math.PI * raw) * 1.5; it.node.rotation.y = lab.lerp(0, s.face + Math.PI * 2, k); if (raw >= 1) { it.state = 'placed'; it.node.rotation.set(0, s.face, 0); lab.noise(0.035, 0.12, 2600); lab.pulse(it.node, 1.2, 0.18); if (tell) this.storyFx(lab, it, f); } }, 'inOutQuad');
    }
    if (tell) { it.told = true; this.storyHit(lab); }
    if (st.found >= st.targets.length) { if (st.sil) { st.sil.removeFromParent(); st.sil = null; } lab.after(1.2, () => this.finale(lab)); }
    else lab.after(0.3, () => this.nextTarget(lab));
  },
  junkHit(lab, j) { // хлам: пыль и шорох
    lab.noise(0.08, 0.05, 1200);
    lab.burst([j.x, j.y + 0.2, j.z], { count: 6, colors: ['#c8bca0', '#9a8a70'], speed: 1, up: 0.6, size: 0.06, gravity: 2 });
    lab.tween(0.25, q => lab.place(j.im, j.i, [j.x, j.y, j.z], { rot: j.r + Math.sin(q * Math.PI * 4) * 0.3 * (1 - q), scale: j.s * (1 + 0.15 * Math.sin(Math.PI * q)) }));
    lab.count('хлам');
  },

  /* ---------------- вариации: «Осмотр» ---------------- */
  makeInspect(lab) {
    const st = lab.state, n = st.boxN;
    for (const it of st.items) {
      if (it.k === 'oldletter') continue;
      if (st.story && n >= 3 && it.k === 'cup2') { const s = this.slotBy(st, 'T2'); s.gone = true; st.goneSlot = s; it.state = 'gone'; continue; } // вторая чашка уже исчезла
      const s = this.slotBy(st, it.storyKey || it.home);
      it.state = 'placed'; it.slot = s; s.item = it; it.node.visible = true; it.node.position.copy(s.pos); it.node.rotation.set(0, s.face, 0);
      if (st.story) this.tint(it, Math.min(0.6, (n - 1 - it.box) * 0.25)); // старые вещи выцвели
    }
    st.goal = st.story ? st.items.filter(it => it.storyKey && it.state === 'placed').length : Math.min(7, st.items.filter(it => it.state === 'placed').length);
    st.lookT = 0;
  },

  /* ---------------- вариации: «Два времени» ---------------- */
  pastToggle(lab) {
    const st = lab.state, T = lab.THREE, c = lab.cfg;
    st.pastOn = !st.pastOn;
    if (st.ghosts) { st.ghosts.removeFromParent(); st.ghosts = null; }
    if (st.pastOn) {
      lab.count('прошлое');
      const g = st.ghosts = new T.Group(); lab.scene.add(g);
      if (!st.ghostMat) st.ghostMat = new T.MeshBasicMaterial({ color: new T.Color('#ffd9a0').multiplyScalar(1.3), transparent: true, opacity: 0.42, depthWrite: false });
      for (const it of st.items) { // призраки: вещи там, где стояли раньше
        const s = this.slotBy(st, it.storyKey || it.home);
        const atHome = it.state === 'placed' && it.slot === s;
        const was = it.state === 'gone' || (st.mode === 'boxes' ? (it.box === st.box && it.state !== 'placed') || it.state === 'hand' : !atHome);
        if (!s || atHome || !was || it.k === 'oldletter') continue;
        const n = it.node.clone(); n.visible = true;
        n.traverse(m => { if (m.isMesh) { m.material = st.ghostMat; m.castShadow = false; m.userData.noShadow = true; } });
        n.position.copy(s.pos); n.rotation.set(0, s.face, 0); n.scale.setScalar(c.big);
        g.add(n);
      }
      lab.tone(784, 0.5, 'sine', 0.05, 392); lab.flash('#c89a5a', 0.25);
    } else { lab.tone(392, 0.4, 'sine', 0.05, 784); lab.flash('#ffffff', 0.12); }
    this.setTime(lab, st.timeNow || 0);
  },
  makeSepia(lab) {
    const st = lab.state, T = lab.THREE;
    const m = new T.MeshBasicMaterial({ color: '#7a4a1a', transparent: true, opacity: 0, depthTest: false, depthWrite: false, fog: false });
    st.sepia = new T.Mesh(new T.PlaneGeometry(1, 1), m);
    st.sepia.renderOrder = 999; st.sepia.frustumCulled = false; st.sepia.userData.noShadow = true; st.sepia.visible = false;
    lab.scene.add(st.sepia);
  },
  pastStep(lab, dt) {
    const st = lab.state, cam = lab.camera, S = st.sepia;
    const want = st.pastOn ? 0.36 : 0;
    S.material.opacity = lab.damp(S.material.opacity, want, 6, dt);
    S.visible = S.material.opacity > 0.01;
    if (!S.visible) return;
    const d = 0.5, h = 2 * d * Math.tan(cam.fov * Math.PI / 360) * 1.4;
    S.position.copy(cam.position).add(new lab.THREE.Vector3(0, 0, -d).applyQuaternion(cam.quaternion));
    S.quaternion.copy(cam.quaternion); S.scale.set(h * cam.aspect, h, 1);
    if (st.ghosts) st.ghosts.children.forEach((n, i) => { n.position.y += Math.sin(lab.t * 2 + i) * 0.002; });
  },

  /* ---------------- вариации: «Кот» ---------------- */
  makeCat(lab) {
    const st = lab.state, k = this.kit(lab), fur = '#e0893a', dk = '#b5601e', wh = '#f5e6d0';
    k.ball(0.2, fur, [0, 0.27, 0], [0.9, 0.78, 1.55]);
    for (const z of [-0.12, 0, 0.12]) k.box(0.33, 0.035, 0.05, dk, [0, 0.41, z]);
    k.ball(0.15, fur, [0, 0.43, 0.32]);
    k.ball(0.075, wh, [0, 0.39, 0.44], [1.1, 0.8, 0.7]);
    k.cone(0.055, 0.12, dk, [-0.08, 0.57, 0.31], [0, 0, 0.2], 4); k.cone(0.055, 0.12, dk, [0.08, 0.57, 0.31], [0, 0, -0.2], 4);
    k.ball(0.022, '#2f6a2a', [-0.055, 0.46, 0.45], 1, 0); k.ball(0.022, '#2f6a2a', [0.055, 0.46, 0.45], 1, 0);
    k.ball(0.015, '#d0606a', [0, 0.41, 0.5], 1, 0);
    for (const [x, z] of [[-0.09, 0.17], [0.09, 0.17], [-0.09, -0.17], [0.09, -0.17]]) k.cyl(0.04, 0.035, 0.2, x > 0 ? fur : dk, [x, 0.1, z], null, 6);
    const g = lab.group();
    k.mesh(lab, g);
    const pivot = lab.group({ parent: g, at: [0, 0.33, -0.28] });
    lab.cyl(0.03, 0.045, 0.42, fur, { parent: pivot, at: [0, 0.18, -0.08], rot: [-0.4, 0, 0], sides: 6 });
    g.scale.setScalar(1.3);
    st.cat = { g, pivot, x: 4.0, z: 0.8, tx: 2.0, tz: 1.0, state: 'roam', next: 4 + lab.rand(0, 2), item: null, yaw: 0, t: 0, y: 0 };
    st.catN = 0;
    g.position.set(4.0, 0, 0.8);
  },
  catStep(lab, dt) {
    const st = lab.state, c = lab.cfg, K = st.cat, B = this.BOUNDS;
    K.t += dt;
    let sp = 0;
    if (st.phase === 'play' && !st.ended) {
      if (K.state === 'roam') {
        sp = 1.0;
        if (Math.hypot(K.tx - K.x, K.tz - K.z) < 0.2) { K.tx = lab.rand(B.x0 + 0.5, B.x1 - 0.5); K.tz = lab.rand(-1.8, 3.0); }
        if (lab.t >= K.next) { // раз в 10–14 с кот идёт к положенной вещи
          const ok = st.items.filter(it => it.state === 'placed' && it.slot && ['стол', 'полка', 'сундук', 'подоконник', 'кровать'].includes(it.slot.type) && !it.flying);
          if (ok.length) { K.item = lab.pick(ok); K.state = 'go'; } else K.next = lab.t + 3;
        }
      } else if (K.state === 'go') {
        const it = K.item;
        if (!it || it.state !== 'placed' || !it.slot) { K.state = 'roam'; K.next = lab.t + 2; }
        else { K.tx = it.slot.rx; K.tz = it.slot.rz; sp = 1.8; if (Math.hypot(K.tx - K.x, K.tz - K.z) < 0.25) { K.state = 'swat'; K.t = 0; this.catSwat(lab); } }
      } else if (K.state === 'swat' && K.t > 0.9) { K.state = 'roam'; K.next = lab.t + c.catEvery + lab.rand(-2, 2); K.tx = lab.rand(B.x0 + 0.5, B.x1 - 0.5); K.tz = lab.rand(-1.8, 3.0); }
    }
    if (sp > 0) {
      const dx = K.tx - K.x, dz = K.tz - K.z, d = Math.hypot(dx, dz);
      if (d > 0.05) { K.x += dx / d * Math.min(d, sp * dt); K.z += dz / d * Math.min(d, sp * dt); K.yaw = Math.atan2(dx, dz); }
    }
    const walk = sp > 0 ? Math.abs(Math.sin(lab.t * 11)) * 0.035 : 0;
    K.g.position.set(K.x, K.y + walk, K.z);
    K.g.rotation.y = lab.damp(K.g.rotation.y, K.yaw, 8, dt);
    K.pivot.rotation.z = Math.sin(lab.t * (sp > 0 ? 6 : 2)) * 0.5;
  },
  catSwat(lab) { // кот запрыгивает и сбрасывает вещь на пол
    const st = lab.state, K = st.cat, it = K.item, s = it.slot, top = s.pos.y;
    lab.tween(0.8, (k, raw = 0) => { K.y = Math.sin(Math.PI * raw) * Math.max(0.3, top * 0.9); }, 'linear');
    lab.tone(620, 0.12, 'sine', 0.05, 900); lab.tone(900, 0.25, 'sine', 0.05, 520, 0.12); // мяу
    lab.after(0.4, () => {
      if (it.state !== 'placed' || it.slot !== s) return;
      s.item = null; it.slot = null; it.state = 'loose'; it.checked = false; it.wrong = false;
      st.loose.push(it); st.catN++; lab.count('кот');
      const cx = -0.4 - s.rx, cz = 0.3 - s.rz, cd = Math.hypot(cx, cz) || 1;
      const to = new lab.THREE.Vector3(lab.clamp(s.rx + cx / cd * 0.6, -4.5, 4.4), 0.05, lab.clamp(s.rz + cz / cd * 0.6, -3.0, 3.1));
      const a = it.node.position.clone(), tilt = lab.rand(-1.2, 1.2), id = this.move(it);
      it.flying = true;
      lab.tween(0.55, (k, raw = 0) => { if (it.mv !== id) return; it.node.position.lerpVectors(a, to, k); it.node.position.y = lab.lerp(a.y, to.y, k) + Math.sin(Math.PI * raw) * 0.4; it.node.rotation.z = tilt * k; if (raw >= 1) { it.flying = false; lab.noise(0.12, 0.1, 500); lab.shake(0.1); lab.burst([to.x, 0.1, to.z], { count: 10, colors: ['#d8ccb4', '#a89a80'], speed: 1.5, up: 0.6, size: 0.07 }); } }, 'inQuad');
    });
  },

  /* ---------------- свет, камера, окружение ---------------- */
  setTime(lab, x) {
    const st = lab.state, c = lab.cfg, T = lab.THREE, S = this.TIMES, L = lab.light;
    st.timeNow = x;
    const i = Math.min(S.length - 2, Math.max(0, Math.floor(x))), k = lab.clamp(x - i, 0, 1), A = S[i], Bt = S[i + 1];
    const mix = (p, q) => new T.Color(p).lerp(new T.Color(q), k);
    const dark = c.dark > 0, past = st.pastOn;
    const sun = past ? new T.Color('#ffcf8a') : mix(A.sun, Bt.sun);
    L.sun.color.copy(sun); L.sun.intensity = lab.lerp(A.si, Bt.si, k) * (dark ? 0.05 : 1);
    L.hemi.color.copy(past ? new T.Color('#d9b07a') : mix(A.sky, Bt.sky)); L.hemi.groundColor.copy(mix(A.gnd, Bt.gnd));
    L.hemi.intensity = lab.lerp(A.hi, Bt.hi, k) * (dark ? 0.09 : 1);
    st.glassMat.color.copy(mix(A.glass, Bt.glass)).multiplyScalar(dark ? 0.5 : 1.7);
    st.beamBase = lab.lerp(A.beam, Bt.beam, k) * (dark ? 0.25 : 1);
    st.beamMat.color.copy(sun); st.patchMat.color.copy(sun);
    st.moteMat.color.copy(sun).multiplyScalar(dark ? 1 : 2);
  },
  cameraStep(lab, dt) {
    const st = lab.state, v = lab.view, C = st.cam, C0 = st.cam0;
    let tgt = C.target, dist = C.dist, tilt = C.tilt, r = 2.4;
    if (st.look) { // наезд камеры на вещь
      tgt = st.look.it.node.position; dist = C0.dist * 0.36; tilt = C0.tilt - 0.08; r = 4;
    }
    v.turn = lab.damp(v.turn, C.turn, r, dt); v.tilt = lab.damp(v.tilt, tilt, r, dt); v.distance = lab.damp(v.distance, dist, r, dt);
    v.target.x = lab.damp(v.target.x, tgt.x, r, dt); v.target.y = lab.damp(v.target.y, st.look ? tgt.y + 0.2 : tgt.y, r, dt); v.target.z = lab.damp(v.target.z, tgt.z, r, dt);
  },
  ambient(lab, dt) {
    const st = lab.state, m = st.motes, tm = st.tmp;
    st.kick = Math.max(0, st.kick - dt * 1.2);
    const flick = 1 + Math.sin(lab.t * 1.7) * 0.06 + Math.sin(lab.t * 4.3) * 0.03;
    st.beamMat.opacity = st.beamBase * flick + st.kick * 0.12;
    st.patchMat.opacity = st.beamBase * 1.5 * flick + st.kick * 0.25;
    // пылинки медленно плывут в луче
    for (let i = 0; i < st.moteN; i++) {
      const q = st.moteP[i];
      q.u = (q.u + dt * q.sp) % 1;
      const p = tm.v.copy(st.beamA).lerp(st.beamB, q.u);
      p.x += Math.sin(lab.t * 0.7 + q.ph) * q.r; p.y += Math.sin(lab.t * 0.5 + q.ph * 2) * q.r * 0.6 + q.dy; p.z += Math.cos(lab.t * 0.6 + q.ph) * q.r;
      const s = q.s * (0.6 + 0.4 * Math.sin(lab.t * 3 + q.ph));
      tm.m.compose(p, tm.q.identity(), tm.s.set(s, s, s)); m.setMatrixAt(i, tm.m);
    }
    m.instanceMatrix.needsUpdate = true;
    // перец и кукуруза на нитках чуть качаются
    const sw = Math.sin(lab.t * 0.9) * 0.05;
    st.hangG.rotation.z = sw; st.hangG.rotation.x = Math.sin(lab.t * 0.7) * 0.03;
    // свет снизу из люка дышит
    st.hatchMat.color.setRGB(1, 0.62, 0.3).multiplyScalar(1.1 + Math.sin(lab.t * 2.3) * 0.12);
    if (st.goneMote) { st.goneMote.visible = !!st.goneSlot; if (st.goneSlot) { const s = st.goneSlot.pos; st.goneMote.position.set(s.x + Math.sin(lab.t) * 0.05, s.y + 0.35 + Math.sin(lab.t * 1.6) * 0.08, s.z); } }
    // следующая вещь подпрыгивает в коробке
    if (st.mode === 'boxes' && st.queue[0] && st.phase === 'play' && !st.queue[0].flying) st.queue[0].node.position.y = 0.42 - st.queue[0].h * lab.cfg.big * 0.35 + Math.abs(Math.sin(lab.t * 2.5)) * 0.06;
    if (st.sil) { st.sil.rotation.y += dt * 1.4; st.sil.position.y = 1.3 + Math.sin(lab.t * 2) * 0.06; }
    if (st.findHint === undefined) st.findHint = null;
    if (st.mode === 'find' && !st.findHint && st.targets[st.found] && lab.t - st.findT > 14) st.findHint = st.targets[st.found];
    if (st.mode === 'inspect' && !st.lookHint && lab.t - (st.lookT || 0) > 14) { const left = st.items.filter(it => it.state === 'placed' && !it.looked && (!st.story || it.storyKey)); if (left.length) { let b = left[0], bd = 1e9; for (const it of left) { const d = Math.hypot(it.slot.rx - st.hp.x, it.slot.rz - st.hp.z); if (d < bd) { bd = d; b = it; } } st.lookHint = b; } }
    // фонарик у руки
    if (st.spot && lab.cfg.dark > 0) { st.spot.position.set(st.hp.x + 0.4, st.handY + 1.9, st.hp.z + 0.7); st.spot.target.position.set(st.hp.x, 0, st.hp.z - 0.1); }
  },

  /* ---------------- подсветка мест: одна пачка колец ---------------- */
  makeMarkers(lab) {
    const st = lab.state, T = lab.THREE;
    const mat = new T.MeshBasicMaterial({ color: '#ffffff', transparent: true, opacity: 0.95, depthWrite: false, blending: T.AdditiveBlending, side: T.DoubleSide, fog: false });
    st.mkN = st.slots.length + 12;
    st.mk = lab.instances(new T.RingGeometry(0.8, 1, 32), mat, st.mkN, { shadow: false });
    st.mk.frustumCulled = false;
    for (let i = 0; i < st.mkN; i++) st.mk.setColorAt(i, st.tmp.c.set('#ffffff'));
  },
  markersStep(lab) {
    const st = lab.state, c = lab.cfg, tm = st.tmp, mk = st.mk, it = st.hand, t = lab.t;
    const blink = Math.floor(t * 6) % 2 === 0, pulse = 1 + Math.sin(t * 8) * 0.08;
    const play = st.phase === 'play' && !st.look;
    const smart = !(c.free > 0) && !(c.memory > 0);
    const dark = c.dark > 0;
    const set = (i, pos, rot, sc, col, k) => {
      if (!col || (dark && Math.hypot(pos.x - st.hp.x, pos.z - st.hp.z) > 3)) { mk.setMatrixAt(i, tm.zero); return; }
      tm.e.set(rot[0], rot[1], rot[2]);
      tm.m.compose(pos, tm.q.setFromEuler(tm.e), tm.s.set(sc, sc, sc)); mk.setMatrixAt(i, tm.m);
      mk.setColorAt(i, tm.c.set(col).multiplyScalar(k));
    };
    st.slots.forEach((s, i) => {
      let col = null, k = 1, sc = 0.3;
      const fl = st.flash[s.i];
      if (fl != null && t - fl < 0.5) { col = '#ff4d5e'; k = 1.8; sc = 0.34; }
      else if (s.gone) { col = '#8a8070'; k = 0.5; sc = 0.24; } // пыльный круг на опустевшем месте
      else if (play && it && !s.item) {
        const fit = smart && (this.fits(lab, it, s) || this.noFit(lab, it));
        if (i === st.hint && blink) { col = '#ffffff'; k = 2.2; sc = 0.38; }
        else if (i === st.nearSlot) { col = fit ? '#ffd27a' : '#e8e0ff'; k = fit ? 2 : 0.9; sc = 0.34 * pulse; }
        else if (fit) { col = '#ffc45a'; k = 0.7; sc = 0.26; }
      }
      if (st.posterOn && st.posterOn.mark === i) { col = '#ffd27a'; k = 2; sc = 0.36; }
      set(i, s.mp, s.mr, sc, col, k);
    });
    // кольца того, что можно взять: коробка, вещь на полу, красная вещь, гармонь с письмом, подсказки «Осмотра» и «Найди вещь»
    const aux = [];
    if (play && !it && st.pick) aux.push([st.pick, '#ffd27a', 1.8, 0.4 * pulse]);
    else if (play && !it && blink) { const ct = this.callTarget(lab); if (ct && ct.box) aux.push([{ kind: 'box' }, '#ffffff', 1.6, 0.6]); }
    for (const l of st.loose) aux.push([{ x: l.node.position.x, y: 0.02, z: l.node.position.z }, '#ff7a5a', blink ? 1.6 : 0.8, 0.36]);
    for (const w of st.items) if (w.wrong && w.slot) aux.push([w.slot, '#ff4d5e', blink ? 1.8 : 0.6, 0.34, true]);
    if (st.letterIn && !st.letterOut && st.garmon && st.garmon.slot && Math.floor(t * 1.5) % 3 === 0) aux.push([{ x: st.garmon.slot.pos.x, y: st.garmon.slot.pos.y + 0.02, z: st.garmon.slot.pos.z }, '#ffe8b0', 1, 0.25]);
    if (play && st.findHint && blink) aux.push([{ x: st.findHint.node.position.x, y: 0.04, z: st.findHint.node.position.z }, '#ffffff', 2.2, 0.45]);
    if (play && st.lookHint && st.lookHint.slot && blink) aux.push([st.lookHint.slot, '#ffffff', 2.2, 0.38, true]);
    for (let j = 0; j < st.mkN - st.slots.length; j++) {
      const i = st.slots.length + j, a = aux[j];
      if (!a) { mk.setMatrixAt(i, tm.zero); continue; }
      const q = a[0];
      if (a[4]) set(i, q.mp, q.mr, a[3], a[1], a[2]);
      else if (q.kind === 'box') set(i, tm.v.set(this.PICK.x, 0.03, this.PICK.z), [-Math.PI / 2, 0, 0], 0.62 * pulse, a[1], a[2]);
      else if (q.kind === 'wrong' || q.kind === 'look' || q.kind === 'letter') set(i, q.it.slot.mp, q.it.slot.mr, a[3], a[1], a[2]);
      else set(i, tm.v.set(q.x, (q.kind ? 0.03 : q.y), q.z), [-Math.PI / 2, 0, 0], a[3], a[1], a[2]);
    }
    mk.instanceMatrix.needsUpdate = true; if (mk.instanceColor) mk.instanceColor.needsUpdate = true;
  },

  /* ---------------- места ---------------- */
  makeSlots(lab) {
    const st = lab.state, T = lab.THREE;
    st.slots = this.SLOTS.map(([key, type, p, r, face, surf], i) => {
      const s = { i, key, type, pos: new T.Vector3(p[0], p[1], p[2]), rx: r[0], rz: r[1], face, surf, item: null, gone: false, excl: false };
      if (surf === 'h') { s.mp = new T.Vector3(p[0], p[1] + 0.02, p[2]); s.mr = [-Math.PI / 2, 0, 0]; }
      else if (surf === 'b') { s.mp = new T.Vector3(p[0], p[1] + 0.38, -3.53); s.mr = [0, 0, 0]; }
      else { s.mp = new T.Vector3(-4.98, p[1] + 0.3, p[2]); s.mr = [0, Math.PI / 2, 0]; }
      return s;
    });
  },
  slotBy(st, key) { return st.slots.find(s => s.key === key); },

  /* ---------------- вещи ---------------- */
  makeItems(lab) {
    const st = lab.state, c = lab.cfg, list = st.story ? this.STORY : this.PLAIN;
    const n = st.boxN;
    for (const d of list) {
      if (d.box >= n) continue;
      st.items.push(this.makeItem(lab, d));
    }
    if (st.story) {
      for (const it of st.items) if (it.storyKey) this.slotBy(st, it.storyKey).excl = true;
      st.garmon = st.items.find(it => it.k === 'garmon');
      if (n >= 3 && st.mode === 'boxes') { st.oldletter = this.makeItem(lab, { k: 'oldletter', box: 2, story: 'T3' }); st.items.push(st.oldletter); }
    }
    for (const it of st.items) { it.node.visible = false; it.node.scale.setScalar(c.big); }
  },
  makeItem(lab, d) {
    const T = lab.THREE, k = this.kit(lab), pics = [];
    const h = this.BUILD[d.k].call(this, lab, k, pics, d) || 0.3;
    const g = lab.group();
    const mesh = k.mesh(lab, g);
    const mats = [mesh.material];
    for (const p of pics) {
      const pm = new T.MeshStandardMaterial({ map: this.tex(lab, p.tw, p.th, p.draw), roughness: 0.8 });
      const pl = new T.Mesh(new T.PlaneGeometry(p.w, p.h), pm);
      pl.position.set(p.at[0], p.at[1], p.at[2]); if (p.rot) pl.rotation.set(p.rot[0], p.rot[1], p.rot[2]);
      g.add(pl); mats.push(pm);
    }
    const it = { k: d.k, box: d.box, h, node: g, mats, state: 'box', slot: null, storyKey: d.story || null, story: !!d.story,
      types: d.story ? [this.SLOTS.find(s => s[0] === d.story)[1]] : d.types, home: d.story || d.home };
    if (d.k === 'garmon') { it.corner = lab.box(0.13, 0.015, 0.1, '#efe0bf', { parent: g, at: [0.02, 0.255, 0.03], rot: [0.5, 0.4, 0.4] }); it.corner.visible = false; }
    if (d.k === 'lamp') lab.cyl(0.035, 0.05, 0.13, lab.mat('#ffe3a0', { glow: 0.9 }), { parent: g, at: [0, 0.24, 0], shadow: false, sides: 8 });
    if (d.k === 'candle') lab.cone(0.025, 0.07, lab.mat('#ffb347', { glow: 1.4 }), { parent: g, at: [0, 0.27, 0], shadow: false, sides: 5 });
    return it;
  },
  // вещи из лоуполи-деталей: одна сетка на вещь (цвета — в вершинах), картинки — плоскостями с холстом
  BUILD: {
    photo1(lab, k, pics) { return this.frame(k, pics, 0.34, 0.44, '#5a3620', '#3e2414', 'youth'); },
    wedding(lab, k, pics) { return this.frame(k, pics, 0.44, 0.54, '#c9a24a', '#8a6a2a', 'wedding'); },
    gphoto(lab, k, pics) { return this.frame(k, pics, 0.34, 0.44, '#e8e8ec', '#a8a8b0', 'grandson'); },
    drawing(lab, k, pics) {
      k.box(0.44, 0.33, 0.006, '#fbf6ea', [0, 0.17, 0]);
      k.ball(0.014, '#d03030', [-0.19, 0.31, 0.006], 1, 0); k.ball(0.014, '#3060d0', [0.19, 0.31, 0.006], 1, 0);
      pics.push({ w: 0.42, h: 0.31, at: [0, 0.17, 0.005], tw: 256, th: 190, draw: 'drawing' });
      return 0.34;
    },
    letter(lab, k, pics, d) { return this.envelope(k, pics, '#efe0bf', 'letter'); },
    oldletter(lab, k, pics) { return this.envelope(k, pics, '#e6d3a6', 'letter'); },
    gletter(lab, k, pics) { return this.envelope(k, pics, '#fbfbf7', 'gletter'); },
    papakha(lab, k) {
      k.cyl(0.19, 0.16, 0.25, '#3b2f2a', [0, 0.125, 0], null, 12);
      for (let i = 0; i < 12; i++) { const a = i / 12 * Math.PI * 2; k.ball(0.05, i % 2 ? '#4a3c34' : '#2e241f', [Math.cos(a) * 0.18, 0.2 + (i % 3) * 0.02, Math.sin(a) * 0.18], 1, 0); }
      k.cyl(0.165, 0.165, 0.02, '#7a1f1f', [0, 0.26, 0], null, 12);
      k.box(0.3, 0.012, 0.025, '#d9a84a', [0, 0.272, 0]); k.box(0.025, 0.012, 0.3, '#d9a84a', [0, 0.272, 0]);
      return 0.28;
    },
    garmon(lab, k) { // адыгская гармонь (пщынэ): лакированные бока, мехи, перламутровые кнопки
      k.box(0.12, 0.24, 0.17, '#8a2a1c', [-0.2, 0.12, 0]); k.box(0.12, 0.24, 0.17, '#8a2a1c', [0.2, 0.12, 0]);
      for (let i = 0; i < 7; i++) k.box(0.04, 0.22, 0.16, i % 2 ? '#2a1c18' : '#efe2c0', [-0.12 + i * 0.04, 0.12, 0]);
      for (let i = 0; i < 6; i++) k.ball(0.014, '#f8f2e8', [0.262, 0.07 + (i % 3) * 0.06, -0.035 + Math.floor(i / 3) * 0.07], 1, 0);
      k.box(0.08, 0.12, 0.005, '#d9a84a', [-0.2, 0.13, 0.087]); k.box(0.08, 0.12, 0.005, '#d9a84a', [0.2, 0.13, 0.087]);
      k.box(0.36, 0.02, 0.03, '#3a2618', [0, 0.26, -0.06]);
      return 0.26;
    },
    poems(lab, k) { return this.bookGeo(k, '#2c4f86', true); },
    book(lab, k, pics, d) { return this.bookGeo(k, d.c || '#2c4f86', false); },
    books(lab, k) { this.bookGeo(k, '#8a3a2a', false, 0); this.bookGeo(k, '#3e6a5a', false, 0.06, 0.3); this.bookGeo(k, '#c9a24a', false, 0.12, -0.2); return 0.18; },
    cup1(lab, k) { return this.cupGeo(k, '#c0392b', false); },
    cup2(lab, k) { return this.cupGeo(k, '#2c6fb0', true); },
    satchel(lab, k) {
      k.box(0.34, 0.26, 0.12, '#8a5a2c', [0, 0.13, 0]); k.box(0.35, 0.15, 0.02, '#73461e', [0, 0.19, 0.065]);
      k.box(0.04, 0.05, 0.01, '#e0c870', [-0.09, 0.13, 0.077]); k.box(0.04, 0.05, 0.01, '#e0c870', [0.09, 0.13, 0.077]);
      k.torus(0.06, 0.012, '#5a3a1a', [0, 0.28, 0], [0, 0, 0], Math.PI);
      return 0.33;
    },
    horse(lab, k) { // лошадка-качалка: на боку вырезано сердечко
      for (const z of [-0.08, 0.08]) k.torus(0.42, 0.022, '#7a4a28', [0, 0.42, z], [0, 0, Math.PI + 0.9], 1.35, 20);
      for (const [x, z] of [[-0.13, -0.08], [0.13, -0.08], [-0.13, 0.08], [0.13, 0.08]]) k.cyl(0.018, 0.018, 0.2, '#f2e6d0', [x, 0.13, z], [0, 0, x > 0 ? -0.25 : 0.25], 6);
      k.box(0.34, 0.13, 0.12, '#d94a3a', [0, 0.28, 0]);
      k.box(0.09, 0.16, 0.09, '#d94a3a', [0.18, 0.39, 0], [0, 0, -0.35]);
      k.box(0.13, 0.07, 0.08, '#d94a3a', [0.24, 0.46, 0], [0, 0, -0.1]);
      k.box(0.05, 0.15, 0.1, '#3a2418', [0.13, 0.43, 0], [0, 0, -0.35]);
      k.cone(0.02, 0.05, '#3a2418', [0.2, 0.52, 0.025], null, 4); k.cone(0.02, 0.05, '#3a2418', [0.2, 0.52, -0.025], null, 4);
      k.box(0.12, 0.03, 0.13, '#e8c050', [-0.02, 0.36, 0]);
      k.box(0.03, 0.12, 0.03, '#3a2418', [-0.19, 0.27, 0], [0, 0, 0.5]);
      k.box(0.035, 0.03, 0.004, '#8a1a12', [-0.07, 0.29, 0.061], [0, 0, 0.78]); k.box(0.035, 0.03, 0.004, '#8a1a12', [-0.05, 0.29, 0.061], [0, 0, -0.78]); // сердечко
      return 0.52;
    },
    jug(lab, k) {
      k.lathe([[0, 0], [0.09, 0], [0.11, 0.06], [0.1, 0.16], [0.06, 0.24], [0.05, 0.3], [0.07, 0.33], [0.06, 0.33]], '#c8783a', [0, 0, 0], 10);
      k.torus(0.07, 0.012, '#a85a28', [0.09, 0.2, 0], [0, 0, -0.3], Math.PI * 1.1);
      k.cone(0.03, 0.07, '#c8783a', [-0.08, 0.31, 0], [0, 0, 1.0], 6);
      k.cyl(0.112, 0.112, 0.02, '#e8b04a', [0, 0.1, 0], null, 10);
      return 0.33;
    },
    lamp(lab, k) {
      k.cyl(0.09, 0.11, 0.04, '#b8862e', [0, 0.02, 0], null, 10);
      k.ball(0.085, '#c99a3a', [0, 0.1, 0], [1, 0.7, 1]);
      k.cyl(0.03, 0.04, 0.04, '#8a6a2a', [0, 0.16, 0], null, 8);
      k.torus(0.05, 0.008, '#8a6a2a', [0.11, 0.1, 0], [0, 0, 0], Math.PI * 2, 10);
      return 0.31;
    },
    glasses(lab, k) {
      for (const x of [-0.075, 0.075]) { k.torus(0.058, 0.01, '#3a3030', [x, 0.07, 0], [0.2, 0, 0], Math.PI * 2, 14); k.cyl(0.052, 0.052, 0.004, '#cfe6f0', [x, 0.07, 0], [Math.PI / 2 + 0.2, 0, 0], 10); }
      k.box(0.05, 0.01, 0.01, '#3a3030', [0, 0.08, 0]);
      k.box(0.008, 0.008, 0.2, '#3a3030', [-0.135, 0.06, -0.1], [0.2, 0, 0]); k.box(0.008, 0.008, 0.2, '#3a3030', [0.135, 0.06, -0.1], [0.2, 0, 0]);
      return 0.14;
    },
    clock(lab, k) {
      k.cyl(0.1, 0.1, 0.07, '#c0392b', [0, 0.13, 0], [Math.PI / 2, 0, 0], 14);
      k.cyl(0.085, 0.085, 0.01, '#fbf6ea', [0, 0.13, 0.036], [Math.PI / 2, 0, 0], 14);
      k.box(0.008, 0.06, 0.004, '#202020', [0, 0.155, 0.043]); k.box(0.045, 0.008, 0.004, '#202020', [0.02, 0.13, 0.043]);
      k.ball(0.04, '#d4b04a', [-0.065, 0.235, 0], [1, 0.6, 1]); k.ball(0.04, '#d4b04a', [0.065, 0.235, 0], [1, 0.6, 1]);
      k.cyl(0.012, 0.012, 0.05, '#3a3030', [-0.06, 0.025, 0], [0, 0, 0.3], 5); k.cyl(0.012, 0.012, 0.05, '#3a3030', [0.06, 0.025, 0], [0, 0, -0.3], 5);
      return 0.27;
    },
    radio(lab, k) {
      k.box(0.42, 0.26, 0.18, '#7a4a2a', [0, 0.13, 0]);
      k.box(0.2, 0.16, 0.01, '#d8c49a', [-0.08, 0.13, 0.091]);
      for (let i = 0; i < 4; i++) k.box(0.18, 0.012, 0.004, '#8a6a3a', [-0.08, 0.075 + i * 0.035, 0.097]);
      k.box(0.12, 0.05, 0.01, '#f3e0a0', [0.12, 0.18, 0.091]);
      k.cyl(0.025, 0.025, 0.02, '#2a1a10', [0.09, 0.08, 0.1], [Math.PI / 2, 0, 0], 8); k.cyl(0.025, 0.025, 0.02, '#2a1a10', [0.16, 0.08, 0.1], [Math.PI / 2, 0, 0], 8);
      k.cyl(0.006, 0.006, 0.34, '#c0c0c0', [0.14, 0.42, -0.04], [0, 0, -0.45], 4);
      return 0.42;
    },
    plaid(lab, k) {
      const cols = ['#b8322e', '#2f6f8a', '#e0b04a'];
      for (let i = 0; i < 3; i++) k.box(0.42, 0.05, 0.3, cols[i], [0, 0.025 + i * 0.05, 0]);
      for (let i = 0; i < 4; i++) k.box(0.42, 0.006, 0.03, '#f2e6d0', [0, 0.152, -0.11 + i * 0.075]);
      for (let i = 0; i < 6; i++) k.box(0.012, 0.03, 0.02, '#e0b04a', [-0.215, 0.1, -0.12 + i * 0.05]);
      return 0.16;
    },
    jar(lab, k, pics, d) {
      k.cyl(0.08, 0.085, 0.2, d.c || '#c0392b', [0, 0.1, 0], null, 10);
      k.cyl(0.07, 0.07, 0.025, '#e8e2d0', [0, 0.21, 0], null, 10);
      k.cyl(0.09, 0.09, 0.03, '#d04a3a', [0, 0.22, 0], null, 10);
      k.box(0.1, 0.07, 0.005, '#f6efdc', [0, 0.1, 0.083]);
      return 0.24;
    },
    candle(lab, k) {
      k.cyl(0.08, 0.1, 0.03, '#b8862e', [0, 0.015, 0], null, 10);
      k.cyl(0.04, 0.04, 0.2, '#f6efdc', [0, 0.13, 0], null, 8);
      k.box(0.006, 0.03, 0.006, '#202020', [0, 0.245, 0]);
      return 0.26;
    },
    basket(lab, k) {
      k.cyl(0.2, 0.15, 0.18, '#c8a060', [0, 0.09, 0], null, 12);
      for (let i = 0; i < 3; i++) k.cyl(0.2 - i * 0.017, 0.2 - i * 0.017, 0.015, '#9a7038', [0, 0.04 + i * 0.05, 0], null, 12);
      k.torus(0.17, 0.015, '#9a7038', [0, 0.18, 0], [0, 0, 0], Math.PI, 12);
      k.ball(0.06, '#d94a3a', [-0.05, 0.19, 0.03], 1, 0); k.ball(0.06, '#e8b030', [0.06, 0.18, -0.02], 1, 0);
      return 0.36;
    },
    vase(lab, k) {
      k.lathe([[0, 0], [0.07, 0], [0.1, 0.08], [0.08, 0.2], [0.045, 0.28], [0.06, 0.33], [0.05, 0.33]], '#2f6f8a', [0, 0, 0], 10);
      k.cyl(0.101, 0.101, 0.03, '#e0b04a', [0, 0.09, 0], null, 10);
      return 0.33;
    },
    pot(lab, k) {
      k.cyl(0.11, 0.08, 0.16, '#b8582e', [0, 0.08, 0], null, 10);
      for (let i = 0; i < 6; i++) { const a = i / 6 * Math.PI * 2; k.cone(0.04, 0.2, '#3e8a3a', [Math.cos(a) * 0.04, 0.24, Math.sin(a) * 0.04], [Math.sin(a) * 0.4, 0, -Math.cos(a) * 0.4], 4); }
      k.ball(0.035, '#e84a6a', [0, 0.34, 0], 1, 0);
      return 0.36;
    },
    pillow(lab, k) {
      k.box(0.4, 0.14, 0.3, '#b8322e', [0, 0.07, 0]); k.box(0.3, 0.145, 0.2, '#e0b04a', [0, 0.07, 0]);
      for (const [x, z] of [[-0.2, -0.15], [0.2, -0.15], [-0.2, 0.15], [0.2, 0.15]]) k.ball(0.025, '#e0b04a', [x, 0.07, z], 1, 0);
      return 0.15;
    },
    embroidery(lab, k, pics) {
      k.box(0.4, 0.4, 0.03, '#6a4024', [0, 0.2, 0]);
      pics.push({ w: 0.34, h: 0.34, at: [0, 0.2, 0.017], tw: 128, th: 128, draw: 'embroidery' });
      return 0.4;
    },
    mirror(lab, k) {
      k.cyl(0.19, 0.19, 0.03, '#b8862e', [0, 0.2, 0], [Math.PI / 2, 0, 0], 16);
      k.cyl(0.16, 0.16, 0.035, '#d8eaf2', [0, 0.2, 0.002], [Math.PI / 2, 0, 0], 16);
      return 0.4;
    },
    casket(lab, k) {
      k.box(0.28, 0.14, 0.2, '#6a2a5a', [0, 0.07, 0]); k.box(0.3, 0.05, 0.22, '#7a3a6a', [0, 0.165, 0]);
      k.box(0.31, 0.02, 0.03, '#e0b04a', [0, 0.14, 0]); k.box(0.04, 0.04, 0.01, '#e0b04a', [0, 0.12, 0.105]);
      return 0.19;
    },
    yarn(lab, k) {
      k.ball(0.11, '#d94a6a', [-0.06, 0.11, 0]); k.ball(0.09, '#4a8ad9', [0.1, 0.09, 0.04]);
      k.cyl(0.006, 0.006, 0.3, '#c8a060', [0, 0.1, -0.08], [0, 0, 1.2], 4); k.cyl(0.006, 0.006, 0.3, '#c8a060', [0.02, 0.12, -0.06], [0, 0, 1.0], 4);
      return 0.22;
    },
  },
  frame(k, pics, w, h, col, dk, draw) {
    k.box(w, h, 0.035, col, [0, h / 2, 0]);
    k.box(w - 0.05, h - 0.05, 0.04, dk, [0, h / 2, 0]);
    pics.push({ w: w - 0.07, h: h - 0.07, at: [0, h / 2, 0.021], tw: 256, th: Math.round(256 * (h - 0.07) / (w - 0.07)), draw });
    return h;
  },
  envelope(k, pics, col, draw) {
    k.box(0.36, 0.016, 0.25, col, [0, 0.008, 0]);
    pics.push({ w: 0.35, h: 0.24, at: [0, 0.017, 0], rot: [-Math.PI / 2, 0, 0], tw: 256, th: 176, draw });
    return 0.06;
  },
  bookGeo(k, col, gold, y = 0, rot = 0) {
    k.box(0.26, 0.06, 0.34, col, [0, y + 0.03, 0], rot);
    k.box(0.24, 0.05, 0.33, '#f1e7cf', [0.012, y + 0.03, 0], rot);
    if (gold) { k.box(0.16, 0.004, 0.22, '#e3b44a', [0, y + 0.061, 0], rot); k.box(0.08, 0.005, 0.08, '#2c4f86', [0, y + 0.063, 0], rot); }
    return y + 0.06;
  },
  cupGeo(k, band, crack) {
    k.cyl(0.13, 0.11, 0.015, '#f4f1ea', [0, 0.0075, 0], null, 12);
    k.cyl(0.085, 0.062, 0.12, '#f4f1ea', [0, 0.075, 0], null, 12);
    k.cyl(0.086, 0.078, 0.03, band, [0, 0.1, 0], null, 12);
    k.cyl(0.075, 0.075, 0.004, '#7a3a1a', [0, 0.13, 0], null, 12);
    k.torus(0.035, 0.011, '#f4f1ea', [0.092, 0.08, 0], [0, 0, 0], Math.PI * 2, 10);
    if (crack) { k.box(0.004, 0.06, 0.003, '#2a2420', [-0.03, 0.08, 0.077], [0, 0, 0.35]); k.box(0.004, 0.035, 0.003, '#2a2420', [-0.016, 0.05, 0.072], [0, 0, -0.4]); } // трещина — видна вблизи
    return 0.14;
  },

  /* ---------------- холсты: фото, рисунок, письма, ковёр (только картинки, без слов) ---------------- */
  tex(lab, w, h, draw) {
    const T = lab.THREE, cv = document.createElement('canvas'); cv.width = w; cv.height = h;
    const g = cv.getContext('2d');
    if (typeof draw === 'function') draw(g, w, h); else this.DRAW[draw].call(this, g, w, h);
    const t = new T.CanvasTexture(cv); t.colorSpace = T.SRGBColorSpace; t.anisotropy = 4;
    return t;
  },
  // фигурка для фотографий: мужчина в черкеске и папахе, девушка с косами, невеста с фатой, внук
  fig(g, x, base, h, o) {
    const r = h * 0.085, hy = base - h * 0.86;
    g.lineCap = 'round';
    if (o.veil) { g.fillStyle = 'rgba(255,255,255,0.75)'; g.beginPath(); g.moveTo(x - r * 0.4, hy - r); g.lineTo(x + h * 0.2, base); g.lineTo(x - h * 0.18, base); g.closePath(); g.fill(); }
    if (o.dress) {
      g.fillStyle = o.body; g.beginPath(); g.moveTo(x - h * 0.08, hy + r * 1.1); g.lineTo(x + h * 0.08, hy + r * 1.1); g.lineTo(x + h * 0.2, base); g.lineTo(x - h * 0.2, base); g.closePath(); g.fill();
      if (o.belt) { g.fillStyle = o.belt; g.fillRect(x - h * 0.09, base - h * 0.55, h * 0.18, h * 0.03); }
    } else {
      g.fillStyle = o.legs || '#2a1e16'; g.fillRect(x - h * 0.09, base - h * 0.3, h * 0.07, h * 0.3); g.fillRect(x + h * 0.02, base - h * 0.3, h * 0.07, h * 0.3);
      g.fillStyle = o.body; g.beginPath(); g.moveTo(x - h * 0.11, hy + r * 1.1); g.lineTo(x + h * 0.11, hy + r * 1.1); g.lineTo(x + (o.coat ? h * 0.17 : h * 0.12), base - h * (o.coat ? 0.22 : 0.42)); g.lineTo(x - (o.coat ? h * 0.17 : h * 0.12), base - h * (o.coat ? 0.22 : 0.42)); g.closePath(); g.fill();
      if (o.coat) { g.fillStyle = '#e8d8b0'; for (let i = 0; i < 5; i++) { g.fillRect(x - h * 0.09, hy + r * 1.6 + i * h * 0.03, h * 0.04, h * 0.012); g.fillRect(x + h * 0.05, hy + r * 1.6 + i * h * 0.03, h * 0.04, h * 0.012); } g.fillStyle = '#c9a24a'; g.fillRect(x - h * 0.12, base - h * 0.5, h * 0.24, h * 0.025); }
    }
    g.fillStyle = '#e8cfa8'; g.beginPath(); g.arc(x, hy, r, 0, Math.PI * 2); g.fill();
    if (o.braids) { g.strokeStyle = '#2a1a12'; g.lineWidth = r * 0.45; g.beginPath(); g.moveTo(x - r * 0.8, hy); g.lineTo(x - r * 1.0, hy + h * 0.38); g.moveTo(x + r * 0.8, hy); g.lineTo(x + r * 1.0, hy + h * 0.38); g.stroke(); g.fillStyle = '#2a1a12'; g.beginPath(); g.arc(x, hy - r * 0.3, r * 1.02, Math.PI, 0); g.fill(); }
    if (o.papakha) { g.fillStyle = '#2e2218'; g.beginPath(); g.moveTo(x - r * 1.05, hy - r * 0.4); g.lineTo(x + r * 1.05, hy - r * 0.4); g.lineTo(x + r * 1.25, hy - r * 2.0); g.lineTo(x - r * 1.25, hy - r * 2.0); g.closePath(); g.fill(); }
    if (o.cap) { g.fillStyle = o.cap; g.fillRect(x - r * 0.8, hy - r * 1.6, r * 1.6, r * 0.9); }
    if (o.hair) { g.fillStyle = o.hair; g.beginPath(); g.arc(x, hy - r * 0.25, r * 1.02, Math.PI, 0); g.fill(); }
  },
  DRAW: {
    youth(g, w, h) { // юноша в черкеске и папахе и девушка с косами; в углу — нацарапанные инициалы в сердечке
      const gr = g.createLinearGradient(0, 0, 0, h); gr.addColorStop(0, '#e2cba0'); gr.addColorStop(1, '#a88a5e'); g.fillStyle = gr; g.fillRect(0, 0, w, h);
      g.fillStyle = 'rgba(110,85,55,0.35)'; g.beginPath(); g.moveTo(0, h * 0.55); g.lineTo(w * 0.25, h * 0.32); g.lineTo(w * 0.5, h * 0.5); g.lineTo(w * 0.78, h * 0.28); g.lineTo(w, h * 0.5); g.lineTo(w, h); g.lineTo(0, h); g.fill();
      g.fillStyle = 'rgba(90,65,40,0.45)'; g.fillRect(0, h * 0.82, w, h * 0.18);
      this.fig(g, w * 0.34, h * 0.9, h * 0.66, { body: '#4a3626', coat: true, papakha: true });
      this.fig(g, w * 0.66, h * 0.9, h * 0.6, { body: '#efe2c4', dress: true, braids: true, belt: '#c9a24a', cap: '#c9a24a' });
      g.strokeStyle = 'rgba(255,250,235,0.9)'; g.lineWidth = 2; const hx = w * 0.84, hy = h * 0.86;
      g.beginPath(); g.moveTo(hx, hy + 7); g.bezierCurveTo(hx - 12, hy - 2, hx - 6, hy - 10, hx, hy - 4); g.bezierCurveTo(hx + 6, hy - 10, hx + 12, hy - 2, hx, hy + 7); g.stroke();
      g.font = 'bold 9px serif'; g.fillStyle = 'rgba(255,250,235,0.9)'; g.textAlign = 'center'; g.fillText('А+С', hx, hy + 1);
      g.strokeStyle = '#f8f0e0'; g.lineWidth = 10; g.strokeRect(5, 5, w - 10, h - 10);
    },
    wedding(g, w, h) { // свадьба: жених в папахе, невеста в белом с фатой, арка; засушенный цветок в углу
      const gr = g.createLinearGradient(0, 0, 0, h); gr.addColorStop(0, '#f0e2c4'); gr.addColorStop(1, '#c4a678'); g.fillStyle = gr; g.fillRect(0, 0, w, h);
      g.strokeStyle = 'rgba(140,105,60,0.5)'; g.lineWidth = 8; g.beginPath(); g.arc(w / 2, h * 0.45, w * 0.36, Math.PI, 0); g.moveTo(w * 0.14, h * 0.45); g.lineTo(w * 0.14, h); g.moveTo(w * 0.86, h * 0.45); g.lineTo(w * 0.86, h); g.stroke();
      this.fig(g, w * 0.36, h * 0.92, h * 0.64, { body: '#3a2a1e', coat: true, papakha: true });
      this.fig(g, w * 0.64, h * 0.92, h * 0.6, { body: '#fbf6ec', dress: true, veil: true, belt: '#d9a441', cap: '#d9a441', hair: '#2a1a12' });
      for (let i = 0; i < 5; i++) { g.fillStyle = '#c84a5a'; g.beginPath(); g.arc(w * 0.16 + Math.cos(i * 1.26) * 6, h * 0.12 + Math.sin(i * 1.26) * 6, 4, 0, Math.PI * 2); g.fill(); }
      g.fillStyle = '#e8b030'; g.beginPath(); g.arc(w * 0.16, h * 0.12, 3, 0, Math.PI * 2); g.fill();
      g.strokeStyle = '#fbf8f0'; g.lineWidth = 10; g.strokeRect(5, 5, w - 10, h - 10);
    },
    grandson(g, w, h) { // взрослый внук на фоне Фишта — в дедовой папахе; маленький самолёт в небе
      const gr = g.createLinearGradient(0, 0, 0, h); gr.addColorStop(0, '#5aa8e8'); gr.addColorStop(0.6, '#bfe2f8'); gr.addColorStop(1, '#bfe2f8'); g.fillStyle = gr; g.fillRect(0, 0, w, h);
      g.fillStyle = '#7a8aa8'; g.beginPath(); g.moveTo(0, h * 0.62); g.lineTo(w * 0.3, h * 0.36); g.lineTo(w * 0.55, h * 0.58); g.lineTo(w * 0.8, h * 0.4); g.lineTo(w, h * 0.6); g.lineTo(w, h); g.lineTo(0, h); g.fill();
      g.fillStyle = '#ffffff'; g.beginPath(); g.moveTo(w * 0.22, h * 0.43); g.lineTo(w * 0.3, h * 0.36); g.lineTo(w * 0.38, h * 0.43); g.fill(); g.beginPath(); g.moveTo(w * 0.73, h * 0.45); g.lineTo(w * 0.8, h * 0.4); g.lineTo(w * 0.87, h * 0.45); g.fill();
      g.fillStyle = '#4a9a4a'; g.fillRect(0, h * 0.78, w, h * 0.22);
      g.fillStyle = '#ffffff'; g.fillRect(w * 0.7, h * 0.14, 22, 4); g.fillRect(w * 0.7 + 8, h * 0.14 - 6, 4, 16);
      this.fig(g, w * 0.5, h * 0.95, h * 0.72, { body: '#c0392b', legs: '#2c4f86', papakha: true });
      g.strokeStyle = '#ffffff'; g.lineWidth = 10; g.strokeRect(5, 5, w - 10, h - 10);
    },
    drawing(g, w, h) { // детский рисунок мелками: дом, дерево, солнце, трое за руки и лошадка
      g.fillStyle = '#fbf6ea'; g.fillRect(0, 0, w, h);
      g.lineCap = 'round'; g.lineJoin = 'round';
      const L = (col, wd, pts) => { g.strokeStyle = col; g.lineWidth = wd; g.beginPath(); pts.forEach(([x, y], i) => (i ? g.lineTo(x * w, y * h) : g.moveTo(x * w, y * h))); g.stroke(); };
      L('#5ab04a', 7, [[0.02, 0.86], [0.3, 0.83], [0.6, 0.87], [0.98, 0.84]]);
      g.fillStyle = '#f2c230'; g.beginPath(); g.arc(w * 0.84, h * 0.18, 18, 0, Math.PI * 2); g.fill();
      for (let i = 0; i < 8; i++) { const a = i / 8 * Math.PI * 2; L('#f2c230', 4, [[0.84 + Math.cos(a) * 0.1, 0.18 + Math.sin(a) * 0.14], [0.84 + Math.cos(a) * 0.15, 0.18 + Math.sin(a) * 0.21]]); }
      L('#8a5a2a', 8, [[0.12, 0.84], [0.12, 0.5]]); g.fillStyle = '#3e9a3a'; g.beginPath(); g.arc(w * 0.12, h * 0.4, 24, 0, Math.PI * 2); g.fill();
      g.fillStyle = '#f0d8a8'; g.fillRect(w * 0.24, h * 0.48, w * 0.22, h * 0.34); L('#d03a2a', 6, [[0.21, 0.5], [0.35, 0.28], [0.49, 0.5], [0.21, 0.5]]);
      g.fillStyle = '#3a8ad0'; g.fillRect(w * 0.3, h * 0.56, w * 0.07, h * 0.1);
      const kid = (x, s, col) => { L(col, 4, [[x, 0.82], [x + 0.02 * s, 0.72], [x + 0.04 * s, 0.82]]); L(col, 4, [[x + 0.02 * s, 0.72], [x + 0.02 * s, 0.58 + (1 - s) * 0.08]]); g.fillStyle = col; g.beginPath(); g.arc((x + 0.02 * s) * w, (0.53 + (1 - s) * 0.08) * h, 7 * s, 0, Math.PI * 2); g.fill(); };
      kid(0.54, 1, '#2a2a6a'); kid(0.64, 0.7, '#d03a6a'); kid(0.72, 1, '#6a2a2a');
      L('#2a2a2a', 3, [[0.565, 0.65], [0.735, 0.65]]);
      L('#d03a2a', 6, [[0.82, 0.74], [0.94, 0.74]]); L('#d03a2a', 4, [[0.94, 0.74], [0.97, 0.66]]); L('#7a4a2a', 4, [[0.8, 0.83], [0.88, 0.8], [0.96, 0.83]]);
      L('#d03a2a', 3, [[0.84, 0.74], [0.84, 0.8]]); L('#d03a2a', 3, [[0.92, 0.74], [0.92, 0.8]]);
    },
    letter(g, w, h) { // конверт: волны почерка, марка, штемпель и пятно от слезы
      g.fillStyle = '#efe0bf'; g.fillRect(0, 0, w, h);
      g.strokeStyle = 'rgba(150,115,70,0.6)'; g.lineWidth = 2; g.beginPath(); g.moveTo(0, 0); g.lineTo(w / 2, h * 0.5); g.lineTo(w, 0); g.stroke();
      g.strokeStyle = '#2a3a7a'; g.lineWidth = 2;
      for (let r = 0; r < 3; r++) { g.beginPath(); for (let x = 0; x <= 110; x += 3) { const y = h * (0.62 + r * 0.1) + Math.sin(x * 0.45 + r) * 3 + Math.sin(x * 0.13) * 2; x ? g.lineTo(w * 0.18 + x, y) : g.moveTo(w * 0.18, y); } g.stroke(); }
      g.fillStyle = '#c0392b'; g.fillRect(w * 0.76, h * 0.12, 42, 50); g.strokeStyle = '#fbf3e0'; g.lineWidth = 3; g.strokeRect(w * 0.76 + 4, h * 0.12 + 4, 34, 42);
      g.fillStyle = '#f2c230'; g.beginPath(); for (let i = 0; i < 10; i++) { const a = -Math.PI / 2 + i * Math.PI / 5, rr = i % 2 ? 6 : 13; g.lineTo(w * 0.76 + 21 + Math.cos(a) * rr, h * 0.12 + 25 + Math.sin(a) * rr); } g.fill();
      g.strokeStyle = 'rgba(60,60,60,0.55)'; g.lineWidth = 2; g.beginPath(); g.arc(w * 0.68, h * 0.3, 20, 0, Math.PI * 2); g.stroke();
      const sx = w * 0.42, sy = h * 0.4, sg = g.createRadialGradient(sx, sy, 2, sx, sy, 22); sg.addColorStop(0, 'rgba(160,120,70,0.05)'); sg.addColorStop(0.8, 'rgba(160,120,70,0.3)'); sg.addColorStop(1, 'rgba(160,120,70,0)');
      g.fillStyle = sg; g.beginPath(); g.ellipse(sx, sy, 22, 17, 0.4, 0, Math.PI * 2); g.fill();
    },
    gletter(g, w, h) { // письмо внука: фломастером самолёт над горами, дом и сердце
      g.fillStyle = '#fbfbf7'; g.fillRect(0, 0, w, h);
      g.lineCap = 'round'; g.lineWidth = 4;
      g.strokeStyle = '#3a6ad0'; g.beginPath(); g.moveTo(w * 0.05, h * 0.75); g.lineTo(w * 0.25, h * 0.45); g.lineTo(w * 0.42, h * 0.72); g.lineTo(w * 0.58, h * 0.5); g.lineTo(w * 0.75, h * 0.75); g.stroke();
      g.strokeStyle = '#2a2a2a'; g.lineWidth = 3; g.beginPath(); g.moveTo(w * 0.5, h * 0.22); g.lineTo(w * 0.7, h * 0.22); g.moveTo(w * 0.58, h * 0.12); g.lineTo(w * 0.62, h * 0.32); g.moveTo(w * 0.5, h * 0.17); g.lineTo(w * 0.5, h * 0.27); g.stroke();
      g.setLineDash([4, 6]); g.beginPath(); g.moveTo(w * 0.48, h * 0.22); g.quadraticCurveTo(w * 0.25, h * 0.15, w * 0.1, h * 0.3); g.stroke(); g.setLineDash([]);
      g.fillStyle = '#f0d8a8'; g.fillRect(w * 0.78, h * 0.55, w * 0.14, h * 0.25); g.fillStyle = '#d03a2a'; g.beginPath(); g.moveTo(w * 0.76, h * 0.56); g.lineTo(w * 0.85, h * 0.4); g.lineTo(w * 0.94, h * 0.56); g.fill();
      g.fillStyle = '#e83a5a'; const hx = w * 0.86, hy = h * 0.2; g.beginPath(); g.moveTo(hx, hy + 14); g.bezierCurveTo(hx - 22, hy, hx - 10, hy - 16, hx, hy - 5); g.bezierCurveTo(hx + 10, hy - 16, hx + 22, hy, hx, hy + 14); g.fill();
    },
    embroidery(g, w, h) { // вышивка крестиком: красно-чёрный узор
      g.fillStyle = '#f6f0e2'; g.fillRect(0, 0, w, h);
      const c = 8;
      for (let y = 0; y < 16; y++) for (let x = 0; x < 16; x++) { const d = Math.abs(x - 7.5) + Math.abs(y - 7.5); if ((d | 0) % 4 === 1 || (d < 3)) { g.fillStyle = d < 3 ? '#1a1a1a' : '#c0282a'; g.fillRect(x * c + 1, y * c + 1, c - 2, c - 2); } }
    },
    rug(g, w, h) { // адыгский ковёр: красное поле, золотая и тёмная кайма, ромбы
      g.fillStyle = '#9e2a2b'; g.fillRect(0, 0, w, h);
      g.fillStyle = '#2b1a2a'; g.fillRect(0, 0, w, 22); g.fillRect(0, h - 22, w, 22); g.fillRect(0, 0, 22, h); g.fillRect(w - 22, 0, 22, h);
      g.strokeStyle = '#d9a441'; g.lineWidth = 6; g.strokeRect(30, 30, w - 60, h - 60);
      g.fillStyle = '#d9a441';
      for (let x = 40; x < w - 30; x += 26) { g.beginPath(); g.moveTo(x, 11); g.lineTo(x + 8, 4); g.lineTo(x + 16, 11); g.lineTo(x + 8, 18); g.fill(); g.beginPath(); g.moveTo(x, h - 11); g.lineTo(x + 8, h - 18); g.lineTo(x + 16, h - 11); g.lineTo(x + 8, h - 4); g.fill(); }
      const dia = (cx, cy, rx, ry, col) => { g.fillStyle = col; g.beginPath(); g.moveTo(cx - rx, cy); g.lineTo(cx, cy - ry); g.lineTo(cx + rx, cy); g.lineTo(cx, cy + ry); g.fill(); };
      [[w * 0.27, '#d9a441'], [w * 0.5, '#e8c070'], [w * 0.73, '#d9a441']].forEach(([cx, col]) => { dia(cx, h / 2, 62, 90, col); dia(cx, h / 2, 44, 64, '#2b1a2a'); dia(cx, h / 2, 26, 38, '#c84a3a'); dia(cx, h / 2, 10, 14, '#f0e2c4'); });
      for (let i = 0; i < 14; i++) { const x = 60 + (i % 7) * ((w - 120) / 6), y = i < 7 ? 64 : h - 64; dia(x, y, 9, 12, '#e8c070'); }
    },
    label(g, w, h, text) {
      g.fillStyle = '#c8955a'; g.fillRect(0, 0, w, h);
      g.fillStyle = 'rgba(120,80,40,0.25)'; for (let i = 0; i < 12; i++) g.fillRect(0, i * h / 12, w, 2);
      g.font = `bold ${Math.round(h * 0.55)}px "Comic Sans MS", "Segoe Print", sans-serif`; g.textAlign = 'center'; g.textBaseline = 'middle';
      g.fillStyle = '#2a1a10'; g.save(); g.translate(w / 2, h * 0.55); g.rotate(-0.05); g.fillText(text, 0, 0); g.restore();
    },
  },

  /* ---------------- рука ---------------- */
  makeHand(lab) {
    const st = lab.state, T = lab.THREE, k = this.kit(lab), skin = '#f6dcc6', sk2 = '#e8c0a0';
    k.box(0.34, 0.1, 0.3, skin, [0, 0, 0]);
    for (let i = 0; i < 4; i++) k.box(0.068, 0.068, 0.21 - Math.abs(i - 1.5) * 0.025, skin, [-0.12 + i * 0.08, -0.04, -0.24], [0.45, 0, 0]);
    for (let i = 0; i < 4; i++) k.box(0.05, 0.01, 0.04, sk2, [-0.12 + i * 0.08, 0.002, -0.32], [0.45, 0, 0]);
    k.box(0.075, 0.075, 0.17, skin, [0.2, -0.03, -0.04], [0.25, -0.65, 0]);
    k.box(0.26, 0.09, 0.12, skin, [0, 0.01, 0.2]);
    st.handG = lab.group();
    k.mesh(lab, st.handG);
    lab.box(0.32, 0.12, 0.07, lab.mat('#5ef2d6', { glow: 0.9 }), { parent: st.handG, at: [0, 0.01, 0.27], shadow: false }); // браслет — цвет героя
    st.ringG = lab.group();
    lab.mesh(new T.RingGeometry(0.2, 0.27, 32), lab.mat('#5ef2d6', { unlit: true, glow: 0.7, side: 'double' }), { parent: st.ringG, rot: [-Math.PI / 2, 0, 0], shadow: false });
  },

  /* ---------------- коробки ---------------- */
  makeBoxes(lab) {
    const st = lab.state;
    st.boxObjs = [];
    for (let b = 0; b < st.boxN; b++) {
      const B = this.boxMesh(lab, st.story ? this.YEARS[this.yearOf(lab, b)] : String(b + 1), b);
      B.g.position.set(1.95 + (b % 2) * 0.05, b > 1 ? 0.56 : 0, 2.65 - (b > 1 ? 0.02 : 0));
      if (b === 1) B.g.position.set(2.05, 0, 2.7);
      if (b === 2) B.g.position.set(2.05, 0.56, 2.68);
      B.g.rotation.y = b ? 0.15 * b : 0;
      st.boxObjs.push(B);
    }
  },
  boxMesh(lab, label, b) {
    const T = lab.THREE, k = this.kit(lab), cb = '#c8955a';
    k.box(0.8, 0.55, 0.66, cb, [0, 0.275, 0]);
    k.box(0.82, 0.04, 0.68, '#b07c44', [0, 0.02, 0]);
    k.box(0.82, 0.08, 0.1, '#e8d8a8', [0, 0.5, 0.0]);
    const g = lab.group();
    k.mesh(lab, g);
    const pm = new T.MeshStandardMaterial({ map: this.tex(lab, 160, 80, (gg, w, h) => this.DRAW.label(gg, w, h, label)), roughness: 0.9 });
    const pl = new T.Mesh(new T.PlaneGeometry(0.46, 0.23), pm); pl.position.set(0, 0.3, 0.332); g.add(pl);
    const flaps = [-1, 1].map(s => { const pv = lab.group({ parent: g, at: [s * 0.4, 0.55, 0] }); lab.box(0.4, 0.02, 0.64, '#c08a50', { parent: pv, at: [-s * 0.2, 0, 0] }); return pv; });
    return { g, flaps };
  },
  tex2(lab, w, h, fn) { return this.tex(lab, w, h, fn); },

  /* ---------------- фонарик ---------------- */
  makeSpot(lab) {
    const st = lab.state, T = lab.THREE;
    if (!(lab.cfg.dark > 0)) return;
    st.spot = new T.SpotLight('#ffe2a8', 38, 9, 0.62, 0.55, 1.3);
    st.spot.castShadow = false;
    lab.scene.add(st.spot, st.spot.target);
  },

  /* ---------------- чердак: пол, стены, скат крыши, окно, луч, мебель ---------------- */
  room(lab, scene) {
    const st = lab.state, T = lab.THREE;
    const sh = this.kit(lab), fu = this.kit(lab);
    // плита пола в разрезе и стены дома под ней: чердак висит над домом
    sh.box(10.6, 0.36, 7.6, '#3a2620', [0, -0.18, 0]);
    sh.box(10.3, 1.4, 7.3, '#cdbb98', [0, -1.06, 0]);
    sh.box(10.7, 0.1, 7.7, '#5a3a28', [0, -0.36, 0]);
    for (let i = 0; i < 8; i++) sh.box(0.18, 0.2, 7.62, '#4a3022', [-4.6 + i * 1.3, -0.2, 0]);
    // задняя стена до колена крыши, доски и брус
    sh.box(10.6, 2.0, 0.2, '#93603a', [0, 1.0, -3.65]);
    for (let i = 0; i < 21; i++) sh.box(0.05, 2.0, 0.03, '#5e3a22', [-5.0 + i * 0.5, 1.0, -3.54]);
    sh.box(10.6, 0.18, 0.32, '#4e3424', [0, 2.0, -3.55]);
    // задний скат крыши: доски, стропила, конёк
    const a = Math.atan2(2.4, 3.9), L = Math.hypot(2.4, 3.9), cz = (-3.6 + 0.3) / 2, cy = (2.0 + 4.4) / 2;
    sh.box(10.6, 0.1, L, '#82583a', [0, cy + 0.05, cz], [-a, 0, 0]);
    for (let i = 0; i < 9; i++) sh.box(0.16, 0.2, L, '#4e3424', [-4.8 + i * 1.2, cy - 0.12, cz + 0.06], [-a, 0, 0]);
    sh.box(10.8, 0.26, 0.26, '#4e3424', [0, 4.4, 0.3]);
    // левый фронтон: побелка с круглым окном
    // левый фронтон: побелка — стена до колена крыши и треугольник до конька (призма из своих вершин)
    const gk = this.kit(lab);
    gk.box(0.2, 2.0, 7.2, '#e6d7bd', [-5.1, 1.0, 0]);
    const tri = new T.BufferGeometry(), x0 = -5.2, x1 = -5.0, P = [[-3.6, 2.0], [3.6, 2.0], [0.3, 4.4]], v = [];
    const q = (a, b, c) => v.push(...a, ...b, ...c);
    const A0 = [x1, P[0][1], P[0][0]], B0 = [x1, P[1][1], P[1][0]], C0 = [x1, P[2][1], P[2][0]], A1 = [x0, P[0][1], P[0][0]], B1 = [x0, P[1][1], P[1][0]], C1 = [x0, P[2][1], P[2][0]];
    q(A0, B0, C0); q(A1, C1, B1); q(A0, C0, C1); q(A0, C1, A1); q(B0, B1, C1); q(B0, C1, C0);
    tri.setAttribute('position', new T.Float32BufferAttribute(v, 3)); tri.computeVertexNormals();
    gk.add(tri, '#e6d7bd');
    const gm = gk.mesh(lab, null, true); gm.material.emissive.set('#5a4a3a'); lab.noShadow(gm); gm.receiveShadow = true; // побелка чуть светится отражённым светом
    sh.box(0.06, 0.16, 7.2, '#8a5a34', [-4.97, 0.08, 0]);
    // окно: рама и крестовина
    sh.torus(0.6, 0.08, '#4e3424', [-4.98, 2.5, -0.6], [0, Math.PI / 2, 0], Math.PI * 2, 20);
    sh.box(0.06, 1.12, 0.06, '#4e3424', [-4.98, 2.5, -0.6]); sh.box(0.06, 0.06, 1.12, '#4e3424', [-4.98, 2.5, -0.6]);
    const shell = sh.mesh(lab, null, true); lab.noShadow(shell); shell.receiveShadow = true;
    // доски пола — пачка копий двух-трёх оттенков, со стыками вразбежку
    const planks = lab.instances(new T.BoxGeometry(1, 1, 1), lab.mat('#ffffff', { rough: 0.9 }), 42, { shadow: false });
    planks.receiveShadow = true;
    const pc = ['#c68e55', '#b47a45', '#d29c62', '#ad7442'];
    for (let i = 0; i < 21; i++) {
      const z = -3.6 + 0.175 + i * 0.35, cut = lab.rand(-3.5, 3.5);
      lab.place(planks, i * 2, [(-5.2 + cut) / 2, 0.025, z], { scale: [cut + 5.2 - 0.02, 0.05, 0.335], color: lab.pick(pc) });
      lab.place(planks, i * 2 + 1, [(cut + 5.2) / 2, 0.025, z], { scale: [5.2 - cut - 0.02, 0.05, 0.335], color: lab.pick(pc) });
    }
    // стекло окна светится цветом времени суток
    st.glassMat = new T.MeshBasicMaterial({ color: '#ffe8b0', fog: false });
    const glass = new T.Mesh(new T.CircleGeometry(0.56, 24), st.glassMat); glass.position.set(-4.985, 2.5, -0.6); glass.rotation.y = Math.PI / 2; glass.userData.noShadow = true; scene.add(glass);
    // косой луч из окна, пятно света на полу и пылинки в луче
    const A = new T.Vector3(-4.95, 2.5, -0.6), Bp = new T.Vector3(-1.9, 0.0, 0.3), dir = A.clone().sub(Bp), len = dir.length();
    st.beamA = A.clone().lerp(Bp, 0.05); st.beamB = Bp.clone().lerp(A, 0.1);
    st.beamMat = new T.MeshBasicMaterial({ color: '#ffe2a0', transparent: true, opacity: 0.16, blending: T.AdditiveBlending, depthWrite: false, side: T.DoubleSide, fog: false });
    const beam = new T.Mesh(new T.CylinderGeometry(0.52, 0.85, len, 20, 1, true), st.beamMat);
    beam.position.copy(A).add(Bp).multiplyScalar(0.5); beam.quaternion.setFromUnitVectors(new T.Vector3(0, 1, 0), dir.normalize());
    beam.userData.noShadow = true; beam.renderOrder = 5; scene.add(beam);
    st.patchMat = new T.MeshBasicMaterial({ color: '#ffe2a0', transparent: true, opacity: 0.25, blending: T.AdditiveBlending, depthWrite: false, fog: false });
    const patch = new T.Mesh(new T.CircleGeometry(1, 28), st.patchMat);
    patch.rotation.set(-Math.PI / 2, 0, Math.atan2(-(Bp.z - A.z), Bp.x - A.x)); patch.scale.set(1.35, 0.85, 1); patch.position.set(Bp.x, 0.07, Bp.z); patch.userData.noShadow = true; scene.add(patch);
    st.moteN = 46; st.moteP = [];
    st.moteMat = new T.MeshBasicMaterial({ color: '#ffe2a0', transparent: true, opacity: 0.9, blending: T.AdditiveBlending, depthWrite: false, fog: false });
    st.motes = lab.instances(new T.BoxGeometry(1, 1, 1), st.moteMat, st.moteN, { shadow: false }); st.motes.frustumCulled = false;
    for (let i = 0; i < st.moteN; i++) st.moteP.push({ u: lab.rand(0, 1), sp: lab.rand(0.008, 0.03), ph: lab.rand(0, 6.28), r: lab.rand(0.05, 0.45), dy: lab.rand(-0.2, 0.3), s: lab.rand(0.018, 0.04) });
    // ковёр
    const rug = new T.Mesh(new T.PlaneGeometry(3.6, 2.6), new T.MeshStandardMaterial({ map: this.tex(lab, 512, 370, 'rug'), roughness: 0.95 }));
    rug.rotation.x = -Math.PI / 2; rug.position.set(-0.3, 0.056, 0.85); rug.userData.noShadow = true; rug.receiveShadow = true; scene.add(rug);
    // мебель — одна сетка, цвета в вершинах
    const wood = '#9a6a3c', wd2 = '#7a4e2c', dk = '#4e3424', gold = '#d9a441';
    // сундук-приданое: красный, кованые полосы, замок
    fu.box(1.5, 0.6, 0.75, '#8a3a24', [-2.55, 0.36, -3.05]); fu.box(1.56, 0.1, 0.8, '#7a301e', [-2.55, 0.68, -3.05]);
    for (const x of [-3.15, -2.55, -1.95]) fu.box(0.06, 0.62, 0.02, gold, [x, 0.38, -2.67]);
    fu.box(0.12, 0.14, 0.03, gold, [-2.55, 0.52, -2.65]);
    for (const x of [-3.2, -1.9]) fu.box(0.12, 0.08, 0.7, dk, [x, 0.04, -3.05]);
    // полки на задней стене
    for (const y of [0.83, 1.43]) { fu.box(1.95, 0.05, 0.44, wood, [0.02, y - 0.025, -3.32]); fu.box(0.05, 0.12, 0.4, dk, [-0.85, y - 0.1, -3.34]); fu.box(0.05, 0.12, 0.4, dk, [0.88, y - 0.1, -3.34]); }
    fu.box(0.05, 1.5, 0.44, wd2, [-0.98, 0.75, -3.32]); fu.box(0.05, 1.5, 0.44, wd2, [1.02, 0.75, -3.32]);
    // круглый низкий столик на трёх ножках (анэ)
    fu.cyl(0.74, 0.72, 0.07, '#a8703c', [-0.1, 0.385, 0.9], null, 18); fu.cyl(0.62, 0.62, 0.01, '#b8804a', [-0.1, 0.424, 0.9], null, 18);
    for (let i = 0; i < 3; i++) { const an = i / 3 * Math.PI * 2 + 0.3; fu.cyl(0.05, 0.04, 0.38, dk, [-0.1 + Math.cos(an) * 0.48, 0.19, 0.9 + Math.sin(an) * 0.48], [Math.sin(an) * 0.12, 0, -Math.cos(an) * 0.12], 6); }
    // стол под окном
    fu.box(0.8, 0.06, 1.5, wood, [-4.45, 0.73, -0.62]);
    for (const [x, z] of [[-4.75, -1.3], [-4.15, -1.3], [-4.75, 0.06], [-4.15, 0.06]]) fu.box(0.06, 0.7, 0.06, dk, [x, 0.35, z]);
    // подоконник
    fu.box(0.32, 0.05, 1.0, wood, [-4.84, 1.875, -0.6]);
    // тахта с матрасом, подушками и валиком
    fu.box(2.6, 0.32, 1.12, wd2, [3.15, 0.18, -2.88]); fu.box(2.5, 0.12, 1.02, '#2f6f8a', [3.15, 0.4, -2.88]);
    fu.box(0.9, 0.42, 0.18, '#b8322e', [2.65, 0.66, -3.38], [-0.2, 0, 0]); fu.box(0.9, 0.42, 0.18, '#b8322e', [3.7, 0.66, -3.38], [-0.2, 0, 0]);
    fu.cyl(0.13, 0.13, 0.95, '#e0b04a', [4.35, 0.56, -2.88], [Math.PI / 2, 0, 0], 10);
    // тумбочка
    fu.box(0.55, 0.58, 0.45, '#8a5a34', [1.5, 0.29, -3.1]); fu.box(0.45, 0.02, 0.01, dk, [1.5, 0.4, -2.87]); fu.ball(0.03, gold, [1.5, 0.32, -2.86], 1, 0);
    // вешалка с крючками на фронтоне
    fu.box(0.05, 0.14, 2.4, wood, [-4.95, 1.65, 1.9]);
    for (const z of [1.1, 1.9, 2.7]) fu.cyl(0.025, 0.025, 0.16, dk, [-4.86, 1.62, z], [0, 0, Math.PI / 2 + 0.4], 6);
    // люк в полу: рама, тёплый свет снизу, верх лестницы
    fu.box(1.3, 0.08, 1.1, dk, [3.4, 0.06, 2.4]);
    for (const x of [3.0, 3.8]) fu.box(0.08, 0.7, 0.08, wd2, [x, 0.35, 2.85]);
    fu.box(0.88, 0.06, 0.06, wd2, [3.4, 0.62, 2.85]);
    // старые чемоданы и метла в углу
    fu.box(0.9, 0.3, 0.55, '#5a4a6a', [4.25, 0.15, -0.9]); fu.box(0.75, 0.26, 0.48, '#6a3a2a', [4.25, 0.43, -0.88], [0, 0.2, 0]);
    fu.box(0.2, 0.04, 0.06, gold, [4.25, 0.32, -0.62]);
    fu.cyl(0.02, 0.02, 1.4, '#c8a060', [4.6, 0.75, -1.9], [0.1, 0, -0.15], 5); fu.cone(0.15, 0.4, '#d8b860', [4.69, 0.2, -1.97], [0.1, 0, -0.15], 6);
    // сплетённая корзина у стола
    fu.cyl(0.22, 0.17, 0.3, '#c8a060', [-3.6, 0.15, 2.8], null, 10);
    const furn = fu.mesh(lab);
    furn.receiveShadow = true;
    // проём люка светится тёплым снизу
    st.hatchMat = new T.MeshBasicMaterial({ color: '#ff9e4a', fog: false });
    const hatch = new T.Mesh(new T.PlaneGeometry(1.1, 0.9), st.hatchMat); hatch.rotation.x = -Math.PI / 2; hatch.position.set(3.4, 0.105, 2.4); hatch.userData.noShadow = true; scene.add(hatch);
    // перец и кукуруза сушатся на нитках под коньком
    st.hangG = lab.group({ at: [-3.9, 4.3, 0.3] });
    const pep = lab.instances(new T.ConeGeometry(0.05, 0.22, 5), lab.mat('#ffffff', { rough: 0.6 }), 24, { parent: st.hangG });
    for (let s = 0; s < 3; s++) for (let i = 0; i < 8; i++) {
      const x = s * 0.45, y = -0.25 - i * 0.13;
      lab.place(pep, s * 8 + i, [x + Math.sin(i * 2.1) * 0.04, y, Math.cos(i * 1.7) * 0.04], { rot: [Math.PI + Math.sin(i) * 0.3, i, Math.cos(i) * 0.3], color: s === 1 ? (i % 2 ? '#e8b030' : '#f0c040') : (i % 3 ? '#c8281e' : '#a81e18') });
    }
    const strings = [0, 1, 2].map(s => lab.box(0.01, 1.2, 0.01, '#c8a060', { parent: st.hangG, at: [s * 0.45, -0.55, 0], shadow: false }));
    lab.merge(strings, st.hangG);
    // пылинка над опустевшим местом
    st.goneMote = lab.box(0.05, 0.05, 0.05, lab.mat('#fff4d8', { unlit: true, glow: 1.4 }), { shadow: false }); st.goneMote.visible = false;
  },

  /* ---------------- набор деталей: одна сетка на предмет, цвета в вершинах ---------------- */
  kit(lab) {
    const T = lab.THREE, parts = [], M = new T.Matrix4(), Q = new T.Quaternion(), E = new T.Euler(), V = new T.Vector3(), S = new T.Vector3(), C = new T.Color();
    const k = {
      add(geo, color, at, rot, sc) {
        let g = geo.index ? geo.toNonIndexed() : geo;
        if (g !== geo) geo.dispose();
        for (const a of Object.keys(g.attributes)) if (a !== 'position' && a !== 'normal') g.deleteAttribute(a);
        const r = rot == null ? [0, 0, 0] : Array.isArray(rot) ? rot : [0, rot, 0];
        E.set(r[0], r[1], r[2]);
        const s = sc == null ? [1, 1, 1] : Array.isArray(sc) ? sc : [sc, sc, sc];
        M.compose(V.set(...(at || [0, 0, 0])), Q.setFromEuler(E), S.set(s[0], s[1], s[2]));
        g.applyMatrix4(M);
        C.set(color);
        const n = g.attributes.position.count, arr = new Float32Array(n * 3);
        for (let i = 0; i < n; i++) { arr[i * 3] = C.r; arr[i * 3 + 1] = C.g; arr[i * 3 + 2] = C.b; }
        g.setAttribute('color', new T.BufferAttribute(arr, 3));
        parts.push(g);
        return k;
      },
      box(w, h, d, col, at, rot, sc) { return k.add(new T.BoxGeometry(w, h, d), col, at, rot, sc); },
      cyl(rt, rb, h, col, at, rot, seg) { return k.add(new T.CylinderGeometry(rt, rb, h, seg || 10), col, at, rot); },
      cone(r, h, col, at, rot, seg) { return k.add(new T.ConeGeometry(r, h, seg || 8), col, at, rot); },
      ball(r, col, at, sc, det) { return k.add(new T.IcosahedronGeometry(r, det == null ? 1 : det), col, at, null, sc); },
      torus(r, tube, col, at, rot, arc, seg) { return k.add(new T.TorusGeometry(r, tube, 6, seg || 16, arc || Math.PI * 2), col, at, rot); },
      lathe(pts, col, at, seg) { return k.add(new T.LatheGeometry(pts.map(p => new T.Vector2(p[0], p[1])), seg || 12), col, at); },
      mesh(lab2, parent, double) {
        const geo = lab.addons.BufferGeometryUtils.mergeGeometries(parts);
        parts.forEach(p => p.dispose()); parts.length = 0;
        const m = new T.Mesh(geo, new T.MeshStandardMaterial({ vertexColors: true, flatShading: true, roughness: 0.78, side: double ? T.DoubleSide : T.FrontSide }));
        (parent || lab.scene).add(m);
        return m;
      },
    };
    return k;
  },
};
