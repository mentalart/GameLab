// Правка «Сценария учителя» из панели учителя (режим автора): текст пишется прямо в исходный файл урока,
// поэтому отредактированный сценарий — каноничный и попадает в репозиторий со следующим коммитом.
// Первая версия урока (urok-NN.js): строка поля в блоке teacher: { … } чекпоинта.
// Версия урока (urok-NN-vK.js, собирается из первой): строка cp('id').teacher.поле = '…' (или через переменную
// const x = cp('id')); если версия поле не меняла — такая строка дописывается перед module.exports, первая версия не трогается.
// После записи урок загружается заново и сверяется; если текст не тот или файл не загрузился — файл возвращается как был.
'use strict';

const fs = require('fs');

const FIELDS = ['say', 'ask', 'watch', 'next'];
const MAX = 3000;

const clean = t => String(t == null ? '' : t).replace(/\r\n?/g, '\n').replace(/[ \t]+$/gm, '').trim().slice(0, MAX);
const quote = t => "'" + t.replace(/\\/g, '\\\\').replace(/'/g, "\\'").replace(/\n/g, '\\n').replace(/\u2028/g, '\\u2028').replace(/\u2029/g, '\\u2029') + "'";
const reEsc = s => s.replace(/[.*+?^${}()|[\]\\]/g, '\\$&');
const fail = msg => Object.assign(new Error(msg), { status: 400 });

// конец строкового литерала, который начинается кавычкой в позиции i
function stringEnd(src, i) {
  const q = src[i];
  for (let j = i + 1; j < src.length; j++) {
    if (src[j] === '\\') { j++; continue; }
    if (q === '`' && src[j] === '$' && src[j + 1] === '{') throw fail('Сценарий в файле собирается шаблоном — поправьте его в чате «Сборка»');
    if (src[j] === q) return j + 1;
    if (src[j] === '\n' && q !== '`') break;
  }
  throw fail('Не разобрал строку сценария в файле урока');
}
// пропуск комментария в позиции i (или i, если его нет)
function skipComment(src, i) {
  if (src[i] === '/' && src[i + 1] === '/') { const e = src.indexOf('\n', i); return e < 0 ? src.length : e; }
  if (src[i] === '/' && src[i + 1] === '*') { const e = src.indexOf('*/', i + 2); return e < 0 ? src.length : e + 2; }
  return i;
}
// литерал после «… = » или «поле: » в позиции i: [начало, конец]; склейку строк плюсом не правим
function literalAt(src, i) {
  while (/\s/.test(src[i])) i++;
  if (!/['"`]/.test(src[i])) throw fail('Значение сценария в файле — не строка: поправьте его в чате «Сборка»');
  const end = stringEnd(src, i);
  let k = end; while (/\s/.test(src[k])) k++;
  if (src[k] === '+') throw fail('Строка сценария в файле склеена из частей — поправьте её в чате «Сборка»');
  return [i, end];
}
// парная закрывающая скобка для «{» в позиции i; заодно — где на глубине 1 начинаются поля
function objectBody(src, i) {
  let depth = 0;
  const keys = {};
  for (let j = i; j < src.length; j++) {
    const k = skipComment(src, j); if (k !== j) { j = k - 1; continue; }
    const c = src[j];
    if (c === "'" || c === '"' || c === '`') { j = stringEnd(src, j) - 1; continue; }
    if (c === '{' || c === '[' || c === '(') depth++;
    else if (c === '}' || c === ']' || c === ')') { depth--; if (!depth) return { end: j, keys }; }
    else if (depth === 1 && /[A-Za-z_$]/.test(c) && !/[\w$]/.test(src[j - 1])) {
      const m = /^([A-Za-z_$][\w$]*)\s*:/.exec(src.slice(j, j + 40));
      if (m) { keys[m[1]] = j + m[0].length; j += m[0].length - 1; }
    }
  }
  throw fail('Не нашёл конец блока teacher в файле урока');
}

// первая версия урока: блок teacher у чекпоинта id
function editBase(src, cpId, field, text) {
  const re = new RegExp(`\\bid:\\s*(['"])${reEsc(cpId)}\\1`, 'g');
  for (let m; (m = re.exec(src));) {
    const after = src.slice(m.index);
    const t = /\bteacher:\s*\{/.exec(after), s = /\bsteps:/.exec(after);
    if (!t || (s && s.index < t.index)) continue; // это шаг или чекпоинт без сценария
    const open = m.index + t.index + t[0].length - 1;
    const { end, keys } = objectBody(src, open);
    if (keys[field] != null) {
      const [a, b] = literalAt(src, keys[field]);
      return src.slice(0, a) + quote(text) + src.slice(b);
    }
    // поля нет: новая строка первой в блоке, с отступом соседних полей
    const firstKey = Object.values(keys).length ? Math.min(...Object.values(keys)) : null;
    const lineStart = firstKey != null ? src.lastIndexOf('\n', firstKey) + 1 : null;
    const indent = lineStart != null ? /^[ \t]*/.exec(src.slice(lineStart))[0] : '        ';
    if (lineStart != null && lineStart > open) return src.slice(0, lineStart) + `${indent}${field}: ${quote(text)},\n` + src.slice(lineStart);
    return src.slice(0, open + 1) + `\n${indent}${field}: ${quote(text)},` + src.slice(open + 1, end) + src.slice(end);
  }
  throw fail(`В файле урока нет сценария учителя у чекпоинта «${cpId}»`);
}

// версия урока: присваивание cp('id').teacher.поле или x.teacher.поле, где const x = cp('id')
function editVersion(src, cpId, field, text) {
  const names = [`cp\\((['"])${reEsc(cpId)}\\1\\)`];
  const v = new RegExp(`\\b(?:const|let|var)\\s+([A-Za-z_$][\\w$]*)\\s*=\\s*cp\\((['"])${reEsc(cpId)}\\2\\)\\s*;`, 'g');
  for (let m; (m = v.exec(src));) names.push(`\\b${reEsc(m[1])}`);
  let last = null;
  for (const n of names) {
    const re = new RegExp(`${n}\\.teacher\\.${field}\\s*=(?!=)`, 'g');
    for (let m; (m = re.exec(src));) if (!last || m.index > last.index) last = { index: m.index, end: m.index + m[0].length };
  }
  if (last) { const [a, b] = literalAt(src, last.end); return src.slice(0, a) + quote(text) + src.slice(b); }
  const exp = src.lastIndexOf('\nmodule.exports');
  if (exp < 0) throw fail('В файле версии урока нет module.exports');
  const line = `cp(${quote(cpId)}).teacher.${field} = ${quote(text)};\n`;
  const at = src[exp - 1] === '\n' ? exp : exp + 1; // перед пустой строкой у module.exports
  return src.slice(0, at) + line + src.slice(at);
}

// fields: { say, ask, watch, next } — только изменённые; load(file) — свежая загрузка урока; cpOf(lesson) — чекпоинт
function saveTeacherScript(file, { cp, fields }, load) {
  const cpId = String(cp || '');
  const todo = Object.entries(fields || {}).filter(([k]) => FIELDS.includes(k)).map(([k, v]) => [k, clean(v)]);
  if (!cpId || !todo.length) throw fail('Нечего сохранять');
  const before = load(file).checkpoints.find(c => c.id === cpId);
  if (!before || !before.teacher) throw fail('У этого чекпоинта нет сценария учителя');
  const orig = fs.readFileSync(file, 'utf8');
  const version = /require\(\s*['"]\.\/urok-\d+['"]\s*\)/.test(orig) && /-v\d+\.js$/.test(file);
  let src = orig;
  const changed = [];
  for (const [k, text] of todo) {
    if ((before.teacher[k] || '') === text) continue;
    src = version ? editVersion(src, cpId, k, text) : editBase(src, cpId, k, text);
    changed.push(k);
  }
  if (!changed.length) return { changed };
  const tmp = file + '.tmp-' + process.pid;
  fs.writeFileSync(tmp, src); fs.renameSync(tmp, file);
  let ok = false;
  try {
    const after = load(file).checkpoints.find(c => c.id === cpId);
    ok = !!after && todo.every(([k, text]) => (after.teacher[k] || '') === text);
  } catch (e) { ok = false; }
  if (!ok) {
    fs.writeFileSync(tmp, orig); fs.renameSync(tmp, file);
    throw Object.assign(new Error('Сценарий не сохранился: файл урока вернул прежний текст. Поправьте его в чате «Сборка»'), { status: 500 });
  }
  return { changed };
}

module.exports = { saveTeacherScript, FIELDS, editBase, editVersion };
