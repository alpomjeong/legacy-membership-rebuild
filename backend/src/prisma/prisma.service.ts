import { Injectable, OnModuleDestroy, OnModuleInit } from '@nestjs/common';
import { PrismaClient } from '@prisma/client';

/**
 * PrismaService — Prisma 클라이언트 수명주기를 Nest 모듈 수명주기에 결합한다(E0.3, T0.3.2).
 * 부팅 시 $connect, 종료 시 $disconnect. 전역 소프트삭제/Tenant 미들웨어는 후속 작업에서 확장한다.
 */
@Injectable()
export class PrismaService
  extends PrismaClient
  implements OnModuleInit, OnModuleDestroy
{
  async onModuleInit(): Promise<void> {
    await this.$connect();
  }

  async onModuleDestroy(): Promise<void> {
    await this.$disconnect();
  }
}
