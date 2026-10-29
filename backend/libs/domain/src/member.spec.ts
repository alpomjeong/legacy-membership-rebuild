import { normalizeMemberName, memberNaturalKey } from './member';

describe('normalizeMemberName', () => {
  it('앞뒤 공백 제거', () => {
    expect(normalizeMemberName('  홍길동 ')).toBe('홍길동');
  });
  it('내부 연속 공백을 1칸으로 축약', () => {
    expect(normalizeMemberName('홍  길동')).toBe('홍 길동');
  });
});

describe('memberNaturalKey', () => {
  it('정규화 이름 + 포교원장 id 결합', () => {
    expect(memberNaturalKey({ memberName: ' 홍길동 ', missionaryId: 7n })).toBe(
      '홍길동|7',
    );
  });
  it('포교원장 없으면 빈 자리', () => {
    expect(memberNaturalKey({ memberName: '홍길동', missionaryId: null })).toBe(
      '홍길동|',
    );
  });
});
