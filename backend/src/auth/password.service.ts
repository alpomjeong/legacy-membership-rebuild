import { Injectable } from '@nestjs/common';
import * as argon2 from 'argon2';

/**
 * PasswordService — argon2id 솔트 해시/검증 (FR-AUTH-07, NFR-SEC-02).
 * 평문 저장·평문 비교·단순해시(MD5/SHA 단독)·가역 암호 사용 금지.
 */
@Injectable()
export class PasswordService {
  /** 평문 비밀번호를 argon2id 해시로 변환한다(솔트는 argon2 가 내부 생성). */
  hash(plain: string): Promise<string> {
    return argon2.hash(plain, { type: argon2.argon2id });
  }

  /**
   * 저장된 해시와 평문을 검증한다.
   * 해시 포맷이 손상되었거나 비어 있으면 throw 대신 false 로 처리(불일치로 간주, 방어적).
   */
  async verify(hash: string, plain: string): Promise<boolean> {
    if (!hash) {
      return false;
    }
    try {
      return await argon2.verify(hash, plain);
    } catch {
      return false;
    }
  }
}
