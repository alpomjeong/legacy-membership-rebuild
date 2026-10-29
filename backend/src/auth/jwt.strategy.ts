import { Injectable, UnauthorizedException } from '@nestjs/common';
import { ConfigService } from '@nestjs/config';
import { PassportStrategy } from '@nestjs/passport';
import { ExtractJwt, Strategy } from 'passport-jwt';
import { PrismaService } from '../prisma/prisma.service';
import { AccessTokenPayload } from './token.service';

/** 요청에 부착되는 인증 주체(req.user) — PII 없이 식별자/역할만(FR-AUTH-06). */
export interface AuthenticatedUser {
  sub: string;
  roles: string[];
}

/**
 * JwtStrategy — Bearer Access 토큰을 JWT_ACCESS_SECRET 으로 검증한다(NFR-SEC-01).
 * refresh 토큰으로 보호 자원에 접근하지 못하도록 type==='access' 만 통과시킨다.
 *
 * 서명 검증에 더해 계정 상태를 매 요청 확인한다 — 강제 로그아웃/비번초기화/비활성화 시
 * accessInvalidBefore 를 기록해 두면, 그 이전에 발급된 access 토큰은 만료 전이라도 즉시 거부된다.
 */
@Injectable()
export class JwtStrategy extends PassportStrategy(Strategy) {
  constructor(
    config: ConfigService,
    private readonly prisma: PrismaService,
  ) {
    super({
      jwtFromRequest: ExtractJwt.fromAuthHeaderAsBearerToken(),
      ignoreExpiration: false,
      secretOrKey: config.getOrThrow<string>('JWT_ACCESS_SECRET'),
    });
  }

  async validate(payload: AccessTokenPayload): Promise<AuthenticatedUser> {
    if (payload.type !== 'access') {
      throw new UnauthorizedException();
    }
    let id: bigint;
    try {
      id = BigInt(payload.sub);
    } catch {
      throw new UnauthorizedException();
    }
    const account = await this.prisma.userAccount.findFirst({
      where: { id, isActive: true, isDeleted: false },
      select: { accessInvalidBefore: true },
    });
    if (!account) throw new UnauthorizedException();
    if (
      account.accessInvalidBefore &&
      payload.iat !== undefined &&
      payload.iat * 1000 < account.accessInvalidBefore.getTime()
    ) {
      throw new UnauthorizedException();
    }
    return { sub: payload.sub, roles: payload.roles ?? [] };
  }
}
