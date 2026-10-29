import { loadBackupConfig } from './backup.config';

const getter = (obj: Record<string, string>) => (key: string) => obj[key];

describe('loadBackupConfig', () => {
  it('applies safe defaults; disabled outside production', () => {
    const cfg = loadBackupConfig(getter({}), 'development');
    expect(cfg).toEqual({
      enabled: false,
      dir: './backups',
      fullHour: 3,
      fullRetentionDays: 30,
      deltaDebounceMs: 5000,
      journalRetentionDays: 90,
    });
  });

  it('enables by default in production', () => {
    expect(loadBackupConfig(getter({}), 'production').enabled).toBe(true);
  });

  it('honors explicit BACKUP_ENABLED over NODE_ENV', () => {
    expect(
      loadBackupConfig(getter({ BACKUP_ENABLED: 'true' }), 'development')
        .enabled,
    ).toBe(true);
    expect(
      loadBackupConfig(getter({ BACKUP_ENABLED: 'false' }), 'production')
        .enabled,
    ).toBe(false);
  });

  it('parses overrides', () => {
    const cfg = loadBackupConfig(
      getter({
        BACKUP_DIR: '/var/backups/temple',
        BACKUP_FULL_HOUR: '2',
        BACKUP_FULL_RETENTION_DAYS: '14',
        BACKUP_DELTA_DEBOUNCE_MS: '3000',
        BACKUP_JOURNAL_RETENTION_DAYS: '30',
      }),
      'production',
    );
    expect(cfg.dir).toBe('/var/backups/temple');
    expect(cfg.fullHour).toBe(2);
    expect(cfg.fullRetentionDays).toBe(14);
    expect(cfg.deltaDebounceMs).toBe(3000);
    expect(cfg.journalRetentionDays).toBe(30);
  });
});
