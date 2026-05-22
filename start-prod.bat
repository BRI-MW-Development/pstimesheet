@echo off
:: Start PS TimeSheet on Windows (plain Node, no PM2).
:: Double-click this file or run it from Command Prompt.

set ROOT=%~dp0

if not exist "%ROOT%backend\dist\main.js" (
    echo ERROR: backend\dist\main.js not found. Run build-prod.bat first.
    pause
    exit /b 1
)

if not exist "%ROOT%frontend\dist\index.html" (
    echo ERROR: frontend\dist\index.html not found. Run build-prod.bat first.
    pause
    exit /b 1
)

echo Starting PS TimeSheet...
echo Open your browser at http://localhost:3000
echo Press Ctrl+C to stop.
echo.

cd /d "%ROOT%backend"
node dist\main.js
pause
