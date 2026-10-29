/**
 * backup-codec — DB 행(row)을 파일에 담을 수 있는 JSON 안전 형태로 인코딩하고,
 * 복원 시 Prisma 가 그대로 write 할 수 있는 값으로 디코딩한다.
 *
 * Prisma 스칼라 타입별로 손실 없이 왕복(round-trip)하는 것이 목적:
 *   BigInt   ↔ {__t:'bigint',  v:'123'}        (읽기=bigint, 쓰기=bigint)
 *   DateTime ↔ {__t:'date',    v:'ISO8601'}    (읽기=Date,   쓰기=Date)
 *   Bytes    ↔ {__t:'bytes',   v:'base64'}      (읽기=Buffer, 쓰기=Buffer)
 *   Decimal  ↔ {__t:'decimal', v:'18.5'}        (읽기=문자열, Prisma 는 문자열 입력 허용)
 *   Json     ↔ 그대로(이미 JSON 안전)
 *   그 외(String/Int/Float/Boolean/enum) ↔ 그대로
 */
import type { Prisma } from '@prisma/client';

export type FieldTypes = Record<string, string>;

interface Tagged {
  __t: 'bigint' | 'date' | 'bytes' | 'decimal';
  v: string;
}

function isTagged(x: unknown): x is Tagged {
  if (typeof x !== 'object' || x === null) return false;
  const o = x as Record<string, unknown>;
  return (
    (o.__t === 'bigint' ||
      o.__t === 'date' ||
      o.__t === 'bytes' ||
      o.__t === 'decimal') &&
    typeof o.v === 'string'
  );
}

export function encodeRow(
  row: Record<string, unknown>,
  types: FieldTypes,
): Record<string, unknown> {
  const out: Record<string, unknown> = {};
  for (const [key, value] of Object.entries(row)) {
    if (value === null || value === undefined) {
      out[key] = null;
      continue;
    }
    switch (types[key]) {
      case 'BigInt':
        out[key] = { __t: 'bigint', v: (value as bigint).toString() };
        break;
      case 'DateTime':
        out[key] = { __t: 'date', v: (value as Date).toISOString() };
        break;
      case 'Bytes':
        out[key] = {
          __t: 'bytes',
          v: Buffer.from(value as Uint8Array).toString('base64'),
        };
        break;
      case 'Decimal':
        out[key] = { __t: 'decimal', v: (value as Prisma.Decimal).toString() };
        break;
      default:
        // Json / String / Int / Float / Boolean / enum / unknown → 그대로
        out[key] = value;
    }
  }
  return out;
}

export function decodeRow(
  encoded: Record<string, unknown>,
  types: FieldTypes,
): Record<string, unknown> {
  const out: Record<string, unknown> = {};
  for (const [key, value] of Object.entries(encoded)) {
    if (value === null || value === undefined) {
      out[key] = null;
      continue;
    }
    if (isTagged(value)) {
      switch (value.__t) {
        case 'bigint':
          out[key] = BigInt(value.v);
          break;
        case 'date':
          out[key] = new Date(value.v);
          break;
        case 'bytes':
          out[key] = Buffer.from(value.v, 'base64');
          break;
        case 'decimal':
          out[key] = value.v; // 문자열 그대로 — Prisma 가 Decimal 입력으로 허용
          break;
      }
      continue;
    }
    // fallback: type 정보로 한 번 더 확인(태그가 유실된 경우 대비)
    switch (types[key]) {
      case 'BigInt':
        out[key] = BigInt(value as string | number);
        break;
      case 'DateTime':
        out[key] = new Date(value as string);
        break;
      case 'Bytes':
        out[key] = Buffer.from(value as string, 'base64');
        break;
      default:
        out[key] = value;
    }
  }
  return out;
}
