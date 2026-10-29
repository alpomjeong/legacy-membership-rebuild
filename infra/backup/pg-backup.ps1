<#
.SYNOPSIS
  운영 DB 일일 백업 (pg_dump 커스텀 포맷). Windows + 네이티브 PostgreSQL 전제.

.DESCRIPTION
  pg_dump -Fc 로 스키마+데이터를 자기완결 덤프(.dump)로 저장하고, 보존기간이 지난 파일을 정리한다.
  작업 스케줄러(register-task.ps1)로 매일 1회 실행하는 것을 전제로 한다.

  비밀번호는 스크립트에 넣지 말 것. 아래 둘 중 하나로 pg_dump 가 자동 인식하게 한다:
    (권장) %APPDATA%\postgresql\pgpass.conf  →  host:port:db:user:password  한 줄
    (대안) 환경변수 PGPASSWORD

.EXAMPLE
  # 기본값으로 즉시 1회 백업
  powershell -NoProfile -ExecutionPolicy Bypass -File .\pg-backup.ps1

.EXAMPLE
  # 값 지정
  .\pg-backup.ps1 -Database temple -BackupDir "D:\temple-backups" -RetentionDays 30 `
                  -PgBin "C:\Program Files\PostgreSQL\16\bin"
#>
[CmdletBinding()]
param(
  # pg_dump.exe 가 있는 폴더. PATH 에 있으면 비워도 됨. 예: C:\Program Files\PostgreSQL\16\bin
  [string]$PgBin        = $env:PG_BIN,
  [string]$DbHost       = $(if ($env:PGHOST)     { $env:PGHOST }     else { 'localhost' }),
  [int]   $Port         = $(if ($env:PGPORT)     { [int]$env:PGPORT } else { 5432 }),
  [string]$Database     = $(if ($env:PGDATABASE) { $env:PGDATABASE } else { 'temple' }),
  [string]$User         = $(if ($env:PGUSER)     { $env:PGUSER }     else { 'temple' }),
  # 백업 산출물 루트. 외장/NAS 경로를 주면 오프사이트로 바로 저장 가능.
  [string]$BackupDir    = $(if ($env:BACKUP_DIR) { $env:BACKUP_DIR } else { 'C:\temple-backups' }),
  # 보존일수(이보다 오래된 .dump 삭제)
  [int]   $RetentionDays = $(if ($env:BACKUP_RETENTION_DAYS) { [int]$env:BACKUP_RETENTION_DAYS } else { 30 })
)

$ErrorActionPreference = 'Stop'

$fullDir = Join-Path $BackupDir 'full'
$logDir  = Join-Path $BackupDir 'logs'
New-Item -ItemType Directory -Force -Path $fullDir, $logDir | Out-Null

$stamp   = Get-Date -Format 'yyyyMMdd-HHmmss'
$outFile = Join-Path $fullDir "temple-$stamp.dump"
$logFile = Join-Path $logDir  ("backup-{0}.log" -f (Get-Date -Format 'yyyyMMdd'))

function Write-Log([string]$Message) {
  $line = '[{0}] {1}' -f (Get-Date -Format 's'), $Message
  Add-Content -Path $logFile -Value $line -Encoding UTF8
  Write-Host $line
}

$pgDump = if ($PgBin) { Join-Path $PgBin 'pg_dump.exe' } else { 'pg_dump' }

Write-Log "백업 시작 → $outFile  (db=$Database host=$DbHost port=$Port user=$User)"
try {
  # -Fc: 커스텀 포맷(zlib 압축, pg_restore 로 복원). 스키마+데이터 자기완결.
  & $pgDump -h $DbHost -p $Port -U $User -d $Database -Fc -f $outFile
  if ($LASTEXITCODE -ne 0) { throw "pg_dump 실패 (exit $LASTEXITCODE)" }

  $size = (Get-Item $outFile).Length
  Write-Log ("백업 완료 — {0:N0} bytes" -f $size)
}
catch {
  Write-Log "백업 실패: $($_.Exception.Message)"
  if (Test-Path $outFile) { Remove-Item $outFile -Force }  # 부분 파일 정리
  exit 1
}

# 보존정리: RetentionDays 초과 덤프 삭제 (파일명이 타임스탬프이나 안전하게 LastWriteTime 기준)
$cutoff = (Get-Date).AddDays(-$RetentionDays)
Get-ChildItem -Path $fullDir -Filter 'temple-*.dump' |
  Where-Object { $_.LastWriteTime -lt $cutoff } |
  ForEach-Object {
    Write-Log "보존기간 초과 삭제: $($_.Name)"
    Remove-Item $_.FullName -Force
  }

# 로그도 90일 보존
Get-ChildItem -Path $logDir -Filter 'backup-*.log' |
  Where-Object { $_.LastWriteTime -lt (Get-Date).AddDays(-90) } |
  Remove-Item -Force

Write-Log '완료'
exit 0
