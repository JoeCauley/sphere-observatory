@echo off
setlocal
for %%D in ("%~dp0..") do set "EXPEDITION=%%~fD"
set "SPHERE_INSTALL_STORE=%EXPEDITION%\installed-biomes.json"
set "PORT="
for /f "delims=" %%P in ('powershell.exe -NoProfile -ExecutionPolicy Bypass -File "%~dp0scripts\start-observatory.ps1" -Port 8831 -AllowAlternatePort -PortOnly') do set "PORT=%%P"
if not defined PORT exit /b 1
set "ROUTE=?crossing=city-marsh"
if /i "%~1"=="forest" set "ROUTE=?border=forest"
if /i "%~1"=="wall" set "ROUTE=?border=wall"
if /i "%~1"=="--url" goto printurl
if /i "%~2"=="--url" goto printurl
set "BROWSER=%ProgramFiles%\Google\Chrome\Application\chrome.exe"
if not exist "%BROWSER%" set "BROWSER=%ProgramFiles(x86)%\Microsoft\Edge\Application\msedge.exe"
start "" "%BROWSER%" --user-data-dir="%EXPEDITION%\city-marsh-pilot" --no-first-run --no-default-browser-check "http://127.0.0.1:%PORT%/%ROUTE%"
endlocal
exit /b 0
:printurl
echo http://127.0.0.1:%PORT%/%ROUTE%
exit /b 0
