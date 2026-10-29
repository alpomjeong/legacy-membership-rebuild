import { Controller, Get, ServiceUnavailableException } from '@nestjs/common';
import { Public } from '../rbac/decorators';
import { PrismaService } from '../prisma/prisma.service';

/** 헬스체크 — liveness(`/health`) + readiness(`/health/ready`, DB ping). E0.8 */
@Controller('health')
export class HealthController {
  constructor(private readonly prisma: PrismaService) {}

  @Public()
  @Get()
  check(): { status: string; service: string; ts: string } {
    return {
      status: 'ok',
      service: 'temple-membership-api',
      ts: new Date().toISOString(),
    };
  }

  @Public()
  @Get('ready')
  async ready(): Promise<{ status: string; db: string }> {
    try {
      await this.prisma.$queryRaw`SELECT 1`;
      return { status: 'ok', db: 'up' };
    } catch {
      throw new ServiceUnavailableException({ status: 'down', db: 'down' });
    }
  }
}
