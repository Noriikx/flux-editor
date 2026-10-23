@echo off
title Installing Flux
cd /d "%~dp0"
where node >nul 2>nul
if errorlevel 1 (
  echo Node.js is needed to build Flux. Download the LTS version, install it, then run this again.
  start https://nodejs.org
  pause
  exit /b
)
echo [1/3] Getting everything Flux needs (first time takes a few minutes)...
call npm install
if errorlevel 1 goto failed
echo [2/3] Building the Flux app...
del "%USERPROFILE%\Desktop\Flux.lnk" >nul 2>nul
del "%APPDATA%\Microsoft\Windows\Start Menu\Programs\Flux.lnk" >nul 2>nul
call npm run dist
if not exist "dist\Flux-Setup.exe" (
  echo Retrying with a simpler build...
  call npx electron-builder --win --publish never -c.win.signAndEditExecutable=false
)
if not exist "dist\Flux-Setup.exe" goto fallback
echo [3/3] Opening the installer...
start "" "dist\Flux-Setup.exe"
echo.
echo Follow the installer. Afterwards Flux is in your Start menu and Windows search, like any app.
timeout /t 6 >nul
exit /b

:fallback
echo Could not build the installer, so Flux will start from this folder instead.
echo Tip: turning on Windows "Developer Mode" (Settings - System - For developers) usually fixes the build.
powershell -NoProfile -ExecutionPolicy Bypass -File "%~dp0tools\make-shortcut.ps1"
start "" wscript.exe "%~dp0Flux.vbs"
pause
exit /b

:failed
echo Something went wrong while downloading. Check your internet connection and try again.
pause
