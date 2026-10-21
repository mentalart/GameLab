// Ритуалы и общие шаги курса (аудит 21.10.2026, сессия 1) для страницы ученика. Подключается после student.js и берёт его помощники (el, api, S, ans…).
//   «🤡 Провал дня» (А5): учитель выбрал баг моей игры — вопрос «можно показать классу?» в углу экрана, ответ — POST /api/fail/consent.
//   samootsenka (А4): самооценка модуля и лесенка роста. obyasni (Б3): «Объясни соседу за 30 секунд» по карте понятия.
'use strict';

/* ---------- «🤡 Провал дня»: согласие автора ---------- */
function failAsk(f) {
  const old = document.getElementById('failAsk'); if (old) old.remove();
  if (!f) return;
  const answer = async yes => {
    try { await api('/api/fail/consent', { yes }); box.remove(); toast(yes ? 'Спасибо! Твой баг сейчас на проекторе — смеёмся вместе и разбираемся, почему так вышло' : 'Хорошо, учитель выберет другой баг', 'ok'); }
    catch (e) { toast(e.message, 'err'); box.remove(); }
  };
  const box = el('section', { class: 'fail-ask', id: 'failAsk', role: 'alertdialog', 'aria-labelledby': 'failAskT' },
    el('div', { class: 'row', style: 'gap:12px;flex-wrap:nowrap' }, el('span', { class: 'fa-ico', 'aria-hidden': 'true' }, '🤡'),
      el('div', { class: 'stack', style: 'gap:4px' }, el('b', { id: 'failAskT' }, 'Можно показать твой баг классу?'),
        el('span', { class: 'small' }, `Учитель хочет открыть «${f.title}» (v${f.version}) в «Провале дня» на проекторе.`))),
    el('p', { class: 'small muted' }, 'Баг — повод посмеяться и разобраться, почему так вышло. Это не оценка: у всех геймдизайнеров игры ломаются смешно.'),
    el('div', { class: 'row' }, el('button', { type: 'button', class: 'btn warm', 'data-fail': 'yes', onclick: () => answer(true) }, '🤡 Можно, покажите'),
      el('button', { type: 'button', class: 'btn ghost', 'data-fail': 'no', onclick: () => answer(false) }, 'Не сейчас')));
  document.body.append(box);
  beep('tick');
}
// событие fail: вопрос — только автору (и команде) выбранной игры, пока он не ответил
function failEvent(d) {
  failAsk(d && d.game && d.consent === 'ask' && (d.nicks || []).includes(S.me.nick) ? d : null);
}

/* ---------- samootsenka: самооценка модуля и лесенка роста (А4) ---------- */
// Один шаг на релизе каждого модуля (уроки 4, 8, 13, 18, 22, 25, 28, 35). Общие вопросы — шкала 1–5 «что я умею как геймдизайнер»
// (S.lesson.rost: skills и scale, одни на весь курс), понятия модуля (concepts — «что объясню на своей игре», до max) и одна фраза.
// Рядом с шкалой — метка прошлого модуля; после ответа — лесенка по модулям (GET /api/rost), она же — в «Моей студии».
const rostComma = x => String(x).replace('.', ',');
function rostLadder(rost, current) {
  const ladder = rost.ladder || [];
  if (!ladder.length) return el('p', { class: 'muted small' }, 'Лесенка появится после первой самооценки.');
  const first = ladder[0];
  return el('div', { class: 'rost-ladder', role: 'list', 'aria-label': 'Лесенка роста по модулям' }, ladder.map(r => {
    const d = Math.round(10 * (r.avg - first.avg)) / 10;
    return el('div', { class: 'rost-rung' + (r.module === current ? ' now' : ''), role: 'listitem', style: `--h:${Math.round(r.avg / 5 * 100)}%` },
      el('span', { class: 'rr-bar', 'aria-hidden': 'true' }, el('i', {})),
      el('b', {}, rostComma(r.avg)), el('span', { class: 'eyebrow' }, `Модуль ${r.module}`),
      r !== first && d ? el('span', { class: 'small ' + (d > 0 ? 'rr-up' : 'muted') }, (d > 0 ? '+' : '') + rostComma(d)) : null,
      r.phrase ? el('span', { class: 'small muted rr-phrase' }, '«' + r.phrase + '»') : null);
  }));
}
STEPS.samootsenka = ctx => {
  const st = ctx.step, R = S.lesson.rost || { skills: [], scale: [] };
  let v = Object.assign({ scores: {}, concepts: [], phrase: null }, ctx.value);
  const host = el('div', { class: 'stack rost' });
  let prev = null, rost = null;
  api('/api/rost').then(r => { rost = r; prev = r.ladder.filter(x => x.module < st.module).pop() || null; draw(); }).catch(() => {});
  const max = st.max || 3;
  function draw() {
    host.innerHTML = '';
    host.append(el('div', { class: 'eyebrow' }, `Что я умею как геймдизайнер · конец модуля ${st.module}`),
      el('p', { class: 'small muted' }, 'Честно, для себя: это не оценка. ' + (prev ? `Метка ◆ — что ты ставил в конце модуля ${prev.module}.` : 'В конце каждого модуля — те же вопросы, и ты увидишь свой рост.')));
    R.skills.forEach(k => {
      const cur = Number(v.scores[k.id]) || 0, was = prev ? Number(prev.scores[k.id]) || 0 : 0;
      host.append(el('div', { class: 'rost-row' }, el('div', { class: 'rost-q' }, el('span', { 'aria-hidden': 'true' }, k.icon), el('b', {}, k.label)),
        el('div', { class: 'rost-scale', role: 'radiogroup', 'aria-label': k.label }, R.scale.map((lab, i) => el('button', {
          type: 'button', class: 'rost-dot' + (cur === i + 1 ? ' on' : '') + (cur > i ? ' fill' : '') + (was === i + 1 ? ' was' : ''), role: 'radio', 'aria-checked': String(cur === i + 1),
          'data-rost': `${k.id}:${i + 1}`, title: lab, 'aria-label': `${i + 1} — ${lab}`,
          onclick: () => { v.scores[k.id] = i + 1; beep('tick'); ctx.save(v); draw(); },
        }, String(i + 1)))),
        el('span', { class: 'small muted rost-lab' }, cur ? R.scale[cur - 1] + (was && cur > was ? ' ↑' : '') : '—')));
    });
    if ((st.concepts || []).length) {
      host.append(el('div', { class: 'eyebrow', style: 'margin-top:6px' }, st.conceptsQ || `Понятия модуля ${st.module}: что объяснишь другу на своей игре? До ${max}`),
        el('div', { class: 'chips rost-concepts', role: 'group' }, st.concepts.map(c => {
          const on = v.concepts.includes(c);
          return el('button', { type: 'button', class: 'chipbtn' + (on ? ' on' : ''), 'aria-pressed': String(on), onclick: () => {
            if (on) v.concepts = v.concepts.filter(x => x !== c); else if (v.concepts.length < max) v.concepts = v.concepts.concat(c); else { toast(`Не больше ${max}: выбери главное`); return; }
            beep('tick'); ctx.save(v); draw();
          } }, c);
        })));
    }
    host.append(fieldEditor({ id: 'phrase', label: 'Одной фразой: что я теперь умею', deck: st.deck || [], example: true, hint: 'Своими словами. Кубик покажет пример.' }, v.phrase, nv => { v.phrase = nv; ctx.save(v); }, { single: true, idPrefix: st.id }));
    const missing = R.skills.filter(k => !v.scores[k.id]).length;
    host.append(el('div', { class: 'row' }, el('span', { class: 'small muted grow' }, missing ? `Осталось ответить: ${missing}` : 'Все ответы на месте'),
      el('button', { type: 'button', class: 'btn', 'data-rost-save': '1', onclick: async () => {
        if (missing) { toast('Отметь каждый вопрос: от «пока не умею» до «научу другого»'); return; }
        if (!valText(v.phrase)) { toast('Допиши одну фразу: что ты теперь умеешь'); return; }
        ctx.save(v, true, true); beep('good');
        await flushSaves();
        try { rost = await api('/api/rost'); } catch (e) { /* лесенка — из прошлого ответа */ }
        draw();
      } }, ctx.done ? 'Сохранено ✓' : 'Сохранить в лесенку')));
    if (ctx.done && rost) host.append(el('div', { class: 'eyebrow' }, 'Лесенка роста · вся она в «Моей студии»'), rostLadder(rost, st.module));
  }
  draw();
  return host;
};

/* ---------- obyasni: «Объясни соседу за 30 секунд» (Б3) ---------- */
// Сразу после теории. Пары: ученик объясняет соседу понятие (st.concept из S.lesson.concepts) на примере донора, сосед сам жмёт на этом
// ноутбуке «Понял» или «Не понял». Не понял — вторая попытка с подсказкой (text понятия), потом меняются: объясняет сосед на своём ноутбуке.
// Не проверка: учитель видит на пульте только долю «Понял» и пары, которые застряли (две попытки «Не понял»).
const OBYASNI_SEC = 30;
STEPS.obyasni = ctx => {
  const st = ctx.step, all = S.lesson.concepts || [], c = all.find(x => x.id === st.concept) || all[0];
  let v = Object.assign({ partner: '', tries: [] }, ctx.value);
  const host = el('div', { class: 'stack obyasni' });
  if (!c) { host.append(el('p', { class: 'muted' }, 'В этом уроке нет карты понятия.')); return host; }
  let peers = [], left = 0, tick = null;
  api('/api/class/peers').then(r => { peers = r.nicks || []; if (!ctx.done) draw(); }).catch(() => {});
  const stop = () => { if (tick) clearInterval(tick); tick = null; };
  function start(ring) {
    stop(); left = OBYASNI_SEC; beep('tick');
    const paint = () => { ring.style.setProperty('--p', String(left / OBYASNI_SEC)); ring.querySelector('b').textContent = left ? String(left) : '0'; ring.classList.toggle('end', !left); };
    paint();
    tick = setInterval(() => {
      if (!host.isConnected) { stop(); return; }
      left--; paint();
      if (!left) { stop(); beep('done'); ring.querySelector('span').textContent = 'Время! Сосед, решай'; }
    }, 1000);
  }
  function verdict(got) {
    stop();
    v.tries = v.tries.concat(got ? 'got' : 'not');
    const fin = got || v.tries.length >= 2;
    ctx.save(v, fin, fin);
    beep(got ? 'good' : 'tick');
    if (!fin) toast('Ничего страшного: объясни ещё раз, по-другому. Подсказка — на карте');
    draw();
  }
  function draw() {
    stop(); host.innerHTML = '';
    const tries = v.tries, got = tries.includes('got');
    if (ctx.done || got || tries.length >= 2) {
      host.append(conceptCard(c, null, true, true),
        el('div', { class: 'obyasni-res ' + (got ? 'ok' : 'stuck'), role: 'status' },
          el('b', {}, got ? (tries.length === 1 ? '👍 Сосед понял с первого раза' : '👍 Сосед понял со второй попытки') : '🤔 Пока не получилось — это нормально'),
          el('span', { class: 'small' }, got ? 'Теперь меняйтесь: объясняет сосед, на своём ноутбуке. Слушай и жми там «Понял» или «Не понял».' : 'Учитель увидит, что вашей паре нужна помощь, и подойдёт. А пока поменяйтесь: пусть объяснит сосед.')));
      return;
    }
    const second = tries.length === 1;
    const ring = el('div', { class: 'obyasni-ring', style: '--p:1', role: 'timer', 'aria-live': 'off' }, el('b', {}, String(OBYASNI_SEC)), el('span', {}, 'секунд'));
    host.append(
      el('p', { class: 'obyasni-lead' }, second ? 'Попытка 2. Объясни по-другому: своими словами и своим примером.' : 'Объясни соседу эту карту за 30 секунд. Пример — у донора.'),
      conceptCard(c, null, true, true));
    if (second) host.append(el('p', { class: 'obyasni-hint' }, el('b', {}, 'Подсказка: '), c.text));
    if (peers.length) host.append(el('div', { class: 'eyebrow' }, 'Кому объясняешь? Можно не выбирать'),
      el('div', { class: 'chips', role: 'group', 'aria-label': 'Сосед' }, peers.slice(0, 30).map(n => el('button', { type: 'button', class: 'chipbtn' + (v.partner === n ? ' on' : ''), 'aria-pressed': String(v.partner === n), 'data-partner': n,
        onclick: () => { v.partner = v.partner === n ? '' : n; ctx.save(v); draw(); } }, n))));
    host.append(el('div', { class: 'row obyasni-go' }, ring,
      el('button', { type: 'button', class: 'btn', 'data-explain': 'start', onclick: () => start(ring) }, second ? '▶ Ещё 30 секунд' : '▶ Начать 30 секунд')),
      el('div', { class: 'eyebrow' }, 'Сосед, это кнопки для тебя:'),
      el('div', { class: 'row' },
        el('button', { type: 'button', class: 'btn warm', 'data-explain': 'got', onclick: () => verdict(true) }, '👍 Понял'),
        el('button', { type: 'button', class: 'btn ghost', 'data-explain': 'not', onclick: () => verdict(false) }, '🤔 Не понял')),
      el('p', { class: 'small muted' }, 'Это не проверка: учитель увидит только, сколько пар поняли, без оценок.'));
  }
  draw();
  return host;
};

// сводка ответа для «Мои ответы» и учителя (student.js: summary → window.LabRitualSummary)
window.LabRitualSummary = (step, v) => {
  if (step.type === 'samootsenka') return v.scores ? 'умею: ' + Object.values(v.scores).join(' ') + ' из 5' + ((v.concepts || []).length ? '; понятия: ' + v.concepts.join('; ') : '') + (valText(v.phrase) ? '; ' + valText(v.phrase) : '') : '';
  if (step.type === 'obyasni') return (v.tries || []).length ? 'объяснил' + (v.partner ? ' соседу ' + v.partner : '') + ': ' + v.tries.map(t => (t === 'got' ? 'понял' : 'не понял')).join(' → ') : '';
  return '';
};
