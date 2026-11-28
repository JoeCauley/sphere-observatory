@echo off
setlocal
node "%~dp0scripts\launch-apartment.cjs" %*
exit /b %errorlevel%
