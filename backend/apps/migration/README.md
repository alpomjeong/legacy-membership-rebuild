# apps/migration — 마이그레이션 파이프라인 (E0.7 골격)

레거시 운영 Excel(불사명단) → 정제·검증 → (멱등) 적재 파이프라인. ACE/Jet **OLEDB 폐기**, OpenXML(ExcelJS).

## 단계
1. **parse** (`excel-parser.ts`) — xlsx 버퍼 → 행 객체(헤더 기준, 단번호 선행 0 보존)
2. **cleanse/map** (`cleansing.ts`, `bulsa-mapper.ts`) — 12성주 공백·영가 구분자 정규화, 날짜 strict 파싱(모호=오류), 취소/증서 boolean
3. **validate** (`validation-report.ts`) — 행 단위 정상/경고/오류 리포트(행번호·원본값·사유)
4. **load** (`idempotent-loader.ts`) — legacyKey 기준 **멱등**(재실행 증분 0). dryRun 기본.

## 실행
```bash
pnpm migrate <path.xlsx>          # 드라이런(검증 리포트만)
pnpm migrate <path.xlsx> --load   # 적재(골격: 인메모리 스토어)
```

## Phase 경계
- **Phase 0(현재)**: 파이프라인 골격 + **샘플 검증 리포트**까지(문서 §9 M1~M3 경계). 전 입력 파라미터화(문자열 보간 0).
- **Phase 1**: 실제 업무 엔티티(Member/BuddhistServiceReg) Prisma `$transaction` 적재, 전량(약 1.4만 행) 컷오버, `.bak` 교차검증.
- **보안**: 평문 비밀번호 이관 금지(재설정 강제), 주민번호 암호화, 백도어 미이관(MAP-29/30/24).
