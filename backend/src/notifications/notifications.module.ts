import { Module } from '@nestjs/common';
import { ConfigService } from '@nestjs/config';
import { PushTokenController } from './push-token.controller';
import { PushTokenService } from './push-token.service';
import { ExpoPushService } from './expo-push.service';
import { MemorialNotifyJob } from './memorial-notify.job';
import {
  NOTIFY_CONFIG,
  loadNotifyConfig,
  type NotifyConfig,
} from './notifications.config';

/**
 * NotificationsModule — 기일 알림 푸시(FR-FUN-10). 기기 토큰 등록 + 일배치 산출/발송.
 * ScheduleModule.forRoot 는 JobsModule 에서 로드됨(@Cron 앱 전역 동작).
 */
@Module({
  controllers: [PushTokenController],
  providers: [
    PushTokenService,
    ExpoPushService,
    MemorialNotifyJob,
    {
      provide: NOTIFY_CONFIG,
      useFactory: (config: ConfigService): NotifyConfig =>
        loadNotifyConfig((k) => config.get<string>(k)),
      inject: [ConfigService],
    },
  ],
  exports: [PushTokenService],
})
export class NotificationsModule {}
