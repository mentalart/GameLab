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
// Урок 5 в обоих прогонах: «Тур над Хаджохом», сырой прыжок и «Найди секрет», лаборатория прыжка, слепой турнир по одной ручке,
// образец урока в промпте программиста и демо-игра урока, спидран с призраком лучшей попытки.
// Урок 6 в обоих прогонах: «Ледолом» и 12 переключателей сочности оболочки 0.3, сухой «Ледолом» и «Найди секрет», квиз «Сухая или сочная?»,
// образец урока и демо-игра, кооператив двух лопат, слепая проба игры соседа (сухая и сочная копии).
// Урок 7 в обоих прогонах: «Шаг в такт» на одних часах и без секрета, предсказание «что будет без звука», квиз «Угадай по звуку»,
// секвенсор мелодии: своя мелодия уходит в ремейк (lab.data) и в черновик ИГРА, образец урока, ритм-дуэль.
// Урок 8 в обоих прогонах: «Башня до неба» с окном «идеально» и без секрета, квиз «Какой это приём?», джем с донором Stack из колоды «одна кнопка»,
// образец урока, две башни вдвоём, релиз модуля 2; с подставным ИИ — выставка: соседка собирает игру джема, голоса в номинациях,
// итоги класса и кнопочный турнир на проекторе.
// Запуск: node portal/tools/e2e-portal.js [--headed] [--from=5]   Снимки — в portal/.check/portal-*.png
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
const lesson5 = require('../lessons/urok-05');
const lesson6 = require('../lessons/urok-06');
const lesson7 = require('../lessons/urok-07');
const lesson8 = require('../lessons/urok-08');
const store = require('../lib/store');

const PASSWORD = 'e2e-пароль';
const FROM = Number((process.argv.find(a => a.startsWith('--from=')) || '=0').split('=')[1]) || 0; // --from=5 — для отладки: уроки 2…4 пропустить
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
  await teacher.addInitScript(() => { window.LAB_PLAYTEST_SECONDS = 12; }); // бот-плейтестер в проверке играет короткие партии
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
  const forkPick = (await student.textContent('#step-prodyuser .fork .opt >> nth=0')).trim();
  await student.click('#step-prodyuser .fork .opt >> nth=0');
  await student.waitForSelector('#step-prodyuser.done');
  check('Продюсер ответил, развилка выбрана', true);
  // «Пусть поправит продюсер»: по своему разбору продюсер переписывает поля ИГРА, ученик видит «было → стало» и принимает
  await student.click('#step-prodyuser >> text=🪄 Пусть поправит продюсер');
  await student.waitForSelector('#step-prodyuser .fixbox', { timeout: 30000 });
  check('Продюсер переписал промпт ИГРА: было → стало', await student.locator('#step-prodyuser .fixbox .now').count() >= 1, (await student.textContent('#step-prodyuser .fixbox')).replace(/\s+/g, ' ').slice(0, 120));
  await shot(student, '4-producer', true);
  await student.click('#step-prodyuser >> text=✓ Принять правку');
  await student.waitForSelector('#step-prodyuser >> text=Продюсер поправил промпт ИГРА');
  const fixedG = await student.inputValue('#f-igrag'), fixedR = await student.inputValue('#f-igrar');
  check('Правка продюсера легла в поля ИГРА', mode === 'mock' ? /крестовина и A/.test(fixedG) : fixedR.includes(forkPick), (mode === 'mock' ? fixedG : fixedR).slice(0, 90));

  // сборка
  await student.click('.cp >> text=Сборка');
  await student.click('#step-sborka >> text=⚙ Собрать игру');
  let own = await gameFrame(student, '/play/', 0);
  check('Игра собрана и запустилась в изолированной рамке', await own.evaluate(() => window.__lab.ready));
  if (mode === 'mock') {
    await own.evaluate(() => window.__lab.confirm());
    await student.waitForFunction(() => [...document.querySelectorAll('#step-sborka .ver')].length >= 2, null, { timeout: 30000 });
    check('Упавшую игру программист починил сам (v2)', true, await student.textContent('#step-sborka .versions'));
    check('Починку программист прислал кусками «найти → заменить»', mock.last.fixPatch === true);
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
  await student.click('#step-masterskaya .opt >> text=Вяло, мало сочности');
  await student.fill('#f-masterskayareq', 'Пусть последний враг мигает красным');
  await student.click('#step-masterskaya >> text=Отправить программисту');
  await student.waitForFunction(n => document.querySelectorAll('#step-masterskaya .ver').length > n, before, { timeout: 30000 });
  check('Правка кнопкой и своими словами дала новую версию', true, await student.textContent('#step-masterskaya .versions'));
  if (mode === 'mock') check('Куски правки дважды не легли — программист прислал игру целиком', mock.last.changeTries.join(',') === 'куски,куски,целиком', mock.last.changeTries.join(','));
  // урок 1: одна правка на ученика — кнопка отправки исчезает, сервер вторую не берёт
  await student.waitForSelector('#step-masterskaya >> text=Правка урока использована');
  const again = await student.evaluate(() => Lab.api('/api/ai/change', { request: 'Ещё одна правка' }).then(() => 'принял', e => e.status + ' ' + e.message));
  check('Вторую правку на уроке 1 сервер не берёт', /^429 /.test(again), again);
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
  if (FROM <= 2) await lessonTwo(mode, teacher, student, shot);
  if (FROM <= 3) await lessonThree(mode, teacher, student, shot);
  if (FROM <= 4) await lessonFour(mode, teacher, student, shot);
  if (FROM <= 5) await lessonFive(mode, teacher, student, shot);
  if (FROM <= 6) await lessonSix(mode, teacher, student, shot);
  if (FROM <= 7) await lessonSeven(mode, teacher, student, shot);
  await lessonEight(mode, teacher, student, shot, { browser, base, code, errors, pj });
  // учитель возвращает класс к модулю 1: следующий прогон начинает с него
  await teacher.click('.tabs >> text=Урок');
  await teacher.selectOption('#moduleSel', '1');
  await teacher.selectOption('#lessonSel', 'urok-01');
  await student.waitForFunction(() => /Урок 1/.test(document.querySelector('#lessonTitle').textContent), null, { timeout: 15000 });
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
  // связка от ИИ: геймдизайнер сводит четыре карты в одну игру, учитель принимает — связку видят ученики, она уходит в сборку
  await teacher.click('#wowLink >> text=🧠 Связка от ИИ');
  await teacher.waitForSelector('#wowLink .link-phrase', { timeout: 30000 });
  let phrase = (await teacher.textContent('#wowLink .link-phrase')).trim();
  check('Связка от ИИ свела четыре карты: фраза игры', phrase.length > 20, phrase.slice(0, 90));
  await teacher.click('#wowLink >> text=✓ Принять связку');
  await teacher.waitForSelector('#wowLink >> text=принята — уйдёт в сборку', { timeout: 10000 });
  // учитель правит связку руками: сохранённая правка сразу принята
  await teacher.click('#wowLink >> text=✎ Править');
  await teacher.waitForSelector('#wowLink textarea[data-link="phrase"]');
  const phrase0 = phrase;
  phrase = phrase0 + ' Учитель добавил: козёл не тормозит.';
  await teacher.fill('#wowLink textarea[data-link="phrase"]', phrase);
  await teacher.click('#wowLink >> text=✓ Сохранить и принять');
  await teacher.waitForSelector('#wowLink >> text=принята — уйдёт в сборку', { timeout: 10000 });
  check('Учитель поправил связку руками', (await teacher.textContent('#wowLink .link-phrase')).trim() === phrase && (await teacher.textContent('#wowLink')).includes('✎ учитель'));
  await student.waitForSelector('#step-vau-karty .linkbox .link-phrase', { timeout: 10000 });
  await student.waitForFunction(p => (document.querySelector('#step-vau-karty .linkbox .link-phrase') || {}).textContent === p, phrase, { timeout: 10000 }).catch(() => {});
  check('Принятую связку видит ученик под картами', (await student.textContent('#step-vau-karty .linkbox .link-phrase')).trim() === phrase);
  await shot(teacher, '1a-wow-cards');
  // сборка: ученики видят, что ИИ собирает игру; учитель проверяет и раздаёт
  await teacher.click('#wowBuild >> text=⚙ Собрать с ИИ');
  await teacher.waitForSelector('#wowBuild >> text=📣 Раздать классу', { timeout: 60000 });
  const info = (await teacher.textContent('#wowBuild')).replace(/\s+/g, ' ');
  if (mode === 'mock') check('ИИ собрал игру класса с ручкой secret и скрытым счётчиком', !/нет ручки secret|не считается/.test(info) && !/запасная игра «/.test(info), info.slice(0, 120));
  if (mode === 'mock') check('Принятая связка ушла программисту вместе с картами', /Связка геймдизайнера — класс принял её/.test(mock.last.wowUser || '') && (mock.last.wowUser || '').includes(phrase));
  if (mode === 'mock') check('Связка задаёт программисту каркас, кнопки и риск', /- Каркас и камера: Арена/.test(mock.last.wowUser || '') && /- Риск и очки: /.test(mock.last.wowUser || ''));
  else check('Без ключа собралась запасная игра урока', /запасная игра/.test(info), info.slice(0, 120));
  // бот-плейтестер сам прогоняет новую версию в рамке предпросмотра: три партии, отчёт сохраняется у версии
  await teacher.waitForSelector('#wowBot .botbox', { timeout: 180000 });
  const botRows = await teacher.locator('#wowBot .botrow').count(), botText = (await teacher.textContent('#wowBot')).replace(/\s+/g, ' ');
  check('Бот-плейтестер сыграл три партии новой версии', botRows === 3 && /Пассивный.*Торопыга.*Новичок/.test(botText), botText.slice(0, 160));
  if (mode === 'mock') {
    const found = await teacher.locator('#wowBot .botfind li').count();
    check('Бот нашёл, что править, и предлагает правку программисту', found > 0 && await teacher.locator('#wowBot >> text=Пусть программист поправит по отчёту').count() === 1, `находок ${found}`);
    await teacher.click('#wowBot >> text=Пусть программист поправит по отчёту');
    await teacher.waitForSelector('#wowBot >> text=до правки:', { timeout: 180000 });
    check('Программист получил отчёт бота и правил по нему', /Бот-плейтестер сыграл/.test(mock.last.playtestUser || '') && /Что он нашёл:\n- /.test(mock.last.playtestUser || '') && /Торопыга/.test(mock.last.playtestUser || ''));
    const info2 = (await teacher.textContent('#wowBuild')).replace(/\s+/g, ' ');
    check('Правка по плейтесту — новая версия игры класса, бот проверил её снова', /v2/.test(info2) && /↩ Вернуть v1/.test(info2), info2.slice(0, 120));
  } else check('Без ключа ИИ правки по отчёту бота нет', await teacher.locator('#wowBot >> text=Пусть программист поправит по отчёту').count() === 0);
  if (await teacher.locator('#wowBuild .veil:not([hidden]) button').count()) await teacher.click('#wowBuild .veil button');
  const tf = await gameFrame(teacher, '/play/', 0);
  if (mode === 'mock') check('Правка по отчёту пришла кусками и легла в код игры', /Правка по плейтесту/.test(await tf.evaluate(() => (GAME.notes || []).join(' '))));
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
  check('Проектор: принятая связка на экране', await pj.locator('#pjWowLink .link-phrase').count() === 1);
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
    check('Программисту ушли каркас от продюсера и находки продюсера', /Каркас \(выбрал продюсер\): Как у донора/.test(mock.last.newUser || '') && /Продюсер заметил в замысле[^\n]*\n- нет крючка/.test(mock.last.newUser || ''));
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
  // Sonnet: свой короткий промпт и один образец — донор урока у игры ученика, каркас связки у игры класса
  const c4 = p4.systemPrompt({ lesson: 'urok-04', model: 'anthropic/claude-sonnet-5' }), cw = p4.systemPrompt({ model: 'anthropic/claude-sonnet-5', frame: 'Вид сбоку, камера сбоку' });
  const samples = t => ['НЛО в станице', 'Камни мудреца', 'Ночной лабиринт', 'Каменный стакан', 'Ледолом', 'Тур над Хаджохом', 'Шаг в такт', 'Башня до неба'].filter(n => t.includes(`title: '${n}'`)).length;
  check('Промпт Sonnet для игры ученика: один образец — донор урока', samples(c4) === 1 && c4.includes("title: 'Каменный стакан'") && /# Механика: игра, а не иллюстрация/.test(c4) && !/\{\{/.test(c4), `образцов ${samples(c4)}, примерно ${p4.tokens(c4)} токенов`);
  check('Промпт Sonnet для игры класса: образец каркаса связки', samples(cw) === 1 && cw.includes("title: 'Тур над Хаджохом'") && !cw.includes("title: 'Камни мудреца'"), `примерно ${p4.tokens(cw)} токенов`);

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

const step5 = id => lesson5.checkpoints.flatMap(c => c.steps).find(s => s.id === id);
// открыть урок модуля у учителя и дождаться его у ученика
async function openLesson(teacher, student, module, id, title) {
  await teacher.click('.tabs >> text=Урок');
  await teacher.selectOption('#moduleSel', String(module));
  await teacher.selectOption('#lessonSel', id);
  await teacher.waitForSelector('text=Открыть все', { timeout: 10000 });
  await teacher.click('text=Открыть все');
  await student.waitForFunction(t => document.querySelector('#lessonTitle').textContent.includes(t), title, { timeout: 15000 });
  await student.waitForSelector('#step-donor-play', { timeout: 15000 });
}
// Фабрика → решения → ИГРА → продюсер → сборка; возвращает рамку собранной игры
async function buildOwn(mode, student, les, title, sampleTitle, donor = null) {
  await student.click('.cp >> text=Фабрика');
  if (donor) await student.click(`#step-fabrika [data-donor=${donor}]`);
  await student.click('#step-fabrika >> text=🎲 Кубик для пустых полей');
  const twist = await student.inputValue('#f-fabrikatwist'), fab = les.checkpoints.flatMap(c => c.steps).find(s => s.id === 'fabrika');
  const deck = donor ? fab.donors.find(d => d.id === donor).decks.twist : fab.fields.find(f => f.id === 'twist').deck;
  check(`Урок ${les.number}: кубик твиста — из колоды донора`, deck.includes(twist), twist);
  await student.fill('#f-fabrikatitle', title);
  await student.click('#step-fabrika >> text=Замысел готов');
  await student.waitForSelector('#step-fabrika.done');
  for (let i = 0; i < 3; i++) await student.click(`#step-resheniya .dicebtn >> nth=${i}`);
  await student.click('#step-resheniya >> text=Решения приняты');
  await student.waitForSelector('#step-resheniya.done');
  await student.click('.cp >> text=Промпт ИГРА');
  const r = await student.inputValue('#f-igrar'), i = await student.inputValue('#f-igrai');
  await student.click('#step-igra >> text=Промпт готов');
  await student.click('#step-prodyuser >> text=Отдать замысел продюсеру');
  await student.waitForSelector('#step-prodyuser .fork .opt', { timeout: 30000 });
  if (mode === 'demo') check(`Демо-продюсер урока ${les.number}: развилки под донора`, (await student.textContent('#step-prodyuser')).includes(les.demoForks[0].question));
  const forks = await student.locator('#step-prodyuser .fork').count();
  for (let k = 0; k < forks; k++) await student.click(`#step-prodyuser .fork >> nth=${k} >> .opt >> nth=0`);
  await student.waitForSelector('#step-prodyuser.done');
  await student.click('.cp >> text=Сборка');
  await student.click('#step-sborka >> text=⚙ Собрать игру');
  let own = await gameFrame(student, '/play/', 0);
  if (mode === 'mock') {
    const sys = mock.last.system || '';
    check(`Программист урока ${les.number} получил образец «${sampleTitle}»`, sys.includes(`title: '${sampleTitle}'`) && sys.includes(les.sample.about.slice(0, 40)));
    await own.evaluate(() => window.__lab.confirm());
    await student.waitForFunction(() => document.querySelectorAll('#step-sborka .ver').length >= 2, null, { timeout: 30000 });
    own = await gameFrame(student, '/play/', 0);
  }
  const bp = require('./build-prompt'), sys = bp.systemPrompt({ lesson: les.id });
  check(`Промпт программиста урока ${les.number} не больше 25 тысяч токенов`, bp.tokens(sys) <= 25000 && !/\{\{/.test(sys), `примерно ${bp.tokens(sys)} токенов`);
  return { own, twist, r, i };
}
async function lessonFive(mode, teacher, student, shot) {
  await openLesson(teacher, student, 2, 'urok-05', 'Урок 5');
  check('Урок 5 открылся у ученика: модуль 2', /Урок 5 · Прыжок, который хочется повторять/.test(await student.textContent('#lessonTitle')));

  // донор: «Тур над Хаджохом» как задумано — прыжок с секретом
  await student.click('#step-donor-play .veil button');
  let gf = await gameFrame(student, 'tur-nad-hadzhohom', 0);
  check('Донор урока 5: обби с камерой сбоку и прыжком с секретом', await gf.evaluate(() => window.__lab.cfg.secret === 1 && window.__lab.cfg.coyote > 0 && GAME.LEVEL.length > 10));
  await gf.evaluate(() => window.__lab.confirm());
  await gf.locator('#cv').focus();
  await student.keyboard.down('ArrowRight'); await sleep(700); await student.keyboard.press('Space'); await sleep(700); await student.keyboard.up('ArrowRight');
  const run = await gf.evaluate(() => { const st = window.__lab.lab.state; return { x: st.hero.x, jumps: st.jumps }; });
  check('Тур бежит и прыгает с клавиатуры', run.x > 1.8 && run.jumps >= 1, `x ${run.x.toFixed(1)}, прыжков ${run.jumps}`);
  await gf.evaluate(() => { window.__lab.lab.score = 900; window.__lab.end('lose', 'Проверка'); });
  await student.waitForSelector('#step-donor-play.done', { timeout: 10000 });
  await student.click('#step-donor-hook .opt >> nth=0');
  await student.click('#step-donor-hook >> text=Ответить');
  await student.waitForSelector('#step-donor-hook.done');

  // сырой прыжок: ручка secret из шага, нажатие чуть позже края «проглочено»
  await student.click('.cp >> text=Секрет');
  await student.click('#step-secret-play .veil button');
  gf = await gameFrame(student, 'tur-nad-hadzhohom', 0);
  await gf.waitForFunction(() => window.__lab.cfg.secret === 0, null, { timeout: 5000 }).catch(() => {});
  check('Сырой прыжок: секрет выключен ручкой шага', await gf.evaluate(() => window.__lab.cfg.secret === 0));
  await gf.evaluate(() => window.__lab.confirm());
  await sleep(300);
  // тур за краем первой скалы: прыжок через 0,05 с после края без койота не случается
  const edge = await gf.evaluate(async () => {
    const L = window.__lab.lab, h = L.state.hero; Object.assign(h, { x: 14.5, y: -0.05, vx: 6, vy: -1, ground: null, off: 0.05, jumped: false });
    const before = L.state.jumps; L.p1.pressed.a = true; GAME.control(L, h, L.p1, 0.016); L.p1.pressed.a = false;
    return { jumped: L.state.jumps - before, lost: L.state.lost };
  });
  check('Без секрета нажатие чуть позже края проглочено', edge.jumped === 0 && edge.lost === 1, JSON.stringify(edge));
  await gf.evaluate(() => { window.__lab.lab.count('потерянные нажатия', 2); window.__lab.lab.score = 300; window.__lab.end('lose', 'Проверка'); });
  await student.waitForSelector('#step-secret-play.done', { timeout: 10000 });

  const hunt = step5('secret-hunt').hunt;
  await student.waitForSelector('#step-secret-hunt .opt');
  await student.click(`#step-secret-hunt .opt >> text=${mode === 'mock' ? hunt.trap : hunt.right}`);
  await student.click('#step-secret-hunt >> text=Ответить');
  await student.waitForSelector('#step-secret-hunt.done');
  const reveal = (await student.textContent('#step-secret-hunt')).replace(/\s+/g, ' ');
  check(mode === 'mock' ? 'Секрет урока 5: ловушка «прыгал выше» распознана' : 'Секрет урока 5 угадан: отзывчивость',
    (mode === 'mock' ? /Ловушка! Высота не менялась/.test(reveal) : /Точно!/.test(reveal)) && /Отзывчивость/.test(reveal), reveal.slice(0, 120));
  check('Сравнение: потерянные нажатия с секретом и без', /Сырой прыжок/.test(reveal) && /потерянные нажатия 3/.test(reveal), (reveal.match(/Прыжок с секретом.*?Сырой прыжок[^О]*/) || [''])[0].slice(0, 200));
  await student.click('#step-secret-story >> text=Понятно');

  // лаборатория прыжка: пресеты кнопками
  await student.click('#step-laboratoriya .seg .opt >> nth=1');
  await student.click('#step-laboratoriya .veil button');
  gf = await gameFrame(student, 'tur-nad-hadzhohom', 0);
  await gf.waitForFunction(() => window.__lab.cfg.apex === 0.7, null, { timeout: 5000 }).catch(() => {});
  check('Лаборатория прыжка: вариант «Луна» — ручки шага', await gf.evaluate(() => window.__lab.cfg.apex === 0.7 && window.__lab.cfg.fall === 1.1));
  await playRound(gf);
  await student.waitForSelector('#step-laboratoriya.done', { timeout: 10000 });

  // слепой турнир: одна ручка в загадке, ответ — после нескольких секунд игры
  const blind = step5('slepoy-turnir');
  await student.click('#step-slepoy-turnir .veil button');
  gf = await gameFrame(student, 'tur-nad-hadzhohom', 0);
  await gf.waitForFunction(() => window.__lab.cfg.coyote === 0, null, { timeout: 5000 }).catch(() => {});
  check('Слепой турнир: в загадке повёрнута одна ручка', await gf.evaluate(() => window.__lab.cfg.coyote === 0 && window.__lab.cfg.buffer === 0.12));
  check('Слепой турнир: ответ закрыт, пока не поиграл', await student.locator('#step-slepoy-turnir .opts .opt.dim').count() === blind.choices);
  await student.click('#step-slepoy-turnir .seg .opt >> nth=1');
  await sleep(600); // старая рамка загадки уходит из списка рамок страницы
  gf = await gameFrame(student, 'tur-nad-hadzhohom', 0);
  await gf.waitForFunction(() => window.__lab.cfg.coyote === 0.1, null, { timeout: 5000 }).catch(() => {});
  check('Слепой турнир: «Как задумано» — все ручки на месте', await gf.evaluate(() => window.__lab.cfg.coyote === 0.1));
  for (let r = 0; r < (mode === 'mock' ? blind.rounds.length : 1); r++) {
    if (r === 0) await student.click('#step-slepoy-turnir .seg .opt >> nth=0');
    await student.waitForFunction(() => !document.querySelector('#step-slepoy-turnir .opts .opt.dim'), null, { timeout: 30000 });
    const rd = blind.rounds[r];
    const opts = await student.$$eval('#step-slepoy-turnir .opts .opt', bs => bs.map(b => b.textContent));
    const pick = r === 0 ? opts.find(o => o !== rd.answer) : rd.answer;
    await student.click(`#step-slepoy-turnir .opts .opt >> text="${pick}"`);
    await student.waitForSelector('#step-slepoy-turnir .verdict');
    if (r === 0) { check('Слепой турнир: ошибка — разбор, какая ручка была', /изменилось другое/.test(await student.textContent('#step-slepoy-turnir .verdict')) && (await student.textContent('#step-slepoy-turnir')).includes(rd.why)); await shot(student, '40-u5-blind'); }
    if (mode === 'mock') await student.click('#step-slepoy-turnir .btn >> text=/Следующая загадка|Итог/');
  }
  if (mode === 'mock') {
    await student.waitForSelector('#step-slepoy-turnir.done', { timeout: 10000 });
    const res = await student.textContent('#step-slepoy-turnir .blind h2');
    check('Квиз «Слепой турнир» пройден, итог', new RegExp(`Угадано ${blind.rounds.length - 1} из ${blind.rounds.length}`).test(res), res);
  }

  // Фабрика, ИГРА, сборка по образцу «Тур над Хаджохом»
  const { own, r } = await buildOwn(mode, student, lesson5, 'Конь над тесниной', 'Тур над Хаджохом');
  check('Черновик ИГРА урока 5: три участка, флажки, койот и буфер', /Три участка/.test(r) && /время койота/.test(r), r.slice(0, 90));
  if (mode === 'demo') check('Демо-режим урока 5: вместо игры ученика — «Тур над Хаджохом» с его названием', await own.evaluate(() => GAME.title === 'Конь над тесниной' && !!GAME.LEVEL));
  await playRound(own);
  await student.waitForSelector('#step-sborka.done', { timeout: 10000 });
  const card = await student.evaluate(async () => (await (await fetch('/api/arcade', { headers: { 'x-lab-token': Lab.token.get() } })).json()).mine.find(c => c.lesson && c.lesson.id === 'urok-05'));
  check('Игра урока 5 собрана, в аркаде донор — прыжок Марио и Celeste', card && card.title === 'Конь над тесниной' && /Super Mario Bros\. и Celeste/.test(card.donor), card ? `${card.title} · ${card.donor}` : 'нет карточки');

  // спидран класса: без огоньков, очки только за время, призрак лучшей попытки
  await student.click('.cp >> text=Играем вместе');
  await student.click('#step-speedrun .veil button');
  gf = await gameFrame(student, 'tur-nad-hadzhohom', 0);
  await gf.waitForFunction(() => window.__lab.cfg.race === 1, null, { timeout: 5000 }).catch(() => {});
  await gf.evaluate(() => window.__lab.confirm());
  await sleep(300);
  const sp = await gf.evaluate(() => { const L = window.__lab.lab, h = L.state.hero; Object.assign(h, { x: 177.9, y: 14.2, vx: 7, vy: 0 }); return { orbs: L.state.orbs.length }; });
  await gf.waitForFunction(() => window.__lab.state === 'over', null, { timeout: 10000 });
  const fin = await gf.evaluate(() => ({ score: window.__lab.lab.score, ghost: !!GAME.bestRun }));
  check('Спидран: без огоньков, финиш у сакли — очки за время и призрак', sp.orbs === 0 && fin.score > 0 && fin.ghost, JSON.stringify(Object.assign(sp, fin)));
  await gf.evaluate(() => window.__lab.restart());
  await sleep(500);
  check('Спидран: во второй пробежке рядом бежит призрак', await gf.evaluate(() => !!window.__lab.lab.state.ghost));
  await shot(student, '41-u5-speedrun');
  await gf.evaluate(() => window.__lab.end('lose', 'Проверка'));
  await student.waitForSelector('#step-speedrun.done', { timeout: 10000 });
}

const step6 = id => lesson6.checkpoints.flatMap(c => c.steps).find(s => s.id === id);
async function lessonSix(mode, teacher, student, shot) {
  await openLesson(teacher, student, 2, 'urok-06', 'Урок 6');
  check('Урок 6 открылся у ученика', /Урок 6 · Сочность/.test(await student.textContent('#lessonTitle')));

  // донор: «Ледолом» как задумано — все 12 переключателей сочности включены, в ручках своя группа
  await student.click('#step-donor-play .veil button');
  let gf = await gameFrame(student, 'ledolom', 0);
  const juice = await gf.evaluate(() => ({ n: document.querySelectorAll('#juiceKnobs .knob').length, on: Object.keys(window.__lab.cfg).filter(k => k.startsWith('j_') && window.__lab.cfg[k] === 1).length, pitch: window.__lab.lab.pitch(12), finale: window.__lab.cfg.finale }));
  check('Оболочка 0.3: 12 переключателей сочности в ручках, все включены', juice.n === 12 && juice.on === 12 && juice.pitch === 2 && juice.finale === 1, JSON.stringify(juice));
  const dry = await gf.evaluate(() => {
    window.__lab.togglePanel(true);
    [...document.querySelectorAll('#presets button')].find(b => b.textContent === 'Без секрета').click();
    const off = Object.keys(window.__lab.cfg).filter(k => k.startsWith('j_') && window.__lab.cfg[k] === 0).length, shake = window.__lab.cfg.shake;
    [...document.querySelectorAll('#presets button')].find(b => b.textContent === 'Как задумано').click();
    window.__lab.togglePanel(false);
    return { off, shake, back: Object.keys(window.__lab.cfg).filter(k => k.startsWith('j_') && window.__lab.cfg[k] === 1).length };
  });
  check('Пресет «Без секрета» выключает все 12, «Как задумано» включает обратно', dry.off === 12 && dry.shake === 1 && dry.back === 12, JSON.stringify(dry));
  await gf.evaluate(() => window.__lab.confirm());
  await sleep(300);
  await gf.evaluate(() => { window.__lab.lab.count('удары', 12); window.__lab.lab.count('кирпичи', 8); window.__lab.lab.score = 700; window.__lab.end('lose', 'Проверка'); });
  await student.waitForSelector('#step-donor-play.done', { timeout: 10000 });
  await student.click('#step-donor-hook .opt >> nth=0');
  await student.click('#step-donor-hook >> text=Ответить');
  await student.waitForSelector('#step-donor-hook.done');

  // сухой «Ледолом»: переключатели из шага, оболочка глушит эффекты в самих lab.shake, lab.burst, lab.tone
  await student.click('.cp >> text=Секрет');
  await student.click('#step-secret-play .veil button');
  gf = await gameFrame(student, 'ledolom', 0);
  await gf.waitForFunction(() => window.__lab.cfg.j_shake === 0, null, { timeout: 5000 }).catch(() => {});
  await gf.evaluate(() => window.__lab.confirm());
  await sleep(300);
  const quiet = await gf.evaluate(() => { const L = window.__lab.lab; L.shake(1); L.slowmo(1, 0.2); return { pitch: L.pitch(12), shake: L.juicy('shake'), sound: L.juicy('sound'), finale: window.__lab.cfg.finale }; });
  check('Сухой «Ледолом»: эффекты выключены переключателями шага', quiet.pitch === 1 && !quiet.shake && !quiet.sound && quiet.finale === 0, JSON.stringify(quiet));
  await gf.evaluate(() => { window.__lab.lab.count('удары', 9); window.__lab.lab.count('кирпичи', 5); window.__lab.lab.score = 400; window.__lab.end('lose', 'Проверка'); });
  await student.waitForSelector('#step-secret-play.done', { timeout: 10000 });
  const hunt = step6('secret-hunt').hunt;
  await student.waitForSelector('#step-secret-hunt .opt');
  await student.click(`#step-secret-hunt .opt >> text=${mode === 'mock' ? hunt.trap : hunt.right}`);
  await student.click('#step-secret-hunt >> text=Ответить');
  await student.waitForSelector('#step-secret-hunt.done');
  const reveal = (await student.textContent('#step-secret-hunt')).replace(/\s+/g, ' ');
  check(mode === 'mock' ? 'Секрет урока 6: ловушка «хычин летал быстрее» распознана' : 'Секрет урока 6 угадан: сочность',
    (mode === 'mock' ? /Ловушка! Скорость не менялась/.test(reveal) : /Точно!/.test(reveal)) && /Сочность: игра отзывается/.test(reveal) && /удары 12/.test(reveal) && /удары 9/.test(reveal), reveal.slice(0, 120));
  await student.click('#step-secret-story >> text=Понятно');

  // квиз «Сухая или сочная?»: основа сухая, в загадке включён один переключатель
  const quiz = step6('suhaya-sochnaya');
  await student.click('#step-suhaya-sochnaya .veil button');
  gf = await gameFrame(student, 'ledolom', 0);
  await gf.waitForFunction(() => window.__lab.cfg.j_shake === 1 && window.__lab.cfg.j_sound === 0, null, { timeout: 5000 }).catch(() => {});
  check('Квиз «Сухая или сочная?»: в загадке включён один эффект', await gf.evaluate(() => Object.keys(window.__lab.cfg).filter(k => k.startsWith('j_') && window.__lab.cfg[k] === 1).join() === 'j_shake'));
  await student.click('#step-suhaya-sochnaya .seg .opt >> nth=1');
  await sleep(600);
  gf = await gameFrame(student, 'ledolom', 0);
  await gf.waitForFunction(() => window.__lab.cfg.j_shake === 0, null, { timeout: 5000 }).catch(() => {});
  check('Квиз: вкладка «Сухая» — все 12 выключены', await gf.evaluate(() => Object.keys(window.__lab.cfg).filter(k => k.startsWith('j_') && window.__lab.cfg[k] === 1).length === 0) && /Сухая/.test(await student.textContent('#step-suhaya-sochnaya .seg')));
  await student.click('#step-suhaya-sochnaya .seg .opt >> nth=0');
  for (let r = 0; r < (mode === 'mock' ? quiz.rounds.length : 1); r++) {
    await student.waitForFunction(() => !document.querySelector('#step-suhaya-sochnaya .opts .opt.dim'), null, { timeout: 40000 });
    await student.click(`#step-suhaya-sochnaya .opts .opt >> text="${quiz.rounds[r].answer}"`);
    await student.waitForSelector('#step-suhaya-sochnaya .verdict.good');
    if (r === 0) await shot(student, '50-u6-quiz');
    if (mode === 'mock') await student.click('#step-suhaya-sochnaya .btn >> text=/Следующая загадка|Итог/');
  }
  if (mode === 'mock') {
    await student.waitForSelector('#step-suhaya-sochnaya.done', { timeout: 10000 });
    check('Квиз «Сухая или сочная?» пройден', new RegExp(`Угадано ${quiz.rounds.length} из ${quiz.rounds.length}`).test(await student.textContent('#step-suhaya-sochnaya .blind h2')));
  }

  // Фабрика и сборка по образцу «Ледолом»
  const { own, r } = await buildOwn(mode, student, lesson6, 'Хычин против льда', 'Ледолом');
  const a = await student.evaluate(() => S.answers.igra.value.fields.a.text);
  check('Черновик ИГРА урока 6: угол отскока и пять эффектов сочности', /Угол отскока/.test(r) && /Сочность на каждом ударе/.test(a), a.slice(0, 90));
  if (mode === 'demo') check('Демо-режим урока 6: вместо игры ученика — «Ледолом» с его названием', await own.evaluate(() => GAME.title === 'Хычин против льда' && !!GAME.ROWS));
  await playRound(own);
  await student.waitForSelector('#step-sborka.done', { timeout: 10000 });

  // кооператив: две лопаты по ручке coop
  await student.click('.cp >> text=Играем вместе');
  await student.click('#step-koop .veil button');
  gf = await gameFrame(student, 'ledolom', 0);
  await gf.waitForFunction(() => window.__lab.cfg.coop === 1 && window.__lab.lab.players === 2, null, { timeout: 5000 }).catch(() => {});
  check('Кооператив: две лопаты, оболочка переключилась на двоих', await gf.evaluate(() => window.__lab.lab.players === 2 && window.__lab.lab.state.paddles.length === 2));
  await playRound(gf);
  await student.waitForSelector('#step-koop.done', { timeout: 10000 });

  // слепая проба игры соседа: в одной копии сухо, голос «куда хочется вернуться»
  if (mode === 'demo') { check('Слепая проба без соседей ждёт игру соседа', /Ждём игру соседа/.test(await student.textContent('#step-slepaya-proba'))); return; }
  await student.waitForSelector('#step-slepaya-proba .ab-tabs');
  const shakes = [];
  for (const k of [0, 1]) {
    await student.click(`#step-slepaya-proba .ab-tabs .opt >> nth=${k}`);
    await student.click('#step-slepaya-proba .veil button');
    await sleep(400);
    const fr = await gameFrame(student, '/play/', 0);
    await sleep(800); // setCfg после ready
    shakes.push(await fr.evaluate(() => Object.keys(window.__lab.cfg).filter(x => x.startsWith('j_') && window.__lab.cfg[x] === 1).length));
    await playRound(fr);
    await sleep(300);
  }
  check('Слепая проба: в одной копии игры соседа выключены все 12 переключателей', shakes.includes(0) && shakes.includes(12), shakes.join(' и '));
  await student.click('#step-slepaya-proba .opts .opt >> nth=' + shakes.indexOf(12));
  await student.waitForSelector('#step-slepaya-proba.done');
  check('Слепая проба: выбрал сочную копию, раскрытие', /Сухой была игра/.test(await student.textContent('#step-slepaya-proba')) && /сочность и правда тянет/.test(await student.textContent('#step-slepaya-proba')));
  await shot(student, '51-u6-blindpair');
}

/* ---------- урок 7: обратная связь, звук, секвенсор ---------- */
const step7 = id => lesson7.checkpoints.flatMap(c => c.steps).find(s => s.id === id);
async function lessonSeven(mode, teacher, student, shot) {
  await openLesson(teacher, student, 2, 'urok-07', 'Урок 7');
  check('Урок 7 открылся у ученика', /Урок 7 · /.test(await student.textContent('#lessonTitle')));

  // донор: «Шаг в такт» на одних часах — кувшин на доле, щелчок за долю до него
  await student.click('#step-donor-play .veil button');
  let gf = await gameFrame(student, 'shag-v-takt', 0);
  const on = await gf.evaluate(() => { const st = window.__lab.lab.state; return { secret: window.__lab.cfg.secret, obs: st.obs.length, cues: st.evts.filter(e => e.kind === 'cue').length }; });
  check('Донор урока 7: уровень из мелодии, щелчок перед каждым кувшином', on.secret === 1 && on.obs > 20 && on.cues === on.obs, JSON.stringify(on));
  await gf.evaluate(() => window.__lab.confirm());
  await sleep(300);
  await gf.evaluate(() => { const L = window.__lab.lab; L.count('идеально', 9); L.count('хорошо', 4); L.count('мимо', 1); L.score = 900; window.__lab.end('lose', 'Проверка'); });
  await student.waitForSelector('#step-donor-play.done', { timeout: 10000 });
  await student.click('#step-donor-hook .opt >> nth=0');
  await student.click('#step-donor-hook >> text=Ответить');
  await student.waitForSelector('#step-donor-hook.done');

  // без секрета: музыка на своих часах, кувшины сдвинуты, щелчка нет
  await student.click('.cp >> text=Секрет');
  await student.click('#step-secret-play .veil button');
  gf = await gameFrame(student, 'shag-v-takt', 0);
  await gf.waitForFunction(() => window.__lab.cfg.secret === 0, null, { timeout: 5000 }).catch(() => {});
  await sleep(300);
  const off = await gf.evaluate(() => { const st = window.__lab.lab.state; return { secret: window.__lab.cfg.secret, cues: st.evts.filter(e => e.kind === 'cue').length, obs: st.obs.length }; });
  check('Без секрета: щелчков нет, кувшины те же', off.secret === 0 && off.cues === 0 && off.obs === on.obs, JSON.stringify(off));
  await gf.evaluate(() => window.__lab.confirm());
  await sleep(300);
  await gf.evaluate(() => { const L = window.__lab.lab; L.count('идеально', 1); L.count('хорошо', 3); L.count('мимо', 6); L.score = 200; window.__lab.end('lose', 'Проверка'); });
  await student.waitForSelector('#step-secret-play.done', { timeout: 10000 });
  const hunt = step7('secret-hunt').hunt;
  await student.waitForSelector('#step-secret-hunt .opt');
  await student.click(`#step-secret-hunt .opt >> text=${mode === 'mock' ? hunt.trap : hunt.right}`);
  await student.click('#step-secret-hunt >> text=Ответить');
  await student.waitForSelector('#step-secret-hunt.done');
  const reveal = (await student.textContent('#step-secret-hunt')).replace(/\s+/g, ' ');
  check(mode === 'mock' ? 'Секрет урока 7: ловушка «танцор бежал медленнее» распознана' : 'Секрет урока 7 угадан: одни часы',
    (mode === 'mock' ? /Ловушка! Темп не менялся/.test(reveal) : /Точно!/.test(reveal)) && /Одни часы: звук предупреждает/.test(reveal) && /идеально 9/.test(reveal) && /мимо 6/.test(reveal), reveal.slice(0, 120));
  await student.click('#step-secret-story >> text=Понятно');

  // предсказание «что будет без звука» и партия с выключенным переключателем «Звук»
  const pred = step7('prognoz'), good = pred.options.find(o => o.counter === 'хорошо');
  await student.click(`#step-prognoz .opt >> text=${good.text}`);
  await student.click('#step-prognoz >> text=🔮 Записать предсказание');
  await student.waitForSelector('#step-prognoz >> text=Теперь сыграй');
  await student.click('#step-bez-zvuka .veil button');
  gf = await gameFrame(student, 'shag-v-takt', 0);
  await gf.waitForFunction(() => window.__lab.cfg.j_sound === 0, null, { timeout: 5000 }).catch(() => {});
  check('Партия без звука: переключатель «Звук» выключен шагом', await gf.evaluate(() => !window.__lab.lab.juicy('sound') && window.__lab.cfg.secret === 1));
  await gf.evaluate(() => window.__lab.confirm());
  await sleep(300);
  await gf.evaluate(() => { const L = window.__lab.lab; L.count('идеально', 2); L.count('хорошо', 7); L.count('мимо', 3); window.__lab.end('lose', 'Проверка'); });
  await student.waitForSelector('#step-prognoz .prow', { timeout: 10000 });
  const ptext = (await student.textContent('#step-prognoz')).replace(/\s+/g, ' ');
  check('Предсказание «без звука» сравнилось с телеметрией', /Предсказание сбылось/.test(ptext) && (await student.textContent('#step-prognoz .prow.top')).includes(good.text), ptext.slice(0, 120));
  await student.click('#step-prognoz >> text=Понятно, дальше');
  await student.waitForSelector('#step-prognoz.done');

  // квиз «Угадай по звуку»: звук собирается из рецепта на странице, ответ клавишей или кнопкой
  const listen = step7('ugaday-zvuk');
  await student.click('#step-ugaday-zvuk >> text=▶ Начать');
  let right = 0;
  for (let k = 0; k < listen.rounds.length; k++) {
    await student.waitForSelector('#step-ugaday-zvuk .opts .opt:not([disabled])');
    if (k === 0) check('Квиз по звуку: 4 варианта, среди них звуки из других раундов', await student.locator('#step-ugaday-zvuk .opts .opt').count() === 4);
    if (k === 0) await student.keyboard.press('Digit1'); else await student.click('#step-ugaday-zvuk .opts .opt >> nth=0');
    await student.waitForSelector('#step-ugaday-zvuk .why b');
    if (/Верно/.test(await student.textContent('#step-ugaday-zvuk .why b'))) right++;
    if (k === 0) { check('Квиз по звуку: клавиша 1 отвечает, верный вариант подсвечен', await student.locator('#step-ugaday-zvuk .opts .opt.on').count() === 1); await shot(student, '52-u7-listen'); }
    await student.click('#step-ugaday-zvuk .why .btn');
  }
  await student.waitForSelector('#step-ugaday-zvuk.done', { timeout: 10000 });
  check('Квиз «Угадай по звуку» пройден, итог по ответам', (await student.textContent('#step-ugaday-zvuk .listen h2')).startsWith(`${right} из ${listen.rounds.length}`), await student.textContent('#step-ugaday-zvuk .listen h2'));

  // секвенсор: пресет, своя нота, послушать, пробежать — мелодия уходит в ремейк через lab.data
  await student.click('.cp >> text=Фабрика');
  await student.click('#step-sekvenser >> text=🎲 Удж');
  await student.click('#step-sekvenser .seq-cell >> nth=0'); // верхняя строка, первая доля — «соль»
  await student.waitForSelector('#step-sekvenser.done');
  const line = await student.evaluate(() => S.answers.sekvenser.value.line);
  check('Секвенсор: пресет и своя нота, мелодия записана', /^соль — — — \| ля — ре —/.test(line), line.slice(0, 40));
  await student.click('#step-sekvenser >> text=▶ Послушать');
  await student.waitForSelector('#step-sekvenser .seq-cell.cur', { timeout: 5000 });
  await student.click('#step-sekvenser >> text=■ Стоп');
  await shot(student, '53-u7-sequencer');
  await student.click('#step-sekvenser >> text=🏃 Пробежать в «Шаге в такт»');
  gf = await gameFrame(student, 'shag-v-takt', 0);
  await gf.waitForFunction(() => window.__lab.lab.data && window.__lab.lab.data.melody, null, { timeout: 5000 }).catch(() => {});
  const run = await gf.evaluate(() => { const L = window.__lab.lab, mel = (L.data || {}).melody || []; return { first: mel[0], notes: mel.filter(n => n >= 0).length, obs: L.state.obs.length, laps: window.__lab.cfg.laps }; });
  const notes = step7('sekvenser').presets[0].melody.filter(n => n >= 0).length + 1;
  check('Своя мелодия в ремейке: lab.data.melody, кувшин на каждой ноте после вступления', run.first === 4 && run.notes === notes && run.obs === run.laps * notes - 1, JSON.stringify(run));
  await playRound(gf);

  // Фабрика и сборка по образцу «Шаг в такт»: мелодия в черновике ИГРА
  const { own, r } = await buildOwn(mode, student, lesson7, 'Струны шичепшина', 'Шаг в такт');
  check('Черновик ИГРА урока 7: мелодия из секвенсора и окна попадания', r.includes(line) && /Окна попадания/.test(r), r.slice(0, 90));
  if (mode === 'demo') check('Демо-режим урока 7: вместо игры ученика — «Шаг в такт» с его названием', await own.evaluate(() => GAME.title === 'Струны шичепшина' && !!GAME.MELODY));
  await playRound(own);
  await student.waitForSelector('#step-sborka.done', { timeout: 10000 });

  // ритм-дуэль по ручке duel
  await student.click('.cp >> text=Играем вместе');
  await student.click('#step-duel .veil button');
  gf = await gameFrame(student, 'shag-v-takt', 0);
  await gf.waitForFunction(() => window.__lab.cfg.duel === 1 && window.__lab.lab.players === 2, null, { timeout: 5000 }).catch(() => {});
  check('Ритм-дуэль: два танцора, оболочка переключилась на двоих', await gf.evaluate(() => window.__lab.lab.players === 2 && !!window.__lab.lab.state.hero2));
  await playRound(gf);
  await student.waitForSelector('#step-duel.done', { timeout: 10000 });
}

/* ---------- урок 8: мини-джем «Одна кнопка», выставка, турнир, релиз модуля 2 ---------- */
const step8 = id => lesson8.checkpoints.flatMap(c => c.steps).find(s => s.id === id);
// ставит плиту в «Башне до неба» с промахом off метров
const placeSlab = (gf, off) => gf.evaluate(o => { const L = window.__lab.lab, T = L.state.towers[0], v = T.mv; v[v.axis] = T.top[v.axis] + o; GAME.place(L, T); return { n: T.n, perfect: T.perfect, saved: T.saved, w: T.top.w, d: T.top.d }; }, off);
async function lessonEight(mode, teacher, student, shot, { browser, base, code, errors, pj }) {
  await openLesson(teacher, student, 2, 'urok-08', 'Урок 8');
  check('Урок 8 открылся у ученика', /Урок 8 · Мини-джем «Одна кнопка»/.test(await student.textContent('#lessonTitle')));

  // донор: окно «идеально» ставит плиту ровно, если промах меньше 12 см
  await student.click('#step-donor-play .veil button');
  let gf = await gameFrame(student, 'bashnya-do-neba', 0);
  await gf.evaluate(() => window.__lab.confirm());
  await sleep(300);
  const on = await placeSlab(gf, 0.06), size = await gf.evaluate(() => window.__lab.cfg.size);
  check('Донор урока 8: промах 6 см — «идеально», плита ровно, ширина та же', on.n === 1 && on.perfect === 1 && on.saved === 1 && Math.abs(on.w - size) < 1e-9, JSON.stringify(on));
  await gf.evaluate(() => { const L = window.__lab.lab; L.count('идеально', 7); L.count('плиты', 11); L.score = 300; window.__lab.end('lose', 'Проверка'); });
  await student.waitForSelector('#step-donor-play.done', { timeout: 10000 });
  await student.click('#step-donor-hook .opt >> nth=0');
  await student.click('#step-donor-hook >> text=Ответить');
  await student.waitForSelector('#step-donor-hook.done');

  // без секрета: тот же промах отрезается
  await student.click('.cp >> text=Секрет');
  await student.click('#step-secret-play .veil button');
  gf = await gameFrame(student, 'bashnya-do-neba', 0);
  await gf.waitForFunction(() => window.__lab.cfg.secret === 0, null, { timeout: 5000 }).catch(() => {});
  await gf.evaluate(() => window.__lab.confirm());
  await sleep(300);
  const off = await placeSlab(gf, 0.06);
  check('Без секрета: промах 6 см отрезан, плита уже', off.perfect === 0 && Math.abs(off.w - (size - 0.06)) < 1e-6, JSON.stringify(off));
  await gf.evaluate(() => { const L = window.__lab.lab; L.count('плиты', 4); L.score = 40; window.__lab.end('lose', 'Проверка'); });
  await student.waitForSelector('#step-secret-play.done', { timeout: 10000 });
  const hunt = step8('secret-hunt').hunt;
  await student.waitForSelector('#step-secret-hunt .opt');
  await student.click(`#step-secret-hunt .opt >> text=${mode === 'mock' ? hunt.trap : hunt.right}`);
  await student.click('#step-secret-hunt >> text=Ответить');
  await student.waitForSelector('#step-secret-hunt.done');
  const reveal = (await student.textContent('#step-secret-hunt')).replace(/\s+/g, ' ');
  check(mode === 'mock' ? 'Секрет урока 8: ловушка «плиты ехали медленнее» распознана' : 'Секрет урока 8 угадан: окно «идеально»',
    (mode === 'mock' ? /Ловушка! Скорость не менялась/.test(reveal) : /Точно!/.test(reveal)) && /Окно «идеально»: игра прощает/.test(reveal) && /плиты 12/.test(reveal) && /плиты 5/.test(reveal), reveal.slice(0, 120));
  await student.click('#step-secret-story >> text=Понятно');

  // квиз модуля «Какой это приём?»: отзывчивость, сочность, обратная связь
  const quiz = step8('priemy'), binOf = t => quiz.items.find(i => i.text === t).bin;
  await student.click('#step-priemy >> text=▶ Начать');
  for (let i = 0; i < (mode === 'mock' ? quiz.items.length : 3); i++) {
    const text = (await student.textContent('#step-priemy .item')).trim();
    await student.keyboard.press('Digit' + (quiz.bins.findIndex(b => b.id === binOf(text)) + 1));
    await sleep(1050);
  }
  if (mode === 'mock') {
    await student.waitForSelector('#step-priemy.done');
    check('Квиз «Какой это приём?» пройден', new RegExp(`${quiz.items.length} из ${quiz.items.length}`).test(await student.textContent('#step-priemy h2 >> nth=1')));
  }

  // джем: донор Stack из колоды «одна кнопка», правила классики в черновике ИГРА
  const { own, r } = await buildOwn(mode, student, lesson8, 'Сырная гора', 'Башня до неба', 'stack');
  check('Черновик ИГРА урока 8: правила Stack и ограничение джема', r.startsWith('Классика: Плита ездит туда-сюда') && /Ограничение джема/.test(r), r.slice(0, 90));
  if (mode === 'demo') check('Демо-режим урока 8: вместо игры ученика — «Башня до неба» с его названием', await own.evaluate(() => GAME.title === 'Сырная гора' && !!GAME.NOTES));
  await playRound(own, { score: 120 });
  await student.waitForSelector('#step-sborka.done', { timeout: 10000 });

  // релиз модуля 2: на выбор игры уроков 5–8
  await student.click('.cp >> text=Мастерская');
  await student.waitForSelector('#step-reliz .seg .opt');
  const built = [5, 6, 7, 8].filter(n => n >= FROM).length;
  const games = await student.$$eval('#step-reliz .seg .opt', bs => bs.map(b => b.dataset.game));
  check('Релиз модуля 2: на выбор только игры модуля 2', games.length === built && /из 4/.test(await student.textContent('#step-reliz')), `игр: ${games.length}`);
  await student.click('#step-reliz .seg .opt >> nth=' + (games.length - 1));
  for (const it of step8('reliz').checklist) await student.click(`#step-reliz .check[data-check="${it.id}"]`);
  await student.click('#step-reliz .dicebtn');
  await student.click('#step-reliz >> text=🚀 Выпустить версию 1.0');
  await student.waitForSelector('#step-reliz.done', { timeout: 10000 });
  check('Релиз модуля 2 вышел: метка 1.0 в аркаде', await student.locator('#step-reliz .acard .tag.release').count() >= 1);

  // две башни вдвоём по ручке duel
  await student.click('.cp >> text=Играем вместе');
  await student.click('#step-dve-bashni .veil button');
  gf = await gameFrame(student, 'bashnya-do-neba', 0);
  await gf.waitForFunction(() => window.__lab.cfg.duel === 1 && window.__lab.lab.players === 2, null, { timeout: 5000 }).catch(() => {});
  check('Две башни: оболочка переключилась на двоих, у каждого своя башня', await gf.evaluate(() => window.__lab.lab.players === 2 && window.__lab.lab.state.towers.length === 2));
  await playRound(gf);
  await student.waitForSelector('#step-dve-bashni.done', { timeout: 10000 });

  // открытие и журнал модуля: три приёма ощущения игры
  await student.click('.cp >> text=Открытие');
  for (let k = 0; k < 3; k++) await student.click(`#step-tri-priema .opt >> nth=${k}`);
  await student.click('#step-tri-priema >> text=Ответить');
  await student.waitForSelector('#step-tri-priema.done');

  // выставка: без игр класса — ожидание; с подставным ИИ соседка собирает игру джема, голоса, итоги, турнир на проекторе
  await student.click('.cp >> text=Играем вместе');
  if (mode === 'demo') { check('Выставка без игр класса ждёт игры джема', /Ждём игры класса/.test(await student.textContent('#step-vystavka'))); return; }
  const nctx = await browser.newContext({ viewport: { width: 1280, height: 900 } });
  const nb = await nctx.newPage();
  watch(nb, errors);
  await nb.goto(base + '/?code=' + code);
  await nb.fill('#nick', 'Джемер');
  await nb.click('#studentForm button[type=submit]');
  await nb.waitForURL('**/student');
  await nb.click('.cp >> text=Фабрика');
  await nb.click('#step-fabrika >> text=🎲 Кубик для пустых полей');
  await nb.fill('#f-fabrikatitle', 'Взмах над Белой');
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
  await playRound(nown, { score: 30 });
  await nb.waitForSelector('#step-sborka.done', { timeout: 10000 });
  await nctx.close();

  await student.click('#step-vystavka >> text=↻ Проверить').catch(() => {});
  await student.waitForSelector('#step-vystavka .acard', { timeout: 15000 });
  const cards = await student.$$eval('#step-vystavka .acard h3', hs => hs.map(h => h.textContent));
  check('Выставка: только игры джема одноклассников, своей нет', cards.length === 1 && cards[0].includes('Взмах над Белой'), cards.join(' | '));
  check('Голосование закрыто, пока не сыграл', /Сыграй хотя бы в одну игру/.test(await student.textContent('#step-vystavka')));
  await student.click('#step-vystavka .acard >> text=Играть');
  const vf = await gameFrame(student, '/play/', 0);
  await playRound(vf, { score: 25 });
  await student.waitForSelector('#vote-eshche', { timeout: 10000 });
  const gid = await student.$eval('#vote-eshche option:nth-child(2)', o => o.value);
  for (const n of step8('vystavka').nominations) await student.selectOption('#vote-' + n.id, gid);
  await student.click('#step-vystavka >> text=🏆 Отдать голоса');
  await student.waitForSelector('#step-vystavka.done');
  await student.waitForSelector('#step-vystavka .vote-nom');
  const tally = (await student.textContent('#step-vystavka')).replace(/\s+/g, ' ');
  check('Итоги выставки: голоса класса и игра кнопочного турнира', /проголосовали 1/.test(tally) && /Игра кнопочного турнира — «Взмах над Белой»/.test(tally), tally.slice(tally.indexOf('Итоги'), tally.indexOf('Итоги') + 120));
  await shot(student, '54-u8-vote');

  // проектор: вкладка «Выставка и турнир» — лидеры номинаций и партия в игре-победителе
  await pj.click('#cupTab');
  await pj.waitForSelector('#pjCupBox h2', { timeout: 10000 });
  check('Проектор: лидеры номинаций и игра турнира', /Взмах над Белой/.test(await pj.textContent('#pjNoms')) && /Взмах над Белой — автор Джемер/.test(await pj.textContent('#pjCupBox h2')));
  await pj.fill('#pjCupName', 'Ася');
  await pj.click('#pjCupBox .veil button');
  const cf = await gameFrame(pj, '/play/', 0);
  await playRound(cf, { score: 77 });
  await pj.waitForSelector('#pjCupTable li', { timeout: 10000 });
  await sleep(2300); // обновление проектора не сбрасывает рамку и таблицу турнира
  check('Кнопочный турнир: партия в таблице, рамка жива после обновления', /Ася — 77/.test(await pj.textContent('#pjCupTable')) && pj.frames().filter(f => f.url().includes('/play/')).length === 1);
  await shot(pj, '55-u8-cup');
  await pj.click('.pj-tabs >> text=Урок');
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
  // автор возвращает игру в аркаду: она нужна соседу в следующих уроках (слепая проба урока 6)
  await nb.click('#mine >> text=👁 Вернуть в аркаду');
  await nb.waitForSelector('#mine >> text=🙈 Скрыть из аркады');
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
