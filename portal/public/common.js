// Общие помощники страниц портала: запросы к серверу, уведомления, кубик и поле с кубиком, звук, копирование.
'use strict';
const Lab = (() => {
  // у ученика и учителя разные ключи: в одном браузере можно держать обе вкладки
  const ROLE = document.documentElement.dataset.role || 'student';
  const key = role => 'lab:token:' + (role || ROLE);
  const token = {
    get(role) { try { return localStorage.getItem(key(role)) || ''; } catch (e) { return ''; } },
    set(t, role) { try { localStorage.setItem(key(role), t); } catch (e) { /* приватный режим */ } },
    clear(role) { try { localStorage.removeItem(key(role)); } catch (e) { /* пусто */ } },
  };
  async function api(path, body) {
    const opts = { headers: { 'X-Lab-Token': token.get() } };
    if (body !== undefined) { opts.method = 'POST'; opts.headers['Content-Type'] = 'application/json'; opts.body = JSON.stringify(body); }
    let res;
    try { res = await fetch(path, opts); } catch (e) { throw new Error('Нет связи с порталом. Проверь, что сервер запущен.'); }
    const data = await res.json().catch(() => ({}));
    if (!res.ok) { const err = new Error(data.error || 'Ошибка ' + res.status); err.status = res.status; throw err; }
    return data;
  }
  // задание ИИ: запуск и опрос до конца
  async function job(path, body, onTick) {
    const { job: id } = await api(path, body);
    for (;;) {
      await new Promise(r => setTimeout(r, 1000));
      const j = await api('/api/job?id=' + encodeURIComponent(id));
      if (onTick) onTick(j);
      if (j.state === 'done') return j.result;
      if (j.state === 'error') throw new Error(j.error);
    }
  }
  function el(tag, attrs, ...kids) {
    const e = document.createElement(tag);
    for (const [k, v] of Object.entries(attrs || {})) {
      if (v == null || v === false) continue;
      if (k === 'class') e.className = v;
      else if (k === 'html') e.innerHTML = v;
      else if (k.startsWith('on')) e.addEventListener(k.slice(2), v);
      else e.setAttribute(k, v === true ? '' : v);
    }
    for (const k of kids.flat()) if (k != null && k !== false) e.append(k instanceof Node ? k : document.createTextNode(String(k)));
    return e;
  }
  function toast(text, kind = '', ms = 4200) {
    let host = document.querySelector('.toasts');
    if (!host) { host = el('div', { class: 'toasts', 'aria-live': 'polite' }); document.body.append(host); }
    const t = el('div', { class: 'toast ' + kind }, text);
    host.append(t);
    setTimeout(() => t.remove(), ms);
  }
  // кубик: случайный вариант из колоды, не повторяя текущий
  function roll(deck, current) {
    const list = (deck || []).filter(x => x !== current);
    return list.length ? list[Math.floor(Math.random() * list.length)] : current;
  }
  let AC = null;
  function beep(kind) {
    try {
      AC = AC || new (window.AudioContext || window.webkitAudioContext)();
      const notes = { good: [660, 990], bad: [220, 160], tick: [880], dice: [520, 700, 600], done: [523, 659, 784, 1046] }[kind] || [600];
      notes.forEach((f, i) => {
        const o = AC.createOscillator(), g = AC.createGain(), t = AC.currentTime + i * 0.07;
        o.type = kind === 'bad' ? 'sawtooth' : 'triangle'; o.frequency.value = f;
        g.gain.setValueAtTime(0.08, t); g.gain.exponentialRampToValueAtTime(0.0001, t + 0.16);
        o.connect(g); g.connect(AC.destination); o.start(t); o.stop(t + 0.18);
      });
    } catch (e) { /* без звука */ }
  }
  async function copy(text) {
    try { await navigator.clipboard.writeText(text); toast('Скопировано — вставь в чат', 'ok'); }
    catch (e) {
      const ta = el('textarea', { style: 'position:fixed;left:-9999px' }); ta.value = text; document.body.append(ta); ta.select();
      try { document.execCommand('copy'); toast('Скопировано — вставь в чат', 'ok'); } catch (_) { toast('Не удалось скопировать', 'err'); }
      ta.remove();
    }
  }
  // поле с кубиком: свои слова или вариант из колоды; нетронутый вариант помечается [кубик]
  function valText(v) { return v && typeof v === 'object' ? v.text || '' : v || ''; }
  function fieldTag(v) {
    if (!valText(v)) return null;
    if (v.dice) return el('span', { class: 'tag dice', title: 'Вариант кубика, автор его не менял' }, '[кубик]');
    if (v.card) return el('span', { class: 'tag card', title: 'Автор выбрал карту из колоды' }, 'карта');
    if (v.auto) return el('span', { class: 'tag auto' }, 'черновик Фабрики');
    return el('span', { class: 'tag own' }, 'свои слова');
  }
  // f.cards — варианты колоды картами под полем: карта берётся одним касанием, свои слова по желанию (больше 6 карт — по 4, «↻ Другие карты»).
  // f.example — поле только своими словами: кубик не заполняет его, а показывает пример
  function fieldEditor(f, value, onChange, opts = {}) {
    let v = Object.assign({ text: '', dice: false }, typeof value === 'object' ? value : { text: value || '' });
    const tagHost = el('span');
    const setTag = () => { tagHost.innerHTML = ''; const t = fieldTag(v); if (t) tagHost.append(t); };
    const ta = el(opts.single ? 'input' : 'textarea', { type: opts.single ? 'text' : null, rows: opts.rows || 2, id: 'f-' + (opts.idPrefix || '') + f.id, placeholder: f.placeholder || (f.example ? 'Своими словами' : f.deck && f.deck.length ? (f.cards ? 'Возьми карту ниже или напиши своими словами' : 'Своими словами или брось кубик') : 'Своими словами') }); // без колоды кубика нет
    ta.value = v.text;
    const cardRow = f.cards && f.deck && f.deck.length ? el('div', { class: 'cardopts', role: 'group', 'aria-label': 'Карты для поля «' + f.label + '»' }) : null;
    let hand = [];
    const paintCards = () => {
      if (!cardRow) return;
      cardRow.innerHTML = '';
      hand.forEach(t => cardRow.append(el('button', { type: 'button', class: 'cardopt' + (v.text === t ? ' on' : ''), 'aria-pressed': String(v.text === t), onclick: () => {
        v = { text: t, card: true }; ta.value = t; setTag(); onChange(v); beep('tick'); paintCards();
      } }, t)));
      if (f.deck.length > 6) cardRow.append(el('button', { type: 'button', class: 'cardopt more', onclick: () => { deal(); beep('dice'); } }, '↻ Другие карты'));
    };
    const deal = () => {
      if (f.deck.length <= 6) hand = f.deck.slice();
      else { const rest = f.deck.filter(x => x !== v.text && !hand.includes(x)); hand = (rest.length >= 4 ? rest : f.deck.filter(x => x !== v.text)).slice().sort(() => Math.random() - 0.5).slice(0, 4); }
      paintCards();
    };
    if (cardRow) { deal(); if (f.deck.includes(v.text) && !hand.includes(v.text)) { hand[0] = v.text; paintCards(); } }
    ta.addEventListener('input', () => { v = { text: ta.value, dice: false }; setTag(); onChange(v); if (cardRow) cardRow.querySelectorAll('.cardopt.on').forEach(b => { b.classList.remove('on'); b.setAttribute('aria-pressed', 'false'); }); });
    const kids = [ta];
    const example = f.example ? el('div', { class: 'hint example', 'aria-live': 'polite' }) : null;
    if (f.deck && f.deck.length) {
      const d = el('button', { type: 'button', class: 'dicebtn', title: f.example ? 'Кубик: пример ответа' : 'Кубик: случайный вариант', 'aria-label': (f.example ? 'Пример для поля «' : 'Бросить кубик для поля «') + f.label + '»' }, '🎲');
      d.addEventListener('click', () => {
        d.classList.remove('roll'); void d.offsetWidth; d.classList.add('roll'); beep('dice');
        if (example) { example.dataset.text = roll(f.deck, example.dataset.text); example.textContent = 'Например: ' + example.dataset.text + '. А у тебя?'; return; }
        v = { text: roll(f.deck, v.text), dice: true }; ta.value = v.text; setTag(); onChange(v);
        if (cardRow) { if (!hand.includes(v.text)) hand[0] = v.text; paintCards(); }
      });
      kids.push(d);
    }
    setTag();
    return el('div', { class: 'field' + (f.cards ? ' with-cards' : '') },
      el('div', { class: 'head' }, f.letter ? el('span', { class: 'letter' }, f.letter) : null, el('label', { class: 'lbl', for: ta.id, style: 'margin:0' }, f.label), tagHost),
      f.hint ? el('div', { class: 'hint' }, f.hint) : null,
      cardRow,
      el('div', { class: 'box' }, kids), example);
  }
  const fmtTime = iso => { if (!iso) return '—'; const s = Math.round((Date.now() - new Date(iso)) / 1000); return s < 60 ? s + ' с назад' : s < 3600 ? Math.round(s / 60) + ' мин назад' : new Date(iso).toLocaleString('ru-RU'); };
  return { token, api, job, el, toast, roll, beep, copy, fmtTime, valText, fieldTag, fieldEditor };
})();
