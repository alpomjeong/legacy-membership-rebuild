import { Injectable, Logger } from '@nestjs/common';
import { ConfigService } from '@nestjs/config';
import { mkdir, readFile, writeFile } from 'node:fs/promises';
import { dirname, resolve, sep } from 'node:path';

/**
 * StorageService — 로컬 파일시스템 스토리지 어댑터 (NFR-FILE-01).
 * 네이티브 온프레미스 구성: 사진/증서/업로드 원본을 STORAGE_DIR 하위에 저장(오브젝트 스토리지/MinIO 불요).
 * DB 에는 key/URL 만 보관(BLOB 인라인 폐기). Content-Type 은 `<key>.type` 사이드카에 기록.
 */
@Injectable()
export class StorageService {
  private readonly logger = new Logger(StorageService.name);
  private readonly baseDir: string;

  constructor(config: ConfigService) {
    this.baseDir = resolve(
      config.get<string>('STORAGE_DIR') ?? './data/uploads',
    );
  }

  /** key → 절대경로. 경로 이탈(..) 차단, 하위폴더(imports/ 등)는 허용. */
  private pathFor(key: string): string {
    const full = resolve(this.baseDir, key);
    if (full !== this.baseDir && !full.startsWith(this.baseDir + sep)) {
      throw new Error(`잘못된 스토리지 키: ${key}`);
    }
    return full;
  }

  /** 객체 저장. key 반환(DB엔 key/메타만 보관). */
  async put(key: string, body: Buffer, contentType: string): Promise<string> {
    const path = this.pathFor(key);
    await mkdir(dirname(path), { recursive: true });
    await writeFile(path, body);
    await writeFile(`${path}.type`, contentType, 'utf8');
    return key;
  }

  /** 객체 바이트 + Content-Type 조회(이미지 서빙용). */
  async getObject(key: string): Promise<{ body: Buffer; contentType: string }> {
    const path = this.pathFor(key);
    const body = await readFile(path);
    let contentType = 'application/octet-stream';
    try {
      const t = (await readFile(`${path}.type`, 'utf8')).trim();
      if (t) contentType = t;
    } catch {
      /* 사이드카 없으면 기본값 */
    }
    return { body, contentType };
  }
}
