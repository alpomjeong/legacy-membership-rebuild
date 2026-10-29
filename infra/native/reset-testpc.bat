@echo off
chcp 65001 >nul
title Temple Membership - Reset Test PC
echo ============================================================
echo   Temple Membership - Reset Test PC (uninstall everything)
echo   A UAC prompt will appear (needed to uninstall via winget).
echo ============================================================
echo.
powershell -NoProfile -ExecutionPolicy Bypass -File "%~dp0reset-testpc.ps1" %*
