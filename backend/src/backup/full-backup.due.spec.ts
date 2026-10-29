import { isFullBackupDue } from './full-backup.due';

const at = (s: string) => new Date(s); // 로컬 시간 문자열

describe('isFullBackupDue', () => {
  it('not due before the scheduled hour, even if never run', () => {
    expect(isFullBackupDue(null, at('2026-07-01T02:59:00'), 3)).toBe(false);
  });

  it('due once the scheduled hour has passed and it never ran', () => {
    expect(isFullBackupDue(null, at('2026-07-01T03:00:00'), 3)).toBe(true);
    expect(isFullBackupDue(null, at('2026-07-01T05:00:00'), 3)).toBe(true);
  });

  it('not due again the same day after it already ran', () => {
    const last = at('2026-07-01T03:00:05').toISOString();
    expect(isFullBackupDue(last, at('2026-07-01T10:00:00'), 3)).toBe(false);
  });

  it('due again the next day (catches up a PC that was off at the hour)', () => {
    const last = at('2026-06-30T03:00:05').toISOString();
    expect(isFullBackupDue(last, at('2026-07-01T09:30:00'), 3)).toBe(true);
  });
});
