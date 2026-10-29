/** 백엔드 응답 타입 (Phase 1). BigInt id 는 문자열로 직렬화된다. */

export interface Paged<T> {
  items: T[];
  total: number;
  page: number;
  pageSize: number;
}

export interface Member {
  id: string;
  memberName: string;
  displayName: string;
  affiliationCode: string | null;
  phone: string | null;
  address: string | null;
  addressDetail: string | null;
  zipCode: string | null;
  missionaryId: string | null;
  missionaryName: string | null;
  memo: string | null;
  createdAt: string;
  updatedAt: string | null;
}

export interface BuddhistService {
  id: string;
  registrationDate: string;
  memberId: string;
  memberName: string | null;
  buddhistServiceItemId: string;
  buddhistServiceItemName: string | null;
  enshrinementEventId: string | null;
  enshrinementLabel: string | null;
  staffId: string | null;
  staffName: string | null;
  altarNumber: string | null;
  bogwija: string | null;
  relationship: string | null;
  bokjunja: string | null;
  spiritual: string | null;
  yesujae: string | null;
  seongju12: string | null;
  sexagenaryYearId: string | null;
  donationAmount: string | null;
  memo: string | null;
  isCanceled: boolean;
  canceledAt: string | null;
  isCertificateIssued: boolean;
  certificateIssuedDate: string | null;
  createdAt: string;
}

export interface Counsel {
  id: string;
  memberId: string;
  memberName: string | null;
  memberDisplayName: string | null;
  counseledAt: string;
  content: string;
  createdAt: string;
}

export interface Enshrinement {
  id: string;
  eventDateSolar: string;
  label: string | null;
  remark: string | null;
  defaultBuddhistServiceItemId: string | null;
  defaultBuddhistServiceItemName: string | null;
}

export interface RosterRow {
  regId: string;
  memberId: string;
  memberName: string;
  displayName: string;
  buddhistServiceItemName: string | null;
  altarNumber: string | null;
  isCanceled: boolean;
}

export interface SearchHit {
  id: string;
  memberName: string;
  displayName: string;
  phone: string | null;
  missionaryName: string | null;
  matchReasons: string[];
}

export interface Missionary {
  id: string;
  name: string;
}

export interface ServiceItem {
  id: string;
  name: string;
  serviceTypeCode: string | null;
  referenceAmount: string | null;
}

export interface SlotRule {
  slotKey: string;
  isVisible: boolean;
  isRequired: boolean;
  labelOverride: string | null;
  sortOrder: number;
}

export interface SlotRulesResponse {
  serviceTypeCode: string | null;
  rules: SlotRule[];
}

export interface CommonCode {
  id: string;
  groupCode: string;
  code: string;
  name: string;
  shortName?: string | null;
  sortOrder?: number | null;
  isActive?: boolean;
}

/** 인물 슬롯 한국어 라벨(라벨 오버라이드 없을 때 기본). */
export const SLOT_LABELS: Record<string, string> = {
  bogwija: "복위자",
  relationship: "관계",
  bokjunja: "복전자",
  spiritual: "영가",
  yesujae: "예수재",
  seongju12: "12성주",
};
