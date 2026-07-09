@echo off
title Download real product photos
cd /d "%~dp0"
where node >nul 2>nul || (echo Install Node.js from https://nodejs.org first & pause & exit /b 1)
echo Downloading a real photo for every product (needs internet)...
node fetch-images.js
pause
