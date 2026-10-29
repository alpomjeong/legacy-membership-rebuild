import {
  BadRequestException,
  Body,
  Controller,
  Headers,
  HttpCode,
  HttpStatus,
  Ip,
  Post,
  Req,
  Res,
} from '@nestjs/common';
import type { Request, Response } from 'express';
import { Throttle } from '@nestjs/throttler';
import { AuthService, LoginResult } from './auth.service';
import { TokenPair } from './token.service';
import { LoginDto } from './dto/login.dto';
import { ChangePasswordDto } from './dto/change-password.dto';
import { RefreshDto } from './dto/refresh.dto';
import { Public } from '../rbac/decorators';
import { CurrentUser, actorIdOf } from '../common/current-user.decorator';
import type { AuthenticatedUser } from './jwt.strategy';

const RT_COOKIE = 'rt';
const RT_PATH = '/api/v1/auth'; // 전역 prefix(api/v1)+auth — refresh/logout 경로에만 전송
const RT_FALLBACK_MAX_AGE_MS = 14 * 24 * 60 * 60 * 1000; // 토큰 exp 파싱 실패 시 폴백

/** Cookie 헤더에서 name 의 (비어있지 않은) 값을 파싱 — cookie-parser 의존 없이. */
function readCookie(req: Request, name: string): string | undefined {
  const raw = req.headers.cookie;
  if (!raw) return undefined;
  for (const part of raw.split(';')) {
    const eq = part.indexOf('=');
    if (eq < 0) continue;
    if (part.slice(0, eq).trim() === name) {
      const val = decodeURIComponent(part.slice(eq + 1).trim());
      return val === '' ? undefined : val; // 빈 쿠키는 '없음' 취급(바디 토큰 가리지 않게)
    }
  }
  return undefined;
}

/** JWT payload 의 exp(초) 로부터 남은 수명(ms) 산출 — 쿠키 Max-Age 를 실제 TTL 에 일치시킴. */
function maxAgeFromJwt(token: string): number {
  try {
    const seg = token.split('.')[1];
    const payload = JSON.parse(Buffer.from(seg, 'base64url').toString()) as {
      exp?: number;
    };
    if (payload.exp) return Math.max(0, payload.exp * 1000 - Date.now());
  } catch {
    /* 파싱 실패 → 폴백 */
  }
  return RT_FALLBACK_MAX_AGE_MS;
}

/**
 * AuthController — 로그인/refresh/비밀번호 변경 (FR-AUTH-01/05/13).
 * 웹(cookieMode=true): refresh 토큰을 HttpOnly 쿠키로 내려 JS 접근 차단(XSS 탈취 방지).
 *   응답 바디엔 refresh 를 넣지 않는다. refresh/logout 은 쿠키에서 읽는다.
 * 네이티브 앱(cookieMode 미지정): 기존대로 바디로 refresh 를 주고받는다(SecureStore 보관).
 */
@Controller('auth')
export class AuthController {
  constructor(private readonly authService: AuthService) {}

  /** HTTPS(운영/스테이징/프록시) 면 Secure 부여 — APP_ENV 뿐 아니라 실제 프로토콜도 반영. */
  private isSecure(req: Request): boolean {
    return (
      process.env.APP_ENV === 'production' ||
      req.secure ||
      req.headers['x-forwarded-proto'] === 'https'
    );
  }

  private setRefreshCookie(req: Request, res: Response, token: string): void {
    res.cookie(RT_COOKIE, token, {
      httpOnly: true,
      sameSite: 'lax',
      secure: this.isSecure(req),
      path: RT_PATH,
      maxAge: maxAgeFromJwt(token),
    });
  }

  private clearRefreshCookie(res: Response): void {
    res.clearCookie(RT_COOKIE, { path: RT_PATH });
  }

  @Public()
  @Throttle({ default: { limit: 10, ttl: 60000 } }) // IP당 분 10회 — 무차별 대입 방어(계정잠금과 별개)
  @Post('login')
  @HttpCode(HttpStatus.OK)
  async login(
    @Body() dto: LoginDto,
    @Ip() ip: string,
    @Req() req: Request,
    @Res({ passthrough: true }) res: Response,
    @Headers('user-agent') userAgent?: string,
  ): Promise<Partial<LoginResult>> {
    const result = await this.authService.login(dto.loginId, dto.password, {
      ip,
      userAgent,
    });
    if (dto.cookieMode) {
      this.setRefreshCookie(req, res, result.refreshToken);
      // 웹: refresh 는 쿠키로만 — 바디에서 제외.
      return {
        accessToken: result.accessToken,
        mustResetPassword: result.mustResetPassword,
      };
    }
    return result;
  }

  @Public()
  @Post('refresh')
  @HttpCode(HttpStatus.OK)
  async refresh(
    @Body() dto: RefreshDto,
    @Ip() ip: string,
    @Req() req: Request,
    @Res({ passthrough: true }) res: Response,
    @Headers('user-agent') userAgent?: string,
  ): Promise<Partial<TokenPair>> {
    const cookieToken = readCookie(req, RT_COOKIE);
    const token = cookieToken ?? dto.refreshToken;
    if (!token) throw new BadRequestException('refresh 토큰이 없습니다.');
    try {
      const pair = await this.authService.refresh(token, { ip, userAgent });
      if (cookieToken) {
        // 웹(쿠키 모드): 회전된 refresh 를 다시 쿠키로, 바디엔 access 만.
        this.setRefreshCookie(req, res, pair.refreshToken);
        return { accessToken: pair.accessToken };
      }
      return pair;
    } catch (e) {
      // 만료/무효 refresh → 죽은 쿠키를 지워 브라우저가 계속 재전송하지 않게.
      if (cookieToken) this.clearRefreshCookie(res);
      throw e;
    }
  }

  @Public()
  @Post('logout')
  @HttpCode(HttpStatus.OK)
  async logout(
    @Body() dto: RefreshDto,
    @Req() req: Request,
    @Res({ passthrough: true }) res: Response,
  ): Promise<{ ok: true }> {
    const token = readCookie(req, RT_COOKIE) ?? dto.refreshToken;
    if (token) await this.authService.logout(token);
    this.clearRefreshCookie(res);
    return { ok: true };
  }

  @Post('change-password')
  @HttpCode(HttpStatus.OK)
  async changePassword(
    @Body() dto: ChangePasswordDto,
    @CurrentUser() user: AuthenticatedUser,
  ): Promise<{ ok: true }> {
    await this.authService.changePassword(
      actorIdOf(user),
      dto.currentPassword,
      dto.newPassword,
    );
    return { ok: true };
  }
}
