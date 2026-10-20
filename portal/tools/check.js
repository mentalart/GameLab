#!/usr/bin/env node
// «Умная» проверка: смотрит, какие файлы изменились, и запускает только нужные проверки.
// Запуск (из корня репозитория или из portal/):
//   node portal/tools/check.js              — изменения против origin/main: незакоммиченные, новые файлы и свои коммиты
//   node portal/tools/check.js --since=REF  — изменения между REF и HEAD, например что пришло после git pull --rebase
//   node portal/tools/check.js --full       — полная проверка, как раньше: все игры, оба прогона портала, чат Qwen
//   --dry — только показать план, ничего не запускать; --files=a,b — план для этих файлов (отладка)
// Что запускается:
//   документы, skills, README — ничего;
//   игра portal/games/x.js — проверка этой игры и уроков, где она донор (e2e-portal --only=N);
//   оболочка игр (engine/) — check-game --self, e2e-portal без демо-прогона;
//   сценарий урока N — e2e-portal --only=N с демо-прогоном (там развилки демо-продюсера);
//   lib/ai.js, server.js, lib/, подставной ИИ, сама e2e-проверка — e2e-portal целиком;
//   public/, промпты ai/ — e2e-portal без демо-прогона;
//   портал вообще (server, lib, public, ai, lessons, engine/portal.js) — ещё e2e-qwen-chat.js (секунды).
// Незнакомый файл в portal/ — полная проверка: лучше лишняя, чем пропущенная.
'use strict';
const { execSync, spawnSync } = require('child_process');
const fs = require('fs');
const path = require('path');

const ROOT = execSync('git rev-parse --show-toplevel', { encoding: 'utf8' }).trim();
const args = process.argv.slice(2);
const flag = f => args.includes(f);
const since = (args.find(a => a.startsWith('--since=')) || '').split('=')[1];
const git = cmd => execSync('git ' + cmd, { cwd: ROOT, encoding: 'utf8' }).split('\n').map(s => s.trim()).filter(Boolean);

function changedFiles() {
  const given = args.find(a => a.startsWith('--files=')); // --files=a,b — для отладки плана
  if (given) return given.slice(8).split(',');
  if (since) return git(`diff --name-only ${since} HEAD`);
  let base = 'HEAD';
  try { base = git('merge-base HEAD origin/main')[0]; } catch (e) { /* нет origin/main — только незакоммиченное */ }
  return [...new Set([...git(`diff --name-only ${base}`), ...git('ls-files --others --exclude-standard')])];
}

// какие уроки берут игру донором: имя файла игры встречается в сценарии
function lessonsWithGame(file) {
  const name = path.basename(file);
  const dir = path.join(ROOT, 'portal', 'lessons');
  return fs.readdirSync(dir).filter(f => /^urok-\d\d\.js$/.test(f) && fs.readFileSync(path.join(dir, f), 'utf8').includes(name)).map(f => Number(f.slice(5, 7)));
}

function plan(files) {
  const p = { games: new Set(), self: false, allGames: false, e2e: false, e2eAll: false, lessons: new Set(), demo: false, qwen: false, why: [] };
  const portal = () => { p.qwen = true; };
  const whole = (f, demo) => { p.e2e = true; p.e2eAll = true; if (demo) p.demo = true; portal(); p.why.push(f); };
  for (const f of files) {
    if (!f.startsWith('portal/') || /\.md$/.test(f) && !f.startsWith('portal/ai/')) continue; // документы, skills, README
    const r = f.slice('portal/'.length);
    if (/^games\/[^/]+\.js$/.test(r)) {
      p.games.add(r);
      const ls = lessonsWithGame(r);
      if (ls.length) { p.e2e = true; ls.forEach(n => p.lessons.add(n)); }
      p.why.push(f);
    } else if (r === 'engine/portal.js') { p.qwen = true; p.why.push(f); }
    else if (/^engine\//.test(r) || /^tools\/(check-game|serve)\.js$/.test(r) || /^tools\/fixtures\/oshibka/.test(r)) {
      p.self = true; p.allGames = true; whole(f, false);
    } else if (/^lessons\/urok-\d\d(-v2|-kolody|-miry)?\.js$/.test(r)) {
      const n = Number(r.slice(13, 15));
      p.e2e = true; p.lessons.add(n); p.demo = true; portal(); p.why.push(f);
    } else if (r === 'lib/ai.js' || r === 'server.js' || /^lib\//.test(r) || /^tools\/(mock-ai|e2e-portal|e2e-m4)\.js$/.test(r) || /^tools\/fixtures\/lessons\//.test(r)) whole(f, true);
    else if (/^(public|ai)\//.test(r) || r === 'lessons/moduli.js' || r === 'lessons/slovar.js') whole(f, false);
    else if (/^tools\/(e2e-qwen-chat\.js|fixtures\/qwen)/.test(r)) { p.qwen = true; p.why.push(f); }
    else if (/^tools\/(check|playtest|vendor-three\.sh)/.test(r) || /^(README|\.gitignore|config\.example\.json)/.test(r) || r.startsWith('.check/')) continue;
    else { p.self = true; p.allGames = true; whole(f, true); } // незнакомый файл — полная
  }
  return p;
}

function steps(p) {
  const s = [];
  if (p.self || p.games.size) s.push(['node', ['portal/tools/check-game.js', ...(p.self ? ['--self'] : []), ...(p.allGames ? [] : [...p.games])]]);
  if (p.e2e) s.push(['node', ['portal/tools/e2e-portal.js', ...(p.e2eAll ? [] : ['--only=' + [...p.lessons].sort().join(',')]), ...(p.demo ? [] : ['--mock-only'])]]);
  if (p.qwen) s.push(['node', ['portal/tools/e2e-qwen-chat.js']]);
  return s;
}

const full = flag('--full');
const files = full ? [] : changedFiles();
const p = full ? null : plan(files);
const list = full
  ? [['node', ['portal/tools/check-game.js', '--self', '--all']], ['node', ['portal/tools/e2e-portal.js']], ['node', ['portal/tools/e2e-qwen-chat.js']]]
  : steps(p);

console.log(full ? 'Полная проверка.' : `Изменённых файлов: ${files.length}${since ? ` (с ${since})` : ''}.`);
if (!list.length) { console.log('Проверять нечего: изменились только документы или файлы вне портала.'); process.exit(0); }
console.log('План:\n' + list.map(([c, a]) => '  ' + c + ' ' + a.join(' ')).join('\n'));
if (flag('--dry')) process.exit(0);

const t0 = Date.now(), results = [];
for (const [c, a] of list) {
  const t = Date.now();
  console.log(`\n━━ ${a.join(' ')}`);
  const r = spawnSync(c, a, { cwd: ROOT, stdio: 'inherit' });
  results.push({ what: a.join(' '), ok: r.status === 0, s: Math.round((Date.now() - t) / 1000) });
}
console.log('\nИтог:');
for (const r of results) console.log(`  ${r.ok ? '✓' : '✗'} ${r.what} — ${r.s} с`);
console.log(`Всего ${Math.round((Date.now() - t0) / 60000 * 10) / 10} мин.`);
process.exit(results.every(r => r.ok) ? 0 : 1);
