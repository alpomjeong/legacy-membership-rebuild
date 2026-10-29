/**
 * 회원 도메인 규칙 (DM-01) — 순수 함수(Prisma/HTTP 비의존).
 * 이름 정규화와 자연키(중복 경고·표시명 disambiguation 공용)를 제공한다.
 */
export function normalizeMemberName(raw: string): string {
  return raw.trim().replace(/\s+/g, ' ');
}

export function memberNaturalKey(input: {
  memberName: string;
  missionaryId: bigint | null;
}): string {
  return `${normalizeMemberName(input.memberName)}|${input.missionaryId ?? ''}`;
}
