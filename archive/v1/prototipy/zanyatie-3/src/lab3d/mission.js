/* ---------- миссия «перекрась чувство»: одна карта, предсказание, две попытки ---------- */
const MIS_ROWS = [
  ['goal', 'Цель', GOALN, ['на поле лежат цели, каждая даёт очки', 'цели убегают, их надо догнать', 'дверь каждый раз в новом месте, каждая следующая дальше', 'очки капают каждую секунду, продержись', 'взять груз и отнести на базу, с грузом ты медленнее', 'в центре что-то ценное, не дай угрозе до него дойти', 'пройти чекпоинты по кругу быстрее призрака своего рекорда', 'собирать детали и ставить из них мост или башню']],
  ['verb', 'Кнопка A', VERBN, ['короткий бросок, в рывке тебя нельзя ранить', 'перепрыгнуть угрозу или забраться выше', 'купол на секунду, долгая перезарядка', 'снаряд туда, куда смотришь', 'пока держишь, цели летят к тебе, но ты медленнее', 'пока держишь, мир медленный, энергия кончается', 'мгновенно на несколько шагов вперёд', 'ставишь капкан, угроза в нём застревает', 'волна отталкивает всё вокруг']],
  ['threat', 'Угроза', THRN, ['враги бегут за героем, их всё больше', 'падают с неба, тень показывает место за секунду', 'ходят по маршрутам, путь можно прочитать', 'края поля горят и ползут к центру', 'низины заливает, надо держаться выше', 'ветер сносит героя и цели в одну сторону', 'один большой враг с понятными атаками', 'мирная игра без нападений']],
  ['twist', 'Поворот · новая карта', TWN, ['только то, что выше', 'цели подряд без удара дают множитель, но угрозы быстрее', 'свет вокруг героя гаснет, цели его возвращают', 'где ты был 3 с назад, ходит твой призрак', 'каждые 12 с лево и право меняются местами', 'каждые 20 с мир меняется, ночью угрозы другие', 'иногда всё становится лёгким и летучим', 'с каждой целью герой больше и медленнее', 'нет второго шанса, зато очки ×2']],
  ['camera', 'Камера · новая карта', CAMN, ['видно всё поле, удобно планировать', 'видно, куда бежишь, но не видно, что сзади', 'как в платформере: лево, право, прыжки', 'аккуратная диорама под углом 45°']],
];
const MIS_PAIR = { edge: 'center', center: 'edge', near: 'far', far: 'near', spam: 'silent', silent: 'spam', greedy: 'careful', careful: 'greedy', crushed: 'calm', calm: 'crushed' };
const MIS = { on: false, target: (DESIGN.mission && DESIGN.mission.target) || 'Открытие', tries: [], ch: null, pred: [], hyp: { v: '', d: false }, base: null, f: 0, max: 2 };
const misPick = a => a[Math.floor(Math.random() * a.length)];
function misHypDeck() {
  const ch = MIS.ch, r = ch && MIS_ROWS.find(x => x[0] === ch.k), nm = r ? r[2][ch.v] : 'карту', ds = r ? r[3][ch.v] : '';
  const ps = MIS.pred.length ? MIS.pred.map(k => PRED_TXT[k].toLowerCase()) : ['будет держаться у краёв поля'];
  return ps.flatMap(p => [`Если поставить «${nm}», игрок ${p.replace(/^будет/, 'будет')}, потому что ${ds}, и почувствует ${MIS.target.toLowerCase()}`, `С «${nm}» игроку станет интересно, что дальше: ${ds}. Поэтому он ${p}`]);
}
function missionOpen() {
  if (state !== 'over') return;
  if (MIS.tries.length >= MIS.max) { misDone(); return; }
  if (!MIS.base) MIS.base = Object.assign({}, DEFAULTS);
  MIS.on = true; MIS.ch = null; MIS.pred = []; MIS.hyp = { v: '', d: false }; MIS.f = 0;
  $('#overScreen').hidden = true; state = 'mission'; $('#missionScreen').hidden = false; misDraw();
}
function misDraw() {
  const n = MIS.tries.length + 1, last = runs[runs.length - 1], felt = last ? last.felt : [];
  const row = r => { const cur = Math.round(MIS.base[r[0]]); return `<div class="mrow" data-g="${r[0]}"><div class="lab">${r[1]}</div><div class="chips">${r[2].map((nm, i) => `<button type="button" class="chip mf" data-k="${r[0]}" data-v="${i}" aria-pressed="${MIS.ch && MIS.ch.k === r[0] && MIS.ch.v === i}" ${i === cur ? 'disabled title="так сейчас"' : ''}>${nm}${i === cur ? ' · сейчас' : ''}</button>`).join('')}</div></div>`; };
  const ch = MIS.ch && MIS_ROWS.find(x => x[0] === MIS.ch.k);
  const peace = (MIS.ch && MIS.ch.k === 'threat' ? MIS.ch.v : Math.round(MIS.base.threat)) === 7;
  const DANGER = ['near', 'far', 'dodge', 'save', 'greedy', 'careful', 'crushed'];
  if (peace) MIS.pred = MIS.pred.filter(k => !DANGER.includes(k));
  $('#misBody').innerHTML = `
    <p class="sub">Ты целился в «${DESIGN.aim0 || DESIGN.aim}». ${felt.length ? `В последней партии ты отметил: <b>${felt.join(', ')}</b>.` : 'В последней партии чувство не отмечено.'} Задача: попасть в <b>«${MIS.target}»</b> (${PLEAS_HINT[MIS.target]}). Меняешь ровно <b>одну</b> карту, остальное как задумано. Попытка <b>${n} из ${MIS.max}</b>.</p>
    <div class="eyebrow">1 · Какую одну карту меняешь (M)</div>
    ${MIS_ROWS.map(row).join('')}
    <div class="hint" id="misDesc">${ch ? `<b>${ch[2][MIS.ch.v]}</b>: ${ch[3][MIS.ch.v]}` : 'Выбери одну карту. Выбор в другом ряду заменит прежний.'}</div>
    <div class="eyebrow">2 · Что теперь будут делать игроки (D)? Выбери 2 или 3</div>
    <div class="chips" data-g="pred">${Object.keys(PRED_TXT).map(k => `<button type="button" class="chip mp" data-p="${k}" aria-pressed="${MIS.pred.includes(k)}" ${peace && DANGER.includes(k) ? 'disabled' : ''}>${PRED_TXT[k]}</button>`).join('')}</div>
    <div class="eyebrow">3 · Гипотеза: почему это даст «${MIS.target}» (A)</div>
    <div class="why"><textarea id="misHyp" rows="2" aria-label="Гипотеза"></textarea><button type="button" class="die" id="misDie" aria-label="Кубик">🎲</button></div><div class="tag" id="misTag"></div>
    <div class="row"><button type="button" class="btn" id="misGo">Играть попытку ${n}</button><button type="button" class="ghost" id="misBack">Назад к итогам</button></div>
    <div class="hint" id="misNeed"></div>
    <div class="hint">${padMode ? '<kbd>↑ ↓</kbd> ряд · <kbd>← →</kbd> выбор · <kbd>A</kbd> нажать · <kbd>X</kbd> кубик · <kbd>Start</kbd> играть · <kbd>B</kbd> назад' : 'Мышь или <kbd>←</kbd><kbd>→</kbd><kbd>↑</kbd><kbd>↓</kbd> и <kbd>Enter</kbd>'}</div>`;
  const ta = $('#misHyp'), tag = () => { ta.classList.toggle('dice', MIS.hyp.d); $('#misTag').textContent = MIS.hyp.d ? '[кубик] поправь пару слов, и гипотеза станет твоей' : ''; };
  ta.value = MIS.hyp.v; tag(); ta.oninput = () => { MIS.hyp = { v: ta.value, d: false }; tag(); };
  $('#misDie').onclick = () => { const d = misHypDeck(); let v, i = 0; do { v = misPick(d); } while (v === MIS.hyp.v && ++i < 9); MIS.hyp = { v, d: true }; ta.value = v; tag(); tone(820, 0.06, 'square', 0.05); };
  document.querySelectorAll('.mf').forEach(b => b.onclick = () => { MIS.ch = { k: b.dataset.k, v: +b.dataset.v }; tone(600 + MIS.ch.v * 30, 0.07); misKeep(() => misDraw()); });
  document.querySelectorAll('.mp').forEach(b => b.onclick = () => { const k = b.dataset.p, i = MIS.pred.indexOf(k); if (i >= 0) MIS.pred.splice(i, 1); else { const o = MIS.pred.indexOf(MIS_PAIR[k]); if (o >= 0) MIS.pred.splice(o, 1); MIS.pred.push(k); if (MIS.pred.length > 3) MIS.pred.shift(); } tone(700, 0.06); misKeep(() => misDraw()); });
  $('#misGo').onclick = misGo; $('#misBack').onclick = () => { $('#missionScreen').hidden = true; $('#overScreen').hidden = false; state = 'over'; };
  misFocus();
}
function misKeep(fn) { const sc = $('#missionScreen').scrollTop; fn(); $('#missionScreen').scrollTop = sc; }
function misGo() {
  const need = !MIS.ch ? 'Выбери одну карту.' : MIS.pred.length < 2 ? 'Выбери хотя бы два предсказания.' : !MIS.hyp.v.trim() ? 'Напиши гипотезу или брось кубик и поправь.' : '';
  if (need) { $('#misNeed').textContent = need; tone(220, 0.2, 'sawtooth', 0.05); return; }
  const r = MIS_ROWS.find(x => x[0] === MIS.ch.k);
  Object.assign(cfg, MIS.base); cfg[MIS.ch.k] = MIS.ch.v; syncKnobs();
  if (!DESIGN.aim0) DESIGN.aim0 = DESIGN.aim; DESIGN.aim = MIS.target;
  DESIGN.predict = MIS.pred.slice(); DESIGN.hyp = MIS.hyp.v + (MIS.hyp.d ? ' [кубик]' : '');
  MIS.tries.push({ card: `${r[1].replace(/ ·.*/, '')}: ${r[2][Math.round(MIS.base[MIS.ch.k])]} → ${r[2][MIS.ch.v]}`, hyp: DESIGN.hyp, run: runs.length });
  $('#missionScreen').hidden = true; buildWorld(); startGame();
}
function misStatus() {
  if (!MIS.tries.length) return '';
  const t = MIS.tries[MIS.tries.length - 1], run = runs[t.run]; if (!run) return '';
  const hit = run.felt.includes(MIS.target), p = run.pred || [], ok = p.filter(x => x.ok).length;
  return `<div class="pred" style="border-color:var(--dice)"><h4 style="color:var(--dice)">МИССИЯ · ПОПЫТКА ${MIS.tries.length} ИЗ ${MIS.max}</h4><div>Поменял: <b>${t.card}</b></div><div>Чувство: ${run.felt.length ? (hit ? `<b style="color:var(--good)">попал в «${MIS.target}»</b>` : `<b style="color:var(--bad)">мимо</b>, вышло ${run.felt.join(', ')}`) : 'отметь, что ты почувствовал, в столбце A'}</div><div>Точность предсказаний: <b>${ok} из ${p.length}</b></div><small>${MIS.tries.length < MIS.max ? 'Нажми «Миссия: попытка 2». Можно поменять ту же карту на другое значение или взять другую карту, но снова только одну.' : 'Две попытки сделаны. Скопируй результат и пришли учителю.'}</small></div>`;
}
function misDone() { const b = $('#changeBtn'); b.textContent = 'Миссия пройдена'; b.disabled = true; }
// встраиваемся в экран итогов
changeCard = missionOpen;
const _drawOver = drawOver;
drawOver = function (d) { _drawOver(d); if (MIS.tries.length && MIS.tries[MIS.tries.length - 1].run === runs.length - 1) $('#mda').insertAdjacentHTML('afterbegin', misStatus()); misLabel(); };
const _toggleFelt = toggleFelt;
toggleFelt = function (i) { _toggleFelt(i); const el = document.querySelector('#mda > .pred[style]'); if (el) el.outerHTML = misStatus(); };
const _labels = labels;
labels = function () { _labels(); misLabel(); };
function misLabel() { const b = $('#changeBtn'); if (!b) return; if (MIS.tries.length >= MIS.max) { b.textContent = 'Миссия пройдена'; b.disabled = true; return; } b.textContent = `Миссия: попытка ${MIS.tries.length + 1}` + (padMode ? ' · B' : ' · C'); }
const _resultText = resultText;
resultText = function () { let t = _resultText(); if (MIS.tries.length) t += '\nМиссия «перекрась чувство» в «' + MIS.target + '»:\n' + MIS.tries.map((m, i) => { const r = runs[m.run] || { felt: [], pred: [] }; return `  Попытка ${i + 1}: ${m.card}. Гипотеза: ${m.hyp}. Предсказания ${r.pred.filter(x => x.ok).length}/${r.pred.length}. Чувство: ${r.felt.join(', ') || '—'} → ${r.felt.includes(MIS.target) ? 'попал' : 'мимо'}`; }).join('\n'); return t; };
$('#resCopy').onclick = e => copyText(resultText(), e.currentTarget, $('#resBox'), 'Скопировать результат');
// геймпад и стрелки на экране миссии
let misF = 0;
function misList() { return [...document.querySelectorAll('#missionScreen button:not(:disabled), #missionScreen textarea')]; }
function misFocus() { document.querySelectorAll('#missionScreen .pf').forEach(x => x.classList.remove('pf')); const L = misList(); if (!L.length) return; misF = Math.max(0, Math.min(L.length - 1, misF)); L[misF].classList.add('pf'); L[misF].scrollIntoView({ block: 'nearest' }); }
function misGrp(el) { return el.closest('[data-g]') || el; }
function misMove(dx, dy) {
  const L = misList(); if (!L.length) return;
  if (dx) misF = (misF + dx + L.length) % L.length;
  if (dy) { const g = misGrp(L[misF]); let i = misF; do { i += dy; } while (i >= 0 && i < L.length && misGrp(L[i]) === g); if (i >= 0 && i < L.length) { const g2 = misGrp(L[i]); if (dy < 0) while (i > 0 && misGrp(L[i - 1]) === g2) i--; misF = i; } }
  misFocus(); tone(500, 0.03, 'square', 0.03);
}
function misPress() { const el = misList()[misF]; if (!el) return; const keep = misF; if (el.tagName === 'TEXTAREA') $('#misDie').click(); else el.click(); misF = keep; if (state === 'mission') misFocus(); }
let misPrev = [], misAx = [0, 0];
(function misPoll() {
  try {
    if (state === 'mission') {
      const gp = [...(navigator.getGamepads ? navigator.getGamepads() : [])].find(Boolean);
      if (gp) {
        const b = gp.buttons.map(x => !!(x && x.pressed)), dn = i => b[i] && !misPrev[i], ax = gp.axes[0] || 0, ay = gp.axes[1] || 0;
        const sx = ax > 0.55 ? 1 : ax < -0.55 ? -1 : 0, sy = ay > 0.55 ? 1 : ay < -0.55 ? -1 : 0, nx = sx !== misAx[0] ? sx : 0, ny = sy !== misAx[1] ? sy : 0; misAx = [sx, sy];
        if (dn(14) || nx < 0) misMove(-1, 0); if (dn(15) || nx > 0) misMove(1, 0); if (dn(12) || ny < 0) misMove(0, -1); if (dn(13) || ny > 0) misMove(0, 1);
        if (dn(0)) misPress(); if (dn(2)) $('#misDie').click(); if (dn(9)) misGo(); if (dn(1)) $('#misBack').click();
        misPrev = b;
      }
    } else misPrev = [];
  } catch (e) {}
  requestAnimationFrame(misPoll);
})();
addEventListener('keydown', e => {
  if (state !== 'mission' || e.target.tagName === 'TEXTAREA') return;
  const m = { ArrowLeft: [-1, 0], ArrowRight: [1, 0], ArrowUp: [0, -1], ArrowDown: [0, 1] }[e.key];
  if (m) { e.preventDefault(); e.stopImmediatePropagation(); misMove(m[0], m[1]); }
  if (e.key === 'Enter') { e.preventDefault(); e.stopImmediatePropagation(); misPress(); }
}, true);
