import { mkdtemp, rm } from 'node:fs/promises';
import { tmpdir } from 'node:os';
import { join } from 'node:path';
import { LocalFsSink } from './local-fs.sink';

describe('LocalFsSink', () => {
  let root: string;
  let sink: LocalFsSink;

  beforeEach(async () => {
    root = await mkdtemp(join(tmpdir(), 'bk-sink-'));
    sink = new LocalFsSink(root);
  });
  afterEach(async () => {
    await rm(root, { recursive: true, force: true });
  });

  it('writeGzip stores a gzipped file that readGzip restores byte-for-byte', async () => {
    const payload = '한글 데이터\n{"a":1}\n';
    const res = await sink.writeGzip('full/dump.ndjson.gz', payload);
    expect(res.bytes).toBeGreaterThan(0);
    const back = await sink.readGzip('full/dump.ndjson.gz');
    expect(back.toString('utf8')).toBe(payload);
  });

  it('appendText appends across calls (journal semantics)', async () => {
    await sink.appendText('journal/audit-20260701.ndjson', 'line1\n');
    await sink.appendText('journal/audit-20260701.ndjson', 'line2\n');
    const text = await sink.readText('journal/audit-20260701.ndjson');
    expect(text).toBe('line1\nline2\n');
  });

  it('list returns filenames in a subdir, remove deletes them', async () => {
    await sink.writeGzip('full/a.ndjson.gz', 'x');
    await sink.writeGzip('full/b.ndjson.gz', 'y');
    expect((await sink.list('full')).sort()).toEqual([
      'a.ndjson.gz',
      'b.ndjson.gz',
    ]);
    await sink.remove('full/a.ndjson.gz');
    expect(await sink.list('full')).toEqual(['b.ndjson.gz']);
  });

  it('list returns empty array for a missing directory', async () => {
    expect(await sink.list('nope')).toEqual([]);
  });

  it('writeText overwrites (state-file semantics)', async () => {
    await sink.writeText('backup-state.json', '{"cursor":"1"}');
    await sink.writeText('backup-state.json', '{"cursor":"2"}');
    expect(await sink.readText('backup-state.json')).toBe('{"cursor":"2"}');
  });
});
