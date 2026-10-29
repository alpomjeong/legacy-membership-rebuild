import { createParamDecorator, ExecutionContext } from '@nestjs/common';
import { AuthenticatedUser } from '../auth/jwt.strategy';

/** ExecutionContext → req.user. 테스트를 위해 팩토리를 분리 export 한다. */
export const currentUserFactory = (
  _data: unknown,
  ctx: ExecutionContext,
): AuthenticatedUser =>
  ctx.switchToHttp().getRequest<{ user: AuthenticatedUser }>().user;

/** @CurrentUser() — 핸들러 파라미터에 인증 주체를 주입(PII 없이 sub/roles). */
export const CurrentUser = createParamDecorator(currentUserFactory);

/** 감사 적재용 행위자 id(UserAccount.id). */
export const actorIdOf = (user: AuthenticatedUser): bigint => BigInt(user.sub);
