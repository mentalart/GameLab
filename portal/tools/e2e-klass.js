#!/usr/bin/env node
// Сквозная проверка «Проектор и класс» (аудит уроков 21.10.2026, сессия 2): учитель на проекторе и два ученика в браузере, урок 23.
//   Д7 — заставка чекпоинта «Уровень N» у учеников и на проекторе, когда учитель открывает чекпоинт.
//   В5 — театр сцены: вкладка «🎭 Сцена», «Показать классу», «Спросить класс» — у ученика на шаге сцены только голосование, у другого — плашка;
//        ответ не уходит ученику заранее; «Включить» — переключатель на проекторе, ответ и итог у всех; «Закончить» — сцена снова у ученика.
//   Д2 — цель класса: учитель ставит цель и награду, партии в чужую игру двигают счётчик у всех, своя игра — нет; цель взята — секретный донор.
//   Д3 — живые реакции: игра в «Провале дня» на проекторе, у учеников кнопки реакций, эмодзи всплывают на проекторе, частота ограничена,
//        «где смеялись» — в открытии плейтеста автора.
//   Д5 — галерея провалов: стена в аркаде, голос «самый смешной», свой провал — «убрать», на проекторе галерея и нарезка.
// Запуск: node portal/tools/e2e-klass.js [--headed]. Данные — во временной папке, снимки — portal/.check/klass-*.png.
'use strict';
const fs = require('fs');
const os = require('os');
const path = require('path');

const TMP = fs.mkdtempSync(path.join(os.tmpdir(), 'lab-klass-'));
process.env.LAB_DATA = path.join(TMP, 'data');
process.env.LAB_CONFIG = path.join(TMP, 'config.json');
const OUT = path.resolve(__dirname, '..', '.check');
fs.mkdirSync(OUT, { recursive: true });

const { chromium } = require('playwright');
const ai = require('../lib/ai');
const store = require('../lib/store');
const portal = require('../server');
const L23 = require('../lessons/urok-23');

const PASSWORD = 'e2e-klass';
const results = [];
const check = (what, ok, detail = '') => { results.push({ what, ok: !!ok }); console.log(`  ${ok ? '✓' : '✗'} ${what}${detail ? ' — ' + detail : ''}`); };
const sleep = ms => new Promise(r => setTimeout(r, ms));
// игра-страница из чата Qwen в самом простом виде: ручка, мост portal.js, конец партии по вызову
const GAME = title => `<!doctype html><html><head><title>${title}</title></head><body style="margin:0;background:#123;color:#fff;font:20px sans-serif">
<h1 style="margin:40px">${title}</h1><script>portal.knobs({ speed: { value: 1, min: 0, max: 2, label: 'Скорость' } }); window.__end = s => portal.over(s);</script></body></html>`;

function setup() {
  fs.writeFileSync(process.env.LAB_CONFIG, JSON.stringify({ port: 0, teacherPassword: PASSWORD, ai: { apiKey: '' }, models: [], limits: { aiCallsPerStudentPerLesson: 40, rublesPerLesson: 0 } }));
  ai.reloadConfig();
  const cls = store.createClass({ name: 'Проверка класса', lesson: L23.id });
  const games = {};
  for (const [nick, title] of [['Аня', 'Пасека под огнём'], ['Боря', 'Чайник-ниндзя']]) {
    const s = store.ensureStudent(cls.code, nick), st = store.lessonState(s, L23.id);
    const g = store.createGame({ class: cls.code, nick, lesson: L23.id, title });
    store.addVersion(g, GAME(title), { kind: 'сборка' });
    st.gameId = g.id; store.saveStudent(cls.code, s);
    games[nick] = g;
  }
  return { cls, games };
}

async function login(ctx, base, body, role) {
  const p = await ctx.newPage();
  const errs = [];
  p.on('pageerror', e => errs.push(e.message));
  p.on('console', m => { if (m.type() === 'error' && !/Failed to load resource|favicon|status of 409|status of 429/.test(m.text())) errs.push(m.text()); });
  await p.goto(base + '/');
  const r = await p.evaluate(async b => (await fetch('/api/login', { method: 'POST', headers: { 'Content-Type': 'application/json' }, body: JSON.stringify(b) })).json(), body);
  await p.evaluate(([t, role]) => localStorage.setItem('lab:token:' + role, t), [r.token, role]);
  p.errs = errs;
  return p;
}
const api = (page, url, body) => page.evaluate(async ([u, b]) => {
  const res = await fetch(u, { method: b ? 'POST' : 'GET', headers: Object.assign({ 'X-Lab-Token': Lab.token.get() }, b ? { 'Content-Type': 'application/json' } : {}), body: b ? JSON.stringify(b) : undefined });
  return { status: res.status, data: await res.json().catch(() => ({})) };
}, [url, body]);

(async () => {
  const { cls, games } = setup();
  const srv = await portal.start(0, '127.0.0.1');
  const base = `http://127.0.0.1:${srv.address().port}`;
  const browser = await chromium.launch({ headless: !process.argv.includes('--headed'), args: ['--use-angle=swiftshader', '--enable-unsafe-swiftshader', '--ignore-gpu-blocklist'] });
  const init = () => { window.LAB_ASK_AUTO = true; window.LAB_FAST = true; window.LAB_LOWRES = true; };
  const tctx = await browser.newContext({ viewport: { width: 1400, height: 900 } }), actx = await browser.newContext({ viewport: { width: 1280, height: 900 } }), bctx = await browser.newContext({ viewport: { width: 1280, height: 900 } });
  for (const c of [tctx, actx, bctx]) await c.addInitScript(init);
  const shot = (p, name, fullPage = false) => p.screenshot({ path: path.join(OUT, `klass-${name}.png`), fullPage });
  let pj, anya, borya;
  try {
    pj = await login(tctx, base, { role: 'teacher', password: PASSWORD }, 'teacher');
    anya = await login(actx, base, { code: cls.code, nick: 'Аня' }, 'student');
    borya = await login(bctx, base, { code: cls.code, nick: 'Боря' }, 'student');
    await pj.goto(base + '/projector?code=' + cls.code);
    await pj.waitForSelector('#pjCode');
    await anya.goto(base + '/student'); await borya.goto(base + '/student');
    await anya.waitForSelector('.locked-msg'); await borya.waitForSelector('.locked-msg');

    /* ---------- Д7: заставка чекпоинта ---------- */
    await sleep(2500); // проектор запомнил, какие чекпоинты открыты
    const pjSplash = pj.waitForSelector('.lvl-splash', { timeout: 8000 }).then(h => h.textContent()).catch(() => '');
    await pj.click('.pj-cp button:has-text("Открыть:")');
    await anya.waitForSelector('.lvl-splash', { timeout: 8000 });
    const spl = await anya.textContent('.lvl-splash');
    await shot(anya, '1-splash');
    check('Д7: у ученика заставка «Уровень 1: …» при открытии чекпоинта', /Уровень 1/.test(spl) && spl.includes(L23.checkpoints[0].title), spl);
    check('Д7: та же заставка на проекторе', /Уровень 1/.test(await pjSplash));
    await anya.waitForSelector('.lvl-splash', { state: 'detached', timeout: 5000 });
    check('Д7: заставка уходит сама и не перекрывает клики', await anya.$eval('#step-vopros-uroka', () => getComputedStyle(document.body).pointerEvents !== 'none'));

    /* ---------- В5: театр сцены ---------- */
    await api(pj, '/api/teacher/class/update', { code: cls.code, opened: L23.checkpoints.map(c => c.id) });
    await anya.waitForSelector('.cp.open >> nth=7', { timeout: 10000 });
    await anya.click('.cp >> text=' + L23.checkpoints[1].title);
    await anya.waitForSelector('#step-secret-story canvas');
    const me = (await api(anya, '/api/me')).data;
    const toggles = me.lesson.checkpoints.flatMap(c => c.steps).find(s => s.id === 'secret-story').scenes[0].toggles;
    check('В5: у ученика вопрос и варианты переключателя, ответа нет заранее', toggles[0].vote && toggles[0].vote.options.length === 3 && !('right' in toggles[0].vote) && !('why' in toggles[0].vote));
    await pj.click('#teatrTab');
    await pj.waitForSelector('#pj-teatr canvas');
    await pj.click('[data-teatr-step="secret-story"]');
    await pj.click('[data-teatr="show"]');
    await borya.waitForSelector('.teatr-dock:not([hidden]) .teatr-card', { timeout: 8000 });
    check('В5: «Показать сцену классу» — у ученика плашка «смотри на проектор»', /смотри на экран/.test(await borya.textContent('.teatr-dock')));
    await pj.click('[data-toggle="avt"] [data-teatr="ask"]');
    await anya.waitForSelector('#step-secret-story .teatr-card', { timeout: 8000 });
    check('В5: на шаге сцены — только голосование, сама сцена спрятана', await anya.isHidden('#step-secret-story .m4-stage') && await anya.isVisible('#step-secret-story .teatr-card'));
    await borya.waitForSelector('.teatr-dock [data-teatr-opt]', { timeout: 8000 });
    check('В5: ученик на другом шаге голосует с плашки внизу', await borya.locator('.teatr-dock [data-teatr-opt]').count() === 3);
    const right = L23.checkpoints[1].steps.find(s => s.id === 'secret-story').scenes[0].toggles[0].vote.right;
    await anya.click(`#step-secret-story [data-teatr-opt="${right}"]`);
    await borya.click(`.teatr-dock [data-teatr-opt="${(right + 1) % 3}"]`);
    await pj.waitForFunction(() => /проголосовали: 2/.test((document.querySelector('[data-teatr-n]') || {}).textContent || ''), null, { timeout: 8000 });
    check('В5: проектор видит, сколько проголосовало, но не ответы', true);
    await shot(pj, '2-teatr-ask'); await shot(anya, '3-student-vote');
    await pj.click('[data-teatr="reveal"]');
    await anya.waitForSelector('#step-secret-story .teatr-card.reveal', { timeout: 8000 });
    check('В5: после «Включить» у ученика верный ответ и итог класса', /Угадал/.test(await anya.textContent('#step-secret-story .teatr-card')) && await anya.locator('#step-secret-story .teatr-opt.right').count() === 1);
    await borya.waitForSelector('.teatr-dock .teatr-card.reveal', { timeout: 8000 });
    check('В5: не угадавший видит «смотри на проектор, почему»', /Не угадал/.test(await borya.textContent('.teatr-dock')));
    check('В5: переключатель включён на проекторе, «угадали 1 из 2»', await pj.locator('[data-toggle="avt"] .kp-sw.on').count() === 1 && /Угадали 1 из 2/.test(await pj.textContent('#pj-teatr')));
    await shot(pj, '4-teatr-reveal');
    await pj.click('[data-teatr="next"]');
    await pj.waitForFunction(() => /Сцена 2 из/.test(document.querySelector('#pj-teatr .kp-cap').textContent));
    check('В5: «Дальше» листает сцену у всех, голосование закрыто', await anya.isVisible('#step-secret-story .m4-stage') && !(await anya.locator('#step-secret-story .teatr-card').count()));
    await pj.click('[data-teatr="end"]');
    await borya.waitForSelector('.teatr-dock', { state: 'hidden', timeout: 8000 });
    check('В5: «Закончить показ» — плашка ушла', true);

    /* ---------- Д2: цель класса ---------- */
    await pj.click('#goalTab');
    await pj.waitForSelector('#pjGoalTarget');
    await pj.fill('#pjGoalTarget', '5');
    await pj.selectOption('#pjGoalReward', 'zvezdopad');
    await pj.click('[data-goal="save"]');
    await anya.waitForSelector('.goal-bar:not([hidden]) [data-goal-count]', { timeout: 8000 });
    check('Д2: цель появилась у ученика без перезагрузки', /0 из 5/.test(await anya.textContent('.goal-bar')));
    for (let i = 0; i < 2; i++) await api(anya, '/api/score', { game: 'game:' + games['Аня'].id, score: 10 + i });
    let g = (await api(anya, '/api/goal')).data.goal;
    check('Д2: партии в свою игру цель не двигают', g.count === 0, String(g.count));
    for (let i = 0; i < 5; i++) await api(anya, '/api/score', { game: 'game:' + games['Боря'].id, score: 20 + i });
    g = (await api(anya, '/api/goal')).data.goal;
    check('Д2: пять партий в игру соседа — цель взята', g.count === 5 && !!g.reached && g.reward.game === 'games/zvezdopad.js');
    await borya.waitForSelector('.goal-bar [data-goal-play]', { timeout: 8000 });
    check('Д2: у всех «Цель класса взята» и открытая награда', /взята/.test(await borya.textContent('.goal-bar')));
    await pj.waitForFunction(() => /5/.test((document.querySelector('[data-goal-big]') || {}).textContent || ''), null, { timeout: 8000 });
    check('Д2: проектор показывает счёт и «Открыто для всех»', /Открыто для всех/.test(await pj.textContent('#pj-goal')));
    await shot(pj, '5-goal'); await shot(borya, '6-student-goal');
    await borya.click('.goal-bar [data-goal-play]');
    const fr = await (async () => { for (let i = 0; i < 240; i++) { const f = borya.frames().find(x => x.url().includes('zvezdopad')); if (f && await f.evaluate('!!(window.__lab && window.__lab.ready)').catch(() => false)) return f; await sleep(250); } return null; })();
    check('Д2: секретный донор «Звездопад над Фиштом» запускается', !!fr);

    /* ---------- Д3: живые реакции поверх игры на проекторе ---------- */
    await pj.click('#failTab');
    await api(pj, '/api/teacher/fail', { code: cls.code, game: games['Боря'].id });
    await borya.waitForSelector('#failAsk [data-fail="yes"]', { timeout: 8000 });
    await borya.click('#failAsk [data-fail="yes"]');
    await pj.click('#pj-fail .pj-fail button:has-text("Показать баг")', { timeout: 15000 });
    await pj.waitForSelector('#pj-fail .pj-fail iframe', { timeout: 15000 });
    await anya.waitForSelector('.react-dock:not([hidden]) [data-react]', { timeout: 15000 });
    check('Д3: игра на проекторе — у учеников кнопки реакций', /Чайник-ниндзя/.test(await anya.textContent('.react-dock')));
    await anya.click('[data-react="😂"]'); await sleep(1100);
    await anya.click('[data-react="🔥"]'); await sleep(1100);
    await borya.click('[data-react="😂"]');
    await pj.waitForSelector('.pj-react', { timeout: 8000 });
    await shot(pj, '7-reacts');
    const tally = await pj.textContent('.pj-reacttally');
    check('Д3: эмодзи всплывают на проекторе поверх игры, счёт реакций', /😂 2/.test(tally) && /🔥 1/.test(tally), tally);
    const r1 = await api(anya, '/api/react', { emoji: '👏' }), r2 = await api(anya, '/api/react', { emoji: '👏' });
    check('Д3: частота ограничена — вторая реакция подряд отклонена', r1.status === 200 && r2.status === 429, `${r1.status}, ${r2.status}`);
    check('Д3: чужой эмодзи не принимается', (await api(anya, '/api/react', { emoji: 'ПРИВЕТ' })).status === 400);
    await sleep(6000); // проектор пишет реакции в телеметрию пачкой раз в 5 секунд
    const laughs = (await api(borya, '/api/arcade')).data.mine.find(c => c.id === games['Боря'].id).discovery.laughs;
    check('Д3: «где смеялись» — в открытии плейтеста автора', laughs && laughs.total >= 4 && laughs.top.length >= 1, JSON.stringify(laughs));

    /* ---------- Д5: галерея провалов ---------- */
    await pj.fill('#pj-fail input[placeholder^="Что случилось"]', 'Чайник улетел за край мира');
    await pj.click('#pj-fail .pj-failwhy .chipbtn >> nth=4');
    await pj.click('#pj-fail button:has-text("Сохранить разбор")');
    await sleep(500);
    await anya.goto(base + '/arcade');
    await anya.waitForSelector('.fails-gal [data-fail-vote]', { timeout: 10000 });
    check('Д5: галерея провалов в аркаде: заметка и причина', /улетел за край/.test(await anya.textContent('.fails-gal')) && /Герой ушёл за край мира/.test(await anya.textContent('.fails-gal')));
    await anya.waitForSelector('#goal .goal-bar:not([hidden])');
    check('Д2: цель класса и в аркаде', /взята/.test(await anya.textContent('#goal')));
    await anya.click('.fails-gal [data-fail-vote]');
    await anya.waitForSelector('.fails-gal .fail-card.voted');
    check('Д5: голос «самый смешной» засчитан', /😂 1/.test(await anya.textContent('.fails-gal .fail-card')));
    await shot(anya, '8-arcade-fails', true);
    await borya.goto(base + '/arcade');
    await borya.waitForSelector('.fails-gal .fail-card');
    check('Д5: за свой провал голосовать нельзя, но можно убрать', !(await borya.locator('.fails-gal [data-fail-vote]').count()) && await borya.locator('.fails-gal [data-fail-hide]').count() === 1);
    check('Д5: сервер не принимает голос за свой провал', (await api(borya, '/api/fails/vote', { key: games['Боря'].id + ':' + L23.id })).status === 400);
    await pj.click('[data-fail-view="gallery"]');
    await pj.waitForSelector('#pj-fail .fail-card');
    check('Д5: на проекторе галерея с голосами класса', /😂 1/.test(await pj.textContent('#pj-fail .fail-card')));
    await pj.click('[data-fails-view="reel"]');
    await pj.waitForSelector('#pj-fail .pj-reel iframe', { timeout: 15000 });
    check('Д5: нарезка к Фестивалю — провал №1 в рамке', /№1/.test(await pj.textContent('#pj-fail .pj-reel')));
    await shot(pj, '9-reel');
    await borya.click('.fails-gal [data-fail-hide]');
    await borya.waitForSelector('.fails-gal .fail-card.off');
    const after = (await api(pj, '/api/teacher/fails?code=' + cls.code)).data.fails;
    check('Д5: автор убрал провал — его нет в галерее учителя', after.length === 0);
    for (const [name, p] of [['проектор', pj], ['Аня', anya], ['Боря', borya]]) check(`Без ошибок на странице: ${name}`, !p.errs.length, p.errs.slice(0, 3).join(' | '));
  } catch (e) {
    check('Прогон дошёл до конца', false, e.message.split('\n').slice(0, 3).join(' '));
    for (const [n, p] of [['pj', pj], ['anya', anya], ['borya', borya]]) if (p) await p.screenshot({ path: path.join(OUT, `klass-x-${n}.png`), fullPage: true }).catch(() => {});
  }
  await browser.close(); srv.close();
  fs.rmSync(TMP, { recursive: true, force: true });
  const bad = results.filter(r => !r.ok);
  console.log(`\n${bad.length ? 'Есть ошибки: ' + bad.length : 'Всё в порядке'}. Снимки: portal/.check/klass-*.png`);
  process.exit(bad.length ? 1 : 0);
})();
