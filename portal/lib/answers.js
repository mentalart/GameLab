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
    case 'abtest': return v.A ? `секрет в игре ${v.side === 'A' ? 'А' : 'Б'}; голос: ${v.vote ? (v.vote === 'same' ? 'разницы нет' : 'напряжённее ' + (v.vote === 'A' ? 'А' : 'Б')) : 'нет'}${v.vote && v.vote === v.side ? ' — почувствовал' : ''}; партий А ${v.A.rounds}, Б ${v.B.rounds}` : '';
    case 'secret': return v.guess ? `догадка: ${v.guess} — ${v.correct ? 'угадал' : v.trap ? 'ловушка: это было на картах' : 'не угадал'}` : '';
    case 'rounds': case 'sort': return v.total ? quizLine(v) : '';
    case 'blindpair': return v.vote ? `«${v.title}» (автор ${v.author}): хочется вернуться — ${v.vote === 'same' ? 'разницы нет' : v.juicy ? 'в сочную' : 'в сухую'}` : '';
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
    case 'aicheck': return val(v.text) ? `догадка: ${val(v.text)}` : '';
    case 'workshop': return (v.requests || []).map(r => `${r.text}${r.dice ? ' [кубик]' : ''} → v${r.version}`).join('\n');
    case 'arcade': return v.game ? `«${v.title || ''}» (автор ${v.author || '—'}), партий ${v.rounds || 0}, лучший счёт ${v.best || 0}${v.beat ? ', рекорд автора побит' : ''}` : '';
    case 'playtest': return v.sent ? `${(v.emotions || []).join(' ')}; нравится: ${dice(v.like)}; хочется: ${dice(v.want)}; а что если: ${dice(v.whatif)}` : '';
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

module.exports = { answerText, classAnswers };
