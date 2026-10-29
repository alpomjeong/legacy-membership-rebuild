import { spawnPg } from './pg-runner';

describe('spawnPg', () => {
  it('resolves when the process exits 0', async () => {
    await expect(
      spawnPg(process.execPath, ['-e', 'process.exit(0)'], process.env),
    ).resolves.toBeUndefined();
  });

  it('rejects with stderr context when the process exits non-zero', async () => {
    await expect(
      spawnPg(
        process.execPath,
        ['-e', 'console.error("boom"); process.exit(3)'],
        process.env,
      ),
    ).rejects.toThrow(/exit 3|boom/);
  });
});
