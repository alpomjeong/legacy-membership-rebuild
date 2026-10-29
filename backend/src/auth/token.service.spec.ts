import { ConfigService } from '@nestjs/config';
import { JwtService } from '@nestjs/jwt';
import { TokenService } from './token.service';

/** env 시크릿/TTL 을 흉내내는 경량 ConfigService 목. */
function makeConfig(overrides: Record<string, string> = {}): ConfigService {
  const values: Record<string, string> = {
    JWT_ACCESS_SECRET: 'access-secret-aaa',
    JWT_REFRESH_SECRET: 'refresh-secret-bbb',
    JWT_ACCESS_TTL: '15m',
    JWT_REFRESH_TTL: '7d',
    ...overrides,
  };
  return {
    getOrThrow: (key: string): string => {
      const v = values[key];
      if (v === undefined) {
        throw new Error(`missing config: ${key}`);
      }
      return v;
    },
    get: (key: string, def?: string): string | undefined => values[key] ?? def,
  } as unknown as ConfigService;
}

describe('TokenService (JWT)', () => {
  it('유효한 Access 토큰은 검증되고 PII 없이 sub/type/roles 만 담는다', async () => {
    const service = new TokenService(new JwtService({}), makeConfig());

    const token = await service.issueAccessToken('42', ['ADMIN']);
    const payload = await service.verifyAccessToken(token);

    expect(payload.sub).toBe('42');
    expect(payload.type).toBe('access');
    expect(payload.roles).toEqual(['ADMIN']);

    // 페이로드 키는 sub/type/roles + 표준 시간 클레임(iat/exp)만 — PII 키 부재.
    const keys = Object.keys(payload).sort();
    expect(keys).toEqual(['exp', 'iat', 'roles', 'sub', 'type']);
  });

  it('refresh 토큰은 jti 를 포함해 발급·검증된다', async () => {
    const service = new TokenService(new JwtService({}), makeConfig());
    const token = await service.issueRefreshToken('7', 'sess-1');

    expect(typeof token).toBe('string');
    const refresh = await service.verifyRefreshToken(token);
    expect(refresh.sub).toBe('7');
    expect(refresh.type).toBe('refresh');
    expect(refresh.jti).toBe('sess-1');
    expect(service.expiryOf(token).getTime()).toBeGreaterThan(Date.now());
  });

  it('변조된 토큰은 검증에 실패한다', async () => {
    const service = new TokenService(new JwtService({}), makeConfig());
    const token = await service.issueAccessToken('1');
    const tampered = token.slice(0, -3) + 'xyz';

    await expect(service.verifyAccessToken(tampered)).rejects.toThrow();
  });

  it('다른 시크릿으로 발급된 토큰은 검증에 실패한다(secret mismatch)', async () => {
    const issuer = new TokenService(
      new JwtService({}),
      makeConfig({ JWT_ACCESS_SECRET: 'a-totally-different-secret' }),
    );
    const verifier = new TokenService(new JwtService({}), makeConfig());

    const token = await issuer.issueAccessToken('1');
    await expect(verifier.verifyAccessToken(token)).rejects.toThrow();
  });

  it('Access 시크릿으로 Refresh 토큰을 검증하면 실패한다(시크릿 분리)', async () => {
    const service = new TokenService(new JwtService({}), makeConfig());
    const refresh = await service.issueRefreshToken('1', 'sess-x');

    // refresh 는 refresh 시크릿으로 서명됨 → access 시크릿 검증 경로는 실패해야 함.
    await expect(service.verifyAccessToken(refresh)).rejects.toThrow();
  });
});
