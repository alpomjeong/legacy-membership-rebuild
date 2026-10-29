import { mapBulsaRow, type NormalizedBulsa } from './bulsa-mapper';

describe('mapBulsaRow (정제·매핑·검증 · FR-MIG-10)', () => {
  it('정상 행: 정규화 + legacyKey, 단번호 선행 0 보존', () => {
    const { row, issues } = mapBulsaRow(
      {
        회원명: '홍길동',
        포교원장: '무량원',
        불사명: '12지신등명불',
        단번호: '0909',
        '12성주': '축 성주',
        봉안일: '2026-05-12',
        취소여부: '',
        증서발급: 'Y',
      },
      1,
    );
    expect(row).not.toBeNull();
    const r = row as NormalizedBulsa;
    expect(r.altarNumber).toBe('0909');
    expect(r.seongju12).toBe('축성주');
    expect(r.certIssued).toBe(true);
    expect(r.canceled).toBe(false);
    expect(r.legacyKey).toContain('홍길동|무량원|12지신등명불|0909');
    expect(issues.some((i) => i.level === 'warn' && i.field === '12성주')).toBe(
      true,
    );
  });

  it('모호 날짜 행: error 이슈 + row=null(적재 제외)', () => {
    const { row, issues } = mapBulsaRow(
      {
        회원명: '성춘향',
        포교원장: '안산',
        불사명: '칠성기도',
        단번호: '0142',
        봉안일: '2026.13.02',
      },
      2,
    );
    expect(row).toBeNull();
    expect(
      issues.some((i) => i.level === 'error' && i.field === '봉안일'),
    ).toBe(true);
  });

  it('회원명 누락: error', () => {
    const { row, issues } = mapBulsaRow(
      { 회원명: '', 불사명: '위패', 단번호: '0001' },
      3,
    );
    expect(row).toBeNull();
    expect(
      issues.some((i) => i.field === '회원명' && i.level === 'error'),
    ).toBe(true);
  });
});
