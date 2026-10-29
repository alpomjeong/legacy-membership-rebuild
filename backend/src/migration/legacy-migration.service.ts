import { spawn } from 'node:child_process';
import { join } from 'node:path';
import { ConflictException, Injectable, Logger } from '@nestjs/common';

/** 레거시 MSSQL 접속 정보(웹 폼에서 입력). 비밀번호는 argv 가 아니라 env 로만 전달. */
export interface LegacyConn {
  host: string;
  port?: number;
  user: string;
  database: string;
  password: string;
}

export interface MigrationRunResult {
  ok: boolean;
  dryRun: boolean;
  /** 스크립트 stdout/stderr 전체(진행 로그). */
  log: string;
  /** `__RESULT__` 요약(JSON). 파싱 실패 시 null. */
  summary: unknown;
  /** 사진 이관 요약(includePhotos 실행 시). 미실행/실패 시 null. */
  photos: unknown;
}

/** stdout 에서 마지막 `__RESULT__ {json}` 줄을 찾아 파싱한다(없으면 null). */
export function parseResultLine(out: string): unknown {
  const lines = out.split(/\r?\n/).filter((l) => l.startsWith('__RESULT__ '));
  if (lines.length === 0) return null;
  try {
    return JSON.parse(lines[lines.length - 1].slice('__RESULT__ '.length));
  } catch {
    return null;
  }
}

/**
 * LegacyMigrationService — 검증된 1회성 마이그레이션 스크립트(apps/migration/*.cjs)를
 * 컨테이너 내부에서 실행한다. 접속정보/비밀번호는 env 로 주입(로그·argv 노출 없음).
 */
@Injectable()
export class LegacyMigrationService {
  private readonly logger = new Logger('LegacyMigration');
  /** 파괴적 이관의 동시 실행 방지(더블클릭·중복 요청). */
  private running = false;

  async run(
    conn: LegacyConn,
    opts: { dryRun: boolean; includePhotos: boolean },
  ): Promise<MigrationRunResult> {
    if (this.running) {
      throw new ConflictException(
        '이미 데이터 이관이 진행 중입니다. 완료 후 다시 시도하세요.',
      );
    }
    this.running = true;
    try {
      return await this.doRun(conn, opts);
    } finally {
      this.running = false;
    }
  }

  private async doRun(
    conn: LegacyConn,
    opts: { dryRun: boolean; includePhotos: boolean },
  ): Promise<MigrationRunResult> {
    const env: NodeJS.ProcessEnv = {
      ...process.env,
      MSSQL_HOST: conn.host,
      MSSQL_PORT: String(conn.port ?? 1433),
      MSSQL_USER: conn.user,
      MSSQL_DB: conn.database,
      MSSQL_PW: conn.password,
      DRY: opts.dryRun ? '1' : '0',
    };

    this.logger.log(
      `레거시 이관 ${opts.dryRun ? '드라이런' : '실행'} — ${conn.user}@${conn.host}:${conn.port ?? 1433}/${conn.database}`,
    );
    let log: string;
    try {
      log = (await this.exec('apps/migration/mssql-migrate.cjs', env)).log;
    } catch (e) {
      // 접속 실패 등은 500 이 아니라 로그를 담은 실패 응답으로 — 웹에서 원인 확인 가능.
      const msg = e instanceof Error ? e.message : String(e);
      this.logger.warn(`레거시 이관 실패: ${msg}`);
      return {
        ok: false,
        dryRun: opts.dryRun,
        log: msg,
        summary: null,
        photos: null,
      };
    }
    const summary = parseResultLine(log);
    let photos: unknown = null;

    const ok = isOk(summary);
    if (!opts.dryRun && opts.includePhotos && ok) {
      // 데이터 적재는 이미 성공한 상태 — 사진 실패가 전체를 500 으로 만들지 않도록 격리.
      try {
        const p = await this.exec('apps/migration/mssql-photos.cjs', {
          ...env,
          DRY: '0',
        });
        photos = parseResultLine(p.log);
        log += `\n\n===== 사진 이관 =====\n${p.log}`;
      } catch (e) {
        const msg = e instanceof Error ? e.message : String(e);
        this.logger.warn(`사진 이관 실패(데이터는 적재됨): ${msg}`);
        photos = { ok: false, error: msg };
        log += `\n\n===== 사진 이관 실패 (데이터 적재는 완료됨) =====\n${msg}`;
      }
    }

    return { ok, dryRun: opts.dryRun, log, summary, photos };
  }

  /** 스크립트를 node 로 실행하고 stdout+stderr 를 합쳐 반환. 비0 종료 + 결과없음이면 throw. */
  private exec(
    script: string,
    env: NodeJS.ProcessEnv,
  ): Promise<{ log: string }> {
    return new Promise((resolve, reject) => {
      const child = spawn(process.execPath, [join(process.cwd(), script)], {
        env,
      });
      let out = '';
      child.stdout.on('data', (d: Buffer) => (out += d.toString()));
      child.stderr.on('data', (d: Buffer) => (out += d.toString()));
      child.on('error', (e) => reject(e));
      child.on('close', (code) => {
        if (code !== 0 && parseResultLine(out) === null) {
          reject(new Error(out.trim() || `스크립트 종료 코드 ${code}`));
          return;
        }
        resolve({ log: out });
      });
    });
  }
}

function isOk(summary: unknown): boolean {
  return (
    typeof summary === 'object' &&
    summary !== null &&
    (summary as { ok?: unknown }).ok === true
  );
}
