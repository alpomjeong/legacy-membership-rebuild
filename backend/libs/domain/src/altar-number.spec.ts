import {
  normalizeAltarNumber,
  losesLeadingZeroIfNumeric,
} from './altar-number';

describe('단번호 선행 0 보존 (FR-BUD-05)', () => {
  it('문자열을 그대로 보존한다', () => {
    expect(normalizeAltarNumber('0909')).toBe('0909');
    expect(normalizeAltarNumber('0001')).toBe('0001');
  });

  it('숫자 변환 시 선행 0이 소실되는 값을 감지한다', () => {
    expect(losesLeadingZeroIfNumeric('0909')).toBe(true);
    expect(losesLeadingZeroIfNumeric('0001')).toBe(true);
    expect(losesLeadingZeroIfNumeric('909')).toBe(false);
  });
});
