import { UserSettingsService } from './user-settings.service';

const makePrisma = () => ({
  userSetting: {
    findUnique: jest.fn(),
    upsert: jest.fn().mockResolvedValue({}),
  },
});

describe('UserSettingsService', () => {
  it('get: 존재 시 value 반환', async () => {
    const p = makePrisma();
    p.userSetting.findUnique.mockResolvedValue({ value: { a: 1 } });
    const svc = new UserSettingsService(p as never);
    await expect(svc.get(7n, 'canvas')).resolves.toEqual({ a: 1 });
    expect(p.userSetting.findUnique).toHaveBeenCalledWith({
      where: { userAccountId_key: { userAccountId: 7n, key: 'canvas' } },
      select: { value: true },
    });
  });

  it('get: 없으면 null', async () => {
    const p = makePrisma();
    p.userSetting.findUnique.mockResolvedValue(null);
    const svc = new UserSettingsService(p as never);
    await expect(svc.get(7n, 'canvas')).resolves.toBeNull();
  });

  it('get/set: 호출자(userAccountId)로만 스코프 — 타 사용자 설정 접근 불가(IDOR 방지)', async () => {
    const p = makePrisma();
    p.userSetting.findUnique.mockResolvedValue(null);
    const svc = new UserSettingsService(p as never);
    await svc.get(7n, 'canvas');
    await svc.set(7n, 'canvas', { x: 1 });
    expect(
      p.userSetting.findUnique.mock.calls[0][0].where.userAccountId_key
        .userAccountId,
    ).toBe(7n);
    expect(
      p.userSetting.upsert.mock.calls[0][0].where.userAccountId_key
        .userAccountId,
    ).toBe(7n);
  });

  it('set: upsert — create 에 tenantId+userAccountId, update 에 value', async () => {
    const p = makePrisma();
    const svc = new UserSettingsService(p as never);
    await svc.set(7n, 'canvas', { canvases: [] });
    expect(p.userSetting.upsert).toHaveBeenCalledWith({
      where: { userAccountId_key: { userAccountId: 7n, key: 'canvas' } },
      create: {
        tenantId: 1n,
        userAccountId: 7n,
        key: 'canvas',
        value: { canvases: [] },
      },
      update: { value: { canvases: [] } },
    });
  });
});
