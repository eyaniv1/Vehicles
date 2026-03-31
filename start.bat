@echo off
echo ========================================
echo  Vehicles - Kill and Restart
echo ========================================
echo.

:: Kill any existing node process on port 3001
echo Killing existing server on port 3001...
for /f "tokens=5" %%a in ('netstat -aon ^| findstr :3001 ^| findstr LISTENING') do (
    taskkill /F /PID %%a 2>nul
    echo   Killed PID %%a
)

:: Kill any existing cloudflared process
echo Killing existing Cloudflare tunnel...
taskkill /F /IM cloudflared.exe 2>nul && echo   Tunnel killed || echo   No tunnel running

timeout /t 1 /nobreak >nul

:: Start the server
echo.
echo Starting Vehicles server...
cd /d "%~dp0server"
start "Vehicles Server" cmd /k "node index.js"

:: Wait for server to be ready
timeout /t 2 /nobreak >nul

:: Start Cloudflare tunnel
echo Starting Cloudflare tunnel...
start "Cloudflare Tunnel" cmd /k "cloudflared tunnel run paingauge"

echo.
echo ========================================
echo  All running!
echo  Local:  http://localhost:3001
echo  Public: https://vehicles.sidetalk.io
echo ========================================
echo.
echo You can close this window. The server
echo and tunnel run in their own windows.
echo.
pause
