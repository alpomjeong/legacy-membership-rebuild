/* 폼 ↔ DTO 변환 + KST/ISO 날짜 유틸 (순수 로직, 테스트 대상). */
import type { Member } from "@/lib/types";
import type { Reg } from "@/lib/data";

const pad = (n: number) => String(n).padStart(2, "0");
const trimAdd = (out: Record<string, string>, k: string, v: string) => { const t = v.trim(); if (t) out[k] = t; };

export function parseKstDateTime(s: string): Date | null {
  const m = s.trim().match(/^(\d{4})-(\d{2})-(\d{2})(?:[ T](\d{2}):(\d{2}))?$/);
  if (!m) return null;
  const [, y, mo, d, h = "00", mi = "00"] = m;
  return new Date(Date.UTC(+y, +mo - 1, +d, +h - 9, +mi)); // KST(UTC+9) wall-clock → UTC
}
export function toIso(d: Date): string { return d.toISOString(); }
export function isoToKstText(iso: string): string {
  const k = new Date(new Date(iso).getTime() + 9 * 3600_000);
  return `${k.getUTCFullYear()}-${pad(k.getUTCMonth() + 1)}-${pad(k.getUTCDate())} ${pad(k.getUTCHours())}:${pad(k.getUTCMinutes())}`;
}
export function nowKstText(): string { return isoToKstText(new Date().toISOString()); }

export interface MemberForm {
  memberName: string; phone: string; address: string; addressDetail: string;
  zipCode: string; missionaryId: string; affiliationCode: string; memo: string;
}
export const emptyMemberForm: MemberForm = {
  memberName: "", phone: "", address: "", addressDetail: "", zipCode: "", missionaryId: "", affiliationCode: "", memo: "",
};
export function memberToForm(m: Member): MemberForm {
  return {
    memberName: m.memberName ?? "", phone: m.phone ?? "", address: m.address ?? "",
    addressDetail: m.addressDetail ?? "", zipCode: m.zipCode ?? "", missionaryId: m.missionaryId ?? "",
    affiliationCode: m.affiliationCode ?? "", memo: m.memo ?? "",
  };
}
export function memberFormToDto(f: MemberForm): Record<string, string> {
  const out: Record<string, string> = { memberName: f.memberName.trim() };
  trimAdd(out, "phone", f.phone); trimAdd(out, "address", f.address); trimAdd(out, "addressDetail", f.addressDetail);
  trimAdd(out, "zipCode", f.zipCode); trimAdd(out, "missionaryId", f.missionaryId);
  trimAdd(out, "affiliationCode", f.affiliationCode); trimAdd(out, "memo", f.memo);
  return out;
}

export interface CounselForm { memberId: string; counseledAt: string; content: string }
export function counselFormToDto(f: CounselForm): { memberId: string; counseledAt: string; content: string } {
  const d = parseKstDateTime(f.counseledAt);
  return { memberId: f.memberId, counseledAt: d ? toIso(d) : "", content: f.content.trim() };
}

export interface BulsaForm {
  memberId: string; buddhistServiceItemId: string; enshrinementEventId: string; staffId: string;
  altarNumber: string; donationAmount: string; memo: string;
  bogwija: string; relationship: string; bokjunja: string; spiritual: string; yesujae: string; seongju12: string;
  isCertificateIssued: boolean; certificateIssuedDate: string;
}
export const emptyBulsaForm: BulsaForm = {
  memberId: "", buddhistServiceItemId: "", enshrinementEventId: "", staffId: "",
  altarNumber: "", donationAmount: "", memo: "",
  bogwija: "", relationship: "", bokjunja: "", spiritual: "", yesujae: "", seongju12: "",
  isCertificateIssued: false, certificateIssuedDate: "",
};
export function regToBulsaForm(r: Reg): BulsaForm {
  return {
    memberId: r.memberId ?? "", buddhistServiceItemId: r.itemId ?? "", enshrinementEventId: r.eventId ?? "",
    staffId: r.staffId ?? "", altarNumber: r.altar ?? "", donationAmount: r.donation ? String(r.donation) : "",
    memo: r.memo ?? "", bogwija: r.bogwija ?? "", relationship: r.rel ?? "", bokjunja: r.bokjunja ?? "",
    spiritual: r.spirit ?? "", yesujae: r.yesujae ?? "", seongju12: r.seongju ?? "",
    isCertificateIssued: r.cert, certificateIssuedDate: r.certDate ?? "",
  };
}
export function bulsaFormToDto(f: BulsaForm): Record<string, unknown> {
  const out: Record<string, unknown> = { memberId: f.memberId, buddhistServiceItemId: f.buddhistServiceItemId };
  const s: Record<string, string> = {};
  trimAdd(s, "enshrinementEventId", f.enshrinementEventId); trimAdd(s, "staffId", f.staffId);
  trimAdd(s, "altarNumber", f.altarNumber); trimAdd(s, "bogwija", f.bogwija); trimAdd(s, "relationship", f.relationship);
  trimAdd(s, "bokjunja", f.bokjunja); trimAdd(s, "spiritual", f.spiritual); trimAdd(s, "yesujae", f.yesujae);
  trimAdd(s, "seongju12", f.seongju12); trimAdd(s, "memo", f.memo);
  Object.assign(out, s);
  const amt = f.donationAmount.replace(/[^0-9]/g, ""); if (amt) out.donationAmount = amt;
  if (f.isCertificateIssued) {
    out.isCertificateIssued = true;
    const d = parseKstDateTime(f.certificateIssuedDate);
    if (d) out.certificateIssuedDate = toIso(d);
  }
  return out;
}
