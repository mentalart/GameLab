// Сквозная проверка уроков модуля 3 «Выбор, вызов, баланс» (9–13) — часть e2e-portal.js, вызывается из него с его помощниками.
// Общий формат уроков (как урок 1, 180 минут): вопрос урока, донор, «Найди спрятанную механику», живая схема (svg.mo), квиз-сортировщик,
// мастерская вариаций, Фабрика и сборка в чате Qwen, своя игра, «Играем вместе», линза и вопрос урока ещё раз.
// Интерактивы модуля (public/vybor.js): кривая сложности (урок 9, уходит в донора и в ИГРА), «Свинья» (10), вызов класса на одном зерне (9, 10, 12, 13),
// шкала случая и мастерства (12), таблица баланса (13, уходит в донора и в ИГРА), релиз модуля 3.
'use strict';

module.exports = function m3(H) {
  const { check, gameFrame, playRound, sleep, mock, lessons } = H;
  const stepOf = (les, id) => les.checkpoints.flatMap(c => c.steps).find(s => s.id === id);
  const cp = (student, title) => student.click(`.cp >> text=${title}`);

  async function open(teacher, student, les) {
    await teacher.click('.tabs >> text=Урок');
    await teacher.selectOption('#moduleSel', '3');
    await teacher.selectOption('#lessonSel', les.id);
    await teacher.waitForSelector('text=Открыть все', { timeout: 10000 });
    await teacher.click('text=Открыть все');
    await student.waitForFunction(t => document.querySelector('#lessonTitle').textContent.includes(t), `Урок ${les.number}`, { timeout: 15000 });
    await student.waitForSelector('#step-vopros-uroka', { timeout: 15000 });
    const steps = les.checkpoints.flatMap(c => c.steps);
    check(`Урок ${les.number} открылся у ученика: модуль 3, 180 минут, у каждого шага реплика учителя`, (await student.textContent('#lessonTitle')).includes(les.title)
      && les.checkpoints.reduce((a, c) => a + c.minutes, 0) === 180 && steps.every(s => s.teacher && s.teacher.say));
  }
  async function choice(student, id, nth = 0) {
    await student.click(`#step-${id} .opts:not([data-q]) .opt >> nth=${nth}`);
    await student.click(`#step-${id} >> text=Ответить`);
    await student.waitForSelector(`#step-${id}.done`);
  }
  // партия в шаге play: счётчики и статистика телеметрии, затем конец партии
  async function round(gf, { score = 300, counts = {}, stats = {} } = {}) {
    await gf.evaluate(([s, c, t]) => {
      window.__lab.confirm(); const L = window.__lab.lab;
      for (const [k, n] of Object.entries(c)) L.count(k, n);
      for (const [k, v] of Object.entries(t)) L.stat(k, v);
      L.score = s; window.__lab.end('lose', 'Проверка');
    }, [score, counts, stats]);
  }
  async function donor(student, les, file, probe) {
    await choice(student, 'vopros-uroka', 1);
    await student.click('#step-donor-play .veil button');
    const gf = await gameFrame(student, file, 0);
    if (probe) await probe(gf);
    await playRound(gf, { score: 500 });
    await student.waitForSelector('#step-donor-play.done', { timeout: 10000 });
    await choice(student, 'donor-hook', 0);
  }
  async function hunt(student, les, mode, file, counters) {
    await student.click('.cp >> nth=1');
    await student.click('#step-secret-play .veil button');
    const gf = await gameFrame(student, file, 0);
    await gf.waitForFunction(() => window.__lab.cfg.secret === 0, null, { timeout: 5000 }).catch(() => {});
    check(`Урок ${les.number}: без спрятанной механики — ручка шага`, await gf.evaluate(() => window.__lab.cfg.secret === 0));
    await round(gf, { score: 100, counts: counters });
    await student.waitForSelector('#step-secret-play.done', { timeout: 10000 });
    const h = stepOf(les, 'secret-hunt').hunt;
    await student.waitForSelector('#step-secret-hunt .opt');
    await student.click(`#step-secret-hunt .opt >> text=${mode === 'mock' ? h.trap : h.right}`);
    await student.click('#step-secret-hunt >> text=Ответить');
    await student.waitForSelector('#step-secret-hunt.done');
    const rv = (await student.textContent('#step-secret-hunt')).replace(/\s+/g, ' ');
    check(`Урок ${les.number}: ${mode === 'mock' ? 'ловушка распознана' : 'спрятанная механика угадана'} — «${h.title}»`, (mode === 'mock' ? /Ловушка!/.test(rv) : /Точно!/.test(rv)) && rv.includes(h.title), rv.slice(0, 100));
  }
  // живая схема в тексте шага: анимация запускается, когда схема видна, и повторяется по щелчку
  async function story(student, les, shot) {
    const sel = '#step-secret-story svg.mo';
    await student.waitForSelector(sel);
    await student.locator(sel).scrollIntoViewIfNeeded();
    await student.waitForSelector(sel + '.go', { timeout: 5000 }).catch(() => {});
    const r = await student.$eval(sel, s => ({ go: s.classList.contains('go'), parts: s.querySelectorAll('.pop,.fade,.draw,animateMotion').length, label: s.getAttribute('aria-label') || '' }));
    check(`Урок ${les.number}: живая схема — анимация, когда видна, и подпись для чтения с экрана`, r.go && r.parts >= 6 && r.label.length > 30, JSON.stringify(r).slice(0, 120));
    if (shot) { await sleep(2500); await shot(student, `m3-${les.number}-shema`); }
    await student.click('#step-secret-story >> text=Понятно');
    await student.waitForSelector('#step-secret-story.done');
  }
  // квиз-сортировщик с разбором: верно на все карточки
  async function sorter(student, les, id, extra) {
    const st = stepOf(les, id);
    await student.click(`#step-${id} >> text=▶ Начать`);
    for (let i = 0; i < st.items.length; i++) {
      const text = (await student.textContent(`#step-${id} .item`)).trim();
      if (i === 0 && extra) await extra();
      const it = st.items.find(x => text.endsWith(x.text) || text === x.text);
      await student.click(`#step-${id} .bins .bin >> nth=${st.bins.findIndex(b => b.id === it.bin)}`);
      await student.waitForSelector(`#step-${id} [data-next]:not([hidden])`, { timeout: 5000 });
      await student.click(`#step-${id} [data-next]`);
      await student.waitForFunction(([s, p]) => { const e = document.querySelector(s + ' .item'); return !!document.querySelector(s + '.done') || !e || !e.textContent.trim().endsWith(p); }, [`#step-${id}`, it.text], { timeout: 15000 });
    }
    await student.waitForSelector(`#step-${id}.done`, { timeout: 10000 });
    const res = (await student.textContent(`#step-${id}`)).replace(/\s+/g, ' ');
    check(`Урок ${les.number}: квиз ${st.title.replace(/^Квиз /, '')} пройден без ошибок`, new RegExp(`${st.items.length} из ${st.items.length}`).test(res), res.slice(res.indexOf('Итог'), res.indexOf('Итог') + 160));
  }
  // мастерская вариаций: 4 вариации — ручки, чувство, деталь, доска с полосой
  async function variety(student, les, file, tries, statVal, fav, mixLabel, shot) {
    const vs = stepOf(les, 'variacii');
    await student.waitForSelector('#step-variacii [data-var]');
    check(`Урок ${les.number}: мастерская вариаций — ядро и плитки`, (await student.textContent('#step-variacii')).includes(vs.core) && await student.locator('#step-variacii [data-var]').count() === vs.variants.length);
    for (const [k, [id, knob, val]] of tries.entries()) {
      const x = vs.variants.find(y => y.id === id);
      await student.click(`#step-variacii [data-var=${id}]`);
      await student.click('#step-variacii .veil button');
      const gf = await gameFrame(student, file, 0);
      await gf.waitForFunction(([kn, vl]) => window.__lab.cfg[kn] === vl, [knob, val], { timeout: 5000 }).catch(() => {});
      check(`Вариация «${x.label}» включила свои ручки`, await gf.evaluate(([kn, vl]) => window.__lab.cfg[kn] === vl, [knob, val]));
      await round(gf, { score: 200, stats: { [vs.meter.stat]: statVal } });
      await student.waitForSelector('#step-variacii [data-feel]', { timeout: 10000 });
      await student.click(`#step-variacii [data-feel] >> nth=${k}`);
      const dial = k === 1 ? vs.dials.find(d => d.id !== x.dial).id : x.dial;
      await student.click(`#step-variacii [data-dial=${dial}]`);
      await student.waitForSelector('#step-variacii .verdict');
      if (k === 1) check(`Вариации урока ${les.number}: ошибка в детали — разбор`, /Не совсем/.test(await student.textContent('#step-variacii .verdict')));
      await student.click('#step-variacii [data-next]');
    }
    await student.waitForSelector('#step-variacii .var-board');
    const board = await student.textContent('#step-variacii .var-board');
    check(`Доска вариаций урока ${les.number}: четыре игры и своя полоса`, await student.locator('#step-variacii .var-row').count() === 4 && board.includes(vs.meter.text.replace('{v}', String(statVal))), board.slice(0, 120));
    if (shot) await shot(student, `m3-${les.number}-variacii`, true);
    await student.click(`#step-variacii [data-fav=${fav}]`);
    await student.waitForSelector('#step-variacii.done', { timeout: 10000 });
    await student.click(`#step-variacii [data-mix="${mixLabel}"]`);
    check(`Конструктор вариации урока ${les.number}`, (await student.textContent('#step-variacii .pickline')).includes(mixLabel));
  }
  // Фабрика, решения, ИГРА (в черновике — {curve} или {table}), сборка в чате Qwen
  async function build(student, les, mode, title, demoCheck, inPrompt) {
    await student.click('#step-fabrika >> text=🎲 Кубик для пустых полей');
    await student.fill('#f-fabrikatitle', title);
    await student.click('#step-fabrika >> text=Замысел готов');
    await student.waitForSelector('#step-fabrika.done');
    await student.fill('#f-resheniyafeeling', 'Азарт: ещё чуть-чуть');
    await student.click('#step-resheniya .field:has(#f-resheniyahonesty) .cardopt >> nth=0');
    await student.click('#step-resheniya .field:has(#f-resheniyachoice) .cardopt >> nth=0');
    await student.click('#step-resheniya >> text=Решения приняты');
    await student.waitForSelector('#step-resheniya.done');
    const preview = (await student.textContent('#step-igra .preview-igra')).replace(/\s+/g, ' ');
    check(`Урок ${les.number}: ИГРА — готовый промпт с названием` + (inPrompt ? ' и данными интерактива' : ''), preview.includes(title) && (!inPrompt || preview.includes(inPrompt)), preview.slice(0, 90));
    await student.click('#step-igra button:has-text("Всё верно")');
    await student.waitForSelector('#step-igra.done');
    await student.click('#step-sborka >> text=⚙ Собрать игру');
    let own = await gameFrame(student, '/play/', 0);
    if (mode === 'mock') {
      const t = mock.last.newUser || '';
      check(`Задание Qwen урока ${les.number}: замысел и донор урока` + (inPrompt ? ', данные интерактива целиком' : ''), /# Замысел геймдизайнера/.test(t) && (!inPrompt || t.includes(inPrompt)), t.slice(0, 80));
      await own.evaluate(() => window.__lab.confirm());
      await student.waitForFunction(() => document.querySelectorAll('#step-sborka .ver').length >= 2, null, { timeout: 30000 });
      own = await gameFrame(student, '/play/', 0);
    } else if (demoCheck) check(`Демо-режим урока ${les.number}: игра ученика — донор урока с его названием`, await own.evaluate(demoCheck, title));
    await student.waitForSelector('#step-sborka.done', { timeout: 10000 });
    const card = await student.evaluate(id => Lab.api('/api/arcade').then(r => r.mine.find(c => c.lesson && c.lesson.id === id)), les.id);
    check(`Игра урока ${les.number} в аркаде`, card && card.title === title, card ? card.title : 'нет карточки');
  }
  async function own(student, les) {
    await cp(student, 'Своя игра');
    await student.click('#step-ruchki .veil button');
    await playRound(await gameFrame(student, '/play/', 0), { score: 120 });
    await student.click(`#step-ruchki [data-match="${stepOf(les, 'ruchki').match.options[1]}"]`);
    await student.waitForSelector('#step-ruchki.done', { timeout: 10000 });
  }
  // вызов класса на одном зерне: у всех одна партия, после своей — топ класса, гистограмма или выбор класса
  async function pulse(student, les, id, file, tele, what) {
    const st = stepOf(les, id);
    await student.click(`#step-${id} .veil button`);
    const gf = await gameFrame(student, file + '.js&seed=', 0);
    check(`Урок ${les.number}: вызов класса — игра на общем зерне ${st.seed}`, await gf.evaluate(s => new URL(location.href).searchParams.get('seed') === String(s), st.seed));
    await round(gf, tele);
    await student.waitForSelector(`#step-${id}.done`, { timeout: 10000 });
    await student.waitForSelector(`#step-${id} .pulse-top li.me`, { timeout: 10000 });
    const txt = (await student.textContent(`#step-${id}`)).replace(/\s+/g, ' ');
    check(`Урок ${les.number}: сводка класса после партии — ${what}`, txt.includes('Класс на этом зерне') && (!st.picks || /\d+ ?%/.test(txt)) && (!st.series || txt.includes(st.seriesTitle)), txt.slice(txt.indexOf('Класс на этом'), txt.indexOf('Класс на этом') + 120));
  }
  async function final(student, les, lensWord) {
    await cp(student, 'Финал');
    await student.click('#step-linza .lens-card');
    await student.waitForSelector('#step-linza.done');
    check(`Урок ${les.number}: линза урока переворачивается`, (await student.textContent('#step-linza .lens-face')).includes(lensWord));
    await choice(student, 'vopros-uroka-2', 1);
  }

  /* ---------------- урок 9: поток и кривая сложности ---------------- */
  async function lesson9(mode, teacher, student, shot) {
    const les = lessons[9], F = 'ushchelye';
    await open(teacher, student, les);
    // две версии: «слишком легко» и «слишком трудно» — свои ручки
    await choice(student, 'vopros-uroka', 1);
    for (const [k, label] of ['Слишком легко', 'Слишком трудно'].entries()) {
      await student.click(`#step-dve-versii .seg .opt >> text=${label}`);
      await student.click('#step-dve-versii .veil button');
      const gf = await gameFrame(student, F, 0);
      const sp = await gf.evaluate(() => window.__lab.cfg.speed0);
      check(`Урок 9: версия «${label}» — своя скорость`, sp === (k ? 22 : 7), String(sp));
      await playRound(gf, { score: 100 });
    }
    await student.waitForSelector('#step-dve-versii.done', { timeout: 10000 });
    await student.click('#step-skuchno-obidno .opts:not([data-q]) .opt >> nth=0');
    await student.click('#step-skuchno-obidno [data-q=legkaya] .opt >> nth=0');
    await student.click('#step-skuchno-obidno [data-q=trudnaya] .opt >> nth=0');
    await student.click('#step-skuchno-obidno >> text=Ответить');
    await student.waitForSelector('#step-skuchno-obidno.done');
    await student.click('#step-donor-play .veil button');
    await playRound(await gameFrame(student, F, 0), { score: 500 });
    await student.waitForSelector('#step-donor-play.done', { timeout: 10000 });
    await choice(student, 'donor-hook', 0);
    await hunt(student, les, mode, F, { 'передышки': 3, 'удары': 2 });
    await story(student, les, shot);
    await sorter(student, les, 'skuka-trevoga', async () => check('Урок 9: «Скука или тревога?» — кусок кривой над карточкой', await student.locator('#step-skuka-trevoga .item svg.spark').count() === 1));
    await variety(student, les, F, [['vstrechnye', 'oncoming', 1], ['pogonya', 'chase', 1], ['tuman', 'sight', 25], ['odna-oshibka', 'lives', 1]], 37, 'tuman', 'Туман', shot);
    // кривая сложности: готовая «пила», столбик выше стрелкой, пробежка по кривой, удары на графике
    await cp(student, 'Фабрика');
    await student.waitForSelector('#step-krivaya svg.curve-ed');
    await student.click('#step-krivaya [data-curve=pila]');
    await student.locator('#step-krivaya svg.curve-ed').focus();
    await student.keyboard.press('ArrowRight'); await student.keyboard.press('ArrowUp');
    const line = await student.textContent('#step-krivaya .pickline');
    check('Кривая сложности: пила с передышками, разбор формы', /пила/i.test(line) && /передышек [1-9]/.test(line), line);
    await sleep(900);
    await student.click('#step-krivaya .veil button');
    const gf = await gameFrame(student, F, 0);
    const curve = await gf.evaluate(() => (window.__lab.lab.data || {}).curve);
    check('Кривая ушла в «Ущелье»: игра строит трассу по столбикам ученика (lab.data.curve)', Array.isArray(curve) && curve.length === 12, JSON.stringify(curve));
    await round(gf, { score: 400, stats: { 'удары, с': [12, 47], 'продержался, с': 55 } });
    await student.waitForSelector('#step-krivaya.done', { timeout: 10000 });
    const rep = await student.textContent('#step-krivaya .verdict');
    check('Кривая: после пробежки — удары на графике и разбор', /Продержался 55 с/.test(rep) && await student.locator('#step-krivaya svg.curve-ed circle.hit').count() === 2, rep.slice(0, 100));
    if (shot) await shot(student, 'm3-9-krivaya');
    await build(student, les, mode, 'Ущелье нарта', t => GAME.title === t, 'кривая сложности на 2 минуты');
    await own(student, les);
    await cp(student, 'Играем вместе');
    await pulse(student, les, 'dalnost', F, { score: 640, stats: { 'дистанция, м': 812, 'удары, с': [14, 15, 61] } }, 'топ по дистанции и где класс разбивался');
    if (shot) await shot(student, 'm3-9-pulse');
    await final(student, les, 'потока');
  }

  /* ---------------- урок 10: интересные решения ---------------- */
  async function lesson10(mode, teacher, student, shot) {
    const les = lessons[10], F = 'roy';
    await open(teacher, student, les);
    await choice(student, 'vopros-uroka', 1);
    // «Свинья»: единица сжигает очки хода, шестёрки до 50 — победа (кубик подменён, чтобы партия была короткой)
    await student.waitForSelector('#step-svinya [data-pig=roll]');
    await student.evaluate(() => { window.__rnd = Math.random; Math.random = () => 0; });
    await student.click('#step-svinya [data-pig=roll]');
    await student.waitForFunction(() => /Твой ход/.test(document.querySelector('#step-svinya .pig-log').textContent), null, { timeout: 10000 });
    check('«Свинья»: единица сожгла ход, бот сходил, снова мой ход', /единицу/.test(await student.textContent('#step-svinya .pig-log')));
    await student.evaluate(() => { Math.random = () => 0.99; });
    for (let i = 0; i < 9; i++) await student.click('#step-svinya [data-pig=roll]');
    await student.click('#step-svinya [data-pig=hold]');
    await student.evaluate(() => { Math.random = window.__rnd; });
    await student.waitForSelector('#step-svinya.done', { timeout: 10000 });
    check('«Свинья»: партия до 50 сыграна, раскрытие «риск и награда»', /риск и награда/.test(await student.textContent('#step-svinya')) && await student.locator('#step-svinya [data-pig=again]').count() === 1);
    await student.click('#step-donor-play .veil button');
    await playRound(await gameFrame(student, F, 0), { score: 500 });
    await student.waitForSelector('#step-donor-play.done', { timeout: 10000 });
    await choice(student, 'donor-hook', 0);
    await hunt(student, les, mode, F, { 'уровни': 3, 'сбито': 40 });
    await story(student, les, shot);
    await sorter(student, les, 'est-li-vybor');
    await variety(student, les, F, [['minusy', 'minus', 1], ['svyazki', 'evolve', 1], ['perebros', 'reroll', 3], ['altar', 'altar', 1]], 40, 'altar', 'Алтарь', shot);
    await cp(student, 'Фабрика');
    await build(student, les, mode, 'Рой над пасекой', t => GAME.title === t);
    await own(student, les);
    await cp(student, 'Играем вместе');
    await pulse(student, les, 'tri-minuty', F, { score: 900, counts: { 'взял: Жало': 3, 'взял: Щит': 1 }, stats: { 'продержался, с': 140 } }, 'топ и какие улучшения брал класс');
    await final(student, les, 'выбора');
  }

  /* ---------------- урок 11: петли обратной связи ---------------- */
  async function lesson11(mode, teacher, student, shot) {
    const les = lessons[11], F = 'yarmarochnaya-gonka';
    await open(teacher, student, les);
    await choice(student, 'monopoliya', 0);
    await donor(student, les, F);
    await hunt(student, les, mode, F, { 'смены лидера': 1, 'обгоны': 2 });
    await story(student, les, shot);
    await sorter(student, les, 'kakaya-petlya');
    await variety(student, les, F, [['kom', 'snowball', 2], ['pomosch', 'rubber', 2], ['roy', 'bees', 1], ['turbo', 'drift', 1]], 6, 'pomosch', 'Срезка', shot);
    await cp(student, 'Фабрика');
    await build(student, les, mode, 'Сырный заезд', t => GAME.title === t);
    await own(student, les);
    await cp(student, 'Играем вместе');
    // автопрогон: 20 заездов ботов — две петли подряд
    for (const [label, knob, val] of [['Снежный ком', 'snowball', 2], ['Помощь отстающему', 'rubber', 2]]) {
      await student.click(`#step-avtoprogon .seg .opt >> text=${label}`);
      await student.click('#step-avtoprogon .veil button');
      const gf = await gameFrame(student, F, 0);
      check(`Урок 11: автопрогон «${label}» — ботов гоняет ручка sim`, await gf.evaluate(([k, v]) => window.__lab.cfg.sim === 1 && window.__lab.cfg[k] === v, [knob, val]));
      await playRound(gf, { score: 0 });
    }
    await student.waitForSelector('#step-avtoprogon.done', { timeout: 10000 });
    await choice(student, 'gde-reshaetsya', 1);
    await final(student, les, 'петель');
  }

  /* ---------------- урок 12: случай и мастерство ---------------- */
  async function lesson12(mode, teacher, student, shot) {
    const les = lessons[12], F = 'koloda-narta';
    await open(teacher, student, les);
    await choice(student, 'vopros-uroka', 1);
    // шкала: больше половины игр, потом — где их ставят геймдизайнеры
    const sc = stepOf(les, 'shkala');
    await student.waitForSelector('#step-shkala [data-scale]');
    for (const it of sc.items.slice(0, 7)) await student.locator(`#step-shkala [data-scale=${it.id}]`).fill(String(it.id === 'shahmaty' ? 3 : it.at));
    await student.click('#step-shkala [data-scale-done]');
    await student.waitForSelector('#step-shkala.done');
    const st = (await student.textContent('#step-shkala')).replace(/\s+/g, ' ');
    check('Шкала случая и мастерства: метки геймдизайнеров и разбор по каждой игре', await student.locator('#step-shkala .scale-pro').count() === sc.items.length && /Близко/.test(st) && /Ты поставил 3, геймдизайнеры — около 10/.test(st), st.slice(0, 120));
    if (shot) await shot(student, 'm3-12-shkala');
    await student.click('#step-donor-play .veil button');
    await playRound(await gameFrame(student, F, 0), { score: 500 });
    await student.waitForSelector('#step-donor-play.done', { timeout: 10000 });
    await choice(student, 'donor-hook', 0);
    await hunt(student, les, mode, F, { 'промахи кубика': 3 });
    await story(student, les, shot);
    await sorter(student, les, 'do-ili-posle');
    await variety(student, les, F, [['kubiki', 'dice', 1], ['shans', 'hit', 70], ['skrytye', 'hidden', 1], ['mana', 'mana', 1]], 64, 'shans', 'Кубики до хода', shot);
    await cp(student, 'Фабрика');
    await build(student, les, mode, 'Колода пасечника', t => GAME.title === t);
    await own(student, les);
    await cp(student, 'Играем вместе');
    await pulse(student, les, 'odna-razdacha', F, { score: 700, stats: { 'победы': 3 } }, 'топ по победам на одной раздаче');
    await final(student, les, 'случая');
  }

  /* ---------------- урок 13: экономика, таблица баланса и релиз модуля ---------------- */
  async function lesson13(mode, teacher, student, shot) {
    const les = lessons[13], F = 'duel-u-mosta';
    await open(teacher, student, les);
    await choice(student, 'silnaya', 2);
    await donor(student, les, F);
    await hunt(student, les, mode, F, { 'обмены в плюс': 0 });
    await story(student, les, shot);
    await sorter(student, les, 'otkuda-kuda');
    await variety(student, les, F, [['dvoynoy', 'doubleAll', 1], ['rodnik', 'farm', 1], ['knb', 'rps', 1], ['zerkalo', 'mirror', 1]], 12, 'bez-potolka', 'Зеркало', shot);
    await cp(student, 'Фабрика');
    await student.click('#step-fabrika >> text=🎲 Кубик для пустых полей');
    await student.fill('#f-fabrikatitle', 'Снежные крепости');
    await student.click('#step-fabrika >> text=Замысел готов');
    await student.waitForSelector('#step-fabrika.done');
    // таблица баланса: таблица донора честная, рой за 1 каплю — «дёшево», дуэль идёт этой таблицей, разбор по выпускам
    await student.waitForSelector('#step-tablica [data-fair]');
    check('Таблица баланса: 8 юнитов донора, все по силе честные', await student.locator('#step-tablica [data-fair].ok').count() === 8);
    await student.fill('#step-tablica [data-cell="0-cost"]', '1');
    await student.fill('#step-tablica [data-cell="0-name"]', 'Снежки');
    await student.waitForSelector('#step-tablica [data-fair="0"].cheap');
    check('Таблица баланса: цена ниже силы — «дёшево: все будут брать»', /дёшево/.test(await student.textContent('#step-tablica [data-fair="0"]')));
    await sleep(1200);
    await student.click('#step-tablica .veil button');
    const gf = await gameFrame(student, F, 0);
    const u0 = await gf.evaluate(() => (window.__lab.lab.data.units || [])[0]);
    check('Таблица ушла в «Дуэль у моста» (lab.data.units)', u0 && u0.name === 'Снежки' && u0.cost === 1 && u0.kind === 'рой', JSON.stringify(u0));
    await round(gf, { score: 300, counts: { 'выпущено: Снежки': 6, 'выпущено: Всадник': 1 }, stats: { 'исход': 'победа' } });
    await student.waitForSelector('#step-tablica.done', { timeout: 10000 });
    const rep = await student.textContent('#step-tablica .verdict');
    check('Таблица баланса: таблица предсказала, что выпускал ученик', /Снежки/.test(rep) && /самый дешёвый/.test(rep), rep.slice(0, 120));
    if (shot) await shot(student, 'm3-13-tablica', true);
    await student.fill('#f-resheniyafeeling', 'Переиграл по каплям');
    await student.click('#step-resheniya .field:has(#f-resheniyahonesty) .cardopt >> nth=0');
    await student.click('#step-resheniya .field:has(#f-resheniyachoice) .cardopt >> nth=0');
    await student.click('#step-resheniya >> text=Решения приняты');
    await student.waitForSelector('#step-resheniya.done');
    const preview = (await student.textContent('#step-igra .preview-igra')).replace(/\s+/g, ' ');
    check('Урок 13: ИГРА — таблица баланса ученика в правилах', preview.includes('Снежки — рой: 1'), preview.slice(preview.indexOf('таблица'), preview.indexOf('таблица') + 90));
    await student.click('#step-igra button:has-text("Всё верно")');
    await student.waitForSelector('#step-igra.done');
    await student.click('#step-sborka >> text=⚙ Собрать игру');
    let ownF = await gameFrame(student, '/play/', 0);
    if (mode === 'mock') {
      check('Задание Qwen урока 13: таблица баланса целиком', (mock.last.newUser || '').includes('Снежки — рой: 1'));
      await ownF.evaluate(() => window.__lab.confirm());
      await student.waitForFunction(() => document.querySelectorAll('#step-sborka .ver').length >= 2, null, { timeout: 30000 });
      ownF = await gameFrame(student, '/play/', 0);
    }
    await student.waitForSelector('#step-sborka.done', { timeout: 10000 });
    await own(student, les);
    await cp(student, 'Играем вместе');
    await pulse(student, les, 'chto-vypuskaet', F, { score: 800, counts: { 'выпущено: Всадник': 4, 'выпущено: Рой пчёл': 2 }, stats: { 'урон по башне': 1900 } }, 'топ по урону и какие карты выпускал класс');
    if (shot) await shot(student, 'm3-13-pulse');
    // финал: защита баланса, релиз модуля 3 (цель — 5 игр), самооценка модуля
    await cp(student, 'Финал');
    for (const f of ['what', 'why', 'proof']) await student.click(`#step-zashchita .field:has(#f-zashchita${f}) .cardopt >> nth=0`);
    await student.click('#step-zashchita >> text=Решения приняты');
    await student.waitForSelector('#step-zashchita.done');
    await student.waitForSelector('#step-reliz .seg .opt', { timeout: 10000 });
    const rl = (await student.textContent('#step-reliz')).replace(/\s+/g, ' ');
    check('Релиз модуля 3: игры модуля в аркаде из 5, чек-лист про вызов, выбор и честный проигрыш', /из 5/.test(rl) && /настоящий выбор/.test(rl) && /случай до решения/.test(rl), rl.slice(0, 120));
    for (const it of stepOf(les, 'reliz').checklist) await student.click(`#step-reliz .check[data-check="${it.id}"]`);
    await student.click('#step-reliz .dicebtn');
    await student.click('#step-reliz >> text=🚀 Выпустить версию 1.0');
    await student.waitForSelector('#step-reliz.done', { timeout: 10000 });
    await student.click('#step-linza .lens-card');
    await student.waitForSelector('#step-linza.done');
    check('Урок 13: линза баланса', (await student.textContent('#step-linza .lens-face')).includes('выгодно'));
    await choice(student, 'vopros-uroka-2', 1);
    await choice(student, 'samootsenka', 5);
  }

  return { lesson9, lesson10, lesson11, lesson12, lesson13 };
};
