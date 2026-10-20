@echo off
chcp 65001 >nul
rem Запуск портала двойным щелчком: папка берётся от этого файла, а не от того, где открыта консоль.
cd /d "%~dp0"
where node >nul 2>nul
if errorlevel 1 (
  echo Не найден Node.js. Установите версию LTS с сайта https://nodejs.org и запустите этот файл снова.
  pause
  exit /b
)
if not exist "portal\server.js" (
  echo Рядом с этим файлом нет portal\server.js. Положите файл в корень папки GameLab.
  pause
  exit /b
)
node portal\server.js %*
pause
