import { ServiceUnavailableException } from '@nestjs/common';
import { HealthController } from './health.controller';

describe('HealthController', () => {
  const prisma = { $queryRaw: jest.fn() };
  const make = () => new HealthController(prisma as never);

  it('liveness: 상태 ok 와 서비스명', () => {
    const res = make().check();
    expect(res.status).toBe('ok');
    expect(res.service).toBe('temple-membership-api');
  });

  it('readiness: DB ping 성공 → up', async () => {
    prisma.$queryRaw.mockResolvedValueOnce([{ ok: 1 }]);
    await expect(make().ready()).resolves.toEqual({ status: 'ok', db: 'up' });
  });

  it('readiness: DB 실패 → 503', async () => {
    prisma.$queryRaw.mockRejectedValueOnce(new Error('down'));
    await expect(make().ready()).rejects.toBeInstanceOf(
      ServiceUnavailableException,
    );
  });
});
