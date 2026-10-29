import { SetMetadata, CustomDecorator } from '@nestjs/common';

/** @Public() — 전역 인증/인가 가드를 면제한다(로그인/헬스 등). */
export const IS_PUBLIC_KEY = 'isPublic';
export const Public = (): CustomDecorator => SetMetadata(IS_PUBLIC_KEY, true);

/** @RequirePermissions('member:read', ...) — 엔드포인트에 필요한 권한을 선언한다. */
export const PERMISSIONS_KEY = 'requiredPermissions';
export const RequirePermissions = (...permissions: string[]): CustomDecorator =>
  SetMetadata(PERMISSIONS_KEY, permissions);
