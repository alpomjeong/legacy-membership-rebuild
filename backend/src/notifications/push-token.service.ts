import { Injectable, NotFoundException } from '@nestjs/common';
import { PrismaService } from '../prisma/prisma.service';

/**
 * PushTokenService — 기기 Expo 푸시 토큰 등록/삭제/조회. 토큰 유일(upsert),
 * tenant 는 사용자 계정에서 유도(요청 페이로드엔 tenant 없음).
 */
@Injectable()
export class PushTokenService {
  constructor(private readonly prisma: PrismaService) {}

  async register(
    userAccountId: bigint,
    token: string,
    platform?: string,
  ): Promise<void> {
    const acc = await this.prisma.userAccount.findUnique({
      where: { id: userAccountId },
      select: { tenantId: true },
    });
    if (!acc) throw new NotFoundException('사용자 계정을 찾을 수 없습니다.');
    await this.prisma.pushToken.upsert({
      where: { token },
      update: {
        userAccountId,
        tenantId: acc.tenantId,
        platform: platform ?? null,
      },
      create: {
        token,
        userAccountId,
        tenantId: acc.tenantId,
        platform: platform ?? null,
      },
    });
  }

  /** 로그아웃/기기 해제 시 토큰 제거. */
  async remove(userAccountId: bigint, token: string): Promise<void> {
    // 본인 소유 토큰만 해제 — 남의 기기 토큰 임의 해제 방지.
    await this.prisma.pushToken.deleteMany({ where: { token, userAccountId } });
  }

  /** 테넌트의 모든 등록 토큰(발송 대상). */
  async tokensForTenant(tenantId: bigint): Promise<string[]> {
    const rows = await this.prisma.pushToken.findMany({
      where: { tenantId },
      select: { token: true },
    });
    return rows.map((r) => r.token);
  }
}
