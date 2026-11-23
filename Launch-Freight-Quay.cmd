@echo off
setlocal
set "BEARING=along"
if /i "%~1"=="across" set "BEARING=across"
set "FREIGHT_STUDY=%TEMP%\Sphere-Observatory-Freight-Study"
if not exist "%FREIGHT_STUDY%\" mkdir "%FREIGHT_STUDY%"
if not exist "%FREIGHT_STUDY%\" exit /b 1
set "SPHERE_INSTALL_STORE=%FREIGHT_STUDY%\installed-biomes.json"
powershell.exe -NoProfile -ExecutionPolicy Bypass -File "%~dp0scripts\start-observatory.ps1" -Port 8793
if errorlevel 1 exit /b 1
start "" "http://127.0.0.1:8793/?freight=%BEARING%"
endlocal
