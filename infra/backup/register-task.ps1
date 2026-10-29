<#
.SYNOPSIS
  일일 DB 백업을 Windows 작업 스케줄러에 등록한다(매일 지정 시각).

.DESCRIPTION
  pg-backup.ps1 을 매일 -At 시각에 실행하는 예약 작업(TempleDbBackup)을 만든다.
  관리자 PowerShell 에서 1회 실행. PC 가 그 시각에 꺼져 있었으면 켜진 뒤 실행되도록 StartWhenAvailable 설정.

.EXAMPLE
  # 매일 새벽 3시, 백업 폴더/보존일 지정
  .\register-task.ps1 -At "03:00" -BackupDir "D:\temple-backups" -RetentionDays 30
#>
[CmdletBinding()]
param(
  [string]$At           = '03:00',
  [string]$BackupDir    = 'C:\temple-backups',
  [int]   $RetentionDays = 30,
  [string]$Database     = 'temple',
  [string]$PgBin        = '',                      # 예: C:\Program Files\PostgreSQL\16\bin
  [string]$TaskName     = 'TempleDbBackup'
)

$ErrorActionPreference = 'Stop'
$script = Join-Path $PSScriptRoot 'pg-backup.ps1'
if (-not (Test-Path $script)) { Write-Error "pg-backup.ps1 을 찾을 수 없음: $script"; exit 1 }

# 백업 스크립트에 넘길 인자 구성
$argList = @(
  '-NoProfile', '-ExecutionPolicy', 'Bypass', '-File', "`"$script`"",
  '-BackupDir', "`"$BackupDir`"", '-RetentionDays', $RetentionDays, '-Database', $Database
)
if ($PgBin) { $argList += @('-PgBin', "`"$PgBin`"") }

$action  = New-ScheduledTaskAction  -Execute 'powershell.exe' -Argument ($argList -join ' ')
$trigger = New-ScheduledTaskTrigger -Daily -At $At
$settings = New-ScheduledTaskSettingsSet -StartWhenAvailable -DontStopOnIdleEnd `
  -MultipleInstances IgnoreNew -ExecutionTimeLimit (New-TimeSpan -Hours 2)

# 현재 사용자 컨텍스트로 실행(pgpass.conf 가 그 사용자 %APPDATA% 에 있어야 함). 최고 권한.
# S4U: 로그온 여부와 관계없이 백그라운드로 실행 — 콘솔 창이 뜨지 않고 비밀번호 저장도 불필요.
$principal = New-ScheduledTaskPrincipal -UserId $env:USERNAME -LogonType S4U -RunLevel Highest
Register-ScheduledTask -TaskName $TaskName -Action $action -Trigger $trigger -Settings $settings `
  -Principal $principal -Description '운영 DB 일일 백업(pg_dump -Fc)' -Force | Out-Null

Write-Host "✔ 예약 작업 '$TaskName' 등록 완료 — 매일 $At, 백업폴더 $BackupDir, 보존 $RetentionDays일" -ForegroundColor Green
Write-Host "  확인:  Get-ScheduledTask -TaskName $TaskName"
Write-Host "  즉시테스트:  Start-ScheduledTask -TaskName $TaskName"
Write-Host "  해제:  Unregister-ScheduledTask -TaskName $TaskName -Confirm:`$false"
