/**
 * 회원 표시명 파생 규칙 (FR-MEM-02 · DM-01)
 * 표시값 `이름_포교원장`은 물리 저장하지 않고 조회 시점에 파생 계산한다.
 * 동명이인 + 동일 포교원장 충돌 시 전화 뒷 4자리로 보강한다 (FR-MEM-03).
 * 순수 함수 — Prisma/HTTP 비의존(Domain 계층).
 */
export interface MemberDisplayInput {
  name: string;
  missionaryName?: string | null;
  phone?: string | null;
  disambiguate?: boolean;
}

export function memberDisplayName(input: MemberDisplayInput): string {
  const base = input.missionaryName
    ? `${input.name}_${input.missionaryName}`
    : input.name;
  if (input.disambiguate && input.phone) {
    const tail = input.phone.replace(/\D/g, '').slice(-4);
    if (tail) return `${base} (${tail})`;
  }
  return base;
}
