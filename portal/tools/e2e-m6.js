// Сквозная проверка уроков модуля 6 «Игрок в центре: мотивация, UX, этика» (23–25) — часть e2e-portal.js, вызывается из него с его помощниками.
// Общий формат уроков (как урок 1): вопрос урока, донор, «Найди спрятанную механику», объяснялка motion с переключателями, мастерская вариаций,
// квиз урока (бросок карточки, «Первая минута», охота за паттернами), Фабрика и сборка в чате Qwen с разделом «Игрок в центре», своя игра,
// «Играем вместе» (загадка дня класса, UX-аудит и «новичок с улицы», дебаты и кодекс), релиз модуля 6, линза и вопрос урока ещё раз.
'use strict';

module.exports = function m6(H) {
  const { check, gameFrame, playRound, sleep, mock, lessons } = H;
  const stepOf = (les, id) => les.checkpoints.flatMap(c => c.steps).find(s => s.id === id);

  async function open(teacher, student, les) {
    await teacher.click('.tabs >> text=Урок');
    await teacher.selectOption('#moduleSel', '6');
    await teacher.selectOption('#lessonSel', les.id);
    await teacher.waitForSelector('text=Открыть все', { timeout: 10000 });
    await teacher.click('text=Открыть все');
    await student.waitForFunction(t => document.querySelector('#lessonTitle').textContent.includes(t), `Урок ${les.number}`, { timeout: 15000 });
    await student.waitForSelector('#step-donor-play', { timeout: 15000 });
    check(`Урок ${les.number} открылся у ученика: модуль 6`, (await student.textContent('#lessonTitle')).includes(les.title));
  }
  async function choice(student, id, nth = 0) {
    await student.click(`#step-${id} .opt >> nth=${nth}`);
    await student.click(`#step-${id} >> text=Ответить`);
    await student.waitForSelector(`#step-${id}.done`);
  }
  async function frameIn(student, sel) {
    const t0 = Date.now();
    while (Date.now() - t0 < 60000) {
      const h = await student.$(sel + ' iframe');
      const fr = h && await h.contentFrame();
      if (fr && await fr.evaluate('!!(window.__lab && (window.__lab.ready || window.__lab.errored))').catch(() => false)) return fr;
      await sleep(250);
    }
    throw new Error('Рамка в ' + sel + ' не дождалась игры за 60 с');
  }
  async function donor(student, les, file, probe, first = []) {
    await choice(student, 'vopros-uroka', 3);
    for (const id of first) await choice(student, id, 0);
    await student.click('#step-donor-play .veil button');
    const gf = await gameFrame(student, file, 0);
    if (probe) await probe(gf);
    await playRound(gf, { score: 500 });
    await student.waitForSelector('#step-donor-play.done', { timeout: 10000 });
    await choice(student, 'donor-hook', 0);
  }
  async function hunt(student, les, mode, file, offCheck, counters) {
    await student.click('.cp >> nth=1');
    await student.click('#step-secret-play .veil button');
    const gf = await gameFrame(student, file, 0);
    await gf.waitForFunction(() => window.__lab.cfg.secret === 0, null, { timeout: 5000 }).catch(() => {});
    check(`Урок ${les.number}: без спрятанной механики — ручка шага`, await gf.evaluate(() => window.__lab.cfg.secret === 0));
    if (offCheck) await offCheck(gf);
    await gf.evaluate(c => { window.__lab.confirm(); for (const [k, n] of Object.entries(c)) window.__lab.lab.count(k, n); window.__lab.lab.score = 100; window.__lab.end('lose', 'Проверка'); }, counters || {});
    await student.waitForSelector('#step-secret-play.done', { timeout: 10000 });
    const h = stepOf(les, 'secret-hunt').hunt;
    const me = await student.evaluate(() => Lab.api('/api/me').then(r => JSON.stringify(r)));
    check(`Урок ${les.number}: ответ «Найди спрятанную механику» не уходит заранее`, me.includes(h.question) && !me.includes(h.reveal.slice(0, 30)));
    await student.waitForSelector('#step-secret-hunt .opt');
    await student.click(`#step-secret-hunt .opt >> text=${mode === 'mock' ? h.trap : h.right}`);
    await student.click('#step-secret-hunt >> text=Ответить');
    await student.waitForSelector('#step-secret-hunt.done');
    const rv = (await student.textContent('#step-secret-hunt')).replace(/\s+/g, ' ');
    check(`Урок ${les.number}: ${mode === 'mock' ? 'ловушка распознана' : 'спрятанная механика угадана'} — «${h.title}»`, (mode === 'mock' ? /Ловушка!/.test(rv) : /Точно!/.test(rv)) && rv.includes(h.title), rv.slice(0, 100));
  }
  // объяснялка: сцены листаются, переключатели сцены включают приём (интерактивный моушн-дизайн), холст рисует картинку
  async function motion(student, les, shot) {
    const st = stepOf(les, 'secret-story'), sel = '#step-secret-story';
    await student.waitForSelector(`${sel} canvas.m4-motion`);
    let toggled = 0;
    for (let i = 0; i < st.scenes.length; i++) {
      const sc = st.scenes[i];
      check(`Урок ${les.number}: сцена «${sc.title}»`, (await student.textContent(`${sel} .m4-cap h3`)).trim() === sc.title);
      for (const tg of sc.toggles || []) {
        await student.click(`${sel} [data-toggle=${tg.id}]`);
        if (await student.getAttribute(`${sel} [data-toggle=${tg.id}]`, 'aria-pressed') === 'true') toggled++;
      }
      if (i === 0 && shot) { await sleep(600); await shot(student, `m6-${les.number}-motion`); }
      if (i < st.scenes.length - 1) { if (i === 1) { await student.locator(`${sel} canvas.m4-motion`).focus(); await student.keyboard.press('ArrowRight'); } else await student.click(`${sel} [data-motion=next]`); }
    }
    const want = st.scenes.reduce((n, s) => n + (s.toggles || []).length, 0);
    const pix = await student.$eval(`${sel} canvas.m4-motion`, c => { const d = c.getContext('2d').getImageData(0, 0, c.width, c.height).data; const set = new Set(); for (let i = 0; i < d.length; i += 4 * 97) set.add(d[i] >> 4 << 8 | d[i + 1] >> 4 << 4 | d[i + 2] >> 4); return set.size; });
    check(`Урок ${les.number}: интерактивные сцены — переключатели включаются (${want}), холст рисует`, toggled === want && want > 0 && pix > 6, `включено ${toggled} из ${want}, оттенков ${pix}`);
    const tried = await student.evaluate(() => (S.answers['secret-story'] || {}).value || {});
    check(`Урок ${les.number}: переключатели сцен записаны в ответ шага`, Object.keys(tried.tried || {}).length >= 1, JSON.stringify(tried.tried || {}));
    await student.click(`${sel} [data-motion=next]`);
    await student.waitForSelector(`${sel}.done`);
    check(`Урок ${les.number}: после последней сцены — итог урока`, (await student.textContent(`${sel} .m4-sum`)).includes(st.sum.slice(0, 20)));
  }
  // мастерская вариаций: prep(значение) в рамке ставит состояние, из которого overNote посчитает полосу
  async function variety(student, les, file, tries, prep, statVal, fav, mixLabel, shot) {
    const vs = stepOf(les, 'variacii');
    await student.locator('#step-variacii').scrollIntoViewIfNeeded();
    await student.waitForSelector('#step-variacii [data-var]');
    check(`Урок ${les.number}: мастерская вариаций — ядро и плитки`, (await student.textContent('#step-variacii')).includes(vs.core) && await student.locator('#step-variacii [data-var]').count() === vs.variants.length);
    for (const [k, [id, knob, val]] of tries.entries()) {
      const x = vs.variants.find(y => y.id === id);
      await student.click(`#step-variacii [data-var=${id}]`);
      await student.click('#step-variacii .veil button');
      const gf = await gameFrame(student, file, 0);
      await gf.waitForFunction(([kn, vl]) => window.__lab.cfg[kn] === vl, [knob, val], { timeout: 5000 }).catch(() => {});
      check(`Вариация «${x.label}» включила свои ручки`, await gf.evaluate(([kn, vl]) => window.__lab.cfg[kn] === vl, [knob, val]));
      await gf.evaluate(`(() => { window.__lab.confirm(); const L = window.__lab.lab, st = L.state; (${prep})(L, st, ${statVal}); L.score = 200; window.__lab.end('lose', 'Проверка'); })()`);
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
    check(`Доска вариаций урока ${les.number}: четыре игры и своя полоса`, await student.locator('#step-variacii .var-row').count() === 4 && board.includes(vs.meter.text.replace('{v}', String(statVal).replace('.', ','))), board.slice(0, 160));
    if (shot) await shot(student, `m6-${les.number}-variacii`, true);
    await student.click(`#step-variacii [data-fav=${fav}]`);
    await student.waitForSelector('#step-variacii.done', { timeout: 10000 });
    await student.click(`#step-variacii [data-mix="${mixLabel}"]`);
    check(`Конструктор вариации урока ${les.number}`, (await student.textContent('#step-variacii .pickline')).includes(mixLabel));
  }
  // квиз-бросок: первая карточка — мимо (разбор и «сюда»), остальные — в цель; итог по персонажам
  async function brosok(student, les, id, shot) {
    const st = stepOf(les, id), sel = `#step-${id}`;
    await student.locator(sel).scrollIntoViewIfNeeded();
    await student.waitForSelector(`${sel} .m6-brosok[data-phase=aim]`);
    for (let k = 0; k < st.items.length; k++) {
      await student.waitForFunction(s => document.querySelector(s + ' .m6-brosok').getAttribute('data-phase') === 'aim', sel, { timeout: 10000 });
      const idx = Number(await student.getAttribute(`${sel} .m6-brosok`, 'data-brosok-item'));
      const right = st.items[idx].target, wrong = st.targets.find(t => t.id !== right).id;
      if (k === 0) await student.click(`${sel} [data-throw=${wrong}]`);
      else if (k === 1) { await student.locator(`${sel} canvas.m6-brosokcv`).focus(); await student.keyboard.press(String(st.targets.findIndex(t => t.id === right) + 1)); }
      else await student.click(`${sel} [data-throw=${right}]`);
      await student.waitForSelector(`${sel} [data-brosok=next]:not([hidden])`, { timeout: 10000 });
      if (k === 0) {
        check(`Урок ${les.number}: бросок мимо — разбор и подсказка, кому это`, /Не совсем/.test(await student.textContent(`${sel} .m6-why`)) && await student.locator(`${sel} .m6-tbtn.good`).count() === 1);
        if (shot) await shot(student, `m6-${les.number}-brosok`);
      }
      await student.click(`${sel} [data-brosok=next]`);
    }
    await student.waitForSelector(`${sel}.done`, { timeout: 10000 });
    const res = (await student.textContent(`${sel} .m6-result h2`)).replace(/\s+/g, ' ');
    check(`Квиз урока ${les.number} ${st.title.replace(/^Квиз /, '')}: итог и полоски по персонажам`, res.includes(`Попаданий ${st.items.length - 1} из ${st.items.length}`) && await student.locator(`${sel} .m6-bar`).count() === st.targets.length, res);
  }
  // Фабрика, решения, ИГРА, сборка: задание Qwen с разделом «Игрок в центре»
  async function build(student, les, mode, title, demoCheck) {
    await student.click('.cp >> text=Фабрика');
    await student.click('#step-fabrika >> text=🎲 Кубик для пустых полей');
    await student.fill('#f-fabrikatitle', title);
    await student.click('#step-fabrika >> text=Замысел готов');
    await student.waitForSelector('#step-fabrika.done');
    await student.fill('#f-resheniyafeeling', 'Догадался сам и хочу ещё');
    await student.click('#step-resheniya .field:has(#f-resheniyahonesty) .cardopt >> nth=0');
    await student.click('#step-resheniya .field:has(#f-resheniyachoice) .cardopt >> nth=0');
    await student.click('#step-resheniya >> text=Решения приняты');
    await student.waitForSelector('#step-resheniya.done');
    const preview = (await student.textContent('#step-igra .preview-igra')).replace(/\s+/g, ' ');
    check(`Урок ${les.number}: ИГРА — готовый промпт с названием`, preview.includes(title), preview.slice(0, 90));
    await student.click('#step-igra button:has-text("Всё верно")');
    await student.waitForSelector('#step-igra.done');
    await student.click('#step-sborka >> text=⚙ Собрать игру');
    let own = await gameFrame(student, '/play/', 0);
    if (mode === 'mock') {
      const t = mock.last.newUser || '';
      check(`Задание Qwen урока ${les.number}: замысел и раздел «Игрок в центре» урока`, /# Замысел геймдизайнера/.test(t) && /# Игрок в центре/.test(t) && t.includes(les.player.slice(0, 40)) && /# Картинка/.test(t), t.slice(t.indexOf('# Игрок'), t.indexOf('# Игрок') + 90));
      await own.evaluate(() => window.__lab.confirm());
      await student.waitForFunction(() => document.querySelectorAll('#step-sborka .ver').length >= 2, null, { timeout: 30000 });
      own = await gameFrame(student, '/play/', 0);
    } else if (demoCheck) check(`Демо-режим урока ${les.number}: игра ученика — донор урока с его названием`, await own.evaluate(demoCheck, title));
    await student.waitForSelector('#step-sborka.done', { timeout: 10000 });
    const card = await student.evaluate(id => Lab.api('/api/arcade').then(r => r.mine.find(c => c.lesson && c.lesson.id === id)), les.id);
    check(`Игра урока ${les.number} в аркаде`, card && card.title === title, card ? card.title : 'нет карточки');
  }
  async function ownPlay(student) {
    await student.click('.cp >> text=Своя игра');
    await student.click('#step-ruchki .veil button');
    const own = await gameFrame(student, '/play/', 0);
    await playRound(own, { score: 120 });
    await student.click('#step-ruchki [data-match="Частично"]');
    await student.waitForSelector('#step-ruchki.done', { timeout: 10000 });
  }
  async function final(student, les, lensWord, extra) {
    await student.click('.cp >> text=Финал');
    if (extra) await extra();
    await student.click('#step-linza .lens-card');
    await student.waitForSelector('#step-linza.done');
    check(`Урок ${les.number}: линза урока переворачивается`, (await student.textContent('#step-linza .lens-face')).includes(lensWord));
    await choice(student, 'vopros-uroka-2', 3);
    check(`Урок ${les.number}: вопрос урока в начале и в конце, 180 минут`, les.checkpoints.reduce((a, c) => a + c.minutes, 0) === 180 && !!les.question);
  }

  /* ---------------- урок 23 ---------------- */
  async function lesson23(mode, teacher, student, shot) {
    const les = lessons[23];
    await open(teacher, student, les);
    await donor(student, les, 'uzor-dnya', async gf => {
      const r = await gf.evaluate(async () => {
        window.__lab.confirm(); const L = window.__lab.lab, st = L.state;
        const ans = st.answer.slice(), other = [...Array(st.kinds).keys()].filter(k => !ans.includes(k));
        const marks = GAME.score(ans, [ans[1], other[0], ans[2], other[1], ans[4]]);
        return { len: ans.length, tries: st.tries, daily: st.daily, marks, day: st.day, same: JSON.stringify(GAME.makeAnswer(L, st)) === JSON.stringify(ans) };
      });
      check('Донор урока 23: узор дня из пяти знаков за шесть попыток, цвет у каждой плитки, узор из даты — один на всех', r.len === 5 && r.tries === 6 && r.daily && r.same && JSON.stringify(r.marks) === JSON.stringify([1, 0, 2, 0, 2]), JSON.stringify(r));
    }, ['stikery']);
    await hunt(student, les, mode, 'uzor-dnya', async gf => {
      const r = await gf.evaluate(() => { const st = window.__lab.lab.state; return { color: st.color, daily: st.daily, share: st.share }; });
      check('Без спрятанной механики: только числа, новый узор, без сетки', !r.color && !r.daily && !r.share, JSON.stringify(r));
    }, { 'попытки': 6 });
    await motion(student, les, shot);
    await variety(student, les, 'uzor-dnya', [['chisla', 'color', 0], ['beskonechnaya', 'daily', 0], ['tajmer', 'timer', 20], ['gonka', 'race', 1]],
      '(L, st, v) => { st.rows = Array.from({ length: v }, () => ({ guess: [], marks: [] })); }', 4, 'chisla', 'Только числа', shot);
    await brosok(student, les, 'komu', shot);
    await build(student, les, mode, 'Рецепт дня', t => GAME.title === t && !!window.__lab.lab.state.answer);
    await ownPlay(student);
    // загадка дня класса: автор дня — игра урока; узор решается, сетка уходит в галерею. Игра без сетки — сетка вставляется руками
    await student.click('.cp >> text=Играем вместе');
    await student.waitForSelector('#step-zagadka-dnya .gamebox', { timeout: 15000 });
    const head = (await student.textContent('#step-zagadka-dnya .m6-dayhead')).replace(/\s+/g, ' ');
    check('Загадка дня класса: дата и автор дня', /Загадка дня/.test(head), head.slice(0, 120));
    await student.click('#step-zagadka-dnya .veil button');
    const gf = await frameIn(student, '#step-zagadka-dnya');
    const isUzor = await gf.evaluate(() => !!(window.GAME && GAME.title && window.__lab.lab.state && window.__lab.lab.state.answer !== undefined) || (typeof GAME !== 'undefined' && !!GAME.makeAnswer)).catch(() => false);
    if (isUzor) {
      const day = await gf.evaluate(() => { window.__lab.confirm(); const L = window.__lab.lab, st = L.state; st.rows.push({ guess: [], marks: st.answer.map((_, i) => (i % 2 ? 1 : 0)) }); st.row = 1; st.guess = st.answer.slice(); const win = { guess: st.guess, marks: st.answer.map(() => 2) }; st.rows.push(win); GAME.afterRow(L, win); return st.day; }); // как в игре: ряд в rows, потом afterRow; без анимации переворота — без видеокарты она идёт десятки секунд
      check('Загадка дня: зерно — дата, у всех одна (lab.data.day)', /^\d{8}$/.test(day) && day === (await student.evaluate(() => { const d = new Date(); return '' + d.getFullYear() + String(d.getMonth() + 1).padStart(2, '0') + String(d.getDate()).padStart(2, '0'); })), day);
    } else {
      await gf.evaluate(() => { window.__lab.confirm(); window.__lab.lab.score = 300; window.__lab.end('lose', 'Проверка'); });
      await student.waitForSelector('#step-zagadka-dnya textarea.m6-gridin', { state: 'visible', timeout: 15000 });
      await student.fill('#step-zagadka-dnya textarea.m6-gridin', '🟨⬛⬛🟩⬛\n🟩🟩⬛🟩🟨\n🟩🟩🟩🟩🟩');
      await student.click('#step-zagadka-dnya [data-setka=paste]');
    }
    await student.waitForSelector('#step-zagadka-dnya.done', { timeout: 60000 });
    await student.waitForSelector('#step-zagadka-dnya .m6-gcard .sq', { timeout: 15000 });
    // сетка цветом (🟩) или числами («5● 0○» — игра без цвета подсказок): и то и другое без спойлеров
    const sq = await student.locator('#step-zagadka-dnya .m6-gcard .sq.g').count();
    const nums = await student.locator('#step-zagadka-dnya .m6-gcard .sq.num').allTextContents();
    check(`Загадка дня: моя сетка в галерее класса — плитки без спойлеров (${isUzor ? 'сетка из игры' : 'вставлена руками'})`, sq >= 5 || nums.some(t => /^[1-9]\d*●/.test(t)), `зелёных плиток ${sq}, чисел: ${nums.join(' ')}`);
    if (shot) { await sleep(800); await shot(student, 'm6-23-setka'); }
    // учитель видит квиз-бросок на проекторе «Ответы класса»
    const poll = await teacher.evaluate(c => Lab.api('/api/teacher/poll?code=' + encodeURIComponent(c)), (await teacher.textContent('#classCode')).trim());
    const komu = poll.steps.find(s => s.id === 'komu');
    check('«Ответы класса»: квиз «Кому это понравится?» — доля верных по типам игроков', komu && komu.bars.length === 4 && komu.n >= 1, komu ? JSON.stringify(komu.bars.map(b => b.show)) : 'нет');
    await final(student, les, 'игрока', async () => {
      await student.waitForSelector('#step-portret .m6-pcard');
      await student.click('#step-portret .field:has(#f-portretkto) .cardopt >> nth=0');
      await student.click('#step-portret .field:has(#f-portretlyubit) .cardopt >> nth=0');
      await student.click('#step-portret [data-ptype=issl]');
      await student.click('#step-portret [data-portrait=save]');
      await student.waitForSelector('#step-portret.done');
      check('Портрет игрока: два поля, тип и живая карточка', /Портрет сохранён/.test(await student.textContent('#step-portret [data-portrait=save]')));
    });
  }

  /* ---------------- урок 24 ---------------- */
  async function lesson24(mode, teacher, student, shot) {
    const les = lessons[24];
    await open(teacher, student, les);
    await donor(student, les, 'ogorod-pod-zashchitoy', async gf => {
      const r = await gf.evaluate(() => {
        window.__lab.confirm(); const L = window.__lab.lab, st = L.state;
        const before = { lanes: st.lanes.slice(), cards: GAME.unlocked(st).map(k => k.id), queue: st.queue.length, wait: st.waitPlant, hint: st.hintCard };
        st.cur = [1, 2]; GAME.plant(L);
        return Object.assign(before, { planted: st.defs.length, waitAfter: st.waitPlant, sun: st.sun, learned: !!st.learned.shoot });
      });
      check('Донор урока 24: день 1 — одна грядка и одна карта, враг ждёт посадки, подсказка ведёт к орехомёту', r.lanes.length === 1 && r.cards.length === 1 && r.wait && r.hint === 'shoot' && r.planted === 1 && r.learned, JSON.stringify(r));
    });
    await hunt(student, les, mode, 'ogorod-pod-zashchitoy', async gf => {
      const r = await gf.evaluate(() => { const st = window.__lab.lab.state; return { lanes: st.lanes.length, cards: GAME.unlocked(st).length, wall: st.wall }; });
      check('Без спрятанной механики: пять грядок, пять карт и стена текста', r.lanes === 5 && r.cards === 5 && r.wall, JSON.stringify(r));
    }, { 'грядки потеряны': 2 });
    await motion(student, les, shot);
    await variety(student, les, 'ogorod-pod-zashchitoy', [['vse-srazu', 'allAtOnce', 1], ['stena', 'textWall', 1], ['shum', 'clutter', 1], ['kontrast', 'contrast', 1]],
      '(L, st, v) => { st.firstPlant = v; }', 7, 'vse-srazu', 'Всё сразу', shot);
    // «Первая минута»: три записи — запустить, отметить, к разбору
    const pm = stepOf(les, 'pervaya');
    await student.locator('#step-pervaya').scrollIntoViewIfNeeded();
    for (let i = 0; i < pm.clips.length; i++) {
      await student.click('#step-pervaya [data-minuta=play]');
      await sleep(400);
      await student.click('#step-pervaya [data-minuta=mark]');
      await student.click('#step-pervaya [data-minuta=skip]');
      await student.waitForSelector('#step-pervaya .m6-timeline .lost');
      if (i === 0) { check('Первая минута: разбор — настоящие моменты на шкале и причины', await student.locator('#step-pervaya .m6-timeline .lost').count() === pm.clips[0].lost.length && /секунда/.test(await student.textContent('#step-pervaya .m6-lostlist'))); if (shot) await shot(student, 'm6-24-minuta'); }
      if (i < pm.clips.length - 1) await student.click('#step-pervaya [data-minuta=next]');
    }
    await student.waitForSelector('#step-pervaya.done', { timeout: 10000 });
    check('Квиз «Первая минута»: все три записи разобраны', true);
    await build(student, les, mode, 'Пасека под защитой', t => GAME.title === t && Array.isArray(window.__lab.lab.state.lanes));
    await ownPlay(student);
    // UX-аудит: игра соседа или донор, «думай вслух», 10 пунктов, главная находка; «новичок с улицы» — два замера
    await student.click('.cp >> text=Играем вместе');
    await student.waitForSelector('#step-audit [data-audit=goal]', { timeout: 30000 });
    const au = stepOf(les, 'audit');
    for (const it of au.items) { await student.click(`#step-audit [data-audit=${it.id}]`); if (it.id === 'pause') await student.click(`#step-audit [data-audit=${it.id}]`); }
    await student.click('#step-audit [data-think="🤔 Не понял"]');
    await student.click('#step-audit [data-top=pause]');
    await student.click('#step-audit [data-audit=send]');
    await student.waitForSelector('#step-audit.done', { timeout: 10000 });
    check('UX-аудит: 9 из 10, главная находка — пауза, штамп «думай вслух»', (await student.textContent('#step-audit .m6-ring')).includes('9') && await student.locator('#step-audit .m6-stamp').count() >= 1);
    if (shot) await shot(student, 'm6-24-audit');
    await student.click('#step-novichok [data-sek=start]'); await sleep(700); await student.click('#step-novichok [data-sek=stop]');
    await student.click('#step-novichok [data-sek=start]'); await sleep(300); await student.click('#step-novichok [data-sek=stop]');
    await student.waitForSelector('#step-novichok.done', { timeout: 10000 });
    check('«Новичок с улицы»: два замера и гонка полос', await student.locator('#step-novichok .m6-race .lane').count() === 2 && /быстрее/.test(await student.textContent('#step-novichok')));
    const poll = await teacher.evaluate(c => Lab.api('/api/teacher/poll?code=' + encodeURIComponent(c)), (await teacher.textContent('#classCode')).trim());
    check('«Ответы класса»: аудит — где игры класса проваливаются, и секунды «новичка с улицы»', poll.steps.some(s => s.id === 'audit' && s.bars[0].n >= 1) && poll.steps.some(s => s.id === 'novichok' && s.n >= 1));
    await final(student, les, 'первой минуты');
  }

  /* ---------------- урок 25 ---------------- */
  async function lesson25(mode, teacher, student, shot) {
    const les = lessons[25];
    await open(teacher, student, les);
    await donor(student, les, 'eshchyo-razok', async gf => {
      const r = await gf.evaluate(() => {
        window.__lab.confirm(); const L = window.__lab.lab, st = L.state;
        for (let i = 0; i < 5; i++) GAME.tap(L);
        GAME.startEvent(L, 'fomo', 8); GAME.tap(L);
        return { evil: st.evil, taps: st.taps, pulls: st.pulls, patterns: GAME.PATTERNS.filter(p => st.on(p.id)).length };
      });
      check('Донор урока 25: кликер с семью тёмными паттернами, таймер «×3» ловит нажатие', r.evil && r.patterns === 7 && r.taps === 6 && r.pulls === 1, JSON.stringify(r));
    });
    await hunt(student, les, mode, 'eshchyo-razok', async gf => {
      const r = await gf.evaluate(() => { const st = window.__lab.lab.state; return { evil: st.evil, gems: st.gems }; });
      check('Без спрятанной механики: честная версия — без кристаллов и паттернов', !r.evil && r.gems === 0, JSON.stringify(r));
    }, { 'ещё разок': 0 });
    await motion(student, les, shot);
    // охота за паттернами в ремейке: пять пойманы — карты переворачиваются, на обороте честная замена
    await student.locator('#step-ohota').scrollIntoViewIfNeeded();
    await student.click('#step-ohota .veil button');
    const hf = await frameIn(student, '#step-ohota');
    const hr = await hf.evaluate(() => { window.__lab.confirm(); const L = window.__lab.lab, st = L.state; const out = { hunt: st.hunt, order: st.order.length }; ['fomo', 'box', 'friends', 'gems', 'noexit'].forEach(id => { st.ev = null; GAME.startEvent(L, id, 8); GAME.catchIt(L); }); st.ev = null; GAME.catchIt(L); out.left = st.huntLeft; st.huntLeft = 0.05; return out; });
    check('Охота: семь паттернов по одному, мимо — минус 5 секунд', hr.hunt && hr.order === 7 && hr.left < 96, JSON.stringify(hr));
    await student.waitForSelector('#step-ohota.done', { timeout: 30000 });
    check('Охота: пять карт найдены и перевёрнуты лицом', await student.locator('#step-ohota .m6-dcard.got').count() === 5);
    await student.click('#step-ohota [data-pattern=fomo]');
    check('Охота: карта переворачивается на честную замену', await student.locator('#step-ohota .m6-dcard.honest[data-pattern=fomo]').count() === 1);
    if (shot) { await sleep(700); await shot(student, 'm6-25-ohota'); }
    await variety(student, les, 'eshchyo-razok', [['tajmer', 'p_box', 0], ['sunduk', 'p_box', 1], ['druzya', 'p_friends', 1], ['valyuty', 'p_gems', 1]],
      '(L, st, v) => { st.pulls = v; }', 3, 'sunduk', 'Без сундука', shot);
    await brosok(student, les, 'chestno', shot);
    // своя игра: игра прошлого урока (23 или 24) — в этот урок, правки пойдут в копию
    await student.click('.cp >> text=Злая и честная версии');
    await student.waitForSelector('#step-moya [data-adopt]', { timeout: 15000 });
    const prev = await student.locator('#step-moya .m6-acard').count();
    if (prev) await student.click('#step-moya .m6-acard >> nth=0'); else await student.click('#step-moya [data-adopt=remake]');
    await student.waitForSelector('#step-moya.done', { timeout: 15000 });
    const adopted = await student.evaluate(id => Lab.api('/api/arcade').then(r => r.mine.find(c => c.lesson && c.lesson.id === id)), les.id);
    check(`Своя игра прошлого урока — в уроке 25 (${prev ? 'игра урока 23/24' : 'донор'}), оригинал не тронут`, adopted && adopted.version >= 1, adopted ? `${adopted.title} v${adopted.version}` : 'нет');
    await student.waitForSelector('#step-zlaya .gamebox', { timeout: 20000 });
    // обмен и дебаты, кодекс
    await student.click('.cp >> text=Играем вместе');
    await student.click('#step-debaty [data-pos="before:-1"]');
    await student.waitForSelector('#step-debaty .m6-rope', { timeout: 10000 });
    await student.click('#step-debaty [data-arg=left] >> nth=0'); await student.click('#step-debaty [data-arg=right] >> nth=1');
    await student.click('#step-debaty [data-pos="after:1"]');
    await student.waitForSelector('#step-debaty.done');
    await student.waitForFunction(() => /после: [1-9]/.test(document.querySelector('#step-debaty').textContent), null, { timeout: 15000 });
    check('Дебаты: позиция до и после, канат класса и облако аргументов', await student.locator('#step-debaty .m6-cloud span').count() >= 2 && /сдвинулся/.test(await student.textContent('#step-debaty')));
    const ks = stepOf(les, 'kodeks');
    for (let i = 0; i < ks.pick; i++) await student.click(`#step-kodeks [data-rule] >> nth=${i}`);
    await student.click('#step-kodeks [data-kodeks=send]');
    await student.waitForSelector('#step-kodeks [data-kodeks=sign]:not([disabled])', { timeout: 15000 });
    await student.click('#step-kodeks [data-kodeks=sign]');
    await student.waitForSelector('#step-kodeks.done');
    await student.waitForSelector('#step-kodeks .m6-scroll .stamp', { timeout: 10000 });
    await student.waitForFunction(() => document.querySelectorAll('#step-kodeks .sigs .sig').length > 0, null, { timeout: 20000 }).catch(() => {});
    check('Кодекс класса: свиток с правилами, подпись и штамп', await student.locator('#step-kodeks .m6-scroll li').count() >= ks.pick && await student.locator('#step-kodeks .sigs .sig').count() > 0);
    if (shot) { await sleep(1200); await shot(student, 'm6-25-kodeks'); }
    const poll = await teacher.evaluate(c => Lab.api('/api/teacher/poll?code=' + encodeURIComponent(c)), (await teacher.textContent('#classCode')).trim());
    const db = poll.steps.find(s => s.id === 'debaty');
    check('«Ответы класса»: дебаты до и после, кодекс класса', db && db.compare && poll.steps.some(s => s.id === 'kodeks' && s.bars.length >= ks.pick), db ? JSON.stringify(db.bars.map(b => [b.before, b.n])) : 'нет');
    // релиз модуля 6
    await student.click('.cp >> text=Релиз модуля 6');
    await student.waitForSelector('#step-reliz .seg .opt', { timeout: 15000 });
    const ev = (await student.textContent('#step-reliz .checklist')).replace(/\s+/g, ' ');
    check('Релиз модуля 6: чек-лист про аудит, обучение, доступность и честность', /UX-аудит/.test(ev) && /доступности/.test(ev) && /тёмных паттернов/.test(ev), ev.slice(0, 140));
    for (const it of stepOf(les, 'reliz').checklist) await student.click(`#step-reliz .check[data-check="${it.id}"]`);
    await student.click('#step-reliz .dicebtn');
    await student.click('#step-reliz >> text=🚀 Выпустить версию 1.0');
    await student.waitForSelector('#step-reliz.done', { timeout: 10000 });
    await final(student, les, 'уважения');
  }

  return { lesson23, lesson24, lesson25 };
};
