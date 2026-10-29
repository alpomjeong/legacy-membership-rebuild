# 운영 DB 백업 — 새 PC 설치·운영 매뉴얼

새 Windows PC에 PostgreSQL 16을 깔고 `temple` DB 백업을 **자가진단 → 백업 → 스케줄 → 복원**까지 세팅한다.
모든 명령은 **관리자 PowerShell**. `<...>` 는 실제 값으로 바꿔 읽는다.

**공통 값**

| 항목 | 값 |
|---|---|
| bin 경로 | `C:\Program Files\PostgreSQL\16\bin` |
| DB / 계정 | `temple` / `temple`, 슈퍼유저 `postgres` |
| 접속 | `localhost:5432` |
| 백업 폴더 | `D:\temple-backups` (외장/NAS 권장, 없으면 `C:\temple-backups`) |

---

## 1. PostgreSQL 16 설치

**GUI 설치(권장)** — [installer](https://www.postgresql.org/download/windows/) → 버전 16 → 구성요소에 **Command Line Tools 필수** → postgres 비번(ASCII) 지정 → 포트 5432.

**winget(빠름)**
```powershell
winget install -e --id PostgreSQL.PostgreSQL.16 --accept-package-agreements --accept-source-agreements `
  --override '--mode unattended --unattendedmodeui none --superpassword "MyPass123" --serverport 5432 --disable-components stackbuilder'
```
> ⚠️ 비번은 **영문·숫자만** (한글/특수문자·자리표시자 그대로 두면 인코딩 깨져 접속 불가).

**설치 확인**
```powershell
$env:Path += ";C:\Program Files\PostgreSQL\16\bin"
psql --version                                            # 16.x 나오면 OK
$env:PGPASSWORD="<postgres_비번>"; psql -U postgres -h localhost -c "SELECT 1;"
```
> 비번 모름/깨짐 → 관리자에서 `reset-pg-password.ps1` 실행(비번을 `1234`로 리셋, 부록 A).

---

## 2. 스크립트 받기
```powershell
git clone https://github.com/alpomjeong/temple-membership-install.git
cd temple-membership-install\infra\backup
Set-ExecutionPolicy -Scope Process Bypass; Get-ChildItem *.ps1 | Unblock-File
```
> 공개 저장소라 로그인 불필요. Git 이 없으면 GitHub 웹에서 **Code → Download ZIP** 으로 받아도 된다.
> 이미 설치를 마친 PC 라면 `<설치폴더>\infra\backup` 에 이미 있다.

---

## 3. 자가진단 ⭐ (PASS = 이 PC에서 백업/복원 정상)
```powershell
$env:PGPASSWORD="<postgres_비번>"
.\selftest.ps1 -User postgres -PgBin "C:\Program Files\PostgreSQL\16\bin"
```
> 마지막에 `✔ PASS` + `3,6000.50` 확인. 콘솔 한글 깨짐은 표시 문제(무관).
> `.\selftest.ps1` 못 찾으면 → 위 `cd` 로 **폴더 안에서** 실행했는지 확인.

---

## 4. temple DB 준비 & 데이터 이관
```powershell
$env:PGPASSWORD="<postgres_비번>"
psql -U postgres -h localhost -c "CREATE ROLE <DB_USER> LOGIN PASSWORD '<강력한-비밀번호>';"
psql -U postgres -h localhost -c "CREATE DATABASE <DB_NAME> OWNER <DB_USER>;"

# 이관할 덤프가 있으면 (커스텀 포맷 .dump)
pg_restore -U postgres -h localhost -d <DB_NAME> "C:\경로\temple_demo.dump"

# 검증
$env:PGPASSWORD="<DB_PASSWORD>"; psql -U <DB_USER> -h localhost -d <DB_NAME> -c "SELECT count(*) FROM member;"
```
> `pg_restore` 종료코드가 0이 아니어도 "없는 객체 DROP" 경고면 무해 — **데이터 건수로 판단**.

---

## 5. 무인 백업 준비(pgpass) + 실백업
```powershell
# 스케줄 실행 계정의 %APPDATA% 에 비번 저장 (스크립트에 비번 안 넣기)
"localhost:5432:<DB_NAME>:<DB_USER>:<DB_PASSWORD>" | Out-File -Encoding ascii "$env:APPDATA\postgresql\pgpass.conf"

# 실백업 1회
.\pg-backup.ps1 -Database temple -User temple -BackupDir "D:\temple-backups" -RetentionDays 30 -PgBin "C:\Program Files\PostgreSQL\16\bin"
```
> 산출물: `D:\temple-backups\full\temple-<날짜>.dump`, 로그 `...\logs\backup-<날짜>.log`.

---

## 6. 매일 자동 백업 (스케줄)
```powershell
.\register-task.ps1 -At "03:00" -BackupDir "D:\temple-backups" -RetentionDays 30 -Database temple -PgBin "C:\Program Files\PostgreSQL\16\bin"
Start-ScheduledTask -TaskName TempleDbBackup      # 즉시 테스트 (결과 0x0 = 성공)
```
**로그오프/잠금 중에도 실행(실서비스 필수)**: `taskschd.msc` → `TempleDbBackup` 우클릭 → 속성 →
**"사용자 로그온 여부와 관계없이 실행" + "가장 높은 권한"** → Windows 비번 입력.
(이 모드는 그 계정으로 도니 pgpass.conf도 그 계정 `%APPDATA%`에 있어야 함)

---

## 7. 복원 테스트 (파괴적 → 테스트 DB로)
```powershell
psql -U postgres -h localhost -c "CREATE DATABASE temple_restore_test;"
$dump = (Get-ChildItem D:\temple-backups\full\*.dump | Sort LastWriteTime -Desc | Select -First 1).FullName
.\pg-restore.ps1 -Database temple_restore_test -User postgres -DumpFile $dump -PgBin "C:\Program Files\PostgreSQL\16\bin" -Yes
psql -U postgres -h localhost -c "DROP DATABASE temple_restore_test;"
```

---

## 운영 체크리스트
- **오프사이트** 필수: `-BackupDir`를 외장/NAS로 (같은 PC만 두면 고장·랜섬웨어에 함께 소실)
- 매일 확인: 스케줄러 기록 `0x0` / `full\` 최신 날짜 파일 / `logs\` 로그
- 보존 30일 자동정리(`-RetentionDays`), 복원 훈련 월 1회

## 트러블슈팅
| 증상 | 해결 |
|---|---|
| `pg_dump/pg_restore 인식 안 됨` | `-PgBin "...\16\bin"` 지정 |
| `.\selftest.ps1 인식 안 됨` | 스크립트 폴더로 `cd` 후 실행 |
| `password authentication failed` | `$env:PGPASSWORD` 또는 pgpass.conf 확인 |
| winget 설치 후 접속 불가 | 비번에 한글/자리표시자 → 부록 A로 리셋 |
| pgAdmin `Errno 22 Invalid argument` | Backup Filename 앞 공백/상대경로 → 폴더버튼으로 지정 |
| 스케줄 안 돎(로그오프) | §6 "로그온 여부 관계없이 실행" |

---

## 부록 A — 비번 리셋 `reset-pg-password.ps1`
`pg_hba.conf`를 잠깐 `trust`로 바꿔 재시작 → `ALTER USER postgres PASSWORD '1234'` → 원복. **관리자 실행**:
```powershell
powershell -NoProfile -ExecutionPolicy Bypass -File .\reset-pg-password.ps1
```
> 테스트 PC 전용. 운영은 강한 비번 사용.

## 부록 B — pgAdmin 4 (GUI 조회·백업·복원)

**서버 등록(최초 1회)**: `Servers` 우클릭 → Register → Server

| 탭 | 필드 | 값 |
|---|---|---|
| General | Name | `local-temple` |
| Connection | Host / Port | `localhost` / `5432` |
| Connection | Username / Password | `postgres` / `<비번>` (Save 체크) |

**백업**: `temple` 우클릭 → Backup… → **Format=Custom** → Filename은 **폴더버튼(…)** 으로 지정
```
Filename : [ (비워두고 …클릭) ][…]      Format : [ Custom ▾ ]
   └ 파일창 → 경로 C:\temple-backups\full → File Name: temple-2026-07-01.dump
```
> ⚠️ Filename **앞 공백·절대경로 손타이핑 금지**(→ Errno 22), 파일명 **`:` 금지**(→`-`), Format **Custom**.

**복원**: 대상 DB 우클릭 → Restore… → Format Custom → 파일 선택 → (Options) *Clean before restore* / *Do not save owner*.

**처음 한 번 설정** (`File → Preferences → Paths`): Binary paths = `C:\Program Files\PostgreSQL\16\bin`, Storage = `C:\temple-backups\full`.
