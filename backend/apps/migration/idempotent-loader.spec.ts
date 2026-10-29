import { loadIdempotent, InMemoryStore } from './idempotent-loader';
import type { NormalizedBulsa } from './bulsa-mapper';

const mk = (k: string): NormalizedBulsa => ({
  legacyKey: k,
  memberName: 'x',
  missionary: 'y',
  item: 'i',
  altarNumber: '0001',
  canceled: false,
  certIssued: false,
});

describe('loadIdempotent (FR-MIG-05/06 멱등)', () => {
  it('최초 적재 후 재실행 시 증분 0(멱등)', () => {
    const store = new InMemoryStore();
    const rows = [mk('a'), mk('b'), mk('c')];

    const first = loadIdempotent(rows, store);
    expect(first.inserted).toBe(3);
    expect(store.size).toBe(3);

    const second = loadIdempotent(rows, store);
    expect(second.inserted).toBe(0);
    expect(second.skipped).toBe(3);
    expect(store.size).toBe(3); // 증분 0
  });

  it('dryRun 은 저장하지 않는다', () => {
    const store = new InMemoryStore();
    const res = loadIdempotent([mk('a')], store, { dryRun: true });
    expect(res.dryRun).toBe(true);
    expect(store.size).toBe(0);
  });
});
