import { Module } from '@nestjs/common';
import { APP_GUARD } from '@nestjs/core';
import { JwtAuthGuard } from '../auth/jwt-auth.guard';
import { PermissionService } from './permission.service';
import { PermissionsGuard } from './permissions.guard';

/**
 * RbacModule — 전역 인증(JwtAuthGuard) + 인가(PermissionsGuard) 강제 (E0.5, NFR-SEC-04).
 * 모든 엔드포인트는 기본 보호되며 @Public 으로만 면제한다. 가드는 등록 순서대로 실행(인증→인가).
 * PrismaModule 은 전역이라 PermissionService 가 PrismaService 를 주입받는다.
 */
@Module({
  providers: [
    PermissionService,
    { provide: APP_GUARD, useClass: JwtAuthGuard },
    { provide: APP_GUARD, useClass: PermissionsGuard },
  ],
  exports: [PermissionService],
})
export class RbacModule {}
