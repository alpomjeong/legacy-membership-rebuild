/** 기일 산출 입력(양력 봉안일). 음력/간지 반복은 Phase 2 — 현재는 양력 기념일(월/일)만. */
export interface MemorialEventInput {
  id: bigint | string;
  eventDateSolar: string | Date;
  label?: string | null;
}

export interface UpcomingMemorial {
  id: string;
  label: string | null;
  /** 올해(또는 연말 넘어가면 내년) 발생일 00:00 로컬 ISO. */
  date: string;
  /** 오늘(00:00)로부터 남은 일수(0=당일). */
  daysUntil: number;
}

const DAY = 86_400_000;

/**
 * now 기준 lookaheadDays 이내(오늘 포함)에 돌아오는 양력 기념일을 산출한다.
 * - 각 이벤트의 월/일로 올해 발생일을 잡고, 이미 지났으면 내년으로(연말→연초 처리).
 * - 남은 일수 오름차순 정렬.
 */
export function upcomingMemorials(
  events: MemorialEventInput[],
  now: Date,
  lookaheadDays: number,
): UpcomingMemorial[] {
  const today = new Date(now.getFullYear(), now.getMonth(), now.getDate());
  const out: UpcomingMemorial[] = [];
  for (const e of events) {
    const src = new Date(e.eventDateSolar);
    if (Number.isNaN(src.getTime())) continue;
    const m = src.getMonth();
    const d = src.getDate();
    let occ = new Date(today.getFullYear(), m, d);
    if (occ.getTime() < today.getTime())
      occ = new Date(today.getFullYear() + 1, m, d);
    const daysUntil = Math.round((occ.getTime() - today.getTime()) / DAY);
    if (daysUntil >= 0 && daysUntil <= lookaheadDays) {
      out.push({
        id: String(e.id),
        label: e.label ?? null,
        date: occ.toISOString(),
        daysUntil,
      });
    }
  }
  return out.sort((a, b) => a.daysUntil - b.daysUntil);
}
