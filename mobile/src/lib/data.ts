/* 프로토타입 도메인 타입(웹 src/data.ts에서 모바일로 이식한 핵심). */
export interface Reg {
  id: number | string;
  date: string; staff: string; event: string | null; item: string; type: string; altar: string;
  bogwija?: string; rel?: string; bokjunja?: string; spirit?: string; yesujae?: string; seongju?: string; sexagenary?: string;
  donation: number; memo?: string; canceled: boolean; cancelDate?: string; cancelBy?: string;
  cert: boolean; certDate?: string; createdAt: string; createdBy: string;
  itemId?: string; eventId?: string | null; staffId?: string | null; sexagenaryYearId?: string | null; memberId?: string;
}
export interface Counsel { date: string; desc: string }
export interface Member {
  id: number | string; name: string; missionary: string; phone: string; aff: string; addr: string; memo: string;
  regs: Reg[]; counsels: Counsel[];
}
