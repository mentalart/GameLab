// «Старейшина» — ремейк-донор урока 19 по мотивам Reigns (Nerial, 2016) на оболочке «Лаб3D» 1.0 (three.js).
// Ты — старейшина аула. Вечер, двор кунацкой, у очага под ореховым деревом. К тебе по одному приходят люди аула с просьбами:
// склони карту влево или вправо — и аул живёт дальше. Четыре шкалы аула (Урожай, Люди, Стада, Гости) не должны дойти ни до дна, ни до краёв:
// пусто — беда, через край — тоже беда. Каждая карта — сезон, четыре сезона — год. Счёт — годы правления.
// Спрятанная механика донора — последствия: решения запоминаются, и через 3–8 карт тот же человек приходит снова
// («Помнишь, ты отказал мне в угле?») с отложенным ударом по шкалам. Ручка secret = 0 (пресет «Без спрятанной механики») —
// карты не помнят решений: только основная колода, эффекты сразу.
// Вариации урока 19 (мастерская «Ветвящаяся история»): ручки scales, hints, timer, winter, stakes, lives, goals, limit —
// приёмы Reigns и его продолжений (Reigns: Her Majesty — поручения, Game of Thrones — династия, Lapse — таймер).
/* ПЛАН
   Фраза игры: ты — старейшина аула у очага в кунацкой, ты отвечаешь «да» или «нет» каждому, кто пришёл с просьбой,
   но любое решение тянет одну шкалу вверх, другую вниз, а забытые ответы возвращаются через годы. Цель — править как можно дольше.
   Ядро на 3 секунды: стрелка → карта наклоняется, на её краю проступает ответ, над шкалами загораются точки →
   ещё раз стрелка или A → карта улетает, гость уходит, шкалы переливаются, всплывают «+2» и «−1».
   Выбор, оплаченный годами: помочь кузнецу (Урожай вверх, Люди вниз) или отказать (сейчас спокойно, но через три года он уйдёт);
   большая точка — сильный удар по шкале, маленькая — лёгкий; направление не видно, его надо помнить.
   Угрозы: шкала у дна (голод, пустой аул), шкала у края (разбойники на полные амбары, народ выбирает нового старейшину),
   последствия старых решений, зима (с ручкой winter), таймер (с ручкой timer).
   Кривая партии: 0–10 с — первый год, мягкие карты по ±1, проиграть нельзя; 10–30 с — первые последствия, шкалы расходятся;
   30–90 с — цепочки (сватовство, нарт Сосруко), удары по ±2–3; дальше шкалы у краёв и каждый ответ рискованный.
   События: новая карта (гость входит и кланяется), наклон (ответ на краю, точки над шкалами), решение (карта улетает со следом),
   шкала меняется (вспышка, «+2»), шкала у края (пульсирует красным), последствие (нить на карте, «Помнишь?», колокол),
   новый сезон (дерево меняется, снег), новый год (+1 к счёту, мелодия), поручение выполнено (праздник, +2 года),
   финал (замедление, наезд камеры, вспышка шкалы, «Новый финал!»), наследник (династия).
   Лицо игры: адыгский вечер во дворе кунацкой — тёплый очаг и пергамент карты против холодных синих гор, сезоны на ореховом дереве.
   Свет: ключевой — низкое закатное солнце слева, тёплый огонь очага снизу; заполняющий — холодное небо.
   Палитра: небо #2f3f96 → закат #ffa65e, горы #55588f, пергамент #f4e4c1, орнамент #b8322a и золото #e8b23a,
   шкалы: Урожай #ffc93c, Люди #ff8fb1, Стада #9be36a, Гости #5fd4ff; огонь #ff7a1a, опасность #ff4d5e.
   Три фирменных приёма: пергаментная карта с адыгским орнаментом, на краю которой при наклоне проступает ответ;
   дощечки шкал под резной балкой навеса, над которыми загораются точки-огоньки; ореховое дерево и двор меняют сезон — цвет, листопад, снег.
*/
const GAME = {
  engine: 'three',
  title: 'Старейшина',
  subtitle: 'Влево или вправо — и аул живёт дальше. Сколько лет ты продержишься?',
  donor: 'Reigns',
  players: 1,
  pace: 'turns', // пошаговая: бот не считает ожидание ошибкой
  controls: [
    { input: 'move', text: 'склонить карту влево или вправо' },
    { input: 'a', text: 'решить' },
  ],
  scoreColor: '#ffc93c', // счёт — годы правления, золотом
  camera: { type: 'free', fov: 0.82 },
  field: { w: 14, h: 14 },
  sky: ['#2f3f96', '#ffa65e'],
  fog: 0.011,
  accent: '#ffe08a',
  decisions: [
    'Чувство: наклонил карту — над шкалами зажглись огоньки, решил — карта улетела, а через три года тот же человек пришёл снова',
    'Честность: точки показывают, какие шкалы изменятся и насколько сильно; шкала у края пульсирует красным заранее',
    'Выбор: помочь сейчас и потерять одно или отказать и рискнуть другим — каждая карта тянет одну шкалу вверх, другую вниз',
  ],
  notes: [
    'Новая карта принимает ответ только через полсекунды после появления: иначе двойное нажатие стрелки решает две карты подряд. Нажатие в эти полсекунды запоминается.',
    'Первый год колода кладёт сверху две карты с последствиями — одну на «влево», одну на «вправо»: нить памяти видна уже в первую минуту.',
    'Последствие приносит отложенный удар по шкалам сразу при появлении, ещё до ответа: так забытое решение действительно может свергнуть.',
  ],
  config: {
    secret: { value: 1, min: 0, max: 1, step: 1, label: 'Спрятанная механика: решения возвращаются', names: ['выкл', 'вкл'], hint: '0 — карты не помнят решений: последствий нет, эффекты сразу', restart: true },
    scales: { value: 4, min: 2, max: 4, step: 1, label: 'Шкал аула', hint: '2 — Урожай и Люди, 3 — плюс Стада, 4 — плюс Гости', restart: true },
    hints: { value: 1, min: 0, max: 2, step: 1, label: 'Подсказки над шкалами', names: ['нет', 'точки', 'стрелки и числа'], hint: '1 — точки как в Reigns: видно, что изменится и насколько, но не куда' },
    timer: { value: 0, min: 0, max: 15, step: 1, label: 'Секунд на ответ (0 — без таймера)', hint: 'время вышло — решает случай: «Ты промолчал…»' },
    winter: { value: 0, min: 0, max: 1, step: 1, label: 'Зима: каждую зиму Урожай −1 и Стада −1', names: ['выкл', 'вкл'] },
    stakes: { value: 1, min: 1, max: 3, step: 1, label: 'Ставки: множитель эффектов' },
    lives: { value: 1, min: 1, max: 5, step: 1, label: 'Правителей в династии', hint: 'больше 1 — после финала правит наследник, годы идут дальше', restart: true },
    goals: { value: 0, min: 0, max: 1, step: 1, label: 'Поручения аула', names: ['выкл', 'вкл'], hint: 'выполнил поручение — +2 года и праздник', restart: true },
    limit: { value: 0, min: 0, max: 600, step: 30, label: 'Время на партию, с (0 — без времени)' },
    startAt: { value: 5, min: 3, max: 7, step: 1, label: 'Шкалы в начале правления', restart: true },
    calm: { value: 6, min: 0, max: 16, step: 1, label: 'Мягкое начало правления, карт', hint: 'первые карты меняют шкалы не больше чем на 1 и не доводят до края; 0 — с первой карты всерьёз' },
    lock: { value: 0.65, min: 0, max: 1.5, step: 0.05, label: 'Пауза перед ответом на новую карту, с', hint: 'карта сначала прилетает, потом принимает ответ' },
    echoMin: { value: 0, min: -2, max: 4, step: 1, label: 'Последствия приходят позже на, карт', hint: 'прибавка к сроку каждой карты (обычно через 3–8 карт)' },
  },
  presets: {
    'Новичок': { hints: 2, lives: 2 },
    'Без спрятанной механики': { secret: 0 },
    'Три шкалы': { scales: 3 },
    'Вслепую': { hints: 0 },
    'Всё видно': { hints: 2 },
    'На время': { timer: 6 },
    'Зима': { winter: 1 },
    'Крупные ставки': { stakes: 2 },
    'Династия': { lives: 3 },
    'Поручения': { goals: 1 },
  },
  // имя вариации и её правило для баннера в начале, строки над полем и экрана конца партии
  VARIANTS: [
    { key: 'scales', on: c => c.scales < 4, name: c => (c.scales <= 2 ? 'Две шкалы' : 'Три шкалы'), how: c => (c.scales <= 2 ? 'только Урожай и Люди' : 'Урожай, Люди и Стада — без Гостей') },
    { key: 'hints', on: c => Math.round(c.hints) === 0, name: () => 'Вслепую', how: () => 'огоньков над шкалами нет — помни, кто чего хочет' },
    { key: 'hints', on: c => Math.round(c.hints) === 2, name: () => 'Всё видно', how: () => 'над шкалами стрелки и числа: видно, что и куда изменится' },
    { key: 'timer', name: () => 'На время', how: c => `${Math.round(c.timer)} с на ответ, промолчишь — решит случай` },
    { key: 'winter', name: () => 'Зима', how: () => 'каждую зиму Урожай −1 и Стада −1' },
    { key: 'stakes', on: c => c.stakes > 1, name: () => 'Крупные ставки', how: c => `все изменения ×${Math.round(c.stakes)}` },
    { key: 'lives', on: c => c.lives > 1, name: () => 'Династия', how: c => `${Math.round(c.lives)} правителя: после финала правит наследник` },
    { key: 'goals', name: () => 'Поручения', how: () => 'выполни поручение аула — +2 года и праздник' },
  ],
  FOUND: new Set(), // найденные финалы за этот заход в игру (у каждой страницы свой)

  /* ---------- шкалы, сезоны, финалы ---------- */
  KEYS: ['u', 'l', 's', 'g'],
  SCALES: {
    u: { name: 'Урожай', acc: 'Урожай', color: '#ffc93c' },
    l: { name: 'Люди', acc: 'Людей', color: '#ff8fb1' },
    s: { name: 'Стада', acc: 'Стада', color: '#9be36a' },
    g: { name: 'Гости', acc: 'Гостей', color: '#5fd4ff' },
  },
  SEASONS: [
    { name: 'Весна', top: '#3d55b0', hor: '#ffb48c', ground: '#6fb04c', yard: '#b8966a', crown: ['#86c96c', '#9ad67a', '#74b85e'], blossom: true, flowers: true, sun: '#ffc89a' },
    { name: 'Лето', top: '#2f3f96', hor: '#ffa65e', ground: '#4f9a3c', yard: '#b08a5a', crown: ['#2f7d3a', '#3a8f44', '#2a6e34'], flowers: true, sun: '#ffb070' },
    { name: 'Осень', top: '#3a2c74', hor: '#ff7d4a', ground: '#a88a3c', yard: '#a07a4a', crown: ['#f0a02c', '#e0601e', '#f2c230'], leaves: true, sun: '#ff9a5a' },
    { name: 'Зима', top: '#1f2b66', hor: '#a8b6ea', ground: '#e6edf8', yard: '#d5deec', crown: ['#e8eef8', '#d9e3f2', '#f4f7fc'], snow: true, sun: '#c8d4ff' },
  ],
  ENDINGS: [
    { id: 'u0', name: 'Голодная зима', text: 'Голодная зима: аул ушёл к соседям, а тебя оставили сторожить пустые амбары' },
    { id: 'u10', name: 'Полные амбары', text: 'Полные амбары приманили разбойников с перевала. Унесли зерно — и тебя заодно' },
    { id: 'l0', name: 'Пустой аул', text: 'Люди разошлись по долинам. Старейшина без аула — просто дед у очага' },
    { id: 'l10', name: 'Новый старейшина', text: 'Народ сам выбрал нового старейшину. Тебе подарили тёплые чувяки и место у очага' },
    { id: 's0', name: 'Ни овцы', text: 'Ни овцы, ни коровы. Сыр теперь только у соседей — и они его не дают' },
    { id: 's10', name: 'Стада съели луга', text: 'Овец стало больше, чем травы. Стадо ушло за перевал — и ты с ним, считать' },
    { id: 'g0', name: 'Закрытые ворота', text: 'Гостей прогоняли слишком часто. Об ауле пошла дурная слава — даже родня обходит стороной' },
    { id: 'g10', name: 'Гости съели всё', text: 'Гости съели все запасы. Ты так щедр, что сам пошёл в гости — и остался' },
    { id: 'sosruko', name: 'Ушёл с нартами', text: 'Нарт Сосруко увёл тебя к вечному огню нартов. Аул поёт о тебе песни и ждёт до сих пор' },
    { id: 'svadba', name: 'Свадьба на всю долину', text: 'Свадьбу гуляли сорок дней. На сорок первый тебя назвали мудрейшим — и отпустили отдыхать' },
  ],
  // кто приходит: имя на карте и вид человечка из примитивов
  WHO: {
    kuznec: { name: 'Кузнец Хамид', dat: 'кузнецу Хамиду', look: { coat: '#c9542e', apron: '#6b3f22', hat: 'papakha', hatColor: '#2a2420', beard: '#2a1d17', item: 'hammer', wide: 1.12 } },
    pastukh: { name: 'Пастух Аслан', dat: 'пастуху Аслану', look: { coat: '#5d6b7a', burka: '#25252c', hat: 'papakha', hatColor: '#8e8a86', must: '#3a2a20', item: 'staff' } },
    kupec: { name: 'Купец Мурат', dat: 'купцу Мурату', look: { coat: '#c4302b', trim: '#ffd166', hat: 'cap', hatColor: '#5b2a86', must: '#1f1612', item: 'bundle', wide: 1.1 } },
    okhotnik: { name: 'Охотник Казбек', dat: 'охотнику Казбеку', look: { coat: '#3f7a3a', hat: 'fur', hatColor: '#7a5230', beard: '#5a3a22', item: 'bow' } },
    znakharka: { name: 'Знахарка Нафисет', dat: 'знахарке Нафисет', look: { coat: '#7b3fa0', dress: true, hat: 'scarf', hatColor: '#e7d4a8', item: 'basket', skin: '#e2a982' } },
    dzhigit: { name: 'Джигит Тембот', dat: 'джигиту Темботу', look: { coat: '#1f9e8f', gaz: true, hat: 'tall', hatColor: '#1c1a1a', must: '#1c1612', item: 'dagger', slim: true } },
    knyaz: { name: 'Князь из-за реки', dat: 'князю из-за реки', look: { coat: '#9e1f3a', trim: '#e8b23a', gaz: true, hat: 'fur', hatColor: '#efe6d6', beard: '#3a2a1e', item: 'cane', tall: 1.06 } },
    tkachikha: { name: 'Ткачиха Сусана', dat: 'ткачихе Сусане', look: { coat: '#e0567a', dress: true, hat: 'scarf', hatColor: '#ffd166', item: 'carpet' } },
    deti: { name: 'Дети аула', dat: 'детям аула', look: { twins: true, coat: '#ff9f1c', coat2: '#4cc9f0', hat: 'papakha', hatColor: '#3a2a20', item: 'ball' } },
    drug: { name: 'Старый друг Лиуан', dat: 'старому другу Лиуану', look: { coat: '#7b8794', hat: 'papakha', hatColor: '#d8d4cc', beard: '#e8e4dc', item: 'cane', skin: '#e0a882' } },
    putnik: { name: 'Путник', dat: 'путнику', look: { coat: '#a07850', hat: 'wide', hatColor: '#5a4630', beard: '#6b5a48', item: 'bag' } },
    uchitel: { name: 'Учитель Адам', dat: 'учителю Адаму', look: { coat: '#2f5d50', hat: 'cap', hatColor: '#2a2a30', beard: '#3a2a20', item: 'book' } },
    sosruko: { name: 'Нарт Сосруко', dat: 'нарту Сосруко', look: { coat: '#d9a520', glow: true, hat: 'helmet', hatColor: '#ffd23f', cape: '#c0392b', must: '#7a3a12', item: 'sword', tall: 1.12, wide: 1.1 } },
    svakha: { name: 'Сваха Фатимет', dat: 'свахе Фатимет', look: { coat: '#c0612b', dress: true, hat: 'scarf', hatColor: '#f4f1ea', item: 'gifts', skin: '#e0a882' } },
  },
  // колода: основная (тасуется по зерну) и карты-последствия (back: true). Эффекты: u — Урожай, l — Люди, s — Стада, g — Гости
  DECK: (() => {
    const out = [];
    const card = (id, who, text, l, r, then, extra) => out.push(Object.assign({ id, who, text, left: { say: l[0], eff: l[1] || {}, end: l[2] }, right: { say: r[0], eff: r[1] || {}, end: r[2] } },
      then ? { then: { side: then[0], after: [then[1], then[2]], card: then[3] } } : {}, extra || {}));
    const back = (id, who, text, arrive, l, r, then) => card(id, who, text, l, r, then, { back: true, arrive: arrive || {} });
    // основная колода
    card('kuz_coal', 'kuznec', 'Угля на зиму нет. Дай дров из общего леса — накую кос на весь аул!', ['Лес не трогать', { l: 1 }], ['Бери дрова', { u: 2, l: -1 }], ['left', 3, 5, 'kuz_gone']);
    card('past_wolves', 'pastukh', 'Волки ходят вокруг отары. Дай парней в ночной дозор.', ['Сами справитесь', { l: 1, s: -1 }], ['Дам дозор', { s: 1, l: -1 }], ['right', 3, 5, 'past_gift']);
    card('kupec_salt', 'kupec', 'Привёз соль из Тамани! Отдам за десять овец — дёшево, клянусь усами.', ['Дорого', { g: -1 }], ['Беру соль', { s: -2, u: 2 }], ['right', 3, 5, 'kupec_back']);
    card('okh_deer', 'okhotnik', 'Отпусти меня в лес на всю луну. Вернусь с дичью для гостей.', ['Ты нужен в поле', { u: 1, l: -1 }], ['Иди с удачей', { u: -1, g: 1 }], ['right', 3, 6, 'okh_bear']);
    card('znakh_honey', 'znakharka', 'Дети кашляют. Отдай мне мёд из общей кладовой — сварю отвар.', ['Мёд — для гостей', { g: 1, l: -2 }], ['Бери мёд', { l: 2, g: -1 }], ['left', 3, 5, 'znakh_cough']);
    card('dzhig_race', 'dzhigit', 'Хочу на скачки в соседний аул! Дай лучшего коня.', ['Конь пашет', { u: 1, l: -1 }], ['Скачи!', { u: -1, g: 1 }], ['right', 3, 5, 'dzhig_win']);
    card('knyaz_grass', 'knyaz', 'Ваши овцы едят нашу траву. Платите шерстью — или будем спорить до старости.', ['Не заплатим', { s: 1, g: -2 }], ['Заплатим', { s: -2, g: 1 }], ['left', 3, 6, 'knyaz_spor']);
    card('tkach_carpet', 'tkachikha', 'Соткала ковёр для кунацкой — самый длинный в долине. Повесим?', ['Продай купцам', { u: 1, g: -1 }], ['Повесим!', { g: 2, u: -1 }]);
    card('deti_swing', 'deti', 'Сделай нам качели на старом орехе! Ну пожалуйста!', ['Орех старый', { l: -1 }], ['Будут качели', { l: 2, u: -1 }], ['right', 3, 5, 'deti_friends']);
    card('drug_nardy', 'drug', 'Сыграем в нарды, как в молодости? До утра, не дольше.', ['Дела аула', { l: 1, g: -1 }], ['Расставляй!', { g: 1, l: -1 }]);
    card('putnik_night', 'putnik', 'Я из дальних гор. Пустишь переночевать? Расскажу, что видел.', ['Нет места', { g: -2 }], ['Заходи, гость', { g: 2, u: -1 }], ['right', 3, 5, 'putnik_news']);
    card('uchitel_school', 'uchitel', 'Дети должны знать грамоту. Отдай пустую саклю под школу.', ['Сакля — гостям', { g: 1, l: -1 }], ['Будет школа', { l: 2, g: -1 }], ['right', 4, 7, 'uchitel_letter']);
    card('past_summer', 'pastukh', 'Пора гнать отару на летние пастбища. Возьму половину парней.', ['Парни нужны тут', { u: 1, s: -1 }], ['Берите', { s: 2, l: -1 }]);
    card('kuz_plow', 'kuznec', 'Выкую новые плуги, но нужно железо. Отдай свой старый котёл.', ['Котёл нужен', { g: 1, u: -1 }], ['Бери котёл', { u: 2, g: -1 }], ['left', 3, 5, 'kuz_zigzag']);
    card('kupec_horse', 'kupec', 'Продам кабардинского коня — быстрого, как слух! Всего двадцать овец.', ['Не нужен', { s: 1, l: -1 }], ['Беру коня', { s: -2, l: 1, g: 1 }]);
    card('okh_wolf', 'okhotnik', 'Волк унёс ягнёнка. Пойду по следу, но нужны ещё трое.', ['Пусть уходит', { s: -1, l: 1 }], ['Идите', { s: 1, l: -1 }]);
    card('svakha_match', 'svakha', 'Джигит Тембот влюбился в дочь князя из-за реки. Пойдёшь сватом?', ['Не моё дело', { l: -1 }], ['Пойду сватом', { g: 1, u: -1 }], ['right', 3, 5, 'svakha_kalym']);
    card('sosruko_horse', 'sosruko', 'Я — нарт Сосруко. Дай мне лучшего коня: надо догнать великана.', ['Коня не дам', { g: -1, s: 1 }], ['Бери коня', { s: -1, g: 1 }], ['right', 3, 5, 'sosruko_feast']);
    card('tkach_wool', 'tkachikha', 'Шерсти мало, станки стоят. Остриги овец раньше срока.', ['Овцы замёрзнут', { s: 1, l: -1 }], ['Стрижём', { s: -1, u: 1 }]);
    card('deti_puppy', 'deti', 'Мы нашли щенка! Можно он будет сторожить отару?', ['Мал ещё', { l: -1 }], ['Пусть растёт', { u: -1, s: 1 }], ['right', 4, 7, 'deti_dog']);
    card('drug_debt', 'drug', 'Одолжи мешок зерна до весны. Верну — слово старого друга!', ['Нет зерна', { u: 1, g: -1 }], ['Бери, друг', { u: -2, g: 1 }], ['right', 4, 6, 'drug_return']);
    card('putnik_song', 'putnik', 'Я сказитель. Спою о нартах всю ночь, если накормите.', ['Петь и сами умеем', { g: -1, u: 1 }], ['Пой!', { g: 1, l: 1, u: -1 }]);
    card('uchitel_stars', 'uchitel', 'Построю на горе вышку — буду считать звёзды и предсказывать погоду.', ['Звёзды подождут', { l: -1, u: 1 }], ['Строй', { l: 1, u: -1 }]);
    card('knyaz_feast', 'knyaz', 'Приглашаю на пир! Откажешь — обидишь. Поедешь — аул неделю без тебя.', ['Не поеду', { g: -1, l: 1 }], ['Поеду', { g: 2, l: -1 }]);
    card('kupec_spice', 'kupec', 'Пряности из-за моря! Сыр с ними — как у князей. Меняю на сыр.', ['Свой сыр лучше', { s: 1, g: -1 }], ['Меняем', { s: -1, g: 2 }]);
    card('past_cheese', 'pastukh', 'Сыра наварили — горы! Раздать всем или продать купцам?', ['Раздать', { l: 2, s: -1 }], ['Продать', { u: 2, l: -1 }]);
    card('okh_boar', 'okhotnik', 'Добыл кабана! Устроим пир для всего аула?', ['Засолим впрок', { u: 1, l: -1 }], ['Пир!', { l: 1, g: 1, u: -1 }]);
    card('znakh_rain', 'znakharka', 'Чую ливень на три недели. Убирай пшеницу сейчас, хоть она и зелёная.', ['Подождём', { l: 1 }], ['Убираем', { u: 1, l: -1 }], ['left', 3, 5, 'znakh_flood']);
    card('dzhig_tower', 'dzhigit', 'Построим сторожевую башню у перевала! Я сам буду дежурить.', ['Камня жалко', { l: -1, u: 1 }], ['Строим', { s: 1, u: -1 }]);
    card('tkach_dress', 'tkachikha', 'Невеста из соседнего аула заказала платье. Работы — на всю зиму.', ['Все — в поле', { u: 1, g: -1 }], ['Шей платье', { g: 1, u: -1 }]);
    card('deti_fort', 'deti', 'Можно мы не пойдём пасти коз? Хотим строить крепость!', ['Пасти!', { s: 1, l: -1 }], ['Стройте', { l: 1, s: -1 }]);
    card('drug_bees', 'drug', 'Я завёл пчёл! Дай место у реки для ульев.', ['Река — для отары', { s: 1, u: -1 }], ['Ставь ульи', { u: 1, s: -1 }], ['right', 3, 6, 'drug_honey']);
    card('putnik_map', 'putnik', 'Продам карту тайной тропы через перевал. Короче на два дня!', ['Обманщик', { g: -1 }], ['Покупаю', { u: -1, g: 2 }], ['right', 3, 5, 'putnik_path']);
    card('uchitel_mill', 'uchitel', 'Ученики придумали мельницу на ручье. Строим? Луг у ручья придётся отдать.', ['Мелем руками', { l: -1, s: 1 }], ['Строим', { u: 2, s: -1 }]);
    card('kuz_dagger', 'kuznec', 'Выковал кинжал для князя. Подарить — дружба, оставить — гордость аула.', ['Оставим', { l: 1, g: -1 }], ['Подарим', { g: 2, l: -1 }]);
    card('knyaz_rams', 'knyaz', 'Продаю породистых баранов. Дорого, но шерсть — как облако!', ['Не надо', { u: 1, s: -1 }], ['Купим', { s: 2, u: -2 }]);
    card('past_drought', 'pastukh', 'Ручей пересох. Гнать стадо к реке через поле соседа?', ['В обход', { s: -1, g: 1 }], ['Через поле', { s: 1, g: -2 }]);
    card('dzhig_zafak', 'dzhigit', 'Устроим танцы — зафак! Весь аул выйдет в круг.', ['Работать надо', { u: 1, l: -1 }], ['Зафак!', { l: 2, u: -1 }]);
    card('drug_tale', 'drug', 'Помнишь, как мы в юности заблудились в горах? Расскажем молодым у очага?', ['Не до сказок', { u: 1, l: -1 }], ['Расскажем', { l: 1, g: 1, u: -1 }]);
    // последствия: тот же человек приходит снова; arrive — отложенный удар по шкалам при появлении
    back('kuz_gone', 'kuznec', 'Помнишь, ты отказал мне в угле? Я ушёл в соседний аул — косы точить некому.', { u: -1 }, ['Вернись, Хамид', { g: -1, u: 1 }], ['Сами наточим', { l: -1 }]);
    back('past_gift', 'pastukh', 'Дозор отогнал волков! Принёс тебе первый сыр и ягнёнка в подарок.', { s: 1 }, ['Ягнёнка — детям', { l: 1 }], ['Сыр — гостям', { g: 1 }]);
    back('kupec_back', 'kupec', 'Твоя соль всем понравилась! Я вернулся с шёлком. Ещё поторгуем?', { g: 1 }, ['Хватит торговли', { g: -1, l: 1 }], ['Торгуем!', { s: -1, g: 2 }]);
    back('okh_bear', 'okhotnik', 'Я вернулся! Оленей не нашёл, зато привёл медвежонка. Он ест мёд. Весь мёд.', { u: -1 }, ['В лес его', { l: -1 }], ['Пусть живёт', { g: 2, u: -1 }]);
    back('znakh_cough', 'znakharka', 'Помнишь, ты пожалел мёда? Кашель пошёл по всему аулу. Теперь мёда нужно втрое.', { l: -1 }, ['Берите всё', { g: -2, l: 2 }], ['Перетерпим', { l: -1, g: 1 }]);
    back('dzhig_win', 'dzhigit', 'Я победил на скачках! Соседи хотят праздновать — у нас.', { g: 1 }, ['Праздник у них', { l: 1 }], ['Праздник у нас', { g: 2, u: -2 }]);
    back('knyaz_spor', 'knyaz', 'Помнишь, ты не заплатил? Я прислал сорок спорщиков. Спорят у ворот третью неделю — и едят.', { u: -1 }, ['Гоните их', { g: -2, l: 1 }], ['Угостим', { u: -1, g: 2 }]);
    back('deti_friends', 'deti', 'С качелей видно соседний аул! Мы нашли там друзей и привели в гости.', { g: 1 }, ['Ведите домой', { g: -1 }], ['Всех накормить', { u: -1, g: 1, l: 1 }]);
    back('putnik_news', 'putnik', 'Помнишь меня? В долине неурожай, к вам идут переселенцы. Примешь их?', {}, ['Не примем', { l: -1, g: -1 }], ['Примем', { l: 2, u: -2 }]);
    back('uchitel_letter', 'uchitel', 'Мои ученики написали письмо купцам — теперь соль везут прямо к воротам!', { u: 1 }, ['Хвалю', { l: 1 }], ['Учите и счёту', { g: 1, s: 1 }]);
    back('kuz_zigzag', 'kuznec', 'Помнишь котёл? Без новых плугов поле вспахали криво. Пшеница выросла зигзагом.', { u: -1 }, ['Перепашем', { l: -1, u: 1 }], ['Зигзаг — красиво', { g: 1 }]);
    back('svakha_kalym', 'svakha', 'Князь согласен! Но просит калым: сто овец и твою папаху.', {}, ['Слишком дорого', { g: -1, l: -1 }], ['Отдадим', { s: -2, g: 1 }], ['right', 2, 4, 'svakha_feast']);
    back('svakha_feast', 'svakha', 'Свадьба! Князь зовёт всю долину. Накроем столы у нас?', { g: 1 }, ['Скромно, по-семейному', { l: 1 }], ['Гуляем сорок дней!', {}, 'svadba']);
    back('sosruko_feast', 'sosruko', 'Великан побеждён! Нарты зовут тебя на пир в горах. Это большая честь.', { g: 1 }, ['Аул не брошу', { l: 2 }], ['Иду на пир', { g: 2, l: -1 }], ['right', 2, 4, 'sosruko_call']);
    back('sosruko_call', 'sosruko', 'Нарты просят тебя остаться у их вечного огня. Навсегда.', {}, ['Домой, к своим', { l: 1, g: 1 }], ['Остаюсь с нартами', {}, 'sosruko']);
    back('deti_dog', 'deti', 'Помнишь щенка? Он вырос в волкодава! Волки обходят аул за версту.', { s: 1 }, ['Хорошая собака', { l: 1 }], ['Дать косточку', { u: -1, s: 1 }]);
    back('drug_return', 'drug', 'Возвращаю долг — два мешка вместо одного. И пирог в придачу!', { u: 2 }, ['Пирог детям', { l: 1 }], ['Пирог гостям', { g: 1 }]);
    back('znakh_flood', 'znakharka', 'Помнишь, ты не поверил мне про ливень? Поле залило. Теперь веришь?', { u: -2 }, ['Верю', { l: 1 }], ['Совпадение', { l: -1, g: 1 }]);
    back('drug_honey', 'drug', 'Мёда столько, что его едят даже медведи. Медведи довольны. Пастухи — нет.', { u: 1, s: -1 }, ['Делись с пастухами', { s: 1, u: -1 }], ['Медведям по ложке', { g: 1 }]);
    back('putnik_path', 'putnik', 'По моей тропе пришли купцы — и козы соседей. Козы остались.', { s: 1, g: 1 }, ['Вернуть коз', { g: 1, s: -1 }], ['Козы наши', { s: 1, g: -2 }]);
    return out;
  })(),

  // раскладка сцены: камера стоит, всё остальное — вокруг неё
  CAM: [0, 2.05, 9.2], LOOK: [0, 1.72, 0],
  CARD: [-0.35, 2.45, 3.9], CW: 2.6, CH: 1.74,
  VISITOR: [2.35, 0, -0.3],
  ELDER: [-2.6, 0, 4.7],
  HEARTH: [-0.95, 0, 2.6],
  TREE: [-4.7, 0, -2.6],
  PLAQ: { y: 3.15, z: 5.3, gap: 0.9, s: 0.72 },

  /* ================= новая партия ================= */
  start(lab, scene) {
    const st = lab.state, c = lab.cfg, T3 = lab.THREE;
    const N = Math.round(lab.clamp(c.scales, 2, 4));
    Object.assign(st, {
      keys: this.KEYS.slice(0, N), scales: [], card: null, cardOrigin: null, years: 0, ended: false, ending: null,
      turn: 0, dealt: 0, decided: 0, backs: 0, pending: [], deck: [], lastMain: null, history: [], found: [], reign: 1,
      tilt: 0, drawnTilt: null, cardAge: 0, buffer: null, timeLeft: 0, season: -1, banner: false, goal: null, goalsDone: 0,
      silent: 0, causes: [], camK: 0, camTo: null, sparkT: 0, leafT: 0, nudge: 0,
    });
    this.byId = {}; for (const k of this.DECK) this.byId[k.id] = k;
    for (let i = 0; i < N; i++) st.scales.push(Math.round(c.startAt));
    // свет: низкое закатное солнце слева, тёплый очаг снизу, холодное небо
    lab.light.sun.userData.dir.set(-0.62, 0.42, 0.55).normalize();
    lab.light.sun.intensity = 1.55; lab.light.hemi.intensity = 0.75;
    lab.camera.position.set(...this.CAM); lab.camera.lookAt(...this.LOOK);
    this.world(lab, scene);
    this.porch(lab);
    this.elder(lab);
    st.cards = [this.makeCard(lab), this.makeCard(lab)]; st.cur = 0;
    st.figs = {};
    this.shuffle(lab);
    this.setSeason(lab, 0, true);
    this.deal(lab, !lab.playing);
    if (c.goals >= 1) this.newGoal(lab);
    lab.stat('годы', 0); lab.stat('последствия', 0);
    if (!lab.playing) this.poster(lab);
  },
  // афиша в меню: карта склонена вправо, на краю ответ, над шкалами горят огоньки, гость поклонился. Первый кадр партии всё возвращает
  poster(lab) {
    const st = lab.state;
    st.posterOn = true;
    st.tilt = 1;
    const C = st.cards[st.cur]; C.tiltS = 1;
    this.cardStep(lab, C, 0);
    this.drawCard(lab, C, st.card, 1);
    this.drawHints(lab, 1, true);
    const F = st.visitor; if (F) { F.upper.rotation.x = 0.28; }
  },
  unposter(lab) {
    const st = lab.state;
    st.posterOn = false; st.tilt = 0;
    const F = st.visitor; if (F) F.upper.rotation.x = 0;
    this.drawCard(lab, st.cards[st.cur], st.card, 0);
    this.drawHints(lab, 0);
  },
  // имя вариации: все включённые ручки вариаций
  variant(lab) {
    const c = lab.cfg, on = this.VARIANTS.filter(v => (v.on ? v.on(c) : c[v.key] > 0));
    if (!on.length) return { name: 'Классика', how: 'склони карту — и помни: решения возвращаются' };
    return { name: on.map(v => v.name(c)).join(' + '), how: on.map(v => v.how(c)).join('; ') };
  },

  update(lab, dt) {
    const st = lab.state, c = lab.cfg;
    if (st.posterOn) this.unposter(lab);
    if (!st.banner) { // имя вариации и её правило крупно в начале партии
      st.banner = true;
      const v = this.variant(lab);
      lab.popup([this.CARD[0], this.CARD[1] + 1.1, this.CARD[2]], v.name, '#ffe680', 32);
      lab.after(0.35, () => lab.popup([this.CARD[0], this.CARD[1] - 0.2, this.CARD[2]], v.how, '#ffffff', 17));
    }
    const v = this.variant(lab);
    lab.hud('rule', `${v.name}: ${v.how}`, { color: '#ffe680', size: 14 });
    this.ambient(lab, dt);
    this.figsStep(lab, dt);
    st.cards.forEach(C => this.cardStep(lab, C, dt));
    this.scalesStep(lab, dt);
    this.cameraStep(lab, dt);
    this.hudStep(lab);
    if (st.ending) { this.endingStep(lab, dt); return; }
    if (st.ended || !st.card) return;
    if (c.limit > 0 && lab.t >= c.limit) { // время на партию вышло: правление засчитано
      st.ended = true;
      lab.sfx.win(); lab.burst([0, 3.4, 4], { count: 30, colors: ['#ffd23f', '#ffffff', '#ff8fb1'], speed: 5, up: 2 });
      lab.win(`Ты правил ${this.plural(st.years, 'год', 'года', 'лет')}`);
      return;
    }
    st.cardAge += dt;
    st.nudge = Math.max(0, st.nudge - dt);
    this.input(lab, dt);
    if (!st.card) return;
    // таймер: время на ответ идёт, когда карта готова принять ответ
    if (c.timer > 0 && st.cardAge >= c.lock) {
      st.timeLeft -= dt;
      if (st.timeLeft <= 0) {
        st.silent++; lab.count('промолчал');
        lab.popup([this.CARD[0], this.CARD[1] + 0.95, this.CARD[2]], 'Ты промолчал…', '#ff9a7a', 24);
        lab.tone(180, 0.35, 'triangle', 0.08, 120);
        this.decide(lab, lab.pick(['left', 'right']));
      }
    }
  },

  // ввод: стрелка склоняет карту, та же стрелка ещё раз или A — решение; вниз — вернуть карту
  input(lab, dt) {
    const st = lab.state, c = lab.cfg, p = lab.p1, ready = st.cardAge >= c.lock;
    let want = null; // решение в этом кадре
    if (p.pressed.left) { if (st.tilt === -1) want = 'left'; else this.setTilt(lab, -1); }
    if (p.pressed.right) { if (st.tilt === 1) want = 'right'; else this.setTilt(lab, 1); }
    if (!p.pressed.left && !p.pressed.right) { // стрелку держат с прошлой карты — карта склоняется сразу
      if (st.tilt === 0 && p.left && !p.right) this.setTilt(lab, -1);
      else if (st.tilt === 0 && p.right && !p.left) this.setTilt(lab, 1);
    }
    if (p.pressed.down) this.setTilt(lab, 0);
    if (p.pressed.a) {
      if (st.tilt) want = st.tilt < 0 ? 'left' : 'right';
      else { // без наклона A только подсказывает
        if (st.nudge <= 0) lab.popup([this.CARD[0], this.CARD[1] + 0.95, this.CARD[2]], 'Склони карту: ← или →', '#ffffff', 18);
        if (st.nudge <= 0) lab.tone(330, 0.06, 'triangle', 0.04);
        st.nudge = 0.35;
      }
    }
    if (want && !ready) { st.buffer = { side: want, t: 0.2 }; want = null; } // нажатие до готовности карты запоминается
    if (!want && st.buffer) { st.buffer.t -= dt; if (ready && st.buffer.t > 0) want = st.buffer.side; if (ready || st.buffer.t <= 0) st.buffer = null; }
    if (want) this.decide(lab, want);
  },
  setTilt(lab, t) {
    const st = lab.state;
    if (st.tilt === t || !st.card) return;
    st.tilt = t;
    if (t) { lab.tone(t < 0 ? 520 : 620, 0.05, 'triangle', 0.045); lab.noise(0.05, 0.03, 3000); }
    this.drawCard(lab, st.cards[st.cur], st.card, t);
    this.drawHints(lab, t);
  },

  /* ================= логика: решение, колода, последствия ================= */
  // GAME.decide(lab, 'left' | 'right') — принять решение по текущей карте (то же, что игрок). Для автотеста
  decide(lab, side) {
    const st = lab.state, c = lab.cfg;
    if (!st.card || st.ending || st.ended || (side !== 'left' && side !== 'right')) return false;
    const card = st.card, ans = card[side], dir = side === 'left' ? -1 : 1;
    lab.count('решения'); lab.count(side === 'left' ? 'влево' : 'вправо');
    st.decided++;
    st.history.push({ id: card.id, who: card.who, say: ans.say, side, turn: st.turn, year: st.years + 1 });
    st.tilt = 0; st.buffer = null;
    this.sendAway(lab, dir, card, ans);
    this.applyEff(lab, ans.eff, Math.round(c.stakes), 0.12);
    if (c.secret >= 1 && card.then && card.then.side === side && !st.pending.some(q => q.card === card.then.card)) {
      const [a, b] = card.then.after, due = st.dealt + lab.randInt(a, b) + Math.round(c.echoMin);
      st.pending.push({ card: card.then.card, due: Math.max(st.dealt + 2, due), origin: { who: card.who, say: ans.say, year: st.years + 1, season: st.turn % 4 } });
    }
    st.card = null;
    if (ans.end) { this.startEnding(lab, ans.end, -1, card); return true; }
    st.turn++;
    if (st.turn % 4 === 0) this.newYear(lab);
    if (this.checkEnd(lab, card)) return true;
    this.goalTick(lab);
    this.deal(lab);
    return true;
  },
  // следующая карта: сначала последствие, срок которого пришёл, иначе основная колода
  deal(lab, still) {
    const st = lab.state, c = lab.cfg;
    st.dealt++;
    let card = null, origin = null;
    if (c.secret >= 1) {
      const due = st.pending.filter(q => q.due <= st.dealt).sort((a, b) => a.due - b.due)[0];
      if (due) { st.pending.splice(st.pending.indexOf(due), 1); card = this.byId[due.card]; origin = due.origin; }
    }
    if (!card) card = this.nextMain(lab);
    st.card = card; st.cardOrigin = origin; st.cardAge = 0; st.tilt = 0; st.timeLeft = c.timer; st.buffer = null;
    const season = st.turn % 4;
    if (season !== st.season) this.setSeason(lab, season, false);
    this.showCard(lab, card, still);
    if (c.winter >= 1 && season === 3) { // зима: Урожай −1 и Стада −1
      lab.after(0.5, () => lab.popup([0, 3.0, 4.5], 'Зима: Урожай −1, Стада −1', '#cfe3ff', 20));
      this.applyEff(lab, { u: -1, s: -1 }, 1, 0.55);
      lab.count('зимы');
    }
    if (card.back) { // последствие: тот же человек пришёл снова
      st.backs++;
      lab.count('_secret'); lab.count('последствия'); lab.stat('последствия', st.backs);
      if (!still) {
        lab.after(0.35, () => {
          lab.popup([this.CARD[0], this.CARD[1] + 1.05, this.CARD[2]], 'Помнишь?', '#ff9a7a', 26);
          lab.tone(196, 0.9, 'sine', 0.13); lab.tone(294, 0.8, 'sine', 0.07, 0, 0.12); lab.tone(1175, 0.4, 'triangle', 0.03, 0, 0.2);
          lab.ring([this.VISITOR[0], 0.05, this.VISITOR[2]], { color: '#ff6a5a', radius: 1.6, life: 0.6 });
          const C = st.cards[st.cur]; lab.whiten(C.frame, 0.25, '#ff6a5a');
        });
      }
      this.applyEff(lab, card.arrive, Math.round(c.stakes), 0.75);
    }
    this.checkEnd(lab, card);
  },
  shuffle(lab) {
    const st = lab.state;
    const live = k => st.keys.includes(k);
    const ok = cd => !cd.back && ['left', 'right'].some(s => Object.keys(cd[s].eff).some(live));
    const pool = this.DECK.filter(ok);
    for (let i = pool.length - 1; i > 0; i--) { const j = lab.randInt(0, i); [pool[i], pool[j]] = [pool[j], pool[i]]; }
    if (!st.shuffled) { // первая колода партии: сверху по карте с последствием на «вправо» и на «влево»
      st.shuffled = true;
      for (const [pos, side] of [[0, 'right'], [1, 'left']]) {
        const j = pool.findIndex((cd, i) => i >= pos && cd.then && cd.then.side === side && !['sosruko_horse', 'svakha_match'].includes(cd.id));
        if (j > pos) [pool[pos], pool[j]] = [pool[j], pool[pos]];
      }
    }
    st.deck = pool;
  },
  nextMain(lab) {
    const st = lab.state, prevWho = st.visitor ? st.visitor.who : null;
    if (!st.deck.length) this.shuffle(lab);
    let i = st.deck.findIndex(cd => cd.id !== st.lastMain && cd.who !== prevWho);
    if (i < 0) i = 0;
    const card = st.deck.splice(i, 1)[0];
    st.lastMain = card.id;
    return card;
  },
  // мягкое начало: первые карты правления бьют не сильнее ±1 (× ставки), и шкала не доходит до края — проиграть сразу нельзя
  calm(lab) { const st = lab.state; return st.turn - (st.reignTurn || 0) < Math.round(lab.cfg.calm); },
  effOf(lab, d0, mult) { return this.calm(lab) ? Math.sign(d0) * mult : d0 * mult; },
  // эффекты на шкалы: логика сразу, картинка — через delay
  applyEff(lab, eff, mult, delay) {
    const st = lab.state, out = [], calm = this.calm(lab);
    st.keys.forEach((k, i) => {
      const d0 = (eff && eff[k]) || 0;
      if (!d0) return;
      const was = st.scales[i], now = calm ? lab.clamp(was + this.effOf(lab, d0, mult), 1, 9) : lab.clamp(was + d0 * mult, 0, 10);
      st.scales[i] = now;
      out.push([i, now - was, now]);
    });
    if (out.length) lab.after(delay || 0, () => this.showChanges(lab, out));
    return out;
  },
  showChanges(lab, list) {
    const st = lab.state;
    list.forEach(([i, d, now], n) => {
      const P = st.plaques[i];
      if (!P) return;
      P.target = now;
      this.drawLabel(lab, P, now);
      if (!d) return;
      const up = d > 0, col = up ? '#7cff8a' : '#ff5a4d', at = P.g.localToWorld(new lab.THREE.Vector3(0.18, 0.25, 0.1));
      lab.popup(at, (up ? '+' : '−') + Math.abs(d), col, 20 + Math.min(3, Math.abs(d)) * 3);
      lab.whiten(P.fill, 0.16, col);
      lab.pulse(P.g, 1 + 0.05 * Math.min(3, Math.abs(d)), 0.2);
      lab.burst(at, { count: 6 + 3 * Math.abs(d), colors: [col, this.SCALES[P.key].color, '#ffffff'], speed: 2.2, up: up ? 1.5 : -0.5, size: 0.06, gravity: up ? 2 : 6, life: 0.5 });
      lab.tone((up ? 520 : 330) * (1 + n * 0.12), 0.12, 'triangle', 0.06, up ? 780 : 220, n * 0.05);
      if (Math.abs(d) >= 2) lab.shake(0.14); // без стоп-кадра: пошаговая игра не должна терять быстрые нажатия
    });
  },
  checkEnd(lab, card) {
    const st = lab.state;
    if (st.ending || st.ended) return true;
    for (let i = 0; i < st.keys.length; i++) {
      const v = st.scales[i];
      if (v <= 0 || v >= 10) { this.startEnding(lab, st.keys[i] + (v <= 0 ? '0' : '10'), i, card); return true; }
    }
    return false;
  },
  newYear(lab) {
    const st = lab.state;
    st.years++;
    lab.addScore(1, [0, 3.95, 3.3], '#ffc93c');
    lab.stat('годы', st.years);
    lab.after(0.45, () => {
      lab.popup([this.CARD[0], this.CARD[1] + 1.25, this.CARD[2]], `Год ${st.years + 1}`, '#ffe08a', 26);
      [392, 440, 523, 587].forEach((f, k) => lab.tone(f, 0.18, 'triangle', 0.06, 0, k * 0.09));
    });
  },

  /* ================= финалы, наследник ================= */
  startEnding(lab, id, i, card) {
    const st = lab.state, E = this.ENDINGS.find(e => e.id === id);
    const fresh = !this.FOUND.has(id);
    this.FOUND.add(id); st.found.push(id);
    // корень беды: финал пришёл с последствием — вспоминаем, с какого ответа всё началось
    const cause = card && card.back && st.cardOrigin ? st.cardOrigin : null;
    if (cause) st.causes.push(`Корень беды: в ${cause.year}-й год ты ответил ${this.WHO[cause.who].dat} «${cause.say}»`);
    st.ending = { id, E, i, t: 0, dur: 2.6, fresh, card };
    lab.count('финалы');
    lab.slowmo(1.4, 0.35); lab.shake(0.5); lab.hitstop(0.1); lab.vibrate(300, 0.8);
    const col = i >= 0 ? this.SCALES[st.keys[i]].color : '#ffd23f';
    lab.flash(i >= 0 ? '#ff4d5e' : '#ffd23f', 0.22);
    if (i >= 0) {
      const P = st.plaques[i];
      P.target = st.scales[i];
      lab.whiten(P.fill, 0.7, '#ff4d5e'); lab.pulse(P.g, 1.3, 0.45);
      lab.burst(P.g, { count: 26, colors: [col, '#ff4d5e', '#ffffff'], speed: 4, up: 1 });
      const pw = P.g.getWorldPosition(new lab.THREE.Vector3());
      const C = this.CAM, L = this.LOOK, to = (a, b, k) => a.map((v, j) => v + (b[j] - v) * k), w = [pw.x, pw.y, pw.z];
      st.camTo = { pos: to(C, w, 0.32), look: to(L, w, 0.65) }; // наезд на треть пути: шкала крупно, двор ещё виден
      lab.hero(P.g); // в финале главный — вспыхнувшая шкала: камера наезжает на неё
    } else {
      lab.burst([this.VISITOR[0], 1.6, this.VISITOR[2]], { count: 40, colors: ['#ffd23f', '#ffffff', '#ff8fb1'], speed: 6, up: 3 });
      st.camTo = { pos: [0.1, 1.7, 5.4], look: [this.VISITOR[0], 1.3, this.VISITOR[2]] };
      if (st.visitor) lab.hero(st.visitor.upper);
    }
    lab.tone(110, 1.4, 'sawtooth', 0.08, 70); lab.tone(165, 1.2, 'triangle', 0.08, 110, 0.1); lab.noise(0.6, 0.08, 400);
    lab.hud('final', E.name, { color: '#ffd23f', size: 30 });
    lab.hud('finalText', E.text, { color: '#ffffff', size: 15 });
    if (fresh) lab.after(0.7, () => { lab.popup([this.CARD[0], this.CARD[1] + 0.5, this.CARD[2]], 'Новый финал!', '#7cf5a8', 30); lab.sfx.power(); });
  },
  endingStep(lab, dt) {
    const st = lab.state, e = st.ending;
    e.t += dt;
    if (e.t < e.dur) return;
    if (lab.lives > 1) return this.heir(lab);
    st.ending = null; st.ended = true;
    lab.gameOver(e.E.text);
  },
  // династия: после финала правит наследник — шкалы снова по startAt, годы идут дальше
  heir(lab) {
    const st = lab.state, c = lab.cfg;
    lab.lives--; st.reign++; st.reignTurn = st.turn; lab.hero(st.elderHead);
    st.ending = null; st.camTo = null;
    lab.hud('final', null); lab.hud('finalText', null);
    for (let i = 0; i < st.scales.length; i++) st.scales[i] = Math.round(c.startAt);
    this.showChanges(lab, st.scales.map((v, i) => [i, 0, v]));
    lab.popup([this.CARD[0], this.CARD[1] + 0.8, this.CARD[2]], 'Правит наследник', '#ffe08a', 30);
    [262, 330, 392, 523].forEach((f, k) => lab.tone(f, 0.3, 'triangle', 0.07, 0, k * 0.12));
    lab.count('наследники');
    const beard = ['#e8e4dc', '#1c1612', '#7a4a2a', '#3a2a20', '#b0a090'][(st.reign - 1) % 5];
    st.elderBeard.color.set(beard);
    lab.whiten(st.elder, 0.2, '#ffe08a'); lab.pulse(st.elder, 1.08, 0.3);
    lab.burst([this.ELDER[0], 1.4, this.ELDER[2]], { count: 18, colors: ['#ffd23f', '#ffffff'], speed: 3, up: 2 });
    if (!st.card) this.deal(lab);
    else { st.cardAge = 0; st.timeLeft = c.timer; }
  },

  /* ================= поручения ================= */
  newGoal(lab) {
    const st = lab.state, s = st.turn % 4;
    if (lab.chance(0.35)) { // пережить зиму: Урожай не ниже 3 до конца ближайшей зимы
      const w = s === 3 ? st.turn + 4 : st.turn + (3 - s);
      st.goal = { kind: 'winter', min: 3, until: w + 1, text: 'Переживи зиму без голода: Урожай не ниже 3' };
    } else {
      const cand = st.scales.map((v, i) => [v, i]).filter(([v]) => v >= 2 && v <= 8);
      const [v, i] = cand.length ? lab.pick(cand) : [st.scales[0], 0];
      const up = v <= 5 || lab.chance(0.3) && v < 7, t = up ? Math.min(8, v + lab.randInt(2, 3)) : Math.max(2, v - lab.randInt(2, 3));
      const S = this.SCALES[st.keys[i]];
      st.goal = { kind: 'reach', i, up, target: t, until: st.turn + 8, text: up ? `Доведи ${S.acc} до ${t}` : `Опусти ${S.acc} до ${t}` };
    }
    lab.after(0.6, () => lab.popup([0, 3.0, 4.5], 'Поручение: ' + st.goal.text, '#7cf5a8', 17));
  },
  goalTick(lab) {
    const st = lab.state, G = st.goal;
    if (!(lab.cfg.goals >= 1) || !G) return;
    let ok = false, fail = false;
    if (G.kind === 'reach') { const v = st.scales[G.i]; ok = G.up ? v >= G.target : v <= G.target; fail = !ok && st.turn >= G.until; }
    else { fail = st.scales[0] < G.min; ok = !fail && st.turn >= G.until; }
    if (ok) {
      st.goalsDone++; st.years += 2; lab.stat('годы', st.years);
      lab.addScore(2, [0, 3.95, 3.3], '#7cf5a8');
      lab.count('поручения');
      lab.popup([this.CARD[0], this.CARD[1] + 1.1, this.CARD[2]], 'Праздник! +2 года', '#7cf5a8', 28);
      lab.sfx.win(); lab.flash('#ffd23f', 0.15);
      for (let k = 0; k < 3; k++) lab.after(k * 0.2, () => lab.burst([lab.rand(-2, 2), 2.6, 2.5], { count: 22, colors: ['#ffd23f', '#ff8fb1', '#5fd4ff', '#9be36a', '#ffffff'], speed: 5, up: 3, gravity: 5 }));
      this.newGoal(lab);
    } else if (fail) {
      lab.popup([0, 3.0, 4.5], 'Поручение не вышло', '#ff9a7a', 18);
      lab.tone(220, 0.25, 'triangle', 0.05, 160);
      this.newGoal(lab);
    }
  },

  hudStep(lab) {
    const st = lab.state, c = lab.cfg, S = this.SEASONS[st.turn % 4];
    lab.hud('season', `${S.name} · год ${st.years + 1}` + (st.reign > 1 ? ` · правит наследник ${st.reign}` : '') + (c.secret >= 1 && st.backs ? ` · последствий: ${st.backs}` : ''), { color: '#ffffff', size: 15 });
    lab.hud('goal', c.goals >= 1 && st.goal ? `Поручение: ${st.goal.text}` + (st.goal.kind === 'reach' ? ` (сейчас ${st.scales[st.goal.i]})` : ` (сейчас ${st.scales[0]})`) : null, { color: '#7cf5a8', size: 15 });
    lab.hud('time', c.limit > 0 ? `Время: ${Math.max(0, Math.ceil(c.limit - lab.t))} с` : null, { color: '#ffffff', size: 15 });
    lab.hud('tip', st.decided === 0 && !st.ending ? '← → склони карту, ещё раз ← → или A — решить' : null, { color: '#ffe8c0', size: 15 });
  },

  overNote(lab) {
    const st = lab.state, c = lab.cfg, v = this.variant(lab);
    const E = st.found.length ? this.ENDINGS.find(e => e.id === st.found[st.found.length - 1]) : null;
    return [v.name !== 'Классика' ? `Вариация: ${v.name} — ${v.how}` : '',
      E ? `Финал «${E.name}»` : '',
      `Финалов открыто: ${this.FOUND.size} из ${this.ENDINGS.length}`,
      `Решений: ${st.decided} (влево ${st.history.filter(h => h.side === 'left').length}, вправо ${st.history.filter(h => h.side === 'right').length}), лет правления: ${st.years}`,
      c.secret >= 1 ? `Решения вернулись последствиями ${this.plural(st.backs, "раз", "раза", "раз")}` : 'Спрятанная механика выключена: карты не помнят решений',
      st.causes.length ? st.causes[st.causes.length - 1] : '',
      st.reign > 1 ? `Правителей в династии: ${st.reign}` : '',
      c.goals >= 1 ? `Поручений выполнено: ${st.goalsDone}` : '',
      st.silent ? `Ты промолчал ${this.plural(st.silent, "раз", "раза", "раз")}` : ''].filter(Boolean);
  },
  plural(n, one, few, many) {
    const a = Math.abs(n) % 100, b = a % 10;
    return `${n} ${a > 10 && a < 20 ? many : b === 1 ? one : b >= 2 && b <= 4 ? few : many}`;
  },

  /* ================= карта: пергамент с орнаментом ================= */
  makeCard(lab) {
    const T3 = lab.THREE, W = 1024, H = 704;
    const cv = document.createElement('canvas'); cv.width = W; cv.height = H;
    const tex = new T3.CanvasTexture(cv); tex.colorSpace = T3.SRGBColorSpace; tex.anisotropy = 4;
    const g = lab.group({ at: this.CARD });
    const frame = lab.box(this.CW + 0.12, this.CH + 0.12, 0.05, '#4a2a18', { parent: g, at: [0, 0, -0.03], round: 0.03, shadow: false });
    const face = lab.mesh(new T3.PlaneGeometry(this.CW, this.CH), new T3.MeshBasicMaterial({ map: tex, toneMapped: false }), { parent: g, shadow: false });
    const barMat = new T3.MeshBasicMaterial({ color: '#7cf5a8', toneMapped: false });
    const bar = lab.mesh(new T3.BoxGeometry(1, 0.045, 0.01).translate(0.5, 0, 0), barMat, { parent: g, at: [-this.CW / 2 + 0.12, -this.CH / 2 + 0.07, 0.012], shadow: false });
    bar.visible = false;
    g.visible = false;
    return { g, frame, face, ctx: cv.getContext('2d'), tex, bar, barMat, mode: 'off', t: 0, tiltS: 0, dir: 0, card: null, trail: null };
  },
  wrap(g, text, maxW) {
    const words = text.split(' '), lines = [];
    let cur = '';
    for (const w of words) { const t = cur ? cur + ' ' + w : w; if (g.measureText(t).width > maxW && cur) { lines.push(cur); cur = w; } else cur = t; }
    if (cur) lines.push(cur);
    return lines;
  },
  drawCard(lab, C, card, tilt) {
    if (!card) return;
    const g = C.ctx, W = 1024, H = 704, who = this.WHO[card.who];
    // пергамент
    g.fillStyle = '#f4e4c1'; g.fillRect(0, 0, W, H);
    const vg = g.createRadialGradient(W / 2, H / 2, 120, W / 2, H / 2, 680);
    vg.addColorStop(0, 'rgba(255,250,235,0)'); vg.addColorStop(1, 'rgba(160,105,50,0.38)');
    g.fillStyle = vg; g.fillRect(0, 0, W, H);
    // адыгский орнамент: красная рамка и золотые зубцы
    g.strokeStyle = '#b8322a'; g.lineWidth = 12; g.strokeRect(24, 24, W - 48, H - 48);
    g.strokeStyle = '#e8b23a'; g.lineWidth = 4; g.strokeRect(44, 44, W - 88, H - 88);
    g.fillStyle = '#b8322a';
    for (let x = 60; x <= W - 60; x += 34) {
      g.beginPath(); g.moveTo(x - 11, 50); g.lineTo(x, 66); g.lineTo(x + 11, 50); g.fill();
      g.beginPath(); g.moveTo(x - 11, H - 50); g.lineTo(x, H - 66); g.lineTo(x + 11, H - 50); g.fill();
    }
    // уголки-ромбы
    g.fillStyle = '#e8b23a';
    for (const [x, y] of [[34, 34], [W - 34, 34], [34, H - 34], [W - 34, H - 34]]) { g.beginPath(); g.moveTo(x, y - 18); g.lineTo(x + 18, y); g.lineTo(x, y + 18); g.lineTo(x - 18, y); g.fill(); }
    // имя
    g.textAlign = 'center'; g.textBaseline = 'middle';
    g.fillStyle = '#7a2416'; g.font = 'bold 66px Georgia, "DejaVu Serif", serif';
    g.fillText(who.name, W / 2, 168);
    g.strokeStyle = '#b8322a'; g.lineWidth = 3; g.beginPath(); g.moveTo(W / 2 - 230, 218); g.lineTo(W / 2 + 230, 218); g.stroke();
    g.fillStyle = '#b8322a'; g.beginPath(); g.moveTo(W / 2, 206); g.lineTo(W / 2 + 12, 218); g.lineTo(W / 2, 230); g.lineTo(W / 2 - 12, 218); g.fill();
    // просьба
    let fs = 56, lines;
    do { g.font = `${fs}px Georgia, "DejaVu Serif", serif`; lines = this.wrap(g, card.text, 900); fs -= 3; } while (lines.length > 3 && fs > 34);
    g.fillStyle = '#2e2116';
    const lh = fs * 1.32, y0 = 410 - (lines.length - 1) * lh / 2;
    lines.forEach((l, i) => g.fillText(l, W / 2, y0 + i * lh));
    // нить памяти: карта-последствие
    if (card.back) {
      g.strokeStyle = '#c0281e'; g.lineWidth = 7; g.lineCap = 'round';
      g.beginPath(); g.moveTo(W - 300, H - 92); g.bezierCurveTo(W - 250, H - 140, W - 210, H - 50, W - 160, H - 100); g.bezierCurveTo(W - 120, H - 140, W - 150, H - 170, W - 175, H - 130); g.bezierCurveTo(W - 195, H - 95, W - 120, H - 80, W - 90, H - 110); g.stroke();
      g.fillStyle = '#c0281e'; g.beginPath(); g.arc(W - 175, H - 128, 11, 0, Math.PI * 2); g.fill();
      g.font = 'italic 30px Georgia, "DejaVu Serif", serif'; g.fillStyle = '#8a1e16'; g.textAlign = 'right';
      g.fillText('помнит', W - 320, H - 100);
      g.textAlign = 'center';
    }
    // ответ на краю: склонил карту — проступает ответ этой стороны
    if (tilt) {
      const ans = card[tilt < 0 ? 'left' : 'right'];
      g.fillStyle = 'rgba(42,22,12,0.92)'; g.fillRect(0, 0, W, 118);
      g.fillStyle = '#e8b23a'; g.fillRect(0, 114, W, 6);
      g.font = 'bold 56px Georgia, "DejaVu Serif", serif'; g.fillStyle = '#ffe7a8';
      g.textAlign = tilt < 0 ? 'left' : 'right';
      const tx = tilt < 0 ? 112 : W - 112;
      g.fillText(ans.end ? ans.say + ' …' : ans.say, tx, 60);
      g.fillStyle = '#ffd23f'; g.beginPath();
      if (tilt < 0) { g.moveTo(40, 60); g.lineTo(84, 32); g.lineTo(84, 88); } else { g.moveTo(W - 40, 60); g.lineTo(W - 84, 32); g.lineTo(W - 84, 88); }
      g.fill();
      g.textAlign = 'center';
    }
    C.tex.needsUpdate = true;
    C.drawn = tilt;
  },
  // новая карта прилетает сверху, гость входит и кланяется
  showCard(lab, card, still) {
    const st = lab.state;
    const old = st.cards[st.cur], C = st.cards[st.cur = 1 - st.cur];
    C.card = card; C.tiltS = 0;
    this.drawCard(lab, C, card, 0);
    C.g.visible = true;
    C.mode = 'in'; C.t = still ? 1 : (old.mode === 'out' ? -0.18 : 0);
    if (still) this.cardStep(lab, C, 0);
    this.drawHints(lab, 0);
    // гость: свой человечек для каждого персонажа
    const F = this.fig(lab, card.who);
    st.visitor = F;
    F.mode = still ? 'idle' : 'in'; F.t = still ? 0 : (old.mode === 'out' ? -0.1 : 0);
    F.root.visible = true;
    if (still) { F.root.position.set(this.VISITOR[0], 0, this.VISITOR[2]); F.root.rotation.y = -0.55; }
    else { F.root.position.set(6.5, 0, this.VISITOR[2]); lab.noise(0.08, 0.03, 900, 0.3); }
  },
  // решение: карта улетает в сторону ответа со следом, гость уходит туда же
  sendAway(lab, dir, card, ans) {
    const st = lab.state, C = st.cards[st.cur], F = st.visitor;
    if (C.drawn !== dir) this.drawCard(lab, C, card, dir); // на улетающей карте — выбранный ответ
    C.mode = 'out'; C.t = 0; C.dir = dir; C.x0 = C.g.position.x; C.y0 = C.g.position.y; C.r0 = C.g.rotation.z;
    if (C.trail) C.trail.dispose();
    C.trail = lab.trail(C.g, { color: dir < 0 ? '#ffb46a' : '#ffe08a', width: 0.5, length: 14, glow: 1.4 });
    const tr = C.trail; lab.after(0.75, () => { tr.dispose(); if (C.trail === tr) C.trail = null; });
    lab.sfx.whoosh(); lab.noise(0.07, 0.06, 2600);
    lab.vibrate(40, 0.3);
    this.drawHints(lab, 0);
    if (F) {
      const sum = Object.values(ans.eff || {}).reduce((a, b) => a + b, 0);
      F.mode = 'out'; F.t = 0; F.dir = dir; F.x0 = F.root.position.x; F.happy = sum >= 0;
      if (F.happy) lab.pulse(F.root, 1.12, 0.22);
    }
  },
  cardStep(lab, C, dt) {
    if (C.mode === 'off') return;
    const st = lab.state, B = this.CARD, g = C.g;
    C.t += dt;
    if (C.mode === 'in') {
      const k = lab.clamp(C.t / 0.38, 0, 1), e = lab.ease.outBack(k);
      g.position.set(B[0], B[1] + (1 - e) * 1.6, B[2]);
      g.scale.setScalar(0.55 + 0.45 * Math.min(1.08, e));
      g.rotation.set(0, 0, (1 - k) * 0.25);
      if (k >= 1) { C.mode = 'idle'; g.scale.setScalar(1); }
    } else if (C.mode === 'idle') {
      const cur = C === st.cards[st.cur] && !st.ending;
      C.tiltS = lab.damp(C.tiltS, cur ? st.tilt : 0, 16, dt || 1);
      const wig = cur && st.nudge > 0 ? Math.sin(st.nudge * 40) * 0.05 * (st.nudge / 0.35) : 0;
      const bob = Math.sin(lab.t * 1.6) * 0.025;
      g.position.set(B[0] + C.tiltS * 0.34, B[1] + bob - Math.abs(C.tiltS) * 0.06, B[2]);
      g.rotation.set(0, C.tiltS * 0.16, -C.tiltS * 0.17 + wig);
      // таймер: полоска на карте
      const c = lab.cfg;
      C.bar.visible = cur && c.timer > 0 && !st.ending;
      if (C.bar.visible) {
        const f = lab.clamp(st.timeLeft / Math.max(0.1, c.timer), 0, 1);
        C.bar.scale.x = Math.max(0.001, f * (this.CW - 0.24));
        C.barMat.color.set(f > 0.5 ? '#7cf5a8' : f > 0.25 ? '#ffd23f' : (Math.floor(lab.t * 8) % 2 ? '#ff4d5e' : '#ff9a7a'));
      }
    } else if (C.mode === 'out') {
      const k = lab.clamp(C.t / 0.45, 0, 1), e = lab.ease.inQuad(k);
      g.position.set(C.x0 + C.dir * 6 * e, C.y0 - 1.3 * e + Math.sin(k * Math.PI) * 0.25, B[2] + 0.4 * e);
      g.rotation.set(0, C.dir * 0.4 * e, C.r0 - C.dir * 1.1 * e);
      C.bar.visible = false;
      if (k >= 1) { C.mode = 'off'; g.visible = false; }
    }
  },

  /* ================= шкалы под балкой навеса ================= */
  porch(lab) {
    const st = lab.state, T3 = lab.THREE, PQ = this.PLAQ, N = st.keys.length;
    // резная балка навеса кунацкой: рамка кадра сверху
    const beam = [];
    beam.push(lab.box(9.5, 0.34, 0.32, '#4a2c1a', { parent: null, at: [0, PQ.y + 0.44, PQ.z + 0.15] }));
    beam.push(lab.box(9.5, 0.06, 0.34, '#c9973a', { parent: null, at: [0, PQ.y + 0.27, PQ.z + 0.15] }));
    for (let x = -4.6; x <= 4.6; x += 0.24) beam.push(lab.cone(0.08, 0.14, '#c9973a', { parent: null, at: [x, PQ.y + 0.2, PQ.z + 0.2], rot: [Math.PI, 0, 0], sides: 3 }));
    beam.push(lab.box(9.5, 0.08, 3, '#3a2214', { parent: null, at: [0, PQ.y + 0.64, PQ.z + 1.5] }));
    lab.noShadow(lab.merge(beam));
    st.plaques = st.keys.map((key, i) => this.plaque(lab, key, (i - (N - 1) / 2) * PQ.gap));
  },
  plaque(lab, key, x) {
    const st = lab.state, T3 = lab.THREE, PQ = this.PLAQ, S = this.SCALES[key];
    const g = lab.group({ at: [x, PQ.y, PQ.z], scale: PQ.s });
    const parts = lab.group({ parent: null });
    lab.box(0.84, 0.76, 0.05, '#3b2416', { parent: parts, round: 0.03 });
    lab.box(0.88, 0.04, 0.06, '#c9973a', { parent: parts, at: [0, 0.38, 0] });
    lab.box(0.88, 0.04, 0.06, '#c9973a', { parent: parts, at: [0, -0.38, 0] });
    for (const s of [-1, 1]) lab.cyl(0.012, 0.012, 0.2, '#c9a36a', { parent: parts, at: [s * 0.3, 0.47, -0.01], sides: 4 });
    lab.box(0.18, 0.46, 0.03, '#140c08', { parent: parts, at: [0.2, 0.08, 0.035] }); // жёлоб шкалы
    for (const y of [-0.14 + 0.046, -0.14 + 0.414]) lab.box(0.2, 0.012, 0.02, '#ff4d5e', { parent: parts, at: [0.2, y, 0.055] }); // метки края: 1 и 9
    this.icon(lab, key, parts);
    lab.noShadow(lab.merge([parts], g));
    const fillMat = new T3.MeshStandardMaterial({ color: S.color, emissive: S.color, emissiveIntensity: 0.35, roughness: 0.5, flatShading: true });
    const fill = lab.mesh(new T3.BoxGeometry(0.13, 0.4, 0.03).translate(0, 0.2, 0), fillMat, { parent: g, at: [0.2, -0.14, 0.05], shadow: false });
    // подпись словами
    const cv = document.createElement('canvas'); cv.width = 256; cv.height = 64;
    const tex = new T3.CanvasTexture(cv); tex.colorSpace = T3.SRGBColorSpace;
    const label = lab.mesh(new T3.PlaneGeometry(0.8, 0.2), new T3.MeshBasicMaterial({ map: tex, transparent: true, toneMapped: false }), { parent: g, at: [0, -0.27, 0.035], shadow: false });
    // огоньки: маленький — чуть, большой — сильно
    const dotS = lab.ball(0.05, lab.mat('#fff4d0', { unlit: true, glow: 1.2 }), { parent: g, at: [0, -0.5, 0.06], shadow: false, detail: 1 });
    const dotB = lab.ball(0.095, lab.mat('#fff4d0', { unlit: true, glow: 1.2 }), { parent: g, at: [0, -0.52, 0.06], shadow: false, detail: 1 });
    dotS.visible = dotB.visible = false;
    // стрелка и число (подсказки «всё видно»)
    const hc = document.createElement('canvas'); hc.width = 128; hc.height = 64;
    const htex = new T3.CanvasTexture(hc); htex.colorSpace = T3.SRGBColorSpace;
    const hint = lab.mesh(new T3.PlaneGeometry(0.46, 0.23), new T3.MeshBasicMaterial({ map: htex, transparent: true, toneMapped: false }), { parent: g, at: [0, -0.54, 0.06], shadow: false });
    hint.visible = false;
    const P = { key, g, fill, fillMat, label, lctx: cv.getContext('2d'), ltex: tex, dotS, dotB, hint, hctx: hc.getContext('2d'), htex, shown: lab.cfg.startAt, target: lab.cfg.startAt, base: new T3.Color(S.color) };
    this.drawLabel(lab, P, P.target);
    return P;
  },
  // значок шкалы из примитивов
  icon(lab, key, parent) {
    const at = (x, y, z = 0.06) => [x - 0.17, y + 0.08, z];
    if (key === 'u') { // сноп пшеницы
      for (const [x, r] of [[-0.06, 0.25], [0, 0], [0.06, -0.25]]) lab.cone(0.035, 0.32, '#f2c230', { parent, at: at(x, 0.02), rot: [0, 0, r], sides: 4 });
      lab.box(0.16, 0.035, 0.05, '#b8322a', { parent, at: at(0, -0.04, 0.08) });
      for (const x of [-0.08, 0, 0.08]) lab.ball(0.04, '#ffd75a', { parent, at: at(x * 1.4, 0.17), detail: 0 });
    } else if (key === 'l') { // двое людей
      for (const [x, s] of [[-0.07, 1], [0.08, 0.82]]) {
        lab.cone(0.08 * s, 0.22 * s, '#ff8fb1', { parent, at: at(x, -0.06 + 0.11 * s - 0.11), sides: 6 });
        lab.ball(0.055 * s, '#f4c7a0', { parent, at: at(x, -0.06 + 0.26 * s - 0.11), detail: 1 });
      }
    } else if (key === 's') { // овечка
      lab.ball(0.12, '#f4f1ea', { parent, at: at(0, 0), detail: 0, scale: [1.2, 0.9, 1] });
      lab.ball(0.06, '#2a2420', { parent, at: at(0.14, 0.04, 0.09), detail: 0 });
      for (const x of [-0.07, 0.07]) lab.box(0.03, 0.09, 0.03, '#2a2420', { parent, at: at(x, -0.13) });
    } else { // кувшин гостеприимства
      lab.ball(0.11, '#d0703c', { parent, at: at(0, -0.04), detail: 1, scale: [1, 1.1, 1] });
      lab.cyl(0.045, 0.06, 0.12, '#d0703c', { parent, at: at(0, 0.11), sides: 8 });
      lab.cyl(0.07, 0.05, 0.03, '#e8b23a', { parent, at: at(0, 0.17), sides: 8 });
      lab.box(0.02, 0.12, 0.02, '#e8b23a', { parent, at: at(0.1, 0.06), rot: [0, 0, -0.5] });
    }
  },
  levelWord(v) { return v <= 1 ? 'на краю' : v <= 3 ? 'мало' : v <= 6 ? 'в меру' : v <= 8 ? 'много' : 'через край'; },
  drawLabel(lab, P, v) {
    const g = P.lctx, S = this.SCALES[P.key];
    g.clearRect(0, 0, 256, 64);
    g.textAlign = 'center'; g.textBaseline = 'middle';
    g.font = 'bold 30px Georgia, "DejaVu Serif", serif'; g.fillStyle = '#ffe9c2';
    g.fillText(S.name, 128, 20);
    g.font = '24px Georgia, "DejaVu Serif", serif';
    g.fillStyle = v <= 1 || v >= 9 ? '#ff7a6b' : v <= 3 || v >= 7 ? '#ffd23f' : '#bfe9a8';
    g.fillText(`${this.levelWord(v)} · ${v}`, 128, 48);
    P.ltex.needsUpdate = true;
  },
  // подсказки при наклоне: точки (hints 1) или стрелки и числа (hints 2)
  drawHints(lab, tilt, force) {
    const st = lab.state, c = lab.cfg, h = Math.round(c.hints);
    const card = st.card, side = tilt < 0 ? 'left' : 'right', m = Math.round(c.stakes);
    for (let i = 0; i < st.plaques.length; i++) {
      const P = st.plaques[i];
      const d = tilt && card && h > 0 && (lab.playing || force) ? this.effOf(lab, card[side].eff[P.key] || 0, m) : 0;
      P.dotS.visible = h === 1 && d !== 0 && Math.abs(d) < 2;
      P.dotB.visible = h === 1 && Math.abs(d) >= 2;
      P.hint.visible = h === 2 && d !== 0;
      if (P.dotS.visible) lab.pulse(P.dotS, 1.5, 0.15);
      if (P.dotB.visible) lab.pulse(P.dotB, 1.5, 0.15);
      if (P.hint.visible) {
        const g = P.hctx, up = d > 0, col = up ? '#7cff8a' : '#ff6a5a';
        g.clearRect(0, 0, 128, 64);
        g.fillStyle = 'rgba(30,16,8,0.85)'; g.beginPath(); g.roundRect ? g.roundRect(4, 4, 120, 56, 14) : g.rect(4, 4, 120, 56); g.fill();
        g.fillStyle = col; g.beginPath();
        if (up) { g.moveTo(16, 46); g.lineTo(34, 16); g.lineTo(52, 46); } else { g.moveTo(16, 18); g.lineTo(34, 48); g.lineTo(52, 18); }
        g.fill();
        g.font = 'bold 40px Georgia, "DejaVu Serif", serif'; g.textAlign = 'center'; g.textBaseline = 'middle';
        g.fillText((up ? '+' : '−') + Math.abs(d), 88, 34);
        P.htex.needsUpdate = true;
        lab.pulse(P.hint, 1.25, 0.15);
      }
    }
  },
  scalesStep(lab, dt) {
    const st = lab.state;
    for (let i = 0; i < st.plaques.length; i++) {
      const P = st.plaques[i];
      P.shown = lab.damp(P.shown, P.target, 7, dt || 1);
      P.fill.scale.y = Math.max(0.02, P.shown / 10);
      const v = P.target, edge = v <= 1 || v >= 9;
      if (edge) { // у края — пульсирует красным
        const k = 0.5 + 0.5 * Math.sin(lab.t * 9);
        P.fillMat.emissive.set('#ff2a1a'); P.fillMat.emissiveIntensity = 0.4 + 0.9 * k;
        P.fillMat.color.copy(P.base).lerp(new lab.THREE.Color('#ff4d5e'), 0.5 + 0.5 * k);
      } else if (P.wasEdge) { P.fillMat.emissive.copy(P.base); P.fillMat.emissiveIntensity = 0.35; P.fillMat.color.copy(P.base); }
      if (edge && !P.wasEdge && lab.t > 0.1) { lab.tone(880, 0.08, 'square', 0.04); lab.tone(660, 0.08, 'square', 0.04, 0, 0.1); }
      P.wasEdge = edge;
    }
  },

  /* ================= люди: гости и старейшина ================= */
  fig(lab, who) {
    const st = lab.state;
    const pool = st.figs[who] || (st.figs[who] = []);
    let F = pool.find(f => f.mode === 'off' || f.mode === 'hidden');
    if (!F) { F = this.figure(lab, who); pool.push(F); }
    return F;
  },
  figure(lab, who) {
    const L = this.WHO[who].look;
    const root = lab.group({ at: [8, 0, this.VISITOR[2]] });
    const upper = lab.group({ parent: root, at: [0, 0.82, 0] });
    const lowT = lab.group({ parent: null }), upT = lab.group({ parent: null });
    const people = L.twins ? [[-0.24, Object.assign({}, L), 0.6], [0.26, Object.assign({}, L, { coat: L.coat2, hatColor: '#c9542e', item: 'none' }), 0.55]] : [[0, L, L.tall || 1]];
    for (const [x, look, s] of people) this.person(lab, look, lowT, upT, x, s);
    lab.merge([lowT], root); lab.merge([upT], upper);
    root.visible = false;
    return { root, upper, who, mode: 'off', t: 0, dir: 1, x0: 0, kid: !!L.twins };
  },
  // человечек из примитивов: ноги и полы — в нижней части, туловище, голова, шапка и предмет — в верхней (она кланяется)
  person(lab, L, lowT, upT, x, s) {
    const lo = lab.group({ parent: lowT, at: [x, 0, 0], scale: s });
    const up = lab.group({ parent: upT, at: [x, 0.82 * s - 0.82, 0], scale: s });
    const sk = L.skin || '#e8b48a', w = L.wide || 1, coat = L.glow ? lab.mat(L.coat, { glow: 0.25, metal: 0.4, rough: 0.4 }) : L.coat;
    if (!L.dress) {
      for (const sx of [-1, 1]) {
        lab.box(0.13, 0.42, 0.15, '#2a1d17', { parent: lo, at: [sx * 0.09, 0.3, 0] });
        lab.box(0.14, 0.12, 0.24, '#151010', { parent: lo, at: [sx * 0.09, 0.06, 0.03] });
      }
      lab.cyl(0.24 * w, 0.32 * w, 0.46, coat, { parent: lo, at: [0, 0.6, 0], sides: 8 });
      if (L.trim) lab.cyl(0.322 * w, 0.322 * w, 0.04, L.trim, { parent: lo, at: [0, 0.39, 0], sides: 8 });
    } else {
      lab.cyl(0.21, 0.42, 0.86, L.coat, { parent: lo, at: [0, 0.43, 0], sides: 10 });
      lab.cyl(0.425, 0.425, 0.05, '#e8b23a', { parent: lo, at: [0, 0.06, 0], sides: 10 });
    }
    // туловище
    lab.cyl(0.2 * w, 0.24 * w, 0.54, coat, { parent: up, at: [0, 0.27, 0], sides: 8 });
    lab.cyl(0.245 * w, 0.245 * w, 0.06, L.trim || '#c9a24a', { parent: up, at: [0, 0.03, 0], sides: 8 });
    if (L.apron) lab.box(0.34, 0.75, 0.04, L.apron, { parent: up, at: [0, 0.02, 0.22 * w] });
    if (L.gaz) for (const sx of [-1, 1]) for (let k = 0; k < 4; k++) lab.box(0.05, 0.03, 0.03, '#f2efe6', { parent: up, at: [sx * 0.11, 0.3 + k * 0.05, 0.2 * w], rot: [0, 0, sx * 0.3] });
    if (L.burka) lab.cyl(0.3, 0.56, 0.98, L.burka, { parent: up, at: [0, 0.07, -0.02], sides: 6 });
    if (L.cape) lab.box(0.5, 0.95, 0.04, L.cape, { parent: up, at: [0, 0.05, -0.24] });
    // руки
    for (const sx of [-1, 1]) {
      lab.box(0.11, 0.48, 0.12, L.burka && sx > 0 ? L.burka : coat, { parent: up, at: [sx * 0.29 * w, 0.27, 0.02], rot: [0, 0, sx * 0.12] });
      lab.ball(0.065, sk, { parent: up, at: [sx * 0.32 * w, 0.0, 0.05], detail: 0 });
    }
    // голова
    lab.cyl(0.07, 0.08, 0.08, sk, { parent: up, at: [0, 0.58, 0], sides: 6 });
    lab.ball(0.16, sk, { parent: up, at: [0, 0.71, 0], detail: 1 });
    for (const sx of [-1, 1]) {
      lab.ball(0.036, '#ffffff', { parent: up, at: [sx * 0.058, 0.74, 0.128], detail: 0 });
      lab.ball(0.02, '#1a1410', { parent: up, at: [sx * 0.058, 0.74, 0.158], detail: 0 });
    }
    lab.box(0.045, 0.07, 0.06, sk, { parent: up, at: [0, 0.69, 0.16] });
    if (L.beard) lab.cone(0.13, 0.24, L.beard, { parent: up, at: [0, 0.55, 0.08], rot: [Math.PI, 0, 0], sides: 6 });
    if (L.beard || L.must) lab.box(0.17, 0.035, 0.035, L.beard || L.must, { parent: up, at: [0, 0.645, 0.152] });
    // шапка
    const hc = L.hatColor || '#2a2420';
    if (L.hat === 'papakha') { lab.cyl(0.18, 0.165, 0.2, hc, { parent: up, at: [0, 0.9, 0], sides: 9 }); lab.cyl(0.15, 0.15, 0.02, hc, { parent: up, at: [0, 1.0, 0], sides: 9 }); }
    else if (L.hat === 'tall') lab.cyl(0.175, 0.16, 0.3, hc, { parent: up, at: [0, 0.94, 0], sides: 9 });
    else if (L.hat === 'fur') { lab.cyl(0.2, 0.18, 0.24, hc, { parent: up, at: [0, 0.92, 0], sides: 8 }); lab.ball(0.1, hc, { parent: up, at: [0, 1.05, 0], detail: 0 }); }
    else if (L.hat === 'cap') lab.cyl(0.17, 0.17, 0.11, hc, { parent: up, at: [0, 0.86, 0], sides: 10 });
    else if (L.hat === 'wide') { lab.cyl(0.36, 0.36, 0.03, hc, { parent: up, at: [0, 0.84, 0], sides: 10 }); lab.cyl(0.15, 0.17, 0.16, hc, { parent: up, at: [0, 0.92, 0], sides: 10 }); }
    else if (L.hat === 'helmet') { lab.cone(0.19, 0.38, lab.mat(hc, { glow: 0.5, metal: 0.5, rough: 0.35 }), { parent: up, at: [0, 0.98, 0], sides: 8 }); lab.ball(0.04, lab.mat('#ff4d5e', { glow: 1 }), { parent: up, at: [0, 1.19, 0], detail: 0 }); }
    else if (L.hat === 'scarf') { lab.ball(0.185, hc, { parent: up, at: [0, 0.74, -0.025], detail: 1, scale: [1, 1.05, 1] }); lab.cone(0.2, 0.46, hc, { parent: up, at: [0, 0.52, -0.1], sides: 6 }); lab.box(0.2, 0.035, 0.02, L.coat, { parent: up, at: [0, 0.86, 0.15] }); }
    // предмет в руках
    const it = L.item, hx = 0.33 * w;
    if (it === 'hammer') { lab.cyl(0.025, 0.025, 0.46, '#6b4a2b', { parent: up, at: [hx, 0.12, 0.08], rot: [0.2, 0, 0], sides: 5 }); lab.box(0.2, 0.1, 0.1, '#4a4a52', { parent: up, at: [hx, 0.35, 0.12], metal: 0.6, rough: 0.4 }); }
    else if (it === 'staff') { lab.cyl(0.03, 0.03, 1.7, '#7a5230', { parent: up, at: [hx + 0.02, 0.08, 0.06], sides: 5 }); lab.ball(0.05, '#7a5230', { parent: up, at: [hx + 0.02, 0.93, 0.06], detail: 0 }); }
    else if (it === 'basket') { lab.cyl(0.17, 0.12, 0.16, '#b07a3a', { parent: up, at: [hx + 0.04, -0.1, 0.12], sides: 8 }); for (const [a, b] of [[-0.06, 0.02], [0.05, -0.03], [0, 0.05]]) lab.ball(0.07, '#5fbf4a', { parent: up, at: [hx + 0.04 + a, -0.0, 0.12 + b], detail: 0 }); }
    else if (it === 'bow') { lab.mesh(new lab.THREE.TorusGeometry(0.34, 0.022, 4, 12, Math.PI), '#6b3f22', { parent: up, at: [-hx - 0.04, 0.22, 0.05], rot: [0, Math.PI / 2, Math.PI / 2] }); lab.box(0.01, 0.68, 0.01, '#e8e0d0', { parent: up, at: [-hx - 0.04, 0.22, 0.05] }); }
    else if (it === 'bundle') { lab.box(0.42, 0.42, 0.3, '#d9a441', { parent: up, at: [0, 0.35, -0.3] }); lab.box(0.44, 0.06, 0.32, '#8a5a2b', { parent: up, at: [0, 0.35, -0.3] }); }
    else if (it === 'book') lab.box(0.24, 0.3, 0.06, '#b8322a', { parent: up, at: [hx - 0.05, 0.05, 0.16], rot: [0.2, 0, 0.1] });
    else if (it === 'carpet') { lab.cyl(0.09, 0.09, 0.8, '#c0392b', { parent: up, at: [0, 0.5, -0.2], rot: [0, 0, Math.PI / 2], sides: 8 }); for (const k of [-0.25, 0, 0.25]) lab.cyl(0.095, 0.095, 0.06, '#ffd166', { parent: up, at: [k, 0.5, -0.2], rot: [0, 0, Math.PI / 2], sides: 8 }); }
    else if (it === 'ball') lab.ball(0.12, '#ff4d5e', { parent: up, at: [hx, -0.05, 0.12], detail: 1 });
    else if (it === 'cane') { lab.cyl(0.025, 0.025, 1.0, L.trim ? '#2a1a12' : '#6b4a2b', { parent: up, at: [hx + 0.02, -0.35, 0.1], sides: 5 }); lab.ball(0.05, L.trim || '#6b4a2b', { parent: up, at: [hx + 0.02, 0.16, 0.1], detail: 0 }); }
    else if (it === 'bag') { lab.cyl(0.02, 0.02, 1.0, '#6b4a2b', { parent: up, at: [hx - 0.1, 0.45, -0.1], rot: [0, 0, 0.7], sides: 4 }); lab.ball(0.16, '#c9a26a', { parent: up, at: [hx - 0.45, 0.82, -0.1], detail: 0 }); }
    else if (it === 'dagger') lab.box(0.05, 0.32, 0.04, lab.mat('#e0b84a', { metal: 0.6, rough: 0.3 }), { parent: up, at: [0.1, -0.08, 0.24], rot: [0, 0, 0.35] });
    else if (it === 'sword') lab.box(0.06, 0.9, 0.025, lab.mat('#bfe8ff', { glow: 0.9 }), { parent: up, at: [hx + 0.02, 0.45, 0.1] });
    else if (it === 'gifts') { lab.box(0.26, 0.2, 0.22, '#c0281e', { parent: up, at: [hx - 0.06, 0.02, 0.16] }); lab.box(0.04, 0.21, 0.23, '#ffd23f', { parent: up, at: [hx - 0.06, 0.02, 0.16] }); }
  },
  // гости: вход, поклон, ожидание, уход
  figsStep(lab, dt) {
    const st = lab.state;
    for (const who in st.figs) for (const F of st.figs[who]) {
      if (F.mode === 'off') continue;
      F.t += dt;
      const r = F.root, V = this.VISITOR, step = F.kid ? 14 : 10;
      if (F.mode === 'in') {
        const k = lab.clamp(F.t / 0.6, 0, 1), e = lab.ease.outCubic(k);
        r.position.x = lab.lerp(6.5, V[0], e);
        r.position.y = Math.abs(Math.sin(F.t * step)) * 0.08 * (1 - k);
        r.rotation.y = k < 0.8 ? -Math.PI / 2 : lab.lerp(-Math.PI / 2, -0.55, (k - 0.8) / 0.2);
        if (k >= 1) { F.mode = 'bow'; F.t = 0; lab.noise(0.04, 0.02, 1500); }
      } else if (F.mode === 'bow') {
        const k = lab.clamp(F.t / 0.5, 0, 1);
        F.upper.rotation.x = Math.sin(Math.PI * k) * 0.42;
        r.position.y = 0;
        if (k >= 1) { F.mode = 'idle'; F.t = 0; }
      } else if (F.mode === 'idle') {
        F.upper.rotation.x = lab.damp(F.upper.rotation.x, 0, 8, dt);
        F.upper.scale.set(1, 1 + Math.sin(lab.t * 2.4 + F.root.id) * 0.02, 1);
        // гость смотрит на склонённую карту
        r.rotation.y = lab.damp(r.rotation.y, -0.55 + st.tilt * 0.35, 6, dt);
      } else if (F.mode === 'out') {
        const k = lab.clamp(F.t / 0.7, 0, 1), e = lab.ease.inQuad(k);
        F.upper.rotation.x = F.happy ? 0 : 0.18;
        r.rotation.y = lab.damp(r.rotation.y, F.dir * Math.PI / 2, 14, dt);
        r.position.x = lab.lerp(F.x0, F.dir * 7, e);
        r.position.y = (F.happy ? Math.abs(Math.sin(F.t * step)) * 0.1 : Math.abs(Math.sin(F.t * step * 0.7)) * 0.03);
        if (k >= 1) { F.mode = 'off'; r.visible = false; F.upper.rotation.x = 0; }
      }
    }
  },
  // старейшина у очага: сидит на скамье, спиной к нам вполоборота, белая папаха — его цвет
  elder(lab) {
    const st = lab.state, T3 = lab.THREE, E = this.ELDER;
    const root = lab.group({ at: E, rot: Math.atan2(this.VISITOR[0] - E[0], this.VISITOR[2] - E[2]) });
    // скамья с ковром
    const bench = lab.group({ parent: null });
    lab.box(1.5, 0.1, 0.55, '#6b4428', { parent: bench, at: [0, 0.42, 0] });
    for (const sx of [-1, 1]) lab.box(0.1, 0.4, 0.45, '#5a3820', { parent: bench, at: [sx * 0.62, 0.2, 0] });
    lab.box(1.2, 0.03, 0.56, '#b8322a', { parent: bench, at: [0, 0.48, 0] });
    for (const k of [-0.4, 0, 0.4]) lab.box(0.08, 0.035, 0.57, '#ffd166', { parent: bench, at: [k, 0.485, 0] });
    lab.merge([bench], root);
    const body = lab.group({ parent: null }), coat = '#2b3a8c';
    for (const sx of [-1, 1]) {
      lab.box(0.15, 0.14, 0.44, coat, { parent: body, at: [sx * 0.11, 0.56, 0.16] });
      lab.box(0.14, 0.44, 0.15, '#1a1210', { parent: body, at: [sx * 0.11, 0.28, 0.38] });
    }
    lab.cyl(0.23, 0.29, 0.56, coat, { parent: body, at: [0, 0.86, 0], sides: 8 });
    lab.cyl(0.295, 0.295, 0.06, '#d8d8e0', { parent: body, at: [0, 0.62, 0], sides: 8 });
    for (const sx of [-1, 1]) for (let k = 0; k < 4; k++) lab.box(0.05, 0.03, 0.03, '#e8b23a', { parent: body, at: [sx * 0.12, 0.9 + k * 0.05, 0.22], rot: [0, 0, sx * 0.3] });
    for (const sx of [-1, 1]) { lab.box(0.12, 0.46, 0.13, coat, { parent: body, at: [sx * 0.31, 0.86, 0.1], rot: [-0.6, 0, sx * 0.1] }); lab.ball(0.07, '#e0a882', { parent: body, at: [sx * 0.3, 0.7, 0.3], detail: 0 }); }
    lab.cyl(0.035, 0.035, 1.5, '#7a5230', { parent: body, at: [0.3, 0.75, 0.36], rot: [0.1, 0, 0], sides: 5 });
    lab.cyl(0.08, 0.09, 0.08, '#e0a882', { parent: body, at: [0, 1.17, 0], sides: 6 });
    lab.ball(0.17, '#e0a882', { parent: body, at: [0, 1.31, 0], detail: 1 });
    lab.cyl(0.21, 0.19, 0.26, '#f4f1ea', { parent: body, at: [0, 1.53, 0], sides: 10 });
    lab.cyl(0.17, 0.17, 0.03, '#f4f1ea', { parent: body, at: [0, 1.66, 0], sides: 10 });
    lab.merge([body], root);
    // борода — свой материал: у наследника она другого цвета
    st.elderBeard = new T3.MeshStandardMaterial({ color: '#e8e4dc', roughness: 0.9, flatShading: true });
    lab.cone(0.14, 0.3, st.elderBeard, { parent: root, at: [0, 1.13, 0.1], rot: [Math.PI, 0, 0], sides: 6 });
    lab.box(0.19, 0.04, 0.04, st.elderBeard, { parent: root, at: [0, 1.25, 0.16] });
    st.elder = root;
    st.elderHead = lab.group({ parent: root, at: [0, 1.35, 0] });
    lab.hero(st.elderHead);
  },

  /* ================= мир: двор, очаг, орех, аул, горы ================= */
  world(lab, scene) {
    const st = lab.state, T3 = lab.THREE;
    // своё небо: градиент меняется по сезонам
    if (this._sky) this._sky.dispose();
    const cv = document.createElement('canvas'); cv.width = 2; cv.height = 256;
    st.skyCtx = cv.getContext('2d'); st.skyTex = this._sky = new T3.CanvasTexture(cv); st.skyTex.colorSpace = T3.SRGBColorSpace;
    scene.background = st.skyTex;
    // земля и утоптанный двор — свои материалы: цвет меняется по сезонам
    st.groundMat = new T3.MeshStandardMaterial({ color: '#4f9a3c', roughness: 0.95, flatShading: true });
    const gr = lab.ground({ w: 160, h: 160, color: '#4f9a3d', bumps: 2.2, flat: 0.12 });
    gr.material = st.groundMat;
    st.yardMat = new T3.MeshStandardMaterial({ color: '#b08a5a', roughness: 1, flatShading: true });
    lab.mesh(new T3.CircleGeometry(4.6, 9).rotateX(-Math.PI / 2), st.yardMat, { at: [-0.4, 0.02, 1.6], shadow: false });
    // пятна травы и камни двора
    const patches = lab.instances(new T3.CylinderGeometry(1, 1, 0.03, 7), '#ffffff', 26, { shadow: false });
    for (let i = 0; i < 26; i++) { const a = lab.rand(0, 6.28), r = lab.rand(5, 14); lab.place(patches, i, [Math.cos(a) * r, 0.025, Math.sin(a) * r - 2], { scale: [lab.rand(0.6, 1.6), 1, lab.rand(0.5, 1.2)], color: i % 2 ? '#3f8a34' : '#5aa848' }); }
    st.patches = patches;
    // цветы весной и летом
    st.flowers = lab.instances(new T3.IcosahedronGeometry(0.07, 0), '#ffffff', 90, { shadow: false });
    for (let i = 0; i < 90; i++) { let x, z; do { x = lab.rand(-9, 9); z = lab.rand(-6, 4); } while (Math.hypot(x + 0.4, z - 1.6) < 4.8); lab.place(st.flowers, i, [x, 0.08, z], { color: lab.pick(['#ff5a6a', '#ffd23f', '#ffffff', '#b98cff', '#ff9ad5']) }); }
    this.hearth(lab);
    this.tree(lab);
    this.fence(lab);
    this.aul(lab);
    this.mountains(lab);
    // звёзды в вечернем небе
    const pts = [];
    for (let i = 0; i < 260; i++) { const a = lab.rand(-1.2, 1.2), e = lab.rand(0.12, 0.9); pts.push(Math.sin(a) * 150, 2 + Math.sin(e) * 150, -Math.cos(a) * 150 * Math.cos(e)); }
    const sg = new T3.BufferGeometry(); sg.setAttribute('position', new T3.Float32BufferAttribute(pts, 3));
    st.stars = new T3.Points(sg, new T3.PointsMaterial({ color: '#ffffff', size: 1.6, sizeAttenuation: false, fog: false, transparent: true, opacity: 0.5 }));
    scene.add(st.stars);
    // снегопад зимой
    const N = 420, sp = new Float32Array(N * 3);
    for (let i = 0; i < N; i++) { sp[i * 3] = lab.rand(-9, 9); sp[i * 3 + 1] = lab.rand(0, 7); sp[i * 3 + 2] = lab.rand(-6, 8); }
    const snowG = new T3.BufferGeometry(); snowG.setAttribute('position', new T3.BufferAttribute(sp, 3));
    st.snow = new T3.Points(snowG, new T3.PointsMaterial({ color: '#ffffff', size: 0.07, transparent: true, opacity: 0, depthWrite: false }));
    st.snow.frustumCulled = false;
    scene.add(st.snow);
    // огонёк заката: солнце у гор
    const sunM = lab.mat('#ffd9a0', { unlit: true, glow: 1.1 }); sunM.fog = false;
    st.sunBall = lab.ball(7, sunM, { at: [-70, 14, -120], detail: 2, shadow: false });
  },
  hearth(lab) {
    const st = lab.state, T3 = lab.THREE, H = this.HEARTH;
    const stones = lab.instances(new T3.IcosahedronGeometry(0.17, 0), '#857a6c', 10);
    for (let i = 0; i < 10; i++) { const a = i / 10 * Math.PI * 2; lab.place(stones, i, [H[0] + Math.cos(a) * 0.55, 0.1, H[2] + Math.sin(a) * 0.55], { scale: [1.2, 0.8, 1], rot: i, color: i % 2 ? '#8d8274' : '#6f665c' }); }
    const logs = lab.group({ parent: null });
    lab.cyl(0.07, 0.07, 0.8, '#5a3a22', { parent: logs, at: [H[0], 0.1, H[2]], rot: [0, 0.5, Math.PI / 2], sides: 6 });
    lab.cyl(0.07, 0.07, 0.8, '#4a2e1a', { parent: logs, at: [H[0], 0.16, H[2]], rot: [0, -0.7, Math.PI / 2], sides: 6 });
    // тренога с котлом
    for (let k = 0; k < 3; k++) { const a = k / 3 * Math.PI * 2; lab.cyl(0.025, 0.025, 1.4, '#3a2a20', { parent: logs, at: [H[0] + Math.cos(a) * 0.32, 0.62, H[2] + Math.sin(a) * 0.32], rot: [Math.sin(a) * 0.25, 0, -Math.cos(a) * 0.25], sides: 4 }); }
    lab.merge([logs]);
    st.pot = lab.ball(0.22, '#24242a', { at: [H[0], 0.95, H[2]], detail: 1, scale: [1, 0.8, 1], metal: 0.5, rough: 0.5 });
    st.embers = lab.ball(0.3, lab.mat('#ff4a1a', { glow: 1 }), { at: [H[0], 0.05, H[2]], detail: 0, scale: [1, 0.35, 1], shadow: false });
    st.flame1 = lab.cone(0.26, 0.75, lab.mat('#ff7a1a', { glow: 1.1, unlit: true }), { at: [H[0], 0.42, H[2]], sides: 5, shadow: false });
    st.flame2 = lab.cone(0.15, 0.5, lab.mat('#ffd23f', { glow: 1.5, unlit: true }), { at: [H[0] + 0.05, 0.32, H[2] + 0.04], sides: 5, shadow: false });
    st.fireLight = new T3.PointLight('#ff9a4a', 5, 9, 1.4);
    st.fireLight.position.set(H[0], 1.0, H[2]);
    lab.scene.add(st.fireLight);
  },
  tree(lab) {
    const st = lab.state, T3 = lab.THREE, P = this.TREE;
    const wood = lab.group({ parent: null });
    lab.cyl(0.26, 0.42, 2.8, '#5a3b26', { parent: wood, at: [P[0], 1.4, P[2]], sides: 7 });
    for (const [a, l, tz] of [[0.7, 1.6, 0.6], [-0.8, 1.5, -0.4], [0.2, 1.4, 1.1]]) lab.cyl(0.08, 0.15, l, '#5a3b26', { parent: wood, at: [P[0] + Math.sin(a) * 0.55, 2.9, P[2] + Math.cos(tz) * 0.2], rot: [0, 0, -a], sides: 5 });
    // качели на нижней ветке
    lab.cyl(0.012, 0.012, 1.6, '#c9a36a', { parent: wood, at: [P[0] + 1.25, 1.75, P[2] + 0.1], sides: 3 });
    lab.cyl(0.012, 0.012, 1.6, '#c9a36a', { parent: wood, at: [P[0] + 1.25, 1.75, P[2] + 0.5], sides: 3 });
    lab.box(0.2, 0.05, 0.55, '#7a5230', { parent: wood, at: [P[0] + 1.25, 0.95, P[2] + 0.3] });
    lab.box(0.12, 0.12, 1.4, '#5a3b26', { parent: wood, at: [P[0] + 1.25, 2.55, P[2] + 0.3] });
    lab.merge([wood]);
    st.crown = lab.instances(new T3.IcosahedronGeometry(1, 1), '#ffffff', 11);
    st.crownSpots = [];
    for (let i = 0; i < 11; i++) { const a = i * 2.4, r = i ? lab.rand(0.9, 1.6) : 0; st.crownSpots.push([P[0] + Math.cos(a) * r, 3.7 + lab.rand(-0.5, 0.8) + (i ? 0 : 0.4), P[2] + Math.sin(a) * r * 0.7, lab.rand(0.8, 1.25)]); }
    st.blossom = lab.instances(new T3.IcosahedronGeometry(0.1, 0), lab.mat('#ffffff', { glow: 0.15 }), 70, { shadow: false });
    for (let i = 0; i < 70; i++) { const s = st.crownSpots[i % 11], a = lab.rand(0, 6.28), e = lab.rand(-0.8, 1.2); lab.place(st.blossom, i, [s[0] + Math.cos(a) * Math.cos(e) * s[3], s[1] + Math.sin(e) * s[3], s[2] + Math.sin(a) * Math.cos(e) * s[3]], { color: i % 3 ? '#ffd0e4' : '#ffffff' }); }
  },
  fence(lab) {
    const parts = lab.group({ parent: null }), z = -3.4;
    for (let x = -10; x <= 10.01; x += 0.9) lab.cyl(0.05, 0.06, 1.3, '#6b4a30', { parent: parts, at: [x, 0.62, z], sides: 5 });
    for (const y of [0.35, 0.6, 0.85, 1.08]) for (let x = -10; x < 10; x += 2.7) lab.box(2.75, 0.13, 0.08, y === 0.6 || y === 1.08 ? '#8d6a45' : '#7a5a3a', { parent: parts, at: [x + 1.35, y, z + (Math.round(x) % 2 ? 0.03 : -0.03)] });
    lab.merge([parts]);
  },
  aul(lab) {
    const st = lab.state, T3 = lab.THREE;
    const hills = lab.group({ parent: null }), houses = lab.group({ parent: null }), snow = lab.group({ parent: null });
    const H = [[-14, -26, 22, 5.5], [8, -30, 26, 6.5], [26, -24, 16, 4], [-30, -34, 18, 5]];
    for (const [x, z, r, h] of H) lab.cone(r, h, '#4f8a40', { parent: hills, at: [x, h / 2 - 0.3, z], sides: 9, scale: [1, 1, 0.6] });
    const spots = [[-11, -19], [-15, -22], [-8, -24], [-18, -27], [5, -22], [10, -25], [3, -27], [14, -28], [22, -20], [-3, -15], [12, -17], [-22, -20]];
    const hAt = (x, z) => { let y = 0; for (const [hx, hz, r, h] of H) { const d = Math.hypot(x - hx, (z - hz) / 0.6); if (d < r) y = Math.max(y, h * (1 - d / r) - 0.3); } return y; };
    spots.forEach(([x, z], i) => {
      const y = hAt(x, z), rot = lab.rand(-0.4, 0.4);
      lab.box(2.6, 1.7, 2, '#efe2c6', { parent: houses, at: [x, y + 0.75, z], rot });
      lab.cone(2.0, 1.2, '#a8683a', { parent: houses, at: [x, y + 2.15, z], rot: rot + Math.PI / 4, sides: 4, scale: [1, 1, 0.8] });
      lab.cone(2.08, 0.55, '#f4f8ff', { parent: snow, at: [x, y + 2.5, z], rot: rot + Math.PI / 4, sides: 4, scale: [1, 1, 0.82] });
      lab.box(0.42, 0.42, 0.06, lab.mat('#ffc65a', { glow: 0.9, unlit: true }), { parent: houses, at: [x + Math.sin(rot) * 1.01 - 0.5, y + 0.85, z + Math.cos(rot) * 1.01] });
      lab.box(0.5, 0.95, 0.06, '#6b4a2b', { parent: houses, at: [x + Math.sin(rot) * 1.01 + 0.5, y + 0.45, z + Math.cos(rot) * 1.01] });
    });
    lab.noShadow(lab.merge([hills]));
    lab.noShadow(lab.merge([houses]));
    st.roofSnow = lab.noShadow(lab.merge([snow]));
    // пирамидальные тополя и дымки над саклями
    const pop = lab.instances(new T3.ConeGeometry(0.6, 4.2, 6), '#2f6a3a', 16, { shadow: false });
    for (let i = 0; i < 16; i++) { const x = lab.rand(-26, 26), z = lab.rand(-14, -22); lab.place(pop, i, [x, hAt(x, z) + 2, z], { scale: lab.rand(0.8, 1.3) }); }
    st.poplars = pop;
    st.smokes = spots.slice(0, 5).map(([x, z]) => [x + 0.6, hAt(x, z) + 2.9, z]);
  },
  mountains(lab) {
    const peaks = [], caps = [];
    for (let i = 0; i < 14; i++) {
      const x = -110 + i * 17 + ((i * 37) % 9), z = -95 - ((i * 53) % 30), h = 30 + ((i * 7) % 5) * 7;
      peaks.push(lab.cone(h * 0.75, h, i % 2 ? '#55588f' : '#62609c', { parent: null, at: [x, h / 2 - 2, z], sides: 5, rot: i }));
      caps.push(lab.cone(h * 0.23, h * 0.3, '#f1ecff', { parent: null, at: [x, h * 0.85 - 2, z], sides: 5, rot: i }));
    }
    lab.noShadow(lab.merge(peaks.concat(caps)));
  },

  /* ================= сезоны ================= */
  setSeason(lab, s, instant) {
    const st = lab.state, S = this.SEASONS[s], prev = st.season >= 0 ? this.SEASONS[st.season] : S;
    st.season = s;
    st.skyFrom = { top: prev.top, hor: prev.hor, ground: prev.ground, yard: prev.yard, sun: prev.sun };
    st.skyTo = S; st.skyK = instant ? 1 : 0;
    this.paintSky(lab, instant ? 1 : 0);
    st.crownSpots.forEach((p, i) => lab.place(st.crown, i, [p[0], p[1], p[2]], { scale: [p[3] * 1.1, p[3] * (S.snow ? 0.8 : 0.9), p[3]], rot: i, color: S.crown[i % 3] }));
    st.blossom.visible = !!S.blossom;
    st.flowers.visible = !!S.flowers;
    st.roofSnow.visible = !!S.snow;
    st.patches.visible = !S.snow;
    if (!instant) {
      lab.popup([this.TREE[0] + 1.5, 4.6, this.TREE[2] + 1], S.name, S.snow ? '#e6f0ff' : S.crown[0], 24);
      [659, 784, 988].forEach((f, k) => lab.tone(f * (S.snow ? 0.75 : 1), 0.4, 'sine', 0.035, 0, k * 0.1));
      const sp = st.crownSpots[0];
      lab.burst([sp[0], sp[1], sp[2]], { count: 24, colors: S.crown.concat(S.blossom ? ['#ffd0e4'] : []), speed: 2.5, up: 0.5, gravity: 1.5, life: 1.4, size: 0.14 });
    }
  },
  paintSky(lab, k) {
    const st = lab.state, A = st.skyFrom, B = st.skyTo, T3 = lab.THREE;
    const mix = (p, q) => new T3.Color(p).lerp(new T3.Color(q), k);
    const top = mix(A.top, B.top), hor = mix(A.hor, B.hor);
    const g = st.skyCtx, gr = g.createLinearGradient(0, 0, 0, 256);
    gr.addColorStop(0, '#' + top.getHexString()); gr.addColorStop(0.62, '#' + hor.getHexString()); gr.addColorStop(1, '#' + hor.getHexString());
    g.fillStyle = gr; g.fillRect(0, 0, 2, 256); st.skyTex.needsUpdate = true;
    if (lab.scene.fog) lab.scene.fog.color.copy(hor);
    st.groundMat.color.copy(mix(A.ground, B.ground));
    st.yardMat.color.copy(mix(A.yard, B.yard));
    lab.light.sun.color.copy(mix(A.sun, B.sun));
    lab.light.hemi.color.copy(top).lerp(new T3.Color('#ffffff'), 0.5);
  },

  /* ================= живой мир и камера ================= */
  ambient(lab, dt) {
    const st = lab.state, S = this.SEASONS[st.season], H = this.HEARTH;
    if (st.skyK < 1) { st.skyK = Math.min(1, st.skyK + dt / 1.3); this.paintSky(lab, st.skyK); }
    // очаг дышит
    const f = 1 + Math.sin(lab.t * 17) * 0.08 + Math.sin(lab.t * 6.3) * 0.06;
    st.flame1.scale.set(1, f, 1); st.flame2.scale.set(1, 2 - f, 1);
    st.flame1.rotation.y = lab.t * 2; st.flame2.rotation.y = -lab.t * 3;
    st.fireLight.intensity = 4.5 + Math.sin(lab.t * 13) * 0.8 + Math.sin(lab.t * 5.1) * 0.6;
    st.sparkT -= dt;
    if (st.sparkT <= 0) {
      st.sparkT = 0.35;
      lab.burst([H[0], 0.8, H[2]], { count: 3, colors: ['#ffb347', '#ffd23f'], speed: 0.8, up: 2.2, gravity: -0.5, life: 1.0, size: 0.05 });
    }
    // сезонные частицы: лепестки, светлячки, листопад
    st.leafT -= dt;
    if (st.leafT <= 0) {
      const p = st.crownSpots[lab.randInt(0, st.crownSpots.length - 1)];
      if (S.leaves) { st.leafT = 0.3; lab.burst([p[0], p[1], p[2]], { count: 3, colors: S.crown, speed: 0.8, up: 0, gravity: 0.9, life: 2.6, size: 0.12 }); }
      else if (S.blossom) { st.leafT = 0.45; lab.burst([p[0], p[1], p[2]], { count: 2, colors: ['#ffd0e4', '#ffffff'], speed: 0.7, up: 0, gravity: 0.6, life: 2.4, size: 0.07 }); }
      else if (!S.snow) { st.leafT = 0.5; lab.burst([lab.rand(-6, 6), lab.rand(0.4, 1.8), lab.rand(-3, 2)], { count: 1, colors: ['#d8ff6a'], speed: 0.3, up: 0.2, gravity: 0, life: 1.6, size: 0.06 }); }
      else st.leafT = 1;
      if (lab.chance(0.25)) { const sm = lab.pick(st.smokes); lab.burst(sm, { count: 2, colors: ['#d8d0e0', '#b0a8c0'], speed: 0.3, up: 1.2, gravity: -0.3, life: 2.5, size: 0.35 }); }
    }
    // снегопад
    const sm = st.snow.material, want = S.snow ? 0.9 : 0;
    sm.opacity = lab.damp(sm.opacity, want, 2, dt);
    st.snow.visible = sm.opacity > 0.02;
    if (st.snow.visible) {
      const a = st.snow.geometry.attributes.position, arr = a.array;
      for (let i = 0; i < arr.length; i += 3) {
        arr[i + 1] -= dt * (0.6 + (i % 7) * 0.08);
        arr[i] += Math.sin(lab.t * 0.8 + i) * dt * 0.15;
        if (arr[i + 1] < 0) arr[i + 1] += 7;
      }
      a.needsUpdate = true;
    }
    st.stars.material.opacity = 0.35 + 0.15 * Math.sin(lab.t * 0.7);
    // старейшина дышит
    st.elder.scale.set(1, 1 + Math.sin(lab.t * 1.8) * 0.012, 1);
  },
  cameraStep(lab, dt) {
    const st = lab.state, cam = lab.camera, C = this.CAM, L = this.LOOK;
    st.camK = lab.damp(st.camK, st.camTo ? 1 : 0, st.camTo ? 2.6 : 3, dt || 1);
    const to = st.camTo || st.lastTo || { pos: C, look: L };
    if (st.camTo) st.lastTo = st.camTo;
    const k = st.camK, sway = Math.sin(lab.t * 0.5) * 0.04;
    cam.position.set(lab.lerp(C[0], to.pos[0], k) + sway, lab.lerp(C[1], to.pos[1], k) + Math.sin(lab.t * 0.37) * 0.02, lab.lerp(C[2], to.pos[2], k));
    cam.lookAt(lab.lerp(L[0], to.look[0], k), lab.lerp(L[1], to.look[1], k), lab.lerp(L[2], to.look[2], k));
  },
};
