import { mkdtemp, rm } from 'node:fs/promises';
import { tmpdir } from 'node:os';
import { join } from 'node:path';
import { LocalFsSink } from './sinks/local-fs.sink';
import { loadState, saveState, appendRun, DEFAULT_STATE } from './backup-state';

describe('backup-state', () => {
  let root: string;
  let sink: LocalFsSink;

  beforeEach(async () => {
    root = await mkdtemp(join(tmpdir(), 'bk-state-'));
    sink = new LocalFsSink(root);
  });
  afterEach(async () => {
    await rm(root, { recursive: true, force: true });
  });

  it('loadState returns the default state when no file exists', async () => {
    expect(await loadState(sink)).toEqual(DEFAULT_STATE);
  });

  it('saveState then loadState round-trips', async () => {
    const s = {
      ...DEFAULT_STATE,
      cursor: '42',
      lastFullBackupAt: '2026-07-01T03:00:00.000Z',
    };
    await saveState(sink, s);
    expect(await loadState(sink)).toEqual(s);
  });

  it('appendRun keeps only the most recent N runs', () => {
    let s = DEFAULT_STATE;
    for (let i = 0; i < 5; i++) {
      s = appendRun(
        s,
        { type: 'delta', at: `t${i}`, file: `f${i}`, ok: true },
        3,
      );
    }
    expect(s.runs).toHaveLength(3);
    expect(s.runs.map((r) => r.file)).toEqual(['f2', 'f3', 'f4']);
  });
});
