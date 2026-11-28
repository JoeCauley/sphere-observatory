@echo off
setlocal
for %%D in ("%~dp0..") do set "EXPEDITION=%%~fD"
set "PILOT=%EXPEDITION%"
set "PORT=8844"
if /i "%~1"=="--qa" (
  set "PILOT=%EXPEDITION%\qa"
  set "PORT=8846"
)
set "SPHERE_INSTALL_STORE=%PILOT%\installed-biomes.json"
if not exist "%SPHERE_INSTALL_STORE%" (
  echo Missing the expedition register at "%SPHERE_INSTALL_STORE%".
  exit /b 1
)
set "READY="
for /f "delims=" %%P in ('powershell.exe -NoProfile -ExecutionPolicy Bypass -File "%~dp0scripts\start-observatory.ps1" -Port %PORT% -PortOnly') do set "READY=%%P"
if not "%READY%"=="%PORT%" exit /b 1
set "ROUTE=http://127.0.0.1:%PORT%/?mill=R1"
if /i "%~1"=="--url" goto printurl
if /i "%~2"=="--url" goto printurl
set "BROWSER=%ProgramFiles%\Google\Chrome\Application\chrome.exe"
if not exist "%BROWSER%" set "BROWSER=%ProgramFiles(x86)%\Microsoft\Edge\Application\msedge.exe"
start "" "%BROWSER%" --user-data-dir="%PILOT%\mill-pilot" --no-first-run --no-default-browser-check "%ROUTE%"
exit /b 0
:printurl
echo %ROUTE%
exit /b 0
