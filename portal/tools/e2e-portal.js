#!/usr/bin/env node
// Сквозная проверка портала в браузере: учитель и ученик проходят урок 1 целиком.
// Вау-старт: учитель тянет карты, ученик голосует, учитель видит спрятанную механику урока, собирает и раздаёт игру класса; «Найди спрятанную механику» и сводка.
// Два прогона: с подставным ИИ (mock-ai.js: продюсер и связка по API, программист — подставной Qwen: сборка с ошибкой → починка через тот же чат, правка) и в демо-режиме без ключа.
// В прогоне с ИИ — «Играем вместе»: второй ученик собирает игру, оба играют в игры друг друга, бьют рекорд автора,
// бросают вызов на зерне, оставляют плейтест; учитель пишет отзыв; аркада класса и личная аркада, скрытие игры.
// Срез 3: проектор (код, таймер, кто закончил шаг, сцена «Пять опор» вау-старта урока 1), вау-старт teacher-demo (карты, сборка при всех, автопочинка, «открыть всем»),
// фильтр «застряли», лимиты и «+10 запросов», отчёт журнала генераций и CSV, статусы заметок и Markdown;
// Урок 2 в обоих прогонах: донор с ручками из шага, варианты игры, «Найди спрятанную механику» донора, квиз-раунды «Игра или не игра?»,
// сортировщик на 8 лотков, Фабрика с донором на выбор и его колодами, черновик ИГРА по правилам донора, сборка, дуэль вдвоём.
// Урок 3 в обоих прогонах: «Ночной лабиринт», предсказание динамики против телеметрии, «Найди спрятанную механику», квиз «Угадай охотника по следу»,
// квиз MDA, Фабрика MDA с колодами урока, образец урока в промпте программиста, демо-сборка урока, дуэль с Вожаком (ручка vs), предсказание в плейтесте.
// Урок 4 в обоих прогонах: «Каменный стакан» и его спрятанная механика (мешок и предпросмотр), квиз «Собери цикл», Фабрика под донора,
// мастерская вариаций «Тетриса» (шаг variety с полосой длины цикла), образец урока в промпте программиста и демо-игра урока, релиз модуля с чек-листом, дуэль двух стаканов по ручке duo.
// Данные и настройки — во временной папке, настоящий portal/config.json и portal/data/ не трогаются.
// Урок 5 в обоих прогонах: «Тур над Хаджохом», сырой прыжок и «Найди спрятанную механику», мастерская вариаций платформера (variety с полосой спасённых нажатий), лаборатория прыжка, слепой турнир по одной ручке,
// образец урока в промпте программиста и демо-игра урока, спидран с призраком лучшей попытки.
// Урок 6 в обоих прогонах: «Ледолом» и 12 переключателей сочности оболочки 0.3, сухой «Ледолом» и «Найди спрятанную механику», мастерская вариаций арканоида (лазер, невидимки, тяжесть, мультибол — доска с лучшей серией и конструктор), квиз «Сухая или сочная?»,
// образец урока и демо-игра, кооператив двух лопат, слепая проба игры соседа (сухая и сочная копии).
// Урок 7 в обоих прогонах: «Шаг в такт» на одних часах и без спрятанной механики, мастерская вариаций ритм-игры (пригнись, исчезают, держи, двойной темп — доска с точностью и конструктор), предсказание «что будет без звука», квиз «Угадай по звуку»,
// секвенсор мелодии: своя мелодия уходит в ремейк (lab.data) и в черновик ИГРА, образец урока, ритм-дуэль.
// Урок 8 в обоих прогонах: «Башня до неба» с окном «идеально» и без спрятанной механики, мастерская вариаций на одну кнопку (маятник, ритм, инерция, блиц — доска со спасёнными плитами и конструктор), квиз «Какой это приём?», джем с донором Stack из колоды «одна кнопка»,
// образец урока, две башни вдвоём, релиз модуля 2; с подставным ИИ — выставка: соседка собирает игру джема, голоса в номинациях,
// итоги класса и кнопочный турнир на проекторе.
// Запуск: node portal/tools/e2e-portal.js [--headed] [--from=5]   Снимки — в portal/.check/portal-*.png
//         --only=5 или --only=3,6 — только эти уроки: от урока 1 остаются вход, вау-старт, Фабрика и сборка (класс, ученик, своя игра),
//         «Играем вместе» — только для уроков 4 и 6 (им нужны игры соседей). --mock-only — без второго, демо-прогона.
// Игры в рамках рисуются в половину разрешения (LAB_LOWRES), паузы квизов короче (LAB_FAST): без видеокарты так втрое быстрее.
'use strict';
const fs = require('fs');
const os = require('os');
const path = require('path');

const TMP = fs.mkdtempSync(path.join(os.tmpdir(), 'lab-e2e-'));
process.env.LAB_DATA = path.join(TMP, 'data');
process.env.LAB_CONFIG = path.join(TMP, 'config.json');
process.env.LAB_LESSONS = path.join(__dirname, 'fixtures', 'lessons'); // урок-проверка шага teacher-demo
process.env.LAB_CHAT_AUTO = path.join(__dirname, 'mock-ai.js'); // программист — подставной Qwen: ответ в окно Qwen вставляется сам
const OUT = path.resolve(__dirname, '..', '.check');
fs.mkdirSync(OUT, { recursive: true });

const { chromium } = require('playwright');
const mock = require('./mock-ai');
const ai = require('../lib/ai');
const portal = require('../server');
const lesson1 = require('../lessons/urok-01');
const SECRET1 = lesson1.wow.secrets.find(x => x.id === lesson1.wow.classSecret).title; // одна спрятанная механика игры класса урока 1
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
const ONLY = ((process.argv.find(a => a.startsWith('--only=')) || '=').split('=')[1]).split(',').map(Number).filter(Boolean);
const FULL1 = !ONLY.length || ONLY.includes(1); // урок 1 целиком
const want = n => (ONLY.length ? ONLY.includes(n) : n === 8 || FROM <= n);
const results = [];
const check = (what, ok, detail = '') => { results.push({ what, ok: !!ok, detail }); console.log(`  ${ok ? '✓' : '✗'} ${what}${detail ? ' — ' + detail : ''}`); };
const sleep = ms => new Promise(r => setTimeout(r, ms));
let failShots = async () => {};
let predicted = ''; // ответ «Что почувствует игрок?» на вау-старте: его напоминает шаг «Совпало?»

function writeConfig(aiPart) {
  fs.writeFileSync(process.env.LAB_CONFIG, JSON.stringify({ port: 0, teacherPassword: PASSWORD, ai: aiPart, models: [{ id: 'mock-code', label: 'Подставной программист', rubPer1MIn: 100, rubPer1MOut: 400, rubPer1MCacheRead: 10, rubPer1MCacheWrite: 125, cache: true }, { id: 'mock-text', label: 'Подставной продюсер', rubPer1MIn: 10, rubPer1MOut: 40 }, { id: 'mock-alt', label: 'Подставная вторая модель', rubPer1MIn: 50, rubPer1MOut: 200 }], limits: { aiCallsPerStudentPerLesson: 40, rublesPerLesson: 0 } }, null, 2));
  ai.reloadConfig();
}

async function gameFrame(page, urlPart, n = 0) {
  // опрос из проверки, а не waitForFunction внутри рамки: рамку могут пересоздать, пока игра грузится,
  // а без видеокарты загрузка игры в рамке занимает до десятков секунд (см. журнал, 19.10.2026)
  const t0 = Date.now();
  while (Date.now() - t0 < 60000) {
    const fr = page.frames().filter(f => f.url().includes(urlPart))[n];
    if (fr && await fr.evaluate('!!(window.__lab && (window.__lab.ready || window.__lab.errored))').catch(() => false)) {
      if (Date.now() - t0 > 15000) console.log(`    · игра в рамке ${urlPart} загрузилась за ${Math.round((Date.now() - t0) / 1000)} с`);
      return fr;
    }
    await sleep(250);
  }
  const all = await Promise.all(page.frames().slice(1).map(async f => f.url().replace(/^https?:\/\/[^/]+/, '') + ' — ' + await f.evaluate('window.__lab ? (window.__lab.ready ? "готова" : "грузится") : "нет __lab"').catch(x => 'ошибка: ' + x.message.split('\n')[0])));
  throw new Error(`Рамка ${urlPart} №${n} не дождалась игры за 60 с. Рамки: ${all.join('; ') || 'нет'}`);
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
// сортировщик квиза: ждём, пока сменится карточка или квиз кончится, а не паузу на анимацию
const nextItem = (page, step, prev) => page.waitForFunction(([s, p]) => { const e = document.querySelector(s + ' .item'); return !!document.querySelector(s + '.done') || !e || e.textContent.trim() !== p; }, [step, prev], { timeout: 15000 });
// «Айсберг» (шаг 8 урока 1): нырять до дна последнего погружения, потом «Понятно»; в уроках 2–8 шаг — обычный текст с «Понятно»
async function storyDone(page) {
  if (!(await page.locator('#step-secret-story [data-ice=dive]').count())) return page.click('#step-secret-story >> text=Понятно');
  for (let i = 0; i < 12 && !(await page.locator('#step-secret-story [data-ice=ok]:visible').count()); i++) await page.click('#step-secret-story [data-ice=dive]');
  await page.click('#step-secret-story [data-ice=ok]');
}
// правка в чате Qwen: ученик пишет Qwen сам и вставляет его ответ в окно правки; ответ «Qwen» — подставной chatAnswer.
// Если ответ не лёг, портал выдаёт сообщение для того же чата — его подставной Qwen получает сам (LAB_CHAT_AUTO).
async function chatEdit(student, stepId, what) {
  const sel = '#step-' + stepId, before = await student.locator(sel + ' .ver').count();
  await student.fill(sel + ' [data-ask=what]', what);
  await student.fill(sel + ' [data-paste=text]', mock.chatAnswer({ kind: 'правка', prompt: 'Ученик просит одно изменение: ' + what }));
  await student.click(sel + ' [data-paste=send]');
  await student.waitForFunction(([s, n]) => document.querySelectorAll(s + ' .ver').length > n, [sel, before], { timeout: 30000 });
}
// задание для Qwen — четыре части (portal/ai/chat-prompt.md): просьба автора, замысел ученика с донором, картинка, что нужно порталу
const clearTask = (t, donor) => /^собери яркую lowpoly 3d игру для школьников на html\n\n# Замысел геймдизайнера/.test(t || '') && (t || '').includes(donor) && /# Картинка/.test(t) && /# Что нужно порталу/.test(t) && !/const GAME/.test(t);
// «null» текстом на странице: нативный append превращает null в слово (так было под картами вау-старта и в спрятанной механике у учителя)
const nullText = p => p.evaluate(() => {
  const w = document.createTreeWalker(document.body, NodeFilter.SHOW_TEXT);
  for (let n; (n = w.nextNode());) if (/^\s*(null|undefined)\s*$/.test(n.nodeValue) && n.parentElement && n.parentElement.offsetParent !== null) return n.parentElement.outerHTML.replace(/\s+/g, ' ').slice(0, 160);
  return '';
}).catch(() => '');
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
  // вопросы «да / нет» портала (Lab.ask) в прогоне отвечают «да» сами
  for (const c of [tctx, sctx]) await c.addInitScript(() => { window.LAB_ASK_AUTO = true; window.LAB_FAST = true; window.LAB_LOWRES = true; }); // LAB_FAST — короткие паузы квизов, LAB_LOWRES — игры в половину разрешения
  const teacher = await tctx.newPage(), student = await sctx.newPage();
  await teacher.addInitScript(() => { window.LAB_PLAYTEST_SECONDS = 12; }); // бот-плейтестер в проверке играет короткие партии
  failShots = async () => { await student.screenshot({ path: path.join(OUT, `portal-${mode}-x-student.png`), fullPage: true }).catch(() => {}); await teacher.screenshot({ path: path.join(OUT, `portal-${mode}-x-teacher.png`) }).catch(() => {}); };
  for (const p of [teacher, student]) watch(p, errors);
  const shot = async (p, name, fullPage = false) => {
    const where = await nullText(p);
    if (where) check(`Нет слова «null» на странице (снимок ${name})`, false, where);
    return p.screenshot({ path: path.join(OUT, `portal-${mode}-${name}.png`), fullPage });
  };

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
  // пульт учителя (У1): сейчас — первый шаг вау-старта, его реплика из сценария по шагам (У2)
  await teacher.waitForSelector('.pult [data-pult-say="vopros-uroka"]', { timeout: 10000 });
  const pultSay = (await teacher.textContent('.pult .pult-say')).trim();
  check('Пульт учителя: сейчас — «Вопрос урока», реплика из сценария по шагам', pultSay === lesson1.checkpoints[0].steps[0].teacher.say && /шаг 1 из/.test(await teacher.textContent('.pult .eyebrow')), pultSay.slice(0, 80));
  await shot(teacher, '0-pult');
  {
    const sh = await teacher.context().newPage(); watch(sh, errors);
    await sh.goto(base + '/sheet?code=' + code);
    await sh.waitForSelector('#sheet table tbody tr');
    const rows = await sh.locator('#sheet table tbody tr').count(), txt = await sh.textContent('#sheet');
    check('Лист урока (У3): хронометраж всех чекпоинтов, вопрос урока, три понятия и словарик', rows === lesson1.checkpoints.length && txt.includes(lesson1.question) && await sh.locator('#sheet .concept').count() === 3 && /Словарик/.test(txt), `строк ${rows}`);
    await sh.screenshot({ path: path.join(OUT, `portal-${mode}-sheet.png`), fullPage: true });
    await sh.close();
  }

  // ученик: вход по коду
  await student.goto(base + '/?code=' + code);
  await student.fill('#nick', 'Тестер');
  await student.click('#studentForm button[type=submit]');
  await student.waitForURL('**/student');
  await student.waitForSelector('#step-donor-play');
  check('Ученик вошёл и видит открытый чекпоинт «Вау-старт»', true);
  check('Карты до вытягивания без слова «null»', !(await nullText(student)));
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
  // входная анкета (19.10.2026): любимые игры и ещё вопросы про игровой опыт — без ответа на все вопросы шаг не закрывается
  await student.click('#step-anketa .opts:not([data-q]) .opt >> nth=0');
  await student.click('#step-anketa >> text=Ответить');
  const ankNotDone = !(await student.locator('#step-anketa.done').count());
  for (const q of await student.locator('#step-anketa [data-q]').evaluateAll(g => g.map(x => x.dataset.q))) await student.click(`#step-anketa [data-q="${q}"] .opt >> nth=0`);
  await student.click('#step-anketa >> text=Ответить');
  await student.waitForSelector('#step-anketa.done');
  const ankPoll = await teacher.evaluate(async c => (await Lab.api('/api/teacher/poll?code=' + encodeURIComponent(c))).steps.filter(x => x.id.startsWith('anketa')), code.trim());
  check('Входная анкета: любимые игры и ещё шесть вопросов, без ответов шаг не закрывается, на проекторе полоска на каждый вопрос', ankNotDone && ankPoll.length === 7 && ankPoll.every(x => x.n === 1), ankPoll.map(x => x.title + ' ' + x.n).join('; '));
  // вопрос урока (П2): в начале и тот же в конце
  await student.click('#step-vopros-uroka .opt >> nth=1');
  await student.click('#step-vopros-uroka >> text=Ответить');
  await student.waitForSelector('#step-vopros-uroka.done');
  // словарик по месту (С2): подчёркнутое слово — одна фраза и пример урока
  await student.click('#main .term >> nth=0');
  await student.waitForSelector('.gloss-pop');
  check('Словарик: нажатие на подчёркнутое слово — фраза и пример урока', /У нас в уроке/.test(await student.textContent('.gloss-pop')), (await student.textContent('.gloss-pop')).slice(0, 80));
  await student.keyboard.press('Escape');
  // «Что почувствует игрок?» до игры класса: ответ вернётся в шаге «Совпало?» и на проектор
  predicted = (await student.textContent('#step-vau-predict .opt >> nth=1')).trim();
  await student.click('#step-vau-predict .opt >> nth=1');
  await student.click('#step-vau-predict >> text=Ответить');
  await student.waitForSelector('#step-vau-predict.done');

  // проектор: код класса и таймер открытого чекпоинта; вау-старт — карты при классе, общая игра со спрятанной механикой
  const pj = await openProjector(base, code, teacher, errors, shot);
  await wowStart(teacher, student, pj, mode, shot);
  await projectorWow(pj, teacher, shot);

  // учитель открывает все чекпоинты — ученик получает их без перезагрузки
  await teacher.click('.tabs >> text=Урок');
  await teacher.click('text=Открыть все');
  await student.waitForSelector('.cp.open >> nth=7', { timeout: 10000 });
  check('Чекпоинты открылись у ученика без перезагрузки (SSE)', true);

  if (FULL1) {
    await secretHunt(teacher, student, mode, shot);
    await projectorPair(pj, mode, shot);
    await projectorPoll(pj, shot);
  }

  // Фабрика и решения: карты вместо своих слов, свои слова — только «Чувство»
  await student.click('.cp >> text=Фабрика');
  // «Твист или спрятанная механика?» (И2): две корзины, клавиши 1 и 2
  await student.click('#step-tvist-sekret >> text=▶ Начать');
  for (let i = 0; i < 20 && !(await student.locator('#step-tvist-sekret.done').count()); i++) {
    const it = student.locator('#step-tvist-sekret .item');
    if (!(await it.count())) { await sleep(200); continue; }
    const text = (await it.textContent()).trim();
    await student.keyboard.press('Digit1');
    await nextItem(student, '#step-tvist-sekret', text);
  }
  check('«Твист или спрятанная механика?»: сортировка в две корзины пройдена', await student.locator('#step-tvist-sekret.done').count() === 1);
  check('Фабрика: пять опор, как на вау-старте', await student.locator('#step-fabrika .pillars .pil').count() === 5 && await student.locator('#step-fabrika .pillars .pil.up').count() >= 1);
  check('Урок 1: один уровень задания, остальные — цель версии 2', await student.locator('#step-fabrika >> text=Откроется после первой сборки — цель версии 2').count() === 2);
  check('«Что цепляет?» с донора — подсказка над полями Фабрики', /Тебя зацепило в доноре/.test(await student.textContent('#step-fabrika .hookbox')));
  await student.click('#step-fabrika >> text=🎲 Кубик для пустых полей');
  await student.fill('#f-fabrikatitle', 'Пасека под огнём');
  const secretCard = (await student.textContent('#step-fabrika .field:has(#f-fabrikasecret) .cardopt >> nth=0')).trim();
  await student.click('#step-fabrika .field:has(#f-fabrikasecret) .cardopt >> nth=0');
  await student.click('#step-fabrika >> text=Замысел готов');
  await student.waitForSelector('#step-fabrika.done');
  const diceTags = await student.locator('#step-fabrika .tag.dice').count(), cardTags = await student.locator('#step-fabrika .tag.card').count();
  check('Кубик заполнил поля [кубик], карта спрятанной механики взята картой', diceTags >= 4 && cardTags === 1 && (await student.inputValue('#f-fabrikasecret')) === secretCard, `кубик: ${diceTags}, карт: ${cardTags}, спрятанная механика: ${secretCard}`);
  await student.click('#step-resheniya .field:has(#f-resheniyafeeling) .dicebtn');
  check('Кубик «Чувства» даёт пример и не пишет за ученика', (await student.inputValue('#f-resheniyafeeling')) === '' && /^Например: .+ А у тебя\?$/.test((await student.textContent('#step-resheniya .hint.example')).trim()));
  await student.fill('#f-resheniyafeeling', 'Страшно, когда шершни уже у ульев');
  await student.click('#step-resheniya .field:has(#f-resheniyahonesty) .cardopt >> nth=0');
  await student.click('#step-resheniya .field:has(#f-resheniyachoice) .dicebtn');
  await student.click('#step-resheniya >> text=Решения приняты');
  await student.waitForSelector('#step-resheniya.done');
  await shot(student, '3-fabrika');

  // ИГРА — готовый промпт, правка по желанию (продюсера в уроке 1 нет, С1)
  const preview = (await student.textContent('#step-igra .preview-igra')).replace(/\s+/g, ' ');
  check('ИГРА: готовый промпт «Вот что получит программист», полей правки нет', /Вот что получит программист/.test(preview) && preview.includes('Пасека под огнём') && await student.locator('#f-igrai').count() === 0, preview.slice(0, 90));
  await student.click('#step-igra button:has-text("✎ Поправить")');
  const prefill = await student.inputValue('#f-igrai');
  check('По «✎ Поправить» — черновик ИГРА из Фабрики в полях', prefill.includes('Пасека под огнём'), prefill.slice(0, 60));
  await student.click('#step-igra button:text-is("Готово")');
  await student.waitForSelector('#step-igra.done');
  check('Сборка: три плитки Qwen, как у учителя (П3)', await student.locator('#step-sborka .qwen-tiles .qtile').count() === 3);
  // сборка: в демо — кнопкой «⚙ Собрать сейчас» из Фабрики, с ИИ — кнопкой шага сборки
  if (mode === 'mock') await student.click('#step-sborka >> text=⚙ Собрать игру');
  else await student.click('#step-fabrika >> text=⚙ Собрать сейчас');
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
  await student.waitForSelector('#step-sborka.done', { timeout: 10000 });
  check('Шаг сборки закрыт самой сборкой: программист — Qwen в чате', /chat\.qwen\.ai/.test(await student.textContent('#step-sborka')));

  if (FULL1) { // --only=N: остальное в уроке 1 пропускаем (без сдвига отступов, чтобы не мешать параллельным правкам)
  // после перемены: своя игра (урок 1, чекпоинт 5; упрощён 19.10.2026 — крупные плитки, разбор по шагам, правка в три шага)
  await student.click('.cp >> text=Своя игра');
  check('Над своей игрой — задуманное чувство', /Ты задумал: Страшно, когда шершни уже у ульев/.test(await student.textContent('#step-ruchki .recall')));
  check('Своя игра: под игрой нет баланса, версий и вставки из чата', await student.locator('#step-ruchki [data-balance], #step-ruchki .versions, #step-ruchki .pastebox').count() === 0);
  await student.click('#step-ruchki .veil button');
  own = await gameFrame(student, '/play/', 0);
  await playRound(own);
  await student.click('#step-ruchki [data-match="Частично"]');
  await student.waitForSelector('#step-ruchki.done', { timeout: 10000 });
  check('«Получилось чувство?» — одна плитка, и шаг засчитан', true);

  // разбор по шагам: 1) кривая игры (партия 6 секунд — счёт по секундам из оболочки), 2) что ИИ решил сам, 3) что починим
  check('Разбор: лесенка из трёх шагов, первый — кривая', /Кривая игры.*Что ИИ решил сам.*Что починим/.test((await student.textContent('#step-razbor .ladder')).replace(/\s+/g, ' ')));
  await student.click('#step-razbor .veil button');
  own = await gameFrame(student, '/play/', 0);
  await student.locator('#step-razbor iframe').scrollIntoViewIfNeeded(); // рамка за краем экрана кадров не рисует — время партии стоит
  await own.evaluate(() => window.__lab.confirm());
  // по игровым часам, а не по настенным: в программной отрисовке кадры редкие, и lab.t идёт медленнее
  const at = t => own.waitForFunction(x => window.__lab.lab.t >= x, t, { timeout: 30000, polling: 100 });
  await at(2.5); await own.evaluate(() => { window.__lab.lab.score = 3; });
  await at(5); await own.evaluate(() => { window.__lab.lab.score = 7; });
  await at(6.5); await own.evaluate(() => window.__lab.end('lose', 'Проверка'));
  await student.waitForSelector('#step-razbor svg.curve', { timeout: 10000 });
  check('Разбор: кривая партии нарисована по счёту из оболочки', await student.locator('#step-razbor svg.curve polyline.now').count() === 1);
  for (let i = 0; i < 4 && !(await student.locator('#step-razbor [data-curve-next]').count()); i++) {
    const curve = student.locator('#step-razbor svg.curve'), box = await curve.boundingBox();
    if (box) await curve.click({ position: { x: box.width * 0.6, y: box.height / 2 } }); // click сам прокручивает к кривой
    await sleep(500);
  }
  await shot(student, '5a-razbor-curve', true);
  await student.click('#step-razbor [data-curve-next]');
  await student.click('#step-razbor [data-sort="start"]');
  await student.waitForSelector('#step-razbor [data-bin], #step-razbor [data-done]');
  for (let i = 0; i < 12 && await student.locator('#step-razbor [data-bin]').count(); i++) { await student.click('#step-razbor [data-bin="ai"]'); await sleep(100); }
  const kept = await student.locator('#step-razbor [data-keep="keep"]').count();
  for (let i = 0; i < kept; i++) await student.click(`#step-razbor [data-keep="${i ? 'keep' : 'drop'}"] >> nth=${i}`);
  check('Что ИИ решил сам: карточки разложены, решения ИИ оставлены или убраны', kept >= 1 || mode === 'demo', `решений ИИ: ${kept}`);
  await student.click('#step-razbor [data-done]');
  const tilesText = (await student.textContent('#step-razbor .tiles')).replace(/\s+/g, ' ');
  check('Что починим: плитки — находки кривой и ИИ, частые беды и «своими словами»', /Скучное начало/.test(tilesText) && /Своими словами/.test(tilesText) && (kept < 1 || /Убрать своеволие ИИ/.test(tilesText)), tilesText.slice(0, 200));
  await student.click('#step-razbor [data-finding="tile-wow"]');
  await shot(student, '5b-razbor-itog', true);
  await student.click('#step-razbor [data-razbor="done"]');
  await student.waitForSelector('#step-razbor.done', { timeout: 10000 });
  check('Разбор готов: выбрано одно, что чиним', /сочности/.test(await student.textContent('#step-razbor .pickline')));

  // правка 1 в три шага: что меняем (выбранное в разборе — уже в поле) → скопировать для Qwen → вставить ответ
  await student.waitForFunction(() => { const i = document.querySelector('#step-masterskaya [data-ask=what]'); return i && i.value.length > 10; }, null, { timeout: 8000 }).catch(() => {});
  const pre = await student.inputValue('#step-masterskaya [data-ask=what]');
  check('Правка 1: то, что выбрал в разборе, — уже в просьбе', /сочности/.test(pre) && await student.locator('#step-masterskaya .simple-step').count() === 3, pre);
  check('Правка 1: под игрой только версии, без баланса', await student.locator('#step-masterskaya [data-balance]').count() === 0 && await student.locator('#step-masterskaya .versions').count() === 1);
  await student.click('#step-masterskaya [data-ask=copy]');
  await student.waitForFunction(() => /Скопировано/.test(document.querySelector('.toasts') ? document.querySelector('.toasts').textContent : ''), null, { timeout: 5000 }).catch(() => {});
  const firstAsk = await student.evaluate(() => Lab.api('/api/chat/ask', { what: 'проверка', pact: true }).then(r => r.text));
  check('Первая просьба — вместе с договором, одним сообщением', /Дальше я буду просить/.test(firstAsk) && /Правка: проверка/.test(firstAsk) && !/Договорились/.test(firstAsk), firstAsk.slice(0, 80));
  await chatEdit(student, 'masterskaya', 'Пусть последний враг мигает красным');
  check('Правка в чате Qwen: просьба своими словами, ответ вставлен — новая версия', /Правка дала версию/.test(await student.textContent('#step-masterskaya')));
  if (mode === 'mock') check('Куски правки не легли — портал попросил в тот же чат, Qwen прислал игру целиком', mock.last.changeTries.join(',') === 'куски,целиком', mock.last.changeTries.join(','));
  // «Стало лучше?»: «Хуже» — откат одной кнопкой; в демо — к v1, с ИИ — к починенной v2 (v1 нарочно падает, а в эту версию будут играть соседи)
  const back = mode === 'mock' ? 2 : 1;
  await student.click('#step-proverka .veil button');
  await playRound(await gameFrame(student, '/play/', 0));
  await student.click('#step-proverka [data-verdict="worse"]');
  await student.waitForSelector('#step-proverka.done', { timeout: 10000 });
  await student.click('#step-proverka [data-verify="back"]');
  await sleep(500);
  const cur = await student.textContent('#step-masterskaya .ver.cur');
  check(`«Хуже» — откат к версии ${back} одной кнопкой`, new RegExp('v' + back).test(cur), cur);
  await shot(student, '6-workshop', true);

  } // FULL1
  if (mode === 'mock' && (FULL1 || ONLY.some(n => n === 4 || n === 6))) await together(browser, base, code, teacher, student, errors, shot);
  else if (FULL1 && mode === 'demo') {
    await student.click('.cp >> text=Играем вместе');
    await student.waitForSelector('#step-sosed >> text=Ждём игру соседа');
    check('Без игр соседей шаг arcade ждёт и не падает', true);
  }

  if (FULL1) { // --only=N: остальное в уроке 1 пропускаем
  // версия 2: правка 2 по карточкам соседей, сервер третью не берёт
  await student.click('.cp >> text=Версия 2');
  const before2 = await student.locator('#step-masterskaya-2 .ver').count();
  await chatEdit(student, 'masterskaya-2', 'Пусть в середине партии прилетает вторая волна');
  check('Правка 2 дала новую версию', await student.locator('#step-masterskaya-2 .ver').count() > before2);
  await shot(student, '6d-versiya2', true);
  check('Правок без лимита: чат бесплатный, окно правки осталось', await student.locator('#step-masterskaya-2 [data-paste=send]').count() === 1);

  // финал: турнир, сосед играет версию 2, линза, вопрос урока ещё раз, открытка; стена аркады урока на проекторе
  await student.click('.cp >> text=Турнир и финал');
  if (mode === 'mock') {
    await student.click('#step-sosed-v2 .veil button');
    await playRound(await gameFrame(student, '/play/', 0), { score: 15 });
    const okV2 = await student.waitForSelector('#step-sosed-v2.done', { timeout: 10000 }).then(() => true, () => false);
    check('Сосед в версии 2: шаг arcade с about засчитан', okV2, (await student.textContent('#step-sosed-v2 .gamebar')).replace(/\s+/g, ' '));
  }
  await student.click('#step-linza .lens-card');
  await student.waitForSelector('#step-linza.done');
  check('Линза эмоций переворачивается и ложится в колоду (С3)', /что должен почувствовать игрок/.test(await student.textContent('#step-linza .lens-face')));
  await student.click('#step-vopros-uroka-2 .opt >> text=Геймдизайнер');
  await student.click('#step-vopros-uroka-2 >> text=Ответить');
  await student.waitForSelector('#step-vopros-uroka-2.done');
  await student.waitForSelector('#step-otkrytka [data-postcard=save]', { timeout: 10000 });
  await student.click('#step-otkrytka [data-postcard=save]');
  await student.waitForSelector('#step-otkrytka.done');
  check('Открытка первой игры: название игры и задуманное чувство (И3)', /Пасека под огнём/.test(await student.textContent('#step-otkrytka .postcard')) && /шершни/.test(await student.textContent('#step-otkrytka .postcard')));
  await shot(student, '7-final', true);
  await student.click('#step-otkrytie-den .opt >> nth=0');
  await student.click('#step-otkrytie-den >> text=Ответить');
  await student.waitForSelector('#step-otkrytie-den.done');
  check('Финал без «Плана следующей версии»: шагов шесть', await student.locator('#step-plan-v2').count() === 0 && lesson1.checkpoints.find(c => c.id === 'final').steps.length === 6);
  await projectorFinal(pj, shot);
  // «Моя студия»: полка, значки, журнал с планом версии 2, эмблема у ника в аркаде
  {
    const sp = await student.context().newPage(); watch(sp, errors);
    await sp.goto(base + '/studio'); await sp.waitForSelector('#badges .badge');
    const sv = await sp.evaluate(() => Lab.api('/api/studio'));
    check('Моя студия: игра на полке, значок «Первая сборка», открытие дня в журнале',
      sv.games.length >= 1 && sv.badges.find(b => b.id === 'build').got && sv.journal.some(j => j.discovery), `игр ${sv.games.length}, значков ${sv.badges.filter(b => b.got).length}`);
    check('Моя студия: открытка первой игры на полке открыток', (sv.postcards || []).some(c => c.title === 'Пасека под огнём') && await sp.locator('#postcards .postcard').count() >= 1, `открыток ${(sv.postcards || []).length}`);
    await sp.click('#emblems .emblem >> nth=2');
    await sp.waitForFunction(() => /^\S+ Тестер/.test(document.querySelector('#nick').textContent), null, { timeout: 5000 });
    const card = (await sp.evaluate(() => Lab.api('/api/arcade'))).mine[0];
    check('Эмблема студии видна рядом с ником в аркаде', !!card.emblem, card.emblem);
    await shot(sp, '6c-studio', true);
    await sp.close();
  }
  // игра одним файлом: оболочка, three.js и код версии внутри, скачивание вложением
  {
    const me3 = await student.evaluate(() => Lab.api('/api/me'));
    const dl = await student.evaluate(u => fetch(u).then(async r => ({ status: r.status, cd: r.headers.get('content-disposition') || '', html: await r.text() })), `/download/${me3.game.id}/${me3.game.current}.html`);
    check('Игра скачивается одним файлом .html', dl.status === 200 && /attachment/.test(dl.cd) && dl.html.length > 1e6 && !/src="lab-three\.js"/.test(dl.html) && /\bGAME\b/.test(dl.html), `${Math.round(dl.html.length / 1e6)} МБ, ${dl.cd.slice(0, 40)}`);
  }
  // «Нужна помощь»: рука ученика — первой в очереди учителя, «Помог» опускает её
  await teacher.click('.tabs >> text=Урок');
  await student.click('#helpBtn');
  await teacher.waitForSelector('#helpQueue [data-helped="Тестер"]', { timeout: 10000 });
  check('Поднятая рука ученика — в очереди «Нужна помощь» у учителя', /поднял руку/.test(await teacher.textContent('#helpQueue')));
  await teacher.click('#helpQueue [data-helped="Тестер"]');
  await student.waitForFunction(() => /Нужна помощь/.test(document.querySelector('#helpBtn').textContent), null, { timeout: 10000 });
  check('Кнопка учителя «Помог» опустила руку у ученика', true);
  const wall = await teacher.evaluate(c => Lab.api('/api/teacher/wall?code=' + c), code);
  check('Финал на проекторе: рейтинг «ещё раз» и несбывшиеся предсказания', Array.isArray(wall.again) && Array.isArray(wall.fails), `ещё раз: ${wall.again.length}, провалов: ${wall.fails.length}`);
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
    // chat.qwen.ai: две сборки учеников, каждая упала в рамке и починена через тот же чат
    const q = byM['chat.qwen.ai'];
    check('Отчёт: chat.qwen.ai — 2 игры, 0% с первой попытки, все работают после починки', q && q[1] === '2' && q[2] === '0%' && q[3] === '100%', JSON.stringify(q || rows));
    const [bom, csvText] = await teacher.evaluate(async () => { const b = new Uint8Array(await (await fetch(document.querySelector('#csvGames').href)).arrayBuffer()); return [[...b.slice(0, 3)].join(','), new TextDecoder().decode(b)]; });
    const lines = csvText.trim().split(/\r?\n/);
    check('CSV по играм: заголовок, строка на игру, «;» и BOM', bom === '239,187,191' && /^Дата;Класс;Ученик/.test(lines[0]) && lines.length === 3 && lines.every((l, i) => !i || l.includes('chat.qwen.ai')), lines.length + ' строк');
    const calls = await teacher.evaluate(async () => (await fetch(document.querySelector('#csvCalls').href)).text());
    check('CSV всех вызовов модели', /Токены вход/.test(calls) && calls.trim().split(/\r?\n/).length > 6);
  } else check('Демо-режим виден учителю', /демо-режим/i.test(aiTab));
  await shot(teacher, '8-ai', true);
  await fixtureLesson(mode, teacher, student, pj, shot);
  } // FULL1
  if (want(2)) await lessonTwo(mode, teacher, student, shot);
  if (want(3)) await lessonThree(mode, teacher, student, shot);
  if (want(4)) await lessonFour(mode, teacher, student, shot);
  if (want(5)) await lessonFive(mode, teacher, student, shot);
  if (want(6)) await lessonSix(mode, teacher, student, shot);
  if (want(7)) await lessonSeven(mode, teacher, student, shot);
  if (want(8)) await lessonEight(mode, teacher, student, shot, { browser, base, code, errors, pj });
  // учитель возвращает класс к модулю 1: следующий прогон начинает с него
  await teacher.click('.tabs >> text=Урок');
  await teacher.selectOption('#moduleSel', '1');
  await teacher.selectOption('#lessonSel', 'urok-01');
  await student.waitForFunction(() => /Урок 1/.test(document.querySelector('#lessonTitle').textContent), null, { timeout: 15000 });
  await pj.close();

  check('Без ошибок JavaScript на страницах портала', !errors.length, errors.slice(0, 3).join(' | '));
  await tctx.close(); await sctx.close();
}

/* ---------- вау-старт: пять вопросов классу, сборка общей игры со спрятанной механикой, раздача ---------- */
async function wowStart(teacher, student, pj, mode, shot) {
  await teacher.click('.tabs >> text=Вау-старт');
  await teacher.waitForSelector('#wowCards .wowcard');
  const nCards = lesson1.wow.cards.length, q1 = lesson1.wow.cards[0], q2 = lesson1.wow.cards[1];
  const wcode = (await teacher.textContent('#classCode')).trim();
  const wowNow = () => teacher.evaluate(async c => Lab.api('/api/teacher/wow?code=' + encodeURIComponent(c)), wcode);
  // вопрос 1 — с проектора пробелом: три карты у ученика (SSE) и на проекторе, ученик голосует, учитель подводит итог
  await pj.click('#demoTab');
  await pj.waitForSelector('#pjAsk #pjAskNext', { timeout: 15000 });
  check('Проектор: вау-старт начинается с первого вопроса и пяти опор', (await pj.textContent('#pjAsk .op-q h1')).trim() === q1.q && await pj.locator('#pjAsk .op-step').count() === nCards && await pj.locator('#pjAsk .op-pil').count() === nCards);
  await pj.keyboard.press('Space');
  await student.waitForSelector('#step-vau-karty .op-pick >> nth=2', { timeout: 10000 });
  check('Вопрос учителя: у ученика вопрос, «зачем» и три карты', await student.locator('#step-vau-karty .op-pick').count() === lesson1.wow.ask.offer && (await student.textContent('#step-vau-karty .op-q')).includes(q1.q) && (await student.textContent('#step-vau-karty .op-why')).trim().length > 10);
  await pj.waitForSelector('#pjAsk .op-pick >> nth=2', { timeout: 8000 });
  await student.click('#step-vau-karty .op-pick >> nth=1');
  await student.waitForSelector('#step-vau-karty .op-pick.mine', { timeout: 5000 });
  await pj.waitForFunction(() => /1 голос/.test((document.querySelectorAll('#pjAsk .op-pick .op-votes')[1] || {}).textContent), null, { timeout: 8000 });
  check('Голос ученика: отметка «твой голос» у него и голос на проекторе почти сразу', true);
  await teacher.waitForSelector('#wowCards .wow-offer >> text=голосов: 1', { timeout: 10000 });
  await shot(student, '1c-wow-golos');
  await shot(teacher, '1c-wow-uchitel');
  const o1 = (await wowNow()).offer;
  await shot(pj, 'p2-wow-vopros');
  await teacher.click('#wowAskPick');
  await student.waitForSelector('#step-vau-karty .op-pick.win', { timeout: 10000 });
  const res = (await student.textContent('#step-vau-karty .op-result')).trim();
  check('Итог голосования: победила карта ученика, у ученика — вспышка и «Твоя карта победила»', /Твоя карта победила/.test(res) && (await wowNow()).wow.cards[q1.id] === o1.options[1], res);
  await pj.waitForSelector('#pjAsk .op-pick.win', { timeout: 8000 });
  await shot(pj, 'p2-wow-itog');
  await pj.waitForSelector(`#pjAsk .op-mini.on[data-op=${q1.id}]`, { timeout: 8000 });
  check('Проектор: карта-победитель улетела под опору, опора выросла, строка в документе', await pj.locator(`#pjAsk .op-pil.up[data-op=${q1.id}]`).count() === 1 && await pj.locator(`#pjAsk .op-ln.on[data-op=${q1.id}]`).count() === 1);
  await pj.waitForFunction(q => (document.querySelector('#pjAsk .op-q h1') || {}).textContent === q, q2.q, { timeout: 8000 });
  check('Проектор: следующий вопрос ждёт пробела', true);
  await pj.click('.pj-tabs >> text=Урок');
  // вопрос 2 — из панели учителя, учитель выбирает карту сам
  await teacher.click('#wowAskNext');
  await teacher.waitForSelector('#wowCards .wow-offer .op-pick >> nth=2', { timeout: 8000 });
  const o2 = (await wowNow()).offer;
  await teacher.click('#wowCards .wow-offer >> text=Выбрать эту >> nth=2');
  await teacher.waitForFunction(() => !document.querySelector('#wowCards .wow-offer'), null, { timeout: 8000 });
  const w2 = (await wowNow()).wow;
  check('Учитель выбрал карту вопроса сам', o2.card === q2.id && w2.cards[q2.id] === o2.options[2] && w2.last.by === 'учитель', w2.cards[q2.id]);
  // остальные карты — кубиком без голосования
  for (const c of lesson1.wow.cards.slice(2)) await teacher.click(`#wowCards [data-card=${c.id}] >> text=🎲 Тянуть`);
  await student.waitForFunction(n => document.querySelectorAll('#step-vau-karty .op-pil.up').length === n && document.querySelectorAll('#step-vau-karty .op-ln.on').length === n, nCards, { timeout: 10000 }).catch(() => {});
  check('Ученик: на каждый ответ выросла опора, строка документа и набросок игры', await student.locator('#step-vau-karty .op-pil.up').count() === nCards && await student.locator('#step-vau-karty .op-ln.on').count() === nCards && await student.locator('#step-vau-karty .op-game canvas').count() === 1);
  check('Ученик: пять из пяти — игра готова к сборке', await student.waitForSelector('#step-vau-karty .op-ready', { timeout: 6000 }).then(() => true, () => false));
  // цельный образ: герой и угроза — из мира на карте «Мир», поворот — из колоды жанра на карте «Игра»
  const deckOf = (id, c) => { const k = lesson1.wow.cards.find(x => x.id === id); return k.decks ? k.decks[c[k.by]] : k.deck; };
  const inDeck = (id, c) => (deckOf(id, c) || []).includes(c[id]);
  const c1 = (await wowNow()).wow.cards;
  check('Герой и угроза — из мира, поворот — из колоды жанра', inDeck('hero', c1) && inDeck('threat', c1) && inDeck('twist', c1), c1.place.split(' — ')[0]);
  const c2 = await teacher.evaluate(async c => (await Lab.api('/api/teacher/wow/draw', { code: c, card: 'place' })).wow.cards, wcode);
  check('Новый мир перетянул героя и угрозу под себя, игра и поворот остались', c2.place !== c1.place && inDeck('hero', c2) && inDeck('threat', c2) && c2.action === c1.action && c2.twist === c1.twist, c2.place.split(' — ')[0]);
  check('Колода «Игра» — шесть знакомых игр с обликом, у каждого мира шесть героев и шесть угроз', q1.deck.length === 6 && q1.deck.every(t => lesson1.wow.look.games[t]) && q2.deck.every(t => lesson1.wow.look.worlds[t])
    && ['hero', 'threat'].every(id => Object.values(lesson1.wow.cards.find(x => x.id === id).decks).every(d => d.length === 6 && d.every(h => /^[^—]+ — /.test(h) && lesson1.wow.look.icons[h]))));
  // задание Qwen вау-старта 2.0: рецепт у всех шести игр, угроза мира встаёт врагом рецепта по своему ходу, мир — цветами и декором, проверка перед ответом
  const askGames = q1.deck.map(card => lesson1.wow.genres.find(g => g.card === card));
  check('Все шесть игр — с рецептом, врагом на каждый ход угрозы, удачей, проверкой и 8 поворотами с правилом', askGames.every(g => g.recipe && Object.keys(g.moves).length === 6 && g.luck && g.checks.length >= 5
    && lesson1.wow.cards.find(x => x.id === 'twist').decks[g.card].every(t => g.rules[t])));
  check('У каждой угрозы мира есть ход, и каждая игра знает этот ход', Object.values(lesson1.wow.moves).every(m => askGames.every(g => g.moves[m])) && Object.keys(lesson1.wow.moves).length === 36);
  const rg = askGames[0], place = q2.deck[0], world = lesson1.wow.worlds[place];
  const rc = { action: rg.card, hero: lesson1.wow.cards.find(x => x.id === 'hero').decks[place][0], place, threat: lesson1.wow.cards.find(x => x.id === 'threat').decks[place][0], twist: Object.keys(rg.rules)[0] };
  const move = lesson1.wow.moves[rc.threat];
  const rtask = ai.chatSharedText({ cards: rc, genre: rg, world, move, secret: 'секрет', link: null });
  check('Задание Qwen: рецепт слово в слово, враг по ходу угрозы, правило поворота и удача', rtask.includes(`Рецепт жанра «${rg.name}»`) && rg.recipe.every(l => rtask.includes(l)) && rtask.includes(`враг типа «${rg.moves[move]}»`) && rtask.includes(rg.rules[rc.twist]) && rtask.includes(rg.luck), rg.name);
  check('Задание Qwen: мир данными — цвета, что собираем, декор; проверка перед ответом', rtask.includes(world.sky[0]) && rtask.includes(world.itemName) && rtask.includes(world.decorNames) && rtask.includes('Проверь перед ответом') && rg.checks.every(c => rtask.includes(c)), world.name);
  check('Задание Qwen: как у лучших в жанре — образцы, зрелище, события и большое событие у всех шести игр', askGames.every(g => { const t = ai.chatSharedText({ cards: Object.assign({}, rc, { action: g.card }), genre: g, world, secret: 'секрет', link: null });
    return g.best && g.show.length >= 3 && g.beats.length >= 3 && g.boss && t.includes(`Как у лучших в жанре — ${g.best}`) && g.show.concat(g.beats, g.boss).every(l => t.includes(l)) && /каждые 8–10 с новое событие/.test(t); }));
  // картинка (19.10.2026): пол двумя тонами, ориентиры и кадр жанра — сразу после ответов класса, до рецепта; декор не повторяет героев и угрозы мира
  check('Задание Qwen: картинка до рецепта — пол, ориентиры мира и кадр жанра', rtask.indexOf('# Картинка') < rtask.indexOf('Рецепт жанра') && rtask.includes(world.floor[1]) && rtask.includes(world.landmarks) && rtask.includes(rg.shot) && askGames.every(g => g.shot) && (rtask.match(/# Картинка/g) || []).length === 1);
  check('У каждого мира пол двумя тонами и ориентиры, в декоре нет героев и угроз мира', Object.values(lesson1.wow.worlds).every(w => w.floor && w.floor.length === 3 && w.landmarks)
    && Object.entries(lesson1.wow.worlds).every(([card, w]) => ['hero', 'threat'].every(id => lesson1.wow.cards.find(x => x.id === id).decks[card].every(h => !w.decorNames.toLowerCase().includes(h.split(/[ —-]/)[0].toLowerCase().slice(0, 5))))));
  check('Задание Qwen: механика героя числами у всех шести игр — сразу после рецепта', askGames.every(g => g.controls && g.controls.length >= 4) && rtask.includes('Механика героя — точно так') && rg.controls.every(l => rtask.includes(l)) && rtask.indexOf('Механика героя') < rtask.indexOf('Как карты встают'));
  check('Задание Qwen: сочность жанра у каждого жанра колоды', lesson1.wow.genres.every(g => g.juice && ai.chatSharedText({ cards: Object.assign({}, rc, { action: g.card }), genre: g, secret: 'секрет', link: null }).includes(g.juice)));
  const plain = lesson1.wow.genres.find(g => !g.recipe);
  check('Жанр без рецепта: задание без строки рецепта', !/Рецепт жанра/.test(ai.chatSharedText({ cards: Object.assign({}, rc, { action: plain.card }), genre: plain, secret: 'секрет', link: null })));
  // спрятанная механика скрыта, пока учитель её не откроет; в уроке 1 она одна на все классы — ни кубика, ни замены
  check('Спрятанная механика скрыта у учителя, пока он её не откроет', !(await teacher.textContent('#wowSecret')).includes(SECRET1));
  await teacher.click('#wowSecret >> text=Показать');
  await teacher.waitForSelector('#wowSecret >> text=спрятанная механика урока');
  const secText = await teacher.textContent('#wowSecret');
  check('Учитель видит одну спрятанную механику урока, без кубика и замены', secText.includes(SECRET1) && await teacher.locator('#wowSecretSel').count() === 0 && !/Другая спрятанная механика|\[кубик\]/.test(secText), secText.replace(/\s+/g, ' ').slice(0, 120));
  check('Спрятанная механика у учителя без слова «null»', !(await nullText(teacher)));
  const swap = await teacher.evaluate(async c => { try { await Lab.api('/api/teacher/wow/secret', { code: c, id: 'uteshenie' }); return 200; } catch (e) { return e.status; } }, (await teacher.textContent('#classCode')).trim());
  check('Сервер не даёт заменить спрятанную механику урока', swap === 400, 'ответ ' + swap);
  await teacher.click('#wowSecret >> text=Скрыть');
  // связка от ИИ: геймдизайнер сводит карты в одну игру, учитель принимает — связку видят ученики, она уходит в сборку
  await teacher.click('#wowLink >> text=🧠 Документ от ИИ');
  await teacher.waitForSelector('#wowLink .link-phrase', { timeout: 30000 });
  let phrase = (await teacher.textContent('#wowLink .link-phrase')).trim();
  check('Гейм дизайн документ от ИИ свёл карты: фраза игры', phrase.length > 20, phrase.slice(0, 90));
  await teacher.click('#wowLink >> text=✓ Принять документ');
  await teacher.waitForSelector('#wowLink >> text=принят — уйдёт в сборку', { timeout: 10000 });
  // учитель правит связку руками: сохранённая правка сразу принята
  await teacher.click('#wowLink >> text=✎ Править');
  await teacher.waitForSelector('#wowLink textarea[data-link="phrase"]');
  const phrase0 = phrase;
  phrase = phrase0.slice(0, 350).trim() + ' Учитель добавил: козёл не тормозит.'; // поле правки — до 400 знаков, а фраза из колоды действий бывает длиннее
  await teacher.fill('#wowLink textarea[data-link="phrase"]', phrase);
  await teacher.click('#wowLink >> text=✓ Сохранить и принять');
  await teacher.waitForSelector('#wowLink >> text=принят — уйдёт в сборку', { timeout: 10000 });
  check('Учитель поправил связку руками', (await teacher.textContent('#wowLink .link-phrase')).trim() === phrase && (await teacher.textContent('#wowLink')).includes('✎ учитель'));
  await student.waitForSelector('#step-vau-karty .linkbox .link-phrase', { timeout: 10000 });
  await student.waitForFunction(p => (document.querySelector('#step-vau-karty .linkbox .link-phrase') || {}).textContent === p, phrase, { timeout: 10000 }).catch(() => {});
  check('Принятую связку видит ученик под картами', (await student.textContent('#step-vau-karty .linkbox .link-phrase')).trim() === phrase);
  await shot(teacher, '1a-wow-cards');
  // сборка: ученики видят, что ИИ собирает игру; учитель проверяет и раздаёт
  await teacher.click('#wowBuild >> text=⚙ Собрать в Qwen');
  await teacher.waitForSelector('#wowBuild >> text=📣 Раздать классу', { timeout: 60000 });
  const info = (await teacher.textContent('#wowBuild')).replace(/\s+/g, ' ');
  check('Qwen собрал игру класса с ручкой secret и скрытым счётчиком', !/нет ручки secret|не считается/.test(info) && /chat\.qwen\.ai/.test(info), info.slice(0, 120));
  if (mode === 'mock') check('Принятый гейм дизайн документ ушёл программисту вместе с картами', /Гейм дизайн документ \(класс принял его/.test(mock.last.wowUser || '') && (mock.last.wowUser || '').includes(phrase));
  if (mode === 'mock') { const threat = (await teacher.textContent('#wowCards [data-card=threat] .wc-text')).trim(); check('Карта угрозы ушла программисту с особенностью', /- Угроза: .+ — .+/.test(mock.last.wowUser || ''), threat); }
  if (mode === 'mock') check('Документ задаёт программисту жанр и камеру, кнопки контроллера и риск', /- Жанр и камера: Арена/.test(mock.last.wowUser || '') && /- Риск и очки: /.test(mock.last.wowUser || ''));
  // бот-плейтестер сам прогоняет новую версию в рамке предпросмотра: три партии, отчёт сохраняется у версии
  await teacher.waitForSelector('#wowBot .botbox', { timeout: 180000 });
  const botRows = await teacher.locator('#wowBot .botrow').count(), botText = (await teacher.textContent('#wowBot')).replace(/\s+/g, ' ');
  check('Бот-плейтестер сыграл три партии новой версии и копию без спрятанной механики', botRows === 4 && /Пассивный.*Торопыга.*Новичок.*Новичок без спрятанной механики/.test(botText), botText.slice(0, 200));
  check('Бот сравнил копии со спрятанной механикой и без и оценил спрятанную механику', await teacher.locator('#wowBot [data-secret]').count() === 1, (await teacher.textContent('#wowBot [data-secret]').catch(() => '')).trim().slice(0, 120));
  if (mode === 'mock') {
    const found = await teacher.locator('#wowBot .botfind li').count();
    check('Бот нашёл, что править, и предлагает правку программисту', found > 0 && await teacher.locator('#wowBot >> text=Пусть программист поправит по отчёту').count() === 1, `находок ${found}`);
    await teacher.click('#wowBot >> text=Пусть программист поправит по отчёту');
    await teacher.waitForSelector('#wowBot >> text=до правки:', { timeout: 180000 });
    check('Программист получил отчёт бота и правил по нему', /отчёту бота-плейтестера:\n- /.test(mock.last.playtestUser || ''));
    const info2 = (await teacher.textContent('#wowBuild')).replace(/\s+/g, ' ');
    check('Правка по плейтесту — новая версия игры класса, бот проверил её снова', /v2/.test(info2) && /↩ Вернуть v1/.test(info2), info2.slice(0, 120));
  }
  if (await teacher.locator('#wowBuild .veil:not([hidden]) button').count()) await teacher.click('#wowBuild .veil button');
  const tf = await gameFrame(teacher, '/play/', 0);
  if (mode === 'mock') check('Правка по отчёту пришла кусками и легла в код игры', /Правка по плейтесту/.test(await tf.evaluate(() => (GAME.notes || []).join(' '))));
  await shot(teacher, '1b-wow-preview');
  await teacher.click('#wowBuild >> text=📣 Раздать классу');
  await student.waitForSelector('#step-vau-karty.done', { timeout: 10000 });
  check('Игра класса роздана: шаг карт закрыт', true);
}

/* ---------- чекпоинт «Спрятанная механика»: та же игра без спрятанной механики, «Найди спрятанную механику», квиз с карточками игры класса ---------- */
async function secretHunt(teacher, student, mode, shot) {
  await student.click('.cp >> text=Спрятанная механика');
  // слепой тест: две копии игры класса, в одной ручка спрятанной механики выключена; в копии со спрятанной механикой она срабатывает 5 раз
  const knob = 'secret', seen = {};
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
    if (k === 'A') check('Скрытый счётчик спрятанной механики не виден игроку на экране конца партии', !/_secret/.test(await f.evaluate(() => document.body.innerText)));
  }
  const side = seen.A === 1 ? 'A' : 'B';
  check('Слепой тест: в одной копии спрятанная механика есть, в другой выключена', (seen.A === 1) !== (seen.B === 1) && [seen.A, seen.B].includes(0), `А: ${knob} = ${seen.A}, Б: ${knob} = ${seen.B}`);
  await student.click(`#step-secret-ab .opt >> text=В игре ${side === 'A' ? 'А' : 'Б'}`);
  await student.waitForSelector('#step-secret-ab.done');
  // «Совпало?»: напоминание ответа с вау-старта
  const recall = (await student.textContent('#step-vau-match .recall')).replace(/\s+/g, ' ');
  check('«Совпало?» напоминает, что ученик задумал на вау-старте', recall.includes(predicted), recall);
  await student.click('#step-vau-match .opt >> nth=0');
  await student.click('#step-vau-match >> text=Ответить');
  await student.waitForSelector('#step-vau-match.done');
  await student.waitForSelector('#step-secret-hunt .opt');
  const options = await student.locator('#step-secret-hunt .opt').allTextContents();
  const twist = (await teacher.textContent('#wowCards [data-card=twist] .wc-text')).trim(); // вкладка учителя скрыта, но карты в ней остались
  // ученик попадается в ловушку карт
  const pick = options.find(o => o.toLowerCase() === twist.toLowerCase());
  check('«Найди спрятанную механику»: 4 варианта, среди них ловушка с карты', options.length === 4 && options.some(o => o.toLowerCase() === twist.toLowerCase()) && options.includes(SECRET1), options.join(' | '));
  await student.click(`#step-secret-hunt .opt >> text=${pick}`);
  await student.click('#step-secret-hunt >> text=Это спрятанная механика!');
  await student.waitForSelector('#step-secret-hunt.done');
  const reveal = (await student.textContent('#step-secret-hunt')).replace(/\s+/g, ' ');
  check('Ловушка распознана, спрятанная механика раскрыта, счётчик из партий', /Ловушка/.test(reveal) && reveal.includes(SECRET1) && /сработала 6 раз/.test(reveal), reveal.slice(0, 160));
  check('Раскрытие: слепой тест угадан, моменты спрятанной механики на полоске партии', /спрятанная механика была именно там/.test(reveal) && await student.locator('#step-secret-hunt .marks i').count() >= 2, `отметок: ${await student.locator('#step-secret-hunt .marks i').count()}`);
  await shot(student, '2a-secret', true);
  // «Посмотри на спрятанную механику»: та же игра с лупой — оболочка зажигает её на каждом срабатывании, кнопки силы спрятанной механики 0 · 1 · 2
  await student.waitForSelector('#step-secret-lupa .donor-card h3', { timeout: 10000 });
  const lupaTitle = (await student.textContent('#step-secret-lupa .donor-card h3')).trim();
  check('Лупа открылась после «Найди спрятанную механику» с названием спрятанной механики', lupaTitle === SECRET1, lupaTitle);
  await student.click('#step-secret-lupa .veil button');
  const lf = await gameFrame(student, '/play/', 0);
  await sleep(600); // reveal приходит после ready
  const lupa0 = await lf.evaluate(() => window.__lab.lupa);
  check('Лупа в игре: значок с названием спрятанной механики, рекордов нет', !!lupa0 && lupa0.title === lupaTitle && lupa0.n === 0 && await student.locator('#step-secret-lupa .seg .opt').count() >= 2, JSON.stringify(lupa0));
  // сила спрятанной механики: ручка меняется до партии (новые значения ручек перезапускают партию)
  await student.click('#step-secret-lupa .seg .opt >> nth=0');
  await sleep(300);
  check('Кнопка «Спрятанная механика 0» выключила ручку спрятанной механики', await lf.evaluate(kn => window.__lab.cfg[kn], knob) === 0);
  await student.click('#step-secret-lupa .seg .opt >> nth=1');
  await sleep(300);
  await lf.evaluate(() => window.__lab.confirm());
  await sleep(300);
  await lf.evaluate(() => { window.__lab.lab.count('_secret'); window.__lab.lab.t += 1; window.__lab.lab.count('_secret'); });
  const lupa1 = await lf.evaluate(() => ({ l: window.__lab.lupa, on: document.querySelector('#lupa').classList.contains('on'), text: document.querySelector('#lupa').textContent }));
  check('Срабатывание спрятанной механики зажигает лупу и считает', lupa1.l.n === 2 && lupa1.on && /× 2/.test(lupa1.text), lupa1.text);
  await lf.evaluate(() => { window.__lab.lab.score = 10; window.__lab.end('lose', 'Проверка'); });
  await student.waitForSelector('#step-secret-lupa.done', { timeout: 10000 });
  const lupaDone = (await student.textContent('#step-secret-lupa')).replace(/\s+/g, ' ');
  check('Лупа: партия засчитана, строка «лупа загорелась»', /лупа загорелась 2 раз \(сила спрятанной механики 1\)/.test(lupaDone), (lupaDone.match(/За эту партию[^.]*/) || [lupaDone.slice(-120)])[0]);
  await student.click('#step-secret-seen .opt >> nth=0');
  await student.click('#step-secret-seen >> text=Ответить');
  await student.waitForSelector('#step-secret-seen.done');
  await student.click('#step-secret-feel .opt >> nth=0');
  await student.click('#step-secret-feel >> text=Ответить');
  // «Ты — Нисикадо» (И1): сбить волну до трёх пришельцев и решить, оставить ли случайность железа
  for (let i = 0; i < 30 && await student.locator('#step-nisikado [data-nk=keep]:visible').count() === 0; i++) await student.click('#step-nisikado [data-nk=fire]');
  await student.click('#step-nisikado [data-nk=keep]');
  await student.waitForSelector('#step-nisikado.done');
  check('«Ты — Нисикадо»: волна сбита, решение «оставить» засчитано, раскрыто правило', /так же, как Нисикадо/.test(await student.textContent('#step-nisikado .concept')));
  await shot(student, '2b-nisikado');
  // «Айсберг»: два погружения — донор и игра класса с найденной спрятанной механикой, на дне — роли
  const ice = async () => (await student.textContent('#step-secret-story .ice-l.on')).replace(/\s+/g, ' ');
  check('Айсберг: верхушка донора — что видит игрок', /Что видит игрок.*носится/.test(await ice()));
  await student.click('#step-secret-story [data-ice=dive]');
  check('Айсберг: под водой — правило донора', /Что спрятано.*Чем меньше пришельцев/.test(await ice()));
  await student.click('#step-secret-story [data-ice=dive]'); await student.click('#step-secret-story [data-ice=dive]');
  check('Айсберг: второе погружение — игра класса со своей спрятанной механикой', await student.textContent('#step-secret-story .ice-tag') === 'Игра нашего класса');
  await student.click('#step-secret-story [data-ice=dive]');
  const sec1 = lesson1.wow.secrets.find(x => x.id === lesson1.wow.classSecret).title;
  check('Айсберг: под водой игры класса — её спрятанная механика', (await ice()).includes(sec1), await ice());
  await student.click('#step-secret-story [data-ice=dive]');
  check('Айсберг: на дне — роли и «Понятно»', await student.locator('#step-secret-story [data-ice=ok]:visible').count() === 1 && /Геймдизайнер решает/.test(await student.textContent('#step-secret-story .ice-fin')));
  await shot(student, '2c-iceberg');
  await storyDone(student);
  // квиз: постоянные карточки + карточки из игры класса (карты и раскрытая спрятанная механика)
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
    if (i === 0) { await sleep(400); check('Квиз: после ответа карточка ждёт кнопку «Далее»', (await student.textContent('#step-secret-quiz .item')).trim() === text && await student.locator('#step-secret-quiz [data-next]:visible').count() === 1); }
    await student.click('#step-secret-quiz [data-next]');
    await nextItem(student, '#step-secret-quiz', text);
  }
  await student.waitForSelector('#step-secret-quiz.done');
  const quizText = await student.textContent('#step-secret-quiz h2 >> nth=1');
  const all = quiz.items.length + quiz.wowItems.length;
  check('Квиз «Чьё это решение?» с карточками игры класса пройден', new RegExp(`${all} из ${all}`).test(quizText), quizText);
  await shot(student, '2-quiz');
  check('Квиз: результат отправлен учителю, кнопки «Скопировать» у ученика нет', await student.locator('#step-secret-quiz >> text=✓ Результат отправлен учителю').count() === 1 && await student.locator('#step-secret-quiz >> text=Скопировать').count() === 0);
  // вкладка «Ответы»: ответ квиза у учителя, разбор по карточкам, CSV
  await teacher.click('.tabs >> text=Ответы');
  await teacher.click('#tab-answers >> text=2. Игра класса и спрятанная механика');
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
  check('Учитель видит сводку спрятанной механики: партии, срабатывания, догадки, слепой тест', /сработала 6 раз/.test(sum) && /почувствовали спрятанную механику 1 из 1/.test(sum) && /ловушка/.test(sum), sum.slice(0, 200));
  await shot(teacher, '2b-wow-summary');
  await teacher.click('.tabs >> text=Урок');
}

/* ---------- проектор: «Ответы класса» — голоса полосками без имён ---------- */
async function projectorPoll(pj, shot) {
  await pj.click('.pj-tabs >> text=Ответы класса');
  await pj.waitForSelector('#pj-poll .pj-pollchips', { timeout: 10000 });
  // проектор пересобирает вкладку, когда приходят новые ответы: щелчок по старой кнопке может пропасть, поэтому до трёх попыток
  for (let i = 0; i < 3; i++) {
    await pj.click('#pj-poll .chipbtn >> text=Что почувствует игрок?');
    if (await pj.waitForSelector('#pj-poll .pj-pollcard h2 >> text=Что почувствует игрок?', { timeout: 3000 }).then(() => true, () => false)) break;
  }
  await pj.waitForSelector('#pj-poll .pj-pollcard >> text=ответили: 1', { timeout: 10000 });
  const poll = (await pj.textContent('#pj-poll')).replace(/\s+/g, ' ');
  check('Проектор «Ответы класса»: голоса шага полосками, без имён', poll.includes(predicted) && !/Тестер/.test(poll), poll.slice(0, 160));
  await pj.click('#pj-poll .chipbtn >> text=копия А или копия Б');
  await pj.waitForSelector('#pj-poll >> text=Спрятанную механику почувствовали вслепую 1 из 1', { timeout: 10000 });
  check('Проектор: сколько почувствовали спрятанную механику игры класса вслепую', true);
  await shot(pj, 'p3-poll');
  await pj.click('.pj-tabs >> text=Урок');
}
/* ---------- проектор: «Спрятанная механика рядом» — две копии игры класса, бот играет обе одними нажатиями ---------- */
async function projectorPair(pj, mode, shot) {
  check('Вкладка «Спрятанная механика рядом» есть на проекторе урока 1', await pj.locator('.pj-tabs >> text=Спрятанная механика рядом').isVisible());
  await pj.click('.pj-tabs >> text=Спрятанная механика рядом');
  await pj.waitForSelector('#pjPairRun', { timeout: 10000 });
  check('Название спрятанной механики скрыто до запуска показа', !/«/.test(await pj.textContent('#pj-pair h1')));
  await pj.click('#pjPairRun');
  await pj.waitForFunction(() => [...document.querySelectorAll('#pj-pair .pj-pair-side')].every(x => /Бот играет: \d+ из 60/.test(x.textContent)), null, { timeout: 40000 });
  const sides = [];
  for (const f of pj.frames().filter(f => f.url().includes('/play/'))) {
    const x = await f.evaluate(() => window.__lab && window.__lab.ready ? { cfg: window.__lab.cfg, lupa: window.__lab.lupa, bot: window.__lab.lab && window.__lab.lab.t > 0 } : null).catch(() => null);
    if (x && x.bot) sides.push(x);
  }
  const knob = 'secret';
  const off = sides.find(x => x.cfg[knob] === 0), on = sides.find(x => x.cfg[knob] !== 0);
  check('«Спрятанная механика рядом»: бот играет обе копии, слева спрятанная механика выключена, справа лупа', sides.length === 2 && !!off && !!on && !off.lupa && !!on.lupa, JSON.stringify(sides.map(x => ({ [knob]: x.cfg[knob], lupa: x.lupa && x.lupa.title }))));
  check('После запуска на проекторе видно название спрятанной механики', /«.+»/.test(await pj.textContent('#pj-pair h1')));
  await shot(pj, 'p2b-pair');
  await pj.click('.pj-tabs >> text=Урок');
  await sleep(500);
  check('Ушли с вкладки — копии остановлены', !(await pj.locator('#pj-pair iframe').count()));
}
/* ---------- проектор: «Финал» — стена аркады урока и провал дня ---------- */
async function projectorFinal(pj, shot) {
  await pj.click('.pj-tabs >> text=Финал');
  await pj.waitForSelector('#pj-final .acard', { timeout: 10000 });
  const n = await pj.locator('#pj-final .acard').count();
  check('Финал на проекторе: стена игр урока с рекордами', n >= 1 && /Стена аркады урока/.test(await pj.textContent('#pj-final h1')), `игр: ${n}`);
  await pj.click('#pj-final .acard button:has-text("Провал дня") >> nth=0');
  await pj.waitForSelector('#pj-final .pj-fail h2', { timeout: 10000 });
  await pj.fill('#pj-final .pj-fail input[type=text]', 'Пасечник улетел в небо');
  await pj.click('#pj-final .pj-fail >> text=Сохранить');
  await pj.waitForSelector('#pj-final .pj-fail >> text=Пасечник улетел в небо', { timeout: 10000 });
  check('Провал дня: игра урока в рамке на весь класс, заметка учителя', await pj.locator('#pj-final .pj-fail .gamebox, #pj-final .pj-fail iframe, #pj-final .pj-fail .veil').count() >= 1);
  await shot(pj, 'p4-final');
  await pj.click('#pj-final .pj-fail >> text=✕ Убрать');
  await pj.waitForSelector('#pj-final .pj-fail >> text=Самый смешной баг урока', { timeout: 10000 });
  await pj.click('.pj-tabs >> text=Урок');
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
  // проектор открывается после партии в донора: от старта таймера проходит до минуты
  check('Проектор: открытый чекпоинт и таймер по minutes урока', /Вау-старт/.test(await pj.textContent('.pj-cp h1')) && new RegExp(`^(${min}:00|${String(min - 1).padStart(2, '0')}:[0-5]\\d)$`).test(t), t);
  await shot(pj, 'p1-projector');
  return pj;
}

/* ---------- вау-старт урока 1 на проекторе: те же карты, игра у всех, спрятанной механики не видно ---------- */
async function projectorWow(pj, teacher, shot) {
  await pj.click('#demoTab');
  await pj.waitForFunction(n => document.querySelectorAll('#pjAsk .op-step.done').length === n, lesson1.wow.cards.length, { timeout: 15000 });
  const steps = await pj.$$eval('#pjAsk .op-step span', bs => bs.map(b => b.textContent.trim()));
  const inPanel = await teacher.evaluate(async c => (await Lab.api('/api/teacher/wow?code=' + encodeURIComponent(c))).wow.cards, (await teacher.textContent('#classCode')).trim());
  check('Проектор: те же ответы, что у учителя', lesson1.wow.cards.every((c, i) => steps[i].includes(inPanel[c.id].split(' — ')[0])), steps.join(' | '));
  // сцена «Пять опор»: опора на каждую карту, строки документа, выбитая опора — дыра в документе и подпись, что сломалось
  await pj.waitForFunction(n => document.querySelectorAll('.op-pil.up').length === n, lesson1.wow.cards.length, { timeout: 5000 }).catch(() => {});
  check('Проектор: опоры выросли под все карты, документ заполнен', await pj.locator('.op-pil.up').count() === lesson1.wow.cards.length && await pj.locator('.op-ln.on').count() === lesson1.wow.cards.length);
  await pj.click('.op-pil[data-op=threat]');
  await pj.waitForSelector('.op-ln.hole', { timeout: 3000 });
  check('Проектор: выбитая опора — дыра в документе, документ кренится, подпись говорит, что сломалось', /rotate/.test(await pj.getAttribute('.op-roof', 'style') || '') && /Без угрозы/.test(await pj.textContent('.op-cap')), await pj.textContent('.op-cap'));
  await shot(pj, 'p2-opory');
  await pj.click('.op-pil[data-op=threat]');
  await pj.waitForFunction(() => !document.querySelector('.op-ln.hole'), null, { timeout: 3000 });
  await pj.waitForSelector('#pjWowGame iframe, #pjWowGame .veil', { timeout: 15000 });
  const text = await pj.textContent('#pj-demo');
  check('Проектор: принятая связка на экране', await pj.locator('#pjWowLink .link-phrase').count() === 1);
  check('Проектор: игра класса роздана, спрятанной механики на экране нет', /Игра у всех/.test(text) && !lesson1.wow.secrets.some(x => text.includes(x.title)));
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
  check('Проектор: после «Открыть все» таймер у первого нового чекпоинта, видно, кто закончил шаги', /спрятанная механика/i.test(await pj.textContent('.pj-cp h1')) && /[1-9] из [12]/.test(pjText), pjText.replace(/\s+/g, ' ').slice(0, 120));
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
  await scriptEdit(teacher, shot);
}

/* ---------- режим автора: правка «Сценария учителя» пишется в файл урока ---------- */
async function scriptEdit(teacher, shot) {
  const file = path.join(__dirname, '..', 'lessons', 'urok-01.js'), orig = fs.readFileSync(file, 'utf8');
  const text = 'Проверка правки: «кавычки», \'апостроф\'\nи вторая строка';
  try {
    await teacher.click('#authorSw');
    // сценарий не текущего чекпоинта свёрнут; урок перерисовывается опросом, поэтому кнопка жмётся внутри ожидания
    await teacher.waitForFunction(() => { const b = document.querySelector('[data-script-edit=vau]'); if (!b) return false; b.closest('details').open = true; b.click(); return true; }, null, { timeout: 8000 });
    await teacher.waitForSelector('[data-script-field=say]', { timeout: 8000 });
    await teacher.fill('[data-script-field=say]', text);
    await sleep(3500); // опрос панели раз в 3 секунды не должен сбить открытую правку
    check('Правка сценария: опрос панели не сбивает ввод', await teacher.$eval('[data-script-field=say]', t => t.value) === text);
    await shot(teacher, '7c-script-edit');
    await teacher.click('[data-script-save=vau]');
    await teacher.waitForFunction(t => [...document.querySelectorAll('details.tscript dd')].some(d => d.textContent === t), text, { timeout: 8000 });
    delete require.cache[require.resolve(file)];
    check('Правка сценария записана в файл урока и видна в панели', require(file).checkpoints.find(c => c.id === 'vau').teacher.say === text && fs.readFileSync(file, 'utf8') !== orig);
  } finally {
    fs.writeFileSync(file, orig);
    delete require.cache[require.resolve(file)];
    if (await teacher.$('#authorSw.on')) await teacher.click('#authorSw');
  }
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

/* ---------- урок 2: донор и одно правило, спрятанная механика донора, квизы, Фабрика с донором на выбор, сборка, дуэль ---------- */
const step2 = id => lesson2.checkpoints.flatMap(c => c.steps).find(s => s.id === id);
// эксперимент с ручкой (уроки 2–8): партия как есть → ручка и предсказание → партия с ручкой → сравнение → «Оставить эти числа» — версия «баланс» без ИИ
async function experimentRound(student, shot) {
  // эксперимент с ручкой: партия как есть → ручка и предсказание → партия с ручкой → сравнение → «Оставить эти числа» — версия «баланс» без ИИ
  const aiBefore = (await student.evaluate(() => Lab.api('/api/me'))).aiCalls;
  await student.click('#step-eksperiment .veil .btn');
  let ex = await gameFrame(student, '/play/', 0);
  await playRound(ex, { score: 40 });
  await student.waitForSelector('#step-eksperiment [data-exp=knob]', { timeout: 10000 });
  const knob = await student.$eval('#step-eksperiment [data-exp=knob]', s => s.options[1].value);
  await student.selectOption('#step-eksperiment [data-exp=knob]', knob);
  await student.fill('#f-eksperimentguess', 'Станет напряжённее');
  await student.waitForTimeout(700);
  const turned = await student.$eval('#step-eksperiment [data-exp=range]', r => { const to = Number(r.value) === Number(r.max) ? r.min : r.max; r.value = to; r.dispatchEvent(new Event('input')); r.dispatchEvent(new Event('change')); return Number(to); });
  await student.waitForSelector('#step-eksperiment >> text=Ручка уже повёрнута в игре', { timeout: 10000 });
  await sleep(600);
  await playRound(ex, { score: 70, restart: true });
  await student.waitForSelector('#step-eksperiment [data-result]', { timeout: 10000 });
  check('Эксперимент: цифры партии как есть и с ручкой рядом', /как есть/.test(await student.textContent('#step-eksperiment table')), `ручка ${knob} → ${turned}`);
  await student.click('#step-eksperiment [data-result="Сбылось"]');
  await student.fill('#f-eksperimentnoticed', 'Враги ближе, партия короче');
  const exVers = await student.locator('#step-eksperiment .ver').count();
  await student.click('#step-eksperiment [data-exp=keep]');
  await student.waitForFunction(n => document.querySelectorAll('#step-eksperiment .ver').length > n, exVers, { timeout: 15000 });
  await student.waitForSelector('#step-eksperiment.done', { timeout: 10000 });
  const me2 = await student.evaluate(() => Lab.api('/api/me'));
  const balV = me2.game.versions[me2.game.current - 1];
  check('«Оставить эти числа» — новая версия «баланс» без вызова ИИ', balV.kind === 'баланс' && balV.cfg[knob] === turned && me2.aiCalls === aiBefore, `v${me2.game.current}: ${JSON.stringify(balV.cfg)}`);
  const balHtml = await student.evaluate(u => fetch(u).then(r => r.text()), `/play/${me2.game.id}/${me2.game.current}`);
  check('Числа баланса в коде версии: оболочка берёт их как «Как задумано»', balHtml.includes('Лаб3D: баланс автора') && balHtml.includes(`"${knob}":${turned}`));
  ex = await gameFrame(student, `/play/${me2.game.id}/${me2.game.current}`, 0); // рамка перезапущена на новой версии
  const asDesigned = await ex.evaluate(k => GAME.config[k].value, knob); // eslint-disable-line no-undef
  check('Новая версия стартует с числами автора', asDesigned === turned, `${knob} = ${asDesigned}`);
  await shot(student, 'l8-experiment', true);
  // «Моя студия» после эксперимента: значки «Баланс без ИИ» и «Экспериментатор», запись эксперимента в журнале
  const sv = await student.evaluate(() => Lab.api('/api/studio'));
  check('Моя студия: значки «Баланс без ИИ» и «Экспериментатор», эксперимент в журнале', sv.badges.find(b => b.id === 'balance').got && sv.badges.find(b => b.id === 'experiment').got && sv.journal.some(j => j.experiments.length), sv.badges.filter(b => b.got).map(b => b.title).join(', '));
}

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

  // мастерская вариаций: плитка — партия — «какая это игра» — «что повернули»; после четырёх — доска, самая интересная и конструктор
  const vstep = step2('secret-play');
  await student.click('.cp >> text=Одна механика');
  await student.waitForSelector('#step-secret-play [data-var]');
  check('Мастерская вариаций: ядро и плитки всех вариаций', /положи камень → собери линию/.test(await student.textContent('#step-secret-play')) && await student.locator('#step-secret-play [data-var]').count() === vstep.variants.length);
  const tryVars = [['veter', v => v.rule === 2], ['connect', v => v.drop === 1 && v.size === 7 && v.need === 4], ['bomby', v => v.bombs === 2 && v.size === 5], ['naoborot', v => v.misere === 1 && v.size === 4]];
  for (const [k, [id, ok]] of tryVars.entries()) {
    const x = vstep.variants.find(y => y.id === id);
    await student.click(`#step-secret-play [data-var=${id}]`);
    await student.click('#step-secret-play .veil button');
    gf = await gameFrame(student, 'kamni-mudreca', 0);
    await gf.waitForFunction(() => window.__lab.cfg.games === 1, null, { timeout: 5000 }).catch(() => {});
    check(`Вариация «${x.label}» включила свои ручки`, ok(await gf.evaluate(() => window.__lab.cfg)));
    await gf.evaluate(() => window.__lab.confirm());
    await sleep(300);
    await gf.evaluate(k => { const L = window.__lab.lab; if (k === 0) { L.count('_secret', 4); L.count('победы', 1); } L.stat('исход известен с хода', 5); L.stat('ходов в партии', 8); L.score = 150; window.__lab.end('win', 'Проверка'); }, k);
    await student.waitForSelector('#step-secret-play [data-feel]', { timeout: 10000 });
    await student.click(`#step-secret-play [data-feel] >> nth=${k}`);
    const dial = k === 1 ? vstep.dials.find(d => d.id !== x.dial).id : x.dial; // на второй ошибаемся
    await student.click(`#step-secret-play [data-dial=${dial}]`);
    await student.waitForSelector('#step-secret-play .verdict');
    if (k === 1) check('Вариации: ошибка в детали — разбор, какую деталь повернули', /Не совсем/.test(await student.textContent('#step-secret-play .verdict')) && (await student.textContent('#step-secret-play .verdict')).includes(x.why));
    await student.click('#step-secret-play [data-next]');
  }
  await student.waitForSelector('#step-secret-play .var-board');
  check('Доска вариаций: четыре игры, чувство и когда стал ясен исход', await student.locator('#step-secret-play .var-row').count() === 4 && /исход ясен с хода 5 из 8/.test(await student.textContent('#step-secret-play .var-board')));
  await shot(student, '21-u2-variacii', true);
  await student.click('#step-secret-play [data-fav=connect]');
  await student.waitForSelector('#step-secret-play.done', { timeout: 10000 });
  await student.click('#step-secret-play [data-mix="Падают вниз"]');
  check('Конструктор вариации: выбранная плитка становится своей вариацией', /Твоя вариация: Падают вниз/.test(await student.textContent('#step-secret-play .pickline')));

  // «Найди спрятанную механику» донора: ответ — с сервера только после догадки
  const hunt = step2('secret-hunt').hunt;
  const me = await student.evaluate(async () => JSON.stringify(await (await fetch('/api/me', { headers: { 'x-lab-token': Lab.token.get() } })).json()));
  check('Ответ «Найди спрятанную механику» не уходит ученику заранее', me.includes(hunt.question) && !me.includes('"trapText"') && !me.includes(hunt.reveal.slice(0, 30)));
  await student.waitForSelector('#step-secret-hunt .opt');
  const pick = mode === 'mock' ? hunt.trap : hunt.right;
  await student.click(`#step-secret-hunt .opt >> text=${pick}`);
  await student.click('#step-secret-hunt >> text=Ответить');
  await student.waitForSelector('#step-secret-hunt.done');
  const reveal = (await student.textContent('#step-secret-hunt')).replace(/\s+/g, ' ');
  check(mode === 'mock' ? 'Спрятанная механика донора: ловушка «мудрец поддавался» распознана' : 'Спрятанная механика донора угадана: неопределённость исхода',
    (mode === 'mock' ? /Ловушка! Мудрец не поддавался/.test(reveal) : /Точно!/.test(reveal)) && /Неопределённость исхода/.test(reveal), reveal.slice(0, 120));
  check('Сравнение: классика и одно правило, счётчики телеметрии и спрятанная механика', /ничьи 3/.test(reveal) && /победы 1/.test(reveal) && /спрятанная механика сработала 4 раз/.test(reveal), (reveal.match(/С одним правилом.*?Классика[^О]*/) || [''])[0].slice(0, 160));
  await shot(student, '21-u2-secret', true);
  await storyDone(student);

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
      await nextItem(student, '#step-detali', text);
      continue;
    }
    if (i === 1) { for (let n = 0; n < k; n++) await student.keyboard.press('ArrowRight'); await student.keyboard.press('Space'); } // стрелками и пробелом
    else await student.keyboard.press('Digit' + (k + 1));
    await nextItem(student, '#step-detali', text);
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
  // солнце в центр, луна — курсор занят, сдвиг не нужен: ждём ход луны. Ждём по доске, а не по часам: без видеокарты кадры редкие
  await student.keyboard.press('Space');
  await gf.waitForFunction(() => window.__lab.lab.state.pos.b.filter(Boolean).length >= 1, null, { timeout: 10000, polling: 100 }).catch(() => {});
  await student.keyboard.press('Space'); await sleep(700);
  const placed = await gf.evaluate(() => window.__lab.lab.state.pos.b.filter(Boolean).length);
  check('Дуэль: оба игрока ходят одними кнопками', placed >= 1, `камней на доске: ${placed}`);
  await gf.evaluate(() => window.__lab.end('win', 'Проверка'));
  await student.waitForSelector('#step-duel.done', { timeout: 10000 });
  await shot(student, '24-u2-duel');
}

/* ---------- урок 3: донор Pac-Man, предсказание динамики, спрятанная механика донора, квиз по следу, MDA, Фабрика MDA, сборка, дуэль ---------- */
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

  // донор: «Ночной лабиринт» со спрятанной механикой, счётчики динамики копятся в шаге
  await student.click('#step-donor-play .veil button');
  let gf = await gameFrame(student, 'nochnoy-labirint', 0);
  check('Донор урока 3: «Ночной лабиринт» со спрятанной механикой', await gf.evaluate(() => window.__lab.cfg.secret === 1 && GAME.donor === 'Pac-Man'));
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
  await student.click('.cp >> text=Механика → динамика');
  const pred = step3('secret-predict'), tail = pred.options.find(o => o.counter === 'хвост');
  await student.click(`#step-secret-predict .opt >> text=${tail.text}`);
  await student.click('#step-secret-predict >> text=🔮 Записать предсказание');
  await student.waitForSelector('#step-secret-predict >> text=Теперь сыграй');
  await student.click('#step-secret-play .veil button');
  gf = await gameFrame(student, 'nochnoy-labirint', 0);
  await gf.waitForFunction(() => window.__lab.cfg.secret === 0, null, { timeout: 5000 }).catch(() => {});
  check('Партия «одно правило»: спрятанная механика выключена из шага', await gf.evaluate(() => window.__lab.cfg.secret === 0));
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

  // «Найди спрятанную механику» донора: ответ только после догадки, сравнение четырёх характеров и одного правила
  const hunt = step3('secret-hunt').hunt;
  const me = await student.evaluate(async () => JSON.stringify(await (await fetch('/api/me', { headers: { 'x-lab-token': Lab.token.get() } })).json()));
  check('Ответ «Найди спрятанную механику» урока 3 не уходит ученику заранее', me.includes(hunt.question) && !me.includes(hunt.reveal.slice(0, 30)));
  await student.waitForSelector('#step-secret-hunt .opt');
  await student.click(`#step-secret-hunt .opt >> text=${mode === 'mock' ? hunt.trap : hunt.right}`);
  await student.click('#step-secret-hunt >> text=Ответить');
  await student.waitForSelector('#step-secret-hunt.done');
  const reveal = (await student.textContent('#step-secret-hunt')).replace(/\s+/g, ' ');
  check(mode === 'mock' ? 'Спрятанная механика урока 3: ловушка «волки быстрее» распознана' : 'Спрятанная механика урока 3 угадана: четыре характера',
    (mode === 'mock' ? /Ловушка! Скорость волков/.test(reveal) : /Точно!/.test(reveal)) && /Четыре характера и передышка/.test(reveal), reveal.slice(0, 120));
  // к счётчикам из проверки добавляется то, что волки успели сами за партию, поэтому — «не меньше»
  const num = re => Number((re.exec(reveal) || [])[1] || -1), offPart = reveal.slice(reveal.indexOf('Одно правило'));
  check('Сравнение: окружения и хвост со спрятанной механикой и без, спрятанная механика сработала', num(/Четыре характера.*?окружения (\d+)/) >= 5 && Number((/хвост (\d+)/.exec(offPart) || [])[1] || -1) >= 6 && num(/спрятанная механика сработала (\d+) раз/) >= 40, reveal.slice(reveal.indexOf('Четыре характера'), reveal.indexOf('Четыре характера') + 160));
  await storyDone(student);

  // мастерская вариаций урока 3: плитка — партия — «какое удовольствие» — «какую механику повернули»; на доске — динамика из телеметрии
  const vst = step3('variacii');
  await student.waitForSelector('#step-variacii [data-var]');
  check('Урок 3: мастерская вариаций — ядро и плитки всех вариаций', /беги по лабиринту → собери всё/.test(await student.textContent('#step-variacii')) && await student.locator('#step-variacii [data-var]').count() === vst.variants.length);
  const tryV3 = [['pryzhok', c => c.jump === 1, 'прыжки над волком'], ['tma', c => c.dark === 1, 'из темноты'], ['moroz', c => c.freeze === 1, 'мимо замёрзших'], ['navremya', c => c.timeAttack === 120, 'ночи']];
  for (const [k, [id, ok, counter]] of tryV3.entries()) {
    const x = vst.variants.find(y => y.id === id);
    await student.click(`#step-variacii [data-var=${id}]`);
    await student.click('#step-variacii .veil button');
    gf = await gameFrame(student, 'nochnoy-labirint', 0);
    await gf.waitForFunction(() => window.__lab.ready, null, { timeout: 15000 }).catch(() => {});
    check(`Урок 3: вариация «${x.label}» включила свои ручки`, ok(await gf.evaluate(() => window.__lab.cfg)));
    await gf.evaluate(() => window.__lab.confirm());
    await sleep(300);
    await gf.evaluate(c => { const L = window.__lab.lab; L.count(c, 3); L.count('окружения', 1); L.score = 300; window.__lab.end('lose', 'Проверка'); }, counter);
    await student.waitForSelector('#step-variacii [data-feel]', { timeout: 10000 });
    await student.click(`#step-variacii [data-feel] >> nth=${k}`);
    await student.click(`#step-variacii [data-dial=${k === 2 ? vst.dials.find(d => d.id !== x.dial).id : x.dial}]`);
    await student.waitForSelector('#step-variacii .verdict');
    if (k === 2) check('Урок 3: ошибка в механике — разбор, что повернули', /Не совсем/.test(await student.textContent('#step-variacii .verdict')));
    await student.click('#step-variacii [data-next]');
  }
  await student.waitForSelector('#step-variacii .var-board');
  const board3 = await student.textContent('#step-variacii .var-board');
  check('Урок 3: доска вариаций — механика, динамика из телеметрии, удовольствие', await student.locator('#step-variacii .var-row:not(.var-head)').count() === 4 && /перепрыгнул ×3/.test(board3) && /проскочил мимо ×3/.test(board3), board3.slice(0, 160));
  await shot(student, '31b-u3-variacii', true);
  await student.click('#step-variacii [data-fav=tma]');
  await student.waitForSelector('#step-variacii.done', { timeout: 10000 });

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
    await nextItem(student, '#step-mda', text);
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
    check('Программисту ушли находки продюсера', /Продюсер заметил:\n- нет крючка/.test(mock.last.newUser || ''));
    check('Задание Qwen урока 3 — три части с донором урока', clearTask(mock.last.newUser, 'Pac-Man'));
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

/* ---------- урок 4: «Каменный стакан», спрятанная механика «мешок и предпросмотр», квиз «Собери цикл», Фабрика, образец урока для ИИ, релиз модуля, дуэль ---------- */
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

  // тот же стакан без спрятанной механики: ручки из шага выключают мешок и предпросмотр
  await student.click('.cp >> text=Один глагол');
  await student.click('#step-secret-play .veil button');
  gf = await gameFrame(student, 'kamennyi-stakan', 0);
  await gf.waitForFunction(() => window.__lab.cfg.bag === 0 && window.__lab.cfg.preview === 0, null, { timeout: 5000 }).catch(() => {});
  check('Без спрятанной механики: мешок и предпросмотр выключены ручками шага', await gf.evaluate(() => window.__lab.cfg.bag === 0 && window.__lab.cfg.preview === 0));
  await gf.evaluate(() => window.__lab.confirm());
  await sleep(300);
  await gf.evaluate(() => { window.__lab.lab.count('засухи', 2); window.__lab.lab.count('линии', 1); window.__lab.lab.score = 90; window.__lab.end('lose', 'Проверка'); });
  await student.waitForSelector('#step-secret-play.done', { timeout: 10000 });

  const hunt = step4('secret-hunt').hunt;
  const me = await student.evaluate(async () => JSON.stringify(await (await fetch('/api/me', { headers: { 'x-lab-token': Lab.token.get() } })).json()));
  check('Урок 4: ответ «Найди спрятанную механику» не уходит ученику заранее', me.includes(hunt.question) && !me.includes(hunt.reveal.slice(0, 30)));
  await student.waitForSelector('#step-secret-hunt .opt');
  await student.click(`#step-secret-hunt .opt >> text=${mode === 'mock' ? hunt.trap : hunt.right}`);
  await student.click('#step-secret-hunt >> text=Ответить');
  await student.waitForSelector('#step-secret-hunt.done');
  const reveal = (await student.textContent('#step-secret-hunt')).replace(/\s+/g, ' ');
  check(mode === 'mock' ? 'Спрятанная механика урока 4: ловушка «падали медленнее» распознана' : 'Спрятанная механика урока 4 угадана: мешок и предпросмотр',
    (mode === 'mock' ? /Ловушка! Скорость не менялась/.test(reveal) : /Точно!/.test(reveal)) && /Предпросмотр и «мешок»/.test(reveal), reveal.slice(0, 120));
  check('Сравнение: линии и засухи с мешком и без, мешок сработал', /линии 3/.test(reveal) && /засухи 2/.test(reveal) && /спрятанная механика сработала [1-9]\d* раз/.test(reveal), (reveal.match(/С мешком.*?вслепую[^О]*/) || [''])[0].slice(0, 200));
  await shot(student, '30-u4-secret', true);
  await storyDone(student);

  // мастерская вариаций «Тетриса»: плитка — партия с ручками вариации — «какая это игра» — «что повернули»; полоса доски — длина цикла
  const vstep = step4('variacii');
  await student.waitForSelector('#step-variacii [data-var]');
  check('Урок 4: мастерская вариаций — глагол и плитки всех вариаций', /повернуть и поставить/.test(await student.textContent('#step-variacii')) && await student.locator('#step-variacii [data-var]').count() === vstep.variants.length);
  const tryVars4 = [['sprint', 'sprint', 20], ['cvet', 'colors', 1], ['bomby', 'bombs', 4], ['g20', 'g20', 1]];
  for (const [k, [id, knob, val]] of tryVars4.entries()) {
    const x = vstep.variants.find(y => y.id === id);
    await student.click(`#step-variacii [data-var=${id}]`);
    await student.click('#step-variacii .veil button');
    gf = await gameFrame(student, 'kamennyi-stakan', 0);
    await gf.waitForFunction(([kn, vl]) => window.__lab.cfg[kn] === vl, [knob, val], { timeout: 5000 }).catch(() => {});
    check(`Вариация урока 4 «${x.label}» включила свои ручки`, await gf.evaluate(([kn, vl]) => window.__lab.cfg[kn] === vl && window.__lab.cfg.vs === 0, [knob, val]));
    await gf.evaluate(() => window.__lab.confirm());
    await sleep(300);
    await gf.evaluate(() => { const L = window.__lab.lab; L.stat('камень за, с', 2.4); L.score = 400; window.__lab.end('win', 'Проверка'); });
    await student.waitForSelector('#step-variacii [data-feel]', { timeout: 10000 });
    await student.click(`#step-variacii [data-feel] >> nth=${k}`);
    const dial = k === 1 ? vstep.dials.find(d => d.id !== x.dial).id : x.dial;
    await student.click(`#step-variacii [data-dial=${dial}]`);
    await student.waitForSelector('#step-variacii .verdict');
    if (k === 1) check('Вариации урока 4: ошибка в детали — разбор', /Не совсем/.test(await student.textContent('#step-variacii .verdict')) && (await student.textContent('#step-variacii .verdict')).includes(x.why));
    await student.click('#step-variacii [data-next]');
  }
  await student.waitForSelector('#step-variacii .var-board');
  check('Доска вариаций урока 4: четыре игры и длина цикла', await student.locator('#step-variacii .var-row').count() === 4 && /камень за 2,4 с/.test(await student.textContent('#step-variacii .var-board')));
  await shot(student, '30b-u4-variacii', true);
  await student.click('#step-variacii [data-fav=cvet]');
  await student.waitForSelector('#step-variacii.done', { timeout: 10000 });
  await student.click('#step-variacii [data-mix="Лавина"]');
  check('Конструктор вариации урока 4: своя вариация из плиток', /Твоя вариация: Лавина/.test(await student.textContent('#step-variacii .pickline')));

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
    check('Задание Qwen урока 4 — три части с донором урока', clearTask(mock.last.newUser, 'Тетрис'));
    await own.evaluate(() => window.__lab.confirm());
    await student.waitForFunction(() => document.querySelectorAll('#step-sborka .ver').length >= 2, null, { timeout: 30000 });
    own = await gameFrame(student, '/play/', 0);
  } else check('Демо-режим урока 4: вместо игры ученика — «Каменный стакан» с его названием', await own.evaluate(() => GAME.title === 'Сырная башня' && !!GAME.KINDS && GAME.donor === '«Тетрис»'));
  await playRound(own);
  await student.waitForSelector('#step-sborka.done', { timeout: 10000 });
  const card = await student.evaluate(async () => (await (await fetch('/api/arcade', { headers: { 'x-lab-token': Lab.token.get() } })).json()).mine.find(c => c.lesson && c.lesson.id === 'urok-04'));
  check('Игра урока 4 собрана, в аркаде донор «Тетрис»', card && card.title === 'Сырная башня' && card.donor === '«Тетрис»', card ? `${card.title} · ${card.donor}` : 'нет карточки');

  // релиз модуля: выбор игры модуля, чек-лист с подсказками из аркады, метка 1.0 — одна на модуль
  await student.click('.cp >> text=Мастерская');
  await student.waitForSelector('#step-reliz .seg .opt');
  const games = await student.$$eval('#step-reliz .seg .opt', bs => bs.map(b => b.dataset.game));
  const built1 = [1, 2, 3, 4].filter(n => n === 1 || want(n)).length; // с --only собраны не все игры модуля
  check('Релиз: на выбор все игры модуля 1 (уроки 1–4)', games.length === built1 && /из 4/.test(await student.textContent('#step-reliz')), `игр: ${games.length}`);
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
  // ждём по состоянию игры, а не по часам: без видеокарты кадр бывает дольше секунды
  const laid = i => gf.waitForFunction(i => window.__lab.lab.state.wells[i].grid.flat().filter(Boolean).length >= 4, i, { timeout: 15000 }).catch(() => {});
  await student.keyboard.press('KeyG'); await laid(0); // игрок 1 роняет камень
  await student.keyboard.press('KeyL'); await laid(1); // игрок 2 роняет камень
  const dropped = await gf.evaluate(() => window.__lab.lab.state.wells.map(w => w.grid.flat().filter(Boolean).length));
  check('Дуэль: каждый игрок роняет камень своей клавишей', dropped[0] === 4 && dropped[1] === 4, `камней в стаканах: ${dropped.join(' и ')}`);
  await gf.evaluate(() => window.__lab.end('win', 'Проверка'));
  await student.waitForSelector('#step-duel.done', { timeout: 10000 });
  await student.click('#step-duel .seg .opt >> nth=1');
  await student.click('#step-duel .veil button');
  gf = await gameFrame(student, 'kamennyi-stakan', 0);
  await gf.waitForFunction(() => window.__lab.cfg.bag === 0 && window.__lab.cfg.vs === 1, null, { timeout: 5000 }).catch(() => {});
  check('Дуэль без спрятанной механики: вариант кнопкой', await gf.evaluate(() => window.__lab.cfg.bag === 0 && window.__lab.cfg.preview === 0 && window.__lab.cfg.vs === 1));
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
    check(`Задание Qwen урока ${les.number} — три части с донором урока`, clearTask(mock.last.newUser, les.donor.replace(/[«»]/g, '').split(/[ ,]/)[0]));
    await own.evaluate(() => window.__lab.confirm());
    await student.waitForFunction(() => document.querySelectorAll('#step-sborka .ver').length >= 2, null, { timeout: 30000 });
    own = await gameFrame(student, '/play/', 0);
  }
  return { own, twist, r, i };
}
async function lessonFive(mode, teacher, student, shot) {
  await openLesson(teacher, student, 2, 'urok-05', 'Урок 5');
  check('Урок 5 открылся у ученика: модуль 2', /Урок 5 · Прыжок, который хочется повторять/.test(await student.textContent('#lessonTitle')));

  // донор: «Тур над Хаджохом» как задумано — прыжок со спрятанной механикой
  await student.click('#step-donor-play .veil button');
  let gf = await gameFrame(student, 'tur-nad-hadzhohom', 0);
  check('Донор урока 5: обби с камерой сбоку и прыжком со спрятанной механикой', await gf.evaluate(() => window.__lab.cfg.secret === 1 && window.__lab.cfg.coyote > 0 && GAME.LEVEL.length > 10));
  await gf.evaluate(() => window.__lab.confirm());
  await gf.locator('#cv').focus();
  const t0 = await gf.evaluate(() => window.__lab.lab.t), byClock = dt => gf.waitForFunction(t => window.__lab.lab.t > t, t0 + dt, { timeout: 30000 }); // по часам игры: без видеокарты секунда игры длиннее настоящей
  await student.keyboard.down('ArrowRight'); await byClock(0.5); await student.keyboard.press('Space'); await byClock(1); await student.keyboard.up('ArrowRight');
  const run = await gf.evaluate(() => { const st = window.__lab.lab.state; return { x: st.hero.x, jumps: st.jumps }; });
  check('Тур бежит и прыгает с клавиатуры', run.x > 1.8 && run.jumps >= 1, `x ${run.x.toFixed(1)}, прыжков ${run.jumps}`);
  await gf.evaluate(() => { window.__lab.lab.score = 900; window.__lab.end('lose', 'Проверка'); });
  await student.waitForSelector('#step-donor-play.done', { timeout: 10000 });
  await student.click('#step-donor-hook .opt >> nth=0');
  await student.click('#step-donor-hook >> text=Ответить');
  await student.waitForSelector('#step-donor-hook.done');

  // сырой прыжок: ручка secret из шага, нажатие чуть позже края «проглочено»
  await student.click('.cp >> text=Один прыжок');
  await student.click('#step-secret-play .veil button');
  gf = await gameFrame(student, 'tur-nad-hadzhohom', 0);
  await gf.waitForFunction(() => window.__lab.cfg.secret === 0, null, { timeout: 5000 }).catch(() => {});
  check('Сырой прыжок: спрятанная механика выключена ручкой шага', await gf.evaluate(() => window.__lab.cfg.secret === 0));
  await gf.evaluate(() => window.__lab.confirm());
  await sleep(300);
  // тур за краем первой скалы: прыжок через 0,05 с после края без койота не случается
  const edge = await gf.evaluate(async () => {
    const L = window.__lab.lab, h = L.state.hero; Object.assign(h, { x: 14.5, y: -0.05, vx: 6, vy: -1, ground: null, off: 0.05, jumped: false });
    const before = L.state.jumps; L.p1.pressed.a = true; GAME.control(L, h, L.p1, 0.016); L.p1.pressed.a = false;
    return { jumped: L.state.jumps - before, lost: L.state.lost };
  });
  check('Без спрятанной механики нажатие чуть позже края проглочено', edge.jumped === 0 && edge.lost === 1, JSON.stringify(edge));
  await gf.evaluate(() => { window.__lab.lab.count('потерянные нажатия', 2); window.__lab.lab.score = 300; window.__lab.end('lose', 'Проверка'); });
  await student.waitForSelector('#step-secret-play.done', { timeout: 10000 });

  const hunt = step5('secret-hunt').hunt;
  await student.waitForSelector('#step-secret-hunt .opt');
  await student.click(`#step-secret-hunt .opt >> text=${mode === 'mock' ? hunt.trap : hunt.right}`);
  await student.click('#step-secret-hunt >> text=Ответить');
  await student.waitForSelector('#step-secret-hunt.done');
  const reveal = (await student.textContent('#step-secret-hunt')).replace(/\s+/g, ' ');
  check(mode === 'mock' ? 'Спрятанная механика урока 5: ловушка «прыгал выше» распознана' : 'Спрятанная механика урока 5 угадана: отзывчивость',
    (mode === 'mock' ? /Ловушка! Высота не менялась/.test(reveal) : /Точно!/.test(reveal)) && /Отзывчивость/.test(reveal), reveal.slice(0, 120));
  check('Сравнение: потерянные нажатия со спрятанной механикой и без', /Сырой прыжок/.test(reveal) && /потерянные нажатия 3/.test(reveal), (reveal.match(/Прыжок со спрятанной механикой.*?Сырой прыжок[^О]*/) || [''])[0].slice(0, 200));
  await storyDone(student);

  // мастерская вариаций платформера: плитка — партия с ручками вариации — «какая это игра» — «что повернули»; полоса доски — спасённые нажатия
  const vstep5 = step5('variacii');
  await student.waitForSelector('#step-variacii [data-var]');
  check('Урок 5: мастерская вариаций — прыжок и плитки всех вариаций', /разбег → прыжок/.test(await student.textContent('#step-variacii')) && await student.locator('#step-variacii [data-var]').count() === vstep5.variants.length);
  const tryVars5 = [['dvoynoy', 'double', 1], ['ryvok', 'dash', 1], ['kamnepad', 'rockfall', 5], ['lyod', 'ice', 0.6]];
  for (const [k, [id, knob, val]] of tryVars5.entries()) {
    const x = vstep5.variants.find(y => y.id === id);
    await student.click(`#step-variacii [data-var=${id}]`);
    await student.click('#step-variacii .veil button');
    gf = await gameFrame(student, 'tur-nad-hadzhohom', 0);
    await gf.waitForFunction(([kn, vl]) => window.__lab.cfg[kn] === vl, [knob, val], { timeout: 5000 }).catch(() => {});
    check(`Вариация урока 5 «${x.label}» включила свои ручки`, await gf.evaluate(([kn, vl]) => window.__lab.cfg[kn] === vl && window.__lab.cfg.limit === 100, [knob, val]));
    await gf.evaluate(() => window.__lab.confirm());
    await sleep(300);
    await gf.evaluate(() => { const L = window.__lab.lab; L.stat('помощь', 5); L.score = 400; window.__lab.end('win', 'Проверка'); });
    await student.waitForSelector('#step-variacii [data-feel]', { timeout: 10000 });
    await student.click(`#step-variacii [data-feel] >> nth=${k}`);
    const dial = k === 1 ? vstep5.dials.find(d => d.id !== x.dial).id : x.dial;
    await student.click(`#step-variacii [data-dial=${dial}]`);
    await student.waitForSelector('#step-variacii .verdict');
    if (k === 1) check('Вариации урока 5: ошибка в детали — разбор', /Не совсем/.test(await student.textContent('#step-variacii .verdict')) && (await student.textContent('#step-variacii .verdict')).includes(x.why));
    await student.click('#step-variacii [data-next]');
  }
  await student.waitForSelector('#step-variacii .var-board');
  check('Доска вариаций урока 5: четыре игры и спасённые нажатия', await student.locator('#step-variacii .var-row').count() === 4 && /спасено нажатий: 5/.test(await student.textContent('#step-variacii .var-board')));
  await shot(student, '38b-u5-variacii', true);
  await student.click('#step-variacii [data-fav=ryvok]');
  await student.waitForSelector('#step-variacii.done', { timeout: 10000 });
  await student.click('#step-variacii [data-mix="Двойной"]');
  check('Конструктор вариации урока 5: своя вариация из плиток', /Твоя вариация: Двойной/.test(await student.textContent('#step-variacii .pickline')));

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
  check('Слепой турнир: ответ закрыт, пока не поиграл', await student.locator('#step-slepoy-turnir .opts .opt.dim').count() === blind.choices); // до запуска загадки: потом закрыт всего секунду
  await student.click('#step-slepoy-turnir .veil button');
  gf = await gameFrame(student, 'tur-nad-hadzhohom', 0);
  await gf.waitForFunction(() => window.__lab.cfg.coyote === 0, null, { timeout: 5000 }).catch(() => {});
  check('Слепой турнир: в загадке повёрнута одна ручка', await gf.evaluate(() => window.__lab.cfg.coyote === 0 && window.__lab.cfg.buffer === 0.12));
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
    [...document.querySelectorAll('#presets button')].find(b => b.textContent === 'Без спрятанной механики').click();
    const off = Object.keys(window.__lab.cfg).filter(k => k.startsWith('j_') && window.__lab.cfg[k] === 0).length, shake = window.__lab.cfg.shake;
    [...document.querySelectorAll('#presets button')].find(b => b.textContent === 'Как задумано').click();
    window.__lab.togglePanel(false);
    return { off, shake, back: Object.keys(window.__lab.cfg).filter(k => k.startsWith('j_') && window.__lab.cfg[k] === 1).length };
  });
  check('Пресет «Без спрятанной механики» выключает все 12, «Как задумано» включает обратно', dry.off === 12 && dry.shake === 1 && dry.back === 12, JSON.stringify(dry));
  await gf.evaluate(() => window.__lab.confirm());
  await sleep(300);
  await gf.evaluate(() => { window.__lab.lab.count('удары', 12); window.__lab.lab.count('кирпичи', 8); window.__lab.lab.score = 700; window.__lab.end('lose', 'Проверка'); });
  await student.waitForSelector('#step-donor-play.done', { timeout: 10000 });
  await student.click('#step-donor-hook .opt >> nth=0');
  await student.click('#step-donor-hook >> text=Ответить');
  await student.waitForSelector('#step-donor-hook.done');

  // сухой «Ледолом»: переключатели из шага, оболочка глушит эффекты в самих lab.shake, lab.burst, lab.tone
  await student.click('.cp >> text=Один отскок');
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
  check(mode === 'mock' ? 'Спрятанная механика урока 6: ловушка «хычин летал быстрее» распознана' : 'Спрятанная механика урока 6 угадана: сочность',
    (mode === 'mock' ? /Ловушка! Скорость не менялась/.test(reveal) : /Точно!/.test(reveal)) && /Сочность: игра отзывается/.test(reveal) && /удары 12/.test(reveal) && /удары 9/.test(reveal), reveal.slice(0, 120));
  await storyDone(student);

  // мастерская вариаций арканоида: плитка — партия с ручками вариации — «какая это игра» — «что повернули»; полоса доски — лучшая серия
  const vstep6 = step6('variacii');
  await student.waitForSelector('#step-variacii [data-var]');
  check('Урок 6: мастерская вариаций — отскок и плитки всех вариаций', /лопата → отскок/.test(await student.textContent('#step-variacii')) && await student.locator('#step-variacii [data-var]').count() === vstep6.variants.length);
  const tryVars6 = [['lazer', 'laser', 1], ['nevidimki', 'hidden', 1], ['tyazhest', 'gravity', 5], ['multibol', 'multi', 3]];
  for (const [k, [id, knob, val]] of tryVars6.entries()) {
    const x = vstep6.variants.find(y => y.id === id);
    await student.click(`#step-variacii [data-var=${id}]`);
    await student.click('#step-variacii .veil button');
    gf = await gameFrame(student, 'ledolom', 0);
    await gf.waitForFunction(([kn, vl]) => window.__lab.cfg[kn] === vl, [knob, val], { timeout: 5000 }).catch(() => {});
    check(`Вариация урока 6 «${x.label}» включила свои ручки`, await gf.evaluate(([kn, vl]) => window.__lab.cfg[kn] === vl && window.__lab.cfg.limit === 90, [knob, val]));
    await gf.evaluate(() => window.__lab.confirm());
    await sleep(300);
    await gf.evaluate(() => { const L = window.__lab.lab; L.stat('серия', 7); L.score = 400; window.__lab.end('lose', 'Проверка'); });
    await student.waitForSelector('#step-variacii [data-feel]', { timeout: 10000 });
    await student.click(`#step-variacii [data-feel] >> nth=${k}`);
    const dial = k === 1 ? vstep6.dials.find(d => d.id !== x.dial).id : x.dial;
    await student.click(`#step-variacii [data-dial=${dial}]`);
    await student.waitForSelector('#step-variacii .verdict');
    if (k === 1) check('Вариации урока 6: ошибка в детали — разбор', /Не совсем/.test(await student.textContent('#step-variacii .verdict')) && (await student.textContent('#step-variacii .verdict')).includes(x.why));
    await student.click('#step-variacii [data-next]');
  }
  await student.waitForSelector('#step-variacii .var-board');
  check('Доска вариаций урока 6: четыре игры и лучшая серия', await student.locator('#step-variacii .var-row').count() === 4 && /лучшая серия ×7/.test(await student.textContent('#step-variacii .var-board')));
  await shot(student, '49b-u6-variacii', true);
  await student.click('#step-variacii [data-fav=lazer]');
  await student.waitForSelector('#step-variacii.done', { timeout: 10000 });
  await student.click('#step-variacii [data-mix="Магнит"]');
  check('Конструктор вариации урока 6: своя вариация из плиток', /Твоя вариация: Магнит/.test(await student.textContent('#step-variacii .pickline')));

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

  // без спрятанной механики: музыка на своих часах, кувшины сдвинуты, щелчка нет
  await student.click('.cp >> text=Один такт');
  await student.click('#step-secret-play .veil button');
  gf = await gameFrame(student, 'shag-v-takt', 0);
  await gf.waitForFunction(() => window.__lab.cfg.secret === 0, null, { timeout: 5000 }).catch(() => {});
  await sleep(300);
  const off = await gf.evaluate(() => { const st = window.__lab.lab.state; return { secret: window.__lab.cfg.secret, cues: st.evts.filter(e => e.kind === 'cue').length, obs: st.obs.length }; });
  check('Без спрятанной механики: щелчков нет, кувшины те же', off.secret === 0 && off.cues === 0 && off.obs === on.obs, JSON.stringify(off));
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
  check(mode === 'mock' ? 'Спрятанная механика урока 7: ловушка «танцор бежал медленнее» распознана' : 'Спрятанная механика урока 7 угадана: одни часы',
    (mode === 'mock' ? /Ловушка! Темп не менялся/.test(reveal) : /Точно!/.test(reveal)) && /Одни часы: звук предупреждает/.test(reveal) && /идеально 9/.test(reveal) && /мимо 6/.test(reveal), reveal.slice(0, 120));
  await storyDone(student);

  // мастерская вариаций ритм-игры: плитка — партия с ручками вариации — «какая это игра» — «что повернули»; полоса доски — точность
  const vstep7 = step7('variacii');
  await student.waitForSelector('#step-variacii [data-var]');
  check('Урок 7: мастерская вариаций — такт и плитки всех вариаций', /щелчок → доля/.test(await student.textContent('#step-variacii')) && await student.locator('#step-variacii [data-var]').count() === vstep7.variants.length);
  const tryVars7 = [['prignis', 'duck', 1], ['ischezayut', 'fade', 1.5], ['derzhi', 'hold', 1], ['dvoynoy', 'bpm', 168]];
  for (const [k, [id, knob, val]] of tryVars7.entries()) {
    const x = vstep7.variants.find(y => y.id === id);
    await student.click(`#step-variacii [data-var=${id}]`);
    await student.click('#step-variacii .veil button');
    gf = await gameFrame(student, 'shag-v-takt', 0);
    await gf.waitForFunction(([kn, vl]) => window.__lab.cfg[kn] === vl, [knob, val], { timeout: 5000 }).catch(() => {});
    check(`Вариация урока 7 «${x.label}» включила свои ручки`, await gf.evaluate(([kn, vl]) => window.__lab.cfg[kn] === vl && window.__lab.cfg.laps === 2, [knob, val]));
    if (id === 'prignis') check('Вариация «Пригнись»: высокие ноты стали гирляндами', await gf.evaluate(() => window.__lab.lab.state.obs.filter(o => o.duck).length > 0 && !!window.__lab.lab.state.garland));
    await gf.evaluate(() => window.__lab.confirm());
    await sleep(300);
    await gf.evaluate(() => { const L = window.__lab.lab; L.stat('точность', 84); L.score = 900; window.__lab.end('win', 'Проверка'); });
    await student.waitForSelector('#step-variacii [data-feel]', { timeout: 10000 });
    await student.click(`#step-variacii [data-feel] >> nth=${k}`);
    const dial = k === 1 ? vstep7.dials.find(d => d.id !== x.dial).id : x.dial;
    await student.click(`#step-variacii [data-dial=${dial}]`);
    await student.waitForSelector('#step-variacii .verdict');
    if (k === 1) check('Вариации урока 7: ошибка в детали — разбор', /Не совсем/.test(await student.textContent('#step-variacii .verdict')) && (await student.textContent('#step-variacii .verdict')).includes(x.why));
    await student.click('#step-variacii [data-next]');
  }
  await student.waitForSelector('#step-variacii .var-board');
  check('Доска вариаций урока 7: четыре игры и точность', await student.locator('#step-variacii .var-row').count() === 4 && /точность 84%/.test(await student.textContent('#step-variacii .var-board')));
  await shot(student, '51b-u7-variacii', true);
  await student.click('#step-variacii [data-fav=prignis]');
  await student.waitForSelector('#step-variacii.done', { timeout: 10000 });
  await student.click('#step-variacii [data-mix="Синкопы"]');
  check('Конструктор вариации урока 7: своя вариация из плиток', /Твоя вариация: Синкопы/.test(await student.textContent('#step-variacii .pickline')));

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

  // без спрятанной механики: тот же промах отрезается
  await student.click('.cp >> text=Одна кнопка — много');
  await student.click('#step-secret-play .veil button');
  gf = await gameFrame(student, 'bashnya-do-neba', 0);
  await gf.waitForFunction(() => window.__lab.cfg.secret === 0, null, { timeout: 5000 }).catch(() => {});
  await gf.evaluate(() => window.__lab.confirm());
  await sleep(300);
  const off = await placeSlab(gf, 0.06);
  check('Без спрятанной механики: промах 6 см отрезан, плита уже', off.perfect === 0 && Math.abs(off.w - (size - 0.06)) < 1e-6, JSON.stringify(off));
  await gf.evaluate(() => { const L = window.__lab.lab; L.count('плиты', 4); L.score = 40; window.__lab.end('lose', 'Проверка'); });
  await student.waitForSelector('#step-secret-play.done', { timeout: 10000 });
  const hunt = step8('secret-hunt').hunt;
  await student.waitForSelector('#step-secret-hunt .opt');
  await student.click(`#step-secret-hunt .opt >> text=${mode === 'mock' ? hunt.trap : hunt.right}`);
  await student.click('#step-secret-hunt >> text=Ответить');
  await student.waitForSelector('#step-secret-hunt.done');
  const reveal = (await student.textContent('#step-secret-hunt')).replace(/\s+/g, ' ');
  check(mode === 'mock' ? 'Спрятанная механика урока 8: ловушка «плиты ехали медленнее» распознана' : 'Спрятанная механика урока 8 угадана: окно «идеально»',
    (mode === 'mock' ? /Ловушка! Скорость не менялась/.test(reveal) : /Точно!/.test(reveal)) && /Окно «идеально»: игра прощает/.test(reveal) && /плиты 12/.test(reveal) && /плиты 5/.test(reveal), reveal.slice(0, 120));
  await storyDone(student);

  // мастерская вариаций игры на одну кнопку: плитка — партия с ручками вариации — «какая это игра» — «что повернули»; полоса — спасённые плиты
  const vstep8 = step8('variacii');
  await student.waitForSelector('#step-variacii [data-var]');
  check('Урок 8: мастерская вариаций — кнопка и плитки всех вариаций', /плита едет → нажатие/.test(await student.textContent('#step-variacii')) && await student.locator('#step-variacii [data-var]').count() === vstep8.variants.length);
  const tryVars8 = [['mayatnik', 'swing', 1], ['ritm', 'rhythm', 100], ['inerciya', 'slip', 0.16], ['blic', 'blitz', 30]];
  for (const [k, [id, knob, val]] of tryVars8.entries()) {
    const x = vstep8.variants.find(y => y.id === id);
    await student.click(`#step-variacii [data-var=${id}]`);
    await student.click('#step-variacii .veil button');
    gf = await gameFrame(student, 'bashnya-do-neba', 0);
    await gf.waitForFunction(([kn, vl]) => window.__lab.cfg[kn] === vl, [knob, val], { timeout: 5000 }).catch(() => {});
    check(`Вариация урока 8 «${x.label}» включила свои ручки`, await gf.evaluate(([kn, vl]) => window.__lab.cfg[kn] === vl && window.__lab.cfg.limit === 60, [knob, val]));
    await gf.evaluate(() => window.__lab.confirm());
    await sleep(300);
    await gf.evaluate(() => { const L = window.__lab.lab; L.stat('спасено', 6); L.score = 120; window.__lab.end('lose', 'Проверка'); });
    await student.waitForSelector('#step-variacii [data-feel]', { timeout: 10000 });
    await student.click(`#step-variacii [data-feel] >> nth=${k}`);
    const dial = k === 1 ? vstep8.dials.find(d => d.id !== x.dial).id : x.dial;
    await student.click(`#step-variacii [data-dial=${dial}]`);
    await student.waitForSelector('#step-variacii .verdict');
    if (k === 1) check('Вариации урока 8: ошибка в детали — разбор', /Не совсем/.test(await student.textContent('#step-variacii .verdict')) && (await student.textContent('#step-variacii .verdict')).includes(x.why));
    await student.click('#step-variacii [data-next]');
  }
  await student.waitForSelector('#step-variacii .var-board');
  check('Доска вариаций урока 8: четыре игры и спасённые плиты', await student.locator('#step-variacii .var-row').count() === 4 && /окно спасло плит: 6/.test(await student.textContent('#step-variacii .var-board')));
  await shot(student, '53b-u8-variacii', true);
  await student.click('#step-variacii [data-fav=ritm]');
  await student.waitForSelector('#step-variacii.done', { timeout: 10000 });
  await student.click('#step-variacii [data-mix="Маятник"]');
  check('Конструктор вариации урока 8: своя вариация из плиток', /Твоя вариация: Маятник/.test(await student.textContent('#step-variacii .pickline')));

  // квиз модуля «Какой это приём?»: отзывчивость, сочность, обратная связь
  const quiz = step8('priemy'), binOf = t => quiz.items.find(i => i.text === t).bin;
  await student.click('#step-priemy >> text=▶ Начать');
  for (let i = 0; i < (mode === 'mock' ? quiz.items.length : 3); i++) {
    const text = (await student.textContent('#step-priemy .item')).trim();
    await student.keyboard.press('Digit' + (quiz.bins.findIndex(b => b.id === binOf(text)) + 1));
    await nextItem(student, '#step-priemy', text);
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
  await experimentRound(student, shot);
  await student.waitForSelector('#step-reliz .seg .opt');
  const built = [5, 6, 7, 8].filter(want).length;
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
  if (mode === 'demo') { const wait = await student.waitForSelector('#step-vystavka >> text=Ждём игры класса', { timeout: 10000 }).then(() => true, () => false); check('Выставка без игр класса ждёт игры джема', wait, wait ? '' : (await student.textContent('#step-vystavka')).slice(0, 160)); return; }
  const nctx = await browser.newContext({ viewport: { width: 1280, height: 900 } });
  await nctx.addInitScript(() => { window.LAB_ASK_AUTO = true; window.LAB_FAST = true; window.LAB_LOWRES = true; });
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
  await nctx.addInitScript(() => { window.LAB_ASK_AUTO = true; window.LAB_FAST = true; window.LAB_LOWRES = true; });
  const nb = await nctx.newPage();
  watch(nb, errors);
  // вторая ученица собирает свою игру: Фабрика и решения кубиками, ИГРА, сборка без продюсера
  await nb.goto(base + '/?code=' + code);
  await nb.fill('#nick', 'Соседка');
  await nb.click('#studentForm button[type=submit]');
  await nb.waitForURL('**/student');
  // вторая ученица: только название и «⚙ Собрать сейчас» — остальное дописывает сервер (fillGaps)
  await nb.click('.cp >> text=Фабрика');
  await nb.fill('#f-fabrikatitle', 'Тучи над Фиштом');
  await nb.click('#step-fabrika >> text=⚙ Собрать сейчас');
  let nown = await gameFrame(nb, '/play/', 0);
  const nbFeel = await nb.inputValue('#f-resheniyafeeling');
  check('«Собрать сейчас»: пустые поля замысла дописал сервер и показал их ученице', nbFeel.length > 3 && await nb.locator('#step-resheniya .tag.dice').count() === 3 && (await nb.textContent('#step-igra .preview-igra')).includes('Тучи над Фиштом'), nbFeel);
  check('Карта спрятанной механики ученицы ушла программисту', /Спрятанная механика — её нет на картах/.test(mock.last.newUser || '') && /portal.count\('_secret'\)/.test(mock.last.newUser || ''));
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
  check('Отзыв соседу: карточки касанием вместо полей с кубиком', await student.locator('#step-pleytest .dicebtn').count() === 0 && await student.locator('#step-pleytest [data-pt="like"]').count() >= 3);
  await student.click('#step-pleytest .emo >> nth=1');
  await student.click('#step-pleytest [data-pt="like"] >> nth=0');
  await student.fill('#f-pleytestwant', 'Хочется видеть, откуда летят тучи');
  await student.click('#step-pleytest [data-pt="whatif"] >> nth=1');
  await student.click('#step-pleytest >> text=Отправить автору');
  await student.waitForSelector('#step-pleytest.done');
  check('Плейтест-карточка отправлена автору', true);
  // слепая пара со спрятанной механикой: копии игры соседки с ручкой secret и без
  const bp = {};
  for (const k of ['A', 'B']) {
    await student.click(`#step-slepaya .ab-${k}`);
    await student.click('#step-slepaya .veil button');
    const f = await gameFrame(student, '/play/', 0);
    await f.waitForFunction(() => window.__lab.cfg.secret === 0, null, { timeout: 4000 }).catch(() => {}); // setCfg приходит после ready
    bp[k] = await f.evaluate(() => window.__lab.cfg.secret);
    await playRound(f, { score: 10 });
    await sleep(400);
  }
  check('Слепая пара: копии соседки со спрятанной механикой и без', (bp.A === 0) !== (bp.B === 0), `А: ${bp.A}, Б: ${bp.B}`);
  await student.click(`#step-slepaya .opt >> text=В игре ${bp.A === 0 ? 'Б' : 'А'}`);
  await student.waitForSelector('#step-slepaya.done');
  check('Слепая пара: раскрытие «почувствовал спрятанную механику соседа»', /Ты почувствовал спрятанную механику соседа вслепую/.test(await student.textContent('#step-slepaya')));
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
  for (const k of ['like', 'want', 'whatif']) await nb.click(`#step-pleytest [data-pt="${k}"] >> nth=0`);
  await nb.click('#step-pleytest >> text=Отправить автору');
  await nb.waitForSelector('#step-pleytest.done');
  await nb.click('#step-pleytest >> text=↻ Обновить');
  await nb.waitForSelector('#step-pleytest .discovery .barrow', { timeout: 10000 });
  const disc = (await nb.textContent('#step-pleytest .discovery')).replace(/\s+/g, ' ');
  check('Открытие плейтеста: партии чужих игроков и «ещё раз»', /2\s*партий сыграли чужие/.test(disc) && /1\s*раз чужие игроки сами нажали «ещё раз»/.test(disc), disc.slice(0, 90));
  check('Открытие плейтеста: доминирующая кнопка — «→»', /держали → вправо/.test(disc), (disc.match(/держали[^.]*/) || [''])[0]);
  check('Автор видит карточку плейтеста соседа', disc.includes('Хочется видеть, откуда летят тучи'));
  check('Автор видит слепую пару: свою спрятанную механику почувствовали 1 из 1', /твою спрятанную механику почувствовали 1 из 1/.test((await nb.textContent('#step-pleytest')).replace(/\s+/g, ' ')));

  // учитель: отзыв «одно понятие + один вопрос», ученик видит его на шаге без перезагрузки
  await teacher.click('.tabs >> text=Урок');
  await teacher.click('tr.click >> text=Соседка');
  await teacher.waitForSelector('#studentDlg[open] .fbedit');
  check('Учитель видит плейтест игры ученика', /партий сыграли чужие/.test(await teacher.textContent('#studentDlg')));
  // черновик отзыва: ИИ предлагает понятие и вопрос по ответам и игре ученицы, учитель правит
  await teacher.click('#studentDlg >> text=🪄 Черновик');
  await teacher.waitForFunction(() => /Поправьте и отправьте/.test((document.querySelector('#studentDlg .fbedit') || {}).textContent || ''), null, { timeout: 30000 });
  check('Черновик отзыва: понятие и вопрос по игре и плейтесту ученицы', !!(await teacher.inputValue('#f-fb-concept')) && /Игра: «Тучи над Фиштом»/.test(mock.last.draftUser || '') && /Карточка соседа:/.test(mock.last.draftUser || ''), (mock.last.draftUser || '').slice(0, 120));
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

/* ---------- кэш промпта: метка у модели с cache (по API теперь только продюсер, связка и черновик отзыва) ---------- */
function cacheCheck() {
  check('Кэш промпта: системный промпт связки (модель с cache) ушёл с меткой cache_control, продюсера — без неё', mock.last.marked.has('mock-code') && !mock.last.marked.has('mock-text'));
}

(async () => {
  const mockSrv = await mock.start(0);
  writeConfig({ baseUrl: `http://127.0.0.1:${mockSrv.address().port}/v1`, apiKey: 'mock', codeModel: 'mock-code', textModel: 'mock-text', stream: true, timeoutSec: 30 });
  const srv = await portal.start(0, '127.0.0.1');
  const base = `http://127.0.0.1:${srv.address().port}`;
  const browser = await chromium.launch({ headless: !process.argv.includes('--headed'), args: ['--use-angle=swiftshader', '--enable-unsafe-swiftshader', '--ignore-gpu-blocklist'] });
  try {
    mock.last.demo = false;
    await run(browser, base, 'mock');
    if (FULL1) cacheCheck();
    if (!process.argv.includes('--mock-only')) {
      writeConfig({ apiKey: '' });
      mock.last.demo = true;
      await run(browser, base, 'demo');
    }
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
