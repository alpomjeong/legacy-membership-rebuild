import { Injectable } from '@nestjs/common';
import { Prisma } from '@prisma/client';
import { PrismaService } from '../prisma/prisma.service';

/** 사용자별 UI 설정(JSON) 저장소 — 캔버스 레이아웃 등을 계정 단위로 영속화. */
@Injectable()
export class UserSettingsService {
  private readonly tenantId = 1n;
  constructor(private readonly prisma: PrismaService) {}

  async get(
    userAccountId: bigint,
    key: string,
  ): Promise<Prisma.JsonValue | null> {
    const row = await this.prisma.userSetting.findUnique({
      where: { userAccountId_key: { userAccountId, key } },
      select: { value: true },
    });
    return row?.value ?? null;
  }

  async set(
    userAccountId: bigint,
    key: string,
    value: Prisma.InputJsonValue,
  ): Promise<void> {
    await this.prisma.userSetting.upsert({
      where: { userAccountId_key: { userAccountId, key } },
      create: { tenantId: this.tenantId, userAccountId, key, value },
      update: { value },
    });
  }
}
