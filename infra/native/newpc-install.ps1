<#
  새 PC 원클릭 온프레 설치 — 회원관리 시스템
  ------------------------------------------------------------------
  백지 Windows PC 기준. 아래를 순서대로, 여러 번 실행해도 안전(멱등)하게 수행한다:
    1) 사전요건(Git · Node LTS · pnpm · PostgreSQL 16) 확인 → 없으면 winget 설치
    2) DB 계정/데이터베이스 생성(강한 비번 자동)
    3) 소스 최신화(git pull — 기본은 현재 브랜치 유지, -Branch 로만 전환)
    4) backend · frontend 빌드
    5) infra\native\.env 자동 생성(강한 시크릿 — CSPRNG)
    6) migrate deploy → seed(admin) → reference-seed.sql(불사목록 213) [+ -private.sql 있으면 24종 추가]
    7) 방화벽 허용 → 서버 기동 → 포트 열릴 때까지 대기 → 브라우저 열기

  실행: 같은 폴더의 "newpc-install.bat" 더블클릭(권장).
        winget 설치 시에만 UAC(관리자 동의) 창이 뜬다. DB 생성/빌드/시드는 일반 권한.
  검증 리허설(2026-08-13)로 2~7단계 전 구간 실측 완료.
#>
param(
  [string]$Branch = '',                              # 기본: 현재 체크아웃된 브랜치 유지(설치 스크립트 자기삭제 방지)
  [string]$DbName = 'temple',
  [string]$DbUser = 'temple',
  [string]$EnvPath,                                  # 기본 infra\native\.env
  [string]$PgBin = 'C:\Program Files\PostgreSQL\16\bin',
  [string]$PgSuperPassword,                          # 미지정 시: 이미 설치면 프롬프트 / 신규설치면 생성
  [int]$Port = 8080,
  [switch]$SkipPrereqs,                              # (테스트) 사전요건 winget 건너뜀
  [switch]$SkipGit,                                  # (테스트) git pull 건너뜀
  [switch]$SkipBuild,                                # (테스트) 빌드 건너뜀
  [switch]$NoStart                                   # (테스트) 서버 기동 안 함
)
# 네이티브 exe(prisma/psql/pnpm)가 stderr 로 뱉는 '경고'가 종료오류로 승격돼 중단되지 않도록 Continue.
# 실패 판정은 각 단계의 $LASTEXITCODE 확인 + Die 로 명시 처리한다.
$ErrorActionPreference = 'Continue'
function Say($m) { Write-Host "`n===== $m =====" -ForegroundColor Cyan }
function Warn($m) { Write-Host "  [!] $m" -ForegroundColor Yellow }
function Ok($m) { Write-Host "  [OK] $m" -ForegroundColor Green }
function Die($m) { Write-Host "`n[X] $m" -ForegroundColor Red; if (-not $env:ONECLICK_NOPAUSE) { Read-Host '엔터로 종료' }; exit 1 }

$Root = (Resolve-Path (Join-Path $PSScriptRoot '..\..')).Path
if (-not $EnvPath) { $EnvPath = Join-Path $PSScriptRoot '.env' }
$psql = Join-Path $PgBin 'psql.exe'
# 시크릿·비밀번호는 암호학적 난수(CSPRNG)로. Get-Random(System.Random)은 예측 가능해 금지 —
# 여기서 만든 값이 JWT 서명키와 주민번호 암호화 키(JUMIN_ENC_KEY)가 된다.
function New-RandomBytes([int]$n) {
  $b = New-Object byte[] $n
  $rng = [System.Security.Cryptography.RandomNumberGenerator]::Create()
  try { $rng.GetBytes($b) } finally { $rng.Dispose() }
  , $b
}
function New-Hex([int]$n) { (-join ((New-RandomBytes ([math]::Ceiling($n / 2))) | ForEach-Object { '{0:x2}' -f $_ })).Substring(0, $n) }   # ASCII 영숫자(URL 예약문자 없음)
function New-Secret { [Convert]::ToBase64String((New-RandomBytes 48)) }
function Have($cmd) { [bool](Get-Command $cmd -ErrorAction SilentlyContinue) }

Write-Host "회원관리 — 새 PC 원클릭 설치" -ForegroundColor White
Write-Host "  리포지토리: $Root"
Write-Host ("  DB: $DbName / 계정: $DbUser / 포트: $Port / 브랜치: " + $(if ($Branch) { $Branch } else { '(현재 브랜치 유지)' }))

# ------------------------------------------------------------------
# 1) 사전요건
# ------------------------------------------------------------------
if (-not $SkipPrereqs) {
  Say '1/7 사전요건 확인·설치 (winget — 필요 시 UAC 동의창)'
  if (-not (Have 'winget')) { Die 'winget(App Installer)이 없습니다. Microsoft Store에서 "앱 설치 관리자"를 설치 후 다시 실행하세요.' }

  # 설치 결과를 반드시 확인한다. 예전엔 winget 출력을 Out-Null 로 버리고 성공 여부도 안 봐서,
  # PostgreSQL 설치가 실패해도 그대로 2/7 로 넘어가 "psql 을 찾을 수 없습니다" 로만 죽었다.
  if (-not (Have 'git')) {
    Warn 'Git 설치 중...'
    winget install -e --id Git.Git --accept-package-agreements --accept-source-agreements --silent
    $env:Path += ';C:\Program Files\Git\cmd'
    if (Have 'git') { Ok 'Git 설치됨' } else { Warn 'Git 설치 실패 — 소스 최신화(3/7)는 건너뛰고 진행합니다.' }
  } else { Ok 'Git' }

  $nodeOk = (Have 'node') -and ((& node -v) -match '^v(20|22|24|26)\.')
  if (-not $nodeOk) {
    Warn 'Node LTS 설치 중...'
    winget install -e --id OpenJS.NodeJS.LTS --accept-package-agreements --accept-source-agreements --silent
    $env:Path += ';C:\Program Files\nodejs'
    if (Have 'node') { Ok ('Node 설치됨 ' + (& node -v)) }
    else { Die 'Node 설치 실패. 위 winget 메시지를 확인하거나 https://nodejs.org 에서 LTS 를 직접 설치한 뒤 다시 실행하세요.' }
  } else { Ok ("Node " + (& node -v)) }

  if (-not (Have 'pnpm')) {
    Warn 'pnpm 설치 중...'
    & npm i -g pnpm@10.34.3
    $env:Path += ";$env:APPDATA\npm"
    if (Have 'pnpm') { Ok 'pnpm 설치됨' } else { Die 'pnpm 설치 실패. 관리자 PowerShell 에서 npm i -g pnpm@10.34.3 을 직접 실행한 뒤 다시 시도하세요.' }
  } else { Ok 'pnpm' }

  $pgSvc = Get-Service -Name 'postgresql-x64-16' -ErrorAction SilentlyContinue
  if (-not (Test-Path $psql) -and -not $pgSvc) {
    # 이전 설치의 잔재가 있으면 EDB 설치 프로그램이 조용히 실패한다 — 먼저 짚어준다.
    $leftovers = @()
    if (Test-Path 'C:\Program Files\PostgreSQL') { $leftovers += 'C:\Program Files\PostgreSQL (폴더 잔존)' }
    if (Get-LocalUser -Name 'postgres' -ErrorAction SilentlyContinue) { $leftovers += "윈도우 로컬 계정 'postgres' 잔존" }
    if ($leftovers.Count -gt 0) {
      Warn '이전 PostgreSQL 설치 잔재가 있습니다 — 설치가 실패하면 이것부터 정리하세요:'
      $leftovers | ForEach-Object { Warn "    · $_" }
    }
    if (-not $PgSuperPassword) { $PgSuperPassword = New-Hex 12 }   # 신규설치: 슈퍼유저 비번 자동생성(영숫자)
    Warn 'PostgreSQL 16 설치 중... (수 분 소요, 화면이 멈춘 듯 보여도 정상)'
    # --override 안의 값을 따옴표로 감싸지 않는다 — 중첩 따옴표가 EDB 인자 파싱을 깨뜨린다.
    # New-Hex 값은 영숫자뿐이라 공백/특수문자가 없어 감쌀 필요도 없다.
    winget install -e --id PostgreSQL.PostgreSQL.16 --accept-package-agreements --accept-source-agreements `
      --override "--mode unattended --unattendedmodeui none --superpassword $PgSuperPassword --serverport 5432 --disable-components stackbuilder"
    if (-not (Test-Path $psql)) {
      Warn 'winget 설치가 실패했습니다. 아래 중 하나로 해결한 뒤 다시 실행하세요:'
      Warn '  (1) 이전 설치 잔재 정리 — 관리자 PowerShell:'
      Warn '        sc.exe delete postgresql-x64-16'
      Warn '        takeown /F "C:\Program Files\PostgreSQL" /R /D Y'
      Warn '        icacls "C:\Program Files\PostgreSQL" /grant *S-1-5-32-544:(F) /T /C'
      Warn '        Remove-Item -Recurse -Force "C:\Program Files\PostgreSQL"'
      Warn '        Remove-LocalUser -Name postgres      # 있을 때만'
      Warn '      정리 후 재부팅하고 이 설치를 다시 실행'
      Warn '  (2) 수동 설치 — https://www.postgresql.org/download/windows/ 에서 16.x 설치'
      Warn '      설치 중 정한 비밀번호를 기억할 것. 그다음 이 스크립트를 다시 실행하면 그 비번을 물어봅니다.'
      Die "PostgreSQL 16 설치 실패 — psql 이 없습니다: $psql"
    }
    $pwFile = Join-Path $PSScriptRoot 'postgres-슈퍼유저-비번.txt'
    "postgres 슈퍼유저 비밀번호(이 파일 안전 보관, 커밋 금지):`r`n$PgSuperPassword" | Out-File -Encoding utf8 $pwFile
    Ok 'PostgreSQL 16 설치됨'
    Warn "postgres 슈퍼유저 비번을 $pwFile 에 저장했습니다. 안전 보관 후 삭제하세요."
  } else { Ok 'PostgreSQL 16' }
  if (-not (Have 'git') -and (Test-Path 'C:\Program Files\Git\cmd\git.exe')) { $env:Path += ';C:\Program Files\Git\cmd' }
}

# ------------------------------------------------------------------
# 2) DB 계정 / 데이터베이스
# ------------------------------------------------------------------
Say '2/7 DB 계정·데이터베이스 생성 (멱등)'
if (-not (Test-Path $psql)) { Die "psql 을 찾을 수 없습니다: $psql  (PostgreSQL 16 설치/경로 확인)" }
if (-not $PgSuperPassword) { $PgSuperPassword = Read-Host 'PostgreSQL 슈퍼유저(postgres) 비밀번호 입력' }
$env:PGPASSWORD = $PgSuperPassword
& $psql -U postgres -h localhost -d postgres -tAc 'SELECT 1' | Out-Null
if ($LASTEXITCODE -ne 0) { Die 'postgres 접속 실패 — 슈퍼유저 비밀번호를 확인하세요.' }

# temple DB 비번: .env 있으면 재사용, 없으면 강한 hex 생성 → 롤 비번을 항상 이 값으로 동기화
$dbPw = $null
if (Test-Path $EnvPath) {
  $line = (Get-Content $EnvPath | Where-Object { $_ -match '^\s*DATABASE_URL=' } | Select-Object -First 1)
  if ($line -match '://[^:]+:([^@]+)@') { $dbPw = $Matches[1] }
}
if (-not $dbPw) { $dbPw = New-Hex 32 }

$roleExists = (& $psql -U postgres -h localhost -tAc "SELECT 1 FROM pg_roles WHERE rolname='$DbUser'")
if ($roleExists -eq '1') { & $psql -U postgres -h localhost -c "ALTER ROLE $DbUser LOGIN PASSWORD '$dbPw';" | Out-Null; Ok "롤 $DbUser (비번 동기화)" }
else { & $psql -U postgres -h localhost -c "CREATE ROLE $DbUser LOGIN PASSWORD '$dbPw';" | Out-Null; Ok "롤 $DbUser 생성" }
$dbExists = (& $psql -U postgres -h localhost -tAc "SELECT 1 FROM pg_database WHERE datname='$DbName'")
if ($dbExists -eq '1') { Ok "DB $DbName (이미 존재)" }
else { & $psql -U postgres -h localhost -c "CREATE DATABASE $DbName OWNER $DbUser;" | Out-Null; Ok "DB $DbName 생성" }

# ------------------------------------------------------------------
# 3) 소스 최신화
# ------------------------------------------------------------------
if (-not $SkipGit) {
  Say '3/7 소스 최신화 (git pull)'
  if (-not (Test-Path (Join-Path $Root '.git'))) { Warn '.git 없음 — 이미 받은 소스로 진행' }
  elseif (-not (Have 'git')) { Warn 'git 을 찾을 수 없음 — 소스 최신화 건너뜀(이미 받은 소스로 진행)' }
  else {
    # -Branch 미지정이면 현재 브랜치를 유지한다. 예전엔 무조건 dev 로 checkout 했는데,
    # 그러면 dev 에 없는 파일(이 설치 스크립트 자신 포함)이 워킹트리에서 사라진다.
    $cur = (& git -C $Root rev-parse --abbrev-ref HEAD 2>$null)
    if ($LASTEXITCODE -ne 0 -or -not $cur) { $cur = '' } else { $cur = $cur.Trim() }
    $target = if ($Branch) { $Branch } else { $cur }
    if (-not $target) { Warn '현재 브랜치를 판별할 수 없음 — 최신화 건너뜀' }
    else {
      & git -C $Root fetch origin --quiet
      if ($LASTEXITCODE -ne 0) { Warn 'git fetch 실패(네트워크?) — 이미 받은 소스로 계속' }
      else {
        if ($target -ne $cur) {
          & git -C $Root checkout $target
          if ($LASTEXITCODE -ne 0) { Warn "checkout $target 실패 — 현재 브랜치($cur)로 계속"; $target = $cur }
        }
        & git -C $Root pull --ff-only origin $target
        if ($LASTEXITCODE -ne 0) { Warn "git pull 실패 — 이미 받은 소스로 계속 ($target)" }
        else { Ok "소스 최신화 ($target)" }
      }
    }
  }
}

# ------------------------------------------------------------------
# 4) 빌드
# ------------------------------------------------------------------
if (-not $SkipBuild) {
  Say '4/7 빌드 (backend + frontend)'
  Push-Location (Join-Path $Root 'backend')
  & pnpm install --strict-peer-dependencies=false
  & pnpm prisma generate
  & pnpm build
  if (-not (Test-Path 'dist\src\main.js')) { Pop-Location; Die 'backend 빌드 실패' }
  Pop-Location
  Push-Location (Join-Path $Root 'frontend')
  & pnpm install
  & pnpm build
  if (-not (Test-Path 'dist\index.html')) { Pop-Location; Die 'frontend 빌드 실패' }
  Pop-Location
  Ok '빌드 완료'
}

# ------------------------------------------------------------------
# 5) .env (없을 때만 생성 — 강한 시크릿)
# ------------------------------------------------------------------
Say '5/7 설정 파일(.env)'
if (Test-Path $EnvPath) {
  Ok ".env 이미 있음 — 유지(덮어쓰지 않음): $EnvPath"
} else {
  $envText = @"
# 자동 생성됨 — 커밋 금지. 값에 따옴표 붙이지 말 것.
DATABASE_URL=postgresql://$DbUser`:$dbPw@localhost:5432/$DbName`?schema=public
APP_ENV=production
JWT_ACCESS_SECRET=$(New-Secret)
JWT_REFRESH_SECRET=$(New-Secret)
JUMIN_ENC_KEY=$(New-Secret)
PORT=$Port
BACKUP_PG_SCHEDULE=true
PG_BIN=$PgBin
"@
  # BOM 없는 UTF-8 (start.bat 의 for/f 파싱이 BOM 에 깨지지 않도록)
  [System.IO.File]::WriteAllText($EnvPath, $envText, (New-Object System.Text.UTF8Encoding($false)))
  Ok ".env 생성: $EnvPath"
}

# .env 를 현재 세션에 로드(migrate/seed 가 DATABASE_URL 등을 읽도록)
# 값이 빈 키(.env.example 을 그대로 복사한 경우)는 Set-Item 이 예외를 내므로 건너뛴다.
Get-Content $EnvPath | Where-Object { $_ -match '^\s*[A-Za-z_][A-Za-z0-9_]*\s*=' } | ForEach-Object {
  $kv = $_ -split '=', 2
  $key = $kv[0].Trim(); $val = $kv[1].Trim()
  if ($val) { Set-Item -Path ("env:" + $key) -Value $val }
  else { Warn "$key 값이 비어 있습니다 — infra\native\.env 확인" }
}
$env:NODE_ENV = 'production'

# ------------------------------------------------------------------
# 6) 마이그레이션 · 시드 · 참조데이터
# ------------------------------------------------------------------
Say '6/7 마이그레이션 · 시드(admin) · 참조데이터(불사목록 213)'
Push-Location (Join-Path $Root 'backend')
& node '.\node_modules\prisma\build\index.js' migrate deploy
if ($LASTEXITCODE -ne 0) { Pop-Location; Die '마이그레이션 실패' }
& node '.\node_modules\ts-node\dist\bin.js' -r tsconfig-paths/register 'prisma\seed.ts'
if ($LASTEXITCODE -ne 0) { Warn 'seed 경고/실패 — 이미 시드됨일 수 있음(멱등). 계속.' }
Pop-Location
$env:PGPASSWORD = $dbPw
# psql 이 콘솔/ANSI 코드페이지(한국어 윈도우 = UHC)로 클라이언트 인코딩을 잡으면 UTF-8 한글이 깨진다.
$env:PGCLIENTENCODING = 'UTF8'
& $psql -v ON_ERROR_STOP=1 -U $DbUser -h localhost -d $DbName -f (Join-Path $Root 'infra\native\reference-seed.sql')
if ($LASTEXITCODE -ne 0) { Die 'reference-seed.sql 실패' }
# 개인 시주 항목 — 항목명에 시주자 실명이 들어 있어 공개 리포에 없다(별도 전달). 있으면 이어서 적재.
$privSql = Join-Path $Root 'infra\native\reference-seed-private.sql'
if (Test-Path $privSql) {
  & $psql -v ON_ERROR_STOP=1 -U $DbUser -h localhost -d $DbName -f $privSql
  if ($LASTEXITCODE -ne 0) { Die 'reference-seed-private.sql 실패' }
} else {
  Warn 'reference-seed-private.sql 없음 — 개인 시주 항목(마니차 등)을 참조하는 불사 건은 업로드에서 "불사목록 미등록" 으로 거부된다. 파일을 받아 infra\native\ 에 두고 다시 실행하면 채워진다.'
}
$cnt = (& $psql -U $DbUser -h localhost -d $DbName -tAc 'SELECT count(*) FROM buddhist_service_item')
Ok "불사목록 마스터: $cnt 종"

# ------------------------------------------------------------------
# 7) 기동
# ------------------------------------------------------------------
Say '7/7 서버 기동'
# 같은 와이파이의 폰/PC 에서 붙으려면 인바운드 허용이 필요(관리자 권한이면 자동, 아니면 안내만).
$fwName = "Temple Membership $Port"
if (-not (Get-NetFirewallRule -DisplayName $fwName -ErrorAction SilentlyContinue)) {
  try {
    New-NetFirewallRule -DisplayName $fwName -Direction Inbound -Action Allow `
      -Protocol TCP -LocalPort $Port -Profile Private, Domain -ErrorAction Stop | Out-Null
    Ok "방화벽 인바운드 허용: TCP $Port (사설/도메인 네트워크)"
  } catch {
    Warn "방화벽 규칙 자동 등록 실패(관리자 권한 필요). 폰에서 붙이려면 관리자 PowerShell 에서:"
    Warn "  New-NetFirewallRule -DisplayName '$fwName' -Direction Inbound -Action Allow -Protocol TCP -LocalPort $Port -Profile Private,Domain"
  }
} else { Ok "방화벽 인바운드 허용(이미 등록): TCP $Port" }

if ($NoStart) {
  Ok "기동 생략(-NoStart). 수동 기동: infra\native\서버관리.bat"
} else {
  # 서버관리 GUI(temple-control.ps1)를 -AutoStart 로 직접 기동 → 서버 시작 + 관리창.
  # 한글명 .bat/.vbs 를 cmd 로 거치지 않아(파일명 인코딩 깨짐 회피) 로케일 무관하게 뜬다.
  $ctl = Join-Path $PSScriptRoot 'temple-control.ps1'
  # -ArgumentList 를 배열로 주면 PS 5.1 이 공백 있는 경로를 인용하지 않아 조용히 실패한다
  # (예: C:\Users\홍 길동\...). 반드시 직접 인용한 단일 문자열로 넘긴다.
  Start-Process powershell.exe -WindowStyle Hidden `
    -ArgumentList "-NoProfile -ExecutionPolicy Bypass -STA -WindowStyle Hidden -File `"$ctl`" -AutoStart"

  # 첫 기동은 마이그레이션·시드로 20~30초 걸린다. 포트가 열린 뒤에 브라우저를 연다
  # (바로 열면 정상 설치인데도 '연결 거부' 화면부터 보게 됨).
  Write-Host "  서버 기동 대기 중(최대 120초, 첫 기동은 마이그레이션·시드로 20~30초)..." -NoNewline
  $up = $false
  for ($i = 0; $i -lt 120; $i++) {
    Start-Sleep -Seconds 1
    $listeners = [System.Net.NetworkInformation.IPGlobalProperties]::GetIPGlobalProperties().GetActiveTcpListeners()
    if ($listeners | Where-Object { $_.Port -eq $Port }) { $up = $true; break }
    if ($i % 5 -eq 4) { Write-Host '.' -NoNewline }
  }
  Write-Host ''
  if ($up) {
    Start-Process "http://localhost:$Port"
    Ok "기동 완료 — http://localhost:$Port"
  } else {
    Warn "120초 안에 포트 $Port 가 열리지 않았습니다. 로그 확인: $Root\data\server.log (및 server.err.log)"
    Warn '수동 기동/상태확인: infra\native\서버관리.bat'
  }
}

Write-Host "`n============================================================" -ForegroundColor Green
Write-Host " 완료! 로그인: admin / admin1234  (최초 로그인 시 비밀번호 변경 강제)" -ForegroundColor Green
Write-Host " 다음: 일괄 업로드 → 불사 건 업로드 로 레거시 엑셀 적재" -ForegroundColor Green
Write-Host " 상시가동/백업: infra\native\네이티브-설치-가이드.md §5~6" -ForegroundColor Green
Write-Host "============================================================" -ForegroundColor Green
if (-not $env:ONECLICK_NOPAUSE) { Read-Host '엔터로 종료' }
