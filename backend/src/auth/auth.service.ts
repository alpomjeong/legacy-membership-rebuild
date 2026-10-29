import {
  BadRequestException,
  Injectable,
  UnauthorizedException,
} from '@nestjs/common';
import { createHash, randomUUID } from 'crypto';
import { PrismaService } from '../prisma/prisma.service';
import { PasswordService } from './password.service';
import { TokenService, TokenPair } from './token.service';

/**
 * 단일 일반화 오류 메시지 — 사유(미존재/비활성/불일치)를 노출하지 않는다(FR-AUTH-03, NFR-SEC-01).
 * 계정 열거(user enumeration) 방지를 위해 모든 실패 경로에서 동일 메시지를 사용한다.
 */
const INVALID_CREDENTIALS = '아이디 또는 비밀번호가 올바르지 않습니다.';
const SESSION_EXPIRED = '세션이 만료되었습니다. 다시 로그인하세요.';
/**
 * 잠금 메시지 — "잠김 여부"는 구분해 알리되(사용자가 원인·해제시각을 알 수 있게),
 * 실패 횟수/잔여 시도는 노출하지 않는다(계정 열거 방지 유지).
 */
function lockedMessage(until: Date, now: Date = new Date()): string {
  const mins = Math.max(
    1,
    Math.ceil((until.getTime() - now.getTime()) / 60000),
  );
  return `로그인 실패가 많아 계정이 잠겼습니다. 약 ${mins}분 후 다시 시도하세요.`;
}

/**
 * 존재하지 않는(또는 비활성) 계정에도 argon2 검증을 태워 응답 시간을 실존 계정과
 * 맞추기 위한 더미 해시 — 타이밍 기반 계정 열거 방지. (실제 로그인엔 절대 매칭 안 됨)
 * 파라미터(m=65536,t=3,p=4)는 PasswordService.hash 의 argon2id 기본값과 동일.
 */
const DUMMY_HASH =
  '$argon2id$v=19$m=65536,t=3,p=4$fX8FCpR8kwTregpY1XzASw$gW2RzplJao0qfTg6Aj7twiK+Wre4RtuEpLXLWuFZSpY';
/** 섀도 항목 유휴 만료(분) — 메모리 상한 보조(오래 방치된 미존 loginId 정리). */
const SHADOW_IDLE_MS = 30 * 60 * 1000;
const SHADOW_MAX = 8192;

/** 로그인 실패 잠금 정책(FR-AUTH) — 운영 합의 시 조정. */
const MAX_FAILED = 5;
const LOCK_MS = 15 * 60 * 1000; // 15분
/** 비밀번호 최소 길이(정책). */
export const MIN_PASSWORD_LEN = 8;

export interface LoginContext {
  ip?: string | null;
  userAgent?: string | null;
}
export interface LoginResult extends TokenPair {
  mustResetPassword: boolean;
}

/**
 * AuthService — 로그인 인증 단일 경로 (FR-AUTH-01/02, NFR-SEC-03).
 * argon2 해시 검증 + 실패 잠금 + 로그인 이력 + refresh 회전 + 최초/일반 비번변경.
 * 하드코딩 백도어/고정 StaffID 우회 경로 없음.
 */
@Injectable()
export class AuthService {
  /**
   * 미존재/비활성 loginId 의 실패 잠금 섀도 카운터(인메모리) — 실존 계정의 DB 잠금과
   * 동일한 임계/메시지/타이밍으로 응답해 "잠금 유무"를 통한 계정 열거를 차단한다.
   */
  private readonly failedShadow = new Map<
    string,
    { count: number; lockedUntil: number; ts: number }
  >();

  constructor(
    private readonly prisma: PrismaService,
    private readonly passwordService: PasswordService,
    private readonly tokenService: TokenService,
  ) {}

  private pruneShadow(nowMs: number): void {
    if (this.failedShadow.size < SHADOW_MAX) return;
    for (const [k, v] of this.failedShadow) {
      if (v.lockedUntil < nowMs && nowMs - v.ts > SHADOW_IDLE_MS)
        this.failedShadow.delete(k);
    }
  }

  async login(
    loginId: string,
    password: string,
    ctx: LoginContext = {},
  ): Promise<LoginResult> {
    const account = await this.prisma.userAccount.findFirst({
      where: { loginId, isDeleted: false },
      include: { roles: { include: { role: true } } },
    });
    const now = new Date();
    const nowMs = now.getTime();
    // 실존 + 활성만 DB 잠금/검증 경로. 미존재·비활성은 섀도 경로로 "동일하게" 처리.
    const real = account && account.isActive ? account : null;

    // 1) 잠금 확인 — DB(실존) 또는 섀도(미존/비활성) 어느 쪽이든 동일 메시지·남은시간.
    const dbLockedUntil =
      real && real.lockedUntil && real.lockedUntil > now
        ? real.lockedUntil
        : null;
    const shadow = this.failedShadow.get(loginId);
    const shadowLockedUntil =
      !real && shadow && shadow.lockedUntil > nowMs
        ? new Date(shadow.lockedUntil)
        : null;
    const lockedUntil = dbLockedUntil ?? shadowLockedUntil;
    if (lockedUntil) {
      if (account) await this.history(account.id, ctx, false, '계정 잠금');
      throw new UnauthorizedException(lockedMessage(lockedUntil, now));
    }

    // 2) 비밀번호 검증 — 미존/비활성도 더미 해시로 동일 시간 소요(타이밍 열거 방지).
    const verified = await this.passwordService.verify(
      real ? real.passwordHash : DUMMY_HASH,
      password,
    );
    const passwordMatches = verified && !!real;

    if (!passwordMatches) {
      if (real) {
        // 실존 계정 — DB 카운트/잠금.
        const failed = real.failedLoginCount + 1;
        const lock = failed >= MAX_FAILED;
        const lockUntil = lock ? new Date(nowMs + LOCK_MS) : null;
        await this.prisma.userAccount.update({
          where: { id: real.id },
          data: { failedLoginCount: lock ? 0 : failed, lockedUntil: lockUntil },
        });
        await this.history(
          real.id,
          ctx,
          false,
          lock ? '실패 초과 잠금' : `비밀번호 불일치(${failed}/${MAX_FAILED})`,
        );
        throw new UnauthorizedException(
          lockUntil ? lockedMessage(lockUntil, now) : INVALID_CREDENTIALS,
        );
      }
      // 미존/비활성 — 섀도 카운트/잠금(실존과 동일 임계·메시지).
      this.pruneShadow(nowMs);
      const cur = shadow ?? { count: 0, lockedUntil: 0, ts: nowMs };
      const failed = cur.count + 1;
      const lock = failed >= MAX_FAILED;
      const lockUntil = lock ? nowMs + LOCK_MS : 0;
      this.failedShadow.set(loginId, {
        count: lock ? 0 : failed,
        lockedUntil: lockUntil,
        ts: nowMs,
      });
      if (account) await this.history(account.id, ctx, false, '비활성 계정');
      throw new UnauthorizedException(
        lock ? lockedMessage(new Date(lockUntil), now) : INVALID_CREDENTIALS,
      );
    }

    // 성공 — 여기 도달하면 real 은 반드시 non-null(비밀번호 일치). 방어 겸 타입 내로잉.
    if (!real) throw new UnauthorizedException(INVALID_CREDENTIALS);

    // DB 실패 카운트/잠금 해제 + 섀도 정리, 최근 로그인 기록.
    this.failedShadow.delete(loginId);
    await this.prisma.userAccount.update({
      where: { id: real.id },
      data: { failedLoginCount: 0, lockedUntil: null, lastLoginAt: now },
    });
    await this.history(real.id, ctx, true, null);

    const roles = real.roles.map((userRole) => userRole.role.code);
    const tokens = await this.createSession(real.id, real.tenantId, roles, ctx);
    return { ...tokens, mustResetPassword: real.mustResetPassword };
  }

  /**
   * refresh 토큰 회전(FR-AUTH-05/06) — 서버측 세션 검증 + 회전.
   * 폐기/만료/해시불일치 거부. 이미 폐기된 jti 재사용 시 탈취로 간주해 전 세션 폐기.
   */
  async refresh(
    refreshToken: string,
    ctx: LoginContext = {},
  ): Promise<TokenPair> {
    let sub: string;
    let jti: string;
    try {
      const payload = await this.tokenService.verifyRefreshToken(refreshToken);
      sub = payload.sub;
      jti = payload.jti;
    } catch {
      throw new UnauthorizedException(SESSION_EXPIRED);
    }
    const session = await this.prisma.refreshSession.findUnique({
      where: { jti },
    });
    // 이미 폐기된 세션의 토큰이 다시 오면 토큰 재사용(탈취) 의심 → 해당 계정 전 세션 폐기.
    if (session && session.revokedAt) {
      await this.revokeAllForAccount(session.userAccountId);
      throw new UnauthorizedException(SESSION_EXPIRED);
    }
    if (
      !session ||
      session.expiresAt < new Date() ||
      session.tokenHash !== this.sha256(refreshToken)
    ) {
      throw new UnauthorizedException(SESSION_EXPIRED);
    }
    const account = await this.prisma.userAccount.findFirst({
      where: { id: BigInt(sub), isDeleted: false },
      include: { roles: { include: { role: true } } },
    });
    if (!account || !account.isActive) {
      await this.revokeAllForAccount(BigInt(sub));
      throw new UnauthorizedException(SESSION_EXPIRED);
    }
    // 회전: 기존 세션 폐기 후 새 세션 발급.
    await this.prisma.refreshSession.update({
      where: { id: session.id },
      data: { revokedAt: new Date(), lastUsedAt: new Date() },
    });
    const roles = account.roles.map((userRole) => userRole.role.code);
    return this.createSession(account.id, account.tenantId, roles, ctx);
  }

  /** 로그아웃 — 제시된 refresh 세션 폐기(베스트에포트). */
  async logout(refreshToken: string): Promise<void> {
    try {
      const { jti } = await this.tokenService.verifyRefreshToken(refreshToken);
      await this.prisma.refreshSession.updateMany({
        where: { jti, revokedAt: null },
        data: { revokedAt: new Date() },
      });
    } catch {
      /* 무효 토큰은 무시 */
    }
  }

  /** 계정 전 세션 폐기(강제 로그아웃) — 비활성화/비번초기화/탈취 대응. */
  async revokeAllForAccount(userAccountId: bigint): Promise<void> {
    await this.prisma.refreshSession.updateMany({
      where: { userAccountId, revokedAt: null },
      data: { revokedAt: new Date() },
    });
  }

  /** 새 refresh 세션 + 토큰쌍 발급(해시 저장). */
  private async createSession(
    userAccountId: bigint,
    tenantId: bigint,
    roles: string[],
    ctx: LoginContext,
  ): Promise<TokenPair> {
    const jti = randomUUID();
    const [accessToken, refreshToken] = await Promise.all([
      this.tokenService.issueAccessToken(userAccountId.toString(), roles),
      this.tokenService.issueRefreshToken(userAccountId.toString(), jti),
    ]);
    await this.prisma.refreshSession.create({
      data: {
        tenantId,
        userAccountId,
        jti,
        tokenHash: this.sha256(refreshToken),
        ipAddress: ctx.ip?.slice(0, 64) ?? null,
        userAgent: ctx.userAgent ?? null,
        expiresAt: this.tokenService.expiryOf(refreshToken),
      },
    });
    return { accessToken, refreshToken };
  }

  private sha256(s: string): string {
    return createHash('sha256').update(s).digest('hex');
  }

  /** 본인 비밀번호 변경(최초 로그인 강제 포함) — 현재 비번 검증 후 교체, mustReset 해제. */
  async changePassword(
    accountId: bigint,
    currentPassword: string,
    newPassword: string,
  ): Promise<void> {
    if (!newPassword || newPassword.length < MIN_PASSWORD_LEN) {
      throw new BadRequestException(
        `새 비밀번호는 ${MIN_PASSWORD_LEN}자 이상이어야 합니다.`,
      );
    }
    const account = await this.prisma.userAccount.findFirst({
      where: { id: accountId, isDeleted: false },
    });
    if (!account) throw new UnauthorizedException(SESSION_EXPIRED);
    const ok = await this.passwordService.verify(
      account.passwordHash,
      currentPassword,
    );
    if (!ok)
      throw new BadRequestException('현재 비밀번호가 올바르지 않습니다.');
    const passwordHash = await this.passwordService.hash(newPassword);
    await this.prisma.userAccount.update({
      where: { id: accountId },
      data: { passwordHash, mustResetPassword: false },
    });
  }

  private async history(
    userAccountId: bigint,
    ctx: LoginContext,
    isSuccess: boolean,
    failReason: string | null,
  ): Promise<void> {
    await this.prisma.loginHistory.create({
      data: {
        userAccountId,
        ipAddress: ctx.ip?.slice(0, 64) ?? null,
        userAgent: ctx.userAgent ?? null,
        isSuccess,
        failReason,
      },
    });
  }
}
