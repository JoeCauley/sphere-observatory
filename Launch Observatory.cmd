@echo off
setlocal
cd /d "%~dp0"
powershell.exe -NoProfile -ExecutionPolicy Bypass -File "%~dp0scripts\open-observatory.ps1" %*
if errorlevel 1 (
    echo.
    echo The Observatory could not open. See the message above.
    if "%~1"=="" pause
    exit /b 1
)
endlocal
