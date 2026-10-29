import { Module } from '@nestjs/common';
import { ConfigModule } from '@nestjs/config';
import { APP_GUARD } from '@nestjs/core';
import { ThrottlerModule, ThrottlerGuard } from '@nestjs/throttler';
import { LoggerModule } from 'nestjs-pino';
import { randomUUID } from 'node:crypto';
import { AppController } from './app.controller';
import { AppService } from './app.service';
import { HealthController } from './health/health.controller';
import { PrismaModule } from './prisma/prisma.module';
import { AuthModule } from './auth/auth.module';
import { RbacModule } from './rbac/rbac.module';
import { CommonCodeModule } from './master/common-code/common-code.module';
import { MembersModule } from './members/members.module';
import { BuddhistServicesModule } from './buddhist-services/buddhist-services.module';
import { SearchModule } from './search/search.module';
import { EnshrinementsModule } from './enshrinements/enshrinements.module';
import { CounselsModule } from './counsels/counsels.module';
import { MastersModule } from './masters/masters.module';
import { DataImportModule } from './data-import/data-import.module';
import { StaffModule } from './staff/staff.module';
import { MenusModule } from './menus/menus.module';
import { StorageModule } from './storage/storage.module';
import { JobsModule } from './jobs/jobs.module';
import { AccountsModule } from './accounts/accounts.module';
import { UploadsModule } from './uploads/uploads.module';
import { UserSettingsModule } from './user-settings/user-settings.module';
import { BackupModule } from './backup/backup.module';
import { LegacyMigrationModule } from './migration/legacy-migration.module';
import { ServeStaticModule } from '@nestjs/serve-static';
import { NotificationsModule } from './notifications/notifications.module';

@Module({
  imports: [
    ConfigModule.forRoot({ isGlobal: true }),
    // 레이트리밋 — IP 단위 인메모리(단일 프로세스). 전역 기본은 넉넉히(정상 사용 방해 없이),
    //   인증 엔드포인트는 컨트롤러에서 @Throttle 로 타이트하게(무차별 대입 방어).
    ThrottlerModule.forRoot([{ ttl: 60000, limit: 300 }]),
    // 네이티브 단일 프로세스: STATIC_DIR 설정 시 pc-web 정적 빌드를 API 와 같은 오리진으로 서빙.
    // 미설정(개발)이면 프론트는 Vite dev 서버가 서빙 → 이 모듈은 건너뜀.
    ...(process.env.STATIC_DIR
      ? [
          ServeStaticModule.forRoot({
            rootPath: process.env.STATIC_DIR,
            exclude: ['/api/{*path}'],
          }),
        ]
      : []),
    // 구조적 로깅(Pino) — 요청 단위 traceId, 민감정보 redact (NFR-OBS-01)
    LoggerModule.forRoot({
      pinoHttp: {
        genReqId: (req, res) => {
          const h = req.headers['x-request-id'];
          const id = (Array.isArray(h) ? h[0] : h) ?? randomUUID();
          res.setHeader('x-request-id', id);
          return id;
        },
        redact: [
          'req.headers.authorization',
          'req.headers.cookie',
          'req.body.password',
          'req.body.currentPassword',
          'req.body.newPassword',
          'req.body.refreshToken',
          'req.body.jumin',
          'req.body.juminNo',
        ],
        transport:
          process.env.NODE_ENV !== 'production'
            ? { target: 'pino-pretty', options: { singleLine: true } }
            : undefined,
      },
    }),
    PrismaModule,
    AuthModule,
    RbacModule,
    CommonCodeModule,
    MembersModule,
    BuddhistServicesModule,
    SearchModule,
    EnshrinementsModule,
    CounselsModule,
    MastersModule,
    DataImportModule,
    StaffModule,
    MenusModule,
    StorageModule,
    JobsModule,
    AccountsModule,
    UploadsModule,
    UserSettingsModule,
    BackupModule,
    LegacyMigrationModule,
    NotificationsModule,
  ],
  controllers: [AppController, HealthController],
  providers: [AppService, { provide: APP_GUARD, useClass: ThrottlerGuard }],
})
export class AppModule {}
