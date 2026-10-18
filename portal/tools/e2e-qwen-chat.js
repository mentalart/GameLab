#!/usr/bin/env node
// Проверка урока 1 версии 2: программист — Qwen в чате chat.qwen.ai, игры собираются копированием задания и вставкой ответа.
// Без ключа ИИ (как в классе с бесплатным чатом): сборка своей игры, оборванный ответ и «Продолжи», ответ с ошибкой синтаксиса
// и сообщение в тот же чат, правка кусками, страница HTML вместо GAME, игра класса у учителя, окно Qwen в браузере ученика.
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
const SAMPLE = fs.readFileSync(path.join(__dirname, '..', 'games', 'nlo-v-stanice.js'), 'utf8');

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
  try {
    console.log('▶ Урок 1, версия 2: Qwen в чате');
    const t = (await call('', '/api/login', { role: 'teacher', password: PASSWORD })).token;
    const list = await call(t, '/api/teacher/classes');
    const ids = list.lessons.map(l => l.id);
    check('В меню обе версии урока 1', ids.indexOf('urok-01') >= 0 && ids.indexOf('urok-01-v2') === ids.indexOf('urok-01') + 1, ids.slice(0, 3).join(', '));
    check('Версия 2 помечена как чат', list.lessons.find(l => l.id === 'urok-01-v2').chat && !list.lessons.find(l => l.id === 'urok-01').chat);
    const cls = await call(t, '/api/teacher/class', { name: 'Qwen', lesson: 'urok-01-v2' });
    const s = (await call('', '/api/login', { code: cls.code, nick: 'Аня' })).token;
    const me = await call(s, '/api/me');
    check('Ученик видит урок версии 2 без демо-режима программиста', me.lesson.id === 'urok-01-v2' && me.chat === true && me.demo === false);

    // сборка: задание ждёт ответа из чата
    let job = (await call(s, '/api/ai/build', {})).job;
    let j = await poll(s, job, ['waiting']);
    check('Сборка ждёт ответа из чата', j.manual && j.manual.step === 1 && !j.manual.followUp && j.manual.short, j.manual && `${j.manual.chars} знаков`);
    const full = (await call(s, '/api/job/prompt?id=' + job)).text, short = (await call(s, '/api/job/prompt?id=' + job + '&short=1')).text;
    check('В задании правила, образец и просьба автора', /const GAME = \{/.test(full) && full.includes(ai.CHAT.phrase) && full.length > short.length && short.includes(ai.CHAT.phrase));
    check('В задании напоминание: геймпад, ручки, секрет', /джойстика \(геймпада\)/.test(full) && /config/.test(full) && /_secret/.test(full));
    // ответ оборвался: портал просит продолжение и склеивает части
    const answer = 'Вот игра:\n```js\n' + SAMPLE.trim() + '\n```\nГотово!';
    const cut = answer.indexOf('update(lab, dt)');
    let r = await call(s, '/api/job/answer', { id: job, text: answer.slice(0, cut + 40) });
    check('Оборванный ответ: портал просит «Продолжи»', r.continue === true && r.parts === 1);
    j = await call(s, '/api/job?id=' + job);
    check('Окно знает о продолжении', j.manual.cont && /Продолжи/.test((await call(s, '/api/job/prompt?id=' + job)).text));
    r = await call(s, '/api/job/answer', { id: job, text: '```js\n' + answer.slice(cut, answer.length) });
    check('Продолжение принято', r.ok === true);
    j = await poll(s, job, ['done', 'error']);
    check('Игра из двух частей собрана', j.state === 'done' && j.result.version === 1, j.error || '');
    const g1 = j.result.game;
    check('Версия записана как chat.qwen.ai без рублей', g1.versions[0].model === 'chat.qwen.ai' && g1.versions[0].rub === 0);
    const code1 = fs.readFileSync(path.join(process.env.LAB_DATA, 'games', g1.id, 'v1.js'), 'utf8');
    check('Склеенный код совпадает с образцом', code1.trim() === SAMPLE.trim());

    // ошибка синтаксиса: следующее сообщение в тот же чат
    job = (await call(s, '/api/ai/build', {})).job;
    await poll(s, job, ['waiting']);
    await call(s, '/api/job/answer', { id: job, text: '```js\nconst GAME = { title: "x", start() { if ( }, };\n```' });
    j = await poll(s, job, ['waiting']);
    const follow = (await call(s, '/api/job/prompt?id=' + job)).text;
    check('Ошибка синтаксиса: сообщение в тот же чат без правил', j.manual.step === 2 && j.manual.followUp && /ошибк/i.test(follow) && !follow.includes('# Задание'));
    await call(s, '/api/job/answer', { id: job, text: '```js\n' + SAMPLE + '```' });
    j = await poll(s, job, ['done', 'error']);
    check('Вторая попытка собрана', j.state === 'done' && j.result.version === 2);

    // правка кусками без лимита: три правки подряд
    let okChanges = 0;
    for (let k = 0; k < 3; k++) {
      job = (await call(s, '/api/ai/change', { request: 'Пусть враги будут быстрее ' + k })).job;
      j = await poll(s, job, ['waiting']);
      const p = (await call(s, '/api/job/prompt?id=' + job)).text;
      if (k === 0) check('Правка: в задании код и формат кусками, без просьбы «собери игру»', /НАЙТИ/.test(p) && !p.includes(ai.CHAT.phrase));
      await call(s, '/api/job/answer', { id: job, text: "<<<<<<< НАЙТИ\n  title: '" + (k ? 'Правка ' + (k - 1) : /title: '([^']*)'/.exec(SAMPLE)[1]) + "',\n=======\n  title: 'Правка " + k + "',\n>>>>>>> ЗАМЕНИТЬ" });
      j = await poll(s, job, ['done', 'error', 'waiting']).catch(e => ({ state: 'timeout' }));
      if (j.state === 'waiting') console.log('    ждёт снова:', (await call(s, '/api/job/prompt?id=' + job)).text.slice(0, 300));
      if (j.state === 'done') okChanges++;
      else console.log('    ', j.error);
    }
    check('Три правки подряд без лимита', okChanges === 3);

    // страница HTML вместо GAME: игра всё равно подхватывается
    job = (await call(s, '/api/ai/build', {})).job;
    await poll(s, job, ['waiting']);
    const page = '<!DOCTYPE html>\n<html><head><title>Куб</title></head><body><canvas id="c"></canvas><script>document.title = "ok";</script></body></html>';
    await call(s, '/api/job/answer', { id: job, text: 'Держи:\n```html\n' + page + '\n```' });
    j = await poll(s, job, ['done', 'error']);
    const v = j.result && j.result.version;
    const html = v && await (await fetch(`${base}/play/${j.result.gameId}/${v}`)).text();
    check('Страница HTML принята как игра', j.state === 'done' && /<canvas/.test(html) && /lab-game/.test(html) && (j.result.game.versions[v - 1].warnings || []).length > 0, j.error || '');

    // учитель: игра класса через чат
    await call(t, '/api/teacher/wow/draw', { code: cls.code, card: 'all' });
    let tj = (await call(t, '/api/teacher/wow/build', { code: cls.code })).job;
    j = await poll(t, tj, ['waiting']);
    const tp = (await call(t, '/api/job/prompt?id=' + tj)).text;
    check('Игра класса: задание учителю с картами и просьбой автора', tp.includes(ai.CHAT.phrase) && /secret/.test(tp));
    // учитель перезагрузил страницу: новая сборка отменяет ждущее задание
    const tj2 = (await call(t, '/api/teacher/wow/build', { code: cls.code })).job;
    j = await poll(t, tj, ['error']);
    check('Повторная сборка отменяет ждущее задание', /Отменено/.test(j.error) && tj2 !== tj);
    await poll(t, tj2, ['waiting']);
    await call(t, '/api/job/answer', { id: tj2, text: '```js\n' + SAMPLE.replace(/title: '[^']*'/, "title: 'Игра класса'").replace('config: {', "config: { secret: { value: 1, min: 0, max: 1, step: 1, label: 'Секрет' },") + '```' });
    j = await poll(t, tj2, ['done', 'error']);
    const wow = await call(t, '/api/teacher/wow?code=' + cls.code);
    check('Игра класса собрана через чат', j.state === 'done' && wow.wow.status === 'preview' && wow.game.model === 'chat.qwen.ai', j.error || '');
    let refused = '';
    try { await call(t, '/api/teacher/compare', { code: cls.code, nick: 'Аня', model: 'x' }); } catch (e) { refused = e.message; }
    check('Сравнение моделей API в версии 2 закрыто', /chat\.qwen\.ai/.test(refused));

    // окно Qwen в браузере ученика (правка последней версии с кодом GAME, а не страницы HTML)
    await call(s, '/api/game/current', { version: v - 1 });
    const { chromium } = require('playwright');
    const browser = await chromium.launch();
    const pg = await browser.newPage();
    const errors = [];
    pg.on('pageerror', e => errors.push(e.message));
    await pg.goto(base + '/');
    await pg.evaluate(tok => localStorage.setItem('lab:token:student', tok), s);
    await pg.goto(base + '/student');
    await pg.waitForFunction(() => typeof Lab !== 'undefined');
    await pg.evaluate(() => { window.__done = Lab.job('/api/ai/change', { request: 'Сделай небо розовым' }).then(r => (window.__res = r), e => (window.__err = e.message)); });
    await pg.waitForSelector('dialog.qwen[open] button:not([disabled])', { timeout: 10000 });
    check('Окно Qwen: копирование, ссылка на чат и поле ответа', await pg.$('dialog.qwen a[href="https://chat.qwen.ai/"]') && await pg.$('dialog.qwen textarea.qwen-answer'));
    await pg.fill('dialog.qwen textarea', "<<<<<<< НАЙТИ\n  title: 'Правка 2',\n=======\n  title: 'Розовое небо',\n>>>>>>> ЗАМЕНИТЬ");
    await pg.screenshot({ path: path.join(__dirname, '..', '.check', 'qwen-chat-dialog.png') }).catch(() => {});
    await pg.click('dialog.qwen .qwen-send');
    await pg.waitForFunction(() => window.__res || window.__err, null, { timeout: 15000 });
    const res = await pg.evaluate(() => window.__res || window.__err);
    check('Ответ из окна стал новой версией, окно закрылось', res && res.version && !(await pg.$('dialog.qwen')), typeof res === 'string' ? res : '');
    check('Без ошибок на странице', !errors.length, errors.join('; '));
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
