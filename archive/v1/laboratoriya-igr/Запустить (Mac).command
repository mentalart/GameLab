#!/bin/bash
cd "$(dirname "$0")"
if ! command -v node >/dev/null 2>&1; then
  echo "Не найден Node.js. Установите версию LTS с сайта https://nodejs.org и запустите этот файл снова."
  read -n 1
  exit 1
fi
node server.js
