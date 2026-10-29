export const BACKUP_OPTIONS = Symbol('BACKUP_OPTIONS');

export interface BackupOptions {
  /** 백업 스케줄러 활성화 여부(비활성 시 어떤 백업도 돌지 않음). */
  enabled: boolean;
  /** 백업 산출물 루트 디렉터리(도커면 호스트 볼륨으로 마운트 권장). */
  dir: string;
  /** 전체 백업 실행 시각(로컬 기준 0~23시, 기본 3시). 그 시각 이후 첫 tick 에서 하루 1회 실행. */
  fullHour: number;
  /** 보존할 최근 전체 백업 개수(≈일). */
  fullRetentionDays: number;
  /** 변경 저널 flush 주기(ms). */
  deltaDebounceMs: number;
  /** 저널 파일 보존 일수. */
  journalRetentionDays: number;
}

type Getter = (key: string) => string | undefined;

const int = (v: string | undefined, dflt: number): number => {
  const n = Number(v);
  return Number.isFinite(n) && v !== undefined && v !== '' ? n : dflt;
};

/**
 * 환경변수에서 백업 옵션을 읽는다. 운영(NODE_ENV=production)에서는 기본 활성,
 * 그 외 환경에서는 기본 비활성(개발/CI 중 실수로 백업이 돌지 않도록). BACKUP_ENABLED 로 명시 override.
 */
export function loadBackupConfig(
  get: Getter,
  nodeEnv = process.env.NODE_ENV,
): BackupOptions {
  const enabledRaw = get('BACKUP_ENABLED');
  const enabled =
    enabledRaw != null ? enabledRaw === 'true' : nodeEnv === 'production';
  return {
    enabled,
    dir: get('BACKUP_DIR') ?? './backups',
    fullHour: int(get('BACKUP_FULL_HOUR'), 3),
    fullRetentionDays: int(get('BACKUP_FULL_RETENTION_DAYS'), 30),
    deltaDebounceMs: int(get('BACKUP_DELTA_DEBOUNCE_MS'), 5000),
    journalRetentionDays: int(get('BACKUP_JOURNAL_RETENTION_DAYS'), 90),
  };
}
