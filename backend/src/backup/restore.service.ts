import type { PrismaService } from '../prisma/prisma.service';
import type { BackupSink } from './sinks/backup-sink.interface';
import type { ModelPlan } from './backup-models';
import type { FieldTypes } from './backup-codec';
import { decodeRow } from './backup-codec';

const CHUNK = 1000;

type WriteDelegate = {
  deleteMany(args: Record<string, unknown>): Promise<unknown>;
  createMany(args: { data: Record<string, unknown>[] }): Promise<unknown>;
};

const chunks = <T>(arr: T[], size: number): T[][] => {
  const out: T[][] = [];
  for (let i = 0; i < arr.length; i += size) out.push(arr.slice(i, i + size));
  return out;
};

/**
 * RestoreService — 전체 덤프를 DB 로 되돌리고(옵션) 저널의 audit 행을 --until 까지 합쳐
 * 감사 추적을 완결한다. FK 순서 문제는 트랜잭션 내 session_replication_role=replica 로 우회.
 *
 * 주의: 저널 합치기는 audit_log(감사 추적) 완결용이며, 임의 도메인 상태의 자동 replay 는 아니다.
 * 도메인 시점복구는 가장 가까운 일일 덤프를 사용한다(런북 참조).
 */
export class RestoreService {
  private readonly fieldTypesByDelegate: Record<string, FieldTypes>;

  constructor(
    private readonly prisma: PrismaService,
    private readonly sink: BackupSink,
    private readonly plans: ModelPlan[],
  ) {
    this.fieldTypesByDelegate = Object.fromEntries(
      plans.map((p) => [p.delegate, p.fieldTypes]),
    );
  }

  /** full/<base>.ndjson.gz 를 델리게이트별로 그룹핑하고 원래 타입으로 디코딩한다. */
  async readDump(
    base: string,
  ): Promise<Map<string, Record<string, unknown>[]>> {
    const text = (await this.sink.readGzip(`full/${base}.ndjson.gz`)).toString(
      'utf8',
    );
    const groups = new Map<string, Record<string, unknown>[]>();
    for (const line of text.split('\n')) {
      if (!line.trim()) continue;
      const { t, r } = JSON.parse(line) as {
        t: string;
        r: Record<string, unknown>;
      };
      const decoded = decodeRow(r, this.fieldTypesByDelegate[t] ?? {});
      const arr = groups.get(t) ?? [];
      arr.push(decoded);
      groups.set(t, arr);
    }
    return groups;
  }

  /** 매니페스트에서 덤프 시점 커서(cursorAtDump)를 읽는다. */
  async readManifestCursor(base: string): Promise<bigint> {
    const m = JSON.parse(
      await this.sink.readText(`full/${base}.manifest.json`),
    ) as { cursorAtDump?: string };
    return BigInt(m.cursorAtDump ?? '0');
  }

  /** 저널 파일들에서 id>afterCursor 이고 occurredAt<=until 인 audit 행을 디코딩해 반환한다. */
  async readJournalAudit(
    afterCursor: bigint,
    until: Date,
  ): Promise<Record<string, unknown>[]> {
    const auditTypes = this.fieldTypesByDelegate['auditLog'] ?? {};
    const files = (await this.sink.list('journal'))
      .filter((f) => f.endsWith('.ndjson'))
      .sort();
    const rows: Record<string, unknown>[] = [];
    for (const f of files) {
      const text = await this.sink.readText(`journal/${f}`);
      for (const line of text.split('\n')) {
        if (!line.trim()) continue;
        const dec = decodeRow(
          JSON.parse(line) as Record<string, unknown>,
          auditTypes,
        );
        if (
          (dec.id as bigint) > afterCursor &&
          (dec.occurredAt as Date) <= until
        )
          rows.push(dec);
      }
    }
    rows.sort((a, b) => ((a.id as bigint) < (b.id as bigint) ? -1 : 1));
    return rows;
  }

  /** 모든 테이블을 비우고 그룹 데이터를 일괄 삽입한다(FK 트리거 비활성). */
  async load(
    groups: Map<string, Record<string, unknown>[]>,
  ): Promise<Record<string, number>> {
    const result: Record<string, number> = {};
    await (
      this.prisma as unknown as {
        $transaction(cb: (tx: unknown) => unknown): Promise<unknown>;
      }
    ).$transaction(async (txRaw) => {
      const tx = txRaw as {
        $executeRawUnsafe(sql: string): Promise<unknown>;
      } & Record<string, WriteDelegate>;
      // 복원 전용: FK 트리거를 트랜잭션 범위에서만 끈다(고정 문자열, 주입 표면 없음).
      await tx.$executeRawUnsafe(
        'SET LOCAL session_replication_role = replica',
      );
      for (const plan of this.plans) {
        await tx[plan.delegate].deleteMany({});
      }
      for (const [delegate, rows] of groups) {
        for (const part of chunks(rows, CHUNK)) {
          await tx[delegate].createMany({ data: part });
        }
        result[delegate] = rows.length;
      }
    });
    return result;
  }

  /** 오케스트레이션: 덤프 로드 (+ 옵션 저널 audit 합치기 → --until). */
  async restore(
    base: string,
    opts: { until?: Date } = {},
  ): Promise<Record<string, number>> {
    const groups = await this.readDump(base);
    if (opts.until) {
      const cursor = await this.readManifestCursor(base);
      const extra = await this.readJournalAudit(cursor, opts.until);
      if (extra.length) {
        const existing = groups.get('auditLog') ?? [];
        groups.set('auditLog', [...existing, ...extra]);
      }
    }
    return this.load(groups);
  }
}
