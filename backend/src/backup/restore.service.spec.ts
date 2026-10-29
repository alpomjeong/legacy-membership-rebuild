import { mkdtemp, rm } from 'node:fs/promises';
import { tmpdir } from 'node:os';
import { join } from 'node:path';
import { LocalFsSink } from './sinks/local-fs.sink';
import { RestoreService } from './restore.service';
import type { ModelPlan } from './backup-models';

const plans: ModelPlan[] = [
  {
    model: 'Member',
    delegate: 'member',
    dbName: 'member',
    fieldTypes: { id: 'BigInt', name: 'String' },
  },
  {
    model: 'AuditLog',
    delegate: 'auditLog',
    dbName: 'audit_log',
    fieldTypes: { id: 'BigInt', occurredAt: 'DateTime' },
  },
];

describe('RestoreService', () => {
  let root: string;
  let sink: LocalFsSink;

  beforeEach(async () => {
    root = await mkdtemp(join(tmpdir(), 'bk-restore-'));
    sink = new LocalFsSink(root);
  });
  afterEach(async () => {
    await rm(root, { recursive: true, force: true });
  });

  it('readDump parses gz NDJSON and decodes rows back to native types', async () => {
    const lines = [
      JSON.stringify({
        t: 'member',
        r: { id: { __t: 'bigint', v: '1' }, name: '해인' },
      }),
      JSON.stringify({
        t: 'member',
        r: { id: { __t: 'bigint', v: '2' }, name: '보리' },
      }),
    ].join('\n');
    await sink.writeGzip('full/temple-20260701-030000.ndjson.gz', lines + '\n');

    const svc = new RestoreService({} as never, sink, plans);
    const groups = await svc.readDump('temple-20260701-030000');
    expect(groups.get('member')).toEqual([
      { id: 1n, name: '해인' },
      { id: 2n, name: '보리' },
    ]);
  });

  it('readJournalAudit returns rows after cursor and at/under --until, decoded', async () => {
    const j = [
      {
        id: { __t: 'bigint', v: '8' },
        occurredAt: { __t: 'date', v: '2026-07-01T10:00:00.000Z' },
      },
      {
        id: { __t: 'bigint', v: '9' },
        occurredAt: { __t: 'date', v: '2026-07-01T12:00:00.000Z' },
      },
    ].map((x) => JSON.stringify(x));
    await sink.appendText('journal/audit-20260701.ndjson', j.join('\n') + '\n');

    const svc = new RestoreService({} as never, sink, plans);
    const rows = await svc.readJournalAudit(
      7n,
      new Date('2026-07-01T11:00:00.000Z'),
    );
    expect(rows).toEqual([
      { id: 8n, occurredAt: new Date('2026-07-01T10:00:00.000Z') },
    ]); // 9 (12:00) 제외
  });

  it('load clears every table then bulk-inserts, with FK triggers disabled', async () => {
    const tx = {
      $executeRawUnsafe: jest.fn().mockResolvedValue(0),
      member: { deleteMany: jest.fn(), createMany: jest.fn() },
      auditLog: { deleteMany: jest.fn(), createMany: jest.fn() },
    };
    const prisma = {
      $transaction: jest.fn((cb: (t: typeof tx) => unknown) => cb(tx)),
    };
    const svc = new RestoreService(prisma as never, sink, plans);

    const groups = new Map<string, Record<string, unknown>[]>([
      ['member', [{ id: 1n, name: '해인' }]],
    ]);
    const res = await svc.load(groups);

    expect(tx.$executeRawUnsafe).toHaveBeenCalledWith(
      'SET LOCAL session_replication_role = replica',
    );
    // 모든 테이블 비우고
    expect(tx.member.deleteMany).toHaveBeenCalledWith({});
    expect(tx.auditLog.deleteMany).toHaveBeenCalledWith({});
    // 데이터 있는 테이블만 삽입
    expect(tx.member.createMany).toHaveBeenCalledWith({
      data: [{ id: 1n, name: '해인' }],
    });
    expect(tx.auditLog.createMany).not.toHaveBeenCalled();
    expect(res).toEqual({ member: 1 });
  });
});
