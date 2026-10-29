import { PasswordService } from './password.service';

describe('PasswordService (argon2)', () => {
  const service = new PasswordService();

  it('해시 결과는 평문과 다르고 argon2id 포맷이며 단순해시가 아니다', async () => {
    const plain = 'S0me-Str0ng-Pass!';
    const hash = await service.hash(plain);

    expect(hash).not.toBe(plain);
    expect(hash).not.toContain(plain);
    // argon2id 식별자 포함 (평문/MD5/SHA 단독 저장 금지 — NFR-SEC-02)
    expect(hash.startsWith('$argon2id$')).toBe(true);
    // MD5(32 hex)/SHA-1(40 hex) 같은 단순 해시 형태가 아님
    expect(hash).not.toMatch(/^[a-f0-9]{32}$/i);
    expect(hash).not.toMatch(/^[a-f0-9]{40}$/i);
  });

  it('동일 평문이라도 매번 다른 해시(솔트)를 생성한다', async () => {
    const plain = 'repeat-me-123';
    const a = await service.hash(plain);
    const b = await service.hash(plain);
    expect(a).not.toBe(b);
  });

  it('올바른 비밀번호는 true 로 검증된다', async () => {
    const plain = 'correct horse battery';
    const hash = await service.hash(plain);
    await expect(service.verify(hash, plain)).resolves.toBe(true);
  });

  it('틀린 비밀번호는 false 로 검증된다', async () => {
    const hash = await service.hash('correct-password');
    await expect(service.verify(hash, 'wrong-password')).resolves.toBe(false);
  });

  it('손상/빈 해시는 throw 없이 false 를 반환한다', async () => {
    await expect(service.verify('', 'anything')).resolves.toBe(false);
    await expect(service.verify('not-a-valid-hash', 'anything')).resolves.toBe(
      false,
    );
  });
});
