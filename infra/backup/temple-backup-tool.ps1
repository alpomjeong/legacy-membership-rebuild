# DB 백업 도구 (원클릭 GUI)
#   더블클릭 실행: 같은 폴더의 "백업도구.bat" 또는 바탕화면 바로가기
#   인증은 %APPDATA%\postgresql\pgpass.conf 사용(비번 입력 불필요)
#   자동백업 등록/해제는 관리자 권한이 필요 → 버튼 클릭 시 UAC 승인
Add-Type -AssemblyName System.Windows.Forms
Add-Type -AssemblyName System.Drawing
Add-Type -AssemblyName Microsoft.VisualBasic

# ===== 설정 (다른 PC면 이 4개만 맞추면 됨) =====
$PgBin        = 'C:\Program Files\PostgreSQL\16\bin'
$Database     = 'temple'
$User         = 'temple'
$BackupDir    = 'C:\temple-backups'
$TaskName     = 'TempleDbBackup'
$RetentionDays = 30
# ===============================================

$ScriptDir = Split-Path -Parent $PSCommandPath
if (-not $ScriptDir) { $ScriptDir = Split-Path -Parent $MyInvocation.MyCommand.Path }
$BackupScript   = Join-Path $ScriptDir 'pg-backup.ps1'
$RestoreScript  = Join-Path $ScriptDir 'pg-restore.ps1'
$RegisterScript = Join-Path $ScriptDir 'register-task.ps1'
$FullDir = Join-Path $BackupDir 'full'
$LogDir  = Join-Path $BackupDir 'logs'

$form = New-Object System.Windows.Forms.Form
$form.Text = 'DB 백업 도구'
$form.Size = New-Object System.Drawing.Size(600, 600)
$form.StartPosition = 'CenterScreen'
$form.Font = New-Object System.Drawing.Font('Malgun Gothic', 9)

$status = New-Object System.Windows.Forms.Label
$status.Location = '20,15'
$status.Size = '545,80'
$form.Controls.Add($status)

$logBox = New-Object System.Windows.Forms.TextBox
$logBox.Multiline = $true
$logBox.ScrollBars = 'Vertical'
$logBox.ReadOnly = $true
$logBox.Location = '20,255'
$logBox.Size = '545,290'
$logBox.Font = New-Object System.Drawing.Font('Consolas', 9)
$form.Controls.Add($logBox)

function Say([string]$t) { $logBox.AppendText($t + [Environment]::NewLine) }

function New-Btn([string]$text, [int]$x, [int]$y) {
  $b = New-Object System.Windows.Forms.Button
  $b.Text = $text
  $b.Location = New-Object System.Drawing.Point($x, $y)
  $b.Size = New-Object System.Drawing.Size(175, 42)
  $form.Controls.Add($b)
  return $b
}

function Refresh-Status {
  $s = "DB: $Database     백업폴더: $BackupDir`r`n"
  $latest = Get-ChildItem $FullDir -Filter *.dump -ErrorAction SilentlyContinue | Sort-Object LastWriteTime -Descending | Select-Object -First 1
  if ($latest) {
    $kb = [math]::Round($latest.Length / 1KB)
    $s += "최근 백업: $($latest.Name)  ($kb KB, $($latest.LastWriteTime.ToString('yyyy-MM-dd HH:mm')))`r`n"
  } else { $s += "최근 백업: 없음`r`n" }
  $task = Get-ScheduledTask -TaskName $TaskName -ErrorAction SilentlyContinue
  if ($task) {
    $info = Get-ScheduledTaskInfo -TaskName $TaskName
    $s += "자동백업: $($task.State)   다음실행: $($info.NextRunTime)   마지막결과: $($info.LastTaskResult)"
  } else { $s += "자동백업: 미등록 (아래 ⑥ 버튼으로 등록)" }
  $status.Text = $s
}

# 1행: 백업/복원
$btnBackup  = New-Btn '① 지금 백업'          20  105
$btnRunTask = New-Btn '② 자동백업 즉시 실행'  205 105
$btnRestore = New-Btn '③ 복원(되돌리기)'      390 105
# 2행: 열기/새로고침
$btnFolder  = New-Btn '④ 백업 폴더 열기'      20  152
$btnLog     = New-Btn '⑤ 로그 보기'          205 152
$btnRefresh = New-Btn '↻ 새로고침'           390 152
# 3행: 스케줄(자동백업 설정)
$btnSchedOn  = New-Btn '⑥ 자동백업 등록/변경' 20  199
$btnSchedOff = New-Btn '⑦ 자동백업 해제'      205 199
$btnSchedGui = New-Btn '⑧ 스케줄러 열기'      390 199

$btnBackup.Add_Click({
  $btnBackup.Enabled = $false
  Say('▶ 백업 시작...')
  & powershell.exe -NoProfile -ExecutionPolicy Bypass -File $BackupScript -Database $Database -User $User -BackupDir $BackupDir -RetentionDays $RetentionDays -PgBin $PgBin | Out-Null
  $code = $LASTEXITCODE
  $log = Get-ChildItem $LogDir -Filter 'backup-*.log' -ErrorAction SilentlyContinue | Sort-Object LastWriteTime -Descending | Select-Object -First 1
  if ($log) { Get-Content $log.FullName -Tail 3 -Encoding UTF8 | ForEach-Object { Say('  ' + $_) } }
  if ($code -eq 0) { Say('✔ 백업 완료') } else { Say("✗ 백업 실패 (코드 $code) — pgpass.conf/경로 확인") }
  Refresh-Status
  $btnBackup.Enabled = $true
})

$btnRunTask.Add_Click({
  Say('▶ 자동백업 작업 즉시 실행...')
  try {
    Start-ScheduledTask -TaskName $TaskName -ErrorAction Stop
    Say('  작업 시작됨 → [↻ 새로고침]으로 결과 확인')
  } catch { Say('✗ 스케줄 미등록/오류: ' + $_.Exception.Message) }
  Refresh-Status
})

$btnRestore.Add_Click({
  $ofd = New-Object System.Windows.Forms.OpenFileDialog
  if (Test-Path $FullDir) { $ofd.InitialDirectory = $FullDir }
  $ofd.Filter = 'dump 파일 (*.dump)|*.dump'
  if ($ofd.ShowDialog() -ne [System.Windows.Forms.DialogResult]::OK) { return }
  $dump = $ofd.FileName
  $target = [Microsoft.VisualBasic.Interaction]::InputBox("복원할 대상 DB (기존 DB, 내용 덮어쓰기됨)`r`n※ 새 테스트DB는 pgAdmin에서 먼저 생성", "대상 DB", $Database)
  if ([string]::IsNullOrWhiteSpace($target)) { return }
  $ans = [System.Windows.Forms.MessageBox]::Show("'$target' DB를 아래 백업으로 덮어씁니다.`r`n$dump`r`n`r`n계속할까요?", "복원 확인", [System.Windows.Forms.MessageBoxButtons]::YesNo, [System.Windows.Forms.MessageBoxIcon]::Warning)
  if ($ans -ne [System.Windows.Forms.DialogResult]::Yes) { return }
  Say("▶ 복원: $([System.IO.Path]::GetFileName($dump)) → $target")
  & powershell.exe -NoProfile -ExecutionPolicy Bypass -File $RestoreScript -Database $target -User $User -DumpFile $dump -PgBin $PgBin -Yes | Out-Null
  $code = $LASTEXITCODE
  if ($code -eq 0) { Say('✔ 복원 완료') } else { Say("△ 복원 종료코드 $code — 없는 객체 DROP 경고면 무해. 데이터 확인 권장.") }
  Refresh-Status
})

$btnFolder.Add_Click({ if (Test-Path $FullDir) { Start-Process explorer.exe $FullDir } else { Say('백업 폴더 없음: ' + $FullDir) } })

$btnLog.Add_Click({
  $log = Get-ChildItem $LogDir -Filter 'backup-*.log' -ErrorAction SilentlyContinue | Sort-Object LastWriteTime -Descending | Select-Object -First 1
  if ($log) { Start-Process notepad.exe $log.FullName } else { Say('로그 없음') }
})

$btnRefresh.Add_Click({ Refresh-Status; Say('↻ 상태 새로고침 완료') })

$btnSchedOn.Add_Click({
  $t = [Microsoft.VisualBasic.Interaction]::InputBox("매일 자동 백업 시각 (HH:mm)", "자동백업 등록/변경", "03:00")
  if ([string]::IsNullOrWhiteSpace($t)) { return }
  Say("▶ 자동백업 등록 요청(관리자 승인 필요): 매일 $t")
  $argline = '-NoProfile -ExecutionPolicy Bypass -File "{0}" -At "{1}" -BackupDir "{2}" -RetentionDays {3} -Database {4} -PgBin "{5}"' -f $RegisterScript, $t, $BackupDir, $RetentionDays, $Database, $PgBin
  try {
    Start-Process powershell -Verb RunAs -ArgumentList $argline -Wait
    Say("  처리 완료(또는 취소). 상태 확인 ↓")
  } catch { Say("✗ 취소/오류: " + $_.Exception.Message) }
  Refresh-Status
})

$btnSchedOff.Add_Click({
  $ans = [System.Windows.Forms.MessageBox]::Show("자동백업 스케줄($TaskName)을 해제할까요?", "확인", [System.Windows.Forms.MessageBoxButtons]::YesNo, [System.Windows.Forms.MessageBoxIcon]::Warning)
  if ($ans -ne [System.Windows.Forms.DialogResult]::Yes) { return }
  Say("▶ 자동백업 해제 요청(관리자 승인 필요)...")
  $cmd = 'Unregister-ScheduledTask -TaskName {0} -Confirm:$false' -f $TaskName
  try {
    Start-Process powershell -Verb RunAs -ArgumentList ('-NoProfile -ExecutionPolicy Bypass -Command "' + $cmd + '"') -Wait
    Say("  해제 요청 완료.")
  } catch { Say("✗ 취소/오류: " + $_.Exception.Message) }
  Refresh-Status
})

$btnSchedGui.Add_Click({
  Say('작업 스케줄러 열림 → TempleDbBackup 속성에서 "로그온 여부와 관계없이 실행" 설정 가능')
  Start-Process taskschd.msc
})

Refresh-Status
Say('DB 백업 도구 — 버튼을 누르세요. (인증: pgpass.conf)')
Say('※ 로그오프/잠금 중에도 백업하려면 ⑧에서 "로그온 여부와 관계없이 실행" 설정')
[void]$form.ShowDialog()
