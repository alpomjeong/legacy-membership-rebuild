import { mkdtemp, rm } from 'node:fs/promises';
import { tmpdir } from 'node:os';
import { join } from 'node:path';
import { LocalFsSink } from './sinks/local-fs.sink';
import { DeltaJournalService } from './delta-journal.service';
import { loadState } from './backup-state';
import type { FieldTypes } from './backup-codec';

const auditTypes: FieldTypes = {
  id: 'BigInt',
  actionType: 'String',
  beforeJson: 'Json',
  occurredAt: 'DateTime',
};

const AUDIT = [
  {
    id: 5n,
    actionType: 'member.create',
    beforeJson: null,
    occurredAt: new Date('2026-07-01T10:00:01Z'),
  },
  {
    id: 6n,
    actionType: 'member.update',
    beforeJson: { a: 1 },
    occurredAt: new Date('2026-07-01T10:00:02Z'),
  },
  {
    id: 7n,
    actionType: 'reg.create',
    beforeJson: null,
    occurredAt: new Date('2026-07-01T10:00:03Z'),
  },
];

const makePrisma = () => ({
  auditLog: {
    findMany: jest.fn((args: { where: { id: { gt: bigint } }; take: number }) =>
      Promise.resolve(
        AUDIT.filter((r) => r.id > args.where.id.gt).slice(0, args.take),
      ),
    ),
  },
});

describe('DeltaJournalService', () => {
  let root: string;
  let sink: LocalFsSink;

  beforeEach(async () => {
    root = await mkdtemp(join(tmpdir(), 'bk-delta-'));
    sink = new LocalFsSink(root);
  });
  afterEach(async () => {
    await rm(root, { recursive: true, force: true });
  });

  it('exports new audit rows since cursor into a daily journal and advances the cursor', async () => {
    const prisma = makePrisma();
    const svc = new DeltaJournalService(prisma as never, sink, auditTypes);
    const res = await svc.flush(new Date('2026-07-01T10:00:05Z'));

    expect(res.exported).toBe(3);
    expect(res.cursor).toBe('7');

    // 첫 조회는 cursor 0 이후
    expect(prisma.auditLog.findMany.mock.calls[0][0].where).toEqual({
      id: { gt: 0n },
    });

    const journal = await sink.readText('journal/audit-20260701.ndjson');
    const lines = journal
      .trim()
      .split('\n')
      .map((l) => JSON.parse(l));
    expect(lines).toHaveLength(3);
    expect(lines[0]).toEqual({
      id: { __t: 'bigint', v: '5' },
      actionType: 'member.create',
      beforeJson: null,
      occurredAt: { __t: 'date', v: '2026-07-01T10:00:01.000Z' },
    });

    expect((await loadState(sink)).cursor).toBe('7');
  });

  it('pruneJournals keeps only the newest N daily journals', async () => {
    const prisma = makePrisma();
    const svc = new DeltaJournalService(prisma as never, sink, auditTypes);
    for (const d of ['20260628', '20260629', '20260630', '20260701']) {
      await sink.appendText(`journal/audit-${d}.ndjson`, 'x\n');
    }
    await svc.pruneJournals(2);
    expect((await sink.list('journal')).sort()).toEqual([
      'audit-20260630.ndjson',
      'audit-20260701.ndjson',
    ]);
  });

  it('is a no-op when there are no new rows', async () => {
    const prisma = makePrisma();
    const svc = new DeltaJournalService(prisma as never, sink, auditTypes);
    await svc.flush(new Date('2026-07-01T10:00:05Z')); // cursor -> 7
    const res = await svc.flush(new Date('2026-07-01T10:00:06Z'));

    expect(res.exported).toBe(0);
    expect(res.cursor).toBe('7');
    expect(await sink.list('journal')).toEqual(['audit-20260701.ndjson']); // 추가 파일/라인 없음
  });
});
