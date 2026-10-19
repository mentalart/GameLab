#!/usr/bin/env node
// Простой сервер для разработки: отдаёт папку portal/ по HTTP.
// Запуск: node portal/tools/serve.js [порт]  →  http://localhost:8080/
// Игра: http://localhost:8080/engine/game.html?game=../games/nlo-v-stanice.js
// Без зависимостей. Нужен потому, что модули three.js и оболочки не грузятся с file://.
'use strict';
const http = require('http');
const fs = require('fs');
const path = require('path');

const ROOT = path.resolve(__dirname, '..');
const TYPES = {
  '.html': 'text/html; charset=utf-8', '.js': 'text/javascript; charset=utf-8', '.css': 'text/css; charset=utf-8',
  '.json': 'application/json; charset=utf-8', '.md': 'text/markdown; charset=utf-8', '.txt': 'text/plain; charset=utf-8',
  '.ts': 'text/plain; charset=utf-8', '.wasm': 'application/wasm', '.png': 'image/png', '.jpg': 'image/jpeg',
  '.svg': 'image/svg+xml', '.glb': 'model/gltf-binary', '.gltf': 'model/gltf+json', '.ico': 'image/x-icon',
};

function handler(req, res) {
  let p;
  try { p = decodeURIComponent(new URL(req.url, 'http://x').pathname); } catch (e) { res.writeHead(400); return res.end(); }
  if (p.endsWith('/')) p += 'index.html';
  const file = path.resolve(ROOT, '.' + p);
  if (!file.startsWith(ROOT + path.sep)) { res.writeHead(403); return res.end(); }
  fs.stat(file, (err, st) => {
    if (err || !st.isFile()) {
      if (p === '/index.html') { res.writeHead(302, { Location: '/engine/game.html?game=../games/nlo-v-stanice.js' }); return res.end(); }
      res.writeHead(404, { 'Content-Type': 'text/plain; charset=utf-8' }); return res.end('Не найдено: ' + p);
    }
    res.writeHead(200, { 'Content-Type': TYPES[path.extname(file).toLowerCase()] || 'application/octet-stream', 'Cache-Control': 'no-cache' });
    fs.createReadStream(file).pipe(res);
  });
}

function start(port = 8080, host = '0.0.0.0') {
  return new Promise((resolve, reject) => {
    const srv = http.createServer(handler);
    srv.on('error', reject);
    srv.listen(port, host, () => resolve(srv));
  });
}

module.exports = { start };

if (require.main === module) {
  const port = Number(process.argv[2]) || 8080;
  start(port).then(() => {
    console.log(`Лаборатория игр: http://localhost:${port}/`);
    console.log(`Игра-образец: http://localhost:${port}/engine/game.html?game=../games/nlo-v-stanice.js`);
  }).catch(e => { console.error('Не удалось запустить сервер:', e.message); process.exit(1); });
}
