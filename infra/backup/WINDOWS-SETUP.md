# Windows PostgreSQL 설치 & 백업 테스트 가이드 (처음부터)

운영 PC(Windows)에 PostgreSQL을 깔고, `infra/backup/`의 pg_dump 백업 스크립트를
**자가진단 → 실백업 → 자동 스케줄 → 복원**까지 검증하는 순서. 명령은 **관리자 PowerShell**에서 실행.

> 버전은 현재 데이터(**PostgreSQL 16**)에 맞춰 **16.x**를 설치한다(복원 호환성).

---

## 1. PostgreSQL 16 설치

1. 다운로드: <https://www.postgresql.org/download/windows/> → **"Download the installer"**(EDB) → **버전 16** 선택.
2. 설치 마법사에서:
   - **설치 구성요소**: `PostgreSQL Server`, **`Command Line Tools`**(← `psql`/`pg_dump`/`pg_restore` 포함, 필수), `pgAdmin 4`(선택). `Stack Builder`는 체크 해제해도 됨.
   - **설치 경로**: 기본 `C:\Program Files\PostgreSQL\16`.
   - **Data 디렉터리**: 기본값 또는 데이터 드라이브(예: `D:\pgdata`).
   - **슈퍼유저(postgres) 비밀번호**: 정하고 **꼭 기억**(뒤에서 씀).
   - **포트**: 기본 `5432`.
   - **로캘**: `Korean, Korea` 또는 `Default locale`.
3. 완료. (Stack Builder 실행 화면이 뜨면 취소해도 됨)

설치 후 `bin` 경로: **`C:\Program Files\PostgreSQL\16\bin`** — `psql.exe`, `pg_dump.exe`, `pg_restore.exe`가 여기 있다.

---

## 2. 설치 확인

관리자 PowerShell을 새로 열고:
```powershell
# bin이 PATH에 없으면 이번 세션에만 추가(설치 경로에 맞게)
$env:Path += ";C:\Program Files\PostgreSQL\16\bin"

psql --version        # psql (PostgreSQL) 16.x
pg_dump --version     # pg_dump (PostgreSQL) 16.x
```
> **PATH 영구 등록**(선택): 설정 → 시스템 → 정보 → 고급 시스템 설정 → 환경 변수 → `Path`에 위 bin 추가.
> 안 하면 스크립트에 매번 `-PgBin "C:\Program Files\PostgreSQL\16\bin"` 를 붙이면 된다.

접속 테스트:
```powershell
$env:PGPASSWORD = "<설치때_정한_postgres_비번>"
psql -U postgres -h localhost -c "SELECT version();"
```
버전 문자열이 나오면 설치 성공.

---

## 3. 백업 스크립트 가져오기

설치본 리포에 들어 있다. **이미 설치를 마친 PC 라면** `<설치폴더>\infra\backup` 으로 가면 끝이다.

**Git이 없으면** ZIP 으로 받아도 된다 —
<https://github.com/alpomjeong/temple-membership-install> → **Code** → **Download ZIP**.
(Git 설치는 <https://git-scm.com/download/win>, 설치 후 PowerShell 새로 열기 → `git --version` 확인)

### 3-A. 이 PC에 저장소가 없을 때 — 새로 클론
```powershell
cd C:\        # 원하는 상위 폴더로
git clone https://github.com/alpomjeong/temple-membership-install.git
cd temple-membership-install\infra\backup
```

### 3-B. 이미 저장소가 있을 때 — 최신화
```powershell
cd C:\경로\temple-membership-install
git pull
cd infra\backup
```

### 확인
```powershell
dir            # pg-backup.ps1 · pg-restore.ps1 · register-task.ps1 · selftest.ps1 · README.md 가 보여야 함
```
> 공개 저장소라 로그인 없이 받아진다.

---

## 4. PowerShell 실행 정책

다운로드/복사한 .ps1이 차단될 수 있다. 둘 중 하나:
```powershell
# (A) 이번 세션만 허용 — 가장 간단
Set-ExecutionPolicy -Scope Process -ExecutionPolicy Bypass

# (B) 파일 차단 해제(원격 다운로드 표시 제거)
Get-ChildItem *.ps1 | Unblock-File
```

---

## 5. 자가진단 — 실 데이터 없이 파이프라인 확인 ★

**여기서 `✔ PASS`가 뜨면 이 PC에서 백업/복원이 정상 동작하는 것.** (임시 DB만 쓰고 자동 정리)
```powershell
$env:PGPASSWORD = "<postgres_비번>"
.\selftest.ps1 -User postgres -PgBin "C:\Program Files\PostgreSQL\16\bin"
```
출력 예:
```
  1) 원본 DB 생성 + 3행 삽입
  2) 백업 완료 → C:\Users\...\temple-bk-selftest\full\temple-....dump
  3) 빈 DB에 복원
  4) 복원 결과: 3,6000.50  (기대: 3,6000.50)
✔ PASS — 백업/복원 파이프라인 정상
```
PATH에 bin을 영구 등록했으면 `-PgBin` 은 생략 가능.

---

## 6. 실 DB 준비 & 비밀번호 설정

**운영 DB(`temple`)** 를 이 PC의 PostgreSQL에 두는 경우:
- 새로 만들 거면: `psql -U postgres -h localhost -c "CREATE USER temple WITH PASSWORD '...'; CREATE DATABASE <DB_NAME> OWNER <DB_USER>;"`
  그리고 앱 마이그레이션/데이터 적재는 별도(부록 참고).
- 이미 있으면 그대로 사용.

**스케줄 실행용 비밀번호(pgpass.conf)** — 스크립트에 비번을 넣지 않기 위함:
```powershell
$dir = "$env:APPDATA\postgresql"
New-Item -ItemType Directory -Force -Path $dir | Out-Null
# 형식: host:port:db:user:password  (한 줄)
"localhost:5432:<DB_NAME>:<DB_USER>:<DB_PASSWORD>" | Out-File -Encoding ascii "$dir\pgpass.conf"
```
> pgpass.conf 는 **작업을 실행할 Windows 사용자 계정의 %APPDATA%** 에 있어야 한다(§8 참고).

---

## 7. 실백업 1회 테스트
```powershell
.\pg-backup.ps1 -Database temple -DbHost localhost -Port 5432 -User temple `
                -BackupDir "D:\temple-backups" -RetentionDays 30
Get-ChildItem D:\temple-backups\full          # temple-....dump 생성 확인
Get-Content   D:\temple-backups\logs\backup-*.log -Tail 5
```
`-BackupDir` 를 **외장 드라이브/NAS 경로**로 주면 오프사이트 사본을 겸한다.

---

## 8. 매일 자동 실행 등록
```powershell
.\register-task.ps1 -At "03:00" -BackupDir "D:\temple-backups" -RetentionDays 30 -Database temple `
                    -PgBin "C:\Program Files\PostgreSQL\16\bin"

Get-ScheduledTask -TaskName TempleDbBackup | Get-ScheduledTaskInfo   # 다음 실행/마지막 결과
Start-ScheduledTask -TaskName TempleDbBackup                          # 지금 즉시 1회 테스트
```
- PC가 3시에 꺼져 있으면 **켜진 뒤 실행**(StartWhenAvailable).
- **주의(로그오프 시)**: 기본 등록은 그 작업을 만든 사용자 계정으로 돈다. PC가 켜져 있되
  **로그오프/잠금 상태에서도** 돌게 하려면, 작업 스케줄러 GUI에서 해당 작업 → 속성 →
  **"사용자의 로그온 여부에 관계없이 실행"** 으로 바꾸고 비밀번호를 저장한다.
  (그 경우 pgpass.conf는 그 계정 %APPDATA%에 있어야 함)

---

## 9. 복원 테스트 (선택, 파괴적)
실제 복원은 대상 DB를 덮어쓰므로 **테스트 DB로** 먼저 연습 권장:
```powershell
psql -U postgres -h localhost -c "CREATE DATABASE temple_restore_test;"
$dump = (Get-ChildItem D:\temple-backups\full\*.dump | Sort-Object LastWriteTime -Desc | Select-Object -First 1).FullName
.\pg-restore.ps1 -Database temple_restore_test -User postgres -DumpFile $dump -Yes
psql -U postgres -h localhost -d temple_restore_test -c "\dt"   # 테이블 복원 확인
psql -U postgres -h localhost -c "DROP DATABASE temple_restore_test;"
```

---

## 10. 자주 겪는 문제
| 증상 | 원인 / 해결 |
|---|---|
| `pg_dump : 명령을 찾을 수 없음` | bin이 PATH에 없음 → `-PgBin "...\16\bin"` 추가 또는 PATH 등록 |
| `password authentication failed` | 비번 틀림/미설정 → `$env:PGPASSWORD` 또는 pgpass.conf 확인 |
| 스크립트 실행 차단 | §4의 `Set-ExecutionPolicy -Scope Process Bypass` |
| `pg_dump: server version mismatch` | 서버보다 낮은 pg_dump → 서버와 **같은 major(16)** 클라이언트 사용 |
| 스케줄이 안 돎(로그오프) | §8의 "로그온 여부 관계없이 실행" 설정 |
| pg_restore 종료코드 ≠ 0인데 데이터는 정상 | 없는 객체 DROP 경고는 무해(빈 DB 복원 시 정상). 로그 확인 |

---

## 부록 — 기존 데이터를 이 PC로 옮기기
현재 운영/데모 데이터가 다른 곳(예: 개발용 도커 PostgreSQL)에 있으면, 그쪽에서 덤프를 떠서
이 PC로 복원한다:
```powershell
# (원본 쪽에서)  pg_dump -Fc -d temple -f temple.dump   →  파일을 이 PC로 복사
# (이 PC에서)
psql -U postgres -h localhost -c "CREATE DATABASE <DB_NAME> OWNER <DB_USER>;"
pg_restore -U postgres -h localhost -d <DB_NAME> --no-owner temple.dump
```
그 다음부터는 §7~8의 일일 백업이 이 DB를 대상으로 돌면 된다.
