@echo off
setlocal
powershell.exe -NoProfile -ExecutionPolicy Bypass -File "%~dp0scripts\start-observatory.ps1" -Port 8794
if errorlevel 1 exit /b 1
start "" "http://127.0.0.1:8794/studies/maintenance-interchange/index.html"
