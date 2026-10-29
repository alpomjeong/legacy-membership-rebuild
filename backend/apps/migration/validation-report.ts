/** 검증 리포트 (E0.7 · FR-MIG-07/08). 행번호·원본값·사유 명시. */
export type IssueLevel = 'warn' | 'error';

export interface Issue {
  row: number; // 원본 행 번호(1-based, 헤더 제외)
  field: string;
  original: string;
  reason: string;
  level: IssueLevel;
}

export interface ValidationReport {
  total: number;
  ok: number;
  warn: number;
  error: number;
  issues: Issue[];
}

/** 이슈 목록으로부터 행 단위 정상/경고/오류 집계 리포트를 만든다(오류 행 우선). */
export function buildReport(total: number, issues: Issue[]): ValidationReport {
  const errorRows = new Set(
    issues.filter((i) => i.level === 'error').map((i) => i.row),
  );
  const warnRows = new Set(
    issues.filter((i) => i.level === 'warn').map((i) => i.row),
  );
  for (const r of errorRows) warnRows.delete(r);
  return {
    total,
    error: errorRows.size,
    warn: warnRows.size,
    ok: total - errorRows.size - warnRows.size,
    issues,
  };
}
