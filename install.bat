@echo off
setlocal
chcp 65001 >nul
where node >nul 2>nul
if errorlevel 1 (
  echo Node.js 22.22以上を導入してから、もう一度実行してください。
  echo https://nodejs.org/en/download
  if not defined KOSU_NO_PAUSE pause
  exit /b 1
)
node "%~dp0scripts\install\cli.mjs" prepare %*
set "kosu_result=%errorlevel%"
if not defined KOSU_NO_PAUSE pause
exit /b %kosu_result%
