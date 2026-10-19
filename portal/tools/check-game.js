#!/usr/bin/env node
// Автопроверка игры в настоящем браузере (Playwright + Chromium без окна): игра на three.js в оболочке «Лаб3D»
// (engine/game.html и lab-three.js), проверки — через window.__lab.
// Запуск:  node portal/tools/check-game.js                    — все игры из portal/games/
//          node portal/tools/check-game.js games/моя-игра.js  — одна игра (путь от portal/)
//          node portal/tools/check-game.js --self             — ещё и проверка самой оболочки (ловля ошибки и строка из кода игры)
//          --headed — показать окно браузера, --quick — без «обезьяньего» прогона пресетов
//          --all — проверить и игры, которые не менялись с последней зелёной проверки (без него они пропускаются)
//          --jobs=3 — сколько игр проверять одновременно (по умолчанию 3; --jobs=1 — по одной, как раньше)
// Без видеокарты игры рисуются в половину разрешения (LAB_LOWRES): кадров вдвое больше. Снимки и проверка «картинка не пустая» — в полном.
// Что проверяет: загрузка без ошибок, картинка не пустая, старт пробелом и геймпадом,
// стартовое нажатие не засчитывается, ввод доходит до игры, панель ручек и пресеты,
// перезапуск R, экран конца партии, 10–20 секунд случайной игры без ошибок.
// Снимки и отчёт кладёт в portal/.check/ (в репозиторий не попадает).
// Нужен Playwright: npm i -g playwright && npx playwright install chromium
'use strict';
const fs = require('fs');
const path = require('path');
const crypto = require('crypto');
const { start } = require('./serve.js');

let chromium;
try { ({ chromium } = require('playwright')); } catch (e) {
  console.error('Нет Playwright. Установите: npm i -g playwright && npx playwright install chromium');
  process.exit(2);
}

const PORTAL = path.resolve(__dirname, '..');
const OUT = path.join(PORTAL, '.check');
const args = process.argv.slice(2);
const flag = f => args.includes(f);
const sleep = ms => new Promise(r => setTimeout(r, ms));
const JOBS = Math.max(1, Number((args.find(a => a.startsWith('--jobs=')) || '=3').split('=')[1]) || 3);

// отпечаток игры: её файл, оболочки и сама проверка. Совпал с последней зелёной проверкой — игру можно не гонять
const PASSED = path.join(OUT, 'passed.json');
const SHARED = ['engine/lab-three.js', 'engine/game.html', 'engine/vendor/three/VERSION.txt', 'tools/check-game.js', 'tools/serve.js'];
const fingerprint = src => {
  const h = crypto.createHash('sha1');
  for (const f of [src, ...SHARED]) { try { h.update(f + '\0' + fs.readFileSync(path.join(PORTAL, f))); } catch (e) { h.update(f + '\0нет'); } }
  return h.digest('hex');
};
const readPassed = () => { try { return JSON.parse(fs.readFileSync(PASSED, 'utf8')); } catch (e) { return {}; } };

// подставной геймпад: navigator.getGamepads отдаёт то, что лежит в window.__pad
const FAKE_PAD = () => {
  window.__pad = { connected: false, buttons: new Array(17).fill(false), axes: [0, 0, 0, 0] };
  navigator.getGamepads = () => window.__pad.connected
    ? [{ id: 'Тестовый геймпад', index: 0, connected: true, mapping: 'standard', axes: window.__pad.axes.slice(), buttons: window.__pad.buttons.map(p => ({ pressed: p, touched: p, value: p ? 1 : 0 })) }]
    : [];
};

function gameList() {
  const list = args.filter(a => !a.startsWith('--'));
  if (list.length) return list.map(g => ({ src: g.replace(/^portal\//, ''), kind: 'game' }));
  return fs.readdirSync(path.join(PORTAL, 'games')).filter(f => f.endsWith('.js')).sort().map(f => ({ src: 'games/' + f, kind: 'game' }));
}

async function checkOne(browser, base, item) {
  const name = path.basename(item.src, '.js');
  const res = { game: item.src, ok: true, checks: [], errors: [], notes: {} };
  const pass = (what, ok, detail) => { res.checks.push({ what, ok: !!ok, detail: detail == null ? '' : String(detail) }); if (!ok) res.ok = false; };
  const page = await browser.newPage({ viewport: { width: 960, height: 540 } });
  await page.addInitScript(FAKE_PAD);
  await page.addInitScript(() => { window.LAB_LOWRES = true; });
  page.on('pageerror', e => res.errors.push('pageerror: ' + e.message));
  page.on('console', m => { if (m.type() === 'error') res.errors.push('console: ' + m.text()); });
  // снимок — в полном разрешении: на время снимка LAB_LOWRES выключается
  const shot = async step => {
    await L('window.__lab.lowres(false)'); await frames(2);
    await page.screenshot({ path: path.join(OUT, `${name}-${step}.png`) });
    await L('window.__lab.lowres(true)');
  };
  const L = expr => page.evaluate(expr);
  const state = () => L('window.__lab && window.__lab.state');
  const errored = () => L('!!(window.__lab && window.__lab.errored)');
  const key = async (code, ms = 60) => { await page.keyboard.down(code); await sleep(ms); await page.keyboard.up(code); };
  // ждём N отрисованных кадров: без видеокарты кадров мало, обычные паузы ненадёжны
  const frames = (n = 3) => page.evaluate(n => window.__lab.frames(n), n);
  const pad = async (fn, arg) => page.evaluate(fn, arg);
  const pixels = () => page.evaluate(() => window.__lab.pixels());
  // «обезьяна»: случайно жмёт стрелки и кнопки, перезапускает после конца партии
  const monkey = async ms => {
    const codes = ['ArrowLeft', 'ArrowRight', 'ArrowUp', 'ArrowDown', 'Space', 'ShiftLeft'];
    const end = Date.now() + ms;
    while (Date.now() < end) {
      if (await errored()) return;
      const s = await state();
      if (s === 'over') { await key('Space'); await sleep(150); continue; }
      const held = codes.filter(() => Math.random() < 0.35);
      for (const c of held) await page.keyboard.down(c);
      await sleep(80 + Math.random() * 220);
      for (const c of held) await page.keyboard.up(c);
    }
  };

  try {
    // без видеокарты три игры разом делят процессор: загрузка новой может идти дольше 30 секунд
    await page.goto(`${base}/engine/game.html?game=../${item.src}&seed=12345`, { waitUntil: 'commit' });
    await page.waitForFunction('window.__lab && (window.__lab.ready || window.__lab.errored)', null, { timeout: 90000, polling: 250 });
    const loaded = await L('window.__lab.ready && !window.__lab.errored');
    pass('Загрузка без ошибок', loaded && !res.errors.length, res.errors[0] || (loaded ? '' : await L("document.querySelector('#errBox').innerText")));
    if (item.kind === 'broken') return await brokenChecks(page, res, pass, state, key);
    if (!loaded) return res;
    const meta = await L("({ title: document.querySelector('#gTitle').textContent, btn: document.querySelector('#startBtn').textContent, knobs: Object.keys(window.__lab.DEFAULTS).length, engine: window.__lab.engine })");
    res.notes.title = meta.title; res.notes.engine = meta.engine;
    pass('Заголовок игры на стартовом экране', meta.title && meta.title !== 'Загрузка…', meta.title);
    await sleep(600);
    await L('window.__lab.lowres(false)'); await frames(2);
    await page.screenshot({ path: path.join(OUT, `${name}-1-menu.png`) });
    const px = await pixels();
    await L('window.__lab.lowres(true)');
    pass('Картинка не пустая (превью за меню)', px.colors >= 12 && px.lit >= 5, `${px.colors} оттенков, светлых точек ${px.lit}%`);

    // геймпад: подписи меняются, A запускает партию, стартовое нажатие не засчитывается
    await pad(() => { window.__pad.connected = true; window.__pad.buttons[3] = true; });
    await frames(2);
    await pad(() => { window.__pad.buttons[3] = false; });
    await frames(2);
    const padBtn = await L("document.querySelector('#startBtn').textContent");
    pass('Геймпад узнан: подписи показывают его кнопки', /· A/.test(padBtn), padBtn);
    await pad(() => { window.__pad.buttons[0] = true; });
    await frames(3);
    pass('Кнопка A геймпада запускает партию', (await state()) === 'play', await state());
    await frames(2);
    await pad(() => { window.__pad.buttons[0] = false; });
    await frames(2);
    const startPress = await L('window.__lab.tele.presses.a');
    pass('Нажатие, которым запущена партия, не засчитывается', startPress === 0, `нажатий A: ${startPress}`);
    await pad(() => { window.__pad.axes[0] = 1; });
    await frames(3);
    const ax = await L('window.__lab.lab.p1.x');
    await pad(() => { window.__pad.axes[0] = 0; window.__pad.connected = false; });
    pass('Стик геймпада доходит до игры (p1.x)', ax > 0.5, `p1.x = ${ax}`);

    // клавиатура
    await page.keyboard.down('ArrowRight'); await frames(3);
    const kx = await L('window.__lab.lab.p1.x');
    await page.keyboard.up('ArrowRight');
    for (let i = 0; i < 3; i++) { await key('Space', 30); await frames(2); } // короткие нажатия: оболочка не должна их терять
    const tele = await L('window.__lab.tele');
    pass('Клавиатура доходит до игры, короткие нажатия не теряются', kx > 0.5 && tele.presses.a === 3, `p1.x = ${kx}, нажатий A: ${tele.presses.a} из 3`);
    if (!flag('--quick')) await monkey(6000);
    pass('6 секунд случайной игры без ошибок', !(await errored()) && !res.errors.length, res.errors[0] || '');
    if ((await state()) === 'over') { await key('Space'); await sleep(200); }
    await shot('2-play');
    res.notes.fps = (await L('window.__lab.info()')).fps;
    await frames(2);
    const info = await L('window.__lab.info()');
    Object.assign(res.notes, { meshes: info.meshes, draws: info.draws, version: info.version });
    pass('Вызовов отрисовки не больше 250 (копии InstancedMesh и lab.merge)', res.notes.draws <= 250, res.notes.draws);

    // ручки геймдизайнера
    await key('Tab'); await sleep(200);
    const panel = await L("({ open: !document.querySelector('#panel').hidden, knobs: document.querySelectorAll('#panel .knob').length, presets: [...document.querySelectorAll('#presets button')].map(b => b.textContent) })");
    pass('Tab открывает «Ручки геймдизайнера»', panel.open && panel.knobs === meta.knobs, `ручек ${panel.knobs} из ${meta.knobs}`);
    pass('Есть пресеты «Как задумано» и «Новичок»', panel.presets.includes('Как задумано') && panel.presets.includes('Новичок'), panel.presets.join(', '));
    await shot('3-knobs');
    const presets = panel.presets.filter(p => p !== 'Как задумано');
    for (const p of presets) {
      await page.locator('#presets button', { hasText: p }).first().click();
      await key('Tab'); await sleep(100);
      if ((await state()) === 'over') { await key('Space'); await sleep(200); }
      if (!flag('--quick')) await monkey(2500);
      pass(`Пресет «${p}» играется без ошибок`, !(await errored()), '');
      await key('Tab'); await sleep(100);
    }
    await page.locator('#presets button', { hasText: 'Как задумано' }).first().click();
    const changed = await L('Object.keys(window.__lab.DEFAULTS).filter(k => window.__lab.cfg[k] !== window.__lab.DEFAULTS[k]).length');
    pass('«Как задумано» возвращает все числа', changed === 0, `отличается: ${changed}`);
    await key('Tab'); await sleep(100);

    // перезапуск и конец партии
    if ((await state()) === 'over') { await key('Space'); await sleep(200); }
    const before = await L('window.__lab.session.restarts');
    await key('KeyR'); await frames(2);
    const restarted = (await L('window.__lab.session.restarts')) > before && (await state()) === 'play';
    const rt = Math.round(await L('(() => { const t = performance.now(); window.__lab.restart(); return performance.now() - t; })()'));
    await frames(3);
    pass('R перезапускает партию быстрее секунды', restarted && rt < 1000, `сборка партии ${rt} мс`);
    res.notes.restartMs = rt;
    await L("window.__lab.end('lose', 'Проверка')");
    await sleep(300);
    const over = await L("({ shown: !document.querySelector('#overScreen').hidden, notes: document.querySelectorAll('#overNotes div').length, own: typeof GAME.overNote === 'function', seed: document.querySelector('#overSeed').textContent })");
    pass('Экран конца партии с заметками и зерном', over.shown && over.notes >= (over.own ? 1 : 0) && /12345/.test(over.seed), `заметок ${over.notes}${over.own ? '' : ' (у игры нет overNote)'}`);
    await shot('4-over');
    await key('Space'); await frames(3);
    pass('Пробел после конца — новая партия', (await state()) === 'play', await state());
    pass('Без ошибок в консоли за всю проверку', !res.errors.length, res.errors.slice(0, 3).join(' | '));
  } catch (e) {
    pass('Проверка дошла до конца', false, e.message.split('\n')[0]);
    try { await shot('x-fail'); } catch (_) { /* страница закрыта */ }
  } finally {
    await page.close();
  }
  return res;
}

async function brokenChecks(page, res, pass, state, key) {
  res.checks = []; res.ok = true; res.errors = [];
  await key('Space');
  await page.waitForFunction('window.__lab.errored', null, { timeout: 20000 }).catch(() => {}); // без видеокарты секунда партии идёт долго
  const box = await page.evaluate("({ shown: !document.querySelector('#errBox').hidden, text: document.querySelector('#errBox').innerText })");
  const want = (fs.readFileSync(path.join(PORTAL, res.game), 'utf8').split('\n').findIndex(l => l.includes('намеренная ошибка')) + 1) || null;
  const got = Number((/строка (\d+)/.exec(box.text) || [])[1]) || null;
  pass('Оболочка ловит ошибку в update и показывает строку из кода игры', box.shown && got === want, `${box.text.split('\n')[0]} (ждали строку ${want})`);
  await page.screenshot({ path: path.join(OUT, path.basename(res.game, '.js') + '-1-error.png') });
  await key('KeyR'); await sleep(300);
  pass('После ошибки игра не перезапускается сама по R', await page.evaluate('window.__lab.errored'), '');
  return res;
}

(async () => {
  fs.mkdirSync(OUT, { recursive: true });
  const srv = await start(0, '127.0.0.1');
  const base = `http://127.0.0.1:${srv.address().port}`;
  const browser = await chromium.launch({
    headless: !flag('--headed'),
    args: ['--use-angle=swiftshader', '--enable-unsafe-swiftshader', '--ignore-gpu-blocklist', '--autoplay-policy=no-user-gesture-required'],
  });
  let items = gameList();
  if (flag('--self')) items.push({ src: 'tools/fixtures/oshibka.js', kind: 'broken' });
  const passed = readPassed();
  const named = args.some(a => !a.startsWith('--'));
  if (!named && !flag('--all')) {
    const same = items.filter(it => passed[it.src] === fingerprint(it.src));
    if (same.length) console.log(`Не менялись с последней зелёной проверки, пропускаю (${same.length}): ${same.map(it => path.basename(it.src, '.js')).join(', ')}. Проверить всё — --all.`);
    items = items.filter(it => !same.includes(it));
  }
  const report = [];
  let allOk = true;
  const print = (it, r) => {
    process.stdout.write(`\n▶ ${it.src}\n`);
    for (const c of r.checks) console.log(`  ${c.ok ? '✓' : '✗'} ${c.what}${c.detail ? ' — ' + c.detail : ''}`);
    if (r.notes.fps != null) console.log(`  · three.js r${r.notes.version}: кадров в секунду ${r.notes.fps} (графика без видеокарты, на школьном ПК в разы больше), мешей ${r.notes.meshes}, вызовов отрисовки ${r.notes.draws}, сборка партии ${r.notes.restartMs} мс`);
  };
  // несколько игр одновременно, каждая на своей странице; печатаем по готовности
  const queue = items.slice();
  await Promise.all(Array.from({ length: Math.min(JOBS, queue.length) }, async () => {
    for (let it; (it = queue.shift());) {
      const r = await checkOne(browser, base, it);
      report.push(r);
      print(it, r);
      if (r.ok) passed[it.src] = fingerprint(it.src); else { allOk = false; delete passed[it.src]; }
    }
  }));
  await browser.close();
  srv.close();
  fs.writeFileSync(PASSED, JSON.stringify(passed, null, 2));
  fs.writeFileSync(path.join(OUT, 'report.json'), JSON.stringify(report, null, 2));
  console.log(`\n${allOk ? 'Всё в порядке' : 'Есть ошибки'}. Снимки и отчёт: portal/.check/`);
  process.exit(allOk ? 0 : 1);
})().catch(e => { console.error(e); process.exit(1); });
