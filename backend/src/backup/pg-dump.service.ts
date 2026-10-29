import {
  mkdir,
  readdir,
  readFile,
  rm,
  stat,
  writeFile,
} from 'node:fs/promises';
import { tmpdir } from 'node:os';
import { randomBytes } from 'node:crypto';
import { join } from 'node:path';
import { parseDatabaseUrl, buildDumpArgs, buildRestoreArgs } from './pg-conn';
import { stamp } from './full-backup.service';
import { isSafeBackupName } from './backup-file';
import {
  encryptBackup,
  decryptBackup,
  isEncryptedBackup,
} from './backup-crypto';

/** now 이후 fullHour(로컬)의 다음 실행 시각. */
export function nextRunAt(now: Date, fullHour: number): Date {
  const d = new Date(now);
  d.setHours(fullHour, 0, 0, 0);
  if (d <= now) d.setDate(d.getDate() + 1);
  return d;
}

/** 자동 백업 스케줄 설정(웹에서 변경, 파일 영속). */
export interface SchedulePref {
  /** 자동 백업 사용 여부. */
  enabled: boolean;
  /** 자동 백업 시각(로컬 0~23시). */
  fullHour: number;
}

/** 마지막 복원 정보 — 현재 DB 가 어느 백업본으로 되돌려졌는지. */
export interface RestoreState {
  /** 복원에 사용한 백업 파일명. */
  file: string;
  /** 복원 실행 시각(ISO). */
  at: string;
}

/** fullHour 를 0~23 정수로 정규화(범위 밖/비정수는 clamp/반올림). */
function normalizeHour(h: number, dflt: number): number {
  if (!Number.isFinite(h)) return dflt;
  return Math.min(23, Math.max(0, Math.round(h)));
}

export interface PgDumpConfig {
  databaseUrl: string;
  backupDir: string;
  /** pg_dump/pg_restore 폴더. 비면 PATH 에서 찾음. */
  pgBin?: string;
  retentionDays: number;
  /** 자동 백업 시각(로컬 0~23시) — 스케줄 파일이 없을 때의 기본값. */
  fullHour: number;
  /** 자동 백업 활성 기본값(env BACKUP_PG_SCHEDULE) — 스케줄 파일이 없을 때 사용. */
  scheduleEnabled?: boolean;
  /** 백업 암호화 키(파생 원본). 설정 시 저장/다운로드본을 AES-256-GCM 으로 암호화. 미설정이면 평문(개발). */
  encKey?: string;
}

/** child_process 실행 추상화(테스트 주입용). 비0 종료 시 reject. */
export type PgRunner = (
  bin: string,
  args: string[],
  env: NodeJS.ProcessEnv,
) => Promise<void>;

export interface BackupFileMeta {
  name: string;
  bytes: number;
  at: string; // ISO (파일 수정시각)
}

/**
 * PgDumpService — 웹/스케줄러가 pg_dump·pg_restore 를 구동해 백업/복원한다(Windows 네이티브 전제).
 * 비밀번호는 argv 가 아니라 PGPASSWORD 환경변수로만 전달.
 */
export class PgDumpService {
  constructor(
    private readonly config: PgDumpConfig,
    private readonly run: PgRunner,
  ) {}

  private bin(name: string): string {
    return this.config.pgBin ? join(this.config.pgBin, name) : name;
  }

  private fullDir(): string {
    return join(this.config.backupDir, 'full');
  }

  private scheduleFile(): string {
    return join(this.config.backupDir, 'schedule.json');
  }

  /** 스케줄 파일이 없을 때의 기본값(env 유래). */
  private scheduleDefault(): SchedulePref {
    return {
      enabled: this.config.scheduleEnabled ?? false,
      fullHour: normalizeHour(this.config.fullHour, 3),
    };
  }

  /** 현재 자동 백업 스케줄 설정(파일 우선, 없으면 env 기본값). */
  async getSchedule(): Promise<SchedulePref> {
    const dflt = this.scheduleDefault();
    let raw: string;
    try {
      raw = await readFile(this.scheduleFile(), 'utf8');
    } catch (e) {
      if ((e as NodeJS.ErrnoException).code === 'ENOENT') return dflt;
      throw e;
    }
    try {
      const p = JSON.parse(raw) as Partial<SchedulePref>;
      return {
        enabled: typeof p.enabled === 'boolean' ? p.enabled : dflt.enabled,
        fullHour: normalizeHour(Number(p.fullHour), dflt.fullHour),
      };
    } catch {
      // 손상된 파일은 기본값으로 폴백(운영 중 파싱오류로 스케줄이 멈추지 않게). 무음 방지 위해 경고.
      console.warn(
        `[PgDump] schedule.json 파싱 실패 — 기본값(enabled=${dflt.enabled}, ${dflt.fullHour}시) 사용. 웹에서 스케줄 재저장 권장.`,
      );
      return dflt;
    }
  }

  private restoreStateFile(): string {
    return join(this.config.backupDir, 'restore-state.json');
  }

  /** 마지막 복원 정보(현재 적용된 백업본). 복원 이력이 없으면 null. */
  async getRestoreState(): Promise<RestoreState | null> {
    let raw: string;
    try {
      raw = await readFile(this.restoreStateFile(), 'utf8');
    } catch {
      return null; // 파일 없음/읽기 실패 → 복원 이력 없음으로 간주
    }
    try {
      const p = JSON.parse(raw) as Partial<RestoreState>;
      return typeof p.file === 'string' && typeof p.at === 'string'
        ? { file: p.file, at: p.at }
        : null;
    } catch {
      return null;
    }
  }

  /** 복원 성공 시 현재 적용 백업본을 기록. */
  private async recordRestore(file: string, at: Date): Promise<void> {
    await mkdir(this.config.backupDir, { recursive: true });
    await writeFile(
      this.restoreStateFile(),
      JSON.stringify({ file, at: at.toISOString() }, null, 2),
      'utf8',
    );
  }

  /** 자동 백업 스케줄 설정을 저장하고 정규화된 값을 반환한다. */
  async setSchedule(pref: SchedulePref): Promise<SchedulePref> {
    const next: SchedulePref = {
      enabled: !!pref.enabled,
      fullHour: normalizeHour(
        Number(pref.fullHour),
        this.scheduleDefault().fullHour,
      ),
    };
    await mkdir(this.config.backupDir, { recursive: true });
    await writeFile(this.scheduleFile(), JSON.stringify(next, null, 2), 'utf8');
    return next;
  }

  /** 지금 전체 백업. suffix 로 안전백업 등 이름 구분(예: '-presafe'). */
  async backupNow(
    now: Date = new Date(),
    suffix = '',
  ): Promise<BackupFileMeta> {
    const conn = parseDatabaseUrl(this.config.databaseUrl);
    const name = `temple-${stamp(now)}${suffix}.dump`;
    const dir = this.fullDir();
    await mkdir(dir, { recursive: true });
    const outFile = join(dir, name);
    await this.run(this.bin('pg_dump'), buildDumpArgs(conn, outFile), {
      ...process.env,
      PGPASSWORD: conn.password,
    });
    // 저장 직후 암호화(주민번호 등 평문 PII 보호). 키 없으면 평문 유지(개발).
    if (this.config.encKey) {
      const plain = await readFile(outFile);
      await writeFile(outFile, encryptBackup(plain, this.config.encKey));
    }
    const bytes = (await stat(outFile)).size;
    await this.prune();
    return { name, bytes, at: now.toISOString() };
  }

  /** 백업 목록(최신순). */
  async list(): Promise<BackupFileMeta[]> {
    let files: string[];
    try {
      files = await readdir(this.fullDir());
    } catch (e) {
      if ((e as NodeJS.ErrnoException).code === 'ENOENT') return [];
      throw e;
    }
    const metas: BackupFileMeta[] = [];
    for (const name of files.filter((f) => f.endsWith('.dump'))) {
      const s = await stat(join(this.fullDir(), name));
      metas.push({ name, bytes: s.size, at: s.mtime.toISOString() });
    }
    // 시각(mtime) 기준 최신순 — 파일명 정렬은 접미사(-up/-presafe/uploaded)에 취약해
    // '마지막 백업'을 오판(→ 매분 백업)할 수 있으므로 실제 수정시각으로 정렬한다.
    return metas.sort((a, b) =>
      a.at < b.at ? 1 : a.at > b.at ? -1 : b.name.localeCompare(a.name),
    );
  }

  /**
   * 백업 파일로 복원(파괴적). safety=true 면 복원 직전 안전백업(-presafe)을 먼저 뜬다.
   * 파일명은 화이트리스트 검증(경로탈출 차단).
   */
  async restore(
    name: string,
    opts: { safety?: boolean } = {},
  ): Promise<{ restored: string; safetyBackup?: string }> {
    if (!isSafeBackupName(name)) throw new Error(`잘못된 백업 파일명: ${name}`);
    const file = join(this.fullDir(), name);
    await stat(file); // 존재 확인(없으면 throw)
    let safetyBackup: string | undefined;
    if (opts.safety)
      safetyBackup = (await this.backupNow(new Date(), '-presafe')).name;
    const conn = parseDatabaseUrl(this.config.databaseUrl);
    // 암호화된 백업이면 임시 복호화본으로 복원(pg_restore 는 평문 dump 필요). 끝나면 즉시 삭제.
    const raw = await readFile(file);
    let restoreFrom = file;
    let tmp: string | undefined;
    if (isEncryptedBackup(raw)) {
      if (!this.config.encKey)
        throw new Error(
          '암호화된 백업이지만 복호화 키가 없습니다(JUMIN_ENC_KEY 확인).',
        );
      // 평문 복호화본은 백업 폴더 밖(OS 임시폴더)+랜덤명으로 — prune 무관·동시복원 충돌 방지·
      //   재기동/청소로 잔존 최소화. 정상 경로에선 finally 로 즉시 삭제.
      tmp = join(tmpdir(), `tmrestore-${randomBytes(8).toString('hex')}.dump`);
      await writeFile(tmp, decryptBackup(raw, this.config.encKey));
      restoreFrom = tmp;
    }
    try {
      await this.run(
        this.bin('pg_restore'),
        buildRestoreArgs(conn, restoreFrom),
        {
          ...process.env,
          PGPASSWORD: conn.password,
        },
      );
    } finally {
      if (tmp) await rm(tmp, { force: true }); // 평문 복호화본 잔존 최소화
    }
    await this.recordRestore(name, new Date()); // 현재 적용 백업본 기록
    return { restored: name, safetyBackup };
  }

  /**
   * 업로드된 .dump(사용자 PC 에서 첨부)를 검증 후 백업 폴더에 저장하고 파일명을 반환한다.
   * pg_dump 커스텀 포맷 매직바이트('PGDMP')를 확인해 잘못된 파일을 차단(복원 전 방어).
   */
  async importUploaded(
    buffer: Buffer,
    now: Date = new Date(),
  ): Promise<string> {
    const isPgdmp =
      buffer.length >= 5 && buffer.subarray(0, 5).toString('ascii') === 'PGDMP';
    const isEnc = isEncryptedBackup(buffer);
    if (!isPgdmp && !isEnc) {
      throw new Error(
        '올바른 pg_dump 커스텀 포맷(.dump) 또는 암호화된 백업 파일이 아닙니다.',
      );
    }
    // 암호화 업로드는 매직바이트만 믿지 말고 이 서버 키로 실제 복호화 검증 —
    //   다른 환경/키로 만든 복원불가 파일을 저장(→ 나중에 복원 500, prune 이 정상 백업 밀어냄)하지 않게.
    if (isEnc) {
      if (!this.config.encKey)
        throw new Error('암호화된 백업이지만 이 서버에 복호화 키가 없습니다.');
      try {
        decryptBackup(buffer, this.config.encKey);
      } catch {
        throw new Error(
          '이 서버의 키로 복호화할 수 없는 백업입니다(다른 환경/키로 암호화됨).',
        );
      }
    }
    // 평문 업로드는 저장 전 암호화(at-rest 일관성). 이미 암호화본이면 그대로 저장.
    const toStore =
      isPgdmp && this.config.encKey
        ? encryptBackup(buffer, this.config.encKey)
        : buffer;
    // 날짜 프리픽스로 시작해야 prune 의 이름 정렬(최신순)에 다른 백업과 함께 섞인다.
    // 'temple-uploaded-*' 는 'temple-2026*' 보다 위로 정렬돼 실제 백업을 보존창에서 밀어냈음 → 수정.
    const name = `temple-${stamp(now)}-up.dump`;
    const dir = this.fullDir();
    await mkdir(dir, { recursive: true });
    await writeFile(join(dir, name), toStore);
    return name;
  }

  /** 안전 검증된 백업 파일의 절대경로(다운로드용). 잘못된 이름이면 throw. */
  pathFor(name: string): string {
    if (!isSafeBackupName(name)) throw new Error(`잘못된 백업 파일명: ${name}`);
    return join(this.fullDir(), name);
  }

  /** 대상 DB 이름(복원 확인 토큰으로 사용). */
  databaseName(): string {
    return parseDatabaseUrl(this.config.databaseUrl).database;
  }

  /** 상태 카드 데이터: 마지막 백업·개수·다음 자동실행·스케줄 시각·활성 여부. */
  async status(
    now: Date = new Date(),
    schedule?: SchedulePref,
  ): Promise<{
    last: BackupFileMeta | null;
    count: number;
    nextRunAt: string;
    fullHour: number;
    enabled: boolean;
    database: string;
    lastRestore: RestoreState | null;
    hostDir: string | null;
  }> {
    const files = await this.list();
    const sch = schedule ?? (await this.getSchedule());
    return {
      last: files[0] ?? null,
      count: files.length,
      nextRunAt: nextRunAt(now, sch.fullHour).toISOString(),
      fullHour: sch.fullHour,
      enabled: sch.enabled,
      database: this.databaseName(),
      lastRestore: await this.getRestoreState(),
      // 실제 저장 위치(표시용). 네이티브는 backupDir 이 곧 호스트 경로.
      hostDir: process.env.BACKUP_HOST_DIR ?? this.config.backupDir,
    };
  }

  /** 보존일수 초과분 정리(최신 N개 유지). */
  private async prune(): Promise<void> {
    const files = (await this.list()).map((f) => f.name); // 이미 최신순
    for (const name of files.slice(this.config.retentionDays)) {
      await rm(join(this.fullDir(), name), { force: true });
    }
  }
}
