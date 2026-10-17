@echo off
chcp 65001 >nul
cd /d "%~dp0"
where node >nul 2>nul
if errorlevel 1 (
  echo Не найден Node.js. Установите версию LTS с сайта https://nodejs.org и запустите этот файл снова.
  pause
  exit /b
)
node server.js
pause
