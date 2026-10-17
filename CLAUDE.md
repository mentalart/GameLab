# Лаборатория игр — правила для Claude

- Сначала прочитай `docs/01_Журнал_курса.md`: статус, решения, стандарты, порядок работы.
- Программа курса — `docs/02_Программа_курса.md`. Движок игр и контракт `GAME` — `portal/engine/README.md`. Промпт для Qwen — `portal/ai/game-prompt.md`.
- Правки идут сразу в `main`, без веток и запросов на слияние. В Claude Code это делает хук `.claude/hooks/autocommit.sh` в конце каждого ответа. Если хук не сработал (облачная среда, репозиторий в подпапке), в конце ответа с правками запусти `bash .claude/hooks/autocommit.sh` из корня репозитория. Стабильные точки отмечаются метками (`git tag урок-01`).
- Перед коммитом игр и оболочки запусти `node portal/tools/check-game.js --self`, перед коммитом портала — ещё `node portal/tools/e2e-portal.js`. Ошибки исправь до коммита.
- Следующие шаги разработки — готовые промпты в `docs/03_Промпты_следующих_шагов.md`.
- Порядок работы — skills в `.claude/skills/` (список и источники — `.claude/skills/README.md`): `sborka-uroka`, `prohozhdenie-uroka`, `pravki-posle-uroka`, `lab3d-igra`, `proverka-i-kommit`, а из сети — `game-feel`, `camera-systems`, `level-design`, `game-jam`, `frontend-design`.
- Никогда не коммить ключи API, `config.json`, `.env`, данные учеников и записи прохождений.
- Язык документов, интерфейса и сообщений коммитов — русский.
