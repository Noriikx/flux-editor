@echo off
title Flux licence keys
cd /d "%~dp0"
node tools\make-keys.js
echo.
notepad PRIVATE-KEY.txt
pause
