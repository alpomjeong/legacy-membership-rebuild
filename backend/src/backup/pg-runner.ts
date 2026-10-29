import { spawn } from 'node:child_process';
import type { PgRunner } from './pg-dump.service';

/**
 * spawnPg — 실제 pg_dump/pg_restore 를 자식 프로세스로 실행하는 PgRunner 구현.
 * 비0 종료 시 stderr 일부와 함께 reject. Windows 는 CreateProcess 가 .exe 를 자동 부여.
 */
export const spawnPg: PgRunner = (bin, args, env) =>
  new Promise<void>((resolve, reject) => {
    const proc = spawn(bin, args, { env, windowsHide: true });
    let stderr = '';
    proc.stderr.on('data', (d: Buffer) => {
      stderr += d.toString();
    });
    proc.on('error', reject);
    proc.on('close', (code) => {
      if (code === 0) resolve();
      else reject(new Error(`${bin} exit ${code}: ${stderr.slice(-500)}`));
    });
  });
