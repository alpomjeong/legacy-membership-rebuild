<#
  테스트 PC 초기화 — 회원관리 시스템
  ------------------------------------------------------------------
  newpc-install.ps1 이 만든 것을 전부 되돌려 "설치 전" 상태로 만든다.
  원클릭 설치를 처음부터 다시 검증할 때 쓴다.

  -Level 로 초기화 수준을 **반드시 명시**한다(기본값 없음 — 가장 파괴적인 동작이
  "옵션 없음"이 되면 안 되므로. 그냥 실행하면 사용법을 찍고 멈춘다).

    -Level repo   리포 산출물만: .env · node_modules · dist · data\
                  DB·PostgreSQL·Node·Git 전부 유지. 빌드만 다시 하고 싶을 때.
    -Level db     위 + <DB>/<롤> 삭제 (PostgreSQL 프로그램은 유지)
                  설치 2~7단계 재테스트. 가장 흔한 선택.
    -Level all    위 + winget 설치물 전부 제거
                  pnpm · Node LTS · Git · PostgreSQL 16 + 데이터 디렉터리까지.
                  설치 1단계(사전요건 자동설치)까지 재테스트. DB 가 통째로 사라진다.

  공통으로 지우는 것: 실행 중 프로세스 · 부팅 자동시작(HKCU Run) · 방화벽 규칙 · 예약 백업 작업.
  안 지우는 것: 리포 폴더 자체, .git, 소스. 그래서 초기화 후 같은 폴더에서
                newpc-install.bat 을 바로 다시 돌릴 수 있다.

  대상 DB 는 같은 폴더 .env 의 DATABASE_URL 을 따라간다(-DbName 으로 덮어쓰기 가능).
  격리 설치(temple_test 등)를 초기화할 때 실 DB 를 지우는 사고를 막기 위함.

  실행: 같은 폴더의 "reset-testpc.bat" 더블클릭(권장 — 관리자 권한으로 자동 재실행).
        winget 제거·방화벽·서비스 중지는 관리자 권한이 필요하다.

  예시:
    .\reset-testpc.ps1 -Level all -DryRun   # 뭘 지울지 먼저 확인(아무것도 안 지움)
    .\reset-testpc.ps1 -Level all           # 전부 삭제(확인 프롬프트: RESET 입력)
    .\reset-testpc.ps1 -Level db            # PG 는 두고 DB/롤만
    .\reset-testpc.ps1 -Level repo          # 빌드 산출물만
    .\reset-testpc.ps1 -Level db -Yes       # 무인(확인 프롬프트 없음)
#>
param(
  # 초기화 수준 — 반드시 하나를 명시한다(기본값 없음. 가장 파괴적인 동작이 "옵션 없음"이면 안 되므로).
  #   repo : 리포 산출물만 (.env·node_modules·dist·data) — DB·PostgreSQL·Node·Git 전부 유지
  #   db   : repo + temple DB/롤 삭제                    — PostgreSQL 프로그램은 유지
  #   all  : db + winget 설치물 전부 제거(pnpm·Node·Git·PostgreSQL 16 + 데이터 디렉터리)
  [ValidateSet('repo', 'db', 'all')]
  [string]$Level,
  [switch]$KeepPostgres,          # (구버전 호환) = -Level db
  [switch]$KeepNode,              # (구버전 호환) -KeepPostgres 와 같이 쓰면 = -Level repo
  [string]$PgSuperPassword,       # -Level db 일 때 postgres 비번(미지정 시 프롬프트)
  [string]$PgBin = 'C:\Program Files\PostgreSQL\16\bin',
  [string]$DbName,                # 미지정 시 같은 폴더 .env 의 DATABASE_URL 에서 읽음(없으면 temple)
  [string]$DbUser,
  [int]$Port = 8080,
  [switch]$Yes,                   # 확인 프롬프트 생략
  [switch]$DryRun,                # 실제로 지우지 않고 대상만 출력
  [switch]$NoElevate              # 관리자 권한 자동 재실행 안 함(내부용)
)
$ErrorActionPreference = 'Continue'

function Say($m) { Write-Host "`n===== $m =====" -ForegroundColor Cyan }
function Ok($m) { Write-Host "  [OK] $m" -ForegroundColor Green }
function Warn($m) { Write-Host "  [!] $m" -ForegroundColor Yellow }
function Info($m) { Write-Host "  $m" -ForegroundColor Gray }
function Skip($m) { Write-Host "  [유지] $m" -ForegroundColor DarkGray }

$Root = (Resolve-Path (Join-Path $PSScriptRoot '..\..')).Path
$IsAdmin = ([Security.Principal.WindowsPrincipal][Security.Principal.WindowsIdentity]::GetCurrent()
).IsInRole([Security.Principal.WindowsBuiltInRole]::Administrator)

# ------------------------------------------------------------------
# 초기화 수준 결정 — 미지정이면 사용법을 찍고 멈춘다(실수로 PostgreSQL 을 날리지 않게).
# ------------------------------------------------------------------
if (-not $Level) {
  if ($KeepPostgres -and $KeepNode) { $Level = 'repo' }
  elseif ($KeepPostgres) { $Level = 'db' }
  elseif ($KeepNode) { $Level = 'db' }
  else {
    Write-Host ''
    Write-Host '  초기화 수준을 지정해야 합니다. -Level 로 하나를 고르세요:' -ForegroundColor Yellow
    Write-Host ''
    Write-Host '   -Level repo   리포 산출물만 (.env · node_modules · dist · data)' -ForegroundColor White
    Write-Host '                 DB·PostgreSQL·Node·Git 전부 유지. 빌드만 다시 하고 싶을 때.'
    Write-Host ''
    Write-Host '   -Level db     위 + temple DB/롤 삭제 (PostgreSQL 프로그램은 유지)' -ForegroundColor White
    Write-Host '                 설치 2~7단계 재테스트. 가장 흔한 선택. postgres 비번을 물어봅니다.'
    Write-Host ''
    Write-Host '   -Level all    위 + winget 설치물 전부 제거' -ForegroundColor Red
    Write-Host '                 pnpm · Node LTS · Git · PostgreSQL 16 + 데이터 디렉터리까지.' -ForegroundColor Red
    Write-Host '                 설치 1단계(사전요건 자동설치)까지 재테스트. DB 가 통째로 사라집니다.' -ForegroundColor Red
    Write-Host ''
    Write-Host '  예:  reset-testpc.bat -Level all -DryRun     ← 먼저 뭘 지울지 확인' -ForegroundColor Gray
    Write-Host '       reset-testpc.bat -Level all             ← 실제 실행' -ForegroundColor Gray
    Write-Host ''
    if (-not $env:ONECLICK_NOPAUSE) { Read-Host '엔터로 종료' }
    exit 1
  }
}
$RemovePrereqs = ($Level -eq 'all') -and -not $KeepNode   # pnpm·Node·Git 제거
$RemovePg = ($Level -eq 'all') -and -not $KeepPostgres    # PostgreSQL 프로그램 제거
$DropDb = ($Level -eq 'db') -or ($KeepPostgres -and $Level -ne 'repo')   # DB/롤만 삭제

# DB 이름은 같은 폴더 .env 를 따라간다 — 격리 설치(temple_test 등)를 초기화할 때
# 기본값 'temple'(실 DB)을 지우는 사고를 막는다.
if (-not $DbName -or -not $DbUser) {
  $envFile = Join-Path $PSScriptRoot '.env'
  if (Test-Path $envFile) {
    $urlLine = (Get-Content $envFile | Where-Object { $_ -match '^\s*DATABASE_URL=' } | Select-Object -First 1)
    if ($urlLine -match '://([^:]+):[^@]+@[^/]+/([^?\s]+)') {
      if (-not $DbUser) { $DbUser = $Matches[1] }
      if (-not $DbName) { $DbName = $Matches[2] }
    }
  }
}
if (-not $DbName) { $DbName = 'temple' }
if (-not $DbUser) { $DbUser = 'temple' }

# ------------------------------------------------------------------
# 관리자 권한 — winget 제거·서비스 중지·방화벽에 필요. 없으면 UAC 로 재실행.
# ------------------------------------------------------------------
$needsAdmin = $RemovePrereqs -or $RemovePg
if ($needsAdmin -and -not $IsAdmin -and -not $NoElevate -and -not $DryRun) {
  Warn 'winget 제거에는 관리자 권한이 필요합니다 — UAC 동의창을 띄워 다시 실행합니다.'
  $argLine = "-NoProfile -ExecutionPolicy Bypass -File `"$PSCommandPath`" -NoElevate -Level $Level"
  $argLine += " -DbName `"$DbName`" -DbUser `"$DbUser`" -Port $Port"
  if ($Yes) { $argLine += ' -Yes' }
  if ($PgSuperPassword) { $argLine += " -PgSuperPassword `"$PgSuperPassword`"" }
  try { Start-Process powershell.exe -Verb RunAs -ArgumentList $argLine; exit 0 }
  catch { Warn '권한 상승 취소됨 — 일반 권한으로 계속합니다(일부 항목은 실패).' }
}

# ------------------------------------------------------------------
# 강제 삭제 헬퍼 — PostgreSQL 데이터 디렉터리 전용.
#   그냥 Remove-Item 으로는 안 지워진다. 두 가지 이유:
#     · 데이터 디렉터리는 서비스 계정 소유 + Administrators 에게 삭제권이 없는 ACL
#     · 서비스를 멈춰도 postgres.exe 자식이 남아 파일을 잡고 있음
#   그래서 프로세스 정리 → takeown/icacls 로 소유권·권한 확보 → 재시도 순으로 처리한다.
#   icacls 대상은 이름('Administrators')이 아니라 SID(S-1-5-32-544)로 준다 —
#   한국어 윈도우 등 로케일에 따라 그룹 이름이 달라도 동작하게.
# ------------------------------------------------------------------
function Remove-TreeHard($path, $label) {
  if (-not $path -or -not (Test-Path -LiteralPath $path)) { return $true }
  if ($DryRun) { Info "[삭제예정] $label — $path"; return $true }
  for ($attempt = 1; $attempt -le 3; $attempt++) {
    Get-Process postgres -EA SilentlyContinue | Stop-Process -Force -EA SilentlyContinue
    Remove-Item -LiteralPath $path -Recurse -Force -EA SilentlyContinue
    if (-not (Test-Path -LiteralPath $path)) { Ok "$label 삭제"; return $true }
    if ($attempt -eq 1) { Info "$label — 권한/잠금으로 실패, 소유권 확보 후 재시도..." }
    & takeown.exe /F "$path" /R /D Y 2>&1 | Out-Null
    & icacls.exe "$path" /grant "*S-1-5-32-544:(F)" /T /C 2>&1 | Out-Null
    Start-Sleep -Milliseconds 800
  }
  Warn "$label 삭제 실패: $path"
  Warn '  재부팅 후 관리자 PowerShell 에서 아래를 실행하세요:'
  Warn "    takeown /F `"$path`" /R /D Y"
  Warn "    icacls `"$path`" /grant *S-1-5-32-544:(F) /T /C"
  Warn "    Remove-Item -Recurse -Force `"$path`""
  return $false
}

# ------------------------------------------------------------------
# 삭제 헬퍼 — DryRun 이면 지우지 않고 대상만 찍는다.
# ------------------------------------------------------------------
function Kill-Path($path, $label) {
  if (-not (Test-Path -LiteralPath $path)) { return }
  $size = ''
  try {
    $bytes = (Get-ChildItem -LiteralPath $path -Recurse -Force -File -EA SilentlyContinue |
      Measure-Object Length -Sum).Sum
    if ($bytes) { $size = ' (' + [math]::Round($bytes / 1MB, 1) + ' MB)' }
  } catch { }
  if ($DryRun) { Info "[삭제예정] $label$size — $path"; return }
  Remove-Item -LiteralPath $path -Recurse -Force -EA SilentlyContinue
  if (Test-Path -LiteralPath $path) { Warn "$label 삭제 실패(사용 중?): $path" }
  else { Ok "$label 삭제$size" }
}

Write-Host "회원관리 — 테스트 PC 초기화" -ForegroundColor White
Write-Host "  리포: $Root"
Write-Host "  수준: -Level $Level" -ForegroundColor $(if ($Level -eq 'all') { 'Red' } else { 'White' })
Write-Host ("  관리자 권한: " + $(if ($IsAdmin) { '예' } else { '아니오' }))
Write-Host ("  모드: " + $(if ($DryRun) { '드라이런(아무것도 지우지 않음)' } else { '실제 삭제' })) -ForegroundColor $(if ($DryRun) { 'Yellow' } else { 'Red' })
Write-Host ''
Write-Host '  지울 것:' -ForegroundColor White
Write-Host '   · 서버/관리GUI 프로세스, 부팅 자동시작, 방화벽 규칙, 예약 백업 작업'
Write-Host '   · .env / node_modules / dist / data (업로드 이미지·백업 포함)'
if ($DropDb) { Write-Host "   · $DbName 데이터베이스 + $DbUser 롤 (PostgreSQL 프로그램은 유지)" -ForegroundColor Yellow }
if ($RemovePg) { Write-Host "   · PostgreSQL 16 프로그램 + 데이터 디렉터리 전체 ($DbName DB 도 통째로 사라짐)" -ForegroundColor Red }
if ($RemovePrereqs) { Write-Host '   · pnpm(전역), Node LTS, Git' -ForegroundColor Red }
Write-Host '  남기는 것:' -ForegroundColor DarkGray
Write-Host '   · 리포 폴더와 .git, 소스 코드' -ForegroundColor DarkGray
if (-not $DropDb -and -not $RemovePg) { Write-Host "   · $DbName 데이터베이스(그대로 둠)" -ForegroundColor DarkGray }
if (-not $RemovePg) { Write-Host '   · PostgreSQL 16' -ForegroundColor DarkGray }
if (-not $RemovePrereqs) { Write-Host '   · Node · pnpm · Git' -ForegroundColor DarkGray }

if (-not $Yes -and -not $DryRun) {
  Write-Host ''
  $answer = Read-Host '되돌릴 수 없습니다. 진행하려면 RESET 을 입력하세요'
  if ($answer -ne 'RESET') { Write-Host '취소했습니다.' -ForegroundColor Yellow; exit 0 }
}

# ------------------------------------------------------------------
# 0) 덤프 백업 — 실수로 실데이터 백업을 날리지 않도록 먼저 대피
# ------------------------------------------------------------------
Say '0/6 백업 덤프 대피'
$dumpDirs = @((Join-Path $Root 'data\backups'), (Join-Path $Root 'infra\temple-backups'))
$dumps = @($dumpDirs | Where-Object { Test-Path $_ } |
  ForEach-Object { Get-ChildItem $_ -Recurse -Filter *.dump -File -EA SilentlyContinue })
if ($dumps.Count -eq 0) { Info '옮길 .dump 없음' }
else {
  $safe = Join-Path ([Environment]::GetFolderPath('Desktop')) ('temple-dumps-' + (Get-Date -Format 'yyyyMMdd-HHmmss'))
  if ($DryRun) { Info "[대피예정] .dump $($dumps.Count)개 → $safe" }
  else {
    New-Item -ItemType Directory -Force $safe | Out-Null
    $dumps | ForEach-Object { Copy-Item $_.FullName $safe -Force -EA SilentlyContinue }
    Ok ".dump $($dumps.Count)개를 바탕화면으로 대피: $safe"
  }
}

# ------------------------------------------------------------------
# 1) 프로세스 종료
# ------------------------------------------------------------------
Say '1/6 서버·관리 GUI 프로세스 종료'
# 이 스크립트 자신(과 부모)은 죽이지 않는다 — CommandLine 에 리포 경로가 들어 있어 걸린다.
$selfIds = @($PID)
try { $selfIds += (Get-CimInstance Win32_Process -Filter "ProcessId=$PID").ParentProcessId } catch { }
$victims = @()
try {
  $victims += Get-NetTCPConnection -LocalPort $Port -State Listen -EA SilentlyContinue |
    Select-Object -ExpandProperty OwningProcess -Unique
} catch { }
try {
  $victims += (Get-CimInstance Win32_Process -EA SilentlyContinue | Where-Object {
      $_.CommandLine -and $_.CommandLine -like "*$Root*" -and $_.CommandLine -notlike '*reset-testpc*'
    }).ProcessId
} catch { }
$victims = @($victims | Where-Object { $_ -and ($selfIds -notcontains $_) } | Select-Object -Unique)
if ($victims.Count -eq 0) { Info '실행 중인 프로세스 없음' }
elseif ($DryRun) { Info "[종료예정] PID $($victims -join ', ')" }
else {
  foreach ($procId in $victims) {
    $nm = (Get-Process -Id $procId -EA SilentlyContinue).ProcessName
    Stop-Process -Id $procId -Force -EA SilentlyContinue
    if ($nm) { Ok "종료: $nm (PID $procId)" }
  }
}

# ------------------------------------------------------------------
# 2) 자동시작 · 방화벽 · 예약작업
# ------------------------------------------------------------------
Say '2/6 자동시작 · 방화벽 · 예약 백업'
# 삭제 후 반드시 다시 조회해서 확인한다 — 권한 부족이면 조용히 실패하므로 성공을 가정하면 안 된다.
$runKey = 'HKCU:\Software\Microsoft\Windows\CurrentVersion\Run'
if ((Get-ItemProperty -Path $runKey -Name 'TempleMembershipServer' -EA SilentlyContinue)) {
  if ($DryRun) { Info '[삭제예정] HKCU Run\TempleMembershipServer' }
  else {
    Remove-ItemProperty -Path $runKey -Name 'TempleMembershipServer' -EA SilentlyContinue
    if (Get-ItemProperty -Path $runKey -Name 'TempleMembershipServer' -EA SilentlyContinue) { Warn '부팅 자동시작 해제 실패' }
    else { Ok '부팅 자동시작 해제' }
  }
} else { Info '부팅 자동시작 등록 없음' }

$fw = @(Get-NetFirewallRule -DisplayName 'Temple Membership*' -EA SilentlyContinue)
if ($fw.Count -eq 0) { Info '방화벽 규칙 없음' }
elseif ($DryRun) { Info "[삭제예정] 방화벽 규칙 $($fw.Count)건" }
else {
  $fw | Remove-NetFirewallRule -EA SilentlyContinue
  $left = @(Get-NetFirewallRule -DisplayName 'Temple Membership*' -EA SilentlyContinue).Count
  if ($left -gt 0) { Warn "방화벽 규칙 $left 건 삭제 실패 — 관리자 권한으로 다시 실행하세요" }
  else { Ok "방화벽 규칙 $($fw.Count)건 삭제" }
}

if (Get-ScheduledTask -TaskName 'TempleDbBackup' -EA SilentlyContinue) {
  if ($DryRun) { Info '[삭제예정] 예약작업 TempleDbBackup' }
  else {
    Unregister-ScheduledTask -TaskName 'TempleDbBackup' -Confirm:$false -EA SilentlyContinue
    if (Get-ScheduledTask -TaskName 'TempleDbBackup' -EA SilentlyContinue) { Warn '예약 백업 작업 삭제 실패 — 관리자 권한으로 다시 실행하세요' }
    else { Ok '예약 백업 작업 삭제' }
  }
} else { Info '예약 백업 작업 없음' }

# ------------------------------------------------------------------
# 3) 데이터베이스 — PG 를 남길 때만 DB/롤을 지운다(통째 제거면 5단계에서 사라짐)
# ------------------------------------------------------------------
Say '3/6 데이터베이스'
if (-not $DropDb) {
  if ($RemovePg) { Info 'PostgreSQL 을 통째로 제거하므로 DB 삭제는 건너뜁니다(5단계에서 함께 사라짐).' }
  else { Skip "$DbName 데이터베이스 (-Level repo)" }
} else {
  $psql = Join-Path $PgBin 'psql.exe'
  if (-not (Test-Path $psql)) { Warn "psql 없음: $psql — DB 삭제 건너뜀" }
  elseif ($DryRun) { Info "[삭제예정] DB $DbName · 롤 $DbUser" }
  else {
    if (-not $PgSuperPassword) { $PgSuperPassword = Read-Host 'PostgreSQL 슈퍼유저(postgres) 비밀번호' }
    $env:PGPASSWORD = $PgSuperPassword
    & $psql -U postgres -h localhost -d postgres -tAc 'SELECT 1' | Out-Null
    if ($LASTEXITCODE -ne 0) { Warn 'postgres 접속 실패 — DB/롤 삭제를 건너뜁니다(비번 확인).' }
    else {
      # 남은 세션을 먼저 끊어야 DROP DATABASE 가 통과한다. DB → 롤 순서 고정(롤이 DB 를 소유).
      & $psql -U postgres -h localhost -d postgres -c "SELECT pg_terminate_backend(pid) FROM pg_stat_activity WHERE datname='$DbName' AND pid <> pg_backend_pid();" | Out-Null
      & $psql -U postgres -h localhost -d postgres -c "DROP DATABASE IF EXISTS $DbName;" | Out-Null
      if ($LASTEXITCODE -eq 0) { Ok "DB $DbName 삭제" } else { Warn "DB $DbName 삭제 실패" }
      & $psql -U postgres -h localhost -d postgres -c "DROP ROLE IF EXISTS $DbUser;" | Out-Null
      if ($LASTEXITCODE -eq 0) { Ok "롤 $DbUser 삭제" } else { Warn "롤 $DbUser 삭제 실패(다른 DB 객체를 소유 중일 수 있음)" }
    }
  }
}

# ------------------------------------------------------------------
# 4) 리포 산출물 — 소스와 .git 은 남긴다
# ------------------------------------------------------------------
Say '4/6 리포 산출물(.env · 빌드 · data)'
Kill-Path (Join-Path $Root 'infra\native\.env') '.env'
Kill-Path (Join-Path $Root 'infra\native\postgres-슈퍼유저-비번.txt') 'postgres 비번 메모'
Kill-Path (Join-Path $Root 'backend\node_modules') 'backend\node_modules'
Kill-Path (Join-Path $Root 'backend\dist') 'backend\dist'
Kill-Path (Join-Path $Root 'frontend\node_modules') 'frontend\node_modules'
Kill-Path (Join-Path $Root 'frontend\dist') 'frontend\dist'
Kill-Path (Join-Path $Root 'data') 'data(업로드·백업·로그)'

# ------------------------------------------------------------------
# 5) winget 설치물
# ------------------------------------------------------------------
Say '5/6 사전요건 제거 (winget)'
function Remove-WingetPackage($id, $label) {
  $installed = (& winget list --id $id --exact 2>$null | Select-String -SimpleMatch $id)
  if (-not $installed) { Info "$label — 설치돼 있지 않음"; return }
  if ($DryRun) { Info "[제거예정] $label ($id)"; return }
  Write-Host "  $label 제거 중..." -ForegroundColor Yellow
  & winget uninstall --id $id --exact --silent --accept-source-agreements --disable-interactivity 2>&1 | Out-Null
  $still = (& winget list --id $id --exact 2>$null | Select-String -SimpleMatch $id)
  if ($still) { Warn "$label 제거 실패 — '설정 > 앱'에서 수동 제거하세요 ($id)" } else { Ok "$label 제거" }
}

if (-not $RemovePrereqs) { Skip "Node · pnpm · Git (-Level $Level)" }
else {
  # pnpm 은 npm 전역 패키지 → Node 를 지우기 전에 먼저 제거해야 한다.
  if (Get-Command npm -EA SilentlyContinue) {
    if ($DryRun) { Info '[제거예정] pnpm(전역)' }
    else { & npm rm -g pnpm 2>&1 | Out-Null; Ok 'pnpm(전역) 제거' }
  } else { Info 'npm 없음 — pnpm 제거 건너뜀' }
  Remove-WingetPackage 'OpenJS.NodeJS.LTS' 'Node LTS'
  Remove-WingetPackage 'Git.Git' 'Git'
  foreach ($p in @("$env:APPDATA\npm", "$env:APPDATA\npm-cache", "$env:LOCALAPPDATA\pnpm", "$env:LOCALAPPDATA\pnpm-store")) {
    Kill-Path $p (Split-Path $p -Leaf)
  }
}

if (-not $RemovePg) { Skip "PostgreSQL 16 (-Level $Level)" }
else {
  # 데이터 디렉터리는 uninstaller 가 남기므로, 서비스 등록정보에서 실제 경로(-D)를 먼저 알아둔다.
  $pgData = $null
  try {
    $img = (Get-ItemProperty 'HKLM:\SYSTEM\CurrentControlSet\Services\postgresql-x64-16' -EA SilentlyContinue).ImagePath
    if ($img -match '-D\s+"?([^"]+?)"?\s*(-|$)') { $pgData = $Matches[1].Trim() }
  } catch { }
  if ($pgData) { Info "데이터 디렉터리: $pgData" }
  $svc = Get-Service -Name 'postgresql-x64-16' -EA SilentlyContinue
  if ($svc) {
    if ($DryRun) { Info '[중지예정] 서비스 postgresql-x64-16' }
    else {
      Stop-Service 'postgresql-x64-16' -Force -EA SilentlyContinue
      # SCM 이 '중지'를 보고해도 자식 postgres.exe 가 남아 파일을 잡고 있으면 삭제가 실패한다.
      try { (Get-Service 'postgresql-x64-16').WaitForStatus('Stopped', [TimeSpan]::FromSeconds(30)) } catch { }
      Get-Process postgres -EA SilentlyContinue | Stop-Process -Force -EA SilentlyContinue
      Ok '서비스 postgresql-x64-16 중지 (postgres 프로세스 포함)'
    }
  }
  Remove-WingetPackage 'PostgreSQL.PostgreSQL.16' 'PostgreSQL 16'
  # winget 이 실패하면 EDB 자체 언인스톨러로 재시도(무인 모드).
  $edb = 'C:\Program Files\PostgreSQL\16\uninstall-postgresql.exe'
  if (-not $DryRun -and (Test-Path $edb)) {
    Warn 'winget 제거 후에도 남아 있어 EDB 언인스톨러로 재시도합니다(수 분 소요).'
    & $edb --mode unattended | Out-Null
  }
  if (-not $DryRun) {
    # EDB 언인스톨러는 데이터 디렉터리를 일부러 남긴다("the data directory has not been removed").
    # 서비스 등록도 남을 수 있어 지운다 — 남아 있으면 재설치 때 서비스 이름이 충돌한다.
    Get-Process postgres -EA SilentlyContinue | Stop-Process -Force -EA SilentlyContinue
    if (Get-Service -Name 'postgresql-x64-16' -EA SilentlyContinue) {
      & sc.exe delete 'postgresql-x64-16' 2>&1 | Out-Null
      if (Get-Service -Name 'postgresql-x64-16' -EA SilentlyContinue) { Warn '서비스 등록 제거 실패 — 재부팅 후 사라집니다' }
      else { Ok '서비스 등록(postgresql-x64-16) 제거' }
    }
  }
  # 데이터 디렉터리 → 설치 폴더 순서. 데이터가 남아 있으면 부모 폴더도 못 지운다.
  Remove-TreeHard $pgData 'PostgreSQL 데이터 디렉터리' | Out-Null
  Remove-TreeHard 'C:\Program Files\PostgreSQL' 'PostgreSQL 설치 폴더' | Out-Null
  if (Get-LocalUser -Name 'postgres' -EA SilentlyContinue) {
    Warn "윈도우 로컬 계정 'postgres' 가 남아 있습니다(설치 프로그램이 만든 서비스 계정)."
    Warn "  지우려면: Remove-LocalUser -Name postgres    ※ 재설치 시 자동으로 다시 만들어집니다."
  }
}

# ------------------------------------------------------------------
# 6) 검증
# ------------------------------------------------------------------
Say '6/6 검증'
if ($DryRun) { Warn '드라이런이라 아무것도 지우지 않았습니다 — 아래 "남음"은 현재 상태 그대로입니다.' }
function Check($label, [bool]$clean, $detail) {
  $mark = if ($clean) { '  [정리됨]' } else { '  [남음! ]' }
  $color = if ($clean) { 'Green' } else { 'Yellow' }
  Write-Host ("{0} {1,-26} {2}" -f $mark, $label, $detail) -ForegroundColor $color
}
$listening = @(Get-NetTCPConnection -LocalPort $Port -State Listen -EA SilentlyContinue)
Check "포트 $Port" ($listening.Count -eq 0) $(if ($listening.Count) { '아직 리스닝 중' } else { '' })
Check '.env' (-not (Test-Path (Join-Path $Root 'infra\native\.env'))) ''
Check 'backend\node_modules' (-not (Test-Path (Join-Path $Root 'backend\node_modules'))) ''
Check 'frontend\dist' (-not (Test-Path (Join-Path $Root 'frontend\dist'))) ''
Check 'data\' (-not (Test-Path (Join-Path $Root 'data'))) ''
Check '부팅 자동시작' (-not (Get-ItemProperty -Path $runKey -Name 'TempleMembershipServer' -EA SilentlyContinue)) ''
Check '방화벽 규칙' (@(Get-NetFirewallRule -DisplayName 'Temple Membership*' -EA SilentlyContinue).Count -eq 0) ''
$pgSvc = Get-Service -Name 'postgresql-x64-16' -EA SilentlyContinue
if ($RemovePg) {
  Check 'PostgreSQL 서비스' ($null -eq $pgSvc) $(if ($pgSvc) { '아직 있음 — 재부팅 후 재확인' } else { '' })
  if ($pgData) {
    Check 'PG 데이터 디렉터리' (-not (Test-Path -LiteralPath $pgData)) $(if (Test-Path -LiteralPath $pgData) { $pgData } else { '' })
  }
  Check 'PG 설치 폴더' (-not (Test-Path 'C:\Program Files\PostgreSQL')) ''
} else {
  if ($DropDb) {
    $psql = Join-Path $PgBin 'psql.exe'
    if ((Test-Path $psql) -and $PgSuperPassword) {
      $env:PGPASSWORD = $PgSuperPassword
      $dbLeft = (& $psql -U postgres -h localhost -d postgres -tAc "SELECT 1 FROM pg_database WHERE datname='$DbName'")
      $roleLeft = (& $psql -U postgres -h localhost -d postgres -tAc "SELECT 1 FROM pg_roles WHERE rolname='$DbUser'")
      Check "DB $DbName" ($dbLeft -ne '1') ''
      Check "롤 $DbUser" ($roleLeft -ne '1') ''
    }
  }
  Write-Host "  [유지 ] PostgreSQL 16                (-Level $Level)" -ForegroundColor DarkGray
}
if (-not $RemovePrereqs) { Write-Host "  [유지 ] Node · pnpm · Git            (-Level $Level)" -ForegroundColor DarkGray }
else {
  Check 'Node' ($null -eq (Get-Command node -EA SilentlyContinue)) ''
  Check 'Git' ($null -eq (Get-Command git -EA SilentlyContinue)) ''
  Check 'pnpm' ($null -eq (Get-Command pnpm -EA SilentlyContinue)) ''
}

Write-Host "`n============================================================" -ForegroundColor Green
if ($DryRun) {
  Write-Host ' 드라이런 — 아무것도 지우지 않았습니다. 실제로 실행하려면 -DryRun 을 빼세요.' -ForegroundColor Yellow
} else {
  Write-Host ' 초기화 완료.' -ForegroundColor Green
  Write-Host ' 1) 재부팅을 한 번 하세요 (PATH·서비스 등록 정리).' -ForegroundColor Green
  Write-Host " 2) 재설치: $Root\infra\native\newpc-install.bat  더블클릭" -ForegroundColor Green
  if ($RemovePrereqs) {
    Write-Host '    ※ Git 을 지웠으므로 이번 설치의 3단계(git pull)는 건너뛴다고 찍힙니다 —' -ForegroundColor DarkGray
    Write-Host '      1단계에서 Git 을 다시 깔기 때문에 다음 실행부터 정상 동작합니다.' -ForegroundColor DarkGray
  }
}
Write-Host "============================================================" -ForegroundColor Green
if (-not $env:ONECLICK_NOPAUSE) { Read-Host '엔터로 종료' }
