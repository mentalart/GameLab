#!/usr/bin/env node
// Собирает системный промпт для Qwen из portal/ai/game-prompt.md:
// подставляет версию Babylon и код образца. Так же будет делать портал.
// Запуск: node portal/tools/build-prompt.js [файл]  — без файла печатает промпт в консоль.
//         node portal/tools/build-prompt.js --template new|change|fix  — шаблон сообщения ученика.
'use strict';
const fs = require('fs');
const path = require('path');

const PORTAL = path.resolve(__dirname, '..');
const read = p => fs.readFileSync(path.join(PORTAL, p), 'utf8');

function between(text, start, end) {
  const a = text.indexOf(start), b = text.indexOf(end);
  if (a < 0 || b < a) throw new Error(`В game-prompt.md нет меток ${start} … ${end}`);
  return text.slice(a + start.length, b).trim();
}

function babylonVersion() {
  const m = /babylonjs\s+([\d.]+)/i.exec(read('engine/vendor/VERSIONS.txt'));
  if (!m) throw new Error('Не нашёл версию Babylon в engine/vendor/VERSIONS.txt');
  return m[1];
}

function systemPrompt(example = 'games/tarelki-nad-aulom.js') {
  return between(read('ai/game-prompt.md'), '<!-- prompt:start -->', '<!-- prompt:end -->')
    .split('{{BABYLON}}').join(babylonVersion())
    .split('{{ПРИМЕР}}').join(read(example).trim());
}

function userTemplate(name) {
  return between(read('ai/game-prompt.md'), `<!-- user:${name}:start -->`, `<!-- user:${name}:end -->`);
}

module.exports = { systemPrompt, userTemplate, babylonVersion };

if (require.main === module) {
  const args = process.argv.slice(2);
  const ti = args.indexOf('--template');
  if (ti >= 0) { console.log(userTemplate(args[ti + 1] || 'new')); process.exit(0); }
  const text = systemPrompt();
  if (args[0]) {
    fs.writeFileSync(args[0], text);
    console.error(`Промпт записан в ${args[0]}: ${text.length} символов, примерно ${Math.round(text.length / 3)} токенов`);
  } else {
    console.log(text);
  }
}
