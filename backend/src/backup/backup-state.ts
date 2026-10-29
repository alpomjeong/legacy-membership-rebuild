import type { BackupSink } from './sinks/backup-sink.interface';

const STATE_FILE = 'backup-state.json';

export interface BackupRun {
  type: 'full' | 'delta';
  at: string; // ISO
  file: string;
  bytes?: number;
  rows?: number;
  ok: boolean;
  error?: string;
}

export interface BackupState {
  /** 마지막으로 저널에 내보낸 audit_log id (bigint 를 문자열로 보관). */
  cursor: string;
  /** 마지막 전체 백업 시각(ISO) — 부팅 캐치업 판단용. */
  lastFullBackupAt: string | null;
  /** 최근 실행 이력(모니터링/운영용, 상한 있음). */
  runs: BackupRun[];
}

export const DEFAULT_STATE: BackupState = {
  cursor: '0',
  lastFullBackupAt: null,
  runs: [],
};

export async function loadState(sink: BackupSink): Promise<BackupState> {
  try {
    const raw = await sink.readText(STATE_FILE);
    const parsed = JSON.parse(raw) as Partial<BackupState>;
    return { ...DEFAULT_STATE, ...parsed, runs: parsed.runs ?? [] };
  } catch (e) {
    if ((e as NodeJS.ErrnoException).code === 'ENOENT')
      return { ...DEFAULT_STATE };
    throw e;
  }
}

export async function saveState(
  sink: BackupSink,
  state: BackupState,
): Promise<void> {
  await sink.writeText(STATE_FILE, JSON.stringify(state, null, 2));
}

/** 실행 이력을 추가하되 최근 maxRuns 개만 유지한 새 상태를 돌려준다(불변). */
export function appendRun(
  state: BackupState,
  run: BackupRun,
  maxRuns = 100,
): BackupState {
  const runs = [...state.runs, run].slice(-maxRuns);
  return { ...state, runs };
}
