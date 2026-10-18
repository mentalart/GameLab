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

// last.system — последний системный промпт программиста (e2e проверяет, какой образец урока ушёл модели);
// last.marked — модели, чей системный промпт пришёл с меткой кэша cache_control
const last = { marked: new Set(), changeTries: [] };
const flat = c => typeof c === 'string' ? c : (c || []).map(p => p.text || '').join('');
function answer(messages, model) {
  const sys = flat((messages.find(m => m.role === 'system') || {}).content);
  const user = flat((messages.filter(m => m.role === 'user').pop() || {}).content);
  if (/геймдизайнер-сводчик/.test(sys)) { // связка карт вау-старта
    last.linkUser = user;
    return JSON.stringify({ phrase: 'Ты — герой с карты, и каждое действие толкает тебя через всё поле. Цель — продержаться две минуты и собрать рекорд.', frame: 'Арена, изометрия: всё поле видно целиком.', controls: 'Движение — бегать, A — действие, B — рывок.', loop: 'Каждые три секунды выбираешь, куда действовать: отдача уносит тебя от опасности или прямо в неё.', risk: 'Действие вплотную к угрозе — очки ×2.', threats: 'Одни идут прямо, другие заходят сбоку; касание отнимает жизнь.', curve: 'К 30-й секунде — второй вид угроз, к 60-й — быстрее, к 90-й — вожак.', twist: 'Поворот усиливает главное действие, но им же можно себе навредить.', funny: 'Герой улетает от собственного выстрела в стог сена.' });
  }
  if (/черновик отзыва учителя/i.test(sys)) { // черновик отзыва: понятие и вопрос из колод урока
    last.draftUser = user;
    return JSON.stringify({ concept: 'Доминирующая стратегия: одна кнопка решает почти всё', question: 'Какой кнопке в твоей игре нужна цена?', why: 'Соседи почти всю партию держали одну кнопку.' });
  }
  if (/Перепиши промпт ИГРА/.test(user)) { // правка продюсера: поля ИГРА заново
    return JSON.stringify({ igra: { i: 'Пасечник защищает пасеку от шершней, напряжение растёт с каждым сбитым.', g: 'Стрелки — двигаться, пробел — стрелять, на геймпаде крестовина и A.', r: 'Шершни спускаются строем всё быстрее. Соревнуемся рекордом класса. Три жизни.', a: 'Закат над пасекой, золотые искры, гул роя.' }, changes: ['Вписал рекорд класса — так есть чем соревноваться.', 'Назвал кнопки на геймпаде.'] });
  }
  if (!/продюсер/i.test(sys)) last.system = sys;
  if (/^Игра класса\. /.test(user)) last.wowUser = user;
  if (/^Игра ученика\. /.test(user)) last.newUser = user;
  if (/продюсер/i.test(sys)) {
    return JSON.stringify({ praise: 'Понятная идея и честное предупреждение перед выстрелом.', findings: [{ kind: 'нет крючка', text: 'Непонятно, как соревноваться с друзьями.' }], forks: [{ question: 'Как соревноваться?', options: ['Рекорд класса', 'Вдвоём на одном экране'] }], frame: 'Как у донора, изометрия' });
  }
  const title = (/Название: (.+)/.exec(user) || [])[1];
  const named = code => title ? code.replace(/title: '[^']*'/, 'title: ' + JSON.stringify(title.trim())) : code;
  if (/Бот-плейтестер сыграл/.test(user)) { // правка игры класса по отчёту бота: присланный код с заметкой о правке
    last.playtestUser = user;
    return "Правлю два места.\n<<<<<<< НАЙТИ\n  players: 1,\n=======\n  notes: ['Правка по плейтесту (подставной ИИ): бездействие теперь наказано'],\n  players: 1,\n>>>>>>> ЗАМЕНИТЬ\n";
  }
  if (/^Игра класса\. /.test(user)) { // общая игра урока: секрет образца переименован в ручку secret
    const hero = (/Герой: (.+)/.exec(user) || [])[1] || 'Герой';
    const shared = SAMPLE.replace(/speedup/g, 'secret').replace(/label: 'Секрет: ускорение от числа сбитых', hint: '[^']*'/, "label: 'Секрет', hint: '0 — выключен, 1 — как задумано'")
      .replace(/\n.*Секрет выключен: волна не ускорялась.*\n/, '\n');
    return '```js\n' + shared.replace(/title: '[^']*'/, 'title: ' + JSON.stringify(hero.trim() + ' против волны')) + '```';
  }
  const patchAsked = /Формат ответа для этой правки другой/.test(user);
  if (/Игра упала/.test(user)) { // чиним присланный код: убираем подставную ошибку (кусками, если просят куски)
    const code = (/```js\n([\s\S]*?)```/.exec(user) || [])[1] || SAMPLE;
    const bad = code.split('\n').find(l => l.includes('подставная ошибка'));
    if (patchAsked && bad) { last.fixPatch = true; return 'Нашёл: обращение к несуществующему объекту.\n<<<<<<< НАЙТИ\n' + bad + '\n=======\n>>>>>>> ЗАМЕНИТЬ\n'; }
    return 'Нашёл: обращение к несуществующему объекту. Исправил.\n```js\n' + code.split('\n').filter(l => !l.includes('подставная ошибка')).join('\n') + '```';
  }
  if (model === 'mock-alt') return 'Готово.\n```js\n' + named(SAMPLE).replace("  donor: 'Space Invaders',", "  donor: 'Space Invaders',\n  notes: ['Другая модель: собрал без ошибок'],") + '```';
  const first = flat((messages.find(m => m.role === 'user') || {}).content);
  if (/просит одно изменение/.test(first)) { // правка ученика: куски нарочно не ложатся — проверяем откат на игру целиком
    last.changeTries.push(/Формат ответа для этой правки другой/.test(first) ? 'куски' : 'целиком');
    if (last.changeTries[last.changeTries.length - 1] === 'куски') return '<<<<<<< НАЙТИ\nтакой строки в игре нет\n=======\nconst x = 1;\n>>>>>>> ЗАМЕНИТЬ\n';
  }
  if (/просит одно изменение/.test(user)) return '```js\n' + SAMPLE.replace("  donor: 'Space Invaders',", "  donor: 'Space Invaders',\n  notes: ['Правка ученика выполнена (подставной ИИ)'],") + '```';
  // карта секрета ученика: ручка секрета образца становится ручкой secret, как у игры класса
  const own = /Секретная механика — её выбрал ученик/.test(user) ? BROKEN.replace(/speedup/g, 'secret') : BROKEN;
  return '```js\n' + named(own).replace("  donor: 'Space Invaders',", "  donor: 'Space Invaders',\n  notes: ['Решил сам: добавил золотую тарелку-бонус', 'Решил сам: стога-укрытия из сена'],") + '```';
}

const cacheSeen = new Set();
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
      // кэш как у провайдера: системный промпт с меткой cache_control в первый раз записывается в кэш, потом читается из него
      const sm = (j.messages || []).find(m => m.role === 'system');
      if (sm && Array.isArray(sm.content) && sm.content.some(p => p.cache_control)) {
        last.marked.add(j.model);
        const key = j.model + '\n' + flat(sm.content), n = Math.round(flat(sm.content).length / 3);
        usage.prompt_tokens_details = cacheSeen.has(key) ? { cached_tokens: n } : { cache_write_tokens: n };
        cacheSeen.add(key);
      }
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
