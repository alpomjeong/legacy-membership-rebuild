/**
 * 시드 정책 — 온프레(절 PC 1대) 전제.
 *
 * `infra\native\start.bat` 은 서버가 뜰 때마다 seed 를 다시 돌린다(스키마·권한 누락 방지).
 * 그래서 시드는 **재실행해도 운영 상태를 되돌리지 않아야** 한다. 이 파일이 그 규칙을 담고,
 * `seed-policy.spec.ts` 가 회귀를 막는다.
 */

/**
 * admin 계정 upsert 인자.
 *
 * ⚠️ `update` 에 `passwordHash`/`mustResetPassword` 를 넣지 말 것.
 * 넣으면 매 기동 시드가 돌면서 운영자가 바꾼 비밀번호가 `admin1234` 로 원복되고
 * 강제변경 플래그까지 해제된다(재부팅만 하면 기본 계정으로 되돌아감).
 */
export function adminUpsertArgs(tenantId: bigint, passwordHash: string) {
  return {
    where: { tenantId_loginId: { tenantId, loginId: 'admin' } },
    // 기존 계정: 비활성화만 보정한다. 비밀번호·강제변경 플래그는 운영 상태 그대로 둔다.
    update: { isActive: true },
    // 신규 계정: 기본 비번(admin1234)으로 만들되 최초 로그인 시 변경을 강제한다(schema 기본값과 동일).
    create: {
      tenantId,
      loginId: 'admin',
      passwordHash,
      isActive: true,
      mustResetPassword: true,
    },
  };
}

/**
 * 샘플 업무데이터(포교원장 2명·회원 3명·불사목록 예시 3종) 적재 여부.
 *
 * 운영(`APP_ENV=production`)에는 넣지 않는다 — 실제 절 DB 에 가짜 회원이 남으면
 * 엑셀 이관 결과와 섞여 구분이 안 된다. 불사목록 마스터는 `infra/native/reference-seed.sql`(213종) + 별도 전달분
 * `reference-seed-private.sql`(개인 시주 항목 24종)이 담당.
 */
export function shouldSeedSampleBusinessData(
  env: NodeJS.ProcessEnv = process.env,
): boolean {
  return env.APP_ENV !== 'production';
}
