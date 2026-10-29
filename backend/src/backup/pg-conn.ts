/**
 * pg-conn — DATABASE_URL 을 pg_dump/pg_restore 호출용 접속정보로 파싱하고 인자 배열을 구성한다.
 * 비밀번호는 argv 에 넣지 않고(노출/인젝션 방지) 호출 측에서 PGPASSWORD 환경변수로 주입한다.
 */
export interface PgConn {
  host: string;
  port: number;
  database: string;
  user: string;
  password: string;
}

export function parseDatabaseUrl(url: string): PgConn {
  const u = new URL(url);
  return {
    host: u.hostname,
    port: u.port ? Number(u.port) : 5432,
    database: decodeURIComponent(u.pathname.replace(/^\//, '')),
    user: decodeURIComponent(u.username),
    password: decodeURIComponent(u.password),
  };
}

const baseArgs = (c: PgConn): string[] => [
  '-h',
  c.host,
  '-p',
  String(c.port),
  '-U',
  c.user,
  '-d',
  c.database,
];

/** pg_dump 커스텀 포맷(-Fc, 압축·pg_restore 복원) 인자. */
export function buildDumpArgs(c: PgConn, outFile: string): string[] {
  return [...baseArgs(c), '-Fc', '-f', outFile];
}

/** pg_restore 인자 — 기존 객체 정리 후 복원, 소유자 재설정 생략. */
export function buildRestoreArgs(c: PgConn, file: string): string[] {
  return [...baseArgs(c), '--clean', '--if-exists', '--no-owner', file];
}
