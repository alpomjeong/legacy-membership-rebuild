# ============================================================
#  불사 · 회원관리 - 서버 관리 GUI (Docker/CMD 불필요)
#  시작/중지/재시작 · 상태표시 · 브라우저 · 로그 · 백업폴더 · 트레이 · 부팅 자동시작
#  실행: 같은 폴더의 "서버관리.bat" 더블클릭
# ============================================================
param([switch]$AutoStart, [string]$Capture)

Add-Type -AssemblyName System.Windows.Forms
Add-Type -AssemblyName System.Drawing
[System.Windows.Forms.Application]::EnableVisualStyles()

# 이 프로세스의 콘솔(빈 powershell) 창을 숨긴다 — GUI 창만 남긴다(캡처 모드 제외).
if (-not $Capture) {
  try {
    Add-Type -Namespace Native -Name Win -MemberDefinition @'
[DllImport("kernel32.dll")] public static extern IntPtr GetConsoleWindow();
[DllImport("user32.dll")] public static extern bool ShowWindow(IntPtr hWnd, int nCmdShow);
'@
    $cw = [Native.Win]::GetConsoleWindow()
    if ($cw -ne [IntPtr]::Zero) { [void][Native.Win]::ShowWindow($cw, 0) }  # 0 = SW_HIDE
  } catch { }
}

$Here     = Split-Path -Parent $MyInvocation.MyCommand.Path
$Root     = (Resolve-Path (Join-Path $Here '..\..')).Path
$StartBat = Join-Path $Here 'start.bat'
$LogFile  = Join-Path $Root 'data\server.log'
$Ps1Path  = $MyInvocation.MyCommand.Path

# --- .env 에서 PORT / BACKUP_DIR ---
$Port = 8080
$BackupDir = Join-Path $Root 'data\backups'
$EnvFile = Join-Path $Here '.env'
if (Test-Path $EnvFile) {
  foreach ($line in Get-Content $EnvFile) {
    if ($line -match '^\s*PORT\s*=\s*(\d+)')      { $Port = [int]$Matches[1] }
    if ($line -match '^\s*BACKUP_DIR\s*=\s*(.+)$') { $BackupDir = $Matches[1].Trim() }
  }
}
$Url = "http://localhost:$Port"

# --- 색상 팔레트(청자/한지) ---
$cBg     = [System.Drawing.Color]::FromArgb(251, 248, 240)
$cCard   = [System.Drawing.Color]::White
$cInk    = [System.Drawing.Color]::FromArgb(42, 36, 32)
$cMuted  = [System.Drawing.Color]::FromArgb(122, 112, 96)
$cGreen  = [System.Drawing.Color]::FromArgb(47, 125, 107)
$cGreenL = [System.Drawing.Color]::FromArgb(233, 242, 238)
$cRun    = [System.Drawing.Color]::FromArgb(45, 160, 100)
$cGray   = [System.Drawing.Color]::FromArgb(150, 150, 150)
$cAmber  = [System.Drawing.Color]::FromArgb(210, 160, 40)
$cBorder = [System.Drawing.Color]::FromArgb(228, 224, 214)

function New-DotIcon($color) {
  $bmp = New-Object System.Drawing.Bitmap 32, 32
  $g = [System.Drawing.Graphics]::FromImage($bmp); $g.SmoothingMode = 'AntiAlias'
  $g.Clear([System.Drawing.Color]::Transparent)
  $g.FillEllipse((New-Object System.Drawing.SolidBrush $color), 4, 4, 24, 24)
  $g.Dispose()
  [System.Drawing.Icon]::FromHandle($bmp.GetHicon())
}

# ---------------- 서버 제어 ----------------
function Get-ServerPids {
  try { @(Get-NetTCPConnection -LocalPort $Port -State Listen -ErrorAction SilentlyContinue |
        Select-Object -ExpandProperty OwningProcess -Unique) } catch { @() }
}
# 포트 리스닝 여부 — .NET in-process TCP 리스너 테이블 조회(1~2ms). HTTP/connect 시도 없음
#   → UI 스레드 멈춤 없음(과거: Invoke-WebRequest 2초 / connect 거부 2초로 창이 멈춰 보였음).
function Test-Running {
  try {
    $eps = [System.Net.NetworkInformation.IPGlobalProperties]::GetIPGlobalProperties().GetActiveTcpListeners()
    return [bool]($eps | Where-Object { $_.Port -eq $Port } | Select-Object -First 1)
  } catch { return $false }
}
function Start-Server {
  if (Get-ServerPids) { return }
  New-Item -ItemType Directory -Force (Split-Path $LogFile) | Out-Null
  $env:TEMPLE_NOPAUSE = '1'
  $errLog = [System.IO.Path]::ChangeExtension($LogFile, '.err.log')
  Start-Process -FilePath 'cmd.exe' -ArgumentList '/c', "`"$StartBat`"" -WindowStyle Hidden `
    -RedirectStandardOutput $LogFile -RedirectStandardError $errLog | Out-Null
}
function Stop-Server { foreach ($procId in Get-ServerPids) { try { Stop-Process -Id $procId -Force -ErrorAction SilentlyContinue } catch {} } }

# --- 부팅 자동시작(HKCU Run) — 무창 런처(wscript+vbs)로 등록해 부팅 시에도 창이 안 뜨게 ---
$RunKey  = 'HKCU:\Software\Microsoft\Windows\CurrentVersion\Run'
$RunName = 'TempleMembershipServer'
$VbsPath = Join-Path $Here '서버관리.vbs'
$RunCmd  = if (Test-Path $VbsPath) { "wscript.exe `"$VbsPath`" auto" }
           else { "powershell.exe -NoProfile -ExecutionPolicy Bypass -WindowStyle Hidden -File `"$Ps1Path`" -AutoStart" }
function Get-AutoStart { $null -ne (Get-ItemProperty -Path $RunKey -Name $RunName -ErrorAction SilentlyContinue).$RunName }
function Set-AutoStart($on) {
  if ($on) { Set-ItemProperty -Path $RunKey -Name $RunName -Value $RunCmd }
  else { Remove-ItemProperty -Path $RunKey -Name $RunName -ErrorAction SilentlyContinue }
}

# ---------------- UI ----------------
$form = New-Object System.Windows.Forms.Form
$form.Text = "불사 · 회원관리 서버"
$form.ClientSize = New-Object System.Drawing.Size(440, 396)
$form.StartPosition = "CenterScreen"
$form.FormBorderStyle = "FixedDialog"
$form.MaximizeBox = $false
$form.BackColor = $cBg
$form.Font = New-Object System.Drawing.Font("Malgun Gothic", 9)

$title = New-Object System.Windows.Forms.Label
$title.Text = "불사 · 회원관리"; $title.AutoSize = $true
$title.Font = New-Object System.Drawing.Font("Malgun Gothic", 15, [System.Drawing.FontStyle]::Bold)
$title.ForeColor = $cInk; $title.Location = New-Object System.Drawing.Point(22, 18)
$form.Controls.Add($title)
$sub = New-Object System.Windows.Forms.Label
$sub.Text = "서버 관리"; $sub.AutoSize = $true; $sub.ForeColor = $cMuted
$sub.Location = New-Object System.Drawing.Point(24, 50)
$form.Controls.Add($sub)

# 상태 카드
$card = New-Object System.Windows.Forms.Panel
$card.Location = New-Object System.Drawing.Point(22, 78); $card.Size = New-Object System.Drawing.Size(396, 92)
$card.BackColor = $cCard
$card.Add_Paint({ param($s, $e)
  $r = New-Object System.Drawing.Rectangle 0, 0, ($s.Width - 1), ($s.Height - 1)
  $e.Graphics.DrawRectangle((New-Object System.Drawing.Pen $cBorder), $r) })
$form.Controls.Add($card)

$dot = New-Object System.Windows.Forms.Label
$dot.Text = [char]0x25CF; $dot.AutoSize = $true; $dot.ForeColor = $cGray
$dot.Font = New-Object System.Drawing.Font("Malgun Gothic", 16)
$dot.Location = New-Object System.Drawing.Point(14, 12); $card.Controls.Add($dot)
$statusLbl = New-Object System.Windows.Forms.Label
$statusLbl.Text = "확인 중…"; $statusLbl.AutoSize = $true
$statusLbl.Font = New-Object System.Drawing.Font("Malgun Gothic", 13, [System.Drawing.FontStyle]::Bold)
$statusLbl.Location = New-Object System.Drawing.Point(42, 14); $card.Controls.Add($statusLbl)

# 실제 LAN IP — 기본 게이트웨이가 있는 인터페이스(가상 어댑터 vEthernet 등 배제)
$lan = try {
  $rt = Get-NetRoute -DestinationPrefix '0.0.0.0/0' -ErrorAction SilentlyContinue | Sort-Object RouteMetric | Select-Object -First 1
  if ($rt) { Get-NetIPAddress -InterfaceIndex $rt.InterfaceIndex -AddressFamily IPv4 -ErrorAction SilentlyContinue | Select-Object -First 1 -ExpandProperty IPAddress }
} catch { $null }
$addr = New-Object System.Windows.Forms.Label
$addr.AutoSize = $true; $addr.ForeColor = $cMuted
$addr.Font = New-Object System.Drawing.Font("Malgun Gothic", 8.5)
$addr.Text = "이 PC:  $Url" + $(if ($lan) { "`n같은 와이파이:  http://$lan`:$Port" } else { "" })
$addr.Location = New-Object System.Drawing.Point(16, 46); $card.Controls.Add($addr)

function New-Btn($text, $x, $y, $w, $h) {
  $b = New-Object System.Windows.Forms.Button
  $b.Text = $text; $b.Location = New-Object System.Drawing.Point($x, $y)
  $b.Size = New-Object System.Drawing.Size($w, $h)
  $b.Font = New-Object System.Drawing.Font("Malgun Gothic", 10, [System.Drawing.FontStyle]::Bold)
  $b.FlatStyle = "Flat"; $b.FlatAppearance.BorderColor = $cBorder; $b.BackColor = $cCard; $b.ForeColor = $cInk
  $b.Cursor = "Hand"; $form.Controls.Add($b); $b
}
$btnStart   = New-Btn "▶  시작"   22  184 126 44
$btnStop    = New-Btn "■  중지"   157 184 126 44
$btnRestart = New-Btn "↻  재시작" 292 184 126 44
$btnStart.BackColor = $cGreen; $btnStart.ForeColor = [System.Drawing.Color]::White; $btnStart.FlatAppearance.BorderColor = $cGreen

$btnOpen   = New-Btn "브라우저 열기" 22  236 196 40
$btnLog    = New-Btn "로그"          224 236 92  40
$btnBackup = New-Btn "백업 폴더"     322 236 96  40
$btnOpen.BackColor = $cGreenL; $btnOpen.FlatAppearance.BorderColor = $cGreenL; $btnOpen.ForeColor = $cGreen

$chkAuto = New-Object System.Windows.Forms.CheckBox
$chkAuto.Text = "이 PC 켜질 때 서버 자동 시작"; $chkAuto.AutoSize = $true
$chkAuto.Location = New-Object System.Drawing.Point(24, 292); $chkAuto.ForeColor = $cInk
$chkAuto.Font = New-Object System.Drawing.Font("Malgun Gothic", 9.5)
$chkAuto.Checked = (Get-AutoStart)
$chkAuto.Add_CheckedChanged({ Set-AutoStart $chkAuto.Checked })
$form.Controls.Add($chkAuto)

$hint = New-Object System.Windows.Forms.Label
$hint.AutoSize = $false; $hint.Size = New-Object System.Drawing.Size(396, 60)
$hint.Location = New-Object System.Drawing.Point(24, 322); $hint.ForeColor = $cMuted
$hint.Font = New-Object System.Drawing.Font("Malgun Gothic", 8.5)
$hint.Text = "· 창을 닫으면 트레이로 들어갑니다(서버는 계속 실행 · 트레이 아이콘 더블클릭으로 다시 열기).`n· 첫 시작은 20~30초 걸립니다(마이그레이션·시드)."
$form.Controls.Add($hint)

# ---------------- 트레이 ----------------
$tray = New-Object System.Windows.Forms.NotifyIcon
$tray.Text = "불사 · 회원관리 서버"; $tray.Icon = (New-DotIcon $cGray); $tray.Visible = $true
$menu = New-Object System.Windows.Forms.ContextMenuStrip
$miOpen  = $menu.Items.Add("창 열기");       $miOpen.add_Click({ $form.Show(); $form.WindowState = 'Normal'; $form.Activate() })
$miWeb   = $menu.Items.Add("브라우저 열기"); $miWeb.add_Click({ Start-Process $Url })
[void]$menu.Items.Add((New-Object System.Windows.Forms.ToolStripSeparator))
$miStart = $menu.Items.Add("서버 시작");     $miStart.add_Click({ $script:starting = $true; Start-Server })
$miStop  = $menu.Items.Add("서버 중지");     $miStop.add_Click({ $script:starting = $false; Stop-Server })
[void]$menu.Items.Add((New-Object System.Windows.Forms.ToolStripSeparator))
$miExit  = $menu.Items.Add("관리창 종료(서버 유지)"); $miExit.add_Click({ $script:reallyExit = $true; $tray.Visible = $false; $form.Close() })
$tray.ContextMenuStrip = $menu
$tray.add_MouseDoubleClick({ $form.Show(); $form.WindowState = 'Normal'; $form.Activate() })

$script:reallyExit = $false
$form.Add_Resize({ if ($form.WindowState -eq 'Minimized') { $form.Hide() } })
$form.Add_FormClosing({ param($s, $e)
  if (-not $script:reallyExit) { $e.Cancel = $true; $form.Hide()
    $tray.ShowBalloonTip(1500, "계속 실행 중", "트레이에서 서버 관리가 계속됩니다.", [System.Windows.Forms.ToolTipIcon]::Info) } })

# ---------------- 상태 갱신 ----------------
$script:starting = $false
function Update-Status {
  $running = Test-Running
  if ($running) { $script:starting = $false }
  if ($running) {
    $dot.ForeColor = $cRun; $statusLbl.Text = "실행 중"; $statusLbl.ForeColor = $cRun
    $tray.Icon = (New-DotIcon $cRun); $tray.Text = "불사 · 회원관리 — 실행 중"
    $btnStart.Enabled = $false; $btnStop.Enabled = $true; $btnRestart.Enabled = $true; $btnOpen.Enabled = $true
  } elseif ($script:starting) {
    $dot.ForeColor = $cAmber; $statusLbl.Text = "시작 중…"; $statusLbl.ForeColor = $cAmber
    $tray.Icon = (New-DotIcon $cAmber); $tray.Text = "불사 · 회원관리 — 시작 중"
    $btnStart.Enabled = $false; $btnStop.Enabled = $true; $btnRestart.Enabled = $false; $btnOpen.Enabled = $false
  } else {
    $dot.ForeColor = $cGray; $statusLbl.Text = "중지됨"; $statusLbl.ForeColor = $cGray
    $tray.Icon = (New-DotIcon $cGray); $tray.Text = "불사 · 회원관리 — 중지"
    $btnStart.Enabled = $true; $btnStop.Enabled = $false; $btnRestart.Enabled = $false; $btnOpen.Enabled = $false
  }
}
$btnStart.Add_Click({ $script:starting = $true; Update-Status; Start-Server })
$btnStop.Add_Click({ $script:starting = $false; Stop-Server; Start-Sleep -Milliseconds 300; Update-Status })
$btnRestart.Add_Click({ Stop-Server; Start-Sleep -Milliseconds 800; $script:starting = $true; Update-Status; Start-Server })
$btnOpen.Add_Click({ Start-Process $Url })
$btnLog.Add_Click({ if (Test-Path $LogFile) { Start-Process notepad.exe $LogFile } else { [System.Windows.Forms.MessageBox]::Show("아직 로그가 없습니다.") } })
$btnBackup.Add_Click({ $d = $BackupDir; if (Test-Path (Join-Path $d 'full')) { $d = Join-Path $d 'full' }
  if (Test-Path $d) { Start-Process explorer.exe $d } else { [System.Windows.Forms.MessageBox]::Show("아직 백업 폴더가 없습니다: $d") } })

# 디자인 미리보기 캡처(있으면 렌더 후 종료)
if ($Capture) {
  $form.Show()
  for ($k = 0; $k -lt 6; $k++) { [System.Windows.Forms.Application]::DoEvents(); Start-Sleep -Milliseconds 120 }
  Update-Status
  [System.Windows.Forms.Application]::DoEvents()
  $bmp = New-Object System.Drawing.Bitmap $form.ClientSize.Width, $form.ClientSize.Height
  $form.DrawToBitmap($bmp, (New-Object System.Drawing.Rectangle 0, 0, $form.ClientSize.Width, $form.ClientSize.Height))
  $bmp.Save($Capture); $tray.Visible = $false; $form.Close(); return
}

$timer = New-Object System.Windows.Forms.Timer
$timer.Interval = 1500; $timer.Add_Tick({ try { Update-Status } catch { } }); $timer.Start()

if ($AutoStart) { $script:starting = $true; Start-Server }
Update-Status

# 자동시작이면 표시 직후 트레이로 숨김(창 없이 상주). Application.Run 은 창을 숨겨도 계속 돈다.
if ($AutoStart) {
  $form.ShowInTaskbar = $false
  $form.Add_Shown({ $form.Hide() })
}
# ShowDialog(모달) 은 Hide 시 반환돼 프로세스가 종료됨 → Application.Run(비모달) 사용.
#   X 로 닫으면 FormClosing 이 취소하고 Hide(트레이 상주), 실제 종료는 트레이 '관리창 종료'.
[System.Windows.Forms.Application]::Run($form)
$timer.Stop(); $tray.Visible = $false; $tray.Dispose()
