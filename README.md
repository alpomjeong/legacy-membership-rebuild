# 회원관리 레거시 재구축 — 포트폴리오 공개본

약 10년간 운영된 **설치형 회원관리 프로그램**(C# WinForms/DevExpress + MSSQL, 클라이언트가 DB 에 직접 접속)을
**PC 웹 · 모바일 앱 + REST API + PostgreSQL** 로 재구축한 프로젝트다.
설계 · 구현 · 데이터 이관 · 설치 · 운영까지 단독으로 진행했다.

> **이 저장소는 포트폴리오용 공개본이다.**
> 고객사 식별정보, 운영 자격증명, 운영 마스터 데이터는 모두 제거하거나 환경변수로 분리했다.
> 자세한 내용은 아래 [공개본에서 제거한 것](#공개본에서-제거한-것) 참고.

## 개요

| 항목 | 값 |
|---|---|
| 기간 | 2026-06-21 ~ 2026-08-16 (달력 8주 / 실작업 19일) |
| 규모 | 커밋 364 · 머지된 PR 71 · 테스트 274개(62 suite 전부 통과) |
| 코드 | 백엔드 14.5k · 웹 5.0k · 모바일 3.1k 줄 (TypeScript) |
| 데이터 | Prisma 모델 25개 |
| 역할 | 단독 (설계 · 구현 · 이관 · 설치 · 운영) |

## 왜 바꿨나

| 레거시 제약 | 전환 후 |
|---|---|
| PC 마다 프로그램 설치 | 브라우저 접속, 설치는 서버 1대만 |
| DB 접속정보가 클라이언트에 존재 | API 단일 경로, DB 는 로컬에만 노출 |
| 권한 분리 불가 | 전역 Guard + 역할별 권한 중앙 관리 |
| 외부에서 사용 불가 | Cloudflare Tunnel 로 HTTPS 외부 접속 |
| 백업이 수동 | 일일 자동 백업 + 변경분 저널 + 복구 서비스 |
| 모바일 미지원 | Expo 앱 + PWA |

## 저장소 구조

| 경로 | 내용 |
|---|---|
| `backend/` | **NestJS 11 · 4계층**(API → Application → Domain → Infrastructure) + Prisma 6 / PostgreSQL 16 |
| `backend/apps/migration/` | **데이터 이관** — MSSQL 직접 이관 + 엑셀 파이프라인 (parse → cleanse/map → validate → 멱등 적재) |
| `backend/apps/backup/` | pg_dump 전체 백업 · audit_log 변경분 저널 · 복구 CLI |
| `frontend/` | **Vite React PWA** — PC 웹. `react-grid-layout` 기반 "캔버스" 대시보드 |
| `mobile/` | **Expo (React Native)** — 모바일 앱 |
| `infra/` | 원클릭 설치(`native/start.bat`) · nssm 서비스 등록 · 백업 스크립트 · 운영 가이드 |
| `CLAUDE.md` | AI 작업 규칙 — ADR 규약 · TDD · evidence-first · GitFlow |

## 특히 봐주셨으면 하는 부분

| 주제 | 경로 |
|---|---|
| 이관을 **다시 돌릴 수 있게** 만든 설계 (DRY 모드 · 건수 검증 · FK 의존순 · 시퀀스 재설정) | `backend/apps/migration/mssql-migrate.cjs` |
| 엑셀 파이프라인과 **행 단위 검증 리포트** | `backend/apps/migration/{excel-parser,cleansing,validation-report,idempotent-loader}.ts` |
| **멱등 적재** (legacyKey 기준 upsert) | `backend/apps/migration/idempotent-loader.ts` |
| 전역 Guard 기반 **중앙 RBAC** (기본값 거부) | `backend/src/rbac/`, `backend/src/auth/` |
| 백업 · 복구 (암호화 + 변경분 저널) | `backend/apps/backup/`, `infra/backup/` |
| 순수 도메인 규칙과 단위 테스트 | `backend/libs/domain/src/*.ts` + `*.spec.ts` |

## 설계에서 지킨 원칙

- **평문 비밀번호는 옮기지 않는다.** 레거시 계정은 임시 비밀번호로 생성하고 최초 로그인 시 변경을 강제한다.
  레거시 백도어 계정은 이관 대상에서 제외한다.
- **레거시 숫자 PK 를 보존한다.** 기관이 수년간 장부와 대조해 온 회원번호 체계가 끊기지 않도록,
  PK 를 그대로 받고 적재 후 시퀀스를 재설정한다.
- **검증 없이 완료로 보지 않는다.** 추출 건수와 적재 건수가 다르면 실패로 끝낸다.
- **멱등성.** 같은 입력을 몇 번 넣어도 결과가 같다. 이관 중 끊겨도 처음부터 다시 돌릴 수 있다.
- **Docker 를 쓰지 않는다.** 설치 대상이 현장 PC 1대이고 유지보수를 비개발자가 맡는 환경이라,
  컨테이너 계층은 설명해야 할 개념과 실패 지점만 늘렸다. 네이티브 단일 트랙으로 전환했다.

## 빠른 시작 — 백엔드

```bash
cd backend
pnpm install --strict-peer-dependencies=false
cp .env.example .env        # DATABASE_URL · JWT 시크릿을 실제 값으로 채운다

pnpm prisma generate
pnpm prisma migrate dev
pnpm start:dev              # http://localhost:3000/health
pnpm test                   # 274 tests / 62 suites
pnpm lint && pnpm build
```

## 빠른 시작 — 프런트엔드

```bash
cd frontend
pnpm install --strict-peer-dependencies=false
pnpm dev      # Vite 개발 서버
pnpm build    # 프로덕션 빌드(PWA)
```

## 아키텍처

```
PC 웹 (React + Vite PWA)  ┐
모바일 앱 (Expo)           ├── HTTPS / JWT ──→  REST API (NestJS 11)  ──→  PostgreSQL 16
외부 접속 (CF Tunnel)      ┘                     API → Application          (현장 PC 1대 상주)
                                                → Domain → Infrastructure
                                                                             ↓
                                                              pg_dump 전체 백업 + audit_log delta
                                                              AES-256-GCM 암호화 보관
```

보안 베이스라인: JWT(Access + Refresh 회전) · argon2 해시 · 전역 `JwtAuthGuard` + `PermissionsGuard` 중앙 RBAC ·
로그인 스로틀 · RFC 7807 오류 형식 · Prisma 전 쿼리 파라미터화.

## CI

GitHub Actions — 백엔드 `lint` / `test` / `build`, 프런트 `build`, **gitleaks** 시크릿 스캔.

## 공개본에서 제거한 것

이 저장소는 실제 납품본에서 아래를 제거·외부화한 버전이다.

| 항목 | 처리 |
|---|---|
| 고객사명 | 전부 제거. 테넌트명은 `TENANT_NAME` 환경변수로 주입 (`backend/prisma/seed.ts`) |
| 마이그레이션 임시 비밀번호 | 상수 제거 → `MIGRATION_TEMP_PW` 환경변수. 미설정 시 매 실행 랜덤 생성 (`mssql-migrate.cjs`) |
| 레거시 MSSQL 접속정보 | 코드 기본값 제거 → `MSSQL_HOST` / `MSSQL_USER` / `MSSQL_DB` / `MSSQL_PW` **필수** 환경변수 |
| DB 계정 · 비밀번호 | 문서·예시의 실제 값을 `<DB_USER>` / `<DB_PASSWORD>` 플레이스홀더로 교체 |
| 내부 사설 IP | `<서버-IP>` / `<레거시-DB-IP>` 플레이스홀더로 교체 |
| 운영 마스터 데이터 | `infra/native/reference-seed.sql` 을 구조만 남긴 **샘플 데이터**로 교체 |
| 커밋 이력 | 고객사명이 포함된 메시지가 있어 이력을 재작성하지 않고 **새 이력으로 시작** |

시드 · 테스트에 들어 있는 개인정보는 전부 더미다 (`010-0000-0000`, `901010-1234567` 형태).
실제 회원 데이터는 저장소에 포함된 적이 없다.

---

**정승원** · jsw00415@gmail.com · [github.com/alpomjeong](https://github.com/alpomjeong)
