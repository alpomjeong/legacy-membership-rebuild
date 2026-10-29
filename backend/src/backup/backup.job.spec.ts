import { mkdtemp, rm } from 'node:fs/promises';
import { tmpdir } from 'node:os';
import { join } from 'node:path';
import { LocalFsSink } from './sinks/local-fs.sink';
import { BackupJob } from './backup.job';
import { saveState, DEFAULT_STATE } from './backup-state';
import type { BackupOptions } from './backup.config';

const opts: BackupOptions = {
  enabled: true,
  dir: '',
  fullHour: 3,
  fullRetentionDays: 30,
  deltaDebounceMs: 5000,
  journalRetentionDays: 90,
};

describe('BackupJob.runFullIfDue', () => {
  let root: string;
  let sink: LocalFsSink;
  let full: { run: jest.Mock };
  let delta: { flush: jest.Mock; pruneJournals: jest.Mock };

  beforeEach(async () => {
    root = await mkdtemp(join(tmpdir(), 'bk-job-'));
    sink = new LocalFsSink(root);
    full = { run: jest.fn().mockResolvedValue({}) };
    delta = {
      flush: jest.fn().mockResolvedValue({}),
      pruneJournals: jest.fn().mockResolvedValue(undefined),
    };
  });
  afterEach(async () => {
    await rm(root, { recursive: true, force: true });
  });

  it('runs the full backup and prunes journals when due', async () => {
    const job = new BackupJob(full as never, delta as never, sink, opts);
    await job.runFullIfDue(new Date('2026-07-01T03:30:00'));
    expect(full.run).toHaveBeenCalledTimes(1);
    expect(delta.pruneJournals).toHaveBeenCalledWith(90);
  });

  it('skips when a backup already ran today', async () => {
    await saveState(sink, {
      ...DEFAULT_STATE,
      lastFullBackupAt: new Date('2026-07-01T03:00:00').toISOString(),
    });
    const job = new BackupJob(full as never, delta as never, sink, opts);
    await job.runFullIfDue(new Date('2026-07-01T11:00:00'));
    expect(full.run).not.toHaveBeenCalled();
  });
});
