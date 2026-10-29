import { BadRequestException, UnauthorizedException } from '@nestjs/common';
import { createHash } from 'crypto';
import { PrismaService } from '../prisma/prisma.service';
import { PasswordService } from './password.service';
import { TokenService } from './token.service';
import { AuthService } from './auth.service';

const sha256 = (s: string) => createHash('sha256').update(s).digest('hex');

function build() {
  const refreshSession = {
    findUnique: jest.fn(),
    update: jest.fn().mockResolvedValue({}),
    updateMany: jest.fn().mockResolvedValue({ count: 1 }),
    create: jest.fn().mockResolvedValue({}),
  };
  const userAccount = {
    findFirst: jest.fn(),
    update: jest.fn().mockResolvedValue({}),
  };
  const prisma = { refreshSession, userAccount } as unknown as PrismaService;

  const verify = jest.fn();
  const hash = jest.fn().mockResolvedValue('NEWHASH');
  const passwordService = { verify, hash } as unknown as PasswordService;

  const verifyRefreshToken = jest.fn();
  const tokenService = {
    verifyRefreshToken,
    issueAccessToken: jest.fn().mockResolvedValue('new.access'),
    issueRefreshToken: jest.fn().mockResolvedValue('new.refresh'),
    expiryOf: jest.fn().mockReturnValue(new Date(Date.now() + 1_000_000)),
  } as unknown as TokenService;

  return {
    service: new AuthService(prisma, passwordService, tokenService),
    refreshSession,
    userAccount,
    verify,
    hash,
    verifyRefreshToken,
  };
}

describe('AuthService.refresh (세션 회전)', () => {
  it('유효 세션 → 기존 폐기 후 새 토큰쌍 발급(회전)', async () => {
    const m = build();
    const token = 'refresh.jwt';
    m.verifyRefreshToken.mockResolvedValue({
      sub: '7',
      type: 'refresh',
      jti: 's1',
    });
    m.refreshSession.findUnique.mockResolvedValue({
      id: 100n,
      jti: 's1',
      userAccountId: 7n,
      tokenHash: sha256(token),
      expiresAt: new Date(Date.now() + 1_000_000),
      revokedAt: null,
    });
    m.userAccount.findFirst.mockResolvedValue({
      id: 7n,
      tenantId: 1n,
      isActive: true,
      isDeleted: false,
      roles: [{ role: { code: 'STAFF' } }],
    });

    const res = await m.service.refresh(token);

    expect(res).toEqual({
      accessToken: 'new.access',
      refreshToken: 'new.refresh',
    });
    expect(m.refreshSession.update).toHaveBeenCalledWith(
      expect.objectContaining({ where: { id: 100n } }),
    );
    expect(m.refreshSession.create).toHaveBeenCalled();
  });

  it('폐기된 세션 토큰 재사용 → 전 세션 폐기 + 거부(탈취 대응)', async () => {
    const m = build();
    m.verifyRefreshToken.mockResolvedValue({
      sub: '7',
      type: 'refresh',
      jti: 's1',
    });
    m.refreshSession.findUnique.mockResolvedValue({
      id: 100n,
      userAccountId: 7n,
      tokenHash: 'x',
      expiresAt: new Date(Date.now() + 1_000_000),
      revokedAt: new Date(),
    });
    await expect(m.service.refresh('tok')).rejects.toThrow(
      UnauthorizedException,
    );
    expect(m.refreshSession.updateMany).toHaveBeenCalledWith(
      expect.objectContaining({
        where: { userAccountId: 7n, revokedAt: null },
      }),
    );
  });

  it('토큰 해시 불일치 → 거부', async () => {
    const m = build();
    m.verifyRefreshToken.mockResolvedValue({
      sub: '7',
      type: 'refresh',
      jti: 's1',
    });
    m.refreshSession.findUnique.mockResolvedValue({
      id: 100n,
      userAccountId: 7n,
      tokenHash: 'WRONG',
      expiresAt: new Date(Date.now() + 1_000_000),
      revokedAt: null,
    });
    await expect(m.service.refresh('tok')).rejects.toThrow(
      UnauthorizedException,
    );
    expect(m.refreshSession.create).not.toHaveBeenCalled();
  });
});

describe('AuthService.logout / changePassword', () => {
  it('logout — jti 세션 폐기', async () => {
    const m = build();
    m.verifyRefreshToken.mockResolvedValue({
      sub: '7',
      type: 'refresh',
      jti: 's1',
    });
    await m.service.logout('tok');
    expect(m.refreshSession.updateMany).toHaveBeenCalledWith({
      where: { jti: 's1', revokedAt: null },
      data: { revokedAt: expect.any(Date) },
    });
  });

  it('changePassword — 현재 비번 불일치 거부', async () => {
    const m = build();
    m.userAccount.findFirst.mockResolvedValue({ id: 7n, passwordHash: 'H' });
    m.verify.mockResolvedValue(false);
    await expect(
      m.service.changePassword(7n, 'wrong', 'newpassword1'),
    ).rejects.toThrow(BadRequestException);
  });

  it('changePassword — 8자 미만 거부', async () => {
    const m = build();
    await expect(m.service.changePassword(7n, 'cur', 'short')).rejects.toThrow(
      BadRequestException,
    );
  });

  it('changePassword — 성공 시 새 해시 저장 + mustReset 해제', async () => {
    const m = build();
    m.userAccount.findFirst.mockResolvedValue({ id: 7n, passwordHash: 'H' });
    m.verify.mockResolvedValue(true);
    await m.service.changePassword(7n, 'cur', 'newpassword1');
    expect(m.userAccount.update).toHaveBeenCalledWith(
      expect.objectContaining({
        data: expect.objectContaining({
          passwordHash: 'NEWHASH',
          mustResetPassword: false,
        }),
      }),
    );
  });
});
