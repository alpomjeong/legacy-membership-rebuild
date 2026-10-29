import {
  CanActivate,
  ExecutionContext,
  ForbiddenException,
  Injectable,
} from '@nestjs/common';
import { Reflector } from '@nestjs/core';
import { IS_PUBLIC_KEY, PERMISSIONS_KEY } from './decorators';
import { PermissionService } from './permission.service';

/**
 * PermissionsGuard — 전역 인가 가드(NFR-SEC-04). @RequirePermissions 로 선언된 권한을
 * 호출자의 역할이 보유하는지 서버에서 강제한다. 미보유 시 403. @Public 은 면제.
 * 인증(JwtAuthGuard)이 선행하여 req.user = { sub, roles } 를 주입한다.
 */
@Injectable()
export class PermissionsGuard implements CanActivate {
  constructor(
    private readonly reflector: Reflector,
    private readonly permissions: PermissionService,
  ) {}

  async canActivate(context: ExecutionContext): Promise<boolean> {
    const isPublic = this.reflector.getAllAndOverride<boolean>(IS_PUBLIC_KEY, [
      context.getHandler(),
      context.getClass(),
    ]);
    if (isPublic) return true;

    const required =
      this.reflector.getAllAndOverride<string[]>(PERMISSIONS_KEY, [
        context.getHandler(),
        context.getClass(),
      ]) ?? [];
    if (required.length === 0) return true;

    const req = context
      .switchToHttp()
      .getRequest<{ user?: { roles?: string[] } }>();
    const user = req.user;
    if (!user) throw new ForbiddenException();

    const granted = await this.permissions.permissionsForRoles(
      user.roles ?? [],
    );
    const ok = required.every((p) => granted.has(p));
    if (!ok) throw new ForbiddenException('권한이 없습니다');
    return true;
  }
}
