import type { PrismaService } from '../prisma/prisma.service';
import type { BackupSink } from './sinks/backup-sink.interface';
import type { ModelPlan } from './backup-models';
import { encodeRow } from './backup-codec';
import {
  appendRun,
  loadState,
  saveState,
  type BackupRun,
} from './backup-state';

export interface FullBackupConfig {
  /** 보존할 최근 전체 백업(≈일) 개수. 이보다 오래된 덤프는 정리. */
  fullRetentionDays: number;
}

type ReadDelegate = {
  findMany(args?: unknown): Promise<Record<string, unknown>[]>;
};

export const pad = (n: number, w = 2): string => String(n).padStart(w, '0');

/** UTC 기준 YYYYMMDD-HHmmss */
export function stamp(d: Date): string {
  return (
    `${d.getUTCFullYear()}${pad(d.getUTCMonth() + 1)}${pad(d.getUTCDate())}` +
    `-${pad(d.getUTCHours())}${pad(d.getUTCMinutes())}${pad(d.getUTCSeconds())}`
  );
}

/**
 * FullBackupService — 전 테이블을 Prisma 로 읽어 gzip NDJSON 스냅샷으로 저장한다(일 1회).
 * 각 라인: {"t":"<delegate>","r":<인코딩된 행>}. 덤프 시점의 audit_log 최대 id 를
 * 매니페스트에 남겨(=cursorAtDump) 복원 시 저널을 이어붙일 수 있게 한다.
 */
export class FullBackupService {
  constructor(
    private readonly prisma: PrismaService,
    private readonly sink: BackupSink,
    private readonly plans: ModelPlan[],
    private readonly config: FullBackupConfig,
  ) {}

  private delegate(name: string): ReadDelegate {
    return (this.prisma as unknown as Record<string, ReadDelegate>)[name];
  }

  private async currentAuditCursor(): Promise<string> {
    const top = await (
      this.prisma as unknown as {
        auditLog: { findFirst(args: unknown): Promise<{ id: bigint } | null> };
      }
    ).auditLog.findFirst({ orderBy: { id: 'desc' }, select: { id: true } });
    return String(top?.id ?? 0n);
  }

  async run(now: Date = new Date()): Promise<BackupRun> {
    const base = `temple-${stamp(now)}`;
    const dumpPath = `full/${base}.ndjson.gz`;
    const manifestPath = `full/${base}.manifest.json`;

    const cursorAtDump = await this.currentAuditCursor();
    const tables: Record<string, number> = {};
    const lines: string[] = [];
    for (const plan of this.plans) {
      // NOTE: 대용량 테이블은 향후 커서 페이지네이션으로 강화 가능(현재는 일괄 read).
      const rows = await this.delegate(plan.delegate).findMany();
      tables[plan.delegate] = rows.length;
      for (const row of rows) {
        lines.push(
          JSON.stringify({
            t: plan.delegate,
            r: encodeRow(row, plan.fieldTypes),
          }),
        );
      }
    }

    const written = await this.sink.writeGzip(
      dumpPath,
      lines.join('\n') + '\n',
    );
    await this.sink.writeText(
      manifestPath,
      JSON.stringify(
        {
          createdAt: now.toISOString(),
          format: 'ndjson-v1',
          cursorAtDump,
          tables,
        },
        null,
        2,
      ),
    );
    await this.pruneOld();

    const rowsTotal = Object.values(tables).reduce((a, b) => a + b, 0);
    const run: BackupRun = {
      type: 'full',
      at: now.toISOString(),
      file: dumpPath,
      bytes: written.bytes,
      rows: rowsTotal,
      ok: true,
    };
    const state = await loadState(this.sink);
    await saveState(this.sink, {
      ...appendRun(state, run),
      lastFullBackupAt: now.toISOString(),
    });
    return run;
  }

  /** 최신 N개 전체 백업만 남기고 나머지 덤프·매니페스트를 정리한다. */
  private async pruneOld(): Promise<void> {
    const gz = (await this.sink.list('full'))
      .filter((f) => f.endsWith('.ndjson.gz'))
      .sort(); // 파일명이 타임스탬프라 사전순 = 시간순
    const stale = gz.slice(
      0,
      Math.max(0, gz.length - this.config.fullRetentionDays),
    );
    for (const f of stale) {
      const b = f.replace(/\.ndjson\.gz$/, '');
      await this.sink.remove(`full/${b}.ndjson.gz`);
      await this.sink.remove(`full/${b}.manifest.json`);
    }
  }
}
