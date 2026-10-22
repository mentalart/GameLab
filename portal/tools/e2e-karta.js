#!/usr/bin/env node
// Сквозная проверка сессии 8 аудита уроков (22.10.2026): карта курса «36 комнат» (Д1) и лучший момент игры роликом GIF (Д4).
//   Д1 — /karta: 8 этажей, 36 комнат, пройденные светятся, сегодняшняя — «сейчас», в комнате игра, донор и линза; на телефоне
//        без прокрутки вбок; та же карта мельче на экране «Ждём учителя»; шаг karta в финале урока 36 (выбор своей комнаты).
//   Д4 — игра-страница из чата (мост portal.js + engine/moment.js, WebGL): «🎬 Момент» → GIF с живыми кадрами; рекорд чужого игрока
//        сам сохраняет ролик; лучший момент на обложке аркады, 📌 в студии, ролик в кадре раскадровки трейлера урока 35;
//        игра в оболочке Лаб3D: ролик и нагрузка при LAB_LOWRES — запись не роняет кадры в секунду.
// Запуск: node portal/tools/e2e-karta.js [--headed]. Данные — во временной папке, снимки — portal/.check/karta-*.png.
'use strict';
const fs = require('fs');
const os = require('os');
const path = require('path');

const TMP = fs.mkdtempSync(path.join(os.tmpdir(), 'lab-karta-'));
process.env.LAB_DATA = path.join(TMP, 'data');
process.env.LAB_CONFIG = path.join(TMP, 'config.json');
const OUT = path.resolve(__dirname, '..', '.check');
fs.mkdirSync(OUT, { recursive: true });

const { chromium } = require('playwright');
const ai = require('../lib/ai');
const store = require('../lib/store');
const portal = require('../server');

const PASSWORD = 'e2e-karta';
const results = [];
const check = (what, ok, detail = '') => { results.push({ what, ok: !!ok }); console.log(`  ${ok ? '✓' : '✗'} ${what}${detail ? ' — ' + detail : ''}`); };
const sleep = ms => new Promise(r => setTimeout(r, ms));
// игра-страница из чата Qwen: WebGL-холст, цвет которого меняется каждый кадр (по нему видно, что ролик живой), конец партии по вызову
const GL_GAME = title => `<!doctype html><html><head><title>${title}</title></head><body style="margin:0;background:#000">
<canvas id="c" width="480" height="270" style="width:100vw;height:100vh;display:block"></canvas>
<script>
portal.knobs({ speed: { value: 1, min: 0, max: 2, label: 'Скорость' } });
const gl = document.getElementById('c').getContext('webgl');
const sh = (t, s) => { const x = gl.createShader(t); gl.shaderSource(x, s); gl.compileShader(x); return x; };
const pr = gl.createProgram();
gl.attachShader(pr, sh(gl.VERTEX_SHADER, 'attribute vec2 p; void main(){ gl_Position = vec4(p, 0.0, 1.0); }'));
gl.attachShader(pr, sh(gl.FRAGMENT_SHADER, 'precision mediump float; uniform vec3 c; void main(){ gl_FragColor = vec4(c, 1.0); }'));
gl.linkProgram(pr); gl.useProgram(pr);
gl.bindBuffer(gl.ARRAY_BUFFER, gl.createBuffer());
gl.bufferData(gl.ARRAY_BUFFER, new Float32Array([-0.6, -0.6, 0.6, -0.6, 0, 0.7]), gl.STATIC_DRAW);
gl.enableVertexAttribArray(0); gl.vertexAttribPointer(0, 2, gl.FLOAT, false, 0, 0);
const u = gl.getUniformLocation(pr, 'c'), t0 = performance.now();
(function loop(t) {
  const k = (t - t0) / 1000;
  gl.clearColor(0.2 + 0.2 * Math.sin(k * 2), 0.35, 0.75, 1); gl.clear(gl.COLOR_BUFFER_BIT);
  gl.uniform3f(u, 1, 0.75 + 0.25 * Math.sin(k * 5), 0.2); gl.drawArrays(gl.TRIANGLES, 0, 3);
  portal.score(Math.floor(k * 10)); requestAnimationFrame(loop);
})(t0);
window.__end = s => portal.over(s);
</script></body></html>`;

function setup() {
  fs.writeFileSync(process.env.LAB_CONFIG, JSON.stringify({ port: 0, teacherPassword: PASSWORD, ai: { apiKey: '' }, models: [], limits: { aiCallsPerStudentPerLesson: 40, rublesPerLesson: 0 } }));
  ai.reloadConfig();
  const cls = store.createClass({ name: 'Проверка карты', lesson: 'urok-03' });
  const games = {};
  const s = store.ensureStudent(cls.code, 'Аня');
  // урок 1 — игра-страница из чата, урок 2 — игра в оболочке Лаб3D (код донора «Каменный стакан»)
  const add = (lessonId, title, code, kind) => {
    const g = store.createGame({ class: cls.code, nick: 'Аня', lesson: lessonId, title });
    store.addVersion(g, code, { kind: 'сборка' });
    const st = store.lessonState(s, lessonId); st.gameId = g.id; st.answers['x'] = { value: {}, done: true, at: store.now() };
    games[kind] = g;
  };
  add('urok-01', 'Пасека под огнём', GL_GAME('Пасека под огнём'), 'html');
  add('urok-02', 'Каменная башня', fs.readFileSync(path.join(__dirname, '..', 'games', 'kamennyi-stakan.js'), 'utf8'), 'lab');
  // урок 35 и 36 — та же игра-страница: раскадровка трейлера и карта в финале курса
  for (const id of ['urok-35', 'urok-36']) store.lessonState(s, id).gameId = games.html.id;
  store.saveStudent(cls.code, s);
  store.ensureStudent(cls.code, 'Боря');
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
async function frameOf(page, part, ms = 60000) {
  const t0 = Date.now();
  while (Date.now() - t0 < ms) { const f = page.frames().find(x => x.url().includes(part)); if (f) return f; await sleep(250); }
  throw new Error('нет рамки ' + part);
}
async function until(fn, ms = 20000, step = 300) { const t0 = Date.now(); while (Date.now() - t0 < ms) { const v = await fn(); if (v) return v; await sleep(step); } return null; }
// ролик: GIF89a, сколько кадров (расширение управления кадром 21 F9 04) и сколько разных цветов в среднем кадре — в браузере
async function gifInfo(page, url) {
  return page.evaluate(async u => {
    const buf = new Uint8Array(await (await fetch(u)).arrayBuffer());
    let frames = 0; for (let i = 0; i + 2 < buf.length; i++) if (buf[i] === 0x21 && buf[i + 1] === 0xF9 && buf[i + 2] === 4) frames++;
    const head = String.fromCharCode(...buf.slice(0, 6));
    const im = new Image(); im.src = u; await im.decode();
    const c = document.createElement('canvas'); c.width = im.naturalWidth; c.height = im.naturalHeight;
    const g = c.getContext('2d'); g.drawImage(im, 0, 0);
    const d = g.getImageData(0, 0, c.width, c.height).data, set = new Set(); let lit = 0;
    for (let i = 0; i < d.length; i += 16) { set.add((d[i] >> 4) << 8 | (d[i + 1] >> 4) << 4 | (d[i + 2] >> 4)); if (d[i] + d[i + 1] + d[i + 2] > 90) lit++; }
    return { head, frames, bytes: buf.length, w: im.naturalWidth, h: im.naturalHeight, colors: set.size, lit: Math.round(400 * lit / d.length) };
  }, url);
}

(async () => {
  const { cls, games } = setup();
  const srv = await portal.start(0, '127.0.0.1');
  const base = `http://127.0.0.1:${srv.address().port}`;
  const browser = await chromium.launch({ headless: !process.argv.includes('--headed'), args: ['--use-angle=swiftshader', '--enable-unsafe-swiftshader', '--ignore-gpu-blocklist'] });
  const init = () => { window.LAB_ASK_AUTO = true; window.LAB_FAST = true; window.LAB_LOWRES = true; };
  const actx = await browser.newContext({ viewport: { width: 1280, height: 900 } }), bctx = await browser.newContext({ viewport: { width: 1280, height: 900 } });
  const tctx = await browser.newContext({ viewport: { width: 1280, height: 900 } });
  for (const c of [actx, bctx, tctx]) await c.addInitScript(init);
  const shot = (p, name, fullPage = false) => p.screenshot({ path: path.join(OUT, `karta-${name}.png`), fullPage });
  let anya, borya, teacher;
  try {
    anya = await login(actx, base, { code: cls.code, nick: 'Аня' }, 'student');
    borya = await login(bctx, base, { code: cls.code, nick: 'Боря' }, 'student');
    teacher = await login(tctx, base, { role: 'teacher', password: PASSWORD }, 'teacher');
    await teacher.goto(base + '/teacher'); // токен учителя читается по роли страницы

    /* ---------- Д1: карта курса ---------- */
    await anya.goto(base + '/karta');
    await anya.waitForSelector('.kt-room[data-room="36"]');
    const rooms = await anya.$$eval('.kt-room', bs => bs.map(b => ({ n: Number(b.dataset.room), cls: b.className })));
    check('Д1: 36 комнат на 8 этажах', rooms.length === 36 && await anya.locator('.kt-floor').count() === 8, `${rooms.length} комнат`);
    const lit = rooms.filter(r => / lit/.test(r.cls)).map(r => r.n);
    check('Д1: светятся пройденные комнаты 1 и 2, сегодня — комната 3', lit.join() === '1,2' && / now/.test(rooms.find(r => r.n === 3).cls), 'светятся: ' + lit.join());
    check('Д1: крыша — дорога к Фестивалю, уроки 29–36 дорожными знаками и шатёр', await anya.locator('.kt-roof .kt-room.road').count() === 8 && /Фестиваль/.test(await anya.textContent('.kt-roof')));
    check('Д1: сегодняшняя комната открыта справа: «Сегодня весь класс здесь»', /Сегодня весь класс здесь/.test(await anya.textContent('.kt-detail')));
    await anya.click('.kt-room[data-room="1"]');
    const det = await anya.textContent('.kt-detail');
    check('Д1: в комнате 1 — моя игра, донор и линза урока', /Пасека под огнём/.test(det) && /Space Invaders/.test(det) && /Линза/.test(det), det.replace(/\s+/g, ' ').slice(0, 140));
    await shot(anya, '1-karta', true);
    await anya.setViewportSize({ width: 390, height: 800 });
    await sleep(300);
    check('Д1: на телефоне (390 px) карта без прокрутки вбок', await anya.evaluate(() => document.documentElement.scrollWidth <= innerWidth + 1));
    await shot(anya, '2-karta-telefon', true);
    await anya.setViewportSize({ width: 1280, height: 900 });
    await anya.goto(base + '/student');
    await anya.waitForSelector('.kt-wait .kt-room[data-room="36"]', { timeout: 15000 });
    check('Д1: на экране «Ждём учителя» — карта мельче, сегодня комната 3', /комната 3/.test(await anya.textContent('.kt-wait h3')) && await anya.locator('.kt-wait .kt-room.now').count() === 1);
    await shot(anya, '3-zhdem-uchitelya');

    /* ---------- Д4: игра-страница из чата ---------- */
    await anya.goto(base + '/arcade?game=' + games.html.id);
    let gf = await frameOf(anya, '/play/' + games.html.id);
    await until(() => gf.evaluate(() => !!window.LabMoment && window.LabMoment.frames >= 12).catch(() => false), 30000);
    const st1 = await gf.evaluate(() => window.LabMoment.stats);
    check('Д4: мост подгрузил запись и копит кадры WebGL (кольцо 5 секунд)', st1.gl && st1.frames >= 12, JSON.stringify(st1));
    await anya.click('#stage [data-moment]');
    const m1 = await until(() => { const g = store.getGame(games.html.id); return g.moments && g.moments.length ? g.moments[0] : null; });
    check('Д4: «🎬 Момент» сохраняет ролик на сервере', m1 && m1.kind === 'button' && m1.nick === 'Аня', JSON.stringify(m1));
    if (m1) {
      const gi = await gifInfo(anya, `/moment/${games.html.id}/${m1.id}.gif`);
      check('Д4: ролик — GIF89a, 12+ кадров, малое разрешение, живая картинка', gi.head === 'GIF89a' && gi.frames >= 12 && gi.w <= 192 && gi.colors >= 6 && gi.lit > 20, JSON.stringify(gi));
    }
    // рекорд чужого игрока — ролик сам, с концом партии
    await borya.goto(base + '/arcade?game=' + games.html.id);
    const bf = await frameOf(borya, '/play/' + games.html.id);
    await until(() => bf.evaluate(() => !!window.LabMoment && window.LabMoment.frames >= 12).catch(() => false), 30000);
    await bf.evaluate(() => window.__end(42));
    const m2 = await until(() => (store.getGame(games.html.id).moments || []).find(x => x.kind === 'record'));
    check('Д4: личный рекорд Бори (42) сам сохраняет ролик партии', m2 && m2.nick === 'Боря' && m2.score === 42, JSON.stringify(m2));
    const card = (await api(borya, '/api/arcade')).data.games.find(c => c.id === games.html.id);
    check('Д4: в аркаде у игры лучший момент — ролик рекорда', card && card.moment && m2 && card.moment.id === m2.id, JSON.stringify(card && card.moment));
    await borya.goto(base + '/arcade');
    await borya.waitForSelector(`.acard[data-game="${games.html.id}"] .cover.mo`);
    await borya.hover(`.acard[data-game="${games.html.id}"] .cover`);
    check('Д4: на обложке аркады метка «🎬 момент», при наведении — ролик', /moment/.test(await borya.$eval(`.acard[data-game="${games.html.id}"] .cover`, e => getComputedStyle(e).backgroundImage)));
    await shot(borya, '4-arkada-moment');

    /* ---------- Д4: студия — 📌 лучший момент ---------- */
    await anya.goto(base + '/studio');
    await anya.waitForSelector(`[data-moments="${games.html.id}"] .moment img`);
    check('Д4: в студии у игры оба ролика', await anya.locator(`[data-moments="${games.html.id}"] .moment`).count() === 2);
    await anya.click(`[data-moments="${games.html.id}"] [data-pin="${m1.id}"]`);
    const picked = await until(() => store.getGame(games.html.id).momentPick === m1.id);
    const card2 = (await api(anya, '/api/arcade')).data.games.find(c => c.id === games.html.id);
    check('Д4: 📌 — закреплённый ролик становится лучшим моментом игры', picked && card2.moment.id === m1.id);
    await shot(anya, '5-studiya-momenty', true);

    /* ---------- Д4: игра в оболочке Лаб3D и нагрузка при LAB_LOWRES ---------- */
    await anya.goto(base + '/arcade?game=' + games.lab.id);
    const lf = await frameOf(anya, '/play/' + games.lab.id);
    await until(() => lf.evaluate(() => window.__lab && window.__lab.ready).catch(() => false), 60000);
    await lf.evaluate(() => document.querySelector('#startBtn').click());
    await until(() => lf.evaluate(() => window.__lab.state === 'play'), 15000);
    // кадров в секунду с записью и без: каждый замер — 4 секунды в партии, по два раза
    const fpsOf = async off => {
      await lf.evaluate(o => { window.LabMoment.off = o; if (window.__lab.state !== 'play') window.__lab.restart(); }, off);
      await sleep(1500);
      const a = await lf.evaluate(() => ({ t: window.__lab.lab.t, f: window.__lab.info().fps, now: performance.now() }));
      await sleep(4000);
      const b = await lf.evaluate(() => ({ t: window.__lab.lab.t, f: window.__lab.info().fps, now: performance.now(), st: window.__lab.state }));
      return { fps: (a.f + b.f) / 2, rate: (b.t - a.t) / ((b.now - a.now) / 1000), st: b.st };
    };
    const on1 = await fpsOf(false), off1 = await fpsOf(true), on2 = await fpsOf(false), off2 = await fpsOf(true);
    const on = (on1.fps + on2.fps) / 2, off = (off1.fps + off2.fps) / 2;
    const ls = await lf.evaluate(() => window.LabMoment.stats);
    const perGrab = ls.grabs ? ls.ms / ls.grabs : 0;
    check('Д4: LAB_LOWRES — запись не тормозит игру (кадры в секунду с записью ≥ 85% без неё)', on >= off * 0.85,
      `с записью ${on.toFixed(1)} к/с, без ${off.toFixed(1)} к/с; игровое время ${on1.rate.toFixed(2)}/${off1.rate.toFixed(2)} с/с; на кадр записи ${perGrab.toFixed(2)} мс`);
    check('Д4: LAB_LOWRES — 5 кадров в секунду по 128 px', ls.frames <= 25 && ls.frames >= 10, JSON.stringify(ls));
    await lf.evaluate(() => { window.LabMoment.off = false; });
    await sleep(2500);
    await anya.click('#stage [data-moment]');
    const m3 = await until(() => (store.getGame(games.lab.id).moments || [])[0]);
    if (m3) {
      const gi = await gifInfo(anya, `/moment/${games.lab.id}/${m3.id}.gif`);
      check('Д4: ролик игры в оболочке Лаб3D — живые кадры сцены', gi.head === 'GIF89a' && gi.frames >= 8 && gi.colors >= 8, JSON.stringify(gi));
    } else check('Д4: ролик игры в оболочке Лаб3D сохранён', false);

    /* ---------- Д4: раскадровка трейлера урока 35 ---------- */
    const tc = async r => { const x = await api(teacher, '/api/teacher/class/update', r); if (x.status !== 200) throw new Error('класс: ' + JSON.stringify(x.data)); return x; };
    await tc({ code: cls.code, lesson: 'urok-35' });
    await tc({ code: cls.code, opened: ['treyler'] });
    await anya.goto(base + '/student');
    await anya.waitForSelector('#step-treyler .m8-clip', { timeout: 20000 });
    check('Д4: в раскадровке трейлера — ролики своей игры у каждого кадра', await anya.locator('#step-treyler [data-shot="vau"] .m8-clip').count() === 2);
    await anya.click('#step-treyler [data-shot="vau"] .m8-clip >> nth=0');
    await anya.waitForSelector('#step-treyler [data-shot="vau"] .m8-clip.on');
    const tv = await until(async () => { const r = (await api(anya, '/api/me')).data.answers.treyler; return r && r.value && r.value.clips && r.value.clips.vau ? r.value.clips : null; }, 8000);
    check('Д4: ролик лёг в кадр «Самый яркий момент»', tv && /\/moment\//.test(tv.vau), JSON.stringify(tv));
    await shot(anya, '6-treyler', false);

    /* ---------- Д1: шаг karta в финале урока 36 ---------- */
    await tc({ code: cls.code, lesson: 'urok-36' });
    await tc({ code: cls.code, opened: ['final'] });
    await anya.goto(base + '/student');
    await anya.waitForSelector('#step-moya-komnata .kt-room[data-room="36"]', { timeout: 20000 });
    await anya.click('#step-moya-komnata .kt-room[data-room="1"]');
    await anya.click('#step-moya-komnata [data-karta-pick]');
    await anya.waitForSelector('#step-moya-komnata.done', { timeout: 8000 });
    const ka = (await api(anya, '/api/me')).data.answers['moya-komnata'];
    check('Д1: шаг «Карта курса» в финале урока 36 — своя комната выбрана', ka && ka.done && ka.value.room === 1, JSON.stringify(ka && ka.value));
    await shot(anya, '7-urok36-karta', false);

    const errs = [...anya.errs, ...borya.errs, ...teacher.errs].filter(e => !/WebGL|GL_|GPU stall/.test(e));
    check('Без ошибок на страницах', !errs.length, errs.slice(0, 4).join(' | '));
  } catch (e) {
    console.error(e);
    check('Проверка дошла до конца', false, e.message);
    if (anya) await shot(anya, 'oshibka').catch(() => {});
  }
  await browser.close();
  srv.close();
  const bad = results.filter(r => !r.ok);
  console.log(`\nКарта курса и лучший момент: ${results.length - bad.length} из ${results.length}`);
  process.exit(bad.length ? 1 : 0);
})();
