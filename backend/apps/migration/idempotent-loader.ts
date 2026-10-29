import type { NormalizedBulsa } from './bulsa-mapper';

/**
 * 적재 대상 저장소 포트 — Phase 1 에서 Prisma `$transaction` 구현으로 대체.
 * 멱등 키 = legacyKey. (실제 업무 엔티티 Member/BuddhistServiceReg 적재는 Phase 1)
 */
export interface LoadStore {
  has(legacyKey: string): boolean;
  put(legacyKey: string, row: NormalizedBulsa): void;
}

export interface LoadResult {
  inserted: number;
  skipped: number;
  dryRun: boolean;
}

/**
 * 멱등 적재(FR-MIG-05/06): 같은 legacyKey 재실행 시 중복 생성 없음(증분 0).
 * dryRun 시 저장하지 않고 분류만 한다.
 */
export function loadIdempotent(
  rows: NormalizedBulsa[],
  store: LoadStore,
  opts: { dryRun?: boolean } = {},
): LoadResult {
  const dryRun = opts.dryRun ?? false;
  let inserted = 0;
  let skipped = 0;
  for (const row of rows) {
    if (store.has(row.legacyKey)) {
      skipped++;
      continue;
    }
    if (!dryRun) store.put(row.legacyKey, row);
    inserted++;
  }
  return { inserted, skipped, dryRun };
}

/** 인메모리 저장소 — 테스트·드라이런용(Phase 1 에서 Prisma 트랜잭션으로 교체). */
export class InMemoryStore implements LoadStore {
  private readonly map = new Map<string, NormalizedBulsa>();
  has(k: string): boolean {
    return this.map.has(k);
  }
  put(k: string, row: NormalizedBulsa): void {
    this.map.set(k, row);
  }
  get size(): number {
    return this.map.size;
  }
}
