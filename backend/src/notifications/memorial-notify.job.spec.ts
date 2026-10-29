import { MemorialNotifyJob } from './memorial-notify.job';

const cfg = { enabled: true, notifyHour: 9, lookaheadDays: 3 };

describe('MemorialNotifyJob.runOnce', () => {
  it('computes upcoming and sends to tenant tokens', async () => {
    const now = new Date('2026-07-02T09:00:00');
    const prisma = {
      enshrinementEvent: {
        findMany: jest.fn().mockResolvedValue([
          {
            id: 1n,
            tenantId: 1n,
            eventDateSolar: new Date('2010-07-02T00:00:00'),
            label: '홍길동',
          },
          {
            id: 2n,
            tenantId: 1n,
            eventDateSolar: new Date('2000-01-01T00:00:00'),
            label: '먼기일',
          },
        ]),
      },
    };
    const pushTokens = {
      tokensForTenant: jest.fn().mockResolvedValue(['ExpoPushToken[a]']),
    };
    const expo = { send: jest.fn().mockResolvedValue({ sent: 1 }) };

    const job = new MemorialNotifyJob(
      prisma as never,
      pushTokens as never,
      expo as never,
      cfg,
    );
    const r = await job.runOnce(now);

    expect(r.memorials).toBe(1); // 오늘 기일 1건, 먼 기일은 제외
    expect(pushTokens.tokensForTenant).toHaveBeenCalledWith(1n);
    expect(expo.send).toHaveBeenCalledTimes(1);
    expect(r.sent).toBe(1);
  });

  it('skips sending when a tenant has upcoming memorials but no registered tokens', async () => {
    const now = new Date('2026-07-02T09:00:00');
    const prisma = {
      enshrinementEvent: {
        findMany: jest.fn().mockResolvedValue([
          {
            id: 1n,
            tenantId: 1n,
            eventDateSolar: new Date('2010-07-02T00:00:00'),
            label: null,
          },
        ]),
      },
    };
    const pushTokens = { tokensForTenant: jest.fn().mockResolvedValue([]) };
    const expo = { send: jest.fn() };

    const job = new MemorialNotifyJob(
      prisma as never,
      pushTokens as never,
      expo as never,
      cfg,
    );
    const r = await job.runOnce(now);

    expect(r.memorials).toBe(1);
    expect(expo.send).not.toHaveBeenCalled();
    expect(r.sent).toBe(0);
  });
});
