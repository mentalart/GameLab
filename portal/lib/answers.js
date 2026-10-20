// Ответы учеников для учителя: каждый шаг урока одной строкой (как итог чекпоинта у ученика) и разбор квизов по карточкам.
'use strict';

const val = v => (v && typeof v === 'object' ? v.text || '' : v || '');
const dice = v => val(v) + (v && v.dice ? ' [кубик]' : '');
const quizLine = v => `верно ${v.correct} из ${v.total}, очки ${v.score}, серия ${v.bestStreak}` + (v.tries > 1 ? `, попыток ${v.tries}` : '') +
  ((v.mistakes || []).length ? '; ошибки: ' + v.mistakes.join('; ') : '');

// a — ответ ученика { value, done }; game — его игра (для шага сборки)
function answerText(step, a, game) {
  if (!a) return '';
  const v = a.value || {};
  switch (step.type) {
    case 'play': case 'teacher-demo': return v.rounds ? `партий ${v.rounds}, лучший счёт ${v.best || 0}` : (a.done ? 'сыграно' : '');
    case 'cards': return a.done ? 'карты на столе' : '';
    case 'variety': { // мастерская вариаций: сыгранные вариации с чувством и угаданной деталью, самая интересная
      const played = (step.variants || []).filter(x => (v.played || {})[x.id] && v.played[x.id].feel);
      if (!played.length) return '';
      const fav = (step.variants || []).find(x => x.id === v.fav);
      return played.map(x => `${x.label}: ${v.played[x.id].feel}` + (x.base ? '' : v.played[x.id].ok ? ', деталь угадал' : v.played[x.id].dial ? ', деталь не угадал' : '')).join('; ') + (fav ? `\nсамая интересная: ${fav.label}` : '');
    }
    case 'abtest': return v.A ? `спрятанная механика в игре ${v.side === 'A' ? 'А' : 'Б'}; голос: ${v.vote ? (v.vote === 'same' ? 'разницы нет' : 'игра ' + (v.vote === 'A' ? 'А' : 'Б')) : 'нет'}${v.vote && v.vote === v.side ? ' — почувствовал' : ''}; партий А ${v.A.rounds}, Б ${v.B.rounds}` : '';
    case 'secret': return v.guess ? `догадка: ${v.guess} — ${v.correct ? 'угадал' : v.trap ? 'ловушка: это было на картах' : 'не угадал'}` : '';
    case 'rounds': case 'sort': return v.total ? quizLine(v) : '';
    case 'blindpair': return v.vote ? (step.mode === 'secret' ? `«${v.title}» (автор ${v.author}): выбрал — ${v.vote === 'same' ? 'разницы нет' : v.felt ? 'со спрятанной механикой, почувствовал' : 'без спрятанной механики'}`
      : `«${v.title}» (автор ${v.author}): хочется вернуться — ${v.vote === 'same' ? 'разницы нет' : v.juicy ? 'в сочную' : 'в сухую'}`) : '';
    case 'listen': return v.total ? quizLine(v) : '';
    case 'vote': return v.votes ? 'голоса отданы, сыграно игр: ' + Object.keys(v.played || {}).length : '';
    case 'sequencer': return v.line ? `мелодия: ${v.line}` : '';
    case 'blind': return v.total ? `угадано ${v.correct} из ${v.total}` + ((v.mistakes || []).length ? '; не почувствовал: ' + v.mistakes.join('; ') : '') : '';
    case 'choice': return [(v.selected || []).join('; '), val(v.own) ? 'свои слова: ' + dice(v.own) : ''].filter(Boolean).join(' · ');
    case 'text': return a.done ? 'прочитано' : '';
    case 'factory': return [v.level ? `уровень: ${(step.levels.find(l => l.id === v.level) || {}).label || v.level}` : '']
      .concat(step.fields.filter(x => val((v.fields || {})[x.id])).map(x => `${x.label}: ${dice(v.fields[x.id])}`)).filter(Boolean).join('\n');
    case 'decisions': case 'igra': return step.fields.filter(x => val((v.fields || {})[x.id])).map(x => `${x.letter ? x.letter + ' — ' : ''}${x.label}: ${dice(v.fields[x.id])}`).join('\n');
    case 'producer': return v.result ? (v.result.forks || []).map((x, i) => `${x.question} → ${(v.choices || {})[i] || 'не выбрано'}`).join('\n') || 'прочитал' : '';
    case 'build': return game ? `«${game.title || ''}», версий ${game.versions.length}, текущая v${game.current}` + (v.rounds ? `, партий ${v.rounds}` : '') : '';
    case 'ownplay': return v.rounds ? `партий ${v.rounds}` + (v.match ? `; совпало с чувством: ${v.match.toLowerCase()}` + ((v.emotions || []).length ? ' ' + v.emotions.join(' ') : '') : '') + (val(v.answer) ? `; ${step.question || 'ответ'}: ${dice(v.answer)}` : '') : '';
    case 'razbor': return razborText(v);
    case 'verify': return verifyText(v);
    case 'experiment': return v.knob ? `ручка ${v.knob}: ${v.from} → ${v.to == null ? '—' : v.to}; предсказание: ${dice(v.guess) || '—'}` + (v.before && v.after ? `; счёт ${v.before.score} → ${v.after.score}` : '') + (v.result ? `; ${v.result.toLowerCase()}` : '') + (v.kept === 'keep' ? '; числа сохранены' : '') : '';
    case 'aicheck': return val(v.text) ? `догадка: ${val(v.text)}` : '';
    case 'workshop': return (v.requests || []).map(r => `${r.chat ? '[чат] ' : ''}${r.text}${r.dice ? ' [кубик]' : ''} → v${r.version}${r.repair ? ' (пропало: ' + r.repair.split('\n')[0].replace(/^.*нашёл, что пропало: /, '').replace(/\.$/, '') + ')' : ''}`).join('\n');
    case 'arcade': return v.game ? `«${v.title || ''}» (автор ${v.author || '—'}), партий ${v.rounds || 0}, лучший счёт ${v.best || 0}${v.beat ? ', рекорд автора побит' : ''}` : '';
    case 'playtest': return v.sent ? `${(v.emotions || []).join(' ')}; нравится: ${dice(v.like)}; хочется: ${dice(v.want)}; а что если: ${dice(v.whatif)}` : '';
    // модуль 4: объяснялки, квизы по картам, тепловая карта, редактор и галерея уровней
    case 'motion': return a.done ? 'посмотрел до конца' : v.seen ? `сцен: ${v.seen} из ${(step.scenes || []).length}` : '';
    case 'order': case 'mapquiz': return v.total ? quizLine(Object.assign({ bestStreak: v.bestStreak || 0 }, v)) : '';
    case 'heat': return v.finding ? `находка: ${v.finding}` : (v.marks || []).length ? `отметок на карте: ${v.marks.length}` : '';
    case 'leveledit': return Object.entries(v.levels || {}).map(([k, x]) => `${{ train: 'обучающий', tricky: 'коварный' }[k] || 'уровень'} «${x.title}», код ${x.code}, пар ${x.par != null ? x.par + ' ходов' : x.parTime + ' с'}`).join('; ');
    case 'gallery': return Object.keys(v.played || {}).length ? `сыграно уровней ${Object.keys(v.played).length}, пройдено ${Object.keys(v.cleared || {}).length}` + (Object.keys(v.rated || {}).length ? `, оценено ${Object.keys(v.rated).length}` : '') + ((v.accepted || []).length ? `, взял в игру ${v.accepted.length}` : '') : '';
    default: return a.done ? 'готово' : '';
  }
}

// все ответы класса по уроку: шаги по чекпоинтам, по ученику — текст каждого шага, по квизам — доля верных на каждой карточке
function classAnswers(les, students, gameOf) {
  const steps = les.checkpoints.flatMap((cp, ci) => cp.steps.map(st => ({ cp: cp.id, cpTitle: `${ci + 1}. ${cp.title}`, id: st.id, title: st.title, type: st.type })));
  const byId = Object.fromEntries(les.checkpoints.flatMap(cp => cp.steps).map(st => [st.id, st]));
  const rows = students.map(s => {
    const st = (s.lessons || {})[les.id] || { answers: {} };
    const game = st.gameId ? gameOf(st.gameId) : null;
    const answers = {};
    for (const x of steps) {
      const a = st.answers[x.id];
      if (a) answers[x.id] = { text: answerText(byId[x.id], a, game), done: !!a.done, at: a.at };
    }
    return { nick: s.nick, answers };
  }).sort((a, b) => a.nick.localeCompare(b.nick, 'ru'));
  const quizzes = steps.filter(x => ['sort', 'rounds', 'blind', 'listen'].includes(x.type)).map(x => {
    const cards = {};
    for (const s of students) {
      const v = ((((s.lessons || {})[les.id] || {}).answers || {})[x.id] || {}).value || {};
      for (const p of v.picks || []) {
        const c = cards[p.text] = cards[p.text] || { text: p.text, right: p.right, ok: 0, total: 0, wrong: {} };
        c.total++; if (p.ok) c.ok++; else c.wrong[p.chose] = (c.wrong[p.chose] || 0) + 1;
      }
    }
    // сначала самые трудные карточки
    return { id: x.id, title: x.title, cards: Object.values(cards).sort((a, b) => a.ok / a.total - b.ok / b.total) };
  }).filter(q => q.cards.length);
  return { steps, students: rows, quizzes };
}

// разбор прототипа (урок 1, чекпоинт 5): приборы и главная находка
const TOOL_NAMES = { curve: 'кривая', sort: 'своеволие ИИ', secret: 'спрятанная механика', lamps: 'лампочки' };
function razborText(v) {
  const tools = Object.entries(v.tools || {}).filter(([, t]) => t && t.done).map(([k]) => TOOL_NAMES[k] || k);
  if (!tools.length && !(v.findings || []).length) return '';
  const main = (v.findings || []).find(f => f.id === v.main);
  return `приборы: ${tools.join(', ') || '—'}; находок ${(v.findings || []).length}` + (main ? `\nглавная: ${main.kind === 'knob' ? '[ручка] ' : ''}${main.text}` : '') +
    (v.findings || []).filter(f => f !== main).map(f => `\n· ${f.kind === 'knob' ? '[ручка] ' : ''}${f.text}`).join('');
}
const VERDICTS = { yes: 'ближе к чувству', unknown: 'не знаю', worse: 'хуже' };
function verifyText(v) { return (v.log || []).map(x => `v${x.version}: ${VERDICTS[x.verdict] || x.verdict}`).join('; '); }

module.exports = { answerText, classAnswers, razborText, verifyText };
