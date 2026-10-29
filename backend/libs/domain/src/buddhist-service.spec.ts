import {
  normalizeSeongju12,
  normalizeSpiritual,
  PERSON_SLOT_KEYS,
  missingRequiredSlots,
  applyCancel,
  applyCertificate,
  type SlotRule,
  type PersonSlots,
} from './buddhist-service';

describe('normalizeSeongju12 (12성주 공백 정규화)', () => {
  it("'축 성주' → '축성주' (내부 공백 제거)", () => {
    expect(normalizeSeongju12('축 성주')).toBe('축성주');
  });
  it('앞뒤 공백 제거 + 내부 공백 제거', () => {
    expect(normalizeSeongju12('  자 성주 ')).toBe('자성주');
  });
});

describe('normalizeSpiritual (영가 구분자 통일)', () => {
  it('쉼표·슬래시·세미콜론 혼재를 콤마 1개로 통일', () => {
    expect(normalizeSpiritual('김가 / 이나; 박다,라마')).toBe(
      '김가,이나,박다,라마',
    );
  });
  it('빈 항목 제거', () => {
    expect(normalizeSpiritual('김가,,/이나')).toBe('김가,이나');
  });
});

describe('missingRequiredSlots (타입별 필수 슬롯 강제)', () => {
  const rules: SlotRule[] = [
    { slotKey: 'bogwija', isRequired: true },
    { slotKey: 'spiritual', isRequired: false },
  ];
  it('필수 슬롯이 비면 해당 키 반환', () => {
    const slots: PersonSlots = { bogwija: '', spiritual: '김가' };
    expect(missingRequiredSlots(rules, slots)).toEqual(['bogwija']);
  });
  it('필수 슬롯이 채워지면 빈 배열', () => {
    const slots: PersonSlots = { bogwija: '홍길동', spiritual: '' };
    expect(missingRequiredSlots(rules, slots)).toEqual([]);
  });
  it('규칙 없으면(폴백) 강제 없음', () => {
    expect(missingRequiredSlots([], { bogwija: '' })).toEqual([]);
  });
});

describe('applyCancel (취소 워크플로우)', () => {
  const now = new Date('2026-06-21T00:00:00Z');
  it('취소 전환 시 canceledAt 자동 + canceledBy', () => {
    expect(applyCancel(true, now, 7n)).toEqual({
      isCanceled: true,
      canceledAt: now,
      canceledBy: 7n,
    });
  });
  it('신청 복귀 시 클리어', () => {
    expect(applyCancel(false, now, 7n)).toEqual({
      isCanceled: false,
      canceledAt: null,
      canceledBy: null,
    });
  });
});

describe('applyCertificate (증서 워크플로우)', () => {
  const now = new Date('2026-06-21T00:00:00Z');
  it('발급 전환 시 발급일자 자동(수동값 없을 때)', () => {
    expect(applyCertificate(true, now, undefined)).toEqual({
      isCertificateIssued: true,
      certificateIssuedDate: now,
    });
  });
  it('발급 + 수동 일자 지정 시 수동값 우선', () => {
    const manual = new Date('2026-05-01T00:00:00Z');
    expect(applyCertificate(true, now, manual)).toEqual({
      isCertificateIssued: true,
      certificateIssuedDate: manual,
    });
  });
  it('발급안함 시 일자 클리어', () => {
    expect(applyCertificate(false, now, undefined)).toEqual({
      isCertificateIssued: false,
      certificateIssuedDate: null,
    });
  });
});

describe('PERSON_SLOT_KEYS', () => {
  it('6개 인물 슬롯 키', () => {
    expect(PERSON_SLOT_KEYS).toEqual([
      'bogwija',
      'relationship',
      'bokjunja',
      'spiritual',
      'yesujae',
      'seongju12',
    ]);
  });
});
