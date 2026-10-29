@echo off
setlocal enabledelayedexpansion
chcp 65001 >nul
REM ============================================================
REM  백업 폴더 열기 — 백업 .dump 가 저장된 폴더를 탐색기로 연다.
REM  (웹은 브라우저 격리로 탐색기를 못 열어서, 서버 PC 에서 이 파일 더블클릭)
REM  BACKUP_DIR 을 infra\native\.env 에 지정했으면 그 경로, 아니면 기본(앱폴더\data\backups).
REM ============================================================
set "DIR="
set "ENVFILE=%~dp0..\native\.env"
if exist "%ENVFILE%" (
  for /f "usebackq eol=# tokens=1,* delims==" %%A in ("%ENVFILE%") do (
    if /i "%%A"=="BACKUP_DIR" set "DIR=%%B"
  )
)
if not defined DIR set "DIR=%~dp0..\..\data\backups"
REM 구버전(도커) 기본 위치에 기존 백업이 있으면 그쪽을 연다.
if not exist "%DIR%" if exist "%~dp0..\temple-backups" set "DIR=%~dp0..\temple-backups"

REM full 하위폴더(실제 .dump 위치)가 있으면 그쪽을, 없으면 상위를 연다.
if exist "%DIR%\full" (
  start "" explorer.exe "%DIR%\full"
) else if exist "%DIR%" (
  start "" explorer.exe "%DIR%"
) else (
  echo [안내] 아직 백업 폴더가 없습니다: %DIR%
  echo        웹 백업 관리에서 "지금 백업"을 한 번 실행하면 생성됩니다.
  pause
)
endlocal
