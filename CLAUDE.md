# 회원관리 시스템 — 프로젝트 가이드

레거시 Windows 데스크톱(C# WinForms/DevExpress + MSSQL, 클라이언트 DB 직접접속)을
**PC 웹·모바일**(React + NestJS + PostgreSQL)로 재구축하는 프로젝트.
운영은 **온프레미스 네이티브 단일 트랙**(절 PC 1대, PostgreSQL 16 + Node 20 — 도커/Redis/MinIO 트랙 폐기, 2026-07).

## 권위 문서 — **`internal-docs` 브랜치**에 있음 (dev/main 에는 없음)
개발 문서는 `dev`·`main` 에서 제외했다. 절 PC 에 설치할 때 리포를 통째로 clone/ZIP 하므로,
내부 분석·기획 문서가 고객 PC 에 깔리기 때문(2026-08-14). 문서는 `internal-docs` 브랜치에 보존.

읽기(체크아웃 불필요, 필요 섹션만 — 1,400줄짜리 02/03을 통째 로드하지 말 것):
```bash
git fetch origin internal-docs
git show origin/internal-docs:docs/09-진행현황-종합.md
```
편집은 별도 워크트리로: `git worktree add ../temple-docs internal-docs`

- `docs/01-AS-IS-분석서.md` — 레거시 현행 분석(데이터모델·도메인규칙·전환과제)
- `docs/02-PRD-웹모바일-리뉴얼.md` — 요구사항(FR/NFR/DM/MAP ID, P0~P3)
- `docs/03-구현계획.md` — 에픽/태스크 분해(E0.x, E1.x …, 마일스톤 M0~M5)
- `docs/adr/0001-architecture-decisions.md` — 핵심 아키텍처 결정
- `docs/09-진행현황-종합.md` — **현재 진행 상태(먼저 읽기)** (`docs/04`=Phase 0, `docs/05`=Phase 1 이력)

> 설치·운영 문서는 고객도 봐야 하므로 `infra/` 에 그대로 둔다
> (`infra/native/네이티브-설치-가이드.md`, `infra/운영-배포-가이드.md`, `infra/backup/`).

## 리포 구조
- `backend/` NestJS 11: `src`(=apps/api) · `libs/{domain,application,infrastructure}` · `apps/migration` · `prisma/`
- `frontend/` Vite + React + TS + PWA — **PC 웹(데스크톱 반응형), 실제 업무 프론트엔드**
- `mobile/` Expo(React Native) — 모바일 네이티브 앱
- `infra/` 네이티브 실행(`native/start.bat`·`.env`·설치 가이드) · 운영-배포-가이드 · `backup/` 스크립트 · secrets.template
- `mockup/` 바닐라 HTML 흐름 목업 — 내부 참고용, `.gitattributes` export-ignore 로 배포본 제외
  (개발 문서는 `internal-docs` 브랜치)

## 공개 배포본 — 실인물 정보 반입 금지
설치 편의를 위해 **공개 리포**를 따로 둔다. 이 리포(비공개)에서 배포본을 뜨는 법:
```bash
git archive --format=tar HEAD | tar -x -C <새폴더>   # .gitattributes export-ignore 적용
```
- `infra/native/reference-seed.sql` = 실명 없는 불사목록 213종 + 공통코드. **공개 가능**.
- `infra/native/reference-seed-private.sql` = 개인 시주 항목 24종(항목명에 시주자 실명).
  **export-ignore — 공개 금지.** 절 PC 에는 파일로 직접 전달해 `infra\native\` 에 두면
  `start.bat`·`newpc-install.ps1` 이 자동 적재한다. 없으면 불사 건 342행이 업로드에서 거부된다.
- 새 픽스처·목업에 **실제 회원/시주자 이름·전화·주소를 쓰지 말 것**(홍길동·010-0000-0000 류만).
  UI placeholder 는 tree-shaking 대상이 아니라 그대로 번들에 실린다 — 특히 주의.

## 스택·규약 (ADR 0001)
- 백엔드 **NestJS 11 / TS strict**, ORM **Prisma 6 고정**(7 실험적 금지) + **PostgreSQL**
- 모델 PascalCase · 물리 snake_case(`@map/@@map`) · PK **`BigInt`** · 전 엔티티 **TenantId·감사(created/updated by)·소프트삭제·timestamptz**
- 인증 **JWT(access+refresh) + argon2**, 하드코딩 백도어 0. 인가 **중앙 RBAC 서버사이드 강제**(전역 `JwtAuthGuard`+`PermissionsGuard`, `@RequirePermissions('자원:액션')`, `@Public`)
- 전 쿼리 **Prisma 파라미터화**(인라인 문자열 SQL 금지) · 오류 **RFC7807** · 로깅 **Pino**(traceId) · OpenAPI `/api/docs` · prefix `/api/v1`
- 시크릿: `.env`(로컬·커밋금지) / `infra/secrets.template` / 운영=시크릿 매니저

## 작업 방식
- **TDD**(실패 테스트 먼저 → 구현 → 리팩터). 에픽 단위로 자주 커밋. **evidence-first**(검증 명령 출력 확인 후 완료 선언).
- 패키지매니저 **pnpm**. 네이티브 빌드 막히면(`ERR_PNPM_IGNORED_BUILDS`) `backend/pnpm-workspace.yaml` 의 `allowBuilds:` 에 패키지 추가(텔레메트리는 `false`).
- 로컬 Node 24라 pnpm 11 동작하지만 **CI는 node 20 → `pnpm@10.34.3` 고정**(이미 반영). 변경 금지.
- 커밋 메시지 끝에 `Co-Authored-By: Claude Opus 4.8 (1M context) <noreply@anthropic.com>`.

## 검증 명령 (`backend/`)
```bash
pnpm install --strict-peer-dependencies=false
pnpm prisma generate
pnpm lint && pnpm test && pnpm build      # 게이트
pnpm exec tsc -p tsconfig.json --noEmit   # apps/ 포함 전체 타입체크
pnpm migrate <path.xlsx>                  # 마이그레이션 CLI(드라이런)
pnpm prisma:seed                          # RBAC 역할/권한 시드(DB 필요)
```
로컬 DB: 로컬 PostgreSQL 16 (`temple` DB/계정). 운영 실행: `infra\native\start.bat`(가이드 `infra/native/네이티브-설치-가이드.md`)

## 브랜치 플로우 (GitFlow)
- `main`(릴리스) ← `dev`(통합) ← `feat/*`(기능)
- 기능은 **`dev`에서 분기 → `dev`로 PR 머지**. main 직접 커밋 금지.

## 현재 상태
- **Phase 0·Phase 1 MVP 완료** + 보안/계정 하드닝·백업(AES-256-GCM)·온프레미스 네이티브 전환·모바일 앱 빌드 준비까지 `dev` 머지됨(~PR #47). 상세는 `docs/09`.
- 잔여: 외부 사업자 의존(카카오 알림톡·KASI 음력, Phase 2) · 봉안일(기일) 구조 재협의(`docs/09` §3-C) · 실사용 UX 피드백 반영.
