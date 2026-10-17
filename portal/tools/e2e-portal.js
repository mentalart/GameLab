#!/usr/bin/env node
// Сквозная проверка портала в браузере: учитель и ученик проходят урок 1 целиком.
// Два прогона: с подставным ИИ (mock-ai.js: продюсер, сборка с ошибкой → автопочинка, правка) и в демо-режиме без ключа.
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
async function playRound(frame) {
  await frame.evaluate(() => window.__lab.confirm());
  await sleep(300);
  await frame.evaluate(() => window.__lab.end('lose', 'Проверка'));
}

async function run(browser, base, mode) {
  console.log(`\n▶ Прогон: ${mode === 'mock' ? 'подставной ИИ' : 'демо-режим без ключа'}`);
  const errors = [];
  const tctx = await browser.newContext({ viewport: { width: 1280, height: 860 } });
  const sctx = await browser.newContext({ viewport: { width: 1280, height: 900 } });
  const teacher = await tctx.newPage(), student = await sctx.newPage();
  failShots = async () => { await student.screenshot({ path: path.join(OUT, `portal-${mode}-x-student.png`), fullPage: true }).catch(() => {}); await teacher.screenshot({ path: path.join(OUT, `portal-${mode}-x-teacher.png`) }).catch(() => {}); };
  for (const p of [teacher, student]) {
    p.on('pageerror', e => errors.push(e.message));
    p.on('dialog', d => d.accept());
    p.on('console', m => { if (m.type() === 'error' && !/Failed to load resource|^\[lab3d\]/.test(m.text())) errors.push(m.text()); }); // ошибки игр [lab3d] ловит автопочинка
  }
  const shot = async (p, name) => p.screenshot({ path: path.join(OUT, `portal-${mode}-${name}.png`), fullPage: false });

  // учитель: вход, класс, первый чекпоинт
  await teacher.goto(base + '/');
  await teacher.fill('#pass', PASSWORD);
  await teacher.click('#teacherForm button[type=submit]');
  await teacher.waitForURL('**/teacher');
  await teacher.fill('#newName', 'Проверка ' + mode);
  await teacher.click('#newClass button');
  await teacher.waitForFunction(() => /^[A-Z0-9]{5}$/.test(document.querySelector('#classCode').textContent));
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
  await student.click('#step-masterskaya .ver >> nth=0');
  await sleep(500);
  const cur = await student.textContent('#step-masterskaya .ver.cur');
  check('Откат к версии 1 одним кликом', /v1/.test(cur), cur);
  await shot(student, '6-workshop');

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
