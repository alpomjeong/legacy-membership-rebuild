@echo off
setlocal enabledelayedexpansion
chcp 65001 >nul
REM ============================================================
REM  불사 · 회원관리 - 네이티브 윈도우 실행 (Docker 불필요)
REM  전제: PostgreSQL 16 + Node 20 설치, backend/frontend 빌드 완료.
REM  설정: 같은 폴더의 .env (없으면 .env.example 복사해서 채우기)
REM ============================================================
cd /d "%~dp0..\.."
set "ROOT=%cd%"

REM --- .env 로드(주석/빈줄 제외) ---
if exist "%~dp0.env" (
  for /f "usebackq eol=# tokens=1,* delims==" %%a in ("%~dp0.env") do set "%%a=%%b"
) else (
  echo [경고] infra\native\.env 가 없습니다. .env.example 를 복사해 값을 채우세요.
)

REM --- 기본값(미설정 시) ---
if "%STORAGE_DIR%"=="" set "STORAGE_DIR=%ROOT%\data\uploads"
if "%BACKUP_DIR%"=="" set "BACKUP_DIR=%ROOT%\data\backups"
if "%STATIC_DIR%"=="" set "STATIC_DIR=%ROOT%\frontend\dist"
if "%BACKUP_PG_SCHEDULE%"=="" set "BACKUP_PG_SCHEDULE=true"
set "NODE_ENV=production"
set "PORT=%PORT%"
if "%PORT%"=="" set "PORT=8080"

echo ============================================
echo   불사 · 회원관리 (네이티브)
echo   DB : %DATABASE_URL%
echo   저장: %STORAGE_DIR%
echo   백업: %BACKUP_DIR%
echo   정적: %STATIC_DIR%   포트: %PORT%
echo ============================================

if not exist "%ROOT%\backend\dist\src\main.js" (
  echo [오류] backend 빌드가 없습니다.  cd backend ^&^& pnpm install ^&^& pnpm prisma generate ^&^& pnpm build
  if not "%TEMPLE_NOPAUSE%"=="1" pause
  exit /b 1
)

cd /d "%ROOT%\backend"
echo [1/3] DB 마이그레이션 적용...
call node_modules\.bin\prisma migrate deploy || (echo [오류] 마이그레이션 실패 & if not "%TEMPLE_NOPAUSE%"=="1" pause & exit /b 1)

echo [2/3] 시드(멱등)...
if /i not "%APP_SEED%"=="none" (
  call node_modules\.bin\ts-node -r tsconfig-paths/register prisma\seed.ts || echo   (seed 스킵/실패)
)

REM --- 참조데이터(불사목록 마스터 213 + 공통코드) 멱등 적재 — 매 기동 자동, 마스터 부재 방지 ---
REM 실패를 삼키지 않는다(과거 1>nul 2>nul 로 무음 실패 → 마스터 없이 운영되던 문제).
echo [2.5/3] 참조데이터(불사목록 마스터) 적재...
if "%PG_BIN%"=="" set "PG_BIN=C:\Program Files\PostgreSQL\16\bin"
set "REFSQL=%ROOT%\infra\native\reference-seed.sql"
REM 출력이 로그로 리다이렉트되면 psql 이 클라이언트 인코딩을 ANSI(UHC)로 잡아 한글이 깨진다 → 고정.
set "PGCLIENTENCODING=UTF8"
REM DATABASE_URL 의 ?schema=... 쿼리는 psql(libpq) 이 거부하므로 제거하고 접속 URI 로 사용
set "DBURL="
for /f "tokens=1 delims=?" %%u in ("%DATABASE_URL%") do set "DBURL=%%u"
if not exist "%PG_BIN%\psql.exe" (
  echo   [건너뜀] psql 없음: %PG_BIN%\psql.exe  ^(.env 의 PG_BIN 확인^)
) else if not exist "%REFSQL%" (
  echo   [건너뜀] 참조데이터 파일 없음: %REFSQL%
) else if "%DBURL%"=="" (
  echo   [건너뜀] DATABASE_URL 미설정 — infra\native\.env 확인
) else (
  "%PG_BIN%\psql.exe" -v ON_ERROR_STOP=1 -q -d "%DBURL%" -f "%REFSQL%" 1>nul
  if errorlevel 1 (echo   [경고] 참조데이터 적재 실패 — 위 psql 오류 확인) else (echo   참조데이터 OK)
)

REM --- 개인 시주 항목(비공개 별도 파일) — 있으면 이어서 적재 ---
REM 항목명에 시주자 실명이 들어 있어 공개 리포에는 넣지 않는다. 없어도 기동은 정상이며,
REM 그 항목을 참조하는 불사 건만 업로드에서 "불사목록 미등록" 으로 거부된다.
REM 중첩 블록은 cmd 가 오해할 수 있어 goto 로 분기한다.
set "REFSQLP=%ROOT%\infra\native\reference-seed-private.sql"
if exist "%REFSQLP%" goto :do_private
echo   [안내] 개인 시주 항목 파일 없음 - 별도 전달분입니다. 없으면 해당 불사 건은 업로드에서 반려됩니다.
goto :skip_private
:do_private
if not exist "%PG_BIN%\psql.exe" goto :skip_private
if "%DBURL%"=="" goto :skip_private
"%PG_BIN%\psql.exe" -v ON_ERROR_STOP=1 -q -d "%DBURL%" -f "%REFSQLP%" 1>nul
if errorlevel 1 (echo   [경고] 개인 시주 항목 적재 실패 — 위 psql 오류 확인) else (echo   개인 시주 항목 OK)
:skip_private

echo [3/3] 서버 기동...  http://localhost:%PORT%
node dist\src\main
endlocal
