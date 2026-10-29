import { mkdir, mkdtemp, readFile, rm, writeFile } from 'node:fs/promises';
import { tmpdir } from 'node:os';
import { join } from 'node:path';
import {
  PgDumpService,
  nextRunAt,
  type PgDumpConfig,
  type PgRunner,
} from './pg-dump.service';
import {
  encryptBackup,
  decryptBackup,
  isEncryptedBackup,
} from './backup-crypto';

const cfg = (dir: string): PgDumpConfig => ({
  databaseUrl: 'postgresql://temple:pw%40x@localhost:5432/temple?schema=public',
  backupDir: dir,
  retentionDays: 30,
  fullHour: 3,
});

describe('PgDumpService.backupNow', () => {
  let dir: string;
  beforeEach(async () => {
    dir = await mkdtemp(join(tmpdir(), 'pgdump-'));
  });
  afterEach(async () => {
    await rm(dir, { recursive: true, force: true });
  });

  it('runs pg_dump (-Fc -f) with PGPASSWORD from the URL and returns file meta', async () => {
    const calls: { bin: string; args: string[]; pass?: string }[] = [];
    const run: PgRunner = async (bin, args, env) => {
      calls.push({ bin, args, pass: env.PGPASSWORD });
      const i = args.indexOf('-f');
      await writeFile(args[i + 1], 'DUMP'); // pg_dump 이 파일을 쓰는 것 흉내
    };
    const svc = new PgDumpService(cfg(dir), run);

    const res = await svc.backupNow(new Date('2026-07-01T03:00:00.000Z'));

    expect(res.name).toBe('temple-20260701-030000.dump');
    expect(res.bytes).toBe(4);
    expect(calls).toHaveLength(1);
    expect(calls[0].bin).toBe('pg_dump');
    expect(calls[0].pass).toBe('pw@x'); // URL 디코드된 비번이 env 로
    expect(calls[0].args).toContain('-Fc');
    expect(calls[0].args[calls[0].args.indexOf('-f') + 1]).toBe(
      join(dir, 'full', 'temple-20260701-030000.dump'),
    );
  });

  it('prunes dumps beyond retention (keeps newest N)', async () => {
    const run: PgRunner = async (_b, args) => {
      const i = args.indexOf('-f');
      await writeFile(args[i + 1], 'x');
    };
    const svc = new PgDumpService({ ...cfg(dir), retentionDays: 2 }, run);
    await svc.backupNow(new Date('2026-06-29T03:00:00Z'));
    await svc.backupNow(new Date('2026-06-30T03:00:00Z'));
    await svc.backupNow(new Date('2026-07-01T03:00:00Z'));
    const names = (await svc.list()).map((f) => f.name);
    expect(names).toEqual([
      'temple-20260701-030000.dump',
      'temple-20260630-030000.dump',
    ]);
  });
});

describe('PgDumpService.restore', () => {
  let dir: string;
  beforeEach(async () => {
    dir = await mkdtemp(join(tmpdir(), 'pgrestore-'));
  });
  afterEach(async () => {
    await rm(dir, { recursive: true, force: true });
  });

  const runner =
    (calls: { bin: string; args: string[] }[]): PgRunner =>
    async (bin, args) => {
      calls.push({ bin, args });
      const i = args.indexOf('-f');
      if (i >= 0) await writeFile(args[i + 1], 'DUMP'); // pg_dump(안전백업)만 파일 씀
    };

  it('rejects an unsafe filename before running anything', async () => {
    const calls: { bin: string; args: string[] }[] = [];
    const svc = new PgDumpService(cfg(dir), runner(calls));
    await expect(svc.restore('../evil.dump')).rejects.toThrow();
    expect(calls).toHaveLength(0);
  });

  it('takes a pre-restore safety backup then runs pg_restore', async () => {
    await mkdir(join(dir, 'full'), { recursive: true });
    await writeFile(join(dir, 'full', 'temple-20260701-030000.dump'), 'DUMP');
    const calls: { bin: string; args: string[] }[] = [];
    const svc = new PgDumpService(cfg(dir), runner(calls));

    const res = await svc.restore('temple-20260701-030000.dump', {
      safety: true,
    });

    expect(res.safetyBackup).toMatch(/-presafe\.dump$/);
    const bins = calls.map((c) => c.bin);
    expect(bins).toEqual(['pg_dump', 'pg_restore']); // 안전백업 먼저, 그다음 복원
    const restoreCall = calls[1];
    expect(restoreCall.args).toEqual(
      expect.arrayContaining(['--clean', '--if-exists', '--no-owner']),
    );
    expect(restoreCall.args[restoreCall.args.length - 1]).toBe(
      join(dir, 'full', 'temple-20260701-030000.dump'),
    );
  });
});

describe('PgDumpService.status', () => {
  let dir: string;
  beforeEach(async () => {
    dir = await mkdtemp(join(tmpdir(), 'pgstatus-'));
  });
  afterEach(async () => {
    await rm(dir, { recursive: true, force: true });
  });

  it('reports last backup, count, schedule hour, and next run', async () => {
    const run: PgRunner = async (_b, args) => {
      const i = args.indexOf('-f');
      await writeFile(args[i + 1], 'x');
    };
    const svc = new PgDumpService(cfg(dir), run);
    await svc.backupNow(new Date('2026-06-30T03:00:00Z'));
    await svc.backupNow(new Date('2026-07-01T03:00:00Z'));

    const s = await svc.status(new Date('2026-07-01T10:00:00'));
    expect(s.count).toBe(2);
    expect(s.last?.name).toBe('temple-20260701-030000.dump');
    expect(s.fullHour).toBe(3);
    expect(s.enabled).toBe(false); // 스케줄 파일 없음 + env 기본 off
    expect(s.database).toBe('temple');
    expect(new Date(s.nextRunAt).getHours()).toBe(3);
  });
});

describe('PgDumpService schedule get/set', () => {
  let dir: string;
  beforeEach(async () => {
    dir = await mkdtemp(join(tmpdir(), 'pgsched-'));
  });
  afterEach(async () => {
    await rm(dir, { recursive: true, force: true });
  });

  it('falls back to env defaults when no schedule file exists', async () => {
    const svc = new PgDumpService(
      { ...cfg(dir), scheduleEnabled: true, fullHour: 3 },
      async () => {},
    );
    const s = await svc.getSchedule();
    expect(s).toEqual({ enabled: true, fullHour: 3 });
  });

  it('persists a set schedule and reads it back (survives new instance)', async () => {
    const svc = new PgDumpService(cfg(dir), async () => {});
    const saved = await svc.setSchedule({ enabled: true, fullHour: 21 });
    expect(saved).toEqual({ enabled: true, fullHour: 21 });

    // 새 인스턴스(재기동 흉내) 도 파일에서 읽어야 함
    const svc2 = new PgDumpService(cfg(dir), async () => {});
    expect(await svc2.getSchedule()).toEqual({ enabled: true, fullHour: 21 });
  });

  it('the persisted schedule overrides env defaults and drives status', async () => {
    const svc = new PgDumpService(
      { ...cfg(dir), scheduleEnabled: false, fullHour: 3 },
      async () => {},
    );
    await svc.setSchedule({ enabled: true, fullHour: 22 });
    const s = await svc.status(new Date('2026-07-01T10:00:00'));
    expect(s.enabled).toBe(true);
    expect(s.fullHour).toBe(22);
    expect(new Date(s.nextRunAt).getHours()).toBe(22);
  });

  it('clamps out-of-range hours to 0..23', async () => {
    const svc = new PgDumpService(cfg(dir), async () => {});
    expect(
      (await svc.setSchedule({ enabled: true, fullHour: 99 })).fullHour,
    ).toBe(23);
    expect(
      (await svc.setSchedule({ enabled: true, fullHour: -5 })).fullHour,
    ).toBe(0);
  });
});

describe('PgDumpService restore-state (현재 적용 백업본)', () => {
  let dir: string;
  beforeEach(async () => {
    dir = await mkdtemp(join(tmpdir(), 'pgrestore-'));
  });
  afterEach(async () => {
    await rm(dir, { recursive: true, force: true });
  });

  it('is null before any restore, then records the applied backup', async () => {
    const run: PgRunner = async (_b, args) => {
      const i = args.indexOf('-f');
      if (i >= 0) await writeFile(args[i + 1], 'x'); // pg_dump 만 파일 생성
    };
    const svc = new PgDumpService(cfg(dir), run);
    const b = await svc.backupNow(new Date('2026-07-01T03:00:00Z'));

    expect(await svc.getRestoreState()).toBeNull();
    expect((await svc.status()).lastRestore).toBeNull();

    await svc.restore(b.name, { safety: false });

    expect((await svc.getRestoreState())?.file).toBe(b.name);
    expect((await svc.status()).lastRestore?.file).toBe(b.name);
  });
});

describe('PgDumpService.pathFor', () => {
  it('returns the absolute path for a safe name, throws on an unsafe one', () => {
    const svc = new PgDumpService(cfg('/bk'), async () => {});
    expect(svc.pathFor('temple-x.dump')).toBe(
      join('/bk', 'full', 'temple-x.dump'),
    );
    expect(() => svc.pathFor('../evil')).toThrow();
  });
});

describe('PgDumpService.databaseName', () => {
  it('returns the target DB name (used as the restore confirm token)', () => {
    const svc = new PgDumpService(cfg('/x'), async () => {});
    expect(svc.databaseName()).toBe('temple');
  });
});

describe('PgDumpService 암호화(encKey)', () => {
  let dir: string;
  beforeEach(async () => {
    dir = await mkdtemp(join(tmpdir(), 'pgenc-'));
  });
  afterEach(async () => {
    await rm(dir, { recursive: true, force: true });
  });

  const encCfg = (d: string): PgDumpConfig => ({
    ...cfg(d),
    encKey: 'test-secret',
  });

  it('backupNow 시 파일을 암호화해 저장한다(디스크엔 암호문)', async () => {
    const run: PgRunner = async (_b, args) => {
      const i = args.indexOf('-f');
      await writeFile(args[i + 1], 'PGDMP-BODY');
    };
    const svc = new PgDumpService(encCfg(dir), run);
    const res = await svc.backupNow(new Date('2026-07-01T03:00:00Z'));
    const onDisk = await readFile(join(dir, 'full', res.name));
    expect(isEncryptedBackup(onDisk)).toBe(true);
    expect(onDisk.toString('ascii')).not.toContain('PGDMP-BODY');
    expect(decryptBackup(onDisk, 'test-secret').toString()).toBe('PGDMP-BODY');
  });

  it('restore 는 복호화본으로 pg_restore 하고 임시파일을 삭제한다', async () => {
    const mk: PgRunner = async (_b, args) => {
      const i = args.indexOf('-f');
      await writeFile(args[i + 1], 'PGDMP-BODY');
    };
    const b = await new PgDumpService(encCfg(dir), mk).backupNow(
      new Date('2026-07-01T03:00:00Z'),
    );

    let restoredContent: string | undefined;
    let restoredPath: string | undefined;
    const run: PgRunner = async (bin, args) => {
      if (bin.endsWith('pg_restore')) {
        restoredPath = args[args.length - 1];
        restoredContent = (await readFile(restoredPath)).toString();
      }
    };
    await new PgDumpService(encCfg(dir), run).restore(b.name, {
      safety: false,
    });
    expect(restoredContent).toBe('PGDMP-BODY'); // pg_restore 는 평문을 받음
    await expect(readFile(restoredPath as string)).rejects.toThrow(); // 임시본 삭제됨
  });

  it('importUploaded: 평문은 암호화 저장, 이미 암호화본은 그대로', async () => {
    const svc = new PgDumpService(encCfg(dir), async () => {});
    const n1 = await svc.importUploaded(
      Buffer.from('PGDMP' + 'x'.repeat(10)),
      new Date('2026-07-01T03:00:00Z'),
    );
    expect(isEncryptedBackup(await readFile(join(dir, 'full', n1)))).toBe(true);

    const enc = encryptBackup(Buffer.from('PGDMPyyyy'), 'test-secret');
    const n2 = await svc.importUploaded(enc, new Date('2026-07-02T03:00:00Z'));
    expect((await readFile(join(dir, 'full', n2))).equals(enc)).toBe(true);
  });

  it('importUploaded: 다른 키로 암호화된 백업은 저장하지 않고 거부한다', async () => {
    const svc = new PgDumpService(encCfg(dir), async () => {});
    const foreign = encryptBackup(Buffer.from('PGDMPzzzz'), 'OTHER-KEY');
    await expect(
      svc.importUploaded(foreign, new Date('2026-07-03T03:00:00Z')),
    ).rejects.toThrow(/복호화할 수 없는/);
    // 폴더에 저장되지 않아야 함(복원불가 파일이 prune 대상에 끼지 않게)
    await expect(readFile(join(dir, 'full'))).rejects.toThrow(); // 폴더 자체가 없음
  });
});

describe('nextRunAt', () => {
  it('returns today at fullHour when before it', () => {
    const n = nextRunAt(new Date('2026-07-01T01:00:00'), 3);
    expect(n.getHours()).toBe(3);
    expect(n.getDate()).toBe(1);
  });
  it('returns tomorrow at fullHour when already past', () => {
    const n = nextRunAt(new Date('2026-07-01T05:00:00'), 3);
    expect(n.getHours()).toBe(3);
    expect(n.getDate()).toBe(2);
  });
});
