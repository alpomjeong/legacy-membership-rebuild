import {
  normalizeSeongju12,
  normalizeSpirit,
  preserveAltarNumber,
  toBoolean,
  parseDateStrict,
} from './cleansing';
import type { Issue } from './validation-report';

/** 불사명단 원본 행(한글 헤더 dict). 한글 헤더 고정 폐기 — 매핑은 헤더명으로. */
export type RawRow = Record<string, string>;

/** 정제·타입변환된 불사 신청 행. 단번호는 문자열 유지(선행 0). */
export interface NormalizedBulsa {
  legacyKey: string;
  memberName: string;
  missionary: string;
  item: string;
  altarNumber: string;
  spirit?: string;
  seongju12?: string;
  registrationDate?: string;
  canceled: boolean;
  certIssued: boolean;
}

export interface MapResult {
  row: NormalizedBulsa | null;
  issues: Issue[];
}

/** 한 행을 정제·매핑하고 발견된 이슈(경고/오류)를 함께 반환한다. 오류 행은 row=null. */
export function mapBulsaRow(raw: RawRow, rowNum: number): MapResult {
  const issues: Issue[] = [];
  const get = (k: string): string => (raw[k] ?? '').trim();

  const memberName = get('회원명');
  const missionary = get('포교원장');
  const item = get('불사명');
  const altarNumber = preserveAltarNumber(get('단번호'));

  let seongju12: string | undefined = get('12성주') || undefined;
  if (seongju12) {
    const norm = normalizeSeongju12(seongju12);
    if (norm !== seongju12) {
      issues.push({
        row: rowNum,
        field: '12성주',
        original: seongju12,
        reason: `공백 변형 정규화 → '${norm}'`,
        level: 'warn',
      });
      seongju12 = norm;
    }
  }

  let spirit: string | undefined = get('영가') || undefined;
  if (spirit) {
    const norm = normalizeSpirit(spirit);
    if (norm !== spirit) {
      issues.push({
        row: rowNum,
        field: '영가',
        original: spirit,
        reason: '구분자 통일',
        level: 'warn',
      });
      spirit = norm;
    }
  }

  let registrationDate: string | undefined;
  const dateRaw = get('봉안일') || get('신청일');
  if (dateRaw) {
    const parsed = parseDateStrict(dateRaw);
    if (parsed === null) {
      issues.push({
        row: rowNum,
        field: '봉안일',
        original: dateRaw,
        reason: '날짜 파싱 실패(모호 — 추정 금지)',
        level: 'error',
      });
    } else {
      registrationDate = parsed;
    }
  }

  if (!memberName) {
    issues.push({
      row: rowNum,
      field: '회원명',
      original: '',
      reason: '회원명 누락(필수)',
      level: 'error',
    });
  }

  if (issues.some((i) => i.level === 'error')) return { row: null, issues };

  const legacyKey = [
    memberName,
    missionary,
    item,
    altarNumber,
    registrationDate ?? '',
  ].join('|');

  return {
    row: {
      legacyKey,
      memberName,
      missionary,
      item,
      altarNumber,
      spirit,
      seongju12,
      registrationDate,
      canceled: toBoolean(get('취소여부')),
      certIssued: toBoolean(get('증서발급')),
    },
    issues,
  };
}
