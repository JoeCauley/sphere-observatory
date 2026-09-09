@echo off
setlocal
cd /d "%~dp0"
powershell.exe -NoProfile -ExecutionPolicy Bypass -File "%~dp0scripts\start-observatory.ps1"
if errorlevel 1 (
    echo.
    echo Observatory could not start. The server port may already be in use.
    pause
    exit /b 1
)
start "" "http://127.0.0.1:8766/"
endlocal
