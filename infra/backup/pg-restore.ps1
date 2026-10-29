<#
.SYNOPSIS
  pg_dump(.dump) 백업으로 DB 복원. 파괴적 — 대상 DB 객체를 정리 후 덮어쓴다.

.DESCRIPTION
  pg_restore --clean --if-exists 로 기존 객체를 지우고 덤프 시점으로 복원한다.
  대상 DB 는 미리 존재해야 한다(없으면: createdb -U <user> <db>).
  안전장치로 -Yes 없이는 실행되지 않는다.

.EXAMPLE
  .\pg-restore.ps1 -DumpFile "C:\temple-backups\full\temple-20260701-030000.dump" -Yes
#>
[CmdletBinding()]
param(
  [Parameter(Mandatory = $true)][string]$DumpFile,
  [string]$PgBin  = $env:PG_BIN,
  [string]$DbHost = $(if ($env:PGHOST)     { $env:PGHOST }     else { 'localhost' }),
  [int]   $Port   = $(if ($env:PGPORT)     { [int]$env:PGPORT } else { 5432 }),
  [string]$Database = $(if ($env:PGDATABASE) { $env:PGDATABASE } else { 'temple' }),
  [string]$User   = $(if ($env:PGUSER)     { $env:PGUSER }     else { 'temple' }),
  # 파괴적 작업 확인 플래그
  [switch]$Yes
)

$ErrorActionPreference = 'Stop'

if (-not (Test-Path $DumpFile)) { Write-Error "덤프 파일 없음: $DumpFile"; exit 1 }
if (-not $Yes) {
  Write-Host "⚠ 이 작업은 대상 DB($Database)의 객체를 정리 후 덮어씁니다. 확인하려면 -Yes 를 붙이세요." -ForegroundColor Yellow
  exit 1
}

$pgRestore = if ($PgBin) { Join-Path $PgBin 'pg_restore.exe' } else { 'pg_restore' }

Write-Host "복원 시작 — $DumpFile → db=$Database ($DbHost`:$Port)"
# --clean --if-exists: 기존 객체 DROP 후 재생성. --no-owner: 소유자 재설정 생략(권한 단순화).
& $pgRestore -h $DbHost -p $Port -U $User -d $Database --clean --if-exists --no-owner $DumpFile
if ($LASTEXITCODE -ne 0) {
  # pg_restore 는 무해한 경고에도 비0을 낼 수 있음(존재하지 않는 객체 DROP 등). 로그 확인 권장.
  Write-Host "pg_restore 종료코드 $LASTEXITCODE — 위 경고를 확인하세요(없는 객체 DROP 경고는 무해)." -ForegroundColor Yellow
  exit $LASTEXITCODE
}
Write-Host "✔ 복원 완료" -ForegroundColor Green
exit 0
