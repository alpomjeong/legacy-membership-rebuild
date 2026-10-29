import { ForbiddenException } from '@nestjs/common';
import { PermissionsGuard } from './permissions.guard';
import { PERMISSIONS_KEY, IS_PUBLIC_KEY } from './decorators';

function makeCtx(user: unknown, meta: Record<string, unknown>) {
  const reflector = { getAllAndOverride: (key: string) => meta[key] } as never;
  const context = {
    getHandler: () => ({}),
    getClass: () => ({}),
    switchToHttp: () => ({ getRequest: () => ({ user }) }),
  } as never;
  return { reflector, context };
}
const permsFor = (codes: string[]) =>
  ({
    permissionsForRoles: jest.fn().mockResolvedValue(new Set(codes)),
  }) as never;

describe('PermissionsGuard (NFR-SEC-04 / FR-AUTH-25)', () => {
  it('필요 권한 없음 → 통과', async () => {
    const { reflector, context } = makeCtx(
      { roles: ['READONLY'] },
      { [PERMISSIONS_KEY]: [] },
    );
    const g = new PermissionsGuard(reflector, permsFor([]));
    await expect(g.canActivate(context)).resolves.toBe(true);
  });

  it('@Public → 통과', async () => {
    const { reflector, context } = makeCtx(undefined, {
      [IS_PUBLIC_KEY]: true,
    });
    const g = new PermissionsGuard(reflector, permsFor([]));
    await expect(g.canActivate(context)).resolves.toBe(true);
  });

  it('조회 전용은 쓰기 권한 요구 시 403', async () => {
    const { reflector, context } = makeCtx(
      { roles: ['READONLY'] },
      { [PERMISSIONS_KEY]: ['member:create'] },
    );
    const g = new PermissionsGuard(reflector, permsFor(['member:read']));
    await expect(g.canActivate(context)).rejects.toBeInstanceOf(
      ForbiddenException,
    );
  });

  it('관리자는 요구 권한 보유 시 통과', async () => {
    const { reflector, context } = makeCtx(
      { roles: ['ADMIN'] },
      { [PERMISSIONS_KEY]: ['member:create'] },
    );
    const g = new PermissionsGuard(
      reflector,
      permsFor(['member:create', 'member:read']),
    );
    await expect(g.canActivate(context)).resolves.toBe(true);
  });

  it('인증 주체 없음 → 403', async () => {
    const { reflector, context } = makeCtx(undefined, {
      [PERMISSIONS_KEY]: ['member:read'],
    });
    const g = new PermissionsGuard(reflector, permsFor([]));
    await expect(g.canActivate(context)).rejects.toBeInstanceOf(
      ForbiddenException,
    );
  });
});
