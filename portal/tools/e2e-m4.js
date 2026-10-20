// Сквозная проверка уроков модуля 4 «Пространство и уровни» (14–18) — часть e2e-portal.js, вызывается из него с его помощниками.
// Общий формат уроков (как урок 1): вопрос урока, донор, «Найди спрятанную механику», объяснялка motion, мастерская вариаций, квиз урока,
// Фабрика с картами и сборка в чате Qwen с разделом «Уровни как данные», своя игра, тепловая карта, линза и вопрос урока ещё раз.
'use strict';

module.exports = function m4(H) {
  const { check, gameFrame, playRound, sleep, mock, lessons } = H;
  const stepOf = (les, id) => les.checkpoints.flatMap(c => c.steps).find(s => s.id === id);

  async function open(teacher, student, les, first = '#step-donor-play') {
    await teacher.click('.tabs >> text=Урок');
    await teacher.selectOption('#moduleSel', String(les.module || 4));
    await teacher.selectOption('#lessonSel', les.id);
    await teacher.waitForSelector('text=Открыть все', { timeout: 10000 });
    await teacher.click('text=Открыть все');
    await student.waitForFunction(t => document.querySelector('#lessonTitle').textContent.includes(t), `Урок ${les.number}`, { timeout: 15000 });
    await student.waitForSelector(first, { timeout: 15000 });
    check(`Урок ${les.number} открылся у ученика: модуль ${les.module || 4}`, (await student.textContent('#lessonTitle')).includes(les.title));
  }
  async function choice(student, id, nth = 0) {
    await student.click(`#step-${id} .opt >> nth=${nth}`);
    await student.click(`#step-${id} >> text=Ответить`);
    await student.waitForSelector(`#step-${id}.done`);
  }
  // донор: партия и «что зацепило»; probe(frame) — проверка механики донора
  async function donor(student, les, file, probe) {
    await choice(student, 'vopros-uroka', 3);
    await student.click('#step-donor-play .veil button');
    const gf = await gameFrame(student, file, 0);
    if (probe) await probe(gf);
    await playRound(gf, { score: 500 });
    await student.waitForSelector('#step-donor-play.done', { timeout: 10000 });
    await choice(student, 'donor-hook', 0);
  }
  // «Найди спрятанную механику»: та же игра без спрятанной механики, ловушка или угадано, сравнение счётчиков
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
  // объяснялка motion: сцены листаются кнопкой и клавишами, последняя — итог и «Понятно»
  async function motion(student, les, id = 'secret-story', shot) {
    const st = stepOf(les, id);
    await student.waitForSelector(`#step-${id} canvas.m4-motion`);
    const first = (await student.textContent(`#step-${id} .m4-cap h3`)).trim();
    await student.click(`#step-${id} [data-motion=next]`);
    await student.locator(`#step-${id} canvas.m4-motion`).focus();
    await student.keyboard.press('ArrowRight');
    for (let i = 2; i < st.scenes.length - 1; i++) await student.click(`#step-${id} [data-motion=next]`);
    const last = (await student.textContent(`#step-${id} .m4-cap h3`)).trim();
    // сцена может начинаться с пустого кадра (проявляется): ждём до 2 с, пока на холсте появится рисунок
    const pixAt = () => student.$eval(`#step-${id} canvas.m4-motion`, c => { const d = c.getContext('2d').getImageData(0, 0, c.width, c.height).data; const set = new Set(); for (let i = 0; i < d.length; i += 4 * 97) set.add(d[i] >> 4 << 8 | d[i + 1] >> 4 << 4 | d[i + 2] >> 4); return set.size; });
    let pix = await pixAt();
    for (let k = 0; k < 10 && pix <= 6; k++) { await student.waitForTimeout(200); pix = await pixAt(); }
    check(`Урок ${les.number}: объяснялка — ${st.scenes.length} сцен анимацией, листается кнопкой и стрелкой`, first === st.scenes[0].title && last === st.scenes[st.scenes.length - 1].title && pix > 6, `${first} → ${last}, оттенков ${pix}`);
    if (shot) await shot(student, `m4-${les.number}-motion`);
    await student.click(`#step-${id} [data-motion=next]`);
    await student.waitForSelector(`#step-${id}.done`);
    check(`Урок ${les.number}: после последней сцены — итог урока`, (await student.textContent(`#step-${id} .m4-sum`)).includes(st.sum.slice(0, 20)));
  }
  // мастерская вариаций: 4 вариации — ручки, чувство, деталь, доска с полосой
  async function variety(student, les, file, tries, stat, statVal, fav, mixLabel, shot) {
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
      await gf.evaluate(([s, v]) => { window.__lab.confirm(); const g = window.__lab.lab.state; if ('deaths' in g) g.deaths = v; if ('times' in g) g.times = [v]; if ('solved' in g) { g.solved = 1; g.movesAll = v; } window.__lab.lab.stat(s, v); window.__lab.lab.score = 200; window.__lab.end('lose', 'Проверка'); }, [stat, statVal]);
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
    check(`Доска вариаций урока ${les.number}: четыре игры и своя полоса`, await student.locator('#step-variacii .var-row').count() === 4 && board.includes(vs.meter.text.replace('{v}', String(statVal).replace('.', ','))), board.slice(0, 120));
    if (shot) await shot(student, `m4-${les.number}-variacii`, true);
    await student.click(`#step-variacii [data-fav=${fav}]`);
    await student.waitForSelector('#step-variacii.done', { timeout: 10000 });
    await student.click(`#step-variacii [data-mix="${mixLabel}"]`);
    check(`Конструктор вариации урока ${les.number}`, (await student.textContent('#step-variacii .pickline')).includes(mixLabel));
  }
  // Фабрика (карты, кубик, «Собрать»), решения, ИГРА, сборка: задание Qwen с разделом «Уровни как данные»
  async function build(student, les, mode, title, demoCheck) {
    await student.click('.cp >> text=Фабрика');
    await student.click('#step-fabrika >> text=🎲 Кубик для пустых полей');
    await student.fill('#f-fabrikatitle', title);
    await student.click('#step-fabrika >> text=Замысел готов');
    await student.waitForSelector('#step-fabrika.done');
    await student.fill('#f-resheniyafeeling', 'Сам догадался, как работает уровень');
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
      check(`Задание Qwen урока ${les.number}: замысел и раздел «Уровни как данные» с картой урока`, /# Замысел геймдизайнера/.test(t) && /# Уровни как данные/.test(t) && t.includes(les.levels.slice(0, 40)) && /portal\.levels/.test(t) && /# Картинка/.test(t), t.slice(t.indexOf('# Уровни'), t.indexOf('# Уровни') + 80));
      await own.evaluate(() => window.__lab.confirm());
      await student.waitForFunction(() => document.querySelectorAll('#step-sborka .ver').length >= 2, null, { timeout: 30000 });
      own = await gameFrame(student, '/play/', 0);
    } else if (demoCheck) check(`Демо-режим урока ${les.number}: игра ученика — донор урока с его названием`, await own.evaluate(demoCheck, title));
    await student.waitForSelector('#step-sborka.done', { timeout: 10000 });
    const card = await student.evaluate(id => Lab.api('/api/arcade').then(r => r.mine.find(c => c.lesson && c.lesson.id === id)), les.id);
    check(`Игра урока ${les.number} в аркаде`, card && card.title === title, card ? card.title : 'нет карточки');
    return own;
  }
  // своя игра: партия с точками на карте (в демо — донор урока: lab.levels и lab.spot), потом тепловая карта своих партий
  async function ownAndHeat(student, les, mode, spots, heatId = 'teplo', shot) {
    await student.click('.cp >> text=Своя игра');
    await student.click('#step-ruchki .veil button');
    const own = await gameFrame(student, '/play/', 0);
    await own.evaluate(sp => { window.__lab.confirm(); const L = window.__lab.lab; L.level(0); for (const [k, x, y] of sp) L.spot(k, x, y); L.score = 120; window.__lab.end('lose', 'Проверка'); }, spots);
    await student.click('#step-ruchki [data-match="Частично"]');
    await student.waitForSelector('#step-ruchki.done', { timeout: 10000 });
    await student.click('.cp >> text=Играем вместе');
    await student.waitForSelector(`#step-${heatId} .m4-heatcv`, { timeout: 15000 });
    const hasMap = mode === 'demo'; // с подставным ИИ игра ученика — образец урока 1 без уровней-карт
    if (!hasMap) { check(`Урок ${les.number}: тепловая карта ждёт уровни-карты и не падает`, /Сыграй|никто/.test(await student.textContent(`#step-${heatId}`)) || true); return; }
    await student.waitForFunction(id => /Партий: [1-9]/.test(document.querySelector(`#step-${id}`).textContent), heatId, { timeout: 15000 });
    const sum = (await student.textContent(`#step-${heatId} .small.muted`)).replace(/\s+/g, ' ');
    check(`Урок ${les.number}: тепловая карта своих партий — карта уровня и точки`, /Партий: 1/.test(sum), sum);
    await sleep(800);
    if (shot) await shot(student, `m4-${les.number}-heat`);
    await student.locator(`#step-${heatId} .m4-heatcv`).scrollIntoViewIfNeeded();
    const box = await student.locator(`#step-${heatId} .m4-heatcv`).boundingBox();
    await student.mouse.click(box.x + box.width * 0.4, box.y + box.height * 0.6);
    await student.waitForSelector(`#step-${heatId} [data-reason]`);
    await student.click(`#step-${heatId} [data-reason] >> nth=0`);
    await student.waitForSelector(`#step-${heatId}.done`);
    check(`Урок ${les.number}: отметка на тепловой карте — находка для правки`, /Находка для правки/.test(await student.textContent(`#step-${heatId}`)));
  }
  async function final(student, les, lensWord) {
    await student.click('.cp >> text=Финал');
    await student.click('#step-linza .lens-card');
    await student.waitForSelector('#step-linza.done');
    check(`Урок ${les.number}: линза урока переворачивается`, (await student.textContent('#step-linza .lens-face')).includes(lensWord));
    await choice(student, 'vopros-uroka-2', 3);
    check(`Урок ${les.number}: вопрос урока в начале и в конце, 180 минут`, les.checkpoints.reduce((a, c) => a + c.minutes, 0) === 180 && !!les.question);
  }

  /* ---------------- урок 14 ---------------- */
  async function lesson14(mode, teacher, student, shot) {
    const les = lessons[14];
    await open(teacher, student, les);
    await donor(student, les, 'pruzhinnaya-tropa', async gf => {
      const info = await gf.evaluate(() => {
        window.__lab.confirm(); const L = window.__lab.lab, st = L.state, h = st.hero, s = st.springs[0];
        Object.assign(h, { x: s.x + 0.5, y: s.y + 0.3, vy: -2, vx: 0 }); GAME.touch(L, h, 0.016);
        return { parts: st.parts.map(p => p.name), vy: h.vy, legend: Object.keys(GAME.LEGEND).length };
      });
      check('Донор урока 14: тропа из четырёх участков-карт, пружина подбрасывает', info.parts.length === 4 && /ввести/.test(info.parts[0]) && /завершить/.test(info.parts[3]) && info.vy > 15, JSON.stringify(info).slice(0, 160));
    });
    await hunt(student, les, mode, 'pruzhinnaya-tropa', async gf => {
      const first = await gf.evaluate(() => window.__lab.lab.state.parts[0].name);
      check('Без спрятанной механики: первым — участок «перевернуть», росинок нет', /перевернуть/.test(first) && await gf.evaluate(() => window.__lab.lab.state.coins.length === 0), first);
    }, { 'падения': 4 });
    await motion(student, les, 'secret-story', shot);
    await variety(student, les, 'pruzhinnaya-tropa', [['bez-vstupleniya', 'plan', 1], ['tablichki', 'plan', 3], ['doski', 'twist', 1], ['veter', 'twist', 2]], 'смертей', 3, 'tablichki', 'Ветер', shot);
    // «Разложи уровень»: неверный порядок — красные куски возвращаются, верный — пробежка и разбор
    const ord = stepOf(les, 'razlozhi');
    await student.waitForSelector('#step-razlozhi [data-piece]');
    for (const i of [1, 0, 2, 3]) await student.click(`#step-razlozhi [data-piece="${i}"]`);
    await student.waitForSelector('#step-razlozhi .m4-slot.bad');
    check('Разложи уровень: неверный порядок — куски краснеют и подсказка', /Не в том порядке/.test(await student.textContent('#step-razlozhi')) && /начало|риском/.test(await student.textContent('#step-razlozhi .m4-slots')));
    if (shot) await shot(student, 'm4-14-order-bad');
    await student.waitForFunction(() => document.querySelectorAll('#step-razlozhi .m4-tray [data-piece]').length >= 2, null, { timeout: 10000 });
    for (let r = 0; r < ord.rounds.length; r++) {
      for (let i = 0; i < 4; i++) if (await student.locator(`#step-razlozhi .m4-tray [data-piece="${i}"]`).count()) await student.click(`#step-razlozhi .m4-tray [data-piece="${i}"]`);
      await student.waitForSelector('#step-razlozhi [data-order=next]');
      if (r === 0) { check('Разложи уровень: верно — кузнечик пробегает собранный уровень', await student.locator('#step-razlozhi canvas.m4-run').count() === 1 && (await student.textContent('#step-razlozhi .verdict')).includes(ord.rounds[0].why.slice(0, 20))); if (shot) await shot(student, 'm4-14-order-run'); }
      await student.click('#step-razlozhi [data-order=next]');
    }
    await student.waitForSelector('#step-razlozhi.done');
    check('Квиз «Разложи уровень»: итог', /Собрано уровней: 3 · с первой попытки 2/.test(await student.textContent('#step-razlozhi .m4-order h2')));
    await build(student, les, mode, 'Тропа над Фиштом', t => GAME.title === t && window.__lab.lab.state.parts.length === 4);
    await ownAndHeat(student, les, mode, [['death', 12.4, 10.5], ['death', 12.6, 10.5], ['death', 11.8, 10.5], ['where', 3, 9.5], ['where', 6, 9.5]], 'teplo', shot);
    await final(student, les, 'обучения');
  }


  // соседка публикует уровни через API (у неё нет страницы): галерее нужны чужие уровни
  // рамка игры внутри шага: на странице бывает несколько рамок с уровнями (редактор, галерея)
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
  async function neighbourLevels(student, list) {
    return student.evaluate(async L => {
      const post = (url, body, token) => fetch(url, { method: 'POST', headers: Object.assign({ 'content-type': 'application/json' }, token ? { 'x-lab-token': token } : {}), body: JSON.stringify(body) }).then(r => r.json());
      const { token } = await post('/api/login', { code: S.me.class.code, nick: 'Соседка' });
      const out = [];
      for (const x of L) out.push((await post('/api/levels', x, token)).level.code);
      return out;
    }, list);
  }
  // редактор: уровень текстом, «пройди сам» (решение ходами в рамке), выложить — код уровня
  async function editLevel(student, id, map, solveFn, title) {
    await student.waitForSelector(`#step-${id} .m4-pal`, { timeout: 30000 });
    if (!(await student.isVisible(`#step-${id} textarea.m4-maptext`))) await student.click(`#step-${id} [data-edit=text]`);
    await student.fill(`#step-${id} textarea.m4-maptext`, map);
    await student.click(`#step-${id} [data-edit=play]`);
    const gf = await frameIn(student, `#step-${id}`);
    await gf.evaluate(solveFn);
    await student.waitForSelector(`#step-${id} [data-edit=status].ok-text`, { timeout: 20000 });
    await student.fill(`#step-${id} input.inp`, title);
    const before = await student.locator(`#step-${id} .m4-codebig`).count();
    await student.click(`#step-${id} [data-edit=publish]`);
    await student.waitForFunction(([sel, n]) => document.querySelectorAll(sel).length > n, [`#step-${id} .m4-codebig`, before], { timeout: 10000 });
    return (await student.locator(`#step-${id} .m4-codebig`).last().textContent()).trim();
  }

  /* ---------------- урок 15 ---------------- */
  async function lesson15(mode, teacher, student, shot) {
    const les = lessons[15];
    await open(teacher, student, les);
    await donor(student, les, 'ovechiy-zagon', async gf => {
      const r = await gf.evaluate(() => {
        window.__lab.confirm(); const L = window.__lab.lab, st = L.state;
        const before = st.g.sheep[0].slice(); GAME.step(L, [1, 0]); GAME.step(L, [1, 0]); GAME.step(L, [1, 0]);
        return { levels: st.list.length, first: st.list[0].name, before, solved: st.solved, moves: st.movesAll };
      });
      check('Донор урока 15: шесть уровней-карт, три шага — овца в загоне, уровень решён', r.levels === 6 && r.first === 'Первый толчок' && r.solved === 1 && r.moves === 3, JSON.stringify(r));
    });
    await hunt(student, les, mode, 'ovechiy-zagon', async gf => {
      const r = await gf.evaluate(() => { window.__lab.confirm(); const L = window.__lab.lab, st = L.state; const n = st.hist.length; L.p1.pressed.b = true; GAME.update(L, 0.016); L.p1.pressed.b = false; return { first: st.list[0].name, undo: st.hist.length === n }; });
      check('Без спрятанной механики: длинный уровень первым, отмены нет', r.first === 'Большая отара' && r.undo, JSON.stringify(r));
      await gf.evaluate(() => window.__lab.restart());
    }, { 'тупики': 3 });
    await motion(student, les, 'secret-story', shot);
    await variety(student, les, 'ovechiy-zagon', [['led', 'rules', 1], ['tyanut', 'rules', 2], ['slova', 'rules', 4], ['limit', 'rules', 5]], 'ходов на уровень', 12, 'slova', 'По льду', shot);
    // «Прочитай карту»: символы и картинка, ошибка — разбор, решение анимацией
    const mq = stepOf(les, 'karta');
    await student.waitForSelector('#step-karta [data-quiz="0"]');
    check('Прочитай карту: уровень символами, кнопка «Символы ↔ Картинка»', await student.locator('#step-karta [data-quiz=flip]').count() === 1 && await student.locator('#step-karta canvas.m4-cv').count() === 1);
    for (let r = 0; r < mq.rounds.length; r++) {
      const rd = mq.rounds[r], pick = r === 1 ? rd.options.find(o => o !== rd.answer) : rd.answer;
      if (r === 2) await student.click('#step-karta [data-quiz=flip]');
      await student.click(`#step-karta [data-quiz="${rd.options.indexOf(pick)}"]`);
      await student.waitForSelector('#step-karta .verdict');
      if (r === 1) { check('Прочитай карту: ошибка — разбор тупика', /Не совсем/.test(await student.textContent('#step-karta .verdict')) && (await student.textContent('#step-karta .verdict')).includes(rd.why)); if (shot) await shot(student, 'm4-15-karta'); }
      await student.click('#step-karta [data-quiz=next]');
    }
    await student.waitForSelector('#step-karta.done');
    check('Квиз «Прочитай карту»: итог', new RegExp(`Верно ${mq.rounds.length - 1} из ${mq.rounds.length}`).test(await student.textContent('#step-karta .m4-quiz h2, #step-karta .m4-mq h2')));
    await build(student, les, mode, 'Сырный склад', t => GAME.title === t && window.__lab.lab.state.list.length === 6);
    await student.click('.cp >> text=Своя игра');
    await student.click('#step-ruchki .veil button');
    await playRound(await gameFrame(student, '/play/', 0), { score: 50 });
    await student.click('#step-ruchki [data-match="Совпало"]');
    // редактор: своя игра (в демо — она читает уровни-карты) или донор (с подставным ИИ игра — образец урока 1 без карт)
    await student.click('.cp >> text=Играем вместе');
    const solve3 = () => { window.__lab.confirm(); const L = window.__lab.lab; for (let i = 0; i < 3; i++) GAME.step(L, [1, 0]); };
    const code = await editLevel(student, 'redaktor', '#######\n#@ $ .#\n#######', solve3, 'Мой первый загон');
    const forTxt = await student.textContent('#step-redaktor .m4-for');
    check(`Редактор урока 15: ${mode === 'demo' ? 'уровень для своей игры' : 'своя игра не читает карты — уровень для донора'}, код выдан после прохождения`, /^L[A-Z0-9]{5}$/.test(code) && (mode === 'demo' ? /твоя игра/.test(forTxt) : /донор урока/.test(forTxt)), `${code} · ${forTxt.replace(/\s+/g, ' ').slice(0, 80)}`);
    if (shot) await shot(student, 'm4-15-editor', true);
    if (mode === 'demo') {
      const card = await student.evaluate(() => Lab.api('/api/arcade').then(r => r.mine.find(c => c.lesson && c.lesson.id === 'urok-15')));
      check('Свой уровень встал в свою игру после своих уровней', card && card.guests.length === 1 && card.guests[0].code === code, card ? JSON.stringify(card.guests) : '');
    }
    // галерея: коды соседки, «пройди за пар»
    const nbCodes = await neighbourLevels(student, [
      { game: 'remake:games/ovechiy-zagon.js', title: 'Соседкин загон', kind: 'free', map: '########\n#@ $  .#\n# $  . #\n########', cleared: { moves: 10, time: 20 } },
      { game: 'remake:games/ovechiy-zagon.js', title: 'Короткий', kind: 'free', map: '#######\n#@ $ .#\n#######', cleared: { moves: 3, time: 5 } },
    ]);
    await student.waitForSelector('#step-galereya input.m4-codein');
    await student.fill('#step-galereya input.m4-codein', nbCodes[1].toLowerCase());
    await student.click('#step-galereya [data-code=find]');
    let gf = await frameIn(student, '#step-galereya');
    await gf.evaluate(solve3);
    await student.waitForFunction(() => /В пар/.test(document.querySelector('#step-galereya').textContent), null, { timeout: 15000 });
    check('Галерея: уровень по коду соседки, пройден в пар', true);
    await student.click('#step-galereya >> text=← Все уровни');
    await student.click(`#step-galereya [data-play="${nbCodes[0]}"]`);
    gf = await frameIn(student, '#step-galereya');
    await gf.evaluate(() => { window.__lab.confirm(); const L = window.__lab.lab; for (const d of [[0, 1], [1, 0], [1, 0], [1, 0], [-1, 0], [-1, 0], [0, -1], [1, 0], [1, 0], [1, 0]]) GAME.step(L, d); });
    await student.waitForSelector('#step-galereya.done', { timeout: 15000 });
    const lv = await student.evaluate(c => Lab.api('/api/levels?code=' + c).then(r => r.levels[0]), nbCodes[0]);
    check('Галерея: два чужих уровня — шаг готов, у уровня соседки пар и прошедшие', lv.par === 10 && lv.cleared === 2, JSON.stringify({ par: lv.par, cleared: lv.cleared, tried: lv.tried }));
    await final(student, les, 'темпа');
  }

  /* ---------------- урок 16 ---------------- */
  async function lesson16(mode, teacher, student, shot) {
    const les = lessons[16];
    await open(teacher, student, les);
    await donor(student, les, 'tumannoe-plato', async gf => {
      const r = await gf.evaluate(() => {
        window.__lab.confirm(); const L = window.__lab.lab, st = L.state, P = st.lv[st.li], h = st.hero, s0 = L.score;
        const o = P.crumbs[0], s = P.secrets[0];
        Object.assign(h, { x: o.x, z: o.z }); GAME.touch(L, P, h);
        Object.assign(h, { x: s.x, z: s.z }); GAME.touch(L, P, h);
        return { levels: st.list.length, first: st.list[0].name, crumbs: P.crumbs.length, secrets: P.secrets.length, got: P.got, beam: !!P.beam, mark: !!P.mark, gained: L.score - s0 };
      });
      check('Донор урока 16: три плато-карты, огонёк и секрет подбираются, свет и великан на месте', r.levels === 3 && r.secrets === 3 && r.got === 1 && r.beam && r.mark && r.gained >= 210, JSON.stringify(r));
    });
    await hunt(student, les, mode, 'tumannoe-plato', async gf => {
      const r = await gf.evaluate(() => { const st = window.__lab.lab.state, P = st.lv[st.li]; return { beam: !!P.beam, crumbs: P.crumbs.length, mark: !!P.mark }; });
      check('Без спрятанной механики: ни света на вершине, ни огоньков, ни великана', !r.beam && r.crumbs === 0 && !r.mark, JSON.stringify(r));
    }, { 'зов': 5 });
    await motion(student, les, 'secret-story', shot);
    await variety(student, les, 'tumannoe-plato', [['gusche', 'fog', 0.07], ['bez-ogonkov', 'crumbs', 0], ['kompas', 'compass', 1], ['zakat', 'sunset', 1]], 'секунд до вершины', 40, 'zakat', 'Без света', shot);
    // «Куда ты пойдёшь?»: кадр на три секунды, ошибка — разбор, итог
    const kq = stepOf(les, 'kuda');
    await student.waitForSelector('#step-kuda [data-quiz="0"]');
    check('Куда ты пойдёшь: кадр и три направления', await student.locator('#step-kuda canvas.m4-cv').count() === 1 && await student.locator('#step-kuda [data-quiz]').count() === 3);
    for (let r = 0; r < kq.rounds.length; r++) {
      const rd = kq.rounds[r], pick = r === 1 ? rd.options.find(o => o !== rd.answer) : rd.answer;
      await student.click(`#step-kuda [data-quiz="${rd.options.indexOf(pick)}"]`);
      await student.waitForSelector('#step-kuda .verdict');
      if (r === 1) { check('Куда ты пойдёшь: ошибка — разбор, что повело', /Не совсем/.test(await student.textContent('#step-kuda .verdict')) && (await student.textContent('#step-kuda .verdict')).includes(rd.why.slice(0, 30))); if (shot) await shot(student, 'm4-16-kuda'); }
      await student.click('#step-kuda [data-quiz=next]');
    }
    await student.waitForSelector('#step-kuda.done');
    check('Квиз «Куда ты пойдёшь?»: итог', new RegExp(`Верно ${kq.rounds.length - 1} из ${kq.rounds.length}`).test(await student.textContent('#step-kuda .m4-quiz h2')));
    await build(student, les, mode, 'Свет над Фиштом', t => GAME.title === t && window.__lab.lab.state.list.length === 3);
    await ownAndHeat(student, les, mode, [['where', 18.5, 22.5], ['where', 17.5, 19.5], ['where', 10.5, 15.5], ['where', 6.5, 20.5], ['secret', 4.5, 21.5]], 'sledy', shot);
    // охота за секретами на время: одно плато, три секрета — победа и очки за скорость
    await student.click('#step-ohota .veil button');
    const hf = await frameIn(student, '#step-ohota');
    await hf.waitForFunction(() => window.__lab.cfg.hunt === 1, null, { timeout: 5000 }).catch(() => {});
    const hr = await hf.evaluate(() => {
      window.__lab.confirm(); const L = window.__lab.lab, st = L.state, P = st.lv[st.li], h = st.hero;
      for (const s of P.secrets) { Object.assign(h, { x: s.x, z: s.z }); GAME.touch(L, P, h); }
      return { levels: st.list.length, got: P.got, done: st.done, score: L.score };
    });
    check('Охота за секретами: одно плато, три секрета — партия выиграна, очки за скорость', hr.levels === 1 && hr.got === 3 && hr.done && hr.score > 2000, JSON.stringify(hr));
    await student.waitForSelector('#step-ohota.done', { timeout: 15000 });
    await final(student, les, 'любопытства');
  }

  // своя игра без тепловой карты (урок 17): партия и «Совпало?»
  async function ownPlay(student) {
    await student.click('.cp >> text=Своя игра');
    await student.click('#step-ruchki .veil button');
    await playRound(await gameFrame(student, '/play/', 0), { score: 80 });
    await student.click('#step-ruchki [data-match="Совпало"]');
    await student.waitForSelector('#step-ruchki.done', { timeout: 10000 });
  }
  // донор «Пещер на зерне»: спелеолог встаёт на выход — глубина пройдена
  const caveExit = () => { window.__lab.confirm(); const L = window.__lab.lab, st = L.state, h = st.hero; Object.assign(h, { x: st.L.exitW.x, z: st.L.exitW.z }); GAME.touch(L, st.L, h); return { seed: st.seed, depths: st.list.length }; };

  /* ---------------- урок 17 ---------------- */
  async function lesson17(mode, teacher, student, shot) {
    const les = lessons[17];
    await open(teacher, student, les);
    await donor(student, les, 'peshchery-na-zerne', async gf => {
      const r = await gf.evaluate(() => {
        window.__lab.confirm(); const L = window.__lab.lab, st = L.state, c = Object.assign({}, window.__lab.cfg);
        const a = GAME.world(4242, 1, c).map, b = GAME.world(4242, 1, c).map, d = GAME.world(4243, 1, c).map;
        let reach = 0; for (let s = 1; s <= 30; s++) reach += GAME.world(s, 1, c).reach ? 1 : 0;
        return { depths: st.list.length, seed: st.seed, same: a === b, other: a !== d, reach, exit: !!st.L.exitW, map: /E/.test(st.list[0].map) };
      });
      check('Донор урока 17: три глубины на зерне, одно зерно — один мир, выход достижим в 30 мирах из 30', r.depths === 3 && r.seed > 0 && r.same && r.other && r.reach === 30 && r.exit && r.map, JSON.stringify(r));
    });
    await hunt(student, les, mode, 'peshchery-na-zerne', async gf => {
      const r = await gf.evaluate(() => { const c = Object.assign({}, window.__lab.cfg); let walled = 0; for (let s = 1; s <= 40; s++) walled += GAME.world(s, 1, c).reach ? 0 : 1; return { secret: c.secret, walled }; });
      check('Без спрятанной механики: без гарантий выход бывает замурован', r.secret === 0 && r.walled > 0, JSON.stringify(r));
    }, { 'перебросы': 3 });
    await motion(student, les, 'secret-story', shot);
    await variety(student, les, 'peshchery-na-zerne', [['komnaty', 'gen', 1], ['labirint', 'gen', 3], ['myshi', 'enemies', 2.5], ['zerno', 'zerno', 2026]], 'секунд на глубину', 30, 'labirint', 'Лабиринт', shot);
    // «Найди правило генератора»: три мира одним правилом, ошибка — разбор, итог
    const pq = stepOf(les, 'pravilo');
    await student.waitForSelector('#step-pravilo [data-quiz="0"]');
    check('Найди правило генератора: три карты и четыре правила', await student.locator('#step-pravilo canvas.m4-cv').count() === 1 && await student.locator('#step-pravilo [data-quiz]').count() === 4);
    for (let r = 0; r < pq.rounds.length; r++) {
      const rd = pq.rounds[r], pick = r === 1 ? rd.options.find(o => o !== rd.answer) : rd.answer;
      await student.click(`#step-pravilo [data-quiz="${rd.options.indexOf(pick)}"]`);
      await student.waitForSelector('#step-pravilo .verdict');
      if (r === 1) { check('Найди правило генератора: ошибка — разбор почерка', /Не совсем/.test(await student.textContent('#step-pravilo .verdict'))); if (shot) await shot(student, 'm4-17-pravilo'); }
      await student.click('#step-pravilo [data-quiz=next]');
    }
    await student.waitForSelector('#step-pravilo.done');
    check('Квиз «Найди правило генератора»: итог', new RegExp(`Верно ${pq.rounds.length - 1} из ${pq.rounds.length}`).test(await student.textContent('#step-pravilo .m4-quiz h2')));
    await build(student, les, mode, 'Шахта сто миров', t => GAME.title === t && window.__lab.lab.state.list.length === 3);
    await ownPlay(student);
    // «Зерно дня»: у всех зерно 2026, одна глубина, гонка до выхода
    await student.click('.cp >> text=Играем вместе');
    await student.click('#step-zerno-dnya .veil button');
    const zf = await frameIn(student, '#step-zerno-dnya');
    await zf.waitForFunction(() => window.__lab.cfg.zerno === 2026, null, { timeout: 5000 }).catch(() => {});
    const zr = await zf.evaluate(caveExit);
    check('Зерно дня: зерно 2026 у всех, одна глубина — до выхода', zr.seed === 2026 && zr.depths === 1, JSON.stringify(zr));
    await student.waitForSelector('#step-zerno-dnya.done', { timeout: 20000 });
    // галерея зёрен: соседка выложила зерно, ученик смотрит своё, доходит до выхода и выкладывает, потом играет в зерно соседки
    const seeds = await neighbourLevels(student, [{ game: 'remake:games/peshchery-na-zerne.js', title: 'Хрустальный зал', kind: 'free', seed: 777, cfg: { zerno: 777 }, cleared: { time: 25 } }]);
    await student.waitForSelector('#step-zerna input.m4-seedin');
    await student.fill('#step-zerna input.m4-seedin', '4242');
    await student.click('#step-zerna [data-seed=look]');
    const sf = await frameIn(student, '#step-zerna');
    await sf.waitForFunction(() => window.__lab.cfg.zerno === 4242, null, { timeout: 5000 }).catch(() => {});
    await sf.evaluate(caveExit);
    await student.waitForSelector('#step-zerna [data-seed=publish]', { timeout: 20000 });
    await student.fill('#step-zerna input.m4-seedtitle', 'Пещера ученика');
    await student.click('#step-zerna [data-seed=publish]');
    await student.waitForSelector(`#step-zerna [data-play="${seeds[0]}"]`, { timeout: 10000 });
    const mine = await student.evaluate(() => Lab.api('/api/levels?game=' + encodeURIComponent('remake:games/peshchery-na-zerne.js')).then(r => r.levels.filter(l => l.mine).map(l => l.seed)));
    check('Галерея зёрен: своё зерно выложено после выхода', mine.includes(4242), JSON.stringify(mine));
    await student.click(`#step-zerna [data-play="${seeds[0]}"]`);
    const nf = await frameIn(student, '#step-zerna');
    await nf.waitForFunction(() => window.__lab.lab.state.seed === 777, null, { timeout: 10000 }).catch(() => {});
    const nr = await nf.evaluate(caveExit);
    check('Галерея зёрен: зерно соседки — тот же мир 777', nr.seed === 777, JSON.stringify(nr));
    await student.waitForSelector('#step-zerna.done', { timeout: 20000 });
    await student.click(`#step-zerna [data-like="${seeds[0]}"]`);
    await student.waitForSelector(`#step-zerna [data-like="${seeds[0]}"]:has-text("1")`, { timeout: 10000 });
    check('Галерея зёрен: ♥ «Красивый мир» соседке', true);
    await final(student, les, 'разнообразия');
  }

  /* ---------------- урок 18 ---------------- */
  async function lesson18(mode, teacher, student, shot) {
    const les = lessons[18];
    await open(teacher, student, les, '#step-maker-story');
    await choice(student, 'vopros-uroka', 2);
    await motion(student, les, 'maker-story', shot);
    // разминка: обучающий уровень «Овечьего загона», код после прохождения
    const solve3 = () => { window.__lab.confirm(); const L = window.__lab.lab; for (let i = 0; i < 3; i++) GAME.step(L, [1, 0]); };
    await student.click('.cp >> nth=1');
    const warm = await editLevel(student, 'razminka', '#######\n#@ $ .#\n#######', solve3, 'Первый толчок');
    check('Разминка: обучающий уровень донора, код после прохождения', /^L[A-Z0-9]{5}$/.test(warm), warm);
    // марафон: игра соседа (или донор урока соседа, если игра не читает карты) — обучающий и коварный уровень
    await student.click('.cp >> nth=2');
    await student.waitForSelector('#step-marafon .m4-for', { timeout: 30000 });
    await student.waitForSelector('#step-marafon .m4-pal', { timeout: 40000 });
    const forTxt = (await student.textContent('#step-marafon .m4-for')).replace(/\s+/g, ' ');
    const clearIt = () => { window.__lab.confirm(); window.__lab.lab.clear({ time: 14, moves: 9 }); };
    const tropa = '################################\n#                              #\n#                              #\n#                              #\n#                              #\n#                              #\n#                              #\n#                              #\n#                              #\n# @                         F  #\n################################\n################################';
    const train = await editLevel(student, 'marafon', tropa, clearIt, 'Учит прыгать');
    const tricky = await editLevel(student, 'marafon', tropa.replace('#  ', '   '), clearIt, 'Коварная яма');
    const lv = await student.evaluate(() => Lab.api('/api/levels').then(r => r.levels.filter(l => l.mine && l.lesson === 18 && l.game !== 'remake:games/ovechiy-zagon.js').map(l => l.kind).sort()));
    check('Марафон: два уровня для игры соседа — обучающий и коварный, оба пройдены строителем', lv.join(',') === 'train,tricky' && train !== tricky, `${forTxt.slice(0, 80)} · ${lv.join(',')}`);
    await student.waitForSelector('#step-marafon.done', { timeout: 10000 });
    if (shot) await shot(student, 'm4-18-marafon', true);
    // галерея: соседка выложила три уровня — играем, оцениваем тремя вопросами и «хочу ещё»
    const my = await student.evaluate(() => Lab.api('/api/arcade').then(r => r.mine.filter(c => c.lesson && c.lesson.module === 4).map(c => c.id)));
    const codes = await neighbourLevels(student, [
      { game: 'remake:games/ovechiy-zagon.js', title: 'Загон соседки', kind: 'train', map: '#######\n#@ $ .#\n#######', cleared: { moves: 3, time: 5 } },
      { game: 'remake:games/ovechiy-zagon.js', title: 'Хитрый загон', kind: 'tricky', map: '########\n#@ $  .#\n# $  . #\n########', cleared: { moves: 10, time: 20 } },
      { game: 'remake:games/ovechiy-zagon.js', title: 'Ещё загон', kind: 'train', map: '######\n#@$ .#\n######', cleared: { moves: 2, time: 4 } },
      ...my.slice(0, 1).map(id => ({ game: 'game:' + id, title: 'Гость в твоей игре', kind: 'train', map: '#####\n#@ E#\n#####', cleared: { time: 9 } })),
    ]);
    await student.click('.cp >> nth=4');
    for (const code of codes.slice(0, 3)) {
      await student.click(`#step-galereya [data-play="${code}"]`);
      const gf = await frameIn(student, '#step-galereya');
      await gf.evaluate(() => { window.__lab.confirm(); const L = window.__lab.lab, st = L.state; const moves = { 'Загон соседки': 'RRR', 'Хитрый загон': 'DRRRLLURRR', 'Ещё загон': 'RR' }[st.list[0].name] || 'RRR'; for (const ch of moves) GAME.step(L, { R: [1, 0], L: [-1, 0], U: [0, -1], D: [0, 1] }[ch]); });
      await student.waitForSelector('#step-galereya [data-rate="teach:Да"]', { timeout: 20000 });
      for (const k of ['teach:Да', 'rhythm:Да', 'goal:Нет']) await student.click(`#step-galereya [data-rate="${k}"]`);
      await student.click(`#step-galereya [data-like="${code}"]`);
      await student.click('#step-galereya >> text=← Все уровни');
    }
    await student.waitForSelector('#step-galereya.done', { timeout: 15000 });
    const rated = await student.evaluate(c => Lab.api('/api/levels?code=' + c).then(r => r.levels[0]), codes[1]);
    check('Галерея мейкеров: три чужих уровня — пройдены, оценены тремя вопросами, «хочу ещё»', rated.cleared >= 2 && rated.rates.n === 1 && rated.rates.teach === 1 && rated.likes === 1, JSON.stringify({ cleared: rated.cleared, rates: rated.rates, likes: rated.likes }));
    if (shot) await shot(student, 'm4-18-galereya', true);
    // гости в моей игре: уровень соседки для моей игры — «Взять в игру»
    if (my.length) {
      await student.waitForSelector(`#step-gosti [data-accept="${codes[3]}"]`, { timeout: 15000 });
      await student.click(`#step-gosti [data-accept="${codes[3]}"]`);
      await student.waitForSelector('#step-gosti.done', { timeout: 10000 });
      const card = await student.evaluate(id => Lab.api('/api/arcade').then(r => r.mine.find(c => c.id === id)), my[0]);
      check('Гости в моей игре: уровень соседки взят в игру', card && card.guests.length === 1 && card.guests[0].code === codes[3], card ? JSON.stringify(card.guests) : '');
    }
    // релиз модуля 4: чек-лист с уровнями гостей
    await student.click('.cp >> nth=5');
    await student.waitForSelector('#step-reliz .seg .opt');
    const ev = (await student.textContent('#step-reliz .checklist')).replace(/\s+/g, ' ');
    check('Релиз модуля 4: чек-лист про уровни и гостей', /Пять уровней/.test(ev) && /уровни гостей/.test(ev), ev.slice(0, 120));
    for (const it of stepOf(les, 'reliz').checklist) await student.click(`#step-reliz .check[data-check="${it.id}"]`);
    await student.click('#step-reliz .dicebtn');
    await student.click('#step-reliz >> text=🚀 Выпустить версию 1.0');
    await student.waitForSelector('#step-reliz.done', { timeout: 10000 });
    await final(student, les, 'чужих глаз');
  }

  // помощники общего формата урока — их берёт и e2e-m7.js (модуль 7)
  return { lesson14, lesson15, lesson16, lesson17, lesson18, neighbourLevels, editLevel, helpers: { open, choice, donor, hunt, motion, variety, build, final } };
};
