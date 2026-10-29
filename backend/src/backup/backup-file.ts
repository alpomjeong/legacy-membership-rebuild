/**
 * 백업 파일명 화이트리스트 — 다운로드/복원 시 경로 탈출(../, 절대경로) 차단.
 * 순수 파일명 + .dump 확장자만 허용.
 */
export function isSafeBackupName(name: unknown): boolean {
  if (typeof name !== 'string' || name.length === 0) return false;
  if (name.includes('/') || name.includes('\\') || name.includes('..'))
    return false;
  return /^[A-Za-z0-9._-]+\.dump$/.test(name);
}
