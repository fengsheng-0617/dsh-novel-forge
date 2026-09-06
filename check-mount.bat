@echo off
setlocal EnableExtensions
chcp 65001 >nul
title NovelForge Mount Self-Check

rem ============================================================
rem  dsh-novel-forge mount self-check (web & desktop compatible)
rem  Usage : double-click, or:
rem          check-mount.bat [-url http://127.0.0.1:PORT] [-autofix]
rem  Output: mount-check-report.txt (send to developer if failing)
rem  Note  : keep this shell ASCII-only for cmd compatibility;
rem          all localized messages come from the Node engine.
rem ============================================================

set "NF_DIR=%~dp0"
cd /d "%NF_DIR%"

echo.
echo  ======================================================
echo   NovelForge plugin - mount self-check
echo   Plugin dir : %NF_DIR%
echo   Mode       : plain check  (add -autofix to auto-fix)
echo  ======================================================
echo.

where node >nul 2>nul
if errorlevel 1 goto :nonode

for /f "delims=" %%v in ('node -v') do set "NODEVER=%%v"
echo  [INFO] Node %NODEVER% detected.

if not exist "%NF_DIR%scripts\check-mount.mjs" goto :noengine

echo  Running diagnostics... (Ctrl+C to abort)
echo.
node "%NF_DIR%scripts\check-mount.mjs" %*
set "EXITCODE=%ERRORLEVEL%"
echo.

if "%EXITCODE%"=="0" (
  echo  ======================================================
  echo   RESULT : MOUNT OK - open the URL shown in the report.
  echo  ======================================================
) else if "%EXITCODE%"=="3" (
  echo  ======================================================
  echo   RESULT : DEGRADED - plugin is fine, but no instance
  echo            was found. Follow the guide in the report.
  echo  ======================================================
) else (
  echo  ======================================================
  echo   RESULT : HARD FAILURE - fix every [FAIL] line first.
  echo  ======================================================
)
echo.
echo  Report : %NF_DIR%mount-check-report.txt
echo           If unresolved, send this file + host log to the
echo           developer (Chinese messages included inside).
goto :end

:nonode
echo  [FAIL] Node.js not found. Install Node 18.17+ first.
echo         https://nodejs.org/
echo  [FAIL] Node.js not found. Install Node 18.17+ and rerun.
(
  echo [FAIL] Node.js not found. Plugin requires Node 18.17+.
  echo Report written at %DATE% %TIME%
  echo Plugin dir: %NF_DIR%
  echo Action: install Node.js then rerun this self-check.
  echo Submit: send this file to the developer if needed.
) > "%NF_DIR%mount-check-report.txt" 2>nul
echo  Report : %NF_DIR%mount-check-report.txt
goto :end

:noengine
echo  [FAIL] Missing scripts\check-mount.mjs. Use the full plugin package.
goto :end

:end
echo.
if not defined NF_NO_PAUSE pause
exit /b %EXITCODE%
