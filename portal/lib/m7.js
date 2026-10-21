// Модуль 7 «Игры вместе» (уроки 26–28): сетевая арена класса, турнирная сетка, команды джема.
//   Арена (урок 26) — забег «Арены класса» (games/arena-klassa.js) по сети: ученики шлют своё положение 10 раз в секунду,
//     сервер раздаёт соседей, часы и правила забега. Живёт в памяти: перезапуск сервера — новый забег, итоги раундов пишутся в класс.
//   Сетка (урок 26) — турнир на одном компьютере вдвоём: пары, победителя отмечает любой из двоих, учитель может поправить.
//   Команды (уроки 27–28) — джем по три: роли, карточки «донор + легенда» на кубике, мозговой штурм «10 идей за 10 минут»,
//     общий замысел (шаги с team: true — ответ одного уходит всей команде) и одна игра на команду (её версии видит каждый участник).
// Подключается из server.js: require('./lib/m7')({ route, needStudent, needTeacher, needDayClass, broadcast, store, saveStudentField }).
'use strict';
const crypto = require('crypto');

const num = (v, a, b, d = 0) => { const x = Number(v); return Number.isFinite(x) ? Math.max(a, Math.min(b, x)) : d; };
const shuffle = list => { const a = list.slice(); for (let i = a.length - 1; i > 0; i--) { const j = crypto.randomInt(0, i + 1); [a[i], a[j]] = [a[j], a[i]]; } return a; };
const bad = (msg, status = 400) => Object.assign(new Error(msg), { status });

// правила забега, которые учитель (или голос класса) может поменять: те же ручки, что у игры
const RULES = { beg: [3, 12], pryzhok: [5, 13], gravity: [6, 34], vertushki: [0, 2.5], plity: [0.2, 3], tolkat: [0, 1], kvota: [0.1, 1], brevna: [0, 1] };
const cleanRules = r => Object.fromEntries(Object.entries(r && typeof r === 'object' ? r : {}).filter(([k, v]) => RULES[k] && Number.isFinite(Number(v))).map(([k, v]) => [k, num(v, RULES[k][0], RULES[k][1])]));
const ROLES = ['Режиссёр', 'Мастер Qwen', 'Тестер'];

module.exports = function m7({ route, needStudent, needTeacher, needDayClass, broadcast, store, saveStudentField, lesson }) {
  /* ================= арена ================= */
  const arenas = new Map(); // код класса → забег
  const arenaOf = code => {
    if (!arenas.has(code)) arenas.set(code, { round: 0, phase: 'off', start: 0, rules: {}, players: new Map(), results: [], votes: new Map(), cards: [] });
    return arenas.get(code);
  };
  const fresh = (a, p) => p.round === a.round && Date.now() - p.at < 3000;
  const runners = a => [...a.players.values()].filter(p => p.round === a.round && (a.phase !== 'run' || p.seenRun));
  function quotaOf(a) {
    const n = runners(a).length, k = a.rules.kvota != null ? a.rules.kvota : 0.6;
    return { n, quota: Math.max(1, Math.round(n * k)) };
  }
  function room(a) {
    const q = quotaOf(a);
    return { round: a.round, phase: a.phase, start: a.start, rules: a.rules, n: q.n, quota: q.quota, results: a.results.slice(0, 40) };
  }
  function tally(a) {
    const count = {};
    for (const id of a.votes.values()) count[id] = (count[id] || 0) + 1;
    return a.cards.map(c => ({ id: c.id, label: c.label, votes: count[c.id] || 0 }));
  }
  function arenaPublic(code, nick) {
    const a = arenaOf(code);
    return Object.assign(room(a), { now: Date.now(), players: [...a.players.values()].filter(p => fresh(a, p)).length, cards: tally(a), myVote: nick ? a.votes.get(nick) || null : null });
  }
  const arenaChanged = code => broadcast(code, 'arena', arenaPublic(code));
  function finishRound(code, a) {
    if (a.phase === 'done') return;
    a.phase = 'done';
    const cls = store.getClass(code);
    if (cls) { cls.arenaLog = (cls.arenaLog || []).concat({ round: a.round, at: new Date().toISOString(), rules: a.rules, n: quotaOf(a).n, results: a.results.slice(0, 40) }).slice(-30); store.saveClass(cls); }
  }

  // положение ученика: сессия из памяти, без чтения файлов — запрос идёт 10 раз в секунду от каждого
  route('POST', '/api/arena/move', (ctx) => {
    const w = ctx.who;
    if (!w || w.role !== 'student') throw bad('Войди по коду класса', 401);
    const a = arenaOf(w.class), m = ctx.body.me || {};
    let p = a.players.get(w.nick);
    if (!p || p.round !== a.round) { p = { n: w.nick, round: a.round, f: null }; a.players.set(w.nick, p); }
    Object.assign(p, { x: num(m.x, -40, 40), y: num(m.y, -60, 40), z: num(m.z, -200, 20), ry: num(m.ry, -10, 10), a: ['d', 'j', 's'].includes(m.a) ? m.a : '', cp: Math.round(num(m.cp, 0, 9)), at: Date.now() });
    const live = a.phase === 'run' && Date.now() >= a.start;
    if (live) p.seenRun = true;
    if (live && p.f == null && m.f != null && Number.isFinite(Number(m.f))) {
      p.f = Math.round(num(m.f, 0, 999) * 10) / 10;
      a.results.push({ nick: w.nick, t: p.f }); a.results.sort((x, y) => x.t - y.t);
      const q = quotaOf(a);
      if (a.results.length >= q.quota) finishRound(w.class, a);
      arenaChanged(w.class);
    }
    const others = [...a.players.values()].filter(o => o.n !== w.nick && fresh(a, o)).slice(0, 60).map(o => ({ n: o.n, x: o.x, y: o.y, z: o.z, ry: o.ry, a: o.a, cp: o.cp, f: o.f }));
    return { now: Date.now(), room: room(a), others, me: { f: p.f, place: p.f == null ? null : a.results.findIndex(r => r.nick === w.nick) + 1 } };
  });
  route('GET', '/api/arena', (ctx) => {
    const w = ctx.who;
    if (w && w.role === 'student') return arenaPublic(w.class, w.nick);
    const { cls } = needDayClass(ctx);
    const a = arenaOf(cls.code);
    return Object.assign(arenaPublic(cls.code), { dots: [...a.players.values()].filter(p => fresh(a, p)).map(p => ({ n: p.n, x: p.x, z: p.z, f: p.f })), log: (cls.arenaLog || []).slice(-6) });
  });
  // голос за правило следующего забега: карточки правил задаёт урок (шаг arena, step.cards), учитель применяет победителя
  route('POST', '/api/arena/vote', (ctx) => {
    const { w, les } = needStudent(ctx);
    const a = arenaOf(w.class);
    const step = les.checkpoints.flatMap(c => c.steps).find(s => s.type === 'arena' && s.cards);
    if (step && !a.cards.length) a.cards = step.cards.map(c => ({ id: c.id, label: c.label, rules: cleanRules(c.rules) }));
    const id = String(ctx.body.card || '');
    if (!a.cards.some(c => c.id === id)) throw bad('Нет такого правила');
    if (a.votes.get(w.nick) === id) a.votes.delete(w.nick); else a.votes.set(w.nick, id);
    arenaChanged(w.class);
    return arenaPublic(w.class, w.nick);
  });
  // учитель: open — загон нового забега, start — старт через 3 секунды, end — закончить, rules — свои правила или карточка-победитель
  route('POST', '/api/teacher/arena', (ctx) => {
    const { cls, les } = needDayClass(ctx);
    const a = arenaOf(cls.code), act = ctx.body.action;
    const step = les && les.checkpoints.flatMap(c => c.steps).find(s => s.type === 'arena' && s.cards);
    if (step && !a.cards.length) a.cards = step.cards.map(c => ({ id: c.id, label: c.label, rules: cleanRules(c.rules) }));
    if (act === 'open') { a.round++; a.phase = 'lobby'; a.start = 0; a.results = []; }
    else if (act === 'start') { if (a.phase === 'off' || a.phase === 'done') { a.round++; a.results = []; } a.phase = 'run'; a.start = Date.now() + 3000; }
    else if (act === 'end') finishRound(cls.code, a);
    else if (act === 'rules') {
      const card = a.cards.find(c => c.id === ctx.body.card);
      a.rules = card ? Object.assign({}, card.rules) : cleanRules(ctx.body.rules);
      if (card) a.votes.clear();
    } else if (act === 'close') { a.phase = 'off'; a.players.clear(); }
    else throw bad('Нет такого действия');
    arenaChanged(cls.code);
    return arenaPublic(cls.code);
  });

  /* ================= турнирная сетка ================= */
  // cls.bracket = { at, rounds: [[{ a, b, w }]] }: первый круг из учеников, дальше победители; пустое место — проход без игры
  function bracketPublic(cls) {
    const b = cls.bracket;
    if (!b) return null;
    const last = b.rounds[b.rounds.length - 1][0];
    return { at: b.at, game: b.game || null, rounds: b.rounds, champion: last && last.w || null };
  }
  function settle(b) {
    // проход без соперника и продвижение победителей по кругам
    for (let r = 0; r < b.rounds.length; r++) for (let i = 0; i < b.rounds[r].length; i++) {
      const m = b.rounds[r][i];
      if (r > 0) { const pa = b.rounds[r - 1][2 * i], pb = b.rounds[r - 1][2 * i + 1]; const na = pa ? pa.w : null, nb = pb ? pb.w : null; if (m.a !== na || m.b !== nb) { m.a = na; m.b = nb; if (m.w && m.w !== na && m.w !== nb) m.w = null; } }
      const prevDone = r === 0 || (b.rounds[r - 1][2 * i].done && b.rounds[r - 1][2 * i + 1].done);
      if (prevDone && !m.w && (m.a && !m.b || !m.a && m.b)) { m.w = m.a || m.b; m.bye = true; }
      m.done = !!m.w || (prevDone && !m.a && !m.b);
    }
  }
  function makeBracket(nicks) {
    let size = 2; while (size < nicks.length) size *= 2;
    const seats = shuffle(nicks).concat(Array(size - nicks.length).fill(null));
    // пустые места — по краям пар, чтобы два пустых не встретились в одной паре
    const first = [];
    const real = seats.filter(Boolean), byes = size - real.length;
    for (let i = 0; i < size / 2; i++) first.push({ a: real.shift() || null, b: i < size / 2 - byes ? real.pop() || null : null, w: null });
    const rounds = [first];
    for (let n = size / 4; n >= 1; n /= 2) rounds.push(Array.from({ length: n }, () => ({ a: null, b: null, w: null })));
    const b = { at: new Date().toISOString(), rounds }; settle(b); return b;
  }
  route('GET', '/api/bracket', (ctx) => {
    const w = ctx.who;
    const cls = w && w.role === 'student' ? store.getClass(w.class) : needDayClass(ctx).cls;
    return { bracket: bracketPublic(cls) };
  });
  route('POST', '/api/bracket/win', (ctx) => {
    const { w, cls } = needStudent(ctx);
    const b = cls.bracket; if (!b) throw bad('Сетки ещё нет');
    const m = (b.rounds[ctx.body.round] || [])[ctx.body.match];
    if (!m || !m.a || !m.b) throw bad('Нет такой пары');
    if (w.nick !== m.a && w.nick !== m.b) throw bad('Победителя отмечает один из двоих игроков', 403);
    if (ctx.body.winner !== m.a && ctx.body.winner !== m.b) throw bad('Победитель — один из двоих');
    const next = b.rounds[ctx.body.round + 1];
    if (next && next[ctx.body.match >> 1].w) throw bad('Следующая пара уже сыграла: поправить может учитель', 409);
    m.w = ctx.body.winner; m.by = w.nick; settle(b); store.saveClass(cls);
    broadcast(cls.code, 'bracket', bracketPublic(cls));
    return { bracket: bracketPublic(cls) };
  });
  // учитель: make — сетка из учеников на связи (или из списка players), win — поправить победителя, reset — убрать сетку
  route('POST', '/api/teacher/bracket', (ctx) => {
    const { cls } = needDayClass(ctx), act = ctx.body.action;
    if (act === 'make') {
      const list = Array.isArray(ctx.body.players) && ctx.body.players.length ? ctx.body.players.map(String) : store.students(cls.code).filter(s => s.seen && Date.now() - Date.parse(s.seen) < 30 * 60e3).map(s => s.nick);
      const nicks = [...new Set(list)].filter(Boolean).slice(0, 64);
      if (nicks.length < 2) throw bad('Для сетки нужны хотя бы двое учеников на связи');
      cls.bracket = Object.assign(makeBracket(nicks), { game: ctx.body.game || null });
    } else if (act === 'win') {
      const b = cls.bracket, m = b && (b.rounds[ctx.body.round] || [])[ctx.body.match];
      if (!m) throw bad('Нет такой пары');
      m.w = ctx.body.winner === m.a || ctx.body.winner === m.b ? ctx.body.winner : null; m.by = 'учитель';
      // поправка тянет за собой следующие круги: там пары пересоберутся
      for (let r = ctx.body.round + 1, i = ctx.body.match >> 1; r < b.rounds.length; r++, i >>= 1) b.rounds[r][i].w = null;
      settle(b);
    } else if (act === 'reset') cls.bracket = null;
    else throw bad('Нет такого действия');
    store.saveClass(cls);
    broadcast(cls.code, 'bracket', bracketPublic(cls));
    return { bracket: bracketPublic(cls) };
  });

  /* ================= команды джема ================= */
  // cls.teams = { list: [{ id, name, emblem, members, roles, cards, ideas, brainAt, pick, gameId }] }
  // Команды живут через оба урока джема (27 и 28): урок 28 продолжает команды урока 27.
  // Модуль 8: у уроков 29–36 своя группа команд (teamGroup: 'proekt' в сценарии) — команды проекта живут через все восемь уроков,
  // не смешиваясь с командами джема. Группа — по уроку, открытому в классе.
  const JAM = new Set(['urok-27', 'urok-28']);
  const groupOf = id => { const l = id && lesson ? lesson(id) : null; return (l && l.teamGroup) || (JAM.has(id) ? 'dzhem' : null); };
  const teamsOf = cls => {
    const g = groupOf(cls.lesson);
    if (!g || g === 'dzhem') { if (!cls.teams) cls.teams = { list: [] }; return cls.teams; }
    if (!cls.teamsBy) cls.teamsBy = {};
    if (!cls.teamsBy[g]) cls.teamsBy[g] = { list: [] };
    return cls.teamsBy[g];
  };
  const myTeam = (cls, nick) => teamsOf(cls).list.find(t => t.members.includes(nick)) || null;
  const teamCard = t => ({ id: t.id, name: t.name, emblem: t.emblem, members: t.members, roles: t.roles, cards: t.cards ? { donor: t.cards.donor, legend: t.cards.legend, locked: t.cards.locked } : null, ideas: t.ideas.length, pick: t.pick ? t.pick.text : null, gameId: t.gameId || null });
  function teamFull(t) {
    return Object.assign(teamCard(t), {
      cards: t.cards, brainAt: t.brainAt, now: Date.now(),
      ideas: t.ideas.map(i => ({ id: i.id, text: i.text, by: i.by, votes: i.votes.length, voters: i.votes })),
      pick: t.pick || null,
    });
  }
  const teamChanged = (code, t) => broadcast(code, 'team', { team: t ? t.id : null });
  const jamStep = (les, type) => les.checkpoints.flatMap(c => c.steps).find(s => s.type === type) || null;
  function needTeam(ctx) {
    const c = needStudent(ctx);
    const t = myTeam(c.cls, c.w.nick);
    if (!t) throw bad('Сначала вступи в команду');
    return Object.assign(c, { t });
  }
  // общая игра команды: все участники смотрят и пишут в одну игру (версии от любого из троих)
  function shareGame(code, les, t) {
    if (!t.gameId) return;
    for (const nick of t.members) saveStudentField(code, nick, les.id, st => { st.gameId = t.gameId; });
    const g = store.getGame(t.gameId);
    if (g && (g.team !== t.name || String(g.members) !== String(t.members))) { g.team = t.name; g.members = t.members.slice(); store.saveGame(g); }
  }
  const save = (cls, t) => { store.saveClass(cls); teamChanged(cls.code, t); return { team: teamFull(t), teams: teamsOf(cls).list.map(teamCard) }; };

  route('GET', '/api/team', (ctx) => {
    const { w, cls } = needStudent(ctx);
    const t = myTeam(cls, w.nick);
    return { team: t ? teamFull(t) : null, teams: teamsOf(cls).list.map(teamCard), roles: ROLES };
  });
  route('POST', '/api/team/create', (ctx) => {
    const { w, cls, les } = needStudent(ctx);
    const T = teamsOf(cls);
    const name = String(ctx.body.name || '').trim().replace(/\s+/g, ' ').slice(0, 30);
    if (name.length < 2) throw bad('Назови команду: от 2 букв');
    if (T.list.some(t => t.name.toLowerCase() === name.toLowerCase())) throw bad('Такая команда уже есть — вступи в неё или придумай другое имя');
    const old = myTeam(cls, w.nick); if (old) leave(cls, old, w.nick);
    const t = { id: store.id(), name, emblem: String(ctx.body.emblem || '').slice(0, 4), members: [w.nick], roles: { [w.nick]: ROLES[0] }, cards: null, ideas: [], brainAt: null, pick: null, gameId: null, lesson: les.id };
    T.list.push(t);
    return save(cls, t);
  });
  function leave(cls, t, nick) {
    t.members = t.members.filter(n => n !== nick); delete t.roles[nick];
    if (!t.members.length && !t.gameId && !t.ideas.length) teamsOf(cls).list = teamsOf(cls).list.filter(x => x !== t);
  }
  route('POST', '/api/team/join', (ctx) => {
    const { w, cls, les } = needStudent(ctx);
    const t = teamsOf(cls).list.find(x => x.id === ctx.body.team);
    if (!t) throw bad('Нет такой команды', 404);
    const size = (jamStep(les, 'team') || {}).size || 3;
    if (!t.members.includes(w.nick)) {
      if (t.members.length >= size + 1) throw bad(`В команде уже ${t.members.length}: выбери другую`);
      const old = myTeam(cls, w.nick); if (old) leave(cls, old, w.nick);
      t.members.push(w.nick);
      const free = ROLES.find(r => !Object.values(t.roles).includes(r)); t.roles[w.nick] = free || ROLES[2];
    }
    shareGame(cls.code, les, t);
    return save(cls, t);
  });
  route('POST', '/api/team/leave', (ctx) => {
    const { w, cls, t } = needTeam(ctx);
    leave(cls, t, w.nick);
    return Object.assign(save(cls, t), { team: null });
  });
  route('POST', '/api/team/role', (ctx) => {
    const { w, cls, t } = needTeam(ctx);
    if (!ROLES.includes(ctx.body.role)) throw bad('Нет такой роли');
    t.roles[w.nick] = ctx.body.role;
    return save(cls, t);
  });
  // карточки джема: донор (жанр-основа) и легенда Адыгеи. Кубик — случайная карта; один переброс на каждую, потом «Берём!»
  route('POST', '/api/team/cards', (ctx) => {
    const { cls, les, t } = needTeam(ctx);
    const step = jamStep(les, 'jamcards');
    if (!step) throw bad('В этом уроке нет карточек джема');
    t.cards = t.cards || { donor: null, legend: null, rerolls: { donor: 1, legend: 1 }, locked: false };
    const c = t.cards;
    if (ctx.body.action === 'lock') {
      if (!c.donor || !c.legend) throw bad('Сначала брось оба кубика');
      c.locked = true; c.at = new Date().toISOString();
      // карточки уходят в Фабрику каждого участника: донор — выбранная классика, легенда — поле legenda
      const fac = les.plan && les.plan.factory;
      if (fac) for (const nick of t.members) saveStudentField(cls.code, nick, les.id, st => {
        const a = st.answers[fac] = Object.assign({ value: {}, done: false }, st.answers[fac]);
        a.value = Object.assign({}, a.value, { donor: c.donor.id, fields: Object.assign({}, (a.value || {}).fields, { legenda: { text: `${c.legend.title}: ${c.legend.text}`, card: true } }) });
        a.at = new Date().toISOString();
      });
      if (fac) setImmediate(() => broadcast(cls.code, 'team', { team: t.id, step: fac }));
    }
    else {
      const what = ctx.body.what === 'legend' ? 'legend' : 'donor';
      if (c.locked) throw bad('Карточки уже взяты');
      const deck = what === 'legend' ? step.legends : step.donors;
      if (c[what]) { if (c.rerolls[what] <= 0) throw bad('Переброс уже потрачен'); c.rerolls[what]--; }
      const pool = deck.filter(x => !c[what] || x.id !== c[what].id);
      const taken = new Set(teamsOf(cls).list.filter(x => x !== t && x.cards && x.cards[what]).map(x => x.cards[what].id));
      const freshPool = pool.filter(x => !taken.has(x.id));
      const card = (freshPool.length ? freshPool : pool)[crypto.randomInt(0, (freshPool.length ? freshPool : pool).length)];
      c[what] = { id: card.id, title: card.title, text: card.text || '', game: card.game || null, hint: card.hint || '' };
    }
    return save(cls, t);
  });
  // мозговой штурм: 10 минут, идея — одна строка, голос — по одному на идею, своя идея не голосуется
  route('POST', '/api/team/brain', (ctx) => {
    const { cls, t } = needTeam(ctx);
    if (!t.brainAt) t.brainAt = Date.now();
    return save(cls, t);
  });
  route('POST', '/api/team/idea', (ctx) => {
    const { w, cls, t } = needTeam(ctx);
    const text = String(ctx.body.text || '').trim().replace(/\s+/g, ' ').slice(0, 140);
    if (text.length < 3) throw bad('Идея — хотя бы несколько слов');
    if (t.ideas.length >= 60) throw bad('Идей уже 60 — пора выбирать');
    if (!t.brainAt) t.brainAt = Date.now();
    t.ideas.push({ id: store.id(), text, by: w.nick, votes: [], at: Date.now() });
    return save(cls, t);
  });
  route('POST', '/api/team/idea/vote', (ctx) => {
    const { w, cls, t } = needTeam(ctx);
    const i = t.ideas.find(x => x.id === ctx.body.id);
    if (!i) throw bad('Нет такой идеи', 404);
    i.votes = i.votes.includes(w.nick) ? i.votes.filter(n => n !== w.nick) : i.votes.concat(w.nick);
    return save(cls, t);
  });
  route('POST', '/api/team/pick', (ctx) => {
    const { w, cls, les, t } = needTeam(ctx);
    const i = t.ideas.find(x => x.id === ctx.body.id);
    if (!i) throw bad('Нет такой идеи', 404);
    t.pick = { id: i.id, text: i.text, by: w.nick, votes: i.votes.length };
    // выбранная идея становится твистом в Фабрике всей команды
    const fac = les.plan && les.plan.factory;
    if (fac) for (const nick of t.members) saveStudentField(cls.code, nick, les.id, st => {
      const a = st.answers[fac] = Object.assign({ value: {}, done: false }, st.answers[fac]);
      a.value = Object.assign({}, a.value, { fields: Object.assign({}, (a.value || {}).fields, { twist: { text: i.text, card: true } }) });
      a.at = new Date().toISOString();
    });
    const out = save(cls, t);
    if (fac) broadcast(cls.code, 'team', { team: t.id, step: fac }); // Фабрика команды обновится на экранах
    return out;
  });
  // игра команды: первый, кто вставил код из чата Qwen, создал игру — она становится общей
  route('POST', '/api/team/game', (ctx) => {
    const { cls, les, st, t } = needTeam(ctx);
    if (!t.gameId) { if (!st.gameId) throw bad('Игры ещё нет: Мастер Qwen вставляет первый код из чата'); t.gameId = st.gameId; }
    shareGame(cls.code, les, t);
    return save(cls, t);
  });
  // учитель: auto — разложить учеников без команды по командам (по size), move — перевести ученика, reset — убрать все команды
  route('GET', '/api/teacher/teams', (ctx) => {
    const { cls } = needDayClass(ctx);
    const inTeam = new Set(teamsOf(cls).list.flatMap(t => t.members));
    return { teams: teamsOf(cls).list.map(teamFull), free: store.students(cls.code).map(s => s.nick).filter(n => !inTeam.has(n)) };
  });
  route('POST', '/api/teacher/teams', (ctx) => {
    const { cls, les } = needDayClass(ctx), T = teamsOf(cls), act = ctx.body.action;
    const NAMES = ['Нарты', 'Сосруко', 'Бадыноко', 'Тлепш', 'Сатаней', 'Ашамез', 'Псатха', 'Химишко'];
    if (act === 'auto') {
      const size = num(ctx.body.size, 2, 4, 3);
      const inTeam = new Set(T.list.flatMap(t => t.members));
      const free = shuffle(store.students(cls.code).filter(s => s.seen && Date.now() - Date.parse(s.seen) < 30 * 60e3).map(s => s.nick).filter(n => !inTeam.has(n)));
      // сначала добираем неполные команды, потом новые по size; хвост из одного — в последнюю команду
      for (const t of T.list) while (t.members.length < size && free.length) { const n = free.shift(); t.members.push(n); t.roles[n] = ROLES.find(r => !Object.values(t.roles).includes(r)) || ROLES[2]; }
      while (free.length) {
        if (free.length === 1 && T.list.length) { const t = T.list[T.list.length - 1], n = free.shift(); t.members.push(n); t.roles[n] = ROLES[2]; break; }
        const used = new Set(T.list.map(t => t.name)), name = NAMES.find(x => !used.has(x)) || 'Команда ' + (T.list.length + 1);
        const members = free.splice(0, size);
        T.list.push({ id: store.id(), name, emblem: '', members, roles: Object.fromEntries(members.map((n, i) => [n, ROLES[i] || ROLES[2]])), cards: null, ideas: [], brainAt: null, pick: null, gameId: null, lesson: les.id });
      }
    } else if (act === 'move') {
      const nick = String(ctx.body.nick || ''), to = T.list.find(t => t.id === ctx.body.team);
      const from = T.list.find(t => t.members.includes(nick)); if (from) leave(cls, from, nick);
      if (to) { to.members.push(nick); to.roles[nick] = ROLES[2]; shareGame(cls.code, les, to); }
    } else if (act === 'reset') { T.list = []; }
    else throw bad('Нет такого действия');
    store.saveClass(cls); teamChanged(cls.code, null);
    return { teams: T.list.map(teamFull) };
  });

  // для server.js: ученик в команде с игрой — его версии идут в игру команды
  return {
    teamGameId(code, nick, lessonId) {
      if (!groupOf(lessonId)) return null;
      const cls = store.getClass(code), t = cls && myTeam(cls, nick);
      return t && t.gameId ? t.gameId : null;
    },
    // первая игра участника команды без игры становится игрой команды
    claimGame(code, nick, lessonId, gameId) {
      if (!groupOf(lessonId)) return;
      const cls = store.getClass(code), t = cls && myTeam(cls, nick);
      if (!t || t.gameId) return;
      t.gameId = gameId; const les = { id: lessonId };
      store.saveClass(cls); shareGame(code, les, t); teamChanged(code, t);
    },
    // шаг с team: true — ответ одного участника получают все (замысел команды); остальным — событие team со шагом
    fanout(code, nick, les, step, answer) {
      if (!step.team) return;
      const cls = store.getClass(code), t = cls && myTeam(cls, nick);
      if (!t) return;
      for (const n of t.members) if (n !== nick) saveStudentField(code, n, les.id, st => { st.answers[step.id] = Object.assign({}, answer, { by: nick }); });
      broadcast(code, 'team', { team: t.id, step: step.id, from: nick });
    },
    teamOf(code, nick, id) { const cls = store.getClass(code); if (!cls) return null; return id ? teamsOf(cls).list.find(t => t.id === id) || null : myTeam(cls, nick); },
    arenaPublic, bracketPublic, ROLES, groupOf,
  };
};
