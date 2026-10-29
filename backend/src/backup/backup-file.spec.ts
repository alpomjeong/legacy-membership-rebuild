import { isSafeBackupName } from './backup-file';

describe('isSafeBackupName', () => {
  it('accepts a plain .dump filename', () => {
    expect(isSafeBackupName('temple-20260701-030000.dump')).toBe(true);
    expect(isSafeBackupName('temple-20260701-030000-presafe.dump')).toBe(true);
  });

  it('rejects path separators and traversal', () => {
    expect(isSafeBackupName('../secret.dump')).toBe(false);
    expect(isSafeBackupName('..\\secret.dump')).toBe(false);
    expect(isSafeBackupName('sub/temple.dump')).toBe(false);
    expect(isSafeBackupName('C:\\x\\temple.dump')).toBe(false);
  });

  it('rejects non-.dump and empty', () => {
    expect(isSafeBackupName('temple.txt')).toBe(false);
    expect(isSafeBackupName('temple.dump.exe')).toBe(false);
    expect(isSafeBackupName('')).toBe(false);
  });
});
