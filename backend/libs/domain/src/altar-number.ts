/**
 * 단번호 규칙 (FR-BUD-05 · DM-02)
 * 단번호는 선행 0을 보존하는 **문자열**이다(예: '0909', '0001'). 숫자 변환 금지.
 * 순수 함수 — Domain 계층.
 */
export function normalizeAltarNumber(raw: string): string {
  return raw.trim();
}

/** 숫자로 변환하면 선행 0이 소실되는 값인지(=문자열 보존이 필수인지) 판정 */
export function losesLeadingZeroIfNumeric(raw: string): boolean {
  const v = raw.trim();
  return /^\d+$/.test(v) && String(Number(v)) !== v;
}
