@echo off
chcp 65001 >nul
cd /d "%~dp0"
where node >nul 2>nul || (echo 没有找到 Node.js，请先安装 22 或更新的版本：https://nodejs.org & pause & exit /b 1)
echo 正在启动 SkillLens，浏览器会自动打开；关闭这个窗口即可退出。
node scripts\serve.mjs --lang zh %*
pause
