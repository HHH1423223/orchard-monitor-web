@echo off
chcp 65001 >nul 2>nul
title Orchard Monitor - Demo Server
cd /d "%~dp0"
echo Starting local demo server (no Node.js required)...
echo.
powershell -NoProfile -ExecutionPolicy Bypass -File "%~dp0serve.ps1" %*
echo.
pause
