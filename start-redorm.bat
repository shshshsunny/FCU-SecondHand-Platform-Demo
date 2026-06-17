@echo off
chcp 65001 >nul
cd /d "%~dp0"
where node >nul 2>nul
if errorlevel 1 (
  echo 找不到 Node.js。請先安裝 Node.js 22.5 以上版本。
  pause
  exit /b 1
)
start "" http://localhost:3000
node --no-warnings server.js
pause
