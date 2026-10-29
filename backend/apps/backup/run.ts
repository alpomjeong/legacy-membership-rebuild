import { PrismaClient } from '@prisma/client';
import { LocalFsSink } from '../../src/backup/sinks/local-fs.sink';
import { getModelPlans } from '../../src/backup/backup.plans';
import { FullBackupService } from '../../src/backup/full-backup.service';

/**
 * 온디맨드 전체 백업 CLI: `pnpm backup:run`
 * BACKUP_DIR(기본 ./backups)에 즉시 전체 스냅샷을 하나 만든다.
 */
async function main(): Promise<void> {
  const dir = process.env.BACKUP_DIR ?? './backups';
  const retention = Number(process.env.BACKUP_FULL_RETENTION_DAYS ?? 30);
  const prisma = new PrismaClient();
  try {
    const svc = new FullBackupService(
      prisma as never,
      new LocalFsSink(dir),
      getModelPlans(),
      {
        fullRetentionDays: Number.isFinite(retention) ? retention : 30,
      },
    );
    const run = await svc.run(new Date());
    console.log(`✔ 전체 백업 완료 → ${dir}/${run.file}`);
    console.log(`  ${run.rows}행 · ${run.bytes}바이트`);
  } finally {
    await prisma.$disconnect();
  }
}

void main();
