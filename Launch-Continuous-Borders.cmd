@echo off
setlocal
for %%D in ("%~dp0..") do set "EXPEDITION=%%~fD"
set "SPHERE_INSTALL_STORE=%EXPEDITION%\installed-biomes.json"
set "SERVER_PORT="
for /f "delims=" %%P in ('powershell.exe -NoProfile -ExecutionPolicy Bypass -File "%~dp0scripts\start-observatory.ps1" -Port 8808 -AllowAlternatePort -PortOnly') do set "SERVER_PORT=%%P"
if not defined SERVER_PORT exit /b 1
set "ROUTE=beyond"
if /i "%~1"=="junction" set "ROUTE=junction"
if /i "%~1"=="doors" set "ROUTE=doors"
set "BROWSER=%ProgramFiles%\Google\Chrome\Application\chrome.exe"
if not exist "%BROWSER%" set "BROWSER=%ProgramFiles(x86)%\Microsoft\Edge\Application\msedge.exe"
start "" "%BROWSER%" --user-data-dir="%EXPEDITION%\pilot-profile" --no-first-run --no-default-browser-check "http://127.0.0.1:%SERVER_PORT%/?border=%ROUTE%"
endlocal
