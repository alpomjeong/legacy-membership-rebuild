import { UnauthorizedException } from '@nestjs/common';
import { PrismaService } from '../prisma/prisma.service';
import { PasswordService } from './password.service';
import { TokenService } from './token.service';
import { AuthService } from './auth.service';

interface Mocks {
  service: AuthService;
  findFirst: jest.Mock;
  verify: jest.Mock;
  issueAccessToken: jest.Mock;
}

function build(): Mocks {
  const findFirst = jest.fn();
  const verify = jest.fn();
  const issueAccessToken = jest.fn().mockResolvedValue('access.jwt');
  const issueRefreshToken = jest.fn().mockResolvedValue('refresh.jwt');
  const expiryOf = jest.fn().mockReturnValue(new Date(Date.now() + 1_000_000));

  const prisma = {
    userAccount: { findFirst, update: jest.fn().mockResolvedValue({}) },
    loginHistory: { create: jest.fn().mockResolvedValue({}) },
    refreshSession: { create: jest.fn().mockResolvedValue({}) },
  } as unknown as PrismaService;
  const passwordService = { verify } as unknown as PasswordService;
  const tokenService = {
    issueAccessToken,
    issueRefreshToken,
    expiryOf,
  } as unknown as TokenService;

  return {
    service: new AuthService(prisma, passwordService, tokenService),
    findFirst,
    verify,
    issueAccessToken,
  };
}

describe('AuthService.login', () => {
  it('자격증명이 올바르면 access/refresh 토큰을 발급한다', async () => {
    const { service, findFirst, verify, issueAccessToken } = build();
    findFirst.mockResolvedValue({
      id: 99n,
      loginId: 'admin',
      passwordHash: '$argon2id$hash',
      isActive: true,
      isDeleted: false,
      failedLoginCount: 0,
      lockedUntil: null,
      mustResetPassword: false,
      roles: [{ role: { code: 'ADMIN' } }, { role: { code: 'STAFF' } }],
    });
    verify.mockResolvedValue(true);

    const result = await service.login('admin', 'correct-password');

    expect(result).toEqual({
      accessToken: 'access.jwt',
      refreshToken: 'refresh.jwt',
      mustResetPassword: false,
    });
    // sub 는 계정ID 문자열, roles 는 역할코드 — PII 미전달.
    expect(issueAccessToken).toHaveBeenCalledWith('99', ['ADMIN', 'STAFF']);
  });

  it('비밀번호가 틀리면 일반화된 Unauthorized 로 거부한다', async () => {
    const { service, findFirst, verify, issueAccessToken } = build();
    findFirst.mockResolvedValue({
      id: 1n,
      passwordHash: '$argon2id$hash',
      isActive: true,
      isDeleted: false,
      failedLoginCount: 0,
      lockedUntil: null,
      roles: [],
    });
    verify.mockResolvedValue(false);

    await expect(service.login('admin', 'wrong')).rejects.toThrow(
      UnauthorizedException,
    );
    expect(issueAccessToken).not.toHaveBeenCalled();
  });

  it('비활성 계정은 로그인 거부 + 토큰 미발급 (더미 검증으로 타이밍만 균일화)', async () => {
    const { service, findFirst, verify, issueAccessToken } = build();
    findFirst.mockResolvedValue({
      id: 1n,
      passwordHash: '$argon2id$hash',
      isActive: false,
      isDeleted: false,
      roles: [],
    });
    verify.mockResolvedValue(true); // 더미 해시가 우연히 매칭돼도(불가) 비활성이라 로그인 불가여야 함

    await expect(service.login('admin', 'whatever')).rejects.toThrow(
      UnauthorizedException,
    );
    // 실제 비밀번호로 인증 성공(토큰 발급)되지 않아야 한다 — 이게 핵심 보안 속성.
    expect(issueAccessToken).not.toHaveBeenCalled();
  });

  it('실패 메시지는 사유를 노출하지 않는 단일 일반화 메시지다', async () => {
    const { service, findFirst } = build();
    findFirst.mockResolvedValue(null);

    await expect(service.login('admin', 'x')).rejects.toMatchObject({
      message: '아이디 또는 비밀번호가 올바르지 않습니다.',
    });
  });

  it('없는 계정도 5회 실패 후 잠금 메시지 — 잠금 유무로 계정 열거 불가', async () => {
    const { service, findFirst, verify } = build();
    findFirst.mockResolvedValue(null); // 존재하지 않는 loginId
    verify.mockResolvedValue(false);

    // 1~4회: 일반화 메시지
    for (let i = 0; i < 4; i++) {
      await expect(service.login('ghost', 'x')).rejects.toMatchObject({
        message: '아이디 또는 비밀번호가 올바르지 않습니다.',
      });
    }
    // 5회째: 실존 계정과 동일한 잠금 메시지
    await expect(service.login('ghost', 'x')).rejects.toMatchObject({
      message: expect.stringContaining('계정이 잠겼습니다'),
    });
    // 잠긴 동안(6회째): 계속 잠금 메시지
    await expect(service.login('ghost', 'x')).rejects.toMatchObject({
      message: expect.stringContaining('계정이 잠겼습니다'),
    });
    // 타이밍 균일화: 없는 계정에도 argon2 검증(더미)이 수행됐다.
    expect(verify).toHaveBeenCalled();
  });
});

/**
 * CRITICAL 회귀 (NFR-SEC-03 / FR-AUTH-02 / MAP-30):
 * 레거시 하드코딩 백도어(chul0127 / 고정 StaffID 0000001) 가 부활하지 않음을 보장한다.
 */
describe('AuthService 백도어 부재 회귀', () => {
  it('계정이 DB 에 없으면 어떤 비밀번호로도 로그인 불가', async () => {
    const { service, findFirst, verify, issueAccessToken } = build();
    findFirst.mockResolvedValue(null); // 계정 미존재

    // 레거시 백도어 비밀번호 및 고정 StaffID 조합 모두 거부되어야 한다.
    await expect(service.login('anyone', 'chul0127')).rejects.toThrow(
      UnauthorizedException,
    );
    await expect(service.login('chul0127', 'chul0127')).rejects.toThrow(
      UnauthorizedException,
    );
    await expect(service.login('0000001', '0000001')).rejects.toThrow(
      UnauthorizedException,
    );
    await expect(service.login('admin', '0000001')).rejects.toThrow(
      UnauthorizedException,
    );

    // 우회로가 없으므로 토큰은 결코 발급되지 않는다.
    expect(issueAccessToken).not.toHaveBeenCalled();
    // 해시 검증은 (타이밍 균일화용) 더미 해시로만 수행 — 실제 저장 해시 대조 경로 없음.
    for (const call of verify.mock.calls) {
      expect(call[0]).toBe(
        '$argon2id$v=19$m=65536,t=3,p=4$fX8FCpR8kwTregpY1XzASw$gW2RzplJao0qfTg6Aj7twiK+Wre4RtuEpLXLWuFZSpY',
      );
    }
  });
});
