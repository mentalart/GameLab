/* ===== Разбор MDA после партии ===== */
const runs = []; let ofc = 0, why = { v: '', d: false };
const WHY = ['Я задаю только механику, а динамику создаёт игрок своими действиями', 'Одна карта поменяла то, как я играл, и вместе с этим поменялось чувство', 'Чтобы попасть в чувство, надо менять ту механику, которая рождает нужную динамику', 'Камера и угроза вместе решают, будет игроку страшно или интересно', 'Вызов рождается, когда опасность видна заранее, но увернуться трудно'];
function dynamics(d, c, T) {
  const out = [], pct = x => Math.round(x / Math.max(0.1, T) * 100), perMin = x => Math.round(x / Math.max(0.1, T) * 60);
  const verb = VERBN[Math.round(c.verb)], thr = Math.round(c.threat), tw = Math.round(c.twist), danger = thr !== 7 || tw === 3, it = ITEM();
  const add = (w, txt, p) => out.push({ w, txt, p });
  if (d.edge / T > 0.4) add(d.edge / T, `Держался у краёв поля: ${pct(d.edge)}% времени у стен`, 'Отдых');
  if (d.center / T > 0.45) add(d.center / T, `Держал центр поля: ${pct(d.center)}% времени`, 'Вызов');
  if (d.idle / T > 0.25) add(d.idle / T, `Стоял и выжидал: ${pct(d.idle)}% времени без движения`, 'Отдых');
  if (d.turns / T > 0.4) add(Math.min(1, d.turns / T), `Петлял: ${perMin(d.turns)} резких разворотов в минуту`, 'Ощущения');
  if (danger && d.nm >= 2 && perMin(d.nm) > 3) add(Math.min(1, perMin(d.nm) / 10), `Проходил впритирку: ${d.nm} раз опасность была в шаге и не задела`, 'Вызов');
  if (d.dodged >= 2) add(Math.min(1, d.dodged / 8 + 0.3), `Увернулся от ${d.dodged} подсвеченных ударов`, 'Вызов');
  if (danger && d.distT > 5 && d.distSum / d.distT > 7 && d.nm < 3) add(0.55, `Держался подальше от опасности: в среднем ${Math.round(d.distSum / d.distT)} шагов`, 'Отдых');
  if (d.uses === 0) add(0.9, `Кнопку A (${verb}) не тронул ни разу: глагол молчит`, '—');
  else if (d.shots >= 5) { const acc = d.shotHits / d.shots; add(acc > 0.4 ? 0.7 : 0.6, acc > 0.4 ? `Стрелял метко: ${Math.round(acc * 100)}% выстрелов попали` : `Палил наугад: попало ${Math.round(acc * 100)}% выстрелов`, acc > 0.4 ? 'Вызов' : 'Ощущения'); }
  else if (d.uses >= 3 && d.saves / d.uses > 0.5) add(d.saves / d.uses, `${verb} спасал: ${d.saves} из ${d.uses} раз рядом была опасность`, 'Вызов');
  if (perMin(d.uses) > 40) add(0.75, `Жал ${verb.toLowerCase()} без остановки: ${perMin(d.uses)} раз в минуту`, 'Ощущения');
  if (d.hold / T > 0.35) add(d.hold / T, `${verb} держал зажатым ${pct(d.hold)}% времени`, 'Ощущения');
  if (d.shotCatch + d.touchCatch >= 3) { const s = d.shotCatch / (d.shotCatch + d.touchCatch); if (s > 0.6) add(0.8, `Ловил ${it} выстрелом, а не догонял: ${d.shotCatch} из ${d.shotCatch + d.touchCatch}`, 'Вызов'); else if (s < 0.2) add(0.6, `Догонял ${it} сам: ${d.touchCatch} из ${d.shotCatch + d.touchCatch}`, 'Ощущения'); }
  if (d.goals >= 3 && d.greedy / d.goals > 0.35) add(d.greedy / d.goals, `Жадничал: ${d.greedy} из ${d.goals} взял рядом с опасностью`, 'Вызов');
  if (danger && d.goals >= 3 && d.greedy / d.goals < 0.1) add(0.5, 'Осторожничал: брал только то, что лежало в безопасности', 'Отдых');
  if (d.bossDmg >= 10) add(0.7, `Бил стража: ${d.bossDmg} попаданий${d.bossDowns ? `, повалил ${d.bossDowns} раз` : ''}`, 'Вызов');
  if (d.hurts >= 2 && d.backHits / d.hurts >= 0.5) add(0.85, `Удары прилетали со спины: ${d.backHits} из ${d.hurts}. Камера не показывает, что сзади`, 'Вызов');
  if (d.hurts === 0 && T >= c.roundTime * 0.95 && danger) add(0.65, 'Ни одного удара: игра не давила', 'Отдых');
  if (d.hurts > 0 && T < c.roundTime * 0.5) add(0.8, `Игра раздавила быстро: конец на ${Math.round(T)}-й секунде`, 'Вызов');
  if (d.flipHurts) add(0.85, `Зеркало ловило: ${d.flipHurts} удар(а) сразу после переворота`, 'Открытие');
  if (d.maxMult >= 4) add(0.75, `Разгонял жадность до ×${d.maxMult}`, 'Вызов');
  if (tw === 2 && d.lightSum / T < 6) add(0.7, 'Жил в темноте: свет почти не возвращался', 'Открытие');
  if (d.echoHurts) add(0.8, `Попался своему эху ${d.echoHurts} раз: свой же путь стал ловушкой`, 'Открытие');
  if (d.lavaT > 1) add(0.6, `Стоял в лаве ${Math.round(d.lavaT)} с`, 'Вызов');
  if (d.kills >= 4) add(0.6, `Сбил ${d.kills} врагов`, 'Вызов');
  out.sort((a, b) => b.w - a.w);
  if (out.length < 2) out.push({ w: 0.1, txt: 'Спокойно катался по полю', p: 'Отдых' });
  return out.slice(0, 3);
}

/* ---------- предсказание дизайнера: те же слова, что в тетради ---------- */
const PRED_TXT = { edge: 'Будет держаться у краёв поля', center: 'Будет крутиться в центре', idle: 'Будет стоять и выжидать', turns: 'Будет петлять, часто менять направление', near: 'Будет проходить впритирку к опасности', far: 'Будет держаться подальше от опасности', dodge: 'Будет уворачиваться в последний момент', spam: 'Будет жать A без остановки', silent: 'Почти не будет жать A', save: 'A будет спасать от опасности', greedy: 'Будет жадничать: брать рядом с опасностью', careful: 'Будет брать только то, что в безопасности', crushed: 'Игра быстро раздавит', calm: 'Ни одного удара: игра не будет давить' };
function predCheck(d, c, T) {
  const pct = x => Math.round(x / Math.max(0.1, T) * 100), perMin = x => Math.round(x / Math.max(0.1, T) * 60);
  const verb = VERBN[Math.round(c.verb)], thr = Math.round(c.threat), danger = thr !== 7, far = d.distT ? d.distSum / d.distT : 0, gr = d.goals ? d.greedy / d.goals : 0;
  const R = {
    edge: [d.edge / T > 0.4, `у стен ${pct(d.edge)}% времени`],
    center: [d.center / T > 0.45, `в центре ${pct(d.center)}% времени`],
    idle: [d.idle / T > 0.25, `стоял ${pct(d.idle)}% времени`],
    turns: [d.turns / T > 0.4, `${perMin(d.turns)} резких разворотов в минуту (сбывается от 24)`],
    near: [danger && d.nm >= 2 && perMin(d.nm) > 3, `впритирку ${d.nm} раз`],
    far: [danger && far > 7 && d.nm < 3, `в среднем ${Math.round(far)} шагов до опасности`],
    dodge: [d.dodged >= 2 || (d.saves >= 2 && d.nm >= 2), `увернулся ${d.dodged} раз, ${verb.toLowerCase()} рядом с опасностью ${d.saves} раз`],
    spam: [perMin(d.uses) > 40 || d.hold / T > 0.35, `${verb}: ${perMin(d.uses)} раз в минуту`],
    silent: [perMin(d.uses) < 3, `${verb}: ${d.uses} раз за партию`],
    save: [d.uses >= 3 && d.saves / d.uses > 0.5, `${verb} рядом с опасностью ${d.saves} из ${d.uses} раз`],
    greedy: [d.goals >= 3 && gr > 0.35, `рядом с опасностью взял ${d.greedy} из ${d.goals}`],
    careful: [d.goals >= 3 && gr < 0.1, `рядом с опасностью взял ${d.greedy} из ${d.goals}`],
    crushed: [d.hurts > 0 && T < c.roundTime * 0.5, `партия длилась ${Math.round(T)} с, ударов ${d.hurts}`],
    calm: [d.hurts === 0, `ударов ${d.hurts}`],
  };
  return (DESIGN.predict || []).filter(k => R[k]).map(k => ({ k, txt: PRED_TXT[k], ok: !!R[k][0], fact: R[k][1] }));
}
function predHTML(run) {
  if (!run.pred || !run.pred.length) return '';
  const n = run.pred.filter(x => x.ok).length;
  return `<div class="pred"><h4>ТЫ ПРЕДСКАЗАЛ → ИГРА УВИДЕЛА · угадал ${n} из ${run.pred.length}</h4><ul>${run.pred.map(x => `<li class="${x.ok ? 'hit' : 'miss'}"><b>${x.ok ? '✓' : '✗'}</b> ${x.txt}<small>${x.fact}</small></li>`).join('')}</ul>${DESIGN.hyp ? `<small>Твоя гипотеза: ${DESIGN.hyp}</small>` : ''}<small>${n === run.pred.length ? 'Всё сбылось: правила сделали то, что ты задумал.' : n ? 'Часть сбылась. Посмотри в столбец D: что игрок делал вместо этого и какое правило его туда толкнуло?' : 'Ничего не сбылось. Это не провал, а находка: правила работают не так, как ты думал. Столбец D покажет, как.'}</small></div>`;
}
function endGame(text, won) {
  if (state !== 'play') return;
  state = 'over'; if (won) sfx.win(); else { sfx.lose(); shake(0.8); }
  const s = Math.floor(score); if (s > best) { best = s; store.set('lab3d-best-' + DESIGN.name, String(s)); }
  $('#stScore').textContent = s; $('#stTime').textContent = Math.floor(gt); $('#stBest').textContent = best;
  $('#overTitle').textContent = text; $('#overEyebrow').textContent = won ? 'Раунд пройден' : 'Партия окончена';
  const T = Math.max(1, gt), dyn = dynamics(S.d, cfg, T), prev = runs[runs.length - 1];
  const changed = prev ? Object.keys(CONFIG).filter(k => Math.abs(prev.snap[k] - S.snap[k]) > 1e-9).map(k => `${CONFIG[k].label}: ${fmtK(k, prev.snap[k])} → ${fmtK(k, S.snap[k])}`) : [];
  runs.push({ snap: S.snap, score: s, time: Math.round(T), dyn, felt: [], changed, causes: S.d.causes, pred: predCheck(S.d, cfg, T) });
  ofc = 0; drawOver(S.d);
  setTimeout(() => { $('#overScreen').hidden = false; }, 650);
}
function drawOver(d) {
  const run = runs[runs.length - 1], sn = run.snap, ca = Object.entries(run.causes).sort((a, b) => b[1] - a[1]);
  const Mx = [`Цель: ${GOALN[Math.round(sn.goal)]}`, `A: ${VERBN[Math.round(sn.verb)]}`, `Угроза: ${THRN[Math.round(sn.threat)]}`, `Поворот: ${TWN[Math.round(sn.twist)]}`, `Камера: ${CAMN[Math.round(sn.camera)]}`];
  $('#mda').innerHTML = `${predHTML(run)}
    <div class="lad">
      <div><h4>M · ТЫ ЗАДАЛ</h4><ul>${Mx.map(x => `<li>${x}</li>`).join('')}</ul>${run.changed.length ? `<small>Поменял с прошлой партии: ${run.changed.join('; ')}</small>` : '<small>Это правила. Только их ты решал сам.</small>'}</div>
      <div><h4>D · ЧТО ПОЛУЧИЛОСЬ В ИГРЕ</h4><ul>${run.dyn.map(x => `<li>${x.txt}</li>`).join('')}</ul><small>Это игра посчитала по твоей партии. Ты этого не задавал.${ca.length ? ` Чем ранило: ${ca.map(([k, n]) => `${k} ×${n}`).join(', ')}.` : ''}</small></div>
      <div><h4>A · ЧТО ТЫ ПОЧУВСТВОВАЛ?</h4><div class="chips" id="oFelt"></div><small id="oAim"></small></div>
    </div>
    <div class="heat"><canvas id="oHeat" width="240" height="135" aria-label="Карта партии"></canvas><div class="hint" style="flex:1;min-width:200px">Карта партии сверху: чем ярче клетка, тем дольше там был герой, красные крестики — удары. Это динамика, которую видно глазами.<br><span id="oKeys"></span></div></div>
    ${runs.length > 1 ? `<table class="runs"><tr><th>Партия</th><th>Что поменял</th><th>Главная динамика</th><th>Чувство</th><th>Очки</th><th>Угадал</th></tr>${runs.map((r, i) => `<tr><td>${i + 1}</td><td>${r.changed.join('; ') || (i ? 'ничего' : 'как задумано')}</td><td>${r.dyn[0].txt}</td><td>${r.felt.join(', ') || '…'}</td><td>${r.score}</td><td>${r.pred && r.pred.length ? r.pred.filter(x => x.ok).length + '/' + r.pred.length : '—'}</td></tr>`).join('')}</table>
    <div><b>Что ты понял про M, D и A?</b></div><div class="why"><textarea id="oWhy" rows="2" aria-label="Что ты понял"></textarea><button type="button" class="die" id="oWhyD" aria-label="Кубик">🎲</button></div><div class="tag" id="oWhyT"></div>`
    : '<p class="hint">Теперь нажми «Поменять одну карту», поменяй ровно одну и сыграй снова: посмотрим, как сдвинется динамика.</p>'}`;
  overChips(); heat(d);
  const ta = $('#oWhy');
  if (ta) {
    const tag = () => { ta.classList.toggle('dice', why.d); $('#oWhyT').textContent = why.d ? '[кубик] поправь пару слов, и мысль станет твоей' : ''; };
    ta.value = why.v; tag(); ta.oninput = () => { why = { v: ta.value, d: false }; tag(); };
    $('#oWhyD').onclick = () => { let v; do { v = pick(WHY); } while (v === why.v); why = { v, d: true }; ta.value = v; tag(); tone(820, 0.06, 'square', 0.05); };
  }
}
function overChips() {
  const run = runs[runs.length - 1], el = $('#oFelt'); if (!run || !el) return;
  el.innerHTML = PLEAS.map((p, i) => `<button type="button" class="chip ${padMode && i === ofc ? 'pf' : ''}" aria-pressed="${run.felt.includes(p)}" data-i="${i}" title="${PLEAS_HINT[p]}">${padMode ? '' : i + 1 + ' '}${p}</button>`).join('');
  el.querySelectorAll('.chip').forEach(b => b.onclick = () => toggleFelt(+b.dataset.i));
  const aim = DESIGN.aim, o = $('#oAim');
  o.textContent = !run.felt.length ? `Ты целился в «${aim}». Отметь, что вышло на самом деле.` : run.felt.includes(aim) ? `Попал: целился в «${aim}», и игра это дала. Какая строчка в столбце D это сделала?` : `Мимо: целился в «${aim}», а вышло «${run.felt.join('», «')}». Найди в столбце D, что увело в сторону, и поменяй механику, которая это создаёт.`;
  $('#oKeys').innerHTML = padMode ? '<kbd>← →</kbd> и <kbd>A</kbd> выбрать чувство (до двух) · <kbd>B</kbd> поменять карту · <kbd>Start</kbd> ещё раз' : 'Клавиши <kbd>1</kbd>–<kbd>8</kbd> выбирают чувство (до двух) · <kbd>C</kbd> поменять карту · <kbd>пробел</kbd> ещё раз';
  const tr = document.querySelectorAll('.runs tr'); if (tr.length) tr[tr.length - 1].children[3].textContent = run.felt.join(', ') || '…';
}
function overFocus(dx) { ofc = (ofc + dx + 8) % 8; overChips(); }
function toggleFelt(i) { const run = runs[runs.length - 1]; if (!run) return; const p = PLEAS[i]; if (run.felt.includes(p)) run.felt = run.felt.filter(x => x !== p); else { run.felt.push(p); if (run.felt.length > 2) run.felt.shift(); } ofc = i; tone(650 + i * 40, 0.08, 'triangle', 0.08); overChips(); }
function heat(d) {
  const cv2 = $('#oHeat'); if (!cv2) return; const x = cv2.getContext('2d'), p = P();
  x.fillStyle = p.g[0]; x.fillRect(0, 0, 240, 135); x.fillStyle = 'rgba(0,0,0,.35)'; x.fillRect(0, 0, 240, 135);
  const mx = Math.max(0.01, ...d.heat);
  for (let i = 0; i < d.heat.length; i++) { const v = d.heat[i] / mx; if (v <= 0) continue; x.fillStyle = p.acc; x.globalAlpha = Math.min(1, 0.15 + v * 0.85); x.fillRect((i % 24) * 10, Math.floor(i / 24) * 9.64, 10, 9.64); }
  x.globalAlpha = 1; x.strokeStyle = '#ff4d5e'; x.lineWidth = 2;
  for (const [hx, hz] of d.hurtPos) { const px = (hx + AX) / (AX * 2) * 240, py = (hz + AZ) / (AZ * 2) * 135; x.beginPath(); x.moveTo(px - 4, py - 4); x.lineTo(px + 4, py + 4); x.moveTo(px + 4, py - 4); x.lineTo(px - 4, py + 4); x.stroke(); }
}
function changeCard() {
  if (state !== 'over') return;
  $('#overScreen').hidden = true; $('#startScreen').hidden = false; state = 'menu';
  const n = $('#panelNote'); n.hidden = false; n.innerHTML = '<b>Эксперимент.</b> Поменяй ровно одну карту механики (цель, глагол, угроза, поворот, камера) или одно число и нажми «Играть». Так будет видно, какая механика двигает динамику.';
  togglePanel(true); labels();
}
function resultText() {
  const D = DESIGN, lines = [`Занятие 3 · ${DESIGN.cpLabel || 'моя 3D-игра'}`, `Игра: «${D.name}». Герой: ${D.hero}, ${D.look}. Мир: ${D.world}. Цель по чувству: ${D.aim}.`];
  runs.forEach((r, i) => {
    const sn = r.snap;
    lines.push(`Партия ${i + 1}: M = ${GOALN[Math.round(sn.goal)]}, A: ${VERBN[Math.round(sn.verb)]}, ${THRN[Math.round(sn.threat)]}, ${TWN[Math.round(sn.twist)]}, камера ${CAMN[Math.round(sn.camera)]}${r.changed.length ? ` · поменял: ${r.changed.join('; ')}` : ''}`);
    if (r.pred && r.pred.length) lines.push(`  Предсказал → увидела игра (${r.pred.filter(x => x.ok).length}/${r.pred.length}): ${r.pred.map(x => `${x.ok ? '✓' : '✗'} ${x.txt} (${x.fact})`).join(' | ')}`);
    lines.push(`  D: ${r.dyn.map(x => x.txt).join(' | ')}`);
    lines.push(`  A: ${r.felt.join(', ') || '—'} · очки ${r.score}, ${r.time} с`);
  });
  if (runs.length > 1) lines.push(`Вывод: ${why.v ? why.v + (why.d ? ' [кубик]' : '') : '—'}`);
  return lines.join('\n');
}
$('#resCopy').onclick = e => copyText(resultText(), e.currentTarget, $('#resBox'), 'Скопировать результат');

/* ---------- запуск ---------- */
(function boot() {
  try {
    if (typeof THREE === 'undefined') throw new Error('не загрузилась библиотека 3D (three.js). Проверь интернет и обнови страницу.');
    document.title = DESIGN.name;
    $('#gTitle').textContent = DESIGN.name;
    $('#gSub').textContent = DESIGN.sub;
    $('#decisions').innerHTML = DESIGN.decisions.map(d => `<li>${d.replace(/[<>&]/g, '')}</li>`).join('');
    best = +store.get('lab3d-best-' + DESIGN.name) || 0;
    buildKnobs(); buildWorld(); setupRun(); labels(); hud();
    requestAnimationFrame(t => { last = t; frame(t); });
    window.__g = { get S() { return S; }, cfg, startGame, endGame, runs, setT: t => { gt = t; } };
  } catch (e) { fail('при запуске', e); }
})();
