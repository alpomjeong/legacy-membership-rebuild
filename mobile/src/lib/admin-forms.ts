/* 관리자 리소스 엔티티 타입 + 폼↔DTO 매퍼 (순수, 테스트 대상).
   응답 필드는 각 백엔드 서비스 toView 기준 — 구현 시 확인. */

export interface AdminCode { id: string; groupCode: string; code: string; name: string; shortName?: string | null; sortOrder?: number | null; isActive?: boolean }
export interface AdminMissionary { id: string; name: string; phone?: string | null; address?: string | null; addressDetail?: string | null; isActive?: boolean }
export interface AdminItem { id: string; name: string; serviceTypeCode?: string | null; referenceAmount?: string | null; description?: string | null; isActive?: boolean; usageCount?: number }
export interface AdminStaff {
  id: string; staffNameKo: string; staffNameEn?: string | null; isWorking?: boolean; authLevelCode?: string | null;
  positionCode?: string | null; dutyCode?: string | null; jobGroupCode?: string | null; staffDivCode?: string | null;
  appellationDivCode?: string | null; solarLunarCode?: string | null; birthDate?: string | null; joinDate?: string | null;
  retireDate?: string | null; smsReceiveYn?: boolean;
}
export interface AdminAccount { id: string; loginId: string; staffId?: string | null; staffName?: string | null; isActive: boolean; roleIds: string[]; roleNames?: string }
export interface AdminRole { id: string; name: string; permissions: string[] }

const s = (v: string) => v.trim();
const add = (o: Record<string, unknown>, k: string, v: string) => { const t = v.trim(); if (t) o[k] = t; };

// ── 공통코드 ──
export interface CodeForm { groupCode: string; code: string; name: string; shortName: string; sortOrder: string; isActive: boolean }
export const emptyCodeForm: CodeForm = { groupCode: "", code: "", name: "", shortName: "", sortOrder: "", isActive: true };
export function codeToForm(c: AdminCode): CodeForm {
  return { groupCode: c.groupCode, code: c.code, name: c.name, shortName: c.shortName ?? "", sortOrder: c.sortOrder != null ? String(c.sortOrder) : "", isActive: c.isActive ?? true };
}
export function codeFormToDto(f: CodeForm): Record<string, unknown> {
  const o: Record<string, unknown> = { groupCode: s(f.groupCode), code: s(f.code), name: s(f.name), isActive: f.isActive };
  add(o, "shortName", f.shortName);
  const n = f.sortOrder.replace(/[^0-9]/g, ""); if (n) o.sortOrder = Number(n);
  return o;
}

// ── 포교원장 ──
export interface MissionaryForm { name: string; phone: string; address: string; addressDetail: string; isActive: boolean }
export const emptyMissionaryForm: MissionaryForm = { name: "", phone: "", address: "", addressDetail: "", isActive: true };
export function missionaryToForm(m: AdminMissionary): MissionaryForm {
  return { name: m.name, phone: m.phone ?? "", address: m.address ?? "", addressDetail: m.addressDetail ?? "", isActive: m.isActive ?? true };
}
export function missionaryFormToDto(f: MissionaryForm): Record<string, unknown> {
  const o: Record<string, unknown> = { name: s(f.name), isActive: f.isActive };
  add(o, "phone", f.phone); add(o, "address", f.address); add(o, "addressDetail", f.addressDetail);
  return o;
}

// ── 불사목록 ──
export interface ItemForm { name: string; serviceTypeCode: string; referenceAmount: string; description: string; isActive: boolean }
export const emptyItemForm: ItemForm = { name: "", serviceTypeCode: "", referenceAmount: "", description: "", isActive: true };
export function itemToForm(i: AdminItem): ItemForm {
  return { name: i.name, serviceTypeCode: i.serviceTypeCode ?? "", referenceAmount: i.referenceAmount != null ? String(i.referenceAmount) : "", description: i.description ?? "", isActive: i.isActive ?? true };
}
export function itemFormToDto(f: ItemForm): Record<string, unknown> {
  const o: Record<string, unknown> = { name: s(f.name), isActive: f.isActive };
  add(o, "serviceTypeCode", f.serviceTypeCode); add(o, "description", f.description);
  const amt = f.referenceAmount.replace(/[^0-9]/g, ""); if (amt) o.referenceAmount = amt;
  return o;
}

// ── 사원 ──
export interface StaffForm {
  staffNameKo: string; staffNameEn: string; isWorking: boolean; authLevelCode: string;
  positionCode: string; dutyCode: string; jobGroupCode: string; staffDivCode: string; appellationDivCode: string; solarLunarCode: string;
  birthDate: string; joinDate: string; retireDate: string; smsReceiveYn: boolean;
}
export const emptyStaffForm: StaffForm = {
  staffNameKo: "", staffNameEn: "", isWorking: true, authLevelCode: "",
  positionCode: "", dutyCode: "", jobGroupCode: "", staffDivCode: "", appellationDivCode: "", solarLunarCode: "",
  birthDate: "", joinDate: "", retireDate: "", smsReceiveYn: false,
};
export function staffToForm(st: AdminStaff): StaffForm {
  return {
    staffNameKo: st.staffNameKo, staffNameEn: st.staffNameEn ?? "", isWorking: st.isWorking ?? true, authLevelCode: st.authLevelCode ?? "",
    positionCode: st.positionCode ?? "", dutyCode: st.dutyCode ?? "", jobGroupCode: st.jobGroupCode ?? "", staffDivCode: st.staffDivCode ?? "",
    appellationDivCode: st.appellationDivCode ?? "", solarLunarCode: st.solarLunarCode ?? "", birthDate: st.birthDate ?? "", joinDate: st.joinDate ?? "",
    retireDate: st.retireDate ?? "", smsReceiveYn: st.smsReceiveYn ?? false,
  };
}
export function staffFormToDto(f: StaffForm): Record<string, unknown> {
  const o: Record<string, unknown> = { staffNameKo: s(f.staffNameKo), isWorking: f.isWorking, smsReceiveYn: f.smsReceiveYn };
  for (const k of ["staffNameEn", "authLevelCode", "positionCode", "dutyCode", "jobGroupCode", "staffDivCode", "appellationDivCode", "solarLunarCode", "birthDate", "joinDate", "retireDate"] as const) {
    add(o, k, f[k]);
  }
  return o;
}

// ── 계정 ──
export interface AccountCreateForm { loginId: string; staffId: string; roleIds: string[] }
export function accountCreateToDto(f: AccountCreateForm): Record<string, unknown> {
  const o: Record<string, unknown> = { loginId: s(f.loginId), roleIds: f.roleIds };
  add(o, "staffId", f.staffId);
  return o;
}
export interface AccountEditForm { isActive: boolean; roleIds: string[] }
export function accountEditToDto(f: AccountEditForm): Record<string, unknown> {
  return { isActive: f.isActive, roleIds: f.roleIds };
}
