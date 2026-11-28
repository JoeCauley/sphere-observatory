@echo off
setlocal
for %%D in ("%~dp0..") do set "EXPEDITION=%%~fD"
set "SPHERE_INSTALL_STORE=%EXPEDITION%\installed-biomes.json"
set "PORT="
for /f "delims=" %%P in ('powershell.exe -NoProfile -ExecutionPolicy Bypass -File "%~dp0scripts\start-observatory.ps1" -Port 8826 -AllowAlternatePort -PortOnly') do set "PORT=%%P"
if not defined PORT exit /b 1
if /i "%~1"=="--url" (
  echo http://127.0.0.1:%PORT%/?border=forest
  exit /b 0
)
set "BROWSER=%ProgramFiles%\Google\Chrome\Application\chrome.exe"
if not exist "%BROWSER%" set "BROWSER=%ProgramFiles(x86)%\Microsoft\Edge\Application\msedge.exe"
start "" "%BROWSER%" --user-data-dir="%EXPEDITION%\forest-pilot" --no-first-run --no-default-browser-check "http://127.0.0.1:%PORT%/?border=forest"
endlocal
