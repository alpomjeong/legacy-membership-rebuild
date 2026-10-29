import {
  normalizeSeongju12,
  normalizeSpirit,
  preserveAltarNumber,
  toBoolean,
  parseDateStrict,
} from './cleansing';

describe('마이그레이션 정제 규칙 (FR-MIG-10)', () => {
  it('12성주 공백 변형 정규화', () => {
    expect(normalizeSeongju12('축 성주')).toBe('축성주');
    expect(normalizeSeongju12('축성주')).toBe('축성주');
  });

  it('영가 구분자 통일(언더스코어/다중공백 → 단일공백)', () => {
    expect(normalizeSpirit('연안차씨_성주조상')).toBe('연안차씨 성주조상');
    expect(normalizeSpirit('연안차씨  성주조상')).toBe('연안차씨 성주조상');
  });

  it('단번호 선행 0 보존(숫자 변환 금지)', () => {
    expect(preserveAltarNumber(' 0909 ')).toBe('0909');
    expect(preserveAltarNumber('0001')).toBe('0001');
  });

  it('취소/증서 boolean 정규화', () => {
    expect(toBoolean('Y')).toBe(true);
    expect(toBoolean('y')).toBe(true);
    expect(toBoolean('')).toBe(false);
    expect(toBoolean('N')).toBe(false);
    expect(toBoolean(undefined)).toBe(false);
  });

  it('날짜 파싱: 유효 포맷 허용, 모호/비정상은 null(추정 금지)', () => {
    expect(parseDateStrict('2026-05-12')).toBe('2026-05-12');
    expect(parseDateStrict('2026.05.12')).toBe('2026-05-12');
    expect(parseDateStrict('20260512')).toBe('2026-05-12');
    expect(parseDateStrict('2026.13.02')).toBeNull();
    expect(parseDateStrict('2026-02-30')).toBeNull();
    expect(parseDateStrict('abc')).toBeNull();
  });
});
