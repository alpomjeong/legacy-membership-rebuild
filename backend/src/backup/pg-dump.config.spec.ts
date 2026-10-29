import { loadPgDumpConfig } from './pg-dump.config';

const get = (o: Record<string, string>) => (k: string) => o[k];

describe('loadPgDumpConfig', () => {
  it('applies defaults; auto-schedule off unless explicitly enabled', () => {
    const c = loadPgDumpConfig(
      get({ DATABASE_URL: 'postgresql://u:p@h:5432/temple' }),
    );
    expect(c).toEqual({
      databaseUrl: 'postgresql://u:p@h:5432/temple',
      backupDir: './backups',
      pgBin: undefined,
      retentionDays: 30,
      fullHour: 3,
      scheduleEnabled: false,
    });
  });

  it('parses overrides', () => {
    const c = loadPgDumpConfig(
      get({
        DATABASE_URL: 'postgresql://u:p@h:5432/temple',
        BACKUP_DIR: 'D:\\temple-backups',
        PG_BIN: 'C:\\PostgreSQL\\16\\bin',
        BACKUP_RETENTION_DAYS: '14',
        BACKUP_FULL_HOUR: '2',
        BACKUP_PG_SCHEDULE: 'true',
      }),
    );
    expect(c.backupDir).toBe('D:\\temple-backups');
    expect(c.pgBin).toBe('C:\\PostgreSQL\\16\\bin');
    expect(c.retentionDays).toBe(14);
    expect(c.fullHour).toBe(2);
    expect(c.scheduleEnabled).toBe(true);
  });
});
