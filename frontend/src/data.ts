// 사찰 회원관리 — 도메인 타입 + 인물 슬롯 규칙.
// 화면 데이터는 전부 API(live.ts)에서 온다. 초기 개발용 목업 상수(MEMBERS·STAFF·MISSIONARIES 등)는
// 실인물 정보가 섞여 있었고 참조하는 코드도 없어 삭제했다(2026-08-16).
// 불사 신청내역(Reg)은 실제 칼럼이 많아(DM-02) 전 필드를 보존해 가시성 확보에 사용.

export interface Reg {
  id: number | string;
  date: string;          // 신청일
  staff: string;         // 접수사원
  event: string | null;  // 봉안일
  item: string;          // 불사목록명
  type: string;          // 서비스 타입(슬롯 규칙 구동)
  altar: string;         // 단번호(선행 0 보존)
  bogwija?: string;      // 복위자
  rel?: string;          // 관계
  bokjunja?: string;     // 복전자(다건)
  spirit?: string;       // 영가
  yesujae?: string;      // 제자 재(예수재)
  seongju?: string;      // 12성주
  sexagenary?: string;   // 생년월일(육십갑자)
  donation: number;      // 시주(보시) 금액
  memo?: string;
  canceled: boolean;
  cancelDate?: string;
  cancelBy?: string;
  cert: boolean;
  certDate?: string;
  createdAt: string;     // 입력일시(감사)
  createdBy: string;     // 생성자(감사)
  itemId?: string;       // (live) 불사목록 id — API 저장용
  eventId?: string | null; // (live) 봉안일 id — API 저장용
  staffId?: string | null; // (live) 접수사원 id — API 저장용
  sexagenaryYearId?: string | null; // (live) 육십갑자 id — API 저장용
  memberId?: string;     // (live) 소유 회원 id — API 저장용
}

export interface Counsel { date: string; desc: string }

export interface Member {
  id: number | string;
  name: string;
  missionary: string;
  phone: string;
  aff: string;
  addr: string;
  memo: string;
  regs: Reg[];
  counsels: Counsel[];
}

// 서비스 타입별 인물 슬롯 (DM-20). 참고용 — 입력/수정 폼은 타입과 무관하게 전체 슬롯을 노출한다.
export const SLOT_DEFS: Record<string, { keys: string[]; info: string }> = {
  "위패형": { keys: ["bogwija", "rel", "spirit", "yesujae"], info: "5정보" },
  "12지신등명불형": { keys: ["bokjunja", "seongju"], info: "3정보" },
  "미설정": { keys: ["bogwija", "rel", "bokjunja", "spirit", "yesujae", "seongju"], info: "폴백" },
};
// 인물 슬롯 전체 — 불사종류와 무관하게 항상 입력 가능(운영 요청). 저장은 공란 허용.
export const ALL_SLOT_KEYS = ["bogwija", "rel", "bokjunja", "spirit", "yesujae", "seongju"];
export const SLOT_LABEL: Record<string, string> = {
  bogwija: "복위자", rel: "관계", bokjunja: "복전자", spirit: "영가", yesujae: "예수재", seongju: "12성주",
};
export const SLOT_HINT: Record<string, string> = {
  bogwija: "조상 봉안자", rel: "조상과의 관계", bokjunja: "불상에 이름 붙는 사람 · 다건", spirit: "위패 망자명", yesujae: "위패 생자명(예수재→제자 재)", seongju: "12지신 중 하나",
};
