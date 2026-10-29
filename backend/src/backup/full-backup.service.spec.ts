import { mkdtemp, rm } from 'node:fs/promises';
import { tmpdir } from 'node:os';
import { join } from 'node:path';
import { LocalFsSink } from './sinks/local-fs.sink';
import { FullBackupService } from './full-backup.service';
import type { ModelPlan } from './backup-models';
import { loadState } from './backup-state';

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
    fieldTypes: { id: 'BigInt' },
  },
];

const makePrisma = () => ({
  member: {
    findMany: jest.fn().mockResolvedValue([
      { id: 1n, name: '해인' },
      { id: 2n, name: '보리' },
    ]),
  },
  auditLog: {
    findMany: jest.fn().mockResolvedValue([]),
    findFirst: jest.fn().mockResolvedValue({ id: 7n }), // 덤프 시점 최대 audit id
  },
});

describe('FullBackupService', () => {
  let root: string;
  let sink: LocalFsSink;

  beforeEach(async () => {
    root = await mkdtemp(join(tmpdir(), 'bk-full-'));
    sink = new LocalFsSink(root);
  });
  afterEach(async () => {
    await rm(root, { recursive: true, force: true });
  });

  it('writes a gzipped NDJSON dump + manifest, records cursorAtDump, updates state', async () => {
    const prisma = makePrisma();
    const svc = new FullBackupService(prisma as never, sink, plans, {
      fullRetentionDays: 30,
    });
    const run = await svc.run(new Date('2026-07-01T03:00:00.000Z'));

    expect(run.ok).toBe(true);
    expect(run.type).toBe('full');
    expect(run.rows).toBe(2); // member 2 + auditLog 0

    const files = (await sink.list('full')).sort();
    expect(files).toEqual([
      'temple-20260701-030000.manifest.json',
      'temple-20260701-030000.ndjson.gz',
    ]);

    // 덤프 내용: member 두 행이 인코딩되어 들어있어야
    const dump = (
      await sink.readGzip('full/temple-20260701-030000.ndjson.gz')
    ).toString('utf8');
    const lines = dump
      .trim()
      .split('\n')
      .map((l) => JSON.parse(l));
    expect(lines).toHaveLength(2);
    expect(lines[0]).toEqual({
      t: 'member',
      r: { id: { __t: 'bigint', v: '1' }, name: '해인' },
    });

    // 매니페스트: 테이블별 건수 + 덤프 시점 audit 커서
    const manifest = JSON.parse(
      await sink.readText('full/temple-20260701-030000.manifest.json'),
    );
    expect(manifest.cursorAtDump).toBe('7');
    expect(manifest.tables).toEqual({ member: 2, auditLog: 0 });

    // 상태 갱신
    const state = await loadState(sink);
    expect(state.lastFullBackupAt).toBe('2026-07-01T03:00:00.000Z');
    expect(state.runs.at(-1)?.type).toBe('full');
  });

  it('retention keeps only the newest N daily dumps (gz + manifest)', async () => {
    const prisma = makePrisma();
    const svc = new FullBackupService(prisma as never, sink, plans, {
      fullRetentionDays: 2,
    });
    await svc.run(new Date('2026-06-29T03:00:00.000Z'));
    await svc.run(new Date('2026-06-30T03:00:00.000Z'));
    await svc.run(new Date('2026-07-01T03:00:00.000Z'));

    const gz = (await sink.list('full'))
      .filter((f) => f.endsWith('.ndjson.gz'))
      .sort();
    expect(gz).toEqual([
      'temple-20260630-030000.ndjson.gz',
      'temple-20260701-030000.ndjson.gz',
    ]);
    // 매니페스트도 함께 정리
    const manifests = (await sink.list('full'))
      .filter((f) => f.endsWith('.manifest.json'))
      .sort();
    expect(manifests).toEqual([
      'temple-20260630-030000.manifest.json',
      'temple-20260701-030000.manifest.json',
    ]);
  });
});
