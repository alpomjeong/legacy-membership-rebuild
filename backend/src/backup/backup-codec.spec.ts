import { Prisma } from '@prisma/client';
import { encodeRow, decodeRow, type FieldTypes } from './backup-codec';

const types: FieldTypes = {
  id: 'BigInt',
  amount: 'Decimal',
  createdAt: 'DateTime',
  blob: 'Bytes',
  meta: 'Json',
  name: 'String',
  count: 'Int',
  active: 'Boolean',
  deletedAt: 'DateTime',
};

const dbRow = {
  id: 123n,
  amount: new Prisma.Decimal('18.50'),
  createdAt: new Date('2026-07-01T03:00:00.000Z'),
  blob: Buffer.from([1, 2, 3, 255]),
  meta: { a: 1, b: [2, 3] },
  name: '해인',
  count: 5,
  active: true,
  deletedAt: null,
};

describe('backup-codec', () => {
  it('encodeRow produces a JSON-safe object (no bigint/Date/Buffer at top level)', () => {
    const enc = encodeRow(dbRow, types);
    // must not throw — proves no raw bigint leaked
    const json = JSON.stringify(enc);
    expect(typeof json).toBe('string');
    expect(json).toContain('bigint');
    expect(json).toContain('bytes');
    expect(json).toContain('decimal');
  });

  it('round-trips every scalar type through JSON back to Prisma-writable values', () => {
    const enc = encodeRow(dbRow, types);
    const afterFile = JSON.parse(JSON.stringify(enc)) as Record<
      string,
      unknown
    >; // simulate file write+read
    const dec = decodeRow(afterFile, types);

    expect(dec.id).toBe(123n); // bigint restored
    expect(dec.amount).toBe('18.5'); // Decimal -> string (Prisma accepts string)
    expect(dec.createdAt).toEqual(new Date('2026-07-01T03:00:00.000Z'));
    expect(Buffer.isBuffer(dec.blob)).toBe(true);
    expect(dec.blob).toEqual(Buffer.from([1, 2, 3, 255]));
    expect(dec.meta).toEqual({ a: 1, b: [2, 3] });
    expect(dec.name).toBe('해인');
    expect(dec.count).toBe(5);
    expect(dec.active).toBe(true);
    expect(dec.deletedAt).toBeNull();
  });

  it('passes unknown/extra keys through untouched', () => {
    const enc = encodeRow({ note: 'x' }, {});
    expect(enc.note).toBe('x');
    expect(decodeRow({ note: 'x' }, {}).note).toBe('x');
  });
});
