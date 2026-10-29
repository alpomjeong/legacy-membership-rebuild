import { LocalFsSink } from '../../src/backup/sinks/local-fs.sink';

/**
 * 백업 목록 조회 CLI: `pnpm backup:list`
 * BACKUP_DIR 의 전체 백업(매니페스트)과 저널 파일을 최신순으로 보여준다.
 */
async function main(): Promise<void> {
  const dir = process.env.BACKUP_DIR ?? './backups';
  const sink = new LocalFsSink(dir);

  const manifests = (await sink.list('full'))
    .filter((f) => f.endsWith('.manifest.json'))
    .sort()
    .reverse();
  console.log(`# 전체 백업 (${dir}/full) — 최신순`);
  if (manifests.length === 0) console.log('  (없음)');
  for (const m of manifests) {
    const meta = JSON.parse(await sink.readText(`full/${m}`)) as {
      createdAt: string;
      tables: Record<string, number>;
      cursorAtDump: string;
    };
    const base = m.replace(/\.manifest\.json$/, '');
    const rows = Object.values(meta.tables).reduce((a, b) => a + b, 0);
    console.log(
      `  ${base}  ·  ${meta.createdAt}  ·  ${rows}행  ·  cursor=${meta.cursorAtDump}`,
    );
  }

  const journals = (await sink.list('journal'))
    .filter((f) => f.endsWith('.ndjson'))
    .sort()
    .reverse();
  console.log(`\n# 변경 저널 (${dir}/journal) — 최신순`);
  if (journals.length === 0) console.log('  (없음)');
  for (const j of journals) console.log(`  ${j}`);
}

void main();
