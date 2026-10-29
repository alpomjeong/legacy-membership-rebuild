@echo off
chcp 65001 >nul
title Temple Membership - New PC One-Click Install
echo ============================================================
echo   Temple Membership - New PC One-Click Install
echo   (UAC prompts may appear while installing Git/Node/PostgreSQL)
echo ============================================================
echo.
powershell -NoProfile -ExecutionPolicy Bypass -File "%~dp0newpc-install.ps1" %*
