import { Reflector } from '@nestjs/core';
import { PERMISSIONS_KEY } from '../rbac/decorators';
import { BuddhistServicesController } from './buddhist-services.controller';

describe('BuddhistServicesController 권한 선언(서버강제)', () => {
  const reflector = new Reflector();
  const perm = (fn: (...a: never[]) => unknown) =>
    reflector.get<string[]>(PERMISSIONS_KEY, fn);

  it('각 핸들러에 buddhist_service:* 권한 선언', () => {
    const c = BuddhistServicesController.prototype;
    expect(perm(c.list)).toEqual(['buddhist_service:read']);
    expect(perm(c.getOne)).toEqual(['buddhist_service:read']);
    expect(perm(c.create)).toEqual(['buddhist_service:create']);
    expect(perm(c.update)).toEqual(['buddhist_service:update']);
    expect(perm(c.remove)).toEqual(['buddhist_service:delete']);
  });
});

describe('BuddhistServicesController 위임', () => {
  const svc = {
    create: jest.fn().mockResolvedValue({ id: '100' }),
    softDelete: jest.fn().mockResolvedValue(undefined),
  };
  const user = { sub: '99', roles: ['STAFF'] };

  it('create 는 tenantId·actorId·dto 로 위임', async () => {
    const c = new BuddhistServicesController(svc as never);
    await c.create({ memberId: '10', buddhistServiceItemId: '5' }, user);
    expect(svc.create).toHaveBeenCalledWith(1n, 99n, {
      memberId: '10',
      buddhistServiceItemId: '5',
    });
  });

  it('remove 는 softDelete 로 위임', async () => {
    const c = new BuddhistServicesController(svc as never);
    await c.remove('100', user);
    expect(svc.softDelete).toHaveBeenCalledWith(1n, 99n, 100n);
  });
});
