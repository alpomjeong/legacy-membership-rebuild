import { Injectable } from '@nestjs/common';
import { ConfigService } from '@nestjs/config';
import { JwtService, JwtSignOptions } from '@nestjs/jwt';

/** jsonwebtoken 의 expiresIn 은 number|StringValue 유니온이라 env 문자열을 좁혀준다. */
type ExpiresIn = JwtSignOptions['expiresIn'];

/** 토큰 종류 — Access(단기)/Refresh(장기). */
export type TokenType = 'access' | 'refresh';

/** Access 토큰 페이로드 — PII 미포함(sub=계정ID 문자열, roles=역할코드). */
export interface AccessTokenPayload {
  sub: string;
  type: 'access';
  roles: string[];
  /** JWT 표준 발급 시각(초) — 서명 시 자동 부여. accessInvalidBefore 컷오프 비교에 사용. */
  iat?: number;
}

/** Refresh 토큰 페이로드 — PII 미포함(sub=계정ID 문자열, jti=세션ID). */
export interface RefreshTokenPayload {
  sub: string;
  type: 'refresh';
  jti: string;
}

export interface TokenPair {
  accessToken: string;
  refreshToken: string;
}

/**
 * TokenService — JWT Access/Refresh 발급·검증 (FR-AUTH-01/03/05, NFR-SEC-01).
 * 시크릿/TTL 은 env(JWT_ACCESS_SECRET/JWT_REFRESH_SECRET/JWT_ACCESS_TTL/JWT_REFRESH_TTL).
 * 페이로드에는 PII(이름/주민번호/이메일 등)를 절대 넣지 않는다 — sub + type(+roles)만.
 */
@Injectable()
export class TokenService {
  constructor(
    private readonly jwt: JwtService,
    private readonly config: ConfigService,
  ) {}

  issueAccessToken(sub: string, roles: string[] = []): Promise<string> {
    return this.jwt.signAsync(
      { sub, type: 'access', roles },
      {
        secret: this.config.getOrThrow<string>('JWT_ACCESS_SECRET'),
        expiresIn: this.config.get<string>(
          'JWT_ACCESS_TTL',
          '30m',
        ) as ExpiresIn,
      },
    );
  }

  issueRefreshToken(sub: string, jti: string): Promise<string> {
    return this.jwt.signAsync(
      { sub, type: 'refresh', jti },
      {
        secret: this.config.getOrThrow<string>('JWT_REFRESH_SECRET'),
        expiresIn: this.config.get<string>(
          'JWT_REFRESH_TTL',
          '14d',
        ) as ExpiresIn,
      },
    );
  }

  /** 발급된 토큰의 만료시각(exp) 추출 — refresh 세션 만료 저장용. */
  expiryOf(token: string): Date {
    const decoded: unknown = this.jwt.decode(token);
    const exp =
      decoded && typeof decoded === 'object' && 'exp' in decoded
        ? (decoded as { exp?: number }).exp
        : undefined;
    return exp
      ? new Date(exp * 1000)
      : new Date(Date.now() + 14 * 24 * 60 * 60 * 1000);
  }

  verifyAccessToken(token: string): Promise<AccessTokenPayload> {
    return this.jwt.verifyAsync<AccessTokenPayload>(token, {
      secret: this.config.getOrThrow<string>('JWT_ACCESS_SECRET'),
    });
  }

  verifyRefreshToken(token: string): Promise<RefreshTokenPayload> {
    return this.jwt.verifyAsync<RefreshTokenPayload>(token, {
      secret: this.config.getOrThrow<string>('JWT_REFRESH_SECRET'),
    });
  }
}
