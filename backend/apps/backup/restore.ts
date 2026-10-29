import { PrismaClient } from '@prisma/client';
import { LocalFsSink } from '../../src/backup/sinks/local-fs.sink';
import { getModelPlans } from '../../src/backup/backup.plans';
import { RestoreService } from '../../src/backup/restore.service';

/**
 * 복원 CLI(파괴적 — 대상 DB 를 덤프 시점으로 되돌린다):
 *   pnpm backup:restore <base|파일> [--until <ISO>] --yes
 *
 * <base>  : 'temple-20260701-030000' 또는 'full/temple-....ndjson.gz' 경로 모두 허용
 * --until : 저널의 audit 행을 이 시각까지 합쳐 감사 추적을 완결(도메인 replay 아님, 런북 참조)
 * --yes   : 전체 테이블을 비우고 덮어쓰는 작업이라 명시 확인 필수
 */
function parseBase(input: string): string {
  return input
    .replace(/^full\//, '')
    .replace(/\.ndjson\.gz$/, '')
    .replace(/\.manifest\.json$/, '');
}

async function main(): Promise<void> {
  const args = process.argv.slice(2);
  const input = args.find((a) => !a.startsWith('--'));
  const yes = args.includes('--yes');
  const untilIdx = args.indexOf('--until');
  const until = untilIdx >= 0 ? new Date(args[untilIdx + 1]) : undefined;

  if (!input) {
    console.error('usage: backup:restore <base|파일> [--until <ISO>] --yes');
    console.error('  목록: pnpm backup:list');
    process.exitCode = 1;
    return;
  }
  if (!yes) {
    console.error(
      '⚠ 이 작업은 현재 DB 를 전부 덮어씁니다. 확인하려면 --yes 를 붙이세요.',
    );
    process.exitCode = 1;
    return;
  }
  if (until && Number.isNaN(until.getTime())) {
    console.error('--until 값이 올바른 ISO 시각이 아닙니다.');
    process.exitCode = 1;
    return;
  }

  const dir = process.env.BACKUP_DIR ?? './backups';
  const base = parseBase(input);
  const prisma = new PrismaClient();
  try {
    const svc = new RestoreService(
      prisma as never,
      new LocalFsSink(dir),
      getModelPlans(),
    );
    console.log(
      `복원 시작 — ${dir}/full/${base}.ndjson.gz${until ? ` (+저널 → ${until.toISOString()})` : ''}`,
    );
    const res = await svc.restore(base, { until });
    console.log('✔ 복원 완료 — 적재 건수:');
    for (const [t, n] of Object.entries(res)) console.log(`  ${t}: ${n}`);
  } finally {
    await prisma.$disconnect();
  }
}

void main();
