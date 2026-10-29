/* 회원 파생 통계 + 불사 슬롯 표시 로직 (순수, 테스트 대상). */
import type { Reg, Member } from "@/lib/data";
import type { Enshrinement, SlotRule } from "@/lib/types";

export interface StatusBreakdown { cert: number; pending: number; canceled: number }

export function regStatusBreakdown(regs: Reg[]): StatusBreakdown {
  const out: StatusBreakdown = { cert: 0, pending: 0, canceled: 0 };
  for (const r of regs) {
    if (r.canceled) out.canceled++;
    else if (r.cert) out.cert++;
    else out.pending++;
  }
  return out;
}

const DAY_MS = 86_400_000;
function ddays(dateSolar: string, now: Date): number {
  const [y, mo, d] = dateSolar.slice(0, 10).split("-").map(Number);
  const target = new Date(y, mo - 1, d).getTime();
  const base = new Date(now.getFullYear(), now.getMonth(), now.getDate()).getTime();
  return Math.round((target - base) / DAY_MS);
}

export function nextEnshrineDday(member: Member, enshrinements: Enshrinement[], now: Date = new Date()): number | null {
  const eventIds = new Set(member.regs.map((r) => r.eventId).filter((x): x is string => !!x));
  let best: number | null = null;
  for (const e of enshrinements) {
    if (!eventIds.has(String(e.id)) || !e.eventDateSolar) continue;
    const d = ddays(e.eventDateSolar, now);
    if (d >= 0 && (best === null || d < best)) best = d;
  }
  return best;
}

export function visibleSlots(rules: SlotRule[]): SlotRule[] {
  return rules.filter((r) => r.isVisible).sort((a, b) => a.sortOrder - b.sortOrder);
}

const SLOT_FIELD: Record<string, keyof Reg> = {
  bogwija: "bogwija", relationship: "rel", bokjunja: "bokjunja",
  spiritual: "spirit", yesujae: "yesujae", seongju12: "seongju",
};
export function slotValue(reg: Reg, slotKey: string): string {
  const f = SLOT_FIELD[slotKey];
  if (!f) return "";
  const v = reg[f];
  return typeof v === "string" ? v : "";
}
