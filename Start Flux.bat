@echo off
cd /d "%~dp0"
if not exist node_modules\electron\dist\electron.exe (
  call "%~dp0Install Flux.bat"
  exit /b
)
start "" wscript.exe "%~dp0Flux.vbs"
