import { Injectable } from '@nestjs/common';
import { ConfigService } from '@nestjs/config';
import {
  createCipheriv,
  createDecipheriv,
  createHash,
  randomBytes,
} from 'node:crypto';

/**
 * CryptoService — PII(주민번호) 암호화/마스킹 (NFR-SEC, FR-HR-03).
 * AES-256-GCM. 저장 포맷 = [iv(12) | authTag(16) | ciphertext]. 키는 시크릿에서 SHA-256 파생.
 * 평문 저장 금지, 복호화 접근은 호출측에서 AuditLog 적재.
 */
@Injectable()
export class CryptoService {
  private readonly key: Buffer;

  constructor(config: ConfigService) {
    const secret =
      config.get<string>('JUMIN_ENC_KEY') ?? 'local-dev-jumin-key-change-me';
    this.key = createHash('sha256').update(secret).digest();
  }

  encrypt(plain: string): Buffer {
    const iv = randomBytes(12);
    const cipher = createCipheriv('aes-256-gcm', this.key, iv);
    const ct = Buffer.concat([cipher.update(plain, 'utf8'), cipher.final()]);
    const tag = cipher.getAuthTag();
    return Buffer.concat([iv, tag, ct]);
  }

  decrypt(buf: Buffer): string {
    const iv = buf.subarray(0, 12);
    const tag = buf.subarray(12, 28);
    const ct = buf.subarray(28);
    const decipher = createDecipheriv('aes-256-gcm', this.key, iv);
    decipher.setAuthTag(tag);
    return Buffer.concat([decipher.update(ct), decipher.final()]).toString(
      'utf8',
    );
  }

  /** 화면 표시용 마스킹 — 앞 6자리 + 성별 1자리 노출, 나머지 `*`. */
  mask(jumin: string): string {
    const digits = jumin.replace(/\D/g, '');
    if (digits.length < 7) return '******';
    return `${digits.slice(0, 6)}-${digits.slice(6, 7)}******`;
  }
}
