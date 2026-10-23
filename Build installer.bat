@echo off
cd /d "%~dp0"
echo Building the Flux installer... this takes a few minutes.
call npm install
call npx electron-builder --win --publish never
explorer dist
