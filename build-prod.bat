@echo off
:: Build PS TimeSheet for production on Windows.
:: Run this from Command Prompt (not PowerShell required).

set ROOT=%~dp0

echo ================================================
echo   PS TimeSheet — Production Build
echo ================================================

echo.
echo [1/4] Installing frontend dependencies...
cd /d "%ROOT%frontend"
call npm ci --prefer-offline --silent
if errorlevel 1 ( echo FAILED: frontend npm ci & pause & exit /b 1 )

echo [2/4] Building frontend...
call npm run build
if errorlevel 1 ( echo FAILED: frontend build & pause & exit /b 1 )
echo       Done: frontend\dist ready

echo.
echo [3/4] Installing backend dependencies...
cd /d "%ROOT%backend"
call npm ci --prefer-offline --silent --omit=dev
if errorlevel 1 ( echo FAILED: backend npm ci & pause & exit /b 1 )

echo [4/4] Building backend...
call npm run build
if errorlevel 1 ( echo FAILED: backend build & pause & exit /b 1 )
echo       Done: backend\dist ready

echo.
echo ================================================
echo   Build complete.
echo   Start the app: double-click start-prod.bat
echo ================================================
pause
