import { CryptoService } from './crypto.service';

const svc = () => new CryptoService({ get: () => 'test-key' } as never);

describe('CryptoService', () => {
  it('encrypt→decrypt 왕복 일치', () => {
    const c = svc();
    const enc = c.encrypt('901010-1234567');
    expect(Buffer.isBuffer(enc)).toBe(true);
    expect(c.decrypt(enc)).toBe('901010-1234567');
  });

  it('동일 평문도 매번 다른 암호문(IV 무작위)', () => {
    const c = svc();
    expect(
      c.encrypt('901010-1234567').equals(c.encrypt('901010-1234567')),
    ).toBe(false);
  });

  it('mask: 앞 6자리 + 성별1자리 + 나머지 마스킹', () => {
    expect(svc().mask('901010-1234567')).toBe('901010-1******');
  });

  it('mask: 짧으면 전체 마스킹', () => {
    expect(svc().mask('123')).toBe('******');
  });
});
