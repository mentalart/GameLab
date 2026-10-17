#!/usr/bin/env node
// Подставной OpenAI-совместимый ИИ для проверки портала без ключа и без денег.
// Продюсер отвечает JSON с развилкой. Первая сборка — игра, которая падает через секунду (проверка автопочинки),
// починка и правка возвращают рабочий образец урока, общая игра урока — образец с ручкой secret. Модель mock-alt собирает
// рабочую игру сразу — для сравнения моделей и отчёта журнала генераций. Поддерживает потоковый ответ (stream).
// Запуск: node portal/tools/mock-ai.js [порт]  →  в config.json: "baseUrl": "http://localhost:порт/v1", "apiKey": "mock"
'use strict';
const http = require('http');
const fs = require('fs');
const path = require('path');

const SAMPLE = fs.readFileSync(path.join(__dirname, '..', 'games', 'nlo-v-stanice.js'), 'utf8');
const BROKEN = SAMPLE.replace('  update(lab, dt) {', '  update(lab, dt) {\n    if (lab.t > 1.2) lab.state.nothing.position.x = 1; // подставная ошибка для проверки автопочинки');

const last = {}; // последний системный промпт программиста — e2e проверяет, какой образец урока ушёл модели
function answer(messages, model) {
  const sys = (messages.find(m => m.role === 'system') || {}).content || '';
  const user = (messages.filter(m => m.role === 'user').pop() || {}).content || '';
  if (!/продюсер/i.test(sys)) last.system = sys;
  if (/продюсер/i.test(sys)) {
    return JSON.stringify({ praise: 'Понятная идея и честное предупреждение перед выстрелом.', findings: [{ kind: 'нет крючка', text: 'Непонятно, как соревноваться с друзьями.' }], forks: [{ question: 'Как соревноваться?', options: ['Рекорд класса', 'Вдвоём на одном экране'] }] });
  }
  const title = (/Название: (.+)/.exec(user) || [])[1];
  const named = code => title ? code.replace(/title: '[^']*'/, 'title: ' + JSON.stringify(title.trim())) : code;
  if (/Общая игра урока/.test(user)) { // общая игра урока: секрет образца переименован в ручку secret
    const hero = (/Герой: (.+)/.exec(user) || [])[1] || 'Герой';
    const shared = SAMPLE.replace(/speedup/g, 'secret').replace(/label: 'Секрет: ускорение от числа сбитых', hint: '[^']*'/, "label: 'Секрет', hint: '0 — выключен, 1 — как задумано'")
      .replace(/\n.*Секрет выключен: волна не ускорялась.*\n/, '\n');
    return '```js\n' + shared.replace(/title: '[^']*'/, 'title: ' + JSON.stringify(hero.trim() + ' против волны')) + '```';
  }
  if (/Игра упала/.test(user)) { // чиним присланный код: убираем подставную ошибку
    const code = (/```js\n([\s\S]*?)```/.exec(user) || [])[1] || SAMPLE;
    return 'Нашёл: обращение к несуществующему объекту. Исправил.\n```js\n' + code.split('\n').filter(l => !l.includes('подставная ошибка')).join('\n') + '```';
  }
  if (model === 'mock-alt') return 'Готово.\n```js\n' + named(SAMPLE).replace("  donor: 'Space Invaders',", "  donor: 'Space Invaders',\n  notes: ['Другая модель: собрал без ошибок'],") + '```';
  if (/просит одно изменение/.test(user)) return '```js\n' + SAMPLE.replace("  donor: 'Space Invaders',", "  donor: 'Space Invaders',\n  notes: ['Правка ученика выполнена (подставной ИИ)'],") + '```';
  return '```js\n' + named(BROKEN).replace("  donor: 'Space Invaders',", "  donor: 'Space Invaders',\n  notes: ['Решил сам: добавил золотую тарелку-бонус', 'Решил сам: стога-укрытия из сена'],") + '```';
}

function start(port = 0) {
  const srv = http.createServer((req, res) => {
    let body = '';
    req.on('data', c => { body += c; });
    req.on('end', () => {
      if (req.url.endsWith('/models')) { res.writeHead(200, { 'Content-Type': 'application/json' }); return res.end(JSON.stringify({ data: [{ id: 'mock-code' }, { id: 'mock-text' }] })); }
      if (!req.url.endsWith('/chat/completions')) { res.writeHead(404); return res.end(); }
      const j = JSON.parse(body || '{}');
      const text = answer(j.messages || [], j.model);
      const usage = { prompt_tokens: Math.round(JSON.stringify(j.messages).length / 3), completion_tokens: Math.round(text.length / 3) };
      if (j.stream) {
        res.writeHead(200, { 'Content-Type': 'text/event-stream' });
        const parts = text.match(/[\s\S]{1,400}/g) || [''];
        let i = 0;
        const tick = () => {
          if (i < parts.length) { res.write('data: ' + JSON.stringify({ choices: [{ delta: { content: parts[i++] } }] }) + '\n\n'); setTimeout(tick, 5); return; }
          res.write('data: ' + JSON.stringify({ choices: [], usage }) + '\n\n');
          res.end('data: [DONE]\n\n');
        };
        tick();
      } else {
        res.writeHead(200, { 'Content-Type': 'application/json' });
        res.end(JSON.stringify({ choices: [{ message: { role: 'assistant', content: text } }], usage }));
      }
    });
  });
  return new Promise(r => srv.listen(port, '127.0.0.1', () => r(srv)));
}
module.exports = { start, last };
if (require.main === module) start(Number(process.argv[2]) || 8090).then(s => console.log('Подставной ИИ: http://127.0.0.1:' + s.address().port + '/v1'));
