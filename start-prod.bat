@echo off
REM ============================================================
REM  DFCL Inventory App - Windows Production Startup Script
REM ============================================================
REM  URL:   http://localhost:3000
REM  Login: admin / admin123
REM ============================================================

cd /d "%~dp0"

echo ==============================================
echo   DFCL Inventory App - Production Server
echo ==============================================
echo.

where node >nul 2>nul
if %errorlevel% neq 0 (
  echo [ERROR] Node.js not found. Install Node.js 20+ from https://nodejs.org
  pause
  exit /b 1
)

set PM=npm
where bun >nul 2>nul
if %errorlevel% equ 0 (
  set PM=bun
)
echo Package manager: %PM%

if not exist "node_modules" (
  echo Installing dependencies...
  if "%PM%"=="bun" (
    call bun install
  ) else (
    call npm install
  )
)

echo Generating Prisma client...
call %PM% run db:generate

echo Syncing database schema...
call %PM% run db:push

if not exist ".next\standalone\server.js" (
  echo Building production bundle ^(may take 30-60 seconds^)...
  call %PM% run build
  echo Build complete
) else (
  echo Using existing build ^(delete .next folder to force rebuild^)
)

echo.
echo Starting production server...
echo    URL:   http://localhost:3000
echo    Login: admin / admin123
echo.
echo    Press Ctrl+C to stop
echo ==============================================
echo.

if "%PM%"=="bun" (
  call bun .next\standalone\server.js
) else (
  call node .next\standalone\server.js
)

pause
