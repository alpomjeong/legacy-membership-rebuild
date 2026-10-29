import { UnauthorizedException } from '@nestjs/common';
import { ConfigService } from '@nestjs/config';
import { JwtStrategy } from './jwt.strategy';
import { AccessTokenPayload } from './token.service';

const config = {
  getOrThrow: (): string => 'test-access-secret',
} as unknown as ConfigService;

const makePrisma = () => ({
  userAccount: {
    findFirst: jest.fn().mockResolvedValue({ accessInvalidBefore: null }),
  },
});

describe('JwtStrategy.validate', () => {
  it('access 토큰 페이로드를 req.user = { sub, roles } 로 변환한다', async () => {
    const prisma = makePrisma();
    const strategy = new JwtStrategy(config, prisma as never);
    const payload: AccessTokenPayload = {
      sub: '42',
      type: 'access',
      roles: ['ADMIN'],
    };
    await expect(strategy.validate(payload)).resolves.toEqual({
      sub: '42',
      roles: ['ADMIN'],
    });
    // 활성·미삭제 계정만 통과
    expect(prisma.userAccount.findFirst).toHaveBeenCalledWith(
      expect.objectContaining({
        where: expect.objectContaining({
          id: 42n,
          isActive: true,
          isDeleted: false,
        }),
      }),
    );
  });

  it('access 가 아닌 토큰(refresh 등)은 거부한다', async () => {
    const strategy = new JwtStrategy(config, makePrisma() as never);
    const payload = {
      sub: '42',
      type: 'refresh',
    } as unknown as AccessTokenPayload;
    await expect(strategy.validate(payload)).rejects.toThrow(
      UnauthorizedException,
    );
  });

  it('계정이 없거나 비활성/삭제면 거부한다 — 유효한 서명이라도 무효', async () => {
    const prisma = makePrisma();
    prisma.userAccount.findFirst.mockResolvedValue(null);
    const strategy = new JwtStrategy(config, prisma as never);
    await expect(
      strategy.validate({ sub: '42', type: 'access', roles: [] }),
    ).rejects.toThrow(UnauthorizedException);
  });

  it('강제 로그아웃 시각(accessInvalidBefore) 이전 발급 토큰은 거부한다 — 즉시 차단', async () => {
    const prisma = makePrisma();
    prisma.userAccount.findFirst.mockResolvedValue({
      accessInvalidBefore: new Date('2026-07-09T10:00:00Z'),
    });
    const strategy = new JwtStrategy(config, prisma as never);
    const issuedBefore: AccessTokenPayload = {
      sub: '42',
      type: 'access',
      roles: [],
      iat: Math.floor(new Date('2026-07-09T09:59:00Z').getTime() / 1000),
    };
    await expect(strategy.validate(issuedBefore)).rejects.toThrow(
      UnauthorizedException,
    );
    const issuedAfter: AccessTokenPayload = {
      sub: '42',
      type: 'access',
      roles: [],
      iat: Math.floor(new Date('2026-07-09T10:01:00Z').getTime() / 1000),
    };
    await expect(strategy.validate(issuedAfter)).resolves.toEqual({
      sub: '42',
      roles: [],
    });
  });

  it('sub 가 숫자가 아니면 거부한다', async () => {
    const strategy = new JwtStrategy(config, makePrisma() as never);
    await expect(
      strategy.validate({ sub: 'not-a-number', type: 'access', roles: [] }),
    ).rejects.toThrow(UnauthorizedException);
  });
});
