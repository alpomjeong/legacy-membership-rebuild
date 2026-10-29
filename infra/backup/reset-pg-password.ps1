#requires -RunAsAdministrator
<#
  postgres 슈퍼유저 비밀번호를 '1234' 로 리셋한다(현재 비번을 몰라도 됨).
  방법: pg_hba.conf 를 잠깐 trust 로 바꿔 서비스 재시작 → ALTER USER → 원복 → 재시작.
  테스트 PC 전용. 운영 환경에서는 강한 비번을 쓸 것.
  실행: 관리자 PowerShell 에서
    powershell -NoProfile -ExecutionPolicy Bypass -File C:\Users\jsw00\reset-pg-password.ps1
#>
$ErrorActionPreference = 'Stop'

$svc   = 'postgresql-x64-16'
$data  = 'C:\Program Files\PostgreSQL\16\data'
$bin   = 'C:\Program Files\PostgreSQL\16\bin'
$hba   = Join-Path $data 'pg_hba.conf'
$bak   = "$hba.bak-reset"
$newpw = '1234'

Write-Host "1) pg_hba.conf 백업 → $bak"
Copy-Item $hba $bak -Force

try {
  Write-Host "2) 임시 trust 규칙을 최상단에 삽입(첫 매치 우선)"
  $trust = @"
# === TEMP trust (password reset) — 아래 블록은 스크립트가 자동 제거함 ===
host    all             all             127.0.0.1/32            trust
host    all             all             ::1/128                 trust
local   all             all                                     trust
# === /TEMP trust ===
"@
  $orig = Get-Content $hba -Raw
  Set-Content -Path $hba -Value ($trust + "`r`n" + $orig) -Encoding ascii

  Write-Host "3) 서비스 재시작(설정 반영)"
  Restart-Service $svc
  Start-Sleep -Seconds 3

  Write-Host "4) 비밀번호 변경 → '$newpw'"
  & "$bin\psql.exe" -U postgres -h 127.0.0.1 -p 5432 -d postgres -c "ALTER USER postgres WITH PASSWORD '$newpw';"
  if ($LASTEXITCODE -ne 0) { throw "ALTER USER 실패(종료코드 $LASTEXITCODE)" }
}
finally {
  Write-Host "5) pg_hba.conf 원복"
  Copy-Item $bak $hba -Force
  Remove-Item $bak -Force -ErrorAction SilentlyContinue
  Write-Host "6) 서비스 재시작(원복 반영)"
  Restart-Service $svc
  Start-Sleep -Seconds 3
}

Write-Host "7) 검증(비번 1234 로 접속)"
$env:PGPASSWORD = $newpw
$ver = & "$bin\psql.exe" -U postgres -h localhost -p 5432 -tAc "select version();"
Remove-Item Env:\PGPASSWORD -ErrorAction SilentlyContinue
if ($LASTEXITCODE -eq 0) {
  Write-Host "`n✔ 완료 — postgres 비밀번호가 '$newpw' 로 설정됨" -ForegroundColor Green
  Write-Host "  $ver"
} else {
  Write-Host "`n✗ 검증 실패 — 위 출력을 확인하세요" -ForegroundColor Red
  exit 1
}
