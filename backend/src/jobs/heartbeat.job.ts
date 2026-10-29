import { Injectable, Logger } from '@nestjs/common';
import { Cron, CronExpression } from '@nestjs/schedule';

/**
 * HeartbeatJob — 스케줄러 골격(@nestjs/schedule, NFR-JOB-01).
 * Phase 2에서 이 자리에 '다가오는 기일 산출 일배치(UpcomingMemorialJob, FR-FUN-10)'가 들어간다.
 */
@Injectable()
export class HeartbeatJob {
  private readonly logger = new Logger('Scheduler');

  @Cron(CronExpression.EVERY_HOUR)
  heartbeat(): void {
    this.logger.log('스케줄러 하트비트 — 다가오는 기일 산출 잡 자리(Phase 2)');
  }
}
