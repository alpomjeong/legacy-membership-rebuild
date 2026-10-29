import { BadRequestException } from '@nestjs/common';
import { PrismaService } from '../prisma/prisma.service';
import { PasswordService } from '../auth/password.service';
import { AccountsService } from './accounts.service';

function build() {
  const userAccount = {
    findFirst: jest.fn(),
    create: jest.fn(),
    update: jest.fn().mockResolvedValue({}),
  };
  const userRole = {
    create: jest.fn().mockResolvedValue({}),
    deleteMany: jest.fn().mockResolvedValue({}),
  };
  const refreshSession = {
    updateMany: jest.fn().mockResolvedValue({ count: 2 }),
  };
  const auditLog = { create: jest.fn().mockResolvedValue({}) };
  const prisma = {
    userAccount,
    userRole,
    refreshSession,
    auditLog,
    $transaction: jest.fn((fn: (tx: unknown) => unknown) =>
      fn({ userAccount, userRole }),
    ),
  } as unknown as PrismaService;
  const passwordService = {
    hash: jest.fn().mockResolvedValue('HASH'),
  } as unknown as PasswordService;
  return {
    service: new AccountsService(prisma, passwordService),
    userAccount,
    userRole,
    refreshSession,
    passwordService,
  };
}

describe('AccountsService.create', () => {
  it('신규 계정 — 임시비번 발급·mustReset·역할 생성·해시 저장', async () => {
    const m = build();
    m.userAccount.findFirst.mockResolvedValue(null); // 중복 없음
    m.userAccount.create.mockResolvedValue({ id: 7n, loginId: 'newuser' });

    const res = await m.service.create(1n, 1n, {
      loginId: 'newuser',
      roleIds: ['2', '3'],
    });

    expect(res.loginId).toBe('newuser');
    expect(res.id).toBe('7');
    expect(res.tempPassword).toHaveLength(10);
    expect(m.passwordService.hash).toHaveBeenCalledWith(res.tempPassword);
    expect(m.userAccount.create).toHaveBeenCalledWith(
      expect.objectContaining({
        data: expect.objectContaining({
          loginId: 'newuser',
          mustResetPassword: true,
          passwordHash: 'HASH',
        }),
      }),
    );
    expect(m.userRole.create).toHaveBeenCalledTimes(2);
    expect(m.userRole.create).toHaveBeenCalledWith({
      data: { userAccountId: 7n, roleId: 2n },
    });
  });

  it('중복 로그인 ID 는 거부', async () => {
    const m = build();
    m.userAccount.findFirst.mockResolvedValue({ id: 1n });
    await expect(
      m.service.create(1n, 1n, { loginId: 'dup', roleIds: ['2'] }),
    ).rejects.toThrow(BadRequestException);
    expect(m.userAccount.create).not.toHaveBeenCalled();
  });

  it('이미 계정이 연결된 사원은 거부', async () => {
    const m = build();
    m.userAccount.findFirst
      .mockResolvedValueOnce(null) // 중복 체크
      .mockResolvedValueOnce({ id: 9n }); // 사원 연결 체크
    await expect(
      m.service.create(1n, 1n, { loginId: 'x', staffId: '5', roleIds: ['2'] }),
    ).rejects.toThrow(BadRequestException);
  });
});

describe('AccountsService 세션/비번', () => {
  it('forceLogout — 활성 세션 전부 폐기 + access 토큰 즉시 무효화', async () => {
    const m = build();
    m.userAccount.findFirst.mockResolvedValue({ id: 5n });
    const res = await m.service.forceLogout(1n, 1n, 5n);
    expect(res.revoked).toBe(2);
    expect(m.refreshSession.updateMany).toHaveBeenCalledWith({
      where: { userAccountId: 5n, revokedAt: null },
      data: { revokedAt: expect.any(Date) },
    });
    // 이미 발급된 access 토큰도 다음 요청부터 거부되도록 컷오프 기록
    expect(m.userAccount.update).toHaveBeenCalledWith(
      expect.objectContaining({
        where: { id: 5n },
        data: expect.objectContaining({
          accessInvalidBefore: expect.any(Date),
        }),
      }),
    );
  });

  it('resetPassword — 임시비번 재발급 + mustReset + 세션 폐기 + access 무효화', async () => {
    const m = build();
    m.userAccount.findFirst.mockResolvedValue({ id: 5n });
    const res = await m.service.resetPassword(1n, 1n, 5n);
    expect(res.tempPassword).toHaveLength(10);
    expect(m.userAccount.update).toHaveBeenCalledWith(
      expect.objectContaining({
        data: expect.objectContaining({
          mustResetPassword: true,
          accessInvalidBefore: expect.any(Date),
        }),
      }),
    );
    expect(m.refreshSession.updateMany).toHaveBeenCalled();
  });

  it('update — 비활성화 시 세션 강제 폐기 + access 무효화', async () => {
    const m = build();
    m.userAccount.findFirst.mockResolvedValue({ id: 5n });
    await m.service.update(1n, 1n, 5n, { isActive: false });
    expect(m.refreshSession.updateMany).toHaveBeenCalled();
    expect(m.userAccount.update).toHaveBeenCalledWith(
      expect.objectContaining({
        data: expect.objectContaining({
          isActive: false,
          accessInvalidBefore: expect.any(Date),
        }),
      }),
    );
  });

  it('update — 활성화(재활성)는 access 무효화를 걸지 않는다', async () => {
    const m = build();
    m.userAccount.findFirst.mockResolvedValue({ id: 5n });
    await m.service.update(1n, 1n, 5n, { isActive: true });
    expect(m.userAccount.update).toHaveBeenCalledWith(
      expect.objectContaining({
        data: expect.not.objectContaining({
          accessInvalidBefore: expect.anything(),
        }),
      }),
    );
  });
});
