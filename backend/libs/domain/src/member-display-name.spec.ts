import { memberDisplayName } from './member-display-name';

describe('memberDisplayName (FR-MEM-02 / FR-MEM-03)', () => {
  it('이름_포교원장 형태로 파생한다', () => {
    expect(
      memberDisplayName({ name: '홍길동', missionaryName: '무량원' }),
    ).toBe('홍길동_무량원');
  });

  it('포교원장이 없으면 이름만 반환한다', () => {
    expect(memberDisplayName({ name: '홍길동' })).toBe('홍길동');
  });

  it('동명이인 보강 시 전화 뒷 4자리를 덧붙인다', () => {
    expect(
      memberDisplayName({
        name: '홍길동',
        missionaryName: '무량원',
        phone: '010-0000-1234',
        disambiguate: true,
      }),
    ).toBe('홍길동_무량원 (1234)');
  });

  it('disambiguate=true 라도 전화가 없으면 기본 표시', () => {
    expect(
      memberDisplayName({
        name: '홍길동',
        missionaryName: '무량원',
        disambiguate: true,
      }),
    ).toBe('홍길동_무량원');
  });
});
