@echo off
cd /d "%~dp0"
where node >nul 2>nul || (echo Node.js not found. Install version 22 or newer: https://nodejs.org & pause & exit /b 1)
echo Starting SkillLens. Your browser will open; close this window to stop.
node scripts\serve.mjs %*
pause
