/**
 * 불사 신청 도메인 규칙 (DM-02 / DM-20) — 순수 함수(Prisma/HTTP 비의존).
 * 인물 슬롯 정규화(12성주 공백·영가 구분자), 타입별 필수 슬롯 검증,
 * 취소/증서 워크플로우 상태전환을 제공한다. 단번호는 altar-number 모듈 참조.
 */

/** 인물 슬롯 키 — DM-20 SlotKey. 검색 인덱싱 대상은 ServiceTypeSlotRule.SearchIndexed 로 별도 관리. */
export const PERSON_SLOT_KEYS = [
  'bogwija',
  'relationship',
  'bokjunja',
  'spiritual',
  'yesujae',
  'seongju12',
] as const;

export type SlotKey = (typeof PERSON_SLOT_KEYS)[number];

export type PersonSlots = Partial<Record<SlotKey, string | null | undefined>>;

export interface SlotRule {
  slotKey: string;
  isRequired: boolean;
}

/** 12성주: 내부 공백을 제거한다('축 성주'→'축성주'). 레거시 공백 변형 정규화(FR-BUD-19). */
export function normalizeSeongju12(raw: string): string {
  return raw.replace(/\s+/g, '');
}

/** 영가: 쉼표/슬래시/세미콜론 등 혼재 구분자를 콤마 1개로 통일하고 빈 항목을 제거(FR-BUD-19). */
export function normalizeSpiritual(raw: string): string {
  return raw
    .split(/[,/;]+/)
    .map((s) => s.trim())
    .filter((s) => s.length > 0)
    .join(',');
}

/** 타입별 필수 슬롯 중 비어 있는 키 목록을 반환(폴백: 규칙 없으면 강제 없음, FR-BUD-19). */
export function missingRequiredSlots(
  rules: SlotRule[],
  slots: PersonSlots,
): string[] {
  return rules
    .filter((r) => r.isRequired)
    .filter((r) => {
      const v = slots[r.slotKey as SlotKey];
      return v == null || v.trim().length === 0;
    })
    .map((r) => r.slotKey);
}

/** 취소 전환: 취소 시 일시/주체 자동, 복귀 시 클리어(FR-BUD-13). */
export function applyCancel(
  isCanceled: boolean,
  now: Date,
  actorId: bigint,
): { isCanceled: boolean; canceledAt: Date | null; canceledBy: bigint | null } {
  return isCanceled
    ? { isCanceled: true, canceledAt: now, canceledBy: actorId }
    : { isCanceled: false, canceledAt: null, canceledBy: null };
}

/** 증서 전환: 발급 시 일자 자동(수동값 우선), 발급안함 시 클리어(FR-BUD-14). */
export function applyCertificate(
  isIssued: boolean,
  now: Date,
  manualDate: Date | undefined,
): { isCertificateIssued: boolean; certificateIssuedDate: Date | null } {
  return isIssued
    ? { isCertificateIssued: true, certificateIssuedDate: manualDate ?? now }
    : { isCertificateIssued: false, certificateIssuedDate: null };
}
