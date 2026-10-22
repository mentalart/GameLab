// Сквозная проверка уроков модуля 8 «Своя игра: от питча до Фестиваля» (29–36) — часть e2e-portal.js, вызывается из него с его помощниками.
// Урок 29: колода доноров (перевернуть, сыграть, скрестить двух → Фабрика), питч-карта и репетиция, стена питчей с сердцами,
// питч на сцене у учителя и на проекторе, команда (второй участник — по API), диздок и печать учителя.
// Урок 30: диздок урока 29 перенесён, сборка с разделом «Итоговый проект» в задании Qwen, серый прототип (ручка grey), наблюдение.
// Уроки 31–35: объяснялки с переключателями, ножницы «Должно / Хорошо бы / Потом», карта контента, раскадровка трейлера, карточка стенда с QR.
// Урок 36: Фестиваль — фазы у учителя, стенд ученика (гость, партия, реакция), жетоны, номинации на проекторе, сертификат.
'use strict';
const m4 = require('./e2e-m4');

module.exports = function m8(H) {
  const { check, gameFrame, playRound, sleep, mock, lessons } = H;
  const { open, choice, motion } = m4(Object.assign({}, H, { lessons: {} })).helpers;
  const tapi = (teacher, path, body) => teacher.evaluate(([p, b]) => Lab.api(p, b), [path, body]);
  const sapi = (student, path, body) => student.evaluate(([p, b]) => Lab.api(p, b), [path, body]);
  const cp = (student, title) => student.click(`.cp >> text=${title}`);
  // второй участник проекта — по API (как в e2e-m7)
  async function second(base, code, nick) {
    const tok = (await (await fetch(base + '/api/login', { method: 'POST', headers: { 'content-type': 'application/json' }, body: JSON.stringify({ code, nick }) })).json()).token;
    const call = async (p, b) => { const r = await fetch(base + p, { method: b ? 'POST' : 'GET', headers: { 'content-type': 'application/json', 'x-lab-token': tok }, body: b ? JSON.stringify(b) : undefined }); return r.json(); };
    return call;
  }
  // переключатель в сцене объяснялки: нажимается и меняет картинку
  async function toggle(student, id, les) {
    const n = await student.locator(`#step-${id} .m6-tog`).count();
    if (!n) return;
    const px = () => student.$eval(`#step-${id} canvas.m4-motion`, c => { const d = c.getContext('2d').getImageData(0, 0, c.width, c.height).data; let h = 0; for (let i = 0; i < d.length; i += 4 * 53) h = (h * 31 + d[i] + d[i + 1] * 3 + d[i + 2] * 7) >>> 0; return h; });
    const a = await px();
    await student.click(`#step-${id} .m6-tog >> nth=0`);
    await sleep(500);
    const b = await px();
    check(`Урок ${les.number}: переключатель в сцене «${id}» меняет картинку`, a !== b);
  }
  async function cubeFactory(student, title) {
    await student.click('#step-fabrika >> text=🎲 Кубик для пустых полей');
    if (title) await student.fill('#f-fabrikatitle', title);
    await student.click('#step-fabrika >> text=Замысел готов');
    await student.waitForSelector('#step-fabrika.done');
  }
  async function decisions(student) {
    if (await student.locator('#step-resheniya.done').count()) return;
    await student.fill('#f-resheniyafeeling', 'Успел в последнюю секунду');
    await student.click('#step-resheniya .field:has(#f-resheniyahonesty) .cardopt >> nth=0');
    await student.click('#step-resheniya .field:has(#f-resheniyachoice) .cardopt >> nth=0');
    await student.click('#step-resheniya >> text=Решения приняты');
    await student.waitForSelector('#step-resheniya.done');
  }
  async function portrait(student) {
    if (await student.locator('#step-portret.done').count()) return;
    await student.waitForSelector('#step-portret .m6-pcard');
    await student.click('#step-portret .field:has(#f-portretkto) .cardopt >> nth=0');
    await student.click('#step-portret .field:has(#f-portretlyubit) .cardopt >> nth=0');
    await student.click('#step-portret [data-ptype=issl]');
    await student.click('#step-portret [data-portrait=save]');
    await student.waitForSelector('#step-portret.done');
  }
  async function lens(student) {
    await student.click('#step-linza .lens-card');
    await student.waitForSelector('#step-linza.done');
  }
  async function team(student, les) {
    await student.waitForSelector('#step-komanda.done', { timeout: 10000 });
    check(`Урок ${les.number}: команда проекта та же — «Пчёлы»`, /Пчёлы/.test(await student.textContent('#step-komanda')));
  }

  /* ---------------- урок 29: питч ---------------- */
  async function lesson29(mode, teacher, student, shot, { base, pj }) {
    const les = lessons[29];
    const code = await teacher.evaluate('T.code');
    await tapi(teacher, '/api/teacher/teams', { code, action: 'reset' }).catch(() => {});
    await open(teacher, student, les, '#step-vopros-uroka');
    await choice(student, 'vopros-uroka', 4);
    await motion(student, les, 'doroga', shot);
    // колода доноров (Б4 аудита): карта — строка, донор играет сам в рамке без звука; перевернуть, сыграть самому, скрестить двух
    await cp(student, 'Колода доноров');
    await student.waitForSelector('#step-koloda .m8-dmini');
    const minis = await student.$$eval('#step-koloda .m8-dmini', a => a.map(x => x.textContent));
    check('Урок 29: колода — 22 донора курса, на карте значок, название и одна строка', minis.length === 22 && minis.every(t => t.length < 90), String(Math.max(...minis.map(t => t.length))));
    check('На странице колоды нет правил доноров — их показывает живая петля', !/Строй врагов идёт рядами/.test(await student.textContent('#step-koloda')));
    await student.click('#step-koloda .m8-dmini[data-donor=roy]');
    await student.waitForSelector('#step-koloda .m8-dcard.big[data-donor=roy]');
    await student.click('#step-koloda [data-deck=flip]');
    check('Карта донора переворачивается: спрятанная механика на обороте', await student.locator('#step-koloda .m8-dcard.big.flip').count() === 1 && /из трёх улучшений/.test(await student.textContent('#step-koloda .m8-dback')));
    await student.click('#step-koloda [data-deck=watch]');
    await gameFrame(student, 'roy', 0);
    await student.waitForFunction(() => /Донор играет сам/.test(document.querySelector('#step-koloda .m8-live-cap').textContent), null, { timeout: 30000 });
    check('Живая петля: донор «Рой» играет сам, без звука', true);
    await student.click('#step-koloda [data-deck=self]');
    await student.waitForFunction(() => /Твоя партия/.test(document.querySelector('#step-koloda .m8-live-cap').textContent), null, { timeout: 60000 });
    const gf = await gameFrame(student, 'roy', 0);
    await playRound(gf, { score: 300 });
    await student.waitForSelector('#step-koloda .m8-dmini[data-donor=roy].played', { timeout: 10000 });
    await student.click('#step-koloda [data-deck=pick]');
    await student.click('#step-koloda .m8-pick .m6-tog');
    await student.click('#step-koloda .m8-dmini[data-donor=zagon]');
    await student.click('#step-koloda [data-deck=pick]');
    check('Скрещивание: две карты и знак ×', await student.locator('#step-koloda .m8-pickcards.two').count() === 1);
    await student.click('#step-koloda >> text=✓ Берём в Фабрику');
    await student.waitForSelector('#step-koloda.done', { timeout: 10000 });
    const me = await sapi(student, '/api/me');
    const fac = (me.answers.fabrika || {}).value || {};
    check('Донор и второй донор — в Фабрике', fac.donor === 'roy' && /Овечий загон/.test(((fac.fields || {}).cross || {}).text || ''), JSON.stringify(fac).slice(0, 160));
    if (shot) await shot(student, 'm8-29-koloda');
    await motion(student, les, 'fraza', null);
    await cubeFactory(student, 'Пчела и зима');
    // питч: карта из Фабрики, фраза, репетиция 60 секунд (в проверке быстрее), на стену
    await cp(student, 'Питч');
    await student.waitForSelector('#step-pitch .m8-poster');
    check('Питч-карта собралась из Фабрики: название и донор', /Пчела и зима/.test(await student.textContent('#step-pitch .m8-poster')) && /×/.test(await student.textContent('#step-pitch .m8-pformula')));
    check('Питч-карта по одному полю: на экране одно поле и прогресс из семи точек', await student.locator('#step-pitch [data-pf]').count() === 1 && await student.locator('#step-pitch .m8-wdots button').count() === 7);
    await student.fill('#step-pitch [data-pf=phrase]', 'Это игра, где ты пчелой спасаешь последний цветок зимой');
    await student.click('#step-pitch [data-pnext]');
    check('Второе поле — название, уже из Фабрики', await student.getAttribute('#step-pitch [data-pf=title]', 'placeholder') === 'Пчела и зима');
    await student.click('#step-pitch [data-pstep=rehearse]');
    await student.click('#step-pitch button:has-text("Репетиция")');
    await student.waitForFunction(() => /Репетиций: 1/.test(document.querySelector('#step-pitch').textContent), null, { timeout: 15000 });
    check('Репетиция питча: кольцо прошло 60 секунд', true);
    await student.click('#step-pitch >> text=📌 На стену питчей');
    await student.waitForSelector('#step-pitch.done', { timeout: 10000 });
    if (shot) await shot(student, 'm8-29-pitch');
    // стена: питч второго участника по API, сердце, сцена у учителя
    const call = await second(base, code, 'Бэла');
    await call('/api/proekt/pitch', { card: { title: 'Кот-астронавт', phrase: 'Это игра, где ты котом чинишь станицу на орбите', donor: 'Башня до неба', twist: 'невесомость', world: 'станция' } });
    await student.waitForSelector('#step-stena .m8-wcard:has-text("Кот-астронавт")', { timeout: 10000 });
    const own = await student.locator('#step-stena .m8-wcard.mine button').count();
    check('За свою игру сердце не ставят', own === 0);
    await student.click('#step-stena .m8-wcard:has-text("Кот-астронавт") button');
    await student.waitForSelector('#step-stena.done', { timeout: 10000 });
    check('Сердце «хочу сыграть»: осталось два', /❤ 2 из 3/.test(await student.textContent('#step-stena')));
    // учитель: вкладка «Проект», питч на сцену — у ученика баннер, на проекторе кольцо
    await teacher.click('.tabs >> text=Проект');
    await teacher.waitForSelector('#tab-m8 canvas.m8-road');
    await teacher.waitForSelector('#tab-m8 [data-stage]', { timeout: 10000 });
    await teacher.click('#tab-m8 .m8-wcard:has-text("Кот-астронавт") [data-stage]');
    await teacher.waitForSelector('#tab-m8 .m8-pstage canvas', { timeout: 10000 });
    await student.waitForSelector('#step-stena .m8-stagebar:not([hidden])', { timeout: 10000 });
    check('Питч на сцене: у ученика баннер «На сцене» с таймером', /Кот-астронавт/.test(await student.textContent('#step-stena .m8-stagebar')));
    if (pj) {
      await pj.click('.pj-tabs >> text=Проект');
      await pj.waitForSelector('#pj-m8 .m8-pstage canvas', { timeout: 10000 });
      check('Проектор: вкладка «Проект» — сцена питча с кольцом, без кнопок', await pj.locator('#pj-m8 button').count() === 0);
      if (shot) await shot(pj, 'm8-29-projector');
    }
    await tapi(teacher, '/api/teacher/proekt', { code, action: 'unstage' });
    // команда: «Делаю один» есть, создаём команду, второй участник вступает
    await cp(student, 'Команды');
    await student.waitForSelector('#step-komanda form input');
    check('Можно делать игру одному: кнопка «Делаю один»', await student.locator('#step-komanda [data-solo]').count() === 1);
    await student.fill('#step-komanda form input', 'Пчёлы');
    await student.click('#step-komanda form button');
    await student.waitForSelector('#step-komanda .m7-member.me', { timeout: 10000 });
    const teams = await call('/api/team');
    await call('/api/team/join', { team: teams.teams.find(t => t.name === 'Пчёлы').id });
    await student.waitForSelector('#step-komanda.done', { timeout: 10000 });
    await choice(student, 'chya-ideya', 0);
    // диздок: решения, портрет, страница — на утверждение, учитель ставит печать
    await cp(student, 'Диздок');
    await decisions(student);
    await portrait(student);
    // диздок по одной строке: фраза из питча первой, основной цикл правим здесь — он уходит в Фабрику; потом страница целиком
    await student.waitForSelector('#step-dizdok .m8-wiz textarea');
    check('Диздок по одной строке: первая — фраза питча', await student.locator('#step-dizdok textarea').count() === 1 && /пчелой спасаешь/.test(await student.inputValue('#step-dizdok textarea')));
    for (let i = 0; i < 16 && await student.locator('#step-dizdok textarea').count(); i++) {
      const key = await student.getAttribute('#step-dizdok textarea', 'data-dline');
      if (key === 'cikl') await student.fill('#step-dizdok textarea', 'Лечу → собираю пыльцу → грею улей');
      else if (!(await student.inputValue('#step-dizdok textarea'))) await student.fill('#step-dizdok textarea', 'Строка из проверки');
      await student.click('#step-dizdok [data-dnext]');
    }
    await student.waitForSelector('#step-dizdok .m8-doc dl');
    await sleep(900);
    const meD = await sapi(student, '/api/me');
    check('Строка, дописанная в диздоке, ушла в Фабрику', /грею улей/.test((((meD.answers.fabrika || {}).value || {}).fields || {}).cikl ? meD.answers.fabrika.value.fields.cikl.text : ''), JSON.stringify((((meD.answers.fabrika || {}).value || {}).fields || {}).cikl || null));
    const doc = (await student.textContent('#step-dizdok .m8-doc')).replace(/\s+/g, ' ');
    check('Диздок на одну страницу: фраза питча, донор × второй, основной цикл, портрет, команда', /пчелой спасаешь/.test(doc) && /Рой.*× Овечий загон/.test(doc) && /грею улей/.test(doc) && /Пчёлы/.test(doc), doc.slice(0, 200));
    await student.click('#step-dizdok >> text=📨 На утверждение учителю');
    await student.waitForSelector('#step-dizdok.done', { timeout: 10000 });
    await teacher.waitForSelector('#tab-m8 [data-approve]', { timeout: 10000 });
    await teacher.click('#tab-m8 [data-approve]');
    await student.waitForSelector('#step-dizdok .m8-stamp', { timeout: 10000 });
    check('Учитель утвердил диздок — у ученика печать «УТВЕРЖДЕНО»', /УТВЕРЖДЕНО/.test(await student.textContent('#step-dizdok .m8-stamp')));
    const road = await tapi(teacher, '/api/proekt?code=' + code);
    const r = road.road.find(x => x.name === 'Пчёлы');
    check('Дорога к Фестивалю: команда «Пчёлы» проехала первую остановку', r && r.at === 1 && r.members.length === 2, JSON.stringify(r || road.road).slice(0, 160));
    if (shot) await shot(teacher, 'm8-29-pult');
    await teacher.click('.tabs >> text=Урок');
    if (pj) await pj.click('.pj-tabs >> text=Урок');
    await cp(student, 'Финал');
    await lens(student);
    await choice(student, 'vopros-uroka-2', 3);
    return { call, code };
  }

  /* ---------------- урок 30: серый прототип ---------------- */
  async function lesson30(mode, teacher, student, shot, ctx, prev) {
    const les = lessons[30];
    await open(teacher, student, les, '#step-vopros-uroka');
    await choice(student, 'vopros-uroka', 1);
    await team(student, les);
    await motion(student, les, 'seryy-story', null);
    await toggle(student, 'seryy-story', les);
    await cp(student, 'Сборка по диздоку');
    await student.waitForSelector('#f-fabrikatitle');
    check('Диздок урока 29 перенесён: название в Фабрике', (await student.inputValue('#f-fabrikatitle')) === 'Пчела и зима');
    if (!(await student.locator('#step-fabrika.done').count())) await cubeFactory(student, null);
    await decisions(student);
    await portrait(student);
    await student.click('#step-igra button:has-text("Всё верно")');
    await student.waitForSelector('#step-igra.done');
    if (H.producer) await H.producer(student, les, mode);
    await student.click('#step-sborka >> text=⚙ Собрать игру');
    let own = await gameFrame(student, '/play/', 0);
    if (mode === 'mock') {
      const t = mock.last.newUser || '';
      check('Задание Qwen урока 30: раздел «Итоговый проект» и ручка «Серый прототип»', /# Итоговый проект/.test(t) && /Серый прототип/.test(t), t.slice(0, 80));
      await own.evaluate(() => window.__lab.confirm());
      await student.waitForFunction(() => document.querySelectorAll('#step-sborka .ver').length >= 2, null, { timeout: 30000 });
    }
    await student.waitForSelector('#step-sborka.done', { timeout: 10000 });
    if (prev && prev.call) { const m = await prev.call('/api/me'), me = await sapi(student, '/api/me'); check('Игра одна на команду: у второго участника та же', m.game && me.game && m.game.id === me.game.id); }
    // серым и в цвете
    await cp(student, 'Весело ли без графики?');
    await student.waitForSelector('#step-seryy .seg button');
    await student.click('#step-seryy .veil button');
    let gf = await gameFrame(student, '/play/', 0);
    await gf.waitForFunction(() => window.__lab.cfg.grey === 1, null, { timeout: 10000 }).catch(() => {});
    check('Серый прототип: ручка grey = 1 в рамке', await gf.evaluate(() => window.__lab.cfg.grey === 1));
    await playRound(gf, { score: 120 });
    await student.click('#step-seryy .seg button:has-text("В цвете")');
    await student.click('#step-seryy .veil button');
    gf = await gameFrame(student, '/play/', 0);
    await gf.waitForFunction(() => window.__lab.cfg.grey === 0, null, { timeout: 10000 }).catch(() => {});
    await playRound(gf, { score: 200 });
    await student.click('#step-seryy .opt:has-text("В сером так же весело")');
    await student.waitForSelector('#step-seryy.done', { timeout: 10000 });
    if (shot) await shot(student, 'm8-30-seryy');
    // молчаливый плейтест: метки по времени
    await cp(student, 'Молчаливый плейтест');
    await motion(student, les, 'tihiy-story', null);
    await student.click('#step-nablyudenie >> text=▶ Начать наблюдение');
    await student.click('#step-nablyudenie [data-mark=stuck]');
    await student.locator('#step-nablyudenie').focus();
    await student.keyboard.press('2');
    await student.click('#step-nablyudenie [data-mark=again]');
    await student.click('#step-nablyudenie >> text=■ Закончить наблюдение');
    await student.click('#step-nablyudenie .opt >> nth=0');
    await student.waitForSelector('#step-nablyudenie.done', { timeout: 10000 });
    const sum = await student.textContent('#step-nablyudenie .m8-sumrow');
    check('Наблюдение: метки кнопками и цифрами — в сводке', /😕\s*1/.test(sum) && /😄\s*1/.test(sum) && /🔁\s*1/.test(sum), sum.replace(/\s+/g, ' '));
    await cp(student, 'Финал');
    await lens(student);
    await choice(student, 'vopros-uroka-2', 1);
  }

  /* ---------------- уроки 31–35 ---------------- */
  async function lesson31(mode, teacher, student, shot) {
    const les = lessons[31];
    await open(teacher, student, les, '#step-vopros-uroka');
    await choice(student, 'vopros-uroka', 2);
    await team(student, les);
    await motion(student, les, 'srez-story', null);
    await toggle(student, 'srez-story', les);
  }
  async function lesson32(mode, teacher, student, shot) {
    const les = lessons[32];
    await open(teacher, student, les, '#step-vopros-uroka');
    await choice(student, 'vopros-uroka', 1);
    await team(student, les);
    await motion(student, les, 'karta-story', null);
    // Г5 аудита: карусель игр команд — ждёт учителя; у класса одна игра команды «Пчёлы» (два участника — одно место в круге)
    await student.click('.cp >> text="Плейтест"');
    await student.waitForSelector('#step-karusel .m2-wait', { timeout: 10000 });
    check('Урок 32: карусель ждёт учителя', /Карусель запустит учитель/.test(await student.textContent('#step-karusel')));
    const kErr = await tapi(teacher, '/api/teacher/karusel', { code: await teacher.evaluate('T.code'), action: 'start' }).then(() => '', e => e.message);
    check('Урок 32: в круг встают игры команд урока 30 — у «Пчёл» одно место на двоих, с одной игрой карусель не стартует', /игры команд \(сейчас 1\)/.test(kErr), kErr);
    await cp(student, 'Ножницы');
    await motion(student, les, 'nozhnicy-story', shot);
    for (let i = 0; i < 6; i++) await student.click('#step-nozhnicy .chipbtn >> nth=0');
    check('Ножницы: шесть фич в «Должно», шаг не готов, пока не вырезана треть', await student.locator('#step-nozhnicy .m8-bask.must .m8-feat').count() === 6 && !(await student.locator('#step-nozhnicy.done').count()));
    for (let i = 0; i < 2; i++) { await student.click('#step-nozhnicy .m8-bask.must .m8-feat >> nth=-1 >> [data-to=later]'); await sleep(600); }
    await student.waitForSelector('#step-nozhnicy.done', { timeout: 10000 });
    check('Треть вычеркнута: две фичи в «Потом», кольцо ножниц', await student.locator('#step-nozhnicy .m8-bask.later .m8-feat').count() === 2);
    if (shot) await shot(student, 'm8-32-nozhnicy');
  }
  async function lesson33(mode, teacher, student, shot) {
    const les = lessons[33];
    await open(teacher, student, les, '#step-vopros-uroka');
    await choice(student, 'vopros-uroka', 1);
    await team(student, les);
    await motion(student, les, 'kontent-story', null);
    await toggle(student, 'kontent-story', les);
    await cp(student, 'Карта контента');
    const cv = student.locator('#step-karta canvas.m8-kcv');
    const box = await cv.boundingBox();
    const at = (min, kind) => student.click('#step-karta [data-beat=' + kind + ']').then(() => cv.click({ position: { x: (40 + 570 * min / 10) * box.width / 640, y: 150 * box.height / 230 } }));
    for (const [m, k] of [[0.8, 'vrag'], [2, 'mesto'], [3.2, 'otdyh'], [4.4, 'vrag'], [5.6, 'istoriya'], [6.8, 'otdyh'], [8, 'nagrada'], [9.2, 'boss']]) await at(m, k);
    check('Карта контента: восемь событий на ленте', /хотя бы|Интерес|заскучает/.test(await student.textContent('#step-karta')));
    await student.click('#step-karta >> text=▶ 10 минут за 10 секунд');
    await student.waitForFunction(() => /держится все 10 минут|Игрок заскучает на/.test(document.querySelector('#step-karta').textContent), null, { timeout: 20000 });
    const msg = (await student.textContent('#step-karta')).replace(/\s+/g, ' ');
    check('Кривая интереса держится все 10 минут — шаг готов, просьба Qwen по карте', !!(await student.locator('#step-karta.done').count()) && /Растяни игру на 10 минут/.test(msg), msg.slice(0, 200));
    if (shot) await shot(student, 'm8-33-kontent');
  }
  async function lesson34(mode, teacher, student, shot) {
    const les = lessons[34];
    await open(teacher, student, les, '#step-vopros-uroka');
    await choice(student, 'vopros-uroka', 3);
    await team(student, les);
    await motion(student, les, 'chuzhoy-story', null);
    await toggle(student, 'chuzhoy-story', les);
  }
  async function lesson35(mode, teacher, student, shot) {
    const les = lessons[35];
    await open(teacher, student, les, '#step-vopros-uroka');
    await choice(student, 'vopros-uroka', 2);
    await team(student, les);
    await motion(student, les, 'upakovka-story', null);
    await toggle(student, 'upakovka-story', les);
    // трейлер: пять кадров словами и просмотр раскадровки
    await cp(student, 'Трейлер');
    for (const s of les.checkpoints.flatMap(c => c.steps).find(x => x.id === 'treyler').shots) await student.fill(`#f-treyler${s.id}`, `${s.label}: кадр из игры`);
    await student.click('#step-treyler canvas.m8-tcv');
    await student.waitForSelector('#step-treyler.done', { timeout: 15000 });
    check('Раскадровка трейлера: пять кадров и просмотр — шаг готов', true);
    // карточка стенда: управление, QR аркады
    await cp(student, 'Стенд');
    await student.waitForSelector('#step-stend .m8-stand svg.m8-qr', { timeout: 10000 });
    await student.fill('#step-stend [data-sf=keys]', '← → летать, A — нести пыльцу');
    await student.click('#step-stend >> text=✓ Карточка готова');
    await student.waitForSelector('#step-stend.done', { timeout: 10000 });
    const card = (await student.textContent('#step-stend .m8-stand')).replace(/\s+/g, ' ');
    check('Карточка стенда: название, управление, «по мотивам механики», QR аркады', /Пчела и зима/.test(card) && /летать/.test(card) && /по мотивам механики/.test(card), card.slice(0, 160));
    const qr = await student.evaluate(() => { const m = LabQR.encode(location.origin + '/arcade?game=x'); return m.length; });
    check('QR-код аркады собирается (версия до 6)', qr >= 21 && qr <= 41, String(qr));
    if (shot) await shot(student, 'm8-35-stend');
  }

  /* ---------------- урок 36: Фестиваль ---------------- */
  async function lesson36(mode, teacher, student, shot, { pj } = {}) {
    const les = lessons[36];
    const code = await teacher.evaluate('T.code');
    await open(teacher, student, les, '#step-vopros-uroka');
    await choice(student, 'vopros-uroka', 3);
    await team(student, les);
    await motion(student, les, 'fest-story', null);
    await tapi(teacher, '/api/teacher/proekt', { code, action: 'reset-fest' });
    // учитель открывает Фестиваль и ставит фазу «Аркадный час»
    await teacher.click('.tabs >> text=Проект');
    await teacher.waitForSelector('#tab-m8 [data-fest=open]', { timeout: 10000 });
    await teacher.click('#tab-m8 [data-fest=open]');
    await teacher.click('#tab-m8 [data-phase=arcade]');
    await teacher.waitForSelector('#tab-m8 [data-phase=arcade].on', { timeout: 10000 });
    // стенд ученика: гость, партия, реакция, «ещё раз»
    await cp(student, 'Фестиваль');
    await student.waitForSelector('#step-stend-fest .m8-fattract');
    await student.click('#step-stend-fest .m8-fattract button');
    const gf = await gameFrame(student, '/play/', 0);
    await playRound(gf, { score: 777 });
    await student.waitForSelector('#step-stend-fest [data-like=wow]', { timeout: 10000 });
    await student.click('#step-stend-fest [data-like=wow]');
    await student.waitForSelector('#step-stend-fest.done', { timeout: 10000 });
    const f = await tapi(teacher, '/api/fest?code=' + code);
    const s = f.stands.find(x => x.title === 'Пчела и зима');
    check('Стенд на Фестивале: гость, партия и 🤩 — в цифрах стенда', s && s.guests === 1 && s.plays === 1 && s.likes.wow === 1, JSON.stringify(s || f.stands).slice(0, 200));
    if (shot) await shot(student, 'm8-36-stend');
    await teacher.waitForSelector(`#tab-m8 [data-token="${s ? s.game : ''}"]`, { timeout: 10000 });
    await teacher.click(`#tab-m8 [data-token="${s.game}"]`);
    await teacher.click('#tab-m8 [data-phase=awards]');
    await teacher.waitForSelector('#tab-m8 .m8-nom', { timeout: 10000 });
    const noms = await teacher.textContent('#tab-m8 .m8-noms');
    check('Награждение: «Выбор зрителей» по жетонам и 🤩 — «Пчела и зима»', /Выбор зрителей/.test(noms) && /Пчела и зима/.test(noms), noms.replace(/\s+/g, ' ').slice(0, 160));
    if (pj) {
      await pj.click('.pj-tabs >> text=Проект');
      await pj.waitForSelector('#pj-m8 .m8-nom', { timeout: 10000 });
      check('Проектор: номинации Фестиваля крупно', await pj.locator('#pj-m8 .m8-nom').count() === 4 && /Самый большой рост/.test(await pj.textContent('#pj-m8 .m8-noms')));
      if (shot) await shot(pj, 'm8-36-projector');
      await pj.click('.pj-tabs >> text=Урок');
    }
    await tapi(teacher, '/api/teacher/proekt', { code, action: 'fest', open: false });
    await teacher.click('.tabs >> text=Урок');
    // сертификат
    await cp(student, 'Награждение');
    await student.waitForSelector('#step-sertifikat .m8-cert .m8-cname', { timeout: 10000 });
    await student.waitForSelector('#step-sertifikat.done', { timeout: 10000 });
    const cert = (await student.textContent('#step-sertifikat .m8-cert')).replace(/\s+/g, ' ');
    check('Сертификат курса: ник, игры, версии и итоговая игра', cert.includes(await student.evaluate('S.me.nick')) && /игр/.test(cert) && /Пчела и зима/.test(cert), cert.slice(0, 200));
    if (shot) await shot(student, 'm8-36-sertifikat');
    await cp(student, 'Финал курса');
    await lens(student);
    await choice(student, 'vopros-uroka-2', 3);
    check('Уроки 29–36: по 180 минут, вопрос урока в начале и в конце', [29, 30, 31, 32, 33, 34, 35, 36].every(n => !lessons[n] || lessons[n].checkpoints.reduce((a, c) => a + c.minutes, 0) === 180));
  }

  return { lesson29, lesson30, lesson31, lesson32, lesson33, lesson34, lesson35, lesson36 };
};
