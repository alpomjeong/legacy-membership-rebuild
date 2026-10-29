/**
 * BackupSink — 백업 산출물(전체 덤프·변경 저널)이 실제로 저장되는 목적지 추상화.
 * 로컬 온프레미스 기본 구현은 LocalFsSink. 추후 S3Sink 등으로 교체 가능하도록 인터페이스만 분리한다.
 */
export interface BackupSink {
  /** gzip 으로 압축해 파일을 쓴다(전체 덤프용). 저장 경로와 바이트 수를 돌려준다. */
  writeGzip(
    relPath: string,
    data: string | Buffer,
  ): Promise<{ path: string; bytes: number }>;
  /** 평문 텍스트를 이어붙인다(변경 저널용, 파일이 없으면 생성). */
  appendText(relPath: string, text: string): Promise<void>;
  /** 평문 텍스트를 덮어쓴다(상태 파일용). */
  writeText(relPath: string, text: string): Promise<void>;
  /** gzip 파일을 읽어 원본 버퍼로 되돌린다(복원용). */
  readGzip(relPath: string): Promise<Buffer>;
  /** 평문 파일을 읽는다(저널 복원용). */
  readText(relPath: string): Promise<string>;
  /** 하위 디렉터리의 파일명 목록(디렉터리 없으면 빈 배열). */
  list(relDir: string): Promise<string[]>;
  /** 파일을 지운다(보존정책 정리용). */
  remove(relPath: string): Promise<void>;
}

export const BACKUP_SINK = Symbol('BACKUP_SINK');
