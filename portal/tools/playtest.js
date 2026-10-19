#!/usr/bin/env node
// Бот-плейтестер в настоящем браузере (Playwright + Chromium без окна): тот же плейтест, что запускает портал после сборки.
// Бот играет партию тремя стратегиями — пассивный, торопыга (мнёт A), новичок (жмёт что попало) — и печатает выводы.
// Запуск: node portal/tools/playtest.js games/nlo-v-stanice.js [ещё игры…] [--seconds 90] [--json]
//         без игр — все игры из portal/games/
// Выводы — подсказки, а не ошибки: код выхода всегда 0, если игра загрузилась.
// Бот живёт в оболочке «Лаб3D» (window.__lab.playtest), игра открывается в engine/game.html.
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
const args = process.argv.slice(2);
const si = args.indexOf('--seconds');
const seconds = si >= 0 ? Number(args[si + 1]) || 90 : 90;
const games = args.filter((a, i) => !a.startsWith('--') && !(si >= 0 && i === si + 1)).map(g => g.replace(/^portal\//, ''));
const list = games.length ? games : fs.readdirSync(path.join(PORTAL, 'games')).filter(f => f.endsWith('.js')).sort().map(f => 'games/' + f);

async function playOne(browser, base, src) {
  const page = await browser.newPage({ viewport: { width: 960, height: 540 } });
  const errors = [];
  page.on('pageerror', e => errors.push(e.message));
  await page.goto(`${base}/engine/game.html?game=../${src}&seed=12345`);
  await page.waitForFunction(() => window.__lab && (window.__lab.ready || window.__lab.errored), null, { timeout: 60000 });
  if (await page.evaluate(() => window.__lab.errored)) throw new Error(`${src}: игра не загрузилась — ` + await page.evaluate(() => document.querySelector('#errBox').innerText));
  const report = await page.evaluate(s => window.__lab.playtest({ seconds: s }), seconds);
  await page.close();
  return Object.assign(report, { pageErrors: errors });
}

(async () => {
  const srv = await start(0, '127.0.0.1');
  const base = `http://127.0.0.1:${srv.address().port}`;
  const browser = await chromium.launch({ args: ['--use-gl=angle', '--use-angle=swiftshader', '--enable-unsafe-swiftshader'] });
  const all = [];
  try {
    for (const src of list) {
      const t0 = Date.now();
      const r = await playOne(browser, base, src);
      all.push(Object.assign({ game: src }, r));
      if (args.includes('--json')) continue;
      console.log(`\n▶ ${src} — «${r.title}», ${r.seconds} с на стратегию, ${Math.round((Date.now() - t0) / 1000)} с на всё`);
      for (const x of r.results) console.log(`  ${r.names[x.strategy].padEnd(28)} ${String(x.seconds).padStart(5)} с, очки ${String(x.score).padStart(5)}, урон ${x.hurts}${x.offscreen != null ? `, за кадром ${x.offscreen}%` : ''}${x.over ? ` — «${x.endText}»` : ''}${x.error ? ' — ОШИБКА' : ''}`);
      if (r.findings.length) r.findings.forEach(f => console.log('  ! ' + f)); else console.log('  ✓ Бот не нашёл проблем');
    }
  } finally { await browser.close(); srv.close(); }
  if (args.includes('--json')) console.log(JSON.stringify(all, null, 2));
})().catch(e => { console.error(e); process.exit(1); });
