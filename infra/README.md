# infra — 온프레미스(네이티브 Windows) 운영 인프라

운영은 **네이티브 단일 트랙**: 절 PC 1대에 **PostgreSQL 16 + Node 20** 만 설치해 구동한다.
Docker·Redis·MinIO 트랙은 폐기됨(2026-07, 단일 PC 소규모 운영에 불필요).
구성: **Postgres(DB) + Node(API + pc-web 정적 서빙, 단일 포트 8080) + 로컬 파일 저장**.

## 구성

| 경로 | 용도 |
| --- | --- |
| `native/네이티브-설치-가이드.md` | **설치·실행 가이드(여기서 시작)** |
| `native/start.bat` | 원클릭 실행(마이그레이션 + 시드 + 서버 기동) |
| `native/.env.example` | 실행 설정 템플릿 → `native\.env` 로 복사해 채움(커밋 금지) |
| `운영-배포-가이드.md` | 상시 가동·시크릿·외부 HTTPS(Cloudflare Tunnel)·백업 운영 |
| `backup/` | pg_dump 백업·복원·오프사이트 복사 스크립트(PowerShell/bat) + 매뉴얼 |
| `secrets.template` | 시크릿 키 목록(값 없음, 평문 커밋 금지) |

## 빠른 시작

1. PostgreSQL 16 + Node 20 설치, `temple` DB/계정 생성 — `native/네이티브-설치-가이드.md` §1
2. `backend`·`frontend` 빌드 — 가이드 §2
3. `copy infra\native\.env.example infra\native\.env` 후 값 채우기 — 가이드 §3
4. `infra\native\start.bat` 더블클릭 → `http://localhost:8080`

## 개발용 DB

로컬 개발도 동일하게 **로컬 PostgreSQL 16** 을 사용한다(`backend/.env.example` 의 `DATABASE_URL` 참고).

## 시크릿

`secrets.template` 의 키를 `infra\native\.env` 로 주입한다. 평문 커밋 금지(ADR 0001 §6, NFR-SEC-13).
`APP_ENV=production` 이면 기본/미설정 시크릿일 때 API 가 부팅을 거부한다(fail-closed).
