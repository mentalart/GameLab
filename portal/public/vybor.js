// Интерактивы модуля 3 «Выбор, вызов, баланс» (уроки 9–13) для страницы ученика: типы шагов curve, pig, pulse, scale, table
// и мини-график spark для карточек квиза sort. Подключается после student.js и берёт его помощники (el, api, S, ans, tiles, Games…).
'use strict';

const doneTag = (n, one, few, many) => { const a = Math.abs(n) % 100, b = a % 10; return a > 10 && a < 20 ? many : b === 1 ? one : b >= 2 && b <= 4 ? few : many; };
const svgEl = (tag, attrs, ...kids) => {
  const n = document.createElementNS('http://www.w3.org/2000/svg', tag);
  for (const [k, v] of Object.entries(attrs || {})) if (v != null) n.setAttribute(k, v);
  kids.flat().forEach(k => k != null && n.append(k));
  return n;
};
const comma = x => String(x).replace('.', ',');

// моушн-дизайн (автор, 20.10.2026): живая схема понятия (svg.mo в html шага text) оживает, когда её видно, щелчок — показать ещё раз.
// Плавные движения по пути — SMIL (animateMotion); если ученик просил меньше движения, они стоят на месте.
const calm = () => window.matchMedia && matchMedia('(prefers-reduced-motion: reduce)').matches;
const moSeen = 'IntersectionObserver' in window ? new IntersectionObserver(es => es.forEach(e => { if (e.isIntersecting) { e.target.classList.add('go'); moSeen.unobserve(e.target); } }), { threshold: 0.35 }) : null;
function liven(root) {
  root.querySelectorAll('svg.mo').forEach(svg => {
    if (calm() && svg.pauseAnimations) svg.pauseAnimations();
    if (moSeen) moSeen.observe(svg); else svg.classList.add('go');
    svg.addEventListener('click', () => { svg.classList.remove('go'); void svg.getBoundingClientRect(); svg.classList.add('go'); if (svg.setCurrentTime) svg.setCurrentTime(0); });
  });
  return root;
}
const plainText = STEPS.text;
STEPS.text = ctx => liven(plainText(ctx));

// мини-график над карточкой квиза: кусок кривой сложности (числа 0..1) и канал потока за ним
function spark(vals) {
  const W = 220, H = 64, n = vals.length, x = i => 6 + i * (W - 12) / Math.max(1, n - 1), y = v => H - 6 - v * (H - 12);
  const band = [...vals.map((v, i) => `${x(i)},${y(0.25 + 0.4 * i / Math.max(1, n - 1))}`), ...vals.map((v, i) => `${x(n - 1 - i)},${y(0.55 + 0.35 * (n - 1 - i) / Math.max(1, n - 1))}`)].join(' ');
  return svgEl('svg', { class: 'spark', viewBox: `0 0 ${W} ${H}`, 'aria-hidden': 'true' },
    svgEl('polygon', { points: band, class: 'flow' }),
    svgEl('polyline', { points: vals.map((v, i) => `${x(i)},${y(v)}`).join(' '), class: 'line' }));
}

/* =================== curve: кривая сложности на 2 минуты (урок 9) =================== */
// 12 столбиков по 10 секунд: тянешь мышью или пальцем, клавишами ← → выбираешь столбик, ↑ ↓ — выше или ниже. Фон — канал потока:
// выше него тревога, ниже скука, и канал поднимается, потому что игрок за партию учится. Кривая уходит в донора (lab.data.curve):
// препятствия идут по твоему расписанию, а удары партии ложатся точками под кривую. value.line — кривая словами для черновика ИГРА (plan.vars).
const CURVE_PRESETS = [
  { id: 'pila', icon: '🪚', label: 'Пила', curve: [0.2, 0.32, 0.44, 0.12, 0.38, 0.5, 0.62, 0.22, 0.55, 0.68, 0.8, 0.35] },
  { id: 'rovnaya', icon: '📈', label: 'Ровная горка', curve: [0.15, 0.22, 0.29, 0.36, 0.43, 0.5, 0.57, 0.64, 0.71, 0.78, 0.85, 0.92] },
  { id: 'stena', icon: '🧱', label: 'Стена', curve: [0.85, 0.9, 0.9, 0.95, 0.95, 1, 1, 1, 1, 1, 1, 1] },
  { id: 'skuka', icon: '😴', label: 'Скука', curve: [0.12, 0.12, 0.14, 0.14, 0.15, 0.15, 0.16, 0.16, 0.17, 0.17, 0.18, 0.18] },
];
const CURVE_SHAPES = { pila: '🪚 Пила: участки растут и сменяются передышкой', rovnaya: '📈 Ровная горка: без передышек', stena: '🧱 Стена: тревога с первых секунд', skuka: '😴 Скука: игра не растёт' };
const flowLow = t => 0.12 + 0.45 * t, flowHigh = t => 0.42 + 0.5 * t; // канал потока по доле партии t от 0 до 1
function curveShape(c) {
  const n = c.length, t = i => i / (n - 1);
  const above = c.filter((v, i) => v > flowHigh(t(i)) + 0.02).length, below = c.filter((v, i) => v < flowLow(t(i)) - 0.02).length;
  const rests = c.filter((v, i) => i && v <= c[i - 1] - 0.2).length;
  const shape = above >= 4 ? 'stena' : below >= 5 ? 'skuka' : rests >= 2 ? 'pila' : 'rovnaya';
  return { shape, above, below, rests };
}
function curveLine(c) {
  const k = curveShape(c);
  return `кривая сложности на 2 минуты, трудность от 0 до 10 на каждые 10 секунд: ${c.map(v => Math.round(v * 10)).join(', ')}. Это ${CURVE_SHAPES[k.shape].slice(3).toLowerCase()}`
    + (k.rests ? `; передышек: ${k.rests} — там препятствий нет, только награды` : '') + '. Скорость растёт ступенями: в конце каждой передышки';
}
STEPS.curve = ctx => {
  const st = ctx.step, N = st.points || 12, T = st.seconds || 120, need = st.minRounds || 1, presets = st.presets || CURVE_PRESETS;
  let v = Object.assign({ curve: null, rounds: 0, best: 0, hits: [], survived: 0 }, ctx.value);
  if (!Array.isArray(v.curve) || v.curve.length !== N) v.curve = (presets.find(p => p.id === st.start) || presets[0]).curve.slice(0, N);
  let sel = 0, drag = false, h = null;
  const host = el('div', { class: 'stack curve-step' });
  const W = 600, Hh = 250, X0 = 44, X1 = 590, Y0 = 18, Y1 = 196, cw = (X1 - X0) / N;
  const xOf = i => X0 + i * cw, yOf = val => Y1 - val * (Y1 - Y0), tAt = sec => X0 + (sec / T) * (X1 - X0);
  const svg = svgEl('svg', { class: 'curve-ed', viewBox: `0 0 ${W} ${Hh}`, tabindex: '0', role: 'application', 'aria-label': 'Кривая сложности: ← → столбик, ↑ ↓ выше или ниже' });
  const verdict = el('p', { class: 'pickline', 'aria-live': 'polite' }), after = el('div', { class: 'stack' }), frameHost = el('div', { class: 'stack' });
  const status = el('b', {});
  function save(done) {
    const k = curveShape(v.curve);
    v.shape = k.shape; v.line = curveLine(v.curve);
    v.loot = CURVE_SHAPES[k.shape].split(':')[0] + (v.rounds ? ` · ${v.survived} с` : '');
    ctx.save(v, done == null ? null : done);
  }
  function paint() {
    svg.innerHTML = '';
    const band = [], m = 24;
    for (let i = 0; i <= m; i++) band.push(`${X0 + i * (X1 - X0) / m},${yOf(flowHigh(i / m))}`);
    for (let i = m; i >= 0; i--) band.push(`${X0 + i * (X1 - X0) / m},${yOf(flowLow(i / m))}`);
    svg.append(svgEl('rect', { x: X0, y: Y0, width: X1 - X0, height: Y1 - Y0, class: 'zone-up' }),
      svgEl('polygon', { points: band.join(' '), class: 'flow' }),
      svgEl('text', { x: X0 + 8, y: Y0 + 16, class: 'zl' }, '😬 тревога'), svgEl('text', { x: X1 - 8, y: Y1 - 8, class: 'zl', 'text-anchor': 'end' }, '😴 скука'),
      svgEl('text', { x: X0 + (X1 - X0) * 0.62, y: yOf(0.62) + 4, class: 'zl flowl', 'text-anchor': 'middle' }, '🌊 поток'));
    v.curve.forEach((val, i) => {
      const t = i / (N - 1), cls = val > flowHigh(t) + 0.02 ? 'hi' : val < flowLow(t) - 0.02 ? 'lo' : 'ok';
      svg.append(svgEl('rect', { x: xOf(i) + 3, y: yOf(val), width: cw - 6, height: Y1 - yOf(val), rx: 4, class: 'bar ' + cls + (i === sel ? ' sel' : ''), 'data-col': i }));
    });
    const pts = v.curve.map((val, i) => `${xOf(i) + cw / 2},${yOf(val)}`);
    svg.append(svgEl('polyline', { points: pts.join(' '), class: 'cline' }));
    // конь бежит по кривой: видно, что столбики — это время партии, а высота — трудность
    if (!calm()) svg.append(svgEl('text', { class: 'runner', 'text-anchor': 'middle', y: -6 }, '🐎', svgEl('animateMotion', { dur: '7s', repeatCount: 'indefinite', path: 'M' + pts.join(' L') })));
    for (let s = 0; s <= T; s += 20) svg.append(svgEl('text', { x: tAt(s), y: Y1 + 18, class: 'tick', 'text-anchor': 'middle' }, s + ' с'));
    svg.append(svgEl('line', { x1: X0, y1: Y1, x2: X1, y2: Y1, class: 'axis' }));
    // удары последней партии — красные точки под осью, «продержался» — вертикальная черта
    (v.hits || []).filter(s => s <= T).forEach((s, k) => svg.append(svgEl('circle', { cx: tAt(s), cy: Y1 + 30, r: 5, class: 'hit', style: `--d:${(k * 0.08).toFixed(2)}s` })));
    if (v.survived) svg.append(svgEl('line', { x1: tAt(Math.min(T, v.survived)), y1: Y0, x2: tAt(Math.min(T, v.survived)), y2: Y1 + 36, class: 'surv' }));
    const k = curveShape(v.curve);
    verdict.textContent = CURVE_SHAPES[k.shape] + ` · передышек ${k.rests}` + (k.above ? ` · в тревоге ${k.above * 10} с` : '') + (k.below ? ` · в скуке ${k.below * 10} с` : '');
  }
  function setAt(evt) {
    const p = svg.createSVGPoint(); p.x = evt.clientX; p.y = evt.clientY;
    const q = p.matrixTransform(svg.getScreenCTM().inverse());
    const i = Math.floor((q.x - X0) / cw);
    if (i < 0 || i >= N) return;
    sel = i; v.curve[i] = Math.round(Math.max(0.05, Math.min(1, (Y1 - q.y) / (Y1 - Y0))) * 20) / 20;
    paint();
  }
  svg.addEventListener('pointerdown', e => { drag = true; svg.setPointerCapture(e.pointerId); setAt(e); });
  svg.addEventListener('pointermove', e => { if (drag) setAt(e); });
  const end = () => { if (!drag) return; drag = false; save(); mount(); };
  svg.addEventListener('pointerup', end); svg.addEventListener('pointercancel', end);
  svg.addEventListener('keydown', e => {
    const d = { ArrowLeft: [-1, 0], ArrowRight: [1, 0], ArrowUp: [0, 0.05], ArrowDown: [0, -0.05] }[e.key];
    if (!d) return;
    e.preventDefault();
    sel = (sel + d[0] + N) % N;
    if (d[1]) { v.curve[sel] = Math.round(Math.max(0.05, Math.min(1, v.curve[sel] + d[1])) * 20) / 20; save(); clearTimeout(svg.t); svg.t = setTimeout(mount, 500); }
    paint();
  });
  const presetRow = tiles(presets.map(p => ({ id: p.id, icon: p.icon, label: p.label })), null, it => {
    v.curve = presets.find(p => p.id === it.id).curve.slice(0, N); v.hits = []; v.survived = 0; save(); paint(); mount();
  }, { attr: 'data-curve', label: 'Готовые кривые' });
  function mount() {
    if (h) h.destroy();
    frameHost.innerHTML = '';
    h = Games.frame({
      src: () => '/engine/game.html?game=../' + st.game, key: () => 'remake:' + st.id, cfg: st.cfg, data: { curve: v.curve.slice() }, label: st.playLabel || 'Сыграть по своей кривой',
      onOver: m => {
        const s = (m.tele || {}).stats || {};
        v.rounds += 1; v.best = Math.max(v.best, m.score || 0);
        v.hits = Array.isArray(s[st.hits || 'удары, с']) ? s[st.hits || 'удары, с'].map(Number).filter(x => x >= 0).slice(0, 40) : [];
        v.survived = Math.round(Number(s[st.stat || 'продержался, с']) || 0);
        save(ctx.done || v.rounds >= need); paint(); report();
        S.hooks.forEach(fn => fn('played', { step: st.id }));
      },
    });
    frameHost.append(h.box, Games.bar(h, status));
    status.textContent = v.rounds ? `Партий: ${v.rounds} · лучший счёт: ${v.best}` : 'Партий пока нет';
  }
  // разбор партии: где были удары — в тревоге, в потоке или в скуке
  function report() {
    after.innerHTML = '';
    if (!v.rounds) return;
    status.textContent = `Партий: ${v.rounds} · лучший счёт: ${v.best}`;
    const col = s => Math.min(N - 1, Math.floor(s / (T / N)));
    const inHigh = v.hits.filter(s => s <= T && v.curve[col(s)] > flowHigh(col(s) / (N - 1)) + 0.02).length;
    const k = curveShape(v.curve);
    const text = !v.hits.length ? `Продержался ${v.survived} с без единого удара. ${k.shape === 'skuka' ? 'Не скучно было?' : 'Поток! Или кривая слишком добрая?'}`
      : `Продержался ${v.survived} с. Удары на ${v.hits.slice(0, 6).map(Math.round).join(', ')} с` + (inHigh ? ` — ${inHigh} из ${v.hits.length} там, где кривая выше канала потока.` : ' — кривая там в канале потока: может, просто не повезло или стоит дать передышку раньше.');
    after.append(el('p', { class: 'verdict ' + (inHigh > v.hits.length / 2 || k.shape === 'stena' || k.shape === 'skuka' ? 'bad' : 'good') }, text),
      st.reveal && v.rounds >= need ? el('p', { class: 'concept' }, st.reveal) : null);
  }
  host.append(ladder(['Нарисуй кривую', 'Сыграй по ней', 'Посмотри на удары'], !v.rounds ? (v.shape ? 1 : 0) : 2),
    el('div', { class: 'eyebrow' }, 'Готовые кривые — начни с любой и перерисуй'), presetRow,
    svg, verdict, el('p', { class: 'muted small' }, 'Тяни по столбикам мышью или пальцем. Клавиатура: щёлкни по графику, ← → — столбик, ↑ ↓ — выше или ниже. Каждый столбик — 10 секунд партии.'),
    frameHost, after);
  if (!ctx.value) save();
  paint(); mount(); report();
  return host;
};

/* =================== pig: цифровая «Свинья» (урок 10) =================== */
// Бросаешь кубик и копишь очки хода; единица сжигает всё, что накопил за ход. «Хватит» — очки хода в копилку. Первый до goal выиграл.
// Против бота, который останавливается на botHold. Записываются все «хватит» и сгорания: value { games, wins, holds, busts, loot }.
const DIE = ['⚀', '⚁', '⚂', '⚃', '⚄', '⚅'];
STEPS.pig = ctx => {
  const st = ctx.step, goal = st.goal || 50, botHold = st.botHold || 20;
  let v = Object.assign({ games: 0, wins: 0, holds: [], busts: 0 }, ctx.value);
  let rolled = false, bust = false, me = 0, bot = 0, turn = 0, face = 5, who = 'me', over = false, busy = false, log = 'Твой ход: бросай кубик (пробел) или забирай очки хода (Enter).', gameHolds = [], gameBusts = 0;
  const box = el('div', { class: 'pig', tabindex: '0', 'aria-label': 'Свинья: пробел — бросить, Enter — хватит' });
  const avg = a => (a.length ? Math.round(a.reduce((x, y) => x + y, 0) / a.length) : 0);
  function draw() {
    box.innerHTML = '';
    setTimeout(() => { rolled = false; bust = false; }, 0); // анимация броска — только на кадр, где кубик брошен
    const bank = (name, n, on) => el('div', { class: 'pig-bank' + (on ? ' on' : '') }, el('b', {}, name), el('span', { class: 'pig-n' }, String(n)),
      el('span', { class: 'pig-bar' }, el('i', { style: `width:${Math.min(100, Math.round(100 * n / goal))}%` })));
    box.append(el('div', { class: 'pig-banks' }, bank('🧒 Ты', me, who === 'me' && !over), bank('🤖 Бот', bot, who === 'bot' && !over)),
      el('div', { class: 'pig-mid' }, el('span', { class: 'pig-die' + (face === 0 && bust ? ' bust' : rolled ? ' roll' : ''), 'aria-hidden': 'true' }, DIE[face]),
        el('div', { class: 'stack', style: 'gap:2px' }, el('div', { class: 'eyebrow' }, 'Очки хода'), el('span', { class: 'pig-turn' + (rolled && turn ? ' up' : '') }, String(turn)))),
      el('p', { class: 'pig-log', 'aria-live': 'polite' }, log));
    if (!over) {
      box.append(el('div', { class: 'row', style: 'justify-content:center' },
        el('button', { class: 'btn', type: 'button', 'data-pig': 'roll', disabled: who !== 'me' || busy ? true : null, onclick: roll }, '🎲 Бросить', el('kbd', {}, 'пробел')),
        el('button', { class: 'btn warm', type: 'button', 'data-pig': 'hold', disabled: who !== 'me' || busy || !turn ? true : null, onclick: hold }, '✋ Хватит', el('kbd', {}, 'Enter'))));
      return;
    }
    const win = me >= goal;
    box.append(el('div', { class: 'stack', style: 'align-items:center;text-align:center' },
      el('h3', {}, win ? '🏆 Ты выиграл!' : '🤖 Бот выиграл'),
      el('p', {}, `Ты забирал очки в среднем на ${avg(gameHolds)}, сгорело ходов: ${gameBusts}. Бот всегда останавливается на ${botHold}.`),
      el('button', { class: 'btn ghost', type: 'button', 'data-pig': 'again', onclick: start }, 'Сыграть ещё')));
    if (st.reveal) box.append(el('p', { class: 'concept' }, st.reveal));
  }
  const d6 = () => 1 + Math.floor(Math.random() * 6);
  function roll() {
    if (who !== 'me' || over || busy) return;
    const r = d6(); face = r - 1; rolled = true; bust = r === 1;
    if (r === 1) { gameBusts++; log = `Единица! ${turn} очков хода сгорели. Ход бота.`; turn = 0; beep('bad'); face = 0; who = 'bot'; draw(); botTurn(); return; }
    turn += r; log = `Выпало ${r}. Очки хода: ${turn}. Ещё или хватит?`; beep('tick'); draw();
  }
  function hold() {
    if (who !== 'me' || over || busy || !turn) return;
    gameHolds.push(turn); me += turn; log = `Забрал ${turn}. В копилке ${me}.`; turn = 0; beep('good');
    if (me >= goal) return finish();
    who = 'bot'; draw(); botTurn();
  }
  async function botTurn() {
    busy = true; draw();
    const wait = () => new Promise(r => setTimeout(r, pause(520)));
    await wait();
    for (;;) {
      if (over) return;
      const r = d6(); face = r - 1; rolled = true; bust = r === 1;
      if (r === 1) { log = `Бот выбросил единицу: ${turn} очков сгорели. Твой ход.`; turn = 0; break; }
      turn += r; log = `Бот: выпало ${r}, очки хода ${turn}.`; draw();
      if (turn >= botHold || bot + turn >= goal) { bot += turn; log = `Бот забрал ${turn}. У него ${bot}. Твой ход.`; turn = 0; break; }
      await wait();
    }
    busy = false;
    if (bot >= goal) return finish();
    who = 'me'; draw(); box.focus();
  }
  function finish() {
    over = true; busy = false;
    const win = me >= goal;
    v = Object.assign({}, v, { games: v.games + 1, wins: v.wins + (win ? 1 : 0), holds: v.holds.concat(gameHolds).slice(-40), busts: v.busts + gameBusts });
    v.loot = `забирал на ${avg(v.holds)}`;
    ctx.save(v, true); beep(win ? 'done' : 'bad'); draw();
  }
  function start() { me = 0; bot = 0; turn = 0; face = 5; who = 'me'; over = false; busy = false; gameHolds = []; gameBusts = 0; log = 'Твой ход: бросай кубик (пробел) или забирай очки хода (Enter).'; draw(); box.focus(); }
  box.addEventListener('keydown', e => {
    if (e.target !== box) return;
    if (e.code === 'Space') { e.preventDefault(); roll(); } else if (e.code === 'Enter' || e.code === 'NumpadEnter') { e.preventDefault(); hold(); }
  });
  start();
  const wrap = el('div', { class: 'stack' }, box);
  if (v.games) wrap.prepend(el('p', { class: 'muted small' }, `Сыграно ${v.games}, побед ${v.wins}. Ты забираешь очки в среднем на ${avg(v.holds)}.`));
  return wrap;
};

/* =================== pulse: вызов класса на одном зерне (уроки 9, 10, 13) =================== */
// У всех одна трасса, один рой или одна раздача (зерно seed), а после партии — сводка класса без лишних имён: лучшие пять,
// где класс разбивался (series — секунды из статистики донора, по корзинам bin секунд) и что выбирает класс (picks — счётчики с приставкой).
// Если больше половины класса берёт одно и то же — это уже не выбор (урок 10). Сводку отдаёт /api/pulse.
STEPS.pulse = ctx => {
  const st = ctx.step, need = st.minRounds || 1;
  let v = Object.assign({ rounds: 0, best: 0, stat: null, series: [], picks: {} }, ctx.value);
  const board = el('div', { class: 'stack' }), status = el('b', {});
  const show = () => { status.textContent = v.rounds ? `Партий: ${v.rounds} · лучший счёт: ${v.best}` : 'Зерно у всех одно — у соседа та же партия'; };
  const h = Games.frame({
    src: () => '/engine/game.html?game=../' + st.game + '&seed=' + (st.seed || 2026), key: () => 'pulse:' + st.id, cfg: st.cfg, label: st.playLabel || 'Играть: вызов класса', challenge: true,
    onOver: m => {
      const t = m.tele || {}, s = t.stats || {}, custom = t.custom || {};
      const picks = Object.assign({}, v.picks);
      if (st.picks) for (const [k, n] of Object.entries(custom)) if (k.startsWith(st.picks)) { const name = k.slice(st.picks.length).trim(); picks[name] = (picks[name] || 0) + (Number(n) || 0); }
      const stat = st.stat != null ? s[st.stat] : null, series = st.series && Array.isArray(s[st.series]) ? s[st.series].map(Number).filter(x => x >= 0) : [];
      const better = typeof stat === 'number' ? (v.stat == null || stat > v.stat) : stat != null && v.stat == null;
      v = Object.assign({}, v, { rounds: v.rounds + 1, best: Math.max(v.best, m.score || 0), stat: better ? stat : v.stat, series: v.series.concat(series).slice(-80), picks });
      v.loot = st.stat && v.stat != null ? `${st.statLabel || st.stat}: ${comma(v.stat)}` : `счёт ${v.best}`;
      ctx.save(v, ctx.done || v.rounds >= need, true); show();
      setTimeout(load, 400);
    },
  });
  async function load() {
    if (!v.rounds) { board.innerHTML = ''; board.append(el('p', { class: 'muted small' }, 'Сыграй партию — и увидишь, как сыграл весь класс.')); return; }
    let r;
    try { r = await api('/api/pulse?step=' + encodeURIComponent(st.id)); } catch (e) { return; }
    board.innerHTML = '';
    board.append(el('div', { class: 'eyebrow' }, `Класс на этом зерне · сыграли ${r.n}`));
    if (r.top.length) board.append(el('ol', { class: 'pulse-top' }, r.top.map((x, k) => el('li', { class: x.me ? 'me' : '', style: `--d:${k * 0.08}s` }, el('b', {}, x.nick), ' — ', st.stat ? `${st.statLabel || st.stat}: ${comma(x.stat)}` : `счёт ${x.best}`))));
    if (r.hist) {
      const max = Math.max(1, ...r.hist.map(b => b.n));
      board.append(el('h4', {}, st.seriesTitle || 'Где класс разбивался'),
        el('div', { class: 'pulse-hist', role: 'img', 'aria-label': r.hist.map(b => `${b.label}: ${b.n}`).join(', ') }, r.hist.map((b, k) => el('div', { class: 'ph-col' + (b.n === max && b.n ? ' peak' : '') },
          el('span', { class: 'ph-n' }, b.n ? String(b.n) : ''), el('i', { style: `height:${Math.round(100 * b.n / max)}%;--d:${(k * 0.06).toFixed(2)}s` }), el('small', {}, b.label)))));
    }
    if (r.picks && r.picks.length) {
      board.append(el('h4', {}, st.picksTitle || 'Что выбирает класс'),
        el('div', { class: 'bars' }, r.picks.map((p, k) => el('div', { class: 'barrow' }, el('span', { class: 'bl' }, p.label), el('span', { class: 'bt' }, el('i', { style: `width:${p.share}%;--d:${k * 0.1}s` })), el('b', {}, p.share + '%')))));
      const top = r.picks[0];
      if (st.monopoly) board.append(el('p', { class: 'verdict ' + (top.share >= 50 ? 'bad' : 'good') }, top.share >= 50
        ? `«${top.label}» берут ${top.share}% выборов. Если почти все берут одно — это не выбор, а очевидно лучший ход.`
        : `Самое частое — «${top.label}», но лишь ${top.share}% выборов. Класс выбирает по-разному: значит, выбор настоящий.`));
    }
    if (st.reveal && v.rounds >= need) board.append(el('p', { class: 'concept' }, st.reveal));
  }
  show(); load();
  return el('div', { class: 'stack pulse' }, h.box, Games.bar(h, status), board,
    el('div', {}, el('button', { class: 'btn ghost small', type: 'button', onclick: load }, '↻ Обновить сводку класса')));
};

/* =================== scale: шкала «чистый случай — чистое мастерство» (урок 12) =================== */
// Ученик ставит каждую игру на шкалу от 0 (всё решает случай) до 10 (всё решает мастерство), потом видит, куда их ставят геймдизайнеры, и почему.
// Проектор показывает среднее класса по каждой игре. value: { pos: { id: 0..10 }, shown }
STEPS.scale = ctx => {
  const st = ctx.step;
  let v = Object.assign({ pos: {}, shown: false }, ctx.value);
  const host = el('div', { class: 'stack scale' });
  function draw() {
    host.innerHTML = '';
    let k = 0;
    host.append(el('div', { class: 'scale-ends' }, el('b', {}, st.left || '🎲 Чистый случай'), el('b', {}, st.right || '🧠 Чистое мастерство')));
    st.items.forEach(it => {
      const has = v.pos[it.id] != null, val = has ? v.pos[it.id] : 5;
      const input = el('input', { type: 'range', min: '0', max: '10', step: '1', value: String(val), 'data-scale': it.id, 'aria-label': `${it.label}: 0 — случай, 10 — мастерство`, disabled: v.shown ? true : null });
      input.addEventListener('input', () => { v.pos = Object.assign({}, v.pos, { [it.id]: Number(input.value) }); row.classList.add('set'); ctx.save(v); });
      const row = el('div', { class: 'scale-row' + (has ? ' set' : '') }, el('span', { class: 'ti', 'aria-hidden': 'true' }, it.icon), el('b', {}, it.label),
        el('div', { class: 'scale-track' }, input, v.shown ? el('span', { class: 'scale-pro', style: `left:${it.at * 10}%;--d:${(k * 0.12).toFixed(2)}s`, title: 'Так считают геймдизайнеры' }, '▲') : null));
      host.append(row);
      if (v.shown) host.append(el('p', { class: 'small muted scale-why', style: `--d:${(k++ * 0.12 + 0.1).toFixed(2)}s` }, `${it.icon} ${Math.abs((v.pos[it.id] ?? 5) - it.at) <= 2 ? '✓ Близко. ' : `Ты поставил ${v.pos[it.id] ?? 5}, геймдизайнеры — около ${it.at}. `}${it.why}`));
    });
    if (!v.shown) {
      host.append(el('div', {}, el('button', { class: 'btn', type: 'button', 'data-scale-done': '1', onclick: () => {
        const left = st.items.filter(it => v.pos[it.id] == null);
        if (left.length > Math.floor(st.items.length / 2)) { toast('Поставь хотя бы половину игр: ' + left.slice(0, 3).map(x => x.label).join(', ')); return; }
        v.shown = true; ctx.save(v, true, true); beep('good'); draw();
      } }, 'Расставил — показать, где их ставят геймдизайнеры')));
    } else if (st.reveal) host.append(el('p', { class: 'concept' }, st.reveal));
  }
  draw();
  return host;
};

/* =================== table: таблица баланса (урок 13) =================== */
// Цены и сила юнитов сначала в таблице, потом в игре: таблица уходит в донора (lab.data.units), бот играет ею же.
// «По силе стоит» — цена по силе юнита, откалиброванная по таблице донора: если цена дешевле силы на 2 капли и больше — все будут брать,
// дороже — никто не возьмёт. После дуэли видно, какую карту ты выпускал чаще. value: { units, line, rounds, results, played, loot }
STEPS.table = ctx => {
  const st = ctx.step, kinds = st.kinds, kindOf = id => kinds.find(k => k.id === id) || kinds[0], need = st.minRounds || 1;
  const base = st.units.map(u => Object.assign({}, u));
  let v = Object.assign({ units: null, rounds: 0, results: {}, played: {} }, ctx.value);
  if (!Array.isArray(v.units) || !v.units.length) v.units = base.slice(0, st.start || 4).map(u => Object.assign({}, u));
  // сила = среднее здоровья и урона; стая слабее суммы своих бойцов (её косит удар по площади), поэтому count в степени 0,75
  const power = u => (kindOf(u.kind).spell ? (u.dmg * u.count) * (st.spellK || 0.5) : Math.sqrt(Math.max(1, u.hp) * Math.max(1, u.dmg)) * Math.pow(u.count, 0.75));
  const K = (() => { const r = base.map(u => power(u) / u.cost).sort((a, b) => a - b); return r[Math.floor(r.length / 2)] || 1; })();
  const fair = u => Math.max(1, Math.min(10, Math.round(power(u) / K)));
  const host = el('div', { class: 'stack' }), tbl = el('div', { class: 'btable' }), frameHost = el('div', { class: 'stack' }), after = el('div', { class: 'stack' }), status = el('b', {});
  const clampU = u => Object.assign(u, { name: String(u.name || 'Юнит').slice(0, 24), cost: Math.max(1, Math.min(10, Math.round(u.cost) || 1)), hp: Math.max(1, Math.min(3000, Math.round(u.hp) || 1)),
    dmg: Math.max(1, Math.min(1000, Math.round(u.dmg) || 1)), count: Math.max(1, Math.min(8, Math.round(u.count) || 1)) });
  const forGame = () => v.units.map(u => { const k = kindOf(u.kind); return { name: u.name, cost: u.cost, hp: u.hp, dmg: u.dmg, count: u.count, kind: k.id, speed: u.speed || k.speed, range: u.range || k.range }; });
  function save(done) {
    v.line = 'таблица баланса юнитов (имя — вид: цена в каплях, здоровье, урон, сколько штук): ' + v.units.map(u => `${u.name} — ${u.kind}: ${u.cost}, ${kindOf(u.kind).spell ? '—' : u.hp}, ${u.dmg}, ×${u.count}`).join('; ');
    v.loot = `${v.units.length} юнитов` + (v.rounds ? ` · дуэлей ${v.rounds}` : '');
    ctx.save(v, done == null ? null : done);
  }
  let remountT = 0;
  const changed = () => { save(); paint(false); clearTimeout(remountT); remountT = setTimeout(mount, 700); };
  function paint(full = true) {
    if (!full) { tbl.querySelectorAll('[data-fair]').forEach((c, i) => fillFair(c, v.units[i])); return; }
    tbl.innerHTML = '';
    tbl.append(el('div', { class: 'brow bhead' }, ['Юнит', 'Вид', 'Цена 💧', 'Здоровье', 'Урон', 'Сколько', 'По силе стоит', ''].map(t => el('small', {}, t))));
    v.units.forEach((u, i) => {
      const num = (key, max) => { const inp = el('input', { type: 'number', min: '1', max: String(max), value: String(u[key]), 'data-cell': `${i}-${key}`, 'aria-label': key, disabled: key === 'hp' && kindOf(u.kind).spell ? true : null });
        inp.addEventListener('input', () => { u[key] = Number(inp.value); clampU(u); changed(); }); return inp; };
      const name = el('input', { type: 'text', value: u.name, 'data-cell': `${i}-name`, 'aria-label': 'имя' });
      name.addEventListener('input', () => { u.name = name.value; changed(); });
      const kind = el('select', { 'data-cell': `${i}-kind`, 'aria-label': 'вид' }, kinds.map(k => el('option', { value: k.id, selected: k.id === u.kind ? true : null }, `${k.icon} ${k.id}`)));
      kind.addEventListener('change', () => { u.kind = kind.value; delete u.speed; delete u.range; save(); paint(); clearTimeout(remountT); remountT = setTimeout(mount, 700); });
      const fairCell = el('span', { class: 'bfair', 'data-fair': i }); fillFair(fairCell, u);
      tbl.append(el('div', { class: 'brow' }, name, kind, num('cost', 10), num('hp', 3000), num('dmg', 1000), num('count', 8), fairCell,
        v.units.length > (st.min || 3) ? el('button', { class: 'btn ghost small', type: 'button', title: 'Убрать', onclick: () => { v.units.splice(i, 1); save(); paint(); mount(); } }, '✕') : el('span')));
    });
  }
  function fillFair(c, u) {
    const f = fair(u), d = u.cost - f, cls = 'bfair ' + (d <= -2 ? 'cheap' : d >= 2 ? 'dear' : 'ok');
    if (c.className && !c.className.startsWith(cls)) { c.className = cls; void c.offsetWidth; c.classList.add('flash'); } else c.className = cls; // вердикт сменился — вспышка
    c.textContent = `≈ ${f} 💧 ` + (d <= -2 ? '🔥 дёшево: все будут брать' : d >= 2 ? '🧊 дорого: никто не возьмёт' : '✓ честно');
  }
  function mount() {
    const h0 = frameHost.__h; if (h0) h0.destroy();
    frameHost.innerHTML = '';
    const h = frameHost.__h = Games.frame({
      src: () => '/engine/game.html?game=../' + st.game, key: () => 'remake:' + st.id, cfg: st.cfg, data: { units: forGame() }, label: st.playLabel || 'Дуэль по своей таблице',
      onOver: m => {
        const t = m.tele || {}, s = t.stats || {}, played = Object.assign({}, v.played);
        for (const [k, n] of Object.entries(t.custom || {})) if (k.startsWith('выпущено: ')) { const nm = k.slice(10); played[nm] = (played[nm] || 0) + (Number(n) || 0); }
        const res = s['исход'] || 'сыграно', results = Object.assign({}, v.results, { [res]: (v.results[res] || 0) + 1 });
        v = Object.assign({}, v, { rounds: v.rounds + 1, results, played, last: { res, played: t.custom || {} } });
        save(ctx.done || v.rounds >= need); report();
        S.hooks.forEach(fn => fn('played', { step: st.id }));
      },
    });
    frameHost.append(h.box, Games.bar(h, status));
    status.textContent = v.rounds ? `Дуэлей: ${v.rounds} · ${Object.entries(v.results).map(([k, n]) => `${k} ${n}`).join(', ')}` : 'Дуэлей пока нет';
  }
  function report() {
    after.innerHTML = '';
    status.textContent = v.rounds ? `Дуэлей: ${v.rounds} · ${Object.entries(v.results).map(([k, n]) => `${k} ${n}`).join(', ')}` : 'Дуэлей пока нет';
    if (!v.rounds) return;
    const top = Object.entries(v.played).sort((a, b) => b[1] - a[1])[0];
    const cheap = v.units.filter(u => u.cost - fair(u) <= -2).map(u => u.name);
    after.append(el('p', { class: 'verdict ' + (top && cheap.includes(top[0]) ? 'bad' : 'good') }, !top ? 'В этой дуэли ты не выпустил ни одного юнита.'
      : `Чаще всего ты выпускал «${top[0]}» (${top[1]} раз).` + (cheap.includes(top[0]) ? ' По таблице он самый дешёвый для своей силы — таблица это предсказала. Подними цену или ослабь его.' : cheap.length ? ` А по таблице дёшево стоит «${cheap[0]}» — проверь его в следующей дуэли.` : ' Таблица ровная: ни один юнит не дешевле своей силы.')),
    st.reveal && v.rounds >= need ? el('p', { class: 'concept' }, st.reveal) : null);
  }
  host.append(el('p', { class: 'muted small' }, 'Меняй числа прямо в таблице: колонка «По силе стоит» сразу пересчитает честную цену. Игра под таблицей берёт её целиком — и твоя колода, и колода бота.'),
    tbl, el('div', { class: 'row' },
      el('button', { class: 'btn ghost small', type: 'button', 'data-table': 'add', onclick: () => {
        if (v.units.length >= (st.max || 6)) { toast(`Не больше ${st.max || 6} юнитов`); return; }
        const next = base.find(b => !v.units.some(u => u.name === b.name)) || base[0];
        v.units.push(Object.assign({}, next)); save(); paint(); mount();
      } }, '+ Юнит'),
      el('button', { class: 'btn ghost small', type: 'button', onclick: () => { v.units = base.slice(0, st.start || 4).map(u => Object.assign({}, u)); save(); paint(); mount(); } }, '↺ Как у донора')),
    frameHost, after);
  if (!ctx.value) save();
  paint(); mount(); report();
  return host;
};

/* =================== итог шагов модуля 3 для чата и отчёта учителя =================== */
window.LabStepsM3Summary = (step, v) => {
  const top = o => Object.entries(o || {}).sort((a, b) => b[1] - a[1]).slice(0, 3).map(([k, n]) => `${k} ${n}`).join(', ');
  switch (step.type) {
    case 'curve': return v.line ? `${v.line}; партий ${v.rounds || 0}` + (v.survived ? `, продержался ${v.survived} с` : '') : 'кривая не нарисована';
    case 'pig': return v.games ? `партий ${v.games}, побед ${v.wins}, «свиней» ${v.busts}; ${v.loot || ''}` : 'не играл';
    case 'pulse': return v.rounds ? `партий ${v.rounds}, лучший счёт ${v.best || 0}` + (v.stat != null ? `, ${step.statLabel || step.stat}: ${v.stat}` : '') + (top(v.picks) ? `; выбирал: ${top(v.picks)}` : '') : 'не играл';
    case 'scale': return v.shown ? (step.items || []).map(it => `${it.label} ${v.pos[it.id] ?? '—'} (геймдизайнеры ${it.at})`).join('; ') : 'не расставил';
    case 'table': return (v.line || 'таблица не тронута') + (v.rounds ? `; дуэлей ${v.rounds}: ${top(v.results)}; чаще выпускал: ${top(v.played)}` : '');
    default: return '';
  }
};
