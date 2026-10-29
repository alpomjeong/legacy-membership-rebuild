import { PermissionService } from './permission.service';

describe('PermissionService', () => {
  it('역할 코드로 권한 코드 집합을 해소한다', async () => {
    const prisma = {
      permission: {
        findMany: jest
          .fn()
          .mockResolvedValue([
            { code: 'member:read' },
            { code: 'member:create' },
          ]),
      },
    };
    const svc = new PermissionService(prisma as never);
    const set = await svc.permissionsForRoles(['STAFF']);
    expect(set.has('member:read')).toBe(true);
    expect(set.has('member:create')).toBe(true);
    expect(prisma.permission.findMany).toHaveBeenCalledTimes(1);
  });

  it('역할이 없으면 빈 집합(쿼리 안 함)', async () => {
    const prisma = { permission: { findMany: jest.fn() } };
    const svc = new PermissionService(prisma as never);
    const set = await svc.permissionsForRoles([]);
    expect(set.size).toBe(0);
    expect(prisma.permission.findMany).not.toHaveBeenCalled();
  });
});
