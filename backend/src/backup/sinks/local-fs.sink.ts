import {
  appendFile,
  mkdir,
  readFile,
  readdir,
  rm,
  writeFile,
} from 'node:fs/promises';
import { dirname, join } from 'node:path';
import { gzipSync, gunzipSync } from 'node:zlib';
import type { BackupSink } from './backup-sink.interface';

/**
 * LocalFsSink — BACKUP_DIR 하위 로컬 파일시스템에 백업을 저장한다(온프레미스 기본 구현).
 * 전체 덤프는 gzip, 변경 저널은 평문 NDJSON append.
 */
export class LocalFsSink implements BackupSink {
  constructor(private readonly root: string) {}

  private abs(relPath: string): string {
    return join(this.root, relPath);
  }

  private async ensureParent(absPath: string): Promise<void> {
    await mkdir(dirname(absPath), { recursive: true });
  }

  async writeGzip(
    relPath: string,
    data: string | Buffer,
  ): Promise<{ path: string; bytes: number }> {
    const abs = this.abs(relPath);
    await this.ensureParent(abs);
    const gz = gzipSync(
      typeof data === 'string' ? Buffer.from(data, 'utf8') : data,
    );
    await writeFile(abs, gz);
    return { path: abs, bytes: gz.byteLength };
  }

  async appendText(relPath: string, text: string): Promise<void> {
    const abs = this.abs(relPath);
    await this.ensureParent(abs);
    await appendFile(abs, text, 'utf8');
  }

  async writeText(relPath: string, text: string): Promise<void> {
    const abs = this.abs(relPath);
    await this.ensureParent(abs);
    await writeFile(abs, text, 'utf8');
  }

  async readGzip(relPath: string): Promise<Buffer> {
    return gunzipSync(await readFile(this.abs(relPath)));
  }

  async readText(relPath: string): Promise<string> {
    return readFile(this.abs(relPath), 'utf8');
  }

  async list(relDir: string): Promise<string[]> {
    try {
      return await readdir(this.abs(relDir));
    } catch (e) {
      if ((e as NodeJS.ErrnoException).code === 'ENOENT') return [];
      throw e;
    }
  }

  async remove(relPath: string): Promise<void> {
    await rm(this.abs(relPath), { force: true });
  }
}
