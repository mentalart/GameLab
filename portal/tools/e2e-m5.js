// Сквозная проверка уроков модуля 5 «Истории, миры, смыслы» (19–22) — часть e2e-portal.js, вызывается из него с его помощниками.
// Общий формат уроков (как урок 1 и модуль 4): вопрос урока, донор, «Найди спрятанную механику», объяснялка motion, мастерская вариаций
// с полосой урока, квиз (дерево-бусы-хаб, «Что здесь случилось?», «Найди лишнее», чувства механик), Фабрика и сборка в чате Qwen,
// своя игра, «Играем вместе» (коллекция финалов, плейтест с первым вопросом «Детектив», фоторежим), релиз модуля 5, линза и вопрос урока ещё раз.
'use strict';
const m4 = require('./e2e-m4');

module.exports = function m5(H) {
  const { check, gameFrame, playRound, sleep, mock, lessons } = H;
  const { open, choice, donor, hunt, huntFmt, paper, sabotage, zagadka, gost, tapi, motion, variety } = m4(Object.assign({}, H, { lessons: {} })).helpers;
  const stepOf = (les, id) => les.checkpoints.flatMap(c => c.steps).find(s => s.id === id);
  // финал: линза и вопрос урока ещё раз; чекпоинт ищем по точному названию — «финалы» встречаются и в замысле, и в «Играем вместе» урока 19
  async function final(student, les, lensWord) {
    await student.click('.cp >> text="Финал"');
    await student.click('#step-linza .lens-card');
    await student.waitForSelector('#step-linza.done');
    check(`Урок ${les.number}: линза урока переворачивается`, (await student.textContent('#step-linza .lens-face')).includes(lensWord));
    await choice(student, 'vopros-uroka-2', 3);
    check(`Урок ${les.number}: вопрос урока в начале и в конце, 180 минут`, les.checkpoints.reduce((a, c) => a + c.minutes, 0) === 180 && !!les.question);
  }

  // сравнение двух партий после «Найди спрятанную механику»: подписи партий и счётчик урока
  async function compare(student, les, counter) {
    const h = stepOf(les, 'secret-hunt').hunt, rv = (await student.textContent('#step-secret-hunt')).replace(/\s+/g, ' ');
    check(`Урок ${les.number}: сравнение партий «${h.compare.onLabel}» и «${h.compare.offLabel}» со счётчиком «${counter}»`, rv.includes(h.compare.onLabel) && rv.includes(h.compare.offLabel) && rv.includes(counter), rv.slice(rv.indexOf(h.compare.onLabel), rv.indexOf(h.compare.onLabel) + 160));
  }
  // квиз-сортировщик с разбором и «Далее»: в mock — все карточки, в демо — три
  async function sort(student, les, mode, id = 'kviz') {
    const quiz = stepOf(les, id), binOf = t => quiz.items.find(i => i.text === t).bin;
    await student.click(`#step-${id} >> text=▶ Начать`);
    check(`Урок ${les.number}: квиз «${quiz.title.replace(/^Квиз «?|»$/g, '')}» — лотки с примерами`, await student.locator(`#step-${id} .bin small`).count() === quiz.bins.length);
    for (let i = 0; i < (mode === 'mock' ? quiz.items.length : 3); i++) {
      const text = (await student.textContent(`#step-${id} .item`)).trim();
      await student.keyboard.press('Digit' + (quiz.bins.findIndex(b => b.id === binOf(text)) + 1));
      await student.click(`#step-${id} [data-next]`);
      await student.waitForFunction(([sel, t]) => { const it = document.querySelector(sel + ' .item'); return !it || it.textContent.trim() !== t || document.querySelector(sel + '.done'); }, [`#step-${id}`, text], { timeout: 10000 });
    }
    if (mode === 'mock') {
      await student.waitForSelector(`#step-${id}.done`);
      check(`Урок ${les.number}: квиз пройден без ошибок`, new RegExp(`${quiz.items.length} из ${quiz.items.length}`).test(await student.textContent(`#step-${id}`)));
    }
  }
  // Фабрика (донор на выбор, кубик, «Замысел готов»), решения, ИГРА, сборка в чате Qwen
  async function build(student, les, mode, title, want, demoCheck, donorId) {
    await student.click('.cp >> text=Фабрика');
    if (donorId) await student.click(`#step-fabrika [data-donor=${donorId}]`);
    await student.click('#step-fabrika >> text=🎲 Кубик для пустых полей');
    await student.fill('#f-fabrikatitle', title);
    await student.click('#step-fabrika >> text=Замысел готов');
    await student.waitForSelector('#step-fabrika.done');
    await student.fill('#f-resheniyafeeling', 'Сам понял, что здесь было');
    await student.click('#step-resheniya .field:has(#f-resheniyahonesty) .cardopt >> nth=0');
    await student.click('#step-resheniya .field:has(#f-resheniyachoice) .cardopt >> nth=0');
    await student.click('#step-resheniya >> text=Решения приняты');
    await student.waitForSelector('#step-resheniya.done');
    const preview = (await student.textContent('#step-igra .preview-igra')).replace(/\s+/g, ' ');
    check(`Урок ${les.number}: ИГРА — промпт с названием и ${want.label}`, preview.includes(title) && want.re.test(preview), preview.slice(0, 140));
    await student.click('#step-igra button:has-text("Всё верно")');
    await student.waitForSelector('#step-igra.done');
    if (H.producer) await H.producer(student, les, mode);
    await student.click('#step-sborka >> text=⚙ Собрать игру');
    let own = await gameFrame(student, '/play/', 0);
    if (mode === 'mock') {
      const t = mock.last.newUser || '';
      check(`Задание Qwen урока ${les.number}: замысел и ${want.label}`, /# Замысел геймдизайнера/.test(t) && want.re.test(t) && /# Картинка/.test(t), t.slice(0, 80));
      await own.evaluate(() => window.__lab.confirm());
      await student.waitForFunction(() => document.querySelectorAll('#step-sborka .ver').length >= 2, null, { timeout: 30000 });
      own = await gameFrame(student, '/play/', 0);
    } else if (demoCheck) check(`Демо-режим урока ${les.number}: игра ученика — донор урока с его названием`, await own.evaluate(demoCheck, title));
    await student.waitForSelector('#step-sborka.done', { timeout: 10000 });
    const card = await student.evaluate(id => Lab.api('/api/arcade').then(r => r.mine.find(c => c.lesson && c.lesson.id === id)), les.id);
    check(`Игра урока ${les.number} в аркаде, донор — ${les.donor}`, card && card.title === title, card ? `${card.title} · ${card.donor}` : 'нет карточки');
  }
  // своя игра: партия и «Совпало?»
  async function ownplay(student, les) {
    await student.click('.cp >> text=Своя игра');
    await student.click('#step-ruchki .veil button');
    const own = await gameFrame(student, '/play/', 0);
    await own.evaluate(() => { window.__lab.confirm(); window.__lab.lab.score = 120; window.__lab.end('lose', 'Проверка'); });
    await student.click('#step-ruchki [data-match="Частично"]');
    await student.waitForSelector('#step-ruchki.done', { timeout: 10000 });
    check(`Урок ${les.number}: своя игра — партия и «Совпало с задуманным?»`, true);
  }
  // шаг play на доноре внутри «Играем вместе»: fn — проверки в рамке, потом партия заканчивается
  async function playStep(student, id, file, fn) {
    await student.click(`#step-${id} .veil button`);
    const gf = await gameFrame(student, file, 0);
    const r = fn ? await fn(gf) : null;
    await gf.evaluate(() => { if (window.__lab.state !== 'over') { window.__lab.lab.score = Math.max(window.__lab.lab.score, 7); window.__lab.end('lose', 'Проверка'); } });
    return { gf, r };
  }
  // плейтест с первым вопросом ask: рядом с открытием своей игры — замысел автора из Фабрики
  async function askCard(student, les) {
    const st = stepOf(les, 'pleytest');
    await student.click('.cp >> text=Играем вместе');
    await student.waitForSelector('#step-pleytest', { timeout: 10000 });
    check(`Урок ${les.number}: плейтест с первым вопросом «${st.ask.label}» и колодой ответов`, !!st.ask && st.decks.story.length >= 4 && st.predict.length >= 1);
  }

  // второй ученик в своём окне собирает игру урока одной кнопкой «⚙ Собрать сейчас» (с подставным Qwen) — зал музея, игра для карусели
  async function neighbour({ browser, base, code, errors }, nick, title) {
    const ctx = await browser.newContext({ viewport: { width: 1280, height: 900 } });
    await ctx.addInitScript(() => { window.LAB_ASK_AUTO = true; window.LAB_FAST = true; window.LAB_LOWRES = true; });
    const nb = await ctx.newPage();
    if (H.watch) H.watch(nb, errors);
    await nb.goto(base + '/?code=' + code);
    await nb.fill('#nick', nick);
    await nb.click('#studentForm button[type=submit]');
    await nb.waitForURL('**/student');
    await nb.click('.cp >> text=Фабрика');
    await nb.fill('#f-fabrikatitle', title);
    await nb.click('#step-fabrika >> text=⚙ Собрать сейчас');
    const f = await gameFrame(nb, '/play/', 0);
    await f.evaluate(() => window.__lab.confirm());
    await nb.waitForFunction(() => document.querySelectorAll('#step-sborka .ver').length >= 2, null, { timeout: 30000 });
    return { nb, ctx };
  }
  // Г5 карусель: до запуска учителем — ожидание; с одной игрой урока в классе не запускается
  async function karuselWait(student, teacher, les) {
    await student.waitForSelector('#step-karusel .m2-wait', { timeout: 10000 });
    check(`Урок ${les.number}: карусель ждёт учителя`, /Карусель запустит учитель/.test(await student.textContent('#step-karusel')));
    const err = await tapi(teacher, '/api/teacher/karusel', { code: await teacher.evaluate('T.code'), action: 'start' }).then(() => '', e => e.message);
    check(`Урок ${les.number}: карусель с одной игрой урока не запускается`, /хотя бы две/.test(err), err);
  }

  /* ---------------- урок 19 ---------------- */
  async function lesson19(mode, teacher, student, shot) {
    const les = lessons[19];
    await open(teacher, student, les);
    await donor(student, les, 'stareyshina', async gf => {
      await gf.evaluate(() => window.__lab.confirm());
      await sleep(300);
      const info = await gf.evaluate(() => ({ secret: window.__lab.cfg.secret, scales: window.__lab.lab.state.scales.length, deck: GAME.DECK.length, endings: GAME.ENDINGS.length, card: window.__lab.lab.state.card && window.__lab.lab.state.card.id }));
      // ← склоняет, пробел решает: пришла новая карта
      await gf.locator('#cv').focus();
      await gf.waitForFunction(() => window.__lab.lab.state.cardAge >= window.__lab.cfg.lock, null, { timeout: 5000 }).catch(() => {});
      await student.keyboard.press('ArrowLeft'); await sleep(150); await student.keyboard.press('Space');
      await gf.waitForFunction(id => { const c = window.__lab.lab.state.card; return c && c.id !== id; }, info.card, { timeout: 10000 }).catch(() => {});
      info.next = await gf.evaluate(() => window.__lab.lab.state.card && window.__lab.lab.state.card.id);
      // решения «вправо» подряд: карта-последствие возвращается через несколько карт
      info.back = await gf.evaluate(async () => {
        const L = window.__lab.lab;
        for (let i = 0; i < 14; i++) {
          if (L.state.card && L.state.card.back) return i;
          if (L.state.ended) return -2;
          GAME.decide(L, 'right');
          await window.__lab.frames(30);
        }
        return -1;
      });
      check('Донор урока 19: четыре шкалы, колода и финалы, спрятанная механика включена', info.secret === 1 && info.scales === 4 && info.deck >= 30 && info.endings >= 8, JSON.stringify(info));
      check('Решение с клавиатуры: ← склоняет, пробел решает — пришла новая карта', info.card && info.next && info.next !== info.card, `${info.card} → ${info.next}`);
      check('Карты помнят решения: последствие вернулось через несколько карт', info.back >= 1, `карт до последствия: ${info.back}`);
    });
    // Г1 совет аула: учитель ведёт карты на проекторе, класс голосует с ноутбуков, решение возвращается картой-последствием
    const sv = stepOf(les, 'sovet'), code = await teacher.evaluate('T.code');
    await student.waitForSelector('#step-sovet .m2-wait', { timeout: 10000 });
    check('Совет аула: до начала — ожидание учителя и шкалы', /Совет откроет учитель/.test(await student.textContent('#step-sovet')) && await student.locator('#step-sovet .m47-scale').count() === sv.scales.length);
    await tapi(teacher, '/api/teacher/sovet', { code, step: 'sovet', action: 'start' });
    const votes = [['kuz', 'left'], ['past', 'right'], ['kupec', 'left']];
    for (const [card, side] of votes) {
      await student.waitForSelector(`#step-sovet [data-sovet=${side}]`, { timeout: 15000 });
      check(`Совет аула: на столе карта «${sv.cards.find(c => c.id === card).who}»`, (await student.textContent('#step-sovet .m47-card')).includes(sv.cards.find(c => c.id === card).text.slice(0, 20)));
      await student.click(`#step-sovet [data-sovet=${side}]`);
      await student.waitForSelector(`#step-sovet [data-sovet=${side}][aria-pressed=true]`, { timeout: 10000 });
      if (card === 'kuz') check('Совет: голос учтён, ученик видит голоса класса', /класс: ← 1 · 0 →/.test(await student.textContent('#step-sovet')));
      await tapi(teacher, '/api/teacher/sovet', { code, action: 'decide' });
    }
    await student.waitForSelector('#step-sovet .m47-card.echo', { timeout: 15000 });
    const sx = await student.evaluate(() => Lab.api('/api/sovet').then(r => r.sovet));
    check('Совет: отказ кузнецу вернулся картой-последствием, шкалы сдвинулись', sx.card.id === 'kuz-ushel' && sx.card.echo && sx.log.length === 3 && sx.scales.join() === '50,50,70,30', JSON.stringify({ card: sx.card.id, scales: sx.scales }));
    if (shot) await shot(student, 'm5-19-sovet', true);
    await student.click(`#step-sovet .opt >> text=${sv.options[0]}`);
    await student.click('#step-sovet >> text=Ответить');
    await student.waitForSelector('#step-sovet.done', { timeout: 10000 });
    check('Совет: после трёх голосов — вопрос и разбор', (await student.textContent('#step-sovet')).includes(sv.after.slice(0, 30)));
    const end = (await tapi(teacher, '/api/teacher/sovet', { code, action: 'decide' })).sovet;
    check('Совет: «Решить» у учителя — следующий сезон', end.season === 5 && end.log[3].card === 'kuz-ushel', JSON.stringify({ season: end.season, phase: end.phase }));
    await tapi(teacher, '/api/teacher/sovet', { code, action: 'reset' });
    await hunt(student, les, mode, 'stareyshina', async gf => {
      const r = await gf.evaluate(async () => {
        window.__lab.confirm(); const L = window.__lab.lab; let back = 0;
        for (let i = 0; i < 14 && !L.state.ended; i++) { if (L.state.card && L.state.card.back) back++; GAME.decide(L, 'right'); await window.__lab.frames(30); }
        return { back };
      });
      check('Без спрятанной механики карты забывают: ни одного последствия', r.back === 0, JSON.stringify(r));
      await gf.evaluate(() => window.__lab.restart());
    }, { 'решения': 6 });
    await compare(student, les, 'последствия');
    await motion(student, les, 'secret-story', shot);
    // Г3 бумажная игра: ветвящаяся история на стикерах, лист урока для печати
    await paper(student, les, 'stikery', teacher);
    if (shot) await shot(student, 'm5-19-stikery', true);
    await variety(student, les, 'stareyshina', [['vslepuyu', 'hints', 0], ['vremya', 'timer', 6], ['zima', 'winter', 1], ['dinastiya', 'lives', 3]], 'последствия', 5, 'dinastiya', 'Вслепую', shot);
    await sort(student, les, mode);
    await build(student, les, mode, 'Капитан Луны', { label: 'карты-последствия', re: /карту-последствие/ }, t => GAME.title === t && !!GAME.DECK);
    await ownplay(student, les);
    // коллекция финалов: партия доходит до финала, он записан в коллекцию
    await student.click('.cp >> text=Играем вместе');
    const { gf } = await playStep(student, 'kollekciya', 'stareyshina', async f => {
      await f.evaluate(() => window.__lab.confirm());
      await sleep(300);
      const r = await f.evaluate(async () => {
        const L = window.__lab.lab;
        for (let i = 0; i < 80 && !L.state.ended; i++) { GAME.decide(L, 'left'); await window.__lab.frames(30); }
        await window.__lab.frames(120);
        return { ended: !!L.state.ended, found: GAME.FOUND.size };
      });
      check('Коллекция финалов: партия дошла до финала, он в коллекции', r.ended && r.found >= 1, JSON.stringify(r));
      if (shot) await shot(student, 'm5-19-final');
      return r;
    });
    await gf.evaluate(() => window.__lab.restart());
    await sleep(400);
    await gf.evaluate(() => window.__lab.end('lose', 'Проверка'));
    await student.waitForSelector('#step-kollekciya.done', { timeout: 10000 });
    await final(student, les, 'последствий');
  }

  /* ---------------- урок 20 ---------------- */
  async function lesson20(mode, teacher, student, shot, env) {
    const les = lessons[20];
    await open(teacher, student, les);
    await donor(student, les, 'cherdak', async gf => {
      const r = await gf.evaluate(() => {
        window.__lab.confirm();
        const L = window.__lab.lab, st = L.state, item = GAME.take(L);
        const wrong = st.slots.findIndex((s, i) => i !== GAME.rightSlot(L) && !s.item);
        const missed = wrong >= 0 ? GAME.drop(L, wrong) : null;
        const ok = GAME.drop(L, GAME.rightSlot(L));
        return { secret: window.__lab.cfg.secret, item: item && item.k, story: !!(item && item.story), missed, ok, placed: st.placed, hand: !!st.hand };
      });
      check('Донор урока 20: вещь из коробки — в руку, не туда — осталась в руке, на своё место — легла', r.secret === 1 && r.item && r.missed === false && r.ok === true && r.placed === 1 && !r.hand, JSON.stringify(r));
      check('Первая вещь первой коробки — вещь с историей', r.story);
    });
    // Г1 загадка: три кадра одной комнаты — что здесь случилось?
    await zagadka(student, les);
    if (shot) await shot(student, 'm5-20-zagadka', true);
    // Г2 рецепт: три приёма истории без слов, один лишний
    await huntFmt(student, les, mode, async () => check('Рецепт урока 20: три приёма на выбор', await student.locator('#step-secret-hunt .opt').count() === 3));
    await motion(student, les, 'secret-story', shot);
    await variety(student, les, 'cherdak', [['osmotr', 'inspect', 1], ['fonarik', 'dark', 1], ['kot', 'cat', 1], ['dvavremeni', 'past', 1]], 'истории', 5, 'kot', 'Осмотреть', shot);
    // квиз «Что здесь случилось?»: открыт один кадр из трёх, пробел — ещё кадр, ошибка — все кадры и разбор
    const kv = stepOf(les, 'kviz');
    await student.click('#step-kviz >> text=▶ Начать');
    check('Квиз «Что здесь случилось?»: открыт один кадр из трёх', await student.locator('#step-kviz .cframe.on').count() === 1 && await student.locator('#step-kviz .cframe').count() === 3);
    for (let i = 0; i < (mode === 'mock' ? kv.rounds.length : 2); i++) {
      const place = (await student.textContent('#step-kviz h3')).trim(), rd = kv.rounds.find(x => x.place === place);
      if (i === 0) { await student.keyboard.press('Space'); check('Пробел открывает второй кадр', await student.locator('#step-kviz .cframe.on').count() === 2); }
      const opts = await student.$$eval('#step-kviz .opts .opt', bs => bs.map(b => b.textContent));
      const k = i === 1 ? opts.findIndex(o => !o.includes(rd.answer)) : opts.findIndex(o => o.includes(rd.answer));
      await student.keyboard.press('Digit' + (k + 1));
      await student.waitForSelector('#step-kviz .why b');
      if (i === 1) { check('Квиз: ошибка — все кадры открыты и разбор', await student.locator('#step-kviz .cframe.on').count() === 3 && (await student.textContent('#step-kviz .why')).includes(rd.why)); if (shot) await shot(student, 'm5-20-clues'); }
      await student.keyboard.press('Enter');
    }
    if (mode === 'mock') {
      await student.waitForSelector('#step-kviz.done');
      const res = (await student.textContent('#step-kviz')).replace(/\s+/g, ' ');
      check('Квиз «Что здесь случилось?» пройден: итог и угаданные с одного кадра', new RegExp(`${kv.rounds.length - 1} из ${kv.rounds.length}`).test(res) && /С одного кадра угадано: [1-9]/.test(res), res.slice(0, 120));
    }
    await build(student, les, mode, 'Комната деда', { label: 'правило «текста нет»', re: /Текста о событии в игре нет/ }, t => GAME.title === t && !!GAME.take);
    await ownplay(student, les);
    // Г4 музей класса: комнаты класса — залы, гость оставляет записку, она приходит автору в книгу отзывов
    const mz = stepOf(les, 'muzei');
    const nbr = mode === 'mock' && env ? await neighbour(env, 'Хранительница', 'Комната бабушки') : null;
    await student.click('.cp >> text=Играем вместе');
    await student.waitForSelector('#step-muzei .m47-halls, #step-muzei .m2-wait', { timeout: 15000 });
    if (!nbr) check('Музей: без чужих комнат — «Залы ещё готовятся»', /Залы ещё готовятся|План музея/.test(await student.textContent('#step-muzei')));
    else {
      await student.waitForSelector('#step-muzei [data-hall]', { timeout: 15000 });
      check('Музей: план с залом соседки, свой зал — внизу', (await student.textContent('#step-muzei .m47-halls')).includes('Комната бабушки') && /Твой зал «Комната деда»/.test(await student.textContent('#step-muzei')));
      const hallId = await student.getAttribute('#step-muzei [data-hall]', 'data-hall');
      await student.click('#step-muzei [data-hall]');
      await student.click('#step-muzei .veil button');
      const hall = await gameFrame(student, `/play/${hallId}/`, 0);
      await playRound(hall, { score: 30 });
      await student.click(`#step-muzei .cardopt >> text=${mz.deck[0]}`);
      await student.click('#step-muzei .emo >> nth=0');
      await student.click('#step-muzei [data-muzei=send]');
      await student.waitForSelector('#step-muzei.done', { timeout: 10000 });
      check('Музей: записка оставлена, зал отмечен — шаг готов', /записка оставлена/.test(await student.textContent('#step-muzei .m47-halls')));
      const note = await nbr.nb.evaluate(() => Lab.api('/api/arcade').then(r => (r.mine.find(c => c.lesson && c.lesson.id === 'urok-20') || {}).discovery));
      check('Музей: записка гостя пришла автору зала', note && (note.cards || []).some(c => c.story && c.story.text === mz.deck[0]), JSON.stringify(note).slice(0, 160));
      if (shot) await shot(student, 'm5-20-muzei', true);
      await nbr.ctx.close();
    }
    await final(student, les, 'окружения');
  }

  /* ---------------- урок 21 ---------------- */
  async function lesson21(mode, teacher, student, shot) {
    const les = lessons[21];
    await open(teacher, student, les);
    await donor(student, les, 'spusk-s-fishta', async gf => {
      await gf.evaluate(() => window.__lab.confirm());
      await gf.locator('#cv').focus();
      const t0 = await gf.evaluate(() => window.__lab.lab.t);
      await gf.waitForFunction(t => window.__lab.lab.t > t + 0.6, t0, { timeout: 30000 });
      await student.keyboard.press('Space');
      await gf.waitForFunction(() => window.__lab.lab.state.hero.air, null, { timeout: 5000 }).catch(() => {});
      const r = await gf.evaluate(() => ({ secret: window.__lab.cfg.secret, air: !!window.__lab.lab.state.hero.air, dist: window.__lab.lab.state.dist, moods: GAME.MOODS.length, colors: GAME.MOODS[0].colors.length }));
      check('Донор урока 21: спуск, прыжок с клавиатуры, настроения мира по пять цветов', r.secret === 1 && r.air && r.dist > 0 && r.moods >= 4 && r.colors === 5, JSON.stringify(r));
    });
    // Г1 спор: два мира одного спуска — какой лучше
    const spor = stepOf(les, 'spor');
    for (const side of spor.sides) {
      if (side.id === 'B') await student.waitForSelector('#step-spor [data-side=B].on', { timeout: 10000 });
      await student.click('#step-spor .veil button');
      await student.waitForFunction(() => [...document.querySelectorAll('iframe')].some(f => /spusk-s-fishta/.test(f.src)), null, { timeout: 10000 });
      const sf = await gameFrame(student, 'spusk-s-fishta', 0);
      await sf.waitForFunction(s => window.__lab.cfg.secret === s, side.cfg.secret === 0 ? 0 : 1, { timeout: 5000 }).catch(() => {});
      check(`Спор урока 21: ${side.label} — ${side.cfg.secret === 0 ? 'мир вразнобой' : 'цельный мир'}`, await sf.evaluate(s => window.__lab.cfg.secret === s, side.cfg.secret === 0 ? 0 : 1));
      await sf.evaluate(() => window.__lab.confirm());
      await sleep(300);
      await sf.evaluate(() => { window.__lab.lab.score = 90; window.__lab.end('lose', 'Проверка'); });
    }
    await student.waitForSelector('#step-spor [data-pick=B]', { timeout: 10000 });
    await student.click('#step-spor [data-pick=B]');
    await student.click(`#step-spor [data-why="${spor.reasons[0]}"]`);
    await student.click('#step-spor [data-vote=go]');
    await student.waitForSelector('#step-spor.done', { timeout: 10000 });
    check('Спор урока 21: голос и разбор', (await student.textContent('#step-spor')).includes(spor.after.slice(0, 30)));
    // Г2 детектив: графики падений двух спусков
    const h21 = stepOf(les, 'secret-hunt').hunt;
    await huntFmt(student, les, mode, async () => check('Детектив урока 21: графики двух спусков', await student.locator('#step-secret-hunt .m1-graphs svg').count() === h21.graphs.length));
    await motion(student, les, 'secret-story', shot);
    await variety(student, les, 'spusk-s-fishta', [['noch', 'mood', 1], ['buran', 'mood', 3], ['noir', 'mood', 5], ['dzen', 'zen', 1]], 'смены', 5, 'noir', 'Ночь', shot);
    // квиз «Найди лишнее»: в загадке ручка odd, ответ — после нескольких секунд спуска
    const blind = stepOf(les, 'lishnee');
    await student.click('#step-lishnee .veil button');
    const gf = await gameFrame(student, 'spusk-s-fishta', 0);
    await gf.waitForFunction(() => window.__lab.cfg.odd > 0, null, { timeout: 5000 }).catch(() => {});
    check('Найди лишнее: в загадке подложена одна деталь', await gf.evaluate(o => window.__lab.cfg.odd === o, blind.rounds[0].cfg.odd));
    for (let r = 0; r < (mode === 'mock' ? blind.rounds.length : 1); r++) {
      await student.waitForFunction(() => !document.querySelector('#step-lishnee .opts .opt.dim'), null, { timeout: 30000 });
      const rd = blind.rounds[r];
      const opts = await student.$$eval('#step-lishnee .opts .opt', bs => bs.map(b => b.textContent));
      const pick = r === 0 ? opts.find(o => o !== rd.answer) : rd.answer;
      await student.click(`#step-lishnee .opts .opt >> text="${pick}"`);
      await student.waitForSelector('#step-lishnee .verdict');
      if (r === 0) { check('Найди лишнее: ошибка — разбор', (await student.textContent('#step-lishnee')).includes(rd.why)); if (shot) await shot(student, 'm5-21-lishnee'); }
      if (mode === 'mock') await student.click('#step-lishnee .btn >> text=/Следующая загадка|Итог/');
    }
    if (mode === 'mock') {
      await student.waitForSelector('#step-lishnee.done', { timeout: 10000 });
      check('Квиз «Найди лишнее» пройден', new RegExp(`Угадано ${blind.rounds.length - 1} из ${blind.rounds.length}`).test(await student.textContent('#step-lishnee .blind h2')));
    }
    await build(student, les, mode, 'Байдарка по Белой', { label: 'библия мира', re: /Библия мира: палитра/ }, t => GAME.title === t && !!GAME.MOODS);
    await ownplay(student, les);
    // фоторежим в дзен-режиме: Shift замораживает мир
    await student.click('.cp >> text=Играем вместе');
    await playStep(student, 'foto', 'spusk-s-fishta', async f => {
      await f.waitForFunction(() => window.__lab.cfg.zen === 1, null, { timeout: 5000 }).catch(() => {});
      await f.evaluate(() => window.__lab.confirm());
      await f.locator('#cv').focus();
      await sleep(500);
      await student.keyboard.press('Shift');
      await f.waitForFunction(() => window.__lab.lab.state.photo, null, { timeout: 5000 }).catch(() => {});
      const ph = await f.evaluate(async () => { const d0 = window.__lab.lab.state.dist; await window.__lab.frames(20); return { zen: window.__lab.cfg.zen, photo: !!window.__lab.lab.state.photo, still: window.__lab.lab.state.dist === d0 }; });
      check('Фоторежим: дзен-режим, Shift — мир замер', ph.zen === 1 && ph.photo && ph.still, JSON.stringify(ph));
      if (shot) await shot(student, 'm5-21-foto');
    });
    await student.waitForSelector('#step-foto.done', { timeout: 10000 });
    await karuselWait(student, teacher, les);
    await final(student, les, 'целостности');
  }

  /* ---------------- урок 22 ---------------- */
  async function lesson22(mode, teacher, student, shot) {
    const les = lessons[22];
    await open(teacher, student, les);
    await donor(student, les, 'rostok', async gf => {
      const r = await gf.evaluate(async () => {
        window.__lab.confirm();
        const L = window.__lab.lab, p = L.state.plant, w0 = p.water;
        GAME.water(L, 2);
        const w1 = p.water;
        for (let i = 0; i < 10 && p.water >= w1; i++) await window.__lab.frames(30);
        return { secret: window.__lab.cfg.secret, w0, w1, dry: p.water < w1, water: p.water, day: L.state.day };
      });
      check('Донор урока 22: росток сохнет, полив наполняет', r.secret === 1 && r.w1 > r.w0 && r.dry && r.day === 1, JSON.stringify(r));
    });
    // Г1 гость урока: Кен Вонг, Florence
    await gost(student, les, mode, shot);
    // Г2 саботаж: учитель тайно меняет одно правило ростка
    await sabotage(student, teacher, les, mode);
    await motion(student, les, 'secret-story', shot);
    await variety(student, les, 'rostok', [['vina', 'greed', 1], ['tamagochi', 'wilt', 1], ['nadezhda', 'gray', 1], ['proshchanie', 'farewell', 1]], 'отклик', 5, 'nadezhda', 'Спешка', shot);
    await sort(student, les, mode);
    await build(student, les, mode, 'Дорога в аул', { label: 'правила Passage и тихий финал', re: /Герой идёт по узкой полосе.*без победы и поражения/ }, t => GAME.title === t && !!GAME.water, 'passage');
    await ownplay(student, les);
    await askCard(student, les);
    // релиз модуля 5: на выбор игры уроков модуля
    await student.click('.cp >> text=Релиз модуля 5');
    await student.waitForSelector('#step-reliz .seg .opt');
    const ev = (await student.textContent('#step-reliz .checklist')).replace(/\s+/g, ' ');
    check('Релиз модуля 5: чек-лист про историю, правила и цельный мир', /понятны без объяснений автора/.test(ev) && /Мир цельный/.test(ev), ev.slice(0, 120));
    for (const it of stepOf(les, 'reliz').checklist) await student.click(`#step-reliz .check[data-check="${it.id}"]`);
    await student.click('#step-reliz .dicebtn');
    await student.click('#step-reliz >> text=🚀 Выпустить версию 1.0');
    await student.waitForSelector('#step-reliz.done', { timeout: 10000 });
    if (shot) await shot(student, 'm5-22-release', true);
    await final(student, les, 'смысла');
    await H.rost(student, 5, 4);
  }

  return { lesson19, lesson20, lesson21, lesson22 };
};
