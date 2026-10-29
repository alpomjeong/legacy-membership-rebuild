@echo off
setlocal enabledelayedexpansion
chcp 65001 >nul
REM ============================================================
REM  오프사이트 백업 복사 — 백업 폴더 → 지정 경로(USB/NAS/클라우드 동기폴더)
REM  사용법:  offsite-sync.bat "E:\temple-offsite"   (대상 경로를 인자로)
REM  원본: infra\native\.env 의 BACKUP_DIR, 미설정이면 앱폴더\data\backups.
REM  스케줄: 작업 스케줄러에 매일 1회 등록 권장(자동 백업 시각 이후).
REM  주: 삭제 미러가 아니라 '추가 복사(/E, 삭제 안 함)' — 로컬에서 정리돼도 오프사이트는 보존.
REM ============================================================
cd /d "%~dp0..\.."
set "BASE="
set "ENVFILE=%~dp0..\native\.env"
if exist "%ENVFILE%" (
  for /f "usebackq eol=# tokens=1,* delims==" %%A in ("%ENVFILE%") do (
    if /i "%%A"=="BACKUP_DIR" set "BASE=%%B"
  )
)
if not defined BASE set "BASE=%cd%\data\backups"
REM 구버전(도커) 기본 위치에 기존 백업이 있으면 그쪽을 사용.
if not exist "%BASE%\full" if exist "%cd%\infra\temple-backups\full" set "BASE=%cd%\infra\temple-backups"
set "SRC=%BASE%\full"
set "DEST=%~1"

if "%DEST%"=="" (
  echo [사용법] offsite-sync.bat "대상경로"
  echo   예: offsite-sync.bat "E:\temple-offsite"
  exit /b 1
)
if not exist "%SRC%" (
  echo [오류] 백업 폴더가 없습니다: %SRC%
  echo        먼저 백업을 한 번 실행하세요(웹 백업 관리 또는 자동 스케줄).
  exit /b 1
)

echo 원본: %SRC%
echo 대상: %DEST%
echo 복사 중... (*.dump)
robocopy "%SRC%" "%DEST%" *.dump /E /XO /R:2 /W:5 /NDL /NP
set "RC=%ERRORLEVEL%"

REM robocopy 종료코드: 0=변경없음, 1=복사됨, 2/3=추가/불일치 처리 — 8 이상이 실제 오류.
if %RC% GEQ 8 (
  echo [실패] robocopy 오류코드 %RC%
  exit /b %RC%
)
echo [완료] 오프사이트 복사 성공 (robocopy 코드 %RC%)
endlocal
