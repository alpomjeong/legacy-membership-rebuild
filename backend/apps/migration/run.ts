import { readFileSync } from 'node:fs';
import { parseXlsxBuffer } from './excel-parser';
import { mapBulsaRow, type NormalizedBulsa } from './bulsa-mapper';
import { buildReport, type Issue } from './validation-report';
import { loadIdempotent, InMemoryStore } from './idempotent-loader';

/**
 * 마이그레이션 CLI (E0.7 골격): 파일 → 파싱 → 정제·매핑 → 검증 리포트(드라이런) → 멱등 적재 패턴.
 * 실행: `pnpm migrate <path.xlsx> [--load]`.
 * Phase 0 Exit 은 드라이런·검증 리포트까지. 실제 업무 엔티티 적재(Prisma 트랜잭션)는 Phase 1.
 */
async function main(): Promise<void> {
  const path = process.argv[2];
  const doLoad = process.argv.includes('--load');
  if (!path) {
    console.error('usage: migrate <path.xlsx> [--load]');
    process.exitCode = 1;
    return;
  }

  const rows = await parseXlsxBuffer(readFileSync(path));
  const normalized: NormalizedBulsa[] = [];
  const issues: Issue[] = [];
  rows.forEach((raw, i) => {
    const { row, issues: rowIssues } = mapBulsaRow(raw, i + 1);
    issues.push(...rowIssues);
    if (row) normalized.push(row);
  });

  const report = buildReport(rows.length, issues);
  console.log('검증 리포트:', JSON.stringify(report, null, 2));

  const store = new InMemoryStore();
  const load = loadIdempotent(normalized, store, { dryRun: !doLoad });
  console.log(
    `적재(${doLoad ? '실적재-골격' : '드라이런'}):`,
    JSON.stringify(load),
  );
}

void main();
