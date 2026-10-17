#!/usr/bin/env bash
# Автокоммит (решение автора курса, 17.10.2026): в конце каждого ответа Claude
# все изменения коммитятся и отправляются в main. Запускается хуком Stop
# из .claude/settings.json. Секреты и данные класса защищены .gitignore.
set -u
input="$(cat 2>/dev/null || true)"
cd "${CLAUDE_PROJECT_DIR:-$(git rev-parse --show-toplevel 2>/dev/null || pwd)}" || exit 0
git rev-parse --is-inside-work-tree >/dev/null 2>&1 || exit 0

# Если хук уже останавливал этот ответ, второй раз не останавливаем (без циклов).
active=0
case "$input" in *'"stop_hook_active":true'*|*'"stop_hook_active": true'*) active=1 ;; esac

if [ -n "$(git status --porcelain)" ]; then
  git add -A
  n="$(git diff --cached --name-only | wc -l | tr -d ' ')"
  if [ "$n" != "0" ]; then
    files="$(git diff --cached --name-only | head -5 | sed 's#.*/##' | paste -sd ',' - | sed 's/,/, /g')"
    more=""; [ "$n" -gt 5 ] && more=" и ещё $((n - 5))"
    git commit -q -m "Автокоммит: ${files}${more}" -m "Co-Authored-By: Claude <noreply@anthropic.com>" || true
  fi
fi

git fetch -q origin main 2>/dev/null || true
ahead="$(git rev-list --count origin/main..HEAD 2>/dev/null || echo 1)"
[ "$ahead" = "0" ] && exit 0

log="$(mktemp)"
branch="$(git rev-parse --abbrev-ref HEAD)"
if git pull -q --rebase origin main >"$log" 2>&1 && git push -q origin HEAD:main >>"$log" 2>&1; then
  # Если сессия работает в своей ветке, держим и её в актуальном состоянии.
  [ "$branch" != "main" ] && [ "$branch" != "HEAD" ] && git push -q -f origin "HEAD:$branch" >/dev/null 2>&1
  exit 0
fi
if [ "$active" = "0" ]; then
  echo "Автокоммит не смог отправить изменения в main: $(tail -3 "$log" | tr '\n' ' '). Разберись (конфликт, сеть, права) и отправь вручную." >&2
  exit 2
fi
exit 0
