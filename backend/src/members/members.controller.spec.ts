import { Reflector } from '@nestjs/core';
import { PERMISSIONS_KEY } from '../rbac/decorators';
import { MembersController } from './members.controller';

describe('MembersController 권한 선언(서버강제)', () => {
  const reflector = new Reflector();
  const perm = (fn: (...a: never[]) => unknown) =>
    reflector.get<string[]>(PERMISSIONS_KEY, fn);

  it('각 핸들러에 올바른 member:* 권한 선언', () => {
    const c = MembersController.prototype;
    expect(perm(c.list)).toEqual(['member:read']);
    expect(perm(c.duplicates)).toEqual(['member:read']);
    expect(perm(c.exportXlsx)).toEqual(['member:export']);
    expect(perm(c.getOne)).toEqual(['member:read']);
    expect(perm(c.create)).toEqual(['member:create']);
    expect(perm(c.update)).toEqual(['member:update']);
    expect(perm(c.remove)).toEqual(['member:delete']);
  });
});

describe('MembersController 위임', () => {
  const svc = {
    list: jest
      .fn()
      .mockResolvedValue({ items: [], total: 0, page: 1, pageSize: 20 }),
    create: jest.fn().mockResolvedValue({ id: '1' }),
    softDelete: jest.fn().mockResolvedValue(undefined),
  };
  const user = { sub: '99', roles: ['STAFF'] };

  it('create 는 tenantId·actorId·dto 로 위임', async () => {
    const c = new MembersController(svc as never);
    await c.create({ memberName: '홍길동' }, user);
    expect(svc.create).toHaveBeenCalledWith(1n, 99n, { memberName: '홍길동' });
  });

  it('remove 는 softDelete 로 위임', async () => {
    const c = new MembersController(svc as never);
    await c.remove('10', user);
    expect(svc.softDelete).toHaveBeenCalledWith(1n, 99n, 10n);
  });
});
