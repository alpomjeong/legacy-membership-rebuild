/*
 * 업무 데이터 리셋 — 실서비스 전환/데모 정리용.
 *
 * 목적: 데모 더미(가짜 PII)나 이관 리허설 데이터를 비우고 실데이터를 적재하기 전 초기화.
 * 보존: 테넌트·RBAC(역할/권한/계정/메뉴)·공통코드·육십갑자·불사목록(마스터)·감사로그 등 시스템/마스터.
 * 삭제: 회원·불사 건·봉안일·상담·피안치자·포교원장·사원 등 업무(트랜잭션) 데이터.
 *   → 불사목록(마스터)은 보존하므로 리셋 후에도 불사 엑셀 업로드가 바로 매칭됨.
 *
 * 안전장치: 명시 확인 없이는 실행 거부. `--yes` 인자 또는 CONFIRM_RESET=YES.
 * 사용: CONFIRM_RESET=YES pnpm reset:business    (또는  pnpm reset:business --yes)
 */
import { PrismaClient } from '@prisma/client';

const prisma = new PrismaClient();


async function main() {
  const confirmed =
    process.argv.includes('--yes') || process.env.CONFIRM_RESET === 'YES';

  const before = await counts();
  console.log('현재 업무 데이터 행수:', before);

  if (!confirmed) {
    console.log(
      '\n⚠️  실제 삭제하려면 확인이 필요합니다.\n' +
        '   CONFIRM_RESET=YES pnpm reset:business   (또는  pnpm reset:business --yes)\n' +
        '   보존: 계정·역할·권한·메뉴·공통코드·육십갑자·불사목록(마스터)·감사로그\n' +
        '   삭제: 회원·불사 건·봉안일·상담·피안치자·포교원장·사원',
    );
    return;
  }

  // ⚠️ TRUNCATE CASCADE 금지: user_account.staff_id → staff FK 로 CASCADE 가 계정을 지운다.
  //    자식→부모 의존순 deleteMany 단일 트랜잭션. staff FK 는 ON DELETE SET NULL → 계정 보존.
  const tid = 1n;
  const w = { where: { tenantId: tid } };
  await prisma.$transaction([
    prisma.buddhistServiceReg.deleteMany(w),
    prisma.counsel.deleteMany(w),
    prisma.deceased.deleteMany(w),
    prisma.enshrinementEvent.deleteMany(w),
    prisma.member.deleteMany(w),
    prisma.missionary.deleteMany(w),
    prisma.staff.deleteMany(w),
  ]);

  const after = await counts();
  console.log('✅ 업무 데이터 리셋 완료. 남은 행수:', after);
  console.log(
    '다음 단계: (1) 필요 시 불사목록 마스터 확인/등록 → (2) 불사 엑셀 일괄 업로드로 실데이터 적재.',
  );
}

async function counts(): Promise<Record<string, number>> {
  const [member, reg, event, counsel, deceased, missionary, staff] =
    await Promise.all([
      prisma.member.count(),
      prisma.buddhistServiceReg.count(),
      prisma.enshrinementEvent.count(),
      prisma.counsel.count(),
      prisma.deceased.count(),
      prisma.missionary.count(),
      prisma.staff.count(),
    ]);
  return { member, reg, event, counsel, deceased, missionary, staff };
}

main()
  .catch((e) => {
    console.error(e);
    process.exitCode = 1;
  })
  .finally(() => void prisma.$disconnect());
