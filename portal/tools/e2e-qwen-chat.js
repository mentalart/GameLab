#!/usr/bin/env node
// Проверка урока 1 версии 2: программист — Qwen в чате chat.qwen.ai, игры собираются копированием задания и вставкой ответа.
// Одна кнопка «Скопировать задание» на новую игру: задание Clear из трёх частей, ответ — страница HTML.
// Без ключа ИИ: сборка, оборванный ответ и «Продолжи», ответ без кода и сообщение в тот же чат, правки кусками обоих форматов,
// мост portal.js (ручки, setCfg, «запустилась», отказ бота, телеметрия партии), игра класса у учителя, окно Qwen в браузере ученика,
// правка в чате Qwen (договор, перенос в новый чат, конструктор просьбы, «Вставить новую версию из чата», сообщение «что пропало»).
// Данные и настройки — во временной папке. Запуск: node portal/tools/e2e-qwen-chat.js
'use strict';
const fs = require('fs');
const os = require('os');
const path = require('path');

const TMP = fs.mkdtempSync(path.join(os.tmpdir(), 'lab-qwen-'));
process.env.LAB_DATA = path.join(TMP, 'data');
process.env.LAB_CONFIG = path.join(TMP, 'config.json');
const PASSWORD = 'qwen-пароль';
fs.writeFileSync(process.env.LAB_CONFIG, JSON.stringify({ port: 0, teacherPassword: PASSWORD, ai: { apiKey: '' } }));

const ai = require('../lib/ai');
const portal = require('../server');
const results = [];
const check = (what, ok, detail = '') => { results.push(!!ok); console.log(`  ${ok ? '✓' : '✗'} ${what}${detail ? ' — ' + detail : ''}`); };
const sleep = ms => new Promise(r => setTimeout(r, ms));
const SAMPLE = fs.readFileSync(path.join(__dirname, '..', 'games', 'nlo-v-stanice.js'), 'utf8'); // ответ на прежнее задание — объект GAME
const PAGE = fs.readFileSync(path.join(__dirname, 'fixtures', 'qwen-game.html'), 'utf8'); // ответ на задание Clear — страница HTML
const patch = (find, repl) => `<<<<<<< НАЙТИ\n${find}\n=======\n${repl}\n>>>>>>> ЗАМЕНИТЬ`;

(async () => {
  const srv = await portal.start(0, '127.0.0.1');
  const base = `http://127.0.0.1:${srv.address().port}`;
  const call = async (token, p, body) => {
    const res = await fetch(base + p, { method: body ? 'POST' : 'GET', headers: Object.assign({ 'X-Lab-Token': token || '' }, body ? { 'Content-Type': 'application/json' } : {}), body: body ? JSON.stringify(body) : undefined });
    const j = await res.json().catch(() => ({}));
    if (!res.ok) throw Object.assign(new Error(j.error || res.status), { status: res.status });
    return j;
  };
  const poll = async (token, id, want) => {
    for (let i = 0; i < 100; i++) { const j = await call(token, '/api/job?id=' + id); if (want.includes(j.state)) return j; await sleep(50); }
    throw new Error('Задание не дошло до ' + want);
  };
  const prompt = (token, id, clear) => call(token, '/api/job/prompt?id=' + id + (clear ? '&clear=1' : '')).then(r => r.text);
  try {
    console.log('▶ Урок 1, версия 2: Qwen в чате');
    const t = (await call('', '/api/login', { role: 'teacher', password: PASSWORD })).token;
    const list = await call(t, '/api/teacher/classes');
    const ids = list.lessons.map(l => l.id);
    const v1 = list.lessons.find(l => l.id === 'urok-01');
    check('Урок 1 (версия 1) скрыт из меню учителя, версия 2 — в меню', v1 && v1.hidden && ids.indexOf('urok-01-v2') >= 0 && !list.lessons.find(l => l.id === 'urok-01-v2').hidden, ids.slice(0, 3).join(', '));
    check('Версия 2 помечена как чат', list.lessons.find(l => l.id === 'urok-01-v2').chat && !list.lessons.find(l => l.id === 'urok-01').chat);
    const cls = await call(t, '/api/teacher/class', { name: 'Qwen', lesson: 'urok-01-v2' });
    const s = (await call('', '/api/login', { code: cls.code, nick: 'Аня' })).token;
    const me = await call(s, '/api/me');
    check('Ученик видит урок версии 2 без демо-режима программиста', me.lesson.id === 'urok-01-v2' && me.chat === true && me.demo === false);

    // сборка: два задания на выбор
    let job = (await call(s, '/api/ai/build', {})).job;
    let j = await poll(s, job, ['waiting']);
    check('Сборка ждёт ответа из чата, заданий два', j.manual && j.manual.step === 1 && !j.manual.followUp && j.manual.clear > 0, j.manual && `${j.manual.chars} и ${j.manual.clear} знаков`);
    const full = await prompt(s, job), clear = await prompt(s, job, true);
    check('Прежнее задание: правила Лаб3D, образец, просьба автора и памятка', /const GAME = \{/.test(full) && full.includes(ai.CHAT.phrase) && /джойстика \(геймпада\)/.test(full));
    check('Clear: три части без Babylon и образцов', clear.startsWith(ai.CHAT.phrase) && /# Замысел геймдизайнера/.test(clear) && /# Что нужно порталу/.test(clear)
      && /portal\.knobs/.test(clear) && /getGamepads/.test(clear) && !/Babylon|BABYLON|const GAME/.test(clear) && clear.length < 7500, `${clear.length} знаков`); // +1500: секрет по шагам (howto), решение автора 18.10.2026
    // ответ оборвался: портал просит продолжение и склеивает части
    const answer = 'Вот игра:\n```js\n' + SAMPLE.trim() + '\n```\nГотово!';
    const cut = answer.indexOf('update(lab, dt)');
    let r = await call(s, '/api/job/answer', { id: job, text: answer.slice(0, cut + 40) });
    check('Оборванный ответ: портал просит «Продолжи»', r.continue === true && r.parts === 1);
    j = await call(s, '/api/job?id=' + job);
    check('Окно знает о продолжении', j.manual.cont && /Продолжи/.test(await prompt(s, job)));
    await call(s, '/api/job/answer', { id: job, text: '```js\n' + answer.slice(cut) });
    j = await poll(s, job, ['done', 'error']);
    check('Игра GAME из двух частей собрана', j.state === 'done' && j.result.version === 1, j.error || '');
    const g1 = j.result.game;
    check('Версия записана как chat.qwen.ai без рублей', g1.versions[0].model === 'chat.qwen.ai' && g1.versions[0].rub === 0);
    check('Склеенный код совпадает с образцом', fs.readFileSync(path.join(process.env.LAB_DATA, 'games', g1.id, 'v1.js'), 'utf8').trim() === SAMPLE.trim());

    // задание Clear: ответ без кода → сообщение в тот же чат, потом оборванная страница и продолжение
    job = (await call(s, '/api/ai/build', {})).job;
    await poll(s, job, ['waiting']);
    await call(s, '/api/job/answer', { id: job, text: 'Конечно! Вот идея игры: кот прыгает по Луне.' });
    j = await poll(s, job, ['waiting']);
    check('Ответ без кода: сообщение в тот же чат, одно задание', j.manual.step === 2 && j.manual.followUp && !j.manual.clear && /нет кода/.test(await prompt(s, job)));
    r = await call(s, '/api/job/answer', { id: job, text: '```html\n' + PAGE.slice(0, PAGE.indexOf('function frame')) });
    check('Оборванная страница: «Продолжи»', r.continue === true);
    await call(s, '/api/job/answer', { id: job, text: PAGE.slice(PAGE.indexOf('function frame')) + '```' });
    j = await poll(s, job, ['done', 'error']);
    const vHtml = j.result && j.result.version;
    check('Страница HTML собрана без замечаний', j.state === 'done' && vHtml === 2 && !(j.result.game.versions[1].warnings || []).length, j.error || JSON.stringify(j.result && j.result.game.versions[1].warnings));
    const play = await (await fetch(`${base}/play/${g1.id}/${vHtml}`)).text();
    check('В игру-страницу вставлен мост portal.js первым в <head>', /<head><script src="\/engine\/portal\.js"><\/script>\n<meta charset/.test(play));
    const dl = await (await fetch(`${base}/download/${g1.id}/${vHtml}.html`)).text();
    check('Скачанная игра-страница несёт мост внутри', /window\.portal = portal/.test(dl) && !/src="\/engine\/portal\.js"/.test(dl));

    // правки страницы — по заданию Clear, без лимита
    let okChanges = 0, title = 'Кот на Луне';
    for (let k = 0; k < 3; k++) {
      job = (await call(s, '/api/ai/change', { request: 'Новое название ' + k })).job;
      j = await poll(s, job, ['waiting']);
      const p = await prompt(s, job);
      if (!k) check('Правка страницы в тот же чат: просьба и формат кусками, без кода игры и правил Лаб3D', /выше в этом чате/.test(p) && /Новое название 0/.test(p) && /НАЙТИ/.test(p) && /portal/.test(p) && !/<\/html>/.test(p) && !/const GAME = \{/.test(p) && !j.manual.clear, `${p.length} знаков`);
      await call(s, '/api/job/answer', { id: job, text: patch(`<title>${title}</title>`, `<title>Правка ${k}</title>`) });
      title = 'Правка ' + k;
      j = await poll(s, job, ['done', 'error', 'waiting']).catch(() => ({ state: 'timeout' }));
      if (j.state === 'done') okChanges++; else console.log('    ', j.state, j.error || '');
    }
    check('Три правки страницы подряд без лимита', okChanges === 3);
    // правка игры GAME — по правилам Лаб3D
    await call(s, '/api/game/current', { version: 1 });
    job = (await call(s, '/api/ai/change', { request: 'Другое название' })).job;
    await poll(s, job, ['waiting']);
    const pg1 = await prompt(s, job);
    check('Правка игры GAME в тот же чат: без кода игры, ввод через lab.p1, формат кусками', /игры GAME, которую ты написал выше/.test(pg1) && /lab\.p1/.test(pg1) && /НАЙТИ/.test(pg1) && !/const GAME = \{/.test(pg1), `${pg1.length} знаков`);
    await call(s, '/api/job/answer', { id: job, text: patch("  title: '" + /title: '([^']*)'/.exec(SAMPLE)[1] + "',", "  title: 'Другое название',") });
    j = await poll(s, job, ['done', 'error']);
    check('Правка игры GAME легла', j.state === 'done', j.error || '');

    // правка в чате Qwen (урок 1, чекпоинт 5): договор, перенос в новый чат, конструктор просьбы, «Вставить новую версию из чата»
    await call(s, '/api/game/current', { version: vHtml + 3 });
    const pact = (await call(s, '/api/chat/pact')).text;
    check('Договор с Qwen: целиком или куски, ручки, секрет, portal.notes', /Договорились/.test(pact) && /НАЙТИ/.test(pact) && /portal\.knobs/.test(pact) && /_secret/.test(pact) && /portal\.notes/.test(pact) && !/<title>/.test(pact));
    const move = (await call(s, '/api/chat/move')).text;
    check('Перенос в новый чат: правила портала, код текущей версии и договор', /Что нужно порталу/.test(move) && /<title>Правка 2<\/title>/.test(move) && /Договорились/.test(move), `${move.length} знаков`);
    const askText = (await call(s, '/api/chat/ask', { what: 'Враги  быстрее к концу', why: 'Чтобы игрок почувствовал: страшно', keep: 'Управление' })).text;
    check('Конструктор просьбы: что, зачем, не трогай — без кода', /^Правка: Враги быстрее к концу\nЗачем: Чтобы игрок/.test(askText) && /Не трогай: Управление/.test(askText) && !/<html/.test(askText), askText.split('\n')[0]);
    const noOver = PAGE.replace(/portal\.over\(score\);\s*/, '').replace("portal.count('_secret')", "portal.count('_secret'); portal.notes(['Золотая тарелка'])").replace('Кот на Луне', 'Из чата');
    job = (await call(s, '/api/game/paste', { text: 'Вот:\n```html\n' + noOver + '\n```', request: 'Враги быстрее к концу' })).job;
    j = await poll(s, job, ['done', 'error']);
    const pv = j.result && j.result.game.versions[j.result.version - 1];
    check('Вставка из чата: новая версия-правка с просьбой ученика', j.state === 'done' && pv.kind === 'правка' && pv.chat && pv.request === 'Враги быстрее к концу' && pv.from === vHtml + 3, j.error || JSON.stringify(pv && { kind: pv.kind, from: pv.from }));
    check('Пропал portal.over — сообщение для того же чата', /portal\.over/.test(j.result.repair) && /ничего другого не меняя/.test(j.result.repair), j.result.repair);
    const notes = (await call(s, '/api/game/notes')).notes || [];
    check('Записи программиста portal.notes читаются из кода', notes.includes('Золотая тарелка'), JSON.stringify(notes));

    // учитель: игра класса, обе кнопки
    await call(t, '/api/teacher/wow/draw', { code: cls.code, card: 'all' });
    const tj = (await call(t, '/api/teacher/wow/build', { code: cls.code })).job;
    j = await poll(t, tj, ['waiting']);
    const tClear = await prompt(t, tj, true);
    check('Игра класса: Clear с картами и секретом', j.manual.clear > 0 && tClear.startsWith(ai.CHAT.phrase) && /# Гейм дизайн документ/.test(tClear) && /_secret/.test(tClear) && !/lab\./.test(tClear));
    const tj2 = (await call(t, '/api/teacher/wow/build', { code: cls.code })).job;
    j = await poll(t, tj, ['error']);
    check('Повторная сборка отменяет ждущее задание', /Отменено/.test(j.error) && tj2 !== tj);
    await poll(t, tj2, ['waiting']);
    await call(t, '/api/job/answer', { id: tj2, text: '```html\n' + PAGE.replace('Кот на Луне', 'Игра класса') + '\n```' });
    j = await poll(t, tj2, ['done', 'error']);
    const wow = await call(t, '/api/teacher/wow?code=' + cls.code);
    check('Игра класса собрана через чат', j.state === 'done' && wow.wow.status === 'preview' && wow.game.model === 'chat.qwen.ai', j.error || '');
    let refused = '';
    try { await call(t, '/api/teacher/compare', { code: cls.code, nick: 'Аня', model: 'x' }); } catch (e) { refused = e.message; }
    check('Сравнение моделей API в версии 2 закрыто', /chat\.qwen\.ai/.test(refused));

    // браузер: окно Qwen и мост игры
    const { chromium } = require('playwright');
    const browser = await chromium.launch();
    const pg = await browser.newPage();
    const errors = [];
    pg.on('pageerror', e => errors.push(e.message));
    await pg.goto(base + '/');
    await pg.evaluate(tok => localStorage.setItem('lab:token:student', tok), s);
    await pg.goto(base + '/student');
    await pg.waitForFunction(() => typeof Lab !== 'undefined');
    await pg.evaluate(() => { window.__res = null; Lab.job('/api/ai/build', {}).then(r => (window.__res = r), e => (window.__res = e.message)); });
    await pg.waitForSelector('dialog.qwen[open] button.clear:not([disabled])', { timeout: 10000 });
    const btns = await pg.$$eval('dialog.qwen button.btn:not(.ghost):not(.qwen-send)', b => b.map(x => x.textContent));
    check('Окно Qwen: одна кнопка «Скопировать задание» (три части, без Clear в подписи), ссылка на чат', btns.length === 1 && /^📋 Скопировать задание \(/.test(btns[0]) && !/Clear/.test(btns[0]) && !!(await pg.$('dialog.qwen a[href="https://chat.qwen.ai/"]')), btns.join(' | '));
    await pg.screenshot({ path: path.join(__dirname, '..', '.check', 'qwen-chat-dialog.png') }).catch(() => {});
    await pg.fill('dialog.qwen textarea', '```html\n' + PAGE + '\n```');
    await pg.click('dialog.qwen .qwen-send');
    await pg.waitForFunction(() => window.__res, null, { timeout: 15000 });
    const res = await pg.evaluate(() => window.__res);
    check('Ответ из окна стал новой версией, окно закрылось', res && res.version && !(await pg.$('dialog.qwen')), typeof res === 'string' ? res : '');
    // мост в рамке-песочнице, как в портале: «запустилась» со своими ручками, отказ бота-плейтестера
    const bridge = await pg.evaluate(async src => {
      const got = [];
      addEventListener('message', e => { if (e.data && e.data.source === 'lab-game') got.push(e.data); });
      const f = document.createElement('iframe'); f.sandbox = 'allow-scripts'; f.src = src; f.style.cssText = 'width:400px;height:300px'; document.body.append(f);
      const wait = async test => { for (let i = 0; i < 100 && !got.some(test); i++) await new Promise(r => setTimeout(r, 100)); return got.find(test); };
      const ready = await wait(m => m.type === 'ready');
      f.contentWindow.postMessage({ target: 'lab-game', type: 'playtest' }, '*');
      const bot = await wait(m => m.type === 'playtest');
      return { config: ready && ready.meta.config, bot: bot && bot.error };
    }, `/play/${res.gameId}/${res.version}`);
    check('Мост: игра сообщает «запустилась» со своими ручками', !!(bridge.config && bridge.config.speed && bridge.config.speed.label === 'Скорость героя' && bridge.config.secret), JSON.stringify(bridge.config));
    check('Мост: бот-плейтестер получает понятный отказ', /бот-плейтестер/.test(bridge.bot || ''));
    // телеметрия моста: игра отдельной страницей, «родитель» подменён (window.parent заменяемое свойство) — видно, что мост шлёт порталу
    const tp = await browser.newPage();
    tp.on('pageerror', e => errors.push('игра: ' + e.message));
    await tp.addInitScript(() => { window.__sent = []; window.parent = { postMessage: m => window.__sent.push(JSON.parse(JSON.stringify(m))) }; });
    await tp.goto(`${base}/play/${res.gameId}/${res.version}`);
    await tp.waitForFunction(() => window.__sent.some(m => m.type === 'ready'));
    await tp.evaluate(() => { window.__sent.length = 0; portal.again(); portal.score(3); });
    await tp.keyboard.press('Space');
    await tp.keyboard.down('ArrowLeft'); await sleep(1500); await tp.keyboard.up('ArrowLeft');
    await tp.evaluate(() => { portal.score(8); portal.hurt(); portal.count('_secret'); });
    await sleep(1200);
    const tele = await tp.evaluate(() => { portal.over(); const o = window.__sent.find(m => m.type === 'over'); return o && { score: o.score, tele: o.tele }; });
    await tp.close();
    const T = (tele || {}).tele || {};
    check('Мост: телеметрия партии — время, нажатия, удержание, урон, счёт по секундам, секунда секрета',
      tele && tele.score === 8 && T.time >= 2 && T.presses.a === 1 && T.presses.left === 1 && T.hold.left >= 1 && T.hurts === 1 && T.line.length >= 3 && T.line[0] === 3 && T.line[T.line.length - 1] === 8 && (T.marks._secret || []).some(x => x >= 1),
      JSON.stringify(tele && { score: tele.score, time: T.time, presses: T.presses, hold: T.hold, hurts: T.hurts, line: T.line, marks: T.marks }));
    const gp = await browser.newPage();
    gp.on('pageerror', e => errors.push('игра: ' + e.message));
    await gp.goto(`${base}/play/${res.gameId}/${res.version}`);
    await gp.waitForFunction(() => window.portal && window.endRound);
    await gp.evaluate(() => window.postMessage({ target: 'lab-game', type: 'setCfg', cfg: { speed: 15 } }, '*'));
    await sleep(200);
    await gp.keyboard.press('Tab');
    const panel = await gp.evaluate(() => ({ paused: portal.paused, text: document.body.innerText }));
    check('Мост: Tab открывает панель ручек, игра на паузе, setCfg меняет ручку', panel.paused && /Ручки геймдизайнера/.test(panel.text) && /Скорость героя: 15/.test(panel.text) && /Новичок/.test(panel.text), panel.text.slice(0, 120));
    // чекпоинт 5 в браузере ученика: разбор и правка в чате Qwen («Вставить новую версию из чата» под игрой и в Мастерской)
    await call(t, '/api/teacher/class/update', { code: cls.code, opened: ['vau', 'secret', 'fabrika', 'peremena', 'svoya'] });
    await call(s, '/api/game/current', { version: res.version });
    await pg.goto(base + '/student');
    await pg.click('.cp >> text=Своя игра');
    await pg.waitForSelector('#step-masterskaya .chatbox');
    check('Своя игра: под игрой — «Вставить новую версию из чата», в разборе четыре прибора',
      !!(await pg.$('#step-ruchki details.pastebox')) && await pg.locator('#step-razbor [data-tool]').count() === 4);
    await pg.fill('#step-masterskaya [data-ask="what"]', 'Враги быстрее к концу партии');
    await pg.waitForFunction(() => /Правка: Враги быстрее к концу партии/.test(document.querySelector('#step-masterskaya .chatmsg').textContent));
    check('Мастерская в чате: договор, перенос в новый чат и конструктор просьбы', /Договор/.test(await pg.textContent('#step-masterskaya')) && /Перенести игру в новый чат/.test(await pg.textContent('#step-masterskaya')));
    await pg.fill('#step-masterskaya [data-paste="text"]', '```html\n' + PAGE.replace('Кот на Луне', 'Быстрые враги') + '\n```');
    await pg.click('#step-masterskaya [data-paste="send"]');
    await pg.waitForSelector('#step-masterskaya >> text=Мои правки (1)', { timeout: 15000 });
    check('В Мастерской чата одна вставка — без дубля под игрой', await pg.locator('#step-masterskaya [data-paste="text"]').count() === 1);
    const meP = await call(s, '/api/me');
    const lastV = meP.game.versions[meP.game.versions.length - 1];
    check('Ответ из чата в Мастерской стал правкой с просьбой ученика', lastV.request === 'Враги быстрее к концу партии' && lastV.chat && /\[чат\]/.test(JSON.stringify(meP.answers.masterskaya.value.requests.map(r => (r.chat ? '[чат] ' : '') + r.text))), lastV.request);
    check('Нет слова «null» в разборе, Мастерской и проверке', !/\bnull\b/.test(await pg.textContent('#main')));
    check('Проверка версии ждёт партии в новой версии', /Сыграй партию в новую версию/.test(await pg.textContent('#step-proverka')));
    await pg.screenshot({ path: path.join(__dirname, '..', '.check', 'qwen-chat-workshop.png'), fullPage: true }).catch(() => {});
    check('Без ошибок на страницах', !errors.length, errors.join('; '));
    await browser.close();
  } catch (e) {
    check('Проверка дошла до конца', false, e.stack);
  }
  srv.close();
  fs.rmSync(TMP, { recursive: true, force: true });
  const bad = results.filter(x => !x).length;
  console.log(bad ? `\n✗ Не прошло проверок: ${bad} из ${results.length}` : `\n✓ Все проверки пройдены: ${results.length}`);
  process.exit(bad ? 1 : 0);
})();
