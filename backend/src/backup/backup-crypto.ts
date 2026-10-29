import {
  createCipheriv,
  createDecipheriv,
  createHash,
  randomBytes,
} from 'node:crypto';

/**
 * 백업 파일 암호화 — AES-256-GCM. 백업엔 주민번호 등 평문 PII 가 담기므로 저장/다운로드본을
 * 암호화한다. 포맷: MAGIC(6) + IV(12) + AUTH_TAG(16) + CIPHERTEXT.
 * 키는 시크릿(JUMIN_ENC_KEY)에서 파생하되 주민번호 암호화와 다른 키가 되도록 도메인 분리.
 */
const MAGIC = Buffer.from('TMENC1', 'ascii');
const IV_LEN = 12;
const TAG_LEN = 16;
const HEADER_LEN = MAGIC.length + IV_LEN + TAG_LEN;

// 도메인 분리 상수 — 주민번호 암호화 키와 다른 키가 되도록. 눈에 보이는 ASCII 로 고정한다
// (제어문자/공백은 포매터·편집기가 조용히 바꿔 키가 달라질 수 있으므로 금지). 절대 변경 금지.
const BACKUP_KEY_DOMAIN = 'tm-backup-key-v1';
function deriveKey(secret: string): Buffer {
  return createHash('sha256')
    .update(BACKUP_KEY_DOMAIN)
    .update('|')
    .update(secret)
    .digest();
}

/** 버퍼가 우리 암호화 포맷(MAGIC 시작)인지. */
export function isEncryptedBackup(buf: Buffer): boolean {
  return (
    buf.length >= MAGIC.length && buf.subarray(0, MAGIC.length).equals(MAGIC)
  );
}

export function encryptBackup(plain: Buffer, secret: string): Buffer {
  const iv = randomBytes(IV_LEN);
  const cipher = createCipheriv('aes-256-gcm', deriveKey(secret), iv);
  const ct = Buffer.concat([cipher.update(plain), cipher.final()]);
  return Buffer.concat([MAGIC, iv, cipher.getAuthTag(), ct]);
}

export function decryptBackup(enc: Buffer, secret: string): Buffer {
  if (!isEncryptedBackup(enc)) {
    throw new Error('암호화된 백업 포맷이 아닙니다.');
  }
  const iv = enc.subarray(MAGIC.length, MAGIC.length + IV_LEN);
  const tag = enc.subarray(MAGIC.length + IV_LEN, HEADER_LEN);
  const ct = enc.subarray(HEADER_LEN);
  const decipher = createDecipheriv('aes-256-gcm', deriveKey(secret), iv);
  decipher.setAuthTag(tag);
  return Buffer.concat([decipher.update(ct), decipher.final()]);
}
