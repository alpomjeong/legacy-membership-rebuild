import { Module } from '@nestjs/common';
import { ScheduleModule } from '@nestjs/schedule';
import { HeartbeatJob } from './heartbeat.job';

/**
 * JobsModule — 스케줄러 인프라 (@nestjs/schedule cron). 단일 PC 온프레미스 구성이라
 * BullMQ(Redis) 비동기 큐는 제거(리포트/엑셀은 동기 export 로 처리). @Cron 은 앱 전역 동작.
 */
@Module({
  imports: [ScheduleModule.forRoot()],
  providers: [HeartbeatJob],
})
export class JobsModule {}
