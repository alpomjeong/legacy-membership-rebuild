import type { PgDumpConfig } from './pg-dump.service';

export const PG_DUMP_CONFIG = Symbol('PG_DUMP_CONFIG');

export interface PgDumpModuleConfig extends PgDumpConfig {
  /** 앱 자체 @Cron 자동 백업 활성화(기본 off — 앱 내장 Node 백업과의 이중실행 방지). */
  scheduleEnabled: boolean;
}

type Getter = (key: string) => string | undefined;

const int = (v: string | undefined, dflt: number): number => {
  const n = Number(v);
  return v !== undefined && v !== '' && Number.isFinite(n) ? n : dflt;
};

/** 환경변수에서 pg_dump 백업 설정을 읽는다. */
export function loadPgDumpConfig(get: Getter): PgDumpModuleConfig {
  return {
    databaseUrl: get('DATABASE_URL') ?? '',
    backupDir: get('BACKUP_DIR') ?? './backups',
    pgBin: get('PG_BIN') || undefined,
    retentionDays: int(get('BACKUP_RETENTION_DAYS'), 30),
    fullHour: int(get('BACKUP_FULL_HOUR'), 3),
    scheduleEnabled: get('BACKUP_PG_SCHEDULE') === 'true',
    // 백업 암호화 키 — 주민번호 키(JUMIN_ENC_KEY)를 단일 소스로 사용(운영 필수라 자동 암호화).
    //   별도 백업키를 두지 않음: 키 소스가 둘이면 나중에 한쪽만 바꿨을 때 과거 백업이 복원 불가.
    //   ⚠️ JUMIN_ENC_KEY 를 바꾸면 기존 백업·주민번호 모두 복호화 불가 → 절대 변경 금지(최초 1회 고정).
    encKey: get('JUMIN_ENC_KEY') || undefined,
  };
}
