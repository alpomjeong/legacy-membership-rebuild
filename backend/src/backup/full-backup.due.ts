const sameLocalDay = (a: Date, b: Date): boolean =>
  a.getFullYear() === b.getFullYear() &&
  a.getMonth() === b.getMonth() &&
  a.getDate() === b.getDate();

/**
 * 전체 백업을 지금 돌려야 하는지 판단한다(로컬 시간 기준).
 * - 예약 시각(fullHour) 이전이면 아직 아님.
 * - 아직 한 번도 안 돌았으면 실행.
 * - 오늘 이미 돌았으면 건너뜀. 아니면 실행(→ 예약 시각에 PC 가 꺼져 있었어도 켜지면 캐치업).
 */
export function isFullBackupDue(
  lastFullBackupAt: string | null,
  now: Date,
  fullHour: number,
): boolean {
  if (now.getHours() < fullHour) return false;
  if (!lastFullBackupAt) return true;
  return !sameLocalDay(new Date(lastFullBackupAt), now);
}
