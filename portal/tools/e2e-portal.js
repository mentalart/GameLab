#!/usr/bin/env node
// Сквозная проверка портала в браузере: учитель и ученик проходят урок 1 целиком.
// Вау-старт: учитель тянет карты, ученик голосует, учитель тайно меняет секрет, собирает и раздаёт игру класса; «Найди секрет» и сводка.
// Два прогона: с подставным ИИ (mock-ai.js: продюсер, сборка с ошибкой → автопочинка, правка) и в демо-режиме без ключа.
// В прогоне с ИИ — «Играем вместе»: второй ученик собирает игру, оба играют в игры друг друга, бьют рекорд автора,
// бросают вызов на зерне, оставляют плейтест; учитель пишет отзыв; аркада класса и личная аркада, скрытие игры.
// Срез 3: проектор (код, таймер, кто закончил шаг), вау-старт teacher-demo (карты, сборка при всех, автопочинка, «открыть всем»),
// фильтр «застряли», лимиты и «+10 запросов», сравнение моделей, отчёт журнала генераций и CSV, статусы заметок и Markdown;
// Урок 2 в обоих прогонах: донор с ручками из шага, варианты игры, «Найди секрет» донора, квиз-раунды «Игра или не игра?»,
// сортировщик на 8 лотков, Фабрика с донором на выбор и его колодами, черновик ИГРА по правилам донора, сборка, дуэль вдвоём.
// Урок 3 в обоих прогонах: «Ночной лабиринт», предсказание динамики против телеметрии, «Найди секрет», квиз «Угадай охотника по следу»,
// квиз MDA, Фабрика MDA с колодами урока, образец урока в промпте программиста, демо-сборка урока, дуэль с Вожаком (ручка vs), предсказание в плейтесте.
// Урок 4 в обоих прогонах: «Каменный стакан» и его секрет (мешок и предпросмотр), квиз «Собери цикл», Фабрика под донора,
// образец урока в промпте программиста и демо-игра урока, релиз модуля с чек-листом, дуэль двух стаканов по ручке duo.
// Данные и настройки — во временной папке, настоящий portal/config.json и portal/data/ не трогаются.
// Запуск: node portal/tools/e2e-portal.js [--headed]   Снимки — в portal/.check/portal-*.png
'use strict';
const fs = require('fs');
const os = require('os');
const path = require('path');

const TMP = fs.mkdtempSync(path.join(os.tmpdir(), 'lab-e2e-'));
process.env.LAB_DATA = path.join(TMP, 'data');
process.env.LAB_CONFIG = path.join(TMP, 'config.json');
process.env.LAB_LESSONS = path.join(__dirname, 'fixtures', 'lessons'); // урок-проверка шага teacher-demo
const OUT = path.resolve(__dirname, '..', '.check');
fs.mkdirSync(OUT, { recursive: true });

const { chromium } = require('playwright');
const mock = require('./mock-ai');
const ai = require('../lib/ai');
const portal = require('../server');
const lesson1 = require('../lessons/urok-01');
const lesson2 = require('../lessons/urok-02');
const lesson3 = require('../lessons/urok-03');
const lesson4 = require('../lessons/urok-04');
const store = require('../lib/store');

const PASSWORD = 'e2e-пароль';
const results = [];
const check = (what, ok, detail = '') => { results.push({ what, ok: !!ok, detail }); console.log(`  ${ok ? '✓' : '✗'} ${what}${detail ? ' — ' + detail : ''}`); };
const sleep = ms => new Promise(r => setTimeout(r, ms));
let failShots = async () => {};

function writeConfig(aiPart) {
  fs.writeFileSync(process.env.LAB_CONFIG, JSON.stringify({ port: 0, teacherPassword: PASSWORD, ai: aiPart, models: [{ id: 'mock-code', label: 'Подставной программист', rubPer1MIn: 100, rubPer1MOut: 400, rubPer1MCacheRead: 10, rubPer1MCacheWrite: 125, cache: true }, { id: 'mock-text', label: 'Подставной продюсер', rubPer1MIn: 10, rubPer1MOut: 40 }, { id: 'mock-alt', label: 'Подставная вторая модель', rubPer1MIn: 50, rubPer1MOut: 200 }], limits: { aiCallsPerStudentPerLesson: 40, rublesPerLesson: 0 } }, null, 2));
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
  p.on('pageerror', e => errors.push(e.message + ' @ ' + p.url().replace(/^https?:\/\/[^/]+/, '') + ' ' + String(e.stack || '').split('\n').slice(1, 3).join(' ').trim()));
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
  // лишний класс удаляется клавишей Del, пока мышь над списком классов
  await teacher.fill('#newName', 'Лишний ' + mode);
  await teacher.click('#newClass button');
  await teacher.waitForFunction(name => { const o = document.querySelector('#classSel .classrow.on'); return o && o.textContent.startsWith(name); }, 'Лишний ' + mode);
  check('Меню модулей: модуль 1 и урок 1', await teacher.$eval('#moduleSel', s => s.value) === '1' && await teacher.$eval('#lessonSel', s => s.value) === 'urok-01');
  await teacher.hover('#classSel .classrow.on');
  await teacher.keyboard.press('Delete');
  await teacher.waitForFunction(name => ![...document.querySelectorAll('#classSel .classrow')].some(o => o.textContent.startsWith(name)), 'Лишний ' + mode);
  check('Класс удалён клавишей Del', true);
  await teacher.fill('#newName', 'Проверка ' + mode);
  await teacher.click('#newClass button');
  // ждём именно новый класс: до создания панель показывает класс прошлого прогона
  await teacher.waitForFunction(name => { const o = document.querySelector('#classSel .classrow.on'); return o && o.textContent.startsWith(name) && /^[A-Z0-9]{5}$/.test(document.querySelector('#classCode').textContent) && o.textContent.endsWith(document.querySelector('#classCode').textContent); }, 'Проверка ' + mode);
  const code = await teacher.textContent('#classCode');
  check('Учитель создал класс', /^[A-Z0-9]{5}$/.test(code), code);
  await teacher.click('text=Открыть: Вау-старт →');

  // ученик: вход по коду
  await student.goto(base + '/?code=' + code);
  await student.fill('#nick', 'Тестер');
  await student.click('#studentForm button[type=submit]');
  await student.waitForURL('**/student');
  await student.waitForSelector('#step-donor-play');
  check('Ученик вошёл и видит открытый чекпоинт «Вау-старт»', true);
  await shot(student, '1-donor');

  // донор: партия в ремейке
  await student.click('#step-donor-play .veil button');
  const remake = await gameFrame(student, 'game.html');
  await playRound(remake);
  await student.waitForSelector('#step-donor-play.done', { timeout: 10000 });
  check('Партия в ремейке засчитана, шаг готов', true);
  // вызов «побей мой мир» на доноре: экран конца партии обещает кнопку — и она есть; вызов сразу на доске вызовов класса
  const overSeed = await remake.textContent('#overSeed');
  check('Экран конца партии обещает кнопку вызова, и она есть под донором', /«⚔ Вызов: побей мой мир» под игрой/.test(overSeed) && await student.locator('#step-donor-play >> text=⚔ Вызов: побей мой мир').count() === 1, overSeed);
  await student.click('#step-donor-play >> text=⚔ Вызов: побей мой мир');
  await student.waitForSelector('#step-donor-play .chcode');
  await student.waitForSelector('.chboard .chrow.lead', { timeout: 10000 });
  check('Вызов на доноре: код и строка «Твой вызов» на доске вызовов', /Твой вызов «НЛО в станице»/.test(await student.textContent('.chboard')), (await student.textContent('.chboard')).replace(/\s+/g, ' ').slice(0, 120));
  await student.click('#step-donor-hook .opt >> nth=0');
  await student.click('#step-donor-hook >> text=Ответить');
  await student.waitForSelector('#step-donor-hook.done');

  // проектор: код класса и таймер открытого чекпоинта; вау-старт — карты при классе, общая игра с секретом
  const pj = await openProjector(base, code, teacher, errors, shot);
  await wowStart(teacher, student, mode, shot);
  await projectorWow(pj, teacher, shot);

  // учитель открывает все чекпоинты — ученик получает их без перезагрузки
  await teacher.click('.tabs >> text=Урок');
  await teacher.click('text=Открыть все');
  await student.waitForSelector('.cp.open >> nth=7', { timeout: 10000 });
  check('Чекпоинты открылись у ученика без перезагрузки (SSE)', true);

  await secretHunt(teacher, student, mode, shot);

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
  if (mode === 'mock') await compareModels(teacher, shot);
  await teacher.click('#studentDlg >> text=Закрыть');
  await liveLesson(code, mode, teacher, pj, shot);
  await teacher.click('.tabs >> text=Заметки автора');
  await teacher.waitForSelector('#tab-notes .card');
  check('Заметка автора дошла до учителя', (await teacher.textContent('#tab-notes')).includes('Проверка: заметка автора'));
  const inWork = mode === 'mock' ? 1 : 2; // данные общие на оба прогона: заметка первого прогона уже «в работе»
  await teacher.click('#tab-notes .note .chipbtn.st-work');
  await teacher.waitForFunction(n => (document.querySelector('#tab-notes .filters') || {}).textContent?.includes('В работе · ' + n), inWork, { timeout: 5000 }).catch(() => {});
  check('Статус заметки «в работе», фильтр считает', new RegExp('В работе · ' + inWork).test(await teacher.textContent('#tab-notes .filters')));
  const md = await teacher.evaluate(async () => (await fetch(document.querySelector('#notesMd').href)).text());
  check('Заметки выгружаются в Markdown по статусам', /^# Заметки автора курса/.test(md) && new RegExp('## В работе \\(' + inWork + '\\)').test(md) && md.includes('Проверка: заметка автора'), md.split('\n').slice(0, 5).join(' | '));
  await shot(teacher, '8-notes');
  await teacher.click('.tabs >> text=ИИ и расходы');
  await teacher.waitForSelector('#tab-ai h3');
  const aiTab = await teacher.textContent('#tab-ai');
  if (mode === 'mock') {
    check('Журнал генераций считает вызовы и рубли', /Вызовов модели: [1-9]/.test(aiTab) && /mock-code/.test(aiTab), (aiTab.match(/Вызовов модели: [^.]*/) || [''])[0]);
    await teacher.waitForSelector('#report');
    const rows = await teacher.$$eval('#report tbody tr', trs => trs.map(tr => [...tr.cells].map(td => td.textContent.trim())));
    const byM = Object.fromEntries(rows.map(r => [r[0], r]));
    // mock-code: три сборки (две ученические и вау-старт), каждая упала в рамке и починена; mock-alt — сравнение, заработало сразу
    check('Отчёт: mock-code — 2 игры, 0% с первой попытки, все работают после починки', byM['mock-code'] && byM['mock-code'][1] === '2' && byM['mock-code'][2] === '0%' && byM['mock-code'][3] === '100%', JSON.stringify(byM['mock-code']));
    check('Отчёт: mock-alt — 100% с первой попытки, рубли на игру', byM['mock-alt'] && byM['mock-alt'][2] === '100%' && byM['mock-alt'][6] !== '—', JSON.stringify(byM['mock-alt']));
    check('Отчёт: сравнение моделей на одном замысле', /«Пасека под огнём» · Тестер/.test(aiTab) && /mock-alt: ✓ с первой попытки/.test(aiTab));
    const [bom, csvText] = await teacher.evaluate(async () => { const b = new Uint8Array(await (await fetch(document.querySelector('#csvGames').href)).arrayBuffer()); return [[...b.slice(0, 3)].join(','), new TextDecoder().decode(b)]; });
    const lines = csvText.trim().split(/\r?\n/);
    check('CSV по играм: заголовок, строка на игру, «;» и BOM', bom === '239,187,191' && /^Дата;Класс;Ученик/.test(lines[0]) && lines.length === 4 && lines.some(l => l.includes('mock-alt') && l.includes(';да;')), lines.length + ' строк');
    const calls = await teacher.evaluate(async () => (await fetch(document.querySelector('#csvCalls').href)).text());
    check('CSV всех вызовов модели', /Токены вход/.test(calls) && calls.trim().split(/\r?\n/).length > 6);
  } else check('Демо-режим виден учителю', /демо-режим/i.test(aiTab));
  await shot(teacher, '8-ai', true);
  await fixtureLesson(mode, teacher, student, pj, shot);
  await lessonTwo(mode, teacher, student, shot);
  await lessonThree(mode, teacher, student, shot);
  await lessonFour(mode, teacher, student, shot);
  await pj.close();

  check('Без ошибок JavaScript на страницах портала', !errors.length, errors.slice(0, 3).join(' | '));
  await tctx.close(); await sctx.close();
}

/* ---------- вау-старт: карты при классе, сборка общей игры с секретом, раздача ---------- */
async function wowStart(teacher, student, mode, shot) {
  await teacher.click('.tabs >> text=Вау-старт');
  await teacher.waitForSelector('#wowCards .wowcard');
  await teacher.click('#tab-wow >> text=🎲 Тянуть все карты');
  await student.waitForSelector('#step-vau-karty .wowcard.up >> nth=3', { timeout: 10000 });
  check('Карты, которые тянет учитель, появились у ученика сразу (SSE)', await student.locator('#step-vau-karty .wowcard.up').count() === 4);
  await student.click('#step-vau-karty [data-card=hero] >> text=Перетянуть');
  await teacher.waitForSelector('#wowCards >> text=перетянуть: 1', { timeout: 10000 });
  check('Учитель видит голос «перетянуть»', true);
  await teacher.click('#wowCards [data-card=hero] >> text=🎲 Перетянуть');
  await student.waitForFunction(() => !document.querySelector('#step-vau-karty [data-card=hero] .btn.on'), null, { timeout: 10000 });
  check('Перетянутая карта сбросила голоса', true);
  // секрет скрыт, пока учитель его не откроет; кубик и тайная замена
  check('Секрет скрыт на проекторе', !(await teacher.textContent('#wowSecret')).includes('[кубик]'));
  await teacher.click('#wowSecret >> text=Показать');
  await teacher.waitForSelector('#wowSecretSel');
  check('Учитель видит секрет кубика', (await teacher.textContent('#wowSecret')).includes('[кубик]'));
  await teacher.selectOption('#wowSecretSel', 'yarost');
  await teacher.waitForSelector('#wowSecret >> text=выбор учителя', { timeout: 10000 });
  check('Учитель тайно заменил секрет', (await teacher.textContent('#wowSecret')).includes('Под конец игра злится'));
  await teacher.click('#wowSecret >> text=Скрыть');
  await shot(teacher, '1a-wow-cards');
  // сборка: ученики видят, что ИИ собирает игру; учитель проверяет и раздаёт
  await teacher.click('#wowBuild >> text=⚙ Собрать с ИИ');
  await teacher.waitForSelector('#wowBuild >> text=📣 Раздать классу', { timeout: 60000 });
  const info = (await teacher.textContent('#wowBuild')).replace(/\s+/g, ' ');
  if (mode === 'mock') check('ИИ собрал игру класса с ручкой secret и скрытым счётчиком', !/нет ручки secret|не считается/.test(info) && !/запасная игра «/.test(info), info.slice(0, 120));
  else check('Без ключа собралась запасная игра урока', /запасная игра/.test(info), info.slice(0, 120));
  await teacher.click('#wowBuild .veil button');
  await gameFrame(teacher, '/play/', 0);
  await shot(teacher, '1b-wow-preview');
  check('Пока учитель проверяет игру, ученик её не видит', await student.locator('#step-vau-play iframe').count() === 0 && /собирается/.test(await student.textContent('#step-vau-play')));
  await teacher.click('#wowBuild >> text=📣 Раздать классу');
  await student.waitForSelector('#step-vau-karty.done', { timeout: 10000 });
  await student.click('#step-vau-play .veil button');
  const sg = await gameFrame(student, '/play/', 0);
  const knob = mode === 'mock' ? 'secret' : 'speedup';
  check('Ученик получил игру класса', await sg.evaluate(k => window.__lab.cfg[k] === 1, knob), mode === 'mock' ? 'ручка secret = 1' : 'ручка speedup = 1');
  for (let i = 0; i < 2; i++) {
    await sg.evaluate(r => (r ? window.__lab.restart() : window.__lab.confirm()), i > 0);
    await sleep(300);
    await sg.evaluate(() => { window.__lab.lab.count('_secret', 3); window.__lab.lab.score = 50; window.__lab.end('lose', 'Проверка'); });
  }
  await student.waitForSelector('#step-vau-play.done', { timeout: 10000 });
  const overText = await sg.evaluate(() => document.body.innerText);
  check('Скрытый счётчик секрета не виден игроку на экране конца партии', !/_secret/.test(overText));
  await student.click('#step-vau-feel .opt >> nth=1');
  await student.click('#step-vau-feel >> text=Ответить');
  await student.waitForSelector('#step-vau-feel.done');
  await shot(student, '1c-wow-play', true);
}

/* ---------- чекпоинт «Секрет»: та же игра без секрета, «Найди секрет», квиз с карточками игры класса ---------- */
async function secretHunt(teacher, student, mode, shot) {
  await student.click('.cp >> text=Секрет');
  // слепой тест: две копии игры класса, в одной ручка секрета выключена; в копии с секретом он срабатывает 5 раз
  const knob = mode === 'mock' ? 'secret' : 'speedup', seen = {};
  for (const k of ['A', 'B']) {
    await student.click(`#step-secret-ab .ab-${k}`);
    await student.click('#step-secret-ab .veil button');
    const f = await gameFrame(student, '/play/', 0);
    await sleep(600); // setCfg приходит после ready
    seen[k] = await f.evaluate(kn => window.__lab.cfg[kn], knob);
    await f.evaluate(() => window.__lab.confirm());
    await sleep(300);
    await f.evaluate(on => { if (on) { window.__lab.lab.t = 4; window.__lab.lab.count('_secret', 5); window.__lab.lab.t = 9; window.__lab.lab.count('_secret'); } window.__lab.lab.score = on ? 70 : 20; window.__lab.end('lose', 'Проверка'); }, seen[k] === 1);
    await sleep(400);
  }
  const side = seen.A === 1 ? 'A' : 'B';
  check('Слепой тест: в одной копии секрет есть, в другой выключен', (seen.A === 1) !== (seen.B === 1) && [seen.A, seen.B].includes(0), `А: ${knob} = ${seen.A}, Б: ${knob} = ${seen.B}`);
  await student.click(`#step-secret-ab .opt >> text=В игре ${side === 'A' ? 'А' : 'Б'}`);
  await student.waitForSelector('#step-secret-ab.done');
  await student.waitForSelector('#step-secret-hunt .opt');
  const options = await student.locator('#step-secret-hunt .opt').allTextContents();
  const twist = (await teacher.textContent('#wowCards [data-card=twist] .wc-text')).trim(); // вкладка учителя скрыта, но карты в ней остались
  // в прогоне с ИИ ученик попадается в ловушку карт, в демо — угадывает секрет запасной игры
  const pick = mode === 'mock' ? options.find(o => o.toLowerCase() === twist.toLowerCase()) : 'Волна ускоряется, когда врагов становится меньше';
  check('«Найди секрет»: 4 варианта, среди них ловушка с карты', options.length === 4 && options.some(o => o.toLowerCase() === twist.toLowerCase()) && (mode === 'demo' || options.includes('Под конец игра злится')), options.join(' | '));
  await student.click(`#step-secret-hunt .opt >> text=${pick}`);
  await student.click('#step-secret-hunt >> text=Это секрет!');
  await student.waitForSelector('#step-secret-hunt.done');
  const reveal = (await student.textContent('#step-secret-hunt')).replace(/\s+/g, ' ');
  if (mode === 'mock') check('Ловушка распознана, секрет раскрыт: «ярость», счётчик из партий', /Ловушка/.test(reveal) && /Под конец игра злится/.test(reveal) && /сработал 6 раз/.test(reveal), reveal.slice(0, 160));
  else check('Секрет угадан и раскрыт', /Угадал/.test(reveal) && /Нисикадо/.test(reveal), reveal.slice(0, 120));
  check('Раскрытие: слепой тест угадан, моменты секрета на полоске партии', /секрет был именно там/.test(reveal) && await student.locator('#step-secret-hunt .marks i').count() >= 2, `отметок: ${await student.locator('#step-secret-hunt .marks i').count()}`);
  await shot(student, '2a-secret', true);
  await student.click('#step-secret-feel .opt >> nth=0');
  await student.click('#step-secret-feel >> text=Ответить');
  await student.click('#step-secret-story >> text=Понятно');
  // квиз: постоянные карточки + карточки из игры класса (карты и раскрытый секрет)
  const quiz = lesson1.checkpoints.find(c => c.id === 'secret').steps.find(s => s.id === 'secret-quiz');
  const binOf = text => {
    const it = quiz.items.find(x => x.text === text);
    if (it) return it.bin;
    const w = quiz.wowItems.find(x => new RegExp('^' + x.text.replace(/[.*+?^$()|[\]\\]/g, '\\$&').replace(/\{\w+\}/g, '.+') + '$').test(text));
    return w ? w.bin : null;
  };
  await student.click('#step-secret-quiz >> text=▶ Начать');
  const total = Number((/\/\s*(\d+)/.exec(await student.textContent('#step-secret-quiz .hud')) || [])[1]);
  for (let i = 0; i < total; i++) {
    const text = (await student.textContent('#step-secret-quiz .item')).trim();
    const k = quiz.bins.findIndex(b => b.id === binOf(text));
    await student.keyboard.press('Digit' + (k + 1));
    await sleep(1050);
  }
  await student.waitForSelector('#step-secret-quiz.done');
  const quizText = await student.textContent('#step-secret-quiz h2 >> nth=1');
  const all = quiz.items.length + quiz.wowItems.length;
  check('Квиз «Чьё это решение?» с карточками игры класса пройден', new RegExp(`${all} из ${all}`).test(quizText), quizText);
  await shot(student, '2-quiz');
  check('Квиз: результат отправлен учителю, кнопки «Скопировать» у ученика нет', await student.locator('#step-secret-quiz >> text=✓ Результат отправлен учителю').count() === 1 && await student.locator('#step-secret-quiz >> text=Скопировать').count() === 0);
  // вкладка «Ответы»: ответ квиза у учителя, разбор по карточкам, CSV
  await teacher.click('.tabs >> text=Ответы');
  await teacher.click('#tab-answers >> text=2. Секрет');
  await teacher.waitForSelector('#answers tbody tr', { timeout: 10000 });
  const ansText = await teacher.textContent('#tab-answers');
  check('Ответы: квиз ученика у учителя и разбор по карточкам', new RegExp(`верно ${all} из ${all}`).test(ansText) && /какие карточки труднее всего/.test(ansText), (ansText.match(/верно \d+ из \d+/) || [''])[0]);
  const qcsv = await teacher.evaluate(async () => (await fetch(document.querySelector('#csvQuiz').href)).text());
  check('CSV квизов: строка на каждую карточку', /^\uFEFF?Ученик;Квиз;Карточка/.test(qcsv) && qcsv.trim().split(/\r?\n/).length === all + 1, qcsv.trim().split(/\r?\n/).length + ' строк');
  const acsv = await teacher.evaluate(async () => (await fetch(document.querySelector('#csvAnswers').href)).text());
  check('CSV всех ответов ученика', /Ученик;Чекпоинт;Шаг/.test(acsv) && /Квиз «Чьё это решение\?»/.test(acsv));
  // сводка учителя
  await teacher.click('.tabs >> text=Вау-старт');
  await teacher.waitForSelector('#wowSummary td .tag', { timeout: 10000 }); // ждём свежую сводку с догадкой: старая осталась во вкладке с прошлого раза
  const sum = (await teacher.textContent('#wowSummary')).replace(/\s+/g, ' ');
  check('Учитель видит сводку секрета: партии, срабатывания, догадки, слепой тест', /сработал 6 раз/.test(sum) && /почувствовали секрет 1 из 1/.test(sum) && (mode === 'mock' ? /ловушка/.test(sum) : /угадал/.test(sum)), sum.slice(0, 200));
  await shot(teacher, '2b-wow-summary');
  await teacher.click('.tabs >> text=Урок');
}

/* ---------- проектор: код класса и таймер открытого чекпоинта ---------- */
async function openProjector(base, code, teacher, errors, shot) {
  const pj = await teacher.context().newPage();
  watch(pj, errors);
  await pj.setViewportSize({ width: 1600, height: 900 });
  await pj.goto(base + '/projector?code=' + code);
  await pj.waitForSelector('#pjCode');
  check('Проектор: крупно код класса', (await pj.textContent('#pjCode')).trim() === code);
  await pj.waitForFunction(() => /^\d\d:\d\d$/.test(document.querySelector('#pjTimer').textContent), null, { timeout: 5000 });
  const t = await pj.textContent('#pjTimer'), min = String(lesson1.checkpoints[0].minutes).padStart(2, '0');
  check('Проектор: открытый чекпоинт и таймер по minutes урока', /Вау-старт/.test(await pj.textContent('.pj-cp h1')) && new RegExp(`^(${min}:00|${String(min - 1).padStart(2, '0')}:5\\d)$`).test(t), t);
  await shot(pj, 'p1-projector');
  return pj;
}

/* ---------- вау-старт урока 1 на проекторе: те же карты, игра у всех, секрета не видно ---------- */
async function projectorWow(pj, teacher, shot) {
  await pj.click('#demoTab');
  await pj.waitForFunction(() => document.querySelectorAll('.pj-card.on').length === 4, null, { timeout: 15000 });
  await sleep(1000); // барабан карт докрутился
  const cards = await pj.$$eval('.pj-card .cv', bs => bs.map(b => b.textContent.trim()));
  const inPanel = await teacher.$$eval('#wowCards .wc-text', bs => bs.map(b => b.textContent.trim()));
  check('Проектор: те же четыре карты, что у учителя', cards.join('|') === inPanel.join('|'), cards.join(' | '));
  await pj.waitForSelector('#pjWowGame iframe, #pjWowGame .veil', { timeout: 15000 });
  const text = await pj.textContent('#pj-demo');
  check('Проектор: игра класса роздана, секрета на экране нет', /Игра у всех/.test(text) && !lesson1.wow.secrets.some(x => text.includes(x.title)));
  await shot(pj, 'p2-wow');
  // туда и обратно по вкладкам: на проекторе по-прежнему одна рамка игры класса
  await pj.click('.pj-tabs >> text=Урок');
  await pj.click('#demoTab');
  await pj.waitForSelector('#pjWowGame iframe, #pjWowGame .veil', { timeout: 8000 });
  await sleep(500);
  const boxes = await pj.$$eval('#pjWowGame .gamebox', b => b.length);
  check('Проектор: после смены вкладок одна рамка игры', boxes === 1, 'рамок: ' + boxes);
  await pj.click('.pj-tabs >> text=Урок');
}

/* ---------- вау-старт учителя (шаг teacher-demo, урок-проверка): карты на проекторе, сборка при всех, игра у всех ---------- */
async function demoStart(mode, teacher, student, pj, shot) {
  await pj.waitForFunction(() => /Вау-старт/.test((document.querySelector('.pj-cp h1') || {}).textContent) && /^\d\d:\d\d$/.test(document.querySelector('#pjTimer').textContent), null, { timeout: 8000 });
  const t = await pj.textContent('#pjTimer');
  check('Проектор: урок сменился, таймер нового чекпоинта', /^(10:00|09:5\d)$/.test(t), t);
  // ученик: «смотри на проектор»
  await student.waitForSelector('#step-vau-demo .projector-wait', { timeout: 15000 });
  // учитель тянет три карты пробелом на проекторе
  await pj.click('#demoTab');
  await pj.waitForSelector('.pj-card');
  for (let i = 0; i < 3; i++) { await pj.keyboard.press('Space'); await sleep(350); }
  await pj.waitForFunction(() => document.querySelectorAll('.pj-card.on').length === 3, null, { timeout: 8000 });
  await sleep(1000); // барабан карт докрутился
  const cards = await pj.$$eval('.pj-card .cv', bs => bs.map(b => b.textContent.trim()));
  check('teacher-demo: три карты вытянуты (герой, место, поворот)', cards.every(c => c && c !== '?'), cards.join(' | '));
  await student.waitForFunction(c => [...document.querySelectorAll('#step-vau-demo .dcard b')].map(b => b.textContent.trim()).join('|') === c.join('|'), cards, { timeout: 10000 });
  check('teacher-demo: ученик видит карты вживую, без перезагрузки', true);
  await shot(pj, 'p5-demo-cards');
  await pj.click('#pjBuild');
  let pf = await gameFrame(pj, '/play/', 0);
  if (mode === 'mock') { // первая сборка подставного ИИ падает: проектор чинит сам
    await pf.evaluate(() => window.__lab.confirm());
    await pj.waitForFunction(() => /Починил: версия 2/.test(document.querySelector('#pjGame').textContent), null, { timeout: 30000 });
    pf = await gameFrame(pj, '/play/', 0);
    check('teacher-demo: игра собрана при всех, упавшую ИИ починил сам', true);
  } else check('teacher-demo: игра собрана при всех (демо)', true);
  check('Пока учитель не открыл — у ученика «смотри на проектор»', await student.locator('#step-vau-demo .projector-wait').count() === 1);
  await pj.click('#pjOpenAll');
  await student.waitForSelector('#step-vau-demo .gamebox .veil button', { timeout: 10000 });
  await pj.waitForFunction(() => /открыта у всех/.test(document.querySelector('#pjGame').textContent), null, { timeout: 5000 }).catch(() => {});
  check('«Открыть всем»: игра учителя у ученика в рамке', /открыта у всех/.test(await pj.textContent('#pjGame')));
  await shot(pj, 'p6-demo-game');
  await pj.click('.pj-tabs >> text=Урок'); // рамка на проекторе останавливается
  await student.click('#step-vau-demo .veil button');
  const df = await gameFrame(student, '/play/', 0);
  await playRound(df, { score: 50 });
  await student.waitForSelector('#step-vau-demo.done', { timeout: 10000 });
  check('Ученик сыграл в игру класса, шаг teacher-demo готов', true);
  await shot(student, '18-demo-student');
}

/* ---------- живой урок у учителя: проектор, «застряли», лимиты ---------- */
async function liveLesson(code, mode, teacher, pj, shot) {
  // проектор: таймер нового чекпоинта и сколько закончили шаги
  await sleep(2300);
  const pjText = await pj.textContent('.pj-cp');
  check('Проектор: после «Открыть все» таймер у первого нового чекпоинта, видно, кто закончил шаги', /Секрет/.test(await pj.textContent('.pj-cp h1')) && /[1-9] из [12]/.test(pjText), pjText.replace(/\s+/g, ' ').slice(0, 120));
  await shot(pj, 'p4-progress');
  // «застрял»: нет движения 5+ минут (двигаем время прямо в данных ученика)
  const s = store.getStudent(code, 'Тестер');
  s.moved = new Date(Date.now() - 9 * 60e3).toISOString(); store.saveStudent(code, s);
  await teacher.waitForSelector('[data-filter=stuck].hot', { timeout: 10000 });
  await teacher.click('[data-filter=stuck]');
  await teacher.waitForSelector('#students tr.stuck[data-nick="Тестер"]');
  check('Фильтр «застряли»: ученик без движения 9 минут', /застрял: 9 мин/.test(await teacher.textContent('#students')) && (mode !== 'mock' || !(await teacher.textContent('#students')).includes('Соседка')));
  await shot(teacher, '7b-stuck');
  await teacher.click('[data-filter=all]');
  // лимиты: расход урока и «+10 запросов» ученику
  const spendText = await teacher.textContent('.spend');
  check('Расход ИИ урока виден в панели', /ИИ на этом уроке: [\d,]+ ₽/.test(spendText), spendText.replace(/\s+/g, ' ').slice(0, 80));
  await teacher.click('#students tr[data-nick="Тестер"] >> text=+10');
  await teacher.waitForFunction(() => /из 50/.test((document.querySelector('#students tr[data-nick="Тестер"]') || {}).textContent), null, { timeout: 8000 });
  check('Учитель добавил ученику 10 запросов: лимит 50', true);
}

/* ---------- сравнение моделей на одном замысле (в карточке ученика) ---------- */
async function compareModels(teacher, shot) {
  await teacher.fill('#cmpCustom', 'mock-alt');
  await teacher.click('#studentDlg >> text=⚖ Пересобрать другой моделью');
  await teacher.waitForSelector('#studentDlg .cmpbox .seg .opt >> nth=1', { timeout: 30000 });
  await teacher.click('#studentDlg .cmpbox .seg .opt >> nth=1');
  const cf = await gameFrame(teacher, '/play/', 0);
  check('Сравнение: другая модель пересобрала замысел, версия B запускается', await cf.evaluate(() => window.__lab.ready));
  await sleep(600);
  await shot(teacher, '7a-compare');
  await teacher.click('#studentDlg .cmpbox .seg .opt >> nth=0');
  const of = await gameFrame(teacher, '/play/', 0);
  check('Сравнение: версия A — игра ученика в той же рамке', await of.evaluate(() => window.__lab.ready) && /Ученик/.test(await teacher.textContent('#studentDlg .cmpbox .seg .opt.on')));
}

/* ---------- урок-проверка: вау-старт учителя (teacher-demo) ---------- */
async function fixtureLesson(mode, teacher, student, pj, shot) {
  await teacher.click('.tabs >> text=Урок');
  await teacher.selectOption('#moduleSel', '0');
  await teacher.selectOption('#lessonSel', 'urok-90');
  await teacher.waitForSelector('text=Открыть: Вау-старт →', { timeout: 10000 });
  await teacher.click('text=Открыть: Вау-старт →');
  await demoStart(mode, teacher, student, pj, shot);
}

/* ---------- урок 2: донор и одно правило, секрет донора, квизы, Фабрика с донором на выбор, сборка, дуэль ---------- */
const step2 = id => lesson2.checkpoints.flatMap(c => c.steps).find(s => s.id === id);
async function lessonTwo(mode, teacher, student, shot) {
  await teacher.click('.tabs >> text=Урок');
  await teacher.selectOption('#moduleSel', '1');
  await teacher.selectOption('#lessonSel', 'urok-02');
  await teacher.waitForSelector('text=Открыть все', { timeout: 10000 });
  await teacher.click('text=Открыть все');
  await student.waitForSelector('#step-donor-play', { timeout: 15000 }); // смена урока перезагрузила страницу ученика
  check('Урок 2 открылся у ученика', /Урок 2/.test(await student.textContent('#lessonTitle')));

  // донор: классика против мудреца — ручки из шага (rule 0, 3 партии) доходят до игры
  await student.click('#step-donor-play .veil button');
  let gf = await gameFrame(student, 'kamni-mudreca', 0);
  await gf.waitForFunction(() => window.__lab.cfg.rule === 0 && window.__lab.cfg.games === 3, null, { timeout: 5000 }).catch(() => {});
  check('Донор урока 2: «Камни мудреца» в классике, матч из трёх партий', await gf.evaluate(() => window.__lab.cfg.rule === 0 && window.__lab.cfg.games === 3 && window.__lab.cfg.vs === 0));
  await gf.evaluate(() => window.__lab.confirm());
  await sleep(300);
  await gf.evaluate(() => { window.__lab.lab.count('ничьи', 3); window.__lab.lab.score = 75; window.__lab.end('win', 'Проверка'); });
  await student.waitForSelector('#step-donor-play.done', { timeout: 10000 });
  await student.click('#step-donor-hook .opt >> nth=0');
  await student.click('#step-donor-hook >> text=Ответить');
  await student.waitForSelector('#step-donor-hook.done');
  await shot(student, '20-u2-donor');

  // одно правило: варианты игры кнопками, секрет считается скрытым счётчиком
  await student.click('.cp >> text=Секрет');
  await student.click('#step-secret-play .seg .opt >> nth=1');
  await student.click('#step-secret-play .veil button');
  gf = await gameFrame(student, 'kamni-mudreca', 0);
  await gf.waitForFunction(() => window.__lab.cfg.rule === 2, null, { timeout: 5000 }).catch(() => {});
  check('Вариант «Ветер с Фишта» включил правило 2', await gf.evaluate(() => window.__lab.cfg.rule === 2));
  await gf.evaluate(() => window.__lab.confirm());
  await sleep(300);
  await gf.evaluate(() => { window.__lab.lab.count('_secret', 4); window.__lab.lab.count('победы', 1); window.__lab.lab.score = 150; window.__lab.end('win', 'Проверка'); });
  await student.waitForSelector('#step-secret-play.done', { timeout: 10000 });

  // «Найди секрет» донора: ответ — с сервера только после догадки
  const hunt = step2('secret-hunt').hunt;
  const me = await student.evaluate(async () => JSON.stringify(await (await fetch('/api/me', { headers: { 'x-lab-token': Lab.token.get() } })).json()));
  check('Ответ «Найди секрет» не уходит ученику заранее', me.includes(hunt.question) && !me.includes('"trapText"') && !me.includes(hunt.reveal.slice(0, 30)));
  await student.waitForSelector('#step-secret-hunt .opt');
  const pick = mode === 'mock' ? hunt.trap : hunt.right;
  await student.click(`#step-secret-hunt .opt >> text=${pick}`);
  await student.click('#step-secret-hunt >> text=Ответить');
  await student.waitForSelector('#step-secret-hunt.done');
  const reveal = (await student.textContent('#step-secret-hunt')).replace(/\s+/g, ' ');
  check(mode === 'mock' ? 'Секрет донора: ловушка «мудрец поддавался» распознана' : 'Секрет донора угадан: неопределённость исхода',
    (mode === 'mock' ? /Ловушка! Мудрец не поддавался/.test(reveal) : /Точно!/.test(reveal)) && /Неопределённость исхода/.test(reveal), reveal.slice(0, 120));
  check('Сравнение: классика и одно правило, счётчики телеметрии и секрет', /ничьи 3/.test(reveal) && /победы 1/.test(reveal) && /секрет сработал 4 раз/.test(reveal), (reveal.match(/С одним правилом.*?Классика[^О]*/) || [''])[0].slice(0, 160));
  await shot(student, '21-u2-secret', true);
  await student.click('#step-secret-story >> text=Понятно');

  // квиз-раунды «Игра или не игра?»: свайп, кнопка с ошибкой, клавиши
  const quiz = step2('igra-ili-net');
  await student.click('#step-igra-ili-net >> text=▶ Начать');
  let wrong = null;
  for (let i = 0; i < quiz.items.length; i++) {
    const text = (await student.textContent('#step-igra-ili-net .rcard')).trim();
    const it = quiz.items.find(x => x.text === text);
    if (i === 0) { // свайп карточки мышью
      const b = await student.locator('#step-igra-ili-net .rcard').boundingBox();
      await student.mouse.move(b.x + b.width / 2, b.y + b.height / 2); await student.mouse.down();
      await student.mouse.move(b.x + b.width / 2 + (it.side === 'left' ? -160 : 160), b.y + b.height / 2, { steps: 6 }); await student.mouse.up();
    } else if (i === 1) { wrong = it; await student.click(`#step-igra-ili-net .rbtn.${it.side === 'left' ? 'right' : 'left'}`); } // нарочно ошибаемся кнопкой
    else await student.keyboard.press(it.side === 'left' ? 'ArrowLeft' : 'KeyD');
    await student.waitForSelector('#step-igra-ili-net .rcard.good, #step-igra-ili-net .rcard.bad');
    if (i === 1) check('Раунды: после ошибки — разбор с объяснением', (await student.textContent('#step-igra-ili-net .why')).includes(it.why));
    if (i === 2) await shot(student, '16-rounds');
    await student.keyboard.press('Space');
  }
  await student.waitForSelector('#step-igra-ili-net.done');
  const res = await student.textContent('#step-igra-ili-net h2 >> nth=1');
  check('Квиз «Игра или не игра?» в уроке 2: свайп, кнопки, клавиши, итог', /11 из 12/.test(res) && (await student.textContent('#step-igra-ili-net')).includes(wrong.text), res);
  check('Итог раундов: результат у учителя', await student.locator('#step-igra-ili-net >> text=✓ Результат отправлен учителю').count() === 1);
  await shot(student, '17-rounds-result');

  // сортировщик на 8 лотков: цифры и стрелки с пробелом, одна ошибка — подсказка лотка
  const det = step2('detali');
  await student.click('#step-detali >> text=▶ Начать');
  check('Сортировщик: 8 лотков с примерами', await student.locator('#step-detali .bins.many .bin').count() === 8 && await student.locator('#step-detali .bin small').count() === 8);
  for (let i = 0; i < det.items.length; i++) {
    const text = (await student.textContent('#step-detali .item')).trim();
    const k = det.bins.findIndex(b => b.id === det.items.find(x => x.text === text).bin);
    if (i === 0) { // ошибка: соседний лоток — после неё подсказка
      await student.keyboard.press('Digit' + (((k + 1) % 8) + 1));
      await student.waitForSelector('#step-detali .item.bad');
      check('Сортировщик: после ошибки — подсказка лотка', (await student.textContent('#step-detali .why')).includes('Подсказка: ' + det.bins[k].hint), (await student.textContent('#step-detali .why')).slice(0, 100));
      await shot(student, '22-u2-detali');
      await sleep(3400);
      continue;
    }
    if (i === 1) { for (let n = 0; n < k; n++) await student.keyboard.press('ArrowRight'); await student.keyboard.press('Space'); } // стрелками и пробелом
    else await student.keyboard.press('Digit' + (k + 1));
    await sleep(1050);
  }
  await student.waitForSelector('#step-detali.done', { timeout: 10000 });
  const dres = await student.textContent('#step-detali h2 >> nth=1');
  check('Квиз «Разбери игру на детали» пройден', new RegExp(`${det.items.length - 1} из ${det.items.length}`).test(dres), dres);

  // Фабрика: донор на выбор, кубики из колоды выбранной классики
  await student.click('.cp >> text=Фабрика');
  await student.click('#step-fabrika [data-donor=pong]');
  await student.click('#step-fabrika >> text=🎲 Кубик для пустых полей');
  const pong = step2('fabrika').donors.find(d => d.id === 'pong');
  const twist = await student.inputValue('#f-fabrikatwist');
  check('Кубик правила — из колоды пинг-понга, а не другой классики', pong.decks.twist.includes(twist), twist);
  await student.fill('#f-fabrikatitle', 'Сыр над пропастью');
  await student.click('#step-fabrika >> text=Замысел готов');
  await student.waitForSelector('#step-fabrika.done');
  for (let i = 0; i < 3; i++) await student.click(`#step-resheniya .dicebtn >> nth=${i}`);
  await student.click('#step-resheniya >> text=Решения приняты');
  await student.waitForSelector('#step-resheniya.done');
  await shot(student, '23-u2-fabrika', true);
  await student.click('.cp >> text=Промпт ИГРА');
  const r = await student.inputValue('#f-igrar');
  check('Черновик ИГРА: правила выбранной классики и наказание', r.includes('Две ракетки') && r.includes(twist) && /Наказание за ошибку/.test(r), r.slice(0, 90));
  await student.click('#step-igra >> text=Промпт готов');
  await student.click('#step-prodyuser >> text=Отдать замысел продюсеру');
  await student.waitForSelector('#step-prodyuser .fork .opt', { timeout: 30000 });
  await student.click('#step-prodyuser .fork .opt >> nth=0');
  await student.waitForSelector('#step-prodyuser.done');

  // сборка: в аркаде у игры донор — выбранная классика
  await student.click('.cp >> text=Сборка');
  await student.click('#step-sborka >> text=⚙ Собрать игру');
  let own = await gameFrame(student, '/play/', 0);
  if (mode === 'mock') {
    await own.evaluate(() => window.__lab.confirm());
    await student.waitForFunction(() => document.querySelectorAll('#step-sborka .ver').length >= 2, null, { timeout: 30000 });
    own = await gameFrame(student, '/play/', 0);
  }
  await playRound(own);
  await student.waitForSelector('#step-sborka.done', { timeout: 10000 });
  const card = await student.evaluate(async () => (await (await fetch('/api/arcade', { headers: { 'x-lab-token': Lab.token.get() } })).json()).mine.find(c => c.lesson && c.lesson.id === 'urok-02'));
  check('Игра урока 2 собрана, в аркаде донор — выбранная классика', card && card.title === 'Сыр над пропастью' && card.donor === 'Пинг-понг', card ? `${card.title} · ${card.donor}` : 'нет карточки');

  // дуэль вдвоём за одним экраном
  await student.click('.cp >> text=Играем вместе');
  await student.click('#step-duel .veil button');
  gf = await gameFrame(student, 'kamni-mudreca', 0);
  await gf.waitForFunction(() => window.__lab.cfg.vs === 1 && window.__lab.cfg.rule === 0, null, { timeout: 5000 }).catch(() => {});
  check('Дуэль: «Камни мудреца» вдвоём, первый вариант — классика', await gf.evaluate(() => window.__lab.cfg.vs === 1 && window.__lab.cfg.rule === 0));
  await gf.evaluate(() => window.__lab.confirm());
  await gf.locator('#cv').focus();
  for (const k of ['Space', 'Space']) { await student.keyboard.press(k); await sleep(700); } // солнце в центр, луна — курсор занят, сдвиг не нужен: ждём ход лун
  const placed = await gf.evaluate(() => window.__lab.lab.state.pos.b.filter(Boolean).length);
  check('Дуэль: оба игрока ходят одними кнопками', placed >= 1, `камней на доске: ${placed}`);
  await gf.evaluate(() => window.__lab.end('win', 'Проверка'));
  await student.waitForSelector('#step-duel.done', { timeout: 10000 });
  await shot(student, '24-u2-duel');
}

/* ---------- урок 3: донор Pac-Man, предсказание динамики, секрет донора, квиз по следу, MDA, Фабрика MDA, сборка, дуэль ---------- */
const step3 = id => lesson3.checkpoints.flatMap(c => c.steps).find(s => s.id === id);
async function lessonThree(mode, teacher, student, shot) {
  await teacher.click('.tabs >> text=Урок');
  await teacher.selectOption('#moduleSel', '1');
  await teacher.selectOption('#lessonSel', 'urok-03');
  await teacher.waitForSelector('text=Открыть все', { timeout: 10000 });
  await teacher.click('text=Открыть все');
  await student.waitForSelector('#step-donor-play', { timeout: 15000 });
  await student.waitForFunction(() => /Урок 3/.test(document.querySelector('#lessonTitle').textContent), null, { timeout: 15000 });
  check('Урок 3 открылся у ученика', /Урок 3/.test(await student.textContent('#lessonTitle')));

  // донор: «Ночной лабиринт» с секретом, счётчики динамики копятся в шаге
  await student.click('#step-donor-play .veil button');
  let gf = await gameFrame(student, 'nochnoy-labirint', 0);
  check('Донор урока 3: «Ночной лабиринт» с секретом', await gf.evaluate(() => window.__lab.cfg.secret === 1 && GAME.donor === 'Pac-Man'));
  await gf.evaluate(() => window.__lab.confirm());
  await sleep(600);
  check('Волки выходят из дольмена и ходят по лабиринту', await gf.evaluate(() => window.__lab.lab.state.wolves.length === 4 && window.__lab.lab.state.wolves[0].state === 'active'));
  await gf.evaluate(() => { const l = window.__lab.lab; l.count('окружения', 5); l.count('хвост', 1); l.count('прогнал волков', 2); l.count('_secret', 40); l.score = 900; window.__lab.end('lose', 'Проверка'); });
  await student.waitForSelector('#step-donor-play.done', { timeout: 10000 });
  await student.click('#step-donor-hook .opt >> nth=0');
  await student.click('#step-donor-hook >> text=Ответить');
  await student.waitForSelector('#step-donor-hook.done');
  await shot(student, '30-u3-donor');

  // предсказание динамики → партия с одним правилом → сравнение с телеметрией шага
  await student.click('.cp >> text=Секрет');
  const pred = step3('secret-predict'), tail = pred.options.find(o => o.counter === 'хвост');
  await student.click(`#step-secret-predict .opt >> text=${tail.text}`);
  await student.click('#step-secret-predict >> text=🔮 Записать предсказание');
  await student.waitForSelector('#step-secret-predict >> text=Теперь сыграй');
  await student.click('#step-secret-play .veil button');
  gf = await gameFrame(student, 'nochnoy-labirint', 0);
  await gf.waitForFunction(() => window.__lab.cfg.secret === 0, null, { timeout: 5000 }).catch(() => {});
  check('Партия «одно правило»: секрет выключен из шага', await gf.evaluate(() => window.__lab.cfg.secret === 0));
  await gf.evaluate(() => window.__lab.confirm());
  await sleep(300);
  await gf.evaluate(() => { const l = window.__lab.lab; l.count('хвост', 6); l.count('окружения', 1); l.score = 400; window.__lab.end('lose', 'Проверка'); });
  await student.waitForSelector('#step-secret-play.done', { timeout: 10000 });
  await student.waitForSelector('#step-secret-predict .prow', { timeout: 10000 });
  const ptext = (await student.textContent('#step-secret-predict')).replace(/\s+/g, ' ');
  check('Предсказание сравнилось с телеметрией без перезагрузки: хвост — главная динамика', /Предсказание сбылось/.test(ptext) && await student.locator('#step-secret-predict .prow.top').count() === 1 && (await student.textContent('#step-secret-predict .prow.top')).includes(tail.text), ptext.slice(0, 140));
  await student.click('#step-secret-predict >> text=Понятно, дальше');
  await student.waitForSelector('#step-secret-predict.done');
  await shot(student, '31-u3-predict');

  // «Найди секрет» донора: ответ только после догадки, сравнение четырёх характеров и одного правила
  const hunt = step3('secret-hunt').hunt;
  const me = await student.evaluate(async () => JSON.stringify(await (await fetch('/api/me', { headers: { 'x-lab-token': Lab.token.get() } })).json()));
  check('Ответ «Найди секрет» урока 3 не уходит ученику заранее', me.includes(hunt.question) && !me.includes(hunt.reveal.slice(0, 30)));
  await student.waitForSelector('#step-secret-hunt .opt');
  await student.click(`#step-secret-hunt .opt >> text=${mode === 'mock' ? hunt.trap : hunt.right}`);
  await student.click('#step-secret-hunt >> text=Ответить');
  await student.waitForSelector('#step-secret-hunt.done');
  const reveal = (await student.textContent('#step-secret-hunt')).replace(/\s+/g, ' ');
  check(mode === 'mock' ? 'Секрет урока 3: ловушка «волки быстрее» распознана' : 'Секрет урока 3 угадан: четыре характера',
    (mode === 'mock' ? /Ловушка! Скорость волков/.test(reveal) : /Точно!/.test(reveal)) && /Четыре характера и передышка/.test(reveal), reveal.slice(0, 120));
  // к счётчикам из проверки добавляется то, что волки успели сами за партию, поэтому — «не меньше»
  const num = re => Number((re.exec(reveal) || [])[1] || -1), offPart = reveal.slice(reveal.indexOf('Одно правило'));
  check('Сравнение: окружения и хвост с секретом и без, секрет сработал', num(/Четыре характера.*?окружения (\d+)/) >= 5 && Number((/хвост (\d+)/.exec(offPart) || [])[1] || -1) >= 6 && num(/секрет сработал (\d+) раз/) >= 40, reveal.slice(reveal.indexOf('Четыре характера'), reveal.indexOf('Четыре характера') + 160));
  await student.click('#step-secret-story >> text=Понятно');

  // квиз «Угадай охотника по следу»: лабиринт на холсте, ответы цифрами и стрелками с пробелом, после ответа — цель охотника
  const sled = step3('sled');
  await student.click('#step-sled >> text=▶ Начать');
  await student.waitForSelector('#step-sled canvas');
  check('Квиз по следу: лабиринт и кнопки правил', await student.locator('#step-sled .bin').count() === sled.rules.length);
  let shotDone = false;
  for (let i = 0; i < sled.rounds; i++) {
    await sleep(400);
    if (i === 1) { await student.keyboard.press('ArrowRight'); await student.keyboard.press('Space'); } // второй правило стрелкой и пробелом
    else await student.keyboard.press('Digit' + ((i % sled.rules.length) + 1));
    // разбор читаем сразу: через пару секунд квиз сам переходит к следующему охотнику
    const w = await (await student.waitForFunction(() => { const e = document.querySelector('#step-sled .why'); return !!e && /^(Верно!|Это «|Время вышло)/.test(e.textContent) && e.textContent; }, null, { timeout: 5000 })).jsonValue();
    if (!shotDone) { await shot(student, '32-u3-sled'); shotDone = true; }
    if (i === 0) check('Квиз по следу: разбор правила после ответа', /^(Верно!|Это «)/.test(w) && sled.rules.some(r => w.includes(r.why)), w.slice(0, 80));
    await student.waitForFunction(n => { const h = document.querySelector('#step-sled .hud'); return !h || !h.isConnected || !h.textContent.startsWith(n + ' /') || document.querySelector('#step-sled.done'); }, i + 1, { timeout: 6000 });
  }
  await student.waitForSelector('#step-sled.done', { timeout: 10000 });
  const sres = await student.textContent('#step-sled h2 >> nth=1');
  check('Квиз «Угадай охотника по следу» пройден, итог с ошибками', new RegExp(`из ${sled.rounds}`).test(sres) && await student.locator('#step-sled >> text=⧉ Скопировать результат').count() === 1, sres);

  // квиз «Механика, динамика или эстетика?»
  const mda = step3('mda');
  await student.click('#step-mda >> text=▶ Начать');
  for (let i = 0; i < mda.items.length; i++) {
    const text = (await student.textContent('#step-mda .item')).trim();
    await student.keyboard.press('Digit' + (mda.bins.findIndex(b => b.id === mda.items.find(x => x.text === text).bin) + 1));
    await sleep(1050);
  }
  await student.waitForSelector('#step-mda.done', { timeout: 10000 });
  check('Квиз «Механика, динамика или эстетика?» пройден', new RegExp(`${mda.items.length} из ${mda.items.length}`).test(await student.textContent('#step-mda h2 >> nth=1')));

  // Фабрика MDA: кубики из колод урока, удовольствие и предсказание динамики
  await student.click('.cp >> text=Фабрика');
  await student.click('#step-fabrika >> text=🎲 Кубик для пустых полей');
  const fab = step3('fabrika'), F = id => fab.fields.find(f => f.id === id);
  const hunters = await student.inputValue('#f-fabrikahunters'), dyn = await student.inputValue('#f-fabrikadynamic');
  check('Кубики Фабрики — из колод урока 3: охотники, удовольствие, динамика', F('hunters').deck.includes(hunters) && F('pleasure').deck.includes(await student.inputValue('#f-fabrikapleasure')) && F('dynamic').deck.includes(dyn), hunters.slice(0, 60));
  await student.fill('#f-fabrikatitle', 'Пасека в полночь');
  await student.click('#step-fabrika >> text=Замысел готов');
  await student.waitForSelector('#step-fabrika.done');
  for (let i = 0; i < 3; i++) await student.click(`#step-resheniya .dicebtn >> nth=${i}`);
  await student.click('#step-resheniya >> text=Решения приняты');
  await student.waitForSelector('#step-resheniya.done');
  await student.click('.cp >> text=Промпт ИГРА');
  const r = await student.inputValue('#f-igrar');
  check('Черновик ИГРА урока 3: характеры охотников и сила', r.includes(hunters) && /одно правило выбора пути/.test(r) && r.includes('Сила:'), r.slice(0, 90));
  await student.click('#step-igra >> text=Промпт готов');
  await student.click('#step-prodyuser >> text=Отдать замысел продюсеру');
  await student.waitForSelector('#step-prodyuser .fork .opt', { timeout: 30000 });
  if (mode !== 'mock') check('Демо-продюсер урока 3 спрашивает про характеры охотников', (await student.textContent('#step-prodyuser')).includes(lesson3.demoForks[0].question));
  await student.click('#step-prodyuser .fork .opt >> nth=0');
  await student.waitForSelector('#step-prodyuser.done');

  // сборка: программист получает образец урока 3, демо-режим собирает «Ночной лабиринт» с названием ученика
  await student.click('.cp >> text=Сборка');
  await student.click('#step-sborka >> text=⚙ Собрать игру');
  let own = await gameFrame(student, '/play/', 0);
  if (mode === 'mock') {
    check('Программисту ушёл образец урока 3', mock.last.system.includes("title: 'Ночной лабиринт'") && !mock.last.system.includes("title: 'Камни мудреца'") && mock.last.system.includes('лабиринт по клеткам с охотниками'));
    await own.evaluate(() => window.__lab.confirm());
    await student.waitForFunction(() => document.querySelectorAll('#step-sborka .ver').length >= 2, null, { timeout: 30000 });
    own = await gameFrame(student, '/play/', 0);
  } else check('Демо-сборка урока 3 — «Ночной лабиринт» с названием ученика', await own.evaluate(() => GAME.title === 'Пасека в полночь' && GAME.donor === 'Pac-Man'));
  await playRound(own);
  await student.waitForSelector('#step-sborka.done', { timeout: 10000 });

  // дуэль: второй игрок ведёт Вожака — ручка vs включает двух игроков (поле duo)
  await student.click('.cp >> text=Играем вместе');
  await student.click('#step-duel .veil button');
  gf = await gameFrame(student, 'nochnoy-labirint', 0);
  await gf.waitForFunction(() => window.__lab.cfg.vs === 1 && window.__lab.lab.players === 2, null, { timeout: 5000 }).catch(() => {});
  check('Дуэль: ручка «Второй игрок» включила двух игроков', await gf.evaluate(() => window.__lab.cfg.vs === 1 && window.__lab.lab.players === 2 && window.__lab.lab.state.wolves[0].human === true));
  await gf.evaluate(() => window.__lab.confirm());
  await gf.waitForFunction(() => window.__lab.state === 'play' && !window.__lab.paused, null, { timeout: 5000 }).catch(() => {});
  await gf.locator('#cv').focus();
  await sleep(400);
  await gf.evaluate(() => { if (window.__lab.paused) window.__lab.confirm(); });
  await student.keyboard.down('ArrowUp');
  await gf.waitForFunction(() => window.__lab.lab.p2.y > 0.5, null, { timeout: 3000 }).catch(() => {});
  const split = await gf.evaluate(() => [window.__lab.lab.p1.y, window.__lab.lab.p2.y, window.__lab.state, window.__lab.paused, document.hasFocus(), (document.activeElement || {}).id]);
  await student.keyboard.up('ArrowUp');
  check('Дуэль: стрелки — у второго игрока (Вожак), не у пастушка', split[0] === 0 && split[1] > 0.5, JSON.stringify(split));
  await gf.evaluate(() => window.__lab.end('lose', 'Проверка'));
  await student.waitForSelector('#step-duel.done', { timeout: 10000 });
  await shot(student, '33-u3-duel');

  // плейтест: рядом с открытием плейтеста — предсказание автора из Фабрики
  await student.waitForSelector('#step-pleytest >> text=Твоё предсказание из Фабрики', { timeout: 10000 });
  check('Плейтест урока 3 показывает предсказание динамики автора', (await student.textContent('#step-pleytest')).includes(dyn));
}

/* ---------- урок 4: «Каменный стакан», секрет «мешок и предпросмотр», квиз «Собери цикл», Фабрика, образец урока для ИИ, релиз модуля, дуэль ---------- */
const step4 = id => lesson4.checkpoints.flatMap(c => c.steps).find(s => s.id === id);
async function lessonFour(mode, teacher, student, shot) {
  await teacher.click('.tabs >> text=Урок');
  await teacher.selectOption('#moduleSel', '1');
  await teacher.selectOption('#lessonSel', 'urok-04');
  await teacher.waitForSelector('text=Открыть все', { timeout: 10000 });
  await teacher.click('text=Открыть все');
  await student.waitForSelector('#step-donor-play', { timeout: 15000 });
  await student.waitForFunction(() => /Урок 4/.test(document.querySelector('#lessonTitle').textContent), null, { timeout: 15000 });
  check('Урок 4 открылся у ученика', /Урок 4 · Глагол и основной цикл/.test(await student.textContent('#lessonTitle')));

  // донор: «Каменный стакан» как задумано — мешок и три камня в предпросмотре, один стакан
  await student.click('#step-donor-play .veil button');
  let gf = await gameFrame(student, 'kamennyi-stakan', 0);
  check('Донор урока 4: «Каменный стакан» с мешком и предпросмотром', await gf.evaluate(() => window.__lab.cfg.bag === 1 && window.__lab.cfg.preview === 3 && window.__lab.cfg.vs === 0 && window.__lab.lab.players === 1));
  await gf.evaluate(() => window.__lab.confirm());
  await sleep(300);
  await gf.evaluate(() => { window.__lab.lab.count('линии', 3); window.__lab.lab.score = 300; window.__lab.end('lose', 'Проверка'); });
  await student.waitForSelector('#step-donor-play.done', { timeout: 10000 });
  await student.click('#step-donor-hook .opt >> nth=1');
  await student.click('#step-donor-hook >> text=Ответить');
  await student.waitForSelector('#step-donor-hook.done');

  // тот же стакан без секрета: ручки из шага выключают мешок и предпросмотр
  await student.click('.cp >> text=Секрет');
  await student.click('#step-secret-play .veil button');
  gf = await gameFrame(student, 'kamennyi-stakan', 0);
  await gf.waitForFunction(() => window.__lab.cfg.bag === 0 && window.__lab.cfg.preview === 0, null, { timeout: 5000 }).catch(() => {});
  check('Без секрета: мешок и предпросмотр выключены ручками шага', await gf.evaluate(() => window.__lab.cfg.bag === 0 && window.__lab.cfg.preview === 0));
  await gf.evaluate(() => window.__lab.confirm());
  await sleep(300);
  await gf.evaluate(() => { window.__lab.lab.count('засухи', 2); window.__lab.lab.count('линии', 1); window.__lab.lab.score = 90; window.__lab.end('lose', 'Проверка'); });
  await student.waitForSelector('#step-secret-play.done', { timeout: 10000 });

  const hunt = step4('secret-hunt').hunt;
  const me = await student.evaluate(async () => JSON.stringify(await (await fetch('/api/me', { headers: { 'x-lab-token': Lab.token.get() } })).json()));
  check('Урок 4: ответ «Найди секрет» не уходит ученику заранее', me.includes(hunt.question) && !me.includes(hunt.reveal.slice(0, 30)));
  await student.waitForSelector('#step-secret-hunt .opt');
  await student.click(`#step-secret-hunt .opt >> text=${mode === 'mock' ? hunt.trap : hunt.right}`);
  await student.click('#step-secret-hunt >> text=Ответить');
  await student.waitForSelector('#step-secret-hunt.done');
  const reveal = (await student.textContent('#step-secret-hunt')).replace(/\s+/g, ' ');
  check(mode === 'mock' ? 'Секрет урока 4: ловушка «падали медленнее» распознана' : 'Секрет урока 4 угадан: мешок и предпросмотр',
    (mode === 'mock' ? /Ловушка! Скорость не менялась/.test(reveal) : /Точно!/.test(reveal)) && /Предпросмотр и «мешок»/.test(reveal), reveal.slice(0, 120));
  check('Сравнение: линии и засухи с мешком и без, мешок сработал', /линии 3/.test(reveal) && /засухи 2/.test(reveal) && /секрет сработал [1-9]\d* раз/.test(reveal), (reveal.match(/С мешком.*?вслепую[^О]*/) || [''])[0].slice(0, 200));
  await shot(student, '30-u4-secret', true);
  await student.click('#step-secret-story >> text=Понятно');

  // квиз «Собери цикл»: ошибка с чужой карточкой и мышь, клавиши 1–4, стрелки с пробелом
  const quiz = step4('sobery-cikl');
  await student.click('#step-sobery-cikl >> text=▶ Начать');
  for (let r = 0; r < quiz.rounds.length; r++) {
    const name = (await student.textContent('#step-sobery-cikl .cyc-game')).trim();
    const rd = quiz.rounds.find(x => name.endsWith(x.game));
    const texts = await student.$$eval('#step-sobery-cikl .cyc-card', bs => bs.map(b => b.textContent.slice(1)));
    if (r === 0) { // чужая карточка — подсказка, потом по порядку мышью
      await student.click(`#step-sobery-cikl .cyc-card >> nth=${texts.indexOf(rd.decoy)}`);
      check('Собери цикл: чужая карточка — подсказка «из другой игры»', /из другой игры/.test(await student.textContent('#step-sobery-cikl .why')));
      await shot(student, '31-u4-cycle');
      for (const c of rd.cards) await student.click(`#step-sobery-cikl .cyc-card >> nth=${texts.indexOf(c)}`);
    } else if (r === 1) { // стрелками и пробелом
      for (const c of rd.cards) {
        const want = texts.indexOf(c);
        for (let n = 0; n < 4 && await student.$eval('#step-sobery-cikl', (b, w) => [...b.querySelectorAll('.cyc-card')].findIndex(x => x.classList.contains('cur')) !== w, want); n++) await student.keyboard.press('ArrowRight');
        await student.keyboard.press('Space');
      }
    } else for (const c of rd.cards) await student.keyboard.press('Digit' + (texts.indexOf(c) + 1));
    await student.waitForSelector('#step-sobery-cikl .cyc-ring.closed');
    if (r === 0) check('Цикл замкнулся: разбор после раунда', (await student.textContent('#step-sobery-cikl .why')).includes(rd.why));
    await student.keyboard.press('Space');
  }
  await student.waitForSelector('#step-sobery-cikl.done');
  const cres = await student.textContent('#step-sobery-cikl h2 >> nth=1');
  check('Квиз «Собери цикл»: мышь, стрелки, цифры, итог', new RegExp(`${quiz.rounds.length - 1} из ${quiz.rounds.length} без ошибок`).test(cres) && await student.locator('#step-sobery-cikl >> text=⧉ Скопировать результат').count() === 1, cres);
  await shot(student, '32-u4-cycle-result');

  // Фабрика под донора: колода твистов падающих фигур, своё название и вид фигур
  await student.click('.cp >> text=Фабрика');
  check('Фабрика урока 4: карта донора «Тетрис»', (await student.textContent('#step-fabrika .donor-card')).includes('🧱'));
  await student.click('#step-fabrika >> text=🎲 Кубик для пустых полей');
  const fab = step4('fabrika'), twist = await student.inputValue('#f-fabrikatwist');
  check('Кубик твиста — из колоды падающих фигур', fab.fields.find(f => f.id === 'twist').deck.includes(twist), twist);
  await student.fill('#f-fabrikatitle', 'Сырная башня');
  await student.click('#step-fabrika >> text=Замысел готов');
  await student.waitForSelector('#step-fabrika.done');
  for (let i = 0; i < 3; i++) await student.click(`#step-resheniya .dicebtn >> nth=${i}`);
  await student.click('#step-resheniya >> text=Решения приняты');
  await student.waitForSelector('#step-resheniya.done');
  await student.click('.cp >> text=Промпт ИГРА');
  const r = await student.inputValue('#f-igrar'), reward = await student.evaluate(() => S.answers.fabrika.value.fields.reward.text);
  check('Черновик ИГРА урока 4: стакан, твист и награда за линию', r.includes('стакан 10 × 20') && r.includes(twist) && r.includes(reward), r.slice(0, 90));
  await student.click('#step-igra >> text=Промпт готов');
  await student.click('#step-prodyuser >> text=Отдать замысел продюсеру');
  await student.waitForSelector('#step-prodyuser .fork .opt', { timeout: 30000 });
  if (mode === 'demo') check('Демо-продюсер: развилки под донора урока, а не волна пришельцев', (await student.textContent('#step-prodyuser')).includes(lesson4.demoForks[0].question));
  const forks = await student.locator('#step-prodyuser .fork').count();
  for (let i = 0; i < forks; i++) await student.click(`#step-prodyuser .fork >> nth=${i} >> .opt >> nth=0`); // шаг готов, когда выбраны все развилки
  await student.waitForSelector('#step-prodyuser.done');

  // сборка: программист получает образец урока — «Каменный стакан»; демо-игра урока — тоже он
  await student.click('.cp >> text=Сборка');
  await student.click('#step-sborka >> text=⚙ Собрать игру');
  let own = await gameFrame(student, '/play/', 0);
  if (mode === 'mock') {
    const sys = mock.last.system || '';
    check('Программист урока 4 получил образец «Каменный стакан» вместо «Камней мудреца»', sys.includes("title: 'Каменный стакан'") && !sys.includes("title: 'Камни мудреца'") && sys.includes('по мотивам «Тетриса»'));
    await own.evaluate(() => window.__lab.confirm());
    await student.waitForFunction(() => document.querySelectorAll('#step-sborka .ver').length >= 2, null, { timeout: 30000 });
    own = await gameFrame(student, '/play/', 0);
  } else check('Демо-режим урока 4: вместо игры ученика — «Каменный стакан» с его названием', await own.evaluate(() => GAME.title === 'Сырная башня' && !!GAME.KINDS && GAME.donor === '«Тетрис»'));
  await playRound(own);
  await student.waitForSelector('#step-sborka.done', { timeout: 10000 });
  const card = await student.evaluate(async () => (await (await fetch('/api/arcade', { headers: { 'x-lab-token': Lab.token.get() } })).json()).mine.find(c => c.lesson && c.lesson.id === 'urok-04'));
  check('Игра урока 4 собрана, в аркаде донор «Тетрис»', card && card.title === 'Сырная башня' && card.donor === '«Тетрис»', card ? `${card.title} · ${card.donor}` : 'нет карточки');
  const p4 = require('./build-prompt'), sys4 = p4.systemPrompt({ lesson: 'urok-04' });
  check('Промпт программиста урока 4 не больше 25 тысяч токенов', p4.tokens(sys4) <= 25000 && !/\{\{/.test(sys4), `примерно ${p4.tokens(sys4)} токенов`);

  // релиз модуля: выбор игры модуля, чек-лист с подсказками из аркады, метка 1.0 — одна на модуль
  await student.click('.cp >> text=Мастерская');
  await student.waitForSelector('#step-reliz .seg .opt');
  const games = await student.$$eval('#step-reliz .seg .opt', bs => bs.map(b => b.dataset.game));
  check('Релиз: на выбор все игры модуля 1 (уроки 1–4)', games.length === 4 && /из 4/.test(await student.textContent('#step-reliz')), `игр: ${games.length}`);
  const first = await student.evaluate(async () => (await (await fetch('/api/arcade', { headers: { 'x-lab-token': Lab.token.get() } })).json()).mine.find(c => c.lesson && c.lesson.id === 'urok-01'));
  await student.click(`#step-reliz .seg .opt[data-game="${first.id}"]`);
  await student.waitForSelector(`#step-reliz .seg .opt.on[data-game="${first.id}"]`);
  const ev = (await student.textContent('#step-reliz .checklist')).replace(/\s+/g, ' ');
  check('Чек-лист: подпись донора и решения видны из аркады', /по мотивам механики Space Invaders/.test(ev) && /решений: 3 из 3/.test(ev), ev.slice(0, 160));
  check(mode === 'mock' ? 'Чек-лист: чужие партии в игре урока 1 видны' : 'Чек-лист: без соседей — предупреждение «не играл никто»', mode === 'mock' ? /соседи сыграли [1-9]/.test(ev) : /не играл никто/.test(ev));
  await student.click('#step-reliz >> text=🚀 Выпустить версию 1.0');
  check('Релиз не выходит, пока чек-лист не отмечен', await student.locator('#step-reliz.done').count() === 0);
  for (const it of step4('reliz').checklist) await student.click(`#step-reliz .check[data-check="${it.id}"]`);
  await student.click('#step-reliz .dicebtn');
  await student.click('#step-reliz >> text=🚀 Выпустить версию 1.0');
  await student.waitForSelector('#step-reliz.done', { timeout: 10000 });
  await student.waitForSelector('#step-reliz .acard .tag.release', { timeout: 10000 });
  await shot(student, '33-u4-release', true);
  // повторный релиз другой игры модуля снимает метку с первой
  await student.click(`#step-reliz .seg .opt[data-game="${card.id}"]`);
  await student.waitForSelector(`#step-reliz .seg .opt.on[data-game="${card.id}"]`);
  for (const it of step4('reliz').checklist) await student.click(`#step-reliz .check[data-check="${it.id}"]`);
  await student.click('#step-reliz >> text=🚀 Выпустить версию 1.0');
  await student.waitForFunction(id => document.querySelector(`#step-reliz .seg .opt.on[data-game="${id}"]`) && /1\.0/.test(document.querySelector(`#step-reliz .seg .opt.on[data-game="${id}"]`).textContent), card.id, { timeout: 10000 });
  const rel = await student.evaluate(async () => (await (await fetch('/api/arcade', { headers: { 'x-lab-token': Lab.token.get() } })).json()).mine.filter(c => c.release).map(c => c.title));
  check('Релиз модуля: метка 1.0 — у одной игры модуля', rel.length === 1 && rel[0] === 'Сырная башня', rel.join(', '));
  await teacher.click('.tabs >> text=Аркада');
  await teacher.waitForSelector('#tab-arcade .acard .tag.release', { timeout: 10000 });
  check('Учитель видит релиз в аркаде класса', (await teacher.textContent('#tab-arcade')).includes('версия 1.0 · релиз'));
  await teacher.click('.tabs >> text=Урок');

  // дуэль двух стаканов: оболочка включает второго игрока ручкой vs, клавиши делятся
  await student.click('.cp >> text=Играем вместе');
  await student.click('#step-duel .veil button');
  gf = await gameFrame(student, 'kamennyi-stakan', 0);
  await gf.waitForFunction(() => window.__lab.cfg.vs === 1 && window.__lab.lab.players === 2, null, { timeout: 5000 }).catch(() => {});
  check('Дуэль: два стакана, оболочка переключилась на двоих', await gf.evaluate(() => window.__lab.cfg.vs === 1 && window.__lab.lab.players === 2 && window.__lab.lab.state.wells.length === 2));
  await gf.evaluate(() => window.__lab.confirm());
  await gf.locator('#cv').focus();
  await sleep(400);
  await student.keyboard.press('KeyG'); await sleep(400); // игрок 1 роняет камень
  await student.keyboard.press('KeyL'); await sleep(600); // игрок 2 роняет камень
  const dropped = await gf.evaluate(() => window.__lab.lab.state.wells.map(w => w.grid.flat().filter(Boolean).length));
  check('Дуэль: каждый игрок роняет камень своей клавишей', dropped[0] === 4 && dropped[1] === 4, `камней в стаканах: ${dropped.join(' и ')}`);
  await gf.evaluate(() => window.__lab.end('win', 'Проверка'));
  await student.waitForSelector('#step-duel.done', { timeout: 10000 });
  await student.click('#step-duel .seg .opt >> nth=1');
  await student.click('#step-duel .veil button');
  gf = await gameFrame(student, 'kamennyi-stakan', 0);
  await gf.waitForFunction(() => window.__lab.cfg.bag === 0 && window.__lab.cfg.vs === 1, null, { timeout: 5000 }).catch(() => {});
  check('Дуэль без секрета: вариант кнопкой', await gf.evaluate(() => window.__lab.cfg.bag === 0 && window.__lab.cfg.preview === 0 && window.__lab.cfg.vs === 1));
  await shot(student, '34-u4-duel');

  // открытие: самооценка модуля
  await student.click('.cp >> text=Открытие');
  await student.click('#step-samootsenka .opt >> nth=3');
  await student.click('#step-samootsenka .opt >> nth=4');
  await student.click('#step-samootsenka >> text=Ответить');
  await student.waitForSelector('#step-samootsenka.done');
  check('Самооценка модуля 1 сохранена', true);
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
  await nb.waitForSelector(`.chboard .chrow.new[data-code="${chCode}"]`, { timeout: 10000 });
  check('Доска вызовов: вызов одноклассника появился у соседки сам', /Тестер вызывает: 80/.test(await nb.textContent(`.chboard .chrow[data-code="${chCode}"]`)));
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
  await cf.evaluate(() => window.__lab.confirm());
  await cf.waitForFunction(() => !document.querySelector('#hudGhost').hidden, null, { timeout: 5000 });
  const gtext = await cf.textContent('#hudGhost');
  check('Призрак соперника в игре: счёт Тестера на той же секунде', /^⚔ Тестер: \d+/.test(gtext), gtext);
  await cf.evaluate(() => { window.__lab.lab.score = 200; window.__lab.end('lose', 'Проверка'); });
  check('Конец партии по вызову: итог против лидера', /Вызов выигран: 200 против 80/.test(await cf.textContent('#overSeed')), await cf.textContent('#overSeed'));
  await nb.waitForSelector('#stage >> text=Таблица вызова', { timeout: 10000 });
  check('Таблица вызова: результат принявшего вызов', /Соседка — 200/.test(await nb.textContent('#stage')));
  await shot(nb, '14-challenge');
  // реванш: Тестера обошли — на доске «Отыграться», окно вызова поверх урока, призрак — новый лидер
  await student.waitForSelector(`.chboard .chrow.beaten[data-code="${chCode}"]`, { timeout: 10000 });
  check('Обойдённому автору — «Отыграться» на доске вызовов', /Тебя обогнали.*Соседка — 200/.test(await student.textContent(`.chboard .chrow[data-code="${chCode}"]`)));
  await student.click(`.chboard .chrow[data-code="${chCode}"] button`);
  await student.waitForSelector('dialog.chdlg[open] iframe');
  const rf = await gameFrame(student, 'seed=', 0);
  check('«Отыграться» открыл тот же мир в окне поверх урока', await rf.evaluate(() => window.__lab.lab.seed) === seed);
  await rf.evaluate(() => window.__lab.confirm());
  await rf.waitForFunction(() => /^⚔ Соседка/.test(document.querySelector('#hudGhost').textContent), null, { timeout: 5000 });
  check('Призрак реванша — новый лидер Соседка', true);
  await shot(student, '14b-revenge');
  await student.click('dialog.chdlg >> text=✕ Закрыть');
  // мир дня: учитель даёт классу один мир на проекторе, ученик играет с доски вызовов, таблица растёт на проекторе
  const pd = await teacher.context().newPage();
  watch(pd, errors);
  await pd.setViewportSize({ width: 1600, height: 900 });
  await pd.goto(base + '/projector?code=' + code + '&tab=day');
  await pd.waitForSelector('#pjDayGo');
  await pd.click('#pjDayGo');
  await student.waitForSelector('.chboard .chrow.day', { timeout: 10000 });
  check('Мир дня: строка первой на доске вызовов у ученика', (await student.getAttribute('.chboard .chrow >> nth=0', 'class')).includes('day'));
  await student.click('.chboard .chrow.day button');
  await student.waitForSelector('dialog.chdlg[open] iframe');
  const df = await gameFrame(student, 'seed=', 0);
  await playRound(df, { score: 321 });
  await pd.waitForSelector('#pjDayTop >> text=321', { timeout: 10000 });
  check('Мир дня: таблица на проекторе растёт', /Тестер\s*321/.test(await pd.textContent('#pjDayTop')), (await pd.textContent('#pjDayTop')).replace(/\s+/g, ' '));
  await shot(pd, 'p3-day');
  await student.click('dialog.chdlg >> text=✕ Закрыть');
  await pd.click('text=■ Закончить мир дня');
  await pd.waitForSelector('#pjDayGo');
  await student.waitForFunction(() => !document.querySelector('.chboard .chrow.day'), null, { timeout: 10000 });
  check('Мир дня закончен — строка пропала с доски', true);
  await pd.close();

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

/* ---------- кэш промпта: метка у модели с cache, чтение кэша дешевле в журнале генераций ---------- */
function cacheCheck() {
  const log = require('../lib/store').genlog().filter(e => !e.demo);
  const code = log.filter(e => e.model === 'mock-code' && e.tokensIn), hit = code.filter(e => e.tokensCached > 0);
  check('Кэш промпта: системный промпт программиста ушёл с меткой cache_control, продюсера — без неё', mock.last.marked.has('mock-code') && !mock.last.marked.has('mock-text'));
  check('Кэш промпта: повторные вызовы программиста читают кэш', hit.length > 0 && code.some(e => e.tokensCacheWrite > 0), `из кэша ${hit.length} из ${code.length}`);
  const e = hit[0] || {}, full = Math.round(((e.tokensIn || 0) * 100 + (e.tokensOut || 0) * 400) / 1e4) / 100;
  const want = Math.round((((e.tokensIn || 0) - (e.tokensCached || 0)) * 100 + (e.tokensCached || 0) * 10 + (e.tokensOut || 0) * 400) / 1e4) / 100;
  check('Кэш промпта: рубли считаются по цене чтения кэша', e.rub === want && e.rub < full, `${e.rub} ₽ вместо ${full} ₽`);
}

(async () => {
  const mockSrv = await mock.start(0);
  writeConfig({ baseUrl: `http://127.0.0.1:${mockSrv.address().port}/v1`, apiKey: 'mock', codeModel: 'mock-code', textModel: 'mock-text', stream: true, timeoutSec: 30 });
  const srv = await portal.start(0, '127.0.0.1');
  const base = `http://127.0.0.1:${srv.address().port}`;
  const browser = await chromium.launch({ headless: !process.argv.includes('--headed'), args: ['--use-angle=swiftshader', '--enable-unsafe-swiftshader', '--ignore-gpu-blocklist'] });
  try {
    await run(browser, base, 'mock');
    cacheCheck();
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
