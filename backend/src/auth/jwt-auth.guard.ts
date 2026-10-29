import { ExecutionContext, Injectable } from '@nestjs/common';
import { Reflector } from '@nestjs/core';
import { AuthGuard } from '@nestjs/passport';
import { IS_PUBLIC_KEY } from '../rbac/decorators';

/**
 * JwtAuthGuard — passport-jwt('jwt') 기반 전역 인증 가드.
 * 통과 시 JwtStrategy.validate 결과가 req.user = { sub, roles } 로 주입된다(FR-AUTH-06).
 * @Public 데코레이터가 붙은 핸들러/클래스는 면제한다. 인가(RBAC)는 PermissionsGuard 가 강제.
 */
@Injectable()
export class JwtAuthGuard extends AuthGuard('jwt') {
  constructor(private readonly reflector: Reflector) {
    super();
  }

  canActivate(context: ExecutionContext) {
    const isPublic = this.reflector.getAllAndOverride<boolean>(IS_PUBLIC_KEY, [
      context.getHandler(),
      context.getClass(),
    ]);
    if (isPublic) return true;
    return super.canActivate(context);
  }
}
