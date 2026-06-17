@echo off
REM ============================================================
REM  DFCL Inventory App - Windows Local Dev Startup Script
REM  Double-click this file or run from Command Prompt.
REM ============================================================
REM  URL:   http://localhost:3000
REM  Login: admin / admin123
REM ============================================================

cd /d "%~dp0"

echo ==============================================
echo   DFCL Inventory App - Local Dev Server
echo ==============================================
echo.

REM Check for Node.js
where node >nul 2>nul
if %errorlevel% neq 0 (
  echo [ERROR] Node.js not found. Install Node.js 20+ from https://nodejs.org
  pause
  exit /b 1
)

REM Check for Bun
set PM=npm
where bun >nul 2>nul
if %errorlevel% equ 0 (
  set PM=bun
)
echo Package manager: %PM%

REM Install dependencies if missing
if not exist "node_modules" (
  echo Installing dependencies ^(first run, may take 1-2 minutes^)...
  if "%PM%"=="bun" (
    call bun install
  ) else (
    call npm install
  )
  echo Dependencies installed
)

REM Generate Prisma client
echo Generating Prisma client...
call %PM% run db:generate

REM Sync database
echo Syncing database schema...
call %PM% run db:push

REM Start dev server
echo.
echo Starting dev server...
echo    URL:   http://localhost:3000
echo    Login: admin / admin123
echo.
echo    Press Ctrl+C to stop
echo ==============================================
echo.

call %PM% run dev

pause
