import { PgBackupJob } from './pg-backup.job';
import type { PgDumpModuleConfig } from './pg-dump.config';

const cfg: PgDumpModuleConfig = {
  databaseUrl: 'postgresql://u:p@h:5432/temple',
  backupDir: '/x',
  retentionDays: 30,
  fullHour: 3,
  scheduleEnabled: true,
};

const enabledSchedule = { enabled: true, fullHour: 3 };

describe('PgBackupJob.runIfDue', () => {
  it('runs a backup when none exists yet (past the scheduled hour)', async () => {
    const svc = {
      getSchedule: jest.fn().mockResolvedValue(enabledSchedule),
      status: jest.fn().mockResolvedValue({ last: null }),
      backupNow: jest
        .fn()
        .mockResolvedValue({ name: 'temple-x.dump', bytes: 10 }),
    };
    await new PgBackupJob(svc as never, cfg).runIfDue(
      new Date('2026-07-01T03:30:00'),
    );
    expect(svc.backupNow).toHaveBeenCalled();
  });

  it('skips when a backup already exists for today', async () => {
    const svc = {
      getSchedule: jest.fn().mockResolvedValue(enabledSchedule),
      status: jest.fn().mockResolvedValue({
        last: { at: new Date('2026-07-01T03:00:00').toISOString() },
      }),
      backupNow: jest.fn(),
    };
    await new PgBackupJob(svc as never, cfg).runIfDue(
      new Date('2026-07-01T11:00:00'),
    );
    expect(svc.backupNow).not.toHaveBeenCalled();
  });

  it('skips entirely when the schedule is disabled', async () => {
    const svc = {
      getSchedule: jest.fn().mockResolvedValue({ enabled: false, fullHour: 3 }),
      status: jest.fn(),
      backupNow: jest.fn(),
    };
    await new PgBackupJob(svc as never, cfg).runIfDue(
      new Date('2026-07-01T03:30:00'),
    );
    expect(svc.status).not.toHaveBeenCalled();
    expect(svc.backupNow).not.toHaveBeenCalled();
  });

  it('uses the schedule hour from getSchedule (not the static config)', async () => {
    // config.fullHour=3 이지만 스케줄이 5시면 04:30 에는 아직 실행 안 됨.
    const svc = {
      getSchedule: jest.fn().mockResolvedValue({ enabled: true, fullHour: 5 }),
      status: jest.fn().mockResolvedValue({ last: null }),
      backupNow: jest.fn(),
    };
    await new PgBackupJob(svc as never, cfg).runIfDue(
      new Date('2026-07-01T04:30:00'),
    );
    expect(svc.backupNow).not.toHaveBeenCalled();
  });
});
