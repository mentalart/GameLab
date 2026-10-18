#!/usr/bin/env node
// Автопроверка игры в настоящем браузере (Playwright + Chromium без окна).
// Запуск:  node portal/tools/check-game.js                    — все игры из portal/games/
//          node portal/tools/check-game.js games/моя-игра.js  — одна игра (путь от portal/)
//          node portal/tools/check-game.js --self             — ещё и проверка самой оболочки (физика, ловля ошибок)
//                                                               и витрины готовых деталей engine/kit.html (снимки kit-*.png)
//          --headed — показать окно браузера, --quick — без «обезьяньего» прогона пресетов
// Что проверяет: загрузка без ошибок, картинка не пустая, старт пробелом и геймпадом,
// стартовое нажатие не засчитывается, ввод доходит до игры, панель ручек и пресеты,
// перезапуск R, экран конца партии, 10–20 секунд случайной игры без ошибок.
// Снимки и отчёт кладёт в portal/.check/ (в репозиторий не попадает).
// Нужен Playwright: npm i -g playwright && npx playwright install chromium
'use strict';
const fs = require('fs');
const path = require('path');
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
  page.on('pageerror', e => res.errors.push('pageerror: ' + e.message));
  page.on('console', m => { if (m.type() === 'error') res.errors.push('console: ' + m.text()); });
  const shot = async step => { await page.screenshot({ path: path.join(OUT, `${name}-${step}.png`) }); };
  const L = expr => page.evaluate(expr);
  const state = () => L('window.__lab && window.__lab.state');
  const errored = () => L('!!(window.__lab && window.__lab.errored)');
  const key = async (code, ms = 60) => { await page.keyboard.down(code); await sleep(ms); await page.keyboard.up(code); };
  // ждём N отрисованных кадров: без видеокарты кадров мало, обычные паузы ненадёжны
  const frames = (n = 3) => page.evaluate(n => new Promise(r => {
    const e = window.__lab.lab.engine; let c = 0;
    const o = e.onEndFrameObservable.add(() => { if (++c >= n) { e.onEndFrameObservable.remove(o); r(); } });
  }), n);
  const pad = async (fn, arg) => page.evaluate(fn, arg);
  const pixels = () => page.evaluate(async () => {
    const e = window.__lab.lab.engine, sc = window.__lab.scene;
    sc.render();
    const w = e.getRenderWidth(), h = e.getRenderHeight();
    const px = await e.readPixels(0, 0, w, h);
    const set = new Set(); let lit = 0, n = 0;
    for (let i = 0; i < px.length; i += 4 * 61) { n++; set.add((px[i] >> 4) << 8 | (px[i + 1] >> 4) << 4 | (px[i + 2] >> 4)); if (px[i] + px[i + 1] + px[i + 2] > 60) lit++; }
    return { colors: set.size, lit: Math.round(100 * lit / Math.max(1, n)) };
  });
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
    await page.goto(`${base}/engine/game.html?game=../${item.src}&seed=12345`);
    await page.waitForFunction('window.__lab && (window.__lab.ready || window.__lab.errored)', null, { timeout: 30000 });
    const loaded = await L('window.__lab.ready && !window.__lab.errored');
    pass('Загрузка без ошибок', loaded && !res.errors.length, res.errors[0] || (loaded ? '' : await L("document.querySelector('#errBox').innerText")));
    if (item.kind === 'broken') return await brokenChecks(page, res, pass, state, key);
    if (!loaded) return res;
    const meta = await L("({ title: document.querySelector('#gTitle').textContent, btn: document.querySelector('#startBtn').textContent, knobs: Object.keys(window.__lab.DEFAULTS).length, babylon: BABYLON.Engine.Version })");
    res.notes.title = meta.title; res.notes.babylon = meta.babylon;
    pass('Заголовок игры на стартовом экране', meta.title && meta.title !== 'Загрузка…', meta.title);
    await sleep(600);
    await shot('1-menu');
    const px = await pixels();
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
    const fps = await L('Math.round(window.__lab.lab.engine.getFps())');
    res.notes.fps = fps;
    Object.assign(res.notes, await page.evaluate(() => new Promise(r => {
      const sc = window.__lab.scene, si = new BABYLON.SceneInstrumentation(sc);
      sc.onAfterRenderObservable.addOnce(() => sc.onAfterRenderObservable.addOnce(() => { r({ meshes: sc.meshes.length, draws: si.drawCallsCounter.current }); si.dispose(); }));
    })));
    pass('Вызовов отрисовки не больше 250 (копии через createInstance)', res.notes.draws <= 250, res.notes.draws);

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
    if (item.kind === 'physics') {
      await sleep(1500);
      const ph = await L('({ on: !!window.__lab.scene.getPhysicsEngine(), y: window.__lab.lab.state.boxes[0].mesh.position.y })');
      pass('Физика Havok работает (ящики стоят на площадке)', ph.on && ph.y > 0.2 && ph.y < 0.7, `y нижнего ящика = ${ph.y.toFixed(3)}`);
    }
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
  await page.waitForFunction('window.__lab.errored', null, { timeout: 5000 }).catch(() => {});
  const box = await page.evaluate("({ shown: !document.querySelector('#errBox').hidden, text: document.querySelector('#errBox').innerText })");
  pass('Оболочка ловит ошибку в update и показывает строку', box.shown && /строка \d+/.test(box.text), box.text.split('\n')[0]);
  await page.screenshot({ path: path.join(OUT, 'oshibka-1-error.png') });
  await key('KeyR'); await sleep(300);
  pass('После ошибки игра не перезапускается сама по R', await page.evaluate('window.__lab.errored'), '');
  return res;
}

// витрина готовых деталей (engine/kit.html): вся библиотека строится без ошибок, а стили меняют силуэт, не только цвет
const KIT_SHOTS = ['ель', 'дом с черепицей', 'валун', 'куст', 'фонарь', 'сундук', 'план:двуногий', 'план:четвероногий', 'план:комок', 'план:робот', 'пол:брусчатка', 'край:забор'];
async function kitChecks(browser, base) {
  const res = { game: 'engine/kit.html', ok: true, checks: [], errors: [], notes: {} };
  const pass = (what, ok, detail) => { res.checks.push({ what, ok: !!ok, detail: detail == null ? '' : String(detail) }); if (!ok) res.ok = false; };
  const page = await browser.newPage({ viewport: { width: 1200, height: 800 } });
  page.on('pageerror', e => res.errors.push('pageerror: ' + e.message));
  page.on('console', m => { if (m.type() === 'error' || (m.type() === 'warning' && /\[набор\]/.test(m.text()))) res.errors.push(m.type() + ': ' + m.text()); });
  try {
    await page.goto(`${base}/engine/kit.html?still=1`);
    await page.waitForFunction('window.kitShow && document.querySelectorAll("nav a").length > 100', null, { timeout: 30000 });
    // вся библиотека и все планы тела в одной сцене: без ошибок и предупреждений
    const all = await page.evaluate(() => {
      const P = window.kitPanes[0], lab = P.lab; let n = 0;
      lab.style({ mood: 'ночь', shape: 'кривой', detail: 'богато', wear: 'заброшенное', wind: 1 });
      for (const k of lab.kinds()) for (let v = 0; v < k.variants; v++) { lab.prop(k.name, { v }).copy([n % 20 * 3, 0, Math.floor(n / 20) * 3]); n++; }
      for (const plan of P.api.PLANS) { lab.creature({ plan, colors: { main: '#e0703a' }, at: [n % 20 * 3, 0, 60] }); n++; }
      lab.creatureKind({ plan: 'комок', colors: { main: '#40a0e0' }, role: 'враг' }).spawn([0, 0, -6]);
      for (let i = 0; i < 4; i++) lab._kitTick(0.1);
      return { n, meshes: P.scene.meshes.length };
    });
    pass('Вся библиотека строится: виды × варианты и 14 планов тела', !res.errors.length, `${all.n} штук, мешей в сцене ${all.meshes}${res.errors.length ? ' · ' + res.errors[0] : ''}`);
    const weak = [];
    for (const it of KIT_SHOTS) {
      const r = await page.evaluate(n => window.kitShow(n, { mood: 'день', seed: 1, shapes: ['обычный', 'круглый', 'угловатый', 'острый'] }), it);
      const d = await page.evaluate(() => window.kitDiff());
      await sleep(150);
      await page.screenshot({ path: path.join(OUT, `kit-${it.replace(/[:\s]/g, '-')}.png`) });
      if (r.warns.length) res.errors.push(`${it}: ${r.warns[0]}`);
      if (d && !d.exact && (d.min < d.threshold || d.recolor >= d.threshold)) weak.push(`${it}: силуэты ${Math.round(d.min * 100)}%, перекраска ${Math.round(d.recolor * 100)}%`);
      if (d) res.notes[it] = { min: +d.min.toFixed(3), recolor: +d.recolor.toFixed(3) };
    }
    pass('Четыре стиля дают разные силуэты, перекраска — нет', !weak.length, weak.length ? weak.join(' | ') : 'снимки: portal/.check/kit-*.png');
    pass('Без ошибок в консоли витрины', !res.errors.length, res.errors.slice(0, 3).join(' | '));
  } catch (e) {
    pass('Проверка витрины дошла до конца', false, e.message.split('\n')[0]);
  } finally {
    await page.close();
  }
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
  const items = gameList();
  if (flag('--self')) items.push({ src: 'tools/fixtures/fizika.js', kind: 'physics' }, { src: 'tools/fixtures/oshibka.js', kind: 'broken' });
  const report = [];
  let allOk = true;
  for (const it of items) {
    process.stdout.write(`\n▶ ${it.src}\n`);
    const r = await checkOne(browser, base, it);
    report.push(r);
    for (const c of r.checks) console.log(`  ${c.ok ? '✓' : '✗'} ${c.what}${c.detail ? ' — ' + c.detail : ''}`);
    if (r.notes.fps != null) console.log(`  · кадров в секунду: ${r.notes.fps} (графика без видеокарты, на школьном ПК в разы больше), мешей: ${r.notes.meshes}, вызовов отрисовки: ${r.notes.draws}, сборка партии: ${r.notes.restartMs} мс`);
    if (!r.ok) allOk = false;
  }
  if (flag('--self')) {
    process.stdout.write('\n▶ engine/kit.html — готовые детали\n');
    const r = await kitChecks(browser, base);
    report.push(r);
    for (const c of r.checks) console.log(`  ${c.ok ? '✓' : '✗'} ${c.what}${c.detail ? ' — ' + c.detail : ''}`);
    if (!r.ok) allOk = false;
  }
  await browser.close();
  srv.close();
  fs.writeFileSync(path.join(OUT, 'report.json'), JSON.stringify(report, null, 2));
  console.log(`\n${allOk ? 'Всё в порядке' : 'Есть ошибки'}. Снимки и отчёт: portal/.check/`);
  process.exit(allOk ? 0 : 1);
})().catch(e => { console.error(e); process.exit(1); });
