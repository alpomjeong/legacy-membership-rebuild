import { BadRequestException } from '@nestjs/common';
import { BackupController } from './backup.controller';

const makeSvc = () => ({
  backupNow: jest
    .fn()
    .mockResolvedValue({ name: 'temple-x.dump', bytes: 10, at: 't' }),
  status: jest.fn().mockResolvedValue({ count: 0 }),
  list: jest.fn().mockResolvedValue([]),
  restore: jest.fn().mockResolvedValue({
    restored: 'temple-x.dump',
    safetyBackup: 'temple-y-presafe.dump',
  }),
  databaseName: jest.fn().mockReturnValue('temple'),
  importUploaded: jest.fn().mockResolvedValue('temple-uploaded-x.dump'),
  getSchedule: jest.fn().mockResolvedValue({ enabled: true, fullHour: 3 }),
  setSchedule: jest
    .fn()
    .mockImplementation((p: { enabled: boolean; fullHour: number }) =>
      Promise.resolve(p),
    ),
});

describe('BackupController', () => {
  it('run delegates to backupNow', async () => {
    const svc = makeSvc();
    await new BackupController(svc as never).run();
    expect(svc.backupNow).toHaveBeenCalled();
  });

  it('restore is blocked when confirm token does not match the DB name', async () => {
    const svc = makeSvc();
    const c = new BackupController(svc as never);
    await expect(
      c.restore({ file: 'temple-x.dump', confirm: 'wrong' }),
    ).rejects.toBeInstanceOf(BadRequestException);
    expect(svc.restore).not.toHaveBeenCalled();
  });

  it('restore proceeds with a safety backup when confirm matches', async () => {
    const svc = makeSvc();
    const c = new BackupController(svc as never);
    const res = await c.restore({ file: 'temple-x.dump', confirm: 'temple' });
    expect(svc.restore).toHaveBeenCalledWith('temple-x.dump', { safety: true });
    expect(res.safetyBackup).toBe('temple-y-presafe.dump');
  });

  it('restore-upload blocks when confirm token does not match', async () => {
    const svc = makeSvc();
    const c = new BackupController(svc as never);
    await expect(
      c.restoreUpload('wrong', { buffer: Buffer.from('PGDMP..') }),
    ).rejects.toBeInstanceOf(BadRequestException);
    expect(svc.importUploaded).not.toHaveBeenCalled();
  });

  it('restore-upload imports the file then restores with safety when confirm matches', async () => {
    const svc = makeSvc();
    const c = new BackupController(svc as never);
    const buf = Buffer.from('PGDMP-data');
    const res = await c.restoreUpload('temple', { buffer: buf });
    expect(svc.importUploaded).toHaveBeenCalledWith(buf);
    expect(svc.restore).toHaveBeenCalledWith('temple-uploaded-x.dump', {
      safety: true,
    });
    expect(res.restored).toBe('temple-x.dump');
  });

  it('restore-upload requires a file', async () => {
    const svc = makeSvc();
    const c = new BackupController(svc as never);
    await expect(c.restoreUpload('temple', undefined)).rejects.toBeInstanceOf(
      BadRequestException,
    );
  });

  it('getSchedule delegates to the service', async () => {
    const svc = makeSvc();
    const s = await new BackupController(svc as never).getSchedule();
    expect(svc.getSchedule).toHaveBeenCalled();
    expect(s).toEqual({ enabled: true, fullHour: 3 });
  });

  it('setSchedule passes enabled + fullHour to the service', async () => {
    const svc = makeSvc();
    const res = await new BackupController(svc as never).setSchedule({
      enabled: false,
      fullHour: 21,
    });
    expect(svc.setSchedule).toHaveBeenCalledWith({
      enabled: false,
      fullHour: 21,
    });
    expect(res).toEqual({ enabled: false, fullHour: 21 });
  });
});
