import { BadRequestException } from '@nestjs/common';
import { LegacyMigrationController } from './legacy-migration.controller';

const conn = {
  host: '10.0.0.1',
  user: 'sa',
  database: 'LEGACY_DB',
  password: 'pw',
};

const makeSvc = () => ({
  run: jest.fn().mockResolvedValue({
    ok: true,
    dryRun: true,
    log: '',
    summary: null,
    photos: null,
  }),
});

describe('LegacyMigrationController', () => {
  it('defaults to a dry-run (safe) and delegates', async () => {
    const svc = makeSvc();
    await new LegacyMigrationController(svc as never).legacy({ ...conn });
    expect(svc.run).toHaveBeenCalledWith(
      expect.objectContaining({ host: '10.0.0.1', database: 'LEGACY_DB' }),
      { dryRun: true, includePhotos: false },
    );
  });

  it('blocks a real load without the MIGRATE confirm token', () => {
    const svc = makeSvc();
    const c = new LegacyMigrationController(svc as never);
    expect(() => c.legacy({ ...conn, dryRun: false })).toThrow(
      BadRequestException,
    );
    expect(svc.run).not.toHaveBeenCalled();
  });

  it('runs a real load (with photos) when confirm is MIGRATE', async () => {
    const svc = makeSvc();
    const c = new LegacyMigrationController(svc as never);
    await c.legacy({
      ...conn,
      dryRun: false,
      includePhotos: true,
      confirm: 'MIGRATE',
    });
    expect(svc.run).toHaveBeenCalledWith(
      expect.objectContaining({ host: '10.0.0.1' }),
      {
        dryRun: false,
        includePhotos: true,
      },
    );
  });
});
