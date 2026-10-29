@echo off
chcp 65001 >nul
REM 불사 · 회원관리 - 서버 관리 GUI 실행 (무창 런처)
REM 한글 파일명(서버관리.vbs)을 cmd 리터럴로 넘기면 로케일에 따라 깨지므로,
REM 스크립트 폴더로 이동해 폴더 안 *.vbs 를 찾아 실행한다(파일명 인코딩 무관).
pushd "%~dp0"
for %%F in (*.vbs) do start "" wscript.exe "%%~fF"
popd
