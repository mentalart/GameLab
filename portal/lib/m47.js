// Модули 4–7 (аудит уроков, сессия 6): сервер двух шагов класса.
// kvest — урок-квест (урок 16, Г4): класс вместе исследует одну большую карту донора, секреты общие. Карта — поле map шага (строки,
//   'S' — секрет). Игра шлёт находку через lab.net, шаг — POST /api/kvest/found; кто нашёл первым, того ник и стоит на карте класса.
//   Состояние — cls.kvest { lesson, step, found: { 'кол,строка': { nick, at } } }; учитель на проекторе может начать заново.
// sovet — совет аула (урок 19, Г1 «игра класса»): учитель на проекторе ведёт карты старейшины, класс с ноутбуков голосует ← или →,
//   «Решить» применяет большинство к четырём шкалам аула. Карта с if: { card, side } приходит, только если класс раньше так решил:
//   решения возвращаются. Шкала на 0 или 100 — правление окончено. Состояние — cls.sovet.
// Подключается из server.js: require('./lib/m47')({ route, needStudent, needTeacher, broadcast, store, lesson, stepOf }).
'use strict';

const bad = (msg, status = 400) => Object.assign(new Error(msg), { status });

module.exports = function m47({ route, needStudent, needTeacher, broadcast, store, lesson, stepOf }) {
  const classOf = code => { const cls = store.getClass(String(code || '')); if (!cls) throw bad('Нет класса', 404); return cls; };
  const firstOf = (les, type) => (les ? les.checkpoints.flatMap(c => c.steps).find(s => s.type === type) : null);

  /* ================= урок-квест ================= */
  const keysOf = st => { const out = []; String(st.map || '').split('\n').forEach((row, r) => [...row].forEach((ch, k) => { if (ch === 'S') out.push(k + ',' + r); })); return out; };
  // состояние квеста этого урока: другой урок или другой шаг — квест с чистой карты
  function kvestOf(cls) {
    const les = lesson(cls.lesson), st = firstOf(les, 'kvest');
    if (!st) return null;
    const k = cls.kvest && cls.kvest.lesson === les.id && cls.kvest.step === st.id ? cls.kvest : { lesson: les.id, step: st.id, found: {}, at: store.now() };
    return { k, st, keys: keysOf(st) };
  }
  function kvestView(cls, nick) {
    const x = kvestOf(cls);
    if (!x) return null;
    const found = Object.entries(x.k.found).filter(([key]) => x.keys.includes(key)).map(([key, f]) => ({ key, nick: f.nick, at: f.at })).sort((a, b) => (a.at > b.at ? 1 : -1));
    const out = { step: x.st.id, total: x.keys.length, found, players: [...new Set(found.map(f => f.nick))].length };
    if (nick != null) out.mine = found.filter(f => f.nick === nick).length;
    return out;
  }
  const kvestEvent = cls => broadcast(cls.code, 'kvest', kvestView(cls) || { off: true });
  route('GET', '/api/kvest', (ctx) => { const { w, cls } = needStudent(ctx); return { kvest: kvestView(cls, w.nick) }; });
  route('POST', '/api/kvest/found', (ctx) => {
    const { w, cls } = needStudent(ctx);
    const x = kvestOf(cls);
    if (!x) throw bad('В этом уроке нет квеста');
    const key = String(ctx.body.key || '');
    if (!x.keys.includes(key)) throw bad('Такого секрета на карте нет');
    let first = false;
    if (!x.k.found[key]) { x.k.found[key] = { nick: w.nick, at: store.now() }; first = true; cls.kvest = x.k; store.saveClass(cls); kvestEvent(cls); }
    return { kvest: kvestView(cls, w.nick), first };
  });
  route('GET', '/api/teacher/kvest', (ctx) => { needTeacher(ctx); return { kvest: kvestView(classOf(ctx.url.searchParams.get('code'))) }; });
  route('POST', '/api/teacher/kvest', (ctx) => {
    needTeacher(ctx);
    const cls = classOf(ctx.body.code);
    if (ctx.body.action !== 'reset') throw bad('Нет такого действия');
    const x = kvestOf(cls);
    if (!x) throw bad('В этом уроке нет квеста');
    cls.kvest = Object.assign({}, x.k, { found: {}, at: store.now() });
    store.saveClass(cls); kvestEvent(cls);
    return { kvest: kvestView(cls) };
  });

  /* ================= совет аула ================= */
  const clamp = v => Math.max(0, Math.min(100, v));
  const sovetNow = cls => { const x = cls.sovet; return x && x.lesson === cls.lesson ? x : null; };
  const stepIn = (les, id) => { const f = les && id && stepOf(les, id); return f && f.step.type === 'sovet' ? f.step : null; };
  // следующая карта: первая несыгранная по порядку; карта с if — только если класс раньше решил так
  const nextCard = (st, x) => st.cards.find(c => !x.log.some(l => l.card === c.id) && (!c.if || x.log.some(l => l.card === c.if.card && l.side === c.if.side)));
  const countVotes = x => { const v = Object.values(x.votes || {}); return { left: v.filter(s => s === 'left').length, right: v.filter(s => s === 'right').length }; };
  const publicCard = c => (c ? { id: c.id, who: c.who, icon: c.icon, text: c.text, left: c.left.label, right: c.right.label, echo: !!c.if } : null);
  // viewer — ник ученика (без числа голосов, пока сам не проголосовал) или 'teacher'
  function sovetView(cls, viewer) {
    const x = sovetNow(cls), les = x && lesson(cls.lesson), st = x && stepIn(les, x.step);
    if (!st) return null;
    const card = x.card ? st.cards.find(c => c.id === x.card) : null, mine = viewer && viewer !== 'teacher' ? (x.votes || {})[viewer] || null : null;
    const out = { step: st.id, phase: x.phase, scales: x.scales, card: publicCard(card), season: x.log.length + 1, end: x.end || null,
      log: x.log.map(l => { const c = st.cards.find(y => y.id === l.card) || {}; return { card: l.card, who: c.who, icon: c.icon, side: l.side, label: (c[l.side] || {}).label, fx: l.fx, votes: l.votes, echo: !!c.if }; }),
      n: Object.keys(x.votes || {}).length, at: x.at };
    if (viewer === 'teacher' || mine || x.phase !== 'card') out.votes = countVotes(x);
    if (viewer && viewer !== 'teacher') out.mine = mine;
    return out;
  }
  const sovetEvent = cls => broadcast(cls.code, 'sovet', { phase: (sovetNow(cls) || {}).phase || null });
  route('GET', '/api/sovet', (ctx) => { const { w, cls } = needStudent(ctx); return { sovet: sovetView(cls, w.nick) }; });
  route('POST', '/api/sovet/vote', (ctx) => {
    const { w, cls } = needStudent(ctx);
    const x = sovetNow(cls);
    if (!x || x.phase !== 'card') throw bad('Совет ещё не начался', 409);
    if (ctx.body.card !== x.card) throw bad('Карта уже сменилась', 409);
    const side = ctx.body.side === 'right' ? 'right' : ctx.body.side === 'left' ? 'left' : null;
    if (!side) throw bad('Выбери ← или →');
    x.votes = Object.assign({}, x.votes, { [w.nick]: side }); // голос можно перенести, пока учитель не решил
    store.saveClass(cls); sovetEvent(cls);
    return { sovet: sovetView(cls, w.nick) };
  });
  route('GET', '/api/teacher/sovet', (ctx) => { needTeacher(ctx); return { sovet: sovetView(classOf(ctx.url.searchParams.get('code')), 'teacher') }; });
  route('POST', '/api/teacher/sovet', (ctx) => {
    needTeacher(ctx);
    const cls = classOf(ctx.body.code), les = lesson(cls.lesson), b = ctx.body;
    if (b.action === 'reset') cls.sovet = null;
    else if (b.action === 'start') {
      const st = stepIn(les, b.step) || firstOf(les, 'sovet');
      if (!st) throw bad('В этом уроке нет совета');
      const x = { lesson: les.id, step: st.id, phase: 'card', scales: (st.start || [50, 50, 50, 50]).slice(0, st.scales.length), log: [], votes: {}, end: null, at: store.now() };
      x.card = nextCard(st, x).id;
      cls.sovet = x;
    } else if (b.action === 'decide') {
      const x = sovetNow(cls), st = x && stepIn(les, x.step);
      if (!st || x.phase !== 'card') throw bad('Карты на столе нет');
      const c = st.cards.find(y => y.id === x.card), votes = countVotes(x), side = votes.right > votes.left ? 'right' : 'left'; // поровну — как в Reigns: «нет»
      const fx = (c[side].fx || []).slice(0, x.scales.length);
      x.scales = x.scales.map((v, i) => clamp(v + (fx[i] || 0) * 10));
      x.log = x.log.concat({ card: c.id, side, fx, votes });
      x.votes = {}; x.at = store.now();
      const broke = x.scales.findIndex(v => v <= 0 || v >= 100), next = nextCard(st, x);
      if (broke >= 0) Object.assign(x, { phase: 'end', card: null, end: { scale: broke, high: x.scales[broke] >= 100 } });
      else if (!next) Object.assign(x, { phase: 'end', card: null, end: { all: true } });
      else x.card = next.id;
    } else throw bad('Нет такого действия');
    store.saveClass(cls); sovetEvent(cls);
    return { sovet: sovetView(cls, 'teacher') };
  });

  return { kvestView, sovetView };
};
