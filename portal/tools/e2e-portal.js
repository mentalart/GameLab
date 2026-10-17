#!/usr/bin/env node
// Сквозная проверка портала в браузере: учитель и ученик проходят урок 1 целиком.
// Два прогона: с подставным ИИ (mock-ai.js: продюсер, сборка с ошибкой → автопочинка, правка) и в демо-режиме без ключа.
// В прогоне с ИИ — «Играем вместе»: второй ученик собирает игру, оба играют в игры друг друга, бьют рекорд автора,
// бросают вызов на зерне, оставляют плейтест; учитель пишет отзыв; аркада класса и личная аркада, скрытие игры.
// Данные и настройки — во временной папке, настоящий portal/config.json и portal/data/ не трогаются.
// Запуск: node portal/tools/e2e-portal.js [--headed]   Снимки — в portal/.check/portal-*.png
'use strict';
const fs = require('fs');
const os = require('os');
const path = require('path');

const TMP = fs.mkdtempSync(path.join(os.tmpdir(), 'lab-e2e-'));
process.env.LAB_DATA = path.join(TMP, 'data');
process.env.LAB_CONFIG = path.join(TMP, 'config.json');
const OUT = path.resolve(__dirname, '..', '.check');
fs.mkdirSync(OUT, { recursive: true });

const { chromium } = require('playwright');
const mock = require('./mock-ai');
const ai = require('../lib/ai');
const portal = require('../server');
const lesson1 = require('../lessons/urok-01');

const PASSWORD = 'e2e-пароль';
const results = [];
const check = (what, ok, detail = '') => { results.push({ what, ok: !!ok, detail }); console.log(`  ${ok ? '✓' : '✗'} ${what}${detail ? ' — ' + detail : ''}`); };
const sleep = ms => new Promise(r => setTimeout(r, ms));
let failShots = async () => {};

function writeConfig(aiPart) {
  fs.writeFileSync(process.env.LAB_CONFIG, JSON.stringify({ port: 0, teacherPassword: PASSWORD, ai: aiPart, models: [{ id: 'mock-code', label: 'Подставной программист', rubPer1MIn: 100, rubPer1MOut: 400 }, { id: 'mock-text', label: 'Подставной продюсер', rubPer1MIn: 10, rubPer1MOut: 40 }], limits: { aiCallsPerStudentPerLesson: 40, rublesPerLesson: 0 } }, null, 2));
  ai.reloadConfig();
}

async function gameFrame(page, urlPart, n = 0) {
  for (let i = 0; i < 100; i++) {
    const fr = page.frames().filter(f => f.url().includes(urlPart));
    if (fr[n]) { await fr[n].waitForFunction('window.__lab && (window.__lab.ready || window.__lab.errored)', null, { timeout: 30000 }); return fr[n]; }
    await sleep(200);
  }
  throw new Error('Не дождался рамки игры ' + urlPart);
}
// партия: старт, по желанию — зажатая клавиша (телеметрия), конец с заданным счётом
async function playRound(frame, { score = 0, hold = null, page = null, restart = false } = {}) {
  await frame.evaluate(r => (r ? window.__lab.restart() : window.__lab.confirm()), restart);
  if (hold && page) {
    await frame.locator('#cv').focus();
    await page.keyboard.down(hold); await sleep(900); await page.keyboard.up(hold);
  } else await sleep(300);
  await frame.evaluate(s => { window.__lab.lab.score = s; window.__lab.end('lose', 'Проверка'); }, score);
}
const watch = (p, errors) => {
  p.on('pageerror', e => errors.push(e.message));
  p.on('dialog', d => d.accept());
  p.on('console', m => { if (m.type() === 'error' && !/Failed to load resource|^\[lab3d\]/.test(m.text())) errors.push(m.text()); }); // ошибки игр [lab3d] ловит автопочинка
};

async function run(browser, base, mode) {
  console.log(`\n▶ Прогон: ${mode === 'mock' ? 'подставной ИИ' : 'демо-режим без ключа'}`);
  const errors = [];
  const tctx = await browser.newContext({ viewport: { width: 1280, height: 860 } });
  const sctx = await browser.newContext({ viewport: { width: 1280, height: 900 } });
  const teacher = await tctx.newPage(), student = await sctx.newPage();
  failShots = async () => { await student.screenshot({ path: path.join(OUT, `portal-${mode}-x-student.png`), fullPage: true }).catch(() => {}); await teacher.screenshot({ path: path.join(OUT, `portal-${mode}-x-teacher.png`) }).catch(() => {}); };
  for (const p of [teacher, student]) watch(p, errors);
  const shot = async (p, name, fullPage = false) => p.screenshot({ path: path.join(OUT, `portal-${mode}-${name}.png`), fullPage });

  // учитель: вход, класс, первый чекпоинт
  await teacher.goto(base + '/');
  await teacher.fill('#pass', PASSWORD);
  await teacher.click('#teacherForm button[type=submit]');
  await teacher.waitForURL('**/teacher');
  await teacher.fill('#newName', 'Проверка ' + mode);
  await teacher.click('#newClass button');
  // ждём именно новый класс: до создания панель показывает класс прошлого прогона
  await teacher.waitForFunction(name => { const o = document.querySelector('#classSel').selectedOptions[0]; return o && o.textContent.startsWith(name) && /^[A-Z0-9]{5}$/.test(document.querySelector('#classCode').textContent) && o.textContent.endsWith(document.querySelector('#classCode').textContent); }, 'Проверка ' + mode);
  const code = await teacher.textContent('#classCode');
  check('Учитель создал класс', /^[A-Z0-9]{5}$/.test(code), code);
  await teacher.click('text=Открыть: Донор →');

  // ученик: вход по коду
  await student.goto(base + '/?code=' + code);
  await student.fill('#nick', 'Тестер');
  await student.click('#studentForm button[type=submit]');
  await student.waitForURL('**/student');
  await student.waitForSelector('#step-donor-play');
  check('Ученик вошёл и видит открытый чекпоинт «Донор»', true);
  await shot(student, '1-donor');

  // донор: партия в ремейке
  await student.click('#step-donor-play .veil button');
  const remake = await gameFrame(student, 'game.html');
  await playRound(remake);
  await student.waitForSelector('#step-donor-play.done', { timeout: 10000 });
  check('Партия в ремейке засчитана, шаг готов', true);
  await student.click('#step-donor-hook .opt >> nth=0');
  await student.click('#step-donor-hook >> text=Ответить');
  await student.waitForSelector('#step-donor-hook.done');

  // учитель открывает все чекпоинты — ученик получает их без перезагрузки
  await teacher.click('text=Открыть все');
  await student.waitForSelector('.cp.open >> nth=6', { timeout: 10000 });
  check('Чекпоинты открылись у ученика без перезагрузки (SSE)', true);

  // секрет
  await student.click('.cp >> text=Секрет');
  await student.click('#step-secret-play .veil button');
  const remake2 = await gameFrame(student, 'game.html');
  await remake2.waitForFunction(() => window.__lab.cfg.speedup === 0, null, { timeout: 5000 }).catch(() => {});
  const speedup = await remake2.evaluate(() => window.__lab.cfg.speedup);
  check('Шаг передал ручку в игру (setCfg: секрет выключен)', speedup === 0, 'speedup = ' + speedup);
  await playRound(remake2);
  await student.waitForSelector('#step-secret-play.done');
  await student.click('#step-secret-feel .opt >> nth=0');
  await student.click('#step-secret-feel >> text=Ответить');
  await student.click('#step-secret-story >> text=Понятно');
  // квиз: отвечаем правильно по сценарию урока
  const quiz = lesson1.checkpoints.find(c => c.id === 'secret').steps.find(s => s.id === 'secret-quiz');
  await student.click('#step-secret-quiz >> text=▶ Начать');
  for (let i = 0; i < quiz.items.length; i++) {
    const text = await student.textContent('#step-secret-quiz .item');
    const it = quiz.items.find(x => x.text === text.trim());
    const k = quiz.bins.findIndex(b => b.id === it.bin);
    await student.keyboard.press('Digit' + (k + 1));
    await sleep(1050);
  }
  await student.waitForSelector('#step-secret-quiz.done');
  const quizText = await student.textContent('#step-secret-quiz h2 >> nth=1');
  check('Квиз «Чьё это решение?» пройден', /12 из 12/.test(quizText), quizText);
  await shot(student, '2-quiz');

  // Фабрика и решения
  await student.click('.cp >> text=Фабрика');
  await student.click('#step-fabrika >> text=🎲 Кубик для пустых полей');
  await student.fill('#f-fabrikatitle', 'Пасека под огнём');
  await student.click('#step-fabrika >> text=Замысел готов');
  await student.waitForSelector('#step-fabrika.done');
  const diceTags = await student.locator('#step-fabrika .tag.dice').count();
  check('Кубик заполнил поля и пометил их [кубик]', diceTags >= 4, `пометок: ${diceTags}`);
  await student.fill('#f-resheniyafeeling', 'Страшно, когда шершни уже у ульев');
  await student.click('#step-resheniya .dicebtn >> nth=1');
  await student.click('#step-resheniya .dicebtn >> nth=2');
  await student.click('#step-resheniya >> text=Решения приняты');
  await student.waitForSelector('#step-resheniya.done');
  await shot(student, '3-fabrika');

  // ИГРА и продюсер
  await student.click('.cp >> text=Промпт ИГРА');
  const prefill = await student.inputValue('#f-igrai');
  check('Черновик ИГРА собран из Фабрики', prefill.includes('Пасека под огнём'), prefill.slice(0, 60));
  await student.click('#step-igra >> text=Промпт готов');
  await student.click('#step-prodyuser >> text=Отдать замысел продюсеру');
  await student.waitForSelector('#step-prodyuser .fork .opt', { timeout: 30000 });
  await student.click('#step-prodyuser .fork .opt >> nth=0');
  await student.waitForSelector('#step-prodyuser.done');
  check('Продюсер ответил, развилка выбрана', true);
  await shot(student, '4-producer');

  // сборка
  await student.click('.cp >> text=Сборка');
  await student.click('#step-sborka >> text=⚙ Собрать игру');
  let own = await gameFrame(student, '/play/', 0);
  check('Игра собрана и запустилась в изолированной рамке', await own.evaluate(() => window.__lab.ready));
  if (mode === 'mock') {
    await own.evaluate(() => window.__lab.confirm());
    await student.waitForFunction(() => [...document.querySelectorAll('#step-sborka .ver')].length >= 2, null, { timeout: 30000 });
    check('Упавшую игру программист починил сам (v2)', true, await student.textContent('#step-sborka .versions'));
    own = await gameFrame(student, '/play/', 0);
  }
  await shot(student, '5-build');
  await playRound(own);
  await student.waitForSelector('#step-sborka.done', { timeout: 10000 });
  check('Первая партия в своей игре засчитана', true);

  // мастерская
  await student.click('.cp >> text=Мастерская');
  await student.fill('#aicheck-text', 'Золотая тарелка, я её не просил');
  await student.click('#step-svoevolie >> text=Показать, что программист решил сам');
  await student.waitForSelector('#step-svoevolie.done');
  const notes = await student.locator('#step-svoevolie li').count();
  check('Решения программиста показаны', mode === 'demo' ? notes >= 1 : notes >= 1, `строк: ${notes}`);
  const before = await student.locator('#step-masterskaya .ver').count();
  await student.fill('#f-masterskayareq', 'Пусть последний враг мигает красным');
  await student.click('#step-masterskaya >> text=Отправить программисту');
  await student.waitForFunction(n => document.querySelectorAll('#step-masterskaya .ver').length > n, before, { timeout: 30000 });
  check('Правка дала новую версию', true, await student.textContent('#step-masterskaya .versions'));
  // откат одним кликом: в демо — к v1, с ИИ — к починенной v2 (v1 нарочно падает, а в эту версию будут играть соседи)
  const back = mode === 'mock' ? 2 : 1;
  await student.click(`#step-masterskaya .ver >> nth=${back - 1}`);
  await sleep(500);
  const cur = await student.textContent('#step-masterskaya .ver.cur');
  check(`Откат к версии ${back} одним кликом`, new RegExp('v' + back).test(cur), cur);
  await shot(student, '6-workshop');

  if (mode === 'mock') await together(browser, base, code, teacher, student, errors, shot);
  else {
    await student.click('.cp >> text=Играем вместе');
    await student.waitForSelector('#step-sosed >> text=Ждём игру соседа');
    check('Без игр соседей шаг arcade ждёт и не падает', true);
  }

  // открытие и заметка автора
  await student.click('.cp >> text=Открытие');
  await student.click('#step-otkrytie-den .opt >> nth=0');
  await student.click('#step-otkrytie-den >> text=Ответить');
  await student.click('#step-plan-v2 .dicebtn');
  await student.click('#step-plan-v2 >> text=Ответить');
  await student.waitForSelector('#step-plan-v2.done');
  await student.click('#noteBtn');
  await student.fill('#noteText', 'Проверка: заметка автора с шага');
  await student.click('#noteSend');
  await sleep(400);

  // учитель видит всё
  await teacher.waitForSelector('tr.click >> text=Тестер', { timeout: 10000 });
  check('Учитель видит ученика в таблице', true);
  await teacher.click('tr.click >> text=Тестер');
  await teacher.waitForSelector('#studentDlg[open] pre.plan');
  const plan = await teacher.textContent('#studentDlg pre.plan');
  check('Учитель видит замысел ученика', plan.includes('Пасека под огнём'));
  await shot(teacher, '7-teacher');
  await teacher.click('#studentDlg >> text=Закрыть');
  await teacher.click('.tabs >> text=Заметки автора');
  await teacher.waitForSelector('#tab-notes .card');
  check('Заметка автора дошла до учителя', (await teacher.textContent('#tab-notes')).includes('Проверка: заметка автора'));
  await teacher.click('.tabs >> text=ИИ и расходы');
  await teacher.waitForSelector('#tab-ai h3');
  const aiTab = await teacher.textContent('#tab-ai');
  if (mode === 'mock') check('Журнал генераций считает вызовы и рубли', /Вызовов модели: [1-9]/.test(aiTab) && /mock-code/.test(aiTab), (aiTab.match(/Вызовов модели: [^.]*/) || [''])[0]);
  else check('Демо-режим виден учителю', /демо-режим/i.test(aiTab));
  await shot(teacher, '8-ai');

  check('Без ошибок JavaScript на страницах портала', !errors.length, errors.slice(0, 3).join(' | '));
  await tctx.close(); await sctx.close();
}

/* ---------- «Играем вместе»: второй ученик, игры друг друга, вызов, плейтест, отзыв, аркада ---------- */
async function together(browser, base, code, teacher, student, errors, shot) {
  const nctx = await browser.newContext({ viewport: { width: 1280, height: 900 } });
  const nb = await nctx.newPage();
  watch(nb, errors);
  // вторая ученица собирает свою игру: Фабрика и решения кубиками, ИГРА, сборка без продюсера
  await nb.goto(base + '/?code=' + code);
  await nb.fill('#nick', 'Соседка');
  await nb.click('#studentForm button[type=submit]');
  await nb.waitForURL('**/student');
  await nb.click('.cp >> text=Фабрика');
  await nb.click('#step-fabrika >> text=🎲 Кубик для пустых полей');
  await nb.fill('#f-fabrikatitle', 'Тучи над Фиштом');
  await nb.click('#step-fabrika >> text=Замысел готов');
  for (let i = 0; i < 3; i++) await nb.click(`#step-resheniya .dicebtn >> nth=${i}`);
  await nb.click('#step-resheniya >> text=Решения приняты');
  await nb.click('.cp >> text=Промпт ИГРА');
  await nb.click('#step-igra >> text=Промпт готов');
  await nb.click('.cp >> text=Сборка');
  await nb.click('#step-sborka >> text=⚙ Собрать игру');
  let nown = await gameFrame(nb, '/play/', 0);
  await nown.evaluate(() => window.__lab.confirm());
  await nb.waitForFunction(() => document.querySelectorAll('#step-sborka .ver').length >= 2, null, { timeout: 30000 });
  nown = await gameFrame(nb, '/play/', 0);
  await playRound(nown, { score: 40 });
  await nb.waitForSelector('#step-sborka.done', { timeout: 10000 });
  check('Второй ученик собрал игру и поставил рекорд автора (40)', true);

  // Тестер: игра соседа по кругу, рекорд автора побит, «ещё раз», вызов на зерне
  await student.click('.cp >> text=Играем вместе');
  await student.waitForSelector('#step-sosed .acard', { timeout: 15000 });
  const nbTitle = await student.textContent('#step-sosed .acard h3');
  check('Шаг arcade дал игру соседа по кругу', nbTitle.includes('Тучи над Фиштом'), nbTitle);
  const nbCard = (await student.textContent('#step-sosed .acard')).replace(/\s+/g, ' ');
  check('Карточка соседа: автор, донор и «Что решил я»', /Соседка/.test(nbCard) && /Space Invaders/.test(nbCard) && await student.locator('#step-sosed .acard').first().locator('.decided li').count() === 3, nbCard.slice(0, 160));
  check('Видно рекорд автора', (await student.textContent('#step-sosed .scores')).includes('40'), (await student.textContent('#step-sosed .scores')).replace(/\s+/g, ' '));
  await student.click('#step-sosed .veil button');
  let sf = await gameFrame(student, '/play/', 0);
  await playRound(sf, { score: 120, hold: 'ArrowRight', page: student });
  await student.waitForSelector('#step-sosed .gamebar >> text=рекорд автора побит', { timeout: 10000 });
  check('Рекорд автора побит, шаг arcade засчитан', await student.locator('#step-sosed.done').count() === 1);
  await playRound(sf, { score: 80, hold: 'ArrowRight', page: student, restart: true });
  const seed = await sf.evaluate(() => window.__lab.lab.seed);
  await student.click('#step-sosed >> text=⚔ Вызов: побей мой мир');
  await student.waitForSelector('#step-sosed .chcode');
  const chCode = (await student.textContent('#step-sosed .chcode')).trim();
  check('Вызов «побей мой мир» выдал код', /^[A-Z0-9]{6}$/.test(chCode), chCode + ', зерно ' + seed);
  await shot(student, '9-arcade-step', true);

  // плейтест тап-карточкой
  await student.click('#step-pleytest .emo >> nth=1');
  await student.click('#step-pleytest .dicebtn >> nth=0');
  await student.fill('#f-pleytestwant', 'Хочется видеть, откуда летят тучи');
  await student.click('#step-pleytest .dicebtn >> nth=2');
  await student.click('#step-pleytest >> text=Отправить автору');
  await student.waitForSelector('#step-pleytest.done');
  check('Плейтест-карточка отправлена автору', true);
  await student.click('#step-dom-strategiya >> text=Понятно');
  await student.locator('#step-pleytest').scrollIntoViewIfNeeded();
  await shot(student, '10-playtest', true);

  // Соседка: играет в игру Тестера, пишет плейтест и видит открытие плейтеста своей игры
  await nb.click('.cp >> text=Играем вместе');
  await nb.waitForSelector('#step-sosed .acard', { timeout: 15000 });
  check('Сосед получил игру Тестера', (await nb.textContent('#step-sosed .acard h3')).includes('Пасека под огнём'));
  await nb.click('#step-sosed .veil button');
  const tf = await gameFrame(nb, '/play/', 0);
  await playRound(tf, { score: 30 });
  await nb.waitForSelector('#step-sosed.done', { timeout: 10000 });
  await nb.click('#step-pleytest .emo >> nth=0');
  for (let i = 0; i < 3; i++) await nb.click(`#step-pleytest .dicebtn >> nth=${i}`);
  await nb.click('#step-pleytest >> text=Отправить автору');
  await nb.waitForSelector('#step-pleytest.done');
  await nb.click('#step-pleytest >> text=↻ Обновить');
  await nb.waitForSelector('#step-pleytest .discovery .barrow', { timeout: 10000 });
  const disc = (await nb.textContent('#step-pleytest .discovery')).replace(/\s+/g, ' ');
  check('Открытие плейтеста: партии чужих игроков и «ещё раз»', /2\s*партий сыграли чужие/.test(disc) && /1\s*раз нажали «ещё раз»/.test(disc), disc.slice(0, 90));
  check('Открытие плейтеста: доминирующая кнопка — «→»', /держали → вправо/.test(disc), (disc.match(/держали[^.]*/) || [''])[0]);
  check('Автор видит карточку плейтеста соседа', disc.includes('Хочется видеть, откуда летят тучи'));

  // учитель: отзыв «одно понятие + один вопрос», ученик видит его на шаге без перезагрузки
  await teacher.click('.tabs >> text=Урок');
  await teacher.click('tr.click >> text=Соседка');
  await teacher.waitForSelector('#studentDlg[open] .fbedit');
  check('Учитель видит плейтест игры ученика', /партий сыграли чужие/.test(await teacher.textContent('#studentDlg')));
  await teacher.click('#studentDlg .fbedit .dicebtn >> nth=0');
  await teacher.fill('#f-fb-question', 'Какой кнопке в твоей игре нужна цена?');
  await teacher.click('#studentDlg >> text=Отправить отзыв ученику');
  await nb.waitForSelector('#step-pleytest .feedback >> text=Какой кнопке', { timeout: 10000 });
  check('Ученик видит отзыв учителя на шаге (живое обновление)', /Понятие:/.test(await nb.textContent('#step-pleytest .feedback')));
  await shot(teacher, '11-feedback');
  await teacher.click('#studentDlg >> text=Закрыть');
  await nb.locator('#step-pleytest .discovery').scrollIntoViewIfNeeded();
  await shot(nb, '12-discovery', true);

  // аркада класса: обе игры, вызов по коду в том же мире
  await nb.goto(base + '/arcade');
  await nb.waitForSelector('#games .acard >> nth=1');
  check('Аркада класса: обе игры с подписью «Что решил я»', await nb.locator('#games .acard').count() === 2 && await nb.locator('#games .decided').count() === 2);
  check('Личная аркада: моя игра по урокам', (await nb.textContent('#mine')).includes('Урок 1') && await nb.locator('#mine .acard').count() === 1);
  await shot(nb, '13-arcade', true);
  await nb.fill('#chCode', chCode.toLowerCase());
  await nb.click('#chForm button');
  await nb.waitForSelector('#stage iframe');
  const cf = await gameFrame(nb, 'seed=', 0);
  const cseed = await cf.evaluate(() => window.__lab.lab.seed);
  check('Вызов открыл тот же мир: /play/…?seed= передал зерно в оболочку', cseed === seed, `зерно ${cseed}`);
  await playRound(cf, { score: 200 });
  await nb.waitForSelector('#stage >> text=Таблица вызова', { timeout: 10000 });
  check('Таблица вызова: результат принявшего вызов', /Соседка — 200/.test(await nb.textContent('#stage')));
  await shot(nb, '14-challenge');

  // автор скрывает игру — у соседа её больше нет в аркаде
  await nb.click('#mine >> text=🙈 Скрыть из аркады');
  await nb.waitForSelector('#mine >> text=👁 Вернуть в аркаду');
  const sa = await student.context().newPage();
  watch(sa, errors);
  await sa.goto(base + '/arcade');
  await sa.waitForSelector('#games .acard');
  check('Скрытая игра пропала из аркады класса', !(await sa.textContent('#games')).includes('Тучи над Фиштом') && (await sa.textContent('#games')).includes('Пасека под огнём'));
  await sa.close();

  // вкладка учителя «Аркада»
  await teacher.click('.tabs >> text=Аркада');
  await teacher.waitForSelector('#tab-arcade .acard >> nth=1');
  check('Учитель видит аркаду класса, скрытую игру — с пометкой', (await teacher.textContent('#tab-arcade')).includes('скрыта автором'));
  await shot(teacher, '15-teacher-arcade');
  await teacher.click('.tabs >> text=Урок');
  await nctx.close();
}

(async () => {
  const mockSrv = await mock.start(0);
  writeConfig({ baseUrl: `http://127.0.0.1:${mockSrv.address().port}/v1`, apiKey: 'mock', codeModel: 'mock-code', textModel: 'mock-text', stream: true, timeoutSec: 30 });
  const srv = await portal.start(0, '127.0.0.1');
  const base = `http://127.0.0.1:${srv.address().port}`;
  const browser = await chromium.launch({ headless: !process.argv.includes('--headed'), args: ['--use-angle=swiftshader', '--enable-unsafe-swiftshader', '--ignore-gpu-blocklist'] });
  try {
    await run(browser, base, 'mock');
    writeConfig({ apiKey: '' });
    await run(browser, base, 'demo');
  } catch (e) {
    check('Прогон дошёл до конца', false, e.message.split('\n').slice(0, 3).join(' '));
    await failShots();
  }
  await browser.close(); srv.close(); mockSrv.close();
  fs.rmSync(TMP, { recursive: true, force: true });
  const bad = results.filter(r => !r.ok);
  console.log(`\n${bad.length ? 'Есть ошибки: ' + bad.length : 'Всё в порядке'}. Снимки: portal/.check/portal-*.png`);
  process.exit(bad.length ? 1 : 0);
})();
