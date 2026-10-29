' 불사 · 회원관리 - 서버 관리 GUI launcher (no console window)
' Launches temple-control.ps1 fully hidden via ShellExecute SW_HIDE(0),
' so no empty powershell.exe window appears. The WinForms GUI still shows.
Option Explicit
Dim sh, here, ps1, extra
Set sh = CreateObject("WScript.Shell")
here = Left(WScript.ScriptFullName, InStrRev(WScript.ScriptFullName, "\"))
ps1 = here & "temple-control.ps1"
extra = ""
' Optional "auto" arg → 부팅 자동시작(-AutoStart)
If WScript.Arguments.Count > 0 Then
  If LCase(WScript.Arguments(0)) = "auto" Then extra = " -AutoStart"
End If
sh.Run "powershell.exe -NoProfile -ExecutionPolicy Bypass -STA -File """ & ps1 & """" & extra, 0, False
