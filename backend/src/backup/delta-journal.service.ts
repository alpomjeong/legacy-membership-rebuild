import type { PrismaService } from '../prisma/prisma.service';
import type { BackupSink } from './sinks/backup-sink.interface';
import type { FieldTypes } from './backup-codec';
import { encodeRow } from './backup-codec';
import { appendRun, loadState, saveState } from './backup-state';
import { pad } from './full-backup.service';

const BATCH = 1000;

const dayStamp = (d: Date): string =>
  `${d.getUTCFullYear()}${pad(d.getUTCMonth() + 1)}${pad(d.getUTCDate())}`;

type AuditDelegate = {
  findMany(args: {
    where: { id: { gt: bigint } };
    orderBy: { id: 'asc' };
    take: number;
  }): Promise<Record<string, unknown>[]>;
};

/**
 * DeltaJournalService — 마지막 커서 이후의 audit_log 신규 행을 일자별 저널 파일에 append 하고
 * 커서를 전진시킨다(변경점 델타 백업). audit_log 는 이미 서비스들이 채우므로 서비스 코드 무수정.
 * 커서가 진실의 원천이라 프로세스가 죽어도 다음 flush 에서 빠진 구간을 그대로 이어간다(무손실).
 */
export class DeltaJournalService {
  private running = false;

  constructor(
    private readonly prisma: PrismaService,
    private readonly sink: BackupSink,
    private readonly auditFieldTypes: FieldTypes,
  ) {}

  private get audit(): AuditDelegate {
    return (this.prisma as unknown as { auditLog: AuditDelegate }).auditLog;
  }

  async flush(
    now: Date = new Date(),
  ): Promise<{ exported: number; cursor: string }> {
    if (this.running)
      return { exported: 0, cursor: (await loadState(this.sink)).cursor };
    this.running = true;
    try {
      let state = await loadState(this.sink);
      let cursor = BigInt(state.cursor);
      const journalPath = `journal/audit-${dayStamp(now)}.ndjson`;
      let exported = 0;

      for (;;) {
        const rows = await this.audit.findMany({
          where: { id: { gt: cursor } },
          orderBy: { id: 'asc' },
          take: BATCH,
        });
        if (rows.length === 0) break;
        const text =
          rows
            .map((r) => JSON.stringify(encodeRow(r, this.auditFieldTypes)))
            .join('\n') + '\n';
        await this.sink.appendText(journalPath, text);
        cursor = rows[rows.length - 1].id as bigint;
        exported += rows.length;
        if (rows.length < BATCH) break;
      }

      if (exported > 0) {
        state = {
          ...appendRun(state, {
            type: 'delta',
            at: now.toISOString(),
            file: journalPath,
            rows: exported,
            ok: true,
          }),
          cursor: String(cursor),
        };
        await saveState(this.sink, state);
      }
      return { exported, cursor: String(cursor) };
    } finally {
      this.running = false;
    }
  }

  /** 최신 keep 개 저널만 남기고 오래된 일자 저널을 정리한다. */
  async pruneJournals(keep: number): Promise<void> {
    const files = (await this.sink.list('journal'))
      .filter((f) => f.endsWith('.ndjson'))
      .sort();
    for (const f of files.slice(0, Math.max(0, files.length - keep))) {
      await this.sink.remove(`journal/${f}`);
    }
  }
}
