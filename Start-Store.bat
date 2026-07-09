@echo off
title sho0ping store
cd /d "%~dp0"

where node >nul 2>nul
if errorlevel 1 (
  echo Node.js is not installed. Please install it from https://nodejs.org ^(LTS^) and run this again.
  pause
  exit /b 1
)

echo Stopping any old store server...
for /f "tokens=5" %%a in ('netstat -aon ^| findstr :3000 ^| findstr LISTENING') do taskkill /f /pid %%a >nul 2>nul

echo Checking dependencies (may take a few minutes on first run)...
call npm install --no-audit --no-fund

rem Verify the AI engine actually loads on THIS computer; if not, reinstall clean
node -e "require('sharp');require('onnxruntime-node');require('@xenova/transformers')" >nul 2>nul
if errorlevel 1 goto repair
goto ok

:repair
echo AI engine incomplete - doing a clean reinstall, please wait...
rmdir /s /q node_modules 2>nul
del /q package-lock.json 2>nul
call npm install --no-audit --no-fund
node -e "require('sharp');require('onnxruntime-node');require('@xenova/transformers')" >nul 2>nul
if errorlevel 1 (
  echo.
  echo Install failed. Check your internet connection and disk space, then run this again.
  echo If it keeps failing, take a photo of this window and show it to Claude.
  pause
  exit /b 1
)

:ok
if not exist data\db.json (
  echo Loading sample catalog...
  call node seed.js
)

echo ============================================
echo  On this computer:  http://localhost:3000
echo  On your MOBILE (same Wi-Fi) use one of these IPv4 addresses with :3000
ipconfig | findstr /i "IPv4"
echo  Example: http://192.168.1.5:3000
echo ============================================
echo Starting store at http://localhost:3000 ...
echo (First photo search downloads the built-in AI model ~120 MB, then it is cached.)
start "" http://localhost:3000
node server.js
pause
