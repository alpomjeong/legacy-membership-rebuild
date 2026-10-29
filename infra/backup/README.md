# DB 백업 — pg_dump 기반 (Windows 온프레미스)

운영 DB(PostgreSQL, 로컬 PC 상주)를 **Postgres 표준 도구 `pg_dump`** 로 매일 백업한다.
스키마+데이터가 한 파일(`.dump`, 커스텀 포맷)에 자기완결로 담겨, 빈 DB에도 `pg_restore` 로 바로 복원된다.

> 앱 내장(NestJS) 백업 모듈에서 **pg_dump 방식으로 전환**한 버전이다. 둘을 동시에 돌리지 말 것 —
> 앱 백업은 `BACKUP_ENABLED=false` 로 끈다. (앱 내장 방식 설명은 `docs/05-백업운영-런북.md`)

## 구성 파일 (`infra/backup/`)
| 파일 | 역할 |
|---|---|
| `pg-backup.ps1` | pg_dump 전체 백업 + 보존정리 (스케줄러가 매일 호출) |
| `pg-restore.ps1` | 특정 `.dump` 로 복원(파괴적, `-Yes` 필수) |
| `register-task.ps1` | 위 백업을 Windows 작업 스케줄러에 매일 등록 |

> 🪟 **PostgreSQL을 아직 안 깔았거나 처음 세팅이면 → [`WINDOWS-SETUP.md`](./WINDOWS-SETUP.md)** (설치부터 자가진단·스케줄·복원까지 단계별).

## 사전 준비
1. **PostgreSQL 설치**(운영 DB와 동일 major, 예: 16) — 설치 시 `pg_dump.exe`/`pg_restore.exe` 가 같이 깔린다.
   - `bin` 폴더가 PATH 에 없으면 스크립트 `-PgBin "C:\Program Files\PostgreSQL\16\bin"` 로 지정.
2. **비밀번호 비대화식 설정**(스케줄 실행용) — 스크립트에 비번을 넣지 말 것.
   `%APPDATA%\postgresql\pgpass.conf` 파일에 한 줄:
   ```
   localhost:5432:<DB_NAME>:<DB_USER>:<DB_PASSWORD>
   ```
   (형식: `host:port:db:user:password`. 파일은 해당 Windows 사용자만 접근 가능하게 둘 것.)

## 설정 (관리자 PowerShell에서 1회)
```powershell
cd infra\backup

# 1) 즉시 1회 테스트 (백업 폴더는 외장/NAS 경로도 가능)
.\pg-backup.ps1 -Database temple -BackupDir "D:\temple-backups" -RetentionDays 30

# 2) 매일 새벽 3시 자동 실행 등록
.\register-task.ps1 -At "03:00" -BackupDir "D:\temple-backups" -RetentionDays 30 -Database temple
```
- PC가 3시에 꺼져 있어도 켜지면 실행됨(`StartWhenAvailable`).
- `-PgBin` 은 pg_dump 가 PATH 에 없을 때만 추가.

## 설치 검증 (자가진단) — 실 데이터 없이 파이프라인 확인
운영 DB에 손대기 전에, **임시 DB로 백업→복원→대조**를 1회 자동 수행해 스크립트가 이 PC에서
제대로 도는지 확인한다. (PostgreSQL 만 설치돼 있으면 됨)
```powershell
cd infra\backup
$env:PGPASSWORD = "<postgres비번>"     # 또는 pgpass.conf
.\selftest.ps1 -User postgres -PgBin "C:\Program Files\PostgreSQL\16\bin"
```
→ 임시 DB(bk_selftest_src/dst)를 만들어 3행을 넣고, 백업→빈 DB에 복원→`3,6000.50` 일치 확인 후
모두 정리. 마지막에 **`✔ PASS`** 가 뜨면 정상. (원본/운영 DB는 건드리지 않음)

## 백업 산출물
```
D:\temple-backups\
  full\  temple-20260701-030000.dump   ← 일일 스냅샷(pg_dump -Fc, 압축됨)
  logs\  backup-20260701.log           ← 실행 로그(성공/실패/바이트)
```

## 상태 확인 (모니터링)
```powershell
Get-ScheduledTask -TaskName TempleDbBackup | Get-ScheduledTaskInfo   # 마지막 실행결과·다음 실행
Get-Content D:\temple-backups\logs\backup-*.log -Tail 20            # 로그
Get-ChildItem D:\temple-backups\full | Sort-Object LastWriteTime -Descending  # 파일 목록
Start-ScheduledTask -TaskName TempleDbBackup                        # 지금 즉시 1회 실행
```

## 복원 (다시 올리기) — 파괴적
```powershell
# 대상 DB가 없으면 먼저: & "C:\Program Files\PostgreSQL\16\bin\createdb.exe" -U temple temple
.\pg-restore.ps1 -DumpFile "D:\temple-backups\full\temple-20260701-030000.dump" -Database temple -Yes
```
- `--clean --if-exists` 로 기존 객체를 지우고 덤프 시점으로 되돌린다.
- **빈 DB에도 복원됨**(스키마+데이터 자기완결). 복원 전 현재 상태를 한 벌 백업해두길 권장.

## 오프사이트 사본 (중요)
백업이 DB와 **같은 PC**에만 있으면 디스크 고장·랜섬웨어 시 함께 사라진다.
`-BackupDir` 를 **외장 드라이브/NAS 경로**로 지정하거나, 백업 폴더를 주기적으로 외장매체에 복사할 것.

## 범위 / 다음 단계
- 이 스크립트는 **일 1회 전체 백업**이다(요청 옵션 ①).
- **인풋마다(초 단위) 변경 백업**이 필요하면 → **WAL 아카이빙(PITR)** 을 추가로 세팅한다
  (`postgresql.conf` 의 `archive_mode`/`archive_command` + base backup). 별도 요청 시 정리.

## 검증 근거
pg16 컨테이너에서 라운드트립 실측: `pg_dump -Fc` → **빈 DB에 `pg_restore`** →
건수(member 103·reg 180·item 33)·Decimal 값 일치, 복원 exit 0.
