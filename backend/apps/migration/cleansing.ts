/**
 * 마이그레이션 정제 규칙 (E0.7 · FR-MIG-10). 전부 순수 함수.
 * 12성주 공백 정규화 · 영가 구분자 통일 · 단번호 선행 0 보존 ·
 * 취소/증서 boolean 정규화 · varchar 날짜 파싱(모호값은 null=오류, 추정 금지).
 */

/** 12성주 공백 변형 정규화: '축 성주' → '축성주' (내부 공백 제거). */
export function normalizeSeongju12(raw: string): string {
  return raw.replace(/\s+/g, '');
}

/** 영가 클랜 구분자 통일: 언더스코어/다중 공백 → 단일 공백. */
export function normalizeSpirit(raw: string): string {
  return raw.replace(/_/g, ' ').replace(/\s+/g, ' ').trim();
}

/** 단번호 선행 0 보존: 트림만(숫자 변환 금지). '0909' → '0909'. */
export function preserveAltarNumber(raw: string): string {
  return raw.trim();
}

/** 'Y/N' 등 문자열 → boolean. 'y'/'true'/'1'/'yes'=true, 그 외/'N'/공백=false. */
export function toBoolean(raw: string | null | undefined): boolean {
  if (raw == null) return false;
  const v = raw.trim().toLowerCase();
  return v === 'y' || v === 'true' || v === '1' || v === 'yes';
}

/**
 * 날짜 파싱(추정 금지). 허용: YYYY-MM-DD / YYYY.MM.DD / YYYY/MM/DD / YYYYMMDD.
 * 파싱 불가·달력상 비정상(13월, 2/30 등)은 null 반환(오류 분류 대상).
 */
export function parseDateStrict(raw: string | null | undefined): string | null {
  if (raw == null) return null;
  const m = raw.trim().match(/^(\d{4})[-./]?(\d{2})[-./]?(\d{2})$/);
  if (!m) return null;
  const [, y, mo, d] = m;
  const year = Number(y);
  const month = Number(mo);
  const day = Number(d);
  const dt = new Date(Date.UTC(year, month - 1, day));
  if (
    dt.getUTCFullYear() !== year ||
    dt.getUTCMonth() !== month - 1 ||
    dt.getUTCDate() !== day
  ) {
    return null;
  }
  return `${y}-${mo}-${d}`;
}
