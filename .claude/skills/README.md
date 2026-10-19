# Skills проекта

Claude Code подхватывает эти папки сам в каждом чате с репозиторием: и в «Сборке», и в «Прохождении». Skill срабатывает по описанию из `description` в его `SKILL.md`; можно и назвать его прямо: «используй skill sborka-uroka для урока 9».

## Свои

| Skill | Когда |
| --- | --- |
| `sborka-uroka` | собрать урок N в портале до прохождения |
| `prohozhdenie-uroka` | вести урок как учитель, автор — ученик |
| `pravki-posle-uroka` | правки по заметкам автора и паспорту, метка версии |
| `lab3d-igra` | написать или довести игру на «Лаб3D» |
| `proverka-i-kommit` | проверки перед коммитом и отправка в main |

Свои skills — источник правды для процедур. `docs/03_Промпты_следующих_шагов.md` только ссылается на них. Меняя порядок работы, правь skill.

## Из сети

Скопированы без изменений, с лицензией и уведомлением в каждой папке. Код в них — для Godot и Unity; в играх курса правила переводятся на вызовы `lab` (см. `lab3d-igra`).

| Skill | Источник | Коммит, дата | Лицензия |
| --- | --- | --- | --- |
| `game-feel` | [gamedev-skills/awesome-gamedev-agent-skills](https://github.com/gamedev-skills/awesome-gamedev-agent-skills), `skills/disciplines/game-feel` | `0a70cfc`, 09.10.2026 | Apache-2.0 |
| `camera-systems` | там же, `skills/disciplines/camera-systems` | `0a70cfc`, 09.10.2026 | Apache-2.0 |
| `level-design` | там же, `skills/disciplines/level-design` | `0a70cfc`, 09.10.2026 | Apache-2.0 |
| `game-jam` | там же, `skills/workflows/game-jam` | `0a70cfc`, 09.10.2026 | Apache-2.0 |
| `frontend-design` | [anthropics/skills](https://github.com/anthropics/skills), `skills/frontend-design` | `dbd4588`, 09.10.2026 | Apache-2.0 |

Пересказаны своими словами, без копирования (у источника нет лицензии): `lab3d-igra/planka.md` — по справочникам скилла `gamemaker` из [studioigor/game-exp-skills](https://github.com/studioigor/game-exp-skills), 19.10.2026. Сами скиллы `gamemaker` и `gauntlet-loop` не ставим: это ночные прогоны под `/loop` на сотни миллионов токенов.

Обновлять вручную: скачать новую версию, прочитать целиком (особенно скрипты, если появятся), заменить папку, поправить строку таблицы.

Портал skills не видит: Sonnet в портале вызывается обычным запросом (`portal/lib/ai.js`). Полезное из этих skills попадает к ИИ портала только через промпт `portal/ai/claude-prompt.md`.
