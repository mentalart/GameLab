// Хранилище портала: JSON-файлы в portal/data/ (в репозиторий не попадает).
// Классы, ученики, игры и их версии, сессии, заметки автора, журнал генераций.
'use strict';
const fs = require('fs');
const path = require('path');
const crypto = require('crypto');

const DATA = process.env.LAB_DATA ? path.resolve(process.env.LAB_DATA) : path.resolve(__dirname, '..', 'data');

const mkdir = d => fs.mkdirSync(d, { recursive: true });
function readJSON(file, fallback) {
  try { return JSON.parse(fs.readFileSync(file, 'utf8')); } catch (e) { return fallback; }
}
function writeJSON(file, value) {
  mkdir(path.dirname(file));
  const tmp = file + '.' + process.pid + '.tmp';
  fs.writeFileSync(tmp, JSON.stringify(value, null, 2));
  fs.renameSync(tmp, file);
}
function appendLine(file, obj) {
  mkdir(path.dirname(file));
  fs.appendFileSync(file, JSON.stringify(obj) + '\n');
}
function readLines(file) {
  try { return fs.readFileSync(file, 'utf8').split('\n').filter(Boolean).map(l => { try { return JSON.parse(l); } catch (e) { return null; } }).filter(Boolean); } catch (e) { return []; }
}
const safeName = s => encodeURIComponent(String(s)).replace(/%/g, '_');
const id = (n = 10) => crypto.randomBytes(n).toString('base64url').slice(0, n);
const now = () => new Date().toISOString();

const CODE_CHARS = 'ABCDEFGHJKLMNPQRSTUVWXYZ23456789';
function newCode() {
  let c = '';
  for (let i = 0; i < 5; i++) c += CODE_CHARS[crypto.randomInt(CODE_CHARS.length)];
  return c;
}

const classDir = code => path.join(DATA, 'classes', code);

const store = {
  DATA,
  id, now,

  // ---------- сессии ----------
  sessions() { return readJSON(path.join(DATA, 'sessions.json'), {}); },
  createSession(info) {
    const all = this.sessions();
    const token = id(24);
    all[token] = Object.assign({ created: now() }, info);
    writeJSON(path.join(DATA, 'sessions.json'), all);
    return token;
  },
  session(token) { return token ? this.sessions()[token] || null : null; },

  // ---------- настройки учителя (поверх config.json) ----------
  settings() { return readJSON(path.join(DATA, 'settings.json'), {}); },
  saveSettings(patch) { const s = Object.assign(this.settings(), patch); writeJSON(path.join(DATA, 'settings.json'), s); return s; },

  // ---------- классы ----------
  classes() {
    let list = [];
    try { list = fs.readdirSync(path.join(DATA, 'classes')); } catch (e) { /* нет классов */ }
    return list.map(c => this.getClass(c)).filter(Boolean).sort((a, b) => b.created.localeCompare(a.created));
  },
  getClass(code) { return code && /^[A-Z0-9]{3,8}$/.test(code) ? readJSON(path.join(classDir(code), 'class.json'), null) : null; },
  deleteClass(code) {
    if (!this.getClass(code)) return false;
    const to = path.join(DATA, 'deleted', code + '-' + now().replace(/[:.]/g, '-'));
    mkdir(path.dirname(to));
    fs.renameSync(classDir(code), to);
    return true;
  },
  createClass({ name, lesson }) {
    let code;
    do { code = newCode(); } while (this.getClass(code));
    const cls = { code, name: name || 'Класс ' + code, lesson, opened: [], authorMode: true, created: now() };
    writeJSON(path.join(classDir(code), 'class.json'), cls);
    return cls;
  },
  saveClass(cls) { writeJSON(path.join(classDir(cls.code), 'class.json'), cls); return cls; },

  // ---------- ученики ----------
  studentFile(code, nick) { return path.join(classDir(code), 'students', safeName(nick) + '.json'); },
  getStudent(code, nick) { return readJSON(this.studentFile(code, nick), null); },
  ensureStudent(code, nick) {
    let s = this.getStudent(code, nick);
    if (!s) { s = { nick, joined: now(), seen: now(), lessons: {} }; this.saveStudent(code, s); }
    return s;
  },
  saveStudent(code, s) { writeJSON(this.studentFile(code, s.nick), s); return s; },
  students(code) {
    let files = [];
    try { files = fs.readdirSync(path.join(classDir(code), 'students')); } catch (e) { /* пусто */ }
    return files.filter(f => f.endsWith('.json')).map(f => readJSON(path.join(classDir(code), 'students', f), null)).filter(Boolean);
  },
  lessonState(s, lesson) {
    s.lessons[lesson] = s.lessons[lesson] || { answers: {}, games: [], aiCalls: 0 };
    return s.lessons[lesson];
  },

  // ---------- игры и версии ----------
  gameDir(gameId) { return path.join(DATA, 'games', gameId); },
  createGame(meta) {
    const gameId = id(12);
    const g = Object.assign({ id: gameId, created: now(), versions: [], current: 0 }, meta);
    writeJSON(path.join(this.gameDir(gameId), 'game.json'), g);
    return g;
  },
  getGame(gameId) { return /^[\w-]{6,20}$/.test(gameId || '') ? readJSON(path.join(this.gameDir(gameId), 'game.json'), null) : null; },
  saveGame(g) { writeJSON(path.join(this.gameDir(g.id), 'game.json'), g); return g; },
  addVersion(g, code, info) {
    const n = g.versions.length + 1;
    fs.writeFileSync(path.join(this.gameDir(g.id), `v${n}.js`), code);
    g.versions.push(Object.assign({ n, created: now() }, info));
    g.current = n;
    this.saveGame(g);
    return n;
  },
  games() { // все игры портала: для отчёта журнала генераций
    let list = [];
    try { list = fs.readdirSync(path.join(DATA, 'games')); } catch (e) { /* игр нет */ }
    return list.map(g => this.getGame(g)).filter(Boolean);
  },
  versionCode(gameId, n) {
    try { return fs.readFileSync(path.join(this.gameDir(gameId), `v${Number(n)}.js`), 'utf8'); } catch (e) { return null; }
  },

  // ---------- рекорды ----------
  scores(gameKey) { return readJSON(path.join(DATA, 'scores', safeName(gameKey) + '.json'), {}); },
  addScore(gameKey, nick, score) {
    const file = path.join(DATA, 'scores', safeName(gameKey) + '.json');
    const all = readJSON(file, {});
    const prev = all[nick];
    if (!prev || score > prev.score) all[nick] = { score, at: now() };
    writeJSON(file, all);
    return all;
  },

  // ---------- партии чужих игроков: телеметрия, «ещё раз», карточки плейтеста ----------
  addPlay(gameId, entry) { appendLine(path.join(this.gameDir(gameId), 'plays.jsonl'), Object.assign({ at: now() }, entry)); },
  plays(gameId) { return /^[\w-]{6,20}$/.test(gameId || '') ? readLines(path.join(this.gameDir(gameId), 'plays.jsonl')) : []; },

  // ---------- вызовы «побей мой мир»: игра + версия + зерно ----------
  challenges(code) { return readJSON(path.join(classDir(code), 'challenges.json'), {}); },
  createChallenge(code, info) {
    const all = this.challenges(code);
    let ch;
    do { ch = newCode() + newCode().slice(0, 1); } while (all[ch]);
    all[ch] = Object.assign({ code: ch, at: now() }, info);
    writeJSON(path.join(classDir(code), 'challenges.json'), all);
    return all[ch];
  },
  saveChallenge(code, ch) { const all = this.challenges(code); all[ch.code] = ch; writeJSON(path.join(classDir(code), 'challenges.json'), all); return ch; },
  getChallenge(code, ch) { return this.challenges(code)[String(ch || '').trim().toUpperCase()] || null; },

  // ---------- вау-старт: игра учителя на проекторе, своя на каждый урок класса ----------
  getDemo(code, lesson) { return readJSON(path.join(classDir(code), 'demo-' + safeName(lesson) + '.json'), null); },
  saveDemo(code, lesson, d) { writeJSON(path.join(classDir(code), 'demo-' + safeName(lesson) + '.json'), d); return d; },
  dropDemo(code, lesson) { try { fs.unlinkSync(path.join(classDir(code), 'demo-' + safeName(lesson) + '.json')); } catch (e) { /* не было */ } },

  // ---------- заметки автора (статус — отдельно: новая / в работе / сделано) и журнал генераций ----------
  addNote(note) { appendLine(path.join(DATA, 'notes.jsonl'), Object.assign({ id: id(10), at: now() }, note)); },
  notes() { // у заметок до среза 3 нет id — ключ из времени и текста
    return readLines(path.join(DATA, 'notes.jsonl')).map(n => Object.assign(n, { id: n.id || 'n' + crypto.createHash('sha1').update(n.at + n.text).digest('hex').slice(0, 10) }));
  },
  noteStatus() { return readJSON(path.join(DATA, 'notes-status.json'), {}); },
  setNoteStatus(noteId, status) { const all = this.noteStatus(); all[noteId] = status; writeJSON(path.join(DATA, 'notes-status.json'), all); return all; },
  logGen(entry) { appendLine(path.join(DATA, 'genlog.jsonl'), Object.assign({ at: now() }, entry)); },
  genlog() { return readLines(path.join(DATA, 'genlog.jsonl')); },
};

module.exports = store;
