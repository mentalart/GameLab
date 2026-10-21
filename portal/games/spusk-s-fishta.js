// «Спуск с Фишта» — ремейк-донор урока 21 по мотивам Alto's Adventure (Snowman, 2015) на оболочке «Лаб3D» 1.0 (three.js).
// Юноша с длинным красным шарфом спускается на сноуборде по бесконечному склону горы Фишт. Одна кнопка: нажал — прыжок,
// держишь в воздухе — сальто назад. Доска легла вдоль склона — сальто засчитано и ускоряет, криво — кувырок в снег.
// Спрятанная механика донора — цельность мира («библия мира»), ручка secret: одна палитра настроения на всём (небо, снег, горы, ели,
// туман, свет), единые лоуполи-формы с плоскими гранями, тёмный силуэт героя с единственным тёплым пятном — шарфом, и смена
// настроения (рассвет → день → закат → ночь) каждые 10–12 с вместе с музыкой и погодой. secret = 0 (пресет «Без спрятанной механики») —
// библии нет: всё случайного цвета, формы вразнобой, вечный плоский полдень, случайный писк вместо музыки. Механика та же самая.
// Ручка odd — квиз «Найди лишнее»: один элемент кадра спорит со стилем мира.
// Из лучших игр жанра: смена дня и погоды как музыка, Zen Mode и фоторежим (Alto's Adventure), дюны и песчаный ветер (Alto's Odyssey),
// буря (Journey), четыре оттенка зелёного (Game Boy), чёрно-белый мир с одним цветом (Limbo).
// Вариации урока — ручки mood, zen, speed: имя вариации и её правило — баннер в начале, строка над полем и экран конца. Пресеты с теми же именами — в Tab.
// Вид сбоку: X — вправо (вниз по склону), Y — вверх, трасса героя на Z = 0, хребты фона — в −Z.
/* ПЛАН
 Фраза: ты — юноша на сноуборде, ты спускаешься по склону Фишта навстречу закату, но склон рвётся расщелинами и прячет камни.
   Цель — уехать как можно дальше и красиво: сальто, фонарики, верёвки.
 Ядро на 3 секунды: нажал — прыжок с хрустом снега и нотой; держишь — герой крутит сальто, шарф чертит красную петлю;
   отпустил вовремя — доска ложится на склон: «Сальто!», искры снега, нота выше и рывок вперёд.
 Выбор, оплаченный очками: крутить сальто (очки × серия и ускорение) или ехать ровно без риска; трамплин и высокие фонарики —
   дальше и выше, но труднее приземлиться; верёвка с флажками — скольжение за очки, но на неё надо попасть доской.
 Угрозы: камень на снегу (стоит, перепрыгни), расщелина (перелети, ширина растёт), кривое приземление (своя ошибка),
   порыв ветра (толкает назад, предупреждён надписью за секунду).
 Кривая партии: 0–12 с — обучение: трамплины и фонарики, кривое приземление прощается до 8-й секунды; 12–40 с — камни и узкие расщелины;
   40–90 с — двойные камни, верёвки над расщелинами, расщелины шире, скорость растёт; 90+ — пик, всё вперемешку и чаще.
   Новое настроение мира — каждые 10–12 с.
 События: прыжок (хруст, нота лада, пыль, растяжение), сальто (шарф-петля), чистое приземление (стоп-кадр, искры, волна, надпись, нота выше
   за серию), двойное сальто (замедление, вспышка), кривое (кувырок, снежная пыль, замедление, тряска), фонарик (звон, ореол, искры),
   скольжение (искры по верёвке), впритык над камнем (+очки), смена настроения (небо, свет, туман и погода перетекают 3,5 с, аккорд),
   серия прервана (низкая нота), порыв ветра (позёмка, гул).
 Лицо игры: «тихий закат на Фиште» — плоские силуэты хребтов в четырёх ступенях одной палитры, тёплое небо, белый лоуполи-склон
   и тёмный силуэт героя с красным шарфом. Палитра заката: небо #38296c → #ff9466, снег #ffe1d2, горы #874c86, акцент #ffe08a,
   шарф #ff3b2f. Свет: ключевой — низкое солнце цвета заката, заполняющий — небо.
   Три фирменных приёма: красный светящийся шарф-след; хребты-силуэты, тающие в дымку цвета неба; плавная смена настроения
   вместе с музыкой и погодой.
 Звук: «тихие колокольчики в ладу настроения»; прыжок и приземление — ноты того же лада, на смене настроения — мягкий аккорд.
   Приоритет: падение → прыжок и приземление → фонарики → музыка.
*/
const GAME = {
  engine: 'three',
  title: 'Спуск с Фишта',
  subtitle: 'Закат, снег, тишина. Одна кнопка — и ты едешь, потому что красиво',
  donor: "Alto's Adventure",
  players: 1,
  controls: [
    { input: 'a', text: 'прыжок, держи — сальто' },
    { input: 'b', text: 'фоторежим' },
  ],
  scoreColor: '#ffe08a',
  camera: { type: 'side', tilt: Math.PI / 2 - 0.09, distance: 22, target: [0, 0, 0] }, // камеру ведёт игра: см. camStep()
  field: { w: 40, h: 20 },
  shadowSize: 26,
  sky: ['#38296c', '#ff9466'],
  fog: 0.006,
  accent: '#ffe08a',
  lives: 1,
  decisions: [
    'Чувство: отпустил кнопку вовремя — доска легла на склон, шарф прочертил петлю, и ты летишь дальше быстрее',
    'Честность: камни и расщелины видны за пару секунд, а кривое приземление — только твоя ошибка, склон всегда тот, что на экране',
    'Выбор: крутить сальто за очки и скорость или ехать ровно — и смотреть, как закат сменяется ночью',
  ],
  notes: [
    'Сальто начинается, если держать кнопку дольше 0,12 с: короткое нажатие — только прыжок, случайные тычки не крутят героя.',
    'Чуть ошибся с моментом — герой сам доворачивает доску к склону, если ошибка меньше полутора допусков (так прощает Alto).',
    'В фоторежиме замирают герой, склон и снежинки, а небо и музыка идут дальше: можно дождаться нужного света для кадра.',
  ],
  config: {
    secret: { value: 1, min: 0, max: 1, step: 1, label: 'Спрятанная механика: цельность мира (библия мира)', names: ['нет', 'да'], hint: '0 — всё случайного цвета, формы вразнобой, вечный полдень, писк вместо музыки', restart: true },
    odd: { value: 0, min: 0, max: 6, step: 1, label: 'Квиз «Найди лишнее»', names: ['ничего', 'Чужой цвет', 'Силуэт героя', 'Чужая форма', 'Не то небо', 'Не та музыка', 'Чужая деталь'], hint: 'один элемент кадра спорит со стилем мира', restart: true },
    mood: { value: 0, min: 0, max: 5, step: 1, label: 'Мир', names: ['Закат Фишта', 'Ночь', 'Пустыня', 'Буран', 'Game Boy', 'Нуар'], hint: 'Закат Фишта — цикл настроений: рассвет, день, закат, ночь', restart: true },
    cycle: { value: 1, min: 0, max: 1, step: 1, label: 'Смена дня', names: ['время стоит', 'идёт'] },
    weather: { value: 1, min: 0, max: 1, step: 1, label: 'Погода', names: ['ясно', 'по настроению'] },
    wind: { value: 0, min: 0, max: 1, step: 0.1, label: 'Порывы ветра', hint: 'толкают героя назад; надпись предупреждает за секунду' },
    zen: { value: 0, min: 0, max: 1, step: 1, label: 'Дзен: без падений и очков', names: ['выкл', 'Дзен'], hint: 'как Zen Mode в Alto: кривое приземление — просто без трюка, расщелин нет', restart: true },
    speed: { value: 10, min: 5, max: 24, step: 0.5, label: 'Базовая скорость, м/с', hint: 'на спуске быстрее, на подъёме медленнее, но не ниже 60%' },
    tilt: { value: 30, min: 10, max: 60, step: 1, label: 'Допуск приземления, град', hint: 'насколько доска может не совпасть со склоном' },
    lives: { value: 1, min: 1, max: 5, step: 1, label: 'Падений до конца спуска', restart: true },
    limit: { value: 0, min: 0, max: 300, step: 10, label: 'Время на спуск, с (0 — без времени)' },
    jump: { value: 8.5, min: 5, max: 13, step: 0.5, label: 'Сила прыжка, м/с' },
    flip: { value: 7.5, min: 4, max: 12, step: 0.5, label: 'Скорость сальто, рад/с' },
    grav: { value: 18, min: 10, max: 30, step: 1, label: 'Тяжесть, м/с²' },
    boost: { value: 2.5, min: 0, max: 6, step: 0.5, label: 'Ускорение за сальто, м/с' },
    keep: { value: 2, min: 0.5, max: 5, step: 0.5, label: 'Серия держится на снегу, с', hint: 'столько можно ехать по земле между трюками, не теряя серию' },
    teach: { value: 8, min: 0, max: 20, step: 1, label: 'Обучение: первые … с кривое приземление прощается' },
    verse: { value: 10, min: 5, max: 30, step: 1, label: 'Куплет: смена настроения через, с', hint: 'плюс до полутора секунд, чтобы смена не была механической' },
  },
  presets: {
    'Новичок': { tilt: 45, speed: 8 },
    'Без спрятанной механики': { secret: 0 },
    'Ночь': { mood: 1 },
    'Пустыня': { mood: 2 },
    'Буран': { mood: 3, wind: 1 },
    'Game Boy': { mood: 4 },
    'Нуар': { mood: 5 },
    'Дзен': { zen: 1 },
    'Скоростной спуск': { speed: 16 },
  },
  // имя вариации и её правило для строки над полем, баннера в начале и экрана конца партии
  VARIANTS: [
    { key: 'mood', on: c => Math.round(c.mood) === 1, name: 'Ночь', how: () => 'вечная ночь: звёзды, северное сияние, луна, фонарики ярче' },
    { key: 'mood', on: c => Math.round(c.mood) === 2, name: 'Пустыня', how: () => 'дюны и песок вместо снега, ветер несёт песок, кактусы' },
    { key: 'mood', on: c => Math.round(c.mood) === 3, name: 'Буран', how: c => (c.wind > 0 ? 'туман и снег стеной, порывы ветра толкают назад' : 'туман и снег стеной') },
    { key: 'mood', on: c => Math.round(c.mood) === 4, name: 'Game Boy', how: () => 'весь мир в четырёх оттенках зелёного' },
    { key: 'mood', on: c => Math.round(c.mood) === 5, name: 'Нуар', how: () => 'чёрно-белый мир, красный — только шарф' },
    { key: 'zen', on: c => c.zen >= 1, name: 'Дзен', how: () => 'падений нет, очков нет — просто едь' },
    { key: 'speed', on: c => c.speed >= 15, name: 'Скоростной спуск', how: c => `склон быстрее: ${String(c.speed).replace('.', ',')} м/с — решай раньше` },
  ],

  /* ---------- библия мира: настроения. colors — небо верх, небо низ, снег, дальние горы, акцент ---------- */
  MOODS: [
    { name: 'Рассвет', colors: ['#4a5aa8', '#f7b39b', '#f3e4eb', '#8e7ab5', '#ffd27a'], sunCol: '#ffd7a6', sun: [-0.5, 0.12], dir: [-0.7, 0.5, 0.6],
      light: 1.35, hemi: 0.9, fog: 0.007, snow: 0, drift: 0.15, mist: 0.75, stars: 0.12, aurora: 0, glow: 1.6,
      scale: [293.66, 329.63, 369.99, 440, 493.88, 587.33], tempo: 0.62 },
    { name: 'День', colors: ['#2f7cd8', '#cde7ff', '#eef5fc', '#7c9ecb', '#5ff0d0'], sunCol: '#fff6e2', sun: [0.12, 0.62], dir: [0.25, 1, 0.55],
      light: 1.6, hemi: 0.95, fog: 0.004, snow: 0, drift: 0.6, mist: 0.3, stars: 0, aurora: 0, glow: 1.4,
      scale: [392, 440, 493.88, 587.33, 659.25, 783.99], tempo: 0.5 },
    { name: 'Закат', colors: ['#38296c', '#ff9466', '#ffe1d2', '#874c86', '#ffe08a'], sunCol: '#ffb27a', sun: [0.34, 0.07], dir: [0.85, 0.42, 0.55],
      light: 1.5, hemi: 0.85, fog: 0.006, snow: 0.18, drift: 0.05, mist: 0.6, stars: 0.06, aurora: 0, glow: 1.8,
      scale: [220, 261.63, 293.66, 329.63, 392, 440], tempo: 0.7 },
    { name: 'Ночь', colors: ['#060a24', '#1e2c62', '#aabde9', '#1d2652', '#7cf5c8'], sunCol: '#e8efff', sun: [-0.28, 0.46], dir: [-0.4, 0.85, 0.5], moon: 1,
      light: 0.75, hemi: 0.75, fog: 0.008, snow: 0.55, drift: 0.15, mist: 0.35, stars: 1, aurora: 1, glow: 2.4,
      scale: [329.63, 369.99, 392, 493.88, 523.25, 659.25], tempo: 0.85 },
  ],
  // постоянные миры вариаций: у каждого 2–4 своих настроения той же палитры (смена остаётся, мир не спорит с собой)
  SETS: {
    1: [
      { name: 'Звёздная ночь', colors: ['#040820', '#18275a', '#a3b8e6', '#1a2350', '#ffe7a0'], sunCol: '#eef3ff', sun: [0.26, 0.44], dir: [0.4, 0.85, 0.5], moon: 1,
        light: 0.7, hemi: 0.8, fog: 0.007, snow: 0.2, drift: 0.1, mist: 0.3, stars: 1, aurora: 0.4, glow: 2.8,
        scale: [329.63, 369.99, 392, 493.88, 523.25, 659.25], tempo: 0.9 },
      { name: 'Северное сияние', colors: ['#031220', '#0e3a4c', '#9fd8de', '#113046', '#7cf5c8'], sunCol: '#e6fff6', sun: [-0.32, 0.5], dir: [-0.4, 0.85, 0.5], moon: 1,
        light: 0.65, hemi: 0.85, fog: 0.006, snow: 0.4, drift: 0.2, mist: 0.25, stars: 0.8, aurora: 1, glow: 3,
        scale: [293.66, 329.63, 349.23, 440, 493.88, 587.33], tempo: 0.8 },
    ],
    2: [
      { name: 'Утро в дюнах', colors: ['#4f7fc0', '#ffd7a8', '#f2c48d', '#c98b62', '#5ff0d0'], sunCol: '#ffe0b0', sun: [-0.45, 0.14], dir: [-0.7, 0.55, 0.6], sand: 1,
        light: 1.5, hemi: 0.9, fog: 0.006, snow: 0, drift: 0.55, mist: 0.6, stars: 0, aurora: 0, glow: 1.5,
        scale: [293.66, 311.13, 369.99, 392, 440, 466.16], tempo: 0.6 },
      { name: 'Знойный полдень', colors: ['#3b8be0', '#fff0c8', '#f2cf98', '#d79a6a', '#40e0d0'], sunCol: '#fffbe8', sun: [0.1, 0.66], dir: [0.2, 1, 0.5], sand: 1,
        light: 1.7, hemi: 0.95, fog: 0.005, snow: 0, drift: 0.9, mist: 0.45, stars: 0, aurora: 0, glow: 1.4,
        scale: [392, 415.3, 493.88, 523.25, 587.33, 622.25], tempo: 0.5 },
      { name: 'Закат в дюнах', colors: ['#5a2d6e', '#ff8a4c', '#f0a46a', '#9a4a5a', '#ffe08a'], sunCol: '#ffa060', sun: [0.32, 0.07], dir: [0.85, 0.42, 0.55], sand: 1,
        light: 1.5, hemi: 0.85, fog: 0.006, snow: 0, drift: 0.4, mist: 0.6, stars: 0.05, aurora: 0, glow: 1.8,
        scale: [220, 233.08, 277.18, 293.66, 329.63, 349.23], tempo: 0.7 },
      { name: 'Ночь в пустыне', colors: ['#0b0f2a', '#2b2f5e', '#8a84b4', '#2a2448', '#7cf5c8'], sunCol: '#eef0ff', sun: [-0.25, 0.45], dir: [-0.4, 0.85, 0.5], moon: 1, sand: 1,
        light: 0.7, hemi: 0.8, fog: 0.006, snow: 0, drift: 0.3, mist: 0.3, stars: 1, aurora: 0, glow: 2.4,
        scale: [329.63, 349.23, 415.3, 440, 493.88, 523.25], tempo: 0.85 },
    ],
    3: [
      { name: 'Буран', colors: ['#56637a', '#b4bfcf', '#e1e7ef', '#76839a', '#9fe8ff'], sunCol: '#dfe8f5', sun: [0.05, 0.4], dir: [0.2, 1, 0.6],
        light: 0.95, hemi: 1.1, fog: 0.022, snow: 1, drift: 1, mist: 0.9, stars: 0, aurora: 0, glow: 2.2,
        scale: [196, 233.08, 261.63, 293.66, 349.23, 392], tempo: 0.9 },
      { name: 'Просвет', colors: ['#47658f', '#cdd8e6', '#e9eef5', '#8295b2', '#ffe9a0'], sunCol: '#fff3d6', sun: [0.25, 0.3], dir: [0.6, 0.7, 0.5],
        light: 1.3, hemi: 1.0, fog: 0.011, snow: 0.55, drift: 0.6, mist: 0.6, stars: 0, aurora: 0, glow: 1.8,
        scale: [233.08, 261.63, 293.66, 349.23, 392, 466.16], tempo: 0.75 },
    ],
    4: [ // четыре зелёных экрана Game Boy: #0f380f, #306230, #8bac0f, #9bbc0f
      { name: 'Game Boy', colors: ['#8bac0f', '#9bbc0f', '#9bbc0f', '#306230', '#0f380f'], sunCol: '#9bbc0f', sun: [0.3, 0.45], dir: [0.4, 1, 0.6],
        light: 0.25, hemi: 2.6, fog: 0.0001, snow: 0.35, drift: 0.2, mist: 0, stars: 0, aurora: 0, glow: 0, wave: 'square',
        scale: [523.25, 587.33, 659.25, 783.99, 880, 1046.5], tempo: 0.55,
        fix: { flat: 1, tree: '#0f380f', trunk: '#0f380f', rock: '#0f380f', far: ['#0f380f', '#306230', '#306230', '#8bac0f'], cap: '#9bbc0f',
          slope: ['#9bbc0f', '#9bbc0f', '#8bac0f', '#8bac0f'], flake: '#306230', lantern: '#0f380f', cloud: '#9bbc0f', pole: '#0f380f',
          hero: { jacket: '#0f380f', pants: '#0f380f', skin: '#8bac0f', hat: '#0f380f', board: '#0f380f', scarf: '#306230' } } },
      { name: 'Game Boy: сумерки', colors: ['#306230', '#8bac0f', '#8bac0f', '#0f380f', '#9bbc0f'], sunCol: '#9bbc0f', sun: [-0.3, 0.4], dir: [-0.4, 1, 0.6],
        light: 0.25, hemi: 2.6, fog: 0.0001, snow: 0.5, drift: 0.2, mist: 0, stars: 0, aurora: 0, glow: 0, wave: 'square',
        scale: [440, 523.25, 587.33, 659.25, 783.99, 880], tempo: 0.6,
        fix: { flat: 1, tree: '#0f380f', trunk: '#0f380f', rock: '#0f380f', far: ['#0f380f', '#0f380f', '#306230', '#306230'], cap: '#8bac0f',
          slope: ['#8bac0f', '#8bac0f', '#306230', '#306230'], flake: '#9bbc0f', lantern: '#9bbc0f', cloud: '#8bac0f', pole: '#0f380f',
          hero: { jacket: '#0f380f', pants: '#0f380f', skin: '#8bac0f', hat: '#0f380f', board: '#0f380f', scarf: '#306230' } } },
    ],
    5: [ // нуар: только серые, красный — один шарф
      { name: 'Нуар', colors: ['#3a3a3a', '#c4c4c4', '#eeeeee', '#6e6e6e', '#ffffff'], sunCol: '#ffffff', sun: [0.3, 0.3], dir: [0.6, 0.8, 0.5],
        light: 0.8, hemi: 1.5, fog: 0.008, snow: 0.3, drift: 0.2, mist: 0.6, stars: 0, aurora: 0, glow: 1.2, wave: 'triangle',
        scale: [174.61, 207.65, 233.08, 261.63, 311.13, 349.23], tempo: 0.8,
        fix: { flat: 0.6, tree: '#0c0c0c', trunk: '#0c0c0c', rock: '#121212', far: ['#1a1a1a', '#4a4a4a', '#7a7a7a', '#a0a0a0'], cap: '#e6e6e6',
          slope: ['#eeeeee', '#dcdcdc', '#9a9a9a', '#5a5a5a'], flake: '#ffffff', lantern: '#ffffff', cloud: '#d8d8d8', pole: '#111111',
          hero: { jacket: '#0b0b0b', pants: '#0b0b0b', skin: '#bdbdbd', hat: '#0b0b0b', board: '#111111', scarf: '#e0201b' } } },
      { name: 'Нуар: ночь', colors: ['#000000', '#2a2a2a', '#a8a8a8', '#1c1c1c', '#ffffff'], sunCol: '#ffffff', sun: [-0.3, 0.42], dir: [-0.5, 0.8, 0.5], moon: 1,
        light: 0.6, hemi: 1.2, fog: 0.008, snow: 0.45, drift: 0.2, mist: 0.4, stars: 1, aurora: 0, glow: 1.4, wave: 'triangle',
        scale: [155.56, 174.61, 207.65, 233.08, 261.63, 311.13], tempo: 0.9,
        fix: { flat: 0.6, tree: '#050505', trunk: '#050505', rock: '#080808', far: ['#050505', '#1e1e1e', '#333333', '#474747'], cap: '#bdbdbd',
          slope: ['#a8a8a8', '#8f8f8f', '#5a5a5a', '#2c2c2c'], flake: '#ffffff', lantern: '#ffffff', cloud: '#3a3a3a', pole: '#050505',
          hero: { jacket: '#0b0b0b', pants: '#0b0b0b', skin: '#9a9a9a', hat: '#0b0b0b', board: '#111111', scarf: '#e0201b' } } },
    ],
  },
  NOON: { name: 'Полдень', colors: ['#8cc4ff', '#8cc4ff', '#ffffff', '#9aa0a8', '#ffffff'], sunCol: '#ffffff', sun: [0.0, 0.72], dir: [0.1, 1, 0.3],
    light: 1.7, hemi: 1.0, fog: 0.0006, snow: 0, drift: 0, mist: 0, stars: 0, aurora: 0, glow: 1 },
  HERO: { jacket: '#27304d', pants: '#1a2036', skin: '#f2c7a5', hat: '#1a2036', board: '#3d3354', scarf: '#ff3b2f' },
  // слои фона: Z — глубина, P — период узора (хребет повторяется без шва), y0 и amp — высота относительно центра кадра на этой глубине
  LAYERS: [
    { Z: 30, P: 96, step: 3, y0: -10.5, amp: 5, jag: 0.6, m: 2, trees: true, tw: 1 },
    { Z: 75, P: 180, step: 7.5, y0: -15, amp: 12, jag: 2.5, m: 2 },
    { Z: 140, P: 280, step: 14, y0: -19, amp: 28, jag: 6, m: 3, caps: 0.6 },
    { Z: 240, P: 420, step: 21, y0: -20, amp: 56, jag: 10, m: 2, caps: 0.52 },
  ],
  // ряды склона: [z, сдвиг вниз, разброс z, разброс y] — верх снега уходит вглубь, перед — лоуполи-грани вниз
  ROWS: [[-10, 0, 0, 0], [-3.4, 0.04, 1.2, 0.08], [1.0, 0, 0, 0], [1.55, -0.75, 0.25, 0.25], [1.2, -4.2, 0.6, 1.2], [1.0, -70, 0, 0]],
  ROWC: [0, 0, 0, 1, 2, 3],
  COLS: 300,
  TILT: Math.PI / 2 - 0.09,
  RAMP_KICK: 3,
  HUDK: ['rule', 'dist', 'combo', 'mood', 'tip', 'gust', 'time'],
  CRASH: { tilt: 'Кривое приземление!', rock: 'Камень!', gap: 'В расщелину!' },
  COLK: ['sky0', 'sky1', 'snow', 'mount', 'acc', 'tree', 'trunk', 'rock', 'cap', 'sunCol', 'flake', 'lantern', 'cloud', 'pole'],

  start(lab, scene) {
    const st = lab.state, c = lab.cfg;
    const bible = c.secret >= 1, setIdx = bible ? Math.round(c.mood) : 0;
    Object.assign(st, {
      bible, setIdx, odd: Math.round(c.odd), zen: c.zen >= 1,
      pts: [], endX: -60, off: 0, rocks: [], lanterns: [], ropes: [], lips: [], gaps: [], tut: ['ramp', 'lanterns', 'ramp', 'calm', 'lanterns'],
      hero: { x: 0, y: 0, vx: 0, vy: 0, s: c.speed, air: false, rot: 0, rope: null },
      dist: 0, startX: 0, time: 0, from: 0, trans: null, moodT: 0, verseAt: c.verse, changes: 0, names: [],
      chain: 0, bestChain: 0, flips: 0, lanternN: 0, grinds: 0, near: 0, groundT: 0, spin: 0, w: 0, holdT: 0, buf: 0, airT: 0, tuck: 0,
      crash: null, safeT: 0, photo: false, photos: 0, banner: false, posterOn: false, camD: 22, falls: 0, ended: false,
      gust: { k: 0, t: 0, next: 6, phase: 0, end: 0, n: 0 }, music: { t: 0.5, step: 0 }, sprayT: 0, lanRun: 0, lanT: -9, grindT: 0, dustT: 0,
      palDirty: true, slopeDirty: true, cloudOff: 0, ring: { rock: 0, lan: 0, pole: 0, flag: 0, rope: 0, gap: 0 },
    });
    st.moods = (bible ? (setIdx > 0 ? this.SETS[setIdx] : this.MOODS) : [this.NOON]).map(m => this.prep(lab, m));
    st.mood = bible && setIdx === 0 ? 2 : 0; // «Закат Фишта» начинается с заката
    st.pal = this.clonePal(st.moods[st.mood]);
    st.names.push(st.moods[st.mood].name);
    st.ph = [lab.rand(0, 6.28), lab.rand(0, 6.28), lab.rand(0, 6.28)];
    if (!bible) { // без библии: каждый предмет своего случайного цвета
      const R = () => this.randCol(lab);
      st.rnd = { slope: lab.THREE.Color && new lab.THREE.Color(R()), far: [R(), R(), R(), R()], cap: R(), cloud: R(), pole: R(),
        hero: { jacket: R(), pants: R(), skin: R(), hat: R(), board: R(), scarf: R() } };
    }
    this.buildSky(lab, scene);
    this.buildLayers(lab);
    this.buildSlope(lab);
    this.buildObjects(lab);
    this.buildWeather(lab);
    this.buildHero(lab);
    this.push(lab, -60, this.baseY(st, -60));
    this.run(lab, 72); // ровный разгон до x = 12, дальше — обучение
    this.extend(lab);
    const h = st.hero;
    h.y = this.groundAt(st, 0); h.rot = this.angleAt(st, 0);
    lab.hero(st.heroG);
    this.vignette(lab, false);
    lab.stat('смены', 0);
    this.applyPal(lab); this.writeSlope(lab);
    this.pose(lab, 0); this.scarfInit(lab);
    this.camStep(lab, 0, true); this.layersStep(lab, 0);
    if (!lab.playing) this.poster(lab);
  },
  // афиша в меню: герой в середине сальто над трамплином, шарф развевается. Первый кадр партии всё возвращает
  poster(lab) {
    const st = lab.state, h = st.hero, L = st.lips[0];
    if (!L) return;
    st.posterOn = true;
    h.x = L.x + 4.4;
    const g = this.groundAt(st, h.x);
    h.y = Math.max(L.y + 2.6, (g == null ? L.y : g) + 3.3); h.air = true; h.rot = 2.45; h.vx = 13; h.vy = 1.2; st.w = 7; st.tuck = 1;
    this.pose(lab, 0);
    for (let i = 0; i < 40; i++) this.scarfStep(lab, 1 / 30);
    this.camStep(lab, 0, true); this.layersStep(lab, 0);
  },
  unposter(lab) {
    const st = lab.state, h = st.hero;
    st.posterOn = false;
    Object.assign(h, { x: 0, vx: 0, vy: 0, s: lab.cfg.speed, air: false, rope: null });
    h.y = this.groundAt(st, 0); h.rot = this.angleAt(st, 0); st.w = 0; st.tuck = 0;
    this.pose(lab, 0); this.scarfInit(lab);
    this.camStep(lab, 0, true);
  },
  // имя вариации: все включённые ручки вариаций
  variant(lab) {
    const c = lab.cfg, on = this.VARIANTS.filter(v => v.on(c));
    if (!on.length) return { name: 'Классика', how: 'прыгай и крути сальто — мир меняется, как музыка' };
    return { name: on.map(v => v.name).join(' + '), how: on.map(v => v.how(c)).join('; ') };
  },

  update(lab, dt) {
    const st = lab.state, c = lab.cfg, h = st.hero;
    if (st.posterOn) this.unposter(lab);
    if (!st.banner) { // имя вариации и её правило крупно в начале партии
      st.banner = true;
      const v = this.variant(lab);
      lab.popup([h.x + 8, h.y + 5.5, 0], v.name, '#fff1c9', 32);
      lab.after(0.35, () => lab.popup([st.hero.x + 9, st.hero.y + 3.8, 0], v.how, '#ffffff', 17));
    }
    if (lab.p1.pressed.b && !st.crash) this.togglePhoto(lab);
    this.moodStep(lab, dt);
    this.music(lab, dt);
    if (!st.photo) {
      st.time += dt;
      this.gustStep(lab, dt);
      this.heroStep(lab, dt);
      this.extend(lab); this.trim(lab);
      this.objectsStep(lab, dt);
      this.weatherStep(lab, dt);
      this.pose(lab, dt);
      this.scarfStep(lab, dt);
      st.dist = Math.max(st.dist, h.x - st.startX);
      st.cloudOff += dt * 1.6;
    }
    this.camStep(lab, dt);
    this.layersStep(lab, st.photo ? 0 : dt);
    this.fogStep(lab);
    if (st.palDirty) { st.palDirty = false; this.applyPal(lab); }
    if (st.slopeDirty) { st.slopeDirty = false; this.writeSlope(lab); }
    this.hudStep(lab);
    if (c.limit > 0 && st.time >= c.limit && !st.ended && !st.crash) { st.ended = true; lab.win(`Спуск окончен: ${Math.round(st.dist)} м`); }
    lab.stat('метры', Math.round(st.dist));
  },

  overNote(lab) {
    const st = lab.state, c = lab.cfg, v = this.variant(lab);
    return [v.name !== 'Классика' ? `Вариация: ${v.name} — ${v.how}` : '',
      st.zen ? `Спуск: ${Math.round(st.dist)} м, просто красиво` : `Спуск: ${Math.round(st.dist)} м · сальто: ${st.flips} · лучшая серия ×${st.bestChain} · фонарики: ${st.lanternN}`,
      st.grinds || st.near ? `Скольжений по верёвке: ${st.grinds} · впритык над камнем: ${st.near}` : '',
      st.bible ? (st.changes ? `Мир сменил настроение ${st.changes} раз: ${st.names.slice(0, 6).join(' → ')} — палитра, свет, погода и музыка вместе` : `Настроение мира: ${st.names[0]}`)
        : 'Библии мира нет: всё случайного цвета, формы вразнобой, вечный полдень и писк вместо музыки',
      st.odd ? 'Квиз «Найди лишнее»: что в этом мире спорит со стилем?' : '',
      st.photos ? `Кадров в фоторежиме: ${st.photos}` : ''].filter(Boolean);
  },

  /* ---------- помощники ---------- */
  hash(n) { const s = Math.sin(n * 91.3458 + 47.123) * 43758.5453; return s - Math.floor(s); }, // предсказуемый «случай» для звука и ветра: зерно мира не трогает
  wrap(a) { return Math.atan2(Math.sin(a), Math.cos(a)); },
  mod(a, p) { return ((a % p) + p) % p; },
  randCol(lab) { return '#' + new lab.THREE.Color().setHSL(lab.rand(0, 1), lab.rand(0.55, 0.95), lab.rand(0.42, 0.66)).getHexString(); },
  hex(col) { return '#' + col.getHexString(); },
  setInst(inst, i, x, y, z, sx, sy, sz, rz = 0) { // быстрое место копии без пересчёта границ (копии с frustumCulled = false)
    const T = this._t || (this._t = { m: new THREE.Matrix4(), q: new THREE.Quaternion(), e: new THREE.Euler(), p: new THREE.Vector3(), s: new THREE.Vector3() });
    T.m.compose(T.p.set(x, y, z), T.q.setFromEuler(T.e.set(0, 0, rz)), T.s.set(sx, sy, sz));
    inst.setMatrixAt(i, T.m); inst.instanceMatrix.needsUpdate = true;
  },
  baseSpeed(lab) { return lab.cfg.speed * (1 + 0.28 * lab.clamp(lab.state.hero.x / 1600, 0, 1)); },
  scale(st) { return st.bible ? st.moods[st.mood].def.scale : null; },
  note(sc, k) { return sc[((k % sc.length) + sc.length) % sc.length] * Math.pow(2, Math.floor(k / sc.length)); },

  /* ---------- палитра настроения ---------- */
  prep(lab, m) {
    const T = lab.THREE, C = h => new T.Color(h), f = m.fix || {}, dark = C('#0b0d1c'), white = C('#ffffff');
    const [s0, s1, sn, mt, ac] = m.colors.map(C), mix = (a, b, k) => a.clone().lerp(b, k);
    return {
      name: m.name, def: m, sky0: s0, sky1: s1, snow: sn, mount: mt, acc: ac,
      tree: f.tree ? C(f.tree) : mix(mt, dark, 0.52),
      trunk: f.trunk ? C(f.trunk) : mix(mt, dark, 0.72),
      rock: f.rock ? C(f.rock) : mix(mt, dark, 0.6),
      far: f.far ? f.far.map(C) : [mix(mt, dark, 0.3), mix(mt, s1, 0.2), mix(mt, s1, 0.42), mix(mt, s1, 0.64)],
      cap: f.cap ? C(f.cap) : mix(sn, s1, 0.3),
      slope: f.slope ? f.slope.map(C) : [sn.clone(), mix(sn, mt, 0.06), mix(sn, mt, 0.2), mix(sn, mt, 0.42)],
      sunCol: C(m.sunCol || '#ffffff'),
      flake: f.flake ? C(f.flake) : m.sand ? mix(sn, white, 0.25) : white.clone(),
      lantern: f.lantern ? C(f.lantern) : ac.clone(),
      cloud: f.cloud ? C(f.cloud) : m.moon ? mix(s1, s0, 0.35) : mix(s1, white, 0.3),
      pole: f.pole ? C(f.pole) : mix(mt, dark, 0.75),
      dir: new T.Vector3().fromArray(m.dir || [0.3, 1, 0.5]).normalize(),
      n: { sunX: m.sun[0], sunY: m.sun[1], moon: m.moon || 0, light: m.light, hemi: m.hemi, fog: m.fog, snow: m.snow || 0, drift: m.drift || 0,
        mist: m.mist || 0, stars: m.stars || 0, aurora: m.aurora || 0, glow: m.glow == null ? 1.6 : m.glow, flat: f.flat || 0 },
    };
  },
  clonePal(p) {
    const o = { name: p.name, def: p.def, n: Object.assign({}, p.n), dir: p.dir.clone(), far: p.far.map(c => c.clone()), slope: p.slope.map(c => c.clone()) };
    this.COLK.forEach(k => { o[k] = p[k].clone(); });
    return o;
  },
  lerpPal(o, A, B, k) {
    this.COLK.forEach(key => o[key].copy(A[key]).lerp(B[key], k));
    for (let i = 0; i < 4; i++) { o.far[i].copy(A.far[i]).lerp(B.far[i], k); o.slope[i].copy(A.slope[i]).lerp(B.slope[i], k); }
    for (const key in o.n) o.n[key] = A.n[key] + (B.n[key] - A.n[key]) * k;
    o.dir.copy(A.dir).lerp(B.dir, k).normalize();
    o.name = k < 0.5 ? A.name : B.name; o.def = B.def;
  },
  // куплет: каждые 10–12 с мир переходит к следующему настроению — небо, свет, туман, погода и лад музыки вместе
  moodStep(lab, dt) {
    const st = lab.state, c = lab.cfg;
    if (st.bible && st.moods.length > 1) {
      if (c.cycle >= 1) st.moodT += dt; // куплет считается от начала прошлой смены, переход 3,5 с входит в него
      if (!st.trans && st.moodT >= st.verseAt) {
        st.moodT = 0; st.verseAt = c.verse + 1.5 * this.hash(st.changes + 7);
        st.from = st.mood; st.mood = (st.mood + 1) % st.moods.length;
        st.trans = { k: 0 };
        st.changes++;
        lab.count('_secret'); lab.count('смены настроения'); lab.stat('смены', st.changes);
        st.names.push(st.moods[st.mood].name);
        const M = st.moods[st.mood], h = st.hero, sc = M.def.scale;
        lab.popup([h.x + 9, h.y + 6.5, 0], M.name, this.hex(M.acc), 26);
        [0, 2, 4, 7].forEach((d, k) => lab.tone(this.note(sc, d) / 2, 2.6, 'sine', 0.03, 0, k * 0.11)); // мягкий аккорд нового лада
        lab.tone(this.note(sc, 9), 1.8, M.def.wave || 'triangle', 0.02, 0, 0.5);
      }
    }
    if (st.trans) {
      st.trans.k = Math.min(1, st.trans.k + dt / 3.5);
      const k = st.trans.k, e = k * k * (3 - 2 * k);
      this.lerpPal(st.pal, st.moods[st.from], st.moods[st.mood], e);
      st.palDirty = true;
      if (k >= 1) st.trans = null;
    }
  },
  applyPal(lab) {
    const st = lab.state, P = st.pal, T = lab.THREE, L = lab.light, M = st.mats, n = P.n;
    const tmp = st.tmpC || (st.tmpC = new T.Color()), white = st.white || (st.white = new T.Color('#ffffff'));
    let s0 = P.sky0, s1 = P.sky1;
    if (st.odd === 4) { s0 = st.acid0 || (st.acid0 = new T.Color('#18ff3c')); s1 = st.acid1 || (st.acid1 = new T.Color('#d8ff3a')); } // «Не то небо»
    // небо: градиент на холсте, у горизонта — лёгкий отсвет акцента
    const g = st.skyCtx, gr = g.createLinearGradient(0, 0, 0, 256);
    gr.addColorStop(0, this.hex(s0)); gr.addColorStop(0.42, this.hex(tmp.copy(s0).lerp(s1, 0.6)));
    gr.addColorStop(0.66, this.hex(tmp.copy(s1).lerp(P.acc, 0.08 * (1 - n.flat)))); gr.addColorStop(1, this.hex(s1));
    g.fillStyle = gr; g.fillRect(0, 0, 2, 256); st.skyTex.needsUpdate = true;
    // свет: ключевое солнце цвета настроения, заполняющий — небо (в Game Boy и нуаре свет ровный, чтобы не родились новые оттенки)
    L.sun.color.copy(P.sunCol); L.sun.intensity = lab.lerp(n.light, 0.25, n.flat);
    L.sun.userData.dir.copy(P.dir);
    L.hemi.color.copy(P.sky0).lerp(white, lab.lerp(0.5, 1, n.flat)); L.hemi.groundColor.copy(P.mount).lerp(P.snow, 0.3).lerp(white, n.flat);
    L.hemi.intensity = n.hemi;
    // солнце или луна
    M.sun.color.copy(P.sunCol).multiplyScalar(n.flat ? 1 : 1.5); M.halo.color.copy(P.sunCol); M.halo.opacity = (0.55 - 0.3 * n.moon) * (1 - n.flat);
    M.stars.opacity = n.stars; st.stars.visible = n.stars > 0.01;
    st.aurora.forEach(a => { a.mesh.material.opacity = n.aurora * 0.75; a.mesh.visible = n.aurora > 0.01; });
    this.writeColors(lab);
    if (!st.bible) return; // без библии предметы раскрашены случайно один раз, при постройке
    st.layers.forEach((Ly, k) => { Ly.mat.color.copy(P.far[k]); if (Ly.capMat) Ly.capMat.color.copy(P.cap); });
    st.bands.forEach(b => { b.material.color.copy(P.sky1); b.material.opacity = n.mist * 0.85; b.visible = n.mist > 0.02; });
    M.cloud.color.copy(P.cloud);
    if (M.crown) M.crown.color.copy(P.tree);
    if (M.trunk) M.trunk.color.copy(P.trunk);
    if (M.cactus) M.cactus.color.copy(P.tree).lerp(tmp.set('#2f6b3a'), 0.45 * (1 - n.flat));
    if (M.ball) M.ball.color.copy(P.tree);
    if (M.cyl) M.cyl.color.copy(P.tree);
    M.rock.color.copy(P.rock); M.rockCap.color.copy(P.snow);
    const gl = n.glow > 0 ? 1.4 + n.glow * 0.5 : 1;
    M.lan.color.copy(P.lantern).multiplyScalar(gl); M.lanHalo.color.copy(P.lantern); M.lanHalo.opacity = n.glow > 0 ? 0.22 + 0.06 * n.glow : 0;
    M.pole.color.copy(P.pole); M.rope.color.copy(P.pole); M.flag.color.copy(P.acc);
    M.gapMist.color.copy(P.sky1).lerp(P.snow, 0.3);
    M.flake.color.copy(P.flake); M.streak.color.copy(P.flake);
    st.dust = [this.hex(P.snow), this.hex(tmp.copy(P.snow).lerp(white, 0.6))];
    st.accHex = this.hex(P.acc);
  },
  fogStep(lab) {
    const st = lab.state, c = lab.cfg, f = lab.scene.fog, P = st.pal;
    if (!f) return;
    f.color.copy(P.sky1);
    f.density = st.bible ? (c.weather >= 1 ? P.n.fog : Math.min(P.n.fog, 0.003)) * (1 + 0.7 * st.gust.k * (c.wind || 0)) : 0.0006;
  },

  /* ---------- склон: бесконечная гладкая ломаная, трамплины, камни, расщелины, верёвки, фонарики ---------- */
  baseY(st, x) { return st.off - 0.3 * x + 4 * Math.sin(0.045 * x + st.ph[0]) + 1.2 * Math.sin(0.13 * x + st.ph[1]) + 0.35 * Math.sin(0.31 * x + st.ph[2]); },
  diff(st) { return Math.max(0, Math.min(1, (st.endX - 150) / 1400)); },
  push(lab, x, y, o) {
    const st = lab.state;
    st.pts.push(Object.assign({ x, y, j: lab.rand(-1, 1), gap: false, lip: false }, o || {}));
    st.endX = x;
    st.slopeDirty = true;
  },
  run(lab, len, o = {}) {
    const st = lab.state, x0 = st.endX, desert = st.setIdx === 2 && st.bible;
    for (let x = x0 + 1; x <= x0 + len + 1e-6; x += 1) {
      const y = this.baseY(st, x);
      this.push(lab, x, y);
      if (o.trees !== false && lab.chance(desert ? 0.14 : 0.4)) this.tree(lab, x + lab.rand(-0.4, 0.4), y, lab.rand(-8.8, -2.3), lab.rand(0.7, 1.5));
    }
  },
  extend(lab) { const st = lab.state; while (st.endX < st.hero.x + 118) this.feature(lab); },
  choose(lab, d) {
    const st = lab.state;
    if (st.endX < 150) return st.tut.length ? st.tut.shift() : lab.pick(['calm', 'lanterns', 'ramp']);
    const z = st.zen, W = [['calm', 1], ['ramp', 1.3], ['lanterns', 1.1], ['rock', 2.2], ['rocks2', d > 0.12 ? 0.4 + 1.6 * d : 0],
      ['gap', z ? 0 : 1.6 + 1.4 * d], ['ropegap', z || d < 0.15 ? 0 : 0.5 + 0.8 * d], ['rope', 0.45 + 0.5 * d]];
    let sum = 0; W.forEach(w => { sum += w[1]; });
    let r = lab.rand(0, sum);
    for (const [k, w] of W) { r -= w; if (r <= 0 && w > 0) return k; }
    return 'calm';
  },
  feature(lab) {
    const st = lab.state, d = this.diff(st), type = this.choose(lab, d), lead = lab.rand(7, 13) * (1 - 0.35 * d) + 4;
    if (type === 'calm') this.run(lab, lab.rand(14, 24));
    else if (type === 'lanterns') {
      this.run(lab, lead);
      const x0 = st.endX + 2;
      this.run(lab, 16);
      for (let i = 0; i < 5; i++) { const x = x0 + i * 2.5; this.addLantern(lab, x, this.groundAt(st, x) + 2.6 + 1.2 * Math.sin(Math.PI * i / 4)); } // без прыжка не достать
    } else if (type === 'ramp') this.ramp(lab, lead);
    else if (type === 'rock' || type === 'rocks2') {
      this.run(lab, lead);
      this.addRock(lab, st.endX - 1);
      if (type === 'rocks2') { this.run(lab, lab.rand(6.5, 9)); this.addRock(lab, st.endX - 1); }
      this.run(lab, 4);
    } else if (type === 'gap' || type === 'ropegap') this.gap(lab, lead, d, type === 'ropegap');
    else if (type === 'rope') { this.run(lab, lead); const ax = st.endX + 1; this.run(lab, 19); this.addRope(lab, ax, ax + 15); }
  },
  ramp(lab, lead) {
    const st = lab.state, c = lab.cfg;
    this.run(lab, lead);
    const xs = st.endX, L = 6.5, hh = lab.rand(1.3, 2.0);
    for (let k = 1; k <= 8; k++) { const u = k / 8, x = xs + u * L; this.push(lab, x, this.baseY(st, x) + hh * Math.pow(u, 1.8)); }
    const P = st.pts, A = P[P.length - 1], B = P[P.length - 2];
    A.lip = true;
    const lip = { x: A.x, y: A.y, ang: Math.atan2(A.y - B.y, A.x - B.x) };
    st.lips.push(lip);
    this.push(lab, A.x + 0.4, this.baseY(st, A.x + 0.4));
    this.pole(lab, A.x - 0.35, A.y - 0.1, A.y + 1.9, -1.5); this.flagAt(lab, A.x - 0.35, A.y + 1.9, -1.5, Math.PI / 2); // флажок у кромки трамплина
    this.run(lab, 14);
    // фонарики — на дуге полёта, если прыгнуть с самой кромки трамплина: награда за точный прыжок
    const s = c.speed * 1.35, vx = s * Math.cos(lip.ang), vy = s * Math.sin(lip.ang) + this.RAMP_KICK + c.jump * 0.6;
    for (let k = 1; k <= 4; k++) {
      const t = 0.18 + k * 0.2, x = lip.x + vx * t, y = lip.y + vy * t - 0.5 * c.grav * t * t + 1.0, g = this.groundAt(st, x);
      if (g != null && y > g + 1.2) this.addLantern(lab, x, y);
    }
  },
  gap(lab, lead, d, rope) {
    const st = lab.state;
    this.run(lab, lead + (rope ? 4 : 0));
    const P = st.pts, A = P[P.length - 1], w = lab.rand(3.4, 4.6) + 3 * d, xb = A.x + w;
    let yb = this.baseY(st, xb);
    if (yb > A.y - 0.3) { st.off -= yb - (A.y - 0.3); yb = A.y - 0.3; } // дальний край не выше ближнего
    A.gap = true;
    this.push(lab, A.x + 0.25, A.y - 24, { gap: true });
    this.push(lab, xb - 0.25, yb - 24, { gap: true });
    this.push(lab, xb, yb);
    st.gaps.push({ x0: A.x, x1: xb, rim: Math.min(A.y, yb) });
    this.gapMist(lab, A.x, xb, Math.min(A.y, yb));
    this.pole(lab, A.x - 0.5, A.y - 0.1, A.y + 1.1, -1.6); this.flagAt(lab, A.x - 0.5, A.y + 1.1, -1.6, Math.PI / 2);
    this.pole(lab, xb + 0.5, yb - 0.1, yb + 1.1, -1.6); this.flagAt(lab, xb + 0.5, yb + 1.1, -1.6, Math.PI / 2);
    this.run(lab, 12);
    if (rope) this.addRope(lab, A.x - 4, xb + 5);
  },
  seg(st, x) { // отрезок ломаной под x: P[i].x <= x < P[i+1].x
    const P = st.pts;
    let lo = 0, hi = P.length - 1;
    if (hi < 1 || x < P[0].x || x >= P[hi].x) return -1;
    while (hi - lo > 1) { const m = (lo + hi) >> 1; if (P[m].x <= x) lo = m; else hi = m; }
    return lo;
  },
  groundAt(st, x) {
    const i = this.seg(st, x);
    if (i < 0) return null;
    const a = st.pts[i], b = st.pts[i + 1];
    if (a.gap) return null;
    return a.y + (b.y - a.y) * (x - a.x) / (b.x - a.x);
  },
  angleAt(st, x) {
    const i = this.seg(st, x);
    if (i < 0) return -0.3;
    const a = st.pts[i], b = st.pts[i + 1];
    return Math.atan2(b.y - a.y, b.x - a.x);
  },
  rimY(st, x) { const g = st.gaps.find(G => x > G.x0 && x < G.x1); return g ? g.rim : null; },
  ropeY(r, x) { return r.ay + (r.by - r.ay) * (x - r.ax) / (r.bx - r.ax); },
  trim(lab) {
    const st = lab.state, cut = st.hero.x - 48;
    while (st.pts.length > 4 && st.pts[1].x < cut) { st.pts.shift(); st.slopeDirty = true; }
    const keep = o => (o.x1 != null ? o.x1 : o.bx != null ? o.bx : o.x) > cut;
    st.rocks = st.rocks.filter(keep); st.lips = st.lips.filter(keep); st.gaps = st.gaps.filter(keep); st.ropes = st.ropes.filter(keep);
    st.lanterns = st.lanterns.filter(L => { if (keep(L)) return true; this.hideLantern(lab, L); return false; });
  },

  /* ---------- предметы мира ---------- */
  tree(lab, x, y, z, s) {
    const st = lab.state;
    let kind = st.decorBase;
    if (!st.bible) kind = lab.pick(['fir', 'ball', 'cyl', 'box']);
    else if (st.odd === 1 && lab.chance(0.25)) kind = 'crystal';
    else if (st.odd === 3 && lab.chance(0.3)) kind = lab.chance(0.5) ? 'ball' : 'cyl';
    else if (st.odd === 6 && lab.chance(0.3)) kind = 'palm';
    const D = st.decor[kind], i = D.n++ % D.cap, col = st.bible ? null : this.randCol(lab), rot = lab.rand(0, 3);
    D.place(i, x, y - 0.15, z, s, rot, col);
  },
  addRock(lab, x) {
    const st = lab.state, y = this.groundAt(st, x), i = st.ring.rock++ % 24, o = st.bible ? {} : { color: this.randCol(lab) };
    lab.place(st.rockI, i, [x, y + 0.32, 0], Object.assign({ rot: [lab.rand(0, 3), lab.rand(0, 3), lab.rand(0, 3)], scale: [1.15, 0.85, 1.05] }, o));
    lab.place(st.rockCapI, i, [x - 0.05, y + 0.74, 0], Object.assign({ rot: lab.rand(0, 3), scale: [0.95, 0.32, 0.9] }, st.bible ? {} : { color: this.randCol(lab) }));
    st.rocks.push({ x, y, i, gone: false, passed: false });
  },
  smashRock(lab, r) {
    const st = lab.state;
    r.gone = true;
    this.setInst(st.rockI, r.i, 0, -999, 0, 0, 0, 0); this.setInst(st.rockCapI, r.i, 0, -999, 0, 0, 0, 0);
    lab.burst([r.x, r.y + 0.5, 0], { count: 16, colors: [this.hex(st.pal.rock), ...(st.dust || ['#ffffff'])], speed: 4, up: 2 });
    lab.noise(0.2, 0.08, 900);
  },
  addLantern(lab, x, y) {
    const st = lab.state, i = st.ring.lan++ % 48, L = { x, y, i, ph: lab.rand(0, 6.28), got: false };
    if (!st.bible) { const col = this.randCol(lab); lab.place(st.lanI, i, [x, y, 0], { color: col }); lab.place(st.lanHaloI, i, [x, y, 0], { color: col }); }
    this.setInst(st.lanI, i, x, y, 0, 1, 1, 1); this.setInst(st.lanHaloI, i, x, y, 0, 1, 1, 1);
    st.lanterns.push(L);
  },
  hideLantern(lab, L) { const st = lab.state; this.setInst(st.lanI, L.i, 0, -999, 0, 0, 0, 0); this.setInst(st.lanHaloI, L.i, 0, -999, 0, 0, 0, 0); },
  pole(lab, x, y0, y1, z) { const st = lab.state; this.setInst(st.poleI, st.ring.pole++ % 40, x, (y0 + y1) / 2, z, 1, y1 - y0, 1); },
  flagAt(lab, x, y, z, rz) {
    const st = lab.state, i = st.ring.flag++ % 160;
    const col = st.bible ? ['#ffffff', '#c8c8c8', '#e6e6e6', '#a8a8a8'][i % 4] : this.randCol(lab);
    lab.place(st.flagI, i, [x, y, z], { rot: [0, 0, rz], color: col });
  },
  addRope(lab, ax, bx) {
    const st = lab.state;
    let ay = this.groundAt(st, ax) + 1.9, by = this.groundAt(st, bx) + 1.9, need = 0;
    for (let x = ax; x <= bx; x += 0.5) { const g = this.groundAt(st, x); if (g == null) continue; need = Math.max(need, g + 1.8 - (ay + (by - ay) * (x - ax) / (bx - ax))); }
    ay += need; by += need;
    const r = { ax, ay, bx, by, ang: Math.atan2(by - ay, bx - ax), i: st.ring.rope++ % 8 }, len = Math.hypot(bx - ax, by - ay);
    st.ropes.push(r);
    this.setInst(st.ropeI, r.i, (ax + bx) / 2, (ay + by) / 2, 0, len, 1, 1, r.ang);
    this.pole(lab, ax, this.groundAt(st, ax) - 0.1, ay + 0.15, 0); this.pole(lab, bx, this.groundAt(st, bx) - 0.1, by + 0.15, 0);
    for (let d = 0.8; d < len - 0.5; d += 1.1) { const x = ax + (bx - ax) * d / len; this.flagAt(lab, x, this.ropeY(r, x) - 0.03, 0.02, 0); }
  },
  gapMist(lab, x0, x1, y) { const st = lab.state; this.setInst(st.gapI, st.ring.gap++ % 6, (x0 + x1) / 2, y - 12, -4.5, x1 - x0 - 0.3, 16, 11.5); },
  objectsStep(lab) {
    const st = lab.state, t = st.time;
    for (const L of st.lanterns) {
      if (L.got) continue;
      const y = L.y + Math.sin(t * 2.2 + L.ph) * 0.14, k = 1 + 0.1 * Math.sin(t * 5 + L.ph);
      this.setInst(st.lanI, L.i, L.x, y, 0, 1, 1, 1, Math.sin(t * 1.7 + L.ph) * 0.15);
      this.setInst(st.lanHaloI, L.i, L.x, y, 0, k, k, k);
    }
  },

  /* ---------- герой: езда, прыжок, сальто, приземление, падение ---------- */
  heroStep(lab, dt) {
    const st = lab.state, c = lab.cfg, h = st.hero, p = lab.p1;
    if (st.crash) return this.crashStep(lab, dt);
    if (st.safeT > 0) st.safeT -= dt;
    const base = this.baseSpeed(lab), gk = st.gust.k * (c.wind || 0);
    if (p.pressed.a) { st.buf = 0.15; st.holdT = 0; }
    if (p.a) st.holdT += dt; else st.holdT = 0;
    st.buf = Math.max(0, st.buf - dt);
    const x0 = h.x;
    if (h.rope) this.grindStep(lab, dt, base);
    else if (!h.air) this.rideStep(lab, dt, base, gk);
    else this.airStep(lab, dt, gk);
    if (st.crash) return;
    if (!st.zen) lab.score += Math.max(0, h.x - x0); // метр спуска — очко
    this.hits(lab, x0);
  },
  rideStep(lab, dt, base, gk) {
    const st = lab.state, c = lab.cfg, h = st.hero;
    const th = this.angleAt(st, h.x);
    // на спуске разгон, на подъёме торможение, сопротивление тянет к базовой скорости; порыв ветра толкает назад
    h.s += (6.5 * -Math.sin(th) - 0.55 * (h.s - base) - 7 * gk) * dt;
    h.s = lab.clamp(h.s, base * 0.6, base * 2.3);
    const nx = h.x + h.s * Math.cos(th) * dt;
    const lip = st.lips.find(L => L.x > h.x && L.x <= nx);
    if (lip) { h.x = lip.x; h.y = lip.y; this.takeoff(lab, lip.ang, this.RAMP_KICK + (st.buf > 0 ? c.jump * 0.6 : 0), st.buf > 0, true); return; }
    const g = this.groundAt(st, nx);
    if (g == null) { h.x = nx; this.takeoff(lab, th, 0, false); return; } // край расщелины: полетел без прыжка
    h.x = nx; h.y = g; h.rot = lab.damp(h.rot, th, 16, dt);
    h.vx = h.s * Math.cos(th); h.vy = h.s * Math.sin(th);
    if (st.buf > 0) { this.takeoff(lab, th, c.jump, true); return; }
    st.groundT += dt;
    if (st.chain > 0 && st.groundT > c.keep) this.breakChain(lab);
    st.sprayT -= dt;
    if (st.sprayT <= 0) { // снежная пыль из-под доски
      st.sprayT = 0.07;
      lab.burst([h.x - 0.65, h.y + 0.06, 0.25], { count: 2, colors: st.dust || ['#ffffff'], speed: 1.4 + h.s * 0.08, up: 0.6, gravity: 5, size: 0.12, life: 0.45 });
    }
  },
  takeoff(lab, th, kick, jumped, ramp) {
    const st = lab.state, h = st.hero;
    h.air = true; h.vx = h.s * Math.cos(th); h.vy = h.s * Math.sin(th) + kick; h.rot = th;
    st.spin = 0; st.w = 0; st.airT = 0; st.buf = 0;
    const sc = this.scale(st);
    if (jumped) {
      lab.count('прыжки');
      if (sc) { lab.tone(this.note(sc, 2), 0.16, 'triangle', 0.05, this.note(sc, 4)); lab.noise(0.12, 0.05, 2500); } else lab.sfx.jump();
      lab.burst([h.x, h.y + 0.1, 0.2], { count: 8, colors: st.dust || ['#ffffff'], speed: 3, up: 1, size: 0.16 });
      lab.pulse(st.body, 0.86, 0.18);
    } else if (ramp) { lab.noise(0.3, 0.06, 1800); lab.burst([h.x, h.y + 0.1, 0.2], { count: 10, colors: st.dust || ['#ffffff'], speed: 4, up: 1.5, size: 0.16 }); }
  },
  airStep(lab, dt, gk) {
    const st = lab.state, c = lab.cfg, h = st.hero, p = lab.p1;
    st.airT += dt;
    // держишь дольше 0,12 с — сальто назад; отпустил — вращение быстро гаснет
    const spinOn = p.a && st.holdT > 0.12;
    if (spinOn) st.w = Math.min(c.flip, st.w + c.flip * dt / 0.12); else st.w = lab.damp(st.w, 0, 16, dt);
    const dr = st.w * dt;
    h.rot += dr; st.spin += dr;
    if (!spinOn && st.w < 1.5) { // доводка: почти ровно — доска сама ложится вдоль склона под героем
      const gx = h.x + h.vx * 0.15, ga = this.groundAt(st, gx) != null ? this.angleAt(st, gx) : this.angleAt(st, h.x);
      const d = this.wrap(h.rot - ga), lim = Math.max(35, c.tilt * 1.6) * Math.PI / 180;
      if (Math.abs(d) < lim) h.rot -= d * (1 - Math.exp(-5 * dt));
    }
    h.vy -= c.grav * dt; h.vx = Math.max(3, h.vx - 4 * gk * dt);
    const px = h.x, py = h.y;
    h.x += h.vx * dt; h.y += h.vy * dt;
    if (h.vy < 0) for (const r of st.ropes) { // верёвка с флажками: сверху на неё можно сесть доской
      if (h.x < r.ax || h.x > r.bx) continue;
      const ry = this.ropeY(r, h.x), pry = this.ropeY(r, Math.max(r.ax, px));
      if (py >= pry - 0.08 && h.y <= ry + 0.02) { this.landRope(lab, r, ry); return; }
    }
    const gp = this.groundAt(st, px), g = this.groundAt(st, h.x);
    if (g != null && h.y <= g) {
      if (gp == null && g - h.y > 0.45) return this.crash(lab, 'gap'); // не долетел: ударился о стену расщелины
      h.y = g;
      this.land(lab);
      return;
    }
    if (g == null) { const rim = this.rimY(st, h.x); if (rim != null && h.y < rim - 3.2) this.crash(lab, 'gap'); }
  },
  land(lab) {
    const st = lab.state, c = lab.cfg, h = st.hero;
    const th = this.angleAt(st, h.x), d = this.wrap(h.rot - th), clean = Math.abs(d) < c.tilt * Math.PI / 180;
    const n = Math.floor((st.spin + 0.6) / (Math.PI * 2));
    const forgive = st.zen || st.time < c.teach || st.safeT > 0 || st.spin < 0.5; // не крутил — доску выровняет склон
    if (!clean && !forgive) return this.crash(lab, 'tilt');
    const along = h.vx * Math.cos(th) + h.vy * Math.sin(th), impact = Math.abs(-h.vx * Math.sin(th) + h.vy * Math.cos(th));
    h.air = false; h.rot = clean || st.spin < 0.5 ? th : th + d * 0.3;
    h.s = Math.max(this.baseSpeed(lab) * 0.6, along);
    const sc = this.scale(st);
    if (sc) lab.tone(this.note(sc, 0), 0.3, 'sine', 0.05); // приземление — нота того же лада
    lab.noise(0.14, 0.06 + Math.min(0.08, impact * 0.008), 900);
    lab.burst([h.x, h.y + 0.1, 0.2], { count: 6 + Math.min(14, Math.round(impact)), colors: st.dust || ['#ffffff'], speed: 2 + impact * 0.25, up: 1, size: 0.16 });
    lab.pulse(st.body, 1.18, 0.16);
    if (impact > 9) lab.shake(0.12);
    if (clean && n >= 1) this.trick(lab, n);
    else if (!clean) { lab.popup([h.x, h.y + 2.3, 0], st.zen ? 'Мягко' : 'Ровнее!', '#bfe8ff', 18); lab.shake(0.12); }
    st.spin = 0; st.w = 0;
  },
  trick(lab, n) {
    const st = lab.state, c = lab.cfg, h = st.hero;
    st.chain++; st.bestChain = Math.max(st.bestChain, st.chain); st.flips += n; st.groundT = 0;
    lab.count('трюки', n);
    h.s += c.boost * n; // чистое сальто разгоняет
    const name = n === 1 ? 'Сальто!' : n === 2 ? 'Двойное сальто!' : `Сальто ×${n}!`, acc = st.accHex || '#ffe08a';
    let pts = 0;
    if (!st.zen) { pts = 50 * n * n * st.chain; lab.addScore(pts); }
    lab.popup([h.x, h.y + 2.4, 0], st.zen ? name : `${name} +${pts}`, acc, 22 + 4 * Math.min(n, 3));
    if (st.chain > 1 && !st.zen) lab.popup([h.x + 1.8, h.y + 3.6, 0], `Серия ×${st.chain}`, '#ffffff', 18);
    lab.hitstop(0.035 + 0.02 * Math.min(n, 3));
    lab.burst([h.x, h.y + 0.9, 0.2], { count: 14 + 6 * n, colors: [acc, '#ffffff', ...(st.dust || [])], speed: 5, up: 2 });
    lab.ring([h.x, h.y + 0.1, 0.3], { color: acc, radius: 2 + n });
    lab.whiten(st.heroG, 0.06);
    lab.vibrate(60, 0.4);
    if (n >= 2) { lab.slowmo(0.35, 0.5); lab.flash(acc, 0.12); }
    const sc = this.scale(st);
    if (sc) [0, 2, 4, 6].forEach((k, i) => lab.tone(this.note(sc, k + st.chain), 0.28, 'triangle', 0.05, 0, i * 0.06));
    else lab.sfx.coin();
  },
  breakChain(lab) {
    const st = lab.state, h = st.hero;
    if (st.chain > 1 && !st.zen) lab.popup([h.x + 1, h.y + 2.6, 0], `Серия ×${st.chain} закончилась`, '#c9d2e6', 15);
    const sc = this.scale(st);
    if (sc) lab.tone(this.note(sc, 0) / 2, 0.35, 'sine', 0.04);
    st.chain = 0;
  },
  landRope(lab, r, ry) {
    const st = lab.state, c = lab.cfg, h = st.hero;
    const d = this.wrap(h.rot - r.ang), clean = Math.abs(d) < c.tilt * Math.PI / 180, n = Math.floor((st.spin + 0.6) / (Math.PI * 2));
    if (!clean && !(st.zen || st.time < c.teach || st.safeT > 0 || st.spin < 0.5)) return this.crash(lab, 'tilt');
    h.air = false; h.rope = r; h.y = ry; h.rot = r.ang;
    h.s = Math.max(this.baseSpeed(lab) * 0.7, h.vx * Math.cos(r.ang) + h.vy * Math.sin(r.ang));
    if (clean && n >= 1) this.trick(lab, n);
    st.chain++; st.bestChain = Math.max(st.bestChain, st.chain); st.groundT = 0; st.grinds++;
    lab.count('скольжения');
    lab.popup([h.x, h.y + 2.2, 0], 'Скольжение!', st.accHex || '#ffe08a', 20);
    lab.burst([h.x, h.y, 0.1], { count: 10, colors: [st.accHex || '#ffe08a', '#ffffff'], speed: 4, up: 1.5, size: 0.12 });
    const sc = this.scale(st);
    if (sc) lab.tone(this.note(sc, 5), 0.4, 'triangle', 0.04); else lab.sfx.beep();
    st.spin = 0; st.w = 0;
  },
  grindStep(lab, dt, base) {
    const st = lab.state, c = lab.cfg, h = st.hero, r = h.rope;
    h.s = Math.max(base * 0.7, h.s + (3 * -Math.sin(r.ang) - 0.4) * dt);
    h.x += h.s * Math.cos(r.ang) * dt; h.y = this.ropeY(r, Math.min(h.x, r.bx)); h.rot = r.ang;
    h.vx = h.s * Math.cos(r.ang); h.vy = h.s * Math.sin(r.ang);
    if (!st.zen) lab.score += h.s * dt * 1.5 * Math.max(1, st.chain); // скольжение — очки за метр × серия
    st.grindT -= dt;
    if (st.grindT <= 0) {
      st.grindT = 0.06;
      lab.burst([h.x, h.y, 0.1], { count: 3, colors: [st.accHex || '#ffe08a', '#ffffff'], speed: 3, up: 1.5, size: 0.1, life: 0.3 });
      lab.noise(0.06, 0.025, 7000);
    }
    if (st.buf > 0) { h.rope = null; this.takeoff(lab, r.ang, c.jump, true); return; }
    if (h.x >= r.bx) { h.rope = null; this.takeoff(lab, r.ang, 1.5, false); }
  },
  hits(lab, x0) {
    const st = lab.state, h = st.hero;
    for (const r of st.rocks) {
      if (r.gone) continue;
      if (Math.abs(h.x - r.x) < 0.7 && h.y - r.y < 0.9) {
        if (st.zen || st.safeT > 0) { this.smashRock(lab, r); if (!h.air && !h.rope) this.takeoff(lab, this.angleAt(st, h.x), 4.5, false); continue; }
        return this.crash(lab, 'rock');
      }
      if (!r.passed && x0 < r.x && h.x >= r.x) { // впритык над камнем — почти-попадание
        r.passed = true;
        const clr = h.y - r.y - 0.9;
        if ((h.air || h.rope) && clr >= 0 && clr < 1.0) {
          st.near++; lab.count('впритык');
          if (!st.zen) lab.addScore(15 * Math.max(1, st.chain));
          lab.popup([r.x, r.y + 2, 0], st.zen ? 'Впритык' : `Впритык! +${15 * Math.max(1, st.chain)}`, '#ffffff', 17);
          lab.burst([r.x, r.y + 1, 0.2], { count: 8, colors: [st.accHex || '#ffe08a', '#ffffff'], speed: 3, up: 1 });
          const sc = this.scale(st); if (sc) lab.tone(this.note(sc, 7), 0.12, 'triangle', 0.035);
        }
      }
    }
    for (const L of st.lanterns) {
      if (L.got) continue;
      const dx = h.x - L.x, dy = h.y + 0.9 - L.y;
      if (dx * dx + dy * dy < 1.69) {
        L.got = true; this.hideLantern(lab, L);
        st.lanternN++; lab.count('фонарики');
        st.lanRun = st.time - st.lanT < 1.6 ? st.lanRun + 1 : 0; st.lanT = st.time;
        if (!st.zen) lab.addScore(25 * Math.max(1, st.chain), [L.x, L.y + 0.6, 0], st.accHex);
        lab.burst([L.x, L.y, 0.1], { count: 12, colors: [st.accHex || '#ffe08a', '#ffffff'], speed: 3.5, up: 1, size: 0.14 });
        lab.ring([L.x, L.y, 0.2], { color: st.accHex || '#ffe08a', radius: 1.2, life: 0.3 });
        const sc = this.scale(st);
        if (sc) { const f = this.note(sc, 3 + st.lanRun); lab.tone(f, 0.6, 'sine', 0.05); lab.tone(f * 2, 0.4, 'triangle', 0.015, 0, 0.02); } else lab.sfx.coin();
      }
    }
  },
  crash(lab, why) {
    const st = lab.state, h = st.hero;
    if (st.crash) return;
    const inGap = why === 'gap' || this.groundAt(st, h.x) == null;
    st.crash = { t: 0, why, vx: Math.max(4, (h.air ? h.vx : h.s) * 0.7), vy: h.air ? Math.max(h.vy, 2) : 3, spin: why === 'rock' ? -10 : 9, inGap, dust: 0, done: false };
    h.rope = null; h.air = true;
    st.falls++; lab.count('падения');
    st.chain = 0; st.spin = 0; st.w = 0;
    lab.burst([h.x, h.y + 0.6, 0.2], { count: 30, colors: [...(st.dust || ['#ffffff']), '#ffffff'], speed: 6, up: 2.5, size: 0.2 });
    lab.shake(0.55); lab.hitstop(0.09); lab.slowmo(1.1, 0.35); lab.vibrate(300, 0.8);
    lab.popup([h.x, h.y + 2.4, 0], this.CRASH[why], '#ff9a8a', 24);
    const sc = this.scale(st);
    lab.noise(0.6, 0.18, 600); lab.tone(sc ? this.note(sc, 0) / 2 : 160, 0.7, 'sawtooth', 0.05, 55);
    if (st.scarf && st.scarf.trail) st.scarf.trail.clear();
  },
  crashStep(lab, dt) {
    const st = lab.state, c = lab.cfg, h = st.hero, K = st.crash;
    K.t += dt;
    if (K.inGap) { K.vy -= c.grav * dt; h.x += K.vx * 0.5 * dt; h.y += K.vy * dt; } else {
      K.vx = lab.damp(K.vx, 0, 1.6, dt); h.x += K.vx * dt; K.vy -= c.grav * dt; h.y += K.vy * dt; // кувырок по склону
      const g = this.groundAt(st, h.x);
      if (g == null) K.inGap = true;
      else if (h.y < g) { h.y = g; K.vy = Math.abs(K.vy) * 0.35; }
    }
    h.rot += K.spin * dt; K.spin = lab.damp(K.spin, 0, 1.2, dt);
    K.dust -= dt;
    if (K.dust <= 0 && !K.inGap) { K.dust = 0.12; lab.burst([h.x, h.y + 0.3, 0.2], { count: 4, colors: st.dust || ['#ffffff'], speed: 2, up: 1, size: 0.18 }); }
    if (K.t > 1.25 && !K.done) {
      K.done = true;
      const where = [h.x, h.y + 1, 0];
      if (lab.lives > 1) { lab.hurt(where); this.respawn(lab); }
      else if (!lab.hurt(where, `Падение на ${Math.round(st.dist)} м`)) lab.gameOver(`Падение на ${Math.round(st.dist)} м`);
    }
  },
  respawn(lab) { // ещё жизнь: герой встаёт на ровный снег дальше по склону, без камней впереди
    const st = lab.state, h = st.hero;
    let x = Math.max(h.x, st.dist + st.startX) + 3;
    for (let k = 0; k < 60; k++) {
      let ok = true;
      for (let d = 0; d <= 12 && ok; d += 1) if (this.groundAt(st, x + d) == null) ok = false;
      if (ok && !st.rocks.some(r => !r.gone && r.x > x - 1 && r.x < x + 20)) break;
      x += 2;
    }
    Object.assign(h, { x, y: this.groundAt(st, x), air: false, rope: null, s: this.baseSpeed(lab), vx: 0, vy: 0 });
    h.rot = this.angleAt(st, x);
    st.crash = null; st.safeT = 2.2; st.spin = 0; st.w = 0;
    this.extend(lab);
    this.scarfInit(lab);
    lab.burst([h.x, h.y + 0.5, 0.2], { count: 18, colors: st.dust || ['#ffffff'], speed: 4, up: 2 });
    lab.popup([h.x, h.y + 2.4, 0], 'Ещё раз!', '#ffffff', 22);
  },
  gustStep(lab, dt) { // порывы ветра: надпись за секунду, потом 1,6 с толкает назад
    const st = lab.state, c = lab.cfg, G = st.gust;
    if (!(c.wind > 0)) { G.k = lab.damp(G.k, 0, 3, dt); G.phase = 0; return; }
    G.t += dt;
    if (G.phase === 0 && G.t >= G.next - 1) { G.phase = 1; lab.tone(140, 0.9, 'sine', 0.03, 220); }
    if (G.phase === 1 && G.t >= G.next) { G.phase = 2; G.end = G.t + 1.6; G.n++; lab.count('порывы'); lab.noise(1.6, 0.08 + 0.08 * c.wind, 500); lab.popup([st.hero.x + 3, st.hero.y + 3, 0], 'Порыв!', '#dff3ff', 20); }
    if (G.phase === 2 && G.t >= G.end) { G.phase = 0; G.next = G.t + 4.5 + 4 * this.hash(G.n * 3.3); }
    G.k = lab.damp(G.k, G.phase === 2 ? 1 : 0, 5, dt);
  },

  /* ---------- погода: снег, песок, позёмка ---------- */
  weatherStep(lab, dt) {
    const st = lab.state, c = lab.cfg, P = st.pal, v = lab.view, cx = v.target.x, cy = v.target.y, t = st.time;
    const on = st.bible && c.weather >= 1, gk = st.gust.k * (c.wind || 0);
    const nS = on ? Math.round(st.fl.length * Math.min(1, P.n.snow + gk * 0.3)) : 0;
    const nD = Math.round(st.sk.length * Math.min(1, (on ? P.n.drift : 0) + gk));
    const wind = 1.2 + 5 * P.n.drift + 16 * gk;
    for (let i = 0; i < st.fl.length; i++) {
      const f = st.fl[i];
      if (i >= nS) { if (f.on) { f.on = false; this.setInst(st.flI, i, 0, -999, 0, 0, 0, 0); } continue; }
      if (!f.on) { f.on = true; f.x = cx + f.rx; f.y = cy + f.ry; }
      f.x -= wind * f.v * dt - Math.sin(t * 1.3 + f.ph) * 0.3 * dt; f.y -= (1.1 + 1.8 * P.n.snow) * f.v * dt;
      const rx = f.x - cx, ry = f.y - cy;
      if (rx < -26) f.x += 52; else if (rx > 26) f.x -= 52;
      if (ry < -15) f.y += 30; else if (ry > 15) f.y -= 30;
      this.setInst(st.flI, i, f.x, f.y, f.z, 1, 1, 1, t * 2 + f.ph);
    }
    for (let i = 0; i < st.sk.length; i++) {
      const f = st.sk[i];
      if (i >= nD) { if (f.on) { f.on = false; this.setInst(st.skI, i, 0, -999, 0, 0, 0, 0); } continue; }
      if (!f.on) { f.on = true; f.x = cx + f.rx; }
      f.x -= (6 + 10 * P.n.drift + 22 * gk) * f.v * dt;
      if (f.x - cx < -26) f.x += 52; else if (f.x - cx > 26) f.x -= 52;
      const g = this.groundAt(st, f.x), y = (g == null ? cy - 6 : g) + f.h;
      this.setInst(st.skI, i, f.x, y, f.z, f.len * (0.6 + gk), 1, 1, 0.08);
    }
  },

  /* ---------- камера, слои фона, небо ---------- */
  camStep(lab, dt, snap) {
    const st = lab.state, v = lab.view, h = st.hero, aspect = lab.camera ? lab.camera.aspect : 16 / 9, base = this.baseSpeed(lab);
    let D = lab.clamp(17 / (Math.tan(0.4) * aspect), 15, 44) * (1 + lab.clamp((h.s - base) / base, 0, 1) * 0.14); // на скорости — чуть шире
    const W = D * Math.tan(0.4) * aspect; // половина ширины кадра у героя
    let tx = h.x + W * 0.45, ga = this.groundAt(st, h.x + W * 0.55);
    if (ga == null) ga = h.y - 3;
    let ty = lab.lerp(h.y, ga, 0.45) + 2.4, rate = 2.2;
    if (st.photo) { D *= 0.55; tx = h.x + 1.2; ty = h.y + 1.2; rate = 0.8; } // фоторежим: медленный наезд
    st.camD = snap ? D : lab.damp(st.camD, D, rate, dt);
    v.distance = st.camD * (1 + Math.sin(lab.t * 0.5) * 0.008);
    v.tilt = this.TILT; v.turn = 0;
    v.target.x = snap ? tx : lab.damp(v.target.x, tx, st.photo ? 1.5 : 7, dt);
    v.target.y = snap ? ty : lab.damp(v.target.y, ty, st.photo ? 1.5 : 2.6, dt);
    v.target.z = 0;
  },
  layersStep(lab, dt) {
    const st = lab.state, v = lab.view, P = st.pal, cx = v.target.x, cy = v.target.y, cot = 1 / Math.tan(v.tilt), aspect = lab.camera ? lab.camera.aspect : 16 / 9;
    const Hd = Z => (v.distance + Z) * Math.tan(0.4), yc = Z => cy - Z * cot; // половина высоты кадра и его центр на глубине Z
    for (const Ly of st.layers) { // хребты стоят в мире (настоящий параллакс), а сдвигаются на целый период — без шва
      const L = Ly.L, gx = cx - this.mod(cx, L.P);
      Ly.mesh.position.set(gx, yc(L.Z), -L.Z);
      if (Ly.capMesh) Ly.capMesh.position.set(gx, yc(L.Z), -L.Z + 0.05);
    }
    const Hs = Hd(380), Ws = Hs * aspect;
    st.sun.position.set(cx + P.n.sunX * Ws, yc(380) + P.n.sunY * Hs, -380);
    st.halo.position.set(st.sun.position.x, st.sun.position.y, -381);
    st.stars.position.set(cx, yc(390), -390);
    st.bands.forEach((b, i) => { const Z = i ? 115 : 55, H = Hd(Z); b.position.set(cx, yc(Z) - 0.38 * H, -Z); b.scale.set(H * aspect * 2.4, H * 0.75, 1); });
    st.clouds.position.set(cx - this.mod(cx - st.cloudOff, 520), yc(200), -200);
    if (P.n.aurora > 0.01) {
      const Ha = Hd(340), t = lab.t;
      st.aurora.forEach((a, i) => {
        a.mesh.position.set(cx, yc(340) + (0.42 + i * 0.12) * Ha, -340 - i * 4);
        if (!dt) return;
        const pos = a.geo.attributes.position, B = a.base;
        for (let j = 0; j < pos.count; j++) { const x = B[j * 3]; pos.setY(j, B[j * 3 + 1] + Math.sin(x * 0.011 + t * 0.35 + a.ph) * 14 + Math.sin(x * 0.03 - t * 0.6) * 4); }
        pos.needsUpdate = true;
      });
    }
  },

  /* ---------- ввод B: фоторежим ---------- */
  togglePhoto(lab) {
    const st = lab.state;
    st.photo = !st.photo;
    if (st.photo) { st.photos++; lab.count('фото'); lab.noise(0.05, 0.12, 5000); lab.tone(1800, 0.03, 'square', 0.03); lab.flash('#ffffff', 0.25); }
    else lab.tone(900, 0.05, 'sine', 0.03);
    this.vignette(lab, st.photo);
  },
  vignette(lab, on) { // рамка-виньетка фоторежима поверх холста
    let el = this._vig;
    if (!el || !el.isConnected) {
      el = this._vig = document.createElement('div');
      el.style.cssText = 'position:absolute;inset:0;pointer-events:none;z-index:4;display:none;box-sizing:border-box;border:10px solid rgba(255,255,255,.92);box-shadow:inset 0 0 180px 50px rgba(0,0,0,.55)';
      const cap = document.createElement('div');
      cap.textContent = 'Фоторежим · B или Shift — едем дальше';
      cap.style.cssText = 'position:absolute;left:50%;bottom:20px;transform:translateX(-50%);font:600 14px system-ui,sans-serif;letter-spacing:.08em;color:#fff;text-shadow:0 1px 3px #000a;white-space:nowrap';
      el.appendChild(cap);
      const host = (lab.renderer && lab.renderer.domElement && lab.renderer.domElement.parentElement) || document.body;
      host.appendChild(el);
    }
    el.style.display = on ? 'block' : 'none';
  },
  hudStep(lab) {
    const st = lab.state, c = lab.cfg;
    if (st.photo) { this.HUDK.forEach(k => lab.hud(k, null)); return; }
    const v = this.variant(lab);
    lab.hud('rule', `${v.name}: ${v.how}`, { color: '#fff1c9', size: 14 });
    lab.hud('dist', st.zen ? null : `${Math.round(st.dist)} м`, { color: '#ffffff', size: 18 });
    lab.hud('combo', !st.zen && st.chain > 0 ? `Серия ×${st.chain}` : null, { color: st.accHex || '#ffe08a', size: 22 });
    lab.hud('mood', st.bible ? `Настроение: ${st.moods[st.mood].name}` : 'Вечный полдень', { color: '#dfe7ff', size: 13 });
    lab.hud('tip', st.time < 9 ? 'Прыжок — пробел или A, держи в воздухе — сальто, фото — Shift или B' : null, { color: '#ffffff', size: 13 });
    lab.hud('gust', st.gust.phase === 1 ? 'Порыв ветра — держись!' : null, { color: '#bfe8ff', size: 16 });
    lab.hud('time', c.limit > 0 ? `Осталось ${Math.max(0, Math.ceil(c.limit - st.time))} с` : null, { color: '#ffffff', size: 15 });
  },

  /* ---------- звук: колокольчики в ладу настроения ---------- */
  music(lab, dt) {
    const st = lab.state, m = st.music;
    m.t -= dt;
    if (m.t > 0) return;
    m.step++;
    const H = k => this.hash(k + (lab.seed % 997));
    if (!st.bible) { // без библии — случайный писк
      const f = 180 + 2200 * H(m.step * 1.7), types = ['square', 'sawtooth', 'triangle', 'sine'];
      lab.tone(f, 0.05 + 0.12 * H(m.step * 2.3), types[Math.floor(H(m.step * 3.1) * 4)], 0.03, H(m.step * 4.7) < 0.4 ? f * (0.5 + H(m.step) * 2) : 0);
      m.t = 0.12 + 0.5 * H(m.step * 5.3);
      return;
    }
    if (st.odd === 5) { // «Не та музыка»: быстрая чиптюн-полька вместо тихих колоколов
      const bar = Math.floor(m.step / 2) % 4, roots = [130.81, 196, 146.83, 196];
      if (m.step % 2 === 0) lab.tone(roots[bar], 0.1, 'square', 0.05); else lab.tone(roots[bar] * 2.52, 0.08, 'square', 0.035);
      const mel = [523.25, 587.33, 659.25, 698.46, 783.99, 880, 987.77, 1046.5];
      lab.tone(mel[Math.floor(H(m.step * 1.3) * 8)], 0.09, 'square', 0.03);
      m.t = 0.16;
      return;
    }
    const M = st.moods[st.mood].def, sc = M.scale, tempo = M.tempo, wave = M.wave || 'sine';
    m.t = tempo;
    if (m.step % 8 === 1) [0, 2, 4].forEach((d, k) => lab.tone(sc[d] / 2, tempo * 7, wave === 'square' ? 'triangle' : 'sine', 0.016, 0, k * 0.05));
    if (H(m.step * 1.37) < 0.55) {
      const f = sc[Math.floor(H(m.step * 2.71) * sc.length)];
      lab.tone(f, wave === 'square' ? 0.25 : 1.5, wave, wave === 'square' ? 0.018 : 0.028);
      lab.tone(f * 2, 0.7, 'triangle', 0.007, 0, 0.012);
    }
  },

  /* ---------- постройка: небо, хребты, склон, предметы, погода, герой ---------- */
  gradTex(lab, stops, alpha) { // вертикальный градиент на холсте: alpha — прозрачность, иначе яркость (для сложения цвета)
    const T = lab.THREE, cv = document.createElement('canvas'); cv.width = 2; cv.height = 128;
    const g = cv.getContext('2d'), gr = g.createLinearGradient(0, 0, 0, 128);
    stops.forEach(([p, v]) => gr.addColorStop(p, alpha ? `rgba(255,255,255,${v})` : `rgb(${Math.round(v * 255)},${Math.round(v * 255)},${Math.round(v * 255)})`));
    g.fillStyle = gr; g.fillRect(0, 0, 2, 128);
    const t = new T.CanvasTexture(cv); t.colorSpace = T.SRGBColorSpace;
    return t;
  },
  buildSky(lab, scene) {
    const st = lab.state, T = lab.THREE, M = st.mats = {};
    if (this._sky) this._sky.dispose();
    const cv = document.createElement('canvas'); cv.width = 2; cv.height = 256;
    st.skyCtx = cv.getContext('2d'); st.skyTex = this._sky = new T.CanvasTexture(cv); st.skyTex.colorSpace = T.SRGBColorSpace;
    scene.background = st.skyTex;
    // солнце (ночью — луна) и мягкий ореол
    M.sun = new T.MeshBasicMaterial({ color: '#ffffff', fog: false });
    st.sun = lab.mesh(new T.CircleGeometry(15, 20), M.sun, { shadow: false });
    const cvr = document.createElement('canvas'); cvr.width = cvr.height = 64;
    const gr2 = cvr.getContext('2d'), rg = gr2.createRadialGradient(32, 32, 0, 32, 32, 32);
    rg.addColorStop(0, '#ffffff'); rg.addColorStop(0.35, '#7a7a7a'); rg.addColorStop(1, '#000000');
    gr2.fillStyle = rg; gr2.fillRect(0, 0, 64, 64);
    const ht = new T.CanvasTexture(cvr); ht.colorSpace = T.SRGBColorSpace;
    M.halo = new T.MeshBasicMaterial({ color: '#ffffff', map: ht, transparent: true, opacity: 0.5, depthWrite: false, blending: T.AdditiveBlending, fog: false });
    st.halo = lab.mesh(new T.CircleGeometry(56, 24), M.halo, { shadow: false });
    // звёзды
    const pts = [];
    for (let i = 0; i < 260; i++) pts.push(lab.rand(-340, 340), lab.rand(-30, 260), 0);
    const sg = new T.BufferGeometry(); sg.setAttribute('position', new T.Float32BufferAttribute(pts, 3));
    M.stars = new T.PointsMaterial({ color: '#ffffff', size: 2.2, sizeAttenuation: false, transparent: true, opacity: 0, fog: false, depthWrite: false });
    st.stars = new T.Points(sg, M.stars); st.stars.frustumCulled = false; scene.add(st.stars);
    // северное сияние: три волнистые ленты, сложение цвета
    const at = this.gradTex(lab, [[0, 0], [0.3, 1], [0.65, 0.35], [1, 0]], false);
    st.aurora = ['#4dffb0', '#36d6ff', '#b07cff'].map((col, i) => {
      const geo = new T.PlaneGeometry(560, 60, 48, 1);
      const m = new T.MeshBasicMaterial({ color: col, map: at, transparent: true, opacity: 0, blending: T.AdditiveBlending, depthWrite: false, fog: false, side: T.DoubleSide });
      const mesh = lab.mesh(geo, m, { shadow: false }); mesh.frustumCulled = false;
      return { mesh, geo, base: Float32Array.from(geo.attributes.position.array), ph: i * 1.7 };
    });
    // облака: плоские лоуполи-клубы, плывут медленно
    M.cloud = new T.MeshBasicMaterial({ color: st.bible ? '#ffffff' : st.rnd.cloud, fog: false });
    st.clouds = lab.instances(new T.IcosahedronGeometry(1, 0), M.cloud, 81, { shadow: false }); st.clouds.frustumCulled = false;
    let ci = 0;
    for (let j = 0; j < 9; j++) {
      const cx0 = j * 58 + lab.rand(-14, 14), cy0 = lab.rand(40, 95), s = lab.rand(9, 16);
      for (let tile = -1; tile <= 1; tile++) for (const [dx, dy, k] of [[0, 0, 1], [s * 0.9, -s * 0.15, 0.7], [-s * 0.85, -s * 0.2, 0.65]]) {
        this.setInst(st.clouds, ci++, tile * 520 + cx0 + dx, cy0 + dy, 0, s * k * 1.6, s * k * 0.55, 2, 0);
      }
    }
    // дымка между хребтами
    const bt = this.gradTex(lab, [[0, 0], [0.55, 0.65], [1, 1]], true);
    st.bands = [0, 1].map(() => { const b = lab.mesh(new T.PlaneGeometry(1, 1), new T.MeshBasicMaterial({ color: '#ffffff', map: bt, transparent: true, opacity: 0.5, depthWrite: false, fog: false }), { shadow: false }); b.frustumCulled = false; return b; });
    if (!st.bible) st.bands.forEach(b => { b.visible = false; });
  },
  buildLayers(lab) {
    const st = lab.state, T = lab.THREE, desert = st.bible && st.setIdx === 2;
    st.layers = this.LAYERS.map((L, k) => {
      const n = Math.round(L.P / L.step), hs = [], tr = [], p1 = lab.rand(0, 6.28), p2 = lab.rand(0, 6.28), jag = L.jag * (desert ? 0.15 : 1);
      for (let i = 0; i < n; i++) {
        const u = i / n * Math.PI * 2;
        hs.push(L.y0 + L.amp * (0.5 + 0.32 * Math.sin(u * L.m + p1) + 0.18 * Math.sin(u * (L.m * 2 + 1) + p2)) + lab.rand(-jag, jag));
        tr.push(L.trees && !desert && lab.chance(0.6) ? lab.rand(0.7, 1.35) : 0);
      }
      const at = i => ((i % n) + n) % n, Hh = i => hs[at(i)];
      const W = (44 + L.Z) * Math.tan(0.4) * 2.6, i0 = Math.floor(-W / L.step) - 1, i1 = Math.ceil((W + L.P) / L.step) + 1, bottom = L.y0 - 60 - L.Z * 0.6;
      const ridge = new T.Shape();
      ridge.moveTo(i0 * L.step, bottom);
      for (let i = i0; i <= i1; i++) ridge.lineTo(i * L.step, Hh(i));
      ridge.lineTo(i1 * L.step, bottom); ridge.lineTo(i0 * L.step, bottom);
      const shapes = [ridge];
      if (L.trees && !desert) for (let i = i0; i < i1; i++) { // ели-силуэты на ближнем хребте
        const s = tr[at(i)]; if (!s) continue;
        const x = (i + 0.5) * L.step, y = (Hh(i) + Hh(i + 1)) / 2, w = 0.8 * s * L.tw, hh = 2.8 * s * L.tw, t = new T.Shape();
        t.moveTo(x - w, y - 0.6); t.lineTo(x + w, y - 0.6); t.lineTo(x, y + hh); t.lineTo(x - w, y - 0.6);
        shapes.push(t);
      }
      const mat = new T.MeshBasicMaterial({ color: st.bible ? '#ffffff' : st.rnd.far[k], fog: false });
      const mesh = lab.mesh(new T.ShapeGeometry(shapes), mat, { shadow: false }); mesh.frustumCulled = false;
      let capMesh = null, capMat = null;
      if (L.caps && !desert) { // снежные шапки на вершинах: зубчатый край
        const capY = L.y0 + L.amp * L.caps, caps = [];
        for (let i = i0 + 1; i < i1; i++) {
          const y = Hh(i);
          if (!(y > capY && y >= Hh(i - 1) && y >= Hh(i + 1))) continue;
          const x = i * L.step, d = Math.min(L.amp * 0.2, y - capY + L.amp * 0.08);
          const side = j => { const yj = Hh(j), xj = j * L.step, k2 = Math.min(1, d / Math.max(0.01, y - yj)); return [x + (xj - x) * k2, y + (yj - y) * k2]; };
          const [lx, ly] = side(i - 1), [rx, ry] = side(i + 1), sh = new T.Shape();
          sh.moveTo(x, y); sh.lineTo(rx, ry); sh.lineTo(x + (rx - x) * 0.45, Math.min(ly, ry) - d * 0.05); sh.lineTo(x, y - d * 0.75);
          sh.lineTo(x + (lx - x) * 0.5, Math.min(ly, ry) + d * 0.1); sh.lineTo(lx, ly); sh.lineTo(x, y);
          caps.push(sh);
        }
        if (caps.length) {
          capMat = new T.MeshBasicMaterial({ color: st.bible ? '#ffffff' : st.rnd.cap, fog: false });
          capMesh = lab.mesh(new T.ShapeGeometry(caps), capMat, { shadow: false }); capMesh.frustumCulled = false;
        }
      }
      return { L, mesh, mat, capMesh, capMat };
    });
  },
  buildSlope(lab) {
    const st = lab.state, T = lab.THREE, N = this.COLS, R = this.ROWS.length, idx = [];
    for (let c = 0; c < N - 1; c++) for (let r = 0; r < R - 1; r++) { const a = c * R + r, b = a + R; idx.push(a, b, a + 1, b, b + 1, a + 1); }
    const geo = new T.BufferGeometry();
    st.slopePos = new Float32Array(N * R * 3); st.slopeCol = new Float32Array(N * R * 3);
    geo.setIndex(idx);
    geo.setAttribute('position', new T.BufferAttribute(st.slopePos, 3).setUsage(T.DynamicDrawUsage));
    geo.setAttribute('color', new T.BufferAttribute(st.slopeCol, 3).setUsage(T.DynamicDrawUsage));
    st.slopeGeo = geo;
    const m = new T.MeshStandardMaterial({ vertexColors: true, flatShading: true, roughness: 0.92, side: T.DoubleSide });
    st.slope = lab.mesh(geo, m);
    st.slope.frustumCulled = false; st.slope.receiveShadow = true;
    lab.noShadow(st.slope);
  },
  writeSlope(lab) {
    const st = lab.state, P = st.pts, N = this.COLS, R = this.ROWS, pos = st.slopePos, n = Math.min(P.length, N);
    let o = 0;
    for (let c = 0; c < N; c++) {
      const p = P[Math.min(c, n - 1)];
      for (let r = 0; r < R.length; r++) { const w = R[r]; pos[o++] = p.x; pos[o++] = p.y + w[1] + p.j * w[3]; pos[o++] = w[0] + p.j * w[2]; }
    }
    st.slopeGeo.attributes.position.needsUpdate = true;
    this.writeColors(lab);
  },
  writeColors(lab) {
    const st = lab.state, P = st.pts, N = this.COLS, R = this.ROWS.length, col = st.slopeCol, n = Math.min(P.length, N), map = this.ROWC;
    if (!n) return;
    const S = st.bible ? st.pal.slope : null, rc = st.rnd && st.rnd.slope;
    let o = 0;
    for (let c = 0; c < N; c++) {
      const p = P[Math.min(c, n - 1)];
      for (let r = 0; r < R; r++) {
        const k = S ? S[map[r]] : rc, m = (1 + p.j * 0.045 * (r > 2 ? 1 : 0.4)) * (S ? (r < 3 ? 1.12 : 1.06) * (1 - 0.12 * st.pal.n.flat) : 1 - 0.1 * map[r]);
        col[o++] = k.r * m; col[o++] = k.g * m; col[o++] = k.b * m;
      }
    }
    st.slopeGeo.attributes.color.needsUpdate = true;
  },
  buildObjects(lab) {
    const st = lab.state, T = lab.THREE, M = st.mats, bible = st.bible;
    const std = (o = {}) => new T.MeshStandardMaterial(Object.assign({ color: '#ffffff', roughness: 0.85, flatShading: true }, o));
    const inst = (geo, mat, n, shadow) => { const m = lab.instances(geo, mat, n, shadow ? {} : { shadow: false }); m.frustumCulled = false; return m; };
    const shiny = () => std({ flatShading: false, roughness: 0.12, metalness: 0.55 });
    st.decorBase = bible && st.setIdx === 2 ? 'cactus' : 'fir';
    st.decor = {};
    const kinds = !bible ? ['fir', 'ball', 'cyl', 'box'] : [st.decorBase].concat(st.odd === 1 ? ['crystal'] : st.odd === 3 ? ['ball', 'cyl'] : st.odd === 6 ? ['palm'] : []);
    const cap = 110;
    for (const kind of kinds) {
      if (kind === 'fir') { // ель: два конуса и ствол
        const crowns = inst(new T.ConeGeometry(1, 2.2, 6), M.crown = std(), cap * 2), trunk = inst(new T.CylinderGeometry(0.14, 0.2, 1, 5), M.trunk = std(), cap);
        st.decor.fir = { cap, n: 0, place: (i, x, y, z, s, rot, col) => {
          const o = col ? { color: col } : {};
          lab.place(crowns, i * 2, [x, y + 1.5 * s, z], Object.assign({ scale: [0.95 * s, s, 0.95 * s], rot }, o));
          lab.place(crowns, i * 2 + 1, [x, y + 2.45 * s, z], Object.assign({ scale: [0.66 * s, 0.8 * s, 0.66 * s], rot: rot + 0.5 }, o));
          lab.place(trunk, i, [x, y + 0.4 * s, z], Object.assign({ scale: [s, 0.9 * s, s] }, o));
        } };
      } else if (kind === 'cactus') { // кактус: ствол и два колена
        const parts = inst(new T.CylinderGeometry(0.26, 0.3, 1, 7), M.cactus = std(), cap * 5);
        st.decor.cactus = { cap, n: 0, place: (i, x, y, z, s) => {
          lab.place(parts, i * 5, [x, y + 1.2 * s, z], { scale: [s, 2.4 * s, s] });
          lab.place(parts, i * 5 + 1, [x - 0.42 * s, y + 1.05 * s, z], { scale: [0.6 * s, 0.32 * s, 0.6 * s], rot: [0, 0, Math.PI / 2] });
          lab.place(parts, i * 5 + 2, [x - 0.62 * s, y + 1.5 * s, z], { scale: [0.6 * s, 0.9 * s, 0.6 * s] });
          lab.place(parts, i * 5 + 3, [x + 0.4 * s, y + 0.8 * s, z], { scale: [0.55 * s, 0.3 * s, 0.55 * s], rot: [0, 0, Math.PI / 2] });
          lab.place(parts, i * 5 + 4, [x + 0.58 * s, y + 1.15 * s, z], { scale: [0.55 * s, 0.7 * s, 0.55 * s] });
        } };
      } else if (kind === 'ball') { // гладкий блестящий шар — чужая форма среди лоуполи
        const b = inst(new T.IcosahedronGeometry(1, 3), M.ball = shiny(), cap);
        st.decor.ball = { cap, n: 0, place: (i, x, y, z, s, rot, col) => lab.place(b, i, [x, y + 1.05 * s, z], Object.assign({ scale: 1.05 * s }, col ? { color: col } : {})) };
      } else if (kind === 'cyl') {
        const b = inst(new T.CylinderGeometry(0.55, 0.55, 1, 24), M.cyl = shiny(), cap);
        st.decor.cyl = { cap, n: 0, place: (i, x, y, z, s, rot, col) => lab.place(b, i, [x, y + 1.25 * s, z], Object.assign({ scale: [s, 2.5 * s, s] }, col ? { color: col } : {})) };
      } else if (kind === 'box') {
        const b = inst(new T.BoxGeometry(1, 1, 1), std(), cap);
        st.decor.box = { cap, n: 0, place: (i, x, y, z, s, rot, col) => lab.place(b, i, [x, y + 0.9 * s, z], { scale: [1.2 * s, 1.8 * s, 1.2 * s], rot, color: col }) };
      } else if (kind === 'crystal') { // кислотно-розовый светящийся кристалл — чужой цвет
        const b = inst(new T.OctahedronGeometry(0.8, 0), new T.MeshStandardMaterial({ color: '#ff2bd6', emissive: '#ff2bd6', emissiveIntensity: 1.6, flatShading: true }), cap);
        st.decor.crystal = { cap, n: 0, place: (i, x, y, z, s, rot) => lab.place(b, i, [x, y + 1.4 * s, z], { scale: [0.8 * s, 1.8 * s, 0.8 * s], rot }) };
      } else if (kind === 'palm') { // пальма на снегу — чужая деталь
        const trunk = inst(new T.CylinderGeometry(0.12, 0.17, 1, 6), std({ color: '#9a6a3a' }), cap * 3), leaves = inst(new T.BoxGeometry(1.7, 0.06, 0.42), std({ color: '#25c04a' }), cap * 6);
        st.decor.palm = { cap, n: 0, place: (i, x, y, z, s) => {
          for (let k = 0; k < 3; k++) lab.place(trunk, i * 3 + k, [x + k * 0.12 * s, y + (0.55 + k * 1.05) * s, z], { scale: [s, 1.1 * s, s], rot: [0, 0, -0.1 - k * 0.06] });
          const top = [x + 0.36 * s, y + 3.2 * s, z];
          for (let k = 0; k < 6; k++) { const a = k / 6 * Math.PI * 2; lab.place(leaves, i * 6 + k, [top[0] + Math.cos(a) * 0.75 * s, top[1] - 0.25 * s, top[2] + Math.sin(a) * 0.75 * s], { scale: s, rot: [0, -a, -0.45] }); }
        } };
      }
    }
    M.rock = std(); st.rockI = inst(new T.IcosahedronGeometry(0.62, 0), M.rock, 24, true);
    M.rockCap = std(); st.rockCapI = inst(new T.IcosahedronGeometry(0.5, 0), M.rockCap, 24);
    M.lan = new T.MeshBasicMaterial({ color: '#ffffff' }); st.lanI = inst(new T.CylinderGeometry(0.2, 0.26, 0.44, 6), M.lan, 48);
    M.lanHalo = new T.MeshBasicMaterial({ color: '#ffffff', transparent: true, opacity: 0.3, blending: T.AdditiveBlending, depthWrite: false });
    st.lanHaloI = inst(new T.IcosahedronGeometry(0.7, 1), M.lanHalo, 48);
    M.pole = std({ color: bible ? '#ffffff' : st.rnd.pole }); st.poleI = inst(new T.CylinderGeometry(0.045, 0.06, 1, 5), M.pole, 40);
    const fg = new T.BufferGeometry(); fg.setAttribute('position', new T.Float32BufferAttribute([-0.18, 0, 0, 0.18, 0, 0, 0, -0.4, 0], 3)); fg.computeVertexNormals();
    M.flag = std({ side: T.DoubleSide }); st.flagI = inst(fg, M.flag, 160);
    M.rope = std({ color: bible ? '#ffffff' : st.rnd.pole }); st.ropeI = inst(new T.BoxGeometry(1, 0.06, 0.06), M.rope, 8);
    M.gapMist = new T.MeshBasicMaterial({ color: bible ? '#ffffff' : '#dddddd', transparent: true, opacity: 0.55, depthWrite: false }); st.gapI = inst(new T.BoxGeometry(1, 1, 1), M.gapMist, 6);
    if (!bible) { M.lan.color.set('#ffffff').multiplyScalar(1.6); M.lanHalo.opacity = 0.25; M.flag.color.set('#ffffff'); M.rock.color.set('#ffffff'); M.rockCap.color.set('#ffffff'); st.dust = ['#ffffff', '#dddddd']; st.accHex = '#ffe08a'; }
  },
  buildWeather(lab) {
    const st = lab.state, T = lab.THREE, M = st.mats;
    M.flake = new T.MeshBasicMaterial({ color: '#ffffff', transparent: true, opacity: 0.9 });
    st.flI = lab.instances(new T.BoxGeometry(0.075, 0.075, 0.075), M.flake, 240, { shadow: false }); st.flI.frustumCulled = false;
    st.fl = Array.from({ length: 240 }, () => ({ rx: lab.rand(-26, 26), ry: lab.rand(-15, 15), x: 0, y: 0, z: lab.rand(-7, 5), v: lab.rand(0.7, 1.4), ph: lab.rand(0, 6.28), on: false }));
    M.streak = new T.MeshBasicMaterial({ color: '#ffffff', transparent: true, opacity: 0.5, depthWrite: false });
    st.skI = lab.instances(new T.BoxGeometry(1, 0.035, 0.035), M.streak, 70, { shadow: false }); st.skI.frustumCulled = false;
    st.sk = Array.from({ length: 70 }, () => ({ rx: lab.rand(-26, 26), x: 0, h: lab.rand(0.05, 1.3), z: lab.rand(-6, 2.5), len: lab.rand(0.6, 2.2), v: lab.rand(0.7, 1.3), on: false }));
  },
  buildHero(lab) {
    const st = lab.state, T = lab.THREE;
    let H = Object.assign({}, this.HERO, st.bible ? ((st.moods[0].def.fix || {}).hero || {}) : st.rnd.hero);
    const white = st.odd === 2; // «Силуэт героя»: белый как снег, без шарфа
    if (white) H = { jacket: '#f2f5fb', pants: '#e9edf5', skin: '#f2f5fb', hat: '#f2f5fb', board: '#e9edf5', scarf: '#f2f5fb' };
    const mk = (hex, o = {}) => new T.MeshStandardMaterial(Object.assign({ color: hex, roughness: 0.8, flatShading: true }, o));
    const m = st.hm = { jacket: mk(H.jacket), pants: mk(H.pants), skin: mk(H.skin), hat: mk(H.hat), board: mk(H.board, { roughness: 0.5 }),
      scarf: mk(H.scarf, { emissive: H.scarf, emissiveIntensity: white ? 0 : 0.45 }), eye: mk('#ffffff'), pupil: mk('#101018') };
    const g = st.heroG = lab.group();
    lab.box(1.55, 0.08, 0.36, m.board, { parent: g, at: [0, 0.05, 0], round: 0.035 });
    st.body = lab.group({ parent: g, at: [0, 0.1, 0] });
    st.pose = lab.group({ parent: st.body });
    const P = st.pose;
    lab.box(0.17, 0.62, 0.2, m.pants, { parent: P, at: [0.26, 0.3, 0.02], rot: [0, 0, -0.28] });
    lab.box(0.17, 0.62, 0.2, m.pants, { parent: P, at: [-0.24, 0.3, -0.02], rot: [0, 0, 0.28] });
    lab.box(0.5, 0.22, 0.3, m.pants, { parent: P, at: [0, 0.64, 0] });
    lab.box(0.44, 0.6, 0.34, m.jacket, { parent: P, at: [0.05, 0.97, 0], rot: [0, 0, -0.12], round: 0.05 });
    st.armF = lab.group({ parent: P, at: [0.16, 1.18, 0.12] }); lab.box(0.13, 0.5, 0.14, m.jacket, { parent: st.armF, at: [0, -0.24, 0] });
    st.armB = lab.group({ parent: P, at: [-0.08, 1.18, -0.12] }); lab.box(0.13, 0.5, 0.14, m.jacket, { parent: st.armB, at: [0, -0.24, 0] });
    lab.ball(0.19, m.skin, { parent: P, at: [0.12, 1.45, 0] });
    lab.ball(0.2, m.hat, { parent: P, at: [0.09, 1.53, 0], scale: [1.02, 0.72, 1.02] });
    lab.ball(0.075, m.hat, { parent: P, at: [-0.02, 1.7, 0] });
    lab.ball(0.045, m.eye, { parent: P, at: [0.26, 1.46, 0.1], shadow: false });
    lab.ball(0.026, m.pupil, { parent: P, at: [0.295, 1.46, 0.12], shadow: false });
    if (!white) lab.box(0.32, 0.12, 0.38, m.scarf, { parent: P, at: [0.07, 1.29, 0] }); // узел шарфа
    st.scarf = null;
    if (!white) { // длинный шарф: пять звеньев тянутся за героем, кончик оставляет светящийся след
      const anchor = lab.group({ parent: P, at: [-0.08, 1.3, 0.2] });
      const segs = [0, 1, 2, 3, 4].map(i => lab.box(0.34, 0.11 - i * 0.008, 0.05, m.scarf, { shadow: false }));
      st.scarf = { anchor, segs, p: segs.map(() => ({ x: 0, y: 0 })), v: new T.Vector3(), trail: null };
      st.scarf.trail = lab.trail(segs[4], { color: H.scarf, width: 0.18, length: 20, glow: 1.4 });
    }
  },
  scarfInit(lab) {
    const st = lab.state, S = st.scarf;
    if (!S) return;
    st.heroG.updateMatrixWorld(true);
    const a = S.anchor.getWorldPosition(S.v);
    S.p.forEach((p, i) => { p.x = a.x - (i + 1) * 0.3; p.y = a.y - (i + 1) * 0.05; });
    this.scarfDraw(lab);
    if (S.trail) S.trail.clear();
  },
  scarfStep(lab, dt) { // шарф вьётся против движения, порыв ветра и сальто закручивают его
    const st = lab.state, S = st.scarf, h = st.hero, c = lab.cfg;
    if (!S) return;
    st.heroG.updateMatrixWorld(true);
    const a = S.anchor.getWorldPosition(S.v);
    const vx = h.air || st.crash ? h.vx : h.s * Math.cos(h.rot), vy = h.air || st.crash ? h.vy : h.s * Math.sin(h.rot);
    const sp = Math.hypot(vx, vy), k = Math.min(1, sp / 6), gk = st.gust.k * (c.wind || 0);
    let dx = -vx / (sp || 1) * k - gk * 0.8, dy = -vy / (sp || 1) * k - (1 - k) + 0.1;
    let px = a.x, py = a.y;
    S.p.forEach((p, i) => {
      const fl = Math.sin(lab.t * 11 + i * 0.9) * 0.45 * k, cs = Math.cos(fl), sn = Math.sin(fl);
      const tx = px + (dx * cs - dy * sn) * 0.3, ty = py + (dx * sn + dy * cs) * 0.3;
      p.x = lab.damp(p.x, tx, 28, dt); p.y = lab.damp(p.y, ty, 28, dt);
      const ex = p.x - px, ey = p.y - py, d = Math.hypot(ex, ey) || 1;
      p.x = px + ex / d * 0.3; p.y = py + ey / d * 0.3;
      px = p.x; py = p.y;
    });
    this.scarfDraw(lab);
  },
  scarfDraw(lab) {
    const st = lab.state, S = st.scarf, a = S.v;
    let px = a.x, py = a.y;
    S.segs.forEach((m, i) => { const p = S.p[i]; m.position.set((px + p.x) / 2, (py + p.y) / 2, 0.22 - i * 0.015); m.rotation.set(0, 0, Math.atan2(p.y - py, p.x - px)); px = p.x; py = p.y; });
  },
  pose(lab, dt) {
    const st = lab.state, h = st.hero, g = st.heroG;
    g.position.set(h.x, h.y, 0); g.rotation.z = h.rot;
    st.tuck = dt ? lab.damp(st.tuck, h.air && st.w > 2 && !st.crash ? 1 : 0, 12, dt) : st.tuck;
    const crouch = st.crash ? 0.25 : h.air ? 0.2 : 0.1 + 0.05 * Math.sin(st.time * 6);
    st.pose.scale.y = 1 - 0.22 * st.tuck - crouch * 0.15;
    st.pose.rotation.z = 0.3 * st.tuck;
    st.armF.rotation.z = lab.lerp(h.air ? -1.7 : -1.15, -0.2, st.tuck);
    st.armB.rotation.z = lab.lerp(h.air ? 1.7 : 1.2, 0.4, st.tuck);
    g.visible = !(st.safeT > 0 && Math.floor(st.safeT * 12) % 2 === 0);
  },
};
