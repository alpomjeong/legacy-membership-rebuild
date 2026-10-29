import { UnauthorizedException } from '@nestjs/common';
import type { Request, Response } from 'express';
import { AuthService } from './auth.service';
import { AuthController } from './auth.controller';
import { LoginDto } from './dto/login.dto';

const mockRes = () =>
  ({ cookie: jest.fn(), clearCookie: jest.fn() }) as unknown as Response;
const mockReq = () => ({ secure: false, headers: {} }) as unknown as Request;

describe('AuthController', () => {
  it('성공 시 AuthService.login 으로 위임하고 토큰을 반환한다(네이티브: 바디 refresh)', async () => {
    const login = jest.fn().mockResolvedValue({
      accessToken: 'a',
      refreshToken: 'r',
      mustResetPassword: false,
    });
    const controller = new AuthController({ login } as unknown as AuthService);

    const dto: LoginDto = { loginId: 'admin', password: 'pw' };
    const res = mockRes();
    await expect(
      controller.login(dto, '127.0.0.1', mockReq(), res, 'jest'),
    ).resolves.toEqual({
      accessToken: 'a',
      refreshToken: 'r',
      mustResetPassword: false,
    });
    expect(login).toHaveBeenCalledWith('admin', 'pw', {
      ip: '127.0.0.1',
      userAgent: 'jest',
    });
    expect(res.cookie).not.toHaveBeenCalled(); // cookieMode 아님 → 쿠키 미설정
  });

  it('cookieMode(웹): refresh 를 쿠키로 설정하고 바디에선 제외한다', async () => {
    const login = jest.fn().mockResolvedValue({
      accessToken: 'a',
      refreshToken: 'r',
      mustResetPassword: false,
    });
    const controller = new AuthController({ login } as unknown as AuthService);
    const res = mockRes();

    const out = await controller.login(
      { loginId: 'admin', password: 'pw', cookieMode: true },
      '127.0.0.1',
      mockReq(),
      res,
      'jest',
    );
    expect(out).toEqual({ accessToken: 'a', mustResetPassword: false });
    expect(res.cookie).toHaveBeenCalledWith(
      'rt',
      'r',
      expect.objectContaining({ httpOnly: true }),
    );
  });

  it('인증 실패 시 Unauthorized 를 전파한다(401)', async () => {
    const login = jest
      .fn()
      .mockRejectedValue(
        new UnauthorizedException('아이디 또는 비밀번호가 올바르지 않습니다.'),
      );
    const controller = new AuthController({ login } as unknown as AuthService);

    await expect(
      controller.login(
        { loginId: 'admin', password: 'bad' },
        '127.0.0.1',
        mockReq(),
        mockRes(),
        'jest',
      ),
    ).rejects.toThrow(UnauthorizedException);
  });
});
