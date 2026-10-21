// Сквозная проверка уроков модуля 7 «Играть вместе» (26–28) — часть e2e-portal.js, вызывается из него с его помощниками.
// Урок 26: донор вдвоём, спрятанная механика (взаимодействие), моушн-объяснялки, вариации, Фабрика на двоих, турнирная сетка,
// «Арена класса» по сети (загон, старт, финиш, квота, голос за правило, правило у игры), вкладка «Вместе» у учителя и на проекторе.
// Уроки 27–28: команда, карточки джема, мозговой штурм вживую, замысел команды, одна игра на команду (второй участник — по API),
// ножницы и ретро во второй встрече.
'use strict';
const m4 = require('./e2e-m4');

module.exports = function m7(H) {
  const { check, gameFrame, playRound, sleep, mock, lessons } = H;
  const { open, choice, donor, hunt, motion, variety, final } = m4(Object.assign({}, H, { lessons: {} })).helpers;
  const stepOf = (les, id) => les.checkpoints.flatMap(c => c.steps).find(s => s.id === id);
  const tapi = (teacher, path, body) => teacher.evaluate(([p, b]) => Lab.api(p, b), [path, body]);
  const sapi = (student, path, body) => student.evaluate(([p, b]) => Lab.api(p, b), [path, body]);

  // Фабрика (кубик, «Замысел готов»), решения, ИГРА, сборка в чате Qwen: в задании — два игрока или легенда
  async function build(student, les, mode, title, want, demoCheck) {
    await student.click('#step-fabrika >> text=🎲 Кубик для пустых полей');
    await student.fill('#f-fabrikatitle', title);
    await student.click('#step-fabrika >> text=Замысел готов');
    await student.waitForSelector('#step-fabrika.done');
    await student.fill('#f-resheniyafeeling', 'Подловил соседа и засмеялись');
    await student.click('#step-resheniya .field:has(#f-resheniyahonesty) .cardopt >> nth=0');
    await student.click('#step-resheniya .field:has(#f-resheniyachoice) .cardopt >> nth=0');
    await student.click('#step-resheniya >> text=Решения приняты');
    await student.waitForSelector('#step-resheniya.done');
    const preview = (await student.textContent('#step-igra .preview-igra')).replace(/\s+/g, ' ');
    check(`Урок ${les.number}: ИГРА — промпт с названием и ${want.label}`, preview.includes(title) && want.re.test(preview), preview.slice(0, 140));
    await student.click('#step-igra button:has-text("Всё верно")');
    await student.waitForSelector('#step-igra.done');
    if (H.producer) await H.producer(student, les, mode);
    await student.click('#step-sborka >> text=⚙ Собрать игру');
    let own = await gameFrame(student, '/play/', 0);
    if (mode === 'mock') {
      const t = mock.last.newUser || '';
      check(`Задание Qwen урока ${les.number}: замысел и ${want.label}`, /# Замысел геймдизайнера/.test(t) && want.re.test(t), t.slice(0, 80));
      await own.evaluate(() => window.__lab.confirm());
      await student.waitForFunction(() => document.querySelectorAll('#step-sborka .ver').length >= 2, null, { timeout: 30000 });
      own = await gameFrame(student, '/play/', 0);
    } else if (demoCheck) check(`Демо-режим урока ${les.number}: игра ученика собрана`, await own.evaluate(demoCheck, title));
    await student.waitForSelector('#step-sborka.done', { timeout: 10000 });
    return own;
  }

  /* ---------------- урок 26 ---------------- */
  async function lesson26(mode, teacher, student, shot, { pj } = {}) {
    const les = lessons[26];
    const nick = await student.evaluate('S.me.nick');
    const code = await teacher.evaluate('T.code');
    await open(teacher, student, les);
    await donor(student, les, 'bomby-vo-dvore', async gf => {
      await gf.waitForFunction(() => window.__lab.cfg.vdvoem === 1, null, { timeout: 10000 }).catch(() => {}); // ручки шага приходят после «готова»
      const r = await gf.evaluate(() => { window.__lab.confirm(); const st = window.__lab.lab.state; return { duo: window.__lab.cfg.vdvoem, heroes: st.h.length, mode: st.mode, solo: st.solo }; });
      check('Донор урока 26: «Бомбы во дворе» вдвоём — два героя, дуэль', r.duo === 1 && r.heroes === 2 && r.mode === 0 && !r.solo, JSON.stringify(r));
    });
    await hunt(student, les, mode, 'bomby-vo-dvore', async gf => {
      const r = await gf.evaluate(() => { window.__lab.confirm(); const st = window.__lab.lab.state; return { solo: st.solo, wall: st.grid.some(c => c === 3) }; });
      check('Без спрятанной механики: каждый в своей половине двора, посередине стена', r.solo && r.wall, JSON.stringify(r));
      await gf.evaluate(() => window.__lab.restart());
    }, { 'ящиков': 6 });
    await motion(student, les, 'secret-story', shot);
    await variety(student, les, 'bomby-vo-dvore', [['vmeste', 'rezhim', 1], ['begun', 'rezhim', 2], ['bez-mesti', 'mest', 0], ['tesno', 'dvor', 1]], 'встреч', 7, 'tesno', 'Вместе', shot);
    await student.click('.cp >> text=Фабрика');
    await build(student, les, mode, 'Двое во дворе', { label: 'два игрока со своими кнопками', re: /Игрок 2/ }, t => GAME.title === t);

    // турнирная сетка: учитель собирает пару, ученик отмечает победителя, сетка у всех
    await student.click('.cp >> text=Играем вместе');
    await student.waitForSelector('#step-turnir .card, #step-turnir .m7-bracket', { timeout: 10000 });
    await tapi(teacher, '/api/teacher/bracket', { code, action: 'make', players: [nick, 'Соперник', 'Третий'] });
    await student.waitForSelector('#step-turnir .m7-bracket', { timeout: 10000 });
    const bye = await student.evaluate(() => Lab.api('/api/bracket').then(r => r.bracket.rounds[0].some(m => m.bye)));
    check('Сетка из трёх: один проходит без игры', bye);
    const mine = await student.locator('#step-turnir .m7-mymatch button').count();
    if (mine) {
      await student.click(`#step-turnir .m7-mymatch button:has-text("${nick}")`);
      await student.waitForSelector('#step-turnir.done', { timeout: 10000 });
      check('Турнир: победитель отмечен, сетка обновилась', await student.locator('#step-turnir .m7-seat.won').count() >= 2);
    } else check('Турнир: у ученика нет пары в первом круге — проходит дальше', true);
    if (shot) await shot(student, 'm7-26-turnir');
    await motion(student, les, 'set-story', null);

    // арена: без учителя — боты; загон — игра получает сеть; старт — забег по часам сервера; финиш — итоги и квота
    await student.click('#step-arena .veil button');
    const af = await gameFrame(student, 'arena-klassa', 0);
    await af.evaluate(() => window.__lab.confirm());
    await student.waitForFunction(() => /с ботами/.test((document.querySelector('#step-arena .m7-phase') || {}).textContent || ''), null, { timeout: 10000 });
    check('Арена закрыта: бег с ботами', !(await af.evaluate(() => window.__lab.lab.net.on)) && await af.evaluate(() => window.__lab.lab.state.bots.length > 0));
    await tapi(teacher, '/api/teacher/arena', { code, action: 'open' });
    await af.waitForFunction(() => window.__lab.lab.net.on && window.__lab.lab.net.room.phase === 'lobby', null, { timeout: 10000 });
    check('Загон: игра получила сеть класса', true);
    // второй игрок по API: его боб приходит в игру ученика
    const before = await af.evaluate(() => window.__lab.lab.net.now());
    await tapi(teacher, '/api/teacher/arena', { code, action: 'start' });
    await af.waitForFunction(() => window.__lab.lab.net.room.phase === 'run', null, { timeout: 10000 });
    // старт — по часам сервера через 3 с после команды учителя; меряем от команды, а не от «сейчас»: под нагрузкой отсчёт может уже кончиться
    const lead = await af.evaluate(b => (window.__lab.lab.net.room.start - b) / 1000, before);
    check('Старт по часам сервера: отсчёт 3 секунды', lead > 2.5 && lead < 4.5, String(lead));
    await af.waitForFunction(() => GAME.clock(window.__lab.lab).tau > 0.2, null, { timeout: 15000 });
    await af.evaluate(() => { const st = window.__lab.lab.state; Object.assign(st.me, { x: 0, y: 4.2, z: GAME.FIN_Z - 0.5, vx: 0, vz: 0, vy: 0 }); });
    await af.waitForFunction(() => window.__lab.lab.state.me.fin != null, null, { timeout: 10000 });
    await student.waitForSelector('#step-arena.done', { timeout: 15000 });
    const ar = await tapi(teacher, `/api/arena?code=${code}`);
    check('Финиш: сервер записал место, забег закрыт квотой', ar.results.length === 1 && ar.results[0].nick === nick && ar.phase === 'done', JSON.stringify({ r: ar.results, phase: ar.phase, quota: ar.quota, n: ar.n }));
    await student.waitForFunction(n => document.querySelector('#step-arena .m7-podium') && document.querySelector('#step-arena .m7-podium').textContent.includes(n), nick, { timeout: 10000 });
    // голос за правило и правило у игры
    await student.click('#step-arena .m7-rule:has-text("Луна")');
    await student.waitForFunction(() => { const r = document.querySelector('#step-arena .m7-rule.on'); return !!r && /1 голос/.test(r.textContent); }, null, { timeout: 10000 });
    check('Голос за правило: «Луна» — 1 голос', true);
    await tapi(teacher, '/api/teacher/arena', { code, action: 'rules', card: 'luna' });
    await tapi(teacher, '/api/teacher/arena', { code, action: 'open' });
    await af.waitForFunction(() => window.__lab.lab.state.R && window.__lab.lab.state.R.gravity === 8, null, { timeout: 10000 });
    check('Правило класса дошло до игры: притяжение 8 у всех', true);
    if (shot) await shot(student, 'm7-26-arena');
    // учитель: вкладка «Вместе» — пульт, карта забега и сетка; проектор — то же крупно
    await teacher.click('.tabs >> text=Вместе');
    await teacher.waitForSelector('#tab-m7 canvas.m7-map', { timeout: 10000 });
    check('Панель учителя: вкладка «Вместе» — пульт арены, карта, сетка', await teacher.locator('#tab-m7 .m7-bracket').count() === 1 && await teacher.locator('#tab-m7 button:has-text("Старт")').count() === 1);
    if (shot) await shot(teacher, 'm7-26-pult', true);
    if (pj) {
      await pj.click('.pj-tabs >> text=Вместе');
      await pj.waitForSelector('#pj-m7 canvas.m7-map', { timeout: 10000 });
      check('Проектор: вкладка «Вместе» — карта забега без кнопок', await pj.locator('#pj-m7 button:has-text("Старт")').count() === 0);
      if (shot) await shot(pj, 'm7-26-projector');
      await pj.click('.pj-tabs >> text=Урок');
    }
    await tapi(teacher, '/api/teacher/arena', { code, action: 'close' });
    await teacher.click('.tabs >> text=Урок');
    await final(student, les, 'друг с другом');
  }

  /* ---------------- урок 27: джем, встреча 1 ---------------- */
  async function lesson27(mode, teacher, student, shot, { base } = {}) {
    const les = lessons[27];
    const nick = await student.evaluate('S.me.nick');
    const code = await teacher.evaluate('T.code');
    await tapi(teacher, '/api/teacher/teams', { code, action: 'reset' });
    await open(teacher, student, les, '#step-vopros-uroka');
    await choice(student, 'vopros-uroka', 2);
    await motion(student, les, 'dzhem-story', shot);
    // команда и роль
    await student.click('.cp >> text=Команда и карточки');
    await student.waitForSelector('#step-komanda form input');
    await student.fill('#step-komanda form input', 'Нарты');
    await student.click('#step-komanda form button');
    await student.waitForSelector('#step-komanda.done', { timeout: 10000 });
    check('Команда создана: ученик — Режиссёр', /Режиссёр/.test(await student.textContent('#step-komanda .m7-member.me')));
    // второй участник по API: вступил в команду, получил роль
    const login = async n => (await (await fetch(base + '/api/login', { method: 'POST', headers: { 'content-type': 'application/json' }, body: JSON.stringify({ code, nick: n }) })).json()).token;
    const call = async (tok, p, b) => { const r = await fetch(base + p, { method: b ? 'POST' : 'GET', headers: { 'content-type': 'application/json', 'x-lab-token': tok }, body: b ? JSON.stringify(b) : undefined }); return r.json(); };
    const tok2 = await login('Бэла');
    const teams = await call(tok2, '/api/team');
    await call(tok2, '/api/team/join', { team: teams.teams.find(t => t.name === 'Нарты').id });
    await student.waitForFunction(() => /Бэла/.test((document.querySelector('#step-komanda') || {}).textContent || ''), null, { timeout: 10000 });
    check('Второй участник вступил — команда обновилась у первого вживую', /Мастер Qwen/.test(await student.textContent('#step-komanda')));
    // карточки джема: кубики, переброс, «Берём!» — карточки в Фабрике
    await student.click('#step-kartochki .m7-jamcard >> nth=0 >> text=🎲 Бросить');
    await student.waitForSelector('#step-kartochki .m7-jamcard.open >> nth=0', { timeout: 10000 });
    await student.click('#step-kartochki .m7-jamcard >> nth=1 >> text=🎲 Бросить');
    await student.waitForFunction(() => document.querySelectorAll('#step-kartochki .m7-jamcard.open').length === 2, null, { timeout: 10000 });
    await student.click('#step-kartochki >> text=↻ Переброс (1) >> nth=0');
    await student.waitForFunction(() => /Переброс \(0\)/.test((document.querySelector('#step-kartochki') || {}).textContent || ''), null, { timeout: 10000 });
    await student.click('#step-kartochki >> text=✓ Берём!');
    await student.waitForSelector('#step-kartochki.done', { timeout: 10000 });
    const me1 = await sapi(student, '/api/me');
    const fac = (me1.answers.fabrika || {}).value || {};
    check('Карточки джема ушли в Фабрику: донор и легенда', !!fac.donor && /:/.test(((fac.fields || {}).legenda || {}).text || ''), JSON.stringify(fac).slice(0, 120));
    if (shot) await shot(student, 'm7-27-kartochki');
    // мозговой штурм: 10 идей (две — от второго участника вживую), голос, «Берём» — идея становится твистом
    await student.click('.cp >> text=Мозговой штурм');
    await student.waitForSelector('#step-shturm input');
    const ideaReq = { sent: 0, done: 0, fail: [] };
    student.on('request', r => { if (r.url().includes('/api/team/idea') && !r.url().includes('vote')) ideaReq.sent++; });
    student.on('requestfinished', r => { if (r.url().includes('/api/team/idea') && !r.url().includes('vote')) ideaReq.done++; });
    student.on('requestfailed', r => { if (r.url().includes('/api/team/idea')) ideaReq.fail.push(r.failure() && r.failure().errorText); });
    for (let i = 1; i <= 8; i++) { await student.fill('#step-shturm input', `Идея ${i}: огонь гаснет, если стоять`); await student.press('#step-shturm input', 'Enter'); try { await student.waitForFunction(n => document.querySelectorAll('#step-shturm .m7-idea').length >= n, i, { timeout: 30000 }); } catch (e) { const dbg = await student.evaluate(() => ({ v: document.querySelector('#step-shturm input').value, toast: [...document.querySelectorAll('.toast')].map(t => t.textContent), act: document.activeElement && document.activeElement.outerHTML.slice(0, 80) })); const srv = await sapi(student, '/api/team'); console.log(`    · штурм: идея ${i} не появилась — поле ${JSON.stringify(dbg)}, на сервере идей ${srv.team && srv.team.ideas.length}, запросов ${JSON.stringify(ideaReq)}`); throw e; } }
    await call(tok2, '/api/team/idea', { text: 'А что если великан спит, пока тихо' });
    await call(tok2, '/api/team/idea', { text: 'А что если огонь несут вдвоём' });
    await student.waitForFunction(() => document.querySelectorAll('#step-shturm .m7-idea').length === 10, null, { timeout: 10000 });
    check('Штурм: идеи второго участника появились вживую', /великан спит/.test(await student.textContent('#step-shturm')));
    await student.click('#step-shturm .m7-idea:has-text("великан спит") button:has-text("👍")');
    await student.click('#step-shturm .m7-idea:has-text("великан спит") button:has-text("Берём")');
    await student.waitForSelector('#step-shturm.done', { timeout: 10000 });
    const me2 = await sapi(student, '/api/me');
    check('Выбранная идея — твист в Фабрике команды', /великан спит/.test((((me2.answers.fabrika || {}).value || {}).fields || {}).twist?.text || ''));
    if (shot) await shot(student, 'm7-27-shturm');
    // замысел команды и сборка: игра одна на команду
    await student.click('.cp >> text=Замысел и сборка');
    await student.waitForFunction(() => [...document.querySelectorAll('#step-fabrika textarea, #step-fabrika input')].some(e => /великан спит/.test(e.value)), null, { timeout: 10000 });
    await build(student, les, mode, 'Огонь нартов', { label: 'легенда и жанр', re: /легенд/i });
    const me3 = await call(tok2, '/api/me');
    const own = await sapi(student, '/api/me');
    check('Игра одна на команду: у второго участника та же игра и замысел', me3.game && own.game && me3.game.id === own.game.id && !!(me3.answers.fabrika || {}).done, `${me3.game && me3.game.id} / ${own.game && own.game.id}`);
    const arcade = await call(tok2, '/api/arcade');
    check('Аркада: игра команды — «моя» у второго участника и одна в списке', arcade.mine.some(c => c.id === own.game.id && c.team === 'Нарты') && arcade.games.filter(c => c.id === own.game.id).length === 1);
    const tt = await tapi(teacher, `/api/teacher/teams?code=${code}`);
    check('Учитель видит команду: двое, карточки, 10 идей, игра', tt.teams.length === 1 && tt.teams[0].members.length === 2 && tt.teams[0].ideas.length === 10 && !!tt.teams[0].gameId);
    await student.click('.cp >> text=Финал встречи');
    await student.click('#step-linza .lens-card');
    await student.waitForSelector('#step-linza.done');
    await choice(student, 'odna-igra', 1);
    return { tok2, call, gameId: own.game.id };
  }

  /* ---------------- урок 28: джем, встреча 2 ---------------- */
  async function lesson28(mode, teacher, student, shot, ctx, prev) {
    const les = lessons[28];
    await open(teacher, student, les, '#step-vopros-uroka');
    await choice(student, 'vopros-uroka', 3);
    await student.waitForSelector('#step-komanda.done', { timeout: 10000 });
    check('Урок 28: команда та же, что в уроке 27', /Нарты/.test(await student.textContent('#step-komanda')));
    const me = await sapi(student, '/api/me');
    if (prev) check('Урок 28: игра команды из урока 27 подхвачена', me.game && me.game.id === prev.gameId);
    await motion(student, les, 'nozhnicy', null);
    await choice(student, 'chto-rezhem', 2);
    await student.click('.cp >> text=Ретро');
    await motion(student, les, 'retro-story', shot);
    await choice(student, 'srabotalo', 0);
    await choice(student, 'meshalo', 3);
    await choice(student, 'pravilo', 3);
    await student.click('#step-linza .lens-card');
    await student.waitForSelector('#step-linza.done');
    await choice(student, 'vopros-uroka-2', 3);
    check('Уроки 27 и 28: по 180 минут, вопрос джема в начале и в конце', [27, 28].every(n => lessons[n].checkpoints.reduce((a, c) => a + c.minutes, 0) === 180) && !!les.question);
  }

  return { lesson26, lesson27, lesson28 };
};
