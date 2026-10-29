<#
.SYNOPSIS
  pg_dump 백업/복원 파이프라인 자가진단. 임시 DB로 실제 백업→복원→대조를 1회 수행한다.

.DESCRIPTION
  운영 데이터는 건드리지 않는다. PostgreSQL(psql/pg_dump/pg_restore)만 설치돼 있으면 된다.
  임시 DB 2개(bk_selftest_src/dst)를 만들어 샘플 3행을 넣고, pg-backup.ps1 로 백업 →
  빈 DB에 pg-restore.ps1 로 복원 → 건수·합계가 일치하는지 확인 후 모두 정리한다.

.EXAMPLE
  .\selftest.ps1 -User postgres -PgBin "C:\Program Files\PostgreSQL\16\bin"
  # PGPASSWORD 환경변수 또는 pgpass.conf 로 비밀번호 인식되게 해둘 것.
#>
[CmdletBinding()]
param(
  [string]$PgBin   = $env:PG_BIN,
  [string]$DbHost  = 'localhost',
  [int]   $Port    = 5432,
  [string]$User    = 'postgres',
  [string]$WorkDir = (Join-Path $env:TEMP 'temple-bk-selftest')
)

$ErrorActionPreference = 'Stop'
$psql = if ($PgBin) { Join-Path $PgBin 'psql.exe' } else { 'psql' }
$src  = 'bk_selftest_src'
$dst  = 'bk_selftest_dst'
$pass = $false

function Admin([string]$sql) { & $psql -h $DbHost -p $Port -U $User -d postgres -v ON_ERROR_STOP=1 -c $sql | Out-Null }
function Run([string]$db, [string]$sql) { & $psql -h $DbHost -p $Port -U $User -d $db -v ON_ERROR_STOP=1 -tAc $sql }

Write-Host "자가진단 시작 (host=$DbHost port=$Port user=$User)"
try {
  # 1) 원본 DB + 샘플 데이터
  Admin "DROP DATABASE IF EXISTS $src;"
  Admin "CREATE DATABASE $src;"
  & $psql -h $DbHost -p $Port -U $User -d $src -v ON_ERROR_STOP=1 `
    -c "CREATE TABLE t(id int primary key, name text, amt numeric(10,2)); INSERT INTO t VALUES (1,'a',1000.50),(2,'b',2000.00),(3,'c',3000.00);" | Out-Null
  Write-Host "  1) 원본 DB 생성 + 3행 삽입"

  # 2) 백업 (실제 pg-backup.ps1)
  & (Join-Path $PSScriptRoot 'pg-backup.ps1') -Database $src -DbHost $DbHost -Port $Port -User $User `
    -BackupDir $WorkDir -RetentionDays 30 -PgBin $PgBin | Out-Null
  $dump = (Get-ChildItem (Join-Path $WorkDir 'full') -Filter '*.dump' |
           Sort-Object LastWriteTime -Descending | Select-Object -First 1).FullName
  if (-not $dump) { throw '덤프 파일이 생성되지 않음' }
  Write-Host "  2) 백업 완료 → $dump"

  # 3) 빈 DB에 복원 (실제 pg-restore.ps1)
  Admin "DROP DATABASE IF EXISTS $dst;"
  Admin "CREATE DATABASE $dst;"
  & (Join-Path $PSScriptRoot 'pg-restore.ps1') -Database $dst -DbHost $DbHost -Port $Port -User $User `
    -DumpFile $dump -PgBin $PgBin -Yes | Out-Null
  Write-Host "  3) 빈 DB에 복원"

  # 4) 대조: count=3, sum(amt)=6000.50 이어야
  $result = (Run $dst "SELECT count(*)::text || ',' || coalesce(sum(amt)::text,'0') FROM t;").Trim()
  Write-Host "  4) 복원 결과: $result  (기대: 3,6000.50)"
  $pass = ($result -eq '3,6000.50')
}
finally {
  # 5) 정리(임시 DB·작업폴더 제거)
  try { Admin "DROP DATABASE IF EXISTS $src;" } catch {}
  try { Admin "DROP DATABASE IF EXISTS $dst;" } catch {}
  if (Test-Path $WorkDir) { Remove-Item $WorkDir -Recurse -Force }
}

if ($pass) { Write-Host "`n✔ PASS — 백업/복원 파이프라인 정상" -ForegroundColor Green; exit 0 }
else       { Write-Host "`n✗ FAIL — 결과 불일치(위 출력 확인)" -ForegroundColor Red;   exit 1 }
