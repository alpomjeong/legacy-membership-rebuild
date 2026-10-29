@echo off
rem DB 백업 도구 실행기 (더블클릭)
start "" powershell -NoProfile -ExecutionPolicy Bypass -STA -WindowStyle Hidden -File "%~dp0temple-backup-tool.ps1"
